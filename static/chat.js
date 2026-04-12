/**
 * FA Agent 对话界面控制器
 * 处理SSE流式输出、消息解析和UI渲染
 * 支持UI动作指令操控地图界面
 */

class ChatController {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.messagesContainer = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.isProcessing = false;
        
        // 当前Agent消息元素
        this.currentThinkingBubble = null;
        this.currentAnswerBubble = null;
        this.thinkingContent = {
            think: '',
            tool_call: '',
            tool_response: ''
        };
        
        // UI动作队列
        this.pendingUIActions = [];
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.autoResizeInput();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    bindEvents() {
        // 发送按钮
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // 输入框回车发送
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 输入框自动调整高度
        this.input.addEventListener('input', () => this.autoResizeInput());
        
        // 清空按钮
        this.clearBtn.addEventListener('click', () => this.clearChat());
    }

    autoResizeInput() {
        this.input.style.height = 'auto';
        this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        const message = this.input.value.trim();
        if (!message || this.isProcessing) return;

        // 添加用户消息
        this.addUserMessage(message);
        
        // 清空输入
        this.input.value = '';
        this.input.style.height = 'auto';
        
        // 重置思考内容
        this.thinkingContent = { think: '', tool_call: '', tool_response: '' };
        this.currentThinkingBubble = null;
        this.currentAnswerBubble = null;
        
        // 【修复】保留上一轮UI动作，用于比较是否真的产生了新地点
        // 只有当新响应产生不同地点时才切换，支持用户在当前推荐基础上追问
        this.previousUIActions = [...this.pendingUIActions];
        this.pendingUIActions = [];
        
        // 发送请求
        await this.streamAgentResponse(message);
    }

    /**
     * 添加用户消息气泡
     */
    addUserMessage(content) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message message-user';
        messageEl.innerHTML = `
            <div class="message-sender">您</div>
            <div class="message-content">${this.escapeHtml(content)}</div>
        `;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    /**
     * 创建思考气泡
     */
    createThinkingBubble() {
        const messageEl = document.createElement('div');
        messageEl.className = 'message message-agent';
        messageEl.innerHTML = `
            <div class="message-sender">Agent</div>
            <div class="message-content message-thinking" id="thinkingBubble">
                <div class="thinking-header" onclick="chatController.toggleThinking(this)">
                    <div class="thinking-icon" id="thinkingIcon"></div>
                    <span class="thinking-status" id="thinkingStatus">思考中...</span>
                    <span class="thinking-toggle" id="thinkingToggle">▼</span>
                </div>
                <div class="thinking-content" id="thinkingContent">
                    <div id="thinkSection" style="display:none">
                        <div class="thinking-section-label">思考过程</div>
                        <div class="thinking-section-content" id="thinkText"></div>
                    </div>
                    <div id="toolCallSection" style="display:none">
                        <div class="thinking-section-label">工具调用</div>
                        <div class="thinking-section-content" id="toolCallText"></div>
                    </div>
                    <div id="toolResponseSection" style="display:none">
                        <div class="thinking-section-label">工具响应</div>
                        <div class="thinking-section-content" id="toolResponseText"></div>
                    </div>
                    <div id="uiActionSection" style="display:none">
                        <div class="thinking-section-label">地图操作</div>
                        <div class="thinking-section-content" id="uiActionText"></div>
                    </div>
                </div>
            </div>
        `;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        return messageEl.querySelector('#thinkingBubble');
    }

    /**
     * 创建回答气泡
     */
    createAnswerBubble() {
        const messageEl = document.createElement('div');
        messageEl.className = 'message message-agent';
        messageEl.innerHTML = `
            <div class="message-sender">Agent</div>
            <div class="message-content message-answer" id="answerBubble">
                <span id="answerText"></span><span class="typing-cursor"></span>
            </div>
        `;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        return messageEl.querySelector('#answerBubble');
    }

    /**
     * 切换思考内容折叠
     */
    toggleThinking(header) {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.thinking-toggle');
        content.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
    }

    /**
     * 更新思考内容显示
     */
    updateThinkingDisplay() {
        if (!this.currentThinkingBubble) return;

        const thinkSection = this.currentThinkingBubble.querySelector('#thinkSection');
        const toolCallSection = this.currentThinkingBubble.querySelector('#toolCallSection');
        const toolResponseSection = this.currentThinkingBubble.querySelector('#toolResponseSection');

        if (this.thinkingContent.think) {
            thinkSection.style.display = 'block';
            thinkSection.querySelector('#thinkText').textContent = this.thinkingContent.think;
        }

        if (this.thinkingContent.tool_call) {
            toolCallSection.style.display = 'block';
            toolCallSection.querySelector('#toolCallText').textContent = this.thinkingContent.tool_call;
        }

        if (this.thinkingContent.tool_response) {
            toolResponseSection.style.display = 'block';
            toolResponseSection.querySelector('#toolResponseText').textContent = this.thinkingContent.tool_response;
        }

        this.scrollToBottom();
    }

    /**
     * 标记思考完成
     */
    completeThinking() {
        if (!this.currentThinkingBubble) return;

        const icon = this.currentThinkingBubble.querySelector('#thinkingIcon');
        const status = this.currentThinkingBubble.querySelector('#thinkingStatus');
        const toggle = this.currentThinkingBubble.querySelector('#thinkingToggle');
        const content = this.currentThinkingBubble.querySelector('#thinkingContent');

        icon.classList.add('completed');
        status.textContent = '思考完成';
        status.style.color = '#4CAF50';
        
        // 自动折叠
        toggle.classList.add('collapsed');
        content.classList.add('collapsed');
    }

    /**
     * 流式获取Agent响应
     */
    async streamAgentResponse(message) {
        this.isProcessing = true;
        this.sendBtn.disabled = true;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    message: message
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data.trim()) {
                            this.handleStreamEvent(data);
                        }
                    }
                }
            }

            // 处理剩余数据
            if (buffer.startsWith('data: ')) {
                const data = buffer.slice(6);
                if (data.trim()) {
                    this.handleStreamEvent(data);
                }
            }

        } catch (error) {
            console.error('Stream error:', error);
            this.addSystemMessage('连接出错，请稍后重试');
        } finally {
            this.isProcessing = false;
            this.sendBtn.disabled = false;
            
            // 完成思考气泡
            this.completeThinking();
            
            // 移除回答气泡的光标
            if (this.currentAnswerBubble) {
                const cursor = this.currentAnswerBubble.querySelector('.typing-cursor');
                if (cursor) cursor.remove();
            }
            
            // 执行待处理的UI动作
            this.executePendingUIActions();
        }
    }

    /**
     * 处理SSE事件
     */
    handleStreamEvent(data) {
        try {
            const event = JSON.parse(data);
            
            switch (event.type) {
                case 'start':
                    // 开始新消息，创建思考气泡
                    this.currentThinkingBubble = this.createThinkingBubble();
                    break;
                    
                case 'think':
                    // 思考内容
                    this.thinkingContent.think += event.content;
                    this.updateThinkingDisplay();
                    break;
                    
                case 'tool_call':
                    // 工具调用
                    this.thinkingContent.tool_call += event.content;
                    this.updateThinkingDisplay();
                    break;
                    
                case 'tool_response':
                    // 工具响应
                    this.thinkingContent.tool_response += event.content;
                    this.updateThinkingDisplay();
                    break;
                    
                case 'answer':
                    // 回答内容 - 流式显示
                    if (!this.currentAnswerBubble) {
                        this.currentAnswerBubble = this.createAnswerBubble();
                    }
                    const answerText = this.currentAnswerBubble.querySelector('#answerText');
                    answerText.textContent += event.content;
                    this.scrollToBottom();
                    break;
                    
                case 'ui_action':
                    // UI动作指令 - 添加到队列等待执行
                    console.log('[ChatController] Received ui_action event:', event.content);
                    if (event.content) {
                        this.pendingUIActions.push(event.content);
                        console.log('[ChatController] Added to pendingUIActions, queue length:', this.pendingUIActions.length);
                        this.updateUIActionDisplay(event.content);
                    } else {
                        console.warn('[ChatController] ui_action event has no content');
                    }
                    break;
                    
                case 'done':
                    // 完成
                    break;
                    
                case 'error':
                    this.addSystemMessage('错误: ' + event.content);
                    break;
            }
        } catch (e) {
            console.error('Parse event error:', e, data);
        }
    }

    /**
     * 更新UI动作显示
     */
    updateUIActionDisplay(action) {
        if (!this.currentThinkingBubble) return;
        
        const uiActionSection = this.currentThinkingBubble.querySelector('#uiActionSection');
        const uiActionText = this.currentThinkingBubble.querySelector('#uiActionText');
        
        if (uiActionSection && uiActionText) {
            uiActionSection.style.display = 'block';
            const actionType = action.type || 'unknown';
            uiActionText.textContent = `[${actionType}] ${JSON.stringify(action)}`;
        }
    }

    /**
     * 比较两个UI动作是否产生相同地点
     */
    areSpotsEqual(action1, action2) {
        if (!action1 || !action2) return false;
        if (action1.type !== action2.type) return false;
        if (action1.type !== 'highlight_spots') return false;
        
        const spots1 = action1.spots || [];
        const spots2 = action2.spots || [];
        
        if (spots1.length !== spots2.length) return false;
        if (spots1.length === 0) return true;
        
        // 比较景点名称列表
        const names1 = spots1.map(s => s.name).sort();
        const names2 = spots2.map(s => s.name).sort();
        
        return names1.every((name, i) => name === names2[i]);
    }
    
    /**
     * 判断是否需要切换地点推荐
     * 只有当新动作与之前动作不同时才切换
     */
    shouldSwitchSpots(newAction) {
        // 如果不是高亮景点动作，直接执行
        if (!newAction || newAction.type !== 'highlight_spots') {
            return true;
        }
        
        // 检查是否与之前的动作产生相同地点
        for (const prevAction of this.previousUIActions) {
            if (this.areSpotsEqual(prevAction, newAction)) {
                console.log('[ChatController] Same spots detected, keeping current highlights');
                return false; // 地点相同，不需要切换
            }
        }
        
        return true; // 新地点，需要切换
    }

    /**
     * 执行待处理的UI动作
     */
    executePendingUIActions() {
        console.log('[ChatController] executePendingUIActions called, pending count:', this.pendingUIActions.length);
        
        if (this.pendingUIActions.length === 0) {
            console.log('[ChatController] No pending UI actions');
            return;
        }
        
        console.log('[ChatController] Executing pending UI actions:', this.pendingUIActions);
        
        // 【修复】智能判断是否需要清除上一轮高亮
        // 只有当新动作包含不同地点时才清除旧的高亮
        const hasNewSpots = this.pendingUIActions.some(action => 
            action.type === 'highlight_spots' && this.shouldSwitchSpots(action)
        );
        
        // 如果有新的不同地点推荐，先清除旧的
        if (hasNewSpots && window.mapController) {
            console.log('[ChatController] New different spots detected, clearing previous highlights');
            window.mapController.clearHighlights();
        }
        
        for (const action of this.pendingUIActions) {
            console.log('[ChatController] Processing action:', action);
            
            // 对于 highlight_spots 动作，检查是否真的需要执行
            if (action.type === 'highlight_spots' && !this.shouldSwitchSpots(action)) {
                console.log('[ChatController] Skipping highlight_spots - same as current');
                continue; // 跳过相同地点的重复高亮
            }
            
            if (window.mapController) {
                console.log('[ChatController] Calling mapController.executeUIAction');
                window.mapController.executeUIAction(action);
            } else {
                console.error('[ChatController] mapController not available!');
            }
        }
        
        // 清空队列
        this.pendingUIActions = [];
        console.log('[ChatController] UI actions queue cleared');
    }

    /**
     * 添加系统消息
     */
    addSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'system-message';
        messageEl.textContent = text;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    /**
     * 清空对话
     */
    async clearChat() {
        // 确认对话框
        if (!confirm('确定要清空所有对话吗？')) return;

        // 清空显示
        this.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">🗺️</div>
                <div class="welcome-title">欢迎使用智能地图助手</div>
                <div class="welcome-subtitle">
                    我可以帮您查询路线、推荐景点、查找餐厅<br>
                    左侧地图会同步显示查询结果
                </div>
            </div>
        `;

        // 重置状态
        this.currentThinkingBubble = null;
        this.currentAnswerBubble = null;
        this.thinkingContent = { think: '', tool_call: '', tool_response: '' };
        this.pendingUIActions = [];
        this.previousUIActions = [];

        // 通知后端清空会话
        try {
            await fetch('/api/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ session_id: this.sessionId })
            });
        } catch (e) {
            console.error('Clear session error:', e);
        }

        // 生成新会话ID
        this.sessionId = this.generateSessionId();
        
        // 清空地图标记
        if (window.mapController) {
            window.mapController.clearHighlights();
        }
    }

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * 地图控制器
 * 负责与iframe中的地图通信，处理UI动作指令
 */
class MapController {
    constructor() {
        this.iframe = document.getElementById('mapFrame');
        this.init();
    }

    init() {
        // 监听地图iframe的消息
        window.addEventListener('message', (e) => {
            this.handleMapMessage(e.data);
        });
    }

    handleMapMessage(data) {
        // 处理地图发送的消息
        console.log('[MapController] Message from map:', data);
        
        if (data && data.type === 'map_event') {
            switch (data.eventType) {
                case 'ready':
                    console.log('[MapController] Map is ready');
                    break;
                case 'spots_highlighted':
                    console.log('[MapController] Spots highlighted:', data.data);
                    break;
                case 'route_shown':
                    console.log('[MapController] Route shown:', data.data);
                    break;
                case 'spot_selected':
                    console.log('[MapController] Spot selected:', data.data);
                    break;
            }
        }
    }

    /**
     * 向地图发送命令
     */
    sendCommand(command, params) {
        console.log('[MapController] Attempting to send command:', command, params);
        console.log('[MapController] iframe element:', this.iframe);
        
        if (!this.iframe) {
            console.error('[MapController] iframe not found!');
            return;
        }
        
        if (!this.iframe.contentWindow) {
            console.error('[MapController] iframe contentWindow not available!');
            return;
        }
        
        const message = {
            type: 'command',
            command: command,
            params: params
        };
        
        console.log('[MapController] Posting message:', message);
        this.iframe.contentWindow.postMessage(message, '*');
        console.log('[MapController] Command sent successfully:', command);
    }

    /**
     * 执行UI动作指令
     */
    executeUIAction(action) {
        console.log('[MapController] executeUIAction called with:', action);
        
        if (!action || !action.type) {
            console.warn('[MapController] Invalid UI action:', action);
            return;
        }
        
        console.log('[MapController] Executing UI action of type:', action.type);
        
        switch (action.type) {
            case 'highlight_spots':
                console.log('[MapController] Processing highlight_spots, spots:', action.spots);
                // 高亮显示景点
                if (action.spots && Array.isArray(action.spots)) {
                    console.log('[MapController] Calling highlightSpots with', action.spots.length, 'spots');
                    this.highlightSpots(action.spots);
                } else {
                    console.warn('[MapController] No spots array or invalid spots:', action.spots);
                }
                break;
                
            case 'show_route':
                // 显示路线
                if (action.from && action.to) {
                    this.showRoute(action.from, action.to, action.mode || 'walking');
                }
                break;
                
            case 'clear_map':
                // 清除地图
                this.clearHighlights();
                this.clearRoute();
                break;
                
            case 'navigate_to':
                // 导航到指定位置
                if (action.lat && action.lng) {
                    this.navigateTo(action.lng, action.lat, action.zoom || 15);
                }
                break;
                
            case 'focus_spot':
                // 聚焦到指定景点
                if (action.name) {
                    this.focusOnSpot(action.name);
                }
                break;
                
            default:
                console.warn('[MapController] Unknown UI action type:', action.type);
        }
    }

    /**
     * 高亮显示景点
     * @param {Array} spots - 景点数组 [{name, lat, lng, description}]
     */
    highlightSpots(spots) {
        console.log('[MapController] highlightSpots called with:', spots);
        
        if (!spots || spots.length === 0) {
            console.warn('[MapController] No spots to highlight');
            return;
        }
        
        // 格式化景点数据
        const formattedSpots = spots.map((spot, index) => ({
            name: spot.name,
            lat: spot.lat,
            lng: spot.lng,
            description: spot.description || '',
            color: spot.color || this.getSpotColor(index)
        }));
        
        console.log('[MapController] Formatted spots:', formattedSpots);
        this.sendCommand('highlightSpots', { spots: formattedSpots });
    }

    /**
     * 显示路线
     * @param {Object} from - 起点 {name, lat, lng}
     * @param {Object} to - 终点 {name, lat, lng}
     * @param {String} mode - 交通方式 walking|driving|transit
     */
    showRoute(from, to, mode = 'walking') {
        // 【修复】显示路线前先清除地点推荐的高亮和面板，避免路线弹窗背后有推荐窗口
        console.log('[MapController] Clearing highlights before showing route');
        this.clearHighlights();
        
        this.sendCommand('showRoute', {
            from: {
                name: from.name,
                lat: from.lat,
                lng: from.lng
            },
            to: {
                name: to.name,
                lat: to.lat,
                lng: to.lng
            },
            mode: mode
        });
    }

    /**
     * 导航到指定位置
     */
    navigateTo(lng, lat, zoom = 15) {
        this.sendCommand('navigateTo', { lng, lat, zoom });
    }

    /**
     * 聚焦到指定景点
     */
    focusOnSpot(name) {
        this.sendCommand('selectSpot', { name });
    }

    /**
     * 清除所有高亮
     */
    clearHighlights() {
        console.log('[MapController] Clearing highlights');
        this.sendCommand('clearSpots', {});
        // 同时清除路线
        this.clearRoute();
    }

    /**
     * 清除路线
     */
    clearRoute() {
        this.sendCommand('clearRoute', {});
    }

    /**
     * 获取景点颜色
     */
    getSpotColor(index) {
        const colors = ['#FF6B35', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#E91E63', '#00BCD4'];
        return colors[index % colors.length];
    }
}

/**
 * 面板大小调整控制器
 */
class ResizeController {
    constructor() {
        this.mapSection = document.getElementById('mapSection');
        this.chatSection = document.getElementById('chatSection');
        this.resizeHandle = document.getElementById('resizeHandle');
        this.isResizing = false;
        
        this.init();
    }

    init() {
        this.resizeHandle.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;
            
            const containerWidth = document.querySelector('.main-container').offsetWidth;
            const mapWidth = e.clientX;
            const chatWidth = containerWidth - mapWidth - 6; // 6px for resize handle
            
            if (mapWidth > 300 && chatWidth > 350) {
                this.mapSection.style.flex = 'none';
                this.mapSection.style.width = mapWidth + 'px';
                this.chatSection.style.width = chatWidth + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
}

// 初始化
console.log('[Main] Starting initialization...');

try {
    const chatController = new ChatController();
    console.log('[Main] ChatController initialized');
    
    const mapController = new MapController();
    console.log('[Main] MapController initialized');
    
    const resizeController = new ResizeController();
    console.log('[Main] ResizeController initialized');

    // 暴露到全局以便HTML调用
    window.chatController = chatController;
    window.mapController = mapController;
    
    console.log('[Main] All controllers initialized successfully');
} catch (error) {
    console.error('[Main] Initialization error:', error);
}

/**
 * FA Agent 对话界面控制器 (支持LUI地图交互)
 * 处理SSE流式输出、消息解析和UI渲染
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
        
        // LUI命令队列
        this.pendingLuiCommands = [];
        
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
        
        // 清空待处理LUI命令
        this.pendingLuiCommands = [];
        
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
     * 执行LUI命令
     */
    executeLuiCommand(command) {
        console.log('执行LUI命令:', command);
        
        // 通过MapController发送给地图
        if (window.mapController) {
            window.mapController.sendCommand('lui', command);
        }
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
            
            // 执行所有待处理的LUI命令
            this.processPendingLuiCommands();
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
                    
                case 'lui':
                    // LUI命令 - 缓存等待执行
                    if (event.command) {
                        this.pendingLuiCommands.push(event.command);
                    }
                    break;
                    
                case 'done':
                    // 完成
                    if (event.lui_commands) {
                        this.pendingLuiCommands = event.lui_commands;
                    }
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
     * 处理待执行的LUI命令
     */
    processPendingLuiCommands() {
        for (const cmd of this.pendingLuiCommands) {
            this.executeLuiCommand(cmd);
        }
        this.pendingLuiCommands = [];
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
        this.pendingLuiCommands = [];

        // 发送清除命令到地图
        this.executeLuiCommand({ type: 'attractions', action: 'clear' });
        this.executeLuiCommand({ type: 'route', action: 'clear' });

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
 * 负责与iframe中的地图通信
 */
class MapController {
    constructor() {
        this.iframe = document.getElementById('mapFrame');
        this.messageQueue = [];
        this.isMapReady = false;
        this.init();
    }

    init() {
        // 监听地图iframe的消息
        window.addEventListener('message', (e) => {
            this.handleMapMessage(e.data);
        });
        
        // 定期检查地图是否准备好
        this.checkMapReady();
    }

    checkMapReady() {
        // 发送ping检查地图是否加载完成
        this.sendCommand('ping', {});
        
        if (!this.isMapReady) {
            setTimeout(() => this.checkMapReady(), 1000);
        }
    }

    handleMapMessage(data) {
        if (typeof data === 'object') {
            if (data.type === 'pong') {
                this.isMapReady = true;
                // 发送队列中的消息
                while (this.messageQueue.length > 0) {
                    const msg = this.messageQueue.shift();
                    this.sendMessage(msg);
                }
            }
        }
    }

    /**
     * 向地图发送命令
     */
    sendCommand(command, params) {
        const message = {
            type: 'command',
            command: command,
            params: params
        };
        
        if (this.isMapReady) {
            this.sendMessage(message);
        } else {
            this.messageQueue.push(message);
        }
    }

    sendMessage(message) {
        if (this.iframe && this.iframe.contentWindow) {
            this.iframe.contentWindow.postMessage(message, '*');
        }
    }

    /**
     * 导航到指定位置
     */
    navigateTo(lng, lat, zoom = 15) {
        this.sendCommand('navigate', { lng, lat, zoom });
    }

    /**
     * 显示路线
     */
    showRoute(routeData) {
        this.sendCommand('showRoute', routeData);
    }

    /**
     * 添加标记点
     */
    addMarker(lng, lat, title) {
        this.sendCommand('addMarker', { lng, lat, title });
    }

    /**
     * 清除所有标记
     */
    clearMarkers() {
        this.sendCommand('clearMarkers', {});
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
const chatController = new ChatController();
const mapController = new MapController();
const resizeController = new ResizeController();

// 暴露到全局以便HTML调用
window.chatController = chatController;
window.mapController = mapController;

/**
 * FA Agent 对话界面控制器
 * 处理SSE流式输出、消息解析和UI渲染
 * 支持UI动作指令操控地图界面
 */

/**
 * 前端 Agent 客户端
 * 替代后端 agent_server.py，直接在浏览器中运行 Agent 对话流
 */
class AgentClient {
    constructor() {
        this.messages = [];
        this.systemMessage = `你是一个专业的澳门旅游导游助手，可以帮助用户解决出行、景点推荐、美食推荐等旅游信息。

## 你可以帮用户：
1. 推荐澳门热门景点、美食、餐厅
2. 查询两地之间的路线规划
3. 回答关于澳门旅游的各种问题

## 回复风格要求：
1. 与用户回答交流的内容简短明了
   1.1 简单问题简单回答，复杂问题可以适当增加字数
2. 口吻随意一些，符合口头回答
   2.1 选择简单的口吻，避免过于正式或书面化的表达
   2.2 禁止使用复杂的符号，仅保留逗号、句号等基本标点符号

## 意图识别与UI动作输出规范（重要）：

你需要根据用户意图，在回复中插入特定的UI动作标记 [UI_ACTION](...) 来操控地图界面。

### 意图类型1：推荐类（景点推荐、美食推荐）
当用户询问以下类型问题时，识别为推荐意图：
- "推荐一些景点"
- "有什么好吃的"
- "哪里好玩"
- "有什么美食"
- "介绍一下大三巴"
- "威尼斯人有什么好玩的"

推荐类意图的输出格式：
1. 在思考过程中分析用户需求
2. 在 [ANSWER] 部分给出向用户回答的文字回复（推荐理由、简要介绍等）
3. 在文字回复后，单独一行输出 UI 动作标记：
   [UI_ACTION]{"type": "highlight_spots", "spots": [{"name": "地点名", "lat": 纬度, "lng": 经度, "description": "描述"}, ...]}

注意：spots 数组中的每个地点必须包含 name、lat、lng 字段。

### 意图类型2：导航/路线规划类
当用户询问以下类型问题时，识别为导航意图：
- "从XX到XX怎么走"
- "怎么去XX"
- "从XX到XX的路线"
- "导航到XX"

导航类意图的输出格式：
1. 在思考过程中分析起点和终点
2. 在 [ANSWER] 部分给出向用户回答的文字回复（简要说明路线建议）
3. 在文字回复后，单独一行输出 UI 动作标记：
   [UI_ACTION]{"type": "show_route", "from": {"name": "起点名", "lat": 纬度, "lng": 经度}, "to": {"name": "终点名", "lat": 纬度, "lng": 经度}, "mode": "walking|driving|transit"}

注意：
- from 和 to 必须包含 name、lat、lng 字段
- mode 默认为 walking（步行），可选 driving（驾车）、transit（公交）
- 如果用户没有指定起点，默认使用当前位置或询问用户

### 示例对话：

用户：推荐几个澳门著名景点
AI思考：用户想要景点推荐，这是推荐类意图。我应该推荐大三巴、威尼斯人、巴黎人等经典景点。
AI输出：
[ANSWER]
推荐您去这几个地方：大三巴牌坊是必打卡的地标，威尼斯人有贡多拉船可以坐，巴黎人的铁塔夜景也很美。
[UI_ACTION]{"type": "highlight_spots", "spots": [{"name": "大三巴牌坊", "lat": 22.1973, "lng": 113.5409, "description": "澳门地标"}, {"name": "威尼斯人", "lat": 22.1483, "lng": 113.5602, "description": "综合度假村"}, {"name": "巴黎人", "lat": 22.1495, "lng": 113.5615, "description": "法式主题度假村"}]}

用户：从大三巴怎么去威尼斯人
AI思考：用户询问路线，这是导航意图。起点是大三巴，终点是威尼斯人。
AI输出：
[ANSWER]
您可以乘坐公交或打车过去，大约需要20-30分钟。建议走西湾大桥，沿途风景不错。
[UI_ACTION]{"type": "show_route", "from": {"name": "大三巴牌坊", "lat": 22.1973, "lng": 113.5409}, "to": {"name": "威尼斯人", "lat": 22.1483, "lng": 113.5602}, "mode": "transit"}

## 澳门主要景点坐标参考（用于输出时校准其它结果的精确经纬度）：
- 关闸: lat=22.2159, lng=113.5489
- 大三巴牌坊: lat=22.1973, lng=113.5409
- 议事亭前地: lat=22.1941, lng=113.5445
- 威尼斯人: lat=22.1483, lng=113.5602
- 巴黎人: lat=22.1495, lng=113.5615
- 伦敦人: lat=22.1510, lng=113.5625
- 新葡京酒店: lat=22.1896, lng=113.5447
- 渔人码头: lat=22.1920, lng=113.5550
- 澳门塔: lat=22.1808, lng=113.5365
- 官也街: lat=22.1530, lng=113.5560
- 妈阁庙: lat=22.1860, lng=113.5310
- 永利皇宫: lat=22.1460, lng=113.5630
- 银河度假城: lat=22.1500, lng=113.5550
`;
    }

    loadSettings() {
        const saved = localStorage.getItem('travel_macau_agent_settings');
        return saved ? JSON.parse(saved) : {};
    }

    refreshSettings() {
        const s = this.loadSettings();
        this.openaiUrl = (s.openaiUrl || '').replace(/\/+$/, '');
        this.openaiKey = s.openaiKey || '';
        this.modelType = s.modelType || '';
        this.amapKey = s.amapKey || '';
    }

    getTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'maps_geo',
                    description: '将详细的结构化地址转换为经纬度坐标。支持对地标性名胜景区、建筑物名称解析为经纬度坐标',
                    parameters: {
                        type: 'object',
                        properties: {
                            address: { type: 'string', description: '待解析的结构化地址信息' },
                            city: { type: 'string', description: '指定查询的城市，例如"澳门"' }
                        },
                        required: ['address']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'maps_text_search',
                    description: '关键词搜索，根据用户传入关键词，搜索出相关的POI',
                    parameters: {
                        type: 'object',
                        properties: {
                            keywords: { type: 'string', description: '搜索关键词' },
                            city: { type: 'string', description: '查询城市，例如"澳门"' },
                            types: { type: 'string', description: 'POI类型，比如加油站' }
                        },
                        required: ['keywords']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'maps_direction_walking',
                    description: '步行路径规划 API 可以根据输入起点终点经纬度坐标规划100km 以内的步行通勤方案',
                    parameters: {
                        type: 'object',
                        properties: {
                            origin: { type: 'string', description: '出发点经度,纬度' },
                            destination: { type: 'string', description: '目的地经度,纬度' }
                        },
                        required: ['origin', 'destination']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'maps_direction_driving',
                    description: '驾车路径规划 API 可以根据用户起终点经纬度坐标规划以小客车、轿车通勤出行的方案',
                    parameters: {
                        type: 'object',
                        properties: {
                            origin: { type: 'string', description: '出发点经度,纬度' },
                            destination: { type: 'string', description: '目的地经度,纬度' }
                        },
                        required: ['origin', 'destination']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'maps_direction_transit_integrated',
                    description: '公交路径规划 API 可以根据用户起终点经纬度坐标规划综合各类公共（火车、公交、地铁）交通方式的通勤方案',
                    parameters: {
                        type: 'object',
                        properties: {
                            origin: { type: 'string', description: '出发点经度,纬度' },
                            destination: { type: 'string', description: '目的地经度,纬度' },
                            city: { type: 'string', description: '公共交通规划起点城市，例如"澳门"' },
                            cityd: { type: 'string', description: '公共交通规划终点城市，例如"澳门"' }
                        },
                        required: ['origin', 'destination', 'city', 'cityd']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'maps_distance',
                    description: '距离测量 API 可以测量两个经纬度坐标之间的距离,支持驾车、步行以及球面距离测量',
                    parameters: {
                        type: 'object',
                        properties: {
                            origins: { type: 'string', description: '起点经度,纬度，可以传多个坐标，使用竖线隔离，比如120,30|120,31' },
                            destination: { type: 'string', description: '终点经度,纬度' },
                            type: { type: 'string', description: '距离测量类型,1代表驾车距离测量，0代表直线距离测量，3步行距离测量' }
                        },
                        required: ['origins', 'destination']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'maps_weather',
                    description: '根据城市名称或者标准adcode查询指定城市的天气',
                    parameters: {
                        type: 'object',
                        properties: {
                            city: { type: 'string', description: '城市名称或者adcode，例如"澳门"' }
                        },
                        required: ['city']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'maps_around_search',
                    description: '周边搜索，根据用户传入关键词以及坐标location，搜索出radius半径范围的POI',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: { type: 'string', description: '中心点经度,纬度' },
                            keywords: { type: 'string', description: '搜索关键词' },
                            radius: { type: 'string', description: '搜索半径，单位米，默认1000' }
                        },
                        required: ['location']
                    }
                }
            }
        ];
    }

    jsonp(url) {
        return new Promise((resolve, reject) => {
            const callbackName = 'amap_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            const script = document.createElement('script');
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('高德 API 请求超时'));
            }, 15000);
            const cleanup = () => {
                clearTimeout(timeout);
                if (script.parentNode) script.parentNode.removeChild(script);
                delete window[callbackName];
            };
            window[callbackName] = (data) => {
                cleanup();
                resolve(data);
            };
            const separator = url.includes('?') ? '&' : '?';
            script.src = url + separator + 'callback=' + encodeURIComponent(callbackName);
            script.onerror = () => {
                cleanup();
                reject(new Error('高德 API 加载失败'));
            };
            document.head.appendChild(script);
        });
    }

    async executeTool(name, args) {
        if (!this.amapKey) {
            throw new Error('未配置高德地图 API Key');
        }
        const key = this.amapKey;
        switch (name) {
            case 'maps_geo': {
                const url = `https://restapi.amap.com/v3/geocode/geo?key=${key}&address=${encodeURIComponent(args.address)}${args.city ? '&city=' + encodeURIComponent(args.city) : ''}`;
                const data = await this.jsonp(url);
                if (data.status !== '1') throw new Error(data.info || '地理编码失败');
                return JSON.stringify({ geocodes: data.geocodes || [] }, null, 2);
            }
            case 'maps_text_search': {
                const url = `https://restapi.amap.com/v3/place/text?key=${key}&keywords=${encodeURIComponent(args.keywords)}${args.city ? '&city=' + encodeURIComponent(args.city) : ''}${args.types ? '&types=' + encodeURIComponent(args.types) : ''}`;
                const data = await this.jsonp(url);
                if (data.status !== '1') throw new Error(data.info || 'POI搜索失败');
                const pois = (data.pois || []).map(p => ({ id: p.id, name: p.name, address: p.address, location: p.location, typecode: p.typecode }));
                return JSON.stringify({ pois }, null, 2);
            }
            case 'maps_direction_walking': {
                const url = `https://restapi.amap.com/v3/direction/walking?key=${key}&origin=${encodeURIComponent(args.origin)}&destination=${encodeURIComponent(args.destination)}`;
                const data = await this.jsonp(url);
                if (data.status !== '1') throw new Error(data.info || '步行规划失败');
                return JSON.stringify({ route: data.route || {} }, null, 2);
            }
            case 'maps_direction_driving': {
                const url = `https://restapi.amap.com/v3/direction/driving?key=${key}&origin=${encodeURIComponent(args.origin)}&destination=${encodeURIComponent(args.destination)}`;
                const data = await this.jsonp(url);
                if (data.status !== '1') throw new Error(data.info || '驾车规划失败');
                return JSON.stringify({ route: data.route || {} }, null, 2);
            }
            case 'maps_direction_transit_integrated': {
                const url = `https://restapi.amap.com/v3/direction/transit/integrated?key=${key}&origin=${encodeURIComponent(args.origin)}&destination=${encodeURIComponent(args.destination)}&city=${encodeURIComponent(args.city || '')}&cityd=${encodeURIComponent(args.cityd || '')}`;
                const data = await this.jsonp(url);
                if (data.status !== '1') throw new Error(data.info || '公交规划失败');
                return JSON.stringify({ route: data.route || {} }, null, 2);
            }
            case 'maps_distance': {
                const url = `https://restapi.amap.com/v3/distance?key=${key}&origins=${encodeURIComponent(args.origins)}&destination=${encodeURIComponent(args.destination)}&type=${encodeURIComponent(args.type || '1')}`;
                const data = await this.jsonp(url);
                if (data.status !== '1') throw new Error(data.info || '距离测量失败');
                return JSON.stringify({ results: data.results || [] }, null, 2);
            }
            case 'maps_weather': {
                const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&city=${encodeURIComponent(args.city)}&extensions=all`;
                const data = await this.jsonp(url);
                if (data.status !== '1') throw new Error(data.info || '天气查询失败');
                return JSON.stringify({ forecasts: (data.forecasts || []).map(f => ({ city: f.city, casts: f.casts })) }, null, 2);
            }
            case 'maps_around_search': {
                const url = `https://restapi.amap.com/v3/place/around?key=${key}&location=${encodeURIComponent(args.location)}${args.keywords ? '&keywords=' + encodeURIComponent(args.keywords) : ''}&radius=${encodeURIComponent(args.radius || '1000')}`;
                const data = await this.jsonp(url);
                if (data.status !== '1') throw new Error(data.info || '周边搜索失败');
                const pois = (data.pois || []).map(p => ({ id: p.id, name: p.name, address: p.address, location: p.location, typecode: p.typecode }));
                return JSON.stringify({ pois }, null, 2);
            }
            default:
                throw new Error('未知工具: ' + name);
        }
    }

    async callLLM() {
        const url = this.openaiUrl + '/chat/completions';
        const body = {
            model: this.modelType,
            messages: this.messages,
            temperature: 0.7,
            top_p: 0.8,
            stream: false
        };
        body.tools = this.getTools();
        body.tool_choice = 'auto';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.openaiKey
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            let errInfo = '';
            try { errInfo = await response.text(); } catch (e) {}
            throw new Error(`LLM API 错误 ${response.status}: ${errInfo}`);
        }
        return await response.json();
    }

    extractUIActions(text) {
        const uiActions = [];
        let resultText = text;
        const pattern = /\[UI_ACTION\]/g;
        let match;
        while ((match = pattern.exec(resultText)) !== null) {
            const startPos = match.index + match[0].length;
            let remaining = resultText.slice(startPos);
            let jsonStart = 0;
            while (jsonStart < remaining.length && /\s/.test(remaining[jsonStart])) jsonStart++;
            remaining = remaining.slice(jsonStart);
            if (remaining.startsWith('{')) {
                let braceCount = 0;
                let jsonEnd = 0;
                for (let i = 0; i < remaining.length; i++) {
                    if (remaining[i] === '{') braceCount++;
                    else if (remaining[i] === '}') {
                        braceCount--;
                        if (braceCount === 0) { jsonEnd = i + 1; break; }
                    }
                }
                if (jsonEnd > 0) {
                    const jsonStr = remaining.slice(0, jsonEnd);
                    try {
                        uiActions.push(JSON.parse(jsonStr));
                        resultText = resultText.slice(0, match.index) + resultText.slice(startPos + jsonStart + jsonEnd);
                        pattern.lastIndex = match.index;
                    } catch (e) {}
                }
            }
        }
        return { cleanText: resultText.trim(), uiActions };
    }

    async *run(userMessage) {
        this.refreshSettings();
        if (!this.openaiUrl || !this.openaiKey || !this.modelType) {
            throw new Error('請先在設置中設定LLM的Base URL、Key和Model');
        }
        if (!this.amapKey) {
            throw new Error('請先在設置中配置高德地圖API Key');
        }

        yield { type: 'start' };

        if (this.messages.length === 0) {
            this.messages.push({ role: 'system', content: this.systemMessage });
        }
        this.messages.push({ role: 'user', content: userMessage });

        if (this.messages.length > 20) {
            const systemMsg = this.messages[0];
            const recent = this.messages.slice(-18);
            this.messages = [systemMsg, ...recent];
        }

        const maxIterations = 4;
        for (let i = 0; i < maxIterations; i++) {
            const response = await this.callLLM();
            const choice = response.choices[0];
            const message = choice.message || {};

            if (message.reasoning_content) {
                yield { type: 'think', content: message.reasoning_content };
            }

            if (message.tool_calls && message.tool_calls.length > 0) {
                this.messages.push({
                    role: 'assistant',
                    content: message.content || '',
                    tool_calls: message.tool_calls.map(tc => ({
                        id: tc.id,
                        type: tc.type || 'function',
                        function: {
                            name: tc.function.name,
                            arguments: tc.function.arguments
                        }
                    }))
                });

                for (const tc of message.tool_calls) {
                    let args;
                    try {
                        args = JSON.parse(tc.function.arguments);
                    } catch (e) {
                        args = {};
                    }
                    yield { type: 'tool_call', content: `${tc.function.name}\n${JSON.stringify(args, null, 2)}` };

                    try {
                        const result = await this.executeTool(tc.function.name, args);
                        yield { type: 'tool_response', content: `${tc.function.name}\n${result}` };
                        this.messages.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: result
                        });
                    } catch (err) {
                        const errText = `Error: ${err.message}`;
                        yield { type: 'tool_response', content: `${tc.function.name}\n${errText}` };
                        this.messages.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: errText
                        });
                    }
                }
                continue;
            } else {
                const fullText = message.content || '';
                let answerText = fullText;
                answerText = answerText.replace(/\[THINK\][\s\S]*?(?=\[ANSWER\]|\[UI_ACTION\]|$)/, '');
                const ansMatch = answerText.match(/\[ANSWER\]([\s\S]*)/);
                if (ansMatch) {
                    answerText = ansMatch[1];
                }
                answerText = answerText.replace(/\[UI_ACTION\][\s\S]*$/, '').trim();

                const chunkSize = 3;
                const delayMs = 20;
                for (let idx = 0; idx < answerText.length; idx += chunkSize) {
                    yield { type: 'answer', content: answerText.slice(idx, idx + chunkSize) };
                    await new Promise(r => setTimeout(r, delayMs));
                }

                const { uiActions } = this.extractUIActions(fullText);
                for (const action of uiActions) {
                    yield { type: 'ui_action', content: action };
                }

                this.messages.push({ role: 'assistant', content: fullText });
                break;
            }
        }

        yield { type: 'done' };
    }

    clearSession() {
        this.messages = [];
    }
}

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
        
        // 前端Agent客户端
        this.agentClient = new AgentClient();
        
        // 设置弹窗相关元素
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsPopup = document.getElementById('settingsPopup');
        this.settingsClose = document.getElementById('settingsClose');
        this.settingsCancel = document.getElementById('settingsCancel');
        this.settingsSave = document.getElementById('settingsSave');
        this.settingOpenaiUrl = document.getElementById('settingOpenaiUrl');
        this.settingOpenaiKey = document.getElementById('settingOpenaiKey');
        this.settingModelType = document.getElementById('settingModelType');
        this.settingAmapKey = document.getElementById('settingAmapKey');
        
        // 清空确认弹窗相关元素
        this.clearConfirmPopup = document.getElementById('clearConfirmPopup');
        this.clearConfirmClose = document.getElementById('clearConfirmClose');
        this.clearConfirmCancel = document.getElementById('clearConfirmCancel');
        this.clearConfirmOk = document.getElementById('clearConfirmOk');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.autoResizeInput();
        this.initPresetPrompts();
        this.initSettings();
    }

    /**
     * 初始化预设快捷输入按钮
     */
    initPresetPrompts() {
        const presetPrompts = [
            "推荐澳门热门景点",
            "从关闸到大三巴怎么走",
            "氹仔都有什么赌场玩",
            "澳门有自然风景吗",
            "哪能俯瞰整个澳门",
            "我想品尝正宗葡国菜",
            "通常澳门奢侈品消费都在哪买到",
            "从渔人码头怎么回澳门海关",
            "我在东望洋从哪个海关出境比较快",
            "推荐一些澳门景点",
            "澳门有什么好吃的",
            "内岛哪里好玩",
            "有什么美食澳门特色的",
            "介绍一下大三巴",
            "威尼斯人有什么好玩的",
            "从渔人码头到亚马喇怎么走",
            "怎么去水坑尾",
            "导航到大炮台",
            "从美高梅到银河的路线",
            "澳门世界遗产有哪些",
            "适合拍照打卡的地方",
            "澳门博物馆门票多少",
            "从机场到威尼斯人怎么走",
            "安德鲁蛋挞哪家正宗",
            "石排湾郊野公园",
            "路环民宿有吗",
            "经济型酒店哪里找",
        ];

        // 随机排序
        const shuffledPrompts = this.shuffleArray([...presetPrompts]);
        
        const container = document.getElementById('presetPromptsContainer');
        if (!container) return;

        // 清空容器
        container.innerHTML = '';

        // 创建按钮
        shuffledPrompts.forEach(prompt => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = prompt;
            btn.addEventListener('click', () => {
                this.input.value = prompt;
                this.autoResizeInput();
                this.sendMessage();
            });
            container.appendChild(btn);
        });

        // 添加滚轮水平滚动功能
        container.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                container.scrollLeft += e.deltaY;
            }
        });
    }

    /**
     * 数组随机排序（Fisher-Yates 算法）
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
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
        this.clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showClearConfirmPopup();
        });
        
        // 设置按钮
        this.bindSettingsEvents();
        
        // 清空确认弹窗
        this.bindClearConfirmEvents();
    }

    /**
     * 绑定设置弹窗事件
     */
    bindSettingsEvents() {
        if (!this.settingsBtn || !this.settingsPopup) return;
        
        // 点击设置按钮显示/隐藏弹窗
        this.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSettingsPopup();
        });
        
        // 关闭按钮
        if (this.settingsClose) {
            this.settingsClose.addEventListener('click', () => this.hideSettingsPopup());
        }
        
        // 取消按钮
        if (this.settingsCancel) {
            this.settingsCancel.addEventListener('click', () => this.hideSettingsPopup());
        }
        
        // 保存按钮
        if (this.settingsSave) {
            this.settingsSave.addEventListener('click', () => this.saveSettings());
        }
        
        // 点击弹窗外部关闭
        document.addEventListener('click', (e) => {
            if (this.settingsPopup.classList.contains('show') && 
                !this.settingsPopup.contains(e.target) && 
                e.target !== this.settingsBtn &&
                !this.settingsBtn.contains(e.target)) {
                this.hideSettingsPopup();
            }
        });
    }

    /**
     * 绑定清空确认弹窗事件
     */
    bindClearConfirmEvents() {
        if (!this.clearConfirmPopup) return;
        
        // 关闭按钮
        if (this.clearConfirmClose) {
            this.clearConfirmClose.addEventListener('click', () => this.hideClearConfirmPopup());
        }
        
        // 取消按钮
        if (this.clearConfirmCancel) {
            this.clearConfirmCancel.addEventListener('click', () => this.hideClearConfirmPopup());
        }
        
        // 确认清空按钮
        if (this.clearConfirmOk) {
            this.clearConfirmOk.addEventListener('click', () => this.executeClearChat());
        }
        
        // 点击弹窗外部关闭
        document.addEventListener('click', (e) => {
            if (this.clearConfirmPopup.classList.contains('show') && 
                !this.clearConfirmPopup.contains(e.target) && 
                e.target !== this.clearBtn &&
                !this.clearBtn.contains(e.target) &&
                e.target !== this.settingsBtn &&
                !this.settingsBtn.contains(e.target)) {
                this.hideClearConfirmPopup();
            }
        });
    }

    /**
     * 显示清空确认弹窗
     */
    showClearConfirmPopup() {
        if (!this.clearConfirmPopup) return;
        // 如果设置弹窗正在显示，先关闭它
        if (this.settingsPopup && this.settingsPopup.classList.contains('show')) {
            this.hideSettingsPopup();
        }
        this.clearConfirmPopup.classList.add('show');
    }

    /**
     * 隐藏清空确认弹窗
     */
    hideClearConfirmPopup() {
        if (!this.clearConfirmPopup) return;
        this.clearConfirmPopup.classList.remove('show');
    }

    /**
     * 切换设置弹窗显示状态
     */
    toggleSettingsPopup() {
        if (this.settingsPopup.classList.contains('show')) {
            this.hideSettingsPopup();
        } else {
            this.showSettingsPopup();
        }
    }

    /**
     * 显示设置弹窗
     */
    showSettingsPopup() {
        // 如果清空确认弹窗正在显示，先关闭它
        if (this.clearConfirmPopup && this.clearConfirmPopup.classList.contains('show')) {
            this.hideClearConfirmPopup();
        }
        this.loadSettingsToForm();
        this.settingsPopup.classList.add('show');
    }

    /**
     * 隐藏设置弹窗
     */
    hideSettingsPopup() {
        this.settingsPopup.classList.remove('show');
    }

    /**
     * 初始化设置 - 从 localStorage 加载
     */
    initSettings() {
        const savedSettings = localStorage.getItem('travel_macau_agent_settings');
        if (savedSettings) {
            this.settings = JSON.parse(savedSettings);
        } else {
            this.settings = {
                openaiUrl: '',
                openaiKey: '',
                modelType: '',
                amapKey: ''
            };
        }
    }

    /**
     * 加载设置到表单
     */
    loadSettingsToForm() {
        if (this.settingOpenaiUrl) this.settingOpenaiUrl.value = this.settings.openaiUrl || '';
        if (this.settingOpenaiKey) this.settingOpenaiKey.value = this.settings.openaiKey || '';
        if (this.settingModelType) this.settingModelType.value = this.settings.modelType || '';
        if (this.settingAmapKey) this.settingAmapKey.value = this.settings.amapKey || '';
    }

    /**
     * 保存设置
     */
    saveSettings() {
        this.settings = {
            openaiUrl: this.settingOpenaiUrl ? this.settingOpenaiUrl.value : '',
            openaiKey: this.settingOpenaiKey ? this.settingOpenaiKey.value : '',
            modelType: this.settingModelType ? this.settingModelType.value : '',
            amapKey: this.settingAmapKey ? this.settingAmapKey.value : ''
        };
        
        localStorage.setItem('travel_macau_agent_settings', JSON.stringify(this.settings));
        this.hideSettingsPopup();
        
        if (this.agentClient) {
            this.agentClient.refreshSettings();
        }
        
        console.log('[ChatController] 设置已保存到 localStorage');
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
     * 过滤答案内容，只保留 [ANSWER] 部分
     * 移除 [THINK] 和 [UI_ACTION] 内容
     */
    filterAnswerContent(content) {
        if (!content) return '';
        
        // 如果内容包含 [ANSWER] 标记，只提取 ANSWER 部分
        if (content.includes('[ANSWER]')) {
            const answerMatch = content.match(/\[ANSWER\]([\s\S]*?)(?=\[UI_ACTION\]|$)/);
            if (answerMatch && answerMatch[1]) {
                return answerMatch[1].trim();
            }
        }
        
        // 过滤掉 [THINK] 部分
        content = content.replace(/\[THINK\][\s\S]*?(?=\[ANSWER\]|\[UI_ACTION\]|$)/g, '');
        
        // 过滤掉 [UI_ACTION] 部分
        content = content.replace(/\[UI_ACTION\][\s\S]*?$/g, '');
        
        // 移除 [ANSWER] 标记本身
        content = content.replace(/\[ANSWER\]/g, '');
        
        return content.trim();
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
            for await (const event of this.agentClient.run(message)) {
                this.handleStreamEvent(JSON.stringify(event));
            }
        } catch (error) {
            console.error('Agent error:', error);
            this.addSystemMessage(error.message || '请求失败，请检查网络或API配置');
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
                    // 过滤掉 [THINK] 和 [UI_ACTION] 内容，只保留 [ANSWER] 部分
                    const filteredContent = this.filterAnswerContent(event.content);
                    answerText.textContent += filteredContent;
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
     * 执行清空对话
     */
    async executeClearChat() {
        // 隐藏确认弹窗
        this.hideClearConfirmPopup();

        // 清空显示
        this.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">🗺️</div>
                <div class="welcome-title">歡迎使用澳門出行助手</div>
                <div class="welcome-subtitle">
                    我可以幫你查詢路線、推薦景點、解答你感興趣的內容<br>
                    左側地圖會同步顯示我們查詢的內容
                </div>
            </div>
        `;

        // 重置状态
        this.currentThinkingBubble = null;
        this.currentAnswerBubble = null;
        this.thinkingContent = { think: '', tool_call: '', tool_response: '' };
        this.pendingUIActions = [];
        this.previousUIActions = [];

        // 重置前端Agent会话
        this.agentClient.clearSession();

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

#!/usr/bin/env python3
"""
Agent对话API服务器
提供SSE流式输出接口供前端调用
支持UI动作标记 [UI_ACTION] 实现LUI操控地图界面
"""

import os
import sys
import json
import asyncio
import re
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 添加项目根目录到 Python 路径
PARENT_DIR = os.path.dirname(os.path.abspath(__file__))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from config import LLM_CONFIG
from qwen_agent.agents import Assistant
from macau_attractions import (
    MACAU_ATTRACTIONS, 
    search_attractions, 
    format_attractions_for_highlight,
    get_attraction_by_name,
    resolve_location_name
)

# ============ Agent 配置 ============
SYSTEM_MESSAGE = '''你是一个专业的澳门旅游导游助手，可以帮助用户解决出行、景点推荐、美食推荐等旅游信息。

## 你可以帮用户：
1. 推荐澳门热门景点、美食、餐厅
2. 查询两地之间的路线规划
3. 回答关于澳门旅游的各种问题

## 回复风格要求：
1. 每次回复内容普遍较短(约1~50字)
   1.1 简单问题简单回答，复杂问题可以适当增加字数，保持简洁明了
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
2. 在 [ANSWER] 部分先给出文字回复
3. 在文字回复后，单独一行输出 UI 动作标记：
   [UI_ACTION]{"type": "highlight_spots", "spots": [{"name": "地点名", "lat": 纬度, "lng": 经度, "description": "描述"}, ...]}

注意：spots 数组中的每个地点必须包含 name、lat、lng 字段。

### 意图类型2：导航/路线规划类
当用户询问以下类型问题时，识别为导航意图：
- "从XX到XX怎么走"
- "怎么去XX"
- "从XX到XX的路线"
- "导航到XX"
- "从大三巴到威尼斯人"

导航类意图的输出格式：
1. 在思考过程中分析起点和终点
2. 在 [ANSWER] 部分先给出文字回复（简要说明路线建议）
3. 在文字回复后，单独一行输出 UI 动作标记：
   [UI_ACTION]{"type": "show_route", "from": {"name": "起点名", "lat": 纬度, "lng": 经度}, "to": {"name": "终点名", "lat": 纬度, "lng": 经度}, "mode": "walking|driving|transit"}

注意：
- from 和 to 必须包含 name、lat、lng 字段
- mode 默认为 walking（步行），可选 driving（驾车）、transit（公交）
- 如果用户没有指定起点，默认使用当前位置或询问用户

### 意图类型3：清除/重置类
当用户要求清除地图标记时：
- "清除标记"
- "清空地图"
- "取消高亮"

清除类意图的输出格式：
[UI_ACTION]{"type": "clear_map"}

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

## 澳门主要景点坐标参考（输出时必须使用准确的经纬度）：
- 大三巴牌坊: lat=22.1973, lng=113.5409
- 威尼斯人: lat=22.1483, lng=113.5602
- 巴黎人: lat=22.1495, lng=113.5615
- 伦敦人: lat=22.1510, lng=113.5625
- 新葡京酒店: lat=22.1896, lng=113.5447
- 渔人码头: lat=22.1920, lng=113.5550
- 澳门塔: lat=22.1808, lng=113.5365
- 官也街: lat=22.1530, lng=113.5560
- 议事亭前地: lat=22.1941, lng=113.5445
- 妈阁庙: lat=22.1860, lng=113.5310
- 永利皇宫: lat=22.1460, lng=113.5630
- 银河度假城: lat=22.1500, lng=113.5550
'''

# MCP 工具配置
TOOLS = [{
    "mcpServers": {
        "amap-maps": {
            "args": ["-y", "@amap/amap-maps-mcp-server"],
            "command": "npx",
            "env": {
                "AMAP_MAPS_API_KEY": "682c2efcedf995d5b274ad9b998c71a9"
            }
        }
    }
}]

# 存储会话历史
session_store = {}


def create_agent() -> Assistant:
    """创建Agent实例"""
    bot = Assistant(
        llm=LLM_CONFIG,
        name='澳门出行助手',
        description='澳门旅游推荐和信息查询小帮手',
        system_message=SYSTEM_MESSAGE,
        function_list=TOOLS,
    )
    return bot


# ============ FastAPI 应用 ============
app = FastAPI(title="Agent对话服务")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentStreamHandler:
    """处理Agent流式输出，解析标记并生成事件"""
    
    def __init__(self):
        # 标记定义
        self.TOOL_CALL_S = '[TOOL_CALL]'
        self.TOOL_RESULT_S = '[TOOL_RESPONSE]'
        self.THOUGHT_S = '[THINK]'
        self.ANSWER_S = '[ANSWER]'
        self.UI_ACTION_S = '[UI_ACTION]'
        
        self.buffer = ""
        self.current_section = None  # 'think', 'tool_call', 'tool_response', 'answer', 'ui_action'
        self.section_buffer = ""
        self.ui_action_buffer = ""  # 专门用于缓冲UI动作的JSON
        self.ui_action_brace_count = 0  # 花括号计数
        self.in_ui_action_json = False  # 是否正在读取UI动作的JSON
    
    def process_chunk(self, chunk_text: str) -> list:
        """
        处理文本块，解析标记并返回事件列表
        返回: [(event_type, content), ...]
        """
        self.buffer += chunk_text
        events = []
        
        while self.buffer:
            # 如果正在读取UI动作的JSON，特殊处理
            if self.in_ui_action_json:
                char = self.buffer[0]
                self.buffer = self.buffer[1:]
                self.ui_action_buffer += char
                
                if char == '{':
                    self.ui_action_brace_count += 1
                elif char == '}':
                    self.ui_action_brace_count -= 1
                    
                    # JSON 完成
                    if self.ui_action_brace_count == 0:
                        try:
                            action_data = json.loads(self.ui_action_buffer)
                            events.append(('ui_action', action_data))
                        except json.JSONDecodeError:
                            # JSON解析失败，作为普通文本处理
                            pass
                        self.ui_action_buffer = ""
                        self.in_ui_action_json = False
                        self.current_section = None
                continue
            
            # 检测标记
            if self.buffer.startswith(self.THOUGHT_S):
                # 开始思考部分
                if self.section_buffer and self.current_section:
                    events.append((self.current_section, self.section_buffer))
                    self.section_buffer = ""
                self.current_section = 'think'
                self.buffer = self.buffer[len(self.THOUGHT_S):]
                continue
                
            elif self.buffer.startswith(self.TOOL_CALL_S):
                if self.section_buffer and self.current_section:
                    events.append((self.current_section, self.section_buffer))
                    self.section_buffer = ""
                self.current_section = 'tool_call'
                self.buffer = self.buffer[len(self.TOOL_CALL_S):]
                continue
                
            elif self.buffer.startswith(self.TOOL_RESULT_S):
                if self.section_buffer and self.current_section:
                    events.append((self.current_section, self.section_buffer))
                    self.section_buffer = ""
                self.current_section = 'tool_response'
                self.buffer = self.buffer[len(self.TOOL_RESULT_S):]
                continue
                
            elif self.buffer.startswith(self.ANSWER_S):
                if self.section_buffer and self.current_section:
                    events.append((self.current_section, self.section_buffer))
                    self.section_buffer = ""
                self.current_section = 'answer'
                self.buffer = self.buffer[len(self.ANSWER_S):]
                continue
            
            elif self.buffer.startswith(self.UI_ACTION_S):
                # 检测到UI动作标记，先完成当前section
                if self.section_buffer and self.current_section:
                    events.append((self.current_section, self.section_buffer))
                    self.section_buffer = ""
                
                # 开始收集UI动作的JSON
                self.buffer = self.buffer[len(self.UI_ACTION_S):]
                
                # 跳过可能存在的换行符和空格，找到 JSON 的开始
                while self.buffer and self.buffer[0] in ' \t\n\r':
                    self.buffer = self.buffer[1:]
                
                # 检查是否以 { 开始
                if self.buffer.startswith('{'):
                    self.in_ui_action_json = True
                    self.ui_action_brace_count = 0
                    self.ui_action_buffer = ""
                else:
                    # 不是JSON格式，作为普通文本处理
                    self.current_section = 'answer'
                continue
            
            # 普通字符，添加到当前section
            if self.buffer:
                char = self.buffer[0]
                self.buffer = self.buffer[1:]
                self.section_buffer += char
        
        return events
    
    def finalize(self) -> list:
        """完成处理，返回剩余内容"""
        events = []
        
        # 如果有未完成的UI动作JSON，尝试解析
        if self.in_ui_action_json and self.ui_action_buffer:
            try:
                action_data = json.loads(self.ui_action_buffer)
                events.append(('ui_action', action_data))
            except:
                pass
        
        if self.section_buffer and self.current_section:
            events.append((self.current_section, self.section_buffer))
        return events


def extract_ui_actions(text: str) -> tuple:
    """
    从文本中提取UI动作标记
    返回: (clean_text, ui_actions_list)
    """
    ui_actions = []
    result_text = text
    
    # 使用更健壮的匹配方式 - 匹配 [UI_ACTION] 后的完整 JSON 对象
    # 通过计数花括号来找到完整的 JSON
    pattern = r'\[UI_ACTION\]'
    
    while True:
        match = re.search(pattern, result_text, re.DOTALL)
        if not match:
            break
        
        start_pos = match.end()
        remaining = result_text[start_pos:]
        
        # 跳过空白字符
        remaining = remaining.lstrip()
        
        # 从 [UI_ACTION] 后开始找完整的 JSON 对象
        if remaining.startswith('{'):
            # 找到完整的 JSON 对象
            brace_count = 0
            json_end = 0
            
            for i, char in enumerate(remaining):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        json_end = i + 1
                        break
            
            if json_end > 0:
                json_str = remaining[:json_end]
                try:
                    action_data = json.loads(json_str)
                    ui_actions.append(action_data)
                    # 移除这个UI动作标记和JSON
                    before = result_text[:match.start()]
                    after = result_text[start_pos + json_end:]
                    result_text = before + after
                    continue  # 继续查找下一个
                except json.JSONDecodeError as e:
                    print(f"[extract_ui_actions] JSON parse error: {e}, json_str: {json_str[:100]}")
        
        # 如果无法解析，只移除标记并继续
        result_text = result_text[:match.start()] + result_text[start_pos:]
    
    return result_text.strip(), ui_actions


def is_follow_up_question(user_message: str, last_spots: list) -> bool:
    """
    判断用户是否在追问当前推荐地点的信息
    例如：问票价、营业时间、交通方式等
    """
    if not last_spots or len(last_spots) == 0:
        return False
    
    user_lower = user_message.lower()
    
    # 追问类关键词（不涉及地点切换）
    follow_up_keywords = [
        '多少钱', '价格', '票价', '费用', '收费', '免费',
        '营业', '开放', '时间', '几点', '多久', '什么时候',
        '怎么去', '怎么去那里', '交通', '公交', '地铁', '打车',
        '附近', '周边', '旁边', '附近有什么',
        '怎么样', '好玩吗', '值得', '推荐吗', '评价',
        '有什么', '有什么玩的', '吃什么', '美食',
        '历史', '介绍', '背景', '故事', '由来',
        '拍照', '打卡', '攻略', '注意', '需要', '要带',
        '为什么', '是什么', '怎么', '多少',
    ]
    
    # 地点切换类关键词（需要新的推荐）
    switch_keywords = [
        '还有', '其他', '别的', '另外', '再', '换', '除了',
        '推荐', '想去', '打算去', '准备去', '计划去',
        '哪里', '哪些地方', '有什么地方', '去哪',
    ]
    
    # 如果包含地点切换关键词，不是追问
    if any(kw in user_lower for kw in switch_keywords):
        return False
    
    # 如果包含追问关键词，可能是追问
    if any(kw in user_lower for kw in follow_up_keywords):
        return True
    
    # 短句可能是追问（如"多少钱"、"好玩吗"）
    if len(user_message) <= 10:
        return True
    
    return False


def enhance_with_local_data(user_message: str, response_text: str, session: dict = None) -> str:
    """
    根据用户消息和AI回复，使用本地景点数据增强UI动作
    如果AI没有输出UI_ACTION，但用户意图明确，则自动添加
    
    【修复】检测用户是否在追问当前地点信息，如果是则不添加新的UI动作
    """
    user_lower = user_message.lower()
    
    # 检查是否已经有UI_ACTION
    if '[UI_ACTION]' in response_text:
        return response_text
    
    # 获取上一次推荐的景点
    last_spots = session.get('last_recommended_spots', []) if session else []
    
    # 【修复】检测是否是追问当前地点信息
    if last_spots and is_follow_up_question(user_message, last_spots):
        print(f"[enhance_with_local_data] Detected follow-up question, skipping UI_ACTION")
        return response_text
    
    # 推荐意图检测
    recommendation_keywords = ['推荐', '好玩', '景点', '美食', '好吃', '哪里', '有什么', '介绍']
    is_recommendation = any(kw in user_lower for kw in recommendation_keywords)
    
    if is_recommendation:
        # 搜索相关景点
        attractions = []
        for keyword in ['大三巴', '威尼斯', '巴黎', '伦敦', '官也', '塔', '议事亭', '妈阁', '永利', '银河', '葡京']:
            if keyword in user_lower:
                results = search_attractions(keyword)
                attractions.extend(results)
        
        # 如果没有特定关键词，返回热门景点
        if not attractions:
            attractions = MACAU_ATTRACTIONS[:5]  # 前5个热门景点
        
        # 去重
        seen = set()
        unique_attractions = []
        for a in attractions:
            if a['name'] not in seen:
                seen.add(a['name'])
                unique_attractions.append(a)
        
        if unique_attractions:
            spots = format_attractions_for_highlight(unique_attractions[:5])
            ui_action = {
                "type": "highlight_spots",
                "spots": [{"name": s["name"], "lat": s["lat"], "lng": s["lng"], "description": s["description"]} for s in spots]
            }
            # 保存本次推荐的景点到会话
            if session is not None:
                session['last_recommended_spots'] = ui_action["spots"]
            response_text += f"\n[UI_ACTION]{json.dumps(ui_action, ensure_ascii=False)}"
    
    # 导航意图检测
    navigation_keywords = ['怎么去', '怎么走', '路线', '导航', '从', '到']
    is_navigation = any(kw in user_lower for kw in navigation_keywords)
    
    if is_navigation and ('从' in user_message or '到' in user_message):
        # 尝试提取起点和终点
        # 简单的规则：提取消息中的地点名称
        found_locations = []
        for attraction in MACAU_ATTRACTIONS:
            if attraction['name'] in user_message or attraction['name'][:-2] in user_message:
                found_locations.append(attraction)
        
        if len(found_locations) >= 2:
            from_loc = found_locations[0]
            to_loc = found_locations[1]
            ui_action = {
                "type": "show_route",
                "from": {"name": from_loc["name"], "lat": from_loc["lat"], "lng": from_loc["lng"]},
                "to": {"name": to_loc["name"], "lat": to_loc["lat"], "lng": to_loc["lng"]},
                "mode": "transit"
            }
            response_text += f"\n[UI_ACTION]{json.dumps(ui_action, ensure_ascii=False)}"
    
    return response_text


async def stream_agent_response(session_id: str, user_message: str) -> AsyncGenerator[str, None]:
    """
    流式返回Agent响应
    事件格式: data: {"type": "think|tool_call|tool_response|answer|ui_action|done", "content": "..."}\n\n
    """
    print(f"[Agent] Received message: {user_message}")
    
    # 获取或创建会话
    if session_id not in session_store:
        session_store[session_id] = {
            'agent': create_agent(),
            'messages': [],
            'last_recommended_spots': []
        }
    
    session = session_store[session_id]
    agent = session['agent']
    messages = session['messages']
    
    # 添加用户消息
    messages.append({'role': 'user', 'content': user_message})
    
    handler = AgentStreamHandler()
    accumulated_text = ""
    pending_ui_actions = []
    
    # 发送开始标记
    yield f"data: {json.dumps({'type': 'start'}, ensure_ascii=False)}\n\n"
    
    try:
        # 运行Agent
        for response in agent.run(messages):
            # 从response构建文本
            new_text = build_response_text(response, accumulated_text)
            delta = new_text[len(accumulated_text):]
            accumulated_text = new_text
            
            if delta:
                print(f"[Agent] Delta: {delta[:100]}...")
                # 处理增量文本
                events = handler.process_chunk(delta)
                for event_type, content in events:
                    print(f"[Agent] Event: {event_type}, content: {str(content)[:100]}...")
                    if event_type == 'ui_action':
                        # content 已经是解析后的 dict
                        if isinstance(content, dict):
                            print(f"[Agent] Sending ui_action: {content}")
                            yield f"data: {json.dumps({'type': 'ui_action', 'content': content}, ensure_ascii=False)}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': event_type, 'content': content}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.01)  # 小延迟以实现打字机效果
        
        # 处理剩余内容
        print(f"[Agent] Finalizing, accumulated_text length: {len(accumulated_text)}")
        final_events = handler.finalize()
        print(f"[Agent] Final events count: {len(final_events)}")
        for event_type, content in final_events:
            print(f"[Agent] Final event: {event_type}")
            if event_type == 'ui_action':
                # content 已经是解析后的 dict
                if isinstance(content, dict):
                    print(f"[Agent] Sending final ui_action: {content}")
                    yield f"data: {json.dumps({'type': 'ui_action', 'content': content}, ensure_ascii=False)}\n\n"
            else:
                yield f"data: {json.dumps({'type': event_type, 'content': content}, ensure_ascii=False)}\n\n"
        
        # 从 accumulated_text 中提取所有 UI 动作（后备方案）
        print(f"[Agent] Extracting UI actions from accumulated_text")
        clean_text, ui_actions_from_text = extract_ui_actions(accumulated_text)
        print(f"[Agent] Found {len(ui_actions_from_text)} UI actions from accumulated_text")
        for action in ui_actions_from_text:
            print(f"[Agent] Sending extracted ui_action: {action}")
            yield f"data: {json.dumps({'type': 'ui_action', 'content': action}, ensure_ascii=False)}\n\n"
        
        # 使用本地数据增强（如果AI没有输出UI_ACTION）
        print(f"[Agent] Checking for local data enhancement")
        enhanced_text = enhance_with_local_data(user_message, accumulated_text, session)
        print(f"[Agent] Enhanced text length: {len(enhanced_text)}, original: {len(accumulated_text)}")
        
        # 检查增强后是否有新的UI动作
        if enhanced_text != accumulated_text:
            print(f"[Agent] Extracting UI actions from enhanced text")
            clean_text, ui_actions = extract_ui_actions(enhanced_text)
            print(f"[Agent] Found {len(ui_actions)} UI actions from enhanced text")
            for action in ui_actions:
                print(f"[Agent] Sending enhanced ui_action: {action}")
                yield f"data: {json.dumps({'type': 'ui_action', 'content': action}, ensure_ascii=False)}\n\n"
        
        # 保存助手回复到历史（保存原始文本）
        messages.append({'role': 'assistant', 'content': accumulated_text})
        
        # 发送完成标记
        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"


def build_response_text(messages: list, prev_text: str) -> str:
    """
    构建响应文本 (与typewriter_print相同逻辑)
    """
    from qwen_agent.llm.schema import ASSISTANT, FUNCTION
    
    THOUGHT_S = '[THINK]'
    ANSWER_S = '[ANSWER]'
    TOOL_CALL_S = '[TOOL_CALL]'
    TOOL_RESULT_S = '[TOOL_RESPONSE]'
    
    full_text = ''
    content = []
    
    for msg in messages:
        if msg['role'] == ASSISTANT:
            if msg.get('reasoning_content'):
                content.append(f'{THOUGHT_S}\n{msg["reasoning_content"]}')
            if msg.get('content'):
                content.append(f'{ANSWER_S}\n{msg["content"]}')
            if msg.get('function_call'):
                content.append(f'{TOOL_CALL_S} {msg["function_call"]["name"]}\n{msg["function_call"]["arguments"]}')
        elif msg['role'] == FUNCTION:
            content.append(f'{TOOL_RESULT_S} {msg["name"]}\n{msg["content"]}')
    
    if content:
        full_text = '\n'.join(content)
    
    return full_text


# ============ API 路由 ============

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    """SSE流式对话接口"""
    data = await request.json()
    session_id = data.get('session_id', 'default')
    message = data.get('message', '')
    
    if not message:
        return StreamingResponse(
            iter([f"data: {json.dumps({'type': 'error', 'content': '消息不能为空'}, ensure_ascii=False)}\n\n"]),
            media_type="text/event-stream"
        )
    
    return StreamingResponse(
        stream_agent_response(session_id, message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/clear")
async def clear_session(request: Request):
    """清空会话历史"""
    data = await request.json()
    session_id = data.get('session_id', 'default')
    
    if session_id in session_store:
        session_store[session_id]['messages'] = []
        session_store[session_id]['last_recommended_spots'] = []
    
    return {"status": "success", "message": "会话已清空"}


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "ok"}


@app.get("/api/attractions")
async def get_attractions(keyword: str = None, category: str = None, area: str = None):
    """获取澳门景点列表"""
    results = MACAU_ATTRACTIONS
    
    if keyword:
        results = search_attractions(keyword)
    elif category:
        from macau_attractions import get_attractions_by_category
        results = get_attractions_by_category(category)
    elif area:
        from macau_attractions import get_attractions_by_area
        results = get_attractions_by_area(area)
    
    return {
        "status": "success",
        "count": len(results),
        "data": results
    }


# ============ 静态文件 ============
# 挂载静态文件
app.mount("/map", StaticFiles(directory="minimacau3d", html=True), name="map")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    """主页面 - 返回整合的index.html"""
    return FileResponse("index.html")


# ============ 启动 ============
if __name__ == "__main__":
    print("=" * 50)
    print("启动Agent对话服务器...")
    print("主界面: http://localhost:8000")
    print("地图界面: http://localhost:8000/map")
    print("API文档: http://localhost:8000/docs")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)

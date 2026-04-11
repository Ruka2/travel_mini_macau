#!/usr/bin/env python3
"""
Agent对话API服务器
提供SSE流式输出接口供前端调用
"""

import os
import sys
import json
import asyncio
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

# ============ Agent 配置 ============
SYSTEM_MESSAGE = '''你是一个专业的导游，可以帮助用户解决出行、景点推荐等娱乐旅游信息。
你可以帮用户：
1. 查询地址信息
2. 推荐合适的出行方式
3. 推荐有什么好玩的景点
4. 查询附近的餐厅
备注：
1. 请你每次回复内容普遍较短(约1~30字多)
  1.1 简单问题简单回答，复杂问题可以适当增加字数，但不要过于冗长，保持简洁明了
2. 口吻可以随意一些，符合口头回答
  2.1 例如，尽量选择简单的口吻，避免过于正式或书面化的表达
  2.2 禁止使用复杂的符号，仅保留逗号、句号等基本标点符号
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
        name='出行助手',
        description='出行推荐和信息查询小帮手',
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
        # 标记定义 (与 output_beautify.py 保持一致)
        self.TOOL_CALL_S = '[TOOL_CALL]'
        self.TOOL_RESULT_S = '[TOOL_RESPONSE]'
        self.THOUGHT_S = '[THINK]'
        self.ANSWER_S = '[ANSWER]'
        
        self.buffer = ""
        self.current_section = None  # 'think', 'tool_call', 'tool_response', 'answer'
        self.section_buffer = ""
    
    def process_chunk(self, chunk_text: str) -> list:
        """
        处理文本块，解析标记并返回事件列表
        返回: [(event_type, content), ...]
        """
        self.buffer += chunk_text
        events = []
        
        while self.buffer:
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
            
            # 普通字符，添加到当前section
            if self.buffer:
                char = self.buffer[0]
                self.buffer = self.buffer[1:]
                self.section_buffer += char
        
        return events
    
    def finalize(self) -> list:
        """完成处理，返回剩余内容"""
        events = []
        if self.section_buffer and self.current_section:
            events.append((self.current_section, self.section_buffer))
        return events


async def stream_agent_response(session_id: str, user_message: str) -> AsyncGenerator[str, None]:
    """
    流式返回Agent响应
    事件格式: data: {"type": "think|tool_call|tool_response|answer|done", "content": "..."}\n\n
    """
    # 获取或创建会话
    if session_id not in session_store:
        session_store[session_id] = {
            'agent': create_agent(),
            'messages': []
        }
    
    session = session_store[session_id]
    agent = session['agent']
    messages = session['messages']
    
    # 添加用户消息
    messages.append({'role': 'user', 'content': user_message})
    
    handler = AgentStreamHandler()
    accumulated_text = ""
    
    # 发送开始标记
    yield f"data: {json.dumps({'type': 'start'}, ensure_ascii=False)}\n\n"
    
    try:
        # 运行Agent
        for response in agent.run(messages):
            # 从response构建文本 (与typewriter_print类似逻辑)
            new_text = build_response_text(response, accumulated_text)
            delta = new_text[len(accumulated_text):]
            accumulated_text = new_text
            
            if delta:
                # 处理增量文本
                events = handler.process_chunk(delta)
                for event_type, content in events:
                    yield f"data: {json.dumps({'type': event_type, 'content': content}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.01)  # 小延迟以实现打字机效果
        
        # 处理剩余内容
        final_events = handler.finalize()
        for event_type, content in final_events:
            yield f"data: {json.dumps({'type': event_type, 'content': content}, ensure_ascii=False)}\n\n"
        
        # 保存助手回复到历史
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
    
    return {"status": "success", "message": "会话已清空"}


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "ok"}


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

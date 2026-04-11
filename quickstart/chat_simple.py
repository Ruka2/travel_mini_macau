#!/usr/bin/env python3
"""
最简单的 Qwen-Agent 一问一答示例
使用配置文件中的 LLM 配置
"""
import os
import sys
# 添加项目根目录到 Python 路径
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from qwen_agent.agents import Assistant
from qwen_agent.utils.output_beautify import typewriter_print

# 从配置文件导入 LLM 配置
from config import LLM_CONFIG


def create_agent():
    """创建并返回一个简单的问答 Agent"""
    # 使用配置文件中的 LLM 配置创建 Agent
    agent = Assistant(
        llm=LLM_CONFIG,
        system_message="你是一个有帮助的AI助手，请用中文回答用户的问题。",
        name="简单问答助手",
        description="我是一个简单的问答助手，可以回答你的各种问题。"
    )
    return agent


def chat_once(query: str):
    """
    单次问答模式：问一个问题，获取回答
    
    Args:
        query: 用户的问题
    
    Returns:
        完整的回答文本
    """
    agent = create_agent()
    
    # 构建消息
    messages = [{'role': 'user', 'content': query}]
    
    # 获取回答（流式输出）
    print(f"\n👤 用户: {query}\n")
    print("🤖 AI助手: ", end="", flush=True)
    
    response_text = ""
    for response in agent.run(messages=messages):
        # print(response)
        # 使用 typewriter_print 打印流式输出
        response_text = typewriter_print(response, response_text)
    
    # print("\n")  # 换行
    return response_text


def interactive_chat():
    """
    交互式对话模式：持续对话，直到用户输入 exit
    """
    agent = create_agent()
    messages = []
    
    print("=" * 50)
    print("🤖 Qwen-Agent 简单问答示例")
    print("=" * 50)
    print("提示：输入 'exit' 或 'quit' 退出对话\n")
    
    while True:
        # 获取用户输入
        user_input = input("👤 你: ").strip()
        
        # 检查退出命令
        if user_input.lower() in ['exit', 'quit', '退出', 'bye']:
            print("\n🤖 AI助手: 再见！祝你有美好的一天！")
            break
        
        if not user_input:
            continue
        
        # 添加用户消息
        messages.append({'role': 'user', 'content': user_input})
        
        # 获取 AI 回复
        print("\n🤖 AI助手: ", end="", flush=True)
        response_text = ""
        for response in agent.run(messages=messages):
            response_text = typewriter_print(response, response_text)
        
        print("\n")
        
        # 将 AI 回复添加到消息历史中
        messages.append({'role': 'assistant', 'content': response_text})


if __name__ == '__main__':
    # 示例1：单次问答
    chat_once("你好")
    
    # 示例2：交互式对话
    # interactive_chat()

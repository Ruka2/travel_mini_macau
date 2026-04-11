#!/usr/bin/env python3

from config import LLM_CONFIG
from qwen_agent.agents import Assistant
from qwen_agent.utils.output_beautify import typewriter_print


def create_agent():
    agent = Assistant(
        llm=LLM_CONFIG,
        system_message="你是一个有帮助的AI助手，请用中文回答用户的问题。",
        name="简单问答助手",
        description="我是一个简单的问答助手，可以回答你的各种问题。"
    )
    return agent



def interactive_chat():
    agent = create_agent()
    messages = []
    while True:
        user_input = input("👤 用户: ").strip()
        
        if user_input.lower() in ['e', 'q', '退出', 'bye']:
            print("\n🤖 AI助手: 再见！祝你有美好的一天！")
            break
        if not user_input:
            continue
        
        messages.append({'role': 'user', 'content': user_input})
        
        print("\n🤖 AI助手: ", end="", flush=True)
        response_text = ""
        for response in agent.run(messages=messages):
            response_text = typewriter_print(response, response_text)
        
        messages.append({'role': 'assistant', 'content': response_text})


if __name__ == '__main__':
    
    interactive_chat()

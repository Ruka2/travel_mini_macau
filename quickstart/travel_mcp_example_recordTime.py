import os
import sys
import time

# 添加父目录到 Python 路径，以便导入 config.py
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from config import LLM_CONFIG
from qwen_agent.agents import Assistant
from qwen_agent.utils.output_beautify import typewriter_print


def init_travel_agent():
    system_message = '''你是一个专业的导游，可以帮助用户解决出行、景点推荐等娱乐旅游信息。
你可以帮用户：
1. 查询地址信息
2. 推荐合适的出行方式
3. 推荐有什么好玩的景点
4. 查询附近的餐厅
备注：
1. 请你每次回复内容都限制在较短字数左右，例如简单问题简单回答，复杂问题可以适当增加字数，但不要过于冗长，保持简洁明了
2. 口吻可以随意一些，适合口头回答
'''
    
    # MCP 工具配置
    tools = [{
    "mcpServers": {
        "amap-maps": {
        "args": [
            "-y",
            "@amap/amap-maps-mcp-server"
        ],
        "command": "npx",
        "env": {
            "AMAP_MAPS_API_KEY": "682c2efcedf995d5b274ad9b998c71a9"
        }
        }
    }
    }]
    
    bot = Assistant(
        llm=LLM_CONFIG,
        name='出行助手',
        description='出行推荐和信息查询小帮手',
        system_message=system_message,
        function_list=tools,
    )
    
    return bot



def interactive_chat():
    bot = init_travel_agent()
    messages = []
    
    while True:
        query = input("\n📝 你的问题: ").strip()
        
        if not query:
            print("⚠️ 请输入有效的问题")
            continue
        if query.lower() in ["q", "e"]:
            exit("👋 再见！")
        
        messages.append({'role': 'user', 'content': query})
        
        # 记录开始时间
        start_time = time.time()
        
        response_text = ""
        for response in bot.run(messages):
            response_text = typewriter_print(response, response_text)
        
        # 记录结束时间并计算推理耗时
        end_time = time.time()
        inference_time = end_time - start_time
        print(f"\n⏱️ 模型推理耗时: {inference_time:.3f} 秒")

        messages.append({'role': 'assistant', 'content': response_text})


if __name__ == '__main__':
    interactive_chat()

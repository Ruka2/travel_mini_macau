"""
12306 MCP 工具快速示例

这个示例展示了如何使用 12306-mcp 来查询火车票信息。

前提条件:
1. 安装 Node.js 环境
2. 确保可以运行 npx 命令

12306-mcp 功能:
- 查询火车票信息
- 筛选列车信息
- 过站查询
- 中转查询
"""

import os
import sys

# 添加父目录到 Python 路径，以便导入 config.py
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from config import LLM_CONFIG
from qwen_agent.agents import Assistant
from qwen_agent.utils.output_beautify import typewriter_print


def init_12306_agent():
    """初始化 12306 火车票查询助手"""
    
    llm_cfg = {'model': 'qwen-max'}  # 或其他可用的模型
    
    system_message = '''你是一个专业的火车票查询助手，可以帮助用户查询 12306 火车票信息。
你可以帮用户：
1. 查询指定日期和路线的火车票
2. 筛选特定车次类型（高铁/动车/普快等）
3. 查询中转方案
4. 查询过站信息

查询时请确保：
- 日期格式为 YYYY-MM-DD
- 车站名称使用标准名称（如：北京南、上海虹桥等）
'''
    
    # MCP 工具配置
    tools = [{
        "mcpServers": {
            "12306-mcp": {
                "command": "npx",
                "args": [
                    "-y",
                    "12306-mcp"
                ]
            }
        }
    }]
    
    bot = Assistant(
        llm=LLM_CONFIG,
        name='火车票查询助手',
        description='12306 火车票查询服务',
        system_message=system_message,
        function_list=tools,
    )
    
    return bot


def test_query():
    """测试查询示例"""
    bot = init_12306_agent()
    
    # 示例查询
    queries = [
        "帮我查一下明天从北京到上海的高铁票",
        "查询 2024-12-25 从广州南到深圳北的所有车次",
        "帮我看看从上海到杭州有哪些动车",
    ]
    
    messages = []
    
    for query in queries:
        print(f"\n{'='*50}")
        print(f"用户提问: {query}")
        print(f"{'='*50}")
        
        messages.append({'role': 'user', 'content': query})
        
        responses = []
        for response in bot.run(messages):
            print(f"助手回复: {response}")
            responses.append(response)
        
        messages.extend(responses)


def interactive_chat():
    """交互式聊天模式"""
    bot = init_12306_agent()
    messages = []
    
    print("🚄 12306 火车票查询助手")
    print("=" * 50)
    print("提示：可以问我关于火车票的问题，例如：")
    print("  - 查一下明天从北京到上海的高铁")
    print("  - 2024-12-25 从广州到深圳有哪些车次")
    print("  - 输入 'exit' 退出")
    print("=" * 50)
    
    while True:
        query = input("\n📝 你的问题: ").strip()
        
        if query.lower() in ['exit', 'quit', '退出', '再见']:
            print("👋 再见！")
            break
        
        if not query:
            print("⚠️ 请输入有效的问题")
            continue
        
        messages.append({'role': 'user', 'content': query})
        
        print("🤔 正在查询...")
        responses = []
        response_text = ""
        for response in bot.run(messages):
            # print(f"💬 回复: {response}")
            responses.append(response)
            response_text = typewriter_print(response, response_text)
        
        # messages.extend(response_text)
        messages.append({'role': 'assistant', 'content': response_text})


if __name__ == '__main__':
    # 选择运行模式
    import sys
    
    # if len(sys.argv) > 1 and sys.argv[1] == '--test':
    #     # 测试模式
    #     test_query()
    # else:
        # 交互模式（默认）
    interactive_chat()

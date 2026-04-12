#!/usr/bin/env python3
"""
全双工语音对话系统 (VAD-ASR-LLM-TTS)

主框架文件，只负责：
1. Agent 初始化与对话管理
2. 语音交互流程编排（VAD → ASR → LLM → TTS）

各模块实现详见 /modules/ 目录
"""

import os
import re
import sys
import time

# 添加项目根目录到 Python 路径
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from config import LLM_CONFIG, VAD_CONFIG
from qwen_agent.agents import Assistant
from qwen_agent.utils.output_beautify import typewriter_print

from modules import (
    ASRClient,
    TTSClient,
    VADAudioRecorder,
    play_audio,
    calibrate_microphone,
    list_audio_devices,
)


def create_agent() -> Assistant:
    system_message = '''你是一个专业的导游，可以帮助用户解决出行、景点推荐等娱乐旅游信息。
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


def setup_voice_chat():
    """
    设置语音对话环境
    
    Returns:
        初始化完成的 VAD 阈值
    """
    # 列出音频设备
    list_audio_devices()
    vad_threshold = VAD_CONFIG['db_threshold']
    return vad_threshold


def run_voice_pipeline(agent: Assistant, recorder: VADAudioRecorder,
                       asr_client: ASRClient, tts_client: TTSClient,
                       messages: list) -> bool:
    """
    执行一次完整的语音交互流程：VAD → ASR → LLM → TTS
    
    Args:
        agent: Agent 实例
        recorder: VAD 录音器
        asr_client: ASR 客户端
        tts_client: TTS 客户端
        messages: 对话历史
    
    Returns:
        是否继续对话（False 表示用户要求退出）
    """
    # ===== VAD: 等待语音输入 =====
    audio_file = recorder.wait_for_speech()

    if not os.path.exists(audio_file) or os.path.getsize(audio_file) < 44:
        print("⚠️ 录音为空，继续监听...")
        if os.path.exists(audio_file):
            os.remove(audio_file)
        return True

    # ===== ASR: 语音识别 =====
    # print("📝 正在识别语音...")
    try:
        query = asr_client.transcribe(audio_file)
        pattern = r'[^a-zA-Z0-9\u4e00-\u9fff]'
        query = re.sub(pattern, '', query)
    except Exception as e:
        print(f"❌ 语音识别失败: {e}")
        if os.path.exists(audio_file):
            os.remove(audio_file)
        return True
    finally:
        if os.path.exists(audio_file):
            os.remove(audio_file)

    if not query.strip():
        # print("⚠️ 未识别到有效内容，继续监听...")
        return True

    # 检查退出指令
    if query.strip().lower() in ['exit', 'quit', '退出', '再见', '拜拜']:
        print("👋 再见！")
        return False

    
    print(f"🎯 用户输出: {query}")

    # ===== LLM: 对话推理 =====
    messages.append({'role': 'user', 'content': query})

    response_text = ""
    for response in agent.run(messages):
        response_text = typewriter_print(response, response_text)

    messages.append({'role': 'assistant', 'content': response_text})

    # ===== TTS: 语音合成与播放 =====
    wait_to_tts_text = re.sub(r'^\[THINK\][\s\S]*?\[ANSWER\]\s*', '', response_text)
    wait_to_tts_text = re.sub(r'^[\s\S]*\[ANSWER\]\s*', '', response_text).strip()
    wait_to_tts_text = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff，。！？,.!?\s]', '', wait_to_tts_text)
    if wait_to_tts_text.strip():
        try:
            audio_file = tts_client.synthesize(wait_to_tts_text)
            play_audio(audio_file)
            if os.path.exists(audio_file):
                os.remove(audio_file)
        except Exception as e:
            print(f"❌ 语音合成失败: {e}")

    print("\n" + "-" * 50)
    return True


def duplex_voice_chat():
    """全双工语音对话主循环"""

    # 环境设置
    vad_threshold = setup_voice_chat()

    # 初始化组件
    agent = create_agent()
    asr_client = ASRClient()
    tts_client = TTSClient()
    recorder = VADAudioRecorder(db_threshold=vad_threshold)
    messages = []

    print("\n" + "=" * 50)
    print("使用说明：")
    print("  - 直接对麦克风说话，系统会自动检测语音")
    print(f"  - 当前 VAD 阈值: {vad_threshold:.1f} dB")
    print("=" * 50)

    try:
        # 启动监听线程
        recorder.start_listening()
        time.sleep(2)  # 等待用户查看设备列表

        while True:
            should_continue = run_voice_pipeline(
                agent=agent,
                recorder=recorder,
                asr_client=asr_client,
                tts_client=tts_client,
                messages=messages
            )
            if not should_continue:
                break

    except KeyboardInterrupt:
        print("\n👋 用户中断，再见！")
    finally:
        recorder.close()


if __name__ == '__main__':
    duplex_voice_chat()

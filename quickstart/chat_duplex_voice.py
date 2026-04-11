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
    """创建对话 Agent"""
    return Assistant(
        llm=LLM_CONFIG,
        system_message="你是一个有帮助的AI助手，请用中文回答用户的问题，输出简短符合口头对话场景(10个字以内)，不要输出符号和表情。",
        name="语音对话助手",
        description="我是一个支持语音交互的AI助手。"
    )


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
        print(f"🎯 用户输出: {query}")
    except Exception as e:
        print(f"❌ 语音识别失败: {e}")
        if os.path.exists(audio_file):
            os.remove(audio_file)
        return True
    finally:
        if os.path.exists(audio_file):
            os.remove(audio_file)

    if not query.strip():
        print("⚠️ 未识别到有效内容，继续监听...")
        return True

    # 检查退出指令
    if query.strip().lower() in ['exit', 'quit', '退出', '再见', '拜拜']:
        print("👋 再见！")
        return False

    # ===== LLM: 对话推理 =====
    messages.append({'role': 'user', 'content': query})

    response_text = ""
    for response in agent.run(messages):
        response_text = typewriter_print(response, response_text)

    response_text = re.sub(r'\[ANSWER\]\s*', '', response_text).strip()
    messages.append({'role': 'assistant', 'content': response_text})

    # ===== TTS: 语音合成与播放 =====
    if response_text.strip():
        try:
            audio_file = tts_client.synthesize(response_text)
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

"""
12306 MCP 工具 - 语音版 (ASR + TTS)

功能：
1. ASR 语音识别 - 使用 SiliconFlow API 将语音转为文字
2. LLM 对话 - 调用 12306 MCP 查询火车票
3. TTS 语音合成 - 将 [ANSWER] 部分转为语音并播放

依赖安装：
    pip install pyaudio requests openai

前提条件：
1. 安装 Node.js 环境（用于 12306-mcp）
2. macOS 系统（使用 afplay 播放音频）
"""

import os
import sys
import re
import io
import tempfile
import subprocess
import threading
import queue

# 添加父目录到 Python 路径
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

import requests
import pyaudio
from config import LLM_CONFIG
from qwen_agent.agents import Assistant
from qwen_agent.utils.output_beautify import typewriter_print


# ==================== 配置 ====================
SILICONFLOW_API_KEY = "sk-cvgkozaydtyomywtkbkluftagparvunlnngsxmdrpmvojhzp"
SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"

# ASR 配置
ASR_MODEL = "FunAudioLLM/SenseVoiceSmall"  # 或 TeleAI/TeleSpeechASR

# TTS 配置
TTS_MODEL = "fnlp/MOSS-TTSD-v0.5"
TTS_VOICE = "fnlp/MOSS-TTSD-v0.5:anna"  # 可选: alex, anna, bella, benjamin, charles, claire, david, diana
TTS_FORMAT = "mp3"

# 录音配置
AUDIO_FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 1024


class ASRClient:
    """语音识别客户端"""
    
    def __init__(self, api_key: str, base_url: str = SILICONFLOW_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}"
        }
    
    def transcribe(self, audio_file_path: str, model: str = ASR_MODEL) -> str:
        """
        将音频文件转为文字
        
        Args:
            audio_file_path: 音频文件路径
            model: ASR 模型名称
        
        Returns:
            识别的文字
        """
        url = f"{self.base_url}/audio/transcriptions"
        
        with open(audio_file_path, "rb") as audio_file:
            files = {
                "file": (os.path.basename(audio_file_path), audio_file, "audio/wav")
            }
            data = {
                "model": model
            }
            
            response = requests.post(
                url,
                headers=self.headers,
                files=files,
                data=data
            )
            
            response.raise_for_status()
            result = response.json()
            return result.get("text", "")


class TTSClient:
    """语音合成客户端"""
    
    def __init__(self, api_key: str, base_url: str = SILICONFLOW_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def synthesize(self, text: str, voice: str = TTS_VOICE, output_file: str = None) -> str:
        """
        将文字转为语音
        
        Args:
            text: 要合成的文字
            voice: 声音类型
            output_file: 输出文件路径（默认创建临时文件）
        
        Returns:
            生成的音频文件路径
        """
        url = f"{self.base_url}/audio/speech"
        
        payload = {
            "model": TTS_MODEL,
            "voice": voice,
            "input": text,
            "response_format": TTS_FORMAT
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        
        # 保存音频文件
        if output_file is None:
            output_file = tempfile.mktemp(suffix=f".{TTS_FORMAT}")
        
        with open(output_file, "wb") as f:
            f.write(response.content)
        
        return output_file


class AudioRecorder:
    """音频录制器"""
    
    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.is_recording = False
        self.frames = []
        self.stream = None
    
    def start_recording(self):
        """开始录音"""
        self.is_recording = True
        self.frames = []
        
        self.stream = self.audio.open(
            format=AUDIO_FORMAT,
            channels=CHANNELS,
            rate=RATE,
            input=True,
            frames_per_buffer=CHUNK
        )
        
        print("🎙️  正在录音...（按 Enter 停止）")
        
        def record():
            while self.is_recording:
                try:
                    data = self.stream.read(CHUNK, exception_on_overflow=False)
                    self.frames.append(data)
                except Exception as e:
                    print(f"录音错误: {e}")
                    break
        
        self.record_thread = threading.Thread(target=record)
        self.record_thread.start()
    
    def stop_recording(self) -> str:
        """停止录音并保存文件"""
        self.is_recording = False
        self.record_thread.join()
        
        self.stream.stop_stream()
        self.stream.close()
        
        # 保存为 WAV 文件
        output_file = tempfile.mktemp(suffix=".wav")
        
        import wave
        with wave.open(output_file, 'wb') as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(self.audio.get_sample_size(AUDIO_FORMAT))
            wf.setframerate(RATE)
            wf.writeframes(b''.join(self.frames))
        
        return output_file
    
    def close(self):
        """关闭音频设备"""
        self.audio.terminate()


def play_audio(audio_file: str):
    """播放音频文件（macOS 使用 afplay）"""
    try:
        subprocess.run(["afplay", audio_file], check=True)
    except subprocess.CalledProcessError as e:
        print(f"播放音频失败: {e}")
    except FileNotFoundError:
        print("警告: 未找到 afplay 命令，请确保在 macOS 上运行")


def extract_answer(text: str) -> str:
    """
    从回复中提取 [ANSWER] 部分的内容
    
    Args:
        text: 完整回复文本
    
    Returns:
        [ANSWER] 部分的内容，如果没有则返回原文本
    """
    # 匹配 [ANSWER]...[/ANSWER] 或 [ANSWER]...（到结尾）
    patterns = [
        r'\[ANSWER\](.*?)\[/ANSWER\]',  # [ANSWER]...[/ANSWER]
        r'\[ANSWER\](.*)',              # [ANSWER]...（到结尾）
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    # 如果没有找到 [ANSWER] 标签，返回原文本
    return text


def init_12306_agent():
    """初始化 12306 火车票查询助手"""
    
    system_message = '''你是一个专业的火车票查询助手，可以帮助用户查询 12306 火车票信息。
你可以帮用户：
1. 查询指定日期和路线的火车票
2. 筛选特定车次类型（高铁/动车/普快等）
3. 查询中转方案
4. 查询过站信息

查询时请确保：
- 日期格式为 YYYY-MM-DD
- 车站名称使用标准名称（如：北京南、上海虹桥等）

回复格式：
- 使用 [ANSWER] 标签包裹最终回答，例如：[ANSWER]从北京到上海有 G1、G3 等车次[/ANSWER]
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


def interactive_voice_chat():
    """交互式语音聊天模式"""
    
    # 初始化组件
    bot = init_12306_agent()
    asr_client = ASRClient(SILICONFLOW_API_KEY)
    # tts_client = TTSClient(SILICONFLOW_API_KEY)
    recorder = AudioRecorder()
    messages = []
    
    print("🚄 12306 火车票查询助手 - 语音版")
    print("=" * 50)
    print("输入模式：")
    print("  [1] 文字输入")
    print("  [2] 语音输入（录音后自动识别）")
    print("其他命令：")
    print("  - 输入 'exit' 退出")
    print("=" * 50)
    
    try:
        while True:
            # 选择输入模式
            mode = input("\n选择输入模式 [1]文字 [2]语音: ").strip()
            
            if mode.lower() in ['exit', 'quit', '退出', '再见']:
                print("👋 再见！")
                break
            
            query = ""
            
            if mode == "2":
                # 语音输入模式
                input("🎙️  准备好后按 Enter 开始录音...")
                
                # 开始录音
                recorder.start_recording()
                input()  # 等待用户按 Enter 停止
                audio_file = recorder.stop_recording()
                
                print("📝 正在识别语音...")
                try:
                    query = asr_client.transcribe(audio_file)
                    print(f"🎯 识别结果: {query}")
                except Exception as e:
                    print(f"❌ 语音识别失败: {e}")
                    continue
                finally:
                    # 清理临时文件
                    if os.path.exists(audio_file):
                        os.remove(audio_file)
            
            elif mode == "1":
                # 文字输入模式
                query = input("📝 你的问题: ").strip()
            
            else:
                print("⚠️ 无效的选择，请按 1 或 2")
                continue
            
            if not query:
                print("⚠️ 请输入有效的问题")
                continue
            
            if query.lower() in ['exit', 'quit', '退出', '再见']:
                print("👋 再见！")
                break
            
            # 发送到 LLM
            messages.append({'role': 'user', 'content': query})
            
            print("🤔 正在查询...")
            response_text = ""
            
            for response in bot.run(messages):
                response_text = typewriter_print(response, response_text)
            
            messages.append({'role': 'assistant', 'content': response_text})
            
            # 提取 [ANSWER] 部分并语音播放
            answer_text = extract_answer(response_text)
            
            if answer_text:
                print("\n🔊 正在播放语音回答...")
                try:
                    # fixme: 暂时取消使用TTS，费用问题
                    # audio_file = tts_client.synthesize(answer_text)
                    # play_audio(audio_file)
                    # 清理临时文件
                    if os.path.exists(audio_file):
                        os.remove(audio_file)
                except Exception as e:
                    print(f"❌ 语音合成失败: {e}")
    
    finally:
        recorder.close()


if __name__ == '__main__':
    interactive_voice_chat()

#!/usr/bin/env python3
"""
TTS 语音合成模块

使用 SiliconFlow API 将文字转为语音，并支持音频播放
"""

import os
import tempfile
import subprocess

import requests

from config import TTS_CONFIG


class TTSClient:
    """语音合成客户端"""

    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        """
        初始化 TTS 客户端
        
        Args:
            api_key: API 密钥，默认从 TTS_CONFIG 读取
            base_url: API 基础地址，默认从 TTS_CONFIG 读取
            model: TTS 模型名称，默认从 TTS_CONFIG 读取
        """
        self.api_key = api_key or TTS_CONFIG['api_key']
        self.base_url = base_url or TTS_CONFIG['base_url']
        self.model = model or TTS_CONFIG['model']
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def synthesize(self, text: str, voice: str = None, output_file: str = None) -> str:
        """
        将文字转为语音
        
        Args:
            text: 要合成的文字
            voice: 声音类型，默认从 TTS_CONFIG 读取
            output_file: 输出文件路径（默认创建临时文件）
        
        Returns:
            生成的音频文件路径
        """
        from config import TTS_CONFIG

        voice = voice or TTS_CONFIG.get('voice')
        response_format = TTS_CONFIG.get('response_format', 'mp3')

        url = f"{self.base_url}/audio/speech"

        payload = {
            "model": self.model,
            "voice": voice,
            "input": text,
            "response_format": response_format
        }

        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()

        if output_file is None:
            output_file = tempfile.mktemp(suffix=f".{response_format}")

        with open(output_file, "wb") as f:
            f.write(response.content)

        return output_file


def play_audio(audio_file: str):
    """
    播放音频文件（macOS 使用 afplay）
    
    Args:
        audio_file: 音频文件路径
    """
    try:
        subprocess.run(["afplay", audio_file], check=True)
    except subprocess.CalledProcessError as e:
        print(f"播放音频失败: {e}")
    except FileNotFoundError:
        print("警告: 未找到 afplay 命令，请确保在 macOS 上运行")

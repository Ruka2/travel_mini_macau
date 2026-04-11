#!/usr/bin/env python3
"""
ASR 语音识别模块

使用 SiliconFlow API 将语音转为文字
"""

import os
import requests

from config import ASR_CONFIG


class ASRClient:
    """语音识别客户端"""

    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        """
        初始化 ASR 客户端
        
        Args:
            api_key: API 密钥，默认从 ASR_CONFIG 读取
            base_url: API 基础地址，默认从 ASR_CONFIG 读取
            model: ASR 模型名称，默认从 ASR_CONFIG 读取
        """
        self.api_key = api_key or ASR_CONFIG['api_key']
        self.base_url = base_url or ASR_CONFIG['base_url']
        self.model = model or ASR_CONFIG['model']
        self.headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

    def transcribe(self, audio_file_path: str) -> str:
        """
        将音频文件转为文字
        
        Args:
            audio_file_path: 音频文件路径
        
        Returns:
            识别的文字
        """
        url = f"{self.base_url}/audio/transcriptions"

        with open(audio_file_path, "rb") as audio_file:
            files = {
                "file": (os.path.basename(audio_file_path), audio_file, "audio/wav")
            }
            data = {
                "model": self.model
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

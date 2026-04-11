#!/usr/bin/env python3
"""
语音对话系统模块

包含：
- asr: 语音识别模块
- tts: 语音合成模块
- vad: 语音活动检测模块
"""

from .asr import ASRClient
from .tts import TTSClient, play_audio
from .vad import VADAudioRecorder, calibrate_microphone, list_audio_devices, calculate_db

__all__ = [
    'ASRClient',
    'TTSClient',
    'play_audio',
    'VADAudioRecorder',
    'calibrate_microphone',
    'list_audio_devices',
    'calculate_db',
]

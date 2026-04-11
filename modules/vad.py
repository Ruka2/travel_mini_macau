#!/usr/bin/env python3
"""
VAD 语音活动检测模块

基于音量分贝阈值自动检测语音开始/结束
"""

import os
import time
import math
import wave
import queue
import tempfile
import threading

import pyaudio
import numpy as np

from config import AUDIO_CONFIG, VAD_CONFIG


# 音频参数
AUDIO_FORMAT = AUDIO_CONFIG['format']
CHANNELS = AUDIO_CONFIG['channels']
RATE = AUDIO_CONFIG['rate']
CHUNK = AUDIO_CONFIG['chunk']

# VAD 参数
VAD_DB_THRESHOLD = VAD_CONFIG['db_threshold']
VAD_SILENCE_DURATION = VAD_CONFIG['silence_duration']
VAD_MIN_RECORD_DURATION = VAD_CONFIG['min_record_duration']


def calculate_db(data: bytes) -> float:
    """
    计算音频数据的分贝值
    
    Args:
        data: 音频字节数据（int16 格式）
    
    Returns:
        分贝值（dB）
    """
    audio_data = np.frombuffer(data, dtype=np.int16)
    if len(audio_data) == 0:
        return -100.0

    # 计算 RMS（均方根）
    rms = np.sqrt(np.mean(audio_data.astype(np.float64) ** 2))
    if rms < 1.0:
        return -100.0

    # 归一化到 [-1, 1] 范围后计算分贝
    normalized_rms = rms / 32768.0
    db = 20 * math.log10(normalized_rms)
    return db


def list_audio_devices():
    """列出可用的音频输入设备"""
    audio = pyaudio.PyAudio()
    print("🎙️  可用音频输入设备：")
    print("-" * 50)
    has_input = False
    for i in range(audio.get_device_count()):
        info = audio.get_device_info_by_index(i)
        if info.get('maxInputChannels', 0) > 0:
            has_input = True
            print(f"   [{i}] {info.get('name')} (输入通道: {info.get('maxInputChannels')})")
    if not has_input:
        print("   ⚠️ 未找到任何输入设备！")
    print()
    audio.terminate()


def calibrate_microphone(duration: float = 5.0):
    """
    校准麦克风，显示实时分贝值帮助用户设置合适的阈值
    
    Args:
        duration: 校准持续时间（秒）
    """
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=AUDIO_FORMAT,
        channels=CHANNELS,
        rate=RATE,
        input=True,
        frames_per_buffer=CHUNK
    )

    print(f"🎙️  麦克风校准中，请说话...（{duration}秒）")
    print("-" * 50)

    dbs = []
    start_time = time.time()
    try:
        while time.time() - start_time < duration:
            data = stream.read(CHUNK, exception_on_overflow=False)
            db = calculate_db(data)
            dbs.append(db)
            # 显示一个简单柱状图
            bar_len = max(0, min(30, int((db + 60) / 2)))
            bar = "█" * bar_len + "░" * (30 - bar_len)
            print(f"\r📊 [{bar}] {db:6.1f} dB", end="", flush=True)
    finally:
        stream.stop_stream()
        stream.close()
        audio.terminate()

    print("\n" + "-" * 50)
    if dbs:
        print(f"📈 统计结果:")
        print(f"   最小值: {min(dbs):.1f} dB")
        print(f"   最大值: {max(dbs):.1f} dB")
        print(f"   平均值: {sum(dbs)/len(dbs):.1f} dB")
        print(f"   建议阈值: {max(dbs) - 10:.1f} dB ~ {max(dbs) - 5:.1f} dB")
    print()


class VADAudioRecorder:
    """基于 VAD 的音频录制器 - 自动检测语音开始和结束"""

    def __init__(self,
                 db_threshold: float = None,
                 silence_duration: float = None,
                 min_record_duration: float = None):
        """
        初始化 VAD 录音器
        
        Args:
            db_threshold: 分贝阈值，默认从 VAD_CONFIG 读取
            silence_duration: 静音持续时间（秒），默认从 VAD_CONFIG 读取
            min_record_duration: 最小录音时长（秒），默认从 VAD_CONFIG 读取
        """
        self.audio = pyaudio.PyAudio()
        self.db_threshold = db_threshold if db_threshold is not None else VAD_DB_THRESHOLD
        self.silence_duration = silence_duration if silence_duration is not None else VAD_SILENCE_DURATION
        self.min_record_duration = min_record_duration if min_record_duration is not None else VAD_MIN_RECORD_DURATION
        self.is_listening = False
        self.is_recording = False
        self.frames = []
        self.stream = None
        self.listen_thread = None
        self.audio_queue = queue.Queue()

    def start_listening(self):
        """开始持续监听麦克风"""
        self.is_listening = True

        self.stream = self.audio.open(
            format=AUDIO_FORMAT,
            channels=CHANNELS,
            rate=RATE,
            input=True,
            frames_per_buffer=CHUNK
        )

        print(f"🎙️  开始监听...（语音音量需大于 {self.db_threshold:.1f} dB 触发）")

        def listen():
            while self.is_listening:
                try:
                    data = self.stream.read(CHUNK, exception_on_overflow=False)
                    self.audio_queue.put(data)
                except Exception as e:
                    print(f"监听错误: {e}")
                    break

        self.listen_thread = threading.Thread(target=listen, daemon=True)
        self.listen_thread.start()

    def stop_listening(self):
        """停止监听"""
        self.is_listening = False
        if self.listen_thread:
            self.listen_thread.join(timeout=1.0)
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None

    def wait_for_speech(self, show_db: bool = True) -> str:
        """
        等待并录制一段语音，自动检测语音结束
        
        Args:
            show_db: 是否实时显示分贝值
        
        Returns:
            保存的 WAV 文件路径
        """
        self.is_recording = True
        self.frames = []

        silence_frames = 0
        frames_per_second = RATE / CHUNK
        silence_threshold_frames = int(self.silence_duration * frames_per_second)
        min_frames = int(self.min_record_duration * frames_per_second)
        has_speech_started = False


        while self.is_listening:
            try:
                data = self.audio_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            db = calculate_db(data)

            if show_db and not has_speech_started:
                bar_len = max(0, min(20, int((db + 60) / 2)))
                bar = "█" * bar_len + "░" * (20 - bar_len)
                print(f"\r👂 [{bar}] {db:6.1f} dB (阈值: {self.db_threshold:.1f} dB)    等待语音输入...", end="", flush=True)

            if db > self.db_threshold:
                if show_db and not has_speech_started:
                    print()  # 换行，结束实时显示
                if not has_speech_started:
                    has_speech_started = True
                    # print(f"🔊 检测到语音开始！({db:.1f} dB)")
                silence_frames = 0
                self.frames.append(data)
            elif has_speech_started:
                self.frames.append(data)
                silence_frames += 1

                if len(self.frames) >= min_frames and silence_frames >= silence_threshold_frames:
                    # print(f"🛑 语音结束，检测到持续静音")
                    break

        self.is_recording = False

        # 保存为 WAV 文件
        output_file = tempfile.mktemp(suffix=".wav")

        with wave.open(output_file, 'wb') as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(self.audio.get_sample_size(AUDIO_FORMAT))
            wf.setframerate(RATE)
            wf.writeframes(b''.join(self.frames))

        return output_file

    def close(self):
        """关闭音频设备"""
        self.stop_listening()
        self.audio.terminate()

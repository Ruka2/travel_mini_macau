import pyaudio
from openai import OpenAI


# ==================== 大模型配置 ====================
OPENAI_API_KEY = "sk-cvgkozaydtyomywtkbkluftagparvunlnngsxmdrpmvojhzp"
OPENAI_URL = "https://api.siliconflow.cn/v1"
# MODEL_TYPE = "Qwen/Qwen2.5-7B-Instruct"
# MODEL_TYPE = "Qwen/Qwen3.5-4B"
# MODEL_TYPE = "Qwen/Qwen3.5-9B"
MODEL_TYPE = "Qwen/Qwen3.5-27B"

LLM_CONFIG = {
    'model': MODEL_TYPE,  # 或 'deepseek-chat' 等
    'model_server': OPENAI_URL,  # 或 'https://api.deepseek.com/v1'
    'api_key': OPENAI_API_KEY,
    'generate_cfg': {
        'top_p': 0.8,
        'temperature': 0.7,
    }
}



# ==================== 音频配置 ====================
SILICONFLOW_API_KEY = "sk-cvgkozaydtyomywtkbkluftagparvunlnngsxmdrpmvojhzp"
SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
# ASR 配置
ASR_MODEL = "FunAudioLLM/SenseVoiceSmall"  # 或 TeleAI/TeleSpeechASR
ASR_CONFIG = {
    "model": ASR_MODEL,
    'base_url': SILICONFLOW_BASE_URL,
    'api_key': SILICONFLOW_API_KEY
}

# TTS 配置
TTS_MODEL = "fnlp/MOSS-TTSD-v0.5"
TTS_VOICE = "fnlp/MOSS-TTSD-v0.5:diana"  # 可选: alex, anna, bella, benjamin, charles, claire, david, diana
TTS_FORMAT = "mp3"
TTS_CONFIG = {
    "model": TTS_MODEL,
    'base_url': SILICONFLOW_BASE_URL,
    'api_key': SILICONFLOW_API_KEY,
    'voice': TTS_VOICE,
    'response_format': TTS_FORMAT,
}

# ==================== VAD 配置 ====================
# 注意：int16 音频归一化后的分贝值范围约为 (-inf, 0] dB
# 安静环境约 -60 ~ -50 dB，正常说话约 -40 ~ -25 dB，大声说话约 -20 ~ -10 dB
VAD_DB_THRESHOLD = -40         # 分贝阈值，超过此值视为语音开始（建议 -45 ~ -35）
VAD_SILENCE_DURATION = 1.5     # 静音持续时间（秒），低于阈值持续此时间后停止录音
VAD_MIN_RECORD_DURATION = 0.5  # 最小录音时长（秒），防止误触发

VAD_CONFIG = {
    'db_threshold': VAD_DB_THRESHOLD,
    'silence_duration': VAD_SILENCE_DURATION,
    'min_record_duration': VAD_MIN_RECORD_DURATION,
}

# ==================== 音频硬件配置 ====================
AUDIO_FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 1024

AUDIO_CONFIG = {
    'format': AUDIO_FORMAT,
    'channels': CHANNELS,
    'rate': RATE,
    'chunk': CHUNK,
}

### 快速测试
# 初始化客户端
# client = OpenAI(
#     api_key=OPENAI_API_KEY,
#     base_url=OPENAI_URL,
# )

# # 调用模型
# response = client.chat.completions.create(
#     model=MODEL_TYPE,
#     messages=[
#         {"role": "user", "content": "你好，请介绍一下自己"}
#     ],
#     temperature=0.7,
#     max_tokens=512,
# )
# # print(response)
# # 输出结果
# print(response.choices[0].message.content)

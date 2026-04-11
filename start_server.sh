#!/bin/bash

# FA Agent 智能地图助手启动脚本

echo "========================================"
echo "  FA Agent - 智能地图助手"
echo "========================================"
echo ""

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 python3"
    exit 1
fi

echo "✅ Python3 已找到"

# 检查依赖
echo ""
echo "📦 检查依赖..."
python3 -c "import fastapi, uvicorn" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  缺少依赖，正在安装..."
    pip install fastapi uvicorn
fi

echo "✅ 依赖检查完成"

# 启动服务器
echo ""
echo "🚀 启动服务器..."
echo ""
echo "  📍 主界面:     http://localhost:8000"
echo "  🗺️  地图界面:   http://localhost:8000/map"
echo "  📚 API文档:    http://localhost:8000/docs"
echo ""
echo "  按 Ctrl+C 停止服务器"
echo ""

python3 agent_server.py

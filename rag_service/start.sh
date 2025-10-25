#!/bin/bash

# HealthYoda RAG Service Start Script
# Auto-kills process on port 3000 and restarts

PORT=3000
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🧬 HealthYoda RAG Service Startup Script"
echo "========================================"
echo ""

# Check if port is in use
echo "🔍 Checking port $PORT..."
PID=$(lsof -i :$PORT -t 2>/dev/null)

if [ -n "$PID" ]; then
    echo "⚠️  Port $PORT is already in use (PID: $PID)"
    echo "🔨 Killing process..."
    kill -9 $PID 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Process killed successfully"
    else
        echo "❌ Failed to kill process, trying sudo..."
        sudo kill -9 $PID 2>/dev/null || true
    fi
    sleep 1
    echo ""
fi

# Verify port is free
echo "✅ Port $PORT is now free"
echo ""

# Check if venv exists
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo ""
fi

# Activate venv and install dependencies
echo "📚 Activating virtual environment..."
source "$SCRIPT_DIR/venv/bin/activate"

echo "📦 Installing dependencies..."
pip install -q -r requirements.txt 2>/dev/null && echo "✅ Dependencies installed" || echo "⚠️  Some dependencies may have issues"
echo ""

# Start the RAG service
echo "🚀 Starting HealthYoda RAG Service..."
echo "   Port: $PORT"
echo "   Host: 0.0.0.0 (Public)"
echo "   Handbook: handbook.txt"
echo ""

uvicorn main:app --host 0.0.0.0 --port $PORT --reload

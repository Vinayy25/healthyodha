#!/bin/bash

# HealthYoda Backend Start Script
# Auto-kills process on port 3001 and restarts

PORT=3001
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 HealthYoda Backend Startup Script"
echo "===================================="
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

# Check if node_modules exists
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the backend
echo "🎯 Starting HealthYoda Backend..."
echo "   Port: $PORT"
echo "   RAG Service: $(grep RAG_SERVICE_URL ../.env | cut -d= -f2)"
echo ""
echo "📋 Configuration:"
npm start

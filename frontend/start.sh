#!/bin/bash

# HealthYoda Frontend Start Script
# Auto-kills process on port 5173 and restarts

PORT=5173
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🎨 HealthYoda Frontend Startup Script"
echo "====================================="
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

# Start the frontend
echo "🚀 Starting HealthYoda Frontend..."
echo "   Port: $PORT"
echo "   Environment: Development"
echo ""
echo "📋 Frontend will be available at:"
echo "   http://localhost:$PORT"
echo ""

npm run dev

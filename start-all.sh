#!/bin/bash

# HealthYoda Master Startup Script
# Starts all services: RAG, Backend, Frontend with automatic port cleanup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🏥 HealthYoda - AI Medical Assistant                  ║"
echo "║     Master Startup Script                                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Function to kill process on port
cleanup_port() {
    local PORT=$1
    local SERVICE=$2
    PID=$(lsof -i :$PORT -t 2>/dev/null || echo "")
    if [ -n "$PID" ]; then
        echo "🔨 Cleaning up $SERVICE on port $PORT (PID: $PID)..."
        kill -9 $PID 2>/dev/null || sudo kill -9 $PID 2>/dev/null || true
        sleep 1
    fi
}

# Cleanup all ports
echo "🧹 Cleaning up ports..."
cleanup_port 3000 "RAG Service"
cleanup_port 3001 "Backend"
cleanup_port 5173 "Frontend"
echo ""

# Start services
echo "🚀 Starting all services..."
echo ""

# Terminal 1: RAG Service
echo "📋 Starting RAG Service in terminal..."
echo "   Command: cd $SCRIPT_DIR/rag_service && ./start.sh"
cd "$SCRIPT_DIR/rag_service" && ./start.sh > /tmp/rag_service.log 2>&1 &
RAG_PID=$!
echo "   ✅ RAG Service started (PID: $RAG_PID)"
sleep 3

# Terminal 2: Backend
echo ""
echo "📋 Starting Backend in terminal..."
echo "   Command: cd $SCRIPT_DIR/backend && ./start.sh"
cd "$SCRIPT_DIR/backend" && ./start.sh > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "   ✅ Backend started (PID: $BACKEND_PID)"
sleep 2

# Terminal 3: Frontend
echo ""
echo "📋 Starting Frontend in terminal..."
echo "   Command: cd $SCRIPT_DIR/frontend && ./start.sh"
cd "$SCRIPT_DIR/frontend" && ./start.sh > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   ✅ Frontend started (PID: $FRONTEND_PID)"
sleep 2

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           ✅ All Services Started Successfully!            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 Service Status:"
echo "   🧬 RAG Service:    http://localhost:3000    (PID: $RAG_PID)"
echo "   🎯 Backend:        http://localhost:3001    (PID: $BACKEND_PID)"
echo "   🎨 Frontend:       http://localhost:5173    (PID: $FRONTEND_PID)"
echo ""

echo "📋 Log Files:"
echo "   RAG:      tail -f /tmp/rag_service.log"
echo "   Backend:  tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""

echo "🌐 Access Your Application:"
echo "   http://localhost:5173"
echo ""

echo "🛑 To stop all services:"
echo "   kill $RAG_PID $BACKEND_PID $FRONTEND_PID"
echo "   OR press Ctrl+C"
echo ""

# Keep script running
echo "Press Ctrl+C to stop all services..."
wait

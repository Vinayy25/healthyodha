#!/bin/bash

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Run ./setup.sh first"
    exit 1
fi

source venv/bin/activate

# Start the RAG service
echo "🚀 Starting HealthYoda RAG Service on http://localhost:8000"
echo "📖 Loading handbook from ../handbook.txt"
echo "🔑 Using OPENAI_API_KEY from ../.env"
echo ""
uvicorn main:app --port 3000 --reload


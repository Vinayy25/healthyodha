#!/bin/bash

echo "🚀 HealthYoda Complete Installation"
echo "===================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js $(node --version)"
else
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    echo "✅ npm $(npm --version)"
else
    echo "❌ npm not found"
    exit 1
fi

# Check Python
if command -v python3 &> /dev/null; then
    echo "✅ Python $(python3 --version)"
else
    echo "❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check .env file
if [ -f ".env" ]; then
    echo "✅ .env file exists"
else
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your OPENAI_API_KEY"
    echo ""
    read -p "Press Enter after you've added your API key to .env..."
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Install backend
echo "1/3 Installing backend dependencies..."
cd backend
npm install --quiet
cd ..
echo "✅ Backend ready"

# Install frontend
echo "2/3 Installing frontend dependencies..."
cd frontend
npm install --quiet
cd ..
echo "✅ Frontend ready"

# Setup RAG service
echo "3/3 Setting up RAG service..."
cd rag_service
chmod +x setup.sh run.sh
./setup.sh
cd ..
echo "✅ RAG service ready"

echo ""
echo "===================================="
echo "✅ Installation complete!"
echo ""
echo "📁 Project structure:"
echo "   ├── backend (Node.js)"
echo "   ├── frontend (Vite + React)"
echo "   └── rag_service (Python + FAISS)"
echo ""
echo "🚀 To start the application:"
echo ""
echo "Terminal 1 (RAG Service):"
echo "  cd rag_service && ./run.sh"
echo ""
echo "Terminal 2 (Backend):"
echo "  cd backend && npm start"
echo ""
echo "Terminal 3 (Frontend):"
echo "  cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:5173"
echo ""
echo "📖 For more info:"
echo "   - QUICKSTART.md - Quick start guide"
echo "   - RAG_GUIDE.md - RAG documentation"
echo "   - README.md - Full documentation"
echo ""


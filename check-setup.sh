#!/bin/bash

echo "🔍 HealthYoda Setup Verification"
echo "================================"
echo ""

# Check Node.js
echo "📦 Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check npm
echo ""
echo "📦 Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm installed: $NPM_VERSION"
else
    echo "❌ npm not found"
    exit 1
fi

# Check .env file
echo ""
echo "🔑 Checking environment file..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    if grep -q "OPENAI_API_KEY=sk-" .env; then
        echo "✅ OPENAI_API_KEY appears to be set"
    else
        echo "⚠️  OPENAI_API_KEY may not be properly configured"
        echo "   Make sure it starts with 'sk-' or 'sk-proj-'"
    fi
else
    echo "❌ .env file not found"
    echo "   Run: cp .env.example .env"
    echo "   Then edit .env with your OpenAI API key"
fi

# Check backend dependencies
echo ""
echo "📦 Checking backend dependencies..."
if [ -d "backend/node_modules" ]; then
    echo "✅ Backend dependencies installed"
else
    echo "⚠️  Backend dependencies not found"
    echo "   Run: cd backend && npm install"
fi

# Check frontend dependencies
echo ""
echo "📦 Checking frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "⚠️  Frontend dependencies not found"
    echo "   Run: cd frontend && npm install"
fi

echo ""
echo "================================"
echo "✨ Setup check complete!"
echo ""
echo "To start the application:"
echo "  Terminal 1: cd backend && npm start"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""


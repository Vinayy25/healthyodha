#!/bin/bash

echo "🧬 Setting up HealthYoda RAG Service"
echo "===================================="
echo ""

# Check Python version
echo "📦 Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python installed: $PYTHON_VERSION"
else
    echo "❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Create virtual environment
echo ""
echo "🔧 Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "ℹ️  Virtual environment already exists"
fi

# Activate virtual environment
echo ""
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo ""
echo "📦 Upgrading pip..."
pip install --upgrade pip --quiet

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "===================================="
echo "✅ RAG Service setup complete!"
echo ""
echo "To start the RAG service:"
echo "  1. cd rag_service"
echo "  2. source venv/bin/activate"
echo "  3. uvicorn main:app --port 3000 --reload"
echo ""
echo "Or use the run script:"
echo "  ./run.sh"
echo ""


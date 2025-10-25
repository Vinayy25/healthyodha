# 🧬 HealthYoda RAG Service

Retrieval Augmented Generation service for medical knowledge enhancement using FAISS vector search.

## 📋 Overview

This service:

- Loads and chunks the medical handbook (`handbook.txt`)
- Creates embeddings using OpenAI's embedding model
- Stores vectors in a FAISS index for fast similarity search
- Provides REST API endpoints for context retrieval

## 🚀 Quick Start

### 1. Setup (First Time Only)

```bash
cd rag_service
chmod +x setup.sh run.sh
./setup.sh
```

This will:

- Create a Python virtual environment
- Install all required dependencies
- Prepare the service for use

### 2. Run the Service

```bash
./run.sh
```

Or manually:

```bash
source venv/bin/activate
uvicorn main:app --port 8000 --reload
```

The service will start on `http://localhost:8000`

## 📡 API Endpoints

### GET /

Service information and status

### GET /health

Health check endpoint

```json
{
  "status": "healthy",
  "chunks_loaded": 42,
  "ready": true
}
```

### POST /rag

Retrieve relevant medical context

**Request:**

```json
{
  "query": "chest pain symptoms",
  "k": 3
}
```

**Response:**

```json
{
  "context": "[Source 1]\nChest Pain framework...\n\n---\n\n[Source 2]...",
  "sources": ["Cardiac - Chest Pain", "Cardiac - Palpitations"],
  "num_chunks": 3
}
```

### GET /chunks

List all chunks (debugging)

## 🔧 Configuration

### Environment Variables

- `OPENAI_API_KEY`: Required for embeddings (loaded from `../.env`)

### Chunking Strategy

The service uses intelligent chunking that:

1. **Smart Chunking** (default): Splits by symptom/condition preserving medical frameworks
2. **Fallback Chunking**: Uses RecursiveCharacterTextSplitter if smart chunking fails

You can modify chunking in `main.py`:

- `chunk_size`: Maximum chunk size (default: 800)
- `chunk_overlap`: Overlap between chunks (default: 150)
- `k`: Number of chunks to retrieve (configurable per request, default: 3)

## 📊 Data Preparation

Your `handbook.txt` is already well-structured! The service automatically:

- Detects system-wise organization (Cardiac, Respiratory, etc.)
- Identifies symptom frameworks (Chest Pain, Palpitations, etc.)
- Preserves the question-answer structure
- Maintains metadata (system, symptom type)

### Handbook Structure Expected:

```
System Name
  Symptom/Condition Name
    Chief Complaint
    Onset/Duration
    Quality/Severity
    ...
```

## 🧪 Testing

### Test the Service

```bash
# Health check
curl http://localhost:8000/health

# RAG query
curl -X POST http://localhost:8000/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "chest pain", "k": 2}'

# List chunks
curl http://localhost:8000/chunks
```

## 🐛 Troubleshooting

### "OPENAI_API_KEY not found"

Make sure `.env` file exists in the parent directory with your API key.

### "handbook.txt not found"

The service looks for `../handbook.txt` relative to the rag_service directory.

### Import errors

Make sure you activated the virtual environment:

```bash
source venv/bin/activate
```

### Port already in use

Change the port:

```bash
uvicorn main:app --port 8001 --reload
```

And update `backend/server.js` to use the new port.

## 📦 Dependencies

- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **LangChain**: Document processing and vector stores
- **FAISS**: Vector similarity search
- **OpenAI**: Embeddings API

## 🔄 Updating the Handbook

After updating `handbook.txt`:

1. Restart the RAG service
2. The service will reload and re-index automatically
3. Check logs to confirm chunk count

## 🚧 Future Enhancements

- [ ] Support for multiple knowledge bases
- [ ] Caching of embeddings
- [ ] Metadata filtering (e.g., system-specific queries)
- [ ] Hybrid search (keyword + semantic)
- [ ] Query rewriting for better retrieval

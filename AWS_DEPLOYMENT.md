# AWS Deployment - HealthYoda Realtime Assistant

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Local Machine                       │
│                                                             │
│  Frontend (http://15.206.157.127:5173)                     │
│  - React + TypeScript                                      │
│  - WebRTC to OpenAI Realtime API                           │
│  - Displays conversation transcript                        │
│  - Sends user audio → receives AI voice                    │
└────────────────────────────────────────────────────────────┘
                           ↕ HTTPS/WebRTC
┌────────────────────────────────────────────────────────────┐
│              AWS EC2 Instance (15.206.157.127)             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Backend (Port 3001)                                 │ │
│  │ - Node.js/Express                                   │ │
│  │ - Creates Realtime session tokens                   │ │
│  │ - Receives user transcripts                         │ │
│  │ - INTERCEPTS & CALLS RAG FOR FOLLOW-UP CONTEXT      │ │
│  └──────────────────────────────────────────────────────┘ │
│                           ↓                                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ RAG Service (Port 3000) ✅ PUBLIC & INTERNET FACING │ │
│  │ - Python FastAPI                                    │ │
│  │ - FAISS vector search                               │ │
│  │ - 7 medical framework chunks loaded                 │ │
│  │ - Returns: optimal follow-up questions + context    │ │
│  └──────────────────────────────────────────────────────┘ │
│                           ↓                                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ handbook.txt                                        │ │
│  │ - Cardiac System frameworks                         │ │
│  │ - Respiratory, GI, Neuro, etc.                      │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
                           ↕
┌────────────────────────────────────────────────────────────┐
│              OpenAI Realtime API (Internet)                │
│                                                            │
│  - Speech-to-Text (STT)                                   │
│  - Text-to-Speech (TTS)                                   │
│  - LLM Reasoning (gpt-4o-realtime-preview)               │
│  - Uses context from RAG for optimal follow-ups          │
└────────────────────────────────────────────────────────────┘
```

## Current Status

✅ **RAG Service**: Running and publicly accessible

- URL: `http://15.206.157.127:3000`
- Health: `http://15.206.157.127:3000/health` → `{"status":"healthy","chunks_loaded":7,"ready":true}`
- Query endpoint: `http://15.206.157.127:3000/rag` (POST)

✅ **Backend**: Configured to call AWS RAG service

- `.env` file: `RAG_SERVICE_URL=http://15.206.157.127:3000`
- All `/rag` requests go through to AWS

✅ **Frontend**: Ready to connect

## How the RAG Integration Works

### Conversation Flow:

```
1. OPENING QUESTION (No RAG)
   User: "Hello"
   ↓
   Backend: (no RAG call - user hasn't responded yet)
   ↓
   OpenAI: "Hello! I'm HealthYoda. How can I help you today?"

2. USER RESPONDS
   User: "I have chest pain"
   ↓
   Backend: Intercepts transcript
   ↓
   Backend: Calls RAG
      POST http://15.206.157.127:3000/rag
      {"query": "chest pain"}
   ↓
   RAG Returns: Complete cardiac assessment framework
      - Onset/Duration questions
      - Quality/Severity assessment
      - Red flags to watch for
      - Associated symptoms to check
   ↓
   Backend: Injects into OpenAI context
   ↓
   OpenAI: Uses framework to ask optimal follow-up
      "Thank you for sharing. Let me understand better.
       When did this chest pain start - was it sudden or gradual?"

3. ITERATIVE PROCESS
   Each patient response → RAG context → Optimal follow-up
```

## Real-World Example

```bash
# User says: "I've had chest pain for 3 days"

# Backend automatically calls:
curl -X POST http://15.206.157.127:3000/rag \
  -H "Content-Type: application/json" \
  -d '{"query":"chest pain for 3 days","k":2}'

# RAG returns:
{
  "context": "[Source 1]\nHealthYoda History Framework – Cardiac System\nChest Pain\n...Onset/Duration\nPossible Answers:\n- Sudden onset (minutes)\n- Gradual over hours\n- Intermittent episodes\n- Chronic (>1 month)\n\nQuality/Severity\nPossible Answers:\n- Pressure/tightness\n- Burning/indigestion-like\n- Sharp/stabbing\n- Crushing...",
  "sources": ["Cardiac - Chest Pain"],
  "num_chunks": 2
}

# OpenAI uses this context and asks:
"Can you describe the quality of the pain? Is it sharp,
pressing, burning, or something else?"
```

## Deployment Commands

**SSH into EC2:**

```bash
ssh -i /path/to/mahe-server.pem ubuntu@15.206.157.127
```

**Terminal 1 - Start RAG Service:**

```bash
cd ~/healthyodha/rag_service
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 3000 --reload
```

**Terminal 2 - Start Backend:**

```bash
cd ~/healthyodha/backend
npm start
```

**Terminal 3 - Start Frontend:**

```bash
cd ~/healthyodha/frontend
npm run dev
```

## Testing the Integration

### Test 1: Verify RAG is responding

```bash
curl http://15.206.157.127:3000/health
# Response: {"status":"healthy","chunks_loaded":7,"ready":true}
```

### Test 2: Backend calls RAG correctly

```bash
curl -X POST http://localhost:3001/rag \
  -H "Content-Type: application/json" \
  -d '{"query":"chest pain","k":2}'
# Response: Medical framework from AWS RAG
```

### Test 3: End-to-end conversation

1. Open: `http://15.206.157.127:5173`
2. Click "Start Conversation"
3. Say: "I have chest pain"
4. Watch: RAG automatically provides optimal cardiac questions
5. Observe: Follow-ups ask about Onset → Quality → Severity → etc.

## AWS Security Group Requirements

Port 3000 (RAG Service) must be open:

```
Type: Custom TCP Rule
Protocol: TCP
Port Range: 3000
Source: 0.0.0.0/0 (or restrict to your IP)
```

Port 5173 (Frontend) must be open:

```
Type: Custom TCP Rule
Protocol: TCP
Port Range: 5173
Source: 0.0.0.0/0 (or restrict to your IP)
```

## Key Points

✅ RAG service is **publicly accessible** at `http://15.206.157.127:3000`
✅ Backend **automatically calls RAG** for every follow-up question
✅ OpenAI receives **medical framework context** for optimal questioning
✅ System follows evidence-based assessment workflow
✅ No RAG call for initial greeting (only patient responses)

## Monitoring

Check if services are running:

```bash
# On EC2:
ps aux | grep uvicorn    # RAG service
ps aux | grep node       # Backend
ps aux | grep vite       # Frontend
```

View RAG logs:

```bash
tail -f ~/healthyodha/rag_service/rag_service.log
```

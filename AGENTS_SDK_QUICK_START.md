# 🚀 Agents SDK Implementation - Quick Start

## What Changed

We've migrated from the **Dual-Session approach** to the **Agents SDK with real-time tool calling**. This means:

✅ Real tool calls during conversation (not just embedded context)
✅ Single continuous session (no reconnections)
✅ OpenAI automatically decides when to call tools
✅ Medical framework retrieved dynamically based on conversation
✅ Summary generated via tool call when AI decides it's time

---

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install @openai/agents zod
```

### 2. Start Services

```bash
# Terminal 1 - RAG Service (on AWS/EC2)
# Already running on: $RAG_SERVICE_URL (configured in .env)
# Example: http://15.206.157.127:3000

# Terminal 2 - Backend
cd backend && ./start.sh
# Runs on: http://localhost:3001

# Terminal 3 - Frontend
cd frontend && npm run dev
# Runs on: http://localhost:5173
```

### 3. Open Browser

```
http://localhost:5173
```

---

## How It Works

### Two Tools are Defined:

#### Tool 1: `get_relevant_questions`

When OpenAI needs guidance on what to ask next:

- User says: "I have chest pain"
- OpenAI: "I should call get_relevant_questions to understand what to ask"
- Tool fetches: `POST /rag` → Backend queries AWS RAG at $RAG_SERVICE_URL
- OpenAI: "Thank you, I know to ask about onset, quality, severity..."
- OpenAI asks: "When did the chest pain start?"

#### Tool 2: `generate_medical_summary`

When conversation is complete:

- OpenAI: "I've gathered sufficient information"
- OpenAI calls: generate_medical_summary tool
- Tool fetches: `POST /summary` → Structured report
- Report displayed to doctor

---

## Testing

### Test 1: Check Tool Calling

1. Open browser console (F12)
2. Click "Start Conversation"
3. Say: "I have chest pain"
4. Look for console logs:
   ```
   🔍 Tool called: Retrieving questions for symptom: "chest pain"
   ✅ RAG Tool Response: 2 chunks from 2 sources
   ```

### Test 2: Check Summary Generation

1. Have a conversation (5-10 exchanges)
2. Wait for AI to decide conversation is complete
3. Look for console logs:
   ```
   📝 Tool called: Generating medical summary
   ✅ Medical summary generated
   ```
4. Summary appears on screen

### Test 3: Check Backend Logs

```bash
# Terminal 2 (backend)
tail -f /tmp/backend.log | grep "Tool\|RAG"
```

---

## API Endpoints

### New Endpoint: `/client-secret`

Returns ephemeral token for Agents SDK

```bash
GET http://localhost:3001/client-secret
```

### Existing Endpoint: `/rag`

Handles tool calls for RAG retrieval

```bash
POST http://localhost:3001/rag
Content-Type: application/json

{
  "query": "chest pain",
  "k": 2
}
# Backend forwards to RAG_SERVICE_URL (AWS RAG service)
```

### Existing Endpoint: `/summary`

Handles tool calls for summary generation

```bash
POST http://localhost:3001/summary
Content-Type: application/json

{
  "transcripts": [...]
}
```

---

## Frontend Code Structure

### App.tsx

```
App Component
├── initializeAgent()
│   ├── Define getRelevantQuestions tool
│   ├── Define generateMedicalSummary tool
│   ├── Create RealtimeAgent with tools
│   ├── Get ephemeral token
│   └── Connect session
├── Event Handlers
│   ├── session.on("audio") → Play response
│   ├── session.on("transcription.updated") → Update UI
│   └── session.on("error") → Show error
└── UI
    ├── Start button
    ├── Transcript display
    ├── End button
    └── Summary report
```

---

## Browser Console Logs You'll See

### During Initialization

```
📡 Initializing HealthYoda Voice Agent with tools...
🔑 Requesting ephemeral token from backend...
🎯 Connecting to Realtime API...
🎤 Requesting microphone access...
✅ Microphone access granted
✅ Session connected and ready
```

### During Conversation

```
📝 Transcription: I have chest pain
🔍 Tool called: Retrieving questions for symptom: "I have chest pain"
✅ RAG Tool Response: 2 chunks from 2 sources
📝 Transcription: When did this start...
(AI speaking response)
```

### When Ending

```
📝 Tool called: Generating medical summary
✅ Medical summary generated
📋 Medical Summary Report displayed
```

---

## Troubleshooting

### Frontend doesn't connect

- Check browser console for errors
- Verify backend is running: `curl http://localhost:3001/client-secret`
- Verify RAG service is running: `curl $RAG_SERVICE_URL/health` (from .env)

### Tool not executing

- Check browser console for "Tool called" logs
- Verify `/rag` endpoint is working: `curl -X POST http://localhost:3001/rag -H "Content-Type: application/json" -d '{"query":"chest pain"}'`
- Check backend logs for errors
- Ensure backend can reach RAG_SERVICE_URL from .env

### Audio not working

- Grant microphone permission to browser
- Check browser console for audio-related errors
- Verify your browser supports WebAudio API

### Summary not generating

- Verify `/summary` endpoint is working
- Check backend logs for summary generation errors
- Ensure conversation has enough content

---

## Key Files Changed

| File                           | Changes                          |
| ------------------------------ | -------------------------------- |
| `frontend/package.json`        | Added @openai/agents, zod        |
| `frontend/src/App.tsx`         | Complete rewrite with Agents SDK |
| `backend/server.js`            | Added `/client-secret` endpoint  |
| `AGENTS_SDK_IMPLEMENTATION.md` | New comprehensive docs           |

---

## Next Steps

1. **Test locally** - Follow testing section above
2. **Deploy to EC2**

   ```bash
   # Build frontend
   cd frontend && npm run build

   # Copy to EC2
   scp -i mahe-server.pem -r dist/* ubuntu@15.206.157.127:~/healthyodha/frontend/dist/
   ```

3. **Update API URLs** - Change localhost:3001 to EC2 IP in App.tsx
4. **Monitor** - Check browser console and backend logs during testing

---

## Advantages Over Previous Approach

| Aspect                   | Previous                | New                    |
| ------------------------ | ----------------------- | ---------------------- |
| Tool Calling             | ❌ Manual embedding     | ✅ Automatic execution |
| Sessions                 | 2 (connection overhead) | 1 (faster)             |
| Transcription            | Manual data channel     | SDK built-in           |
| Voice Activity Detection | Manual keyword matching | SDK built-in           |
| Error Handling           | Complex                 | SDK managed            |

---

## References

- [Agents SDK Documentation](https://openai.github.io/openai-agents-js/guides/voice-agents/)
- [Realtime API Guide](https://platform.openai.com/docs/guides/realtime-voice-agents)

---

**You now have a fully functional voice-based medical assistant with real-time tool calling!** 🎙️🏥

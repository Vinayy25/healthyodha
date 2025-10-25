# HealthYoda: Agents SDK with Real-Time Tool Calling

## Overview

This implementation uses the **OpenAI Agents SDK** for TypeScript/JavaScript, which provides:

- ✅ Real-time voice conversation (speech-to-speech)
- ✅ **Tool calling during conversation** (the key feature we needed!)
- ✅ Automatic tool execution and result injection
- ✅ Session management and history
- ✅ Better abstraction than raw WebRTC

## Architecture

### Components

```
Frontend (React + Agents SDK)
    ↓
    Initializes RealtimeAgent with tools
    ↓
Backend (Node.js)
    ├─ /client-secret: Returns ephemeral token
    └─ /rag: Responds to RAG queries from tools
    ↓
    /summary: Responds to summary generation from tools
    ↓
AWS RAG Service (FAISS)
    └─ Medical handbook retrieval
    ↓
OpenAI Realtime API
    └─ Processes voice + executes tools in real-time
```

### Data Flow

```
1. Frontend initializes RealtimeAgent
   ├─ Define tools with Zod schemas
   └─ Set system instructions

2. User speaks symptom
   ↓

3. OpenAI processes audio
   ├─ Recognizes need for tool call
   └─ Automatically calls frontend tool

4. Frontend tool executes
   ├─ Calls backend /rag endpoint
   ├─ Gets medical framework
   └─ Returns to OpenAI

5. OpenAI generates next question
   ├─ Uses medical framework from tool
   └─ Speaks answer to user

6. Repeat 2-5 until done

7. When ready, OpenAI calls generate_medical_summary tool
   ↓

8. Summary tool calls backend /summary
   ├─ Generates structured report
   └─ Displays to doctor
```

## Frontend Implementation

### Tool Definition (Zod Schema)

```typescript
import { tool } from "@openai/agents";
import { z } from "zod";

// Tool 1: RAG Retrieval
const getRelevantQuestions = tool({
  name: "get_relevant_questions",
  description: "Retrieve medical history questions based on symptoms",
  parameters: z.object({
    symptom: z.string().describe("Patient's chief complaint"),
  }),
  async execute({ symptom }) {
    const response = await fetch("http://localhost:3001/rag", {
      method: "POST",
      body: JSON.stringify({ query: symptom, k: 2 }),
    });
    const data = await response.json();
    return {
      context: data.context,
      sources: data.sources,
    };
  },
});

// Tool 2: Summary Generation
const generateMedicalSummary = tool({
  name: "generate_medical_summary",
  description: "Generate structured medical report",
  parameters: z.object({
    conversation: z.string(),
  }),
  async execute({ conversation }) {
    const response = await fetch("http://localhost:3001/summary", {
      method: "POST",
      body: JSON.stringify({ transcripts }),
    });
    const data = await response.json();
    return { summary: data.summary };
  },
});
```

### Agent Initialization

```typescript
import { RealtimeAgent, RealtimeSession } from "@openai/agents";

// Create agent with tools
const agent = new RealtimeAgent({
  name: "HealthYoda Medical Assistant",
  instructions: `You are HealthYoda...
    - Use get_relevant_questions tool to get medical framework
    - Use generate_medical_summary tool when done
  `,
  tools: [getRelevantQuestions, generateMedicalSummary],
});

// Get ephemeral token
const tokenResponse = await fetch("http://localhost:3001/client-secret");
const { client_secret } = await tokenResponse.json();

// Create and connect session
const session = new RealtimeSession(agent, {
  model: "gpt-4o-realtime-preview-2024-10-01",
  modalities: ["text", "audio"],
});

await session.connect({
  clientSecret: client_secret.value,
});

// Handle events
session.on("transcription.updated", (event) => {
  setTranscripts((prev) => [
    ...prev,
    {
      role: event.role,
      text: event.transcript,
    },
  ]);
});
```

## Backend Implementation

### New Endpoint: `/client-secret`

This endpoint returns an ephemeral token for the Agents SDK to use:

```javascript
app.get("/client-secret", async (req, res) => {
  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview-2024-10-01",
    }),
  });

  const data = await response.json();
  res.json({ client_secret: data.client_secret });
});
```

### Existing RAG Endpoint

The `/rag` endpoint now handles tool calls:

```javascript
app.post("/rag", async (req, res) => {
  const { query, k = 2 } = req.body;

  // Query AWS RAG service
  const ragResponse = await fetch(`${RAG_SERVICE_URL}/rag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, k }),
  });

  const ragData = await ragResponse.json();

  // Return framework for tool
  res.json({
    context: ragData.context,
    sources: ragData.sources,
    num_chunks: ragData.num_chunks,
  });
});
```

## Key Differences from Previous Implementation

| Feature                  | Previous (Dual-Session) | New (Agents SDK)  |
| ------------------------ | ----------------------- | ----------------- |
| Tool Calling             | No (context embedded)   | ✅ Yes (dynamic)  |
| Session Count            | 2 (greeting + context)  | 1 (continuous)    |
| Tool Execution           | Manual by backend       | Automatic by SDK  |
| Audio Handling           | Manual WebRTC           | Abstracted by SDK |
| Voice Activity Detection | Manual                  | ✅ Built-in       |
| Transcription            | Manual data channel     | ✅ Built-in       |
| Error Recovery           | Complex                 | ✅ Simpler        |

## How Tool Calling Works

### During Conversation

```
User: "I have chest pain"
         ↓
OpenAI (Realtime): "I should call get_relevant_questions to understand what to ask"
         ↓
Frontend tool executes:
  - Fetches http://localhost:3001/rag?query=chest pain
  - Gets cardiac assessment framework
  - Returns to OpenAI
         ↓
OpenAI: "Based on the framework, I'll ask about onset"
         ↓
OpenAI Voice: "When did this chest pain start?"
```

### At End of Interview

```
OpenAI: "I've gathered sufficient information"
         ↓
OpenAI calls: generate_medical_summary tool
         ↓
Frontend tool executes:
  - Fetches http://localhost:3001/summary
  - Backend generates report using GPT-4o-mini
  - Returns to frontend
         ↓
Report displayed to doctor
```

## Setup & Installation

### 1. Install dependencies

```bash
cd frontend
npm install @openai/agents zod
```

### 2. Ensure backend is running

```bash
cd backend
./start.sh
# Listens on http://localhost:3001
```

### 3. Ensure RAG service is running

```bash
cd rag_service
./start.sh
# Listens on http://localhost:3000
```

### 4. Start frontend

```bash
cd frontend
npm run dev
# Open http://localhost:5173
```

## Testing

### Test 1: Tool Execution During Conversation

1. Open frontend
2. Click "🎙️ Start Conversation"
3. Say: "I have chest pain"
4. Check browser console for:
   ```
   🔍 Tool called: Retrieving questions for symptom: "chest pain"
   ✅ RAG Tool Response: 2 chunks from 2 sources
   ```

### Test 2: Summary Generation

1. Have brief conversation
2. Listen for: "I have gathered sufficient information"
3. OpenAI calls summary tool
4. Check console for:
   ```
   📝 Tool called: Generating medical summary
   ✅ Medical summary generated
   ```
5. Summary appears on screen

### Test 3: Backend Tool Endpoints

```bash
# Test RAG tool endpoint
curl -X POST http://localhost:3001/rag \
  -H "Content-Type: application/json" \
  -d '{"query":"chest pain","k":2}'

# Test client-secret endpoint
curl http://localhost:3001/client-secret
```

## Advantages of This Approach

✅ **Real Tool Calling**: OpenAI decides when to call tools, not manual backend logic
✅ **Single Session**: Cleaner, faster, no reconnection needed
✅ **Automatic Transcription**: SDK handles speech-to-text
✅ **Voice Activity Detection**: SDK handles pause detection
✅ **Better Error Handling**: SDK manages connection state
✅ **Cleaner Code**: Less manual WebRTC/audio management
✅ **Production Ready**: OpenAI maintains the SDK
✅ **Scalable**: Built on proven APIs

## Limitations & Considerations

⚠️ **SDK Maturity**: Agents SDK is newer, may have occasional issues
⚠️ **Tool Latency**: Tool calls add ~500ms (RAG retrieval time)
⚠️ **Network Dependency**: Requires stable internet for tool calls
⚠️ **Error Propagation**: If RAG fails, tool needs graceful fallback
⚠️ **Cost**: More API calls for tool execution (but more accurate)

## Troubleshooting

### Issue: Tool not calling

**Check**:

- Browser console for tool execution logs
- Backend logs for `/rag` endpoint calls
- OpenAI instructions mention using the tool

### Issue: Tool execution fails

**Check**:

- RAG service is running: `curl $RAG_SERVICE_URL/health` (where RAG_SERVICE_URL is from .env)
- Backend is accessible: `curl http://localhost:3001/rag`
- Tool parameters match Zod schema

### Issue: Audio not working

**Check**:

- Microphone permissions granted
- Browser console for audio errors
- Session.on("audio") events firing

## Next Steps

1. **Deploy to EC2**: Copy frontend build to EC2, update API URLs
2. **Add More Tools**: Implement additional medical tools
3. **Improve RAG**: Add more medical frameworks to handbook.txt
4. **Analytics**: Track tool call usage and accuracy
5. **Multi-language**: Add translation tool for non-English patients

## References

- [OpenAI Agents SDK - GitHub Pages](https://openai.github.io/openai-agents-js/)
- [Building Voice Agents - Full Guide](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)
- [Realtime API Documentation](https://platform.openai.com/docs/guides/realtime-voice-agents)
- [Zod Validation Library](https://zod.dev)

---

**This implementation provides true real-time tool calling for medical knowledge retrieval, making HealthYoda a fully intelligent medical interview assistant!** 🚀

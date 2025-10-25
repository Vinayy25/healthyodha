# HealthYoda: Realtime API + RAG Integration Architecture

## The Problem We Fixed

The OpenAI Realtime API creates a **persistent WebRTC session with fixed system instructions**. These instructions are determined at session creation time and **cannot be changed mid-conversation**.

This means:

- ❌ Can't inject RAG context during the conversation
- ❌ Can't dynamically update instructions based on patient responses
- ❌ Model follows static instructions regardless of patient's symptoms

## The Solution: Dual-Session Architecture

We implemented a **two-phase conversation model**:

### Phase 1: Initial Greeting (No RAG)

```
User: Clicks "Start Conversation"
    ↓
Frontend: Calls POST /session (no user message yet)
    ↓
Backend: Creates Realtime session with GENERIC instructions
    ↓
OpenAI: "Hello! I'm HealthYoda. How can I help you?"
    ↓
User: "I have chest pain"
```

### Phase 2: RAG-Enhanced Follow-ups (With Context)

```
User: "I have chest pain"
    ↓
Frontend: Detects first user message
    ↓
Frontend: Calls POST /session-with-context
          with {"userMessage": "I have chest pain"}
    ↓
Backend:
  1. Queries RAG: /rag?query="I have chest pain"
  2. RAG returns: Cardiac assessment framework
  3. Injects framework into system instructions
  4. Creates NEW Realtime session with enriched instructions
    ↓
OpenAI: Gets system instructions with:
  - Full cardiac assessment framework
  - Question sequence: Onset → Quality → Severity
  - "Possible answers" examples
  - Red flags to listen for
    ↓
OpenAI: "Thank you for sharing. When did this chest pain start -
         was it sudden or gradual?"
```

## API Changes

### Existing Endpoint: `/session`

**Use for:** Initial conversation start (opening greeting)

```bash
POST /session
Content-Type: application/json
{}

Response:
{
  "client_secret": {
    "value": "...",
    "expires_at": "...",
    ...
  },
  "session_expires_at": "..."
}
```

### NEW Endpoint: `/session-with-context`

**Use for:** After patient's first message (get RAG-enhanced session)

```bash
POST /session-with-context
Content-Type: application/json
{
  "userMessage": "I have chest pain"
}

Response:
{
  "client_secret": { ... },
  "session_expires_at": "...",
  "ragContext": {
    "available": true,
    "sources": [
      "Cardiac - Chest Pain",
      "Cardiac - Palpitations"
    ]
  }
}
```

## Backend Architecture

```javascript
// Phase 1: Generic instructions
function buildSystemInstructions(ragContext = null) {
  let instructions = "You are HealthYoda...";

  if (ragContext) {
    // Phase 2: Inject medical framework
    instructions += `
IMPORTANT - MEDICAL KNOWLEDGE FRAMEWORK:
${ragContext}

Use this framework to ask evidence-based follow-up questions...`;
  }

  return instructions;
}

// Endpoint 1: Initial session (no RAG)
POST /session → buildSystemInstructions(null)

// Endpoint 2: RAG-enhanced session
POST /session-with-context →
  1. Fetch RAG: await fetch('/rag', {query: userMessage})
  2. Get context: ragData.context
  3. Build instructions: buildSystemInstructions(ragContext)
  4. Create session with enriched instructions
```

## Frontend Flow

```typescript
// Step 1: Start conversation (initial greeting)
const session1 = await axios.post("/session");
// → Connection to generic HealthYoda

// Step 2: Detect first user message from transcript
useEffect(() => {
  if (firstUserMessageDetected) {
    // Step 3: Get RAG-enhanced session
    const session2 = await axios.post("/session-with-context", {
      userMessage: firstUserMessage,
    });
    // → Reconnect with RAG-enhanced instructions
  }
}, [transcripts]);
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Application                         │
└─────────────────────────────────────────────────────────────┘
              ↓ Phase 1                ↓ Phase 2
        POST /session            POST /session-with-context
              ↓                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  HealthYoda Backend                         │
├─────────────────────────────────────────────────────────────┤
│  Endpoint 1: /session                                       │
│  - No RAG context                                           │
│  - Generic instructions                                     │
│                                                             │
│  Endpoint 2: /session-with-context                          │
│  - Receives: userMessage                                    │
│  - Calls: RAG service with query                            │
│  - Receives: Medical framework                              │
│  - Injects: Into system instructions                        │
│  - Creates: NEW session with context                        │
└────────────────┬──────────────────────────────────────────────┘
                 ↓
    ┌────────────────────────────┐
    │ AWS RAG Service (Port 3000)│
    ├────────────────────────────┤
    │ - FAISS Vector Search      │
    │ - handbook.txt (7 chunks)  │
    │ - Returns framework + cues │
    └────────────────────────────┘
                 ↓
    ┌────────────────────────────┐
    │   OpenAI Realtime API      │
    ├────────────────────────────┤
    │ Phase 1: Generic mode      │
    │ Phase 2: RAG-enhanced mode │
    │ Generates optimal Q&A      │
    └────────────────────────────┘
```

## Example Conversation Flow

```
1. User: Clicks "Start"
   Backend: POST /session (no message)
   OpenAI: "Hello! I'm HealthYoda. How can I help you?"

2. User: "I have chest pain"
   Frontend: Detects first user message
   Backend: POST /session-with-context
   Backend → RAG: Query "I have chest pain"

   RAG Returns:
   ┌─────────────────────────────────────────────────┐
   │ Cardiac Assessment Framework                    │
   │ ─────────────────────────────────────────────── │
   │ Chief Complaint: Chest Pain                     │
   │                                                 │
   │ Onset/Duration Questions:                       │
   │ - Sudden onset (minutes)                        │
   │ - Gradual over hours                            │
   │ - Intermittent episodes                         │
   │ - Chronic (>1 month)                            │
   │                                                 │
   │ Quality/Severity Questions:                     │
   │ - Pressure/tightness                            │
   │ - Burning/indigestion-like                      │
   │ - Sharp/stabbing                                │
   │ - Crushing                                      │
   │                                                 │
   │ [... more framework ...]                        │
   └─────────────────────────────────────────────────┘

   Backend → OpenAI: Creates session with above framework
   OpenAI: "Thank you for sharing. When did this chest pain start?
            Was it sudden or did it come on gradually?"

3. User: "It started gradually about 3 days ago"

   RAG: Query "chest pain 3 days gradual onset"
   OpenAI: Uses existing framework to ask next question
   OpenAI: "Can you describe what the pain feels like?
            Is it sharp, pressing, burning, or something else?"

4. [Continues following framework sequence]
   - Quality/Severity
   - Aggravating/Relieving factors
   - Associated Symptoms
   - Red Flags
   - Medical History Context
```

## Key Implementation Details

### Why Two Sessions?

The Realtime API **locks in instructions at session creation**. To get new instructions with RAG context, we need a new session. The frontend handles the transition:

1. Initial session connects and waits
2. User speaks first message
3. Frontend detects this
4. Frontend requests new session WITH context
5. Frontend reconnects to new session
6. Conversation continues naturally

### Session Management

```javascript
// Store metadata for each session
const conversationContexts = new Map();

conversationContexts.set(sessionId, {
  ragContext: "Full framework text",
  userMessage: "Initial symptom",
  sources: ["Cardiac - Chest Pain"],
  transcript: [], // For summary later
});
```

### RAG Context Injection

```javascript
// The RAG context is embedded directly in system instructions:
const instructions = `
You are HealthYoda...

IMPORTANT - MEDICAL KNOWLEDGE FRAMEWORK:
[${ragContext}]

Use this framework to ask evidence-based questions...
`;

// OpenAI sees this as part of the system prompt, not dynamic injection
// This is the KEY DIFFERENCE from traditional chatbots
```

## Testing the Integration

### Test 1: Verify backend RAG call happens

```bash
# Check backend logs while user speaks "chest pain"
tail -f /tmp/backend.log | grep "Creating session with RAG"
```

### Test 2: Verify session creation with context

```bash
curl -X POST http://localhost:3001/session-with-context \
  -H "Content-Type: application/json" \
  -d '{"userMessage": "I have chest pain"}'
# Should return session with ragContext.available = true
```

### Test 3: End-to-end conversation

```
1. Open http://localhost:5173
2. Click "Start Conversation"
3. Say: "I have chest pain"
4. Watch:
   - Session changes (PeerConnection updates)
   - AI asks: "When did this start - sudden or gradual?"
   - This confirms RAG framework is being used
5. Answer naturally
6. Observe: Follow-up questions follow cardiac assessment sequence
```

## Troubleshooting

### Issue: AI asks generic questions, not using framework

**Cause:** `/session-with-context` not being called
**Fix:** Check frontend `useEffect` that detects first user message

### Issue: RAG context says "available: false"

**Cause:** Backend RAG service call failed
**Fix:** Check if RAG service is running:

```bash
curl http://15.206.157.127:3000/health
```

### Issue: Session creation fails

**Cause:** Realtime session quota exceeded
**Fix:** Wait 60 seconds and try again (sessions expire after 1 hour)

## Performance Notes

- ⏱️ Initial session creation: ~200ms
- ⏱️ RAG query: ~300ms
- ⏱️ New session with context: ~500ms
- 🎯 Total reconnection time: <1 second

Users won't notice the session switch as it happens during the initial conversation setup.

## Future Enhancements

1. **Streaming RAG**: Return partial results while user speaks
2. **Context Persistence**: Cache RAG contexts across sessions
3. **Multi-turn RAG**: Update context after each user response
4. **Feedback Loop**: Refine RAG queries based on AI responses
5. **Vector DB**: Replace FAISS with cloud vector DB for scale

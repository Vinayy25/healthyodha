# ⚡ HealthYoda Voice Agent - Quick Reference Card

## 🎯 What Changed (Corrected Implementation)

| What | Was | Now |
|------|-----|-----|
| **Imports** | `from "@openai/agents"` | `from "@openai/agents/realtime"` |
| **Model** | `gpt-4o-realtime-preview-2024-10-01` | `gpt-realtime` |
| **Connection** | `clientSecret` | `apiKey` |
| **Events** | `transcription.updated` | `history_updated` |
| **History IDs** | `id` | `itemId` |

## 🚀 Running

```bash
# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm run dev

# Browser
http://localhost:5173
```

## 🎤 How It Works

1. User speaks
2. RealtimeSession captures audio (WebRTC)
3. OpenAI processes & decides if tools needed
4. If tool needed → Frontend executes → Backend forwards to AWS RAG
5. OpenAI uses result → Generates response → TTS → Audio output

## 📋 Tools Available

| Tool | Purpose | Backend Endpoint |
|------|---------|------------------|
| `get_relevant_questions` | Get medical framework | `/rag` → AWS |
| `generate_medical_summary` | Create medical report | `/summary` → GPT-4o-mini |

## ✨ Features

- ✅ Speech-to-speech (no typing)
- ✅ Real-time tool calling
- ✅ RAG from AWS
- ✅ Auto-summary
- ✅ WebRTC low-latency
- ✅ Interruption handling

## 📊 Architecture

```
Browser (Frontend)
  ↓
RealtimeSession (auto WebRTC)
  ↓
OpenAI (gpt-realtime)
  ↓
Tool Call (if needed)
  ↓
Backend → AWS RAG
  ↓
Response → TTS → Audio
```

## 🔍 Debug (Browser Console F12)

Look for logs:
```
🚀 [INIT] Starting...
✅ [CONNECTED] Ready
📝 [USER] User message
🔍 [TOOL] Tool called
✅ [RAG] Framework retrieved
📝 [ASSISTANT] AI response
📋 [SUMMARY] Report generated
```

## ⚠️ Important

- SDK handles everything (WebRTC, audio, VAD, etc.)
- Tools run in browser (frontend)
- Backend just forwards to AWS RAG
- No manual audio capture needed
- Microphone auto-requested

## 🎯 Expected Flow

1. Click "Start Voice Interview"
2. Grant microphone permission
3. Speak symptom
4. Agent asks structured questions (using RAG)
5. After ~15-20 questions
6. Summary auto-generates
7. Copy to share with doctor

## 📚 Full Docs

- `VOICE_AGENT_CORRECTED.md` - Detailed corrections
- `AGENTS_SDK_QUICK_START.md` - Official quickstart reference
- `IMPLEMENTATION_GUIDE.md` - Full implementation details

---

✅ **All corrected. Ready to test!**

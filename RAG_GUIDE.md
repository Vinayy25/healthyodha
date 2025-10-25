# 🧠 RAG Integration Guide

## What is RAG?

**Retrieval Augmented Generation (RAG)** enhances the AI assistant by:

- Retrieving relevant medical knowledge from your handbook
- Providing evidence-based question frameworks
- Ensuring comprehensive history-taking based on medical guidelines

## 🎯 How It Works

```
User mentions symptom (e.g., "chest pain")
          ↓
Frontend detects keyword
          ↓
Backend queries RAG service
          ↓
RAG searches handbook with embeddings
          ↓
Returns relevant frameworks
          ↓
Displayed alongside conversation
          ↓
Assistant uses context for better questions
```

## 📚 Data Preparation

Your `handbook.txt` is **already prepared**! It contains:

✅ System-wise organization (Cardiac, Respiratory, etc.)  
✅ Symptom-specific frameworks  
✅ Structured questions with possible answers  
✅ Red flags and context information

### Current Structure:

```
Cardiac System
  ├── Chest Pain
  │   ├── Chief Complaint
  │   ├── Onset/Duration
  │   ├── Quality/Severity
  │   ├── Aggravating/Relieving
  │   ├── Associated Symptoms
  │   ├── Red Flags
  │   ├── ROS
  │   └── Context
  └── Palpitations
      └── [same structure]
```

The RAG service automatically:

- Chunks by symptom/condition
- Preserves the question framework
- Maintains metadata (system, symptom)
- Creates semantic embeddings

## 🚀 Setup & Usage

### Step 1: Install RAG Service

```bash
cd rag_service
./setup.sh
```

This creates a Python virtual environment and installs dependencies.

### Step 2: Start Services (3 terminals)

**Terminal 1 - RAG Service:**

```bash
cd rag_service
./run.sh
```

**Terminal 2 - Backend:**

```bash
cd backend
npm start
```

**Terminal 3 - Frontend:**

```bash
cd frontend
npm run dev
```

### Step 3: Enable RAG in UI

1. Open `http://localhost:5173`
2. Check **"Enable Medical Knowledge Enhancement (RAG)"**
3. Click **"Start Conversation"**

### Step 4: Test It!

Say any of these phrases:

- "I have chest pain"
- "I've been having headaches"
- "I feel dizzy and nauseous"
- "My heart is racing"

Watch the **Medical Knowledge Context** panel appear on the right!

## 🎨 User Interface

### RAG Toggle

Before starting, you can enable/disable RAG enhancement.

### RAG Badge

When connected with RAG enabled, you'll see: 🧠 RAG Enabled

### Medical Knowledge Panel

- **Sources**: Which medical frameworks were retrieved
- **Context**: Detailed questions and possible answers
- **Note**: Explains how it helps the assistant

## 🔍 How RAG Triggers

### Automatic Detection (Default)

RAG automatically activates when users mention:

- pain, chest, headache, dizzy, nausea, vomit
- fever, cough, breath, palpitation, syncope, faint
- swelling, edema, claudication, tired, fatigue
- heart, lung, stomach, abdomen

### Manual Enhancement

You can also manually trigger RAG by modifying the code to:

- Always retrieve context
- Use buttons to fetch specific topics
- Integrate with voice commands

## 🔧 Customization

### Adjust Retrieval (frontend/src/App.tsx)

```typescript
// Change number of chunks retrieved
const response = await axios.post("http://localhost:3001/rag", {
  query,
  k: 3, // Increase for more context
});
```

### Modify Keywords (frontend/src/App.tsx)

```typescript
const symptomKeywords = [
  "pain",
  "chest",
  "headache", // Add more keywords
  "your",
  "custom",
  "keywords",
];
```

### Change Chunking Strategy (rag_service/main.py)

```python
# Modify chunk size
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,  # Increase for larger chunks
    chunk_overlap=200,  # More overlap = more context
)
```

## 📊 Testing RAG

### Test 1: Check RAG Service Health

```bash
curl http://localhost:8000/health
```

Expected:

```json
{
  "status": "healthy",
  "chunks_loaded": 42,
  "ready": true
}
```

### Test 2: Direct RAG Query

```bash
curl -X POST http://localhost:8000/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "chest pain symptoms", "k": 2}'
```

### Test 3: Through Backend

```bash
curl -X POST http://localhost:3001/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "palpitations"}'
```

### Test 4: Full System Test

1. Start all services
2. Enable RAG in UI
3. Start conversation
4. Say "I have chest pain"
5. Check:
   - Console shows: "🔍 Fetching RAG context"
   - Medical Knowledge panel appears
   - Context shows Chest Pain framework

## 🎯 Benefits

### For Patients:

- More thorough questioning
- Evidence-based assessment
- Comprehensive symptom exploration

### For Healthcare Providers:

- Standardized history-taking
- Reduced information gaps
- Framework-driven interviews

### For the System:

- Scalable knowledge base
- Easy to update medical guidelines
- Contextual AI responses

## 🐛 Troubleshooting

### RAG panel doesn't appear

- Check RAG service is running (Terminal 1)
- Verify checkbox is enabled
- Check browser console for errors
- Look for keywords in your speech

### "RAG service not available" error

```bash
# Check if RAG service is running
curl http://localhost:8000/health

# If not, start it
cd rag_service
./run.sh
```

### Empty/Poor context

- Check handbook.txt exists
- Verify RAG service loaded chunks (check logs)
- Try more specific symptom keywords

### Slow retrieval

- First query is slower (loading embeddings)
- Subsequent queries are fast
- Consider caching (future enhancement)

## 📈 Advanced Topics

### Adding More Knowledge

To add more medical content:

1. Edit `handbook.txt`
2. Follow the existing structure
3. Restart RAG service
4. New content automatically indexed

### Multiple Knowledge Bases

Future enhancement to support:

- Different specialties
- Treatment protocols
- Drug information
- Diagnostic criteria

### Improving Retrieval

Consider implementing:

- **Query rewriting**: Expand user query before search
- **Hybrid search**: Combine keyword + semantic search
- **Re-ranking**: Score and re-order results
- **Metadata filtering**: Filter by system/specialty

## 📚 Further Reading

- [LangChain Documentation](https://python.langchain.com/)
- [FAISS Documentation](https://faiss.ai/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

## 💡 Tips

1. **Start simple**: Test with RAG disabled first, then enable
2. **Monitor logs**: Watch all 3 terminals for errors
3. **Iterate**: Try different symptoms and see what context appears
4. **Customize**: Adjust keywords and chunk size for your use case
5. **Feedback loop**: Note when RAG helps vs. when it doesn't

## 🎓 Example Session

```
You: "I've been having chest pain for the last two days"

[RAG automatically triggers]

Medical Knowledge Panel shows:
- Source: Cardiac - Chest Pain
- Questions about:
  * Onset and duration
  * Quality (pressure, stabbing, burning)
  * Aggravating factors (exertion, lying down)
  * Associated symptoms (sweating, SOB)
  * Red flags (syncope, tearing pain)
```

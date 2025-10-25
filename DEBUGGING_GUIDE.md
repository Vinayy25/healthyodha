# 🐛 Debugging Guide

## **Issue: RAG Calls Not Happening During Conversation**

### Step 1: Open Browser Console

1. Open the app at `http://localhost:5173`
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Look for logs starting with 🔍

### Step 2: Start Conversation and Monitor Logs

You should see these logs in order:

```
RAG Effect triggered - connected: false
Not connected, skipping RAG
(after connection)
RAG Effect triggered - connected: true
transcripts: 0
No user transcripts yet
(after you speak)
RAG Effect triggered - connected: true
transcripts: 1
Last user message: "I have chest pain"
Debounce timeout fired, fetching RAG
🔍 Fetching RAG context for: I have chest pain
✅ RAG context retrieved: ["Cardiac - Chest Pain", ...]
```

### Step 3: What Each Log Means

| Log                           | Meaning                                |
| ----------------------------- | -------------------------------------- |
| `RAG Effect triggered`        | Frontend is checking for RAG updates   |
| `Not connected, skipping RAG` | WebRTC not ready yet                   |
| `No user transcripts yet`     | Waiting for patient to speak           |
| `Last user message:`          | Found your message, about to fetch RAG |
| `Debounce timeout fired`      | 500ms passed, fetching knowledge       |
| `🔍 Fetching RAG context`     | Making API call to backend             |
| `✅ RAG context retrieved`    | Success! Medical framework loaded      |

### Step 4: Verify Backend Logs

Check your backend terminal (Terminal 2). You should see:

```
🔍 RAG Query: "I have chest pain"
✅ Retrieved 2 relevant chunks
```

### Step 5: Verify RAG Service Logs

Check RAG terminal (Terminal 1). You should see:

```
INFO:     127.0.0.1:xxxx - "POST /rag HTTP/1.1" 200 OK
```

---

## **Issue: Summary Generation Stuck**

### What to Look For in Browser Console

```
📋 Generating medical summary from X messages...
✅ Summary response received: { summary: "...", ... }
✅ Medical summary generated
```

If stuck, you'll see:

```
⏱️ Conversation ended - generating summary...
(then nothing happens)
```

### Troubleshooting Steps

#### 1. Check Backend is Running

```bash
curl http://localhost:3001/summary
# Should return 400 (missing body, which is fine)
```

#### 2. Test Summary Manually

```bash
curl -X POST http://localhost:3001/summary \
  -H "Content-Type: application/json" \
  -d '{
    "transcripts": [
      {"role": "user", "text": "I have chest pain"},
      {"role": "assistant", "text": "How long?"}
    ]
  }'
```

You should get a professional summary back in ~3-5 seconds.

#### 3. Check Browser Network Tab

In F12, go to **Network** tab:

1. End conversation (say "goodbye")
2. Look for POST request to `/summary`
3. Click it, go to **Response** tab
4. Should see the summary text

---

## **Common Issues & Solutions**

### Issue: "RAG Effect triggered" but "Fetching RAG context" never appears

**Cause:** Debounce timer not firing or API call not made  
**Fix:**

```typescript
// Add in console
// The debounce should fire after 500ms
// Check browser Network tab to see if POST to /summary was made
```

### Issue: "⏱️ Conversation ended" but summary never generates

**Cause:** Summary endpoint failing or OpenAI API issue  
**Fix:**

1. Check backend logs for error messages
2. Verify OPENAI_API_KEY in `.env`
3. Test endpoint manually (see above)

### Issue: "No user transcripts yet" keeps appearing

**Cause:** Microphone not capturing audio  
**Fix:**

1. Check browser microphone permissions
2. Try refreshing page
3. Make sure no other app is using mic

---

## **Full Debug Checklist**

Before testing, verify:

- [ ] All 3 services running (RAG, Backend, Frontend)
- [ ] OPENAI_API_KEY in `.env`
- [ ] Microphone working
- [ ] Browser console open (F12)
- [ ] Network tab watching for API calls

Test sequence:

1. **Start conversation** → Check logs
2. **Speak any text** → Look for "Last user message"
3. **Wait 1 second** → Look for "🔍 Fetching RAG context"
4. **End with "goodbye"** → Look for "🏁 Conversation ending detected"
5. **Wait 2 seconds** → Look for summary response

---

## **Log All Console Messages to File**

Copy-paste this in browser console to save logs:

```javascript
const logs = [];
const originalLog = console.log;
console.log = function (...args) {
  logs.push(args.join(" "));
  originalLog.apply(console, args);
};
// ... have your conversation ...
// Then run:
copy(logs.join("\n"));
// Paste in editor
```

---

## **Emergency Reset**

If everything is stuck:

1. Kill all processes: `pkill -f "npm|node|uvicorn"`
2. Start fresh:
   - Terminal 1: `cd rag_service && ./run.sh`
   - Terminal 2: `cd backend && npm start`
   - Terminal 3: `cd frontend && npm run dev`
3. Refresh browser: `Ctrl+Shift+R` (hard refresh)
4. Open console and test again

---

## **Expected Console Output**

### Working Scenario:

```
RAG Effect triggered - connected: true
Last user message: "I have chest pain"
Debounce timeout fired, fetching RAG
🔍 Fetching RAG context for: I have chest pain
✅ RAG context retrieved: ["Cardiac - Chest Pain"]
...
🏁 Conversation ending detected!
Auto-generating summary now...
📋 Generating medical summary from 4 messages...
✅ Summary response received: { summary: "...", transcripts_count: 4, generated_at: "..." }
✅ Medical summary generated
```

If you see all these logs, **everything is working!** 🎉

---

## **Report an Issue**

When asking for help, include:

1. Screenshot of browser console logs
2. Backend terminal output
3. RAG service terminal output
4. What you said to the assistant
5. When it stopped working (after what message?)

**Debugging with logs is 90% of the solution!** 🔍

# 🔧 System Prompt Fix - Tool Calls & Conversation Length

## What Changed

### Before ❌
- "Call get_relevant_questions **when you need guidance**" → Optional
- 12-20 questions recommended → Long conversations
- Vague end trigger → Could go on forever
- Only 1 tool call per conversation → Barely using RAG

### After ✅
- "You **MUST call** get_relevant_questions **AFTER EVERY patient response**" → Mandatory
- 5-8 questions MAXIMUM → Quick and efficient
- Clear checklist → Ends after summary call
- Tool call per question → Maximum RAG usage

---

## Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Tool Calling | Optional ("when you need") | Mandatory ("MUST call") |
| When to Call | Vague | After EVERY patient response |
| Question Count | 12-20 | 5-8 maximum |
| Conversation Length | Long/Open-ended | Quick (5 min max) |
| End Trigger | Vague | Clear checklist |
| RAG Usage | 1 call | Multiple calls |

---

## New System Prompt Structure

### 1. CRITICAL REQUIREMENT
```
You MUST call the get_relevant_questions tool AFTER EVERY patient response.
- After user speaks, immediately acknowledge and call get_relevant_questions
- Use the returned framework to ask your next question
- Do NOT skip tool calls
```

### 2. Specific Tool Instructions
```
ALWAYS:
1. Acknowledge what patient said
2. Call get_relevant_questions tool with symptom
3. Wait for framework
4. Ask ONE targeted question from framework
5. Listen to answer
6. Repeat or generate summary

NEVER:
- Skip tool calls
- Ask multiple questions at once
- Go beyond 6-8 total questions
- Have long conversations
```

### 3. Interview Flow (5-8 questions total)
```
Q1: Chief complaint
Q2: Duration/onset (+ tool call)
Q3: Severity/quality (+ tool call)
Q4: Associated symptoms (+ tool call)
Q5: Red flags/impact (+ tool call)
Q6: Medical history if relevant (+ tool call)
→ Then: Generate summary and END
```

### 4. Clear End Triggers
```
After 5-8 questions asked
AND have: chief complaint, onset, severity, key symptoms, red flags
THEN: Call generate_medical_summary and END

Do NOT need complete medical history - just quick screening.
Doctor can ask more detailed questions later.
```

---

## Expected Conversation Pattern (NEW)

```
User: "I have a headache"
AI: [Calls tool] "When did this start?"

User: "This morning"
AI: [Calls tool] "Is it throbbing or constant?"

User: "Throbbing with light sensitivity"
AI: [Calls tool] "Any other symptoms?"

User: "Just nausea"
AI: [Calls tool] "Any recent head injury or fever?"

User: "No injuries, no fever"
AI: [Calls tool for framework] "Any stress or medication changes?"

User: "High stress lately"
AI: [Calls generate_medical_summary] "I've compiled your information for your doctor"
[Summary displays]
[Conversation ends]

Total: 6 exchanges, all with tool calls
```

---

## Expected Logs

```
📝 [USER] I have a headache
🔍 [TOOL] Retrieving medical framework for: "headache"
✅ [RAG] Retrieved 2 chunks
📝 [ASSISTANT] When did this start?

📝 [USER] This morning
🔍 [TOOL] Retrieving medical framework for: "headache"
✅ [RAG] Retrieved 2 chunks
📝 [ASSISTANT] Is it throbbing or constant?

[... pattern continues ...]

After 5-6 exchanges:
📋 [TOOL] Generating medical summary
✅ [SUMMARY] Generated successfully
```

---

## Testing Checklist

- [ ] Tool called after EACH user message (check logs: 🔍 [TOOL])
- [ ] Multiple tool calls in conversation (not just one)
- [ ] Conversation ends after ~5-8 questions
- [ ] Summary auto-generates
- [ ] Questions are concise
- [ ] Agent acknowledges before tool call
- [ ] Framework is used to guide questions

---

## File Changed

**frontend/src/App.tsx** (lines 146-182)
- Old instructions removed
- New instructions with mandatory tool calling
- Clear structure and rules
- Explicit end triggers

---

## Result

✅ Tool calls for EVERY question
✅ Conversations end in 5-8 exchanges
✅ Quick, efficient (5 min max)
✅ Clear flow and structure
✅ Maximum RAG usage
✅ Better user experience

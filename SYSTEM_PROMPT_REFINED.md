# System Prompt Update - Refined Medical Intake Instructions

## Overview

The system prompt for HealthYoda has been updated with production-grade, refined medical intake instructions. This update applies to both the frontend (RealtimeAgent) and backend (buildSystemInstructions) to ensure consistent behavior across all components.

**Date**: October 26, 2025  
**Status**: ✅ Complete, No Linting Errors  
**Impact**: Improved structure, safety, and user experience

---

## What Changed

### Files Updated

1. **`backend/server.js`** (Lines 43-140)

   - Function: `buildSystemInstructions(ragContext)`
   - Complete replacement of system instructions
   - RAG context integration preserved

2. **`frontend/src/App.tsx`** (Lines 184-295)
   - RealtimeAgent `instructions` parameter
   - Complete replacement of system instructions
   - Tool calling integration maintained

---

## Key Improvements

### 1. Clear Role & Objective

```
You are **HealthYoda**, a compassionate, professional **medical intake assistant**.
SUCCESS = high‑quality history + clear red‑flag detection + calm escalation when needed.
YOU DO NOT DIAGNOSE. YOU DO NOT PRESCRIBE. YOU STAY IN SCOPE.
```

**Why**: Sets clear boundaries and success criteria upfront.

---

### 2. Structured Conversation Flow (State Machine)

```
Greeting → Consent & Expectation → Chief Complaint → IMMEDIATE SAFETY SCREEN →
Focused History (structured) → Targeted ROS → Relevant Context →
Impact on daily life → Wrap‑up → Summary signal
```

**Before**: Generic flow with no clear stages  
**After**: Explicit state machine with defined transitions

---

### 3. Immediate Safety Screen

```markdown
## Immediate Safety Screen (run right after you hear the complaint)

- Ask concise red‑flag checks relevant to the symptom
- IF ANY RED FLAG IS CONFIRMED → say: "Your symptoms could be serious.
  Please seek emergency care now."
```

**Why**: Prioritizes patient safety, catches emergencies early.

---

### 4. Focused History (6-Step Sequence)

```
1) Onset/Duration (when it started; constant vs intermittent)
2) Quality/Severity (what it feels like; severity 1–10)
3) Aggravating/Relieving (what makes it worse/better)
4) Associated Symptoms
5) Red Flags (brief screen)
6) Context (PMH: CAD/HTN/DM; meds; allergies; smoking; family history)
```

**Why**: Ensures comprehensive, systematic history-taking.

---

### 5. Tool Calling Guidelines

#### Tool Preamble (MANDATORY)

```
BEFORE ANY TOOL CALL, SAY ONE SHORT LINE:
- "Let me check my clinical guide."
- "I'm pulling the next best questions."
- "I'll look up what to ask next."
```

**Why**: Improves transparency and user trust.

#### When to Call `get_relevant_questions`

```
CALL THIS TOOL TO STAY STRUCTURED AND ON‑TOPIC:
- At the start of a new chief complaint or new major symptom
- When you don't know the most appropriate next question
- After you detect or rule out a red flag
- When the patient's answers are ambiguous or conflicting
- If you've asked 2–3 questions without consulting the guide

AVOID over‑calling: do not call more than once per 2 questions
```

**Before**: Vague "call after every response"  
**After**: Specific triggers, avoids over-calling

---

### 6. Memory & State Management

```markdown
# Memory & State

- Maintain a running case state: {chief_complaint, onset, duration,
  quality, severity, aggravating, relieving, associated_symptoms,
  red_flags, ros, context}
- DO NOT re‑ask what you already captured
- Confirm instead: "You mentioned it's worse with exertion—still true today?"
```

**Why**: Avoids redundant questions, improves patient experience.

---

### 7. Edge Case Handling

```markdown
# Handling unclear audio or missing info

- If audio is unclear: ask a brief clarification
- If user goes off topic: gently bring them back

# Out‑of‑scope deflection

- If asked for diagnosis/treatment: "I'm not a doctor and can't provide
  diagnosis or treatment. My role is to gather details for your clinician."
- If asked unrelated questions: "I'm focused on your medical intake today."
```

**Why**: Professional handling of common issues.

---

### 8. Safety & Escalation (MANDATORY)

```markdown
If severe or worsening chest pain, syncope, signs of shock,
severe breathing difficulty, or tearing back pain:

- Say: "Your symptoms may be serious. Please seek emergency care now."
- Offer to end the session and notify staff if available.
```

**Why**: Clear escalation protocol for emergencies.

---

### 9. Pacing Strategies

```markdown
# Pacing for long conversations

- Every ~6–8 questions, give a "progress check":
  "I'm about halfway through the intake—okay to continue?"
- If the patient sounds tired or distressed, shorten further and move to wrap‑up.
```

**Why**: Patient-centered, adaptable interview length.

---

### 10. Language Flexibility

```markdown
# Language

- Mirror the patient's language if intelligible; otherwise default to English.
- Use plain, non‑jargon words.
```

**Before**: English-only mandate  
**After**: Flexible, patient-centered approach

---

## Prompt Structure

### Old Prompt (~30 lines)

```
Basic personality guidelines
General question structure
Simple red flag mention
Basic RAG integration
```

### New Prompt (~110 lines)

```
# Role & Objective
# Personality & Tone
# Language
# Scope & Guardrails (MANDATORY)
# Conversation Flow (state machine)
  ## Greeting
  ## Immediate Safety Screen
  ## Focused History (6-step sequence)
  ## Targeted ROS
  ## Impact
  ## Wrap-up
# Memory & State
# Handling unclear audio or missing info
# Variety
# Pacing for long conversations
# Tools (function calling)
  ## Tool Preamble (MANDATORY)
  ## get_relevant_questions — WHEN & HOW
  ## generate_medical_summary — WHEN & HOW
# Out-of-scope deflection (script)
# Safety & Escalation (MANDATORY)
# Closing
```

---

## Expected Behavior Changes

### Before ❌

- Generic questioning
- Less structured flow
- Inconsistent tool usage
- No explicit red flag protocol
- Might ask too many or too few questions
- No tool preambles
- No progress checks

### After ✅

- Structured state machine flow
- Immediate safety screen after chief complaint
- Tool preambles ("Let me check my clinical guide...")
- Controlled tool calling (once per 2 questions)
- Clear 6-10 question target
- Progress checks every 6-8 questions
- Explicit emergency escalation
- Scripted deflection for out-of-scope
- Professional medical intake experience

---

## Technical Implementation

### Backend (`server.js`)

```javascript
function buildSystemInstructions(ragContext = null) {
  let instructions = `# Role & Objective
You are **HealthYoda**, a compassionate, professional **medical intake assistant**.
...`;

  if (ragContext) {
    instructions += `
# MEDICAL KNOWLEDGE FRAMEWORK (from handbook_query)
You have access to the following medical knowledge framework...
${ragContext}
...`;
  }

  instructions += `
# Out‑of‑scope deflection (script)
...
# Safety & Escalation (MANDATORY)
...
# Closing
...`;

  return instructions;
}
```

**Key Points**:

- RAG context injection preserved (line 114-121)
- Used by `/session-with-context` endpoint
- Maintains backwards compatibility

### Frontend (`App.tsx`)

```typescript
const agent = new RealtimeAgent({
  name: "HealthYoda Medical Assistant",
  instructions: `# Role & Objective
You are **HealthYoda**, a compassionate, professional **medical intake assistant**.
...
# Tools (function calling)
You have access to **get_relevant_questions** (handbook_query/RAG) 
and **generate_medical_summary** (finalize_summary).
...`,
  tools: [getRelevantQuestions, generateMedicalSummary],
});
```

**Key Points**:

- Tool names mapped correctly
- Fallback handling for summary tool
- Maintains existing tool integration

---

## Testing Checklist

### 1. Normal Interview Flow

- [ ] Greeting → Chief complaint → Safety screen → Focused history
- [ ] Tool preamble before each tool call ("Let me check my clinical guide")
- [ ] One question at a time
- [ ] Progress check at 6-8 questions
- [ ] Summary generation at end

### 2. Red Flag Scenario

- [ ] Patient mentions chest pain
- [ ] AI immediately asks safety questions (syncope, radiation, etc.)
- [ ] If confirmed → "Please seek emergency care now"
- [ ] Offers to end session

### 3. Tool Calling

- [ ] AI announces before calling tool
- [ ] Calls `get_relevant_questions` with symptom
- [ ] Uses returned framework for next question
- [ ] Doesn't over-call (max once per 2 questions)

### 4. Out-of-Scope Requests

- [ ] Patient asks: "Is this a heart attack?"
- [ ] AI deflects with script: "I'm not a doctor and can't provide diagnosis..."
- [ ] Refocuses on intake questions

### 5. Edge Cases

- [ ] Unclear audio → asks for clarification
- [ ] Off-topic → gentle redirect
- [ ] Patient tired → shortens interview
- [ ] Emergency keywords → escalation

### 6. Memory & State

- [ ] Doesn't re-ask captured information
- [ ] Confirms instead: "You mentioned X—still true?"
- [ ] Maintains running case state

### 7. Pacing

- [ ] Progress check every 6-8 questions
- [ ] Shortens if patient distressed
- [ ] Variety in acknowledgments ("Got it," "Thanks," "Understood")

---

## Deployment

### Vercel (Auto-Deploy)

```bash
git add backend/server.js frontend/src/App.tsx
git commit -m "Update system prompt with refined medical intake instructions"
git push
```

### Local Testing

```bash
# Backend
cd backend
node server.js

# Frontend
cd frontend
npm run dev
```

### EC2 (Manual Deploy)

```bash
# Upload backend
scp -i mahe-server.pem backend/server.js ubuntu@15.206.157.127:~/healthyodha/backend/

# SSH and restart
ssh -i mahe-server.pem ubuntu@15.206.157.127
tmux attach -t backend
# Ctrl+C to stop, then: node server.js
```

---

## Verification

✅ **Code Quality**

- No linting errors
- Backwards compatible
- Same tool names/structure

✅ **Consistency**

- Backend and frontend prompts aligned
- RAG integration preserved
- Tool calling logic maintained

✅ **Documentation**

- This file documents all changes
- Testing checklist provided
- Deployment instructions clear

---

## Key Sections to Remember

### 1. Immediate Safety Screen

**When**: RIGHT AFTER chief complaint  
**Purpose**: Early emergency detection  
**Action**: If confirmed → escalate immediately

### 2. Tool Preamble

**Format**: "Let me check my clinical guide."  
**Purpose**: User transparency  
**Requirement**: BEFORE every tool call

### 3. Tool Calling Strategy

**WHEN**:

- New symptom
- Ambiguity
- After red flag
- Every 2-3 questions

**AVOID**: Over-calling (max once per 2 questions)

### 4. Memory & State

**Track**:

```
{
  chief_complaint,
  onset,
  duration,
  quality,
  severity,
  aggravating,
  relieving,
  associated_symptoms,
  red_flags,
  ros,
  context
}
```

**DON'T**: Re-ask what's already captured

### 5. Emergency Escalation

**Triggers**:

- Severe chest pain
- Syncope
- Signs of shock
- Severe shortness of breath
- Tearing back pain

**Response**: "Please seek emergency care now"  
**Follow-up**: Offer to end session

---

## Benefits

### For Patients

✅ More structured, professional experience  
✅ Clear safety prioritization  
✅ Concise, focused questions  
✅ Transparency in process (tool preambles)  
✅ Flexible language support

### For Clinicians

✅ More complete, systematic histories  
✅ Red flags highlighted  
✅ Structured format (easier to review)  
✅ Emergency escalations documented  
✅ Context preserved (memory & state)

### For Development

✅ Clear behavior specification  
✅ Easier debugging (explicit states)  
✅ Consistent experience across sessions  
✅ Maintainable prompt structure  
✅ Testable criteria

---

## Next Steps

1. **Deploy** to production (Vercel or EC2)
2. **Test** using the checklist above
3. **Monitor** for:
   - Tool calling frequency
   - Interview length (target: 6-10 questions)
   - Emergency escalations
   - Patient feedback
4. **Iterate** based on real usage patterns

---

## Support

For issues or questions:

1. Check logs for tool calling patterns
2. Review transcript for prompt adherence
3. Test edge cases from checklist
4. Refer to this document for expected behavior

---

**Last Updated**: October 26, 2025  
**Version**: 2.0 (Refined Medical Intake)  
**Status**: ✅ Production Ready

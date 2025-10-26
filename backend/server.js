import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const app = express();

// CORS configuration - allow all origins for now
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:3000";
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime";
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "gpt-4o-mini";
const PORT = process.env.PORT || 3001;

console.log("📋 Configuration:");
console.log(`   OPENAI_API_KEY: ${OPENAI_API_KEY ? "✅ Set" : "❌ Missing"}`);
console.log(`   RAG_SERVICE_URL: ${RAG_SERVICE_URL}`);
console.log(`   REALTIME_MODEL: ${REALTIME_MODEL}`);
console.log(`   SUMMARY_MODEL: ${SUMMARY_MODEL}`);
console.log(`   PORT: ${PORT}`);

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not found in environment variables");
  process.exit(1);
}

// Store conversation context for each session
const conversationContexts = new Map();

// Helper function to build system instructions with RAG context
function buildSystemInstructions(ragContext = null) {
  let instructions = `# Role & Objective
You are **HealthYoda**, a compassionate, professional **medical intake assistant**.
Your job is to **interview patients** and capture a thorough, structured history **before a clinician visit**.
SUCCESS = high‑quality history + clear red‑flag detection + calm escalation when needed.
YOU DO NOT DIAGNOSE. YOU DO NOT PRESCRIBE. YOU STAY IN SCOPE.

# Personality & Tone
- Warm, calm, respectful; never fawning.
- 1–2 sentences per turn. One question at a time. Pause for answers.
- Reflect back key details briefly ("Got it—you've had sharp chest pain for two days.").

# Language
- Mirror the patient's language if intelligible; otherwise default to English.
- Use plain, non‑jargon words. If you must use a clinical term, explain it simply.

# Scope & Guardrails (MANDATORY)
- DO NOT give diagnoses, probabilities, or treatment plans.
- DO NOT answer general medical "what drug should I take" or "is this a heart attack?" → say you're an intake assistant and refocus on questions.
- IF EMERGENCY RED FLAGS ARE PRESENT → ADVISE IMMEDIATE MEDICAL ATTENTION AND OFFER TO END THE SESSION.
- Privacy: do not repeat sensitive details unnecessarily; do not ask for SSN/insurance/addresses unless explicitly instructed.

# Conversation Flow (state machine)
Greeting → Consent & Expectation → Chief Complaint → IMMEDIATE SAFETY SCREEN → Focused History (structured) → Targeted ROS → Relevant Context → Impact on daily life → Wrap‑up → Summary signal.

## Greeting
- Sample: "Hi, I'm HealthYoda, an intake assistant helping your doctor prepare. I'll ask a few questions to understand what you're experiencing."
- Ask: "What brings you in today?"

## Immediate Safety Screen (run right after you hear the complaint)
- Ask concise red‑flag checks relevant to the symptom (e.g., chest pain + syncope, severe shortness of breath, shock, tearing pain to back).
- IF ANY RED FLAG IS CONFIRMED → say: "Your symptoms could be serious. Please seek emergency care now. I can stop here so a clinician can help immediately."
- Then stop unless the patient insists to continue, in which case keep it minimal.

## Focused History (use structured sequence)
- Follow this sequence for each active concern:
  1) **Onset/Duration** (when it started; constant vs intermittent)
  2) **Quality/Severity** (what it feels like; severity 1–10)
  3) **Aggravating/Relieving** (what makes it worse/better)
  4) **Associated Symptoms**
  5) **Red Flags** (brief screen)
  6) **Context** (PMH: CAD/HTN/DM; meds; allergies; smoking; family history)
- Ask naturally. Keep each question specific and short.

## Targeted ROS (brief)
- Ask 2–4 most relevant review‑of‑systems items based on the chief complaint and what was already said.

## Impact
- "How is this affecting your day—sleep, work, walking, or stairs?"

## Wrap‑up
- "Anything else? What worries you most?"
- Then call the summary tool (see Tools → finalize_summary) and stop.

# Memory & State
- Maintain a running case state: {chief_complaint, onset, duration, quality, severity, aggravating, relieving, associated_symptoms, red_flags, ros, context}.
- DO NOT re‑ask what you already captured; confirm instead ("You mentioned it's worse with exertion—still true today?").

# Handling unclear audio or missing info
- If audio is unclear/partial/noisy/silent or you're unsure: ask a brief clarification ("Sorry, I didn't catch that—could you repeat the last part?").
- If the user goes off topic: gently bring them back ("I'll make sure to note that. First, may I ask about the timing of your pain?").

# Variety
- Avoid repeating the same sentence. Vary openings: "Got it," "Thanks for sharing," "Understood."

# Pacing for long conversations
- Every ~6–8 questions, give a "progress check": "I'm about halfway through the intake—okay to continue?"
- If the patient sounds tired or distressed, shorten further and move to wrap‑up.`;

  if (ragContext) {
    instructions += `

# MEDICAL KNOWLEDGE FRAMEWORK (from handbook_query)
You have access to the following medical knowledge framework that you MUST use to guide your questions:

${ragContext}

Use this framework to ask evidence-based, medically appropriate follow-up questions following the structured sequence above.`;
  }

  instructions += `

# Out‑of‑scope deflection (script)
- If asked for diagnosis/treatment: "I'm not a doctor and can't provide diagnosis or treatment. My role is to gather details for your clinician. May I ask about {next_field}?"
- If asked unrelated questions (e.g., news, billing): "I'm focused on your medical intake today, so I won't be able to help with that. May I continue with your symptoms?"

# Safety & Escalation (MANDATORY)
- If severe or worsening chest pain, syncope, signs of shock, severe breathing difficulty, or tearing back pain:
  - Say: "Your symptoms may be serious. Please **seek emergency care now**."
  - Offer to end the session and notify staff if available.
- If 3 consecutive "no‑match/unclear" responses or the user asks for a human: offer escalation or wrap‑up.

# Closing
- End with: "Thanks—I've prepared a summary for your clinician."`;

  return instructions;
}

// Regular session endpoint (initial greeting only)
app.get("/session", async (req, res) => {
  try {
    console.log("🔑 [SESSION] Requesting ephemeral token from OpenAI");

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: REALTIME_MODEL,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ [SESSION ERROR]:", error);
      return res
        .status(response.status)
        .json({ error: "Failed to get session token" });
    }

    const data = await response.json();
    console.log("✅ [SESSION] Ephemeral token received");

    res.json({
      client_secret: {
        value: data.value,
      },
    });
  } catch (error) {
    console.error("❌ [SESSION ERROR]:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// NEW: Ephemeral token endpoint for Agents SDK
app.get("/client-secret", async (req, res) => {
  try {
    console.log("🔑 Generating ephemeral client secret for Agents SDK");

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: REALTIME_MODEL,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API Error:", error);
      return res
        .status(response.status)
        .json({ error: "Failed to get client secret" });
    }

    const data = await response.json();
    console.log("✅ Ephemeral token generated for Agents SDK");
    res.json({
      client_secret: data.client_secret,
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// NEW: Session endpoint with RAG context (for follow-up conversations)
app.post("/session-with-context", async (req, res) => {
  try {
    const { userMessage } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: "userMessage is required" });
    }

    console.log(`📚 Creating session with RAG context for: "${userMessage}"`);

    // Get RAG context
    const ragResponse = await fetch(`${RAG_SERVICE_URL}/rag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: userMessage, k: 2 }),
    });

    let ragContext = "";
    if (ragResponse.ok) {
      const ragData = await ragResponse.json();
      ragContext = ragData.context || "";
      console.log("✅ RAG context retrieved:", ragData.sources);
    } else {
      console.warn("⚠️  Could not retrieve RAG context, continuing without it");
    }

    // Build instructions with RAG context
    const instructions = buildSystemInstructions(ragContext);

    // Create session with RAG-enhanced instructions
    const sessionResponse = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-realtime-mini-2025-10-06",
          voice: "alloy",
          instructions: instructions,
        }),
      }
    );

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      console.error("OpenAI API Error:", error);
      return res
        .status(sessionResponse.status)
        .json({ error: "Failed to create session" });
    }

    const sessionData = await sessionResponse.json();
    const sessionId = sessionData.client_secret.client_secret;

    // Store context and transcript for this session
    conversationContexts.set(sessionId, {
      ragContext: ragContext,
      userMessage: userMessage,
      sources: ragResponse.ok ? (await ragResponse.json()).sources : [],
      transcript: [],
    });

    console.log("✅ RAG-enhanced session created:", sessionId);
    res.json({
      ...sessionData,
      ragContext: {
        available: ragContext.length > 0,
        sources: conversationContexts.get(sessionId).sources,
      },
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// RAG endpoint - retrieve relevant medical knowledge
app.post("/rag", async (req, res) => {
  try {
    const { query, k = 3 } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log(`🔍 RAG Query: "${query}"`);

    // Call the Python RAG service
    const ragResponse = await fetch(`${RAG_SERVICE_URL}/rag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, k }),
    });

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      console.error("RAG service error:", errorText);
      return res.status(ragResponse.status).json({
        error: "RAG service unavailable",
        details: errorText,
      });
    }

    const ragData = await ragResponse.json();
    console.log(
      `✅ RAG Response: ${ragData.num_chunks} chunks from ${ragData.sources.length} sources`
    );
    res.json(ragData);
  } catch (error) {
    console.error("RAG error:", error);
    res.status(500).json({ error: "RAG service error" });
  }
});

// RAG health check
app.get("/rag/health", async (req, res) => {
  try {
    const healthResponse = await fetch(`${RAG_SERVICE_URL}/health`);
    const data = await healthResponse.json();
    res.json({ status: "connected", ...data });
  } catch (error) {
    res.status(500).json({ status: "disconnected", error: error.message });
  }
});

// Summary endpoint - generates medical report from conversation
app.post("/summary", async (req, res) => {
  try {
    const { transcripts } = req.body;

    if (!transcripts || transcripts.length === 0) {
      return res.status(400).json({ error: "No transcripts provided" });
    }

    // Format conversation for GPT
    const conversationText = transcripts
      .map((t) => `${t.role === "user" ? "Patient" : "Assistant"}: ${t.text}`)
      .join("\n");

    console.log("📋 Generating medical summary...");

    // Call GPT to generate summary
    const summaryResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: SUMMARY_MODEL,
          messages: [
            {
              role: "system",
              content: `You are a medical documentation assistant. Analyze the conversation between a patient and HealthYoda (AI assistant) and generate a professional medical summary in the following format:

**CHIEF COMPLAINT:**
[Summary of main reason for visit]

**HISTORY OF PRESENT ILLNESS:**
- Onset/Duration: [When symptoms started and how long]
- Quality: [Description of symptoms]
- Severity: [1-10 scale or descriptive]
- Aggravating Factors: [What makes it worse]
- Relieving Factors: [What makes it better]
- Associated Symptoms: [Other symptoms mentioned]

**RED FLAGS/CONCERNING SYMPTOMS:**
[Any urgent or serious symptoms mentioned]

**PAST MEDICAL HISTORY/CONTEXT:**
[Any medical history or risk factors mentioned]

**ASSESSMENT & RECOMMENDATIONS:**
[What should be done next - tests, specialist referral, etc.]

Keep it concise, professional, and suitable for a physician's review.`,
            },
            {
              role: "user",
              content: `Please generate a medical summary from this patient conversation:\n\n${conversationText}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    if (!summaryResponse.ok) {
      const error = await summaryResponse.text();
      console.error("OpenAI Summary Error:", error);
      return res
        .status(summaryResponse.status)
        .json({ error: "Failed to generate summary" });
    }

    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices[0].message.content;

    console.log("✅ Medical summary generated successfully");

    res.json({
      summary,
      transcripts_count: transcripts.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Summary endpoint error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ HealthYoda Backend running on port ${PORT}`);
  console.log(`📡 Session endpoint: http://localhost:${PORT}/session`);
});

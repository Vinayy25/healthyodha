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
  let instructions = `You are HealthYoda, a compassionate and professional medical assistant. Your role is to interview patients to gather their medical history in a conversational and empathetic manner.

Guidelines:
- Be warm, patient, and understanding
- Ask one question at a time
- Listen actively and acknowledge patient concerns
- Ask follow-up questions to get detailed information
- Focus on: chief complaint, onset, duration, quality, severity, aggravating/relieving factors, and associated symptoms
- Do NOT provide diagnoses or medical advice
- Do NOT prescribe treatments
- Maintain patient privacy and confidentiality
- If the patient seems to be in distress, advise them to seek immediate medical attention`;

  if (ragContext) {
    instructions += `

IMPORTANT - MEDICAL KNOWLEDGE FRAMEWORK:
You have access to the following medical knowledge framework that you MUST use to guide your questions:

${ragContext}

Use this framework to ask evidence-based, medically appropriate follow-up questions in this specific sequence:
1. Onset/Duration - When did symptoms start? Are they constant or intermittent?
2. Quality/Severity - What does it feel like? How severe (scale 1-10)?
3. Aggravating/Relieving - What makes it better or worse?
4. Associated Symptoms - Any other symptoms present?
5. Red Flags - Any danger signs like chest pain, difficulty breathing, etc.?
6. Context - Medical history relevant to this condition?

Ask questions naturally following this framework. Reference the possible answers to listen for specific details.`;
  }

  instructions += `

Start by greeting the patient warmly and asking how you can help them today.`;

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

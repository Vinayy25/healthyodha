import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:3000";

console.log("📋 Configuration:");
console.log(`   OPENAI_API_KEY: ${OPENAI_API_KEY ? "✅ Set" : "❌ Missing"}`);
console.log(`   RAG_SERVICE_URL: ${RAG_SERVICE_URL}`);

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not found in environment variables");
  process.exit(1);
}

app.post("/session", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-10-01",
          voice: "alloy",
          instructions: `You are HealthYoda, a compassionate and professional medical assistant. Your role is to interview patients to gather their medical history in a conversational and empathetic manner.

Guidelines:
- Be warm, patient, and understanding
- Ask one question at a time
- Listen actively and acknowledge patient concerns
- Ask follow-up questions to get detailed information
- Focus on: chief complaint, onset, duration, quality, severity, aggravating/relieving factors, and associated symptoms
- Do NOT provide diagnoses or medical advice
- Do NOT prescribe treatments
- Maintain patient privacy and confidentiality
- If the patient seems to be in distress, advise them to seek immediate medical attention

IMPORTANT - RAG-ENHANCED FOLLOW-UP QUESTIONS:
- After the patient's first response, EVERY follow-up question should be based on the medical knowledge base provided in the context.
- The context provides evidence-based question frameworks from medical handbooks.
- Use the provided context to ask optimal, medically appropriate follow-up questions.
- Structure your questions following the frameworks: Onset/Duration → Quality/Severity → Aggravating/Relieving → Associated Symptoms → Red Flags.
- Reference the "Possible Answers" in the context to understand what you're listening for.

Start by greeting the patient warmly and asking how you can help them today.`,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API Error:", error);
      return res
        .status(response.status)
        .json({ error: "Failed to create session" });
    }

    const data = await response.json();
    res.json(data);
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
    console.log(`✅ Retrieved ${ragData.num_chunks} relevant chunks`);

    res.json(ragData);
  } catch (error) {
    console.error("RAG endpoint error:", error);

    // Check if RAG service is running
    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "RAG service not running",
        message:
          "Please start the RAG service: cd rag_service && uvicorn main:app --port 3000",
      });
    }

    res.status(500).json({ error: "Failed to retrieve context" });
  }
});

// Check if RAG service is available
app.get("/rag/health", async (req, res) => {
  try {
    const healthResponse = await fetch(`${RAG_SERVICE_URL}/health`);
    const data = await healthResponse.json();
    res.json({ status: "connected", ...data });
  } catch (error) {
    res.status(503).json({
      status: "disconnected",
      message: "RAG service not available",
    });
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
          model: "gpt-4o-mini",
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ HealthYoda Backend running on port ${PORT}`);
  console.log(`📡 Session endpoint: http://localhost:${PORT}/session`);
});

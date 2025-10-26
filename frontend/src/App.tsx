import { useEffect, useState, useRef } from "react";
import { RealtimeAgent, tool, RealtimeSession } from "@openai/agents/realtime";
import { z } from "zod";
import "./App.css";

// Environment configuration
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "https://healthyodha-y754.vercel.app";
const REALTIME_MODEL = import.meta.env.VITE_REALTIME_MODEL || "gpt-realtime";

interface TranscriptItem {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface MedicalSummary {
  summary: string;
  generated_at: string;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>("");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [medicalSummary, setMedicalSummary] = useState<MedicalSummary | null>(
    null
  );
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [conversationEnded, setConversationEnded] = useState(false);

  // NEW: Detailed status tracking
  const [connectionStatus, setConnectionStatus] = useState<string>("Idle");
  const [ragStatus, setRagStatus] = useState<string>("");
  const [ragDetails, setRagDetails] = useState<{
    symptom: string;
    chunks: number;
    sources: string[];
  } | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Define RAG retrieval tool - calls backend which forwards to AWS RAG
  const getRelevantQuestions = tool({
    name: "get_relevant_questions",
    description:
      "Retrieve relevant medical history questions from the handbook based on patient symptoms. This tool queries the medical knowledge base to get evidence-based assessment frameworks.",
    parameters: z.object({
      symptom: z
        .string()
        .describe(
          "The patient's symptom or chief complaint to search in the medical handbook"
        ),
    }),
    async execute({ symptom }) {
      console.log(`🔍 [TOOL] Retrieving medical framework for: "${symptom}"`);
      setRagStatus("Fetching medical framework from backend...");
      try {
        const response = await fetch(`${BACKEND_URL}/rag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: symptom, k: 2 }),
        });

        if (!response.ok) {
          throw new Error(`RAG service error: ${response.status}`);
        }

        const data = await response.json();
        console.log(
          `✅ [RAG] Retrieved ${data.num_chunks} chunks from ${
            data.sources.length
          } sources: ${data.sources.join(", ")}`
        );

        // Update RAG details for display
        setRagDetails({
          symptom,
          chunks: data.num_chunks,
          sources: data.sources,
        });
        setRagStatus(
          `✅ Retrieved ${data.num_chunks} chunks for: "${symptom}"`
        );

        return {
          context: data.context,
          sources: data.sources,
          guidance: `Medical Framework Retrieved:\n\n${data.context}\n\nUse this framework to structure your follow-up questions systematically.`,
        };
      } catch (error) {
        console.error("❌ [RAG ERROR]:", error);
        setRagStatus(`❌ RAG Error: ${error}`);
        return {
          error: `Failed to retrieve medical framework: ${error}`,
          fallback:
            "Continue with standard evidence-based medical history questions focusing on onset, duration, severity, and associated symptoms.",
        };
      }
    },
  });

  // Define summary generation tool
  const generateMedicalSummary = tool({
    name: "generate_medical_summary",
    description:
      "Generate a structured medical summary from the conversation for the doctor. Call this when you have gathered sufficient information.",
    parameters: z.object({
      summary_reason: z
        .string()
        .describe(
          "Why you are ending the conversation and generating a summary"
        ),
    }),
    async execute({ summary_reason }) {
      console.log(
        `📝 [TOOL] Generating medical summary. Reason: ${summary_reason}`
      );
      setGeneratingSummary(true);
      try {
        const response = await fetch(`${BACKEND_URL}/summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcripts }),
        });

        if (!response.ok) {
          throw new Error(`Summary service error: ${response.status}`);
        }

        const data = await response.json();
        setMedicalSummary({
          summary: data.summary,
          generated_at: data.generated_at,
        });
        console.log("✅ [SUMMARY] Medical summary generated successfully");
        return {
          summary: data.summary,
          success: true,
          message:
            "Thank you for sharing all this information. Your health summary has been generated and is ready for your doctor. You can review it below.",
        };
      } catch (error) {
        console.error("❌ [SUMMARY ERROR]:", error);
        // Don't expose technical errors - ask user to click the button
        // This is a graceful fallback, not an error to show to user
        return {
          success: false,
          message:
            "Thank you for the information. Please click the 'End Interview' button below to complete and generate your health summary.",
          fallback: true,
        };
      } finally {
        setGeneratingSummary(false);
      }
    },
  });

  // Initialize the voice agent with tools
  const initializeAgent = async () => {
    try {
      setConnecting(true);
      setError("");
      setTranscripts([]);
      setMedicalSummary(null);
      setConversationEnded(false);
      setConnectionStatus("Initializing agent...");
      setQuestionCount(0);
      setRagStatus("");
      setRagDetails(null);

      console.log("🚀 [INIT] Starting HealthYoda Speech-to-Speech Voice Agent");
      setConnectionStatus("Creating AI agent...");

      // Create the agent with tools
      const agent = new RealtimeAgent({
        name: "HealthYoda Medical Assistant",
        instructions: `# Role & Objective
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
- Then call the finalize_summary tool (generate_medical_summary) and stop.

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
- If the patient sounds tired or distressed, shorten further and move to wrap‑up.

# Tools (function calling)
You have access to **get_relevant_questions** (handbook_query/RAG) and **generate_medical_summary** (finalize_summary).

## Tool Preamble (MANDATORY)
- BEFORE ANY TOOL CALL, SAY ONE SHORT LINE, then call the tool:
  - "Let me check my clinical guide."
  - "I'm pulling the next best questions."
  - "I'll look up what to ask next."

## get_relevant_questions (handbook_query) — WHEN to call
CALL THIS TOOL TO STAY STRUCTURED AND ON‑TOPIC:
- At the start of a **new chief complaint** or when the user introduces a **new major symptom**.
- When you **don't know the most appropriate next question**.
- After you **detect or rule out a red flag** to adapt follow‑ups.
- When the patient's answers are **ambiguous or conflicting**.
- If you've asked **2–3 questions without consulting the guide** in the current topic.
- Before moving from Focused History → ROS → Context, to fetch the best 2–4 items for that section.
AVOID over‑calling: do not call more than once per 2 questions unless a new symptom/red flag appears.

## get_relevant_questions — HOW to call
- Input: { symptom: patient's chief complaint or latest symptom }
- Output handling:
  - Read the matched medical framework sections
  - Ask **one** concise, conversational question informed by the framework
  - If the framework mentions "Red Flags", **prioritize those questions immediately**

## generate_medical_summary (finalize_summary) — WHEN & HOW
- Call **after**: chief complaint captured, structured sequence covered for primary symptom, brief ROS, context, and wrap‑up question.
- Call when you have enough information (typically after 6-10 questions).
- After calling, **stop asking new questions** unless the user adds critical info.

# Out‑of‑scope deflection (script)
- If asked for diagnosis/treatment: "I'm not a doctor and can't provide diagnosis or treatment. My role is to gather details for your clinician. May I ask about {next_field}?"
- If asked unrelated questions (e.g., news, billing): "I'm focused on your medical intake today, so I won't be able to help with that. May I continue with your symptoms?"

# Safety & Escalation (MANDATORY)
- If severe or worsening chest pain, syncope, signs of shock, severe breathing difficulty, or tearing back pain:
  - Say: "Your symptoms may be serious. Please **seek emergency care now**."
  - Offer to end the session and notify staff if available.
- If 3 consecutive "no‑match/unclear" responses or the user asks for a human: offer escalation or wrap‑up.

# Closing
- End with: "Thanks—I've prepared a summary for your clinician."
- If summary tool returns fallback = true: Politely ask user to click the "✋ End Interview" button below.`,
        tools: [getRelevantQuestions, generateMedicalSummary],
      });

      console.log("🔑 [AUTH] Requesting ephemeral token from backend...");
      setConnectionStatus("Requesting session token from backend...");
      const tokenResponse = await fetch(`${BACKEND_URL}/session`);
      if (!tokenResponse.ok) {
        throw new Error("Failed to get session token");
      }
      const { client_secret } = await tokenResponse.json();
      setConnectionStatus("Token received. Creating WebRTC connection...");

      console.log("📡 [CONNECTION] Creating RealtimeSession...");
      const session = new RealtimeSession(agent, {
        model: REALTIME_MODEL,
      });

      console.log("🔗 [WEBRTC] Connecting to OpenAI Realtime API...");
      setConnectionStatus("Connecting to OpenAI via WebRTC...");
      await session.connect({
        apiKey: client_secret.value,
      });

      sessionRef.current = session;
      console.log("✅ [CONNECTED] Session established successfully");
      setConnectionStatus(
        "✅ Connected! Microphone active. Ready to listen..."
      );
      setConnected(true);

      // Setup audio playback (for WebSocket scenarios if needed)
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      if (!audioElementRef.current) {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        document.body.appendChild(audio);
        audioElementRef.current = audio;
      }

      // Listen to conversation history updates
      session.on("history_updated", (history) => {
        console.log("📜 [HISTORY] Conversation history updated");

        // Process history to display transcripts
        // Use stronger deduplication based on content hash
        setTranscripts((prev) => {
          const contentHashes = new Set(prev.map((t) => `${t.role}:${t.text}`));
          const newTranscripts: TranscriptItem[] = [...prev];
          let questionsAdded = 0;

          history.forEach((item) => {
            if (item.type === "message") {
              const role = item.role === "user" ? "user" : "assistant";

              // Handle both text and audio content
              // IMPORTANT: Only take FIRST content item, not concatenate
              let text = "";
              if (item.content && Array.isArray(item.content)) {
                const firstContent = item.content[0];
                if (!firstContent) return;

                if (firstContent.type === "input_text") {
                  text = firstContent.text;
                } else if (firstContent.type === "output_text") {
                  text = firstContent.text;
                } else if (
                  firstContent.type === "input_audio" &&
                  firstContent.transcript
                ) {
                  text = firstContent.transcript;
                }
              }

              // Only add if we have text content and it's not a duplicate
              if (text && text.trim().length > 0) {
                const cleanText = text.trim();
                const contentHash = `${role}:${cleanText}`;

                // Skip if this exact message already exists
                if (contentHashes.has(contentHash)) {
                  console.log(
                    `⏭️ [HISTORY] Skipping duplicate: ${role} - ${cleanText.substring(
                      0,
                      50
                    )}...`
                  );
                  return;
                }

                newTranscripts.push({
                  role: role as "user" | "assistant",
                  text: cleanText,
                  timestamp: Date.now(),
                });

                // Track questions asked by AI
                if (role === "assistant") {
                  questionsAdded++;
                }

                contentHashes.add(contentHash);
                console.log(
                  `✅ [HISTORY] Added message: ${role} - ${cleanText.substring(
                    0,
                    50
                  )}...`
                );
              }
            }
          });

          // Update question count if new AI messages were added
          if (questionsAdded > 0) {
            console.log(`📊 [HISTORY] Added ${questionsAdded} new AI messages`);
            setQuestionCount((prev) => prev + questionsAdded);
          }

          return newTranscripts;
        });
      });

      // Handle interruptions (user speaking over agent)
      session.on("audio_interrupted", () => {
        console.log("🛑 [INTERRUPT] User interrupted agent");
        setIsListening(true);
      }) as any;

      // Handle session state changes
      (session.on as any)("session.updated", () => {
        console.log("✅ [SESSION] Connected and ready for voice interaction");
        setConnected(true);
        setConnecting(false);
        setIsListening(true);
      });

      // Handle errors
      (session.on as any)("error", (_error: any) => {
        console.error("❌ [ERROR]", _error);
        setError(_error?.message || "Connection error");
        setConnected(false);
      });

      // Handle session end
      (session.on as any)("session.ended", () => {
        console.log("🏁 [SESSION] Session ended");
        setConnected(false);
        setIsListening(false);
        setConversationEnded(true);
      });

      // Handle tool approval if needed
      (session.on as any)(
        "tool_approval_requested",
        (_context: any, _agent: any, request: any) => {
          console.log("🔔 [APPROVAL] Tool approval requested:", request);
          // Auto-approve for medical tools
          (session.approve as any)(request.approvalItem);
        }
      );

      console.log("✅ [READY] Voice agent initialized and ready");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("❌ [INIT ERROR]", errorMsg);
      setError(errorMsg);
      setConnecting(false);
      setConnected(false);
    }
  };

  const endConversation = async () => {
    console.log("🛑 [END] Ending conversation...");
    setGeneratingSummary(true);

    try {
      // Close the session
      if (sessionRef.current) {
        console.log("🔌 [END] Closing WebRTC session...");
        await sessionRef.current.close();
      }

      // Stop microphone
      if (mediaStreamRef.current) {
        console.log("🎤 [END] Stopping microphone...");
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Generate summary if not already generated
      if (!medicalSummary && transcripts.length > 0) {
        console.log("📝 [END] Auto-generating medical summary...");
        try {
          const response = await fetch(`${BACKEND_URL}/summary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcripts }),
          });

          if (response.ok) {
            const data = await response.json();
            setMedicalSummary({
              summary: data.summary,
              generated_at: data.generated_at,
            });
            console.log("✅ [END] Medical summary auto-generated");
          } else {
            console.error(
              "❌ [END] Failed to auto-generate summary:",
              response.status
            );
          }
        } catch (error) {
          console.error("❌ [END] Error auto-generating summary:", error);
        }
      }

      // Mark conversation as ended
      setConversationEnded(true);
      setConnected(false);
      setConnectionStatus("✅ Conversation Ended");
      console.log("✅ [END] Conversation ended successfully");
    } catch (error) {
      console.error("❌ [END] Error ending conversation:", error);
      setError(`Error ending conversation: ${error}`);
      setConversationEnded(true);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const startNewSession = () => {
    console.log("🔄 [NEW] Starting new session...");
    setTranscripts([]);
    setMedicalSummary(null);
    setConversationEnded(false);
    setError("");
    initializeAgent();
  };

  const copyToClipboard = () => {
    if (medicalSummary) {
      navigator.clipboard.writeText(medicalSummary.summary);
      alert("✅ Summary copied to clipboard!");
    }
  };

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🏥 HealthYoda - AI Medical Interview Assistant</h1>
        <p>Speech-to-Speech Voice Agent with Real-Time RAG Integration</p>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {/* NEW: Connection Status Panel */}
        {connecting && (
          <div className="status-panel">
            <div className="status-panel-title">🔧 System Status</div>
            <div className="status-item">
              <span className="status-label">Connection:</span>
              <span className="status-value">{connectionStatus}</span>
            </div>
          </div>
        )}

        {connected && !conversationEnded && (
          <div className="status-panel">
            <div className="status-panel-title">📊 Interview Status</div>
            <div className="status-item">
              <span className="status-label">Connection:</span>
              <span className="status-value">✅ {connectionStatus}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Questions Asked:</span>
              <span className="status-value">{questionCount}</span>
            </div>
            {ragStatus && (
              <div className="status-item">
                <span className="status-label">Medical Framework:</span>
                <span className="status-value">{ragStatus}</span>
              </div>
            )}
            {ragDetails && (
              <div className="status-item rag-details">
                <div>
                  <strong>📚 RAG Details:</strong>
                </div>
                <div className="rag-info">
                  <small>
                    Symptom: <strong>{ragDetails.symptom}</strong>
                  </small>
                </div>
                <div className="rag-info">
                  <small>
                    Chunks: <strong>{ragDetails.chunks}</strong> | Sources:{" "}
                    <strong>{ragDetails.sources.join(", ")}</strong>
                  </small>
                </div>
              </div>
            )}
          </div>
        )}

        {!connected && !conversationEnded && (
          <div className="start-section">
            <button
              onClick={initializeAgent}
              disabled={connecting}
              className="primary-button"
            >
              {connecting ? "🔗 Connecting..." : "🎙️ Start Voice Interview"}
            </button>
            <p className="help-text">
              Click to start. Allow microphone access when prompted. Speak
              naturally about your health concern.
            </p>
          </div>
        )}

        {connected && (
          <div className="conversation-section">
            <div className="status-indicator">
              <div
                className={`status-dot ${isListening ? "listening" : ""}`}
              ></div>
              <span>
                {isListening ? "🎤 Listening..." : "⏸️ Processing..."}
              </span>
            </div>

            <div className="transcript-container">
              <h2>📋 Conversation</h2>
              <div className="transcript-list">
                {transcripts.length === 0 ? (
                  <p className="empty-state">
                    Waiting for you to speak. Describe your health concern...
                  </p>
                ) : (
                  transcripts.map((item, idx) => (
                    <div key={idx} className={`transcript-item ${item.role}`}>
                      <strong>
                        {item.role === "user" ? "👤 You" : "🤖 HealthYoda"}:
                      </strong>
                      <p>{item.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button onClick={endConversation} className="end-button">
              ✋ End Interview
            </button>
          </div>
        )}

        {conversationEnded && medicalSummary && (
          <div className="summary-section">
            <h2>📋 Medical Summary Report</h2>
            <div className="summary-content">
              <pre>{medicalSummary.summary}</pre>
            </div>
            <div className="summary-actions">
              <button onClick={copyToClipboard} className="copy-button">
                📋 Copy Report
              </button>
              <button onClick={startNewSession} className="new-session-button">
                🔄 New Interview
              </button>
            </div>
          </div>
        )}

        {conversationEnded && !medicalSummary && (
          <div className="summary-section">
            <h2>📋 Medical Summary Report</h2>
            {generatingSummary ? (
              <div className="loading-indicator">
                <p>⏳ Generating medical summary from conversation...</p>
              </div>
            ) : (
              <div className="summary-placeholder">
                <p>📝 No summary available yet.</p>
                <p>This can happen if the conversation was very brief.</p>
                <button
                  onClick={startNewSession}
                  className="new-session-button"
                >
                  🔄 Start New Interview
                </button>
              </div>
            )}
          </div>
        )}

        {generatingSummary && (
          <div className="loading-indicator">
            <p>⏳ Generating medical summary...</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          HealthYoda is an AI-powered medical intake assistant using
          speech-to-speech technology with real-time RAG knowledge retrieval.
          <br />
          <strong>Disclaimer:</strong> This is an information-gathering tool
          only. Always consult with a licensed healthcare provider for medical
          advice, diagnosis, or treatment.
        </p>
      </footer>
    </div>
  );
}

export default App;

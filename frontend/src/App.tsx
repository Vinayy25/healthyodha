import { useEffect, useState, useRef } from "react";
import { RealtimeAgent, tool, RealtimeSession } from "@openai/agents/realtime";
import { z } from "zod";
import "./App.css";

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
        const response = await fetch("http://15.206.157.127:3001/rag", {
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
        const response = await fetch("http://15.206.157.127:3001/summary", {
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
        instructions: `You are HealthYoda, a highly efficient medical intake assistant. Your role is to gather essential patient information quickly and systematically.

## CRITICAL REQUIREMENT - TOOL CALLING
**You MUST call the get_relevant_questions tool AFTER EVERY patient response.**
- After user speaks, immediately acknowledge and call get_relevant_questions with their symptom
- Use the returned framework to ask your next question
- Do NOT skip tool calls. Tools are mandatory for every interaction.
- Tools help you ask evidence-based, optimal questions

## Conversation Structure
1. Initial Greeting: Ask "What brings you in today?" / "What's bothering you?"
2. After First Answer: Call tool with their symptom → Get framework → Ask follow-up
3. Iterate 4-5 times MAXIMUM asking brief follow-ups based on tool guidance
4. After 5-6 total exchanges, you have enough information
5. End by calling generate_medical_summary

## Interview Flow (FAST - 5-8 questions total)
- Q1: Chief complaint (chief_complaint)
- Q2: Duration/onset (after tool call)
- Q3: Severity/quality (after tool call)
- Q4: Associated symptoms (after tool call)
- Q5: Red flags/impact (after tool call)
- Q6: Medical history if relevant (after tool call)
- Then: Generate summary and end

## Specific Instructions for Tools
ALWAYS:
1. Acknowledge what patient said
2. Call get_relevant_questions tool with symptom
3. Wait for framework
4. Ask ONE targeted question from the framework
5. Listen to answer
6. Repeat steps 1-5 OR generate summary

NEVER:
- Ask multiple questions at once
- Skip tool calls
- Go beyond 6-8 total questions
- Have long conversations

## When to End Conversation
- After 5-8 questions are asked
- When you have: chief complaint, onset, severity, key associated symptoms, any red flags
- You do NOT need complete medical history for this initial intake
- More questions can be asked by the doctor later
- Your job is QUICK screening, not comprehensive workup

## CRITICAL - AUTOMATIC SUMMARY
**WHEN YOU DECIDE THE CONVERSATION IS COMPLETE (after 5-8 questions):**
- You MUST automatically call the generate_medical_summary tool
- Do NOT wait for user to click end
- Do NOT ask user if they want to end
- Simply call the tool when you have enough information
- This is NOT optional - ALWAYS do this

## If Summary Tool Returns a Message
- If tool returns success = true: Acknowledge and thank the user, interview is complete
- If tool returns fallback = true: Politely thank the user and ask them to click the "✋ End Interview" button
- NEVER show technical errors to the user
- ALWAYS be warm, professional, and supportive

## Important
- Be concise and direct
- Use tool results to guide questions
- Patient experience is quick check-in, not long interview
- Efficiency is key - 5 minutes max
- Remember: AUTOMATICALLY call generate_medical_summary when ending, don't wait

Start by greeting warmly and asking their main concern.`,
        tools: [getRelevantQuestions, generateMedicalSummary],
      });

      console.log("🔑 [AUTH] Requesting ephemeral token from backend...");
      setConnectionStatus("Requesting session token from backend...");
      const tokenResponse = await fetch("http://15.206.157.127:3001/session");
      if (!tokenResponse.ok) {
        throw new Error("Failed to get session token");
      }
      const { client_secret } = await tokenResponse.json();
      setConnectionStatus("Token received. Creating WebRTC connection...");

      console.log("📡 [CONNECTION] Creating RealtimeSession...");
      const session = new RealtimeSession(agent, {
        model: "gpt-realtime",
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
          const response = await fetch("http://15.206.157.127:3001/summary", {
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

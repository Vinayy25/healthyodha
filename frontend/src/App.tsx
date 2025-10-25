import { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./App.css";

interface TranscriptItem {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface RAGContext {
  context: string;
  sources: string[];
  num_chunks: number;
}

interface MedicalSummary {
  summary: string;
  transcripts_count: number;
  generated_at: string;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>("");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [ragContext, setRagContext] = useState<RAGContext | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [showRagPanel, setShowRagPanel] = useState(true); // Always show RAG
  const [medicalSummary, setMedicalSummary] = useState<MedicalSummary | null>(
    null
  );
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [conversationEnded, setConversationEnded] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const lastRagQuery = useRef<string>("");
  const ragDebounceTimer = useRef<NodeJS.Timeout>();

  // Keywords that suggest conversation is ending
  const END_KEYWORDS = [
    "thank you",
    "goodbye",
    "thanks",
    "that's all",
    "i'm done",
    "that's it",
  ];
  const isConversationEnding = (text: string): boolean => {
    return END_KEYWORDS.some((keyword) => text.toLowerCase().includes(keyword));
  };

  const startSession = async () => {
    try {
      setConnecting(true);
      setError("");

      // Get Realtime session credentials from backend
      console.log("📡 Requesting session from backend...");
      const { data } = await axios.post("http://localhost:3001/session");
      console.log("✅ Session created:", data);

      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up audio element for playback
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);

      pc.ontrack = (e) => {
        console.log("🎵 Received audio track");
        audioEl.srcObject = e.streams[0];
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setConnected(true);
          setConnecting(false);
          setIsListening(true);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setConnected(false);
          setIsListening(false);
          setError("Connection lost. Please refresh to reconnect.");
        }
      };

      // Get microphone input
      console.log("🎤 Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("✅ Microphone access granted");
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      // Create data channel for events/transcripts
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log("✅ Data channel opened");
      };

      dc.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data);
          console.log("📨 Received event:", event);

          // Handle different event types
          if (event.type === "conversation.item.created") {
            const item = event.item;
            if (item.type === "message" && item.role) {
              // Extract text content if available
              if (item.content && Array.isArray(item.content)) {
                const textContent = item.content.find(
                  (c: any) => c.type === "text"
                );
                if (textContent && textContent.text) {
                  setTranscripts((prev) => [
                    ...prev,
                    {
                      role: item.role,
                      text: textContent.text,
                      timestamp: Date.now(),
                    },
                  ]);
                }
              }
            }
          } else if (event.type === "response.audio_transcript.done") {
            // Assistant's spoken response transcript
            if (event.transcript) {
              setTranscripts((prev) => [
                ...prev,
                {
                  role: "assistant",
                  text: event.transcript,
                  timestamp: Date.now(),
                },
              ]);
            }
          } else if (
            event.type ===
            "conversation.item.input_audio_transcription.completed"
          ) {
            // User's spoken input transcript
            if (event.transcript) {
              setTranscripts((prev) => [
                ...prev,
                {
                  role: "user",
                  text: event.transcript,
                  timestamp: Date.now(),
                },
              ]);
            }
          }
        } catch (err) {
          console.error("Error parsing data channel message:", err);
        }
      };

      dc.onerror = (err) => {
        console.error("Data channel error:", err);
      };

      // Create and send SDP offer
      console.log("📤 Creating offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI Realtime API
      console.log("📡 Connecting to OpenAI Realtime API...");
      const baseUrl =
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
      const sdpResponse = await fetch(baseUrl, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${data.client_secret.value}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(
          `OpenAI API error: ${sdpResponse.status} ${sdpResponse.statusText}`
        );
      }

      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSdp,
      };

      await pc.setRemoteDescription(answer);
      console.log("✅ WebRTC connection established");
    } catch (err: any) {
      console.error("❌ Error starting session:", err);
      setError(
        err.message ||
          "Failed to start session. Please check your API key and try again."
      );
      setConnecting(false);
      setConnected(false);
    }
  };

  // Fetch RAG context continuously (every 3 seconds if there's new content)
  const fetchRAGContext = async (query: string) => {
    if (query === lastRagQuery.current) {
      return;
    }

    try {
      setRagLoading(true);
      lastRagQuery.current = query;

      console.log("🔍 Fetching RAG context for:", query);
      const response = await axios.post("http://localhost:3001/rag", {
        query,
        k: 3,
      });

      setRagContext(response.data);
      console.log("✅ RAG context retrieved:", response.data.sources);
    } catch (err: any) {
      console.error("❌ Failed to fetch RAG context:", err);
      // Silently fail, don't break the experience
    } finally {
      setRagLoading(false);
    }
  };

  // Auto-fetch RAG context from latest user message
  useEffect(() => {
    console.log(
      "RAG Effect triggered - connected:",
      connected,
      "transcripts:",
      transcripts.length
    );

    if (!connected) {
      console.log("Not connected, skipping RAG");
      return;
    }

    const userTranscripts = transcripts.filter((t) => t.role === "user");
    if (userTranscripts.length === 0) {
      console.log("No user transcripts yet");
      return;
    }

    const lastUserMessage = userTranscripts[userTranscripts.length - 1];
    console.log("Last user message:", lastUserMessage.text);

    // Debounced RAG fetch
    if (ragDebounceTimer.current) {
      clearTimeout(ragDebounceTimer.current);
    }

    ragDebounceTimer.current = setTimeout(() => {
      console.log("Debounce timeout fired, fetching RAG");
      fetchRAGContext(lastUserMessage.text);
    }, 500); // Wait 500ms after user stops typing to fetch RAG

    return () => {
      if (ragDebounceTimer.current) {
        clearTimeout(ragDebounceTimer.current);
      }
    };
  }, [transcripts, connected]);

  // Check for conversation ending
  useEffect(() => {
    console.log(
      "End detection effect - conversationEnded:",
      conversationEnded,
      "transcripts:",
      transcripts.length
    );

    if (transcripts.length < 4 || conversationEnded) {
      console.log(
        "Skipping end detection - too few transcripts or already ended"
      );
      return;
    }

    const lastAssistantMessage = [...transcripts]
      .reverse()
      .find((t) => t.role === "assistant");

    if (!lastAssistantMessage) {
      console.log("No assistant message found");
      return;
    }

    console.log(
      "Checking assistant message for end keywords:",
      lastAssistantMessage.text
    );

    if (isConversationEnding(lastAssistantMessage.text)) {
      console.log("🏁 Conversation ending detected!");
      setConversationEnded(true);
      // Automatically generate summary
      setTimeout(() => {
        console.log("Auto-generating summary now...");
        generateSummary();
      }, 1000); // Wait 1 second then generate
    }
  }, [transcripts, conversationEnded]);

  // Generate medical summary
  const generateSummary = async () => {
    try {
      setGeneratingSummary(true);
      console.log(
        "📋 Generating medical summary from",
        transcripts.length,
        "messages..."
      );

      const response = await axios.post("http://localhost:3001/summary", {
        transcripts,
      });

      console.log("✅ Summary response received:", response.data);
      setMedicalSummary(response.data);
      console.log("✅ Medical summary generated");
    } catch (err: any) {
      console.error("❌ Failed to generate summary:", err);
      console.error("Error details:", err.response?.data || err.message);
      setError("Failed to generate medical summary. Try again.");
      setConversationEnded(false); // Reset so user can try again
    } finally {
      setGeneratingSummary(false);
    }
  };

  const endConversation = async () => {
    disconnect();
    // Generate summary after ending
    await generateSummary();
  };

  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    setConnected(false);
    setIsListening(false);
    setRagContext(null);
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🩺 HealthYoda</h1>
          <p className="subtitle">AI Medical Assistant with RAG</p>
        </header>

        <div className="status-section">
          {!connected && !connecting && !medicalSummary && (
            <button className="connect-btn" onClick={startSession}>
              Start Conversation
            </button>
          )}

          {connecting && (
            <div className="status connecting">
              <div className="spinner"></div>
              <p>Connecting to assistant...</p>
            </div>
          )}

          {connected && (
            <div className="status connected">
              <div className="pulse"></div>
              <p>Connected - Speak now</p>
              <span className="rag-badge">🧠 RAG Active</span>
              {conversationEnded ? (
                <p className="ending-indicator">
                  ⏱️ Conversation ended - generating summary...
                </p>
              ) : (
                <button className="disconnect-btn" onClick={endConversation}>
                  End Conversation & Generate Summary
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="error">
              <p>⚠️ {error}</p>
            </div>
          )}
        </div>

        {medicalSummary ? (
          <div className="summary-section">
            <h2>📋 Medical Summary Report</h2>
            <div className="summary-content">
              <div className="summary-text">
                {medicalSummary.summary.split("\n\n").map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
              <div className="summary-footer">
                <p className="meta">
                  Generated from {medicalSummary.transcripts_count} messages |{" "}
                  {new Date(medicalSummary.generated_at).toLocaleString()}
                </p>
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(medicalSummary.summary);
                    alert("Summary copied to clipboard!");
                  }}
                >
                  📋 Copy Summary
                </button>
                <button
                  className="new-session-btn"
                  onClick={() => window.location.reload()}
                >
                  ➕ Start New Session
                </button>
              </div>
            </div>
          </div>
        ) : connected ? (
          <div className="main-content">
            <div className="transcript-section">
              <h2>Conversation</h2>
              <div className="transcript-container">
                {transcripts.length === 0 ? (
                  <p className="empty-state">
                    {isListening
                      ? "Listening... Start speaking to begin the conversation."
                      : "No conversation yet."}
                  </p>
                ) : (
                  transcripts.map((item, index) => (
                    <div key={index} className={`transcript-item ${item.role}`}>
                      <div className="role-badge">
                        {item.role === "user" ? "You" : "HealthYoda"}
                      </div>
                      <div className="text">{item.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {showRagPanel && (
              <div className="rag-section">
                <div className="rag-header">
                  <h2>📚 Medical Knowledge Context</h2>
                </div>

                {ragLoading && (
                  <div className="rag-loading">
                    <div className="spinner-small"></div>
                    <p>Retrieving relevant medical framework...</p>
                  </div>
                )}

                {ragContext && !ragLoading && (
                  <div className="rag-content">
                    <div className="rag-sources">
                      <strong>Sources:</strong> {ragContext.sources.join(" • ")}
                    </div>
                    <div className="rag-text">
                      {ragContext.context
                        .split("\n\n---\n\n")
                        .map((section, idx) => (
                          <div key={idx} className="rag-chunk">
                            {section.split("\n").map((line, lineIdx) => (
                              <p key={lineIdx}>{line}</p>
                            ))}
                          </div>
                        ))}
                    </div>
                    <div className="rag-note">
                      ℹ️ This context helps guide evidence-based questions for
                      comprehensive history-taking.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <footer className="footer">
          <p>🔒 Your conversation is secure and private</p>
          <p className="disclaimer">
            Note: This is an AI assistant for information gathering only. Always
            consult with a healthcare professional for medical advice.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;

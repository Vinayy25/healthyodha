# 🩺 HealthYoda - Realtime Voice Medical Assistant

A voice-based AI medical assistant using OpenAI's Realtime API for real-time speech-to-speech conversation with patients.

## 🏗️ Architecture

- **Frontend**: Vite + React + TypeScript with WebRTC for audio streaming
- **Backend**: Node.js/Express server for secure session token generation and RAG coordination
- **RAG Service**: Python/FastAPI with FAISS vector search for medical knowledge retrieval
- **API**: OpenAI Realtime API (gpt-4o-realtime-preview) for STT/TTS/conversation

## ✨ Features

- 🎤 Real-time voice conversation (speech-to-speech)
- 🔄 Live transcription of both user and assistant
- 🩺 Medical history interview with empathetic responses
- 🧠 **RAG-enhanced knowledge retrieval** from medical handbook
- 📚 Automatic symptom-based context fetching
- 🔒 Secure token-based authentication
- 📱 Clean, modern UI with connection status
- 📊 Side-by-side conversation and knowledge display

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Python 3.8+ installed (for RAG service)
- OpenAI API key with Realtime API access
- Modern web browser with microphone support

### 1. Clone and Setup Environment

```bash
cd /home/vinay/projects/freelance/healthyodha

# Create .env file from example
cp .env.example .env

# Edit .env and add your OpenAI API key
nano .env  # or use your preferred editor
```

Add your API key to `.env`:

```
OPENAI_API_KEY=sk-proj-...your-key-here
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Setup RAG Service (Optional but Recommended)

```bash
cd ../rag_service
./setup.sh
```

This creates a Python virtual environment and installs RAG dependencies.

### 5. Start the Application

**Option A: Without RAG (Basic)**

**Terminal 1 - Backend:**

```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

**Option B: With RAG Enhancement (Recommended)**

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

### 6. Access the Application

1. Open your browser to: `http://localhost:5173`
2. **(Optional)** Check "Enable Medical Knowledge Enhancement (RAG)"
3. Click "Start Conversation" and allow microphone access
4. Start speaking about symptoms!

## 🎯 Usage

1. **Start Conversation**: Click the "Start Conversation" button
2. **Allow Microphone**: Grant microphone permissions when prompted
3. **Speak**: Once connected, start speaking to the AI assistant
4. **View Transcript**: See real-time transcription of the conversation
5. **End Session**: Click "End Conversation" when finished

## 🔧 Configuration

### Backend (`backend/server.js`)

- **Port**: Default is 3001, configurable via `PORT` environment variable
- **Voice**: Default is "alloy", can be changed to: "echo", "fable", "onyx", "nova", "shimmer"
- **Instructions**: Modify the system prompt to customize assistant behavior

### Frontend (`frontend/src/App.tsx`)

- **Backend URL**: Default is `http://localhost:3001`, update if deploying remotely
- **Audio Settings**: Echo cancellation, noise suppression, and auto gain control enabled

## 📝 API Endpoints

### POST /session

Creates a new OpenAI Realtime API session.

**Response:**

```json
{
  "id": "sess_...",
  "model": "gpt-4o-realtime-preview-2024-10-01",
  "client_secret": {
    "value": "ek_...",
    "expires_at": 1234567890
  }
}
```

## 🐛 Troubleshooting

### "Failed to create session"

- Verify your OpenAI API key is correct in `.env`
- Ensure you have access to the Realtime API (may require waitlist approval)

### Microphone not working

- Check browser permissions (chrome://settings/content/microphone)
- Ensure no other application is using the microphone
- Try using HTTPS (required for some browsers)

### Connection issues

- Verify backend is running on port 3001
- Check browser console for detailed error messages
- Ensure firewall/antivirus isn't blocking WebRTC

## 🔐 Security Notes

- API keys are stored in `.env` file (never commit to git)
- Session tokens are ephemeral and expire after use
- All audio processing happens via OpenAI's secure API
- No medical data is stored locally

## 📦 Project Structure

```
healthyodha/
├── backend/
│   ├── package.json
│   └── server.js          # Express server with /session and /rag endpoints
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # WebRTC + RAG integration
│   │   ├── App.css        # Styling with RAG UI components
│   │   └── index.css      # Base styles
│   ├── package.json
│   └── vite.config.ts
├── rag_service/
│   ├── main.py            # FastAPI RAG service
│   ├── requirements.txt   # Python dependencies
│   ├── setup.sh           # Setup script
│   ├── run.sh             # Run script
│   └── README.md          # RAG documentation
├── handbook.txt           # Medical knowledge base
├── .env                   # API keys (create from .env.example)
├── .env.example           # Environment template
├── README.md              # Main documentation (this file)
├── RAG_GUIDE.md           # Comprehensive RAG guide
└── QUICKSTART.md          # Quick start guide
```

j## 🧠 RAG Enhancement

The system includes a **Retrieval Augmented Generation** service that enhances conversations with medical knowledge:

- **Automatic Detection**: Recognizes symptoms mentioned by patients
- **Knowledge Retrieval**: Fetches relevant frameworks from the handbook
- **Context Display**: Shows retrieved information alongside the conversation
- **Evidence-Based**: Uses structured medical history-taking frameworks

📖 **See [RAG_GUIDE.md](RAG_GUIDE.md) for detailed documentation**

### Quick RAG Test:

1. Enable RAG in the UI
2. Say: "I have chest pain"
3. Watch the Medical Knowledge Context panel appear with cardiac assessment questions

## 🚧 Future Enhancements

- ✅ ~~RAG integration with medical knowledge base~~ **DONE!**
- Medical report generation
- Session history and persistence
- Multi-language support
- Advanced error handling and retry logic
- Treatment protocols and drug information databases

## ⚠️ Disclaimer

This is a prototype AI assistant for information gathering only. It does NOT provide medical diagnoses or treatment recommendations. Always consult with qualified healthcare professionals for medical advice.

## 📄 License

ISC

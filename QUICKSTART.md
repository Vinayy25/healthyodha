# 🚀 Quick Start Guide

## Prerequisites Check

- ✅ Node.js 18+ installed
- ✅ OpenAI API key ready
- ✅ Microphone available

## Setup (First Time Only)

### 1. Set up your API key

```bash
# Copy the example file
cp .env.example .env

# Edit and add your OpenAI API key
nano .env
```

Your `.env` should look like:

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
```

### 2. Install dependencies (if not already done)

```bash
# From the project root
npm run install-all
```

## Running the Application

### Option 1: Manual Start (Recommended for development)

**Terminal 1 - Backend:**

```bash
cd backend
npm start
```

You should see: `✅ HealthYoda Backend running on port 3001`

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

You should see: `Local: http://localhost:5173/`

### Option 2: Using npm scripts from root

**Terminal 1:**

```bash
npm run backend
```

**Terminal 2:**

```bash
npm run frontend
```

## Using the Application

1. Open your browser to `http://localhost:5173`
2. Click **"Start Conversation"**
3. Allow microphone access when prompted
4. Wait for "Connected - Speak now" message
5. Start speaking! The AI will respond with voice
6. Watch the transcript appear in real-time
7. Click **"End Conversation"** when done

## Testing Tips

### First Test Questions:

- "Hello, I'd like to talk about some symptoms I've been having"
- "I've been experiencing chest pain for the last few days"
- "I have a headache that won't go away"

### What to Expect:

- ✅ AI greets you warmly
- ✅ Asks follow-up questions about your symptoms
- ✅ Shows empathy and understanding
- ✅ Both sides of conversation appear as text
- ✅ Voice plays automatically

## Troubleshooting

### Backend won't start

```bash
# Check if .env file exists
ls -la .env

# Verify OPENAI_API_KEY is set
cat .env
```

### Frontend can't connect

```bash
# Verify backend is running on port 3001
curl http://localhost:3001/session
```

### Microphone not working

- Check browser settings: chrome://settings/content/microphone
- Make sure no other app is using the microphone
- Try refreshing the page

### No audio playback

- Check system volume
- Verify audio output device is working
- Check browser audio permissions

## Browser Console Logs

Open DevTools (F12) to see detailed logs:

- 📡 Session creation
- 🎤 Microphone access
- ✅ WebRTC connection status
- 📨 Real-time events

## Next Steps

Once you verify the basic setup works:

- Modify the system instructions in `backend/server.js`
- Customize the UI in `frontend/src/App.tsx` and `App.css`
- Add RAG integration (future enhancement)
- Implement session history and reports

## Common Issues

| Issue                      | Solution                               |
| -------------------------- | -------------------------------------- |
| "OPENAI_API_KEY not found" | Check `.env` file in root directory    |
| "Failed to create session" | Verify API key has Realtime API access |
| Port 3001 already in use   | Change PORT in `.env` file             |
| Port 5173 already in use   | Vite will auto-assign new port         |

## Support

Check the main README.md for detailed documentation and architecture information.

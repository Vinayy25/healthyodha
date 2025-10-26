# ⚡ Quick Environment Setup Guide

## 🚀 For Production (Already Deployed on Vercel)

Your current deployment already works! No changes needed. The defaults in the code match your production setup.

**Optional**: Add environment variables in Vercel for future flexibility:

1. Go to [Vercel Dashboard](https://vercel.com/) → Your Project → Settings → Environment Variables
2. Add variables (see below)
3. Redeploy

---

## 💻 For Local Development

### Step 1: Backend Setup (5 minutes)

```bash
cd /home/vinay/projects/freelance/healthyodha/backend
cp .env.example .env
nano .env
```

Add your OpenAI API key:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
REALTIME_MODEL=gpt-realtime
SUMMARY_MODEL=gpt-4o-mini
RAG_SERVICE_URL=http://15.206.157.127:3000
PORT=3001
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`)

### Step 2: Frontend Setup (2 minutes)

```bash
cd /home/vinay/projects/freelance/healthyodha/frontend
cp .env.example .env
nano .env
```

For local backend:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_REALTIME_MODEL=gpt-realtime
```

Or keep using production backend:

```env
VITE_BACKEND_URL=https://healthyodha-y754.vercel.app
VITE_REALTIME_MODEL=gpt-realtime
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`)

### Step 3: Test (1 minute)

**Backend:**

```bash
cd backend
node server.js
```

Look for:

```
📋 Configuration:
   OPENAI_API_KEY: ✅ Set
   RAG_SERVICE_URL: http://15.206.157.127:3000
   REALTIME_MODEL: gpt-realtime
   SUMMARY_MODEL: gpt-4o-mini
   PORT: 3001
✅ HealthYoda Backend running on port 3001
```

**Frontend:**

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 and test!

---

## 📊 Environment Variables Reference

### Backend Variables

| Variable          | Required? | Default                 | Description                   |
| ----------------- | --------- | ----------------------- | ----------------------------- |
| `OPENAI_API_KEY`  | ✅ Yes    | -                       | Your OpenAI API key           |
| `REALTIME_MODEL`  | ❌ No     | `gpt-realtime`          | Model for voice conversations |
| `SUMMARY_MODEL`   | ❌ No     | `gpt-4o-mini`           | Model for medical summaries   |
| `RAG_SERVICE_URL` | ❌ No     | `http://localhost:3000` | URL of RAG service            |
| `PORT`            | ❌ No     | `3001`                  | Backend server port           |

### Frontend Variables

| Variable              | Required? | Default                               | Description              |
| --------------------- | --------- | ------------------------------------- | ------------------------ |
| `VITE_BACKEND_URL`    | ❌ No     | `https://healthyodha-y754.vercel.app` | Backend API URL          |
| `VITE_REALTIME_MODEL` | ❌ No     | `gpt-realtime`                        | Model name (for display) |

---

## 🔧 Vercel Environment Variables Setup

### Backend (Vercel Project: healthyodha-backend)

Go to: **Settings → Environment Variables**

Add:

```
OPENAI_API_KEY = sk-proj-xxxxxxxxxxxxxxxxxxxxx
REALTIME_MODEL = gpt-realtime
SUMMARY_MODEL = gpt-4o-mini
RAG_SERVICE_URL = http://15.206.157.127:3000
PORT = 3001
```

### Frontend (Vercel Project: healthyodha-frontend)

Go to: **Settings → Environment Variables**

Add:

```
VITE_BACKEND_URL = https://healthyodha-y754.vercel.app
VITE_REALTIME_MODEL = gpt-realtime
```

After adding, click **Redeploy** for changes to take effect.

---

## ⚠️ Important Notes

### Frontend .env Changes

- Vite only reads `.env` at **build time**
- After changing `.env`, you **must**:
  - For dev: Stop and restart `npm run dev`
  - For production: Run `npm run build` again

### Security

- ✅ `.env` files are in `.gitignore` (safe)
- ✅ Never commit `.env` files to Git
- ✅ Only commit `.env.example` files

### API Key Format

- Correct: `OPENAI_API_KEY=sk-proj-abc123`
- Wrong: `OPENAI_API_KEY = "sk-proj-abc123"` (no spaces or quotes)

---

## 🐛 Troubleshooting

### "OPENAI_API_KEY not found"

```bash
# Check if .env exists
cd backend
ls -la .env

# If missing, create it
cp .env.example .env
nano .env
```

### "Failed to get session token"

```bash
# Check frontend .env
cd frontend
cat .env

# Make sure VITE_BACKEND_URL is correct
# Restart dev server
npm run dev
```

### Variables not loading

```bash
# Backend: Check dotenv is loaded
cd backend
grep "dotenv.config" server.js  # Should exist

# Frontend: Check variables start with VITE_
cd frontend
grep "VITE_" .env  # All should start with VITE_

# Restart after changes
# Backend: Stop and run: node server.js
# Frontend: Stop and run: npm run dev
```

---

## 📚 More Information

For detailed documentation, see:

- **ENVIRONMENT_CONFIGURATION.md** - Complete guide with all details
- **.env.example** - Template with all available variables
- **backend/.env.example** - Backend-specific template
- **frontend/.env.example** - Frontend-specific template

---

**Last Updated**: October 26, 2025

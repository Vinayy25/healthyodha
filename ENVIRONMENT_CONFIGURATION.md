# HealthYoda Environment Configuration Guide

This guide explains how to configure HealthYoda using environment variables.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Setup](#quick-setup)
3. [Configuration Files](#configuration-files)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Deployment Scenarios](#deployment-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## Overview

HealthYoda uses environment variables to configure:

- OpenAI API keys and model selection
- Backend and RAG service URLs
- Server ports and other runtime settings

This allows you to:

- ✅ Keep sensitive data out of version control
- ✅ Easily switch between development and production
- ✅ Customize models and endpoints without code changes
- ✅ Deploy to different environments with ease

---

## Quick Setup

### 1. Root Directory Setup

```bash
cd /home/vinay/projects/freelance/healthyodha
cp .env.example .env
nano .env  # Edit with your actual values
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
nano .env  # Edit with your actual values
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
nano .env  # Edit with your actual values
```

---

## Configuration Files

### Root `.env` (Shared Configuration)

Location: `/home/vinay/projects/freelance/healthyodha/.env`

This is the main configuration file that can be shared across all services.

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# Model Configuration
REALTIME_MODEL=gpt-realtime
SUMMARY_MODEL=gpt-4o-mini

# RAG Service Configuration
RAG_SERVICE_URL=http://15.206.157.127:3000

# Backend Server Configuration
PORT=3001

# Frontend Configuration
VITE_BACKEND_URL=https://healthyodha-y754.vercel.app
VITE_REALTIME_MODEL=gpt-realtime
```

### Backend `.env`

Location: `/home/vinay/projects/freelance/healthyodha/backend/.env`

Backend-specific configuration (loaded by `dotenv` in `server.js`).

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
REALTIME_MODEL=gpt-realtime
SUMMARY_MODEL=gpt-4o-mini
RAG_SERVICE_URL=http://15.206.157.127:3000
PORT=3001
```

### Frontend `.env`

Location: `/home/vinay/projects/freelance/healthyodha/frontend/.env`

Frontend-specific configuration (loaded by Vite, requires `VITE_` prefix).

```env
VITE_BACKEND_URL=https://healthyodha-y754.vercel.app
VITE_REALTIME_MODEL=gpt-realtime
```

---

## Environment Variables Reference

### OpenAI Configuration

#### `OPENAI_API_KEY` (Required)

Your OpenAI API key for accessing GPT models and Realtime API.

- **Where**: Backend `.env`
- **Format**: `sk-proj-...` or `sk-...`
- **Get it**: [OpenAI API Keys](https://platform.openai.com/api-keys)
- **Example**: `OPENAI_API_KEY=sk-proj-abc123xyz...`

---

### Model Configuration

#### `REALTIME_MODEL` (Optional)

The OpenAI model used for real-time voice conversations.

- **Where**: Backend `.env`, Frontend `.env` (as `VITE_REALTIME_MODEL`)
- **Default**: `gpt-realtime`
- **Options**:
  - `gpt-realtime` (recommended, alias for latest)
  - `gpt-4o-realtime-preview-2024-10-01` (specific version)
- **Example**: `REALTIME_MODEL=gpt-realtime`

**Note**: Only `gpt-4o-realtime-preview` models support speech-to-speech with tool calling.

#### `SUMMARY_MODEL` (Optional)

The OpenAI model used for generating medical summaries.

- **Where**: Backend `.env`
- **Default**: `gpt-4o-mini`
- **Options**:
  - `gpt-4o-mini` (recommended, cost-effective)
  - `gpt-4o` (more capable, higher cost)
  - `gpt-4-turbo`
- **Example**: `SUMMARY_MODEL=gpt-4o-mini`

**Cost Comparison**:

- `gpt-4o-mini`: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- `gpt-4o`: ~$2.50 per 1M input tokens, ~$10.00 per 1M output tokens

---

### Service Configuration

#### `RAG_SERVICE_URL` (Optional)

URL of the RAG (Retrieval Augmented Generation) service.

- **Where**: Backend `.env`
- **Default**: `http://localhost:3000`
- **Production**: `http://15.206.157.127:3000` (AWS EC2)
- **Local Dev**: `http://localhost:3000`
- **Example**: `RAG_SERVICE_URL=http://15.206.157.127:3000`

#### `VITE_BACKEND_URL` (Optional)

URL of the backend API (used by frontend).

- **Where**: Frontend `.env`
- **Default**: `https://healthyodha-y754.vercel.app`
- **Production**: `https://healthyodha-y754.vercel.app` (Vercel)
- **Local Dev**: `http://localhost:3001`
- **Example**: `VITE_BACKEND_URL=https://healthyodha-y754.vercel.app`

**Note**: Prefix with `VITE_` so Vite exposes it to the client.

#### `PORT` (Optional)

Port number for the backend Express server.

- **Where**: Backend `.env`
- **Default**: `3001`
- **Example**: `PORT=3001`

---

## Deployment Scenarios

### Local Development (All Services)

```env
# Root .env or Backend .env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
REALTIME_MODEL=gpt-realtime
SUMMARY_MODEL=gpt-4o-mini
RAG_SERVICE_URL=http://localhost:3000
PORT=3001

# Frontend .env
VITE_BACKEND_URL=http://localhost:3001
VITE_REALTIME_MODEL=gpt-realtime
```

**Run**:

```bash
# Terminal 1: RAG Service
cd rag_service
./start.sh

# Terminal 2: Backend
cd backend
./start.sh

# Terminal 3: Frontend
cd frontend
npm run dev
```

---

### Production (Backend on Vercel, RAG on AWS)

```env
# Backend .env (or Vercel Environment Variables)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
REALTIME_MODEL=gpt-realtime
SUMMARY_MODEL=gpt-4o-mini
RAG_SERVICE_URL=http://15.206.157.127:3000
PORT=3001

# Frontend .env (or Vercel Environment Variables)
VITE_BACKEND_URL=https://healthyodha-y754.vercel.app
VITE_REALTIME_MODEL=gpt-realtime
```

**Vercel Setup**:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add each variable (no `VITE_` prefix needed for backend)

---

### Production (Backend on EC2, RAG on AWS)

```env
# Backend .env on EC2
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
REALTIME_MODEL=gpt-realtime
SUMMARY_MODEL=gpt-4o-mini
RAG_SERVICE_URL=http://15.206.157.127:3000
PORT=3001

# Frontend .env
VITE_BACKEND_URL=http://15.206.157.127:3001
VITE_REALTIME_MODEL=gpt-realtime
```

**Deploy Backend to EC2**:

```bash
# SSH to EC2
ssh -i mahe-server.pem ubuntu@15.206.157.127

# Upload .env
scp -i mahe-server.pem backend/.env ubuntu@15.206.157.127:~/healthyodha/backend/

# Start backend in tmux
tmux new -s backend
cd ~/healthyodha/backend
npm install
node server.js
# Press Ctrl+B, then D to detach
```

---

## Troubleshooting

### Issue: "OPENAI_API_KEY not found"

**Cause**: `.env` file missing or not in the correct location.

**Solution**:

```bash
cd /home/vinay/projects/freelance/healthyodha/backend
ls -la .env  # Check if file exists
cat .env     # Verify contents
```

---

### Issue: "Failed to connect to RAG service"

**Cause**: `RAG_SERVICE_URL` is incorrect or RAG service is down.

**Solution**:

```bash
# Test RAG service
curl http://15.206.157.127:3000/health

# Check backend logs
cd backend
node server.js
# Look for "RAG_SERVICE_URL: http://..."
```

---

### Issue: "Failed to get session token" (Frontend)

**Cause**: `VITE_BACKEND_URL` is incorrect or backend is down.

**Solution**:

```bash
# Check frontend .env
cd frontend
cat .env
# Verify VITE_BACKEND_URL=https://healthyodha-y754.vercel.app

# Test backend
curl https://healthyodha-y754.vercel.app/session

# Rebuild frontend if .env changed
npm run build
```

**Important**: Vite only reads `.env` files at **build time**. If you change `.env`, you must restart the dev server or rebuild:

```bash
# Development
npm run dev  # Stop (Ctrl+C) and restart

# Production
npm run build
```

---

### Issue: Models are too expensive

**Solution**: Switch to `gpt-4o-mini` for both realtime and summary.

```env
# Backend .env
REALTIME_MODEL=gpt-realtime  # Already uses gpt-4o-realtime (no mini version available)
SUMMARY_MODEL=gpt-4o-mini    # ✅ Already using mini for summaries
```

**Note**: There is currently no "mini" version of the Realtime API. `gpt-4o-realtime-preview` is the only option for speech-to-speech with tool calling.

---

### Issue: Variables not loading

**Checklist**:

- [ ] `.env` file exists in the correct directory
- [ ] `.env` file has correct syntax (no spaces around `=`)
- [ ] Backend: `dotenv.config()` is called before using variables
- [ ] Frontend: Variables start with `VITE_` prefix
- [ ] Frontend: Dev server or build was restarted after `.env` changes
- [ ] No quotes around values (unless value contains spaces)

**Example of correct syntax**:

```env
# ✅ CORRECT
OPENAI_API_KEY=sk-proj-abc123
REALTIME_MODEL=gpt-realtime

# ❌ WRONG
OPENAI_API_KEY = sk-proj-abc123    # No spaces around =
REALTIME_MODEL="gpt-realtime"      # No quotes needed
```

---

## Best Practices

### Security

- ✅ **Never commit `.env` files** to version control
- ✅ Use `.gitignore` to exclude `.env` files
- ✅ Use `.env.example` as a template (without real keys)
- ✅ Rotate API keys regularly
- ✅ Use separate keys for dev/staging/production

### Organization

- ✅ Keep shared config in root `.env`
- ✅ Use service-specific `.env` files for clarity
- ✅ Document all variables in `.env.example`
- ✅ Use comments to explain each variable

### Deployment

- ✅ Use platform-specific environment variable managers:
  - Vercel: Project Settings → Environment Variables
  - AWS: Parameter Store or Secrets Manager
  - Heroku: Config Vars
- ✅ Test environment variables before deploying
- ✅ Keep production values separate from dev values

---

## Summary of Changes

### What Was Changed

**Before**: Hardcoded values in code

```javascript
// ❌ OLD: Hardcoded
model: "gpt-realtime", fetch("https://healthyodha-y754.vercel.app/session");
```

**After**: Environment variables

```javascript
// ✅ NEW: Configurable
model: REALTIME_MODEL, fetch(`${BACKEND_URL}/session`);
```

### Files Modified

- ✅ `backend/server.js`: Added `REALTIME_MODEL`, `SUMMARY_MODEL`, `PORT` from env
- ✅ `frontend/src/App.tsx`: Added `BACKEND_URL`, `REALTIME_MODEL` from env
- ✅ `.env.example`: Created root configuration template
- ✅ `backend/.env.example`: Created backend configuration template
- ✅ `frontend/.env.example`: Created frontend configuration template

### Benefits

- ✅ **Security**: API keys no longer in code
- ✅ **Flexibility**: Easy to switch between dev/prod
- ✅ **Maintainability**: One place to change all URLs and models
- ✅ **Portability**: Works with any deployment platform

---

## Quick Reference Card

```bash
# ============================================
# ENVIRONMENT VARIABLES QUICK REFERENCE
# ============================================

# Backend (.env)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
REALTIME_MODEL=gpt-realtime
SUMMARY_MODEL=gpt-4o-mini
RAG_SERVICE_URL=http://15.206.157.127:3000
PORT=3001

# Frontend (.env)
VITE_BACKEND_URL=https://healthyodha-y754.vercel.app
VITE_REALTIME_MODEL=gpt-realtime

# ============================================
# COMMON COMMANDS
# ============================================

# Setup
cp .env.example .env
nano .env

# Test
cd backend && node server.js
cd frontend && npm run dev

# Deploy
git add .env.example  # ✅ DO commit example
git add .env          # ❌ DON'T commit real env
```

---

**Need Help?**

- Check logs: `console.log` statements show loaded values
- Verify values: Backend logs config on startup
- Test connectivity: Use `curl` to test endpoints
- Restart: Always restart after `.env` changes

---

**Last Updated**: October 26, 2025

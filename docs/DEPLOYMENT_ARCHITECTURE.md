# Hydra Deployment Architecture

## Overview

Hydra uses a distributed architecture with four main components:

1. **Next.js (Vercel)** - Frontend + API routes
2. **Compose Engine (Railway)** - Video processing orchestration
3. **Modal** - Serverless GPU rendering
4. **Inngest** - Background job orchestration (optional)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VERCEL (Next.js Frontend)                           │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   React UI      │    │  API Routes     │    │   Inngest       │         │
│  │   Components    │───▶│  /api/v1/*      │───▶│   Client        │         │
│  └─────────────────┘    └────────┬────────┘    └────────┬────────┘         │
│                                  │                      │                   │
│  Environment Variables:          │                      │                   │
│  - COMPOSE_ENGINE_URL            │                      │                   │
│  - USE_INNGEST_COMPOSE           │                      │                   │
│  - DATABASE_URL                  │                      │                   │
└──────────────────────────────────┼──────────────────────┼───────────────────┘
                                   │                      │
                 ┌─────────────────┘                      │
                 │                                        │
                 │    ┌───────────────────────────────────┘
                 │    │
                 ▼    ▼
┌────────────────────────────────────┐    ┌───────────────────────────────────┐
│        RAILWAY (Compose Engine)    │    │         INNGEST CLOUD             │
│                                    │    │                                   │
│  FastAPI Application               │    │  ┌─────────────────────────┐     │
│  ┌──────────────────────────────┐  │    │  │  Event Queue            │     │
│  │  /render/auto                │  │◀───│  │  - video/compose        │     │
│  │  /job/{id}/status            │  │    │  │  - video/generate       │     │
│  └──────────────┬───────────────┘  │    │  │  - publish/tiktok       │     │
│                 │                  │    │  └─────────────────────────┘     │
│  Environment Variables:            │    │                                   │
│  - MODAL_ENABLED=true             │    │  Features:                        │
│  - MODAL_SUBMIT_URL               │    │  - Automatic retries              │
│  - MODAL_STATUS_URL               │    │  - Progress monitoring            │
│  - AWS_ACCESS_KEY_ID              │    │  - Dashboard visibility           │
│  - AWS_SECRET_ACCESS_KEY          │    │  - Rate limiting                  │
└──────────────────┬─────────────────┘    └───────────────────────────────────┘
                   │
                   │ MODAL_ENABLED=true
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODAL (Serverless GPU)                            │
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │  submit_render              │    │  get_render_status          │        │
│  │  (POST endpoint)            │    │  (GET endpoint)             │        │
│  └──────────────┬──────────────┘    └─────────────────────────────┘        │
│                 │                                                           │
│                 ▼                                                           │
│  ┌─────────────────────────────┐                                           │
│  │  render_video               │    Resources:                             │
│  │  - NVIDIA T4 GPU            │    - GPU: T4 (NVENC encoding)             │
│  │  - FFmpeg + MoviePy         │    - Memory: 8GB                          │
│  │  - 5-10x faster encoding    │    - Timeout: 600s                        │
│  └──────────────┬──────────────┘    - Scales to zero                       │
│                 │                                                           │
│  Secrets:       │                                                           │
│  - aws-s3-secret│                                                           │
└─────────────────┼───────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS S3 Storage                                 │
│                         (hydra-assets-hybe bucket)                          │
│                                                                             │
│  compose/renders/{generationId}/output.mp4                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow

### Video Composition Request

```
1. User clicks "Generate Video" in UI
   │
2. Frontend calls POST /api/v1/compose/render
   │
3. Next.js API route:
   ├── Creates VideoGeneration record in Supabase
   ├── If USE_INNGEST_COMPOSE=true:
   │   └── Sends "video/compose" event to Inngest
   └── If USE_INNGEST_COMPOSE=false:
       └── Calls Railway compose-engine directly
   │
4. Compose Engine receives request:
   ├── If MODAL_ENABLED=true:
   │   └── POSTs to Modal submit_render endpoint
   └── If MODAL_ENABLED=false:
       └── Renders locally (slow, CPU only)
   │
5. Modal (if enabled):
   ├── Spawns GPU container with T4
   ├── Downloads images from S3
   ├── Downloads audio from S3
   ├── Renders video with MoviePy + NVENC
   └── Uploads result to S3
   │
6. Frontend polls GET /api/v1/compose/{id}/status
   │
7. When complete, UI shows video player with S3 URL
```

---

## Component Details

### 1. Next.js (Vercel)

**Purpose:** Frontend UI and API gateway

**Key Files:**
- `app/api/v1/compose/render/route.ts` - Start render job
- `app/api/v1/compose/[id]/status/route.ts` - Poll job status
- `lib/inngest/functions.ts` - Inngest function definitions
- `lib/inngest/client.ts` - Inngest event types

**Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://...

# Compose Engine (Railway URL after deployment)
COMPOSE_ENGINE_URL=https://compose-engine-xxx.up.railway.app

# Feature Flags
USE_MODAL_RENDER=true        # Tell compose-engine to use Modal
USE_INNGEST_COMPOSE=false    # Use Inngest for orchestration

# Inngest (if enabled)
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

### 2. Compose Engine (Railway)

**Purpose:** Video processing orchestration and job management

**Key Files:**
- `app/main.py` - FastAPI application
- `app/routers/render.py` - Render endpoints
- `app/services/video_renderer.py` - Local rendering (fallback)
- `app/services/modal_client.py` - Modal HTTP client
- `app/utils/job_queue.py` - Redis job tracking

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/render` | POST | Local rendering only |
| `/render/auto` | POST | Auto-select Modal or local |
| `/render/modal` | POST | Force Modal rendering |
| `/job/{id}/status` | GET | Get job status |
| `/health` | GET | Health check |

**Environment Variables:**
```bash
# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=hydra-assets-hybe

# Redis (Railway provides this)
REDIS_URL=redis://...

# Modal Integration
MODAL_ENABLED=true
MODAL_SUBMIT_URL=https://modawnai--hydra-compose-engine-submit-render.modal.run
MODAL_STATUS_URL=https://modawnai--hydra-compose-engine-get-render-status.modal.run
```

### 3. Modal (Serverless GPU)

**Purpose:** GPU-accelerated video rendering

**Key Files:**
- `backend/compose-engine/modal_app.py` - Modal application

**Functions:**
| Function | Type | Description |
|----------|------|-------------|
| `render_video` | GPU (T4) | Main rendering function |
| `render_video_cpu` | CPU | Fallback rendering |
| `submit_render` | Web endpoint | Accept render jobs |
| `get_render_status` | Web endpoint | Poll job status |

**Endpoints (auto-generated):**
- `https://modawnai--hydra-compose-engine-submit-render.modal.run`
- `https://modawnai--hydra-compose-engine-get-render-status.modal.run`

**Secrets Required:**
```bash
# Create in Modal dashboard or CLI
modal secret create aws-s3-secret \
  AWS_ACCESS_KEY_ID=... \
  AWS_SECRET_ACCESS_KEY=... \
  AWS_REGION=ap-southeast-2 \
  AWS_S3_BUCKET=hydra-assets-hybe
```

### 4. Inngest (Optional)

**Purpose:** Background job orchestration with retries and monitoring

**Key Functions:**
| Function | Event | Description |
|----------|-------|-------------|
| `composeVideo` | `video/compose` | Compose video with images + audio |
| `generateVideo` | `video/generate` | Generate video with Veo 3 |
| `generateVideoFromImage` | `video/generate.from-image` | I2V generation |
| `publishToTikTok` | `publish/tiktok` | Publish to TikTok |

**Benefits:**
- Automatic retries on failure
- Visual dashboard for monitoring
- Rate limiting and concurrency control
- Event replay for debugging

---

## Deployment Steps

### Step 1: Deploy Modal (Serverless GPU)

```bash
# 1. Install Modal CLI
pip install modal

# 2. Login to Modal
modal token new

# 3. Create AWS secret in Modal
modal secret create aws-s3-secret \
  AWS_ACCESS_KEY_ID=AKIASBF5YXJFHLVFVGQR \
  AWS_SECRET_ACCESS_KEY=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 \
  AWS_REGION=ap-southeast-2 \
  AWS_S3_BUCKET=hydra-assets-hybe

# 4. Deploy
cd backend/compose-engine
modal deploy modal_app.py

# 5. Note the endpoints:
# - https://modawnai--hydra-compose-engine-submit-render.modal.run
# - https://modawnai--hydra-compose-engine-get-render-status.modal.run
```

### Step 2: Deploy Compose Engine (Railway)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create project and deploy
cd backend/compose-engine
railway init
railway up

# 4. Set environment variables in Railway dashboard:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - AWS_REGION
# - AWS_S3_BUCKET
# - MODAL_ENABLED=true
# - MODAL_SUBMIT_URL=https://modawnai--hydra-compose-engine-submit-render.modal.run
# - MODAL_STATUS_URL=https://modawnai--hydra-compose-engine-get-render-status.modal.run

# 5. Note the Railway URL:
# - https://compose-engine-xxx.up.railway.app
```

### Step 3: Setup Inngest (Optional)

```bash
# 1. Sign up at https://inngest.com

# 2. Create an app in Inngest dashboard

# 3. Get your keys:
# - Event Key (for sending events)
# - Signing Key (for webhook verification)

# 4. Add to Vercel environment variables:
# - INNGEST_EVENT_KEY=...
# - INNGEST_SIGNING_KEY=...
# - USE_INNGEST_COMPOSE=true
```

### Step 4: Deploy Next.js (Vercel)

```bash
# 1. Push code to GitHub
git add .
git commit -m "Add Modal/Railway/Inngest integration"
git push

# 2. In Vercel dashboard, set environment variables:
COMPOSE_ENGINE_URL=https://compose-engine-xxx.up.railway.app
USE_MODAL_RENDER=true
USE_INNGEST_COMPOSE=true  # if using Inngest

# If using Inngest:
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# 3. Deploy (automatic on push, or manual)
vercel --prod
```

---

## Local Development

### Option A: Full Local Stack

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Compose Engine
cd backend/compose-engine
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 3: Redis (for job queue)
docker run -p 6379:6379 redis:alpine

# Terminal 4: Inngest Dev Server (optional)
npx inngest-cli@latest dev
```

### Option B: Local Frontend + Cloud Backend (Recommended)

```bash
# Terminal 1: Next.js only
npm run dev

# .env.local
COMPOSE_ENGINE_URL=https://compose-engine-xxx.up.railway.app
USE_MODAL_RENDER=true
```

This uses Railway + Modal for rendering while developing the frontend locally.

---

## Environment Variables Summary

### Next.js (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL URL |
| `COMPOSE_ENGINE_URL` | Yes | Railway compose-engine URL |
| `USE_MODAL_RENDER` | No | Enable Modal in compose-engine (default: false) |
| `USE_INNGEST_COMPOSE` | No | Use Inngest for orchestration (default: false) |
| `INNGEST_EVENT_KEY` | If Inngest | Inngest event key |
| `INNGEST_SIGNING_KEY` | If Inngest | Inngest signing key |

### Compose Engine (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS secret key |
| `AWS_REGION` | Yes | AWS region (ap-southeast-2) |
| `AWS_S3_BUCKET` | Yes | S3 bucket name |
| `REDIS_URL` | Yes | Redis connection URL |
| `MODAL_ENABLED` | No | Enable Modal rendering (default: false) |
| `MODAL_SUBMIT_URL` | If Modal | Modal submit endpoint |
| `MODAL_STATUS_URL` | If Modal | Modal status endpoint |

### Modal (Secrets)

| Secret Name | Variables |
|-------------|-----------|
| `aws-s3-secret` | AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET |

---

## Troubleshooting

### Modal not rendering

1. Check Modal dashboard for errors: https://modal.com/apps
2. Verify secret exists: `modal secret list`
3. Check logs: `modal app logs hydra-compose-engine`

### Railway deployment failing

1. Check build logs in Railway dashboard
2. Verify requirements.txt has compatible versions
3. Check for missing environment variables

### Inngest events not processing

1. Check Inngest dashboard: https://app.inngest.com
2. Verify webhook URL is registered: `/api/inngest`
3. Check signing key matches

### Video not uploading to S3

1. Verify AWS credentials are correct
2. Check S3 bucket permissions
3. Ensure bucket exists in correct region

---

## Cost Considerations

| Service | Pricing | Notes |
|---------|---------|-------|
| Vercel | Free tier available | Hobby: Free, Pro: $20/mo |
| Railway | $5/mo + usage | ~$0.000463/min for compute |
| Modal | Pay per use | GPU T4: ~$0.000164/sec |
| Inngest | Free tier available | 25k events/mo free |
| AWS S3 | Pay per use | ~$0.023/GB storage |

**Typical video render cost:** ~$0.01-0.05 per video (Modal GPU time)

---

## Security Notes

1. **Never commit .env files** - Use environment variables in dashboards
2. **Rotate AWS keys periodically** - Update in all services
3. **Use least privilege** - S3 bucket should only allow specific operations
4. **Enable HTTPS** - All services use HTTPS by default
5. **Validate webhooks** - Inngest signing key prevents spoofing

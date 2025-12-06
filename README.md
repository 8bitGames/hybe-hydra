# HYBE HYDRA

Enterprise AI Video Orchestration Platform

Veo 3 기반의 숏폼 대량 생산 및 최적화 자동화 파이프라인

## Tech Stack

### Frontend
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy 2.0 (Async)
- Celery + Redis

### Database
- PostgreSQL 16
- Redis 7
- Pinecone (Vector DB)

### Storage
- AWS S3 / MinIO (개발용)

### AI/ML
- Google Vertex AI (Veo 3, Gemini Pro)
- LangChain

## Quick Start

### 1. Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+
- Poetry

### 2. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO (port 9000, console: 9001)

### 3. Start Backend

```bash
cd backend
cp .env.example .env
poetry install
poetry run uvicorn app.main:app --reload
```

Backend API: http://localhost:8000
Swagger Docs: http://localhost:8000/docs

### 4. Start Frontend

```bash
npm install
npm run dev
```

Frontend: http://localhost:3000

## Project Structure

```
hybe-hydra/
├── app/                    # Next.js Frontend (App Router)
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages
│   └── page.tsx           # Home page
├── backend/               # FastAPI Backend
│   ├── app/
│   │   ├── api/v1/       # API endpoints
│   │   ├── core/         # Config, DB, Security
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic
│   └── pyproject.toml
├── claudedocs/           # Development documentation
├── docker-compose.yml
└── package.json
```

## Development Milestones

- [x] M1: Project Infrastructure
- [ ] M2: Authentication System
- [ ] M3: Campaign & Asset Upload
- [ ] M4: Vector Embedding (RAG)
- [ ] M5: Veo 3 Single Generation
- [ ] M6: Prompt Alchemist
- [ ] M7: Parallel Generation (1:15)
- [ ] M8: AI Scoring
- [ ] M9: Curation Dashboard
- [ ] M10: Publishing & Scheduling

## API Endpoints

### Health Check
- `GET /health` - Application health
- `GET /health/db` - Database connection
- `GET /health/redis` - Redis connection

### Authentication (M2)
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/users/me`

### Campaigns (M3)
- `GET /api/v1/campaigns`
- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns/{id}`

### Assets (M3)
- `POST /api/v1/campaigns/{id}/assets`
- `GET /api/v1/campaigns/{id}/assets`

## License

Proprietary - HYBE Corporation

Admin: admin@hydra.com / admin123
Producer: producer@hydra.com / producer123


Initial Hypothesis for pilot - can AI TT content perform better than the as-is non-AI accounts in terms of engagement, conversion to stream. The accounts are all fan accounts (run by BMLG's team), not the artist official. 

Target Artists: 1) Carly Pearce 2) Thomas Rhett 3) The Band Perry — all three of whom are either signed to BMLG (under HYBE) or we have their catalog rights 

Non-AI Catalog accounts for comparison: 
- https://www.tiktok.com/@carlysnextgirl
- https://www.tiktok.com/@trfansforever

AI TT accounts: 
- https://www.tiktok.com/@writteninstonecold
- https://www.tiktok.com/@talentedtr
- https://www.tiktok.com/@postcardsfromperry

Non-AI Main accounts from BMLG (not artist- specific): 
- https://www.tiktok.com/@honkytoktreasures
- https://www.tiktok.com/@honkytonkwhiskey


supabase pw : MkVvrXtT_Q8Uz4



AI-powered platform to create and manage marketing video content for social media campaigns.



Hydra is an AI-powered video content creation platform for social media marketing.
Website: https://hydra.ai.kr

=== Login Kit ===
Purpose: Allow users to connect their TikTok account
Flow: Dashboard → "Connect TikTok" button → TikTok OAuth → Redirect back
Scope: user.info.basic (display connected account name and avatar)

=== Content Posting API ===
Purpose: Upload AI-generated videos to user's TikTok drafts
Flow: Create video → "Upload to TikTok" → Video saved to drafts → User edits and publishes
Scope: video.upload

All features require explicit user action and consent. No automated posting.



📹 데모 영상 제작 가이드
필수 촬영 내용
1. Login Kit 시연 (약 30초)
hydra.ai.kr 접속 화면
"TikTok 연결" 버튼 클릭
TikTok 로그인/권한 승인 화면
연결 완료 후 계정 정보 표시
2. Content Posting API 시연 (약 1분)
AI로 영상 생성하는 과정
"TikTok에 업로드" 버튼 클릭
TikTok 초안함에 저장되는 화면
TikTok 앱에서 초안 확인
3. Share Kit 시연 (약 30초)
생성된 영상에서 "공유" 버튼 클릭
TikTok 공유 화면 열림
사용자가 게시하는 과정
영상 요구사항
형식: MP4 또는 MOV
크기: 각 50MB 이하
개수: 최대 5개
도메인: 영상에 보이는 URL이 hydra.ai.kr과 일치해야 함
환경: Sandbox 환경 사용 (앱 미승인 상태)
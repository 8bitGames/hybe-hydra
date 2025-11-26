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

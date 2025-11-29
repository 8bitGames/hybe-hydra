# HYBE HYDRA - 종합 개발 계획서

**문서 버전**: 1.2
**작성일**: 2024-11-27
**최종 수정일**: 2024-11-28 (Publishing Scheduler 완료)
**프로젝트명**: HYBE HYDRA (Enterprise AI Video Orchestration Platform)

---

## 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [모듈 의존성 맵](#2-모듈-의존성-맵)
3. [기술 스택 상세](#3-기술-스택-상세)
4. [Phase 1: MVP 개발 계획](#4-phase-1-mvp-개발-계획)
5. [Phase 2: Automation 개발 계획](#5-phase-2-automation-개발-계획)
6. [Phase 3: Integration 개발 계획](#6-phase-3-integration-개발-계획)
7. [데이터베이스 스키마 설계](#7-데이터베이스-스키마-설계)
8. [API 설계 명세](#8-api-설계-명세)
9. [Prompt Alchemist 전략](#9-prompt-alchemist-전략)
10. [인프라 및 DevOps](#10-인프라-및-devops)
11. [테스트 전략](#11-테스트-전략)
12. [보안 요구사항](#12-보안-요구사항)

---

## 1. 시스템 아키텍처 개요

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HYBE HYDRA PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND LAYER                               │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐   │   │
│  │  │ Dashboard │ │  Asset    │ │ Curation  │ │   Publishing      │   │   │
│  │  │  (Bridge) │ │  Locker   │ │   View    │ │   Scheduler       │   │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘   │   │
│  │                    React.js + TypeScript + Tailwind CSS              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                              REST API / WebSocket                            │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         BACKEND LAYER                                │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │   Campaign  │ │   Prompt    │ │   Hydra     │ │  Publishing │   │   │
│  │  │   Service   │ │  Alchemist  │ │   Engine    │ │   Service   │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  │                   Next.js 16 API Routes + Prisma ORM                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      TASK QUEUE LAYER                                │   │
│  │              Redis + BullMQ (Video Rendering Queue)                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       AI/ML LAYER                                    │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │  Veo 3     │ │ Gemini Pro  │ │  LangChain  │ │  OpenPose   │   │   │
│  │  │  Engine    │ │  Vision     │ │  Prompt     │ │  Skeleton   │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  │                   Google Vertex AI + Custom ML                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      DATA LAYER                                      │   │
│  │  ┌─────────────────────────┐ ┌─────────────────────────────────┐   │   │
│  │  │      PostgreSQL 16      │ │      AWS S3 / GCS               │   │   │
│  │  │   (RDBMS + Full-text)   │ │   (Hot/Cold Storage)            │   │   │
│  │  └─────────────────────────┘ └─────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 데이터 흐름도

```
┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  User    │───▶│  Campaign    │───▶│  Asset Locker   │───▶│  S3/GCS      │
│  Input   │    │  Creation    │    │  (Metadata DB)  │    │  Storage     │
└──────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
                                              │
                                              ▼
┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Trend   │───▶│   Prompt     │───▶│  Safety Filter  │───▶│ Optimized    │
│  Feeder  │    │  Alchemist   │    │  (LLM Check)    │    │ Veo Prompt   │
└──────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
                                              │
                                              ▼
┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Celery  │◀───│ Hydra Engine │───▶│  Veo 3 API      │───▶│ 15 Video     │
│  Queue   │    │ (15 Heads)   │    │  (Parallel)     │    │ Variants     │
└──────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
                                              │
                                              ▼
┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  User    │◀───│  Curation    │◀───│  AI Scoring     │◀───│  S3/GCS      │
│  Review  │    │  Dashboard   │    │  (Viral Score)  │    │  Storage     │
└──────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
                                              │
                                              ▼
┌──────────┐    ┌──────────────┐    ┌─────────────────┐
│ TikTok/  │◀───│  Publishing  │◀───│  Smart Crop     │
│ YouTube  │    │  Scheduler   │    │  + Caption      │
└──────────┘    └──────────────┘    └─────────────────┘
```

---

## 2. 모듈 의존성 맵

### 2.1 모듈 계층 구조

```
Level 0 (Foundation)
├── FR-01: Campaign Management & Asset Locker
│   ├── Campaign CRUD Service
│   ├── Asset Upload Service
│   ├── Metadata Search Service
│   └── RBAC Integration
│
Level 1 (Input & Processing)
├── FR-02: Trend Feeder & Prompt Alchemist
│   ├── TikTok/YouTube API Collector
│   ├── Gemini Pro Vision Analyzer
│   ├── Prompt Optimization Engine
│   └── Safety Filter Service
│   └── [의존] → FR-01 (Asset Locker 참조)
│
Level 2 (Core Generation)
├── FR-03: Hydra Synthesis Engine
│   ├── Parallel Generation Controller
│   ├── Veo 3 API Integration
│   ├── Style Preset Manager
│   └── Motion Transfer Engine (OpenPose)
│   └── [의존] → FR-01, FR-02
│
Level 3 (Review & Optimization)
├── FR-04: Curation Dashboard & Scoring
│   ├── Mosaic Viewer Component
│   ├── AI Scoring Algorithm
│   ├── A/B Comparison View
│   └── Refine/Inpainting Service
│   └── [의존] → FR-01, FR-02, FR-03
│
Level 4 (Output)
├── FR-05: Publishing & Analytics
│   ├── Smart Crop Service
│   ├── Caption/Hashtag Generator
│   ├── Publishing Scheduler
│   └── SNS API Integration
│   └── [의존] → FR-01, FR-02, FR-03, FR-04
```

### 2.2 서비스 의존성 매트릭스

| 서비스 | PostgreSQL | S3/GCS | Redis | Vertex AI | External APIs |
|--------|------------|--------|-------|-----------|---------------|
| Campaign Service | ✅ | ✅ | - | - | - |
| Asset Locker | ✅ | ✅ | - | - | - |
| Trend Feeder | ✅ | - | ✅ | ✅ (Vision) | TikTok, YouTube |
| Prompt Alchemist | ✅ | - | - | ✅ (Gemini) | - |
| Hydra Engine | ✅ | ✅ | ✅ | ✅ (Veo 3) | - |
| Scoring Service | ✅ | ✅ | - | ✅ (ML) | - |
| Publishing | ✅ | ✅ | ✅ | ✅ (LLM) | TikTok, YouTube |

---

## 3. 기술 스택 상세

### 3.1 Frontend Stack

```yaml
Framework: Next.js 16 (App Router)
Language: TypeScript 5.x
Styling: Tailwind CSS 4.x
State Management: Zustand / TanStack Query
UI Components:
  - Radix UI (Primitives)
  - Shadcn/ui (Component Library)
Video Player: Video.js / React Player
Real-time: Socket.io Client
Charts: Recharts / Tremor
File Upload: React Dropzone + TUS Protocol
```

### 3.2 Backend Stack

```yaml
Framework: Next.js 16 API Routes (App Router)
Language: TypeScript 5.x
Runtime: Node.js 20+ (Edge Compatible)
ORM: Prisma 7.x
Database: PostgreSQL 16
Validation: TypeScript Types + Prisma Schema
Authentication:
  - JWT (jsonwebtoken)
  - Password Hashing (bcryptjs)
  - RBAC (Custom Implementation with Label-based Access)
Storage:
  - AWS S3 SDK (@aws-sdk/client-s3)
  - Pre-signed URLs (@aws-sdk/s3-request-presigner)
  - MinIO (S3 Compatible for Local Dev)
Task Queue: BullMQ + Redis (Phase 2)
Caching: Redis 7.x
State Management: Zustand (Client-side API State)
```

### 3.3 AI/ML Stack

```yaml
Orchestration: Google Vertex AI
Video Generation: Veo 3 API
LLM:
  - Gemini 1.5 Pro (Prompt Alchemist)
  - Gemini Pro Vision (Trend Analysis)
Prompt Engineering: LangChain 0.2+
Computer Vision:
  - OpenPose (Skeleton Extraction)
  - OpenCV 4.x (Video Processing)
  - MediaPipe (Alternative)
ML Framework: PyTorch 2.x (Scoring Model)
```

### 3.4 Database Stack

```yaml
RDBMS: PostgreSQL 16
  - Extensions: pg_trgm (Full-text search), pg_cron
  - Full-text Search: tsvector + GIN index
Cache: Redis 7.x
  - Pub/Sub for real-time updates
  - Sorted Sets for job queue
```

### 3.5 Infrastructure Stack

```yaml
Container: Docker + Docker Compose
Orchestration: Kubernetes (GKE/EKS)
CI/CD: GitHub Actions / Cloud Build
Storage:
  - Hot: S3/GCS Standard
  - Cold: S3 Glacier / GCS Archive
CDN: CloudFront / Cloud CDN
Monitoring:
  - Prometheus + Grafana
  - Google Cloud Monitoring
Logging: ELK Stack / Cloud Logging
Secret Management: HashiCorp Vault / Secret Manager
```

---

## 4. Phase 1: MVP 개발 계획 ✅ COMPLETED

### 4.1 Phase 1 목표
- ✅ Asset Locker 구축
- ✅ 기본 프롬프트 입력 → 단일 영상 생성
- ✅ Veo 3 API 연동

### 4.2 Phase 1 작업 분해 (WBS)

#### Sprint 1-1: 프로젝트 초기화 및 인프라 설정 (1주) ✅

```
Task 1.1.1: 모노레포 구조 설정
├── /frontend (Next.js)
├── /backend (FastAPI)
├── /shared (공통 타입/유틸)
├── /infra (Terraform/K8s configs)
└── /docs (문서)

Task 1.1.2: 개발 환경 구성
├── Docker Compose 설정 (docker-compose.yml)
│   ├── PostgreSQL 16 (port: 5434)
│   ├── Redis 7 (port: 6380)
│   └── MinIO (S3 호환, ports: 9000, 9001)
├── Prisma 설정
│   ├── schema.prisma (모델 정의)
│   ├── prisma migrate dev (마이그레이션)
│   └── prisma db seed (시드 데이터)
├── 환경 변수 관리 (.env.local)
└── ESLint + TypeScript 설정

Task 1.1.3: CI/CD 파이프라인 구축
├── GitHub Actions 워크플로우
│   ├── PR 검증 (lint, test, build)
│   ├── 스테이징 배포
│   └── 프로덕션 배포
└── 환경별 설정 분리
```

#### Sprint 1-2: 데이터베이스 및 인증 (1주) ✅

```
Task 1.2.1: PostgreSQL 스키마 구현
├── Prisma 스키마 정의 (schema.prisma)
├── 모델 생성
│   ├── User (RBAC: ADMIN, PRODUCER, VIEWER)
│   ├── Label (하이브 레이블)
│   ├── Artist
│   ├── Campaign
│   ├── Asset
│   └── VideoGeneration
├── Prisma Migrate로 마이그레이션
└── 초기 시드 데이터 (seed.ts)

Task 1.2.2: 인증 시스템 구현
├── JWT 기반 인증 (lib/auth.ts)
│   ├── bcryptjs 패스워드 해싱
│   ├── jsonwebtoken 토큰 생성/검증
│   ├── Access Token (30분)
│   └── Refresh Token (7일)
├── API Routes 인증
│   ├── POST /api/v1/auth/register
│   ├── POST /api/v1/auth/login
│   └── POST /api/v1/auth/refresh
└── RBAC 구현
    ├── Role: ADMIN, PRODUCER, VIEWER
    └── Permission: labelIds 기반 접근 제어
```

#### Sprint 1-3: Asset Locker 백엔드 (1.5주) ✅

```
Task 1.3.1: Asset Upload Service
├── Multipart Upload 구현
│   ├── 청크 업로드 (TUS Protocol)
│   ├── 파일 타입 검증
│   │   ├── 이미지: jpg, png (max 20MB)
│   │   ├── 비디오: mp4, ProRes (max 2GB)
│   │   └── 오디오: wav (max 500MB)
│   └── 바이러스 스캔 (ClamAV)
├── S3/GCS 업로드 처리
│   ├── Pre-signed URL 발급
│   └── 업로드 완료 콜백
└── 메타데이터 저장 (PostgreSQL)

Task 1.3.2: Asset Locker API
├── POST /api/v1/campaigns/{id}/assets (업로드)
├── GET /api/v1/campaigns/{id}/assets (목록)
├── GET /api/v1/assets/{id} (상세)
├── DELETE /api/v1/assets/{id} (삭제)
└── GET /api/v1/assets/search (메타데이터 검색)
```

#### Sprint 1-4: 캠페인 관리 시스템 (1주) ✅

```
Task 1.4.1: Campaign CRUD API
├── POST /api/v1/campaigns (생성)
│   ├── 입력: name, artist_id, target_countries, date_range
│   └── RBAC: label 기반 아티스트 필터링
├── GET /api/v1/campaigns (목록)
│   └── 필터: status, artist_id, date_range
├── GET /api/v1/campaigns/{id} (상세)
├── PATCH /api/v1/campaigns/{id} (수정)
└── DELETE /api/v1/campaigns/{id} (삭제)

Task 1.4.2: Artist Management
├── GET /api/v1/artists (목록, RBAC 필터)
├── GET /api/v1/artists/{id} (상세)
└── Artist Profile 구조
    ├── 기본 정보 (이름, 그룹)
    ├── 시각적 특성 (Vector Embedding 참조)
    └── 브랜드 가이드라인 (Text)
```

#### Sprint 1-5: Veo 3 API 연동 (1주) ✅

```
Task 1.5.1: Vertex AI 클라이언트 설정
├── 서비스 계정 설정
├── API 클라이언트 래퍼
└── Rate Limiting 구현

Task 1.5.2: Veo 3 Video Generation
├── Text-to-Video API 연동
│   ├── 프롬프트 전송
│   ├── 작업 ID 수신
│   └── 폴링/웹훅 결과 수신
├── 비동기 작업 관리
│   ├── Celery Task 정의
│   └── 상태 추적 (pending → processing → completed/failed)
└── 결과 저장
    ├── S3/GCS 업로드
    └── 메타데이터 DB 저장

Task 1.5.3: 단일 영상 생성 API
├── POST /api/v1/projects (프로젝트 생성)
│   └── 입력: campaign_id, user_input (기본 프롬프트)
├── POST /api/v1/projects/{id}/generate (생성 시작)
├── GET /api/v1/projects/{id}/status (상태 조회)
└── GET /api/v1/projects/{id}/variants (결과 조회)
```

#### Sprint 1-6: Frontend MVP (1.5주) ✅

```
Task 1.6.1: 프로젝트 구조 설정
├── Next.js App Router 구조
│   ├── /app
│   │   ├── /(auth)/login
│   │   ├── /(dashboard)/
│   │   │   ├── campaigns/
│   │   │   ├── assets/
│   │   │   └── projects/
│   │   └── layout.tsx
│   ├── /components
│   │   ├── ui/ (shadcn)
│   │   └── features/
│   └── /lib
│       ├── api/
│       └── hooks/
├── Tailwind CSS 설정
└── 컴포넌트 라이브러리 설치 (shadcn/ui)

Task 1.6.2: 인증 UI
├── 로그인 페이지
├── OAuth 리다이렉트 처리
└── 인증 상태 관리 (Zustand)

Task 1.6.3: 캠페인 관리 UI
├── 캠페인 목록 페이지
│   ├── 테이블 뷰
│   ├── 필터/검색
│   └── 페이지네이션
├── 캠페인 생성 마법사
│   ├── Step 1: 기본 정보
│   ├── Step 2: 아티스트 선택
│   └── Step 3: 타겟 설정
└── 캠페인 상세 페이지

Task 1.6.4: Asset Locker UI
├── 에셋 업로드 컴포넌트
│   ├── 드래그 앤 드롭
│   ├── 업로드 진행률
│   └── 미리보기
├── 에셋 갤러리 뷰
│   ├── 그리드 레이아웃
│   ├── 타입별 필터
│   └── 썸네일 생성
└── 에셋 상세 모달

Task 1.6.5: 영상 생성 UI (Basic)
├── 프롬프트 입력 폼
├── 생성 상태 표시
└── 단일 결과 뷰어
```

### 4.3 Phase 1 마일스톤

| 주차 | 마일스톤 | 산출물 | 상태 |
|------|----------|--------|------|
| 1주 | 인프라 완료 | Docker 환경, CI/CD | ✅ |
| 2주 | 인증/DB 완료 | 로그인, RBAC 동작 | ✅ |
| 3-4주 | Asset Locker | 업로드 → 임베딩 파이프라인 | ✅ |
| 5주 | Veo 3 연동 | 단일 영상 생성 | ✅ |
| 6주 | Frontend MVP | 전체 플로우 E2E 동작 | ✅ |

---

## 5. Phase 2: Automation 개발 계획 🔄 IN PROGRESS

### 5.1 Phase 2 목표
- ✅ Prompt Alchemist (LLM) 통합
- ✅ 1:N 병렬 생성 엔진
- ✅ AI Scoring 알고리즘 구현

### 5.2 Phase 2 작업 분해 (WBS)

#### Sprint 2-1: Trend Feeder 구현 (1주) ✅

```
Task 2.1.1: External API Integration
├── TikTok API 연동
│   ├── TikTok Research API 신청/설정
│   ├── 해시태그 검색 (top 50)
│   └── 영상 메타데이터 수집
├── YouTube Data API 연동
│   ├── API 키 설정
│   ├── 트렌드 영상 검색
│   └── 메타데이터 추출
└── 스케줄러 (Celery Beat)
    └── 일간 트렌드 수집 작업

Task 2.1.2: Video Analysis Pipeline
├── Gemini Pro Vision 연동
│   ├── 영상 프레임 추출 (1fps)
│   ├── 시각적 컨셉 분석
│   └── 키워드 추출
├── 오디오 분석
│   ├── BPM 추출 (librosa)
│   └── 주요 주파수 특성
└── 컷 전환 분석
    └── Scene Change Detection (OpenCV)

Task 2.1.3: Trend Data Model
├── trend_snapshots 테이블
│   ├── id, platform, keyword, rank
│   ├── collected_at, region
│   └── metadata (JSON)
└── API: GET /api/v1/trends?platform=&region=
```

#### Sprint 2-2: Prompt Alchemist 구현 (1.5주) ✅

```
Task 2.2.1: LangChain 기반 Prompt Engine
├── System Prompt 템플릿 관리
│   ├── HYDRA_ALCHEMIST_SYSTEM_PROMPT.md
│   └── 버전 관리 (DB 저장)
├── LangChain Chain 구성
│   ├── Input Preprocessor
│   │   └── user_input + artist_profile + trends
│   ├── Safety Filter Chain
│   │   └── 위험 키워드 탐지
│   ├── Expansion Chain
│   │   └── Veo 최적화 프롬프트 생성
│   └── Output Parser
│       └── JSON 구조화
└── Gemini Pro 연동
    ├── 프롬프트 전송
    └── 응답 파싱

Task 2.2.2: Safety Filter 구현
├── 금지어 사전 관리
│   ├── violence_keywords
│   ├── nsfw_keywords
│   └── brand_negative_keywords
├── LLM 기반 의미 분석
│   └── 맥락적 위험도 평가
└── Blocked Response 처리
    └── 사유 제공 + 대안 제시

Task 2.2.3: Artist Profile 연동
├── Artist Profile 동적 주입
│   ├── DB에서 아티스트 프로필 조회
│   └── profile_description, brand_guidelines 활용
├── Negative Prompting 자동 생성
│   └── "NOT [타 아티스트 특성]"
└── Image Guidance 파라미터 설정
    └── guidance_scale, image_reference

Task 2.2.4: Prompt Alchemist API
├── POST /api/v1/prompts/transform
│   ├── Input: user_input, campaign_id, trend_ids
│   └── Output: optimized_prompt, negative_prompt, settings
├── GET /api/v1/prompts/{id}/preview
│   └── 변환된 프롬프트 미리보기
└── POST /api/v1/prompts/{id}/approve
    └── 프롬프트 승인 → 생성 단계로
```

#### Sprint 2-3: Hydra 병렬 생성 엔진 (1.5주) ✅

```
Task 2.3.1: Style Preset 시스템
├── presets 테이블 설계
│   ├── id, name, category
│   ├── parameters (JSON)
│   │   ├── contrast, saturation
│   │   ├── color_grading
│   │   └── motion_intensity
│   └── is_active
├── 기본 프리셋 구현
│   ├── High Contrast (강렬함)
│   ├── Soft/Pastel (감성)
│   ├── Dynamic Motion (역동성)
│   ├── Cinematic Film (시네마틱)
│   └── ... (10-15개)
└── 프리셋 관리 API

Task 2.3.2: Parallel Generation Controller
├── Celery Task Group 설계
│   ├── generate_variant_task
│   │   ├── project_id, preset_id
│   │   └── priority 관리
│   └── group() 호출로 15개 동시 실행
├── Veo 3 Rate Limiting
│   ├── 동시 호출 제한 (10-15)
│   └── 재시도 로직 (exponential backoff)
└── 진행 상태 관리
    ├── Redis Pub/Sub (실시간)
    └── WebSocket 클라이언트 통보

Task 2.3.3: Generation Job Management
├── video_variants 테이블
│   ├── id, project_id, style_preset_id
│   ├── veo_job_id, status
│   ├── s3_url, duration
│   └── ai_score (nullable)
├── 상태 전이
│   └── queued → processing → completed/failed
└── 실패 처리
    ├── 자동 재시도 (max 3)
    └── 부분 성공 허용

Task 2.3.4: Generation APIs
├── POST /api/v1/projects/{id}/generate-batch
│   ├── Input: approved_prompt_id, preset_ids[]
│   └── Output: job_group_id
├── GET /api/v1/projects/{id}/generation-status
│   └── 실시간 진행률
└── WebSocket /ws/projects/{id}/status
    └── 생성 완료 이벤트
```

#### Sprint 2-4: AI Scoring 알고리즘 (1주) ✅

```
Task 2.4.1: Scoring Feature Extraction
├── Visual Features
│   ├── 조도 분석 (평균 밝기, 대비)
│   ├── 색상 히스토그램
│   ├── 얼굴 인식률 (face_recognition)
│   └── 구도 분석 (rule of thirds)
├── Audio Features
│   ├── 비트 매칭 점수
│   └── 오디오 품질 (SNR)
└── Motion Features
    ├── 움직임 강도
    └── 컷 전환 빈도

Task 2.4.2: Scoring Model
├── Historical Data 수집
│   └── HYBE 고성과 영상 메타데이터
├── 가중치 학습 (Linear Regression / XGBoost)
│   └── Score = w1*TrendSim + w2*BrandFit + w3*VisualQual
├── Model Serving
│   └── Vertex AI Prediction Endpoint
└── A/B 테스트 프레임워크
    └── 모델 버전 비교

Task 2.4.3: Scoring API
├── POST /api/v1/variants/{id}/score
│   └── 단일 영상 점수 계산
├── POST /api/v1/projects/{id}/score-all
│   └── 전체 변형 일괄 점수화
└── GET /api/v1/variants?sort=ai_score
    └── 점수순 정렬
```

#### Sprint 2-5: Curation Dashboard (1.5주) ✅

```
Task 2.5.1: Mosaic Viewer Component
├── 5x3 그리드 레이아웃
│   ├── 반응형 (모바일: 2x3)
│   └── 가상 스크롤링 (성능)
├── 동시 재생 (muted)
│   ├── IntersectionObserver
│   └── 마우스 오버 시 오디오 활성화
└── 영상 선택 기능
    └── 다중 선택 (체크박스)

Task 2.5.2: Video Detail Modal
├── 큰 화면 재생
├── 메타데이터 표시
│   ├── AI Score (차트)
│   ├── 스타일 프리셋
│   └── 생성 파라미터
└── 액션 버튼
    ├── Approve
    ├── Refine
    └── Delete

Task 2.5.3: A/B Comparison View
├── 2개 영상 나란히 재생
├── 동기화 재생 컨트롤
└── 상세 점수 비교 테이블

Task 2.5.4: Refine (Inpainting) 기능
├── 자연어 수정 요청 UI
│   └── "배경을 밤으로 바꿔줘"
├── Veo 3 Inpainting API 연동
└── 결과물 → 새로운 Variant로 저장
```

### 5.3 Phase 2 마일스톤

| 주차 | 마일스톤 | 산출물 | 상태 |
|------|----------|--------|------|
| 1주 | Trend Feeder | 트렌드 수집 파이프라인 | ✅ |
| 2-3주 | Prompt Alchemist | LLM 기반 프롬프트 최적화 | ✅ |
| 4-5주 | 병렬 생성 엔진 | 1:15 동시 생성 | ✅ |
| 6주 | AI Scoring + UI | 큐레이션 대시보드 완성 | ✅ |

---

## 6. Phase 3: Integration 개발 계획

### 6.1 Phase 3 목표
- Smart Swap (Motion Transfer) 기능
- SNS 퍼블리싱 API 연동
- 전체 UI/UX 폴리싱

### 6.2 Phase 3 작업 분해 (WBS)

#### Sprint 3-1: Motion Transfer Engine (1.5주)

```
Task 3.1.1: OpenPose Integration
├── OpenPose 모델 설정
│   └── Body-25 모델 (25 keypoints)
├── 영상에서 스켈레톤 추출
│   ├── 프레임별 추출
│   └── 시퀀스 저장 (JSON)
└── GPU 인스턴스 설정
    └── NVIDIA T4/A100

Task 3.1.2: Skeleton Retargeting
├── Asset Locker 아티스트 모델 참조
│   └── 3D 모델 또는 참조 이미지
├── 스켈레톤 → 타겟 매핑
│   ├── 비율 조정
│   └── 포즈 정규화
└── 중간 표현(Intermediate Representation) 생성

Task 3.1.3: Veo 3 Video-to-Video
├── 소스 영상 + 스켈레톤 → Veo 3
│   ├── ControlNet 스타일 제어
│   └── Denoising Strength: 0.4-0.6
├── 결과물 후처리
│   └── 얼굴 영역 보정
└── Motion Transfer API
    └── POST /api/v1/projects/{id}/motion-transfer
```

#### Sprint 3-2: Smart Crop & Caption (1주)

```
Task 3.2.1: Saliency-based Crop
├── Saliency Map 생성
│   ├── 딥러닝 기반 (U^2-Net)
│   └── 인물 중심 탐지
├── 16:9 → 9:16 변환
│   └── 인물이 중앙에 오도록 동적 크롭
└── 크롭 API
    └── POST /api/v1/variants/{id}/crop

Task 3.2.2: Caption Generator
├── Gemini Pro 기반 캡션 생성
│   ├── 영상 분석 → 캡션 생성
│   └── 질문형 캡션 (호기심 유발)
├── SEO 해시태그 생성
│   ├── 트렌드 키워드 결합
│   └── 플랫폼별 최적화
└── Caption API
    └── POST /api/v1/variants/{id}/caption
```

#### Sprint 3-3: Publishing Scheduler (1주)

```
Task 3.3.1: Platform API Integration
├── YouTube Shorts Upload
│   ├── YouTube Data API v3
│   ├── OAuth 2.0 인증
│   └── 업로드 + 메타데이터 설정
├── TikTok Publish
│   ├── TikTok Content Posting API
│   ├── OAuth 인증
│   └── 영상 업로드
└── Instagram Reels (향후)
    └── Instagram Graph API

Task 3.3.2: Smart Scheduling
├── 타겟 국가 활성 시간 분석
│   └── 시간대별 활성 사용자 데이터
├── 최적 포스팅 시간 추천
│   └── ML 기반 예측
└── 예약 포스팅 큐
    ├── Celery Beat 스케줄러
    └── 실패 시 재시도

Task 3.3.3: Publishing APIs
├── POST /api/v1/variants/{id}/schedule
│   └── Input: platforms[], scheduled_at, captions
├── GET /api/v1/schedules (목록)
├── DELETE /api/v1/schedules/{id} (취소)
└── Webhook: 게시 완료 통보
```

#### Sprint 3-5: Merchandise Reference (굿즈 참조 이미지 생성) (1주)

```
Task 3.5.1: Merchandise Asset Management
├── merchandise_items 테이블 설계
│   ├── id, name, artist_id, campaign_id
│   ├── type (album, photocard, lightstick, apparel, accessory)
│   ├── s3_url (이미지 URL)
│   ├── thumbnail_url
│   ├── metadata (크기, 색상, 출시일 등)
│   └── is_active
├── 굿즈 이미지 업로드 API
│   ├── POST /api/v1/merchandise (등록)
│   ├── GET /api/v1/merchandise (목록)
│   ├── GET /api/v1/merchandise/{id} (상세)
│   └── DELETE /api/v1/merchandise/{id} (삭제)
└── 굿즈 라이브러리 UI
    ├── 그리드 갤러리 뷰
    ├── 카테고리별 필터
    └── 드래그 앤 드롭 업로드

Task 3.5.2: Merchandise-to-Prompt Integration
├── Prompt Alchemist 연동
│   ├── 굿즈 이미지 → 프롬프트 자동 생성
│   │   └── Gemini Vision으로 굿즈 특징 분석 (색상, 디자인, 형태)
│   ├── 굿즈 타입별 프롬프트 템플릿
│   │   ├── album: "holding [album_name] album with [design_features]"
│   │   ├── lightstick: "waving [group] official lightstick"
│   │   ├── photocard: "showing photocard of [artist]"
│   │   └── apparel: "wearing [merchandise_name] with [design]"
│   └── 아티스트 + 굿즈 조합 프롬프트 최적화
├── Reference Image 전달
│   ├── Veo 3 API image_reference 파라미터 활용
│   ├── 굿즈 이미지를 참조 이미지로 전달
│   └── guidance_scale 조절 (굿즈 반영 강도)
└── 굿즈 컨텍스트 주입
    ├── 굿즈 메타데이터 → 프롬프트 enrichment
    └── 브랜드 색상/디자인 요소 자동 추출

Task 3.5.3: Merchandise Generation API
├── POST /api/v1/prompts/transform (확장)
│   ├── Input 추가: merchandise_ids[] (참조할 굿즈)
│   ├── Input 추가: merchandise_context (holding, wearing, showing 등)
│   └── Output: 굿즈 포함 최적화 프롬프트
├── POST /api/v1/projects/{id}/generate-with-merchandise
│   ├── Input: prompt_id, merchandise_ids[], style_presets[]
│   ├── 굿즈 참조 이미지와 함께 Veo 3 호출
│   └── Output: 굿즈가 포함된 영상 variants
└── GET /api/v1/merchandise/suggestions
    └── 캠페인/아티스트 기반 추천 굿즈

Task 3.5.4: Merchandise Selection UI
├── 프롬프트 입력 화면 연동
│   ├── 굿즈 선택 패널 (사이드바)
│   ├── 선택된 굿즈 미리보기
│   └── 굿즈 컨텍스트 선택 (들고있기, 입고있기, 보여주기)
├── 굿즈 라이브러리 브라우저
│   ├── 아티스트별 필터
│   ├── 타입별 필터 (앨범, 라이트스틱 등)
│   └── 최근 사용/인기 굿즈
└── 프롬프트 미리보기
    ├── 굿즈 적용 시 프롬프트 변화 실시간 표시
    └── 예상 결과 설명 (AI 분석)
```

#### Sprint 3-4: UI/UX 폴리싱 (1주)

```
Task 3.4.1: Main Dashboard (The Bridge)
├── Left Panel: Trend Radar
│   ├── 실시간 키워드 순위
│   ├── 트렌드 차트
│   └── Asset Locker 바로가기
├── Center: Prompt Interface
│   ├── Chat-like Input
│   ├── Preview Window
│   └── 실시간 최적화 프롬프트 표시
└── Right Panel: Variants List
    ├── 썸네일 + 점수
    └── 빠른 액션 버튼

Task 3.4.2: UX 개선
├── 로딩 상태 개선
│   ├── Skeleton UI
│   └── 진행률 표시 (%)
├── 에러 핸들링
│   ├── Toast 알림
│   └── 복구 가이드
├── 접근성 (A11y)
│   └── WCAG 2.1 AA 준수
└── 다국어 지원
    └── i18n (한/영/일)

Task 3.4.3: Performance Optimization
├── 이미지/비디오 최적화
│   ├── Lazy Loading
│   └── WebP/AVIF 변환
├── API 응답 캐싱
│   └── SWR/TanStack Query
└── Bundle Size 최적화
    └── 코드 스플리팅
```

### 6.3 Phase 3 마일스톤

| 주차 | 마일스톤 | 산출물 |
|------|----------|--------|
| 1-2주 | Motion Transfer | 스켈레톤 기반 아티스트 교체 |
| 3주 | Smart Crop + Caption | 자동 크롭 및 캡션 |
| 4주 | Publishing | SNS 연동 및 스케줄링 |
| 5주 | Merchandise Reference | 굿즈 참조 AI 영상 생성 |
| 6주 | UI/UX 완성 | 전체 폴리싱 완료 |

---

## 7. 데이터베이스 스키마 설계

### 7.1 PostgreSQL ERD

```sql
-- Users & Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer', -- admin, producer, viewer
    label_ids UUID[] DEFAULT '{}', -- RBAC: 접근 가능 레이블
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HYBE Labels (소속사/레이블)
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- BIGHIT, PLEDIS, ADOR, etc.
    code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Artists
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    stage_name VARCHAR(100),
    group_name VARCHAR(100),
    label_id UUID REFERENCES labels(id),
    profile_description TEXT, -- LLM용 아티스트 설명
    brand_guidelines TEXT, -- 브랜드 가이드라인
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    artist_id UUID REFERENCES artists(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed, archived
    target_countries VARCHAR(10)[] DEFAULT '{}',
    start_date DATE,
    end_date DATE,
    budget_code VARCHAR(50),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assets (Asset Locker)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- image, video, audio
    filename VARCHAR(255) NOT NULL,
    s3_url TEXT NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}', -- 추가 메타데이터
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Style Presets
CREATE TABLE style_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- contrast, tone, motion
    parameters JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects (Prompt Sessions)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    user_input TEXT NOT NULL,
    optimized_prompt TEXT,
    negative_prompt TEXT,
    technical_settings JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft', -- draft, processing, completed, failed
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video Variants (Generated Videos)
CREATE TABLE video_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    style_preset_id UUID REFERENCES style_presets(id),
    veo_job_id VARCHAR(255),
    s3_url TEXT,
    s3_key VARCHAR(500),
    thumbnail_url TEXT,
    duration_seconds DECIMAL(10,2),
    ai_score DECIMAL(5,2), -- 0-100
    score_breakdown JSONB DEFAULT '{}', -- trend, brand, visual scores
    is_approved BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'queued', -- queued, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trend Snapshots
CREATE TABLE trend_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL, -- tiktok, youtube
    region VARCHAR(10) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    rank INTEGER,
    video_count INTEGER,
    metadata JSONB DEFAULT '{}', -- BPM, colors, etc.
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Publishing Schedules
CREATE TABLE publishing_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES video_variants(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- youtube, tiktok, instagram
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    caption TEXT,
    hashtags TEXT[],
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, published, failed
    platform_post_id VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchandise Items (굿즈)
CREATE TABLE merchandise_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    artist_id UUID REFERENCES artists(id),
    campaign_id UUID REFERENCES campaigns(id),
    type VARCHAR(50) NOT NULL, -- album, photocard, lightstick, apparel, accessory
    s3_url TEXT NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    thumbnail_url TEXT,
    file_size BIGINT,
    metadata JSONB DEFAULT '{}', -- 크기, 색상, 출시일 등
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Merchandise References (프로젝트-굿즈 연결)
CREATE TABLE project_merchandise (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    merchandise_id UUID REFERENCES merchandise_items(id),
    context VARCHAR(50) NOT NULL, -- holding, wearing, showing, background
    guidance_scale DECIMAL(3,2) DEFAULT 0.7, -- 굿즈 반영 강도 (0-1)
    prompt_addition TEXT, -- 굿즈 관련 추가 프롬프트
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_merchandise_artist ON merchandise_items(artist_id);
CREATE INDEX idx_merchandise_campaign ON merchandise_items(campaign_id);
CREATE INDEX idx_merchandise_type ON merchandise_items(type);
CREATE INDEX idx_project_merchandise ON project_merchandise(project_id);
CREATE INDEX idx_campaigns_artist ON campaigns(artist_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_assets_campaign ON assets(campaign_id);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_projects_campaign ON projects(campaign_id);
CREATE INDEX idx_video_variants_project ON video_variants(project_id);
CREATE INDEX idx_video_variants_score ON video_variants(ai_score DESC);
CREATE INDEX idx_trend_snapshots_platform ON trend_snapshots(platform, region, collected_at);
CREATE INDEX idx_publishing_schedules_time ON publishing_schedules(scheduled_at);
```

---

## 8. API 설계 명세

### 8.1 API 버전 및 기본 구조

```yaml
Base URL: /api/v1
Content-Type: application/json
Authentication: Bearer JWT Token

Response Format:
  success:
    status: 200-299
    body:
      data: <response_data>
      meta:
        request_id: string
        timestamp: ISO8601

  error:
    status: 400-599
    body:
      error:
        code: string
        message: string
        details: object (optional)
      meta:
        request_id: string
        timestamp: ISO8601
```

### 8.2 주요 API Endpoints

```yaml
# Authentication
POST   /auth/login              # OAuth 로그인 시작
POST   /auth/callback           # OAuth 콜백
POST   /auth/refresh            # 토큰 갱신
POST   /auth/logout             # 로그아웃

# Users
GET    /users/me                # 현재 사용자 정보
PATCH  /users/me                # 프로필 수정

# Artists
GET    /artists                 # 아티스트 목록 (RBAC 필터)
GET    /artists/{id}            # 아티스트 상세

# Campaigns
GET    /campaigns               # 캠페인 목록
POST   /campaigns               # 캠페인 생성
GET    /campaigns/{id}          # 캠페인 상세
PATCH  /campaigns/{id}          # 캠페인 수정
DELETE /campaigns/{id}          # 캠페인 삭제

# Assets (Asset Locker)
GET    /campaigns/{id}/assets   # 에셋 목록
POST   /campaigns/{id}/assets   # 에셋 업로드
GET    /assets/{id}             # 에셋 상세
DELETE /assets/{id}             # 에셋 삭제
GET    /assets/search           # 메타데이터 검색

# Trends
GET    /trends                  # 트렌드 목록
GET    /trends/keywords         # 트렌드 키워드 랭킹

# Prompts (Prompt Alchemist)
POST   /prompts/transform       # 프롬프트 변환
GET    /prompts/{id}/preview    # 변환 미리보기
POST   /prompts/{id}/approve    # 프롬프트 승인

# Projects
GET    /campaigns/{id}/projects # 프로젝트 목록
POST   /projects                # 프로젝트 생성
GET    /projects/{id}           # 프로젝트 상세
POST   /projects/{id}/generate  # 단일 영상 생성
POST   /projects/{id}/generate-batch  # 배치 생성 (15 variants)
GET    /projects/{id}/status    # 생성 상태

# Video Variants
GET    /projects/{id}/variants  # 변형 영상 목록
GET    /variants/{id}           # 변형 상세
POST   /variants/{id}/score     # AI 점수 계산
POST   /variants/{id}/refine    # 수정 요청 (inpainting)
POST   /variants/{id}/approve   # 승인
DELETE /variants/{id}           # 삭제

# Motion Transfer
POST   /projects/{id}/motion-transfer  # 모션 트랜스퍼 요청

# Smart Processing
POST   /variants/{id}/crop      # 스마트 크롭
POST   /variants/{id}/caption   # 캡션 생성

# Merchandise (굿즈 라이브러리)
GET    /merchandise             # 굿즈 목록
POST   /merchandise             # 굿즈 등록
GET    /merchandise/{id}        # 굿즈 상세
DELETE /merchandise/{id}        # 굿즈 삭제
GET    /artists/{id}/merchandise      # 아티스트별 굿즈
GET    /merchandise/suggestions       # 추천 굿즈 (캠페인/아티스트 기반)

# Merchandise Generation (굿즈 참조 영상 생성)
POST   /prompts/transform              # (확장) merchandise_ids[], context 추가
POST   /projects/{id}/generate-with-merchandise  # 굿즈 참조 이미지와 함께 생성

# Publishing
POST   /variants/{id}/schedule  # 게시 예약
GET    /schedules               # 예약 목록
DELETE /schedules/{id}          # 예약 취소

# WebSocket
WS     /ws/projects/{id}/status # 생성 상태 실시간
```

### 8.3 주요 Request/Response 예시

```yaml
# POST /prompts/transform
Request:
  user_input: "정국이 비 오는 거리에서 슬픈 춤을 추는 영상"
  campaign_id: "uuid"
  trend_ids: ["uuid1", "uuid2"]
  safety_level: "high"

Response:
  status: "success"
  analysis:
    intent: "아티스트의 감성적인 퍼포먼스 표현"
    trend_applied: ["Cinematic Rain", "Slow Motion"]
  veo_prompt: "Cinematic 4K video of Jeon Jungkook performing a melancholic contemporary dance on a rain-soaked urban street at twilight. Volumetric lighting through rain droplets, dramatic rim lighting highlighting silhouette. Slow motion gimbal tracking shot, shallow depth of field. Teal and orange color grading, film grain overlay. Photorealistic, highly detailed, physics-based rain simulation, hair and cloth physics. Emotional, ethereal atmosphere."
  negative_prompt: "distortion, bad anatomy, morphing, blur, watermark, text, low quality, static pose, frozen face"
  technical_settings:
    aspect_ratio: "9:16"
    fps: 60
    duration: 15
    guidance_scale: 7.5

# POST /projects/{id}/generate-batch
Request:
  approved_prompt_id: "uuid"
  preset_ids: ["uuid1", "uuid2", ..., "uuid15"]

Response:
  job_group_id: "uuid"
  variants:
    - id: "uuid"
      preset_name: "High Contrast"
      status: "queued"
    - id: "uuid"
      preset_name: "Soft/Pastel"
      status: "queued"
    # ... 15 items

# WebSocket /ws/projects/{id}/status
Message:
  type: "variant_update"
  data:
    variant_id: "uuid"
    status: "completed"
    progress: 100
    s3_url: "https://..."
    ai_score: 87.5
```

---

## 9. Prompt Alchemist 전략

### 9.1 System Prompt 구조

```markdown
# SYSTEM PROMPT: HYDRA PROMPT ALCHEMIST v1.0

## ROLE DEFINITION
You are the "Hydra Prompt Alchemist," an elite AI Creative Director for HYBE.
Your mission: Convert simple user inputs into Veo 3-optimized video generation prompts.

## CORE PRINCIPLES
1. **K-Pop Aesthetic Excellence**: High-production, cinematic, visually stunning
2. **Brand Safety First**: Zero tolerance for NSFW, violence, defamation
3. **Artist Authenticity**: True to artist's current appearance and style
4. **Viral Optimization**: Trend-aware, engagement-maximized

## INPUT VARIABLES
- user_input: Raw creative idea
- artist_profile: Current physical traits (from Asset Locker)
- trend_keywords: Current trending visual/audio keywords
- safety_level: high (default) | medium | low

## PROCESSING PIPELINE

### Step 1: Safety Gate (CRITICAL)
Scan for: NSFW, violence, political sensitivity, defamation, dignity degradation
If violation detected: Return blocked response with reason

### Step 2: HYBE Cinematic Expansion
Apply the "HYBE Cinematic Formula":
- SUBJECT: Artist details (clothing, hair, expression) from artist_profile
- ENVIRONMENT: Weather, time, location, texture
- LIGHTING: Volumetric, rim light, bokeh, anamorphic flares
- CAMERA: Push-in, orbit, gimbal, dolly, low/high angle
- MOOD/COLOR: Teal-orange, pastel dreamcore, high contrast mono

### Step 3: Veo 3 Technical Enhancement
Append quality keywords:
- "4k, 8k, photorealistic, highly detailed, sharp focus"
- "physics-based rendering, fluid motion, masterpiece"
- Physics: "fluid simulation, hair physics, cloth simulation"

### Step 4: Trend Injection
Weave in trend_keywords naturally without overpowering artist identity

### Step 5: Negative Prompt Generation
Always include:
- "distortion, bad anatomy, morphing, blur, watermark, text"
- "low quality, ugly, deformed, extra limbs"
- "static pose, frozen face, morphing texture"

## OUTPUT FORMAT (JSON)
{
  "status": "success" | "blocked",
  "analysis": {
    "intent": "Brief interpretation",
    "trend_applied": ["keyword1", "keyword2"]
  },
  "veo_prompt": "THE_OPTIMIZED_PROMPT",
  "negative_prompt": "NEGATIVE_KEYWORDS",
  "technical_settings": {
    "aspect_ratio": "9:16",
    "fps": 60,
    "guidance_scale": 7.5
  }
}
```

### 9.2 Prompt Engineering 전략

```yaml
# 1. Artist Profile 동적 주입 전략
Strategy: Dynamic Profile Injection
Process:
  1. DB에서 아티스트 프로필 조회 (profile_description, brand_guidelines)
  2. 시각적 특성 텍스트 추출 (hair, style, etc.)
  3. artist_profile 변수에 동적 주입

Example:
  Static (Bad): "Jungkook"
  Dynamic (Good): "Jeon Jungkook with current dark brown wavy hair,
                   clean-shaven, athletic build, wearing casual
                   streetwear style as of November 2024"

# 2. Negative Prompt 강화 전략
Base Negatives:
  - "distortion, bad anatomy, morphing, blur, watermark"
  - "text, low quality, ugly, deformed, extra limbs"

Motion Negatives (Veo 3 specific):
  - "static pose, frozen face, morphing texture"
  - "jittery motion, unnatural movement"
  - "face deformation, identity shift"

# 3. 브랜드 세이프티 키워드 사전
violence_keywords:
  - 폭력, 피, 무기, 싸움, etc.

nsfw_keywords:
  - 성인, 노출, 선정, etc.

brand_negative:
  - 담배, 술, 마약, etc.

# 4. 트렌드 키워드 가중치 전략
Trend Weight Rules:
  - Max 3 trend keywords per prompt
  - Never overshadow artist identity
  - Prioritize visual trends over audio trends
  - Regional trend adaptation (KR, US, JP, etc.)
```

### 9.3 LangChain Chain 구성

```python
# Prompt Alchemist Chain Architecture

from langchain.chains import SequentialChain
from langchain.prompts import PromptTemplate

# Chain 1: Safety Filter
safety_chain = LLMChain(
    llm=gemini_pro,
    prompt=PromptTemplate(
        input_variables=["user_input"],
        template=SAFETY_CHECK_PROMPT
    ),
    output_key="safety_result"
)

# Chain 2: Artist Profile Enrichment
profile_chain = LLMChain(
    llm=gemini_pro,
    prompt=PromptTemplate(
        input_variables=["artist_name", "artist_profile"],
        template=PROFILE_ENRICHMENT_PROMPT
    ),
    output_key="enriched_profile"
)

# Chain 3: Prompt Expansion
expansion_chain = LLMChain(
    llm=gemini_pro,
    prompt=PromptTemplate(
        input_variables=["user_input", "enriched_profile", "trends"],
        template=EXPANSION_PROMPT
    ),
    output_key="expanded_prompt"
)

# Chain 4: Technical Optimization
optimization_chain = LLMChain(
    llm=gemini_pro,
    prompt=PromptTemplate(
        input_variables=["expanded_prompt"],
        template=VEO_OPTIMIZATION_PROMPT
    ),
    output_key="final_prompt"
)

# Sequential Chain
alchemist_chain = SequentialChain(
    chains=[safety_chain, profile_chain, expansion_chain, optimization_chain],
    input_variables=["user_input", "artist_name", "artist_profile", "trends"],
    output_variables=["safety_result", "enriched_profile", "expanded_prompt", "final_prompt"]
)
```

---

## 10. 인프라 및 DevOps

### 10.1 환경 구성

```yaml
Environments:
  development:
    - Local Docker Compose
    - MinIO (S3 compatible)
    - PostgreSQL 16
    - Redis 7
    - Pinecone Dev Index

  staging:
    - GKE Cluster (n1-standard-4 x 3)
    - Cloud SQL (PostgreSQL)
    - Memorystore (Redis)
    - Cloud Storage
    - Pinecone Starter

  production:
    - GKE Cluster (n1-standard-8 x 5)
    - Cloud SQL HA (PostgreSQL)
    - Memorystore HA (Redis)
    - Cloud Storage (Hot/Cold)
    - Pinecone Enterprise
```

### 10.2 Kubernetes 아키텍처

```yaml
# Namespace 구조
namespaces:
  - hydra-app
  - hydra-workers
  - hydra-monitoring

# Deployments
deployments:
  # Next.js App (Frontend + API)
  hydra-app:
    replicas: 5
    resources:
      requests: { cpu: "1000m", memory: "2Gi" }
      limits: { cpu: "2000m", memory: "4Gi" }
    env:
      - DATABASE_URL
      - JWT_SECRET
      - S3_ENDPOINT
      - REDIS_URL

  # BullMQ Worker (Phase 2)
  bullmq-worker:
    replicas: 10
    resources:
      requests: { cpu: "2000m", memory: "4Gi" }
      limits: { cpu: "4000m", memory: "8Gi" }

# GPU Workers (Motion Transfer, Scoring - Phase 3)
gpu-workers:
  nodeSelector:
    cloud.google.com/gke-accelerator: nvidia-tesla-t4
  resources:
    limits:
      nvidia.com/gpu: 1

# Autoscaling
hpa:
  hydra-app:
    minReplicas: 3
    maxReplicas: 20
    targetCPUUtilization: 70%
  bullmq-worker:
    minReplicas: 5
    maxReplicas: 50
    targetCPUUtilization: 80%
```

### 10.3 CI/CD 파이프라인

```yaml
# GitHub Actions Workflow

name: HYBE HYDRA CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # 1. Lint & Test
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npx tsc --noEmit

      - name: Run Tests
        run: npm test

  # 2. Build
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build & Push Docker Image
        run: |
          docker build -t gcr.io/$PROJECT/hydra:$SHA .
          docker push gcr.io/$PROJECT/hydra:$SHA

  # 3. Deploy Staging
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GKE Staging
        run: |
          kubectl set image deployment/frontend frontend=gcr.io/$PROJECT/hydra-frontend:$SHA
          kubectl set image deployment/api api=gcr.io/$PROJECT/hydra-api:$SHA

  # 4. Deploy Production
  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to GKE Production
        run: |
          # Blue-Green Deployment
          kubectl apply -f k8s/production/
```

---

## 11. 테스트 전략

### 11.1 테스트 피라미드

```
                    ┌─────────────┐
                    │   E2E (5%)  │  Playwright
                    │   Manual QA │
                   ┌┴─────────────┴┐
                   │Integration(15%)│  API Tests, DB Tests
                  ┌┴───────────────┴┐
                  │  Unit Tests (80%) │  Jest + RTL
                  └──────────────────┘
```

### 11.2 테스트 범위

```yaml
Unit & Integration (Jest + React Testing Library):
  - Component Unit Tests: 80%+ coverage
  - React Hook Tests
  - API Route Handler Tests
  - Utility Function Tests
  - Prisma Service Tests (with prisma-mock)
  - Integration: MSW (Mock Service Worker)

API Tests (Jest + Supertest):
  - API Route Integration Tests
  - Authentication Flow Tests
  - RBAC Permission Tests
  - Database Integration Tests

E2E (Playwright):
  - Critical User Flows:
    1. Login → Campaign Create → Asset Upload
    2. Prompt Input → Generation → Review
    3. Approval → Publishing Schedule
  - Cross-browser: Chrome, Firefox, Safari
  - Mobile Viewport Testing

Performance Testing (k6):
  - API Load Tests
  - Concurrent Generation Tests
  - Database Query Performance
```

### 11.3 품질 게이트

```yaml
PR Merge Requirements:
  - All tests passing
  - Code coverage >= 80%
  - No critical security vulnerabilities (Snyk)
  - Lint/Type-check passing
  - 2 code reviews approved

Staging Release:
  - All PR requirements
  - E2E tests passing
  - Performance regression check

Production Release:
  - All staging requirements
  - Load test passed
  - Security scan passed
  - Manual QA sign-off
```

---

## 12. 보안 요구사항

### 12.1 보안 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        VPC (Private Network)                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Private Subnet                    │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │   API   │ │ Workers │ │   DB    │ │  Redis  │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                               │
│  ┌───────────────────────────┼───────────────────────────┐  │
│  │              NAT Gateway / Cloud NAT                  │  │
│  └───────────────────────────┼───────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────┼───────────────────────────┐  │
│  │    Load Balancer (WAF Enabled) + Cloud Armor          │  │
│  └───────────────────────────┼───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │
                          Public Internet
```

### 12.2 보안 체크리스트

```yaml
Authentication & Authorization:
  - OAuth 2.0 / OIDC 인증
  - JWT 토큰 (RS256 서명)
  - RBAC 기반 접근 제어
  - API Rate Limiting

Data Protection:
  - TLS 1.3 (In-Transit)
  - AES-256 (At-Rest)
  - Field-level Encryption (PII)
  - Data Masking in Logs

Watermarking:
  - 비가시성 워터마크 (C2PA 표준)
  - 생성자 ID, 타임스탬프 임베딩
  - 위변조 탐지

Network Security:
  - VPC 격리
  - Private Subnet for workloads
  - Cloud Armor WAF
  - DDoS Protection

Audit & Compliance:
  - 모든 API 호출 로깅
  - 민감 데이터 접근 감사
  - 90일 로그 보존
  - 정기 보안 감사 (분기별)
```

### 12.3 비가시성 워터마크 구현

```python
# C2PA 기반 워터마크 삽입
from c2pa import C2PAManifest

def embed_watermark(video_path: str, metadata: dict) -> str:
    """
    비가시성 워터마크 삽입
    - creator_id: 생성자 UUID
    - created_at: ISO8601 타임스탬프
    - campaign_id: 캠페인 UUID
    - project_id: 프로젝트 UUID
    """
    manifest = C2PAManifest()
    manifest.set_claim("creator", metadata["creator_id"])
    manifest.set_claim("created", metadata["created_at"])
    manifest.set_claim("software", "HYBE HYDRA v1.0")

    # 워터마크 삽입
    output_path = manifest.embed(video_path)
    return output_path
```

---

## 부록 A: 디렉토리 구조

```
hybe-hydra/                      # Next.js Monorepo (Frontend + Backend)
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Auth route group
│   │   └── login/
│   ├── (dashboard)/             # Dashboard route group
│   │   ├── campaigns/
│   │   │   └── [id]/
│   │   ├── assets/
│   │   ├── projects/
│   │   └── publishing/
│   ├── api/                     # API Routes (Backend)
│   │   └── v1/
│   │       ├── auth/
│   │       │   ├── login/
│   │       │   ├── register/
│   │       │   └── refresh/
│   │       ├── users/
│   │       │   └── me/
│   │       ├── artists/
│   │       ├── campaigns/
│   │       │   └── [id]/
│   │       │       ├── assets/
│   │       │       │   └── stats/
│   │       │       └── generations/
│   │       ├── assets/
│   │       │   └── [id]/
│   │       └── generations/
│   │           └── [id]/
│   │               └── cancel/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/                  # React Components
│   ├── ui/                      # shadcn/ui components
│   ├── features/
│   │   ├── campaign/
│   │   ├── asset-locker/
│   │   ├── prompt/
│   │   ├── generation/
│   │   └── publishing/
│   └── layout/
│
├── lib/                         # Shared utilities
│   ├── db/
│   │   └── prisma.ts           # Prisma client
│   ├── auth.ts                  # JWT authentication
│   ├── storage.ts               # S3 storage utilities
│   ├── api.ts                   # API client utilities
│   ├── campaigns-api.ts
│   ├── video-api.ts
│   └── auth-store.ts           # Zustand auth store
│
├── prisma/                      # Prisma ORM
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # DB migrations
│   └── seed.ts                 # Seed data
│
├── public/                      # Static assets
│
├── infra/                       # Infrastructure
│   ├── docker/
│   ├── k8s/
│   └── terraform/
│
├── docs/                        # Documentation
│   ├── api/
│   ├── architecture/
│   └── guides/
│
├── docker-compose.yml          # Local dev services
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── prisma.config.ts
│
└── claudedocs/                  # Development docs
    └── HYBE_HYDRA_DEVELOPMENT_PLAN.md
```

---

## 부록 B: 환경 변수

```bash
# .env.example

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Prisma)
DATABASE_URL=postgresql://hydra:hydra@localhost:5434/hydra

# JWT Authentication
JWT_SECRET=your-jwt-secret-key-min-32-chars

# Redis
REDIS_URL=redis://localhost:6380

# Storage (S3 / MinIO)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=hydra-assets
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_USE_PATH_STYLE=true

# Google Cloud / Vertex AI
GOOGLE_CLOUD_PROJECT=hybe-hydra
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
VERTEX_AI_LOCATION=us-central1

# OAuth (Phase 2)
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback

# External APIs (Phase 2-3)
TIKTOK_API_KEY=your-key
YOUTUBE_API_KEY=your-key

# Feature Flags
FEATURE_MOTION_TRANSFER=false
FEATURE_PUBLISHING=false
```

---

## 부록 C: 개발 일정 요약

| Phase | 기간 | 주요 산출물 | 상태 |
|-------|------|------------|------|
| **Phase 1 (MVP)** | 6주 | Asset Locker, 단일 영상 생성, Veo 3 연동 | ✅ COMPLETED |
| **Phase 2 (Automation)** | 6주 | Prompt Alchemist, 1:15 병렬 생성, AI Scoring, Trend Feeder | ✅ COMPLETED |
| **Phase 3 (Integration)** | 6주 | Motion Transfer, SNS 퍼블리싱, 굿즈 참조 생성, UI/UX 완성 | 🔄 IN PROGRESS |
| **총 기간** | **18주 (4.5개월)** | Enterprise AI Video Platform | |

### 현재 진행 상황 (2024-11-28 기준)

**✅ 완료된 기능:**
- Phase 1 전체 (인프라, 인증, Asset Locker, 캠페인 관리, Veo 3 연동, Frontend MVP)
- Prompt Alchemist (프롬프트 변환 API)
- Style Presets 시스템 (15개 스타일 프리셋)
- Batch Generation (1:N 병렬 생성)
- AI Scoring 알고리즘 (4개 카테고리 점수화)
- Curation Dashboard (Mosaic View, A/B 비교, Video Detail Modal)
- Trend Feeder (TrendSnapshot 모델, Trends API, 프롬프트 제안 시스템)
- Phase 2 전체 완료 ✅
- Sprint 3-2: Caption Generator (AI 캡션 생성 API, SEO 해시태그, 플랫폼별 최적화, Curation UI 연동) ✅
- Sprint 3-3: Publishing Scheduler (DB 모델, Social Accounts API, Schedule API, Publishing UI) ✅

**🔄 Phase 3 진행 중:**
- ✅ Sprint 3-2: Caption Generator - 완료
- ✅ Sprint 3-3: Publishing Scheduler - 완료 (UI 및 백엔드 구조, SNS API 연동은 자격증명 필요)
- ✅ Sprint 3-4: UI/UX Polish - 완료
  - Bridge Dashboard (3-panel layout: Trend Radar, Prompt Interface, Variants Panel)
  - Skeleton UI 컴포넌트 (CardSkeleton, VideoCardSkeleton, TrendItemSkeleton 등)
  - Toast 알림 시스템 (success, error, warning, info)
  - i18n 다국어 지원 (한국어/영어)
  - Lazy Loading 컴포넌트 (LazyImage, LazyVideo)
- ⏳ Sprint 3-1: Motion Transfer - 대기 (OpenPose/MediaPipe 연동 필요)
- ⏳ Sprint 3-2: Smart Crop - 대기 (U^2-Net 연동 필요)
- ⏳ Sprint 3-5: Merchandise Reference - 대기 (굿즈 참조 AI 영상 생성)

**⏳ 남은 작업:**
- Motion Transfer (OpenPose 연동)
- Smart Crop (Saliency Map 기반)
- SNS API 실제 연동 (TikTok, YouTube, Instagram OAuth)
- Merchandise Reference (굿즈 참조 AI 영상 생성)
  - 굿즈 라이브러리 관리 시스템
  - Gemini Vision 굿즈 특징 분석 → 프롬프트 자동 생성
  - Veo 3 image_reference로 굿즈 이미지 전달
  - 굿즈 선택 UI (프롬프트 입력 화면 연동)

---

*문서 끝*

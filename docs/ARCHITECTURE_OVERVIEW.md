# Hybe Hydra 서비스 아키텍처 개요

> **작성일**: 2025-12-28
> **버전**: 1.0
> **목적**: HYBE 내부 검토를 위한 서비스 전체 아키텍처 및 인프라 구성 문서

---

## 1. 서비스 개요

**Hybe Hydra**는 AI 기반 숏폼 비디오 자동 생성 플랫폼입니다.

### 주요 기능
- TikTok 마케팅 콘텐츠 대량 생성
- AI 이미지/비디오 자동 생성 (Imagen 3.0, Veo 3.1)
- 트렌드 분석 및 최적화
- 멀티 아티스트 캠페인 관리
- TikTok 계정 연동 및 업로드

### 대상 사용자
- BMLG 마케팅 팀
- 아티스트 팬 계정 운영자

---

## 2. 현재 인프라 구성 (As-Is)

### 2.1 전체 아키텍처 다이어그램

```mermaid
flowchart TB
    subgraph USER["👤 사용자"]
        Browser["웹 브라우저"]
    end

    subgraph VERCEL["☁️ Vercel (Frontend)"]
        NextJS["Next.js 16<br/>React + TypeScript"]
        API["API Routes<br/>/api/v1/*"]
        Agents["Agent System<br/>AI 오케스트레이션"]
    end

    subgraph AWS["☁️ AWS"]
        EC2["EC2 Instance<br/>ap-southeast-2<br/>Compose Engine"]
        S3["S3 Bucket<br/>hydra-assets-hybe<br/>미디어 저장소"]
    end

    subgraph GCP["☁️ Google Cloud Platform"]
        subgraph VertexAI["Vertex AI"]
            Imagen["Imagen 3.0<br/>이미지 생성"]
            Veo["Veo 3.1<br/>비디오 생성"]
            Gemini["Gemini Pro<br/>텍스트 분석"]
        end
        GCS["Cloud Storage<br/>hydra-ai-output-seoul"]
    end

    subgraph SUPABASE["☁️ Supabase"]
        PostgreSQL["PostgreSQL<br/>사용자/캠페인/생성기록"]
    end

    Browser --> NextJS
    NextJS --> API
    API --> Agents
    Agents --> EC2
    Agents --> VertexAI
    EC2 --> S3
    EC2 --> GCS
    API --> PostgreSQL
    Imagen --> GCS
    Veo --> GCS
```

### 2.2 컴포넌트 구성

```mermaid
graph LR
    subgraph Frontend["Frontend Layer"]
        A1["Next.js 16"]
        A2["React Components"]
        A3["Tailwind CSS 4"]
    end

    subgraph Backend["Backend Layer"]
        B1["FastAPI"]
        B2["Python 3.11+"]
        B3["FFmpeg + GPU"]
    end

    subgraph AI["AI/ML Layer"]
        C1["Vertex AI"]
        C2["Imagen 3.0"]
        C3["Veo 3.1"]
        C4["Gemini"]
    end

    subgraph Data["Data Layer"]
        D1["PostgreSQL"]
        D2["AWS S3"]
        D3["Google Cloud Storage"]
    end

    Frontend --> Backend
    Backend --> AI
    Backend --> Data
    AI --> Data
```

---

## 3. 컴포넌트 상세

### 3.1 기술 스택 매트릭스

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '12px'}}}%%
graph TD
    subgraph Stack["기술 스택"]
        subgraph FE["Frontend"]
            FE1["Next.js 16"]
            FE2["TypeScript"]
            FE3["Tailwind CSS 4"]
            FE4["Radix UI"]
        end

        subgraph BE["Backend"]
            BE1["Python 3.11+"]
            BE2["FastAPI"]
            BE3["FFmpeg"]
            BE4["MoviePy"]
        end

        subgraph AI_Stack["AI/ML"]
            AI1["@google-cloud/vertexai"]
            AI2["@google/genai"]
            AI3["LangChain"]
        end

        subgraph DB["Database"]
            DB1["PostgreSQL 16"]
            DB2["Prisma ORM"]
        end
    end
```

### 3.2 호스팅 위치 및 역할

| 컴포넌트 | 기술 스택 | 호스팅 위치 | 리전 | 역할 |
|---------|----------|------------|------|------|
| **Frontend** | Next.js 16, React | Vercel | Global Edge | UI, API Gateway |
| **Backend** | Python, FastAPI | AWS EC2 | ap-southeast-2 | 비디오 렌더링 |
| **AI 서비스** | Vertex AI | GCP | us-central1 | AI 생성 |
| **Database** | PostgreSQL | Supabase | ap-south-1 | 데이터 저장 |
| **Storage** | S3, GCS | AWS/GCP | ap-southeast-2 | 미디어 파일 |

---

## 4. AI 서비스 구조

### 4.1 AI API 호출 구조

```mermaid
flowchart LR
    subgraph Application["Application Layer"]
        Agent["Agent System"]
    end

    subgraph ImageVideo["이미지/비디오 생성"]
        direction TB
        IV1["Imagen 3.0"]
        IV2["Veo 3.1"]
    end

    subgraph TextLLM["텍스트 생성 (LLM)"]
        direction TB
        T1["Gemini Pro"]
        T2["분석/프롬프트"]
    end

    subgraph Auth1["Vertex AI 인증"]
        VA["@google-cloud/vertexai<br/>GCP Service Account<br/>Workload Identity Federation"]
    end

    subgraph Auth2["AI Studio 인증"]
        AS["@google/genai<br/>API Key 인증<br/>GOOGLE_AI_API_KEY"]
    end

    Agent --> ImageVideo
    Agent --> TextLLM
    ImageVideo --> VA
    TextLLM --> AS
```

### 4.2 AI 서비스 상세

| 서비스 | 모델 | 용도 | 인증 방식 | 패키지 |
|--------|------|------|----------|--------|
| **이미지 생성** | Imagen 3.0 | 마케팅 이미지 | GCP Service Account | `@google-cloud/vertexai` |
| **비디오 생성** | Veo 3.1 | 숏폼 비디오 | GCP Service Account | `@google-cloud/vertexai` |
| **텍스트 분석** | Gemini Pro | 스크립트, 분석 | API Key | `@google/genai` |

---

## 5. 데이터 흐름

### 5.1 비디오 생성 워크플로우

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 사용자
    participant UI as 🖥️ Frontend (Vercel)
    participant Agent as 🤖 Agent System
    participant LLM as 📝 Gemini (LLM)
    participant Imagen as 🖼️ Imagen 3.0
    participant Veo as 🎬 Veo 3.1
    participant EC2 as 🖥️ Compose Engine
    participant Storage as 💾 Storage (S3/GCS)
    participant DB as 🗄️ Database

    User->>UI: 비디오 생성 요청
    UI->>Agent: 작업 시작

    rect rgb(230, 240, 255)
        Note over Agent,LLM: 스크립트 생성
        Agent->>LLM: 프롬프트 분석
        LLM-->>Agent: 스크립트 반환
    end

    rect rgb(255, 240, 230)
        Note over Agent,Imagen: 이미지 생성
        Agent->>Imagen: 이미지 생성 요청
        Imagen-->>Storage: 이미지 저장
        Imagen-->>Agent: 이미지 URL
    end

    alt Veo 비디오 생성
        rect rgb(240, 255, 240)
            Note over Agent,Veo: AI 비디오 생성
            Agent->>Veo: 비디오 생성 요청
            Veo-->>Storage: 비디오 저장
            Veo-->>Agent: 비디오 URL
        end
    else Compose 렌더링
        rect rgb(255, 255, 230)
            Note over Agent,EC2: 슬라이드쇼 렌더링
            Agent->>EC2: 렌더링 요청
            EC2->>Storage: 이미지/음악 다운로드
            EC2->>EC2: FFmpeg 렌더링
            EC2-->>Storage: 비디오 업로드
            EC2-->>Agent: 비디오 URL
        end
    end

    Agent->>DB: 생성 기록 저장
    Agent-->>UI: 완료 알림
    UI-->>User: 비디오 표시
```

### 5.2 Fast-Cut 워크플로우

```mermaid
flowchart TB
    subgraph Input["입력"]
        A1["🎵 음악 선택"]
        A2["🔍 트렌드 키워드"]
        A3["🎨 스타일 선택"]
    end

    subgraph Processing["처리"]
        B1["음악 분석<br/>(BPM, 비트)"]
        B2["이미지 검색<br/>(Google Custom Search)"]
        B3["AI 이미지 생성<br/>(Imagen 3.0)"]
    end

    subgraph Rendering["렌더링"]
        C1["비트 싱크 타이밍 계산"]
        C2["이펙트 적용"]
        C3["FFmpeg 렌더링"]
    end

    subgraph Output["출력"]
        D1["🎬 비디오 파일"]
        D2["📊 메타데이터"]
    end

    A1 --> B1
    A2 --> B2
    A3 --> B3
    B1 --> C1
    B2 --> C1
    B3 --> C1
    C1 --> C2
    C2 --> C3
    C3 --> D1
    C3 --> D2
```

---

## 6. API 구조

### 6.1 API 엔드포인트 구조

```mermaid
graph TD
    subgraph API["/api/v1"]
        subgraph Auth["인증"]
            A1["/auth/login"]
            A2["/auth/register"]
            A3["/users/me"]
        end

        subgraph Campaign["캠페인"]
            B1["/campaigns"]
            B2["/campaigns/:id"]
            B3["/artists"]
        end

        subgraph Content["콘텐츠 생성"]
            C1["/compose/render"]
            C2["/compose/script"]
            C3["/fast-cut/*"]
            C4["/ai/generate-image"]
            C5["/ai/generate-video"]
        end

        subgraph Analysis["분석"]
            D1["/analyze/*"]
            D2["/trends/*"]
            D3["/tiktok/*"]
        end

        subgraph Admin["관리"]
            E1["/admin/prompts"]
            E2["/admin/prompts/sync"]
        end
    end
```

---

## 7. 현재 인프라 요약

### 7.1 인프라 구성 현황

```mermaid
pie title 인프라 분포
    "Vercel (Frontend)" : 25
    "AWS (EC2, S3)" : 30
    "GCP (Vertex AI, GCS)" : 30
    "Supabase (DB)" : 15
```

### 7.2 외부 서비스 의존성

| 카테고리 | 서비스 | 용도 | 위치 |
|---------|--------|------|------|
| **Compute** | Vercel | Frontend 호스팅 | Global |
| **Compute** | AWS EC2 | Backend 서버 | ap-southeast-2 |
| **AI** | Vertex AI | AI 생성 | us-central1 |
| **Storage** | AWS S3 | 미디어 저장 | ap-southeast-2 |
| **Storage** | GCS | AI 출력 저장 | asia-northeast3 |
| **Database** | Supabase | PostgreSQL | ap-south-1 |
| **Auth** | Supabase Auth | 사용자 인증 | - |

---

## 8. 질문에 대한 답변

### Q1: 단순히 외부에서 API만 호출하여 사용하는 구조인가?

**답변**: **혼합 구조**입니다.

```mermaid
graph TB
    subgraph External["외부 API 호출"]
        E1["✅ Vertex AI (이미지/비디오 생성)"]
        E2["✅ Google AI Studio (LLM)"]
        E3["✅ TikTok API (업로드)"]
        E4["✅ Google Custom Search"]
    end

    subgraph SelfHosted["자체 호스팅 (EC2)"]
        S1["✅ 비디오 렌더링 (FFmpeg)"]
        S2["✅ 비트 싱크 처리"]
        S3["✅ 이펙트 적용"]
        S4["✅ 작업 큐 관리"]
    end

    subgraph ManagedService["매니지드 서비스"]
        M1["✅ Vercel (Frontend)"]
        M2["✅ Supabase (DB)"]
        M3["✅ AWS S3 (Storage)"]
    end
```

### Q2: 전체 인프라를 HYBE GCP 내에 구성할 예정인가?

**현재 상태**: HYBE GCP에 구성되어 있지 **않음**

```mermaid
graph LR
    subgraph Current["현재 (As-Is)"]
        C1["GCP: hyb-hydra-dev<br/>(외부 프로젝트)"]
        C2["AWS: EC2 + S3"]
        C3["Supabase: DB"]
    end

    subgraph Migration["이전 필요 항목"]
        M1["✅ GCP 프로젝트 이전"]
        M2["⚠️ EC2 → GCE 검토"]
        M3["⚠️ S3 → GCS 검토"]
        M4["⚠️ Supabase → Cloud SQL 검토"]
    end

    Current --> Migration
```

---

## 9. HYBE GCP 이전 시 구성 (To-Be)

### 9.1 목표 아키텍처

```mermaid
flowchart TB
    subgraph HYBE_GCP["🏢 HYBE GCP 프로젝트"]
        subgraph Compute["Compute Layer"]
            CR["Cloud Run<br/>(Frontend)"]
            GCE["GCE (GPU)<br/>(Video Render)"]
            CF["Cloud Functions<br/>(Background)"]
        end

        subgraph AI_ML["AI/ML Layer"]
            VA["Vertex AI"]
            IM["Imagen 3.0"]
            VE["Veo 3.1"]
            GE["Gemini"]
        end

        subgraph Storage_DB["Storage & Database"]
            GCS2["Cloud Storage"]
            SQL["Cloud SQL<br/>(PostgreSQL)"]
            Redis["Memorystore<br/>(Redis)"]
        end

        subgraph Security["Networking & Security"]
            VPC["VPC Network"]
            IAM["IAM"]
            SM["Secret Manager"]
        end
    end

    CR --> GCE
    CR --> VA
    GCE --> GCS2
    VA --> GCS2
    CR --> SQL
    GCE --> Redis
```

### 9.2 마이그레이션 대상

| 현재 리소스 | 현재 위치 | 이전 대상 | 우선순위 |
|------------|----------|----------|---------|
| GCP 프로젝트 | hyb-hydra-dev | HYBE GCP | 🔴 높음 |
| Vertex AI | 외부 GCP | HYBE GCP | 🔴 높음 |
| EC2 서버 | AWS Sydney | GCE | 🟡 중간 |
| S3 Storage | AWS | GCS | 🟡 중간 |
| Database | Supabase | Cloud SQL | 🟢 낮음 |

---

## 10. 보안 고려사항

### 10.1 현재 인증 체계

```mermaid
flowchart LR
    subgraph Auth["인증 방식"]
        A1["GCP Service Account<br/>(Vertex AI)"]
        A2["API Key<br/>(Google AI Studio)"]
        A3["Supabase Auth<br/>(사용자 인증)"]
        A4["AWS IAM<br/>(S3 접근)"]
    end

    subgraph Secrets["시크릿 관리"]
        S1["환경 변수<br/>(.env)"]
        S2["Vercel Secrets"]
        S3["AWS Secrets Manager"]
    end

    Auth --> Secrets
```

### 10.2 권한 및 접근 제어

| 리소스 | 접근 방식 | 권한 수준 |
|--------|----------|----------|
| Vertex AI | Service Account + WIF | aiplatform.user |
| AWS S3 | IAM Access Key | s3:GetObject, s3:PutObject |
| Supabase | API Key + JWT | Row Level Security |
| EC2 | SSH Key | Admin (인스턴스 내) |

---

## 11. 참고 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 배포 아키텍처 상세 | `docs/DEPLOYMENT_ARCHITECTURE.md` | 배포 프로세스 상세 |
| Compose Engine 구현 | `docs/COMPOSE_ENGINE_IMPLEMENTATION.md` | 비디오 렌더링 엔진 |
| 시스템 분석 보고서 | `docs/SYSTEM_ANALYSIS_REPORT.md` | 시스템 전체 분석 |
| Deep Analysis 스펙 | `docs/DEEP_ANALYSIS_BACKEND_SPEC.md` | AI 분석 기능 명세 |

---

## 12. 연락처

| 역할 | 담당 | 연락처 |
|------|------|--------|
| 기술 총괄 | - | - |
| 인프라 담당 | - | - |
| AI/ML 담당 | - | - |

---

*본 문서는 HYBE 내부 검토용으로 작성되었습니다.*

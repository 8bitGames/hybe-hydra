# Video Create Session Management System

## Overview

Video Create 기능에 세션 기반 상태 관리 시스템을 도입하여 데이터 영속성, 작업 추적, 복구 기능을 제공합니다.

---

## 현재 문제점 분석

### 1. 데이터 보존 현황 (Before)

| 저장소 | 키 | TTL | 문제점 |
|--------|-----|-----|--------|
| sessionStorage | `fast-cut-state` | 세션 동안 | 탭 닫으면 삭제 |
| sessionStorage | `hydra_bridge_prompt` | 30분 | 짧은 TTL |
| sessionStorage | `hydra_trend_context` | 1시간 | 불일관한 TTL |
| localStorage | `hydra-workflow-state` | 영구 | **create 단계 제외됨** |

### 2. 핵심 문제

```typescript
// workflow-store.ts (1275-1284행)
partialize: (state) => ({
  currentStage,      // ✅ 저장됨
  completedStages,   // ✅ 저장됨
  start,             // ✅ 저장됨
  analyze,           // ✅ 저장됨
  processing,        // ✅ 저장됨
  publish,           // ✅ 저장됨
  // create           ❌ 의도적 제외 → 새로고침 시 손실!
})
```

**문제 요약:**
1. `create` 단계 비영속 → 새로고침 시 진행 중인 생성 작업 손실
2. TTL 불일관 → 사용자가 데이터 만료 예측 불가
3. 단일 글로벌 상태 → 히스토리 없음, 작업 추적 불가
4. 세션 개념 없음 → 동시 작업, 복구 불가

---

## 새로운 아키텍처

### 1. 사용자 흐름 (User Flow)

```
Video Create 클릭
       │
       ▼
┌─────────────────────────────────────────┐
│         Session Dashboard               │
│  ┌───────────────────────────────────┐  │
│  │  📌 진행 중인 작업                 │  │
│  │  ├─ K-Pop Dance [Analyze] 30분 전 │  │
│  │  └─ Summer Vibe [Create] 2시간 전 │  │
│  ├───────────────────────────────────┤  │
│  │  📁 최근 완료 작업                 │  │
│  │  └─ Product Video [Completed]     │  │
│  ├───────────────────────────────────┤  │
│  │        [+ 새로 만들기]             │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
       │
       ├──── "진행 중인 세션 클릭" ────► 해당 단계로 이동 (이어서 작업)
       │
       └──── "새로 만들기 클릭" ────► 새 세션 생성 → Start 단계
```

### 2. 세션 생명주기 (Session Lifecycle)

```
┌──────────┐    create     ┌─────────────┐    save     ┌───────────┐
│  (none)  │ ───────────► │    draft    │ ─────────► │in_progress│
└──────────┘               └─────────────┘             └───────────┘
                                 │                          │
                                 │ 7일 미접속               │ 완료
                                 ▼                          ▼
                          ┌───────────┐              ┌───────────┐
                          │ abandoned │              │ completed │
                          └───────────┘              └───────────┘
                                 │
                                 │ 30일 후
                                 ▼
                          ┌───────────┐
                          │  deleted  │
                          └───────────┘
```

### 3. 데이터 저장 계층 (3-Tier Storage)

```
┌─────────────────────────────────────────────────────────┐
│                    Storage Layers                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Layer 1: Zustand Store (Memory)                        │
│  ├─ 현재 활성 세션만 메모리에 로드                       │
│  ├─ 빠른 UI 반응성                                      │
│  └─ 페이지 이동 시 유지                                  │
│                    │                                     │
│                    ▼ (3초 debounce)                      │
│                                                         │
│  Layer 2: IndexedDB (Client)                            │
│  ├─ 현재 세션 전체 데이터 로컬 캐시                      │
│  ├─ 오프라인 지원                                       │
│  └─ 새로고침 시 복구                                    │
│                    │                                     │
│                    ▼ (단계 완료 시)                       │
│                                                         │
│  Layer 3: Supabase (Server)                             │
│  ├─ creation_sessions 테이블                            │
│  ├─ 영구 저장 + 히스토리                                │
│  └─ 디바이스 간 동기화                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 데이터 모델

### 1. CreationSession (TypeScript)

```typescript
interface CreationSession {
  // Identity
  id: string;                    // UUID
  userId: string;
  campaignId: string | null;

  // Status
  status: SessionStatus;
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];

  // Stage Data (ALL stages saved!)
  stageData: {
    start: StartData | null;
    analyze: AnalyzeData | null;
    create: CreateData | null;      // ← 이제 저장됨!
    processing: ProcessingData | null;
    publish: PublishData | null;
  };

  // Metadata
  metadata: {
    entrySource: 'trends' | 'video' | 'idea';
    contentType: 'ai_video' | 'fast-cut';
    totalGenerations: number;
    approvedVideos: number;
    title: string;                   // 사용자 지정 또는 자동 생성
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

type SessionStatus =
  | 'draft'        // 시작만 하고 저장 안 함
  | 'in_progress'  // 현재 진행 중
  | 'paused'       // 일시 중지
  | 'completed'    // 발행 완료
  | 'abandoned';   // 포기 (자동 정리 대상)
```

### 2. Database Schema (Supabase)

```sql
-- creation_sessions 테이블
CREATE TABLE creation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'paused', 'completed', 'abandoned')),
  current_stage TEXT NOT NULL DEFAULT 'start'
    CHECK (current_stage IN ('start', 'analyze', 'create', 'processing', 'publish')),
  completed_stages TEXT[] DEFAULT '{}',

  -- Stage Data (JSONB for flexibility)
  start_data JSONB,
  analyze_data JSONB,
  create_data JSONB,
  processing_data JSONB,
  publish_data JSONB,

  -- Metadata
  entry_source TEXT CHECK (entry_source IN ('trends', 'video', 'idea')),
  content_type TEXT CHECK (content_type IN ('ai_video', 'fast-cut')),
  total_generations INT DEFAULT 0,
  approved_videos INT DEFAULT 0,
  title TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_completed_stages CHECK (
    completed_stages <@ ARRAY['start', 'analyze', 'create', 'processing', 'publish']
  )
);

-- Indexes
CREATE INDEX idx_sessions_user_status ON creation_sessions(user_id, status);
CREATE INDEX idx_sessions_user_updated ON creation_sessions(user_id, updated_at DESC);
CREATE INDEX idx_sessions_campaign ON creation_sessions(campaign_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_session_timestamp
  BEFORE UPDATE ON creation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();

-- RLS Policies
ALTER TABLE creation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON creation_sessions
  FOR ALL USING (auth.uid() = user_id);
```

---

## Store 아키텍처

### 1. Session Store (새로운 핵심 스토어)

```typescript
// lib/stores/session-store.ts

interface SessionState {
  // Current Session
  activeSession: CreationSession | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;

  // Session List (cache)
  sessions: SessionSummary[];
  sessionsLoading: boolean;
}

interface SessionActions {
  // Session Lifecycle
  createSession: (entrySource: EntrySource) => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
  saveSession: () => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  completeSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  // Stage Management
  updateStageData: <T extends WorkflowStage>(
    stage: T,
    data: Partial<StageDataMap[T]>
  ) => void;
  proceedToStage: (stage: WorkflowStage) => Promise<void>;

  // Session List
  fetchSessions: () => Promise<void>;

  // Recovery
  checkLocalRecovery: () => Promise<CreationSession | null>;
  recoverFromLocal: () => Promise<void>;
  discardLocalRecovery: () => void;
}

type SessionStore = SessionState & SessionActions;
```

### 2. Auto-Save Middleware

```typescript
const autoSaveMiddleware = (config) => (set, get, api) => {
  let saveTimeout: NodeJS.Timeout | null = null;

  return config(
    (args) => {
      set(args);

      // Debounce: 3초 후 IndexedDB 저장
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        const { activeSession } = get();
        if (activeSession) {
          await saveToIndexedDB(activeSession);
          console.log('[AutoSave] Saved to IndexedDB');
        }
      }, 3000);
    },
    get,
    api
  );
};
```

---

## UI 컴포넌트

### 1. Session Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  Video Create                              [+ 새로 만들기] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📌 진행 중인 작업                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎬 K-Pop Dance Challenge                         │   │
│  │    현재: Analyze 단계  │  30분 전 업데이트        │   │
│  │    Start ✅ → Analyze 🔄 → Create → Processing   │   │
│  │    [계속하기] [일시중지] [삭제]                    │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎬 Summer Vibes                                  │   │
│  │    현재: Create 단계  │  2시간 전 업데이트        │   │
│  │    Start ✅ → Analyze ✅ → Create 🔄 → Processing │   │
│  │    [계속하기] [일시중지] [삭제]                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📁 최근 완료 (7일)                                      │
│  ├─ Product Showcase     [Completed] 2일 전   [보기]    │
│  ├─ Brand Story          [Completed] 5일 전   [보기]    │
│  └─ Holiday Campaign     [Completed] 6일 전   [보기]    │
│                                                         │
│  ⏸️ 일시 중지됨                                          │
│  └─ Old Project          [Paused] 20일 전   [재개] [삭제]│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. Session Header (작업 중 표시)

```
┌─────────────────────────────────────────────────────────┐
│ 📁 K-Pop Dance Challenge                                │
│ Start ✅ → Analyze 🔄 → Create → Processing → Publish   │
│ 마지막 저장: 2분 전 ✅  │  [저장] [세션 목록으로]         │
└─────────────────────────────────────────────────────────┘
```

### 3. Recovery Modal (새로고침 후)

```
┌─────────────────────────────────────────────────────────┐
│  💾 저장된 작업을 발견했습니다                            │
│                                                         │
│  "K-Pop Dance Challenge"                                │
│  마지막 작업: Analyze 단계                               │
│  저장 시간: 30분 전                                      │
│                                                         │
│  [이어서 작업하기]  [새로 시작하기]  [삭제하고 시작]       │
└─────────────────────────────────────────────────────────┘
```

---

## 자동 저장 타이밍

| 이벤트 | 저장 위치 | 설명 |
|--------|----------|------|
| 입력 변경 | Zustand (메모리) | 즉시 반영 |
| 3초 idle | IndexedDB | debounce 저장 |
| 단계 이동 | IndexedDB + DB | checkpoint |
| 생성 완료 | DB | 영구 저장 |
| 탭 닫기 전 | IndexedDB | beforeunload |
| 명시적 저장 | DB | 사용자 요청 |

---

## 만료 정책

| 상태 | 만료 기간 | 자동 처리 |
|------|----------|----------|
| draft | 7일 | → abandoned |
| in_progress | 30일 비활성 | → paused |
| paused | 90일 | → abandoned |
| completed | 영구 | 유지 |
| abandoned | 30일 | → 물리적 삭제 |

---

## 파일 구조

```
lib/
├── stores/
│   ├── session-store.ts       # 새로운 세션 관리 스토어
│   ├── workflow-store.ts      # 기존 (session-store와 연동)
│   └── ...
├── db/
│   └── indexed-db.ts          # IndexedDB 유틸리티
└── ...

components/features/create/
├── SessionDashboard.tsx       # 세션 대시보드
├── SessionHeader.tsx          # 작업 중 헤더
├── SessionCard.tsx            # 세션 카드 컴포넌트
├── RecoveryModal.tsx          # 복구 모달
└── ...

app/(dashboard)/create/
├── page.tsx                   # → SessionDashboard 표시
├── [sessionId]/
│   ├── page.tsx               # 세션 진입점 (마지막 단계로 리다이렉트)
│   ├── start/page.tsx
│   ├── analyze/page.tsx
│   ├── generate/page.tsx
│   ├── processing/page.tsx
│   └── publish/page.tsx
└── ...

supabase/migrations/
└── YYYYMMDD_create_sessions_table.sql
```

---

## 구현 순서

### Phase 1: 기반 인프라
1. ✅ 설계 문서 작성
2. DB 마이그레이션 생성 (creation_sessions)
3. session-store.ts 구현
4. IndexedDB 유틸리티 구현

### Phase 2: UI 구현
5. SessionDashboard 컴포넌트
6. SessionHeader 컴포넌트
7. RecoveryModal 컴포넌트
8. 라우팅 업데이트

### Phase 3: 통합
9. 기존 workflow-store 연동
10. 자동 저장 로직 구현
11. 테스트 및 디버깅

---

## 기대 효과

| Before | After |
|--------|-------|
| create 단계 새로고침 시 손실 | 모든 단계 자동 저장 |
| 데이터 만료 시점 불명확 | 명확한 저장 상태 표시 |
| 작업 히스토리 없음 | 세션별 기록 조회 |
| 복구 불가 | 중단된 작업 언제든 재개 |
| 단일 작업만 가능 | 여러 세션 동시 관리 |

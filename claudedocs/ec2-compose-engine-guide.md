# EC2 Compose Engine 배포 가이드

## 서버 정보

| 항목 | 값 |
|------|-----|
| **Instance ID** | i-017979e6c19536988 |
| **Instance Type** | g4dn.xlarge |
| **Public IP** | 15.164.236.53 |
| **Region** | ap-northeast-2 (Seoul) |
| **OS** | Ubuntu 22.04 (Deep Learning AMI) |
| **GPU** | Tesla T4 (15GB VRAM) |
| **Key Pair** | admin_2024 |

## SSH 접속

### SSH Config (~/.ssh/config)
```
Host hydra-compose
  HostName 15.164.236.53
  User ubuntu
  IdentityFile ~/.ssh/admin_2024.pem
  Port 22
```

### 접속 명령어
```bash
ssh hydra-compose
```

## Docker 컨테이너

### 실행 중인 컨테이너
```bash
# 컨테이너 상태 확인
docker ps

# 로그 확인
docker logs -f hydra-compose

# 재시작
docker restart hydra-compose
```

### 컨테이너 실행 명령어 (참고용)
```bash
docker run -d \
  --name hydra-compose \
  --gpus all \
  -p 8000:8000 \
  --env-file .env \
  -v $(pwd)/app:/root/app \
  --restart unless-stopped \
  hydra-compose \
  uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API 엔드포인트

### 비디오 렌더링 (MoviePy)

| 엔드포인트 | 설명 |
|-----------|------|
| `http://15.164.236.53:8000/health` | 헬스 체크 |
| `http://15.164.236.53:8000/render` | 비디오 렌더링 요청 |
| `http://15.164.236.53:8000/job/{job_id}/status` | 작업 상태 확인 |

### AI 생성 (Vertex AI)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v1/ai/health` | GET | AI 서비스 헬스 체크 |
| `/api/v1/ai/generate` | POST | AI 작업 제출 (image/video/i2v) |
| `/api/v1/ai/image/generate` | POST | 이미지 생성 (Gemini 3 Pro Image) |
| `/api/v1/ai/video/generate` | POST | 비디오 생성 (Veo 3.1) |
| `/api/v1/ai/i2v/generate` | POST | 이미지→비디오 변환 (Veo 3.1) |
| `/api/v1/ai/job/{job_id}/status` | GET | AI 작업 상태 확인 |

## 환경변수 설정 (.env.local)

```bash
# ============================================================
# COMPOSE_ENGINE_MODE - 핵심 설정
# ============================================================
# 이 환경변수는 비디오 렌더링과 AI 생성 작업의 백엔드를 결정합니다.
#
# 'batch' = AWS Batch GPU (production, default)
#           - 비디오 렌더링: AWS Batch ECS
#           - AI 생성: AWS Batch → Lambda → Vertex AI
#
# 'ec2'   = EC2 GPU server (production - single server)
#           - 비디오 렌더링: EC2 compose-engine
#           - AI 생성: EC2 compose-engine → Vertex AI 직접 호출
#
# 'local' = Local Docker compose-engine (development)
COMPOSE_ENGINE_MODE=ec2

# EC2 compose engine URL
EC2_COMPOSE_URL=http://15.164.236.53:8000

# ============================================================
# AI 생성 관련 환경변수 (EC2/Batch 공통)
# ============================================================
# AI 생성 완료시 콜백을 위한 시크릿
AI_CALLBACK_SECRET=hydra-ai-callback-secret
BATCH_CALLBACK_SECRET=hydra-ai-callback-secret  # 호환성 유지

# 콜백 URL (Next.js 앱 URL)
NEXT_PUBLIC_APP_URL=https://hydra.ai.kr

# S3 버킷 (AI 생성 결과물 저장)
AWS_S3_BUCKET=hydra-assets-seoul
```

### 모드별 동작 차이

| 기능 | batch 모드 | ec2 모드 |
|------|-----------|----------|
| 비디오 렌더링 | AWS Batch ECS | EC2 compose-engine |
| 이미지 생성 | AWS Batch → Lambda → Vertex AI | EC2 → Vertex AI 직접 |
| 비디오 생성 | AWS Batch → Lambda → Vertex AI | EC2 → Vertex AI 직접 |
| 이미지→비디오 | AWS Batch → Lambda → Vertex AI | EC2 → Vertex AI 직접 |
| 확장성 | 자동 스케일링 | 단일 서버 |
| 비용 | 사용량 기반 | 고정 비용 |
| 지연시간 | 콜드스타트 있음 | 즉시 처리 |

## AI 클라이언트 아키텍처

### 파일 구조
```
lib/
├── batch/
│   └── ai-client.ts      # 통합 AI 클라이언트 (EC2/Batch 모드 전환)
└── ec2/
    └── ai-client.ts      # EC2 전용 클라이언트 (standalone)
```

### 통합 클라이언트 사용법 (권장)

`lib/batch/ai-client.ts`는 `COMPOSE_ENGINE_MODE` 환경변수에 따라 자동으로 백엔드를 선택합니다:

```typescript
import {
  submitImageGeneration,
  submitVideoGeneration,
  submitImageToVideo,
  getAIJobStatus,
  isEC2Mode,
  isBatchMode
} from '@/lib/batch/ai-client';

// 모드 확인
console.log('Using EC2 mode:', isEC2Mode());  // COMPOSE_ENGINE_MODE === 'ec2'
console.log('Using Batch mode:', isBatchMode());  // COMPOSE_ENGINE_MODE === 'batch'

// AI 작업 제출 (모드에 따라 자동 라우팅)
const result = await submitImageGeneration(
  jobId,
  { prompt: 'A beautiful sunset' },
  { s3_bucket: 'hydra-assets', s3_key: 'images/output.png' }
);

// 작업 상태 확인
const status = await getAIJobStatus(result.job_id);
```

### EC2 전용 클라이언트 (직접 사용)

EC2만 사용해야 하는 경우 `lib/ec2/ai-client.ts`를 직접 import:

```typescript
import {
  submitImageGeneration,
  submitVideoGeneration,
  getAIJobStatus
} from '@/lib/ec2/ai-client';
```

## 코드 동기화

### 동기화 스크립트 위치
- PowerShell: `scripts/sync-compose.ps1`
- Bash: `scripts/sync-compose.sh`

### 사용법

#### EC2 → 로컬 (pull)
EC2에서 수정한 코드를 로컬로 가져오기:
```bash
# Git Bash / WSL
./scripts/sync-compose.sh pull

# PowerShell
.\scripts\sync-compose.ps1 pull
```

#### 로컬 → EC2 (push)
로컬 코드를 EC2로 배포하고 Docker 재시작:
```bash
# Git Bash / WSL
./scripts/sync-compose.sh push

# PowerShell
.\scripts\sync-compose.ps1 push
```

## 개발 워크플로우

### 방법 1: EC2에서 직접 개발
1. VS Code Remote SSH로 EC2 접속
2. `/home/ubuntu/compose-engine/app/` 에서 코드 수정
3. Docker 재시작: `docker restart hydra-compose`
4. 테스트 완료 후 로컬로 동기화: `./scripts/sync-compose.sh pull`
5. Git 커밋: `git add . && git commit -m "update compose engine"`

### 방법 2: 로컬에서 개발 후 배포
1. 로컬에서 `backend/compose-engine/` 코드 수정
2. EC2로 배포: `./scripts/sync-compose.sh push`
3. 자동으로 Docker 재시작됨
4. 테스트

## 보안 그룹 (sg-02a3c4d78d95043eb)

| Type | Port | Source | 설명 |
|------|------|--------|------|
| SSH | 22 | 0.0.0.0/0 | SSH 접속 |
| Custom TCP | 8000 | 0.0.0.0/0 | API 엔드포인트 |

## 트러블슈팅

### Docker 컨테이너가 죽었을 때
```bash
ssh hydra-compose
cd ~/compose-engine
docker start hydra-compose
# 또는 완전히 새로 시작
docker rm hydra-compose
docker run -d --name hydra-compose --gpus all -p 8000:8000 --env-file .env -v $(pwd)/app:/root/app --restart unless-stopped hydra-compose uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### GPU 상태 확인
```bash
ssh hydra-compose
nvidia-smi
```

### 로그 확인
```bash
ssh hydra-compose
docker logs -f hydra-compose --tail 100
```

## 비용 정보

| 리소스 | 예상 비용 (USD) |
|--------|----------------|
| g4dn.xlarge (On-Demand) | ~$0.526/hour |
| EBS 스토리지 | ~$0.10/GB/month |

> **참고**: 사용하지 않을 때는 인스턴스를 중지하여 비용 절감 가능
> ```bash
> aws ec2 stop-instances --instance-ids i-017979e6c19536988 --region ap-northeast-2
> aws ec2 start-instances --instance-ids i-017979e6c19536988 --region ap-northeast-2
> ```

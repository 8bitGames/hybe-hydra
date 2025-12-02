 📊 Comprehensive Analysis: Caching & Background Job Opportunities

  Based on deep analysis of your codebase, here's a strategic plan for
  implementing Upstash Redis caching and Inngest background jobs.

  ---
  🔴 PART 1: CACHING OPPORTUNITIES (Upstash Redis)

  High-Impact Caching Targets

  | Endpoint/Data                   | Current State                          |
  Cache TTL | Est. Impact    |
  |---------------------------------|----------------------------------------|--
  ---------|----------------|
  | /api/v1/dashboard/stats         | Fresh on every load, heavy aggregation |
  1-5 min   | HIGH           |
  | /api/v1/campaigns list          | Re-fetched on every page visit         |
  30 sec    | HIGH           |
  | /api/v1/trends (collected data) | Already in DB, re-queried              |
  15 min    | MEDIUM         |
  | Artists list                    | Rarely changes                         | 1
   hour    | LOW            |
  | Style presets                   | Static                                 |
  24 hours  | LOW            |
  | Presigned S3 URLs               | 30-min in-memory cache                 |
  25 min    | ALREADY CACHED |

  Recommended Cache Architecture

  ┌─────────────────────────────────────────────────────────────┐
  │                    UPSTASH REDIS CACHE                      │
  ├─────────────────────────────────────────────────────────────┤
  │  dashboard:stats:{userId}         TTL: 60s   (per-user)    │
  │  campaigns:list:{labelId}:{page}  TTL: 30s   (per-label)   │
  │  campaigns:detail:{id}            TTL: 120s                │
  │  trends:platform:{platform}       TTL: 15min               │
  │  trends:analysis:{hash}           TTL: 24h   (expensive)   │
  │  artists:list                     TTL: 1h                  │
  │  presets:styles                   TTL: 24h                 │
  │  generation:status:{id}           TTL: 5s    (polling)     │
  └─────────────────────────────────────────────────────────────┘

  Specific Caching Implementations

  1. Dashboard Stats Cache (Highest Impact)

  File: app/api/v1/dashboard/stats/route.ts

  This endpoint runs 5+ heavy Prisma queries on every load:
  - prisma.campaign.findMany()
  - prisma.videoGeneration.findMany()
  - prisma.scheduledPost.findMany()
  - Multiple count() and aggregations

  Recommendation: Cache per-user with 60-second TTL, invalidate on write
  operations.

  2. Campaign List Cache

  File: app/api/v1/campaigns/route.ts

  Runs complex queries with counts for assets and video generations per
  campaign.

  Recommendation: Cache per-label with 30-second TTL, invalidate on campaign
  CRUD.

  3. Trend Analysis Cache (Already Partially Done)

  Files: app/api/v1/trends/analyze/*.ts

  Currently uses database tables with expiresAt. Should migrate to Redis for
  faster access.

  Recommendation: Use Redis with 24-hour TTL, hash key based on input
  parameters.

  ---
  🔵 PART 2: INNGEST BACKGROUND JOBS

  Current State

  - ✅ Inngest client configured (lib/inngest/client.ts)
  - ✅ Event schemas defined (7 event types)
  - ✅ Webhook route ready (app/api/inngest/route.ts)
  - ❌ Functions are skeleton only - need real implementation
  - ❌ No code actually triggers Inngest events

  Priority Inngest Migrations

  TIER 1: Critical (Fire-and-Forget Currently)

  | Process                | File
        | Current                     | Duration | Priority |
  |------------------------|----------------------------------------------------
  ------|-----------------------------|----------|----------|
  | Batch Video Generation |
  app/api/v1/campaigns/[id]/generations/batch/route.ts:261 | No await,
  fire-and-forget   | 5-20 min | 🔴       |
  | TikTok Publishing      |
  app/api/v1/publishing/schedule/[id]/publish/route.ts:257 | No await, can fail
  silently | 30-180s  | 🔴       |
  | Video Composition      | backend/compose-engine/
        | Python BackgroundTasks      | 60-180s  | 🔴       |

  TIER 2: High Value

  | Process          | File                                  | Current
      | Duration | Priority |
  |------------------|---------------------------------------|------------------
  ----|----------|----------|
  | Trend Collection | app/api/v1/trends/collect/route.ts:56 | Sync, blocks
  request | 30-90s   | 🟡       |
  | Video Analysis   | app/api/v1/analyze-video/route.ts     | 60s max timeout
      | 40-60s   | 🟡       |
  | Veo Generation   | lib/veo.ts                            | Part of batch
      | 30-120s  | 🟡       |

  TIER 3: Nice to Have

  | Process                 | File
         | Duration |
  |-------------------------|---------------------------------------------------
  -------|----------|
  | Score All Generations   |
  app/api/v1/campaigns/[id]/generations/score-all/route.ts | 30-300s  |
  | Trend Report Generation | app/api/v1/trends/analyze/report/route.ts
         | 120-300s |
  | Analytics Sync          | app/api/cron/analytics/route.ts
         | 10-60s   |

  Recommended Inngest Event Flow

  ┌─────────────────────────────────────────────────────────────────────┐
  │                     INNGEST EVENT ORCHESTRATION                     │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │  User Request                                                       │
  │       │                                                             │
  │       ▼                                                             │
  │  ┌─────────────────┐                                               │
  │  │ batch/process   │ ─── Creates N parallel jobs ───►              │
  │  └─────────────────┘                                               │
  │       │                                                             │
  │       ├──► video/generate.1 ──► video/compose.1 ──► publish/tiktok │
  │       ├──► video/generate.2 ──► video/compose.2 ──► publish/tiktok │
  │       └──► video/generate.N ──► video/compose.N ──► publish/tiktok │
  │                                                                     │
  │  ┌─────────────────┐                                               │
  │  │ trends/collect  │ ─── Scheduled/On-demand ───►                  │
  │  └─────────────────┘                                               │
  │       │                                                             │
  │       ▼                                                             │
  │  ┌─────────────────┐                                               │
  │  │ video/analyze   │ ─── Process collected trends ───►             │
  │  └─────────────────┘                                               │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘

  ---
  🟢 PART 3: IMPLEMENTATION PLAN

  Phase 1: Upstash Redis Setup

  // lib/cache.ts (New file)
  import { Redis } from '@upstash/redis'

  export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  // Cache helpers
  export async function cached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = await redis.get<T>(key)
    if (cached) return cached

    const fresh = await fetcher()
    await redis.setex(key, ttlSeconds, fresh)
    return fresh
  }

  export async function invalidate(pattern: string) {
    const keys = await redis.keys(pattern)
    if (keys.length) await redis.del(...keys)
  }

  Phase 2: Complete Inngest Functions

  The functions in lib/inngest/functions.ts need real implementations:

  // Example: Complete the generateVideo function
  export const generateVideo = inngest.createFunction(
    { id: 'generate-video', retries: 1 },
    { event: 'video/generate' },
    async ({ event, step }) => {
      const { generationId, prompt, stylePreset } = event.data

      // Step 1: Call Veo API
      const videoResult = await step.run('call-veo-api', async () => {
        return await generateVideoWithVeo(prompt, stylePreset)
      })

      // Step 2: Poll for completion
      const completedVideo = await step.run('poll-completion', async () => {
        return await pollVeoOperation(videoResult.operationId)
      })

      // Step 3: Update database
      await step.run('update-database', async () => {
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: 'COMPLETED',
            outputUrl: completedVideo.url,
            progress: 100
          }
        })
      })

      // Step 4: Trigger composition if configured
      if (event.data.autoCompose) {
        await inngest.send({
          name: 'video/compose',
          data: { generationId, videoUrl: completedVideo.url }
        })
      }

      return { success: true, generationId }
    }
  )

  Phase 3: Replace Fire-and-Forget Calls

  Before (current):
  // app/api/v1/campaigns/[id]/generations/batch/route.ts:261
  startBatchVideoGeneration(campaign, variations, userId, labelsAccessMap)
    .then(() => console.log('Batch started'))
    .catch(console.error)

  After (with Inngest):
  await inngest.send({
    name: 'batch/process',
    data: {
      campaignId: campaign.id,
      variations,
      userId,
      labelsAccessMap
    }
  })

  ---
  📋 Summary: What to Cache vs What to Queue

  | Type  | Use Case                                    | Solution
             |
  |-------|---------------------------------------------|-----------------------
  -----------|
  | Cache | Dashboard stats, campaign lists, trend data | Upstash Redis
             |
  | Cache | Presigned URLs (already done)               | Keep current in-memory
             |
  | Cache | Trend analysis results                      | Upstash Redis (replace
   DB cache) |
  | Queue | Video generation (30-120s)                  | Inngest
             |
  | Queue | Video composition (60-180s)                 | Inngest
             |
  | Queue | TikTok publishing (30-180s)                 | Inngest
             |
  | Queue | Trend collection (30-90s)                   | Inngest
             |
  | Queue | Batch operations (5-20min)                  | Inngest
             |

  ---
  🚀 Quick Wins (Immediate Impact)

  1. Add Upstash Redis for dashboard stats - Reduce DB load by 80%+
  2. Complete batch/process Inngest function - Already scaffolded
  3. Complete publish/tiktok Inngest function - Already scaffolded
  4. Add cache invalidation hooks - Invalidate on campaign/video CRUD

  Would you like me to implement any of these specific components?
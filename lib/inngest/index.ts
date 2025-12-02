/**
 * Inngest Module - Background Job Processing
 * Inngest 모듈 - 백그라운드 작업 처리
 *
 * Development:
 * - Run `npx inngest-cli@latest dev` to start local development server
 * - Visit http://localhost:8288 for Inngest dashboard
 *
 * Production:
 * - Set INNGEST_SIGNING_KEY in environment variables
 * - Inngest will auto-discover the /api/inngest endpoint
 */

export { inngest } from "./client";
export type {
  TrendsCollectHashtagData,
  TrendsCollectKeywordData,
  VideoAnalyzeData,
  VideoGenerateData,
  VideoComposeData,
  BatchProcessData,
  PublishTikTokData,
} from "./client";
export { functions } from "./functions";

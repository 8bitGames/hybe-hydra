/**
 * Inngest Client Configuration
 * Inngest 클라이언트 설정
 *
 * This file sets up the Inngest client for background job processing.
 * Docs: https://www.inngest.com/docs
 *
 * Local Development:
 * - Run: npx inngest-cli@latest dev
 * - Dashboard: http://localhost:8288
 */

import { Inngest } from "inngest";

// Event data types
export type TrendsCollectHashtagData = {
  hashtag: string;
  userId?: string;
};

export type TrendsCollectKeywordData = {
  keyword: string;
  userId?: string;
};

export type VideoAnalyzeData = {
  url: string;
  userId: string;
  options?: {
    extractFrames?: boolean;
    analyzeAudio?: boolean;
  };
};

export type VideoGenerateData = {
  generationId: string;
  campaignId: string;
  userId: string;
  prompt: string;
  options?: {
    aspectRatio?: string;
    duration?: number;
    stylePreset?: string;
    negativePrompt?: string;
  };
};

export type VideoComposeData = {
  generationId: string;
  campaignId: string;
  userId: string;
  audioAssetId: string;
  imageAssetIds?: string[];
  options?: {
    transitionType?: string;
    applyLogoOverlay?: boolean;
  };
};

export type BatchProcessData = {
  batchId: string;
  campaignId: string;
  userId: string;
  items: Array<{
    prompt: string;
    audioAssetId?: string;
    aspectRatio?: string;
    duration?: number;
    stylePreset?: string;
  }>;
};

export type PublishTikTokData = {
  videoId: string;
  userId: string;
  accountId: string;
  caption: string;
  hashtags?: string[];
  scheduledAt?: string;
};

// Create the Inngest client
export const inngest = new Inngest({ id: "hybe-hydra" });

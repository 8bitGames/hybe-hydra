/**
 * Hybe Hydra Agent Types (v2)
 *
 * Project-specific context and type definitions extending the base agent framework.
 * These types bridge the generic @hybe/agent-framework with hybe-hydra's domain.
 */

import type { BaseAgentContext, BaseWorkflowMetadata } from '@hybe/agent-framework';

// ============================================================================
// Workflow Metadata (extends BaseWorkflowMetadata)
// ============================================================================

/**
 * Hybe-specific workflow metadata with campaign and artist context
 */
export interface HybeWorkflowMetadata extends BaseWorkflowMetadata {
  /** Campaign identifier */
  campaignId?: string;
  /** Artist name for content creation */
  artistName: string;
  /** Content language */
  language: 'ko' | 'en';
  /** Target platform */
  platform: 'tiktok' | 'instagram' | 'youtube' | 'shorts' | 'youtube_shorts';
  /** Music genre for style matching */
  genre?: string;
  /** Content style preferences */
  style?: string;
  /** Target audience demographics */
  targetAudience?: string;
}

// ============================================================================
// Context Sections
// ============================================================================

/**
 * Discovery phase context - trend analysis and content strategy
 */
export interface DiscoverContext {
  /** Trending content analysis */
  trendAnalysis?: {
    trends: Array<{
      id: string;
      title: string;
      category: string;
      engagement: number;
      relevance: number;
    }>;
    analyzedAt: Date;
  };
  /** Content strategy recommendations */
  contentStrategy?: {
    themes: string[];
    formats: string[];
    hooks: string[];
    callToActions: string[];
  };
  /** Competitor analysis data */
  competitorAnalysis?: {
    accounts: Array<{
      handle: string;
      platform: string;
      followers: number;
      avgEngagement: number;
    }>;
  };
}

/**
 * Analysis phase context - media and caption analysis
 */
export interface AnalyzeContext {
  /** Vision analysis results */
  visionAnalysis?: {
    mediaType: 'image' | 'video';
    scenes?: Array<{
      timestamp?: number;
      description: string;
      elements: string[];
      mood: string;
    }>;
    subjects?: string[];
    colors?: string[];
    style?: string;
    quality?: {
      resolution: string;
      lighting: string;
      composition: string;
    };
  };
  /** Caption/text analysis */
  captionAnalysis?: {
    hooks: string[];
    callToActions: string[];
    hashtags: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    tone: string;
  };
  /** Audio analysis for videos */
  audioAnalysis?: {
    hasSpeech: boolean;
    hasMusic: boolean;
    musicGenre?: string;
    speechTranscript?: string;
    mood?: string;
  };
}

/**
 * Creation phase context - generated content and ideas
 */
export interface CreateContext {
  /** Generated creative ideas */
  creativeIdeas?: Array<{
    id: string;
    title: string;
    concept: string;
    hook: string;
    visualDescription: string;
    confidence: number;
  }>;
  /** Generated content items */
  generatedContent?: {
    scripts?: Array<{
      id: string;
      content: string;
      duration: number;
    }>;
    captions?: Array<{
      id: string;
      text: string;
      hashtags: string[];
    }>;
    images?: Array<{
      id: string;
      url: string;
      prompt: string;
    }>;
  };
  /** Content variations */
  variations?: Array<{
    id: string;
    type: 'style' | 'length' | 'tone';
    content: string;
  }>;
}

/**
 * Publishing phase context - scheduling and distribution
 */
export interface PublishContext {
  /** Scheduled posts */
  scheduledPosts?: Array<{
    id: string;
    platform: string;
    scheduledAt: Date;
    status: 'pending' | 'published' | 'failed';
  }>;
  /** Publishing analytics */
  analytics?: {
    impressions: number;
    engagement: number;
    shares: number;
    comments: number;
  };
}

// ============================================================================
// Main Context Type
// ============================================================================

/**
 * Complete Hybe agent context with all phase data
 * Extends BaseAgentContext with project-specific sections
 */
export interface HybeAgentContext extends BaseAgentContext<HybeWorkflowMetadata> {
  /** Discovery phase data */
  discover?: DiscoverContext;
  /** Analysis phase data */
  analyze?: AnalyzeContext;
  /** Creation phase data */
  create?: CreateContext;
  /** Publishing phase data */
  publish?: PublishContext;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Create a minimal context for testing or simple operations
 */
export function createMinimalContext(
  overrides: Partial<HybeAgentContext> = {}
): HybeAgentContext {
  return {
    workflow: {
      sessionId: `session-${Date.now()}`,
      artistName: 'Unknown Artist',
      language: 'en',
      platform: 'tiktok',
      ...overrides.workflow,
    },
    ...overrides,
  };
}

/**
 * Type guard to check if context has discovery data
 */
export function hasDiscoverContext(
  context: HybeAgentContext
): context is HybeAgentContext & { discover: DiscoverContext } {
  return context.discover !== undefined;
}

/**
 * Type guard to check if context has analysis data
 */
export function hasAnalyzeContext(
  context: HybeAgentContext
): context is HybeAgentContext & { analyze: AnalyzeContext } {
  return context.analyze !== undefined;
}

/**
 * Type guard to check if context has creation data
 */
export function hasCreateContext(
  context: HybeAgentContext
): context is HybeAgentContext & { create: CreateContext } {
  return context.create !== undefined;
}

/**
 * Agent Architecture Type Definitions
 * ====================================
 * Core types for the AI Agent system
 *
 * Model Assignment:
 * - Gemini 2.5 Flash: Analyzers, Transformers
 * - Gemini 3 Pro: Creative Director (strategic thinking)
 * - GPT-5.1: Publishers (user-facing text)
 */

import { z, ZodSchema } from 'zod';

// ================================
// Model Configuration Types
// ================================

export type ModelProvider = 'gemini' | 'openai';

export type GeminiModelName =
  | 'gemini-2.5-flash'
  | 'gemini-3-pro-preview';

export type OpenAIModelName =
  | 'gpt-5.1'
  | 'gpt-5.1-mini';

export type ModelName = GeminiModelName | OpenAIModelName;

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  // GPT-5.1 specific
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  presencePenalty?: number;
  frequencyPenalty?: number;
  // Gemini 3 Pro specific
  thinkingLevel?: 'low' | 'high';
  // Tools
  tools?: AgentTool[];
}

export interface AgentTool {
  type: 'google_search' | 'code_execution' | 'function';
  config?: Record<string, unknown>;
}

export interface ModelConfig {
  provider: ModelProvider;
  name: ModelName;
  options?: ModelOptions;
}

// ================================
// Agent Configuration Types
// ================================

export type AgentCategory = 'analyzer' | 'creator' | 'transformer' | 'publisher' | 'compose';

export interface AgentPrompts {
  system: string;
  templates: Record<string, string>;
}

export interface AgentConfig<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  model: ModelConfig;
  prompts: AgentPrompts;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  dependencies?: string[];
}

// ================================
// Agent Context Types
// ================================

export interface VisualPattern {
  style: string;
  colors: string[];
  mood: string;
  frequency: number;
}

export interface ContentStrategy {
  contentThemes: Array<{ theme: string; priority: number; rationale: string }>;
  visualGuidelines: {
    styles: string[];
    colors: string[];
    pace: string;
    effects: string[];
  };
  captionGuidelines: {
    hooks: string[];
    ctas: string[];
    hashtags: string[];
  };
  bestPractices: string[];
  avoid: string[];
  confidenceScore: number;
}

export interface ContentIdea {
  title: string;
  hook: string;
  description: string;
  estimatedEngagement: 'high' | 'medium' | 'low';
  optimizedPrompt: string;
  suggestedMusic: { bpm: number; genre: string };
  scriptOutline: string[];
}

export interface MusicSuggestion {
  bpm: number;
  genre: string;
  mood: string;
}

export interface ScriptLine {
  text: string;
  timing: number;
  duration: number;
  purpose: 'hook' | 'setup' | 'build' | 'climax' | 'cta';
}

export interface DiscoverContext {
  trendKeywords?: string[];
  hashtags?: string[];
  visualPatterns?: VisualPattern[];
  contentStrategy?: ContentStrategy;
  inspirationVideos?: unknown[];
  trendInsights?: unknown;
  groundingInfo?: {
    summary: string;
    sources: Array<{ title: string; url: string }>;
  };
}

export interface AnalyzeContext {
  selectedIdea?: ContentIdea;
  optimizedPrompt?: string;
  suggestedMusic?: MusicSuggestion;
  // Stage results from analyzers
  visionAnalysis?: unknown;
  textPatterns?: unknown;
  visualTrends?: unknown;
  strategy?: unknown;
}

export interface CreateContext {
  script?: ScriptLine[] | unknown;
  veoPrompt?: string;
  searchKeywords?: string[];
  // Stage results from creators
  ideas?: ContentIdea[];
  selectedIdea?: ContentIdea;
}

export interface WorkflowMetadata {
  campaignId?: string;
  artistName: string;
  language: 'ko' | 'en';
  platform: 'tiktok' | 'instagram' | 'youtube' | 'shorts' | 'youtube_shorts';
  sessionId?: string;
  startedAt?: Date;
}

export interface AgentContext {
  discover?: DiscoverContext;
  analyze?: AnalyzeContext;
  create?: CreateContext;
  workflow: WorkflowMetadata;
}

// ================================
// Agent Execution Types
// ================================

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface AgentMetadata {
  agentId: string;
  model: ModelName;
  tokenUsage: TokenUsage;
  latencyMs: number;
  timestamp: string;
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: AgentMetadata;
}

// ================================
// Model Response Types
// ================================

export interface ModelResponse {
  content: string;
  usage: TokenUsage;
  finishReason?: string;
}

export interface ModelGenerateOptions {
  system: string;
  user: string;
  images?: Array<{
    data: string;
    mimeType: string;
  }>;
}

// ================================
// Workflow Types
// ================================

export type WorkflowType = 'discover' | 'analyze' | 'create' | 'publish' | 'full';

export interface AgentStage {
  agents: string[];
  parallel: boolean;
}

export interface WorkflowInput {
  campaignId: string;
  artistName: string;
  language: 'ko' | 'en';
  platform: 'tiktok' | 'instagram' | 'youtube' | 'shorts';
  userConcept?: string;
  targetAudience?: string;
  contentGoals?: string[];
  mediaUrls?: string[];
  hashtags?: string[];
}

export interface WorkflowResult extends AgentContext {
  completedAgents: string[];
  totalLatencyMs: number;
  totalTokenUsage: TokenUsage;
}

// ================================
// Specific Agent Output Types
// ================================

// Vision Analyzer Output
export const VisionAnalysisSchema = z.object({
  style_analysis: z.object({
    visual_style: z.string(),
    color_palette: z.array(z.string()),
    lighting: z.string(),
    mood: z.string(),
    composition: z.string(),
  }),
  content_analysis: z.object({
    main_subject: z.string(),
    setting: z.string(),
    props: z.array(z.string()),
  }),
  technical: z.object({
    brightness: z.number().min(0).max(1),
    complexity: z.number().min(0).max(1),
    suggested_motion: z.enum(['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'static']),
  }),
});
export type VisionAnalysis = z.infer<typeof VisionAnalysisSchema>;

// Text Pattern Output
export const TextPatternAnalysisSchema = z.object({
  clusters: z.array(z.object({
    name: z.string(),
    hashtags: z.array(z.string()),
    avgEngagement: z.number().optional(),
    trendDirection: z.enum(['rising', 'stable', 'declining']),
  })),
  outliers: z.array(z.string()),
  sentiment: z.object({
    overall: z.enum(['positive', 'neutral', 'negative']),
    score: z.number().min(-1).max(1),
    emotions: z.array(z.string()),
  }).optional(),
});
export type TextPatternAnalysis = z.infer<typeof TextPatternAnalysisSchema>;

// Visual Trend Output
export const VisualTrendAnalysisSchema = z.object({
  dominantStyles: z.array(z.object({
    style: z.string(),
    frequency: z.number().min(0).max(1),
    avgEngagement: z.number().optional(),
  })),
  colorTrends: z.array(z.object({
    palette: z.array(z.string()),
    usage: z.number().min(0).max(1),
  })),
  paceDistribution: z.object({
    slow: z.number(),
    medium: z.number(),
    fast: z.number(),
  }),
  effectsTrending: z.array(z.string()),
  promptTemplates: z.array(z.object({
    template: z.string(),
    style: z.string(),
    confidence: z.number().min(0).max(1),
  })),
});
export type VisualTrendAnalysis = z.infer<typeof VisualTrendAnalysisSchema>;

// Strategy Output
export const ContentStrategySchema = z.object({
  contentThemes: z.array(z.object({
    theme: z.string(),
    priority: z.number().min(1).max(5),
    rationale: z.string(),
  })),
  visualGuidelines: z.object({
    styles: z.array(z.string()),
    colors: z.array(z.string()),
    pace: z.string(),
    effects: z.array(z.string()),
  }),
  captionGuidelines: z.object({
    hooks: z.array(z.string()),
    ctas: z.array(z.string()),
    hashtags: z.array(z.string()),
  }),
  bestPractices: z.array(z.string()),
  avoid: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
});

// Creative Director Output
export const CreativeIdeasSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    hook: z.string(),
    description: z.string(),
    estimatedEngagement: z.enum(['high', 'medium', 'low']),
    optimizedPrompt: z.string(),
    suggestedMusic: z.object({
      bpm: z.number(),
      genre: z.string(),
    }),
    scriptOutline: z.array(z.string()),
  })),
  optimizedHashtags: z.array(z.string()),
  contentStrategy: z.string(),
});
export type CreativeIdeas = z.infer<typeof CreativeIdeasSchema>;

// Script Writer Output
export const ScriptOutputSchema = z.object({
  script: z.object({
    lines: z.array(z.object({
      text: z.string(),
      timing: z.number(),
      duration: z.number(),
      purpose: z.enum(['hook', 'setup', 'build', 'climax', 'cta']),
    })),
    totalDuration: z.number(),
  }),
  vibe: z.enum(['Exciting', 'Emotional', 'Pop', 'Minimal']),
  vibeReason: z.string(),
  suggestedBpmRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  searchKeywords: z.array(z.string()),
  effectRecommendation: z.string(),
});
export type ScriptOutput = z.infer<typeof ScriptOutputSchema>;

// Prompt Engineer Output
export const OptimizedPromptSchema = z.object({
  optimizedPrompt: z.string(),
  safetyScore: z.number().min(0).max(1),
  sanitizedNames: z.array(z.object({
    original: z.string(),
    replacement: z.string(),
  })),
  warnings: z.array(z.string()),
  cinematicBreakdown: z.object({
    subject: z.string(),
    environment: z.string(),
    lighting: z.string(),
    camera: z.string(),
    mood: z.string(),
  }),
});
export type OptimizedPrompt = z.infer<typeof OptimizedPromptSchema>;

// Publish Optimizer Output
export const PublishContentSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  postingTips: z.array(z.string()),
  alternativeCaptions: z.array(z.string()),
  reasoning: z.string(),
});
export type PublishContent = z.infer<typeof PublishContentSchema>;

// Copywriter Output
export const CopywriterOutputSchema = z.object({
  caption: z.string(),
  alternativeHooks: z.array(z.string()),
  hashtags: z.array(z.string()),
  seoScore: z.number().min(0).max(100),
  engagementPrediction: z.enum(['high', 'medium', 'low']),
  toneAnalysis: z.string(),
  readabilityScore: z.number().min(0).max(100),
});
export type CopywriterOutput = z.infer<typeof CopywriterOutputSchema>;

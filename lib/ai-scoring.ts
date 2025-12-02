/**
 * AI Scoring Service for Video Generations
 *
 * Implements a rule-based scoring system that evaluates:
 * 1. Prompt Quality - Detail, structure, clarity
 * 2. Technical Settings - Optimal parameters for video generation
 * 3. Style Alignment - Brand consistency and aesthetic quality
 * 4. Trend Alignment - Relevance to current trends
 *
 * This can be enhanced with ML models in the future using Vertex AI.
 */

// Score categories with weights
export interface ScoringWeights {
  promptQuality: number;
  technicalSettings: number;
  styleAlignment: number;
  trendAlignment: number;
}

// Default weights (can be adjusted based on campaign goals)
export const DEFAULT_WEIGHTS: ScoringWeights = {
  promptQuality: 0.35,
  technicalSettings: 0.20,
  styleAlignment: 0.30,
  trendAlignment: 0.15,
};

// Detailed score breakdown
export interface ScoreBreakdown {
  promptQuality: {
    score: number;
    details: {
      length: number;        // Score based on prompt length (optimal: 100-500 chars)
      specificity: number;   // Keywords indicating detail level
      structure: number;     // Proper formatting and sections
    };
  };
  technicalSettings: {
    score: number;
    details: {
      aspectRatio: number;   // Optimal for platform
      duration: number;      // Optimal length
      fps: number;          // Frame rate appropriateness
    };
  };
  styleAlignment: {
    score: number;
    details: {
      stylePresetMatch: number;  // How well it matches preset
      brandConsistency: number;  // Brand guideline adherence
      visualCoherence: number;   // Overall visual quality indicators
    };
  };
  trendAlignment: {
    score: number;
    details: {
      trendKeywords: number;     // Trend keyword presence
      contemporaryStyle: number; // Modern/trending visual style
      viralPotential: number;    // Engagement potential indicators
    };
  };
}

export interface ScoringResult {
  totalScore: number;          // 0-100
  normalizedScore: number;     // 0-1
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  breakdown: ScoreBreakdown;
  recommendations: string[];
  timestamp: string;
}

export interface ScoringInput {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  durationSeconds: number;
  stylePresetName?: string;
  styleParameters?: Record<string, unknown>;
  artistBrandGuidelines?: string;
  trendKeywords?: string[];
}

// Quality keywords that indicate a well-crafted prompt
const QUALITY_KEYWORDS = [
  // Technical quality
  '4k', '8k', 'hd', 'high quality', 'detailed', 'sharp', 'crisp',
  // Lighting
  'lighting', 'cinematic', 'dramatic', 'soft light', 'rim light', 'backlit',
  // Camera
  'camera', 'tracking shot', 'dolly', 'gimbal', 'steady', 'smooth',
  // Composition
  'composition', 'framing', 'rule of thirds', 'centered', 'symmetrical',
  // Mood
  'atmosphere', 'mood', 'tone', 'aesthetic', 'vibe',
];

// Style keywords for trend alignment
const TREND_STYLE_KEYWORDS = [
  'viral', 'trending', 'tiktok', 'shorts', 'reels',
  'aesthetic', 'core', 'wave', 'maximalist', 'minimalist',
  'y2k', 'retro', 'vintage', 'cyberpunk', 'futuristic',
];

// Optimal settings for music content
const OPTIMAL_SETTINGS = {
  aspectRatios: {
    '9:16': 1.0,    // Vertical (TikTok, Shorts)
    '16:9': 0.9,    // Horizontal (YouTube)
    '1:1': 0.85,    // Square (Instagram)
    '4:5': 0.8,     // Portrait (Instagram)
  },
  durationRanges: {
    optimal: { min: 10, max: 15 },  // Sweet spot for engagement
    good: { min: 5, max: 30 },
    acceptable: { min: 3, max: 60 },
  },
};

/**
 * Calculate the overall AI score for a video generation
 */
export function calculateScore(
  input: ScoringInput,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoringResult {
  const breakdown = calculateBreakdown(input);

  // Calculate weighted total
  const totalScore =
    breakdown.promptQuality.score * weights.promptQuality +
    breakdown.technicalSettings.score * weights.technicalSettings +
    breakdown.styleAlignment.score * weights.styleAlignment +
    breakdown.trendAlignment.score * weights.trendAlignment;

  const normalizedScore = totalScore / 100;
  const grade = getGrade(totalScore);
  const recommendations = generateRecommendations(breakdown, input);

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    normalizedScore: Math.round(normalizedScore * 1000) / 1000,
    grade,
    breakdown,
    recommendations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Calculate detailed breakdown scores
 */
function calculateBreakdown(input: ScoringInput): ScoreBreakdown {
  return {
    promptQuality: calculatePromptQuality(input.prompt, input.negativePrompt),
    technicalSettings: calculateTechnicalSettings(input),
    styleAlignment: calculateStyleAlignment(input),
    trendAlignment: calculateTrendAlignment(input),
  };
}

/**
 * Score prompt quality based on length, specificity, and structure
 */
function calculatePromptQuality(
  prompt: string,
  negativePrompt?: string
): ScoreBreakdown['promptQuality'] {
  const promptLower = prompt.toLowerCase();

  // Length score (optimal: 100-500 characters)
  const length = prompt.length;
  let lengthScore = 0;
  if (length >= 100 && length <= 500) {
    lengthScore = 100;
  } else if (length >= 50 && length < 100) {
    lengthScore = 60 + (length - 50) * 0.8;
  } else if (length > 500 && length <= 800) {
    lengthScore = 100 - (length - 500) * 0.1;
  } else if (length < 50) {
    lengthScore = length * 1.2;
  } else {
    lengthScore = Math.max(60, 100 - (length - 800) * 0.05);
  }

  // Specificity score (presence of quality keywords)
  const matchedKeywords = QUALITY_KEYWORDS.filter(kw =>
    promptLower.includes(kw.toLowerCase())
  );
  const specificityScore = Math.min(100, matchedKeywords.length * 15);

  // Structure score (commas, periods, sections indicate structure)
  const commaCount = (prompt.match(/,/g) || []).length;
  const periodCount = (prompt.match(/\./g) || []).length;
  const hasNegativePrompt = negativePrompt && negativePrompt.length > 10;

  let structureScore = 50; // Base score
  structureScore += Math.min(20, commaCount * 3);
  structureScore += Math.min(15, periodCount * 5);
  structureScore += hasNegativePrompt ? 15 : 0;

  const totalScore = (lengthScore * 0.3 + specificityScore * 0.4 + structureScore * 0.3);

  return {
    score: Math.round(totalScore),
    details: {
      length: Math.round(lengthScore),
      specificity: Math.round(specificityScore),
      structure: Math.round(structureScore),
    },
  };
}

/**
 * Score technical settings
 */
function calculateTechnicalSettings(
  input: ScoringInput
): ScoreBreakdown['technicalSettings'] {
  // Aspect ratio score
  const aspectRatioScore = (OPTIMAL_SETTINGS.aspectRatios[input.aspectRatio as keyof typeof OPTIMAL_SETTINGS.aspectRatios] || 0.7) * 100;

  // Duration score
  let durationScore = 50;
  const { durationSeconds } = input;
  const { optimal, good } = OPTIMAL_SETTINGS.durationRanges;

  if (durationSeconds >= optimal.min && durationSeconds <= optimal.max) {
    durationScore = 100;
  } else if (durationSeconds >= good.min && durationSeconds <= good.max) {
    if (durationSeconds < optimal.min) {
      durationScore = 70 + (durationSeconds - good.min) / (optimal.min - good.min) * 30;
    } else {
      durationScore = 70 + (good.max - durationSeconds) / (good.max - optimal.max) * 30;
    }
  } else {
    durationScore = 50;
  }

  // FPS score (assume optimal from style parameters)
  let fpsScore = 80; // Default good score
  if (input.styleParameters?.fps) {
    const fps = input.styleParameters.fps as number;
    if (fps >= 30 && fps <= 60) {
      fpsScore = 100;
    } else if (fps === 24) {
      fpsScore = 90; // Cinematic
    }
  }

  const totalScore = aspectRatioScore * 0.4 + durationScore * 0.4 + fpsScore * 0.2;

  return {
    score: Math.round(totalScore),
    details: {
      aspectRatio: Math.round(aspectRatioScore),
      duration: Math.round(durationScore),
      fps: Math.round(fpsScore),
    },
  };
}

/**
 * Score style alignment
 */
function calculateStyleAlignment(
  input: ScoringInput
): ScoreBreakdown['styleAlignment'] {
  const promptLower = input.prompt.toLowerCase();

  // Style preset match score
  let stylePresetScore = 60; // Base score without preset
  if (input.stylePresetName) {
    // Having a style preset indicates intentional style choice
    stylePresetScore = 85;

    // Check if style keywords are in prompt
    const styleWords = input.stylePresetName.toLowerCase().split(/[\s-]+/);
    const matchedStyleWords = styleWords.filter(word =>
      word.length > 3 && promptLower.includes(word)
    );
    stylePresetScore += Math.min(15, matchedStyleWords.length * 5);
  }

  // Brand consistency score
  let brandScore = 70; // Default score
  if (input.artistBrandGuidelines) {
    // Extract key brand terms and check prompt alignment
    const brandTerms = input.artistBrandGuidelines
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(term => term.length > 4);

    const matchedBrandTerms = brandTerms.filter(term =>
      promptLower.includes(term)
    );
    brandScore = 60 + Math.min(40, matchedBrandTerms.length * 10);
  }

  // Visual coherence (based on prompt structure and keywords)
  let visualScore = 70;
  const visualKeywords = ['color', 'light', 'camera', 'shot', 'scene', 'background'];
  const matchedVisual = visualKeywords.filter(kw => promptLower.includes(kw));
  visualScore = 60 + Math.min(40, matchedVisual.length * 8);

  const totalScore = stylePresetScore * 0.4 + brandScore * 0.35 + visualScore * 0.25;

  return {
    score: Math.round(totalScore),
    details: {
      stylePresetMatch: Math.round(stylePresetScore),
      brandConsistency: Math.round(brandScore),
      visualCoherence: Math.round(visualScore),
    },
  };
}

/**
 * Score trend alignment
 */
function calculateTrendAlignment(
  input: ScoringInput
): ScoreBreakdown['trendAlignment'] {
  const promptLower = input.prompt.toLowerCase();

  // Trend keywords score
  let trendKeywordScore = 50; // Base score
  if (input.trendKeywords && input.trendKeywords.length > 0) {
    const matchedTrends = input.trendKeywords.filter(trend =>
      promptLower.includes(trend.toLowerCase())
    );
    trendKeywordScore = 60 + Math.min(40, (matchedTrends.length / input.trendKeywords.length) * 40);
  }

  // Contemporary style score
  const matchedTrendStyles = TREND_STYLE_KEYWORDS.filter(kw =>
    promptLower.includes(kw.toLowerCase())
  );
  const contemporaryScore = 50 + Math.min(50, matchedTrendStyles.length * 12);

  // Viral potential (short-form optimized, engaging elements)
  let viralScore = 60;
  const viralIndicators = [
    'dynamic', 'energetic', 'bold', 'striking', 'eye-catching',
    'engaging', 'captivating', 'stunning', 'powerful', 'intense',
  ];
  const matchedViral = viralIndicators.filter(ind => promptLower.includes(ind));
  viralScore = 50 + Math.min(50, matchedViral.length * 10);

  // Bonus for vertical aspect ratio (social media optimized)
  if (input.aspectRatio === '9:16') {
    viralScore = Math.min(100, viralScore + 10);
  }

  const totalScore = trendKeywordScore * 0.35 + contemporaryScore * 0.35 + viralScore * 0.3;

  return {
    score: Math.round(totalScore),
    details: {
      trendKeywords: Math.round(trendKeywordScore),
      contemporaryStyle: Math.round(contemporaryScore),
      viralPotential: Math.round(viralScore),
    },
  };
}

/**
 * Convert score to grade
 */
function getGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

/**
 * Generate improvement recommendations
 */
function generateRecommendations(
  breakdown: ScoreBreakdown,
  input: ScoringInput
): string[] {
  const recommendations: string[] = [];

  // Prompt quality recommendations
  if (breakdown.promptQuality.details.length < 70) {
    if (input.prompt.length < 100) {
      recommendations.push('Add more detail to your prompt (aim for 100-500 characters)');
    } else {
      recommendations.push('Consider condensing your prompt to focus on key elements');
    }
  }

  if (breakdown.promptQuality.details.specificity < 60) {
    recommendations.push('Include specific visual keywords like lighting, camera angles, or mood descriptors');
  }

  if (breakdown.promptQuality.details.structure < 70) {
    recommendations.push('Use commas to separate visual elements and add a negative prompt');
  }

  // Technical settings recommendations
  if (breakdown.technicalSettings.details.aspectRatio < 90) {
    recommendations.push('Consider using 9:16 aspect ratio for maximum social media engagement');
  }

  if (breakdown.technicalSettings.details.duration < 80) {
    recommendations.push('10-15 second videos tend to perform best for engagement');
  }

  // Style alignment recommendations
  if (breakdown.styleAlignment.details.stylePresetMatch < 80 && !input.stylePresetName) {
    recommendations.push('Select a style preset to ensure consistent visual quality');
  }

  if (breakdown.styleAlignment.details.brandConsistency < 70) {
    recommendations.push('Incorporate more brand-specific elements from artist guidelines');
  }

  // Trend alignment recommendations
  if (breakdown.trendAlignment.details.trendKeywords < 60 && input.trendKeywords?.length) {
    recommendations.push('Include trending keywords in your prompt for better relevance');
  }

  if (breakdown.trendAlignment.details.viralPotential < 70) {
    recommendations.push('Add dynamic, engaging elements to increase viral potential');
  }

  // Limit to top 5 recommendations
  return recommendations.slice(0, 5);
}

/**
 * Batch score multiple generations
 */
export function batchCalculateScores(
  inputs: ScoringInput[],
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoringResult[] {
  return inputs.map(input => calculateScore(input, weights));
}

/**
 * Compare two scores
 */
export function compareScores(
  scoreA: ScoringResult,
  scoreB: ScoringResult
): {
  winner: 'A' | 'B' | 'tie';
  difference: number;
  breakdown: Record<string, { a: number; b: number; winner: 'A' | 'B' | 'tie' }>;
} {
  const diff = scoreA.totalScore - scoreB.totalScore;
  const winner = diff > 2 ? 'A' : diff < -2 ? 'B' : 'tie';

  const breakdown: Record<string, { a: number; b: number; winner: 'A' | 'B' | 'tie' }> = {};

  const categories = ['promptQuality', 'technicalSettings', 'styleAlignment', 'trendAlignment'] as const;

  for (const cat of categories) {
    const a = scoreA.breakdown[cat].score;
    const b = scoreB.breakdown[cat].score;
    const catDiff = a - b;
    breakdown[cat] = {
      a,
      b,
      winner: catDiff > 2 ? 'A' : catDiff < -2 ? 'B' : 'tie',
    };
  }

  return {
    winner,
    difference: Math.abs(diff),
    breakdown,
  };
}

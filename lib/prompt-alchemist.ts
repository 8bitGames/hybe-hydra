import { generateJSON, isGeminiConfigured } from "./gemini";
import {
  sanitizeWithArtistContext,
  detectCelebrityNames,
  createCelebrityWarning,
  addCelebrityForDetection,
} from "./celebrity-sanitizer";

// Types
export interface ArtistProfile {
  name: string;
  stageName?: string;
  groupName?: string;
  profileDescription?: string;
  brandGuidelines?: string;
}

export interface PromptTransformInput {
  userInput: string;
  artistProfile?: ArtistProfile;
  trendKeywords?: string[];
  safetyLevel?: "high" | "medium" | "low";
}

export interface PromptTransformOutput {
  status: "success" | "blocked";
  analysis: {
    intent: string;
    trendApplied: string[];
    safetyCheck: {
      passed: boolean;
      concerns: string[];
    };
  };
  veoPrompt: string;
  negativePrompt: string;
  technicalSettings: {
    aspectRatio: string;
    fps: number;
    durationSeconds: number;
    guidanceScale: number;
  };
  blockedReason?: string;
  // Celebrity name warning
  celebrityWarning?: string;
  detectedCelebrities?: string[];
}

// Safety keywords to check
const SAFETY_KEYWORDS = {
  violence: ["폭력", "피", "무기", "싸움", "죽", "살인", "총", "칼", "blood", "violence", "weapon", "fight", "kill", "gun", "knife"],
  nsfw: ["성인", "노출", "선정", "벗", "야한", "섹시", "nude", "naked", "sexual", "explicit", "porn"],
  brandNegative: ["담배", "술", "마약", "약물", "cigarette", "smoke", "drug", "alcohol", "drunk"],
  defamation: ["비하", "모욕", "혐오", "차별", "insult", "hate", "discrimin"],
};

// Check for safety violations
function checkSafety(input: string): { passed: boolean; concerns: string[] } {
  const concerns: string[] = [];
  const lowerInput = input.toLowerCase();

  for (const [category, keywords] of Object.entries(SAFETY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        concerns.push(`${category}: "${keyword}" detected`);
      }
    }
  }

  return {
    passed: concerns.length === 0,
    concerns,
  };
}

// System prompt for Prompt Alchemist
const ALCHEMIST_SYSTEM_PROMPT = `You are the "Hydra Prompt Alchemist," an elite AI Creative Director.
Your mission: Convert simple user inputs into optimized video generation prompts.

## CRITICAL: NO REAL CELEBRITY NAMES
⚠️ IMPORTANT: Google Veo CANNOT generate videos with real people's names or likenesses.
You MUST replace any artist/celebrity names with generic descriptions:
- Instead of "Taylor Swift" → use "a female pop artist"
- Instead of "Lady A" → use "a country music group"
- Instead of "Thomas Rhett" → use "a male country artist"
- Instead of "[Artist Name]" → use "the featured artist" or "the performer"

NEVER include actual names of real people in veoPrompt. Use descriptive terms only.

## CORE PRINCIPLES
1. **Country Music Aesthetic Excellence**: High-production, cinematic, authentic Nashville style
2. **Brand Safety First**: Zero tolerance for NSFW, violence, defamation
3. **No Real Names**: Replace all celebrity/artist names with generic descriptions
4. **Viral Optimization**: Trend-aware, engagement-maximized

## CINEMATIC FORMULA
When expanding prompts, apply:
- SUBJECT: Generic artist description (gender, style, clothing, hair, expression, pose) - NO REAL NAMES
- ENVIRONMENT: Weather, time of day, location, textures
- LIGHTING: Volumetric, rim light, bokeh, anamorphic flares
- CAMERA: Push-in, orbit, gimbal, dolly, tracking shots
- MOOD/COLOR: Teal-orange, pastel dreamcore, high contrast

## QUALITY KEYWORDS TO APPEND
- "4K, 8K, photorealistic, highly detailed, sharp focus"
- "physics-based rendering, fluid motion, cinematic"
- "professional lighting, film grain, masterpiece"

## OUTPUT FORMAT
You must respond with a JSON object containing:
{
  "analysis": {
    "intent": "Brief interpretation of the creative intent",
    "trendApplied": ["trend1", "trend2"]
  },
  "veoPrompt": "THE_OPTIMIZED_PROMPT_WITHOUT_REAL_NAMES - use generic descriptions only",
  "negativePrompt": "distortion, bad anatomy, morphing, blur, watermark, text, low quality, ugly, deformed, extra limbs, static pose, frozen face",
  "technicalSettings": {
    "aspectRatio": "9:16",
    "fps": 60,
    "durationSeconds": 15,
    "guidanceScale": 7.5
  }
}`;

// Transform user input to optimized Veo prompt
export async function transformPrompt(input: PromptTransformInput): Promise<PromptTransformOutput> {
  // Safety check first
  const safetyCheck = checkSafety(input.userInput);

  if (!safetyCheck.passed && input.safetyLevel !== "low") {
    return {
      status: "blocked",
      analysis: {
        intent: "Unable to process due to safety concerns",
        trendApplied: [],
        safetyCheck,
      },
      veoPrompt: "",
      negativePrompt: "",
      technicalSettings: {
        aspectRatio: "9:16",
        fps: 60,
        durationSeconds: 15,
        guidanceScale: 7.5,
      },
      blockedReason: `Safety violation detected: ${safetyCheck.concerns.join(", ")}`,
    };
  }

  // Add artist profile names to detection list dynamically
  if (input.artistProfile) {
    const artistNames = [
      input.artistProfile.name,
      input.artistProfile.stageName,
      input.artistProfile.groupName,
    ].filter(Boolean) as string[];

    if (artistNames.length > 0) {
      // Determine artist type based on profile
      const artistType = input.artistProfile.groupName ? "male_group" : "male_solo";
      const description = input.artistProfile.groupName
        ? `a music group`
        : `the featured artist`;
      addCelebrityForDetection(artistNames, artistType, description);
    }
  }

  // Detect celebrity names in user input
  const inputDetectedNames = detectCelebrityNames(input.userInput);
  const celebrityWarning = inputDetectedNames.length > 0
    ? createCelebrityWarning(inputDetectedNames)
    : undefined;

  // Check if Gemini is configured
  if (!isGeminiConfigured()) {
    // Return mock response if not configured
    const mockResponse = getMockResponse(input);
    // Post-process to sanitize celebrity names
    const sanitized = sanitizeWithArtistContext(mockResponse.veoPrompt, input.artistProfile);
    return {
      ...mockResponse,
      veoPrompt: sanitized.sanitizedText,
      celebrityWarning,
      detectedCelebrities: inputDetectedNames,
    };
  }

  try {
    // Build the prompt for Gemini
    const userPrompt = buildUserPrompt(input);

    const result = await generateJSON<{
      analysis: {
        intent: string;
        trendApplied: string[];
      };
      veoPrompt: string;
      negativePrompt: string;
      technicalSettings: {
        aspectRatio: string;
        fps: number;
        durationSeconds: number;
        guidanceScale: number;
      };
    }>(`${ALCHEMIST_SYSTEM_PROMPT}\n\n---\n\nUser Request:\n${userPrompt}`);

    // Post-process to ensure no celebrity names leaked through
    const sanitized = sanitizeWithArtistContext(result.veoPrompt, input.artistProfile);

    // Combine detected names from input and output
    const allDetectedNames = [...new Set([...inputDetectedNames, ...sanitized.detectedNames])];
    const finalWarning = allDetectedNames.length > 0
      ? createCelebrityWarning(allDetectedNames)
      : undefined;

    return {
      status: "success",
      analysis: {
        ...result.analysis,
        safetyCheck,
      },
      veoPrompt: sanitized.sanitizedText,
      negativePrompt: result.negativePrompt,
      technicalSettings: result.technicalSettings,
      celebrityWarning: finalWarning,
      detectedCelebrities: allDetectedNames.length > 0 ? allDetectedNames : undefined,
    };
  } catch (error) {
    console.error("Prompt transformation error:", error);
    // Fallback to mock response on error
    const mockResponse = getMockResponse(input);
    // Post-process to sanitize celebrity names
    const sanitized = sanitizeWithArtistContext(mockResponse.veoPrompt, input.artistProfile);
    return {
      ...mockResponse,
      veoPrompt: sanitized.sanitizedText,
      celebrityWarning,
      detectedCelebrities: inputDetectedNames,
    };
  }
}

// Build user prompt for Gemini
function buildUserPrompt(input: PromptTransformInput): string {
  let prompt = `User Input: "${input.userInput}"`;

  if (input.artistProfile) {
    prompt += `\n\nArtist Profile (FOR CONTEXT ONLY - DO NOT USE THESE NAMES IN OUTPUT):
- Name: ${input.artistProfile.name} → Replace with "the featured artist" or generic description
- Stage Name: ${input.artistProfile.stageName || "N/A"} → DO NOT include in veoPrompt
- Group: ${input.artistProfile.groupName || "Solo"} → Replace with "the group" if applicable
- Description: ${input.artistProfile.profileDescription || "No specific description"}
- Brand Guidelines: ${input.artistProfile.brandGuidelines || "Follow standard quality guidelines"}

⚠️ REMINDER: The artist information above is for understanding style/aesthetic only.
You MUST NOT include any real names in the veoPrompt. Use generic descriptions like "the featured artist", "a male/female artist", etc.`;
  }

  if (input.trendKeywords && input.trendKeywords.length > 0) {
    prompt += `\n\nCurrent Trend Keywords: ${input.trendKeywords.join(", ")}`;
  }

  prompt += `\n\nPlease transform this into an optimized video generation prompt following the Cinematic Formula.
CRITICAL: Your veoPrompt output must NOT contain any real person's name. Use only generic descriptions.`;

  return prompt;
}

// Mock response for testing without API
function getMockResponse(input: PromptTransformInput): PromptTransformOutput {
  // Use generic description instead of actual artist name for Veo compatibility
  const artistDescription = "the featured artist";
  const artistNameForAnalysis = input.artistProfile?.stageName || input.artistProfile?.name || "the artist";

  // Sanitize user input for the prompt
  const sanitizedInput = sanitizeWithArtistContext(input.userInput, input.artistProfile);

  return {
    status: "success",
    analysis: {
      intent: `Creating a visually stunning country music style video featuring ${artistNameForAnalysis}`,
      trendApplied: input.trendKeywords?.slice(0, 3) || ["cinematic", "trending"],
      safetyCheck: {
        passed: true,
        concerns: [],
      },
    },
    veoPrompt: `Cinematic 4K video of ${artistDescription} ${sanitizedInput.sanitizedText}. Professional country music video style with warm golden lighting, dramatic rim lighting highlighting silhouette. Smooth gimbal tracking shot, shallow depth of field. Warm amber and natural color grading, subtle film grain overlay. Photorealistic, highly detailed, physics-based rendering, masterpiece quality. Dynamic camera movement, perfect composition.`,
    negativePrompt: "distortion, bad anatomy, morphing, blur, watermark, text, low quality, ugly, deformed, extra limbs, static pose, frozen face, jittery motion, unnatural movement, face deformation, identity shift",
    technicalSettings: {
      aspectRatio: "9:16",
      fps: 60,
      durationSeconds: 15,
      guidanceScale: 7.5,
    },
  };
}

// Analyze image for visual characteristics (future use)
export async function analyzeImage(imageBase64: string): Promise<{
  description: string;
  visualTraits: string[];
  suggestedStyle: string;
}> {
  // TODO: Implement with Gemini Vision when needed
  return {
    description: "Image analysis not yet implemented",
    visualTraits: [],
    suggestedStyle: "cinematic",
  };
}

import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/db/prisma";

// S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Initialize Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "",
});

// Gemini SDK call - fast, no thinking or search
async function callGemini(
  contents: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  model: string = "gemini-flash-latest"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  console.log(`[PERSONALIZE] Calling Gemini SDK: ${model}`);
  const startTime = Date.now();

  // Build parts array for the SDK
  const parts = contents.map((c) => {
    if (c.inlineData) {
      return {
        inlineData: {
          mimeType: c.inlineData.mimeType,
          data: c.inlineData.data,
        },
      };
    }
    return { text: c.text || "" };
  });

  try {
    const response = await ai.models.generateContentStream({
      model,
      contents: [
        {
          role: "user",
          parts,
        },
      ],
    });

    // Collect streamed response
    let fullText = "";
    for await (const chunk of response) {
      if (chunk.text) {
        fullText += chunk.text;
      }
    }

    console.log(`[PERSONALIZE] Gemini response: ${fullText.length} chars in ${Date.now() - startTime}ms`);
    return fullText;
  } catch (error) {
    console.error(`[PERSONALIZE] Gemini SDK error:`, error);
    throw error;
  }
}

// ============================================================================
// Types
// ============================================================================

interface ImageData {
  url: string;
  type?: "reference" | "merchandise" | "product";
  name?: string;
  base64?: string; // For locally uploaded images (already converted)
  mimeType?: string;
}

interface ContextData {
  selectedIdea?: {
    title: string;
    description: string;
    hook?: string;
    type: "ai_video" | "compose";
    optimizedPrompt?: string;
  } | null;
  hashtags: string[];
  keywords: string[];
  campaignName: string;
  artistName?: string;
  performanceMetrics?: {
    avgViews: number;
    avgEngagement: number;
    viralBenchmark: number;
  } | null;
  aiInsights?: string[];
}

interface PromptVariation {
  id: string;
  title: string;
  concept: string;
  imageUsage: string;
  mood: string;
  cameraWork: string;
  suggestedPromptPreview: string;
  confidence: "high" | "medium" | "low";
}

interface AnalyzeRequest {
  action: "analyze";
  images: ImageData[];
  context: ContextData;
}

interface FinalizeRequest {
  action: "finalize";
  selectedVariation: PromptVariation;
  images: ImageData[];
  context: ContextData;
  userFeedback?: string;
}

interface StashRequest {
  action: "stash";
  name: string;
  images: ImageData[];
  context: ContextData;
  variations: PromptVariation[];
  imageAnalysis: {
    summary: string;
    detectedElements: string[];
    colorPalette: string[];
    mood: string;
  };
  // Prompts used for generation (for reproducibility)
  analysisPromptUsed?: string;   // Full prompt sent to Gemini for image analysis
  finalizePromptUsed?: string;   // Full prompt sent to Gemini for finalization
  // Selected/finalized results
  selectedVariationId?: string;
  veo3Prompt?: string;           // The final Veo3 video generation prompt
  finalMetadata?: {
    duration: string;
    aspectRatio: string;
    style: string;
    recommendedSettings: {
      fps: number;
      resolution: string;
    };
  };
  tags?: string[];
  campaignId?: string;
}

interface ListStashRequest {
  action: "list-stash";
  campaignId?: string;
  tags?: string[];
  favoritesOnly?: boolean;
  page?: number;
  pageSize?: number;
}

interface GetStashRequest {
  action: "get-stash";
  id: string;
}

interface DeleteStashRequest {
  action: "delete-stash";
  id: string;
}

interface UpdateStashRequest {
  action: "update-stash";
  id: string;
  name?: string;
  tags?: string[];
  isFavorite?: boolean;
  // Prompts
  analysisPromptUsed?: string;
  finalizePromptUsed?: string;
  selectedVariationId?: string;
  veo3Prompt?: string;
  finalMetadata?: {
    duration: string;
    aspectRatio: string;
    style: string;
    recommendedSettings: {
      fps: number;
      resolution: string;
    };
  };
}

type RequestBody =
  | AnalyzeRequest
  | FinalizeRequest
  | StashRequest
  | ListStashRequest
  | GetStashRequest
  | DeleteStashRequest
  | UpdateStashRequest;

interface AnalyzeResponse {
  success: boolean;
  variations: PromptVariation[];
  imageAnalysis: {
    summary: string;
    detectedElements: string[];
    colorPalette: string[];
    mood: string;
  };
  analysisPromptUsed: string;  // The full prompt sent to Gemini
}

interface FinalizeResponse {
  success: boolean;
  veo3Prompt: string;          // The final Veo3 video generation prompt
  metadata: {
    duration: string;
    aspectRatio: string;
    style: string;
    recommendedSettings: {
      fps: number;
      resolution: string;
    };
  };
  finalizePromptUsed: string;  // The full prompt sent to Gemini
}

// Extract S3 key from URL
function extractS3Key(imageUrl: string): string | null {
  const bucket = process.env.AWS_S3_BUCKET || "hydra-assets-hybe";

  // Match pattern: https://bucket.s3.region.amazonaws.com/key
  const s3Pattern = new RegExp(`https?://${bucket}\\.s3\\.[^/]+\\.amazonaws\\.com/(.+)`);
  const match = imageUrl.match(s3Pattern);

  if (match) {
    return decodeURIComponent(match[1]);
  }

  // Also match: https://s3.region.amazonaws.com/bucket/key
  const altPattern = new RegExp(`https?://s3\\.[^/]+\\.amazonaws\\.com/${bucket}/(.+)`);
  const altMatch = imageUrl.match(altPattern);

  if (altMatch) {
    return decodeURIComponent(altMatch[1]);
  }

  return null;
}

// Get signed URL for S3 object
async function getS3SignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET || "hydra-assets-hybe",
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min expiry
}

// Fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // Skip placeholder URLs
    if (imageUrl.includes("placeholder.co") || imageUrl.includes("placeholder.com")) {
      console.log(`[PERSONALIZE] Skipping placeholder URL`);
      return null;
    }

    // Skip blob URLs (local file references)
    if (imageUrl.startsWith("blob:")) {
      console.log(`[PERSONALIZE] Skipping blob URL (local file)`);
      return null;
    }

    let fetchUrl = imageUrl;

    // Check if it's an S3 URL and get signed URL
    const s3Key = extractS3Key(imageUrl);
    if (s3Key) {
      console.log(`[PERSONALIZE] S3 key detected: ${s3Key.slice(0, 80)}...`);
      try {
        fetchUrl = await getS3SignedUrl(s3Key);
        console.log(`[PERSONALIZE] Got signed URL for S3 object`);
      } catch (s3Error) {
        console.error(`[PERSONALIZE] Failed to get signed URL:`, s3Error);
        // Try fetching the original URL directly as fallback
        fetchUrl = imageUrl;
      }
    }

    console.log(`[PERSONALIZE] Fetching image from: ${fetchUrl.slice(0, 100)}...`);
    const response = await fetch(fetchUrl, {
      headers: {
        "Accept": "image/*",
      },
    });

    if (!response.ok) {
      console.error(`[PERSONALIZE] Failed to fetch image: ${response.status} ${response.statusText}`);
      // Log the response body for debugging
      const errorBody = await response.text().catch(() => "");
      if (errorBody) {
        console.error(`[PERSONALIZE] Error body: ${errorBody.slice(0, 200)}`);
      }
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Check if response is actually an image
    if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
      console.error(`[PERSONALIZE] Unexpected content type: ${contentType}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    // Validate we got actual data
    if (arrayBuffer.byteLength < 100) {
      console.error(`[PERSONALIZE] Image too small (${arrayBuffer.byteLength} bytes), likely invalid`);
      return null;
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");

    console.log(`[PERSONALIZE] Fetched OK: ${Math.round(arrayBuffer.byteLength / 1024)}KB, type: ${contentType}`);
    return { base64, mimeType: contentType };
  } catch (error) {
    console.error("[PERSONALIZE] Error fetching image:", error);
    return null;
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    switch (body.action) {
      case "analyze":
        return await handleAnalyze(body);
      case "finalize":
        return await handleFinalize(body);
      case "stash":
        return await handleStash(body);
      case "list-stash":
        return await handleListStash(body);
      case "get-stash":
        return await handleGetStash(body);
      case "delete-stash":
        return await handleDeleteStash(body);
      case "update-stash":
        return await handleUpdateStash(body);
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action. Use 'analyze', 'finalize', 'stash', 'list-stash', 'get-stash', 'delete-stash', or 'update-stash'." },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Personalize prompt error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Step 1: Analyze Images & Generate Variations
// ============================================================================

async function handleAnalyze(request: AnalyzeRequest): Promise<NextResponse> {
  const { images, context } = request;

  console.log("=".repeat(60));
  console.log("[API] 🚀 handleAnalyze called");
  console.log(`[API]    Images received: ${images?.length || 0}`);

  if (!images || images.length === 0) {
    console.log("[API] ❌ No images provided");
    return NextResponse.json(
      { success: false, error: "At least one image is required" },
      { status: 400 }
    );
  }

  try {
    const startTime = Date.now();
    console.log(`[API] 📷 Processing ${images.length} images...`);

    images.forEach((img, idx) => {
      console.log(`[API]    Image ${idx + 1}:`);
      console.log(`[API]      Name: ${img.name || "unnamed"}`);
      console.log(`[API]      Has base64: ${!!img.base64} (${img.base64?.length || 0} chars)`);
      console.log(`[API]      MIME type: ${img.mimeType || "none"}`);
      console.log(`[API]      URL: ${img.url?.slice(0, 60)}...`);
    });

    // Process images - either use provided base64 or fetch from URL
    const fetchStart = Date.now();
    const imageDataResults = await Promise.all(
      images.slice(0, 3).map(async (img, idx) => {
        // If base64 is already provided (from local upload), use it directly
        if (img.base64 && img.mimeType) {
          console.log(`[API]    ✅ Image ${idx + 1}: Using provided base64 (${Math.round(img.base64.length / 1024)}KB)`);
          return {
            base64: img.base64,
            mimeType: img.mimeType,
            name: img.name,
            type: img.type,
          };
        }

        // Otherwise, fetch from URL (S3 or external)
        console.log(`[API]    🌐 Image ${idx + 1}: Fetching from URL...`);
        const data = await fetchImageAsBase64(img.url);
        if (data) {
          console.log(`[API]    ✅ Image ${idx + 1}: Fetched OK (${Math.round(data.base64.length / 1024)}KB)`);
        } else {
          console.log(`[API]    ❌ Image ${idx + 1}: Failed to fetch`);
        }
        return data ? { ...data, name: img.name, type: img.type } : null;
      })
    );
    const validImageData = imageDataResults.filter((d) => d !== null);
    console.log(`[API] 📊 Images ready: ${validImageData.length}/${images.length} in ${Date.now() - fetchStart}ms`);

    if (validImageData.length === 0) {
      console.log("[API] ❌ No valid images after processing");
      return NextResponse.json(
        { success: false, error: "Could not process any images. Please ensure images are accessible." },
        { status: 400 }
      );
    }

    // Build context string
    const contextStr = buildContextString(context);
    console.log(`[API] 📝 Context built (${contextStr.length} chars)`);
    console.log(`[API] 🤖 Calling Gemini for analysis...`);

    // Build the analysis prompt
    const analysisPrompt = `You are a creative director specializing in viral TikTok and short-form video content.

## Task
Analyze the provided image(s) and create 3 unique creative directions for a Veo3 AI-generated video that incorporates these images with the user's campaign context.

## Campaign Context
${contextStr}

## Image Analysis Instructions
For each provided image:
1. Identify key visual elements (subjects, objects, colors, composition)
2. Detect the mood and atmosphere
3. Note any brand elements, products, or merchandise
4. Consider how it could be featured in a video (prominently, as background, color extraction, style reference)

## Output Requirements
Return ONLY valid JSON in this exact format:

{
  "imageAnalysis": {
    "summary": "Brief overall summary of what the images contain",
    "detectedElements": ["element1", "element2", "element3"],
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "mood": "overall mood description"
  },
  "variations": [
    {
      "title": "Short catchy title (max 40 chars)",
      "concept": "2-3 sentence description of the creative direction",
      "imageUsage": "How the images are incorporated (featured prominently, background element, style reference, color palette extraction)",
      "mood": "Mood/tone description",
      "cameraWork": "Suggested camera movements and techniques",
      "suggestedPromptPreview": "A 50-word preview of what the final Veo3 prompt would look like",
      "confidence": "high" or "medium" or "low"
    }
  ]
}

## Guidelines
1. Each variation should be DISTINCTLY different in approach
2. First variation: Feature the images/products prominently in the scene
3. Second variation: Use images as style/aesthetic inspiration (cinematic storytelling)
4. Third variation: Abstract/artistic interpretation using colors and mood from images
5. Consider viral TikTok trends and engagement patterns
6. Ensure concepts are feasible for AI video generation
7. Return ONLY the JSON object, no other text or markdown`;

    // Build contents array with images
    const contents: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [];

    // Add images
    for (const imgData of validImageData) {
      contents.push({
        inlineData: {
          mimeType: imgData.mimeType,
          data: imgData.base64,
        },
      });
    }

    // Add the prompt
    contents.push({ text: analysisPrompt });

    // Call Gemini SDK
    const geminiStart = Date.now();
    console.log(`[API] 🌐 Sending to Gemini (${validImageData.length} images, ${contents.length} parts)...`);
    const responseText = await callGemini(contents);
    console.log(`[API] ✅ Gemini responded in ${Date.now() - geminiStart}ms`);
    console.log(`[API]    Response length: ${responseText.length} chars`);

    // Parse response
    console.log(`[API] 🔄 Parsing response...`);
    const parsed = parseAnalysisResponse(responseText);
    console.log(`[API] ✅ Analysis complete!`);
    console.log(`[API]    Variations: ${parsed.variations.length}`);
    console.log(`[API]    Image analysis summary: ${parsed.imageAnalysis.summary?.slice(0, 50)}...`);
    console.log(`[API] ⏱️ Total time: ${Date.now() - startTime}ms`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      variations: parsed.variations,
      imageAnalysis: parsed.imageAnalysis,
      analysisPromptUsed: analysisPrompt,  // Return the prompt for stashing
    } as AnalyzeResponse);
  } catch (error) {
    console.error("[PERSONALIZE] Analysis error:", error);
    throw error;
  }
}

// ============================================================================
// Step 2: Finalize the Veo3 Prompt
// ============================================================================

async function handleFinalize(request: FinalizeRequest): Promise<NextResponse> {
  const { selectedVariation, images, context, userFeedback } = request;

  if (!selectedVariation) {
    return NextResponse.json(
      { success: false, error: "Selected variation is required" },
      { status: 400 }
    );
  }

  try {
    console.log(`[PERSONALIZE] FINALIZE START - variation: ${selectedVariation.title}`);

    // Build context string
    const contextStr = buildContextString(context);

    // Build image descriptions for the prompt
    const imageDescriptions = images
      .map((img, i) => `Image ${i + 1}${img.name ? ` (${img.name})` : ""}: ${img.type || "reference"} image`)
      .join("\n");

    // Build the finalization prompt
    const finalizePrompt = `You are a Veo3 AI video generation prompt expert.

## Task
Create the FINAL optimized prompt for Veo3 video generation based on the selected creative direction.

## Selected Creative Direction
Title: ${selectedVariation.title}
Concept: ${selectedVariation.concept}
Image Usage: ${selectedVariation.imageUsage}
Mood: ${selectedVariation.mood}
Camera Work: ${selectedVariation.cameraWork}
${userFeedback ? `\nUser's Additional Notes: ${userFeedback}` : ""}

## Campaign Context
${contextStr}

## Reference Images
${imageDescriptions}

## Output Requirements
Return ONLY valid JSON in this exact format:

{
  "finalPrompt": "The complete, detailed Veo3 video generation prompt (300-500 words). Include: scene description, lighting, camera movements, transitions, mood, pacing, and how the reference images/products are incorporated. Be extremely specific and cinematic.",
  "metadata": {
    "duration": "5s" or "8s" (recommended video length),
    "aspectRatio": "9:16" (vertical/TikTok) or "16:9" (horizontal) or "1:1" (square),
    "style": "Primary visual style (e.g., cinematic, documentary, artistic, commercial)",
    "recommendedSettings": {
      "fps": 24 or 30 or 60,
      "resolution": "1080p" or "4K"
    }
  }
}

## Veo3 Prompt Guidelines
1. Start with the main subject/action
2. Describe camera movement (dolly, pan, tilt, zoom, tracking shot)
3. Specify lighting (golden hour, studio, neon, natural)
4. Include atmosphere/mood descriptors
5. Detail any products/merchandise appearance
6. Add temporal progression (what happens from start to end)
7. Include style references if applicable
8. End with quality modifiers (cinematic, professional, high-quality)

Return ONLY the JSON object, no markdown or extra text.`;

    // Prepare images for context (if vision helps with finalization)
    const contents: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [];

    // Optionally include first image for visual reference
    if (images.length > 0) {
      const firstImg = images[0];
      let imageData: { base64: string; mimeType: string } | null = null;

      // Use provided base64 if available, otherwise fetch
      if (firstImg.base64 && firstImg.mimeType) {
        imageData = { base64: firstImg.base64, mimeType: firstImg.mimeType };
      } else {
        imageData = await fetchImageAsBase64(firstImg.url);
      }

      if (imageData) {
        contents.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.base64,
          },
        });
      }
    }

    contents.push({ text: finalizePrompt });

    // Call Gemini SDK
    const responseText = await callGemini(contents);

    // Parse response
    const parsed = parseFinalizeResponse(responseText);

    return NextResponse.json({
      success: true,
      veo3Prompt: parsed.finalPrompt,       // The final Veo3 video generation prompt
      metadata: parsed.metadata,
      finalizePromptUsed: finalizePrompt,   // Return the prompt for stashing
    } as FinalizeResponse);
  } catch (error) {
    console.error("[PERSONALIZE] Finalization error:", error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildContextString(context: ContextData): string {
  const parts: string[] = [];

  if (context.campaignName) {
    parts.push(`Campaign: ${context.campaignName}`);
  }

  if (context.artistName) {
    parts.push(`Artist: ${context.artistName}`);
  }

  if (context.selectedIdea) {
    parts.push(`\nSelected Idea:`);
    parts.push(`  Title: ${context.selectedIdea.title}`);
    parts.push(`  Description: ${context.selectedIdea.description}`);
    if (context.selectedIdea.hook) {
      parts.push(`  Hook: "${context.selectedIdea.hook}"`);
    }
    if (context.selectedIdea.optimizedPrompt) {
      parts.push(`  Base Prompt: ${context.selectedIdea.optimizedPrompt}`);
    }
  }

  if (context.hashtags.length > 0) {
    parts.push(`\nHashtags: ${context.hashtags.map((h) => `#${h}`).join(" ")}`);
  }

  if (context.keywords.length > 0) {
    parts.push(`Keywords: ${context.keywords.join(", ")}`);
  }

  if (context.performanceMetrics) {
    parts.push(`\nPerformance Benchmarks:`);
    parts.push(`  Avg Views: ${Math.round(context.performanceMetrics.avgViews).toLocaleString()}`);
    parts.push(`  Avg Engagement: ${context.performanceMetrics.avgEngagement.toFixed(2)}%`);
    parts.push(`  Viral Benchmark: ${Math.round(context.performanceMetrics.viralBenchmark).toLocaleString()}+ views`);
  }

  if (context.aiInsights && context.aiInsights.length > 0) {
    parts.push(`\nAI Insights: ${context.aiInsights[0]}`);
  }

  return parts.join("\n");
}

function parseAnalysisResponse(responseText: string): {
  variations: PromptVariation[];
  imageAnalysis: {
    summary: string;
    detectedElements: string[];
    colorPalette: string[];
    mood: string;
  };
} {
  try {
    // Extract JSON from response
    let jsonStr = responseText;

    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonStr = jsonObjectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Add IDs to variations
    const variations: PromptVariation[] = (parsed.variations || []).map(
      (v: Omit<PromptVariation, "id">) => ({
        ...v,
        id: uuidv4(),
      })
    );

    return {
      variations,
      imageAnalysis: parsed.imageAnalysis || {
        summary: "Image analysis completed",
        detectedElements: [],
        colorPalette: [],
        mood: "neutral",
      },
    };
  } catch (error) {
    console.error("Failed to parse analysis response:", error);
    console.error("Response text:", responseText.slice(0, 500));

    // Return fallback
    return {
      variations: [
        {
          id: uuidv4(),
          title: "Product Showcase",
          concept: "Feature the product/image prominently with cinematic presentation",
          imageUsage: "Featured prominently as the main subject",
          mood: "Professional and engaging",
          cameraWork: "Slow dolly in with smooth transitions",
          suggestedPromptPreview: "Cinematic product showcase video featuring the item in an elegant setting...",
          confidence: "high",
        },
        {
          id: uuidv4(),
          title: "Lifestyle Integration",
          concept: "Integrate the visuals into a lifestyle/story-driven narrative",
          imageUsage: "Incorporated naturally into the scene",
          mood: "Aspirational and relatable",
          cameraWork: "Dynamic tracking shots following the action",
          suggestedPromptPreview: "A day-in-the-life style video where the product appears naturally...",
          confidence: "medium",
        },
        {
          id: uuidv4(),
          title: "Artistic Mood Piece",
          concept: "Use the colors and aesthetics as inspiration for an abstract visual",
          imageUsage: "Color palette and style reference",
          mood: "Artistic and atmospheric",
          cameraWork: "Sweeping camera movements with dramatic angles",
          suggestedPromptPreview: "Abstract visual journey inspired by the aesthetic elements...",
          confidence: "medium",
        },
      ],
      imageAnalysis: {
        summary: "Images analyzed for creative direction",
        detectedElements: ["visual elements detected"],
        colorPalette: ["#000000", "#FFFFFF"],
        mood: "neutral",
      },
    };
  }
}

function parseFinalizeResponse(responseText: string): {
  finalPrompt: string;
  metadata: {
    duration: string;
    aspectRatio: string;
    style: string;
    recommendedSettings: {
      fps: number;
      resolution: string;
    };
  };
} {
  try {
    // Extract JSON from response
    let jsonStr = responseText;

    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonStr = jsonObjectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    return {
      finalPrompt: parsed.finalPrompt || "A cinematic video with professional quality.",
      metadata: parsed.metadata || {
        duration: "8s",
        aspectRatio: "9:16",
        style: "cinematic",
        recommendedSettings: {
          fps: 24,
          resolution: "1080p",
        },
      },
    };
  } catch (error) {
    console.error("Failed to parse finalize response:", error);
    console.error("Response text:", responseText.slice(0, 500));

    // Return fallback
    return {
      finalPrompt:
        "A cinematic video showcasing the product with smooth camera movements, professional lighting, and high production quality. The scene opens with a dramatic reveal, transitioning through elegant angles that highlight key details. Shot in vertical format optimized for TikTok and Instagram Reels.",
      metadata: {
        duration: "8s",
        aspectRatio: "9:16",
        style: "cinematic",
        recommendedSettings: {
          fps: 24,
          resolution: "1080p",
        },
      },
    };
  }
}

// ============================================================================
// Stash Handlers - Save and Retrieve Analysis Results
// ============================================================================

// Default user ID for stash operations (in production, get from auth)
const DEFAULT_USER_ID = "system";

async function handleStash(request: StashRequest): Promise<NextResponse> {
  const {
    name,
    images,
    context,
    variations,
    imageAnalysis,
    analysisPromptUsed,
    finalizePromptUsed,
    selectedVariationId,
    veo3Prompt,
    finalMetadata,
    tags,
    campaignId,
  } = request;

  if (!name || name.trim() === "") {
    return NextResponse.json(
      { success: false, error: "Name is required for stashing" },
      { status: 400 }
    );
  }

  if (!variations || variations.length === 0) {
    return NextResponse.json(
      { success: false, error: "Variations are required for stashing" },
      { status: 400 }
    );
  }

  try {
    console.log(`[STASH] Saving analysis: ${name}`);

    // Clean images - remove base64 data to save space (keep only URLs)
    const cleanedImages = images.map((img) => ({
      url: img.url,
      type: img.type,
      name: img.name,
    }));

    const stashed = await prisma.stashedPromptAnalysis.create({
      data: {
        name: name.trim(),
        campaignId: campaignId || null,
        context: context as object,
        images: cleanedImages,
        variations: variations as object[],
        imageAnalysis: imageAnalysis as object,
        analysisPromptUsed: analysisPromptUsed || null,
        finalizePromptUsed: finalizePromptUsed || null,
        selectedVariationId: selectedVariationId || null,
        veo3Prompt: veo3Prompt || null,
        finalMetadata: finalMetadata ? (finalMetadata as object) : null,
        tags: tags || [],
        createdBy: DEFAULT_USER_ID,
      },
    });

    console.log(`[STASH] Saved successfully: ${stashed.id}`);

    return NextResponse.json({
      success: true,
      id: stashed.id,
      name: stashed.name,
      createdAt: stashed.createdAt,
    });
  } catch (error) {
    console.error("[STASH] Error saving:", error);
    throw error;
  }
}

async function handleListStash(request: ListStashRequest): Promise<NextResponse> {
  const {
    campaignId,
    tags,
    favoritesOnly,
    page = 0,
    pageSize = 20,
  } = request;

  try {
    console.log(`[STASH] Listing stashed analyses`);

    // Build where clause
    const where: {
      campaignId?: string;
      tags?: { hasSome: string[] };
      isFavorite?: boolean;
    } = {};

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (favoritesOnly) {
      where.isFavorite = true;
    }

    // Get total count
    const total = await prisma.stashedPromptAnalysis.count({ where });

    // Get paginated results
    const items = await prisma.stashedPromptAnalysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        campaignId: true,
        context: true,
        images: true,
        variations: true,
        imageAnalysis: true,
        analysisPromptUsed: true,
        finalizePromptUsed: true,
        selectedVariationId: true,
        veo3Prompt: true,
        finalMetadata: true,
        tags: true,
        isFavorite: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`[STASH] Found ${items.length} of ${total} total`);

    return NextResponse.json({
      success: true,
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[STASH] Error listing:", error);
    throw error;
  }
}

async function handleGetStash(request: GetStashRequest): Promise<NextResponse> {
  const { id } = request;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID is required" },
      { status: 400 }
    );
  }

  try {
    console.log(`[STASH] Getting stash: ${id}`);

    const item = await prisma.stashedPromptAnalysis.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Stashed analysis not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error("[STASH] Error getting:", error);
    throw error;
  }
}

async function handleDeleteStash(request: DeleteStashRequest): Promise<NextResponse> {
  const { id } = request;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID is required" },
      { status: 400 }
    );
  }

  try {
    console.log(`[STASH] Deleting stash: ${id}`);

    await prisma.stashedPromptAnalysis.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Stashed analysis deleted",
    });
  } catch (error) {
    console.error("[STASH] Error deleting:", error);
    throw error;
  }
}

async function handleUpdateStash(request: UpdateStashRequest): Promise<NextResponse> {
  const {
    id,
    name,
    tags,
    isFavorite,
    analysisPromptUsed,
    finalizePromptUsed,
    selectedVariationId,
    veo3Prompt,
    finalMetadata
  } = request;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID is required" },
      { status: 400 }
    );
  }

  try {
    console.log(`[STASH] Updating stash: ${id}`);

    // Build update data
    const updateData: {
      name?: string;
      tags?: string[];
      isFavorite?: boolean;
      analysisPromptUsed?: string;
      finalizePromptUsed?: string;
      selectedVariationId?: string;
      veo3Prompt?: string;
      finalMetadata?: object;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (tags !== undefined) updateData.tags = tags;
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    if (analysisPromptUsed !== undefined) updateData.analysisPromptUsed = analysisPromptUsed;
    if (finalizePromptUsed !== undefined) updateData.finalizePromptUsed = finalizePromptUsed;
    if (selectedVariationId !== undefined) updateData.selectedVariationId = selectedVariationId;
    if (veo3Prompt !== undefined) updateData.veo3Prompt = veo3Prompt;
    if (finalMetadata !== undefined) updateData.finalMetadata = finalMetadata as object;

    const updated = await prisma.stashedPromptAnalysis.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      item: updated,
    });
  } catch (error) {
    console.error("[STASH] Error updating:", error);
    throw error;
  }
}

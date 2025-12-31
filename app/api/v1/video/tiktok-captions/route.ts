import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/db/prisma";

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

/**
 * POST /api/v1/video/tiktok-captions
 * Generate TikTok-style short-form captions from lyrics + video context
 *
 * Request body:
 * - lyrics: string - Full lyrics text
 * - language?: 'ko' | 'en' - Language of the lyrics (default: 'ko')
 * - videoDuration?: number - Video duration in seconds (default: 15)
 * - generationId?: string - Generation ID to look up video prompt and campaign info
 * - videoPrompt?: string - (Optional) The prompt used to generate the video (for context)
 * - campaignName?: string - (Optional) Campaign name for context
 * - artistName?: string - (Optional) Artist name for context
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    let {
      lyrics,
      language = "ko",
      videoDuration = 15,
      generationId,
      videoPrompt,
      campaignName,
      artistName,
    } = body;

    // If generationId is provided, look up video prompt and campaign info
    if (generationId && (!videoPrompt || !campaignName)) {
      try {
        const generation = await prisma.videoGeneration.findUnique({
          where: { id: generationId },
          include: {
            campaign: {
              include: {
                artist: true,
              },
            },
          },
        });

        if (generation) {
          // Get video prompt directly from generation (VideoGeneration has prompt field)
          if (!videoPrompt && generation.prompt) {
            videoPrompt = generation.prompt;
          }
          // Get campaign and artist names
          if (!campaignName && generation.campaign?.name) {
            campaignName = generation.campaign.name;
          }
          if (!artistName && generation.campaign?.artist?.name) {
            artistName = generation.campaign.artist.name;
          }
        }
      } catch (err) {
        console.warn("[tiktok-captions] Failed to fetch generation info:", err);
        // Continue without the extra context
      }
    }

    if (!lyrics || typeof lyrics !== "string" || !lyrics.trim()) {
      return NextResponse.json(
        { detail: "lyrics is required" },
        { status: 400 }
      );
    }

    // Caption length limits - short and impactful
    const maxCaptionLength = language === "ko" ? 12 : 30;

    // Build context section
    const contextParts: string[] = [];
    if (videoPrompt) contextParts.push(`영상 콘셉트: ${videoPrompt}`);
    if (campaignName) contextParts.push(`캠페인: ${campaignName}`);
    if (artistName) contextParts.push(`아티스트: ${artistName}`);
    const contextSection = contextParts.length > 0
      ? `\n\n## 영상 컨텍스트\n${contextParts.join('\n')}`
      : '';

    const systemPrompt = language === "ko"
      ? `당신은 틱톡/릴스 감성 자막 전문가입니다.
가사 전체를 요약하지 말고, 가장 강렬하고 감동적인 핵심 순간만 선택하세요.

## 핵심 원칙
1. 전체 가사를 다 쓰지 말고, 마음을 울리는 2-5개 구절만 선택
2. 각 자막은 ${maxCaptionLength}자 이내 (짧을수록 좋음, 5-10자 권장)
3. 한 호흡에 읽히는 짧고 강렬한 문구
4. 후렴구의 핵심, 감정의 절정 순간에 집중
5. 이모지 사용 금지
6. 침묵도 연출의 일부 - 매 순간 자막이 필요하지 않음

## 선택 기준 (중요도 순)
- 가슴을 울리는 감성적 구절
- 기억에 남는 강렬한 한마디
- 영상 분위기와 어울리는 핵심 메시지
- 틱톡에서 공유하고 싶어지는 문구${contextSection}

## 출력 형식
각 자막을 한 줄에 하나씩 출력. 번호나 다른 포맷 없이 텍스트만.`
      : `You are a TikTok/Reels emotional caption specialist.
Do NOT summarize the entire lyrics. Select only the most powerful, moving moments.

## Core Principles
1. Pick only 2-5 phrases that touch the heart - NOT the entire lyrics
2. Each caption under ${maxCaptionLength} characters (shorter is better, 15-25 ideal)
3. Short, punchy lines that can be read in one breath
4. Focus on chorus highlights and emotional peaks
5. No emojis
6. Silence is part of the art - not every moment needs a caption

## Selection Criteria (by priority)
- Emotionally resonant phrases
- Memorable, impactful one-liners
- Key messages matching the video mood
- Lines people would want to share${contextSection ? `\n\n## Video Context\n${contextParts.join('\n')}` : ''}

## Output format
One caption per line. Text only, no numbers or formatting.`;

    const userPrompt = language === "ko"
      ? `다음 가사에서 가장 감동적인 핵심 구절만 골라주세요:

## 가사
${lyrics}

## 영상 정보
- 영상 길이: ${videoDuration}초
- 자막 최대 길이: ${maxCaptionLength}자
- 개수는 정해져 있지 않음 (2-5개, 감성에 따라 유동적으로)`
      : `Select only the most emotionally impactful phrases from these lyrics:

## Lyrics
${lyrics}

## Video Info
- Video duration: ${videoDuration} seconds
- Max caption length: ${maxCaptionLength} characters
- No fixed count (2-5, flexible based on emotional content)`;

    const model = genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const response = await model;
    const text = response.text?.trim() || "";

    if (!text) {
      return NextResponse.json(
        { detail: "Failed to generate captions" },
        { status: 500 }
      );
    }

    // Parse the response into individual captions
    const captions = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.match(/^[\d\-\*\.]+\s*/)); // Remove numbering if present

    // Clean up any remaining formatting
    const cleanedCaptions = captions.map((caption) =>
      caption.replace(/^[\d\-\*\.]+\s*/, "").trim()
    );

    // Generate timing info - evenly distribute captions across video duration
    // Use actual caption count (may differ from optimalCaptionCount)
    const actualSegmentDuration = videoDuration / cleanedCaptions.length;
    const segments = cleanedCaptions.map((text, idx) => ({
      text,
      start: idx * actualSegmentDuration,
      end: (idx + 1) * actualSegmentDuration,
    }));

    return NextResponse.json({
      captions: cleanedCaptions,
      segments, // Pre-synced timing info (evenly distributed)
      language,
      videoDuration,
      metadata: {
        captionCount: cleanedCaptions.length,
        avgCaptionLength: Math.round(
          cleanedCaptions.reduce((sum, c) => sum + c.length, 0) / cleanedCaptions.length
        ),
        maxCaptionLength,
        segmentDuration: Math.round(actualSegmentDuration * 10) / 10,
        approach: "emotional-selection", // Flexible caption count based on lyric content
      },
    });
  } catch (error) {
    console.error("TikTok caption generation error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

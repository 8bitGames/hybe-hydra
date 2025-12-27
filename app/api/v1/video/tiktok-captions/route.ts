import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

/**
 * POST /api/v1/video/tiktok-captions
 * Generate TikTok-style short-form captions from lyrics
 *
 * Request body:
 * - lyrics: string - Full lyrics text
 * - language?: 'ko' | 'en' - Language of the lyrics (default: 'ko')
 * - videoDuration?: number - Video duration in seconds (default: 15)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { lyrics, language = "ko", videoDuration = 15 } = body;

    if (!lyrics || typeof lyrics !== "string" || !lyrics.trim()) {
      return NextResponse.json(
        { detail: "lyrics is required" },
        { status: 400 }
      );
    }

    // Calculate optimal number of captions based on video duration
    // Typically 2-4 seconds per caption for readability
    const optimalCaptionCount = Math.max(3, Math.min(8, Math.ceil(videoDuration / 3)));

    const systemPrompt = language === "ko"
      ? `당신은 틱톡/릴스 숏폼 영상 전문 카피라이터입니다.
주어진 가사를 기반으로 짧고 임팩트 있는 자막 텍스트를 생성하세요.

규칙:
1. 각 자막은 1-2줄, 최대 15자 이내로 작성
2. 감정을 자극하는 핵심 가사나 후렴구 위주로 선별
3. 틱톡에서 주목을 끌 수 있는 임팩트 있는 문구로 변환
4. 원래 가사의 감성과 메시지를 유지하면서도 더 강렬하게 표현
5. 이모지는 사용하지 않음
6. 정확히 ${optimalCaptionCount}개의 자막을 생성

출력 형식:
각 자막을 한 줄에 하나씩 출력하세요. 번호나 다른 포맷 없이 텍스트만 출력하세요.`
      : `You are a professional TikTok/Reels short-form video copywriter.
Generate short, impactful caption texts based on the given lyrics.

Rules:
1. Each caption should be 1-2 lines, maximum 30 characters
2. Focus on emotional core lyrics or chorus sections
3. Transform into attention-grabbing phrases for TikTok
4. Maintain the original emotion and message while making it more powerful
5. Do not use emojis
6. Generate exactly ${optimalCaptionCount} captions

Output format:
Output each caption on a separate line. Only text, no numbers or other formatting.`;

    const userPrompt = language === "ko"
      ? `다음 가사를 기반으로 틱톡 숏폼 영상용 자막을 생성하세요:

가사:
${lyrics}

영상 길이: ${videoDuration}초
필요한 자막 개수: ${optimalCaptionCount}개`
      : `Generate TikTok short-form video captions based on these lyrics:

Lyrics:
${lyrics}

Video duration: ${videoDuration} seconds
Required caption count: ${optimalCaptionCount}`;

    const model = genAI.models.generateContent({
      model: "gemini-2.0-flash",
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

    return NextResponse.json({
      captions: cleanedCaptions,
      language,
      videoDuration,
      metadata: {
        captionCount: cleanedCaptions.length,
        avgCaptionLength: Math.round(
          cleanedCaptions.reduce((sum, c) => sum + c.length, 0) / cleanedCaptions.length
        ),
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

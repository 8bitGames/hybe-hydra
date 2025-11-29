import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";

interface ScrapedData {
  url: string;
  platform: "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "UNKNOWN";
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  author: string | null;
  author_url: string | null;
  view_count: string | null;
  like_count: string | null;
  embed_html: string | null;
  hashtags: string[];
  metadata: Record<string, unknown>;
}

// Detect platform from URL
function detectPlatform(url: string): ScrapedData["platform"] {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YOUTUBE";
  if (url.includes("tiktok.com")) return "TIKTOK";
  if (url.includes("instagram.com")) return "INSTAGRAM";
  return "UNKNOWN";
}

// Extract hashtags from text
function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w가-힣]+/g);
  return matches ? [...new Set(matches)] : [];
}

// Scrape YouTube using oEmbed
async function scrapeYouTube(url: string): Promise<Partial<ScrapedData>> {
  try {
    // Use oEmbed API
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const oembedRes = await fetch(oembedUrl);

    if (!oembedRes.ok) {
      throw new Error("YouTube oEmbed failed");
    }

    const oembed = await oembedRes.json();

    // Extract video ID for thumbnail
    let videoId = "";
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (match) videoId = match[1];

    return {
      title: oembed.title,
      author: oembed.author_name,
      author_url: oembed.author_url,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : oembed.thumbnail_url,
      embed_html: oembed.html,
      hashtags: extractHashtags(oembed.title || ""),
      metadata: {
        provider: oembed.provider_name,
        width: oembed.width,
        height: oembed.height,
        video_id: videoId,
      },
    };
  } catch (error) {
    console.error("YouTube scrape error:", error);
    return {};
  }
}

// Scrape TikTok - enhanced with direct page scraping
async function scrapeTikTok(url: string): Promise<Partial<ScrapedData>> {
  try {
    // First try direct page scraping for more detailed data
    const pageData = await scrapeTikTokPage(url);
    if (pageData && pageData.title) {
      return pageData;
    }

    // Fallback to oEmbed
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const oembedRes = await fetch(oembedUrl);

    if (!oembedRes.ok) {
      throw new Error("TikTok oEmbed failed");
    }

    const oembed = await oembedRes.json();

    return {
      title: oembed.title,
      author: oembed.author_name,
      author_url: oembed.author_url,
      thumbnail: oembed.thumbnail_url,
      embed_html: oembed.html,
      hashtags: extractHashtags(oembed.title || ""),
      metadata: {
        provider: oembed.provider_name,
        width: oembed.thumbnail_width,
        height: oembed.thumbnail_height,
      },
    };
  } catch (error) {
    console.error("TikTok scrape error:", error);
    return {};
  }
}

// Direct TikTok page scraping for detailed video info
async function scrapeTikTokPage(url: string): Promise<Partial<ScrapedData> | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Try to extract JSON-LD data (structured data)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd["@type"] === "VideoObject") {
          return {
            title: jsonLd.name || jsonLd.description,
            description: jsonLd.description,
            thumbnail: jsonLd.thumbnailUrl?.[0] || jsonLd.thumbnailUrl,
            author: jsonLd.creator?.name,
            author_url: jsonLd.creator?.url,
            view_count: jsonLd.interactionStatistic?.find((s: { interactionType?: string }) =>
              s.interactionType === "http://schema.org/WatchAction"
            )?.userInteractionCount?.toString() || null,
            like_count: jsonLd.interactionStatistic?.find((s: { interactionType?: string }) =>
              s.interactionType === "http://schema.org/LikeAction"
            )?.userInteractionCount?.toString() || null,
            hashtags: extractHashtags(jsonLd.description || ""),
            metadata: {
              duration: jsonLd.duration,
              upload_date: jsonLd.uploadDate,
              content_url: jsonLd.contentUrl,
              embed_url: jsonLd.embedUrl,
              music: null,
            },
          };
        }
      } catch (e) {
        console.error("JSON-LD parse error:", e);
      }
    }

    // Try to extract from SIGI_STATE (TikTok's hydration data)
    const sigiMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/);
    if (sigiMatch) {
      try {
        const sigiData = JSON.parse(sigiMatch[1]);
        const defaultScope = sigiData["__DEFAULT_SCOPE__"];
        const videoDetail = defaultScope?.["webapp.video-detail"]?.itemInfo?.itemStruct;

        if (videoDetail) {
          const stats = videoDetail.stats || {};
          const author = videoDetail.author || {};
          const music = videoDetail.music || {};

          return {
            title: videoDetail.desc,
            description: videoDetail.desc,
            thumbnail: videoDetail.video?.cover || videoDetail.video?.dynamicCover,
            author: author.nickname || author.uniqueId,
            author_url: `https://www.tiktok.com/@${author.uniqueId}`,
            view_count: stats.playCount?.toString() || null,
            like_count: stats.diggCount?.toString() || null,
            hashtags: extractHashtags(videoDetail.desc || ""),
            metadata: {
              video_id: videoDetail.id,
              duration: videoDetail.video?.duration,
              create_time: videoDetail.createTime,
              share_count: stats.shareCount,
              comment_count: stats.commentCount,
              music: {
                title: music.title,
                author: music.authorName,
                cover: music.coverLarge || music.coverMedium,
                duration: music.duration,
              },
              author_info: {
                id: author.id,
                unique_id: author.uniqueId,
                nickname: author.nickname,
                avatar: author.avatarLarger || author.avatarMedium,
                verified: author.verified,
                follower_count: author.followerCount,
              },
            },
          };
        }
      } catch (e) {
        console.error("SIGI_STATE parse error:", e);
      }
    }

    // Fallback: try Open Graph meta tags
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

    if (titleMatch || descMatch) {
      return {
        title: titleMatch?.[1] || null,
        description: descMatch?.[1] || null,
        thumbnail: imageMatch?.[1] || null,
        hashtags: extractHashtags((titleMatch?.[1] || "") + " " + (descMatch?.[1] || "")),
      };
    }

    return null;
  } catch (error) {
    console.error("TikTok page scrape error:", error);
    return null;
  }
}

// Scrape Instagram (limited - oEmbed deprecated)
async function scrapeInstagram(url: string): Promise<Partial<ScrapedData>> {
  try {
    // Instagram oEmbed requires access token now, so we'll try basic metadata
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = await response.text();

    // Extract Open Graph metadata
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

    const title = titleMatch ? titleMatch[1] : null;
    const description = descMatch ? descMatch[1] : null;

    return {
      title,
      description,
      thumbnail: imageMatch ? imageMatch[1] : null,
      hashtags: extractHashtags((title || "") + " " + (description || "")),
      metadata: {
        source: "og_meta",
      },
    };
  } catch (error) {
    console.error("Instagram scrape error:", error);
    return {};
  }
}

// Generic scrape using Open Graph
async function scrapeGeneric(url: string): Promise<Partial<ScrapedData>> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = await response.text();

    // Extract metadata
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                       html.match(/<title>([^<]+)<\/title>/);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/) ||
                      html.match(/<meta name="description" content="([^"]+)"/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

    return {
      title: titleMatch ? titleMatch[1] : null,
      description: descMatch ? descMatch[1] : null,
      thumbnail: imageMatch ? imageMatch[1] : null,
      hashtags: [],
    };
  } catch (error) {
    console.error("Generic scrape error:", error);
    return {};
  }
}

// POST /api/v1/scrape - Scrape URL for content data
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { detail: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { detail: "Invalid URL format" },
        { status: 400 }
      );
    }

    const platform = detectPlatform(url);

    let scrapedData: Partial<ScrapedData> = {};

    switch (platform) {
      case "YOUTUBE":
        scrapedData = await scrapeYouTube(url);
        break;
      case "TIKTOK":
        scrapedData = await scrapeTikTok(url);
        break;
      case "INSTAGRAM":
        scrapedData = await scrapeInstagram(url);
        break;
      default:
        scrapedData = await scrapeGeneric(url);
    }

    const result: ScrapedData = {
      url,
      platform,
      title: scrapedData.title || null,
      description: scrapedData.description || null,
      thumbnail: scrapedData.thumbnail || null,
      author: scrapedData.author || null,
      author_url: scrapedData.author_url || null,
      view_count: scrapedData.view_count || null,
      like_count: scrapedData.like_count || null,
      embed_html: scrapedData.embed_html || null,
      hashtags: scrapedData.hashtags || [],
      metadata: scrapedData.metadata || {},
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { detail: "Failed to scrape URL" },
      { status: 500 }
    );
  }
}

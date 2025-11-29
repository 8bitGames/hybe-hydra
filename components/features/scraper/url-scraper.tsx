"use client";

import { useState } from "react";
import { scrapeApi, ScrapedData, getPlatformDisplayName, getScrapePlatformColor } from "@/lib/scrape-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Link2, Search, ExternalLink, Hash, User, X, Plus, Check, Eye, Heart, Music, Clock, MessageCircle, Share2 } from "lucide-react";

interface UrlScraperProps {
  onDataScraped?: (data: ScrapedData) => void;
  onHashtagSelect?: (hashtag: string) => void;
  selectedHashtags?: string[];
  compact?: boolean;
}

// Format large numbers
function formatCount(count: string | null): string {
  if (!count) return "-";
  const num = parseInt(count, 10);
  if (isNaN(num)) return count;
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Get TikTok metadata safely
function getTikTokMetadata(metadata: Record<string, unknown>) {
  return {
    music: metadata.music as { title?: string; author?: string; cover?: string; duration?: number } | null,
    duration: metadata.duration as number | null,
    shareCount: metadata.share_count as number | null,
    commentCount: metadata.comment_count as number | null,
    authorInfo: metadata.author_info as { nickname?: string; verified?: boolean; follower_count?: number } | null,
  };
}

export function UrlScraper({
  onDataScraped,
  onHashtagSelect,
  selectedHashtags = [],
  compact = false,
}: UrlScraperProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapedData | null>(null);
  const [error, setError] = useState("");

  const handleScrape = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await scrapeApi.scrape(url.trim());
      if (response.error) {
        setError(response.error.message || "Failed to scrape URL");
      } else if (response.data) {
        setResult(response.data);
        onDataScraped?.(response.data);
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleScrape();
    }
  };

  const handleClear = () => {
    setUrl("");
    setResult(null);
    setError("");
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="YouTube, TikTok, Instagram URL..."
              className="pl-9 pr-8"
            />
            {url && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={handleScrape} disabled={loading || !url.trim()} size="icon">
            {loading ? <Spinner className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Result */}
        {result && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-start gap-3">
              {result.thumbnail && (
                <img
                  src={result.thumbnail}
                  alt=""
                  className="w-16 h-16 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    style={{ backgroundColor: getScrapePlatformColor(result.platform) }}
                    className="text-white text-[10px]"
                  >
                    {getPlatformDisplayName(result.platform)}
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate">{result.title || "No title"}</p>
                {result.author && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {result.author}
                  </p>
                )}
              </div>
            </div>

            {/* Video Stats */}
            {(result.view_count || result.like_count) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {result.view_count && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {formatCount(result.view_count)}
                  </span>
                )}
                {result.like_count && (
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {formatCount(result.like_count)}
                  </span>
                )}
                {result.platform === "TIKTOK" && result.metadata && (
                  <>
                    {getTikTokMetadata(result.metadata).commentCount && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {formatCount(getTikTokMetadata(result.metadata).commentCount?.toString() || null)}
                      </span>
                    )}
                    {getTikTokMetadata(result.metadata).shareCount && (
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        {formatCount(getTikTokMetadata(result.metadata).shareCount?.toString() || null)}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TikTok Music Info */}
            {result.platform === "TIKTOK" && result.metadata && getTikTokMetadata(result.metadata).music?.title && (
              <div className="flex items-center gap-2 p-2 rounded bg-muted text-xs">
                <Music className="w-3 h-3 text-muted-foreground" />
                <span className="truncate">
                  {getTikTokMetadata(result.metadata).music?.title}
                  {getTikTokMetadata(result.metadata).music?.author && (
                    <span className="text-muted-foreground"> - {getTikTokMetadata(result.metadata).music?.author}</span>
                  )}
                </span>
              </div>
            )}

            {/* Hashtags */}
            {result.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.hashtags.slice(0, 10).map((tag) => {
                  const isSelected = selectedHashtags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => onHashtagSelect?.(tag)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      <Hash className="w-3 h-3" />
                      {tag.replace("#", "")}
                      {isSelected ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          URL Scraper
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube, TikTok, or Instagram URL..."
              className="pr-8"
            />
            {url && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={handleScrape} disabled={loading || !url.trim()}>
            {loading ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Scraping...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Scrape
              </>
            )}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-lg border overflow-hidden">
            {/* Header with thumbnail */}
            <div className="flex gap-4 p-4 bg-muted/30">
              {result.thumbnail && (
                <img
                  src={result.thumbnail}
                  alt=""
                  className="w-32 h-20 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    style={{ backgroundColor: getScrapePlatformColor(result.platform) }}
                    className="text-white"
                  >
                    {getPlatformDisplayName(result.platform)}
                  </Badge>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <h3 className="font-semibold text-foreground line-clamp-2">
                  {result.title || "No title"}
                </h3>
                {result.author && (
                  <a
                    href={result.author_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                  >
                    <User className="w-3 h-3" />
                    {result.author}
                  </a>
                )}
              </div>
            </div>

            {/* Video Stats */}
            {(result.view_count || result.like_count || (result.platform === "TIKTOK" && result.metadata)) && (
              <div className="p-4 border-t">
                <p className="text-sm font-medium mb-2">통계</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {result.view_count && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">{formatCount(result.view_count)}</p>
                        <p className="text-[10px] text-muted-foreground">조회수</p>
                      </div>
                    </div>
                  )}
                  {result.like_count && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Heart className="w-4 h-4 text-red-500" />
                      <div>
                        <p className="text-sm font-semibold">{formatCount(result.like_count)}</p>
                        <p className="text-[10px] text-muted-foreground">좋아요</p>
                      </div>
                    </div>
                  )}
                  {result.platform === "TIKTOK" && result.metadata && getTikTokMetadata(result.metadata).commentCount && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <MessageCircle className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-semibold">{formatCount(getTikTokMetadata(result.metadata).commentCount?.toString() || null)}</p>
                        <p className="text-[10px] text-muted-foreground">댓글</p>
                      </div>
                    </div>
                  )}
                  {result.platform === "TIKTOK" && result.metadata && getTikTokMetadata(result.metadata).shareCount && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Share2 className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-sm font-semibold">{formatCount(getTikTokMetadata(result.metadata).shareCount?.toString() || null)}</p>
                        <p className="text-[10px] text-muted-foreground">공유</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TikTok Music Info */}
            {result.platform === "TIKTOK" && result.metadata && getTikTokMetadata(result.metadata).music?.title && (
              <div className="p-4 border-t">
                <p className="text-sm font-medium mb-2">사용된 음악</p>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  {getTikTokMetadata(result.metadata).music?.cover && (
                    <img
                      src={getTikTokMetadata(result.metadata).music?.cover}
                      alt=""
                      className="w-10 h-10 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getTikTokMetadata(result.metadata).music?.title}
                    </p>
                    {getTikTokMetadata(result.metadata).music?.author && (
                      <p className="text-xs text-muted-foreground truncate">
                        {getTikTokMetadata(result.metadata).music?.author}
                      </p>
                    )}
                  </div>
                  <Music className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Hashtags */}
            {result.hashtags.length > 0 && (
              <div className="p-4 border-t">
                <p className="text-sm font-medium mb-2">Hashtags</p>
                <div className="flex flex-wrap gap-2">
                  {result.hashtags.map((tag) => {
                    const isSelected = selectedHashtags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => onHashtagSelect?.(tag)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                      >
                        <Hash className="w-3.5 h-3.5" />
                        {tag.replace("#", "")}
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 ml-1" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {result.description && (
              <div className="p-4 border-t">
                <p className="text-sm font-medium mb-2">Description</p>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {result.description}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

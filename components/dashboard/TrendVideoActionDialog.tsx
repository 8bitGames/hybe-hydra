"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  Images,
  ExternalLink,
  Hash,
  Copy,
  Check,
  TrendingUp,
  Zap,
  Bot,
  Lightbulb,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn, sanitizeUsername, sanitizeText, getProxiedImageUrl } from "@/lib/utils";
import {
  TrendVideoContext,
  storeTrendContext,
  generatePromptFromContext,
  getSuggestedHashtags,
} from "@/lib/trend-context";

interface TrendVideoActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: TrendVideoContext | null;
}

function formatCount(num: number | null | undefined): string {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return `${num.toFixed(2)}%`;
}

export function TrendVideoActionDialog({
  open,
  onOpenChange,
  context,
}: TrendVideoActionDialogProps) {
  const router = useRouter();
  const { language } = useI18n();
  const [copiedHashtags, setCopiedHashtags] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const handleGenerateAI = useCallback(() => {
    if (!context) return;

    // Store context for Create page to use
    storeTrendContext(context);

    // Navigate to Create page in generate mode with trend context flag
    router.push("/create?mode=generate&from_trend=true");
    onOpenChange(false);
  }, [context, router, onOpenChange]);

  const handleCompose = useCallback(() => {
    if (!context) return;

    // Store context for Create page to use
    storeTrendContext(context);

    // Navigate to Create page in compose mode with trend context flag
    router.push("/create?mode=compose&from_trend=true");
    onOpenChange(false);
  }, [context, router, onOpenChange]);

  const handleViewOriginal = useCallback(() => {
    if (!context) return;
    window.open(context.video.url, "_blank");
  }, [context]);

  const handleCopyHashtags = useCallback(async () => {
    if (!context) return;

    const hashtags = getSuggestedHashtags(context)
      .map((tag) => `#${tag}`)
      .join(" ");

    try {
      await navigator.clipboard.writeText(hashtags);
      setCopiedHashtags(true);
      setTimeout(() => setCopiedHashtags(false), 2000);
    } catch (e) {
      console.error("Failed to copy hashtags:", e);
    }
  }, [context]);

  const handleCopyCaption = useCallback(async () => {
    if (!context?.aiInsights?.captionTemplates?.[0]) return;

    try {
      await navigator.clipboard.writeText(context.aiInsights.captionTemplates[0]);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } catch (e) {
      console.error("Failed to copy caption:", e);
    }
  }, [context]);

  if (!context) return null;

  const suggestedHashtags = getSuggestedHashtags(context);
  const suggestedPrompt = generatePromptFromContext(context);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            {language === "ko" ? "트렌드 비디오 활용하기" : "Use Trending Video"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <div className="px-6 pb-6 space-y-6">
            {/* Video Preview Section */}
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="relative w-28 flex-shrink-0">
                <div className="aspect-[9/16] rounded-lg overflow-hidden bg-muted">
                  {context.video.thumbnailUrl && (
                    <img
                      src={getProxiedImageUrl(context.video.thumbnailUrl) || ""}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>

              {/* Video Info */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="font-medium">@{sanitizeUsername(context.video.authorName)}</p>
                  {context.keyword && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      #{context.keyword}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                  {sanitizeText(context.video.description) || (language === "ko" ? "설명 없음" : "No description")}
                </p>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span>{formatCount(context.stats.playCount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span>{formatCount(context.stats.likeCount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{formatCount(context.stats.commentCount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span>{formatPercent(context.stats.engagementRate)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-auto py-4 flex-col gap-2"
                onClick={handleGenerateAI}
              >
                <Sparkles className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">
                    {language === "ko" ? "AI 영상 생성" : "Generate AI Video"}
                  </div>
                  <div className="text-xs opacity-80">
                    {language === "ko" ? "Veo AI로 비슷한 스타일 영상" : "Create similar style with Veo AI"}
                  </div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="secondary"
                className="h-auto py-4 flex-col gap-2"
                onClick={handleCompose}
              >
                <Images className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">
                    {language === "ko" ? "컴포즈 영상" : "Compose Video"}
                  </div>
                  <div className="text-xs opacity-80">
                    {language === "ko" ? "이미지+음악으로 슬라이드쇼" : "Slideshow with images + music"}
                  </div>
                </div>
              </Button>
            </div>

            {/* Suggested Prompt */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                {language === "ko" ? "추천 프롬프트" : "Suggested Prompt"}
              </h4>
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                {suggestedPrompt}
              </div>
            </div>

            {/* Hashtags */}
            {suggestedHashtags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    {language === "ko" ? "추천 해시태그" : "Suggested Hashtags"}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleCopyHashtags}
                  >
                    {copiedHashtags ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        {language === "ko" ? "복사됨" : "Copied"}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        {language === "ko" ? "복사" : "Copy"}
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedHashtags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights (if available) */}
            {context.aiInsights && (
              <div className="space-y-3 pt-3 border-t">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                  {language === "ko" ? "AI 인사이트" : "AI Insights"}
                </h4>

                {/* Summary */}
                <p className="text-sm text-muted-foreground">
                  {context.aiInsights.summary}
                </p>

                {/* Caption Template */}
                {context.aiInsights.captionTemplates?.[0] && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {language === "ko" ? "캡션 템플릿" : "Caption Template"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={handleCopyCaption}
                      >
                        {copiedCaption ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-xs italic">
                      &quot;{context.aiInsights.captionTemplates[0]}&quot;
                    </div>
                  </div>
                )}

                {/* Video Idea */}
                {context.aiInsights.videoIdeas?.[0] && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {language === "ko" ? "비디오 아이디어" : "Video Idea"}
                    </span>
                    <div className="flex items-start gap-2 text-xs">
                      <Sparkles className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      {context.aiInsights.videoIdeas[0]}
                    </div>
                  </div>
                )}

                {/* Posting Advice */}
                {context.aiInsights.bestPostingAdvice && (
                  <div className="p-2 bg-muted/30 rounded text-xs">
                    <span className="font-medium">
                      {language === "ko" ? "포스팅 조언: " : "Posting Tip: "}
                    </span>
                    {context.aiInsights.bestPostingAdvice}
                  </div>
                )}
              </div>
            )}

            {/* View Original */}
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleViewOriginal}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {language === "ko" ? "TikTok에서 원본 보기" : "View Original on TikTok"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default TrendVideoActionDialog;

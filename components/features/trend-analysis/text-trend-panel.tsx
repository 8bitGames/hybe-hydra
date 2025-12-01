"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Hash,
  TrendingUp,
  MessageSquare,
  Heart,
  MessageCircle,
  Share2,
  Lightbulb,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { TextTrendAnalysisResponse } from "@/lib/trends-api";

interface TextTrendPanelProps {
  analysis: TextTrendAnalysisResponse["analysis"];
  cached?: boolean;
}

export function TextTrendPanel({ analysis, cached }: TextTrendPanelProps) {
  const [copiedTemplate, setCopiedTemplate] = useState<number | null>(null);

  const copyTemplate = (template: string, index: number) => {
    navigator.clipboard.writeText(template);
    setCopiedTemplate(index);
    setTimeout(() => setCopiedTemplate(null), 2000);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "text-green-500";
      case "negative":
        return "text-red-500";
      default:
        return "text-yellow-500";
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Text Trend Analysis
        </h3>
        {cached && (
          <Badge variant="outline" className="text-xs">
            Cached
          </Badge>
        )}
      </div>

      {/* Metrics Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Engagement Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{analysis.metrics.totalVideos}</p>
              <p className="text-xs text-muted-foreground">Videos Analyzed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold flex items-center justify-center gap-1">
                <Heart className="h-4 w-4 text-red-400" />
                {formatNumber(analysis.metrics.avgLikes)}
              </p>
              <p className="text-xs text-muted-foreground">Avg Likes</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold flex items-center justify-center gap-1">
                <MessageCircle className="h-4 w-4" />
                {formatNumber(analysis.metrics.avgComments)}
              </p>
              <p className="text-xs text-muted-foreground">Avg Comments</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold flex items-center justify-center gap-1">
                <Share2 className="h-4 w-4" />
                {formatNumber(analysis.metrics.avgShares)}
              </p>
              <p className="text-xs text-muted-foreground">Avg Shares</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sentiment */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
        <span className="text-sm text-muted-foreground">Overall Sentiment:</span>
        <Badge className={getSentimentColor(analysis.sentimentTrend)}>
          {analysis.sentimentTrend}
        </Badge>
      </div>

      {/* Top Hashtags */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Top Hashtags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analysis.topHashtags.slice(0, 10).map((hashtag, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium w-24 truncate">
                  #{hashtag.hashtag}
                </span>
                <Progress
                  value={(hashtag.count / (analysis.topHashtags[0]?.count || 1)) * 100}
                  className="flex-1 h-2"
                />
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {hashtag.count} uses
                </span>
                <span className="text-xs text-muted-foreground w-20 text-right">
                  <Heart className="h-3 w-3 inline mr-1" />
                  {formatNumber(hashtag.avgLikes)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hashtag Clusters */}
      {analysis.hashtagClusters && analysis.hashtagClusters.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Hashtag Clusters
            </CardTitle>
            <CardDescription>Thematic groupings of related hashtags</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.hashtagClusters.map((cluster, index) => (
                <div key={index} className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{cluster.theme}</span>
                    <Badge variant="outline" className="text-xs">
                      Popularity: {cluster.popularity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{cluster.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {cluster.hashtags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic Themes */}
      {analysis.topicThemes && analysis.topicThemes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Content Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.topicThemes.map((theme, index) => (
                <Badge key={index} variant="outline">
                  {theme}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Suggestions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Content Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tone Recommendation */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm font-medium text-blue-500 mb-1">Recommended Tone</p>
            <p className="text-sm">{analysis.contentSuggestions.toneRecommendation}</p>
          </div>

          {/* Caption Templates */}
          {analysis.contentSuggestions.captionTemplates &&
            analysis.contentSuggestions.captionTemplates.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Caption Templates</p>
                <div className="space-y-2">
                  {analysis.contentSuggestions.captionTemplates.map((template, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded bg-muted/30"
                    >
                      <p className="text-sm flex-1">{template}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyTemplate(template, index)}
                      >
                        {copiedTemplate === index ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Hashtag Strategy */}
          {analysis.contentSuggestions.hashtagStrategy && (
            <div>
              <p className="text-sm font-medium mb-2">Hashtag Strategy</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <p className="text-xs font-medium text-green-500 mb-1">Primary</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.contentSuggestions.hashtagStrategy.primary?.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <p className="text-xs font-medium text-yellow-500 mb-1">Secondary</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.contentSuggestions.hashtagStrategy.secondary?.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <p className="text-xs font-medium text-purple-500 mb-1">Niche</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.contentSuggestions.hashtagStrategy.niche?.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content Themes */}
          {analysis.contentSuggestions.contentThemes &&
            analysis.contentSuggestions.contentThemes.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Suggested Content Themes</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.contentSuggestions.contentThemes.map((theme, index) => (
                    <Badge key={index}>{theme}</Badge>
                  ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

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
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Lightbulb,
  Copy,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { TrendReportResponse } from "@/lib/trends-api";

interface RecommendationsPanelProps {
  report: TrendReportResponse["report"];
  cached?: boolean;
}

export function RecommendationsPanel({ report, cached }: RecommendationsPanelProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "rising":
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case "rising":
        return "text-green-500 bg-green-500/10";
      case "declining":
        return "text-red-500 bg-red-500/10";
      default:
        return "text-yellow-500 bg-yellow-500/10";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" />
          Content Strategy Report
        </h3>
        <div className="flex items-center gap-2">
          {cached && (
            <Badge variant="outline" className="text-xs">
              Cached
            </Badge>
          )}
          <Badge variant="secondary">{report.platform}</Badge>
        </div>
      </div>

      {/* Trend Score & Direction */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getTrendIcon(report.trendDirection)}
              <div>
                <p className="font-medium capitalize">{report.trendDirection} Trend</p>
                <p className="text-sm text-muted-foreground">
                  &quot;{report.searchQuery}&quot;
                </p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg ${getTrendColor(report.trendDirection)}`}>
              <p className="text-2xl font-bold">{report.trendScore}</p>
              <p className="text-xs">/ 100</p>
            </div>
          </div>
          <Progress value={report.trendScore} className="h-3" />
        </CardContent>
      </Card>

      {/* Combined Strategy */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-500" />
            Strategy Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{report.combinedStrategy.summary}</p>
        </CardContent>
      </Card>

      {/* Key Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Key Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {report.combinedStrategy.keyActions.map((action, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Best Practices & Avoid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-500">Best Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.combinedStrategy.bestPractices.map((practice, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{practice}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-500">Avoid</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.combinedStrategy.doNot.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Text Guide */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Caption & Hashtag Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Caption Style */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">Caption Style</p>
            <p className="text-sm">{report.textGuide.captionStyle}</p>
          </div>

          {/* Tone */}
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-xs font-medium text-purple-500 mb-1">Tone</p>
            <p className="text-sm">{report.textGuide.toneRecommendation}</p>
          </div>

          {/* Hashtags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Primary Hashtags
              </p>
              <div className="flex flex-wrap gap-1">
                {report.textGuide.hashtags.primary.map((tag, index) => (
                  <Badge key={index} variant="default" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Secondary Hashtags
              </p>
              <div className="flex flex-wrap gap-1">
                {report.textGuide.hashtags.secondary.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Content Themes */}
          {report.textGuide.contentThemes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Content Themes
              </p>
              <div className="flex flex-wrap gap-2">
                {report.textGuide.contentThemes.map((theme, index) => (
                  <Badge key={index} variant="secondary">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Guide */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Video Production Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual Style */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">Visual Style</p>
            <p className="text-sm">{report.videoGuide.visualStyle}</p>
          </div>

          {/* Mood & Pace */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-yellow-500/10">
              <p className="text-xs font-medium text-yellow-500 mb-1">Mood</p>
              <p className="text-sm font-medium capitalize">{report.videoGuide.mood}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10">
              <p className="text-xs font-medium text-blue-500 mb-1">Pace</p>
              <p className="text-sm font-medium capitalize">{report.videoGuide.pace}</p>
            </div>
          </div>

          {/* Technical Specs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold">
                {report.videoGuide.technicalSpecs.aspectRatio}
              </p>
              <p className="text-xs text-muted-foreground">Aspect Ratio</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold">
                {report.videoGuide.technicalSpecs.duration}s
              </p>
              <p className="text-xs text-muted-foreground">Duration</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-sm font-bold capitalize">
                {report.videoGuide.technicalSpecs.cameraStyle}
              </p>
              <p className="text-xs text-muted-foreground">Camera</p>
            </div>
          </div>

          {/* Effects */}
          {report.videoGuide.effects.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Recommended Effects
              </p>
              <div className="flex flex-wrap gap-2">
                {report.videoGuide.effects.map((effect, index) => (
                  <Badge
                    key={index}
                    variant="default"
                    className="bg-gradient-to-r from-purple-500 to-pink-500"
                  >
                    {effect}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Template */}
          {report.videoGuide.promptTemplate && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-green-500">Video Prompt</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => copyPrompt(report.videoGuide.promptTemplate)}
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm">{report.videoGuide.promptTemplate}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target Audience */}
      {report.targetAudience && report.targetAudience.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Target Audience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {report.targetAudience.map((audience, index) => (
                <Badge key={index} variant="outline">
                  {audience}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Posting Times */}
      {report.bestPostingTimes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Best Posting Times
            </CardTitle>
            <CardDescription>
              Timezone: {report.bestPostingTimes.timezone}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Times</p>
                <div className="flex flex-wrap gap-2">
                  {report.bestPostingTimes.times.map((time, index) => (
                    <Badge key={index} variant="secondary">
                      {time}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Days</p>
                <div className="flex flex-wrap gap-2">
                  {report.bestPostingTimes.days.map((day, index) => (
                    <Badge key={index} variant="outline">
                      {day}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

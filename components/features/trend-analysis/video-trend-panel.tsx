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
  Video,
  Camera,
  Palette,
  Sun,
  Sparkles,
  Zap,
  Copy,
  Check,
  Film,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { VideoTrendAnalysisResponse } from "@/lib/trends-api";

interface VideoTrendPanelProps {
  analysis: VideoTrendAnalysisResponse["analysis"];
  cached?: boolean;
}

export function VideoTrendPanel({ analysis, cached }: VideoTrendPanelProps) {
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);

  const copyPrompt = (template: string, index: number) => {
    navigator.clipboard.writeText(template);
    setCopiedPrompt(index);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const getMoodEmoji = (mood: string) => {
    const moods: Record<string, string> = {
      energetic: "lightning",
      calm: "zen",
      playful: "smile",
      dramatic: "theater",
      romantic: "heart",
      mysterious: "moon",
      upbeat: "music",
      nostalgic: "clock",
    };
    return moods[mood.toLowerCase()] || "sparkles";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Video className="h-5 w-5" />
          Video Trend Analysis
        </h3>
        <div className="flex items-center gap-2">
          {cached && (
            <Badge variant="outline" className="text-xs">
              Cached
            </Badge>
          )}
          <Badge variant="secondary">
            {analysis.videosAnalyzed} videos analyzed
          </Badge>
        </div>
      </div>

      {/* Trend Score */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Trend Score</span>
            <span className="text-lg font-bold">{analysis.trendScore}/100</span>
          </div>
          <Progress value={analysis.trendScore} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            Based on visual patterns, engagement, and content consistency
          </p>
        </CardContent>
      </Card>

      {/* Key Characteristics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Sparkles className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
            <p className="text-sm font-medium capitalize">{analysis.dominantMood}</p>
            <p className="text-xs text-muted-foreground">Dominant Mood</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Zap className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-sm font-medium capitalize">{analysis.averagePace}</p>
            <p className="text-xs text-muted-foreground">Average Pace</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Patterns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Visual Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dominant Styles */}
          {analysis.visualPatterns.dominantStyles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Dominant Styles
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.visualPatterns.dominantStyles.map((style, index) => (
                  <Badge key={index} variant="default">
                    {style}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Camera Movements */}
          {analysis.visualPatterns.cameraMovements.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Camera Movements
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.visualPatterns.cameraMovements.map((movement, index) => (
                  <Badge key={index} variant="outline">
                    {movement}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Lighting Patterns */}
          {analysis.visualPatterns.lightingPatterns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Sun className="h-3 w-3" />
                Lighting Patterns
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.visualPatterns.lightingPatterns.map((pattern, index) => (
                  <Badge key={index} variant="secondary">
                    {pattern}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Transition Styles */}
          {analysis.visualPatterns.transitionStyles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Film className="h-3 w-3" />
                Transition Styles
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.visualPatterns.transitionStyles.map((transition, index) => (
                  <Badge key={index} variant="secondary">
                    {transition}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Color Palettes */}
          {analysis.visualPatterns.colorPalettes &&
            analysis.visualPatterns.colorPalettes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  Color Palettes
                </p>
                <div className="space-y-2">
                  {analysis.visualPatterns.colorPalettes.slice(0, 3).map((palette, index) => (
                    <div key={index} className="flex gap-1">
                      {palette.map((color, colorIndex) => (
                        <div
                          key={colorIndex}
                          className="w-8 h-8 rounded shadow-sm border"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Content Patterns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Content Patterns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis.contentPatterns.commonSubjects.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Common Subjects
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.contentPatterns.commonSubjects.map((subject, index) => (
                  <Badge key={index} variant="outline">
                    {subject}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.contentPatterns.settingTypes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Setting Types
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.contentPatterns.settingTypes.map((setting, index) => (
                  <Badge key={index} variant="secondary">
                    {setting}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.contentPatterns.propCategories.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Props & Elements
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.contentPatterns.propCategories.map((prop, index) => (
                  <Badge key={index} variant="secondary">
                    {prop}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trending Effects */}
      {analysis.effectsTrending.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Trending Effects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.effectsTrending.map((effect, index) => (
                <Badge key={index} variant="default" className="bg-gradient-to-r from-purple-500 to-pink-500">
                  {effect}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Recommendations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Video Recommendations</CardTitle>
          <CardDescription>
            Guidelines for creating on-trend videos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Technical Specs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold">
                {analysis.videoRecommendations.technicalSpecs.aspectRatio}
              </p>
              <p className="text-xs text-muted-foreground">Aspect Ratio</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold flex items-center justify-center gap-1">
                <Clock className="h-4 w-4" />
                {analysis.videoRecommendations.technicalSpecs.duration}s
              </p>
              <p className="text-xs text-muted-foreground">Duration</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-sm font-bold capitalize">
                {analysis.videoRecommendations.technicalSpecs.cameraStyle}
              </p>
              <p className="text-xs text-muted-foreground">Camera Style</p>
            </div>
          </div>

          {/* Style Guidelines */}
          {analysis.videoRecommendations.styleGuidelines && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm font-medium text-blue-500 mb-2">Style Guidelines</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Visual: </span>
                  <span>{analysis.videoRecommendations.styleGuidelines.visualStyle}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mood: </span>
                  <span>{analysis.videoRecommendations.styleGuidelines.mood}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pace: </span>
                  <span>{analysis.videoRecommendations.styleGuidelines.pace}</span>
                </div>
                {analysis.videoRecommendations.styleGuidelines.effects &&
                  analysis.videoRecommendations.styleGuidelines.effects.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Effects: </span>
                      <span>
                        {analysis.videoRecommendations.styleGuidelines.effects.join(", ")}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Prompt Templates */}
          {analysis.videoRecommendations.promptTemplates &&
            analysis.videoRecommendations.promptTemplates.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Video Prompt Templates</p>
                <div className="space-y-2">
                  {analysis.videoRecommendations.promptTemplates.map((prompt, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {prompt.style}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {prompt.useCase}
                            </span>
                          </div>
                          <p className="text-sm">{prompt.template}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => copyPrompt(prompt.template, index)}
                        >
                          {copiedPrompt === index ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Analyzed Video IDs */}
      {analysis.analyzedVideoIds && analysis.analyzedVideoIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Analyzed videos: {analysis.analyzedVideoIds.slice(0, 5).join(", ")}
          {analysis.analyzedVideoIds.length > 5 && ` +${analysis.analyzedVideoIds.length - 5} more`}
        </div>
      )}
    </div>
  );
}

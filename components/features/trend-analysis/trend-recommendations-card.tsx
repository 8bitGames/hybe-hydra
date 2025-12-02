"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  TrendingUp,
  Sparkles,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Hash,
  Film,
  Clock,
} from "lucide-react";
import { trendsApi, type TrendBridgeFormatResponse } from "@/lib/trends-api";

interface TrendRecommendationsCardProps {
  onApplyTrendStyle?: (style: string, mood: string, pace: string) => void;
  onApplyPrompt?: (prompt: string) => void;
  onApplyHashtags?: (hashtags: string[]) => void;
  compact?: boolean;
}

export function TrendRecommendationsCard({
  onApplyTrendStyle,
  onApplyPrompt,
  onApplyHashtags,
  compact = false,
}: TrendRecommendationsCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<TrendBridgeFormatResponse | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await trendsApi.getReportForBridge(searchQuery.trim(), "TIKTOK");

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data) {
        if (!response.data.found) {
          setError(`No trend report found for "${searchQuery}". Go to Trends page to analyze this topic first.`);
          return;
        }
        setRecommendations(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch trend recommendations:", err);
      setError("Failed to fetch trend recommendations");
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = () => {
    if (recommendations?.bridge.suggestedPrompt) {
      navigator.clipboard.writeText(recommendations.bridge.suggestedPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleApplyAll = () => {
    if (!recommendations) return;

    if (onApplyTrendStyle) {
      onApplyTrendStyle(
        recommendations.bridge.styleMatch.visual,
        recommendations.bridge.styleMatch.mood,
        recommendations.bridge.styleMatch.pace
      );
    }
    if (onApplyPrompt && recommendations.bridge.suggestedPrompt) {
      onApplyPrompt(recommendations.bridge.suggestedPrompt);
    }
    if (onApplyHashtags && recommendations.bridge.hashtags.length > 0) {
      onApplyHashtags(recommendations.bridge.hashtags.slice(0, 3));
    }
  };

  return (
    <Card className={`border-border bg-muted/50 ${compact ? "" : ""}`}>
      <CardHeader className="pb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full"
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">
              AI Trend Recommendations
            </span>
          </CardTitle>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter trend topic (e.g., countrymusic)"
              className="flex-1 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              size="sm"
              className="shrink-0"
            >
              {loading ? <Spinner className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Error */}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Recommendations */}
          {recommendations && recommendations.found && (
            <div className="space-y-3">
              {/* Stale Warning */}
              {recommendations.stale && (
                <p className="text-xs text-yellow-500">
                  This data may be outdated. Consider re-analyzing on the Trends page.
                </p>
              )}

              {/* Style Match */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-background/50 rounded-lg text-center">
                  <Film className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Style</p>
                  <p className="text-xs font-medium truncate">
                    {recommendations.bridge.styleMatch.visual || "Modern"}
                  </p>
                </div>
                <div className="p-2 bg-background/50 rounded-lg text-center">
                  <Sparkles className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Mood</p>
                  <p className="text-xs font-medium capitalize">
                    {recommendations.bridge.styleMatch.mood || "Engaging"}
                  </p>
                </div>
                <div className="p-2 bg-background/50 rounded-lg text-center">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Pace</p>
                  <p className="text-xs font-medium capitalize">
                    {recommendations.bridge.styleMatch.pace || "Fast"}
                  </p>
                </div>
              </div>

              {/* Suggested Prompt */}
              {recommendations.bridge.suggestedPrompt && (
                <div className="p-2 bg-background/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Suggested Prompt</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={copyPrompt}
                    >
                      {copiedPrompt ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs line-clamp-3">
                    {recommendations.bridge.suggestedPrompt}
                  </p>
                </div>
              )}

              {/* Hashtags */}
              {recommendations.bridge.hashtags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    Trending Hashtags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {recommendations.bridge.hashtags.slice(0, 6).map((tag, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-muted"
                        onClick={() => onApplyHashtags?.([tag])}
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply Button */}
              <Button
                onClick={handleApplyAll}
                size="sm"
                className="w-full"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Apply Trend Style
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!recommendations && !loading && !error && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Search for a topic to get AI-powered trend recommendations
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

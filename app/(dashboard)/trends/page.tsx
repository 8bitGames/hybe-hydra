"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { trendsApi, type TextTrendAnalysisResponse, type VideoTrendAnalysisResponse, type TrendReportResponse } from "@/lib/trends-api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TextTrendPanel,
  VideoTrendPanel,
  RecommendationsPanel,
} from "@/components/features/trend-analysis";
import {
  TrendingUp,
  Search,
  Hash,
  Play,
  RefreshCw,
  Clock,
  Eye,
  Video,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Save,
  Database,
  Heart,
  MessageCircle,
  Share2,
  Brain,
  FileText,
  Film,
  Target,
} from "lucide-react";

interface TrendItem {
  rank: number;
  keyword: string;
  viewCount?: number;
  videoCount?: number;
}

interface CollectResult {
  success: boolean;
  method: string;
  collected_count: number;
  saved_count: number;
  trends: TrendItem[];
  error?: string;
}

interface VideoResult {
  id: string;
  description: string;
  author: { uniqueId: string; nickname: string };
  stats: { playCount: number; likeCount?: number; commentCount?: number; shareCount?: number };
  hashtags?: string[];
  videoUrl?: string;
}

interface SearchResult {
  success: boolean;
  keyword?: string;
  hashtag?: string;
  videos: VideoResult[];
  relatedHashtags?: string[];
  info?: {
    title: string;
    viewCount: number;
    videoCount: number;
  };
  error?: string;
}

export default function TrendsPage() {
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>("");
  const [lastSearchType, setLastSearchType] = useState<"keyword" | "hashtag">("keyword");


  // Collection options
  const [keywords, setKeywords] = useState("countrymusic");
  const [hashtags, setHashtags] = useState("");
  const [includeExplore, setIncludeExplore] = useState(true);

  // Search options
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchHashtag, setSearchHashtag] = useState("");

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState<"text" | "video" | "full">("full");
  const [textAnalysis, setTextAnalysis] = useState<TextTrendAnalysisResponse | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoTrendAnalysisResponse | null>(null);
  const [trendReport, setTrendReport] = useState<TrendReportResponse | null>(null);
  const [analysisTab, setAnalysisTab] = useState("report");

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const formatNumber = (num: number | undefined | null): string => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const handleCollect = async () => {
    if (!isAuthenticated || !accessToken) {
      setError("Please login first");
      return;
    }

    setLoading(true);
    setError(null);
    setCollectResult(null);

    try {
      const response = await api.post<CollectResult>("/api/v1/trends/collect", {
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        hashtags: hashtags.split(",").map((h) => h.trim()).filter(Boolean),
        includeExplore,
        region: "KR",
        platform: "TIKTOK",
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data) {
        setCollectResult(response.data);
      }
    } catch (err) {
      console.error("Collection failed:", err);
      setError("Failed to collect trends");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (type: "keyword" | "hashtag") => {
    if (!isAuthenticated || !accessToken) {
      setError("Please login first");
      return;
    }

    const value = type === "keyword" ? searchKeyword : searchHashtag;
    if (!value.trim()) {
      setError(`Please enter a ${type}`);
      return;
    }

    setSearchLoading(true);
    setError(null);
    setSearchResult(null);
    setSaveResult(null);

    try {
      const params = new URLSearchParams({
        action: type === "keyword" ? "search" : "hashtag",
        [type]: value.trim(),
      });

      const response = await api.get<SearchResult>(
        `/api/v1/trends/collect?${params.toString()}`
      );

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data) {
        setSearchResult(response.data);
        setLastSearchQuery(value.trim());
        setLastSearchType(type);
      }
    } catch (err) {
      console.error("Search failed:", err);
      setError("Failed to search");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!searchResult || !searchResult.videos || searchResult.videos.length === 0) {
      setError("No videos to save");
      return;
    }

    setSaveLoading(true);
    setError(null);
    setSaveResult(null);

    try {
      const response = await api.post<{ success: boolean; message: string; saved_count: number }>(
        "/api/v1/trends/videos",
        {
          videos: searchResult.videos,
          searchQuery: lastSearchQuery,
          searchType: lastSearchType,
          platform: "TIKTOK",
        }
      );

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data) {
        setSaveResult({
          success: response.data.success,
          message: response.data.message,
        });
      }
    } catch (err) {
      console.error("Save failed:", err);
      setError("Failed to save videos to database");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAnalyzeTrends = async () => {
    if (!lastSearchQuery) {
      setError("Please search for a keyword or hashtag first");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setTextAnalysis(null);
    setVideoAnalysis(null);
    setTrendReport(null);

    try {
      if (analysisType === "full") {
        // Generate full trend report
        const response = await trendsApi.generateReport({
          searchQuery: lastSearchQuery,
          platform: "TIKTOK",
          includeText: true,
          includeVideo: true,
          maxVideos: 40,
          maxVideoAnalysis: 5,
        });

        if (response.error) {
          setError(response.error.message);
          return;
        }

        if (response.data) {
          setTrendReport(response.data);
          setAnalysisTab("report");
        }
      } else if (analysisType === "text") {
        // Text-only analysis
        const response = await trendsApi.analyzeText({
          searchQuery: lastSearchQuery,
          platform: "TIKTOK",
          maxVideos: 40,
        });

        if (response.error) {
          setError(response.error.message);
          return;
        }

        if (response.data) {
          setTextAnalysis(response.data);
          setAnalysisTab("text");
        }
      } else if (analysisType === "video") {
        // Video-only analysis
        const response = await trendsApi.analyzeVideo({
          searchQuery: lastSearchQuery,
          platform: "TIKTOK",
          maxVideos: 5,
        });

        if (response.error) {
          setError(response.error.message);
          return;
        }

        if (response.data) {
          setVideoAnalysis(response.data);
          setAnalysisTab("video");
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze trends");
    } finally {
      setAnalyzing(false);
    }
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            TikTok Trends
          </h1>
          <p className="text-muted-foreground">
            Collect and explore trending hashtags and keywords from TikTok
          </p>
        </div>
      </div>

      {/* Admin Only: Trend Collection */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Trend Collection (Admin)
            </CardTitle>
            <CardDescription>
              Collect trending hashtags from TikTok and save to database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords (comma separated)</Label>
                <Input
                  id="keywords"
                  placeholder="countrymusic, carlypearce, nashville"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Search TikTok for these keywords and extract related hashtags
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags">Hashtags (comma separated)</Label>
                <Input
                  id="hashtags"
                  placeholder="fyp, viral, trending"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get detailed info for these specific hashtags
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="explore"
                checked={includeExplore}
                onCheckedChange={(checked) => setIncludeExplore(checked === true)}
              />
              <Label htmlFor="explore" className="text-sm font-normal">
                Include Discover page trends
              </Label>
            </div>

            <Button onClick={handleCollect} disabled={loading} className="w-full md:w-auto">
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Collecting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Collection
                </>
              )}
            </Button>

            {/* Collection Results */}
            {collectResult && (
              <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  {collectResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    {collectResult.success ? "Collection Successful" : "Collection Failed"}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium">{collectResult.method}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Collected</p>
                    <p className="font-medium">{collectResult.collected_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Saved to DB</p>
                    <p className="font-medium">{collectResult.saved_count}</p>
                  </div>
                </div>

                {collectResult.trends.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Top 10 Trends:</p>
                    <div className="flex flex-wrap gap-2">
                      {collectResult.trends.slice(0, 10).map((trend) => (
                        <Badge key={trend.rank} variant="secondary" className="text-xs">
                          #{trend.rank} {trend.keyword}
                          {trend.viewCount && (
                            <span className="ml-1 text-muted-foreground">
                              ({formatNumber(trend.viewCount)})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Keyword Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Keyword Search
            </CardTitle>
            <CardDescription>
              Search TikTok for videos and related hashtags
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter keyword (e.g., country song)"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch("keyword")}
              />
              <Button
                onClick={() => handleSearch("keyword")}
                disabled={searchLoading}
              >
                {searchLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hashtag Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Hashtag Details
            </CardTitle>
            <CardDescription>
              Get hashtag statistics (view count, post count). Note: Individual videos may not load due to TikTok restrictions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter hashtag (e.g., countrymusic)"
                value={searchHashtag}
                onChange={(e) => setSearchHashtag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch("hashtag")}
              />
              <Button
                onClick={() => handleSearch("hashtag")}
                disabled={searchLoading}
              >
                {searchLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {searchResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                Search Results
              </CardTitle>
              {searchResult.videos && searchResult.videos.length > 0 && (
                <div className="flex items-center gap-2">
                  {saveResult && (
                    <Badge variant={saveResult.success ? "default" : "destructive"}>
                      {saveResult.message}
                    </Badge>
                  )}
                  <Button
                    onClick={handleSaveToDatabase}
                    disabled={saveLoading}
                    variant="outline"
                    size="sm"
                  >
                    {saveLoading ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Save to Database
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hashtag Info */}
            {searchResult.info && (
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">#{searchResult.info.title}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span>{formatNumber(searchResult.info.viewCount)} views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" />
                    <span>{formatNumber(searchResult.info.videoCount)} videos</span>
                  </div>
                </div>
              </div>
            )}

            {/* Related Hashtags */}
            {searchResult.relatedHashtags && searchResult.relatedHashtags.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Related Hashtags:</p>
                <div className="flex flex-wrap gap-2">
                  {searchResult.relatedHashtags.slice(0, 30).map((tag, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => {
                        setSearchHashtag(tag.replace("#", ""));
                        handleSearch("hashtag");
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {searchResult.videos && searchResult.videos.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Videos ({searchResult.videos.length}):
                </p>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {searchResult.videos.map((video) => {
                    const videoUrl = video.videoUrl ||
                      (video.author.uniqueId
                        ? `https://www.tiktok.com/@${video.author.uniqueId}/video/${video.id}`
                        : `https://www.tiktok.com/video/${video.id}`);

                    return (
                      <a
                        key={video.id}
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm line-clamp-2 flex-1">
                            {video.description || "(No description)"}
                          </p>
                          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span>@{video.author.uniqueId}</span>
                          {(video.stats.playCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1" title="Views">
                              <Eye className="h-3 w-3" />
                              {formatNumber(video.stats.playCount)}
                            </span>
                          )}
                          {(video.stats.likeCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1" title="Likes">
                              <Heart className="h-3 w-3 text-red-400" />
                              {formatNumber(video.stats.likeCount)}
                            </span>
                          )}
                          {(video.stats.commentCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1" title="Comments">
                              <MessageCircle className="h-3 w-3" />
                              {formatNumber(video.stats.commentCount)}
                            </span>
                          )}
                          {(video.stats.shareCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1" title="Shares">
                              <Share2 className="h-3 w-3" />
                              {formatNumber(video.stats.shareCount)}
                            </span>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {searchResult.error && (
              <div className="text-sm text-red-500">{searchResult.error}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analyze Trends Section */}
      {searchResult && searchResult.videos && searchResult.videos.length > 0 && (
        <Card className="border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Trend Analysis
            </CardTitle>
            <CardDescription>
              Analyze search results to get content creation recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Analysis Type:</Label>
                <div className="flex gap-2">
                  <Button
                    variant={analysisType === "full" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAnalysisType("full")}
                    disabled={analyzing}
                  >
                    <Target className="h-4 w-4 mr-1" />
                    Full Report
                  </Button>
                  <Button
                    variant={analysisType === "text" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAnalysisType("text")}
                    disabled={analyzing}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Text Only
                  </Button>
                  <Button
                    variant={analysisType === "video" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAnalysisType("video")}
                    disabled={analyzing}
                  >
                    <Film className="h-4 w-4 mr-1" />
                    Video Only
                  </Button>
                </div>
              </div>
              <Button
                onClick={handleAnalyzeTrends}
                disabled={analyzing}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {analyzing ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze &quot;{lastSearchQuery}&quot;
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {analysisType === "full"
                ? "Full report combines text analysis (hashtags, captions) and video analysis (visual styles, patterns) into actionable recommendations. Takes 2-5 minutes."
                : analysisType === "text"
                ? "Text analysis extracts hashtag strategies, caption templates, and content themes from video descriptions. Takes 30-60 seconds."
                : "Video analysis examines visual styles, color palettes, camera movements, and effects from top videos. Takes 1-3 minutes."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {(trendReport || textAnalysis || videoAnalysis) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={analysisTab} onValueChange={setAnalysisTab}>
              <TabsList className="mb-4">
                {trendReport && (
                  <TabsTrigger value="report">
                    <Target className="h-4 w-4 mr-1" />
                    Strategy Report
                  </TabsTrigger>
                )}
                {(textAnalysis || (trendReport?.analyses?.text)) && (
                  <TabsTrigger value="text">
                    <FileText className="h-4 w-4 mr-1" />
                    Text Analysis
                  </TabsTrigger>
                )}
                {(videoAnalysis || (trendReport?.analyses?.video)) && (
                  <TabsTrigger value="video">
                    <Film className="h-4 w-4 mr-1" />
                    Video Analysis
                  </TabsTrigger>
                )}
              </TabsList>

              {trendReport && (
                <TabsContent value="report">
                  <RecommendationsPanel
                    report={trendReport.report}
                    cached={trendReport.cached}
                  />
                </TabsContent>
              )}

              {textAnalysis && (
                <TabsContent value="text">
                  <TextTrendPanel
                    analysis={textAnalysis.analysis}
                    cached={textAnalysis.cached}
                  />
                </TabsContent>
              )}

              {videoAnalysis && (
                <TabsContent value="video">
                  <VideoTrendPanel
                    analysis={videoAnalysis.analysis}
                    cached={videoAnalysis.cached}
                  />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">1. Keyword Search</h4>
              <p className="text-muted-foreground">
                Search TikTok for a keyword and find related videos with descriptions,
                authors, and hashtags. Best for discovering content in a specific niche.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. Hashtag Details</h4>
              <p className="text-muted-foreground">
                Get statistics for a hashtag (view count, post count). Individual video
                lists may be limited due to TikTok&apos;s restrictions.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">3. Trend Collection (Admin)</h4>
              <p className="text-muted-foreground">
                Collect 200+ trends from TikTok&apos;s discover page and keyword searches,
                saving them to the database for campaign planning.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

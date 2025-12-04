"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { saveBridgePrompt } from "@/lib/bridge-storage";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { promptApi, PromptTransformResponse } from "@/lib/video-api";
import { useCampaigns, useSavedTrends, useInvalidateQueries } from "@/lib/queries";
import { trendsApi, type TextTrendAnalysisResponse, type VideoTrendAnalysisResponse, type TrendReportResponse } from "@/lib/trends-api";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TextTrendPanel,
  VideoTrendPanel,
  RecommendationsPanel,
} from "@/components/features/trend-analysis";
import {
  Sparkles,
  Zap,
  ArrowRight,
  Check,
  Hash,
  FolderOpen,
  Wand2,
  TrendingUp,
  X,
  ChevronRight,
  Music,
  Image as ImageIcon,
  Plus,
  Search,
  Bookmark,
  Eye,
  ExternalLink,
  Play,
  CheckCircle,
  AlertCircle,
  Database,
  Heart,
  MessageCircle,
  Share2,
  Brain,
  FileText,
  Film,
  Target,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Shared interfaces
interface SavedTrendVideo {
  id: string;
  searchQuery: string;
  searchType: string;
  playCount: number | null;
}

interface TrendGroup {
  query: string;
  type: string;
  videos: SavedTrendVideo[];
  totalPlayCount: number;
}

interface SearchVideoResult {
  id: string;
  description: string;
  author: { uniqueId: string; nickname: string };
  stats: { playCount: number; likeCount?: number; commentCount?: number; shareCount?: number };
  hashtags?: string[];
  videoUrl?: string;
}

interface TrendSearchResult {
  success: boolean;
  keyword?: string;
  hashtag?: string;
  videos: SearchVideoResult[];
  relatedHashtags?: string[];
  info?: {
    title: string;
    viewCount: number;
    videoCount: number;
  };
  error?: string;
}

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

export default function TrendsPage() {
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const { language } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Main tab state
  const [mainTab, setMainTab] = useState<"bridge" | "analyze">("bridge");

  // TikTok URL to analyze (from dashboard trending click)
  const [tiktokUrlToAnalyze, setTiktokUrlToAnalyze] = useState<string | null>(null);

  // Use TanStack Query for campaigns with caching
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({ page_size: 20, status: "active" });
  const campaigns = campaignsData?.items || [];

  // Use TanStack Query for saved trends with caching
  const { data: trendGroups = [], isLoading: trendsLoading, refetch: refetchTrends } = useSavedTrends();
  const { invalidateTrends } = useInvalidateQueries();

  // Loading state for collect operations (not cached)
  const [collectLoading, setCollectLoading] = useState(false);

  // Bridge form state
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [transformedPrompt, setTransformedPrompt] = useState<PromptTransformResponse | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  // Trend search state
  const [trendTab, setTrendTab] = useState<"saved" | "search">("saved");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<TrendSearchResult | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const [lastSearchType, setLastSearchType] = useState<"keyword" | "hashtag">("keyword");

  // Admin collection state
  const [keywords, setKeywords] = useState("countrymusic");
  const [hashtags, setHashtags] = useState("");
  const [includeExplore, setIncludeExplore] = useState(true);
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState<"text" | "video" | "full">("full");
  const [textAnalysis, setTextAnalysis] = useState<TextTrendAnalysisResponse | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoTrendAnalysisResponse | null>(null);
  const [trendReport, setTrendReport] = useState<TrendReportResponse | null>(null);
  const [analysisTab, setAnalysisTab] = useState("report");

  // Handle URL params from dashboard trending click
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const analyzeUrl = searchParams.get("analyze_url") || sessionStorage.getItem("tiktok_analyze_url");

    if (tabParam === "bridge") {
      setMainTab("bridge");
    }

    if (analyzeUrl) {
      setTiktokUrlToAnalyze(analyzeUrl);
      setMainTab("bridge");
      // Pre-fill user input with instruction to analyze the video
      const tiktokInstruction = language === "ko"
        ? `이 TikTok 영상과 비슷한 스타일의 영상을 만들어주세요:\n${analyzeUrl}`
        : `Create a video similar to this TikTok:\n${analyzeUrl}`;
      setUserInput(tiktokInstruction);
      // Clear session storage after reading
      sessionStorage.removeItem("tiktok_analyze_url");
    }
  }, [searchParams, language]);

  // Auto-select first campaign when available and analyzing TikTok
  useEffect(() => {
    if (tiktokUrlToAnalyze && campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [tiktokUrlToAnalyze, campaigns, selectedCampaignId]);

  // Translations
  const t = {
    title: language === "ko" ? "트렌드" : "Trends",
    subtitle: language === "ko" ? "트렌드를 검색하고 AI로 프롬프트를 최적화하세요" : "Search trends and optimize prompts with AI",
    promptBridge: language === "ko" ? "프롬프트 브릿지" : "Prompt Bridge",
    trendAnalysis: language === "ko" ? "트렌드 분석" : "Trend Analysis",
    selectCampaign: language === "ko" ? "캠페인 선택" : "Select Campaign",
    selectCampaignDesc: language === "ko" ? "영상을 생성할 캠페인을 선택하세요" : "Choose a campaign for video generation",
    noCampaigns: language === "ko" ? "캠페인이 없습니다" : "No campaigns yet",
    createCampaign: language === "ko" ? "캠페인 만들기" : "Create Campaign",
    enterIdea: language === "ko" ? "아이디어 입력" : "Enter Your Idea",
    enterIdeaDesc: language === "ko" ? "만들고 싶은 영상을 설명하세요" : "Describe the video you want to create",
    applied: language === "ko" ? "적용됨:" : "Applied:",
    ideaPlaceholder: language === "ko"
      ? "영상 아이디어를 적어주세요.\n예: 밤하늘 아래 춤추는 소녀, 네온 불빛이 반짝이는 도시"
      : "Describe your video idea.\nExample: A girl dancing under the night sky, neon lights in the city",
    optimizing: language === "ko" ? "최적화 중..." : "Optimizing...",
    optimizeWithAi: language === "ko" ? "AI로 프롬프트 최적화" : "Optimize with AI",
    optimized: language === "ko" ? "최적화 완료" : "Optimized",
    aiOptimized: language === "ko" ? "AI가 프롬프트를 최적화했습니다" : "AI has optimized your prompt",
    celebrityDetected: language === "ko" ? "유명인 감지됨" : "Celebrity detected",
    aspect: language === "ko" ? "화면비" : "Aspect",
    duration: language === "ko" ? "길이" : "Duration",
    generateVideo: language === "ko" ? "AI 영상 생성" : "Create AI Video",
    compose: language === "ko" ? "컴포즈 영상" : "Compose Video",
    trends: language === "ko" ? "트렌드" : "Trends",
    clickToApply: language === "ko" ? "클릭하여 적용 (최대 3개)" : "Click to apply (max 3)",
    saved: language === "ko" ? "저장됨" : "Saved",
    search: language === "ko" ? "검색" : "Search",
    noSavedTrends: language === "ko" ? "저장된 트렌드가 없습니다" : "No saved trends",
    searchTrends: language === "ko" ? "트렌드 검색" : "Search Trends",
    videos: language === "ko" ? "영상" : "videos",
    views: language === "ko" ? "조회" : "views",
    keywordOrHashtag: language === "ko" ? "키워드 또는 #해시태그" : "keyword or #hashtag",
    relatedHashtags: language === "ko" ? "관련 해시태그" : "Related hashtags",
    topVideos: language === "ko" ? "인기 영상" : "Top videos",
    save: language === "ko" ? "저장" : "Save",
    searchTiktokTrends: language === "ko" ? "TikTok 트렌드를 검색하세요" : "Search TikTok trends",
    searchExample: language === "ko" ? "예: kpop, #dance, country music" : "e.g., kpop, #dance, country music",
    tip: language === "ko" ? "팁:" : "Tip:",
    tipContent: language === "ko"
      ? "트렌드를 선택하면 AI가 해당 키워드를 반영한 프롬프트를 생성합니다."
      : "Select trends to have AI incorporate those keywords into your prompt.",
    max3Trends: language === "ko" ? "최대 3개까지" : "Max 3 trends",
    max3TrendsDesc: language === "ko" ? "트렌드는 최대 3개까지 선택 가능합니다" : "You can select up to 3 trends",
    trendFound: language === "ko" ? "트렌드 발견" : "Trend found",
    clickToApplyTrend: language === "ko" ? "클릭하여 적용" : "Click to apply",
    searchFailed: language === "ko" ? "검색 실패" : "Search failed",
    tryAgain: language === "ko" ? "다시 시도해주세요" : "Please try again",
    savedTrend: language === "ko" ? "저장 완료" : "Saved",
    trendSaved: language === "ko" ? "트렌드가 저장되었습니다" : "Trend has been saved",
    promptOptimized: language === "ko" ? "프롬프트 최적화 완료" : "Prompt optimized",
    safetyFailed: language === "ko" ? "안전성 검사 실패" : "Safety check failed",
    errorOccurred: language === "ko" ? "오류 발생" : "Error occurred",
    // Analysis translations
    adminCollection: language === "ko" ? "트렌드 수집 (관리자)" : "Trend Collection (Admin)",
    adminCollectionDesc: language === "ko" ? "TikTok에서 트렌드 해시태그를 수집하고 데이터베이스에 저장합니다" : "Collect trending hashtags from TikTok and save to database",
    keywordsLabel: language === "ko" ? "키워드 (쉼표로 구분)" : "Keywords (comma separated)",
    keywordsPlaceholder: "countrymusic, carlypearce, nashville",
    keywordsDesc: language === "ko" ? "이 키워드로 TikTok을 검색하고 관련 해시태그를 추출합니다" : "Search TikTok for these keywords and extract related hashtags",
    hashtagsLabel: language === "ko" ? "해시태그 (쉼표로 구분)" : "Hashtags (comma separated)",
    hashtagsPlaceholder: "fyp, viral, trending",
    hashtagsDesc: language === "ko" ? "이 특정 해시태그에 대한 상세 정보를 가져옵니다" : "Get detailed info for these specific hashtags",
    includeDiscover: language === "ko" ? "Discover 페이지 트렌드 포함" : "Include Discover page trends",
    collecting: language === "ko" ? "수집 중..." : "Collecting...",
    startCollection: language === "ko" ? "수집 시작" : "Start Collection",
    collectionSuccess: language === "ko" ? "수집 성공" : "Collection Successful",
    collectionFailed: language === "ko" ? "수집 실패" : "Collection Failed",
    method: language === "ko" ? "방법" : "Method",
    collected: language === "ko" ? "수집됨" : "Collected",
    savedToDb: language === "ko" ? "DB 저장" : "Saved to DB",
    top10Trends: language === "ko" ? "상위 10개 트렌드:" : "Top 10 Trends:",
    keywordSearch: language === "ko" ? "키워드 검색" : "Keyword Search",
    keywordSearchDesc: language === "ko" ? "TikTok에서 영상과 관련 해시태그를 검색합니다" : "Search TikTok for videos and related hashtags",
    keywordPlaceholder: language === "ko" ? "키워드 입력 (예: country song)" : "Enter keyword (e.g., country song)",
    hashtagDetails: language === "ko" ? "해시태그 상세" : "Hashtag Details",
    hashtagDetailsDesc: language === "ko" ? "해시태그 통계를 확인합니다 (조회수, 게시물 수)" : "Get hashtag statistics (view count, post count)",
    hashtagPlaceholder: language === "ko" ? "해시태그 입력 (예: countrymusic)" : "Enter hashtag (e.g., countrymusic)",
    searchResults: language === "ko" ? "검색 결과" : "Search Results",
    saving: language === "ko" ? "저장 중..." : "Saving...",
    saveToDatabase: language === "ko" ? "데이터베이스에 저장" : "Save to Database",
    aiAnalysis: language === "ko" ? "AI 트렌드 분석" : "AI Trend Analysis",
    aiAnalysisDesc: language === "ko" ? "검색 결과를 분석하여 콘텐츠 제작 추천을 받으세요" : "Analyze search results to get content creation recommendations",
    analysisTypeLabel: language === "ko" ? "분석 유형:" : "Analysis Type:",
    fullReport: language === "ko" ? "전체 리포트" : "Full Report",
    textOnly: language === "ko" ? "텍스트만" : "Text Only",
    videoOnly: language === "ko" ? "영상만" : "Video Only",
    analyzing: language === "ko" ? "분석 중..." : "Analyzing...",
    analyze: language === "ko" ? "분석" : "Analyze",
    fullReportDesc: language === "ko" ? "전체 리포트는 텍스트 분석과 영상 분석을 결합하여 실행 가능한 추천을 제공합니다. 2-5분 소요." : "Full report combines text and video analysis into actionable recommendations. Takes 2-5 minutes.",
    textOnlyDesc: language === "ko" ? "텍스트 분석은 해시태그 전략, 캡션 템플릿, 콘텐츠 테마를 추출합니다. 30-60초 소요." : "Text analysis extracts hashtag strategies, caption templates, and content themes. Takes 30-60 seconds.",
    videoOnlyDesc: language === "ko" ? "영상 분석은 시각적 스타일, 색상 팔레트, 카메라 움직임, 효과를 분석합니다. 1-3분 소요." : "Video analysis examines visual styles, color palettes, camera movements, and effects. Takes 1-3 minutes.",
    analysisResults: language === "ko" ? "분석 결과" : "Analysis Results",
    strategyReport: language === "ko" ? "전략 리포트" : "Strategy Report",
    textAnalysisLabel: language === "ko" ? "텍스트 분석" : "Text Analysis",
    videoAnalysisLabel: language === "ko" ? "영상 분석" : "Video Analysis",
    loginFirst: language === "ko" ? "먼저 로그인해주세요" : "Please login first",
    enterKeyword: language === "ko" ? "키워드를 입력해주세요" : "Please enter a keyword",
    enterHashtag: language === "ko" ? "해시태그를 입력해주세요" : "Please enter a hashtag",
    searchFirst: language === "ko" ? "먼저 키워드나 해시태그를 검색해주세요" : "Please search for a keyword or hashtag first",
    noVideosToSave: language === "ko" ? "저장할 영상이 없습니다" : "No videos to save",
    noDescription: language === "ko" ? "(설명 없음)" : "(No description)",
  };

  // Helper function
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Auto-select first campaign when campaigns are loaded
  React.useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  // Handle trend search (for bridge panel)
  const handleTrendSearch = async () => {
    if (!accessToken || !searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResult(null);

    try {
      api.setAccessToken(accessToken);
      const isHashtag = searchQuery.trim().startsWith("#");
      const query = searchQuery.trim().replace(/^#/, "");

      const params = new URLSearchParams({
        action: isHashtag ? "hashtag" : "search",
        [isHashtag ? "hashtag" : "keyword"]: query,
      });

      const response = await api.get<TrendSearchResult>(
        `/api/v1/trends/collect?${params.toString()}`
      );

      if (response.data) {
        setSearchResult(response.data);
        setLastSearchQuery(query);
        setLastSearchType(isHashtag ? "hashtag" : "keyword");
        if (!selectedTrends.includes(query) && selectedTrends.length < 3) {
          toast.success(t.trendFound, `"${query}" ${t.clickToApplyTrend}`);
        }
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error(t.searchFailed, t.tryAgain);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle saving search results
  const handleSaveSearchResults = async () => {
    if (!searchResult || !searchResult.videos?.length || !accessToken) return;

    setSaveLoading(true);
    try {
      api.setAccessToken(accessToken);
      const query = searchQuery.trim().replace(/^#/, "");
      const isHashtag = searchQuery.trim().startsWith("#");

      await api.post("/api/v1/trends/videos", {
        videos: searchResult.videos,
        searchQuery: query,
        searchType: isHashtag ? "hashtag" : "keyword",
        platform: "TIKTOK",
      });

      toast.success(t.savedTrend, t.trendSaved);
      setSaveResult({ success: true, message: t.trendSaved });
      refetchTrends(); // Refresh cached trends
    } catch (error) {
      console.error("Save failed:", error);
      setSaveResult({ success: false, message: t.searchFailed });
    } finally {
      setSaveLoading(false);
    }
  };

  // Handle trend selection
  const handleSelectTrend = (keyword: string) => {
    setSelectedTrends((prev) => {
      if (prev.includes(keyword)) {
        return prev.filter((t) => t !== keyword);
      }
      if (prev.length >= 3) {
        toast.warning(t.max3Trends, t.max3TrendsDesc);
        return prev;
      }
      return [...prev, keyword];
    });
  };

  // Handle prompt transform
  const handleTransform = async () => {
    if (!userInput.trim() || !selectedCampaignId) return;

    setIsTransforming(true);
    setTransformedPrompt(null);

    try {
      const result = await promptApi.transform({
        user_input: userInput,
        campaign_id: selectedCampaignId,
        trend_keywords: selectedTrends,
      });

      if (result.data) {
        if (result.data.status === "blocked") {
          toast.error(t.safetyFailed, result.data.blocked_reason || "");
        } else {
          setTransformedPrompt(result.data);
          toast.success(t.promptOptimized, t.aiOptimized);
        }
      }
    } catch (error) {
      console.error("Transform error:", error);
      toast.error(t.errorOccurred, t.tryAgain);
    } finally {
      setIsTransforming(false);
    }
  };

  // Navigate to generate/compose
  const handleNavigateToGenerate = () => {
    if (!selectedCampaignId || !transformedPrompt) return;
    saveBridgePrompt({
      campaignId: selectedCampaignId,
      originalPrompt: userInput,
      transformedPrompt: transformedPrompt,
      selectedTrends: selectedTrends,
      timestamp: Date.now(),
    });
    router.push(`/campaigns/${selectedCampaignId}/generate`);
  };

  const handleNavigateToCompose = () => {
    if (!selectedCampaignId || !transformedPrompt) return;
    saveBridgePrompt({
      campaignId: selectedCampaignId,
      originalPrompt: userInput,
      transformedPrompt: transformedPrompt,
      selectedTrends: selectedTrends,
      timestamp: Date.now(),
    });
    router.push(`/campaigns/${selectedCampaignId}/compose`);
  };

  // Admin collection
  const handleCollect = async () => {
    if (!isAuthenticated || !accessToken) return;

    setCollectLoading(true);
    setCollectResult(null);

    try {
      const response = await api.post<CollectResult>("/api/v1/trends/collect", {
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        hashtags: hashtags.split(",").map((h) => h.trim()).filter(Boolean),
        includeExplore,
        region: "KR",
        platform: "TIKTOK",
      });

      if (response.data) {
        setCollectResult(response.data);
      }
    } catch (err) {
      console.error("Collection failed:", err);
    } finally {
      setCollectLoading(false);
    }
  };

  // Handle AI analysis
  const handleAnalyzeTrends = async () => {
    if (!lastSearchQuery) return;

    setAnalyzing(true);
    setTextAnalysis(null);
    setVideoAnalysis(null);
    setTrendReport(null);

    try {
      if (analysisType === "full") {
        const response = await trendsApi.generateReport({
          searchQuery: lastSearchQuery,
          platform: "TIKTOK",
          includeText: true,
          includeVideo: true,
          maxVideos: 40,
          maxVideoAnalysis: 5,
        });
        if (response.data) {
          setTrendReport(response.data);
          setAnalysisTab("report");
        }
      } else if (analysisType === "text") {
        const response = await trendsApi.analyzeText({
          searchQuery: lastSearchQuery,
          platform: "TIKTOK",
          maxVideos: 40,
        });
        if (response.data) {
          setTextAnalysis(response.data);
          setAnalysisTab("text");
        }
      } else if (analysisType === "video") {
        const response = await trendsApi.analyzeVideo({
          searchQuery: lastSearchQuery,
          platform: "TIKTOK",
          maxVideos: 5,
        });
        if (response.data) {
          setVideoAnalysis(response.data);
          setAnalysisTab("video");
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "bridge" | "analyze")} className="w-full">
        <TabsList className="mb-6 w-full max-w-md h-12 p-1">
          <TabsTrigger value="bridge" className="flex-1 flex items-center justify-center gap-2 h-10 text-sm font-medium">
            <Wand2 className="h-4 w-4" />
            {t.promptBridge}
          </TabsTrigger>
          <TabsTrigger value="analyze" className="flex-1 flex items-center justify-center gap-2 h-10 text-sm font-medium">
            <Brain className="h-4 w-4" />
            {t.trendAnalysis}
          </TabsTrigger>
        </TabsList>

        {/* Prompt Bridge Tab */}
        <TabsContent value="bridge">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column - Main Prompt Interface (3/5) */}
            <div className="lg:col-span-3 space-y-4">
              {/* Step 1: Select Campaign */}
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      1
                    </div>
                    <div>
                      <h2 className="font-medium">{t.selectCampaign}</h2>
                      <p className="text-xs text-muted-foreground">{t.selectCampaignDesc}</p>
                    </div>
                  </div>

                  {campaignsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Spinner className="h-6 w-6" />
                    </div>
                  ) : campaigns.length === 0 ? (
                    <div className="text-center py-8">
                      <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-4">{t.noCampaigns}</p>
                      <Button onClick={() => router.push("/campaigns/new")}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t.createCampaign}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {campaigns.slice(0, 6).map((campaign) => {
                        const isSelected = selectedCampaignId === campaign.id;
                        return (
                          <button
                            key={campaign.id}
                            onClick={() => setSelectedCampaignId(campaign.id)}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <div
                              className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                isSelected ? "bg-primary/10" : "bg-muted"
                              )}
                            >
                              {campaign.cover_image_url ? (
                                <img
                                  src={campaign.cover_image_url}
                                  alt=""
                                  className="w-full h-full object-cover rounded-xl"
                                />
                              ) : (
                                <FolderOpen className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{campaign.name}</p>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {campaign.artist_stage_name || campaign.artist_name}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                {campaign.audio_count !== undefined && campaign.audio_count > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Music className="h-3 w-3" /> {campaign.audio_count}
                                  </span>
                                )}
                                {campaign.image_count !== undefined && campaign.image_count > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <ImageIcon className="h-3 w-3" /> {campaign.image_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 2: Write Your Idea */}
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      2
                    </div>
                    <div>
                      <h2 className="font-medium">{t.enterIdea}</h2>
                      <p className="text-xs text-muted-foreground">{t.enterIdeaDesc}</p>
                    </div>
                  </div>

                  {/* Selected Trends */}
                  {selectedTrends.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 p-3 bg-muted/50 rounded-lg">
                      <span className="text-xs text-muted-foreground font-medium">{t.applied}</span>
                      {selectedTrends.map((trend) => (
                        <Badge
                          key={trend}
                          variant="secondary"
                          className="cursor-pointer text-xs"
                          onClick={() => handleSelectTrend(trend)}
                        >
                          #{trend}
                          <X className="h-2.5 w-2.5 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={userInput}
                    onChange={(e) => {
                      setUserInput(e.target.value);
                      setTransformedPrompt(null);
                    }}
                    placeholder={t.ideaPlaceholder}
                    rows={3}
                    className="w-full px-3 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                  />

                  <Button
                    onClick={handleTransform}
                    disabled={!userInput.trim() || !selectedCampaignId || isTransforming}
                    className="w-full mt-3"
                  >
                    {isTransforming ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        {t.optimizing}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        {t.optimizeWithAi}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Step 3: Result & Actions */}
              {transformedPrompt && (
                <Card className="border border-green-500/30">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center">
                        <Check className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-medium text-green-700 dark:text-green-400">{t.optimized}</h2>
                        <p className="text-xs text-muted-foreground">{t.aiOptimized}</p>
                      </div>
                    </div>

                    {/* Celebrity Warning */}
                    {transformedPrompt.celebrity_warning && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-300 dark:border-yellow-500/30 rounded-lg mb-3">
                        <div className="flex items-start gap-2">
                          <span className="text-sm">⚠️</span>
                          <div>
                            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-400">{t.celebrityDetected}</p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-500">
                              {transformedPrompt.detected_celebrities?.join(", ")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Optimized Prompt */}
                    <div className="p-3 bg-muted/50 rounded-lg border border-border mb-3">
                      <p className="text-sm text-foreground leading-relaxed">{transformedPrompt.veo_prompt}</p>
                    </div>

                    {/* Analysis Tags */}
                    {transformedPrompt.analysis?.trend_applied?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {transformedPrompt.analysis.trend_applied.map((trend) => (
                          <Badge key={trend} variant="secondary" className="text-xs">
                            <TrendingUp className="h-2.5 w-2.5 mr-1" />
                            {trend}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Technical Settings */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="p-2 bg-muted rounded-lg text-center">
                        <p className="text-[10px] text-muted-foreground">{t.aspect}</p>
                        <p className="font-medium text-sm">{transformedPrompt.technical_settings.aspect_ratio}</p>
                      </div>
                      <div className="p-2 bg-muted rounded-lg text-center">
                        <p className="text-[10px] text-muted-foreground">FPS</p>
                        <p className="font-medium text-sm">{transformedPrompt.technical_settings.fps}</p>
                      </div>
                      <div className="p-2 bg-muted rounded-lg text-center">
                        <p className="text-[10px] text-muted-foreground">{t.duration}</p>
                        <p className="font-medium text-sm">{transformedPrompt.technical_settings.duration_seconds}s</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button onClick={handleNavigateToGenerate} className="flex-1">
                        <Sparkles className="h-4 w-4 mr-2" />
                        {t.generateVideo}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                      <Button onClick={handleNavigateToCompose} variant="outline" className="flex-1">
                        <Wand2 className="h-4 w-4 mr-2" />
                        {t.compose}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Trends (2/5) */}
            <div className="lg:col-span-2 flex flex-col">
              <Card className="flex-1 flex flex-col">
                <CardContent className="pt-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-lg">{t.trends}</h2>
                      <p className="text-xs text-muted-foreground">{t.clickToApply}</p>
                    </div>
                  </div>

                  {/* Tabs: Saved / Search */}
                  <Tabs value={trendTab} onValueChange={(v) => setTrendTab(v as "saved" | "search")} className="w-full flex-1 flex flex-col">
                    <TabsList className="w-full mb-4">
                      <TabsTrigger value="saved" className="flex-1">
                        <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                        {t.saved}
                      </TabsTrigger>
                      <TabsTrigger value="search" className="flex-1">
                        <Search className="h-3.5 w-3.5 mr-1.5" />
                        {t.search}
                      </TabsTrigger>
                    </TabsList>

                    {/* Saved Trends Tab */}
                    <TabsContent value="saved" className="mt-0 flex-1">
                      {trendsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Spinner className="h-6 w-6" />
                        </div>
                      ) : trendGroups.length === 0 ? (
                        <div className="text-center py-8">
                          <Bookmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground mb-3">{t.noSavedTrends}</p>
                          <Button variant="outline" size="sm" onClick={() => setTrendTab("search")}>
                            <Search className="h-3.5 w-3.5 mr-1.5" />
                            {t.searchTrends}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 overflow-y-auto flex-1">
                          {trendGroups.slice(0, 10).map((group) => {
                            const isSelected = selectedTrends.includes(group.query);
                            return (
                              <button
                                key={group.query}
                                onClick={() => handleSelectTrend(group.query)}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                                )}
                              >
                                <Hash className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{group.query}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {group.videos.length} {t.videos} • {formatNumber(group.totalPlayCount)} {t.views}
                                  </p>
                                </div>
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </div>
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* Search Trends Tab */}
                    <TabsContent value="search" className="mt-0 space-y-4 flex-1">
                      {/* Search Input */}
                      <div className="flex gap-2">
                        <Input
                          placeholder={t.keywordOrHashtag}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleTrendSearch()}
                          className="h-9"
                        />
                        <Button onClick={handleTrendSearch} disabled={searchLoading || !searchQuery.trim()} size="sm" className="h-9 px-3">
                          {searchLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>

                      {/* Search Results */}
                      {searchLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Spinner className="h-6 w-6" />
                        </div>
                      ) : searchResult ? (
                        <div className="space-y-3">
                          {/* Quick Apply Button */}
                          {searchResult.success && (
                            <button
                              onClick={() => handleSelectTrend(searchQuery.trim().replace(/^#/, ""))}
                              className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                                selectedTrends.includes(searchQuery.trim().replace(/^#/, ""))
                                  ? "border-primary bg-primary/10"
                                  : "border-dashed border-primary/50 hover:border-primary hover:bg-primary/5"
                              )}
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">#{searchQuery.trim().replace(/^#/, "")}</p>
                                {searchResult.info && (
                                  <p className="text-xs text-muted-foreground">
                                    {formatNumber(searchResult.info.viewCount)} {t.views}
                                  </p>
                                )}
                              </div>
                              {selectedTrends.includes(searchQuery.trim().replace(/^#/, "")) ? (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              ) : (
                                <Plus className="h-4 w-4 text-primary" />
                              )}
                            </button>
                          )}

                          {/* Related Hashtags */}
                          {searchResult.relatedHashtags && searchResult.relatedHashtags.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">{t.relatedHashtags}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {searchResult.relatedHashtags.slice(0, 12).map((tag, i) => {
                                  const cleanTag = tag.replace(/^#/, "");
                                  const isSelected = selectedTrends.includes(cleanTag);
                                  return (
                                    <Badge
                                      key={i}
                                      variant={isSelected ? "default" : "outline"}
                                      className={cn("cursor-pointer text-xs", isSelected ? "" : "hover:bg-muted")}
                                      onClick={() => handleSelectTrend(cleanTag)}
                                    >
                                      #{cleanTag}
                                      {isSelected && <Check className="h-2.5 w-2.5 ml-1" />}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Video Preview */}
                          {searchResult.videos && searchResult.videos.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  {t.topVideos} ({searchResult.videos.length})
                                </p>
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleSaveSearchResults} disabled={saveLoading}>
                                  {saveLoading ? <Spinner className="h-3 w-3 mr-1" /> : <Bookmark className="h-3 w-3 mr-1" />}
                                  {t.save}
                                </Button>
                              </div>
                              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                {searchResult.videos.slice(0, 5).map((video) => (
                                  <a
                                    key={video.id}
                                    href={video.videoUrl || `https://www.tiktok.com/@${video.author.uniqueId}/video/${video.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                                  >
                                    <p className="text-xs line-clamp-1">{video.description || t.noDescription}</p>
                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                      <span>@{video.author.uniqueId}</span>
                                      <span className="flex items-center gap-0.5">
                                        <Eye className="h-2.5 w-2.5" />
                                        {formatNumber(video.stats.playCount)}
                                      </span>
                                      <ExternalLink className="h-2.5 w-2.5 ml-auto opacity-0 group-hover:opacity-100" />
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">{t.searchTiktokTrends}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t.searchExample}</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* Quick tip */}
                  <div className="mt-auto pt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t.tip}</span> {t.tipContent}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Trend Analysis Tab */}
        <TabsContent value="analyze">
          <div className="space-y-6">
            {/* Admin Only: Trend Collection */}
            {isAdmin && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" />
                    {t.adminCollection}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{t.adminCollectionDesc}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="keywords">{t.keywordsLabel}</Label>
                      <Input
                        id="keywords"
                        placeholder={t.keywordsPlaceholder}
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{t.keywordsDesc}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hashtags">{t.hashtagsLabel}</Label>
                      <Input
                        id="hashtags"
                        placeholder={t.hashtagsPlaceholder}
                        value={hashtags}
                        onChange={(e) => setHashtags(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{t.hashtagsDesc}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="explore"
                      checked={includeExplore}
                      onCheckedChange={(checked) => setIncludeExplore(checked === true)}
                    />
                    <Label htmlFor="explore" className="text-sm font-normal">{t.includeDiscover}</Label>
                  </div>

                  <Button onClick={handleCollect} disabled={collectLoading} size="sm">
                    {collectLoading ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        {t.collecting}
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {t.startCollection}
                      </>
                    )}
                  </Button>

                  {/* Collection Results */}
                  {collectResult && (
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center gap-2">
                        {collectResult.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium text-sm">
                          {collectResult.success ? t.collectionSuccess : t.collectionFailed}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">{t.method}</p>
                          <p className="font-medium">{collectResult.method}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">{t.collected}</p>
                          <p className="font-medium">{collectResult.collected_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">{t.savedToDb}</p>
                          <p className="font-medium">{collectResult.saved_count}</p>
                        </div>
                      </div>

                      {collectResult.trends.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-2">{t.top10Trends}</p>
                          <div className="flex flex-wrap gap-1">
                            {collectResult.trends.slice(0, 10).map((trend) => (
                              <Badge key={trend.rank} variant="secondary" className="text-xs">
                                #{trend.rank} {trend.keyword}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Keyword Search */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Search className="h-4 w-4" />
                    {t.keywordSearch}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t.keywordSearchDesc}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t.keywordPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleTrendSearch()}
                    />
                    <Button onClick={handleTrendSearch} disabled={searchLoading} size="icon">
                      {searchLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Hashtag Search */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Hash className="h-4 w-4" />
                    {t.hashtagDetails}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t.hashtagDetailsDesc}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t.hashtagPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
                      onKeyDown={(e) => e.key === "Enter" && handleTrendSearch()}
                    />
                    <Button onClick={handleTrendSearch} disabled={searchLoading} size="icon">
                      {searchLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search Results */}
            {searchResult && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {searchResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      {t.searchResults}
                    </CardTitle>
                    {searchResult.videos && searchResult.videos.length > 0 && (
                      <div className="flex items-center gap-2">
                        {saveResult && (
                          <Badge variant={saveResult.success ? "default" : "destructive"} className="text-xs">
                            {saveResult.message}
                          </Badge>
                        )}
                        <Button onClick={handleSaveSearchResults} disabled={saveLoading} variant="outline" size="sm">
                          {saveLoading ? (
                            <>
                              <Spinner className="h-3 w-3 mr-1" />
                              {t.saving}
                            </>
                          ) : (
                            <>
                              <Database className="h-3 w-3 mr-1" />
                              {t.saveToDatabase}
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
                    <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                      <p className="font-semibold text-lg mb-3">#{searchResult.info.title}</p>
                      <div className="grid grid-cols-2 gap-6 text-base">
                        <div className="flex items-center gap-3">
                          <Eye className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{formatNumber(searchResult.info.viewCount)} {t.views}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Video className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{formatNumber(searchResult.info.videoCount)} {t.videos}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Related Hashtags */}
                  {searchResult.relatedHashtags && searchResult.relatedHashtags.length > 0 && (
                    <div>
                      <p className="text-base font-semibold mb-3">{t.relatedHashtags}:</p>
                      <div className="flex flex-wrap gap-2">
                        {searchResult.relatedHashtags.slice(0, 30).map((tag, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="cursor-pointer hover:bg-muted text-sm px-3 py-1.5"
                            onClick={() => {
                              setSearchQuery(tag.startsWith("#") ? tag : `#${tag}`);
                              handleTrendSearch();
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
                      <p className="text-base font-semibold mb-3">
                        {t.videos} ({searchResult.videos.length}):
                      </p>
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
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
                              className="block p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group border border-border/50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-base leading-relaxed line-clamp-2 flex-1">
                                  {video.description || t.noDescription}
                                </p>
                                <ExternalLink className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                                <span className="font-medium">@{video.author.uniqueId}</span>
                                {(video.stats.playCount ?? 0) > 0 && (
                                  <span className="flex items-center gap-1.5">
                                    <Eye className="h-4 w-4" />
                                    {formatNumber(video.stats.playCount)}
                                  </span>
                                )}
                                {(video.stats.likeCount ?? 0) > 0 && (
                                  <span className="flex items-center gap-1.5">
                                    <Heart className="h-4 w-4" />
                                    {formatNumber(video.stats.likeCount)}
                                  </span>
                                )}
                                {(video.stats.commentCount ?? 0) > 0 && (
                                  <span className="flex items-center gap-1.5">
                                    <MessageCircle className="h-4 w-4" />
                                    {formatNumber(video.stats.commentCount)}
                                  </span>
                                )}
                                {(video.stats.shareCount ?? 0) > 0 && (
                                  <span className="flex items-center gap-1.5">
                                    <Share2 className="h-4 w-4" />
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
                    <div className="text-sm text-destructive">{searchResult.error}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Analyze Trends Section */}
            {searchResult && searchResult.videos && searchResult.videos.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4" />
                    {t.aiAnalysis}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t.aiAnalysisDesc}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">{t.analysisTypeLabel}</Label>
                      <div className="flex gap-1">
                        <Button
                          variant={analysisType === "full" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAnalysisType("full")}
                          disabled={analyzing}
                        >
                          <Target className="h-3 w-3 mr-1" />
                          {t.fullReport}
                        </Button>
                        <Button
                          variant={analysisType === "text" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAnalysisType("text")}
                          disabled={analyzing}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          {t.textOnly}
                        </Button>
                        <Button
                          variant={analysisType === "video" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAnalysisType("video")}
                          disabled={analyzing}
                        >
                          <Film className="h-3 w-3 mr-1" />
                          {t.videoOnly}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={handleAnalyzeTrends} disabled={analyzing} size="sm">
                      {analyzing ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2" />
                          {t.analyzing}
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          {t.analyze} &quot;{lastSearchQuery}&quot;
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analysisType === "full" ? t.fullReportDesc : analysisType === "text" ? t.textOnlyDesc : t.videoOnlyDesc}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Analysis Results */}
            {(trendReport || textAnalysis || videoAnalysis) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" />
                    {t.analysisResults}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={analysisTab} onValueChange={setAnalysisTab}>
                    <TabsList className="mb-4">
                      {trendReport && (
                        <TabsTrigger value="report">
                          <Target className="h-3 w-3 mr-1" />
                          {t.strategyReport}
                        </TabsTrigger>
                      )}
                      {(textAnalysis || (trendReport?.analyses?.text)) && (
                        <TabsTrigger value="text">
                          <FileText className="h-3 w-3 mr-1" />
                          {t.textAnalysisLabel}
                        </TabsTrigger>
                      )}
                      {(videoAnalysis || (trendReport?.analyses?.video)) && (
                        <TabsTrigger value="video">
                          <Film className="h-3 w-3 mr-1" />
                          {t.videoAnalysisLabel}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

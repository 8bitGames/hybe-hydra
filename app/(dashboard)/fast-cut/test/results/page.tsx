"use client";

/**
 * Fast Cut Style Set Test Results Page
 * =====================================
 * View and compare generated test videos
 */

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  ChevronLeft,
  Trash2,
  RefreshCw,
  ExternalLink,
  Download,
  Clock,
  Palette,
  Film,
  Music,
  CheckCircle,
  XCircle,
  Loader2,
  LayoutGrid,
  List,
  Image as ImageIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko, enUS } from "date-fns/locale";

interface TestGeneration {
  id: string;
  status: string;
  progress: number;
  output_url: string | null;
  thumbnail_url: string | null;
  prompt: string;
  aspect_ratio: string;
  duration_seconds: number;
  effect_preset: string | null;
  quality_metadata: {
    fastCutData?: {
      styleSetId?: string;
      vibe?: string;
      effectPreset?: string;
      textStyle?: string;
      colorGrade?: string;
      imageCount?: number;
    };
    imageUrls?: string[];
  } | null;
  error_message: string | null;
  created_at: string;
}

interface StyleSetInfo {
  id: string;
  name: string;
  nameKo: string;
  icon: string;
}

// Style set mapping for display
const STYLE_SETS: Record<string, StyleSetInfo> = {
  viral_tiktok: { id: "viral_tiktok", name: "Viral TikTok", nameKo: "바이럴 틱톡", icon: "🔥" },
  cinematic_mood: { id: "cinematic_mood", name: "Cinematic Mood", nameKo: "시네마틱 무드", icon: "🎬" },
  kpop_energy: { id: "kpop_energy", name: "K-Pop Energy", nameKo: "K-Pop 에너지", icon: "⚡" },
  aesthetic_soft: { id: "aesthetic_soft", name: "Aesthetic Soft", nameKo: "감성 소프트", icon: "🌸" },
  retro_vintage: { id: "retro_vintage", name: "Retro Vintage", nameKo: "레트로 빈티지", icon: "📼" },
  minimal_clean: { id: "minimal_clean", name: "Minimal Clean", nameKo: "미니멀 클린", icon: "✨" },
  dark_dramatic: { id: "dark_dramatic", name: "Dark Dramatic", nameKo: "다크 드라마틱", icon: "🖤" },
  bright_pop: { id: "bright_pop", name: "Bright Pop", nameKo: "브라이트 팝", icon: "🌈" },
};

export default function TestResultsPage() {
  const { language } = useI18n();
  const [generations, setGenerations] = useState<TestGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [styleFilter, setStyleFilter] = useState<string>("all");
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Load test generations
  const loadGenerations = useCallback(async () => {
    setLoading(true);
    try {
      // Get generations without campaign (test mode) or all COMPOSE type
      const response = await api.get<{
        items: TestGeneration[];
        total: number;
      }>("/api/v1/generations?type=COMPOSE&page_size=100&include_test=true");

      if (response.data?.items) {
        // Filter to only test generations (no campaign or test-specific)
        const testGenerations = response.data.items.filter(
          (g) => g.quality_metadata?.fastCutData?.styleSetId
        );
        setGenerations(testGenerations);
      }
    } catch (err) {
      console.error("Failed to load generations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGenerations();
  }, [loadGenerations]);

  // Filter generations
  const filteredGenerations = generations.filter((g) => {
    if (statusFilter !== "all" && g.status.toLowerCase() !== statusFilter) {
      return false;
    }
    if (styleFilter !== "all") {
      const styleSetId = g.quality_metadata?.fastCutData?.styleSetId;
      if (styleSetId !== styleFilter) {
        return false;
      }
    }
    return true;
  });

  // Get unique style sets from generations
  const usedStyleSets = Array.from(
    new Set(
      generations
        .map((g) => g.quality_metadata?.fastCutData?.styleSetId)
        .filter(Boolean)
    )
  ) as string[];

  // Format date
  const formatDate = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: language === "ko" ? ko : enUS,
    });
  };

  // Get status badge
  const getStatusBadge = (status: string, progress: number) => {
    switch (status.toLowerCase()) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {language === "ko" ? "완료" : "Completed"}
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {progress}%
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            {language === "ko" ? "실패" : "Failed"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  // Get style set info
  const getStyleSetInfo = (styleSetId: string | undefined): StyleSetInfo | null => {
    if (!styleSetId) return null;
    return STYLE_SETS[styleSetId] || null;
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/fast-cut/test">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {language === "ko" ? "테스트로 돌아가기" : "Back to Test"}
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">
                {language === "ko" ? "테스트 결과" : "Test Results"}
              </h1>
              <p className="text-sm text-neutral-500">
                {language === "ko"
                  ? `총 ${filteredGenerations.length}개의 테스트 영상`
                  : `${filteredGenerations.length} test videos total`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadGenerations}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {language === "ko" ? "새로고침" : "Refresh"}
            </Button>
            <Link href="/fast-cut/test">
              <Button size="sm" className="bg-neutral-900 text-white">
                {language === "ko" ? "새 테스트" : "New Test"}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Filters */}
        <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-neutral-600">
                {language === "ko" ? "상태" : "Status"}:
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ko" ? "전체" : "All"}
                  </SelectItem>
                  <SelectItem value="completed">
                    {language === "ko" ? "완료" : "Completed"}
                  </SelectItem>
                  <SelectItem value="processing">
                    {language === "ko" ? "처리중" : "Processing"}
                  </SelectItem>
                  <SelectItem value="failed">
                    {language === "ko" ? "실패" : "Failed"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Style Filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-neutral-600">
                {language === "ko" ? "스타일" : "Style"}:
              </Label>
              <Select value={styleFilter} onValueChange={setStyleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ko" ? "전체 스타일" : "All Styles"}
                  </SelectItem>
                  {usedStyleSets.map((styleId) => {
                    const info = getStyleSetInfo(styleId);
                    return (
                      <SelectItem key={styleId} value={styleId}>
                        {info?.icon} {language === "ko" ? info?.nameKo : info?.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-neutral-900" : ""}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-neutral-900" : ""}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredGenerations.length === 0 && (
          <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
            <Film className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              {language === "ko" ? "테스트 결과가 없습니다" : "No test results"}
            </h3>
            <p className="text-sm text-neutral-500 mb-4">
              {language === "ko"
                ? "스타일 세트 테스트 페이지에서 영상을 생성해보세요"
                : "Generate videos from the Style Set Test page"}
            </p>
            <Link href="/fast-cut/test">
              <Button>
                {language === "ko" ? "테스트 시작하기" : "Start Testing"}
              </Button>
            </Link>
          </div>
        )}

        {/* Grid View */}
        {!loading && viewMode === "grid" && filteredGenerations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGenerations.map((gen) => {
              const styleInfo = getStyleSetInfo(
                gen.quality_metadata?.fastCutData?.styleSetId
              );
              const fastCutData = gen.quality_metadata?.fastCutData;

              return (
                <div
                  key={gen.id}
                  className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Video Preview */}
                  <div
                    className={cn(
                      "relative bg-neutral-900",
                      gen.aspect_ratio === "9:16" && "aspect-[9/16]",
                      gen.aspect_ratio === "1:1" && "aspect-square",
                      gen.aspect_ratio === "16:9" && "aspect-video",
                      !gen.aspect_ratio && "aspect-video"
                    )}
                  >
                    {gen.status.toLowerCase() === "completed" && gen.output_url ? (
                      <video
                        src={gen.output_url}
                        poster={gen.thumbnail_url || undefined}
                        controls
                        className="w-full h-full object-contain"
                        onPlay={() => setPlayingVideoId(gen.id)}
                        onPause={() => setPlayingVideoId(null)}
                      />
                    ) : gen.quality_metadata?.imageUrls?.[0] ? (
                      <img
                        src={gen.quality_metadata.imageUrls[0]}
                        alt="Preview"
                        className="w-full h-full object-cover opacity-60"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-neutral-600" />
                      </div>
                    )}

                    {/* Status Overlay */}
                    {gen.status.toLowerCase() !== "completed" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        {gen.status.toLowerCase() === "processing" ? (
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 text-white animate-spin mx-auto mb-2" />
                            <span className="text-white text-sm">{gen.progress}%</span>
                          </div>
                        ) : (
                          <XCircle className="h-8 w-8 text-red-400" />
                        )}
                      </div>
                    )}

                    {/* Style Badge */}
                    {styleInfo && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-black/60 text-white backdrop-blur-sm text-xs">
                          {styleInfo.icon} {language === "ko" ? styleInfo.nameKo : styleInfo.name}
                        </Badge>
                      </div>
                    )}

                    {/* Aspect Ratio Badge */}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-black/60 text-white text-[10px]">
                        {gen.aspect_ratio || "16:9"}
                      </Badge>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      {getStatusBadge(gen.status, gen.progress)}
                      <span className="text-xs text-neutral-500">
                        {formatDate(gen.created_at)}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      {fastCutData?.imageCount && (
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {fastCutData.imageCount}
                        </span>
                      )}
                      {gen.duration_seconds > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {gen.duration_seconds}s
                        </span>
                      )}
                    </div>

                    {/* Error Message */}
                    {gen.error_message && (
                      <p className="text-xs text-red-600 mt-2 truncate">
                        {gen.error_message}
                      </p>
                    )}

                    {/* Actions */}
                    {gen.status.toLowerCase() === "completed" && gen.output_url && (
                      <div className="flex gap-1 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => window.open(gen.output_url!, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {language === "ko" ? "열기" : "Open"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          asChild
                        >
                          <a href={gen.output_url} download>
                            <Download className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {!loading && viewMode === "list" && filteredGenerations.length > 0 && (
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                      {language === "ko" ? "미리보기" : "Preview"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                      {language === "ko" ? "스타일" : "Style"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                      {language === "ko" ? "상태" : "Status"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                      {language === "ko" ? "비율" : "Ratio"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                      {language === "ko" ? "이미지" : "Images"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                      {language === "ko" ? "생성일" : "Created"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500">
                      {language === "ko" ? "액션" : "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredGenerations.map((gen) => {
                    const styleInfo = getStyleSetInfo(
                      gen.quality_metadata?.fastCutData?.styleSetId
                    );
                    const fastCutData = gen.quality_metadata?.fastCutData;

                    return (
                      <tr key={gen.id} className="hover:bg-neutral-50">
                        {/* Preview */}
                        <td className="px-4 py-3">
                          <div className="w-16 h-16 bg-neutral-100 rounded overflow-hidden">
                            {gen.thumbnail_url || gen.quality_metadata?.imageUrls?.[0] ? (
                              <img
                                src={gen.thumbnail_url || gen.quality_metadata?.imageUrls?.[0]}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="h-6 w-6 text-neutral-400" />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Style */}
                        <td className="px-4 py-3">
                          {styleInfo ? (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{styleInfo.icon}</span>
                              <span className="text-sm font-medium">
                                {language === "ko" ? styleInfo.nameKo : styleInfo.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-400">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {getStatusBadge(gen.status, gen.progress)}
                        </td>

                        {/* Aspect Ratio */}
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {gen.aspect_ratio || "16:9"}
                          </Badge>
                        </td>

                        {/* Image Count */}
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {fastCutData?.imageCount || "-"}
                        </td>

                        {/* Created At */}
                        <td className="px-4 py-3 text-sm text-neutral-500">
                          {formatDate(gen.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {gen.status.toLowerCase() === "completed" && gen.output_url && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(gen.output_url!, "_blank")}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={gen.output_url} download>
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

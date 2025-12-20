"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  Video,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Calendar,
  Clock,
  Music,
  Image,
  FileText,
  Palette,
  Hash,
  Target,
  Layers,
} from "lucide-react";
import type {
  CreationSession,
  SessionStatus,
  EntrySource,
  StageData,
  ScriptStageData,
  ImagesStageData,
  MusicStageData,
  EffectsStageData,
  RenderStageData,
} from "@/lib/stores/session-store";
import type { WorkflowStage, StartData, AnalyzeData, CreateData, ProcessingData, PublishData } from "@/lib/stores/workflow-store";

// ============================================================================
// Types
// ============================================================================

interface SessionDetailModalProps {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
}

interface FullSession {
  id: string;
  userId: string;
  campaignId: string | null;
  status: SessionStatus;
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];
  stageData: StageData;
  metadata: {
    entrySource: EntrySource | null;
    contentType: "ai_video" | "fast-cut" | null;
    totalGenerations: number;
    approvedVideos: number;
    title: string;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

const dbRowToFullSession = (row: Record<string, unknown>): FullSession => ({
  id: row.id as string,
  userId: row.user_id as string,
  campaignId: row.campaign_id as string | null,
  status: row.status as SessionStatus,
  currentStage: row.current_stage as WorkflowStage,
  completedStages: (row.completed_stages as WorkflowStage[]) || [],
  stageData: {
    start: row.start_data as StartData | null,
    analyze: row.analyze_data as AnalyzeData | null,
    create: row.create_data as CreateData | null,
    processing: row.processing_data as ProcessingData | null,
    publish: row.publish_data as PublishData | null,
    script: row.script_data as ScriptStageData | null,
    images: row.images_data as ImagesStageData | null,
    music: row.music_data as MusicStageData | null,
    effects: row.effects_data as EffectsStageData | null,
    render: row.render_data as RenderStageData | null,
  },
  metadata: {
    entrySource: row.entry_source as EntrySource | null,
    contentType: row.content_type as "ai_video" | "fast-cut" | null,
    totalGenerations: (row.total_generations as number) || 0,
    approvedVideos: (row.approved_videos as number) || 0,
    title: (row.title as string) || "",
  },
  createdAt: new Date(row.created_at as string),
  updatedAt: new Date(row.updated_at as string),
  completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
});

// ============================================================================
// Sub Components
// ============================================================================

// Helper to safely convert any value to a displayable string
function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    // Handle arrays - join elements with space
    return value.map(item => safeString(item)).join(' ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Try to extract meaningful text from object
    if (obj.keyword) return safeString(obj.keyword);
    if (obj.text) return safeString(obj.text);
    if (obj.name) return safeString(obj.name);
    if (obj.value) return safeString(obj.value);
    if (obj.title) return safeString(obj.title);
    if (obj.niche) return safeString(obj.niche);
    if (obj.category) return safeString(obj.category);
    if (obj.descriptive) return safeString(obj.descriptive);
    // Fallback to JSON
    return JSON.stringify(value);
  }
  return String(value);
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 text-neutral-400 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        <div className="text-sm text-neutral-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-neutral-600" />
      <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
    </div>
  );
}

function KeywordBadges({ keywords, maxShow = 10 }: { keywords: unknown[]; maxShow?: number }) {
  if (!keywords?.length) return <span className="text-neutral-400 text-sm">-</span>;
  const displayKeywords = keywords.slice(0, maxShow);
  const remaining = keywords.length - maxShow;

  // Helper to convert any value to displayable string
  const toDisplayString = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (value && typeof value === 'object') {
      // Handle object with common text fields
      const obj = value as Record<string, unknown>;
      if (obj.keyword) return String(obj.keyword);
      if (obj.text) return String(obj.text);
      if (obj.name) return String(obj.name);
      if (obj.value) return String(obj.value);
      // For objects like {niche, category, descriptive}, show first available
      if (obj.niche) return String(obj.niche);
      if (obj.category) return String(obj.category);
      if (obj.descriptive) return String(obj.descriptive);
      // Fallback to JSON
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayKeywords.map((keyword, idx) => (
        <Badge key={idx} variant="secondary" className="text-xs">
          {toDisplayString(keyword)}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs text-neutral-400">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}

function ImageGrid({ images, maxShow = 6 }: { images: unknown[]; maxShow?: number }) {
  if (!images?.length) return <span className="text-neutral-400 text-sm">-</span>;

  const displayImages = images.slice(0, maxShow);
  const remaining = images.length - maxShow;

  // Helper to extract URL from various image object formats
  const getImageUrl = (img: unknown): string => {
    if (typeof img === 'string') return img;
    if (!img || typeof img !== 'object') return '';
    const obj = img as Record<string, unknown>;
    // Try various common URL field names (ImageCandidate uses sourceUrl/thumbnailUrl)
    const url = (
      (obj.sourceUrl as string) ||
      (obj.thumbnailUrl as string) ||
      (obj.url as string) ||
      (obj.imageUrl as string) ||
      (obj.src as string) ||
      (obj.thumbnail as string) ||
      (obj.image as string) ||
      (obj.link as string) ||
      (obj.href as string) ||
      ''
    );
    return url;
  };

  // Debug first image
  console.log("[ImageGrid] Total images:", images.length, "Displaying:", displayImages.length);
  if (displayImages[0]) {
    console.log("[ImageGrid] First image type:", typeof displayImages[0]);
    if (typeof displayImages[0] === 'object') {
      console.log("[ImageGrid] First image keys:", Object.keys(displayImages[0] as object));
    }
    console.log("[ImageGrid] First image URL extracted:", getImageUrl(displayImages[0]));
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
      {displayImages.map((img: unknown, idx: number) => {
        const url = getImageUrl(img);
        return (
          <div key={idx} className="aspect-square rounded-md overflow-hidden bg-neutral-100">
            {url ? (
              <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image className="h-4 w-4 text-neutral-300" />
              </div>
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <div className="aspect-square rounded-md bg-neutral-100 flex items-center justify-center">
          <span className="text-xs text-neutral-400">+{remaining}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI Video Detail View
// ============================================================================

function AIVideoDetailView({ session, language }: { session: FullSession; language: string }) {
  const startData = session.stageData.start as StartData | null;
  const analyzeData = session.stageData.analyze as AnalyzeData | null;
  const createData = session.stageData.create as CreateData | null;
  const processingData = session.stageData.processing as ProcessingData | null;

  // Debug log
  console.log("[AIVideoDetailView] Full stage data:", {
    startData: startData ? JSON.stringify(startData, null, 2).slice(0, 1000) : null,
    analyzeData: analyzeData ? JSON.stringify(analyzeData, null, 2).slice(0, 1000) : null,
    createData: createData ? JSON.stringify(createData, null, 2).slice(0, 1000) : null,
    processingData: processingData ? JSON.stringify(processingData, null, 2).slice(0, 1000) : null,
  });

  // Check if we have any data at all
  const hasStartData = startData !== null;
  const hasAnalyzeData = analyzeData !== null;
  const hasCreateData = createData !== null;
  const hasProcessingData = processingData !== null || session.metadata.totalGenerations > 0;
  const hasAnyData = hasStartData || hasAnalyzeData || hasCreateData || hasProcessingData;

  if (!hasAnyData) {
    return (
      <div className="py-8 text-center">
        <p className="text-neutral-400 text-sm">
          {language === "ko" ? "저장된 상세 정보가 없습니다." : "No detailed information available."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source Info */}
      {hasStartData && startData && (
        <div>
          <SectionHeader
            title={language === "ko" ? "소스 정보" : "Source Info"}
            icon={Target}
          />
          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            {startData.source && (
              <>
                <InfoRow
                  label={language === "ko" ? "소스 유형" : "Source Type"}
                  value={
                    <Badge variant="outline">
                      {startData.source.type === "video" && (language === "ko" ? "영상에서" : "From Video")}
                      {startData.source.type === "trends" && (language === "ko" ? "트렌드에서" : "From Trends")}
                      {startData.source.type === "idea" && (language === "ko" ? "아이디어에서" : "From Idea")}
                    </Badge>
                  }
                />
                {startData.source.type === "video" && (startData.source as { videoUrl?: string }).videoUrl && (
                  <InfoRow
                    label={language === "ko" ? "영상 URL" : "Video URL"}
                    value={<span className="text-xs break-all">{(startData.source as { videoUrl: string }).videoUrl}</span>}
                    icon={Video}
                  />
                )}
                {startData.source.type === "video" && (startData.source as { description?: string }).description && (
                  <InfoRow
                    label={language === "ko" ? "영상 설명" : "Video Description"}
                    value={<span className="text-xs line-clamp-3">{(startData.source as { description: string }).description}</span>}
                  />
                )}
                {startData.source.type === "video" && (startData.source as { aiAnalysis?: { hookAnalysis?: string } }).aiAnalysis?.hookAnalysis && (
                  <InfoRow
                    label={language === "ko" ? "훅 분석" : "Hook Analysis"}
                    value={<span className="text-xs">{(startData.source as { aiAnalysis: { hookAnalysis: string } }).aiAnalysis.hookAnalysis}</span>}
                  />
                )}
                {startData.source.type === "idea" && (startData.source as { idea?: string }).idea && (
                  <InfoRow
                    label={language === "ko" ? "아이디어" : "Idea"}
                    value={(startData.source as { idea: string }).idea}
                    icon={Lightbulb}
                  />
                )}
                {startData.source.type === "trends" && (startData.source as { keywords?: string[] }).keywords && (
                  <InfoRow
                    label={language === "ko" ? "트렌드 키워드" : "Trend Keywords"}
                    value={<KeywordBadges keywords={(startData.source as { keywords: string[] }).keywords} />}
                    icon={Hash}
                  />
                )}
              </>
            )}
            {startData.selectedHashtags && startData.selectedHashtags.length > 0 && (
              <InfoRow
                label={language === "ko" ? "선택된 해시태그" : "Selected Hashtags"}
                value={<KeywordBadges keywords={startData.selectedHashtags} />}
                icon={Hash}
              />
            )}
            {startData.aiInsights?.summary && (
              <InfoRow
                label={language === "ko" ? "AI 인사이트" : "AI Insights"}
                value={<span className="text-xs">{startData.aiInsights.summary}</span>}
              />
            )}
          </div>
        </div>
      )}

      {/* Analyze Stage - Campaign & Ideas */}
      {hasAnalyzeData && analyzeData && (
        <div>
          <SectionHeader
            title={language === "ko" ? "분석 & 아이디어" : "Analysis & Ideas"}
            icon={FileText}
          />
          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            {analyzeData.campaignName && (
              <InfoRow
                label={language === "ko" ? "캠페인" : "Campaign"}
                value={analyzeData.campaignName}
              />
            )}
            {analyzeData.artistName && (
              <InfoRow
                label={language === "ko" ? "아티스트" : "Artist"}
                value={analyzeData.artistStageName || analyzeData.artistName}
              />
            )}
            {analyzeData.userIdea && (
              <InfoRow
                label={language === "ko" ? "사용자 아이디어" : "User Idea"}
                value={<span className="text-xs">{analyzeData.userIdea}</span>}
              />
            )}
            {analyzeData.selectedIdea && (
              <div className="space-y-2">
                <InfoRow
                  label={language === "ko" ? "선택된 콘텐츠 아이디어" : "Selected Content Idea"}
                  value={
                    <div className="text-xs space-y-1">
                      <p className="font-medium">{analyzeData.selectedIdea.title}</p>
                      {analyzeData.selectedIdea.hook && <p className="text-neutral-500">Hook: {analyzeData.selectedIdea.hook}</p>}
                      {analyzeData.selectedIdea.description && <p className="text-neutral-600">{analyzeData.selectedIdea.description}</p>}
                    </div>
                  }
                />
              </div>
            )}
            {analyzeData.optimizedPrompt && (
              <InfoRow
                label={language === "ko" ? "최적화된 프롬프트" : "Optimized Prompt"}
                value={<span className="text-xs whitespace-pre-wrap max-h-32 overflow-y-auto block">{analyzeData.optimizedPrompt}</span>}
              />
            )}
            {analyzeData.imagePrompt && (
              <InfoRow
                label={language === "ko" ? "이미지 프롬프트" : "Image Prompt"}
                value={<span className="text-xs whitespace-pre-wrap">{analyzeData.imagePrompt}</span>}
              />
            )}
            {analyzeData.previewImage?.imageUrl && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">{language === "ko" ? "미리보기 이미지" : "Preview Image"}</p>
                <div className="w-32 h-32 rounded-md overflow-hidden bg-neutral-100">
                  <img src={analyzeData.previewImage.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
            {analyzeData.settings && (
              <InfoRow
                label={language === "ko" ? "설정" : "Settings"}
                value={
                  <span className="text-xs">
                    {analyzeData.settings.aspectRatio} • {analyzeData.settings.duration}s • {analyzeData.settings.fps}fps
                  </span>
                }
              />
            )}
            {analyzeData.hashtags && analyzeData.hashtags.length > 0 && (
              <InfoRow
                label={language === "ko" ? "해시태그" : "Hashtags"}
                value={<KeywordBadges keywords={analyzeData.hashtags} />}
                icon={Hash}
              />
            )}
            {analyzeData.assets && analyzeData.assets.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">{language === "ko" ? `에셋 (${analyzeData.assets.length}개)` : `Assets (${analyzeData.assets.length})`}</p>
                <div className="grid grid-cols-4 gap-2">
                  {analyzeData.assets.slice(0, 8).map((asset, idx) => (
                    <div key={idx} className="aspect-square rounded-md overflow-hidden bg-neutral-100">
                      {asset.type === "image" ? (
                        <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs text-neutral-400">{asset.type}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Stage - Generations */}
      {hasCreateData && createData && (
        <div>
          <SectionHeader
            title={language === "ko" ? "생성 정보" : "Generation Info"}
            icon={Layers}
          />
          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            {createData.creationType && (
              <InfoRow
                label={language === "ko" ? "생성 유형" : "Generation Type"}
                value={<Badge variant="outline">{createData.creationType === "ai" ? "AI Video" : "Fast Cut"}</Badge>}
              />
            )}
            {createData.generations && createData.generations.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">
                  {language === "ko" ? `생성된 영상 (${createData.generations.length}개)` : `Generated Videos (${createData.generations.length})`}
                </p>
                <div className="space-y-2">
                  {createData.generations.slice(0, 5).map((gen, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                      {gen.thumbnailUrl && (
                        <div className="w-16 h-9 rounded overflow-hidden bg-neutral-100 flex-shrink-0">
                          <img src={gen.thumbnailUrl} alt={`Gen ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={gen.status === "completed" ? "default" : gen.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                            {gen.status}
                          </Badge>
                          {gen.qualityScore && <span className="text-xs text-neutral-500">Quality: {gen.qualityScore}</span>}
                        </div>
                        {gen.prompt && <p className="text-xs text-neutral-600 truncate mt-1">{gen.prompt}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing Results */}
      {hasProcessingData && (
        <div>
          <SectionHeader
            title={language === "ko" ? "처리 결과" : "Processing Results"}
            icon={Video}
          />
          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            {session.metadata.totalGenerations > 0 && (
              <InfoRow
                label={language === "ko" ? "총 생성" : "Total Generated"}
                value={session.metadata.totalGenerations}
              />
            )}
            {session.metadata.approvedVideos > 0 && (
              <InfoRow
                label={language === "ko" ? "승인된 영상" : "Approved Videos"}
                value={session.metadata.approvedVideos}
              />
            )}
            {processingData?.videos && processingData.videos.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">
                  {language === "ko" ? `처리된 영상 (${processingData.videos.length}개)` : `Processed Videos (${processingData.videos.length})`}
                </p>
                <div className="space-y-2">
                  {processingData.videos.slice(0, 5).map((video, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                      {video.thumbnailUrl && (
                        <div className="w-16 h-9 rounded overflow-hidden bg-neutral-100 flex-shrink-0">
                          <img src={video.thumbnailUrl} alt={`Video ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={video.status === "approved" || video.status === "completed" ? "default" : video.status === "failed" || video.status === "rejected" ? "destructive" : "secondary"} className="text-xs">
                            {video.status}
                          </Badge>
                          {video.qualityScore && <span className="text-xs text-neutral-500">Quality: {video.qualityScore}</span>}
                        </div>
                        {video.prompt && <p className="text-xs text-neutral-600 truncate mt-1">{video.prompt}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Fast Cut Detail View
// ============================================================================

function FastCutDetailView({ session, language }: { session: FullSession; language: string }) {
  const scriptData = session.stageData.script as ScriptStageData | null;
  const imagesData = session.stageData.images as ImagesStageData | null;
  const musicData = session.stageData.music as MusicStageData | null;
  const effectsData = session.stageData.effects as EffectsStageData | null;

  // Debug log
  console.log("[FastCutDetailView] Stage data:", { scriptData, imagesData, musicData, effectsData });
  console.log("[FastCutDetailView] Images data detail:", {
    selectedImages: imagesData?.selectedImages,
    imageCandidates: imagesData?.imageCandidates,
    firstSelectedImage: imagesData?.selectedImages?.[0],
    firstCandidate: imagesData?.imageCandidates?.[0],
  });

  // Check if any stage data object exists (even if partially filled)
  const hasScriptData = scriptData !== null && typeof scriptData === 'object';
  const hasImagesData = imagesData !== null && typeof imagesData === 'object';
  const hasMusicData = musicData !== null && typeof musicData === 'object';
  const hasEffectsData = effectsData !== null && typeof effectsData === 'object';

  const hasAnyData = hasScriptData || hasImagesData || hasMusicData || hasEffectsData;

  if (!hasAnyData) {
    return (
      <div className="py-8 text-center">
        <p className="text-neutral-400 text-sm">
          {language === "ko" ? "저장된 상세 정보가 없습니다." : "No detailed information available."}
        </p>
        <p className="text-neutral-300 text-xs mt-2">
          {language === "ko"
            ? "(완료된 세션의 상세 데이터가 DB에 저장되지 않았을 수 있습니다)"
            : "(Completed session data may not have been saved to DB)"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Script Info */}
      {hasScriptData && scriptData && (
        <div>
          <SectionHeader
            title={language === "ko" ? "스크립트 정보" : "Script Info"}
            icon={FileText}
          />
          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            {scriptData.prompt && (
              <InfoRow
                label={language === "ko" ? "프롬프트" : "Prompt"}
                value={
                  typeof scriptData.prompt === 'string' ? (
                    <span className="text-sm whitespace-pre-wrap">{scriptData.prompt}</span>
                  ) : (
                    <div className="text-sm space-y-1">
                      {safeString((scriptData.prompt as { niche?: unknown }).niche) && (
                        <p><strong>Niche:</strong> {safeString((scriptData.prompt as { niche: unknown }).niche)}</p>
                      )}
                      {safeString((scriptData.prompt as { category?: unknown }).category) && (
                        <p><strong>Category:</strong> {safeString((scriptData.prompt as { category: unknown }).category)}</p>
                      )}
                      {safeString((scriptData.prompt as { descriptive?: unknown }).descriptive) && (
                        <p><strong>Description:</strong> {safeString((scriptData.prompt as { descriptive: unknown }).descriptive)}</p>
                      )}
                    </div>
                  )
                }
              />
            )}
            {scriptData.aspectRatio && (
              <InfoRow
                label={language === "ko" ? "화면 비율" : "Aspect Ratio"}
                value={<Badge variant="outline">{safeString(scriptData.aspectRatio)}</Badge>}
              />
            )}
            {scriptData.editableKeywords && scriptData.editableKeywords.length > 0 && (
              <InfoRow
                label={language === "ko" ? "편집 키워드" : "Editable Keywords"}
                value={<KeywordBadges keywords={scriptData.editableKeywords} />}
                icon={Hash}
              />
            )}
            {scriptData.selectedSearchKeywords && scriptData.selectedSearchKeywords.length > 0 && (
              <InfoRow
                label={language === "ko" ? "검색 키워드" : "Search Keywords"}
                value={<KeywordBadges keywords={scriptData.selectedSearchKeywords} />}
                icon={Hash}
              />
            )}
            {/* Show scriptData content if exists */}
            {!!scriptData.scriptData && (
              <InfoRow
                label={language === "ko" ? "생성된 스크립트" : "Generated Script"}
                value={
                  <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                    {typeof scriptData.scriptData === 'object' && (scriptData.scriptData as { scenes?: Array<{ text?: string }> }).scenes ? (
                      (scriptData.scriptData as { scenes: Array<{ text?: string }> }).scenes.map((scene, idx) => (
                        <p key={idx} className="text-neutral-600">{idx + 1}. {scene.text || JSON.stringify(scene)}</p>
                      ))
                    ) : (
                      <pre className="text-neutral-600 whitespace-pre-wrap">{JSON.stringify(scriptData.scriptData, null, 2)}</pre>
                    )}
                  </div>
                }
              />
            )}
            {!!scriptData.tiktokSEO && (
              <InfoRow
                label="TikTok SEO"
                value={
                  <div className="text-xs space-y-1">
                    {safeString((scriptData.tiktokSEO as { title?: unknown })?.title) && (
                      <p><strong>Title:</strong> {safeString((scriptData.tiktokSEO as { title?: unknown }).title)}</p>
                    )}
                    {safeString((scriptData.tiktokSEO as { description?: unknown })?.description) && (
                      <p><strong>Description:</strong> {safeString((scriptData.tiktokSEO as { description?: unknown }).description)}</p>
                    )}
                    {safeString((scriptData.tiktokSEO as { hashtags?: unknown })?.hashtags) && (
                      <p><strong>Hashtags:</strong> {safeString((scriptData.tiktokSEO as { hashtags?: unknown }).hashtags)}</p>
                    )}
                  </div>
                }
              />
            )}
            {scriptData.generationId && (
              <InfoRow
                label={language === "ko" ? "생성 ID" : "Generation ID"}
                value={<span className="text-xs font-mono">{safeString(scriptData.generationId)}</span>}
              />
            )}
          </div>
        </div>
      )}

      {/* Images */}
      {hasImagesData && imagesData && (
        <div>
          <SectionHeader
            title={language === "ko"
              ? `이미지 정보${imagesData.selectedImages?.length ? ` (${imagesData.selectedImages.length}개 선택)` : ''}`
              : `Images Info${imagesData.selectedImages?.length ? ` (${imagesData.selectedImages.length} selected)` : ''}`}
            icon={Image}
          />
          <div className="bg-neutral-50 rounded-lg p-4 space-y-4">
            {/* Debug: Show raw imagesData keys */}
            {(() => {
              console.log("[FastCutDetailView] imagesData keys:", Object.keys(imagesData));
              console.log("[FastCutDetailView] imagesData full:", JSON.stringify(imagesData, null, 2).slice(0, 2000));
              if (imagesData.selectedImages?.[0]) {
                console.log("[FastCutDetailView] First selectedImage keys:", Object.keys(imagesData.selectedImages[0] as object));
                console.log("[FastCutDetailView] First selectedImage:", JSON.stringify(imagesData.selectedImages[0], null, 2));
              }
              return null;
            })()}
            {/* Selected Images */}
            {imagesData.selectedImages && imagesData.selectedImages.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">{language === "ko" ? "선택된 이미지" : "Selected Images"}</p>
                <ImageGrid images={imagesData.selectedImages} maxShow={12} />
              </div>
            )}
            {/* Candidate Images */}
            {imagesData.imageCandidates && imagesData.imageCandidates.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">
                  {language === "ko"
                    ? `검색된 후보 이미지 (${imagesData.imageCandidates.length}개)`
                    : `Candidate Images (${imagesData.imageCandidates.length})`}
                </p>
                <ImageGrid images={imagesData.imageCandidates} maxShow={18} />
              </div>
            )}
            {imagesData.generationId && (
              <InfoRow
                label={language === "ko" ? "생성 ID" : "Generation ID"}
                value={<span className="text-xs font-mono">{safeString(imagesData.generationId)}</span>}
              />
            )}
          </div>
        </div>
      )}

      {/* Music */}
      {hasMusicData && musicData && (
        <div>
          <SectionHeader
            title={language === "ko" ? "음악 정보" : "Music Info"}
            icon={Music}
          />
          <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
            {musicData.musicSkipped ? (
              <p className="text-sm text-neutral-500">{language === "ko" ? "음악 없음 (스킵됨)" : "No music (skipped)"}</p>
            ) : musicData.selectedAudio ? (
              <>
                <InfoRow
                  label={language === "ko" ? "선택된 음악" : "Selected Music"}
                  value={
                    (musicData.selectedAudio as { filename?: string; title?: string; name?: string })?.filename ||
                    (musicData.selectedAudio as { filename?: string; title?: string; name?: string })?.title ||
                    (musicData.selectedAudio as { filename?: string; title?: string; name?: string })?.name ||
                    "Unknown"
                  }
                />
                {(musicData.selectedAudio as { bpm?: number })?.bpm && (
                  <InfoRow
                    label="BPM"
                    value={(musicData.selectedAudio as { bpm: number }).bpm}
                  />
                )}
                {(musicData.selectedAudio as { vibe?: string })?.vibe && (
                  <InfoRow
                    label={language === "ko" ? "분위기" : "Vibe"}
                    value={(musicData.selectedAudio as { vibe: string }).vibe}
                  />
                )}
                {(musicData.selectedAudio as { genre?: string })?.genre && (
                  <InfoRow
                    label={language === "ko" ? "장르" : "Genre"}
                    value={(musicData.selectedAudio as { genre: string }).genre}
                  />
                )}
                {musicData.audioStartTime !== undefined && musicData.audioStartTime > 0 && (
                  <InfoRow
                    label={language === "ko" ? "시작 시간" : "Start Time"}
                    value={`${musicData.audioStartTime.toFixed(1)}s`}
                  />
                )}
                {musicData.videoDuration !== undefined && musicData.videoDuration > 0 && (
                  <InfoRow
                    label={language === "ko" ? "영상 길이" : "Video Duration"}
                    value={`${musicData.videoDuration.toFixed(1)}s`}
                  />
                )}
              </>
            ) : (
              <p className="text-sm text-neutral-400">{language === "ko" ? "음악 미선택" : "No music selected"}</p>
            )}
            {musicData.audioMatches && musicData.audioMatches.length > 0 && (
              <InfoRow
                label={language === "ko" ? "검색된 음악" : "Audio Matches"}
                value={`${musicData.audioMatches.length}${language === "ko" ? "개" : " tracks"}`}
              />
            )}
          </div>
        </div>
      )}

      {/* Effects */}
      {hasEffectsData && effectsData && (
        <div>
          <SectionHeader
            title={language === "ko" ? "효과 설정" : "Effects Settings"}
            icon={Palette}
          />
          <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
            {effectsData.styleSetId && (
              <InfoRow
                label={language === "ko" ? "스타일셋" : "Style Set"}
                value={<Badge variant="outline">{safeString(effectsData.styleSetId)}</Badge>}
              />
            )}
            {effectsData.styleSets && effectsData.styleSets.length > 0 && (
              <InfoRow
                label={language === "ko" ? "사용 가능한 스타일" : "Available Styles"}
                value={`${effectsData.styleSets.length}${language === "ko" ? "개" : " styles"}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// Fast Cut only stages for content type inference
const FAST_CUT_ONLY_STAGES = ["script", "images", "music", "effects", "render"];

export function SessionDetailModal({ sessionId, open, onClose }: SessionDetailModalProps) {
  const { language } = useI18n();
  const [session, setSession] = useState<FullSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load full session data when modal opens
  useEffect(() => {
    if (!sessionId || !open) {
      setSession(null);
      setError(null);
      return;
    }

    const loadSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("creation_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Session not found");

        const fullSession = dbRowToFullSession(data);

        // Debug: Log the loaded session data
        console.log("[SessionDetailModal] Loaded session:", {
          id: fullSession.id,
          contentType: fullSession.metadata.contentType,
          currentStage: fullSession.currentStage,
          completedStages: fullSession.completedStages,
          stageData: fullSession.stageData,
        });

        setSession(fullSession);
      } catch (err) {
        console.error("[SessionDetailModal] Failed to load session:", err);
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [sessionId, open]);

  // Infer content type using same logic as SessionDashboard
  const isFastCut = session ? (
    session.metadata.contentType === "fast-cut" ||
    FAST_CUT_ONLY_STAGES.includes(session.currentStage) ||
    session.completedStages?.some(stage => FAST_CUT_ONLY_STAGES.includes(stage)) ||
    // Also check if any Fast Cut stage data exists
    session.stageData.script !== null ||
    session.stageData.images !== null ||
    session.stageData.music !== null ||
    session.stageData.effects !== null
  ) : false;

  const entrySourceLabels: Record<string, { ko: string; en: string }> = {
    trends: { ko: "트렌드에서", en: "From Trends" },
    video: { ko: "영상에서", en: "From Video" },
    idea: { ko: "아이디어에서", en: "From Idea" },
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[80vw] max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              isFastCut ? "bg-purple-100" : "bg-neutral-900"
            )}>
              {isFastCut ? (
                <Sparkles className="h-4 w-4 text-purple-600" />
              ) : (
                <Video className="h-4 w-4 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">
                {session?.metadata.title || (language === "ko" ? "세션 상세" : "Session Details")}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {isFastCut ? "Fast Cut" : (language === "ko" ? "AI 영상" : "AI Video")}
                </Badge>
                {session?.metadata.entrySource && (
                  <span className="text-xs text-neutral-500 flex items-center gap-1">
                    {session.metadata.entrySource === "trends" && <TrendingUp className="h-3 w-3" />}
                    {session.metadata.entrySource === "video" && <Video className="h-3 w-3" />}
                    {session.metadata.entrySource === "idea" && <Lightbulb className="h-3 w-3" />}
                    {entrySourceLabels[session.metadata.entrySource]?.[language === "ko" ? "ko" : "en"]}
                  </span>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Separator />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        ) : session ? (
          <ScrollArea className="flex-1 min-h-0 pr-4">
            <div className="py-4">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {language === "ko" ? "생성일: " : "Created: "}
                    {session.createdAt.toLocaleDateString()}
                  </span>
                </div>
                {session.completedAt && (
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Clock className="h-4 w-4" />
                    <span>
                      {language === "ko" ? "완료일: " : "Completed: "}
                      {session.completedAt.toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Content based on type */}
              {isFastCut ? (
                <FastCutDetailView session={session} language={language} />
              ) : (
                <AIVideoDetailView session={session} language={language} />
              )}
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default SessionDetailModal;

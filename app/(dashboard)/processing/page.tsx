"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCampaigns } from "@/lib/queries";
import { videoApi, VideoGeneration } from "@/lib/video-api";
import { useQuery } from "@tanstack/react-query";
import { useWorkflowSync, useWorkflowNavigation } from "@/lib/hooks/useWorkflowNavigation";
import { useWorkflowStore, ProcessingVideo, useWorkflowHydrated } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Search,
  ArrowRight,
  ArrowLeft,
  Video,
  Play,
  Clock,
  Music,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutGrid,
  List,
  Info,
  FileVideo,
  Maximize2,
  ThumbsUp,
  ThumbsDown,
  Send,
  Eye,
  Film,
  Pause,
  Volume2,
  VolumeX,
  Settings2,
  Download,
  ExternalLink,
  Trash2,
  CheckCheck,
  X,
  Image,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { LazyVideo } from "@/components/ui/lazy-video";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";

type StatusFilter = "all" | "processing" | "completed" | "approved" | "rejected";
type ViewMode = "grid" | "list";
type SortBy = "newest" | "oldest" | "status";

// Video Detail Modal Component - Ultra Wide Screen Design
function VideoDetailModal({
  video,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  video: ProcessingVideo | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Reset states when video changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [video?.id]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      videoRef.current.currentTime = percentage * duration;
    }
  }, [duration]);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!video) return null;

  const statusConfig = {
    processing: { label: isKorean ? "처리중" : "Processing", icon: Loader2, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    completed: { label: isKorean ? "검토 대기" : "Pending Review", icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    failed: { label: isKorean ? "실패" : "Failed", icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    approved: { label: isKorean ? "승인됨" : "Approved", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    rejected: { label: isKorean ? "거부됨" : "Rejected", icon: XCircle, color: "text-neutral-500", bg: "bg-neutral-100 border-neutral-300" },
  };

  const status = statusConfig[video.status];
  const StatusIcon = status.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[95vw] !w-[1400px] h-[90vh] p-0 gap-0 overflow-hidden bg-white border border-neutral-200 rounded-2xl" showCloseButton={false}>
        {/* Hidden Dialog Title for accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>{isKorean ? "영상 상세" : "Video Details"}</DialogTitle>
        </DialogHeader>

        {/* Main Layout - Horizontal Split */}
        <div className="flex h-full overflow-hidden">
          {/* Left: Video Player */}
          <div className="w-[45%] h-full bg-neutral-950 flex flex-col shrink-0">
            {/* Video Container */}
            <div className="flex-1 min-h-0 flex items-center justify-center p-6" onClick={togglePlay}>
              {video.outputUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={video.outputUrl}
                    className="max-h-full max-w-full object-contain rounded-lg"
                    loop
                    playsInline
                    muted={isMuted}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                  />
                  {/* Center Play Button (when paused) */}
                  {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                        <Play className="w-8 h-8 text-white ml-1" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {video.status === "processing" ? (
                    <div className="text-center">
                      <div className="relative w-24 h-24 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-neutral-700" />
                        <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-white">{video.progress}%</span>
                        </div>
                      </div>
                      <p className="text-sm text-white/60">{isKorean ? "영상 생성 중..." : "Generating..."}</p>
                    </div>
                  ) : (
                    <div className="text-center text-white/40">
                      <Video className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm">{isKorean ? "영상 없음" : "No video"}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Video Controls */}
            {video.outputUrl && (
              <div className="p-4 border-t border-white/10">
                {/* Progress Bar */}
                {duration > 0 && (
                  <div
                    className="group relative h-1 bg-white/20 rounded-full cursor-pointer mb-3"
                    onClick={handleSeek}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-white rounded-full"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                      onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                      onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    {duration > 0 && (
                      <span className="text-sm text-white/60 ml-2">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    )}
                  </div>
                  <a
                    href={video.outputUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right: Metadata Panel */}
          <div className="flex-1 h-full flex flex-col bg-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
              <div className="flex items-center gap-3">
                <Badge className={cn("gap-1.5 px-3 py-1.5 border", status.bg, status.color)}>
                  <StatusIcon className={cn("w-3.5 h-3.5", video.status === "processing" && "animate-spin")} />
                  {status.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {video.generationType === "AI" ? "AI Generated" : "Compose"}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-neutral-500 hover:text-neutral-900">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 space-y-6">
                {/* Campaign */}
                <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="w-10 h-10 rounded-lg bg-neutral-200 flex items-center justify-center">
                    <Film className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">{isKorean ? "캠페인" : "Campaign"}</p>
                    <p className="font-medium truncate">{video.campaignName}</p>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "프롬프트" : "Prompt"}</h4>
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                    <p className="text-sm leading-relaxed">{video.prompt}</p>
                  </div>
                </div>

                {/* Technical Specs - Wide Grid */}
                <div>
                  <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">{isKorean ? "기술 정보" : "Technical Details"}</h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                      <div className="text-xs text-neutral-500 mb-1">{isKorean ? "비율" : "Aspect"}</div>
                      <div className="font-semibold">{video.aspectRatio}</div>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                      <div className="text-xs text-neutral-500 mb-1">{isKorean ? "길이" : "Duration"}</div>
                      <div className="font-semibold">{video.duration}s</div>
                    </div>
                    {video.qualityScore !== null && (
                      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                        <div className="text-xs text-neutral-500 mb-1">{isKorean ? "품질" : "Quality"}</div>
                        <div className="font-semibold">{video.qualityScore}</div>
                      </div>
                    )}
                    {video.metadata.fps && (
                      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                        <div className="text-xs text-neutral-500 mb-1">FPS</div>
                        <div className="font-semibold">{video.metadata.fps}</div>
                      </div>
                    )}
                    {video.metadata.resolution && (
                      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                        <div className="text-xs text-neutral-500 mb-1">{isKorean ? "해상도" : "Resolution"}</div>
                        <div className="font-semibold">{video.metadata.resolution}</div>
                      </div>
                    )}
                    {video.metadata.fileSize && (
                      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                        <div className="text-xs text-neutral-500 mb-1">{isKorean ? "파일 크기" : "Size"}</div>
                        <div className="font-semibold">{(video.metadata.fileSize / 1024 / 1024).toFixed(1)} MB</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audio */}
                {video.metadata.audioName && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "오디오" : "Audio"}</h4>
                    <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <div className="w-10 h-10 rounded-lg bg-neutral-200 flex items-center justify-center">
                        <Music className="w-5 h-5 text-neutral-600" />
                      </div>
                      <span className="text-sm flex-1 truncate">{video.metadata.audioName}</span>
                    </div>
                  </div>
                )}

                {/* Progress (if processing) */}
                {video.status === "processing" && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "진행률" : "Progress"}</h4>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-700">{isKorean ? "생성 중..." : "Generating..."}</span>
                        <span className="text-sm font-bold text-blue-700">{video.progress}%</span>
                      </div>
                      <Progress value={video.progress} className="h-2" />
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "타임라인" : "Timeline"}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                      <span className="text-neutral-500">{isKorean ? "생성일" : "Created"}</span>
                      <span className="font-medium">
                        {new Date(video.createdAt).toLocaleString(isKorean ? "ko-KR" : "en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                    {video.completedAt && (
                      <div className="flex items-center justify-between text-sm p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                        <span className="text-neutral-500">{isKorean ? "완료일" : "Completed"}</span>
                        <span className="font-medium">
                          {new Date(video.completedAt).toLocaleString(isKorean ? "ko-KR" : "en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Negative Prompt */}
                {video.metadata.negativePrompt && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "네거티브 프롬프트" : "Negative Prompt"}</h4>
                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                      <p className="text-sm leading-relaxed text-neutral-600">{video.metadata.negativePrompt}</p>
                    </div>
                  </div>
                )}

                {/* Reference Style */}
                {video.metadata.referenceStyle && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "레퍼런스 스타일" : "Reference Style"}</h4>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {video.metadata.referenceStyle}
                    </Badge>
                  </div>
                )}

                {/* Image Assets (for Compose videos) */}
                {video.metadata.imageAssets && video.metadata.imageAssets.length > 0 && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
                      {isKorean ? "이미지 에셋" : "Image Assets"} ({video.metadata.imageAssets.length})
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {video.metadata.imageAssets.map((asset, idx) => (
                        <div key={asset.id || idx} className="relative group">
                          <div className="aspect-square bg-neutral-100 rounded-lg overflow-hidden border border-neutral-200">
                            {asset.url ? (
                              <img
                                src={asset.url}
                                alt={asset.name || `Asset ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Image className="w-6 h-6 text-neutral-400" />
                              </div>
                            )}
                          </div>
                          {asset.name && (
                            <p className="text-[10px] text-neutral-500 mt-1 truncate">{asset.name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Effect Preset */}
                {video.metadata.effectPreset && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "효과 프리셋" : "Effect Preset"}</h4>
                    <Badge variant="secondary" className="text-sm px-3 py-1 bg-neutral-100">
                      {video.metadata.effectPreset}
                    </Badge>
                  </div>
                )}

                {/* Trend Keywords */}
                {video.metadata.trendKeywords && video.metadata.trendKeywords.length > 0 && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "트렌드 키워드" : "Trend Keywords"}</h4>
                    <div className="flex flex-wrap gap-2">
                      {video.metadata.trendKeywords.map((keyword, idx) => (
                        <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {video.metadata.tags && video.metadata.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "태그" : "Tags"}</h4>
                    <div className="flex flex-wrap gap-2">
                      {video.metadata.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-neutral-100">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reference URLs with Hashtags */}
                {video.metadata.referenceUrls && video.metadata.referenceUrls.length > 0 && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "레퍼런스 URL" : "Reference URLs"}</h4>
                    <div className="space-y-2">
                      {video.metadata.referenceUrls.map((ref, idx) => (
                        <div key={idx} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-neutral-200 flex items-center justify-center shrink-0">
                              <ExternalLink className="w-4 h-4 text-neutral-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {ref.title && (
                                <p className="font-medium text-sm truncate">{ref.title}</p>
                              )}
                              <a
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline truncate block"
                              >
                                {ref.url}
                              </a>
                              {ref.platform && (
                                <Badge variant="outline" className="text-[10px] mt-1">
                                  {ref.platform}
                                </Badge>
                              )}
                              {ref.hashtags && ref.hashtags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {ref.hashtags.map((hashtag, hIdx) => (
                                    <span key={hIdx} className="text-[11px] text-blue-600">
                                      #{hashtag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Script Data */}
                {video.metadata.scriptData && Object.keys(video.metadata.scriptData).length > 0 && (
                  <div>
                    <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">{isKorean ? "스크립트 데이터" : "Script Data"}</h4>
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <pre className="text-xs text-neutral-600 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(video.metadata.scriptData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Error */}
                {video.error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-2">
                      <XCircle className="w-4 h-4" />
                      {isKorean ? "오류" : "Error"}
                    </div>
                    <p className="text-sm text-red-600">{video.error}</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="p-4 border-t border-neutral-200 bg-neutral-50 shrink-0">
              {video.status === "completed" ? (
                <div className="flex items-center gap-3">
                  <Button
                    className="flex-1 h-11 bg-neutral-900 text-white hover:bg-neutral-800"
                    onClick={onApprove}
                    disabled={isApproving}
                  >
                    {isApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ThumbsUp className="w-4 h-4 mr-2" />}
                    {isKorean ? "승인" : "Approve"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-11 border-neutral-300"
                    onClick={onReject}
                    disabled={isRejecting}
                  >
                    {isRejecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ThumbsDown className="w-4 h-4 mr-2" />}
                    {isKorean ? "거부" : "Reject"}
                  </Button>
                </div>
              ) : video.status === "approved" ? (
                <div className="flex items-center justify-center gap-2 py-2 px-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-700">
                    {isKorean ? "발행 준비 완료" : "Ready for publishing"}
                  </span>
                </div>
              ) : video.status === "rejected" ? (
                <div className="flex items-center justify-center gap-2 py-2 px-4 bg-neutral-100 border border-neutral-300 rounded-lg">
                  <XCircle className="w-5 h-5 text-neutral-500" />
                  <span className="font-medium text-neutral-600">
                    {isKorean ? "거부된 영상" : "Rejected"}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Video Card Component
function ProcessingVideoCard({
  video,
  isSelected,
  onToggleSelect,
  onClick,
}: {
  video: ProcessingVideo;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const statusConfig = {
    processing: { label: isKorean ? "처리중" : "Processing", color: "bg-blue-500", icon: Loader2 },
    completed: { label: isKorean ? "완료" : "Done", color: "bg-green-500", icon: CheckCircle2 },
    failed: { label: isKorean ? "실패" : "Failed", color: "bg-red-500", icon: XCircle },
    approved: { label: isKorean ? "승인됨" : "Approved", color: "bg-emerald-600", icon: ThumbsUp },
    rejected: { label: isKorean ? "거부됨" : "Rejected", color: "bg-neutral-400", icon: ThumbsDown },
  };

  const status = statusConfig[video.status];
  const StatusIcon = status.icon;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all cursor-pointer group",
        isSelected && "ring-2 ring-neutral-900",
        video.status === "approved" && "ring-2 ring-emerald-500"
      )}
    >
      <CardContent className="p-0">
        {/* Video Thumbnail */}
        <div className="relative aspect-[9/16] bg-neutral-100" onClick={onClick}>
          {video.outputUrl || video.thumbnailUrl ? (
            <LazyVideo
              src={video.outputUrl || ""}
              poster={video.thumbnailUrl || undefined}
              className="w-full h-full object-cover"
              autoPlay={false}
              muted
              loop
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {video.status === "processing" ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto" />
                  <p className="text-xs text-neutral-500 mt-2">{video.progress}%</p>
                </div>
              ) : (
                <Video className="w-8 h-8 text-neutral-400" />
              )}
            </div>
          )}

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2">
            <Button size="sm" variant="secondary" className="gap-2">
              <Eye className="w-4 h-4" />
              {isKorean ? "상세보기" : "View Details"}
            </Button>
          </div>

          {/* Status Badge */}
          <div className="absolute top-2 right-2">
            <Badge className={cn("gap-1 backdrop-blur-sm", status.color)}>
              <StatusIcon className={cn("w-3 h-3", video.status === "processing" && "animate-spin")} />
              {status.label}
            </Badge>
          </div>

          {/* Type Badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="bg-black/60 text-white border-0 text-[10px]">
              {video.generationType === "AI" ? "AI" : "Compose"}
            </Badge>
          </div>

          {/* Duration Badge */}
          {video.outputUrl && (
            <div className="absolute bottom-2 right-2 opacity-100 group-hover:opacity-0 transition-opacity">
              <Badge variant="secondary" className="bg-black/60 text-white border-0">
                <Clock className="w-3 h-3 mr-1" />
                {video.duration}s
              </Badge>
            </div>
          )}

          {/* Selection Checkbox - all videos can be selected */}
          <div
            className="absolute bottom-2 left-2"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
          >
            <Checkbox
              checked={isSelected}
              className="h-5 w-5 bg-white border-2 data-[state=checked]:bg-neutral-900"
            />
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-1.5">
          <p className="text-xs text-neutral-500 font-medium truncate">
            {video.campaignName}
          </p>
          <p className="text-sm line-clamp-2 leading-snug">
            {video.prompt}
          </p>
          <div className="flex items-center gap-2 text-xs text-neutral-400 pt-1">
            {video.metadata.audioName && (
              <span className="flex items-center gap-1">
                <Music className="w-3 h-3" />
              </span>
            )}
            <span>
              {new Date(video.createdAt).toLocaleDateString(
                isKorean ? "ko-KR" : "en-US",
                { month: "short", day: "numeric" }
              )}
            </span>
            {video.qualityScore !== null && (
              <span className="ml-auto">
                {isKorean ? "품질" : "Q"}: {video.qualityScore}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProcessingPage() {
  const router = useRouter();
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Wait for store hydration
  const isHydrated = useWorkflowHydrated();

  // Sync workflow stage
  useWorkflowSync("processing");
  const { goToCreate, goToPublish, proceedToPublish } = useWorkflowNavigation();

  // Workflow store actions
  const {
    processing,
    setProcessingVideos,
    toggleProcessingVideoSelection,
    setSelectedProcessingVideos,
    approveProcessingVideo,
    rejectProcessingVideo,
    removeProcessingVideo,
    setProcessingFilter,
    setProcessingSort,
    setProcessingViewMode,
  } = useWorkflowStore(
    useShallow((state) => ({
      processing: state.processing,
      setProcessingVideos: state.setProcessingVideos,
      toggleProcessingVideoSelection: state.toggleProcessingVideoSelection,
      setSelectedProcessingVideos: state.setSelectedProcessingVideos,
      approveProcessingVideo: state.approveProcessingVideo,
      rejectProcessingVideo: state.rejectProcessingVideo,
      removeProcessingVideo: state.removeProcessingVideo,
      setProcessingFilter: state.setProcessingFilter,
      setProcessingSort: state.setProcessingSort,
      setProcessingViewMode: state.setProcessingViewMode,
    }))
  );

  const { videos, selectedVideos, filterStatus, sortBy, viewMode } = processing;

  // Campaigns for fetching video generations
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({ page_size: 50 });
  const campaigns = useMemo(() => campaignsData?.items || [], [campaignsData]);

  // Create a map of campaign names
  const campaignNames = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [campaigns]);

  // Fetch all video generations from all campaigns
  const [hasProcessing, setHasProcessing] = useState(false);
  const {
    data: allGenerations,
    isLoading: generationsLoading,
    refetch: refetchGenerations,
  } = useQuery({
    queryKey: ["all-generations", campaigns.map((c) => c.id).join(",")],
    queryFn: async () => {
      if (campaigns.length === 0) return [];

      const results = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const response = await videoApi.getAll(campaign.id, { page_size: 100 });
            if (response.data) {
              return response.data.items.map((gen) => ({
                ...gen,
                campaign_name: campaign.name,
              }));
            }
            return [];
          } catch {
            return [];
          }
        })
      );
      return results.flat();
    },
    enabled: campaigns.length > 0,
    staleTime: 30 * 1000,
    refetchInterval: hasProcessing ? 5000 : undefined,
  });

  // Convert video generations to ProcessingVideo format
  // Use a ref to track approved/rejected statuses to avoid infinite loop
  const approvedRejectedRef = React.useRef<Map<string, "approved" | "rejected">>(new Map());

  // Track if we've initialized the ref from persisted state
  const refInitializedRef = React.useRef(false);

  // Initialize ref from persisted store state on first render and update on changes
  useEffect(() => {
    // On first run, populate from persisted videos (this preserves approved/rejected status)
    if (!refInitializedRef.current && videos.length > 0) {
      videos.forEach((v) => {
        if (v.status === "approved" || v.status === "rejected") {
          approvedRejectedRef.current.set(v.id, v.status);
        }
      });
      refInitializedRef.current = true;
    } else {
      // On subsequent updates, just add new approved/rejected statuses
      videos.forEach((v) => {
        if (v.status === "approved" || v.status === "rejected") {
          approvedRejectedRef.current.set(v.id, v.status);
        }
      });
    }
  }, [videos]);

  useEffect(() => {
    if (allGenerations && allGenerations.length > 0) {
      const seenIds = new Set<string>();
      const processingVideos: ProcessingVideo[] = allGenerations
        .filter((gen: VideoGeneration & { campaign_name?: string }) => {
          // Deduplicate by id
          if (seenIds.has(gen.id)) return false;
          seenIds.add(gen.id);
          return true;
        })
        .map((gen: VideoGeneration & { campaign_name?: string }) => {
          // Determine if it's a compose video
          const isCompose = gen.id.startsWith("compose-") || !!gen.composed_output_url;

          // Map status
          let status: ProcessingVideo["status"] = "processing";
          if (gen.status === "completed") status = "completed";
          else if (gen.status === "failed") status = "failed";
          else if (gen.status === "pending" || gen.status === "processing") status = "processing";

          // Check if already approved/rejected (from ref to avoid dependency loop)
          const preservedStatus = approvedRejectedRef.current.get(gen.id);
          if (preservedStatus) {
            status = preservedStatus;
          }

          // Extract image assets from compose data
          const imageAssets = gen.image_assets
            ? Object.entries(gen.image_assets as Record<string, { url?: string; name?: string }>).map(([id, asset]) => ({
                id,
                url: asset?.url || "",
                name: asset?.name || id,
              }))
            : undefined;

          return {
            id: gen.id,
            generationId: gen.id,
            campaignId: gen.campaign_id,
            campaignName: gen.campaign_name || campaignNames[gen.campaign_id] || "Unknown Campaign",
            status,
            progress: gen.progress || 0,
            outputUrl: gen.output_url || gen.composed_output_url || null,
            thumbnailUrl: null,
            prompt: gen.prompt || "",
            duration: gen.duration_seconds || 5,
            aspectRatio: gen.aspect_ratio || "9:16",
            qualityScore: gen.quality_score || null,
            generationType: isCompose ? "COMPOSE" : "AI",
            createdAt: gen.created_at,
            completedAt: gen.status === "completed" ? gen.created_at : null,
            metadata: {
              audioAssetId: gen.audio_asset_id || undefined,
              audioName: gen.audio_asset?.original_filename || undefined,
              audioUrl: gen.audio_asset?.s3_url || undefined,
              imageAssets,
              effectPreset: gen.effect_preset || undefined,
              negativePrompt: gen.negative_prompt || undefined,
              referenceImageId: gen.reference_image_id || undefined,
              referenceStyle: gen.reference_style || undefined,
              trendKeywords: gen.trend_keywords || undefined,
              referenceUrls: gen.reference_urls || undefined,
              tags: gen.tags || undefined,
              scriptData: gen.script_data || undefined,
            },
            error: gen.error_message || undefined,
          };
        });

      if (processingVideos.length > 0) {
        setProcessingVideos(processingVideos);
      }

      // Check if any are still processing
      const hasProcessingVideos = processingVideos.some(
        (v) => v.status === "processing"
      );
      setHasProcessing(hasProcessingVideos);
    }
  }, [allGenerations, setProcessingVideos, campaignNames]);

  const loading = !isHydrated || campaignsLoading || generationsLoading;
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<ProcessingVideo | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchGenerations();
    setRefreshing(false);
  }, [refetchGenerations]);

  // Handle video actions
  const handleApprove = useCallback(async () => {
    if (!selectedVideo) return;
    setIsApproving(true);
    await approveProcessingVideo(selectedVideo.id);
    setIsApproving(false);
    setSelectedVideo(null);
  }, [selectedVideo, approveProcessingVideo]);

  const handleReject = useCallback(async () => {
    if (!selectedVideo) return;
    setIsRejecting(true);
    await rejectProcessingVideo(selectedVideo.id);
    setIsRejecting(false);
    setSelectedVideo(null);
  }, [selectedVideo, rejectProcessingVideo]);

  // Bulk action handlers - all videos are selectable (for deletion)
  const selectableVideos = useMemo(() =>
    videos.filter((v) => v.status === "completed" || v.status === "approved" || v.status === "processing" || v.status === "failed" || v.status === "rejected"),
    [videos]
  );

  const handleSelectAll = useCallback(() => {
    const selectableIds = selectableVideos.map((v) => v.id);
    const allSelected = selectableIds.every((id) => selectedVideos.includes(id));
    if (allSelected) {
      setSelectedProcessingVideos([]);
    } else {
      setSelectedProcessingVideos(selectableIds);
    }
  }, [selectableVideos, selectedVideos, setSelectedProcessingVideos]);

  const handleBulkApprove = useCallback(async () => {
    setIsBulkApproving(true);
    for (const id of selectedVideos) {
      const video = videos.find((v) => v.id === id);
      if (video && video.status === "completed") {
        approveProcessingVideo(id);
      }
    }
    setIsBulkApproving(false);
  }, [selectedVideos, videos, approveProcessingVideo]);

  const handleBulkReject = useCallback(async () => {
    setIsBulkRejecting(true);
    for (const id of selectedVideos) {
      const video = videos.find((v) => v.id === id);
      if (video && (video.status === "completed" || video.status === "approved")) {
        rejectProcessingVideo(id);
      }
    }
    setSelectedProcessingVideos([]);
    setIsBulkRejecting(false);
  }, [selectedVideos, videos, rejectProcessingVideo, setSelectedProcessingVideos]);

  const handleBulkDelete = useCallback(async () => {
    setIsBulkDeleting(true);
    const deletePromises = selectedVideos.map(async (id) => {
      try {
        // Call API to delete from database
        await videoApi.delete(id);
        // Remove from local state
        removeProcessingVideo(id);
        return { id, success: true };
      } catch (error) {
        console.error(`Failed to delete video ${id}:`, error);
        return { id, success: false };
      }
    });

    await Promise.all(deletePromises);
    setSelectedProcessingVideos([]);
    setIsBulkDeleting(false);
    // Refetch to sync with database
    refetchGenerations();
  }, [selectedVideos, removeProcessingVideo, setSelectedProcessingVideos, refetchGenerations]);

  const handleClearSelection = useCallback(() => {
    setSelectedProcessingVideos([]);
  }, [setSelectedProcessingVideos]);

  // Filter and sort videos
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter((v) => v.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.prompt.toLowerCase().includes(query) ||
          v.campaignName.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } else if (sortBy === "status") {
      const statusOrder = { approved: 0, completed: 1, processing: 2, failed: 3, rejected: 4 };
      result.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    }

    return result;
  }, [videos, filterStatus, searchQuery, sortBy]);

  // Stats
  const stats = useMemo(() => ({
    total: videos.length,
    processing: videos.filter((v) => v.status === "processing").length,
    completed: videos.filter((v) => v.status === "completed").length,
    approved: videos.filter((v) => v.status === "approved").length,
    rejected: videos.filter((v) => v.status === "rejected").length,
  }), [videos]);

  // Handle proceed to publish - always allowed
  const handleProceedToPublish = useCallback(() => {
    goToPublish();
  }, [goToPublish]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <WorkflowHeader
        onBack={goToCreate}
        onNext={handleProceedToPublish}
        canProceed={true}
      />

      {/* Stats Dashboard */}
      <div className="px-[7%] py-4 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center">
              <Video className="h-4 w-4 text-neutral-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500">{isKorean ? "전체" : "Total"}</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-neutral-200" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Loader2 className={cn("h-4 w-4 text-blue-600", stats.processing > 0 && "animate-spin")} />
            </div>
            <div>
              <p className="text-xs text-neutral-500">{isKorean ? "처리중" : "Processing"}</p>
              <p className="text-lg font-bold">{stats.processing}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-neutral-200" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500">{isKorean ? "완료" : "Completed"}</p>
              <p className="text-lg font-bold">{stats.completed}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-neutral-200" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500">{isKorean ? "승인됨" : "Approved"}</p>
              <p className="text-lg font-bold text-emerald-600">{stats.approved}</p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")}
            />
            {isKorean ? "새로고침" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-[7%] py-3 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-3">
          {/* Select All Checkbox */}
          {selectableVideos.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectableVideos.length > 0 && selectableVideos.every((v) => selectedVideos.includes(v.id))}
                onCheckedChange={handleSelectAll}
                className="h-5 w-5"
              />
              <span className="text-sm text-neutral-600">
                {isKorean ? "전체선택" : "Select All"}
              </span>
            </div>
          )}

          {selectableVideos.length > 0 && <div className="h-6 w-px bg-neutral-200" />}

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder={isKorean ? "프롬프트, 캠페인 검색..." : "Search prompts, campaigns..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Status Filter */}
          <Select
            value={filterStatus}
            onValueChange={(v) => setProcessingFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isKorean ? "모든 상태" : "All Status"}</SelectItem>
              <SelectItem value="processing">{isKorean ? "처리중" : "Processing"}</SelectItem>
              <SelectItem value="completed">{isKorean ? "완료" : "Completed"}</SelectItem>
              <SelectItem value="approved">{isKorean ? "승인됨" : "Approved"}</SelectItem>
              <SelectItem value="rejected">{isKorean ? "거부됨" : "Rejected"}</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            value={sortBy}
            onValueChange={(v) => setProcessingSort(v as SortBy)}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{isKorean ? "최신순" : "Newest"}</SelectItem>
              <SelectItem value="oldest">{isKorean ? "오래된순" : "Oldest"}</SelectItem>
              <SelectItem value="status">{isKorean ? "상태순" : "By Status"}</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode */}
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setProcessingViewMode("grid")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setProcessingViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1" />

          <p className="text-sm text-neutral-500">
            {filteredVideos.length} {isKorean ? "개 결과" : "results"}
          </p>
        </div>
      </div>

      {/* Videos Grid/List */}
      <div className="flex-1 overflow-auto px-[7%] py-6">
        {filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Video className="w-12 h-12 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium text-neutral-700 mb-2">
              {isKorean ? "영상이 없습니다" : "No videos"}
            </h3>
            <p className="text-sm text-neutral-500 mb-4">
              {isKorean
                ? "생성 단계에서 영상을 만들어보세요"
                : "Create videos in the Create stage"}
            </p>
            <Button onClick={goToCreate} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isKorean ? "생성으로 이동" : "Go to Create"}
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredVideos.map((video) => (
              <ProcessingVideoCard
                key={video.id}
                video={video}
                isSelected={selectedVideos.includes(video.id)}
                onToggleSelect={() => toggleProcessingVideoSelection(video.id)}
                onClick={() => setSelectedVideo(video)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredVideos.map((video) => (
              <Card
                key={video.id}
                className={cn(
                  "cursor-pointer hover:shadow-md transition-all",
                  selectedVideos.includes(video.id) && "ring-2 ring-neutral-900"
                )}
                onClick={() => setSelectedVideo(video)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-36 bg-neutral-100 rounded-lg overflow-hidden shrink-0">
                      {video.outputUrl || video.thumbnailUrl ? (
                        <LazyVideo
                          src={video.outputUrl || ""}
                          poster={video.thumbnailUrl || undefined}
                          className="w-full h-full object-cover"
                          autoPlay={false}
                          muted
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-6 h-6 text-neutral-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            video.status === "processing" && "bg-blue-100 text-blue-700",
                            video.status === "completed" && "bg-green-100 text-green-700",
                            video.status === "approved" && "bg-emerald-100 text-emerald-700",
                            video.status === "rejected" && "bg-neutral-200 text-neutral-600",
                            video.status === "failed" && "bg-red-100 text-red-700"
                          )}
                        >
                          {video.status === "processing" && (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          )}
                          {video.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {video.generationType}
                        </Badge>
                        <span className="text-xs text-neutral-400">
                          {video.campaignName}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2">{video.prompt}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration}s
                        </span>
                        {video.qualityScore !== null && (
                          <span>
                            {isKorean ? "품질" : "Quality"}: {video.qualityScore}
                          </span>
                        )}
                        <span>
                          {new Date(video.createdAt).toLocaleDateString(
                            isKorean ? "ko-KR" : "en-US"
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Checkbox - all videos can be selected */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProcessingVideoSelection(video.id);
                      }}
                    >
                      <Checkbox
                        checked={selectedVideos.includes(video.id)}
                        className="h-5 w-5"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedVideos.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-6 py-3 bg-neutral-900 rounded-full shadow-2xl border border-neutral-700">
            {/* Selection Count */}
            <div className="flex items-center gap-2 text-white">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="font-medium">
                {selectedVideos.length} {isKorean ? "개 선택됨" : "selected"}
              </span>
            </div>

            <div className="h-5 w-px bg-neutral-600" />

            {/* Clear Selection */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="h-4 w-4 mr-1" />
              {isKorean ? "해제" : "Clear"}
            </Button>

            <div className="h-5 w-px bg-neutral-600" />

            {/* Bulk Approve */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkApprove}
              disabled={isBulkApproving || selectedVideos.every((id) => {
                const v = videos.find((v) => v.id === id);
                return v?.status !== "completed";
              })}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-neutral-800 disabled:text-neutral-600"
            >
              {isBulkApproving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4 mr-2" />
              )}
              {isKorean ? "승인" : "Approve"}
            </Button>

            {/* Bulk Reject */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkReject}
              disabled={isBulkRejecting}
              className="text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:text-neutral-600"
            >
              {isBulkRejecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ThumbsDown className="h-4 w-4 mr-2" />
              )}
              {isKorean ? "거부" : "Reject"}
            </Button>

            {/* Bulk Delete */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="text-red-400 hover:text-red-300 hover:bg-neutral-800 disabled:text-neutral-600"
            >
              {isBulkDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {isKorean ? "삭제" : "Delete"}
            </Button>

            <div className="h-5 w-px bg-neutral-600" />

            {/* Proceed to Publish */}
            <Button
              size="sm"
              onClick={handleProceedToPublish}
              className="bg-white text-neutral-900 hover:bg-neutral-100"
            >
              <Send className="h-4 w-4 mr-2" />
              {isKorean ? "발행" : "Publish"}
            </Button>
          </div>
        </div>
      )}

      {/* Video Detail Modal */}
      <VideoDetailModal
        video={selectedVideo}
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        isApproving={isApproving}
        isRejecting={isRejecting}
      />
    </div>
  );
}

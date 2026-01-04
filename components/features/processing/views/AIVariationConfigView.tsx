"use client";

import React, { useRef, useState, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Check,
  Loader2,
  Zap,
  Film,
  Square,
  Activity,
  Disc,
  Cloud,
  Star,
  Lightbulb,
  Camera,
  ChevronUp,
  ChevronDown,
  Rocket,
  Layers,
  Palette,
  type LucideIcon,
} from "lucide-react";
import {
  useProcessingSessionStore,
  selectOriginalVideo,
  selectSession,
  selectSelectedStyles,
} from "@/lib/stores/processing-session-store";

// AI Style Presets for AI Video Variation
interface AIStylePreset {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: LucideIcon;
  category: "camera" | "movement" | "color";
}

const AI_STYLE_PRESETS: AIStylePreset[] = [
  // Camera Variations
  {
    id: "camera_closeup",
    name: "Close-up",
    nameKo: "클로즈업",
    description: "Tight close-up shot",
    descriptionKo: "피사체를 가깝게 촬영",
    icon: Camera,
    category: "camera",
  },
  {
    id: "camera_wide",
    name: "Wide Shot",
    nameKo: "와이드 샷",
    description: "Wide establishing shot",
    descriptionKo: "넓은 시점으로 전체 보기",
    icon: Square,
    category: "camera",
  },
  {
    id: "camera_low_angle",
    name: "Low Angle",
    nameKo: "로우 앵글",
    description: "Shot from below",
    descriptionKo: "아래에서 위로 촬영",
    icon: ChevronUp,
    category: "camera",
  },
  {
    id: "camera_high_angle",
    name: "High Angle",
    nameKo: "하이 앵글",
    description: "Shot from above",
    descriptionKo: "위에서 아래로 촬영",
    icon: ChevronDown,
    category: "camera",
  },
  {
    id: "camera_dutch",
    name: "Dutch Tilt",
    nameKo: "더치 틸트",
    description: "Tilted camera angle",
    descriptionKo: "기울어진 카메라 앵글",
    icon: Activity,
    category: "camera",
  },
  // Movement Variations
  {
    id: "move_dolly_in",
    name: "Dolly In",
    nameKo: "돌리 인",
    description: "Slow push towards subject",
    descriptionKo: "피사체로 천천히 다가가기",
    icon: Rocket,
    category: "movement",
  },
  {
    id: "move_dolly_out",
    name: "Dolly Out",
    nameKo: "돌리 아웃",
    description: "Slow pull back from subject",
    descriptionKo: "피사체에서 천천히 멀어짐",
    icon: Layers,
    category: "movement",
  },
  {
    id: "move_orbit",
    name: "Orbit",
    nameKo: "오빗",
    description: "Circular movement around",
    descriptionKo: "피사체 주위를 원형으로 회전",
    icon: Disc,
    category: "movement",
  },
  {
    id: "move_pan",
    name: "Slow Pan",
    nameKo: "슬로우 팬",
    description: "Gentle horizontal pan",
    descriptionKo: "부드러운 수평 이동",
    icon: Film,
    category: "movement",
  },
  {
    id: "move_steady",
    name: "Steady",
    nameKo: "스테디",
    description: "Locked-off steady shot",
    descriptionKo: "고정된 안정적인 촬영",
    icon: Square,
    category: "movement",
  },
  // Color Variations
  {
    id: "color_warm",
    name: "Warm",
    nameKo: "웜톤",
    description: "Warm golden tones",
    descriptionKo: "따뜻한 골든 톤",
    icon: Lightbulb,
    category: "color",
  },
  {
    id: "color_cool",
    name: "Cool",
    nameKo: "쿨톤",
    description: "Cool blue tones",
    descriptionKo: "차가운 블루 톤",
    icon: Cloud,
    category: "color",
  },
  {
    id: "color_vivid",
    name: "Vivid",
    nameKo: "비비드",
    description: "Slightly enhanced colors",
    descriptionKo: "약간 강렬한 색상",
    icon: Zap,
    category: "color",
  },
  {
    id: "color_muted",
    name: "Muted",
    nameKo: "뮤트",
    description: "Softly muted palette",
    descriptionKo: "부드럽게 가라앉은 색상",
    icon: Palette,
    category: "color",
  },
  {
    id: "color_vintage",
    name: "Vintage",
    nameKo: "빈티지",
    description: "Subtle vintage film tint",
    descriptionKo: "은은한 빈티지 필름 톤",
    icon: Film,
    category: "color",
  },
];

interface VideoInfo {
  id: string;
  prompt: string;
  campaign_name: string;
  artist_name: string;
  duration_seconds: number;
  aspect_ratio: string;
  output_url: string | null;
}

interface AIVariationConfigViewProps {
  className?: string;
  video: VideoInfo;
  onBack: () => void;
  onStartGeneration: () => void;
  onCancel: () => void;
}

export function AIVariationConfigView({
  className,
  video,
  onBack,
  onStartGeneration,
  onCancel,
}: AIVariationConfigViewProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);
  const selectedStyles = useProcessingSessionStore(selectSelectedStyles);

  const toggleStyleSelection = useProcessingSessionStore((state) => state.toggleStyleSelection);

  const [isStartingGeneration, setIsStartingGeneration] = useState(false);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Toggle play
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Group presets by category
  const presetsByCategory = useMemo(() => {
    return {
      camera: AI_STYLE_PRESETS.filter((p) => p.category === "camera"),
      movement: AI_STYLE_PRESETS.filter((p) => p.category === "movement"),
      color: AI_STYLE_PRESETS.filter((p) => p.category === "color"),
    };
  }, []);

  const categoryLabels = {
    camera: { en: "Camera Angle", ko: "카메라 앵글" },
    movement: { en: "Movement", ko: "카메라 움직임" },
    color: { en: "Color Tone", ko: "색상 톤" },
  };

  // Select all AI presets
  const selectAllAIPresets = useCallback(() => {
    AI_STYLE_PRESETS.forEach((preset) => {
      if (!selectedStyles.includes(preset.id)) {
        toggleStyleSelection(preset.id);
      }
    });
  }, [selectedStyles, toggleStyleSelection]);

  // Clear all AI presets
  const clearAIPresetSelection = useCallback(() => {
    selectedStyles.forEach((styleId) => {
      if (AI_STYLE_PRESETS.some((p) => p.id === styleId)) {
        toggleStyleSelection(styleId);
      }
    });
  }, [selectedStyles, toggleStyleSelection]);

  // Estimated time (rough calculation)
  const estimatedTime = useMemo(() => {
    const count = selectedStyles.length;
    if (count === 0) return null;
    const minutes = Math.ceil(count * 1.5); // ~1.5 min per AI video
    return minutes < 60
      ? `${minutes}${isKorean ? "분" : " min"}`
      : `${Math.floor(minutes / 60)}${isKorean ? "시간" : "h"} ${minutes % 60}${isKorean ? "분" : "m"}`;
  }, [selectedStyles.length, isKorean]);

  const canStart = selectedStyles.length > 0 && !isStartingGeneration;

  const handleStartGeneration = async () => {
    setIsStartingGeneration(true);
    try {
      await onStartGeneration();
    } finally {
      setIsStartingGeneration(false);
    }
  };

  return (
    <div className={cn("flex flex-col min-h-[60vh]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {isKorean ? "돌아가기" : "Back"}
        </Button>

        <h2 className="text-lg font-semibold text-neutral-900">
          {isKorean ? "AI 스타일 변형" : "AI Style Variations"}
        </h2>

        <Button
          onClick={handleStartGeneration}
          disabled={!canStart}
          className="bg-neutral-900 hover:bg-neutral-800 text-white"
        >
          {isStartingGeneration ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              {isKorean ? "생성 중..." : "Generating..."}
            </>
          ) : (
            <>{isKorean ? "시작하기" : "Start"}</>
          )}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Original video preview */}
        <div className="lg:col-span-1">
          <Card className="bg-neutral-900 border-neutral-700 overflow-hidden">
            <CardContent className="p-0">
              {/* Video */}
              <div className="aspect-[9/16] bg-black relative">
                {video.output_url ? (
                  <video
                    ref={videoRef}
                    src={video.output_url}
                    className="w-full h-full object-contain cursor-pointer"
                    loop
                    playsInline
                    muted={isMuted}
                    onClick={togglePlay}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500">
                    {isKorean ? "영상 없음" : "No video"}
                  </div>
                )}

                {/* Label */}
                <Badge className="absolute top-2 left-2 bg-violet-500/90 text-white gap-1">
                  <Star className="w-3 h-3 fill-white" />
                  {isKorean ? "원본" : "Original"}
                </Badge>

                {/* Controls overlay */}
                {video.output_url && (
                  <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Prompt Info */}
          <Card className="mt-4 bg-neutral-50 border-neutral-200">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-2">
                {isKorean ? "프롬프트" : "Prompt"}
              </h4>
              <p className="text-xs text-neutral-600 line-clamp-4">{video.prompt}</p>
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-200">
                <Badge variant="outline" className="text-xs bg-white">
                  {video.campaign_name}
                </Badge>
                <Badge variant="outline" className="text-xs bg-white">
                  {video.artist_name}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Style selection */}
        <div className="lg:col-span-3 space-y-4">
          {/* Selection Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-neutral-900">
                    {isKorean ? "스타일 선택" : "Select Styles"}
                  </h3>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {isKorean
                      ? "원본 영상에 적용할 스타일을 선택하세요"
                      : "Select styles to apply to the original video"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllAIPresets}>
                    {isKorean ? "전체 선택" : "Select All"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAIPresetSelection}>
                    {isKorean ? "선택 해제" : "Clear"}
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-sm text-neutral-500">
                {selectedStyles.length} {isKorean ? "개 선택됨" : "selected"}
                {estimatedTime && (
                  <span className="ml-2 text-neutral-400">
                    (~{estimatedTime})
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Style Categories */}
          {(["camera", "movement", "color"] as const).map((category) => (
            <Card key={category}>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-neutral-700 mb-3">
                  {isKorean ? categoryLabels[category].ko : categoryLabels[category].en}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {presetsByCategory[category].map((preset) => {
                    const isSelected = selectedStyles.includes(preset.id);
                    const Icon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => toggleStyleSelection(preset.id)}
                        className={cn(
                          "relative p-3 rounded-lg border-2 transition-all text-left",
                          isSelected
                            ? "border-neutral-900 bg-neutral-100"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={cn(
                            "w-4 h-4 flex-shrink-0 mt-0.5",
                            isSelected ? "text-neutral-900" : "text-neutral-400"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "text-sm font-medium truncate",
                              isSelected ? "text-neutral-900" : "text-neutral-700"
                            )}>
                              {isKorean ? preset.nameKo : preset.name}
                            </div>
                            <div className="text-xs text-neutral-500 line-clamp-1">
                              {isKorean ? preset.descriptionKo : preset.description}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5">
                            <Check className="w-3.5 h-3.5 text-neutral-900" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

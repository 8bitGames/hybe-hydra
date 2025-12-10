"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import {
  Sparkles,
  X,
  Timer,
  Hash,
  FileText,
  Search,
  FolderOpen,
  ChevronDown,
  Check,
} from "lucide-react";
import { ScriptGenerationResponse, TikTokSEO, ASPECT_RATIOS } from "@/lib/fast-cut-api";
import { KeywordInputPopover } from "@/components/ui/keyword-input-popover";
import { CampaignSelector } from "@/components/features/create/CampaignSelector";

interface FastCutScriptStepProps {
  // Campaign selection
  campaignId: string | null;
  campaignName: string;
  onCampaignChange?: (campaignId: string) => void;
  campaignReadOnly?: boolean;
  // Script generation
  prompt: string;
  setPrompt: (prompt: string) => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  editableKeywords: string[];
  setEditableKeywords: (keywords: string[]) => void;
  selectedSearchKeywords: Set<string>;
  setSelectedSearchKeywords: (keywords: Set<string>) => void;
  generatingScript: boolean;
  scriptData: ScriptGenerationResponse | null;
  tiktokSEO: TikTokSEO | null;
  setTiktokSEO: (seo: TikTokSEO | null) => void;
  onGenerateScript: () => void;
  keywordPopoverOpen?: boolean;
  onKeywordPopoverOpenChange?: (open: boolean) => void;
}

export function FastCutScriptStep({
  campaignId,
  campaignName,
  onCampaignChange,
  campaignReadOnly = false,
  prompt,
  setPrompt,
  aspectRatio,
  setAspectRatio,
  editableKeywords,
  setEditableKeywords,
  selectedSearchKeywords,
  setSelectedSearchKeywords,
  generatingScript,
  scriptData,
  tiktokSEO,
  setTiktokSEO,
  onGenerateScript,
  keywordPopoverOpen,
  onKeywordPopoverOpenChange,
}: FastCutScriptStepProps) {
  const { language, translate } = useI18n();
  const [campaignSelectorOpen, setCampaignSelectorOpen] = useState(!campaignId && !campaignReadOnly);

  // Helper for tooltip icon
  const TooltipIcon = ({ tooltipKey }: { tooltipKey: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 cursor-help ml-1.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        <p className="text-xs">{translate(tooltipKey)}</p>
      </TooltipContent>
    </Tooltip>
  );

  // Keyword management
  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (trimmed && !editableKeywords.includes(trimmed)) {
      setEditableKeywords([...editableKeywords, trimmed]);
      setSelectedSearchKeywords(new Set([...selectedSearchKeywords, trimmed]));
    }
  };

  const removeKeyword = (keyword: string) => {
    setEditableKeywords(editableKeywords.filter((k) => k !== keyword));
    const newSet = new Set(selectedSearchKeywords);
    newSet.delete(keyword);
    setSelectedSearchKeywords(newSet);
  };

  const toggleKeywordSelection = (keyword: string) => {
    const newSet = new Set(selectedSearchKeywords);
    if (newSet.has(keyword)) {
      newSet.delete(keyword);
    } else {
      newSet.add(keyword);
    }
    setSelectedSearchKeywords(newSet);
  };

  // Format timing for display
  const formatTiming = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${secs}s`;
  };

  // All SEO hashtags combined
  const allSEOHashtags = useMemo(() => {
    if (!tiktokSEO) return [];
    return [
      tiktokSEO.hashtags.category,
      tiktokSEO.hashtags.niche,
      ...tiktokSEO.hashtags.descriptive,
      tiktokSEO.hashtags.trending || "",
    ].filter(Boolean);
  }, [tiktokSEO]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-1">
          {language === "ko" ? "스크립트 생성" : "Script Generation"}
        </h2>
        <p className="text-sm text-neutral-500">
          {language === "ko"
            ? "AI가 TikTok Hook Strategy를 적용한 스크립트를 생성합니다"
            : "AI generates a script with TikTok Hook Strategy applied"}
        </p>
      </div>

      {/* Campaign Selector */}
      {campaignReadOnly ? (
        // Read-only campaign display
        <div className="border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-neutral-700">
                {language === "ko" ? "캠페인" : "Campaign"}
              </p>
              <p className="text-sm text-neutral-900 font-semibold flex items-center gap-1">
                {campaignName || campaignId}
                <Check className="h-3.5 w-3.5 text-primary" />
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Editable campaign selector
        <Collapsible
          open={campaignSelectorOpen}
          onOpenChange={setCampaignSelectorOpen}
          className="border border-neutral-200 rounded-lg"
        >
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors rounded-lg">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  campaignId ? "bg-primary/10" : "bg-neutral-100"
                )}>
                  <FolderOpen className={cn(
                    "h-5 w-5",
                    campaignId ? "text-primary" : "text-neutral-500"
                  )} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-neutral-700">
                    {language === "ko" ? "캠페인" : "Campaign"}
                  </p>
                  {campaignId ? (
                    <p className="text-sm text-neutral-900 font-semibold flex items-center gap-1">
                      {campaignName || campaignId}
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      {language === "ko" ? "캠페인을 선택하세요" : "Select a campaign"}
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className={cn(
                "h-5 w-5 text-neutral-400 transition-transform",
                campaignSelectorOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0">
              <CampaignSelector
                value={campaignId || ""}
                onChange={(id) => {
                  onCampaignChange?.(id);
                  setCampaignSelectorOpen(false);
                }}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Prompt Input */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-neutral-700 flex items-center">
          {language === "ko" ? "영상 컨셉 프롬프트" : "Video Concept Prompt"}
          <TooltipIcon tooltipKey="fastCut.tooltips.script.prompt" />
        </Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            language === "ko"
              ? "영상의 분위기, 주제, 목표를 설명해주세요..."
              : "Describe the vibe, topic, and goals for your video..."
          }
          className="min-h-[100px] bg-neutral-50 border-neutral-200"
        />
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-neutral-700 flex items-center">
          {language === "ko" ? "화면 비율" : "Aspect Ratio"}
          <TooltipIcon tooltipKey="fastCut.tooltips.script.aspectRatio" />
        </Label>
        <Select value={aspectRatio} onValueChange={setAspectRatio}>
          <SelectTrigger className="w-full bg-neutral-50 border-neutral-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASPECT_RATIOS.map((ratio) => (
              <SelectItem key={ratio.value} value={ratio.value}>
                {ratio.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Keywords Manager */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
          <Search className="h-4 w-4" />
          {language === "ko" ? "검색 키워드" : "Search Keywords"}
          <TooltipIcon tooltipKey="fastCut.tooltips.script.searchKeywords" />
        </Label>
        <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-lg min-h-[60px]">
          {editableKeywords.map((keyword) => (
            <Badge
              key={keyword}
              variant={selectedSearchKeywords.has(keyword) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all px-3 py-1",
                selectedSearchKeywords.has(keyword)
                  ? "bg-neutral-900 text-white hover:bg-neutral-800"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
              )}
              onClick={() => toggleKeywordSelection(keyword)}
            >
              {keyword}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeKeyword(keyword);
                }}
                className="ml-1.5 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <KeywordInputPopover
            onAdd={addKeyword}
            placeholder={language === "ko" ? "새 키워드 입력..." : "Enter new keyword..."}
            buttonText={language === "ko" ? "추가" : "Add"}
            open={keywordPopoverOpen}
            onOpenChange={onKeywordPopoverOpenChange}
          />
        </div>
        <p className="text-xs text-neutral-400">
          {language === "ko"
            ? "클릭하여 이미지 검색에 사용할 키워드를 선택하세요"
            : "Click to select keywords for image search"}
        </p>
      </div>

      {/* Generate Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onGenerateScript}
            disabled={generatingScript || !prompt.trim()}
            className="w-full bg-neutral-900 text-white hover:bg-neutral-800 h-12"
          >
            {generatingScript ? (
              <>
                <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                {language === "ko" ? "스크립트 생성 중..." : "Generating Script..."}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                {language === "ko" ? "AI 스크립트 생성" : "Generate AI Script"}
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px]">
          <p className="text-xs">{translate("fastCut.tooltips.script.generateScript")}</p>
        </TooltipContent>
      </Tooltip>

      {/* Script Result */}
      {scriptData && (
        <div className="space-y-4 border border-neutral-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {language === "ko" ? "생성된 스크립트" : "Generated Script"}
            </h3>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs border-neutral-300 cursor-help">
                    {scriptData.vibe}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px]">
                  <p className="text-xs">{translate("fastCut.tooltips.script.vibe")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs border-neutral-300 cursor-help">
                    {scriptData.suggestedBpmRange.min}-{scriptData.suggestedBpmRange.max} BPM
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px]">
                  <p className="text-xs">{translate("fastCut.tooltips.script.bpmRange")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Script Timeline */}
          <div className="space-y-1">
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {scriptData.script.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-start gap-3 p-2 rounded-lg",
                      idx === 0
                        ? "bg-neutral-100 border border-neutral-200"
                        : "hover:bg-neutral-50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono w-16 shrink-0">
                      <Timer className="h-3 w-3" />
                      {formatTiming(line.timing)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-neutral-800">{line.text}</p>
                      {idx === 0 && (
                        <span className="text-[10px] text-neutral-500">
                          {language === "ko" ? "Hook Zone" : "Hook Zone"} - 0~2s
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-400">
                      {line.duration}s
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-between items-center pt-2 text-xs text-neutral-500">
              <span>
                {language === "ko" ? "총 라인:" : "Total lines:"} {scriptData.script.lines.length}
              </span>
              <span>
                {language === "ko" ? "총 길이:" : "Duration:"} {scriptData.script.totalDuration}s
              </span>
            </div>
          </div>

          {/* Vibe Reason */}
          {scriptData.vibeReason && (
            <div className="p-3 bg-neutral-50 rounded-lg">
              <p className="text-xs text-neutral-600">
                <span className="font-medium">
                  {language === "ko" ? "분위기 분석:" : "Vibe Analysis:"}
                </span>{" "}
                {scriptData.vibeReason}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TikTok SEO Preview */}
      {tiktokSEO && (
        <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
          <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            {language === "ko" ? "TikTok SEO 미리보기" : "TikTok SEO Preview"}
          </h3>

          <div className="space-y-3">
            {/* Description */}
            <div>
              <Label className="text-xs text-neutral-500 mb-1 flex items-center">
                {language === "ko" ? "설명" : "Description"}
                <TooltipIcon tooltipKey="fastCut.tooltips.effects.seo.description" />
              </Label>
              <p className="text-sm text-neutral-700">{tiktokSEO.description}</p>
            </div>

            {/* Hashtags */}
            <div>
              <Label className="text-xs text-neutral-500 mb-1 flex items-center">
                {language === "ko" ? "해시태그" : "Hashtags"}
                <TooltipIcon tooltipKey="fastCut.tooltips.effects.seo.hashtags" />
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {allSEOHashtags.map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs bg-neutral-200 text-neutral-700"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div>
              <Label className="text-xs text-neutral-500 mb-1">
                {language === "ko" ? "주요 키워드" : "Primary Keyword"}
              </Label>
              <Badge variant="outline" className="text-xs border-neutral-400">
                {tiktokSEO.keywords.primary}
              </Badge>
            </div>

            {/* Search Intent */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-neutral-500">
                {language === "ko" ? "검색 의도:" : "Search Intent:"}
              </Label>
              <Badge variant="outline" className="text-xs capitalize border-neutral-300">
                {tiktokSEO.searchIntent}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

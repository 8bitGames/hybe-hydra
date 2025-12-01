"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TikTokSEO } from "@/lib/compose-api";
import { Copy, Check, Edit2, ChevronDown, ChevronUp, Search, Hash, Clock, Target } from "lucide-react";

interface TikTokSEOPreviewProps {
  seo: TikTokSEO;
  onUpdate?: (seo: TikTokSEO) => void;
  editable?: boolean;
}

export function TikTokSEOPreview({
  seo,
  onUpdate,
  editable = false
}: TikTokSEOPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(seo.description);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveDescription = () => {
    if (onUpdate) {
      onUpdate({
        ...seo,
        description: editedDescription
      });
    }
    setIsEditing(false);
  };

  // Get all hashtags as a string
  const allHashtags = [
    seo.hashtags.category,
    seo.hashtags.niche,
    ...seo.hashtags.descriptive,
    seo.hashtags.trending
  ].filter(Boolean).join(' ');

  // Search intent icon and color
  const intentConfig = {
    tutorial: { icon: "📚", color: "bg-blue-500", label: "Tutorial" },
    discovery: { icon: "🔍", color: "bg-green-500", label: "Discovery" },
    entertainment: { icon: "🎬", color: "bg-purple-500", label: "Entertainment" },
    inspiration: { icon: "✨", color: "bg-pink-500", label: "Inspiration" }
  };

  const intent = intentConfig[seo.searchIntent];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <span>📱</span> TikTok SEO 최적화
        </h4>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${intent.color} text-white`}>
            {intent.icon} {intent.label}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Summary View (Always visible) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Hashtags Card */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="w-3 h-3" /> 해시태그
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => copyToClipboard(allHashtags, 'hashtags')}
            >
              {copiedField === 'hashtags' ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-xs bg-primary/20">
              {seo.hashtags.category}
            </Badge>
            <Badge variant="secondary" className="text-xs bg-blue-500/20">
              {seo.hashtags.niche}
            </Badge>
            {seo.hashtags.descriptive.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {seo.hashtags.trending && (
              <Badge variant="secondary" className="text-xs bg-orange-500/20">
                {seo.hashtags.trending}
              </Badge>
            )}
          </div>
        </div>

        {/* Keywords Card */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Search className="w-3 h-3" /> 키워드
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => copyToClipboard(seo.keywords.primary, 'keyword')}
            >
              {copiedField === 'keyword' ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <p className="text-sm font-medium truncate" title={seo.keywords.primary}>
            {seo.keywords.primary}
          </p>
          <div className="flex flex-wrap gap-1">
            {seo.keywords.secondary.slice(0, 3).map((kw, i) => (
              <span key={i} className="text-[10px] text-muted-foreground">
                {kw}{i < 2 && seo.keywords.secondary.length > i + 1 && " •"}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t">
          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">설명 (Description)</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {editedDescription.length}/2200
                </span>
                {editable && !isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(editedDescription, 'description')}
                >
                  {copiedField === 'description' ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="min-h-[120px] text-sm"
                  maxLength={2200}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditedDescription(seo.description);
                      setIsEditing(false);
                    }}
                  >
                    취소
                  </Button>
                  <Button size="sm" onClick={handleSaveDescription}>
                    저장
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                {editedDescription}
              </div>
            )}
          </div>

          {/* Long-tail Keywords */}
          <div className="space-y-2">
            <span className="text-sm font-medium flex items-center gap-1">
              <Target className="w-4 h-4" /> 롱테일 키워드
            </span>
            <div className="flex flex-wrap gap-2">
              {seo.keywords.longTail.map((kw, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-primary/10"
                  onClick={() => copyToClipboard(kw, `longtail-${i}`)}
                >
                  {copiedField === `longtail-${i}` ? (
                    <Check className="w-3 h-3 mr-1 text-green-500" />
                  ) : null}
                  {kw}
                </Badge>
              ))}
            </div>
          </div>

          {/* Text Overlay Keywords */}
          <div className="space-y-2">
            <span className="text-sm font-medium">텍스트 오버레이 키워드</span>
            <p className="text-xs text-muted-foreground">
              영상 텍스트에 포함하면 좋은 키워드 (TikTok 알고리즘이 인식)
            </p>
            <div className="flex flex-wrap gap-2">
              {seo.textOverlayKeywords.map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>

          {/* Posting Times */}
          <div className="space-y-2">
            <span className="text-sm font-medium flex items-center gap-1">
              <Clock className="w-4 h-4" /> 추천 업로드 시간 (KST)
            </span>
            <div className="flex gap-2">
              {seo.suggestedPostingTimes.map((time, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {time}
                </Badge>
              ))}
            </div>
          </div>

          {/* SEO Tips */}
          <div className="p-3 bg-blue-500/10 rounded-lg space-y-2">
            <span className="text-sm font-medium text-blue-600">SEO 최적화 팁</span>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• 첫 3초에 주요 키워드를 텍스트와 음성으로 노출하세요</li>
              <li>• 해시태그는 3-5개만 사용 (#fyp, #viral 피하기)</li>
              <li>• 설명 첫 줄에 핵심 키워드를 배치하세요</li>
              <li>• 시청 완료율과 저장 수가 랭킹에 중요합니다</li>
              <li>• 최적 업로드 시간에 게시하여 초기 engagement를 높이세요</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

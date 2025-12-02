"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Campaign } from "@/lib/campaigns-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import {
  FolderOpen,
  Plus,
  Check,
  Search,
  Music,
  Image as ImageIcon,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignSelectorProps {
  value: string;
  onChange: (campaignId: string) => void;
  className?: string;
}

export function CampaignSelector({ value, onChange, className }: CampaignSelectorProps) {
  const router = useRouter();
  const { language } = useI18n();
  const { accessToken, isAuthenticated } = useAuthStore();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadCampaigns = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    try {
      const response = await api.get<{ items: Campaign[] }>("/api/v1/campaigns");
      if (response.data) {
        setCampaigns(response.data.items);
      }
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      campaign.name.toLowerCase().includes(query) ||
      campaign.artist_name?.toLowerCase().includes(query) ||
      campaign.artist_stage_name?.toLowerCase().includes(query)
    );
  });

  const selectedCampaign = campaigns.find((c) => c.id === value);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">
          {language === "ko" ? "캠페인이 없습니다" : "No campaigns yet"}
        </h3>
        <p className="text-muted-foreground mb-4">
          {language === "ko"
            ? "첫 번째 캠페인을 만들어 시작하세요"
            : "Create your first campaign to get started"}
        </p>
        <Button onClick={() => router.push("/campaigns/new")}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ko" ? "캠페인 만들기" : "Create Campaign"}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      {campaigns.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === "ko" ? "캠페인 검색..." : "Search campaigns..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
      )}

      {/* Campaign Grid */}
      <div className="grid grid-cols-1 gap-3 max-h-[320px] overflow-y-auto pr-1">
        {filteredCampaigns.map((campaign) => {
          const isSelected = value === campaign.id;
          return (
            <button
              key={campaign.id}
              onClick={() => onChange(campaign.id)}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all",
                "hover:border-primary/50 hover:bg-muted/50",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background"
              )}
            >
              <div className="flex items-center gap-4">
                {/* Campaign Icon/Cover */}
                <div
                  className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                    isSelected ? "bg-primary/10" : "bg-muted"
                  )}
                >
                  {campaign.cover_image_url ? (
                    <img
                      src={campaign.cover_image_url}
                      alt={campaign.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <FolderOpen
                      className={cn(
                        "h-6 w-6",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  )}
                </div>

                {/* Campaign Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-base truncate">
                      {campaign.name}
                    </h4>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {campaign.artist_stage_name || campaign.artist_name}
                  </p>

                  {/* Asset counts */}
                  <div className="flex items-center gap-3 mt-2">
                    {campaign.audio_count !== undefined && campaign.audio_count > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Music className="h-3 w-3" />
                        <span>{campaign.audio_count}</span>
                      </div>
                    )}
                    {campaign.image_count !== undefined && campaign.image_count > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        <span>{campaign.image_count}</span>
                      </div>
                    )}
                    {campaign.video_count !== undefined && campaign.video_count > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {campaign.video_count} {language === "ko" ? "영상" : "videos"}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Arrow indicator */}
                <ChevronRight
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground/50"
                  )}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* No results */}
      {filteredCampaigns.length === 0 && searchQuery && (
        <div className="text-center py-8 text-muted-foreground">
          <p>{language === "ko" ? "검색 결과가 없습니다" : "No campaigns found"}</p>
        </div>
      )}

      {/* Create new campaign button */}
      <Button
        variant="outline"
        className="w-full h-12 border-dashed"
        onClick={() => router.push("/campaigns/new")}
      >
        <Plus className="h-4 w-4 mr-2" />
        {language === "ko" ? "새 캠페인 만들기" : "Create New Campaign"}
      </Button>

      {/* Selected campaign info */}
      {selectedCampaign && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">
              {language === "ko" ? "선택됨:" : "Selected:"}
            </span>
            <span className="font-semibold">{selectedCampaign.name}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            {language === "ko"
              ? "이 캠페인의 에셋을 사용하여 영상을 생성합니다"
              : "Videos will be generated using this campaign's assets"}
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Campaign } from "@/lib/campaigns-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Pencil,
  Check,
  X,
  Calendar,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CampaignTabs, CompactCampaignTabs } from "./CampaignTabs";

interface CampaignWorkspaceHeaderProps {
  campaign: Campaign;
  onUpdate?: (data: { name: string; description?: string; status: string }) => Promise<void>;
  className?: string;
}

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  archived: "outline",
};

const statusLabels: Record<string, { ko: string; en: string }> = {
  draft: { ko: "초안", en: "Draft" },
  active: { ko: "활성", en: "Active" },
  completed: { ko: "완료", en: "Completed" },
  archived: { ko: "보관됨", en: "Archived" },
};

/**
 * Campaign Workspace Header with info and tabs
 * 캠페인 작업공간 헤더 - 정보와 탭 포함
 */
export function CampaignWorkspaceHeader({
  campaign,
  onUpdate,
  className,
}: CampaignWorkspaceHeaderProps) {
  const { language } = useI18n();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name: campaign.name,
    description: campaign.description || "",
    status: campaign.status,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(editData);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      name: campaign.name,
      description: campaign.description || "",
      status: campaign.status,
    });
    setEditMode(false);
  };

  return (
    <div className={cn("bg-background border-b", className)}>
      {/* Top Bar - Back button and campaign info */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">
                {language === "ko" ? "캠페인" : "Campaigns"}
              </span>
            </Button>
          </Link>

          <div className="h-6 w-px bg-border" />

          {editMode ? (
            <div className="flex-1 flex items-center gap-3">
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="max-w-xs h-9"
                placeholder={language === "ko" ? "캠페인 이름" : "Campaign name"}
              />
              <Select
                value={editData.status}
                onValueChange={(value) => setEditData({ ...editData, status: value as "draft" | "active" | "completed" | "archived" })}
              >
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{statusLabels.draft[language]}</SelectItem>
                  <SelectItem value="active">{statusLabels.active[language]}</SelectItem>
                  <SelectItem value="completed">{statusLabels.completed[language]}</SelectItem>
                  <SelectItem value="archived">{statusLabels.archived[language]}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Check className="h-4 w-4 mr-1" />
                {language === "ko" ? "저장" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">{campaign.name}</h1>
                <Badge variant={statusVariants[campaign.status]}>
                  {statusLabels[campaign.status]?.[language] || campaign.status}
                </Badge>
                {onUpdate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditMode(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Campaign metadata */}
              <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <span>{campaign.artist_stage_name || campaign.artist_name}</span>
                </div>
                {campaign.start_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(campaign.start_date).toLocaleDateString(
                        language === "ko" ? "ko-KR" : "en-US",
                        { month: "short", day: "numeric" }
                      )}
                      {campaign.end_date && (
                        <>
                          {" - "}
                          {new Date(campaign.end_date).toLocaleDateString(
                            language === "ko" ? "ko-KR" : "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs - Desktop */}
      <div className="hidden md:block">
        <CampaignTabs campaignId={campaign.id} />
      </div>

      {/* Tabs - Mobile */}
      <div className="md:hidden px-4 pb-4">
        <CompactCampaignTabs campaignId={campaign.id} />
      </div>
    </div>
  );
}

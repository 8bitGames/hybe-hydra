"use client";

import { useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useCampaign, useUpdateCampaign } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { useUIStore, type CampaignTab } from "@/lib/stores/ui-store";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Pencil,
  Check,
  X,
  FolderOpen,
  BarChart3,
  Calendar,
  User,
  type LucideIcon,
} from "lucide-react";

interface CampaignWorkspaceLayoutProps {
  children: React.ReactNode;
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

interface TabConfig {
  id: CampaignTab;
  icon: LucideIcon;
  path: string;
}

// Only Analytics and Assets tabs (Analytics is default)
const tabs: TabConfig[] = [
  { id: "analytics", icon: BarChart3, path: "" },  // Analytics is now the default (root path)
  { id: "assets", icon: FolderOpen, path: "/assets" },
];

/**
 * Campaign Workspace Layout - Redesigned with compact header
 * 캠페인 작업공간 레이아웃 - 컴팩트 헤더로 재설계
 */
export default function CampaignWorkspaceLayout({
  children,
}: CampaignWorkspaceLayoutProps) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { language, t } = useI18n();
  const { setActiveTab } = useUIStore();
  const campaignId = params.id as string;

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    description: "",
    status: "",
    start_date: "",
    end_date: "",
  });

  // Use TanStack Query for data fetching with caching
  const { data: campaign, isLoading: loading, error: campaignError } = useCampaign(campaignId);
  const updateCampaignMutation = useUpdateCampaign();

  // Initialize edit data when campaign loads
  if (campaign && editData.name === "" && editData.status === "") {
    setEditData({
      name: campaign.name,
      description: campaign.description || "",
      status: campaign.status,
      start_date: campaign.start_date || "",
      end_date: campaign.end_date || "",
    });
  }

  // Redirect if campaign not found
  if (campaignError) {
    router.push("/campaigns");
  }

  // Check if we're on a standalone page (should not show workspace tabs)
  // Includes: pipeline detail pages, create, curation, publish pages
  const isStandalonePage =
    pathname?.includes("/pipeline/") ||
    pathname?.includes("/compose-pipeline/") ||
    pathname?.includes("/create") ||
    pathname?.includes("/generate") ||
    pathname?.includes("/compose") ||
    pathname?.includes("/curation") ||
    pathname?.includes("/publish");

  // Determine current tab from pathname
  const getCurrentTab = (): CampaignTab => {
    if (!pathname) return "analytics";
    const basePath = `/campaigns/${campaignId}`;
    const subPath = pathname.replace(basePath, "");

    if (subPath.startsWith("/assets")) return "assets";
    if (subPath === "" || subPath === "/") return "analytics";  // Default is analytics
    return "analytics";
  };

  const currentTab = getCurrentTab();

  const handleTabClick = (tab: TabConfig) => {
    setActiveTab(tab.id);
    router.push(`/campaigns/${campaignId}${tab.path}`);
  };

  const handleSave = async () => {
    if (!campaign) return;
    updateCampaignMutation.mutate(
      {
        id: campaign.id,
        data: {
          name: editData.name,
          description: editData.description || undefined,
          status: editData.status,
          start_date: editData.start_date || undefined,
          end_date: editData.end_date || undefined,
        },
      },
      { onSuccess: () => setEditMode(false) }
    );
  };

  const saving = updateCampaignMutation.isPending;

  const handleCancelEdit = () => {
    if (campaign) {
      setEditData({
        name: campaign.name,
        description: campaign.description || "",
        status: campaign.status,
        start_date: campaign.start_date || "",
        end_date: campaign.end_date || "",
      });
    }
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (campaignError || !campaign) {
    return null;
  }

  // Standalone pages should render without the campaign workspace tabs
  if (isStandalonePage) {
    return (
      <div className="min-h-full">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-full px-[7%]">
      {/* Expanded Header with Campaign Info */}
      <div className="bg-background border border-border rounded-lg">
        {/* Back Button Row */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-1 text-sm">{language === "ko" ? "캠페인 목록" : "Campaigns"}</span>
            </Button>
          </Link>
        </div>

        {/* Campaign Info Section */}
        <div className="px-6 py-5 border-b border-border/50">
          {editMode ? (
            // Edit Mode
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ko" ? "캠페인 이름" : "Campaign Name"}</Label>
                  <Input
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    placeholder={language === "ko" ? "캠페인 이름" : "Campaign name"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ko" ? "상태" : "Status"}</Label>
                  <Select
                    value={editData.status}
                    onValueChange={(value) => setEditData({ ...editData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label[language]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === "ko" ? "설명" : "Description"}</Label>
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder={language === "ko" ? "캠페인 설명..." : "Campaign description..."}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ko" ? "시작일" : "Start Date"}</Label>
                  <Input
                    type="date"
                    value={editData.start_date}
                    onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ko" ? "종료일" : "End Date"}</Label>
                  <Input
                    type="date"
                    value={editData.end_date}
                    onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Check className="h-4 w-4 mr-1" />
                  {language === "ko" ? "저장" : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  {language === "ko" ? "취소" : "Cancel"}
                </Button>
              </div>
            </div>
          ) : (
            // View Mode
            <div className="space-y-4">
              {/* Title Row */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold">{campaign.name}</h1>
                    <Badge variant={statusVariants[campaign.status]}>
                      {statusLabels[campaign.status]?.[language] || campaign.status}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <p className="text-muted-foreground mt-2 text-sm line-clamp-2">
                      {campaign.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                  className="shrink-0"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  {language === "ko" ? "수정" : "Edit"}
                </Button>
              </div>

              {/* Info Grid */}
              <div className="flex flex-wrap gap-6 text-sm">
                {campaign.artist_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{campaign.artist_stage_name || campaign.artist_name}</span>
                  </div>
                )}
                {campaign.start_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(campaign.start_date).toLocaleDateString()}
                      {campaign.end_date && ` ~ ${new Date(campaign.end_date).toLocaleDateString()}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            const label = t.campaignWorkspace.tabs[tab.id];

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                  "border-b-2 hover:bg-muted/50",
                  isActive
                    ? "border-primary text-primary bg-muted/30"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      <div className="py-6">
        {children}
      </div>
    </div>
  );
}

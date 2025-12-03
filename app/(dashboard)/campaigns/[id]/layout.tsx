"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";
import { useI18n } from "@/lib/i18n";
import { useUIStore, type CampaignTab } from "@/lib/stores/ui-store";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Wand2,
  Video,
  Send,
  BarChart3,
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

const tabs: TabConfig[] = [
  { id: "assets", icon: FolderOpen, path: "" },
  { id: "create", icon: Wand2, path: "/create" },
  { id: "videos", icon: Video, path: "/curation" },
  { id: "publish", icon: Send, path: "/publish" },
  { id: "analytics", icon: BarChart3, path: "/analytics" },
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

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ name: "", status: "" });
  const [saving, setSaving] = useState(false);

  const loadCampaign = useCallback(async () => {
    try {
      const result = await campaignsApi.getById(campaignId);
      if (result.error) {
        setError(result.error.message);
        router.push("/campaigns");
        return;
      }
      if (result.data) {
        setCampaign(result.data);
        setEditData({ name: result.data.name, status: result.data.status });
      }
    } catch (err) {
      setError("Failed to load campaign");
      router.push("/campaigns");
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  // Check if we're on a standalone page (should not show workspace tabs)
  // Includes: pipeline detail pages and info page
  const isStandalonePage = pathname?.includes("/pipeline/") || pathname?.includes("/compose-pipeline/") || pathname?.endsWith("/info");

  // Determine current tab from pathname
  const getCurrentTab = (): CampaignTab => {
    if (!pathname) return "assets";
    const basePath = `/campaigns/${campaignId}`;
    const subPath = pathname.replace(basePath, "");

    if (subPath === "" || subPath === "/") return "assets";
    if (subPath.startsWith("/create")) return "create";
    if (subPath.startsWith("/generate")) return "create"; // Generate is under create
    if (subPath.startsWith("/compose")) return "create"; // Compose is under create
    if (subPath.startsWith("/curation")) return "videos";
    if (subPath.startsWith("/publish")) return "publish";
    if (subPath.startsWith("/analytics")) return "analytics";
    if (subPath.startsWith("/info")) return "info";
    return "assets";
  };

  const currentTab = getCurrentTab();

  const handleTabClick = (tab: TabConfig) => {
    setActiveTab(tab.id);
    router.push(`/campaigns/${campaignId}${tab.path}`);
  };

  const handleSave = async () => {
    if (!campaign) return;
    setSaving(true);
    try {
      const result = await campaignsApi.update(campaign.id, {
        name: editData.name,
        status: editData.status,
      });
      if (result.data) {
        setCampaign(result.data);
        setEditMode(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (campaign) {
      setEditData({ name: campaign.name, status: campaign.status });
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

  if (error || !campaign) {
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
    <div className="min-h-full -mx-4 -mt-6">
      {/* Compact Header Bar */}
      <div className="bg-background border-b">
        {/* Top Row: Back + Campaign Info */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>

          {editMode ? (
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="h-8 max-w-[200px] text-sm"
              />
              <Select
                value={editData.status}
                onValueChange={(value) => setEditData({ ...editData, status: value })}
              >
                <SelectTrigger className="h-8 w-24 text-sm">
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
              <Button size="sm" className="h-8" onClick={handleSave} disabled={saving}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={handleCancelEdit}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-3">
              <h1 className="text-base font-semibold truncate max-w-[300px]">
                {campaign.name}
              </h1>
              <Badge variant={statusVariants[campaign.status]} className="text-xs">
                {statusLabels[campaign.status]?.[language] || campaign.status}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setEditMode(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Artist info - hidden on mobile */}
          {!editMode && campaign.artist_name && (
            <div className="hidden lg:block text-sm text-muted-foreground">
              {campaign.artist_stage_name || campaign.artist_name}
            </div>
          )}
        </div>

        {/* Tab Navigation - Full width tabs */}
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
                  "flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors",
                  "border-b-2 hover:bg-muted/50",
                  isActive
                    ? "border-primary text-primary bg-muted/30"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

"use client";

import { useRouter, usePathname, useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useUIStore, type CampaignTab } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  Sparkles,
  Images,
  Video,
  Send,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

interface CampaignTabsProps {
  className?: string;
  campaignId: string;
}

interface TabConfig {
  id: CampaignTab;
  icon: LucideIcon;
  path: string;
  badge?: string;
}

// Convert kebab-case tab id to camelCase for translation lookup
const getTabTranslationKey = (tabId: CampaignTab): string => {
  if (tabId === "fast-cut") return "fastCut";
  return tabId;
};

/**
 * Tab navigation for Campaign Workspace
 * 캠페인 작업공간의 탭 네비게이션
 */
export function CampaignTabs({ className, campaignId }: CampaignTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language } = useI18n();
  const { activeTab, setActiveTab } = useUIStore();

  const tabs: TabConfig[] = [
    { id: "assets", icon: FolderOpen, path: "" },
    { id: "generate", icon: Sparkles, path: "/generate" },
    { id: "fast-cut", icon: Images, path: "/fast-cut" },
    { id: "videos", icon: Video, path: "/curation" },
    { id: "publish", icon: Send, path: "/publish" },
    { id: "analytics", icon: BarChart3, path: "/analytics" },
  ];

  // Determine active tab from pathname
  const getCurrentTab = (): CampaignTab => {
    if (!pathname) return "assets";

    const basePath = `/campaigns/${campaignId}`;
    const subPath = pathname.replace(basePath, "");

    if (subPath === "" || subPath === "/") return "assets";
    if (subPath.startsWith("/generate")) return "generate";
    if (subPath.startsWith("/fast-cut")) return "fast-cut";
    if (subPath.startsWith("/curation")) return "videos";
    if (subPath.startsWith("/publish")) return "publish";
    if (subPath.startsWith("/analytics")) return "analytics";

    return "assets";
  };

  const currentTab = getCurrentTab();

  const handleTabClick = (tab: TabConfig) => {
    setActiveTab(tab.id);
    router.push(`/campaigns/${campaignId}${tab.path}`);
  };

  return (
    <div className={cn("border-b", className)}>
      <nav className="flex gap-1 px-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          const label = t.campaignWorkspace.tabs[getTabTranslationKey(tab.id) as keyof typeof t.campaignWorkspace.tabs];

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                "border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {tab.badge && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {tab.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Compact/Mobile tab selector
 * 컴팩트/모바일 탭 선택기
 */
export function CompactCampaignTabs({ className, campaignId }: CampaignTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const { setActiveTab } = useUIStore();

  const tabs: TabConfig[] = [
    { id: "assets", icon: FolderOpen, path: "" },
    { id: "generate", icon: Sparkles, path: "/generate" },
    { id: "fast-cut", icon: Images, path: "/fast-cut" },
    { id: "videos", icon: Video, path: "/curation" },
    { id: "publish", icon: Send, path: "/publish" },
    { id: "analytics", icon: BarChart3, path: "/analytics" },
  ];

  const getCurrentTab = (): CampaignTab => {
    if (!pathname) return "assets";
    const basePath = `/campaigns/${campaignId}`;
    const subPath = pathname.replace(basePath, "");

    if (subPath === "" || subPath === "/") return "assets";
    if (subPath.startsWith("/generate")) return "generate";
    if (subPath.startsWith("/fast-cut")) return "fast-cut";
    if (subPath.startsWith("/curation")) return "videos";
    if (subPath.startsWith("/publish")) return "publish";
    if (subPath.startsWith("/analytics")) return "analytics";

    return "assets";
  };

  const currentTab = getCurrentTab();

  const handleTabClick = (tab: TabConfig) => {
    setActiveTab(tab.id);
    router.push(`/campaigns/${campaignId}${tab.path}`);
  };

  return (
    <div className={cn("flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all",
              isActive
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", isActive && "text-primary")} />
            <span className="hidden sm:inline">{t.campaignWorkspace.tabs[getTabTranslationKey(tab.id) as keyof typeof t.campaignWorkspace.tabs]}</span>
          </button>
        );
      })}
    </div>
  );
}

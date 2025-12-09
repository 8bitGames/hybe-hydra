"use client";

import { useState, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Campaign, campaignsApi } from "@/lib/campaigns-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
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
import {
  FolderOpen,
  Plus,
  Upload,
  Sparkles,
  LayoutGrid,
  Send,
  ChevronDown,
  ChevronRight,
  Zap,
  BarChart3,
  Check,
  Circle,
  PlayCircle,
  Home,
  Layers,
  TrendingUp,
  Wand2,
} from "lucide-react";

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (campaignId: string) => string;
  isComplete?: (campaign: Campaign) => boolean;
}

const workflowSteps: WorkflowStep[] = [
  {
    id: "assets",
    name: "Assets",
    description: "Upload source materials",
    icon: Upload,
    href: (id) => `/campaigns/${id}`,
    isComplete: (campaign) => (campaign.asset_count ?? 0) > 0,
  },
  {
    id: "generate",
    name: "AI Video",
    description: "AI creates video from prompt",
    icon: Sparkles,
    href: (id) => `/campaigns/${id}/generate`,
    isComplete: (campaign) => (campaign.video_count ?? 0) > 0,
  },
  {
    id: "fast-cut",
    name: "Fast Cut",
    description: "Build video from images + audio",
    icon: Wand2,
    href: (id) => `/campaigns/${id}/fast-cut`,
    isComplete: () => false, // Will be tracked separately
  },
  {
    id: "pipeline",
    name: "Variation",
    description: "Batch variations & A/B testing",
    icon: Layers,
    href: (id) => `/campaigns/${id}/pipeline`,
    isComplete: (campaign) => (campaign.video_count ?? 0) > 1,
  },
  {
    id: "curate",
    name: "Curate",
    description: "Review and select",
    icon: LayoutGrid,
    href: (id) => `/campaigns/${id}/curation`,
    isComplete: (campaign) => (campaign.approved_count ?? 0) > 0,
  },
  {
    id: "publish",
    name: "Publish",
    description: "Schedule to platforms",
    icon: Send,
    href: (id) => `/campaigns/${id}/publish`,
    isComplete: (campaign) => (campaign.published_count ?? 0) > 0,
  },
];

interface CampaignSidebarProps {
  className?: string;
}

export function CampaignSidebar({ className }: CampaignSidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const campaignId = params?.id as string | undefined;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaignsOpen, setCampaignsOpen] = useState(true);

  useEffect(() => {
    const loadCampaigns = async () => {
      setLoading(true);
      const result = await campaignsApi.getAll({ page_size: 50 });
      if (result.data) {
        setCampaigns(result.data.items);
        if (campaignId) {
          const current = result.data.items.find((c) => c.id === campaignId);
          setCurrentCampaign(current || null);
        }
      }
      setLoading(false);
    };
    loadCampaigns();
  }, [campaignId]);

  // Determine current workflow step
  const getCurrentStep = () => {
    if (pathname?.includes("/generate")) return "generate";
    if (pathname?.includes("/fast-cut")) return "fast-cut";
    if (pathname?.includes("/pipeline")) return "pipeline";
    if (pathname?.includes("/curation")) return "curate";
    if (pathname?.includes("/publish")) return "publish";
    if (pathname?.includes("/campaigns/") && campaignId) return "assets";
    return null;
  };

  const currentStep = getCurrentStep();

  const handleCampaignChange = (id: string) => {
    if (id === "new") {
      router.push("/campaigns/new");
    } else {
      router.push(`/campaigns/${id}`);
    }
  };

  return (
    <aside
      className={cn(
        "w-64 border-r bg-muted/30 flex flex-col h-[calc(100vh-3.5rem)]",
        className
      )}
    >
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Campaign Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Campaign
              </span>
              <Link href="/campaigns/new">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner className="h-5 w-5" />
              </div>
            ) : (
              <Select
                value={campaignId || ""}
                onValueChange={handleCampaignChange}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{campaign.name}</span>
                        <Badge
                          variant={
                            campaign.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                  <Separator className="my-1" />
                  <SelectItem value="new">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Plus className="h-3 w-3" />
                      New Campaign
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {currentCampaign && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {currentCampaign.artist_stage_name || currentCampaign.artist_name}
                </span>
                {currentCampaign.start_date && (
                  <span className="ml-2">
                    {new Date(currentCampaign.start_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Workflow Steps */}
          {campaignId && currentCampaign && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Workflow
              </span>

              <div className="space-y-1">
                {workflowSteps.map((step, index) => {
                  const isActive = currentStep === step.id;
                  const isComplete = step.isComplete?.(currentCampaign);
                  const stepNumber = index + 1;

                  return (
                    <Link
                      key={step.id}
                      href={step.href(campaignId)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                        "hover:bg-accent/50",
                        isActive && "bg-accent text-accent-foreground",
                        !isActive && "text-muted-foreground"
                      )}
                    >
                      {/* Step Indicator */}
                      <div
                        className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors",
                          isActive && "bg-primary text-primary-foreground",
                          isComplete && !isActive && "bg-green-500 text-white",
                          !isActive && !isComplete && "bg-muted text-muted-foreground"
                        )}
                      >
                        {isComplete && !isActive ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          stepNumber
                        )}
                      </div>

                      {/* Step Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-medium text-sm",
                              isActive && "text-foreground"
                            )}
                          >
                            {step.name}
                          </span>
                          {isActive && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {step.description}
                        </p>
                      </div>

                      {/* Step Icon */}
                      <step.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </Link>
                  );
                })}
              </div>

              {/* Progress Summary */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {workflowSteps.filter((s) => s.isComplete?.(currentCampaign)).length}
                    /{workflowSteps.length} steps
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${
                        (workflowSteps.filter((s) => s.isComplete?.(currentCampaign))
                          .length /
                          workflowSteps.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {!campaignId && (
            <div className="text-center py-8">
              <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Select a campaign to see workflow
              </p>
              <Link href="/campaigns/new">
                <Button variant="outline" size="sm" className="mt-3">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          )}

          <Separator />

          {/* Quick Links */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick Access
            </span>

            <nav className="space-y-1">
              <Link
                href="/bridge"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                  pathname === "/bridge" && "bg-accent text-foreground"
                )}
              >
                <Zap className="h-4 w-4" />
                <span className="text-sm">The Bridge</span>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Quick
                </Badge>
              </Link>

              <Link
                href="/dashboard"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                  pathname === "/dashboard" && "bg-accent text-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm">Dashboard</span>
              </Link>

              <Link
                href="/campaigns"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                  pathname === "/campaigns" && "bg-accent text-foreground"
                )}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="text-sm">All Campaigns</span>
              </Link>

              <Link
                href="/pipeline"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                  pathname === "/pipeline" && "bg-accent text-foreground"
                )}
              >
                <Layers className="h-4 w-4" />
                <span className="text-sm">Variation</span>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  A/B
                </Badge>
              </Link>

              <Link
                href="/trends"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                  pathname === "/trends" && "bg-accent text-foreground"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">TikTok Trends</span>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  New
                </Badge>
              </Link>
            </nav>
          </div>
        </div>
      </ScrollArea>

      {/* Campaign Count Footer */}
      <div className="p-4 border-t bg-muted/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{campaigns.length} campaigns</span>
          <span>
            {campaigns.filter((c) => c.status === "active").length} active
          </span>
        </div>
      </div>
    </aside>
  );
}

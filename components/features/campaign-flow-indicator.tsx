"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Sparkles,
  LayoutGrid,
  Send,
  Check,
  ChevronRight,
  Lightbulb,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignFlowIndicatorProps {
  campaign: {
    id: string;
    name: string;
    artistName: string;
    assetCount: number;
    videoCount: number;
    processingCount: number;
    completedCount: number;
    publishedCount: number;
    scheduledCount: number;
  };
  className?: string;
}

const flowSteps = [
  {
    id: "assets",
    label: "Assets",
    icon: Upload,
    href: (id: string) => `/campaigns/${id}`,
    getStatus: (c: CampaignFlowIndicatorProps["campaign"]) => ({
      count: c.assetCount,
      label: `${c.assetCount} files`,
      isComplete: c.assetCount > 0,
      isActive: false,
    }),
  },
  {
    id: "create",
    label: "Create",
    icon: Sparkles,
    href: (id: string) => `/campaigns/${id}/generate`,
    getStatus: (c: CampaignFlowIndicatorProps["campaign"]) => ({
      count: c.completedCount + c.processingCount,
      label: c.processingCount > 0
        ? `${c.completedCount} done, ${c.processingCount} processing`
        : `${c.completedCount} videos`,
      isComplete: c.completedCount > 0,
      isActive: c.processingCount > 0,
    }),
  },
  {
    id: "curate",
    label: "Curate",
    icon: LayoutGrid,
    href: (id: string) => `/campaigns/${id}/curation`,
    getStatus: (c: CampaignFlowIndicatorProps["campaign"]) => ({
      count: c.completedCount - c.publishedCount,
      label: `${c.completedCount - c.publishedCount} to review`,
      isComplete: c.publishedCount > 0,
      isActive: false,
    }),
  },
  {
    id: "publish",
    label: "Publish",
    icon: Send,
    href: (id: string) => `/campaigns/${id}/publish`,
    getStatus: (c: CampaignFlowIndicatorProps["campaign"]) => ({
      count: c.publishedCount,
      label: c.scheduledCount > 0
        ? `${c.publishedCount} live, ${c.scheduledCount} scheduled`
        : `${c.publishedCount} published`,
      isComplete: c.publishedCount > 0,
      isActive: c.scheduledCount > 0,
    }),
  },
];

const getNextStepMessage = (
  campaign: CampaignFlowIndicatorProps["campaign"],
  currentStep: string
): string => {
  if (campaign.assetCount === 0) {
    return "Start by uploading assets (images, videos, audio) for your campaign";
  }
  if (campaign.completedCount === 0 && campaign.processingCount === 0) {
    return "Generate your first video using AI or Compose from your assets";
  }
  if (campaign.processingCount > 0) {
    return `${campaign.processingCount} video(s) are being generated. Check back soon!`;
  }
  if (campaign.completedCount > campaign.publishedCount) {
    return "Review your generated videos and publish the best ones";
  }
  if (campaign.publishedCount > 0) {
    return "Track your published content performance in Analytics";
  }
  return "You're all set! Create more videos or publish existing ones";
};

export function CampaignFlowIndicator({
  campaign,
  className,
}: CampaignFlowIndicatorProps) {
  const pathname = usePathname();

  const getCurrentStep = () => {
    if (pathname?.includes("/generate") || pathname?.includes("/compose") || pathname?.includes("/pipeline")) {
      return "create";
    }
    if (pathname?.includes("/curation")) return "curate";
    if (pathname?.includes("/publish") || pathname?.includes("/analytics")) return "publish";
    return "assets";
  };

  const currentStep = getCurrentStep();

  return (
    <div className={cn("bg-muted/30 rounded-lg p-4 mb-6", className)}>
      {/* Campaign Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{campaign.name}</span>
          <Badge variant="outline" className="text-xs">
            {campaign.artistName}
          </Badge>
        </div>
      </div>

      {/* Flow Steps */}
      <div className="flex items-center justify-between mb-4">
        {flowSteps.map((step, idx) => {
          const status = step.getStatus(campaign);
          const isCurrentStep = currentStep === step.id;
          const stepIndex = flowSteps.findIndex((s) => s.id === currentStep);
          const isBeforeCurrent = idx < stepIndex;
          const isAfterCurrent = idx > stepIndex;

          return (
            <div key={step.id} className="flex items-center">
              <Link
                href={step.href(campaign.id)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[80px]",
                  isCurrentStep && "bg-primary/10",
                  !isCurrentStep && "hover:bg-muted"
                )}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    status.isComplete && !isCurrentStep && "bg-green-500 text-white",
                    status.isActive && "bg-blue-500 text-white animate-pulse",
                    isCurrentStep && !status.isActive && "bg-primary text-primary-foreground",
                    !status.isComplete && !isCurrentStep && !status.isActive && "bg-muted text-muted-foreground"
                  )}
                >
                  {status.isComplete && !isCurrentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>

                {/* Step Label */}
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrentStep && "text-primary",
                    !isCurrentStep && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>

                {/* Step Status */}
                <span className="text-[10px] text-muted-foreground text-center">
                  {status.label}
                </span>
              </Link>

              {/* Connector */}
              {idx < flowSteps.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-1",
                    isBeforeCurrent ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Next Step Hint */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 rounded-md p-2">
        <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
        <span>{getNextStepMessage(campaign, currentStep)}</span>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  Sparkles,
  FolderOpen,
  TrendingUp,
  ChevronDown,
  Bot,
  Wand2,
  Layers,
  Video,
  Send,
  Zap,
  Image,
  Library,
  Film,
  Search,
  Lightbulb,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore } from "@/lib/stores/workflow-store";

interface NavItem {
  name: { ko: string; en: string };
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: { ko: string; en: string };
  badge?: { ko: string; en: string };
  isWorkflow?: boolean;
  items?: {
    name: { ko: string; en: string };
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    description: { ko: string; en: string };
  }[];
}

// Workflow items - main 4-stage flow
const workflowItems: NavItem[] = [
  {
    name: { ko: "발견", en: "Discover" },
    href: "/discover",
    icon: Search,
    description: { ko: "트렌드 검색 및 영감 수집", en: "Search trends and gather inspiration" },
    isWorkflow: true,
  },
  {
    name: { ko: "분석", en: "Analyze" },
    href: "/analyze",
    icon: Lightbulb,
    description: { ko: "아이디어 정리 및 AI 브리프 생성", en: "Organize ideas and AI brief" },
    isWorkflow: true,
  },
  {
    name: { ko: "생성", en: "Create" },
    href: "/create",
    icon: Sparkles,
    description: { ko: "AI 영상 또는 컴포즈 영상 생성", en: "Generate AI or compose videos" },
    isWorkflow: true,
  },
  {
    name: { ko: "프로세싱", en: "Processing" },
    href: "/processing",
    icon: Loader2,
    description: { ko: "생성된 영상 확인 및 품질 검토", en: "Review generated videos and quality check" },
    isWorkflow: true,
  },
  {
    name: { ko: "발행", en: "Publish" },
    href: "/publish",
    icon: Send,
    description: { ko: "SNS 채널에 스케줄 발행", en: "Schedule and publish to SNS" },
    isWorkflow: true,
  },
];

// Secondary navigation items
const secondaryItems: NavItem[] = [
  {
    name: { ko: "대시보드", en: "Dashboard" },
    href: "/dashboard",
    icon: LayoutGrid,
  },
  {
    name: { ko: "캠페인", en: "Campaigns" },
    href: "/campaigns",
    icon: FolderOpen,
  },
  {
    name: { ko: "라이브러리", en: "Library" },
    icon: Library,
    items: [
      {
        name: { ko: "모든 영상", en: "All Videos" },
        href: "/videos",
        icon: Video,
        description: { ko: "생성된 모든 영상 보기", en: "View all generated videos" },
      },
      {
        name: { ko: "컴포즈 영상", en: "Compose Videos" },
        href: "/compose/gallery",
        icon: Film,
        description: { ko: "컴포즈로 만든 영상", en: "Videos created with Compose" },
      },
      {
        name: { ko: "에셋 관리", en: "Assets" },
        href: "/assets",
        icon: Image,
        description: { ko: "업로드된 이미지 및 파일", en: "Uploaded images and files" },
      },
      {
        name: { ko: "파이프라인", en: "Pipeline" },
        href: "/pipeline",
        icon: Layers,
        description: { ko: "생성 작업 현황", en: "Generation job status" },
      },
    ],
  },
];

interface MainNavigationProps {
  className?: string;
  mobile?: boolean;
}

export function MainNavigation({ className, mobile }: MainNavigationProps) {
  const pathname = usePathname();
  const { language } = useI18n();
  const isKorean = language === "ko";
  const currentStage = useWorkflowStore((state) => state.currentStage);

  const isActive = (href?: string, items?: NavItem["items"]) => {
    if (href) {
      // Handle query params in href
      const [hrefPath] = href.split("?");
      const [currentPath] = (pathname || "").split("?");

      if (hrefPath === currentPath) return true;

      // Special case: Pipeline detail pages under campaigns should activate "Pipeline", not "Campaigns"
      const isPipelineDetailPage = pathname?.includes("/pipeline/") || pathname?.includes("/compose-pipeline/");
      if (isPipelineDetailPage) {
        // Only match if this is the pipeline nav item
        return hrefPath === "/pipeline";
      }

      if (pathname?.startsWith(hrefPath + "/")) return true;

      return false;
    }
    if (items) {
      return items.some((item) => {
        const [itemPath] = item.href.split("?");
        const [currentPath] = (pathname || "").split("?");
        return currentPath === itemPath || pathname?.startsWith(itemPath + "/");
      });
    }
    return false;
  };

  // Check if current path is part of workflow
  const isInWorkflow = workflowItems.some((item) => isActive(item.href));

  if (mobile) {
    return (
      <nav className={cn("flex flex-col gap-1", className)}>
        {/* Workflow Section */}
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {isKorean ? "워크플로우" : "Workflow"}
        </div>
        <div className="flex flex-col gap-1 mb-4">
          {workflowItems.map((item, index) => (
            <div key={isKorean ? item.name.ko : item.name.en} className="flex items-center">
              <Link href={item.href!} className="flex-1">
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2 text-base font-semibold",
                    isActive(item.href) && "bg-zinc-100 dark:bg-zinc-800"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {isKorean ? item.name.ko : item.name.en}
                </Button>
              </Link>
              {index < workflowItems.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Secondary Section */}
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {isKorean ? "메뉴" : "Menu"}
        </div>
        {secondaryItems.map((item) => (
          <div key={isKorean ? item.name.ko : item.name.en}>
            {item.href ? (
              <Link href={item.href}>
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 text-base font-semibold"
                >
                  <item.icon className="h-5 w-5" />
                  {isKorean ? item.name.ko : item.name.en}
                </Button>
              </Link>
            ) : (
              <>
                <div className="px-3 py-2 text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <item.icon className="h-5 w-5" />
                  {isKorean ? item.name.ko : item.name.en}
                </div>
                <div className="ml-6 space-y-1">
                  {item.items?.map((subItem) => (
                    <Link key={subItem.href} href={subItem.href}>
                      <Button
                        variant={isActive(subItem.href) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2 text-base font-semibold"
                      >
                        <subItem.icon className="h-5 w-5" />
                        {isKorean ? subItem.name.ko : subItem.name.en}
                      </Button>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {/* Workflow Navigation - Primary */}
      <div className={cn(
        "flex items-center gap-0.5 px-2 py-1 rounded-lg",
        isInWorkflow ? "bg-zinc-100 dark:bg-zinc-900" : "bg-transparent"
      )}>
        {workflowItems.map((item, index) => (
          <div key={isKorean ? item.name.ko : item.name.en} className="flex items-center">
            <Link href={item.href!}>
              <Button
                variant={isActive(item.href) ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-1.5 text-sm font-medium h-8",
                  isActive(item.href) && "bg-white dark:bg-zinc-800 shadow-sm",
                  !isInWorkflow && "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {isKorean ? item.name.ko : item.name.en}
              </Button>
            </Link>
            {index < workflowItems.length - 1 && (
              <ArrowRight className={cn(
                "h-3 w-3 mx-0.5",
                isInWorkflow ? "text-muted-foreground" : "text-muted-foreground/50"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border mx-2" />

      {/* Secondary Navigation */}
      {secondaryItems.map((item) => {
        if (item.href) {
          return (
            <Link key={isKorean ? item.name.ko : item.name.en} href={item.href}>
              <Button
                variant={isActive(item.href) ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 text-sm font-medium h-8"
              >
                <item.icon className="h-4 w-4" />
                {isKorean ? item.name.ko : item.name.en}
              </Button>
            </Link>
          );
        }

        return (
          <DropdownMenu key={isKorean ? item.name.ko : item.name.en}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={isActive(undefined, item.items) ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 text-sm font-medium h-8"
              >
                <item.icon className="h-4 w-4" />
                {isKorean ? item.name.ko : item.name.en}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-sm font-semibold">
                {isKorean ? item.name.ko : item.name.en}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.items?.map((subItem) => (
                <DropdownMenuItem key={subItem.href} asChild>
                  <Link
                    href={subItem.href}
                    className="flex items-start gap-3 cursor-pointer"
                  >
                    <subItem.icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {isKorean ? subItem.name.ko : subItem.name.en}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isKorean ? subItem.description.ko : subItem.description.en}
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}

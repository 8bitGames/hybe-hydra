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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface NavItem {
  name: { ko: string; en: string };
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: { ko: string; en: string };
  items?: {
    name: { ko: string; en: string };
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    description: { ko: string; en: string };
  }[];
}

const navigationItems: NavItem[] = [
  {
    name: { ko: "대시보드", en: "Dashboard" },
    href: "/dashboard",
    icon: LayoutGrid,
  },
  {
    name: { ko: "만들기", en: "Create" },
    icon: Sparkles,
    items: [
      {
        name: { ko: "빠른 생성", en: "Quick Create" },
        href: "/create?mode=quick",
        icon: Zap,
        description: { ko: "1클릭 빠른 영상 생성", en: "One-click fast video creation" },
      },
      {
        name: { ko: "AI 생성", en: "AI Generate" },
        href: "/create?mode=generate",
        icon: Bot,
        description: { ko: "텍스트로 AI 영상 생성", en: "Generate AI videos from text" },
      },
      {
        name: { ko: "이미지 합성", en: "Image Compose" },
        href: "/create?mode=compose",
        icon: Wand2,
        description: { ko: "이미지와 음악으로 제작", en: "Create with images & music" },
      },
    ],
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
        name: { ko: "합성 갤러리", en: "Compose Gallery" },
        href: "/compose/gallery",
        icon: Film,
        description: { ko: "합성된 슬라이드쇼 영상", en: "Composed slideshow videos" },
      },
      {
        name: { ko: "에셋 관리", en: "Assets" },
        href: "/assets",
        icon: Image,
        description: { ko: "업로드된 이미지 및 파일", en: "Uploaded images and files" },
      },
    ],
  },
  {
    name: { ko: "트렌드", en: "Trends" },
    href: "/trends",
    icon: TrendingUp,
  },
  {
    name: { ko: "파이프라인", en: "Pipeline" },
    href: "/pipeline",
    icon: Layers,
  },
  {
    name: { ko: "발행", en: "Publishing" },
    href: "/publishing",
    icon: Send,
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

  const isActive = (href?: string, items?: NavItem["items"]) => {
    if (href) {
      // Handle query params in href
      const [hrefPath] = href.split("?");
      const [currentPath] = (pathname || "").split("?");

      if (hrefPath === currentPath) return true;
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

  if (mobile) {
    return (
      <nav className={cn("flex flex-col gap-1", className)}>
        {navigationItems.map((item) => (
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
                <div className="px-3 py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
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
    <nav className={cn("flex items-center gap-2", className)}>
      {navigationItems.map((item) => {
        if (item.href) {
          return (
            <Link key={isKorean ? item.name.ko : item.name.en} href={item.href}>
              <Button
                variant={isActive(item.href) ? "secondary" : "ghost"}
                className="gap-2 text-base font-semibold"
              >
                <item.icon className="h-5 w-5" />
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
                className="gap-2 text-base font-semibold"
              >
                <item.icon className="h-5 w-5" />
                {isKorean ? item.name.ko : item.name.en}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-base font-semibold">{isKorean ? item.name.ko : item.name.en}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.items?.map((subItem) => (
                <DropdownMenuItem key={subItem.href} asChild>
                  <Link
                    href={subItem.href}
                    className="flex items-start gap-3 cursor-pointer"
                  >
                    <subItem.icon className="h-5 w-5 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold">{isKorean ? subItem.name.ko : subItem.name.en}</div>
                      <div className="text-sm text-muted-foreground">
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

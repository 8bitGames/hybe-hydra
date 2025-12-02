"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  BarChart3,
  FolderOpen,
  PlayCircle,
  Send,
  Eye,
  Heart,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface QuickStatsProps {
  stats: {
    campaigns: number;
    videos: number;
    published: number;
    totalViews: number;
    totalLikes: number;
    engagementRate: number | null;
  } | null;
  loading?: boolean;
}

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

export function QuickStats({ stats, loading }: QuickStatsProps) {
  const { language } = useI18n();

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" />
            {language === "ko" ? "빠른 통계" : "Quick Stats"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Spinner className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const statItems = [
    {
      label: language === "ko" ? "캠페인" : "Campaigns",
      value: stats.campaigns,
      icon: FolderOpen,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: language === "ko" ? "영상" : "Videos",
      value: stats.videos,
      icon: PlayCircle,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: language === "ko" ? "발행됨" : "Published",
      value: stats.published,
      icon: Send,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: language === "ko" ? "조회수" : "Views",
      value: stats.totalViews,
      icon: Eye,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      format: true,
    },
    {
      label: language === "ko" ? "좋아요" : "Likes",
      value: stats.totalLikes,
      icon: Heart,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      format: true,
    },
    {
      label: language === "ko" ? "참여도" : "Engagement",
      value: stats.engagementRate,
      icon: TrendingUp,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
      suffix: "%",
      decimal: true,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5" />
          {language === "ko" ? "빠른 통계" : "Quick Stats"}
        </CardTitle>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            {language === "ko" ? "전체 대시보드" : "Full Dashboard"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="text-center p-3 rounded-lg bg-muted/30"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center",
                  item.bgColor
                )}
              >
                <item.icon className={cn("h-4 w-4", item.color)} />
              </div>
              <p className="text-xl font-bold">
                {item.decimal && item.value !== null
                  ? `${Number(item.value).toFixed(1)}${item.suffix || ""}`
                  : item.format
                  ? formatNumber(item.value)
                  : item.value ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  FolderOpen,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Eye,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface CampaignActivity {
  id: string;
  name: string;
  artistName: string;
  status: string;
  activities: {
    type: "processing" | "curation" | "scheduled" | "published";
    count: number;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  updatedAt: string;
}

interface ContinueWorkSectionProps {
  campaigns: CampaignActivity[];
  loading?: boolean;
}

const activityIcons = {
  processing: Clock,
  curation: LayoutGrid,
  scheduled: Send,
  published: CheckCircle,
};

const activityColors = {
  processing: "text-blue-500",
  curation: "text-yellow-500",
  scheduled: "text-purple-500",
  published: "text-green-500",
};

export function ContinueWorkSection({ campaigns, loading }: ContinueWorkSectionProps) {
  const router = useRouter();
  const { language } = useI18n();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {language === "ko" ? "이어서 작업하기" : "Continue where you left off"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {language === "ko" ? "이어서 작업하기" : "Continue where you left off"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">
              {language === "ko" ? "활성 캠페인이 없습니다" : "No active campaigns"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {language === "ko"
                ? "첫 캠페인을 만들거나 빠른 생성을 사용하세요"
                : "Create your first campaign or use Quick Create to get started"}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.push("/campaigns/new")}>
                {language === "ko" ? "새 캠페인" : "New Campaign"}
              </Button>
              <Button onClick={() => router.push("/create/generate")}>
                {language === "ko" ? "영상 만들기" : "Create Video"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          {language === "ko" ? "이어서 작업하기" : "Continue where you left off"}
        </CardTitle>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            {language === "ko" ? "전체 보기" : "View All"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {campaigns.slice(0, 5).map((campaign) => (
          <div
            key={campaign.id}
            className={cn(
              "p-4 rounded-lg border bg-card",
              "hover:bg-accent/50 transition-colors cursor-pointer"
            )}
            onClick={() => router.push(`/campaigns/${campaign.id}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium">{campaign.name}</h4>
                <p className="text-sm text-muted-foreground">{campaign.artistName}</p>
              </div>
              <Badge
                variant={campaign.status === "active" ? "default" : "secondary"}
              >
                {campaign.status === "active"
                  ? (language === "ko" ? "활성" : "active")
                  : campaign.status}
              </Badge>
            </div>

            {campaign.activities.length > 0 && (
              <div className="space-y-2">
                {campaign.activities.map((activity, idx) => {
                  const Icon = activityIcons[activity.type];
                  const getActionLabel = () => {
                    if (language === "ko") {
                      if (activity.type === "curation") return "검토";
                      if (activity.type === "processing") return "상태 확인";
                      if (activity.type === "scheduled") return "일정 보기";
                      if (activity.type === "published") return "분석 보기";
                    } else {
                      if (activity.type === "curation") return "Review";
                      if (activity.type === "processing") return "Check Status";
                      if (activity.type === "scheduled") return "View Schedule";
                      if (activity.type === "published") return "View Analytics";
                    }
                    return "";
                  };

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(activity.href);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={cn("h-4 w-4", activityColors[activity.type])}
                        />
                        <span className="text-muted-foreground">
                          {activity.count} {activity.label}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        {getActionLabel()}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {campaign.activities.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {language === "ko" ? "대기 중인 활동 없음" : "No pending activities"}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

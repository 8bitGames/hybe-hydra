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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Continue where you left off
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
            Continue where you left off
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">No active campaigns</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first campaign or use Quick Create to get started
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.push("/campaigns/new")}>
                New Campaign
              </Button>
              <Button onClick={() => router.push("/create/generate")}>
                Quick Create
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
          Continue where you left off
        </CardTitle>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            View All
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
                {campaign.status}
              </Badge>
            </div>

            {campaign.activities.length > 0 && (
              <div className="space-y-2">
                {campaign.activities.map((activity, idx) => {
                  const Icon = activityIcons[activity.type];
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
                        {activity.type === "curation" && "Review"}
                        {activity.type === "processing" && "Check Status"}
                        {activity.type === "scheduled" && "View Schedule"}
                        {activity.type === "published" && "View Analytics"}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {campaign.activities.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No pending activities
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

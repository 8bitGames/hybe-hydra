"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { QuickStartCards, ContinueWorkSection, QuickStats } from "@/components/features/home";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface DashboardStats {
  summary: {
    campaigns: {
      total: number;
      by_status: Record<string, number>;
    };
    generations: {
      total: number;
      by_status: Record<string, number>;
      scored: number;
      avg_quality_score: number | null;
      high_quality_count: number;
    };
    publishing: {
      total: number;
      by_status: Record<string, number>;
      by_platform: Record<string, number>;
    };
  };
  sns_performance: {
    total_published: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_saves: number;
    avg_engagement_rate: number | null;
    by_platform: Record<string, { posts: number; views: number; likes: number }>;
  };
  campaigns_overview: Array<{
    id: string;
    name: string;
    status: string;
    artist_name: string;
    artist_group: string | null;
    asset_count: number;
    generation_count: number;
    completed_generations: number;
    processing_generations: number;
    published_count: number;
    scheduled_count: number;
    total_views: number;
    updated_at: string;
  }>;
  recent_activity: {
    generations: Array<{
      id: string;
      campaign_id: string;
      campaign_name: string;
      prompt: string;
      output_url: string | null;
      quality_score: number | null;
      created_at: string;
    }>;
    published: Array<{
      id: string;
      campaign_id: string;
      campaign_name: string;
      platform: string;
      account_name: string;
      published_url: string | null;
      view_count: number | null;
      like_count: number | null;
      published_at: string | null;
    }>;
  };
}

export default function HomePage() {
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    try {
      const response = await api.get<DashboardStats>("/api/v1/dashboard/stats");
      if (response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error("Failed to load home data:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadData();
    }
  }, [loadData, isAuthenticated, accessToken]);

  // Transform campaigns data for ContinueWorkSection
  const campaignActivities = stats?.campaigns_overview.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    artistName: campaign.artist_name,
    status: campaign.status,
    activities: [
      ...(campaign.processing_generations > 0
        ? [
            {
              type: "processing" as const,
              count: campaign.processing_generations,
              label: "videos processing",
              href: `/campaigns/${campaign.id}/generate`,
              icon: null as any,
            },
          ]
        : []),
      ...(campaign.completed_generations > 0 && campaign.completed_generations > campaign.published_count
        ? [
            {
              type: "curation" as const,
              count: campaign.completed_generations - campaign.published_count,
              label: "videos to review",
              href: `/campaigns/${campaign.id}/curation`,
              icon: null as any,
            },
          ]
        : []),
      ...(campaign.scheduled_count > 0
        ? [
            {
              type: "scheduled" as const,
              count: campaign.scheduled_count,
              label: "scheduled",
              href: `/campaigns/${campaign.id}/publish`,
              icon: null as any,
            },
          ]
        : []),
      ...(campaign.published_count > 0
        ? [
            {
              type: "published" as const,
              count: campaign.published_count,
              label: "published",
              href: `/campaigns/${campaign.id}/analytics`,
              icon: null as any,
            },
          ]
        : []),
    ],
    updatedAt: campaign.updated_at,
  })) || [];

  // Transform stats for QuickStats
  const quickStats = stats
    ? {
        campaigns: stats.summary.campaigns.total,
        videos: stats.summary.generations.by_status.COMPLETED || 0,
        published: stats.summary.publishing.by_status.PUBLISHED || 0,
        totalViews: stats.sns_performance.total_views,
        totalLikes: stats.sns_performance.total_likes,
        engagementRate: stats.sns_performance.avg_engagement_rate,
      }
    : null;

  return (
    <div className="space-y-8 pb-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{user?.name ? `, ${user.name}` : ""}!
          </h1>
          <p className="text-muted-foreground">
            What would you like to create today?
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Start Cards - Goal-based entry points */}
      <QuickStartCards />

      {/* Continue Work Section */}
      <ContinueWorkSection campaigns={campaignActivities} loading={loading} />

      {/* Quick Stats */}
      <QuickStats stats={quickStats} loading={loading} />
    </div>
  );
}

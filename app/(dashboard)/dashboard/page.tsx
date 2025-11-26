"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { campaignsApi, Campaign, CampaignList } from "@/lib/campaigns-api";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, draft: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const result = await campaignsApi.getAll({ page_size: 5 });
        if (result.data) {
          setCampaigns(result.data.items);
          setStats({
            total: result.data.total,
            active: result.data.items.filter((c) => c.status === "active").length,
            draft: result.data.items.filter((c) => c.status === "draft").length,
          });
        }
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-300",
    active: "bg-green-500/20 text-green-300",
    completed: "bg-blue-500/20 text-blue-300",
    archived: "bg-yellow-500/20 text-yellow-300",
  };

  return (
    <>
      {/* Welcome Card */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-400">
          Ready to create amazing AI-generated videos?
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Campaigns</p>
              <p className="text-2xl font-bold text-white">{loading ? "-" : stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active</p>
              <p className="text-2xl font-bold text-white">{loading ? "-" : stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Draft</p>
              <p className="text-2xl font-bold text-white">{loading ? "-" : stats.draft}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Role</p>
              <p className="text-lg font-semibold text-white capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Recent Campaigns</h2>
          <Link
            href="/campaigns/new"
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
          >
            + New Campaign
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
            <p className="text-gray-400 mb-4">Create your first campaign to get started</p>
            <Link
              href="/campaigns/new"
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              Create Campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="block p-6 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{campaign.name}</h3>
                    <p className="text-gray-400 text-sm">
                      {campaign.artist_stage_name || campaign.artist_name || "No artist"}
                      {campaign.asset_count !== undefined && ` • ${campaign.asset_count} assets`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}>
                      {campaign.status}
                    </span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {campaigns.length > 0 && (
          <div className="p-4 border-t border-white/10 text-center">
            <Link href="/campaigns" className="text-purple-400 hover:text-purple-300 text-sm font-medium">
              View all campaigns →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

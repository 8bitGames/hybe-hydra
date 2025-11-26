"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { campaignsApi, artistsApi, Campaign, Artist } from "@/lib/campaigns-api";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [artistFilter, setArtistFilter] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [campaignsResult, artistsResult] = await Promise.all([
          campaignsApi.getAll({
            page,
            page_size: 10,
            status: statusFilter || undefined,
            artist_id: artistFilter || undefined,
          }),
          artistsApi.getAll(),
        ]);

        if (campaignsResult.data) {
          setCampaigns(campaignsResult.data.items);
          setTotalPages(campaignsResult.data.pages);
        }
        if (artistsResult.data) {
          setArtists(artistsResult.data);
        }
      } catch (error) {
        console.error("Failed to load campaigns:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [page, statusFilter, artistFilter]);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-300",
    active: "bg-green-500/20 text-green-300",
    completed: "bg-blue-500/20 text-blue-300",
    archived: "bg-yellow-500/20 text-yellow-300",
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    const result = await campaignsApi.delete(id);
    if (!result.error) {
      setCampaigns(campaigns.filter((c) => c.id !== id));
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Manage your video campaigns</p>
        </div>
        <Link
          href="/campaigns/new"
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Campaign
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-2">Artist</label>
            <select
              value={artistFilter}
              onChange={(e) => {
                setArtistFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Artists</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.stage_name || artist.name} {artist.group_name ? `(${artist.group_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          {(statusFilter || artistFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter("");
                  setArtistFilter("");
                  setPage(1);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Campaign List */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No campaigns found</h3>
            <p className="text-gray-400 mb-4">
              {statusFilter || artistFilter
                ? "Try adjusting your filters"
                : "Create your first campaign to get started"}
            </p>
            {!statusFilter && !artistFilter && (
              <Link
                href="/campaigns/new"
                className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Create Campaign
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-sm text-gray-400 font-medium">
              <div className="col-span-4">Campaign</div>
              <div className="col-span-2">Artist</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Assets</div>
              <div className="col-span-2">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-white/10">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-white/5 transition-colors items-center"
                >
                  <div className="col-span-4">
                    <Link href={`/campaigns/${campaign.id}`} className="block">
                      <h3 className="text-white font-medium hover:text-purple-400 transition-colors">
                        {campaign.name}
                      </h3>
                      {campaign.description && (
                        <p className="text-gray-400 text-sm truncate">{campaign.description}</p>
                      )}
                    </Link>
                  </div>

                  <div className="col-span-2">
                    <span className="text-gray-300">
                      {campaign.artist_stage_name || campaign.artist_name || "-"}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}>
                      {campaign.status}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-gray-300">{campaign.asset_count ?? 0}</span>
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="View"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => handleDelete(campaign.id, campaign.name)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}

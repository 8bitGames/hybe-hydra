"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi, artistsApi, Artist } from "@/lib/campaigns-api";

const COUNTRIES = [
  { code: "KR", name: "South Korea" },
  { code: "US", name: "United States" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "TH", name: "Thailand" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    artist_id: "",
    description: "",
    target_countries: [] as string[],
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    const loadArtists = async () => {
      const result = await artistsApi.getAll();
      if (result.data) {
        setArtists(result.data);
      }
    };
    loadArtists();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.name.trim()) {
      setError("Campaign name is required");
      setLoading(false);
      return;
    }

    if (!formData.artist_id) {
      setError("Please select an artist");
      setLoading(false);
      return;
    }

    const result = await campaignsApi.create({
      name: formData.name.trim(),
      artist_id: formData.artist_id,
      description: formData.description.trim() || undefined,
      target_countries: formData.target_countries.length > 0 ? formData.target_countries : undefined,
      start_date: formData.start_date || undefined,
      end_date: formData.end_date || undefined,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    if (result.data) {
      router.push(`/campaigns/${result.data.id}`);
    }
  };

  const toggleCountry = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      target_countries: prev.target_countries.includes(code)
        ? prev.target_countries.filter((c) => c !== code)
        : [...prev.target_countries, code],
    }));
  };

  // Group artists by group_name
  const groupedArtists = artists.reduce((acc, artist) => {
    const group = artist.group_name || "Solo";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(artist);
    return acc;
  }, {} as Record<string, Artist[]>);

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/campaigns"
          className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Campaigns
        </Link>
        <h1 className="text-3xl font-bold text-white">Create Campaign</h1>
        <p className="text-gray-400 mt-1">Set up a new video campaign for your artist</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Campaign Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Summer Comeback 2025"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Artist Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Artist <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.artist_id}
              onChange={(e) => setFormData({ ...formData, artist_id: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select an artist</option>
              {Object.entries(groupedArtists).map(([group, groupArtists]) => (
                <optgroup key={group} label={group}>
                  {groupArtists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.stage_name || artist.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the campaign..."
              rows={3}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Target Countries */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target Countries
            </label>
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => toggleCountry(country.code)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    formData.target_countries.includes(country.code)
                      ? "bg-purple-500 text-white"
                      : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                >
                  {country.name}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                "Create Campaign"
              )}
            </button>
            <Link
              href="/campaigns"
              className="px-6 py-3 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </>
  );
}

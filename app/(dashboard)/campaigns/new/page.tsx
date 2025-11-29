"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi, artistsApi, Artist } from "@/lib/campaigns-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";

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
          className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-2 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Campaigns
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Create Campaign</h1>
        <p className="text-muted-foreground mt-1">Set up a new video campaign for your artist</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardContent className="pt-6 space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Campaign Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Summer Comeback 2025"
              />
            </div>

            {/* Artist Selection */}
            <div className="space-y-2">
              <Label htmlFor="artist">
                Artist <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.artist_id}
                onValueChange={(value) => setFormData({ ...formData, artist_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an artist" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedArtists).map(([group, groupArtists]) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {groupArtists.map((artist) => (
                        <SelectItem key={artist.id} value={artist.id}>
                          {artist.stage_name || artist.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the campaign..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Target Countries */}
            <div className="space-y-2">
              <Label>Target Countries</Label>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((country) => {
                  const isSelected = formData.target_countries.includes(country.code);
                  return (
                    <Badge
                      key={country.code}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleCountry(country.code)}
                    >
                      {country.name}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4 border-t border-border">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Spinner className="h-5 w-5 mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Campaign"
                )}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/campaigns">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </>
  );
}

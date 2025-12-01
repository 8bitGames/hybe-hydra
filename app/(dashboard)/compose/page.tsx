"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import {
  Wand2,
  Search,
  FolderOpen,
  ArrowRight,
  Music,
  Image,
  Video,
  Film,
} from "lucide-react";

export default function ComposePage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadCampaigns = async () => {
      setLoading(true);
      try {
        const result = await campaignsApi.getAll({
          page: 1,
          page_size: 50,
          status: "active",
        });

        if (result.data) {
          setCampaigns(result.data.items);
        }
      } catch (error) {
        console.error("Failed to load campaigns:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCampaigns();
  }, []);

  const filteredCampaigns = campaigns.filter(
    (campaign) =>
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (campaign.artist_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (campaign.artist_stage_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const handleSelectCampaign = (campaignId: string) => {
    router.push(`/campaigns/${campaignId}/compose`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Compose</h1>
              <p className="text-muted-foreground">
                Create slideshow videos from images with AI-powered editing
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push("/compose/gallery")}>
            <Film className="h-4 w-4 mr-2" />
            View Gallery
          </Button>
        </div>

        {/* Feature Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Image className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">Auto Image Search</p>
                  <p className="text-xs text-muted-foreground">
                    Find trending visuals
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Music className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">Music Matching</p>
                  <p className="text-xs text-muted-foreground">
                    Sync to BPM & vibe
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">Video Rendering</p>
                  <p className="text-xs text-muted-foreground">
                    MoviePy engine
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Campaign Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select a Campaign</CardTitle>
          <CardDescription>
            Choose a campaign to start creating a slideshow video
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">No campaigns found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try a different search term"
                  : "Create an active campaign first to use Compose"}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredCampaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => handleSelectCampaign(campaign.id)}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">
                        {campaign.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {campaign.artist_stage_name ||
                          campaign.artist_name ||
                          "No artist"}
                      </span>
                      <span>{campaign.asset_count ?? 0} assets</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                    <span className="text-sm hidden sm:inline">
                      Start Compose
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">How Compose Works</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                1
              </span>
              <span>
                <strong className="text-foreground">Script Generation</strong> -
                AI generates engaging text overlay scripts for your video
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                2
              </span>
              <span>
                <strong className="text-foreground">Image Search</strong> -
                Automatically find and select trending images matching your
                content
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                3
              </span>
              <span>
                <strong className="text-foreground">Music Matching</strong> -
                Select background music from your asset locker matched by vibe
                and BPM
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                4
              </span>
              <span>
                <strong className="text-foreground">Render & Export</strong> -
                MoviePy renders your slideshow video with beat-synchronized cuts
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

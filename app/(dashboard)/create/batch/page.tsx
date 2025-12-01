"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { Campaign } from "@/lib/campaigns-api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  FolderOpen,
  Plus,
  ArrowRight,
  Lightbulb,
  Sparkles,
  Palette,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const variationStyles = [
  { id: "dramatic", name: "Dramatic", description: "High contrast, intense" },
  { id: "soft", name: "Soft", description: "Gentle, pastel tones" },
  { id: "vibrant", name: "Vibrant", description: "Bold, saturated colors" },
  { id: "monochrome", name: "Monochrome", description: "Black & white" },
  { id: "vintage", name: "Vintage", description: "Retro film look" },
  { id: "neon", name: "Neon", description: "Cyberpunk glow" },
];

export default function BatchVariationsPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["dramatic", "soft", "vibrant"]);

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setCampaignsLoading(true);
    try {
      const response = await api.get<{ items: Campaign[] }>("/api/v1/campaigns");
      if (response.data) {
        setCampaigns(response.data.items);
      }
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setCampaignsLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const toggleStyle = (styleId: string) => {
    setSelectedStyles((prev) =>
      prev.includes(styleId)
        ? prev.filter((s) => s !== styleId)
        : [...prev, styleId]
    );
  };

  const handleStartBatch = () => {
    if (selectedCampaign) {
      router.push(`/campaigns/${selectedCampaign}/pipeline?styles=${selectedStyles.join(",")}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Layers className="h-4 w-4" />
          <span>Create</span>
          <span>/</span>
          <span className="text-foreground">Batch Variations</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Batch Variations</h1>
        <p className="text-muted-foreground mt-1">
          Generate multiple video variations from a seed video for A/B testing
        </p>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-primary">1</span>
              </div>
              <h3 className="font-medium">Select Seed Video</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose an existing generated video as the base
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-primary">2</span>
              </div>
              <h3 className="font-medium">Choose Styles</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Select style variations to generate
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-primary">3</span>
              </div>
              <h3 className="font-medium">Generate & Compare</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Review all variations and pick the best
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Select Campaign
          </CardTitle>
          <CardDescription>
            Choose a campaign with existing videos to create variations from
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign</Label>
            <Select
              value={selectedCampaign}
              onValueChange={setSelectedCampaign}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a campaign..." />
              </SelectTrigger>
              <SelectContent>
                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-4 w-4" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No campaigns yet. Create one first.
                  </div>
                ) : (
                  campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {campaign.name}
                        <Badge variant="secondary" className="text-[10px]">
                          {campaign.video_count || 0} videos
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Style Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Variation Styles
          </CardTitle>
          <CardDescription>
            Select the styles you want to generate variations in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {variationStyles.map((style) => (
              <button
                key={style.id}
                onClick={() => toggleStyle(style.id)}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all",
                  selectedStyles.includes(style.id)
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-muted-foreground/50"
                )}
              >
                <div className="font-medium">{style.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {style.description}
                </div>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Selected: {selectedStyles.length} styles ({selectedStyles.length} variations will be created)
          </p>
        </CardContent>
      </Card>

      {/* Start Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            size="lg"
            className="w-full"
            onClick={handleStartBatch}
            disabled={!selectedCampaign || selectedStyles.length === 0}
          >
            <Layers className="h-4 w-4 mr-2" />
            Continue to Pipeline
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Why use Batch Variations?</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Test different visual styles to see what performs best</li>
                <li>• Generate multiple versions for A/B testing on social media</li>
                <li>• Save time by creating variations in one batch</li>
                <li>• Compare side-by-side before publishing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

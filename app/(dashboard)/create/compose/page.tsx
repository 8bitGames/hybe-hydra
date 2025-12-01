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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wand2,
  Image as ImageIcon,
  Music,
  FolderOpen,
  Plus,
  ArrowRight,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const composeSteps = [
  {
    step: 1,
    title: "Script",
    description: "Generate AI script with trending keywords",
    icon: Sparkles,
  },
  {
    step: 2,
    title: "Images",
    description: "Search and select images for your video",
    icon: ImageIcon,
  },
  {
    step: 3,
    title: "Music",
    description: "Match music based on BPM and mood",
    icon: Music,
  },
  {
    step: 4,
    title: "Render",
    description: "Create your video with effects",
    icon: Wand2,
  },
];

export default function QuickComposePage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [saveMode, setSaveMode] = useState<"new" | "existing">("existing");

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

  const handleStartCompose = () => {
    if (selectedCampaign) {
      router.push(`/campaigns/${selectedCampaign}/compose`);
    } else {
      setShowCampaignModal(true);
    }
  };

  const handleSelectCampaign = () => {
    if (saveMode === "new" && !newCampaignName.trim()) return;
    if (saveMode === "existing" && !selectedCampaign) return;

    if (saveMode === "new") {
      router.push(`/campaigns/new?name=${encodeURIComponent(newCampaignName)}&redirect=compose`);
    } else {
      router.push(`/campaigns/${selectedCampaign}/compose`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Wand2 className="h-4 w-4" />
          <span>Create</span>
          <span>/</span>
          <span className="text-foreground">Image Compose</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Image Compose</h1>
        <p className="text-muted-foreground mt-1">
          Combine images and audio to create engaging video content
        </p>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Compose Works</CardTitle>
          <CardDescription>
            Create videos by combining images with music in 4 simple steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {composeSteps.map((step, idx) => (
              <div key={step.step} className="relative">
                <div className="flex flex-col items-center text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="font-medium">{step.title}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </p>
                </div>
                {idx < composeSteps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
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
            Choose a campaign to access your assets and save the composed video
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
                <SelectValue placeholder="Select a campaign to start..." />
              </SelectTrigger>
              <SelectContent>
                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-4 w-4" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No campaigns yet.
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => router.push("/campaigns/new")}
                    >
                      Create one
                    </Button>
                  </div>
                ) : (
                  campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {campaign.name}
                        <Badge variant="secondary" className="text-[10px]">
                          {campaign.artist_stage_name || campaign.artist_name}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Your campaign&apos;s audio assets will be available for music matching
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              size="lg"
              className="flex-1"
              onClick={handleStartCompose}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              {selectedCampaign ? "Start Composing" : "Select Campaign to Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Why Compose */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">When to use Compose</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• You have existing images you want to turn into a video</li>
                <li>• You want to sync visuals to specific music</li>
                <li>• You need quick content for social media</li>
                <li>• You want to leverage trending keywords and TikTok SEO</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Selection Modal */}
      <Dialog open={showCampaignModal} onOpenChange={setShowCampaignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a Campaign</DialogTitle>
            <DialogDescription>
              Compose requires a campaign for asset management
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div
                className={cn(
                  "p-4 rounded-lg border cursor-pointer transition-colors",
                  saveMode === "existing"
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/50"
                )}
                onClick={() => setSaveMode("existing")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">Use existing campaign</span>
                </div>
                {saveMode === "existing" && (
                  <Select
                    value={selectedCampaign}
                    onValueChange={setSelectedCampaign}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div
                className={cn(
                  "p-4 rounded-lg border cursor-pointer transition-colors",
                  saveMode === "new"
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/50"
                )}
                onClick={() => setSaveMode("new")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">Create new campaign</span>
                </div>
                {saveMode === "new" && (
                  <Input
                    placeholder="Campaign name (e.g., Carly Pearce Summer)"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSelectCampaign}
              disabled={
                (saveMode === "new" && !newCampaignName.trim()) ||
                (saveMode === "existing" && !selectedCampaign)
              }
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

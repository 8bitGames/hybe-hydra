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
  Bot,
  Sparkles,
  Music,
  FolderOpen,
  Plus,
  ArrowRight,
  Lightbulb,
  Wand2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

const generateSteps = [
  {
    step: 1,
    title: "Prompt",
    description: "Describe your video with AI optimization",
    icon: Sparkles,
  },
  {
    step: 2,
    title: "Audio",
    description: "Select music to sync with your video",
    icon: Music,
  },
  {
    step: 3,
    title: "Style",
    description: "Choose visual presets and effects",
    icon: Wand2,
  },
  {
    step: 4,
    title: "Generate",
    description: "AI creates your video with Veo",
    icon: Play,
  },
];

export default function AIGeneratePage() {
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

  const handleStartGenerate = () => {
    if (selectedCampaign) {
      router.push(`/campaigns/${selectedCampaign}/generate`);
    } else {
      setShowCampaignModal(true);
    }
  };

  const handleSelectCampaign = () => {
    if (saveMode === "new" && !newCampaignName.trim()) return;
    if (saveMode === "existing" && !selectedCampaign) return;

    if (saveMode === "new") {
      router.push(`/campaigns/new?name=${encodeURIComponent(newCampaignName)}&redirect=generate`);
    } else {
      router.push(`/campaigns/${selectedCampaign}/generate`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Bot className="h-4 w-4" />
          <span>Create</span>
          <span>/</span>
          <span className="text-foreground">AI Generate</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">AI Video Generation</h1>
        <p className="text-muted-foreground mt-1">
          Describe your video and let AI create it for you
        </p>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How AI Generation Works</CardTitle>
          <CardDescription>
            Create AI-powered videos in 4 simple steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {generateSteps.map((step, idx) => (
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
                {idx < generateSteps.length - 1 && (
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
            Choose a campaign to access your assets and generate videos
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
              Your campaign&apos;s audio and image assets will be available for generation
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              size="lg"
              className="flex-1"
              onClick={handleStartGenerate}
            >
              <Bot className="h-4 w-4 mr-2" />
              {selectedCampaign ? "Start Generating" : "Select Campaign to Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Why AI Generate */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">When to use AI Generate</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• You want AI to create unique video content from text</li>
                <li>• You need high-quality visuals synced to music</li>
                <li>• You want to generate multiple style variations</li>
                <li>• You want to leverage trending content and viral styles</li>
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
              AI Generation requires a campaign for audio assets and organization
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

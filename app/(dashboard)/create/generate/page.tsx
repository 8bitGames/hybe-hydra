"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { Campaign } from "@/lib/campaigns-api";
import { trackQuickCreate } from "@/lib/analytics";
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
import { Textarea } from "@/components/ui/textarea";
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
  Zap,
  FolderOpen,
  Plus,
  Download,
  Save,
  ArrowRight,
  Lightbulb,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const stylePresets = [
  { id: "cinematic", name: "Cinematic", description: "Movie-like quality" },
  { id: "energetic", name: "Energetic", description: "Fast-paced, dynamic" },
  { id: "emotional", name: "Emotional", description: "Soft, heartfelt" },
  { id: "minimal", name: "Minimal", description: "Clean, simple" },
  { id: "retro", name: "Retro", description: "Vintage aesthetic" },
  { id: "futuristic", name: "Futuristic", description: "Sci-fi inspired" },
];

export default function QuickGeneratePage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();

  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("cinematic");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("quick-create");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [generatedVideo, setGeneratedVideo] = useState<{
    id: string;
    url: string;
    prompt: string;
  } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
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

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    trackQuickCreate.generateClick();
    setLoading(true);
    try {
      // If a real campaign is selected (not quick-create), redirect to campaign generation
      if (selectedCampaign && selectedCampaign !== "quick-create") {
        router.push(`/campaigns/${selectedCampaign}/generate?prompt=${encodeURIComponent(prompt)}&style=${selectedStyle}`);
        return;
      }

      // Quick create mode - generate without campaign using Quick Create API
      const response = await api.post<{ id: string; status: string }>("/api/v1/quick-create", {
        prompt: prompt.trim(),
        reference_style: selectedStyle,
        aspect_ratio: "9:16",
        duration_seconds: 5,
      });

      if (response.data?.id) {
        trackQuickCreate.success(response.data.id);
        // Redirect to a result page or show success
        setGeneratedVideo({
          id: response.data.id,
          url: "",  // Will be populated when generation completes
          prompt: prompt,
        });
        setShowSaveModal(true);
      }
      setLoading(false);
    } catch (err) {
      console.error("Failed to generate:", err);
      trackQuickCreate.abandon('generation_error');
      setLoading(false);
    }
  };

  const handleSaveToCampaign = async () => {
    if (saveMode === "new" && !newCampaignName.trim()) return;
    if (saveMode === "existing" && (!selectedCampaign || selectedCampaign === "quick-create")) return;

    // If we have a generated video, save it to campaign
    if (generatedVideo?.id) {
      try {
        if (saveMode === "new") {
          trackQuickCreate.saveToCampaign('new');
          // Create new campaign first, then save
          router.push(`/campaigns/new?name=${encodeURIComponent(newCampaignName)}&quickCreateId=${generatedVideo.id}`);
        } else {
          trackQuickCreate.saveToCampaign('existing', selectedCampaign);
          // Save to existing campaign
          await api.post(`/api/v1/quick-create/${generatedVideo.id}/save-to-campaign`, {
            campaign_id: selectedCampaign,
          });
          router.push(`/campaigns/${selectedCampaign}/curation`);
        }
      } catch (err) {
        console.error("Failed to save to campaign:", err);
      }
    } else {
      // No generated video yet, redirect to campaign generate page
      if (saveMode === "new") {
        router.push(`/campaigns/new?name=${encodeURIComponent(newCampaignName)}&redirect=generate&prompt=${encodeURIComponent(prompt)}&style=${selectedStyle}`);
      } else {
        router.push(`/campaigns/${selectedCampaign}/generate?prompt=${encodeURIComponent(prompt)}&style=${selectedStyle}`);
      }
    }
  };

  const handleViewResult = () => {
    if (generatedVideo?.id) {
      trackQuickCreate.viewVideos();
      router.push(`/videos?highlight=${generatedVideo.id}`);
    }
  };

  const handleCreateAnother = () => {
    trackQuickCreate.createAnother();
    setShowSaveModal(false);
    setGeneratedVideo(null);
    setPrompt("");
  };

  const promptSuggestions = [
    "Carly Pearce performing emotional country ballad on stage with soft spotlight",
    "Dynamic concert footage with crowd cheering and confetti falling",
    "Cinematic artist portrait with dramatic lighting and slow motion",
    "Music video style with artistic transitions and color grading",
  ];

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

      {/* Quick Create Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Zap className="h-3 w-3" />
          Quick Create Mode
        </Badge>
        <span className="text-sm text-muted-foreground">
          Generate without selecting a campaign first
        </span>
      </div>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Describe Your Video
          </CardTitle>
          <CardDescription>
            Write a detailed description of the video you want to create
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Video Description</Label>
            <Textarea
              id="prompt"
              placeholder="Describe your video in detail... e.g., Carly Pearce performing an emotional country ballad on stage with soft lighting and intimate atmosphere"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Be specific about the mood, lighting, camera angles, and atmosphere
            </p>
          </div>

          {/* Prompt Suggestions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Suggestions
            </Label>
            <div className="flex flex-wrap gap-2">
              {promptSuggestions.map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1.5 px-3"
                  onClick={() => setPrompt(suggestion)}
                >
                  {suggestion.length > 50 ? suggestion.slice(0, 50) + "..." : suggestion}
                </Button>
              ))}
            </div>
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <Label>Visual Style</Label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {stylePresets.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={cn(
                    "p-3 rounded-lg border text-center transition-all",
                    selectedStyle === style.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-muted-foreground/50"
                  )}
                >
                  <div className="font-medium text-sm">{style.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {style.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Campaign Selection (Optional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Campaign (Optional)
            </Label>
            <Select
              value={selectedCampaign}
              onValueChange={setSelectedCampaign}
            >
              <SelectTrigger>
                <SelectValue placeholder="Quick Create (no campaign)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quick-create">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Quick Create (no campaign)
                  </div>
                </SelectItem>
                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-4 w-4" />
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
              Select a campaign to organize your video, or use Quick Create to test first
            </p>
          </div>

          {/* Generate Button */}
          <div className="flex gap-3 pt-4">
            <Button
              size="lg"
              className="flex-1"
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Video
                </>
              )}
            </Button>
          </div>
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
              <h3 className="font-medium mb-1">Quick Create vs Campaign</h3>
              <p className="text-sm text-muted-foreground">
                <strong>Quick Create:</strong> Test ideas instantly without setup. You can save the result to a campaign later.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                <strong>Campaign:</strong> Organize multiple videos, manage assets, and track publishing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Create Result / Save to Campaign Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {generatedVideo?.id ? (
                <>
                  <Sparkles className="h-5 w-5 text-green-500" />
                  Video Generation Started!
                </>
              ) : (
                "Select a Campaign"
              )}
            </DialogTitle>
            <DialogDescription>
              {generatedVideo?.id
                ? "Your video is being generated. You can save it to a campaign or view it later in All Videos."
                : "To generate a video, please select a campaign or create a new one"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {generatedVideo?.id && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">Quick Create in Progress</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Generation ID: {generatedVideo.id.slice(0, 8)}...
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Prompt: {generatedVideo.prompt.slice(0, 50)}...
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">Save to campaign (optional):</p>
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
                  <span className="font-medium">Add to existing campaign</span>
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {generatedVideo?.id && (
              <Button variant="outline" onClick={handleViewResult} className="w-full sm:w-auto">
                View in All Videos
              </Button>
            )}
            <Button variant="outline" onClick={generatedVideo?.id ? handleCreateAnother : () => setShowSaveModal(false)}>
              {generatedVideo?.id ? "Create Another" : "Cancel"}
            </Button>
            <Button
              onClick={handleSaveToCampaign}
              disabled={
                (saveMode === "new" && !newCampaignName.trim()) ||
                (saveMode === "existing" && (!selectedCampaign || selectedCampaign === "quick-create"))
              }
            >
              <Save className="h-4 w-4 mr-2" />
              Save to Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

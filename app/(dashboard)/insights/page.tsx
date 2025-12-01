"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Zap,
  ExternalLink,
  ArrowRight,
  Sparkles,
  BarChart3,
  Search,
  Hash,
  Play,
} from "lucide-react";

export default function InsightsPage() {
  const router = useRouter();
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleAnalyzeVideo = () => {
    if (tiktokUrl.trim()) {
      router.push(`/bridge?url=${encodeURIComponent(tiktokUrl)}`);
    }
  };

  const handleSearchTrends = () => {
    if (searchKeyword.trim()) {
      router.push(`/trends?keyword=${encodeURIComponent(searchKeyword)}`);
    }
  };

  const popularHashtags = [
    { tag: "#countrymusic", count: "2.5M" },
    { tag: "#newmusic", count: "1.8M" },
    { tag: "#carlypearce", count: "850K" },
    { tag: "#nashville", count: "1.2M" },
    { tag: "#countryartist", count: "650K" },
    { tag: "#musicvideo", count: "3.1M" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground mt-1">
          Analyze TikTok trends and discover what&apos;s working
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="analyze" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analyze" className="gap-2">
            <Zap className="h-4 w-4" />
            Video Analysis
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Trend Discovery
          </TabsTrigger>
        </TabsList>

        {/* Video Analysis Tab */}
        <TabsContent value="analyze" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                The Bridge - Video Analysis
              </CardTitle>
              <CardDescription>
                Paste a TikTok URL to analyze its style and generate similar content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tiktok-url">TikTok Video URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="tiktok-url"
                    placeholder="https://www.tiktok.com/@user/video/..."
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAnalyzeVideo} disabled={!tiktokUrl.trim()}>
                    Analyze
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">What you&apos;ll get:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Video style analysis (colors, pace, mood)</li>
                  <li>• Trending elements identification</li>
                  <li>• AI-generated prompts for similar content</li>
                  <li>• One-click generation from analysis</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => router.push("/bridge")}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Play className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Full Bridge Experience</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Advanced analysis with detailed breakdowns
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => router.push("/create/generate")}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Create from Scratch</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Generate without reference video
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trend Discovery
              </CardTitle>
              <CardDescription>
                Explore trending hashtags and content patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyword">Search Trends</Label>
                <div className="flex gap-2">
                  <Input
                    id="keyword"
                    placeholder="Search for hashtag or keyword..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleSearchTrends}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>

              {/* Popular Hashtags */}
              <div className="space-y-2">
                <Label>Popular Hashtags</Label>
                <div className="flex flex-wrap gap-2">
                  {popularHashtags.map((hashtag) => (
                    <Button
                      key={hashtag.tag}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setSearchKeyword(hashtag.tag)}
                    >
                      <Hash className="h-3 w-3" />
                      {hashtag.tag.replace("#", "")}
                      <Badge variant="secondary" className="text-[10px]">
                        {hashtag.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => router.push("/trends")}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Full Trends Dashboard</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Detailed analytics and trend reports
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => router.push("/create/compose")}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Sparkles className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Trend-Based Compose</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create content using trending keywords
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Trend Collection</h3>
                  <p className="text-sm text-muted-foreground">
                    Trends are automatically collected every 6 hours from TikTok.
                    Use the Compose feature to automatically incorporate trending
                    keywords into your video scripts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

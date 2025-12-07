"use client";

import { cn } from "@/lib/utils";
import React from "react";
import {
  MagnifyingGlass,
  Hash,
  Heart,
  Eye,
  Play,
  ChatCircle,
  TrendUp,
  Trophy,
  Fire,
  Lightning,
  Target,
  CheckCircle,
  Check,
  Folder,
  Plus,
  Image as ImageIcon,
  MusicNote,
  Video,
  Globe,
  MapPin,
  Users,
  ChartLineUp,
  ArrowRight,
  Star,
  RocketLaunch,
  Sparkle,
  CaretDown,
  Clock,
  CalendarBlank,
  ShareNetwork
} from "@phosphor-icons/react";

// Shared styles
const cardBg = "bg-zinc-900/80 backdrop-blur";
const textPrimary = "text-white";
const textSecondary = "text-zinc-400";
const textMuted = "text-zinc-500";
const border = "border border-zinc-700/50";
const accentYellow = "#F7F91D";

// ============================================================================
// Trend Intelligence Mockup
// ============================================================================
export function TrendIntelligenceMockup() {
  const trendVideos = [
    { views: "2.4M", engagement: "8.2%", rank: 1 },
    { views: "1.8M", engagement: "7.5%", rank: 2 },
    { views: "1.2M", engagement: "6.8%", rank: 3 },
    { views: "890K", engagement: "5.9%", rank: 4 },
  ];

  const hashtags = ["#kpop", "#dance", "#viral", "#fyp", "#trending"];
  const stats = [
    { label: "Avg Views", value: "1.2M", icon: Eye },
    { label: "Engagement", value: "7.1%", icon: Lightning },
    { label: "Viral", value: ">5%", icon: Trophy },
    { label: "High", value: ">3%", icon: Target },
  ];

  return (
    <div className={cn("rounded-xl p-3 h-full", cardBg, border)}>
      {/* Search bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5">
          <MagnifyingGlass size={12} className={textMuted} weight="bold" />
          <span className="text-[10px] text-zinc-500">countrymusic</span>
        </div>
        <div className="px-2 py-1 bg-white text-black rounded-md text-[9px] font-medium flex items-center gap-1">
          <Sparkle size={10} weight="fill" />
          Analyze
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-800/50 rounded-md p-1.5 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <stat.icon size={8} className={textMuted} weight="bold" />
              <span className="text-[7px] text-zinc-500">{stat.label}</span>
            </div>
            <div className="text-[10px] font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg p-2 mb-3 border border-purple-500/20">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-3 h-3 rounded bg-purple-500/30 flex items-center justify-center">
            <Sparkle size={8} className="text-purple-400" weight="fill" />
          </div>
          <span className="text-[8px] font-semibold text-purple-400">AI Insights</span>
        </div>
        <p className="text-[8px] text-zinc-400 leading-relaxed">
          High engagement on dance content. Peak posting: 6-9PM EST.
        </p>
      </div>

      {/* Viral Videos */}
      <div className="mb-2">
        <div className="flex items-center gap-1 mb-2">
          <Trophy size={10} className="text-amber-500" weight="fill" />
          <span className="text-[9px] font-semibold text-white">Viral Videos</span>
          <span className="text-[7px] text-zinc-500">(Top 10%)</span>
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {trendVideos.map((video, i) => (
            <div key={i} className="flex-shrink-0 w-[52px]">
              <div className="relative aspect-[9/16] bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-md overflow-hidden mb-1">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play size={14} className="text-white/50" weight="fill" />
                </div>
                <div className="absolute top-1 left-1 text-[6px] font-bold bg-black/70 text-white px-1 py-0.5 rounded">
                  #{video.rank}
                </div>
                <div className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-black/60 text-white text-[6px] px-1 py-0.5 rounded">
                  <Eye size={6} weight="bold" />
                  {video.views}
                </div>
                <div className="absolute bottom-1 right-1 text-[6px] bg-black/60 text-white px-1 py-0.5 rounded">
                  {video.engagement}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[6px] text-zinc-500">
                <Heart size={6} weight="fill" className="text-zinc-600" />
                <span>124K</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hashtags */}
      <div>
        <div className="flex items-center gap-1 mb-1.5">
          <Hash size={10} className={textMuted} weight="bold" />
          <span className="text-[9px] font-semibold text-white">Recommended</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {hashtags.map((tag, i) => (
            <span
              key={i}
              className={cn(
                "text-[7px] px-1.5 py-0.5 rounded-full",
                i === 0 ? "bg-white text-black font-medium" : "bg-zinc-800 text-zinc-400"
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Brand IP Integration Mockup
// ============================================================================
export function BrandIPMockup() {
  const assets = [
    { type: "image", label: "Photos", count: 24, color: "from-blue-500/20 to-cyan-500/20" },
    { type: "video", label: "Videos", count: 8, color: "from-purple-500/20 to-pink-500/20" },
    { type: "audio", label: "Audio", count: 12, color: "from-green-500/20 to-emerald-500/20" },
    { type: "merch", label: "Merch", count: 6, color: "from-orange-500/20 to-amber-500/20" },
  ];

  return (
    <div className={cn("rounded-xl p-3 h-full", cardBg, border)}>
      {/* Campaign header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">SM</span>
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-semibold text-white">Summer Music Festival</div>
          <div className="text-[8px] text-zinc-500">50 assets uploaded</div>
        </div>
        <div className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[7px] font-medium">
          Active
        </div>
      </div>

      {/* Asset types grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {assets.map((asset, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg p-2 bg-gradient-to-br",
              asset.color,
              "border border-zinc-700/30"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              {asset.type === "image" && <ImageIcon size={12} className="text-blue-400" weight="fill" />}
              {asset.type === "video" && <Video size={12} className="text-purple-400" weight="fill" />}
              {asset.type === "audio" && <MusicNote size={12} className="text-green-400" weight="fill" />}
              {asset.type === "merch" && <Star size={12} className="text-orange-400" weight="fill" />}
              <span className="text-[8px] font-bold text-white">{asset.count}</span>
            </div>
            <div className="text-[8px] text-zinc-400">{asset.label}</div>
          </div>
        ))}
      </div>

      {/* Asset preview strip */}
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 aspect-square rounded-md",
              i % 2 === 0
                ? "bg-gradient-to-br from-zinc-600 to-zinc-700"
                : "bg-gradient-to-br from-zinc-700 to-zinc-800"
            )}
          />
        ))}
        <div className="flex-1 aspect-square rounded-md bg-zinc-800/50 border border-dashed border-zinc-600 flex items-center justify-center">
          <Plus size={10} className="text-zinc-500" weight="bold" />
        </div>
      </div>

      {/* Brand guidelines */}
      <div className="flex items-center gap-2 text-[8px]">
        <div className="flex items-center gap-1 text-green-400">
          <CheckCircle size={10} weight="fill" />
          <span>Brand compliant</span>
        </div>
        <div className="w-px h-3 bg-zinc-700" />
        <span className="text-zinc-500">Guidelines learned</span>
      </div>
    </div>
  );
}

// ============================================================================
// Mass Generation Mockup
// ============================================================================
export function MassGenerationMockup() {
  const videos = [
    { status: "done", score: 92 },
    { status: "done", score: 88 },
    { status: "done", score: 85 },
    { status: "processing", score: null },
    { status: "processing", score: null },
    { status: "pending", score: null },
    { status: "pending", score: null },
    { status: "pending", score: null },
  ];

  return (
    <div className={cn("rounded-xl p-3 h-full", cardBg, border)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-semibold text-white">Batch Generation</div>
          <div className="text-[8px] text-zinc-500">100+ variations</div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[8px] text-zinc-400">3 processing</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[8px] mb-1">
          <span className="text-zinc-400">Progress</span>
          <span className="text-white font-medium">24/100</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-white to-zinc-400 rounded-full" style={{ width: "24%" }} />
        </div>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {videos.map((video, i) => (
          <div
            key={i}
            className={cn(
              "aspect-[9/16] rounded-md relative overflow-hidden",
              video.status === "done" ? "bg-gradient-to-br from-zinc-600 to-zinc-700" : "bg-zinc-800"
            )}
          >
            {video.status === "done" && (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play size={10} className="text-white/60" weight="fill" />
                </div>
                <div className="absolute top-0.5 right-0.5 text-[6px] bg-white text-black px-1 py-0.5 rounded font-medium">
                  {video.score}%
                </div>
                <div className="absolute bottom-0.5 left-0.5">
                  <CheckCircle size={8} className="text-green-500" weight="fill" />
                </div>
              </>
            )}
            {video.status === "processing" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {video.status === "pending" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Clock size={10} className="text-zinc-600" weight="bold" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[8px]">
        <div className="flex items-center gap-1 text-green-400">
          <CheckCircle size={10} weight="fill" />
          <span>24 completed</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <Star size={10} weight="fill" />
          <span>Avg: 87%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// One-Click Publishing Mockup
// ============================================================================
export function OneClickPublishMockup() {
  const platforms = [
    { name: "TikTok", icon: "T", color: "bg-zinc-700", status: "ready" },
    { name: "YouTube", icon: "Y", color: "bg-red-600", status: "ready" },
    { name: "Instagram", icon: "I", color: "bg-gradient-to-br from-purple-500 to-pink-500", status: "ready" },
    { name: "Twitter/X", icon: "X", color: "bg-zinc-600", status: "pending" },
  ];

  const schedule = [
    { time: "6:00 PM", platform: "TikTok", status: "scheduled" },
    { time: "7:30 PM", platform: "Instagram", status: "scheduled" },
    { time: "9:00 PM", platform: "YouTube", status: "draft" },
  ];

  return (
    <div className={cn("rounded-xl p-3 h-full", cardBg, border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RocketLaunch size={14} className="text-white" weight="fill" />
          <span className="text-[10px] font-semibold text-white">Publish Hub</span>
        </div>
        <div className="px-2 py-1 rounded-md text-[8px] font-medium flex items-center gap-1"
          style={{ backgroundColor: accentYellow, color: "black" }}>
          <ShareNetwork size={10} weight="bold" />
          Publish All
        </div>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {platforms.map((platform, i) => (
          <div key={i} className="bg-zinc-800/50 rounded-lg p-1.5 text-center">
            <div className={cn("w-6 h-6 rounded-lg mx-auto mb-1 flex items-center justify-center text-[9px] font-bold text-white", platform.color)}>
              {platform.icon}
            </div>
            <div className="text-[7px] text-zinc-400 mb-0.5">{platform.name}</div>
            <div className={cn(
              "text-[6px] px-1 py-0.5 rounded",
              platform.status === "ready" ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-500"
            )}>
              {platform.status}
            </div>
          </div>
        ))}
      </div>

      {/* Schedule list */}
      <div className="space-y-1.5 mb-2">
        <div className="flex items-center gap-1 mb-1">
          <CalendarBlank size={10} className={textMuted} weight="bold" />
          <span className="text-[9px] font-semibold text-white">Scheduled</span>
        </div>
        {schedule.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-zinc-800/30 rounded-md px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-zinc-500">{item.time}</span>
              <span className="text-[8px] text-white">{item.platform}</span>
            </div>
            <div className={cn(
              "text-[7px] px-1.5 py-0.5 rounded",
              item.status === "scheduled" ? "bg-blue-500/20 text-blue-400" : "bg-zinc-700 text-zinc-500"
            )}>
              {item.status}
            </div>
          </div>
        ))}
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-3 text-[8px]">
        <div className="flex items-center gap-1 text-zinc-400">
          <Clock size={10} weight="bold" />
          <span>Next: 2h 15m</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <CheckCircle size={10} weight="fill" className="text-green-500" />
          <span>8 published today</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hyperpersonalization Mockup
// ============================================================================
export function HyperpersonalizationMockup() {
  const regions = [
    { name: "USA", flag: "🇺🇸", trends: ["#fyp", "#dance"], active: true },
    { name: "Korea", flag: "🇰🇷", trends: ["#kpop", "#챌린지"], active: true },
    { name: "Japan", flag: "🇯🇵", trends: ["#jpop", "#ダンス"], active: false },
    { name: "Brazil", flag: "🇧🇷", trends: ["#viral", "#dança"], active: false },
  ];

  return (
    <div className={cn("rounded-xl p-3 h-full", cardBg, border)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Globe size={14} className="text-white" weight="fill" />
        <span className="text-[10px] font-semibold text-white">Regional Trends</span>
      </div>

      {/* World map placeholder */}
      <div className="relative h-20 bg-zinc-800/50 rounded-lg mb-3 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe size={40} className="text-zinc-700" weight="thin" />
        </div>
        {/* Connection lines simulation */}
        <div className="absolute top-4 left-6 w-2 h-2 rounded-full bg-white animate-pulse" />
        <div className="absolute top-8 right-8 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentYellow }} />
        <div className="absolute bottom-6 left-1/3 w-1.5 h-1.5 rounded-full bg-zinc-500" />
        <div className="absolute bottom-4 right-1/4 w-1.5 h-1.5 rounded-full bg-zinc-500" />
      </div>

      {/* Region list */}
      <div className="space-y-1.5">
        {regions.map((region, i) => (
          <div key={i} className={cn(
            "flex items-center justify-between rounded-md px-2 py-1.5",
            region.active ? "bg-zinc-800/50" : "bg-zinc-900/30"
          )}>
            <div className="flex items-center gap-2">
              <span className="text-[12px]">{region.flag}</span>
              <span className={cn("text-[9px]", region.active ? "text-white" : "text-zinc-500")}>
                {region.name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {region.trends.slice(0, 2).map((trend, j) => (
                <span key={j} className={cn(
                  "text-[6px] px-1 py-0.5 rounded",
                  region.active ? "bg-zinc-700 text-zinc-300" : "bg-zinc-800 text-zinc-600"
                )}>
                  {trend}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Workflow Step Mockups for How It Works Section
// ============================================================================

// Step 1: Research / Discover
export function WorkflowResearchMockup() {
  const trendItems = [
    { keyword: "#countrymusic", views: "12.4M", hot: true },
    { keyword: "#viral", views: "8.2M", hot: true },
    { keyword: "#dance", views: "5.1M", hot: false },
  ];

  return (
    <div className={cn("rounded-xl p-4 h-full min-h-[180px]", cardBg, border)}>
      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
          <MagnifyingGlass size={14} className={textMuted} weight="bold" />
          <span className="text-xs text-zinc-500">Search trends...</span>
        </div>
        <div className="px-3 py-2 bg-white text-black rounded-lg text-xs font-medium">
          Search
        </div>
      </div>

      {/* Trending list */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <TrendUp size={14} className="text-green-500" weight="fill" />
          <span className="text-xs font-semibold text-white">Trending Now</span>
        </div>
        {trendItems.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white">{item.keyword}</span>
              {item.hot && <Fire size={12} className="text-orange-500" weight="fill" />}
            </div>
            <span className="text-[10px] text-zinc-500">{item.views}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Step 2: Create / Generate
export function WorkflowCreateMockup() {
  const presets = ["Cinematic", "Lo-Fi", "Neon", "Minimal"];

  return (
    <div className={cn("rounded-xl p-4 h-full min-h-[180px]", cardBg, border)}>
      {/* Prompt input */}
      <div className="mb-4">
        <div className="text-[10px] text-zinc-500 mb-1">Prompt</div>
        <div className="bg-zinc-800 rounded-lg p-2 text-xs text-zinc-300 leading-relaxed">
          A girl dancing under neon lights, cinematic atmosphere, smooth motion...
        </div>
      </div>

      {/* Style presets */}
      <div className="mb-4">
        <div className="text-[10px] text-zinc-500 mb-2">Style</div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset, i) => (
            <span
              key={i}
              className={cn(
                "text-[10px] px-2 py-1 rounded-md",
                i === 0 ? "bg-white text-black font-medium" : "bg-zinc-800 text-zinc-400"
              )}
            >
              {preset}
            </span>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 px-4 py-2 rounded-lg text-xs font-medium text-center"
          style={{ backgroundColor: accentYellow, color: "black" }}>
          <Sparkle size={12} weight="fill" className="inline mr-1" />
          Generate 100 Variations
        </div>
      </div>
    </div>
  );
}

// Step 3: Review / Curate
export function WorkflowReviewMockup() {
  const videos = [
    { score: 95, status: "approved" },
    { score: 88, status: "approved" },
    { score: 72, status: "pending" },
    { score: 45, status: "rejected" },
  ];

  return (
    <div className={cn("rounded-xl p-4 h-full min-h-[180px]", cardBg, border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-white">Quality Review</span>
        <span className="text-[10px] text-zinc-500">24 of 100</span>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {videos.map((video, i) => (
          <div key={i} className="relative">
            <div className="aspect-[9/16] bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-md overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <Play size={12} className="text-white/50" weight="fill" />
              </div>
              <div className={cn(
                "absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded font-medium",
                video.score >= 80 ? "bg-green-500/90 text-white" :
                video.score >= 60 ? "bg-yellow-500/90 text-black" :
                "bg-red-500/90 text-white"
              )}>
                {video.score}
              </div>
              <div className="absolute bottom-1 left-1">
                {video.status === "approved" && <CheckCircle size={10} className="text-green-500" weight="fill" />}
                {video.status === "pending" && <Clock size={10} className="text-yellow-500" weight="fill" />}
                {video.status === "rejected" && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-md text-[10px] text-center font-medium">
          <CheckCircle size={10} weight="fill" className="inline mr-1" />
          Approve Selected
        </div>
        <div className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-md text-[10px] text-center">
          Skip
        </div>
      </div>
    </div>
  );
}

// Step 4: Publish / Distribute
export function WorkflowPublishMockup() {
  const platforms = [
    { name: "TikTok", selected: true },
    { name: "Instagram", selected: true },
    { name: "YouTube", selected: false },
  ];

  return (
    <div className={cn("rounded-xl p-4 h-full min-h-[180px]", cardBg, border)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <RocketLaunch size={14} className="text-white" weight="fill" />
        <span className="text-xs font-semibold text-white">Multi-Platform Publish</span>
      </div>

      {/* Platform selection */}
      <div className="space-y-2 mb-4">
        {platforms.map((platform, i) => (
          <div key={i} className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2",
            platform.selected ? "bg-zinc-800" : "bg-zinc-800/30"
          )}>
            <span className={cn("text-xs", platform.selected ? "text-white" : "text-zinc-500")}>
              {platform.name}
            </span>
            <div className={cn(
              "w-4 h-4 rounded flex items-center justify-center",
              platform.selected ? "bg-white" : "border border-zinc-600"
            )}>
              {platform.selected && <Check size={10} className="text-black" weight="bold" />}
            </div>
          </div>
        ))}
      </div>

      {/* Schedule info */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1 text-zinc-400">
          <Clock size={12} weight="bold" />
          <span>Optimal: 6:00 PM EST</span>
        </div>
        <div className="px-2 py-1 rounded text-[10px] font-medium"
          style={{ backgroundColor: accentYellow, color: "black" }}>
          Publish Now
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AEO/GEO Optimization Mockup
// ============================================================================
export function AEOGEOMockup() {
  const metrics = [
    { label: "Views", value: "2.4M", change: "+24%", up: true },
    { label: "Engagement", value: "8.7%", change: "+12%", up: true },
    { label: "Shares", value: "45K", change: "+31%", up: true },
  ];

  const optimizations = [
    { type: "Captions", status: "optimized", icon: "Aa" },
    { type: "Hashtags", status: "optimized", icon: "#" },
    { type: "Timing", status: "analyzing", icon: "⏱" },
  ];

  return (
    <div className={cn("rounded-xl p-3 h-full", cardBg, border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ChartLineUp size={14} className="text-white" weight="fill" />
          <span className="text-[10px] font-semibold text-white">Performance</span>
        </div>
        <div className="text-[8px] text-zinc-500">Last 7 days</div>
      </div>

      {/* Chart placeholder */}
      <div className="h-16 bg-zinc-800/30 rounded-lg mb-3 p-2 relative overflow-hidden">
        {/* Fake chart line */}
        <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,35 L15,30 L30,32 L45,20 L60,22 L75,12 L90,8 L100,5"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M0,35 L15,30 L30,32 L45,20 L60,22 L75,12 L90,8 L100,5 L100,40 L0,40 Z"
            fill="url(#chartGradient)"
          />
        </svg>
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[7px] font-medium"
          style={{ backgroundColor: accentYellow, color: "black" }}>
          +24%
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {metrics.map((metric, i) => (
          <div key={i} className="bg-zinc-800/50 rounded-lg p-1.5 text-center">
            <div className="text-[8px] text-zinc-500 mb-0.5">{metric.label}</div>
            <div className="text-[11px] font-bold text-white">{metric.value}</div>
            <div className={cn(
              "text-[7px]",
              metric.up ? "text-green-400" : "text-red-400"
            )}>
              {metric.change}
            </div>
          </div>
        ))}
      </div>

      {/* AEO/GEO status */}
      <div className="flex items-center gap-2">
        {optimizations.map((opt, i) => (
          <div key={i} className="flex items-center gap-1 bg-zinc-800/30 rounded px-1.5 py-1">
            <span className="text-[8px]">{opt.icon}</span>
            <span className="text-[7px] text-zinc-400">{opt.type}</span>
            {opt.status === "optimized" ? (
              <CheckCircle size={8} className="text-green-500" weight="fill" />
            ) : (
              <div className="w-2 h-2 border border-zinc-500 border-t-white rounded-full animate-spin" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Full Dashboard Overview Mockup (for Hero or Showcase sections)
// ============================================================================
export function DashboardOverviewMockup() {
  return (
    <div className={cn("rounded-2xl overflow-hidden", cardBg, border)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white to-zinc-400 flex items-center justify-center">
            <span className="text-xs font-bold text-black">H</span>
          </div>
          <span className="text-sm font-semibold text-white">HYDRA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-zinc-400">3 Active</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
            <Users size={12} className="text-zinc-400" weight="bold" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-14 bg-zinc-900/50 border-r border-zinc-800 py-4">
          <div className="flex flex-col items-center gap-4">
            {[
              { icon: TrendUp, active: false },
              { icon: Sparkle, active: true },
              { icon: Video, active: false },
              { icon: ChartLineUp, active: false },
            ].map((item, i) => (
              <div
                key={i}
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                  item.active ? "bg-white" : "bg-transparent hover:bg-zinc-800"
                )}
              >
                <item.icon
                  size={16}
                  className={item.active ? "text-black" : "text-zinc-500"}
                  weight={item.active ? "fill" : "bold"}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 p-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Videos", value: "1,234", icon: Video },
              { label: "Views", value: "2.4M", icon: Eye },
              { label: "Engagement", value: "7.2%", icon: Lightning },
              { label: "Active", value: "12", icon: RocketLaunch },
            ].map((stat, i) => (
              <div key={i} className="bg-zinc-800/30 rounded-lg p-2 text-center">
                <stat.icon size={12} className="mx-auto mb-1 text-zinc-500" weight="bold" />
                <div className="text-xs font-bold text-white">{stat.value}</div>
                <div className="text-[8px] text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Video grid preview */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-lg relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play size={14} className="text-white/40" weight="fill" />
                </div>
                {i < 3 && (
                  <div className="absolute top-1 right-1 text-[6px] bg-green-500/90 text-white px-1 py-0.5 rounded font-medium">
                    {90 - i * 5}%
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Activity bar */}
          <div className="flex items-center justify-between bg-zinc-800/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-zinc-400">8 videos processing</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock size={10} weight="bold" />
              <span>~12 min remaining</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Video Generation Pipeline Mockup
// ============================================================================
export function VideoPipelineMockup() {
  const stages = [
    { name: "Analyze", status: "done", count: 3 },
    { name: "Generate", status: "active", count: 8 },
    { name: "Review", status: "pending", count: 0 },
    { name: "Publish", status: "pending", count: 0 },
  ];

  return (
    <div className={cn("rounded-xl p-4", cardBg, border)}>
      {/* Pipeline header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-white">Pipeline Status</span>
        <span className="text-[10px] text-zinc-500">Campaign: Summer Festival</span>
      </div>

      {/* Pipeline stages */}
      <div className="flex items-center gap-2 mb-4">
        {stages.map((stage, i) => (
          <React.Fragment key={i}>
            <div className="flex-1 text-center">
              <div className={cn(
                "w-full h-1.5 rounded-full mb-2",
                stage.status === "done" ? "bg-green-500" :
                stage.status === "active" ? "bg-white" :
                "bg-zinc-700"
              )}>
                {stage.status === "active" && (
                  <div className="h-full bg-white/50 rounded-full animate-pulse" style={{ width: "60%" }} />
                )}
              </div>
              <div className="text-[9px] text-zinc-400">{stage.name}</div>
              {stage.count > 0 && (
                <div className="text-[8px] text-zinc-500">{stage.count}</div>
              )}
            </div>
            {i < stages.length - 1 && (
              <ArrowRight size={10} className="text-zinc-600 flex-shrink-0" weight="bold" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Current activity */}
      <div className="bg-zinc-800/30 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center">
            <Sparkle size={14} className="text-white" weight="fill" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-medium text-white">Generating variations...</div>
            <div className="text-[8px] text-zinc-500">24 of 100 complete</div>
          </div>
          <div className="text-[10px] font-medium text-white">24%</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Campaign Card Mockup
// ============================================================================
export function CampaignCardMockup() {
  return (
    <div className={cn("rounded-xl overflow-hidden", cardBg, border)}>
      {/* Cover */}
      <div className="h-20 bg-gradient-to-br from-purple-600 to-pink-500 relative">
        <div className="absolute bottom-2 left-3">
          <div className="text-white text-sm font-bold">Summer Music Festival</div>
          <div className="text-white/70 text-[10px]">Multi-artist Campaign</div>
        </div>
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[8px] text-white font-medium">
          Active
        </div>
      </div>

      {/* Stats */}
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <div className="text-sm font-bold text-white">156</div>
            <div className="text-[8px] text-zinc-500">Videos</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white">2.4M</div>
            <div className="text-[8px] text-zinc-500">Views</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white">8.2%</div>
            <div className="text-[8px] text-zinc-500">Engagement</div>
          </div>
        </div>

        {/* Asset preview */}
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((_, i) => (
            <div key={i} className="flex-1 aspect-square rounded bg-zinc-700" />
          ))}
          <div className="flex-1 aspect-square rounded bg-zinc-800 flex items-center justify-center">
            <span className="text-[8px] text-zinc-500">+48</span>
          </div>
        </div>
      </div>
    </div>
  );
}

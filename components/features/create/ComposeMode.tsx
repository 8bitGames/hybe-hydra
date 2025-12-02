"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/components";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wand2,
  Image as ImageIcon,
  Music,
  FolderOpen,
  ArrowRight,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CampaignSelector } from "./CampaignSelector";

interface ComposeStep {
  step: number;
  ko: string;
  en: string;
  icon: LucideIcon;
}

const composeSteps: ComposeStep[] = [
  {
    step: 1,
    ko: "스크립트|트렌딩 키워드로 AI 스크립트 생성",
    en: "Script|Generate AI script with trending keywords",
    icon: Sparkles,
  },
  {
    step: 2,
    ko: "이미지|영상에 사용할 이미지 검색 및 선택",
    en: "Images|Search and select images for your video",
    icon: ImageIcon,
  },
  {
    step: 3,
    ko: "음악|BPM과 분위기에 맞는 음악 매칭",
    en: "Music|Match music based on BPM and mood",
    icon: Music,
  },
  {
    step: 4,
    ko: "렌더링|효과와 함께 영상 생성",
    en: "Render|Create your video with effects",
    icon: Wand2,
  },
];

interface ComposeModeProps {
  className?: string;
}

/**
 * Compose Mode - Image + Audio slideshow creation
 * 합성 모드 - 이미지 + 오디오 슬라이드쇼 생성
 */
export function ComposeMode({ className }: ComposeModeProps) {
  const router = useRouter();
  const { pick } = useT();

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  const handleStartCompose = () => {
    if (selectedCampaign) {
      router.push(`/campaigns/${selectedCampaign}/compose`);
    }
  };

  // Helper to parse "title|description" format
  const parseStep = (step: ComposeStep) => {
    const text = pick(step.ko, step.en);
    const [title, desc] = text.split("|");
    return { title, desc };
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Two column layout for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Column - How It Works */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl">
              {pick("이미지 합성 방식", "How Compose Works")}
            </CardTitle>
            <CardDescription>
              {pick(
                "4단계로 이미지와 음악을 합성한 영상을 만드세요",
                "Create videos by combining images with music in 4 simple steps"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {composeSteps.map((step) => {
                const { title, desc } = parseStep(step);
                return (
                  <div key={step.step} className="relative">
                    <div className="flex flex-col items-center text-center p-6 bg-muted/30 rounded-xl">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <step.icon className="h-7 w-7 text-primary" />
                      </div>
                      <div className="text-2xl font-bold text-primary mb-1">
                        {step.step}
                      </div>
                      <div className="font-semibold text-lg">{title}</div>
                      <p className="text-sm text-muted-foreground mt-2">{desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Campaign Selection & Info */}
        <div className="flex flex-col gap-6">
          {/* Campaign Selection */}
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FolderOpen className="h-6 w-6" />
                {pick("캠페인 선택", "Select Campaign")}
              </CardTitle>
              <CardDescription>
                {pick(
                  "캠페인을 선택하여 에셋에 접근하고 합성 영상을 저장하세요",
                  "Choose a campaign to access your assets and save the composed video"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="p-6 flex-1">
                <CampaignSelector
                  value={selectedCampaign}
                  onChange={setSelectedCampaign}
                />
              </div>

              <div className="p-6 pt-0">
                <Button
                  size="lg"
                  className="w-full h-14 text-lg"
                  onClick={handleStartCompose}
                  disabled={!selectedCampaign}
                >
                  <Wand2 className="h-5 w-5 mr-2" />
                  {selectedCampaign
                    ? pick("합성 시작", "Start Composing")
                    : pick("캠페인을 선택하세요", "Select Campaign to Continue")}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Why Compose */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {pick("이미지 합성을 사용하는 경우", "When to use Compose")}
                  </h3>
                  <ul className="text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("기존 이미지를 영상으로 만들고 싶을 때", "You have existing images you want to turn into a video")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("특정 음악에 비주얼을 맞추고 싶을 때", "You want to sync visuals to specific music")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("소셜 미디어용 빠른 콘텐츠가 필요할 때", "You need quick content for social media")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("트렌딩 키워드와 TikTok SEO를 활용하고 싶을 때", "You want to leverage trending keywords and TikTok SEO")}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}

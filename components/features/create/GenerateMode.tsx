"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Sparkles,
  Music,
  FolderOpen,
  ArrowRight,
  Lightbulb,
  Wand2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CampaignSelector } from "./CampaignSelector";

const generateSteps = [
  {
    step: 1,
    titleKo: "프롬프트",
    titleEn: "Prompt",
    descKo: "AI로 최적화된 프롬프트 작성",
    descEn: "Describe your video with AI optimization",
    icon: Sparkles,
  },
  {
    step: 2,
    titleKo: "오디오",
    titleEn: "Audio",
    descKo: "영상에 맞는 음악 선택",
    descEn: "Select music to sync with your video",
    icon: Music,
  },
  {
    step: 3,
    titleKo: "스타일",
    titleEn: "Style",
    descKo: "비주얼 프리셋과 효과 선택",
    descEn: "Choose visual presets and effects",
    icon: Wand2,
  },
  {
    step: 4,
    titleKo: "생성",
    titleEn: "Generate",
    descKo: "Veo AI가 영상을 생성합니다",
    descEn: "AI creates your video with Veo",
    icon: Play,
  },
];

interface GenerateModeProps {
  className?: string;
}

/**
 * Generate Mode - AI Video Generation with full options
 * 생성 모드 - 모든 옵션을 포함한 AI 영상 생성
 *
 * This component is embeddable in the unified Create page.
 * 이 컴포넌트는 통합 만들기 페이지에 임베드됩니다.
 */
export function GenerateMode({ className }: GenerateModeProps) {
  const router = useRouter();
  const { language } = useI18n();

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  const handleStartGenerate = () => {
    if (selectedCampaign) {
      router.push(`/campaigns/${selectedCampaign}/generate`);
    }
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Two column layout for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Column - How It Works */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl">
              {language === "ko" ? "AI 영상 생성 방식" : "How AI Video Works"}
            </CardTitle>
            <CardDescription>
              {language === "ko"
                ? "4단계로 AI 영상을 생성하세요"
                : "Create AI-powered videos in 4 simple steps"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {generateSteps.map((step, idx) => (
                <div key={step.step} className="relative">
                  <div className="flex flex-col items-center text-center p-6 bg-muted/30 rounded-xl">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <step.icon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary mb-1">
                      {step.step}
                    </div>
                    <div className="font-semibold text-lg">
                      {language === "ko" ? step.titleKo : step.titleEn}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {language === "ko" ? step.descKo : step.descEn}
                    </p>
                  </div>
                </div>
              ))}
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
                {language === "ko" ? "캠페인 선택" : "Select Campaign"}
              </CardTitle>
              <CardDescription>
                {language === "ko"
                  ? "캠페인을 선택하여 에셋에 접근하고 영상을 생성하세요"
                  : "Choose a campaign to access your assets and generate videos"
                }
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
                  onClick={handleStartGenerate}
                  disabled={!selectedCampaign}
                >
                  <Bot className="h-5 w-5 mr-2" />
                  {selectedCampaign
                    ? (language === "ko" ? "생성 시작" : "Start Generating")
                    : (language === "ko" ? "캠페인을 선택하세요" : "Select Campaign to Continue")
                  }
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Why AI Generate */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {language === "ko" ? "AI 영상을 사용하는 경우" : "When to use AI Video"}
                  </h3>
                  <ul className="text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {language === "ko"
                        ? "텍스트로 독특한 영상 콘텐츠를 만들고 싶을 때"
                        : "You want AI to create unique video content from text"
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {language === "ko"
                        ? "음악에 맞춘 고품질 비주얼이 필요할 때"
                        : "You need high-quality visuals synced to music"
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {language === "ko"
                        ? "다양한 스타일 변형을 생성하고 싶을 때"
                        : "You want to generate multiple style variations"
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {language === "ko"
                        ? "트렌딩 콘텐츠와 바이럴 스타일을 활용하고 싶을 때"
                        : "You want to leverage trending content and viral styles"
                      }
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

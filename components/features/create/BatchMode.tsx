"use client";

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
  Layers,
  ArrowRight,
  Lightbulb,
  Bot,
  Wand2,
  Gauge,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface BilingualItem {
  ko: string;
  en: string;
  icon: LucideIcon;
}

const batchFeatures: BilingualItem[] = [
  {
    ko: "AI 영상 변형|AI로 생성된 영상에서 스타일 변형 생성",
    en: "AI Video Variations|Create style variations from AI-generated videos",
    icon: Bot,
  },
  {
    ko: "컴포즈 영상 변형|컴포즈 영상에서 변형 생성",
    en: "Compose Video Variations|Create variations from Compose videos",
    icon: Wand2,
  },
  {
    ko: "파이프라인 모니터링|모든 변형 생성 작업 모니터링",
    en: "Pipeline Monitoring|Monitor all variation generation jobs",
    icon: Gauge,
  },
];

const batchBenefits: BilingualItem[] = [
  {
    ko: "시간 절약|한 번에 여러 변형 생성",
    en: "Save Time|Generate multiple variations at once",
    icon: Clock,
  },
  {
    ko: "A/B 테스트|다양한 스타일을 테스트하고 최적의 결과 선택",
    en: "A/B Testing|Test different styles and pick the best performer",
    icon: Layers,
  },
  {
    ko: "효율적 워크플로우|파이프라인에서 모든 작업 관리",
    en: "Efficient Workflow|Manage all jobs from the pipeline",
    icon: Zap,
  },
];

interface BatchModeProps {
  className?: string;
}

/**
 * Batch Mode - Bulk variation generation
 * 배치 모드 - 대량 변형 생성
 *
 * This component shows batch features and links to the Pipeline page.
 * Batch operations are consolidated in the Pipeline for better UX.
 */
export function BatchMode({ className }: BatchModeProps) {
  const router = useRouter();
  const { pick } = useT();

  const handleGoToPipeline = () => {
    router.push("/pipeline");
  };

  // Helper to parse "title|description" format
  const parseItem = (item: BilingualItem) => {
    const text = pick(item.ko, item.en);
    const [title, desc] = text.split("|");
    return { title, desc };
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Two column layout for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Column - Features & Benefits */}
        <div className="flex flex-col gap-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Layers className="h-6 w-6" />
                {pick("배치 변형 생성", "Batch Variation Generation")}
              </CardTitle>
              <CardDescription>
                {pick(
                  "여러 영상 변형을 한 번에 생성하고 파이프라인에서 관리하세요",
                  "Generate multiple video variations at once and manage them in the pipeline"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                {batchFeatures.map((feature, idx) => {
                  const { title, desc } = parseItem(feature);
                  return (
                    <div key={idx} className="p-5 rounded-xl border bg-muted/30">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-primary/10">
                          <feature.icon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-semibold text-lg">{title}</span>
                      </div>
                      <p className="text-muted-foreground ml-14">{desc}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="bg-muted/30 flex-1 flex flex-col">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {pick("배치 변형을 사용하는 경우", "When to use Batch Variations")}
                  </h3>
                  <ul className="text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("여러 스타일 변형을 한 번에 테스트하고 싶을 때", "You want to test multiple style variations at once")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("A/B 테스트용 콘텐츠가 필요할 때", "You need content for A/B testing")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("소셜 미디어 채널별 변형이 필요할 때", "You need variations for different social media channels")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("시간을 절약하며 대량 콘텐츠를 생성하고 싶을 때", "You want to save time by generating bulk content")}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Benefits & CTA */}
        <div className="flex flex-col gap-6">
          {/* Benefits */}
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">
                {pick("배치 생성의 장점", "Benefits of Batch Generation")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="grid grid-cols-1 gap-6">
                {batchBenefits.map((benefit, idx) => {
                  const { title, desc } = parseItem(benefit);
                  return (
                    <div key={idx} className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                        <benefit.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{title}</h4>
                        <p className="text-muted-foreground mt-1">{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Layers className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-2xl">
                    {pick("파이프라인에서 배치 작업 시작하기", "Start Batch Operations in Pipeline")}
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    {pick(
                      "배치 변형 기능은 파이프라인 페이지에서 통합 관리됩니다",
                      "Batch variation features are consolidated in the Pipeline page for a better experience"
                    )}
                  </p>
                </div>
                <Button size="lg" className="h-14 text-lg px-8" onClick={handleGoToPipeline}>
                  {pick("파이프라인으로 이동", "Go to Pipeline")}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

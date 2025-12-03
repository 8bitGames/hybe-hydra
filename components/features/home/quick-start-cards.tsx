"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Wand2, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackHome, trackTrends, trackQuickCreate } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";

interface QuickStartCard {
  id: string;
  title: { ko: string; en: string };
  description: { ko: string; en: string };
  longDescription: { ko: string; en: string };
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  badge?: { ko: string; en: string };
}

const quickStartCards: QuickStartCard[] = [
  {
    id: "ai-generate",
    title: { ko: "AI 영상", en: "AI Video" },
    description: { ko: "프롬프트로 생성", en: "Create from prompt" },
    longDescription: { ko: "Veo를 사용하여 텍스트 설명에서 AI가 영상을 생성합니다", en: "AI creates video from your text description using Veo" },
    icon: Bot,
    href: "/create/generate",
    gradient: "from-purple-500/10 to-blue-500/10",
    badge: { ko: "가장 인기", en: "Most Popular" },
  },
  {
    id: "image-compose",
    title: { ko: "컴포즈 영상", en: "Compose Video" },
    description: { ko: "에셋으로 제작", en: "Build from assets" },
    longDescription: { ko: "이미지와 오디오를 결합하여 매력적인 영상 콘텐츠 제작", en: "Combine images + audio into engaging video content" },
    icon: Wand2,
    href: "/create/compose",
    gradient: "from-pink-500/10 to-orange-500/10",
  },
];

// Separate discovery card - not a "create" action
const discoveryCard: QuickStartCard = {
  id: "trend-insights",
  title: { ko: "트렌드 탐색", en: "Explore Trends" },
  description: { ko: "바이럴 콘텐츠 발견", en: "Discover what's viral" },
  longDescription: { ko: "TikTok 트렌드, 해시태그, 바이럴 콘텐츠 패턴 분석", en: "Analyze TikTok trends, hashtags, and viral content patterns" },
  icon: TrendingUp,
  href: "/insights",
  gradient: "from-green-500/10 to-teal-500/10",
  badge: { ko: "리서치", en: "Research" },
};

function QuickStartCardComponent({ card, actionLabel, isExplore = false }: { card: QuickStartCard; actionLabel: { ko: string; en: string }; isExplore?: boolean }) {
  const router = useRouter();
  const { language } = useI18n();

  const handleClick = () => {
    if (isExplore) {
      trackTrends.explore();
    } else {
      trackHome.quickStartClick(card.id);
      if (card.id === 'ai-generate') {
        trackQuickCreate.start();
      }
    }
    router.push(card.href);
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
        "group"
      )}
      onClick={handleClick}
    >
      {/* Gradient Background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-70 transition-opacity",
          card.gradient
        )}
      />

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "p-3 rounded-xl bg-background/80 shadow-sm",
              "group-hover:shadow-md transition-shadow"
            )}
          >
            <card.icon className="h-6 w-6 text-primary" />
          </div>
          {card.badge && (
            <Badge variant="secondary" className="text-xs">
              {language === "ko" ? card.badge.ko : card.badge.en}
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3">
          {language === "ko" ? card.title.ko : card.title.en}
        </CardTitle>
        <CardDescription className="text-sm">
          {language === "ko" ? card.description.ko : card.description.en}
        </CardDescription>
      </CardHeader>

      <CardContent className="relative pt-0">
        <p className="text-sm text-muted-foreground mb-4">
          {language === "ko" ? card.longDescription.ko : card.longDescription.en}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors p-0 h-auto"
        >
          {language === "ko" ? actionLabel.ko : actionLabel.en}
          <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function QuickStartCards() {
  const { language } = useI18n();

  return (
    <div className="space-y-8">
      {/* Create Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {language === "ko" ? "무엇을 만들고 싶으신가요?" : "What would you like to create?"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === "ko"
                ? "영상 제작 방식을 선택하세요"
                : "Choose how you want to create your video"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickStartCards.map((card) => (
            <QuickStartCardComponent
              key={card.id}
              card={card}
              actionLabel={{ ko: "만들기 시작", en: "Start Creating" }}
            />
          ))}
        </div>
      </div>

      {/* Discover Section - Separate from Create */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {language === "ko" ? "탐색 & 발견" : "Explore & Discover"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === "ko"
                ? "콘텐츠 제작 전 트렌드를 리서치하세요"
                : "Research trends before creating content"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickStartCardComponent
            card={discoveryCard}
            actionLabel={{ ko: "트렌드 탐색", en: "Explore Trends" }}
            isExplore
          />
        </div>
      </div>
    </div>
  );
}

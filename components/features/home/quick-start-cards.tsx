"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Wand2, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackHome, trackTrends, trackQuickCreate } from "@/lib/analytics";

interface QuickStartCard {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  badge?: string;
}

const quickStartCards: QuickStartCard[] = [
  {
    id: "ai-generate",
    title: "AI Generate",
    description: "Create from prompt",
    longDescription: "AI creates video from your text description using Veo",
    icon: Bot,
    href: "/create/generate",
    gradient: "from-purple-500/10 to-blue-500/10",
    badge: "Most Popular",
  },
  {
    id: "image-compose",
    title: "Image Compose",
    description: "Build from assets",
    longDescription: "Combine images + audio into engaging video content",
    icon: Wand2,
    href: "/create/compose",
    gradient: "from-pink-500/10 to-orange-500/10",
  },
];

// Separate discovery card - not a "create" action
const discoveryCard: QuickStartCard = {
  id: "trend-insights",
  title: "Explore Trends",
  description: "Discover what's viral",
  longDescription: "Analyze TikTok trends, hashtags, and viral content patterns",
  icon: TrendingUp,
  href: "/insights",
  gradient: "from-green-500/10 to-teal-500/10",
  badge: "Research",
};

function QuickStartCardComponent({ card, actionLabel = "Get Started", isExplore = false }: { card: QuickStartCard; actionLabel?: string; isExplore?: boolean }) {
  const router = useRouter();

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
              {card.badge}
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3">{card.title}</CardTitle>
        <CardDescription className="text-sm">
          {card.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="relative pt-0">
        <p className="text-sm text-muted-foreground mb-4">
          {card.longDescription}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors p-0 h-auto"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function QuickStartCards() {
  return (
    <div className="space-y-8">
      {/* Create Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">What would you like to create?</h2>
            <p className="text-sm text-muted-foreground">
              Choose how you want to create your video
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickStartCards.map((card) => (
            <QuickStartCardComponent key={card.id} card={card} actionLabel="Start Creating" />
          ))}
        </div>
      </div>

      {/* Discover Section - Separate from Create */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Explore & Discover</h2>
            <p className="text-sm text-muted-foreground">
              Research trends before creating content
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickStartCardComponent card={discoveryCard} actionLabel="Explore Trends" isExplore />
        </div>
      </div>
    </div>
  );
}

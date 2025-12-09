"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Images,
  Video,
  Wand2,
  ArrowRight,
  Film,
  Layers,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function CreatePage() {
  const params = useParams();
  const { language } = useI18n();
  const campaignId = params.id as string;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold mb-2">
          {language === "ko" ? "영상 만들기" : "Create Video"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ko"
            ? "원하는 영상 제작 방식을 선택하세요"
            : "Choose your preferred video creation method"}
        </p>
      </div>

      {/* Creation Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* AI Generation Option */}
        <Card className="relative overflow-hidden border-zinc-200 hover:border-zinc-400 transition-all group bg-white dark:bg-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-500">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-zinc-100 dark:from-zinc-800 to-transparent rounded-bl-full" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                <Wand2 className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
              </div>
              <div>
                <CardTitle className="text-xl text-zinc-900 dark:text-zinc-100">
                  {language === "ko" ? "AI 영상" : "AI Video"}
                </CardTitle>
                <Badge variant="outline" className="mt-1 border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                  {language === "ko" ? "Gemini AI" : "Gemini AI"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              {language === "ko"
                ? "AI가 프롬프트를 기반으로 새로운 영상을 생성합니다. 이미지 레퍼런스와 트렌드를 활용하여 독창적인 콘텐츠를 만들어보세요."
                : "AI generates new videos based on your prompt. Create unique content using image references and trending topics."}
            </p>

            {/* Features */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Zap className="w-4 h-4 text-zinc-500" />
                <span>{language === "ko" ? "프롬프트 기반 영상 생성" : "Prompt-based video generation"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Sparkles className="w-4 h-4 text-zinc-500" />
                <span>{language === "ko" ? "이미지 레퍼런스 활용" : "Image reference support"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Video className="w-4 h-4 text-zinc-500" />
                <span>{language === "ko" ? "9:16, 16:9, 1:1 비율 지원" : "9:16, 16:9, 1:1 aspect ratios"}</span>
              </div>
            </div>

            <Link href={`/campaigns/${campaignId}/generate`} className="block pt-2">
              <Button className="w-full h-12 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 group-hover:shadow-lg transition-all">
                {language === "ko" ? "AI 영상 시작" : "Start AI Video"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Image Compose Option */}
        <Card className="relative overflow-hidden border-zinc-200 hover:border-zinc-400 transition-all group bg-white dark:bg-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-500">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-zinc-100 dark:from-zinc-800 to-transparent rounded-bl-full" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                <Layers className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
              </div>
              <div>
                <CardTitle className="text-xl text-zinc-900 dark:text-zinc-100">
                  {language === "ko" ? "컴포즈 영상" : "Compose Video"}
                </CardTitle>
                <Badge variant="outline" className="mt-1 border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                  {language === "ko" ? "슬라이드쇼" : "Slideshow"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              {language === "ko"
                ? "여러 이미지를 조합하여 슬라이드쇼 영상을 만듭니다. 에셋 이미지, 검색 이미지를 활용하고 음악과 효과를 추가하세요."
                : "Create slideshow videos by combining multiple images. Use asset images, search images, and add music with effects."}
            </p>

            {/* Features */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Images className="w-4 h-4 text-zinc-500" />
                <span>{language === "ko" ? "에셋 이미지 & 검색 이미지 지원" : "Asset images & search images"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Film className="w-4 h-4 text-zinc-500" />
                <span>{language === "ko" ? "AI 스크립트 & 자동 편집" : "AI script & auto editing"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Sparkles className="w-4 h-4 text-zinc-500" />
                <span>{language === "ko" ? "트랜지션 & 이펙트 프리셋" : "Transition & effect presets"}</span>
              </div>
            </div>

            <Link href={`/campaigns/${campaignId}/compose`} className="block pt-2">
              <Button variant="outline" className="w-full h-12 border-zinc-400 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:border-zinc-500 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 group-hover:shadow-lg transition-all">
                {language === "ko" ? "패스트컷 영상 시작" : "Start Fast Cut Video"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Help Text */}
      <div className="text-center text-sm text-zinc-500 max-w-2xl mx-auto pt-4">
        <p>
          {language === "ko"
            ? "어떤 방식을 선택해야 할지 모르겠나요? AI 영상은 완전히 새로운 영상을 만들고, 컴포즈 영상은 기존 이미지들을 활용하여 빠르게 영상을 제작합니다."
            : "Not sure which to choose? AI Video creates entirely new videos, while Compose Video quickly creates videos using existing images."}
        </p>
      </div>
    </div>
  );
}

"use client";

import React, { ReactNode, memo, createElement } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface BilingualLabelProps {
  ko: string;
  en: string;
  showBoth?: boolean;
  className?: string;
  secondaryClassName?: string;
  /** Parameters for interpolation - e.g., { count: 5 } for "{count} items" */
  params?: Record<string, string | number>;
  /** HTML tag to render (default: span) */
  as?: keyof React.JSX.IntrinsicElements;
  /** Children to wrap (alternative to ko/en props) */
  children?: ReactNode;
}

/**
 * Displays text in the user's preferred language
 * Optionally shows both languages for clarity
 *
 * 사용자의 선호 언어로 텍스트를 표시합니다
 * 명확성을 위해 선택적으로 두 언어를 모두 표시합니다
 *
 * Usage:
 *   <BilingualLabel ko="안녕하세요" en="Hello" />
 *   <BilingualLabel ko="{count}개 항목" en="{count} items" params={{ count: 5 }} />
 *   <BilingualLabel ko="제목" en="Title" as="h2" className="text-xl" />
 *   <BilingualLabel ko="설명" en="Description" showBoth />
 */
export const BilingualLabel = memo(function BilingualLabel({
  ko,
  en,
  showBoth = false,
  className,
  secondaryClassName,
  params,
  as: Tag = "span",
}: BilingualLabelProps) {
  const { language } = useI18n();

  // Apply parameter interpolation
  const interpolate = (text: string): string => {
    if (!params) return text;
    let result = text;
    Object.entries(params).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    });
    return result;
  };

  const primary = interpolate(language === "ko" ? ko : en);
  const secondary = interpolate(language === "ko" ? en : ko);

  if (showBoth) {
    return createElement(
      Tag,
      { className: cn(className) },
      primary,
      createElement(
        "span",
        { className: cn("text-muted-foreground ml-1", secondaryClassName) },
        `(${secondary})`
      )
    );
  }

  return createElement(Tag, { className: cn(className) }, primary);
});

/**
 * Hook to get the appropriate text based on language
 * 언어에 따른 적절한 텍스트를 가져오는 훅
 *
 * Usage:
 *   const text = useBilingualText("안녕하세요", "Hello");
 *   const text = useBilingualText("{count}개", "{count} items", { count: 5 });
 */
export function useBilingualText(
  ko: string,
  en: string,
  params?: Record<string, string | number>
): string {
  const { language } = useI18n();
  let text = language === "ko" ? ko : en;

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    });
  }

  return text;
}

/**
 * Helper to create bilingual text object
 * 이중 언어 텍스트 객체를 생성하는 헬퍼
 */
export function bilingual(ko: string, en: string): BilingualText {
  return { ko, en };
}

/**
 * Format a bilingual text with parameters
 * 파라미터로 이중 언어 텍스트 포맷팅
 *
 * Usage:
 *   formatBilingual({ ko: "{n}개", en: "{n} items" }, { n: 5 })
 */
export function formatBilingual(
  text: BilingualText,
  params: Record<string, string | number>
): BilingualText {
  const format = (str: string): string => {
    let result = str;
    Object.entries(params).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    });
    return result;
  };

  return {
    ko: format(text.ko),
    en: format(text.en),
  };
}

export type BilingualText = { ko: string; en: string };

/**
 * Re-export i18n components for convenience
 * 편의를 위한 i18n 컴포넌트 재내보내기
 */
export { T, TBlock, THeading, TText, TLabel, useT } from "@/lib/i18n/components";

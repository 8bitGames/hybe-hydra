"use client";

import React, { ReactNode, memo, createElement } from "react";
import { useI18n } from "./index";
import type { Language } from "./translations";

/**
 * T - Universal Translation Component
 * T - 범용 번역 컴포넌트
 *
 * Usage patterns:
 *
 * 1. Direct text (recommended for new code):
 *    <T ko="안녕하세요" en="Hello" />
 *
 * 2. With children fallback:
 *    <T ko="안녕하세요">Hello</T>
 *
 * 3. As function (for complex content):
 *    <T>{(lang) => lang === 'ko' ? <Strong>한글</Strong> : <Strong>English</Strong>}</T>
 *
 * 4. With key from translations.ts:
 *    <T k="common.loading" />
 *
 * 5. With parameters:
 *    <T ko="{count}개 선택됨" en="{count} selected" params={{ count: 5 }} />
 */

interface TProps {
  // Direct text props
  ko?: string;
  en?: string;

  // Key-based translation
  k?: string;

  // Parameters for interpolation
  params?: Record<string, string | number>;

  // Children (fallback or render function)
  children?: ReactNode | ((language: Language) => ReactNode);

  // HTML tag to render (default: span)
  as?: keyof React.JSX.IntrinsicElements;

  // Additional className
  className?: string;
}

export const T = memo(function T({
  ko,
  en,
  k,
  params,
  children,
  as: Tag = "span",
  className,
}: TProps) {
  const { language, translate } = useI18n();

  let content: ReactNode;

  // Priority 1: Key-based translation
  if (k) {
    content = translate(k, params);
  }
  // Priority 2: Direct ko/en props
  else if (ko !== undefined || en !== undefined) {
    let text: string | ReactNode = language === "ko" ? (ko ?? en ?? "") : (en ?? ko ?? "");

    // Apply parameters
    if (params && typeof text === "string") {
      Object.entries(params).forEach(([key, value]) => {
        text = (text as string).replace(new RegExp(`{${key}}`, "g"), String(value));
      });
    }

    content = text;
  }
  // Priority 3: Render function
  else if (typeof children === "function") {
    content = children(language);
  }
  // Priority 4: Children as fallback (English assumed)
  else if (children) {
    content = children;
  }

  // Return without wrapper if no className
  if (!className && Tag === "span") {
    return <>{content}</>;
  }

  return createElement(Tag, { className }, content);
});

/**
 * TBlock - Block-level translation component
 * TBlock - 블록 레벨 번역 컴포넌트
 *
 * Same as T but renders as div by default
 */
export const TBlock = memo(function TBlock(props: Omit<TProps, "as">) {
  return <T {...props} as="div" />;
});

/**
 * THeading - Heading translation component
 * THeading - 제목 번역 컴포넌트
 */
interface THeadingProps extends TProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const THeading = memo(function THeading({
  level = 2,
  ...props
}: THeadingProps) {
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  return <T {...props} as={Tag} />;
});

/**
 * TText - Paragraph translation component
 * TText - 단락 번역 컴포넌트
 */
export const TText = memo(function TText(props: Omit<TProps, "as">) {
  return <T {...props} as="p" />;
});

/**
 * TLabel - Label translation component
 * TLabel - 레이블 번역 컴포넌트
 */
interface TLabelProps extends Omit<TProps, "as"> {
  htmlFor?: string;
}

export const TLabel = memo(function TLabel({ htmlFor, ...props }: TLabelProps) {
  return (
    <label htmlFor={htmlFor}>
      <T {...props} />
    </label>
  );
});

/**
 * useT - Translation hook with convenient methods
 * useT - 편리한 메서드가 있는 번역 훅
 *
 * Usage:
 *   const { t, lang, isKo, isEn, pick } = useT();
 *
 *   // Pick based on language
 *   const label = pick("한글", "English");
 *
 *   // Check language
 *   if (isKo) { ... }
 */
export function useT() {
  const { language, t, translate, setLanguage } = useI18n();

  return {
    // Current language
    lang: language,
    language,

    // Language checks
    isKo: language === "ko",
    isEn: language === "en",

    // Translations object
    t,

    // Translate by key
    translate,

    // Set language
    setLanguage,

    // Pick value based on language
    pick: <T,>(ko: T, en: T): T => (language === "ko" ? ko : en),

    // Format with parameters
    format: (ko: string, en: string, params?: Record<string, string | number>): string => {
      let text = language === "ko" ? ko : en;
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          text = text.replace(new RegExp(`{${key}}`, "g"), String(value));
        });
      }
      return text;
    },
  };
}

/**
 * withTranslation - HOC for class components
 * withTranslation - 클래스 컴포넌트용 HOC
 */
export function withTranslation<P extends object>(
  WrappedComponent: React.ComponentType<P & { t: ReturnType<typeof useT> }>
) {
  return function WithTranslationComponent(props: P) {
    const t = useT();
    return <WrappedComponent {...props} t={t} />;
  };
}

// Re-export for convenience
export { useI18n, LanguageSwitcher } from "./index";

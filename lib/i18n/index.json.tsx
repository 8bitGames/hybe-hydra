/**
 * JSON-based i18n Hooks
 * JSON 기반 i18n 훅
 *
 * Updated hooks that use ko.json and en.json translation files.
 */

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getTranslation,
  interpolate,
  type TranslationKey,
} from "./translations.json";

export type Language = "ko" | "en";

interface LanguageStore {
  language: Language;
  setLanguage: (language: Language) => void;
}

/**
 * Global language store
 */
export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: "ko",
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "language-storage",
    }
  )
);

/**
 * Base i18n hook (original)
 */
export function useI18n() {
  const { language, setLanguage } = useLanguageStore();

  return {
    language,
    setLanguage,
    isKorean: language === "ko",
    toggleLanguage: () => setLanguage(language === "ko" ? "en" : "ko"),
  };
}

/**
 * JSON-based translation hook
 *
 * Usage:
 *   const { t, language } = useTranslation();
 *   <Button>{t('common.save')}</Button>
 *   <p>{t('campaigns.create.description', { count: 5 })}</p>
 */
export function useTranslation() {
  const { language, setLanguage } = useLanguageStore();

  /**
   * Translate a key with optional parameters
   */
  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const text = getTranslation(key, language);
    return interpolate(text, params);
  };

  /**
   * Get both Korean and English translations
   */
  const both = (key: TranslationKey): { ko: string; en: string } => {
    return {
      ko: getTranslation(key, "ko"),
      en: getTranslation(key, "en"),
    };
  };

  return {
    t,
    both,
    language,
    setLanguage,
    isKorean: language === "ko",
    toggleLanguage: () => setLanguage(language === "ko" ? "en" : "ko"),
  };
}

/**
 * Alias for useTranslation (shorter name)
 */
export const useT = useTranslation;

/**
 * HOC to add translation to any component
 */
export function withTranslation<P extends object>(
  Component: React.ComponentType<P & { t: ReturnType<typeof useTranslation>["t"] }>
) {
  return function WithTranslationComponent(props: P) {
    const translation = useTranslation();
    return <Component {...props} t={translation.t} />;
  };
}

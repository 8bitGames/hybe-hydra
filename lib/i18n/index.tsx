"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from "react";
import { translations, Language, Translations, getNestedValue } from "./translations";

// i18n Context
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  translate: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Get browser language
function getBrowserLanguage(): Language {
  if (typeof window === "undefined") return "ko";

  const browserLang = navigator.language.split("-")[0];
  return browserLang === "ko" ? "ko" : "en";
}

// Get stored language preference
function getStoredLanguage(): Language | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("hydra-language");
  if (stored === "ko" || stored === "en") return stored;
  return null;
}

// i18n Provider
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return getStoredLanguage() || getBrowserLanguage();
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("hydra-language", lang);
    }
  }, []);

  const t = useMemo(() => translations[language], [language]);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = getNestedValue(t as unknown as Record<string, unknown>, key);

      if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
          text = text.replace(new RegExp(`{${paramKey}}`, "g"), String(value));
        });
      }

      return text;
    },
    [t]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, translate }}>
      {children}
    </I18nContext.Provider>
  );
}

// Hook to use i18n
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Return default values if not in provider (for SSR)
    return {
      language: "ko" as Language,
      setLanguage: () => {},
      t: translations.ko,
      translate: (key: string) => key,
    };
  }
  return context;
}

// Language Switcher Component
export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      <button
        onClick={() => setLanguage("ko")}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          language === "ko"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
        }`}
      >
        한국어
      </button>
      <button
        onClick={() => setLanguage("en")}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          language === "en"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
        }`}
      >
        EN
      </button>
    </div>
  );
}

// Re-export types
export type { Language, Translations };

/**
 * JSON-based i18n Translation System
 * JSON 기반 i18n 번역 시스템
 *
 * Provides type-safe translation functions with nested key access.
 * Uses ko.json and en.json files for translations.
 */

import koTranslations from "./translations/ko.json";
import enTranslations from "./translations/en.json";

export type Translations = typeof koTranslations;
export type TranslationKey = NestedKeyOf<Translations>;

/**
 * Helper type to get all nested keys as dot-separated strings
 * e.g., "campaigns.create.title" | "common.save" | ...
 */
type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
        : `${K}`;
    }[keyof T & string]
  : never;

/**
 * Get nested value from object using dot-separated key
 */
function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const keys = key.split(".");
  let current: unknown = obj;

  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

/**
 * Get translation by key and language
 */
export function getTranslation(key: TranslationKey, lang: "ko" | "en"): string {
  const translations = lang === "ko" ? koTranslations : enTranslations;
  const value = getNestedValue(translations, key);

  if (!value) {
    console.warn(`[i18n] Missing translation: ${key} (${lang})`);
    return key;
  }

  return value;
}

/**
 * Interpolate parameters in translation string
 * e.g., "Hello {name}" + { name: "World" } → "Hello World"
 */
export function interpolate(
  text: string,
  params?: Record<string, string | number>
): string {
  if (!params) return text;

  let result = text;
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  });

  return result;
}

/**
 * All available translations (for export)
 */
export const translations = {
  ko: koTranslations,
  en: enTranslations,
};

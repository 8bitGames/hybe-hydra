#!/usr/bin/env npx ts-node
/**
 * Generate JSON Translation Files (ko.json + en.json)
 * JSON 번역 파일 생성 (ko.json + en.json)
 *
 * Generates structured translation JSON files from scan results using AI.
 * Creates nested keys like campaigns.create.title for better organization.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/i18n/generate-json-translations.ts scan-report.json
 *   GEMINI_API_KEY=xxx npx ts-node scripts/i18n/generate-json-translations.ts scan-report.json --dry-run
 */

import * as fs from "fs";
import * as path from "path";

interface HardcodedString {
  type: "jsx-text" | "attribute" | "template" | "korean";
  text: string;
  line: number;
  column?: number;
  file: string;
  context?: string;
}

interface ScanResult {
  totalFiles: number;
  filesWithHardcoded: number;
  totalStrings: number;
  byFile: {
    [filepath: string]: HardcodedString[];
  };
}

interface TranslationEntry {
  key: string;
  ko: string;
  en: string;
  context?: string;
}

/**
 * Check if text is Korean
 */
function isKorean(text: string): boolean {
  return /[\uAC00-\uD7AF]/.test(text);
}

/**
 * Check if text is English
 */
function isEnglish(text: string): boolean {
  return /^[A-Za-z\s.,!?'-]+$/.test(text.trim());
}

/**
 * Generate semantic key from file path and text
 */
function generateKey(filePath: string, text: string, index: number): string {
  const parts = filePath.split("/");

  // Extract category from path
  let category = "common";
  if (filePath.includes("/campaigns/")) category = "campaigns";
  else if (filePath.includes("/create/")) category = "create";
  else if (filePath.includes("/pipeline/")) category = "pipeline";
  else if (filePath.includes("/insights/")) category = "insights";
  else if (filePath.includes("/videos/")) category = "videos";
  else if (filePath.includes("/settings/")) category = "settings";
  else if (filePath.includes("/publish/")) category = "publishing";
  else if (filePath.includes("/compose/")) category = "compose";
  else if (filePath.includes("/trends/")) category = "trends";
  else if (filePath.includes("components/features/")) category = "features";
  else if (filePath.includes("components/layout/")) category = "layout";
  else if (filePath.includes("components/ui/")) category = "ui";

  // Extract component/page name
  const fileName = parts[parts.length - 1]
    .replace(/\.(tsx|ts|jsx|js)$/, "")
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");

  // Generate text key from content
  const textKey = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join("-")
    .substring(0, 30);

  return `${category}.${fileName}.${textKey}-${index}`;
}

/**
 * Batch translate texts using Gemini AI
 */
async function batchTranslate(
  texts: { key: string; text: string; targetLang: "ko" | "en" }[],
  batchSize: number = 20
): Promise<Map<string, string>> {
  const { GoogleGenAI } = await import("@google/genai");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const results = new Map<string, string>();

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const prompt = `Translate the following ${batch[0].targetLang === "ko" ? "English to Korean" : "Korean to English"} texts for a UI/UX context.
Preserve placeholders like {count}, {name}, etc.
Return ONLY a JSON array of translations in the same order.

Texts to translate:
${batch.map((item, idx) => `${idx + 1}. "${item.text}"`).join("\n")}

Return format: ["translation1", "translation2", ...]`;

    try {
      console.log(`   Translating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}...`);

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text?.trim() ?? "";
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const translations = JSON.parse(jsonMatch[0]);
        batch.forEach((item, idx) => {
          if (translations[idx]) {
            results.set(item.key, translations[idx]);
          }
        });
      }

      // Rate limiting
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`   ❌ Batch translation failed:`, error);
    }
  }

  return results;
}

/**
 * Collect and translate all strings
 */
async function collectTranslations(scanResult: ScanResult): Promise<TranslationEntry[]> {
  const entries: TranslationEntry[] = [];
  const seenTexts = new Map<string, TranslationEntry>();

  // Collect unique texts
  let textIndex = 0;
  for (const [filePath, hardcodedStrings] of Object.entries(scanResult.byFile)) {
    for (const item of hardcodedStrings) {
      const cleanText = item.text.trim();

      if (seenTexts.has(cleanText)) {
        continue;
      }

      const key = generateKey(filePath, cleanText, textIndex++);

      // Initialize entry
      const entry: TranslationEntry = {
        key,
        ko: isKorean(cleanText) ? cleanText : "",
        en: isEnglish(cleanText) ? cleanText : "",
        context: item.context,
      };

      entries.push(entry);
      seenTexts.set(cleanText, entry);
    }
  }

  console.log(`\n📝 Collected ${entries.length} unique strings`);

  // Prepare translation batches
  const needsKoTranslation: { key: string; text: string; targetLang: "ko" }[] = [];
  const needsEnTranslation: { key: string; text: string; targetLang: "en" }[] = [];

  entries.forEach((entry) => {
    if (!entry.ko && entry.en) {
      needsKoTranslation.push({ key: entry.key, text: entry.en, targetLang: "ko" });
    }
    if (!entry.en && entry.ko) {
      needsEnTranslation.push({ key: entry.key, text: entry.ko, targetLang: "en" });
    }
  });

  console.log(`🤖 Need to translate: ${needsEnTranslation.length} to English, ${needsKoTranslation.length} to Korean\n`);

  // Translate missing strings
  if (needsEnTranslation.length > 0) {
    console.log(`🔄 Translating Korean → English...`);
    const enTranslations = await batchTranslate(needsEnTranslation);

    entries.forEach((entry) => {
      if (!entry.en) {
        const translation = enTranslations.get(entry.key);
        if (translation) entry.en = translation;
      }
    });
  }

  if (needsKoTranslation.length > 0) {
    console.log(`🔄 Translating English → Korean...`);
    const koTranslations = await batchTranslate(needsKoTranslation);

    entries.forEach((entry) => {
      if (!entry.ko) {
        const translation = koTranslations.get(entry.key);
        if (translation) entry.ko = translation;
      }
    });
  }

  return entries;
}

/**
 * Convert flat entries to nested JSON structure
 */
function entriesToNestedJson(entries: TranslationEntry[], lang: "ko" | "en"): Record<string, any> {
  const result: Record<string, any> = {};

  entries.forEach((entry) => {
    const keys = entry.key.split(".");
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = entry[lang];
  });

  return result;
}

/**
 * Main execution
 */
async function main() {
  const scanReportPath = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");

  if (!scanReportPath) {
    console.log("Usage: npx ts-node scripts/i18n/generate-json-translations.ts <scan-report.json> [--dry-run]");
    console.log("\nExample:");
    console.log("  GEMINI_API_KEY=xxx npx ts-node scripts/i18n/generate-json-translations.ts scan-report.json");
    process.exit(1);
  }

  const fullPath = scanReportPath.startsWith("/")
    ? scanReportPath
    : path.join(process.cwd(), scanReportPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Scan report not found: ${fullPath}`);
    process.exit(1);
  }

  console.log("======================================================================");
  console.log("🌐 GENERATE JSON TRANSLATIONS");
  console.log("======================================================================");

  if (dryRun) {
    console.log("🔍 DRY RUN MODE\n");
  }

  const scanResult: ScanResult = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

  console.log(`📊 Found ${scanResult.totalStrings} hardcoded strings in ${scanResult.filesWithHardcoded} files\n`);

  // Collect and translate
  const entries = await collectTranslations(scanResult);

  // Generate nested JSON
  const koJson = entriesToNestedJson(entries, "ko");
  const enJson = entriesToNestedJson(entries, "en");

  console.log("\n======================================================================");
  console.log("📊 SUMMARY");
  console.log("======================================================================");
  console.log(`✅ Total entries: ${entries.length}`);
  console.log(`🇰🇷 Korean translations: ${entries.filter(e => e.ko).length}`);
  console.log(`🇺🇸 English translations: ${entries.filter(e => e.en).length}`);

  if (!dryRun) {
    // Create translations directory
    const translationsDir = path.join(process.cwd(), "lib/i18n/translations");
    fs.mkdirSync(translationsDir, { recursive: true });

    // Write JSON files
    const koPath = path.join(translationsDir, "ko.json");
    const enPath = path.join(translationsDir, "en.json");

    fs.writeFileSync(koPath, JSON.stringify(koJson, null, 2));
    fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2));

    console.log(`\n💾 Generated translation files:`);
    console.log(`   ${koPath}`);
    console.log(`   ${enPath}`);

    // Also save flat format for reference
    const flatPath = path.join("scripts/i18n/output", "translations-flat.json");
    fs.mkdirSync(path.dirname(flatPath), { recursive: true });
    fs.writeFileSync(flatPath, JSON.stringify(entries, null, 2));
    console.log(`   ${flatPath} (flat format for reference)`);
  } else {
    console.log(`\n💡 Run without --dry-run to generate files`);
  }

  console.log("\n======================================================================");
}

main().catch(console.error);

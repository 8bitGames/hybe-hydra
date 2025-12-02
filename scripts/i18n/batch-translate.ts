#!/usr/bin/env npx ts-node
/**
 * Batch Translation Utility
 * 일괄 번역 유틸리티
 *
 * Translates missing translations using AI (Gemini).
 *
 * Usage:
 *   npx ts-node scripts/i18n/batch-translate.ts translations-generated.json
 *   npx ts-node scripts/i18n/batch-translate.ts translations-generated.json --dry-run
 */

import * as fs from "fs";
import * as path from "path";

interface TranslationEntry {
  en: string;
  ko: string;
}

interface TranslationFile {
  [key: string]: TranslationEntry;
}

// Check if translation needs work
function needsTranslation(text: string): boolean {
  return text.startsWith("[TRANSLATE]") || text.startsWith("[번역 필요]");
}

// Extract actual text from placeholder
function extractText(text: string): string {
  return text.replace(/^\[TRANSLATE\]\s*/, "").replace(/^\[번역 필요\]\s*/, "");
}

// Batch translations for efficiency
function batchEntries(
  entries: { key: string; text: string; targetLang: "ko" | "en" }[],
  batchSize: number = 20
): { key: string; text: string; targetLang: "ko" | "en" }[][] {
  const batches: { key: string; text: string; targetLang: "ko" | "en" }[][] = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push(entries.slice(i, i + batchSize));
  }
  return batches;
}

// Translate using Gemini API
async function translateWithGemini(
  texts: { key: string; text: string; targetLang: "ko" | "en" }[]
): Promise<Map<string, string>> {
  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
  });

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  const results = new Map<string, string>();

  // Group by target language
  const koTexts = texts.filter((t) => t.targetLang === "ko");
  const enTexts = texts.filter((t) => t.targetLang === "en");

  // Translate to Korean
  if (koTexts.length > 0) {
    const prompt = `Translate the following English texts to Korean. Return ONLY a JSON object with the keys and translated values, no explanation.

Input:
${JSON.stringify(
  koTexts.reduce((acc, t) => ({ ...acc, [t.key]: t.text }), {}),
  null,
  2
)}

Requirements:
- Use natural, conversational Korean
- For UI elements, use polite but concise language
- Keep any placeholders like {count} or {name} unchanged
- Return valid JSON only`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text || "";
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const translations = JSON.parse(jsonMatch[0]);
        Object.entries(translations).forEach(([key, value]) => {
          results.set(key, value as string);
        });
      }
    } catch (error) {
      console.error("Error translating to Korean:", error);
    }
  }

  // Translate to English
  if (enTexts.length > 0) {
    const prompt = `Translate the following Korean texts to English. Return ONLY a JSON object with the keys and translated values, no explanation.

Input:
${JSON.stringify(
  enTexts.reduce((acc, t) => ({ ...acc, [t.key]: t.text }), {}),
  null,
  2
)}

Requirements:
- Use clear, professional English
- For UI elements, use concise language
- Keep any placeholders like {count} or {name} unchanged
- Return valid JSON only`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text || "";
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const translations = JSON.parse(jsonMatch[0]);
        Object.entries(translations).forEach(([key, value]) => {
          results.set(key, value as string);
        });
      }
    } catch (error) {
      console.error("Error translating to English:", error);
    }
  }

  return results;
}

// Main execution
async function main() {
  const inputFile = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");

  if (!inputFile) {
    console.log("Usage: npx ts-node scripts/i18n/batch-translate.ts <translations.json> [--dry-run]");
    console.log("\nFirst generate translations with:");
    console.log("  npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output scan-report.json");
    console.log("  npx ts-node scripts/i18n/generate-translation-keys.ts scan-report.json");
    process.exit(1);
  }

  const filePath = inputFile.startsWith("/") ? inputFile : path.join(process.cwd(), inputFile);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const translations: TranslationFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Find entries that need translation
  const toTranslate: { key: string; text: string; targetLang: "ko" | "en" }[] = [];

  for (const [key, entry] of Object.entries(translations)) {
    if (needsTranslation(entry.ko)) {
      toTranslate.push({
        key,
        text: extractText(entry.en),
        targetLang: "ko",
      });
    }
    if (needsTranslation(entry.en)) {
      toTranslate.push({
        key,
        text: extractText(entry.ko),
        targetLang: "en",
      });
    }
  }

  console.log(`\n📊 Translation Analysis:`);
  console.log(`   Total entries: ${Object.keys(translations).length}`);
  console.log(`   Need translation: ${toTranslate.length}`);
  console.log(`   - To Korean: ${toTranslate.filter((t) => t.targetLang === "ko").length}`);
  console.log(`   - To English: ${toTranslate.filter((t) => t.targetLang === "en").length}`);

  if (toTranslate.length === 0) {
    console.log("\n✅ All translations are complete!");
    return;
  }

  if (dryRun) {
    console.log("\n🔍 Dry run - showing what would be translated:\n");
    toTranslate.slice(0, 10).forEach((t) => {
      console.log(`   [${t.targetLang}] ${t.key}: "${t.text.substring(0, 50)}..."`);
    });
    if (toTranslate.length > 10) {
      console.log(`   ... and ${toTranslate.length - 10} more`);
    }
    return;
  }

  console.log("\n🔄 Starting batch translation...\n");

  const batches = batchEntries(toTranslate, 20);
  let translated = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`   Processing batch ${i + 1}/${batches.length} (${batch.length} items)...`);

    try {
      const results = await translateWithGemini(batch);

      results.forEach((value, key) => {
        const entry = translations[key];
        if (entry) {
          const item = batch.find((b) => b.key === key);
          if (item?.targetLang === "ko") {
            entry.ko = value;
          } else {
            entry.en = value;
          }
          translated++;
        }
      });

      // Rate limiting - wait between batches
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`   ❌ Error in batch ${i + 1}:`, error);
    }
  }

  // Save results
  const outputPath = filePath.replace(".json", "-translated.json");
  fs.writeFileSync(outputPath, JSON.stringify(translations, null, 2));

  console.log(`\n✅ Translation complete!`);
  console.log(`   Translated: ${translated}/${toTranslate.length}`);
  console.log(`   Output saved to: ${outputPath}`);
}

main().catch(console.error);

export { translateWithGemini, needsTranslation };

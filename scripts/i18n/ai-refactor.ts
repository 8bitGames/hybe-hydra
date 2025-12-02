#!/usr/bin/env npx ts-node
/**
 * AI-Powered i18n Refactoring Script
 * AI 기반 i18n 리팩토링 스크립트
 *
 * Uses Gemini AI to automatically:
 * 1. Detect hardcoded Korean/English strings
 * 2. Generate translations for unpaired strings
 * 3. Replace with pick() calls
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/i18n/ai-refactor.ts scan-report.json --dry-run
 *   GEMINI_API_KEY=xxx npx ts-node scripts/i18n/ai-refactor.ts scan-report.json
 *   GEMINI_API_KEY=xxx npx ts-node scripts/i18n/ai-refactor.ts scan-report.json --file path/to/file.tsx
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

interface Translation {
  ko: string;
  en: string;
}

interface RefactorResult {
  file: string;
  stringsReplaced: number;
  importAdded: boolean;
  hookAdded: boolean;
  aiTranslations: number;
  changes: Array<{
    line: number;
    original: string;
    replacement: string;
    translation: Translation;
  }>;
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
  return /^[a-zA-Z\s.,!?'-]+$/.test(text);
}

/**
 * Use Gemini AI to translate text
 */
async function translateWithGemini(texts: string[], targetLang: "ko" | "en"): Promise<Map<string, string>> {
  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
  });

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  const results = new Map<string, string>();

  if (texts.length === 0) return results;

  const prompt = targetLang === "ko"
    ? `Translate these English UI texts to natural Korean. Return ONLY a JSON object with original text as keys and Korean translations as values:

${JSON.stringify(texts, null, 2)}

Requirements:
- Use natural, conversational Korean for UI
- Keep placeholders like {count} unchanged
- Be concise and polite
- Return valid JSON only`
    : `Translate these Korean UI texts to natural English. Return ONLY a JSON object with original text as keys and English translations as values:

${JSON.stringify(texts, null, 2)}

Requirements:
- Use clear, professional English for UI
- Keep placeholders like {count} unchanged
- Be concise
- Return valid JSON only`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const responseText = response.text || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const translations = JSON.parse(jsonMatch[0]);
      Object.entries(translations).forEach(([key, value]) => {
        results.set(key, value as string);
      });
    }
  } catch (error) {
    console.error(`Error translating to ${targetLang}:`, error);
  }

  return results;
}

/**
 * Get or generate translation for a text
 */
async function getTranslation(
  text: string,
  cache: Map<string, Translation>,
  pendingTranslations: Map<string, "ko" | "en">
): Promise<Translation | null> {
  const cleanText = text.trim();

  // Check cache
  if (cache.has(cleanText)) {
    return cache.get(cleanText)!;
  }

  // Determine source language
  if (isKorean(cleanText)) {
    pendingTranslations.set(cleanText, "en");
    return { ko: cleanText, en: "[PENDING]" };
  } else if (isEnglish(cleanText)) {
    pendingTranslations.set(cleanText, "ko");
    return { ko: "[PENDING]", en: cleanText };
  }

  return null;
}

/**
 * Process pending translations in batches
 */
async function processPendingTranslations(
  pending: Map<string, "ko" | "en">,
  cache: Map<string, Translation>
): Promise<void> {
  const toKorean = Array.from(pending.entries())
    .filter(([_, lang]) => lang === "ko")
    .map(([text, _]) => text);

  const toEnglish = Array.from(pending.entries())
    .filter(([_, lang]) => lang === "en")
    .map(([text, _]) => text);

  console.log(`   🤖 Translating ${toKorean.length} to Korean, ${toEnglish.length} to English...`);

  // Batch translations
  const batchSize = 20;

  // Translate to Korean
  for (let i = 0; i < toKorean.length; i += batchSize) {
    const batch = toKorean.slice(i, i + batchSize);
    const results = await translateWithGemini(batch, "ko");

    batch.forEach((text) => {
      const translation = results.get(text);
      if (translation) {
        cache.set(text, { ko: translation, en: text });
      }
    });

    // Rate limit
    if (i + batchSize < toKorean.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Translate to English
  for (let i = 0; i < toEnglish.length; i += batchSize) {
    const batch = toEnglish.slice(i, i + batchSize);
    const results = await translateWithGemini(batch, "en");

    batch.forEach((text) => {
      const translation = results.get(text);
      if (translation) {
        cache.set(text, { ko: text, en: translation });
      }
    });

    // Rate limit
    if (i + batchSize < toEnglish.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Add useT import
 */
function ensureUseTImport(content: string): { content: string; added: boolean } {
  if (/import\s+\{[^}]*useT[^}]*\}\s+from\s+["']@\/lib\/i18n\/components["']/.test(content)) {
    return { content, added: false };
  }

  if (/import\s+\{[^}]*useI18n[^}]*\}\s+from\s+["']@\/lib\/i18n["']/.test(content)) {
    content = content.replace(
      /import\s+\{[^}]*useI18n[^}]*\}\s+from\s+["']@\/lib\/i18n["']/,
      'import { useT } from "@/lib/i18n/components"'
    );
    return { content, added: true };
  }

  const lines = content.split("\n");
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("import ")) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, 'import { useT } from "@/lib/i18n/components";');
    return { content: lines.join("\n"), added: true };
  }

  const useClientIndex = lines.findIndex(line =>
    line.includes('"use client"') || line.includes("'use client'")
  );

  if (useClientIndex >= 0) {
    lines.splice(useClientIndex + 2, 0, 'import { useT } from "@/lib/i18n/components";');
  } else {
    lines.unshift('import { useT } from "@/lib/i18n/components";');
  }

  return { content: lines.join("\n"), added: true };
}

/**
 * Add useT hook
 */
function ensureUseTHook(content: string): { content: string; added: boolean } {
  if (/const\s+\{[^}]*pick[^}]*\}\s*=\s*useT\(\)/.test(content)) {
    return { content, added: false };
  }

  if (/const\s+\{[^}]*language[^}]*\}\s*=\s*useI18n\(\)/.test(content)) {
    content = content.replace(
      /const\s+\{[^}]*language[^}]*\}\s*=\s*useI18n\(\)/,
      'const { pick } = useT()'
    );
    content = content.replace(/const\s+isKorean\s*=\s*language\s*===\s*["']ko["'];?\n?/g, '');
    return { content, added: true };
  }

  const functionMatch = content.match(/export (?:default )?function \w+\([^)]*\)\s*\{/);
  if (functionMatch && functionMatch.index !== undefined) {
    const insertPos = functionMatch.index + functionMatch[0].length;
    content = content.substring(0, insertPos) + "\n  const { pick } = useT();\n" + content.substring(insertPos);
    return { content, added: true };
  }

  const arrowMatch = content.match(/export const \w+\s*=\s*\([^)]*\)\s*=>\s*\{/);
  if (arrowMatch && arrowMatch.index !== undefined) {
    const insertPos = arrowMatch.index + arrowMatch[0].length;
    content = content.substring(0, insertPos) + "\n  const { pick } = useT();\n" + content.substring(insertPos);
    return { content, added: true };
  }

  return { content, added: false };
}

/**
 * Replace hardcoded string with pick() call
 */
function replaceHardcodedString(
  content: string,
  hardcoded: HardcodedString,
  translation: Translation
): { content: string; replaced: boolean } {
  const { text, type } = hardcoded;
  const cleanText = text.trim();
  const { ko, en } = translation;

  // Skip if translation is pending
  if (ko === "[PENDING]" || en === "[PENDING]") {
    return { content, replaced: false };
  }

  const replacement = `{pick("${ko}", "${en}")}`;

  if (type === "jsx-text" || type === "korean") {
    // JSX text: >Korean Text< → >{pick("한글", "English")}<
    const jsxPattern = new RegExp(`>${escapeRegex(cleanText)}<`, 'g');
    if (jsxPattern.test(content)) {
      return { content: content.replace(jsxPattern, `>${replacement}<`), replaced: true };
    }
  }

  if (type === "attribute") {
    // Attribute: placeholder="text" → placeholder={pick(...)}
    const attrPatterns = [
      new RegExp(`(placeholder|title|aria-label|value)=["']${escapeRegex(cleanText)}["']`, 'g'),
      new RegExp(`(placeholder|title|aria-label|value)=\\{["']${escapeRegex(cleanText)}["']\\}`, 'g'),
    ];

    for (const pattern of attrPatterns) {
      if (pattern.test(content)) {
        return { content: content.replace(pattern, `$1=${replacement}`), replaced: true };
      }
    }
  }

  // Try string literal replacement
  const stringPatterns = [
    new RegExp(`["']${escapeRegex(cleanText)}["']`, 'g'),
  ];

  for (const pattern of stringPatterns) {
    if (pattern.test(content)) {
      return { content: content.replace(pattern, `pick("${ko}", "${en}")`), replaced: true };
    }
  }

  return { content, replaced: false };
}

/**
 * Refactor a single file with AI translations
 */
async function refactorFileWithAI(
  filePath: string,
  hardcodedStrings: HardcodedString[],
  translationCache: Map<string, Translation>,
  dryRun: boolean
): Promise<RefactorResult | null> {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  let content = fs.readFileSync(fullPath, "utf-8");
  const originalContent = content;

  // Collect pending translations
  const pendingTranslations = new Map<string, "ko" | "en">();
  const translations: Translation[] = [];

  for (const hardcoded of hardcodedStrings) {
    const translation = await getTranslation(hardcoded.text, translationCache, pendingTranslations);
    if (translation) {
      translations.push(translation);
    }
  }

  // Process pending translations with AI
  if (pendingTranslations.size > 0) {
    await processPendingTranslations(pendingTranslations, translationCache);
  }

  // Now replace all strings
  const changes: RefactorResult["changes"] = [];
  let aiTranslations = 0;

  for (let i = 0; i < hardcodedStrings.length; i++) {
    const hardcoded = hardcodedStrings[i];
    const translation = translationCache.get(hardcoded.text.trim());

    if (translation && translation.ko !== "[PENDING]" && translation.en !== "[PENDING]") {
      const result = replaceHardcodedString(content, hardcoded, translation);

      if (result.replaced) {
        content = result.content;
        changes.push({
          line: hardcoded.line,
          original: hardcoded.text,
          replacement: `pick("${translation.ko}", "${translation.en}")`,
          translation,
        });

        if (pendingTranslations.has(hardcoded.text.trim())) {
          aiTranslations++;
        }
      }
    }
  }

  if (changes.length > 0) {
    const importResult = ensureUseTImport(content);
    content = importResult.content;

    const hookResult = ensureUseTHook(content);
    content = hookResult.content;

    if (!dryRun) {
      const backupPath = fullPath + ".i18n-backup";
      fs.writeFileSync(backupPath, originalContent);
      fs.writeFileSync(fullPath, content);
    }

    return {
      file: filePath,
      stringsReplaced: changes.length,
      importAdded: importResult.added,
      hookAdded: hookResult.added,
      aiTranslations,
      changes,
    };
  }

  return null;
}

/**
 * Main execution
 */
async function main() {
  const scanReportPath = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const targetFile = process.argv.includes("--file")
    ? process.argv[process.argv.indexOf("--file") + 1]
    : null;

  if (!scanReportPath) {
    console.log("Usage: GEMINI_API_KEY=xxx npx ts-node scripts/i18n/ai-refactor.ts <scan-report.json> [--dry-run] [--file path]");
    console.log("\nExample:");
    console.log("  GEMINI_API_KEY=xxx npx ts-node scripts/i18n/ai-refactor.ts scan-report.json --dry-run");
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY environment variable is required");
    console.error("\nSet it with:");
    console.error("  export GEMINI_API_KEY=your_api_key");
    process.exit(1);
  }

  const scanResult: ScanResult = JSON.parse(
    fs.readFileSync(scanReportPath.startsWith("/") ? scanReportPath : path.join(process.cwd(), scanReportPath), "utf-8")
  );

  console.log("\n" + "=".repeat(70));
  console.log("🤖 AI-POWERED i18n REFACTORING");
  console.log("=".repeat(70));

  if (dryRun) {
    console.log("\n🔍 DRY RUN MODE - No files will be modified\n");
  }

  let filesToProcess = Object.keys(scanResult.byFile);

  if (targetFile) {
    if (!filesToProcess.includes(targetFile)) {
      console.error(`❌ File not found: ${targetFile}`);
      process.exit(1);
    }
    filesToProcess = [targetFile];
  }

  console.log(`📁 Processing ${filesToProcess.length} files with AI...\n`);

  const translationCache = new Map<string, Translation>();
  const results: RefactorResult[] = [];

  for (const filePath of filesToProcess) {
    console.log(`📄 ${filePath}`);
    const hardcodedStrings = scanResult.byFile[filePath];
    const result = await refactorFileWithAI(filePath, hardcodedStrings, translationCache, dryRun);

    if (result) {
      results.push(result);
      console.log(`   ✅ Replaced: ${result.stringsReplaced} strings`);
      console.log(`   🤖 AI translations: ${result.aiTranslations}`);
      console.log();
    }
  }

  console.log("=".repeat(70));
  console.log("📊 SUMMARY");
  console.log("=".repeat(70));
  console.log(`✅ Refactored: ${results.length} files`);
  console.log(`🔤 Total strings replaced: ${results.reduce((sum, r) => sum + r.stringsReplaced, 0)}`);
  console.log(`🤖 AI-generated translations: ${results.reduce((sum, r) => sum + r.aiTranslations, 0)}`);
  console.log(`💰 Translation cache size: ${translationCache.size} entries`);

  if (results.length > 0 && !dryRun) {
    console.log(`\n💾 Backups created with .i18n-backup extension`);

    // Save translation cache
    const cacheOutput = "scripts/i18n/output/ai-translation-cache.json";
    fs.mkdirSync(path.dirname(cacheOutput), { recursive: true });
    const cacheData: { [key: string]: Translation } = {};
    translationCache.forEach((value, key) => {
      cacheData[key] = value;
    });
    fs.writeFileSync(cacheOutput, JSON.stringify(cacheData, null, 2));
    console.log(`💾 Translation cache saved: ${cacheOutput}`);
  }

  if (dryRun) {
    console.log(`\n💡 Run without --dry-run to apply changes`);
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);

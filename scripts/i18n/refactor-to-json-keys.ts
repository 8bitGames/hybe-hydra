#!/usr/bin/env npx ts-node
/**
 * Refactor to JSON Translation Keys
 * JSON 번역 키로 리팩토링
 *
 * Replaces inline strings and pick() calls with t('translation.key') calls.
 *
 * Usage:
 *   npx ts-node scripts/i18n/refactor-to-json-keys.ts --dry-run
 *   npx ts-node scripts/i18n/refactor-to-json-keys.ts
 *   npx ts-node scripts/i18n/refactor-to-json-keys.ts --file path/to/file.tsx
 */

import * as fs from "fs";
import * as path from "path";

interface TranslationEntry {
  key: string;
  ko: string;
  en: string;
  context?: string;
}

interface RefactorResult {
  file: string;
  replacements: number;
  importUpdated: boolean;
  hookUpdated: boolean;
}

/**
 * Load flat translations for reverse lookup
 */
function loadTranslations(translationsPath: string): TranslationEntry[] {
  const fullPath = path.join(process.cwd(), translationsPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Translations file not found: ${fullPath}`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

/**
 * Find translation key by Korean or English text
 */
function findKeyByText(
  text: string,
  translations: TranslationEntry[]
): string | null {
  const cleanText = text.trim();

  for (const entry of translations) {
    if (entry.ko === cleanText || entry.en === cleanText) {
      return entry.key;
    }
  }

  // Try partial match
  for (const entry of translations) {
    if (cleanText.includes(entry.ko) || cleanText.includes(entry.en)) {
      return entry.key;
    }
  }

  return null;
}

/**
 * Update imports to use useTranslation
 */
function updateImports(content: string): { content: string; updated: boolean } {
  // Replace useT import with useTranslation
  if (/import\s+\{[^}]*useT[^}]*\}/.test(content)) {
    content = content.replace(
      /import\s+\{\s*useT\s*\}\s+from\s+["']@\/lib\/i18n\/components["']/,
      'import { useTranslation } from "@/lib/i18n/index.json"'
    );
    return { content, updated: true };
  }

  // Replace useI18n import
  if (/import\s+\{[^}]*useI18n[^}]*\}/.test(content)) {
    content = content.replace(
      /import\s+\{\s*useI18n\s*\}\s+from\s+["']@\/lib\/i18n["']/,
      'import { useTranslation } from "@/lib/i18n/index.json"'
    );
    return { content, updated: true };
  }

  // Add import if not present
  const lines = content.split("\n");
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("import ")) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(
      lastImportIndex + 1,
      0,
      'import { useTranslation } from "@/lib/i18n/index.json";'
    );
    return { content: lines.join("\n"), updated: true };
  }

  return { content, updated: false };
}

/**
 * Update hook usage to useTranslation
 */
function updateHook(content: string): { content: string; updated: boolean } {
  // Replace useT() with useTranslation()
  if (/const\s+\{\s*pick\s*\}\s*=\s*useT\(\)/.test(content)) {
    content = content.replace(
      /const\s+\{\s*pick\s*\}\s*=\s*useT\(\)/g,
      'const { t } = useTranslation()'
    );
    return { content, updated: true };
  }

  // Replace useI18n() with useTranslation()
  if (/const\s+\{[^}]*language[^}]*\}\s*=\s*useI18n\(\)/.test(content)) {
    content = content.replace(
      /const\s+\{[^}]*language[^}]*\}\s*=\s*useI18n\(\)/,
      'const { t, language } = useTranslation()'
    );
    return { content, updated: true };
  }

  // Add hook if not present
  const functionMatch = content.match(/export (?:default )?function \w+\([^)]*\)\s*\{/);

  if (functionMatch && functionMatch.index !== undefined) {
    const insertPos = functionMatch.index + functionMatch[0].length;
    content =
      content.substring(0, insertPos) +
      "\n  const { t } = useTranslation();\n" +
      content.substring(insertPos);
    return { content, updated: true };
  }

  return { content, updated: false };
}

/**
 * Replace inline strings with translation keys
 */
function replaceStrings(
  content: string,
  translations: TranslationEntry[]
): { content: string; count: number } {
  let count = 0;

  // Pattern 1: pick("한글", "English") → t('key')
  const pickPattern = /pick\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g;

  content = content.replace(pickPattern, (match, ko, en) => {
    const key = findKeyByText(ko, translations) || findKeyByText(en, translations);
    if (key) {
      count++;
      return `t('${key}')`;
    }
    return match;
  });

  // Pattern 2: {language === "ko" ? "한글" : "English"} → {t('key')}
  const ternaryPattern = /\{language\s*===\s*["']ko["']\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\s*\}/g;

  content = content.replace(ternaryPattern, (match, ko, en) => {
    const key = findKeyByText(ko, translations);
    if (key) {
      count++;
      return `{t('${key}')}`;
    }
    return match;
  });

  // Pattern 3: Standalone Korean strings in JSX → {t('key')}
  const koreanPattern = />([가-힣\s]+)</g;

  content = content.replace(koreanPattern, (match, text) => {
    const cleanText = text.trim();
    if (cleanText.length > 1) {
      const key = findKeyByText(cleanText, translations);
      if (key) {
        count++;
        return `>{t('${key}')}<`;
      }
    }
    return match;
  });

  return { content, count };
}

/**
 * Refactor a single file
 */
async function refactorFile(
  filePath: string,
  translations: TranslationEntry[],
  dryRun: boolean
): Promise<RefactorResult | null> {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return null;
  }

  let content = fs.readFileSync(fullPath, "utf-8");
  const originalContent = content;

  // Update imports
  const importResult = updateImports(content);
  content = importResult.content;

  // Update hook
  const hookResult = updateHook(content);
  content = hookResult.content;

  // Replace strings
  const replaceResult = replaceStrings(content, translations);
  content = replaceResult.content;

  if (content === originalContent) {
    return null;
  }

  if (!dryRun) {
    // Create backup
    fs.writeFileSync(fullPath + ".json-backup", originalContent);

    // Write refactored content
    fs.writeFileSync(fullPath, content);
  }

  return {
    file: filePath,
    replacements: replaceResult.count,
    importUpdated: importResult.updated,
    hookUpdated: hookResult.updated,
  };
}

/**
 * Main execution
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const targetFile = process.argv.includes("--file")
    ? process.argv[process.argv.indexOf("--file") + 1]
    : null;

  const translationsPath = "scripts/i18n/output/translations-flat.json";

  if (!fs.existsSync(translationsPath)) {
    console.error(`❌ Flat translations file not found: ${translationsPath}`);
    console.error(`\nRun the generator first:`);
    console.error(
      `  GEMINI_API_KEY=xxx npx ts-node scripts/i18n/generate-json-translations.ts scan-report.json`
    );
    process.exit(1);
  }

  console.log("======================================================================");
  console.log("🔄 REFACTOR TO JSON TRANSLATION KEYS");
  console.log("======================================================================");

  if (dryRun) {
    console.log("🔍 DRY RUN MODE\n");
  }

  const translations = loadTranslations(translationsPath);
  console.log(`📚 Loaded ${translations.length} translation keys\n`);

  // Get files to process
  const scanDirs = ["app/(dashboard)", "components"];
  const extensions = [".tsx", ".ts"];

  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const fullPath = path.join(process.cwd(), dir);

    if (!fs.existsSync(fullPath)) return fileList;

    const files = fs.readdirSync(fullPath);

    files.forEach((file) => {
      const filePath = path.join(fullPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        getAllFiles(path.join(dir, file), fileList);
      } else if (extensions.some((ext) => file.endsWith(ext))) {
        fileList.push(path.join(dir, file));
      }
    });

    return fileList;
  }

  let filesToProcess: string[] = [];

  if (targetFile) {
    filesToProcess = [targetFile];
  } else {
    scanDirs.forEach((dir) => {
      filesToProcess.push(...getAllFiles(dir));
    });
  }

  console.log(`📁 Processing ${filesToProcess.length} files...`);

  const results: RefactorResult[] = [];
  let skipped = 0;

  for (const filePath of filesToProcess) {
    const result = await refactorFile(filePath, translations, dryRun);

    if (result) {
      results.push(result);
      console.log(`✅ ${result.file} - ${result.replacements} replacements`);
    } else {
      skipped++;
    }
  }

  // Summary
  console.log("\n======================================================================");
  console.log("📊 SUMMARY");
  console.log("======================================================================");
  console.log(`✅ Refactored: ${results.length} files`);
  console.log(`⏭️  Skipped: ${skipped} files`);
  console.log(
    `🔤 Total replacements: ${results.reduce((sum, r) => sum + r.replacements, 0)}`
  );

  if (results.length > 0 && !dryRun) {
    console.log(`\n💾 Backups created with .json-backup extension`);
  }

  if (dryRun) {
    console.log(`\n💡 Run without --dry-run to apply changes`);
  }

  console.log("\n======================================================================");
}

main().catch(console.error);

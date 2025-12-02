#!/usr/bin/env npx ts-node
/**
 * Advanced i18n Refactoring Script
 * 고급 i18n 리팩토링 스크립트
 *
 * Handles raw Korean/English text by using translation data.
 * Detects hardcoded strings and replaces with pick() calls.
 *
 * Usage:
 *   npx ts-node scripts/i18n/advanced-refactor.ts scan-report.json translations-translated.json --dry-run
 *   npx ts-node scripts/i18n/advanced-refactor.ts scan-report.json translations-translated.json
 *   npx ts-node scripts/i18n/advanced-refactor.ts scan-report.json translations-translated.json --file path/to/file.tsx
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
  en: string;
  ko: string;
}

interface TranslationData {
  [key: string]: TranslationEntry;
}

interface RefactorResult {
  file: string;
  stringsReplaced: number;
  importAdded: boolean;
  hookAdded: boolean;
  changes: Array<{
    line: number;
    original: string;
    replacement: string;
  }>;
}

/**
 * Load translation data
 */
function loadTranslations(translationPath: string): TranslationData {
  const fullPath = translationPath.startsWith("/")
    ? translationPath
    : path.join(process.cwd(), translationPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Translation file not found: ${fullPath}`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

/**
 * Find translation for a given text
 */
function findTranslation(text: string, translations: TranslationData): TranslationEntry | null {
  const cleanText = text.trim();

  // Direct match
  for (const entry of Object.values(translations)) {
    if (entry.ko === cleanText || entry.en === cleanText) {
      return entry;
    }
  }

  // Partial match for longer strings
  for (const entry of Object.values(translations)) {
    if (cleanText.includes(entry.ko) || cleanText.includes(entry.en)) {
      return entry;
    }
  }

  return null;
}

/**
 * Check if text is Korean
 */
function isKorean(text: string): boolean {
  return /[\uAC00-\uD7AF]/.test(text);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Add useT import if not present
 */
function ensureUseTImport(content: string): { content: string; added: boolean } {
  // Check if already imported
  if (/import\s+\{[^}]*useT[^}]*\}\s+from\s+["']@\/lib\/i18n\/components["']/.test(content)) {
    return { content, added: false };
  }

  // Replace useI18n with useT
  if (/import\s+\{[^}]*useI18n[^}]*\}\s+from\s+["']@\/lib\/i18n["']/.test(content)) {
    content = content.replace(
      /import\s+\{[^}]*useI18n[^}]*\}\s+from\s+["']@\/lib\/i18n["']/,
      'import { useT } from "@/lib/i18n/components"'
    );
    return { content, added: true };
  }

  // Find last import
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

  // Add after "use client" or at top
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
 * Add useT hook if not present
 */
function ensureUseTHook(content: string): { content: string; added: boolean } {
  // Check if pick is already defined
  if (/const\s+\{[^}]*pick[^}]*\}\s*=\s*useT\(\)/.test(content)) {
    return { content, added: false };
  }

  // Replace useI18n hook
  if (/const\s+\{[^}]*language[^}]*\}\s*=\s*useI18n\(\)/.test(content)) {
    content = content.replace(
      /const\s+\{[^}]*language[^}]*\}\s*=\s*useI18n\(\)/,
      'const { pick } = useT()'
    );

    // Remove isKorean definition
    content = content.replace(/const\s+isKorean\s*=\s*language\s*===\s*["']ko["'];?\n?/g, '');

    return { content, added: true };
  }

  // Find component function and add hook
  const functionMatch = content.match(/export (?:default )?function \w+\([^)]*\)\s*\{/);

  if (functionMatch && functionMatch.index !== undefined) {
    const insertPos = functionMatch.index + functionMatch[0].length;
    content = content.substring(0, insertPos) + "\n  const { pick } = useT();\n" + content.substring(insertPos);
    return { content, added: true };
  }

  // Try arrow function
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
  translation: TranslationEntry,
  changes: Array<{ line: number; original: string; replacement: string }>
): string {
  const { text, type, context } = hardcoded;
  const cleanText = text.trim();

  // Determine which version is in the source
  const isKoreanSource = isKorean(cleanText);
  const ko = translation.ko;
  const en = translation.en;

  let replacement: string;

  if (type === "jsx-text") {
    // JSX text: <div>Korean Text</div> → <div>{pick("한글", "English")}</div>
    replacement = `{pick("${ko}", "${en}")}`;

    // Find and replace in context
    const searchPattern = new RegExp(`>${escapeRegex(cleanText)}<`, 'g');
    if (searchPattern.test(content)) {
      const newContent = content.replace(searchPattern, `>${replacement}<`);
      if (newContent !== content) {
        changes.push({
          line: hardcoded.line,
          original: `>${cleanText}<`,
          replacement: `>${replacement}<`,
        });
        return newContent;
      }
    }
  } else if (type === "attribute") {
    // Attribute: placeholder="Korean" → placeholder={pick("한글", "English")}
    replacement = `{pick("${ko}", "${en}")}`;

    // Try to find attribute pattern
    const attrPatterns = [
      new RegExp(`(placeholder|title|aria-label)=["']${escapeRegex(cleanText)}["']`, 'g'),
      new RegExp(`(placeholder|title|aria-label)=\\{["']${escapeRegex(cleanText)}["']\\}`, 'g'),
    ];

    for (const pattern of attrPatterns) {
      if (pattern.test(content)) {
        const newContent = content.replace(pattern, `$1=${replacement}`);
        if (newContent !== content) {
          changes.push({
            line: hardcoded.line,
            original: cleanText,
            replacement: replacement,
          });
          return newContent;
        }
      }
    }
  } else if (type === "korean") {
    // Generic Korean text - try multiple patterns
    replacement = `{pick("${ko}", "${en}")}`;

    // Pattern 1: Between JSX tags
    const jsxPattern = new RegExp(`>${escapeRegex(cleanText)}<`, 'g');
    if (jsxPattern.test(content)) {
      const newContent = content.replace(jsxPattern, `>${replacement}<`);
      if (newContent !== content) {
        changes.push({
          line: hardcoded.line,
          original: `>${cleanText}<`,
          replacement: `>${replacement}<`,
        });
        return newContent;
      }
    }

    // Pattern 2: In string literals
    const stringPatterns = [
      new RegExp(`["']${escapeRegex(cleanText)}["']`, 'g'),
      new RegExp(`\`${escapeRegex(cleanText)}\``, 'g'),
    ];

    for (const pattern of stringPatterns) {
      if (pattern.test(content)) {
        const newContent = content.replace(pattern, `pick("${ko}", "${en}")`);
        if (newContent !== content) {
          changes.push({
            line: hardcoded.line,
            original: cleanText,
            replacement: `pick("${ko}", "${en}")`,
          });
          return newContent;
        }
      }
    }
  }

  return content;
}

/**
 * Refactor a single file
 */
async function refactorFile(
  filePath: string,
  hardcodedStrings: HardcodedString[],
  translations: TranslationData,
  dryRun: boolean
): Promise<RefactorResult | null> {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return null;
  }

  let content = fs.readFileSync(fullPath, "utf-8");
  const originalContent = content;
  const changes: Array<{ line: number; original: string; replacement: string }> = [];

  // Sort strings by line number (descending) to avoid offset issues
  const sortedStrings = [...hardcodedStrings].sort((a, b) => b.line - a.line);

  // Replace each hardcoded string
  for (const hardcoded of sortedStrings) {
    const translation = findTranslation(hardcoded.text, translations);

    if (translation) {
      const newContent = replaceHardcodedString(content, hardcoded, translation, changes);
      if (newContent !== content) {
        content = newContent;
      }
    }
  }

  // If any changes were made, add import and hook
  if (content !== originalContent) {
    const importResult = ensureUseTImport(content);
    content = importResult.content;

    const hookResult = ensureUseTHook(content);
    content = hookResult.content;

    if (!dryRun) {
      // Create backup
      const backupPath = fullPath + ".i18n-backup";
      fs.writeFileSync(backupPath, originalContent);

      // Write refactored content
      fs.writeFileSync(fullPath, content);
    }

    return {
      file: filePath,
      stringsReplaced: changes.length,
      importAdded: importResult.added,
      hookAdded: hookResult.added,
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
  const translationPath = process.argv[3];
  const dryRun = process.argv.includes("--dry-run");
  const targetFile = process.argv.includes("--file")
    ? process.argv[process.argv.indexOf("--file") + 1]
    : null;

  if (!scanReportPath || !translationPath) {
    console.log("Usage: npx ts-node scripts/i18n/advanced-refactor.ts <scan-report.json> <translations.json> [--dry-run] [--file path]");
    console.log("\nExample:");
    console.log("  npx ts-node scripts/i18n/advanced-refactor.ts scan-report.json scripts/i18n/output/translations-generated-translated.json --dry-run");
    process.exit(1);
  }

  // Load scan results
  const scanResult: ScanResult = JSON.parse(
    fs.readFileSync(scanReportPath.startsWith("/") ? scanReportPath : path.join(process.cwd(), scanReportPath), "utf-8")
  );

  // Load translations
  const translations = loadTranslations(translationPath);

  console.log("\n" + "=".repeat(70));
  console.log("🔄 ADVANCED i18n REFACTORING");
  console.log("=".repeat(70));
  console.log(`\n📚 Loaded ${Object.keys(translations).length} translations`);

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be modified\n");
  }

  // Get files to process
  let filesToProcess = Object.keys(scanResult.byFile);

  if (targetFile) {
    if (!filesToProcess.includes(targetFile)) {
      console.error(`❌ File not found in scan report: ${targetFile}`);
      process.exit(1);
    }
    filesToProcess = [targetFile];
  }

  console.log(`📁 Processing ${filesToProcess.length} files...\n`);

  const results: RefactorResult[] = [];
  let skipped = 0;

  for (const filePath of filesToProcess) {
    const hardcodedStrings = scanResult.byFile[filePath];
    const result = await refactorFile(filePath, hardcodedStrings, translations, dryRun);

    if (result) {
      results.push(result);
      console.log(`✅ ${result.file}`);
      console.log(`   Replaced: ${result.stringsReplaced} strings`);
      if (result.importAdded) console.log(`   Added: useT import`);
      if (result.hookAdded) console.log(`   Added: useT hook`);
      if (result.changes.length > 0 && result.changes.length <= 5) {
        result.changes.forEach((change, idx) => {
          console.log(`   [${idx + 1}] Line ${change.line}: "${change.original.substring(0, 40)}..." → "${change.replacement.substring(0, 40)}..."`);
        });
      }
      console.log();
    } else {
      skipped++;
    }
  }

  // Summary
  console.log("=".repeat(70));
  console.log("📊 SUMMARY");
  console.log("=".repeat(70));
  console.log(`✅ Refactored: ${results.length} files`);
  console.log(`⏭️  Skipped: ${skipped} files (no matching translations)`);
  console.log(`🔤 Total strings replaced: ${results.reduce((sum, r) => sum + r.stringsReplaced, 0)}`);

  if (results.length > 0 && !dryRun) {
    console.log(`\n💾 Backups created with .i18n-backup extension`);
    console.log(`\n🧹 To remove backups after verification:`);
    console.log(`   find . -name "*.i18n-backup" -delete`);
  }

  if (dryRun) {
    console.log(`\n💡 Run without --dry-run to apply changes`);
  }

  // Save detailed results
  if (results.length > 0) {
    const outputPath = "scripts/i18n/output/advanced-refactor-results.json";
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ results, summary: { total: results.length, skipped } }, null, 2));
    console.log(`\n📄 Detailed results: ${outputPath}`);
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);

export { refactorFile };
export type { RefactorResult };

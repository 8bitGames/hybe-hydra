#!/usr/bin/env npx ts-node
/**
 * Automated i18n Refactoring Script
 * i18n 자동 리팩토링 스크립트
 *
 * Automatically converts hardcoded strings to use the i18n system.
 * 하드코딩된 문자열을 자동으로 i18n 시스템으로 변환합니다.
 *
 * Usage:
 *   npx ts-node scripts/i18n/auto-refactor.ts scan-report.json
 *   npx ts-node scripts/i18n/auto-refactor.ts scan-report.json --dry-run
 *   npx ts-node scripts/i18n/auto-refactor.ts scan-report.json --file src/components/Example.tsx
 */

import * as fs from "fs";
import * as path from "path";

interface HardcodedString {
  type: "jsx-text" | "attribute" | "template" | "korean";
  text: string;
  line: number;
  column?: number;
  file: string;
}

interface ScanResult {
  totalFiles: number;
  filesWithHardcoded: number;
  totalStrings: number;
  byFile: {
    [filepath: string]: HardcodedString[];
  };
}

interface RefactorResult {
  file: string;
  originalLines: number;
  refactoredLines: number;
  stringsConverted: number;
  importAdded: boolean;
  hookAdded: boolean;
  backup: string;
}

// Patterns to match and convert
const PATTERNS = {
  // {language === "ko" ? "한국어" : "English"}
  ternaryLanguage: /\{language\s*===\s*["']ko["']\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/g,

  // {isKorean ? "한국어" : "English"}
  ternaryIsKorean: /\{isKorean\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/g,

  // language === "ko" ? "한국어" : "English" (without braces)
  ternaryLanguageNoBrace: /language\s*===\s*["']ko["']\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/g,

  // isKorean ? "한국어" : "English" (without braces)
  ternaryIsKoreanNoBrace: /isKorean\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/g,

  // Existing imports to check
  useI18nImport: /import\s+\{[^}]*useI18n[^}]*\}\s+from\s+["']@\/lib\/i18n["']/,
  useTImport: /import\s+\{[^}]*useT[^}]*\}\s+from\s+["']@\/lib\/i18n\/components["']/,

  // Hook usage
  useI18nHook: /const\s+\{[^}]*language[^}]*\}\s*=\s*useI18n\(\)/,
  useTHook: /const\s+\{[^}]*pick[^}]*\}\s*=\s*useT\(\)/,
  isKoreanDef: /const\s+isKorean\s*=\s*language\s*===\s*["']ko["']/,
};

/**
 * Detect if file is a React component that needs i18n
 */
function shouldRefactorFile(filePath: string, content: string): boolean {
  const ext = path.extname(filePath);
  if (![".tsx", ".ts"].includes(ext)) return false;

  // Check if it's a React component
  if (!content.includes("react") && !content.includes("React")) return false;

  // Check if it has client/server directive
  const isClientComponent = content.includes('"use client"') || content.includes("'use client'");
  const isServerComponent = content.includes('"use server"') || content.includes("'use server'");

  return isClientComponent || isServerComponent || content.includes("export function") || content.includes("export default");
}

/**
 * Add useT import if not present
 */
function addUseTImport(content: string): { content: string; added: boolean } {
  // Check if already imported
  if (PATTERNS.useTImport.test(content)) {
    return { content, added: false };
  }

  // Check if useI18n is imported - replace it
  if (PATTERNS.useI18nImport.test(content)) {
    content = content.replace(
      PATTERNS.useI18nImport,
      'import { useT } from "@/lib/i18n/components"'
    );
    return { content, added: true };
  }

  // Find the last import statement
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

  // No imports found, add after "use client" or at the top
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
function addUseTHook(content: string): { content: string; added: boolean } {
  // Check if pick is already defined
  if (PATTERNS.useTHook.test(content)) {
    return { content, added: false };
  }

  // Replace useI18n hook with useT
  if (PATTERNS.useI18nHook.test(content)) {
    content = content.replace(
      PATTERNS.useI18nHook,
      'const { pick } = useT()'
    );

    // Remove isKorean definition if present
    content = content.replace(PATTERNS.isKoreanDef, '');

    return { content, added: true };
  }

  // Find component function and add hook
  const functionMatch = content.match(/export (?:default )?function \w+\([^)]*\)\s*\{/);

  if (functionMatch && functionMatch.index !== undefined) {
    const insertPos = functionMatch.index + functionMatch[0].length;
    const before = content.substring(0, insertPos);
    const after = content.substring(insertPos);

    content = before + "\n  const { pick } = useT();\n" + after;
    return { content, added: true };
  }

  // Try arrow function component
  const arrowMatch = content.match(/export const \w+\s*=\s*\([^)]*\)\s*=>\s*\{/);

  if (arrowMatch && arrowMatch.index !== undefined) {
    const insertPos = arrowMatch.index + arrowMatch[0].length;
    const before = content.substring(0, insertPos);
    const after = content.substring(insertPos);

    content = before + "\n  const { pick } = useT();\n" + after;
    return { content, added: true };
  }

  return { content, added: false };
}

/**
 * Convert ternary patterns to pick() calls
 */
function convertTernaryPatterns(content: string): { content: string; count: number } {
  let count = 0;

  // {language === "ko" ? "한국어" : "English"}
  content = content.replace(PATTERNS.ternaryLanguage, (match, ko, en) => {
    count++;
    return `{pick("${ko}", "${en}")}`;
  });

  // {isKorean ? "한국어" : "English"}
  content = content.replace(PATTERNS.ternaryIsKorean, (match, ko, en) => {
    count++;
    return `{pick("${ko}", "${en}")}`;
  });

  // language === "ko" ? "한국어" : "English"
  content = content.replace(PATTERNS.ternaryLanguageNoBrace, (match, ko, en) => {
    count++;
    return `pick("${ko}", "${en}")`;
  });

  // isKorean ? "한국어" : "English"
  content = content.replace(PATTERNS.ternaryIsKoreanNoBrace, (match, ko, en) => {
    count++;
    return `pick("${ko}", "${en}")`;
  });

  return { content, count };
}

/**
 * Refactor a single file
 */
async function refactorFile(filePath: string, dryRun: boolean = false): Promise<RefactorResult | null> {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return null;
  }

  let content = fs.readFileSync(fullPath, "utf-8");
  const originalContent = content;
  const originalLines = content.split("\n").length;

  // Check if file should be refactored
  if (!shouldRefactorFile(filePath, content)) {
    console.log(`⏭️  Skipping ${filePath} (not a React component)`);
    return null;
  }

  // Add import
  const importResult = addUseTImport(content);
  content = importResult.content;

  // Add hook
  const hookResult = addUseTHook(content);
  content = hookResult.content;

  // Convert patterns
  const convertResult = convertTernaryPatterns(content);
  content = convertResult.content;

  // Check if anything changed
  if (content === originalContent) {
    return null;
  }

  const result: RefactorResult = {
    file: filePath,
    originalLines,
    refactoredLines: content.split("\n").length,
    stringsConverted: convertResult.count,
    importAdded: importResult.added,
    hookAdded: hookResult.added,
    backup: "",
  };

  if (!dryRun) {
    // Create backup
    const backupPath = fullPath + ".i18n-backup";
    fs.writeFileSync(backupPath, originalContent);
    result.backup = backupPath;

    // Write refactored content
    fs.writeFileSync(fullPath, content);
  }

  return result;
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
    console.log("Usage: npx ts-node scripts/i18n/auto-refactor.ts <scan-report.json> [--dry-run] [--file path/to/file.tsx]");
    console.log("\nOptions:");
    console.log("  --dry-run    Preview changes without modifying files");
    console.log("  --file PATH  Refactor only a specific file");
    process.exit(1);
  }

  const fullPath = scanReportPath.startsWith("/")
    ? scanReportPath
    : path.join(process.cwd(), scanReportPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Scan report not found: ${fullPath}`);
    console.error("\nRun the scanner first:");
    console.error("  npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output scan-report.json");
    process.exit(1);
  }

  const scanResult: ScanResult = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

  console.log("\n" + "=".repeat(70));
  console.log("🔄 AUTOMATED i18n REFACTORING");
  console.log("=".repeat(70));

  if (dryRun) {
    console.log("\n🔍 DRY RUN MODE - No files will be modified\n");
  }

  // Get files from byFile object
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
    const result = await refactorFile(filePath, dryRun);

    if (result) {
      results.push(result);
      console.log(`✅ ${result.file}`);
      console.log(`   Converted: ${result.stringsConverted} strings`);
      if (result.importAdded) console.log(`   Added: useT import`);
      if (result.hookAdded) console.log(`   Added: useT hook`);
      if (!dryRun) console.log(`   Backup: ${result.backup}`);
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
  console.log(`⏭️  Skipped: ${skipped} files`);
  console.log(`🔤 Total strings converted: ${results.reduce((sum, r) => sum + r.stringsConverted, 0)}`);

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
    const outputPath = "scripts/i18n/output/refactor-results.json";
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ results, summary: { total: results.length, skipped } }, null, 2));
    console.log(`\n📄 Detailed results: ${outputPath}`);
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);

export { refactorFile };
export type { RefactorResult };

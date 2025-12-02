#!/usr/bin/env npx ts-node
/**
 * Translation Key Generator
 * 번역 키 생성기
 *
 * Generates translation keys and templates from scan results.
 *
 * Usage:
 *   npx ts-node scripts/i18n/generate-translation-keys.ts scan-report.json
 */

import * as fs from "fs";
import * as path from "path";

interface HardcodedString {
  file: string;
  line: number;
  text: string;
  context: string;
  type: string;
  suggestedKey: string;
}

interface ScanResult {
  byFile: Record<string, HardcodedString[]>;
}

interface TranslationEntry {
  key: string;
  en: string;
  ko: string;
  file: string;
  line: number;
}

// Korean character detection
function isKorean(text: string): boolean {
  return /[\uAC00-\uD7AF]/.test(text);
}

// Generate translation entries from scan result
function generateTranslationEntries(scanResult: ScanResult): TranslationEntry[] {
  const entries: TranslationEntry[] = [];
  const seenKeys = new Set<string>();

  for (const [file, strings] of Object.entries(scanResult.byFile)) {
    for (const str of strings) {
      // Skip if already seen this key
      if (seenKeys.has(str.suggestedKey)) continue;
      seenKeys.add(str.suggestedKey);

      const entry: TranslationEntry = {
        key: str.suggestedKey,
        en: isKorean(str.text) ? `[TRANSLATE] ${str.text}` : str.text,
        ko: isKorean(str.text) ? str.text : `[번역 필요] ${str.text}`,
        file: str.file,
        line: str.line,
      };

      entries.push(entry);
    }
  }

  return entries;
}

// Group entries by category for organized output
function groupByCategory(entries: TranslationEntry[]): Record<string, TranslationEntry[]> {
  const grouped: Record<string, TranslationEntry[]> = {};

  for (const entry of entries) {
    const category = entry.key.split(".")[0];
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(entry);
  }

  return grouped;
}

// Generate TypeScript translation object
function generateTypeScriptTranslations(grouped: Record<string, TranslationEntry[]>): string {
  let output = `// Generated translation keys - Add to lib/i18n/translations.ts\n`;
  output += `// 생성된 번역 키 - lib/i18n/translations.ts에 추가하세요\n\n`;

  for (const [category, entries] of Object.entries(grouped)) {
    output += `// === ${category.toUpperCase()} ===\n`;
    output += `${category}: {\n`;

    // Group by subcategory (file name)
    const bySubcat: Record<string, TranslationEntry[]> = {};
    for (const entry of entries) {
      const parts = entry.key.split(".");
      const subcat = parts[1] || "general";
      if (!bySubcat[subcat]) bySubcat[subcat] = [];
      bySubcat[subcat].push(entry);
    }

    for (const [subcat, subEntries] of Object.entries(bySubcat)) {
      output += `  ${subcat}: {\n`;
      for (const entry of subEntries) {
        const keyPart = entry.key.split(".").slice(2).join("_") || "text";
        output += `    // Source: ${entry.file}:${entry.line}\n`;
        output += `    ${keyPart}: {\n`;
        output += `      ko: "${entry.ko.replace(/"/g, '\\"')}",\n`;
        output += `      en: "${entry.en.replace(/"/g, '\\"')}",\n`;
        output += `    },\n`;
      }
      output += `  },\n`;
    }

    output += `},\n\n`;
  }

  return output;
}

// Generate a simple JSON format for bulk translation services
function generateJsonTranslations(entries: TranslationEntry[]): string {
  const json: Record<string, { en: string; ko: string }> = {};

  for (const entry of entries) {
    json[entry.key] = {
      en: entry.en,
      ko: entry.ko,
    };
  }

  return JSON.stringify(json, null, 2);
}

// Generate CSV for spreadsheet editing
function generateCsvTranslations(entries: TranslationEntry[]): string {
  let csv = "Key,English,Korean,File,Line\n";

  for (const entry of entries) {
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    csv += `${escapeCsv(entry.key)},${escapeCsv(entry.en)},${escapeCsv(entry.ko)},${escapeCsv(entry.file)},${entry.line}\n`;
  }

  return csv;
}

// Main execution
function main() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    console.log("Usage: npx ts-node scripts/i18n/generate-translation-keys.ts <scan-report.json>");
    console.log("\nFirst run the scanner:");
    console.log("  npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output scan-report.json");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  const scanResult: ScanResult = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  const entries = generateTranslationEntries(scanResult);
  const grouped = groupByCategory(entries);

  console.log(`\n📝 Generated ${entries.length} translation entries\n`);

  // Output TypeScript format
  const tsOutput = generateTypeScriptTranslations(grouped);
  const tsPath = "scripts/i18n/output/translations-generated.ts";
  fs.mkdirSync(path.dirname(tsPath), { recursive: true });
  fs.writeFileSync(tsPath, tsOutput);
  console.log(`✅ TypeScript format saved to: ${tsPath}`);

  // Output JSON format
  const jsonOutput = generateJsonTranslations(entries);
  const jsonPath = "scripts/i18n/output/translations-generated.json";
  fs.writeFileSync(jsonPath, jsonOutput);
  console.log(`✅ JSON format saved to: ${jsonPath}`);

  // Output CSV format
  const csvOutput = generateCsvTranslations(entries);
  const csvPath = "scripts/i18n/output/translations-generated.csv";
  fs.writeFileSync(csvPath, csvOutput);
  console.log(`✅ CSV format saved to: ${csvPath}`);

  console.log("\n📋 Categories found:");
  for (const [cat, ents] of Object.entries(grouped)) {
    console.log(`   ${cat}: ${ents.length} entries`);
  }
}

main();

export { generateTranslationEntries, generateTypeScriptTranslations };

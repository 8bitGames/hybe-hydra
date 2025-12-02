#!/usr/bin/env npx ts-node
/**
 * i18n Scanner - Find hardcoded strings in TSX/TS files
 * i18n 스캐너 - TSX/TS 파일에서 하드코딩된 문자열 찾기
 *
 * Usage:
 *   npx ts-node scripts/i18n/scan-hardcoded-strings.ts
 *   npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output report.json
 */

import * as fs from "fs";
import * as path from "path";

interface HardcodedString {
  file: string;
  line: number;
  text: string;
  context: string;
  type: "jsx-text" | "attribute" | "template" | "korean";
  suggestedKey: string;
}

interface ScanResult {
  totalFiles: number;
  filesWithHardcoded: number;
  totalStrings: number;
  byFile: Record<string, HardcodedString[]>;
  byType: Record<string, number>;
  topFiles: { file: string; count: number }[];
}

// Patterns to detect hardcoded strings
const patterns = {
  // JSX text content: >Some text<
  jsxText: />([A-Z][a-z]+(?:\s+[a-zA-Z]+)*)</g,
  // English sentences in JSX
  jsxEnglish: />\s*([A-Z][a-z]+(?:\s+[a-z]+)+[.!?]?)\s*</g,
  // Korean text
  korean: /[\uAC00-\uD7AF]+/g,
  // Placeholder attributes
  placeholder: /placeholder=["']([^"']+)["']/g,
  // Title attributes
  title: /title=["']([^"']+)["']/g,
  // aria-label
  ariaLabel: /aria-label=["']([^"']+)["']/g,
  // Template literals with text
  templateLiteral: /`([^`]*[A-Za-z]{3,}[^`]*)`/g,
};

// Patterns to ignore (already translated or not user-facing)
const ignorePatterns = [
  /useI18n/,
  /useT/,
  /\bt\./,
  /pick\(/,
  /BilingualLabel/,
  /console\./,
  /import\s/,
  /from\s+["']/,
  /className=/,
  /cn\(/,
  /\.tsx?["']/,
  /["']use client["']/,
  /["']use server["']/,
  /https?:\/\//,
  /localhost/,
  /api\/v1/,
  /\.(png|jpg|svg|ico|mp4|mp3)/,
];

// Directories to scan
const scanDirs = [
  "app/(dashboard)",
  "components",
];

// File extensions to scan
const extensions = [".tsx", ".ts"];

function shouldIgnoreLine(line: string): boolean {
  return ignorePatterns.some((pattern) => pattern.test(line));
}

function generateSuggestedKey(file: string, text: string): string {
  // Extract component/page name from file path
  const parts = file.split("/");
  const fileName = parts[parts.length - 1].replace(/\.(tsx?|jsx?)$/, "");

  // Convert text to key format
  const textKey = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");

  // Determine category from path
  let category = "common";
  if (file.includes("/campaigns/")) category = "campaigns";
  else if (file.includes("/create/")) category = "create";
  else if (file.includes("/videos/")) category = "videos";
  else if (file.includes("/publishing/")) category = "publishing";
  else if (file.includes("/insights/")) category = "insights";
  else if (file.includes("/settings/")) category = "settings";
  else if (file.includes("components/")) category = "components";

  return `${category}.${fileName}.${textKey}`;
}

function extractHardcodedStrings(filePath: string, content: string): HardcodedString[] {
  const strings: HardcodedString[] = [];
  const lines = content.split("\n");

  lines.forEach((line, lineIndex) => {
    if (shouldIgnoreLine(line)) return;

    // Check for Korean text
    const koreanMatches = line.match(patterns.korean);
    if (koreanMatches) {
      koreanMatches.forEach((match) => {
        if (match.length >= 2) {
          strings.push({
            file: filePath,
            line: lineIndex + 1,
            text: match,
            context: line.trim().substring(0, 100),
            type: "korean",
            suggestedKey: generateSuggestedKey(filePath, match),
          });
        }
      });
    }

    // Check for JSX text
    const jsxMatches = [...line.matchAll(patterns.jsxText), ...line.matchAll(patterns.jsxEnglish)];
    jsxMatches.forEach((match) => {
      const text = match[1]?.trim();
      if (text && text.length >= 3 && !/^[A-Z][a-z]*$/.test(text)) {
        // Ignore single capitalized words (likely component names)
        strings.push({
          file: filePath,
          line: lineIndex + 1,
          text,
          context: line.trim().substring(0, 100),
          type: "jsx-text",
          suggestedKey: generateSuggestedKey(filePath, text),
        });
      }
    });

    // Check for placeholder/title/aria-label attributes
    [patterns.placeholder, patterns.title, patterns.ariaLabel].forEach((pattern) => {
      const matches = [...line.matchAll(pattern)];
      matches.forEach((match) => {
        const text = match[1]?.trim();
        if (text && text.length >= 3) {
          strings.push({
            file: filePath,
            line: lineIndex + 1,
            text,
            context: line.trim().substring(0, 100),
            type: "attribute",
            suggestedKey: generateSuggestedKey(filePath, text),
          });
        }
      });
    });
  });

  return strings;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const fullPath = path.join(process.cwd(), dir);

  if (!fs.existsSync(fullPath)) {
    console.warn(`Directory not found: ${fullPath}`);
    return fileList;
  }

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

function runScan(): ScanResult {
  const result: ScanResult = {
    totalFiles: 0,
    filesWithHardcoded: 0,
    totalStrings: 0,
    byFile: {},
    byType: {
      "jsx-text": 0,
      "attribute": 0,
      "template": 0,
      "korean": 0,
    },
    topFiles: [],
  };

  const allFiles: string[] = [];
  scanDirs.forEach((dir) => getAllFiles(dir, allFiles));

  result.totalFiles = allFiles.length;

  allFiles.forEach((file) => {
    const fullPath = path.join(process.cwd(), file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const strings = extractHardcodedStrings(file, content);

    if (strings.length > 0) {
      result.filesWithHardcoded++;
      result.byFile[file] = strings;
      result.totalStrings += strings.length;

      strings.forEach((s) => {
        result.byType[s.type] = (result.byType[s.type] || 0) + 1;
      });
    }
  });

  // Calculate top files
  result.topFiles = Object.entries(result.byFile)
    .map(([file, strings]) => ({ file, count: strings.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return result;
}

function printReport(result: ScanResult): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 i18n HARDCODED STRING SCAN REPORT");
  console.log("=".repeat(60));

  console.log("\n📈 SUMMARY:");
  console.log(`   Total files scanned: ${result.totalFiles}`);
  console.log(`   Files with hardcoded strings: ${result.filesWithHardcoded}`);
  console.log(`   Total hardcoded strings found: ${result.totalStrings}`);

  console.log("\n📋 BY TYPE:");
  Object.entries(result.byType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  console.log("\n🔝 TOP 20 FILES WITH MOST HARDCODED STRINGS:");
  result.topFiles.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.file} (${item.count} strings)`);
  });

  console.log("\n📝 SAMPLE STRINGS (first 20):");
  let count = 0;
  for (const [file, strings] of Object.entries(result.byFile)) {
    for (const str of strings) {
      if (count >= 20) break;
      console.log(`   [${str.type}] "${str.text.substring(0, 50)}..."`);
      console.log(`      File: ${str.file}:${str.line}`);
      console.log(`      Key:  ${str.suggestedKey}`);
      count++;
    }
    if (count >= 20) break;
  }

  console.log("\n" + "=".repeat(60));
}

// Main execution
const result = runScan();
printReport(result);

// Output to file if requested
const outputArg = process.argv.indexOf("--output");
if (outputArg !== -1 && process.argv[outputArg + 1]) {
  const outputPath = process.argv[outputArg + 1];
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ Full report saved to: ${outputPath}`);
}

export { runScan };
export type { ScanResult, HardcodedString };

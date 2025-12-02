#!/usr/bin/env npx ts-node
/**
 * i18n Coverage Report
 * i18n 커버리지 리포트
 *
 * Analyzes the codebase to determine translation coverage.
 *
 * Usage:
 *   npx ts-node scripts/i18n/coverage-report.ts
 *   npx ts-node scripts/i18n/coverage-report.ts --json
 */

import * as fs from "fs";
import * as path from "path";

interface FileAnalysis {
  file: string;
  totalStrings: number;
  translatedStrings: number;
  hardcodedStrings: number;
  coveragePercent: number;
  usesI18n: boolean;
  issues: string[];
}

interface CoverageReport {
  summary: {
    totalFiles: number;
    filesUsingI18n: number;
    totalStrings: number;
    translatedStrings: number;
    hardcodedStrings: number;
    overallCoverage: number;
  };
  byDirectory: Record<string, { files: number; coverage: number }>;
  fileDetails: FileAnalysis[];
  recommendations: string[];
}

// Patterns indicating i18n usage
const i18nPatterns = [
  /useI18n\(\)/,
  /useT\(\)/,
  /<T\s/,
  /<TBlock/,
  /<THeading/,
  /<TText/,
  /<TLabel/,
  /BilingualLabel/,
  /\bt\./,
  /translate\(/,
  /\.pick\(/,
  /\.format\(/,
];

// Patterns indicating hardcoded strings
const hardcodedPatterns = [
  // JSX text content (English sentences)
  />([A-Z][a-z]+(?:\s+[a-z]+){2,})</g,
  // Korean text
  /[\uAC00-\uD7AF]{2,}/g,
  // String attributes that should be translated
  /(?:placeholder|title|aria-label)=["']([^"']{3,})["']/g,
];

// Patterns to ignore
const ignorePatterns = [
  /console\./,
  /import\s/,
  /from\s+["']/,
  /className=/,
  /https?:\/\//,
  /localhost/,
  /api\/v1/,
  /\.(png|jpg|svg|ico|mp4|mp3)/,
  /["']use client["']/,
  /["']use server["']/,
];

// Directories to analyze
const scanDirs = ["app/(dashboard)", "components"];

// File extensions
const extensions = [".tsx", ".ts"];

function shouldIgnoreLine(line: string): boolean {
  return ignorePatterns.some((pattern) => pattern.test(line));
}

function analyzeFile(filePath: string): FileAnalysis {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const relativePath = filePath.replace(process.cwd() + "/", "");

  const analysis: FileAnalysis = {
    file: relativePath,
    totalStrings: 0,
    translatedStrings: 0,
    hardcodedStrings: 0,
    coveragePercent: 0,
    usesI18n: false,
    issues: [],
  };

  // Check if file uses i18n
  analysis.usesI18n = i18nPatterns.some((pattern) => pattern.test(content));

  // Count i18n usage
  i18nPatterns.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      analysis.translatedStrings += matches.length;
    }
  });

  // Count hardcoded strings
  lines.forEach((line, lineIndex) => {
    if (shouldIgnoreLine(line)) return;

    hardcodedPatterns.forEach((pattern) => {
      // Reset regex
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        analysis.hardcodedStrings++;
        if (analysis.issues.length < 5) {
          const text = match[1] || match[0];
          analysis.issues.push(`Line ${lineIndex + 1}: "${text.substring(0, 40)}..."`);
        }
      }
    });
  });

  analysis.totalStrings = analysis.translatedStrings + analysis.hardcodedStrings;
  analysis.coveragePercent =
    analysis.totalStrings > 0
      ? Math.round((analysis.translatedStrings / analysis.totalStrings) * 100)
      : 100;

  return analysis;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const fullPath = path.join(process.cwd(), dir);

  if (!fs.existsSync(fullPath)) {
    return fileList;
  }

  const files = fs.readdirSync(fullPath);

  files.forEach((file) => {
    const filePath = path.join(fullPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(path.join(dir, file), fileList);
    } else if (extensions.some((ext) => file.endsWith(ext))) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function generateReport(): CoverageReport {
  const report: CoverageReport = {
    summary: {
      totalFiles: 0,
      filesUsingI18n: 0,
      totalStrings: 0,
      translatedStrings: 0,
      hardcodedStrings: 0,
      overallCoverage: 0,
    },
    byDirectory: {},
    fileDetails: [],
    recommendations: [],
  };

  const allFiles: string[] = [];
  scanDirs.forEach((dir) => getAllFiles(dir, allFiles));

  report.summary.totalFiles = allFiles.length;

  // Analyze each file
  allFiles.forEach((filePath) => {
    const analysis = analyzeFile(filePath);
    report.fileDetails.push(analysis);

    if (analysis.usesI18n) {
      report.summary.filesUsingI18n++;
    }
    report.summary.totalStrings += analysis.totalStrings;
    report.summary.translatedStrings += analysis.translatedStrings;
    report.summary.hardcodedStrings += analysis.hardcodedStrings;

    // Track by directory
    const dir = path.dirname(analysis.file);
    if (!report.byDirectory[dir]) {
      report.byDirectory[dir] = { files: 0, coverage: 0 };
    }
    report.byDirectory[dir].files++;
    report.byDirectory[dir].coverage += analysis.coveragePercent;
  });

  // Calculate averages for directories
  Object.keys(report.byDirectory).forEach((dir) => {
    report.byDirectory[dir].coverage = Math.round(
      report.byDirectory[dir].coverage / report.byDirectory[dir].files
    );
  });

  // Calculate overall coverage
  report.summary.overallCoverage =
    report.summary.totalStrings > 0
      ? Math.round((report.summary.translatedStrings / report.summary.totalStrings) * 100)
      : 100;

  // Generate recommendations
  const lowCoverageFiles = report.fileDetails
    .filter((f) => f.coveragePercent < 50 && f.totalStrings > 0)
    .sort((a, b) => a.coveragePercent - b.coveragePercent);

  if (lowCoverageFiles.length > 0) {
    report.recommendations.push(
      `Focus on ${lowCoverageFiles.length} files with low coverage (<50%)`
    );
    report.recommendations.push(
      `Highest priority: ${lowCoverageFiles[0].file} (${lowCoverageFiles[0].coveragePercent}%)`
    );
  }

  const noI18nFiles = report.fileDetails.filter((f) => !f.usesI18n && f.hardcodedStrings > 0);
  if (noI18nFiles.length > 0) {
    report.recommendations.push(
      `${noI18nFiles.length} files don't use i18n system at all`
    );
  }

  if (report.summary.overallCoverage < 80) {
    report.recommendations.push(
      `Overall coverage is ${report.summary.overallCoverage}%. Target is 80%+`
    );
  }

  return report;
}

function printReport(report: CoverageReport): void {
  console.log("\n" + "=".repeat(70));
  console.log("📊 i18n COVERAGE REPORT");
  console.log("=".repeat(70));

  console.log("\n📈 SUMMARY:");
  console.log(`   Total files scanned: ${report.summary.totalFiles}`);
  console.log(`   Files using i18n: ${report.summary.filesUsingI18n}`);
  console.log(`   Total string instances: ${report.summary.totalStrings}`);
  console.log(`   Translated: ${report.summary.translatedStrings}`);
  console.log(`   Hardcoded: ${report.summary.hardcodedStrings}`);
  console.log(
    `   Overall coverage: ${report.summary.overallCoverage}% ${getCoverageEmoji(report.summary.overallCoverage)}`
  );

  console.log("\n📁 BY DIRECTORY:");
  const sortedDirs = Object.entries(report.byDirectory)
    .sort((a, b) => a[1].coverage - b[1].coverage)
    .slice(0, 15);

  sortedDirs.forEach(([dir, data]) => {
    const bar = getProgressBar(data.coverage);
    console.log(`   ${bar} ${data.coverage}% - ${dir} (${data.files} files)`);
  });

  console.log("\n⚠️  FILES NEEDING ATTENTION (lowest coverage):");
  const lowCoverage = report.fileDetails
    .filter((f) => f.totalStrings > 0)
    .sort((a, b) => a.coveragePercent - b.coveragePercent)
    .slice(0, 10);

  lowCoverage.forEach((file) => {
    console.log(`   ${file.coveragePercent}% - ${file.file}`);
    if (file.issues.length > 0) {
      console.log(`      Issues: ${file.issues[0]}`);
    }
  });

  if (report.recommendations.length > 0) {
    console.log("\n💡 RECOMMENDATIONS:");
    report.recommendations.forEach((rec) => {
      console.log(`   • ${rec}`);
    });
  }

  console.log("\n" + "=".repeat(70));
}

function getCoverageEmoji(coverage: number): string {
  if (coverage >= 90) return "🟢";
  if (coverage >= 70) return "🟡";
  if (coverage >= 50) return "🟠";
  return "🔴";
}

function getProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

// Main execution
const report = generateReport();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);

  // Save full report
  const outputPath = "scripts/i18n/output/coverage-report.json";
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: ${outputPath}`);
}

export { generateReport };
export type { CoverageReport };

/**
 * TikTok Trend Collection Script
 *
 * Usage:
 *   npx tsx scripts/collect-trends.ts [options]
 *
 * Options:
 *   --keywords=kpop,dance     Comma-separated keywords to search
 *   --hashtags=fyp,viral      Comma-separated hashtags to scrape
 *   --no-explore              Skip explore page scraping
 *   --region=KR               Region code (default: KR)
 *   --dry-run                 Don't save to database, just show results
 *   --help                    Show this help message
 *
 * Examples:
 *   npx tsx scripts/collect-trends.ts
 *   npx tsx scripts/collect-trends.ts --keywords=kpop,blackpink
 *   npx tsx scripts/collect-trends.ts --hashtags=fyp,viral,trending --no-explore
 *   npx tsx scripts/collect-trends.ts --dry-run
 */

import { TrendPlatform, Prisma } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import {
  collectTikTokTrends,
  closeBrowser,
  getKpopTrends,
} from "../lib/tiktok-trends";

interface ScriptOptions {
  keywords: string[];
  hashtags: string[];
  includeExplore: boolean;
  region: string;
  dryRun: boolean;
  kpop: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    keywords: [],
    hashtags: [],
    includeExplore: true,
    region: "KR",
    dryRun: false,
    kpop: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      console.log(`
TikTok Trend Collection Script

Usage:
  npx tsx scripts/collect-trends.ts [options]

Options:
  --keywords=kpop,dance     Comma-separated keywords to search
  --hashtags=fyp,viral      Comma-separated hashtags to scrape
  --no-explore              Skip explore page scraping
  --region=KR               Region code (default: KR)
  --dry-run                 Don't save to database, just show results
  --kpop                    Use K-pop preset keywords/hashtags
  --help                    Show this help message

Examples:
  npx tsx scripts/collect-trends.ts
  npx tsx scripts/collect-trends.ts --keywords=kpop,blackpink
  npx tsx scripts/collect-trends.ts --hashtags=fyp,viral,trending
  npx tsx scripts/collect-trends.ts --kpop
  npx tsx scripts/collect-trends.ts --dry-run
`);
      process.exit(0);
    }

    if (arg.startsWith("--keywords=")) {
      options.keywords = arg.replace("--keywords=", "").split(",").filter(Boolean);
    } else if (arg.startsWith("--hashtags=")) {
      options.hashtags = arg.replace("--hashtags=", "").split(",").filter(Boolean);
    } else if (arg === "--no-explore") {
      options.includeExplore = false;
    } else if (arg.startsWith("--region=")) {
      options.region = arg.replace("--region=", "");
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--kpop") {
      options.kpop = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("=".repeat(60));
  console.log("TikTok Trend Collection Script");
  console.log("=".repeat(60));
  console.log("Options:", JSON.stringify(options, null, 2));
  console.log("=".repeat(60));

  try {
    let result;

    if (options.kpop) {
      console.log("\n[INFO] Using K-pop preset...\n");
      result = await getKpopTrends();
    } else {
      console.log("\n[INFO] Starting trend collection...\n");
      result = await collectTikTokTrends({
        keywords: options.keywords,
        hashtags: options.hashtags,
        includeExplore: options.includeExplore,
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("Collection Results");
    console.log("=".repeat(60));
    console.log(`Success: ${result.success}`);
    console.log(`Method: ${result.method}`);
    console.log(`Total Trends: ${result.trends.length}`);
    console.log(`Collected At: ${result.collectedAt.toISOString()}`);

    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    // Display trends
    console.log("\n" + "-".repeat(60));
    console.log("Collected Trends:");
    console.log("-".repeat(60));

    result.trends.slice(0, 30).forEach((trend) => {
      const viewStr = trend.viewCount
        ? ` | Views: ${formatNumber(trend.viewCount)}`
        : "";
      const videoStr = trend.videoCount ? ` | Videos: ${trend.videoCount}` : "";
      console.log(
        `#${trend.rank.toString().padStart(2, "0")} ${trend.keyword}${viewStr}${videoStr}`
      );
    });

    if (result.trends.length > 30) {
      console.log(`... and ${result.trends.length - 30} more`);
    }

    // Save to database
    if (!options.dryRun && result.trends.length > 0) {
      console.log("\n" + "-".repeat(60));
      console.log("Saving to database...");
      console.log("-".repeat(60));

      const trendData = result.trends.map((trend) => ({
        platform: "TIKTOK" as TrendPlatform,
        keyword: trend.keyword,
        rank: trend.rank,
        region: options.region,
        viewCount: trend.viewCount ? BigInt(Math.floor(trend.viewCount)) : null,
        videoCount: trend.videoCount || null,
        description: trend.description || null,
        hashtags: trend.hashtag ? [trend.hashtag] : [],
        metadata: trend.metadata ? (trend.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        trendUrl: trend.trendUrl || null,
        thumbnailUrl: trend.thumbnailUrl || null,
      }));

      const created = await prisma.trendSnapshot.createMany({
        data: trendData,
        skipDuplicates: true,
      });

      console.log(`Saved ${created.count} trends to database`);
    } else if (options.dryRun) {
      console.log("\n[DRY-RUN] Skipping database save");
    }

    console.log("\n" + "=".repeat(60));
    console.log("Done!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n[ERROR] Collection failed:", error);
    process.exit(1);
  } finally {
    // Cleanup
    await closeBrowser();
    await prisma.$disconnect();
  }
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

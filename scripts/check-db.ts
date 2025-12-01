import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  try {
    console.log("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");

    // Check campaigns
    const campaigns = await prisma.campaign.findMany();
    console.log(`\n📁 Campaigns: ${campaigns.length}`);
    campaigns.forEach(c => console.log(`  - ${c.name} (${c.id})`));

    // Check assets for the specific campaign
    const assets = await prisma.asset.findMany({
      where: { campaignId: "campaign-carly-hummingbird-tour" }
    });
    console.log(`\n🖼️ Assets for campaign-carly-hummingbird-tour: ${assets.length}`);
    assets.forEach(a => console.log(`  - [${a.type}] ${a.filename}`));

    // Check all assets
    const allAssets = await prisma.asset.findMany();
    console.log(`\n📦 Total assets in DB: ${allAssets.length}`);

    // Check video generations
    const videos = await prisma.videoGeneration.findMany();
    console.log(`\n🎬 Total video generations: ${videos.length}`);

    // Check by campaign
    const videosByCampaign = await prisma.videoGeneration.groupBy({
      by: ['campaignId'],
      _count: true
    });
    console.log("\nVideos by campaign:");
    videosByCampaign.forEach(v => console.log(`  - ${v.campaignId}: ${v._count}`));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

check();

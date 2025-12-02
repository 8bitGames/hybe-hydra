const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

async function main() {
  const prisma = new PrismaClient();

  try {
    const gens = await prisma.videoGeneration.findMany({
      where: { campaignId: "campaign-carly-hummingbird-tour" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        errorMessage: true,
        composedOutputUrl: true,
        audioAssetId: true,
        createdAt: true,
        audioAsset: {
          select: {
            originalFilename: true,
            s3Url: true,
          },
        },
      },
    });

    console.log("Recent generations:");
    gens.forEach((g, i) => {
      console.log(`\n${i + 1}. ${g.id}`);
      console.log(`   Status: ${g.status}`);
      console.log(`   Composed URL: ${g.composedOutputUrl ? "Yes" : "No"}`);
      console.log(`   Error: ${g.errorMessage || "None"}`);
      console.log(`   Audio: ${g.audioAsset?.originalFilename || "None"}`);
      console.log(`   Created: ${g.createdAt}`);
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

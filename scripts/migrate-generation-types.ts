/**
 * Migration script: Set generationType based on existing data
 * - Records with composed_output_url → COMPOSE
 * - Records without composed_output_url → AI (default)
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrateGenerationTypes() {
  console.log("Starting generation type migration...");

  // Update records with composed_output_url to COMPOSE type
  const composeResult = await prisma.videoGeneration.updateMany({
    where: {
      composedOutputUrl: { not: null },
    },
    data: {
      generationType: "COMPOSE",
    },
  });

  console.log(`Updated ${composeResult.count} records to COMPOSE type`);

  // Verify counts
  const aiCount = await prisma.videoGeneration.count({
    where: { generationType: "AI" },
  });
  const composeCount = await prisma.videoGeneration.count({
    where: { generationType: "COMPOSE" },
  });

  console.log(`\nFinal counts:`);
  console.log(`  AI generations: ${aiCount}`);
  console.log(`  Compose generations: ${composeCount}`);
  console.log(`  Total: ${aiCount + composeCount}`);

  console.log("\nMigration completed!");
}

migrateGenerationTypes()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

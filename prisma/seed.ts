import { PrismaClient, UserRole } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seed...");

  // Create labels
  const labels = await Promise.all([
    prisma.label.upsert({
      where: { code: "BIGHIT" },
      update: {},
      create: {
        name: "BIGHIT MUSIC",
        code: "BIGHIT",
      },
    }),
    prisma.label.upsert({
      where: { code: "BELIFT" },
      update: {},
      create: {
        name: "BELIFT LAB",
        code: "BELIFT",
      },
    }),
    prisma.label.upsert({
      where: { code: "SOURCE" },
      update: {},
      create: {
        name: "SOURCE MUSIC",
        code: "SOURCE",
      },
    }),
    prisma.label.upsert({
      where: { code: "PLEDIS" },
      update: {},
      create: {
        name: "PLEDIS Entertainment",
        code: "PLEDIS",
      },
    }),
    prisma.label.upsert({
      where: { code: "KOZ" },
      update: {},
      create: {
        name: "KOZ Entertainment",
        code: "KOZ",
      },
    }),
    prisma.label.upsert({
      where: { code: "ADOR" },
      update: {},
      create: {
        name: "ADOR",
        code: "ADOR",
      },
    }),
  ]);

  console.log(`✅ Created ${labels.length} labels`);

  // Create artists
  const artists = await Promise.all([
    prisma.artist.upsert({
      where: { id: "bts" },
      update: {},
      create: {
        id: "bts",
        name: "방탄소년단",
        stageName: "BTS",
        groupName: "BTS",
        labelId: labels[0].id,
        profileDescription: "Global K-pop phenomenon",
      },
    }),
    prisma.artist.upsert({
      where: { id: "txt" },
      update: {},
      create: {
        id: "txt",
        name: "투모로우바이투게더",
        stageName: "TXT",
        groupName: "TOMORROW X TOGETHER",
        labelId: labels[0].id,
        profileDescription: "4th generation K-pop leaders",
      },
    }),
    prisma.artist.upsert({
      where: { id: "enhypen" },
      update: {},
      create: {
        id: "enhypen",
        name: "엔하이픈",
        stageName: "ENHYPEN",
        groupName: "ENHYPEN",
        labelId: labels[1].id,
        profileDescription: "I-LAND born global group",
      },
    }),
    prisma.artist.upsert({
      where: { id: "lesserafim" },
      update: {},
      create: {
        id: "lesserafim",
        name: "르세라핌",
        stageName: "LE SSERAFIM",
        groupName: "LE SSERAFIM",
        labelId: labels[2].id,
        profileDescription: "Fearless K-pop girl group",
      },
    }),
    prisma.artist.upsert({
      where: { id: "seventeen" },
      update: {},
      create: {
        id: "seventeen",
        name: "세븐틴",
        stageName: "SEVENTEEN",
        groupName: "SEVENTEEN",
        labelId: labels[3].id,
        profileDescription: "Self-producing K-pop group",
      },
    }),
    prisma.artist.upsert({
      where: { id: "newjeans" },
      update: {},
      create: {
        id: "newjeans",
        name: "뉴진스",
        stageName: "NewJeans",
        groupName: "NewJeans",
        labelId: labels[5].id,
        profileDescription: "Y2K inspired K-pop girl group",
      },
    }),
  ]);

  console.log(`✅ Created ${artists.length} artists`);

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@hybe.com" },
    update: {},
    create: {
      email: "admin@hybe.com",
      name: "HYDRA Admin",
      hashedPassword,
      role: UserRole.ADMIN,
      labelIds: labels.map((l) => l.id),
      isActive: true,
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);

  // Create producer user
  const producerPassword = await bcrypt.hash("producer123", 10);
  const producerUser = await prisma.user.upsert({
    where: { email: "producer@hybe.com" },
    update: {},
    create: {
      email: "producer@hybe.com",
      name: "Content Producer",
      hashedPassword: producerPassword,
      role: UserRole.PRODUCER,
      labelIds: [labels[0].id, labels[1].id], // BIGHIT and BELIFT
      isActive: true,
    },
  });

  console.log(`✅ Created producer user: ${producerUser.email}`);

  // Create sample campaigns
  const campaigns = await Promise.all([
    prisma.campaign.upsert({
      where: { id: "campaign-bts-world-tour" },
      update: {},
      create: {
        id: "campaign-bts-world-tour",
        name: "BTS World Tour 2025 Promo",
        description: "Video content for world tour promotion",
        artistId: artists[0].id,
        status: "ACTIVE",
        targetCountries: ["KR", "US", "JP", "GB", "DE"],
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-06-30"),
        createdBy: adminUser.id,
      },
    }),
    prisma.campaign.upsert({
      where: { id: "campaign-txt-album" },
      update: {},
      create: {
        id: "campaign-txt-album",
        name: "TXT New Album Teaser",
        description: "Concept videos for new album release",
        artistId: artists[1].id,
        status: "DRAFT",
        targetCountries: ["KR", "US", "JP"],
        createdBy: adminUser.id,
      },
    }),
    prisma.campaign.upsert({
      where: { id: "campaign-lesserafim-collab" },
      update: {},
      create: {
        id: "campaign-lesserafim-collab",
        name: "LE SSERAFIM Brand Collaboration",
        description: "Fashion brand partnership content",
        artistId: artists[3].id,
        status: "ACTIVE",
        targetCountries: ["KR", "US", "FR", "IT"],
        startDate: new Date("2025-02-01"),
        endDate: new Date("2025-04-30"),
        createdBy: producerUser.id,
      },
    }),
  ]);

  console.log(`✅ Created ${campaigns.length} sample campaigns`);

  console.log("\n🎉 Database seeding completed!");
  console.log("\n📋 Test Accounts:");
  console.log("  Admin: admin@hybe.com / admin123");
  console.log("  Producer: producer@hybe.com / producer123");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

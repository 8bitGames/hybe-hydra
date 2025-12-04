import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  try {
    console.log("=== 발행 페이지 데이터 확인 ===\n");

    // Check ScheduledPost
    const scheduledPosts = await prisma.scheduledPost.count();
    console.log(`📤 ScheduledPost (발행 예약): ${scheduledPosts}개`);

    if (scheduledPosts > 0) {
      const posts = await prisma.scheduledPost.findMany({
        take: 5,
        include: {
          socialAccount: true,
          campaign: { select: { name: true } }
        }
      });
      console.log("\n샘플 ScheduledPost:");
      posts.forEach(p => console.log(`  - ${p.status} | ${p.campaign?.name} | ${p.socialAccount?.accountName}`));
    }

    // Check VideoGeneration
    const videoGenerations = await prisma.videoGeneration.count();
    const completedVideos = await prisma.videoGeneration.count({ where: { status: "COMPLETED" } });
    console.log(`\n🎬 VideoGeneration: ${videoGenerations}개 (완료: ${completedVideos}개)`);

    // Check SocialAccount
    const socialAccounts = await prisma.socialAccount.count();
    console.log(`\n👤 SocialAccount (연결된 계정): ${socialAccounts}개`);

    if (socialAccounts > 0) {
      const accounts = await prisma.socialAccount.findMany({ take: 5 });
      console.log("샘플 SocialAccount:");
      accounts.forEach(a => console.log(`  - ${a.platform} | ${a.accountName}`));
    }

    // Summary
    console.log("\n=== 결론 ===");
    if (scheduledPosts === 0) {
      console.log("⚠️  ScheduledPost 테이블에 데이터가 없습니다!");
      console.log("→ 발행 페이지는 ScheduledPost만 표시합니다.");
      console.log("→ VideoGeneration을 발행하려면 캠페인 > 발행 탭에서 예약해야 합니다.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

check();

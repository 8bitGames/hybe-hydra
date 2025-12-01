import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const videos = await prisma.videoGeneration.findMany({
    select: {
      id: true,
      outputUrl: true,
      composedOutputUrl: true,
      status: true
    }
  });

  console.log('All videos with URLs:');
  videos.forEach(v => {
    console.log('---');
    console.log('ID:', v.id);
    console.log('Status:', v.status);
    console.log('outputUrl:', v.outputUrl);
    console.log('composedOutputUrl:', v.composedOutputUrl);
  });

  const composed = videos.filter(v => v.composedOutputUrl);
  console.log('\n=== COMPOSED VIDEOS:', composed.length);
}

main().catch(console.error).finally(() => {
  prisma.$disconnect();
  pool.end();
});

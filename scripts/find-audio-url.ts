import { prisma } from "../lib/db/prisma";

async function main() {
  try {
    const generation = await prisma.generation.findFirst({
      where: {
        audioUrl: { not: null },
        NOT: { audioUrl: '' }
      },
      select: {
        id: true,
        audioUrl: true,
        campaignId: true
      }
    });

    console.log(JSON.stringify(generation, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

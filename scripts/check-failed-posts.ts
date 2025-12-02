import { prisma } from '../lib/db/prisma';

async function main() {
  const action = process.argv[2];

  if (action === 'reset') {
    // Reset failed post to SCHEDULED
    const postId = process.argv[3] || 'e09c0d60-71bf-433c-a7cf-10fa4846ebf8';
    const updated = await prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        status: 'SCHEDULED',
        errorMessage: null,
        retryCount: 0,
        scheduledAt: new Date(), // Schedule for now
      },
    });
    console.log('Reset post to SCHEDULED:', updated.id);
  } else {
    // List posts
    const posts = await prisma.scheduledPost.findMany({
      where: { status: { in: ['FAILED', 'SCHEDULED', 'PUBLISHING'] } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        errorMessage: true,
        scheduledAt: true,
        updatedAt: true,
        generation: {
          select: {
            outputUrl: true,
            composedOutputUrl: true,
          }
        }
      }
    });

    console.log('=== Failed/Scheduled Posts ===');
    for (const post of posts) {
      console.log('\n--- Post:', post.id, '---');
      console.log('Status:', post.status);
      console.log('Scheduled At:', post.scheduledAt);
      console.log('Updated At:', post.updatedAt);
      console.log('Error:', post.errorMessage);
      console.log('Video URL:', post.generation?.composedOutputUrl || post.generation?.outputUrl);
    }
  }

  await prisma.$disconnect();
}

main();

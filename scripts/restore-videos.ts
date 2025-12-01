import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Use DIRECT_URL to bypass PgBouncer issues
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const assets = [
  {
    id: '98ac2967-d873-4192-877f-6fbcc6b759f7',
    campaignId: 'campaign-carly-hummingbird-tour',
    type: 'IMAGE' as const,
    filename: '606d69f1-bdbf-4f0b-a128-bb80bbf4fc15.webp',
    originalFilename: 'CP-photo-the-29-black-tour-tee-front_Carly-Pearce.webp',
    s3Url: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/606d69f1-bdbf-4f0b-a128-bb80bbf4fc15.webp',
    s3Key: 'campaigns/campaign-carly-hummingbird-tour/606d69f1-bdbf-4f0b-a128-bb80bbf4fc15.webp',
    fileSize: 52070,
    mimeType: 'image/webp',
  },
  {
    id: '060fb41c-8e40-43c0-b3cb-02373867db6c',
    campaignId: 'campaign-carly-hummingbird-tour',
    type: 'IMAGE' as const,
    filename: '53d6e1e7-7e45-428e-a7a5-d3b10a0a3572.webp',
    originalFilename: 'CP-TRUCK-ON-FIRE-TEE-FRONT.webp',
    s3Url: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/53d6e1e7-7e45-428e-a7a5-d3b10a0a3572.webp',
    s3Key: 'campaigns/campaign-carly-hummingbird-tour/53d6e1e7-7e45-428e-a7a5-d3b10a0a3572.webp',
    fileSize: 77676,
    mimeType: 'image/webp',
  },
  {
    id: 'a1b82ba6-fbb1-47b7-b5bb-cf1618b89797',
    campaignId: 'campaign-carly-hummingbird-tour',
    type: 'IMAGE' as const,
    filename: 'aceafb17-f20d-4b22-bebb-6167f394b086.webp',
    originalFilename: 'CP-HUMMINGBIRD-CREWNECK-SAND.webp',
    s3Url: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/aceafb17-f20d-4b22-bebb-6167f394b086.webp',
    s3Key: 'campaigns/campaign-carly-hummingbird-tour/aceafb17-f20d-4b22-bebb-6167f394b086.webp',
    fileSize: 74414,
    mimeType: 'image/webp',
  },
  {
    id: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
    campaignId: 'campaign-carly-hummingbird-tour',
    type: 'AUDIO' as const,
    filename: 'bfd7a494-ebdc-4c1d-a448-68a75d9e6aaf.mp3',
    originalFilename: 'the way that I have a list of 100 other things.mp3',
    s3Url: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/bfd7a494-ebdc-4c1d-a448-68a75d9e6aaf.mp3',
    s3Key: 'campaigns/campaign-carly-hummingbird-tour/bfd7a494-ebdc-4c1d-a448-68a75d9e6aaf.mp3',
    fileSize: 972360,
    mimeType: 'audio/mpeg',
  },
  {
    id: 'ea9b6123-ac3e-4828-897c-6c974d2f278b',
    campaignId: 'campaign-carly-hummingbird-tour',
    type: 'GOODS' as const,
    filename: '0ec09075-cf26-4dea-83ba-08183feab2ee.webp',
    originalFilename: 'CP-photo-the-29-black-tour-tee-front_Carly-Pearce.webp',
    s3Url: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/0ec09075-cf26-4dea-83ba-08183feab2ee.webp',
    s3Key: 'campaigns/campaign-carly-hummingbird-tour/0ec09075-cf26-4dea-83ba-08183feab2ee.webp',
    fileSize: 52070,
    mimeType: 'image/webp',
  },
];

const completedVideos = [
  {
    id: 'e6ac1fbc-c31e-48ca-8886-9c759c60635f',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Compose video',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    outputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/2fb4e458-8cc1-4f14-8bbf-13adbde743bf.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: '20f332d5-a47c-4513-838d-70da0dbbb211',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Compose video',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    outputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/da11714e-655d-4834-b067-0a553f6039d4.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: '79d263b7-c031-46d6-9e51-978a94589ece',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Compose video',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    outputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/c0ee75e6-cf35-4475-9d8f-51d922bb0f81.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: '3a6b6c91-4a55-4a09-9418-86568805bd9d',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Truck video',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    outputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/43775884-d4d8-4956-b8be-0a7845805b44.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: '0dfca499-ab5b-4726-add8-a90285cd729f',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Country video',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    outputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/4c2bd021-3460-4111-8eeb-a85714479de4.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: '9c90b9d1-0008-4515-bf4c-0a25fd7ab99f',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Truck sunset video',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    outputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/70b82623-97ac-4ade-badc-3f46d49afea8.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: '3472bef4-b38a-4488-8815-7befd7074a8c',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Rustic scene video',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    outputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/72afa814-70c9-429e-8a66-392fc143f86c.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: 'compose-1764493716471',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Compose video generation',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    composedOutputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/compose/renders/compose-1764493716471/output.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: 'compose-1764497159248',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Compose video generation',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    composedOutputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/compose/renders/compose-1764497159248/output.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: 'compose-1764507640204',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Compose video generation',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    composedOutputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/compose/renders/compose-1764507640204/output.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
  {
    id: 'compose-1764509486319',
    campaignId: 'campaign-carly-hummingbird-tour',
    prompt: 'Compose video generation',
    durationSeconds: 15,
    aspectRatio: '9:16',
    status: 'COMPLETED' as const,
    progress: 100,
    composedOutputUrl: 'https://hydra-assets-hybe.s3.ap-northeast-2.amazonaws.com/compose/renders/compose-1764509486319/output.mp4',
    createdById: 'abd58942-1390-47ac-80b6-5938bafb9e0d',
    audioAssetId: 'c2c44da4-4589-429f-9a74-282c58ae7f4f',
  },
];

async function main() {
  const adminUserId = 'abd58942-1390-47ac-80b6-5938bafb9e0d';

  console.log('Restoring assets...');
  for (const asset of assets) {
    try {
      const { campaignId, ...assetData } = asset;
      await prisma.asset.upsert({
        where: { id: asset.id },
        update: assetData,
        create: {
          ...assetData,
          campaign: { connect: { id: campaignId } },
          creator: { connect: { id: adminUserId } },
        },
      });
      console.log(`  ✓ Asset: ${asset.originalFilename}`);
    } catch (e: any) {
      console.log(`  ✗ Asset ${asset.id}: ${e.message?.substring(0, 100)}`);
    }
  }

  console.log('\nRestoring video generations...');
  for (const video of completedVideos) {
    try {
      const { campaignId, createdById, audioAssetId, ...videoData } = video;
      await prisma.videoGeneration.upsert({
        where: { id: video.id },
        update: videoData,
        create: {
          ...videoData,
          campaign: { connect: { id: campaignId } },
          creator: { connect: { id: createdById } },
          audioAsset: audioAssetId ? { connect: { id: audioAssetId } } : undefined,
        },
      });
      console.log(`  ✓ Video: ${video.id}`);
    } catch (e: any) {
      console.log(`  ✗ Video ${video.id}: ${e.message?.substring(0, 100)}`);
    }
  }

  console.log('\nDone!');

  const assetCount = await prisma.asset.count();
  const videoCount = await prisma.videoGeneration.count();
  console.log(`\nTotal: ${assetCount} assets, ${videoCount} videos`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

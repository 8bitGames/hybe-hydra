const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function listVideos() {
  const bucket = process.env.AWS_S3_BUCKET || 'hydra-assets-seoul';
  console.log('Bucket:', bucket);
  console.log('Region:', process.env.AWS_REGION);

  let continuationToken;
  const allVideos = [];
  let totalObjects = 0;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    });

    const response = await s3.send(command);
    totalObjects += response.Contents?.length || 0;

    if (response.Contents) {
      const videos = response.Contents.filter(obj =>
        obj.Key.endsWith('.mp4') ||
        obj.Key.endsWith('.webm') ||
        obj.Key.endsWith('.mov')
      );
      allVideos.push(...videos);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log('\nTotal objects in bucket:', totalObjects);
  console.log('Total videos found:', allVideos.length);
  console.log('\n--- Video List ---');

  allVideos.forEach((v, i) => {
    const sizeMB = (v.Size / (1024 * 1024)).toFixed(2);
    console.log(`${i + 1}. ${v.Key} (${sizeMB} MB) - ${v.LastModified.toISOString()}`);
  });

  // Summary by folder
  console.log('\n--- Summary by Folder ---');
  const folderCounts = {};
  allVideos.forEach(v => {
    const folder = v.Key.split('/').slice(0, 2).join('/');
    folderCounts[folder] = (folderCounts[folder] || 0) + 1;
  });
  Object.entries(folderCounts).forEach(([folder, count]) => {
    console.log(`${folder}: ${count} videos`);
  });
}

listVideos().catch(console.error);

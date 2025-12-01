const { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const region = process.env.AWS_REGION || 'ap-southeast-2';
const bucket = process.env.AWS_S3_BUCKET || 'hydra-assets-hybe';

console.log('Config:', {
  region,
  bucket,
  accessKey: process.env.AWS_ACCESS_KEY_ID?.substring(0, 8) + '...',
});

const client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function main() {
  // Test 1: List objects
  console.log('\n--- Test 1: List objects ---');
  try {
    const listCmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'campaigns/campaign-carly-hummingbird-tour/',
      MaxKeys: 5,
    });
    const listResult = await client.send(listCmd);
    console.log('Found objects:', listResult.KeyCount);
    listResult.Contents?.forEach(obj => console.log('  -', obj.Key));
  } catch (e) {
    console.log('List error:', e.name, e.message);
  }

  // Test 2: Head object (check if specific file exists)
  const testKey = 'campaigns/campaign-carly-hummingbird-tour/2fb4e458-8cc1-4f14-8bbf-13adbde743bf.mp4';
  console.log('\n--- Test 2: Head object ---');
  console.log('Key:', testKey);
  try {
    const headCmd = new HeadObjectCommand({
      Bucket: bucket,
      Key: testKey,
    });
    const headResult = await client.send(headCmd);
    console.log('File exists!');
    console.log('  Size:', Math.round(headResult.ContentLength / 1024), 'KB');
    console.log('  Type:', headResult.ContentType);
  } catch (e) {
    console.log('Head error:', e.name, e.message);
  }

  // Test 3: Generate presigned URL and verify
  console.log('\n--- Test 3: Presigned URL ---');
  try {
    const getCmd = new GetObjectCommand({
      Bucket: bucket,
      Key: testKey,
    });
    const presignedUrl = await getSignedUrl(client, getCmd, { expiresIn: 3600 });
    console.log('Presigned URL:', presignedUrl.substring(0, 100) + '...');

    // Test fetch with presigned URL
    console.log('\n--- Test 4: Fetch with presigned URL ---');
    const response = await fetch(presignedUrl, { method: 'HEAD' });
    console.log('Status:', response.status, response.statusText);
    if (response.ok) {
      console.log('Content-Length:', response.headers.get('content-length'));
      console.log('Content-Type:', response.headers.get('content-type'));
    }
  } catch (e) {
    console.log('Presign error:', e.name, e.message);
  }
}

main().catch(console.error);

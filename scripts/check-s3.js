const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Try both regions
const regions = ['ap-northeast-2', 'ap-southeast-2'];
const bucket = process.env.AWS_S3_BUCKET || 'hydra-assets-hybe';
const prefix = 'campaigns/campaign-carly-hummingbird-tour/';

async function checkBucket(region) {
  console.log(`\n--- Checking region: ${region} ---`);

  const client = new S3Client({
    region: region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 20,
    });

    const response = await client.send(command);
    console.log(`Bucket: ${bucket}`);
    console.log(`Prefix: ${prefix}`);
    console.log(`Objects found: ${response.KeyCount}`);

    if (response.Contents && response.Contents.length > 0) {
      console.log('\nFiles:');
      response.Contents.forEach(obj => {
        console.log(`  - ${obj.Key} (${Math.round(obj.Size / 1024)}KB)`);
      });
    } else {
      console.log('No objects found in this prefix.');
    }

    return true;
  } catch (error) {
    console.log(`Error: ${error.name} - ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('S3 Bucket Check');
  console.log('================');
  console.log(`Bucket: ${bucket}`);
  console.log(`Access Key: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);

  for (const region of regions) {
    await checkBucket(region);
  }
}

main();

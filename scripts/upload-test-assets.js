/**
 * Upload Test Assets to S3
 *
 * Uploads all test images and music files to S3 for standardized testing.
 *
 * Usage:
 *   node scripts/upload-test-assets.js
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const TEST_DATA_DIR = path.join(__dirname, '../backend/compose-engine/test-data');
const TEST_CONFIG_PATH = path.join(TEST_DATA_DIR, 'test-config.json');
const S3_BUCKET = 'hydra-assets-hybe';
const S3_PREFIX = 'test-data/batch-tests';

// AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function uploadFile(localPath, s3Key) {
  try {
    const fileContent = fs.readFileSync(localPath);
    const ext = path.extname(localPath).toLowerCase();

    // Determine content type
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.avif') contentType = 'image/avif';
    else if (ext === '.mp3') contentType = 'audio/mpeg';

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const s3Url = `https://${S3_BUCKET}.s3.ap-southeast-2.amazonaws.com/${s3Key}`;
    log(`  ✓ ${path.basename(localPath)} → ${s3Key}`, 'green');

    return s3Url;
  } catch (error) {
    log(`  ✗ Failed to upload ${path.basename(localPath)}: ${error.message}`, 'red');
    throw error;
  }
}

async function uploadTestAssets() {
  console.log('\n' + '='.repeat(80));
  log('UPLOADING TEST ASSETS TO S3', 'cyan');
  console.log('='.repeat(80));

  // Load test config
  if (!fs.existsSync(TEST_CONFIG_PATH)) {
    log(`Test config not found: ${TEST_CONFIG_PATH}`, 'red');
    process.exit(1);
  }

  const testConfig = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));

  // Collect all unique files
  const allImages = new Set();
  const allMusic = new Set();

  testConfig.testCases.forEach(tc => {
    tc.images.forEach(img => allImages.add(img));
    allMusic.add(tc.music);
  });

  log(`\nFound ${allImages.size} unique images and ${allMusic.size} unique music files`, 'cyan');

  // Upload images
  log('\nUploading images...', 'blue');
  const uploadedImages = {};
  for (const imageName of allImages) {
    const localPath = path.join(TEST_DATA_DIR, imageName);

    if (!fs.existsSync(localPath)) {
      log(`  ⚠ Image not found: ${imageName}`, 'yellow');
      continue;
    }

    const s3Key = `${S3_PREFIX}/images/${imageName}`;
    const s3Url = await uploadFile(localPath, s3Key);
    uploadedImages[imageName] = s3Url;
  }

  // Upload music
  log('\nUploading music files...', 'blue');
  const uploadedMusic = {};
  for (const musicName of allMusic) {
    const localPath = path.join(TEST_DATA_DIR, musicName);

    if (!fs.existsSync(localPath)) {
      log(`  ⚠ Music not found: ${musicName}`, 'yellow');
      continue;
    }

    const s3Key = `${S3_PREFIX}/music/${musicName}`;
    const s3Url = await uploadFile(localPath, s3Key);
    uploadedMusic[musicName] = s3Url;
  }

  // Save uploaded URLs to a mapping file
  const urlMapping = {
    images: uploadedImages,
    music: uploadedMusic,
    bucket: S3_BUCKET,
    prefix: S3_PREFIX,
    uploadedAt: new Date().toISOString()
  };

  const mappingPath = path.join(TEST_DATA_DIR, 's3-urls.json');
  fs.writeFileSync(mappingPath, JSON.stringify(urlMapping, null, 2));

  console.log('\n' + '='.repeat(80));
  log('✓ UPLOAD COMPLETE', 'green');
  console.log('='.repeat(80));
  log(`Images: ${Object.keys(uploadedImages).length}`, 'cyan');
  log(`Music: ${Object.keys(uploadedMusic).length}`, 'cyan');
  log(`Mapping saved: ${mappingPath}`, 'cyan');
  console.log('='.repeat(80) + '\n');
}

// Check AWS credentials
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  log('ERROR: AWS credentials not found in environment', 'red');
  log('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY', 'yellow');
  process.exit(1);
}

uploadTestAssets().catch(error => {
  console.error('\n' + '='.repeat(80));
  log('UPLOAD FAILED', 'red');
  console.error('='.repeat(80));
  console.error(error);
  process.exit(1);
});

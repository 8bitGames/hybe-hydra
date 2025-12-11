/**
 * Standardized AWS Batch Tests for Smart Beat-Sync
 *
 * Tests various combinations of:
 * - Different BPMs (slow/medium/fast)
 * - Different image counts (5-10 images)
 * - Different durations (6-13 seconds)
 *
 * All test assets are in backend/compose-engine/test-data/
 *
 * Usage:
 *   node scripts/test-batch-standardized.js              # Run all tests
 *   node scripts/test-batch-standardized.js test-1       # Run specific test
 *   node scripts/test-batch-standardized.js --list       # List all tests
 */

const fs = require('fs');
const path = require('path');

// Load test configuration
const TEST_CONFIG_PATH = path.join(__dirname, '../backend/compose-engine/test-data/test-config.json');
const TEST_DATA_DIR = path.join(__dirname, '../backend/compose-engine/test-data');

if (!fs.existsSync(TEST_CONFIG_PATH)) {
  console.error(`Test config not found: ${TEST_CONFIG_PATH}`);
  process.exit(1);
}

const testConfig = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));

// API Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';
const TEST_S3_BUCKET = 'hydra-assets-hybe';
const TEST_S3_PREFIX = 'test-data/batch-tests';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.bright}${colors.blue}=== ${step} ===${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function logInfo(label, value) {
  console.log(`  ${colors.cyan}${label}:${colors.reset} ${value}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

// Step 0: Login
async function login() {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@hydra.com',
      password: 'admin123'
    })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Login failed: ${error}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Upload test assets to S3
async function uploadAssets(token, testCase) {
  logStep('Upload Assets', `Uploading ${testCase.numImages} images + 1 music file`);

  const uploadedAssets = {
    images: [],
    music: null
  };

  // Upload images
  for (let i = 0; i < testCase.images.length; i++) {
    const imagePath = path.join(TEST_DATA_DIR, testCase.images[i]);

    if (!fs.existsSync(imagePath)) {
      logWarning(`Image not found: ${imagePath}`);
      continue;
    }

    uploadedAssets.images.push({
      localPath: testCase.images[i],  // Just filename for mapping
      order: i
    });

    logInfo(`Image ${i + 1}`, testCase.images[i]);
  }

  // Upload music
  const musicPath = path.join(TEST_DATA_DIR, testCase.music);
  if (fs.existsSync(musicPath)) {
    uploadedAssets.music = {
      filename: testCase.music,
      bpm: testCase.musicBpm
    };
    logInfo('Music', testCase.music);
  } else {
    logWarning(`Music not found: ${musicPath}`);
  }

  logSuccess(`Prepared ${uploadedAssets.images.length} images + music for upload`);

  return uploadedAssets;
}

// Load S3 URLs from mapping file
function loadS3Urls() {
  const mappingPath = path.join(TEST_DATA_DIR, 's3-urls.json');

  if (!fs.existsSync(mappingPath)) {
    throw new Error(`S3 URL mapping not found. Please run: node scripts/upload-test-assets.js`);
  }

  return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
}

// Proxy assets to MinIO/S3
async function proxyAssets(token, assets, generationId, s3Urls) {
  logStep('Using S3 Assets', 'Loading pre-uploaded S3 URLs...');

  // Map images to S3 URLs
  const proxiedImages = assets.images.map(img => {
    const s3Url = s3Urls.images[img.localPath];
    if (!s3Url) {
      throw new Error(`S3 URL not found for ${img.localPath}`);
    }
    return {
      sourceUrl: s3Url,
      order: img.order
    };
  });

  // Get music S3 URL
  const musicS3Url = s3Urls.music[assets.music.filename];
  if (!musicS3Url) {
    throw new Error(`S3 URL not found for music: ${assets.music.filename}`);
  }

  logSuccess(`Using ${proxiedImages.length} images from S3`);
  logInfo('Music URL', musicS3Url);

  return {
    images: proxiedImages,
    music: {
      ...assets.music,
      s3Url: musicS3Url
    }
  };
}

// Submit render to AWS Batch
async function submitRender(token, testCase, assets, generationId) {
  logStep('Submit to AWS Batch', `Rendering ${testCase.targetDuration}s video`);

  const imagePayload = assets.images.map((img) => ({
    url: img.sourceUrl,
    order: img.order
  }));

  logInfo('Generation ID', generationId);
  logInfo('Test Case', testCase.id);
  logInfo('Description', testCase.description);
  logInfo('Images', imagePayload.length);
  logInfo('Target Duration', `${testCase.targetDuration}s`);
  logInfo('Expected BPM', testCase.musicBpm);
  logInfo('Script Lines', testCase.script.lines.length);

  const renderRequest = {
    generationId,
    campaignId: '',
    audioAssetId: '', // Would need to upload audio and get asset ID
    images: imagePayload,
    script: { lines: testCase.script.lines },
    styleSetId: 'clean_minimal', // Using minimal style for testing
    aspectRatio: '9:16',
    targetDuration: testCase.targetDuration,
    audioStartTime: 0,
    prompt: testCase.description,
    // Force AWS Batch backend
    renderBackend: 'batch'
  };

  const res = await fetch(`${API_BASE}/v1/fast-cut/render`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(renderRequest)
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Render submit failed: ${error}`);
  }

  const data = await res.json();

  logSuccess('Render job submitted to AWS Batch');
  logInfo('Job ID', data.jobId);
  logInfo('Status', data.status);
  logInfo('Backend', data.renderBackend || 'batch');
  logInfo('Batch Job ID', data.batchJobId || 'N/A');
  logInfo('Estimated Time', `${data.estimatedSeconds || 60}s`);

  return data;
}

// Poll status
async function pollStatus(token, generationId, maxPollTime = 600000) {
  logStep('Poll Status', 'Waiting for render to complete...');

  const startTime = Date.now();
  let lastProgress = -1;
  let lastStep = '';

  while (Date.now() - startTime < maxPollTime) {
    const res = await fetch(`${API_BASE}/v1/fast-cut/${generationId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Status check failed: ${error}`);
    }

    const data = await res.json();

    // Only log if progress or step changed
    if (data.progress !== lastProgress || data.currentStep !== lastStep) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`  [${elapsed}s] ${data.status.toUpperCase()} - ${data.progress}% - ${data.currentStep || 'Processing...'}`);
      lastProgress = data.progress;
      lastStep = data.currentStep;
    }

    if (data.status === 'completed') {
      logSuccess('Render completed!');
      logInfo('Output URL', data.outputUrl || '(check database)');
      logInfo('Actual Duration', data.metadata?.duration ? `${data.metadata.duration}s` : 'N/A');
      logInfo('BPM Used', data.metadata?.bpm || 'N/A');
      logInfo('Beats per Image', data.metadata?.beatsPerImage || 'N/A');
      return data;
    }

    if (data.status === 'failed') {
      throw new Error(`Render failed: ${data.error || 'Unknown error'}`);
    }

    // Wait before next poll
    await new Promise(r => setTimeout(r, 3000));
  }

  throw new Error('Render timed out');
}

// Run a single test case
async function runTestCase(token, testCase, s3Urls) {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.magenta}TEST CASE: ${testCase.id}${colors.reset}`);
  console.log(`${colors.cyan}${testCase.description}${colors.reset}`);
  console.log('='.repeat(80));

  const testStartTime = Date.now();
  const generationId = `${testCase.id}-${Date.now()}`;

  try {
    // Upload assets
    const assets = await uploadAssets(token, testCase);

    // Proxy to S3
    const proxiedAssets = await proxyAssets(token, assets, generationId, s3Urls);

    // Submit render
    const renderResponse = await submitRender(token, testCase, proxiedAssets, generationId);

    // Poll status
    const finalStatus = await pollStatus(token, generationId);

    // Summary
    const totalTime = Math.round((Date.now() - testStartTime) / 1000);
    console.log('\n' + '-'.repeat(80));
    console.log(`${colors.bright}${colors.green}✓ TEST PASSED${colors.reset}`);
    logInfo('Total Time', `${totalTime}s`);
    logInfo('Output URL', finalStatus.outputUrl || '(check database)');
    console.log('-'.repeat(80));

    return {
      testId: testCase.id,
      success: true,
      generationId,
      outputUrl: finalStatus.outputUrl,
      duration: totalTime,
      metadata: finalStatus.metadata
    };

  } catch (error) {
    const totalTime = Math.round((Date.now() - testStartTime) / 1000);
    console.log('\n' + '-'.repeat(80));
    console.log(`${colors.bright}${colors.red}✗ TEST FAILED${colors.reset}`);
    logError(error.message);
    logInfo('Total Time', `${totalTime}s`);
    console.log('-'.repeat(80));

    return {
      testId: testCase.id,
      success: false,
      error: error.message,
      duration: totalTime
    };
  }
}

// List all test cases
function listTests() {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}AVAILABLE TEST CASES${colors.reset}`);
  console.log('='.repeat(80));

  testConfig.testCases.forEach((tc, idx) => {
    console.log(`\n${colors.bright}${idx + 1}. ${tc.id}${colors.reset}`);
    logInfo('Description', tc.description);
    logInfo('Music', `${tc.music} (${tc.musicBpm} BPM)`);
    logInfo('Duration', `${tc.targetDuration}s`);
    logInfo('Images', tc.numImages);
    logInfo('Script Lines', tc.script.lines.length);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`${colors.cyan}Total: ${testConfig.testCases.length} test cases${colors.reset}`);
  console.log('='.repeat(80) + '\n');
}

// Main test runner
async function runTests() {
  const args = process.argv.slice(2);

  // List tests
  if (args.includes('--list')) {
    listTests();
    return;
  }

  // Filter test cases
  let testCasesToRun = testConfig.testCases;
  if (args.length > 0 && !args[0].startsWith('--')) {
    const testId = args[0];
    testCasesToRun = testConfig.testCases.filter(tc => tc.id === testId);
    if (testCasesToRun.length === 0) {
      logError(`Test case not found: ${testId}`);
      console.log('\nAvailable tests:');
      testConfig.testCases.forEach(tc => console.log(`  - ${tc.id}`));
      process.exit(1);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}SMART BEAT-SYNC STANDARDIZED TESTS${colors.reset}`);
  console.log(`${colors.bright}AWS Batch Backend${colors.reset}`);
  console.log('='.repeat(80));
  console.log(`${colors.cyan}Running ${testCasesToRun.length} test case(s)${colors.reset}`);
  console.log('='.repeat(80));

  const overallStartTime = Date.now();

  try {
    // Load S3 URLs
    logStep('Load S3 URLs', 'Loading pre-uploaded asset URLs...');
    const s3Urls = loadS3Urls();
    logSuccess(`Loaded ${Object.keys(s3Urls.images).length} images and ${Object.keys(s3Urls.music).length} music files`);
    logInfo('Uploaded', new Date(s3Urls.uploadedAt).toLocaleString());

    // Login
    logStep('Authentication', 'Logging in...');
    const token = await login();
    logSuccess('Authenticated as admin@hydra.com');

    // Run tests in parallel
    log('\n🚀 Running all tests in parallel...', 'cyan');
    const testPromises = testCasesToRun.map((testCase, idx) => {
      log(`  Launching test ${idx + 1}/${testCasesToRun.length}: ${testCase.id}`, 'blue');
      return runTestCase(token, testCase, s3Urls);
    });

    const results = await Promise.all(testPromises);

    // Overall summary
    const overallTime = Math.round((Date.now() - overallStartTime) / 1000);
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(80));
    console.log(`${colors.bright}${colors.cyan}OVERALL SUMMARY${colors.reset}`);
    console.log('='.repeat(80));
    logInfo('Total Tests', results.length);
    logInfo('Passed', `${colors.green}${passed}${colors.reset}`);
    logInfo('Failed', `${colors.red}${failed}${colors.reset}`);
    logInfo('Total Time', `${overallTime}s`);

    console.log('\n' + colors.bright + 'Results:' + colors.reset);
    results.forEach(r => {
      const status = r.success ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
      console.log(`  ${status} ${r.testId} (${r.duration}s)`);
      if (r.outputUrl) {
        console.log(`      → ${r.outputUrl}`);
      }
      if (r.error) {
        console.log(`      → ${colors.red}${r.error}${colors.reset}`);
      }
    });

    console.log('='.repeat(80) + '\n');

    if (failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.log('\n' + '='.repeat(80));
    console.log(`${colors.bright}${colors.red}TEST SUITE FAILED${colors.reset}`);
    console.log('='.repeat(80));
    logError(error.message);
    console.log('='.repeat(80) + '\n');
    process.exit(1);
  }
}

// Run
runTests();

# Smart Beat-Sync Standardized Tests - Setup Complete

## ✅ What Was Created

### 1. Test Configuration
**File:** `backend/compose-engine/test-data/test-config.json`

6 standardized test cases covering:
- **3 different BPMs:** 73.8 (slow), 82.0 (medium), 144.2 (fast)
- **4 different durations:** 6s, 8s, 9s, 10s, 12s, 13s
- **Variable image counts:** 5-9 images per test
- **Different script structures:** 2-4 text overlays per test

### 2. Test Assets (Uploaded to S3)

#### Music Files
- `music.mp3` - 73.8 BPM (Slow/Ballad)
- `aggressive-techno-421104.mp3` - 82.0 BPM (Medium/Pop)
- `pounding-industrial-techno-instrumental-248320.mp3` - 144.2 BPM (Fast/Techno)

#### Images (9 total)
Various couple/portrait images in JPG, WEBP, AVIF formats

**S3 Location:** `s3://hydra-assets-hybe/test-data/batch-tests/`

**URL Mapping:** `backend/compose-engine/test-data/s3-urls.json`
- All assets pre-uploaded to S3
- URLs saved for reuse (no need to upload again)
- Uploaded at: 2025-12-11 13:08:34 UTC

### 3. Test Runner Scripts

#### Upload Script
**File:** `scripts/upload-test-assets.js`
- Uploads all test images and music to S3
- Generates `s3-urls.json` mapping file
- Uses `@aws-sdk/client-s3`

#### Test Runner
**File:** `scripts/test-batch-standardized.js`
- Loads test cases from `test-config.json`
- Uses pre-uploaded S3 URLs (no re-upload needed)
- Submits renders to AWS Batch
- Polls for completion
- Generates detailed test reports

### 4. Documentation
**File:** `backend/compose-engine/test-data/README.md`
- Complete test documentation
- Expected behaviors for each test
- Validation criteria
- Troubleshooting guide

## 📋 Test Cases Summary

| Test ID | BPM | Duration | Images | Expected Beats/Image | Description |
|---------|-----|----------|--------|---------------------|-------------|
| test-1-slow-bpm-5-images-6s | 73.8 | 6s | 5 | 2 (1.625s avg) | Slow BPM, short duration |
| test-2-medium-bpm-7-images-10s | 82.0 | 10s | 7 | 2 (1.463s avg) | Medium BPM, medium duration |
| test-3-fast-bpm-10-images-13s | 144.2 | 13s | 9 | 3 (1.248s avg) | Fast BPM, long duration |
| test-4-fast-bpm-8-images-8s | 144.2 | 8s | 8 | 2 (0.832s avg) | Fast BPM, short duration |
| test-5-slow-bpm-6-images-9s | 73.8 | 9s | 6 | 2 (1.625s avg) | Slow BPM, medium duration |
| test-6-medium-bpm-9-images-12s | 82.0 | 12s | 9 | 2 (1.463s avg) | Medium BPM, long duration |

## 🚀 Usage

### List Available Tests
```bash
node scripts/test-batch-standardized.js --list
```

### Run All Tests
```bash
node scripts/test-batch-standardized.js
```

### Run Specific Test
```bash
node scripts/test-batch-standardized.js test-1-slow-bpm-5-images-6s
```

### Re-upload Assets (if needed)
```bash
node -r dotenv/config scripts/upload-test-assets.js dotenv_config_path=env.local
```

## ✅ Pre-Flight Checklist

- [x] Test configuration created (`test-config.json`)
- [x] 3 MP3 files with different BPMs added
- [x] 9 test images collected
- [x] Assets uploaded to S3
- [x] S3 URLs saved (`s3-urls.json`)
- [x] Test runner script created
- [x] Upload helper script created
- [x] Documentation written

## 📊 Expected Smart Beat-Sync Behavior

### Test 1: Slow BPM (73.8), 6s
```
BPM: 73.8
Beat interval: 0.813s
Optimal: 2 beats/image = 1.625s
Expected clips: 3-4 images
Actual duration: ~5-6s
```

### Test 3: Fast BPM (144.2), 13s
```
BPM: 144.2
Beat interval: 0.416s
Optimal: 3 beats/image = 1.248s
Expected clips: 9-10 images
Actual duration: ~11-13s
```

### Test 4: Fast BPM (144.2), 8s
```
BPM: 144.2
Beat interval: 0.416s
Optimal: 2 beats/image = 0.832s
Expected clips: 8-9 images
Actual duration: ~6-8s
```

## 🔍 What Each Test Validates

### Technical Validation
- ✅ Video renders successfully on AWS Batch
- ✅ No errors in CloudWatch logs
- ✅ GPU encoding used (NVENC)
- ✅ Output duration matches target (±0.5s)
- ✅ S3 upload/download works correctly

### Beat-Sync Validation
- ✅ BPM detected correctly
- ✅ Beats-per-image calculated optimally
- ✅ Image duration in 1.0-1.5s range (average)
- ✅ Transitions occur exactly on beats
- ✅ Handles variable BPMs (slow/medium/fast)

### Visual Validation
- ✅ Images cropped to fill 9:16 (no black bars)
- ✅ Static images (no zoom/motion)
- ✅ Text centered and readable
- ✅ Text timing matches script

### Audio Validation
- ✅ Audio fade in: 0.75s
- ✅ Audio fade out: 0.75s
- ✅ Audio/video in sync
- ✅ No clipping or distortion

## 📁 Files Created

```
hybe-hydra/
├── backend/compose-engine/test-data/
│   ├── test-config.json                 # Test case definitions
│   ├── s3-urls.json                     # S3 URL mapping (UPLOADED)
│   ├── README.md                        # Test documentation
│   ├── music.mp3                        # 73.8 BPM
│   ├── aggressive-techno-421104.mp3     # 82.0 BPM
│   ├── pounding-industrial-*.mp3        # 144.2 BPM
│   ├── *.jpg, *.webp, *.avif           # 9 test images
│   └── smart-beat-sync.py               # Local test script
├── scripts/
│   ├── test-batch-standardized.js       # AWS Batch test runner
│   ├── upload-test-assets.js            # S3 upload helper
│   └── test-fast-cut-e2e.js             # Existing E2E test
└── STANDARDIZED_TESTS_SUMMARY.md        # This file
```

## 🎯 Next Steps

1. **Run First Test:**
   ```bash
   node scripts/test-batch-standardized.js test-1-slow-bpm-5-images-6s
   ```

2. **Verify Output:**
   - Check CloudWatch logs for beat-sync details
   - Verify BPM detection and beats-per-image calculation
   - Download and review generated video
   - Confirm transitions on beat

3. **Run Full Test Suite:**
   ```bash
   node scripts/test-batch-standardized.js
   ```

4. **Review Results:**
   - Check all 6 tests pass
   - Validate beat-sync works across all BPMs
   - Confirm durations match targets
   - Verify GPU encoding used

## 🔗 S3 Asset URLs

All assets are pre-uploaded and accessible at:
- **Images:** `https://hydra-assets-hybe.s3.ap-southeast-2.amazonaws.com/test-data/batch-tests/images/`
- **Music:** `https://hydra-assets-hybe.s3.ap-southeast-2.amazonaws.com/test-data/batch-tests/music/`

See `backend/compose-engine/test-data/s3-urls.json` for complete URL mapping.

## ✨ Key Benefits

1. **Reproducible:** Same assets, same tests, every time
2. **No Re-Upload:** S3 URLs saved and reused
3. **Comprehensive:** Covers slow/medium/fast BPMs
4. **Flexible:** Different durations (6-13s)
5. **Automated:** Full test execution and reporting
6. **AWS Batch:** Tests production backend directly

---

**Status:** ✅ **Ready to Test**
**All assets uploaded to S3**
**S3 URLs saved in:** `backend/compose-engine/test-data/s3-urls.json`
**Run with:** `node scripts/test-batch-standardized.js`

# Smart Beat-Sync Standardized Tests

This directory contains standardized test cases for the Smart Beat-Sync video generation system.

## Test Assets

### Music Files (3 different BPMs)
- **music.mp3** - 73.8 BPM (Slow/Ballad)
- **aggressive-techno-421104.mp3** - 82.0 BPM (Medium/Pop)
- **pounding-industrial-techno-instrumental-248320.mp3** - 144.2 BPM (Fast/Techno)

### Images (9 total)
Various couple/portrait images in different formats (JPG, WEBP, AVIF) for testing cropping and format support.

## Test Cases

All test cases are defined in `test-config.json` and cover:

| Test ID | BPM | Duration | Images | Description |
|---------|-----|----------|--------|-------------|
| test-1-slow-bpm-5-images-6s | 73.8 | 6s | 5 | Slow BPM, short duration |
| test-2-medium-bpm-7-images-10s | 82.0 | 10s | 7 | Medium BPM, medium duration |
| test-3-fast-bpm-10-images-13s | 144.2 | 13s | 9 | Fast BPM, long duration |
| test-4-fast-bpm-8-images-8s | 144.2 | 8s | 8 | Fast BPM, short duration |
| test-5-slow-bpm-6-images-9s | 73.8 | 9s | 6 | Slow BPM, medium duration |
| test-6-medium-bpm-9-images-12s | 82.0 | 12s | 9 | Medium BPM, long duration |

Each test case includes:
- Specific music file
- Number of images
- Target duration
- Script lines with timing
- Expected BPM

## Expected Behavior

For each test, the Smart Beat-Sync algorithm should:

1. **Detect BPM** from the music file
2. **Calculate beat interval** (60 / BPM)
3. **Determine optimal beats-per-image** (1, 2, 3, or 4 beats)
   - Goal: Keep image duration between 1.0-1.5 seconds
   - Fast BPM (144 BPM): ~2-3 beats per image
   - Medium BPM (82 BPM): ~2 beats per image
   - Slow BPM (74 BPM): ~2 beats per image
4. **Calculate exact clip durations** from beat timings
5. **Fit images to target duration**

## Running Tests

### Step 1: Upload Assets to S3

```bash
# Load environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=ap-southeast-2

# Upload test assets
node scripts/upload-test-assets.js
```

This will upload all images and music files to S3 and generate `s3-urls.json`.

### Step 2: List Available Tests

```bash
node scripts/test-batch-standardized.js --list
```

### Step 3: Run All Tests

```bash
node scripts/test-batch-standardized.js
```

### Step 4: Run Specific Test

```bash
node scripts/test-batch-standardized.js test-1-slow-bpm-5-images-6s
```

## Local Testing

You can also test locally with the Python script:

```bash
cd /Users/paksungho/hybe-hydra/backend/compose-engine/test-data

# Test with default 15s duration
python3 smart-beat-sync.py

# Test with specific duration
python3 smart-beat-sync.py 6   # 6 second video
python3 smart-beat-sync.py 10  # 10 second video
python3 smart-beat-sync.py 13  # 13 second video
```

## Validation Criteria

Each test should validate:

### ✅ Technical Requirements
- [ ] Video renders successfully
- [ ] No errors in logs
- [ ] GPU encoding used (if available)
- [ ] Output duration matches target (±0.5s)

### ✅ Beat-Sync Quality
- [ ] BPM correctly detected
- [ ] Beats-per-image calculated optimally
- [ ] Image duration in 1.0-1.5s range (average)
- [ ] Transitions occur exactly on beats

### ✅ Visual Quality
- [ ] Images cropped to fill 9:16 (no black bars)
- [ ] No zoom/motion effects (static)
- [ ] Text centered and readable
- [ ] Text timing matches script

### ✅ Audio Quality
- [ ] Audio fade in: 0.75s
- [ ] Audio fade out: 0.75s
- [ ] No audio clipping or distortion
- [ ] Audio and video in sync

## Test Outputs

Test results are stored in the database with:
- Generation ID
- Output video URL
- Metadata (BPM, beats-per-image, actual duration)
- Render logs
- Status (completed/failed)

## Example Expected Results

### Test 1 (Slow BPM, 6s, 5 images)
```
BPM: 73.8
Beat interval: 0.813s
Beats per image: 2 (1.625s avg)
Expected clips: 3-4 images
Actual duration: ~5-6s
```

### Test 3 (Fast BPM, 13s, 9 images)
```
BPM: 144.2
Beat interval: 0.416s
Beats per image: 3 (1.248s avg)
Expected clips: 9-10 images
Actual duration: ~11-13s
```

## Troubleshooting

### AWS Batch Not Used
- Check `renderBackend` in request payload
- Verify AWS Batch is configured in backend
- Check environment variables

### Images Not Loading
- Verify S3 URLs are accessible
- Check CORS settings on S3 bucket
- Run upload script again

### BPM Detection Issues
- Verify audio file is valid MP3
- Check librosa is installed
- Review audio analysis logs

## Files

```
test-data/
├── README.md                    # This file
├── test-config.json             # Test case definitions
├── s3-urls.json                 # S3 URL mapping (generated)
├── music.mp3                    # Slow BPM (73.8)
├── aggressive-techno-*.mp3      # Medium BPM (82.0)
├── pounding-industrial-*.mp3    # Fast BPM (144.2)
├── *.jpg, *.webp, *.avif       # Test images
├── smart-beat-sync.py           # Local test script
└── output/                      # Local test outputs
```

## Integration Status

✅ **Implemented**
- Smart beat-sync algorithm (`backend/compose-engine/app/renderers/smart_beat_sync.py`)
- FFmpeg renderer integration (`backend/compose-engine/app/renderers/ffmpeg_renderer.py`)
- Detailed logging (BPM, beats-per-image, GPU usage)
- Local testing script
- Standardized test suite

🔧 **Ready to Test**
- AWS Batch backend rendering
- S3 asset upload/download
- End-to-end API flow

## Support

For issues or questions:
1. Check render logs in CloudWatch (AWS Batch jobs)
2. Review generation status in database
3. Test locally first with `smart-beat-sync.py`
4. Verify all assets uploaded correctly to S3

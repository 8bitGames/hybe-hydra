#!/bin/bash
# Generate video with beat-synchronized transitions
# Images change exactly on the music beats

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
TEMP_DIR="$SCRIPT_DIR/temp"

# Create directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMP_DIR"

echo "============================================================"
echo "BEAT-SYNCHRONIZED VIDEO GENERATION"
echo "============================================================"
echo ""

# Find all images
shopt -s nullglob
IMAGES=("$SCRIPT_DIR"/*.jpg "$SCRIPT_DIR"/*.jpeg "$SCRIPT_DIR"/*.webp "$SCRIPT_DIR"/*.avif)
MUSIC="$SCRIPT_DIR/music.mp3"

echo "Found ${#IMAGES[@]} images"
echo "Music: $(basename $MUSIC)"
echo ""

# Check ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg not found. Install with: brew install ffmpeg"
    exit 1
fi

echo "✓ FFmpeg found"
echo ""

# Beat times detected from music analysis (BPM ~74)
# Each value is when a beat occurs
BEAT_TIMES=(0.209 1.022 1.834 2.670 3.506 4.296 5.108 5.921 6.734 7.546 8.359 9.172 9.985 10.797 11.587 12.399 13.235 14.025 14.861)

# Calculate clip durations (2 beats per image = double length)
CLIP_DURATIONS=()
for i in $(seq 0 $((${#BEAT_TIMES[@]} / 2 - 1))); do
    BEAT_INDEX=$((i * 2))
    NEXT_BEAT_INDEX=$((BEAT_INDEX + 2))
    if [ $NEXT_BEAT_INDEX -lt ${#BEAT_TIMES[@]} ]; then
        # Duration = 2 beat intervals (time from beat N to beat N+2)
        DURATION=$(printf "%.3f" $(echo "${BEAT_TIMES[$NEXT_BEAT_INDEX]} - ${BEAT_TIMES[$BEAT_INDEX]}" | bc))
        CLIP_DURATIONS+=($DURATION)
    fi
done

# Limit to number of images we have
NUM_CLIPS=$((${#IMAGES[@]} < ${#CLIP_DURATIONS[@]} ? ${#IMAGES[@]} : ${#CLIP_DURATIONS[@]}))

echo "Creating ${NUM_CLIPS} beat-synced clips (2 beats per image)"
echo "BPM: ~74 (each image lasts ~1.6 seconds)"
echo ""

# Settings
FADE_DURATION=0.75
WIDTH=1080
HEIGHT=1920             # 9:16 aspect ratio
FPS=30

# Calculate total duration
LAST_BEAT_INDEX=$((NUM_CLIPS * 2))
TOTAL_DURATION=${BEAT_TIMES[$LAST_BEAT_INDEX]}
echo "Video duration: ${TOTAL_DURATION}s (${NUM_CLIPS} images, 2 beats each)"
echo ""

# Process each image: resize and crop to fill 9:16
echo "Processing images..."
for i in $(seq 0 $((NUM_CLIPS - 1))); do
    INPUT="${IMAGES[$i]}"
    OUTPUT="$TEMP_DIR/slide_$(printf %03d $i).png"

    # Resize and crop to 1080x1920 (9:16) - fill entire frame, no black bars
    ffmpeg -i "$INPUT" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -frames:v 1 "$OUTPUT" -y -loglevel error

    echo "  ✓ Processed image $((i+1))/${NUM_CLIPS}"
done

echo ""
echo "Creating video clips with beat-synced durations..."

# Create video clips from images - each clip lasts one beat interval
for i in $(seq 0 $((NUM_CLIPS - 1))); do
    INPUT="$TEMP_DIR/slide_$(printf %03d $i).png"
    OUTPUT="$TEMP_DIR/clip_$(printf %03d $i).mp4"
    DURATION=${CLIP_DURATIONS[$i]}

    # Static image with exact beat duration
    ffmpeg -loop 1 -i "$INPUT" -t "$DURATION" -pix_fmt yuv420p "$OUTPUT" -y -loglevel error

    echo "  ✓ Created clip $((i+1))/${NUM_CLIPS} (${DURATION}s)"
done

echo ""
echo "Concatenating clips (direct cuts on beats)..."

# Create concat file
CONCAT_FILE="$TEMP_DIR/concat.txt"
> "$CONCAT_FILE"
for i in $(seq 0 $((NUM_CLIPS - 1))); do
    echo "file 'clip_$(printf %03d $i).mp4'" >> "$CONCAT_FILE"
done

# Concatenate all clips
ffmpeg -f concat -safe 0 -i "$CONCAT_FILE" -c copy "$TEMP_DIR/video_no_audio.mp4" -y -loglevel error
echo "  ✓ Clips concatenated"

echo ""
echo "Adding text overlays (centered, white, Arial)..."

# Text overlay settings (centered) with timings based on beats
TEXT_FILTER=""
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Welcome to our story':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,3)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Beautiful moments':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,3,5.5)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Together forever':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,5.5,8)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Love is in the air':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,8,11)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Making memories':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,11,15)'"

ffmpeg -i "$TEMP_DIR/video_no_audio.mp4" -vf "$TEXT_FILTER" -c:v libx264 -preset fast "$TEMP_DIR/video_with_text.mp4" -y -loglevel error
echo "  ✓ Text overlays added"

echo ""
echo "Adding audio with fade in/out (0.75s)..."

# Add audio with fade in/out
VIDEO_DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$TEMP_DIR/video_with_text.mp4")
FADE_OUT_START=$(echo "$VIDEO_DURATION - 0.75" | bc)

ffmpeg -i "$TEMP_DIR/video_with_text.mp4" -i "$MUSIC" \
    -filter_complex "[1:a]afade=t=in:st=0:d=0.75,afade=t=out:st=${FADE_OUT_START}:d=0.75,atrim=duration=${VIDEO_DURATION}[a]" \
    -map 0:v -map "[a]" \
    -c:v copy -c:a aac -b:a 192k -shortest \
    "$OUTPUT_DIR/final_video_beat_sync.mp4" -y -loglevel error

echo "  ✓ Audio mixed"

# Cleanup
echo ""
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"
echo "  ✓ Cleaned up"

echo ""
echo "============================================================"
echo "✅ BEAT-SYNCED VIDEO GENERATED SUCCESSFULLY!"
echo "============================================================"
echo ""
echo "Output: $OUTPUT_DIR/final_video_beat_sync.mp4"
echo ""
echo "Settings applied:"
echo "  ✓ 9:16 aspect ratio (1080x1920)"
echo "  ✓ Beat-synchronized transitions (BPM ~74)"
echo "  ✓ ${NUM_CLIPS} images changing on beat"
echo "  ✓ No transitions (direct cuts on beats)"
echo "  ✓ Audio fade: 0.75s in/out"
echo "  ✓ Text: White, centered, with individual timings"
echo "  ✓ Static images (no zoom, no motion)"
echo "  ✓ Images cropped to fill frame (no black borders)"
echo ""
echo "View with: open $OUTPUT_DIR/final_video_beat_sync.mp4"
echo "============================================================"

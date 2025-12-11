#!/bin/bash
# Generate video locally using FFmpeg
# Uses images and music from test-data folder

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
TEMP_DIR="$SCRIPT_DIR/temp"

# Create directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMP_DIR"

echo "============================================================"
echo "LOCAL VIDEO GENERATION WITH FFMPEG"
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

# Settings
SLIDE_DURATION=1.0      # 1 second per image (you wanted 1-1.25s)
FADE_DURATION=0.75      # Audio fade in/out
WIDTH=1080
HEIGHT=1920             # 9:16 aspect ratio
FPS=30

# Calculate total duration
TOTAL_DURATION=$(echo "${#IMAGES[@]} * $SLIDE_DURATION" | bc)
echo "Video duration: ${TOTAL_DURATION}s (${#IMAGES[@]} slides × ${SLIDE_DURATION}s)"
echo ""

# Process each image: resize, pad to 9:16
echo "Processing images..."
for i in "${!IMAGES[@]}"; do
    INPUT="${IMAGES[$i]}"
    OUTPUT="$TEMP_DIR/slide_$(printf %03d $i).png"

    # Resize and crop to 1080x1920 (9:16) - fill entire frame, no black bars
    ffmpeg -i "$INPUT" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -frames:v 1 "$OUTPUT" -y -loglevel error

    echo "  ✓ Processed image $((i+1))/${#IMAGES[@]}"
done

echo ""
echo "Creating video clips (static, no zoom)..."

# Create video clips from images - static, no motion
for i in "${!IMAGES[@]}"; do
    INPUT="$TEMP_DIR/slide_$(printf %03d $i).png"
    OUTPUT="$TEMP_DIR/clip_$(printf %03d $i).mp4"

    # Static image - no zoom, no motion
    ffmpeg -loop 1 -i "$INPUT" -t $SLIDE_DURATION -pix_fmt yuv420p "$OUTPUT" -y -loglevel error

    echo "  ✓ Created clip $((i+1))/${#IMAGES[@]}"
done

echo ""
echo "Concatenating clips (no transitions - direct cuts)..."

# Create concat file
CONCAT_FILE="$TEMP_DIR/concat.txt"
> "$CONCAT_FILE"
for i in "${!IMAGES[@]}"; do
    echo "file 'clip_$(printf %03d $i).mp4'" >> "$CONCAT_FILE"
done

# Concatenate all clips
ffmpeg -f concat -safe 0 -i "$CONCAT_FILE" -c copy "$TEMP_DIR/video_no_audio.mp4" -y -loglevel error
echo "  ✓ Clips concatenated"

echo ""
echo "Adding text overlays (centered, white, Noto Sans)..."

# Text overlay settings (centered)
TEXT_FILTER=""
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Welcome to our story':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,3)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Beautiful moments':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,3,5.5)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Together forever':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,5.5,8)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Love is in the air':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,8,11)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Making memories':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,11,13)'"

ffmpeg -i "$TEMP_DIR/video_no_audio.mp4" -vf "$TEXT_FILTER" -c:v libx264 -preset fast "$TEMP_DIR/video_with_text.mp4" -y -loglevel error
echo "  ✓ Text overlays added"

echo ""
echo "Adding audio with fade in/out (0.75s)..."

# Add audio with fade in/out
# afade=t=in:st=0:d=0.75,afade=t=out:st=duration-0.75:d=0.75
VIDEO_DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$TEMP_DIR/video_with_text.mp4")
FADE_OUT_START=$(echo "$VIDEO_DURATION - 0.75" | bc)

ffmpeg -i "$TEMP_DIR/video_with_text.mp4" -i "$MUSIC" \
    -filter_complex "[1:a]afade=t=in:st=0:d=0.75,afade=t=out:st=${FADE_OUT_START}:d=0.75,atrim=duration=${VIDEO_DURATION}[a]" \
    -map 0:v -map "[a]" \
    -c:v copy -c:a aac -b:a 192k -shortest \
    "$OUTPUT_DIR/final_video.mp4" -y -loglevel error

echo "  ✓ Audio mixed"

# Cleanup
echo ""
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"
echo "  ✓ Cleaned up"

echo ""
echo "============================================================"
echo "✅ VIDEO GENERATED SUCCESSFULLY!"
echo "============================================================"
echo ""
echo "Output: $OUTPUT_DIR/final_video.mp4"
echo ""
echo "Settings applied:"
echo "  ✓ 9:16 aspect ratio (1080x1920)"
echo "  ✓ ${SLIDE_DURATION}s per image"
echo "  ✓ No transitions (direct cuts)"
echo "  ✓ Audio fade: 0.75s in/out"
echo "  ✓ Text: White, centered, with individual timings"
echo "  ✓ Static images (no zoom, no motion)"
echo ""
echo "View with: open $OUTPUT_DIR/final_video.mp4"
echo "============================================================"

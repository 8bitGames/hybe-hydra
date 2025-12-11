#!/bin/bash
# Auto-generated smart beat-sync script
# BPM: 73.8
# Beats per image: 2
# Average image duration: 1.628s

set -e

SCRIPT_DIR="/Users/paksungho/hybe-hydra/backend/compose-engine/test-data"
OUTPUT_DIR="$SCRIPT_DIR/output"
TEMP_DIR="$SCRIPT_DIR/temp"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMP_DIR"

echo "============================================================"
echo "SMART BEAT-SYNCHRONIZED VIDEO GENERATION"
echo "============================================================"
echo ""

# Image durations (calculated from beat analysis)
DURATIONS=(1.625 1.672 1.602 1.625 1.625 1.625 1.602 1.649 1.625)
BEAT_POSITIONS=(0.209 1.834 3.506 5.108 6.734 8.359 9.985 11.587 13.235)
NUM_CLIPS=9

# Find images
shopt -s nullglob
IMAGES=("$SCRIPT_DIR"/*.jpg "$SCRIPT_DIR"/*.jpeg "$SCRIPT_DIR"/*.webp "$SCRIPT_DIR"/*.avif)
MUSIC="$SCRIPT_DIR/music.mp3"

echo "Settings:"
echo "  BPM: 73.8"
echo "  Beats per image: 2"
echo "  Average image duration: 1.628s"
echo "  Total clips: $NUM_CLIPS"
echo "  Total duration: 14.652s"
echo ""

# Process images - crop to fill 9:16
echo "Processing images..."
for i in $(seq 0 $((NUM_CLIPS - 1))); do
    INPUT="${IMAGES[$i]}"
    OUTPUT="$TEMP_DIR/slide_$(printf %03d $i).png"

    ffmpeg -i "$INPUT" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
        -frames:v 1 "$OUTPUT" -y -loglevel error

    echo "  ✓ Processed image $((i+1))/$NUM_CLIPS"
done

echo ""
echo "Creating beat-synced clips..."

# Create clips with exact beat durations
for i in $(seq 0 $((NUM_CLIPS - 1))); do
    INPUT="$TEMP_DIR/slide_$(printf %03d $i).png"
    OUTPUT="$TEMP_DIR/clip_$(printf %03d $i).mp4"
    DURATION=${DURATIONS[$i]}

    ffmpeg -loop 1 -i "$INPUT" -t "$DURATION" -pix_fmt yuv420p "$OUTPUT" -y -loglevel error

    echo "  ✓ Clip $((i+1))/$NUM_CLIPS (${DURATION}s)"
done

# Concatenate
echo ""
echo "Concatenating clips..."
CONCAT_FILE="$TEMP_DIR/concat.txt"
> "$CONCAT_FILE"
for i in $(seq 0 $((NUM_CLIPS - 1))); do
    echo "file 'clip_$(printf %03d $i).mp4'" >> "$CONCAT_FILE"
done

ffmpeg -f concat -safe 0 -i "$CONCAT_FILE" -c copy "$TEMP_DIR/video_no_audio.mp4" -y -loglevel error
echo "  ✓ Clips concatenated"

# Text overlays (centered white text)
echo ""
echo "Adding text overlays..."
TEXT_FILTER=""
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Welcome to our story':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,3)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Beautiful moments':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,3,5.5)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Together forever':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,5.5,8)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Love is in the air':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,8,11)',"
TEXT_FILTER="${TEXT_FILTER}drawtext=text='Making memories':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,11,20)'"

ffmpeg -i "$TEMP_DIR/video_no_audio.mp4" -vf "$TEXT_FILTER" -c:v libx264 -preset fast \
    "$TEMP_DIR/video_with_text.mp4" -y -loglevel error
echo "  ✓ Text added"

# Mix audio with fade
echo ""
echo "Adding audio..."
VIDEO_DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$TEMP_DIR/video_with_text.mp4")
FADE_OUT_START=$(echo "$VIDEO_DURATION - 0.75" | bc)

ffmpeg -i "$TEMP_DIR/video_with_text.mp4" -i "$MUSIC" \
    -filter_complex "[1:a]afade=t=in:st=0:d=0.75,afade=t=out:st=${FADE_OUT_START}:d=0.75,atrim=duration=${VIDEO_DURATION}[a]" \
    -map 0:v -map "[a]" \
    -c:v copy -c:a aac -b:a 192k -shortest \
    "$OUTPUT_DIR/smart_beat_sync.mp4" -y -loglevel error

echo "  ✓ Audio mixed"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "============================================================"
echo "✅ SMART BEAT-SYNC VIDEO COMPLETE!"
echo "============================================================"
echo ""
echo "Output: $OUTPUT_DIR/smart_beat_sync.mp4"
echo ""
echo "Settings:"
echo "  ✓ BPM: 73.8"
echo "  ✓ 2 beats per image"
echo "  ✓ Avg image duration: 1.628s (range: 1-1.5s)"
echo "  ✓ Images synced to beat"
echo "  ✓ 9:16 cropped to fill"
echo "  ✓ Static images (no motion)"
echo "  ✓ Audio fade: 0.75s"
echo ""
echo "View: open $OUTPUT_DIR/smart_beat_sync.mp4"
echo "============================================================"

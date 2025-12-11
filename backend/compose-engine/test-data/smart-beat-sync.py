#!/usr/bin/env python3
"""
Intelligent beat-synchronized video generator
Automatically determines optimal beats-per-image to keep duration at 1-1.5s
"""

import librosa
import numpy as np
import subprocess
import os
import sys
from pathlib import Path

class SmartBeatSync:
    def __init__(self, music_path, target_duration=15, min_image_duration=1.0, max_image_duration=1.5):
        self.music_path = music_path
        self.target_duration = target_duration
        self.min_image_duration = min_image_duration
        self.max_image_duration = max_image_duration

        # Analyze audio
        print("🎵 Analyzing audio...")
        y, sr = librosa.load(music_path, duration=target_duration + 5)

        # Detect tempo and beats
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        self.bpm = float(tempo)
        self.beat_times = librosa.frames_to_time(beats, sr=sr)
        self.beat_interval = 60.0 / self.bpm

        print(f"  BPM: {self.bpm:.1f}")
        print(f"  Beat interval: {self.beat_interval:.3f}s")

    def determine_beats_per_image(self):
        """
        Intelligently determine how many beats each image should last
        to keep duration in the 1-1.5s range
        """
        # Try different beats per image (1, 2, 3, 4)
        options = []
        for beats in [1, 2, 3, 4]:
            duration = self.beat_interval * beats
            # Score based on how close to target range (1-1.5s)
            if self.min_image_duration <= duration <= self.max_image_duration:
                score = 100  # Perfect fit
            elif duration < self.min_image_duration:
                # Too fast - penalize based on how far below minimum
                score = 50 - abs(duration - self.min_image_duration) * 50
            else:
                # Too slow - penalize based on how far above maximum
                score = 50 - abs(duration - self.max_image_duration) * 30

            options.append({
                'beats_per_image': beats,
                'duration': duration,
                'score': score
            })

        # Choose option with highest score
        best = max(options, key=lambda x: x['score'])

        print(f"\n📊 Beats per image analysis:")
        for opt in options:
            marker = "✓" if opt == best else " "
            print(f"  {marker} {opt['beats_per_image']} beats = {opt['duration']:.3f}s (score: {opt['score']:.1f})")

        print(f"\n✓ Selected: {best['beats_per_image']} beats per image ({best['duration']:.3f}s avg)")

        return best['beats_per_image']

    def calculate_clip_durations(self, beats_per_image, num_images_available):
        """
        Calculate exact duration for each clip based on beat timings
        """
        # How many images can we fit in target duration?
        beats_in_target = len([t for t in self.beat_times if t <= self.target_duration])
        max_images = beats_in_target // beats_per_image

        # Use minimum of available images and what fits
        num_clips = min(num_images_available, max_images)

        print(f"\n📐 Clip calculation:")
        print(f"  Beats available in {self.target_duration}s: {beats_in_target}")
        print(f"  Max images that fit: {max_images}")
        print(f"  Images available: {num_images_available}")
        print(f"  Using: {num_clips} images")

        # Calculate duration for each clip
        durations = []
        beat_positions = []

        for i in range(num_clips):
            start_beat_idx = i * beats_per_image
            end_beat_idx = start_beat_idx + beats_per_image

            if end_beat_idx < len(self.beat_times):
                start_time = self.beat_times[start_beat_idx]
                end_time = self.beat_times[end_beat_idx]
                duration = end_time - start_time
                durations.append(duration)
                beat_positions.append(start_time)

        actual_duration = sum(durations)
        avg_duration = np.mean(durations)

        print(f"\n⏱️  Duration stats:")
        print(f"  Total video duration: {actual_duration:.3f}s")
        print(f"  Average per image: {avg_duration:.3f}s")
        print(f"  Min: {min(durations):.3f}s, Max: {max(durations):.3f}s")

        return durations, beat_positions, num_clips

    def generate_bash_script(self, durations, beat_positions, num_clips, beats_per_image):
        """
        Generate bash script with calculated durations
        """
        script_dir = Path(self.music_path).parent

        # Create bash arrays
        durations_str = " ".join([f"{d:.3f}" for d in durations])
        beats_str = " ".join([f"{b:.3f}" for b in beat_positions])

        bash_script = f'''#!/bin/bash
# Auto-generated smart beat-sync script
# BPM: {self.bpm:.1f}
# Beats per image: {beats_per_image}
# Average image duration: {np.mean(durations):.3f}s

set -e

SCRIPT_DIR="{script_dir}"
OUTPUT_DIR="$SCRIPT_DIR/output"
TEMP_DIR="$SCRIPT_DIR/temp"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMP_DIR"

echo "============================================================"
echo "SMART BEAT-SYNCHRONIZED VIDEO GENERATION"
echo "============================================================"
echo ""

# Image durations (calculated from beat analysis)
DURATIONS=({durations_str})
BEAT_POSITIONS=({beats_str})
NUM_CLIPS={num_clips}

# Find images
shopt -s nullglob
IMAGES=("$SCRIPT_DIR"/*.jpg "$SCRIPT_DIR"/*.jpeg "$SCRIPT_DIR"/*.webp "$SCRIPT_DIR"/*.avif)
MUSIC="$SCRIPT_DIR/music.mp3"

echo "Settings:"
echo "  BPM: {self.bpm:.1f}"
echo "  Beats per image: {beats_per_image}"
echo "  Average image duration: {np.mean(durations):.3f}s"
echo "  Total clips: $NUM_CLIPS"
echo "  Total duration: {sum(durations):.3f}s"
echo ""

# Process images - crop to fill 9:16
echo "Processing images..."
for i in $(seq 0 $((NUM_CLIPS - 1))); do
    INPUT="${{IMAGES[$i]}}"
    OUTPUT="$TEMP_DIR/slide_$(printf %03d $i).png"

    ffmpeg -i "$INPUT" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \\
        -frames:v 1 "$OUTPUT" -y -loglevel error

    echo "  ✓ Processed image $((i+1))/$NUM_CLIPS"
done

echo ""
echo "Creating beat-synced clips..."

# Create clips with exact beat durations
for i in $(seq 0 $((NUM_CLIPS - 1))); do
    INPUT="$TEMP_DIR/slide_$(printf %03d $i).png"
    OUTPUT="$TEMP_DIR/clip_$(printf %03d $i).mp4"
    DURATION=${{DURATIONS[$i]}}

    ffmpeg -loop 1 -i "$INPUT" -t "$DURATION" -pix_fmt yuv420p "$OUTPUT" -y -loglevel error

    echo "  ✓ Clip $((i+1))/$NUM_CLIPS (${{DURATION}}s)"
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
TEXT_FILTER="${{TEXT_FILTER}}drawtext=text='Welcome to our story':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,3)',"
TEXT_FILTER="${{TEXT_FILTER}}drawtext=text='Beautiful moments':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,3,5.5)',"
TEXT_FILTER="${{TEXT_FILTER}}drawtext=text='Together forever':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,5.5,8)',"
TEXT_FILTER="${{TEXT_FILTER}}drawtext=text='Love is in the air':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,8,11)',"
TEXT_FILTER="${{TEXT_FILTER}}drawtext=text='Making memories':fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,11,20)'"

ffmpeg -i "$TEMP_DIR/video_no_audio.mp4" -vf "$TEXT_FILTER" -c:v libx264 -preset fast \\
    "$TEMP_DIR/video_with_text.mp4" -y -loglevel error
echo "  ✓ Text added"

# Mix audio with fade
echo ""
echo "Adding audio..."
VIDEO_DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$TEMP_DIR/video_with_text.mp4")
FADE_OUT_START=$(echo "$VIDEO_DURATION - 0.75" | bc)

ffmpeg -i "$TEMP_DIR/video_with_text.mp4" -i "$MUSIC" \\
    -filter_complex "[1:a]afade=t=in:st=0:d=0.75,afade=t=out:st=${{FADE_OUT_START}}:d=0.75,atrim=duration=${{VIDEO_DURATION}}[a]" \\
    -map 0:v -map "[a]" \\
    -c:v copy -c:a aac -b:a 192k -shortest \\
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
echo "  ✓ BPM: {self.bpm:.1f}"
echo "  ✓ {beats_per_image} beats per image"
echo "  ✓ Avg image duration: {np.mean(durations):.3f}s (range: 1-1.5s)"
echo "  ✓ Images synced to beat"
echo "  ✓ 9:16 cropped to fill"
echo "  ✓ Static images (no motion)"
echo "  ✓ Audio fade: 0.75s"
echo ""
echo "View: open $OUTPUT_DIR/smart_beat_sync.mp4"
echo "============================================================"
'''

        return bash_script

def main():
    script_dir = Path(__file__).parent
    music_path = script_dir / "music.mp3"

    if not music_path.exists():
        print(f"Error: {music_path} not found")
        sys.exit(1)

    # Get images
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.webp', '*.avif']:
        image_files.extend(script_dir.glob(ext))

    num_images = len(image_files)
    print(f"Found {num_images} images")

    if num_images == 0:
        print("Error: No images found")
        sys.exit(1)

    # Target duration (can be changed)
    target_duration = 15
    if len(sys.argv) > 1:
        target_duration = float(sys.argv[1])

    print(f"Target duration: {target_duration}s")
    print("")

    # Initialize analyzer
    analyzer = SmartBeatSync(str(music_path), target_duration=target_duration)

    # Determine optimal beats per image
    beats_per_image = analyzer.determine_beats_per_image()

    # Calculate clip durations
    durations, beat_positions, num_clips = analyzer.calculate_clip_durations(
        beats_per_image,
        num_images
    )

    # Generate bash script
    print("\n📝 Generating bash script...")
    bash_script = analyzer.generate_bash_script(durations, beat_positions, num_clips, beats_per_image)

    output_script = script_dir / "auto-generated-beat-sync.sh"
    output_script.write_text(bash_script)
    output_script.chmod(0o755)

    print(f"  ✓ Script saved: {output_script}")

    # Execute the script
    print("\n🎬 Executing video generation...")
    print("")

    result = subprocess.run(['bash', str(output_script)], cwd=script_dir)

    if result.returncode == 0:
        print("\n✅ Success!")
    else:
        print("\n❌ Failed")
        sys.exit(1)

if __name__ == "__main__":
    main()

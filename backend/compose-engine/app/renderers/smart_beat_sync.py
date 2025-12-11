"""
Smart Beat Synchronization for Fast-Cut Videos

Automatically determines optimal beats-per-image to keep slide duration
in the 1-1.5 second range while synchronizing to music beats.

Features:
- Adapts to any BPM (fast or slow)
- Works with variable target durations (6s, 8s, 13s, 15s, etc.)
- Handles variable number of images
- Ensures transitions always happen on beats
"""

import logging
from typing import List, Tuple, Optional
import numpy as np

logger = logging.getLogger(__name__)


class SmartBeatSync:
    """
    Intelligent beat synchronization system.

    Given:
    - BPM and beat times from audio analysis
    - Target video duration
    - Number of images

    Determines:
    - How many beats each image should last (1, 2, 3, or 4 beats)
    - Exact duration for each clip based on actual beat timings
    - How many images to use to fit target duration
    """

    def __init__(
        self,
        bpm: float,
        beat_times: List[float],
        target_duration: float,
        num_images: int,
        min_slide_duration: float = 1.0,
        max_slide_duration: float = 1.5,
    ):
        """
        Initialize smart beat sync.

        Args:
            bpm: Beats per minute from audio analysis
            beat_times: List of exact beat times in seconds
            target_duration: Target video duration in seconds
            num_images: Number of images available
            min_slide_duration: Minimum duration per image (default 1.0s)
            max_slide_duration: Maximum duration per image (default 1.5s)
        """
        self.bpm = bpm
        self.beat_times = np.array(beat_times)
        self.target_duration = target_duration
        self.num_images = num_images
        self.min_slide_duration = min_slide_duration
        self.max_slide_duration = max_slide_duration

        # Calculate beat interval
        self.beat_interval = 60.0 / bpm

        logger.info(f"[SmartBeatSync] Initialized with BPM={bpm:.1f}, "
                   f"beat_interval={self.beat_interval:.3f}s, "
                   f"target_duration={target_duration}s, "
                   f"num_images={num_images}")

    def determine_beats_per_image(self) -> int:
        """
        Determine optimal number of beats each image should last.

        Goal: Keep slide duration in range (1.0-1.5s)

        Returns:
            Beats per image (1, 2, 3, or 4)
        """
        # Try different beats-per-image options
        options = []

        for beats in [1, 2, 3, 4]:
            duration = self.beat_interval * beats

            # Score based on how well it fits in target range
            if self.min_slide_duration <= duration <= self.max_slide_duration:
                # Perfect fit - highest score
                score = 100
            elif duration < self.min_slide_duration:
                # Too fast - penalize based on distance from minimum
                distance = self.min_slide_duration - duration
                score = max(0, 50 - (distance * 50))
            else:
                # Too slow - penalize based on distance from maximum
                distance = duration - self.max_slide_duration
                score = max(0, 50 - (distance * 30))

            options.append({
                'beats': beats,
                'duration': duration,
                'score': score
            })

        # Choose option with highest score
        best = max(options, key=lambda x: x['score'])

        logger.info(f"[SmartBeatSync] Beats-per-image analysis:")
        for opt in options:
            marker = "✓" if opt == best else " "
            logger.info(f"  {marker} {opt['beats']} beats = {opt['duration']:.3f}s (score: {opt['score']:.1f})")

        logger.info(f"[SmartBeatSync] Selected: {best['beats']} beats per image ({best['duration']:.3f}s avg)")

        return best['beats']

    def calculate_clip_durations(
        self,
        beats_per_image: Optional[int] = None
    ) -> Tuple[List[float], List[float], int]:
        """
        Calculate exact duration for each clip based on beat timings.

        Args:
            beats_per_image: Number of beats per image (auto-detect if None)

        Returns:
            Tuple of:
            - durations: List of clip durations in seconds
            - beat_positions: List of beat positions where clips start
            - num_clips: Number of clips to use
        """
        if beats_per_image is None:
            beats_per_image = self.determine_beats_per_image()

        # Find beats within target duration
        beats_in_target = self.beat_times[self.beat_times <= self.target_duration]

        # Maximum number of images that fit
        max_images = len(beats_in_target) // beats_per_image

        # Use minimum of available images and what fits
        num_clips = min(self.num_images, max_images)

        logger.info(f"[SmartBeatSync] Clip calculation:")
        logger.info(f"  Beats in {self.target_duration}s: {len(beats_in_target)}")
        logger.info(f"  Max images that fit: {max_images}")
        logger.info(f"  Images available: {self.num_images}")
        logger.info(f"  Using: {num_clips} images")

        # Calculate exact duration for each clip
        durations = []
        beat_positions = []

        for i in range(num_clips):
            start_beat_idx = i * beats_per_image
            end_beat_idx = start_beat_idx + beats_per_image

            if end_beat_idx < len(self.beat_times):
                start_time = self.beat_times[start_beat_idx]
                end_time = self.beat_times[end_beat_idx]
                duration = end_time - start_time

                durations.append(float(duration))
                beat_positions.append(float(start_time))

        if durations:
            actual_duration = sum(durations)
            avg_duration = np.mean(durations)
            min_dur = min(durations)
            max_dur = max(durations)

            logger.info(f"[SmartBeatSync] Duration stats:")
            logger.info(f"  Total video duration: {actual_duration:.3f}s")
            logger.info(f"  Average per image: {avg_duration:.3f}s")
            logger.info(f"  Range: {min_dur:.3f}s - {max_dur:.3f}s")

        return durations, beat_positions, num_clips

    def get_sync_info(self) -> dict:
        """
        Get complete synchronization information.

        Returns:
            Dictionary with:
            - beats_per_image: Number of beats per image
            - durations: List of clip durations
            - beat_positions: List of beat start positions
            - num_clips: Number of clips
            - avg_duration: Average clip duration
            - total_duration: Total video duration
        """
        beats_per_image = self.determine_beats_per_image()
        durations, beat_positions, num_clips = self.calculate_clip_durations(beats_per_image)

        return {
            'beats_per_image': beats_per_image,
            'durations': durations,
            'beat_positions': beat_positions,
            'num_clips': num_clips,
            'avg_duration': float(np.mean(durations)) if durations else 0,
            'total_duration': sum(durations),
            'bpm': self.bpm,
            'beat_interval': self.beat_interval,
        }


def calculate_smart_beat_durations(
    bpm: float,
    beat_times: List[float],
    target_duration: float,
    num_images: int,
    min_slide_duration: float = 1.0,
    max_slide_duration: float = 1.5,
) -> Tuple[List[float], int]:
    """
    Helper function to calculate smart beat-synced clip durations.

    Args:
        bpm: Beats per minute
        beat_times: List of beat times in seconds
        target_duration: Target video duration
        num_images: Number of images available
        min_slide_duration: Min duration per slide (default 1.0s)
        max_slide_duration: Max duration per slide (default 1.5s)

    Returns:
        Tuple of (durations, num_clips)
    """
    sync = SmartBeatSync(
        bpm=bpm,
        beat_times=beat_times,
        target_duration=target_duration,
        num_images=num_images,
        min_slide_duration=min_slide_duration,
        max_slide_duration=max_slide_duration,
    )

    durations, _, num_clips = sync.calculate_clip_durations()
    return durations, num_clips

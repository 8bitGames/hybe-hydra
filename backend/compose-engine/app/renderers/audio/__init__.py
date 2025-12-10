"""FFmpeg audio processing."""

from .audio_processor import build_audio_filter_chain, AudioProcessor

__all__ = ["build_audio_filter_chain", "AudioProcessor"]

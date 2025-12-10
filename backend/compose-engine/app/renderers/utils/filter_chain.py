"""FFmpeg filter chain builder utility."""

from typing import List, Optional


class FilterChainBuilder:
    """Builder for constructing complex FFmpeg filter chains.

    Helps manage complex filter_complex graphs with proper stream labeling.

    Example:
        builder = FilterChainBuilder()
        builder.add_input_filter(0, "scale=1080:1920", "scaled0")
        builder.add_input_filter(1, "scale=1080:1920", "scaled1")
        builder.add_filter("[scaled0][scaled1]", "xfade=transition=fade:duration=0.5", "out")
        print(builder.build())
        # Output: [0:v]scale=1080:1920[scaled0];[1:v]scale=1080:1920[scaled1];[scaled0][scaled1]xfade=transition=fade:duration=0.5[out]
    """

    def __init__(self):
        self.filters: List[str] = []
        self._output_label: Optional[str] = None

    def add_input_filter(
        self,
        input_index: int,
        filter_str: str,
        output_label: str,
        stream_type: str = "v",
    ) -> "FilterChainBuilder":
        """Add a filter applied to an input stream.

        Args:
            input_index: Input file index (0, 1, 2, ...)
            filter_str: FFmpeg filter string (e.g., "scale=1080:1920")
            output_label: Label for output stream (e.g., "scaled0")
            stream_type: Stream type - 'v' for video, 'a' for audio

        Returns:
            Self for chaining
        """
        self.filters.append(f"[{input_index}:{stream_type}]{filter_str}[{output_label}]")
        self._output_label = output_label
        return self

    def add_filter(
        self,
        input_labels: str,
        filter_str: str,
        output_label: str,
    ) -> "FilterChainBuilder":
        """Add a filter with explicit input labels.

        Args:
            input_labels: Input stream labels (e.g., "[v0][v1]")
            filter_str: FFmpeg filter string
            output_label: Label for output stream

        Returns:
            Self for chaining
        """
        self.filters.append(f"{input_labels}{filter_str}[{output_label}]")
        self._output_label = output_label
        return self

    def add_chain(
        self,
        input_label: str,
        filters: List[str],
        output_label: str,
    ) -> "FilterChainBuilder":
        """Add a chain of filters in sequence.

        Args:
            input_label: Input stream label (e.g., "[v0]" or just "v0")
            filters: List of filter strings to chain
            output_label: Label for final output

        Returns:
            Self for chaining
        """
        # Normalize input label
        if not input_label.startswith("["):
            input_label = f"[{input_label}]"

        filter_chain = ",".join(filters)
        self.filters.append(f"{input_label}{filter_chain}[{output_label}]")
        self._output_label = output_label
        return self

    def build(self) -> str:
        """Build the complete filter_complex string.

        Returns:
            Complete filter_complex argument value
        """
        return ";".join(self.filters)

    @property
    def output_label(self) -> Optional[str]:
        """Get the last output label."""
        return self._output_label


def build_xfade_chain(
    num_clips: int,
    transition: str = "fade",
    duration: float = 0.5,
    clip_duration: float = 0.6,
) -> str:
    """Build xfade filter chain for multiple clips.

    Creates a chain of xfade filters to transition between clips.

    Args:
        num_clips: Number of input clips
        transition: xfade transition type
        duration: Transition duration in seconds
        clip_duration: Duration of each clip (for offset calculation)

    Returns:
        Complete filter_complex string

    Example for 4 clips:
        [0:v][1:v]xfade=transition=fade:duration=0.5:offset=0.1[v0];
        [v0][2:v]xfade=transition=fade:duration=0.5:offset=0.6[v1];
        [v1][3:v]xfade=transition=fade:duration=0.5:offset=1.1[v2]
    """
    if num_clips < 2:
        return ""

    filters = []

    for i in range(num_clips - 1):
        if i == 0:
            input_a = "[0:v]"
            input_b = "[1:v]"
        else:
            input_a = f"[v{i-1}]"
            input_b = f"[{i+1}:v]"

        # Calculate offset: when the transition starts
        # First transition starts at (clip_duration - transition_duration)
        # Each subsequent starts after another (clip_duration - transition_duration)
        offset = (i + 1) * clip_duration - (i + 1) * duration

        output_label = f"v{i}" if i < num_clips - 2 else "out"

        filter_str = (
            f"{input_a}{input_b}xfade="
            f"transition={transition}:"
            f"duration={duration}:"
            f"offset={offset:.3f}"
            f"[{output_label}]"
        )
        filters.append(filter_str)

    return ";".join(filters)


def escape_ffmpeg_text(text: str) -> str:
    """Escape special characters for FFmpeg text filters.

    FFmpeg's drawtext filter requires escaping of:
    - Single quotes (')
    - Colons (:)
    - Backslashes (\\)

    Args:
        text: Original text

    Returns:
        Escaped text safe for FFmpeg
    """
    # Order matters: escape backslashes first
    text = text.replace("\\", "\\\\")
    text = text.replace("'", "'\\''")
    text = text.replace(":", "\\:")
    return text

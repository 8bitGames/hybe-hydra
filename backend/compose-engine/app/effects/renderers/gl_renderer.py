"""GL Transitions Renderer - Uses OpenGL shaders for high-quality transitions.

Renders GL Transitions (https://gl-transitions.com/) using OSMesa for headless rendering.
Supports 100+ transition effects with customizable parameters.
"""

import os
import ctypes
import logging
import tempfile
import subprocess
from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

# Import GL Transitions library
from app.effects.glsl.gl_transitions_lib import GL_TRANSITIONS, get_available_transitions as get_gl_transitions

logger = logging.getLogger(__name__)

# Set OSMesa as the OpenGL platform before importing OpenGL
os.environ['PYOPENGL_PLATFORM'] = 'osmesa'

try:
    from OpenGL import GL
    from OpenGL.osmesa import OSMesaCreateContext, OSMesaMakeCurrent, OSMesaDestroyContext, OSMESA_RGBA
    GL_AVAILABLE = True
except ImportError:
    GL_AVAILABLE = False
    logger.warning("PyOpenGL not available, GL Transitions disabled")


# GL Transitions GLSL shader templates
VERTEX_SHADER = """
#version 330 core
layout (location = 0) in vec2 position;
layout (location = 1) in vec2 texCoord;
out vec2 uv;

void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    uv = texCoord;
}
"""

FRAGMENT_SHADER_TEMPLATE = """
#version 330 core
in vec2 uv;
out vec4 fragColor;

uniform sampler2D from;
uniform sampler2D to;
uniform float progress;
uniform float ratio;

vec4 getFromColor(vec2 uv) {{
    return texture(from, uv);
}}

vec4 getToColor(vec2 uv) {{
    return texture(to, uv);
}}

// GL Transition code inserted here
{transition_code}

void main() {{
    fragColor = transition(uv);
}}
"""

# GL Transitions are now imported from gl_transitions_lib.py
# Contains 50+ transitions from https://gl-transitions.com/


@dataclass
class GLClipSegment:
    """Represents a video/image segment for GL processing."""
    path: str
    duration: float
    start_time: float = 0.0


class GLTransitionRenderer:
    """Renders video transitions using OpenGL shaders."""

    def __init__(self, width: int = 1080, height: int = 1920):
        """
        Initialize GL renderer.

        Args:
            width: Output width
            height: Output height
        """
        self.width = width
        self.height = height
        self._ctx = None
        self._buffer = None
        self._initialized = False
        self._shader_cache: Dict[str, int] = {}

    def is_available(self) -> bool:
        """Check if GL rendering is available."""
        if not GL_AVAILABLE:
            return False
        try:
            self._init_context()
            return self._initialized
        except Exception as e:
            logger.warning(f"GL rendering not available: {e}")
            return False

    def _init_context(self):
        """Initialize OSMesa OpenGL context."""
        if self._initialized:
            return

        try:
            self._ctx = OSMesaCreateContext(OSMESA_RGBA, None)
            if not self._ctx:
                raise RuntimeError("Failed to create OSMesa context")

            self._buffer = (ctypes.c_ubyte * (self.width * self.height * 4))()

            if not OSMesaMakeCurrent(self._ctx, self._buffer, GL.GL_UNSIGNED_BYTE, self.width, self.height):
                raise RuntimeError("Failed to make OSMesa context current")

            self._initialized = True
            logger.info(f"GL renderer initialized: {self.width}x{self.height}")

        except Exception as e:
            logger.error(f"Failed to initialize GL renderer: {e}")
            raise

    def _compile_shader(self, source: str, shader_type: int) -> int:
        """Compile a shader."""
        shader = GL.glCreateShader(shader_type)
        GL.glShaderSource(shader, source)
        GL.glCompileShader(shader)

        if not GL.glGetShaderiv(shader, GL.GL_COMPILE_STATUS):
            error = GL.glGetShaderInfoLog(shader).decode()
            GL.glDeleteShader(shader)
            raise RuntimeError(f"Shader compilation failed: {error}")

        return shader

    def _create_program(self, transition_code: str) -> int:
        """Create shader program for a transition."""
        cache_key = hash(transition_code)
        if cache_key in self._shader_cache:
            return self._shader_cache[cache_key]

        vertex_shader = self._compile_shader(VERTEX_SHADER, GL.GL_VERTEX_SHADER)
        fragment_source = FRAGMENT_SHADER_TEMPLATE.format(transition_code=transition_code)
        fragment_shader = self._compile_shader(fragment_source, GL.GL_FRAGMENT_SHADER)

        program = GL.glCreateProgram()
        GL.glAttachShader(program, vertex_shader)
        GL.glAttachShader(program, fragment_shader)
        GL.glLinkProgram(program)

        if not GL.glGetProgramiv(program, GL.GL_LINK_STATUS):
            error = GL.glGetProgramInfoLog(program).decode()
            GL.glDeleteProgram(program)
            raise RuntimeError(f"Program linking failed: {error}")

        GL.glDeleteShader(vertex_shader)
        GL.glDeleteShader(fragment_shader)

        self._shader_cache[cache_key] = program
        return program

    def _load_texture(self, image_path: str) -> int:
        """Load an image as OpenGL texture."""
        img = Image.open(image_path).convert('RGBA')
        img = img.resize((self.width, self.height), Image.LANCZOS)
        img_data = np.array(img, dtype=np.uint8)

        texture = GL.glGenTextures(1)
        GL.glBindTexture(GL.GL_TEXTURE_2D, texture)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE)
        GL.glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA, self.width, self.height, 0,
                        GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, img_data)

        return texture

    def render_transition_frame(
        self,
        from_texture: int,
        to_texture: int,
        transition_name: str,
        progress: float,
    ) -> np.ndarray:
        """
        Render a single frame of a transition.

        Args:
            from_texture: Source texture ID
            to_texture: Destination texture ID
            transition_name: Name of GL transition
            progress: Transition progress (0.0 to 1.0)

        Returns:
            RGBA image as numpy array
        """
        self._init_context()

        # Get transition code
        transition_code = GL_TRANSITIONS.get(transition_name, GL_TRANSITIONS["gl_fade"])
        program = self._create_program(transition_code)

        GL.glUseProgram(program)

        # Set uniforms
        GL.glUniform1f(GL.glGetUniformLocation(program, "progress"), progress)
        GL.glUniform1f(GL.glGetUniformLocation(program, "ratio"), self.width / self.height)

        # Bind textures
        GL.glActiveTexture(GL.GL_TEXTURE0)
        GL.glBindTexture(GL.GL_TEXTURE_2D, from_texture)
        GL.glUniform1i(GL.glGetUniformLocation(program, "from"), 0)

        GL.glActiveTexture(GL.GL_TEXTURE1)
        GL.glBindTexture(GL.GL_TEXTURE_2D, to_texture)
        GL.glUniform1i(GL.glGetUniformLocation(program, "to"), 1)

        # Setup vertex data (full-screen quad)
        vertices = np.array([
            -1.0, -1.0, 0.0, 0.0,
            1.0, -1.0, 1.0, 0.0,
            -1.0, 1.0, 0.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
        ], dtype=np.float32)

        vao = GL.glGenVertexArrays(1)
        vbo = GL.glGenBuffers(1)

        GL.glBindVertexArray(vao)
        GL.glBindBuffer(GL.GL_ARRAY_BUFFER, vbo)
        GL.glBufferData(GL.GL_ARRAY_BUFFER, vertices.nbytes, vertices, GL.GL_STATIC_DRAW)

        GL.glVertexAttribPointer(0, 2, GL.GL_FLOAT, GL.GL_FALSE, 16, ctypes.c_void_p(0))
        GL.glEnableVertexAttribArray(0)
        GL.glVertexAttribPointer(1, 2, GL.GL_FLOAT, GL.GL_FALSE, 16, ctypes.c_void_p(8))
        GL.glEnableVertexAttribArray(1)

        # Render
        GL.glViewport(0, 0, self.width, self.height)
        GL.glClear(GL.GL_COLOR_BUFFER_BIT)
        GL.glDrawArrays(GL.GL_TRIANGLE_STRIP, 0, 4)

        # Read pixels
        pixels = GL.glReadPixels(0, 0, self.width, self.height, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE)
        image = np.frombuffer(pixels, dtype=np.uint8).reshape(self.height, self.width, 4)
        image = np.flipud(image)  # OpenGL has Y-flipped coordinates

        # Cleanup
        GL.glDeleteBuffers(1, [vbo])
        GL.glDeleteVertexArrays(1, [vao])

        return image

    def render_transition(
        self,
        from_image_path: str,
        to_image_path: str,
        output_path: str,
        transition_name: str = "gl_fade",
        duration: float = 0.5,
        fps: int = 30,
    ) -> bool:
        """
        Render a complete transition between two images to video.

        Args:
            from_image_path: Path to source image
            to_image_path: Path to destination image
            output_path: Output video path
            transition_name: Name of GL transition
            duration: Transition duration in seconds
            fps: Frame rate

        Returns:
            True if successful
        """
        try:
            self._init_context()

            from_texture = self._load_texture(from_image_path)
            to_texture = self._load_texture(to_image_path)

            num_frames = int(duration * fps)
            frames = []

            for i in range(num_frames):
                progress = i / (num_frames - 1) if num_frames > 1 else 1.0
                frame = self.render_transition_frame(from_texture, to_texture, transition_name, progress)
                frames.append(frame)

            # Write frames to video using FFmpeg
            self._write_frames_to_video(frames, output_path, fps)

            # Cleanup textures
            GL.glDeleteTextures(2, [from_texture, to_texture])

            logger.info(f"GL transition rendered: {transition_name} ({duration}s)")
            return True

        except Exception as e:
            logger.error(f"GL transition render failed: {e}")
            return False

    def _write_frames_to_video(self, frames: List[np.ndarray], output_path: str, fps: int):
        """Write frames to video file using FFmpeg."""
        height, width = frames[0].shape[:2]

        cmd = [
            'ffmpeg', '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-s', f'{width}x{height}',
            '-pix_fmt', 'rgba',
            '-r', str(fps),
            '-i', '-',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
            output_path
        ]

        process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

        for frame in frames:
            process.stdin.write(frame.tobytes())

        process.stdin.close()
        process.wait()

        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg failed: {process.stderr.read().decode()}")

    def get_available_transitions(self) -> List[str]:
        """Get list of available GL transitions."""
        return get_gl_transitions()

    def cleanup(self):
        """Clean up OpenGL resources."""
        if self._ctx:
            OSMesaDestroyContext(self._ctx)
            self._ctx = None
            self._initialized = False


# Singleton instance
_gl_renderer: Optional[GLTransitionRenderer] = None


def get_gl_renderer(width: int = 1080, height: int = 1920) -> Optional[GLTransitionRenderer]:
    """Get or create GL renderer instance."""
    global _gl_renderer
    if _gl_renderer is None:
        try:
            _gl_renderer = GLTransitionRenderer(width, height)
            if not _gl_renderer.is_available():
                _gl_renderer = None
        except Exception as e:
            logger.warning(f"GL renderer unavailable: {e}")
            _gl_renderer = None
    return _gl_renderer


def is_gl_available() -> bool:
    """Check if GL rendering is available."""
    renderer = get_gl_renderer()
    return renderer is not None and renderer.is_available()

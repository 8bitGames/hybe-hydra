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

# Built-in GL Transitions (subset of most popular ones)
GL_TRANSITIONS = {
    "gl_fade": """
vec4 transition(vec2 uv) {
    return mix(getFromColor(uv), getToColor(uv), progress);
}
""",
    "gl_crosswarp": """
vec4 transition(vec2 p) {
    float x = progress;
    x = smoothstep(.0, 1.0, (x * 2.0 + p.x - 1.0));
    return mix(getFromColor((p - .5) * (1.0 - x) + .5), getToColor((p - .5) * x + .5), x);
}
""",
    "gl_dreamy": """
vec4 transition(vec2 p) {
    return mix(getFromColor(p + progress * sign(p - 0.5)), getToColor(p), progress);
}
""",
    "gl_circle": """
vec4 transition(vec2 uv) {
    float dist = distance(uv, vec2(0.5));
    float radius = progress * 1.414;
    if (dist < radius) {
        return getToColor(uv);
    }
    return getFromColor(uv);
}
""",
    "gl_circleopen": """
vec4 transition(vec2 uv) {
    float dist = distance(uv, vec2(0.5));
    float radius = progress * 1.414;
    float softness = 0.02;
    float t = smoothstep(radius - softness, radius + softness, dist);
    return mix(getToColor(uv), getFromColor(uv), t);
}
""",
    "gl_directional": """
uniform vec2 direction;
vec4 transition(vec2 uv) {
    vec2 dir = normalize(vec2(1.0, -1.0));
    vec2 p = uv + progress * sign(dir);
    vec2 f = fract(p);
    return mix(getToColor(f), getFromColor(f), step(0.0, p.y) * step(p.y, 1.0) * step(0.0, p.x) * step(p.x, 1.0));
}
""",
    "gl_pixelize": """
uniform ivec2 squaresMin;
uniform int steps;
vec4 transition(vec2 uv) {
    ivec2 squares = ivec2(32, 32);
    float d = min(progress, 1.0 - progress);
    float dist = d > 0.0 ? ceil(d * float(10)) / float(10) : d;
    vec2 squareSize = 2.0 * dist / vec2(squares);
    vec2 p = dist > 0.0 ? (floor(uv / squareSize) + 0.5) * squareSize : uv;
    return mix(getFromColor(p), getToColor(p), progress);
}
""",
    "gl_radial": """
vec4 transition(vec2 uv) {
    vec2 center = vec2(0.5);
    float angle = atan(uv.y - center.y, uv.x - center.x);
    float normalizedAngle = (angle + 3.14159) / (2.0 * 3.14159);
    if (normalizedAngle < progress) {
        return getToColor(uv);
    }
    return getFromColor(uv);
}
""",
    "gl_swirl": """
vec4 transition(vec2 uv) {
    float radius = 1.0;
    float angle = progress * 3.14159 * 2.0;
    vec2 center = vec2(0.5);
    vec2 tc = uv - center;
    float dist = length(tc);
    if (dist < radius) {
        float percent = (radius - dist) / radius;
        float theta = percent * percent * angle;
        float s = sin(theta);
        float c = cos(theta);
        tc = vec2(dot(tc, vec2(c, -s)), dot(tc, vec2(s, c)));
    }
    return mix(getFromColor(tc + center), getToColor(uv), progress);
}
""",
    "gl_wipeleft": """
vec4 transition(vec2 uv) {
    return mix(getFromColor(uv), getToColor(uv), step(1.0 - progress, uv.x));
}
""",
    "gl_wiperight": """
vec4 transition(vec2 uv) {
    return mix(getFromColor(uv), getToColor(uv), step(uv.x, progress));
}
""",
    "gl_wipeup": """
vec4 transition(vec2 uv) {
    return mix(getFromColor(uv), getToColor(uv), step(1.0 - progress, uv.y));
}
""",
    "gl_wipedown": """
vec4 transition(vec2 uv) {
    return mix(getFromColor(uv), getToColor(uv), step(uv.y, progress));
}
""",
    "gl_slideright": """
vec4 transition(vec2 uv) {
    return mix(getFromColor(uv), getToColor(uv - vec2(1.0 - progress, 0.0)), step(1.0 - progress, uv.x));
}
""",
    "gl_slideleft": """
vec4 transition(vec2 uv) {
    return mix(getFromColor(uv), getToColor(uv + vec2(1.0 - progress, 0.0)), step(uv.x, progress));
}
""",
    "gl_zoomin": """
vec4 transition(vec2 uv) {
    float zoom = 1.0 + progress * 0.5;
    vec2 center = vec2(0.5);
    vec2 fromUV = (uv - center) / zoom + center;
    return mix(getFromColor(fromUV), getToColor(uv), progress);
}
""",
    "gl_cube": """
vec4 transition(vec2 p) {
    float persp = 0.7;
    float unzoom = 0.3;
    float reflection = 0.4;
    float floating = 3.0;

    vec2 fromP = (p - vec2(progress, 0.0)) / vec2(1.0 - progress, 1.0);
    vec2 toP = (p - vec2(0.0, 0.0)) / vec2(progress, 1.0);

    if (progress < 0.5) {
        if (fromP.x >= 0.0 && fromP.x <= 1.0) {
            return getFromColor(fromP);
        }
        return getToColor(toP);
    } else {
        if (toP.x >= 0.0 && toP.x <= 1.0) {
            return getToColor(toP);
        }
        return getFromColor(fromP);
    }
}
""",
    "gl_glitchdisplace": """
vec4 transition(vec2 uv) {
    float strength = 0.1;
    float displace = strength * (1.0 - 2.0 * abs(progress - 0.5));
    float y = uv.y;
    float x = uv.x;
    float noise = fract(sin(y * 1000.0 + progress * 100.0) * 10000.0);

    if (noise < 0.3) {
        x += displace * (noise - 0.15);
    }

    vec2 fromUV = vec2(clamp(x, 0.0, 1.0), y);
    vec2 toUV = vec2(clamp(x - displace, 0.0, 1.0), y);

    return mix(getFromColor(fromUV), getToColor(toUV), progress);
}
""",
    "gl_doorway": """
vec4 transition(vec2 p) {
    float reflection = 0.4;
    float perspective = 0.4;
    float depth = 3.0;

    float middleX = 0.5;
    float pr = progress;

    if (p.x < middleX) {
        float openX = middleX * (1.0 - pr * 2.0);
        if (p.x < openX) {
            return getFromColor(p);
        }
        return getToColor(vec2((p.x - openX) / (middleX - openX) * 0.5, p.y));
    } else {
        float openX = middleX + (1.0 - middleX) * pr * 2.0;
        if (p.x > openX) {
            return getFromColor(p);
        }
        return getToColor(vec2(0.5 + (p.x - middleX) / (openX - middleX) * 0.5, p.y));
    }
}
""",
    "gl_heart": """
vec4 transition(vec2 uv) {
    vec2 center = vec2(0.5, 0.4);
    float scale = progress * 2.0;

    vec2 p = (uv - center) / scale;
    float x = p.x;
    float y = p.y;

    float heart = pow(x * x + y * y - 1.0, 3.0) - x * x * y * y * y;

    if (heart < 0.0) {
        return getToColor(uv);
    }
    return getFromColor(uv);
}
""",
    "gl_kaleidoscope": """
vec4 transition(vec2 uv) {
    float speed = 1.0;
    float angle = progress * 3.14159 * 2.0 * speed;
    float segments = 6.0;

    vec2 center = vec2(0.5);
    vec2 p = uv - center;
    float r = length(p);
    float a = atan(p.y, p.x);

    a = mod(a, 3.14159 * 2.0 / segments);
    a = abs(a - 3.14159 / segments);

    p = r * vec2(cos(a + angle), sin(a + angle)) + center;
    p = clamp(p, 0.0, 1.0);

    return mix(getFromColor(p), getToColor(uv), progress);
}
""",
    "gl_mosaic": """
vec4 transition(vec2 uv) {
    int endx = 2;
    int endy = -1;

    float pr = progress;
    vec2 pos = floor(uv * 10.0);
    float offset = pos.x + pos.y * 10.0;
    float localPr = clamp((pr - offset / 100.0) * 2.0, 0.0, 1.0);

    return mix(getFromColor(uv), getToColor(uv), localPr);
}
""",
    "gl_bounce": """
vec4 transition(vec2 uv) {
    float shadowColour = 0.6;
    float shadowHeight = 0.075;
    float bounces = 3.0;

    float t = progress;
    float sideWidth = (1.0 - t) / 2.0;

    vec2 p = uv;
    float y = abs(sin(t * 3.14159 * bounces)) * (1.0 - t);

    if (uv.x < sideWidth || uv.x > 1.0 - sideWidth) {
        return getFromColor(uv);
    }

    vec2 fromP = vec2((uv.x - sideWidth) / (1.0 - 2.0 * sideWidth), uv.y + y);
    if (fromP.y > 1.0) {
        return getToColor(uv);
    }

    return getFromColor(fromP);
}
""",
}


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
        return list(GL_TRANSITIONS.keys())

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

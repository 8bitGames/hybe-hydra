"""GL Transitions Library - GLSL shader collection.

All transitions from: https://github.com/gl-transitions/gl-transitions
MIT Licensed.

Each transition is a GLSL function that takes UV coordinates and returns
the blended color between getFromColor(uv) and getToColor(uv) based on
the uniform 'progress' (0.0 to 1.0).
"""

# =============================================================================
# GL TRANSITIONS GLSL SHADERS
# =============================================================================
# Each shader expects these uniforms to be set:
#   - progress: float (0.0 to 1.0)
#   - ratio: float (width/height aspect ratio)
#   - from: sampler2D (source texture)
#   - to: sampler2D (destination texture)
#
# And these functions to be available:
#   - getFromColor(vec2 uv): Get color from source
#   - getToColor(vec2 uv): Get color from destination
# =============================================================================

GL_TRANSITIONS = {
    # =========================================================================
    # BASIC TRANSITIONS
    # =========================================================================
    "gl_fade": """
vec4 transition(vec2 uv) {
    return mix(getFromColor(uv), getToColor(uv), progress);
}
""",

    "gl_fadecolor": """
uniform vec3 color; // = vec3(0.0, 0.0, 0.0)
uniform float colorPhase; // = 0.4
vec4 transition(vec2 uv) {
    vec3 c = vec3(0.0, 0.0, 0.0);
    float ph = 0.4;
    return mix(
        mix(vec4(c, 1.0), getFromColor(uv), smoothstep(1.0 - ph, 0.0, progress)),
        mix(vec4(c, 1.0), getToColor(uv), smoothstep(ph, 1.0, progress)),
        progress
    );
}
""",

    "gl_fadegrayscale": """
vec4 transition(vec2 uv) {
    vec4 fromColor = getFromColor(uv);
    vec4 toColor = getToColor(uv);
    float gray1 = dot(fromColor.rgb, vec3(0.299, 0.587, 0.114));
    float gray2 = dot(toColor.rgb, vec3(0.299, 0.587, 0.114));
    vec4 grayFrom = vec4(vec3(gray1), fromColor.a);
    vec4 grayTo = vec4(vec3(gray2), toColor.a);
    float m = abs(progress - 0.5) * 2.0;
    vec4 mixed = mix(grayFrom, grayTo, progress);
    return mix(mixed, mix(fromColor, toColor, progress), m);
}
""",

    # =========================================================================
    # WIPE TRANSITIONS
    # =========================================================================
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

    "gl_directionalwipe": """
uniform vec2 direction; // = vec2(1.0, -1.0)
uniform float smoothness; // = 0.5
const vec2 center = vec2(0.5, 0.5);
vec4 transition(vec2 uv) {
    vec2 dir = normalize(vec2(1.0, -1.0));
    float sm = 0.5;
    vec2 v = dir * (progress - 0.5);
    float d = dot(uv - center, v) + 0.5;
    float m = smoothstep(-sm, 0.0, d - progress);
    return mix(getFromColor(uv), getToColor(uv), 1.0 - m);
}
""",

    # =========================================================================
    # SLIDE TRANSITIONS
    # =========================================================================
    "gl_slideright": """
vec4 transition(vec2 uv) {
    vec2 p = uv - vec2(progress, 0.0);
    if (p.x < 0.0) {
        return getToColor(uv);
    }
    return getFromColor(p);
}
""",

    "gl_slideleft": """
vec4 transition(vec2 uv) {
    vec2 p = uv + vec2(progress, 0.0);
    if (p.x > 1.0) {
        return getToColor(uv);
    }
    return getFromColor(p);
}
""",

    "gl_slideup": """
vec4 transition(vec2 uv) {
    vec2 p = uv + vec2(0.0, progress);
    if (p.y > 1.0) {
        return getToColor(uv);
    }
    return getFromColor(p);
}
""",

    "gl_slidedown": """
vec4 transition(vec2 uv) {
    vec2 p = uv - vec2(0.0, progress);
    if (p.y < 0.0) {
        return getToColor(uv);
    }
    return getFromColor(p);
}
""",

    # =========================================================================
    # CIRCLE TRANSITIONS
    # =========================================================================
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

    "gl_circleclose": """
vec4 transition(vec2 uv) {
    float dist = distance(uv, vec2(0.5));
    float radius = (1.0 - progress) * 1.414;
    float softness = 0.02;
    float t = smoothstep(radius - softness, radius + softness, dist);
    return mix(getFromColor(uv), getToColor(uv), t);
}
""",

    # =========================================================================
    # ZOOM TRANSITIONS
    # =========================================================================
    "gl_zoomin": """
vec4 transition(vec2 uv) {
    float zoom = 1.0 + progress * 0.5;
    vec2 center = vec2(0.5);
    vec2 fromUV = (uv - center) / zoom + center;
    return mix(getFromColor(fromUV), getToColor(uv), progress);
}
""",

    "gl_zoomout": """
vec4 transition(vec2 uv) {
    float zoom = 1.0 + (1.0 - progress) * 0.5;
    vec2 center = vec2(0.5);
    vec2 toUV = (uv - center) / zoom + center;
    return mix(getFromColor(uv), getToColor(toUV), progress);
}
""",

    "gl_crosszoom": """
// Author: rectalogic - MIT License
const float PI = 3.141592653589793;
float Linear_ease(in float begin, in float change, in float duration, in float time) {
    return change * time / duration + begin;
}
float Exponential_easeInOut(in float begin, in float change, in float duration, in float time) {
    if (time == 0.0) return begin;
    else if (time == duration) return begin + change;
    time = time / (duration / 2.0);
    if (time < 1.0) return change / 2.0 * pow(2.0, 10.0 * (time - 1.0)) + begin;
    return change / 2.0 * (-pow(2.0, -10.0 * (time - 1.0)) + 2.0) + begin;
}
float Sinusoidal_easeInOut(in float begin, in float change, in float duration, in float time) {
    return -change / 2.0 * (cos(PI * time / duration) - 1.0) + begin;
}
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
vec3 crossFade(in vec2 uv, in float dissolve) {
    return mix(getFromColor(uv).rgb, getToColor(uv).rgb, dissolve);
}
vec4 transition(vec2 uv) {
    float strength = 0.4;
    vec2 center = vec2(Linear_ease(0.25, 0.5, 1.0, progress), 0.5);
    float dissolve = Exponential_easeInOut(0.0, 1.0, 1.0, progress);
    float str = Sinusoidal_easeInOut(0.0, strength, 0.5, progress);
    vec3 color = vec3(0.0);
    float total = 0.0;
    vec2 toCenter = center - uv;
    float offset = rand(uv);
    for (float t = 0.0; t <= 40.0; t++) {
        float percent = (t + offset) / 40.0;
        float weight = 4.0 * (percent - percent * percent);
        color += crossFade(uv + toCenter * percent * str, dissolve) * weight;
        total += weight;
    }
    return vec4(color / total, 1.0);
}
""",

    "gl_zoomincircles": """
vec4 transition(vec2 uv) {
    float dist = distance(uv, vec2(0.5));
    float zoom = 1.0 + progress * 0.3;
    vec2 center = vec2(0.5);
    vec2 fromUV = (uv - center) / zoom + center;
    float radius = progress * 1.414;
    if (dist < radius) {
        return getToColor(uv);
    }
    return getFromColor(fromUV);
}
""",

    # =========================================================================
    # ROTATION TRANSITIONS
    # =========================================================================
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

    "gl_pinwheel": """
// Author: Mr Speaker - MIT License
vec4 transition(vec2 uv) {
    float speed = 2.0;
    vec2 p = uv;
    float circPos = atan(p.y - 0.5, p.x - 0.5) + progress * speed;
    float modPos = mod(circPos, 3.1415 / 4.0);
    float signed = sign(progress - modPos);
    return mix(getToColor(p), getFromColor(p), step(signed, 0.5));
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

    "gl_rotate_scale_fade": """
vec4 transition(vec2 uv) {
    float rotations = 1.0;
    float scale = 8.0;
    vec2 center = vec2(0.5);
    float angle = progress * rotations * 3.14159 * 2.0;
    float c = cos(angle);
    float s = sin(angle);
    float zoom = mix(1.0, 1.0 / scale, progress);
    vec2 p = (uv - center) * mat2(c, s, -s, c) / zoom + center;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) {
        return getToColor(uv);
    }
    return mix(getFromColor(p), getToColor(uv), progress);
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

    # =========================================================================
    # CUBE / 3D TRANSITIONS
    # =========================================================================
    "gl_cube": """
vec4 transition(vec2 p) {
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

    "gl_pagecurl": """
const float MIN_AMOUNT = -0.16;
const float MAX_AMOUNT = 1.5;
float amount = progress * (MAX_AMOUNT - MIN_AMOUNT) + MIN_AMOUNT;
const float PI = 3.141592653589793;
const float cylinderRadius = 1.0 / PI / 2.0;
vec3 cylinderCenter = vec3(amount, 0.5, 0.0);
float A = amount;
float B = cylinderRadius;
float C = cylinderCenter.z;

vec3 hitPoint(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float d = C + B;
    if (x >= A && x <= d) {
        float theta = asin((x - A) / B);
        float py = (1.0 - theta / (PI / 2.0)) * y;
        return vec3(x, py, (1.0 - cos(theta)) * B);
    }
    return vec3(x, y, 0.0);
}

vec4 transition(vec2 uv) {
    vec3 hp = hitPoint(uv);
    if (uv.x < A) {
        return getToColor(uv);
    }
    vec2 fromUV = vec2(hp.x, hp.y);
    if (fromUV.x < 0.0 || fromUV.x > 1.0 || fromUV.y < 0.0 || fromUV.y > 1.0) {
        return getToColor(uv);
    }
    float shadow = 1.0 - smoothstep(0.0, 0.1, hp.z);
    return getFromColor(fromUV) * shadow;
}
""",

    "gl_doorway": """
vec4 transition(vec2 p) {
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

    # =========================================================================
    # PIXEL / MOSAIC TRANSITIONS
    # =========================================================================
    "gl_pixelize": """
uniform ivec2 squaresMin; // = ivec2(20, 20)
uniform int steps; // = 50
vec4 transition(vec2 uv) {
    ivec2 squares = ivec2(20, 20);
    float d = min(progress, 1.0 - progress);
    float dist = d > 0.0 ? ceil(d * float(50)) / float(50) : d;
    vec2 squareSize = 2.0 * dist / vec2(squares);
    vec2 p = dist > 0.0 ? (floor(uv / squareSize) + 0.5) * squareSize : uv;
    return mix(getFromColor(p), getToColor(p), progress);
}
""",

    "gl_mosaic": """
// Author: Xaychru - MIT License
#define PI 3.14159265358979323
#define POW2(X) X*X
#define POW3(X) X*X*X
float Rand(vec2 v) {
    return fract(sin(dot(v.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
vec2 Rotate(vec2 v, float a) {
    mat2 rm = mat2(cos(a), -sin(a), sin(a), cos(a));
    return rm * v;
}
float CosInterpolation(float x) {
    return -cos(x * PI) / 2.0 + 0.5;
}
vec4 transition(vec2 uv) {
    int endx = 2;
    int endy = -1;
    vec2 p = uv - 0.5;
    float rpr = (progress * 2.0 - 1.0);
    float z = -(rpr * rpr * 2.0) + 3.0;
    float az = abs(z);
    vec2 rp = p * az;
    rp += mix(vec2(0.5, 0.5), vec2(float(endx) + 0.5, float(endy) + 0.5), POW2(CosInterpolation(progress)));
    vec2 mrp = fract(rp);
    vec2 crp = rp;
    bool onEnd = int(floor(crp.x)) == endx && int(floor(crp.y)) == endy;
    if (!onEnd) {
        float ang = float(int(Rand(floor(crp)) * 4.0)) * 0.5 * PI;
        mrp = vec2(0.5) + Rotate(mrp - vec2(0.5), ang);
    }
    if (onEnd || Rand(floor(crp)) > 0.5) {
        return getToColor(mrp);
    } else {
        return getFromColor(mrp);
    }
}
""",

    "gl_randomsquares": """
uniform ivec2 size; // = ivec2(10, 10)
uniform float smoothness; // = 0.5
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
vec4 transition(vec2 uv) {
    ivec2 sz = ivec2(10, 10);
    float sm = 0.5;
    float r = rand(floor(vec2(sz) * uv));
    float m = smoothstep(0.0, -sm, r - (progress * (1.0 + sm)));
    return mix(getFromColor(uv), getToColor(uv), m);
}
""",

    "gl_hexagonalize": """
uniform int steps; // = 50
uniform float horizontalHexagons; // = 20.0
float hexDist(vec2 a, vec2 b) {
    vec2 p = abs(b - a);
    float s = 0.5;
    float c = 0.8660254;
    float diagDist = s * p.x + c * p.y;
    return max(diagDist, p.x) / c;
}
vec2 nearestHex(float s, vec2 st) {
    float h = 0.5 * s;
    float r = 0.8660254 * s;
    float b = s + 2.0 * h;
    float a = 2.0 * r;
    float m = h / r;
    vec2 sect = st / vec2(2.0 * r, h + s);
    vec2 sectPxl = fract(sect) * vec2(2.0 * r, h + s);
    float arone = mod(floor(sect.y), 2.0);
    vec2 coord = floor(sect);
    if (arone == 1.0) {
        if (sectPxl.y < h) {
            if (sectPxl.x < r) {
                if (sectPxl.y < h - sectPxl.x * m) {
                    coord.x -= 1.0;
                    coord.y -= 1.0;
                }
            } else {
                if (sectPxl.y < (sectPxl.x - r) * m) {
                    coord.y -= 1.0;
                }
            }
        }
    } else {
        if (sectPxl.x > r) {
            if (sectPxl.y < (2.0 * r - sectPxl.x) * m) {
                coord.y -= 1.0;
            }
        } else {
            if (sectPxl.y < sectPxl.x * m) {
                coord.y -= 1.0;
            } else {
                coord.x -= 1.0;
            }
        }
    }
    float xoff = arone * r;
    return vec2(coord.x * 2.0 * r - xoff + r, coord.y * (h + s) + h);
}
vec4 transition(vec2 uv) {
    float hz = 20.0;
    float d = min(progress, 1.0 - progress);
    float dist = d > 0.0 ? ceil(d * float(50)) / float(50) : d;
    float s = dist * ratio / hz;
    vec2 hex = nearestHex(s, uv * vec2(ratio, 1.0));
    vec2 p = hex / vec2(ratio, 1.0);
    return mix(getFromColor(p), getToColor(p), progress);
}
""",

    # =========================================================================
    # DISTORTION TRANSITIONS
    # =========================================================================
    "gl_crosswarp": """
vec4 transition(vec2 p) {
    float x = progress;
    x = smoothstep(0.0, 1.0, (x * 2.0 + p.x - 1.0));
    return mix(getFromColor((p - 0.5) * (1.0 - x) + 0.5), getToColor((p - 0.5) * x + 0.5), x);
}
""",

    "gl_dreamy": """
vec4 transition(vec2 p) {
    return mix(getFromColor(p + progress * sign(p - 0.5)), getToColor(p), progress);
}
""",

    "gl_dreamy_zoom": """
uniform float rotation; // = 6.0
uniform float scale; // = 1.2
vec4 transition(vec2 uv) {
    float rot = 6.0;
    float scl = 1.2;
    float phase = progress < 0.5 ? progress * 2.0 : (progress - 0.5) * 2.0;
    float angle = phase * rot;
    float zoom = 1.0 + phase * (scl - 1.0);
    vec2 center = vec2(0.5);
    float c = cos(angle);
    float s = sin(angle);
    vec2 p = (uv - center) * mat2(c, s, -s, c) / zoom + center;
    p = clamp(p, 0.0, 1.0);
    if (progress < 0.5) {
        return getFromColor(p);
    }
    return getToColor(p);
}
""",

    "gl_ripple": """
uniform float amplitude; // = 100.0
uniform float speed; // = 50.0
vec4 transition(vec2 uv) {
    float amp = 100.0;
    float spd = 50.0;
    vec2 dir = uv - vec2(0.5);
    float dist = length(dir);
    vec2 offset = dir * sin(dist * amp - progress * spd) * 0.03;
    return mix(getFromColor(uv + offset), getToColor(uv), smoothstep(0.2, 1.0, progress));
}
""",

    "gl_morph": """
uniform float strength; // = 0.1
vec4 transition(vec2 uv) {
    float str = 0.1;
    vec4 ca = getFromColor(uv);
    vec4 cb = getToColor(uv);
    vec2 oa = (((ca.rg + ca.b) * 0.5) * 2.0 - 1.0);
    vec2 ob = (((cb.rg + cb.b) * 0.5) * 2.0 - 1.0);
    vec2 oc = mix(oa, ob, 0.5) * str;
    float w0 = progress;
    float w1 = 1.0 - w0;
    return mix(getFromColor(uv + oc * w0), getToColor(uv - oc * w1), progress);
}
""",

    "gl_squeeze": """
uniform float colorSeparation; // = 0.04
vec4 transition(vec2 uv) {
    float cs = 0.04;
    float y = 0.5 + (uv.y - 0.5) / (progress < 0.5 ? 1.0 - progress * 2.0 : (progress - 0.5) * 2.0);
    if (y < 0.0 || y > 1.0) {
        return getToColor(uv);
    }
    if (progress < 0.5) {
        return getFromColor(vec2(uv.x, y));
    }
    return getToColor(uv);
}
""",

    "gl_waterdrop": """
uniform float amplitude; // = 30.0
uniform float speed; // = 30.0
vec4 transition(vec2 uv) {
    float amp = 30.0;
    float spd = 30.0;
    vec2 center = vec2(0.5);
    vec2 toCenter = center - uv;
    float dist = length(toCenter);
    float finalProgress = progress < 0.5 ? progress * 2.0 : (1.0 - progress) * 2.0;
    float wave = cos(dist * amp - progress * spd) * finalProgress;
    vec2 offset = toCenter * wave * 0.1;
    return mix(getFromColor(uv + offset), getToColor(uv), progress);
}
""",

    # =========================================================================
    # GLITCH TRANSITIONS
    # =========================================================================
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

    "gl_glitchmemories": """
vec4 transition(vec2 uv) {
    vec4 color = vec4(0.0);
    float count = 8.0;
    for (float i = 0.0; i < count; i++) {
        float p = (progress - i / count) / (1.0 / count);
        p = clamp(p, 0.0, 1.0);
        float r = fract(sin(i * 12.9898) * 43758.5453);
        vec2 offset = vec2(r - 0.5, fract(r * 13.0) - 0.5) * 0.1 * p;
        color += mix(getFromColor(uv + offset), getToColor(uv), p);
    }
    return color / count;
}
""",

    # =========================================================================
    # SHAPE TRANSITIONS
    # =========================================================================
    "gl_heart": """
vec4 transition(vec2 uv) {
    vec2 center = vec2(0.5, 0.4);
    float scale = progress * 2.0;
    if (scale < 0.01) return getFromColor(uv);
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

    "gl_bowtiehorizontal": """
// Author: huynx - MIT License
const float SQRT_2 = 1.414213562373;
const vec2 c1 = vec2(0.0, 0.0);
const vec2 c2 = vec2(1.0, 1.0);

float check(vec2 p1, vec2 p2, vec2 p3) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

bool PointInTriangle(vec2 pt, vec2 p1, vec2 p2, vec2 p3) {
    bool b1 = check(pt, p1, p2) < 0.0;
    bool b2 = check(pt, p2, p3) < 0.0;
    bool b3 = check(pt, p3, p1) < 0.0;
    return ((b1 == b2) && (b2 == b3));
}

bool in_left_triangle(vec2 p) {
    vec2 vertex1 = vec2(progress, 0.5);
    vec2 vertex2 = c1;
    vec2 vertex3 = vec2(0.0, 1.0);
    return PointInTriangle(p, vertex1, vertex2, vertex3);
}

bool in_right_triangle(vec2 p) {
    vec2 vertex1 = vec2(1.0 - progress, 0.5);
    vec2 vertex2 = c2;
    vec2 vertex3 = vec2(1.0, 0.0);
    return PointInTriangle(p, vertex1, vertex2, vertex3);
}

float blur_edge(vec2 bot1, vec2 move_point) {
    float d = distance(bot1, move_point);
    return min(1.0, d * 10.0);
}

vec4 transition(vec2 uv) {
    if (in_left_triangle(uv)) {
        float blur = blur_edge(c1, vec2(progress, 0.5));
        if (blur < 1.0) {
            return mix(getToColor(uv), getFromColor(uv), blur);
        }
        return getToColor(uv);
    }
    if (in_right_triangle(uv)) {
        float blur = blur_edge(c2, vec2(1.0 - progress, 0.5));
        if (blur < 1.0) {
            return mix(getToColor(uv), getFromColor(uv), blur);
        }
        return getToColor(uv);
    }
    return getFromColor(uv);
}
""",

    "gl_bowtievertical": """
const vec2 c1 = vec2(0.0, 0.0);
const vec2 c2 = vec2(1.0, 1.0);

float check(vec2 p1, vec2 p2, vec2 p3) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

bool PointInTriangle(vec2 pt, vec2 p1, vec2 p2, vec2 p3) {
    bool b1 = check(pt, p1, p2) < 0.0;
    bool b2 = check(pt, p2, p3) < 0.0;
    bool b3 = check(pt, p3, p1) < 0.0;
    return ((b1 == b2) && (b2 == b3));
}

bool in_top_triangle(vec2 p) {
    vec2 vertex1 = vec2(0.5, progress);
    vec2 vertex2 = vec2(0.0, 0.0);
    vec2 vertex3 = vec2(1.0, 0.0);
    return PointInTriangle(p, vertex1, vertex2, vertex3);
}

bool in_bottom_triangle(vec2 p) {
    vec2 vertex1 = vec2(0.5, 1.0 - progress);
    vec2 vertex2 = vec2(1.0, 1.0);
    vec2 vertex3 = vec2(0.0, 1.0);
    return PointInTriangle(p, vertex1, vertex2, vertex3);
}

vec4 transition(vec2 uv) {
    if (in_top_triangle(uv) || in_bottom_triangle(uv)) {
        return getToColor(uv);
    }
    return getFromColor(uv);
}
""",

    "gl_windowblinds": """
vec4 transition(vec2 uv) {
    float count = 10.0;
    float y = fract(uv.y * count);
    float p = progress * 2.0;
    if (p > 1.0) {
        p = 2.0 - p;
        if (y < p) {
            return getToColor(uv);
        }
        return mix(getFromColor(uv), getToColor(uv), (progress - 0.5) * 2.0);
    }
    if (y < p) {
        return vec4(0.0, 0.0, 0.0, 1.0);
    }
    return getFromColor(uv);
}
""",

    # =========================================================================
    # SPECIAL EFFECTS TRANSITIONS
    # =========================================================================
    "gl_burn": """
uniform vec3 color; // = vec3(0.9, 0.4, 0.2)
vec4 transition(vec2 uv) {
    vec3 c = vec3(0.9, 0.4, 0.2);
    float t = progress * 3.0;
    if (t < 1.0) {
        float edge = 1.0 - t;
        float dist = distance(uv, vec2(0.5));
        if (dist > edge) {
            float f = smoothstep(edge, edge + 0.1, dist);
            return mix(getFromColor(uv), vec4(c * (1.0 - f), 1.0), f);
        }
        return getFromColor(uv);
    } else if (t < 2.0) {
        return vec4(c * (2.0 - t), 1.0);
    } else {
        float edge = t - 2.0;
        float dist = distance(uv, vec2(0.5));
        if (dist < edge) {
            return getToColor(uv);
        }
        return vec4(c * (3.0 - t), 1.0);
    }
}
""",

    "gl_filmburn": """
uniform float seed; // = 2.31
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
vec4 transition(vec2 uv) {
    float sd = 2.31;
    float burnIn = 0.6 * (1.0 - pow(abs(progress - 0.5) * 2.0, 2.0));
    float noiseR = rand(uv + vec2(sd, progress)) * burnIn;
    float noiseG = rand(uv + vec2(sd + 0.1, progress)) * burnIn;
    float noiseB = rand(uv + vec2(sd + 0.2, progress)) * burnIn;
    vec3 burnColor = vec3(noiseR, noiseG * 0.5, noiseB * 0.2);
    vec4 from = getFromColor(uv);
    vec4 to = getToColor(uv);
    vec4 mixed = mix(from, to, progress);
    return vec4(mixed.rgb + burnColor, mixed.a);
}
""",

    "gl_tvstatic": """
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
vec4 transition(vec2 uv) {
    float t = abs(progress - 0.5) * 2.0;
    if (t > 0.8) {
        return mix(getFromColor(uv), getToColor(uv), progress);
    }
    float noise = rand(uv + vec2(progress));
    vec4 staticColor = vec4(vec3(noise), 1.0);
    if (progress < 0.5) {
        return mix(getFromColor(uv), staticColor, 1.0 - t);
    }
    return mix(staticColor, getToColor(uv), t);
}
""",

    "gl_colorphase": """
uniform vec4 fromStep; // = vec4(0.0, 0.2, 0.4, 0.0)
uniform vec4 toStep; // = vec4(0.6, 0.8, 1.0, 1.0)
vec4 transition(vec2 uv) {
    vec4 a = getFromColor(uv);
    vec4 b = getToColor(uv);
    return mix(a, b, smoothstep(0.0, 1.0, progress * 1.2 - uv.x * 0.4));
}
""",

    "gl_luminance_melt": """
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
vec4 transition(vec2 uv) {
    vec4 from = getFromColor(uv);
    vec4 to = getToColor(uv);
    float luminance = dot(from.rgb, vec3(0.299, 0.587, 0.114));
    float threshold = progress * 1.2;
    float noise = rand(uv) * 0.2;
    if (luminance + noise < threshold) {
        float melt = smoothstep(threshold - 0.2, threshold, luminance + noise);
        vec2 meltUV = uv + vec2(0.0, (1.0 - melt) * 0.1);
        return getToColor(clamp(meltUV, 0.0, 1.0));
    }
    return from;
}
""",

    # =========================================================================
    # ADVANCED TRANSITIONS
    # =========================================================================
    "gl_displacement": """
uniform float displacementStrength; // = 0.5
vec4 transition(vec2 uv) {
    float str = 0.5;
    float d = str * sin(progress * 3.14159);
    vec4 from = getFromColor(uv);
    vec4 to = getToColor(uv);
    float luminance = dot(from.rgb, vec3(0.299, 0.587, 0.114));
    vec2 offset = vec2(luminance - 0.5) * d;
    return mix(getFromColor(uv + offset), getToColor(uv - offset), progress);
}
""",

    "gl_perlin": """
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
vec4 transition(vec2 uv) {
    float scale = 4.0;
    float n = noise(uv * scale + progress * 2.0);
    float threshold = progress * 1.2;
    if (n < threshold) {
        return getToColor(uv);
    }
    return getFromColor(uv);
}
""",

    "gl_wind": """
uniform float size; // = 0.2
vec4 transition(vec2 uv) {
    float sz = 0.2;
    float r = rand(vec2(floor(uv.y / sz), 0.0));
    float m = smoothstep(0.0, 0.01, uv.x - progress - r * 0.3);
    return mix(getToColor(uv), getFromColor(uv), m);
}
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
""",

    "gl_polkadotscurtain": """
uniform float dots; // = 20.0
vec2 center = vec2(0.0, 0.0);
vec4 transition(vec2 uv) {
    float d = 20.0;
    bool inside = distance(fract(uv * d), vec2(0.5)) < progress / 2.0;
    if (inside) {
        return getToColor(uv);
    }
    return getFromColor(uv);
}
""",

    "gl_bounce": """
vec4 transition(vec2 uv) {
    float t = progress;
    float sideWidth = (1.0 - t) / 2.0;
    vec2 p = uv;
    float y = abs(sin(t * 3.14159 * 3.0)) * (1.0 - t);
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

    "gl_angular": """
uniform float startingAngle; // = 90.0
vec4 transition(vec2 uv) {
    float sa = 90.0;
    float PI = 3.141592653589793;
    float offset = sa * PI / 180.0;
    float angle = atan(uv.y - 0.5, uv.x - 0.5) + offset;
    float normalizedAngle = (angle + PI) / (2.0 * PI);
    normalizedAngle = fract(normalizedAngle);
    return mix(getFromColor(uv), getToColor(uv), step(normalizedAngle, progress));
}
""",

    "gl_directional_scaled": """
uniform vec2 direction; // = vec2(0.0, 1.0)
uniform float scale; // = 0.7
vec4 transition(vec2 uv) {
    vec2 dir = normalize(vec2(0.0, 1.0));
    float scl = 0.7;
    float pr = progress;
    vec2 fromPos = uv + dir * pr;
    vec2 toPos = uv + dir * (pr - 1.0);
    float scaleMult = 1.0 + (1.0 - scl) * pr;
    fromPos = (fromPos - 0.5) * scaleMult + 0.5;
    toPos = (toPos - 0.5) / scaleMult + 0.5;
    if (all(greaterThanEqual(toPos, vec2(0.0))) && all(lessThanEqual(toPos, vec2(1.0)))) {
        return getToColor(toPos);
    }
    if (all(greaterThanEqual(fromPos, vec2(0.0))) && all(lessThanEqual(fromPos, vec2(1.0)))) {
        return getFromColor(fromPos);
    }
    return getToColor(uv);
}
""",

    "gl_stereo_viewer": """
uniform float zoom; // = 0.88
uniform float cornerRadius; // = 0.22
vec4 transition(vec2 uv) {
    float zm = 0.88;
    float cr = 0.22;
    float stage = progress < 0.5 ? progress * 2.0 : (progress - 0.5) * 2.0;
    float scale = 1.0 - (1.0 - zm) * stage;
    vec2 center = vec2(0.5);
    vec2 scaledUV = (uv - center) / scale + center;
    vec2 fromCenter = abs(scaledUV - center) * 2.0;
    float d = max(fromCenter.x, fromCenter.y);
    float cornerDist = length(max(fromCenter - vec2(1.0 - cr), 0.0));
    bool inFrame = d < 1.0 && cornerDist < cr;
    if (!inFrame) {
        return vec4(0.0, 0.0, 0.0, 1.0);
    }
    if (progress < 0.5) {
        return getFromColor(scaledUV);
    }
    return getToColor(scaledUV);
}
""",
}

# Helper to get all available transition names
def get_available_transitions():
    """Get list of all available GL transition names."""
    return list(GL_TRANSITIONS.keys())

# Helper to check if a transition exists
def has_transition(name: str) -> bool:
    """Check if a transition exists by name."""
    return name in GL_TRANSITIONS

# Helper to get transition code
def get_transition_code(name: str) -> str:
    """Get GLSL code for a transition, returns fade as fallback."""
    return GL_TRANSITIONS.get(name, GL_TRANSITIONS["gl_fade"])

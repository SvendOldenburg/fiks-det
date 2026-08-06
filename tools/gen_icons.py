#!/usr/bin/env python3
"""Generate Fiks det's app icons: a cream house mark on warm terracotta.

Pure standard library (math + zlib + struct) so it runs anywhere with no
pip installs. Renders at 4x supersample and box-downscales for clean edges.
Pattern adapted from anvil/tools/gen_icons.py (itself from lumen's).

    python tools/gen_icons.py

Writes icons/icon-192.png, icon-512.png, icon-maskable-512.png, icon-180.png.

The house glyph is compact and roughly centered, so unlike Anvil's wide
horizontal anvil mark it doesn't need much extra shrink for the maskable
safe zone -- MASKABLE_SCALE is a gentler pull-in than NORMAL_SCALE, not a
drastic one.

All geometry uses fixed coordinates, so regenerating is deterministic.
"""
import math
import os
import struct
import zlib

# Palette. theme_color/background_color in manifest.json match BG_TOP/ACCENT.
BG_TOP    = (0xF2, 0x8A, 0x5C)  # warm coral, top of the gradient
BG_BOTTOM = (0xE1, 0x67, 0x3E)  # deeper terracotta, bottom
ROOF      = (0xFF, 0xF7, 0xEC)  # bright warm cream
WALL      = (0xFB, 0xE9, 0xD6)  # slightly deeper cream, subtle depth vs roof
CUTOUT    = (0xC2, 0x4F, 0x2D)  # door / window -- recessed, shadowed opening

SS = 4  # supersample factor

NORMAL_SCALE   = 0.86
MASKABLE_SCALE = 0.68

# House geometry in mark space [-1, 1], y down. Fixed, never derived at runtime.
ROOF_APEX  = (0.0, -0.60)
ROOF_LEFT  = (-0.48, -0.08)
ROOF_RIGHT = (0.48, -0.08)
WALL_BOX   = (-0.36, 0.36, -0.08, 0.48)    # x0, x1, y0, y1
DOOR_BOX   = (-0.11, 0.11, 0.16, 0.48)
WINDOW_BOX = (-0.27, -0.11, 0.02, 0.16)


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def in_triangle(px, py, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    d1 = sign((px, py), a, b)
    d2 = sign((px, py), b, c)
    d3 = sign((px, py), c, a)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def in_box(px, py, box):
    x0, x1, y0, y1 = box
    return x0 <= px <= x1 and y0 <= py <= y1


def shade(nx, ny):
    """RGB tuple for a point in normalized mark space, [-1, 1], y down."""
    t = (ny + 1) / 2
    out = lerp(BG_TOP, BG_BOTTOM, max(0.0, min(1.0, t)))

    if in_triangle(nx, ny, ROOF_APEX, ROOF_LEFT, ROOF_RIGHT):
        out = ROOF
    if in_box(nx, ny, WALL_BOX):
        out = WALL
    if in_box(nx, ny, DOOR_BOX) or in_box(nx, ny, WINDOW_BOX):
        out = CUTOUT

    return out


def render(size, scale):
    """Return raw PNG scanlines (filter byte 0, 8-bit RGB) for one icon."""
    big = size * SS
    half = big / 2.0
    acc = [[0.0, 0.0, 0.0] for _ in range(size * size)]
    for by in range(big):
        ny = ((by + 0.5 - half) / half) / scale
        oy = by // SS
        for bx in range(big):
            nx = ((bx + 0.5 - half) / half) / scale
            r, g, b = shade(nx, ny)
            idx = oy * size + (bx // SS)
            acc[idx][0] += r
            acc[idx][1] += g
            acc[idx][2] += b
    n = SS * SS
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            p = acc[y * size + x]
            raw.append(max(0, min(255, int(p[0] / n + 0.5))))
            raw.append(max(0, min(255, int(p[1] / n + 0.5))))
            raw.append(max(0, min(255, int(p[2] / n + 0.5))))
    return bytes(raw)


def write_png(path, size, raw):
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    idat = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


# name, size, mark scale
TARGETS = [
    ("icon-192.png",          192, NORMAL_SCALE),
    ("icon-512.png",          512, NORMAL_SCALE),
    ("icon-maskable-512.png", 512, MASKABLE_SCALE),
    ("icon-180.png",          180, NORMAL_SCALE),
]


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, "icons")
    os.makedirs(out, exist_ok=True)
    for name, size, scale in TARGETS:
        write_png(os.path.join(out, name), size, render(size, scale))
        print(f"wrote icons/{name}")


if __name__ == "__main__":
    main()

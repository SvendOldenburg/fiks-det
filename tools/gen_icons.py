#!/usr/bin/env python3
"""Generate Fiks det's app icons: a pale heart mark on cobalt blue.

Pure standard library (zlib + struct) so it runs anywhere with no pip
installs. Renders at 4x supersample and box-downscales for clean edges.
Pattern adapted from anvil/tools/gen_icons.py (itself from lumen's).

    python tools/gen_icons.py

Writes icons/icon-192.png, icon-512.png, icon-maskable-512.png, icon-180.png.

The heart glyph is compact and centered, so unlike Anvil's wide horizontal
anvil mark it doesn't need much extra shrink for the maskable safe zone --
MASKABLE_SCALE is a gentler pull-in than NORMAL_SCALE, not a drastic one.

All geometry uses fixed coordinates, so regenerating is deterministic.
"""
import os
import struct
import zlib

# Palette. theme_color/background_color in manifest.json match BG_TOP/the app
# accent; the heart is tinted cool rather than cream so it belongs to the same
# palette as the app's surfaces.
BG_TOP     = (0x1F, 0x5F, 0xC8)  # brighter cobalt, top of the gradient
BG_BOTTOM  = (0x00, 0x3A, 0x8F)  # deeper cobalt, bottom
HEART_TOP  = (0xFD, 0xFE, 0xFF)  # near-white, top of the glyph
HEART_BOT  = (0xDD, 0xE8, 0xF8)  # pale blue-white, subtle depth toward the point

SS = 4  # supersample factor

NORMAL_SCALE   = 0.86
MASKABLE_SCALE = 0.68

# Heart geometry, drawn from the implicit curve (x^2 + y^2 - 1)^3 = x^2 * y^3
# rather than stitched from primitives -- one inequality, no seams between
# lobes and point. In its own space that curve spans x in [-1.13, 1.13] and
# y in [-1.0, 1.22] (y UP, point at the bottom), so it sits off-centre by
# HEART_CY and is scaled by HEART_K to land inside the mark's [-1, 1] box.
HEART_K  = 0.55   # mark units per heart unit -> glyph half-extent ~0.62
HEART_CY = 0.11   # heart-space y of the glyph's visual centre
HEART_Y0 = 1.22   # top of the glyph in heart space, for the fill gradient
HEART_Y1 = -1.0   # bottom point, ditto


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def heart_at(nx, ny):
    """Heart-space (hx, hy) for a point in mark space. y flips: mark y is down."""
    return nx / HEART_K, -ny / HEART_K + HEART_CY


def in_heart(hx, hy):
    s = hx * hx + hy * hy - 1.0
    return s * s * s - hx * hx * hy * hy * hy <= 0.0


def shade(nx, ny):
    """RGB tuple for a point in normalized mark space, [-1, 1], y down."""
    t = (ny + 1) / 2
    out = lerp(BG_TOP, BG_BOTTOM, max(0.0, min(1.0, t)))

    hx, hy = heart_at(nx, ny)
    if in_heart(hx, hy):
        ht = (HEART_Y0 - hy) / (HEART_Y0 - HEART_Y1)
        out = lerp(HEART_TOP, HEART_BOT, max(0.0, min(1.0, ht)))

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

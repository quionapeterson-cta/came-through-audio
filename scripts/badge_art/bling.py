"""Bedazzled CTA badge renderer: cobalt / crystal / gold rhinestone pavé on shapes, white sticker edge, 4K.

Shapes are grayscale masks (L images, 255 = inside). A badge is a stack of layers drawn bottom to top.
Run designs.py to build the art; this module holds the drawing tools only.
"""
from __future__ import annotations

import math
import random
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

S = 4096  # final size (4K)
SS = 2  # supersampling for smooth mask edges
ROOT = Path(__file__).resolve().parents[2]
FONT_BOLD = str(ROOT / "public/fonts/Poppins-Bold.ttf")
FONT_SEMI = str(ROOT / "public/fonts/Poppins-SemiBold.ttf")
FONT_NOTES = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"  # Poppins has no music-note glyphs

# Brand stones: Cobalt #004AAD / Electric Cobalt #4D8CFF, Gold #FFD700, crystal (platinum-white), onyx (#0b0b0b).
STONES = {
    "cobalt": ((0x00, 0x1E, 0x52), (0x00, 0x4A, 0xAD), (0x4D, 0x8C, 0xFF), (0xC9, 0xDC, 0xFF)),
    "crystal": ((0x8E, 0x95, 0xA3), (0xD5, 0xD9, 0xE0), (0xF4, 0xF6, 0xFA), (0xFF, 0xFF, 0xFF)),
    "gold": ((0x7A, 0x52, 0x00), (0xC9, 0x9A, 0x06), (0xFF, 0xD7, 0x00), (0xFF, 0xF4, 0xB8)),
    "onyx": ((0x02, 0x02, 0x04), (0x12, 0x12, 0x16), (0x3A, 0x3D, 0x48), (0xB8, 0xC4, 0xE0)),
}
METAL = {
    "gold": ((0x6B, 0x47, 0x00), (0xB8, 0x86, 0x0B), (0xFF, 0xD7, 0x00), (0xFF, 0xF1, 0xA6)),
    "silver": ((0x5E, 0x63, 0x6E), (0xA9, 0xAE, 0xB8), (0xE5, 0xE4, 0xE2), (0xFF, 0xFF, 0xFF)),
    "navy": ((0x00, 0x08, 0x1C), (0x00, 0x16, 0x40), (0x00, 0x2E, 0x73), (0x3A, 0x6F, 0xD8)),
    "black": ((0x05, 0x05, 0x07), (0x0B, 0x0B, 0x0B), (0x22, 0x23, 0x2A), (0x4A, 0x4C, 0x58)),
}


# ---------- masks ----------

class Mask:
    """Draw at 2x, read back at 4K."""

    def __init__(self) -> None:
        self.im = Image.new("L", (S * SS, S * SS), 0)
        self.d = ImageDraw.Draw(self.im)

    @staticmethod
    def _p(v):
        return [c * SS for c in v]

    def ellipse(self, box, fill=255):
        self.d.ellipse(self._p(box), fill=fill); return self

    def circle(self, cx, cy, r, fill=255):
        return self.ellipse((cx - r, cy - r, cx + r, cy + r), fill)

    def rect(self, box, radius=0, fill=255):
        self.d.rounded_rectangle(self._p(box), radius=radius * SS, fill=fill); return self

    def poly(self, pts, fill=255):
        self.d.polygon([(x * SS, y * SS) for x, y in pts], fill=fill); return self

    def line(self, pts, width, fill=255):
        p = [(x * SS, y * SS) for x, y in pts]
        self.d.line(p, fill=fill, width=int(width * SS), joint="curve")
        for x, y in (p[0], p[-1]):
            r = width * SS / 2
            self.d.ellipse((x - r, y - r, x + r, y + r), fill=fill)
        return self

    def ring(self, cx, cy, r_out, r_in):
        self.circle(cx, cy, r_out); self.circle(cx, cy, r_in, fill=0); return self

    def text(self, xy, s, size, font=FONT_BOLD, anchor="mm", fill=255, spacing=0):
        f = ImageFont.truetype(font, int(size * SS))
        if spacing:
            # letter spacing: draw character by character around the anchor centre
            widths = [f.getlength(ch) for ch in s]
            total = sum(widths) + spacing * SS * (len(s) - 1)
            x = xy[0] * SS - total / 2
            for ch, w in zip(s, widths):
                self.d.text((x + w / 2, xy[1] * SS), ch, font=f, anchor="mm", fill=fill)
                x += w + spacing * SS
        else:
            self.d.text((xy[0] * SS, xy[1] * SS), s, font=f, anchor=anchor, fill=fill)
        return self

    def arc_text(self, cx, cy, r, s, size, font=FONT_BOLD, top=True, spacing=0.0):
        """Text bent along a circle (top = reads clockwise over the top, else along the bottom)."""
        f = ImageFont.truetype(font, int(size * SS))
        widths = [f.getlength(ch) / SS + spacing for ch in s]
        total = sum(widths) - spacing
        ang = -total / 2 / r
        for ch, w in zip(s, widths):
            a = ang + (w - spacing) / 2 / r
            tile = Image.new("L", (int(size * 2 * SS),) * 2, 0)
            ImageDraw.Draw(tile).text((tile.width / 2, tile.height / 2), ch, font=f, anchor="mm", fill=255)
            if top:
                x, y = cx + r * math.sin(a), cy - r * math.cos(a)
                tile = tile.rotate(-math.degrees(a), resample=Image.BICUBIC)
            else:
                x, y = cx - r * math.sin(a), cy + r * math.cos(a)
                tile = tile.rotate(math.degrees(a), resample=Image.BICUBIC)
            self.im.paste(255, (int(x * SS - tile.width / 2), int(y * SS - tile.height / 2)), tile)
            ang += w / r
        return self

    def get(self) -> Image.Image:
        return self.im.resize((S, S), Image.LANCZOS)


def union(*ms: Image.Image) -> Image.Image:
    out = ms[0]
    for m in ms[1:]:
        out = ImageChops.lighter(out, m)
    return out


def minus(a: Image.Image, b: Image.Image) -> Image.Image:
    return ImageChops.subtract(a, b)


def grow(m: Image.Image, px: float) -> Image.Image:
    """Dilate (px > 0) or erode (px < 0) a mask by about px pixels (blur + soft threshold: fast, smooth at 4K)."""
    k = 2
    small = m.resize((S // k, S // k), Image.BILINEAR)
    b = np.asarray(small.filter(ImageFilter.GaussianBlur(abs(px) / k / 1.6)), dtype=np.float32)
    t, span = (14.0, 18.0) if px > 0 else (226.0, 18.0)
    v = np.clip((b - t) / span, 0, 1) * 255
    return Image.fromarray(v.astype(np.uint8)).resize((S, S), Image.BICUBIC)


# ---------- paint ----------

def _ramp(stops, t):
    t = np.clip(t, 0, 1) * (len(stops) - 1)
    i = np.minimum(t.astype(int), len(stops) - 2)
    f = (t - i)[..., None]
    arr = np.array(stops, dtype=np.float32)
    return arr[i] * (1 - f) + arr[i + 1] * f


@lru_cache(maxsize=16)
def _metal_base(kind: str, angle: float, bands: float) -> np.ndarray:
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    a = math.radians(angle)
    t = 0.5 + 0.5 * np.sin((xx * math.cos(a) + yy * math.sin(a)) * math.pi * 2 * bands)
    return t


def metal_fill(mask: Image.Image, kind="gold", angle=-35, bands=2.2) -> Image.Image:
    """Polished metal: banded linear gradient with a soft bevel from the mask's edge."""
    t = _metal_base(kind, angle, bands)
    bb = mask.getbbox()
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    if not bb:
        return out
    x0, y0, x1, y1 = bb
    pad = 40
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(S, x1 + pad), min(S, y1 + pad)
    sub = mask.crop((x0, y0, x1, y1))
    bevel = np.asarray(sub.filter(ImageFilter.GaussianBlur(22)), dtype=np.float32) / 255
    tt = np.clip(t[y0:y1, x0:x1] * 0.8 + (bevel - 0.5) * 0.45 + 0.1, 0, 1)
    rgb = _ramp(METAL[kind], tt)
    tile = Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")
    tile.putalpha(sub)
    out.paste(tile, (x0, y0))
    return out


@lru_cache(maxsize=64)
def gem_sprite(kind: str, size: int, variant: int) -> Image.Image:
    """One faceted round rhinestone."""
    n = size * 2
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    c = (n - 1) / 2
    dx, dy = (xx - c) / c, (yy - c) / c
    r = np.sqrt(dx * dx + dy * dy)
    th = np.arctan2(dy, dx) + variant * 0.37
    dark, mid, bright, white = STONES[kind]
    # facets: 8 crown facets alternate light/dark, table brighter, light from the top left
    facet = 0.5 + 0.5 * np.sign(np.sin(th * 4))
    light = 0.5 + 0.5 * (-(dx + dy) / 1.414)
    table = r < 0.45
    t = 0.12 + 0.5 * light + 0.26 * facet * (r > 0.45) + 0.3 * table * light
    t = np.where(r > 0.86, 0.08 + 0.2 * light, t)  # dark girdle
    rgb = _ramp((dark, mid, bright, white), t)
    # specular glint
    hx, hy = -0.32 + 0.05 * variant, -0.36
    spec = np.exp(-(((dx - hx) ** 2) / 0.012 + ((dy - hy) ** 2) / 0.02))
    rgb = rgb + (255 - rgb) * spec[..., None] * 0.95
    alpha = np.clip((1.0 - r) * c / 1.5, 0, 1) * 255
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8), "RGBA")
    return im.resize((size, size), Image.LANCZOS)


def pave(canvas: Image.Image, mask: Image.Image, kind="cobalt", d=46, setting="gold", seed=1, mix=None):
    """Fill a region with rhinestones on a hex grid over a metal setting.

    mix: optional {kind: weight} to sprinkle other stones in (e.g. {"crystal": .08}).
    """
    rnd = random.Random(seed)
    canvas.alpha_composite(metal_fill(mask, setting, bands=1.4))
    inner = np.asarray(grow(mask, -d * 0.45), dtype=np.uint8)
    step_x, step_y = d * 0.99, d * 0.86
    y, row = d / 2, 0
    glints: list[tuple[float, float, float]] = []
    while y < S:
        x = d / 2 + (d * 0.51 if row % 2 else 0)
        while x < S:
            xi, yi = int(x), int(y)
            if inner[yi, xi] > 128:
                k = kind
                if mix:
                    roll = rnd.random()
                    for mk, w in mix.items():
                        if roll < w:
                            k = mk; break
                        roll -= w
                size = int(d * rnd.uniform(0.9, 1.0))
                g = gem_sprite(k, size, rnd.randrange(4))
                canvas.alpha_composite(g, (int(x - size / 2), int(y - size / 2)))
                if rnd.random() < 0.025:
                    glints.append((x - size * 0.2, y - size * 0.2, size * rnd.uniform(0.5, 0.9)))
            x += step_x
        y += step_y
        row += 1
    for x, y, r in glints:
        star_glint(canvas, x, y, r)


def bead_edge(canvas: Image.Image, mask: Image.Image, width=70, kind="gold", d=None):
    """A gold bezel strip along the shape's edge, set with an evenly spaced row of round beads."""
    band = minus(mask, grow(mask, -width))
    canvas.alpha_composite(metal_fill(band, "gold" if kind == "gold" else "silver", bands=3))
    d = d or int(width * 0.92)
    mid = np.asarray(grow(mask, -width / 2), dtype=np.uint8) > 127
    edge = mid & ~(np.roll(mid, 1, 0) & np.roll(mid, -1, 0) & np.roll(mid, 1, 1) & np.roll(mid, -1, 1))
    ys, xs = np.nonzero(edge)
    cell = d
    taken: dict[tuple[int, int], list[tuple[int, int]]] = {}
    gap2 = (d * 1.04) ** 2
    order = np.lexsort((xs, ys))
    rnd = random.Random(11)
    for i in order:
        x, y = int(xs[i]), int(ys[i])
        cx, cy = x // cell, y // cell
        ok = True
        for gx in (cx - 1, cx, cx + 1):
            for gy in (cy - 1, cy, cy + 1):
                for px, py in taken.get((gx, gy), ()):
                    if (px - x) ** 2 + (py - y) ** 2 < gap2:
                        ok = False; break
                if not ok: break
            if not ok: break
        if ok:
            taken.setdefault((cx, cy), []).append((x, y))
            g = gem_sprite(kind, d, rnd.randrange(4))
            canvas.alpha_composite(g, (x - d // 2, y - d // 2))


def sticker(canvas: Image.Image, art_mask: Image.Image, edge=70) -> Image.Image:
    """White die-cut sticker border + soft shadow beneath everything drawn so far."""
    outline = grow(art_mask, edge)
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (S, S), (11, 11, 11, 0))
    shadow.putalpha(outline.point(lambda v: v * 0.45).filter(ImageFilter.GaussianBlur(40)))
    base.alpha_composite(shadow, (0, 30))
    white = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    white.putalpha(outline)
    base.alpha_composite(white)
    rim = Image.new("RGBA", (S, S), (200, 205, 214, 0))
    rim.putalpha(minus(outline, grow(outline, -8)).point(lambda v: v * 0.6))
    base.alpha_composite(rim)
    base.alpha_composite(canvas)
    return base


def solid(canvas: Image.Image, mask: Image.Image, rgb, alpha=255):
    layer = Image.new("RGBA", (S, S), (*rgb, 0))
    layer.putalpha(mask.point(lambda v: v * alpha // 255))
    canvas.alpha_composite(layer)


def deep_black(canvas: Image.Image, mask: Image.Image):
    """Glossy brand-black (#0b0b0b) enamel with a faint top sheen."""
    solid(canvas, mask, (11, 11, 11))
    yy = np.linspace(1, 0, S, dtype=np.float32)[:, None] * np.ones((1, S), np.float32)
    sheen = Image.fromarray((np.clip(yy - 0.55, 0, 1) * 40).astype(np.uint8))
    layer = Image.new("RGBA", (S, S), (77, 140, 255, 0))
    layer.putalpha(ImageChops.multiply(sheen, mask))
    canvas.alpha_composite(layer)


def star_glint(canvas: Image.Image, x, y, r):
    """Small light-catch cross on a stone, drawn directly (cheap)."""
    n = int(r * 2) | 1
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) - n // 2
    a = np.exp(-np.abs(xx) / (r * 0.05)) * np.exp(-np.abs(yy) / (r * 0.45)) + np.exp(-np.abs(yy) / (r * 0.05)) * np.exp(-np.abs(xx) / (r * 0.45))
    a = np.clip(a, 0, 1) * 255
    g = Image.fromarray(np.dstack([np.full_like(a, 255)] * 3 + [a]).astype(np.uint8), "RGBA")
    canvas.alpha_composite(g, (int(x - n // 2), int(y - n // 2)))


def sparkle(canvas: Image.Image, x, y, r, color=(255, 255, 255), alpha=255):
    """Four-point star glint."""
    m = Mask()
    k = r * 0.16
    m.poly([(x, y - r), (x + k, y - k), (x + r, y), (x + k, y + k), (x, y + r), (x - k, y + k), (x - r, y), (x - k, y - k)])
    mm = m.get()
    glow = mm.filter(ImageFilter.GaussianBlur(r / 5))
    solid(canvas, glow, color, alpha // 2)
    solid(canvas, mm, color, alpha)


def sparkles(canvas: Image.Image, region: Image.Image, n=14, rmin=18, rmax=60, seed=3, color=(255, 255, 255)):
    rnd = random.Random(seed)
    arr = np.asarray(region)
    placed = 0
    for _ in range(n * 40):
        if placed >= n:
            break
        x, y = rnd.randrange(S), rnd.randrange(S)
        if arr[y, x] > 128:
            sparkle(canvas, x, y, rnd.uniform(rmin, rmax), color)
            placed += 1


def note_glyphs(canvas: Image.Image, region: Image.Image, n=7, seed=5, kind="gold"):
    """Gold music notes floating in a region."""
    rnd = random.Random(seed)
    arr = np.asarray(region)
    m = Mask()
    placed = 0
    for _ in range(n * 60):
        if placed >= n:
            break
        x, y = rnd.randrange(S), rnd.randrange(S)
        if arr[y, x] > 200:
            m.text((x, y), rnd.choice("♪♫♬"), rnd.uniform(120, 210), font=FONT_NOTES)
            placed += 1
    nm = m.get()
    canvas.alpha_composite(metal_fill(nm, kind, bands=3))


def gold_text(canvas: Image.Image, m: Image.Image, kind="gold", outline=14, outline_rgb=(11, 11, 11)):
    """Metal lettering with a dark keyline so it reads on any background."""
    solid(canvas, grow(m, outline), outline_rgb)
    canvas.alpha_composite(metal_fill(m, kind, angle=90, bands=1.2))


def save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == ".webp":
        im.save(path, "WEBP", quality=88, method=6)
    else:
        im.save(path, optimize=True)

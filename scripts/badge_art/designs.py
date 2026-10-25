"""Builds the CTA bedazzled badge art at 4K.  python3 scripts/badge_art/designs.py [name ...]

Two looks, matching the uploaded art:
- object: the thing itself in cobalt pavé with gold trim on a white sticker edge (first credits, EP, album);
- medallion: crystal pavé ring around a black enamel face with the motif in the middle. Staff badges carry a
  "CTA TEAM" plaque so they're never mistaken for customer badges (PLAN-staff-recognition §8).
"""
from __future__ import annotations

import math
import sys

from PIL import Image

from bling import (FONT_BOLD, ROOT, S, Mask, bead_edge, deep_black, gold_text, grow, metal_fill, minus, note_glyphs,
                   pave, save, solid, sparkle, sparkles, sticker, union)

C = S // 2
OUT = ROOT / "public/icons"
FY = 2080  # centre of a medallion's face area


def blank() -> Image.Image:
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def rotated(m: Mask, deg: float, cx=C, cy=C) -> Image.Image:
    return m.get().rotate(deg, resample=Image.BICUBIC, center=(cx, cy))


# ---------- building blocks ----------

def jewel(cv, m: Image.Image, kind="cobalt", d=34, edge=34, seed=2, setting=None):
    """Pavé region with a gold bead bezel."""
    pave(cv, m, kind=kind, d=d, seed=seed, setting=setting or ("navy" if kind == "cobalt" else "silver" if kind == "crystal" else "gold"),
         mix={"crystal": 0.04} if kind == "cobalt" else None)
    if edge:
        bead_edge(cv, m, width=edge, kind="gold")


def metal(cv, m: Image.Image, kind="gold", key=10, angle=-35, bands=2.2):
    if key:
        solid(cv, grow(m, key), (11, 11, 11))
    cv.alpha_composite(metal_fill(m, kind, angle=angle, bands=bands))


def plaque(cv, text: str, y=3440, w=1250, h=300, size=150):
    """Gold name plate with black lettering (the CTA tag on the uploaded art)."""
    plate = Mask().rect((C - w / 2, y - h / 2, C + w / 2, y + h / 2), radius=60).get()
    solid(cv, grow(plate, 18), (11, 11, 11))
    cv.alpha_composite(metal_fill(plate, "gold", angle=90, bands=1.1))
    solid(cv, Mask().text((C, y + 6), text, size, spacing=size * 0.12).get(), (11, 11, 11))


def ribbon(cv, text: str, y: float, w=2600, h=420, size=210):
    """Gold banner with folded tails and black lettering."""
    t = Mask()
    for sx in (-1, 1):
        x0 = C + sx * (w / 2 - 120)
        x1 = C + sx * (w / 2 + 260)
        t.poly([(x0, y - h / 2 + 90), (x1, y - h / 2 + 90), (x1 - sx * 140, y + 50), (x1, y + h / 2 + 90), (x0, y + h / 2 + 90)])
    tails = t.get()
    solid(cv, grow(tails, 14), (11, 11, 11))
    cv.alpha_composite(metal_fill(tails, "gold", angle=90, bands=0.9))
    solid(cv, tails, (0, 0, 0), 70)
    band = Mask().rect((C - w / 2, y - h / 2, C + w / 2, y + h / 2), radius=40).get()
    solid(cv, grow(band, 16), (11, 11, 11))
    cv.alpha_composite(metal_fill(band, "gold", angle=90, bands=1.1))
    bead_edge(cv, band, width=30, kind="crystal")
    solid(cv, Mask().text((C, y + 10), text, size, spacing=size * 0.1).get(), (11, 11, 11))


def big_text(cv, text: str, y=FY, size=1100, kind="cobalt", sub: str | None = None, sub_size=230):
    """Numerals or a short word in pavé, gold-beaded edge."""
    m = Mask().text((C, y), text, size).get()
    solid(cv, grow(m, 26), (11, 11, 11))
    jewel(cv, m, kind=kind, d=30, edge=30)
    if sub:
        bright_gold(cv, Mask().text((C, y + size * 0.62), sub.upper(), sub_size, spacing=20).get())


def bright_gold(cv, m: Image.Image):
    """Small lettering in flat bright Gold #FFD700 with a black keyline (metal banding reads too dark at this size)."""
    solid(cv, grow(m, 12), (11, 11, 11))
    solid(cv, m, (255, 215, 0))


def medallion(motif, title: str, tag="CTA TEAM", ring="crystal", seed=1, notes=True) -> Image.Image:
    """Crystal ring, black face, gold arc title, motif(cv) in the middle, plaque at the bottom."""
    cv = blank()
    outer = Mask().circle(C, C, 1930).get()
    face = Mask().circle(C, C, 1560).get()
    band = minus(outer, face)
    pave(cv, band, kind=ring, d=44, seed=seed, setting="silver" if ring != "gold" else "gold",
         mix={"cobalt": 0.06} if ring == "crystal" else {"crystal": 0.08})
    bead_edge(cv, outer, width=60, kind="gold")
    deep_black(cv, face)
    bead_edge(cv, grow(face, 40), width=48, kind="gold")
    sparkles(cv, minus(face, Mask().circle(C, C, 1150).get()), n=10, rmin=14, rmax=40, seed=seed)
    if notes:
        note_glyphs(cv, minus(Mask().circle(C, C, 1450).get(), Mask().circle(C, C, 1180).get()), n=4, seed=seed)
    gold_text(cv, Mask().arc_text(C, C, 1310, title.upper(), 190 if len(title) < 18 else 160, spacing=14).get())
    motif(cv)
    if tag:
        plaque(cv, tag)
    for x, y, r in ((620, 700, 120), (3500, 1000, 90), (3300, 3420, 110)):
        sparkle(cv, x, y, r)
    return sticker(cv, outer, edge=80)


def obj(shape: Mask | Image.Image, details=None, kind="cobalt", d=34, seed=2,
        glints=((0.2, 0.2, 110), (0.82, 0.28, 80), (0.8, 0.78, 70))) -> Image.Image:
    """Cobalt pavé object with a gold bezel, details drawn on top, sticker edge."""
    cv = blank()
    m = shape.get() if isinstance(shape, Mask) else shape
    jewel(cv, m, kind=kind, d=d, edge=44, seed=seed)
    if details:
        details(cv)
    for fx, fy, r in glints:
        sparkle(cv, fx * S, fy * S, r)
    return sticker(cv, union(m, details_mask(details)) if getattr(details, "extends", False) else m)


def details_mask(details) -> Image.Image:
    return details.extends() if details else Mask().get()


def strings(cv, pts_pairs, w=13):
    for a, b in pts_pairs:
        cv.alpha_composite(metal_fill(Mask().line([a, b], w).get(), "silver", angle=0))


# ---------- instruments (first-credit cobalt art) ----------

def ukulele():
    m = Mask()
    m.circle(C, 2900, 760).circle(C, 2050, 600).rect((C - 520, 2050, C + 520, 2900))
    m.rect((C - 170, 600, C + 170, 2100), radius=40)
    m.rect((C - 260, 300, C + 260, 760), radius=120)

    def det(cv):
        hole = Mask().circle(C, 2300, 330).get()
        deep_black(cv, hole)
        bead_edge(cv, hole, width=44)
        metal(cv, Mask().rect((C - 150, 640, C + 150, 1900), radius=20).get(), "black", key=0)
        for i in range(1, 6):
            metal(cv, Mask().rect((C - 150, 640 + i * 230, C + 150, 655 + i * 230)).get(), "silver", key=0)
        metal(cv, Mask().rect((C - 360, 3020, C + 360, 3130), radius=40).get(), "gold")
        strings(cv, [((C + k, 520), (C + k, 3070)) for k in (-75, -25, 25, 75)])
        for x, y in ((C - 330, 420), (C + 330, 420), (C - 330, 640), (C + 330, 640)):
            metal(cv, Mask().circle(x, y, 70).get(), "gold")
    return obj(m, det)


def banjo():
    m = Mask().circle(C, 2700, 900).rect((C - 150, 420, C + 150, 1900), radius=40).rect((C - 240, 220, C + 240, 650), radius=110)

    def det(cv):
        head = Mask().circle(C, 2700, 700).get()
        pave(cv, head, kind="crystal", d=30, setting="silver", seed=9)
        bead_edge(cv, head, width=46)
        for a in range(0, 360, 20):
            x, y = C + 800 * math.cos(math.radians(a)), 2700 + 800 * math.sin(math.radians(a))
            metal(cv, Mask().circle(x, y, 44).get(), "gold", key=6)
        metal(cv, Mask().rect((C - 135, 460, C + 135, 1950), radius=20).get(), "black", key=0)
        for i in range(1, 7):
            metal(cv, Mask().rect((C - 135, 460 + i * 210, C + 135, 474 + i * 210)).get(), "silver", key=0)
        metal(cv, Mask().rect((C - 300, 2950, C + 300, 3040), radius=30).get(), "gold")
        metal(cv, Mask().poly([(C - 220, 3330), (C + 220, 3330), (C + 120, 3480), (C - 120, 3480)]).get(), "gold")
        strings(cv, [((C + k, 330), (C + k * 1.6, 3340)) for k in (-80, -40, 0, 40, 80)])
        for x, y in ((C - 300, 330), (C + 300, 330), (C - 300, 540), (C + 300, 540)):
            metal(cv, Mask().circle(x, y, 64).get(), "gold")
    return obj(m, det, glints=((0.2, 0.22, 110), (0.8, 0.3, 80), (0.85, 0.85, 70)))


def cello():
    m = Mask()
    m.ellipse((C - 760, 2350, C + 760, 3500)).ellipse((C - 640, 1350, C + 640, 2350))
    m.rect((C - 470, 2050, C + 470, 2650))
    m.rect((C - 130, 420, C + 130, 1500), radius=40)
    m.circle(C, 360, 150)

    def det(cv):
        waist = Mask().ellipse((C - 760, 2060, C - 400, 2620)).ellipse((C + 400, 2060, C + 760, 2620)).get()
        solid(cv, grow(waist, 30), (0, 0, 0), 0)
        for sx in (-1, 1):
            f = Mask().line([(C + sx * 330, 2200), (C + sx * 260, 2500), (C + sx * 330, 2800)], 40).get()
            deep_black(cv, f)
        metal(cv, Mask().rect((C - 110, 500, C + 110, 2300), radius=20).get(), "black", key=0)
        metal(cv, Mask().poly([(C - 260, 2720), (C + 260, 2720), (C + 200, 2820), (C - 200, 2820)]).get(), "gold")
        metal(cv, Mask().poly([(C - 160, 3150), (C + 160, 3150), (C + 90, 3420), (C - 90, 3420)]).get(), "black")
        metal(cv, Mask().rect((C - 25, 3480, C + 25, 3760)).get(), "silver")
        strings(cv, [((C + k, 470), (C + k * 1.5, 3180)) for k in (-60, -20, 20, 60)])
        metal(cv, Mask().circle(C, 360, 80).get(), "gold")
    det.extends = lambda: Mask().rect((C - 40, 3420, C + 40, 3780)).get()
    return obj(m, det)


def harp():
    m = Mask()
    m.line([(1150, 3500), (1150, 900)], 220)  # column
    m.line([(1150, 900), (1700, 600), (2300, 900), (2900, 1250)], 200)  # neck
    m.line([(2900, 1250), (1300, 3400)], 260)  # soundboard
    m.rect((900, 3380, 1700, 3600), radius=60)

    def det(cv):
        sb = Mask().line([(2830, 1300), (1330, 3330)], 120).get()
        pave(cv, sb, kind="crystal", d=26, setting="silver", seed=3)
        for i in range(1, 12):
            t = i / 12
            x_top = 1150 + (2900 - 1150) * t
            y_top = 900 - math.sin(t * math.pi * 1.3) * 300 + t * 280
            x_bot = 1300 + (2900 - 1300) * (1 - t) * 0 + 1150 + (2900 - 1150) * t * 0
            # string runs straight down from the neck to the soundboard line
            yb = 3400 + (1250 - 3400) * ((x_top - 1300) / (2900 - 1300))
            if yb > y_top + 120:
                strings(cv, [((x_top, y_top + 90), (x_top, yb - 60))], w=10)
        metal(cv, Mask().circle(1150, 860, 160).get(), "gold")
    return obj(m, det)


def clarinet():
    m = Mask()
    m.rect((C - 135, 520, C + 135, 3000), radius=50)
    m.poly([(C - 135, 2950), (C + 135, 2950), (C + 420, 3560), (C - 420, 3560)])
    m.ellipse((C - 430, 3480, C + 430, 3640))
    m.poly([(C - 110, 300), (C + 110, 300), (C + 135, 560), (C - 135, 560)])

    def det(cv):
        metal(cv, Mask().poly([(C - 90, 260), (C + 90, 260), (C + 110, 520), (C - 110, 520)]).get(), "black", key=0)
        for y in (560, 1300, 2050, 2950):
            metal(cv, Mask().rect((C - 160, y - 40, C + 160, y + 40), radius=20).get(), "silver")
        for i, y in enumerate(range(800, 2900, 210)):
            x = C + (60 if i % 2 else -60)
            metal(cv, Mask().circle(x, y, 52).get(), "silver", key=6)
            metal(cv, Mask().line([(x, y), (C + (180 if i % 2 else -180), y + 90)], 22).get(), "silver", key=0)
        bead_edge(cv, Mask().ellipse((C - 430, 3480, C + 430, 3640)).get(), width=40)
    return obj(m, det)


def trombone():
    tube = 120
    m = Mask()
    m.line([(600, 1500), (2900, 1500)], tube)
    m.line([(600, 1500), (600, 2200)], tube)
    m.line([(600, 2200), (2600, 2200)], tube)
    m.line([(1500, 2900), (3500, 2900)], tube)
    m.line([(3500, 2900), (3500, 2200), (2600, 2200)], tube)
    m.poly([(2900, 1440), (2900, 1560), (3650, 1950), (3650, 1050)])
    m.ellipse((3550, 1030, 3760, 1970))

    def det(cv):
        bell = Mask().ellipse((3550, 1030, 3760, 1970)).get()
        deep_black(cv, grow(bell, -40))
        bead_edge(cv, bell, width=44)
        metal(cv, Mask().line([(1500, 2900), (1500, 2200)], 70).get(), "gold")
        metal(cv, Mask().poly([(380, 1440), (520, 1460), (520, 1540), (380, 1560)]).get(), "silver")
        for x in (1200, 2300):
            metal(cv, Mask().rect((x - 50, 1420, x + 50, 1580), radius=20).get(), "gold")
    return obj(m, det, glints=((0.15, 0.25, 110), (0.6, 0.15, 80), (0.85, 0.85, 70)))


def xylophone():
    m = Mask()
    bars = 8
    for i in range(bars):
        x = 760 + i * 330
        h = 2100 - i * 140
        y0 = C - h / 2 + 100
        m.rect((x, y0, x + 260, y0 + h), radius=60)

    def det(cv):
        for i in range(bars):
            x = 760 + i * 330 + 130
            h = 2100 - i * 140
            y0 = C - h / 2 + 100
            for y in (y0 + 260, y0 + h - 260):
                metal(cv, Mask().circle(x, y, 40).get(), "silver", key=6)
        rails = Mask().line([(650, 1340), (3400, 1700)], 90).line([(650, 2860), (3400, 2500)], 90).get()
        metal(cv, rails, "gold")
        for (x0, y0), (x1, y1) in (((1150, 3650), (1900, 2700)), ((2250, 3700), (2700, 2650))):
            metal(cv, Mask().line([(x0, y0), (x1, y1)], 46).get(), "black")
            ball = Mask().circle(x1, y1, 150).get()
            jewel(cv, ball, kind="crystal", d=26, edge=24)
    det.extends = lambda: Mask().line([(1150, 3650), (1900, 2700)], 46).line([(2250, 3700), (2700, 2650)], 46).circle(1900, 2700, 150).circle(2700, 2650, 150).get()
    return obj(m, det)


def steel_pan():
    m = Mask()
    m.ellipse((560, 1300, 3540, 2700))
    m.rect((560, 2000, 3540, 3000))
    m.ellipse((560, 2300, 3540, 3700))

    def det(cv):
        top = Mask().ellipse((640, 1360, 3460, 2640)).get()
        metal(cv, top, "gold", bands=1.6)
        bead_edge(cv, Mask().ellipse((560, 1300, 3540, 2700)).get(), width=50)
        for cx, cy, rx, ry in ((C, 2000, 360, 200), (1350, 1780, 300, 170), (2750, 1780, 300, 170), (1250, 2250, 280, 150),
                               (2850, 2250, 280, 150), (C, 1580, 250, 130), (C, 2420, 260, 140), (1800, 2130, 190, 110), (2300, 2130, 190, 110)):
            dimple = Mask().ellipse((cx - rx, cy - ry, cx + rx, cy + ry)).get()
            metal(cv, dimple, "gold", key=8, angle=145, bands=1.5)
        for x in (900, 3200):
            metal(cv, Mask().line([(x, 2900), (x, 3400)], 40).get(), "silver")
    return obj(m, det)


# ---------- customer badges ----------

def link_mask(cx, cy, w, h, thick, deg):
    m = Mask().rect((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=w / 2)
    m.rect((cx - w / 2 + thick, cy - h / 2 + thick, cx + w / 2 - thick, cy + h / 2 - thick), radius=w / 2 - thick, fill=0)
    return rotated(m, deg, cx, cy)


def unbreakable(years: int):
    """Chain over the shoulders into a medal (like the 1-year art), richer each year."""
    kinds = {2: ("crystal", "gold"), 3: ("cobalt", "gold"), 4: ("cobalt", "crystal"), 5: ("gold", "cobalt")}
    chain_kind, medal_kind = kinds[years]
    cv = blank()
    links = []
    for side in (-1, 1):
        for i in range(4):
            cx = C + side * (900 - i * 210)
            cy = 520 + i * 420
            links.append(link_mask(cx, cy, 380, 600, 120, side * 28 if i % 2 == 0 else side * 28 + 90))
    chain = union(*links)
    jewel(cv, chain, kind=chain_kind, d=30, edge=26)
    medal = Mask().circle(C, 2700, 900).get()
    bail = link_mask(C, 1820, 300, 420, 100, 0)
    jewel(cv, bail, kind="gold", d=28, edge=0)
    jewel(cv, medal, kind=medal_kind, d=40, edge=60)
    face = Mask().circle(C, 2700, 640).get()
    metal(cv, face, "gold", key=16, bands=1.3)
    solid(cv, Mask().text((C, 2620), str(years), 760).get(), (11, 11, 11))
    solid(cv, Mask().text((C, 3070), "YEARS", 190, spacing=26).get(), (11, 11, 11))
    for _ in range(years - 1):
        pass
    for k in range(years):
        a = math.radians(-90 + (k - (years - 1) / 2) * 22)
        x, y = C + 770 * math.cos(a + math.pi), 2700 + 770 * math.sin(a + math.pi)
    # one crown-free star row: a star per year above the number
    for k in range(years):
        x = C + (k - (years - 1) / 2) * 170
        sparkle(cv, x, 2160, 70, (255, 215, 0))
    for x, y, r in ((700, 1700, 120), (3400, 1500, 100), (3200, 3500, 90)):
        sparkle(cv, x, y, r)
    return sticker(cv, union(chain, medal, bail))


def record(cv, cx, cy, r, label="cobalt"):
    rec = Mask().circle(cx, cy, r).get()
    jewel(cv, rec, kind="onyx", d=34, edge=40)
    for rr in range(int(r * 0.45), int(r * 0.92), 90):
        solid(cv, minus(Mask().circle(cx, cy, rr + 7).get(), Mask().circle(cx, cy, rr).get()), (11, 11, 11), 200)
    lab = Mask().circle(cx, cy, r * 0.36).get()
    jewel(cv, lab, kind=label, d=30, edge=30)
    solid(cv, Mask().circle(cx, cy, r * 0.04).get(), (11, 11, 11))
    return rec


def full_ep():
    cv = blank()
    rec = record(cv, C, 1900, 1450)
    ribbon(cv, "FULL EP", 3300, w=2200)
    for x, y, r in ((620, 600, 130), (3500, 800, 100), (3600, 2500, 80)):
        sparkle(cv, x, y, r)
    return sticker(cv, union(rec, Mask().rect((C - 1400, 3050, C + 1400, 3560)).get()))


def full_album():
    cv = blank()
    rec = record(cv, 2500, 1750, 1250)
    sleeve = Mask().rect((500, 600, 2350, 2900), radius=60).get()
    solid(cv, grow(sleeve, 20), (11, 11, 11))
    jewel(cv, sleeve, kind="cobalt", d=34, edge=48)
    gold_text(cv, Mask().text((1425, 1600), "CTA", 520).get())
    for i in range(3):
        sparkle(cv, 900 + i * 520, 2350, 90, (255, 215, 0))
    ribbon(cv, "FULL ALBUM", 3350, w=2600, size=200)
    for x, y, r in ((420, 420, 120), (3650, 500, 100), (3700, 2800, 80)):
        sparkle(cv, x, y, r)
    return sticker(cv, union(rec, sleeve, Mask().rect((C - 1580, 3100, C + 1580, 3610)).get()))


def heart_mask(cx, cy, s):
    """Heart from two circles and a triangle, s = half width."""
    m = Mask()
    r = s * 0.55
    m.circle(cx - s * 0.45, cy - s * 0.15, r).circle(cx + s * 0.45, cy - s * 0.15, r)
    m.poly([(cx - s * 0.98, cy - s * 0.02), (cx + s * 0.98, cy - s * 0.02), (cx, cy + s * 1.05)])
    return m


def checkup_champ():
    cv = blank()
    heart = heart_mask(C, 1900, 1550).get()
    solid(cv, grow(heart, 24), (11, 11, 11))
    jewel(cv, heart, kind="cobalt", d=36, edge=50)
    pulse = [(700, 1950), (1400, 1950), (1600, 1500), (1850, 2500), (2100, 1250), (2350, 2200), (2550, 1950), (3400, 1950)]
    pm = Mask().line(pulse, 120).get()
    solid(cv, grow(pm, 26), (11, 11, 11))
    jewel(cv, pm, kind="crystal", d=26, edge=0, setting="silver")
    ribbon(cv, "CHECKUP CHAMP", 3420, w=2700, size=190)
    for x, y, r in ((520, 640, 120), (3560, 700, 110), (3600, 2900, 80)):
        sparkle(cv, x, y, r)
    return sticker(cv, union(heart, pm, Mask().rect((C - 1650, 3170, C + 1650, 3680)).get()))


# ---------- staff motifs (drawn on the medallion face, centre (C, FY)) ----------

def m_text(text, sub=None, size=1000, kind="cobalt"):
    return lambda cv: big_text(cv, text, y=FY - (90 if sub else 0), size=size, kind=kind, sub=sub)


def m_document(check=True, stamp=None):
    def f(cv):
        page = Mask().rect((C - 600, FY - 820, C + 600, FY + 780), radius=60).get()
        jewel(cv, page, kind="crystal", d=30, edge=36, setting="silver")
        for i in range(4):
            metal(cv, Mask().rect((C - 420, FY - 560 + i * 210, C + 420, FY - 510 + i * 210), radius=20).get(), "silver", key=0)
        if check:
            cm = Mask().line([(C - 380, FY + 330), (C - 120, FY + 600), (C + 520, FY - 120)], 170).get()
            solid(cv, grow(cm, 26), (11, 11, 11))
            jewel(cv, cm, kind="cobalt", d=30, edge=0)
        if stamp:
            st = Mask().circle(C + 380, FY + 430, 300).get()
            jewel(cv, st, kind="gold", d=26, edge=26)
            solid(cv, Mask().text((C + 380, FY + 440), stamp, 150).get(), (11, 11, 11))
    return f


def m_magnifier(cv):
    ring = minus(Mask().circle(C - 180, FY - 180, 620).get(), Mask().circle(C - 180, FY - 180, 450).get())
    handle = rotated(Mask().rect((C + 230, FY + 150, C + 420, FY + 950), radius=80), 45, C + 300, FY + 300)
    jewel(cv, handle, kind="onyx", d=30, edge=30)
    jewel(cv, ring, kind="gold", d=30, edge=30)
    glass = Mask().circle(C - 180, FY - 180, 450).get()
    solid(cv, glass, (77, 140, 255), 70)
    sparkle(cv, C - 380, FY - 380, 120)


def m_scale(cv):
    post = Mask().rect((C - 60, FY - 650, C + 60, FY + 650)).rect((C - 450, FY + 600, C + 450, FY + 760), radius=60).get()
    metal(cv, post, "gold")
    beam = Mask().rect((C - 820, FY - 620, C + 820, FY - 520), radius=40).get()
    metal(cv, beam, "gold")
    for sx in (-1, 1):
        x = C + sx * 720
        metal(cv, Mask().line([(x, FY - 540), (x - 260, FY + 60)], 18).line([(x, FY - 540), (x + 260, FY + 60)], 18).get(), "silver", key=0)
        pan = Mask().ellipse((x - 340, FY + 20, x + 340, FY + 220)).get()
        jewel(cv, pan, kind="cobalt", d=26, edge=26)
    gold_text(cv, Mask().text((C, FY + 380), "0", 520).get())
    metal(cv, Mask().circle(C, FY - 680, 90).get(), "gold")


def m_patch(cv):
    band = rotated(Mask().rect((C - 950, FY - 300, C + 950, FY + 300), radius=300), 35, C, FY)
    jewel(cv, band, kind="crystal", d=30, edge=34, setting="silver")
    pad = rotated(Mask().rect((C - 330, FY - 230, C + 330, FY + 230), radius=60), 35, C, FY)
    jewel(cv, pad, kind="cobalt", d=26, edge=26)
    for dx, dy in ((-560, 250), (-700, 100), (560, -250), (700, -100), (-440, 400), (440, -400)):
        solid(cv, Mask().circle(C + dx * 0.9, FY - dy * 0.9, 22).get(), (150, 155, 165))


def m_coins(cv):
    for i, (x, n) in enumerate(((C - 520, 4), (C + 20, 6), (C + 560, 3))):
        for k in range(n):
            y = FY + 650 - k * 170
            coin = Mask().ellipse((x - 330, y - 110, x + 330, y + 110)).get()
            metal(cv, coin, "gold", key=12, bands=1.2)
            bead_edge(cv, coin, width=24)
    cm = Mask().line([(C - 200, FY - 620), (C, FY - 420), (C + 380, FY - 850)], 120).get()
    solid(cv, grow(cm, 20), (11, 11, 11))
    jewel(cv, cm, kind="cobalt", d=26, edge=0)


def m_calendar(cv):
    body = Mask().rect((C - 720, FY - 620, C + 720, FY + 720), radius=90).get()
    jewel(cv, body, kind="crystal", d=30, edge=36, setting="silver")
    top = Mask().rect((C - 720, FY - 620, C + 720, FY - 260), radius=90).rect((C - 720, FY - 400, C + 720, FY - 260)).get()
    jewel(cv, top, kind="cobalt", d=28, edge=0)
    for x in (C - 380, C + 380):
        metal(cv, Mask().rect((x - 55, FY - 800, x + 55, FY - 480), radius=50).get(), "gold")
    solid(cv, Mask().text((C, FY + 260), "5", 820).get(), (11, 11, 11))


def m_palette(cv):
    m = Mask().ellipse((C - 900, FY - 680, C + 900, FY + 700)).get()
    hole = Mask().circle(C + 420, FY + 300, 170).get()
    jewel(cv, minus(m, hole), kind="crystal", d=30, edge=36, setting="silver")
    for (dx, dy), k in zip(((-520, -200), (-150, -420), (300, -380), (-480, 260), (0, 120)), ("cobalt", "onyx", "gold", "cobalt", "onyx")):
        blob = Mask().circle(C + dx, FY + dy, 170).get()
        jewel(cv, blob, kind=k, d=26, edge=22)
    brush = rotated(Mask().rect((C - 60, FY - 1000, C + 60, FY + 100), radius=50), -35, C, FY)
    metal(cv, brush, "gold")


def m_megaphone(cv):
    cone = Mask().poly([(C - 700, FY - 220), (C + 600, FY - 720), (C + 600, FY + 720), (C - 700, FY + 220)]).get()
    jewel(cv, cone, kind="cobalt", d=30, edge=36)
    mouth = Mask().ellipse((C + 470, FY - 760, C + 760, FY + 760)).get()
    jewel(cv, mouth, kind="crystal", d=28, edge=30, setting="silver")
    grip = Mask().rect((C - 980, FY - 260, C - 640, FY + 260), radius=80).rect((C - 520, FY + 180, C - 330, FY + 620), radius=60).get()
    jewel(cv, grip, kind="onyx", d=26, edge=26)
    for i, r in enumerate((180, 320)):
        arc = minus(Mask().circle(C + 820, FY, 420 + r).get(), Mask().circle(C + 820, FY, 360 + r).get())
        arc = minus(arc, Mask().rect((0, 0, C + 900, S)).get())
        metal(cv, arc, "gold", key=0)


def m_heart(kind="cobalt", s=760):
    def f(cv):
        h = heart_mask(C, FY - 40, s).get()
        solid(cv, grow(h, 20), (11, 11, 11))
        jewel(cv, h, kind=kind, d=30, edge=36)
    return f


def m_bolt_bubble(cv):
    bub = Mask().rect((C - 820, FY - 650, C + 820, FY + 400), radius=320).poly([(C - 400, FY + 300), (C - 120, FY + 300), (C - 520, FY + 760)]).get()
    jewel(cv, bub, kind="crystal", d=30, edge=36, setting="silver")
    bolt = Mask().poly([(C + 80, FY - 560), (C - 330, FY - 20), (C - 40, FY - 20), (C - 160, FY + 340), (C + 330, FY - 160), (C + 40, FY - 160), (C + 200, FY - 560)]).get()
    solid(cv, grow(bolt, 22), (11, 11, 11))
    jewel(cv, bolt, kind="gold", d=26, edge=0)


def m_eye(cv):
    eye = Mask().ellipse((C - 950, FY - 520, C + 950, FY + 520)).get()
    jewel(cv, eye, kind="crystal", d=30, edge=40, setting="silver")
    iris = Mask().circle(C, FY, 420).get()
    jewel(cv, iris, kind="cobalt", d=28, edge=30)
    deep_black(cv, Mask().circle(C, FY, 170).get())
    sparkle(cv, C - 120, FY - 140, 110)


def m_code(cv):
    for sx in (-1, 1):
        br = Mask().line([(C + sx * 380, FY - 520), (C + sx * 820, FY), (C + sx * 380, FY + 520)], 200).get()
        solid(cv, grow(br, 22), (11, 11, 11))
        jewel(cv, br, kind="cobalt", d=28, edge=30)
    sl = Mask().line([(C + 200, FY - 620), (C - 200, FY + 620)], 170).get()
    solid(cv, grow(sl, 22), (11, 11, 11))
    jewel(cv, sl, kind="gold", d=26, edge=0)


def m_lock(cv):
    shackle = minus(Mask().rect((C - 480, FY - 900, C + 480, FY + 100), radius=480).get(),
                    Mask().rect((C - 300, FY - 720, C + 300, FY + 100), radius=300).get())
    jewel(cv, shackle, kind="crystal", d=28, edge=30, setting="silver")
    body = Mask().rect((C - 720, FY - 180, C + 720, FY + 800), radius=120).get()
    jewel(cv, body, kind="cobalt", d=30, edge=40)
    kh = Mask().circle(C, FY + 230, 130).poly([(C - 80, FY + 260), (C + 80, FY + 260), (C + 120, FY + 560), (C - 120, FY + 560)]).get()
    metal(cv, kh, "gold", key=12)


def person(cx, cy, s):
    m = Mask().circle(cx, cy - s * 0.9, s * 0.42)
    m.rect((cx - s * 0.7, cy - s * 0.38, cx + s * 0.7, cy + s * 0.9), radius=s * 0.6)
    return m.get()


def m_people(n=3, door=False):
    def f(cv):
        if door:
            d = Mask().rect((C - 950, FY - 820, C - 250, FY + 760), radius=40).get()
            jewel(cv, d, kind="gold", d=26, edge=30)
            metal(cv, Mask().circle(C - 380, FY + 40, 50).get(), "silver")
        xs = [C + 250, C + 700] if door else ([C - 650, C, C + 650] if n == 3 else [C])
        for i, x in enumerate(xs):
            big = (not door and i == 1) or n == 1
            p = person(x, FY + (40 if big else 160), 520 if big else 420)
            solid(cv, grow(p, 20), (11, 11, 11))
            jewel(cv, p, kind="cobalt" if big or door else "crystal", d=28, edge=30, setting=None)
    return f


def m_envelope(cv):
    env = Mask().rect((C - 900, FY - 560, C + 900, FY + 640), radius=60).get()
    jewel(cv, env, kind="crystal", d=30, edge=40, setting="silver")
    flap = Mask().line([(C - 860, FY - 520), (C, FY + 120), (C + 860, FY - 520)], 70).get()
    metal(cv, flap, "gold", key=0)
    h = heart_mask(C, FY + 140, 300).get()
    solid(cv, grow(h, 18), (11, 11, 11))
    jewel(cv, h, kind="cobalt", d=24, edge=22)


def m_globe(cv):
    g = Mask().circle(C, FY, 820).get()
    jewel(cv, g, kind="cobalt", d=30, edge=40)
    lines = Mask()
    for k in (-1, 0, 1):
        y = FY + k * 400
        half = math.sqrt(max(0, 820 ** 2 - (k * 400) ** 2))
        lines.line([(C - half, y), (C + half, y)], 34)
    lines.ellipse((C - 380, FY - 820, C + 380, FY + 820))
    lines.ellipse((C - 340, FY - 780, C + 340, FY + 780), fill=0)
    lines.rect((C - 17, FY - 820, C + 17, FY + 820))
    metal(cv, lines.get(), "gold", key=0)


def m_steps(cv):
    for i in range(3):
        x0 = C - 900 + i * 600
        top = FY + 600 - (i + 1) * 380
        st = Mask().rect((x0, top, x0 + 560, FY + 700), radius=40).get()
        jewel(cv, st, kind=("crystal", "cobalt", "gold")[i], d=28, edge=30, setting=None)
    sparkle(cv, C + 600, FY - 650, 130, (255, 215, 0))


def m_scroll(cv):
    sc = Mask().rect((C - 820, FY - 560, C + 820, FY + 520), radius=40).get()
    jewel(cv, sc, kind="crystal", d=30, edge=36, setting="silver")
    for sx in (-1, 1):
        roll = Mask().rect((C + sx * 820 - 120, FY - 640, C + sx * 820 + 120, FY + 600), radius=120).get()
        metal(cv, roll, "gold", key=10)
    for i in range(3):
        metal(cv, Mask().rect((C - 560, FY - 360 + i * 180, C + 560, FY - 320 + i * 180), radius=20).get(), "silver", key=0)
    seal = Mask().circle(C + 360, FY + 300, 260).get()
    jewel(cv, seal, kind="cobalt", d=26, edge=26)
    gold_text(cv, Mask().text((C + 360, FY + 310), "CTA", 150).get())


def m_trophy(cv):
    cup = Mask().poly([(C - 700, FY - 820), (C + 700, FY - 820), (C + 520, FY - 100), (C + 200, FY + 200), (C - 200, FY + 200), (C - 520, FY - 100)]).get()
    for sx in (-1, 1):
        h = minus(Mask().circle(C + sx * 700, FY - 480, 300).get(), Mask().circle(C + sx * 700, FY - 480, 180).get())
        metal(cv, h, "gold", key=12)
    jewel(cv, cup, kind="gold", d=30, edge=36)
    stem = Mask().rect((C - 110, FY + 180, C + 110, FY + 480)).rect((C - 520, FY + 460, C + 520, FY + 780), radius=50).get()
    jewel(cv, stem, kind="onyx", d=26, edge=30)
    gold_text(cv, Mask().text((C, FY - 430), "Q", 520).get(), outline_rgb=(0, 46, 115))


def m_crown(cv):
    base = Mask().rect((C - 820, FY + 200, C + 820, FY + 560), radius=60).get()
    top = Mask().poly([(C - 820, FY + 260), (C - 900, FY - 520), (C - 420, FY - 60), (C, FY - 760), (C + 420, FY - 60), (C + 900, FY - 520), (C + 820, FY + 260)]).get()
    jewel(cv, top, kind="gold", d=30, edge=36)
    jewel(cv, base, kind="cobalt", d=28, edge=34)
    for x, y in ((C - 900, FY - 560), (C, FY - 820), (C + 900, FY - 560)):
        jewel(cv, Mask().circle(x, y, 110).get(), kind="crystal", d=24, edge=20)
    gem = Mask().ellipse((C - 150, FY - 120, C + 150, FY + 140)).get()
    jewel(cv, gem, kind="cobalt", d=40, edge=24)


def m_handshake_heart(cv):
    m_heart("cobalt", 700)(cv)
    # a small gold padlock on the heart: customers who stayed
    metal(cv, Mask().rect((C - 260, FY - 160, C + 260, FY + 320), radius=60).get(), "gold", key=12)
    metal(cv, minus(Mask().rect((C - 180, FY - 420, C + 180, FY - 100), radius=180).get(), Mask().rect((C - 90, FY - 330, C + 90, FY - 100), radius=90).get()), "gold", key=10)


def m_star_heart(cv):
    star = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        r = 860 if k % 2 == 0 else 380
        star.append((C + r * math.cos(a), FY + 20 + r * math.sin(a)))
    st = Mask().poly(star).get()
    solid(cv, grow(st, 22), (11, 11, 11))
    jewel(cv, st, kind="gold", d=30, edge=34)
    h = heart_mask(C, FY + 70, 280).get()
    jewel(cv, h, kind="cobalt", d=24, edge=22)


def m_chain(years):
    def f(cv):
        links = []
        for i in range(4):
            x = C - 780 + i * 520
            links.append(link_mask(x, FY - 140, 440, 820, 140, 90 if i % 2 else 0))
        jewel(cv, union(*links), kind=("crystal", "crystal", "cobalt", "cobalt", "gold")[years - 1], d=30, edge=30)
        bright_gold(cv, Mask().text((C, FY + 600), f"{years} YEAR{'S' if years > 1 else ''}", 280, spacing=24).get())
    return f


STAFF = {
    # Welcome
    "staff_welcome/first_day": ("First Day", m_text("DAY 1", size=760)),
    "staff_welcome/first_week": ("First Week", m_text("WEEK 1", size=640)),
    "staff_welcome/days_30": ("30 Days", m_text("30", "days")),
    "staff_welcome/days_60": ("60 Days", m_text("60", "days")),
    "staff_welcome/days_90_strong": ("90 Days Strong", m_text("90", "strong")),
    # Certified (frames: the course name is added as text in the app)
    "staff_certified/company_core": ("Company Core", m_scroll),
    "staff_certified/department_track": ("Department Track", m_steps),
    "staff_certified/region_certified": ("Region Certified", m_globe),
    # Quality
    "staff_quality/clean_sheet": ("Clean Sheet", m_document()),
    "staff_quality/detective": ("Detective", m_magnifier),
    "staff_quality/zero_variance": ("Zero Variance", m_scale),
    "staff_quality/patched": ("Patched", m_patch),
    # Department (one each)
    "staff_department/first_acceptance": ("First Acceptance", m_document(check=True, stamp="OK")),
    "staff_department/settled": ("Settled", m_coins),
    "staff_department/closed_by_the_5th": ("Closed by the 5th", m_calendar),
    "staff_department/on_brand": ("On Brand", m_palette),
    "staff_department/campaign_came_through": ("Campaign Came Through", m_megaphone),
    "staff_department/stayed_with_us": ("Stayed With Us", m_handshake_heart),
    "staff_department/fast_friend": ("Fast Friend", m_bolt_bubble),
    "staff_department/witnessed": ("Witnessed", m_eye),
    "staff_department/clean_release": ("Clean Release", m_code),
    "staff_department/locked_down": ("Locked Down", m_lock),
    "staff_department/welcome_committee": ("Welcome Committee", m_people(door=True)),
    # Team, kudos, customer love
    "staff_team/team_came_through": ("Team Came Through", m_people(3)),
    "staff_kudos/came_through_for_me": ("Came Through for Me", m_star_heart),
    "staff_customer_love/thank_you_note": ("Thank-You Note", m_envelope),
    # Tenure (staff chains, not the customer Unbreakable art)
    **{f"staff_tenure/year_{y}": (f"{y} Year{'s' if y > 1 else ''} on the Team", m_chain(y)) for y in range(1, 6)},
    # Awards
    "staff_awards/quarterly_award": ("Came Through Award", m_trophy),
    "staff_awards/founders_crown": ("Founder's Crown", m_crown),
}

RINGS = {"staff_tenure/year_3": "cobalt", "staff_tenure/year_4": "cobalt", "staff_tenure/year_5": "gold",
         "staff_awards/quarterly_award": "gold", "staff_awards/founders_crown": "gold"}

DESIGNS: dict[str, tuple[str, object]] = {
    **{f"live_{n}": (f"playful/live_musicians/{n}.webp", fn) for n, fn in (
        ("ukulele", ukulele), ("banjo", banjo), ("cello", cello), ("harp", harp), ("clarinet", clarinet),
        ("trombone", trombone), ("xylophone", xylophone), ("steel_pan", steel_pan))},
    **{f"unbreakable_{y}": (f"playful/unbreakable_{y}.webp", (lambda y=y: unbreakable(y))) for y in (2, 3, 4, 5)},
    "full_ep": ("playful/full_ep.webp", full_ep),
    "full_album": ("playful/full_album.webp", full_album),
    "checkup_champ": ("playful/checkup_champ.webp", checkup_champ),
    **{k: (f"playful/{k}.webp", (lambda k=k, t=t, f=f: medallion(f, t, ring=RINGS.get(k, "crystal"), seed=hash(k) % 97)))
       for k, (t, f) in STAFF.items()},
}


if __name__ == "__main__":
    args = sys.argv[1:]
    names = [n for n in DESIGNS if not args or any(n.startswith(a) for a in args)]
    for n in names:
        path, fn = DESIGNS[n]
        save(fn(), OUT / path)
        print("saved", path, flush=True)

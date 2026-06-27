from pathlib import Path
import math
import random

from PIL import Image, ImageFilter, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "fang_v1"
SOURCE = ASSET_DIR / "speckBlood.webp"
WIDTH, HEIGHT = 460, 160
PAD, DEPTH, NEAR, FAR = 30, 400, 35, 104


def load_speck() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    return image.crop(bounds) if bounds else image


def stamp_layer(name: str, count: int, seed: int, layer: int) -> None:
    rng = random.Random(seed)
    speck = load_speck()
    detail = Image.new("RGBA", (WIDTH, HEIGHT))
    density = Image.new("L", (WIDTH, HEIGHT))
    size_cache = {}

    for i in range(count):
        r1, r2, r3, r4 = (rng.random() for _ in range(4))
        t = r1 ** (0.62 if layer == 0 else 0.72 if layer == 1 else 0.82)
        wobble = 1 + math.sin(t * (6.3 + layer * 2.7) + i * 0.011) * (0.14 - layer * 0.025)
        wobble += math.sin(t * 14.7 + i * 0.019) * 0.055
        half = (NEAR * (0.55 if layer == 2 else 0.85) * (1 - t) +
                FAR * (1.15 if layer == 0 else 1 if layer == 1 else 0.82) * t) * wobble
        side = (r2 - 0.5) * 2 * half * (0.11 + 0.89 * r3)
        edge = abs(side) / max(1, half)
        x = PAD + DEPTH * t + math.sin(t * 10 + i * 0.007) * 8 * (layer + 1)
        y = HEIGHT / 2 + side
        px = max(1, min(4, round(1.4 + r4 * 2.7)))
        if px not in size_cache:
            size_cache[px] = speck.resize((px, px), Image.Resampling.LANCZOS)
        particle = size_cache[px].copy()
        alpha = int(255 * (0.22 if layer == 0 else 0.36 if layer == 1 else 0.27)
                    * (1 - t * 0.58) * (1 - edge * 0.42))
        particle.putalpha(ImageEnhance.Brightness(particle.getchannel("A")).enhance(alpha / 255))
        tint = Image.new("RGBA", particle.size, (54 if layer == 0 else 116, 0, 8, 255))
        tint.putalpha(particle.getchannel("A"))
        detail.alpha_composite(tint, (round(x - px / 2), round(y - px / 2)))
        density.paste(max(4, alpha), (round(x), round(y), round(x) + 1, round(y) + 1))

    blur_radius = (7.5, 5.0, 9.0)[layer]
    fog = density.filter(ImageFilter.GaussianBlur(blur_radius))
    fog = ImageEnhance.Contrast(fog).enhance(1.7)
    ramp = Image.new("RGBA", (WIDTH, HEIGHT))
    ramp_px = ramp.load()
    for x in range(WIDTH):
        t = x / max(1, WIDTH - 1)
        if layer == 0:
            color = (43 + round(31 * t), 0, 4)
        elif layer == 1:
            color = (70 + round(88 * t), round(8 * t), 8)
        else:
            color = (120 + round(84 * t), round(18 * t), 12)
        for y in range(HEIGHT):
            ramp_px[x, y] = (*color, fog.getpixel((x, y)))
    ramp.alpha_composite(detail)
    ramp.save(ASSET_DIR / f"{name}.webp", "WEBP", lossless=True, method=6)


def trail_texture() -> None:
    rng = random.Random(0xF46A)
    size = 176
    source = load_speck()
    base = Image.new("RGBA", (size, size))
    mask_rgba = Image.new("RGBA", (size, size))
    detail = Image.new("RGBA", (size, size))
    center = size / 2
    cache = {}
    for i in range(2600):
        angle = rng.random() * math.tau
        radius = rng.random() ** 0.48 * center * 0.92
        wobble = 0.78 + math.sin(angle * 3 + radius * .08) * .14 + rng.random() * .22
        x = round(center + math.cos(angle) * radius * wobble)
        y = round(center + math.sin(angle) * radius * 0.63 * wobble)
        px = rng.choice((1, 1, 2, 2, 3))
        if not (2 <= x < size - 2 and 2 <= y < size - 2):
            continue
        if px not in cache:
            cache[px] = source.resize((px, px), Image.Resampling.LANCZOS)
        particle = cache[px].copy()
        particle.putalpha(ImageEnhance.Brightness(particle.getchannel("A")).enhance(rng.uniform(.15, .52)))
        mask_rgba.alpha_composite(particle, (x - px // 2, y - px // 2))
        if i % 4 == 0:
            tint = Image.new("RGBA", particle.size, (145 + rng.randrange(80), 0, 8, 255))
            tint.putalpha(particle.getchannel("A"))
            detail.alpha_composite(tint, (x - px // 2, y - px // 2))
    fog = mask_rgba.getchannel("A").filter(ImageFilter.GaussianBlur(4.8))
    fog = ImageEnhance.Contrast(fog).enhance(1.45)
    dark = Image.new("RGBA", (size, size), (58, 0, 6, 0))
    dark.putalpha(fog)
    base.alpha_composite(dark)
    base.alpha_composite(detail)
    base.save(ASSET_DIR / "trailMist.webp", "WEBP", lossless=True, method=6)


if __name__ == "__main__":
    stamp_layer("huntMistBack", 8000, 0xFA11, 0)
    stamp_layer("huntMistMid", 9000, 0xFA22, 1)
    stamp_layer("huntMistFront", 6000, 0xFA33, 2)
    trail_texture()
    print("Generated FANG blood mist textures from speckBlood.webp")

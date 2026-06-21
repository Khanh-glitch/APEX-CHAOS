from __future__ import annotations

import json
import re
import shutil
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "KATANA ASSETS"
FRAME_SOURCE = SOURCE / "24 fps_2 second_frame 1 to 48_for all animation"
DEST = ROOT / "public" / "assets" / "katana_v1"
FRAMES_DEST = DEST / "frames"
AUDIO_DEST = DEST / "audio"

VFX_FILES = {
    "bladeWave": "blade wave.png",
    "sakuraPetal": "sakura for effect.png",
    "slashOverlay": "slash effect for everything when it hitted by blade or skill.png",
    "pinkMoon": "the moon that follow and hover behind KATANA.png",
    "pickButton": "katana pick button.png",
    "picked": "fighter picked.png",
}

AUDIO_FILES = {
    "attack": "all attack sfx.WAV",
    "infiniteSeverStart": "3_sword_sfx_start_when_enemy_hit_the_center_of_3_clone.wav",
    "directFleshHit": "flesh_sound_for_all_but_blade_wave.wav",
    "waveHitEnemy": "blade_wave_impact_on_enemy_sound.wav",
    "waveHitDefendedObject": "blade_wave_impact_on_construction_shuriken_kunai_fighter_while_got_buff_bout_defence.wav",
    "waveHitHeavyObject": "blade_wave_impact_on_planet_war_machine.wav",
}


def frame_number(path: Path) -> int | None:
    match = re.search(r"frame[_ -]?(\d+)", path.stem, re.I)
    return int(match.group(1)) if match else None


def validate_frame_sources() -> list[Path]:
    files = [p for p in FRAME_SOURCE.iterdir() if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}]
    by_num: dict[int, list[Path]] = {}
    for path in files:
        num = frame_number(path)
        if num is not None:
            by_num.setdefault(num, []).append(path)
    missing = [n for n in range(1, 49) if n not in by_num]
    duplicates = {n: [str(p) for p in paths] for n, paths in by_num.items() if len(paths) > 1}
    extras = sorted(n for n in by_num if n < 1 or n > 48)
    if missing or duplicates or extras:
        raise RuntimeError(f"KATANA frame validation failed: missing={missing}, duplicates={duplicates}, extras={extras}")
    return [by_num[n][0] for n in range(1, 49)]


def remove_green_matte(image: Image.Image, keep_canvas: bool = False) -> Image.Image:
    rgba = image.convert("RGBA")
    arr = np.array(rgba, dtype=np.float32)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    max_rb = np.maximum(r, b)
    green_gap = g - max_rb
    strong = (g >= 145) & (green_gap >= 38) & (g >= r * 1.28) & (g >= b * 1.28)
    soft = (g >= 98) & (green_gap >= 18) & (g >= r * 1.12) & (g >= b * 1.12) & ~strong
    arr[..., 3] = np.where(strong, 0, a)
    strength = np.clip((green_gap - 16) / 62, 0, 1)
    arr[..., 3] = np.where(soft, a * (1 - strength), arr[..., 3])
    arr[..., 1] = np.where(soft, np.minimum(g, max_rb + 6), g)
    rgba = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    alpha = rgba.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.34))
    rgba.putalpha(alpha)
    arr = np.array(rgba, dtype=np.uint16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    max_rb = np.maximum(r, b)
    transparent = a <= 5
    spill = (a > 5) & (g > max_rb + 8)
    arr[..., 0] = np.where(transparent, 0, r)
    arr[..., 1] = np.where(transparent, 0, np.where(spill, max_rb + 5, g))
    arr[..., 2] = np.where(transparent, 0, b)
    arr[..., 3] = np.where(transparent, 0, a)
    rgba = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    if keep_canvas:
        return rgba
    return crop_alpha(rgba, 18)


def remove_light_edge_matte(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pix = rgba.load()
    seen = bytearray(width * height)
    stack: list[tuple[int, int]] = []

    def is_light(x: int, y: int) -> bool:
        r, g, b, a = pix[x, y]
        return a > 0 and min(r, g, b) >= 232 and max(r, g, b) - min(r, g, b) <= 22

    def push(x: int, y: int) -> None:
        if x < 0 or x >= width or y < 0 or y >= height:
            return
        idx = y * width + x
        if seen[idx] or not is_light(x, y):
            return
        seen[idx] = 1
        stack.append((x, y))

    for x in range(width):
        push(x, 0)
        push(x, height - 1)
    for y in range(height):
        push(0, y)
        push(width - 1, y)
    while stack:
        x, y = stack.pop()
        push(x - 1, y)
        push(x + 1, y)
        push(x, y - 1)
        push(x, y + 1)
    alpha = rgba.getchannel("A")
    ap = alpha.load()
    for y in range(height):
        base = y * width
        for x in range(width):
            if seen[base + x]:
                ap[x, y] = 0
    rgba.putalpha(alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.25)))
    return crop_alpha(rgba, 12)


def crop_alpha(image: Image.Image, padding: int) -> Image.Image:
    box = image.getchannel("A").getbbox()
    if not box:
        return image
    left = max(0, box[0] - padding)
    top = max(0, box[1] - padding)
    right = min(image.width, box[2] + padding)
    bottom = min(image.height, box[3] + padding)
    return image.crop((left, top, right, bottom))


def alpha_green_report(image: Image.Image) -> dict[str, object]:
    rgba = image.convert("RGBA")
    arr = np.array(rgba, dtype=np.uint16)
    corners = [int(arr[0, 0, 3]), int(arr[0, rgba.width - 1, 3]), int(arr[rgba.height - 1, 0, 3]), int(arr[rgba.height - 1, rgba.width - 1, 3])]
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    opaque_mask = a > 20
    greenish_mask = opaque_mask & (g > 120) & (g > r * 1.22) & (g > b * 1.22)
    opaque = int(np.count_nonzero(opaque_mask))
    greenish = int(np.count_nonzero(greenish_mask))
    return {"cornerAlpha": corners, "greenishOpaquePixels": greenish, "opaquePixels": opaque}


def save_webp(image: Image.Image, destination: Path) -> dict[str, object]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", lossless=True, method=6, exact=True)
    report = alpha_green_report(image)
    return {
        "file": destination.relative_to(ROOT / "public").as_posix(),
        "width": image.width,
        "height": image.height,
        **report,
    }


def copy_audio() -> dict[str, dict[str, object]]:
    AUDIO_DEST.mkdir(parents=True, exist_ok=True)
    records: dict[str, dict[str, object]] = {}
    for key, filename in AUDIO_FILES.items():
        source = SOURCE / filename
        if not source.exists():
            raise RuntimeError(f"Missing KATANA audio source: {filename}")
        destination = AUDIO_DEST / f"{key}{source.suffix.lower()}"
        shutil.copyfile(source, destination)
        duration = None
        if destination.suffix.lower() == ".wav":
            with wave.open(str(destination), "rb") as wav:
                duration = wav.getnframes() / max(1, wav.getframerate())
        records[key] = {
            "file": destination.relative_to(ROOT / "public").as_posix(),
            "source": filename,
            "duration": None if duration is None else round(duration, 3),
        }
    records["cloneTeleport"] = {
        "file": "assets/ninja_v1/audio/teleport.mp3",
        "source": "reused NINJA teleport.mp3",
        "reused": True,
    }
    return records


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    frame_sources = validate_frame_sources()
    frame_records: dict[str, dict[str, object]] = {}
    for index, source in enumerate(frame_sources, start=1):
        image = remove_green_matte(Image.open(source), keep_canvas=True)
        key = f"katana.frame.{index:02d}"
        frame_records[key] = save_webp(image, FRAMES_DEST / f"frame_{index:03d}.webp") | {"source": source.name}

    vfx_records: dict[str, dict[str, object]] = {}
    for key, filename in VFX_FILES.items():
        source = SOURCE / filename
        if not source.exists():
            raise RuntimeError(f"Missing KATANA VFX source: {filename}")
        raw = Image.open(source)
        if key == "pickButton":
            image = remove_light_edge_matte(raw)
        elif key == "bladeWave":
            image = remove_green_matte(raw, keep_canvas=True)
        else:
            image = remove_green_matte(raw, keep_canvas=False)
        vfx_records[f"katana.vfx.{key}"] = save_webp(image, DEST / f"{key}.webp") | {"source": filename}

    manifest = {
        "version": 1,
        "fighter": "KATANA",
        "frameRate": 24,
        "frameCount": 48,
        "loopSeconds": 2.0,
        "releaseFrame": 17,
        "assets": frame_records | vfx_records,
        "audio": {f"katana.sfx.{key}": value for key, value in copy_audio().items()},
    }
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "frames": len(frame_records),
        "vfx": len(vfx_records),
        "audio": len(manifest["audio"]),
        "manifest": str((DEST / "manifest.json").relative_to(ROOT)),
    }, indent=2))


if __name__ == "__main__":
    main()

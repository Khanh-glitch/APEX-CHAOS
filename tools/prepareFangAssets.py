from __future__ import annotations

import hashlib
import json
import re
import shutil
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "FANG ASSETS"
DOWNLOADS = Path.home() / "Downloads"
DEST = ROOT / "public" / "assets" / "fang_v1"
REPORTS = DEST / "review"

CLIPS = {
    "normal": (SOURCE / "13 frame normal move_load by 24 fps", 13),
    "hunt": (SOURCE / "7 first frame (except the 1) for transform to the hauting mode_loop 9 to 22 and back to 9 for haunting moving", 22),
    "howl": (SOURCE / "48 frame hawling", 48),
}

IMAGES = {
    "selectionVisual": ("FIGHTER PICKED MENU.png", "green", True),
    "selectionButton": ("fighter button.png", "white", False),
    "howlRing": ("circle sign for howl.png", "magenta", False),
    "biteMark": ("fang icon overlay enemy when enemy got hit.png", "green", False),
    "moonIcon": ("moon icon.png", "green", False),
    "sunIcon": ("sun icon.png", "green", False),
    "speckBlood": ("Speck of blood.png", "green", False),
    "speckMoon": ("Speck of moon energy.png", "magenta", False),
    "speckSun": ("Speck of sun energy.png", "magenta", False),
}

AUDIO = {
    "collisionBite": SOURCE / "Collision_bite.wav",
    "huntingPounce": SOURCE / "Hunting_Pounce_sfx.wav",
    "postCollisionRoar": SOURCE / "roar_right_after_Collision_with_enemy.wav",
    "huntRunStep": SOURCE / "running_in_hauting_mode.wav",
    "sniff": SOURCE / "sniff.wav",
    "huntStart": SOURCE / "starting_hunting.wav",
    "wallRebound": SOURCE / "wall_hit_by_wall_pounce.wav",
    # V7 requires this event, and the two Downloads copies are byte-identical.
    "howl": DOWNLOADS / "wolf-howling (1).mp3",
    "heavyImpact": ROOT / "KATANA ASSETS" / "blade_wave_impact_on_planet_war_machine.wav",
}


def frame_number(path: Path) -> int | None:
    match = re.search(r"frame[_ -]?(\d+)", path.stem, re.I)
    return int(match.group(1)) if match else None


def clip_sources(folder: Path, count: int) -> list[Path]:
    by_number: dict[int, list[Path]] = {}
    for path in folder.iterdir():
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            number = frame_number(path)
            if number is not None:
                by_number.setdefault(number, []).append(path)
    missing = [n for n in range(1, count + 1) if n not in by_number]
    duplicates = {n: [str(p) for p in paths] for n, paths in by_number.items() if len(paths) != 1}
    extras = sorted(n for n in by_number if n < 1 or n > count)
    if missing or duplicates or extras:
        raise RuntimeError(f"FANG {folder.name} frame validation failed: missing={missing}, duplicates={duplicates}, extras={extras}")
    return [by_number[n][0] for n in range(1, count + 1)]


def crop_alpha(image: Image.Image, padding: int = 16) -> Image.Image:
    box = image.getchannel("A").getbbox()
    if not box:
        return image
    return image.crop((max(0, box[0] - padding), max(0, box[1] - padding),
                       min(image.width, box[2] + padding), min(image.height, box[3] + padding)))


def remove_key(image: Image.Image, key: str, keep_canvas: bool) -> Image.Image:
    arr = np.asarray(image.convert("RGBA"), dtype=np.float32).copy()
    rgb = arr[..., :3]
    alpha = arr[..., 3]
    if key == "green":
        distance = np.sqrt((rgb[..., 0] - 8) ** 2 + (rgb[..., 1] - np.maximum(160, rgb[..., 1])) ** 2 + (rgb[..., 2] - 8) ** 2)
        gap = rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
        keyness = np.clip((gap - 18) / 75, 0, 1) * np.clip((rgb[..., 1] - 80) / 100, 0, 1)
        spill = keyness > .03
        rb = np.maximum(rgb[..., 0], rgb[..., 2])
        rgb[..., 1] = np.where(spill, np.minimum(rgb[..., 1], rb + 8), rgb[..., 1])
    elif key == "magenta":
        gap = np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]
        balance = 1 - np.clip(np.abs(rgb[..., 0] - rgb[..., 2]) / 80, 0, 1)
        keyness = np.clip((gap - 20) / 85, 0, 1) * np.clip((np.maximum(rgb[..., 0], rgb[..., 2]) - 110) / 110, 0, 1) * balance
        spill = keyness > .03
        neutral = rgb[..., 1] + 8
        rgb[..., 0] = np.where(spill, np.minimum(rgb[..., 0], neutral), rgb[..., 0])
        rgb[..., 2] = np.where(spill, np.minimum(rgb[..., 2], neutral), rgb[..., 2])
    elif key == "white":
        low = np.min(rgb, axis=2)
        spread = np.max(rgb, axis=2) - low
        keyness = np.clip((low - 220) / 32, 0, 1) * np.clip((28 - spread) / 28, 0, 1)
    else:
        raise ValueError(key)

    # Tight feather preserves fur, teeth, glow and thin rings while removing JPEG key noise.
    if key in {"green", "magenta"}:
        alpha *= 1 - np.clip((keyness - .04) / .60, 0, 1)
    else:
        alpha *= 1 - np.clip((keyness - .12) / .82, 0, 1)
    arr[..., :3] = rgb
    arr[..., 3] = alpha
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    matte = out.getchannel("A").filter(ImageFilter.GaussianBlur(.32))
    out.putalpha(matte)
    cleaned = np.asarray(out, dtype=np.uint8).copy()
    transparent = cleaned[..., 3] <= 3
    cleaned[transparent, :3] = 0
    cleaned[transparent, 3] = 0
    out = Image.fromarray(cleaned, "RGBA")
    return out if keep_canvas else crop_alpha(out)


def alpha_report(image: Image.Image, key: str) -> dict[str, object]:
    arr = np.asarray(image.convert("RGBA"), dtype=np.uint16)
    a = arr[..., 3]
    rgb = arr[..., :3]
    corners = [int(a[0, 0]), int(a[0, -1]), int(a[-1, 0]), int(a[-1, -1])]
    visible = a > 20
    if key == "green":
        residual = visible & (rgb[..., 1] > 110) & (rgb[..., 1] > rgb[..., 0] * 1.35) & (rgb[..., 1] > rgb[..., 2] * 1.35)
    elif key == "magenta":
        residual = visible & (rgb[..., 0] > 150) & (rgb[..., 2] > 150) & (rgb[..., 1] * 1.8 < np.minimum(rgb[..., 0], rgb[..., 2]))
    else:
        residual = visible & (np.min(rgb, axis=2) > 245) & ((np.max(rgb, axis=2) - np.min(rgb, axis=2)) < 8)
    return {
        "cornerAlpha": corners,
        "visiblePixels": int(np.count_nonzero(visible)),
        "residualKeyPixels": int(np.count_nonzero(residual)),
        "alphaBounds": list(image.getchannel("A").getbbox() or (0, 0, 0, 0)),
    }


def save_webp(image: Image.Image, destination: Path, key: str) -> dict[str, object]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", lossless=True, method=4, exact=True)
    return {
        "file": destination.relative_to(ROOT / "public").as_posix(),
        "width": image.width,
        "height": image.height,
        **alpha_report(image, key),
    }


def contact_sheet(name: str, frames: list[Image.Image]) -> str:
    thumb_w, thumb_h = 180, 240
    columns = 8
    rows = (len(frames) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * thumb_w, rows * (thumb_h + 24)), (28, 30, 36))
    draw = ImageDraw.Draw(sheet)
    for i, frame in enumerate(frames):
        thumb = frame.copy()
        thumb.thumbnail((thumb_w - 12, thumb_h - 12), Image.Resampling.LANCZOS)
        x = (i % columns) * thumb_w + (thumb_w - thumb.width) // 2
        y = (i // columns) * (thumb_h + 24) + (thumb_h - thumb.height) // 2
        checker = Image.new("RGB", thumb.size, (78, 82, 91))
        checker.paste((42, 45, 52), (0, 0, thumb.width, thumb.height), None)
        checker.paste(thumb, (0, 0), thumb)
        sheet.paste(checker, (x, y))
        draw.text(((i % columns) * thumb_w + 8, (i // columns) * (thumb_h + 24) + thumb_h + 3), f"{i + 1:02d}", fill=(235, 235, 235))
    REPORTS.mkdir(parents=True, exist_ok=True)
    path = REPORTS / f"{name}-contact-sheet.webp"
    sheet.save(path, "WEBP", quality=90, method=6)
    return path.relative_to(ROOT / "public").as_posix()


def copy_audio() -> dict[str, dict[str, object]]:
    out: dict[str, dict[str, object]] = {}
    audio_dest = DEST / "audio"
    audio_dest.mkdir(parents=True, exist_ok=True)
    for logical, source in AUDIO.items():
        if not source.exists():
            raise RuntimeError(f"Missing required FANG audio logical ID fang.sfx.{logical}: {source}")
        destination = audio_dest / f"{logical}{source.suffix.lower()}"
        shutil.copyfile(source, destination)
        duration = None
        if destination.suffix.lower() == ".wav":
            with wave.open(str(destination), "rb") as wav:
                duration = wav.getnframes() / max(1, wav.getframerate())
        out[f"fang.sfx.{logical}"] = {
            "file": destination.relative_to(ROOT / "public").as_posix(),
            "source": str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),
            "duration": round(duration, 6) if duration is not None else None,
            "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "sampleOffset": 0,
        }
    return out


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict[str, object]] = {}
    reviews: dict[str, str] = {}
    for clip, (folder, count) in CLIPS.items():
        sources = clip_sources(folder, count)
        processed: list[Image.Image] = []
        for index, source in enumerate(sources, 1):
            image = remove_key(Image.open(source), "green", keep_canvas=True)
            processed.append(image)
            logical = f"fang.anim.{clip}.{index:02d}"
            record = save_webp(image, DEST / "frames" / clip / f"frame_{index:03d}.webp", "green")
            assets[logical] = record | {"source": str(source.relative_to(ROOT))}
        reviews[clip] = contact_sheet(clip, processed)

    for logical, (filename, key, keep_canvas) in IMAGES.items():
        source = SOURCE / filename
        if not source.exists():
            raise RuntimeError(f"Missing required FANG image logical ID fang.vfx.{logical}: {source}")
        image = remove_key(Image.open(source), key, keep_canvas)
        prefix = "fang.ui" if logical.startswith("selection") else "fang.vfx"
        assets[f"{prefix}.{logical}"] = save_webp(image, DEST / f"{logical}.webp", key) | {
            "source": str(source.relative_to(ROOT)), "key": key
        }

    manifest = {
        "version": 7,
        "fighter": "FANG",
        "frameRate": 24,
        "clips": {
            "normal": {"count": 13, "loop": [1, 13], "seconds": 13 / 24},
            "hunt": {"count": 22, "transition": [2, 8], "loop": [9, 22]},
            "howl": {"count": 48, "seconds": 2, "howlEventFrame": 17},
        },
        "registration": {"policy": "shared-source-canvas", "canvas": [1080, 1920], "pivot": [540, 960]},
        "assets": assets,
        "audio": copy_audio(),
        "review": reviews,
    }
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    validation = {
        "frameCounts": {name: count for name, (_, count) in CLIPS.items()},
        "allCornersTransparent": all(all(v == 0 for v in record["cornerAlpha"]) for record in assets.values()),
        "maxResidualKeyPixels": max(record["residualKeyPixels"] for record in assets.values()),
        "records": assets,
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / "alpha-validation.json").write_text(json.dumps(validation, indent=2), encoding="utf-8")
    print(json.dumps({"frames": 83, "images": len(IMAGES), "audio": len(AUDIO), "manifest": str(DEST / 'manifest.json'), "review": reviews}, indent=2))


if __name__ == "__main__":
    main()

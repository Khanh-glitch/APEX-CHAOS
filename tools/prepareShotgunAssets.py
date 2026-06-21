from __future__ import annotations

import json
import shutil
import wave
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "SHOTGUN"
DEST = ROOT / "public" / "assets" / "shotgun_v1"
AUDIO_DEST = DEST / "audio"

FILES = {
    "pellet": "bulleet.png",
    "muzzle": "52e60624-56a1-44e6-96a5-d616aef6d86f.png",
    "gun_after": "gun after right after shoot.png",
    "gun_ready": "gun after right before shoot.png",
    "gun_pump": "gun after small reload.png",
    "body": "main visual (no gun).png",
    "ring_0": "reloading circle 0 per 6.png",
    "ring_1": "reloading circle 1 per 6.png",
    "ring_2": "reloading circle 2 per 6.png",
    "ring_3": "reloading circle 3 per 6.png",
    "ring_4": "reloading circle 4 per 6.png",
    "ring_5": "reloading circle 5 per 6.png",
    "ring_6": "reloading circle 6 per 6.png",
    "hook": "the hook.png",
    "shell": "Shell casing.png",
    "pick_button": "shotgun pick button.png",
    "picked": "visual for picked.png",
}

AUDIO_FILES = {
    "fire": "fire_sfx (2).wav",
    "hook": "shoot_the_hook_the_pull.wav",
    "special_reload": "special_reloading_after_use_the_dash_skill.wav",
    "reload_batch": "reloading_batch.wav",
    "seven_hit": "7_pellet_hit_in_one_sfx.wav",
    "building_hit": "pellet_hit_the_building_of_engineer.wav",
}

AUDIO_OUTPUTS = {
    "fire": "fire_sfx.wav",
    "hook": "shoot_the_hook_the_pull.wav",
    "special_reload": "special_reloading_after_use_the_dash_skill.wav",
    "reload_batch": "reloading_batch_7s.wav",
    "seven_hit": "7_pellet_hit_in_one_sfx.wav",
    "building_hit": "pellet_hit_the_building_of_engineer.wav",
}

GROUPS = [
    ("gun_ready", "gun_after", "gun_pump"),
    ("ring_0", "ring_1", "ring_2", "ring_3", "ring_4", "ring_5", "ring_6"),
]


def light_neutral(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = pixel
    return min(r, g, b) >= 232 and max(r, g, b) - min(r, g, b) <= 10


def remove_checkerboard(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        idx = y * width + x
        if outside[idx] or not light_neutral(pixels[x, y]):
            return
        outside[idx] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    alpha = Image.new("L", rgba.size, 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        base = y * width
        for x in range(width):
            if outside[base + x]:
                alpha_pixels[x, y] = 0

    # Pull the matte one pixel into the removed background, then soften it. This
    # removes the pale checker fringe without erasing enclosed white highlights.
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.45))
    rgba.putalpha(alpha)
    return rgba


def remove_enclosed_neutral_components(image: Image.Image, minimum: int) -> Image.Image:
    """Remove checker islands trapped inside limbs without touching painted highlights."""
    rgba = image.copy()
    pixels = rgba.load()
    width, height = rgba.size
    remaining = {
        (x, y)
        for y in range(height)
        for x in range(width)
        if pixels[x, y][3] > 128 and light_neutral(pixels[x, y])
    }
    while remaining:
        seed = remaining.pop()
        queue = [seed]
        component = [seed]
        while queue:
            x, y = queue.pop()
            for neighbour in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbour in remaining:
                    remaining.remove(neighbour)
                    queue.append(neighbour)
                    component.append(neighbour)
        if len(component) >= minimum:
            for x, y in component:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
    return rgba


def remove_black_matte(image: Image.Image) -> Image.Image:
    """Convert the new black-backed muzzle flash to clean emissive transparency."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = pixels[x, y]
            brightness = max(r, g, b)
            alpha = 0 if brightness <= 8 else min(255, int((brightness - 8) * 1.55))
            # Un-premultiply after using screen brightness as alpha so the orange
            # flame remains saturated on the dark arena.
            if alpha:
                scale = 255 / alpha
                r, g, b = min(255, int(r * scale)), min(255, int(g * scale)), min(255, int(b * scale))
            pixels[x, y] = (r, g, b, alpha)
    return rgba.filter(ImageFilter.GaussianBlur(.22))


def remove_green_matte(image: Image.Image) -> Image.Image:
    """Remove the bright green chroma matte used by the refreshed SHOTGUN assets."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            green = g - max(r, b)
            strong = g >= 145 and green >= 45 and g >= r * 1.28 and g >= b * 1.28
            soft = g >= 104 and green >= 25 and g >= r * 1.13 and g >= b * 1.13
            if strong:
                pixels[x, y] = (0, 0, 0, 0)
            elif soft:
                keep = max(0, min(255, int(a * (1 - min(1, (green - 20) / 55)))))
                pixels[x, y] = (r, min(g, max(r, b)), b, keep)
            elif a == 0:
                pixels[x, y] = (0, 0, 0, 0)
    alpha = rgba.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.32))
    rgba.putalpha(alpha)
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a <= 6:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def clean_reload_ring(image: Image.Image) -> Image.Image:
    """Keep only the real ring art from the new green-screen shell-count plates."""
    rgba = image.copy()
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a <= 8:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def split_hook_assets(image: Image.Image) -> dict[str, Image.Image]:
    """Split the green-screen hook into a stretchable rope strip and a fixed hook head."""
    box = image.getchannel("A").getbbox()
    if not box:
        return {"hook_rope": image, "hook_head": image}
    left, top, right, bottom = box
    width = right - left
    rope_box = (
        left + int(width * .19),
        top + int((bottom - top) * .36),
        left + int(width * .70),
        top + int((bottom - top) * .64),
    )
    head_box = (
        left + int(width * .79),
        top,
        right,
        bottom,
    )
    return {
        "hook_rope": image.crop(rope_box),
        "hook_head": image.crop(head_box),
    }


def union_bbox(images: list[Image.Image], padding: int = 12) -> tuple[int, int, int, int]:
    boxes = [image.getchannel("A").getbbox() for image in images]
    boxes = [box for box in boxes if box]
    if not boxes:
        return (0, 0, images[0].width, images[0].height)
    left = max(0, min(box[0] for box in boxes) - padding)
    top = max(0, min(box[1] for box in boxes) - padding)
    right = min(images[0].width, max(box[2] for box in boxes) + padding)
    bottom = min(images[0].height, max(box[3] for box in boxes) + padding)
    return left, top, right, bottom


def copy_audio_assets() -> dict[str, dict[str, object]]:
    AUDIO_DEST.mkdir(parents=True, exist_ok=True)
    records: dict[str, dict[str, object]] = {}
    for key, source_name in AUDIO_FILES.items():
        source = SOURCE / source_name
        destination = AUDIO_DEST / AUDIO_OUTPUTS[key]
        if key == "reload_batch":
            with wave.open(str(source), "rb") as src:
                params = src.getparams()
                frame_rate = src.getframerate()
                frames = min(src.getnframes(), int(frame_rate * 7))
                audio = src.readframes(frames)
            with wave.open(str(destination), "wb") as dst:
                dst.setparams(params)
                dst.writeframes(audio)
            duration = 7
        else:
            shutil.copyfile(source, destination)
            with wave.open(str(destination), "rb") as wav:
                duration = wav.getnframes() / max(1, wav.getframerate())
        records[key] = {
            "file": destination.relative_to(ROOT / "public").as_posix(),
            "source": source_name,
            "duration": round(duration, 3),
        }
    return records


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    processed = {key: remove_checkerboard(Image.open(SOURCE / filename)) for key, filename in FILES.items()}
    processed["muzzle"] = remove_black_matte(Image.open(SOURCE / FILES["muzzle"]))
    for key in [f"ring_{i}" for i in range(7)]:
        processed[key] = clean_reload_ring(remove_green_matte(Image.open(SOURCE / FILES[key])))
    hook_parts = split_hook_assets(remove_green_matte(Image.open(SOURCE / FILES["hook"])))
    processed.update(hook_parts)
    del processed["hook"]
    processed["body"] = remove_enclosed_neutral_components(processed["body"], 50)
    processed["picked"] = remove_enclosed_neutral_components(processed["picked"], 500)
    group_boxes: dict[str, tuple[int, int, int, int]] = {}
    for group in GROUPS:
        box = union_bbox([processed[key] for key in group], padding=18)
        for key in group:
            group_boxes[key] = box

    records: dict[str, dict[str, object]] = {}
    for old_name in ("ring_empty.webp", "ring_full.webp"):
        old_path = DEST / old_name
        if old_path.exists():
            old_path.unlink()
    for key, image in processed.items():
        box = group_boxes.get(key) or union_bbox([image], padding=18)
        cropped = image.crop(box)
        destination = DEST / f"{key}.webp"
        cropped.save(destination, "WEBP", lossless=True, method=6, exact=True)
        records[key] = {
            "file": destination.relative_to(ROOT / "public").as_posix(),
            "width": cropped.width,
            "height": cropped.height,
            "source": FILES.get(key, FILES["hook"]),
            "crop": list(box),
        }

    audio_records = copy_audio_assets()
    manifest = {"version": 1, "transparent": True, "assets": records, "audio": audio_records}
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""A5 image optimizer helper (invoked by tools/optimizeRuntimeAssets.mjs).

Converts one PNG to WebP under the repo's established conventions
(tools/convertAssetsToWebp.py: q92 lossy, alpha_quality=100, method=4,
exact=True) and additionally tries a fully lossless WebP first. Emits BOTH
candidates plus quality metrics so the orchestrator can pick per the
"materially smaller without quality loss" rule.

Usage: python3 tools/optimizePng.py <in.png> <out-lossless.webp> <out-lossy.webp>
Output: single JSON object on stdout.
"""
from __future__ import annotations

import json
import sys

from PIL import Image, ImageChops


def save_webp(image: Image.Image, destination: str, *, lossless: bool) -> None:
    image.save(
        destination,
        format="WEBP",
        lossless=lossless,
        quality=100 if lossless else 92,
        alpha_quality=100,
        method=4,
        exact=True,
    )


def quality_metrics(original: Image.Image, converted: Image.Image) -> dict:
    """Worst-case per-channel delta and RMSE across the image."""
    if original.mode != converted.mode:
        original = original.convert("RGBA")
        converted = converted.convert("RGBA")
    if original.size != converted.size:
        return {"maxChannelDelta": None, "rmse": None, "note": "size mismatch"}
    diff = ImageChops.difference(original, converted)
    hist = diff.convert("RGBA").histogram()
    # Worst non-zero luminance bucket across R/G/B/A planes.
    channels = len(hist) // 256
    max_channel_delta = 0
    total = 0
    count = 0
    for plane in range(channels):
        plane_hist = hist[plane * 256:(plane + 1) * 256]
        plane_pixels = sum(plane_hist)
        if not plane_pixels:
            continue
        for value, n in enumerate(plane_hist):
            if n:
                max_channel_delta = max(max_channel_delta, value)
            total += value * value * n
            count += n
    rmse = (total / count) ** 0.5 if count else 0.0
    return {"maxChannelDelta": max_channel_delta, "rmse": round(rmse, 3)}


def main() -> None:
    source_path, lossless_path, lossy_path = sys.argv[1], sys.argv[2], sys.argv[3]
    with Image.open(source_path) as image:
        image.load()
        has_alpha = "A" in image.getbands() or "transparency" in image.info
        converted = image.convert("RGBA" if has_alpha else "RGB")
        save_webp(converted, lossless_path, lossless=True)
        save_webp(converted, lossy_path, lossless=False)

        with Image.open(lossless_path) as reopened:
            reopened.load()
            lossless_ok = reopened.size == image.size and ("A" in reopened.getbands() or not has_alpha)
        with Image.open(lossy_path) as reopened:
            reopened.load()
            lossy_ok = reopened.size == image.size and ("A" in reopened.getbands() or not has_alpha)
            lossy_metrics = quality_metrics(converted, reopened)

    print(json.dumps({
        "losslessOk": lossless_ok,
        "lossyOk": lossy_ok,
        "lossyMetrics": lossy_metrics,
        "mode": image.mode,
        "size": list(image.size),
    }))


if __name__ == "__main__":
    main()

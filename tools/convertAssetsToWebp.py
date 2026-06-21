from __future__ import annotations

import hashlib
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, features


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
EXCLUDED_DIRS = {".git", "dist", "node_modules", "WEBP_SOURCE_ASSETS"}
TEXT_SUFFIXES = {".js", ".jsx", ".css", ".html", ".json", ".md", ".cjs", ".mjs"}
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def convert_png(source: Path) -> dict[str, object]:
    destination = source.with_suffix(".webp")
    temporary = destination.with_suffix(".webp.tmp")
    if destination.exists():
        raise RuntimeError(f"Destination already exists: {destination}")

    with Image.open(source) as image:
        image.load()
        original_size = image.size
        original_mode = image.mode
        has_alpha = "A" in image.getbands() or "transparency" in image.info
        converted = image.convert("RGBA" if has_alpha else "RGB")
        converted.save(
            temporary,
            format="WEBP",
            lossless=False,
            quality=92,
            alpha_quality=100,
            method=4,
            exact=True,
        )

    with Image.open(temporary) as check:
        check.load()
        if check.size != original_size:
            raise RuntimeError(f"Dimension mismatch: {source}")
        if has_alpha and "A" not in check.getbands():
            raise RuntimeError(f"Alpha channel missing: {source}")

    os.replace(temporary, destination)
    return {
        "source": source.relative_to(ROOT).as_posix(),
        "webp": destination.relative_to(ROOT).as_posix(),
        "width": original_size[0],
        "height": original_size[1],
        "mode": original_mode,
        "png_bytes": source.stat().st_size,
        "webp_bytes": destination.stat().st_size,
        "png_sha256": sha256(source),
        "webp_sha256": sha256(destination),
    }


def update_references() -> list[str]:
    changed: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if path == Path(__file__).resolve() or any(part in EXCLUDED_DIRS for part in path.relative_to(ROOT).parts):
            continue
        text = path.read_text(encoding="utf-8")
        updated = text.replace(".png", ".webp").replace(".PNG", ".webp")
        if updated != text:
            path.write_text(updated, encoding="utf-8", newline="\n")
            changed.append(path.relative_to(ROOT).as_posix())
    return changed


def main() -> None:
    if not features.check("webp"):
        raise RuntimeError("This Pillow runtime does not support WebP.")

    sources = sorted(PUBLIC.rglob("*.png"))
    if not sources:
        print(json.dumps({"converted": 0, "message": "No PNG assets found."}, indent=2))
        return

    records: list[dict[str, object]] = []
    try:
        with ThreadPoolExecutor(max_workers=min(4, os.cpu_count() or 1)) as executor:
            jobs = {executor.submit(convert_png, source): source for source in sources}
            for index, future in enumerate(as_completed(jobs), start=1):
                record = future.result()
                records.append(record)
                print(f"[{index}/{len(sources)}] {record['source']}", flush=True)
    except Exception:
        for source in sources:
            source.with_suffix(".webp").unlink(missing_ok=True)
            source.with_suffix(".webp.tmp").unlink(missing_ok=True)
        raise

    changed_files = update_references()
    for source in sources:
        source.unlink()

    report = {
        "converted": len(records),
        "png_bytes": sum(int(record["png_bytes"]) for record in records),
        "webp_bytes": sum(int(record["webp_bytes"]) for record in records),
        "references_updated": changed_files,
        "assets": records,
    }
    report_path = ROOT / "webp-conversion-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "assets"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

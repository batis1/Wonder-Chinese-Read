"""Build responsive WebP versions of course photos without changing the originals."""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
manifest = {}
original_bytes = full_bytes = thumbnail_bytes = 0
for source in sorted((ROOT / "data" / "covers").glob("*.jpg")):
    original = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
    variants = []
    for maximum in sorted({min(320, original.width), min(960, original.width)}):
        image = original.copy()
        image.thumbnail((maximum, 2000), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=84, method=6)
        content = output.getvalue()
        filename = f"{source.stem}-{hashlib.sha256(content).hexdigest()[:10]}.webp"
        (source.parent / filename).write_bytes(content)
        variants.append({"src": f"/media/covers/{filename}", "width": image.width, "height": image.height, "bytes": len(content)})
    full = variants[-1]
    manifest[f"/media/covers/{source.name}"] = {"src": full["src"], "width": full["width"], "height": full["height"], "srcSet": ", ".join(f"{item['src']} {item['width']}w" for item in variants)}
    original_bytes += source.stat().st_size
    full_bytes += full["bytes"]
    thumbnail_bytes += variants[0]["bytes"]
(ROOT / "src" / "assets" / "course-covers.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps({"covers": len(manifest), "originalBytes": original_bytes, "fullWebpBytes": full_bytes, "thumbnailBytes": thumbnail_bytes}))

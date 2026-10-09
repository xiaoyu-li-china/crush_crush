#!/usr/bin/env python3
"""牌槽弹窗兜底底图（无边框，柔和渐变）。python3 scripts/generate-mahjong-modal-slot-full-bg.py"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/main/mahjong/modal-slot-full-bg.png"
W, H = 328, 372
R = 22


def main() -> None:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / max(1, H - 1)
        col = (
            int(255 - 12 * t),
            int(250 - 18 * t),
            int(248 - 10 * t),
            255,
        )
        d.line([(0, y), (W, y)], fill=col)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, W, H), radius=R, fill=255)
    im.putalpha(mask)
    im = im.filter(ImageFilter.GaussianBlur(0.3))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, "PNG")
    print("[ok]", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()

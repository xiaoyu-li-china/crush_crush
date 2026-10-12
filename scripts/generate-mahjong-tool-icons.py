#!/usr/bin/env python3
"""生成麻将馆四道具 3D 圆形图标（128×128，外圈白边 + 分色球体）。用法: python3 scripts/generate-mahjong-tool-icons.py"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/main/mahjong/tools"
SIZE = 128

# (highlight, mid, shadow) — 对齐主线 hammer / shuffle / extra 分色
PALETTES = {
    "move_out": ((255, 200, 220), (255, 120, 170), (220, 60, 120)),
    "gather": ((255, 230, 150), (255, 190, 70), (230, 140, 30)),
    "shuffle": ((180, 240, 255), (70, 200, 230), (30, 150, 190)),
    "reveal": ((220, 200, 255), (160, 130, 250), (110, 80, 210)),
}


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def draw_jelly_disc(
    base: Image.Image,
    cx: float,
    cy: float,
    inner_r: float,
    palette: tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]],
) -> None:
    d = ImageDraw.Draw(base)
    hi, mid, lo = palette

    # 底影
    d.ellipse(
        (cx - inner_r * 0.85, cy + inner_r * 0.62, cx + inner_r * 0.85, cy + inner_r * 1.05),
        fill=(20, 40, 50, 55),
    )

    # 外径 ~61px；白环加宽，并多描两圈白边（对齐主线厚白圈）
    ring = 19
    outer_r = min(inner_r + ring, 61)
    inner_r = outer_r - ring
    d.ellipse(
        (cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r),
        fill=(255, 255, 255, 255),
    )
    # 外缘两圈白描边
    for w, inset in ((3, 0), (2, 3)):
        d.ellipse(
            (cx - outer_r + inset, cy - outer_r + inset, cx + outer_r - inset, cy + outer_r - inset),
            outline=(255, 255, 255, 255),
            width=w,
        )
    # 白环与彩色球交界：两圈白线 + 浅灰过渡
    for inset in (0, 2):
        d.ellipse(
            (cx - inner_r - 1 - inset, cy - inner_r - inset, cx + inner_r + 1 + inset, cy + inner_r + inset),
            outline=(255, 255, 255, 248 - inset * 20),
            width=3,
        )
    d.ellipse(
        (cx - inner_r - 3, cy - inner_r - 2, cx + inner_r + 3, cy + inner_r + 2),
        outline=(210, 218, 222, 255),
        width=2,
    )

    # 彩色球体径向渐变
    for i in range(int(inner_r), 0, -1):
        t = i / inner_r
        if t > 0.55:
            u = (t - 0.55) / 0.45
            col = (
                int(lerp(mid[0], hi[0], u)),
                int(lerp(mid[1], hi[1], u)),
                int(lerp(mid[2], hi[2], u)),
                255,
            )
        else:
            u = t / 0.55
            col = (
                int(lerp(lo[0], mid[0], u)),
                int(lerp(lo[1], mid[1], u)),
                int(lerp(lo[2], mid[2], u)),
                255,
            )
        d.ellipse((cx - i, cy - i + 1, cx + i, cy + i + 1), fill=col)

    # 内白描边
    d.ellipse(
        (cx - inner_r, cy - inner_r + 1, cx + inner_r, cy + inner_r + 1),
        outline=(255, 255, 255, 200),
        width=3,
    )
    # 左上高光
    d.ellipse(
        (cx - inner_r * 0.72, cy - inner_r * 0.88, cx - inner_r * 0.08, cy - inner_r * 0.22),
        fill=(255, 255, 255, 95),
    )
    d.ellipse(
        (cx - inner_r * 0.35, cy - inner_r * 0.55, cx + inner_r * 0.05, cy - inner_r * 0.28),
        fill=(255, 255, 255, 140),
    )
    # 底部暗缘
    d.arc(
        (cx - inner_r * 0.92, cy - inner_r * 0.2, cx + inner_r * 0.92, cy + inner_r * 1.02),
        start=15,
        end=165,
        fill=(0, 0, 0, 35),
        width=5,
    )


def icon_move_out() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_jelly_disc(img, SIZE / 2, SIZE / 2 + 1, 46, PALETTES["move_out"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((38, 68, 90, 80), radius=5, fill=(255, 255, 255, 210), outline=(255, 255, 255, 255), width=2)
    d.rounded_rectangle((50, 46, 78, 72), radius=7, fill=(255, 255, 255, 250), outline=(255, 255, 255, 255), width=2)
    d.rounded_rectangle((54, 50, 74, 64), radius=4, fill=(255, 180, 200, 255))
    d.polygon([(64, 30), (76, 44), (69, 44), (69, 56), (59, 56), (59, 44), (52, 44)], fill=(255, 255, 255, 255))
    return img


def icon_gather() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_jelly_disc(img, SIZE / 2, SIZE / 2 + 1, 46, PALETTES["gather"])
    d = ImageDraw.Draw(img)
    for box in [(40, 58, 58, 80), (70, 58, 88, 80), (55, 38, 73, 58)]:
        d.rounded_rectangle(box, radius=6, fill=(255, 255, 255, 245), outline=(255, 255, 255, 255), width=2)
        x0, y0, x1, y1 = box
        d.ellipse((x0 + 5, y0 + 5, x1 - 5, y1 - 8), fill=(255, 210, 120, 255))
    d.arc((42, 42, 86, 86), start=200, end=340, fill=(255, 255, 255, 240), width=5)
    d.polygon([(64, 90), (71, 80), (57, 80)], fill=(255, 255, 255, 255))
    return img


def icon_shuffle() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_jelly_disc(img, SIZE / 2, SIZE / 2 + 1, 46, PALETTES["shuffle"])
    d = ImageDraw.Draw(img)
    d.arc((40, 40, 88, 88), start=35, end=205, fill=(255, 255, 255, 255), width=8)
    d.arc((40, 40, 88, 88), start=215, end=25, fill=(220, 250, 255, 255), width=8)
    d.polygon([(80, 44), (92, 50), (82, 56)], fill=(255, 255, 255, 255))
    d.polygon([(48, 84), (36, 78), (46, 72)], fill=(230, 248, 255, 255))
    return img


def icon_reveal() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_jelly_disc(img, SIZE / 2, SIZE / 2 + 1, 46, PALETTES["reveal"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((38, 54, 66, 86), radius=7, fill=(140, 220, 160, 255), outline=(255, 255, 255, 255), width=2)
    d.rounded_rectangle((62, 42, 90, 74), radius=7, fill=(255, 255, 255, 250), outline=(255, 255, 255, 255), width=2)
    d.ellipse((70, 52, 84, 66), fill=(255, 200, 120, 255))
    d.arc((46, 34, 94, 82), start=285, end=15, fill=(255, 255, 255, 240), width=5)
    d.polygon([(54, 36), (46, 44), (58, 44)], fill=(255, 255, 255, 255))
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    specs = [
        ("tool-move-out.png", icon_move_out),
        ("tool-gather.png", icon_gather),
        ("tool-shuffle.png", icon_shuffle),
        ("tool-reveal.png", icon_reveal),
    ]
    for name, fn in specs:
        im = fn()
        im = im.filter(ImageFilter.SHARPEN)
        path = OUT / name
        im.save(path, "PNG")
        print("[ok]", path.relative_to(ROOT))


if __name__ == "__main__":
    main()

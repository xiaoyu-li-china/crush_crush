#!/usr/bin/env python3
"""将萌宠贴图黑/深灰底抠成透明 RGBA，尺寸对齐主线 128×128。"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
TILES = ROOT / "assets/main/tiles"
OUT_SIZE = 128
# 与 red/blue 等经典贴图一致：不透明区域最长边约 108px，四周留透明边。
CLASSIC_CONTENT_MAX = 108


def _is_background(r: int, g: int, b: int, threshold: int) -> bool:
    return max(r, g, b) <= threshold


def flood_remove_background(im: Image.Image, threshold: int = 42, similar: int = 18) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    bg = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if bg[y][x]:
            return
        r, g, b, _a = px[x, y]
        if not _is_background(r, g, b, threshold):
            return
        bg[y][x] = True
        q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        r0, g0, b0, _ = px[x, y]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h or bg[ny][nx]:
                continue
            r, g, b, _a = px[nx, ny]
            if _is_background(r, g, b, threshold) or (
                abs(r - r0) + abs(g - g0) + abs(b - b0) <= similar
                and max(r, g, b) <= threshold + 25
            ):
                bg[ny][nx] = True
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if bg[y][x]:
                opx[x, y] = (0, 0, 0, 0)
            else:
                opx[x, y] = (r, g, b, 255)

    # 贴边暗像素略降 alpha，与原版贴图抗锯齿一致
    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                continue
            r, g, b, a = opx[x, y]
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and bg[ny][nx]:
                    if max(r, g, b) < 85:
                        opx[x, y] = (r, g, b, 170)
                    break

    _r, _g, _b, alpha = out.split()
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.6))
    return Image.merge("RGBA", (_r, _g, _b, alpha))


def frame_like_classic_pet(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        raise ValueError("empty image")
    cropped = im.crop(bbox)
    cw, ch = cropped.size
    scale = CLASSIC_CONTENT_MAX / max(cw, ch)
    nw = max(1, round(cw * scale))
    nh = max(1, round(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    ox = (OUT_SIZE - nw) // 2
    oy = (OUT_SIZE - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def _corners_transparent(im: Image.Image) -> bool:
    im = im.convert("RGBA")
    w, h = im.size
    corners = (im.getpixel((0, 0)), im.getpixel((w - 1, 0)), im.getpixel((0, h - 1)), im.getpixel((w - 1, h - 1)))
    return all(a[3] < 16 for a in corners)


def fit_tile(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    if _corners_transparent(im):
        prepared = im
    else:
        prepared = flood_remove_background(im)
    return frame_like_classic_pet(prepared)


def main() -> None:
    import sys

    corgi_src = Path(sys.argv[1]) if len(sys.argv) > 1 else TILES / "corgi.png"
    jobs: list[tuple[Path, Path]] = [
        (TILES / "bear.png", TILES / "bear.png"),
        (TILES / "pig.png", TILES / "pig.png"),
        (TILES / "panda.png", TILES / "panda.png"),
        (corgi_src, TILES / "corgi.png"),
    ]

    for src, dst in jobs:
        if not src.is_file():
            raise SystemExit(f"missing {src}")
        tile = fit_tile(Image.open(src))
        tile.save(dst, optimize=True)
        px = tile.load()
        alpha0 = sum(1 for y in range(OUT_SIZE) for x in range(OUT_SIZE) if px[x, y][3] < 8)
        print(f"wrote {dst.relative_to(ROOT)} transparent={alpha0} bbox={tile.getbbox()}")


if __name__ == "__main__":
    main()

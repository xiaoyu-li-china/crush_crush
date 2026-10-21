#!/usr/bin/env python3
"""脱敏聊天长图 + 生成竖版短视频初稿（需本机 ffmpeg）。"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:
    print("pip install Pillow", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    "/Users/mac/.cursor/projects/Users-mac-Documents-workspaces-crush-crush/assets/"
    "image-7235f210-de06-40b4-9d5d-2664a44c65f9.jpg"
)
OUT_DIR = ROOT / "assets/brand/promo/chat-rejection"
GAME_CLIP = ROOT / "assets/brand/promo/21-推广视频-实机竖版-1080x1920.mp4"
W, H = 1080, 1920
FPS = 30


def blur_rect(im: Image.Image, box: tuple[int, int, int, int], radius: int = 14) -> None:
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(im.width, x1), min(im.height, y1)
    if x1 <= x0 or y1 <= y0:
        return
    region = im.crop((x0, y0, x1, y1))
    region = region.filter(ImageFilter.GaussianBlur(radius=radius))
    im.paste(region, (x0, y0))


def desensitize(src: Path, dst: Path) -> Image.Image:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    # 顶栏昵称 / 状态栏
    blur_rect(im, (0, 0, w, int(h * 0.11)), radius=16)
    # 左右头像条
    blur_rect(im, (0, int(h * 0.08), int(w * 0.22), h), radius=12)
    blur_rect(im, (int(w * 0.78), int(h * 0.08), w, h), radius=12)
    # 小程序链接卡片（中部宽带打码）
    blur_rect(im, (int(w * 0.08), int(h * 0.30), int(w * 0.92), int(h * 0.58)), radius=18)
    # 低姿态话术区（底部 plead + 表情包）
    blur_rect(im, (0, int(h * 0.62), w, h), radius=16)

    scale = 980 / w
    nw, nh = int(w * scale), int(h * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    im.save(dst, quality=92)
    return im


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ):
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def draw_multiline_center(
    im: Image.Image,
    lines: list[str],
    y: int,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    fill: tuple[int, ...] = (255, 255, 255),
    stroke: int = 3,
) -> None:
    draw = ImageDraw.Draw(im)
    spacing = 8
    sizes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    heights = [b[3] - b[1] for b in sizes]
    total_h = sum(heights) + spacing * (len(lines) - 1)
    cy = y
    for line, lh in zip(lines, heights):
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        x = (im.width - tw) // 2
        draw.text(
            (x, cy),
            line,
            font=font,
            fill=fill,
            stroke_width=stroke,
            stroke_fill=(0, 0, 0),
        )
        cy += lh + spacing


def frame_to_mp4(frames: list[Path], duration: float, out: Path) -> None:
    if not frames:
        raise ValueError("no frames")
    fr = len(frames) / duration
    run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            f"{fr:.4f}",
            "-i",
            str(frames[0].parent / "frame_%04d.jpg"),
            "-start_number",
            "0",
            "-t",
            str(duration),
            "-vf",
            f"scale={W}:{H},fps={FPS}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(out),
        ]
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    chat_path = OUT_DIR / "chat-desensitized.jpg"
    desensitize(SRC, chat_path)
    im = Image.open(chat_path)
    nw, nh = im.size

    title_font = load_font(48)
    sub_font = load_font(40)

    # --- 段1：钩子（裁切「自娱自乐」附近，竖屏居中）---
    hook_y = int(nh * 0.38)
    hook_h = int(nh * 0.22)
    hook = im.crop((0, hook_y, nw, min(nh, hook_y + hook_h)))
    hook_path = OUT_DIR / "hook-crop.jpg"
    # 铺到 1080 宽
    hook_scale = 1080 / hook.width
    hook_r = hook.resize(
        (1080, int(hook.height * hook_scale)), Image.Resampling.LANCZOS
    )
    canvas = Image.new("RGB", (W, H), (18, 18, 22))
    yoff = (H - hook_r.height) // 2
    canvas.paste(hook_r, (0, max(0, yoff)))
    draw_multiline_center(
        canvas,
        ["做了半个月小游戏", "找发行商看了一眼", "被一句话打回现实"],
        100,
        title_font,
    )
    canvas.save(hook_path, quality=92)

    hook_mp4 = OUT_DIR / "seg-hook.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(hook_path),
            "-t",
            "4.5",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(FPS),
            str(hook_mp4),
        ]
    )

    # --- 段2：长图滚动（PIL 逐帧 + 字幕）---
    scroll_mp4 = OUT_DIR / "seg-scroll.mp4"
    view_h = int(H * 0.72)
    y_start = int(nh * 0.14)
    y_end = int(nh * 0.52)
    duration = 18.0
    n_frames = int(duration * FPS)
    scaled = im.resize((W, int(nh * (W / nw))), Image.Resampling.LANCZOS)
    sh = scaled.height
    y_start_s = int(y_start * (W / nw))
    y_end_s = int(y_end * (W / nw))
    frames_dir = OUT_DIR / "scroll_frames"
    frames_dir.mkdir(exist_ok=True)
    for i in range(n_frames):
        t = i / max(1, n_frames - 1)
        y = int(y_start_s + (y_end_s - y_start_s) * t)
        y = min(max(0, y), max(0, sh - view_h))
        crop = scaled.crop((0, y, W, y + view_h))
        frame = Image.new("RGB", (W, H), (18, 18, 22))
        frame.paste(crop, (0, (H - view_h) // 2 - 40))
        sec = i / FPS
        if 2 <= sec < 8:
            draw_multiline_center(
                frame, ["利润55分成｜符合标准才发行"], H - 220, sub_font, (255, 230, 80)
            )
        elif 9 <= sec < 15:
            draw_multiline_center(
                frame,
                ["确实像自娱自乐的产品"],
                120,
                title_font,
                (255, 107, 107),
            )
        elif sec >= 15:
            draw_multiline_center(
                frame, ["多玩排行榜｜先感受差距"], 120, sub_font
            )
        fp = frames_dir / f"frame_{i:04d}.jpg"
        frame.save(fp, quality=85)
    # 抽帧降体积：每秒 10 张再插值 ffmpeg fps
    seq_dir = OUT_DIR / "scroll_seq"
    seq_dir.mkdir(exist_ok=True)
    step = 3
    seq_paths: list[Path] = []
    for j, i in enumerate(range(0, n_frames, step)):
        src = frames_dir / f"frame_{i:04d}.jpg"
        dst = seq_dir / f"frame_{j:04d}.jpg"
        dst.write_bytes(src.read_bytes())
        seq_paths.append(dst)
    frame_to_mp4(seq_paths, duration, scroll_mp4)

    # --- 段3：实机 + 20元转折 ---
    turn_mp4 = OUT_DIR / "seg-game.mp4"
    if GAME_CLIP.exists():
        tmp_game = OUT_DIR / "game-overlay.jpg"
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(GAME_CLIP),
                "-vframes",
                "1",
                "-vf",
                f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
                str(tmp_game),
            ]
        )
        gim = Image.open(tmp_game).convert("RGB")
        draw_multiline_center(
            gim, ["自娱自乐也跑通了 IAA"], 120, title_font
        )
        draw_multiline_center(
            gim,
            ["流量主累计约 20 元", "不多，但链路通了"],
            210,
            sub_font,
            (124, 252, 0),
        )
        draw_multiline_center(
            gim, ["发视频号｜录教程｜自己找玩家"], H - 200, sub_font
        )
        gim.save(tmp_game, quality=92)
        run(
            [
                "ffmpeg",
                "-y",
                "-loop",
                "1",
                "-i",
                str(tmp_game),
                "-t",
                "6",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-r",
                str(FPS),
                str(turn_mp4),
            ]
        )
        # 再接实机动效
        turn2 = OUT_DIR / "seg-game-motion.mp4"
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(turn_mp4),
                "-i",
                str(GAME_CLIP),
                "-filter_complex",
                f"[1:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},trim=0:6,setpts=PTS-STARTPTS[v1];"
                f"[0:v][v1]concat=n=2:v=1:a=0",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                str(turn2),
            ]
        )
        turn_mp4 = turn2
    else:
        turn_mp4 = scroll_mp4

    # --- 拼接 ---
    final = OUT_DIR / "发行商拒了-竖版初稿-1080x1920.mp4"
    list_file = OUT_DIR / "concat.txt"
    parts = [hook_mp4, scroll_mp4]
    if turn_mp4 != scroll_mp4:
        parts.append(turn_mp4)
    list_file.write_text(
        "\n".join(f"file '{p.name}'" for p in parts) + "\n",
        encoding="utf-8",
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            str(final),
        ]
    )

    # 口播稿
    script = OUT_DIR / "口播稿-45秒.txt"
    script.write_text(
        """【0–4s 钩子】
做了大半个月的小游戏，找发行商看了一眼，被秒拒。理由很扎心。

【4–22s 过程】
个人开发者满怀期待：符合标准就发行，利润五五分成。
结果对方只留下一句——确实有点像自娱自乐的产品。
人家还补刀：多玩别人的游戏，多看看排行榜，感受一下。

【22–34s 转折】
从商业发行角度，这话不算错，我的确还缺商业化打磨。
但这款「自娱自乐」的小游戏，帮我跑通了微信流量主——累计大概就 20 块钱。
不多，说明广告链路是通的。

【34–45s 收尾】
我不硬蹭 55 分成那条路。就想做轻量 IAA，把制作过程录成教程。
发行商看不上没关系，我自己发视频号，自己找玩家。
""",
        encoding="utf-8",
    )
    print(f"\n完成: {final}\n口播稿: {script}")


if __name__ == "__main__":
    main()

"""Generate joyful + cool candy-match looping BGM (亮、蹦、炫)."""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SR = 16000
BPM = 144
BEAT = 60.0 / BPM
BARS = 8  # build → drop 感更强

C2, G2 = 36, 43
C3, D3, E3, F3, G3, A3, B3 = 48, 50, 52, 53, 55, 57, 59
C4, D4, E4, F4, G4, A4, B4 = 60, 62, 64, 65, 67, 69, 71
C5, D5, E5, F5, Fs5, G5, A5, B5 = 72, 74, 76, 77, 78, 79, 81, 83
C6, D6, E6, G6 = 84, 86, 88, 91


def midi(n: float) -> float:
    return 440.0 * (2 ** ((n - 69) / 12.0))


def env(i: int, n: int, attack: float = 0.005, release: float = 0.05) -> float:
    if n <= 1:
        return 0.0
    t = i / SR
    dur = n / SR
    a = min(1.0, t / attack) if attack > 0 else 1.0
    r = 1.0
    if release > 0 and t > dur - release:
        r = max(0.0, (dur - t) / release)
    return a * r * (1.0 + 0.45 * math.exp(-t * 40))


def tone(freq: float, i: int, kind: str = "lead") -> float:
    t = i / SR
    ph = 2 * math.pi * freq * t
    s = math.sin(ph)
    if kind == "lead":
        # supersaw-ish + slight bit of square for “炫”
        det = (
            math.sin(ph * 0.997)
            + math.sin(ph)
            + math.sin(ph * 1.003)
            + 0.55 * math.sin(ph * 1.007)
        ) * 0.28
        sq = 0.22 * (1.0 if math.sin(ph) >= 0 else -1.0)
        vib = 1 + 0.04 * math.sin(2 * math.pi * 7.2 * t)
        return (det + sq) * vib
    if kind == "bass":
        # punchy sub + mid growl
        return 0.7 * s + 0.35 * math.sin(ph * 2) * math.exp(-t * 8) + 0.15 * math.sin(ph * 3)
    if kind == "bell":
        return (
            0.45 * s
            + 0.35 * math.sin(ph * 2.01) * math.exp(-t * 8)
            + 0.2 * math.sin(ph * 3.02) * math.exp(-t * 14)
            + 0.12 * math.sin(ph * 5.1) * math.exp(-t * 22)
        )
    if kind == "laser":
        # FM sparkle / game power-up feel
        mod = math.sin(2 * math.pi * freq * 2.7 * t) * (12 * math.exp(-t * 9))
        return math.sin(ph + mod) * math.exp(-t * 3.5)
    # pad
    return 0.55 * s + 0.25 * math.sin(ph * 1.5) + 0.2 * math.sin(ph * 0.5)


def render_notes(
    notes: list[tuple[float, float, float]],
    volume: float,
    kind: str = "lead",
    attack: float = 0.005,
    release: float = 0.06,
) -> list[float]:
    n_total = int(BARS * 4 * BEAT * SR)
    buf = [0.0] * n_total
    for m, beats, start in notes:
        f = midi(m)
        s0 = int(start * BEAT * SR)
        n = max(1, int(beats * BEAT * SR))
        for i in range(n):
            idx = s0 + i
            if idx >= n_total:
                break
            buf[idx] += tone(f, i, kind) * volume * env(i, n, attack, release)
    return buf


def place(motif: list[tuple[float, float]], start: float, out: list[tuple[float, float, float]]) -> None:
    t = start
    for m, b in motif:
        out.append((m, b, t))
        t += b


def noise(i: int) -> float:
    return ((i * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF * 2 - 1


def main() -> None:
    # —— 欢快主歌：跳跃大调 + 切分 ——
    lead: list[tuple[float, float, float]] = []
    # bars 0-1 call
    place(
        [
            (C5, 0.25), (E5, 0.25), (G5, 0.5), (C6, 0.5),
            (G5, 0.25), (A5, 0.25), (G5, 0.5), (E5, 0.5), (C5, 1.0),
        ],
        0,
        lead,
    )
    # bars 2-3 response higher
    place(
        [
            (A5, 0.25), (C6, 0.25), (E6, 0.5), (D6, 0.5),
            (C6, 0.25), (B5, 0.25), (A5, 0.5), (G5, 0.5), (E5, 1.0),
        ],
        8,
        lead,
    )
    # bars 4-5 drop hook（更炫：八度跳）
    place(
        [
            (C6, 0.5), (G5, 0.25), (E5, 0.25), (C5, 0.5), (E5, 0.5),
            (G5, 0.25), (A5, 0.25), (C6, 0.5), (E6, 0.5), (C6, 1.0),
        ],
        16,
        lead,
    )
    # bars 6-7 climax resolve
    place(
        [
            (G5, 0.25), (A5, 0.25), (B5, 0.25), (C6, 0.25),
            (E6, 0.5), (D6, 0.5), (C6, 0.5), (G5, 0.5), (E5, 0.5), (C5, 0.5),
        ],
        24,
        lead,
    )

    # 和声层偏亮
    harmony = [(m - 7, b * 0.9, s + 0.02) for m, b, s in lead if (s * 2) % 2 < 0.01]

    # 侧链感贝斯：四拍根音 + 切分
    bass: list[tuple[float, float, float]] = []
    prog = [
        (C3, G3), (C3, G3), (A3, E3), (A3, E3),
        (F3, C3), (F3, C3), (G3, D3), (G3, C3),
    ]
    t = 0.0
    for root, fifth in prog:
        # 蹦迪式：根 / 五 / 根八度 / 切分
        bass += [
            (root, 0.5, t),
            (fifth, 0.25, t + 0.5),
            (root + 12, 0.25, t + 0.75),
            (root, 0.5, t + 1.0),
            (fifth + 12, 0.25, t + 1.5),
            (root + 7, 0.25, t + 1.75),
        ]
        t += 2.0

    # 激光琶音（炫酷点缀）
    lasers: list[tuple[float, float, float]] = []
    for bar in range(BARS):
        base = bar * 4.0
        if bar % 2 == 0:
            seq = [C6, E6, G6, E6, C6, G5, E6, C6]
        else:
            seq = [A5, C6, E6, G6, E6, C6, A5, E6]
        for i, m in enumerate(seq):
            lasers.append((m, 0.2, base + i * 0.5))
        # 小节末尾上扫
        for i, m in enumerate([G5, A5, B5, C6, D6, E6]):
            lasers.append((m, 0.08, base + 3.4 + i * 0.08))

    # 铃铛高光
    bells: list[tuple[float, float, float]] = []
    for bar in range(BARS):
        base = bar * 4.0
        for i, m in enumerate([E6, C6, G5, C6, A5, E6, C6, G6]):
            bells.append((m, 0.18, base + 0.25 + i * 0.5))

    # 明亮 pad
    pads: list[tuple[float, float, float]] = []
    chords = [
        (0, [C4, E4, G4, C5]),
        (8, [A3, C4, E4, A4]),
        (16, [F3, A3, C4, F4]),
        (24, [G3, B3, D4, G4]),
    ]
    for start, ch in chords:
        for m in ch:
            pads.append((m, 7.5, start))

    n_total = int(BARS * 4 * BEAT * SR)
    out = [0.0] * n_total
    for layer in [
        render_notes(lead, 0.26, "lead", 0.003, 0.055),
        render_notes(harmony, 0.1, "lead", 0.008, 0.08),
        render_notes(bass, 0.2, "bass", 0.002, 0.04),
        render_notes(lasers, 0.11, "laser", 0.001, 0.03),
        render_notes(bells, 0.09, "bell", 0.001, 0.04),
        render_notes(pads, 0.055, "pad", 0.08, 0.6),
    ]:
        for i in range(n_total):
            out[i] += layer[i]

    def noise_hit(start_beat: float, volume: float, dur: float = 0.05) -> None:
        s0 = int(start_beat * BEAT * SR)
        n = int(dur * SR)
        for i in range(n):
            idx = s0 + i
            if idx >= n_total:
                break
            out[idx] += noise(i + s0) * volume * env(i, n, 0.001, dur * 0.7)

    def kick(start_beat: float, volume: float = 0.32) -> None:
        s0 = int(start_beat * BEAT * SR)
        n = int(0.14 * SR)
        for i in range(n):
            idx = s0 + i
            if idx >= n_total:
                break
            tt = i / SR
            f = 140 * math.exp(-tt * 32) + 40
            out[idx] += math.sin(2 * math.pi * f * tt) * volume * env(i, n, 0.001, 0.09)

    def snare(start_beat: float, volume: float = 0.2) -> None:
        s0 = int(start_beat * BEAT * SR)
        n = int(0.09 * SR)
        for i in range(n):
            idx = s0 + i
            if idx >= n_total:
                break
            tt = i / SR
            body = math.sin(2 * math.pi * 180 * tt) * math.exp(-tt * 28)
            out[idx] += (0.45 * body + 0.7 * noise(i + s0)) * volume * env(i, n, 0.001, 0.06)

    # 鼓组：四踩 + 强拍拍手 + 开镲闪光
    for bar in range(BARS):
        base = bar * 4.0
        # four-on-the-floor
        for k in range(4):
            kick(base + k, 0.34 if k == 0 else 0.26)
        snare(base + 1, 0.22)
        snare(base + 3, 0.26)
        # 16ths hats，后半小节更密更炫
        dens = 16 if bar >= 4 else 8
        step = 4.0 / dens
        for k in range(dens):
            vol = 0.055 if k % 2 else 0.03
            if bar >= 4:
                vol *= 1.25
            noise_hit(base + k * step, vol, 0.028)
        # 小节起音 whoosh
        if bar in (0, 4):
            s0 = int((base - 0.15 if base > 0 else 0) * BEAT * SR)
            n = int(0.25 * SR)
            for i in range(n):
                idx = s0 + i
                if idx < 0 or idx >= n_total:
                    continue
                tt = i / SR
                f = 200 + 1800 * (i / n)
                out[idx] += (
                    math.sin(2 * math.pi * f * tt) * 0.08
                    + noise(i) * 0.06
                ) * (i / n) * (1 - i / n) * 2.2

    # 侧链泵感：跟 kick 对齐压一点 pad/lead 混响感
    for i in range(n_total):
        beat_pos = (i / SR) / BEAT
        phase = beat_pos % 1.0
        pump = 0.72 + 0.28 * min(1.0, phase / 0.18)  # 每拍开头压一下
        out[i] *= 0.55 + 0.45 * pump

    peak = max(abs(x) for x in out) or 1.0
    out = [math.tanh(x * (0.96 / peak) * 1.35) for x in out]

    # 循环交叉淡入淡出
    fade = int(0.05 * SR)
    for i in range(fade):
        g = i / fade
        out[i] = out[i] * g + out[n_total - fade + i] * (1 - g) * 0.25
        out[n_total - fade + i] *= (1 - g) + g * 0.75

    path = Path(__file__).resolve().parents[1] / "assets/main/audio/bgm_main.wav"
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(
            b"".join(
                struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in out
            )
        )
    print(f"wrote {path.name} {path.stat().st_size / 1024:.1f}KB {len(out) / SR:.2f}s BPM={BPM}")


if __name__ == "__main__":
    main()

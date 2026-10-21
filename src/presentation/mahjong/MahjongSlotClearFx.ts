/** 槽位三消落地时的轻量反馈（扩环 + 闪星，与主线 juice 配色接近）。 */

export interface MahjongSlotClearRing {
  cx: number;
  cy: number;
  startMs: number;
  durationMs: number;
}

export function spawnMahjongSlotClearRings(
  rings: MahjongSlotClearRing[],
  cx: number,
  cy: number,
  nowMs: number,
  count = 1,
): void {
  for (let i = 0; i < count; i += 1) {
    rings.push({
      cx,
      cy: cy - i * 4,
      startMs: nowMs + i * 40,
      durationMs: 460 + i * 30,
    });
  }
}

export function pruneMahjongSlotClearRings(
  rings: MahjongSlotClearRing[],
  nowMs: number,
): boolean {
  let any = false;
  for (let i = rings.length - 1; i >= 0; i -= 1) {
    const r = rings[i]!;
    if (nowMs - r.startMs >= r.durationMs) {
      rings.splice(i, 1);
    } else {
      any = true;
    }
  }
  return any;
}

function drawMiniSparkle(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.2, r * 0.35);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.strokeStyle = '#96f2d7';
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.65, y - r * 0.65);
  ctx.lineTo(x + r * 0.65, y + r * 0.65);
  ctx.moveTo(x + r * 0.65, y - r * 0.65);
  ctx.lineTo(x - r * 0.65, y + r * 0.65);
  ctx.stroke();
  ctx.restore();
}

export function drawMahjongSlotClearRings(
  ctx: WxCanvasRenderingContext2D,
  rings: readonly MahjongSlotClearRing[],
  nowMs: number,
): void {
  for (const ring of rings) {
    const elapsed = nowMs - ring.startMs;
    if (elapsed < 0) {
      continue;
    }
    const t = Math.min(1, elapsed / ring.durationMs);
    const fade = (1 - t) * (1 - t);
    const baseR = 18 + t * 52;

    ctx.save();
    ctx.globalAlpha = fade * 0.92;
    ctx.strokeStyle = '#51cf66';
    ctx.lineWidth = 3.5 * (1 - t * 0.35);
    ctx.beginPath();
    ctx.arc(ring.cx, ring.cy, baseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = fade * 0.55;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.cx, ring.cy, baseR * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    if (t < 0.55) {
      drawMiniSparkle(ctx, ring.cx, ring.cy, 5 + (1 - t) * 6, fade);
    }
    ctx.restore();
  }
}

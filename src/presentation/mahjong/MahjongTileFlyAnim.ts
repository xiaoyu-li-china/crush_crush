export interface MahjongFlyAnim {
  type: number;
  fromX: number;
  fromY: number;
  fromW: number;
  fromH: number;
  fromRot: number;
  toX: number;
  toY: number;
  toW: number;
  toH: number;
  startMs: number;
  durationMs: number;
}

export interface MahjongFlySample {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  alpha: number;
  lift: number;
  done: boolean;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function createMahjongFlyAnim(params: Omit<MahjongFlyAnim, 'startMs' | 'durationMs'> & {
  startMs: number;
  durationMs?: number;
}): MahjongFlyAnim {
  return {
    ...params,
    durationMs: params.durationMs ?? 320,
  };
}

export function sampleMahjongFlyAnim(anim: MahjongFlyAnim, nowMs: number): MahjongFlySample {
  const elapsed = nowMs - anim.startMs;
  const t = Math.min(1, Math.max(0, elapsed / anim.durationMs));
  const e = easeOutCubic(t);
  const arc = Math.sin(t * Math.PI) * Math.max(12, anim.fromH * 0.35);
  const pop = 1 + Math.sin(t * Math.PI) * 0.08;
  return {
    x: lerp(anim.fromX, anim.toX, e),
    y: lerp(anim.fromY, anim.toY, e) - arc,
    w: lerp(anim.fromW, anim.toW, e) * pop,
    h: lerp(anim.fromH, anim.toH, e) * pop,
    rot: lerp(anim.fromRot, 0, e),
    alpha: t < 0.08 ? t / 0.08 : 1,
    lift: -arc * 0.15,
    done: t >= 1,
  };
}

export function pruneMahjongFlyAnims(anims: MahjongFlyAnim[], nowMs: number): boolean {
  let anyActive = false;
  for (let i = anims.length - 1; i >= 0; i -= 1) {
    if (sampleMahjongFlyAnim(anims[i]!, nowMs).done) {
      anims.splice(i, 1);
    } else {
      anyActive = true;
    }
  }
  return anyActive;
}

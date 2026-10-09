import type { MahjongTileHit } from './MahjongPileLayout';

const SWAY_CLAMP = 36;

export interface MahjongPileSway {
  ox: number;
  oy: number;
  rot: number;
  vx: number;
  vy: number;
  vr: number;
}

export function createMahjongPileSway(): MahjongPileSway {
  return { ox: 0, oy: 0, rot: 0, vx: 0, vy: 0, vr: 0 };
}

function clampSway(s: MahjongPileSway): void {
  s.ox = Math.max(-SWAY_CLAMP, Math.min(SWAY_CLAMP, s.ox));
  s.oy = Math.max(-SWAY_CLAMP, Math.min(SWAY_CLAMP, s.oy));
  s.rot = Math.max(-0.08, Math.min(0.08, s.rot));
}

/** 滑动牌堆：即时位移 + 速度，便于一眼看出在晃。 */
export function pokeMahjongPileSway(s: MahjongPileSway, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) {
    return;
  }
  s.ox += dx * 0.58;
  s.oy += dy * 0.58;
  s.vx += dx * 0.32;
  s.vy += dy * 0.32;
  s.vr += (dx - dy) * 0.0014;
  clampSway(s);
}

export function updateMahjongPileSway(s: MahjongPileSway, dtMs: number): boolean {
  const dt = Math.min(48, Math.max(1, dtMs));
  const damp = Math.exp(-dt / 420);
  const spring = 0.004 * dt;

  s.ox += s.vx * (dt / 16.67);
  s.oy += s.vy * (dt / 16.67);
  s.rot += s.vr * (dt / 16.67);
  clampSway(s);

  s.vx = (s.vx - s.ox * spring) * damp;
  s.vy = (s.vy - s.oy * spring) * damp;
  s.vr = (s.vr - s.rot * spring * 1.1) * damp;

  const still =
    Math.abs(s.vx) > 0.03 ||
    Math.abs(s.vy) > 0.03 ||
    Math.abs(s.vr) > 0.00003 ||
    Math.abs(s.ox) > 0.2 ||
    Math.abs(s.oy) > 0.2 ||
    Math.abs(s.rot) > 0.0002;
  return still;
}

export function tileMahjongPileSwayOffset(
  s: MahjongPileSway,
  nx: number,
  ny: number,
  layerDepth: number,
): { dx: number; dy: number; drot: number } {
  const depth = 0.78 + layerDepth * 0.42;
  const px = (nx - 0.5) * 0.55;
  const py = (ny - 0.5) * 0.55;
  return {
    dx: s.ox * depth + s.ox * px * 0.35,
    dy: s.oy * depth + s.oy * py * 0.35,
    drot: s.rot * depth * 1.35,
  };
}

/** 牌桌背景随牌堆轻微联动。 */
export function mahjongPileSwayBackgroundShift(s: MahjongPileSway): { dx: number; dy: number } {
  return { dx: s.ox * 0.22, dy: s.oy * 0.22 };
}

export function applyMahjongPileSwayToHits(
  hits: MahjongTileHit[],
  poses: ReadonlyArray<{ nx: number; ny: number; z: number }>,
  zMax: number,
  sway: MahjongPileSway,
): void {
  for (const hit of hits) {
    const pose = poses[hit.index];
    const layerDepth = (pose?.z ?? hit.index) / Math.max(1, zMax);
    const { dx, dy, drot } = tileMahjongPileSwayOffset(
      sway,
      pose?.nx ?? 0.5,
      pose?.ny ?? 0.5,
      layerDepth,
    );
    hit.x += dx;
    hit.y += dy;
    hit.rot += drot;
  }
}

/** 单张牌滑动抖动（与全局 pileSway 独立）。 */
export type MahjongTileJitter = MahjongPileSway;

const TILE_JITTER_CLAMP = 22;

export function createMahjongTileJitter(): MahjongTileJitter {
  return createMahjongPileSway();
}

export function syncMahjongTileJitters(jitters: MahjongTileJitter[], pileLength: number): void {
  while (jitters.length < pileLength) {
    jitters.push(createMahjongTileJitter());
  }
  if (jitters.length > pileLength) {
    jitters.length = pileLength;
  }
}

function clampTileJitter(j: MahjongTileJitter): void {
  j.ox = Math.max(-TILE_JITTER_CLAMP, Math.min(TILE_JITTER_CLAMP, j.ox));
  j.oy = Math.max(-TILE_JITTER_CLAMP, Math.min(TILE_JITTER_CLAMP, j.oy));
  j.rot = Math.max(-0.12, Math.min(0.12, j.rot));
}

export function pokeMahjongTileJitter(j: MahjongTileJitter, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) {
    return;
  }
  j.ox += dx * 0.42;
  j.oy += dy * 0.42;
  j.vx += dx * 0.68;
  j.vy += dy * 0.68;
  j.vr += (dx - dy) * 0.0032;
  clampTileJitter(j);
}

export function updateMahjongTileJitters(jitters: readonly MahjongTileJitter[], dtMs: number): boolean {
  let any = false;
  for (const j of jitters) {
    const dt = Math.min(48, Math.max(1, dtMs));
    const damp = Math.exp(-dt / 320);
    const spring = 0.0055 * dt;

    j.ox += j.vx * (dt / 16.67);
    j.oy += j.vy * (dt / 16.67);
    j.rot += j.vr * (dt / 16.67);
    clampTileJitter(j);

    j.vx = (j.vx - j.ox * spring) * damp;
    j.vy = (j.vy - j.oy * spring) * damp;
    j.vr = (j.vr - j.rot * spring * 1.15) * damp;

    if (
      Math.abs(j.vx) > 0.04 ||
      Math.abs(j.vy) > 0.04 ||
      Math.abs(j.vr) > 0.00004 ||
      Math.abs(j.ox) > 0.15 ||
      Math.abs(j.oy) > 0.15 ||
      Math.abs(j.rot) > 0.00015
    ) {
      any = true;
    }
  }
  return any;
}

function pointInMahjongTileHit(
  x: number,
  y: number,
  hit: MahjongTileHit,
  pad: number,
): boolean {
  return (
    x >= hit.x - pad &&
    x <= hit.x + hit.w + pad &&
    y >= hit.y - pad &&
    y <= hit.y + hit.h + pad
  );
}

/** 手指在牌堆上滑动时，仅对划过的牌施加抖动。 */
export function pokeMahjongTilesOnPointerMove(
  hits: readonly MahjongTileHit[],
  jitters: MahjongTileJitter[],
  prevX: number,
  prevY: number,
  x: number,
  y: number,
  dx: number,
  dy: number,
): void {
  if (hits.length === 0 || (dx === 0 && dy === 0)) {
    return;
  }
  let maxIndex = 0;
  for (const hit of hits) {
    maxIndex = Math.max(maxIndex, hit.index);
  }
  syncMahjongTileJitters(jitters, maxIndex + 1);
  const dist = Math.hypot(x - prevX, y - prevY);
  const steps = Math.max(1, Math.ceil(dist / 10));
  const pad = Math.max(8, hits[0]?.w ? hits[0].w * 0.08 : 8);
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const px = prevX + (x - prevX) * t;
    const py = prevY + (y - prevY) * t;
    const sdx = dx / steps;
    const sdy = dy / steps;
    for (const hit of hits) {
      if (!pointInMahjongTileHit(px, py, hit, pad)) {
        continue;
      }
      const j = jitters[hit.index];
      if (j) {
        pokeMahjongTileJitter(j, sdx, sdy);
      }
    }
  }
}

export function applyMahjongTileJitterToHits(
  hits: MahjongTileHit[],
  jitters: readonly MahjongTileJitter[],
): void {
  for (const hit of hits) {
    const j = jitters[hit.index];
    if (!j) {
      continue;
    }
    hit.x += j.ox;
    hit.y += j.oy;
    hit.rot += j.rot;
  }
}

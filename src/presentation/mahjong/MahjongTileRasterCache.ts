import type { MahjongTileImageLookup } from './MahjongHallUi';
import {
  MAHJONG_PILE_REF_POSE_SCALE,
  mahjongBlockShape,
  mahjongPileTileWidth,
} from './MahjongPileLayout';
import {
  MAHJONG_STAND_EDGE_LONG,
  MAHJONG_STAND_EDGE_SHORT,
  MAHJONG_STAND_FLAT,
  MAHJONG_STAND_TILT,
} from '../../logic/mahjong/MahjongPilePoses';

export type DrawStandingMahjongTileBlocksFn = (
  ctx: WxCanvasRenderingContext2D,
  type: number,
  stand: number,
  faceDown: boolean,
  faceW: number,
  lookup: MahjongTileImageLookup | undefined,
) => { w: number; h: number };

export interface MahjongTileRasterBlit {
  canvas: WxCanvas;
  w: number;
  h: number;
}

interface RasterEntry extends MahjongTileRasterBlit {
  themeKey: string;
}

const MAX_ENTRIES = 160;
const cache = new Map<string, RasterEntry>();
const touchOrder: string[] = [];

let rasterScaleMemo = 0;

export function clearMahjongTileRasterCache(): void {
  cache.clear();
  touchOrder.length = 0;
  rasterScaleMemo = 0;
}

function createOffscreenCanvas(width: number, height: number): WxCanvas | null {
  try {
    const wxApi = (globalThis as { wx?: { createCanvas?: () => WxCanvas } }).wx;
    if (!wxApi?.createCanvas) {
      return null;
    }
    const canvas = wxApi.createCanvas();
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    return canvas;
  } catch {
    return null;
  }
}

function resolveRasterScale(): number {
  if (rasterScaleMemo > 0) {
    return rasterScaleMemo;
  }
  let scale = 1;
  try {
    const wxApi = (globalThis as { wx?: { getSystemInfoSync?: () => { pixelRatio?: number } } }).wx;
    const pr = wxApi?.getSystemInfoSync?.()?.pixelRatio ?? 1;
    scale = pr >= 2 ? 2 : 1;
  } catch {
    scale = 1;
  }
  rasterScaleMemo = scale;
  return scale;
}

/** 将 faceW 量化，减少缓存键数量。 */
export function quantizeMahjongTileFaceW(faceW: number): number {
  return Math.max(6, Math.round(faceW * 4) / 4);
}

function cacheKey(
  themeKey: string,
  type: number,
  stand: number,
  faceDown: boolean,
  faceW: number,
  scale: number,
): string {
  return `${themeKey}|${type}|${stand}|${faceDown ? 1 : 0}|${faceW}|s${scale}`;
}

function touchKey(key: string): void {
  const idx = touchOrder.indexOf(key);
  if (idx >= 0) {
    touchOrder.splice(idx, 1);
  }
  touchOrder.push(key);
  while (touchOrder.length > MAX_ENTRIES) {
    const evict = touchOrder.shift();
    if (evict) {
      cache.delete(evict);
    }
  }
}

export function getMahjongTileRasterBlit(
  themeKey: string,
  type: number,
  stand: number,
  faceDown: boolean,
  faceW: number,
  lookup: MahjongTileImageLookup | undefined,
  rasterize: DrawStandingMahjongTileBlocksFn,
): MahjongTileRasterBlit | null {
  const scale = resolveRasterScale();
  const qFaceW = quantizeMahjongTileFaceW(faceW);
  const key = cacheKey(themeKey, type, stand, faceDown, qFaceW, scale);
  const hit = cache.get(key);
  if (hit) {
    touchKey(key);
    return hit;
  }

  const pad = 3;
  const shape = mahjongBlockShape(stand);
  const boundsW = qFaceW * shape.topW;
  const boundsH = qFaceW * (shape.topH + shape.ext);
  const logicalW = boundsW + pad * 2;
  const logicalH = boundsH + pad * 2;
  const canvas = createOffscreenCanvas(logicalW * scale, logicalH * scale);
  if (!canvas) {
    return null;
  }
  const off = canvas.getContext('2d');
  if (!off) {
    return null;
  }
  off.clearRect(0, 0, canvas.width, canvas.height);
  off.save();
  off.scale(scale, scale);
  off.translate(logicalW / 2, logicalH / 2);
  rasterize(off, type, stand, faceDown, qFaceW, lookup);
  off.restore();

  const entry: RasterEntry = {
    themeKey,
    canvas,
    w: logicalW,
    h: logicalH,
  };
  cache.set(key, entry);
  touchKey(key);
  return entry;
}

export function mahjongTileRasterEligible(opts: {
  alpha?: number;
  lift?: number;
  rasterThemeKey?: string;
}): boolean {
  if ((opts.alpha ?? 1) !== 1) {
    return false;
  }
  if ((opts.lift ?? 0) !== 0) {
    return false;
  }
  if (!opts.rasterThemeKey) {
    return false;
  }
  return true;
}

/** 进关后预热常见牌面，减少首帧卡顿。 */
export function warmMahjongTileRasterCache(
  themeKey: string,
  typeCount: number,
  lookup: MahjongTileImageLookup | undefined,
  rasterize: DrawStandingMahjongTileBlocksFn,
  screenWidth = 390,
): void {
  if (!lookup || !themeKey) {
    return;
  }
  const faceW = mahjongPileTileWidth(screenWidth, MAHJONG_PILE_REF_POSE_SCALE);
  const types = Math.min(Math.max(1, typeCount), 10);
  const stands = [
    MAHJONG_STAND_FLAT,
    MAHJONG_STAND_TILT,
    MAHJONG_STAND_EDGE_SHORT,
    MAHJONG_STAND_EDGE_LONG,
  ];
  for (let type = 0; type < types; type += 1) {
    for (const stand of stands) {
      getMahjongTileRasterBlit(themeKey, type, stand, false, faceW, lookup, rasterize);
      getMahjongTileRasterBlit(themeKey, type, stand, true, faceW, lookup, rasterize);
    }
  }
}

import {
  MAHJONG_STAND_EDGE_LONG,
  MAHJONG_STAND_EDGE_SHORT,
  MAHJONG_STAND_TILT,
  MAHJONG_STAND_UPRIGHT,
  type MahjongTilePose,
} from '../../logic/mahjong/MahjongPilePoses';
import { mahjongPlayMetrics } from './MahjongPlayLayoutMetrics';

export type { MahjongTilePose } from '../../logic/mahjong/MahjongPilePoses';
export { appendRandomPilePose, buildMahjongPilePoses } from '../../logic/mahjong/MahjongPilePoses';

/** 相对设计稿 105 关 pose.scale 的基准。 */
export const MAHJONG_PILE_REF_POSE_SCALE = 0.16;

/** 在基准宽度上的整体倍率（改后需 npm run build:wechat）。 */
export const MAHJONG_PILE_TILE_SIZE_FACTOR = 0.99;

/** 105 关 scale=0.16 时牌宽占屏宽比例。 */
const MAHJONG_PILE_TILE_WIDTH_RATIO = 0.21;

/** 牌面 88×120 的高宽比。 */
export const MAHJONG_TILE_FACE_ASPECT = 120 / 88;

/** 旧版竖长 hit 比例，保留给外部引用。 */
export const MAHJONG_TILE_UPRIGHT_HEIGHT_RATIO = 1.48;

/**
 * 俯视实心牌块（以牌面宽 = 1 为单位）：
 * top = 朝上可见面，ext = 向下露出的厚度带。
 * 横立：top 为 88×40 顶边，ext 为透视压缩后的牌面；
 * 侧立：top 为右侧窄边 + 左侧透视牌面，ext 为端面厚度。
 */
export interface MahjongBlockShape {
  topW: number;
  topH: number;
  ext: number;
}

export function mahjongBlockShape(stand: number | undefined): MahjongBlockShape {
  switch (stand) {
    case MAHJONG_STAND_EDGE_SHORT:
      return { topW: 0.86, topH: MAHJONG_TILE_FACE_ASPECT, ext: 0.2 };
    case MAHJONG_STAND_EDGE_LONG:
      return { topW: 1, topH: 0.32, ext: 0.88 };
    case MAHJONG_STAND_TILT:
      return { topW: 1, topH: MAHJONG_TILE_FACE_ASPECT, ext: 0.26 };
    case MAHJONG_STAND_UPRIGHT:
      return { topW: 1, topH: MAHJONG_TILE_FACE_ASPECT, ext: 0.3 };
    default:
      return { topW: 1, topH: MAHJONG_TILE_FACE_ASPECT, ext: 0.2 };
  }
}

export interface MahjongTileHit {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

/** 归一化坐标 0–1 映射为牌心，使牌缘可贴满牌堆区。 */
export function mahjongPileNormToCenter(n: number, halfSizeRatio: number): number {
  const inset = Math.min(0.48, Math.max(0.04, halfSizeRatio));
  return inset + n * (1 - 2 * inset);
}

export function mahjongPileTileWidth(screenWidth: number, poseScale: number): number {
  const scale = poseScale / MAHJONG_PILE_REF_POSE_SCALE;
  return (
    screenWidth *
    MAHJONG_PILE_TILE_WIDTH_RATIO *
    MAHJONG_PILE_TILE_SIZE_FACTOR *
    scale
  );
}

export function pilePosesToHits(
  poses: readonly MahjongTilePose[],
  width: number,
  height: number,
): MahjongTileHit[] {
  const m = mahjongPlayMetrics(width, height);
  const pad = 10;
  const pileTop = m.pileTop;
  const pileBottom = m.pileBottom;
  const areaW = width - pad * 2;
  const areaH = Math.max(80, pileBottom - pileTop);

  const hits: MahjongTileHit[] = [];
  for (let index = 0; index < poses.length; index += 1) {
    const p = poses[index]!;
    const faceW = mahjongPileTileWidth(width, p.scale);
    const shape = mahjongBlockShape(p.stand);
    const w = faceW * shape.topW;
    const h = faceW * (shape.topH + shape.ext);
    const cos = Math.abs(Math.cos(p.rot));
    const sin = Math.abs(Math.sin(p.rot));
    const boundW = w * cos + h * sin;
    const boundH = w * sin + h * cos;
    const cx =
      pad + mahjongPileNormToCenter(p.nx, boundW / 2 / Math.max(1, areaW)) * areaW;
    const cy =
      pileTop + mahjongPileNormToCenter(p.ny, boundH / 2 / Math.max(1, areaH)) * areaH;
    hits.push({
      index,
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      rot: p.rot,
    });
  }
  hits.sort((a, b) => {
    const za = poses[a.index]?.z ?? a.index;
    const zb = poses[b.index]?.z ?? b.index;
    return za - zb;
  });
  return hits;
}

export interface MahjongPileLayoutCacheResult {
  hits: MahjongTileHit[];
  zMax: number;
}

let pileLayoutCache: {
  key: string;
  hits: MahjongTileHit[];
  zMax: number;
} | null = null;

export function clearMahjongPileLayoutCache(): void {
  pileLayoutCache = null;
}

/** 牌堆 hit 与 zMax；epoch 变化时重算。 */
export function pilePosesToHitsCached(
  poses: readonly MahjongTilePose[],
  width: number,
  height: number,
  layoutEpoch: number,
): MahjongPileLayoutCacheResult {
  const key = `${width}x${height}:${layoutEpoch}:${poses.length}`;
  if (pileLayoutCache?.key === key) {
    return { hits: pileLayoutCache.hits, zMax: pileLayoutCache.zMax };
  }
  const hits = pilePosesToHits(poses, width, height);
  let zMax = 1;
  for (const p of poses) {
    zMax = Math.max(zMax, p.z);
  }
  pileLayoutCache = { key, hits, zMax };
  return pileLayoutCache;
}

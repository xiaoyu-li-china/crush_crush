import { createSeededRandom } from '../../core/utils/math';

/** 0 平铺 · 1 竖长侧立 · 2 短边立 · 3 长边立 · 4 平铺斜靠 */
export const MAHJONG_STAND_FLAT = 0;
export const MAHJONG_STAND_UPRIGHT = 1;
export const MAHJONG_STAND_EDGE_SHORT = 2;
export const MAHJONG_STAND_EDGE_LONG = 3;
export const MAHJONG_STAND_TILT = 4;

/** 姿态生成规则变更时递增，旧存档的摆放会按 seed 重建。 */
export const MAHJONG_PILE_POSE_VERSION = 3;

/** 牌堆内归一化坐标（0–1），渲染时按屏幕换算。 */
export interface MahjongTilePose {
  nx: number;
  ny: number;
  scale: number;
  rot: number;
  z: number;
  /** @see MAHJONG_STAND_* */
  stand?: number;
}

/** 参考实物堆：平铺为主，夹杂侧立 / 横立 / 斜靠；第 1 关只用能看清牌面的姿态。 */
function pickPileStand(rng: () => number, level: number): number {
  const r = rng();
  if (level <= 1) {
    if (r < 0.7) {
      return MAHJONG_STAND_FLAT;
    }
    if (r < 0.85) {
      return MAHJONG_STAND_TILT;
    }
    return MAHJONG_STAND_UPRIGHT;
  }
  if (r < 0.64) {
    return MAHJONG_STAND_FLAT;
  }
  if (r < 0.72) {
    return MAHJONG_STAND_TILT;
  }
  if (r < 0.86) {
    return MAHJONG_STAND_EDGE_SHORT;
  }
  if (r < 0.94) {
    return MAHJONG_STAND_EDGE_LONG;
  }
  return MAHJONG_STAND_UPRIGHT;
}

/** 命中框不随旋转，角度保持在参考图那样的轻微歪斜。 */
function rotForPileStand(stand: number, rng: () => number, _level: number): number {
  const t = rng() - 0.5;
  switch (stand) {
    case MAHJONG_STAND_FLAT:
      return t * 0.5;
    case MAHJONG_STAND_TILT:
      return t * 0.7;
    default:
      return t * 0.24;
  }
}

/** 多层向中心聚拢、重叠堆叠（散布大，占满牌堆区）。 */
export function buildMahjongPilePoses(
  pileLength: number,
  seed: number,
  level: number,
): MahjongTilePose[] {
  if (pileLength <= 0) {
    return [];
  }
  const rng = createSeededRandom(seed ^ (level * 1315423911) ^ (pileLength * 2654435761));

  const compact = pileLength <= 12;
  const layerCount = compact ? 3 : 5;
  const perLayer = Math.ceil(pileLength / layerCount);
  const poses: MahjongTilePose[] = [];
  const clusterCount = compact ? 2 : 3;
  const clusters = Array.from({ length: clusterCount }, () => ({
    cx: 0.28 + rng() * 0.44,
    cy: 0.3 + rng() * 0.4,
  }));

  for (let i = 0; i < pileLength; i += 1) {
    const layer = Math.min(layerCount - 1, Math.floor(i / perLayer));
    const spreadX = (compact ? 0.92 : 0.94) - layer * (compact ? 0.035 : 0.028);
    const spreadY = (compact ? 0.9 : 0.92) - layer * (compact ? 0.035 : 0.028);
    const cluster = clusters[Math.floor(rng() * clusterCount)]!;
    const nx = cluster.cx + (rng() - 0.5) * spreadX;
    const ny = cluster.cy + (rng() - 0.5) * spreadY;
    const stand = pickPileStand(rng, level);
    poses.push({
      nx: Math.min(0.98, Math.max(0.02, nx)),
      ny: Math.min(0.98, Math.max(0.02, ny)),
      scale:
        (compact ? 0.25 : 0.158) -
        layer * (compact ? 0.012 : 0.0025) +
        rng() * 0.018,
      rot: rotForPileStand(stand, rng, level),
      z: layer * 1000 + i + rng() * 0.01,
      stand,
    });
  }
  return poses;
}

export function appendRandomPilePose(
  poses: MahjongTilePose[],
  seed: number,
  level: number,
): MahjongTilePose {
  const rng = createSeededRandom(seed ^ poses.length ^ 991 ^ level);
  const scale = level <= 1 ? 0.2 : 0.144 + rng() * 0.02;
  const stand = pickPileStand(rng, level);
  return {
    nx: Math.min(0.98, Math.max(0.02, 0.5 + (rng() - 0.5) * 0.92)),
    ny: Math.min(0.98, Math.max(0.02, 0.5 + (rng() - 0.5) * 0.9)),
    scale,
    rot: rotForPileStand(stand, rng, level),
    z: 5000 + poses.length + rng(),
    stand,
  };
}

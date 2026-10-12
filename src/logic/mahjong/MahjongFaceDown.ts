import { createSeededRandom } from '../../core/utils/math';
import type { MahjongTilePose } from './MahjongPilePoses';

/** 第 2 关起约三成扣背（优先平铺牌），第 1 关全开。 */
export function buildInitialPileFaceDown(
  poses: readonly MahjongTilePose[],
  level: number,
  seed: number,
): boolean[] {
  if (level <= 1 || poses.length === 0) {
    return poses.map(() => false);
  }
  const rng = createSeededRandom(seed ^ 0xfaced0ad ^ level);
  const n = poses.length;
  const target = Math.max(1, Math.floor(n * 0.3));
  const order = poses.map((p, i) => ({ i, z: p.z })).sort((a, b) => a.z - b.z);
  const faceDown = poses.map(() => false);
  for (let k = 0; k < target; k += 1) {
    let pick = order[Math.min(order.length - 1, Math.floor(rng() * rng() * n))]!;
    if (rng() < 0.72) {
      const flatPool = order.filter((o) => (poses[o.i]?.stand ?? 1) === 0);
      if (flatPool.length > 0) {
        pick = flatPool[Math.floor(rng() * flatPool.length)]!;
      }
    }
    faceDown[pick.i] = true;
  }
  return faceDown;
}

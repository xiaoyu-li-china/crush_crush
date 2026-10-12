import { BASIC_TILE_KINDS } from '../board/TileType';
import type { LevelConfig } from './LevelConfig';
import { MATCH3_TEMPLATE_LEVEL_COUNT } from './Match3InfiniteLevels';

/** 梯子三消：棋盘可出现的萌宠种类上限（不含猫头鹰等特殊块）。 */
export const MATCH3_MAX_BASIC_KINDS = BASIC_TILE_KINDS.length;

const MIN_KINDS = 3;

function clampKindCount(n: number): number {
  return Math.min(MATCH3_MAX_BASIC_KINDS, Math.max(MIN_KINDS, Math.floor(n)));
}

/**
 * 梯子关卡活跃萌宠数。
 * 1–20 关按原表设计：前段保持经典 5 色难度，16 关起再解锁新萌宠；21+ 远关继续加到 9 种。
 */
export function match3BasicKindCount(
  levelId: number,
  config?: Pick<LevelConfig, 'basicKindCount'>,
): number {
  if (config?.basicKindCount != null && Number.isFinite(config.basicKindCount)) {
    return clampKindCount(config.basicKindCount);
  }
  const id = Math.max(1, Math.floor(levelId));
  if (id <= MATCH3_TEMPLATE_LEVEL_COUNT) {
    if (id <= 10) {
      return 5;
    }
    if (id <= 15) {
      return 6;
    }
    if (id <= 18) {
      return 7;
    }
    return 8;
  }
  const tier = id - MATCH3_TEMPLATE_LEVEL_COUNT;
  return clampKindCount(8 + Math.floor(tier / 6));
}

export function match3BasicKindLabel(count: number): string {
  const n = clampKindCount(count);
  return `${n}种萌宠`;
}

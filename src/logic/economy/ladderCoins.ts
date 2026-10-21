import type { LevelProgressData } from '../level/LevelProgress';

/** 梯子关卡：每 100 分折算 1 金币（展示与可用余额均按历史最高分计）。 */
export const LADDER_SCORE_PER_COIN = 100;

/** 糖果梯子条上展示：馆币（不用 ⭐，避免和通关星级混淆）。 */
export function formatLadderCoinChip(coins: number): string {
  const n = Math.max(0, Math.floor(coins));
  return n > 0 ? `馆${n}` : '馆0';
}

export function ladderCoinsFromScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) {
    return 0;
  }
  return Math.floor(score / LADDER_SCORE_PER_COIN);
}

export function totalLadderCoinsEarned(
  levelScores: Record<string, number> | undefined,
): number {
  if (!levelScores) {
    return 0;
  }
  let sum = 0;
  for (const value of Object.values(levelScores)) {
    sum += ladderCoinsFromScore(Number(value));
  }
  return sum;
}

export function ladderCoinsSpent(data: LevelProgressData): number {
  const n = data.ladderCoinsSpent;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.floor(n);
}

/** 萌宠麻将馆等消耗用的可用梯子金币。 */
export function ladderCoinsAvailable(data: LevelProgressData): number {
  const earned = totalLadderCoinsEarned(data.levelScores);
  return Math.max(0, earned - ladderCoinsSpent(data));
}

import type { MahjongToolId } from './MahjongConfig';
import type { MahjongGameSnapshot } from './MahjongGame';

export interface MahjongHallProgressData {
  coins: number;
  /** 可挑战的最高关（已通最大关 + 1） */
  highestUnlocked: number;
  starsByLevel: Record<string, number>;
  tools: Record<MahjongToolId, number>;
  guideSeen: boolean;
  savedRun: MahjongGameSnapshot | null;
  /** 本关已失败且未付费/广告复活时，禁止免费再开同一关 */
  blockedReplayLevel: number | null;
}

export const EMPTY_MAHJONG_TOOLS: Record<MahjongToolId, number> = {
  move_out: 1,
  gather: 1,
  shuffle: 1,
  reveal: 1,
};

export function emptyMahjongProgress(): MahjongHallProgressData {
  return {
    coins: 0,
    highestUnlocked: 1,
    starsByLevel: {},
    tools: { ...EMPTY_MAHJONG_TOOLS },
    guideSeen: false,
    savedRun: null,
    blockedReplayLevel: null,
  };
}

export function normalizeMahjongProgress(raw: unknown): MahjongHallProgressData {
  const base = emptyMahjongProgress();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const o = raw as Partial<MahjongHallProgressData>;
  if (typeof o.coins === 'number' && Number.isFinite(o.coins)) {
    base.coins = Math.max(0, Math.floor(o.coins));
  }
  if (typeof o.highestUnlocked === 'number' && Number.isFinite(o.highestUnlocked)) {
    base.highestUnlocked = Math.max(1, Math.floor(o.highestUnlocked));
  }
  if (o.starsByLevel && typeof o.starsByLevel === 'object') {
    base.starsByLevel = { ...o.starsByLevel };
  }
  if (o.tools && typeof o.tools === 'object') {
    for (const k of Object.keys(EMPTY_MAHJONG_TOOLS) as MahjongToolId[]) {
      const v = (o.tools as Record<string, number>)[k];
      if (typeof v === 'number' && Number.isFinite(v)) {
        base.tools[k] = Math.max(0, Math.floor(v));
      }
    }
  }
  base.guideSeen = o.guideSeen === true;
  if (o.savedRun && typeof o.savedRun === 'object') {
    base.savedRun = o.savedRun as MahjongGameSnapshot;
  }
  if (typeof o.blockedReplayLevel === 'number' && Number.isFinite(o.blockedReplayLevel)) {
    base.blockedReplayLevel = Math.max(1, Math.floor(o.blockedReplayLevel));
  }
  if (
    base.blockedReplayLevel != null &&
    base.savedRun?.phase === 'playing' &&
    base.savedRun.level === base.blockedReplayLevel
  ) {
    base.savedRun = null;
  }
  return base;
}

export function recordMahjongClear(
  data: MahjongHallProgressData,
  level: number,
  stars: number,
  coinsEarned: number,
): MahjongHallProgressData {
  const key = String(level);
  const prev = data.starsByLevel[key] ?? 0;
  const nextStars = Math.max(prev, stars);
  return {
    ...data,
    coins: data.coins + coinsEarned,
    starsByLevel: { ...data.starsByLevel, [key]: nextStars },
    highestUnlocked: Math.max(data.highestUnlocked, level + 1),
    savedRun: null,
    blockedReplayLevel: null,
  };
}

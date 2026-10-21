import {
  ladderCoinsAvailable,
  ladderCoinsFromScore,
  ladderCoinsSpent,
} from '../economy/ladderCoins';

/**
 * 玩家关卡进度（可经 IStorage 持久化）。
 * 关卡 id 升级后必须保持稳定：版本更新只追加关卡，不改已有 id。
 */
export interface LevelProgressData {
  /** 存档结构版本，只增不减，用于兼容旧包 */
  schemaVersion?: number;
  /** 当前可挑战的最高关卡 id（已通关的最大 id + 1） */
  highestLevelId: number;
  /** 历史累计（各关当前最高分之和，迁移兼容） */
  totalScore: number;
  lastPlayedLevelId: number;
  /** 每关历史最高分（key 为关卡 id 字符串，便于 JSON 持久化） */
  levelScores?: Record<string, number>;
  /** 每关历史最高星级 1–3（key 为关卡 id 字符串） */
  levelStars?: Record<string, number>;
  /** 已在萌宠麻将馆等玩法中消耗掉的梯子金币 */
  ladderCoinsSpent?: number;
}

export const PROGRESS_SCHEMA_VERSION = 1;

export const DEFAULT_LEVEL_PROGRESS: LevelProgressData = {
  schemaVersion: PROGRESS_SCHEMA_VERSION,
  highestLevelId: 1,
  totalScore: 0,
  lastPlayedLevelId: 1,
  levelScores: {},
};

function asPositiveInt(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return n;
}

function asNonNegInt(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

/**
 * 读档归一化：旧包缺字段也能接着玩，绝不把已通关打回第 1 关。
 */
export function normalizeLevelProgressData(raw: unknown): LevelProgressData {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_LEVEL_PROGRESS,
      levelScores: {},
    };
  }
  const data = raw as Partial<LevelProgressData> & Record<string, unknown>;
  const scores: Record<string, number> = {};
  const rawScores = data.levelScores;
  if (rawScores && typeof rawScores === 'object') {
    for (const [key, value] of Object.entries(rawScores)) {
      const id = Number(key);
      const score = Number(value);
      if (!Number.isFinite(id) || id < 1 || !Number.isFinite(score) || score < 0) {
        continue;
      }
      scores[String(Math.floor(id))] = score;
    }
  }
  const stars: Record<string, number> = {};
  const rawStars = data.levelStars;
  if (rawStars && typeof rawStars === 'object') {
    for (const [key, value] of Object.entries(rawStars)) {
      const id = Number(key);
      const n = Math.floor(Number(value));
      if (!Number.isFinite(id) || id < 1 || !Number.isFinite(n) || n < 1) {
        continue;
      }
      stars[String(Math.floor(id))] = Math.min(3, n);
    }
  }
  const scoreIds = Object.keys(scores).map((k) => Number(k));
  const maxScored = scoreIds.length > 0 ? Math.max(...scoreIds) : 0;
  let highest = asPositiveInt(data.highestLevelId, 1);
  if (maxScored >= highest) {
    highest = maxScored + 1;
  }
  const lastPlayed = asPositiveInt(data.lastPlayedLevelId, Math.max(1, highest - 1));
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    highestLevelId: highest,
    totalScore: asNonNegInt(data.totalScore, 0),
    lastPlayedLevelId: lastPlayed,
    levelScores: scores,
    levelStars: stars,
    ladderCoinsSpent: asNonNegInt(data.ladderCoinsSpent, 0),
  };
}

export class LevelProgress {
  private data: LevelProgressData;

  public constructor(data: LevelProgressData = { ...DEFAULT_LEVEL_PROGRESS }) {
    this.data = normalizeLevelProgressData(data);
  }

  public load(data: LevelProgressData): void {
    this.data = normalizeLevelProgressData(data);
  }

  public getData(): Readonly<LevelProgressData> {
    return {
      ...this.data,
      levelScores: { ...(this.data.levelScores ?? {}) },
      levelStars: { ...(this.data.levelStars ?? {}) },
    };
  }

  /** 该关历史最高星级；没记录返回 0 */
  public getStars(levelId: number): number {
    return this.data.levelStars?.[String(levelId)] ?? 0;
  }

  public getHighestLevelId(): number {
    return this.data.highestLevelId;
  }

  public getBestScore(levelId: number): number {
    return this.data.levelScores?.[String(levelId)] ?? 0;
  }

  public getLadderCoinsForLevel(levelId: number): number {
    return ladderCoinsFromScore(this.getBestScore(levelId));
  }

  public getLadderCoinsAvailable(): number {
    return ladderCoinsAvailable(this.data);
  }

  public spendLadderCoins(amount: number): boolean {
    const cost = Math.floor(amount);
    if (cost <= 0) {
      return true;
    }
    if (this.getLadderCoinsAvailable() < cost) {
      return false;
    }
    this.data.ladderCoinsSpent = ladderCoinsSpent(this.data) + cost;
    return true;
  }

  /** 是否已通关该关（持久化记录） */
  public isLevelCleared(levelId: number): boolean {
    if (levelId < this.data.highestLevelId) {
      return true;
    }
    const scores = this.data.levelScores;
    return !!scores && Object.prototype.hasOwnProperty.call(scores, String(levelId));
  }

  /**
   * 通关记账：刷新该关最高分，并推进可挑战关卡。
   */
  public markLevelCleared(levelId: number, score: number, stars = 0): void {
    this.data.lastPlayedLevelId = levelId;
    const scores = this.data.levelScores ?? (this.data.levelScores = {});
    const key = String(levelId);
    const starCount = Math.min(3, Math.max(0, Math.floor(stars)));
    if (starCount > 0) {
      const starMap = this.data.levelStars ?? (this.data.levelStars = {});
      starMap[key] = Math.max(starMap[key] ?? 0, starCount);
    }
    const prev = scores[key] ?? 0;
    if (score > prev) {
      scores[key] = score;
      this.data.totalScore += score - prev;
    } else if (!(key in scores)) {
      // 通关但 0 分也记一条，便于藤蔓显示「已通」
      scores[key] = Math.max(0, score);
    }
    if (levelId >= this.data.highestLevelId) {
      this.data.highestLevelId = levelId + 1;
    }
  }
}

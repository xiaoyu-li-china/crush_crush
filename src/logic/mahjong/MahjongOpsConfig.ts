import bundledOps from '../../config/mahjong-ops.json';
import cdnConfig from '../../config/mahjong-cdn.json';

export interface MahjongLevelOverride {
  level: number;
  themeId?: string;
  typeCount?: number;
  timeoutSec?: number;
  note?: string;
}

export interface MahjongOpsConfig {
  version: number;
  economy: {
    coinCost: number;
    coinPerTriple: number;
    starPerTriple: number;
  };
  session: {
    timeoutSec: number;
  };
  generation: {
    seedVersion: number;
    maxAttempts: number;
    level1Tiles: number;
    standardTiles: number;
    typeCountLevel2: number;
    typeCountFromLevel3: { min: number; maxInclusive: number };
  };
  theme: {
    level1ThemeId: string;
    level2ThemeId: string;
    cycleAfterLevel: number;
    sequentialFromLevel3: boolean;
  };
  levelOverrides: MahjongLevelOverride[];
  sampling: {
    enabled: boolean;
    everyNLevels: number;
  };
  ads: {
    rewardedVideoSlot: boolean;
  };
  tools: {
    freeToUse: boolean;
  };
}

export type MahjongOpsJsonFetcher = (url: string) => Promise<unknown>;

let ops: MahjongOpsConfig = normalizeMahjongOps(bundledOps as MahjongOpsConfig);
let remoteSource: 'bundled' | 'cdn' | 'cloud' = 'bundled';

function clampInt(n: unknown, fallback: number, min: number, max: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.min(max, Math.max(min, v));
}

/** 与客户端一致的配置归一化（后台编辑器 / 发布前校验复用）。 */
export function normalizeMahjongOps(raw: Partial<MahjongOpsConfig>): MahjongOpsConfig {
  const gen = raw.generation ?? {};
  const type3 = gen.typeCountFromLevel3 ?? { min: 6, maxInclusive: 8 };
  const minT = clampInt(type3.min, 6, 3, 20);
  const maxT = clampInt(type3.maxInclusive, 8, minT, 20);
  const overrides = Array.isArray(raw.levelOverrides)
    ? raw.levelOverrides
        .filter((o) => o && typeof o.level === 'number' && o.level >= 1)
        .map((o) => ({
          level: Math.floor(o.level),
          themeId: typeof o.themeId === 'string' ? o.themeId : undefined,
          typeCount:
            typeof o.typeCount === 'number' ? clampInt(o.typeCount, 6, 3, 20) : undefined,
          timeoutSec:
            typeof o.timeoutSec === 'number'
              ? clampInt(o.timeoutSec, 120, 60, 3600)
              : undefined,
          note: typeof o.note === 'string' ? o.note : undefined,
        }))
    : [];

  return {
    version: clampInt(raw.version, 1, 1, 1_000_000),
    economy: {
      coinCost: clampInt(raw.economy?.coinCost, 100, 1, 10_000),
      coinPerTriple: clampInt(raw.economy?.coinPerTriple, 1, 0, 100),
      starPerTriple: clampInt(raw.economy?.starPerTriple, 1, 0, 100),
    },
    session: {
      timeoutSec: clampInt(raw.session?.timeoutSec, 120, 60, 3600),
    },
    generation: {
      seedVersion: clampInt(gen.seedVersion, 1, 1, 10_000),
      maxAttempts: clampInt(gen.maxAttempts, 16, 1, 64),
      level1Tiles: clampInt(gen.level1Tiles, 9, 3, 105),
      standardTiles: clampInt(gen.standardTiles, 105, 9, 105),
      typeCountLevel2: clampInt(gen.typeCountLevel2, 6, 3, 20),
      typeCountFromLevel3: { min: minT, maxInclusive: maxT },
    },
    theme: {
      level1ThemeId: raw.theme?.level1ThemeId ?? 'default',
      level2ThemeId: raw.theme?.level2ThemeId ?? 'default',
      cycleAfterLevel: clampInt(raw.theme?.cycleAfterLevel, 3000, 10, 50_000),
      sequentialFromLevel3: raw.theme?.sequentialFromLevel3 === true,
    },
    levelOverrides: overrides,
    sampling: {
      enabled: raw.sampling?.enabled !== false,
      everyNLevels: clampInt(raw.sampling?.everyNLevels, 50, 1, 500),
    },
    ads: {
      rewardedVideoSlot: raw.ads?.rewardedVideoSlot !== false,
    },
    tools: {
      freeToUse: raw.tools?.freeToUse !== false,
    },
  };
}

export function getMahjongOps(): Readonly<MahjongOpsConfig> {
  return ops;
}

export function getMahjongOpsRemoteSource(): 'bundled' | 'cdn' | 'cloud' {
  return remoteSource;
}

export function getMahjongOpsVersion(): number {
  return ops.version;
}

export function applyMahjongOpsConfig(next: Partial<MahjongOpsConfig>, source: 'cdn' | 'cloud'): void {
  ops = normalizeMahjongOps(next);
  remoteSource = source;
}

export function resetMahjongOpsToBundled(): void {
  ops = normalizeMahjongOps(bundledOps as MahjongOpsConfig);
  remoteSource = 'bundled';
}

const overrideMap = (): Map<number, MahjongLevelOverride> => {
  return new Map(ops.levelOverrides.map((o) => [o.level, o]));
};

export function getMahjongLevelOverride(level: number): MahjongLevelOverride | null {
  return overrideMap().get(level) ?? null;
}

/** 3000+ 关主题循环：仅影响主题选择，不影响种子关卡号。 */
export function mahjongThemePickLevel(level: number): number {
  const cycle = ops.theme.cycleAfterLevel;
  if (level <= cycle) {
    return level;
  }
  const span = cycle - 2;
  if (span <= 0) {
    return level;
  }
  return 3 + ((level - 3) % span);
}

export function mahjongTileCountForLevel(level: number): number {
  return level <= 1 ? ops.generation.level1Tiles : ops.generation.standardTiles;
}

export function mahjongTimeoutMsForLevel(level: number): number {
  const override = getMahjongLevelOverride(level);
  const sec = override?.timeoutSec ?? ops.session.timeoutSec;
  return sec * 1000;
}

export function mahjongCoinCost(): number {
  return ops.economy.coinCost;
}

export function mahjongCoinPerTriple(): number {
  return ops.economy.coinPerTriple;
}

export function mahjongStarPerTriple(): number {
  return ops.economy.starPerTriple;
}

export function mahjongSeedVersion(): number {
  return ops.generation.seedVersion;
}

export function mahjongGenerationMaxAttempts(): number {
  return ops.generation.maxAttempts;
}

export function mahjongStandardTiles(): number {
  return ops.generation.standardTiles;
}

export function mahjongLevel1Tiles(): number {
  return ops.generation.level1Tiles;
}

export function mahjongTypeCountForGeneration(level: number, rng: () => number): number {
  const override = getMahjongLevelOverride(level);
  if (override?.typeCount != null) {
    return override.typeCount;
  }
  let base: number;
  /** 第 2 关模板：固定种类数；第 3 关牌面随机；第 4 关起与第 2 关同规则，仅主题变化（PRD 5.9）。 */
  if (level <= 2 || level >= 4) {
    base = ops.generation.typeCountLevel2;
  } else {
    const { min, maxInclusive } = ops.generation.typeCountFromLevel3;
    const span = maxInclusive - min + 1;
    base = min + Math.floor(rng() * span);
  }
  /** 远关加牌种（与梯子「解锁新萌宠」区分：麻将馆靠槽位压力 + 更多同图种类）。 */
  const bonus =
    level >= 4 ? Math.min(2, Math.floor((Math.max(4, level) - 4) / 25)) : 0;
  return Math.min(10, base + bonus);
}

export function shouldMahjongOpsSampleLevel(level: number): boolean {
  if (!ops.sampling.enabled) {
    return false;
  }
  const n = ops.sampling.everyNLevels;
  return level === 1 || level % n === 0;
}

export function isMahjongRewardedVideoSlotEnabled(): boolean {
  return ops.ads.rewardedVideoSlot;
}

export async function fetchMahjongOpsFromCdn(fetchJson: MahjongOpsJsonFetcher): Promise<boolean> {
  if (cdnConfig.enabled !== true) {
    return false;
  }
  const url = (cdnConfig.opsConfigUrl ?? '').trim();
  if (url.length === 0) {
    return false;
  }
  try {
    const data = await fetchJson(url);
    if (!data || typeof data !== 'object') {
      return false;
    }
    applyMahjongOpsConfig(data as MahjongOpsConfig, 'cdn');
    return true;
  } catch {
    return false;
  }
}

export async function fetchMahjongOpsFromCloud(
  fetchCloud: () => Promise<Partial<MahjongOpsConfig> | null>,
): Promise<boolean> {
  try {
    const data = await fetchCloud();
    if (!data || typeof data !== 'object') {
      return false;
    }
    applyMahjongOpsConfig(data, 'cloud');
    return true;
  } catch {
    return false;
  }
}

import { createSeededRandom } from '../../core/utils/math';
import { MAHJONG_BASE_SLOTS } from './MahjongConfig';
import {
  mahjongGenerationMaxAttempts,
  mahjongLevel1Tiles,
  mahjongSeedVersion,
  mahjongStandardTiles,
  mahjongTileCountForLevel,
  mahjongTypeCountForGeneration,
} from './MahjongOpsConfig';
import { pickMahjongThemeForLevel } from './MahjongThemeCatalog';

export interface MahjongGeneratedLevel {
  level: number;
  pile: number[];
  typeCount: number;
  seed: number;
  themeId: string;
}

function hashSeed(playerKey: string, level: number): number {
  const raw = `${playerKey}|${level}|${mahjongSeedVersion()}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 第 1 关：每行 0/1/2 各一张，行内顺序打乱（3×3 与位姿下标一致）。 */
export function buildLevel1TutorialPile(seed: number): number[] {
  const rng = createSeededRandom(seed ^ 0x7c1a001);
  const pile: number[] = [];
  for (let row = 0; row < 3; row += 1) {
    const rowTypes = [0, 1, 2];
    shuffleInPlace(rowTypes, rng);
    pile.push(rowTypes[0]!, rowTypes[1]!, rowTypes[2]!);
  }
  return pile;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/** 将 35 组三连块随机排布，保证按顺序取牌必可解（块内最多占 3 槽）。 */
function buildSolvablePile(totalTiles: number, typeCount: number, rng: () => number): number[] {
  const blockTotal = totalTiles / 3;
  const blocksPerType = new Array(typeCount).fill(0);
  for (let i = 0; i < blockTotal; i += 1) {
    const t = Math.floor(rng() * typeCount);
    blocksPerType[t]! += 1;
  }
  const blockTypes: number[] = [];
  for (let t = 0; t < typeCount; t += 1) {
    for (let b = 0; b < blocksPerType[t]!; b += 1) {
      blockTypes.push(t);
    }
  }
  shuffleInPlace(blockTypes, rng);
  const pile: number[] = [];
  for (const t of blockTypes) {
    pile.push(t, t, t);
  }
  return pile;
}

/** 第 2 关及后续无限关：105 张 + 种子 + 可解校验 + 主题（与 PRD 7.5 一致）。 */
function generateMahjongStandard105Level(
  level: number,
  playerKey: string,
  seed: number,
  themeId: string,
): MahjongGeneratedLevel {
  const maxAttempts = mahjongGenerationMaxAttempts();
  const standardTiles = mahjongStandardTiles();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const rng = createSeededRandom(seed + attempt * 9973);
    const typeCount = mahjongTypeCountForGeneration(level, rng);
    const pile = buildSolvablePile(standardTiles, typeCount, rng);
    if (verifySolvablePile(pile, MAHJONG_BASE_SLOTS)) {
      return { level, pile, typeCount, seed: seed + attempt, themeId };
    }
  }
  const fallbackRng = createSeededRandom(seed);
  const typeCount = mahjongTypeCountForGeneration(level, fallbackRng);
  const pile = buildSolvablePile(standardTiles, typeCount, fallbackRng);
  return { level, pile, typeCount, seed, themeId };
}

export function generateMahjongLevel(
  level: number,
  playerKey: string,
): MahjongGeneratedLevel {
  const safeLevel = Math.max(1, Math.floor(level));
  const seed = hashSeed(playerKey, safeLevel);
  const theme = pickMahjongThemeForLevel(safeLevel, seed);
  const total = mahjongTileCountForLevel(safeLevel);
  if (total === mahjongLevel1Tiles()) {
    const pile = buildLevel1TutorialPile(seed);
    return {
      level: safeLevel,
      pile,
      typeCount: 3,
      seed,
      /** 第一关固定「萌宠经典」，便于对照五面小兔子样板（红狐/蓝兔/绿蛙） */
      themeId: 'default',
    };
  }
  return generateMahjongStandard105Level(safeLevel, playerKey, seed, theme.themeId);
}

/** 校验 105 张关：每种数量均为 3 的倍数且总和为 105。 */
export function assertMahjongStandardPileCounts(pile: readonly number[]): void {
  const counts = new Map<number, number>();
  for (const t of pile) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let sum = 0;
  for (const c of counts.values()) {
    if (c % 3 !== 0) {
      throw new Error(`tile type count ${c} is not multiple of 3`);
    }
    sum += c;
  }
  if (sum !== mahjongStandardTiles()) {
    throw new Error(`pile sum ${sum} !== ${mahjongStandardTiles()}`);
  }
}

/** 校验按 pile[0] 顺序取完且槽位峰值 ≤ maxSlots（与块生成器配套）。 */
export function verifySolvablePile(pile: readonly number[], maxSlots: number): boolean {
  const pileCopy = pile.slice();
  let slots: number[] = [];
  const resolve = (next: number[]): number[] => {
    const counts = new Map<number, number>();
    for (const t of next) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const keep = new Map<number, number>();
    for (const [t, c] of counts) {
      keep.set(t, c % 3);
    }
    const out: number[] = [];
    for (const t of next) {
      const left = keep.get(t) ?? 0;
      if (left > 0) {
        keep.set(t, left - 1);
        out.push(t);
      }
    }
    return out;
  };
  while (pileCopy.length > 0) {
    const tile = pileCopy.shift()!;
    slots = resolve([...slots, tile]);
    if (slots.length > maxSlots) {
      return false;
    }
  }
  return slots.length === 0;
}

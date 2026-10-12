import { clamp, createSeededRandom } from '../../core/utils/math';
import type { BoardShape } from '../board/BoardShape';
import { BASIC_TILE_KINDS, TileKind } from '../board/TileType';
import type { LevelConfig, LevelGoal } from './LevelConfig';
import type { Match3ProceduralMeta } from './Match3ProceduralMeta';
import { MATCH3_TEMPLATE_LEVEL_COUNT } from './Match3InfiniteLevels';
import { match3BasicKindCount, match3BasicKindLabel } from './match3BasicKindCount';

const SHAPES: readonly BoardShape[] = [
  'diamond',
  'heart',
  'plus',
  'ring',
  'double_ring',
  'split_3_4',
  'hourglass',
  'hourglass_wide',
];

const PET_NAMES: Record<number, string> = {
  [TileKind.Red]: '红狐',
  [TileKind.Blue]: '蓝兔',
  [TileKind.Green]: '绿蛙',
  [TileKind.Yellow]: '黄鸡',
  [TileKind.Purple]: '紫猫',
  [TileKind.Bear]: '棕熊',
  [TileKind.Pig]: '小猪',
  [TileKind.Panda]: '熊猫',
  [TileKind.Corgi]: '柴犬',
};

function pickInt(rng: () => number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return min + Math.floor(rng() * (max - min + 1));
}

function pickPetKind(rng: () => number, basicKindCount: number): TileKind {
  const kinds = BASIC_TILE_KINDS.slice(0, basicKindCount);
  return kinds[pickInt(rng, 0, kinds.length - 1)]!;
}

function uniqueBadge(features: string[]): string {
  const uniq = [...new Set(features.filter(Boolean))];
  if (uniq.length === 0) {
    return '远关';
  }
  return uniq.slice(0, 3).join('·');
}

function buildMeta(levelId: number, tier: number, features: string[], rng: () => number): Match3ProceduralMeta {
  const uiVariant = levelId % 12;
  const hue = (levelId * 41 + tier * 17 + pickInt(rng, 0, 359)) % 360;
  const patterns: Match3ProceduralMeta['barPattern'][] = ['none', 'stripe', 'sprinkle'];
  const band = Math.floor((tier - 1) / MATCH3_TEMPLATE_LEVEL_COUNT);
  return {
    uiVariant,
    hue,
    badgeShort: uniqueBadge(features),
    entryTitle: band <= 0 ? '远关挑战' : `第 ${band + 1} 轮糖果`,
    entrySubtitle: `${uniqueBadge(features)} · 第 ${levelId} 关`,
    barPattern: patterns[pickInt(rng, 0, patterns.length - 1)]!,
  };
}

/**
 * 21+ 关：程序化组合 1–20 关已有机制，难度随关号递增，每关 UI/玩法指纹不同。
 */
export function generateProceduralMatch3Level(
  levelId: number,
  seed: number,
): LevelConfig {
  const id = Math.max(MATCH3_TEMPLATE_LEVEL_COUNT + 1, Math.floor(levelId));
  const tier = id - MATCH3_TEMPLATE_LEVEL_COUNT;
  const rng = createSeededRandom(seed >>> 0 || 1);
  const features: string[] = [];
  const basicKindCount = match3BasicKindCount(id);
  features.push(match3BasicKindLabel(basicKindCount));

  const moves = clamp(
    18 - Math.floor(tier / 3) - pickInt(rng, 0, 1) - Math.max(0, basicKindCount - 6),
    10,
    22,
  );
  const board =
    tier < 8 && rng() < 0.22 ? { rows: 6, cols: 6 } : { rows: 7, cols: 7 };

  const shape = SHAPES[pickInt(rng, 0, SHAPES.length - 1)]!;
  features.push(shapeLabel(shape));

  const goals: LevelGoal[] = [];
  const config: LevelConfig = {
    id,
    seed: seed >>> 0,
    moves,
    board,
    shape,
    basicKindCount,
    goals,
    crushEnabled: true,
    crushDurationMs: clamp(15_000 - tier * 60 + pickInt(rng, -900, 900), 10_000, 15_000),
    starterSpecials: {
      sparkles: clamp(2 + Math.floor(tier / 12) + pickInt(rng, 0, 1), 1, 6),
      owls: tier >= 6 ? clamp(1 + Math.floor(tier / 18) + pickInt(rng, 0, 1), 0, 3) : 0,
    },
  };

  const packs: Array<() => void> = [];

  packs.push(() => {
    const kind = pickPetKind(rng, basicKindCount);
    const count = clamp(10 + Math.floor(tier / 2) + pickInt(rng, 0, 4), 10, 26);
    goals.push({ type: 'collect', kind, count });
    features.push(PET_NAMES[kind] ?? '萌宠');
  });

  packs.push(() => {
    const gems = clamp(5 + Math.floor(tier / 4) + pickInt(rng, 0, 2), 4, 12);
    config.cloudGems = gems;
    config.cloudRows = pickInt(rng, 1, Math.min(3, 1 + Math.floor(tier / 8)));
    goals.push({ type: 'collect_gems', count: gems });
    features.push('粉球', '棉花');
  });

  packs.push(() => {
    const skip = pickInt(rng, 1, Math.min(3, 1 + Math.floor(tier / 20)));
    config.ice = { skipTopRows: skip };
    if (tier >= 30 && rng() < 0.35) {
      config.iceStyle = 'encase';
      features.push('冻住');
    }
    goals.push({ type: 'clear_ice', count: 24 });
    features.push('冰封');
  });

  packs.push(() => {
    config.cloud = { bottomRows: pickInt(rng, 2, 3), centerCap: pickInt(rng, 2, 4) };
    config.cloudGems = clamp(6 + Math.floor(tier / 6), 5, 10);
    goals.push({ type: 'collect_gems', count: config.cloudGems });
    goals.push({ type: 'clear_cloud', count: 12 });
    features.push('异形棉', '粉球');
  });

  packs.push(() => {
    config.ice = { skipTopRows: pickInt(rng, 2, 3) };
    const p = clamp(1 + Math.floor(tier / 15) + pickInt(rng, 0, 1), 1, 4);
    config.buried = { snowmen: 0, penguins: p };
    goals.push({ type: 'collect_penguins', count: p });
    goals.push({ type: 'clear_ice', count: 26 });
    features.push('企鹅', '冰');
  });

  if (tier >= 35) {
    packs.push(() => {
      config.ice = { skipTopRows: 2 };
      config.buried = {
        snowmen: pickInt(rng, 1, 2),
        penguins: pickInt(rng, 1, 2),
      };
      goals.push({ type: 'collect_snowmen', count: config.buried!.snowmen });
      goals.push({ type: 'collect_penguins', count: config.buried!.penguins });
      goals.push({ type: 'clear_ice', count: 28 });
      features.push('雪人', '企鹅');
    });
  }

  const packCount = Math.min(packs.length, 1 + Math.min(2, Math.floor(tier / 10) + (rng() < 0.35 ? 1 : 0)));
  const order = packs.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = pickInt(rng, 0, i);
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  const chosen = new Set<number>();
  for (const idx of order) {
    if (chosen.size >= packCount) {
      break;
    }
    if (chosen.has(idx)) {
      continue;
    }
    chosen.add(idx);
    packs[idx]!();
  }

  if (goals.length === 0) {
    packs[0]!();
  }

  config.goals = goals;
  config.procedural = buildMeta(id, tier, features, rng);
  return config;
}

function shapeLabel(shape: BoardShape): string {
  switch (shape) {
    case 'heart':
      return '心形';
    case 'plus':
      return '十字';
    case 'ring':
      return '圆环';
    case 'double_ring':
      return '双环';
    case 'split_3_4':
      return '分栏';
    case 'hourglass':
      return '沙漏';
    case 'hourglass_wide':
      return '宽腰';
    case 'diamond':
      return '菱形';
    default:
      return '异形';
  }
}

import type { LevelConfig } from './LevelConfig';
import { generateProceduralMatch3Level } from './Match3ProceduralGenerator';

/** 正式配置表关数（1–20 为设计模板，21+ 程序化生成）。 */
export const MATCH3_TEMPLATE_LEVEL_COUNT = 20;

/** 与萌宠麻将馆一致的可挑战上限。 */
export const MATCH3_INFINITE_LEVEL_CAP = 50_000;

/** 大厅梯子：当前进度 + 末尾锁定预览关。 */
export const MATCH3_LOBBY_TAIL_LOCKED_LEVELS = 3;

const SEED_VERSION = 3;

function hashMatch3LevelSeed(playerKey: string, levelId: number): number {
  const raw = `${playerKey}|match3|${levelId}|v${SEED_VERSION}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cloneTemplate(template: LevelConfig): LevelConfig {
  return JSON.parse(JSON.stringify(template)) as LevelConfig;
}

export function match3TemplateIdForLevel(levelId: number, templateCount: number): number {
  const n = Math.max(1, Math.floor(templateCount));
  const id = Math.max(1, Math.floor(levelId));
  return ((id - 1) % n) + 1;
}

export function resolveMatch3LevelConfig(
  levelId: number,
  templates: readonly LevelConfig[],
  playerKey: string,
): LevelConfig {
  if (templates.length === 0) {
    throw new Error('Match3 level templates are empty');
  }
  const id = Math.max(1, Math.floor(levelId));
  if (id > MATCH3_INFINITE_LEVEL_CAP) {
    throw new Error(`Level ${id} exceeds cap ${MATCH3_INFINITE_LEVEL_CAP}`);
  }
  if (id > templates.length) {
    const seed = hashMatch3LevelSeed(playerKey, id);
    return generateProceduralMatch3Level(id, seed);
  }
  const templateId = match3TemplateIdForLevel(id, templates.length);
  const template = templates.find((item) => item.id === templateId) ?? templates[0]!;
  const config = cloneTemplate(template);
  config.id = id;
  return config;
}

/** 大厅展示的总关数（梯子长度）：至少 20，随进度变长。 */
export function match3LobbyDisplayLevelCount(highestLevelId: number): number {
  const unlocked = Math.max(1, Math.floor(highestLevelId));
  const end = unlocked + MATCH3_LOBBY_TAIL_LOCKED_LEVELS;
  return Math.min(
    MATCH3_INFINITE_LEVEL_CAP,
    Math.max(MATCH3_TEMPLATE_LEVEL_COUNT, end),
  );
}

export function isMatch3LevelWithinCap(levelId: number): boolean {
  const id = Math.floor(levelId);
  return id >= 1 && id <= MATCH3_INFINITE_LEVEL_CAP;
}

/** 单测：21+ 关玩法指纹 */
export function match3ProceduralFingerprint(config: LevelConfig): string {
  return JSON.stringify({
    shape: config.shape,
    moves: config.moves,
    ice: config.ice,
    iceStyle: config.iceStyle,
    cloud: config.cloud,
    cloudGems: config.cloudGems,
    cloudRows: config.cloudRows,
    buried: config.buried,
    goals: config.goals.map((g) => g.type).sort(),
    procedural: config.procedural?.badgeShort,
    basicKindCount: config.basicKindCount,
  });
}

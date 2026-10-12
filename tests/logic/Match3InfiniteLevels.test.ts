import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import levelsJson from '../../src/config/levels.json';
import type { LevelConfig } from '../../src/logic/level/LevelConfig';
import {
  MATCH3_TEMPLATE_LEVEL_COUNT,
  match3LobbyDisplayLevelCount,
  match3ProceduralFingerprint,
  match3TemplateIdForLevel,
  resolveMatch3LevelConfig,
} from '../../src/logic/level/Match3InfiniteLevels';
import { levelDifficultyArt } from '../../src/logic/level/levelDifficultyTip';
import { GameSession } from '../../src/services/GameSession';
import { hasAnyValidMove } from '../../src/logic/board/BoardShuffle';
import { MoveValidator } from '../../src/logic/board/MoveValidator';
import { createMemoryDeps } from '../helpers/memory-deps';

const templates = levelsJson as LevelConfig[];

describe('主线三消无限关', () => {
  it('模板为 20 关，21+ 程序化生成', () => {
    assert.equal(templates.length, MATCH3_TEMPLATE_LEVEL_COUNT);
    assert.equal(match3TemplateIdForLevel(21, 20), 1);
    const l21 = resolveMatch3LevelConfig(21, templates, 'p1');
    assert.equal(l21.id, 21);
    assert.ok(l21.procedural);
    assert.ok(l21.procedural!.badgeShort.length > 0);
  });

  it('21+ 关玩法与 UI 指纹随关号变化', () => {
    const l21 = resolveMatch3LevelConfig(21, templates, 'p1');
    const l22 = resolveMatch3LevelConfig(22, templates, 'p1');
    const l41 = resolveMatch3LevelConfig(41, templates, 'p1');
    assert.notEqual(match3ProceduralFingerprint(l21), match3ProceduralFingerprint(l22));
    assert.notEqual(l21.procedural!.hue, l22.procedural!.hue);
    assert.notEqual(match3ProceduralFingerprint(l21), match3ProceduralFingerprint(l41));
    assert.equal(levelDifficultyArt(21, l21.procedural)?.title, '远关挑战');
  });

  it('同关稳定、换关不同', () => {
    const a = resolveMatch3LevelConfig(50, templates, 'p1');
    const b = resolveMatch3LevelConfig(50, templates, 'p1');
    const c = resolveMatch3LevelConfig(51, templates, 'p1');
    assert.deepEqual(match3ProceduralFingerprint(a), match3ProceduralFingerprint(b));
    assert.notEqual(match3ProceduralFingerprint(a), match3ProceduralFingerprint(c));
  });

  it('大厅展示关数随进度变长', () => {
    assert.equal(match3LobbyDisplayLevelCount(1), 20);
    assert.equal(match3LobbyDisplayLevelCount(20), 23);
    assert.equal(match3LobbyDisplayLevelCount(100), 103);
  });

  it('1–20 仍用配置表原关', () => {
    const l5 = resolveMatch3LevelConfig(5, templates, 'p1');
    assert.equal(l5.moves, templates.find((t) => t.id === 5)!.moves);
    assert.equal(l5.procedural, undefined);
  });

  it('第 20 关仍判定有下一关，且 21 关可程序化开局', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    await session.startLevel(20);
    assert.equal(session.hasNextLevel(), true);
    session.quitToLobby();
    await session.startLevel(21);
    assert.equal(session.getLevelConfig()?.id, 21);
    assert.ok(session.getLevelConfig()?.procedural);
  });

  it('抽样 21+ 关可开局且有合法步', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    for (const levelId of [21, 26, 40, 55, 100, 150]) {
      session.quitToLobby();
      await session.startLevel(levelId);
      const board = session.getBoard();
      assert.ok(board, `level ${levelId} board`);
      assert.ok(session.getLevelConfig()?.procedural, `level ${levelId} procedural meta`);
      assert.equal(
        hasAnyValidMove(board, new MoveValidator()),
        true,
        `level ${levelId} has move`,
      );
    }
  });
});

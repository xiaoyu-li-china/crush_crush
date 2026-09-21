/**
 * 正式 1–20 关：能开局、目标与盘面一致、冰下埋藏、有合法步。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BURIED_PENGUIN, BURIED_SNOWMAN } from '../../src/logic/board/BoardModel';
import { hasAnyValidMove } from '../../src/logic/board/BoardShuffle';
import { MoveValidator } from '../../src/logic/board/MoveValidator';
import { TileKind } from '../../src/logic/board/TileType';
import levelsJson from '../../src/config/levels.json';
import { GameSession } from '../../src/services/GameSession';
import { createMemoryDeps } from '../helpers/memory-deps';

const levels = levelsJson as Array<{ id: number }>;

describe('正式关卡可玩性', () => {
  it('1–20 关都能开局，目标绑到真实盘面，埋藏都在冰下', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    assert.equal(session.getLevelCount(), 20);
    assert.deepEqual(
      levels.map((item) => item.id),
      Array.from({ length: 20 }, (_, i) => i + 1),
    );

    for (let id = 1; id <= 20; id += 1) {
      session.quitToLobby();
      await session.startLevel(id);
      assert.equal(session.fsm.getCurrent(), 'PlayerInput', `level ${id} state`);
      const board = session.getBoard();
      const goals = session.getGoals();
      const config = session.getLevelConfig();
      assert.ok(board, `level ${id} board`);
      assert.ok(goals, `level ${id} goals`);
      assert.equal(config?.id, id);
      assert.ok(session.getMovesLeft() > 0, `level ${id} moves`);
      assert.equal(hasAnyValidMove(board, new MoveValidator()), true, `level ${id} has move`);

      const ice = board.countIce();
      const clouds = board.countCloud();
      const gems = board.countGems();
      const snowmen = board.countBuried(BURIED_SNOWMAN);
      const penguins = board.countBuried(BURIED_PENGUIN);

      for (const snap of goals.getSnapshots()) {
        if (snap.goal.type === 'clear_ice') {
          assert.equal(snap.target, ice, `level ${id} clear_ice target`);
          assert.ok(ice > 0, `level ${id} has ice`);
        }
        if (snap.goal.type === 'clear_cloud') {
          assert.equal(snap.target, clouds, `level ${id} clear_cloud target`);
          assert.ok(clouds > 0, `level ${id} has cloud`);
        }
        if (snap.goal.type === 'collect_gems') {
          assert.equal(snap.target, gems, `level ${id} collect_gems target`);
          assert.ok(gems > 0, `level ${id} has gems`);
        }
        if (snap.goal.type === 'collect_snowmen') {
          assert.equal(snap.target, snowmen, `level ${id} collect_snowmen target`);
        }
        if (snap.goal.type === 'collect_penguins') {
          assert.equal(snap.target, penguins, `level ${id} collect_penguins target`);
        }
        if (snap.goal.type === 'collect') {
          assert.ok(snap.target > 0, `level ${id} collect count`);
          assert.ok(
            snap.goal.kind >= TileKind.Red && snap.goal.kind <= TileKind.Purple,
            `level ${id} collect kind`,
          );
        }
      }

      if (config?.buried) {
        assert.ok(snowmen + penguins > 0, `level ${id} placed buried`);
        for (const group of board.listBuriedGroups()) {
          assert.ok(
            group.cells.every((index) => board.ice[index]! > 0),
            `level ${id} buried group ${group.id} under ice`,
          );
        }
      }

      if (config?.ice) {
        assert.ok(ice > 0, `level ${id} ice placed`);
        assert.ok(
          goals.getSnapshots().some((snap) => snap.goal.type === 'clear_ice'),
          `level ${id} must clear ice`,
        );
      }
    }
  });
});

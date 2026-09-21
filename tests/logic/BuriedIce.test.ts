import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BoardModel,
  BURIED_PENGUIN,
  BURIED_SNOWMAN,
} from '../../src/logic/board/BoardModel';
import { MatchFinder } from '../../src/logic/board/MatchFinder';
import { MatchResolver } from '../../src/logic/board/MatchResolver';
import { TileKind } from '../../src/logic/board/TileType';
import { LevelGoals } from '../../src/logic/level/LevelGoals';
import { GameSession } from '../../src/services/GameSession';
import { createMemoryDeps } from '../helpers/memory-deps';

describe('buried snowmen and penguins', () => {
  it('placeBuried lays two snowmen and four penguins', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    const placed = board.placeBuried(2, 4, 20250818);
    assert.equal(placed.snowmen, 2);
    assert.equal(placed.penguins, 4);
    assert.equal(board.countBuried(BURIED_SNOWMAN), 2);
    assert.equal(board.countBuried(BURIED_PENGUIN), 4);
    for (const group of board.listBuriedGroups()) {
      assert.equal(group.cells.length, group.kind === BURIED_SNOWMAN ? 4 : 2);
    }
  });

  it('消一块冰不会立刻收走整只企鹅或雪人', () => {
    const board = new BoardModel({ rows: 4, cols: 4 });
    board.coverPlayableWithIce();
    board.buried[board.index(0, 0)] = BURIED_SNOWMAN;
    board.buried[board.index(0, 1)] = BURIED_SNOWMAN;
    board.buried[board.index(1, 0)] = BURIED_SNOWMAN;
    board.buried[board.index(1, 1)] = BURIED_SNOWMAN;
    board.buriedId[board.index(0, 0)] = 1;
    board.buriedId[board.index(0, 1)] = 1;
    board.buriedId[board.index(1, 0)] = 1;
    board.buriedId[board.index(1, 1)] = 1;
    board.ice[board.index(0, 0)] = 0;
    assert.equal(board.countRevealedBuried(BURIED_SNOWMAN), 0);
    assert.equal(board.harvestRevealedBuried().length, 0);
    board.ice[board.index(0, 1)] = 0;
    board.ice[board.index(1, 0)] = 0;
    board.ice[board.index(1, 1)] = 0;
    assert.equal(board.countRevealedBuried(BURIED_SNOWMAN), 1);
    assert.equal(board.harvestRevealedBuried().length, 4);
  });

  it('snowman quake breaks orthogonal ice, penguin does not', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        board.setTile(r, c, TileKind.Red);
      }
    }
    board.coverPlayableWithIce();
    board.buried[board.index(1, 1)] = BURIED_SNOWMAN;
    board.ice[board.index(1, 1)] = 0;
    const quake = board.applySnowmanQuakes();
    assert.equal(quake.centers.length, 1);
    assert.equal(board.getIce(1, 0), 0);
    assert.equal(board.getIce(1, 2), 0);
    assert.equal(board.getIce(0, 1), 0);
    assert.equal(board.getIce(2, 1), 0);
    assert.equal(board.getIce(0, 0), 1);

    const peng = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        peng.setTile(r, c, TileKind.Blue);
      }
    }
    peng.coverPlayableWithIce();
    peng.buried[peng.index(1, 1)] = BURIED_PENGUIN;
    peng.ice[peng.index(1, 1)] = 0;
    const noQuake = peng.applySnowmanQuakes();
    assert.equal(noQuake.centers.length, 0);
    assert.equal(peng.countIce(), 8);
  });

  it('matching ice on a snowman then quakes neighbors', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      board.setTile(r, 0, TileKind.Red);
      board.setTile(r, 1, TileKind.Blue);
      board.setTile(r, 2, TileKind.Green);
    }
    board.coverPlayableWithIce();
    board.buried[board.index(0, 0)] = BURIED_SNOWMAN;
    const resolver = new MatchResolver(new MatchFinder());
    const iceBefore = board.countIce();
    resolver.resolve(board, new MatchFinder().findMatches(board), {
      seed: 3,
      maxCascade: 1,
    });
    assert.equal(board.getIce(0, 0), 0);
    assert.ok(board.countIce() < iceBefore - 3);
  });

  it('penguin waits until every cell of its footprint is ice-free', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        board.setTile(r, c, TileKind.Blue);
      }
    }
    board.coverPlayableWithIce();
    board.buried[board.index(1, 0)] = BURIED_PENGUIN;
    board.buried[board.index(1, 1)] = BURIED_PENGUIN;
    board.buriedId[board.index(1, 0)] = 1;
    board.buriedId[board.index(1, 1)] = 1;
    board.ice[board.index(1, 0)] = 0;
    assert.equal(board.countBuried(BURIED_PENGUIN), 1);
    assert.equal(board.countRevealedBuried(BURIED_PENGUIN), 0);
    assert.equal(board.isBuriedRevealed(1, 0), false);
    board.ice[board.index(1, 1)] = 0;
    assert.equal(board.countRevealedBuried(BURIED_PENGUIN), 1);
    assert.equal(board.isBuriedRevealed(1, 0), true);
  });

  it('snowman does not quake until every occupied cell is ice-free', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        board.setTile(r, c, TileKind.Red);
      }
    }
    board.coverPlayableWithIce();
    board.buried[board.index(1, 1)] = BURIED_SNOWMAN;
    board.buried[board.index(1, 2)] = BURIED_SNOWMAN;
    board.buriedId[board.index(1, 1)] = 3;
    board.buriedId[board.index(1, 2)] = 3;
    board.ice[board.index(1, 1)] = 0;
    const first = board.applySnowmanQuakes();
    assert.equal(first.centers.length, 0);
    assert.equal(board.getIce(1, 0), 1);
    board.ice[board.index(1, 2)] = 0;
    const quake = board.applySnowmanQuakes();
    assert.equal(quake.centers.length, 1);
    assert.equal(board.getIce(1, 0), 0);
    assert.equal(board.getIce(0, 1), 0);
    assert.equal(board.getIce(2, 1), 0);
  });

  it('冰碎后雪人和企鹅各自立刻计入收集', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.coverPlayableWithIce();
    board.buried[0] = BURIED_SNOWMAN;
    board.buriedId[0] = 1;
    board.buried[2] = BURIED_SNOWMAN;
    board.buriedId[2] = 2;
    board.buried[8] = BURIED_PENGUIN;
    board.buriedId[8] = 3;
    assert.equal(board.countRevealedBuried(BURIED_SNOWMAN), 0);
    assert.equal(board.countRevealedBuried(BURIED_PENGUIN), 0);
    board.ice[0] = 0;
    assert.equal(board.countRevealedBuried(BURIED_SNOWMAN), 1);
    board.ice[8] = 0;
    assert.equal(board.countRevealedBuried(BURIED_PENGUIN), 1);
    const goals = new LevelGoals([
      { type: 'collect_snowmen', count: 2 },
      { type: 'collect_penguins', count: 1 },
    ]);
    goals.syncCollectSnowmen(board.countRevealedBuried(BURIED_SNOWMAN));
    goals.syncCollectPenguins(board.countRevealedBuried(BURIED_PENGUIN));
    assert.equal(goals.isAllCompleted(), false);
    board.ice[2] = 0;
    const taken = board.harvestRevealedBuried();
    assert.ok(taken.length >= 3);
    assert.equal(board.harvestedSnowmen, 2);
    assert.equal(board.harvestedPenguins, 1);
    assert.equal(board.countBuried(BURIED_SNOWMAN), 0);
    goals.syncCollectSnowmen(board.harvestedSnowmen);
    goals.syncCollectPenguins(board.harvestedPenguins);
    assert.equal(goals.isAllCompleted(), true);
  });

  it('harvestBuriedGroup 只收走指定那一只', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.coverPlayableWithIce();
    board.buried[0] = BURIED_PENGUIN;
    board.buriedId[0] = 4;
    board.buried[1] = BURIED_PENGUIN;
    board.buriedId[1] = 4;
    board.buried[2] = BURIED_SNOWMAN;
    board.buriedId[2] = 5;
    board.ice[0] = 0;
    board.ice[1] = 0;
    board.ice[2] = 0;
    assert.equal(board.harvestBuriedGroup(4).length, 2);
    assert.equal(board.harvestedPenguins, 1);
    assert.equal(board.harvestedSnowmen, 0);
    assert.equal(board.countBuried(BURIED_SNOWMAN), 1);
  });

  it('requireIce 只铺在冰下，没盖住的整只去掉', () => {
    const board = new BoardModel({ rows: 6, cols: 6 });
    board.coverPlayableSkippingTopRows(2);
    const placed = board.placeBuried(1, 2, 20250920, { requireIce: true });
    assert.ok(placed.snowmen + placed.penguins > 0);
    for (const group of board.listBuriedGroups()) {
      assert.ok(group.cells.every((i) => board.ice[i]! > 0));
    }
    board.buried[board.index(5, 0)] = BURIED_PENGUIN;
    board.buriedId[board.index(5, 0)] = 99;
    board.ice[board.index(5, 0)] = 0;
    const kept = board.removeBuriedNotUnderIce();
    assert.equal(board.getBuried(5, 0), 0);
    assert.equal(kept.penguins, placed.penguins);
  });

  it('第 20 关雪人企鹅都在冰下', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    await session.startLevel(20);
    const board = session.getBoard();
    assert.ok(board);
    const groups = board.listBuriedGroups();
    assert.ok(groups.length > 0);
    for (const group of groups) {
      assert.ok(group.cells.every((i) => board.ice[i]! > 0), `group ${group.id} not under ice`);
      assert.equal(group.revealed, false);
    }
  });
});

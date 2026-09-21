import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BoardModel } from '../../src/logic/board/BoardModel';
import { generatePlayableBoard } from '../../src/logic/board/BoardGenerator';
import { applyBoardShape } from '../../src/logic/board/BoardShape';
import {
  hasAnyValidMove,
  shuffleUntilPlayable,
} from '../../src/logic/board/BoardShuffle';
import { MatchFinder } from '../../src/logic/board/MatchFinder';
import { MatchResolver } from '../../src/logic/board/MatchResolver';
import { MoveValidator } from '../../src/logic/board/MoveValidator';
import type {
  IAdService,
  IAnalytics,
  IAudio,
  IPlatform,
  IStorage,
} from '../../src/core';
import { TileKind } from '../../src/logic/board/TileType';
import { LevelGoals } from '../../src/logic/level/LevelGoals';
import { GameSession, type GameSessionDeps } from '../../src/services/GameSession';

function createMemoryDeps(): GameSessionDeps {
  const store = new Map<string, unknown>();
  return {
    storage: {
      async get<T>(key: string): Promise<T | null> {
        return store.has(key) ? (store.get(key) as T) : null;
      },
      async set<T>(key: string, value: T): Promise<void> {
        store.set(key, value);
      },
      async remove(key: string): Promise<void> {
        store.delete(key);
      },
      async clear(): Promise<void> {
        store.clear();
      },
    } satisfies IStorage,
    ads: {
      async load() {},
      async show() {
        return 'not_ready';
      },
      isReady: () => false,
      dispose() {},
    } satisfies IAdService,
    audio: {
      play() {},
      stop() {},
      stopAll() {},
      setMuted() {},
      isMuted: () => false,
      dispose() {},
    } satisfies IAudio,
    analytics: { track() {} } satisfies IAnalytics,
    platform: {
      getSystemInfo: () => ({
        brand: 'test',
        model: 'test',
        platform: 'devtools',
        system: 'test',
        SDKVersion: '2.19.0',
        windowWidth: 375,
        windowHeight: 667,
        pixelRatio: 2,
      }),
      onShow() {},
      onHide() {},
      offShow() {},
      offHide() {},
    } satisfies IPlatform,
  };
}

function fillWithoutMatches(board: BoardModel): void {
  const palette = [TileKind.Red, TileKind.Blue, TileKind.Yellow, TileKind.Purple];
  for (let r = 0; r < board.size.rows; r += 1) {
    for (let c = 0; c < board.size.cols; c += 1) {
      if (board.getTile(r, c) === TileKind.Hole) {
        continue;
      }
      for (const kind of palette) {
        board.setTile(r, c, kind);
        const left2 =
          c >= 2 &&
          board.getTile(r, c - 1) === kind &&
          board.getTile(r, c - 2) === kind;
        const up2 =
          r >= 2 &&
          board.getTile(r - 1, c) === kind &&
          board.getTile(r - 2, c) === kind;
        if (!left2 && !up2) {
          break;
        }
      }
    }
  }
}

describe('ice cells', () => {
  it('coverPlayableWithIce skips holes and counts layers', () => {
    const board = new BoardModel({ rows: 2, cols: 2 });
    board.setTile(0, 0, TileKind.Hole);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(1, 0, TileKind.Blue);
    board.setTile(1, 1, TileKind.Green);
    assert.equal(board.coverPlayableWithIce(), 3);
    assert.equal(board.getIce(0, 0), 0);
    assert.equal(board.getIce(1, 1), 1);
  });

  it('matching a tile on ice breaks the ice', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      board.setTile(r, 0, TileKind.Red);
      board.setTile(r, 1, TileKind.Blue);
      board.setTile(r, 2, TileKind.Green);
    }
    board.coverPlayableWithIce();
    const finder = new MatchFinder();
    const resolver = new MatchResolver(finder);
    const matches = finder.findMatches(board);
    assert.ok(!matches.isEmpty());
    const result = resolver.resolve(board, matches, { seed: 1 });
    assert.ok(result.iceBroken >= 3);
    assert.ok(board.countIce() < 9);
  });

  it('coverBottomRowsWithIce only ices the bottom rows', () => {
    const board = new BoardModel({ rows: 4, cols: 3 });
    board.setTile(0, 0, TileKind.Hole);
    const n = board.coverBottomRowsWithIce(2);
    assert.equal(n, 5);
    assert.equal(board.getIce(0, 0), 0);
    assert.equal(board.getIce(0, 1), 1);
    assert.equal(board.getIce(1, 2), 1);
    assert.equal(board.getIce(2, 0), 0);
    assert.equal(board.getIce(3, 1), 0);
  });

  it('coverPlayableSkippingTopRows leaves the top rows unfrozen', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    const n = board.coverPlayableSkippingTopRows(2);
    assert.equal(n, 48);
    assert.equal(board.getIce(0, 0), 1);
    assert.equal(board.getIce(5, 7), 1);
    assert.equal(board.getIce(6, 0), 0);
    assert.equal(board.getIce(7, 4), 0);
  });

  it('split 3-4 skipping top two rows ices 42 cells', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    applyBoardShape(board, 'split_3_4');
    assert.equal(board.coverPlayableSkippingTopRows(2), 42);
    assert.equal(board.getIce(7, 0), 0);
    assert.equal(board.getIce(5, 0), 1);
    assert.equal(board.getIce(5, 3), 0);
  });

  it('encased ice locks swaps on frozen cells but not ice-free cells', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      board.setTile(r, 0, TileKind.Red);
      board.setTile(r, 1, TileKind.Blue);
      board.setTile(r, 2, TileKind.Green);
    }
    board.setTile(0, 0, TileKind.Blue);
    board.setTile(0, 1, TileKind.Red);
    board.coverPlayableWithIce();
    board.ice[board.index(0, 0)] = 0;
    board.ice[board.index(0, 1)] = 0;
    board.iceLocksTiles = true;
    const validator = new MoveValidator();
    assert.equal(validator.canSwap(board, 1, 0, 1, 1), false);
    assert.equal(validator.canSwap(board, 0, 0, 0, 1), true);
  });

  it('shuffle after ice lock still finds a move among unfrozen cells', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    generatePlayableBoard(board, 20250817);
    board.coverPlayableSkippingTopRows(2);
    board.iceLocksTiles = true;
    assert.equal(shuffleUntilPlayable(board, 20250817 + 99), true);
    const validator = new MoveValidator();
    assert.equal(hasAnyValidMove(board, validator), true);
  });

  it('clear_ice goal completes when all ice is gone', () => {
    const goals = new LevelGoals([{ type: 'clear_ice', count: 4 }]);
    goals.bindClearIceTarget(4);
    goals.syncClearIce(4);
    assert.equal(goals.isAllCompleted(), true);
  });

  it('encased ice still clears a standing 3-match without swapping', () => {
    const board = new BoardModel({ rows: 6, cols: 6 });
    fillWithoutMatches(board);
    board.setTile(3, 0, TileKind.Green);
    board.setTile(3, 1, TileKind.Green);
    board.setTile(3, 2, TileKind.Green);
    board.setTile(3, 3, TileKind.Green);
    board.coverPlayableSkippingTopRows(2);
    board.iceLocksTiles = true;
    const finder = new MatchFinder();
    const resolver = new MatchResolver(finder);
    const iceBefore = board.countIce();
    const result = resolver.resolveBoard(board, { seed: 9 });
    assert.ok(result.cleared >= 4);
    assert.ok(result.iceBroken >= 4);
    assert.ok(board.countIce() < iceBefore);
    assert.equal(finder.findMatches(board).isEmpty(), true);
  });

  it('局内已有冰封三连会在结算时自动消除', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    await session.startLevelWithConfig({
      id: 1,
      seed: 11,
      moves: 20,
      board: { rows: 8, cols: 8 },
      ice: { skipTopRows: 2 },
      iceStyle: 'encase',
      goals: [{ type: 'score', score: 99999 }],
      crushEnabled: false,
      crushDurationMs: 0,
    });
    const board = session.getBoard()!;
    fillWithoutMatches(board);
    board.setTile(3, 0, TileKind.Green);
    board.setTile(3, 1, TileKind.Green);
    board.setTile(3, 2, TileKind.Green);
    assert.ok(board.getIce(3, 0) > 0);
    const iceBefore = board.countIce();
    const finder = new MatchFinder();
    assert.equal(finder.findMatches(board).isEmpty(), false);
    assert.equal(session.useHammer(7, 7), true);
    assert.equal(finder.findMatches(board).isEmpty(), true);
    assert.ok(board.countIce() < iceBefore);
  });
});

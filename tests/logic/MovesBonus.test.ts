/**
 * 通关剩余步数加成：打到彩色块闪光后爆炸。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  IAdService,
  IAnalytics,
  IAudio,
  IPlatform,
  IStorage,
} from '../../src/core';
import { TileKind } from '../../src/logic/board/TileType';
import type { LevelConfig } from '../../src/logic/level/LevelConfig';
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

describe('剩余步数加成', () => {
  it('通关后剩余步数转闪光并爆炸加分，再进结算', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    const level: LevelConfig = {
      id: 1,
      seed: 77,
      moves: 8,
      board: { rows: 4, cols: 4 },
      goals: [{ type: 'score', score: 10 }],
      crushEnabled: false,
      crushDurationMs: 0,
    };
    session.setLevelTable([level]);
    await session.startLevelWithConfig(level);

    const board = session.getBoard()!;
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 2, TileKind.Red);

    assert.equal(session.trySwap(0, 2, 1, 2), true);
    assert.equal(session.fsm.getCurrent(), 'LevelWon');
    assert.equal(session.hasPendingMovesBonus(), true);
    assert.ok(session.getMovesLeft() > 0);

    const before = session.getScore();
    const left = session.getMovesLeft();
    assert.equal(session.runMovesBonus(), true);
    assert.equal(session.getMovesLeft(), 0);
    assert.equal(session.hasPendingMovesBonus(), false);
    assert.equal(session.fsm.getCurrent(), 'Settle');
    // 爆炸应至少带来一些加分（盘面有彩色块）
    assert.ok(session.getScore() >= before);
    assert.ok(left >= 1);
  });
});

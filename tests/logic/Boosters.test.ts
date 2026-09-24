/**
 * 局内道具：锤子 / 重排 / 加步。
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
import { StorageKeys } from '../../src/core';
import type { LevelConfig } from '../../src/logic/level/LevelConfig';
import { TileKind } from '../../src/logic/board/TileType';
import { GameSession, type GameSessionDeps } from '../../src/services/GameSession';

function createDeps(): GameSessionDeps {
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
        return 'completed';
      },
      isReady: () => true,
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
        pixelRatio: 2,
        windowWidth: 375,
        windowHeight: 667,
        system: 'test',
        platform: 'devtools',
        SDKVersion: '2.19.0',
      }),
      onShow() {},
      onHide() {},
      offShow() {},
      offHide() {},
    } satisfies IPlatform,
  };
}

const tinyLevel = (): LevelConfig => ({
  id: 1,
  seed: 42,
  moves: 20,
  board: { rows: 5, cols: 5 },
  goals: [{ type: 'score', score: 99999 }],
  crushEnabled: true,
  crushDurationMs: 5000,
});

describe('Boosters', () => {
  it('开局不白送道具，仅登录锤子入包', async () => {
    const deps = createDeps();
    const session = new GameSession(deps);
    await session.init();
    session.setLevelTable([tinyLevel()]);
    await session.startLevel(1);
    const stock = session.getBoosterStock();
    assert.equal(stock.hammer, 1);
    assert.equal(stock.shuffle, 0);
    assert.equal(stock.extraMoves, 0);
  });

  it('加步消耗库存；空库存可看广告立刻 +5', async () => {
    const deps = createDeps();
    await deps.storage.set(StorageKeys.Boosters, {
      hammer: 0,
      shuffle: 0,
      extraMoves: 1,
    });
    const session = new GameSession(deps);
    await session.init();
    session.setLevelTable([tinyLevel()]);
    await session.startLevel(1);
    const before = session.getMovesLeft();
    assert.equal(session.useExtraMoves(), true);
    assert.equal(session.getMovesLeft(), before + 5);
    assert.equal(session.getBoosterCount('extraMoves'), 0);
    assert.equal(session.useExtraMoves(), false);
    assert.equal(session.getBoosterRefillChannel('extraMoves'), 'friend');
    assert.equal(session.claimBoosterShare('extraMoves'), true);
    assert.equal(session.getMovesLeft(), before + 10);
    assert.equal(session.getBoosterRefillChannel('extraMoves'), 'group');
    assert.equal(session.claimBoosterShare('extraMoves'), true);
    assert.equal(session.getMovesLeft(), before + 15);
    assert.equal(session.getBoosterRefillChannel('extraMoves'), 'ad');
    assert.equal(await session.watchAdForBooster('extraMoves'), 'revived');
    assert.equal(session.getMovesLeft(), before + 20);
    assert.equal(await session.watchAdForBooster('extraMoves'), 'revived');
    assert.equal(session.getMovesLeft(), before + 25);
  });

  it('锤子清除一格并扣库存', async () => {
    const deps = createDeps();
    const session = new GameSession(deps);
    await session.init();
    session.setLevelTable([tinyLevel()]);
    await session.startLevel(1);
    const board = session.getBoard()!;
    let target: { row: number; col: number } | null = null;
    for (let r = 0; r < board.size.rows && !target; r += 1) {
      for (let c = 0; c < board.size.cols; c += 1) {
        if (board.getTile(r, c) !== TileKind.Empty) {
          target = { row: r, col: c };
          break;
        }
      }
    }
    assert.ok(target);
    assert.equal(session.useHammer(target!.row, target!.col), true);
    assert.equal(session.getBoosterCount('hammer'), 0);
  });

  it('看广告获得重排后可洗牌', async () => {
    const deps = createDeps();
    const session = new GameSession(deps);
    await session.init();
    session.setLevelTable([tinyLevel()]);
    await session.startLevel(1);
    let shuffled = false;
    session.events.subscribe((e) => {
      if (e.type === 'BoardShuffled') {
        shuffled = true;
      }
    });
    assert.equal(session.getBoosterCount('shuffle'), 0);
    assert.equal(session.getBoosterRefillChannel('shuffle'), 'friend');
    assert.equal(await session.watchAdForBooster('shuffle'), 'unavailable');
    assert.equal(session.claimBoosterShare('shuffle'), true);
    assert.equal(session.claimBoosterShare('shuffle'), true);
    assert.equal(await session.watchAdForBooster('shuffle'), 'revived');
    assert.equal(session.getBoosterCount('shuffle'), 0);
    assert.equal(shuffled, true);
    assert.equal(await session.watchAdForBooster('shuffle'), 'revived');
    assert.equal(session.getBoosterCount('shuffle'), 0);
  });

  it('看广告领重排不会当成已经洗过牌', async () => {
    const deps = createDeps();
    const session = new GameSession(deps);
    await session.init();
    session.setLevelTable([tinyLevel()]);
    await session.startLevel(1);
    const used: string[] = [];
    session.events.subscribe((e) => {
      if (e.type === 'BoosterUsed') {
        used.push(e.boosterId);
      }
    });
    assert.equal(session.claimBoosterShare('shuffle'), true);
    assert.equal(session.claimBoosterShare('shuffle'), true);
    assert.equal(await session.watchAdForBooster('shuffle'), 'revived');
    assert.deepEqual(used, ['shuffle', 'shuffle', 'shuffle']);
    assert.equal(session.getBoosterCount('shuffle'), 0);
  });
});

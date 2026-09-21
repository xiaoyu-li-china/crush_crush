/**
 * 粉碎奖励：半径清格、Bomb 连锁、会话倒计时。
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
import { BoardModel } from '../../src/logic/board/BoardModel';
import { TileKind } from '../../src/logic/board/TileType';
import { CrushRewardModel } from '../../src/logic/crush/CrushRewardModel';
import { CrushResolver } from '../../src/logic/crush/CrushResolver';
import type { LevelConfig } from '../../src/logic/level/LevelConfig';
import { GameSession, type GameSessionDeps } from '../../src/services/GameSession';

function createMemoryDeps(played: string[] = []): GameSessionDeps {
  const store = new Map<string, unknown>();
  const storage: IStorage = {
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
  };

  return {
    storage,
    ads: {
      async load() {},
      async show() {
        return 'completed';
      },
      isReady: () => true,
      dispose() {},
    } satisfies IAdService,
    audio: {
      play(clipId) {
        played.push(clipId);
      },
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

describe('CrushResolver', () => {
  it('点击以半径清格', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        board.setTile(r, c, TileKind.Red);
      }
    }
    const session = new CrushRewardModel(5000, 1);
    const resolver = new CrushResolver();
    const result = resolver.resolveTap(board, session, 1, 1);

    // 半径 1 的中心点清掉整盘 3x3
    assert.equal(result.clearedIndices.length, 9);
    assert.equal(board.getTile(1, 1), TileKind.Empty);
    assert.equal(board.getTile(0, 0), TileKind.Empty);
  });

  it('Bomb 触发连锁', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        board.setTile(r, c, TileKind.Blue);
      }
    }
    board.setTile(1, 1, TileKind.Bomb);
    const session = new CrushRewardModel(5000, 0);
    const resolver = new CrushResolver();
    // radius 0 只清圆心；Bomb 再入队 radius>=1 连锁
    const result = resolver.resolveTap(board, session, 1, 1);
    assert.ok(result.fired.length >= 2);
    assert.ok(result.clearedIndices.length >= 1);
    assert.equal(board.getTile(1, 1), TileKind.Empty);
  });

  it('时间到收尾：剩余小动物全部粉碎，不必点完', () => {
    const board = new BoardModel({ rows: 6, cols: 6 });
    for (let r = 0; r < 6; r += 1) {
      for (let c = 0; c < 6; c += 1) {
        board.setTile(r, c, TileKind.Yellow);
      }
    }
    const session = new CrushRewardModel(100, 1);
    const resolver = new CrushResolver();
    const result = resolver.resolveFinale(board, session, 16);
    assert.equal(result.clearedIndices.length, 36);
    for (let i = 0; i < board.length; i += 1) {
      assert.equal(board.cells[i], TileKind.Empty);
    }
    assert.equal(resolver.resolveFinale(board, session, 0).clearedIndices.length, 0);
  });
});

describe('GameSession crush reward', () => {
  it('第一关通关后进入 CrushReward，点击加分，结束后 Settle', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();

    const level: LevelConfig = {
      id: 1,
      seed: 42,
      moves: 10,
      board: { rows: 4, cols: 4 },
      goals: [{ type: 'score', score: 10 }],
      crushEnabled: true,
      crushDurationMs: 8000,
    };
    session.setLevelTable([level]);
    await session.startLevelWithConfig(level);

    // 强制制造一个可消三连
    const board = session.getBoard()!;
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 2, TileKind.Red);

    // 交换 (0,2) Blue 与 (1,2) Red → 顶行三红
    const swapped = session.trySwap(0, 2, 1, 2);
    assert.equal(swapped, true);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'CrushReward');
    assert.ok(session.getCrushSession());

    const before = session.getScore();
    const tapped = session.tryCrushTap(1, 1);
    assert.equal(tapped, true);
    assert.ok(session.getScore() >= before);
    assert.ok(session.getCrushScore() > 0);

    const finished = session.finishCrushReward();
    assert.equal(finished, true);
    assert.equal(session.fsm.getCurrent(), 'Settle');
  });

  it('倒计时耗尽自动结束粉碎', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    const level: LevelConfig = {
      id: 1,
      seed: 1,
      moves: 5,
      board: { rows: 3, cols: 3 },
      goals: [{ type: 'score', score: 10 }],
      crushEnabled: true,
      crushDurationMs: 100,
    };
    session.setLevelTable([level]);
    await session.startLevelWithConfig(level);

    const board = session.getBoard()!;
    board.setTile(0, 0, TileKind.Green);
    board.setTile(0, 1, TileKind.Green);
    board.setTile(0, 2, TileKind.Yellow);
    board.setTile(1, 2, TileKind.Green);
    assert.equal(session.trySwap(0, 2, 1, 2), true);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'CrushReward');

    assert.equal(session.tickCrushReward(150), false);
    assert.equal(session.fsm.getCurrent(), 'Settle');
    const leftoverBoard = session.getBoard();
    assert.ok(leftoverBoard);
    for (let i = 0; i < leftoverBoard.length; i += 1) {
      const kind = leftoverBoard.cells[i];
      assert.equal(kind === TileKind.Empty || kind === TileKind.Hole, true);
    }
  });

  it('结算分≥1500 可进入清洁模式一次，清扫不加主线分', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    const level: LevelConfig = {
      id: 1,
      seed: 7,
      moves: 8,
      board: { rows: 4, cols: 4 },
      goals: [{ type: 'score', score: 10 }],
      crushEnabled: true,
      crushDurationMs: 5000,
    };
    session.setLevelTable([level]);
    await session.startLevelWithConfig(level);

    const board = session.getBoard()!;
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 2, TileKind.Red);
    assert.equal(session.trySwap(0, 2, 1, 2), true);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'CrushReward');
    assert.equal(session.finishCrushReward(), true);
    assert.equal(session.fsm.getCurrent(), 'Settle');

    assert.equal(session.canOfferCleaning(), false);
    session.forceScoreForTest(1500);
    assert.equal(session.canOfferCleaning(), true);
    assert.equal(session.getCleanScoreThreshold(), 1500);

    const mainScore = session.getScore();
    assert.equal(session.startCleaningMode(), true);
    assert.equal(session.fsm.getCurrent(), 'Cleaning');
    assert.ok(session.getCleanSession());
    assert.equal(session.canOfferCleaning(), false);

    // 角落一点，未必扫空整盘
    const tapped = session.tryCrushTap(0, 0);
    assert.equal(tapped, true);
    // 清洁模式不影响主线总分
    assert.equal(session.getScore(), mainScore);

    if (session.fsm.getCurrent() === 'Cleaning') {
      assert.ok((session.getCleanSession()?.crushScore ?? 0) >= 0);
      assert.equal(session.finishCleaningMode(), true);
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(session.canOfferCleaning(), false);
    assert.equal(session.startCleaningMode(), false);
  });

  it('粉碎盘面扫空后剩余瞬间清零并结束', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    const level: LevelConfig = {
      id: 1,
      seed: 11,
      moves: 8,
      board: { rows: 6, cols: 6 },
      shape: 'diamond',
      goals: [{ type: 'score', score: 10 }],
      crushEnabled: true,
      crushDurationMs: 14000,
    };
    session.setLevelTable([level]);
    await session.startLevelWithConfig(level);

    const board = session.getBoard()!;
    board.setTile(2, 2, TileKind.Red);
    board.setTile(2, 3, TileKind.Red);
    board.setTile(2, 4, TileKind.Blue);
    board.setTile(3, 4, TileKind.Red);
    assert.equal(session.trySwap(2, 4, 3, 4), true);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'CrushReward');

    for (let i = 0; i < board.length; i += 1) {
      if (board.cells[i] !== TileKind.Hole) {
        board.cells[i] = TileKind.Empty;
      }
    }
    board.setTile(2, 2, TileKind.Green);

    assert.equal(session.tryCrushTap(2, 2), true);
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(session.getCrushSession()?.remainingMs ?? 0, 0);
  });

  it('清洁盘面扫空后剩余瞬间清零并结束', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    const level: LevelConfig = {
      id: 1,
      seed: 9,
      moves: 5,
      board: { rows: 3, cols: 3 },
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
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');

    session.forceScoreForTest(1800);
    assert.equal(session.startCleaningMode(), true);
    assert.equal(session.fsm.getCurrent(), 'Cleaning');

    // 清空盘面后点一下触发检测：或直接点中心清掉 3x3
    const cleanBoard = session.getBoard()!;
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        cleanBoard.setTile(r, c, TileKind.Green);
      }
    }
    // 中心半径 1 可清全盘
    assert.equal(session.tryCrushTap(1, 1), true);
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(session.getCleanSession(), null);
  });

  it('拒绝清洁后本关不再询问', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    const level: LevelConfig = {
      id: 1,
      seed: 3,
      moves: 5,
      board: { rows: 3, cols: 3 },
      goals: [{ type: 'score', score: 10 }],
      crushEnabled: false,
      crushDurationMs: 0,
    };
    session.setLevelTable([level]);
    await session.startLevelWithConfig(level);

    const board = session.getBoard()!;
    board.setTile(0, 0, TileKind.Purple);
    board.setTile(0, 1, TileKind.Purple);
    board.setTile(0, 2, TileKind.Yellow);
    board.setTile(1, 2, TileKind.Purple);
    assert.equal(session.trySwap(0, 2, 1, 2), true);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');

    session.forceScoreForTest(2000);
    assert.equal(session.canOfferCleaning(), true);
    assert.equal(session.declineCleaningOffer(), true);
    assert.equal(session.canOfferCleaning(), false);
    assert.equal(session.startCleaningMode(), false);
  });

  it('CrushEnded 派发时已是 Settle，可立刻询问清洁', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    const level: LevelConfig = {
      id: 1,
      seed: 11,
      moves: 8,
      board: { rows: 4, cols: 4 },
      goals: [{ type: 'score', score: 10 }],
      crushEnabled: true,
      crushDurationMs: 5000,
    };
    session.setLevelTable([level]);
    await session.startLevelWithConfig(level);

    const board = session.getBoard()!;
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 2, TileKind.Red);
    assert.equal(session.trySwap(0, 2, 1, 2), true);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'CrushReward');

    session.forceScoreForTest(1740);
    let offerDuringCrushEnded = false;
    session.events.subscribe((event) => {
      if (event.type === 'CrushEnded') {
        offerDuringCrushEnded = session.canOfferCleaning();
      }
    });
    assert.equal(session.finishCrushReward(), true);
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(offerDuringCrushEnded, true);
  });

  it('粉碎/清洁点击按清格分值播 Good / Great / Excellent', async () => {
    const played: string[] = [];
    const session = new GameSession(createMemoryDeps(played));
    await session.init();
    const level: LevelConfig = {
      id: 1,
      seed: 3,
      moves: 8,
      board: { rows: 4, cols: 4 },
      goals: [{ type: 'score', score: 10 }],
      crushEnabled: true,
      crushDurationMs: 8000,
    };
    session.setLevelTable([level]);
    await session.startLevelWithConfig(level);

    const board = session.getBoard()!;
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 2, TileKind.Red);
    assert.equal(session.trySwap(0, 2, 1, 2), true);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'CrushReward');

    const crushBoard = session.getBoard()!;
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        crushBoard.setTile(r, c, TileKind.Red);
      }
    }
    played.length = 0;
    // 半径 1 点中心清 9 格 ×10 = 90 → 太棒了
    assert.equal(session.tryCrushTap(1, 1), true);
    assert.ok(played.includes('sfx_excellent'), `expected sfx_excellent, got ${played.join(',')}`);
  });
});

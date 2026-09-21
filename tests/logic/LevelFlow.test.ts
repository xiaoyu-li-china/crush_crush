/**
 * 第三阶段：FSM + 关卡目标 + 通关进下一关。
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
import { LevelGoals } from '../../src/logic/level/LevelGoals';
import type { LevelConfig } from '../../src/logic/level/LevelConfig';
import { LevelScene } from '../../src/presentation/ui/LevelScene';
import { GameSession, type GameSessionDeps } from '../../src/services/GameSession';

function createMemoryDeps(): GameSessionDeps {
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

function miniLevels(): LevelConfig[] {
  return [
    {
      id: 1,
      seed: 1,
      moves: 5,
      board: { rows: 3, cols: 3 },
      goals: [{ type: 'score', score: 30 }],
      crushEnabled: false,
      crushDurationMs: 0,
    },
    {
      id: 2,
      seed: 2,
      moves: 5,
      board: { rows: 3, cols: 3 },
      goals: [{ type: 'clear_blocks', count: 3 }],
      crushEnabled: false,
      crushDurationMs: 0,
    },
  ];
}

/** 写入「交换 (0,2)-(1,2) → 三消至少 3 格」的盘面。 */
function paintSwapMatch(session: GameSession): void {
  const board = session.getBoard()!;
  for (let r = 0; r < board.size.rows; r += 1) {
    for (let c = 0; c < board.size.cols; c += 1) {
      board.clearTile(r, c);
    }
  }
  board.setTile(0, 0, TileKind.Red);
  board.setTile(0, 1, TileKind.Red);
  board.setTile(0, 2, TileKind.Blue);
  board.setTile(1, 2, TileKind.Red);
  for (let r = 0; r < board.size.rows; r += 1) {
    for (let c = 0; c < board.size.cols; c += 1) {
      if (board.getTile(r, c) === TileKind.Empty) {
        board.setTile(r, c, (r + c) % 2 === 0 ? TileKind.Green : TileKind.Yellow);
      }
    }
  }
}

describe('LevelGoals', () => {
  it('score / collect / clear_blocks 进度与完成判定', () => {
    const goals = new LevelGoals([
      { type: 'score', score: 50 },
      { type: 'collect', kind: TileKind.Red, count: 2 },
      { type: 'clear_blocks', count: 3 },
    ]);

    goals.applyClearedKinds([TileKind.Red, TileKind.Blue, TileKind.Red]);
    goals.syncScore(40);
    assert.equal(goals.isAllCompleted(), false);
    assert.deepEqual(goals.getProgress(), [40, 2, 3]);

    goals.syncScore(50);
    assert.equal(goals.isAllCompleted(), true);
  });

  it('空消除不改进度；冰/云/宝石/雪人/企鹅绑定与同步', () => {
    const goals = new LevelGoals([
      { type: 'clear_ice', count: 1 },
      { type: 'clear_cloud', count: 1 },
      { type: 'collect_gems', count: 1 },
      { type: 'collect_snowmen', count: 1 },
      { type: 'collect_penguins', count: 1 },
    ]);
    goals.applyClearedKinds([]);
    assert.deepEqual(goals.getProgress(), [0, 0, 0, 0, 0]);
    goals.bindClearIceTarget(4);
    goals.syncClearIce(4);
    goals.bindClearCloudTarget(3);
    goals.syncClearCloud(3);
    goals.bindCollectGemsTarget(2);
    goals.syncCollectGems(2);
    goals.bindCollectSnowmenTarget(2);
    goals.syncCollectSnowmen(2);
    goals.bindCollectPenguinsTarget(1);
    goals.syncCollectPenguins(1);
    assert.equal(goals.isAllCompleted(), true);
    const snap = goals.getSnapshots();
    assert.equal(snap[0]!.completed, true);
    assert.equal(snap[0]!.target, 4);
    assert.deepEqual(
      goals.getGoals().map((g) => g.type),
      ['clear_ice', 'clear_cloud', 'collect_gems', 'collect_snowmen', 'collect_penguins'],
    );
  });

  it('无目标视为已完成', () => {
    const empty = new LevelGoals([]);
    assert.equal(empty.isAllCompleted(), true);
  });

  it('只有收集目标时，铺冰会补上必须清完冰', () => {
    const goals = new LevelGoals([{ type: 'collect', kind: 1, count: 3 }]);
    goals.bindClearIceTarget(4);
    assert.ok(goals.getGoals().some((g) => g.type === 'clear_ice'));
    assert.equal(goals.isAllCompleted(), false);
    goals.applyClearedKinds([1, 1, 1]);
    assert.equal(goals.isAllCompleted(), false);
    goals.syncClearIce(4);
    assert.equal(goals.isAllCompleted(), true);
  });
});

describe('Phase3 FSM + 通关进下一关', () => {
  it('达成分数目标后进入 Settle，并可进入下一关', async () => {
    const session = new GameSession(createMemoryDeps());
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);

    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    paintSwapMatch(session);

    const ok = session.trySwap(0, 2, 1, 2);
    assert.equal(ok, true);
    assert.ok(session.getScore() >= 30);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(session.getGoals()?.isAllCompleted(), true);
    assert.equal(session.progress.getData().highestLevelId, 2);

    const advanced = await session.continueToNextLevel();
    assert.equal(advanced, true);
    assert.equal(session.getLevelConfig()?.id, 2);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
  });

  it('步数耗尽且未完成目标 → LevelFailed，确认后可重试', async () => {
    const session = new GameSession(createMemoryDeps());
    session.setLevelTable([
      {
        id: 1,
        seed: 1,
        moves: 1,
        board: { rows: 3, cols: 3 },
        goals: [{ type: 'score', score: 99999 }],
        crushEnabled: false,
        crushDurationMs: 0,
      },
    ]);
    await session.init();
    await session.startLevel(1);
    paintSwapMatch(session);

    session.trySwap(0, 2, 1, 2);
    assert.equal(session.fsm.getCurrent(), 'LevelFailed');

    assert.equal(session.acknowledgeFailure(), true);
    assert.equal(session.fsm.getCurrent(), 'Settle');

    const retried = await session.retryLevel();
    assert.equal(retried, true);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    assert.equal(session.getMovesLeft(), 1);
  });

  it('LevelScene 结算按钮可触发下一关', async () => {
    const session = new GameSession(createMemoryDeps());
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    paintSwapMatch(session);

    const scene = new LevelScene();
    scene.onEnter(session, 1);

    session.trySwap(0, 2, 1, 2);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(scene.getResultView().isVisible(), true);
    assert.equal(scene.getResultView().getPayload()?.won, true);

    scene.getResultView().trigger('next');
    // 异步 continueToNextLevel
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(session.getLevelConfig()?.id, 2);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');

    scene.onExit();
  });

  it('通关第 2 关点下一关会弹插屏，关完广告仍进第 3 关', async () => {
    const shown: string[] = [];
    const deps = createMemoryDeps();
    deps.ads = {
      async load() {},
      async show(placement) {
        shown.push(placement);
        return 'completed';
      },
      isReady: () => true,
      dispose() {},
    };
    const session = new GameSession(deps);
    session.setLevelTable([
      ...miniLevels(),
      {
        id: 3,
        seed: 3,
        moves: 5,
        board: { rows: 3, cols: 3 },
        goals: [{ type: 'score', score: 30 }],
        crushEnabled: false,
        crushDurationMs: 0,
      },
    ]);
    await session.init();
    await session.startLevel(2);
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');
    await session.maybeShowSettleInterstitial();
    const ok = await session.continueToNextLevel();
    assert.equal(ok, true);
    assert.deepEqual(shown, ['interstitial_settle']);
    assert.equal(session.getLevelConfig()?.id, 3);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
  });

  it('冷启动大厅插屏只弹一次，进关后不再弹', async () => {
    const shown: string[] = [];
    const deps = createMemoryDeps();
    deps.ads = {
      async load() {},
      async show(placement) {
        shown.push(placement);
        return 'completed';
      },
      isReady: () => true,
      dispose() {},
    };
    const session = new GameSession(deps);
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(session.isLaunchInterstitialEnabled(), true);
    assert.equal(session.getLaunchInterstitialDelayMs(), 2500);
    await session.maybeShowLaunchInterstitial();
    await session.maybeShowLaunchInterstitial();
    assert.deepEqual(shown, ['interstitial_settle']);

    await session.startLevel(1);
    await session.maybeShowLaunchInterstitial();
    assert.deepEqual(shown, ['interstitial_settle']);
  });

  it('大厅插屏未就绪会重试，成功后不再弹', async () => {
    const shown: string[] = [];
    let ready = false;
    const deps = createMemoryDeps();
    deps.ads = {
      async load() {},
      async show(placement) {
        if (!ready) {
          return 'not_ready';
        }
        shown.push(placement);
        return 'completed';
      },
      isReady: () => ready,
      dispose() {},
    };
    const session = new GameSession(deps);
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(await session.maybeShowLaunchInterstitial(), 'retry');
    assert.deepEqual(shown, []);
    ready = true;
    assert.equal(await session.maybeShowLaunchInterstitial(), 'shown');
    assert.deepEqual(shown, ['interstitial_settle']);
    assert.equal(await session.maybeShowLaunchInterstitial(), 'stop');
  });
});

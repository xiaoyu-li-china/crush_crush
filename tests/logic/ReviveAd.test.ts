/**
 * 第四阶段：看广告复活。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AdShowResult,
  IAdService,
  IAnalytics,
  IAudio,
  IPlatform,
  IStorage,
} from '../../src/core';
import { TileKind } from '../../src/logic/board/TileType';
import type { LevelConfig } from '../../src/logic/level/LevelConfig';
import { LevelScene } from '../../src/presentation/ui/LevelScene';
import { GameSession, type GameSessionDeps } from '../../src/services/GameSession';

class FakeAdService implements IAdService {
  public showCalls = 0;
  public loadCalls: string[] = [];
  public nextResult: AdShowResult = 'completed';
  public ready = true;

  public async load(placement: string): Promise<void> {
    this.loadCalls.push(placement);
    this.ready = true;
  }

  public async show(_placement: string): Promise<AdShowResult> {
    this.showCalls += 1;
    return this.nextResult;
  }

  public isReady(): boolean {
    return this.ready;
  }

  public dispose(): void {
    this.ready = false;
  }
}

function createDeps(ads: IAdService): GameSessionDeps {
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
    ads,
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

function failLevelConfig(): LevelConfig {
  return {
    id: 1,
    seed: 1,
    moves: 1,
    board: { rows: 3, cols: 3 },
    goals: [{ type: 'score', score: 99999 }],
    crushEnabled: false,
    crushDurationMs: 0,
  };
}

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

describe('Phase4 看广告复活', () => {
  it('失败后看完激励视频可复活并回到 PlayerInput', async () => {
    const ads = new FakeAdService();
    const session = new GameSession(createDeps(ads));
    session.setLevelTable([failLevelConfig()]);
    await session.init();
    await session.startLevel(1);
    paintSwapMatch(session);

    session.trySwap(0, 2, 1, 2);
    assert.equal(session.fsm.getCurrent(), 'LevelFailed');

    const offer = session.getReviveOffer();
    assert.equal(offer.allowed, true);
    assert.equal(offer.movesGranted, 5);

    const result = await session.watchAdToRevive();
    assert.equal(result, 'revived');
    assert.equal(ads.showCalls, 1);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    assert.equal(session.getMovesLeft(), 5);
  });

  it('中途关闭广告（skipped）不复活', async () => {
    const ads = new FakeAdService();
    ads.nextResult = 'skipped';
    const session = new GameSession(createDeps(ads));
    session.setLevelTable([failLevelConfig()]);
    await session.init();
    await session.startLevel(1);
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);

    const result = await session.watchAdToRevive();
    assert.equal(result, 'skipped');
    assert.equal(session.fsm.getCurrent(), 'LevelFailed');
    assert.equal(session.getMovesLeft(), 0);
  });

  it('失败后可再次看广告复活', async () => {
    const ads = new FakeAdService();
    const session = new GameSession(createDeps(ads));
    session.setLevelTable([failLevelConfig()]);
    await session.init();
    await session.startLevel(1);
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);

    assert.equal(await session.watchAdToRevive(), 'revived');

    while (session.getMovesLeft() > 0 && session.fsm.getCurrent() === 'PlayerInput') {
      paintSwapMatch(session);
      const swapped = session.trySwap(0, 2, 1, 2);
      if (!swapped) {
        break;
      }
    }

    assert.equal(session.fsm.getCurrent(), 'LevelFailed');
    assert.equal(session.getReviveOffer().allowed, true);
    assert.equal(await session.watchAdToRevive(), 'revived');
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
  });

  it('LevelScene 复活按钮可恢复对局', async () => {
    const ads = new FakeAdService();
    const session = new GameSession(createDeps(ads));
    session.setLevelTable([failLevelConfig()]);
    await session.init();
    await session.startLevel(1);
    paintSwapMatch(session);

    const scene = new LevelScene();
    scene.onEnter(session, 1);
    session.trySwap(0, 2, 1, 2);

    assert.equal(scene.getResultView().isVisible(), true);
    assert.equal(scene.getResultView().getPayload()?.canRevive, true);

    scene.getResultView().trigger('revive');
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    assert.equal(scene.getResultView().isVisible(), false);
    assert.equal(session.getMovesLeft(), 5);

    scene.onExit();
  });
});

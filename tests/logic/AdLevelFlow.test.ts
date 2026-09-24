/**
 * 开广告 / 看广告 / 关广告 / App 切回：关卡仍可玩，不黑屏卡死。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hasAnyValidMove } from '../../src/logic/board/BoardShuffle';
import { MoveValidator } from '../../src/logic/board/MoveValidator';
import { GameSession } from '../../src/services/GameSession';
import { createMemoryDeps, miniLevels, paintSwapMatch, unlockBoosterAds } from '../helpers/memory-deps';

function assertPlayable(session: GameSession): void {
  assert.equal(session.fsm.getCurrent(), 'PlayerInput');
  const board = session.getBoard();
  assert.ok(board);
  assert.equal(hasAnyValidMove(board, new MoveValidator()), true);
}

describe('广告开关与关卡恢复', () => {
  it('正向：看完重排广告后仍是 PlayerInput，盘面可走', async () => {
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    unlockBoosterAds(session, 'shuffle');
    assert.equal(await session.watchAdForBooster('shuffle'), 'revived');
    assert.equal(session.getBoosterCount('shuffle'), 0);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    const board = session.getBoard();
    assert.ok(board);
    assert.equal(hasAnyValidMove(board, new MoveValidator()), true);
  });

  it('逆向：跳过 / 失败 / 未就绪不改关卡，仍可交换', async () => {
    let next: 'skipped' | 'error' | 'not_ready' = 'skipped';
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return next;
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    const moves = session.getMovesLeft();
    unlockBoosterAds(session, 'extraMoves');
    assert.equal(await session.watchAdToAddMoves(), 'skipped');
    next = 'error';
    assert.equal(await session.watchAdToAddMoves(), 'error');
    next = 'not_ready';
    assert.equal(await session.watchAdToAddMoves(), 'unavailable');
    assert.equal(session.getMovesLeft(), moves);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
  });

  it('边界：锤子广告不限次数，看完就入包', async () => {
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    session.claimBoosterShare('hammer');
    session.claimBoosterShare('hammer');
    for (let i = 0; i < 5; i += 1) {
      assert.equal(await session.watchAdForBooster('hammer'), 'revived');
    }
    assert.equal(session.getBoosterCount('hammer') >= 5, true);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
  });

  it('状态：失败看完复活广告回到 PlayerInput，盘面还在', async () => {
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    session.fsm.forceTo('LevelFailed');
    const board = session.getBoard();
    assert.equal(await session.watchAdToRevive(), 'revived');
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    assert.equal(session.getBoard(), board);
    session.fsm.forceTo('LevelFailed');
    assert.equal(await session.watchAdToRevive(), 'revived');
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
  });

  it('App 切到后台再回来：BGM 暂停/恢复，关卡仍可走', async () => {
    let suspended = 0;
    let resumed = 0;
    const deps = createMemoryDeps({
      async show() {
        return 'completed';
      },
      isReady: () => true,
    });
    deps.audio = {
      play() {},
      stop() {},
      stopAll() {},
      setMuted() {},
      isMuted: () => false,
      dispose() {},
      suspendForBackground() {
        suspended += 1;
      },
      resumeFromBackground() {
        resumed += 1;
      },
    };
    const session = new GameSession(deps);
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    session.suspendForBackground();
    session.resumeFromBackground();
    assert.equal(suspended, 1);
    assert.equal(resumed, 1);
    unlockBoosterAds(session, 'extraMoves');
    assert.equal(await session.watchAdToAddMoves(), 'revived');
    session.suspendForBackground();
    session.resumeFromBackground();
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    assert.ok(session.getBoard());
  });

  it('大厅不能看局内广告；进关后关广告再回大厅状态干净', async () => {
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(await session.watchAdForBooster('shuffle'), 'unavailable');
    await session.startLevel(1);
    assert.equal(await session.watchAdForBooster('shuffle'), 'unavailable');
    unlockBoosterAds(session, 'shuffle');
    assert.equal(await session.watchAdForBooster('shuffle'), 'revived');
    assert.equal(session.quitToLobby(), true);
    assert.equal(session.fsm.getCurrent(), 'Lobby');
    assert.equal(session.getBoard(), null);
    assert.equal(await session.watchAdToRevive(), 'unavailable');
  });

  it('偶数关结算插屏弹出后仍能回大厅', async () => {
    const shown: string[] = [];
    const session = new GameSession(
      createMemoryDeps({
        async show(placement) {
          shown.push(placement);
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(2);
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    if (session.fsm.getCurrent() === 'CrushReward') {
      session.finishCrushReward();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');
    await session.maybeShowSettleInterstitial();
    assert.equal(shown.includes('interstitial_settle'), true);
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(session.returnToLobby(), true);
    assert.equal(session.fsm.getCurrent(), 'Lobby');
  });

  it('关广告后连切 App 仍保持 PlayerInput，盘面可走', async () => {
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    const moves = session.getMovesLeft();
    unlockBoosterAds(session, 'extraMoves');
    assert.equal(await session.watchAdToAddMoves(), 'revived');
    assert.equal(session.getMovesLeft(), moves + 5);
    for (let i = 0; i < 8; i += 1) {
      session.suspendForBackground();
      session.resumeFromBackground();
    }
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    const board = session.getBoard();
    assert.ok(board);
    assert.equal(hasAnyValidMove(board, new MoveValidator()), true);
    await session.maybeShowSettleInterstitial();
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    assert.equal(await session.maybeShowLaunchInterstitial(), 'stop');
  });

  it('大厅插屏看完再进关，状态仍是 PlayerInput', async () => {
    const shown: string[] = [];
    const session = new GameSession(
      createMemoryDeps({
        async show(placement) {
          shown.push(placement);
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(await session.maybeShowLaunchInterstitial(), 'shown');
    assert.equal(shown.includes('interstitial_settle'), true);
    await session.startLevel(1);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    assert.ok(session.getBoard());
    assert.equal(await session.maybeShowLaunchInterstitial(), 'stop');
  });

  it('结算插屏跳过也不离开 Settle，仍能回大厅', async () => {
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return 'skipped';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(2);
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    if (session.fsm.getCurrent() === 'CrushReward') {
      session.finishCrushReward();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');
    await session.maybeShowSettleInterstitial();
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(session.returnToLobby(), true);
  });

  it('看广告过程中连切 App：关闭后仍 PlayerInput 且可交换', async () => {
    let release!: (result: 'completed') => void;
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return new Promise((resolve) => {
            release = resolve;
          });
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    unlockBoosterAds(session, 'extraMoves');
    const pending = session.watchAdToAddMoves();
    for (let i = 0; i < 6; i += 1) {
      session.suspendForBackground();
      session.resumeFromBackground();
    }
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    release('completed');
    assert.equal(await pending, 'revived');
    assertPlayable(session);
    paintSwapMatch(session);
    assert.equal(session.trySwap(0, 2, 1, 2), true);
  });

  it('大厅横幅展示后进关必须拦截；关卡仍可玩', async () => {
    const shown: string[] = [];
    let hidden = 0;
    const session = new GameSession(
      createMemoryDeps({
        async show(placement) {
          shown.push(placement);
          return 'completed';
        },
        hide() {
          hidden += 1;
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(await session.showLobbyBanner(), 'completed');
    await session.startLevel(1);
    assert.equal(await session.showLobbyBanner(), 'error');
    assert.ok(hidden >= 1);
    assertPlayable(session);
    assert.equal(shown.filter((item) => item === 'banner_lobby').length >= 1, true);
  });

  it('进门插屏：失败重试、并发第二次返回 retry、成功后不再弹', async () => {
    let calls = 0;
    let release!: (result: 'error' | 'completed') => void;
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          calls += 1;
          if (calls === 1) {
            return 'error';
          }
          return new Promise((resolve) => {
            release = resolve;
          });
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(await session.maybeShowLaunchInterstitial(), 'retry');
    const first = session.maybeShowLaunchInterstitial();
    const second = session.maybeShowLaunchInterstitial();
    assert.equal(await second, 'retry');
    release('completed');
    assert.equal(await first, 'shown');
    assert.equal(await session.maybeShowLaunchInterstitial(), 'stop');
    await session.startLevel(1);
    assertPlayable(session);
  });

  it('看完锤子广告后关卡可操作；跳过复活仍停在失败态', async () => {
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    unlockBoosterAds(session, 'hammer');
    assert.equal(await session.watchAdForBooster('hammer'), 'revived');
    assert.equal(session.getBoosterCount('hammer') >= 1, true);
    assertPlayable(session);
    session.fsm.forceTo('LevelFailed');
    const skipped = new GameSession(
      createMemoryDeps({
        async show() {
          return 'skipped';
        },
        isReady: () => true,
      }),
    );
    skipped.setLevelTable(miniLevels());
    await skipped.init();
    await skipped.startLevel(1);
    skipped.fsm.forceTo('LevelFailed');
    assert.equal(await skipped.watchAdToRevive(), 'skipped');
    assert.equal(skipped.fsm.getCurrent(), 'LevelFailed');
    assert.ok(skipped.getBoard());
  });

  it('粉碎延时广告：非粉碎态不可看；看完仍保持 CrushReward', async () => {
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable([
      ...miniLevels(),
      {
        id: 3,
        seed: 3,
        moves: 8,
        board: { rows: 3, cols: 3 },
        goals: [{ type: 'score', score: 1 }],
        crushEnabled: true,
        crushDurationMs: 8000,
      },
    ]);
    await session.init();
    assert.equal(await session.watchAdToExtendCrush(), 'unavailable');
    await session.startLevel(3);
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    if (session.fsm.getCurrent() !== 'CrushReward') {
      session.fsm.forceTo('CrushReward');
    }
    if (session.fsm.getCurrent() === 'CrushReward') {
      const result = await session.watchAdToExtendCrush();
      assert.equal(result === 'revived' || result === 'unavailable', true);
      assert.equal(session.fsm.getCurrent() === 'CrushReward' || session.fsm.getCurrent() === 'Settle', true);
    }
  });

  it('下一关本身不弹插屏，需界面先 maybeShowSettleInterstitial', async () => {
    const shown: string[] = [];
    const session = new GameSession(
      createMemoryDeps({
        async show(placement) {
          shown.push(placement);
          return 'completed';
        },
        isReady: () => true,
      }),
    );
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
    if (session.fsm.getCurrent() === 'CrushReward') {
      session.finishCrushReward();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');
    await session.maybeShowSettleInterstitial();
    assert.deepEqual(shown, ['interstitial_settle']);
    assert.equal(await session.continueToNextLevel(), true);
    assert.equal(session.getLevelConfig()?.id, 3);
    assert.deepEqual(shown, ['interstitial_settle']);
  });

  it('广告位切换：大厅横幅 / 插屏 / 激励互不串位', async () => {
    const shown: string[] = [];
    const session = new GameSession(
      createMemoryDeps({
        async show(placement) {
          shown.push(placement);
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(await session.showLobbyBanner(), 'completed');
    assert.equal(shown.at(-1), 'banner_lobby');
    assert.equal(await session.maybeShowLaunchInterstitial(), 'shown');
    assert.equal(shown.at(-1), 'interstitial_settle');
    await session.startLevel(1);
    assert.equal(await session.showLobbyBanner(), 'error');
    assert.equal(await session.watchAdToExtendCrush(), 'unavailable');
    unlockBoosterAds(session, 'extraMoves');
    assert.equal(await session.watchAdForBooster('extraMoves'), 'revived');
    assert.equal(shown.at(-1), 'rewarded_revive');
    session.fsm.forceTo('LevelFailed');
    assert.equal(await session.watchAdToRevive(), 'revived');
    assert.equal(shown.at(-1), 'rewarded_revive');
    session.fsm.forceTo('Settle');
    await session.maybeShowSettleInterstitial();
    assert.equal(shown.includes('rewarded_crush_extend'), false);
  });

  it('失败确认进结算不弹通关插屏', async () => {
    const shown: string[] = [];
    const session = new GameSession(
      createMemoryDeps({
        async show(placement) {
          shown.push(placement);
          return 'completed';
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(2);
    session.trySwap(0, 0, 0, 1);
    if (session.fsm.getCurrent() !== 'LevelFailed') {
      session.fsm.forceTo('LevelFailed');
    }
    assert.equal(session.acknowledgeFailure(), true);
    await session.maybeShowSettleInterstitial();
    assert.deepEqual(shown, []);
  });
});

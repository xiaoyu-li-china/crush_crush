/**
 * GameSession 广告 / 大厅 / 非法态：等价类 + 状态转换。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TileKind } from '../../src/logic/board/TileType';
import {
  createMemoryDeps,
  miniLevels,
  paintSwapMatch,
  unlockBoosterAds,
} from '../helpers/memory-deps';
import { GameSession } from '../../src/services/GameSession';

describe('GameSession 非法态与边界', () => {
  it('未知关卡抛错；大厅不能加步/复活/插屏结算', async () => {
    const session = new GameSession(createMemoryDeps());
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(session.useExtraMoves(), false);
    assert.equal(session.allowsRewardedExtraMoves(), false);
    assert.equal(session.getReviveOffer().allowed, false);
    assert.equal(await session.watchAdToAddMoves(), 'unavailable');
    assert.equal(await session.watchAdToRevive(), 'unavailable');
    assert.equal(await session.watchAdToExtendCrush(), 'unavailable');
    assert.equal(await session.retryLevel(), false);
    assert.equal(await session.continueToNextLevel(), false);
    assert.equal(session.returnToLobby(), false);
    assert.equal(session.quitToLobby(), true);
    assert.equal(session.acknowledgeFailure(), false);
    assert.equal(session.hasNextLevel(), false);
    await session.maybeShowSettleInterstitial();
    await session.startLevel(99);
    assert.equal(session.getLevelConfig()?.id, 1);
    session.setLevelTable([]);
    await assert.rejects(() => session.startLevel(1), /Level config not found: 1/);
  });

  it('进关后允许看广告加步；跳过不加工；未就绪 unavailable', async () => {
    const shown: string[] = [];
    let next: 'completed' | 'skipped' | 'not_ready' | 'error' = 'skipped';
    const session = new GameSession(
      createMemoryDeps({
        async show(placement) {
          shown.push(placement);
          return next;
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    assert.equal(session.allowsRewardedExtraMoves(), true);
    unlockBoosterAds(session, 'extraMoves');
    const before = session.getMovesLeft();
    assert.equal(await session.watchAdToAddMoves(), 'skipped');
    assert.equal(session.getMovesLeft(), before);
    next = 'completed';
    assert.equal(await session.watchAdToAddMoves(), 'revived');
    assert.equal(session.getMovesLeft(), before + 5);
    next = 'not_ready';
    assert.equal(await session.watchAdToAddMoves(), 'unavailable');
    next = 'error';
    assert.equal(await session.watchAdToAddMoves(), 'error');
    assert.deepEqual(shown, [
      'rewarded_revive',
      'rewarded_revive',
      'rewarded_revive',
      'rewarded_revive',
    ]);
  });

  it('奇数关通关不弹结算插屏；非大厅不弹进门插屏', async () => {
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
    assert.equal(session.getLaunchInterstitialRetryMs(), 2500);
    assert.equal(session.getLaunchInterstitialTimeoutMs(), 45000);
    await session.startLevel(1);
    assert.equal(await session.maybeShowLaunchInterstitial(), 'stop');
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.fsm.getCurrent(), 'Settle');
    assert.equal(session.hasNextLevel(), true);
    const ok = await session.continueToNextLevel();
    assert.equal(ok, true);
    assert.deepEqual(shown, []);
  });

  it('最后一关通关后下一关失败；回大厅成功', async () => {
    const session = new GameSession(createMemoryDeps());
    session.setLevelTable([miniLevels()[0]!]);
    await session.init();
    await session.startLevel(1);
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.hasNextLevel(), false);
    assert.equal(await session.continueToNextLevel(), false);
    assert.equal(session.returnToLobby(), true);
    assert.equal(session.fsm.getCurrent(), 'Lobby');
  });

  it('对局中 quitToLobby 放弃当前关', async () => {
    const session = new GameSession(createMemoryDeps());
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    assert.equal(session.fsm.getCurrent(), 'PlayerInput');
    assert.equal(session.quitToLobby(), true);
    assert.equal(session.fsm.getCurrent(), 'Lobby');
    assert.equal(session.getBoard(), null);
  });

  it('非法交换拒绝且不扣步；对角不相邻', async () => {
    const session = new GameSession(createMemoryDeps());
    session.setLevelTable(miniLevels());
    await session.init();
    await session.startLevel(1);
    const moves = session.getMovesLeft();
    assert.equal(session.trySwap(0, 0, 1, 1), false);
    assert.equal(session.getMovesLeft(), moves);
    const board = session.getBoard()!;
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Blue);
    assert.equal(session.trySwap(0, 0, 0, 1), false);
    assert.equal(session.getMovesLeft(), moves);
  });
});

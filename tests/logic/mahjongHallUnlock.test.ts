import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  lobbyNoticeForMahjongState,
  mahjongHallLockHint,
} from '../../src/logic/mahjong/mahjongHallUnlockCopy';
import { MAHJONG_HALL_UNLOCK_LADDER_COINS } from '../../src/logic/mahjong/MahjongConfig';
import { GameSession } from '../../src/services/GameSession';
import { createMemoryDeps } from '../helpers/memory-deps';

describe('萌宠麻将馆解锁', () => {
  it('累计梯子金币达标可解锁（无需通第 20 关）', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    assert.equal(session.isMahjongHallUnlocked(), false);
    const progress = session.progress.getData();
    progress.levelScores = { '5': MAHJONG_HALL_UNLOCK_LADDER_COINS * 100 };
    session.progress.load(progress);
    assert.equal(session.isMahjongHallUnlocked(), true);
  });

  it('锁定提示含两种解锁方式', () => {
    assert.match(mahjongHallLockHint(), /20/);
    assert.match(mahjongHallLockHint(), /300/);
  });

  it('解锁后隐藏红字公告与泡泡中的麻将馆文案', () => {
    const locked = lobbyNoticeForMahjongState(false);
    assert.equal(locked.showMahjongTeaser, true);
    assert.ok(locked.bubbles.some((line) => line.includes('麻将馆')));
    assert.match(locked.body, /麻将馆/);

    const unlocked = lobbyNoticeForMahjongState(true);
    assert.equal(unlocked.showMahjongTeaser, false);
    assert.ok(!unlocked.bubbles.some((line) => line.includes('麻将馆')));
    assert.doesNotMatch(unlocked.body, /麻将馆/);
  });
});

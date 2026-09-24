import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyDailyLogin,
  claimDailyShuffle,
  DAILY_GOAL_CLEARS,
  lobbyDailyHint,
  lobbyDailyProgress,
  localYmd,
  recordDailyClear,
} from '../../src/logic/economy/DailyLoop';

describe('DailyLoop', () => {
  it('new day grants a hammer and resets clears', () => {
    const now = Date.parse('2026-09-14T10:00:00+08:00');
    const first = applyDailyLogin(null, now);
    assert.equal(first.grantedHammer, true);
    assert.equal(first.data.ymd, localYmd(now));
    assert.equal(first.data.bonusHammer, 1);
    assert.equal(first.data.clearsToday, 0);
    assert.equal(first.data.adHammer, 0);

    const same = applyDailyLogin(first.data, now + 3600_000);
    assert.equal(same.grantedHammer, false);
    assert.equal(same.data.bonusHammer, 1);

    const nextDay = applyDailyLogin(first.data, Date.parse('2026-09-15T08:00:00+08:00'));
    assert.equal(nextDay.grantedHammer, true);
    assert.equal(nextDay.data.bonusHammer, 1);
    assert.equal(nextDay.data.clearsToday, 0);
    assert.equal(nextDay.data.playShuffleGranted, false);
  });

  it('counts clears and writes lobby hint', () => {
    const now = Date.parse('2026-09-14T12:00:00+08:00');
    let data = applyDailyLogin(null, now).data;
    data = recordDailyClear(data, now);
    data = recordDailyClear(data, now);
    assert.equal(data.clearsToday, 2);
    assert.match(lobbyDailyHint(2, false), /再过 1 关可领重排/);
    data = recordDailyClear(data, now);
    assert.equal(data.clearsToday, DAILY_GOAL_CLEARS);
    assert.match(lobbyDailyHint(3, true), /重排已到账/);
    assert.match(lobbyDailyHint(3, false), /目标完成/);
    assert.match(lobbyDailyHint(0, false), /再过 3 关/);
  });

  it('进度条按通关格数前进，满 3 关后才能领取重排', () => {
    const now = Date.parse('2026-09-14T12:00:00+08:00');
    let data = applyDailyLogin(null, now).data;
    assert.equal(lobbyDailyProgress(0, false).label, '今日通关进度 [0/3]');
    data = recordDailyClear(data, now);
    const one = lobbyDailyProgress(data.clearsToday, data.playShuffleGranted);
    assert.equal(one.label, '今日通关进度 [1/3]');
    assert.equal(one.done, 1);
    assert.equal(one.readyToClaim, false);
    data = recordDailyClear(data, now);
    data = recordDailyClear(data, now);
    const full = lobbyDailyProgress(data.clearsToday, data.playShuffleGranted);
    assert.equal(full.label, '今日通关进度 [3/3]');
    assert.equal(full.readyToClaim, true);
    const early = claimDailyShuffle({ ...data, clearsToday: 2, playShuffleGranted: false });
    assert.equal(early.granted, false);
    const claimed = claimDailyShuffle(data);
    assert.equal(claimed.granted, true);
    assert.equal(claimed.data.playShuffleGranted, true);
    assert.equal(claimDailyShuffle(claimed.data).granted, false);
    assert.equal(lobbyDailyProgress(3, true).readyToClaim, false);
  });
});

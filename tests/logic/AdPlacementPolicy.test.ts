import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AdPlacementPolicy } from '../../src/logic/economy/AdPlacementPolicy';

describe('AdPlacementPolicy interstitial', () => {
  const policy = new AdPlacementPolicy({
    offerReviveOnFail: true,
    interstitialEveryNLevels: 2,
  });

  it('shows on even win levels and not on fail', () => {
    assert.equal(policy.shouldShowInterstitial(2, true, 0, 10_000, 60), true);
    assert.equal(policy.shouldShowInterstitial(1, true, 0, 10_000, 60), false);
    assert.equal(policy.shouldShowInterstitial(2, false, 0, 10_000, 60), false);
  });

  it('respects cooldown so back-to-back clears do not stack ads', () => {
    assert.equal(policy.shouldShowInterstitial(4, true, 8_000, 10_000, 60), false);
    assert.equal(policy.shouldShowInterstitial(4, true, 8_000, 70_000, 60), true);
  });

  it('everyN<=0 永不插屏；冷却 0 或从未弹过则放行', () => {
    const off = new AdPlacementPolicy({ interstitialEveryNLevels: 0 });
    assert.equal(off.shouldShowInterstitial(2, true, 0, 1, 60), false);
    const neg = new AdPlacementPolicy({ interstitialEveryNLevels: -3 });
    assert.equal(neg.shouldShowInterstitial(2, true, 0, 1, 60), false);
    assert.equal(policy.shouldShowInterstitial(2, true, 1, 2, 0), true);
    assert.equal(policy.shouldShowInterstitial(2, true, 0, 1, 60), true);
  });

  it('decideOnSettle：胜出偶数关插屏；失败才给复活', () => {
    const win = policy.decideOnSettle(2, true);
    assert.equal(win.showInterstitial, true);
    assert.equal(win.offerRewardedRevive, false);
    assert.equal(win.offerCrushExtend, false);
    const fail = policy.decideOnSettle(1, false);
    assert.equal(fail.showInterstitial, false);
    assert.equal(fail.offerRewardedRevive, true);
    const noRevive = new AdPlacementPolicy({ offerReviveOnFail: false });
    assert.equal(noRevive.decideOnSettle(1, false).offerRewardedRevive, false);
  });

  it('缺省配置每 2 关、失败可复活', () => {
    const fresh = new AdPlacementPolicy();
    assert.equal(fresh.shouldShowInterstitial(2, true, 0, 0, 0), true);
    assert.equal(fresh.decideOnSettle(3, false).offerRewardedRevive, true);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addBoosterToWallet,
  boosterRefillBadge,
  boosterRefillChannel,
  bumpBoosterAd,
  EMPTY_BOOSTER_DAILY,
  markBoosterShare,
} from '../../src/logic/economy/BoosterEconomy';

describe('BoosterEconomy', () => {
  it('wallet cap at 9', () => {
    const next = addBoosterToWallet(
      { hammer: 8, shuffle: 0, extraMoves: 0 },
      'hammer',
      4,
    );
    assert.equal(next.hammer, 9);
  });

  it('records booster ad watches and share ladder', () => {
    let flags = { ...EMPTY_BOOSTER_DAILY };
    assert.equal(boosterRefillChannel(flags, 'hammer'), 'friend');
    flags = markBoosterShare(flags, 'hammer', 'friend');
    assert.equal(boosterRefillChannel(flags, 'hammer'), 'group');
    flags = markBoosterShare(flags, 'hammer', 'group');
    assert.equal(boosterRefillChannel(flags, 'hammer'), 'ad');
    flags = bumpBoosterAd(flags, 'hammer');
    flags = bumpBoosterAd(flags, 'shuffle');
    flags = bumpBoosterAd(flags, 'extraMoves');
    assert.equal(flags.adHammer, 1);
    assert.equal(flags.adShuffle, 1);
    assert.equal(flags.adExtra, 1);
    assert.equal(boosterRefillBadge('friend'), '好友');
    assert.equal(boosterRefillBadge('group'), '群');
    assert.equal(boosterRefillBadge('ad'), '广告');
  });
});

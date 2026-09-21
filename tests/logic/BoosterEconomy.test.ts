import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addBoosterToWallet,
  bumpBoosterAd,
  EMPTY_BOOSTER_DAILY,
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

  it('records booster ad watches', () => {
    let flags = { ...EMPTY_BOOSTER_DAILY };
    flags = bumpBoosterAd(flags, 'hammer');
    flags = bumpBoosterAd(flags, 'shuffle');
    flags = bumpBoosterAd(flags, 'extraMoves');
    assert.equal(flags.adHammer, 1);
    assert.equal(flags.adShuffle, 1);
    assert.equal(flags.adExtra, 1);
  });
});

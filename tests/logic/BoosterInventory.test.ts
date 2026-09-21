import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BoosterInventory } from '../../src/logic/economy/BoosterInventory';

describe('BoosterInventory', () => {
  it('reset 夹负数为 0；consume 空库存失败', () => {
    const inv = new BoosterInventory();
    inv.resetFromConfig({
      hammer: { perLevel: -2 },
      shuffle: { perLevel: 1.8 },
      extraMoves: { perLevel: 0, moves: 5 },
    });
    assert.deepEqual(inv.getStock(), { hammer: 0, shuffle: 1, extraMoves: 0 });
    assert.equal(inv.canUse('hammer'), false);
    assert.equal(inv.consume('hammer'), false);
    assert.equal(inv.canUse('shuffle'), true);
    assert.equal(inv.consume('shuffle'), true);
    assert.equal(inv.getCount('shuffle'), 0);
  });

  it('add 0 不改库存；负数扣到 0', () => {
    const inv = new BoosterInventory();
    inv.resetFromConfig({
      hammer: { perLevel: 1 },
      shuffle: { perLevel: 0 },
      extraMoves: { perLevel: 0, moves: 5 },
    });
    inv.add('hammer', 0);
    assert.equal(inv.getCount('hammer'), 1);
    inv.add('hammer', 2);
    assert.equal(inv.getCount('hammer'), 3);
    inv.add('hammer', -10);
    assert.equal(inv.getCount('hammer'), 0);
  });
});

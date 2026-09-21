import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RevivePolicy } from '../../src/logic/economy/RevivePolicy';

describe('RevivePolicy', () => {
  it('默认每关 1 次、+5 步；用尽后 allowed=false', () => {
    const policy = new RevivePolicy();
    const first = policy.offer();
    assert.equal(first.allowed, true);
    assert.equal(first.movesGranted, 5);
    assert.equal(first.used, 0);
    assert.equal(first.maxPerLevel, 1);
    policy.consume();
    const second = policy.offer();
    assert.equal(second.allowed, false);
    assert.equal(second.movesGranted, 0);
    assert.equal(second.used, 1);
  });

  it('max=0 永不复活；负数被夹成 0', () => {
    const none = new RevivePolicy({ maxRevivesPerLevel: 0, movesGranted: 5 });
    assert.equal(none.offer().allowed, false);
    const neg = new RevivePolicy({ maxRevivesPerLevel: -3, movesGranted: -2 });
    assert.equal(neg.offer().allowed, false);
    assert.equal(neg.offer().movesGranted, 0);
  });

  it('resetForLevel 清零；setMaxPerLevel 向下取整', () => {
    const policy = new RevivePolicy({ maxRevivesPerLevel: 1, movesGranted: 5 });
    policy.consume();
    policy.resetForLevel();
    assert.equal(policy.offer().used, 0);
    assert.equal(policy.offer().allowed, true);
    policy.setMaxPerLevel(2.9);
    assert.equal(policy.offer().maxPerLevel, 2);
    policy.setMaxPerLevel(-1);
    assert.equal(policy.offer().allowed, false);
  });

  it('Infinity 表示本关不限复活次数', () => {
    const policy = new RevivePolicy({
      maxRevivesPerLevel: Number.POSITIVE_INFINITY,
      movesGranted: 5,
    });
    policy.consume();
    policy.consume();
    assert.equal(policy.offer().allowed, true);
    assert.equal(policy.offer().movesGranted, 5);
  });
});

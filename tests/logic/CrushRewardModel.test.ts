import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CrushRewardModel } from '../../src/logic/crush/CrushRewardModel';

describe('CrushRewardModel', () => {
  it('负时长当成 0；到期 tick 返回 false', () => {
    const crush = new CrushRewardModel(-10, -1);
    assert.equal(crush.remainingMs, 0);
    assert.equal(crush.tapPower, 0);
    assert.equal(crush.isExpired(), true);
    assert.equal(crush.tick(16), false);
  });

  it('tick 扣时间；extend 忽略负数；forceExpire 立刻结束', () => {
    const crush = new CrushRewardModel(100, 1);
    assert.equal(crush.tick(40), true);
    assert.equal(crush.remainingMs, 60);
    crush.extend(-20);
    assert.equal(crush.remainingMs, 60);
    crush.extend(10);
    assert.equal(crush.remainingMs, 70);
    crush.forceExpire();
    assert.equal(crush.tick(1), false);
  });

  it('队列 enqueue / dequeue / 空队列 / clear', () => {
    const crush = new CrushRewardModel(1000);
    crush.enqueue({ epicenter: { r: 1, c: 2 }, radius: 1, kind: 'tap' });
    crush.enqueue({ epicenter: { r: 0, c: 0 }, radius: 2, kind: 'chain' });
    assert.equal(crush.dequeue()?.kind, 'tap');
    crush.clearQueue();
    assert.equal(crush.dequeue(), undefined);
  });
});

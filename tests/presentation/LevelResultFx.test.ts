/**
 * 结算彩带：开场有爆发，随后变稀，粒子有上限。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LevelResultFx } from '../../src/presentation/fx/LevelResultFx';

describe('LevelResultFx', () => {
  it('胜利开场粒子不超过上限，失败更少', () => {
    const fx = new LevelResultFx();
    fx.start(true, 0, 375, 667, 1200);
    assert.equal(fx.isActive(), true);
    assert.ok(fx.particleCount() > 20);
    assert.ok(fx.particleCount() <= 56);

    fx.setLite(true);
    fx.start(true, 0, 375, 667, 1200);
    assert.ok(fx.particleCount() <= 32);

    fx.start(false, 0, 375, 667, 80);
    assert.ok(fx.particleCount() <= 18);
    assert.ok(fx.particleCount() > 0);
  });

  it('持续飘落也不突破上限；stop 清空', () => {
    const fx = new LevelResultFx();
    fx.setLite(true);
    fx.start(true, 0, 375, 667, 900);
    for (let t = 200; t < 4000; t += 80) {
      fx.update(t);
      assert.ok(fx.particleCount() <= 32);
    }
    const layout = fx.getLayout(800);
    assert.equal(layout.interactive, true);
    assert.ok(layout.glow > 0);
    fx.stop();
    assert.equal(fx.isActive(), false);
    assert.equal(fx.particleCount(), 0);
    const idle = fx.getLayout(900);
    assert.equal(idle.buttonProgress, 1);
    assert.equal(idle.displayScore, 900);
  });
});

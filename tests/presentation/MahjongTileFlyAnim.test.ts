import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMahjongFlyAnim, sampleMahjongFlyAnim } from '../../src/presentation/mahjong/MahjongTileFlyAnim';

describe('麻将飞牌动画', () => {
  it('结束时到达目标位', () => {
    const anim = createMahjongFlyAnim({
      type: 1,
      fromX: 10,
      fromY: 20,
      fromW: 40,
      fromH: 50,
      fromRot: 0.3,
      toX: 100,
      toY: 200,
      toW: 36,
      toH: 46,
      startMs: 1000,
      durationMs: 300,
    });
    const mid = sampleMahjongFlyAnim(anim, 1150);
    assert.ok(mid.y < 200);
    const end = sampleMahjongFlyAnim(anim, 1300);
    assert.equal(end.done, true);
    assert.ok(Math.abs(end.x - 100) < 2);
    assert.ok(Math.abs(end.y - 200) < 4);
  });
});

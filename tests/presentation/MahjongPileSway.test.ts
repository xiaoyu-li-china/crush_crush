import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMahjongPileSway,
  createMahjongTileJitter,
  pokeMahjongPileSway,
  pokeMahjongTilesOnPointerMove,
  updateMahjongPileSway,
  updateMahjongTileJitters,
} from '../../src/presentation/mahjong/MahjongPileSway';
import type { MahjongTileHit } from '../../src/presentation/mahjong/MahjongPileLayout';

describe('MahjongPileSway', () => {
  it('滑动后逐渐回弹静止', () => {
    const s = createMahjongPileSway();
    pokeMahjongPileSway(s, 30, -18);
    assert.ok(Math.abs(s.ox) > 8);
    let moving = true;
    for (let i = 0; i < 400 && moving; i += 1) {
      moving = updateMahjongPileSway(s, 16);
    }
    assert.equal(moving, false);
    assert.ok(Math.abs(s.ox) < 0.2);
    assert.ok(Math.abs(s.oy) < 0.2);
  });

  it('滑动仅抖动划过的单张牌', () => {
    const hits: MahjongTileHit[] = [
      { index: 0, x: 10, y: 10, w: 40, h: 60, rot: 0 },
      { index: 1, x: 100, y: 10, w: 40, h: 60, rot: 0 },
    ];
    const jitters = [createMahjongTileJitter(), createMahjongTileJitter()];
    pokeMahjongTilesOnPointerMove(hits, jitters, 25, 30, 35, 32, 10, 2);
    assert.ok(Math.abs(jitters[0]!.ox) > 1);
    assert.ok(Math.abs(jitters[1]!.ox) < 0.05);
    let moving = true;
    for (let i = 0; i < 400 && moving; i += 1) {
      moving = updateMahjongTileJitters(jitters, 16);
    }
    assert.equal(moving, false);
  });
});

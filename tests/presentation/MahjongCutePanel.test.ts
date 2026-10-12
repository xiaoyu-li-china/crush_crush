import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mahjongCoverLayout,
  mahjongPlayLobbyCoverLayout,
} from '../../src/presentation/mahjong/MahjongCutePanel';

describe('MahjongCutePanel', () => {
  it('cover 布局与主线一致居中偏上', () => {
    const img = { width: 750, height: 1334 } as WxImage;
    const layout = mahjongCoverLayout(img, 390, 844, 0.52);
    assert.ok(layout.dw >= 390);
    assert.ok(layout.dh >= 844);
    assert.ok(layout.dy <= 0);
  });

  it('对局 lobby 裁切顶空并 cover 铺满', () => {
    const img = { width: 720, height: 1280 } as WxImage;
    const layout = mahjongPlayLobbyCoverLayout(img, 390, 844, 120, 520);
    assert.equal(layout.sy, Math.floor(1280 * 0.14));
    assert.ok(layout.sh < 1280);
    assert.ok(layout.dw >= 390);
    assert.ok(layout.dh >= 844);
  });
});

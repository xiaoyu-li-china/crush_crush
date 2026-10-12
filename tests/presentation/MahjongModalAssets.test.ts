import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAHJONG_MODAL_BG_SRC } from '../../src/presentation/mahjong/MahjongModalAssets';

describe('MahjongModalAssets', () => {
  it('牌槽已满弹窗底图路径', () => {
    assert.equal(MAHJONG_MODAL_BG_SRC.slotFull, 'assets/main/mahjong/modal-slot-full-bg.png');
  });
});

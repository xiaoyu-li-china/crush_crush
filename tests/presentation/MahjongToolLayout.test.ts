import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAHJONG_TOOL_AFTER_PET_GAP,
  MAHJONG_TOOL_LEFT_RESERVE_RATIO,
  mahjongToolButtonLayout,
} from '../../src/presentation/mahjong/MahjongPlayLayoutMetrics';

describe('MahjongToolLayout', () => {
  it('道具栏左移：贴小动物区右侧且不占满右缘', () => {
    const width = 390;
    const height = 844;
    const slots = mahjongToolButtonLayout(width, height);
    assert.equal(slots.length, 4);
    const leftLimit = Math.floor(width * MAHJONG_TOOL_LEFT_RESERVE_RATIO);
    assert.equal(slots[0]!.x, leftLimit + MAHJONG_TOOL_AFTER_PET_GAP);
    const last = slots[3]!;
    assert.ok(last.x + last.w < width - 10);
  });
});

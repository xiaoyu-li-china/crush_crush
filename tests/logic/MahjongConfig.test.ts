import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatMahjongGlobalCoinAmount,
  formatMahjongGlobalCoinCostLabel,
  MAHJONG_TOOL_DESCRIPTIONS,
  MAHJONG_TOOL_LABELS,
  type MahjongToolId,
} from '../../src/logic/mahjong/MahjongConfig';

describe('MahjongConfig', () => {
  it('全局金币数后缀金星', () => {
    assert.equal(formatMahjongGlobalCoinAmount(8), '8⭐');
    assert.equal(formatMahjongGlobalCoinAmount(300), '300⭐');
  });

  it('消耗文案带金币与金星', () => {
    assert.equal(formatMahjongGlobalCoinCostLabel(100), '100金币⭐');
    assert.equal(formatMahjongGlobalCoinCostLabel(300), '300金币⭐');
  });

  it('每个道具都有说明文案', () => {
    for (const tool of Object.keys(MAHJONG_TOOL_LABELS) as MahjongToolId[]) {
      assert.ok(MAHJONG_TOOL_DESCRIPTIONS[tool].length >= 4);
    }
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAHJONG_TOOL_LABELS, type MahjongToolId } from '../../src/logic/mahjong/MahjongConfig';
import { MAHJONG_TOOL_ICON_SRC } from '../../src/presentation/mahjong/MahjongToolIcons';

describe('MahjongToolIcons', () => {
  it('每个道具都有独立图标路径', () => {
    for (const tool of Object.keys(MAHJONG_TOOL_LABELS) as MahjongToolId[]) {
      assert.match(MAHJONG_TOOL_ICON_SRC[tool], /^assets\/main\/mahjong\/tools\/tool-.+\.png$/);
    }
  });
});

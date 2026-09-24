import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOBBY_BRAND_SUBTITLE,
  LOBBY_BRAND_TITLE,
  LOBBY_TREE_PROMPT,
} from '../../src/presentation/ui/LobbyLevelMap';

describe('大厅文案', () => {
  it('品牌与树屏提示保持糖果闯关口径', () => {
    assert.equal(LOBBY_BRAND_TITLE, '萌宠粉碎消');
    assert.equal(LOBBY_BRAND_SUBTITLE, '闯关消除 · 可爱小动物');
    assert.equal(LOBBY_TREE_PROMPT, '沿糖果梯子闯关，冲进糖果屋！');
  });
});

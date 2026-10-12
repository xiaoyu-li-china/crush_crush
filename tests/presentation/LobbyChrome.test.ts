import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOBBY_BRAND_SUBTITLE,
  LOBBY_BRAND_TITLE,
} from '../../src/presentation/ui/LobbyLevelMap';

describe('大厅文案', () => {
  it('品牌文案保持闯关消除口径', () => {
    assert.equal(LOBBY_BRAND_TITLE, '萌宠粉碎消');
    assert.equal(LOBBY_BRAND_SUBTITLE, '闯关消除 · 可爱小动物');
  });
});

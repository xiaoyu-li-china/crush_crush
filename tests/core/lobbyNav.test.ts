import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOBBY_NAV_CHIP_H,
  lobbyNavBottomGap,
} from '../../src/core/utils/lobbyNav';

describe('lobbyNav', () => {
  it('无横幅时抬过 Home 条，有横幅时叠在横幅上方', () => {
    assert.equal(lobbyNavBottomGap(0, 0), 24);
    assert.equal(lobbyNavBottomGap(0, 34), 48);
    assert.equal(lobbyNavBottomGap(120, 34), 132);
    assert.equal(LOBBY_NAV_CHIP_H, 36);
  });
});

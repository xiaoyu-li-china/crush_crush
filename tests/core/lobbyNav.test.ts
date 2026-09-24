import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOBBY_FRIEND_ACTION_H,
  LOBBY_GEAR_SIZE,
  LOBBY_NAV_CHIP_H,
  LOBBY_SIDE_ACTION_FONT,
  LOBBY_SIDE_ACTION_TOP_PAD,
  LOBBY_SOCIAL_ACTION_H,
  layoutLobbyBottom,
  layoutLobbyGear,
  layoutLobbySideActions,
  lobbyNavBottomGap,
  lobbySideActionsTop,
} from '../../src/core/utils/lobbyNav';

describe('lobbyNav', () => {
  it('无横幅时抬过 Home 条，有横幅时叠在横幅上方', () => {
    assert.equal(lobbyNavBottomGap(0, 0), 24);
    assert.equal(lobbyNavBottomGap(0, 34), 48);
    assert.equal(lobbyNavBottomGap(120, 34), 132);
    assert.equal(LOBBY_NAV_CHIP_H, 36);
  });

  it('左侧等宽列表含邀请/排行/怎么玩，左下角槽位与圈子齐平', () => {
    const frames = layoutLobbySideActions(120, 390);
    assert.deepEqual(
      frames.map((frame) => frame.label),
      ['邀请好友', '好友排行', '怎么玩'],
    );
    assert.deepEqual(
      frames.map((frame) => frame.id),
      ['invite', 'leaderboard', 'howto'],
    );
    assert.equal(frames[0]?.h, LOBBY_FRIEND_ACTION_H);
    assert.equal(frames[2]?.h, LOBBY_SOCIAL_ACTION_H);
    assert.equal(frames[0]?.w, frames[1]?.w);
    assert.equal(frames[0]?.h, frames[1]?.h);
    assert.ok((frames[0]?.w ?? 0) >= 72);
    assert.ok((frames[0]?.w ?? 0) <= 86);
    assert.ok((frames[1]?.y ?? 0) > (frames[0]?.y ?? 0) + (frames[0]?.h ?? 0));
    assert.equal(frames[1]?.id, 'leaderboard');
    assert.equal(frames[2]?.id, 'howto');
    assert.ok((frames[0]?.x ?? 0) + (frames[0]?.w ?? 0) < 390 / 2);
    assert.equal(frames[0]?.h, 26);

    const bottom = layoutLobbyBottom({
      width: 390,
      height: 844,
      bannerReserve: 0,
      safeBottom: 0,
      clearsToday: 1,
      shuffleGranted: false,
    });
    assert.equal(bottom.settings.id, 'settings');
    assert.equal(bottom.settings.w, LOBBY_GEAR_SIZE);
    assert.equal(bottom.settings.x, 12);
    assert.equal(bottom.settings.y, layoutLobbyGear(bottom.chips[0]!.y).y);
    assert.ok(bottom.settings.x + bottom.settings.w < bottom.chips[0]!.x);
    assert.equal(bottom.chips[0]?.y, bottom.chips[1]?.y);
  });

  it('左侧按钮顶边贴状态栏下最顶，不跟胶囊对齐', () => {
    const statusBar = 47;
    const top = lobbySideActionsTop(statusBar);
    assert.equal(top, Math.max(2, statusBar + LOBBY_SIDE_ACTION_TOP_PAD));
    assert.ok(top < statusBar);
    assert.equal(lobbySideActionsTop(0), 2);
    assert.equal(LOBBY_SIDE_ACTION_FONT, 11);
  });

  it('底部没有进度和库存，进度满 3 关才出现领取', () => {
    const mid = layoutLobbyBottom({
      width: 390,
      height: 844,
      bannerReserve: 0,
      safeBottom: 0,
      clearsToday: 1,
      shuffleGranted: false,
    });
    assert.equal(mid.claim, null);
    assert.equal(mid.chips.map((c) => c.label).join(','), '推荐,圈子');

    const ready = layoutLobbyBottom({
      width: 390,
      height: 844,
      bannerReserve: 0,
      safeBottom: 0,
      clearsToday: 3,
      shuffleGranted: false,
    });
    assert.ok(ready.claim);
    assert.equal(ready.claim?.id, 'claim_shuffle');
    assert.ok((ready.contentTop ?? 0) < ready.chips[0]!.y);
  });
});

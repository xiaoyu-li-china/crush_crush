/**
 * 广告弹层 / 切后台：等价类、边界、正向逆向。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AD_FALSE_SHOW_MS,
  AD_OVERLAY_ABORT_MS,
  afterAdClosed,
  adInputMuteMs,
  adOverlaySettleMs,
  isFalseAdForeground,
  isLongBackground,
  shouldAbortAdOverlay,
  shouldPauseForBackground,
  shouldFollowupRestoreCanvas,
  shouldRestoreCanvasSurface,
  shouldResumeBgm,
} from '../../src/core/utils/adForeground';

describe('adForeground 边界与状态', () => {
  it('hiddenMs 边界：349 不算久离，350 算久离；非法值不算', () => {
    assert.equal(isLongBackground(AD_FALSE_SHOW_MS - 1), false);
    assert.equal(isLongBackground(AD_FALSE_SHOW_MS), true);
    assert.equal(isLongBackground(0), false);
    assert.equal(isLongBackground(-1), false);
    assert.equal(isLongBackground(Number.NaN), false);
  });

  it('广告误报 onShow：忽略暂停且未真正 hide 且离开短', () => {
    assert.equal(
      isFalseAdForeground({
        ignoreBackgroundPause: true,
        wasHidden: false,
        hiddenMs: 120,
      }),
      true,
    );
    assert.equal(
      isFalseAdForeground({
        ignoreBackgroundPause: true,
        wasHidden: true,
        hiddenMs: 120,
      }),
      false,
    );
    assert.equal(
      isFalseAdForeground({
        ignoreBackgroundPause: true,
        wasHidden: false,
        hiddenMs: 2000,
      }),
      false,
    );
    assert.equal(
      isFalseAdForeground({
        ignoreBackgroundPause: false,
        wasHidden: false,
        hiddenMs: 120,
      }),
      false,
    );
  });

  it('pause：模拟器 / 已隐藏 / 广告层都不停循环', () => {
    assert.equal(
      shouldPauseForBackground({
        desktopIde: true,
        alreadyHidden: false,
        ignoreBackgroundPause: false,
      }),
      false,
    );
    assert.equal(
      shouldPauseForBackground({
        desktopIde: false,
        alreadyHidden: true,
        ignoreBackgroundPause: false,
      }),
      false,
    );
    assert.equal(
      shouldPauseForBackground({
        desktopIde: false,
        alreadyHidden: false,
        ignoreBackgroundPause: true,
      }),
      false,
    );
    assert.equal(
      shouldPauseForBackground({
        desktopIde: false,
        alreadyHidden: false,
        ignoreBackgroundPause: false,
      }),
      true,
    );
  });

  it('关广告：模拟器不重建画布，真机重建；始终踢循环保持可玩', () => {
    const ide = afterAdClosed(true);
    assert.equal(ide.restoreCanvas, false);
    assert.equal(ide.settleMs, 50);
    assert.equal(ide.muteMs, 160);
    assert.equal(ide.kickLoop, true);
    assert.equal(ide.keepPlayable, true);
    const phone = afterAdClosed(false);
    assert.equal(phone.restoreCanvas, true);
    assert.equal(phone.settleMs, 480);
    assert.equal(phone.muteMs, 800);
    assert.equal(phone.kickLoop, true);
    assert.equal(
      shouldRestoreCanvasSurface({ desktopIde: true, forceSurface: true }),
      false,
    );
    assert.equal(
      shouldRestoreCanvasSurface({ desktopIde: false, forceSurface: false }),
      false,
    );
    assert.equal(adOverlaySettleMs(true), 50);
    assert.equal(adInputMuteMs(false), 800);
    assert.equal(shouldFollowupRestoreCanvas(750, 750), false);
    assert.equal(shouldFollowupRestoreCanvas(0, 750), true);
    assert.equal(shouldFollowupRestoreCanvas(750, 0), true);
    assert.equal(shouldFollowupRestoreCanvas(Number.NaN, 750), true);
    assert.equal(shouldFollowupRestoreCanvas(750, Number.NaN), true);
    assert.equal(shouldAbortAdOverlay(-1), false);
    assert.equal(shouldAbortAdOverlay(AD_OVERLAY_ABORT_MS - 1), true);
    assert.equal(shouldAbortAdOverlay(AD_OVERLAY_ABORT_MS), false);
    assert.equal(shouldAbortAdOverlay(Number.NaN), false);
    assert.equal(shouldAbortAdOverlay(0), true);
    assert.equal(shouldAbortAdOverlay(AD_OVERLAY_ABORT_MS - 1), true);
    assert.equal(shouldAbortAdOverlay(AD_OVERLAY_ABORT_MS), false);
    assert.equal(shouldAbortAdOverlay(-1), false);
    assert.equal(shouldAbortAdOverlay(Number.NaN), false);
    assert.equal(shouldAbortAdOverlay(Number.POSITIVE_INFINITY), false);
  });

  it('BGM：未启动或静音不续；真切后台或久离才续', () => {
    assert.equal(
      shouldResumeBgm({
        bgmStarted: false,
        muted: false,
        wasHidden: true,
        longAway: true,
      }),
      false,
    );
    assert.equal(
      shouldResumeBgm({
        bgmStarted: true,
        muted: true,
        wasHidden: true,
        longAway: false,
      }),
      false,
    );
    assert.equal(
      shouldResumeBgm({
        bgmStarted: true,
        muted: false,
        wasHidden: false,
        longAway: false,
      }),
      false,
    );
    assert.equal(
      shouldResumeBgm({
        bgmStarted: true,
        muted: false,
        wasHidden: false,
        longAway: true,
      }),
      true,
    );
  });
});

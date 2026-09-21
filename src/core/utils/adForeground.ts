/**
 * 广告弹层 / 切后台：决定要不要停渲染、重设画布、禁点击、续 BGM。
 * 纯函数，方便把「看广告 / 关广告 / App 切回」的分支测到 100%。
 */

/** 短于此时长的 onHide/onShow 视为广告误报，不是真切到别的 App */
export const AD_FALSE_SHOW_MS = 350;

export function isLongBackground(hiddenMs: number): boolean {
  if (!Number.isFinite(hiddenMs) || hiddenMs < 0) {
    return false;
  }
  return hiddenMs >= AD_FALSE_SHOW_MS;
}

/**
 * 广告刚弹出时微信会连打 onHide+onShow。
 * 真切到别的 App：要么已经 pause 过，要么离开超过 AD_FALSE_SHOW_MS。
 */
export function isFalseAdForeground(args: {
  ignoreBackgroundPause: boolean;
  wasHidden: boolean;
  hiddenMs: number;
}): boolean {
  return (
    args.ignoreBackgroundPause &&
    !args.wasHidden &&
    !isLongBackground(args.hiddenMs)
  );
}

/** 开发者工具不要 pause：onHide 会把模拟器画布停死。 */
export function shouldPauseForBackground(args: {
  desktopIde: boolean;
  alreadyHidden: boolean;
  ignoreBackgroundPause: boolean;
}): boolean {
  if (args.desktopIde || args.alreadyHidden || args.ignoreBackgroundPause) {
    return false;
  }
  return true;
}

/** 开发者工具重设 canvas.width 会卡死；真机切后台才需要重建缓冲。 */
export function shouldRestoreCanvasSurface(args: {
  desktopIde: boolean;
  forceSurface: boolean;
}): boolean {
  if (args.desktopIde || !args.forceSurface) {
    return false;
  }
  return true;
}

export function adOverlaySettleMs(desktopIde: boolean): number {
  return desktopIde ? 50 : 480;
}

/** 原生层没起来就结束：立刻恢复，别走 480ms 画布重建。 */
export const AD_OVERLAY_ABORT_MS = 80;

export function shouldAbortAdOverlay(elapsedMs: number): boolean {
  return Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < AD_OVERLAY_ABORT_MS;
}

export function adInputMuteMs(desktopIde: boolean): number {
  return desktopIde ? 160 : 800;
}

export function shouldResumeBgm(args: {
  bgmStarted: boolean;
  muted: boolean;
  wasHidden: boolean;
  longAway: boolean;
}): boolean {
  return args.bgmStarted && !args.muted && (args.wasHidden || args.longAway);
}

/**
 * 关广告 / 切回前台后，只有尺寸对不上才二次重建画布。
 * 连续 canvas.width 赋值会卡死关卡。
 */
export function shouldFollowupRestoreCanvas(
  canvasWidth: number,
  expectedWidth: number,
): boolean {
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(expectedWidth)) {
    return true;
  }
  if (expectedWidth < 1) {
    return true;
  }
  return canvasWidth !== expectedWidth;
}

/** 关广告后关卡必须仍可操作：未静音则续 BGM，始终踢渲染、短禁穿透点击。 */
export function afterAdClosed(desktopIde: boolean): {
  restoreCanvas: boolean;
  settleMs: number;
  muteMs: number;
  kickLoop: boolean;
  keepPlayable: boolean;
} {
  return {
    restoreCanvas: shouldRestoreCanvasSurface({
      desktopIde,
      forceSurface: true,
    }),
    settleMs: adOverlaySettleMs(desktopIde),
    muteMs: adInputMuteMs(desktopIde),
    kickLoop: true,
    keepPlayable: true,
  };
}

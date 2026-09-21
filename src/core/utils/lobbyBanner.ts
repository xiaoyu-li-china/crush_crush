/**
 * 大厅原生模板横幅（20:7 卡片）的屏幕坐标。
 * 微信 CustomAd 用窗口逻辑像素，和画布 CSS 尺寸一致。
 */
export const LOBBY_BANNER_ASPECT = 7 / 20;
export const LOBBY_BANNER_SIDE_MARGIN = 8;
export const LOBBY_BANNER_MIN_BOTTOM = 4;

export interface LobbyBannerStyle {
  left: number;
  top: number;
  width: number;
  height: number;
}

function finitePx(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.round(value));
}

/**
 * 微信 insertTextView 要求 left/top 必须是 Number；NaN / Infinity 会刷红。
 */
export function toNativeViewStyle(box: {
  left: number;
  top: number;
  width: number;
  height: number;
}): LobbyBannerStyle | null {
  const left = Math.round(box.left);
  const top = Math.round(box.top);
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  if (![left, top, width, height].every((n) => Number.isFinite(n))) {
    return null;
  }
  if (width < 1 || height < 1 || left < 0 || top < 0) {
    return null;
  }
  return { left, top, width, height };
}

/**
 * 贴在窗口底部的 20:7 横幅。
 * @param windowWidth - 窗口宽
 * @param windowHeight - 窗口高
 * @param safeBottom - Home Indicator 等底部安全区
 */
export function layoutLobbyBannerStyle(
  windowWidth: number,
  windowHeight: number,
  safeBottom = 0,
): LobbyBannerStyle {
  const winW = finitePx(windowWidth, 375);
  const winH = finitePx(windowHeight, 667);
  const safe = finitePx(safeBottom, 0);
  const left = LOBBY_BANNER_SIDE_MARGIN;
  const width = Math.max(1, winW - LOBBY_BANNER_SIDE_MARGIN * 2);
  const height = Math.max(1, Math.round(width * LOBBY_BANNER_ASPECT));
  const bottomGap = Math.max(LOBBY_BANNER_MIN_BOTTOM, safe);
  const top = Math.max(0, winH - height - bottomGap);
  return { left, top, width, height };
}

/**
 * 大厅底部要抬高的像素（横幅高度 + 底边距）。
 */
export function lobbyBannerReserveHeight(
  windowWidth: number,
  windowHeight: number,
  safeBottom = 0,
): number {
  const style = layoutLobbyBannerStyle(windowWidth, windowHeight, safeBottom);
  return Math.max(0, finitePx(windowHeight, 667) - style.top);
}

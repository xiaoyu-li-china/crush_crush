/**
 * 大厅底部导航：设置 / 推荐 / 圈子。
 * 「玩法」放进设置页。热区要比绘制更大，并避开 Home 条。
 */

export const LOBBY_NAV_CHIP_H = 36;
export const LOBBY_NAV_CHIP_MIN_W = 68;
export const LOBBY_NAV_HIT_PAD = 16;

export function lobbyNavBottomGap(bannerReserve: number, safeBottom: number): number {
  const banner = Math.max(0, bannerReserve);
  const safe = Math.max(0, safeBottom);
  if (banner > 0) {
    return 12 + banner;
  }
  return Math.max(24, safe + 14);
}

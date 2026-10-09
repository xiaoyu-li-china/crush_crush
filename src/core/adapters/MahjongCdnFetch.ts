import type { MahjongThemeJsonFetcher } from '../../logic/mahjong/MahjongThemeCatalog';

/** 微信小游戏拉 CDN 上的麻将主题 manifest（JSON）。 */
export function createWxMahjongManifestFetcher(): MahjongThemeJsonFetcher {
  return (url: string) =>
    new Promise((resolve, reject) => {
      if (typeof wx === 'undefined' || typeof wx.request !== 'function') {
        reject(new Error('wx.request unavailable'));
        return;
      }
      wx.request({
        url,
        method: 'GET',
        success: (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          resolve(res.data);
        },
        fail: (err) => reject(err),
      });
    });
}

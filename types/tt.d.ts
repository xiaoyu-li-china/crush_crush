/**
 * 抖音 / 字节小游戏 API 最小类型声明（与 wx 大量同名，运行时通过 shim 挂到 wx）。
 */

interface TtSystemInfo {
  brand: string;
  model: string;
  pixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  language: string;
  version: string;
  system: string;
  platform: string;
  SDKVersion: string;
  statusBarHeight?: number;
  benchmarkLevel?: number;
  safeArea?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
}

interface TtMenuButtonRect {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

declare const tt: {
  getSystemInfoSync?: () => TtSystemInfo;
  getLaunchOptionsSync?: () => { query?: Record<string, unknown> };
  getEnterOptionsSync?: () => { query?: Record<string, unknown> };
  getMenuButtonBoundingClientRect?: () => TtMenuButtonRect;
  createCanvas?: () => WxCanvas;
  nextTick?: (cb: () => void) => void;
  onShow?: (cb: () => void) => void;
  onHide?: (cb: () => void) => void;
  offShow?: (cb: () => void) => void;
  offHide?: (cb: () => void) => void;
  createRewardedVideoAd?: (opts: { adUnitId: string }) => WxRewardedVideoAd;
  createInterstitialAd?: (opts: { adUnitId: string }) => WxInterstitialAd;
  createBannerAd?: (opts: {
    adUnitId: string;
    style: { left: number; top: number; width: number; height?: number };
  }) => WxCustomAd;
  createInnerAudioContext?: typeof wx.createInnerAudioContext extends (...args: infer A) => infer R
    ? (...args: A) => R
    : never;
  setInnerAudioOption?: Wx['setInnerAudioOption'];
  request?: Wx['request'];
  getStorage?: Wx['getStorage'];
  setStorage?: Wx['setStorage'];
  removeStorage?: Wx['removeStorage'];
  clearStorage?: Wx['clearStorage'];
  getStorageSync?: (key: string) => unknown;
  setStorageSync?: (key: string, data: unknown) => void;
  removeStorageSync?: (key: string) => void;
  clearStorageSync?: () => void;
  removeStorageSync?: (key: string) => void;
  clearStorageSync?: () => void;
  reportAnalytics?: (event: string, data?: Record<string, unknown>) => void;
  reportEvent?: (event: string, data?: Record<string, unknown>) => void;
  showShareMenu?: (opts?: { withShareTicket?: boolean }) => void;
  onShareAppMessage?: (cb: () => SharePayload) => void;
  shareAppMessage?: (opts: SharePayload) => void;
  onTouchStart?: Wx['onTouchStart'];
  onTouchMove?: Wx['onTouchMove'];
  onTouchEnd?: Wx['onTouchEnd'];
  onTouchCancel?: Wx['onTouchCancel'];
  offTouchStart?: Wx['offTouchStart'];
  offTouchMove?: Wx['offTouchMove'];
  offTouchEnd?: Wx['offTouchEnd'];
  offTouchCancel?: Wx['offTouchCancel'];
  setPreferredFramesPerSecond?: (fps: number) => void;
  hideToast?: () => void;
  getAccountInfoSync?: () => { miniProgram?: { envVersion?: string } };
  getEnvInfoSync?: () => { microapp?: { envType?: string } };
  createImage?: () => WxImage;
  createUserInfoButton?: Wx['createUserInfoButton'];
  vibrateShort?: Wx['vibrateShort'];
  vibrateLong?: Wx['vibrateLong'];
  [key: string]: unknown;
};

interface SharePayload {
  title: string;
  imageUrl?: string;
  query?: string;
}

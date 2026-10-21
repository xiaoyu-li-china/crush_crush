/**
 * 抖音小游戏运行时提供 `tt`，与微信 `wx` 大量 API 同名。
 * 在入口最前安装 shim，复用现有 Wx* 适配器与 Canvas 表现层。
 */

import { markMiniGameHost } from '../core/utils/miniGameHost';

type TtLike = typeof tt;

function fallbackMenuButtonRect(): TtMenuButtonRect {
  let windowWidth = 375;
  let statusBarHeight = 20;
  try {
    if (typeof tt !== 'undefined' && typeof tt.getSystemInfoSync === 'function') {
      const info = tt.getSystemInfoSync();
      windowWidth = info.windowWidth || info.screenWidth || windowWidth;
      statusBarHeight = info.statusBarHeight ?? statusBarHeight;
    }
  } catch {
    // ignore
  }
  const width = 87;
  const height = 32;
  const top = statusBarHeight + 4;
  const right = windowWidth - 7;
  return {
    width,
    height,
    top,
    right,
    bottom: top + height,
    left: right - width,
  };
}

function wrapCreateCustomAdFromBanner(ttApi: TtLike): void {
  if (typeof ttApi.createBannerAd !== 'function') {
    return;
  }
  const createBannerAd = ttApi.createBannerAd.bind(ttApi);
  (ttApi as unknown as { createCustomAd?: typeof wx.createCustomAd }).createCustomAd = (opts) => {
    const style = opts.style;
    return createBannerAd({
      adUnitId: opts.adUnitId,
      style: {
        left: style.left,
        top: style.top,
        width: style.width ?? 300,
        height: style.height,
      },
    });
  };
}

function patchReportEvent(ttApi: TtLike): void {
  if (typeof (ttApi as { reportEvent?: unknown }).reportEvent === 'function') {
    return;
  }
  if (typeof ttApi.reportAnalytics === 'function') {
    (ttApi as { reportEvent: typeof wx.reportEvent }).reportEvent = (event, data) => {
      ttApi.reportAnalytics?.(event, data ?? {});
    };
  }
}

function patchMenuButton(ttApi: TtLike): void {
  if (typeof ttApi.getMenuButtonBoundingClientRect === 'function') {
    return;
  }
  ttApi.getMenuButtonBoundingClientRect = fallbackMenuButtonRect;
}

function patchCreateImage(ttApi: TtLike): void {
  if (typeof ttApi.createImage === 'function') {
    return;
  }
  (ttApi as { createImage?: () => WxImage }).createImage = () => {
    const canvas = ttApi.createCanvas?.();
    if (canvas) {
      return canvas as unknown as WxImage;
    }
    throw new Error('tt.createImage unavailable');
  };
}

/** 让 readMiniProgramEnvVersion 能读到 develop / trial / release */
function patchAccountInfo(ttApi: TtLike): void {
  if (typeof ttApi.getAccountInfoSync === 'function') {
    return;
  }
  ttApi.getAccountInfoSync = () => {
    let envVersion: 'develop' | 'trial' | 'release' = 'release';
    try {
      const envType = (
        ttApi.getEnvInfoSync?.() as { microapp?: { envType?: string } } | undefined
      )?.microapp?.envType;
      if (envType === 'development' || envType === 'develop') {
        envVersion = 'develop';
      } else if (envType === 'preview' || envType === 'trial') {
        envVersion = 'trial';
      }
    } catch {
      // ignore
    }
    return { miniProgram: { envVersion } };
  };
}

function patchStorageFromSync(ttApi: TtLike): void {
  const getSync = ttApi.getStorageSync?.bind(ttApi);
  const setSync = ttApi.setStorageSync?.bind(ttApi);
  const removeSync = ttApi.removeStorageSync?.bind(ttApi);
  const clearSync = ttApi.clearStorageSync?.bind(ttApi);
  if (!getSync) {
    return;
  }
  if (typeof ttApi.getStorage !== 'function') {
    ttApi.getStorage = (opts) => {
      try {
        const data = getSync(opts.key);
        opts.success?.({ data, errMsg: 'getStorage:ok' });
      } catch {
        opts.fail?.({ errMsg: 'getStorage:fail data not found' });
      }
      opts.complete?.();
    };
  }
  if (setSync && typeof ttApi.setStorage !== 'function') {
    ttApi.setStorage = (opts) => {
      try {
        setSync(opts.key, opts.data);
        opts.success?.({ errMsg: 'setStorage:ok' });
      } catch (err) {
        opts.fail?.({ errMsg: String(err) });
      }
      opts.complete?.();
    };
  }
  if (removeSync && typeof ttApi.removeStorage !== 'function') {
    ttApi.removeStorage = (opts) => {
      try {
        removeSync(opts.key);
        opts.success?.({ errMsg: 'removeStorage:ok' });
      } catch {
        opts.fail?.({ errMsg: 'removeStorage:fail' });
      }
      opts.complete?.();
    };
  }
  if (clearSync && typeof ttApi.clearStorage !== 'function') {
    ttApi.clearStorage = (opts) => {
      try {
        clearSync();
        opts.success?.({ errMsg: 'clearStorage:ok' });
      } catch (err) {
        opts.fail?.({ errMsg: String(err) });
      }
      opts.complete?.();
    };
  }
}

function patchShowShareMenu(ttApi: TtLike): void {
  if (typeof ttApi.showShareMenu !== 'function') {
    return;
  }
  const raw = ttApi.showShareMenu.bind(ttApi);
  ttApi.showShareMenu = (opts?: { withShareTicket?: boolean; menus?: string[] }) => {
    try {
      raw({ withShareTicket: opts?.withShareTicket });
    } catch {
      raw();
    }
  };
}

/**
 * 将 tt 映射为全局 wx（仅当 wx 不存在时）。必须在其它模块读 wx 之前调用。
 */
export function installTtWxShim(): boolean {
  if (typeof tt === 'undefined') {
    return false;
  }
  const g = globalThis as { wx?: typeof wx; __CRUSH_HOST__?: string };
  if (typeof g.wx !== 'undefined') {
    return true;
  }
  patchMenuButton(tt);
  patchStorageFromSync(tt);
  patchCreateImage(tt);
  patchAccountInfo(tt);
  wrapCreateCustomAdFromBanner(tt);
  patchReportEvent(tt);
  patchShowShareMenu(tt);
  g.wx = tt as unknown as typeof wx;
  markMiniGameHost('douyin');
  return true;
}

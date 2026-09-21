/**
 * 微信运行环境：开发者工具 / 桌面 vs 手机客户端。
 * 广告弹层会误报 onHide；开发者工具里不要因此停画布。
 * 原生广告只在手机微信创建，模拟器会刷 insertTextView parent not found。
 */

const FALLBACK_WX_INFO: WxSystemInfo = {
  brand: '',
  model: '',
  pixelRatio: 2,
  screenWidth: 375,
  screenHeight: 667,
  windowWidth: 375,
  windowHeight: 667,
  language: 'zh',
  version: '',
  system: '',
  platform: '',
  SDKVersion: '',
};

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function tryWxCall<T>(fn: (() => T) | undefined): T | null {
  if (typeof fn !== 'function') {
    return null;
  }
  try {
    return fn();
  } catch {
    return null;
  }
}

/**
 * 读窗口/机型。优先 getWindowInfo + getDeviceInfo，避开 getSystemInfo 的
 * deviceOrientation（真机调试 jsbridge 未就绪会抛错）。失败用兜底尺寸，不抛。
 */
export function readWxSystemInfo(): WxSystemInfo {
  try {
    if (typeof wx === 'undefined') {
      return { ...FALLBACK_WX_INFO };
    }
    const windowInfo = tryWxCall(wx.getWindowInfo);
    const deviceInfo = tryWxCall(wx.getDeviceInfo);
    const appBase = tryWxCall(wx.getAppBaseInfo);
    if (windowInfo || deviceInfo || appBase) {
      return {
        brand: String(deviceInfo?.brand || ''),
        model: String(deviceInfo?.model || ''),
        pixelRatio: finiteOr(windowInfo?.pixelRatio, 2),
        screenWidth: finiteOr(windowInfo?.screenWidth, 375),
        screenHeight: finiteOr(windowInfo?.screenHeight, 667),
        windowWidth: finiteOr(windowInfo?.windowWidth, 375),
        windowHeight: finiteOr(windowInfo?.windowHeight, 667),
        language: String(appBase?.language || 'zh'),
        version: String(appBase?.version || ''),
        system: String(deviceInfo?.system || ''),
        platform: String(deviceInfo?.platform || ''),
        SDKVersion: String(appBase?.SDKVersion || ''),
        statusBarHeight: windowInfo?.statusBarHeight,
        benchmarkLevel: deviceInfo?.benchmarkLevel,
        safeArea: windowInfo?.safeArea,
      };
    }
    const sync = tryWxCall(wx.getSystemInfoSync);
    if (!sync) {
      return { ...FALLBACK_WX_INFO };
    }
    return {
      brand: String(sync.brand || ''),
      model: String(sync.model || ''),
      pixelRatio: finiteOr(sync.pixelRatio, 2),
      screenWidth: finiteOr(sync.screenWidth, 375),
      screenHeight: finiteOr(sync.screenHeight, 667),
      windowWidth: finiteOr(sync.windowWidth, 375),
      windowHeight: finiteOr(sync.windowHeight, 667),
      language: String(sync.language || 'zh'),
      version: String(sync.version || ''),
      system: String(sync.system || ''),
      platform: String(sync.platform || ''),
      SDKVersion: String(sync.SDKVersion || ''),
      statusBarHeight: sync.statusBarHeight,
      benchmarkLevel: sync.benchmarkLevel,
      safeArea: sync.safeArea,
    };
  } catch {
    return { ...FALLBACK_WX_INFO };
  }
}

function readWxInfo(): WxSystemInfo | null {
  try {
    if (typeof wx === 'undefined') {
      return null;
    }
    const info = readWxSystemInfo();
    if (!info.platform && !info.brand && !info.model) {
      return null;
    }
    return info;
  } catch {
    return null;
  }
}

function platformOf(info: WxSystemInfo | null): string {
  return String(info?.platform || '').toLowerCase();
}

/** Mac / Windows 桌面微信客户端。 */
export function isWxDesktopClient(): boolean {
  const platform = platformOf(readWxInfo());
  return platform === 'mac' || platform === 'windows';
}

/**
 * 微信开发者工具（含模拟成 iPhone 时 platform=ios）。
 * 不要用 benchmarkLevel === -1 判断：正式包 iPhone 经常是 -1，会把全部广告禁掉。
 */
export function isWxDevtoolsHost(): boolean {
  const info = readWxInfo();
  const platform = platformOf(info);
  if (platform === 'devtools') {
    return true;
  }
  const brand = String(info?.brand || '').toLowerCase();
  const model = String(info?.model || '').toLowerCase();
  if (brand.includes('devtools') || model.includes('devtools')) {
    return true;
  }
  try {
    const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
    if (nav?.userAgent && /devtools|wechatdevtools/i.test(nav.userAgent)) {
      return true;
    }
  } catch {
    // ignore
  }
  const g = globalThis as { __wxConfig?: { platform?: string } };
  return String(g.__wxConfig?.platform || '').toLowerCase() === 'devtools';
}

/**
 * 是否在微信开发者工具或桌面端。
 */
export function isWxDesktopIdeHost(): boolean {
  return isWxDevtoolsHost() || isWxDesktopClient();
}

export type WxMiniProgramEnvVersion = 'develop' | 'trial' | 'release';

/** 微信小游戏版本：开发版 / 体验版 / 正式版。读不到则 null。 */
export function readWxMiniProgramEnvVersion(): WxMiniProgramEnvVersion | null {
  try {
    if (typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function') {
      return null;
    }
    const env = wx.getAccountInfoSync()?.miniProgram?.envVersion;
    if (env === 'develop' || env === 'trial' || env === 'release') {
      return env;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 开发版、体验版开放全部关卡便于看效果；审核通过后的正式版按进度锁定。
 * 开发者工具若读不到 envVersion，也按预览开放。
 */
export function shouldUnlockAllLevelsForPreview(): boolean {
  const env = readWxMiniProgramEnvVersion();
  if (env === 'release') {
    return false;
  }
  if (env === 'develop' || env === 'trial') {
    return true;
  }
  return isWxDevtoolsHost();
}

/**
 * 上屏主画布：运行时若已有 GameGlobal.canvas，再 createCanvas 会画到离屏导致黑屏。
 */
export function resolveWxMainCanvas(): WxCanvas {
  const g = globalThis as {
    canvas?: WxCanvas;
    GameGlobal?: { canvas?: WxCanvas };
  };
  const existing = g.GameGlobal?.canvas ?? g.canvas;
  if (existing && typeof existing.getContext === 'function') {
    return existing;
  }
  return wx.createCanvas();
}

/**
 * 真机平台判断。纯字符串，方便单测。
 */
export function isWxCustomAdHostSupported(platform: string): boolean {
  const value = platform.toLowerCase();
  return (
    value === 'ios' ||
    value === 'android' ||
    value === 'ohos' ||
    value === 'harmonyos'
  );
}

/**
 * 当前环境能不能创建激励 / 插屏 / 原生模板。
 * 开发者工具基础库会刷 insertTextView parent not found，全部改到真机创建。
 */
export function canCreateWxNativeAds(): boolean {
  if (isWxDevtoolsHost() || isWxDesktopClient()) {
    return false;
  }
  const info = readWxInfo();
  return isWxCustomAdHostSupported(info?.platform || '');
}

/** 激励视频 / 插屏与原生模板同一套宿主限制。 */
export function canCreateWxFullscreenAds(): boolean {
  return canCreateWxNativeAds();
}

/** 画布渲染档位：低端机降 DPR / 特效，空闲时停帧。 */
export interface WxRenderProfile {
  dpr: number;
  lite: boolean;
  cheapFx: boolean;
  frameDelayMs: number;
  useRaf: boolean;
  fps: number;
}

/**
 * 微信 benchmarkLevel：0 未知，数值越大越强；-1 常见于 iPhone，不当成低端机。
 * 低于 8 按低端机处理（少渐变、30 帧、停空闲绘制）。
 * 真机一律 30 帧 timeout：60fps 长时间挂机容易把微信拖死重启。
 * 开发者工具保持 2 倍分辨率和完整萌宠绘制，避免小动物发糊；
 * 空闲停帧、启动不播音乐/不拉云，减轻模拟器负担。
 */
export function isLowEndWxDevice(info: {
  benchmarkLevel?: number;
} | null | undefined): boolean {
  const level = info?.benchmarkLevel;
  if (typeof level !== 'number' || level < 0) {
    return false;
  }
  return level < 8;
}

export function resolveWxRenderProfile(
  info: { benchmarkLevel?: number; pixelRatio?: number } | null | undefined,
  desktopIde: boolean,
): WxRenderProfile {
  if (desktopIde) {
    return {
      dpr: Math.min(2, Math.max(2, info?.pixelRatio || 2)),
      lite: true,
      cheapFx: false,
      frameDelayMs: 50,
      useRaf: false,
      fps: 20,
    };
  }
  if (isLowEndWxDevice(info)) {
    return {
      dpr: 1,
      lite: true,
      cheapFx: true,
      frameDelayMs: 33,
      useRaf: false,
      fps: 30,
    };
  }
  const pr = Math.max(1, info?.pixelRatio || 1);
  return {
    dpr: Math.min(2, pr),
    lite: false,
    cheapFx: false,
    frameDelayMs: 33,
    useRaf: false,
    fps: 30,
  };
}

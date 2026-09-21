/**
 * 微信宿主检测：开发者工具 / 桌面微信不创建原生广告。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canCreateWxFullscreenAds,
  canCreateWxNativeAds,
  isLowEndWxDevice,
  isWxCustomAdHostSupported,
  isWxDesktopIdeHost,
  readWxSystemInfo,
  resolveWxMainCanvas,
  resolveWxRenderProfile,
  shouldUnlockAllLevelsForPreview,
} from '../../src/core/utils/wxHost';

describe('wxHost', () => {
  it('优先拆分接口读机型，getSystemInfo 失败时用兜底不抛', () => {
    const prev = (globalThis as { wx?: Wx }).wx;
    try {
      (globalThis as { wx: Wx }).wx = {
        getWindowInfo: () => ({
          pixelRatio: 3,
          screenWidth: 390,
          screenHeight: 844,
          windowWidth: 390,
          windowHeight: 844,
          statusBarHeight: 47,
        }),
        getDeviceInfo: () => ({
          brand: 'HUAWEI',
          model: 'GLA-AL00',
          system: 'Android 12',
          platform: 'android',
          benchmarkLevel: 18,
        }),
        getAppBaseInfo: () => ({
          language: 'zh',
          version: '8.0.70',
          SDKVersion: '3.17.3',
        }),
        getSystemInfoSync: () => {
          throw new Error('jsbridge not ready');
        },
      } as Wx;
      const split = readWxSystemInfo();
      assert.equal(split.platform, 'android');
      assert.equal(split.windowWidth, 390);
      assert.equal(split.benchmarkLevel, 18);

      (globalThis as { wx: Wx }).wx = {
        getSystemInfoSync: () => {
          throw new Error('jsbridge not ready');
        },
      } as Wx;
      const fallback = readWxSystemInfo();
      assert.equal(fallback.windowWidth, 375);
      assert.equal(fallback.platform, '');
    } finally {
      if (prev) {
        (globalThis as { wx: Wx }).wx = prev;
      } else {
        delete (globalThis as { wx?: Wx }).wx;
      }
    }
  });

  it('真机平台字符串：iOS/Android 支持，devtools/windows 不算真机', () => {
    assert.equal(isWxCustomAdHostSupported('ios'), true);
    assert.equal(isWxCustomAdHostSupported('android'), true);
    assert.equal(isWxCustomAdHostSupported('devtools'), false);
    assert.equal(isWxCustomAdHostSupported('windows'), false);
  });

  it('没有 wx 时不当成开发者工具', () => {
    const prev = (globalThis as { wx?: Wx }).wx;
    delete (globalThis as { wx?: Wx }).wx;
    try {
      assert.equal(isWxDesktopIdeHost(), false);
      assert.equal(canCreateWxNativeAds(), false);
    } finally {
      if (prev) {
        (globalThis as { wx: Wx }).wx = prev;
      }
    }
  });

  it('iPhone 正式包 benchmarkLevel 为 -1 时仍创建广告', () => {
    const prev = (globalThis as { wx?: Wx }).wx;
    (globalThis as { wx: Wx }).wx = {
      getSystemInfoSync: () =>
        ({
          brand: 'iPhone',
          model: 'iPhone 14',
          pixelRatio: 2,
          screenWidth: 375,
          screenHeight: 667,
          windowWidth: 375,
          windowHeight: 667,
          language: 'zh',
          version: '1',
          system: 'iOS',
          platform: 'ios',
          SDKVersion: '3.17.0',
          benchmarkLevel: -1,
        }) as WxSystemInfo,
    } as Wx;
    try {
      assert.equal(isWxDesktopIdeHost(), false);
      assert.equal(canCreateWxNativeAds(), true);
      assert.equal(canCreateWxFullscreenAds(), true);
    } finally {
      if (prev) {
        (globalThis as { wx: Wx }).wx = prev;
      } else {
        delete (globalThis as { wx?: Wx }).wx;
      }
    }
  });

  it('Mac 桌面微信不创建原生广告', () => {
    const prev = (globalThis as { wx?: Wx }).wx;
    (globalThis as { wx: Wx }).wx = {
      getSystemInfoSync: () =>
        ({
          brand: 'Mac',
          model: 'Mac',
          pixelRatio: 2,
          screenWidth: 1280,
          screenHeight: 800,
          windowWidth: 1280,
          windowHeight: 800,
          language: 'zh',
          version: '1',
          system: 'macOS',
          platform: 'mac',
          SDKVersion: '3.17.0',
        }) as WxSystemInfo,
    } as Wx;
    try {
      assert.equal(isWxDesktopIdeHost(), true);
      assert.equal(canCreateWxNativeAds(), false);
      assert.equal(canCreateWxFullscreenAds(), false);
    } finally {
      if (prev) {
        (globalThis as { wx: Wx }).wx = prev;
      } else {
        delete (globalThis as { wx?: Wx }).wx;
      }
    }
  });

  it('benchmarkLevel 低于 8 视为低端机，开发者工具单独降档', () => {
    assert.equal(isLowEndWxDevice({ benchmarkLevel: 3 }), true);
    assert.equal(isLowEndWxDevice({ benchmarkLevel: 0 }), true);
    assert.equal(isLowEndWxDevice({ benchmarkLevel: 16 }), false);
    assert.equal(isLowEndWxDevice({ benchmarkLevel: -1 }), false);
    const low = resolveWxRenderProfile({ benchmarkLevel: 4, pixelRatio: 3 }, false);
    assert.equal(low.dpr, 1);
    assert.equal(low.cheapFx, true);
    assert.equal(low.useRaf, false);
    const high = resolveWxRenderProfile({ benchmarkLevel: 24, pixelRatio: 3 }, false);
    assert.equal(high.dpr, 2);
    assert.equal(high.useRaf, false);
    assert.equal(high.fps, 30);
    assert.equal(high.frameDelayMs, 33);
    const ide = resolveWxRenderProfile({ benchmarkLevel: -1, pixelRatio: 2 }, true);
    assert.equal(ide.dpr, 2);
    assert.equal(ide.frameDelayMs, 50);
    assert.equal(ide.lite, true);
    assert.equal(ide.cheapFx, false);
    assert.equal(ide.useRaf, false);
  });

  it('ohos 支持原生广告；已有 GameGlobal.canvas 不再 createCanvas', () => {
    assert.equal(isWxCustomAdHostSupported('ohos'), true);
    assert.equal(isWxCustomAdHostSupported('harmonyos'), true);
    const prevWx = (globalThis as { wx?: Wx }).wx;
    const prevCanvas = (globalThis as { canvas?: WxCanvas }).canvas;
    const existing = { getContext: () => ({}) } as WxCanvas;
    (globalThis as { canvas?: WxCanvas }).canvas = existing;
    (globalThis as { wx: Wx }).wx = {
      getSystemInfoSync: () => {
        throw new Error('no info');
      },
      createCanvas: () => ({ getContext: () => ({}) }) as WxCanvas,
    } as Wx;
    try {
      assert.equal(isWxDesktopIdeHost(), false);
      assert.equal(resolveWxMainCanvas(), existing);
    } finally {
      if (prevWx) {
        (globalThis as { wx: Wx }).wx = prevWx;
      } else {
        delete (globalThis as { wx?: Wx }).wx;
      }
      if (prevCanvas) {
        (globalThis as { canvas: WxCanvas }).canvas = prevCanvas;
      } else {
        delete (globalThis as { canvas?: WxCanvas }).canvas;
      }
    }
  });

  it('brand/devtools、Windows、GameGlobal.canvas、无画布时 createCanvas', () => {
    const prevWx = (globalThis as { wx?: Wx }).wx;
    const g = globalThis as {
      canvas?: WxCanvas;
      GameGlobal?: { canvas?: WxCanvas };
      __wxConfig?: { platform?: string };
    };
    const prevCanvas = g.canvas;
    const prevGG = g.GameGlobal;
    const prevCfg = g.__wxConfig;
    const created = { getContext: () => ({}) } as WxCanvas;
    const fromGlobal = { getContext: () => ({}) } as WxCanvas;
    const info = (platform: string, extra?: Partial<WxSystemInfo>): WxSystemInfo =>
      ({
        brand: extra?.brand ?? 'x',
        model: extra?.model ?? 'x',
        pixelRatio: 2,
        screenWidth: 375,
        screenHeight: 667,
        windowWidth: 375,
        windowHeight: 667,
        language: 'zh',
        version: '1',
        system: extra?.system ?? 'x',
        platform,
        SDKVersion: '3.17.0',
        benchmarkLevel: extra?.benchmarkLevel,
      }) as WxSystemInfo;
    try {
      (globalThis as { wx: Wx }).wx = {
        getSystemInfoSync: () =>
          info('ios', { brand: 'devtools', model: 'devtools', benchmarkLevel: 20 }),
        createCanvas: () => created,
      } as Wx;
      assert.equal(isWxDesktopIdeHost(), true);
      assert.equal(canCreateWxNativeAds(), false);
      assert.equal(canCreateWxFullscreenAds(), false);

      (globalThis as { wx: Wx }).wx = {
        getSystemInfoSync: () => info('windows'),
        createCanvas: () => created,
      } as Wx;
      assert.equal(isWxDesktopIdeHost(), true);
      assert.equal(canCreateWxNativeAds(), false);

      (globalThis as { wx: Wx }).wx = {
        getSystemInfoSync: () => info('ios', { benchmarkLevel: 20 }),
        createCanvas: () => created,
      } as Wx;
      g.__wxConfig = { platform: 'devtools' };
      assert.equal(isWxDesktopIdeHost(), true);
      delete g.__wxConfig;

      (globalThis as { wx: Wx }).wx = {
        getSystemInfoSync: () => info('android', { benchmarkLevel: 24 }),
        createCanvas: () => created,
      } as Wx;
      assert.equal(isWxDesktopIdeHost(), false);
      assert.equal(canCreateWxNativeAds(), true);
      assert.equal(canCreateWxFullscreenAds(), true);
      assert.equal(isWxCustomAdHostSupported('IOS'), true);

      delete g.canvas;
      g.GameGlobal = { canvas: fromGlobal };
      assert.equal(resolveWxMainCanvas(), fromGlobal);
      delete g.GameGlobal;
      assert.equal(resolveWxMainCanvas(), created);
    } finally {
      if (prevWx) {
        (globalThis as { wx: Wx }).wx = prevWx;
      } else {
        delete (globalThis as { wx?: Wx }).wx;
      }
      if (prevCanvas) {
        g.canvas = prevCanvas;
      } else {
        delete g.canvas;
      }
      if (prevGG) {
        g.GameGlobal = prevGG;
      } else {
        delete g.GameGlobal;
      }
      if (prevCfg) {
        g.__wxConfig = prevCfg;
      } else {
        delete g.__wxConfig;
      }
    }
  });

  it('开发版/体验版开放全部关卡，正式版锁定', () => {
    const prevWx = (globalThis as { wx?: Wx }).wx;
    const g = globalThis as { __wxConfig?: { platform?: string } };
    const prevCfg = g.__wxConfig;
    const info = (): WxSystemInfo =>
      ({
        brand: 'iPhone',
        model: 'iPhone 14',
        pixelRatio: 2,
        screenWidth: 375,
        screenHeight: 667,
        windowWidth: 375,
        windowHeight: 667,
        language: 'zh',
        version: '1',
        system: 'iOS',
        platform: 'ios',
        SDKVersion: '3.17.0',
        benchmarkLevel: 16,
      }) as WxSystemInfo;
    try {
      delete g.__wxConfig;
      (globalThis as { wx: Wx }).wx = {
        getSystemInfoSync: info,
        getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
      } as Wx;
      assert.equal(shouldUnlockAllLevelsForPreview(), true);

      (globalThis as { wx: Wx }).wx = {
        getSystemInfoSync: info,
        getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }),
      } as Wx;
      assert.equal(shouldUnlockAllLevelsForPreview(), true);

      (globalThis as { wx: Wx }).wx = {
        getSystemInfoSync: info,
        getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
      } as Wx;
      assert.equal(shouldUnlockAllLevelsForPreview(), false);
    } finally {
      if (prevWx) {
        (globalThis as { wx: Wx }).wx = prevWx;
      } else {
        delete (globalThis as { wx?: Wx }).wx;
      }
      if (prevCfg) {
        g.__wxConfig = prevCfg;
      } else {
        delete g.__wxConfig;
      }
    }
  });
});

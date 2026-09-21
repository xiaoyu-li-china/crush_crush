/**
 * WxAdAdapter 单测：使用 mock wx 激励视频对象。
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import { isRewardedVideoCompleted } from '../../src/core/adapters/WxAdAdapter';

type CloseHandler = (res?: { isEnded?: boolean }) => void;

function createMockRewardedAd(): WxRewardedVideoAd & {
  triggerClose: (isEnded?: boolean) => void;
  triggerLoad: () => void;
  rejectShow?: boolean;
} {
  let loadHandler: (() => void) | undefined;
  let closeHandler: CloseHandler | undefined;
  const ad = {
    rejectShow: false,
    async load() {
      loadHandler?.();
    },
    async show() {
      if (ad.rejectShow) {
        throw new Error('show fail');
      }
    },
    destroy() {},
    onLoad(cb: () => void) {
      loadHandler = cb;
    },
    offLoad() {
      loadHandler = undefined;
    },
    onError() {},
    offError() {},
    onClose(cb: CloseHandler) {
      closeHandler = cb;
    },
    offClose() {
      closeHandler = undefined;
    },
    triggerClose(isEnded?: boolean) {
      if (isEnded === undefined) {
        closeHandler?.();
      } else {
        closeHandler?.({ isEnded });
      }
    },
    triggerLoad() {
      loadHandler?.();
    },
  };
  return ad;
}

describe('WxAdAdapter', () => {
  let mockAd: ReturnType<typeof createMockRewardedAd>;

  before(() => {
    mockAd = createMockRewardedAd();
    (globalThis as unknown as { wx: Wx }).wx = {
      createRewardedVideoAd: () => mockAd,
      createInterstitialAd: () =>
        ({
          async load() {},
          async show() {},
          destroy() {},
          onLoad() {},
          offLoad() {},
          onError() {},
          offError() {},
          onClose() {},
          offClose() {},
        }) as WxInterstitialAd,
      getStorage() {},
      setStorage() {},
      removeStorage() {},
      clearStorage() {},
      getStorageSync: () => null,
      setStorageSync() {},
      removeStorageSync() {},
      clearStorageSync() {},
      getSystemInfoSync: () =>
        ({
          brand: 'x',
          model: 'x',
          pixelRatio: 2,
          screenWidth: 375,
          screenHeight: 667,
          windowWidth: 375,
          windowHeight: 667,
          language: 'zh',
          version: '1',
          system: 'iOS',
          platform: 'ios',
          SDKVersion: '2.19.0',
        }) as WxSystemInfo,
      request() {},
      createInnerAudioContext: () =>
        ({
          src: '',
          autoplay: false,
          loop: false,
          volume: 1,
          play() {},
          pause() {},
          stop() {},
          destroy() {},
          onEnded() {},
          offEnded() {},
          onError() {},
          offError() {},
        }) as WxInnerAudioContext,
      onShow() {},
      onHide() {},
      offShow() {},
      offHide() {},
    };
  });

  beforeEach(() => {
    mockAd.rejectShow = false;
  });

  it('isRewardedVideoCompleted 在缺省回调时仍算看完', () => {
    assert.equal(isRewardedVideoCompleted(undefined), true);
    assert.equal(isRewardedVideoCompleted(null), true);
    assert.equal(isRewardedVideoCompleted({}), true);
    assert.equal(isRewardedVideoCompleted({ isEnded: true }), true);
    assert.equal(isRewardedVideoCompleted({ isEnded: false }), false);
    assert.equal(isRewardedVideoCompleted({ isEnded: false }, 13_999), false);
    assert.equal(isRewardedVideoCompleted({ isEnded: false }, 14_000), true);
  });

  it('load 后 isReady，show 看完返回 completed', async () => {
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
    });

    const loadPromise = adapter.load('rewarded_revive');
    mockAd.triggerLoad();
    await loadPromise;
    assert.equal(adapter.isReady('rewarded_revive'), true);

    const showPromise = adapter.show('rewarded_revive');
    mockAd.triggerClose(true);
    const result = await showPromise;
    assert.equal(result, 'completed');

    adapter.dispose();
  });

  it('中途关闭返回 skipped', async () => {
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
    });

    const loadPromise = adapter.load('rewarded_revive');
    mockAd.triggerLoad();
    await loadPromise;

    const showPromise = adapter.show('rewarded_revive');
    mockAd.triggerClose(false);
    assert.equal(await showPromise, 'skipped');
    adapter.dispose();
  });

  it('看满 15 秒后关闭即使 isEnded=false 也发奖', async () => {
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
    });
    const loadPromise = adapter.load('rewarded_revive');
    mockAd.triggerLoad();
    await loadPromise;
    const realNow = Date.now;
    let now = realNow();
    Date.now = () => now;
    try {
      const showPromise = adapter.show('rewarded_revive');
      now += 15_000;
      mockAd.triggerClose(false);
      assert.equal(await showPromise, 'completed');
    } finally {
      Date.now = realNow;
    }
    adapter.dispose();
  });

  it('关闭回调没有 isEnded 时仍发奖（15 秒激励常见）', async () => {
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
    });
    const loadPromise = adapter.load('rewarded_revive');
    mockAd.triggerLoad();
    await loadPromise;
    const showPromise = adapter.show('rewarded_revive');
    mockAd.triggerClose();
    assert.equal(await showPromise, 'completed');
    adapter.dispose();
  });

  it('show 误报 fail 仍等 onClose 发奖', async () => {
    mockAd.rejectShow = true;
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
    });
    const loadPromise = adapter.load('rewarded_revive');
    mockAd.triggerLoad();
    await loadPromise;
    const showPromise = adapter.show('rewarded_revive');
    mockAd.triggerClose(true);
    assert.equal(await showPromise, 'completed');
    adapter.dispose();
  });

  it('show 两次都失败且没有 onClose 时返回 not_ready，不挂起', async () => {
    mockAd.rejectShow = true;
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
    });
    const loadPromise = adapter.load('rewarded_revive');
    mockAd.triggerLoad();
    await loadPromise;
    assert.equal(await adapter.show('rewarded_revive'), 'not_ready');
    adapter.dispose();
  });

  it('占位 TODO adUnitId 不创建广告实例', async () => {
    let created = 0;
    (globalThis as unknown as { wx: Wx }).wx.createRewardedVideoAd = () => {
      created += 1;
      return mockAd;
    };
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'TODO_REWARD_REVIVE_UNIT_ID',
      rewarded_crush_extend: 'TODO_REWARD_CRUSH_EXTEND_UNIT_ID',
      interstitial_settle: 'TODO_INTERSTITIAL_UNIT_ID',
    });
    await adapter.load('rewarded_revive');
    assert.equal(adapter.isReady('rewarded_revive'), false);
    assert.equal(await adapter.show('rewarded_revive'), 'not_ready');
    assert.equal(created, 0);
    adapter.dispose();
  });

  it('大厅横幅 createCustomAd 后 show/hide，占位 ID 不创建', async () => {
    let created = 0;
    let shown = 0;
    let hidden = 0;
    let lastStyle: { left: number; top: number; width?: number } | undefined;
    const customAd: WxCustomAd = {
      async show() {
        shown += 1;
      },
      hide() {
        hidden += 1;
      },
      destroy() {},
      onLoad() {},
      offLoad() {},
      onError() {},
      offError() {},
      onHide() {},
      offHide() {},
    };
    (globalThis as unknown as { wx: Wx }).wx.createCustomAd = (options) => {
      created += 1;
      lastStyle = options.style;
      return customAd;
    };
    const prevInfo = (globalThis as unknown as { wx: Wx }).wx.getSystemInfoSync;
    (globalThis as unknown as { wx: Wx }).wx.getSystemInfoSync = () => {
      const info = prevInfo();
      return { ...info, platform: 'ios' };
    };

    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
      banner_lobby: 'adunit-8f450e80c0ee8f6d',
    });
    await adapter.load('banner_lobby');
    assert.equal(created, 1);
    assert.equal(await adapter.show('banner_lobby'), 'completed');
    assert.equal(shown, 1);
    assert.ok(lastStyle);
    assert.equal(lastStyle.left, 8);
    adapter.hide('banner_lobby');
    assert.equal(hidden, 1);
    assert.equal(await adapter.show('banner_lobby'), 'completed');
    assert.equal(shown, 2);
    adapter.dispose();

    const skipped = new WxAdAdapter({
      rewarded_revive: 'TODO_REWARD_REVIVE_UNIT_ID',
      rewarded_crush_extend: 'TODO_REWARD_CRUSH_EXTEND_UNIT_ID',
      interstitial_settle: 'TODO_INTERSTITIAL_UNIT_ID',
      banner_lobby: '',
    });
    const createdBefore = created;
    await skipped.load('banner_lobby');
    assert.equal(await skipped.show('banner_lobby'), 'not_ready');
    assert.equal(created, createdBefore);
    skipped.dispose();
    (globalThis as unknown as { wx: Wx }).wx.getSystemInfoSync = prevInfo;
  });

  it('show 尚未完成时 hide，迟到的上屏必须立刻收掉', async () => {
    let shown = 0;
    let hidden = 0;
    let resumeShow: (() => void) | undefined;
    const customAd: WxCustomAd = {
      async show() {
        await new Promise<void>((resolve) => {
          resumeShow = resolve;
        });
        shown += 1;
      },
      hide() {
        hidden += 1;
      },
      destroy() {},
      onLoad() {},
      offLoad() {},
      onError() {},
      offError() {},
      onHide() {},
      offHide() {},
    };
    const wxApi = (globalThis as unknown as { wx: Wx }).wx;
    const prevCreate = wxApi.createCustomAd;
    const prevInfo = wxApi.getSystemInfoSync;
    wxApi.getSystemInfoSync = () => {
      const info = prevInfo();
      return { ...info, platform: 'ios' };
    };
    wxApi.createCustomAd = () => customAd;
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
      banner_lobby: 'adunit-8f450e80c0ee8f6d',
    });
    const pending = adapter.show('banner_lobby');
    adapter.hide('banner_lobby');
    assert.ok(resumeShow);
    resumeShow();
    assert.equal(await pending, 'error');
    assert.equal(shown, 1);
    assert.ok(hidden >= 1);
    adapter.dispose();
    wxApi.createCustomAd = prevCreate;
    wxApi.getSystemInfoSync = prevInfo;
  });

  it('开发者工具不创建任何原生广告图层', async () => {
    let rewardedCreated = 0;
    let bannerCreated = 0;
    const wxApi = (globalThis as unknown as { wx: Wx }).wx;
    const prevInfo = wxApi.getSystemInfoSync;
    wxApi.getSystemInfoSync = () => {
      const info = prevInfo();
      return { ...info, platform: 'devtools', brand: 'devtools', model: 'devtools' };
    };
    const prevCreate = wxApi.createRewardedVideoAd;
    wxApi.createRewardedVideoAd = () => {
      rewardedCreated += 1;
      return mockAd;
    };
    wxApi.createCustomAd = () => {
      bannerCreated += 1;
      return {
        async show() {},
        hide() {},
        destroy() {},
        onLoad() {},
        offLoad() {},
        onError() {},
        offError() {},
      } as WxCustomAd;
    };
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
      banner_lobby: 'adunit-8f450e80c0ee8f6d',
    });
    await adapter.load('rewarded_revive');
    await adapter.load('banner_lobby');
    assert.equal(rewardedCreated, 0);
    assert.equal(bannerCreated, 0);
    assert.equal(await adapter.show('banner_lobby'), 'not_ready');
    adapter.dispose();
    wxApi.getSystemInfoSync = prevInfo;
    wxApi.createRewardedVideoAd = prevCreate;
  });

  it('插屏未 onLoad 也会调用 show，避免进门广告一直 not_ready', async () => {
    let shown = 0;
    let closeCb: (() => void) | undefined;
    const wxApi = (globalThis as unknown as { wx: Wx }).wx;
    const prevCreate = wxApi.createInterstitialAd;
    wxApi.createInterstitialAd = () =>
      ({
        async load() {},
        async show() {
          shown += 1;
          closeCb?.();
        },
        destroy() {},
        onLoad() {},
        offLoad() {},
        onError() {},
        offError() {},
        onClose(cb: () => void) {
          closeCb = cb;
        },
        offClose() {
          closeCb = undefined;
        },
      }) as WxInterstitialAd;
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
      banner_lobby: 'adunit-8f450e80c0ee8f6d',
    });
    assert.equal(await adapter.show('interstitial_settle'), 'completed');
    assert.equal(shown, 1);
    adapter.dispose();
    wxApi.createInterstitialAd = prevCreate;
  });

  it('dispose 后 load/show 失效；hide 非横幅忽略；插屏 2001 返回 error 可再试', async () => {
    const wxApi = (globalThis as unknown as { wx: Wx }).wx;
    const prevCreate = wxApi.createInterstitialAd;
    let shown = 0;
    wxApi.createInterstitialAd = () =>
      ({
        async load() {},
        async show() {
          shown += 1;
          const err = { errMsg: 'freq', errCode: 2001 };
          throw err;
        },
        destroy() {},
        onLoad() {},
        offLoad() {},
        onError() {},
        offError() {},
        onClose() {},
        offClose() {},
      }) as WxInterstitialAd;
    const { WxAdAdapter } = await import('../../src/core/adapters/WxAdAdapter');
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
      banner_lobby: 'adunit-8f450e80c0ee8f6d',
    });
    assert.equal(await adapter.show('interstitial_settle'), 'error');
    assert.equal(shown, 1);
    adapter.hide('rewarded_revive');
    adapter.dispose();
    await adapter.load('rewarded_revive');
    assert.equal(await adapter.show('rewarded_revive'), 'error');
    adapter.hide('banner_lobby');
    wxApi.createInterstitialAd = prevCreate;
  });

  it('插屏 show 成功后超过打开超时仍等 onClose，不误判 error', async () => {
    const wxApi = (globalThis as unknown as { wx: Wx }).wx;
    const prevCreate = wxApi.createInterstitialAd;
    let closeCb: (() => void) | undefined;
    let resolveShow: (() => void) | undefined;
    wxApi.createInterstitialAd = () =>
      ({
        async load() {},
        show() {
          return new Promise<void>((resolve) => {
            resolveShow = resolve;
          });
        },
        destroy() {},
        onLoad() {},
        offLoad() {},
        onError() {},
        offError() {},
        onClose(cb: () => void) {
          closeCb = cb;
        },
        offClose() {
          closeCb = undefined;
        },
      }) as WxInterstitialAd;
    const { INTERSTITIAL_WATCHDOG, WxAdAdapter } = await import(
      '../../src/core/adapters/WxAdAdapter'
    );
    const prevOpen = INTERSTITIAL_WATCHDOG.openMs;
    INTERSTITIAL_WATCHDOG.openMs = 30;
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
    });
    try {
      const pending = adapter.show('interstitial_settle');
      await new Promise((r) => setTimeout(r, 0));
      resolveShow?.();
      await new Promise((r) => setTimeout(r, 50));
      closeCb?.();
      assert.equal(await pending, 'completed');
    } finally {
      INTERSTITIAL_WATCHDOG.openMs = prevOpen;
      adapter.dispose();
      wxApi.createInterstitialAd = prevCreate;
    }
  });

  it('插屏 show 一直不成功则打开超时返回 error', async () => {
    const wxApi = (globalThis as unknown as { wx: Wx }).wx;
    const prevCreate = wxApi.createInterstitialAd;
    wxApi.createInterstitialAd = () =>
      ({
        async load() {},
        show() {
          return new Promise<void>(() => {
            /* hang */
          });
        },
        destroy() {},
        onLoad() {},
        offLoad() {},
        onError() {},
        offError() {},
        onClose() {},
        offClose() {},
      }) as WxInterstitialAd;
    const { INTERSTITIAL_WATCHDOG, WxAdAdapter } = await import(
      '../../src/core/adapters/WxAdAdapter'
    );
    const prevOpen = INTERSTITIAL_WATCHDOG.openMs;
    INTERSTITIAL_WATCHDOG.openMs = 30;
    const adapter = new WxAdAdapter({
      rewarded_revive: 'unit_revive',
      rewarded_crush_extend: 'unit_extend',
      interstitial_settle: 'unit_interstitial',
    });
    try {
      assert.equal(await adapter.show('interstitial_settle'), 'error');
    } finally {
      INTERSTITIAL_WATCHDOG.openMs = prevOpen;
      adapter.dispose();
      wxApi.createInterstitialAd = prevCreate;
    }
  });
});

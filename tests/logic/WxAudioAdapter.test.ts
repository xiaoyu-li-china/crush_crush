/**
 * WxAudioAdapter：预加载后首次 play 不得先 stop；src 未就绪时等 onCanplay。
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

type MockCtx = WxInnerAudioContext & {
  plays: number;
  stops: number;
  pauses: number;
  canplay?: () => void;
};

function createMockCtx(): MockCtx {
  const ctx: MockCtx = {
    src: '',
    autoplay: false,
    loop: false,
    volume: 1,
    paused: true,
    plays: 0,
    stops: 0,
    pauses: 0,
    play() {
      ctx.plays += 1;
      ctx.paused = false;
    },
    pause() {
      ctx.pauses += 1;
      ctx.paused = true;
    },
    stop() {
      ctx.stops += 1;
      ctx.paused = true;
    },
    destroy() {},
    seek() {},
    onCanplay(cb) {
      ctx.canplay = cb;
    },
    onEnded() {},
    offEnded() {},
    onError() {},
    offError() {},
  };
  return ctx;
}

describe('WxAudioAdapter', () => {
  let created: MockCtx[];

  beforeEach(() => {
    created = [];
    (globalThis as unknown as { wx: Wx }).wx = {
      createInnerAudioContext: () => {
        const ctx = createMockCtx();
        created.push(ctx);
        return ctx;
      },
      setInnerAudioOption() {},
      createWebAudioContext: () => ({ resume() {} }),
      createRewardedVideoAd: () => ({}) as WxRewardedVideoAd,
      createInterstitialAd: () => ({}) as WxInterstitialAd,
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
          platform: 'devtools',
          SDKVersion: '2.19.0',
        }) as WxSystemInfo,
      request() {},
      onShow() {},
      onHide() {},
      offShow() {},
      offHide() {},
    } as Wx;
  });

  it('首次播放短音效不先 stop，等 canplay 再 play', async () => {
    const { WxAudioAdapter } = await import('../../src/core/adapters/WxAudioAdapter');
    const adapter = new WxAudioAdapter();
    adapter.play('sfx_good');
    const ctx = created[created.length - 1];
    assert.ok(ctx);
    assert.equal(ctx.stops, 0);
    assert.equal(ctx.src, 'assets/main/audio/sfx_good.mp3');
    ctx.canplay?.();
    assert.ok(ctx.plays >= 1);
    adapter.dispose();
  });

  it('preloadSfx 会创建 Good/Great/Excellent 上下文且不立刻播放', async () => {
    const { WxAudioAdapter } = await import('../../src/core/adapters/WxAudioAdapter');
    const adapter = new WxAudioAdapter();
    adapter.preloadSfx();
    const srcs = created.map((c) => c.src);
    assert.ok(srcs.includes('assets/main/audio/sfx_good.mp3'));
    assert.ok(srcs.includes('assets/main/audio/sfx_great.mp3'));
    assert.ok(srcs.includes('assets/main/audio/sfx_excellent.mp3'));
    assert.equal(
      created.reduce((sum, c) => sum + c.plays, 0),
      0,
    );
    adapter.dispose();
  });

  it('BGM：切后台 pause，回来 play；静音时不续', async () => {
    const { WxAudioAdapter } = await import('../../src/core/adapters/WxAudioAdapter');
    const adapter = new WxAudioAdapter();
    adapter.suspendForBackground();
    adapter.play('bgm_main', { loop: true });
    const bgm = created[created.length - 1];
    assert.ok(bgm);
    bgm.paused = true;
    adapter.suspendForBackground();
    assert.ok(bgm.pauses >= 1);
    adapter.resumeFromBackground();
    assert.ok(bgm.plays >= 1);
    adapter.setMuted(true);
    adapter.resumeFromBackground();
    adapter.setMuted(false);
    adapter.stop('bgm_main');
    adapter.dispose();
  });
});

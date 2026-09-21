/**
 * 分享图菜单取消也必须 complete，游戏才能恢复循环。
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { WxShareAdapter } from '../../src/core/adapters/WxShareAdapter';

describe('WxShareAdapter 分享图菜单', () => {
  beforeEach(() => {
    (globalThis as unknown as { wx: Wx }).wx = {
      createCanvas: () => ({}) as WxCanvas,
      createImage: () => ({}) as WxImage,
      onTouchStart() {},
      onTouchMove() {},
      onTouchEnd() {},
      onTouchCancel() {},
      offTouchStart() {},
      offTouchMove() {},
      offTouchEnd() {},
      offTouchCancel() {},
    };
  });

  it('取消分享图会 complete，promise 结束', async () => {
    (globalThis as unknown as { wx: Wx }).wx.showShareImageMenu = (options) => {
      options.fail?.({ errMsg: 'showShareImageMenu:fail cancel' });
      options.complete?.({ errMsg: 'showShareImageMenu:fail cancel' });
    };
    const share = new WxShareAdapter();
    assert.equal(await share.sharePoster('/tmp/poster.jpg'), true);
  });

  it('没有分享图接口时立刻 false', async () => {
    const share = new WxShareAdapter();
    assert.equal(await share.sharePoster('/tmp/poster.jpg'), false);
  });

  it('公众号贴图取消也会结束，不把调用方挂死', async () => {
    (globalThis as unknown as { wx: Wx }).wx.shareToOfficialAccount = (options) => {
      options.fail?.({ errMsg: 'shareToOfficialAccount:fail cancel' });
      options.complete?.({ errMsg: 'shareToOfficialAccount:fail cancel' });
    };
    const share = new WxShareAdapter();
    assert.equal(
      await share.shareToOfficialAccount({
        title: 't',
        content: 'c',
        tags: ['来微信做个小程序'],
        recommendTitle: '萌宠粉碎消',
      }),
      true,
    );
  });
});

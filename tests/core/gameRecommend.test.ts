/**
 * 游戏圈推荐：官方 OPENLINK + PageManager 预加载 / 展示。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GAME_RECOMMEND_OPENLINK,
  GameRecommendLauncher,
  canCreateGameRecommend,
} from '../../src/core/utils/gameRecommend';

describe('GameRecommendLauncher', () => {
  it('没有 createPageManager 时不支持', async () => {
    const prev = (globalThis as { wx?: Wx }).wx;
    delete (globalThis as { wx?: Wx }).wx;
    try {
      assert.equal(canCreateGameRecommend(), false);
      const launcher = new GameRecommendLauncher();
      assert.equal(await launcher.show(), 'unsupported');
    } finally {
      if (prev) {
        (globalThis as { wx: Wx }).wx = prev;
      }
    }
  });

  it('load + show 使用官方推荐 OPENLINK', async () => {
    const loaded: string[] = [];
    const shown: string[] = [];
    (globalThis as { wx: Wx }).wx = {
      createPageManager: () => ({
        async load(options) {
          loaded.push(options.openlink);
        },
        async show(options) {
          shown.push(options?.openlink ?? '');
        },
        destroy() {},
      }),
    } as Wx;
    const launcher = new GameRecommendLauncher();
    assert.equal(canCreateGameRecommend(), true);
    assert.equal(await launcher.preload(), true);
    assert.equal(await launcher.show(), 'shown');
    assert.deepEqual(loaded, [GAME_RECOMMEND_OPENLINK]);
    assert.deepEqual(shown, [GAME_RECOMMEND_OPENLINK]);
    launcher.dispose();
  });

  it('load 失败返回 error，不抛错', async () => {
    (globalThis as { wx: Wx }).wx = {
      createPageManager: () => ({
        async load() {
          throw new Error('fail');
        },
        async show() {},
        destroy() {},
      }),
    } as Wx;
    const launcher = new GameRecommendLauncher();
    assert.equal(await launcher.show(), 'error');
    launcher.dispose();
  });
});

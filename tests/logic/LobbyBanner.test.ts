/**
 * 大厅原生模板横幅：布局与只在 Lobby 展示。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isWxCustomAdHostSupported } from '../../src/core/utils/wxHost';
import {
  layoutLobbyBannerStyle,
  lobbyBannerReserveHeight,
  toNativeViewStyle,
} from '../../src/core/utils/lobbyBanner';
import { createMemoryDeps, miniLevels } from '../helpers/memory-deps';
import { GameSession } from '../../src/services/GameSession';

describe('大厅 Banner 布局', () => {
  it('开发者工具不作为真机平台，模拟器也不创建原生广告', () => {
    assert.equal(isWxCustomAdHostSupported('devtools'), false);
    assert.equal(isWxCustomAdHostSupported('mac'), false);
    assert.equal(isWxCustomAdHostSupported('windows'), false);
    assert.equal(isWxCustomAdHostSupported('ios'), true);
    assert.equal(isWxCustomAdHostSupported('android'), true);
  });
  it('20:7 贴在窗口底部，宽度扣除左右边距', () => {
    const box = layoutLobbyBannerStyle(375, 667, 0);
    assert.equal(box.left, 8);
    assert.equal(box.width, 359);
    assert.equal(box.height, Math.round(359 * 7 / 20));
    assert.equal(box.top, 667 - box.height - 4);
    assert.equal(lobbyBannerReserveHeight(375, 667, 0), box.height + 4);
  });

  it('safeArea 比最小底边大时用安全区', () => {
    const box = layoutLobbyBannerStyle(375, 812, 34);
    assert.equal(box.top, 812 - box.height - 34);
  });

  it('窗口尺寸非法时仍给出有限整数，避免 insertTextView 报错', () => {
    const box = layoutLobbyBannerStyle(Number.NaN, Number.NaN, Number.NaN);
    assert.equal(Number.isFinite(box.left), true);
    assert.equal(Number.isFinite(box.top), true);
    assert.equal(Number.isFinite(box.width), true);
    assert.equal(box.width >= 1, true);
    assert.equal(toNativeViewStyle({ left: Number.NaN, top: 10, width: 20, height: 20 }), null);
    assert.equal(toNativeViewStyle({ left: 0, top: 0, width: 0, height: 10 }), null);
    assert.equal(toNativeViewStyle({ left: -1, top: 0, width: 10, height: 10 }), null);
    assert.equal(toNativeViewStyle({ left: Number.POSITIVE_INFINITY, top: 1, width: 10, height: 10 }), null);
    assert.deepEqual(toNativeViewStyle({ left: 8.6, top: 10.2, width: 20.4, height: 12.8 }), {
      left: 9,
      top: 10,
      width: 20,
      height: 13,
    });
    assert.equal(lobbyBannerReserveHeight(Number.NaN, Number.NaN, 0) > 0, true);
  });
});

describe('大厅 Banner 会话', () => {
  it('大厅可展示，进关后不再展示并隐藏', async () => {
    const shown: string[] = [];
    let hidden = 0;
    const session = new GameSession(
      createMemoryDeps({
        async show(placement) {
          shown.push(placement);
          return 'completed';
        },
        hide() {
          hidden += 1;
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(session.isLobbyBannerEnabled(), true);
    assert.ok(session.getLobbyBannerReservePx() > 80);
    assert.equal(await session.showLobbyBanner(), 'completed');
    assert.deepEqual(shown, ['banner_lobby']);

    await session.startLevel(1);
    assert.equal(await session.showLobbyBanner(), 'error');
    assert.equal(hidden >= 1, true);

    session.hideLobbyBanner();
    assert.equal(hidden >= 2, true);
  });

  it('进关途中迟到的横幅 show 会被拦下并隐藏', async () => {
    let hidden = 0;
    let release!: (result: 'completed') => void;
    const session = new GameSession(
      createMemoryDeps({
        async show() {
          return new Promise((resolve) => {
            release = resolve;
          });
        },
        hide() {
          hidden += 1;
        },
        isReady: () => true,
      }),
    );
    session.setLevelTable(miniLevels());
    await session.init();
    const pending = session.showLobbyBanner();
    await session.startLevel(1);
    release('completed');
    assert.equal(await pending, 'error');
    assert.equal(hidden >= 1, true);
    assert.equal(await session.showLobbyBanner(), 'error');
  });
});

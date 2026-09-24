import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  NOTICE_BUBBLE_DRIFT_MS,
  NOTICE_BUBBLE_FADE_MS,
  NOTICE_BUBBLE_HOLD_MS,
  layoutLobbyNoticeBubble,
  lobbyNoticeBubbleCycle,
  lobbyNoticeBubbleDrift,
  lobbyNoticeBubbleLines,
} from '../../src/presentation/ui/LobbyNoticeBubble';

describe('LobbyNoticeBubble', () => {
  it('优先用 bubbles，空项去重，缺省回退 body', () => {
    assert.deepEqual(
      lobbyNoticeBubbleLines({
        body: 'body',
        bubbles: ['一', ' 二 ', '一', '', '三'],
      }),
      ['一', '二', '三'],
    );
    assert.deepEqual(lobbyNoticeBubbleLines({ body: '仅正文' }), ['仅正文']);
    assert.deepEqual(lobbyNoticeBubbleLines({}), []);
  });

  it('多条文案按时交叉淡入淡出并循环', () => {
    const single = lobbyNoticeBubbleCycle(1000, 1);
    assert.equal(single.index, 0);
    assert.equal(single.opacity, 1);
    assert.equal(single.nextOpacity, 0);

    const hold = lobbyNoticeBubbleCycle(100, 3);
    assert.equal(hold.index, 0);
    assert.equal(hold.opacity, 1);
    assert.equal(hold.nextOpacity, 0);

    const midFade = lobbyNoticeBubbleCycle(
      NOTICE_BUBBLE_HOLD_MS + NOTICE_BUBBLE_FADE_MS / 2,
      3,
    );
    assert.equal(midFade.index, 0);
    assert.ok(midFade.opacity > 0.4 && midFade.opacity < 0.6);
    assert.equal(midFade.nextIndex, 1);
    assert.ok(midFade.nextOpacity > 0.4 && midFade.nextOpacity < 0.6);

    const next = lobbyNoticeBubbleCycle(
      NOTICE_BUBBLE_HOLD_MS + NOTICE_BUBBLE_FADE_MS + 10,
      3,
    );
    assert.equal(next.index, 1);
    assert.equal(next.opacity, 1);

    const wrap = lobbyNoticeBubbleCycle(
      (NOTICE_BUBBLE_HOLD_MS + NOTICE_BUBBLE_FADE_MS) * 3 + 20,
      3,
    );
    assert.equal(wrap.index, 0);
  });

  it('轨迹左下→右上后弹回左下，再向上循环', () => {
    const start = lobbyNoticeBubbleDrift(0);
    assert.equal(start.progress, 0);
    assert.equal(start.goingUp, true);
    assert.equal(start.opacity, 1);

    const midUp = lobbyNoticeBubbleDrift(NOTICE_BUBBLE_DRIFT_MS * 0.5);
    assert.ok(midUp.progress > 0.45 && midUp.progress < 0.55);
    assert.equal(midUp.goingUp, true);

    const atTop = lobbyNoticeBubbleDrift(NOTICE_BUBBLE_DRIFT_MS);
    assert.equal(atTop.goingUp, false);
    assert.ok(Math.abs(atTop.progress - 1) < 0.001);
    const back = lobbyNoticeBubbleDrift(NOTICE_BUBBLE_DRIFT_MS + NOTICE_BUBBLE_DRIFT_MS * 0.25);
    assert.equal(back.goingUp, false);
    assert.ok(back.progress < 0.8 && back.progress > 0.7);

    const nearBottom = lobbyNoticeBubbleDrift(NOTICE_BUBBLE_DRIFT_MS * 2 - 1);
    assert.equal(nearBottom.goingUp, false);
    assert.ok(nearBottom.progress < 0.02);

    const againUp = lobbyNoticeBubbleDrift(NOTICE_BUBBLE_DRIFT_MS * 2 + 10);
    assert.equal(againUp.goingUp, true);
    assert.ok(againUp.progress > 0);

    const a = layoutLobbyNoticeBubble({
      width: 390,
      height: 844,
      statusBarHeight: 44,
      contentTop: 760,
      progress: 0,
      text: '邀请好友通关，双方各得锤子',
      measureWidth: (text) => text.length * 12,
    });
    const b = layoutLobbyNoticeBubble({
      width: 390,
      height: 844,
      statusBarHeight: 44,
      contentTop: 760,
      progress: 1,
      text: '邀请好友通关，双方各得锤子',
      measureWidth: (text) => text.length * 12,
    });
    assert.ok(a.x < b.x);
    assert.ok(a.y > b.y);
  });
});

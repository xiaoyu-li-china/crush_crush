/**
 * 前后台闸门：误报 hide、广告遮罩、真切到别的 App。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FOREGROUND_HIDE_DEBOUNCE_MS,
  ForegroundGate,
} from '../../src/core/utils/foregroundGate';

function createGate() {
  let now = 1000;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let nextId = 1;
  const calls: string[] = [];
  const gate = new ForegroundGate({
    now: () => now,
    schedule(fn, ms) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    cancel(id) {
      timers.delete(id);
    },
    pause() {
      calls.push('pause');
    },
    resume(reason) {
      calls.push(`resume:${reason}`);
    },
  });
  return {
    gate,
    calls,
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers.entries()]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
}

describe('ForegroundGate', () => {
  it('hide 后很快 show 当成误报，不停画布', () => {
    const { gate, calls, advance } = createGate();
    gate.onHide();
    advance(FOREGROUND_HIDE_DEBOUNCE_MS - 20);
    gate.onShow();
    assert.deepEqual(calls, ['resume:show']);
    assert.equal(gate.isHidden(), false);
  });

  it('没有 hide 的单独 show 不重建循环', () => {
    const { gate, calls } = createGate();
    gate.onShow();
    assert.deepEqual(calls, []);
    assert.equal(gate.isHidden(), false);
  });

  it('hide 超过去抖才暂停，show 再恢复', () => {
    const { gate, calls, advance } = createGate();
    gate.onHide();
    advance(FOREGROUND_HIDE_DEBOUNCE_MS + 10);
    assert.deepEqual(calls, ['pause']);
    assert.equal(gate.isHidden(), true);
    gate.onShow();
    assert.deepEqual(calls, ['pause', 'resume:show']);
    assert.equal(gate.isHidden(), false);
  });

  it('激励广告遮罩期间 hide/show 不把循环拉起来，关闭后才 resume', () => {
    const { gate, calls, advance } = createGate();
    gate.enterOverlay();
    assert.deepEqual(calls, ['pause']);
    gate.onHide();
    advance(500);
    gate.onShow();
    assert.deepEqual(calls, ['pause']);
    assert.equal(gate.isHidden(), true);
    gate.leaveOverlay();
    assert.deepEqual(calls, ['pause', 'resume:overlay-end']);
  });

  it('原生层没起来就 abort，不做关广告重建', () => {
    const { gate, calls } = createGate();
    gate.enterOverlay();
    gate.abortOverlay();
    assert.deepEqual(calls, ['pause', 'resume:overlay-abort']);
    assert.equal(gate.isHidden(), false);
  });

  it('原生横幅 hold 期间 onHide 不暂停', () => {
    const { gate, calls, advance } = createGate();
    gate.holdNativeChrome(1600);
    gate.onHide();
    advance(FOREGROUND_HIDE_DEBOUNCE_MS + 50);
    assert.deepEqual(calls, []);
    assert.equal(gate.isHidden(), false);
  });

  it('点游戏圈时即使 hold 也立刻暂停，回来再 show 恢复', () => {
    const { gate, calls } = createGate();
    gate.holdNativeChrome(1600);
    gate.forcePause();
    assert.deepEqual(calls, ['pause']);
    assert.equal(gate.isHidden(), true);
    gate.forcePause();
    assert.deepEqual(calls, ['pause']);
    gate.onShow();
    assert.deepEqual(calls, ['pause', 'resume:show']);
  });

  it('嵌套广告遮罩、dispose、去抖期间进广告都不卡死', () => {
    const { gate, calls, advance } = createGate();
    gate.enterOverlay();
    gate.enterOverlay();
    assert.equal(gate.hasOverlay(), true);
    gate.leaveOverlay();
    assert.deepEqual(calls, ['pause']);
    gate.leaveOverlay();
    assert.deepEqual(calls, ['pause', 'resume:overlay-end']);
    assert.equal(gate.hasOverlay(), false);

    gate.onHide();
    gate.enterOverlay();
    advance(FOREGROUND_HIDE_DEBOUNCE_MS + 20);
    assert.deepEqual(calls, ['pause', 'resume:overlay-end', 'pause']);
    gate.leaveOverlay();

    gate.holdNativeChrome(10);
    gate.holdNativeChrome(0);
    gate.dispose();
    assert.equal(gate.isHidden(), false);
    assert.equal(gate.hasOverlay(), false);
    gate.dispose();
  });

  it('show 失败走 abort，不按关广告重建；无 hide 的 show 不 resume', () => {
    const { gate, calls, advance } = createGate();
    gate.onShow();
    assert.deepEqual(calls, []);
    gate.enterOverlay();
    gate.abortOverlay();
    assert.deepEqual(calls, ['pause', 'resume:overlay-abort']);
    gate.enterOverlay();
    gate.enterOverlay();
    gate.abortOverlay();
    assert.deepEqual(calls, ['pause', 'resume:overlay-abort', 'pause']);
    gate.abortOverlay();
    assert.deepEqual(calls, [
      'pause',
      'resume:overlay-abort',
      'pause',
      'resume:overlay-abort',
    ]);
    advance(1);
  });

  it('已在后台或广告里时 forcePause / onHide 不重复停循环', () => {
    const { gate, calls, advance } = createGate();
    gate.forcePause();
    gate.onHide();
    gate.enterOverlay();
    gate.forcePause();
    advance(FOREGROUND_HIDE_DEBOUNCE_MS + 10);
    assert.deepEqual(calls, ['pause']);
    gate.leaveOverlay();
    assert.deepEqual(calls, ['pause', 'resume:overlay-end']);
  });

  it('去抖回调与广告遮罩竞态时不二次 pause', () => {
    let now = 1000;
    const timers = new Map<number, { fn: () => void; at: number }>();
    let nextId = 1;
    const calls: string[] = [];
    const gate = new ForegroundGate({
      now: () => now,
      schedule(fn, ms) {
        const id = nextId;
        nextId += 1;
        timers.set(id, { fn, at: now + ms });
        return id;
      },
      cancel() {},
      pause() {
        calls.push('pause');
      },
      resume(reason) {
        calls.push(`resume:${reason}`);
      },
    });
    gate.onHide();
    gate.enterOverlay();
    now += FOREGROUND_HIDE_DEBOUNCE_MS + 20;
    for (const timer of [...timers.values()]) {
      if (timer.at <= now) {
        timer.fn();
      }
    }
    assert.deepEqual(calls, ['pause']);
    gate.leaveOverlay();
    assert.deepEqual(calls, ['pause', 'resume:overlay-end']);
  });
});

/**
 * 粒子上限：轻量档 / 全特效、边界与回收。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  compactTimed,
  cottonFluffCount,
  crushSparkCount,
  DESKTOP_IDLE_STOP_MS,
  juiceSparkCount,
  resolveNextFrameDelayMs,
  resolveRenderIdleStopMs,
  shouldBackoffAfterFrameErrors,
  shouldKeepRenderLoop,
  timedListCap,
} from '../../src/core/utils/perfBudget';

describe('perfBudget', () => {
  it('火花数量：轻量档下限，全特效随消除数涨到上限', () => {
    assert.equal(crushSparkCount(true, 0), 4);
    assert.equal(crushSparkCount(true, 99), 8);
    assert.equal(crushSparkCount(false, 0), 10);
    assert.equal(crushSparkCount(false, 20), 28);
    assert.equal(crushSparkCount(true, Number.NaN), 4);
    assert.equal(juiceSparkCount(true, 9), 3);
    assert.equal(juiceSparkCount(false, 0), 10);
    assert.equal(juiceSparkCount(false, 4), 16);
    assert.equal(juiceSparkCount(false, -3), 10);
    assert.equal(juiceSparkCount(false, Number.NaN), 10);
    assert.equal(cottonFluffCount(true), 4);
    assert.equal(cottonFluffCount(false), 14);
  });

  it('列表 cap：过期丢弃，超出上限从头部裁', () => {
    assert.equal(timedListCap('bursts', true), 8);
    assert.equal(timedListCap('bursts', false), 24);
    assert.equal(timedListCap('scores', true), 6);
    assert.equal(timedListCap('sparks', false), 72);
    const list = [
      { startMs: 0, durationMs: 10 },
      { startMs: 20, durationMs: 10 },
      { startMs: 25, durationMs: 10 },
    ];
    compactTimed(list, 22, 1);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.startMs, 25);
    compactTimed(list, 22, Number.NaN);
    assert.equal(list.length, 0);
    compactTimed(list, Number.NaN, 2);
    assert.equal(list.length, 0);
    const exact = [{ startMs: 0, durationMs: 10 }];
    compactTimed(exact, 10, 8);
    assert.equal(exact.length, 0);
    const empty: { startMs: number; durationMs: number }[] = [];
    compactTimed(empty, 1, 4);
    assert.equal(empty.length, 0);
    assert.equal(timedListCap('scores', false), 16);
    assert.equal(timedListCap('sparks', true), 18);
  });

  it('空闲超时停循环；连续画帧失败才退避', () => {
    assert.equal(
      shouldKeepRenderLoop({
        animating: true,
        lastInteractMs: 0,
        nowMs: 10_000,
      }),
      true,
    );
    assert.equal(
      shouldKeepRenderLoop({
        animating: false,
        lastInteractMs: 1000,
        nowMs: 2500,
      }),
      true,
    );
    assert.equal(
      shouldKeepRenderLoop({
        animating: false,
        lastInteractMs: 1000,
        nowMs: 2801,
      }),
      false,
    );
    assert.equal(
      shouldKeepRenderLoop({
        animating: false,
        lastInteractMs: Number.NaN,
        nowMs: Number.NaN,
        idleStopMs: 0,
      }),
      false,
    );
    assert.equal(shouldBackoffAfterFrameErrors(2), false);
    assert.equal(shouldBackoffAfterFrameErrors(3), true);
    assert.equal(shouldBackoffAfterFrameErrors(Number.NaN), false);
    assert.equal(
      resolveRenderIdleStopMs({ desktopIde: true, ambientFx: true }),
      DESKTOP_IDLE_STOP_MS,
    );
    assert.equal(
      resolveRenderIdleStopMs({ desktopIde: false, ambientFx: true }),
      Number.POSITIVE_INFINITY,
    );
    assert.equal(resolveRenderIdleStopMs({ desktopIde: false, ambientFx: false }), 1800);
    assert.equal(
      resolveRenderIdleStopMs({ desktopIde: true, ambientFx: false }),
      DESKTOP_IDLE_STOP_MS,
    );
    // 模拟器空闲必须停循环，不能返回 Infinity 把主线程占满
    assert.equal(
      shouldKeepRenderLoop({
        animating: false,
        lastInteractMs: 0,
        nowMs: DESKTOP_IDLE_STOP_MS + 1,
        idleStopMs: resolveRenderIdleStopMs({ desktopIde: true, ambientFx: true }),
      }),
      false,
    );
    assert.equal(
      shouldKeepRenderLoop({
        animating: false,
        lastInteractMs: 0,
        nowMs: 60_000,
        idleStopMs: Number.POSITIVE_INFINITY,
      }),
      true,
    );
    assert.equal(
      resolveNextFrameDelayMs({ animating: true, desktopIde: true, baseDelayMs: 33 }),
      33,
    );
    assert.equal(
      resolveNextFrameDelayMs({ animating: false, desktopIde: true, baseDelayMs: 33 }),
      80,
    );
    assert.equal(
      resolveNextFrameDelayMs({ animating: false, desktopIde: false, baseDelayMs: 33 }),
      90,
    );
    assert.equal(
      resolveNextFrameDelayMs({ animating: true, desktopIde: false, baseDelayMs: Number.NaN }),
      33,
    );
    assert.equal(
      resolveNextFrameDelayMs({ animating: true, desktopIde: false, baseDelayMs: 8 }),
      16,
    );
  });
});

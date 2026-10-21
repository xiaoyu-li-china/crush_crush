import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMahjongFlyAnim,
  createMahjongSlotFlight,
  launchMahjongSlotFlight,
  mahjongSlotsForDisplay,
  pruneMahjongSlotFlight,
  sampleMahjongFlyAnim,
  type MahjongSlotAppendFn,
} from '../../src/presentation/mahjong/MahjongTileFlyAnim';

const appendTriple: MahjongSlotAppendFn = (slots, tile) => {
  const next = [...slots, tile];
  return next.filter((t) => t === tile).length >= 3 ? next.filter((t) => t !== tile) : next;
};

function fly(type: number, startMs: number) {
  return createMahjongFlyAnim({
    type,
    fromX: 0,
    fromY: 0,
    fromW: 40,
    fromH: 50,
    fromRot: 0,
    toX: 100,
    toY: 200,
    toW: 36,
    toH: 46,
    startMs,
    durationMs: 300,
  });
}

describe('麻将飞牌动画', () => {
  it('结束时到达目标位', () => {
    const anim = createMahjongFlyAnim({
      type: 1,
      fromX: 10,
      fromY: 20,
      fromW: 40,
      fromH: 50,
      fromRot: 0.3,
      toX: 100,
      toY: 200,
      toW: 36,
      toH: 46,
      startMs: 1000,
      durationMs: 300,
    });
    const mid = sampleMahjongFlyAnim(anim, 1150);
    assert.ok(mid.y < 200);
    const end = sampleMahjongFlyAnim(anim, 1300);
    assert.equal(end.done, true);
    assert.ok(Math.abs(end.x - 100) < 2);
    assert.ok(Math.abs(end.y - 200) < 4);
  });

  it('飞行中的牌落地前不出现在槽位，三消等落地后再消', () => {
    const flight = createMahjongSlotFlight();
    launchMahjongSlotFlight(flight, [1, 1], fly(1, 1000));
    const actual: number[] = [];
    assert.deepEqual(mahjongSlotsForDisplay(actual, flight, 1100, appendTriple), [1, 1]);
    assert.deepEqual(mahjongSlotsForDisplay(actual, flight, 1300, appendTriple), []);
  });

  it('连点时按起飞顺序逐张落地', () => {
    const flight = createMahjongSlotFlight();
    launchMahjongSlotFlight(flight, [], fly(2, 1000));
    launchMahjongSlotFlight(flight, [2], fly(3, 1100));
    const actual = [2, 3];
    assert.deepEqual(mahjongSlotsForDisplay(actual, flight, 1050, appendTriple), []);
    assert.deepEqual(mahjongSlotsForDisplay(actual, flight, 1320, appendTriple), [2]);
    assert.equal(pruneMahjongSlotFlight(flight, 1320, appendTriple), true);
    assert.deepEqual(flight.baseSlots, [2]);
    assert.equal(pruneMahjongSlotFlight(flight, 1400, appendTriple), false);
    assert.deepEqual(mahjongSlotsForDisplay(actual, flight, 1400, appendTriple), actual);
  });

  it('落地回调携带三消信息', () => {
    const flight = createMahjongSlotFlight();
    launchMahjongSlotFlight(flight, [1, 1], fly(1, 1000));
    const lands: number[] = [];
    pruneMahjongSlotFlight(flight, 1300, appendTriple, (ev) => {
      lands.push(ev.removedCount);
    });
    assert.deepEqual(lands, [3]);
    assert.deepEqual(flight.baseSlots, []);
  });

  it('槽位被其它操作改动时直接显示真实槽位', () => {
    const flight = createMahjongSlotFlight();
    launchMahjongSlotFlight(flight, [4], fly(5, 1000));
    assert.deepEqual(mahjongSlotsForDisplay([], flight, 1100, appendTriple), []);
  });
});

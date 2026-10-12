export interface MahjongFlyAnim {
  type: number;
  fromX: number;
  fromY: number;
  fromW: number;
  fromH: number;
  fromRot: number;
  toX: number;
  toY: number;
  toW: number;
  toH: number;
  startMs: number;
  durationMs: number;
}

export interface MahjongFlySample {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  done: boolean;
}

/**
 * 一组连续飞向牌槽的牌：baseSlots 为最早一张未落地牌起飞前的槽位，
 * anims 按起飞顺序排列（时长相同，故按顺序落地）。
 */
export interface MahjongSlotFlight {
  baseSlots: number[];
  anims: MahjongFlyAnim[];
}

export type MahjongSlotAppendFn = (slots: readonly number[], tile: number) => number[];

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function createMahjongFlyAnim(params: Omit<MahjongFlyAnim, 'startMs' | 'durationMs'> & {
  startMs: number;
  durationMs?: number;
}): MahjongFlyAnim {
  return {
    ...params,
    durationMs: params.durationMs ?? 320,
  };
}

export function mahjongFlyAnimDone(anim: MahjongFlyAnim, nowMs: number): boolean {
  return nowMs - anim.startMs >= anim.durationMs;
}

export function sampleMahjongFlyAnim(anim: MahjongFlyAnim, nowMs: number): MahjongFlySample {
  const elapsed = nowMs - anim.startMs;
  const t = Math.min(1, Math.max(0, elapsed / anim.durationMs));
  const e = easeOutCubic(t);
  const arc = Math.sin(t * Math.PI) * Math.max(12, anim.fromH * 0.35);
  const pop = 1 + Math.sin(t * Math.PI) * 0.08;
  return {
    x: lerp(anim.fromX, anim.toX, e),
    y: lerp(anim.fromY, anim.toY, e) - arc,
    w: lerp(anim.fromW, anim.toW, e) * pop,
    h: lerp(anim.fromH, anim.toH, e) * pop,
    rot: lerp(anim.fromRot, 0, e),
    done: t >= 1,
  };
}

export function createMahjongSlotFlight(): MahjongSlotFlight {
  return { baseSlots: [], anims: [] };
}

export function resetMahjongSlotFlight(flight: MahjongSlotFlight): void {
  flight.baseSlots = [];
  flight.anims.length = 0;
}

/** 起飞一张牌；slotsBeforeTap 为本次点牌前的真实槽位。 */
export function launchMahjongSlotFlight(
  flight: MahjongSlotFlight,
  slotsBeforeTap: readonly number[],
  anim: MahjongFlyAnim,
): void {
  if (flight.anims.length === 0) {
    flight.baseSlots = slotsBeforeTap.slice();
  }
  flight.anims.push(anim);
}

/** 已落地的牌并入 baseSlots；返回是否仍有牌在飞。 */
export function pruneMahjongSlotFlight(
  flight: MahjongSlotFlight,
  nowMs: number,
  append: MahjongSlotAppendFn,
): boolean {
  while (flight.anims.length > 0 && mahjongFlyAnimDone(flight.anims[0]!, nowMs)) {
    flight.baseSlots = append(flight.baseSlots, flight.anims.shift()!.type);
  }
  return flight.anims.length > 0;
}

function sameSlots(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 槽位显示内容：飞行中的牌落地前不出现在槽里，三消也等落地后再消。
 * 若期间槽位被道具等改动（与推演结果对不上），直接显示真实槽位。
 */
export function mahjongSlotsForDisplay(
  actualSlots: readonly number[],
  flight: MahjongSlotFlight,
  nowMs: number,
  append: MahjongSlotAppendFn,
): readonly number[] {
  if (flight.anims.length === 0) {
    return actualSlots;
  }
  let predicted: readonly number[] = flight.baseSlots;
  for (const anim of flight.anims) {
    predicted = append(predicted, anim.type);
  }
  if (!sameSlots(predicted, actualSlots)) {
    return actualSlots;
  }
  let shown: readonly number[] = flight.baseSlots;
  for (const anim of flight.anims) {
    if (!mahjongFlyAnimDone(anim, nowMs)) {
      break;
    }
    shown = append(shown, anim.type);
  }
  return shown;
}

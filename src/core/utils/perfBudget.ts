/**
 * 轻量档粒子/列表上限，避免消除或粉碎时数组膨胀卡死。
 */

export function juiceSparkCount(cheapFx: boolean, waveIndex: number): number {
  const wave = Number.isFinite(waveIndex) ? Math.max(0, waveIndex) : 0;
  if (cheapFx) {
    return 3;
  }
  return 10 + Math.min(6, wave * 2);
}

export function crushSparkCount(cheapFx: boolean, cleared: number): number {
  const n = Number.isFinite(cleared) ? Math.max(0, cleared) : 0;
  if (cheapFx) {
    return Math.min(8, 4 + n);
  }
  return Math.min(28, 10 + n * 3);
}

export function cottonFluffCount(cheapFx: boolean): number {
  return cheapFx ? 4 : 14;
}

export function timedListCap(
  kind: 'bursts' | 'scores' | 'sparks',
  cheapFx: boolean,
): number {
  if (kind === 'bursts') {
    return cheapFx ? 8 : 24;
  }
  if (kind === 'scores') {
    return cheapFx ? 6 : 16;
  }
  return cheapFx ? 18 : 72;
}

export function compactTimed<T extends { startMs: number; durationMs: number }>(
  list: T[],
  now: number,
  cap: number,
): void {
  const nowMs = Number.isFinite(now) ? now : 0;
  const limit = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0;
  let write = 0;
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]!;
    if (nowMs - item.startMs < item.durationMs) {
      list[write] = item;
      write += 1;
    }
  }
  list.length = write;
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

/** 无操作且无环境动画时停画布，避免模拟器/微信主线程被拖死 */
export const IDLE_STOP_MS = 1800;
/**
 * 大厅呼吸、闪光、结算彩带需要一直转。
 * 空闲帧降到 80～90ms，不再用短超时把动效冻住。
 */
export const AMBIENT_IDLE_MS = Number.POSITIVE_INFINITY;
/**
 * 开发者工具：空闲窗口给长一点（动效播完再停），但**必须停**。
 * 之前这里返回 Infinity 让模拟器整屏重绘永不停止，主线程被占满，
 * 反而触发开发者工具的「长时间没有响应」看门狗。
 */
export const DESKTOP_IDLE_STOP_MS = 6000;
export const FRAME_ERROR_LIMIT = 3;

export function resolveRenderIdleStopMs(args: {
  desktopIde: boolean;
  ambientFx: boolean;
}): number {
  // 模拟器必须让出主线程：空闲先降帧，超时后彻底停循环重新等触摸。
  if (args.desktopIde) {
    return DESKTOP_IDLE_STOP_MS;
  }
  if (args.ambientFx) {
    return AMBIENT_IDLE_MS;
  }
  return IDLE_STOP_MS;
}

export function resolveNextFrameDelayMs(args: {
  animating: boolean;
  desktopIde: boolean;
  baseDelayMs: number;
}): number {
  const base =
    typeof args.baseDelayMs === 'number' && Number.isFinite(args.baseDelayMs)
      ? Math.max(16, args.baseDelayMs)
      : 33;
  if (args.animating) {
    return base;
  }
  // 空闲只降帧：呼吸/闪光仍连续，但不占满 30fps。
  return args.desktopIde ? Math.max(base, 80) : Math.max(base, 90);
}

/**
 * 有动画才继续转；空闲超过 idleStopMs 必须停循环。
 */
export function shouldKeepRenderLoop(args: {
  animating: boolean;
  lastInteractMs: number;
  nowMs: number;
  idleStopMs?: number;
}): boolean {
  if (args.animating) {
    return true;
  }
  const last = Number.isFinite(args.lastInteractMs) ? args.lastInteractMs : 0;
  const now = Number.isFinite(args.nowMs) ? args.nowMs : 0;
  const windowMs =
    typeof args.idleStopMs === 'number' && !Number.isNaN(args.idleStopMs)
      ? Math.max(0, args.idleStopMs)
      : IDLE_STOP_MS;
  if (!Number.isFinite(windowMs)) {
    return true;
  }
  return now - last < windowMs;
}

export function shouldBackoffAfterFrameErrors(errorCount: number): boolean {
  if (!Number.isFinite(errorCount) || errorCount < 0) {
    return false;
  }
  return errorCount >= FRAME_ERROR_LIMIT;
}

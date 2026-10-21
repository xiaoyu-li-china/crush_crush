/**
 * 关卡表现：开局横幅（第 N 关 + 目标）、中央提示横幅（目标达成 / 步数奖励 / 只剩 5 步）、
 * 目标块飞向 HUD、结算星星逐颗弹出。时间曲线是纯函数，画法集中在这里。
 */

export type LevelBannerKind =
  | 'intro'
  | 'goal'
  | 'bonus'
  | 'low_moves'
  | 'mahjong_intro'
  | 'mahjong_fail';

export interface LevelBanner {
  kind: LevelBannerKind;
  title: string;
  subtitle?: string;
  /** 还没开始时为 0，轮到它时才赋值 */
  startMs: number;
  durationMs: number;
}

export const BANNER_DURATION_MS: Record<LevelBannerKind, number> = {
  intro: 1500,
  goal: 1100,
  bonus: 1200,
  low_moves: 1100,
  mahjong_intro: 1500,
  mahjong_fail: 1400,
};

export function makeLevelBanner(
  kind: LevelBannerKind,
  title: string,
  subtitle?: string,
): LevelBanner {
  return { kind, title, subtitle, startMs: 0, durationMs: BANNER_DURATION_MS[kind] };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * 横幅：从左侧滑入带回弹，停留，再向右滑出。
 * offset 为相对屏宽的水平位移（-1 ~ 1）。
 */
export function bannerFrame(
  banner: LevelBanner,
  nowMs: number,
): { done: boolean; offset: number; alpha: number; scale: number; ribbon: number } {
  const elapsed = nowMs - banner.startMs;
  if (elapsed >= banner.durationMs) {
    return { done: true, offset: 1, alpha: 0, scale: 1, ribbon: 0 };
  }
  const t = clamp01(elapsed / banner.durationMs);
  const inEnd = 0.2;
  const outStart = 0.82;
  if (t < inEnd) {
    const u = t / inEnd;
    return {
      done: false,
      offset: -(1 - easeOutBack(u)),
      alpha: clamp01(u * 1.6),
      scale: 0.9 + 0.1 * u,
      ribbon: clamp01(u * 1.4),
    };
  }
  if (t > outStart) {
    const u = (t - outStart) / (1 - outStart);
    return {
      done: false,
      offset: u * u,
      alpha: 1 - u,
      scale: 1,
      ribbon: 1 - u,
    };
  }
  const holdPulse = 1 + 0.035 * Math.sin(nowMs * 0.012 + banner.startMs * 0.001);
  return { done: false, offset: 0, alpha: 1, scale: holdPulse, ribbon: 1 };
}

/** 横幅停留阶段的扫光带，0–1 表示在条带内的横向位置。 */
export function bannerShimmerPhase(banner: LevelBanner, nowMs: number): number {
  const elapsed = nowMs - banner.startMs;
  if (elapsed <= 0 || elapsed >= banner.durationMs) {
    return -1;
  }
  const t = clamp01(elapsed / banner.durationMs);
  if (t < 0.2 || t > 0.82) {
    return -1;
  }
  return ((elapsed * 0.00085) % 1.35) - 0.2;
}

export interface GoalFlyer {
  kind: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startMs: number;
  durationMs: number;
  size: number;
}

/** 本波里要飞向目标栏的格子（最多 max 个，平均挑，避免一大片同时飞糊成一团）。 */
export function planGoalFlyers<T extends { kind: number }>(
  cells: readonly T[],
  goalKind: number | undefined,
  max: number,
): T[] {
  if (goalKind === undefined) {
    return [];
  }
  const hits = cells.filter((cell) => cell.kind === goalKind);
  if (hits.length <= max) {
    return hits.slice();
  }
  const out: T[] = [];
  const step = hits.length / max;
  for (let i = 0; i < max; i += 1) {
    out.push(hits[Math.floor(i * step)]!);
  }
  return out;
}

/** 二次贝塞尔：先往上抛再落进目标栏，越接近终点越小。 */
export function flyerPoint(
  flyer: GoalFlyer,
  nowMs: number,
): { done: boolean; started: boolean; x: number; y: number; scale: number; alpha: number } {
  const elapsed = nowMs - flyer.startMs;
  if (elapsed < 0) {
    return { done: false, started: false, x: flyer.fromX, y: flyer.fromY, scale: 1, alpha: 0 };
  }
  if (elapsed >= flyer.durationMs) {
    return { done: true, started: true, x: flyer.toX, y: flyer.toY, scale: 0.5, alpha: 0 };
  }
  const t = easeInOutQuad(elapsed / flyer.durationMs);
  const midX = (flyer.fromX + flyer.toX) / 2 + (flyer.fromX < flyer.toX ? -30 : 30);
  const midY = Math.min(flyer.fromY, flyer.toY) - 60;
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return {
    done: false,
    started: true,
    x: a * flyer.fromX + b * midX + c * flyer.toX,
    y: a * flyer.fromY + b * midY + c * flyer.toY,
    scale: t < 0.15 ? 1 + t * 1.6 : 1.24 - 0.7 * t,
    alpha: t > 0.92 ? (1 - t) / 0.08 : 1,
  };
}

export const STAR_POP_DELAY_MS = 420;
export const STAR_POP_STEP_MS = 280;
export const STAR_POP_MS = 360;

/** 第 index 颗星（0 起）弹出进度：未到时间 visible=false。 */
export function starPopFrame(
  index: number,
  elapsedMs: number,
): { visible: boolean; scale: number; alpha: number; landed: boolean } {
  const start = STAR_POP_DELAY_MS + index * STAR_POP_STEP_MS;
  const local = elapsedMs - start;
  if (local < 0) {
    return { visible: false, scale: 0, alpha: 0, landed: false };
  }
  if (local >= STAR_POP_MS) {
    return { visible: true, scale: 1, alpha: 1, landed: true };
  }
  const u = local / STAR_POP_MS;
  return { visible: true, scale: 0.2 + 1.3 * easeOutBack(u) - 0.5 * u, alpha: clamp01(u * 2), landed: false };
}

/** 星星全部弹完所需时间（用于保持动画循环） */
export function starPopTotalMs(count: number): number {
  return STAR_POP_DELAY_MS + Math.max(0, count - 1) * STAR_POP_STEP_MS + STAR_POP_MS;
}

/** 五角星路径（以 cx, cy 为中心，r 为外半径） */
export function starPath(ctx: WxCanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const inner = r * 0.48;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rr = i % 2 === 0 ? r : inner;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

/** 糖果金星；filled=false 画成灰色空槽 */
export function drawCandyStar(
  ctx: WxCanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  filled: boolean,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  starPath(ctx, cx, cy + r * 0.08, r);
  ctx.fillStyle = 'rgba(90, 40, 70, 0.22)';
  ctx.fill();
  starPath(ctx, cx, cy, r);
  if (filled) {
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, '#fff3bf');
    g.addColorStop(0.45, '#ffd43b');
    g.addColorStop(1, '#f59f00');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = 'rgba(222, 226, 230, 0.95)';
  }
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.strokeStyle = filled ? '#ffffff' : 'rgba(255,255,255,0.9)';
  ctx.stroke();
  if (filled) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.22, cy - r * 0.28, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 横幅配色 */
export function bannerPalette(kind: LevelBannerKind): { top: string; bottom: string; ink: string; edge: string } {
  switch (kind) {
    case 'goal':
      return { top: '#b2f2bb', bottom: '#37b24d', ink: '#ffffff', edge: '#2b8a3e' };
    case 'bonus':
      return { top: '#ffe066', bottom: '#f76707', ink: '#ffffff', edge: '#d9480f' };
    case 'low_moves':
    case 'mahjong_fail':
      return { top: '#ffa8a8', bottom: '#e03131', ink: '#ffffff', edge: '#c92a2a' };
    case 'mahjong_intro':
    case 'intro':
    default:
      return { top: '#d0bfff', bottom: '#7048e8', ink: '#ffffff', edge: '#5f3dc4' };
  }
}

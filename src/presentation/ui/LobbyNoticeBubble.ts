/**
 * 首页公告泡泡：冷色软胶囊。
 * 轨迹乒乓：左下→右上→弹回左下→再向上，首页常驻循环。
 */
export const NOTICE_BUBBLE_HOLD_MS = 3400;
export const NOTICE_BUBBLE_FADE_MS = 480;
/** 单程（左下→右上，或弹回）时长 */
export const NOTICE_BUBBLE_DRIFT_MS = 6200;
/** @deprecated 乒乓循环不再两端淡隐 */
export const NOTICE_BUBBLE_EDGE_FADE = 0;

export interface NoticeBubbleFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  textX: number;
  textY: number;
  driftOpacity: number;
}

export interface NoticeBubbleCycle {
  index: number;
  opacity: number;
  nextIndex: number;
  nextOpacity: number;
}

export interface NoticeBubbleDrift {
  /** 0 左下 → 1 右上（弹回时从 1 回到 0） */
  progress: number;
  /** 是否正在上行（朝右上） */
  goingUp: boolean;
  opacity: number;
}

/** 去空、去重后的轮播文案；没有 bubbles 时用 body。 */
export function lobbyNoticeBubbleLines(input: {
  body?: string;
  bubbles?: ReadonlyArray<string>;
}): string[] {
  const raw =
    input.bubbles && input.bubbles.length > 0
      ? input.bubbles
      : input.body
        ? [input.body]
        : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const text = String(item ?? '').trim();
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    out.push(text);
  }
  return out;
}

/**
 * 按时间在文案间交叉淡入淡出。
 */
export function lobbyNoticeBubbleCycle(
  nowMs: number,
  lineCount: number,
  holdMs = NOTICE_BUBBLE_HOLD_MS,
  fadeMs = NOTICE_BUBBLE_FADE_MS,
): NoticeBubbleCycle {
  const n = Math.max(1, Math.floor(lineCount));
  if (n <= 1) {
    return { index: 0, opacity: 1, nextIndex: 0, nextOpacity: 0 };
  }
  const period = Math.max(1, holdMs + fadeMs);
  const t = ((Math.max(0, nowMs) % (period * n)) + period * n) % (period * n);
  const index = Math.floor(t / period) % n;
  const local = t - index * period;
  if (local < holdMs) {
    return { index, opacity: 1, nextIndex: (index + 1) % n, nextOpacity: 0 };
  }
  const u = Math.max(0, Math.min(1, (local - holdMs) / fadeMs));
  return {
    index,
    opacity: 1 - u,
    nextIndex: (index + 1) % n,
    nextOpacity: u,
  };
}

/**
 * 乒乓漂移：左下→右上→弹回左下→再向上，全程不淡出。
 */
export function lobbyNoticeBubbleDrift(
  nowMs: number,
  legMs = NOTICE_BUBBLE_DRIFT_MS,
): NoticeBubbleDrift {
  const leg = Math.max(1, legMs);
  const round = leg * 2;
  const clock = ((Math.max(0, nowMs) % round) + round) % round;
  if (clock < leg) {
    return { progress: clock / leg, goingUp: true, opacity: 1 };
  }
  return {
    progress: 1 - (clock - leg) / leg,
    goingUp: false,
    opacity: 1,
  };
}

function easeInOut(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  // 略掺线性，避免端点导数为 0 时像卡住
  const smooth = u * u * (3 - 2 * u);
  return u * 0.35 + smooth * 0.65;
}

/**
 * 沿对角线布局：progress=0 左下，progress=1 右上。
 */
export function layoutLobbyNoticeBubble(input: {
  width: number;
  height: number;
  statusBarHeight: number;
  /** 底栏顶边，泡泡左下锚点在其上方 */
  contentTop: number;
  progress: number;
  text: string;
  measureWidth: (text: string) => number;
}): NoticeBubbleFrame {
  const padX = 16;
  const maxW = Math.min(268, Math.floor(input.width * 0.7));
  const textW = Math.min(maxW - padX * 2, Math.ceil(input.measureWidth(input.text)));
  const w = Math.max(120, Math.min(maxW, textW + padX * 2));
  const h = 34;
  const t = easeInOut(input.progress);

  const startX = 10;
  const startY = Math.min(
    input.height - h - 24,
    Math.max(input.statusBarHeight + 80, input.contentTop - h - 18),
  );
  const endX = Math.max(startX, input.width - w - 12);
  const endY = Math.max(input.statusBarHeight + 50, 64);

  const x = startX + (endX - startX) * t;
  const y = startY + (endY - startY) * t;
  return {
    x,
    y,
    w,
    h,
    textX: x + w / 2,
    textY: y + h / 2,
    driftOpacity: 1,
  };
}

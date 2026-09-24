/**
 * 大厅选关地图：糖果梯云朵版。
 * 横向胶囊关卡条左右交替编号圆，由低向高连续滑动；底部固定风景，不靠整图底图顶替。
 */
import {
  LEVELS_PER_VINE_NODE,
  type VineNodeInfo,
} from '../../logic/level/LevelVine';
import noticeJson from '../../config/notice.json';

/** 关卡条高度占屏高（略矮，8 关更紧凑） */
export const LADDER_BAR_H_OF_HEIGHT = 0.042;
/** 关卡条宽度占屏宽（居中列，成块更易识别） */
export const LADDER_BAR_W_OF_WIDTH = 0.52;
/** 左右错位摆幅占屏宽（对齐设计稿之字梯） */
export const LADDER_ZIGZAG_OF_WIDTH = 0.055;
/**
 * 回退间距（无可用带宽时）。首屏实际步长由 lobbyLadderStepForBand 按带宽计算。
 * 切记：加大此值会减少可见关数（0.085 时真机只剩约 6 关）。
 */
export const LADDER_STEP_OF_HEIGHT = 0.06;
/** 编号圆相对条高的放大 */
export const LADDER_CIRCLE_OF_BAR = 1.12;
/** 关卡 1 在 camY=0 时相对屏底的抬高（再扣导航） */
export const LADDER_BOTTOM_PAD_OF_HEIGHT = 0.22;
/** 首屏目标可见关数 */
export const LOBBY_FIRST_SCREEN_LEVELS = 8;
/** 关卡列与底栏「推荐 / 圈子」之间的空隙 */
export const LOBBY_LADDER_BOTTOM_GAP = 10;
/** 关卡列顶边相对标题裁切线再内收（上方区域位置不变，仅微调） */
export const LOBBY_LADDER_TOP_INSET = 10;

/** 兼容旧导出：糖豆半径约等于编号圆半径 */
export const MACARON_RADIUS_OF_COVER = 30 / 576;
export const MACARON_SPRITE_FILL = 0.97;

/** 每座糖果屋对应关卡数（章末仍可点进，绘制与普通条一致） */
export const LEVELS_PER_CANDY_HOUSE = 20;

/** 树干提示条相对 cover 的中线位置（贴列表下方，不压关卡条） */
export const TREE_CAPTION_UY = 0.78;

export const LOBBY_TREE_PROMPT = '沿糖果梯子闯关，冲进糖果屋！';

export const LOBBY_MORE_LEVELS_HINT = '上滑闯关';
export const LOBBY_SWIPE_HINT_HOLD_MS = 3000;
export const LOBBY_SWIPE_HINT_FADE_MS = 480;

export const LOBBY_BRAND_TITLE = '萌宠粉碎消';
export const LOBBY_BRAND_SUBTITLE = '闯关消除 · 可爱小动物';
export const LOBBY_TITLE_UY = 92 / 1024;
/** 副标题略上移，避免贴到关卡条上沿 */
export const LOBBY_SUBTITLE_UY = 142 / 1024;

/** 已通关条配色：蓝 / 紫 / 绿轮换（对齐设计稿） */
export const LADDER_CLEARED_THEMES = [
  {
    barTop: '#9ad8f8',
    barBottom: '#5eb8ef',
    circleTop: '#7ec8f5',
    circleBottom: '#3aa0d8',
    stripe: 'rgba(255,255,255,0.22)',
    pattern: 'none' as const,
  },
  {
    barTop: '#d0bcfa',
    barBottom: '#9b7aef',
    circleTop: '#b9a0f5',
    circleBottom: '#7c5ce0',
    stripe: 'rgba(255,255,255,0.28)',
    pattern: 'stripe' as const,
  },
  {
    barTop: '#8eebc0',
    barBottom: '#4ecf8a',
    circleTop: '#6edc9e',
    circleBottom: '#2fb872',
    stripe: 'rgba(255,255,255,0.35)',
    pattern: 'sprinkle' as const,
  },
] as const;

export const LADDER_CURRENT_THEME = {
  barTop: '#ffc078',
  barBottom: '#f18a2c',
  circleTop: '#ffb056',
  circleBottom: '#ef7a1a',
  stripe: 'rgba(255,255,255,0.38)',
  pattern: 'stripe' as const,
  startTop: '#ff8f6b',
  startBottom: '#ff5c38',
} as const;

export const LADDER_LOCKED_THEME = {
  barTop: 'rgba(210, 224, 224, 0.78)',
  barBottom: 'rgba(180, 198, 200, 0.72)',
  circleTop: 'rgba(190, 205, 208, 0.92)',
  circleBottom: 'rgba(160, 178, 182, 0.9)',
  stripe: 'rgba(255,255,255,0.12)',
  pattern: 'none' as const,
} as const;

export function lobbyBrandAnchorY(
  cover: CoverRect,
  _camY: number,
  uy: number,
): number {
  return cover.dy + cover.dh * uy;
}

export interface LobbyMoreLevelsHintFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  chevronX: number;
  textX: number;
  cy: number;
}

export function layoutLobbyMoreLevelsHint(
  width: number,
  statusBarHeight: number,
  bobY = 0,
): LobbyMoreLevelsHintFrame {
  const h = 28;
  const r = h / 2;
  const w = 86;
  const y = Math.max(statusBarHeight + 56, 72) + bobY - h / 2;
  const x = width - w + 6;
  const cy = y + r;
  return {
    x,
    y,
    w,
    h,
    r,
    cy,
    chevronX: x + 16,
    textX: x + 48,
  };
}

export function lobbySwipeHintOpacity(
  shownAtMs: number,
  nowMs: number,
  dismissed: boolean,
): number {
  if (dismissed || shownAtMs <= 0) {
    return 0;
  }
  const elapsed = Math.max(0, nowMs - shownAtMs);
  if (elapsed < LOBBY_SWIPE_HINT_HOLD_MS) {
    return 1;
  }
  const t = (elapsed - LOBBY_SWIPE_HINT_HOLD_MS) / LOBBY_SWIPE_HINT_FADE_MS;
  return Math.max(0, 1 - t);
}

/** @deprecated 梯子布局不再使用云层槽位 */
export const CLOUD_PAGE_SLOTS: ReadonlyArray<
  ReadonlyArray<{ ux: number; uy: number }>
> = [
  [
    { ux: 0.33, uy: 0.243 },
    { ux: 0.58, uy: 0.199 },
    { ux: 0.39, uy: 0.338 },
    { ux: 0.69, uy: 0.407 },
    { ux: 0.51, uy: 0.485 },
  ],
];

/** @deprecated */
export const TREE_MACARON_SLOTS: Array<{ ux: number; uy: number }> = [
  { ux: 0.5, uy: 0.78 },
  { ux: 0.32, uy: 0.7 },
  { ux: 0.68, uy: 0.62 },
  { ux: 0.36, uy: 0.54 },
  { ux: 0.64, uy: 0.46 },
];

export function cloudLevelSlots(
  nodeIndex: number,
): ReadonlyArray<{ ux: number; uy: number }> {
  const page = Math.max(0, nodeIndex - 1);
  return CLOUD_PAGE_SLOTS[page % CLOUD_PAGE_SLOTS.length]!;
}

export type LobbyNodeKind = 'ladder' | 'candy-house';
export type LobbyCircleSide = 'left' | 'right';

export interface LobbyLevelNode {
  levelId: number;
  nodeIndex: number;
  slotIndex: number;
  /** 编号圆中心 */
  x: number;
  y: number;
  hitR: number;
  kind: LobbyNodeKind;
  barX: number;
  barY: number;
  barW: number;
  barH: number;
  circleSide: LobbyCircleSide;
  circleR: number;
}

export interface CoverRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export function lobbyLadderStep(height: number, ladderStep?: number): number {
  if (typeof ladderStep === 'number' && Number.isFinite(ladderStep) && ladderStep > 0) {
    return ladderStep;
  }
  return Math.max(40, height * LADDER_STEP_OF_HEIGHT);
}

/**
 * 按标题区～底栏可用高度，算出首屏刚好约 N 关的中心间距。
 * band = ladderBottomY - hideAboveY（已扣底栏空隙与顶内收）。
 */
export function lobbyLadderStepForBand(
  bandHeight: number,
  barH = 36,
  levels = LOBBY_FIRST_SCREEN_LEVELS,
): number {
  const gaps = Math.max(1, levels - 1);
  const band = Math.max(1, bandHeight);
  // +0.15*barH 对准裁切线；再减 1px 避开浮点把第 N 关刚好裁掉
  return Math.max(barH + 6, (band + barH * 0.15) / gaps - 1);
}

/** 首屏关卡列：底栏留白 + 顶内收后的底边与步长。 */
export function lobbyFirstScreenLadderLayout(args: {
  bandTop: number;
  contentTop: number;
  barH: number;
  bottomGap?: number;
  topInset?: number;
  levels?: number;
}): { ceiling: number; step: number; bandTop: number } {
  const bottomGap = args.bottomGap ?? LOBBY_LADDER_BOTTOM_GAP;
  const topInset = args.topInset ?? LOBBY_LADDER_TOP_INSET;
  const levels = args.levels ?? LOBBY_FIRST_SCREEN_LEVELS;
  // 第 1 关中心：底栏上方留出空隙，再扣半条高，避免条底贴按钮
  const ceiling = args.contentTop - bottomGap - args.barH * 0.5;
  const clipTop = args.bandTop + topInset;
  const step = lobbyLadderStepForBand(
    Math.max(1, ceiling - clipTop),
    args.barH,
    levels,
  );
  return { ceiling, step, bandTop: clipTop };
}

export function lobbyBarSize(width: number, height: number): { w: number; h: number } {
  return {
    w: Math.min(width * LADDER_BAR_W_OF_WIDTH, width - 72),
    h: Math.max(32, height * LADDER_BAR_H_OF_HEIGHT),
  };
}

export function isCandyHouseLevel(levelId: number): boolean {
  return levelId > 0 && levelId % LEVELS_PER_CANDY_HOUSE === 0;
}

/**
 * 奇数关编号圆在右，偶数关在左（对齐设计稿 7 右 / 8 左）。
 */
export function lobbyCircleSide(levelId: number): LobbyCircleSide {
  return levelId % 2 === 1 ? 'right' : 'left';
}

/**
 * 关卡在梯子上的归一化坐标：ux 为条中心；uy 向上累加。
 */
export function lobbyLadderSlot(levelId: number): { ux: number; uy: number } {
  const i = Math.max(0, levelId - 1);
  const side = lobbyCircleSide(levelId);
  const ux = side === 'left' ? 0.5 - LADDER_ZIGZAG_OF_WIDTH : 0.5 + LADDER_ZIGZAG_OF_WIDTH;
  return { ux, uy: i };
}

export function lobbyPageHeight(height: number): number {
  return Math.max(1, height);
}

export function lobbyPageIndex(camY: number, height: number): number {
  const pageH = lobbyPageHeight(height);
  return Math.max(0, Math.round(camY / pageH));
}

export const LOBBY_SNAP_MS = 220;

export function lobbySnapEase(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const inv = 1 - u;
  return 1 - inv * inv * inv * inv;
}

export function lobbySnapCamY(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs = LOBBY_SNAP_MS,
): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) {
    return to;
  }
  if (elapsedMs <= 0) {
    return from;
  }
  return from + (to - from) * lobbySnapEase(elapsedMs / durationMs);
}

export function lobbyPageOriginY(_page: number, _camY: number, _height: number): number {
  return 0;
}

export function isLobbyNodeExposed(
  node: LobbyLevelNode,
  _camY: number,
  _height: number,
  hideBelowY?: number,
  hideAboveY?: number,
): boolean {
  if (
    typeof hideBelowY === 'number' &&
    Number.isFinite(hideBelowY) &&
    node.barY + node.barH * 0.35 > hideBelowY
  ) {
    return false;
  }
  if (
    typeof hideAboveY === 'number' &&
    Number.isFinite(hideAboveY) &&
    node.barY + node.barH * 0.65 < hideAboveY
  ) {
    return false;
  }
  return true;
}

/** 关卡列表顶边：标题区下方；首屏裁在第 8 关之上。 */
export function lobbyLevelBandTop(
  cover: CoverRect,
  statusBarHeight: number,
): number {
  const subY = lobbyBrandAnchorY(cover, 0, LOBBY_SUBTITLE_UY);
  // 副标题 +「20关后…」下方留空隙，避免和第 8 关挤在一起
  const titleFloor = subY + Math.max(96, cover.dh * 0.105);
  return Math.max(statusBarHeight + 84, titleFloor);
}

export function lobbyCameraTarget(
  levelOrNode: number,
  height: number,
  ladderStep?: number,
): number {
  const step = lobbyLadderStep(height, ladderStep);
  const level = Math.max(1, levelOrNode);
  const focus = Math.max(0, level - 1) * step;
  return Math.max(0, focus - height * 0.28);
}

export function lobbyCameraMax(
  totalLevels: number,
  height: number,
  ladderStep?: number,
): number {
  const step = lobbyLadderStep(height, ladderStep);
  const levels = Math.max(1, totalLevels);
  return Math.max(0, (levels - 1) * step + step * 2.4);
}

export function lobbyMaxPageIndex(totalLevels: number): number {
  const h = 800;
  const maxCam = lobbyCameraMax(totalLevels, h);
  return Math.max(0, Math.round(maxCam / h));
}

export function lobbyComingSoonLine(_page = 0, _totalLevels = 0): string {
  return noticeJson.body;
}

export function lobbyLayerHeight(height: number): number {
  return lobbyPageHeight(height);
}

export function lobbyCamFromDrag(
  camStart: number,
  dragDy: number,
  min: number,
  max: number,
  extra = 48,
): number {
  const raw = camStart - dragDy;
  return Math.max(min - extra, Math.min(max + extra, raw));
}

export function lobbySnapTarget(
  camStart: number,
  camNow: number,
  height: number,
  maxCamOrPage: number,
  velY: number,
  ladderStep?: number,
): number {
  const pageH = lobbyPageHeight(height);
  const maxCam =
    maxCamOrPage > pageH * 1.5
      ? maxCamOrPage
      : Math.max(0, maxCamOrPage) * pageH;
  const step = lobbyLadderStep(height, ladderStep);
  const delta = camNow - camStart;
  let target = camNow;
  if (Math.abs(velY) <= 0.35 && Math.abs(delta) < pageH * 0.12) {
    target = Math.round(camStart / step) * step;
  } else if (velY > 0.35 || delta > pageH * 0.12) {
    target = camNow + Math.min(pageH * 0.55, 120 + Math.abs(velY) * 180);
    target = Math.round(target / step) * step;
  } else if (velY < -0.35 || delta < -pageH * 0.12) {
    target = camNow - Math.min(pageH * 0.55, 120 + Math.abs(velY) * 180);
    target = Math.round(target / step) * step;
  } else {
    target = Math.round(target / step) * step;
  }
  return Math.max(0, Math.min(maxCam, target));
}

export function lobbyMacaronRadius(coverDw: number): number {
  return coverDw * MACARON_RADIUS_OF_COVER;
}

export function lobbyHouseRadius(coverDw: number): number {
  return lobbyMacaronRadius(coverDw) * 1.55;
}

/**
 * 糖果梯云朵版：横向胶囊条左右交替，低关在下、高关在上。
 */
export function layoutLobbyLevelNodes(args: {
  vines: VineNodeInfo[];
  cover: CoverRect;
  width: number;
  height: number;
  camY: number;
  cloudCover?: CoverRect;
  maxCloudCenterY?: number;
  ladderBottomY?: number;
  /** 显式步长（首屏按带宽算好后传入，保证与相机一致） */
  ladderStep?: number;
}): LobbyLevelNode[] {
  const { vines, width, height, camY } = args;
  const { w: barW, h: barH } = lobbyBarSize(width, height);
  const circleR = (barH * LADDER_CIRCLE_OF_BAR) / 2;
  const step = lobbyLadderStep(height, args.ladderStep);
  const bottom =
    typeof args.ladderBottomY === 'number' && Number.isFinite(args.ladderBottomY)
      ? args.ladderBottomY
      : typeof args.maxCloudCenterY === 'number' && Number.isFinite(args.maxCloudCenterY)
        ? args.maxCloudCenterY
        : height * (1 - LADDER_BOTTOM_PAD_OF_HEIGHT);

  const levelIds: number[] = [];
  for (const vine of vines) {
    for (const id of vine.levelIds) {
      levelIds.push(id);
    }
  }
  levelIds.sort((a, b) => a - b);

  const baseX = (width - barW) / 2;
  const zigzag = width * LADDER_ZIGZAG_OF_WIDTH;
  const out: LobbyLevelNode[] = [];
  for (const levelId of levelIds) {
    const slot = lobbyLadderSlot(levelId);
    const house = isCandyHouseLevel(levelId);
    const side = lobbyCircleSide(levelId);
    const cy = bottom - slot.uy * step + camY;
    const barY = cy - barH / 2;
    const barX = side === 'left' ? baseX - zigzag : baseX + zigzag;
    const circleX =
      side === 'left' ? barX + circleR * 0.15 + circleR * 0.55 : barX + barW - circleR * 0.15 - circleR * 0.55;
    const nodeIndex = Math.floor((levelId - 1) / LEVELS_PER_VINE_NODE);
    const slotIndex = (levelId - 1) % LEVELS_PER_VINE_NODE;
    out.push({
      levelId,
      nodeIndex,
      slotIndex,
      x: circleX,
      y: cy,
      hitR: circleR,
      kind: house ? 'candy-house' : 'ladder',
      barX,
      barY,
      barW,
      barH,
      circleSide: side,
      circleR,
    });
  }
  return out;
}

/** 关卡整条可点热区：含数字圆与条尾云朵外扩。 */
export function lobbyLevelHitRect(node: LobbyLevelNode): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const sidePad = Math.max(18, node.circleR * 1.05);
  const vertPad = Math.max(6, node.circleR - node.barH * 0.5 + 4);
  return {
    x: node.barX - sidePad,
    y: node.barY - vertPad,
    w: node.barW + sidePad * 2,
    h: node.barH + vertPad * 2,
  };
}
export function lobbyCloudDecorPoints(
  nodes: ReadonlyArray<LobbyLevelNode>,
  height: number,
  pad = 80,
): Array<{ x: number; y: number; side: LobbyCircleSide; circleR: number }> {
  return nodes
    .filter((n) => n.y > -pad && n.y < height + pad)
    .map((n) => {
      // 数字在左 → 云朵在右尾；数字在右 → 云朵在左尾
      const x =
        n.circleSide === 'left'
          ? n.barX + n.barW - n.circleR * 0.35
          : n.barX + n.circleR * 0.35;
      return {
        x,
        y: n.y + n.circleR * 0.08,
        side: n.circleSide,
        circleR: n.circleR,
      };
    });
}

/** 列表左右两侧糖点轨：贴编号糖果外侧，竖向连接上下关。 */
export function lobbyLadderSideTrailPoints(
  nodes: ReadonlyArray<LobbyLevelNode>,
  height: number,
  pad = 100,
): Array<{ x: number; y: number; r: number; tone: 'white' | 'cream' }> {
  const sorted = nodes
    .filter((n) => n.y > -pad && n.y < height + pad)
    .slice()
    .sort((a, b) => a.levelId - b.levelId);
  if (sorted.length < 2) {
    return [];
  }
  const leftXs = sorted.filter((n) => n.circleSide === 'left').map((n) => n.x);
  const rightXs = sorted.filter((n) => n.circleSide === 'right').map((n) => n.x);
  const leftX =
    leftXs.length > 0
      ? leftXs.reduce((s, v) => s + v, 0) / leftXs.length
      : Math.min(...sorted.map((n) => n.barX)) - 10;
  const rightX =
    rightXs.length > 0
      ? rightXs.reduce((s, v) => s + v, 0) / rightXs.length
      : Math.max(...sorted.map((n) => n.barX + n.barW)) + 10;
  const out: Array<{ x: number; y: number; r: number; tone: 'white' | 'cream' }> = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const dy = b.y - a.y;
    const spots = [
      { t: 0.32, r: 4.2 },
      { t: 0.55, r: 2.7 },
      { t: 0.72, r: 3.4 },
    ];
    for (let s = 0; s < spots.length; s += 1) {
      const spot = spots[s]!;
      const y = a.y + dy * spot.t;
      if (y < -24 || y > height + 24) {
        continue;
      }
      const tone: 'white' | 'cream' = (i + s) % 2 === 0 ? 'white' : 'cream';
      out.push({ x: leftX, y, r: spot.r, tone });
      out.push({ x: rightX, y, r: spot.r, tone });
    }
  }
  return out;
}

export function lobbyLadderPathPoints(
  nodes: ReadonlyArray<LobbyLevelNode>,
  height: number,
  pad = 100,
): Array<{ x: number; y: number; levelId: number }> {
  return nodes
    .filter((n) => n.y > -pad && n.y < height + pad)
    .slice()
    .sort((a, b) => a.levelId - b.levelId)
    .map((n) => ({ x: n.x, y: n.y, levelId: n.levelId }));
}

export function isLobbyNodeOnScreen(
  node: LobbyLevelNode,
  height: number,
  pad = 72,
): boolean {
  return node.barY + node.barH > -pad && node.barY < height + pad;
}

export function lobbyPageCaption(page: number, totalLevels = 0): string {
  if (page <= 0) {
    return '';
  }
  const start = page * LEVELS_PER_VINE_NODE + 1;
  const rawEnd = start + LEVELS_PER_VINE_NODE - 1;
  const end = totalLevels > 0 ? Math.min(totalLevels, rawEnd) : rawEnd;
  if (start > end) {
    return '';
  }
  const chapter = Math.ceil(end / LEVELS_PER_CANDY_HOUSE);
  if (isCandyHouseLevel(end) || end === totalLevels) {
    return `第 ${chapter} 座糖果屋 · ${start}-${end} 关`;
  }
  if (start === end) {
    return `第 ${start} 关`;
  }
  return `糖果梯子 · 第 ${start}-${end} 关`;
}

export function lobbyCaptionY(
  cover: CoverRect,
  camY: number,
  height: number,
  page: number,
): number {
  if (page <= 0) {
    return cover.dy + cover.dh * TREE_CAPTION_UY + camY * 0.15;
  }
  return height * 0.16;
}

export function ladderThemeForLevel(
  levelId: number,
  state: 'cleared' | 'current' | 'locked',
): typeof LADDER_CURRENT_THEME | (typeof LADDER_CLEARED_THEMES)[number] | typeof LADDER_LOCKED_THEME {
  if (state === 'current') {
    return LADDER_CURRENT_THEME;
  }
  if (state === 'locked') {
    return LADDER_LOCKED_THEME;
  }
  return LADDER_CLEARED_THEMES[(levelId - 1) % LADDER_CLEARED_THEMES.length]!;
}

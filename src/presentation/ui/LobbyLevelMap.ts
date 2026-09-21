/**
 * 大厅选关地图：第 1 屏糖果树 1-5；其后每屏一朵糖果云，每 5 关一页。
 * 页数跟配置表总关数走，加关会自动多一屏。
 */
import {
  LEVELS_PER_VINE_NODE,
  vineNodeCount,
  type VineNodeInfo,
} from '../../logic/level/LevelVine';
import noticeJson from '../../config/notice.json';

/** lobby.jpg 里 1–5 关马卡龙可见半径（约 62px / 576） */
export const MACARON_RADIUS_OF_COVER = 62 / 576;

/** PNG 可见饼直径约占整图，绘制时按此放大，让云层马卡龙和树上底图一样大 */
export const MACARON_SPRITE_FILL = 0.97;

/** 树冠马卡龙 UV（相对 lobby.jpg cover） */
export const TREE_MACARON_SLOTS: Array<{ ux: number; uy: number }> = [
  { ux: 0.205, uy: 0.39 },
  { ux: 0.485, uy: 0.315 },
  { ux: 0.49, uy: 0.42 },
  { ux: 0.47, uy: 0.55 },
  { ux: 0.785, uy: 0.47 },
];

/** 底图「点树上关卡开始挑战」相对 cover 的位置 */
export const TREE_CAPTION_UY = 0.645;

/**
 * 云层关卡槽：一朵薄荷漩涡一颗马卡龙。
 * 0 = 6-10（S 云），1 = 11-15（S 云），2 = 16-20（心形云）；再往后循环。
 * UV 相对 720×1280 云图 cover。
 */
export const CLOUD_PAGE_SLOTS: ReadonlyArray<
  ReadonlyArray<{ ux: number; uy: number }>
> = [
  [
    { ux: 0.33, uy: 0.28 },
    { ux: 0.58, uy: 0.23 },
    { ux: 0.39, uy: 0.39 },
    { ux: 0.69, uy: 0.47 },
    { ux: 0.51, uy: 0.56 },
  ],
  [
    { ux: 0.56, uy: 0.26 },
    { ux: 0.33, uy: 0.34 },
    { ux: 0.65, uy: 0.41 },
    { ux: 0.68, uy: 0.52 },
    { ux: 0.47, uy: 0.58 },
  ],
  [
    { ux: 0.375, uy: 0.31 },
    { ux: 0.625, uy: 0.31 },
    { ux: 0.35, uy: 0.43 },
    { ux: 0.67, uy: 0.43 },
    { ux: 0.5, uy: 0.52 },
  ],
];

export function cloudLevelSlots(
  nodeIndex: number,
): ReadonlyArray<{ ux: number; uy: number }> {
  const page = Math.max(0, nodeIndex - 1);
  return CLOUD_PAGE_SLOTS[page % CLOUD_PAGE_SLOTS.length]!;
}

export type LobbyNodeKind = 'tree' | 'candy-cloud';

export interface LobbyLevelNode {
  levelId: number;
  nodeIndex: number;
  slotIndex: number;
  x: number;
  y: number;
  hitR: number;
  kind: LobbyNodeKind;
}

export interface CoverRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export function lobbyPageHeight(height: number): number {
  return Math.max(1, height);
}

export function lobbyPageIndex(camY: number, height: number): number {
  const pageH = lobbyPageHeight(height);
  return Math.max(0, Math.round(camY / pageH));
}

/** 松手翻页动画时长：快起快停，避免停在两页中间的天空带 */
export const LOBBY_SNAP_MS = 200;

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

/**
 * 翻页位移：当前页往下撤，下一页停在屏幕里被揭开，
 * 这样先露出云图上半的糖果山，而不是底部那条空天空。
 */
export function lobbyPageOriginY(page: number, camY: number, height: number): number {
  const h = Math.max(1, height);
  const current = camY / h;
  if (page <= current) {
    return camY - page * h;
  }
  if (page <= current + 1) {
    return 0;
  }
  return camY - page * h;
}

/**
 * 被上一页挡住的关卡不绘制、不可点。
 * 下一页只露出揭开带里的整颗马卡龙，避免和当前页叠在一起。
 */
export function isLobbyNodeExposed(
  node: LobbyLevelNode,
  camY: number,
  height: number,
  hideBelowY?: number,
): boolean {
  const h = Math.max(1, height);
  const front = Math.max(0, Math.floor(camY / h + 1e-4));
  if (node.nodeIndex < front) {
    return false;
  }
  if (
    typeof hideBelowY === 'number' &&
    Number.isFinite(hideBelowY) &&
    node.y - node.hitR * 0.15 > hideBelowY
  ) {
    return false;
  }
  if (node.nodeIndex === front) {
    return true;
  }
  if (node.nodeIndex === front + 1) {
    const reveal = camY - front * h;
    return node.y + node.hitR * 0.55 < reveal;
  }
  return false;
}

/**
 * 当前段对应的整屏相机位置（仅用于计算页高，进大厅不自动跳页）。
 */
export function lobbyCameraTarget(nodeIndex: number, height: number): number {
  return lobbyCameraMax(nodeIndex, height);
}

/** 指定段对应的整屏相机上限。 */
export function lobbyCameraMax(maxNodeIndex: number, height: number): number {
  return Math.max(0, maxNodeIndex) * lobbyPageHeight(height);
}

/** 总关数对应的最后一页下标（0 = 树屏）。 */
export function lobbyMaxPageIndex(totalLevels: number): number {
  return Math.max(0, vineNodeCount(totalLevels) - 1);
}

/** 最后一屏预告：当前关卡之后还有新玩法。 */
export function lobbyComingSoonLine(page: number, totalLevels: number): string {
  if (totalLevels <= 0 || page !== lobbyMaxPageIndex(totalLevels)) {
    return '';
  }
  return noticeJson.body;
}

export function lobbyLayerHeight(height: number): number {
  return lobbyPageHeight(height);
}

/**
 * 跟手拖动：手指上滑看云朵（camY 增大），下滑回树上。
 */
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

/**
 * 松手后吸附到整页：上滑过半屏 / 有速度则进下一屏。
 */
export function lobbySnapTarget(
  camStart: number,
  camNow: number,
  height: number,
  maxPage: number,
  velY: number,
): number {
  const pageH = lobbyPageHeight(height);
  const startPage = Math.round(camStart / pageH);
  const delta = camNow - camStart;
  let page = startPage;
  if (velY > 0.42 || delta > pageH * 0.18) {
    page = startPage + 1;
  } else if (velY < -0.42 || delta < -pageH * 0.18) {
    page = startPage - 1;
  }
  page = Math.max(0, Math.min(maxPage, page));
  return page * pageH;
}

/**
 * 把已解锁的藤蔓段摆到树上 / 糖果云上。
 */
export function lobbyMacaronRadius(coverDw: number): number {
  return coverDw * MACARON_RADIUS_OF_COVER;
}

export function layoutLobbyLevelNodes(args: {
  vines: VineNodeInfo[];
  cover: CoverRect;
  width: number;
  height: number;
  camY: number;
  cloudCover?: CoverRect;
  /** 云层整页上移，让最低一颗仍在按钮 / 每日提示之上；滑动时整页一起走，不再单颗压底 */
  maxCloudCenterY?: number;
}): LobbyLevelNode[] {
  const { vines, cover, width, height, camY } = args;
  const macaronR = lobbyMacaronRadius(cover.dw);
  const cloudCover =
    args.cloudCover ?? { dx: 0, dy: 0, dw: width, dh: height };
  const out: LobbyLevelNode[] = [];

  for (const vine of vines) {
    const lift =
      vine.nodeIndex === 0
        ? 0
        : cloudPageLiftY(vine.nodeIndex, cloudCover, args.maxCloudCenterY);
    for (const levelId of vine.levelIds) {
      const slotIndex = levelId - vine.startLevelId;
      if (vine.nodeIndex === 0) {
        const slot = TREE_MACARON_SLOTS[slotIndex];
        if (!slot) {
          continue;
        }
        out.push({
          levelId,
          nodeIndex: 0,
          slotIndex,
          x: cover.dx + cover.dw * slot.ux,
          y: cover.dy + cover.dh * slot.uy + lobbyPageOriginY(0, camY, height),
          hitR: macaronR,
          kind: 'tree',
        });
        continue;
      }
      const slot = cloudLevelSlots(vine.nodeIndex)[slotIndex];
      if (!slot) {
        continue;
      }
      out.push({
        levelId,
        nodeIndex: vine.nodeIndex,
        slotIndex,
        x: cloudCover.dx + cloudCover.dw * slot.ux,
        y:
          cloudCover.dy +
          cloudCover.dh * slot.uy -
          lift +
          lobbyPageOriginY(vine.nodeIndex, camY, height),
        hitR: macaronR,
        kind: 'candy-cloud',
      });
    }
  }
  return out;
}

function cloudPageLiftY(
  nodeIndex: number,
  cloudCover: CoverRect,
  maxCloudCenterY?: number,
): number {
  if (typeof maxCloudCenterY !== 'number' || !Number.isFinite(maxCloudCenterY)) {
    return 0;
  }
  let lowest = Number.NEGATIVE_INFINITY;
  for (const slot of cloudLevelSlots(nodeIndex)) {
    lowest = Math.max(lowest, cloudCover.dy + cloudCover.dh * slot.uy);
  }
  return lowest > maxCloudCenterY ? lowest - maxCloudCenterY : 0;
}

export function isLobbyNodeOnScreen(
  node: LobbyLevelNode,
  height: number,
  pad = 72,
): boolean {
  return node.y > -pad && node.y < height + pad;
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
  if (start === end) {
    return `第 ${start} 关`;
  }
  return `第 ${start}-${end} 关`;
}

/** 大厅提示贴在树干标语位置；翻页后跟当前屏走。 */
export function lobbyCaptionY(
  cover: CoverRect,
  camY: number,
  height: number,
  page: number,
): number {
  if (page <= 0) {
    return cover.dy + cover.dh * TREE_CAPTION_UY + lobbyPageOriginY(0, camY, height);
  }
  return height * TREE_CAPTION_UY + lobbyPageOriginY(page, camY, height);
}

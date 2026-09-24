/**
 * 好友排行面板：排名、头像、昵称、邀请码、关卡。
 * 标题/奖励固定，玩家列表在视口内可滑动。
 */
import type { LeaderboardLine } from '../../logic/economy/FriendLeaderboard';
import noticeJson from '../../config/notice.json';
import { panelCloseButton, type CanvasButtonSpec } from './PanelChrome';

export interface LeaderboardPanelLayout {
  panel: { x: number; y: number; w: number; h: number };
  title: string;
  /** 固定在顶部的提示 / 奖励行 */
  headerRows: LeaderboardLine[];
  /** 可滑动的玩家行 */
  playerRows: LeaderboardLine[];
  textWidth: number;
  tagX: number;
  avatarX: number;
  avatarR: number;
  textX: number;
  scoreX: number;
  bodyTop: number;
  bodyBottom: number;
  /** 可滑动列表视口 */
  listTop: number;
  listBottom: number;
  listViewportH: number;
  /** 玩家列表内容总高度（不含视口裁剪） */
  listContentH: number;
  rowH: number;
  metaRowH: number;
  buttons: CanvasButtonSpec[];
}

const PLAYER_ROW_H = 52;
const PLAYER_ROW_GAP = 6;
const META_ROW_H = 28;
const AVATAR_R = 16;
/** 弹窗内大约可见的玩家行数（含间距），超出可滑 */
const VISIBLE_PLAYER_ROWS = 4;

export function playerRowStride(): number {
  return PLAYER_ROW_H + PLAYER_ROW_GAP;
}

export function layoutLeaderboardPanel(input: {
  width: number;
  height: number;
  hint: string;
  rewardText: string;
  rows: LeaderboardLine[];
  wrap: (text: string, maxWidth: number) => string[];
}): LeaderboardPanelLayout {
  const panelW = Math.min(360, input.width - 24);
  const padX = 14;
  const tagW = 28;
  const avatarGap = 10;
  const scoreColW = 56;

  const headerRows: LeaderboardLine[] = [];
  if (input.hint) {
    headerRows.push({ tag: '提醒', text: input.hint, kind: 'meta' });
  }
  if (input.rewardText) {
    headerRows.push({ tag: '', text: input.rewardText, kind: 'reward' });
  }

  let playerRows: LeaderboardLine[] = [];
  if (input.rows.length > 0) {
    playerRows = input.rows.map((row) => ({
      ...row,
      kind: row.kind ?? (row.nickName || row.score != null ? 'player' : 'meta'),
    }));
  } else {
    headerRows.push({
      tag: '提示',
      text: noticeJson.leaderboard?.unavailable ?? '好友排行暂时打不开',
      kind: 'meta',
    });
  }

  const avatarR = AVATAR_R;
  const textWidth = panelW - padX * 2 - tagW - avatarGap - avatarR * 2 - avatarGap - scoreColW;

  let headerH = 8;
  for (const row of headerRows) {
    if (row.kind === 'reward') {
      headerH += Math.max(META_ROW_H, input.wrap(row.text, panelW - padX * 2).length * 16 + 8) + 6;
    } else {
      headerH += Math.max(META_ROW_H, input.wrap(row.text, textWidth + scoreColW).length * 16 + 10) + 6;
    }
  }

  const listContentH = playerRows.length > 0
    ? playerRows.length * playerRowStride()
    : 0;
  const listViewportH = Math.min(
    listContentH || playerRowStride(),
    VISIBLE_PLAYER_ROWS * playerRowStride(),
  );

  const titleH = 46;
  const footH = 20;
  const desiredH = titleH + headerH + listViewportH + footH;
  const panelH = Math.min(input.height * 0.88, Math.max(desiredH, titleH + footH + 80));
  const x = (input.width - panelW) / 2;
  const y = Math.max(12, (input.height - panelH) / 2);
  const tagX = x + padX;
  const avatarX = tagX + tagW + avatarGap + avatarR;
  const textX = avatarX + avatarR + avatarGap;
  const scoreX = x + panelW - padX;
  const bodyTop = y + titleH;
  const bodyBottom = y + panelH - footH;
  const listTop = bodyTop + headerH;
  const listBottom = bodyBottom;
  const fittedViewportH = Math.max(0, listBottom - listTop);

  return {
    panel: { x, y, w: panelW, h: panelH },
    title: noticeJson.leaderboard?.title ?? '好友排行',
    headerRows,
    playerRows,
    textWidth: Math.max(80, textWidth),
    tagX,
    avatarX,
    avatarR,
    textX,
    scoreX,
    bodyTop,
    bodyBottom,
    listTop,
    listBottom,
    listViewportH: fittedViewportH,
    listContentH,
    rowH: PLAYER_ROW_H,
    metaRowH: META_ROW_H,
    buttons: [panelCloseButton({ x, y, w: panelW })],
  };
}

export function clampLeaderboardScroll(scrollY: number, layout: LeaderboardPanelLayout): number {
  const maxScroll = Math.max(0, layout.listContentH - layout.listViewportH);
  if (!Number.isFinite(scrollY) || scrollY < 0) {
    return 0;
  }
  if (scrollY > maxScroll) {
    return maxScroll;
  }
  return scrollY;
}

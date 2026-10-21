/**
 * 排行面板：标题、关卡榜/本周榜切换、规则与结算说明、可滑动名单、底部固定的「我的排名」、邀请按钮。
 * 只算位置，不画。
 */
import type { LeaderboardLine, LeaderboardTab, LeaderboardTabId } from '../../logic/economy/FriendLeaderboard';
import { leaderboardRewardTierLines } from '../../logic/economy/FriendLeaderboard';
import noticeJson from '../../config/notice.json';
import { panelCloseButton } from './PanelChrome';

export interface LeaderboardPanelButton {
  id: 'resume' | 'lb_tab_level' | 'lb_tab_week' | 'invite';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  active?: boolean;
}

export interface LeaderboardPanelLayout {
  panel: { x: number; y: number; w: number; h: number };
  title: string;
  activeTab: LeaderboardTabId;
  tabs: LeaderboardPanelButton[];
  /** 规则说明（灰字） */
  ruleLines: string[];
  /** @deprecated 用 settleLines + rewardTierLines */
  rewardLines: string[];
  /** 本周榜：距结算倒计时（分行） */
  settleLines: string[];
  /** 本周榜：结算说明（小字一行） */
  settleNoteLines: string[];
  /** 本周榜：「周奖励」小标题，无奖励档时为 null */
  rewardTitle: string | null;
  /** 本周榜：各名次奖励，每档一行 */
  rewardTierLines: string[];
  infoTop: number;
  infoLineH: number;
  gapHint: string;
  gapY: number;
  playerRows: LeaderboardLine[];
  /** 名单为空时的提示 */
  emptyText: string;
  textWidth: number;
  tagX: number;
  avatarX: number;
  avatarR: number;
  textX: number;
  scoreX: number;
  listTop: number;
  listBottom: number;
  /** 整个名单区高度（含领奖台） */
  listViewportH: number;
  /** 可滚动行内容高度（不含前三名领奖台） */
  listContentH: number;
  /** 前三名领奖台高度，0 表示不展示 */
  podiumH: number;
  /** 可滚动名单顶边（领奖台下方） */
  listScrollTop: number;
  /** 可滚动视口高度 */
  listScrollViewportH: number;
  rowH: number;
  rowGap: number;
  selfRow: LeaderboardLine | null;
  selfBar: { x: number; y: number; w: number; h: number };
  buttons: LeaderboardPanelButton[];
}

const PLAYER_ROW_H = 52;
const PLAYER_ROW_GAP = 6;
const AVATAR_R = 16;
const INFO_LINE_H = 16;
const MAX_VISIBLE_ROWS = 5;
const MIN_VISIBLE_ROWS = 2;
/** 前三名领奖台占用高度（与绘制一致） */
export const LEADERBOARD_PODIUM_H = 56;

export function playerRowStride(): number {
  return PLAYER_ROW_H + PLAYER_ROW_GAP;
}

export function leaderboardShowPodium(playerCount: number, listViewportH: number): boolean {
  return playerCount >= 3 && listViewportH > LEADERBOARD_PODIUM_H + playerRowStride();
}

export function layoutLeaderboardPanel(input: {
  width: number;
  height: number;
  activeTab: LeaderboardTabId;
  tab: LeaderboardTab | null;
  settleText?: string;
  rewardText?: string;
  wrap: (text: string, maxWidth: number) => string[];
}): LeaderboardPanelLayout {
  const panelW = Math.min(360, input.width - 24);
  const padX = 14;
  const tagW = 30;
  const avatarGap = 8;
  const scoreColW = 78;
  const innerW = panelW - padX * 2;
  const tab = input.tab;
  const isWeek = input.activeTab === 'week';

  const ruleLines = tab?.rule ? input.wrap(tab.rule, innerW) : [];
  const rawTiers = isWeek ? leaderboardRewardTierLines() : [];
  const settleLines =
    isWeek && input.settleText?.trim()
      ? input.wrap(input.settleText.trim(), innerW)
      : [];
  const settleNote =
    isWeek && (settleLines.length > 0 || rawTiers.length > 0)
      ? ((noticeJson.leaderboard as { settleNote?: string }).settleNote ?? '')
      : '';
  const settleNoteLines = settleNote ? input.wrap(settleNote, innerW) : [];
  const rewardTierLines = rawTiers.flatMap((line) => input.wrap(line, innerW));
  const rewardTitle =
    isWeek && rewardTierLines.length > 0
      ? ((noticeJson.leaderboard as { rewardTitle?: string }).rewardTitle ?? '周奖励')
      : null;
  const rewardLines: string[] = [];
  const playerRows = (tab?.rows ?? []).filter((row) => (row.kind ?? 'player') === 'player');
  const selfRow = tab?.self ?? null;
  const gapHint = tab?.gapHint ?? '';

  const titleH = 46;
  const tabsH = 34;
  const rewardBlockPad = rewardTierLines.length > 0 ? 10 : 0;
  const infoLineCount =
    ruleLines.length
    + settleLines.length
    + settleNoteLines.length
    + (rewardTitle ? 1 : 0)
    + rewardTierLines.length;
  const infoH = infoLineCount * INFO_LINE_H + rewardBlockPad + 8;
  const gapH = gapHint ? 22 : 0;
  const selfBarH = selfRow ? PLAYER_ROW_H + 8 : 0;
  const inviteH = 40;
  const footH = 14;
  const fixedH = titleH + tabsH + 8 + infoH + gapH + 6 + selfBarH + 8 + inviteH + footH;

  const stride = playerRowStride();
  const podiumEstimate = playerRows.length >= 3 ? LEADERBOARD_PODIUM_H : 0;
  const scrollEstimate = playerRows.length >= 3
    ? Math.max(0, playerRows.length - 3)
    : playerRows.length;
  const wantRows = Math.max(
    MIN_VISIBLE_ROWS,
    Math.min(MAX_VISIBLE_ROWS, scrollEstimate || playerRows.length),
  );
  const desiredH = fixedH + podiumEstimate + wantRows * stride;
  const panelH = Math.min(input.height * 0.9, desiredH);
  const x = (input.width - panelW) / 2;
  const y = Math.max(12, (input.height - panelH) / 2);

  const tabsY = y + titleH;
  const tabGap = 8;
  const tabW = (innerW - tabGap) / 2;
  const tabs: LeaderboardPanelButton[] = [
    {
      id: 'lb_tab_level',
      x: x + padX,
      y: tabsY,
      w: tabW,
      h: tabsH,
      label: noticeJson.leaderboard.tabLevel,
      active: !isWeek,
    },
    {
      id: 'lb_tab_week',
      x: x + padX + tabW + tabGap,
      y: tabsY,
      w: tabW,
      h: tabsH,
      label: noticeJson.leaderboard.tabWeek,
      active: isWeek,
    },
  ];

  const infoTop = tabsY + tabsH + 8;
  const gapY = infoTop + infoH;
  const listTop = gapY + gapH + 6;
  const inviteY = y + panelH - footH - inviteH;
  const selfBarY = inviteY - 8 - selfBarH;
  const listBottom = selfRow ? selfBarY - 4 : inviteY - 8;

  const listViewportH = Math.max(0, listBottom - listTop);
  const showPodium = leaderboardShowPodium(playerRows.length, listViewportH);
  const podiumH = showPodium ? LEADERBOARD_PODIUM_H : 0;
  const scrollRowCount = showPodium ? Math.max(0, playerRows.length - 3) : playerRows.length;
  const listContentH = scrollRowCount * stride;

  const tagX = x + padX;
  const avatarX = tagX + tagW + avatarGap + AVATAR_R;
  const textX = avatarX + AVATAR_R + avatarGap;
  const scoreX = x + panelW - padX - 4;
  const textWidth = Math.max(60, scoreX - scoreColW - textX);

  const invite: LeaderboardPanelButton = {
    id: 'invite',
    x: x + padX + 20,
    y: inviteY,
    w: innerW - 40,
    h: inviteH,
    label: noticeJson.leaderboard.invite,
  };
  const close = panelCloseButton({ x, y, w: panelW });

  return {
    panel: { x, y, w: panelW, h: panelH },
    title: noticeJson.leaderboard.title,
    activeTab: input.activeTab,
    tabs,
    ruleLines,
    rewardLines,
    settleLines,
    settleNoteLines,
    rewardTitle,
    rewardTierLines,
    infoTop,
    infoLineH: INFO_LINE_H,
    gapHint,
    gapY,
    playerRows,
    emptyText: tab
      ? isWeek ? noticeJson.leaderboard.weekEmpty : noticeJson.leaderboard.empty
      : noticeJson.leaderboard.unavailable,
    textWidth,
    tagX,
    avatarX,
    avatarR: AVATAR_R,
    textX,
    scoreX,
    listTop,
    listBottom,
    listViewportH,
    listContentH,
    podiumH,
    listScrollTop: listTop + podiumH,
    listScrollViewportH: Math.max(0, listBottom - listTop - podiumH),
    rowH: PLAYER_ROW_H,
    rowGap: PLAYER_ROW_GAP,
    selfRow,
    selfBar: { x: x + 8, y: selfBarY, w: panelW - 16, h: selfBarH },
    buttons: [{ ...close }, ...tabs, invite],
  };
}

export function clampLeaderboardScroll(scrollY: number, layout: LeaderboardPanelLayout): number {
  const viewport = layout.listScrollViewportH > 0 ? layout.listScrollViewportH : layout.listViewportH;
  const maxScroll = Math.max(0, layout.listContentH - viewport);
  if (!Number.isFinite(scrollY) || scrollY < 0) {
    return 0;
  }
  if (scrollY > maxScroll) {
    return maxScroll;
  }
  return scrollY;
}

export type LeaderboardMedal = 'gold' | 'silver' | 'bronze' | null;

export function leaderboardMedal(tag: string): LeaderboardMedal {
  if (tag === '1') {
    return 'gold';
  }
  if (tag === '2') {
    return 'silver';
  }
  if (tag === '3') {
    return 'bronze';
  }
  return null;
}

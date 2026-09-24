/**
 * 玩家周榜的排序和提示。
 * 名单由服务端返回：所有玩过本小游戏的用户，不再依赖下战书关系。
 */
import { readLeaderboardConfig } from './ChallengeGrants';
import noticeJson from '../../config/notice.json';

export interface FriendRankInput {
  userId: string;
  maxLevel: number;
  bestTimeMs: number | null;
  completed: boolean;
  isSelf: boolean;
  nickName?: string;
  avatarUrl?: string;
  wxId?: string;
  score?: number;
}

export interface FriendRankRow extends FriendRankInput {
  rank: number;
}

export interface LeaderboardLine {
  /** 名次或「奖励 / 提示」等标签 */
  tag: string;
  /** 兼容旧单行文案；玩家行可留空，改用下方字段 */
  text: string;
  highlight?: boolean;
  badge?: string;
  /** 玩家行：微信头像 */
  avatarUrl?: string;
  /** 玩家行：微信昵称 */
  nickName?: string;
  /** 玩家行：微信号（或邀请码 / openId 展示） */
  wxId?: string;
  /** 玩家行：分数 */
  score?: number;
  /** 区分提示行、奖励说明行与玩家行 */
  kind?: 'meta' | 'reward' | 'player';
}

/** 好友排行面板数据 */
export interface LeaderboardView {
  title: string;
  hint: string;
  rewardText: string;
  selfRank: number;
  rows: LeaderboardLine[];
}

/**
 * 先比最高通关关卡，再比今日挑战耗时。
 * 没打今日挑战的记成无穷大，不能靠 0 秒排到打过的人前面。
 * 仍然相同就按用户 ID，保证名次稳定，结算前 3 不会并列。
 */
export function rankFriends(rows: readonly FriendRankInput[]): FriendRankRow[] {
  const sorted = rows.slice().sort((a, b) => {
    if (a.maxLevel !== b.maxLevel) {
      return b.maxLevel - a.maxLevel;
    }
    const at = a.bestTimeMs != null && a.bestTimeMs > 0 ? a.bestTimeMs : Number.POSITIVE_INFINITY;
    const bt = b.bestTimeMs != null && b.bestTimeMs > 0 ? b.bestTimeMs : Number.POSITIVE_INFINITY;
    if (at !== bt) {
      return at - bt;
    }
    return a.userId < b.userId ? -1 : 1;
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * 找出刚刚超过 userId 的那个人。
 * oldRank 为 0 表示上次还没上榜，第一次出现不算被超越。
 * 同一次变动里可能有好几个人超过他，取现在紧挨在他上面的那个。
 */
export function findPasser(
  userId: string,
  oldRank: number,
  rows: readonly { userId: string; rank: number }[],
  oldRanks: ReadonlyMap<string, number>,
): string | null {
  if (oldRank <= 0) {
    return null;
  }
  const self = rows.find((row) => row.userId === userId);
  if (!self || self.rank <= oldRank) {
    return null;
  }
  let passer: { userId: string; rank: number } | null = null;
  for (const row of rows) {
    if (row.userId === userId || row.rank >= self.rank) {
      continue;
    }
    const prev = oldRanks.get(row.userId) ?? 0;
    if (prev === 0 || prev > oldRank) {
      if (!passer || row.rank > passer.rank) {
        passer = row;
      }
    }
  }
  return passer?.userId ?? null;
}

/** 接口最多带前 N 名。自己被截掉时补在末尾，否则面板高亮不到。 */
export function takeLeaderboardRows<T extends { isSelf: boolean }>(
  rows: readonly T[],
  limit: number,
): T[] {
  const cap = Math.max(1, Math.floor(limit) || 1);
  const visible = rows.slice(0, cap);
  const self = rows.find((row) => row.isSelf);
  if (self && !visible.includes(self)) {
    return visible.concat(self);
  }
  return visible.slice();
}

export interface FriendSpotlight {
  name: string;
  levelId: number;
}

export function friendClearBubbleText(name: string, levelId: number): string {
  return `好友 ${name} 刚通关第 ${levelId} 关，来挑战他！`;
}

/** 榜上第一个已经通关的好友。自己不算。 */
export function pickFriendSpotlight(
  rows: readonly FriendRankInput[],
): FriendSpotlight | null {
  const friend = rows.find((row) => !row.isSelf && row.maxLevel > 0);
  if (!friend) {
    return null;
  }
  const raw = friend.userId.trim();
  const name = raw.length > 8 ? raw.slice(0, 8) : raw;
  return {
    name: name || '好友',
    levelId: Math.max(1, Math.floor(friend.maxLevel)),
  };
}

/** 截断展示用微信号，避免超长 openId 撑破一行。 */
export function formatWxIdDisplay(raw: string, max = 12): string {
  const text = raw.trim();
  if (!text) {
    return '—';
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(4, max - 3))}…`;
}

export function formatLeaderboardLine(row: FriendRankRow): LeaderboardLine {
  const nickName = (row.nickName || '').trim() || '微信玩家';
  const wxId = formatWxIdDisplay(row.wxId || row.userId);
  const score = Math.max(0, Math.floor(row.score ?? row.maxLevel));
  return {
    tag: String(row.rank),
    text: '',
    highlight: row.isSelf,
    badge: nickName.slice(0, 1) || '玩',
    kind: 'player',
    avatarUrl: row.avatarUrl,
    nickName,
    wxId,
    score,
  };
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}

export function passNotifyMessage(name: string): string {
  return fill(noticeJson.leaderboard.notify, { name });
}

export function passedHint(name: string): string {
  return fill(noticeJson.leaderboard.passed, { name });
}

export function hintFromNotify(message: string): string {
  const name = nameFromNotify(message);
  return name ? passedHint(name) : message;
}

export function nameFromNotify(message: string): string | null {
  const template = noticeJson.leaderboard.notify;
  const token = '{name}';
  const at = template.indexOf(token);
  if (at < 0) {
    return null;
  }
  const prefix = template.slice(0, at);
  const suffix = template.slice(at + token.length);
  if (!message.startsWith(prefix) || !message.endsWith(suffix)) {
    return null;
  }
  const name = message.slice(prefix.length, message.length - suffix.length);
  return name || null;
}

/**
 * 被超过优先。没有这条时，上一名只多 1 关才显示加油。
 * 差 2 关或已经是第一名，不另写一句，避免提示和名次对不上。
 */
export function buildLeaderboardHint(input: {
  passedBy: string | null;
  selfScore: number;
  aboveScore: number | null;
}): string {
  if (input.passedBy) {
    return passedHint(input.passedBy);
  }
  if (input.aboveScore != null && input.aboveScore - input.selfScore === 1) {
    return noticeJson.leaderboard.closeGap;
  }
  return '';
}

export function leaderboardRewardText(): string {
  const config = readLeaderboardConfig();
  const hammer = config.rewards.find((item) => item.id === 'hammer')?.amount ?? 0;
  const shuffle = config.rewards.find((item) => item.id === 'shuffle')?.amount ?? 0;
  return fill(noticeJson.leaderboard.reward, { hammer, shuffle });
}

export function leaderboardRewardedText(hammer: number, shuffle: number): string {
  return fill(noticeJson.leaderboard.rewarded, { hammer, shuffle });
}

/**
 * 本地日历的 ISO 周，例如 2026-W39。
 * 和 localYmd 用同一个时区，周一 0 点和每日挑战的 0 点是同一个钟。
 */
export function localIsoWeek(nowMs: number): string {
  const date = new Date(nowMs);
  return isoWeekFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function previousIsoWeek(week: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) {
    return week;
  }
  const year = Number(match[1]);
  const weekNo = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (weekNo - 1) * 7 - 7);
  return isoWeekFromParts(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

function isoWeekFromParts(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dow = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dow);
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

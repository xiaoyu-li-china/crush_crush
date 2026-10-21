/**
 * 排行榜的排序、文案和提示。
 * 名单由服务端返回：所有玩过本小游戏的用户。分「关卡榜」（总进度）和「本周榜」（本周通关得分，周一结算）。
 */
import { readLeaderboardConfig, type ChallengeGrantSpec } from './ChallengeGrants';
import noticeJson from '../../config/notice.json';

export type LeaderboardTabId = 'level' | 'week';

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
  /** 各关最高分之和 */
  totalScore?: number;
  /** 本周通关累计分 */
  weekScore?: number;
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
  /** 玩家行右侧大字（如「第 12 关」「2,340」） */
  scoreText?: string;
  /** 右侧大字下方的单位 */
  scoreUnit?: string;
  /** 昵称下方的小字 */
  sub?: string;
  /** 区分提示行、奖励说明行与玩家行 */
  kind?: 'meta' | 'reward' | 'player';
}

export interface LeaderboardTab {
  id: LeaderboardTabId;
  label: string;
  /** 标签下的规则说明 */
  rule: string;
  rows: LeaderboardLine[];
  /** 底部固定的「我」；未上榜时 tag 为「未上榜」 */
  self: LeaderboardLine | null;
  selfRank: number;
  /** 离上一名还差多少 */
  gapHint: string;
}

/** 排行面板数据 */
export interface LeaderboardView {
  title: string;
  hint: string;
  rewardText: string;
  selfRank: number;
  /** 关卡榜行（兼容旧面板） */
  rows: LeaderboardLine[];
  tabs?: Record<LeaderboardTabId, LeaderboardTab>;
  /** 本周榜结算倒计时 */
  settleText?: string;
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

/** 千分位，微信里 toLocaleString 不一定可用。 */
export function formatScoreNumber(value: number): string {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatLeaderboardLine(row: FriendRankRow, tab: LeaderboardTabId = 'level'): LeaderboardLine {
  const nickName = (row.nickName || '').trim() || '微信玩家';
  const wxId = formatWxIdDisplay(row.wxId || row.userId);
  const score = Math.max(0, Math.floor(row.score ?? row.maxLevel));
  const maxLevel = Math.max(0, Math.floor(row.maxLevel));
  const isWeek = tab === 'week';
  const weekScore = Math.max(0, Math.floor(row.weekScore ?? (isWeek ? score : 0)));
  const totalScore = Math.max(0, Math.floor(row.totalScore ?? 0));
  return {
    tag: row.rank > 0 ? String(row.rank) : '未上榜',
    text: '',
    highlight: row.isSelf,
    badge: nickName.slice(0, 1) || '玩',
    kind: 'player',
    avatarUrl: row.avatarUrl,
    nickName,
    wxId,
    score,
    scoreText: isWeek ? formatScoreNumber(weekScore) : `第 ${maxLevel} 关`,
    scoreUnit: isWeek ? '本周分' : '最高通关',
    sub: isWeek
      ? `已通关 ${maxLevel} 关`
      : totalScore > 0 ? `累计 ${formatScoreNumber(totalScore)} 分` : '',
  };
}

/**
 * 我和上一名的差距。关卡榜同关时比累计分，本周榜直接比分。
 * 已经第一或没有上一名时返回空串。
 */
export function leaderboardGapHint(input: {
  tab: LeaderboardTabId;
  selfRank: number;
  self: { maxLevel: number; totalScore?: number; weekScore?: number } | null;
  above: { nickName?: string; maxLevel: number; totalScore?: number; weekScore?: number } | null;
}): string {
  if (input.selfRank === 1) {
    return input.tab === 'week' ? '本周第一！守住它，周一领大奖' : '你是全服第一！';
  }
  if (!input.self || !input.above) {
    if (input.tab === 'week') {
      const mine = Math.max(0, Math.floor(input.self?.weekScore ?? 0));
      if (mine > 0) {
        return `你本周 ${formatScoreNumber(mine)} 分，邀请好友一起冲榜`;
      }
      return '';
    }
    return '';
  }
  const name = (input.above.nickName || '上一名').slice(0, 8);
  if (input.tab === 'week') {
    const gap = Math.max(0, Math.floor(input.above.weekScore ?? 0) - Math.floor(input.self.weekScore ?? 0)) + 1;
    return `再得 ${formatScoreNumber(gap)} 分就能超过 ${name}`;
  }
  const levelGap = Math.floor(input.above.maxLevel) - Math.floor(input.self.maxLevel);
  if (levelGap > 0) {
    return `再通关 ${levelGap} 关就能追上 ${name}`;
  }
  const scoreGap = Math.max(0, Math.floor(input.above.totalScore ?? 0) - Math.floor(input.self.totalScore ?? 0)) + 1;
  return `同关比累计分，再多 ${formatScoreNumber(scoreGap)} 分超过 ${name}`;
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

const GRANT_NAME: Record<ChallengeGrantSpec['id'], string> = {
  hammer: '锤子',
  shuffle: '重排',
  extraMoves: '加步',
};

export function formatGrantList(grants: readonly ChallengeGrantSpec[]): string {
  return grants
    .filter((item) => item.amount > 0)
    .map((item) => `${GRANT_NAME[item.id]}x${item.amount}`)
    .join(' ');
}

/** 本周榜分档奖励，例如「第1名 锤子x3 重排x2 · 2-3名 …」 */
export function leaderboardRewardText(): string {
  const tiers = leaderboardRewardTierLines();
  return tiers.length > 0 ? fill(noticeJson.leaderboard.reward, { tiers: tiers.join(' · ') }) : '';
}

/** 本周榜奖励分档，每档一行（用于面板排版）。 */
export function leaderboardRewardTierLines(): string[] {
  return readLeaderboardConfig().tiers.map((tier) => {
    const range =
      tier.minRank === tier.maxRank ? `第${tier.minRank}名` : `第${tier.minRank}-${tier.maxRank}名`;
    const grants = formatGrantList(tier.rewards);
    return grants ? `${range}  ${grants}` : range;
  });
}

/**
 * 上周结算到账提示。tierMatched=false 表示名次不在奖励档内。
 */
export function leaderboardRewardedText(
  rank: number,
  grants: readonly ChallengeGrantSpec[],
  tierMatched = true,
): string {
  if (!tierMatched) {
    const tiers = readLeaderboardConfig().tiers;
    const top = tiers.length > 0 ? tiers[tiers.length - 1]!.maxRank : 0;
    return fill(noticeJson.leaderboard.rewardedNone, { rank, top });
  }
  const list = formatGrantList(grants);
  if (!list) {
    return fill(noticeJson.leaderboard.rewardedFull, { rank });
  }
  return fill(noticeJson.leaderboard.rewarded, { rank, rewards: list });
}

/** 下一个结算点：本地时间下周一 0 点（和 localIsoWeek 同一个钟）。 */
export function nextWeeklySettleMs(nowMs: number): number {
  const date = new Date(nowMs);
  const dow = date.getDay() || 7;
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return midnight + (8 - dow) * 86400000;
}

export function weeklySettleCountdownText(nowMs: number, settleAtMs = nextWeeklySettleMs(nowMs)): string {
  const left = Math.max(0, settleAtMs - nowMs);
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const minutes = Math.max(1, Math.floor((left % 3600000) / 60000));
  if (days > 0) {
    return `距结算 ${days}天${hours}小时`;
  }
  if (hours > 0) {
    return `距结算 ${hours}小时${minutes}分`;
  }
  return `距结算 ${minutes}分钟`;
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

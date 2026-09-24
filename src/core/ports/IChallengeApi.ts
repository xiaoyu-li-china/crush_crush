/**
 * 好友挑战 HTTP 端口。道具数量只相信服务端返回值。
 */
import type { BoosterId } from '../../logic/economy/BoosterInventory';

export interface ChallengeGrantDto {
  id: BoosterId;
  amount: number;
}

export interface CreateChallengeRequest {
  inviterId: string;
  levelId: number;
  maxClearedLevel: number;
  inviterTimeMs: number;
}

export interface CreateChallengeResponse {
  ok: boolean;
  reason?: string;
  recordId?: string;
  query?: string;
  title?: string;
  levelId?: number;
}

export interface VerifyChallengeRequest {
  inviterId: string;
  inviteeId: string;
  levelId: number;
  completed: boolean;
  inviteeTimeMs: number;
  deviceId: string;
  fresh: boolean;
}

export interface VerifyChallengeResponse {
  ok: boolean;
  reason?: string;
  status?: 'pending' | 'success' | 'fail';
  completed?: boolean;
  inviteeTimeMs?: number;
  inviterTimeMs?: number | null;
  fasterBySec?: number | null;
  inviteeGrant?: ChallengeGrantDto | null;
  inviterGrant?: ChallengeGrantDto | null;
}

export interface ChallengeStatusResponse {
  ok: boolean;
  reason?: string;
  pendingGrants?: { hammer: number; shuffle: number; extraMoves: number };
}

export interface DailyTodayResponse {
  ok: boolean;
  reason?: string;
  date?: string;
  levelId?: number;
  completed?: boolean;
  consecutiveDays?: number;
  rewardClaimed?: boolean;
  streakTarget?: number;
  completeReward?: ChallengeGrantDto;
  streakReward?: ChallengeGrantDto;
  bestTimeMs?: number;
}

export interface DailySubmitRequest {
  userId: string;
  levelId: number;
  completed: boolean;
  timeMs: number;
  maxClearedLevel: number;
}

export interface DailySubmitResponse {
  ok: boolean;
  reason?: string;
  message?: string;
  completed?: boolean;
  rewardClaimed?: boolean;
  consecutiveDays?: number;
  streakTarget?: number;
  bestTimeMs?: number;
  grants?: ChallengeGrantDto[];
}

export interface LeaderboardRowDto {
  rank: number;
  userId: string;
  maxLevel: number;
  bestTimeMs: number | null;
  completed: boolean;
  isSelf: boolean;
  /** 微信昵称；缺省时客户端用 userId 兜底。 */
  nickName?: string;
  /** 微信头像 URL。 */
  avatarUrl?: string;
  /** 展示用微信号；微信不开放真实微信号时可用 openId / 邀请码。 */
  wxId?: string;
  /** 排行分数；缺省用 maxLevel。 */
  score?: number;
}

export interface LeaderboardNotifyDto {
  id: string;
  message: string;
  createdAt: number;
  read: number;
}

export interface LeaderboardResponse {
  ok: boolean;
  reason?: string;
  week?: string;
  date?: string;
  levelId?: number;
  selfRank?: number;
  hint?: string;
  rewardText?: string;
  rows?: LeaderboardRowDto[];
  notifies?: LeaderboardNotifyDto[];
}

export interface LeaderboardNotifyResponse {
  ok: boolean;
  reason?: string;
  message?: string;
}

export interface IChallengeApi {
  create(body: CreateChallengeRequest): Promise<CreateChallengeResponse>;
  verify(body: VerifyChallengeRequest): Promise<VerifyChallengeResponse>;
  status(userId: string): Promise<ChallengeStatusResponse>;
  dailyToday(userId: string): Promise<DailyTodayResponse>;
  dailySubmit(body: DailySubmitRequest): Promise<DailySubmitResponse>;
  /** 玩家排行。scope=all 时返回所有玩过本小游戏的用户（不再按战书好友过滤）。 */
  leaderboard(
    userId: string,
    maxClearedLevel?: number,
    profile?: { nickName?: string; avatarUrl?: string },
  ): Promise<LeaderboardResponse>;
  leaderboardNotify?(body: { userId: string; passerId?: string }): Promise<LeaderboardNotifyResponse>;
}

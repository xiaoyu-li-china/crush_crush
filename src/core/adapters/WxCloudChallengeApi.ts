/**
 * 排行榜走微信云函数：体验版即可读写线上环境真实玩家资料。
 */
import challengeJson from '../../config/challenge.json';
import type {
  ChallengeStatusResponse,
  CreateChallengeRequest,
  CreateChallengeResponse,
  DailySubmitRequest,
  DailySubmitResponse,
  DailyTodayResponse,
  IChallengeApi,
  LeaderboardNotifyResponse,
  LeaderboardResponse,
  VerifyChallengeRequest,
  VerifyChallengeResponse,
} from '../ports/IChallengeApi';
import cloudJson from '../../config/cloud.json';

function cloudApi(): WxCloud | null {
  try {
    if (typeof wx === 'undefined' || !wx.cloud) {
      return null;
    }
    return wx.cloud;
  } catch {
    return null;
  }
}

let cloudReady: Promise<boolean> | null = null;

function ensureCloud(): Promise<boolean> {
  if (cloudReady) {
    return cloudReady;
  }
  cloudReady = (async () => {
    const cloud = cloudApi();
    if (!cloud || typeof cloud.callFunction !== 'function') {
      return false;
    }
    try {
      const env = cloudJson.envId || cloud.DYNAMIC_CURRENT_ENV;
      cloud.init(env ? { env, traceUser: true } : { traceUser: true });
      return true;
    } catch {
      return false;
    }
  })();
  return cloudReady;
}

const NO_API = { ok: false as const, reason: 'no_api' };

/**
 * 云开发排行实现；挑战/每日接口暂未上云，返回 no_api。
 */
export class WxCloudChallengeApi implements IChallengeApi {
  public constructor(
    private readonly functionName: string = (challengeJson as { cloudFunction?: string }).cloudFunction
      || 'leaderboard',
  ) {}

  public async create(_body: CreateChallengeRequest): Promise<CreateChallengeResponse> {
    return NO_API;
  }

  public async verify(_body: VerifyChallengeRequest): Promise<VerifyChallengeResponse> {
    return NO_API;
  }

  public async status(_userId: string): Promise<ChallengeStatusResponse> {
    return NO_API;
  }

  public async dailyToday(_userId: string): Promise<DailyTodayResponse> {
    return NO_API;
  }

  public async dailySubmit(_body: DailySubmitRequest): Promise<DailySubmitResponse> {
    return NO_API;
  }

  public async leaderboard(
    userId: string,
    maxClearedLevel = 0,
    profile?: { nickName?: string; avatarUrl?: string },
  ): Promise<LeaderboardResponse> {
    if (!(await ensureCloud())) {
      return { ok: false, reason: 'cloud_unavailable' };
    }
    const cloud = cloudApi();
    if (!cloud?.callFunction) {
      return { ok: false, reason: 'cloud_unavailable' };
    }
    try {
      const res = await cloud.callFunction({
        name: this.functionName,
        data: {
          userId,
          wxId: userId,
          maxLevel: Math.max(0, Math.floor(maxClearedLevel)),
          nickName: profile?.nickName || '',
          avatarUrl: profile?.avatarUrl || '',
        },
      });
      const result = (res.result ?? {}) as LeaderboardResponse;
      if (result && result.ok) {
        return result;
      }
      return {
        ok: false,
        reason: (result && result.reason) || 'cloud_error',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[crush-crush][leaderboard] cloud call failed', message);
      return { ok: false, reason: 'cloud_error' };
    }
  }

  public async leaderboardNotify(): Promise<LeaderboardNotifyResponse> {
    return NO_API;
  }
}

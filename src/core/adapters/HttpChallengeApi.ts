/**
 * 调本地或线上的好友挑战接口。微信里走 wx.request，单测和 Node 走 fetch。
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

async function requestJson(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<unknown> {
  if (typeof wx !== 'undefined' && typeof wx.request === 'function') {
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method,
        data: body,
        header: { 'content-type': 'application/json' },
        timeout: 1500,
        success: (res) => resolve(res.data),
        fail: (err) => reject(new Error(err.errMsg || 'request failed')),
      });
    });
  }
  const fetchFn = (globalThis as {
    fetch?: (
      input: string,
      init: { method: string; headers: Record<string, string>; body?: string },
    ) => Promise<{ json: () => Promise<unknown> }>;
  }).fetch;
  if (typeof fetchFn === 'function') {
    const res = await fetchFn(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    return res.json();
  }
  throw new Error('no http client');
}

export class HttpChallengeApi implements IChallengeApi {
  public constructor(private readonly baseUrl: string = challengeJson.baseUrl) {}

  public async create(body: CreateChallengeRequest): Promise<CreateChallengeResponse> {
    return this.post('/api/challenge/create', body) as Promise<CreateChallengeResponse>;
  }

  public async verify(body: VerifyChallengeRequest): Promise<VerifyChallengeResponse> {
    return this.post('/api/challenge/verify', body) as Promise<VerifyChallengeResponse>;
  }

  public async status(userId: string): Promise<ChallengeStatusResponse> {
    const url = `${this.base()}/api/challenge/status?user_id=${encodeURIComponent(userId)}&consume=1`;
    return (await requestJson(url, 'GET')) as ChallengeStatusResponse;
  }

  public async dailyToday(userId: string): Promise<DailyTodayResponse> {
    const url = `${this.base()}/api/daily-challenge?user_id=${encodeURIComponent(userId)}`;
    if (!this.baseUrl) {
      return { ok: false, reason: 'no_api' };
    }
    return (await requestJson(url, 'GET')) as DailyTodayResponse;
  }

  public async dailySubmit(body: DailySubmitRequest): Promise<DailySubmitResponse> {
    return this.post('/api/daily-challenge/complete', body) as Promise<DailySubmitResponse>;
  }

  public async leaderboard(
    userId: string,
    maxClearedLevel = 0,
    profile?: { nickName?: string; avatarUrl?: string },
  ): Promise<LeaderboardResponse> {
    // scope=all：返回所有玩过本小游戏的用户；附带资料便于服务端入库展示
    const qs = [
      `user_id=${encodeURIComponent(userId)}`,
      `max_level=${Math.max(0, Math.floor(maxClearedLevel))}`,
      'scope=all',
    ];
    if (profile?.nickName) {
      qs.push(`nick_name=${encodeURIComponent(profile.nickName)}`);
    }
    if (profile?.avatarUrl) {
      qs.push(`avatar_url=${encodeURIComponent(profile.avatarUrl)}`);
    }
    const url = `${this.base()}/api/leaderboard?${qs.join('&')}`;
    if (!this.baseUrl) {
      return { ok: false, reason: 'no_api' };
    }
    return (await requestJson(url, 'GET')) as LeaderboardResponse;
  }

  public async leaderboardNotify(body: { userId: string; passerId?: string }): Promise<LeaderboardNotifyResponse> {
    return this.post('/api/leaderboard/notify', body) as Promise<LeaderboardNotifyResponse>;
  }

  private base(): string {
    return this.baseUrl.replace(/\/$/, '');
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    if (!this.baseUrl) {
      return { ok: false, reason: 'no_api' };
    }
    return requestJson(`${this.base()}${path}`, 'POST', body);
  }
}

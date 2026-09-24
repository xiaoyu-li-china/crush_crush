import {
  WxAdAdapter,
  WxAnalyticsAdapter,
  WxAudioAdapter,
  WxCloudSaveAdapter,
  WxPlatformAdapter,
  WxStorageAdapter,
} from '../core';
import type {
  IAdService,
  IAnalytics,
  IAudio,
  IPlatform,
  IStorage,
} from '../core';
import { GameSession } from './GameSession';
import adPlacementsJson from '../config/ad-placements.json';
import { HttpChallengeApi } from '../core/adapters/HttpChallengeApi';
import { WxCloudChallengeApi } from '../core/adapters/WxCloudChallengeApi';
import challengeJson from '../config/challenge.json';

/** Composition Root：集中创建 Adapter 并注入会话。 */
export interface AppContainer {
  storage: IStorage;
  ads: IAdService;
  audio: IAudio;
  analytics: IAnalytics;
  platform: IPlatform;
  session: GameSession;
}

function createChallengeApi() {
  const provider = String((challengeJson as { provider?: string }).provider || '').toLowerCase();
  if (provider === 'cloud' || !challengeJson.baseUrl) {
    return new WxCloudChallengeApi();
  }
  return new HttpChallengeApi();
}

export function createAppContainer(): AppContainer {
  const storage = new WxStorageAdapter();
  const ads = new WxAdAdapter({
    rewarded_revive: adPlacementsJson.rewarded_revive.adUnitId,
    rewarded_crush_extend: adPlacementsJson.rewarded_crush_extend.adUnitId,
    interstitial_settle: adPlacementsJson.interstitial_settle.adUnitId,
    banner_lobby: adPlacementsJson.banner_lobby.adUnitId,
  });
  const audio = new WxAudioAdapter();
  const analytics = new WxAnalyticsAdapter();
  const platform = new WxPlatformAdapter();

  const cloudSave = new WxCloudSaveAdapter();
  const challengeApi = createChallengeApi();

  const session = new GameSession({
    storage,
    ads,
    audio,
    analytics,
    platform,
    cloudSave,
    challengeApi,
  });

  return {
    storage,
    ads,
    audio,
    analytics,
    platform,
    session,
  };
}

/**
 * 启动引导。
 */
export class Bootstrap {
  public constructor(private readonly container: AppContainer) {}

  public async run(): Promise<GameSession> {
    const { platform, session, ads } = this.container;

    const onHide = (): void => {
      // 画布循环由 WxCanvasGameApp 在 onHide 暂停，避免进游戏圈抢 GPU
    };
    const onShow = (): void => {
      // 画布恢复后再预加载广告，避免从微信/其他 App 返回时抢主线程黑屏
      setTimeout(() => {
        void ads.load('rewarded_revive');
      }, 2800);
    };
    platform.onHide(onHide);
    platform.onShow(onShow);

    await session.init();
    // 广告放到画布首帧之后再创建。启动瞬间 createRewardedVideoAd
    // 会让开发者工具模拟器黑屏并报「长时间没有响应」。
    return session;
  }
}

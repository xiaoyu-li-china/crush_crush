import type { AdPlacement, AdShowResult, IAdService } from '../ports/IAdService';
import { layoutLobbyBannerStyle, toNativeViewStyle } from '../utils/lobbyBanner';
import {
  canCreateWxFullscreenAds,
  canCreateWxNativeAds,
  isWxDevtoolsHost,
  readWxSystemInfo,
} from '../utils/wxHost';

export {
  isWxCustomAdHostSupported,
  canCreateWxNativeAds,
  canCreateWxFullscreenAds,
} from '../utils/wxHost';

/**
 * 广告位对应的微信广告单元 ID 配置。
 */
export interface WxAdUnitConfig {
  rewarded_revive: string;
  rewarded_crush_extend: string;
  interstitial_settle: string;
  banner_lobby?: string;
}

type RewardedPlacement = 'rewarded_revive' | 'rewarded_crush_extend';
type InterstitialPlacement = 'interstitial_settle';

interface RewardedSlot {
  ad: WxRewardedVideoAd;
  onLoad: () => void;
  onError: (err: { errMsg: string; errCode?: number }) => void;
}

interface InterstitialSlot {
  ad: WxInterstitialAd;
  onLoad: () => void;
  onError: (err: { errMsg: string; errCode?: number }) => void;
}

interface BannerSlot {
  ad: WxCustomAd;
  onLoad: () => void;
  onError: (err: { errMsg: string; errCode?: number }) => void;
  onHide: () => void;
  visible: boolean;
  /** show() 成功后才 hide/destroy，避免模拟器 removeImageView not found */
  attached: boolean;
}

function isRewardedPlacement(placement: AdPlacement): placement is RewardedPlacement {
  return placement === 'rewarded_revive' || placement === 'rewarded_crush_extend';
}

function isInterstitialPlacement(placement: AdPlacement): placement is InterstitialPlacement {
  return placement === 'interstitial_settle';
}

function isPlaceholderUnitId(adUnitId: string): boolean {
  return !adUnitId || adUnitId.startsWith('TODO_') || adUnitId.includes('UNIT_ID');
}

/**
 * 流量主「最大激励时长」15 秒：片子可能还是 30 秒，关广告时 isEnded 经常是 false。
 * 看够这段时间再关，按官方发奖处理。
 */
export const REWARDED_MIN_WATCH_MS = 14_000;

/** 插屏：show() 未成功前的等待；成功后改为等关闭，不再当 error。 */
export const INTERSTITIAL_WATCHDOG = {
  openMs: 8_000,
  watchMs: 180_000,
};

/** 激励：show() 仍在等待时不要判 not_ready；真正弹出后再等关闭。 */
export const REWARDED_WATCHDOG = {
  openMs: 12_000,
  pendingMaxMs: 60_000,
  watchMs: 180_000,
};

/**
 * 激励关闭是否算看完。
 * 缺 isEnded、看够 15 秒门槛、或明确播完，都发奖。
 */
export function isRewardedVideoCompleted(
  res?: { isEnded?: boolean } | null,
  shownMs = 0,
): boolean {
  if (shownMs >= REWARDED_MIN_WATCH_MS) {
    return true;
  }
  if (!res || typeof res.isEnded !== 'boolean') {
    return true;
  }
  return res.isEnded === true;
}

/**
 * 微信广告适配器：激励视频 / 插屏 / 大厅原生模板横幅；成对 off、展示后自动再预加载。
 * 仅本文件调用 wx 广告 API；逻辑层只依赖 IAdService。
 *
 * 说明：开发者工具不创建原生广告（insertTextView parent not found）。
 * 占位 adUnitId（TODO_*）时也跳过创建。
 */
export class WxAdAdapter implements IAdService {
  private readonly units: WxAdUnitConfig;
  private readonly readyMap = new Map<AdPlacement, boolean>();
  private readonly rewardedSlots = new Map<RewardedPlacement, RewardedSlot>();
  private readonly interstitialSlots = new Map<InterstitialPlacement, InterstitialSlot>();
  private bannerSlot: BannerSlot | null = null;
  /** 进关后禁止再露出；迟到的 show() 必须据此立刻 hide */
  private bannerWanted = false;
  private disposed = false;

  /**
   * @param units - 各广告位 adUnitId；可用 ad-placements.json 注入
   */
  public constructor(units: WxAdUnitConfig) {
    this.units = units;
  }

  /**
   * 预加载指定广告位。
   * @param placement - 广告位
   */
  public async load(placement: AdPlacement): Promise<void> {
    if (this.disposed) {
      return;
    }
    if (placement === 'banner_lobby') {
      const slot = this.ensureBanner();
      this.readyMap.set(placement, !!slot);
      return;
    }

    if (isRewardedPlacement(placement)) {
      const unitId =
        placement === 'rewarded_revive'
          ? this.units.rewarded_revive
          : this.units.rewarded_crush_extend;
      if (isPlaceholderUnitId(unitId)) {
        this.readyMap.set(placement, false);
        return;
      }
      const slot = this.ensureRewarded(placement);
      if (!slot) {
        this.readyMap.set(placement, false);
        return;
      }
      this.readyMap.set(placement, false);
      try {
        await slot.ad.load();
      } catch {
        this.readyMap.set(placement, false);
      }
      return;
    }

    if (isInterstitialPlacement(placement)) {
      if (isPlaceholderUnitId(this.units.interstitial_settle)) {
        this.readyMap.set(placement, false);
        return;
      }
      const existing = this.interstitialSlots.get(placement);
      const slot = this.ensureInterstitial(placement);
      if (!slot) {
        this.readyMap.set(placement, false);
        return;
      }
      if (!existing) {
        return;
      }
      try {
        await slot.ad.load();
      } catch (err) {
        console.warn('[crush-crush] interstitial load failed', err);
        this.readyMap.set(placement, false);
      }
    }
  }

  /**
   * 展示广告。
   * @param placement - 广告位
   * @returns completed / skipped / error / not_ready
   */
  public async show(placement: AdPlacement): Promise<AdShowResult> {
    if (this.disposed) {
      return 'error';
    }
    if (placement === 'banner_lobby') {
      return this.showBanner();
    }
    // 占位 ID：本地调试直接不可用，避免误触 SDK TextView 报错
    if (isRewardedPlacement(placement)) {
      const unitId =
        placement === 'rewarded_revive'
          ? this.units.rewarded_revive
          : this.units.rewarded_crush_extend;
      if (isPlaceholderUnitId(unitId)) {
        return 'not_ready';
      }
    }
    if (isInterstitialPlacement(placement) && isPlaceholderUnitId(this.units.interstitial_settle)) {
      return 'not_ready';
    }
    // 插屏创建后会自动拉取。未 onLoad 也要 show：否则进门广告永远 not_ready。
    if (isInterstitialPlacement(placement)) {
      return this.showInterstitial(placement);
    }
    if (!this.isReady(placement)) {
      await this.load(placement);
      if (!this.isReady(placement)) {
        return 'not_ready';
      }
    }

    if (isRewardedPlacement(placement)) {
      return this.showRewarded(placement);
    }
    return 'error';
  }

  /**
   * 广告是否就绪。
   * @param placement - 广告位
   */
  public isReady(placement: AdPlacement): boolean {
    return this.readyMap.get(placement) === true;
  }

  /**
   * 隐藏大厅横幅。激励 / 插屏无持续展示，忽略。
   * 即使本地还没记成可见，也要 hide：show() 可能仍在加载，进关后会迟到上屏。
   */
  public hide(placement: AdPlacement): void {
    if (placement !== 'banner_lobby' || this.disposed) {
      return;
    }
    this.bannerWanted = false;
    this.forceHideBanner();
  }

  private forceHideBanner(force = false): void {
    const slot = this.bannerSlot;
    if (!slot) {
      return;
    }
    const showing = force || slot.visible || slot.attached || slot.ad.isShow?.() === true;
    slot.visible = false;
    if (!showing) {
      return;
    }
    try {
      void slot.ad.hide();
    } catch {
      // 模拟器里视图没插上就会 removeImageView not found
    }
    slot.attached = false;
  }

  /**
   * 销毁全部广告实例并卸载监听，防止微信环境泄漏。
   */
  public dispose(): void {
    this.disposed = true;

    for (const slot of this.rewardedSlots.values()) {
      slot.ad.offLoad(slot.onLoad);
      slot.ad.offError(slot.onError);
      slot.ad.offClose();
      try {
        slot.ad.destroy();
      } catch {
        // ignore — destroy 时也可能触发 TextView not found
      }
    }
    this.rewardedSlots.clear();

    for (const slot of this.interstitialSlots.values()) {
      slot.ad.offLoad(slot.onLoad);
      slot.ad.offError(slot.onError);
      slot.ad.offClose();
      try {
        slot.ad.destroy();
      } catch {
        // ignore
      }
    }
    this.interstitialSlots.clear();
    this.destroyBanner();
    this.readyMap.clear();
  }

  private ensureRewarded(placement: RewardedPlacement): RewardedSlot | null {
    const existing = this.rewardedSlots.get(placement);
    if (existing) {
      return existing;
    }

    const adUnitId =
      placement === 'rewarded_revive'
        ? this.units.rewarded_revive
        : this.units.rewarded_crush_extend;

    if (isPlaceholderUnitId(adUnitId)) {
      return null;
    }
    if (!canCreateWxFullscreenAds()) {
      return null;
    }

    let ad: WxRewardedVideoAd;
    try {
      ad = wx.createRewardedVideoAd({ adUnitId });
    } catch (err) {
      console.warn('[crush-crush] createRewardedVideoAd failed', err);
      return null;
    }

    const onLoad = (): void => {
      this.readyMap.set(placement, true);
    };
    const onError = (): void => {
      this.readyMap.set(placement, false);
    };
    ad.onLoad(onLoad);
    ad.onError(onError);

    const slot: RewardedSlot = { ad, onLoad, onError };
    this.rewardedSlots.set(placement, slot);
    return slot;
  }

  private ensureInterstitial(placement: InterstitialPlacement): InterstitialSlot | null {
    const existing = this.interstitialSlots.get(placement);
    if (existing) {
      return existing;
    }

    if (isPlaceholderUnitId(this.units.interstitial_settle)) {
      return null;
    }
    if (!canCreateWxFullscreenAds()) {
      return null;
    }

    let ad: WxInterstitialAd;
    try {
      ad = wx.createInterstitialAd({
        adUnitId: this.units.interstitial_settle,
      });
    } catch (err) {
      console.warn('[crush-crush] createInterstitialAd failed', err);
      return null;
    }

    const onLoad = (): void => {
      this.readyMap.set(placement, true);
    };
    const onError = (err?: { errMsg: string; errCode?: number }): void => {
      console.warn('[crush-crush] interstitial error', err?.errCode, err?.errMsg);
      this.readyMap.set(placement, false);
    };
    ad.onLoad(onLoad);
    ad.onError(onError);

    const slot: InterstitialSlot = { ad, onLoad, onError };
    this.interstitialSlots.set(placement, slot);
    return slot;
  }

  private ensureBanner(): BannerSlot | null {
    if (this.bannerSlot) {
      return this.bannerSlot;
    }
    const adUnitId = this.units.banner_lobby ?? '';
    if (isPlaceholderUnitId(adUnitId)) {
      return null;
    }
    if (!canCreateWxNativeAds() || typeof wx.createCustomAd !== 'function') {
      return null;
    }
    const info = readWxSystemInfo();
    const safeBottom = Math.max(
      0,
      info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight),
    );
    const box = toNativeViewStyle(
      layoutLobbyBannerStyle(
        info.windowWidth || info.screenWidth,
        info.windowHeight || info.screenHeight,
        safeBottom,
      ),
    );
    if (!box) {
      return null;
    }

    let ad: WxCustomAd;
    try {
      ad = wx.createCustomAd({
        adUnitId,
        adIntervals: 30,
        style: {
          left: box.left,
          top: box.top,
          width: box.width,
        },
      });
    } catch (err) {
      console.warn('[crush-crush] createCustomAd failed', err);
      return null;
    }

    const onLoad = (): void => {
      this.readyMap.set('banner_lobby', true);
      if (!this.bannerWanted) {
        this.forceHideBanner();
      }
    };
    const onError = (err?: { errMsg: string; errCode?: number }): void => {
      console.warn(
        '[crush-crush] lobby customAd error',
        err?.errCode,
        err?.errMsg,
      );
      this.readyMap.set('banner_lobby', false);
      if (this.bannerSlot) {
        this.bannerSlot.visible = false;
      }
    };
    const onHide = (): void => {
      if (this.bannerSlot) {
        this.bannerSlot.visible = false;
      }
    };
    ad.onLoad(onLoad);
    ad.onError(onError);
    ad.onHide?.(onHide);

    this.bannerSlot = { ad, onLoad, onError, onHide, visible: false, attached: false };
    return this.bannerSlot;
  }

  private destroyBanner(): void {
    const slot = this.bannerSlot;
    if (!slot) {
      return;
    }
    slot.ad.offLoad(slot.onLoad);
    slot.ad.offError(slot.onError);
    slot.ad.offHide?.(slot.onHide);
    if (slot.attached || !isWxDevtoolsHost()) {
      try {
        slot.ad.destroy();
      } catch {
        // ignore
      }
    }
    this.bannerSlot = null;
  }

  private async showBanner(): Promise<AdShowResult> {
    this.bannerWanted = true;
    const slot = this.ensureBanner();
    if (!slot) {
      this.readyMap.set('banner_lobby', false);
      return 'not_ready';
    }
    if (!this.bannerWanted) {
      this.forceHideBanner();
      return 'error';
    }
    if (slot.visible || slot.ad.isShow?.()) {
      if (!this.bannerWanted) {
        this.forceHideBanner();
        return 'error';
      }
      slot.visible = true;
      this.readyMap.set('banner_lobby', true);
      return 'completed';
    }
    try {
      await slot.ad.show();
      slot.attached = true;
      if (!this.bannerWanted) {
        this.forceHideBanner(true);
        return 'error';
      }
      slot.visible = true;
      this.readyMap.set('banner_lobby', true);
      return 'completed';
    } catch (err) {
      console.warn('[crush-crush] lobby customAd show failed', err);
      slot.visible = false;
      slot.attached = false;
      this.readyMap.set('banner_lobby', false);
      return 'error';
    }
  }

  private showRewarded(placement: RewardedPlacement): Promise<AdShowResult> {
    const slot = this.ensureRewarded(placement);
    if (!slot) {
      return Promise.resolve('not_ready');
    }
    this.readyMap.set(placement, false);

    return new Promise<AdShowResult>((resolve) => {
      let settled = false;
      let shown = false;
      let showInFlight = true;
      let watchdog = 0;
      const startedAt = Date.now();

      const unhookApp = (): void => {
        try {
          wx.offHide?.(onAppHide);
        } catch {
          // ignore
        }
        try {
          wx.offShow?.(onAppShow);
        } catch {
          // ignore
        }
      };

      const finish = (result: AdShowResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (watchdog) {
          clearTimeout(watchdog);
          watchdog = 0;
        }
        unhookApp();
        slot.ad.offClose(onClose);
        resolve(result);
        void this.load(placement);
      };

      const shownMsNow = (): number => Math.max(0, Date.now() - startedAt);

      const onClose = (res?: { isEnded?: boolean }): void => {
        shown = true;
        finish(isRewardedVideoCompleted(res, shownMsNow()) ? 'completed' : 'skipped');
      };

      const onAppHide = (): void => {
        if (settled) {
          return;
        }
        shown = true;
        armWatchdog(180000);
      };

      const onAppShow = (): void => {
        if (settled || shownMsNow() < REWARDED_MIN_WATCH_MS) {
          return;
        }
        setTimeout(() => {
          if (settled) {
            return;
          }
          finish(isRewardedVideoCompleted({}, shownMsNow()) ? 'completed' : 'skipped');
        }, 400);
      };

      const armWatchdog = (ms: number): void => {
        if (settled) {
          return;
        }
        if (watchdog) {
          clearTimeout(watchdog);
        }
        watchdog = setTimeout(() => {
          if (settled) {
            return;
          }
          if (shown) {
            finish(
              isRewardedVideoCompleted({ isEnded: false }, shownMsNow())
                ? 'completed'
                : 'skipped',
            );
            return;
          }
          if (showInFlight && shownMsNow() < REWARDED_WATCHDOG.pendingMaxMs) {
            armWatchdog(REWARDED_WATCHDOG.openMs);
            return;
          }
          finish('not_ready');
        }, ms) as unknown as number;
      };

      slot.ad.onClose(onClose);
      try {
        wx.onHide?.(onAppHide);
        wx.onShow?.(onAppShow);
      } catch {
        // ignore
      }

      armWatchdog(REWARDED_WATCHDOG.openMs);
      slot.ad
        .show()
        .then(() => {
          showInFlight = false;
          shown = true;
          armWatchdog(REWARDED_WATCHDOG.watchMs);
        })
        .catch(() => {
          void slot.ad
            .load()
            .then(() => slot.ad.show())
            .then(() => {
              showInFlight = false;
              shown = true;
              armWatchdog(REWARDED_WATCHDOG.watchMs);
            })
            .catch(() => {
              showInFlight = false;
              if (shown) {
                armWatchdog(REWARDED_WATCHDOG.watchMs);
                return;
              }
              armWatchdog(600);
            });
        });
    });
  }

  private showInterstitial(placement: InterstitialPlacement): Promise<AdShowResult> {
    const slot = this.ensureInterstitial(placement);
    if (!slot) {
      return Promise.resolve('not_ready');
    }

    return new Promise<AdShowResult>((resolve) => {
      let settled = false;
      let shown = false;
      let watchdog = 0;
      const finish = (result: AdShowResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (watchdog) {
          clearTimeout(watchdog);
          watchdog = 0;
        }
        slot.ad.offClose(onClose);
        resolve(result);
      };
      const onClose = (): void => {
        shown = true;
        finish('completed');
        void this.load(placement);
      };
      const armWatchdog = (ms: number): void => {
        if (settled) {
          return;
        }
        if (watchdog) {
          clearTimeout(watchdog);
        }
        watchdog = setTimeout(() => {
          if (settled) {
            return;
          }
          if (shown) {
            finish('completed');
            void this.load(placement);
            return;
          }
          finish('error');
        }, ms) as unknown as number;
      };
      armWatchdog(INTERSTITIAL_WATCHDOG.openMs);
      slot.ad.onClose(onClose);
      slot.ad
        .show()
        .then(() => {
          shown = true;
          armWatchdog(INTERSTITIAL_WATCHDOG.watchMs);
        })
        .catch((err: { errMsg?: string; errCode?: number }) => {
          console.warn(
            '[crush-crush] interstitial show failed',
            err?.errCode,
            err?.errMsg,
          );
          if (err?.errCode !== 2001) {
            void this.load(placement);
          }
          if (shown) {
            armWatchdog(INTERSTITIAL_WATCHDOG.watchMs);
            return;
          }
          finish('error');
        });
    });
  }
}

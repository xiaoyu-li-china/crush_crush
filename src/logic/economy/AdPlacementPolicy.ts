/**
 * IAA 广告位触发策略（纯逻辑，不调用 wx）。
 */
export interface AdPlacementDecision {
  showInterstitial: boolean;
  offerRewardedRevive: boolean;
  offerCrushExtend: boolean;
}

export interface AdPlacementPolicyOptions {
  /** 失败时是否提供激励复活 */
  offerReviveOnFail?: boolean;
  /** 结算插屏：每 N 关一次 */
  interstitialEveryNLevels?: number;
}

/**
 * 决定何时展示插屏 / 是否提供复活入口。
 */
export class AdPlacementPolicy {
  private readonly offerReviveOnFail: boolean;
  private readonly interstitialEveryNLevels: number;

  /**
   * @param options - 策略配置
   */
  public constructor(options: AdPlacementPolicyOptions = {}) {
    this.offerReviveOnFail = options.offerReviveOnFail ?? true;
    this.interstitialEveryNLevels = options.interstitialEveryNLevels ?? 2;
  }

  /**
   * 结算时的广告决策。
   * @param levelId - 关卡 id
   * @param won - 是否通关
   */
  public decideOnSettle(levelId: number, won: boolean): AdPlacementDecision {
    return {
      showInterstitial: this.shouldShowInterstitial(levelId, won, 0, 0, 0),
      offerRewardedRevive: !won && this.offerReviveOnFail,
      offerCrushExtend: false,
    };
  }

  /**
   * 通关插屏：偶数关 + 冷却已过。冷却未到或失败局不弹，避免连关被广告堵住。
   */
  public shouldShowInterstitial(
    levelId: number,
    won: boolean,
    lastShownMs: number,
    nowMs: number,
    cooldownSeconds: number,
  ): boolean {
    if (!won || this.interstitialEveryNLevels <= 0) {
      return false;
    }
    if (levelId % this.interstitialEveryNLevels !== 0) {
      return false;
    }
    if (lastShownMs > 0 && cooldownSeconds > 0 && nowMs - lastShownMs < cooldownSeconds * 1000) {
      return false;
    }
    return true;
  }
}

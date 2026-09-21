/**
 * 失败激励复活策略（纯逻辑，不调用 wx）。
 */
export interface ReviveOffer {
  /** 本关是否还允许看广告复活 */
  allowed: boolean;
  /** 复活后增加的步数 */
  movesGranted: number;
  /** 本关已用复活次数 */
  used: number;
  /** 本关最大复活次数 */
  maxPerLevel: number;
}

export interface RevivePolicyOptions {
  maxRevivesPerLevel: number;
  movesGranted: number;
}

/**
 * 控制每关复活次数与奖励步数。
 */
export class RevivePolicy {
  private reviveUsed = 0;
  private maxRevivesPerLevel: number;
  private readonly movesGranted: number;

  /**
   * @param options - 次数与步数配置
   */
  public constructor(options: RevivePolicyOptions = { maxRevivesPerLevel: 1, movesGranted: 5 }) {
    this.maxRevivesPerLevel = Math.max(0, options.maxRevivesPerLevel);
    this.movesGranted = Math.max(0, options.movesGranted);
  }

  /**
   * 开新关时重置计数。
   */
  public resetForLevel(): void {
    this.reviveUsed = 0;
  }

  /** 本关最多可看几次复活广告。 */
  public setMaxPerLevel(max: number): void {
    this.maxRevivesPerLevel = Math.max(0, Math.floor(max));
  }

  /**
   * 查询当前是否可复活。
   */
  public offer(): ReviveOffer {
    const allowed = this.reviveUsed < this.maxRevivesPerLevel;
    return {
      allowed,
      movesGranted: allowed ? this.movesGranted : 0,
      used: this.reviveUsed,
      maxPerLevel: this.maxRevivesPerLevel,
    };
  }

  /**
   * 成功看完广告后消耗一次复活机会。
   */
  public consume(): void {
    this.reviveUsed += 1;
  }
}

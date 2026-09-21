export interface CrushBurst {
  epicenter: { r: number; c: number };
  radius: number;
  kind: 'tap' | 'chain' | 'finale';
}

/**
 * 粉碎奖励会话数据。
 */
export class CrushRewardModel {
  public remainingMs: number;
  public tapPower: number;
  public charge: number;
  /** 本局粉碎加成分 */
  public crushScore: number;
  /** 累计点击次数 */
  public tapCount: number;
  public readonly explosionsQueued: CrushBurst[] = [];

  public constructor(durationMs: number, tapPower = 1) {
    this.remainingMs = Math.max(0, durationMs);
    this.tapPower = Math.max(0, tapPower);
    this.charge = 0;
    this.crushScore = 0;
    this.tapCount = 0;
  }

  public enqueue(burst: CrushBurst): void {
    this.explosionsQueued.push(burst);
  }

  public dequeue(): CrushBurst | undefined {
    return this.explosionsQueued.shift();
  }

  public clearQueue(): void {
    this.explosionsQueued.length = 0;
  }

  /**
   * 推进倒计时。
   * @returns 是否仍在进行中（未到期）
   */
  public tick(dtMs: number): boolean {
    if (this.remainingMs <= 0) {
      return false;
    }
    this.remainingMs = Math.max(0, this.remainingMs - Math.max(0, dtMs));
    return this.remainingMs > 0;
  }

  public extend(ms: number): void {
    this.remainingMs += Math.max(0, ms);
  }

  /** 立刻清零剩余时间（如清洁盘面已扫空）。 */
  public forceExpire(): void {
    this.remainingMs = 0;
  }

  public isExpired(): boolean {
    return this.remainingMs <= 0;
  }
}

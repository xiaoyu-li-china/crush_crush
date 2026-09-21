/**
 * 普通三消清除特效（开心消消乐式：缩放 + 淡出）。
 * Canvas / Cocos 宿主可读取 progress 驱动绘制。
 */
export class MatchClearFx {
  public row = 0;
  public col = 0;
  /** 0 → 1 */
  public progress = 0;
  public active = false;
  private startMs = 0;
  private durationMs = 220;

  /**
   * 在指定格播放清除。
   * @param row - 行
   * @param col - 列
   * @param nowMs - 当前时间戳
   * @param durationMs - 时长
   */
  public playAt(row: number, col: number, nowMs = Date.now(), durationMs = 220): void {
    this.row = row;
    this.col = col;
    this.progress = 0;
    this.active = true;
    this.startMs = nowMs;
    this.durationMs = durationMs;
  }

  /**
   * @returns 是否仍在播放
   */
  public update(nowMs: number): boolean {
    if (!this.active) {
      return false;
    }
    this.progress = Math.min(1, (nowMs - this.startMs) / this.durationMs);
    if (this.progress >= 1) {
      this.active = false;
      return false;
    }
    return true;
  }

  /** 当前缩放（1 → 0.1） */
  public get scale(): number {
    return 1 - this.progress * 0.9;
  }

  /** 当前透明度（1 → 0） */
  public get alpha(): number {
    return 1 - this.progress;
  }

  public reset(): void {
    this.row = 0;
    this.col = 0;
    this.progress = 0;
    this.active = false;
    this.startMs = 0;
  }
}

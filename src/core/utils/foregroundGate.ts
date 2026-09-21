/**
 * 微信小游戏前后台：广告 / 游戏圈 / 分享 / 切到别的 App 都会打 onHide。
 * 短间隔的 hide+show 当成误报，不把画布停掉；真切走才暂停，回来一定 resume。
 */

export type ForegroundResumeReason = 'show' | 'overlay-end' | 'overlay-abort';

export interface ForegroundGateHooks {
  now: () => number;
  schedule: (fn: () => void, ms: number) => number;
  cancel: (id: number) => void;
  pause: () => void;
  resume: (reason: ForegroundResumeReason) => void;
}

export const FOREGROUND_HIDE_DEBOUNCE_MS = 120;

/**
 * 统一处理 onHide / onShow / 激励广告遮罩，避免假后台把循环停死。
 */
export class ForegroundGate {
  private hidden = false;
  private overlayDepth = 0;
  private hideTimer = 0;
  private ignoreHideUntil = 0;
  private readonly hooks: ForegroundGateHooks;

  public constructor(hooks: ForegroundGateHooks) {
    this.hooks = hooks;
  }

  public isHidden(): boolean {
    return this.hidden;
  }

  public hasOverlay(): boolean {
    return this.overlayDepth > 0;
  }

  /** 原生横幅刚创建时，短时间忽略 onHide，避免大厅一出广告就黑屏。 */
  public holdNativeChrome(ms = 1600): void {
    const until = this.hooks.now() + Math.max(0, ms);
    if (until > this.ignoreHideUntil) {
      this.ignoreHideUntil = until;
    }
  }

  /**
   * 游戏圈按钮已点下：立刻停画布，不要等 onHide，也不要被横幅 hold 挡住。
   * 圈子原生页要 1～2 秒才起来，这期间 JS 还在画就会弹出「微信无响应」。
   */
  public forcePause(): void {
    this.cancelHideTimer();
    if (this.overlayDepth > 0 || this.hidden) {
      return;
    }
    this.hidden = true;
    this.hooks.pause();
  }

  /** 激励视频 / 插屏：自己先停画布，后续假 onHide 不再处理。 */
  public enterOverlay(): void {
    this.overlayDepth += 1;
    this.cancelHideTimer();
    if (!this.hidden) {
      this.hidden = true;
      this.hooks.pause();
    }
  }

  public leaveOverlay(): void {
    this.finishOverlay('overlay-end');
  }

  /** show() 立刻失败（频控 2001 / 未就绪）：不要按关广告去做画布重建。 */
  public abortOverlay(): void {
    this.finishOverlay('overlay-abort');
  }

  public onHide(): void {
    if (this.overlayDepth > 0 || this.hidden) {
      return;
    }
    if (this.hooks.now() < this.ignoreHideUntil) {
      return;
    }
    this.cancelHideTimer();
    this.hideTimer = this.hooks.schedule(() => {
      this.hideTimer = 0;
      if (this.overlayDepth > 0 || this.hidden) {
        return;
      }
      this.hidden = true;
      this.hooks.pause();
    }, FOREGROUND_HIDE_DEBOUNCE_MS);
  }

  public onShow(): void {
    const hadPendingHide = this.hideTimer !== 0;
    this.cancelHideTimer();
    if (this.overlayDepth > 0) {
      return;
    }
    if (!this.hidden && !hadPendingHide) {
      return;
    }
    this.hidden = false;
    this.hooks.resume('show');
  }

  public dispose(): void {
    this.cancelHideTimer();
    this.overlayDepth = 0;
    this.hidden = false;
  }

  private finishOverlay(reason: 'overlay-end' | 'overlay-abort'): void {
    this.overlayDepth = Math.max(0, this.overlayDepth - 1);
    if (this.overlayDepth > 0) {
      return;
    }
    this.hidden = false;
    this.hooks.resume(reason);
  }

  private cancelHideTimer(): void {
    if (!this.hideTimer) {
      return;
    }
    this.hooks.cancel(this.hideTimer);
    this.hideTimer = 0;
  }
}

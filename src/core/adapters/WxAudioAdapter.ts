import type { AudioClipId, IAudio } from '../ports/IAudio';
import { isWxDesktopIdeHost } from '../utils/wxHost';

/** clipId → 本地资源路径（主包短音效 + BGM） */
const CLIP_SRC: Record<string, string> = {
  sfx_swap: 'assets/main/audio/sfx_swap.wav',
  sfx_match: 'assets/main/audio/sfx_match.wav',
  sfx_good: 'assets/main/audio/sfx_good.mp3',
  sfx_great: 'assets/main/audio/sfx_great.mp3',
  sfx_excellent: 'assets/main/audio/sfx_excellent.mp3',
  sfx_win: 'assets/main/audio/sfx_win.wav',
  sfx_fail: 'assets/main/audio/sfx_fail.wav',
  sfx_crush: 'assets/main/audio/sfx_crush.wav',
  sfx_ui: 'assets/main/audio/sfx_ui.wav',
  sfx_shuffle: 'assets/main/audio/sfx_shuffle.wav',
  sfx_hammer: 'assets/main/audio/sfx_hammer.wav',
  sfx_extra: 'assets/main/audio/sfx_extra.wav',
  bgm_main: 'assets/main/audio/bgm_main.mp3',
};

const BGM_ID = 'bgm_main';
const POOL_LIMIT = 8;
const SFX_CLIP_IDS = Object.keys(CLIP_SRC).filter((id) => id !== BGM_ID);

/**
 * 微信 InnerAudio 适配器：短音效池化 + 独立循环 BGM。
 *
 * 短音必须预加载，且禁止在 src 未就绪时 stop()+play()，
 * 否则延迟触发的 Good/Great/Excellent 会静默失败。
 */
export class WxAudioAdapter implements IAudio {
  private muted = false;
  private readonly pool = new Map<string, WxInnerAudioContext[]>();
  private readonly active = new Set<WxInnerAudioContext>();
  private readonly ready = new WeakSet<WxInnerAudioContext>();
  private readonly pendingPlay = new WeakSet<WxInnerAudioContext>();
  private bgm: WxInnerAudioContext | null = null;
  private bgmWanted = false;
  private bgmVolume = 0.42;
  private innerAudioOptionApplied = false;
  private bgmKeepAliveTimer = 0;
  private lastBgmPlayMs = 0;
  private webAudioCtx: WxWebAudioContext | null | undefined;

  public play(clipId: AudioClipId, options?: { loop?: boolean; volume?: number }): void {
    if (clipId === BGM_ID || options?.loop) {
      this.playBgm(clipId, options?.volume);
      return;
    }
    if (this.muted) {
      return;
    }
    const src = CLIP_SRC[clipId];
    if (!src || typeof wx === 'undefined' || typeof wx.createInnerAudioContext !== 'function') {
      return;
    }

    this.applyInnerAudioOption();
    const ctx = this.acquire(src);
    ctx.loop = false;
    ctx.volume = options?.volume ?? 0.85;
    this.startSfx(ctx);
    this.scheduleBgmKeepAlive();
  }

  public suspendForBackground(): void {
    if (!this.bgm) {
      return;
    }
    try {
      this.bgm.pause();
    } catch {
      try {
        this.bgm.stop();
      } catch {
        // ignore
      }
    }
  }

  public resumeFromBackground(): void {
    if (!isWxDesktopIdeHost()) {
      this.unlockWebAudio();
    }
    this.resumeBgm();
  }

  public preloadSfx(): void {
    if (typeof wx === 'undefined' || typeof wx.createInnerAudioContext !== 'function') {
      return;
    }
    this.applyInnerAudioOption();
    if (!isWxDesktopIdeHost()) {
      this.unlockWebAudio();
    }
    for (const id of SFX_CLIP_IDS) {
      const src = CLIP_SRC[id];
      if (src) {
        this.ensurePooled(src);
      }
    }
  }

  public stop(clipId: AudioClipId): void {
    if (clipId === BGM_ID) {
      this.stopBgm(false);
      return;
    }
    const src = CLIP_SRC[clipId];
    if (!src) {
      return;
    }
    const list = this.pool.get(src);
    if (!list) {
      return;
    }
    for (const ctx of list) {
      this.pendingPlay.delete(ctx);
      try {
        ctx.stop();
      } catch {
        // ignore
      }
    }
  }

  public stopAll(): void {
    for (const ctx of this.active) {
      this.pendingPlay.delete(ctx);
      try {
        ctx.stop();
      } catch {
        // ignore
      }
    }
    this.stopBgm(false);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      // 静音：停掉音效，暂停 BGM（保留 want 状态便于恢复）
      for (const ctx of this.active) {
        this.pendingPlay.delete(ctx);
        try {
          ctx.stop();
        } catch {
          // ignore
        }
      }
      if (this.bgm) {
        try {
          this.bgm.pause();
        } catch {
          try {
            this.bgm.stop();
          } catch {
            // ignore
          }
        }
      }
      return;
    }
    if (this.bgmWanted) {
      this.resumeBgm();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public dispose(): void {
    if (this.bgmKeepAliveTimer) {
      clearTimeout(this.bgmKeepAliveTimer);
      this.bgmKeepAliveTimer = 0;
    }
    this.stopAll();
    if (this.bgm) {
      try {
        this.bgm.destroy();
      } catch {
        // ignore
      }
      this.bgm = null;
    }
    for (const list of this.pool.values()) {
      for (const ctx of list) {
        try {
          ctx.destroy();
        } catch {
          // ignore
        }
      }
    }
    this.pool.clear();
    this.active.clear();
  }

  private playBgm(clipId: AudioClipId, volume?: number): void {
    this.bgmWanted = true;
    if (typeof volume === 'number') {
      this.bgmVolume = volume;
    }
    if (this.muted) {
      return;
    }
    const src = CLIP_SRC[clipId] ?? CLIP_SRC[BGM_ID];
    if (!src || typeof wx === 'undefined' || typeof wx.createInnerAudioContext !== 'function') {
      return;
    }
    this.applyInnerAudioOption();
    if (!this.bgm) {
      this.bgm = this.createContext(false);
      this.bgm.src = src;
      this.bgm.loop = true;
      this.bgm.obeyMuteSwitch = false;
      this.bgm.onError((err) => {
        console.warn('[audio] bgm failed', src, err?.errMsg ?? err);
      });
    }
    this.bgm.volume = this.bgmVolume;
    if (!this.shouldKickBgm()) {
      return;
    }
    try {
      this.bgm.play();
      this.lastBgmPlayMs = Date.now();
    } catch {
      // ignore
    }
  }

  private scheduleBgmKeepAlive(): void {
    if (!this.bgmWanted || this.muted) {
      return;
    }
    if (this.bgmKeepAliveTimer) {
      clearTimeout(this.bgmKeepAliveTimer);
    }
    this.bgmKeepAliveTimer = setTimeout(() => {
      this.bgmKeepAliveTimer = 0;
      this.resumeBgm();
    }, 80) as unknown as number;
  }

  private resumeBgm(): void {
    if (!this.bgmWanted || this.muted) {
      return;
    }
    if (!this.bgm) {
      this.playBgm(BGM_ID, this.bgmVolume);
      return;
    }
    this.bgm.volume = this.bgmVolume;
    if (!this.shouldKickBgm()) {
      return;
    }
    try {
      this.bgm.play();
      this.lastBgmPlayMs = Date.now();
    } catch {
      // ignore
    }
  }

  /** paused===false 已在播；系统掐掉后 paused 变 true，必须再 play。 */
  private shouldKickBgm(): boolean {
    if (!this.bgm) {
      return true;
    }
    if (this.bgm.paused === false) {
      return false;
    }
    if (this.bgm.paused === true) {
      return true;
    }
    return this.lastBgmPlayMs === 0 || Date.now() - this.lastBgmPlayMs > 800;
  }

  private stopBgm(clearWant: boolean): void {
    if (clearWant) {
      this.bgmWanted = false;
    }
    if (!this.bgm) {
      return;
    }
    try {
      this.bgm.stop();
    } catch {
      // ignore
    }
  }

  private applyInnerAudioOption(): void {
    if (this.innerAudioOptionApplied) {
      return;
    }
    this.innerAudioOptionApplied = true;
    if (typeof wx.setInnerAudioOption !== 'function') {
      return;
    }
    try {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        mixWithOther: true,
      });
    } catch {
      // 低版本基础库无此接口
    }
  }

  private unlockWebAudio(): void {
    try {
      if (this.webAudioCtx === undefined) {
        this.webAudioCtx = wx.createWebAudioContext?.() ?? null;
      }
      void this.webAudioCtx?.resume?.();
    } catch {
      // ignore
    }
  }

  private startSfx(ctx: WxInnerAudioContext): void {
    if (this.ready.has(ctx)) {
      this.pendingPlay.delete(ctx);
      try {
        ctx.seek?.(0);
      } catch {
        // ignore
      }
      try {
        ctx.play();
      } catch {
        // ignore
      }
      return;
    }
    this.pendingPlay.add(ctx);
    try {
      ctx.play();
    } catch {
      // src 未就绪时等 onCanplay 再播
    }
  }

  private ensurePooled(src: string): WxInnerAudioContext {
    let list = this.pool.get(src);
    if (!list) {
      list = [];
      this.pool.set(src, list);
    }
    if (list.length > 0) {
      return list[0]!;
    }
    const ctx = this.createSfxContext(src);
    list.push(ctx);
    return ctx;
  }

  private acquire(src: string): WxInnerAudioContext {
    let list = this.pool.get(src);
    if (!list) {
      list = [];
      this.pool.set(src, list);
    }
    for (const ctx of list) {
      if (!this.active.has(ctx)) {
        this.active.add(ctx);
        return ctx;
      }
    }
    if (list.length >= POOL_LIMIT) {
      const reuse = list[0]!;
      this.active.add(reuse);
      return reuse;
    }
    const ctx = this.createSfxContext(src);
    list.push(ctx);
    this.active.add(ctx);
    return ctx;
  }

  private createSfxContext(src: string): WxInnerAudioContext {
    const ctx = this.createContext(true);
    ctx.autoplay = false;
    ctx.loop = false;
    ctx.obeyMuteSwitch = false;
    ctx.onCanplay?.(() => {
      this.ready.add(ctx);
      if (this.pendingPlay.has(ctx)) {
        this.pendingPlay.delete(ctx);
        try {
          ctx.play();
        } catch {
          // ignore
        }
      }
    });
    ctx.onEnded(() => this.active.delete(ctx));
    ctx.onError((err) => {
      console.warn('[audio] sfx failed', src, err?.errMsg ?? err);
      this.active.delete(ctx);
      this.pendingPlay.delete(ctx);
    });
    ctx.src = src;
    return ctx;
  }

  private createContext(useWebAudio: boolean): WxInnerAudioContext {
    try {
      const useWeb = useWebAudio && !isWxDesktopIdeHost();
      return wx.createInnerAudioContext(
        useWeb ? { useWebAudioImplement: true } : undefined,
      );
    } catch {
      return wx.createInnerAudioContext();
    }
  }
}

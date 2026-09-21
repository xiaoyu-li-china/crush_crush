/**
 * 游戏圈推荐：玩家在局内点「推荐」，内容出现在「发现-游戏」好友推荐流。
 * openlink 是官方常量，不是 MP 后台自己生成的帖子链接。
 * 基础库 ≥ 3.6.7（推荐组件文档要求 3.7.6）。
 */

export const GAME_RECOMMEND_OPENLINK =
  'TWFRCqV5WeM2AkMXhKwJ03MhfPOieJfAsvXKUbWvQFQtLyyA5etMPabBehga950uzfZcH3Vi3QeEh41xRGEVFw';

export type GameRecommendResult = 'shown' | 'unsupported' | 'error';

export function canCreateGameRecommend(): boolean {
  try {
    return typeof wx !== 'undefined' && typeof wx.createPageManager === 'function';
  } catch {
    return false;
  }
}

/**
 * 预加载并拉起官方推荐半屏。失败不抛错，由界面提示。
 */
export class GameRecommendLauncher {
  private manager: WxPageManager | null = null;
  private loadPromise: Promise<boolean> | null = null;

  public async preload(): Promise<boolean> {
    if (!canCreateGameRecommend()) {
      return false;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadPromise = this.loadNow();
    return this.loadPromise;
  }

  public async show(): Promise<GameRecommendResult> {
    if (!canCreateGameRecommend()) {
      return 'unsupported';
    }
    try {
      const ok = await this.preload();
      if (!ok || !this.manager) {
        return 'error';
      }
      await this.manager.show({ openlink: GAME_RECOMMEND_OPENLINK });
      return 'shown';
    } catch {
      this.reset();
      return 'error';
    }
  }

  public dispose(): void {
    try {
      this.manager?.destroy?.();
    } catch {
      // ignore
    }
    this.reset();
  }

  private reset(): void {
    this.manager = null;
    this.loadPromise = null;
  }

  private async loadNow(): Promise<boolean> {
    try {
      const manager = wx.createPageManager!();
      await manager.load({ openlink: GAME_RECOMMEND_OPENLINK });
      this.manager = manager;
      return true;
    } catch {
      this.reset();
      return false;
    }
  }
}

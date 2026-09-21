/**
 * 微信小游戏分享：右上角转发 / 朋友圈 + 主动拉起转发。
 * 全页面统一入口；文案由外部按当前界面动态提供。
 */

export interface SharePayload {
  title: string;
  imageUrl?: string;
  /** 公众平台「分享图片」过审后的编号，须与官方 imageUrl 成对传入 */
  imageUrlId?: string;
  query?: string;
}

export type SharePayloadProvider = () => SharePayload;

export interface ShareCardMessage {
  title: string;
  imageUrl: string;
  imageUrlId?: string;
  query: string;
}

const DEFAULT_IMAGE = 'assets/main/share/lobby-500x400.jpg';

export interface OfficialAccountPost {
  title: string;
  content: string;
  tags: string[];
  recommendTitle: string;
  images?: string[];
}

/**
 * 启用全局分享菜单并注册转发 / 朋友圈回调。
 */
export class WxShareAdapter {
  private provider: SharePayloadProvider = () => ({
    title: '升级新体验，快来一起玩',
    imageUrl: DEFAULT_IMAGE,
    query: '',
  });

  private enabled = false;

  /**
   * 绑定动态分享内容（大厅 / 对局 / 结算等）。
   */
  public setProvider(provider: SharePayloadProvider): void {
    this.provider = provider;
  }

  /**
   * 开启右上角「转发」「分享到朋友圈」，并在任意页面生效。
   */
  public enable(): void {
    if (this.enabled) {
      return;
    }
    this.enabled = true;

    if (typeof wx.showShareMenu === 'function') {
      try {
        wx.showShareMenu({
          withShareTicket: true,
          menus: ['shareAppMessage', 'shareTimeline'],
        });
      } catch (err) {
        console.warn('[crush-crush] showShareMenu failed', err);
      }
    }

    if (typeof wx.onShareAppMessage === 'function') {
      wx.onShareAppMessage(() => this.buildMessage());
    }
    if (typeof wx.onShareTimeline === 'function') {
      wx.onShareTimeline(() => this.buildTimeline());
    }
  }

  /**
   * 用户点击游戏内「分享」按钮时主动拉起转发（需在触摸回调里调用）。
   */
  public shareToFriend(): boolean {
    const payload = this.buildMessage();
    if (typeof wx.shareAppMessage !== 'function') {
      return false;
    }
    try {
      wx.shareAppMessage(payload);
      return true;
    } catch (err) {
      console.warn('[crush-crush] shareAppMessage failed', err);
      return false;
    }
  }

  /**
   * 拉起公众号贴图发表页。小游戏环境若无此接口则返回 false。
   * 取消 / 完成都会 resolve，方便把画布循环拉回来。
   */
  public shareToOfficialAccount(post: OfficialAccountPost): Promise<boolean> {
    const shareToOfficialAccount = wx.shareToOfficialAccount;
    if (typeof shareToOfficialAccount !== 'function') {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = (opened: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(opened);
      };
      try {
        shareToOfficialAccount({
          title: post.title,
          content: post.content,
          tags: post.tags.slice(0, 10),
          images: post.images,
          recommendTitle: post.recommendTitle,
          success: (res) => {
            console.info('[crush-crush] official-account post', res.status, res.postUrl);
            done(true);
          },
          fail: (err) => {
            console.warn('[crush-crush] shareToOfficialAccount failed', err);
            done(true);
          },
          complete: () => done(true),
        });
      } catch (err) {
        console.warn('[crush-crush] shareToOfficialAccount threw', err);
        done(false);
      }
    });
  }

  /**
   * 海报分享菜单：好友 / 朋友圈 / 保存；部分基础库会带「发表到公众号」。
   * 用户取消也会 complete，必须据此恢复游戏循环。
   */
  public sharePoster(path: string, entrancePath = ''): Promise<boolean> {
    const showShareImageMenu = wx.showShareImageMenu;
    if (!path || typeof showShareImageMenu !== 'function') {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = (opened: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(opened);
      };
      try {
        showShareImageMenu({
          path,
          needShowEntrance: true,
          entrancePath,
          success: () => done(true),
          fail: () => done(true),
          complete: () => done(true),
        });
      } catch (err) {
        console.warn('[crush-crush] showShareImageMenu failed', err);
        done(false);
      }
    });
  }

  public dispose(): void {
    if (typeof wx.offShareAppMessage === 'function') {
      wx.offShareAppMessage();
    }
    if (typeof wx.offShareTimeline === 'function') {
      wx.offShareTimeline();
    }
    this.enabled = false;
  }

  private buildMessage(): ShareCardMessage {
    return this.normalize(this.provider());
  }

  private buildTimeline(): ShareCardMessage {
    const p = this.provider();
    const title = p.title.length > 28 ? `${p.title.slice(0, 26)}…` : p.title;
    return this.normalize({ ...p, title });
  }

  private normalize(p: SharePayload): ShareCardMessage {
    const imageUrlId = p.imageUrlId?.trim();
    const message: ShareCardMessage = {
      title: p.title || '升级新体验，快来一起玩',
      imageUrl: p.imageUrl || DEFAULT_IMAGE,
      query: p.query || '',
    };
    if (imageUrlId) {
      message.imageUrlId = imageUrlId;
    }
    return message;
  }
}

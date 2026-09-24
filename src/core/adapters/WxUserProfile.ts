/**
 * 微信用户资料（小游戏官方能力）。
 *
 * 小游戏正确做法：wx.createUserInfoButton → 用户点击授权 → 回调里拿头像昵称
 * 不要用 getUserProfile（那是小程序接口，新版常无弹窗 / 只返回匿名「微信用户」）
 * 真实微信号：永远拿不到
 */

export const WX_PROFILE_STORAGE_KEY = 'crush_wx_profile';
/** 首次进入是否已问过授权（含跳过） */
export const WX_PROFILE_ASKED_KEY = 'crush_wx_profile_asked';

export function hasAskedWxProfile(): boolean {
  const api = wxApi();
  if (!api?.getStorageSync) {
    return false;
  }
  try {
    return !!api.getStorageSync(WX_PROFILE_ASKED_KEY);
  } catch {
    return false;
  }
}

export function markWxProfileAsked(): void {
  const api = wxApi();
  if (!api?.setStorageSync) {
    return;
  }
  try {
    api.setStorageSync(WX_PROFILE_ASKED_KEY, 1);
  } catch {
    // ignore
  }
}

export interface WxUserProfile {
  nickName: string;
  avatarUrl: string;
  wxId: string;
}

export interface WxUserInfoButtonHandle {
  destroy: () => void;
}

type WxProfileCache = {
  nickName?: string;
  avatarUrl?: string;
  updatedAt?: number;
};

type WxExt = typeof wx & {
  getSetting?: (opts: {
    success?: (res: { authSetting?: Record<string, boolean> }) => void;
    fail?: () => void;
  }) => void;
  createUserInfoButton?: (opts: {
    type: 'text' | 'image';
    text?: string;
    withCredentials?: boolean;
    lang?: string;
    style: Record<string, string | number>;
  }) => {
    show: () => void;
    hide: () => void;
    destroy: () => void;
    onTap: (cb: (res: {
      errMsg: string;
      rawData?: string;
      userInfo?: { nickName?: string; avatarUrl?: string };
    }) => void) => void;
  };
  showModal?: (opts: {
    title?: string;
    content: string;
    showCancel?: boolean;
    confirmText?: string;
  }) => void;
};

function wxApi(): WxExt | null {
  try {
    if (typeof wx === 'undefined') {
      return null;
    }
    return wx as WxExt;
  } catch {
    return null;
  }
}

export function hasRealWxProfile(profile: WxUserProfile | null | undefined): boolean {
  return !!(profile && profile.avatarUrl);
}

export function readCachedWxProfile(fallbackWxId = ''): WxUserProfile | null {
  const api = wxApi();
  if (!api?.getStorageSync) {
    return null;
  }
  try {
    const raw = api.getStorageSync(WX_PROFILE_STORAGE_KEY) as WxProfileCache | string | undefined;
    const data = typeof raw === 'string'
      ? (JSON.parse(raw) as WxProfileCache)
      : raw;
    if (!data || typeof data !== 'object') {
      return null;
    }
    const nickName = String(data.nickName || '').trim();
    const avatarUrl = String(data.avatarUrl || '').trim();
    if (!avatarUrl) {
      return null;
    }
    return {
      nickName: nickName || '微信用户',
      avatarUrl,
      wxId: fallbackWxId,
    };
  } catch {
    return null;
  }
}

export function saveCachedWxProfile(profile: { nickName: string; avatarUrl: string }): void {
  const api = wxApi();
  if (!api?.setStorageSync) {
    return;
  }
  try {
    api.setStorageSync(WX_PROFILE_STORAGE_KEY, {
      nickName: profile.nickName.trim(),
      avatarUrl: profile.avatarUrl.trim(),
      updatedAt: Date.now(),
    } satisfies WxProfileCache);
  } catch {
    // ignore
  }
}

function parseUserInfo(raw: {
  nickName?: string;
  avatarUrl?: string;
} | null | undefined): { nickName: string; avatarUrl: string } | null {
  if (!raw) {
    return null;
  }
  const nickName = String(raw.nickName || '').trim();
  const avatarUrl = String(raw.avatarUrl || '').trim();
  if (!avatarUrl) {
    return null;
  }
  return {
    nickName: nickName || '微信用户',
    avatarUrl,
  };
}

export function humanizeAuthError(errMsg: string): string {
  const msg = String(errMsg || '');
  // 开发者向细节只打日志；给玩家看短文案
  if (
    msg.includes('privacy')
    || msg.includes('1025')
    || msg.includes('1026')
    || msg.includes('112')
    || msg.includes('please go to mp')
    || msg.includes('api scope is not declared')
  ) {
    console.warn(
      '[crush-crush][auth] 需在公众平台《用户隐私保护指引》声明「用户信息（昵称、头像）」并开启隐私弹窗',
      msg,
    );
    return '暂时无法获取头像，不影响继续玩';
  }
  if (msg.includes('auth deny') || msg.includes('deny') || msg.includes('cancel')) {
    return '已跳过授权，可随时在下次进入时再授权';
  }
  if (!msg) {
    return '暂时无法获取头像，不影响继续玩';
  }
  console.warn('[crush-crush][auth]', msg);
  return '暂时无法获取头像，不影响继续玩';
}

export function showAuthFailModal(message: string): void {
  const api = wxApi();
  if (typeof (api as { showToast?: Function } | null)?.showToast === 'function') {
    try {
      (api as { showToast: (o: { title: string; icon: string; duration: number }) => void }).showToast({
        title: message.slice(0, 14),
        icon: 'none',
        duration: 2500,
      });
      return;
    } catch {
      // fallthrough
    }
  }
  console.warn('[crush-crush][auth]', message);
}

export function getUserInfoAuthState(): Promise<'authorized' | 'denied' | 'unknown'> {
  const api = wxApi();
  if (!api?.getSetting) {
    return Promise.resolve('unknown');
  }
  return new Promise((resolve) => {
    try {
      api.getSetting!({
        success: (res) => {
          const flag = res.authSetting?.['scope.userInfo'];
          if (flag === true) {
            resolve('authorized');
            return;
          }
          if (flag === false) {
            resolve('denied');
            return;
          }
          resolve('unknown');
        },
        fail: () => resolve('unknown'),
      });
    } catch {
      resolve('unknown');
    }
  });
}

export function fetchWxUserInfoOnce(): Promise<{ nickName: string; avatarUrl: string } | null> {
  const api = wxApi();
  if (!api?.getUserInfo) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      api.getUserInfo!({
        withCredentials: false,
        lang: 'zh_CN',
        success: (res) => resolve(parseUserInfo(res.userInfo)),
        fail: () => resolve(null),
      });
    } catch {
      resolve(null);
    }
  });
}

/** 静默：已授权则取资料；不弹窗。 */
export async function ensureWxUserProfile(fallbackWxId = ''): Promise<WxUserProfile | null> {
  const cached = readCachedWxProfile(fallbackWxId);
  if (hasRealWxProfile(cached)) {
    return { ...cached!, wxId: fallbackWxId || cached!.wxId };
  }
  const auth = await getUserInfoAuthState();
  if (auth === 'authorized') {
    const info = await fetchWxUserInfoOnce();
    if (info) {
      saveCachedWxProfile(info);
      return { ...info, wxId: fallbackWxId };
    }
  }
  return null;
}

/**
 * 挂载小游戏官方授权按钮（必须用这个，不要用 getUserProfile）。
 * 同步创建，不要先 await，否则按钮可能点了没反应。
 */
export function mountWxUserInfoAuthButton(input: {
  left: number;
  top: number;
  width: number;
  height: number;
  text?: string;
  onProfile: (profile: { nickName: string; avatarUrl: string }) => void;
  onFail: (message: string) => void;
}): WxUserInfoButtonHandle | null {
  const api = wxApi();
  if (!api?.createUserInfoButton) {
    input.onFail('当前环境不支持微信授权按钮，请用手机微信打开体验版');
    return null;
  }

  try {
    const button = api.createUserInfoButton({
      type: 'text',
      text: input.text || '展示我的微信头像（可选）',
      withCredentials: false,
      lang: 'zh_CN',
      style: {
        left: Math.round(input.left),
        top: Math.round(input.top),
        width: Math.round(input.width),
        height: Math.round(input.height),
        lineHeight: Math.round(input.height),
        backgroundColor: '#1c7ed6',
        color: '#ffffff',
        textAlign: 'center',
        fontSize: 14,
        borderRadius: 18,
      },
    });

    button.onTap((res) => {
      console.info('[crush-crush] userInfoButton tap', res?.errMsg, !!res?.userInfo, !!res?.rawData);
      const ok = String(res?.errMsg || '').includes(':ok');
      if (ok) {
        const parsed = parseUserInfo(res.userInfo);
        if (parsed) {
          saveCachedWxProfile(parsed);
          input.onProfile(parsed);
          return;
        }
        // 授权成功但回调没带齐字段：再拉一次
        void fetchWxUserInfoOnce().then((info) => {
          if (info) {
            saveCachedWxProfile(info);
            input.onProfile(info);
            return;
          }
          input.onFail(humanizeAuthError('privacy not declared'));
        });
        return;
      }
      input.onFail(humanizeAuthError(res?.errMsg || ''));
    });

    try {
      button.show();
    } catch {
      // ignore
    }

    return {
      destroy: () => {
        try {
          button.hide();
        } catch {
          // ignore
        }
        try {
          button.destroy();
        } catch {
          // ignore
        }
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    input.onFail(humanizeAuthError(message));
    return null;
  }
}

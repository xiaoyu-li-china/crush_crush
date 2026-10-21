/** 当前小游戏宿主：微信 / 抖音等。 */

export type MiniGameHostId = 'wechat' | 'douyin' | 'unknown';

export function markMiniGameHost(id: MiniGameHostId): void {
  (globalThis as { __CRUSH_HOST__?: MiniGameHostId }).__CRUSH_HOST__ = id;
}

export function readMiniGameHost(): MiniGameHostId {
  const id = (globalThis as { __CRUSH_HOST__?: MiniGameHostId }).__CRUSH_HOST__;
  if (id === 'douyin' || id === 'wechat') {
    return id;
  }
  if (typeof tt !== 'undefined') {
    return 'douyin';
  }
  if (typeof wx !== 'undefined') {
    return 'wechat';
  }
  return 'unknown';
}

export function isDouyinMiniGameHost(): boolean {
  return readMiniGameHost() === 'douyin';
}

export type MiniProgramEnvVersion = 'develop' | 'trial' | 'release';

/** 微信 envVersion + 抖音 getEnvInfoSync.microapp.envType */
export function readMiniProgramEnvVersion(): MiniProgramEnvVersion | null {
  try {
    if (typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function') {
      const env = wx.getAccountInfoSync()?.miniProgram?.envVersion;
      if (env === 'develop' || env === 'trial' || env === 'release') {
        return env;
      }
    }
  } catch {
    // ignore
  }
  try {
    if (typeof tt !== 'undefined' && typeof tt.getEnvInfoSync === 'function') {
      const envType = (
        tt.getEnvInfoSync() as { microapp?: { envType?: string } } | undefined
      )?.microapp?.envType;
      if (envType === 'development' || envType === 'develop') {
        return 'develop';
      }
      if (envType === 'preview' || envType === 'trial') {
        return 'trial';
      }
      if (envType === 'production' || envType === 'release') {
        return 'release';
      }
    }
  } catch {
    // ignore
  }
  return null;
}

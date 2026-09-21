import type { IStorage } from '../ports/IStorage';

/**
 * 微信本地存储适配器。
 * 仅本文件允许调用 wx.* Storage API。
 */
export class WxStorageAdapter implements IStorage {
  public async get<T>(key: string): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      wx.getStorage({
        key,
        success: (res) => {
          if (res.data === undefined || res.data === '') {
            resolve(null);
            return;
          }
          resolve(res.data as T);
        },
        fail: (err) => {
          const msg = String(err.errMsg || '');
          // 仅「没有这份档」当空档；其它失败要抛出，避免启动时写成新号把通关覆盖掉。
          if (/not found|data empty/i.test(msg)) {
            resolve(null);
            return;
          }
          reject(new Error(`WxStorageAdapter.get failed: ${msg}`));
        },
      });
    });
  }

  public async set<T>(key: string, value: T): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      wx.setStorage({
        key,
        data: value,
        success: () => resolve(),
        fail: (err) => reject(new Error(`WxStorageAdapter.set failed: ${err.errMsg}`)),
      });
    });
  }

  public async remove(key: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      wx.removeStorage({
        key,
        success: () => resolve(),
        fail: (err) => {
          if (err.errMsg.includes('removeStorage:fail')) {
            resolve();
            return;
          }
          reject(new Error(`WxStorageAdapter.remove failed: ${err.errMsg}`));
        },
      });
    });
  }

  public async clear(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      wx.clearStorage({
        success: () => resolve(),
        fail: (err) => reject(new Error(`WxStorageAdapter.clear failed: ${err.errMsg}`)),
      });
    });
  }
}

/**
 * 玩家设置：静音开关读写本地存储。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  IAdService,
  IAnalytics,
  IAudio,
  IPlatform,
  IStorage,
} from '../../src/core';
import { StorageKeys } from '../../src/core';
import { GameSession, type GameSessionDeps } from '../../src/services/GameSession';

function createDeps(): GameSessionDeps & { storage: IStorage } {
  const store = new Map<string, unknown>();
  let muted = false;
  const storage: IStorage = {
    async get<T>(key: string): Promise<T | null> {
      return store.has(key) ? (store.get(key) as T) : null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
    async clear(): Promise<void> {
      store.clear();
    },
  };

  return {
    storage,
    ads: {
      async load() {},
      async show() {
        return 'not_ready';
      },
      isReady: () => false,
      dispose() {},
    } satisfies IAdService,
    audio: {
      play() {},
      stop() {},
      stopAll() {},
      setMuted(value: boolean) {
        muted = value;
      },
      isMuted: () => muted,
      dispose() {},
    } satisfies IAudio,
    analytics: { track() {} } satisfies IAnalytics,
    platform: {
      getSystemInfo: () => ({
        brand: 'test',
        model: 'test',
        platform: 'devtools',
        system: 'test',
        SDKVersion: '2.19.0',
        windowWidth: 375,
        windowHeight: 667,
        pixelRatio: 2,
      }),
      onShow() {},
      onHide() {},
      offShow() {},
      offHide() {},
    } satisfies IPlatform,
  };
}

describe('PlayerSettings', () => {
  it('init 读取已保存的静音设置', async () => {
    const deps = createDeps();
    await deps.storage.set(StorageKeys.Settings, { muted: true });
    const session = new GameSession(deps);
    await session.init();
    assert.equal(session.isMuted(), true);
  });

  it('setMuted 会写入本地设置', async () => {
    const deps = createDeps();
    const session = new GameSession(deps);
    await session.init();
    session.setMuted(true);
    assert.equal(session.isMuted(), true);
    const saved = await deps.storage.get<{ muted: boolean }>(StorageKeys.Settings);
    assert.equal(saved?.muted, true);
  });
});

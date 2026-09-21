/**
 * 大厅公告：看过一次后写入本地，冷启动不再弹出。
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
import noticeJson from '../../src/config/notice.json';

function createDeps(): GameSessionDeps & { storage: IStorage } {
  const store = new Map<string, unknown>();
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
      setMuted() {},
      isMuted: () => false,
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

describe('LobbyNotice', () => {
  it('init 后未看过公告', async () => {
    const session = new GameSession(createDeps());
    await session.init();
    assert.equal(session.hasSeenNotice(noticeJson.id), false);
  });

  it('标记已读后会写入本地，下次启动不再弹出', async () => {
    const deps = createDeps();
    const session = new GameSession(deps);
    await session.init();
    await session.markNoticeSeen(noticeJson.id);
    assert.equal(session.hasSeenNotice(noticeJson.id), true);
    const saved = await deps.storage.get<string[]>(StorageKeys.NoticeSeen);
    assert.deepEqual(saved, [noticeJson.id]);

    const again = new GameSession(deps);
    await again.init();
    assert.equal(again.hasSeenNotice(noticeJson.id), true);
  });

  it('空 id 不会写入', async () => {
    const deps = createDeps();
    const session = new GameSession(deps);
    await session.init();
    await session.markNoticeSeen('');
    assert.equal(session.hasSeenNotice(''), false);
    assert.equal(await deps.storage.get(StorageKeys.NoticeSeen), null);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeMahjongProgress, mergeMahjongSavedRun } from '../../src/logic/save/mergeMahjongCloudSave';
import { mergePlayerCloudSnapshots } from '../../src/logic/save/mergePlayerCloudSave';
import { emptyMahjongProgress } from '../../src/logic/mahjong/MahjongProgress';
import { DEFAULT_LEVEL_PROGRESS } from '../../src/logic/level/LevelProgress';
import { EMPTY_BOOSTER_WALLET } from '../../src/logic/economy/BoosterEconomy';
import { EMPTY_DAILY_LOOP } from '../../src/logic/economy/DailyLoop';
import type { PlayerCloudSnapshot } from '../../src/core/ports/IPlayerCloudSave';
import { createMemoryDeps } from '../helpers/memory-deps';
import { GameSession } from '../../src/services/GameSession';
import { StorageKeys } from '../../src/core';
import type { IPlayerCloudSave } from '../../src/core/ports/IPlayerCloudSave';

describe('麻将云存档合并', () => {
  it('金币与最高关取更大值，星级按关取 max', () => {
    const local = emptyMahjongProgress();
    local.coins = 40;
    local.highestUnlocked = 3;
    local.starsByLevel = { '1': 3 };
    const remote = emptyMahjongProgress();
    remote.coins = 120;
    remote.highestUnlocked = 5;
    remote.starsByLevel = { '1': 2, '2': 35 };
    const merged = mergeMahjongProgress(local, remote);
    assert.equal(merged.coins, 120);
    assert.equal(merged.highestUnlocked, 5);
    assert.equal(merged.starsByLevel['1'], 3);
    assert.equal(merged.starsByLevel['2'], 35);
  });

  it('未完成局：保留剩余牌更少的一档', () => {
    const local = {
      level: 2,
      pile: [0, 0],
      slots: [1],
      remainingMs: 60000,
      starsThisRun: 1,
      coinsThisRun: 0,
      adSlotUnlocked: false,
      phase: 'playing' as const,
      themeId: 'default',
      typeCount: 6,
      seed: 1,
      tools: emptyMahjongProgress().tools,
      guideSeen: true,
    };
    const remote = {
      ...local,
      pile: [0, 0, 0, 0, 0],
      slots: [],
    };
    const pick = mergeMahjongSavedRun(local, remote);
    assert.equal(pick?.pile.length, 2);
  });

  it('GameSession init 合并云端麻将进度到本地', async () => {
    const cloudSave: IPlayerCloudSave = {
      isEnabled: () => true,
      async pull() {
        return {
          updatedAt: 99,
          progress: { ...DEFAULT_LEVEL_PROGRESS, levelScores: {} },
          boosters: { ...EMPTY_BOOSTER_WALLET },
          settings: { muted: false },
          daily: { ...EMPTY_DAILY_LOOP },
          mahjong: {
            ...emptyMahjongProgress(),
            coins: 200,
            highestUnlocked: 8,
            starsByLevel: { '7': 35 },
          },
        };
      },
      async push() {},
    };
    const deps = createMemoryDeps();
    deps.cloudSave = cloudSave;
    const session = new GameSession(deps);
    await session.init();
    assert.equal(session.mahjong.getProgress().coins, 200);
    assert.equal(session.mahjong.getProgress().highestUnlocked, 8);
    const saved = await deps.storage.get<{ coins: number }>(StorageKeys.MahjongHallProgress);
    assert.equal(saved?.coins, 200);
  });

  it('mergePlayerCloudSnapshots 含 mahjong 字段', () => {
    const merged = mergePlayerCloudSnapshots(
      {
        updatedAt: 1,
        progress: { ...DEFAULT_LEVEL_PROGRESS, levelScores: {} },
        boosters: { ...EMPTY_BOOSTER_WALLET },
        settings: { muted: false },
        daily: { ...EMPTY_DAILY_LOOP },
        mahjong: { ...emptyMahjongProgress(), coins: 10 },
      },
      null,
    );
    assert.equal(merged.mahjong?.coins, 10);
  });
});

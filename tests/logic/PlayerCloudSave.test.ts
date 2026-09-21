import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergePlayerCloudSnapshots } from '../../src/logic/save/mergePlayerCloudSave';
import { DEFAULT_LEVEL_PROGRESS } from '../../src/logic/level/LevelProgress';
import { EMPTY_BOOSTER_WALLET } from '../../src/logic/economy/BoosterEconomy';
import { EMPTY_DAILY_LOOP } from '../../src/logic/economy/DailyLoop';
import { createMemoryDeps } from '../helpers/memory-deps';
import { GameSession } from '../../src/services/GameSession';
import { StorageKeys } from '../../src/core';
import type { IPlayerCloudSave, PlayerCloudSnapshot } from '../../src/core/ports/IPlayerCloudSave';

function snap(partial: Partial<PlayerCloudSnapshot> = {}): PlayerCloudSnapshot {
  return {
    updatedAt: 1,
    progress: { ...DEFAULT_LEVEL_PROGRESS, levelScores: {} },
    boosters: { ...EMPTY_BOOSTER_WALLET },
    settings: { muted: false },
    daily: { ...EMPTY_DAILY_LOOP },
    ...partial,
  };
}

describe('mergePlayerCloudSnapshots', () => {
  it('换机：云端更高关卡覆盖本地新号', () => {
    const local = snap({
      progress: {
        ...DEFAULT_LEVEL_PROGRESS,
        highestLevelId: 1,
        levelScores: {},
      },
    });
    const remote = snap({
      updatedAt: 9,
      progress: {
        schemaVersion: 1,
        highestLevelId: 8,
        totalScore: 5000,
        lastPlayedLevelId: 7,
        levelScores: { '7': 900 },
      },
      boosters: { hammer: 2, shuffle: 0, extraMoves: 1 },
    });
    const merged = mergePlayerCloudSnapshots(local, remote);
    assert.equal(merged.progress.highestLevelId, 8);
    assert.equal(merged.progress.levelScores?.['7'], 900);
    assert.equal(merged.boosters.hammer, 2);
  });

  it('邀请码以云端为准，锤子额度取更大', () => {
    const merged = mergePlayerCloudSnapshots(
      snap({
        invite: { code: 'LOCAL234', creditHammer: 1, claimedAsInvitee: false },
      }),
      snap({
        invite: { code: 'REMOTE23', creditHammer: 4, claimedAsInvitee: true },
      }),
    );
    assert.equal(merged.invite?.code, 'REMOTE23');
    assert.equal(merged.invite?.creditHammer, 4);
    assert.equal(merged.invite?.claimedAsInvitee, true);
  });

  it('两边都有进度时取更高关、更高分', () => {
    const merged = mergePlayerCloudSnapshots(
      snap({
        progress: {
          schemaVersion: 1,
          highestLevelId: 5,
          totalScore: 100,
          lastPlayedLevelId: 4,
          levelScores: { '1': 80, '4': 20 },
        },
      }),
      snap({
        progress: {
          schemaVersion: 1,
          highestLevelId: 4,
          totalScore: 200,
          lastPlayedLevelId: 3,
          levelScores: { '1': 50, '3': 40 },
        },
      }),
    );
    assert.equal(merged.progress.highestLevelId, 5);
    assert.equal(merged.progress.levelScores?.['1'], 80);
    assert.equal(merged.progress.levelScores?.['3'], 40);
  });
});

describe('GameSession cloud save', () => {
  it('init 会把云端通关进度写回本地', async () => {
    const cloudStore: { snap: PlayerCloudSnapshot | null } = { snap: null };
    const cloudSave: IPlayerCloudSave = {
      isEnabled: () => true,
      async pull() {
        return {
          updatedAt: 10,
          progress: {
            schemaVersion: 1,
            highestLevelId: 6,
            totalScore: 1,
            lastPlayedLevelId: 5,
            levelScores: { '5': 1 },
          },
          boosters: { hammer: 3, shuffle: 0, extraMoves: 0 },
          settings: { muted: false },
          daily: { ...EMPTY_DAILY_LOOP },
        };
      },
      async push(snapshot) {
        cloudStore.snap = snapshot;
      },
    };
    const deps = createMemoryDeps();
    deps.cloudSave = cloudSave;
    const session = new GameSession(deps);
    await session.init();
    assert.equal(session.progress.getHighestLevelId(), 6);
    assert.equal(session.isLevelUnlocked(6), true);
    const saved = await deps.storage.get<{ highestLevelId: number }>(
      StorageKeys.PlayerProgress,
    );
    assert.equal(saved?.highestLevelId, 6);
    assert.ok(cloudStore.snap);
  });

  it('清缓存后不会先用空档盖掉云端通关记录', async () => {
    const pushes: PlayerCloudSnapshot[] = [];
    const cloudSave: IPlayerCloudSave = {
      isEnabled: () => true,
      async pull() {
        return {
          updatedAt: 20,
          progress: {
            schemaVersion: 1,
            highestLevelId: 12,
            totalScore: 9,
            lastPlayedLevelId: 11,
            levelScores: { '1': 10, '11': 30 },
          },
          boosters: { hammer: 1, shuffle: 0, extraMoves: 0 },
          settings: { muted: false },
          daily: { ...EMPTY_DAILY_LOOP },
        };
      },
      async push(snapshot) {
        pushes.push(snapshot);
      },
    };
    const deps = createMemoryDeps();
    deps.cloudSave = cloudSave;
    const session = new GameSession(deps);
    await session.init();
    assert.equal(session.progress.isLevelCleared(11), true);
    assert.equal(session.progress.getBestScore(1), 10);
    assert.ok(pushes.length >= 1);
    assert.equal(pushes[0]!.progress.highestLevelId, 12);
  });

  it('拉云失败不把空本地推上云', async () => {
    const pushes: PlayerCloudSnapshot[] = [];
    const cloudSave: IPlayerCloudSave = {
      isEnabled: () => true,
      async pull() {
        throw new Error('network');
      },
      async push(snapshot) {
        pushes.push(snapshot);
      },
    };
    const deps = createMemoryDeps();
    deps.cloudSave = cloudSave;
    const session = new GameSession(deps);
    await session.init();
    assert.equal(session.progress.getHighestLevelId(), 1);
    session.setMuted(true);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(pushes.length, 0);
  });
});

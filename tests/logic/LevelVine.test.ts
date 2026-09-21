import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getActiveVineNode,
  getVineNodeAt,
  isLevelPlayable,
  isLevelUnlockedForPlayer,
  listAllVineNodes,
  listVineNodesThrough,
  vineNodeCount,
} from '../../src/logic/level/LevelVine';
import { LevelProgress, normalizeLevelProgressData } from '../../src/logic/level/LevelProgress';

describe('LevelVine', () => {
  it('shows first 5 levels before clearing the node', () => {
    const node = getActiveVineNode(3, 10);
    assert.equal(node.nodeIndex, 0);
    assert.deepEqual(node.levelIds, [1, 2, 3, 4, 5]);
    assert.equal(node.clearedInNode, 2);
  });

  it('switches to next node after clearing 5 levels', () => {
    const node = getActiveVineNode(6, 10);
    assert.equal(node.nodeIndex, 1);
    assert.deepEqual(node.levelIds, [6, 7, 8, 9, 10]);
    assert.equal(node.clearedInNode, 0);
  });

  it('lists tree node plus cloud node when playing level 8', () => {
    const nodes = listVineNodesThrough(8, 20);
    assert.equal(nodes.length, 2);
    assert.deepEqual(nodes[0]!.levelIds, [1, 2, 3, 4, 5]);
    assert.equal(nodes[0]!.clearedInNode, 5);
    assert.deepEqual(nodes[1]!.levelIds, [6, 7, 8, 9, 10]);
    assert.equal(nodes[1]!.clearedInNode, 2);
    assert.equal(nodes[1]!.unlocked, true);
  });

  it('lists every configured segment even before unlocking later clouds', () => {
    const nodes = listAllVineNodes(1, 20);
    assert.equal(vineNodeCount(20), 4);
    assert.equal(nodes.length, 4);
    assert.deepEqual(
      nodes.flatMap((node) => node.levelIds),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    );
    assert.equal(nodes[0]!.unlocked, true);
    assert.equal(nodes[1]!.unlocked, false);
    assert.equal(nodes[3]!.unlocked, false);
    assert.deepEqual(nodes[3]!.levelIds, [16, 17, 18, 19, 20]);
  });

  it('adds another cloud segment when levels go past a multiple of 5', () => {
    const nodes = listAllVineNodes(1, 22);
    assert.equal(vineNodeCount(22), 5);
    assert.equal(nodes.length, 5);
    assert.deepEqual(nodes[4]!.levelIds, [21, 22]);
    assert.equal(nodes[4]!.unlocked, false);
  });

  it('unlocks only up to highestLevelId', () => {
    assert.equal(isLevelPlayable(1, 3), true);
    assert.equal(isLevelPlayable(3, 3), true);
    assert.equal(isLevelPlayable(4, 3), false);
    assert.equal(isLevelPlayable(0, 1), false);
    assert.equal(isLevelUnlockedForPlayer(10, 1, 20, false), false);
    assert.equal(isLevelUnlockedForPlayer(10, 1, 20, true), true);
    assert.equal(isLevelUnlockedForPlayer(21, 1, 20, true), false);
  });

  it('总关数 1 时只有第 1 段；未解锁云段 locked', () => {
    const tiny = getActiveVineNode(1, 1);
    assert.equal(tiny.nodeIndex, 0);
    assert.deepEqual(tiny.levelIds, [1]);
    const locked = getVineNodeAt(2, 1, 20);
    assert.equal(locked.nodeIndex, 2);
    assert.equal(locked.unlocked, false);
    const cloud = getVineNodeAt(1, 1, 20);
    assert.equal(cloud.unlocked, false);
    assert.deepEqual(cloud.levelIds, [6, 7, 8, 9, 10]);
  });
});

describe('LevelProgress scores', () => {
  it('keeps best score per level', () => {
    const p = new LevelProgress();
    p.markLevelCleared(1, 1200);
    p.markLevelCleared(1, 800);
    assert.equal(p.getBestScore(1), 1200);
    assert.equal(p.getHighestLevelId(), 2);
    p.markLevelCleared(2, 500);
    assert.equal(p.getHighestLevelId(), 3);
  });

  it('records cleared flags for tree display', () => {
    const p = new LevelProgress();
    assert.equal(p.isLevelCleared(1), false);
    p.markLevelCleared(1, 100);
    p.markLevelCleared(2, 200);
    // highest=3 → 1、2 已通；3 可打未通
    assert.equal(p.isLevelCleared(1), true);
    assert.equal(p.isLevelCleared(2), true);
    assert.equal(p.isLevelCleared(3), false);
    assert.equal(p.getHighestLevelId(), 3);
  });

  it('0 分通关也记账；同分不叠加 totalScore；load 覆盖', () => {
    const p = new LevelProgress();
    p.markLevelCleared(1, 0);
    assert.equal(p.getBestScore(1), 0);
    assert.equal(p.isLevelCleared(1), true);
    p.markLevelCleared(1, 0);
    assert.equal(p.getData().totalScore, 0);
    p.markLevelCleared(1, 10);
    assert.equal(p.getBestScore(1), 10);
    p.markLevelCleared(1, 10);
    assert.equal(p.getData().totalScore, 10);
    p.load({ highestLevelId: 4, totalScore: 1, lastPlayedLevelId: 3 });
    assert.equal(p.getHighestLevelId(), 4);
    assert.equal(p.getBestScore(9), 0);
  });

  it('版本更新读旧档：保留 highest 与分数，不从第 1 关重来', () => {
    const migrated = normalizeLevelProgressData({
      highestLevelId: 8,
      totalScore: 9000,
      lastPlayedLevelId: 7,
      levelScores: { '1': 100, '7': 800 },
    });
    assert.equal(migrated.highestLevelId, 8);
    assert.equal(migrated.levelScores?.['7'], 800);
    const p = new LevelProgress();
    p.load(migrated);
    assert.equal(p.isLevelCleared(7), true);
    assert.equal(p.isLevelCleared(8), false);
    const fromScoresOnly = normalizeLevelProgressData({
      levelScores: { '5': 10 },
    });
    assert.equal(fromScoresOnly.highestLevelId, 6);
  });
});

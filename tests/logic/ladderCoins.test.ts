import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ladderCoinsAvailable,
  ladderCoinsFromScore,
  totalLadderCoinsEarned,
} from '../../src/logic/economy/ladderCoins';
import { LevelProgress } from '../../src/logic/level/LevelProgress';

describe('梯子关卡金币', () => {
  it('每 100 分折算 1 金币', () => {
    assert.equal(ladderCoinsFromScore(0), 0);
    assert.equal(ladderCoinsFromScore(99), 0);
    assert.equal(ladderCoinsFromScore(100), 1);
    assert.equal(ladderCoinsFromScore(2500), 25);
  });

  it('历史最高分汇总并扣除已消耗', () => {
    const p = new LevelProgress({
      highestLevelId: 4,
      totalScore: 0,
      lastPlayedLevelId: 1,
      levelScores: { '1': 1500, '2': 350 },
      ladderCoinsSpent: 5,
    });
    assert.equal(totalLadderCoinsEarned(p.getData().levelScores), 18);
    assert.equal(p.getLadderCoinsAvailable(), 13);
    assert.equal(p.spendLadderCoins(10), true);
    assert.equal(p.getLadderCoinsAvailable(), 3);
    assert.equal(p.spendLadderCoins(10), false);
  });
});

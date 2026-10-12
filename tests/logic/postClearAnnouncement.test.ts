import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPostClearAnnouncement } from '../../src/logic/economy/postClearAnnouncement';
import { buildLeaderboardHint } from '../../src/logic/economy/FriendLeaderboard';

describe('通关公告文案', () => {
  it('优先使用好友排行提示', () => {
    assert.equal(
      buildPostClearAnnouncement({
        clearedLevelId: 5,
        leaderboardHint: '距离上一名只差 1 关，加油！',
      }),
      '距离上一名只差 1 关，加油！',
    );
  });

  it('第 20 关解锁麻将馆', () => {
    assert.match(
      buildPostClearAnnouncement({ clearedLevelId: 20 }),
      /麻将馆/,
    );
  });

  it('第 40 关等非 20 里程碑仍用恭喜通关', () => {
    assert.match(
      buildPostClearAnnouncement({ clearedLevelId: 40 }),
      /40/,
    );
  });

  it('普通关恭喜通关', () => {
    assert.match(
      buildPostClearAnnouncement({ clearedLevelId: 7 }),
      /7/,
    );
  });

  it('buildLeaderboardHint 被超过文案', () => {
    assert.equal(
      buildLeaderboardHint({
        passedBy: '小熊猫',
        selfScore: 8,
        aboveScore: 10,
      }),
      '你被 小熊猫 超过了',
    );
  });
});

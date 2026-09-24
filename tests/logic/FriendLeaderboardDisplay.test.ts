import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatLeaderboardLine,
  formatWxIdDisplay,
  rankFriends,
} from '../../src/logic/economy/FriendLeaderboard';
import {
  clampLeaderboardScroll,
  layoutLeaderboardPanel,
} from '../../src/presentation/ui/LeaderboardPanel';

describe('好友排行展示', () => {
  it('玩家行含排名、昵称、邀请码、关卡', () => {
    const [row] = rankFriends([
      {
        userId: 'wx_openid_abc123456',
        maxLevel: 12,
        bestTimeMs: null,
        completed: false,
        isSelf: true,
        nickName: '小熊猫',
        avatarUrl: 'https://example.com/a.png',
        wxId: 'panda_wx',
        score: 1200,
      },
    ]);
    const line = formatLeaderboardLine(row!);
    assert.equal(line.kind, 'player');
    assert.equal(line.tag, '1');
    assert.equal(line.nickName, '小熊猫');
    assert.equal(line.wxId, 'panda_wx');
    assert.equal(line.score, 1200);
    assert.equal(line.avatarUrl, 'https://example.com/a.png');
    assert.equal(line.highlight, true);
  });

  it('邀请码过长会截断', () => {
    assert.equal(formatWxIdDisplay('abcdefghijklmnop', 8).endsWith('…'), true);
  });

  it('面板为玩家行预留头像与关卡列，奖励固定在列表外', () => {
    const layout = layoutLeaderboardPanel({
      width: 390,
      height: 700,
      hint: '',
      rewardText: '每周一结算',
      rows: [
        {
          tag: '1',
          text: '',
          kind: 'player',
          nickName: '我',
          wxId: 'me01',
          score: 3,
          highlight: true,
        },
      ],
      wrap: (text) => [text],
    });
    assert.equal(layout.title, '好友排行');
    assert.ok(layout.avatarX > layout.tagX);
    assert.ok(layout.scoreX > layout.textX);
    assert.ok(layout.playerRows.some((r) => r.kind === 'player'));
    assert.ok(layout.headerRows.some((r) => r.kind === 'reward' && r.tag === ''));
    assert.ok(layout.listTop >= layout.bodyTop);
    assert.ok(layout.listBottom > layout.listTop);
  });

  it('玩家过多时内容高度大于视口，滚动被限制在范围内', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      tag: String(i + 1),
      text: '',
      kind: 'player' as const,
      nickName: `玩家${i}`,
      wxId: `id${i}`,
      score: 20 - i,
      highlight: i === 0,
    }));
    const layout = layoutLeaderboardPanel({
      width: 390,
      height: 700,
      hint: '',
      rewardText: '每周一结算',
      rows,
      wrap: (text) => [text],
    });
    assert.equal(layout.playerRows.length, 12);
    assert.ok(layout.listContentH > layout.listViewportH);
    assert.equal(clampLeaderboardScroll(-10, layout), 0);
    assert.equal(
      clampLeaderboardScroll(layout.listContentH, layout),
      layout.listContentH - layout.listViewportH,
    );
  });
});

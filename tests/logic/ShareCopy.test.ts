import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildShareQuery, buildShareTitle } from '../../src/logic/share/shareCopy';

describe('分享文案', () => {
  it('结算标题带关卡和分数，query 带邀请码', () => {
    assert.equal(buildShareTitle('result', 7, 1280), '我在第 7 关拿了 1280 分，你来挑战');
    assert.equal(buildShareTitle('lobby', 1, 0), '萌宠粉碎消，沿糖果梯子冲进糖果屋');
    assert.equal(buildShareTitle('playing', 4, 0), '我在第 4 关，你也来试试？');
    assert.equal(buildShareTitle('booster_friend', 3, 0), '我在第 3 关缺个道具，转发给我就行');
    assert.equal(buildShareTitle('booster_group', 3, 0), '发到群里一起玩，第 3 关更好过');
    assert.equal(
      buildShareQuery('booster_friend', 3, 0, 'ABCDEFGH'),
      'from=booster_friend&level=3&inviter=ABCDEFGH',
    );
    assert.equal(
      buildShareQuery('result', 7, 1280, 'ABCDEFGH'),
      'from=result&level=7&score=1280&inviter=ABCDEFGH',
    );
    assert.equal(buildShareQuery('lobby', 1, 0, 'ABCDEFGH'), 'from=lobby&inviter=ABCDEFGH');
  });
});

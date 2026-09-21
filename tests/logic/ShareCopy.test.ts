import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildShareQuery, buildShareTitle } from '../../src/logic/share/shareCopy';

describe('分享文案', () => {
  it('结算标题带关卡和分数，query 带邀请码', () => {
    assert.equal(buildShareTitle('result', 7, 1280), '我在第 7 关拿了 1280 分，你来挑战');
    assert.equal(buildShareTitle('lobby', 1, 0), '萌宠粉碎消，点树上马卡龙就能玩');
    assert.equal(buildShareTitle('playing', 4, 0), '我在第 4 关，你也来试试？');
    assert.equal(
      buildShareQuery('result', 7, 1280, 'ABCDEFGH'),
      'from=result&level=7&score=1280&inviter=ABCDEFGH',
    );
    assert.equal(buildShareQuery('lobby', 1, 0, 'ABCDEFGH'), 'from=lobby&inviter=ABCDEFGH');
  });
});

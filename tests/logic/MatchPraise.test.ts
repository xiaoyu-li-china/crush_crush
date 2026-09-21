import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matchPraiseForScore } from '../../src/logic/fx/MatchPraise';

describe('matchPraiseForScore', () => {
  it('uses 不错 below 40', () => {
    assert.equal(matchPraiseForScore(0).tier, 'good');
    assert.equal(matchPraiseForScore(-1).tier, 'good');
    assert.equal(matchPraiseForScore(30).word, '不错！');
    assert.equal(matchPraiseForScore(39).sfxId, 'sfx_good');
  });

  it('uses 好爽 from 40 up to 79', () => {
    assert.equal(matchPraiseForScore(40).tier, 'great');
    assert.equal(matchPraiseForScore(79).word, '好爽！');
    assert.equal(matchPraiseForScore(79).sfxId, 'sfx_great');
  });

  it('uses 太棒了 at 80 and above', () => {
    assert.equal(matchPraiseForScore(80).tier, 'excellent');
    assert.equal(matchPraiseForScore(240).word, '太棒了！');
    assert.equal(matchPraiseForScore(80).sfxId, 'sfx_excellent');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  makeMahjongFailBanner,
  makeMahjongIntroBanner,
  mahjongFailReasonLabel,
  mahjongIntroSubtitle,
  mahjongResultRevealFrame,
} from '../../src/presentation/mahjong/MahjongStageFx';

describe('麻将馆关卡横幅', () => {
  it('进关副标题含主题与玩法', () => {
    assert.match(mahjongIntroSubtitle('柴犬麻将馆'), /柴犬/);
    assert.match(mahjongIntroSubtitle('柴犬麻将馆'), /三张同牌/);
    assert.equal(mahjongIntroSubtitle(), '三张同牌入槽消除');
  });

  it('进关横幅标题为第 N 关', () => {
    const b = makeMahjongIntroBanner(2, '测试副标题');
    assert.equal(b.kind, 'mahjong_intro');
    assert.equal(b.title, '第 2 关');
    assert.equal(b.subtitle, '测试副标题');
  });

  it('失败横幅与原因文案', () => {
    const b = makeMahjongFailBanner('时间到啦');
    assert.equal(b.kind, 'mahjong_fail');
    assert.equal(b.title, '挑战失败');
    assert.match(mahjongFailReasonLabel('timeout'), /时间/);
  });

  it('结算卡弹入曲线', () => {
    const start = 1000;
    const early = mahjongResultRevealFrame(start, start + 50);
    const late = mahjongResultRevealFrame(start, start + 520);
    assert.ok(early.alpha < late.alpha);
    assert.ok(early.scale < late.scale);
  });
});

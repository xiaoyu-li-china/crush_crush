import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMahjongPilePoses,
  MAHJONG_STAND_EDGE_LONG,
  MAHJONG_STAND_EDGE_SHORT,
  MAHJONG_STAND_FLAT,
} from '../../src/logic/mahjong/MahjongPilePoses';
import {
  clearMahjongPileLayoutCache,
  mahjongBlockShape,
  pilePosesToHits,
  pilePosesToHitsCached,
} from '../../src/presentation/mahjong/MahjongPileLayout';

describe('麻将牌堆布局', () => {
  it('第1关 9 张只用看得清牌面的姿态并占满牌堆区', () => {
    const poses = buildMahjongPilePoses(9, 42, 1);
    const hits = pilePosesToHits(poses, 390, 844);
    assert.equal(hits.length, 9);
    assert.ok(
      poses.every((p) => p.stand !== MAHJONG_STAND_EDGE_SHORT && p.stand !== MAHJONG_STAND_EDGE_LONG),
      '第1关不出现侧立/横立',
    );
    const spreadX = Math.max(...hits.map((h) => h.x)) - Math.min(...hits.map((h) => h.x));
    assert.ok(spreadX > 40, '第1关应散布占满');
  });

  it('第2关 105 张散乱布局且不截断', () => {
    const poses = buildMahjongPilePoses(105, 999, 2);
    assert.equal(poses.length, 105);
    const hits = pilePosesToHits(poses, 390, 844);
    assert.equal(hits.length, 105);
    const xs = hits.map((h) => h.x);
    const ys = hits.map((h) => h.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    assert.ok(spreadX > 55 && spreadY > 55, '应散布并占满牌堆区');
    const rots = hits.filter((h) => Math.abs(h.rot) > 0.04);
    assert.ok(rots.length > 15, '应有轻微随机旋转');
    assert.ok(hits.every((h) => Math.abs(h.rot) < 0.4), '旋转保持轻微，命中框才准');
    const flat = poses.filter((p) => p.stand === MAHJONG_STAND_FLAT).length;
    assert.ok(flat >= 45, '应以平铺为主（参考实物堆）');
    assert.ok(poses.some((p) => p.stand === MAHJONG_STAND_EDGE_SHORT), '应有侧立牌');
  });

  it('命中框尺寸与牌块形状一致', () => {
    const poses = buildMahjongPilePoses(105, 7, 3);
    const hits = pilePosesToHits(poses, 390, 844);
    for (const hit of hits) {
      const shape = mahjongBlockShape(poses[hit.index]!.stand);
      const ratio = hit.h / hit.w;
      assert.ok(Math.abs(ratio - (shape.topH + shape.ext) / shape.topW) < 1e-6);
    }
  });

  it('同种子位姿可复现', () => {
    const a = buildMahjongPilePoses(105, 1, 2);
    const b = buildMahjongPilePoses(105, 1, 2);
    assert.equal(a[50]?.nx, b[50]?.nx);
  });

  it('pilePosesToHitsCached 同 epoch 复用引用', () => {
    clearMahjongPileLayoutCache();
    const poses = buildMahjongPilePoses(12, 3, 2);
    const a = pilePosesToHitsCached(poses, 390, 844, 1);
    const b = pilePosesToHitsCached(poses, 390, 844, 1);
    assert.equal(a.hits, b.hits);
    assert.ok(a.zMax >= 1);
    const c = pilePosesToHitsCached(poses, 390, 844, 2);
    assert.notEqual(a.hits, c.hits);
  });
});

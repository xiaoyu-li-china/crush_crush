/**
 * 四章由易到难：1-5 入门冰，6-10 棉花宝石，11-15 派对异形，16-20 冰雪埋藏。
 * 相邻关要有可辨识差异；6-20 偏「差一点就过」；进关提示「难度提升」。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import levelsJson from '../../src/config/levels.json';
import { levelDifficultyArt, levelDifficultyTip } from '../../src/logic/level/levelDifficultyTip';

const levels = levelsJson as Array<{
  id: number;
  moves: number;
  board?: { rows: number; cols: number };
  ice?: 'all' | { bottomRows?: number; skipTopRows?: number };
  cloud?: { bottomRows?: number; skipTopRows?: number };
  cloudGems?: number;
  cloudRows?: number;
  shape?: string;
  iceStyle?: string;
  buried?: { snowmen?: number; penguins?: number };
  eggs?: unknown;
  vines?: unknown;
  starterSpecials?: { owls?: number; sparkles?: number };
  crushDurationMs: number;
  goals: Array<{ type: string; count?: number }>;
}>;

function level(id: number) {
  const found = levels.find((item) => item.id === id);
  assert.ok(found, `missing level ${id}`);
  return found;
}

function fingerprint(id: number): string {
  const item = level(id);
  const ice =
    item.ice === 'all'
      ? 'all'
      : item.ice && typeof item.ice === 'object'
        ? `ice:${JSON.stringify(item.ice)}`
        : 'no-ice';
  const cloud =
    item.cloud && typeof item.cloud === 'object'
      ? `cloud:${JSON.stringify(item.cloud)}`
      : item.cloudRows
        ? `cloudRows:${item.cloudRows}`
        : 'no-cloud';
  const goals = item.goals.map((g) => g.type).sort().join('+');
  return [
    item.shape ?? 'rect',
    ice,
    cloud,
    item.cloudGems ? `gems:${item.cloudGems}` : 'no-gems',
    item.iceStyle ?? 'no-encase',
    item.buried ? `buried:${JSON.stringify(item.buried)}` : 'no-buried',
    goals,
  ].join('|');
}

describe('引流关卡曲线', () => {
  it('第 1-4 关步数为 14 / 15 / 16 / 20', () => {
    assert.equal(level(1).moves, 14);
    assert.equal(level(2).moves, 15);
    assert.equal(level(3).moves, 16);
    assert.equal(level(4).moves, 20);
  });

  it('第 1 关只收集；凡有冰的关都必须清完全部冰', () => {
    assert.equal(level(1).goals[0]?.type, 'collect');
    assert.equal(level(1).ice, undefined);
    for (const item of levels) {
      if (!item.ice) {
        continue;
      }
      assert.ok(
        item.goals.some((g) => g.type === 'clear_ice'),
        `level ${item.id} has ice but no clear_ice goal`,
      );
    }
  });

  it('1-5 入门：只加冰、无棉花；开局带闪光', () => {
    for (let id = 1; id <= 5; id += 1) {
      const item = level(id);
      assert.equal(item.cloud, undefined, `level ${id} no cloud`);
      assert.equal(item.cloudGems, undefined, `level ${id} no gems`);
      assert.equal(item.starterSpecials?.owls, undefined, `level ${id} no owl`);
      assert.ok((item.starterSpecials?.sparkles ?? 0) >= 1, `level ${id} sparkle`);
    }
    assert.equal(level(1).shape, 'diamond');
    assert.equal(level(2).shape, 'heart');
    assert.ok(level(2).ice);
    assert.equal(level(5).shape, 'diamond');
    assert.ok(level(5).ice);
    assert.ok(
      level(4).goals.filter((g) => g.type === 'collect').length >= 2,
      'level 4 dual collect',
    );
  });

  it('相邻关指纹不同，避免同构连刷', () => {
    for (let id = 1; id < 20; id += 1) {
      assert.notEqual(
        fingerprint(id),
        fingerprint(id + 1),
        `level ${id} and ${id + 1} look too alike`,
      );
    }
  });

  it('6-10 棉花宝石：步数偏紧，相邻玩法可辨识', () => {
    for (let id = 6; id <= 10; id += 1) {
      const item = level(id);
      assert.equal(item.ice, undefined, `level ${id} no ice`);
      assert.ok(item.cloudGems, `level ${id} gems`);
      assert.ok(item.goals.some((g) => g.type === 'collect_gems'));
      assert.equal(item.starterSpecials?.owls, undefined);
      assert.ok(item.moves <= 15, `level ${id} tight moves`);
      assert.ok(item.moves >= 14, `level ${id} playable`);
    }
    // 6 薄底棉 vs 7 底半层 vs 8 菱形 vs 9 十字 vs 10 居中半层清棉
    assert.equal(level(6).cloudRows, 2);
    assert.equal(level(6).cloud, undefined);
    assert.deepEqual(level(7).cloud, { bottomRows: 2, centerCap: 3 });
    assert.equal(level(7).cloudRows, undefined);
    assert.equal(level(7).cloudGems, 10);
    assert.equal(level(8).shape, 'diamond');
    assert.equal(level(9).shape, 'plus');
    assert.deepEqual(level(10).cloud, { bottomRows: 4, topCenterGap: 3, rightClear: 1 });
    assert.ok(level(10).goals.some((g) => g.type === 'clear_cloud'));
  });

  it('11-15 派对异形：有猫头鹰，盘面各不相同', () => {
    const party = [11, 12, 13, 14, 15].map((id) => level(id));
    assert.equal(party[0]!.shape, 'heart');
    assert.equal(party[1]!.shape, 'ring');
    assert.ok(party[1]!.goals.some((g) => g.type === 'clear_cloud'));
    assert.equal(party[2]!.shape, 'double_ring');
    assert.equal(party[3]!.shape, 'split_3_4');
    assert.equal(party[4]!.shape, 'hourglass');
    const shapes = new Set(party.map((item) => item.shape));
    assert.equal(shapes.size, 5, 'party shapes unique');
    for (const item of party) {
      assert.equal(item.iceStyle, undefined, `level ${item.id} no encase`);
      assert.equal(item.buried, undefined, `level ${item.id} no buried`);
      assert.ok((item.starterSpecials?.owls ?? 0) >= 1);
      assert.ok(item.moves <= 15, `level ${item.id} tight`);
      assert.ok(item.moves >= 14, `level ${item.id} playable`);
    }
    assert.ok(party[2]!.ice);
    assert.ok(party[4]!.ice && party[4]!.cloudGems);
  });

  it('6-20 进关都提示难度提升', () => {
    assert.equal(levelDifficultyTip(5), null);
    assert.match(levelDifficultyTip(6) ?? '', /难度提升/);
    assert.match(levelDifficultyTip(7) ?? '', /难度提升/);
    assert.match(levelDifficultyTip(11) ?? '', /难度提升/);
    assert.match(levelDifficultyTip(12) ?? '', /难度提升/);
    assert.match(levelDifficultyTip(16) ?? '', /难度提升/);
    assert.match(levelDifficultyTip(20) ?? '', /难度提升/);
    assert.equal(levelDifficultyArt(5), null);
    assert.equal(levelDifficultyArt(7)?.title, '难度提升');
    assert.equal(levelDifficultyArt(7)?.subtitle, null);
    assert.equal(levelDifficultyArt(6)?.subtitle, '棉花关开始');
    assert.equal(levelDifficultyArt(11)?.subtitle, '异形关卡');
    assert.equal(levelDifficultyArt(16)?.subtitle, '冰雪埋藏');
  });

  it('16-20 冰雪埋藏：由易到难，第 20 关最难', () => {
    for (let id = 16; id <= 20; id += 1) {
      const item = level(id);
      assert.ok(item.ice, `level ${id} ice`);
      assert.ok(item.goals.some((g) => g.type === 'clear_ice'));
      assert.ok((item.starterSpecials?.owls ?? 0) >= 1);
      assert.ok(item.moves <= 15, `level ${id} tight`);
      assert.ok(item.moves >= 14, `level ${id} playable`);
    }
    assert.equal(level(16).shape, 'ring');
    assert.equal(level(16).iceStyle, undefined);
    assert.equal(level(16).buried, undefined);
    assert.equal(level(17).buried?.penguins, 2);
    assert.equal(level(18).iceStyle, 'encase');
    assert.equal(level(19).shape, 'double_ring');
    assert.equal(level(20).shape, 'hourglass');
    assert.ok(level(20).cloudGems && level(20).buried);
    assert.ok(level(20).moves <= level(16).moves);
  });
});

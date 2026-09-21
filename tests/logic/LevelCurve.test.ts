/**
 * 四章由易到难：1-5 入门冰，6-10 棉花宝石，11-15 派对异形，16-20 冰雪埋藏。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import levelsJson from '../../src/config/levels.json';

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

describe('引流关卡曲线', () => {
  it('第 1-4 关步数为 12 / 13 / 15 / 20', () => {
    assert.equal(level(1).moves, 12);
    assert.equal(level(2).moves, 13);
    assert.equal(level(3).moves, 15);
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

  it('1-5 入门：只加冰、无棉花无猫头鹰', () => {
    for (let id = 1; id <= 5; id += 1) {
      const item = level(id);
      assert.equal(item.cloud, undefined, `level ${id} no cloud`);
      assert.equal(item.cloudGems, undefined, `level ${id} no gems`);
      assert.equal(item.starterSpecials, undefined, `level ${id} no specials`);
    }
    assert.equal(level(1).shape, 'diamond');
    assert.equal(level(2).shape, 'heart');
    assert.ok(level(2).ice);
    assert.ok(level(5).ice);
    assert.ok(level(2).goals.some((g) => g.type === 'clear_ice'));
    assert.equal(
      level(4).ice && typeof level(4).ice === 'object' && level(4).ice.bottomRows,
      3,
    );
  });

  it('6-10 棉花宝石：无冰无猫头鹰，盘面由方到异形再到满棉', () => {
    for (let id = 6; id <= 10; id += 1) {
      const item = level(id);
      assert.equal(item.ice, undefined, `level ${id} no ice`);
      assert.ok(item.cloudGems, `level ${id} gems`);
      assert.ok(item.goals.some((g) => g.type === 'collect_gems'));
      assert.equal(item.starterSpecials?.owls, undefined);
    }
    assert.equal(level(6).starterSpecials, undefined);
    assert.equal(level(7).cloudGems, 10);
    assert.ok(level(7).moves >= 20);
    assert.equal(level(8).shape, 'diamond');
    assert.equal(level(8).cloudGems, 10);
    assert.equal(level(9).shape, 'plus');
    assert.equal(level(9).board?.rows, 8);
    assert.equal(level(9).cloudRows, 2);
    assert.equal(level(9).cloudGems, 8);
    assert.ok((level(9).starterSpecials?.sparkles ?? 0) >= 2);
    assert.ok(level(10).cloud && 'skipTopRows' in (level(10).cloud ?? {}));
    assert.ok(level(10).goals.some((g) => g.type === 'clear_cloud'));
    assert.ok((level(10).starterSpecials?.sparkles ?? 0) >= 2);
  });

  it('第 5 关步数不低于 18，第 9-10 关不低于 16', () => {
    assert.ok(level(5).moves >= 18);
    assert.ok(level(9).moves >= 16);
    assert.ok(level(10).moves >= 16);
  });

  it('11-15 派对异形：由易到难，无冰封埋藏', () => {
    const party = [11, 12, 13, 14, 15].map((id) => level(id));
    assert.equal(party[0]!.shape, 'heart');
    assert.equal(party[1]!.shape, 'plus');
    assert.equal(party[1]!.board?.rows, 8);
    assert.equal(party[1]!.moves, 22);
    assert.equal(party[2]!.shape, 'double_ring');
    assert.equal(party[2]!.moves, 22);
    assert.equal(party[3]!.shape, 'split_3_4');
    assert.equal(party[4]!.shape, 'heart');
    for (const item of party) {
      assert.equal(item.iceStyle, undefined, `level ${item.id} no encase`);
      assert.equal(item.buried, undefined, `level ${item.id} no buried`);
      assert.ok((item.starterSpecials?.owls ?? 0) >= 1);
    }
    assert.equal(party[0]!.ice, undefined);
    assert.ok(party[1]!.cloudGems);
    assert.ok((party[1]!.cloudRows ?? 0) <= 2);
    assert.ok(party[2]!.ice);
    assert.ok(party[4]!.ice && party[4]!.cloudGems);
    assert.ok((party[4]!.starterSpecials?.owls ?? 0) >= 2);
    assert.ok(party[3]!.goals.some((g) => g.type === 'collect'));
    assert.ok(party[0]!.moves > party[3]!.moves);
  });

  it('16-20 冰雪埋藏：由易到难，第 20 关最难', () => {
    for (let id = 16; id <= 20; id += 1) {
      const item = level(id);
      assert.ok(item.ice, `level ${id} ice`);
      assert.ok(item.goals.some((g) => g.type === 'clear_ice'));
      assert.ok((item.starterSpecials?.owls ?? 0) >= 1);
    }
    assert.equal(level(16).shape, undefined);
    assert.equal(level(16).iceStyle, undefined);
    assert.equal(level(16).buried, undefined);
    assert.equal(level(16).ice && typeof level(16).ice === 'object' && level(16).ice.bottomRows, 3);
    assert.ok((level(16).moves ?? 0) >= 22);

    assert.equal(level(17).iceStyle, undefined);
    assert.equal(level(17).buried?.penguins, 2);
    assert.equal(level(17).buried?.snowmen ?? 0, 0);

    assert.equal(level(18).iceStyle, 'encase');
    assert.equal(level(18).buried?.penguins, 3);
    assert.ok(level(18).moves <= level(17).moves);

    assert.equal(level(19).shape, 'double_ring');
    assert.equal(level(19).iceStyle, 'encase');
    assert.ok((level(19).buried?.snowmen ?? 0) >= 2);
    assert.ok((level(19).buried?.penguins ?? 0) >= 2);

    assert.equal(level(20).shape, 'hourglass');
    assert.equal(level(20).iceStyle, 'encase');
    assert.ok(level(20).cloudGems && level(20).buried);
    assert.ok((level(20).buried?.penguins ?? 0) >= 4);
    assert.ok((level(20).starterSpecials?.owls ?? 0) >= 2);
    assert.ok(level(20).moves <= level(16).moves);
  });
});

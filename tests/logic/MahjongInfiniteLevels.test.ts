import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertMahjongStandardPileCounts,
  generateMahjongLevel,
  verifySolvablePile,
} from '../../src/logic/mahjong/MahjongGenerator';
import { MAHJONG_BASE_SLOTS } from '../../src/logic/mahjong/MahjongConfig';
import { mahjongLobbyLevelRange } from '../../src/logic/mahjong/MahjongConfig';
import {
  mahjongStandardTiles,
  mahjongTypeCountForGeneration,
  resetMahjongOpsToBundled,
} from '../../src/logic/mahjong/MahjongOpsConfig';
import { createSeededRandom } from '../../src/core/utils/math';
import { pickMahjongThemeForLevel } from '../../src/logic/mahjong/MahjongThemeCatalog';

describe('麻将无限关生成', () => {
  it('第 4 关起种类数与第 2 关一致，第 3 关可随机', () => {
    resetMahjongOpsToBundled();
    const rng = createSeededRandom(42);
    const t2 = mahjongTypeCountForGeneration(2, rng);
    const t4 = mahjongTypeCountForGeneration(4, rng);
    assert.equal(t2, t4);
    const g3 = generateMahjongLevel(3, 'inf');
    const g4 = generateMahjongLevel(4, 'inf');
    assert.equal(g4.typeCount, t2);
    assert.ok(g3.typeCount >= 6 && g3.typeCount <= 8);
  });

  it('抽样高关卡 105 张、可解、种类计数合法', () => {
    resetMahjongOpsToBundled();
    const player = 'infinite-player';
    for (const level of [2, 3, 4, 10, 50, 100, 500, 1000, 3000, 3001]) {
      const gen = generateMahjongLevel(level, player);
      assert.equal(gen.pile.length, mahjongStandardTiles(), `level ${level} length`);
      assert.equal(gen.level, level);
      assert.equal(verifySolvablePile(gen.pile, MAHJONG_BASE_SLOTS), true, `level ${level}`);
      assertMahjongStandardPileCounts(gen.pile);
      assert.ok(gen.themeId.length > 0);
    }
  });

  it('同关种子稳定、不同关牌堆不同', () => {
    const a = generateMahjongLevel(10, 'p1');
    const b = generateMahjongLevel(10, 'p1');
    const c = generateMahjongLevel(11, 'p1');
    assert.deepEqual(a.pile, b.pile);
    assert.notDeepEqual(a.pile, c.pile);
  });

  it('3000+ 关主题循环不影响关卡号种子', () => {
    resetMahjongOpsToBundled();
    const t3000 = pickMahjongThemeForLevel(3000, generateMahjongLevel(3000, 'x').seed);
    const t3001 = pickMahjongThemeForLevel(3001, generateMahjongLevel(3001, 'x').seed);
    assert.ok(t3000.themeId.length > 0);
    assert.ok(t3001.themeId.length > 0);
  });

  it('关卡列表窗口随最高关滚动', () => {
    const low = mahjongLobbyLevelRange(5);
    assert.equal(low.end, 8);
    assert.ok(low.start >= 1);
    const high = mahjongLobbyLevelRange(120);
    assert.equal(high.end, 123);
    assert.ok(high.start > 90);
  });
});

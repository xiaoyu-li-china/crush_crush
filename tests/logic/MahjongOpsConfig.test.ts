import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateMahjongLevel, verifySolvablePile } from '../../src/logic/mahjong/MahjongGenerator';
import { MAHJONG_BASE_SLOTS } from '../../src/logic/mahjong/MahjongConfig';
import {
  applyMahjongOpsConfig,
  getMahjongLevelOverride,
  mahjongCoinCost,
  mahjongThemePickLevel,
  resetMahjongOpsToBundled,
  shouldMahjongOpsSampleLevel,
} from '../../src/logic/mahjong/MahjongOpsConfig';

describe('麻将运营配置 MahjongOpsConfig', () => {
  it('每 50 关抽检命中 1 与 50', () => {
    resetMahjongOpsToBundled();
    assert.equal(shouldMahjongOpsSampleLevel(1), true);
    assert.equal(shouldMahjongOpsSampleLevel(49), false);
    assert.equal(shouldMahjongOpsSampleLevel(50), true);
  });

  it('levelOverrides 可覆盖主题与金币消耗', () => {
    resetMahjongOpsToBundled();
    applyMahjongOpsConfig(
      {
        version: 9,
        economy: { coinCost: 80, coinPerTriple: 1, starPerTriple: 1 },
        levelOverrides: [{ level: 50, themeId: 'default', typeCount: 7 }],
      },
      'cdn',
    );
    assert.equal(mahjongCoinCost(), 80);
    assert.equal(getMahjongLevelOverride(50)?.typeCount, 7);
    const gen = generateMahjongLevel(50, 'test');
    assert.equal(gen.typeCount, 7);
    assert.equal(verifySolvablePile(gen.pile, MAHJONG_BASE_SLOTS), true);
    resetMahjongOpsToBundled();
  });

  it('3000+ 主题循环映射', () => {
    resetMahjongOpsToBundled();
    assert.equal(mahjongThemePickLevel(3000), 3000);
    assert.equal(mahjongThemePickLevel(3001), 3);
    assert.equal(mahjongThemePickLevel(3002), 4);
    resetMahjongOpsToBundled();
  });
});

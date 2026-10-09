import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateMahjongLevel, verifySolvablePile } from '../../src/logic/mahjong/MahjongGenerator';
import { MAHJONG_BASE_SLOTS } from '../../src/logic/mahjong/MahjongConfig';
import {
  applyMahjongThemeManifest,
  resetMahjongThemeManifestToBundled,
  resolveMahjongAssetUrl,
  getMahjongTheme,
  pickMahjongThemeForLevel,
  tileAssetPath,
} from '../../src/logic/mahjong/MahjongThemeCatalog';

describe('麻将 CDN 主题 catalog', () => {
  it('完整 URL 与本地 assets 路径不被改写', () => {
    assert.equal(resolveMahjongAssetUrl('https://cdn.test/mahjong/a.png'), 'https://cdn.test/mahjong/a.png');
    assert.equal(resolveMahjongAssetUrl('assets/main/tiles/red.png'), 'assets/main/tiles/red.png');
  });

  it('CDN 关闭时 themes/ 路径降级为包内 default 贴图', () => {
    resetMahjongThemeManifestToBundled();
    const bunny = getMahjongTheme('bunny_01');
    assert.ok(bunny);
    assert.equal(tileAssetPath(bunny!, 0), 'assets/main/tiles/red.png');
  });

  it('可热替换 manifest 主题列表', () => {
    resetMahjongThemeManifestToBundled();
    applyMahjongThemeManifest({
      version: 99,
      defaultThemeId: 'default',
      themes: [
        {
          themeId: 'default',
          name: '测试',
          tiles: ['assets/main/tiles/red.png'],
        },
      ],
    });
    assert.equal(getMahjongTheme('default')?.name, '测试');
    resetMahjongThemeManifestToBundled();
  });

  it('第 3 关起种子决定主题', () => {
    const t2 = pickMahjongThemeForLevel(2, 123);
    const t3a = pickMahjongThemeForLevel(3, 999);
    const t3b = pickMahjongThemeForLevel(3, 999);
    assert.equal(t2.themeId, 'default');
    assert.equal(t3a.themeId, t3b.themeId);
  });

  it('105 关生成带 themeId 且通过可解性校验', () => {
    const gen = generateMahjongLevel(50, 'player-v11');
    assert.equal(gen.pile.length, 105);
    assert.ok(gen.themeId.length > 0);
    assert.equal(verifySolvablePile(gen.pile, MAHJONG_BASE_SLOTS), true);
  });
});

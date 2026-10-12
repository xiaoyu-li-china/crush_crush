import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MahjongThemeAssets } from '../../src/presentation/mahjong/MahjongThemeAssets';

describe('MahjongThemeAssets', () => {
  it('bunny 主题在包内走 default 贴图路径', async () => {
    const loads: string[] = [];
    const assets = new MahjongThemeAssets(async (src) => {
      loads.push(src);
      if (src.startsWith('assets/main/tiles/')) {
        return { src } as WxImage;
      }
      return null;
    });
    const result = await assets.ensureTheme('bunny_01', 6);
    assert.equal(result.requestedThemeId, 'bunny_01');
    assert.ok(assets.getTileImage('bunny_01', 0));
    assert.ok(loads.every((p) => !p.includes('themes/bunny_01')));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearMahjongTileRasterCache,
  quantizeMahjongTileFaceW,
} from '../../src/presentation/mahjong/MahjongTileRasterCache';

describe('MahjongTileRasterCache', () => {
  it('faceW 量化到 0.25 步长', () => {
    assert.equal(quantizeMahjongTileFaceW(10.12), 10);
    assert.equal(quantizeMahjongTileFaceW(10.38), 10.5);
    assert.equal(quantizeMahjongTileFaceW(3), 6);
  });

  it('clearMahjongTileRasterCache 不抛错', () => {
    clearMahjongTileRasterCache();
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BASIC_TILE_KINDS,
  isBasicTile,
  isHole,
  isMatchable,
  isSpecialTile,
  TileKind,
} from '../../src/logic/board/TileType';

describe('TileType predicates', () => {
  it('基础色可匹配，空/洞/特殊块不可', () => {
    for (const kind of BASIC_TILE_KINDS) {
      assert.equal(isBasicTile(kind), true);
      assert.equal(isMatchable(kind), true);
      assert.equal(isSpecialTile(kind), false);
      assert.equal(isHole(kind), false);
    }
    assert.equal(isMatchable(TileKind.Empty), false);
    assert.equal(isMatchable(TileKind.Hole), false);
    assert.equal(isMatchable(TileKind.Bomb), false);
    assert.equal(isMatchable(TileKind.ColorBomb), false);
    assert.equal(isSpecialTile(TileKind.Bomb), true);
    assert.equal(isSpecialTile(TileKind.ColorBomb), true);
    assert.equal(isHole(TileKind.Hole), true);
    assert.equal(isHole(TileKind.Red), false);
  });
});

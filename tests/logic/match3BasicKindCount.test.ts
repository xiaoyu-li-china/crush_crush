import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BASIC_TILE_KINDS } from '../../src/logic/board/TileType';
import {
  match3BasicKindCount,
  MATCH3_MAX_BASIC_KINDS,
} from '../../src/logic/level/match3BasicKindCount';

describe('梯子关萌宠种类曲线', () => {
  it('共 9 种基础萌宠', () => {
    assert.equal(MATCH3_MAX_BASIC_KINDS, 9);
    assert.equal(BASIC_TILE_KINDS.length, 9);
  });

  it('1–10 保持经典五宠；模板后段与远关递增', () => {
    assert.equal(match3BasicKindCount(1), 5);
    assert.equal(match3BasicKindCount(10), 5);
    assert.equal(match3BasicKindCount(11), 6);
    assert.equal(match3BasicKindCount(16), 7);
    assert.equal(match3BasicKindCount(20), 8);
    assert.equal(match3BasicKindCount(21), 8);
    assert.equal(match3BasicKindCount(27), 9);
    assert.ok(match3BasicKindCount(100) >= 9);
  });

  it('配置可覆盖种类数', () => {
    assert.equal(match3BasicKindCount(99, { basicKindCount: 4 }), 4);
    assert.equal(match3BasicKindCount(99, { basicKindCount: 99 }), 9);
  });
});

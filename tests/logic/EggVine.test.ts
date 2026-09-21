import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BoardModel } from '../../src/logic/board/BoardModel';
import { TileKind } from '../../src/logic/board/TileType';

describe('蛋壳与藤蔓', () => {
  it('邻消会砸碎一层蛋壳', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let i = 0; i < 9; i += 1) {
      const r = Math.floor(i / 3);
      const c = i % 3;
      board.setTile(r, c, TileKind.Red);
    }
    board.egg[4] = 1;
    board.setTile(0, 0, TileKind.Empty);
    const hit = board.chipEggsAdjacentToClears([0], 1);
    assert.equal(hit.length, 0);
    board.setTile(1, 0, TileKind.Empty);
    const hit2 = board.chipEggsAdjacentToClears([3], 1);
    assert.ok(hit2.includes(4));
    assert.equal(board.egg[4], 0);
  });

  it('锤子直接砸在蛋壳上会削一层', () => {
    const board = new BoardModel({ rows: 2, cols: 2 });
    board.setTile(0, 0, TileKind.Red);
    board.egg[0] = 2;
    assert.equal(board.peelCoverAtIndex(0), 'egg');
    assert.equal(board.egg[0], 1);
  });

  it('藤蔓图案各不相同且 web 最密', () => {
    const mk = (pattern: 'scatter' | 'columns' | 'rows' | 'clusters' | 'web') => {
      const board = new BoardModel({ rows: 8, cols: 8 });
      return board.placeVines({ pattern, count: 12, layers: 1 }, 99);
    };
    const scatter = mk('scatter');
    const columns = mk('columns');
    const rows = mk('rows');
    const clusters = mk('clusters');
    const web = mk('web');
    assert.equal(scatter, 12);
    assert.equal(columns, 16);
    assert.equal(rows, 24);
    assert.equal(clusters, 16);
    assert.ok(web > rows);
  });

  it('开局可预置猫头鹰和闪光', () => {
    const board = new BoardModel({ rows: 4, cols: 4 });
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        board.setTile(r, c, TileKind.Red);
      }
    }
    const placed = board.placeStarterSpecials({ owls: 1, sparkles: 2 }, 11);
    assert.equal(placed.owls, 1);
    assert.equal(placed.sparkles, 2);
    let owls = 0;
    let sparks = 0;
    for (let i = 0; i < board.length; i += 1) {
      if (board.cells[i] === TileKind.ColorBomb) {
        owls += 1;
      }
      if (board.sparkles[i] === 1) {
        sparks += 1;
      }
    }
    assert.equal(owls, 1);
    assert.equal(sparks, 2);
  });
});

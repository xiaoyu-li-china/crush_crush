/**
 * MatchFinder：横/纵 ≥3、边界 2 连、空洞、扩容、去重。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BoardModel } from '../../src/logic/board/BoardModel';
import { MatchFinder, MatchSet } from '../../src/logic/board/MatchFinder';
import { TileKind } from '../../src/logic/board/TileType';

function paint(board: BoardModel, rows: TileKind[][]): void {
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < rows[r]!.length; c += 1) {
      board.setTile(r, c, rows[r]![c]!);
    }
  }
}

describe('MatchFinder', () => {
  it('2 连不是三消（下界）', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    paint(board, [
      [TileKind.Red, TileKind.Red, TileKind.Blue],
      [TileKind.Green, TileKind.Yellow, TileKind.Purple],
      [TileKind.Blue, TileKind.Green, TileKind.Yellow],
    ]);
    const set = new MatchFinder().findMatches(board);
    assert.equal(set.isEmpty(), true);
    assert.equal(set.contains(0), false);
  });

  it('横向恰好 3 连命中（等价类：最小合法匹配）', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    paint(board, [
      [TileKind.Red, TileKind.Red, TileKind.Red],
      [TileKind.Green, TileKind.Yellow, TileKind.Purple],
      [TileKind.Blue, TileKind.Green, TileKind.Yellow],
    ]);
    const set = new MatchFinder().findMatches(board);
    assert.equal(set.size, 3);
    assert.equal(set.contains(0), true);
    assert.equal(set.contains(1), true);
    assert.equal(set.contains(2), true);
  });

  it('纵向 4 连全部标记（上界 >3）', () => {
    const board = new BoardModel({ rows: 4, cols: 3 });
    paint(board, [
      [TileKind.Blue, TileKind.Red, TileKind.Green],
      [TileKind.Blue, TileKind.Yellow, TileKind.Purple],
      [TileKind.Blue, TileKind.Green, TileKind.Yellow],
      [TileKind.Blue, TileKind.Red, TileKind.Green],
    ]);
    const set = new MatchFinder().findMatches(board);
    assert.equal(set.size, 4);
    assert.equal(set.contains(0), true);
    assert.equal(set.contains(9), true);
  });

  it('横纵交叉只记一次（去重）', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    paint(board, [
      [TileKind.Red, TileKind.Red, TileKind.Red],
      [TileKind.Red, TileKind.Green, TileKind.Yellow],
      [TileKind.Red, TileKind.Blue, TileKind.Purple],
    ]);
    const set = new MatchFinder().findMatches(board);
    assert.equal(set.size, 5);
    assert.equal(set.contains(0), true);
    assert.equal(set.contains(3), true);
    assert.equal(set.contains(6), true);
  });

  it('Empty / Hole / 特殊块打断连消', () => {
    const board = new BoardModel({ rows: 1, cols: 5 });
    paint(board, [
      [TileKind.Red, TileKind.Red, TileKind.Hole, TileKind.Red, TileKind.Red],
    ]);
    assert.equal(new MatchFinder().findMatches(board).isEmpty(), true);

    paint(board, [
      [TileKind.Red, TileKind.Red, TileKind.Bomb, TileKind.Red, TileKind.Red],
    ]);
    assert.equal(new MatchFinder().findMatches(board).isEmpty(), true);
  });

  it('棋盘大于预分配容量时扩容仍能扫到', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    paint(board, [
      [TileKind.Yellow, TileKind.Yellow, TileKind.Yellow],
      [TileKind.Red, TileKind.Blue, TileKind.Green],
      [TileKind.Purple, TileKind.Red, TileKind.Blue],
    ]);
    const finder = new MatchFinder(4);
    const set = finder.findMatches(board);
    assert.equal(set.size, 3);
    const again = finder.findMatches(board);
    assert.equal(again.size, 3);
  });

  it('MatchSet clear 后为空，contains 扫完 size 才停', () => {
    const set = new MatchSet(4);
    set.indices[0] = 7;
    set.size = 1;
    assert.equal(set.contains(7), true);
    assert.equal(set.contains(8), false);
    set.clear();
    assert.equal(set.isEmpty(), true);
    assert.equal(set.contains(7), false);
  });
});

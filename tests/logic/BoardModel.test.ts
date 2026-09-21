/**
 * BoardModel 单测：生成、交换、回填、固定种子可复现性。
 * 运行：npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSeededRandom } from '../../src/core/utils/math';
import { BoardModel, createEmptyBoard } from '../../src/logic/board/BoardModel';
import { BASIC_TILE_KINDS, TileKind } from '../../src/logic/board/TileType';

/**
 * 使用固定种子填充全部空位。
 * @param board - 棋盘
 * @param seed - 随机种子
 */
function fillWithSeed(board: BoardModel, seed: number): void {
  const random = createSeededRandom(seed);
  const kindCount = BASIC_TILE_KINDS.length;
  board.fillEmpty((_row, _col) => {
    return BASIC_TILE_KINDS[Math.floor(random() * kindCount)]!;
  });
}

/**
 * 将盘面 cells 序列化为字符串，便于断言可复现性。
 * @param board - 棋盘
 * @returns 如 "1,2,3,..."
 */
function serializeCells(board: BoardModel): string {
  return Array.from(board.cells).join(',');
}

/**
 * 将盘面 tileIds 序列化。
 * @param board - 棋盘
 * @returns 如 "1,2,3,..."
 */
function serializeTileIds(board: BoardModel): string {
  return Array.from(board.tileIds).join(',');
}

describe('BoardModel', () => {
  describe('棋盘生成', () => {
    it('createEmptyBoard 默认 7×7 且全为空', () => {
      const board = createEmptyBoard();
      assert.equal(board.size.rows, 7);
      assert.equal(board.size.cols, 7);
      assert.equal(board.length, 49);
      assert.equal(board.version, 0);

      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < 7; c += 1) {
          assert.equal(board.getTile(r, c), TileKind.Empty);
          assert.equal(board.getTileId(r, c), 0);
        }
      }
    });

    it('可创建自定义尺寸棋盘', () => {
      const board = new BoardModel({ rows: 4, cols: 5 });
      assert.equal(board.size.rows, 4);
      assert.equal(board.size.cols, 5);
      assert.equal(board.length, 20);
    });

    it('非法尺寸抛错', () => {
      assert.throws(() => new BoardModel({ rows: 0, cols: 8 }));
      assert.throws(() => new BoardModel({ rows: 8, cols: -1 }));
    });

    it('setTile 写入非空块时分配 tileId，version +1', () => {
      const board = createEmptyBoard(2, 2);
      const beforeVersion = board.version;
      board.setTile(0, 0, TileKind.Red);

      assert.equal(board.getTile(0, 0), TileKind.Red);
      assert.ok(board.getTileId(0, 0) > 0);
      assert.equal(board.version, beforeVersion + 1);
    });
  });

  describe('交换', () => {
    it('swap 交换 kind 与 tileId，且 version 只 +1', () => {
      const board = createEmptyBoard(2, 2);
      board.setTile(0, 0, TileKind.Red);
      board.setTile(0, 1, TileKind.Blue);
      const idA = board.getTileId(0, 0);
      const idB = board.getTileId(0, 1);
      const versionAfterSet = board.version;

      board.swap(0, 0, 0, 1);

      assert.equal(board.getTile(0, 0), TileKind.Blue);
      assert.equal(board.getTile(0, 1), TileKind.Red);
      assert.equal(board.getTileId(0, 0), idB);
      assert.equal(board.getTileId(0, 1), idA);
      assert.equal(board.version, versionAfterSet + 1);
    });

    it('swap 越界抛错', () => {
      const board = createEmptyBoard(2, 2);
      assert.throws(() => board.swap(0, 0, 2, 0));
    });

    it('swap 后再 swap 回原状', () => {
      const board = createEmptyBoard(2, 2);
      board.setTile(1, 0, TileKind.Green);
      board.setTile(1, 1, TileKind.Yellow);
      const snapshot = serializeCells(board) + '|' + serializeTileIds(board);

      board.swap(1, 0, 1, 1);
      board.swap(1, 0, 1, 1);

      assert.equal(serializeCells(board) + '|' + serializeTileIds(board), snapshot);
    });
  });

  describe('回填', () => {
    it('fillEmpty 只填充空位并分配新 tileId', () => {
      const board = createEmptyBoard(2, 2);
      board.setTile(0, 0, TileKind.Purple);
      const keptId = board.getTileId(0, 0);

      board.fillEmpty(() => TileKind.Red);

      assert.equal(board.getTile(0, 0), TileKind.Purple);
      assert.equal(board.getTileId(0, 0), keptId);
      assert.equal(board.getTile(0, 1), TileKind.Red);
      assert.equal(board.getTile(1, 0), TileKind.Red);
      assert.equal(board.getTile(1, 1), TileKind.Red);
      assert.ok(board.getTileId(0, 1) > 0);
      assert.ok(board.getTileId(1, 0) > 0);
      assert.ok(board.getTileId(1, 1) > 0);
    });

    it('无空位时 fillEmpty 不增加 version', () => {
      const board = createEmptyBoard(1, 1);
      board.setTile(0, 0, TileKind.Blue);
      const version = board.version;
      board.fillEmpty(() => TileKind.Red);
      assert.equal(board.version, version);
    });
  });

  describe('固定种子可复现性', () => {
    it('相同 seed 两次 fillWithSeed 得到相同 cells', () => {
      const seed = 20250811;
      const a = createEmptyBoard(8, 8);
      const b = createEmptyBoard(8, 8);

      fillWithSeed(a, seed);
      fillWithSeed(b, seed);

      assert.equal(serializeCells(a), serializeCells(b));
    });

    it('不同 seed 通常得到不同盘面', () => {
      const a = createEmptyBoard(8, 8);
      const b = createEmptyBoard(8, 8);
      fillWithSeed(a, 1);
      fillWithSeed(b, 2);
      assert.notEqual(serializeCells(a), serializeCells(b));
    });

    it('clone 后盘面与 version / nextTileId 游标一致可继续分配', () => {
      const board = createEmptyBoard(3, 3);
      fillWithSeed(board, 42);
      const copy = board.clone();

      assert.equal(serializeCells(copy), serializeCells(board));
      assert.equal(serializeTileIds(copy), serializeTileIds(board));
      assert.equal(copy.version, board.version);
      assert.equal(copy.peekNextTileId(), board.peekNextTileId());
    });
  });
});

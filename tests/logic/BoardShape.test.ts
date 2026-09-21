import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BoardModel } from '../../src/logic/board/BoardModel';
import { applyBoardShape, isCellPlayable } from '../../src/logic/board/BoardShape';
import { generatePlayableBoard } from '../../src/logic/board/BoardGenerator';
import { MatchFinder } from '../../src/logic/board/MatchFinder';
import { MatchResolver } from '../../src/logic/board/MatchResolver';
import { TileKind } from '../../src/logic/board/TileType';

describe('BoardShape diamond', () => {
  it('6x6 diamond has 24 playable cells and holes in corners', () => {
    let playable = 0;
    for (let r = 0; r < 6; r += 1) {
      for (let c = 0; c < 6; c += 1) {
        if (isCellPlayable(r, c, 6, 6, 'diamond')) {
          playable += 1;
        }
      }
    }
    assert.equal(playable, 24);
    assert.equal(isCellPlayable(0, 0, 6, 6, 'diamond'), false);
    assert.equal(isCellPlayable(0, 5, 6, 6, 'diamond'), false);
    assert.equal(isCellPlayable(2, 2, 6, 6, 'diamond'), true);
  });

  it('applyBoardShape + generate leaves holes empty of tiles', () => {
    const board = new BoardModel({ rows: 6, cols: 6 });
    applyBoardShape(board, 'diamond');
    generatePlayableBoard(board, 42);
    assert.equal(board.getTile(0, 0), TileKind.Hole);
    assert.notEqual(board.getTile(2, 2), TileKind.Hole);
    assert.notEqual(board.getTile(2, 2), TileKind.Empty);
  });

  it('gravity packs tiles around holes and fill skips holes', () => {
    const board = new BoardModel({ rows: 6, cols: 6 });
    applyBoardShape(board, 'diamond');
    board.setTile(2, 0, TileKind.Red);
    const resolver = new MatchResolver(new MatchFinder());
    const matches = new MatchFinder().findMatches(board);
    matches.size = 0;
    resolver.resolve(board, matches, {
      seed: 1,
      initialClearIndices: [board.index(2, 3)],
    });
    assert.equal(board.getTile(0, 0), TileKind.Hole);
    assert.equal(board.getTile(5, 5), TileKind.Hole);
  });
});

describe('BoardShape heart', () => {
  it('6x6 heart has a top point and two bottom lobes', () => {
    let playable = 0;
    for (let r = 0; r < 6; r += 1) {
      for (let c = 0; c < 6; c += 1) {
        if (isCellPlayable(r, c, 6, 6, 'heart')) {
          playable += 1;
        }
      }
    }
    assert.equal(playable, 24);
    assert.equal(isCellPlayable(0, 0, 6, 6, 'heart'), false);
    assert.equal(isCellPlayable(0, 2, 6, 6, 'heart'), true);
    assert.equal(isCellPlayable(0, 3, 6, 6, 'heart'), true);
    assert.equal(isCellPlayable(5, 1, 6, 6, 'heart'), true);
    assert.equal(isCellPlayable(5, 4, 6, 6, 'heart'), true);
    assert.equal(isCellPlayable(5, 3, 6, 6, 'heart'), false);
    assert.equal(isCellPlayable(5, 5, 6, 6, 'heart'), true);
  });

  it('applyBoardShape heart keeps corner holes', () => {
    const board = new BoardModel({ rows: 6, cols: 6 });
    applyBoardShape(board, 'heart');
    generatePlayableBoard(board, 7);
    assert.equal(board.getTile(0, 0), TileKind.Hole);
    assert.equal(board.getTile(5, 0), TileKind.Hole);
    assert.notEqual(board.getTile(1, 2), TileKind.Hole);
  });
});

describe('BoardShape split_3_4', () => {
  it('8x8 drops the fourth column and keeps 56 playable cells', () => {
    let playable = 0;
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if (isCellPlayable(r, c, 8, 8, 'split_3_4')) {
          playable += 1;
        }
      }
    }
    assert.equal(playable, 56);
    assert.equal(isCellPlayable(0, 2, 8, 8, 'split_3_4'), true);
    assert.equal(isCellPlayable(0, 3, 8, 8, 'split_3_4'), false);
    assert.equal(isCellPlayable(0, 4, 8, 8, 'split_3_4'), true);
    assert.equal(isCellPlayable(7, 7, 8, 8, 'split_3_4'), true);
  });

  it('applyBoardShape leaves a hole column between two intervals', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    applyBoardShape(board, 'split_3_4');
    generatePlayableBoard(board, 11);
    for (let r = 0; r < 8; r += 1) {
      assert.equal(board.getTile(r, 3), TileKind.Hole);
      assert.notEqual(board.getTile(r, 0), TileKind.Hole);
      assert.notEqual(board.getTile(r, 4), TileKind.Hole);
    }
  });
});

describe('BoardShape plus / ring', () => {
  it('8x8 plus 是十字，约 28 格', () => {
    let playable = 0;
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if (isCellPlayable(r, c, 8, 8, 'plus')) {
          playable += 1;
        }
      }
    }
    assert.equal(playable, 28);
    assert.equal(isCellPlayable(0, 3, 8, 8, 'plus'), true);
    assert.equal(isCellPlayable(0, 0, 8, 8, 'plus'), false);
    assert.equal(isCellPlayable(3, 0, 8, 8, 'plus'), true);
  });

  it('8x8 ring 挖空中心 4x4', () => {
    let playable = 0;
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if (isCellPlayable(r, c, 8, 8, 'ring')) {
          playable += 1;
        }
      }
    }
    assert.equal(playable, 48);
    assert.equal(isCellPlayable(0, 0, 8, 8, 'ring'), true);
    assert.equal(isCellPlayable(3, 3, 8, 8, 'ring'), false);
  });

  it('7x7 double_ring 加一圈动物，中间剩 3x3', () => {
    let playable = 0;
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        if (isCellPlayable(r, c, 7, 7, 'double_ring')) {
          playable += 1;
        }
      }
    }
    assert.equal(playable, 40);
    assert.equal(isCellPlayable(0, 0, 7, 7, 'double_ring'), true);
    assert.equal(isCellPlayable(1, 1, 7, 7, 'double_ring'), true);
    assert.equal(isCellPlayable(2, 2, 7, 7, 'double_ring'), false);
    assert.equal(isCellPlayable(3, 3, 7, 7, 'double_ring'), false);
    assert.equal(isCellPlayable(1, 3, 7, 7, 'ring'), false);
    assert.equal(isCellPlayable(1, 3, 7, 7, 'double_ring'), true);
  });

  it('8x8 hourglass 中间窄、两端宽', () => {
    let playable = 0;
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if (isCellPlayable(r, c, 8, 8, 'hourglass')) {
          playable += 1;
        }
      }
    }
    assert.ok(playable >= 24 && playable <= 44, `playable ${playable}`);
    assert.equal(isCellPlayable(3, 0, 8, 8, 'hourglass'), false);
    assert.equal(isCellPlayable(3, 3, 8, 8, 'hourglass'), true);
    assert.equal(isCellPlayable(0, 3, 8, 8, 'hourglass'), true);
    assert.equal(isCellPlayable(7, 4, 8, 8, 'hourglass'), true);
  });
});

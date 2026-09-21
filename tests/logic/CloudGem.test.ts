import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyBoardShape } from '../../src/logic/board/BoardShape';
import { BoardModel, CLOUD_HIT_LAYERS } from '../../src/logic/board/BoardModel';
import { MatchFinder } from '../../src/logic/board/MatchFinder';
import { MatchResolver } from '../../src/logic/board/MatchResolver';
import { MoveValidator } from '../../src/logic/board/MoveValidator';
import { TileKind } from '../../src/logic/board/TileType';
import { LevelGoals } from '../../src/logic/level/LevelGoals';
import { BoardView } from '../../src/presentation/views/BoardView';
import { GameSession } from '../../src/services/GameSession';
import { createMemoryDeps } from '../helpers/memory-deps';

function coverCell(board: BoardModel, row: number, col: number, layers = CLOUD_HIT_LAYERS): void {
  board.cloud[board.index(row, col)] = layers;
}

function placeAdjacentCottonBoard(): BoardModel {
  const board = new BoardModel({ rows: 4, cols: 3 });
  board.setTile(0, 0, TileKind.Blue);
  board.setTile(0, 1, TileKind.Green);
  board.setTile(0, 2, TileKind.Yellow);
  coverCell(board, 0, 0);
  coverCell(board, 0, 1);
  coverCell(board, 0, 2);
  board.setTile(1, 0, TileKind.Red);
  board.setTile(1, 1, TileKind.Red);
  board.setTile(1, 2, TileKind.Red);
  board.setTile(2, 0, TileKind.Blue);
  board.setTile(2, 1, TileKind.Green);
  board.setTile(2, 2, TileKind.Yellow);
  board.setTile(3, 0, TileKind.Green);
  board.setTile(3, 1, TileKind.Yellow);
  board.setTile(3, 2, TileKind.Blue);
  return board;
}

function refillAdjacentMatch(board: BoardModel): void {
  board.setTile(0, 0, TileKind.Blue);
  board.setTile(0, 1, TileKind.Green);
  board.setTile(0, 2, TileKind.Yellow);
  board.setTile(1, 0, TileKind.Red);
  board.setTile(1, 1, TileKind.Red);
  board.setTile(1, 2, TileKind.Red);
  board.setTile(2, 0, TileKind.Blue);
  board.setTile(2, 1, TileKind.Green);
  board.setTile(2, 2, TileKind.Yellow);
  board.setTile(3, 0, TileKind.Green);
  board.setTile(3, 1, TileKind.Yellow);
  board.setTile(3, 2, TileKind.Blue);
}

describe('cloud gems', () => {
  it('coverBottomRowsWithCloud covers three bottom rows with two layers', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    assert.equal(board.coverBottomRowsWithCloud(3), 24);
    assert.equal(board.getCloud(0, 0), CLOUD_HIT_LAYERS);
    assert.equal(board.getCloud(2, 7), CLOUD_HIT_LAYERS);
    assert.equal(board.getCloud(3, 0), 0);
    assert.equal(board.countCloud(), 24);
  });

  it('coverBottomCloudGems lays two cloud layers over pink balls from the bottom', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(0, 0, TileKind.Hole);
    assert.equal(board.coverBottomCloudGems(4), 4);
    assert.equal(board.getCloud(0, 0), 0);
    assert.equal(board.getGem(0, 0), 0);
    assert.equal(board.getCloud(0, 1), CLOUD_HIT_LAYERS);
    assert.equal(board.getGem(0, 1), 1);
    assert.equal(board.getCloud(1, 1), CLOUD_HIT_LAYERS);
    assert.equal(board.getGem(2, 2), 0);
    assert.equal(board.countCloud(), 4);
  });

  it('cotton-covered animals cannot swap', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 0, TileKind.Green);
    board.setTile(1, 1, TileKind.Yellow);
    board.setTile(1, 2, TileKind.Red);
    board.setTile(2, 0, TileKind.Blue);
    board.setTile(2, 1, TileKind.Green);
    board.setTile(2, 2, TileKind.Yellow);
    coverCell(board, 0, 2);
    const validator = new MoveValidator();
    assert.equal(validator.canSwap(board, 0, 2, 1, 2), false);
    coverCell(board, 0, 2, 0);
    assert.equal(validator.canSwap(board, 0, 2, 1, 2), true);
  });

  it('BoardView ignores pointer on cotton-covered cells', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 0, TileKind.Green);
    board.setTile(1, 1, TileKind.Yellow);
    board.setTile(1, 2, TileKind.Red);
    coverCell(board, 0, 2);
    const intents: Array<[number, number, number, number]> = [];
    const view = new BoardView({ cellSize: 10, originX: 0, originY: 0 });
    view.syncFromBoard(board, true);
    view.bindInput((a, b, c, d) => intents.push([a, b, c, d]));
    assert.equal(view.onPointerDown(25, -5), true);
    assert.equal(view.getSelection(), null);
    view.onPointerUp(25, -15);
    assert.equal(intents.length, 0);
  });

  it('MatchFinder skips cotton-covered animals', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    for (let r = 0; r < 3; r += 1) {
      board.setTile(r, 0, TileKind.Red);
    }
    coverCell(board, 1, 0);
    const finder = new MatchFinder();
    assert.equal(finder.findMatches(board).isEmpty(), true);
    coverCell(board, 1, 0, 0);
    assert.equal(finder.findMatches(board).isEmpty(), false);
  });

  it('one adjacent match chips cotton once; two matches clear it', () => {
    const board = placeAdjacentCottonBoard();
    const finder = new MatchFinder();
    const resolver = new MatchResolver(finder);
    const first = resolver.resolve(board, finder.findMatches(board), {
      seed: 1,
      maxCascade: 1,
    });
    assert.deepEqual([...first.waves[0]!.chippedCloudIndices].sort((a, b) => a - b), [0, 1, 2]);
    assert.equal(board.getCloud(0, 0), 1);
    assert.equal(board.getCloud(0, 1), 1);
    assert.equal(board.getCloud(0, 2), 1);
    assert.equal(board.countCloud(), 3);
    assert.equal(board.getTile(0, 0), TileKind.Blue);

    refillAdjacentMatch(board);
    resolver.resolve(board, finder.findMatches(board), {
      seed: 2,
      maxCascade: 1,
    });
    assert.equal(board.getCloud(0, 0), 0);
    assert.equal(board.getCloud(0, 1), 0);
    assert.equal(board.getCloud(0, 2), 0);
    assert.equal(board.countCloud(), 0);
  });

  it('matching on a cell does not collect the gem until cotton is gone', () => {
    const board = placeAdjacentCottonBoard();
    board.gem[board.index(0, 1)] = 1;
    const finder = new MatchFinder();
    const resolver = new MatchResolver(finder);
    resolver.resolve(board, finder.findMatches(board), {
      seed: 1,
      maxCascade: 1,
    });
    refillAdjacentMatch(board);
    resolver.resolve(board, finder.findMatches(board), {
      seed: 2,
      maxCascade: 1,
    });
    assert.equal(board.getCloud(0, 1), 0);
    assert.equal(board.getGem(0, 1), 1);

    board.setTile(0, 1, TileKind.Red);
    board.setTile(1, 1, TileKind.Red);
    board.setTile(2, 1, TileKind.Red);
    resolver.resolve(board, finder.findMatches(board), {
      seed: 3,
      maxCascade: 1,
    });
    assert.equal(board.getGem(0, 1), 0);
  });

  it('hammer chips one cotton layer and keeps the animal', () => {
    const board = new BoardModel({ rows: 2, cols: 2 });
    board.setTile(0, 0, TileKind.Red);
    coverCell(board, 0, 0);
    board.clearTile(0, 0);
    assert.equal(board.getCloud(0, 0), 1);
    assert.equal(board.getTile(0, 0), TileKind.Red);
    board.clearTile(0, 0);
    assert.equal(board.getCloud(0, 0), 0);
    assert.equal(board.getTile(0, 0), TileKind.Red);
  });

  it('collect_gems goal completes when all balls are taken', () => {
    const goals = new LevelGoals([{ type: 'collect_gems', count: 8 }]);
    goals.bindCollectGemsTarget(8);
    goals.syncCollectGems(8);
    assert.equal(goals.isAllCompleted(), true);
  });

  it('coverPlayableWithCloud skips holes', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    applyBoardShape(board, 'split_3_4');
    assert.equal(board.coverPlayableWithCloud(), 56);
    assert.equal(board.getCloud(0, 3), 0);
    assert.equal(board.getCloud(0, 0), CLOUD_HIT_LAYERS);
    assert.equal(board.getCloud(7, 7), CLOUD_HIT_LAYERS);
  });

  it('split board bottom two cloud rows skip the hole column', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    applyBoardShape(board, 'split_3_4');
    assert.equal(board.coverBottomRowsWithCloud(2), 14);
    assert.equal(board.getCloud(0, 0), CLOUD_HIT_LAYERS);
    assert.equal(board.getCloud(1, 7), CLOUD_HIT_LAYERS);
    assert.equal(board.getCloud(2, 0), 0);
    assert.equal(board.getCloud(0, 3), 0);
  });

  it('cloud over ice: two adjacent matches clear cotton, then a match on the cell breaks ice', () => {
    const board = placeAdjacentCottonBoard();
    board.setIce(0, 1, 1);
    const finder = new MatchFinder();
    const resolver = new MatchResolver(finder);
    resolver.resolve(board, finder.findMatches(board), {
      seed: 1,
      maxCascade: 1,
    });
    refillAdjacentMatch(board);
    resolver.resolve(board, finder.findMatches(board), {
      seed: 2,
      maxCascade: 1,
    });
    assert.equal(board.getCloud(0, 1), 0);
    assert.equal(board.getIce(0, 1), 1);

    board.setTile(0, 1, TileKind.Red);
    board.setTile(1, 1, TileKind.Red);
    board.setTile(2, 1, TileKind.Red);
    const third = resolver.resolve(board, finder.findMatches(board), {
      seed: 3,
      maxCascade: 1,
    });
    assert.ok(third.iceBroken >= 1);
    assert.equal(board.getIce(0, 1), 0);
  });

  it('clear_cloud goal completes when all cotton is gone', () => {
    const goals = new LevelGoals([{ type: 'clear_cloud', count: 56 }]);
    goals.bindClearCloudTarget(56);
    goals.syncClearCloud(56);
    assert.equal(goals.isAllCompleted(), true);
  });

  it('starting a cotton level keeps full cotton until the player matches beside it', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    await session.startLevel(6);
    const board = session.getBoard();
    assert.ok(board);
    assert.equal(board.countCloud(), 14);
    assert.equal(board.getCloud(0, 0), CLOUD_HIT_LAYERS);
    assert.equal(board.getCloud(1, 6), CLOUD_HIT_LAYERS);
    assert.equal(board.getCloud(2, 0), 0);
  });
});

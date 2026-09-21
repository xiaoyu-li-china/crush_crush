import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BoardModel } from '../../src/logic/board/BoardModel';
import { MatchFinder } from '../../src/logic/board/MatchFinder';
import { MatchResolver, type ResolveWave } from '../../src/logic/board/MatchResolver';
import { TileKind } from '../../src/logic/board/TileType';
import { BoardMatchAnimator } from '../../src/presentation/fx/BoardMatchAnimator';

describe('MatchResolver waves', () => {
  it('returns a clear wave and leaves no matches', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    // 底行三连红
    board.setTile(2, 0, TileKind.Red);
    board.setTile(2, 1, TileKind.Red);
    board.setTile(2, 2, TileKind.Red);
    board.setTile(1, 0, TileKind.Blue);
    board.setTile(1, 1, TileKind.Green);
    board.setTile(1, 2, TileKind.Yellow);
    board.setTile(0, 0, TileKind.Purple);
    board.setTile(0, 1, TileKind.Blue);
    board.setTile(0, 2, TileKind.Green);

    const resolver = new MatchResolver(new MatchFinder());
    const matches = new MatchFinder().findMatches(board);
    assert.ok(matches.size >= 3);

    const result = resolver.resolve(board, matches, { seed: 1 });
    assert.equal(result.waves.length, result.cascadeDepth);
    assert.ok(result.waves.length >= 1);
    assert.ok(result.waves[0]!.clearedIndices.length >= 3);
    assert.equal(result.cleared, result.clearedKinds.length);
    assert.equal(new MatchFinder().findMatches(board).size, 0);
  });
});

describe('BoardMatchAnimator', () => {
  it('removes cleared tiles from visuals after clear phase', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(2, 0, TileKind.Red);
    board.setTile(2, 1, TileKind.Red);
    board.setTile(2, 2, TileKind.Red);
    board.setTile(1, 0, TileKind.Blue);
    board.setTile(1, 1, TileKind.Green);
    board.setTile(1, 2, TileKind.Yellow);
    board.setTile(0, 0, TileKind.Purple);
    board.setTile(0, 1, TileKind.Blue);
    board.setTile(0, 2, TileKind.Green);

    const snapshot = {
      rows: 3,
      cols: 3,
      cells: Int8Array.from(board.cells),
      tileIds: Int32Array.from(board.tileIds),
    };

    const resolver = new MatchResolver(new MatchFinder());
    const matches = new MatchFinder().findMatches(board);
    const result = resolver.resolve(board, matches, { seed: 42 });

    const anim = new BoardMatchAnimator();
    let done = false;
    anim.onComplete(() => {
      done = true;
    });
    anim.start(snapshot, result.waves, 0);
    assert.equal(anim.isPlaying(), true);

    // 推过消除阶段
    anim.update(230);
    const afterClear = anim.getVisualTiles();
    const reds = afterClear.filter((t) => t.kind === TileKind.Red);
    assert.equal(reds.length, 0);

    // 跑完全部波次
    let t = 230;
    for (let i = 0; i < 200 && anim.isPlaying(); i += 1) {
      t += 40;
      anim.update(t);
    }
    assert.equal(anim.isPlaying(), false);
    assert.equal(done, true);
  });

  it('pops special sparkle tiles right after clear, not after full settle', () => {
    const board = new BoardModel({ rows: 5, cols: 5 });
    // 四连红 → 合成闪光
    board.setTile(4, 0, TileKind.Blue);
    board.setTile(4, 1, TileKind.Red);
    board.setTile(4, 2, TileKind.Red);
    board.setTile(4, 3, TileKind.Red);
    board.setTile(4, 4, TileKind.Red);
    board.setTile(3, 0, TileKind.Green);
    board.setTile(3, 1, TileKind.Yellow);
    board.setTile(3, 2, TileKind.Purple);
    board.setTile(3, 3, TileKind.Blue);
    board.setTile(3, 4, TileKind.Green);
    board.setTile(2, 0, TileKind.Yellow);
    board.setTile(2, 1, TileKind.Blue);
    board.setTile(2, 2, TileKind.Green);
    board.setTile(2, 3, TileKind.Yellow);
    board.setTile(2, 4, TileKind.Purple);
    board.setTile(1, 0, TileKind.Purple);
    board.setTile(1, 1, TileKind.Green);
    board.setTile(1, 2, TileKind.Blue);
    board.setTile(1, 3, TileKind.Purple);
    board.setTile(1, 4, TileKind.Yellow);
    board.setTile(0, 0, TileKind.Blue);
    board.setTile(0, 1, TileKind.Purple);
    board.setTile(0, 2, TileKind.Yellow);
    board.setTile(0, 3, TileKind.Green);
    board.setTile(0, 4, TileKind.Blue);

    const snapshot = {
      rows: 5,
      cols: 5,
      cells: Int8Array.from(board.cells),
      tileIds: Int32Array.from(board.tileIds),
      sparkles: Uint8Array.from(board.sparkles),
    };

    const resolver = new MatchResolver(new MatchFinder());
    const matches = new MatchFinder().findMatches(board);
    assert.ok(matches.size >= 4);
    const result = resolver.resolve(board, matches, {
      seed: 7,
      preferredSpawnRow: 4,
      preferredSpawnCol: 2,
    });
    assert.ok(result.waves[0]!.specialSpawns.some((s) => s.sparkle));

    const anim = new BoardMatchAnimator();
    anim.start(snapshot, result.waves, 0);

    // 刚过消除：应立刻出现闪光特殊块（CLEAR_MS=200）
    anim.update(210);
    const visuals = anim.getVisualTiles();
    const sparkles = visuals.filter((v) => v.sparkle);
    assert.ok(sparkles.length >= 1, 'special sparkle should appear right after clear');
  });

  it('stop 立刻结束且不触发 onComplete', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(2, 0, TileKind.Red);
    board.setTile(2, 1, TileKind.Red);
    board.setTile(2, 2, TileKind.Red);
    const snapshot = {
      rows: 3,
      cols: 3,
      cells: Int8Array.from(board.cells),
      tileIds: Int32Array.from(board.tileIds),
    };
    const waves: ResolveWave[] = [
      {
        clearedIndices: [6],
        clearedKinds: [TileKind.Red],
        fell: [],
        spawned: [],
        specialSpawns: [],
        chippedCloudIndices: [],
        chippedEggIndices: [],
        chippedVineIndices: [],
      },
    ];
    const anim = new BoardMatchAnimator();
    let done = false;
    anim.onComplete(() => {
      done = true;
    });
    anim.start(snapshot, waves, 0);
    assert.equal(anim.isPlaying(), true);
    anim.stop();
    assert.equal(anim.isPlaying(), false);
    assert.equal(done, false);
    assert.equal(anim.getVisualTiles().length, 0);
  });

  it('counts a wave as cleared only after animals finish popping', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(2, 0, TileKind.Red);
    board.setTile(2, 1, TileKind.Red);
    board.setTile(2, 2, TileKind.Red);
    const snapshot = {
      rows: 3,
      cols: 3,
      cells: Int8Array.from(board.cells),
      tileIds: Int32Array.from(board.tileIds),
    };
    const waves: ResolveWave[] = [
      {
        clearedIndices: [6, 7, 8],
        clearedKinds: [TileKind.Red, TileKind.Red, TileKind.Red],
        fell: [],
        spawned: [],
        specialSpawns: [],
        chippedCloudIndices: [3],
        chippedEggIndices: [],
        chippedVineIndices: [],
      },
    ];
    const anim = new BoardMatchAnimator();
    let finishedHits: number[] | null = null;
    anim.onClearFinished((_wave, hits) => {
      finishedHits = hits;
    });
    anim.start(snapshot, waves, 0);
    assert.equal(anim.getClearedWaveCount(), 0);
    anim.update(100);
    assert.equal(anim.getClearedWaveCount(), 0);
    assert.equal(finishedHits, null);
    anim.update(210);
    assert.equal(anim.getClearedWaveCount(), 1);
    assert.deepEqual(finishedHits, [3]);
  });
});

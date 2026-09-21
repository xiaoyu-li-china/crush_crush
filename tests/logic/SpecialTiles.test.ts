/**
 * 四连闪光同色 / 五连猫头鹰 / 死局洗牌。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BoardModel } from '../../src/logic/board/BoardModel';
import { hasAnyValidMove, shuffleUntilPlayable } from '../../src/logic/board/BoardShuffle';
import { MatchFinder } from '../../src/logic/board/MatchFinder';
import { MatchResolver } from '../../src/logic/board/MatchResolver';
import { MoveValidator } from '../../src/logic/board/MoveValidator';
import { expandSpecialClears, planSpecialSpawns } from '../../src/logic/board/SpecialRules';
import { TileKind } from '../../src/logic/board/TileType';

describe('SpecialRules 合成', () => {
  it('四连生成闪光同色块', () => {
    const board = new BoardModel({ rows: 5, cols: 5 });
    for (let c = 0; c < 4; c += 1) {
      board.setTile(2, c, TileKind.Red);
    }
    board.setTile(2, 4, TileKind.Blue);
    const match = [board.index(2, 0), board.index(2, 1), board.index(2, 2), board.index(2, 3)];
    const spawns = planSpecialSpawns(board, match, 2, 2);
    assert.equal(spawns.length, 1);
    assert.equal(spawns[0]!.kind, TileKind.Red);
    assert.equal(spawns[0]!.sparkle, true);
  });

  it('五连生成超级猫头鹰', () => {
    const board = new BoardModel({ rows: 5, cols: 5 });
    for (let c = 0; c < 5; c += 1) {
      board.setTile(1, c, TileKind.Yellow);
    }
    const match = [0, 1, 2, 3, 4].map((c) => board.index(1, c));
    const spawns = planSpecialSpawns(board, match);
    assert.equal(spawns.length, 1);
    assert.equal(spawns[0]!.kind, TileKind.ColorBomb);
    assert.equal(spawns[0]!.sparkle, false);
  });

  it('闪光块再次三消时小范围爆炸', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(1, 1, TileKind.Red);
    board.setSparkle(1, 1, true);
    board.setTile(0, 0, TileKind.Blue);
    board.setTile(0, 1, TileKind.Green);
    board.setTile(0, 2, TileKind.Yellow);
    board.setTile(1, 0, TileKind.Purple);
    board.setTile(1, 2, TileKind.Blue);
    board.setTile(2, 0, TileKind.Green);
    board.setTile(2, 1, TileKind.Yellow);
    board.setTile(2, 2, TileKind.Purple);

    const clear = expandSpecialClears(board, 1, 1, 1, 2, [board.index(1, 1)]);
    // 中心闪光扩到 3x3 内非空格
    assert.ok(clear.length >= 5);
    assert.ok(clear.includes(board.index(1, 1)));
    assert.ok(clear.includes(board.index(0, 1)));
    assert.ok(clear.includes(board.index(1, 0)));
  });

  it('猫头鹰换色清除同色', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(0, 0, TileKind.ColorBomb);
    board.setTile(0, 1, TileKind.Green);
    board.setTile(1, 0, TileKind.Green);
    board.setTile(1, 1, TileKind.Red);
    board.setTile(2, 2, TileKind.Green);
    const cleared = expandSpecialClears(board, 0, 0, 0, 1, []);
    assert.ok(cleared.includes(board.index(0, 0)));
    assert.ok(cleared.includes(board.index(0, 1)));
    assert.ok(cleared.includes(board.index(1, 0)));
    assert.ok(cleared.includes(board.index(2, 2)));
    assert.ok(!cleared.includes(board.index(1, 1)));
  });

  it('两枚闪光相互滑动即可消失并范围爆炸', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    // 不同色闪光，普通三消无法形成，但应可互换激活
    board.setTile(1, 0, TileKind.Red);
    board.setSparkle(1, 0, true);
    board.setTile(1, 1, TileKind.Blue);
    board.setSparkle(1, 1, true);
    board.setTile(0, 0, TileKind.Green);
    board.setTile(0, 1, TileKind.Yellow);
    board.setTile(0, 2, TileKind.Purple);
    board.setTile(1, 2, TileKind.Green);
    board.setTile(2, 0, TileKind.Yellow);
    board.setTile(2, 1, TileKind.Purple);
    board.setTile(2, 2, TileKind.Green);

    const validator = new MoveValidator();
    assert.equal(validator.canSwap(board, 1, 0, 1, 1), true);

    board.swap(1, 0, 1, 1);
    const cleared = expandSpecialClears(board, 1, 0, 1, 1, []);
    assert.ok(cleared.includes(board.index(1, 0)));
    assert.ok(cleared.includes(board.index(1, 1)));
    // 至少清掉中心一带若干格
    assert.ok(cleared.length >= 4);
  });
});

describe('MatchResolver 特殊块落地', () => {
  it('四连消除后盘面留下闪光同色', () => {
    const board = new BoardModel({ rows: 4, cols: 4 });
    board.setTile(3, 0, TileKind.Red);
    board.setTile(3, 1, TileKind.Red);
    board.setTile(3, 2, TileKind.Red);
    board.setTile(3, 3, TileKind.Red);
    board.setTile(2, 0, TileKind.Blue);
    board.setTile(2, 1, TileKind.Green);
    board.setTile(2, 2, TileKind.Yellow);
    board.setTile(2, 3, TileKind.Purple);
    board.setTile(1, 0, TileKind.Purple);
    board.setTile(1, 1, TileKind.Blue);
    board.setTile(1, 2, TileKind.Green);
    board.setTile(1, 3, TileKind.Yellow);
    board.setTile(0, 0, TileKind.Yellow);
    board.setTile(0, 1, TileKind.Purple);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(0, 3, TileKind.Green);

    const finder = new MatchFinder();
    const matches = finder.findMatches(board);
    assert.ok(matches.size >= 4);

    const resolver = new MatchResolver(finder);
    const result = resolver.resolve(board, matches, {
      seed: 7,
      preferredSpawnRow: 3,
      preferredSpawnCol: 1,
    });

    assert.ok(result.waves[0]!.specialSpawns.length >= 1);
    const spawn = result.waves[0]!.specialSpawns[0]!;
    assert.equal(spawn.kind, TileKind.Red);
    assert.equal(spawn.sparkle, true);

    // 盘面上应仍能找到至少一枚闪光红
    let found = false;
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        if (board.getTile(r, c) === TileKind.Red && board.isSparkle(r, c)) {
          found = true;
        }
      }
    }
    assert.equal(found, true);
  });
});

describe('死局洗牌', () => {
  it('无可走时 shuffleUntilPlayable 后出现合法交换', () => {
    const board = new BoardModel({ rows: 4, cols: 4 });
    const kinds = [
      TileKind.Red,
      TileKind.Blue,
      TileKind.Green,
      TileKind.Yellow,
    ];
    let i = 0;
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        board.setTile(r, c, kinds[i % kinds.length]!);
        i += 1;
      }
    }
    const ok = shuffleUntilPlayable(board, 12345);
    assert.equal(ok, true);
    assert.equal(hasAnyValidMove(board, new MoveValidator()), true);
  });

  it('猫头鹰与任意色可交换', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(0, 0, TileKind.ColorBomb);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 0, TileKind.Green);
    board.setTile(1, 1, TileKind.Yellow);
    board.setTile(1, 2, TileKind.Purple);
    board.setTile(2, 0, TileKind.Blue);
    board.setTile(2, 1, TileKind.Green);
    board.setTile(2, 2, TileKind.Yellow);
    const validator = new MoveValidator();
    assert.equal(validator.canSwap(board, 0, 0, 0, 1), true);
  });

  it('不足 4 连不生成特殊块；已有合法步时不强制洗', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 2, TileKind.Red);
    board.setTile(1, 0, TileKind.Green);
    board.setTile(1, 1, TileKind.Yellow);
    board.setTile(2, 0, TileKind.Blue);
    board.setTile(2, 1, TileKind.Purple);
    board.setTile(2, 2, TileKind.Green);
    assert.deepEqual(planSpecialSpawns(board, [0, 1, 2]), []);
    assert.equal(shuffleUntilPlayable(board, 1, 8, false), true);
  });

  it('只剩 1 个可动块时洗牌失败', () => {
    const board = new BoardModel({ rows: 2, cols: 2 });
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Hole);
    board.setTile(1, 0, TileKind.Hole);
    board.setTile(1, 1, TileKind.Hole);
    assert.equal(shuffleUntilPlayable(board, 7, 5, true), false);
    assert.equal(hasAnyValidMove(board), false);
  });
});

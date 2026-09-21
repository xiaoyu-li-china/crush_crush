/**
 * 第二阶段交互单测：BoardView 输入 → GameSession.trySwap → 盘面消除。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  IAdService,
  IAnalytics,
  IAudio,
  IPlatform,
  IStorage,
} from '../../src/core';
import { BoardModel } from '../../src/logic/board/BoardModel';
import { MatchFinder } from '../../src/logic/board/MatchFinder';
import { MoveValidator } from '../../src/logic/board/MoveValidator';
import { TileKind } from '../../src/logic/board/TileType';
import { BoardView } from '../../src/presentation/views/BoardView';
import { LevelScene } from '../../src/presentation/ui/LevelScene';
import { GameSession, type GameSessionDeps } from '../../src/services/GameSession';

function createMemoryDeps(): GameSessionDeps {
  const store = new Map<string, unknown>();
  const storage: IStorage = {
    async get<T>(key: string): Promise<T | null> {
      return (store.has(key) ? (store.get(key) as T) : null);
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
    async clear(): Promise<void> {
      store.clear();
    },
  };

  const ads: IAdService = {
    async load() {},
    async show() {
      return 'not_ready';
    },
    isReady() {
      return false;
    },
    dispose() {},
  };

  const audio: IAudio = {
    play() {},
    stop() {},
    stopAll() {},
    setMuted() {},
    isMuted() {
      return false;
    },
    dispose() {},
  };

  const analytics: IAnalytics = {
    track() {},
  };

  const platform: IPlatform = {
    getSystemInfo() {
      return {
        brand: 'test',
        model: 'test',
        platform: 'devtools',
        system: 'test',
        SDKVersion: '2.19.0',
        windowWidth: 375,
        windowHeight: 667,
        pixelRatio: 2,
      };
    },
    onShow() {},
    onHide() {},
    offShow() {},
    offHide() {},
  };

  return { storage, ads, audio, analytics, platform };
}

/**
 * 构造一个「交换 (0,2)-(1,2) 即可三消」的 3×3 盘面：
 * R R B
 * G Y R
 * B G Y
 * 交换后第一行变为 R R R。
 */
function buildSwapToMatchBoard(): BoardModel {
  const board = new BoardModel({ rows: 3, cols: 3 });
  const layout: TileKind[][] = [
    [TileKind.Red, TileKind.Red, TileKind.Blue],
    [TileKind.Green, TileKind.Yellow, TileKind.Red],
    [TileKind.Blue, TileKind.Green, TileKind.Yellow],
  ];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      board.setTile(r, c, layout[r]![c]!);
    }
  }
  return board;
}

describe('Phase2 BoardView + trySwap', () => {
  it('MoveValidator：合法三消交换通过，非法交换拒绝', () => {
    const board = buildSwapToMatchBoard();
    const validator = new MoveValidator(new MatchFinder());
    assert.equal(validator.canSwap(board, 0, 2, 1, 2), true);
    assert.equal(validator.canSwap(board, 0, 0, 0, 1), false);
    // 试交换不污染原盘
    assert.equal(board.getTile(0, 2), TileKind.Blue);
  });

  it('MoveValidator：越界/空格/双炸弹', () => {
    const board = new BoardModel({ rows: 3, cols: 3 });
    const validator = new MoveValidator();
    assert.equal(validator.canSwap(board, -1, 0, 0, 0), false);
    board.setTile(0, 0, TileKind.Red);
    assert.equal(validator.canSwap(board, 0, 0, 0, 1), false);
    board.setTile(0, 0, TileKind.Bomb);
    board.setTile(0, 1, TileKind.Bomb);
    assert.equal(validator.canSwap(board, 0, 0, 0, 1), true);
    board.setTile(0, 1, TileKind.Hole);
    assert.equal(validator.canSwap(board, 0, 0, 0, 1), false);
  });

  it('BoardView 点选相邻两格发出 SwapIntent', () => {
    const board = buildSwapToMatchBoard();
    const intents: Array<[number, number, number, number]> = [];
    const view = new BoardView({ cellSize: 10, originX: 0, originY: 0 });
    view.syncFromBoard(board, true);
    view.bindInput((a, b, c, d) => intents.push([a, b, c, d]));

    // 选中 (0,2)：中心约 x=25, y=-5
    assert.equal(view.onPointerDown(25, -5), true);
    assert.equal(view.onPointerUp(25, -5), true);
    assert.deepEqual(view.getSelection(), { row: 0, col: 2 });

    // 再点 (1,2)：x=25, y=-15
    assert.equal(view.onPointerDown(25, -15), true);
    assert.equal(view.onPointerUp(25, -15), true);
    assert.deepEqual(intents, [[0, 2, 1, 2]]);
  });

  it('BoardView 滑动相邻格发出 SwapIntent', () => {
    const board = buildSwapToMatchBoard();
    const intents: Array<[number, number, number, number]> = [];
    const view = new BoardView({ cellSize: 10, originX: 0, originY: 0 });
    view.syncFromBoard(board, true);
    view.bindInput((a, b, c, d) => intents.push([a, b, c, d]));

    view.onPointerDown(25, -5); // (0,2)
    view.onPointerUp(25, -15); // (1,2)
    assert.deepEqual(intents, [[0, 2, 1, 2]]);
  });

  it('BoardView 滑动过阈值时立即交换（不必等抬手）', () => {
    const board = buildSwapToMatchBoard();
    const intents: Array<[number, number, number, number]> = [];
    const view = new BoardView({ cellSize: 40, originX: 0, originY: 120 });
    view.syncFromBoard(board, true);
    view.bindInput((a, b, c, d) => intents.push([a, b, c, d]));

    // (0,1) 中心约 x=60, y=100
    view.onPointerDown(60, 100);
    // 向右拖过 0.34*40≈13.6
    view.onPointerMove(60 + 16, 100);
    assert.deepEqual(intents, [[0, 1, 0, 2]]);
    // 抬手不再重复提交
    view.onPointerUp(60 + 20, 100);
    assert.equal(intents.length, 1);
  });

  it('BoardView 轻微抖动仍可点邻格交换并保持选中', () => {
    const board = buildSwapToMatchBoard();
    const intents: Array<[number, number, number, number]> = [];
    const view = new BoardView({ cellSize: 40, originX: 0, originY: 120 });
    view.syncFromBoard(board, true);
    view.bindInput((a, b, c, d) => intents.push([a, b, c, d]));

    // 先点选 (0,2)
    view.onPointerDown(100, 100);
    view.onPointerUp(100, 100);
    assert.deepEqual(view.getSelection(), { row: 0, col: 2 });

    // 再点邻格 (1,2)，中间带微小抖动（不应打断点选交换）
    view.onPointerDown(100, 60);
    view.onPointerMove(102, 62);
    view.onPointerUp(100, 60);
    assert.deepEqual(intents, [[0, 2, 1, 2]]);
  });

  it('GameSession.trySwap 成功后盘面变化且可 ASCII 查看', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    await session.startLevel(1);

    const board = session.getBoard();
    assert.ok(board);

    // 覆盖为可控盘面
    for (let r = 0; r < board.size.rows; r += 1) {
      for (let c = 0; c < board.size.cols; c += 1) {
        board.clearTile(r, c);
      }
    }
    // 在左上角写入可交换三消图案
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 0, TileKind.Green);
    board.setTile(1, 1, TileKind.Yellow);
    board.setTile(1, 2, TileKind.Red);
    board.setTile(2, 0, TileKind.Blue);
    board.setTile(2, 1, TileKind.Green);
    board.setTile(2, 2, TileKind.Yellow);
    // 其余空位填非匹配色，避免 resolve 填充前越界；fill 会处理 Empty
    for (let r = 0; r < board.size.rows; r += 1) {
      for (let c = 0; c < board.size.cols; c += 1) {
        if (board.getTile(r, c) === TileKind.Empty) {
          // 棋盘交错填充，尽量减少额外匹配干扰断言
          const kind =
            (r + c) % 2 === 0 ? TileKind.Purple : TileKind.Yellow;
          board.setTile(r, c, kind);
        }
      }
    }

    const view = new BoardView({ cellSize: 64 });
    view.syncFromBoard(board, true);
    const before = view.toAscii(board);

    const ok = session.trySwap(0, 2, 1, 2);
    assert.equal(ok, true);
    view.syncFromBoard(board, true);
    const after = view.toAscii(board);

    assert.notEqual(before, after);
    assert.ok(session.getScore() > 0);
  });

  it('LevelScene 组装后可通过 BoardView.requestSwap 触发消除', async () => {
    const session = new GameSession(createMemoryDeps());
    await session.init();
    await session.startLevel(1);

    const board = session.getBoard()!;
    // 构造确定可消交换
    for (let r = 0; r < board.size.rows; r += 1) {
      for (let c = 0; c < board.size.cols; c += 1) {
        board.clearTile(r, c);
      }
    }
    board.setTile(0, 0, TileKind.Red);
    board.setTile(0, 1, TileKind.Red);
    board.setTile(0, 2, TileKind.Blue);
    board.setTile(1, 2, TileKind.Red);
    for (let r = 0; r < board.size.rows; r += 1) {
      for (let c = 0; c < board.size.cols; c += 1) {
        if (board.getTile(r, c) === TileKind.Empty) {
          board.setTile(r, c, (r + c) % 2 === 0 ? TileKind.Green : TileKind.Yellow);
        }
      }
    }

    const scene = new LevelScene(null, 64);
    scene.onEnter(session, 1);
    const view = scene.getBoardView();

    const versionBefore = board.version;
    view.requestSwap(0, 2, 1, 2);
    assert.ok(board.version > versionBefore);
    assert.ok(session.getScore() > 0);

    scene.onExit();
  });

  it('BoardView.hitCell 点在棋盘外框附近吸附最近格', () => {
    const board = new BoardModel({ rows: 8, cols: 8 });
    const view = new BoardView({ cellSize: 10, originX: 20, originY: 80 });
    view.syncFromBoard(board, true);

    // 格内：左下角 row0 col0 中心约 (25, 75)
    assert.deepEqual(view.screenToCell(25, 75), { row: 0, col: 0 });
    assert.deepEqual(view.hitCell(25, 75, 8), { row: 0, col: 0 });

    // 木框外 6px：精确命中失败，吸附后仍能点到
    assert.equal(view.screenToCell(16, 75), null);
    assert.deepEqual(view.hitCell(16, 75, 8), { row: 0, col: 0 });

    assert.equal(view.screenToCell(25, 84), null);
    assert.deepEqual(view.hitCell(25, 84, 8), { row: 0, col: 0 });

    // 超出吸附范围仍为 miss
    assert.equal(view.hitCell(5, 75, 8), null);
  });
});

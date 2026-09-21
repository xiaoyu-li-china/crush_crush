import type {
  IAdService,
  IAnalytics,
  IAudio,
  IPlatform,
  IStorage,
} from '../../src/core';
import { TileKind } from '../../src/logic/board/TileType';
import type { LevelConfig } from '../../src/logic/level/LevelConfig';
import { GameSession, type GameSessionDeps } from '../../src/services/GameSession';

export function createMemoryDeps(
  ads?: Partial<IAdService>,
): GameSessionDeps {
  const store = new Map<string, unknown>();
  const storage: IStorage = {
    async get<T>(key: string): Promise<T | null> {
      return store.has(key) ? (store.get(key) as T) : null;
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

  return {
    storage,
    ads: {
      async load() {},
      async show() {
        return 'not_ready';
      },
      isReady: () => false,
      dispose() {},
      ...ads,
    } satisfies IAdService,
    audio: {
      play() {},
      stop() {},
      stopAll() {},
      setMuted() {},
      isMuted: () => false,
      dispose() {},
    } satisfies IAudio,
    analytics: { track() {} } satisfies IAnalytics,
    platform: {
      getSystemInfo: () => ({
        brand: 'test',
        model: 'test',
        platform: 'devtools',
        system: 'test',
        SDKVersion: '2.19.0',
        windowWidth: 375,
        windowHeight: 667,
        pixelRatio: 2,
      }),
      onShow() {},
      onHide() {},
      offShow() {},
      offHide() {},
      getLaunchQuery: () => ({}),
    } satisfies IPlatform,
  };
}

export function miniLevels(): LevelConfig[] {
  return [
    {
      id: 1,
      seed: 1,
      moves: 5,
      board: { rows: 3, cols: 3 },
      goals: [{ type: 'score', score: 30 }],
      crushEnabled: false,
      crushDurationMs: 0,
    },
    {
      id: 2,
      seed: 2,
      moves: 5,
      board: { rows: 3, cols: 3 },
      goals: [{ type: 'clear_blocks', count: 3 }],
      crushEnabled: false,
      crushDurationMs: 0,
    },
  ];
}

/** 写入「交换 (0,2)-(1,2) → 三消至少 3 格」的盘面。 */
export function paintSwapMatch(session: GameSession): void {
  const board = session.getBoard()!;
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
}

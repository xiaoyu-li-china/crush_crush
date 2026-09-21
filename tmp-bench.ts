import { createMemoryDeps } from './tests/helpers/memory-deps';
import { GameSession } from './src/services/GameSession';
import { MoveValidator } from './src/logic/board/MoveValidator';
import { hasAnyValidMove } from './src/logic/board/BoardShuffle';
import levelsJson from './src/config/levels.json';

const levels = levelsJson as unknown as Parameters<GameSession['setLevelTable']>[0];

function ms(label: string, fn: () => void, repeat = 1): number {
  const t0 = performance.now();
  let n = 0;
  for (let i = 0; i < repeat; i += 1) {
    fn();
    n += 1;
  }
  const dt = performance.now() - t0;
  console.log(`${label}: total=${dt.toFixed(1)}ms avg=${(dt / n).toFixed(2)}ms (x${n})`);
  return dt / n;
}

async function main(): Promise<void> {
  const deps = createMemoryDeps();
  const session = new GameSession(deps);
  session.setLevelTable(levels);
  await session.init();

  for (const id of [1, 4, 9, 17, 19, 20]) {
    session.quitToLobby();
    const t0 = performance.now();
    await session.startLevel(id);
    const dt = performance.now() - t0;
    console.log(`startLevel(${id}): ${dt.toFixed(1)}ms`);
  }

  session.quitToLobby();
  await session.startLevel(20);
  const board = session.getBoard()!;
  const validator = new MoveValidator();

  ms(
    'hasAnyValidMove',
    () => hasAnyValidMove(board, validator),
    20,
  );

  let validTotal = 0;
  ms(
    'canSwap-all-pairs',
    () => {
      const { rows, cols } = board.size;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (c + 1 < cols) {
            validator.canSwap(board, r, c, r, c + 1);
            validTotal += 1;
          }
          if (r + 1 < rows) {
            validator.canSwap(board, r, c, r + 1, c);
            validTotal += 1;
          }
        }
      }
    },
    5,
  );
  console.log('pairs evaluated total across runs:', validTotal);

  // 模拟 startLevel 里 stabilizeBoard + shuffle 的最坏路径
  ms(
    'startLevel-x8',
    () => {
      session.quitToLobby();
      void session.startLevel(19).catch(() => {});
    },
    8,
  );
}

void main();

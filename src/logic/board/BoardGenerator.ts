import { createSeededRandom } from '../../core/utils/math';
import type { BoardModel } from './BoardModel';
import { BASIC_TILE_KINDS, isHole, TileKind } from './TileType';

/**
 * 生成开局盘面：按 seed 填充，并避免横向/纵向已形成 ≥3 连。
 * @param board - 空棋盘或将被覆盖的棋盘
 * @param seed - 关卡种子
 */
export function generatePlayableBoard(board: BoardModel, seed: number): void {
  const random = createSeededRandom(seed);
  const { rows, cols } = board.size;
  const kindCount = BASIC_TILE_KINDS.length;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (isHole(board.getTile(r, c))) {
        continue;
      }
      const forbidden: TileKind[] = [];

      if (
        c >= 2 &&
        board.getTile(r, c - 1) === board.getTile(r, c - 2) &&
        board.getTile(r, c - 1) !== TileKind.Empty &&
        !isHole(board.getTile(r, c - 1))
      ) {
        forbidden.push(board.getTile(r, c - 1));
      }

      if (
        r >= 2 &&
        board.getTile(r - 1, c) === board.getTile(r - 2, c) &&
        board.getTile(r - 1, c) !== TileKind.Empty &&
        !isHole(board.getTile(r - 1, c))
      ) {
        forbidden.push(board.getTile(r - 1, c));
      }

      const kind = pickKind(random, kindCount, forbidden);
      board.setTile(r, c, kind);
    }
  }
}

/**
 * 从基础色中随机选取，避开 forbidden（若全部被禁则回退任选）。
 * @param random - [0,1) 随机源
 * @param kindCount - 基础色数量
 * @param forbidden - 禁止的种类
 * @returns 选中的 TileKind
 */
function pickKind(
  random: () => number,
  kindCount: number,
  forbidden: readonly TileKind[],
): TileKind {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const kind = BASIC_TILE_KINDS[Math.floor(random() * kindCount)]!;
    if (!forbidden.includes(kind)) {
      return kind;
    }
  }
  return BASIC_TILE_KINDS[Math.floor(random() * kindCount)]!;
}

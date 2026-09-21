import { createSeededRandom } from '../../core/utils/math';
import type { BoardModel } from './BoardModel';
import { MoveValidator } from './MoveValidator';
import { isHole, TileKind } from './TileType';

/**
 * 洗牌：打乱非空格子位置，直到存在合法交换（开心消消乐「重新排列」）。
 * @param force - true 时无论当前是否可走都强制重排（道具「重排」）
 * @returns 是否最终有合法步
 */
export function shuffleUntilPlayable(
  board: BoardModel,
  seed: number,
  maxAttempts = 40,
  force = false,
): boolean {
  const validator = new MoveValidator();
  if (!force && hasAnyValidMove(board, validator)) {
    return true;
  }

  const random = createSeededRandom(seed);
  const cells: Array<{ kind: TileKind; tileId: number; sparkle: number }> = [];
  for (let i = 0; i < board.length; i += 1) {
    const kind = board.cells[i] as TileKind;
    if (kind === TileKind.Empty || isHole(kind)) {
      continue;
    }
    cells.push({
      kind,
      tileId: board.tileIds[i]!,
      sparkle: board.sparkles[i]!,
    });
  }

  if (cells.length < 2) {
    return hasAnyValidMove(board, validator);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    for (let i = cells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = cells[i]!;
      cells[i] = cells[j]!;
      cells[j] = tmp;
    }

    let write = 0;
    for (let i = 0; i < board.length; i += 1) {
      if (
        (board.cells[i] as TileKind) === TileKind.Empty ||
        isHole(board.cells[i] as TileKind)
      ) {
        continue;
      }
      const src = cells[write]!;
      board.cells[i] = src.kind;
      board.tileIds[i] = src.tileId;
      board.sparkles[i] = src.sparkle;
      write += 1;
    }
    board.version += 1;

    if (hasAnyValidMove(board, validator)) {
      return true;
    }
  }

  return hasAnyValidMove(board, validator);
}

/**
 * 是否存在任意合法交换（含特殊块交换）。
 */
export function hasAnyValidMove(
  board: BoardModel,
  validator: MoveValidator = new MoveValidator(),
): boolean {
  const { rows, cols } = board.size;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (c + 1 < cols && validator.canSwap(board, r, c, r, c + 1)) {
        return true;
      }
      if (r + 1 < rows && validator.canSwap(board, r, c, r + 1, c)) {
        return true;
      }
    }
  }
  return false;
}

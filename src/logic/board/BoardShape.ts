import type { BoardModel } from './BoardModel';
import { TileKind } from './TileType';

/** 关卡棋盘外形；缺省为矩形。 */
export type BoardShape =
  | 'rect'
  | 'diamond'
  | 'heart'
  | 'split_3_4'
  | 'plus'
  | 'ring'
  | 'double_ring'
  | 'hourglass';

/** 8 列挖第 4 列（左 3 右 4）；7 列挖中间列（左 3 右 3）。 */
function isSplit34Cell(col: number, cols: number): boolean {
  const holeCol = cols >= 7 ? 3 : Math.min(3, Math.max(0, cols - 5));
  return col !== holeCol;
}

/** 6×6 像素心：尖朝上、双叶在下。 */
const HEART_6: ReadonlyArray<ReadonlyArray<0 | 1>> = [
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [0, 1, 1, 0, 1, 1],
];

function isHeartCell(row: number, col: number, rows: number, cols: number): boolean {
  if (rows === 6 && cols === 6) {
    return HEART_6[row]?.[col] === 1;
  }
  const x = ((col + 0.5) / cols) * 2 - 1;
  const y = 1 - ((row + 0.5) / rows) * 2;
  const nx = x * 1.22;
  const ny = -(y * 1.12 + 0.18);
  const a = nx * nx + ny * ny - 1;
  return a * a * a - nx * nx * ny * ny * ny <= 0;
}

/**
 * 菱形：曼哈顿距离；心形：6×6 用像素心，其它尺寸用心形方程。
 */
export function isCellPlayable(
  row: number,
  col: number,
  rows: number,
  cols: number,
  shape: BoardShape = 'rect',
): boolean {
  if (shape === 'rect') {
    return true;
  }
  if (shape === 'split_3_4') {
    return isSplit34Cell(col, cols);
  }
  if (shape === 'plus') {
    const midR = (rows - 1) / 2;
    const midC = (cols - 1) / 2;
    // 奇数边：略加厚十字，避免 7×7 单线过瘦；偶数边仍用双心行/列
    if (Number.isInteger(midR) && Number.isInteger(midC)) {
      const arm = rows >= 7 ? 1 : 0;
      return Math.abs(row - midR) <= arm || Math.abs(col - midC) <= arm;
    }
    const midR0 = Math.floor((rows - 1) / 2);
    const midR1 = Math.ceil((rows - 1) / 2);
    const midC0 = Math.floor((cols - 1) / 2);
    const midC1 = Math.ceil((cols - 1) / 2);
    return row === midR0 || row === midR1 || col === midC0 || col === midC1;
  }
  if (shape === 'ring' || shape === 'double_ring') {
    const hole = shape === 'double_ring' ? 2 : rows >= 8 ? 2 : 1;
    return !(row >= hole && row < rows - hole && col >= hole && col < cols - hole);
  }
  if (shape === 'hourglass') {
    const y = rows <= 1 ? 0.5 : row / (rows - 1);
    const x = cols <= 1 ? 0.5 : (col + 0.5) / cols;
    const half = 0.14 + Math.abs(y - 0.5) * 0.58;
    return Math.abs(x - 0.5) <= half;
  }
  if (shape === 'heart') {
    return isHeartCell(row, col, rows, cols);
  }
  const cr = (rows - 1) / 2;
  const cc = (cols - 1) / 2;
  const limit = Math.ceil((rows + cols) / 4);
  return Math.abs(row - cr) + Math.abs(col - cc) <= limit;
}

export function applyBoardShape(board: BoardModel, shape: BoardShape | undefined): void {
  if (!shape || shape === 'rect') {
    return;
  }
  const { rows, cols } = board.size;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!isCellPlayable(r, c, rows, cols, shape)) {
        board.setTile(r, c, TileKind.Hole);
      }
    }
  }
}

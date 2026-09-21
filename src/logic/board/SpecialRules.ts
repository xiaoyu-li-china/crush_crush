import type { BoardModel } from './BoardModel';
import { isBasicTile, isMatchable, isSpecialTile, TileKind } from './TileType';

/** 消除后在盘面生成的特殊块。 */
export interface SpecialSpawn {
  row: number;
  col: number;
  /** 四连/L·T：同色基础块；五连：超级猫头鹰 */
  kind: TileKind;
  /** 四连/L·T 为 true：闪光同色，再次三消时小范围爆炸 */
  sparkle: boolean;
}

/**
 * 根据本波匹配形状决定生成特殊块（开心消消乐手感）：
 * - 五连及以上 → 超级猫头鹰（ColorBomb）
 * - 四连 / L·T 型 → 闪光的同色小动物（再次三消时小范围爆炸）
 */
export function planSpecialSpawns(
  board: BoardModel,
  matchIndices: readonly number[],
  preferredRow?: number,
  preferredCol?: number,
): SpecialSpawn[] {
  if (matchIndices.length < 4) {
    return [];
  }

  const { rows, cols } = board.size;
  const matchSet = new Set(matchIndices);
  const used = new Set<number>();
  const spawns: SpecialSpawn[] = [];

  // 横向连线
  for (let r = 0; r < rows; r += 1) {
    let c = 0;
    while (c < cols) {
      const start = c;
      const index0 = r * cols + c;
      const kind = board.cells[index0] as TileKind;
      if (!isMatchable(kind) || !matchSet.has(index0)) {
        c += 1;
        continue;
      }
      c += 1;
      while (
        c < cols &&
        (board.cells[r * cols + c] as TileKind) === kind &&
        matchSet.has(r * cols + c)
      ) {
        c += 1;
      }
      const len = c - start;
      if (len >= 4) {
        const pick = pickSpawnCell(
          board,
          r,
          start,
          r,
          c - 1,
          preferredRow,
          preferredCol,
          used,
        );
        if (pick) {
          pushOrUpgrade(spawns, used, board, pick.row, pick.col, kind, len >= 5);
        }
      }
    }
  }

  // 纵向连线
  for (let c = 0; c < cols; c += 1) {
    let r = 0;
    while (r < rows) {
      const start = r;
      const index0 = r * cols + c;
      const kind = board.cells[index0] as TileKind;
      if (!isMatchable(kind) || !matchSet.has(index0)) {
        r += 1;
        continue;
      }
      r += 1;
      while (
        r < rows &&
        (board.cells[r * cols + c] as TileKind) === kind &&
        matchSet.has(r * cols + c)
      ) {
        r += 1;
      }
      const len = r - start;
      if (len >= 4) {
        const pick = pickSpawnCell(
          board,
          start,
          c,
          r - 1,
          c,
          preferredRow,
          preferredCol,
          used,
        );
        if (pick) {
          pushOrUpgrade(spawns, used, board, pick.row, pick.col, kind, len >= 5);
        }
      }
    }
  }

  // L / T：同时处于横纵匹配的同色格 → 闪光同色
  for (const index of matchIndices) {
    if (used.has(index)) {
      continue;
    }
    const row = Math.floor(index / cols);
    const col = index % cols;
    const kind = board.cells[index] as TileKind;
    if (!isMatchable(kind)) {
      continue;
    }
    const hLen = runLengthThrough(board, row, col, 0, 1, matchSet);
    const vLen = runLengthThrough(board, row, col, 1, 0, matchSet);
    if (hLen >= 3 && vLen >= 3) {
      pushOrUpgrade(spawns, used, board, row, col, kind, false);
    }
  }

  return spawns;
}

/**
 * 交换含特殊块时，展开待消除下标。
 * - 两枚闪光互换：直接激活双方并小范围爆炸
 * - 普通三消中含闪光块：在 expandSparkleBlasts 中小范围爆炸
 */
export function expandSpecialClears(
  board: BoardModel,
  rowA: number,
  colA: number,
  rowB: number,
  colB: number,
  baseMatches: readonly number[],
): number[] {
  const clear = new Set<number>(baseMatches);
  const kindA = board.getTile(rowA, colA);
  const kindB = board.getTile(rowB, colB);

  if (kindA === TileKind.ColorBomb && kindB === TileKind.ColorBomb) {
    for (let i = 0; i < board.length; i += 1) {
      if (board.cells[i] !== TileKind.Empty) {
        clear.add(i);
      }
    }
    return [...clear];
  }

  if (kindA === TileKind.ColorBomb || kindB === TileKind.ColorBomb) {
    const owlRow = kindA === TileKind.ColorBomb ? rowA : rowB;
    const owlCol = kindA === TileKind.ColorBomb ? colA : colB;
    const otherKind = kindA === TileKind.ColorBomb ? kindB : kindA;
    const otherRow = kindA === TileKind.ColorBomb ? rowB : rowA;
    const otherCol = kindA === TileKind.ColorBomb ? colB : colA;
    clear.add(board.index(owlRow, owlCol));

    if (isMatchable(otherKind) || isBasicTile(otherKind)) {
      clear.add(board.index(otherRow, otherCol));
      for (let i = 0; i < board.length; i += 1) {
        if (board.cells[i] === otherKind) {
          clear.add(i);
        }
      }
    } else if (isSpecialTile(otherKind)) {
      clear.add(board.index(otherRow, otherCol));
    }

    expandSparkleBlasts(board, clear);
    return [...clear];
  }

  // 两枚闪光相互滑动：双方消失并触发范围爆炸
  if (board.isSparkle(rowA, colA) && board.isSparkle(rowB, colB)) {
    clear.add(board.index(rowA, colA));
    clear.add(board.index(rowB, colB));
    expandSparkleBlasts(board, clear);
    return [...clear];
  }

  // 普通三消中含闪光块：小范围爆炸
  expandSparkleBlasts(board, clear);
  return [...clear];
}

/**
 * 对 clear 集合中的闪光块做半径 1 小范围爆炸（连锁，有上限）。
 */
export function expandSparkleBlasts(board: BoardModel, clear: Set<number>): void {
  const queue: number[] = [];
  for (const index of clear) {
    if (board.sparkles[index] === 1) {
      queue.push(index);
    }
  }

  let guard = 0;
  while (queue.length > 0 && guard < 64) {
    guard += 1;
    const index = queue.shift()!;
    const row = Math.floor(index / board.size.cols);
    const col = index % board.size.cols;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const rr = row + dr;
        const cc = col + dc;
        if (!board.inBounds(rr, cc)) {
          continue;
        }
        const ni = board.index(rr, cc);
        if (clear.has(ni)) {
          continue;
        }
        if (board.cells[ni] === TileKind.Empty || board.cells[ni] === TileKind.Hole) {
          continue;
        }
        clear.add(ni);
        if (board.sparkles[ni] === 1) {
          queue.push(ni);
        }
      }
    }
  }
}

function pushOrUpgrade(
  spawns: SpecialSpawn[],
  used: Set<number>,
  board: BoardModel,
  row: number,
  col: number,
  colorKind: TileKind,
  asOwl: boolean,
): void {
  const existing = spawns.find((s) => s.row === row && s.col === col);
  if (asOwl) {
    if (!existing) {
      spawns.push({ row, col, kind: TileKind.ColorBomb, sparkle: false });
      used.add(board.index(row, col));
    } else {
      existing.kind = TileKind.ColorBomb;
      existing.sparkle = false;
    }
    return;
  }

  if (!existing) {
    spawns.push({ row, col, kind: colorKind, sparkle: true });
    used.add(board.index(row, col));
  }
  // 已有猫头鹰则不降级；已有闪光同色则保持
}

function runLengthThrough(
  board: BoardModel,
  row: number,
  col: number,
  dr: number,
  dc: number,
  matchSet: Set<number>,
): number {
  const kind = board.getTile(row, col);
  let len = 1;
  let r = row + dr;
  let c = col + dc;
  while (board.inBounds(r, c) && board.getTile(r, c) === kind && matchSet.has(board.index(r, c))) {
    len += 1;
    r += dr;
    c += dc;
  }
  r = row - dr;
  c = col - dc;
  while (board.inBounds(r, c) && board.getTile(r, c) === kind && matchSet.has(board.index(r, c))) {
    len += 1;
    r -= dr;
    c -= dc;
  }
  return len;
}

function pickSpawnCell(
  board: BoardModel,
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  preferredRow: number | undefined,
  preferredCol: number | undefined,
  used: Set<number>,
): { row: number; col: number } | null {
  if (
    preferredRow !== undefined &&
    preferredCol !== undefined &&
    preferredRow >= r0 &&
    preferredRow <= r1 &&
    preferredCol >= c0 &&
    preferredCol <= c1
  ) {
    const idx = board.index(preferredRow, preferredCol);
    if (!used.has(idx)) {
      return { row: preferredRow, col: preferredCol };
    }
  }

  const midR = Math.floor((r0 + r1) / 2);
  const midC = Math.floor((c0 + c1) / 2);
  const midIdx = board.index(midR, midC);
  if (!used.has(midIdx)) {
    return { row: midR, col: midC };
  }

  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const idx = board.index(r, c);
      if (!used.has(idx)) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

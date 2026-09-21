import type { BoardModel } from './BoardModel';
import { isMatchable, type TileKind } from './TileType';

/** 默认支持的最大格子数（如 10×10）；超出时在 find 前扩容缓冲区。 */
const DEFAULT_MAX_CELLS = 100;

/**
 * 一次全盘扫描得到的匹配集合。
 * 内部复用 `Int32Array`，下次 `findMatches` 会覆盖内容，调用方如需留存请自行拷贝。
 */
export class MatchSet {
  /** 匹配格子的行优先一维下标（有效区间为 `[0, size)`）。 */
  public readonly indices: Int32Array;

  /** 有效匹配数量。 */
  public size: number;

  /**
   * @param capacity - 预分配容量，通常等于棋盘格子数
   */
  public constructor(capacity: number) {
    this.indices = new Int32Array(capacity);
    this.size = 0;
  }

  /**
   * 当前是否存在任意匹配。
   * @returns 是否非空
   */
  public isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * 判断某一下标是否在本次匹配结果中（O(n)，仅调试/测试用）。
   * @param index - 行优先一维下标
   * @returns 是否命中
   */
  public contains(index: number): boolean {
    for (let i = 0; i < this.size; i += 1) {
      if (this.indices[i] === index) {
        return true;
      }
    }
    return false;
  }

  /**
   * 清空有效长度（不释放底层数组）。
   */
  public clear(): void {
    this.size = 0;
  }
}

/**
 * 三消检测器：全盘横/纵扫描连续 ≥3 的相同可匹配块，合并去重。
 *
 * 性能约定：
 * - 时间复杂度 O(rows × cols)
 * - 扫描过程不 `new` 临时数组，全部写入预分配 scratch
 * - 7×7 盘面单次扫描应远小于 2ms
 */
export class MatchFinder {
  /** 标记位图：1 表示该格已纳入匹配（用于横纵合并去重）。 */
  private marked: Uint8Array;

  /** 对外复用的匹配结果。 */
  private result: MatchSet;

  /** 当前缓冲区可覆盖的最大格子数。 */
  private capacity: number;

  /**
   * @param maxCells - 预分配容量；若实际棋盘更大，会在首次扫描时扩容（仅扩容时分配）
   */
  public constructor(maxCells: number = DEFAULT_MAX_CELLS) {
    this.capacity = maxCells;
    this.marked = new Uint8Array(maxCells);
    this.result = new MatchSet(maxCells);
  }

  /**
   * 全盘扫描并返回匹配集合。
   * @param board - 棋盘模型（只读扫描，不修改盘面）
   * @returns 复用的 `MatchSet`；无匹配时 `size === 0`
   */
  public findMatches(board: BoardModel): MatchSet {
    const cellCount = board.length;
    this.ensureCapacity(cellCount);
    this.clearScratch(cellCount);

    this.scanHorizontal(board);
    this.scanVertical(board);
    this.compactMarked(cellCount);

    return this.result;
  }

  /**
   * 横向扫描：每一行找连续 ≥3 的相同可匹配块并标记。
   * @param board - 棋盘
   */
  private scanHorizontal(board: BoardModel): void {
    const { rows, cols } = board.size;
    const cells = board.cells;

    for (let r = 0; r < rows; r += 1) {
      const rowBase = r * cols;
      let c = 0;
      while (c < cols) {
        const start = c;
        const kind = cells[rowBase + c] as TileKind;
        if (!isMatchable(kind) || board.isCoveredIndex(rowBase + c)) {
          c += 1;
          continue;
        }
        c += 1;
        while (
          c < cols &&
          (cells[rowBase + c] as TileKind) === kind &&
          !board.isCoveredIndex(rowBase + c)
        ) {
          c += 1;
        }
        const runLength = c - start;
        if (runLength >= 3) {
          for (let k = start; k < c; k += 1) {
            this.marked[rowBase + k] = 1;
          }
        }
      }
    }
  }

  /**
   * 纵向扫描：每一列找连续 ≥3 的相同可匹配块并标记。
   * @param board - 棋盘
   */
  private scanVertical(board: BoardModel): void {
    const { rows, cols } = board.size;
    const cells = board.cells;

    for (let c = 0; c < cols; c += 1) {
      let r = 0;
      while (r < rows) {
        const start = r;
        const kind = cells[r * cols + c] as TileKind;
        if (!isMatchable(kind) || board.isCoveredIndex(r * cols + c)) {
          r += 1;
          continue;
        }
        r += 1;
        while (
          r < rows &&
          (cells[r * cols + c] as TileKind) === kind &&
          !board.isCoveredIndex(r * cols + c)
        ) {
          r += 1;
        }
        const runLength = r - start;
        if (runLength >= 3) {
          for (let k = start; k < r; k += 1) {
            this.marked[k * cols + c] = 1;
          }
        }
      }
    }
  }

  /**
   * 将标记位图压缩写入 `result.indices`（横纵重叠处自然去重）。
   * @param cellCount - 有效格子数
   */
  private compactMarked(cellCount: number): void {
    let write = 0;
    for (let i = 0; i < cellCount; i += 1) {
      if (this.marked[i] === 1) {
        this.result.indices[write] = i;
        write += 1;
      }
    }
    this.result.size = write;
  }

  /**
   * 清空标记与结果长度（不重新分配）。
   * @param cellCount - 需要清零的前缀长度
   */
  private clearScratch(cellCount: number): void {
    this.marked.fill(0, 0, cellCount);
    this.result.clear();
  }

  /**
   * 若棋盘大于当前容量则扩容（仅此时分配新 TypedArray）。
   * @param cellCount - 当前棋盘格子数
   */
  private ensureCapacity(cellCount: number): void {
    if (cellCount <= this.capacity) {
      return;
    }
    this.capacity = cellCount;
    this.marked = new Uint8Array(cellCount);
    this.result = new MatchSet(cellCount);
  }
}

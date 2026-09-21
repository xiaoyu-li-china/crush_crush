import type { BoardModel } from './BoardModel';
import { MatchFinder } from './MatchFinder';
import { isHole, isSpecialTile, TileKind } from './TileType';

/**
 * 交换合法性校验：四向相邻 +（试交换后三消 或 含特殊块可激活）。
 */
export class MoveValidator {
  private readonly finder: MatchFinder;

  public constructor(finder?: MatchFinder) {
    this.finder = finder ?? new MatchFinder();
  }

  public areAdjacent(
    rowA: number,
    colA: number,
    rowB: number,
    colB: number,
  ): boolean {
    const dr = Math.abs(rowA - rowB);
    const dc = Math.abs(colA - colB);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  /**
   * 判断交换是否合法。
   * 开心消消乐：超级猫头鹰与任意非空块可换；两闪光可换；两特殊块可换；否则需形成三消。
   */
  public canSwap(
    board: BoardModel,
    rowA: number,
    colA: number,
    rowB: number,
    colB: number,
  ): boolean {
    if (!this.areAdjacent(rowA, colA, rowB, colB)) {
      return false;
    }
    if (!board.inBounds(rowA, colA) || !board.inBounds(rowB, colB)) {
      return false;
    }

    const kindA = board.getTile(rowA, colA);
    const kindB = board.getTile(rowB, colB);
    if (
      kindA === TileKind.Empty ||
      kindB === TileKind.Empty ||
      isHole(kindA) ||
      isHole(kindB)
    ) {
      return false;
    }
    if (board.isCoveredIndex(board.index(rowA, colA)) || board.isCoveredIndex(board.index(rowB, colB))) {
      return false;
    }
    if (
      board.iceLocksTiles &&
      (board.getIce(rowA, colA) > 0 || board.getIce(rowB, colB) > 0)
    ) {
      return false;
    }

    // 超级猫头鹰：与任意非空块交换即可激活
    if (kindA === TileKind.ColorBomb || kindB === TileKind.ColorBomb) {
      return true;
    }

    // 两枚闪光同色块：相互滑动即可激活
    if (board.isSparkle(rowA, colA) && board.isSparkle(rowB, colB)) {
      return true;
    }

    // 两特殊块互换（如双炸弹）
    if (isSpecialTile(kindA) && isSpecialTile(kindB)) {
      return true;
    }

    const trial = board.clone();
    trial.swap(rowA, colA, rowB, colB);
    const matches = this.finder.findMatches(trial);
    return !matches.isEmpty();
  }
}

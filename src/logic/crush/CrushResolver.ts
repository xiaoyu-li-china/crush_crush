import type { BoardModel } from '../board/BoardModel';
import { TileKind } from '../board/TileType';
import type { CrushBurst, CrushRewardModel } from './CrushRewardModel';

export interface CrushResolveResult {
  /** 本次点击（含连锁）清掉的格子下标 */
  clearedIndices: number[];
  /** 清掉前的种类 */
  clearedKinds: TileKind[];
  /** 实际触发的爆发列表（含 tap / chain） */
  fired: CrushBurst[];
  /** 入队但未在本帧处理完的连锁（通常为空） */
  chained: CrushBurst[];
}

/** 单次点击最多处理的爆发数，防止一次清全屏卡死 */
const MAX_BURSTS_PER_TAP = 24;

/**
 * 粉碎爆炸结算：切比雪夫半径清格 + Bomb 连锁入队。
 */
export class CrushResolver {
  /**
   * 处理一次点击：以 (row,col) 为圆心爆炸，并结算连锁。
   */
  public resolveTap(
    board: BoardModel,
    session: CrushRewardModel,
    row: number,
    col: number,
  ): CrushResolveResult {
    if (!board.inBounds(row, col)) {
      return { clearedIndices: [], clearedKinds: [], fired: [], chained: [] };
    }

    const burst: CrushBurst = {
      epicenter: { r: row, c: col },
      radius: Math.max(0, Math.floor(session.tapPower)),
      kind: 'tap',
    };
    session.enqueue(burst);
    return this.drainQueue(board, session, MAX_BURSTS_PER_TAP);
  }

  /**
   * 时间到 / 领取奖励：把盘面剩下的小动物全部收尾粉碎并计分。
   * 不必点完；没清完也不卡住，收尾后进结算。
   */
  public resolveFinale(
    board: BoardModel,
    session: CrushRewardModel,
    maxBursts: number,
  ): CrushResolveResult {
    const requested = Math.floor(maxBursts);
    if (!Number.isFinite(requested) || requested <= 0) {
      return { clearedIndices: [], clearedKinds: [], fired: [], chained: [] };
    }
    const limit = Math.max(board.length, requested);

    let queued = 0;
    const radius = Math.max(1, Math.floor(session.tapPower));
    for (let r = 0; r < board.size.rows && queued < limit; r += 1) {
      for (let c = 0; c < board.size.cols && queued < limit; c += 1) {
        const kind = board.getTile(r, c);
        if (kind === TileKind.Empty || kind === TileKind.Hole) {
          continue;
        }
        session.enqueue({
          epicenter: { r, c },
          radius,
          kind: 'finale',
        });
        queued += 1;
      }
    }

    if (queued === 0) {
      return { clearedIndices: [], clearedKinds: [], fired: [], chained: [] };
    }

    return this.drainQueue(board, session, limit);
  }

  /**
   * 消费队列中的爆发，直到空或达到上限。
   */
  public drainQueue(
    board: BoardModel,
    session: CrushRewardModel,
    maxBursts: number,
  ): CrushResolveResult {
    const clearedIndices: number[] = [];
    const clearedKinds: TileKind[] = [];
    const fired: CrushBurst[] = [];
    const seen = new Set<number>();

    let processed = 0;
    while (processed < maxBursts) {
      const burst = session.dequeue();
      if (!burst) {
        break;
      }
      processed += 1;
      fired.push(burst);

      const hits = this.collectRadius(board, burst.epicenter.r, burst.epicenter.c, burst.radius);
      for (const index of hits) {
        if (seen.has(index)) {
          continue;
        }
        const kind = board.cells[index] as TileKind;
        if (kind === TileKind.Empty || kind === TileKind.Hole) {
          continue;
        }
        seen.add(index);
        clearedIndices.push(index);
        clearedKinds.push(kind);

        const row = Math.floor(index / board.size.cols);
        const col = index % board.size.cols;
        board.clearTile(row, col);

        if (kind === TileKind.Bomb) {
          session.enqueue({
            epicenter: { r: row, c: col },
            radius: Math.max(1, burst.radius),
            kind: 'chain',
          });
        } else if (kind === TileKind.ColorBomb) {
          // 同色全消：以当前格颜色已空，改为半径更大的连锁
          session.enqueue({
            epicenter: { r: row, c: col },
            radius: Math.max(2, burst.radius + 1),
            kind: 'chain',
          });
        }
      }
    }

    const chained: CrushBurst[] = session.explosionsQueued.slice();
    return { clearedIndices, clearedKinds, fired, chained };
  }

  /**
   * 切比雪夫距离 ≤ radius 的格子下标（含圆心）。
   */
  private collectRadius(
    board: BoardModel,
    row: number,
    col: number,
    radius: number,
  ): number[] {
    const r0 = Math.max(0, row - radius);
    const r1 = Math.min(board.size.rows - 1, row + radius);
    const c0 = Math.max(0, col - radius);
    const c1 = Math.min(board.size.cols - 1, col + radius);
    const out: number[] = [];
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const dist = Math.max(Math.abs(r - row), Math.abs(c - col));
        if (dist <= radius) {
          out.push(board.index(r, c));
        }
      }
    }
    return out;
  }
}

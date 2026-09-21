import type { BoardModel } from '../../logic/board/BoardModel';
import type { GameEvent, GameEventBus } from '../../logic/events/GameEvents';
import type { FxPool } from '../fx/FxPool';
import type { BoardView } from '../views/BoardView';

/**
 * 订阅逻辑事件 → 驱动棋盘视图 / 特效。
 * 表现层不得修改 BoardModel，只通过 syncFromBoard 只读刷新。
 */
export class BoardPresenter {
  private unsubscribe: (() => void) | null = null;
  private board: BoardModel | null = null;

  public constructor(
    private readonly eventBus: GameEventBus,
    private readonly boardView: BoardView,
    private readonly fxPool: FxPool,
  ) {}

  /**
   * 绑定当前逻辑棋盘引用，并开始订阅事件。
   * @param board - 逻辑棋盘
   */
  public bind(board: BoardModel): void {
    this.disposeSubscription();
    this.board = board;
    this.boardView.syncFromBoard(board, true);

    this.unsubscribe = this.eventBus.subscribe((event) => {
      this.onEvent(event);
    });
  }

  /**
   * 处理领域事件。
   * @param event - 游戏事件
   */
  private onEvent(event: GameEvent): void {
    switch (event.type) {
      case 'BoardChanged':
      case 'SwapAccepted':
      case 'CascadeDone':
      case 'TilesFell':
      case 'TilesSpawned':
        if (this.board) {
          this.boardView.syncFromBoard(this.board, true);
        }
        break;
      case 'SwapRejected':
        break;
      case 'TilesCleared': {
        if (!this.board) {
          break;
        }
        const { cols } = this.board.size;
        for (let i = 0; i < event.indices.length; i += 1) {
          const index = event.indices[i]!;
          const row = Math.floor(index / cols);
          const col = index % cols;
          const fx = this.fxPool.matchClear.acquire();
          fx.playAt(row, col);
          this.fxPool.matchClear.release(fx);
        }
        break;
      }
      case 'ResolvePlayback':
        break;
      default:
        break;
    }
  }

  /**
   * 卸载订阅（切场景时调用）。
   */
  public dispose(): void {
    this.disposeSubscription();
    this.board = null;
  }

  private disposeSubscription(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

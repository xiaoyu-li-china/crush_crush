import type { GameSession } from '../../services/GameSession';
import { FxPool } from '../fx/FxPool';
import { BoardPresenter } from '../binders/BoardPresenter';
import { BoardView, type BoardViewHost } from '../views/BoardView';
import { HudView } from '../views/HudView';
import { ResultView } from '../views/ResultView';

/**
 * 关卡场景：BoardView + HUD + 结算（含看广告复活）。
 */
export class LevelScene {
  private readonly fxPool = new FxPool();
  private readonly boardView: BoardView;
  private readonly hud = new HudView();
  private readonly result = new ResultView();
  private presenter: BoardPresenter | null = null;
  private session: GameSession | null = null;
  private unsubscribeEvents: (() => void) | null = null;

  /**
   * @param host - 可选视觉宿主
   * @param cellSize - 单格像素
   */
  public constructor(host: BoardViewHost | null = null, cellSize = 64) {
    this.boardView = new BoardView({ cellSize, originX: 0, originY: 0 }, host);
  }

  /**
   * 进入关卡。
   * @param session - 已 startLevel 的会话
   * @param _levelId - 关卡 id
   */
  public onEnter(session: GameSession, _levelId: number): void {
    this.onExit();
    this.session = session;

    const board = session.getBoard();
    if (!board) {
      throw new Error('LevelScene.onEnter: board is null, call startLevel first');
    }

    this.presenter = new BoardPresenter(session.events, this.boardView, this.fxPool);
    this.presenter.bind(board);

    this.boardView.bindInput((rowA, colA, rowB, colB) => {
      session.trySwap(rowA, colA, rowB, colB);
      this.refreshHud();
    });

    this.result.bindActions((action) => {
      void this.onResultAction(action);
    });

    this.unsubscribeEvents = session.events.subscribe((event) => {
      if (event.type === 'LevelWon') {
        if (session.hasPendingMovesBonus()) {
          session.runMovesBonus();
        }
        const level = session.getLevelConfig();
        if (level?.crushEnabled || session.fsm.getCurrent() === 'CrushReward') {
          // 粉碎奖励进行中，等 CrushEnded / Settle 再弹结算
          return;
        }
        this.showResult(true);
        return;
      }
      if (event.type === 'LevelFailed') {
        this.showResult(false);
        return;
      }
      if (event.type === 'CrushEnded' || event.type === 'MovesBonusDone') {
        if (session.fsm.getCurrent() === 'CrushReward') {
          return;
        }
        if (session.fsm.getCurrent() === 'Settle') {
          this.showResult(true);
        }
        return;
      }
      if (event.type === 'GoalProgress' || event.type === 'StateChanged') {
        this.refreshHud();
      }
      if (event.type === 'StateChanged' && event.to === 'PlayerInput') {
        this.result.hide();
        const latest = session.getBoard();
        if (latest) {
          this.boardView.syncFromBoard(latest, true);
        }
      }
    });

    this.boardView.syncFromBoard(board, true);
    this.refreshHud();
  }

  public getBoardView(): BoardView {
    return this.boardView;
  }

  public getHudView(): HudView {
    return this.hud;
  }

  public getResultView(): ResultView {
    return this.result;
  }

  public onExit(): void {
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;
    this.presenter?.dispose();
    this.presenter = null;
    this.boardView.dispose();
    this.fxPool.drain();
    this.hud.dispose();
    this.result.dispose();
    this.session = null;
  }

  private refreshHud(): void {
    if (!this.session) {
      return;
    }
    this.hud.setMovesLeft(this.session.getMovesLeft());
    this.hud.setScore(this.session.getScore());
    const goals = this.session.getGoals();
    if (goals) {
      this.hud.setGoals(goals.getSnapshots());
    }
  }

  private showResult(won: boolean): void {
    if (!this.session) {
      return;
    }
    const level = this.session.getLevelConfig();
    const revive = won
      ? { allowed: false, movesGranted: 0 }
      : this.session.getReviveOffer();
    this.result.show({
      won,
      score: this.session.getScore(),
      levelId: level?.id ?? 0,
      hasNextLevel: this.session.hasNextLevel(),
      canRevive: revive.allowed,
      reviveMoves: revive.movesGranted,
    });
  }

  private async onResultAction(
    action: 'next' | 'retry' | 'lobby' | 'revive',
  ): Promise<void> {
    if (!this.session) {
      return;
    }

    if (action === 'revive') {
      const result = await this.session.watchAdToRevive();
      if (result === 'revived') {
        this.result.hide();
        this.refreshHud();
      }
      return;
    }

    if (this.session.fsm.getCurrent() === 'LevelFailed') {
      this.session.acknowledgeFailure();
    }
    if (this.session.fsm.getCurrent() === 'CrushReward') {
      this.session.finishCrushReward();
    }
    if (this.session.fsm.getCurrent() === 'Cleaning') {
      this.session.finishCleaningMode();
    }

    if (action === 'next') {
      await this.session.maybeShowSettleInterstitial();
      const ok = await this.session.continueToNextLevel();
      if (ok) {
        const levelId = this.session.getLevelConfig()?.id ?? 1;
        this.onEnter(this.session, levelId);
        return;
      }
      this.session.quitToLobby();
      this.onExit();
      return;
    }

    if (action === 'retry') {
      const ok = await this.session.retryLevel();
      if (ok) {
        const levelId = this.session.getLevelConfig()?.id ?? 1;
        this.onEnter(this.session, levelId);
      }
      return;
    }

    await this.session.maybeShowSettleInterstitial();
    this.session.quitToLobby();
    this.onExit();
  }
}

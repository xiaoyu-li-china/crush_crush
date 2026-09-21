/**
 * 结算界面：胜负、复活入口、下一关 / 重试 / 回大厅。
 */
export interface ResultViewPayload {
  won: boolean;
  score: number;
  levelId: number;
  hasNextLevel: boolean;
  /** 是否展示「看广告复活」 */
  canRevive: boolean;
  /** 复活可获得步数 */
  reviveMoves: number;
}

export type ResultViewAction = 'next' | 'retry' | 'lobby' | 'revive';

export class ResultView {
  private visible = false;
  private payload: ResultViewPayload | null = null;
  private actionHandler: ((action: ResultViewAction) => void) | null = null;

  /**
   * 绑定按钮动作。
   * @param handler - 动作回调
   */
  public bindActions(handler: (action: ResultViewAction) => void): void {
    this.actionHandler = handler;
  }

  /**
   * 展示结算。
   * @param payload - 结算数据
   */
  public show(payload: ResultViewPayload): void {
    this.payload = payload;
    this.visible = true;
  }

  /**
   * 隐藏结算。
   */
  public hide(): void {
    this.visible = false;
    this.payload = null;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getPayload(): ResultViewPayload | null {
    return this.payload;
  }

  /**
   * UI 按钮触发。
   * @param action - 动作类型
   */
  public trigger(action: ResultViewAction): void {
    this.actionHandler?.(action);
  }

  public dispose(): void {
    this.hide();
    this.actionHandler = null;
  }
}

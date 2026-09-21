import { canTransition, type GameState } from './GameState';

export type GameStateListener = (from: GameState, to: GameState) => void;

/**
 * 游戏状态机。
 * TODO: 挂载 LevelRuntime 上下文；在非法迁移时上报 Analytics。
 */
export class GameStateMachine {
  private state: GameState;
  private readonly listeners: Set<GameStateListener> = new Set();

  public constructor(initial: GameState = 'Boot') {
    this.state = initial;
  }

  public getCurrent(): GameState {
    return this.state;
  }

  public transitionTo(next: GameState): boolean {
    if (!canTransition(this.state, next)) {
      // TODO: 开发期 assert / 埋点
      return false;
    }
    const prev = this.state;
    this.state = next;
    for (const listener of this.listeners) {
      listener(prev, next);
    }
    return true;
  }

  /**
   * 强制切态（中途返回大厅等放弃流程），不校验迁移表。
   */
  public forceTo(next: GameState): boolean {
    if (this.state === next) {
      return true;
    }
    const prev = this.state;
    this.state = next;
    for (const listener of this.listeners) {
      listener(prev, next);
    }
    return true;
  }

  public subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.listeners.clear();
  }
}

import type { GoalProgressSnapshot } from '../../logic/level/LevelGoals';

/**
 * 局内 HUD：步数、分数与关卡目标进度。
 */
export class HudView {
  private movesLeft = 0;
  private score = 0;
  private goals: GoalProgressSnapshot[] = [];

  /**
   * 更新剩余步数。
   * @param moves - 步数
   */
  public setMovesLeft(moves: number): void {
    this.movesLeft = moves;
  }

  /**
   * 更新分数。
   * @param score - 分数
   */
  public setScore(score: number): void {
    this.score = score;
  }

  /**
   * 更新目标快照。
   * @param goals - 目标进度列表
   */
  public setGoals(goals: readonly GoalProgressSnapshot[]): void {
    this.goals = goals.slice();
  }

  public getSnapshot(): {
    movesLeft: number;
    score: number;
    goals: GoalProgressSnapshot[];
  } {
    return {
      movesLeft: this.movesLeft,
      score: this.score,
      goals: this.goals.slice(),
    };
  }

  public dispose(): void {
    this.movesLeft = 0;
    this.score = 0;
    this.goals = [];
  }
}

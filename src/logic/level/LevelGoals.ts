import type { LevelGoal } from './LevelConfig';
import type { TileKind } from '../board/TileType';

/**
 * 单个目标的只读快照（供 HUD / 结算 UI）。
 */
export interface GoalProgressSnapshot {
  /** 目标定义 */
  goal: LevelGoal;
  /** 当前进度 */
  current: number;
  /** 目标值 */
  target: number;
  /** 是否已完成 */
  completed: boolean;
}

/**
 * 关卡目标进度：根据消除结果与分数更新，并判定通关。
 */
export class LevelGoals {
  private readonly goals: LevelGoal[];
  private readonly progress: number[];
  private readonly targets: number[];

  /**
   * @param goals - 关卡目标列表（会浅拷贝）
   */
  public constructor(goals: readonly LevelGoal[]) {
    this.goals = goals.slice();
    this.progress = goals.map(() => 0);
    this.targets = goals.map((goal) => this.targetOf(goal));
  }

  /**
   * 原始目标列表。
   */
  public getGoals(): readonly LevelGoal[] {
    return this.goals;
  }

  /**
   * 各目标当前进度数值。
   */
  public getProgress(): readonly number[] {
    return this.progress;
  }

  /**
   * 生成 HUD 用快照。
   */
  public getSnapshots(): GoalProgressSnapshot[] {
    return this.goals.map((goal, index) => {
      const target = this.targets[index] ?? this.targetOf(goal);
      const current = this.progress[index] ?? 0;
      return {
        goal,
        current,
        target,
        completed: current >= target,
      };
    });
  }

  /**
   * 是否全部目标完成。
   */
  public isAllCompleted(): boolean {
    return this.goals.every((goal, index) => {
      return (this.progress[index] ?? 0) >= (this.targets[index] ?? this.targetOf(goal));
    });
  }

  /**
   * 根据本波消除种类更新 collect / clear_blocks 类目标。
   * @param kinds - 被消除的方块种类序列
   */
  public applyClearedKinds(kinds: readonly TileKind[]): void {
    if (kinds.length === 0) {
      return;
    }
    for (let i = 0; i < this.goals.length; i += 1) {
      const goal = this.goals[i]!;
      if (goal.type === 'clear_blocks') {
        this.progress[i] = (this.progress[i] ?? 0) + kinds.length;
      } else if (goal.type === 'collect') {
        let add = 0;
        for (let k = 0; k < kinds.length; k += 1) {
          if (kinds[k] === goal.kind) {
            add += 1;
          }
        }
        this.progress[i] = (this.progress[i] ?? 0) + add;
      }
    }
  }

  /**
   * 将分数类目标进度同步为当前总分。
   * @param score - 当前关卡总分
   */
  public syncScore(score: number): void {
    for (let i = 0; i < this.goals.length; i += 1) {
      const goal = this.goals[i]!;
      if (goal.type === 'score') {
        this.progress[i] = score;
      }
    }
  }

  public bindClearIceTarget(count: number): void {
    const n = Math.max(0, count);
    let found = false;
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'clear_ice') {
        this.targets[i] = n;
        found = true;
      }
    }
    if (!found) {
      this.goals.push({ type: 'clear_ice', count: n });
      this.progress.push(0);
      this.targets.push(n);
    }
  }

  public syncClearIce(broken: number): void {
    const n = Math.max(0, broken);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'clear_ice') {
        this.progress[i] = n;
      }
    }
  }

  public bindClearCloudTarget(count: number): void {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'clear_cloud') {
        this.targets[i] = Math.max(0, count);
      }
    }
  }

  public syncClearCloud(cleared: number): void {
    const n = Math.max(0, cleared);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'clear_cloud') {
        this.progress[i] = n;
      }
    }
  }

  public bindCollectGemsTarget(count: number): void {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'collect_gems') {
        this.targets[i] = Math.max(0, count);
      }
    }
  }

  public syncCollectGems(collected: number): void {
    const n = Math.max(0, collected);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'collect_gems') {
        this.progress[i] = n;
      }
    }
  }

  public bindCollectSnowmenTarget(count: number): void {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'collect_snowmen') {
        this.targets[i] = Math.max(0, count);
      }
    }
  }

  public syncCollectSnowmen(collected: number): void {
    const n = Math.max(0, collected);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'collect_snowmen') {
        this.progress[i] = n;
      }
    }
  }

  public bindCollectPenguinsTarget(count: number): void {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'collect_penguins') {
        this.targets[i] = Math.max(0, count);
      }
    }
  }

  public syncCollectPenguins(collected: number): void {
    const n = Math.max(0, collected);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'collect_penguins') {
        this.progress[i] = n;
      }
    }
  }

  public bindCollectChicksTarget(count: number): void {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'collect_chicks') {
        this.targets[i] = Math.max(0, count);
      }
    }
  }

  public syncCollectChicks(collected: number): void {
    const n = Math.max(0, collected);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'collect_chicks') {
        this.progress[i] = n;
      }
    }
  }

  public bindClearVinesTarget(count: number): void {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'clear_vines') {
        this.targets[i] = Math.max(0, count);
      }
    }
  }

  public syncClearVines(cleared: number): void {
    const n = Math.max(0, cleared);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i]!.type === 'clear_vines') {
        this.progress[i] = n;
      }
    }
  }

  private targetOf(goal: LevelGoal): number {
    if (goal.type === 'score') {
      return goal.score;
    }
    return goal.count;
  }
}

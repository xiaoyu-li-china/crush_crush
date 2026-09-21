import { TileKind } from '../../logic/board/TileType';
import type { GoalProgressSnapshot } from '../../logic/level/LevelGoals';

const KIND_NAME: Partial<Record<number, string>> = {
  [TileKind.Red]: '红狐',
  [TileKind.Blue]: '蓝兔',
  [TileKind.Green]: '绿蛙',
  [TileKind.Yellow]: '黄鸡',
  [TileKind.Purple]: '紫猫',
};

/** 单项目标：完整动词，避免「清冰块」这种含糊说法。 */
export function describeHudGoal(goal: GoalProgressSnapshot, compact: boolean): string {
  const n = `${goal.current}/${goal.target}`;
  switch (goal.goal.type) {
    case 'collect': {
      const name = KIND_NAME[goal.goal.kind] ?? '萌宠';
      return compact ? `${name} ${n}` : `收集${name} ${n}`;
    }
    case 'clear_ice':
      return compact ? `冰块 ${n}` : `清除冰块 ${n}`;
    case 'clear_cloud':
      return compact ? `棉花 ${n}` : `清除棉花 ${n}`;
    case 'collect_gems':
      return compact ? `粉球 ${n}` : `收集粉球 ${n}`;
    case 'collect_snowmen':
      return compact ? `雪人 ${n}` : `收集雪人 ${n}`;
    case 'collect_penguins':
      return compact ? `企鹅 ${n}` : `收集企鹅 ${n}`;
    case 'collect_chicks':
      return compact ? `萌鸡 ${n}` : `收集萌鸡 ${n}`;
    case 'clear_vines':
      return compact ? `藤蔓 ${n}` : `解开藤蔓 ${n}`;
    case 'score':
      return compact ? `分数 ${n}` : `达到分数 ${n}`;
    case 'clear_blocks':
      return compact ? `消除 ${n}` : `消除方块 ${n}`;
    default:
      return `目标 ${n}`;
  }
}

export function formatHudGoals(goals: readonly GoalProgressSnapshot[]): {
  text: string;
  progress: number;
  collectKind?: TileKind;
} {
  if (goals.length === 0) {
    return { text: '完成目标', progress: 0 };
  }
  const compact = goals.length >= 3;
  const text = goals.map((item) => describeHudGoal(item, compact)).join(' · ');
  const progress =
    goals.reduce(
      (sum, item) => sum + Math.min(1, item.current / Math.max(1, item.target)),
      0,
    ) / goals.length;
  const collect = goals.find((item) => item.goal.type === 'collect');
  return {
    text,
    progress,
    collectKind: collect && collect.goal.type === 'collect' ? collect.goal.kind : undefined,
  };
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TileKind } from '../../src/logic/board/TileType';
import { formatHudGoals } from '../../src/presentation/ui/HudGoalText';
import type { GoalProgressSnapshot } from '../../src/logic/level/LevelGoals';

function snap(
  goal: GoalProgressSnapshot['goal'],
  current: number,
  target: number,
): GoalProgressSnapshot {
  return { goal, current, target, completed: current >= target };
}

describe('HUD 目标文案', () => {
  it('双目标同时写出收集和清除冰块', () => {
    const text = formatHudGoals([
      snap({ type: 'collect', kind: TileKind.Blue, count: 12 }, 0, 12),
      snap({ type: 'clear_ice', count: 6 }, 0, 6),
    ]).text;
    assert.equal(text, '收集蓝兔 0/12 · 清除冰块 0/6');
  });

  it('三项时用短名，冰块仍单独列出', () => {
    const text = formatHudGoals([
      snap({ type: 'collect_snowmen', count: 2 }, 1, 2),
      snap({ type: 'collect_penguins', count: 4 }, 0, 4),
      snap({ type: 'clear_ice', count: 48 }, 10, 48),
    ]).text;
    assert.equal(text, '雪人 1/2 · 企鹅 0/4 · 冰块 10/48');
  });

  it('萌鸡与藤蔓有独立目标文案', () => {
    const text = formatHudGoals([
      snap({ type: 'collect_chicks', count: 6 }, 2, 6),
      snap({ type: 'clear_vines', count: 12 }, 4, 12),
    ]).text;
    assert.equal(text, '收集萌鸡 2/6 · 解开藤蔓 4/12');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_DAILY_LOOP, recordDailyClear } from '../../src/logic/economy/DailyLoop';
import {
  claimDailyTask,
  dailyTaskTitle,
  dailyTasksFor,
  DAILY_TASK_COUNT,
  recordDailyTaskStats,
  viewDailyTasks,
} from '../../src/logic/economy/DailyTasks';

describe('DailyTasks', () => {
  it('同一天生成的任务数量与首项固定通关任务', () => {
    const tasks = dailyTasksFor('2026-10-15');
    assert.equal(tasks.length, DAILY_TASK_COUNT);
    assert.equal(tasks[0]?.id, 'clear_levels');
    assert.equal(tasks[0]?.target, 3);
    assert.deepEqual(dailyTasksFor('2026-10-15').map((t) => t.id), dailyTasksFor('2026-10-15').map((t) => t.id));
  });

  it('消除与通关进度可领取并重排任务与旧版兼容', () => {
    const ymd = '2026-10-15';
    let data = { ...EMPTY_DAILY_LOOP, ymd, clearsToday: 0 };
    const patch = recordDailyTaskStats(data, { tiles: 50, specials: 2 }, Date.parse(`${ymd}T12:00:00`));
    data = patch.data;
    data = recordDailyClear(data, Date.parse(`${ymd}T12:05:00`));
    data = recordDailyClear(data, Date.parse(`${ymd}T12:10:00`));
    data = recordDailyClear(data, Date.parse(`${ymd}T12:15:00`));
    const view = viewDailyTasks(data);
    const clearTask = view.tasks.find((t) => t.id === 'clear_levels');
    assert.ok(clearTask?.done);
    const claimed = claimDailyTask(data, 'clear_levels');
    assert.ok(claimed.reward);
    assert.equal(claimed.data.playShuffleGranted, true);
  });

  it('任务文案：粉碎与消除萌宠', () => {
    assert.equal(
      dailyTaskTitle({ id: 'crush_rounds', target: 1, reward: { id: 'extraMoves', amount: 1 } }),
      '粉碎1局',
    );
    assert.equal(
      dailyTaskTitle({ id: 'clear_tiles', target: 300, reward: { id: 'hammer', amount: 1 } }),
      '消除萌宠300只',
    );
  });

  it('完成一局粉碎奖励计 1 次进度', () => {
    const ymd = '2026-10-16';
    const data = { ...EMPTY_DAILY_LOOP, ymd };
    const hasCrush = dailyTasksFor(ymd).some((t) => t.id === 'crush_rounds');
    if (!hasCrush) {
      return;
    }
    const next = recordDailyTaskStats(data, { crushRound: true }, Date.parse(`${ymd}T12:00:00`)).data;
    const task = viewDailyTasks(next).tasks.find((t) => t.id === 'crush_rounds');
    assert.ok(task);
    assert.equal(task?.progress, 1);
    assert.equal(task?.done, true);
  });
});

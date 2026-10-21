/**
 * 每日任务面板：4 行任务（进度条 + 领取），底部活跃宝箱（直接领 / 看视频双倍）。
 * 只算位置，不画。
 */
import type { DailyTasksView, DailyTaskView } from '../../logic/economy/DailyTasks';
import noticeJson from '../../config/notice.json';
import { panelCloseButton } from './PanelChrome';

export interface DailyTasksPanelButton {
  id: 'resume' | 'daily_claim' | 'daily_chest' | 'daily_chest_double';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** daily_claim：任务下标 */
  index?: number;
}

export interface DailyTaskRowLayout {
  task: DailyTaskView;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  iconCx: number;
  textX: number;
  barX: number;
  barY: number;
  barW: number;
  barH: number;
  /** 0–1 */
  ratio: number;
  state: 'claim' | 'claimed' | 'todo';
  button: DailyTasksPanelButton | null;
}

export interface DailyTasksPanelLayout {
  panel: { x: number; y: number; w: number; h: number };
  title: string;
  subtitle: string;
  rows: DailyTaskRowLayout[];
  chest: {
    x: number;
    y: number;
    w: number;
    h: number;
    iconCx: number;
    iconCy: number;
    textX: number;
    claimedCount: number;
    total: number;
    state: 'locked' | 'ready' | 'claimed';
    hint: string;
  };
  buttons: DailyTasksPanelButton[];
}

const ROW_H = 64;
const ROW_GAP = 8;
const CHEST_H = 96;

export function layoutDailyTasksPanel(input: {
  width: number;
  height: number;
  view: DailyTasksView;
}): DailyTasksPanelLayout {
  const panelW = Math.min(352, input.width - 24);
  const padX = 14;
  const titleH = 62;
  const footH = 16;
  const tasks = input.view.tasks;
  const listH = tasks.length * ROW_H + Math.max(0, tasks.length - 1) * ROW_GAP;
  const panelH = Math.min(input.height * 0.92, titleH + listH + 12 + CHEST_H + footH);
  const x = (input.width - panelW) / 2;
  const y = Math.max(12, (input.height - panelH) / 2);
  const innerW = panelW - padX * 2;
  const btnW = 64;
  const btnH = 32;

  const buttons: DailyTasksPanelButton[] = [{ ...panelCloseButton({ x, y, w: panelW }) }];
  const rows: DailyTaskRowLayout[] = tasks.map((task, index) => {
    const ry = y + titleH + index * (ROW_H + ROW_GAP);
    const rx = x + padX;
    const iconCx = rx + 26;
    const textX = rx + 54;
    const barX = textX;
    const barW = Math.max(60, rx + innerW - btnW - 14 - textX);
    const state: DailyTaskRowLayout['state'] = task.claimed ? 'claimed' : task.done ? 'claim' : 'todo';
    const button: DailyTasksPanelButton | null = state === 'claim'
      ? {
        id: 'daily_claim',
        x: rx + innerW - btnW - 6,
        y: ry + (ROW_H - btnH) / 2,
        w: btnW,
        h: btnH,
        label: '领取',
        index,
      }
      : null;
    if (button) {
      buttons.push(button);
    }
    return {
      task,
      index,
      x: rx,
      y: ry,
      w: innerW,
      h: ROW_H,
      iconCx,
      textX,
      barX,
      barY: ry + 39,
      barW,
      barH: 14,
      ratio: task.target > 0 ? Math.min(1, task.progress / task.target) : 0,
      state,
      button,
    };
  });

  const chestY = y + titleH + listH + 12;
  const claimedCount = tasks.filter((task) => task.claimed).length;
  const chestState = input.view.chestClaimed ? 'claimed' : input.view.chestReady ? 'ready' : 'locked';
  const chestX = x + padX;
  if (chestState === 'ready') {
    const half = (innerW - 24 - 10) / 2;
    const by = chestY + CHEST_H - 44;
    buttons.push(
      {
        id: 'daily_chest',
        x: chestX + 12,
        y: by,
        w: half,
        h: 36,
        label: noticeJson.dailyTasks.chestClaim,
      },
      {
        id: 'daily_chest_double',
        x: chestX + 12 + half + 10,
        y: by,
        w: half,
        h: 36,
        label: noticeJson.dailyTasks.chestDouble,
      },
    );
  }
  return {
    panel: { x, y, w: panelW, h: panelH },
    title: noticeJson.dailyTasks.title,
    subtitle: noticeJson.dailyTasks.refresh,
    rows,
    chest: {
      x: chestX,
      y: chestY,
      w: innerW,
      h: CHEST_H,
      iconCx: chestX + 34,
      iconCy: chestY + (chestState === 'ready' ? 26 : CHEST_H / 2),
      textX: chestX + 68,
      claimedCount,
      total: tasks.length,
      state: chestState,
      hint: chestState === 'claimed' ? '今日宝箱已领取，明天再来' : noticeJson.dailyTasks.chestHint,
    },
    buttons,
  };
}

/** 大厅入口文案：有可领奖励时提示数量 */
export function dailyTasksLobbyLabel(view: DailyTasksView): string {
  if (view.claimable > 0) {
    return noticeJson.dailyTasks.lobbyBar.replace('{n}', String(view.claimable));
  }
  const done = view.tasks.filter((task) => task.claimed).length;
  if (view.chestClaimed) {
    return '每日任务 · 今日全部完成';
  }
  return `每日任务 · 已领 ${done}/${view.tasks.length}`;
}

/** 左上角侧栏：固定「每日任务」，进度用红点表示。 */
export function dailyTasksSideLabel(_view: DailyTasksView): string {
  return noticeJson.dailyTasks.title;
}

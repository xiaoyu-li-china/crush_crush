/**
 * 本地每日循环：登录锤子入包、今日 3 关领重排。
 */

import {
  EMPTY_BOOSTER_DAILY,
  parseBoosterDaily,
  type BoosterDailyFlags,
} from './BoosterEconomy';

export const DAILY_GOAL_CLEARS = 3;
export const DAILY_HAMMER_GRANT = 1;

export interface DailyLoopData extends BoosterDailyFlags {
  ymd: string;
  bonusHammer: number;
  clearsToday: number;
}

export const EMPTY_DAILY_LOOP: DailyLoopData = {
  ymd: '',
  bonusHammer: 0,
  clearsToday: 0,
  ...EMPTY_BOOSTER_DAILY,
};

export function localYmd(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 本地日历的前一天。
 * 和 localYmd 用同一个时区，每日挑战用它判断「昨天完成没有」，不再单独定义 0 点。
 */
export function previousLocalYmd(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    return ymd;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() - 1);
  return localYmd(date.getTime());
}

export function applyDailyLogin(
  prev: DailyLoopData | null | undefined,
  nowMs: number,
): { data: DailyLoopData; grantedHammer: boolean } {
  const today = localYmd(nowMs);
  const flags = parseBoosterDaily(prev);
  if (!prev || prev.ymd !== today) {
    return {
      data: {
        ymd: today,
        bonusHammer: DAILY_HAMMER_GRANT,
        clearsToday: 0,
        ...EMPTY_BOOSTER_DAILY,
      },
      grantedHammer: true,
    };
  }
  return {
    data: {
      ymd: prev.ymd,
      bonusHammer: prev.bonusHammer,
      clearsToday: prev.clearsToday,
      ...flags,
    },
    grantedHammer: false,
  };
}

export function recordDailyClear(data: DailyLoopData, nowMs: number): DailyLoopData {
  const aligned = applyDailyLogin(data, nowMs).data;
  return {
    ...aligned,
    clearsToday: aligned.clearsToday + 1,
  };
}

export function lobbyDailyHint(clearsToday: number, shuffleGranted: boolean): string {
  if (clearsToday >= DAILY_GOAL_CLEARS) {
    return shuffleGranted
      ? '今日目标完成 · 重排已到账'
      : '今日目标完成，随时再开一关放松一下';
  }
  const left = DAILY_GOAL_CLEARS - Math.max(0, clearsToday);
  return `今日再过 ${left} 关可领重排`;
}

export interface LobbyDailyProgress {
  done: number;
  goal: number;
  label: string;
  readyToClaim: boolean;
  claimed: boolean;
}

/** 大厅进度条：满 3 格且还没领，才出现领取按钮。 */
export function lobbyDailyProgress(
  clearsToday: number,
  shuffleGranted: boolean,
): LobbyDailyProgress {
  const done = Math.max(0, Math.min(DAILY_GOAL_CLEARS, Math.floor(clearsToday) || 0));
  return {
    done,
    goal: DAILY_GOAL_CLEARS,
    label: `今日通关进度 [${done}/${DAILY_GOAL_CLEARS}]`,
    readyToClaim: done >= DAILY_GOAL_CLEARS && !shuffleGranted,
    claimed: shuffleGranted && done >= DAILY_GOAL_CLEARS,
  };
}

/** 玩家点「点击领取」后才记成已领。满 3 关之前点了也不发。 */
export function claimDailyShuffle(data: DailyLoopData): {
  data: DailyLoopData;
  granted: boolean;
} {
  if (data.clearsToday < DAILY_GOAL_CLEARS || data.playShuffleGranted) {
    return { data, granted: false };
  }
  return {
    data: { ...data, playShuffleGranted: true },
    granted: true,
  };
}

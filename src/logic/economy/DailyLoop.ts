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

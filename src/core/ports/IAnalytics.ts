/**
 * 埋点端口：IAA 漏斗与关卡行为分析。
 */
export type AnalyticsEventName =
  | 'app_boot'
  | 'level_start'
  | 'level_win'
  | 'level_fail'
  | 'crush_start'
  | 'crush_end'
  | 'ad_show'
  | 'ad_complete'
  | 'ad_error'
  | 'invite_bind'
  | 'invite_gift'
  | 'invite_claim';

export interface IAnalytics {
  track(event: AnalyticsEventName, props?: Record<string, string | number | boolean>): void;
}

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
  | 'invite_claim'
  | 'mahjong_level_start'
  | 'mahjong_level_resume'
  | 'mahjong_level_win'
  | 'mahjong_level_fail'
  | 'mahjong_progress_save'
  | 'mahjong_coin_buy_tool'
  | 'mahjong_coin_replay'
  | 'mahjong_ad_slot'
  | 'mahjong_slot_full_revive'
  | 'mahjong_hall_enter'
  | 'mahjong_tile_tap'
  | 'mahjong_triple_clear'
  | 'mahjong_tool_use'
  | 'mahjong_theme_exposure'
  | 'mahjong_auto_next'
  | 'mahjong_cdn_manifest_ok'
  | 'mahjong_cdn_manifest_fail'
  | 'mahjong_theme_cdn_fallback'
  | 'mahjong_ops_config_ok'
  | 'mahjong_ops_config_fail'
  | 'mahjong_ops_level_sample';

export interface IAnalytics {
  track(event: AnalyticsEventName, props?: Record<string, string | number | boolean>): void;
}

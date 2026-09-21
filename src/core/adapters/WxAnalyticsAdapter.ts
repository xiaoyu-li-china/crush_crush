import type { AnalyticsEventName, IAnalytics } from '../ports/IAnalytics';

/**
 * 微信埋点适配器骨架。
 * TODO: 对接 wx.reportEvent 或自建上报网关。
 */
export class WxAnalyticsAdapter implements IAnalytics {
  public track(event: AnalyticsEventName, props?: Record<string, string | number | boolean>): void {
    if (typeof wx.reportEvent === 'function') {
      wx.reportEvent(event, props ?? {});
      return;
    }
    // 开发期兜底：控制台输出，避免逻辑层分支
    // eslint-disable-next-line no-console
    console.info('[analytics]', event, props ?? {});
  }
}

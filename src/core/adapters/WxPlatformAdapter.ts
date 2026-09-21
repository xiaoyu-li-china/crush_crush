import type {
  IPlatform,
  PlatformLifecycleHandler,
  PlatformSystemInfo,
} from '../ports/IPlatform';
import { readWxSystemInfo } from '../utils/wxHost';
import { readWxLaunchQuery } from '../utils/wxLaunchQuery';

/**
 * 微信平台能力适配器。
 */
export class WxPlatformAdapter implements IPlatform {
  public getSystemInfo(): PlatformSystemInfo {
    const info = readWxSystemInfo();
    return {
      brand: info.brand,
      model: info.model,
      platform: info.platform,
      system: info.system,
      SDKVersion: info.SDKVersion,
      windowWidth: info.windowWidth,
      windowHeight: info.windowHeight,
      pixelRatio: info.pixelRatio,
      safeAreaBottom: Math.max(
        0,
        info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight),
      ),
    };
  }

  public onShow(handler: PlatformLifecycleHandler): void {
    wx.onShow(handler);
  }

  public onHide(handler: PlatformLifecycleHandler): void {
    wx.onHide(handler);
  }

  public offShow(handler: PlatformLifecycleHandler): void {
    wx.offShow(handler);
  }

  public offHide(handler: PlatformLifecycleHandler): void {
    wx.offHide(handler);
  }

  public getLaunchQuery(): Record<string, string> {
    return readWxLaunchQuery();
  }
}

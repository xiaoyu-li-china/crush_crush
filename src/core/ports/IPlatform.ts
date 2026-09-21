/**
 * 平台能力端口：系统信息、前后台、分包加载等。
 */
export interface PlatformSystemInfo {
  brand: string;
  model: string;
  platform: string;
  system: string;
  SDKVersion: string;
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
  /** 底部安全区（Home Indicator），没有则当 0。 */
  safeAreaBottom?: number;
}

export type PlatformLifecycleHandler = () => void;

export interface IPlatform {
  getSystemInfo(): PlatformSystemInfo;
  onShow(handler: PlatformLifecycleHandler): void;
  onHide(handler: PlatformLifecycleHandler): void;
  offShow(handler: PlatformLifecycleHandler): void;
  offHide(handler: PlatformLifecycleHandler): void;
  /** 冷启动或从分享卡片进入时的 query。 */
  getLaunchQuery?(): Record<string, string>;
}

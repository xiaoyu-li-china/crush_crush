/**
 * 广告服务端口：逻辑层只关心展示结果，不关心微信广告 SDK。
 */
export type AdPlacement =
  | 'rewarded_revive'
  | 'rewarded_crush_extend'
  | 'interstitial_settle'
  | 'banner_lobby';

export type AdShowResult = 'completed' | 'skipped' | 'error' | 'not_ready';

export interface IAdService {
  /** 预加载指定广告位。 */
  load(placement: AdPlacement): Promise<void>;

  /** 展示广告；激励视频 completed 表示看完。 */
  show(placement: AdPlacement): Promise<AdShowResult>;

  /** 当前广告位是否已就绪。 */
  isReady(placement: AdPlacement): boolean;

  /**
   * 隐藏持续展示型广告（大厅原生模板横幅）。
   * 激励视频 / 插屏可省略。
   */
  hide?(placement: AdPlacement): void;

  /** 释放广告实例与监听（切场景 / 销毁时调用）。 */
  dispose(): void;
}

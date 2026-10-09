import type { MahjongOpsConfig } from '../../logic/mahjong/MahjongOpsConfig';
import cloudJson from '../../config/cloud.json';

function cloudApi(): WxCloud | null {
  try {
    if (typeof wx === 'undefined' || !wx.cloud) {
      return null;
    }
    return wx.cloud;
  } catch {
    return null;
  }
}

/** 从云函数 getMahjongOps 拉运营配置（云库 mahjong_ops/config）。 */
export async function fetchMahjongOpsViaCloudFunction(): Promise<Partial<MahjongOpsConfig> | null> {
  if (cloudJson.enabled === false) {
    return null;
  }
  const cloud = cloudApi();
  if (!cloud || typeof cloud.callFunction !== 'function') {
    return null;
  }
  const res = await cloud.callFunction({ name: 'getMahjongOps', data: {} });
  const payload = res.result as { ok?: boolean; config?: Partial<MahjongOpsConfig> } | undefined;
  if (!payload?.ok || !payload.config) {
    return null;
  }
  return payload.config;
}

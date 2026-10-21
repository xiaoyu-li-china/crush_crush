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

let cloudReady: Promise<boolean> | null = null;

function ensureCloudInit(): Promise<boolean> {
  if (cloudReady) {
    return cloudReady;
  }
  cloudReady = (async () => {
    if (cloudJson.enabled === false) {
      return false;
    }
    const cloud = cloudApi();
    if (!cloud || typeof cloud.init !== 'function') {
      return false;
    }
    try {
      const env = cloudJson.envId || cloud.DYNAMIC_CURRENT_ENV;
      cloud.init(env ? { env, traceUser: true } : { traceUser: true });
      return true;
    } catch {
      return false;
    }
  })();
  return cloudReady;
}

/** 从云函数 getMahjongOps 拉运营配置（云库 mahjong_ops/config）。 */
export async function fetchMahjongOpsViaCloudFunction(): Promise<Partial<MahjongOpsConfig> | null> {
  if (cloudJson.enabled === false) {
    return null;
  }
  if (!(await ensureCloudInit())) {
    return null;
  }
  const cloud = cloudApi();
  if (!cloud || typeof cloud.callFunction !== 'function') {
    return null;
  }
  try {
    const res = await cloud.callFunction({ name: 'getMahjongOps', data: {} });
    const payload = res.result as { ok?: boolean; config?: Partial<MahjongOpsConfig> } | undefined;
    if (!payload?.ok || !payload.config) {
      return null;
    }
    return payload.config;
  } catch {
    return null;
  }
}

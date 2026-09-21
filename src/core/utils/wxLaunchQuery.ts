/**
 * 读取微信冷启动 / 从分享卡片进入时的 query。
 */

export function normalizeWxQuery(query: unknown): Record<string, string> {
  if (!query || typeof query !== 'object') {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value == null || value === '') {
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

export function readWxLaunchQuery(): Record<string, string> {
  if (typeof wx === 'undefined') {
    return {};
  }
  try {
    const launch =
      typeof wx.getLaunchOptionsSync === 'function' ? wx.getLaunchOptionsSync() : null;
    const enter =
      typeof wx.getEnterOptionsSync === 'function' ? wx.getEnterOptionsSync() : null;
    return {
      ...normalizeWxQuery(launch?.query),
      ...normalizeWxQuery(enter?.query),
    };
  } catch {
    return {};
  }
}

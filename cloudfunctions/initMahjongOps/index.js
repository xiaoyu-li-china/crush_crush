const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTION = 'mahjong_ops';
const DOC_ID = 'config';

const DEFAULT_CONFIG = {
  version: 1,
  economy: { coinCost: 100, coinPerTriple: 1, starPerTriple: 1 },
  session: { timeoutSec: 720 },
  generation: {
    seedVersion: 1,
    maxAttempts: 16,
    level1Tiles: 9,
    standardTiles: 105,
    typeCountLevel2: 6,
    typeCountFromLevel3: { min: 6, maxInclusive: 8 },
  },
  theme: {
    level1ThemeId: 'default',
    level2ThemeId: 'default',
    cycleAfterLevel: 3000,
    sequentialFromLevel3: false,
  },
  levelOverrides: [],
  sampling: { enabled: true, everyNLevels: 50 },
  ads: { rewardedVideoSlot: true },
  tools: { freeToUse: true },
};

exports.main = async (event) => {
  const db = cloud.database();
  const config = event && event.config ? event.config : DEFAULT_CONFIG;
  const now = Date.now();
  try {
    await db.createCollection(COLLECTION);
  } catch {
    // already exists
  }
  try {
    await db.collection(COLLECTION).doc(DOC_ID).set({
      data: {
        config,
        updatedAt: now,
        note: '运维在控制台改 config 字段即可热更新；客户端云拉失败时用包内 mahjong-ops.json',
      },
    });
    return { ok: true, created: true, version: config.version ?? 1 };
  } catch (err) {
    return {
      ok: false,
      reason: String((err && (err.errMsg || err.message)) || err),
    };
  }
};

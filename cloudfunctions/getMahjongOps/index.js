const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTION = 'mahjong_ops';
const DOC_ID = 'config';

exports.main = async () => {
  const db = cloud.database();
  try {
    const res = await db.collection(COLLECTION).doc(DOC_ID).get();
    const row = res.data;
    if (!row || !row.config) {
      return { ok: false, reason: 'missing_config' };
    }
    return {
      ok: true,
      version: row.config.version ?? 1,
      config: row.config,
      updatedAt: row.updatedAt ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      reason: String((err && (err.errMsg || err.message)) || err),
    };
  }
};

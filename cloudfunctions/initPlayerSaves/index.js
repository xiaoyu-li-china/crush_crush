const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const db = cloud.database();
  try {
    await db.createCollection('player_saves');
    return { created: true };
  } catch (err) {
    return {
      created: false,
      message: String((err && (err.errMsg || err.message)) || err),
    };
  }
};

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function normalizeCode(raw) {
  const text = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (text.length < 6 || text.length > 12) {
    return '';
  }
  return text.slice(0, 8);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const inviterCode = normalizeCode(event && event.inviterCode);
  if (!OPENID) {
    return { ok: false, reason: 'no_openid' };
  }
  if (!inviterCode) {
    return { ok: false, reason: 'invalid' };
  }

  const db = cloud.database();
  const _ = db.command;

  try {
    await db.createCollection('invite_claims');
  } catch (err) {
    // 集合已存在
  }

  const existing = await db
    .collection('invite_claims')
    .where({ inviteeOpenid: OPENID })
    .limit(1)
    .get();
  if (existing.data && existing.data.length > 0) {
    return { ok: true, reason: 'already' };
  }

  const found = await db
    .collection('player_saves')
    .where({ 'invite.code': inviterCode })
    .limit(5)
    .get();
  const rows = found.data || [];
  const inviter = rows.find((row) => row._openid && row._openid !== OPENID);
  if (!inviter) {
    const self = rows.find((row) => row._openid === OPENID);
    if (self) {
      return { ok: false, reason: 'self' };
    }
    return { ok: false, reason: 'not_found', retry: true };
  }

  try {
    if (typeof db.collection('invite_claims').doc(OPENID).create === 'function') {
      await db.collection('invite_claims').doc(OPENID).create({
        data: {
          inviteeOpenid: OPENID,
          inviterCode,
          inviterOpenid: inviter._openid,
          createdAt: Date.now(),
        },
      });
    } else {
      await db.collection('invite_claims').add({
        data: {
          inviteeOpenid: OPENID,
          inviterCode,
          inviterOpenid: inviter._openid,
          createdAt: Date.now(),
        },
      });
    }
  } catch (err) {
    return { ok: true, reason: 'already' };
  }

  await db.collection('player_saves').doc(inviter._id).update({
    data: {
      'invite.creditHammer': _.inc(1),
      updatedAt: Date.now(),
    },
  });

  return { ok: true, credited: true };
};

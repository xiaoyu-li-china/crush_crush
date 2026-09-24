const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const LEADERBOARD = 'leaderboard';
const PLAYER_SAVES = 'player_saves';
const LIMIT = 50;

function asNonNegInt(value, fallback = 0) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

function trimStr(value, max) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function maxClearedFromProgress(progress) {
  if (!progress || typeof progress !== 'object') {
    return 0;
  }
  const fromHighest = Math.max(0, asNonNegInt(progress.highestLevelId, 1) - 1);
  const scores = progress.levelScores;
  if (!scores || typeof scores !== 'object') {
    return fromHighest;
  }
  let fromScores = 0;
  for (const key of Object.keys(scores)) {
    const id = Math.floor(Number(key));
    if (Number.isFinite(id) && id > fromScores) {
      fromScores = id;
    }
  }
  return Math.max(fromHighest, fromScores);
}

function isPlaceholderName(name) {
  const n = String(name || '').trim();
  return !n || n === '微信玩家' || n === '我';
}

/** 没有昵称时用 openId 尾号区分，避免所有人同名。 */
function displayName(nickName, openid, userId) {
  if (!isPlaceholderName(nickName)) {
    return trimStr(nickName, 32);
  }
  const seed = String(openid || userId || '').replace(/[^A-Za-z0-9]/g, '');
  const tail = seed.slice(-4).toUpperCase() || '????';
  return `玩家${tail}`;
}

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
  } catch (err) {
    // already exists
  }
}

async function upsertSelf(db, openid, payload) {
  const col = db.collection(LEADERBOARD);
  const found = await col.where({ _openid: openid }).limit(1).get();
  const row = found.data && found.data[0];
  const nickName = isPlaceholderName(payload.nickName) ? '' : payload.nickName;
  const avatarUrl = payload.avatarUrl || '';
  if (row && row._id) {
    const nextMax = Math.max(asNonNegInt(row.maxLevel), payload.maxLevel);
    const nextScore = Math.max(asNonNegInt(row.score), payload.score);
    await col.doc(row._id).update({
      data: {
        userId: payload.userId || row.userId,
        wxId: payload.wxId || row.wxId,
        openid,
        maxLevel: nextMax,
        score: nextScore,
        nickName: nickName || row.nickName || '',
        avatarUrl: avatarUrl || row.avatarUrl || '',
        updatedAt: Date.now(),
      },
    });
    return;
  }
  await col.add({
    data: {
      userId: payload.userId,
      wxId: payload.wxId,
      openid,
      maxLevel: payload.maxLevel,
      score: payload.score,
      nickName,
      avatarUrl,
      updatedAt: Date.now(),
    },
  });
}

function normalizeRow(doc, openid, source) {
  const docOpenid = trimStr(doc._openid || doc.openid || '', 64);
  const maxLevel = source === 'save'
    ? maxClearedFromProgress(doc.progress)
    : asNonNegInt(doc.maxLevel);
  const score = source === 'save'
    ? maxLevel
    : asNonNegInt(doc.score, maxLevel);
  const invite = doc.invite && typeof doc.invite === 'object' ? doc.invite : {};
  const code = trimStr(
    (source === 'save' ? invite.code : doc.wxId || doc.userId) || '',
    48,
  );
  const profile = doc.profile && typeof doc.profile === 'object' ? doc.profile : {};
  const nickRaw = trimStr(
    source === 'save'
      ? (profile.nickName || doc.nickName)
      : doc.nickName,
    32,
  );
  const avatarUrl = trimStr(
    source === 'save'
      ? (profile.avatarUrl || doc.avatarUrl)
      : doc.avatarUrl,
    512,
  );
  const userId = code || docOpenid || trimStr(doc._id, 48);
  return {
    _openid: docOpenid,
    _docId: trimStr(doc._id, 64),
    userId,
    maxLevel,
    score,
    bestTimeMs: null,
    completed: false,
    isSelf: !!(openid && docOpenid && docOpenid === openid),
    nickName: nickRaw,
    avatarUrl,
    wxId: code || docOpenid.slice(-8) || userId,
  };
}

/** 同一人只留一行：先按 openid，再按邀请码，取最高关。 */
function dedupePlayers(rows) {
  const byOpenid = new Map();
  const noOpenid = [];

  for (const row of rows) {
    if (row._openid) {
      const prev = byOpenid.get(row._openid);
      if (!prev) {
        byOpenid.set(row._openid, row);
        continue;
      }
      byOpenid.set(row._openid, pickBetter(prev, row));
    } else {
      noOpenid.push(row);
    }
  }

  const byWxId = new Map();
  for (const row of byOpenid.values()) {
    const key = row.wxId || row.userId;
    const prev = byWxId.get(key);
    if (!prev) {
      byWxId.set(key, row);
      continue;
    }
    // 同邀请码多 openid：保留分数更高者（异常数据）
    byWxId.set(key, pickBetter(prev, row));
  }

  for (const row of noOpenid) {
    const key = row.wxId || row.userId || row._docId;
    if (!key) {
      continue;
    }
    const prev = byWxId.get(key);
    if (!prev) {
      byWxId.set(key, row);
      continue;
    }
    byWxId.set(key, pickBetter(prev, row));
  }

  return Array.from(byWxId.values());
}

function pickBetter(a, b) {
  const scoreA = Math.max(a.score, a.maxLevel);
  const scoreB = Math.max(b.score, b.maxLevel);
  const better = scoreB > scoreA ? b : a;
  const other = better === a ? b : a;
  return {
    ...better,
    nickName: better.nickName || other.nickName,
    avatarUrl: better.avatarUrl || other.avatarUrl,
    wxId: better.wxId || other.wxId,
    userId: better.userId || other.userId,
    isSelf: better.isSelf || other.isSelf,
    _openid: better._openid || other._openid,
    maxLevel: Math.max(a.maxLevel, b.maxLevel),
    score: Math.max(scoreA, scoreB),
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, reason: 'no_openid' };
  }

  const maxLevel = asNonNegInt(event && event.maxLevel);
  const nickName = trimStr(event && event.nickName, 32);
  const avatarUrl = trimStr(event && event.avatarUrl, 512);
  const userId = trimStr((event && event.userId) || OPENID, 48) || OPENID;
  const wxId = trimStr((event && event.wxId) || userId, 48) || userId;
  const limit = Math.min(100, Math.max(1, asNonNegInt(event && event.limit, LIMIT) || LIMIT));

  const db = cloud.database();
  await ensureCollection(db, LEADERBOARD);

  await upsertSelf(db, OPENID, {
    userId,
    wxId,
    maxLevel,
    score: maxLevel,
    nickName,
    avatarUrl,
  });

  try {
    const saves = await db
      .collection(PLAYER_SAVES)
      .where({ _openid: OPENID })
      .limit(1)
      .get();
    const selfSave = (saves.data || [])[0];
    if (selfSave && selfSave._id && (!isPlaceholderName(nickName) || avatarUrl)) {
      await db.collection(PLAYER_SAVES).doc(selfSave._id).update({
        data: {
          'profile.nickName': isPlaceholderName(nickName) ? '' : nickName,
          'profile.avatarUrl': avatarUrl || '',
          updatedAt: Date.now(),
        },
      });
    }
  } catch (err) {
    // ignore
  }

  let boardDocs = [];
  try {
    const boardRes = await db.collection(LEADERBOARD).limit(100).get();
    boardDocs = (boardRes.data || []).map((doc) => normalizeRow(doc, OPENID, 'board'));
  } catch (err) {
    boardDocs = [];
  }

  let saveDocs = [];
  try {
    const saveRes = await db.collection(PLAYER_SAVES).limit(100).get();
    saveDocs = (saveRes.data || []).map((doc) => normalizeRow(doc, OPENID, 'save'));
  } catch (err) {
    saveDocs = [];
  }

  const merged = dedupePlayers(boardDocs.concat(saveDocs))
    .filter((row) => row.maxLevel > 0 || row.isSelf)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      if (a.maxLevel !== b.maxLevel) {
        return b.maxLevel - a.maxLevel;
      }
      return String(a.userId).localeCompare(String(b.userId));
    });

  const rows = merged.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    maxLevel: row.maxLevel,
    bestTimeMs: null,
    completed: false,
    isSelf: !!row.isSelf,
    nickName: displayName(row.nickName, row._openid, row.userId),
    avatarUrl: row.avatarUrl || undefined,
    wxId: row.wxId || row.userId,
    score: row.score,
  }));

  const self = rows.find((row) => row.isSelf);
  return {
    ok: true,
    selfRank: self ? self.rank : 0,
    rows,
    hint: '',
  };
};

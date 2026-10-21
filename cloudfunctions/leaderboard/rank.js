/**
 * 排行榜纯函数：周号、行归一、排序、周数据滚动。不依赖 wx-server-sdk，便于本地单测。
 * 周按北京时间（UTC+8）算，和客户端 localIsoWeek 对齐。
 */
const TZ_OFFSET_MS = 8 * 3600 * 1000;
const DAY_MS = 86400000;

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

function isoWeekOf(ms) {
  const local = new Date(ms + TZ_OFFSET_MS);
  const utc = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const dow = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dow);
  const isoYear = utc.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((utc.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function previousWeekOf(ms) {
  return isoWeekOf(ms - 7 * DAY_MS);
}

/** 下一个北京时间周一 0 点 */
function nextSettleAt(ms) {
  const local = new Date(ms + TZ_OFFSET_MS);
  const dow = local.getUTCDay() || 7;
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TZ_OFFSET_MS;
  return midnight + (8 - dow) * DAY_MS;
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

function totalFromProgress(progress) {
  if (!progress || typeof progress !== 'object') {
    return 0;
  }
  const scores = progress.levelScores;
  let sum = 0;
  if (scores && typeof scores === 'object') {
    for (const value of Object.values(scores)) {
      sum += asNonNegInt(value);
    }
  }
  return Math.max(sum, asNonNegInt(progress.totalScore));
}

/**
 * 读出自己的旧记录，滚到本周，合并客户端上报。
 * 客户端的 weekKey 和服务端不一致时（跨周、改时间）不采信它的周分。
 */
function rollSelfDoc(prev, payload, nowMs) {
  const curWeek = isoWeekOf(nowMs);
  const old = prev || {};
  let weekKey = trimStr(old.weekKey, 16);
  let weekScore = asNonNegInt(old.weekScore);
  let prevWeekKey = trimStr(old.prevWeekKey, 16);
  let prevWeekScore = asNonNegInt(old.prevWeekScore);
  if (weekKey !== curWeek) {
    if (weekKey) {
      prevWeekKey = weekKey;
      prevWeekScore = weekScore;
    }
    weekKey = curWeek;
    weekScore = 0;
  }
  if (payload.weekKey === curWeek) {
    weekScore = Math.max(weekScore, asNonNegInt(payload.weekScore));
  }
  const nickName = isPlaceholderName(payload.nickName) ? '' : trimStr(payload.nickName, 32);
  return {
    v: 2,
    openid: payload.openid,
    userId: payload.userId || old.userId || '',
    wxId: payload.wxId || old.wxId || '',
    nickName: nickName || old.nickName || '',
    avatarUrl: trimStr(payload.avatarUrl, 512) || old.avatarUrl || '',
    maxLevel: Math.max(asNonNegInt(old.maxLevel), asNonNegInt(payload.maxLevel)),
    totalScore: Math.max(asNonNegInt(old.totalScore), asNonNegInt(payload.totalScore)),
    weekKey,
    weekScore,
    prevWeekKey,
    prevWeekScore,
    rewardWeek: trimStr(old.rewardWeek, 16),
    updatedAt: nowMs,
  };
}

/** 上周我拿了多少分；没参加返回 0 */
function scoreForWeek(doc, week) {
  if (!doc) {
    return 0;
  }
  if (doc.weekKey === week) {
    return asNonNegInt(doc.weekScore);
  }
  if (doc.prevWeekKey === week) {
    return asNonNegInt(doc.prevWeekScore);
  }
  return 0;
}

function rowFromBoardDoc(doc, selfOpenid) {
  const openid = trimStr(doc.openid || doc._id, 64);
  return {
    openid,
    userId: trimStr(doc.wxId || doc.userId || openid, 48),
    maxLevel: asNonNegInt(doc.maxLevel),
    totalScore: asNonNegInt(doc.totalScore),
    weekKey: trimStr(doc.weekKey, 16),
    weekScore: asNonNegInt(doc.weekScore),
    nickName: trimStr(doc.nickName, 32),
    avatarUrl: trimStr(doc.avatarUrl, 512),
    isSelf: !!selfOpenid && openid === selfOpenid,
  };
}

function rowFromSaveDoc(doc, selfOpenid) {
  const openid = trimStr(doc._openid || doc.openid, 64);
  const profile = doc.profile && typeof doc.profile === 'object' ? doc.profile : {};
  const invite = doc.invite && typeof doc.invite === 'object' ? doc.invite : {};
  return {
    openid,
    userId: trimStr(invite.code || openid, 48),
    maxLevel: maxClearedFromProgress(doc.progress),
    totalScore: totalFromProgress(doc.progress),
    weekKey: '',
    weekScore: 0,
    nickName: trimStr(profile.nickName || doc.nickName, 32),
    avatarUrl: trimStr(profile.avatarUrl || doc.avatarUrl, 512),
    isSelf: !!selfOpenid && openid === selfOpenid,
  };
}

/** 同一 openid 合并成一行：进度取大，资料取有值的那份。 */
function mergeByOpenid(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.openid || row.userId;
    if (!key) {
      continue;
    }
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row });
      continue;
    }
    map.set(key, {
      ...prev,
      userId: prev.userId || row.userId,
      maxLevel: Math.max(prev.maxLevel, row.maxLevel),
      totalScore: Math.max(prev.totalScore, row.totalScore),
      weekKey: prev.weekKey || row.weekKey,
      weekScore: Math.max(prev.weekScore, row.weekScore),
      nickName: prev.nickName || row.nickName,
      avatarUrl: prev.avatarUrl || row.avatarUrl,
      isSelf: prev.isSelf || row.isSelf,
    });
  }
  return Array.from(map.values());
}

function compareLevel(a, b) {
  if (a.maxLevel !== b.maxLevel) {
    return b.maxLevel - a.maxLevel;
  }
  if (a.totalScore !== b.totalScore) {
    return b.totalScore - a.totalScore;
  }
  return String(a.openid || a.userId).localeCompare(String(b.openid || b.userId));
}

function compareWeek(a, b) {
  if (a.weekScore !== b.weekScore) {
    return b.weekScore - a.weekScore;
  }
  return compareLevel(a, b);
}

/** 转成客户端要的行，去掉 openid。 */
function toClientRow(row, rank, tab) {
  return {
    rank,
    userId: row.userId,
    maxLevel: row.maxLevel,
    totalScore: row.totalScore,
    weekScore: row.weekScore,
    score: tab === 'week' ? row.weekScore : row.totalScore,
    bestTimeMs: null,
    completed: false,
    isSelf: !!row.isSelf,
    nickName: displayName(row.nickName, row.openid, row.userId),
    avatarUrl: row.avatarUrl || undefined,
    wxId: row.userId,
  };
}

module.exports = {
  asNonNegInt,
  trimStr,
  isoWeekOf,
  previousWeekOf,
  nextSettleAt,
  isPlaceholderName,
  displayName,
  maxClearedFromProgress,
  totalFromProgress,
  rollSelfDoc,
  scoreForWeek,
  rowFromBoardDoc,
  rowFromSaveDoc,
  mergeByOpenid,
  compareLevel,
  compareWeek,
  toClientRow,
};

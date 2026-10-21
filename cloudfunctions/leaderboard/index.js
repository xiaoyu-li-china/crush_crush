const cloud = require('wx-server-sdk');
const {
  asNonNegInt,
  trimStr,
  isoWeekOf,
  previousWeekOf,
  nextSettleAt,
  isPlaceholderName,
  rollSelfDoc,
  scoreForWeek,
  rowFromBoardDoc,
  rowFromSaveDoc,
  mergeByOpenid,
  compareLevel,
  compareWeek,
  toClientRow,
} = require('./rank');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * 每人一条记录，文档 _id 就是 openid（旧版用 add 会重复插入，v:2 之前的旧记录不再参与排名）。
 * 建议索引：v + maxLevel(desc) + totalScore(desc)；v + weekKey + weekScore(desc)。
 */
const LEADERBOARD = 'leaderboard';
const PLAYER_SAVES = 'player_saves';
const LIMIT = 50;

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
  } catch (err) {
    // already exists
  }
}

async function readSelfDoc(col, openid) {
  try {
    const res = await col.doc(openid).get();
    return res && res.data ? res.data : null;
  } catch (err) {
    return null;
  }
}

/**
 * 上周结算：先用条件更新抢占 rewardWeek，抢到的那次调用才返回奖励，避免并发双发。
 */
async function settleLastWeek(db, col, openid, prevDoc, rolled, nowMs) {
  const settleWeek = previousWeekOf(nowMs);
  if (!prevDoc || rolled.rewardWeek === settleWeek) {
    rolled.rewardWeek = settleWeek;
    return null;
  }
  const myScore = scoreForWeek(rolled, settleWeek);
  let reward = null;
  if (myScore > 0) {
    const _ = db.command;
    const claim = await col
      .where({ _id: openid, rewardWeek: _.neq(settleWeek) })
      .update({ data: { rewardWeek: settleWeek } });
    const updated = claim && claim.stats ? claim.stats.updated : 0;
    if (updated > 0) {
      const higher = await col
        .where(_.and([
          { v: 2 },
          _.or([
            { weekKey: settleWeek, weekScore: _.gt(myScore) },
            { prevWeekKey: settleWeek, prevWeekScore: _.gt(myScore) },
          ]),
        ]))
        .count();
      reward = { week: settleWeek, rank: (higher.total || 0) + 1, score: myScore };
    }
  }
  rolled.rewardWeek = settleWeek;
  return reward;
}

async function syncProfileToSave(db, openid, nickName, avatarUrl) {
  if (isPlaceholderName(nickName) && !avatarUrl) {
    return;
  }
  try {
    const saves = await db.collection(PLAYER_SAVES).where({ _openid: openid }).limit(1).get();
    const selfSave = (saves.data || [])[0];
    if (selfSave && selfSave._id) {
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
}

async function loadLevelBoard(db, col, openid, self, limit) {
  let boardRows = [];
  try {
    const res = await col
      .where({ v: 2 })
      .orderBy('maxLevel', 'desc')
      .orderBy('totalScore', 'desc')
      .limit(limit)
      .get();
    boardRows = (res.data || []).map((doc) => rowFromBoardDoc(doc, openid));
  } catch (err) {
    boardRows = [];
  }
  // 早期玩家可能只有存档、没有排行记录
  let saveRows = [];
  try {
    const res = await db
      .collection(PLAYER_SAVES)
      .orderBy('progress.highestLevelId', 'desc')
      .limit(limit)
      .get();
    saveRows = (res.data || []).map((doc) => rowFromSaveDoc(doc, openid));
  } catch (err) {
    saveRows = [];
  }
  const merged = mergeByOpenid(boardRows.concat(saveRows, [self]))
    .filter((row) => row.maxLevel > 0 || row.isSelf)
    .sort(compareLevel);
  const top = merged.slice(0, limit);
  const index = top.findIndex((row) => row.isSelf);
  if (index >= 0) {
    return {
      rows: top.map((row, i) => toClientRow(row, i + 1, 'level')),
      selfRank: index + 1,
      self: null,
    };
  }
  let selfRank = 0;
  try {
    const _ = db.command;
    const higher = await col
      .where(_.and([
        { v: 2 },
        _.or([
          { maxLevel: _.gt(self.maxLevel) },
          { maxLevel: self.maxLevel, totalScore: _.gt(self.totalScore) },
        ]),
      ]))
      .count();
    selfRank = (higher.total || 0) + 1;
  } catch (err) {
    selfRank = 0;
  }
  return {
    rows: top.map((row, i) => toClientRow(row, i + 1, 'level')),
    selfRank,
    self: toClientRow(self, selfRank, 'level'),
  };
}

async function loadWeekBoard(db, col, openid, self, week, limit) {
  const _ = db.command;
  let rows = [];
  try {
    const res = await col
      .where({ v: 2, weekKey: week, weekScore: _.gt(0) })
      .orderBy('weekScore', 'desc')
      .orderBy('maxLevel', 'desc')
      .limit(limit)
      .get();
    rows = (res.data || []).map((doc) => rowFromBoardDoc(doc, openid));
  } catch (err) {
    rows = [];
  }
  if (self.weekScore > 0) {
    rows = mergeByOpenid(rows.concat([self]));
  }
  rows.sort(compareWeek);
  const top = rows.slice(0, limit);
  const index = top.findIndex((row) => row.isSelf);
  if (index >= 0) {
    return {
      rows: top.map((row, i) => toClientRow(row, i + 1, 'week')),
      selfRank: index + 1,
      self: null,
    };
  }
  let selfRank = 0;
  if (self.weekScore > 0) {
    try {
      const higher = await col
        .where({ v: 2, weekKey: week, weekScore: _.gt(self.weekScore) })
        .count();
      selfRank = (higher.total || 0) + 1;
    } catch (err) {
      selfRank = 0;
    }
  }
  return {
    rows: top.map((row, i) => toClientRow(row, i + 1, 'week')),
    selfRank,
    self: toClientRow(self, selfRank, 'week'),
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, reason: 'no_openid' };
  }
  const nowMs = Date.now();
  const payload = {
    openid: OPENID,
    userId: trimStr((event && event.userId) || OPENID, 48) || OPENID,
    wxId: trimStr((event && (event.wxId || event.userId)) || OPENID, 48) || OPENID,
    maxLevel: asNonNegInt(event && event.maxLevel),
    totalScore: asNonNegInt(event && event.totalScore),
    weekKey: trimStr(event && event.weekKey, 16),
    weekScore: asNonNegInt(event && event.weekScore),
    nickName: trimStr(event && event.nickName, 32),
    avatarUrl: trimStr(event && event.avatarUrl, 512),
  };
  const limit = Math.min(100, Math.max(1, asNonNegInt(event && event.limit, LIMIT) || LIMIT));

  const db = cloud.database();
  await ensureCollection(db, LEADERBOARD);
  const col = db.collection(LEADERBOARD);

  const prevDoc = await readSelfDoc(col, OPENID);
  const rolled = rollSelfDoc(prevDoc, payload, nowMs);
  let weeklyReward = null;
  try {
    weeklyReward = await settleLastWeek(db, col, OPENID, prevDoc, rolled, nowMs);
  } catch (err) {
    weeklyReward = null;
  }
  await col.doc(OPENID).set({ data: rolled });
  await syncProfileToSave(db, OPENID, payload.nickName, payload.avatarUrl);

  const week = isoWeekOf(nowMs);
  const self = rowFromBoardDoc({ ...rolled, _id: OPENID }, OPENID);
  const [level, weekly] = await Promise.all([
    loadLevelBoard(db, col, OPENID, self, limit),
    loadWeekBoard(db, col, OPENID, self, week, limit),
  ]);

  return {
    ok: true,
    week,
    settleAt: nextSettleAt(nowMs),
    selfWeekScore: rolled.weekScore,
    weeklyReward,
    level,
    weekly,
    // 旧客户端只认 rows / selfRank
    rows: level.rows,
    selfRank: level.selfRank,
    hint: '',
  };
};

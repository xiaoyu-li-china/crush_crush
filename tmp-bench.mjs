// src/logic/board/TileType.ts
var BASIC_TILE_KINDS = [
  1 /* Red */,
  2 /* Blue */,
  3 /* Green */,
  4 /* Yellow */,
  5 /* Purple */
];
function isBasicTile(kind) {
  return kind >= 1 /* Red */ && kind <= 5 /* Purple */;
}
function isSpecialTile(kind) {
  return kind === 6 /* Bomb */ || kind === 7 /* ColorBomb */;
}
function isMatchable(kind) {
  return isBasicTile(kind);
}
function isHole(kind) {
  return kind === 8 /* Hole */;
}

// tests/helpers/memory-deps.ts
function createMemoryDeps(ads) {
  const store = /* @__PURE__ */ new Map();
  const storage = {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async remove(key) {
      store.delete(key);
    },
    async clear() {
      store.clear();
    }
  };
  return {
    storage,
    ads: {
      async load() {
      },
      async show() {
        return "not_ready";
      },
      isReady: () => false,
      dispose() {
      },
      ...ads
    },
    audio: {
      play() {
      },
      stop() {
      },
      stopAll() {
      },
      setMuted() {
      },
      isMuted: () => false,
      dispose() {
      }
    },
    analytics: { track() {
    } },
    platform: {
      getSystemInfo: () => ({
        brand: "test",
        model: "test",
        platform: "devtools",
        system: "test",
        SDKVersion: "2.19.0",
        windowWidth: 375,
        windowHeight: 667,
        pixelRatio: 2
      }),
      onShow() {
      },
      onHide() {
      },
      offShow() {
      },
      offHide() {
      },
      getLaunchQuery: () => ({})
    }
  };
}

// src/logic/economy/BoosterEconomy.ts
var BOOSTER_WALLET_CAP = 9;
var LEFTOVER_MOVES_FOR_EXTRA = 6;
var EMPTY_BOOSTER_WALLET = {
  hammer: 0,
  shuffle: 0,
  extraMoves: 0
};
function clampBoosterWallet(stock) {
  const cap = (n) => Math.max(0, Math.min(BOOSTER_WALLET_CAP, Math.floor(n)));
  return {
    hammer: cap(stock.hammer),
    shuffle: cap(stock.shuffle),
    extraMoves: cap(stock.extraMoves)
  };
}
function addBoosterToWallet(stock, id, amount) {
  const next = { ...stock };
  next[id] = next[id] + Math.floor(amount);
  return clampBoosterWallet(next);
}
var EMPTY_BOOSTER_DAILY = {
  adHammer: 0,
  adShuffle: 0,
  adExtra: 0,
  playShuffleGranted: false,
  playExtraGranted: false
};
function parseBoosterDaily(raw) {
  return {
    adHammer: Math.max(0, Math.floor(raw?.adHammer ?? 0)),
    adShuffle: Math.max(0, Math.floor(raw?.adShuffle ?? 0)),
    adExtra: Math.max(0, Math.floor(raw?.adExtra ?? 0)),
    playShuffleGranted: !!raw?.playShuffleGranted,
    playExtraGranted: !!raw?.playExtraGranted
  };
}
function bumpBoosterAd(flags, id) {
  const next = { ...flags };
  if (id === "hammer") {
    next.adHammer += 1;
  } else if (id === "shuffle") {
    next.adShuffle += 1;
  } else {
    next.adExtra += 1;
  }
  return next;
}

// src/logic/economy/DailyLoop.ts
var DAILY_GOAL_CLEARS = 3;
var DAILY_HAMMER_GRANT = 1;
var EMPTY_DAILY_LOOP = {
  ymd: "",
  bonusHammer: 0,
  clearsToday: 0,
  ...EMPTY_BOOSTER_DAILY
};
function localYmd(nowMs) {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function applyDailyLogin(prev, nowMs) {
  const today = localYmd(nowMs);
  const flags = parseBoosterDaily(prev);
  if (!prev || prev.ymd !== today) {
    return {
      data: {
        ymd: today,
        bonusHammer: DAILY_HAMMER_GRANT,
        clearsToday: 0,
        ...EMPTY_BOOSTER_DAILY
      },
      grantedHammer: true
    };
  }
  return {
    data: {
      ymd: prev.ymd,
      bonusHammer: prev.bonusHammer,
      clearsToday: prev.clearsToday,
      ...flags
    },
    grantedHammer: false
  };
}
function recordDailyClear(data, nowMs) {
  const aligned = applyDailyLogin(data, nowMs).data;
  return {
    ...aligned,
    clearsToday: aligned.clearsToday + 1
  };
}

// src/logic/economy/InviteLoop.ts
var INVITE_CODE_LENGTH = 8;
var INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var EMPTY_INVITE_STATE = {
  code: "",
  pendingInviter: "",
  claimedAsInvitee: false,
  inviteeGiftGranted: false,
  cloudClaimed: false,
  appliedCreditHammer: 0
};
var EMPTY_INVITE_CLOUD = {
  code: "",
  creditHammer: 0,
  claimedAsInvitee: false,
  pendingInviter: "",
  inviteeGiftGranted: false,
  cloudClaimed: false
};
function generateInviteCode(random = Math.random) {
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    const index = Math.floor(random() * INVITE_ALPHABET.length) % INVITE_ALPHABET.length;
    out += INVITE_ALPHABET[index];
  }
  return out;
}
function normalizeInviteCode(raw) {
  const text = String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (text.length < 6 || text.length > 12) {
    return "";
  }
  return text.slice(0, INVITE_CODE_LENGTH);
}
function parseInviterFromQuery(query) {
  if (!query) {
    return "";
  }
  if (typeof query === "string") {
    const raw = query.startsWith("?") ? query.slice(1) : query;
    const params = new URLSearchParams(raw);
    return normalizeInviteCode(params.get("inviter") || params.get("INVITER"));
  }
  return normalizeInviteCode(query.inviter || query.INVITER);
}
function isFreshPlayer(progress) {
  if (!progress) {
    return true;
  }
  const scores = progress.levelScores ?? {};
  if (Object.keys(scores).length > 0) {
    return false;
  }
  if ((progress.totalScore ?? 0) > 0) {
    return false;
  }
  return (progress.highestLevelId ?? 1) <= 1;
}
function parseInviteState(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_INVITE_STATE };
  }
  const data = raw;
  return {
    code: normalizeInviteCode(data.code),
    pendingInviter: normalizeInviteCode(data.pendingInviter),
    claimedAsInvitee: !!data.claimedAsInvitee,
    inviteeGiftGranted: !!data.inviteeGiftGranted,
    cloudClaimed: !!data.cloudClaimed,
    appliedCreditHammer: Math.max(0, Math.floor(Number(data.appliedCreditHammer) || 0))
  };
}
function ensureInviteCode(state, generate = generateInviteCode) {
  const code = normalizeInviteCode(state.code);
  if (code) {
    return { ...state, code };
  }
  return { ...state, code: normalizeInviteCode(generate()) || generateInviteCode() };
}
function toInviteCloudSlice(state) {
  return {
    code: normalizeInviteCode(state.code),
    creditHammer: Math.max(0, Math.floor(state.appliedCreditHammer)),
    claimedAsInvitee: !!state.claimedAsInvitee,
    pendingInviter: normalizeInviteCode(state.pendingInviter),
    inviteeGiftGranted: !!state.inviteeGiftGranted,
    cloudClaimed: !!state.cloudClaimed
  };
}
function parseInviteCloudSlice(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_INVITE_CLOUD };
  }
  const data = raw;
  return {
    code: normalizeInviteCode(data.code),
    creditHammer: Math.max(0, Math.floor(Number(data.creditHammer) || 0)),
    claimedAsInvitee: !!data.claimedAsInvitee,
    pendingInviter: normalizeInviteCode(data.pendingInviter),
    inviteeGiftGranted: !!data.inviteeGiftGranted,
    cloudClaimed: !!data.cloudClaimed
  };
}
function mergeInviteCloud(local, remote) {
  const a = local ?? EMPTY_INVITE_CLOUD;
  const b = remote ?? EMPTY_INVITE_CLOUD;
  return {
    code: b.code || a.code,
    creditHammer: Math.max(a.creditHammer, b.creditHammer),
    claimedAsInvitee: a.claimedAsInvitee || b.claimedAsInvitee,
    pendingInviter: a.pendingInviter || b.pendingInviter || "",
    inviteeGiftGranted: !!a.inviteeGiftGranted || !!b.inviteeGiftGranted,
    cloudClaimed: !!a.cloudClaimed || !!b.cloudClaimed
  };
}
function hydrateInviteFromCloud(local, cloud) {
  const slice = mergeInviteCloud(toInviteCloudSlice(local), cloud);
  const next = {
    ...local,
    code: slice.code || local.code,
    pendingInviter: local.pendingInviter || slice.pendingInviter,
    claimedAsInvitee: local.claimedAsInvitee || slice.claimedAsInvitee,
    inviteeGiftGranted: local.inviteeGiftGranted || slice.inviteeGiftGranted,
    cloudClaimed: local.cloudClaimed || slice.cloudClaimed
  };
  if (slice.claimedAsInvitee) {
    next.inviteeGiftGranted = true;
    next.cloudClaimed = true;
  }
  return next;
}
function bindPendingInviter(state, inviterCode, fresh) {
  const code = normalizeInviteCode(inviterCode);
  if (!code || !fresh || state.claimedAsInvitee || state.inviteeGiftGranted) {
    return state;
  }
  if (code === state.code) {
    return state;
  }
  if (state.pendingInviter) {
    return state;
  }
  return { ...state, pendingInviter: code };
}
function grantInviteeGift(state) {
  if (!state.pendingInviter || state.inviteeGiftGranted || state.claimedAsInvitee) {
    return { state, granted: 0 };
  }
  return {
    state: {
      ...state,
      inviteeGiftGranted: true,
      claimedAsInvitee: true
    },
    granted: 1
  };
}
function applyInviteCredit(state, remoteCredit) {
  const credit = Math.max(0, Math.floor(remoteCredit));
  if (credit <= state.appliedCreditHammer) {
    return { state, granted: 0 };
  }
  return {
    state: { ...state, appliedCreditHammer: credit },
    granted: credit - state.appliedCreditHammer
  };
}
function addInviteHammers(stock, amount) {
  if (amount <= 0) {
    return stock;
  }
  return addBoosterToWallet(stock, "hammer", amount);
}

// src/logic/level/LevelProgress.ts
var PROGRESS_SCHEMA_VERSION = 1;
var DEFAULT_LEVEL_PROGRESS = {
  schemaVersion: PROGRESS_SCHEMA_VERSION,
  highestLevelId: 1,
  totalScore: 0,
  lastPlayedLevelId: 1,
  levelScores: {}
};
function asPositiveInt(value, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return n;
}
function asNonNegInt(value, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}
function normalizeLevelProgressData(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_LEVEL_PROGRESS,
      levelScores: {}
    };
  }
  const data = raw;
  const scores = {};
  const rawScores = data.levelScores;
  if (rawScores && typeof rawScores === "object") {
    for (const [key, value] of Object.entries(rawScores)) {
      const id = Number(key);
      const score = Number(value);
      if (!Number.isFinite(id) || id < 1 || !Number.isFinite(score) || score < 0) {
        continue;
      }
      scores[String(Math.floor(id))] = score;
    }
  }
  const scoreIds = Object.keys(scores).map((k) => Number(k));
  const maxScored = scoreIds.length > 0 ? Math.max(...scoreIds) : 0;
  let highest = asPositiveInt(data.highestLevelId, 1);
  if (maxScored >= highest) {
    highest = maxScored + 1;
  }
  const lastPlayed = asPositiveInt(data.lastPlayedLevelId, Math.max(1, highest - 1));
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    highestLevelId: highest,
    totalScore: asNonNegInt(data.totalScore, 0),
    lastPlayedLevelId: lastPlayed,
    levelScores: scores
  };
}
var LevelProgress = class {
  constructor(data = { ...DEFAULT_LEVEL_PROGRESS }) {
    this.data = normalizeLevelProgressData(data);
  }
  load(data) {
    this.data = normalizeLevelProgressData(data);
  }
  getData() {
    return {
      ...this.data,
      levelScores: { ...this.data.levelScores ?? {} }
    };
  }
  getHighestLevelId() {
    return this.data.highestLevelId;
  }
  getBestScore(levelId) {
    return this.data.levelScores?.[String(levelId)] ?? 0;
  }
  /** 是否已通关该关（持久化记录） */
  isLevelCleared(levelId) {
    if (levelId < this.data.highestLevelId) {
      return true;
    }
    const scores = this.data.levelScores;
    return !!scores && Object.prototype.hasOwnProperty.call(scores, String(levelId));
  }
  /**
   * 通关记账：刷新该关最高分，并推进可挑战关卡。
   */
  markLevelCleared(levelId, score) {
    this.data.lastPlayedLevelId = levelId;
    const scores = this.data.levelScores ?? (this.data.levelScores = {});
    const key = String(levelId);
    const prev = scores[key] ?? 0;
    if (score > prev) {
      scores[key] = score;
      this.data.totalScore += score - prev;
    } else if (!(key in scores)) {
      scores[key] = Math.max(0, score);
    }
    if (levelId >= this.data.highestLevelId) {
      this.data.highestLevelId = levelId + 1;
    }
  }
};

// src/logic/save/mergePlayerCloudSave.ts
function mergeLevelProgress(local, remote) {
  const a = normalizeLevelProgressData(local);
  const b = normalizeLevelProgressData(remote);
  const scores = { ...a.levelScores ?? {} };
  for (const [key, value] of Object.entries(b.levelScores ?? {})) {
    const prev = scores[key] ?? 0;
    if (value > prev) {
      scores[key] = value;
    }
  }
  return normalizeLevelProgressData({
    highestLevelId: Math.max(a.highestLevelId, b.highestLevelId),
    totalScore: Math.max(a.totalScore, b.totalScore),
    lastPlayedLevelId: a.highestLevelId >= b.highestLevelId ? a.lastPlayedLevelId : b.lastPlayedLevelId,
    levelScores: scores
  });
}
function mergeBoosters(local, remote) {
  return clampBoosterWallet({
    hammer: Math.max(local.hammer, remote.hammer),
    shuffle: Math.max(local.shuffle, remote.shuffle),
    extraMoves: Math.max(local.extraMoves, remote.extraMoves)
  });
}
function mergeDaily(local, remote) {
  const a = local.ymd ? local : EMPTY_DAILY_LOOP;
  const b = remote.ymd ? remote : EMPTY_DAILY_LOOP;
  if (!a.ymd) {
    return { ...b };
  }
  if (!b.ymd) {
    return { ...a };
  }
  if (a.ymd !== b.ymd) {
    return a.ymd >= b.ymd ? { ...a } : { ...b };
  }
  const flagsA = parseBoosterDaily(a);
  const flagsB = parseBoosterDaily(b);
  return {
    ymd: a.ymd,
    bonusHammer: Math.max(a.bonusHammer, b.bonusHammer),
    clearsToday: Math.max(a.clearsToday, b.clearsToday),
    adHammer: Math.max(flagsA.adHammer, flagsB.adHammer),
    adShuffle: Math.max(flagsA.adShuffle, flagsB.adShuffle),
    adExtra: Math.max(flagsA.adExtra, flagsB.adExtra),
    playShuffleGranted: flagsA.playShuffleGranted || flagsB.playShuffleGranted,
    playExtraGranted: flagsA.playExtraGranted || flagsB.playExtraGranted
  };
}
function mergePlayerCloudSnapshots(local, remote) {
  if (!remote) {
    return {
      ...local,
      progress: normalizeLevelProgressData(local.progress),
      boosters: clampBoosterWallet(local.boosters),
      invite: parseInviteCloudSlice(local.invite),
      updatedAt: Math.max(1, local.updatedAt || Date.now())
    };
  }
  return {
    updatedAt: Math.max(local.updatedAt, remote.updatedAt, Date.now()),
    progress: mergeLevelProgress(local.progress, remote.progress),
    boosters: mergeBoosters(local.boosters, remote.boosters),
    settings: local.updatedAt >= remote.updatedAt ? local.settings : remote.settings,
    daily: mergeDaily(local.daily, remote.daily),
    invite: mergeInviteCloud(
      parseInviteCloudSlice(local.invite),
      parseInviteCloudSlice(remote.invite)
    )
  };
}

// src/core/utils/math.ts
function createSeededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 1831565813;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

// src/logic/board/BoardModel.ts
var BURIED_SNOWMAN = 1;
var BURIED_PENGUIN = 2;
var BURIED_SHAPES = [
  [
    [0, 0],
    [0, 1]
  ],
  [
    [0, 0],
    [1, 0]
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2]
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0]
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0]
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1]
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1]
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1]
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1]
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1]
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3]
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0]
  ]
];
var EMPTY_TILE_ID = 0;
var CLOUD_HIT_LAYERS = 2;
var BoardModel = class _BoardModel {
  /**
   * 创建空棋盘（全部为 Empty）。
   * @param size - 行列尺寸，必须为正整数
   * @param nextTileId - 起始 tileId，默认 1
   */
  constructor(size, nextTileId = 1) {
    /** 为 true 时，有冰的格子上的动物不能交换（第 7/8 关冰封）。 */
    this.iceLocksTiles = false;
    this.lastSnowmanQuakeCenters = [];
    this.harvestedSnowmen = 0;
    this.harvestedPenguins = 0;
    if (size.rows <= 0 || size.cols <= 0) {
      throw new Error(`Invalid board size: ${size.rows}x${size.cols}`);
    }
    const length = size.rows * size.cols;
    this.size = { rows: size.rows, cols: size.cols };
    this.cells = new Int8Array(length);
    this.tileIds = new Int32Array(length);
    this.sparkles = new Uint8Array(length);
    this.ice = new Uint8Array(length);
    this.cloud = new Uint8Array(length);
    this.gem = new Uint8Array(length);
    this.buried = new Uint8Array(length);
    this.buriedId = new Uint8Array(length);
    this.snowmanQuaked = new Uint8Array(length);
    this.egg = new Uint8Array(length);
    this.vine = new Uint8Array(length);
    this.version = 0;
    this.nextTileId = nextTileId;
  }
  /**
   * 格子总数（rows × cols）。
   */
  get length() {
    return this.cells.length;
  }
  /**
   * 将 (row, col) 转为行优先一维下标。
   * @param row - 行（从 0 起）
   * @param col - 列（从 0 起）
   * @returns 一维下标
   */
  index(row, col) {
    return row * this.size.cols + col;
  }
  /**
   * 判断坐标是否在棋盘范围内。
   * @param row - 行
   * @param col - 列
   * @returns 是否合法
   */
  inBounds(row, col) {
    return row >= 0 && row < this.size.rows && col >= 0 && col < this.size.cols;
  }
  /**
   * 读取指定格子的方块种类。
   * @param row - 行
   * @param col - 列
   * @returns 方块种类
   */
  getTile(row, col) {
    this.assertInBounds(row, col);
    return this.cells[this.index(row, col)];
  }
  /**
   * 读取指定格子的 tileId。
   * @param row - 行
   * @param col - 列
   * @returns tileId；空格为 0
   */
  getTileId(row, col) {
    this.assertInBounds(row, col);
    return this.tileIds[this.index(row, col)];
  }
  /**
   * 写入指定格子的方块种类。
   * - 写入 `Empty` 时清除 tileId 与闪光标记
   * - 写入非空且未指定 `tileId` 时，若原为空则分配新 id，否则保留原 id
   * - 默认清除闪光；需要闪光请再用 `setSparkle`
   */
  setTile(row, col, kind, tileId) {
    this.assertInBounds(row, col);
    const i = this.index(row, col);
    this.cells[i] = kind;
    this.sparkles[i] = 0;
    if (kind === 0 /* Empty */ || kind === 8 /* Hole */) {
      this.tileIds[i] = EMPTY_TILE_ID;
    } else if (tileId !== void 0) {
      this.tileIds[i] = tileId;
    } else if (this.tileIds[i] === EMPTY_TILE_ID) {
      this.tileIds[i] = this.allocTileId();
    }
    this.bumpVersion();
  }
  /**
   * 是否为四连合成的闪光块。
   */
  isSparkle(row, col) {
    this.assertInBounds(row, col);
    return this.sparkles[this.index(row, col)] === 1;
  }
  /**
   * 设置/清除闪光标记（不改变 kind）。
   */
  setSparkle(row, col, sparkle) {
    this.assertInBounds(row, col);
    const i = this.index(row, col);
    if (this.cells[i] === 0 /* Empty */ || this.cells[i] === 8 /* Hole */) {
      this.sparkles[i] = 0;
      return;
    }
    this.sparkles[i] = sparkle ? 1 : 0;
    this.bumpVersion();
  }
  /**
   * 将指定格子清空为 Empty。
   */
  clearTile(row, col) {
    const index = this.index(row, col);
    const kind = this.cells[index];
    if (this.peelCoverAtIndex(index)) {
      return;
    }
    this.hitCloudOrGemAtIndex(index);
    if (kind !== 0 /* Empty */ && kind !== 8 /* Hole */) {
      this.breakIceAtIndex(index);
    }
    this.applySnowmanQuakes();
    this.setTile(row, col, 0 /* Empty */, EMPTY_TILE_ID);
  }
  getIce(row, col) {
    this.assertInBounds(row, col);
    return this.ice[this.index(row, col)];
  }
  setIce(row, col, layers) {
    this.assertInBounds(row, col);
    this.ice[this.index(row, col)] = Math.max(0, Math.min(3, Math.floor(layers)));
    this.bumpVersion();
  }
  /** @returns 是否打碎了一层冰 */
  breakIceAtIndex(index) {
    if (index < 0 || index >= this.ice.length) {
      return false;
    }
    if (this.ice[index] <= 0) {
      return false;
    }
    this.ice[index] -= 1;
    this.bumpVersion();
    return true;
  }
  countIce() {
    let n = 0;
    for (let i = 0; i < this.ice.length; i += 1) {
      n += this.ice[i];
    }
    return n;
  }
  /** 给每个非洞格铺一层冰，返回冰块格数。 */
  coverPlayableWithIce() {
    let n = 0;
    for (let i = 0; i < this.length; i += 1) {
      if (this.cells[i] === 8 /* Hole */) {
        continue;
      }
      this.ice[i] = 1;
      n += 1;
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  /** 全盘铺冰，但最上 skip 行不铺（跳过洞格）。row 越大越靠屏幕上方。 */
  coverPlayableSkippingTopRows(skipTopRows) {
    const skip = Math.max(0, Math.min(this.size.rows, Math.floor(skipTopRows)));
    const lastIcedRow = this.size.rows - 1 - skip;
    let n = 0;
    for (let r = 0; r <= lastIcedRow; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] === 8 /* Hole */) {
          continue;
        }
        this.ice[i] = 1;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  /** 从棋盘底部向上铺若干行冰（跳过洞格），返回冰块格数。 */
  coverBottomRowsWithIce(bottomRows) {
    const rows = Math.max(0, Math.min(this.size.rows, Math.floor(bottomRows)));
    let n = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] === 8 /* Hole */) {
          continue;
        }
        this.ice[i] = 1;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  getCloud(row, col) {
    this.assertInBounds(row, col);
    return this.cloud[this.index(row, col)];
  }
  getEgg(row, col) {
    this.assertInBounds(row, col);
    return this.egg[this.index(row, col)];
  }
  getVine(row, col) {
    this.assertInBounds(row, col);
    return this.vine[this.index(row, col)];
  }
  /** 棉花 / 蛋壳 / 藤蔓盖住的格子：不能三消、不能交换、不下落。 */
  isCoveredIndex(index) {
    if (index < 0 || index >= this.length) {
      return false;
    }
    return this.cloud[index] > 0 || this.egg[index] > 0 || this.vine[index] > 0;
  }
  /** 锤子 / 爆破打在覆盖层上时削一层，返回被削的种类。 */
  peelCoverAtIndex(index) {
    if (index < 0 || index >= this.length) {
      return null;
    }
    if (this.cloud[index] > 0) {
      this.cloud[index]--;
      this.bumpVersion();
      return "cloud";
    }
    if (this.egg[index] > 0) {
      this.egg[index]--;
      this.bumpVersion();
      return "egg";
    }
    if (this.vine[index] > 0) {
      this.vine[index]--;
      this.bumpVersion();
      return "vine";
    }
    return null;
  }
  getGem(row, col) {
    this.assertInBounds(row, col);
    return this.gem[this.index(row, col)];
  }
  getBuried(row, col) {
    this.assertInBounds(row, col);
    return this.buried[this.index(row, col)];
  }
  isBuriedRevealed(row, col) {
    this.assertInBounds(row, col);
    const i = this.index(row, col);
    if (this.buried[i] <= 0) {
      return false;
    }
    return this.isBuriedGroupFullyClear(this.buriedGroupIdAt(i));
  }
  /**
   * 在可玩格上铺雪人/企鹅，藏在冰下；占地格子上的冰全碎后自动收获。
   */
  placeBuried(snowmen, penguins, seed, options) {
    const wantS = Math.max(0, Math.floor(snowmen));
    const wantP = Math.max(0, Math.floor(penguins));
    const skip = Math.max(0, Math.floor(options?.skipTopRows ?? 0));
    const requireIce = options?.requireIce === true;
    const maxRow = this.size.rows - 1 - skip;
    const playable = [];
    for (let r = 0; r <= maxRow; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] === 8 /* Hole */) {
          continue;
        }
        if (requireIce && this.ice[i] <= 0) {
          continue;
        }
        playable.push(i);
      }
    }
    let rng = seed >>> 0 || 1;
    const next = () => {
      rng = Math.imul(rng, 1664525) + 1013904223 >>> 0;
      return rng;
    };
    const occupied = /* @__PURE__ */ new Set();
    let nextId = 1;
    const placeKind = (kind, count) => {
      let placed = 0;
      for (let n = 0; n < count; n += 1) {
        const cells = this.pickBuriedShape(
          playable,
          occupied,
          kind === BURIED_SNOWMAN ? 4 : 2,
          next,
          kind === BURIED_PENGUIN
        );
        if (!cells) {
          continue;
        }
        const id = nextId;
        nextId += 1;
        for (const i of cells) {
          this.buried[i] = kind;
          this.buriedId[i] = id;
          occupied.add(i);
        }
        placed += 1;
      }
      return placed;
    };
    const snowCount = placeKind(BURIED_SNOWMAN, wantS);
    const penguinCount = placeKind(BURIED_PENGUIN, wantP);
    if (snowCount + penguinCount > 0) {
      this.bumpVersion();
    }
    if (requireIce) {
      return this.removeBuriedNotUnderIce();
    }
    return { snowmen: snowCount, penguins: penguinCount };
  }
  /** 去掉没被冰完全盖住的雪人/企鹅，只留冰层下的。 */
  removeBuriedNotUnderIce() {
    let removed = false;
    for (const group of this.listBuriedGroups()) {
      const covered = group.cells.every((i) => this.ice[i] > 0);
      if (covered) {
        continue;
      }
      for (const i of group.cells) {
        this.buried[i] = 0;
        this.buriedId[i] = 0;
      }
      removed = true;
    }
    if (removed) {
      this.bumpVersion();
    }
    return {
      snowmen: this.countBuried(BURIED_SNOWMAN),
      penguins: this.countBuried(BURIED_PENGUIN)
    };
  }
  listBuriedGroups() {
    const map = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.buried.length; i += 1) {
      const kind = this.buried[i];
      if (kind <= 0) {
        continue;
      }
      const id = this.buriedGroupIdAt(i);
      let group = map.get(id);
      if (!group) {
        group = { id, kind, cells: [], revealed: true };
        map.set(id, group);
      }
      group.cells.push(i);
      if (this.ice[i] > 0) {
        group.revealed = false;
      }
    }
    return [...map.values()];
  }
  countBuried(kind) {
    let n = 0;
    for (const group of this.listBuriedGroups()) {
      if (group.kind === kind) {
        n += 1;
      }
    }
    return n;
  }
  countRevealedBuried(kind) {
    const harvested = kind === BURIED_SNOWMAN ? this.harvestedSnowmen : this.harvestedPenguins;
    let n = 0;
    for (const group of this.listBuriedGroups()) {
      if (group.kind === kind && group.revealed) {
        n += 1;
      }
    }
    return harvested + n;
  }
  hasRevealedUnharvestedBuried() {
    return this.listBuriedGroups().some((group) => group.revealed);
  }
  /** 收走指定已完全露出来的一只，返回被收格子。 */
  harvestBuriedGroup(groupId) {
    return this.harvestBuriedWhere((group) => group.revealed && group.id === groupId);
  }
  /** 冰碎露出的雪人/企鹅收走，返回被收格子。 */
  harvestRevealedBuried() {
    return this.harvestBuriedWhere((group) => group.revealed);
  }
  harvestBuriedWhere(match) {
    const taken = [];
    for (const group of this.listBuriedGroups()) {
      if (!match(group)) {
        continue;
      }
      if (group.kind === BURIED_SNOWMAN) {
        this.harvestedSnowmen += 1;
      } else if (group.kind === BURIED_PENGUIN) {
        this.harvestedPenguins += 1;
      }
      for (const i of group.cells) {
        this.buried[i] = 0;
        this.buriedId[i] = 0;
        taken.push(i);
      }
    }
    if (taken.length > 0) {
      this.bumpVersion();
    }
    return taken;
  }
  /**
   * 整只雪人的格子冰都碎了且尚未震动：震碎占地外围上下左右的冰。
   */
  applySnowmanQuakes() {
    const cols = this.size.cols;
    const rows = this.size.rows;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    let ice = 0;
    const centers = [];
    let guard = 0;
    while (guard < 12) {
      guard += 1;
      let progressed = false;
      for (const group of this.listBuriedGroups()) {
        if (group.kind !== BURIED_SNOWMAN || !group.revealed) {
          continue;
        }
        if (group.cells.some((cell) => this.snowmanQuaked[cell] > 0)) {
          continue;
        }
        const footprint = new Set(group.cells);
        for (const i of group.cells) {
          this.snowmanQuaked[i] = 1;
        }
        centers.push(group.cells[0]);
        progressed = true;
        for (const i of group.cells) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) {
              continue;
            }
            const ni = this.index(nr, nc);
            if (footprint.has(ni) || this.cells[ni] === 8 /* Hole */) {
              continue;
            }
            if (this.breakIceAtIndex(ni)) {
              ice += 1;
            }
          }
        }
      }
      if (!progressed) {
        break;
      }
    }
    if (centers.length > 0) {
      this.lastSnowmanQuakeCenters = this.lastSnowmanQuakeCenters.concat(centers);
    }
    return { ice, centers };
  }
  buriedGroupIdAt(index) {
    const tagged = this.buriedId[index];
    return tagged > 0 ? tagged : index + 1;
  }
  isBuriedGroupFullyClear(groupId) {
    for (let i = 0; i < this.buried.length; i += 1) {
      if (this.buried[i] <= 0 || this.buriedGroupIdAt(i) !== groupId) {
        continue;
      }
      if (this.ice[i] > 0) {
        return false;
      }
    }
    return true;
  }
  pickBuriedShape(playable, occupied, size, next, preferVertical = false) {
    const cols = this.size.cols;
    const rows = this.size.rows;
    const allowed = new Set(playable);
    const verticalTwo = [
      [
        [0, 0],
        [1, 0]
      ]
    ];
    const shapes = size === 4 ? [
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1]
      ]
    ] : size === 2 ? BURIED_SHAPES.filter((shape) => shape.length === 2) : BURIED_SHAPES.filter((shape) => shape.length === size);
    if (shapes.length === 0 || playable.length === 0) {
      return null;
    }
    const tooClose = (cells) => {
      for (const a of cells) {
        const r = Math.floor(a / cols);
        const c = a % cols;
        for (const b of occupied) {
          const or = Math.floor(b / cols);
          const oc = b % cols;
          if (Math.abs(or - r) + Math.abs(oc - c) < 2) {
            return true;
          }
        }
      }
      return false;
    };
    const maxAttempts = playable.length * Math.max(4, shapes.length * 3);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const origin = playable[next() % playable.length];
      const shape = preferVertical && size === 2 && attempt < maxAttempts * 0.75 ? verticalTwo[0] : shapes[next() % shapes.length];
      const or = Math.floor(origin / cols);
      const oc = origin % cols;
      const cells = [];
      let ok = true;
      for (const [dr, dc] of shape) {
        const r = or + dr;
        const c = oc + dc;
        if (r < 0 || c < 0 || r >= rows || c >= cols) {
          ok = false;
          break;
        }
        const i = this.index(r, c);
        if (!allowed.has(i) || occupied.has(i) || cells.includes(i)) {
          ok = false;
          break;
        }
        cells.push(i);
      }
      if (!ok || cells.length !== size) {
        continue;
      }
      if (occupied.size > 0 && tooClose(cells) && attempt < maxAttempts * 0.7) {
        continue;
      }
      return cells;
    }
    return null;
  }
  /** 先打掉一层棉花；没有棉花则收集粉球。 */
  hitCloudOrGemAtIndex(index) {
    if (index < 0 || index >= this.cloud.length) {
      return { cloud: false, gem: false };
    }
    if (this.cloud[index] > 0) {
      this.cloud[index] -= 1;
      this.bumpVersion();
      return { cloud: true, gem: false };
    }
    if (this.gem[index] > 0) {
      this.gem[index] -= 1;
      this.bumpVersion();
      return { cloud: false, gem: true };
    }
    return { cloud: false, gem: false };
  }
  /**
   * 本波已清空的格子，四向各削一层相邻棉花；同一格棉花每波最多削一次。
   * @returns 被削到的棉花下标
   */
  chipCloudsAdjacentToClears(clearedIndices, count) {
    return this.chipLayerAdjacentToClears(this.cloud, clearedIndices, count);
  }
  chipEggsAdjacentToClears(clearedIndices, count) {
    return this.chipLayerAdjacentToClears(this.egg, clearedIndices, count);
  }
  chipVinesAdjacentToClears(clearedIndices, count) {
    return this.chipLayerAdjacentToClears(this.vine, clearedIndices, count);
  }
  chipLayerAdjacentToClears(layer, clearedIndices, count) {
    const { rows, cols } = this.size;
    const seen = new Uint8Array(this.length);
    const hit = [];
    for (let i = 0; i < count; i += 1) {
      const index = clearedIndices[i];
      if (index < 0 || index >= this.length) {
        continue;
      }
      if (this.cells[index] !== 0 /* Empty */) {
        continue;
      }
      const r = Math.floor(index / cols);
      const c = index % cols;
      const neighbors = [
        r > 0 ? index - cols : -1,
        r < rows - 1 ? index + cols : -1,
        c > 0 ? index - 1 : -1,
        c < cols - 1 ? index + 1 : -1
      ];
      for (const ni of neighbors) {
        if (ni < 0 || seen[ni] > 0) {
          continue;
        }
        if (layer[ni] <= 0) {
          continue;
        }
        seen[ni] = 1;
        layer[ni]--;
        hit.push(ni);
      }
    }
    if (hit.length > 0) {
      this.bumpVersion();
    }
    return hit;
  }
  countEggs() {
    let n = 0;
    for (let i = 0; i < this.egg.length; i += 1) {
      if (this.egg[i] > 0) {
        n += 1;
      }
    }
    return n;
  }
  countVines() {
    let n = 0;
    for (let i = 0; i < this.vine.length; i += 1) {
      if (this.vine[i] > 0) {
        n += 1;
      }
    }
    return n;
  }
  /** 在可玩格上放蛋壳，返回蛋数。 */
  placeEggs(count, layers, seed) {
    const want = Math.max(0, Math.floor(count));
    const hp = Math.max(1, Math.min(3, Math.floor(layers)));
    const playable = [];
    for (let i = 0; i < this.length; i += 1) {
      const kind = this.cells[i];
      if (kind === 8 /* Hole */ || kind === 0 /* Empty */) {
        continue;
      }
      playable.push(i);
    }
    let rng = seed >>> 0 || 1;
    const next = () => {
      rng = Math.imul(rng, 1664525) + 1013904223 >>> 0;
      return rng;
    };
    let placed = 0;
    const used = /* @__PURE__ */ new Set();
    for (let n = 0; n < want && playable.length > 0; n += 1) {
      let pick = playable[next() % playable.length];
      let guard = 0;
      while (used.has(pick) && guard < playable.length) {
        pick = playable[next() % playable.length];
        guard += 1;
      }
      if (used.has(pick)) {
        continue;
      }
      used.add(pick);
      this.egg[pick] = hp;
      placed += 1;
    }
    if (placed > 0) {
      this.bumpVersion();
    }
    return placed;
  }
  /** 按图案铺绿藤，返回藤蔓格数。 */
  placeVines(options, seed) {
    const hp = Math.max(1, Math.min(3, Math.floor(options.layers)));
    const { rows, cols } = this.size;
    const marks = new Uint8Array(this.length);
    const mark = (i) => {
      if (i < 0 || i >= this.length) {
        return;
      }
      if (this.cells[i] === 8 /* Hole */) {
        return;
      }
      marks[i] = 1;
    };
    let rng = seed >>> 0 || 1;
    const next = () => {
      rng = Math.imul(rng, 1664525) + 1013904223 >>> 0;
      return rng;
    };
    if (options.pattern === "scatter") {
      const want = Math.max(0, Math.floor(options.count ?? 12));
      const playable = [];
      for (let i = 0; i < this.length; i += 1) {
        if (this.cells[i] !== 8 /* Hole */) {
          playable.push(i);
        }
      }
      for (let n2 = 0; n2 < want && playable.length > 0; n2 += 1) {
        const idx = next() % playable.length;
        mark(playable[idx]);
        playable.splice(idx, 1);
      }
    } else if (options.pattern === "columns") {
      const c0 = 2;
      const c1 = cols - 3;
      for (let r = 0; r < rows; r += 1) {
        mark(this.index(r, c0));
        mark(this.index(r, c1));
      }
    } else if (options.pattern === "rows") {
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          mark(this.index(r, c));
        }
      }
    } else if (options.pattern === "clusters") {
      const starts = [
        [1, 1],
        [1, cols - 3],
        [rows - 3, 1],
        [rows - 3, cols - 3]
      ];
      for (const [sr, sc] of starts) {
        for (let dr = 0; dr < 2; dr += 1) {
          for (let dc = 0; dc < 2; dc += 1) {
            mark(this.index(sr + dr, sc + dc));
          }
        }
      }
    } else {
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1 || (r + c) % 2 === 0) {
            mark(this.index(r, c));
          }
        }
      }
    }
    let n = 0;
    for (let i = 0; i < this.length; i += 1) {
      if (marks[i] > 0) {
        this.vine[i] = hp;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  /** 开局放猫头鹰和闪光，优先放在未覆盖、未冰封的可玩格。 */
  placeStarterSpecials(options, seed) {
    const wantOwls = Math.max(0, Math.floor(options.owls ?? 0));
    const wantSpark = Math.max(0, Math.floor(options.sparkles ?? 0));
    const collect = (allowIce) => {
      const slots2 = [];
      for (let i = 0; i < this.length; i += 1) {
        const kind = this.cells[i];
        if (!isBasicTile(kind)) {
          continue;
        }
        if (this.isCoveredIndex(i)) {
          continue;
        }
        if (!allowIce && this.iceLocksTiles && this.ice[i] > 0) {
          continue;
        }
        slots2.push(i);
      }
      return slots2;
    };
    let slots = collect(false);
    if (slots.length < wantOwls + wantSpark) {
      slots = collect(true);
    }
    let rng = seed >>> 0 || 1;
    const next = () => {
      rng = Math.imul(rng, 1664525) + 1013904223 >>> 0;
      return rng;
    };
    let owls = 0;
    let sparkles = 0;
    const take = () => {
      if (slots.length === 0) {
        return null;
      }
      const pick = next() % slots.length;
      return slots.splice(pick, 1)[0] ?? null;
    };
    const { cols } = this.size;
    for (let n = 0; n < wantOwls; n += 1) {
      const index = take();
      if (index === null) {
        break;
      }
      this.setTile(Math.floor(index / cols), index % cols, 7 /* ColorBomb */);
      owls += 1;
    }
    for (let n = 0; n < wantSpark; n += 1) {
      const index = take();
      if (index === null) {
        break;
      }
      this.setSparkle(Math.floor(index / cols), index % cols, true);
      sparkles += 1;
    }
    return { owls, sparkles };
  }
  countGems() {
    let n = 0;
    for (let i = 0; i < this.gem.length; i += 1) {
      n += this.gem[i];
    }
    return n;
  }
  /** 仍盖着棉花的格数（不论剩余层数）。 */
  countCloud() {
    let n = 0;
    for (let i = 0; i < this.cloud.length; i += 1) {
      if (this.cloud[i] > 0) {
        n += 1;
      }
    }
    return n;
  }
  /** 给每个非洞格铺满层棉花，返回格数。 */
  coverPlayableWithCloud() {
    let n = 0;
    for (let i = 0; i < this.length; i += 1) {
      if (this.cells[i] === 8 /* Hole */) {
        continue;
      }
      this.cloud[i] = CLOUD_HIT_LAYERS;
      n += 1;
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  /** 从底部铺 N 格满层棉花+粉球，返回实际格数。 */
  coverBottomCloudGems(count) {
    const want = Math.max(0, Math.floor(count));
    let n = 0;
    for (let r = 0; r < this.size.rows && n < want; r += 1) {
      for (let c = 0; c < this.size.cols && n < want; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] === 8 /* Hole */) {
          continue;
        }
        this.cloud[i] = CLOUD_HIT_LAYERS;
        this.gem[i] = 1;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  /** 全盘铺棉花但最上若干行留空，返回格数。 */
  coverPlayableSkippingTopRowsWithCloud(skipTopRows) {
    const skip = Math.max(0, Math.min(this.size.rows, Math.floor(skipTopRows)));
    const last = this.size.rows - 1 - skip;
    let n = 0;
    for (let r = 0; r <= last; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] === 8 /* Hole */) {
          continue;
        }
        this.cloud[i] = CLOUD_HIT_LAYERS;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  /** 从底部向上铺若干行满层棉花（跳过洞格）。 */
  coverBottomRowsWithCloud(bottomRows) {
    const rows = Math.max(0, Math.min(this.size.rows, Math.floor(bottomRows)));
    let n = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] === 8 /* Hole */) {
          continue;
        }
        this.cloud[i] = CLOUD_HIT_LAYERS;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  /** 从底部铺 N 个粉球（不改云）。 */
  placeGemsFromBottom(count) {
    const want = Math.max(0, Math.floor(count));
    let n = 0;
    for (let r = 0; r < this.size.rows && n < want; r += 1) {
      for (let c = 0; c < this.size.cols && n < want; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] === 8 /* Hole */) {
          continue;
        }
        this.gem[i] = 1;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }
  /**
   * 交换两个格子的 kind、tileId 与闪光标记（原子一次变更，version 只 +1）。
   */
  swap(row1, col1, row2, col2) {
    this.assertInBounds(row1, col1);
    this.assertInBounds(row2, col2);
    const ia = this.index(row1, col1);
    const ib = this.index(row2, col2);
    const kindA = this.cells[ia];
    this.cells[ia] = this.cells[ib];
    this.cells[ib] = kindA;
    const idA = this.tileIds[ia];
    this.tileIds[ia] = this.tileIds[ib];
    this.tileIds[ib] = idA;
    const sparkA = this.sparkles[ia];
    this.sparkles[ia] = this.sparkles[ib];
    this.sparkles[ib] = sparkA;
    this.bumpVersion();
  }
  /**
   * 回填所有空位：对 Empty 格调用 `kindProvider` 生成新块并分配 tileId。
   */
  fillEmpty(kindProvider) {
    let changed = false;
    for (let r = 0; r < this.size.rows; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] !== 0 /* Empty */) {
          continue;
        }
        const kind = kindProvider(r, c);
        this.cells[i] = kind;
        this.sparkles[i] = 0;
        this.tileIds[i] = kind === 0 /* Empty */ ? EMPTY_TILE_ID : this.allocTileId();
        changed = true;
      }
    }
    if (changed) {
      this.bumpVersion();
    }
  }
  /**
   * 深拷贝盘面（试交换 / 单测用）。
   */
  clone() {
    const copy = new _BoardModel(this.size, this.nextTileId);
    copy.cells.set(this.cells);
    copy.tileIds.set(this.tileIds);
    copy.sparkles.set(this.sparkles);
    copy.ice.set(this.ice);
    copy.cloud.set(this.cloud);
    copy.gem.set(this.gem);
    copy.buried.set(this.buried);
    copy.buriedId.set(this.buriedId);
    copy.snowmanQuaked.set(this.snowmanQuaked);
    copy.egg.set(this.egg);
    copy.vine.set(this.vine);
    copy.iceLocksTiles = this.iceLocksTiles;
    copy.harvestedSnowmen = this.harvestedSnowmen;
    copy.harvestedPenguins = this.harvestedPenguins;
    copy.version = this.version;
    return copy;
  }
  /**
   * 分配新的稳定 tileId。
   * @returns 新 id（≥ 1）
   */
  allocTileId() {
    const id = this.nextTileId;
    this.nextTileId += 1;
    return id;
  }
  /**
   * 读取下一枚将分配的 tileId（不递增，供单测断言）。
   * @returns 下一个 tileId
   */
  peekNextTileId() {
    return this.nextTileId;
  }
  /** 版本号 +1。 */
  bumpVersion() {
    this.version += 1;
  }
  /**
   * 越界则抛错。
   * @param row - 行
   * @param col - 列
   */
  assertInBounds(row, col) {
    if (!this.inBounds(row, col)) {
      throw new Error(`Cell out of bounds: (${row}, ${col})`);
    }
  }
};

// src/logic/board/BoardGenerator.ts
function generatePlayableBoard(board, seed) {
  const random = createSeededRandom(seed);
  const { rows, cols } = board.size;
  const kindCount = BASIC_TILE_KINDS.length;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (isHole(board.getTile(r, c))) {
        continue;
      }
      const forbidden = [];
      if (c >= 2 && board.getTile(r, c - 1) === board.getTile(r, c - 2) && board.getTile(r, c - 1) !== 0 /* Empty */ && !isHole(board.getTile(r, c - 1))) {
        forbidden.push(board.getTile(r, c - 1));
      }
      if (r >= 2 && board.getTile(r - 1, c) === board.getTile(r - 2, c) && board.getTile(r - 1, c) !== 0 /* Empty */ && !isHole(board.getTile(r - 1, c))) {
        forbidden.push(board.getTile(r - 1, c));
      }
      const kind = pickKind(random, kindCount, forbidden);
      board.setTile(r, c, kind);
    }
  }
}
function pickKind(random, kindCount, forbidden) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const kind = BASIC_TILE_KINDS[Math.floor(random() * kindCount)];
    if (!forbidden.includes(kind)) {
      return kind;
    }
  }
  return BASIC_TILE_KINDS[Math.floor(random() * kindCount)];
}

// src/logic/board/BoardShape.ts
function isSplit34Cell(col, cols) {
  const holeCol = cols >= 7 ? 3 : Math.min(3, Math.max(0, cols - 5));
  return col !== holeCol;
}
var HEART_6 = [
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [0, 1, 1, 0, 1, 1]
];
function isHeartCell(row, col, rows, cols) {
  if (rows === 6 && cols === 6) {
    return HEART_6[row]?.[col] === 1;
  }
  const x = (col + 0.5) / cols * 2 - 1;
  const y = 1 - (row + 0.5) / rows * 2;
  const nx = x * 1.22;
  const ny = -(y * 1.12 + 0.18);
  const a = nx * nx + ny * ny - 1;
  return a * a * a - nx * nx * ny * ny * ny <= 0;
}
function isCellPlayable(row, col, rows, cols, shape = "rect") {
  if (shape === "rect") {
    return true;
  }
  if (shape === "split_3_4") {
    return isSplit34Cell(col, cols);
  }
  if (shape === "plus") {
    const midR0 = Math.floor((rows - 1) / 2);
    const midR1 = Math.ceil((rows - 1) / 2);
    const midC0 = Math.floor((cols - 1) / 2);
    const midC1 = Math.ceil((cols - 1) / 2);
    return row === midR0 || row === midR1 || col === midC0 || col === midC1;
  }
  if (shape === "ring" || shape === "double_ring") {
    const hole = shape === "double_ring" ? 2 : rows >= 8 ? 2 : 1;
    return !(row >= hole && row < rows - hole && col >= hole && col < cols - hole);
  }
  if (shape === "hourglass") {
    const y = rows <= 1 ? 0.5 : row / (rows - 1);
    const x = cols <= 1 ? 0.5 : (col + 0.5) / cols;
    const half = 0.14 + Math.abs(y - 0.5) * 0.58;
    return Math.abs(x - 0.5) <= half;
  }
  if (shape === "heart") {
    return isHeartCell(row, col, rows, cols);
  }
  const cr = (rows - 1) / 2;
  const cc = (cols - 1) / 2;
  const limit = Math.ceil((rows + cols) / 4);
  return Math.abs(row - cr) + Math.abs(col - cc) <= limit;
}
function applyBoardShape(board, shape) {
  if (!shape || shape === "rect") {
    return;
  }
  const { rows, cols } = board.size;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!isCellPlayable(r, c, rows, cols, shape)) {
        board.setTile(r, c, 8 /* Hole */);
      }
    }
  }
}

// src/logic/board/MatchFinder.ts
var DEFAULT_MAX_CELLS = 100;
var MatchSet = class {
  /**
   * @param capacity - 预分配容量，通常等于棋盘格子数
   */
  constructor(capacity) {
    this.indices = new Int32Array(capacity);
    this.size = 0;
  }
  /**
   * 当前是否存在任意匹配。
   * @returns 是否非空
   */
  isEmpty() {
    return this.size === 0;
  }
  /**
   * 判断某一下标是否在本次匹配结果中（O(n)，仅调试/测试用）。
   * @param index - 行优先一维下标
   * @returns 是否命中
   */
  contains(index) {
    for (let i = 0; i < this.size; i += 1) {
      if (this.indices[i] === index) {
        return true;
      }
    }
    return false;
  }
  /**
   * 清空有效长度（不释放底层数组）。
   */
  clear() {
    this.size = 0;
  }
};
var MatchFinder = class {
  /**
   * @param maxCells - 预分配容量；若实际棋盘更大，会在首次扫描时扩容（仅扩容时分配）
   */
  constructor(maxCells = DEFAULT_MAX_CELLS) {
    this.capacity = maxCells;
    this.marked = new Uint8Array(maxCells);
    this.result = new MatchSet(maxCells);
  }
  /**
   * 全盘扫描并返回匹配集合。
   * @param board - 棋盘模型（只读扫描，不修改盘面）
   * @returns 复用的 `MatchSet`；无匹配时 `size === 0`
   */
  findMatches(board) {
    const cellCount = board.length;
    this.ensureCapacity(cellCount);
    this.clearScratch(cellCount);
    this.scanHorizontal(board);
    this.scanVertical(board);
    this.compactMarked(cellCount);
    return this.result;
  }
  /**
   * 横向扫描：每一行找连续 ≥3 的相同可匹配块并标记。
   * @param board - 棋盘
   */
  scanHorizontal(board) {
    const { rows, cols } = board.size;
    const cells = board.cells;
    for (let r = 0; r < rows; r += 1) {
      const rowBase = r * cols;
      let c = 0;
      while (c < cols) {
        const start = c;
        const kind = cells[rowBase + c];
        if (!isMatchable(kind) || board.isCoveredIndex(rowBase + c)) {
          c += 1;
          continue;
        }
        c += 1;
        while (c < cols && cells[rowBase + c] === kind && !board.isCoveredIndex(rowBase + c)) {
          c += 1;
        }
        const runLength = c - start;
        if (runLength >= 3) {
          for (let k = start; k < c; k += 1) {
            this.marked[rowBase + k] = 1;
          }
        }
      }
    }
  }
  /**
   * 纵向扫描：每一列找连续 ≥3 的相同可匹配块并标记。
   * @param board - 棋盘
   */
  scanVertical(board) {
    const { rows, cols } = board.size;
    const cells = board.cells;
    for (let c = 0; c < cols; c += 1) {
      let r = 0;
      while (r < rows) {
        const start = r;
        const kind = cells[r * cols + c];
        if (!isMatchable(kind) || board.isCoveredIndex(r * cols + c)) {
          r += 1;
          continue;
        }
        r += 1;
        while (r < rows && cells[r * cols + c] === kind && !board.isCoveredIndex(r * cols + c)) {
          r += 1;
        }
        const runLength = r - start;
        if (runLength >= 3) {
          for (let k = start; k < r; k += 1) {
            this.marked[k * cols + c] = 1;
          }
        }
      }
    }
  }
  /**
   * 将标记位图压缩写入 `result.indices`（横纵重叠处自然去重）。
   * @param cellCount - 有效格子数
   */
  compactMarked(cellCount) {
    let write = 0;
    for (let i = 0; i < cellCount; i += 1) {
      if (this.marked[i] === 1) {
        this.result.indices[write] = i;
        write += 1;
      }
    }
    this.result.size = write;
  }
  /**
   * 清空标记与结果长度（不重新分配）。
   * @param cellCount - 需要清零的前缀长度
   */
  clearScratch(cellCount) {
    this.marked.fill(0, 0, cellCount);
    this.result.clear();
  }
  /**
   * 若棋盘大于当前容量则扩容（仅此时分配新 TypedArray）。
   * @param cellCount - 当前棋盘格子数
   */
  ensureCapacity(cellCount) {
    if (cellCount <= this.capacity) {
      return;
    }
    this.capacity = cellCount;
    this.marked = new Uint8Array(cellCount);
    this.result = new MatchSet(cellCount);
  }
};

// src/logic/board/MoveValidator.ts
var MoveValidator = class {
  constructor(finder) {
    this.finder = finder ?? new MatchFinder();
  }
  areAdjacent(rowA, colA, rowB, colB) {
    const dr = Math.abs(rowA - rowB);
    const dc = Math.abs(colA - colB);
    return dr === 1 && dc === 0 || dr === 0 && dc === 1;
  }
  /**
   * 判断交换是否合法。
   * 开心消消乐：超级猫头鹰与任意非空块可换；两闪光可换；两特殊块可换；否则需形成三消。
   */
  canSwap(board, rowA, colA, rowB, colB) {
    if (!this.areAdjacent(rowA, colA, rowB, colB)) {
      return false;
    }
    if (!board.inBounds(rowA, colA) || !board.inBounds(rowB, colB)) {
      return false;
    }
    const kindA = board.getTile(rowA, colA);
    const kindB = board.getTile(rowB, colB);
    if (kindA === 0 /* Empty */ || kindB === 0 /* Empty */ || isHole(kindA) || isHole(kindB)) {
      return false;
    }
    if (board.isCoveredIndex(board.index(rowA, colA)) || board.isCoveredIndex(board.index(rowB, colB))) {
      return false;
    }
    if (board.iceLocksTiles && (board.getIce(rowA, colA) > 0 || board.getIce(rowB, colB) > 0)) {
      return false;
    }
    if (kindA === 7 /* ColorBomb */ || kindB === 7 /* ColorBomb */) {
      return true;
    }
    if (board.isSparkle(rowA, colA) && board.isSparkle(rowB, colB)) {
      return true;
    }
    if (isSpecialTile(kindA) && isSpecialTile(kindB)) {
      return true;
    }
    const trial = board.clone();
    trial.swap(rowA, colA, rowB, colB);
    const matches = this.finder.findMatches(trial);
    return !matches.isEmpty();
  }
};

// src/logic/board/BoardShuffle.ts
function shuffleUntilPlayable(board, seed, maxAttempts = 40, force = false) {
  const validator = new MoveValidator();
  if (!force && hasAnyValidMove(board, validator)) {
    return true;
  }
  const random = createSeededRandom(seed);
  const cells = [];
  for (let i = 0; i < board.length; i += 1) {
    const kind = board.cells[i];
    if (kind === 0 /* Empty */ || isHole(kind)) {
      continue;
    }
    cells.push({
      kind,
      tileId: board.tileIds[i],
      sparkle: board.sparkles[i]
    });
  }
  if (cells.length < 2) {
    return hasAnyValidMove(board, validator);
  }
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    for (let i = cells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = cells[i];
      cells[i] = cells[j];
      cells[j] = tmp;
    }
    let write = 0;
    for (let i = 0; i < board.length; i += 1) {
      if (board.cells[i] === 0 /* Empty */ || isHole(board.cells[i])) {
        continue;
      }
      const src = cells[write];
      board.cells[i] = src.kind;
      board.tileIds[i] = src.tileId;
      board.sparkles[i] = src.sparkle;
      write += 1;
    }
    board.version += 1;
    if (hasAnyValidMove(board, validator)) {
      return true;
    }
  }
  return hasAnyValidMove(board, validator);
}
function hasAnyValidMove(board, validator = new MoveValidator()) {
  const { rows, cols } = board.size;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (c + 1 < cols && validator.canSwap(board, r, c, r, c + 1)) {
        return true;
      }
      if (r + 1 < rows && validator.canSwap(board, r, c, r + 1, c)) {
        return true;
      }
    }
  }
  return false;
}

// src/logic/board/SpecialRules.ts
function planSpecialSpawns(board, matchIndices, preferredRow, preferredCol) {
  if (matchIndices.length < 4) {
    return [];
  }
  const { rows, cols } = board.size;
  const matchSet = new Set(matchIndices);
  const used = /* @__PURE__ */ new Set();
  const spawns = [];
  for (let r = 0; r < rows; r += 1) {
    let c = 0;
    while (c < cols) {
      const start = c;
      const index0 = r * cols + c;
      const kind = board.cells[index0];
      if (!isMatchable(kind) || !matchSet.has(index0)) {
        c += 1;
        continue;
      }
      c += 1;
      while (c < cols && board.cells[r * cols + c] === kind && matchSet.has(r * cols + c)) {
        c += 1;
      }
      const len = c - start;
      if (len >= 4) {
        const pick = pickSpawnCell(
          board,
          r,
          start,
          r,
          c - 1,
          preferredRow,
          preferredCol,
          used
        );
        if (pick) {
          pushOrUpgrade(spawns, used, board, pick.row, pick.col, kind, len >= 5);
        }
      }
    }
  }
  for (let c = 0; c < cols; c += 1) {
    let r = 0;
    while (r < rows) {
      const start = r;
      const index0 = r * cols + c;
      const kind = board.cells[index0];
      if (!isMatchable(kind) || !matchSet.has(index0)) {
        r += 1;
        continue;
      }
      r += 1;
      while (r < rows && board.cells[r * cols + c] === kind && matchSet.has(r * cols + c)) {
        r += 1;
      }
      const len = r - start;
      if (len >= 4) {
        const pick = pickSpawnCell(
          board,
          start,
          c,
          r - 1,
          c,
          preferredRow,
          preferredCol,
          used
        );
        if (pick) {
          pushOrUpgrade(spawns, used, board, pick.row, pick.col, kind, len >= 5);
        }
      }
    }
  }
  for (const index of matchIndices) {
    if (used.has(index)) {
      continue;
    }
    const row = Math.floor(index / cols);
    const col = index % cols;
    const kind = board.cells[index];
    if (!isMatchable(kind)) {
      continue;
    }
    const hLen = runLengthThrough(board, row, col, 0, 1, matchSet);
    const vLen = runLengthThrough(board, row, col, 1, 0, matchSet);
    if (hLen >= 3 && vLen >= 3) {
      pushOrUpgrade(spawns, used, board, row, col, kind, false);
    }
  }
  return spawns;
}
function expandSpecialClears(board, rowA, colA, rowB, colB, baseMatches) {
  const clear = new Set(baseMatches);
  const kindA = board.getTile(rowA, colA);
  const kindB = board.getTile(rowB, colB);
  if (kindA === 7 /* ColorBomb */ && kindB === 7 /* ColorBomb */) {
    for (let i = 0; i < board.length; i += 1) {
      if (board.cells[i] !== 0 /* Empty */) {
        clear.add(i);
      }
    }
    return [...clear];
  }
  if (kindA === 7 /* ColorBomb */ || kindB === 7 /* ColorBomb */) {
    const owlRow = kindA === 7 /* ColorBomb */ ? rowA : rowB;
    const owlCol = kindA === 7 /* ColorBomb */ ? colA : colB;
    const otherKind = kindA === 7 /* ColorBomb */ ? kindB : kindA;
    const otherRow = kindA === 7 /* ColorBomb */ ? rowB : rowA;
    const otherCol = kindA === 7 /* ColorBomb */ ? colB : colA;
    clear.add(board.index(owlRow, owlCol));
    if (isMatchable(otherKind) || isBasicTile(otherKind)) {
      clear.add(board.index(otherRow, otherCol));
      for (let i = 0; i < board.length; i += 1) {
        if (board.cells[i] === otherKind) {
          clear.add(i);
        }
      }
    } else if (isSpecialTile(otherKind)) {
      clear.add(board.index(otherRow, otherCol));
    }
    expandSparkleBlasts(board, clear);
    return [...clear];
  }
  if (board.isSparkle(rowA, colA) && board.isSparkle(rowB, colB)) {
    clear.add(board.index(rowA, colA));
    clear.add(board.index(rowB, colB));
    expandSparkleBlasts(board, clear);
    return [...clear];
  }
  expandSparkleBlasts(board, clear);
  return [...clear];
}
function expandSparkleBlasts(board, clear) {
  const queue = [];
  for (const index of clear) {
    if (board.sparkles[index] === 1) {
      queue.push(index);
    }
  }
  let guard = 0;
  while (queue.length > 0 && guard < 64) {
    guard += 1;
    const index = queue.shift();
    const row = Math.floor(index / board.size.cols);
    const col = index % board.size.cols;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const rr = row + dr;
        const cc = col + dc;
        if (!board.inBounds(rr, cc)) {
          continue;
        }
        const ni = board.index(rr, cc);
        if (clear.has(ni)) {
          continue;
        }
        if (board.cells[ni] === 0 /* Empty */ || board.cells[ni] === 8 /* Hole */) {
          continue;
        }
        clear.add(ni);
        if (board.sparkles[ni] === 1) {
          queue.push(ni);
        }
      }
    }
  }
}
function pushOrUpgrade(spawns, used, board, row, col, colorKind, asOwl) {
  const existing = spawns.find((s) => s.row === row && s.col === col);
  if (asOwl) {
    if (!existing) {
      spawns.push({ row, col, kind: 7 /* ColorBomb */, sparkle: false });
      used.add(board.index(row, col));
    } else {
      existing.kind = 7 /* ColorBomb */;
      existing.sparkle = false;
    }
    return;
  }
  if (!existing) {
    spawns.push({ row, col, kind: colorKind, sparkle: true });
    used.add(board.index(row, col));
  }
}
function runLengthThrough(board, row, col, dr, dc, matchSet) {
  const kind = board.getTile(row, col);
  let len = 1;
  let r = row + dr;
  let c = col + dc;
  while (board.inBounds(r, c) && board.getTile(r, c) === kind && matchSet.has(board.index(r, c))) {
    len += 1;
    r += dr;
    c += dc;
  }
  r = row - dr;
  c = col - dc;
  while (board.inBounds(r, c) && board.getTile(r, c) === kind && matchSet.has(board.index(r, c))) {
    len += 1;
    r -= dr;
    c -= dc;
  }
  return len;
}
function pickSpawnCell(board, r0, c0, r1, c1, preferredRow, preferredCol, used) {
  if (preferredRow !== void 0 && preferredCol !== void 0 && preferredRow >= r0 && preferredRow <= r1 && preferredCol >= c0 && preferredCol <= c1) {
    const idx = board.index(preferredRow, preferredCol);
    if (!used.has(idx)) {
      return { row: preferredRow, col: preferredCol };
    }
  }
  const midR = Math.floor((r0 + r1) / 2);
  const midC = Math.floor((c0 + c1) / 2);
  const midIdx = board.index(midR, midC);
  if (!used.has(midIdx)) {
    return { row: midR, col: midC };
  }
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const idx = board.index(r, c);
      if (!used.has(idx)) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

// src/logic/board/MatchResolver.ts
var EMPTY_TILE_ID2 = 0;
var DEFAULT_MAX_CASCADE = 64;
var MatchResolver = class {
  /**
   * @param finder - 可选；默认内部创建 MatchFinder
   * @param maxCells - 预分配容量
   */
  constructor(finder, maxCells = 100) {
    /** 下落记录缓冲（复用对象）。 */
    this.fellScratch = [];
    /** 新生记录缓冲（复用对象）。 */
    this.spawnedScratch = [];
    /** 消除种类缓冲（复用）。 */
    this.clearedKindScratch = [];
    this.fellCount = 0;
    this.spawnedCount = 0;
    this.clearedKindCount = 0;
    this.finder = finder ?? new MatchFinder(maxCells);
    this.clearIndices = new Int32Array(maxCells);
    this.clearCapacity = maxCells;
  }
  /**
   * 从给定匹配集合开始，执行完整连锁结算。
   * @param board - 棋盘（会被原地修改）
   * @param initialMatches - 首轮待消除集合；若为空且无 initialClearIndices 则直接返回零结果
   * @param options - 种子与连锁上限
   * @returns 结算结果（`fell` / `spawned` 为新数组快照，可安全保留）
   */
  resolve(board, initialMatches, options) {
    this.resetCounters();
    const random = createSeededRandom(options.seed);
    const maxCascade = options.maxCascade ?? DEFAULT_MAX_CASCADE;
    let cleared = 0;
    let iceBroken = 0;
    let cascadeDepth = 0;
    const waves = [];
    let clearIndicesList = options.initialClearIndices?.slice() ?? Array.from(initialMatches.indices.subarray(0, initialMatches.size));
    if (!options.initialClearIndices && clearIndicesList.length > 0) {
      const set = new Set(clearIndicesList);
      expandSparkleBlasts(board, set);
      clearIndicesList = [...set];
    }
    let preferredRow = options.preferredSpawnRow;
    let preferredCol = options.preferredSpawnCol;
    while (clearIndicesList.length > 0) {
      if (cascadeDepth >= maxCascade) {
        break;
      }
      const fellBefore = this.fellCount;
      const spawnedBefore = this.spawnedCount;
      const kindsBefore = this.clearedKindCount;
      const planned = options.spawnSpecials === false && cascadeDepth === 0 ? [] : cascadeDepth === 0 ? planSpecialSpawns(board, clearIndicesList, preferredRow, preferredCol) : planSpecialSpawns(board, clearIndicesList);
      const clearCount = this.loadClearIndices(clearIndicesList);
      const clearedIndices = [];
      for (let i = 0; i < clearCount; i += 1) {
        const index = this.clearIndices[i];
        if (board.isCoveredIndex(index)) {
          continue;
        }
        clearedIndices.push(index);
      }
      const clearedNow = this.applyClear(board, clearCount);
      cleared += clearedNow.tiles;
      iceBroken += clearedNow.ice;
      const specialSpawns = this.applySpecialSpawns(board, planned);
      this.applyGravity(board);
      this.applyFill(board, random);
      cascadeDepth += 1;
      waves.push({
        clearedIndices,
        clearedKinds: this.clearedKindScratch.slice(kindsBefore, this.clearedKindCount),
        fell: this.snapshotFellRange(fellBefore, this.fellCount),
        spawned: this.snapshotSpawnedRange(spawnedBefore, this.spawnedCount),
        specialSpawns,
        chippedCloudIndices: clearedNow.cloudHits,
        chippedEggIndices: clearedNow.eggHits,
        chippedVineIndices: clearedNow.vineHits
      });
      preferredRow = void 0;
      preferredCol = void 0;
      const nextMatches = this.finder.findMatches(board);
      if (nextMatches.isEmpty()) {
        clearIndicesList = [];
      } else {
        const set = new Set(
          Array.from(nextMatches.indices.subarray(0, nextMatches.size))
        );
        expandSparkleBlasts(board, set);
        clearIndicesList = [...set];
      }
    }
    return {
      cleared,
      iceBroken,
      cascadeDepth,
      fell: this.snapshotFell(),
      spawned: this.snapshotSpawned(),
      clearedKinds: this.snapshotClearedKinds(),
      waves
    };
  }
  /**
   * 先扫描盘面，若有匹配则执行完整连锁结算。
   * @param board - 棋盘
   * @param options - 种子与连锁上限
   * @returns 结算结果
   */
  resolveBoard(board, options) {
    const matches = this.finder.findMatches(board);
    return this.resolve(board, matches, options);
  }
  /**
   * 将匹配格置为 Empty，累加消除数。
   * @param board - 棋盘
   * @param count - `clearIndices` 中有效下标数量
   * @returns 本波消除数量与碎冰数量
   */
  applyClear(board, count) {
    const { cells, tileIds, sparkles } = board;
    let ice = 0;
    let tiles = 0;
    const directCloud = [];
    const directEgg = [];
    const directVine = [];
    for (let i = 0; i < count; i += 1) {
      const index = this.clearIndices[i];
      const kind = cells[index];
      if (isHole(kind) || kind === 0 /* Empty */) {
        continue;
      }
      const peeled = board.peelCoverAtIndex(index);
      if (peeled === "cloud") {
        directCloud.push(index);
        continue;
      }
      if (peeled === "egg") {
        directEgg.push(index);
        continue;
      }
      if (peeled === "vine") {
        directVine.push(index);
        continue;
      }
      this.pushClearedKind(kind);
      tiles += 1;
      board.hitCloudOrGemAtIndex(index);
      if ((isBasicTile(kind) || isSpecialTile(kind)) && board.breakIceAtIndex(index)) {
        ice += 1;
      }
      cells[index] = 0 /* Empty */;
      tileIds[index] = EMPTY_TILE_ID2;
      sparkles[index] = 0;
    }
    const cloudHits = [
      ...directCloud,
      ...count > 0 ? board.chipCloudsAdjacentToClears(this.clearIndices, count) : []
    ];
    const eggHits = [
      ...directEgg,
      ...count > 0 ? board.chipEggsAdjacentToClears(this.clearIndices, count) : []
    ];
    const vineHits = [
      ...directVine,
      ...count > 0 ? board.chipVinesAdjacentToClears(this.clearIndices, count) : []
    ];
    if (count > 0) {
      ice += board.applySnowmanQuakes().ice;
      board.version += 1;
    }
    return { tiles, ice, cloudHits, eggHits, vineHits };
  }
  /**
   * 重力下落：每列自底向上压实非空块，记录 fromRow → toRow。
   * 棉花格锁住动物，不参与下落，也不让其他块穿过；洞格仍可绕开。
   */
  applyGravity(board) {
    const { rows, cols } = board.size;
    const { cells, tileIds, sparkles } = board;
    let moved = false;
    for (let c = 0; c < cols; c += 1) {
      let floor = rows - 1;
      while (floor >= 0) {
        if (board.isCoveredIndex(floor * cols + c)) {
          floor -= 1;
          continue;
        }
        let start = floor;
        while (start - 1 >= 0 && !board.isCoveredIndex((start - 1) * cols + c)) {
          start -= 1;
        }
        const falling = [];
        for (let readRow = floor; readRow >= start; readRow -= 1) {
          const readIndex = readRow * cols + c;
          const kind = cells[readIndex];
          if (isHole(kind) || kind === 0 /* Empty */) {
            continue;
          }
          falling.push({
            kind,
            tileId: tileIds[readIndex],
            spark: sparkles[readIndex],
            fromRow: readRow
          });
        }
        let fallAt = 0;
        for (let destRow = floor; destRow >= start; destRow -= 1) {
          const destIndex = destRow * cols + c;
          if (isHole(cells[destIndex])) {
            continue;
          }
          const next = falling[fallAt];
          if (!next) {
            if (cells[destIndex] !== 0 /* Empty */) {
              cells[destIndex] = 0 /* Empty */;
              tileIds[destIndex] = EMPTY_TILE_ID2;
              sparkles[destIndex] = 0;
              moved = true;
            }
            continue;
          }
          fallAt += 1;
          if (next.fromRow !== destRow) {
            cells[destIndex] = next.kind;
            tileIds[destIndex] = next.tileId;
            sparkles[destIndex] = next.spark;
            this.pushFell(next.tileId, c, next.fromRow, destRow);
            moved = true;
          }
        }
        floor = start - 1;
      }
    }
    if (moved) {
      board.version += 1;
    }
  }
  /**
   * 顶部空位填充：按 seed 从基础色块中选取种类并分配新 tileId。
   */
  applyFill(board, random) {
    const { rows, cols } = board.size;
    const { cells, tileIds, sparkles } = board;
    const kindCount = BASIC_TILE_KINDS.length;
    let spawned = false;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const index = r * cols + c;
        if (isHole(cells[index]) || cells[index] !== 0 /* Empty */) {
          continue;
        }
        const kind = BASIC_TILE_KINDS[Math.floor(random() * kindCount)];
        const tileId = board.allocTileId();
        cells[index] = kind;
        tileIds[index] = tileId;
        sparkles[index] = 0;
        this.pushSpawned(tileId, r, c, kind);
        spawned = true;
      }
    }
    if (spawned) {
      board.version += 1;
    }
  }
  /**
   * 将下标列表载入内部缓冲。
   */
  loadClearIndices(indices) {
    const count = indices.length;
    this.ensureClearCapacity(count);
    for (let i = 0; i < count; i += 1) {
      this.clearIndices[i] = indices[i];
    }
    return count;
  }
  /**
   * 在已清空的格子上生成特殊块。
   */
  applySpecialSpawns(board, planned) {
    const out = [];
    for (const spawn of planned) {
      const tileId = board.allocTileId();
      board.setTile(spawn.row, spawn.col, spawn.kind, tileId);
      if (spawn.sparkle) {
        board.setSparkle(spawn.row, spawn.col, true);
      }
      out.push({
        tileId,
        row: spawn.row,
        col: spawn.col,
        kind: spawn.kind,
        sparkle: spawn.sparkle
      });
    }
    return out;
  }
  /**
   * 追加一条下落记录（复用对象槽位）。
   */
  pushFell(tileId, col, fromRow, toRow) {
    if (this.fellCount >= this.fellScratch.length) {
      this.fellScratch.push({ tileId: 0, col: 0, fromRow: 0, toRow: 0 });
    }
    const rec = this.fellScratch[this.fellCount];
    rec.tileId = tileId;
    rec.col = col;
    rec.fromRow = fromRow;
    rec.toRow = toRow;
    this.fellCount += 1;
  }
  /**
   * 追加一条新生记录（复用对象槽位）。
   */
  pushSpawned(tileId, row, col, kind) {
    if (this.spawnedCount >= this.spawnedScratch.length) {
      this.spawnedScratch.push({
        tileId: 0,
        row: 0,
        col: 0,
        kind: 0 /* Empty */
      });
    }
    const rec = this.spawnedScratch[this.spawnedCount];
    rec.tileId = tileId;
    rec.row = row;
    rec.col = col;
    rec.kind = kind;
    this.spawnedCount += 1;
  }
  /**
   * 导出下落快照（浅拷贝记录对象，避免后续 resolve 覆盖）。
   */
  snapshotFell() {
    return this.snapshotFellRange(0, this.fellCount);
  }
  /**
   * 导出 [from, to) 区间的下落快照。
   */
  snapshotFellRange(from, to) {
    const out = new Array(to - from);
    for (let i = from; i < to; i += 1) {
      const src = this.fellScratch[i];
      out[i - from] = {
        tileId: src.tileId,
        col: src.col,
        fromRow: src.fromRow,
        toRow: src.toRow
      };
    }
    return out;
  }
  /**
   * 导出新生快照。
   */
  snapshotSpawned() {
    return this.snapshotSpawnedRange(0, this.spawnedCount);
  }
  /**
   * 导出 [from, to) 区间的新生快照。
   */
  snapshotSpawnedRange(from, to) {
    const out = new Array(to - from);
    for (let i = from; i < to; i += 1) {
      const src = this.spawnedScratch[i];
      out[i - from] = {
        tileId: src.tileId,
        row: src.row,
        col: src.col,
        kind: src.kind
      };
    }
    return out;
  }
  /**
   * 追加一个被消除的种类。
   * @param kind - 消除前的种类
   */
  pushClearedKind(kind) {
    if (this.clearedKindCount >= this.clearedKindScratch.length) {
      this.clearedKindScratch.push(0 /* Empty */);
    }
    this.clearedKindScratch[this.clearedKindCount] = kind;
    this.clearedKindCount += 1;
  }
  /**
   * 导出消除种类快照。
   */
  snapshotClearedKinds() {
    return this.clearedKindScratch.slice(0, this.clearedKindCount);
  }
  /** 重置波次计数器。 */
  resetCounters() {
    this.fellCount = 0;
    this.spawnedCount = 0;
    this.clearedKindCount = 0;
  }
  /**
   * 确保消除下标缓冲足够大。
   * @param count - 需要的最小容量
   */
  ensureClearCapacity(count) {
    if (count <= this.clearCapacity) {
      return;
    }
    this.clearCapacity = count;
    this.clearIndices = new Int32Array(count);
  }
};

// src/logic/economy/AdPlacementPolicy.ts
var AdPlacementPolicy = class {
  /**
   * @param options - 策略配置
   */
  constructor(options = {}) {
    this.offerReviveOnFail = options.offerReviveOnFail ?? true;
    this.interstitialEveryNLevels = options.interstitialEveryNLevels ?? 2;
  }
  /**
   * 结算时的广告决策。
   * @param levelId - 关卡 id
   * @param won - 是否通关
   */
  decideOnSettle(levelId, won) {
    return {
      showInterstitial: this.shouldShowInterstitial(levelId, won, 0, 0, 0),
      offerRewardedRevive: !won && this.offerReviveOnFail,
      offerCrushExtend: false
    };
  }
  /**
   * 通关插屏：偶数关 + 冷却已过。冷却未到或失败局不弹，避免连关被广告堵住。
   */
  shouldShowInterstitial(levelId, won, lastShownMs, nowMs, cooldownSeconds) {
    if (!won || this.interstitialEveryNLevels <= 0) {
      return false;
    }
    if (levelId % this.interstitialEveryNLevels !== 0) {
      return false;
    }
    if (lastShownMs > 0 && cooldownSeconds > 0 && nowMs - lastShownMs < cooldownSeconds * 1e3) {
      return false;
    }
    return true;
  }
};

// src/core/utils/lobbyBanner.ts
var LOBBY_BANNER_ASPECT = 7 / 20;
var LOBBY_BANNER_SIDE_MARGIN = 8;
var LOBBY_BANNER_MIN_BOTTOM = 4;
function finitePx(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.round(value));
}
function layoutLobbyBannerStyle(windowWidth, windowHeight, safeBottom = 0) {
  const winW = finitePx(windowWidth, 375);
  const winH = finitePx(windowHeight, 667);
  const safe = finitePx(safeBottom, 0);
  const left = LOBBY_BANNER_SIDE_MARGIN;
  const width = Math.max(1, winW - LOBBY_BANNER_SIDE_MARGIN * 2);
  const height = Math.max(1, Math.round(width * LOBBY_BANNER_ASPECT));
  const bottomGap = Math.max(LOBBY_BANNER_MIN_BOTTOM, safe);
  const top = Math.max(0, winH - height - bottomGap);
  return { left, top, width, height };
}
function lobbyBannerReserveHeight(windowWidth, windowHeight, safeBottom = 0) {
  const style = layoutLobbyBannerStyle(windowWidth, windowHeight, safeBottom);
  return Math.max(0, finitePx(windowHeight, 667) - style.top);
}

// src/core/utils/wxHost.ts
var FALLBACK_WX_INFO = {
  brand: "",
  model: "",
  pixelRatio: 2,
  screenWidth: 375,
  screenHeight: 667,
  windowWidth: 375,
  windowHeight: 667,
  language: "zh",
  version: "",
  system: "",
  platform: "",
  SDKVersion: ""
};
function finiteOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function tryWxCall(fn) {
  if (typeof fn !== "function") {
    return null;
  }
  try {
    return fn();
  } catch {
    return null;
  }
}
function readWxSystemInfo() {
  try {
    if (typeof wx === "undefined") {
      return { ...FALLBACK_WX_INFO };
    }
    const windowInfo = tryWxCall(wx.getWindowInfo);
    const deviceInfo = tryWxCall(wx.getDeviceInfo);
    const appBase = tryWxCall(wx.getAppBaseInfo);
    if (windowInfo || deviceInfo || appBase) {
      return {
        brand: String(deviceInfo?.brand || ""),
        model: String(deviceInfo?.model || ""),
        pixelRatio: finiteOr(windowInfo?.pixelRatio, 2),
        screenWidth: finiteOr(windowInfo?.screenWidth, 375),
        screenHeight: finiteOr(windowInfo?.screenHeight, 667),
        windowWidth: finiteOr(windowInfo?.windowWidth, 375),
        windowHeight: finiteOr(windowInfo?.windowHeight, 667),
        language: String(appBase?.language || "zh"),
        version: String(appBase?.version || ""),
        system: String(deviceInfo?.system || ""),
        platform: String(deviceInfo?.platform || ""),
        SDKVersion: String(appBase?.SDKVersion || ""),
        statusBarHeight: windowInfo?.statusBarHeight,
        benchmarkLevel: deviceInfo?.benchmarkLevel,
        safeArea: windowInfo?.safeArea
      };
    }
    const sync = tryWxCall(wx.getSystemInfoSync);
    if (!sync) {
      return { ...FALLBACK_WX_INFO };
    }
    return {
      brand: String(sync.brand || ""),
      model: String(sync.model || ""),
      pixelRatio: finiteOr(sync.pixelRatio, 2),
      screenWidth: finiteOr(sync.screenWidth, 375),
      screenHeight: finiteOr(sync.screenHeight, 667),
      windowWidth: finiteOr(sync.windowWidth, 375),
      windowHeight: finiteOr(sync.windowHeight, 667),
      language: String(sync.language || "zh"),
      version: String(sync.version || ""),
      system: String(sync.system || ""),
      platform: String(sync.platform || ""),
      SDKVersion: String(sync.SDKVersion || ""),
      statusBarHeight: sync.statusBarHeight,
      benchmarkLevel: sync.benchmarkLevel,
      safeArea: sync.safeArea
    };
  } catch {
    return { ...FALLBACK_WX_INFO };
  }
}
function readWxInfo() {
  try {
    if (typeof wx === "undefined") {
      return null;
    }
    const info = readWxSystemInfo();
    if (!info.platform && !info.brand && !info.model) {
      return null;
    }
    return info;
  } catch {
    return null;
  }
}
function platformOf(info) {
  return String(info?.platform || "").toLowerCase();
}
function isWxDesktopClient() {
  const platform = platformOf(readWxInfo());
  return platform === "mac" || platform === "windows";
}
function isWxDevtoolsHost() {
  const info = readWxInfo();
  const platform = platformOf(info);
  if (platform === "devtools") {
    return true;
  }
  const brand = String(info?.brand || "").toLowerCase();
  const model = String(info?.model || "").toLowerCase();
  if (brand.includes("devtools") || model.includes("devtools")) {
    return true;
  }
  try {
    const nav = globalThis.navigator;
    if (nav?.userAgent && /devtools|wechatdevtools/i.test(nav.userAgent)) {
      return true;
    }
  } catch {
  }
  const g = globalThis;
  return String(g.__wxConfig?.platform || "").toLowerCase() === "devtools";
}
function isWxDesktopIdeHost() {
  return isWxDevtoolsHost() || isWxDesktopClient();
}
function readWxMiniProgramEnvVersion() {
  try {
    if (typeof wx === "undefined" || typeof wx.getAccountInfoSync !== "function") {
      return null;
    }
    const env = wx.getAccountInfoSync()?.miniProgram?.envVersion;
    if (env === "develop" || env === "trial" || env === "release") {
      return env;
    }
  } catch {
  }
  return null;
}
function shouldUnlockAllLevelsForPreview() {
  const env = readWxMiniProgramEnvVersion();
  if (env === "release") {
    return false;
  }
  if (env === "develop" || env === "trial") {
    return true;
  }
  return isWxDevtoolsHost();
}
function isWxCustomAdHostSupported(platform) {
  const value = platform.toLowerCase();
  return value === "ios" || value === "android" || value === "ohos" || value === "harmonyos";
}
function canCreateWxNativeAds() {
  if (isWxDevtoolsHost() || isWxDesktopClient()) {
    return false;
  }
  const info = readWxInfo();
  return isWxCustomAdHostSupported(info?.platform || "");
}
function canCreateWxFullscreenAds() {
  return canCreateWxNativeAds();
}

// src/logic/economy/RevivePolicy.ts
var RevivePolicy = class {
  /**
   * @param options - 次数与步数配置
   */
  constructor(options = { maxRevivesPerLevel: 1, movesGranted: 5 }) {
    this.reviveUsed = 0;
    this.maxRevivesPerLevel = Math.max(0, options.maxRevivesPerLevel);
    this.movesGranted = Math.max(0, options.movesGranted);
  }
  /**
   * 开新关时重置计数。
   */
  resetForLevel() {
    this.reviveUsed = 0;
  }
  /** 本关最多可看几次复活广告。 */
  setMaxPerLevel(max) {
    this.maxRevivesPerLevel = Math.max(0, Math.floor(max));
  }
  /**
   * 查询当前是否可复活。
   */
  offer() {
    const allowed = this.reviveUsed < this.maxRevivesPerLevel;
    return {
      allowed,
      movesGranted: allowed ? this.movesGranted : 0,
      used: this.reviveUsed,
      maxPerLevel: this.maxRevivesPerLevel
    };
  }
  /**
   * 成功看完广告后消耗一次复活机会。
   */
  consume() {
    this.reviveUsed += 1;
  }
};

// src/logic/economy/BoosterInventory.ts
var EMPTY = { hammer: 0, shuffle: 0, extraMoves: 0 };
var BoosterInventory = class {
  constructor() {
    this.stock = { ...EMPTY };
  }
  resetFromConfig(config) {
    this.stock = {
      hammer: Math.max(0, Math.floor(config.hammer.perLevel)),
      shuffle: Math.max(0, Math.floor(config.shuffle.perLevel)),
      extraMoves: Math.max(0, Math.floor(config.extraMoves.perLevel))
    };
  }
  loadStock(stock) {
    this.stock = {
      hammer: Math.max(0, Math.floor(stock.hammer)),
      shuffle: Math.max(0, Math.floor(stock.shuffle)),
      extraMoves: Math.max(0, Math.floor(stock.extraMoves))
    };
  }
  getStock() {
    return { ...this.stock };
  }
  getCount(id) {
    return this.stock[id];
  }
  add(id, amount) {
    const n = Math.floor(amount);
    if (n === 0) {
      return;
    }
    this.stock[id] = Math.max(0, this.stock[id] + n);
  }
  canUse(id) {
    return this.stock[id] > 0;
  }
  /** @returns 是否成功扣减 */
  consume(id) {
    if (this.stock[id] <= 0) {
      return false;
    }
    this.stock[id] -= 1;
    return true;
  }
};

// src/logic/events/GameEvents.ts
var GameEventBus = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set();
  }
  emit(event) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose() {
    this.listeners.clear();
  }
};

// src/logic/fsm/GameState.ts
var GAME_STATE_TRANSITIONS = {
  Boot: ["Lobby"],
  Lobby: ["LoadingLevel"],
  LoadingLevel: ["PlayerInput"],
  PlayerInput: ["Resolving", "Paused", "LevelFailed"],
  Resolving: ["PlayerInput", "LevelWon", "LevelFailed"],
  LevelWon: ["MovesBonus", "CrushReward", "Settle"],
  MovesBonus: ["CrushReward", "Settle"],
  CrushReward: ["Settle"],
  Cleaning: ["Settle"],
  LevelFailed: ["Settle", "PlayerInput"],
  Settle: ["Lobby", "LoadingLevel", "Cleaning"],
  Paused: ["PlayerInput"]
};
function canTransition(from, to) {
  return GAME_STATE_TRANSITIONS[from].includes(to);
}

// src/logic/fsm/GameStateMachine.ts
var GameStateMachine = class {
  constructor(initial = "Boot") {
    this.listeners = /* @__PURE__ */ new Set();
    this.state = initial;
  }
  getCurrent() {
    return this.state;
  }
  transitionTo(next) {
    if (!canTransition(this.state, next)) {
      return false;
    }
    const prev = this.state;
    this.state = next;
    for (const listener of this.listeners) {
      listener(prev, next);
    }
    return true;
  }
  /**
   * 强制切态（中途返回大厅等放弃流程），不校验迁移表。
   */
  forceTo(next) {
    if (this.state === next) {
      return true;
    }
    const prev = this.state;
    this.state = next;
    for (const listener of this.listeners) {
      listener(prev, next);
    }
    return true;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose() {
    this.listeners.clear();
  }
};

// src/logic/level/LevelGoals.ts
var LevelGoals = class {
  /**
   * @param goals - 关卡目标列表（会浅拷贝）
   */
  constructor(goals) {
    this.goals = goals.slice();
    this.progress = goals.map(() => 0);
    this.targets = goals.map((goal) => this.targetOf(goal));
  }
  /**
   * 原始目标列表。
   */
  getGoals() {
    return this.goals;
  }
  /**
   * 各目标当前进度数值。
   */
  getProgress() {
    return this.progress;
  }
  /**
   * 生成 HUD 用快照。
   */
  getSnapshots() {
    return this.goals.map((goal, index) => {
      const target = this.targets[index] ?? this.targetOf(goal);
      const current = this.progress[index] ?? 0;
      return {
        goal,
        current,
        target,
        completed: current >= target
      };
    });
  }
  /**
   * 是否全部目标完成。
   */
  isAllCompleted() {
    return this.goals.every((goal, index) => {
      return (this.progress[index] ?? 0) >= (this.targets[index] ?? this.targetOf(goal));
    });
  }
  /**
   * 根据本波消除种类更新 collect / clear_blocks 类目标。
   * @param kinds - 被消除的方块种类序列
   */
  applyClearedKinds(kinds) {
    if (kinds.length === 0) {
      return;
    }
    for (let i = 0; i < this.goals.length; i += 1) {
      const goal = this.goals[i];
      if (goal.type === "clear_blocks") {
        this.progress[i] = (this.progress[i] ?? 0) + kinds.length;
      } else if (goal.type === "collect") {
        let add = 0;
        for (let k = 0; k < kinds.length; k += 1) {
          if (kinds[k] === goal.kind) {
            add += 1;
          }
        }
        this.progress[i] = (this.progress[i] ?? 0) + add;
      }
    }
  }
  /**
   * 将分数类目标进度同步为当前总分。
   * @param score - 当前关卡总分
   */
  syncScore(score) {
    for (let i = 0; i < this.goals.length; i += 1) {
      const goal = this.goals[i];
      if (goal.type === "score") {
        this.progress[i] = score;
      }
    }
  }
  bindClearIceTarget(count) {
    const n = Math.max(0, count);
    let found = false;
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "clear_ice") {
        this.targets[i] = n;
        found = true;
      }
    }
    if (!found) {
      this.goals.push({ type: "clear_ice", count: n });
      this.progress.push(0);
      this.targets.push(n);
    }
  }
  syncClearIce(broken) {
    const n = Math.max(0, broken);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "clear_ice") {
        this.progress[i] = n;
      }
    }
  }
  bindClearCloudTarget(count) {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "clear_cloud") {
        this.targets[i] = Math.max(0, count);
      }
    }
  }
  syncClearCloud(cleared) {
    const n = Math.max(0, cleared);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "clear_cloud") {
        this.progress[i] = n;
      }
    }
  }
  bindCollectGemsTarget(count) {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "collect_gems") {
        this.targets[i] = Math.max(0, count);
      }
    }
  }
  syncCollectGems(collected) {
    const n = Math.max(0, collected);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "collect_gems") {
        this.progress[i] = n;
      }
    }
  }
  bindCollectSnowmenTarget(count) {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "collect_snowmen") {
        this.targets[i] = Math.max(0, count);
      }
    }
  }
  syncCollectSnowmen(collected) {
    const n = Math.max(0, collected);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "collect_snowmen") {
        this.progress[i] = n;
      }
    }
  }
  bindCollectPenguinsTarget(count) {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "collect_penguins") {
        this.targets[i] = Math.max(0, count);
      }
    }
  }
  syncCollectPenguins(collected) {
    const n = Math.max(0, collected);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "collect_penguins") {
        this.progress[i] = n;
      }
    }
  }
  bindCollectChicksTarget(count) {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "collect_chicks") {
        this.targets[i] = Math.max(0, count);
      }
    }
  }
  syncCollectChicks(collected) {
    const n = Math.max(0, collected);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "collect_chicks") {
        this.progress[i] = n;
      }
    }
  }
  bindClearVinesTarget(count) {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "clear_vines") {
        this.targets[i] = Math.max(0, count);
      }
    }
  }
  syncClearVines(cleared) {
    const n = Math.max(0, cleared);
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].type === "clear_vines") {
        this.progress[i] = n;
      }
    }
  }
  targetOf(goal) {
    if (goal.type === "score") {
      return goal.score;
    }
    return goal.count;
  }
};

// src/logic/level/LevelVine.ts
var LEVELS_PER_VINE_NODE = 5;
function getActiveVineNode(highestLevelId, totalLevels) {
  const cleared = Math.max(0, Math.min(totalLevels, highestLevelId - 1));
  const focusLevel = Math.min(totalLevels, Math.max(1, highestLevelId));
  let nodeIndex = Math.floor((focusLevel - 1) / LEVELS_PER_VINE_NODE);
  const maxNode = Math.max(0, Math.ceil(totalLevels / LEVELS_PER_VINE_NODE) - 1);
  nodeIndex = Math.min(nodeIndex, maxNode);
  const startLevelId = nodeIndex * LEVELS_PER_VINE_NODE + 1;
  const endLevelId = Math.min(totalLevels, startLevelId + LEVELS_PER_VINE_NODE - 1);
  const levelIds = [];
  for (let id = startLevelId; id <= endLevelId; id += 1) {
    levelIds.push(id);
  }
  const clearedInNode = levelIds.filter((id) => id < highestLevelId).length;
  const unlocked = nodeIndex === 0 || cleared >= nodeIndex * LEVELS_PER_VINE_NODE;
  return {
    nodeIndex,
    startLevelId,
    endLevelId,
    levelIds,
    unlocked,
    clearedInNode
  };
}
function getVineNodeAt(nodeIndex, highestLevelId, totalLevels) {
  const maxNode = Math.max(0, Math.ceil(totalLevels / LEVELS_PER_VINE_NODE) - 1);
  const idx = Math.max(0, Math.min(nodeIndex, maxNode));
  const cleared = Math.max(0, Math.min(totalLevels, highestLevelId - 1));
  const startLevelId = idx * LEVELS_PER_VINE_NODE + 1;
  const endLevelId = Math.min(totalLevels, startLevelId + LEVELS_PER_VINE_NODE - 1);
  const levelIds = [];
  for (let id = startLevelId; id <= endLevelId; id += 1) {
    levelIds.push(id);
  }
  const clearedInNode = levelIds.filter((id) => id < highestLevelId).length;
  const unlocked = idx === 0 || cleared >= idx * LEVELS_PER_VINE_NODE;
  return {
    nodeIndex: idx,
    startLevelId,
    endLevelId,
    levelIds,
    unlocked,
    clearedInNode
  };
}
function vineNodeCount(totalLevels) {
  return Math.max(1, Math.ceil(Math.max(0, totalLevels) / LEVELS_PER_VINE_NODE));
}
function listAllVineNodes(highestLevelId, totalLevels) {
  const count = vineNodeCount(totalLevels);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(getVineNodeAt(i, highestLevelId, totalLevels));
  }
  return out;
}
function isLevelPlayable(levelId, highestLevelId) {
  return levelId >= 1 && levelId <= highestLevelId;
}
function isLevelUnlockedForPlayer(levelId, highestLevelId, totalLevels, previewUnlockAll) {
  if (levelId < 1 || levelId > totalLevels) {
    return false;
  }
  if (previewUnlockAll) {
    return true;
  }
  return isLevelPlayable(levelId, highestLevelId);
}

// src/logic/crush/CrushRewardModel.ts
var CrushRewardModel = class {
  constructor(durationMs, tapPower = 1) {
    this.explosionsQueued = [];
    this.remainingMs = Math.max(0, durationMs);
    this.tapPower = Math.max(0, tapPower);
    this.charge = 0;
    this.crushScore = 0;
    this.tapCount = 0;
  }
  enqueue(burst) {
    this.explosionsQueued.push(burst);
  }
  dequeue() {
    return this.explosionsQueued.shift();
  }
  clearQueue() {
    this.explosionsQueued.length = 0;
  }
  /**
   * 推进倒计时。
   * @returns 是否仍在进行中（未到期）
   */
  tick(dtMs) {
    if (this.remainingMs <= 0) {
      return false;
    }
    this.remainingMs = Math.max(0, this.remainingMs - Math.max(0, dtMs));
    return this.remainingMs > 0;
  }
  extend(ms2) {
    this.remainingMs += Math.max(0, ms2);
  }
  /** 立刻清零剩余时间（如清洁盘面已扫空）。 */
  forceExpire() {
    this.remainingMs = 0;
  }
  isExpired() {
    return this.remainingMs <= 0;
  }
};

// src/logic/crush/CrushResolver.ts
var MAX_BURSTS_PER_TAP = 24;
var CrushResolver = class {
  /**
   * 处理一次点击：以 (row,col) 为圆心爆炸，并结算连锁。
   */
  resolveTap(board, session, row, col) {
    if (!board.inBounds(row, col)) {
      return { clearedIndices: [], clearedKinds: [], fired: [], chained: [] };
    }
    const burst = {
      epicenter: { r: row, c: col },
      radius: Math.max(0, Math.floor(session.tapPower)),
      kind: "tap"
    };
    session.enqueue(burst);
    return this.drainQueue(board, session, MAX_BURSTS_PER_TAP);
  }
  /**
   * 时间到 / 领取奖励：把盘面剩下的小动物全部收尾粉碎并计分。
   * 不必点完；没清完也不卡住，收尾后进结算。
   */
  resolveFinale(board, session, maxBursts) {
    const requested = Math.floor(maxBursts);
    if (!Number.isFinite(requested) || requested <= 0) {
      return { clearedIndices: [], clearedKinds: [], fired: [], chained: [] };
    }
    const limit = Math.max(board.length, requested);
    let queued = 0;
    const radius = Math.max(1, Math.floor(session.tapPower));
    for (let r = 0; r < board.size.rows && queued < limit; r += 1) {
      for (let c = 0; c < board.size.cols && queued < limit; c += 1) {
        const kind = board.getTile(r, c);
        if (kind === 0 /* Empty */ || kind === 8 /* Hole */) {
          continue;
        }
        session.enqueue({
          epicenter: { r, c },
          radius,
          kind: "finale"
        });
        queued += 1;
      }
    }
    if (queued === 0) {
      return { clearedIndices: [], clearedKinds: [], fired: [], chained: [] };
    }
    return this.drainQueue(board, session, limit);
  }
  /**
   * 消费队列中的爆发，直到空或达到上限。
   */
  drainQueue(board, session, maxBursts) {
    const clearedIndices = [];
    const clearedKinds = [];
    const fired = [];
    const seen = /* @__PURE__ */ new Set();
    let processed = 0;
    while (processed < maxBursts) {
      const burst = session.dequeue();
      if (!burst) {
        break;
      }
      processed += 1;
      fired.push(burst);
      const hits = this.collectRadius(board, burst.epicenter.r, burst.epicenter.c, burst.radius);
      for (const index of hits) {
        if (seen.has(index)) {
          continue;
        }
        const kind = board.cells[index];
        if (kind === 0 /* Empty */ || kind === 8 /* Hole */) {
          continue;
        }
        seen.add(index);
        clearedIndices.push(index);
        clearedKinds.push(kind);
        const row = Math.floor(index / board.size.cols);
        const col = index % board.size.cols;
        board.clearTile(row, col);
        if (kind === 6 /* Bomb */) {
          session.enqueue({
            epicenter: { r: row, c: col },
            radius: Math.max(1, burst.radius),
            kind: "chain"
          });
        } else if (kind === 7 /* ColorBomb */) {
          session.enqueue({
            epicenter: { r: row, c: col },
            radius: Math.max(2, burst.radius + 1),
            kind: "chain"
          });
        }
      }
    }
    const chained = session.explosionsQueued.slice();
    return { clearedIndices, clearedKinds, fired, chained };
  }
  /**
   * 切比雪夫距离 ≤ radius 的格子下标（含圆心）。
   */
  collectRadius(board, row, col, radius) {
    const r0 = Math.max(0, row - radius);
    const r1 = Math.min(board.size.rows - 1, row + radius);
    const c0 = Math.max(0, col - radius);
    const c1 = Math.min(board.size.cols - 1, col + radius);
    const out = [];
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const dist = Math.max(Math.abs(r - row), Math.abs(c - col));
        if (dist <= radius) {
          out.push(board.index(r, c));
        }
      }
    }
    return out;
  }
};

// src/logic/fx/MatchPraise.ts
function matchPraiseForScore(score) {
  if (score >= 80) {
    return {
      tier: "excellent",
      word: "\u592A\u68D2\u4E86\uFF01",
      sfxId: "sfx_excellent",
      color: "#ff922b"
    };
  }
  if (score >= 40) {
    return {
      tier: "great",
      word: "\u597D\u723D\uFF01",
      sfxId: "sfx_great",
      color: "#ffe066"
    };
  }
  return {
    tier: "good",
    word: "\u4E0D\u9519\uFF01",
    sfxId: "sfx_good",
    color: "#8ce99a"
  };
}

// src/core/ports/IStorage.ts
var StorageKeys = {
  PlayerProgress: "crush.player.progress",
  Settings: "crush.player.settings",
  AdCooldown: "crush.ad.cooldown",
  DailyLoop: "crush.player.daily",
  Boosters: "crush.player.boosters",
  NoticeSeen: "crush.player.noticeSeen",
  Invite: "crush.player.invite"
};

// src/config/levels.json
var levels_default = [
  {
    id: 1,
    seed: 20250812,
    moves: 12,
    board: { rows: 6, cols: 6 },
    shape: "diamond",
    goals: [{ type: "collect", kind: 1, count: 12 }],
    crushEnabled: true,
    crushDurationMs: 14e3
  },
  {
    id: 2,
    seed: 20250813,
    moves: 13,
    board: { rows: 6, cols: 6 },
    shape: "heart",
    ice: { bottomRows: 1 },
    goals: [
      { type: "collect", kind: 2, count: 12 },
      { type: "clear_ice", count: 6 }
    ],
    crushEnabled: true,
    crushDurationMs: 13e3
  },
  {
    id: 3,
    seed: 20250811,
    moves: 15,
    board: { rows: 6, cols: 6 },
    ice: { bottomRows: 2 },
    goals: [
      { type: "collect", kind: 3, count: 10 },
      { type: "clear_ice", count: 12 }
    ],
    crushEnabled: true,
    crushDurationMs: 12e3
  },
  {
    id: 4,
    seed: 20250814,
    moves: 20,
    board: { rows: 7, cols: 7 },
    ice: { bottomRows: 3 },
    goals: [
      { type: "collect", kind: 4, count: 12 },
      { type: "clear_ice", count: 21 }
    ],
    crushEnabled: true,
    crushDurationMs: 12e3
  },
  {
    id: 5,
    seed: 20250815,
    moves: 18,
    board: { rows: 7, cols: 7 },
    ice: { bottomRows: 4 },
    goals: [
      { type: "collect", kind: 1, count: 14 },
      { type: "clear_ice", count: 28 }
    ],
    crushEnabled: true,
    crushDurationMs: 12e3
  },
  {
    id: 6,
    seed: 20250816,
    moves: 20,
    board: { rows: 7, cols: 7 },
    cloudGems: 8,
    cloudRows: 2,
    goals: [{ type: "collect_gems", count: 8 }],
    crushEnabled: true,
    crushDurationMs: 12e3
  },
  {
    id: 7,
    seed: 20250817,
    moves: 20,
    board: { rows: 7, cols: 7 },
    cloudGems: 10,
    cloudRows: 3,
    starterSpecials: { sparkles: 1 },
    goals: [{ type: "collect_gems", count: 10 }],
    crushEnabled: true,
    crushDurationMs: 11e3
  },
  {
    id: 8,
    seed: 20250818,
    moves: 18,
    board: { rows: 7, cols: 7 },
    shape: "diamond",
    cloudGems: 10,
    cloudRows: 3,
    starterSpecials: { sparkles: 1 },
    goals: [{ type: "collect_gems", count: 10 }],
    crushEnabled: true,
    crushDurationMs: 11e3
  },
  {
    id: 9,
    seed: 20250819,
    moves: 20,
    board: { rows: 8, cols: 8 },
    shape: "plus",
    cloudGems: 8,
    cloudRows: 2,
    starterSpecials: { sparkles: 2 },
    goals: [{ type: "collect_gems", count: 8 }],
    crushEnabled: true,
    crushDurationMs: 11e3
  },
  {
    id: 10,
    seed: 20250820,
    moves: 16,
    board: { rows: 7, cols: 7 },
    cloud: { skipTopRows: 1 },
    cloudGems: 16,
    starterSpecials: { sparkles: 2 },
    goals: [
      { type: "collect_gems", count: 16 },
      { type: "clear_cloud", count: 42 }
    ],
    crushEnabled: true,
    crushDurationMs: 11e3
  },
  {
    id: 11,
    seed: 20250911,
    moves: 22,
    board: { rows: 7, cols: 7 },
    shape: "heart",
    starterSpecials: { owls: 1, sparkles: 3 },
    goals: [
      { type: "collect", kind: 4, count: 14 },
      { type: "collect", kind: 1, count: 12 }
    ],
    crushEnabled: true,
    crushDurationMs: 13e3
  },
  {
    id: 12,
    seed: 20250912,
    moves: 22,
    board: { rows: 8, cols: 8 },
    shape: "plus",
    cloudGems: 8,
    cloudRows: 2,
    starterSpecials: { owls: 1, sparkles: 2 },
    goals: [{ type: "collect_gems", count: 8 }],
    crushEnabled: true,
    crushDurationMs: 12e3
  },
  {
    id: 13,
    seed: 20250913,
    moves: 22,
    board: { rows: 7, cols: 7 },
    shape: "double_ring",
    ice: { bottomRows: 2 },
    starterSpecials: { owls: 1, sparkles: 2 },
    goals: [
      { type: "collect", kind: 3, count: 10 },
      { type: "clear_ice", count: 14 }
    ],
    crushEnabled: true,
    crushDurationMs: 12e3
  },
  {
    id: 14,
    seed: 20250914,
    moves: 18,
    board: { rows: 7, cols: 7 },
    shape: "split_3_4",
    cloudGems: 10,
    cloudRows: 2,
    starterSpecials: { owls: 1, sparkles: 2 },
    goals: [
      { type: "collect_gems", count: 10 },
      { type: "collect", kind: 2, count: 10 }
    ],
    crushEnabled: true,
    crushDurationMs: 11e3
  },
  {
    id: 15,
    seed: 20250915,
    moves: 20,
    board: { rows: 7, cols: 7 },
    shape: "heart",
    ice: { bottomRows: 3 },
    cloudGems: 12,
    cloudRows: 2,
    starterSpecials: { owls: 2, sparkles: 3 },
    goals: [
      { type: "collect_gems", count: 12 },
      { type: "clear_ice", count: 21 }
    ],
    crushEnabled: true,
    crushDurationMs: 13e3
  },
  {
    id: 16,
    seed: 20250916,
    moves: 22,
    board: { rows: 7, cols: 7 },
    ice: { bottomRows: 3 },
    starterSpecials: { owls: 1, sparkles: 2 },
    goals: [
      { type: "collect", kind: 4, count: 10 },
      { type: "clear_ice", count: 21 }
    ],
    crushEnabled: true,
    crushDurationMs: 12e3
  },
  {
    id: 17,
    seed: 20250917,
    moves: 22,
    board: { rows: 7, cols: 7 },
    ice: { skipTopRows: 3 },
    buried: { snowmen: 0, penguins: 2 },
    starterSpecials: { owls: 1, sparkles: 2 },
    goals: [
      { type: "collect_penguins", count: 2 },
      { type: "clear_ice", count: 28 }
    ],
    crushEnabled: true,
    crushDurationMs: 12e3
  },
  {
    id: 18,
    seed: 20250918,
    moves: 20,
    board: { rows: 7, cols: 7 },
    ice: { skipTopRows: 2 },
    iceStyle: "encase",
    buried: { snowmen: 0, penguins: 3 },
    starterSpecials: { owls: 1, sparkles: 2 },
    goals: [
      { type: "collect_penguins", count: 3 },
      { type: "clear_ice", count: 35 }
    ],
    crushEnabled: true,
    crushDurationMs: 11e3
  },
  {
    id: 19,
    seed: 20250919,
    moves: 20,
    board: { rows: 7, cols: 7 },
    shape: "double_ring",
    ice: { skipTopRows: 2 },
    iceStyle: "encase",
    buried: { snowmen: 2, penguins: 2 },
    starterSpecials: { owls: 1, sparkles: 3 },
    goals: [
      { type: "collect_snowmen", count: 2 },
      { type: "collect_penguins", count: 2 },
      { type: "clear_ice", count: 26 }
    ],
    crushEnabled: true,
    crushDurationMs: 11e3
  },
  {
    id: 20,
    seed: 20250920,
    moves: 20,
    board: { rows: 7, cols: 7 },
    shape: "hourglass",
    ice: { skipTopRows: 1 },
    iceStyle: "encase",
    cloudGems: 8,
    cloudRows: 2,
    buried: { snowmen: 2, penguins: 4 },
    starterSpecials: { owls: 2, sparkles: 4 },
    goals: [
      { type: "collect_gems", count: 8 },
      { type: "collect_penguins", count: 4 },
      { type: "clear_ice", count: 28 }
    ],
    crushEnabled: true,
    crushDurationMs: 14e3
  }
];

// src/config/ad-placements.json
var ad_placements_default = {
  rewarded_revive: {
    adUnitId: "adunit-b45fc692f54f6086",
    maxPerLevel: 0
  },
  rewarded_crush_extend: {
    adUnitId: "adunit-8cc66b74ed456e3a",
    extraMs: 5e3
  },
  interstitial_settle: {
    adUnitId: "adunit-dd3dd998375e3c09",
    everyNLevels: 2,
    cooldownSeconds: 60
  },
  interstitial_launch: {
    enabled: true,
    delayMs: 2500,
    retryMs: 2500,
    timeoutMs: 45e3
  },
  banner_lobby: {
    adUnitId: "adunit-8f450e80c0ee8f6d",
    enabled: true
  }
};

// src/config/balance.json
var balance_default = {
  reviveMovesGranted: 5,
  crushDefaultTapPower: 1,
  crushFinaleMaxBursts: 64,
  cleanScoreThreshold: 1500,
  cleanDurationMs: 2e4
};

// src/config/items.json
var items_default = {
  extraMoves: {
    moves: 5
  }
};

// src/services/GameSession.ts
var GameSession = class {
  constructor(deps) {
    this.deps = deps;
    this.finder = new MatchFinder();
    this.resolver = new MatchResolver(new MatchFinder());
    this.validator = new MoveValidator(new MatchFinder());
    this.crushResolver = new CrushResolver();
    /** 上次成功弹出通关插屏的时间，配合冷却避免连关连弹 */
    this.lastInterstitialMs = 0;
    this.interstitialShowing = false;
    /** 本次冷启动是否已尝试过进大厅插屏 */
    this.launchInterstitialTried = false;
    this.boosters = new BoosterInventory();
    this.daily = { ...EMPTY_DAILY_LOOP };
    this.dailyGrantPending = false;
    this.invite = { ...EMPTY_INVITE_STATE };
    this.inviteToast = null;
    this.claimingInvite = false;
    this.seenNoticeIds = /* @__PURE__ */ new Set();
    this.extraMovesGrant = items_default.extraMoves.moves;
    this.board = null;
    this.level = null;
    this.goals = null;
    this.movesLeft = 0;
    this.score = 0;
    /** 交换手势里已播过本波第一档赞赏音，避免消除动画再播一次 */
    this.firstWavePraisePlayed = false;
    this.crush = null;
    /** 清洁小游戏会话（与粉碎加成分离） */
    this.clean = null;
    /** 本局结算是否已用过一次清洁机会 */
    this.cleaningUsedThisSettle = false;
    /** 当前结算是否来自通关（失败确认进结算则不弹通关插屏） */
    this.lastSettleWon = false;
    /** 通关后待执行的剩余步数加成（开心消消乐式） */
    this.pendingMovesBonus = false;
    /** 已经通知过「整只露出」的埋藏组，避免每波重复播。 */
    this.buriedNotified = /* @__PURE__ */ new Set();
    /** 云档拉过之后才允许回写，避免清缓存时空档盖掉微信用户进度。 */
    this.cloudHydrated = false;
    this.cloudPushInFlight = false;
    this.cloudPushQueued = false;
    this.iceAtStart = 0;
    this.gemsAtStart = 0;
    this.cloudsAtStart = 0;
    this.eggsAtStart = 0;
    this.vinesAtStart = 0;
    this.crushFinaleMaxBursts = typeof balance_default.crushFinaleMaxBursts === "number" ? balance_default.crushFinaleMaxBursts : 16;
    this.crushTapPower = typeof balance_default.crushDefaultTapPower === "number" ? balance_default.crushDefaultTapPower : 1;
    this.cleanScoreThreshold = typeof balance_default.cleanScoreThreshold === "number" ? balance_default.cleanScoreThreshold : 1500;
    this.cleanDurationMs = typeof balance_default.cleanDurationMs === "number" ? balance_default.cleanDurationMs : 2e4;
    /** 测试或运行时可覆盖的关卡表 */
    this.levelTable = levels_default;
    /** 实例方法，避免打包漏掉原型函数导致启动 TypeError。 */
    this.retryClaimInvite = async () => {
      if (this.claimingInvite) {
        return;
      }
      if (!this.invite.pendingInviter || this.invite.cloudClaimed || !this.invite.inviteeGiftGranted) {
        return;
      }
      const cloud = this.deps.cloudSave;
      if (!cloud?.claimInvite) {
        return;
      }
      this.claimingInvite = true;
      try {
        const result = await cloud.claimInvite(this.invite.pendingInviter);
        if (result.ok) {
          this.invite = { ...this.invite, cloudClaimed: true };
          this.deps.analytics.track("invite_claim", {
            inviter: this.invite.pendingInviter
          });
          await this.persistInvite();
        }
      } catch {
      } finally {
        this.claimingInvite = false;
      }
    };
    this.fsm = new GameStateMachine("Boot");
    this.events = new GameEventBus();
    this.progress = new LevelProgress();
    const movesGranted = typeof balance_default.reviveMovesGranted === "number" ? balance_default.reviveMovesGranted : 5;
    this.revivePolicy = new RevivePolicy({
      maxRevivesPerLevel: Number.POSITIVE_INFINITY,
      movesGranted
    });
    this.adPolicy = new AdPlacementPolicy({
      offerReviveOnFail: true,
      interstitialEveryNLevels: ad_placements_default.interstitial_settle.everyNLevels ?? 2
    });
    this.fsm.subscribe((from, to) => {
      this.events.emit({ type: "StateChanged", from, to });
    });
  }
  /**
   * 初始化会话：读档并进入大厅。
   */
  async init() {
    let saved = null;
    let readOk = false;
    try {
      saved = await this.deps.storage.get(StorageKeys.PlayerProgress);
      readOk = true;
    } catch {
    }
    if (readOk && saved) {
      this.progress.load(normalizeLevelProgressData(saved));
    }
    const settings = await this.deps.storage.get(StorageKeys.Settings);
    if (settings && typeof settings.muted === "boolean") {
      this.deps.audio.setMuted(settings.muted);
    }
    const savedDaily = await this.deps.storage.get(StorageKeys.DailyLoop);
    const daily = applyDailyLogin(savedDaily, Date.now());
    this.daily = daily.data;
    this.dailyGrantPending = daily.grantedHammer;
    const savedWallet = await this.deps.storage.get(StorageKeys.Boosters);
    this.boosters.loadStock(clampBoosterWallet(savedWallet ?? EMPTY_BOOSTER_WALLET));
    const savedInvite = await this.deps.storage.get(StorageKeys.Invite);
    this.invite = ensureInviteCode(parseInviteState(savedInvite));
    const savedNotices = await this.deps.storage.get(StorageKeys.NoticeSeen);
    this.seenNoticeIds = new Set(
      Array.isArray(savedNotices) ? savedNotices.filter((id) => typeof id === "string" && id.length > 0) : []
    );
    if (daily.grantedHammer) {
      this.boosters.loadStock(addBoosterToWallet(this.boosters.getStock(), "hammer", 1));
      this.daily = { ...this.daily, bonusHammer: 0 };
    }
    if (daily.grantedHammer || !savedDaily || savedWallet) {
      await this.deps.storage.set(StorageKeys.DailyLoop, this.daily);
      await this.deps.storage.set(
        StorageKeys.Boosters,
        clampBoosterWallet(this.boosters.getStock())
      );
    }
    if (isWxDesktopIdeHost()) {
      this.cloudHydrated = true;
    } else {
      await this.syncCloudSave();
    }
    this.bindInviteFromQuery(this.deps.platform.getLaunchQuery?.() ?? {});
    await this.persistInvite();
    void this.retryClaimInvite();
    if (readOk) {
      await this.deps.storage.set(StorageKeys.PlayerProgress, this.progress.getData());
    }
    this.deps.analytics.track("app_boot");
    this.fsm.transitionTo("Lobby");
  }
  /**
   * 覆盖关卡表（单测注入短关卡用）。
   * @param levels - 关卡配置列表
   */
  setLevelTable(levels2) {
    this.levelTable = levels2.slice();
  }
  /**
   * 开始指定关卡。
   * @param levelId - 关卡 id
   */
  async startLevel(levelId) {
    const config = this.findLevelConfig(levelId);
    await this.startLevelWithConfig(config);
  }
  /**
   * 使用完整配置开局（供测试或动态关卡）。
   * @param config - 关卡配置
   */
  async startLevelWithConfig(config) {
    const from = this.fsm.getCurrent();
    if (from === "Boot") {
      this.fsm.transitionTo("Lobby");
    }
    if (!this.fsm.transitionTo("LoadingLevel")) {
      throw new Error(`Cannot start level from state: ${this.fsm.getCurrent()}`);
    }
    this.level = config;
    this.goals = new LevelGoals(config.goals);
    this.movesLeft = config.moves;
    this.score = 0;
    this.crush = null;
    this.clean = null;
    this.cleaningUsedThisSettle = false;
    this.pendingMovesBonus = false;
    this.buriedNotified.clear();
    this.revivePolicy.resetForLevel();
    this.revivePolicy.setMaxPerLevel(Number.POSITIVE_INFINITY);
    this.board = new BoardModel(config.board);
    applyBoardShape(this.board, config.shape);
    generatePlayableBoard(this.board, config.seed);
    this.iceAtStart = 0;
    this.gemsAtStart = 0;
    this.cloudsAtStart = 0;
    this.eggsAtStart = 0;
    this.vinesAtStart = 0;
    if (config.ice === "all") {
      this.iceAtStart = this.board.coverPlayableWithIce();
    } else if (config.ice && typeof config.ice === "object" && "skipTopRows" in config.ice) {
      this.iceAtStart = this.board.coverPlayableSkippingTopRows(config.ice.skipTopRows);
    } else if (config.ice && typeof config.ice === "object" && "bottomRows" in config.ice) {
      this.iceAtStart = this.board.coverBottomRowsWithIce(config.ice.bottomRows);
    }
    this.board.iceLocksTiles = config.iceStyle === "encase";
    shuffleUntilPlayable(this.board, config.seed + 99);
    this.stabilizeBoard({ animate: false });
    if (config.buried) {
      const skipTop = config.ice && typeof config.ice === "object" && "skipTopRows" in config.ice ? config.ice.skipTopRows : 0;
      const placed = this.board.placeBuried(
        config.buried.snowmen,
        config.buried.penguins,
        config.seed + 17,
        { skipTopRows: skipTop, requireIce: true }
      );
      this.goals.bindCollectSnowmenTarget(placed.snowmen);
      this.goals.bindCollectPenguinsTarget(placed.penguins);
    }
    if (this.iceAtStart > 0) {
      this.iceAtStart = this.board.countIce();
      this.goals.bindClearIceTarget(this.iceAtStart);
    }
    if (typeof config.cloudGems === "number" && config.cloudGems > 0) {
      this.gemsAtStart = this.board.placeGemsFromBottom(config.cloudGems);
      this.goals.bindCollectGemsTarget(this.gemsAtStart);
    }
    if (config.cloud === "all") {
      this.cloudsAtStart = this.board.coverPlayableWithCloud();
    } else if (config.cloud && typeof config.cloud === "object" && "skipTopRows" in config.cloud) {
      this.cloudsAtStart = this.board.coverPlayableSkippingTopRowsWithCloud(config.cloud.skipTopRows);
    } else if (config.cloud && typeof config.cloud === "object" && "bottomRows" in config.cloud) {
      this.cloudsAtStart = this.board.coverBottomRowsWithCloud(config.cloud.bottomRows);
    } else if (typeof config.cloudRows === "number" && config.cloudRows > 0) {
      this.cloudsAtStart = this.board.coverBottomRowsWithCloud(config.cloudRows);
    }
    if (this.cloudsAtStart > 0) {
      this.goals.bindClearCloudTarget(this.cloudsAtStart);
    }
    if (config.eggs) {
      this.eggsAtStart = this.board.placeEggs(
        config.eggs.count,
        config.eggs.layers ?? 1,
        config.seed + 31
      );
      this.goals.bindCollectChicksTarget(this.eggsAtStart);
    }
    if (config.vines) {
      this.vinesAtStart = this.board.placeVines(config.vines, config.seed + 47);
      this.goals.bindClearVinesTarget(this.vinesAtStart);
    }
    if (this.cloudsAtStart > 0 || this.eggsAtStart > 0 || this.vinesAtStart > 0) {
      this.shuffleAroundCloudLocks(config.seed);
    }
    if (config.starterSpecials) {
      this.board.placeStarterSpecials(config.starterSpecials, config.seed + 61);
    }
    this.lastSettleWon = false;
    this.deps.analytics.track("level_start", { levelId: config.id });
    void this.deps.ads.load("rewarded_revive");
    this.fsm.transitionTo("PlayerInput");
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    this.emitGoalProgress();
  }
  getBoard() {
    return this.board;
  }
  getLevelConfig() {
    return this.level;
  }
  getGoals() {
    return this.goals;
  }
  getMovesLeft() {
    return this.movesLeft;
  }
  /** 当前关卡剩余道具数量 */
  getBoosterStock() {
    return this.boosters.getStock();
  }
  getBoosterCount(id) {
    return this.boosters.getCount(id);
  }
  getDailyLoop() {
    return { ...this.daily };
  }
  getInviteState() {
    return { ...this.invite };
  }
  getInviteCode() {
    return this.invite.code;
  }
  /** 从分享卡片绑定邀请人；仅新用户且非自己。 */
  bindInviteFromQuery(query) {
    const prev = this.invite.pendingInviter;
    this.invite = bindPendingInviter(
      this.invite,
      parseInviterFromQuery(query),
      isFreshPlayer(this.progress.getData())
    );
    if (this.invite.pendingInviter && this.invite.pendingInviter !== prev) {
      this.deps.analytics.track("invite_bind", {
        inviter: this.invite.pendingInviter
      });
      void this.persistInvite();
      return true;
    }
    return false;
  }
  /** 大厅弹出邀请锤子到账一次。 */
  takeInviteToast() {
    const text = this.inviteToast;
    this.inviteToast = null;
    return text;
  }
  hasSeenNotice(id) {
    return this.seenNoticeIds.has(id);
  }
  async markNoticeSeen(id) {
    if (!id || this.seenNoticeIds.has(id)) {
      return;
    }
    this.seenNoticeIds.add(id);
    await this.deps.storage.set(StorageKeys.NoticeSeen, [...this.seenNoticeIds]);
  }
  /** 大厅弹出「今日登录 +1 锤子」一次。 */
  takeDailyGrantToast() {
    if (!this.dailyGrantPending) {
      return false;
    }
    this.dailyGrantPending = false;
    return true;
  }
  async persistDaily() {
    await this.deps.storage.set(StorageKeys.DailyLoop, this.daily);
    this.queueCloudPush();
  }
  async persistBoosters() {
    await this.deps.storage.set(StorageKeys.Boosters, clampBoosterWallet(this.boosters.getStock()));
    this.queueCloudPush();
  }
  async persistInvite() {
    await this.deps.storage.set(StorageKeys.Invite, this.invite);
    this.queueCloudPush();
  }
  persistProgress() {
    void this.deps.storage.set(StorageKeys.PlayerProgress, this.progress.getData()).then(() => {
      this.queueCloudPush();
    });
  }
  captureCloudSnapshot() {
    return {
      updatedAt: Date.now(),
      progress: this.progress.getData(),
      boosters: clampBoosterWallet(this.boosters.getStock()),
      settings: { muted: this.deps.audio.isMuted() },
      daily: { ...this.daily },
      invite: toInviteCloudSlice(this.invite)
    };
  }
  queueCloudPush() {
    if (!this.cloudHydrated || !this.deps.cloudSave?.isEnabled()) {
      return;
    }
    if (this.cloudPushInFlight) {
      this.cloudPushQueued = true;
      return;
    }
    void this.flushCloudPush();
  }
  async flushCloudPush() {
    const cloud = this.deps.cloudSave;
    if (!this.cloudHydrated || !cloud?.isEnabled()) {
      return;
    }
    this.cloudPushInFlight = true;
    try {
      do {
        this.cloudPushQueued = false;
        await cloud.push(this.captureCloudSnapshot());
      } while (this.cloudPushQueued);
    } catch {
    } finally {
      this.cloudPushInFlight = false;
      if (this.cloudPushQueued) {
        void this.flushCloudPush();
      }
    }
  }
  /** 用当前微信用户的云档和本地档合并：清缓存、换机、升版本都续关。 */
  async syncCloudSave() {
    const cloud = this.deps.cloudSave;
    if (!cloud?.isEnabled()) {
      this.cloudHydrated = true;
      return;
    }
    try {
      const remote = await cloud.pull();
      const merged = mergePlayerCloudSnapshots(this.captureCloudSnapshot(), remote);
      this.progress.load(merged.progress);
      this.boosters.loadStock(clampBoosterWallet(merged.boosters));
      const daily = applyDailyLogin(merged.daily, Date.now());
      this.daily = daily.data;
      if (daily.grantedHammer) {
        this.boosters.loadStock(addBoosterToWallet(this.boosters.getStock(), "hammer", 1));
        this.daily = { ...this.daily, bonusHammer: 0 };
        this.dailyGrantPending = true;
      }
      if (typeof merged.settings.muted === "boolean") {
        this.deps.audio.setMuted(merged.settings.muted);
      }
      this.invite = hydrateInviteFromCloud(this.invite, merged.invite);
      const credited = applyInviteCredit(this.invite, merged.invite?.creditHammer ?? 0);
      this.invite = credited.state;
      if (credited.granted > 0) {
        this.boosters.loadStock(addInviteHammers(this.boosters.getStock(), credited.granted));
        this.inviteToast = credited.granted === 1 ? "\u597D\u53CB\u901A\u5173\u4E86\uFF0C\u4F60\u4E5F +1 \u9524\u5B50" : `\u597D\u53CB\u901A\u5173\u4E86\uFF0C\u4F60 +${credited.granted} \u9524\u5B50`;
      }
      await this.deps.storage.set(StorageKeys.PlayerProgress, this.progress.getData());
      await this.deps.storage.set(StorageKeys.Boosters, this.boosters.getStock());
      await this.deps.storage.set(StorageKeys.DailyLoop, this.daily);
      await this.deps.storage.set(StorageKeys.Settings, merged.settings);
      await this.deps.storage.set(StorageKeys.Invite, this.invite);
      this.cloudHydrated = true;
      await this.flushCloudPush();
    } catch {
      this.cloudHydrated = false;
    }
  }
  noteDailyClear() {
    this.daily = recordDailyClear(this.daily, Date.now());
    if (this.daily.clearsToday >= DAILY_GOAL_CLEARS && !this.daily.playShuffleGranted) {
      this.boosters.add("shuffle", 1);
      this.daily = { ...this.daily, playShuffleGranted: true };
    }
    if (this.movesLeft >= LEFTOVER_MOVES_FOR_EXTRA && !this.daily.playExtraGranted) {
      this.boosters.add("extraMoves", 1);
      this.daily = { ...this.daily, playExtraGranted: true };
    }
    this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
    void this.persistDaily();
    void this.persistBoosters();
  }
  commitLevelCleared() {
    if (!this.level) {
      return;
    }
    const firstClear = isFreshPlayer(this.progress.getData());
    this.progress.markLevelCleared(this.level.id, this.score);
    this.noteDailyClear();
    if (firstClear) {
      this.noteInviteFirstClear();
    }
    this.persistProgress();
  }
  noteInviteFirstClear() {
    const gift = grantInviteeGift(this.invite);
    this.invite = gift.state;
    if (gift.granted > 0) {
      this.boosters.loadStock(addInviteHammers(this.boosters.getStock(), gift.granted));
      this.inviteToast = "\u9080\u8BF7\u793C\u5230\u8D26 +1 \u9524\u5B50";
      this.deps.analytics.track("invite_gift", { hammers: gift.granted });
      this.events.emit({
        type: "InviteReward",
        kind: "invitee",
        hammers: gift.granted
      });
      void this.persistBoosters();
    }
    void this.persistInvite();
    void this.retryClaimInvite();
  }
  /**
   * 锤子：清除一格并连锁下落（不消耗步数）。
   */
  useHammer(row, col) {
    if (this.fsm.getCurrent() !== "PlayerInput" || !this.board || !this.level || !this.goals) {
      return false;
    }
    if (!this.boosters.canUse("hammer")) {
      return false;
    }
    if (!this.board.inBounds(row, col) || this.board.getTile(row, col) === 0 /* Empty */) {
      return false;
    }
    if (this.board.getTile(row, col) === 8 /* Hole */) {
      return false;
    }
    this.fsm.transitionTo("Resolving");
    if (!this.boosters.consume("hammer")) {
      this.fsm.transitionTo("PlayerInput");
      return false;
    }
    void this.persistBoosters();
    const clear = /* @__PURE__ */ new Set([this.board.index(row, col)]);
    const kind = this.board.getTile(row, col);
    if (kind === 7 /* ColorBomb */) {
      let targetKind = null;
      for (let i = 0; i < this.board.length; i += 1) {
        const k = this.board.cells[i];
        if (isBasicTile(k)) {
          targetKind = k;
          break;
        }
      }
      if (targetKind !== null) {
        for (let i = 0; i < this.board.length; i += 1) {
          if (this.board.cells[i] === targetKind) {
            clear.add(i);
          }
        }
      }
    } else if (kind === 6 /* Bomb */ || this.board.isSparkle(row, col)) {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const rr = row + dr;
          const cc = col + dc;
          if (!this.board.inBounds(rr, cc)) {
            continue;
          }
          if (this.board.getTile(rr, cc) === 0 /* Empty */) {
            continue;
          }
          clear.add(this.board.index(rr, cc));
        }
      }
    }
    expandSparkleBlasts(this.board, clear);
    const clearIndices = [...clear];
    const firstKinds = clearIndices.map(
      (index) => this.board.cells[index]
    );
    const playback = this.capturePlaybackSnapshot();
    this.playSfx("sfx_hammer");
    this.events.emit({
      type: "BoosterUsed",
      boosterId: "hammer",
      remaining: this.boosters.getCount("hammer"),
      row,
      col
    });
    this.events.emit({ type: "TilesCleared", indices: clearIndices, kinds: firstKinds });
    const emptyMatches = this.finder.findMatches(this.board);
    emptyMatches.size = 0;
    const result = this.resolver.resolve(this.board, emptyMatches, {
      seed: this.level.seed + this.board.version + 31,
      initialClearIndices: clearIndices,
      spawnSpecials: false
    });
    this.events.emit({
      type: "ResolvePlayback",
      ...playback,
      waves: result.waves
    });
    this.score += result.cleared * 10;
    this.goals.applyClearedKinds(result.clearedKinds);
    this.goals.syncScore(this.score);
    this.emitGoalProgress();
    this.events.emit({ type: "CascadeDone", depth: result.cascadeDepth });
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    this.evaluateLevelOutcome();
    return true;
  }
  /**
   * 重排：强制洗牌刷新盘面，直到有合法步（不消耗步数）。
   */
  useShuffle() {
    if (this.fsm.getCurrent() !== "PlayerInput" || !this.board || !this.level) {
      return false;
    }
    if (!this.boosters.consume("shuffle")) {
      return false;
    }
    void this.persistBoosters();
    const ok = shuffleUntilPlayable(
      this.board,
      this.level.seed + this.board.version + 777,
      48,
      true
    );
    this.playSfx("sfx_shuffle");
    this.events.emit({
      type: "BoosterUsed",
      boosterId: "shuffle",
      remaining: this.boosters.getCount("shuffle")
    });
    if (ok) {
      this.events.emit({ type: "BoardShuffled", reason: "booster" });
    }
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    this.stabilizeBoard({ animate: true });
    return true;
  }
  /**
   * 加步：增加若干步数。
   */
  useExtraMoves() {
    if (this.fsm.getCurrent() !== "PlayerInput" || !this.level) {
      return false;
    }
    if (!this.boosters.consume("extraMoves")) {
      return false;
    }
    void this.persistBoosters();
    this.movesLeft += this.extraMovesGrant;
    this.playSfx("sfx_extra");
    this.events.emit({
      type: "BoosterUsed",
      boosterId: "extraMoves",
      remaining: this.boosters.getCount("extraMoves"),
      movesGranted: this.extraMovesGrant
    });
    return true;
  }
  allowsRewardedBooster(_id) {
    return this.fsm.getCurrent() === "PlayerInput" && !!this.level;
  }
  allowsRewardedExtraMoves() {
    return this.allowsRewardedBooster("extraMoves");
  }
  /**
   * 库存为 0 时看广告：锤子/重排 +1 入包；加步立刻 +5。次数不限，看完就发。
   */
  async watchAdForBooster(id) {
    if (!this.allowsRewardedBooster(id)) {
      return "unavailable";
    }
    this.deps.analytics.track("ad_show", {
      placement: "rewarded_revive",
      levelId: this.level.id,
      reason: `booster_${id}`
    });
    const result = await this.deps.ads.show("rewarded_revive");
    if (result === "completed") {
      if (id === "extraMoves") {
        this.movesLeft += this.extraMovesGrant;
        this.playSfx("sfx_extra");
      } else if (id === "shuffle") {
        this.boosters.add("shuffle", 1);
        this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
        this.useShuffle();
      } else {
        this.boosters.add(id, 1);
        this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
        void this.persistBoosters();
        this.playSfx("sfx_hammer");
      }
      this.daily = { ...this.daily, ...bumpBoosterAd(this.daily, id) };
      void this.persistDaily();
      this.deps.analytics.track("ad_complete", {
        placement: "rewarded_revive",
        reason: `booster_${id}`
      });
      if (id === "extraMoves") {
        this.events.emit({
          type: "BoosterUsed",
          boosterId: id,
          remaining: this.boosters.getCount(id),
          movesGranted: this.extraMovesGrant
        });
      }
      return "revived";
    }
    if (result === "skipped") {
      return "skipped";
    }
    return result === "not_ready" ? "unavailable" : "error";
  }
  /**
   * 对局中看广告加 5 步（与失败复活同一激励广告位）。
   */
  async watchAdToAddMoves() {
    return this.watchAdForBooster("extraMoves");
  }
  setMuted(muted) {
    this.deps.audio.setMuted(muted);
    void this.deps.storage.set(StorageKeys.Settings, { muted });
    this.queueCloudPush();
  }
  isMuted() {
    return this.deps.audio.isMuted();
  }
  /** 启动循环背景音乐（可重复调用，适配器内幂等） */
  startBgm() {
    this.deps.audio.play("bgm_main", { loop: true, volume: 0.55 });
  }
  suspendForBackground() {
    this.deps.audio.suspendForBackground?.();
  }
  resumeFromBackground() {
    this.deps.audio.resumeFromBackground?.();
  }
  /** 首次触摸时预加载短音效，避免消除飘字时音效尚未就绪 */
  preloadSfx() {
    this.deps.audio.preloadSfx?.();
  }
  /** 表现层按钮点击等短音效 */
  playUiSfx() {
    this.playSfx("sfx_ui");
  }
  /** 消除 / 连锁音效（表现层波次回调用） */
  playMatchSfx() {
    this.playSfx("sfx_match");
  }
  /** 按本波分值播放 Good / Great / Excellent */
  playMatchPraiseSfx(score) {
    this.playSfx(matchPraiseForScore(score).sfxId, 1);
  }
  /** 停掉未播完的赞赏音，避免通关残留音效在粉碎关里才响 */
  stopMatchPraiseSfx() {
    this.deps.audio.stop("sfx_good");
    this.deps.audio.stop("sfx_great");
    this.deps.audio.stop("sfx_excellent");
  }
  /** 交换时已在手势里播过第一波，消除飘字阶段应跳过 */
  takeFirstWavePraiseAlreadyPlayed() {
    const played = this.firstWavePraisePlayed;
    this.firstWavePraisePlayed = false;
    return played;
  }
  /** 过关结算打开时再播胜利音，和庆祝动画对齐 */
  playWinSfx() {
    this.playSfx("sfx_win");
  }
  playSfx(clipId, volume) {
    this.deps.audio.play(clipId, volume === void 0 ? void 0 : { volume });
  }
  getScore() {
    return this.score;
  }
  /** 全部关卡配置（只读） */
  getLevelTable() {
    return this.levelTable;
  }
  getLevelCount() {
    return this.levelTable.length;
  }
  getBestScore(levelId) {
    return this.progress.getBestScore(levelId);
  }
  isLevelUnlocked(levelId) {
    return isLevelUnlockedForPlayer(
      levelId,
      this.progress.getHighestLevelId(),
      this.levelTable.length,
      shouldUnlockAllLevelsForPreview()
    );
  }
  /** 开发版 / 体验版：大厅可点任意关预览效果。 */
  isPreviewUnlockAll() {
    return shouldUnlockAllLevelsForPreview();
  }
  isLevelCleared(levelId) {
    return this.progress.isLevelCleared(levelId);
  }
  /** 大厅藤蔓：当前节点的 5 关（兼容旧逻辑） */
  getVineNode() {
    return getActiveVineNode(
      this.progress.getHighestLevelId(),
      this.levelTable.length
    );
  }
  /** 大厅地图：配置表里的每一段都展示，未解锁也能上滑看到。 */
  listLobbyVineNodes() {
    return listAllVineNodes(
      this.progress.getHighestLevelId(),
      this.levelTable.length
    );
  }
  /**
   * 仅供单测：覆盖当前总分（用于清洁门槛等断言）。
   */
  forceScoreForTest(score) {
    this.score = Math.max(0, Math.floor(score));
  }
  /**
   * 当前粉碎奖励会话（未开启时为 null）。
   */
  getCrushSession() {
    return this.crush;
  }
  /**
   * 粉碎加成分（未开启为 0）。
   */
  getCrushScore() {
    return this.crush?.crushScore ?? 0;
  }
  /**
   * 本局粉碎点击次数。
   */
  getCrushTapCount() {
    return this.crush?.tapCount ?? 0;
  }
  /**
   * 清洁小游戏门槛分。
   */
  getCleanScoreThreshold() {
    return this.cleanScoreThreshold;
  }
  /**
   * 清洁小游戏时长（毫秒）。
   */
  getCleanDurationMs() {
    return this.cleanDurationMs;
  }
  /**
   * 当前是否可询问「进入清洁模式」（通关结算且总分达标，本关仅一次）。
   */
  canOfferCleaning() {
    return this.fsm.getCurrent() === "Settle" && !this.cleaningUsedThisSettle && this.score >= this.cleanScoreThreshold;
  }
  /**
   * 清洁模式会话。
   */
  getCleanSession() {
    return this.clean;
  }
  /**
   * 开始清洁小游戏：刷新盘面，限时点击清扫（不计主线胜负压力）。
   */
  startCleaningMode() {
    if (!this.canOfferCleaning() || !this.board || !this.level) {
      return false;
    }
    if (!this.fsm.transitionTo("Cleaning")) {
      return false;
    }
    this.cleaningUsedThisSettle = true;
    generatePlayableBoard(this.board, this.level.seed + 7777 + this.level.id);
    this.clean = new CrushRewardModel(this.cleanDurationMs, Math.max(1, this.crushTapPower));
    this.deps.analytics.track("crush_start", {
      levelId: this.level.id,
      mode: "cleaning"
    });
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    return true;
  }
  /**
   * 结算时拒绝进入清洁模式（本关机会作废，不再弹窗）。
   */
  declineCleaningOffer() {
    if (!this.canOfferCleaning()) {
      return false;
    }
    this.cleaningUsedThisSettle = true;
    return true;
  }
  /**
   * 结束清洁模式，回到结算。
   */
  finishCleaningMode() {
    if (this.fsm.getCurrent() !== "Cleaning") {
      return false;
    }
    this.deps.analytics.track("crush_end", {
      levelId: this.level?.id ?? 0,
      mode: "cleaning",
      tapCount: this.clean?.tapCount ?? 0,
      cleanScore: this.clean?.crushScore ?? 0
    });
    this.events.emit({
      type: "CleaningEnded",
      cleanScore: this.clean?.crushScore ?? 0,
      tapCount: this.clean?.tapCount ?? 0
    });
    this.clean = null;
    return this.fsm.transitionTo("Settle");
  }
  /**
   * 是否还有下一关配置。
   */
  hasNextLevel() {
    if (!this.level) {
      return false;
    }
    return this.levelTable.some((item) => item.id === this.level.id + 1);
  }
  /**
   * 尝试交换两格并结算；结束后按目标与步数更新 FSM。
   */
  trySwap(rowA, colA, rowB, colB) {
    if (this.fsm.getCurrent() !== "PlayerInput" || !this.board || !this.level || !this.goals) {
      return false;
    }
    if (!this.validator.canSwap(this.board, rowA, colA, rowB, colB)) {
      this.events.emit({ type: "SwapRejected", rowA, colA, rowB, colB });
      return false;
    }
    this.fsm.transitionTo("Resolving");
    this.board.swap(rowA, colA, rowB, colB);
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.playSfx("sfx_swap");
    this.events.emit({ type: "SwapAccepted", rowA, colA, rowB, colB });
    const matches = this.finder.findMatches(this.board);
    const baseIndices = [];
    for (let i = 0; i < matches.size; i += 1) {
      baseIndices.push(matches.indices[i]);
    }
    const kindA = this.board.getTile(rowA, colA);
    const kindB = this.board.getTile(rowB, colB);
    const sparkleCombo = this.board.isSparkle(rowA, colA) && this.board.isSparkle(rowB, colB);
    const specialMove = kindA === 7 /* ColorBomb */ || kindB === 7 /* ColorBomb */ || isSpecialTile(kindA) && isSpecialTile(kindB) || sparkleCombo;
    const clearIndices = expandSpecialClears(
      this.board,
      rowA,
      colA,
      rowB,
      colB,
      baseIndices
    );
    if (clearIndices.length === 0 && !specialMove) {
      this.board.swap(rowA, colA, rowB, colB);
      this.movesLeft += 1;
      this.fsm.transitionTo("PlayerInput");
      this.events.emit({ type: "SwapRejected", rowA, colA, rowB, colB });
      return false;
    }
    if (clearIndices.length > 0) {
      this.playMatchPraiseSfx(Math.max(30, clearIndices.length * 10));
      this.firstWavePraisePlayed = true;
    }
    const firstKinds = clearIndices.map(
      (index) => this.board.cells[index]
    );
    const playback = this.capturePlaybackSnapshot();
    this.events.emit({
      type: "TilesCleared",
      indices: clearIndices,
      kinds: firstKinds
    });
    const preferredSpawnRow = rowB;
    const preferredSpawnCol = colB;
    const result = this.resolver.resolve(this.board, matches, {
      seed: this.level.seed + this.board.version,
      preferredSpawnRow,
      preferredSpawnCol,
      initialClearIndices: clearIndices,
      spawnSpecials: !(kindA === 7 /* ColorBomb */ || kindB === 7 /* ColorBomb */)
    });
    this.events.emit({
      type: "ResolvePlayback",
      ...playback,
      waves: result.waves
    });
    this.score += result.cleared * 10;
    this.goals.applyClearedKinds(result.clearedKinds);
    this.goals.syncScore(this.score);
    this.emitGoalProgress();
    if (result.fell.length > 0) {
      this.events.emit({
        type: "TilesFell",
        moves: result.fell.map((f) => ({
          tileId: f.tileId,
          fromRow: f.fromRow,
          toRow: f.toRow,
          col: f.col
        }))
      });
    }
    if (result.spawned.length > 0) {
      this.events.emit({
        type: "TilesSpawned",
        indices: result.spawned.map((s) => this.board.index(s.row, s.col)),
        tileIds: result.spawned.map((s) => s.tileId),
        kinds: result.spawned.map((s) => s.kind)
      });
    }
    this.events.emit({ type: "CascadeDone", depth: result.cascadeDepth });
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    this.evaluateLevelOutcome();
    return true;
  }
  /**
   * 粉碎奖励 / 清洁模式：点击格子触发爆炸。
   * @returns 是否成功触发（状态/坐标非法时 false）
   */
  tryCrushTap(row, col) {
    const state = this.fsm.getCurrent();
    const burst = state === "CrushReward" ? this.crush : state === "Cleaning" ? this.clean : null;
    if (!this.board || !burst) {
      return false;
    }
    if (burst.isExpired()) {
      return false;
    }
    if (!this.board.inBounds(row, col)) {
      return false;
    }
    burst.tapCount += 1;
    const result = this.crushResolver.resolveTap(this.board, burst, row, col);
    const scoreAdded = result.clearedIndices.length * 10;
    burst.crushScore += scoreAdded;
    if (state === "CrushReward") {
      this.score += scoreAdded;
    }
    const primary = result.fired[0];
    if (scoreAdded > 0) {
      this.playMatchPraiseSfx(scoreAdded);
    }
    this.events.emit({
      type: "CrushBurstFired",
      row: primary?.epicenter.r ?? row,
      col: primary?.epicenter.c ?? col,
      radius: primary?.radius ?? burst.tapPower,
      clearedIndices: result.clearedIndices.slice(),
      scoreAdded
    });
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    if (this.isBoardFullyCleared()) {
      burst.forceExpire();
      if (state === "Cleaning") {
        this.finishCleaningMode();
      } else {
        this.finishCrushReward();
      }
    }
    return true;
  }
  /**
   * 推进粉碎/清洁倒计时；到期时自动收尾。
   * @returns 是否仍在进行中
   */
  tickCrushReward(dtMs) {
    const state = this.fsm.getCurrent();
    if (state === "CrushReward" && this.crush) {
      if (this.isBoardFullyCleared()) {
        this.crush.forceExpire();
        this.finishCrushReward();
        return false;
      }
      const alive = this.crush.tick(dtMs);
      if (!alive) {
        this.finishCrushReward();
        return false;
      }
      return true;
    }
    if (state === "Cleaning" && this.clean) {
      if (this.isBoardFullyCleared()) {
        this.clean.forceExpire();
        this.finishCleaningMode();
        return false;
      }
      const alive = this.clean.tick(dtMs);
      if (!alive) {
        this.finishCleaningMode();
        return false;
      }
      return true;
    }
    return false;
  }
  /**
   * 观看激励视频延长粉碎时间。
   */
  async watchAdToExtendCrush() {
    if (this.fsm.getCurrent() !== "CrushReward" || !this.crush || !this.level) {
      return "unavailable";
    }
    this.deps.analytics.track("ad_show", {
      placement: "rewarded_crush_extend",
      levelId: this.level.id
    });
    const result = await this.deps.ads.show("rewarded_crush_extend");
    if (result === "completed") {
      const extra = typeof ad_placements_default.rewarded_crush_extend.extraMs === "number" ? ad_placements_default.rewarded_crush_extend.extraMs : 5e3;
      this.crush.extend(extra);
      this.deps.analytics.track("ad_complete", {
        placement: "rewarded_crush_extend",
        extraMs: extra
      });
      return "revived";
    }
    if (result === "skipped") {
      return "skipped";
    }
    this.deps.analytics.track("ad_error", {
      placement: "rewarded_crush_extend",
      result
    });
    return result === "not_ready" ? "unavailable" : "error";
  }
  /**
   * 粉碎结束：时间到或点领取。剩余小动物收尾爆炸加分，然后进结算，不必点完。
   * 注意：必须先进入 Settle，再发 CrushEnded，否则结算页询问清洁时状态仍是 CrushReward。
   */
  finishCrushReward() {
    if (this.fsm.getCurrent() !== "CrushReward") {
      return false;
    }
    let crushScore = 0;
    let leftoverCleared = 0;
    if (this.board && this.crush) {
      this.crush.clearQueue();
      const finale = this.crushResolver.resolveFinale(
        this.board,
        this.crush,
        this.crushFinaleMaxBursts
      );
      leftoverCleared = finale.clearedIndices.length;
      const scoreAdded = leftoverCleared * 10;
      this.crush.crushScore += scoreAdded;
      this.score += scoreAdded;
      crushScore = this.crush.crushScore;
      if (scoreAdded > 0) {
        this.playMatchPraiseSfx(scoreAdded);
      }
      if (finale.fired.length > 0) {
        const primary = finale.fired[0];
        this.events.emit({
          type: "CrushBurstFired",
          row: primary.epicenter.r,
          col: primary.epicenter.c,
          radius: primary.radius,
          clearedIndices: finale.clearedIndices.slice(),
          scoreAdded
        });
        this.events.emit({ type: "BoardChanged", version: this.board.version });
      }
      this.deps.analytics.track("crush_end", {
        levelId: this.level?.id ?? 0,
        crushScore: this.crush.crushScore,
        tapCount: this.crush.tapCount
      });
      if (this.level) {
        this.commitLevelCleared();
      }
    }
    this.lastSettleWon = true;
    if (!this.fsm.transitionTo("Settle")) {
      return false;
    }
    this.events.emit({
      type: "CrushEnded",
      crushScore,
      totalScore: this.score,
      leftoverCleared
    });
    return true;
  }
  /**
   * 查询失败后的看广告复活报价（仅 LevelFailed 有效）。
   */
  getReviveOffer() {
    if (this.fsm.getCurrent() !== "LevelFailed" || !this.level) {
      return {
        allowed: false,
        movesGranted: 0,
        used: 0,
        maxPerLevel: 0
      };
    }
    const decision = this.adPolicy.decideOnSettle(this.level.id, false);
    const offer = this.revivePolicy.offer();
    if (!decision.offerRewardedRevive) {
      return {
        allowed: false,
        movesGranted: 0,
        used: offer.used,
        maxPerLevel: offer.maxPerLevel
      };
    }
    return offer;
  }
  /**
   * 观看激励视频复活：成功则加步并回到 PlayerInput。
   * @returns revived / skipped / unavailable / error
   */
  async watchAdToRevive() {
    const offer = this.getReviveOffer();
    if (!offer.allowed || !this.level) {
      return "unavailable";
    }
    this.deps.analytics.track("ad_show", {
      placement: "rewarded_revive",
      levelId: this.level.id
    });
    const result = await this.deps.ads.show("rewarded_revive");
    if (result === "completed") {
      this.revivePolicy.consume();
      this.movesLeft += offer.movesGranted;
      this.deps.analytics.track("ad_complete", {
        placement: "rewarded_revive",
        movesGranted: offer.movesGranted
      });
      if (!this.fsm.transitionTo("PlayerInput")) {
        this.fsm.forceTo("PlayerInput");
      }
      return "revived";
    }
    if (result === "skipped") {
      return "skipped";
    }
    this.deps.analytics.track("ad_error", {
      placement: "rewarded_revive",
      result
    });
    return result === "not_ready" ? "unavailable" : "error";
  }
  /**
   * 通关离开结算时尝试插屏：点「下一关 / 回大厅」才弹，先让玩家看完胜利。
   * 未就绪或冷却中会静默跳过，不挡住去下一关。
   */
  async maybeShowSettleInterstitial() {
    if (this.fsm.getCurrent() !== "Settle" || !this.level) {
      return;
    }
    const cooldownSeconds = typeof ad_placements_default.interstitial_settle.cooldownSeconds === "number" ? ad_placements_default.interstitial_settle.cooldownSeconds : 60;
    const now = Date.now();
    if (!this.adPolicy.shouldShowInterstitial(
      this.level.id,
      this.lastSettleWon,
      this.lastInterstitialMs,
      now,
      cooldownSeconds
    )) {
      return;
    }
    if (this.interstitialShowing) {
      return;
    }
    this.interstitialShowing = true;
    this.deps.analytics.track("ad_show", {
      placement: "interstitial_settle",
      levelId: this.level.id
    });
    try {
      const result = await this.deps.ads.show("interstitial_settle");
      if (result === "completed" || result === "skipped") {
        this.lastInterstitialMs = now;
      }
    } finally {
      this.interstitialShowing = false;
    }
  }
  /**
   * 进大厅插屏：广告一就绪就弹。微信启动后一小段时间会拦（2001），
   * 未弹出时返回 retry，由界面在大厅里接着试，直到真正弹出。
   */
  async maybeShowLaunchInterstitial() {
    if (!this.isLaunchInterstitialEnabled()) {
      return "stop";
    }
    if (this.launchInterstitialTried) {
      return "stop";
    }
    if (this.fsm.getCurrent() !== "Lobby") {
      return "stop";
    }
    if (this.interstitialShowing) {
      return "retry";
    }
    this.interstitialShowing = true;
    try {
      const result = await this.deps.ads.show("interstitial_settle");
      if (result === "completed" || result === "skipped") {
        this.launchInterstitialTried = true;
        this.lastInterstitialMs = Date.now();
        this.deps.analytics.track("ad_show", {
          placement: "interstitial_settle",
          reason: "launch"
        });
        return "shown";
      }
      return "retry";
    } finally {
      this.interstitialShowing = false;
    }
  }
  isLaunchInterstitialEnabled() {
    return ad_placements_default.interstitial_launch?.enabled === true;
  }
  /** 首页先画一帧再弹，毫秒。 */
  getLaunchInterstitialDelayMs() {
    return this.readLaunchMs("delayMs", 800);
  }
  /** 被微信频控拦住后的重试间隔。 */
  getLaunchInterstitialRetryMs() {
    return this.readLaunchMs("retryMs", 3e3);
  }
  /** 大厅里最长等到何时放弃进门插屏。 */
  getLaunchInterstitialTimeoutMs() {
    return this.readLaunchMs("timeoutMs", 35e3);
  }
  readLaunchMs(key, fallback) {
    const value = ad_placements_default.interstitial_launch?.[key];
    return typeof value === "number" && value >= 0 ? value : fallback;
  }
  /**
   * 大厅底部原生模板横幅：流量主已开通且填了广告位。
   */
  isLobbyBannerEnabled() {
    const unit = ad_placements_default.banner_lobby?.adUnitId;
    return ad_placements_default.banner_lobby?.enabled === true && typeof unit === "string" && unit.startsWith("adunit-");
  }
  /**
   * 大厅底部给横幅留的高度，设置/玩法按钮要抬上去。
   */
  getLobbyBannerReservePx() {
    if (!this.isLobbyBannerEnabled()) {
      return 0;
    }
    const info = this.deps.platform.getSystemInfo();
    return lobbyBannerReserveHeight(
      info.windowWidth,
      info.windowHeight,
      info.safeAreaBottom ?? 0
    );
  }
  /**
   * 在大厅展示底部横幅。进关或弹层时不要调。
   */
  async showLobbyBanner() {
    if (!this.isLobbyBannerEnabled()) {
      this.hideLobbyBanner();
      return "not_ready";
    }
    if (this.fsm.getCurrent() !== "Lobby") {
      this.hideLobbyBanner();
      return "error";
    }
    const result = await this.deps.ads.show("banner_lobby");
    if (this.fsm.getCurrent() !== "Lobby") {
      this.hideLobbyBanner();
      return "error";
    }
    if (result === "completed") {
      this.deps.analytics.track("ad_show", { placement: "banner_lobby" });
    }
    return result;
  }
  /**
   * 隐藏大厅横幅（进关、设置页、切后台）。
   */
  hideLobbyBanner() {
    this.deps.ads.hide?.("banner_lobby");
  }
  /**
   * 画布起来后再预加载广告，避免启动瞬间创建原生广告卡死模拟器。
   */
  warmupAds() {
    if (!canCreateWxFullscreenAds()) {
      return;
    }
    void this.deps.ads.load("rewarded_revive");
    void this.deps.ads.load("interstitial_settle");
    setTimeout(() => {
      void this.deps.ads.load("rewarded_crush_extend");
    }, 800);
  }
  /**
   * 失败确认后进入结算态（放弃复活）。
   */
  acknowledgeFailure() {
    if (this.fsm.getCurrent() !== "LevelFailed") {
      return false;
    }
    this.lastSettleWon = false;
    return this.fsm.transitionTo("Settle");
  }
  /**
   * 结算后进入下一关。
   * 插屏由界面在带遮罩的 runDuringAd 里先弹，这里只切关，避免连弹两次。
   * @returns 是否成功开局；无下一关时返回 false（保持结算态）
   */
  async continueToNextLevel() {
    if (this.fsm.getCurrent() !== "Settle" || !this.level) {
      return false;
    }
    const nextId = this.level.id + 1;
    if (!this.levelTable.some((item) => item.id === nextId)) {
      return false;
    }
    await this.startLevel(nextId);
    return true;
  }
  /**
   * 结算后重试当前关。
   */
  async retryLevel() {
    if (this.fsm.getCurrent() !== "Settle" || !this.level) {
      return false;
    }
    await this.startLevel(this.level.id);
    return true;
  }
  /**
   * 结算后返回大厅。
   */
  returnToLobby() {
    if (this.fsm.getCurrent() !== "Settle") {
      return false;
    }
    return this.fsm.transitionTo("Lobby");
  }
  /**
   * 任意对局态中途退出回首页（放弃当前关）。
   */
  quitToLobby() {
    const state = this.fsm.getCurrent();
    if (state === "Lobby" || state === "Boot") {
      return true;
    }
    this.crush = null;
    this.clean = null;
    this.cleaningUsedThisSettle = false;
    this.board = null;
    this.goals = null;
    return this.fsm.forceTo("Lobby");
  }
  dispose() {
    this.fsm.dispose();
    this.events.dispose();
    this.deps.ads.dispose();
    this.deps.audio.dispose();
    this.board = null;
    this.level = null;
    this.goals = null;
  }
  /**
   * 根据目标与步数判定胜负，并写入进度。
   */
  evaluateLevelOutcome() {
    if (!this.level || !this.goals) {
      return;
    }
    if (this.goals.isAllCompleted()) {
      if (this.fsm.getCurrent() === "PlayerInput") {
        this.fsm.transitionTo("Resolving");
      }
      this.fsm.transitionTo("LevelWon");
      this.events.emit({
        type: "LevelWon",
        levelId: this.level.id,
        score: this.score
      });
      this.deps.analytics.track("level_win", {
        levelId: this.level.id,
        score: this.score
      });
      if (this.movesLeft > 0 && this.board) {
        this.pendingMovesBonus = true;
        return;
      }
      this.finishAfterLevelWon();
      return;
    }
    if (this.board?.hasRevealedUnharvestedBuried()) {
      if (this.movesLeft <= 0) {
        return;
      }
      this.fsm.transitionTo("PlayerInput");
      this.ensurePlayableBoard();
      return;
    }
    if (this.movesLeft <= 0) {
      this.fsm.transitionTo("LevelFailed");
      this.playSfx("sfx_fail");
      this.events.emit({ type: "LevelFailed", levelId: this.level.id });
      this.deps.analytics.track("level_fail", { levelId: this.level.id });
      void this.deps.ads.load("rewarded_revive");
      return;
    }
    this.fsm.transitionTo("PlayerInput");
    this.ensurePlayableBoard();
  }
  /**
   * 是否有待播放的「剩余步数加成」阶段。
   */
  hasPendingMovesBonus() {
    return this.pendingMovesBonus;
  }
  /**
   * 执行剩余步数加成：步数打到彩色块变成闪光，再连锁爆炸加分。
   * 表现层应在胜利消除动画播完后调用。
   */
  runMovesBonus() {
    if (!this.pendingMovesBonus || !this.board || !this.level) {
      return false;
    }
    if (this.fsm.getCurrent() !== "LevelWon") {
      return false;
    }
    this.pendingMovesBonus = false;
    if (!this.fsm.transitionTo("MovesBonus")) {
      this.finishAfterLevelWon();
      return false;
    }
    const movesToConvert = this.movesLeft;
    const targets = this.pickMovesBonusTargets(movesToConvert);
    this.movesLeft = 0;
    for (const t of targets) {
      if (isBasicTile(this.board.getTile(t.row, t.col))) {
        this.board.setSparkle(t.row, t.col, true);
      }
    }
    this.events.emit({
      type: "MovesBonusApplied",
      movesConverted: movesToConvert,
      targets: targets.slice()
    });
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    const clear = /* @__PURE__ */ new Set();
    for (let i = 0; i < this.board.length; i += 1) {
      if (this.board.sparkles[i] === 1) {
        clear.add(i);
      }
    }
    expandSparkleBlasts(this.board, clear);
    const clearIndices = [...clear];
    if (clearIndices.length === 0) {
      this.events.emit({
        type: "MovesBonusDone",
        bonusScore: 0,
        totalScore: this.score
      });
      this.finishAfterLevelWon();
      return true;
    }
    const firstKinds = clearIndices.map(
      (index) => this.board.cells[index]
    );
    const playback = this.capturePlaybackSnapshot();
    const emptyMatches = this.finder.findMatches(this.board);
    const result = this.resolver.resolve(this.board, emptyMatches, {
      seed: this.level.seed + this.board.version + 911,
      initialClearIndices: clearIndices,
      spawnSpecials: true
    });
    const bonusScore = result.cleared * 10;
    this.score += bonusScore;
    this.goals?.applyClearedKinds(result.clearedKinds);
    this.goals?.syncScore(this.score);
    this.emitGoalProgress();
    this.events.emit({
      type: "TilesCleared",
      indices: clearIndices,
      kinds: firstKinds
    });
    this.events.emit({
      type: "ResolvePlayback",
      ...playback,
      waves: result.waves
    });
    this.events.emit({ type: "CascadeDone", depth: result.cascadeDepth });
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    this.events.emit({
      type: "MovesBonusDone",
      bonusScore,
      totalScore: this.score
    });
    this.finishAfterLevelWon();
    return true;
  }
  /**
   * 通关后进入粉碎或结算。
   */
  finishAfterLevelWon() {
    if (!this.level) {
      this.fsm.forceTo("Settle");
      return;
    }
    if (this.level.crushEnabled) {
      this.beginCrushReward();
      return;
    }
    this.commitLevelCleared();
    this.lastSettleWon = true;
    if (this.fsm.getCurrent() === "MovesBonus" || this.fsm.getCurrent() === "LevelWon") {
      this.fsm.transitionTo("Settle");
    } else if (this.fsm.getCurrent() !== "Settle") {
      this.fsm.forceTo("Settle");
    }
  }
  /**
   * 按剩余步数随机挑彩色块（优先未闪光）。
   */
  pickMovesBonusTargets(count) {
    if (!this.board || !this.level || count <= 0) {
      return [];
    }
    const random = createSeededRandom(this.level.seed + this.board.version + 4242);
    const candidates = [];
    for (let r = 0; r < this.board.size.rows; r += 1) {
      for (let c = 0; c < this.board.size.cols; c += 1) {
        const kind = this.board.getTile(r, c);
        if (!isBasicTile(kind)) {
          continue;
        }
        candidates.push({ row: r, col: c, sparkle: this.board.isSparkle(r, c) });
      }
    }
    if (candidates.length === 0) {
      return [];
    }
    candidates.sort((a, b) => Number(a.sparkle) - Number(b.sparkle));
    const plain = candidates.filter((c) => !c.sparkle);
    const pool = plain.length > 0 ? plain : candidates;
    const picks = [];
    const used = /* @__PURE__ */ new Set();
    const n = Math.min(count, pool.length);
    let guard = 0;
    while (picks.length < n && guard < n * 8) {
      guard += 1;
      const idx = Math.floor(random() * pool.length);
      const cell = pool[idx];
      const key = this.board.index(cell.row, cell.col);
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      picks.push({ row: cell.row, col: cell.col });
    }
    return picks;
  }
  /**
   * 先清掉盘面上已有的三连/四连（含冰封格），再在死局时重新排列。
   */
  ensurePlayableBoard() {
    this.stabilizeBoard({ animate: true });
  }
  /**
   * 铺上棉花后只能洗牌，不能再结算三消，否则会提前削掉邻格棉花。
   */
  shuffleAroundCloudLocks(seed) {
    if (!this.board) {
      return;
    }
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const noMatch = this.finder.findMatches(this.board).isEmpty();
      const hasMove = hasAnyValidMove(this.board, this.validator);
      if (noMatch && hasMove) {
        return;
      }
      shuffleUntilPlayable(this.board, seed + 199 + attempt * 17, 48, true);
    }
  }
  /**
   * 结算当前盘面已形成的匹配，必要时洗牌直到可走。
   * 洗牌只保证有合法交换，不会清掉已连成的 3/4，所以洗完必须再结算。
   */
  stabilizeBoard(options) {
    if (!this.board || !this.level) {
      return;
    }
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (this.commitStandingMatches(options.animate)) {
        if (options.animate) {
          this.evaluateLevelOutcome();
          return;
        }
        continue;
      }
      if (hasAnyValidMove(this.board, this.validator)) {
        return;
      }
      const ok = shuffleUntilPlayable(
        this.board,
        this.level.seed + this.board.version + this.movesLeft * 17 + attempt * 31,
        48,
        true
      );
      if (ok && options.animate) {
        this.events.emit({ type: "BoardShuffled", reason: "deadlock" });
        this.events.emit({ type: "BoardChanged", version: this.board.version });
      }
    }
  }
  /**
   * 若盘面已有 ≥3 连（冰封格同样计入），立刻连锁消除，不必先滑动。
   * @returns 是否发生了消除
   */
  commitStandingMatches(animate) {
    if (!this.board || !this.level || !this.goals) {
      return false;
    }
    const matches = this.finder.findMatches(this.board);
    if (matches.isEmpty()) {
      return false;
    }
    if (animate && this.fsm.getCurrent() === "PlayerInput") {
      this.fsm.transitionTo("Resolving");
    }
    const standingIndices = Array.from(matches.indices.subarray(0, matches.size));
    const firstKinds = standingIndices.map(
      (index) => this.board.cells[index]
    );
    const playback = this.capturePlaybackSnapshot();
    const result = this.resolver.resolve(this.board, matches, {
      seed: this.level.seed + this.board.version + 53
    });
    if (result.cleared <= 0) {
      if (animate && this.fsm.getCurrent() === "Resolving") {
        this.fsm.transitionTo("PlayerInput");
      }
      return false;
    }
    this.score += result.cleared * 10;
    this.goals.applyClearedKinds(result.clearedKinds);
    this.goals.syncScore(this.score);
    this.emitGoalProgress();
    if (animate) {
      this.playMatchPraiseSfx(Math.max(30, result.cleared * 10));
      this.events.emit({
        type: "TilesCleared",
        indices: standingIndices,
        kinds: firstKinds
      });
      this.events.emit({
        type: "ResolvePlayback",
        ...playback,
        waves: result.waves
      });
      if (result.fell.length > 0) {
        this.events.emit({
          type: "TilesFell",
          moves: result.fell.map((f) => ({
            tileId: f.tileId,
            fromRow: f.fromRow,
            toRow: f.toRow,
            col: f.col
          }))
        });
      }
      if (result.spawned.length > 0) {
        this.events.emit({
          type: "TilesSpawned",
          indices: result.spawned.map((s) => this.board.index(s.row, s.col)),
          tileIds: result.spawned.map((s) => s.tileId),
          kinds: result.spawned.map((s) => s.kind)
        });
      }
      this.events.emit({ type: "CascadeDone", depth: result.cascadeDepth });
    }
    this.events.emit({ type: "BoardChanged", version: this.board.version });
    return true;
  }
  /** 盘面是否已无任何小动物（洞格不算占用）。 */
  isBoardFullyCleared() {
    if (!this.board) {
      return true;
    }
    for (let i = 0; i < this.board.length; i += 1) {
      const kind = this.board.cells[i];
      if (!isHole(kind) && kind !== 0 /* Empty */) {
        return false;
      }
    }
    return true;
  }
  capturePlaybackSnapshot() {
    const board = this.board;
    return {
      rows: board.size.rows,
      cols: board.size.cols,
      cells: Int8Array.from(board.cells),
      tileIds: Int32Array.from(board.tileIds),
      sparkles: Uint8Array.from(board.sparkles),
      cloud: Uint8Array.from(board.cloud),
      ice: Uint8Array.from(board.ice),
      egg: Uint8Array.from(board.egg),
      vine: Uint8Array.from(board.vine)
    };
  }
  emitGoalProgress() {
    if (!this.goals) {
      return;
    }
    if (this.board && this.iceAtStart > 0) {
      this.goals.syncClearIce(this.iceAtStart - this.board.countIce());
    }
    if (this.board && this.cloudsAtStart > 0) {
      this.goals.syncClearCloud(this.cloudsAtStart - this.board.countCloud());
    }
    if (this.board && this.gemsAtStart > 0) {
      this.goals.syncCollectGems(this.gemsAtStart - this.board.countGems());
    }
    if (this.board && this.eggsAtStart > 0) {
      this.goals.syncCollectChicks(this.eggsAtStart - this.board.countEggs());
    }
    if (this.board && this.vinesAtStart > 0) {
      this.goals.syncClearVines(this.vinesAtStart - this.board.countVines());
    }
    if (this.board) {
      const quakes = this.board.lastSnowmanQuakeCenters;
      if (quakes.length > 0) {
        this.board.lastSnowmanQuakeCenters = [];
        this.events.emit({ type: "SnowmanQuake", centers: quakes });
      }
      this.goals.syncCollectSnowmen(this.board.harvestedSnowmen);
      this.goals.syncCollectPenguins(this.board.harvestedPenguins);
      for (const group of this.board.listBuriedGroups()) {
        if (!group.revealed || this.buriedNotified.has(group.id)) {
          continue;
        }
        this.buriedNotified.add(group.id);
        this.events.emit({
          type: "BuriedRevealed",
          id: group.id,
          kind: group.kind,
          cells: group.cells.slice()
        });
      }
    }
    this.events.emit({
      type: "GoalProgress",
      progress: this.goals.getProgress().slice(),
      completed: this.goals.isAllCompleted()
    });
  }
  /** 整只露出并展示完毕后收走一只企鹅/雪人。 */
  collectBuriedGroup(groupId) {
    if (!this.board || !this.goals) {
      return false;
    }
    const harvested = this.board.harvestBuriedGroup(groupId);
    if (harvested.length === 0) {
      return false;
    }
    this.buriedNotified.delete(groupId);
    this.goals.syncCollectSnowmen(this.board.harvestedSnowmen);
    this.goals.syncCollectPenguins(this.board.harvestedPenguins);
    this.events.emit({ type: "BuriedHarvested", indices: harvested });
    this.events.emit({
      type: "GoalProgress",
      progress: this.goals.getProgress().slice(),
      completed: this.goals.isAllCompleted()
    });
    this.evaluateLevelOutcome();
    return true;
  }
  /**
   * 进入粉碎奖励环节。
   */
  beginCrushReward() {
    if (!this.level) {
      this.fsm.transitionTo("Settle");
      return;
    }
    const duration = Math.max(0, this.level.crushDurationMs);
    this.crush = new CrushRewardModel(duration, this.crushTapPower);
    this.fsm.transitionTo("CrushReward");
    this.deps.analytics.track("crush_start", {
      levelId: this.level.id,
      durationMs: duration
    });
    void this.deps.ads.load("rewarded_crush_extend");
  }
  findLevelConfig(levelId) {
    const found = this.levelTable.find((item) => item.id === levelId);
    if (found) {
      return found;
    }
    if (this.levelTable[0]) {
      return this.levelTable[0];
    }
    throw new Error(`Level config not found: ${levelId}`);
  }
};

// tmp-bench.ts
var levels = levels_default;
function ms(label, fn, repeat = 1) {
  const t0 = performance.now();
  let n = 0;
  for (let i = 0; i < repeat; i += 1) {
    fn();
    n += 1;
  }
  const dt = performance.now() - t0;
  console.log(`${label}: total=${dt.toFixed(1)}ms avg=${(dt / n).toFixed(2)}ms (x${n})`);
  return dt / n;
}
async function main() {
  const deps = createMemoryDeps();
  const session = new GameSession(deps);
  session.setLevelTable(levels);
  await session.init();
  for (const id of [1, 4, 9, 17, 19, 20]) {
    session.quitToLobby();
    const t0 = performance.now();
    await session.startLevel(id);
    const dt = performance.now() - t0;
    console.log(`startLevel(${id}): ${dt.toFixed(1)}ms`);
  }
  session.quitToLobby();
  await session.startLevel(20);
  const board = session.getBoard();
  const validator = new MoveValidator();
  ms(
    "hasAnyValidMove",
    () => hasAnyValidMove(board, validator),
    20
  );
  let validTotal = 0;
  ms(
    "canSwap-all-pairs",
    () => {
      const { rows, cols } = board.size;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (c + 1 < cols) {
            validator.canSwap(board, r, c, r, c + 1);
            validTotal += 1;
          }
          if (r + 1 < rows) {
            validator.canSwap(board, r, c, r + 1, c);
            validTotal += 1;
          }
        }
      }
    },
    5
  );
  console.log("pairs evaluated total across runs:", validTotal);
  ms(
    "startLevel-x8",
    () => {
      session.quitToLobby();
      void session.startLevel(19).catch(() => {
      });
    },
    8
  );
}
void main();

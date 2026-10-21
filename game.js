"use strict";
(() => {
  // src/core/ports/IStorage.ts
  var StorageKeys = {
    PlayerProgress: "crush.player.progress",
    Settings: "crush.player.settings",
    AdCooldown: "crush.ad.cooldown",
    DailyLoop: "crush.player.daily",
    Boosters: "crush.player.boosters",
    NoticeSeen: "crush.player.noticeSeen",
    /** 大厅麻将馆入口：用户已点过，不再显示 NEW 角标 */
    MahjongHallNewDismissed: "crush.player.mahjongHallNewDismissed",
    MahjongHallProgress: "crush.player.mahjongHall",
    Invite: "crush.player.invite",
    DeviceId: "crush.player.device",
    /** 本周榜累计分 { week, score } */
    Weekly: "crush.player.weekly"
  };

  // src/core/utils/miniGameHost.ts
  function readMiniGameHost() {
    const id = globalThis.__CRUSH_HOST__;
    if (id === "douyin" || id === "wechat") {
      return id;
    }
    if (typeof tt !== "undefined") {
      return "douyin";
    }
    if (typeof wx !== "undefined") {
      return "wechat";
    }
    return "unknown";
  }
  function isDouyinMiniGameHost() {
    return readMiniGameHost() === "douyin";
  }
  function readMiniProgramEnvVersion() {
    var _a, _b, _c, _d;
    try {
      if (typeof wx !== "undefined" && typeof wx.getAccountInfoSync === "function") {
        const env = (_b = (_a = wx.getAccountInfoSync()) == null ? void 0 : _a.miniProgram) == null ? void 0 : _b.envVersion;
        if (env === "develop" || env === "trial" || env === "release") {
          return env;
        }
      }
    } catch (e) {
    }
    try {
      if (typeof tt !== "undefined" && typeof tt.getEnvInfoSync === "function") {
        const envType = (_d = (_c = tt.getEnvInfoSync()) == null ? void 0 : _c.microapp) == null ? void 0 : _d.envType;
        if (envType === "development" || envType === "develop") {
          return "develop";
        }
        if (envType === "preview" || envType === "trial") {
          return "trial";
        }
        if (envType === "production" || envType === "release") {
          return "release";
        }
      }
    } catch (e) {
    }
    return null;
  }

  // src/core/adapters/WxStorageAdapter.ts
  var WxStorageAdapter = class {
    useSyncStorage() {
      if (isDouyinMiniGameHost() && typeof wx.getStorageSync === "function") {
        return true;
      }
      return typeof wx.getStorageSync === "function" && typeof wx.getStorage !== "function";
    }
    readSync(key) {
      try {
        const data = wx.getStorageSync(key);
        if (data === void 0 || data === "") {
          return null;
        }
        return data;
      } catch (e) {
        return null;
      }
    }
    async get(key) {
      if (this.useSyncStorage()) {
        return this.readSync(key);
      }
      return new Promise((resolve, reject) => {
        wx.getStorage({
          key,
          success: (res) => {
            if (res.data === void 0 || res.data === "") {
              resolve(null);
              return;
            }
            resolve(res.data);
          },
          fail: (err) => {
            const msg = String(err.errMsg || "");
            if (/not found|data empty/i.test(msg)) {
              resolve(null);
              return;
            }
            reject(new Error(`WxStorageAdapter.get failed: ${msg}`));
          }
        });
      });
    }
    async set(key, value) {
      if (this.useSyncStorage()) {
        wx.setStorageSync(key, value);
        return;
      }
      return new Promise((resolve, reject) => {
        wx.setStorage({
          key,
          data: value,
          success: () => resolve(),
          fail: (err) => reject(new Error(`WxStorageAdapter.set failed: ${err.errMsg}`))
        });
      });
    }
    async remove(key) {
      if (this.useSyncStorage()) {
        try {
          wx.removeStorageSync(key);
        } catch (e) {
        }
        return;
      }
      return new Promise((resolve, reject) => {
        wx.removeStorage({
          key,
          success: () => resolve(),
          fail: (err) => {
            if (err.errMsg.includes("removeStorage:fail")) {
              resolve();
              return;
            }
            reject(new Error(`WxStorageAdapter.remove failed: ${err.errMsg}`));
          }
        });
      });
    }
    async clear() {
      if (this.useSyncStorage()) {
        wx.clearStorageSync();
        return;
      }
      return new Promise((resolve, reject) => {
        wx.clearStorage({
          success: () => resolve(),
          fail: (err) => reject(new Error(`WxStorageAdapter.clear failed: ${err.errMsg}`))
        });
      });
    }
  };

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
    shareFriendHammer: false,
    shareFriendShuffle: false,
    shareFriendExtra: false,
    shareGroupHammer: false,
    shareGroupShuffle: false,
    shareGroupExtra: false,
    playShuffleGranted: false,
    playExtraGranted: false
  };
  function parseBoosterDaily(raw) {
    var _a, _b, _c;
    return {
      adHammer: Math.max(0, Math.floor((_a = raw == null ? void 0 : raw.adHammer) != null ? _a : 0)),
      adShuffle: Math.max(0, Math.floor((_b = raw == null ? void 0 : raw.adShuffle) != null ? _b : 0)),
      adExtra: Math.max(0, Math.floor((_c = raw == null ? void 0 : raw.adExtra) != null ? _c : 0)),
      shareFriendHammer: !!(raw == null ? void 0 : raw.shareFriendHammer),
      shareFriendShuffle: !!(raw == null ? void 0 : raw.shareFriendShuffle),
      shareFriendExtra: !!(raw == null ? void 0 : raw.shareFriendExtra),
      shareGroupHammer: !!(raw == null ? void 0 : raw.shareGroupHammer),
      shareGroupShuffle: !!(raw == null ? void 0 : raw.shareGroupShuffle),
      shareGroupExtra: !!(raw == null ? void 0 : raw.shareGroupExtra),
      playShuffleGranted: !!(raw == null ? void 0 : raw.playShuffleGranted),
      playExtraGranted: !!(raw == null ? void 0 : raw.playExtraGranted)
    };
  }
  function boosterRefillChannel(flags, id) {
    if (id === "hammer") {
      if (!flags.shareFriendHammer) {
        return "friend";
      }
      if (!flags.shareGroupHammer) {
        return "group";
      }
      return "ad";
    }
    if (id === "shuffle") {
      if (!flags.shareFriendShuffle) {
        return "friend";
      }
      if (!flags.shareGroupShuffle) {
        return "group";
      }
      return "ad";
    }
    if (!flags.shareFriendExtra) {
      return "friend";
    }
    if (!flags.shareGroupExtra) {
      return "group";
    }
    return "ad";
  }
  function markBoosterShare(flags, id, channel) {
    const next = { ...flags };
    if (id === "hammer") {
      if (channel === "friend") {
        next.shareFriendHammer = true;
      } else {
        next.shareGroupHammer = true;
      }
    } else if (id === "shuffle") {
      if (channel === "friend") {
        next.shareFriendShuffle = true;
      } else {
        next.shareGroupShuffle = true;
      }
    } else if (channel === "friend") {
      next.shareFriendExtra = true;
    } else {
      next.shareGroupExtra = true;
    }
    return next;
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
  function boosterRefillBadge(channel) {
    if (channel === "friend") {
      return "\u597D\u53CB";
    }
    if (channel === "group") {
      return "\u7FA4";
    }
    return "\u5E7F\u544A";
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
    const text = String(raw != null ? raw : "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  function withInviterQuery(query, code) {
    const inviter = normalizeInviteCode(code);
    if (!inviter) {
      return query;
    }
    if (!query) {
      return `inviter=${inviter}`;
    }
    if (/(?:^|&)inviter=/i.test(query)) {
      return query.replace(/(^|&)inviter=[^&]*/i, `$1inviter=${inviter}`);
    }
    return `${query}&inviter=${inviter}`;
  }
  function isFreshPlayer(progress) {
    var _a, _b, _c;
    if (!progress) {
      return true;
    }
    const scores = (_a = progress.levelScores) != null ? _a : {};
    if (Object.keys(scores).length > 0) {
      return false;
    }
    if (((_b = progress.totalScore) != null ? _b : 0) > 0) {
      return false;
    }
    return ((_c = progress.highestLevelId) != null ? _c : 1) <= 1;
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
    const a = local != null ? local : EMPTY_INVITE_CLOUD;
    const b = remote != null ? remote : EMPTY_INVITE_CLOUD;
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

  // src/logic/mahjong/MahjongProgress.ts
  var EMPTY_MAHJONG_TOOLS = {
    move_out: 1,
    gather: 1,
    shuffle: 1,
    reveal: 1
  };
  function emptyMahjongProgress() {
    return {
      coins: 0,
      highestUnlocked: 1,
      starsByLevel: {},
      tools: { ...EMPTY_MAHJONG_TOOLS },
      guideSeen: false,
      savedRun: null,
      blockedReplayLevel: null
    };
  }
  function normalizeMahjongProgress(raw) {
    var _a;
    const base = emptyMahjongProgress();
    if (!raw || typeof raw !== "object") {
      return base;
    }
    const o = raw;
    if (typeof o.coins === "number" && Number.isFinite(o.coins)) {
      base.coins = Math.max(0, Math.floor(o.coins));
    }
    if (typeof o.highestUnlocked === "number" && Number.isFinite(o.highestUnlocked)) {
      base.highestUnlocked = Math.max(1, Math.floor(o.highestUnlocked));
    }
    if (o.starsByLevel && typeof o.starsByLevel === "object") {
      base.starsByLevel = { ...o.starsByLevel };
    }
    if (o.tools && typeof o.tools === "object") {
      for (const k of Object.keys(EMPTY_MAHJONG_TOOLS)) {
        const v = o.tools[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          base.tools[k] = Math.max(0, Math.floor(v));
        }
      }
    }
    base.guideSeen = o.guideSeen === true;
    if (o.savedRun && typeof o.savedRun === "object") {
      base.savedRun = o.savedRun;
    }
    if (typeof o.blockedReplayLevel === "number" && Number.isFinite(o.blockedReplayLevel)) {
      base.blockedReplayLevel = Math.max(1, Math.floor(o.blockedReplayLevel));
    }
    if (base.blockedReplayLevel != null && ((_a = base.savedRun) == null ? void 0 : _a.phase) === "playing" && base.savedRun.level === base.blockedReplayLevel) {
      base.savedRun = null;
    }
    return base;
  }
  function recordMahjongClear(data, level, stars, coinsEarned) {
    var _a;
    const key = String(level);
    const prev = (_a = data.starsByLevel[key]) != null ? _a : 0;
    const nextStars = Math.max(prev, stars);
    return {
      ...data,
      coins: data.coins + coinsEarned,
      starsByLevel: { ...data.starsByLevel, [key]: nextStars },
      highestUnlocked: Math.max(data.highestUnlocked, level + 1),
      savedRun: null,
      blockedReplayLevel: null
    };
  }

  // src/config/cloud.json
  var cloud_default = {
    enabled: true,
    envId: "mengchong-prod-d6ge57eisb268a264",
    collection: "player_saves",
    _comment: "player_saves \u4EC5\u521B\u5EFA\u8005\u53EF\u8BFB\u5199\u3002\u9080\u8BF7\u4EBA\u9524\u5B50\u7531\u4E91\u51FD\u6570 claimInvite \u5199\u5165 invite.creditHammer\uFF1Binvite_claims \u9632\u91CD\u590D\u9886\u53D6\u3002"
  };

  // src/core/adapters/WxCloudSaveAdapter.ts
  var COLLECTION = cloud_default.collection || "player_saves";
  function cloudApi() {
    try {
      if (typeof wx === "undefined" || !wx.cloud) {
        return null;
      }
      return wx.cloud;
    } catch (e) {
      return null;
    }
  }
  var WxCloudSaveAdapter = class {
    constructor() {
      this.ready = null;
      this.docId = null;
    }
    isEnabled() {
      return cloud_default.enabled !== false && !!cloudApi();
    }
    async pull() {
      if (!await this.ensureReady()) {
        throw new Error("cloud not ready");
      }
      const cloud = cloudApi();
      if (!cloud) {
        throw new Error("cloud api missing");
      }
      const res = await cloud.database().collection(COLLECTION).limit(1).get();
      const row = res.data[0];
      if (!row) {
        return null;
      }
      this.docId = String(row._id);
      return snapshotFromDoc(row);
    }
    async push(snapshot) {
      if (!await this.ensureReady()) {
        return;
      }
      const cloud = cloudApi();
      if (!cloud) {
        return;
      }
      const invite = parseInviteCloudSlice(snapshot.invite);
      const payload = {
        updatedAt: snapshot.updatedAt,
        progress: snapshot.progress,
        boosters: snapshot.boosters,
        settings: snapshot.settings,
        daily: snapshot.daily,
        invite,
        mahjong: snapshot.mahjong ? normalizeMahjongProgress(snapshot.mahjong) : void 0
      };
      try {
        const db = cloud.database();
        const col = db.collection(COLLECTION);
        if (this.docId) {
          await this.writeExisting(col, db, this.docId, payload);
          return;
        }
        const existing = await col.limit(1).get();
        const row = existing.data[0];
        if (row) {
          this.docId = String(row._id);
          await this.writeExisting(col, db, this.docId, payload);
          return;
        }
        const added = await col.add({ data: payload });
        this.docId = String(added._id);
      } catch (e) {
      }
    }
    async claimInvite(inviterCode) {
      var _a;
      if (!await this.ensureReady()) {
        return { ok: false, retry: true };
      }
      const cloud = cloudApi();
      if (!cloud || typeof cloud.callFunction !== "function") {
        return { ok: false, retry: true };
      }
      try {
        const res = await cloud.callFunction({
          name: "claimInvite",
          data: { inviterCode }
        });
        const result = (_a = res.result) != null ? _a : {};
        return {
          ok: result.ok === true,
          retry: result.retry === true
        };
      } catch (e) {
        return { ok: false, retry: true };
      }
    }
    ensureReady() {
      if (this.ready) {
        return this.ready;
      }
      this.ready = (async () => {
        if (!this.isEnabled()) {
          return false;
        }
        const cloud = cloudApi();
        if (!cloud) {
          return false;
        }
        try {
          const env = cloud_default.envId || cloud.DYNAMIC_CURRENT_ENV;
          cloud.init(env ? { env, traceUser: true } : { traceUser: true });
          console.info("[crush-crush][cloud] init", env || "default");
          return true;
        } catch (e) {
          return false;
        }
      })();
      return this.ready;
    }
    async writeExisting(col, db, docId, payload) {
      const invite = parseInviteCloudSlice(payload.invite);
      const command = db.command;
      if (command && typeof col.doc(docId).update === "function") {
        await col.doc(docId).update({
          data: {
            updatedAt: payload.updatedAt,
            progress: payload.progress,
            boosters: payload.boosters,
            settings: payload.settings,
            daily: payload.daily,
            "invite.code": invite.code,
            "invite.claimedAsInvitee": invite.claimedAsInvitee,
            "invite.pendingInviter": invite.pendingInviter,
            "invite.inviteeGiftGranted": invite.inviteeGiftGranted,
            "invite.cloudClaimed": invite.cloudClaimed,
            "invite.creditHammer": command.max ? command.max(invite.creditHammer) : invite.creditHammer,
            mahjong: payload.mahjong
          }
        });
        return;
      }
      await col.doc(docId).set({ data: payload });
    }
  };
  function snapshotFromDoc(row) {
    const progress = row.progress;
    const boosters = row.boosters;
    if (!progress || typeof progress !== "object" || !boosters || typeof boosters !== "object") {
      return null;
    }
    const settings = row.settings;
    const daily = row.daily;
    return {
      updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
      progress,
      boosters,
      settings: settings && typeof settings === "object" ? settings : { muted: false },
      daily: daily && typeof daily === "object" ? daily : {
        ymd: "",
        bonusHammer: 0,
        clearsToday: 0,
        adHammer: 0,
        adShuffle: 0,
        adExtra: 0,
        shareFriendHammer: false,
        shareFriendShuffle: false,
        shareFriendExtra: false,
        shareGroupHammer: false,
        shareGroupShuffle: false,
        shareGroupExtra: false,
        playShuffleGranted: false,
        playExtraGranted: false
      },
      invite: parseInviteCloudSlice(row.invite),
      mahjong: row.mahjong && typeof row.mahjong === "object" ? normalizeMahjongProgress(row.mahjong) : void 0
    };
  }

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
  function toNativeViewStyle(box) {
    const left = Math.round(box.left);
    const top = Math.round(box.top);
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (![left, top, width, height].every((n) => Number.isFinite(n))) {
      return null;
    }
    if (width < 1 || height < 1 || left < 0 || top < 0) {
      return null;
    }
    return { left, top, width, height };
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

  // src/core/utils/canvas2dBinding.ts
  function findExistingMainCanvas() {
    var _a, _b;
    const g = globalThis;
    const candidates = [(_a = g.GameGlobal) == null ? void 0 : _a.canvas, g.canvas, (_b = g.window) == null ? void 0 : _b.canvas];
    for (const item of candidates) {
      if (item && typeof item.getContext === "function") {
        return item;
      }
    }
    return null;
  }
  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("[crush-crush] shader compile", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  function createWebglPresenter(screen, gl, source) {
    const vs = compileShader(
      gl,
      gl.VERTEX_SHADER,
      "attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0.0,1.0);}"
    );
    const fs = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      "precision mediump float;varying vec2 v_uv;uniform sampler2D u_tex;void main(){gl_FragColor=texture2D(u_tex,vec2(v_uv.x,1.0-v_uv.y));}"
    );
    if (!vs || !fs) {
      return null;
    }
    const prog = gl.createProgram();
    if (!prog) {
      return null;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[crush-crush] program link", gl.getProgramInfoLog(prog));
      return null;
    }
    const tex = gl.createTexture();
    const buf = gl.createBuffer();
    if (!tex || !buf) {
      return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const locPos = gl.getAttribLocation(prog, "a_pos");
    const locTex = gl.getUniformLocation(prog, "u_tex");
    return () => {
      const w = screen.width || 1;
      const h = screen.height || 1;
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source
        );
      } catch (err) {
        console.warn("[crush-crush] texImage2D failed", err);
        return;
      }
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(locTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(locPos);
      gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }
  var CANVAS_BINDING_CACHE_KEY = "__CRUSH_CANVAS_2D_BINDING__";
  function bindMainCanvas2dOnce() {
    if (typeof wx === "undefined") {
      throw new Error("wx/tt runtime missing");
    }
    const screen = findExistingMainCanvas();
    if (screen) {
      const onScreen2d = screen.getContext("2d");
      if (onScreen2d) {
        return { canvas: screen, ctx: onScreen2d };
      }
    }
    if (typeof wx.createCanvas !== "function") {
      throw new Error("createCanvas unavailable");
    }
    const drawCanvas = wx.createCanvas();
    const drawCtx = drawCanvas.getContext("2d");
    if (!drawCtx) {
      throw new Error("2d context unavailable on createCanvas");
    }
    if (!screen || screen === drawCanvas) {
      return { canvas: drawCanvas, ctx: drawCtx };
    }
    if (isDouyinMiniGameHost()) {
      const gl = screen.getContext("webgl") || screen.getContext("webgl2");
      if (gl) {
        const present = createWebglPresenter(screen, gl, drawCanvas);
        if (present) {
          console.info("[crush-crush] douyin helium: offscreen 2d + webgl present");
          return { canvas: drawCanvas, ctx: drawCtx, present };
        }
      }
    }
    console.warn("[crush-crush] using secondary 2d canvas without presenter");
    return { canvas: drawCanvas, ctx: drawCtx };
  }
  function bindMainCanvas2d() {
    const g = globalThis;
    if (g[CANVAS_BINDING_CACHE_KEY]) {
      return g[CANVAS_BINDING_CACHE_KEY];
    }
    const binding = bindMainCanvas2dOnce();
    g[CANVAS_BINDING_CACHE_KEY] = binding;
    if (isDouyinMiniGameHost() && !binding.present) {
      console.warn("[crush-crush] douyin: no canvas presenter \u2014 screen may stay on splash");
    }
    return binding;
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
    } catch (e) {
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
          brand: String((deviceInfo == null ? void 0 : deviceInfo.brand) || ""),
          model: String((deviceInfo == null ? void 0 : deviceInfo.model) || ""),
          pixelRatio: finiteOr(windowInfo == null ? void 0 : windowInfo.pixelRatio, 2),
          screenWidth: finiteOr(windowInfo == null ? void 0 : windowInfo.screenWidth, 375),
          screenHeight: finiteOr(windowInfo == null ? void 0 : windowInfo.screenHeight, 667),
          windowWidth: finiteOr(windowInfo == null ? void 0 : windowInfo.windowWidth, 375),
          windowHeight: finiteOr(windowInfo == null ? void 0 : windowInfo.windowHeight, 667),
          language: String((appBase == null ? void 0 : appBase.language) || "zh"),
          version: String((appBase == null ? void 0 : appBase.version) || ""),
          system: String((deviceInfo == null ? void 0 : deviceInfo.system) || ""),
          platform: String((deviceInfo == null ? void 0 : deviceInfo.platform) || ""),
          SDKVersion: String((appBase == null ? void 0 : appBase.SDKVersion) || ""),
          statusBarHeight: windowInfo == null ? void 0 : windowInfo.statusBarHeight,
          benchmarkLevel: deviceInfo == null ? void 0 : deviceInfo.benchmarkLevel,
          safeArea: windowInfo == null ? void 0 : windowInfo.safeArea
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
    } catch (e) {
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
    } catch (e) {
      return null;
    }
  }
  function platformOf(info) {
    return String((info == null ? void 0 : info.platform) || "").toLowerCase();
  }
  function isWxDesktopClient() {
    const platform = platformOf(readWxInfo());
    return platform === "mac" || platform === "windows";
  }
  function isWxDevtoolsHost() {
    var _a;
    if (isDouyinMiniGameHost()) {
      try {
        const nav = globalThis.navigator;
        const ua = (nav == null ? void 0 : nav.userAgent) || "";
        if (/bytedance|devtools|ide/i.test(ua)) {
          return true;
        }
      } catch (e) {
      }
    }
    const info = readWxInfo();
    const platform = platformOf(info);
    if (platform === "devtools") {
      return true;
    }
    const brand = String((info == null ? void 0 : info.brand) || "").toLowerCase();
    const model = String((info == null ? void 0 : info.model) || "").toLowerCase();
    if (brand.includes("devtools") || model.includes("devtools")) {
      return true;
    }
    try {
      const nav = globalThis.navigator;
      if ((nav == null ? void 0 : nav.userAgent) && /devtools|wechatdevtools/i.test(nav.userAgent)) {
        return true;
      }
    } catch (e) {
    }
    const g = globalThis;
    return String(((_a = g.__wxConfig) == null ? void 0 : _a.platform) || "").toLowerCase() === "devtools";
  }
  function isWxDesktopIdeHost() {
    return isWxDevtoolsHost() || isWxDesktopClient();
  }
  function readWxMiniProgramEnvVersion() {
    return readMiniProgramEnvVersion();
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
    return isWxCustomAdHostSupported((info == null ? void 0 : info.platform) || "");
  }
  function canCreateWxFullscreenAds() {
    return canCreateWxNativeAds();
  }
  function isLowEndWxDevice(info) {
    const level = info == null ? void 0 : info.benchmarkLevel;
    if (typeof level !== "number" || level < 0) {
      return false;
    }
    return level < 8;
  }
  function resolveWxRenderProfile(info, desktopIde) {
    if (desktopIde) {
      return {
        dpr: Math.min(2, Math.max(2, (info == null ? void 0 : info.pixelRatio) || 2)),
        lite: true,
        cheapFx: false,
        frameDelayMs: 50,
        useRaf: false,
        fps: 20
      };
    }
    if (isLowEndWxDevice(info)) {
      return {
        dpr: 1,
        lite: true,
        cheapFx: true,
        frameDelayMs: 33,
        useRaf: false,
        fps: 30
      };
    }
    const pr = Math.max(1, (info == null ? void 0 : info.pixelRatio) || 1);
    return {
      dpr: Math.min(2, pr),
      lite: false,
      cheapFx: false,
      frameDelayMs: 33,
      useRaf: false,
      fps: 30
    };
  }

  // src/core/adapters/WxAdAdapter.ts
  function isRewardedPlacement(placement) {
    return placement === "rewarded_revive" || placement === "rewarded_crush_extend";
  }
  function isInterstitialPlacement(placement) {
    return placement === "interstitial_settle";
  }
  function isPlaceholderUnitId(adUnitId) {
    return !adUnitId || adUnitId.startsWith("TODO_") || adUnitId.includes("UNIT_ID");
  }
  var REWARDED_MIN_WATCH_MS = 14e3;
  var INTERSTITIAL_WATCHDOG = {
    openMs: 8e3,
    watchMs: 18e4
  };
  var REWARDED_WATCHDOG = {
    openMs: 12e3,
    pendingMaxMs: 6e4,
    watchMs: 18e4
  };
  function isRewardedVideoCompleted(res, shownMs = 0) {
    if (shownMs >= REWARDED_MIN_WATCH_MS) {
      return true;
    }
    if (!res || typeof res.isEnded !== "boolean") {
      return true;
    }
    return res.isEnded === true;
  }
  var WxAdAdapter = class {
    /**
     * @param units - 各广告位 adUnitId；可用 ad-placements.json 注入
     */
    constructor(units) {
      this.readyMap = /* @__PURE__ */ new Map();
      this.rewardedSlots = /* @__PURE__ */ new Map();
      this.interstitialSlots = /* @__PURE__ */ new Map();
      this.bannerSlot = null;
      /** 进关后禁止再露出；迟到的 show() 必须据此立刻 hide */
      this.bannerWanted = false;
      this.disposed = false;
      this.units = units;
    }
    /**
     * 预加载指定广告位。
     * @param placement - 广告位
     */
    async load(placement) {
      if (this.disposed) {
        return;
      }
      if (placement === "banner_lobby") {
        const slot = this.ensureBanner();
        this.readyMap.set(placement, !!slot);
        return;
      }
      if (isRewardedPlacement(placement)) {
        const unitId = placement === "rewarded_revive" ? this.units.rewarded_revive : this.units.rewarded_crush_extend;
        if (isPlaceholderUnitId(unitId)) {
          this.readyMap.set(placement, false);
          return;
        }
        const slot = this.ensureRewarded(placement);
        if (!slot) {
          this.readyMap.set(placement, false);
          return;
        }
        this.readyMap.set(placement, false);
        try {
          await slot.ad.load();
        } catch (e) {
          this.readyMap.set(placement, false);
        }
        return;
      }
      if (isInterstitialPlacement(placement)) {
        if (isPlaceholderUnitId(this.units.interstitial_settle)) {
          this.readyMap.set(placement, false);
          return;
        }
        const existing = this.interstitialSlots.get(placement);
        const slot = this.ensureInterstitial(placement);
        if (!slot) {
          this.readyMap.set(placement, false);
          return;
        }
        if (!existing) {
          return;
        }
        try {
          await slot.ad.load();
        } catch (err) {
          console.warn("[crush-crush] interstitial load failed", err);
          this.readyMap.set(placement, false);
        }
      }
    }
    /**
     * 展示广告。
     * @param placement - 广告位
     * @returns completed / skipped / error / not_ready
     */
    async show(placement) {
      if (this.disposed) {
        return "error";
      }
      if (placement === "banner_lobby") {
        return this.showBanner();
      }
      if (isRewardedPlacement(placement)) {
        const unitId = placement === "rewarded_revive" ? this.units.rewarded_revive : this.units.rewarded_crush_extend;
        if (isPlaceholderUnitId(unitId)) {
          return "not_ready";
        }
      }
      if (isInterstitialPlacement(placement) && isPlaceholderUnitId(this.units.interstitial_settle)) {
        return "not_ready";
      }
      if (isInterstitialPlacement(placement)) {
        return this.showInterstitial(placement);
      }
      if (!this.isReady(placement)) {
        await this.load(placement);
        if (!this.isReady(placement)) {
          return "not_ready";
        }
      }
      if (isRewardedPlacement(placement)) {
        return this.showRewarded(placement);
      }
      return "error";
    }
    /**
     * 广告是否就绪。
     * @param placement - 广告位
     */
    isReady(placement) {
      return this.readyMap.get(placement) === true;
    }
    /**
     * 隐藏大厅横幅。激励 / 插屏无持续展示，忽略。
     * 即使本地还没记成可见，也要 hide：show() 可能仍在加载，进关后会迟到上屏。
     */
    hide(placement) {
      if (placement !== "banner_lobby" || this.disposed) {
        return;
      }
      this.bannerWanted = false;
      this.forceHideBanner();
    }
    forceHideBanner(force = false) {
      var _a, _b;
      const slot = this.bannerSlot;
      if (!slot) {
        return;
      }
      const showing = force || slot.visible || slot.attached || ((_b = (_a = slot.ad).isShow) == null ? void 0 : _b.call(_a)) === true;
      slot.visible = false;
      if (!showing) {
        return;
      }
      try {
        void slot.ad.hide();
      } catch (e) {
      }
      slot.attached = false;
    }
    /**
     * 销毁全部广告实例并卸载监听，防止微信环境泄漏。
     */
    dispose() {
      this.disposed = true;
      for (const slot of this.rewardedSlots.values()) {
        slot.ad.offLoad(slot.onLoad);
        slot.ad.offError(slot.onError);
        slot.ad.offClose();
        try {
          slot.ad.destroy();
        } catch (e) {
        }
      }
      this.rewardedSlots.clear();
      for (const slot of this.interstitialSlots.values()) {
        slot.ad.offLoad(slot.onLoad);
        slot.ad.offError(slot.onError);
        slot.ad.offClose();
        try {
          slot.ad.destroy();
        } catch (e) {
        }
      }
      this.interstitialSlots.clear();
      this.destroyBanner();
      this.readyMap.clear();
    }
    ensureRewarded(placement) {
      const existing = this.rewardedSlots.get(placement);
      if (existing) {
        return existing;
      }
      const adUnitId = placement === "rewarded_revive" ? this.units.rewarded_revive : this.units.rewarded_crush_extend;
      if (isPlaceholderUnitId(adUnitId)) {
        return null;
      }
      if (!canCreateWxFullscreenAds()) {
        return null;
      }
      let ad;
      try {
        ad = wx.createRewardedVideoAd({ adUnitId });
      } catch (err) {
        console.warn("[crush-crush] createRewardedVideoAd failed", err);
        return null;
      }
      const onLoad = () => {
        this.readyMap.set(placement, true);
      };
      const onError = () => {
        this.readyMap.set(placement, false);
      };
      ad.onLoad(onLoad);
      ad.onError(onError);
      const slot = { ad, onLoad, onError };
      this.rewardedSlots.set(placement, slot);
      return slot;
    }
    ensureInterstitial(placement) {
      const existing = this.interstitialSlots.get(placement);
      if (existing) {
        return existing;
      }
      if (isPlaceholderUnitId(this.units.interstitial_settle)) {
        return null;
      }
      if (!canCreateWxFullscreenAds()) {
        return null;
      }
      let ad;
      try {
        ad = wx.createInterstitialAd({
          adUnitId: this.units.interstitial_settle
        });
      } catch (err) {
        console.warn("[crush-crush] createInterstitialAd failed", err);
        return null;
      }
      const onLoad = () => {
        this.readyMap.set(placement, true);
      };
      const onError = (err) => {
        console.warn("[crush-crush] interstitial error", err == null ? void 0 : err.errCode, err == null ? void 0 : err.errMsg);
        this.readyMap.set(placement, false);
      };
      ad.onLoad(onLoad);
      ad.onError(onError);
      const slot = { ad, onLoad, onError };
      this.interstitialSlots.set(placement, slot);
      return slot;
    }
    ensureBanner() {
      var _a, _b, _c, _d;
      if (this.bannerSlot) {
        return this.bannerSlot;
      }
      const adUnitId = (_a = this.units.banner_lobby) != null ? _a : "";
      if (isPlaceholderUnitId(adUnitId)) {
        return null;
      }
      if (!canCreateWxNativeAds() || typeof wx.createCustomAd !== "function") {
        return null;
      }
      const info = readWxSystemInfo();
      const safeBottom = Math.max(
        0,
        info.windowHeight - ((_c = (_b = info.safeArea) == null ? void 0 : _b.bottom) != null ? _c : info.windowHeight)
      );
      const box = toNativeViewStyle(
        layoutLobbyBannerStyle(
          info.windowWidth || info.screenWidth,
          info.windowHeight || info.screenHeight,
          safeBottom
        )
      );
      if (!box) {
        return null;
      }
      let ad;
      try {
        ad = wx.createCustomAd({
          adUnitId,
          adIntervals: 30,
          style: {
            left: box.left,
            top: box.top,
            width: box.width
          }
        });
      } catch (err) {
        console.warn("[crush-crush] createCustomAd failed", err);
        return null;
      }
      const onLoad = () => {
        this.readyMap.set("banner_lobby", true);
        if (!this.bannerWanted) {
          this.forceHideBanner();
        }
      };
      const onError = (err) => {
        console.warn(
          "[crush-crush] lobby customAd error",
          err == null ? void 0 : err.errCode,
          err == null ? void 0 : err.errMsg
        );
        this.readyMap.set("banner_lobby", false);
        if (this.bannerSlot) {
          this.bannerSlot.visible = false;
        }
      };
      const onHide = () => {
        if (this.bannerSlot) {
          this.bannerSlot.visible = false;
        }
      };
      ad.onLoad(onLoad);
      ad.onError(onError);
      (_d = ad.onHide) == null ? void 0 : _d.call(ad, onHide);
      this.bannerSlot = { ad, onLoad, onError, onHide, visible: false, attached: false };
      return this.bannerSlot;
    }
    destroyBanner() {
      var _a, _b;
      const slot = this.bannerSlot;
      if (!slot) {
        return;
      }
      slot.ad.offLoad(slot.onLoad);
      slot.ad.offError(slot.onError);
      (_b = (_a = slot.ad).offHide) == null ? void 0 : _b.call(_a, slot.onHide);
      if (slot.attached || !isWxDevtoolsHost()) {
        try {
          slot.ad.destroy();
        } catch (e) {
        }
      }
      this.bannerSlot = null;
    }
    async showBanner() {
      var _a, _b;
      this.bannerWanted = true;
      const slot = this.ensureBanner();
      if (!slot) {
        this.readyMap.set("banner_lobby", false);
        return "not_ready";
      }
      if (!this.bannerWanted) {
        this.forceHideBanner();
        return "error";
      }
      if (slot.visible || ((_b = (_a = slot.ad).isShow) == null ? void 0 : _b.call(_a))) {
        if (!this.bannerWanted) {
          this.forceHideBanner();
          return "error";
        }
        slot.visible = true;
        this.readyMap.set("banner_lobby", true);
        return "completed";
      }
      try {
        await slot.ad.show();
        slot.attached = true;
        if (!this.bannerWanted) {
          this.forceHideBanner(true);
          return "error";
        }
        slot.visible = true;
        this.readyMap.set("banner_lobby", true);
        return "completed";
      } catch (err) {
        console.warn("[crush-crush] lobby customAd show failed", err);
        slot.visible = false;
        slot.attached = false;
        this.readyMap.set("banner_lobby", false);
        return "error";
      }
    }
    showRewarded(placement) {
      const slot = this.ensureRewarded(placement);
      if (!slot) {
        return Promise.resolve("not_ready");
      }
      this.readyMap.set(placement, false);
      return new Promise((resolve) => {
        var _a, _b;
        let settled = false;
        let shown = false;
        let showInFlight = true;
        let watchdog = 0;
        const startedAt = Date.now();
        const unhookApp = () => {
          var _a2, _b2;
          try {
            (_a2 = wx.offHide) == null ? void 0 : _a2.call(wx, onAppHide);
          } catch (e) {
          }
          try {
            (_b2 = wx.offShow) == null ? void 0 : _b2.call(wx, onAppShow);
          } catch (e) {
          }
        };
        const finish = (result) => {
          if (settled) {
            return;
          }
          settled = true;
          if (watchdog) {
            clearTimeout(watchdog);
            watchdog = 0;
          }
          unhookApp();
          slot.ad.offClose(onClose);
          resolve(result);
          void this.load(placement);
        };
        const shownMsNow = () => Math.max(0, Date.now() - startedAt);
        const onClose = (res) => {
          shown = true;
          finish(isRewardedVideoCompleted(res, shownMsNow()) ? "completed" : "skipped");
        };
        const onAppHide = () => {
          if (settled) {
            return;
          }
          shown = true;
          armWatchdog(18e4);
        };
        const onAppShow = () => {
          if (settled || shownMsNow() < REWARDED_MIN_WATCH_MS) {
            return;
          }
          setTimeout(() => {
            if (settled) {
              return;
            }
            finish(isRewardedVideoCompleted({}, shownMsNow()) ? "completed" : "skipped");
          }, 400);
        };
        const armWatchdog = (ms) => {
          if (settled) {
            return;
          }
          if (watchdog) {
            clearTimeout(watchdog);
          }
          watchdog = setTimeout(() => {
            if (settled) {
              return;
            }
            if (shown) {
              finish(
                isRewardedVideoCompleted({ isEnded: false }, shownMsNow()) ? "completed" : "skipped"
              );
              return;
            }
            if (showInFlight && shownMsNow() < REWARDED_WATCHDOG.pendingMaxMs) {
              armWatchdog(REWARDED_WATCHDOG.openMs);
              return;
            }
            finish("not_ready");
          }, ms);
        };
        slot.ad.onClose(onClose);
        try {
          (_a = wx.onHide) == null ? void 0 : _a.call(wx, onAppHide);
          (_b = wx.onShow) == null ? void 0 : _b.call(wx, onAppShow);
        } catch (e) {
        }
        armWatchdog(REWARDED_WATCHDOG.openMs);
        slot.ad.show().then(() => {
          showInFlight = false;
          shown = true;
          armWatchdog(REWARDED_WATCHDOG.watchMs);
        }).catch(() => {
          void slot.ad.load().then(() => slot.ad.show()).then(() => {
            showInFlight = false;
            shown = true;
            armWatchdog(REWARDED_WATCHDOG.watchMs);
          }).catch(() => {
            showInFlight = false;
            if (shown) {
              armWatchdog(REWARDED_WATCHDOG.watchMs);
              return;
            }
            armWatchdog(600);
          });
        });
      });
    }
    showInterstitial(placement) {
      const slot = this.ensureInterstitial(placement);
      if (!slot) {
        return Promise.resolve("not_ready");
      }
      return new Promise((resolve) => {
        let settled = false;
        let shown = false;
        let watchdog = 0;
        const finish = (result) => {
          if (settled) {
            return;
          }
          settled = true;
          if (watchdog) {
            clearTimeout(watchdog);
            watchdog = 0;
          }
          slot.ad.offClose(onClose);
          resolve(result);
        };
        const onClose = () => {
          shown = true;
          finish("completed");
          void this.load(placement);
        };
        const armWatchdog = (ms) => {
          if (settled) {
            return;
          }
          if (watchdog) {
            clearTimeout(watchdog);
          }
          watchdog = setTimeout(() => {
            if (settled) {
              return;
            }
            if (shown) {
              finish("completed");
              void this.load(placement);
              return;
            }
            finish("error");
          }, ms);
        };
        armWatchdog(INTERSTITIAL_WATCHDOG.openMs);
        slot.ad.onClose(onClose);
        slot.ad.show().then(() => {
          shown = true;
          armWatchdog(INTERSTITIAL_WATCHDOG.watchMs);
        }).catch((err) => {
          console.warn(
            "[crush-crush] interstitial show failed",
            err == null ? void 0 : err.errCode,
            err == null ? void 0 : err.errMsg
          );
          if ((err == null ? void 0 : err.errCode) !== 2001) {
            void this.load(placement);
          }
          if (shown) {
            armWatchdog(INTERSTITIAL_WATCHDOG.watchMs);
            return;
          }
          finish("error");
        });
      });
    }
  };

  // src/core/adapters/WxAudioAdapter.ts
  var CLIP_SRC = {
    sfx_swap: "assets/main/audio/sfx_swap.wav",
    sfx_match: "assets/main/audio/sfx_match.wav",
    sfx_good: "assets/main/audio/sfx_good.mp3",
    sfx_great: "assets/main/audio/sfx_great.mp3",
    sfx_excellent: "assets/main/audio/sfx_excellent.mp3",
    sfx_win: "assets/main/audio/sfx_win.wav",
    sfx_fail: "assets/main/audio/sfx_fail.wav",
    sfx_crush: "assets/main/audio/sfx_crush.wav",
    sfx_ui: "assets/main/audio/sfx_ui.wav",
    sfx_shuffle: "assets/main/audio/sfx_shuffle.wav",
    sfx_hammer: "assets/main/audio/sfx_hammer.wav",
    sfx_extra: "assets/main/audio/sfx_extra.wav",
    bgm_main: "assets/main/audio/bgm_main.mp3"
  };
  var BGM_ID = "bgm_main";
  var POOL_LIMIT = 8;
  var SFX_CLIP_IDS = Object.keys(CLIP_SRC).filter((id) => id !== BGM_ID);
  var WxAudioAdapter = class {
    constructor() {
      this.muted = false;
      this.pool = /* @__PURE__ */ new Map();
      this.active = /* @__PURE__ */ new Set();
      this.ready = /* @__PURE__ */ new WeakSet();
      this.pendingPlay = /* @__PURE__ */ new WeakSet();
      this.bgm = null;
      this.bgmWanted = false;
      this.bgmVolume = 0.38;
      this.innerAudioOptionApplied = false;
      this.bgmKeepAliveTimer = 0;
      this.lastBgmPlayMs = 0;
      /** BGM 已成功 kick 过；paused 读不到时禁止被音效保活反复 play 造成爆音 */
      this.bgmPlayingAssumed = false;
    }
    play(clipId, options) {
      var _a;
      if (clipId === BGM_ID || (options == null ? void 0 : options.loop)) {
        this.playBgm(clipId, options == null ? void 0 : options.volume);
        return;
      }
      if (this.muted) {
        return;
      }
      const src = CLIP_SRC[clipId];
      if (!src || typeof wx === "undefined" || typeof wx.createInnerAudioContext !== "function") {
        return;
      }
      this.applyInnerAudioOption();
      const ctx = this.acquire(src);
      ctx.loop = false;
      ctx.volume = (_a = options == null ? void 0 : options.volume) != null ? _a : 0.8;
      this.startSfx(ctx);
      this.scheduleBgmKeepAlive();
    }
    suspendForBackground() {
      this.bgmPlayingAssumed = false;
      if (!this.bgm) {
        return;
      }
      try {
        this.bgm.pause();
      } catch (e) {
        try {
          this.bgm.stop();
        } catch (e2) {
        }
      }
    }
    resumeFromBackground() {
      if (!isWxDesktopIdeHost()) {
        this.unlockWebAudio();
      }
      this.resumeBgm();
    }
    preloadSfx() {
      if (typeof wx === "undefined" || typeof wx.createInnerAudioContext !== "function") {
        return;
      }
      this.applyInnerAudioOption();
      if (!isWxDesktopIdeHost()) {
        this.unlockWebAudio();
      }
      for (const id of SFX_CLIP_IDS) {
        const src = CLIP_SRC[id];
        if (src) {
          this.ensurePooled(src);
        }
      }
    }
    stop(clipId) {
      if (clipId === BGM_ID) {
        this.stopBgm(false);
        return;
      }
      const src = CLIP_SRC[clipId];
      if (!src) {
        return;
      }
      const list = this.pool.get(src);
      if (!list) {
        return;
      }
      for (const ctx of list) {
        this.pendingPlay.delete(ctx);
        try {
          ctx.stop();
        } catch (e) {
        }
      }
    }
    stopAll() {
      for (const ctx of this.active) {
        this.pendingPlay.delete(ctx);
        try {
          ctx.stop();
        } catch (e) {
        }
      }
      this.stopBgm(false);
    }
    setMuted(muted) {
      this.muted = muted;
      if (muted) {
        for (const ctx of this.active) {
          this.pendingPlay.delete(ctx);
          try {
            ctx.stop();
          } catch (e) {
          }
        }
        if (this.bgm) {
          try {
            this.bgm.pause();
          } catch (e) {
            try {
              this.bgm.stop();
            } catch (e2) {
            }
          }
          this.bgmPlayingAssumed = false;
        }
        return;
      }
      if (this.bgmWanted) {
        this.resumeBgm();
      }
    }
    isMuted() {
      return this.muted;
    }
    dispose() {
      if (this.bgmKeepAliveTimer) {
        clearTimeout(this.bgmKeepAliveTimer);
        this.bgmKeepAliveTimer = 0;
      }
      this.stopAll();
      if (this.bgm) {
        try {
          this.bgm.destroy();
        } catch (e) {
        }
        this.bgm = null;
      }
      for (const list of this.pool.values()) {
        for (const ctx of list) {
          try {
            ctx.destroy();
          } catch (e) {
          }
        }
      }
      this.pool.clear();
      this.active.clear();
    }
    playBgm(clipId, volume) {
      var _a;
      this.bgmWanted = true;
      if (typeof volume === "number") {
        this.bgmVolume = volume;
      }
      if (this.muted) {
        return;
      }
      const src = (_a = CLIP_SRC[clipId]) != null ? _a : CLIP_SRC[BGM_ID];
      if (!src || typeof wx === "undefined" || typeof wx.createInnerAudioContext !== "function") {
        return;
      }
      this.applyInnerAudioOption();
      if (!this.bgm) {
        this.bgm = this.createContext(false);
        this.bgm.src = src;
        this.bgm.loop = true;
        this.bgm.obeyMuteSwitch = false;
        this.bgm.onError((err) => {
          var _a2;
          console.warn("[audio] bgm failed", src, (_a2 = err == null ? void 0 : err.errMsg) != null ? _a2 : err);
        });
      }
      this.bgm.volume = this.bgmVolume;
      if (!this.shouldKickBgm()) {
        return;
      }
      try {
        this.bgm.play();
        this.lastBgmPlayMs = Date.now();
        this.bgmPlayingAssumed = true;
      } catch (e) {
      }
    }
    scheduleBgmKeepAlive() {
      if (!this.bgmWanted || this.muted) {
        return;
      }
      if (this.bgm && this.bgm.paused === false) {
        return;
      }
      if (this.bgm && this.bgm.paused !== true && this.bgmPlayingAssumed) {
        return;
      }
      if (this.bgmKeepAliveTimer) {
        clearTimeout(this.bgmKeepAliveTimer);
      }
      this.bgmKeepAliveTimer = setTimeout(() => {
        this.bgmKeepAliveTimer = 0;
        this.resumeBgm();
      }, 120);
    }
    resumeBgm() {
      if (!this.bgmWanted || this.muted) {
        return;
      }
      if (!this.bgm) {
        this.playBgm(BGM_ID, this.bgmVolume);
        return;
      }
      this.bgm.volume = this.bgmVolume;
      if (!this.shouldKickBgm()) {
        return;
      }
      try {
        this.bgm.play();
        this.lastBgmPlayMs = Date.now();
        this.bgmPlayingAssumed = true;
      } catch (e) {
      }
    }
    /**
     * 仅在 BGM 确实需要重启时返回 true。
     * paused 读不到时禁止周期性 play()，否则微信里会叠轨产生沙沙声/爆音。
     */
    shouldKickBgm() {
      if (!this.bgm) {
        return true;
      }
      if (this.bgm.paused === false) {
        this.bgmPlayingAssumed = true;
        return false;
      }
      if (this.bgm.paused === true) {
        this.bgmPlayingAssumed = false;
        return true;
      }
      return !this.bgmPlayingAssumed;
    }
    stopBgm(clearWant) {
      if (clearWant) {
        this.bgmWanted = false;
      }
      this.bgmPlayingAssumed = false;
      if (!this.bgm) {
        return;
      }
      try {
        this.bgm.stop();
      } catch (e) {
      }
    }
    applyInnerAudioOption() {
      if (this.innerAudioOptionApplied) {
        return;
      }
      this.innerAudioOptionApplied = true;
      if (typeof wx.setInnerAudioOption !== "function") {
        return;
      }
      try {
        wx.setInnerAudioOption({
          obeyMuteSwitch: false,
          mixWithOther: true
        });
      } catch (e) {
      }
    }
    unlockWebAudio() {
      var _a, _b, _c, _d;
      try {
        if (this.webAudioCtx === void 0) {
          this.webAudioCtx = (_b = (_a = wx.createWebAudioContext) == null ? void 0 : _a.call(wx)) != null ? _b : null;
        }
        void ((_d = (_c = this.webAudioCtx) == null ? void 0 : _c.resume) == null ? void 0 : _d.call(_c));
      } catch (e) {
      }
    }
    startSfx(ctx) {
      var _a;
      if (this.ready.has(ctx)) {
        this.pendingPlay.delete(ctx);
        try {
          (_a = ctx.seek) == null ? void 0 : _a.call(ctx, 0);
        } catch (e) {
        }
        try {
          ctx.play();
        } catch (e) {
        }
        return;
      }
      this.pendingPlay.add(ctx);
      try {
        ctx.play();
      } catch (e) {
      }
    }
    ensurePooled(src) {
      let list = this.pool.get(src);
      if (!list) {
        list = [];
        this.pool.set(src, list);
      }
      if (list.length > 0) {
        return list[0];
      }
      const ctx = this.createSfxContext(src);
      list.push(ctx);
      return ctx;
    }
    acquire(src) {
      let list = this.pool.get(src);
      if (!list) {
        list = [];
        this.pool.set(src, list);
      }
      for (const ctx2 of list) {
        if (!this.active.has(ctx2)) {
          this.active.add(ctx2);
          return ctx2;
        }
      }
      if (list.length >= POOL_LIMIT) {
        const reuse = list[0];
        this.active.add(reuse);
        return reuse;
      }
      const ctx = this.createSfxContext(src);
      list.push(ctx);
      this.active.add(ctx);
      return ctx;
    }
    createSfxContext(src) {
      var _a;
      const ctx = this.createContext(true);
      ctx.autoplay = false;
      ctx.loop = false;
      ctx.obeyMuteSwitch = false;
      (_a = ctx.onCanplay) == null ? void 0 : _a.call(ctx, () => {
        this.ready.add(ctx);
        if (this.pendingPlay.has(ctx)) {
          this.pendingPlay.delete(ctx);
          try {
            ctx.play();
          } catch (e) {
          }
        }
      });
      ctx.onEnded(() => this.active.delete(ctx));
      ctx.onError((err) => {
        var _a2;
        console.warn("[audio] sfx failed", src, (_a2 = err == null ? void 0 : err.errMsg) != null ? _a2 : err);
        this.active.delete(ctx);
        this.pendingPlay.delete(ctx);
      });
      ctx.src = src;
      return ctx;
    }
    createContext(useWebAudio) {
      try {
        const useWeb = useWebAudio && !isWxDesktopIdeHost();
        return wx.createInnerAudioContext(
          useWeb ? { useWebAudioImplement: true } : void 0
        );
      } catch (e) {
        return wx.createInnerAudioContext();
      }
    }
  };

  // src/core/adapters/WxAnalyticsAdapter.ts
  var WxAnalyticsAdapter = class {
    track(event, props) {
      if (typeof wx.reportEvent === "function") {
        wx.reportEvent(event, props != null ? props : {});
        return;
      }
      console.info("[analytics]", event, props != null ? props : {});
    }
  };

  // src/core/utils/wxLaunchQuery.ts
  function normalizeWxQuery(query) {
    if (!query || typeof query !== "object") {
      return {};
    }
    const out = {};
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === "") {
        continue;
      }
      out[key] = String(value);
    }
    return out;
  }
  function readWxLaunchQuery() {
    if (typeof wx === "undefined") {
      return {};
    }
    try {
      const launch = typeof wx.getLaunchOptionsSync === "function" ? wx.getLaunchOptionsSync() : null;
      const enter = typeof wx.getEnterOptionsSync === "function" ? wx.getEnterOptionsSync() : null;
      return {
        ...normalizeWxQuery(launch == null ? void 0 : launch.query),
        ...normalizeWxQuery(enter == null ? void 0 : enter.query)
      };
    } catch (e) {
      return {};
    }
  }

  // src/core/adapters/WxPlatformAdapter.ts
  var WxPlatformAdapter = class {
    getSystemInfo() {
      var _a, _b;
      const info = readWxSystemInfo();
      return {
        brand: info.brand,
        model: info.model,
        platform: info.platform,
        system: info.system,
        SDKVersion: info.SDKVersion,
        windowWidth: info.windowWidth,
        windowHeight: info.windowHeight,
        pixelRatio: info.pixelRatio,
        safeAreaBottom: Math.max(
          0,
          info.windowHeight - ((_b = (_a = info.safeArea) == null ? void 0 : _a.bottom) != null ? _b : info.windowHeight)
        )
      };
    }
    onShow(handler) {
      wx.onShow(handler);
    }
    onHide(handler) {
      wx.onHide(handler);
    }
    offShow(handler) {
      wx.offShow(handler);
    }
    offHide(handler) {
      wx.offHide(handler);
    }
    getLaunchQuery() {
      return readWxLaunchQuery();
    }
  };

  // src/core/adapters/WxShareAdapter.ts
  var DEFAULT_IMAGE = "assets/main/share/lobby-500x400.jpg";
  var WxShareAdapter = class {
    constructor() {
      this.provider = () => ({
        title: "\u5347\u7EA7\u65B0\u4F53\u9A8C\uFF0C\u5FEB\u6765\u4E00\u8D77\u73A9",
        imageUrl: DEFAULT_IMAGE,
        query: ""
      });
      this.enabled = false;
    }
    /**
     * 绑定动态分享内容（大厅 / 对局 / 结算等）。
     */
    setProvider(provider) {
      this.provider = provider;
    }
    /**
     * 开启右上角「转发」「分享到朋友圈」，并在任意页面生效。
     */
    enable() {
      if (this.enabled) {
        return;
      }
      this.enabled = true;
      if (typeof wx.showShareMenu === "function") {
        try {
          wx.showShareMenu({
            withShareTicket: true,
            menus: ["shareAppMessage", "shareTimeline"]
          });
        } catch (err) {
          console.warn("[crush-crush] showShareMenu failed", err);
        }
      }
      if (typeof wx.onShareAppMessage === "function") {
        wx.onShareAppMessage(() => this.buildMessage());
      }
      if (typeof wx.onShareTimeline === "function") {
        wx.onShareTimeline(() => this.buildTimeline());
      }
    }
    /**
     * 用户点击游戏内「分享」按钮时主动拉起转发（需在触摸回调里调用）。
     */
    shareToFriend() {
      const payload = this.buildMessage();
      if (typeof wx.shareAppMessage !== "function") {
        return false;
      }
      try {
        wx.shareAppMessage(payload);
        return true;
      } catch (err) {
        console.warn("[crush-crush] shareAppMessage failed", err);
        return false;
      }
    }
    /**
     * 拉起公众号贴图发表页。小游戏环境若无此接口则返回 false。
     * 取消 / 完成都会 resolve，方便把画布循环拉回来。
     */
    shareToOfficialAccount(post) {
      const shareToOfficialAccount = wx.shareToOfficialAccount;
      if (typeof shareToOfficialAccount !== "function") {
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        let settled = false;
        const done = (opened) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(opened);
        };
        try {
          shareToOfficialAccount({
            title: post.title,
            content: post.content,
            tags: post.tags.slice(0, 10),
            images: post.images,
            recommendTitle: post.recommendTitle,
            success: (res) => {
              console.info("[crush-crush] official-account post", res.status, res.postUrl);
              done(true);
            },
            fail: (err) => {
              console.warn("[crush-crush] shareToOfficialAccount failed", err);
              done(true);
            },
            complete: () => done(true)
          });
        } catch (err) {
          console.warn("[crush-crush] shareToOfficialAccount threw", err);
          done(false);
        }
      });
    }
    /**
     * 海报分享菜单：好友 / 朋友圈 / 保存；部分基础库会带「发表到公众号」。
     * 用户取消也会 complete，必须据此恢复游戏循环。
     */
    sharePoster(path, entrancePath = "") {
      const showShareImageMenu = wx.showShareImageMenu;
      if (!path || typeof showShareImageMenu !== "function") {
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        let settled = false;
        const done = (opened) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(opened);
        };
        try {
          showShareImageMenu({
            path,
            needShowEntrance: true,
            entrancePath,
            success: () => done(true),
            fail: () => done(true),
            complete: () => done(true)
          });
        } catch (err) {
          console.warn("[crush-crush] showShareImageMenu failed", err);
          done(false);
        }
      });
    }
    dispose() {
      if (typeof wx.offShareAppMessage === "function") {
        wx.offShareAppMessage();
      }
      if (typeof wx.offShareTimeline === "function") {
        wx.offShareTimeline();
      }
      this.enabled = false;
    }
    buildMessage() {
      return this.normalize(this.provider());
    }
    buildTimeline() {
      const p = this.provider();
      const title = p.title.length > 28 ? `${p.title.slice(0, 26)}\u2026` : p.title;
      return this.normalize({ ...p, title });
    }
    normalize(p) {
      var _a;
      const imageUrlId = (_a = p.imageUrlId) == null ? void 0 : _a.trim();
      const message = {
        title: p.title || "\u5347\u7EA7\u65B0\u4F53\u9A8C\uFF0C\u5FEB\u6765\u4E00\u8D77\u73A9",
        imageUrl: p.imageUrl || DEFAULT_IMAGE,
        query: p.query || ""
      };
      if (imageUrlId) {
        message.imageUrlId = imageUrlId;
      }
      return message;
    }
  };

  // src/core/utils/math.ts
  function clamp(value, min, max) {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }
  function createSeededRandom(seed) {
    let t = seed >>> 0;
    return () => {
      t += 1831565813;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
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
          ...EMPTY_BOOSTER_DAILY,
          // 跨天清空每日任务计数（任务表由日期重新生成）
          tasks: void 0
        },
        grantedHammer: true
      };
    }
    return {
      data: {
        ymd: prev.ymd,
        bonusHammer: prev.bonusHammer,
        clearsToday: prev.clearsToday,
        ...flags,
        ...prev.tasks ? { tasks: prev.tasks } : {}
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
  function claimDailyShuffle(data) {
    if (data.clearsToday < DAILY_GOAL_CLEARS || data.playShuffleGranted) {
      return { data, granted: false };
    }
    return {
      data: { ...data, playShuffleGranted: true },
      granted: true
    };
  }

  // src/logic/board/TileType.ts
  var BASIC_TILE_KINDS = [
    1 /* Red */,
    2 /* Blue */,
    3 /* Green */,
    4 /* Yellow */,
    5 /* Purple */,
    9 /* Bear */,
    10 /* Pig */,
    11 /* Panda */,
    12 /* Corgi */
  ];
  function isBasicTile(kind) {
    return BASIC_TILE_KINDS.includes(kind);
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

  // src/logic/economy/DailyTasks.ts
  var DAILY_TASK_COUNT = 4;
  var DAILY_CHEST_REWARDS = [{ id: "hammer", amount: 1 }];
  var EMPTY_DAILY_TASK_COUNTERS = {
    tiles: 0,
    specials: 0,
    maxChain: 0,
    crushRounds: 0,
    collected: {},
    threeStars: 0,
    boostersUsed: 0,
    claimed: [],
    chestClaimed: false
  };
  var FIXED_TASK = {
    id: "clear_levels",
    target: DAILY_GOAL_CLEARS,
    reward: { id: "shuffle", amount: 1 }
  };
  var POOL = [
    { id: "clear_tiles", targets: [220, 260, 300], reward: { id: "hammer", amount: 1 } },
    { id: "make_specials", targets: [4, 5, 6], reward: { id: "extraMoves", amount: 1 } },
    { id: "combo_chain", targets: [4], reward: { id: "extraMoves", amount: 1 } },
    { id: "crush_rounds", targets: [1], reward: { id: "extraMoves", amount: 1 } },
    { id: "collect_kind", targets: [55, 75], reward: { id: "hammer", amount: 1 } },
    { id: "three_star", targets: [2, 3], reward: { id: "hammer", amount: 1 } },
    { id: "use_boosters", targets: [2, 3], reward: { id: "shuffle", amount: 1 } }
  ];
  var COLLECT_KINDS = [
    1 /* Red */,
    2 /* Blue */,
    3 /* Green */,
    4 /* Yellow */
  ];
  var KIND_NAME = {
    [1 /* Red */]: "\u7EA2\u72D0",
    [2 /* Blue */]: "\u84DD\u5154",
    [3 /* Green */]: "\u7EFF\u86D9",
    [4 /* Yellow */]: "\u9EC4\u9E21"
  };
  var VALID_KINDS = /* @__PURE__ */ new Set([FIXED_TASK.id, ...POOL.map((item) => item.id)]);
  function hashYmd(ymd) {
    let h = 2166136261;
    for (let i = 0; i < ymd.length; i += 1) {
      h ^= ymd.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function nextRand(state) {
    state.s = Math.imul(state.s, 1664525) + 1013904223 >>> 0;
    return state.s / 4294967296;
  }
  function dailyTasksFor(ymd) {
    const rand = { s: hashYmd(ymd || "none") || 1 };
    const pool = POOL.slice();
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRand(rand) * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, DAILY_TASK_COUNT - 1).map((item) => {
      const target = item.targets[Math.floor(nextRand(rand) * item.targets.length)];
      const def = { id: item.id, target, reward: { ...item.reward } };
      if (item.id === "collect_kind") {
        def.tileKind = COLLECT_KINDS[Math.floor(nextRand(rand) * COLLECT_KINDS.length)];
      }
      return def;
    });
    return [{ ...FIXED_TASK, reward: { ...FIXED_TASK.reward } }, ...picked];
  }
  function dailyTaskTitle(def) {
    var _a, _b;
    const t = def.target;
    switch (def.id) {
      case "clear_levels":
        return `\u901A\u5173 ${t} \u5173`;
      case "clear_tiles":
        return `\u6D88\u9664\u840C\u5BA0${t}\u53EA`;
      case "make_specials":
        return `\u5408\u6210 ${t} \u4E2A\u95EA\u5149\u6216\u732B\u5934\u9E70`;
      case "combo_chain":
        return `\u4E00\u6B65\u6253\u51FA ${t} \u8FDE\u51FB`;
      case "crush_rounds":
        return t <= 1 ? "\u7C89\u788E1\u5C40" : `\u7C89\u788E${t}\u5C40`;
      case "collect_kind":
        return `\u6536\u96C6 ${t} \u53EA${(_b = KIND_NAME[(_a = def.tileKind) != null ? _a : 1 /* Red */]) != null ? _b : "\u840C\u5BA0"}`;
      case "three_star":
        return `\u4E09\u661F\u901A\u5173 ${t} \u6B21`;
      case "use_boosters":
        return `\u4F7F\u7528\u9053\u5177 ${t} \u6B21`;
      default:
        return "\u6BCF\u65E5\u4EFB\u52A1";
    }
  }
  function nonNeg(value) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  function parseDailyTaskCounters(raw) {
    if (!raw || typeof raw !== "object") {
      return { ...EMPTY_DAILY_TASK_COUNTERS, collected: {}, claimed: [] };
    }
    const data = raw;
    const collected = {};
    if (data.collected && typeof data.collected === "object") {
      for (const [key, value] of Object.entries(data.collected)) {
        const n = nonNeg(value);
        if (n > 0) {
          collected[key] = n;
        }
      }
    }
    const claimed = Array.isArray(data.claimed) ? data.claimed.filter((id) => typeof id === "string" && VALID_KINDS.has(id)) : [];
    return {
      tiles: nonNeg(data.tiles),
      specials: nonNeg(data.specials),
      maxChain: nonNeg(data.maxChain),
      crushRounds: nonNeg(data.crushRounds),
      collected,
      threeStars: nonNeg(data.threeStars),
      boostersUsed: nonNeg(data.boostersUsed),
      claimed: [...new Set(claimed)],
      chestClaimed: !!data.chestClaimed
    };
  }
  function mergeDailyTaskCounters(a, b) {
    var _a;
    const x = parseDailyTaskCounters(a);
    const y = parseDailyTaskCounters(b);
    const collected = { ...x.collected };
    for (const [key, value] of Object.entries(y.collected)) {
      collected[key] = Math.max((_a = collected[key]) != null ? _a : 0, value);
    }
    return {
      tiles: Math.max(x.tiles, y.tiles),
      specials: Math.max(x.specials, y.specials),
      maxChain: Math.max(x.maxChain, y.maxChain),
      crushRounds: Math.max(x.crushRounds, y.crushRounds),
      collected,
      threeStars: Math.max(x.threeStars, y.threeStars),
      boostersUsed: Math.max(x.boostersUsed, y.boostersUsed),
      claimed: [.../* @__PURE__ */ new Set([...x.claimed, ...y.claimed])],
      chestClaimed: x.chestClaimed || y.chestClaimed
    };
  }
  function progressOf(def, data, c) {
    var _a, _b;
    switch (def.id) {
      case "clear_levels":
        return data.clearsToday;
      case "clear_tiles":
        return c.tiles;
      case "make_specials":
        return c.specials;
      case "combo_chain":
        return c.maxChain;
      case "crush_rounds":
        return c.crushRounds;
      case "collect_kind":
        return (_b = c.collected[String((_a = def.tileKind) != null ? _a : 1 /* Red */)]) != null ? _b : 0;
      case "three_star":
        return c.threeStars;
      case "use_boosters":
        return c.boostersUsed;
      default:
        return 0;
    }
  }
  function isClaimed(def, data, c) {
    if (c.claimed.includes(def.id)) {
      return true;
    }
    return def.id === "clear_levels" && !!data.playShuffleGranted;
  }
  function viewDailyTasks(data) {
    const counters = parseDailyTaskCounters(data.tasks);
    const tasks = dailyTasksFor(data.ymd).map((def) => {
      const progress = Math.min(def.target, progressOf(def, data, counters));
      return {
        ...def,
        title: dailyTaskTitle(def),
        progress,
        done: progress >= def.target,
        claimed: isClaimed(def, data, counters)
      };
    });
    const allClaimed = tasks.every((task) => task.claimed);
    const chestReady = allClaimed && !counters.chestClaimed;
    const claimable = tasks.filter((task) => task.done && !task.claimed).length + (chestReady ? 1 : 0);
    return {
      tasks,
      claimable,
      chestReady,
      chestClaimed: counters.chestClaimed,
      chest: DAILY_CHEST_REWARDS.map((item) => ({ ...item }))
    };
  }
  function recordDailyTaskStats(data, patch, nowMs) {
    var _a;
    const aligned = applyDailyLogin(data, nowMs).data;
    const before = viewDailyTasks(aligned).tasks;
    const c = parseDailyTaskCounters(aligned.tasks);
    c.tiles += nonNeg(patch.tiles);
    c.specials += nonNeg(patch.specials);
    c.maxChain = Math.max(c.maxChain, nonNeg(patch.chain));
    if (patch.crushRound) {
      c.crushRounds += 1;
    }
    if (patch.collectedKinds) {
      for (const kind of patch.collectedKinds) {
        const key = String(kind);
        c.collected[key] = ((_a = c.collected[key]) != null ? _a : 0) + 1;
      }
    }
    if (patch.threeStar) {
      c.threeStars += 1;
    }
    if (patch.boosterUsed) {
      c.boostersUsed += 1;
    }
    const next = { ...aligned, tasks: c };
    const after = viewDailyTasks(next).tasks;
    const completed = after.filter((task, i) => task.done && !task.claimed && !before[i].done);
    return { data: next, completed };
  }
  function claimDailyTask(data, taskId) {
    const view = viewDailyTasks(data);
    const task = view.tasks.find((item) => item.id === taskId);
    if (!task || !task.done || task.claimed) {
      return { data, reward: null };
    }
    const c = parseDailyTaskCounters(data.tasks);
    c.claimed = [...c.claimed, task.id];
    const next = {
      ...data,
      tasks: c,
      playShuffleGranted: task.id === "clear_levels" ? true : data.playShuffleGranted
    };
    return { data: next, reward: { ...task.reward } };
  }
  function claimDailyChest(data, doubled) {
    if (!viewDailyTasks(data).chestReady) {
      return { data, rewards: null };
    }
    const c = parseDailyTaskCounters(data.tasks);
    c.chestClaimed = true;
    const factor = doubled ? 2 : 1;
    return {
      data: { ...data, tasks: c },
      rewards: DAILY_CHEST_REWARDS.map((item) => ({ id: item.id, amount: item.amount * factor }))
    };
  }
  var BOOSTER_NAME = {
    hammer: "\u9524\u5B50",
    shuffle: "\u91CD\u6392",
    extraMoves: "\u52A0\u6B65"
  };
  function formatDailyReward(rewards) {
    return rewards.filter((item) => item.amount > 0).map((item) => `${BOOSTER_NAME[item.id]} x${item.amount}`).join("\u3001");
  }

  // src/logic/economy/ladderCoins.ts
  var LADDER_SCORE_PER_COIN = 100;
  function formatLadderCoinChip(coins) {
    const n = Math.max(0, Math.floor(coins));
    return n > 0 ? `\u9986${n}` : "\u99860";
  }
  function ladderCoinsFromScore(score) {
    if (!Number.isFinite(score) || score <= 0) {
      return 0;
    }
    return Math.floor(score / LADDER_SCORE_PER_COIN);
  }
  function totalLadderCoinsEarned(levelScores) {
    if (!levelScores) {
      return 0;
    }
    let sum = 0;
    for (const value of Object.values(levelScores)) {
      sum += ladderCoinsFromScore(Number(value));
    }
    return sum;
  }
  function ladderCoinsSpent(data) {
    const n = data.ladderCoinsSpent;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
      return 0;
    }
    return Math.floor(n);
  }
  function ladderCoinsAvailable(data) {
    const earned = totalLadderCoinsEarned(data.levelScores);
    return Math.max(0, earned - ladderCoinsSpent(data));
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
    const stars = {};
    const rawStars = data.levelStars;
    if (rawStars && typeof rawStars === "object") {
      for (const [key, value] of Object.entries(rawStars)) {
        const id = Number(key);
        const n = Math.floor(Number(value));
        if (!Number.isFinite(id) || id < 1 || !Number.isFinite(n) || n < 1) {
          continue;
        }
        stars[String(Math.floor(id))] = Math.min(3, n);
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
      levelScores: scores,
      levelStars: stars,
      ladderCoinsSpent: asNonNegInt(data.ladderCoinsSpent, 0)
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
      var _a, _b;
      return {
        ...this.data,
        levelScores: { ...(_a = this.data.levelScores) != null ? _a : {} },
        levelStars: { ...(_b = this.data.levelStars) != null ? _b : {} }
      };
    }
    /** 该关历史最高星级；没记录返回 0 */
    getStars(levelId) {
      var _a, _b;
      return (_b = (_a = this.data.levelStars) == null ? void 0 : _a[String(levelId)]) != null ? _b : 0;
    }
    getHighestLevelId() {
      return this.data.highestLevelId;
    }
    getBestScore(levelId) {
      var _a, _b;
      return (_b = (_a = this.data.levelScores) == null ? void 0 : _a[String(levelId)]) != null ? _b : 0;
    }
    getLadderCoinsForLevel(levelId) {
      return ladderCoinsFromScore(this.getBestScore(levelId));
    }
    getLadderCoinsAvailable() {
      return ladderCoinsAvailable(this.data);
    }
    spendLadderCoins(amount) {
      const cost = Math.floor(amount);
      if (cost <= 0) {
        return true;
      }
      if (this.getLadderCoinsAvailable() < cost) {
        return false;
      }
      this.data.ladderCoinsSpent = ladderCoinsSpent(this.data) + cost;
      return true;
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
    markLevelCleared(levelId, score, stars = 0) {
      var _a, _b, _c, _d;
      this.data.lastPlayedLevelId = levelId;
      const scores = (_a = this.data.levelScores) != null ? _a : this.data.levelScores = {};
      const key = String(levelId);
      const starCount = Math.min(3, Math.max(0, Math.floor(stars)));
      if (starCount > 0) {
        const starMap = (_b = this.data.levelStars) != null ? _b : this.data.levelStars = {};
        starMap[key] = Math.max((_c = starMap[key]) != null ? _c : 0, starCount);
      }
      const prev = (_d = scores[key]) != null ? _d : 0;
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

  // src/logic/save/mergeMahjongCloudSave.ts
  function mergeStars(a, b) {
    var _a;
    const out = { ...a };
    for (const [key, value] of Object.entries(b)) {
      out[key] = Math.max((_a = out[key]) != null ? _a : 0, value);
    }
    return out;
  }
  function mergeTools(a, b) {
    var _a, _b;
    const out = { ...EMPTY_MAHJONG_TOOLS, ...a };
    for (const k of Object.keys(EMPTY_MAHJONG_TOOLS)) {
      out[k] = Math.max((_a = a[k]) != null ? _a : 0, (_b = b[k]) != null ? _b : 0);
    }
    return out;
  }
  function tilesRemaining(run) {
    return run.pile.length + run.slots.length;
  }
  function mergeMahjongSavedRun(local, remote) {
    if (!local) {
      return remote;
    }
    if (!remote) {
      return local;
    }
    const localPlaying = local.phase === "playing";
    const remotePlaying = remote.phase === "playing";
    if (local.phase === "lost" && remote.phase === "playing") {
      return local;
    }
    if (remote.phase === "lost" && local.phase === "playing") {
      return remote;
    }
    if (localPlaying && !remotePlaying) {
      return local;
    }
    if (remotePlaying && !localPlaying) {
      return remote;
    }
    if (local.phase === "lost" && remote.phase === "lost") {
      return local;
    }
    if (localPlaying && remotePlaying) {
      const leftLocal = tilesRemaining(local);
      const leftRemote = tilesRemaining(remote);
      if (leftLocal !== leftRemote) {
        return leftLocal < leftRemote ? local : remote;
      }
      return local.remainingMs >= remote.remainingMs ? local : remote;
    }
    return null;
  }
  function mergeMahjongProgress(local, remote) {
    var _a, _b;
    const a = normalizeMahjongProgress(local);
    if (!remote) {
      return a;
    }
    const b = normalizeMahjongProgress(remote);
    return normalizeMahjongProgress({
      coins: Math.max(a.coins, b.coins),
      highestUnlocked: Math.max(a.highestUnlocked, b.highestUnlocked),
      starsByLevel: mergeStars(a.starsByLevel, b.starsByLevel),
      tools: mergeTools(a.tools, b.tools),
      guideSeen: a.guideSeen || b.guideSeen,
      savedRun: mergeMahjongSavedRun(a.savedRun, b.savedRun),
      blockedReplayLevel: (_b = (_a = a.blockedReplayLevel) != null ? _a : b.blockedReplayLevel) != null ? _b : null
    });
  }

  // src/logic/save/mergePlayerCloudSave.ts
  function mergeLevelProgress(local, remote) {
    var _a, _b, _c, _d, _e, _f;
    const a = normalizeLevelProgressData(local);
    const b = normalizeLevelProgressData(remote);
    const scores = { ...(_a = a.levelScores) != null ? _a : {} };
    for (const [key, value] of Object.entries((_b = b.levelScores) != null ? _b : {})) {
      const prev = (_c = scores[key]) != null ? _c : 0;
      if (value > prev) {
        scores[key] = value;
      }
    }
    const stars = { ...(_d = a.levelStars) != null ? _d : {} };
    for (const [key, value] of Object.entries((_e = b.levelStars) != null ? _e : {})) {
      stars[key] = Math.max((_f = stars[key]) != null ? _f : 0, value);
    }
    return normalizeLevelProgressData({
      highestLevelId: Math.max(a.highestLevelId, b.highestLevelId),
      totalScore: Math.max(a.totalScore, b.totalScore),
      lastPlayedLevelId: a.highestLevelId >= b.highestLevelId ? a.lastPlayedLevelId : b.lastPlayedLevelId,
      levelScores: scores,
      levelStars: stars,
      ladderCoinsSpent: Math.max(ladderCoinsSpent(a), ladderCoinsSpent(b))
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
      shareFriendHammer: flagsA.shareFriendHammer || flagsB.shareFriendHammer,
      shareFriendShuffle: flagsA.shareFriendShuffle || flagsB.shareFriendShuffle,
      shareFriendExtra: flagsA.shareFriendExtra || flagsB.shareFriendExtra,
      shareGroupHammer: flagsA.shareGroupHammer || flagsB.shareGroupHammer,
      shareGroupShuffle: flagsA.shareGroupShuffle || flagsB.shareGroupShuffle,
      shareGroupExtra: flagsA.shareGroupExtra || flagsB.shareGroupExtra,
      playShuffleGranted: flagsA.playShuffleGranted || flagsB.playShuffleGranted,
      playExtraGranted: flagsA.playExtraGranted || flagsB.playExtraGranted,
      tasks: mergeDailyTaskCounters(a.tasks, b.tasks)
    };
  }
  function mergePlayerCloudSnapshots(local, remote) {
    var _a, _b;
    if (!remote) {
      return {
        ...local,
        progress: normalizeLevelProgressData(local.progress),
        boosters: clampBoosterWallet(local.boosters),
        invite: parseInviteCloudSlice(local.invite),
        mahjong: mergeMahjongProgress((_a = local.mahjong) != null ? _a : emptyMahjongProgress(), null),
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
      ),
      mahjong: mergeMahjongProgress(
        (_b = local.mahjong) != null ? _b : emptyMahjongProgress(),
        remote.mahjong
      )
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
      var _a;
      const wantS = Math.max(0, Math.floor(snowmen));
      const wantP = Math.max(0, Math.floor(penguins));
      const skip = Math.max(0, Math.floor((_a = options == null ? void 0 : options.skipTopRows) != null ? _a : 0));
      const requireIce = (options == null ? void 0 : options.requireIce) === true;
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
      var _a;
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
        const want = Math.max(0, Math.floor((_a = options.count) != null ? _a : 12));
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
      var _a, _b;
      const wantOwls = Math.max(0, Math.floor((_a = options.owls) != null ? _a : 0));
      const wantSpark = Math.max(0, Math.floor((_b = options.sparkles) != null ? _b : 0));
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
        var _a2;
        if (slots.length === 0) {
          return null;
        }
        const pick = next() % slots.length;
        return (_a2 = slots.splice(pick, 1)[0]) != null ? _a2 : null;
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
    /**
     * 底部满铺若干行，再在上一行居中盖 centerCap 格（如底 2 行满 + 第三层居中 3 格）。
     * 行 0 为底。
     */
    coverBottomRowsWithCloudCap(bottomRows, centerCap) {
      let n = this.coverBottomRowsWithCloud(bottomRows);
      const base = Math.max(0, Math.min(this.size.rows, Math.floor(bottomRows)));
      if (base >= this.size.rows) {
        return n;
      }
      const cap = Math.max(0, Math.min(this.size.cols, Math.floor(centerCap)));
      if (cap <= 0) {
        return n;
      }
      const startCol = Math.floor((this.size.cols - cap) / 2);
      const r = base;
      for (let c = startCol; c < startCol + cap; c += 1) {
        const i = this.index(r, c);
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
    /**
     * 底部满铺若干行，最上一层中间 topCenterGap 格留空；
     * rightClear > 0 时，其下各层再清空右侧若干列（最上层两侧翅膀保留）。
     * 行 0 为底。
     */
    coverBottomRowsWithCloudTopGap(bottomRows, topCenterGap, rightClear = 0) {
      const rows = Math.max(0, Math.min(this.size.rows, Math.floor(bottomRows)));
      const cols = this.size.cols;
      const gap = Math.max(0, Math.min(cols, Math.floor(topCenterGap)));
      const gapStart = Math.floor((cols - gap) / 2);
      const clearRight = Math.max(0, Math.min(cols, Math.floor(rightClear)));
      const topRow = rows - 1;
      let n = 0;
      for (let r = 0; r < rows; r += 1) {
        const skipCenter = gap > 0 && r === topRow;
        const skipRight = clearRight > 0 && r < topRow;
        for (let c = 0; c < cols; c += 1) {
          if (skipCenter && c >= gapStart && c < gapStart + gap) {
            continue;
          }
          if (skipRight && c >= cols - clearRight) {
            continue;
          }
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
    /** 居中铺若干行棉花（上下留白，行 0 为底），返回格数。
     * bottomCenterGap：最底一层中间留空若干格（第四层中间 3 格不盖棉）。 */
    coverMiddleRowsWithCloud(midRows, bottomCenterGap = 0) {
      const total = this.size.rows;
      const cols = this.size.cols;
      const want = Math.max(0, Math.min(total, Math.floor(midRows)));
      const start = Math.floor((total - want) / 2);
      const end = start + want;
      const gap = Math.max(0, Math.min(cols, Math.floor(bottomCenterGap)));
      const gapStart = Math.floor((cols - gap) / 2);
      let n = 0;
      for (let r = start; r < end; r += 1) {
        const skipCenter = gap > 0 && r === start;
        for (let c = 0; c < cols; c += 1) {
          if (skipCenter && c >= gapStart && c < gapStart + gap) {
            continue;
          }
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
  function generatePlayableBoard(board, seed, basicKindCount = BASIC_TILE_KINDS.length) {
    const random = createSeededRandom(seed);
    const { rows, cols } = board.size;
    const kindCount = Math.min(
      BASIC_TILE_KINDS.length,
      Math.max(1, Math.floor(basicKindCount))
    );
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
    var _a;
    if (rows === 6 && cols === 6) {
      return ((_a = HEART_6[row]) == null ? void 0 : _a[col]) === 1;
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
      const midR = (rows - 1) / 2;
      const midC = (cols - 1) / 2;
      if (Number.isInteger(midR) && Number.isInteger(midC)) {
        const arm = rows >= 7 ? 1 : 0;
        return Math.abs(row - midR) <= arm || Math.abs(col - midC) <= arm;
      }
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
    if (shape === "hourglass" || shape === "hourglass_wide") {
      const y = rows <= 1 ? 0.5 : row / (rows - 1);
      const x = cols <= 1 ? 0.5 : (col + 0.5) / cols;
      const waist = shape === "hourglass_wide" ? 0.16 : 0.14;
      const half = waist + Math.abs(y - 0.5) * 0.58;
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
      this.finder = finder != null ? finder : new MatchFinder();
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
      this.basicKindCount = BASIC_TILE_KINDS.length;
      /** 下落记录缓冲（复用对象）。 */
      this.fellScratch = [];
      /** 新生记录缓冲（复用对象）。 */
      this.spawnedScratch = [];
      /** 消除种类缓冲（复用）。 */
      this.clearedKindScratch = [];
      this.fellCount = 0;
      this.spawnedCount = 0;
      this.clearedKindCount = 0;
      this.finder = finder != null ? finder : new MatchFinder(maxCells);
      this.clearIndices = new Int32Array(maxCells);
      this.clearCapacity = maxCells;
    }
    /** 与当前梯子关一致的萌宠种类数（填充新块时使用）。 */
    setBasicKindCount(count) {
      this.basicKindCount = Math.min(
        BASIC_TILE_KINDS.length,
        Math.max(1, Math.floor(count))
      );
    }
    /**
     * 从给定匹配集合开始，执行完整连锁结算。
     * @param board - 棋盘（会被原地修改）
     * @param initialMatches - 首轮待消除集合；若为空且无 initialClearIndices 则直接返回零结果
     * @param options - 种子与连锁上限
     * @returns 结算结果（`fell` / `spawned` 为新数组快照，可安全保留）
     */
    resolve(board, initialMatches, options) {
      var _a, _b, _c;
      this.resetCounters();
      const random = createSeededRandom(options.seed);
      const maxCascade = (_a = options.maxCascade) != null ? _a : DEFAULT_MAX_CASCADE;
      let cleared = 0;
      let iceBroken = 0;
      let cascadeDepth = 0;
      const waves = [];
      let clearIndicesList = (_c = (_b = options.initialClearIndices) == null ? void 0 : _b.slice()) != null ? _c : Array.from(initialMatches.indices.subarray(0, initialMatches.size));
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
      const kindCount = this.basicKindCount;
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

  // src/logic/level/Match3ProceduralGenerator.ts
  var SHAPES = [
    "diamond",
    "heart",
    "plus",
    "ring",
    "double_ring",
    "split_3_4",
    "hourglass",
    "hourglass_wide"
  ];
  var PET_NAMES = {
    [1 /* Red */]: "\u7EA2\u72D0",
    [2 /* Blue */]: "\u84DD\u5154",
    [3 /* Green */]: "\u7EFF\u86D9",
    [4 /* Yellow */]: "\u9EC4\u9E21",
    [5 /* Purple */]: "\u7D2B\u732B",
    [9 /* Bear */]: "\u68D5\u718A",
    [10 /* Pig */]: "\u5C0F\u732A",
    [11 /* Panda */]: "\u718A\u732B",
    [12 /* Corgi */]: "\u67F4\u72AC"
  };
  function pickInt(rng, min, max) {
    if (max <= min) {
      return min;
    }
    return min + Math.floor(rng() * (max - min + 1));
  }
  function pickPetKind(rng, basicKindCount) {
    const kinds = BASIC_TILE_KINDS.slice(0, basicKindCount);
    return kinds[pickInt(rng, 0, kinds.length - 1)];
  }
  function uniqueBadge(features) {
    const uniq = [...new Set(features.filter(Boolean))];
    if (uniq.length === 0) {
      return "\u8FDC\u5173";
    }
    return uniq.slice(0, 3).join("\xB7");
  }
  function buildMeta(levelId, tier, features, rng) {
    const uiVariant = levelId % 12;
    const hue = (levelId * 41 + tier * 17 + pickInt(rng, 0, 359)) % 360;
    const patterns = ["none", "stripe", "sprinkle"];
    const band = Math.floor((tier - 1) / MATCH3_TEMPLATE_LEVEL_COUNT);
    return {
      uiVariant,
      hue,
      badgeShort: uniqueBadge(features),
      entryTitle: band <= 0 ? "\u8FDC\u5173\u6311\u6218" : `\u7B2C ${band + 1} \u8F6E\u7CD6\u679C`,
      entrySubtitle: `${uniqueBadge(features)} \xB7 \u7B2C ${levelId} \u5173`,
      barPattern: patterns[pickInt(rng, 0, patterns.length - 1)]
    };
  }
  function generateProceduralMatch3Level(levelId, seed) {
    const id = Math.max(MATCH3_TEMPLATE_LEVEL_COUNT + 1, Math.floor(levelId));
    const tier = id - MATCH3_TEMPLATE_LEVEL_COUNT;
    const rng = createSeededRandom(seed >>> 0 || 1);
    const features = [];
    const basicKindCount = match3BasicKindCount(id);
    features.push(match3BasicKindLabel(basicKindCount));
    const moves = clamp(
      18 - Math.floor(tier / 3) - pickInt(rng, 0, 1) - Math.max(0, basicKindCount - 6),
      10,
      22
    );
    const board = tier < 8 && rng() < 0.22 ? { rows: 6, cols: 6 } : { rows: 7, cols: 7 };
    const shape = SHAPES[pickInt(rng, 0, SHAPES.length - 1)];
    features.push(shapeLabel(shape));
    const goals = [];
    const config = {
      id,
      seed: seed >>> 0,
      moves,
      board,
      shape,
      basicKindCount,
      goals,
      crushEnabled: true,
      crushDurationMs: clamp(15e3 - tier * 60 + pickInt(rng, -900, 900), 1e4, 15e3),
      starterSpecials: {
        sparkles: clamp(2 + Math.floor(tier / 12) + pickInt(rng, 0, 1), 1, 6),
        owls: tier >= 6 ? clamp(1 + Math.floor(tier / 18) + pickInt(rng, 0, 1), 0, 3) : 0
      }
    };
    const packs = [];
    packs.push(() => {
      var _a;
      const kind = pickPetKind(rng, basicKindCount);
      const count = clamp(10 + Math.floor(tier / 2) + pickInt(rng, 0, 4), 10, 26);
      goals.push({ type: "collect", kind, count });
      features.push((_a = PET_NAMES[kind]) != null ? _a : "\u840C\u5BA0");
    });
    packs.push(() => {
      const gems = clamp(5 + Math.floor(tier / 4) + pickInt(rng, 0, 2), 4, 12);
      config.cloudGems = gems;
      config.cloudRows = pickInt(rng, 1, Math.min(3, 1 + Math.floor(tier / 8)));
      goals.push({ type: "collect_gems", count: gems });
      features.push("\u7C89\u7403", "\u68C9\u82B1");
    });
    packs.push(() => {
      const skip = pickInt(rng, 1, Math.min(3, 1 + Math.floor(tier / 20)));
      config.ice = { skipTopRows: skip };
      if (tier >= 30 && rng() < 0.35) {
        config.iceStyle = "encase";
        features.push("\u51BB\u4F4F");
      }
      goals.push({ type: "clear_ice", count: 24 });
      features.push("\u51B0\u5C01");
    });
    packs.push(() => {
      config.cloud = { bottomRows: pickInt(rng, 2, 3), centerCap: pickInt(rng, 2, 4) };
      config.cloudGems = clamp(6 + Math.floor(tier / 6), 5, 10);
      goals.push({ type: "collect_gems", count: config.cloudGems });
      goals.push({ type: "clear_cloud", count: 12 });
      features.push("\u5F02\u5F62\u68C9", "\u7C89\u7403");
    });
    packs.push(() => {
      config.ice = { skipTopRows: pickInt(rng, 2, 3) };
      const p = clamp(1 + Math.floor(tier / 15) + pickInt(rng, 0, 1), 1, 4);
      config.buried = { snowmen: 0, penguins: p };
      goals.push({ type: "collect_penguins", count: p });
      goals.push({ type: "clear_ice", count: 26 });
      features.push("\u4F01\u9E45", "\u51B0");
    });
    if (tier >= 35) {
      packs.push(() => {
        config.ice = { skipTopRows: 2 };
        config.buried = {
          snowmen: pickInt(rng, 1, 2),
          penguins: pickInt(rng, 1, 2)
        };
        goals.push({ type: "collect_snowmen", count: config.buried.snowmen });
        goals.push({ type: "collect_penguins", count: config.buried.penguins });
        goals.push({ type: "clear_ice", count: 28 });
        features.push("\u96EA\u4EBA", "\u4F01\u9E45");
      });
    }
    const packCount = Math.min(packs.length, 1 + Math.min(2, Math.floor(tier / 10) + (rng() < 0.35 ? 1 : 0)));
    const order = packs.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = pickInt(rng, 0, i);
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    const chosen = /* @__PURE__ */ new Set();
    for (const idx of order) {
      if (chosen.size >= packCount) {
        break;
      }
      if (chosen.has(idx)) {
        continue;
      }
      chosen.add(idx);
      packs[idx]();
    }
    if (goals.length === 0) {
      packs[0]();
    }
    config.goals = goals;
    config.procedural = buildMeta(id, tier, features, rng);
    return config;
  }
  function shapeLabel(shape) {
    switch (shape) {
      case "heart":
        return "\u5FC3\u5F62";
      case "plus":
        return "\u5341\u5B57";
      case "ring":
        return "\u5706\u73AF";
      case "double_ring":
        return "\u53CC\u73AF";
      case "split_3_4":
        return "\u5206\u680F";
      case "hourglass":
        return "\u6C99\u6F0F";
      case "hourglass_wide":
        return "\u5BBD\u8170";
      case "diamond":
        return "\u83F1\u5F62";
      default:
        return "\u5F02\u5F62";
    }
  }

  // src/logic/level/Match3InfiniteLevels.ts
  var MATCH3_TEMPLATE_LEVEL_COUNT = 20;
  var MATCH3_INFINITE_LEVEL_CAP = 5e4;
  var MATCH3_LOBBY_TAIL_LOCKED_LEVELS = 3;
  var SEED_VERSION = 3;
  function hashMatch3LevelSeed(playerKey, levelId) {
    const raw = `${playerKey}|match3|${levelId}|v${SEED_VERSION}`;
    let h = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function cloneTemplate(template) {
    return JSON.parse(JSON.stringify(template));
  }
  function match3TemplateIdForLevel(levelId, templateCount) {
    const n = Math.max(1, Math.floor(templateCount));
    const id = Math.max(1, Math.floor(levelId));
    return (id - 1) % n + 1;
  }
  function resolveMatch3LevelConfig(levelId, templates, playerKey) {
    var _a;
    if (templates.length === 0) {
      throw new Error("Match3 level templates are empty");
    }
    const id = Math.max(1, Math.floor(levelId));
    if (id > MATCH3_INFINITE_LEVEL_CAP) {
      throw new Error(`Level ${id} exceeds cap ${MATCH3_INFINITE_LEVEL_CAP}`);
    }
    if (id > templates.length) {
      const seed = hashMatch3LevelSeed(playerKey, id);
      return generateProceduralMatch3Level(id, seed);
    }
    const templateId = match3TemplateIdForLevel(id, templates.length);
    const template = (_a = templates.find((item) => item.id === templateId)) != null ? _a : templates[0];
    const config = cloneTemplate(template);
    config.id = id;
    return config;
  }
  function match3LobbyDisplayLevelCount(highestLevelId) {
    const unlocked = Math.max(1, Math.floor(highestLevelId));
    const end = unlocked + MATCH3_LOBBY_TAIL_LOCKED_LEVELS;
    return Math.min(
      MATCH3_INFINITE_LEVEL_CAP,
      Math.max(MATCH3_TEMPLATE_LEVEL_COUNT, end)
    );
  }
  function isMatch3LevelWithinCap(levelId) {
    const id = Math.floor(levelId);
    return id >= 1 && id <= MATCH3_INFINITE_LEVEL_CAP;
  }

  // src/logic/level/match3BasicKindCount.ts
  var MATCH3_MAX_BASIC_KINDS = BASIC_TILE_KINDS.length;
  var MIN_KINDS = 3;
  function clampKindCount(n) {
    return Math.min(MATCH3_MAX_BASIC_KINDS, Math.max(MIN_KINDS, Math.floor(n)));
  }
  function match3BasicKindCount(levelId, config) {
    if ((config == null ? void 0 : config.basicKindCount) != null && Number.isFinite(config.basicKindCount)) {
      return clampKindCount(config.basicKindCount);
    }
    const id = Math.max(1, Math.floor(levelId));
    if (id <= MATCH3_TEMPLATE_LEVEL_COUNT) {
      if (id <= 10) {
        return 5;
      }
      if (id <= 15) {
        return 6;
      }
      if (id <= 18) {
        return 7;
      }
      return 8;
    }
    const tier = id - MATCH3_TEMPLATE_LEVEL_COUNT;
    return clampKindCount(8 + Math.floor(tier / 6));
  }
  function match3BasicKindLabel(count) {
    const n = clampKindCount(count);
    return `${n}\u79CD\u840C\u5BA0`;
  }

  // src/config/mahjong-ops.json
  var mahjong_ops_default = {
    version: 1,
    economy: {
      coinCost: 100,
      coinPerTriple: 1,
      starPerTriple: 1
    },
    session: {
      timeoutSec: 720
    },
    generation: {
      seedVersion: 1,
      maxAttempts: 16,
      level1Tiles: 9,
      standardTiles: 105,
      typeCountLevel2: 7,
      typeCountFromLevel3: { min: 8, maxInclusive: 10 }
    },
    theme: {
      level1ThemeId: "default",
      level2ThemeId: "default",
      cycleAfterLevel: 3e3,
      sequentialFromLevel3: false
    },
    levelOverrides: [],
    sampling: {
      enabled: true,
      everyNLevels: 50
    },
    ads: {
      rewardedVideoSlot: true
    },
    tools: {
      freeToUse: true
    },
    _comment: "\u8FD0\u7EF4\u53EF\u901A\u8FC7 CDN opsConfigUrl \u6216\u4E91\u5E93 mahjong_ops/config \u70ED\u66F4\u65B0\uFF1B\u5BA2\u6237\u7AEF\u5408\u5E76\u540E\u4EE5 version \u4E3A\u51C6\u3002"
  };

  // src/config/mahjong-cdn.json
  var mahjong_cdn_default = {
    enabled: false,
    manifestUrl: "",
    opsConfigUrl: "",
    cdnBaseUrl: "",
    manifestVersionKey: "crush.mahjong.themes.version",
    opsConfigVersionKey: "crush.mahjong.ops.version",
    _comment: "enabled=true \u65F6\uFF1A\u542F\u52A8\u62C9 manifestUrl\uFF08\u4E3B\u9898\uFF09\u4E0E opsConfigUrl\uFF08\u7ED3\u6784\u4E0E mahjong-ops.json \u76F8\u540C\uFF09\u3002\u4EA6\u53EF\u8D70\u4E91\u51FD\u6570 getMahjongOps\u3002\u5931\u8D25\u5219\u6CBF\u7528\u5305\u5185\u9ED8\u8BA4\u3002"
  };

  // src/logic/mahjong/MahjongOpsConfig.ts
  var ops = normalizeMahjongOps(mahjong_ops_default);
  var remoteSource = "bundled";
  function clampInt(n, fallback, min, max) {
    const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : fallback;
    return Math.min(max, Math.max(min, v));
  }
  function normalizeMahjongOps(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    const gen = (_a = raw.generation) != null ? _a : {};
    const type3 = (_b = gen.typeCountFromLevel3) != null ? _b : { min: 6, maxInclusive: 8 };
    const minT = clampInt(type3.min, 6, 3, 20);
    const maxT = clampInt(type3.maxInclusive, 8, minT, 20);
    const overrides = Array.isArray(raw.levelOverrides) ? raw.levelOverrides.filter((o) => o && typeof o.level === "number" && o.level >= 1).map((o) => ({
      level: Math.floor(o.level),
      themeId: typeof o.themeId === "string" ? o.themeId : void 0,
      typeCount: typeof o.typeCount === "number" ? clampInt(o.typeCount, 6, 3, 20) : void 0,
      timeoutSec: typeof o.timeoutSec === "number" ? clampInt(o.timeoutSec, 720, 60, 3600) : void 0,
      note: typeof o.note === "string" ? o.note : void 0
    })) : [];
    return {
      version: clampInt(raw.version, 1, 1, 1e6),
      economy: {
        coinCost: clampInt((_c = raw.economy) == null ? void 0 : _c.coinCost, 100, 1, 1e4),
        coinPerTriple: clampInt((_d = raw.economy) == null ? void 0 : _d.coinPerTriple, 1, 0, 100),
        starPerTriple: clampInt((_e = raw.economy) == null ? void 0 : _e.starPerTriple, 1, 0, 100)
      },
      session: {
        timeoutSec: clampInt((_f = raw.session) == null ? void 0 : _f.timeoutSec, 720, 60, 3600)
      },
      generation: {
        seedVersion: clampInt(gen.seedVersion, 1, 1, 1e4),
        maxAttempts: clampInt(gen.maxAttempts, 16, 1, 64),
        level1Tiles: clampInt(gen.level1Tiles, 9, 3, 105),
        standardTiles: clampInt(gen.standardTiles, 105, 9, 105),
        typeCountLevel2: clampInt(gen.typeCountLevel2, 6, 3, 20),
        typeCountFromLevel3: { min: minT, maxInclusive: maxT }
      },
      theme: {
        level1ThemeId: (_h = (_g = raw.theme) == null ? void 0 : _g.level1ThemeId) != null ? _h : "default",
        level2ThemeId: (_j = (_i = raw.theme) == null ? void 0 : _i.level2ThemeId) != null ? _j : "default",
        cycleAfterLevel: clampInt((_k = raw.theme) == null ? void 0 : _k.cycleAfterLevel, 3e3, 10, 5e4),
        sequentialFromLevel3: ((_l = raw.theme) == null ? void 0 : _l.sequentialFromLevel3) === true
      },
      levelOverrides: overrides,
      sampling: {
        enabled: ((_m = raw.sampling) == null ? void 0 : _m.enabled) !== false,
        everyNLevels: clampInt((_n = raw.sampling) == null ? void 0 : _n.everyNLevels, 50, 1, 500)
      },
      ads: {
        rewardedVideoSlot: ((_o = raw.ads) == null ? void 0 : _o.rewardedVideoSlot) !== false
      },
      tools: {
        freeToUse: ((_p = raw.tools) == null ? void 0 : _p.freeToUse) !== false
      }
    };
  }
  function getMahjongOps() {
    return ops;
  }
  function getMahjongOpsVersion() {
    return ops.version;
  }
  function applyMahjongOpsConfig(next, source) {
    ops = normalizeMahjongOps(next);
    remoteSource = source;
  }
  var overrideMap = () => {
    return new Map(ops.levelOverrides.map((o) => [o.level, o]));
  };
  function getMahjongLevelOverride(level) {
    var _a;
    return (_a = overrideMap().get(level)) != null ? _a : null;
  }
  function mahjongThemePickLevel(level) {
    const cycle = ops.theme.cycleAfterLevel;
    if (level <= cycle) {
      return level;
    }
    const span = cycle - 2;
    if (span <= 0) {
      return level;
    }
    return 3 + (level - 3) % span;
  }
  function mahjongTileCountForLevel(level) {
    return level <= 1 ? ops.generation.level1Tiles : ops.generation.standardTiles;
  }
  function mahjongTimeoutMsForLevel(level) {
    var _a;
    const override = getMahjongLevelOverride(level);
    const sec = (_a = override == null ? void 0 : override.timeoutSec) != null ? _a : ops.session.timeoutSec;
    return sec * 1e3;
  }
  function mahjongCoinCost() {
    return ops.economy.coinCost;
  }
  function mahjongCoinPerTriple() {
    return ops.economy.coinPerTriple;
  }
  function mahjongStarPerTriple() {
    return ops.economy.starPerTriple;
  }
  function mahjongSeedVersion() {
    return ops.generation.seedVersion;
  }
  function mahjongGenerationMaxAttempts() {
    return ops.generation.maxAttempts;
  }
  function mahjongStandardTiles() {
    return ops.generation.standardTiles;
  }
  function mahjongLevel1Tiles() {
    return ops.generation.level1Tiles;
  }
  function mahjongTypeCountForGeneration(level, rng) {
    const override = getMahjongLevelOverride(level);
    if ((override == null ? void 0 : override.typeCount) != null) {
      return override.typeCount;
    }
    let base;
    if (level <= 2 || level >= 4) {
      base = ops.generation.typeCountLevel2;
    } else {
      const { min, maxInclusive } = ops.generation.typeCountFromLevel3;
      const span = maxInclusive - min + 1;
      base = min + Math.floor(rng() * span);
    }
    const bonus = level >= 4 ? Math.min(2, Math.floor((Math.max(4, level) - 4) / 25)) : 0;
    return Math.min(10, base + bonus);
  }
  function shouldMahjongOpsSampleLevel(level) {
    if (!ops.sampling.enabled) {
      return false;
    }
    const n = ops.sampling.everyNLevels;
    return level === 1 || level % n === 0;
  }
  function isMahjongRewardedVideoSlotEnabled() {
    return ops.ads.rewardedVideoSlot;
  }
  async function fetchMahjongOpsFromCdn(fetchJson) {
    var _a;
    if (mahjong_cdn_default.enabled !== true) {
      return false;
    }
    const url = ((_a = mahjong_cdn_default.opsConfigUrl) != null ? _a : "").trim();
    if (url.length === 0) {
      return false;
    }
    try {
      const data = await fetchJson(url);
      if (!data || typeof data !== "object") {
        return false;
      }
      applyMahjongOpsConfig(data, "cdn");
      return true;
    } catch (e) {
      return false;
    }
  }
  async function fetchMahjongOpsFromCloud(fetchCloud) {
    try {
      const data = await fetchCloud();
      if (!data || typeof data !== "object") {
        return false;
      }
      applyMahjongOpsConfig(data, "cloud");
      return true;
    } catch (e) {
      return false;
    }
  }

  // src/logic/mahjong/MahjongConfig.ts
  var MAHJONG_BASE_SLOTS = 6;
  var MAHJONG_SLOT_FULL_AD_MOVE_COUNT = 3;
  var MAHJONG_REPLAY_COIN_COST = 300;
  var MAHJONG_HALL_UNLOCK_LADDER_COINS = 300;
  var MAHJONG_COIN_PAYMENTS_ENABLED = false;
  function isMahjongCoinPaymentsEnabled() {
    return MAHJONG_COIN_PAYMENTS_ENABLED;
  }
  var MAHJONG_INFINITE_LEVEL_CAP = 5e4;
  var MAHJONG_GLOBAL_COIN_STAR = "\u2B50";
  function formatMahjongGlobalCoinAmount(amount) {
    const n = Math.max(0, Math.floor(amount));
    return `${n}${MAHJONG_GLOBAL_COIN_STAR}`;
  }
  function formatMahjongGlobalCoinCostLabel(amount) {
    const n = Math.max(0, Math.floor(amount));
    return `${n}\u91D1\u5E01${MAHJONG_GLOBAL_COIN_STAR}`;
  }
  var MAHJONG_TOOL_LABELS = {
    move_out: "\u79FB\u51FA",
    gather: "\u51D1\u9F50",
    shuffle: "\u91CD\u6392",
    reveal: "\u7FFB\u724C"
  };
  var MAHJONG_HALL_LOBBY_CAPTION = "\u840C\u5BA0\u9EBB\u5C06\u9986";

  // src/logic/economy/AdPlacementPolicy.ts
  var AdPlacementPolicy = class {
    /**
     * @param options - 策略配置
     */
    constructor(options = {}) {
      var _a, _b;
      this.offerReviveOnFail = (_a = options.offerReviveOnFail) != null ? _a : true;
      this.interstitialEveryNLevels = (_b = options.interstitialEveryNLevels) != null ? _b : 2;
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
        var _a, _b;
        const target = (_a = this.targets[index]) != null ? _a : this.targetOf(goal);
        const current = (_b = this.progress[index]) != null ? _b : 0;
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
        var _a, _b;
        return ((_a = this.progress[index]) != null ? _a : 0) >= ((_b = this.targets[index]) != null ? _b : this.targetOf(goal));
      });
    }
    /**
     * 根据本波消除种类更新 collect / clear_blocks 类目标。
     * @param kinds - 被消除的方块种类序列
     */
    applyClearedKinds(kinds) {
      var _a, _b;
      if (kinds.length === 0) {
        return;
      }
      for (let i = 0; i < this.goals.length; i += 1) {
        const goal = this.goals[i];
        if (goal.type === "clear_blocks") {
          this.progress[i] = ((_a = this.progress[i]) != null ? _a : 0) + kinds.length;
        } else if (goal.type === "collect") {
          let add = 0;
          for (let k = 0; k < kinds.length; k += 1) {
            if (kinds[k] === goal.kind) {
              add += 1;
            }
          }
          this.progress[i] = ((_b = this.progress[i]) != null ? _b : 0) + add;
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
    extend(ms) {
      this.remainingMs += Math.max(0, ms);
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

  // src/config/levels.json
  var levels_default = [
    {
      id: 1,
      seed: 20250812,
      moves: 14,
      board: { rows: 6, cols: 6 },
      shape: "diamond",
      starterSpecials: { sparkles: 1 },
      goals: [{ type: "collect", kind: 1, count: 10 }],
      crushEnabled: true,
      crushDurationMs: 15e3
    },
    {
      id: 2,
      seed: 20250813,
      moves: 15,
      board: { rows: 6, cols: 6 },
      shape: "heart",
      ice: { bottomRows: 1 },
      starterSpecials: { sparkles: 1 },
      goals: [
        { type: "collect", kind: 2, count: 10 },
        { type: "clear_ice", count: 6 }
      ],
      crushEnabled: true,
      crushDurationMs: 14e3
    },
    {
      id: 3,
      seed: 20250811,
      moves: 16,
      board: { rows: 6, cols: 6 },
      ice: { bottomRows: 2 },
      starterSpecials: { sparkles: 2 },
      goals: [
        { type: "collect", kind: 3, count: 10 },
        { type: "clear_ice", count: 12 }
      ],
      crushEnabled: true,
      crushDurationMs: 13e3
    },
    {
      id: 4,
      seed: 20250814,
      moves: 20,
      board: { rows: 7, cols: 7 },
      ice: { bottomRows: 3 },
      starterSpecials: { sparkles: 2 },
      goals: [
        { type: "collect", kind: 4, count: 10 },
        { type: "collect", kind: 2, count: 8 },
        { type: "clear_ice", count: 21 }
      ],
      crushEnabled: true,
      crushDurationMs: 13e3
    },
    {
      id: 5,
      seed: 20250815,
      moves: 18,
      board: { rows: 7, cols: 7 },
      shape: "diamond",
      ice: { bottomRows: 3 },
      starterSpecials: { sparkles: 2 },
      goals: [
        { type: "collect", kind: 1, count: 12 },
        { type: "clear_ice", count: 15 }
      ],
      crushEnabled: true,
      crushDurationMs: 13e3
    },
    {
      id: 6,
      seed: 20250816,
      moves: 15,
      board: { rows: 7, cols: 7 },
      cloudGems: 8,
      cloudRows: 2,
      starterSpecials: { sparkles: 2 },
      goals: [{ type: "collect_gems", count: 8 }],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 7,
      seed: 20250817,
      moves: 15,
      board: { rows: 7, cols: 7 },
      cloud: { bottomRows: 2, centerCap: 3 },
      cloudGems: 10,
      starterSpecials: { sparkles: 2 },
      goals: [{ type: "collect_gems", count: 10 }],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 8,
      seed: 20250818,
      moves: 14,
      board: { rows: 7, cols: 7 },
      shape: "diamond",
      cloudGems: 10,
      cloudRows: 2,
      starterSpecials: { sparkles: 2 },
      goals: [{ type: "collect_gems", count: 10 }],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 9,
      seed: 20250819,
      moves: 14,
      board: { rows: 7, cols: 7 },
      shape: "plus",
      cloudGems: 9,
      cloudRows: 2,
      starterSpecials: { sparkles: 2 },
      goals: [{ type: "collect_gems", count: 9 }],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 10,
      seed: 20250820,
      moves: 15,
      board: { rows: 7, cols: 7 },
      cloud: { bottomRows: 4, topCenterGap: 3, rightClear: 1 },
      cloudGems: 10,
      starterSpecials: { sparkles: 2 },
      goals: [
        { type: "collect_gems", count: 10 },
        { type: "clear_cloud", count: 22 }
      ],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 11,
      seed: 20250911,
      moves: 15,
      board: { rows: 7, cols: 7 },
      shape: "heart",
      starterSpecials: { owls: 1, sparkles: 2 },
      goals: [
        { type: "collect", kind: 4, count: 16 },
        { type: "collect", kind: 1, count: 14 }
      ],
      crushEnabled: true,
      crushDurationMs: 13e3
    },
    {
      id: 12,
      seed: 20250912,
      moves: 14,
      board: { rows: 7, cols: 7 },
      shape: "ring",
      cloudGems: 9,
      cloudRows: 2,
      starterSpecials: { owls: 1, sparkles: 2 },
      goals: [
        { type: "collect_gems", count: 9 },
        { type: "clear_cloud", count: 9 }
      ],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 13,
      seed: 20250913,
      moves: 15,
      board: { rows: 7, cols: 7 },
      shape: "double_ring",
      ice: { bottomRows: 2 },
      starterSpecials: { owls: 1, sparkles: 2 },
      goals: [
        { type: "collect", kind: 3, count: 14 },
        { type: "clear_ice", count: 14 }
      ],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 14,
      seed: 20250914,
      moves: 14,
      board: { rows: 7, cols: 7 },
      shape: "split_3_4",
      cloudGems: 10,
      cloudRows: 2,
      starterSpecials: { owls: 1, sparkles: 2 },
      goals: [
        { type: "collect_gems", count: 10 },
        { type: "collect", kind: 2, count: 12 }
      ],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 15,
      seed: 20250915,
      moves: 15,
      board: { rows: 7, cols: 7 },
      shape: "hourglass",
      ice: { bottomRows: 2 },
      cloudGems: 10,
      cloudRows: 2,
      starterSpecials: { owls: 1, sparkles: 3 },
      goals: [
        { type: "collect_gems", count: 10 },
        { type: "clear_ice", count: 12 }
      ],
      crushEnabled: true,
      crushDurationMs: 13e3
    },
    {
      id: 16,
      seed: 20250916,
      moves: 15,
      board: { rows: 7, cols: 7 },
      shape: "ring",
      ice: { skipTopRows: 2 },
      starterSpecials: { owls: 1, sparkles: 2 },
      goals: [
        { type: "collect", kind: 4, count: 14 },
        { type: "clear_ice", count: 15 }
      ],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 17,
      seed: 20250917,
      moves: 15,
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
      moves: 14,
      board: { rows: 7, cols: 7 },
      ice: { skipTopRows: 2 },
      iceStyle: "encase",
      buried: { snowmen: 0, penguins: 3 },
      starterSpecials: { owls: 1, sparkles: 3 },
      goals: [
        { type: "collect_penguins", count: 3 },
        { type: "clear_ice", count: 35 }
      ],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 19,
      seed: 20250919,
      moves: 14,
      board: { rows: 7, cols: 7 },
      shape: "double_ring",
      ice: { skipTopRows: 2 },
      iceStyle: "encase",
      buried: { snowmen: 2, penguins: 2 },
      starterSpecials: { owls: 2, sparkles: 3 },
      goals: [
        { type: "collect_snowmen", count: 2 },
        { type: "collect_penguins", count: 2 },
        { type: "clear_ice", count: 26 }
      ],
      crushEnabled: true,
      crushDurationMs: 12e3
    },
    {
      id: 20,
      seed: 20250920,
      moves: 14,
      board: { rows: 7, cols: 7 },
      shape: "hourglass_wide",
      ice: { skipTopRows: 2 },
      cloudGems: 5,
      cloudRows: 2,
      buried: { snowmen: 0, penguins: 2 },
      starterSpecials: { owls: 3, sparkles: 5 },
      goals: [
        { type: "collect_gems", count: 5 },
        { type: "collect_penguins", count: 2 },
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
    cleanDurationMs: 2e4,
    challengeDailyInviteCap: 3,
    dailyRewardPerDay: 1,
    dailyChallenge: {
      poolSize: 20,
      streakDays: 3,
      complete: { id: "shuffle", amount: 1 },
      streak: { id: "extraMoves", amount: 1 }
    },
    leaderboard: {
      limit: 50,
      settleWeekday: 1,
      settleHour: 0,
      tiers: [
        { minRank: 1, maxRank: 1, rewards: [{ id: "hammer", amount: 3 }, { id: "shuffle", amount: 2 }] },
        { minRank: 2, maxRank: 3, rewards: [{ id: "hammer", amount: 2 }, { id: "shuffle", amount: 1 }] },
        { minRank: 4, maxRank: 10, rewards: [{ id: "hammer", amount: 1 }] }
      ]
    }
  };

  // src/config/items.json
  var items_default = {
    extraMoves: {
      moves: 5
    },
    challenge: {
      success: {
        invitee: { id: "extraMoves", amount: 1 },
        inviter: { id: "hammer", amount: 1 }
      },
      fail: {
        invitee: { id: "shuffle", amount: 1 },
        inviter: { id: "shuffle", amount: 1 }
      }
    },
    dailyChallenge: {
      reward: { id: "shuffle", amount: 1 },
      streakReward: { id: "extraMoves", amount: 1 }
    }
  };

  // src/config/notice.json
  var notice_default = {
    id: "post20-gameplay",
    title: "\u516C\u544A",
    body: "\u7CD6\u679C\u68AF\u5B50\u6BCF 100 \u5206 = 1 \u68AF\u5B50\u91D1\u5E01\u2B50\uFF08\u6309\u5404\u5173\u5386\u53F2\u6700\u9AD8\u5206\u7D2F\u8BA1\uFF09\u3002\u7D2F\u8BA1\u6EE1 300 \u91D1\u5E01\u2B50\uFF0C\u6216\u901A\u5173\u7B2C 20 \u5173\uFF0C\u5373\u53EF\u89E3\u9501\u5DE6\u4E0B\u89D2\u300C\u840C\u5BA0\u9EBB\u5C06\u9986\u300D\u3002",
    bodyWhenUnlocked: "\u9080\u8BF7\u597D\u53CB\u901A\u5173\uFF0C\u53CC\u65B9\u5404\u5F97 1 \u9524\u5B50\u3002",
    bubbles: [
      "\u9080\u8BF7\u597D\u53CB\u901A\u5173\uFF0C\u53CC\u65B9\u5404\u5F97 1 \u9524\u5B50",
      "\u7D2F\u8BA1 300 \u68AF\u5B50\u91D1\u5E01\u2B50\uFF0C\u6216\u901A\u5173\u7B2C 20 \u5173\uFF0C\u89E3\u9501\u840C\u5BA0\u9EBB\u5C06\u9986"
    ],
    mahjongHallUnlockTeaser: "\u7D2F\u8BA1 300 \u68AF\u5B50\u91D1\u5E01\u2B50\uFF0C\u6216\u901A\u5173\u7B2C 20 \u5173\uFF0C\u89E3\u9501\u840C\u5BA0\u9EBB\u5C06\u9986",
    mahjongHallLockHint: "\u901A\u5173\u7B2C 20 \u5173\uFF0C\u6216\u68AF\u5B50\u7D2F\u8BA1 300 \u91D1\u5E01\u2B50\uFF0C\u5373\u53EF\u89E3\u9501\u840C\u5BA0\u9EBB\u5C06\u9986",
    postClear: {
      cleared: "\u606D\u559C\u901A\u5173\u7B2C {level} \u5173\uFF01",
      mahjongUnlock: "\u840C\u5BA0\u9EBB\u5C06\u9986\u5DF2\u89E3\u9501\uFF01\u5DE6\u4E0B\u89D2\u5165\u53E3\uFF0C\u968F\u65F6\u6765\u6413\u724C"
    },
    confirm: "\u77E5\u9053\u4E86",
    difficultyUp: "\u96BE\u5EA6\u63D0\u5347",
    difficultyUpCotton: "\u96BE\u5EA6\u63D0\u5347 \xB7 \u68C9\u82B1\u5173\u5F00\u59CB",
    difficultyUpParty: "\u96BE\u5EA6\u63D0\u5347 \xB7 \u5F02\u5F62\u5173\u5361",
    difficultyUpIce: "\u96BE\u5EA6\u63D0\u5347 \xB7 \u51B0\u96EA\u57CB\u85CF",
    leaderboard: {
      title: "\u6392\u884C\u699C",
      tabLevel: "\u5173\u5361\u699C",
      tabWeek: "\u672C\u5468\u699C",
      ruleLevel: "\u6309\u6700\u9AD8\u901A\u5173\u5173\u5361\u6392\u540D\uFF0C\u540C\u5173\u6BD4\u5404\u5173\u6700\u9AD8\u5206\u4E4B\u548C",
      ruleWeek: "\u672C\u5468\u6BCF\u6B21\u901A\u5173\u5F97\u5206\u7D2F\u8BA1\uFF08\u91CD\u73A9\u4E5F\u7B97\uFF09",
      rewardTitle: "\u5468\u5956\u52B1",
      settleNote: "\u6BCF\u5468\u4E00 0 \u70B9\u6309\u540D\u6B21\u53D1\u5956",
      passed: "\u4F60\u88AB {name} \u8D85\u8FC7\u4E86",
      closeGap: "\u8DDD\u79BB\u4E0A\u4E00\u540D\u53EA\u5DEE 1 \u5173\uFF0C\u52A0\u6CB9\uFF01",
      notify: "{name} \u8D85\u8FC7\u4E86\u4F60\u7684\u6392\u540D",
      reward: "\u5468\u5956\u52B1\uFF1A{tiers}",
      rewarded: "\u4E0A\u5468\u672C\u5468\u699C\u7B2C {rank} \u540D\uFF01\u5956\u52B1 {rewards} \u5DF2\u5230\u8D26",
      rewardedFull: "\u4E0A\u5468\u672C\u5468\u699C\u7B2C {rank} \u540D\uFF01\u9053\u5177\u5DF2\u6EE1 9 \u4E2A\uFF0C\u672C\u6B21\u5956\u52B1\u672A\u80FD\u53D1\u653E",
      rewardedNone: "\u4E0A\u5468\u672C\u5468\u699C\u7B2C {rank} \u540D\uFF0C\u524D {top} \u540D\u6709\u5956\u52B1\uFF0C\u672C\u5468\u7EE7\u7EED\u52A0\u6CB9\uFF01",
      empty: "\u6682\u65F6\u8FD8\u6CA1\u6709\u5176\u4ED6\u73A9\u5BB6\u4E0A\u699C\u3002",
      weekEmpty: "\u672C\u5468\u8FD8\u6CA1\u4EBA\u4E0A\u699C\uFF0C\u901A\u5173\u4E00\u5173\u5C31\u80FD\u62FF\u7B2C\u4E00\uFF01",
      unavailable: "\u6392\u884C\u6682\u65F6\u6253\u4E0D\u5F00\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002",
      invite: "\u9080\u8BF7\u597D\u53CB\u6765\u6BD4\u62FC",
      stockFull: "{name}\u5DF2\u6709 9 \u4E2A\uFF0C\u8FD9\u6B21\u6CA1\u6709\u518D\u53D1\u653E"
    },
    dailyTasks: {
      title: "\u6BCF\u65E5\u4EFB\u52A1",
      refresh: "\u6BCF\u5929 0 \u70B9\u5237\u65B0",
      chest: "\u6D3B\u8DC3\u5B9D\u7BB1",
      chestHint: "\u9886\u5B8C 4 \u4E2A\u4EFB\u52A1\u5956\u52B1\u5373\u53EF\u5F00\u542F",
      chestClaim: "\u76F4\u63A5\u9886\u53D6",
      chestDouble: "\u770B\u89C6\u9891\u53CC\u500D",
      lobbyBar: "\u6BCF\u65E5\u4EFB\u52A1 \xB7 {n} \u4E2A\u5956\u52B1\u5F85\u9886\u53D6",
      taskDone: "\u6BCF\u65E5\u4EFB\u52A1\u5B8C\u6210\uFF1A{title}\uFF0C\u56DE\u5927\u5385\u9886\u5956"
    },
    profileWelcome: {
      title: "\u5C55\u793A\u5FAE\u4FE1\u5934\u50CF",
      body: "\u6388\u6743\u540E\uFF0C\u597D\u53CB\u6392\u884C\u4F1A\u663E\u793A\u4F60\u7684\u5934\u50CF\u548C\u6635\u79F0\u3002\u4E5F\u53EF\u8DF3\u8FC7\uFF0C\u4E0D\u5F71\u54CD\u6E38\u73A9\u3002",
      btn: "\u6388\u6743\u5934\u50CF\u6635\u79F0",
      skip: "\u6682\u4E0D\u6388\u6743",
      ok: "\u5934\u50CF\u6635\u79F0\u5DF2\u4FDD\u5B58",
      fail: "\u6682\u65F6\u65E0\u6CD5\u83B7\u53D6\u5934\u50CF\uFF0C\u4E0D\u5F71\u54CD\u7EE7\u7EED\u73A9"
    }
  };

  // src/logic/economy/ChallengeGrants.ts
  var DEFAULT_TIERS = [
    { minRank: 1, maxRank: 1, rewards: [{ id: "hammer", amount: 3 }, { id: "shuffle", amount: 2 }] },
    { minRank: 2, maxRank: 3, rewards: [{ id: "hammer", amount: 2 }, { id: "shuffle", amount: 1 }] },
    { minRank: 4, maxRank: 10, rewards: [{ id: "hammer", amount: 1 }] }
  ];
  function readSpec(raw, fallback) {
    const id = (raw == null ? void 0 : raw.id) === "hammer" || (raw == null ? void 0 : raw.id) === "shuffle" || (raw == null ? void 0 : raw.id) === "extraMoves" ? raw.id : fallback;
    return {
      id,
      amount: Math.max(0, Math.floor(Number(raw == null ? void 0 : raw.amount) || 0))
    };
  }
  function readTiers(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
      return DEFAULT_TIERS.map((tier) => ({ ...tier, rewards: tier.rewards.map((r) => ({ ...r })) }));
    }
    const tiers = [];
    for (const item of raw) {
      const minRank = Math.max(1, Math.floor(Number(item == null ? void 0 : item.minRank) || 1));
      const maxRank = Math.max(minRank, Math.floor(Number(item == null ? void 0 : item.maxRank) || minRank));
      const rewards = Array.isArray(item == null ? void 0 : item.rewards) ? item.rewards.map((r) => readSpec(r, "hammer")) : [];
      tiers.push({ minRank, maxRank, rewards: rewards.filter((r) => r.amount > 0) });
    }
    return tiers.sort((a, b) => a.minRank - b.minRank);
  }
  function readLeaderboardConfig() {
    var _a;
    const raw = balance_default.leaderboard;
    return {
      limit: Math.max(1, Math.floor(Number(raw == null ? void 0 : raw.limit) || 50)),
      settleWeekday: Math.min(6, Math.max(0, Math.floor(Number((_a = raw == null ? void 0 : raw.settleWeekday) != null ? _a : 1)))),
      settleHour: Math.min(23, Math.max(0, Math.floor(Number(raw == null ? void 0 : raw.settleHour) || 0))),
      tiers: readTiers(raw == null ? void 0 : raw.tiers)
    };
  }
  function leaderboardTierForRank(rank) {
    var _a;
    const r = Math.floor(rank);
    if (!Number.isFinite(r) || r < 1) {
      return null;
    }
    return (_a = readLeaderboardConfig().tiers.find((tier) => r >= tier.minRank && r <= tier.maxRank)) != null ? _a : null;
  }
  function planLeaderboardGrants(wallet, rank) {
    var _a;
    const tier = leaderboardTierForRank(rank);
    let next = wallet;
    const grants = [];
    const blocked = [];
    for (const spec of (_a = tier == null ? void 0 : tier.rewards) != null ? _a : []) {
      const after = addBoosterToWallet(next, spec.id, spec.amount);
      const gained = after[spec.id] - next[spec.id];
      next = after;
      grants.push({ id: spec.id, amount: Math.max(0, gained) });
      if (gained <= 0) {
        blocked.push(spec.id);
      }
    }
    return { grants, wallet: next, blocked };
  }

  // src/logic/economy/FriendLeaderboard.ts
  function rankFriends(rows) {
    const sorted = rows.slice().sort((a, b) => {
      if (a.maxLevel !== b.maxLevel) {
        return b.maxLevel - a.maxLevel;
      }
      const at = a.bestTimeMs != null && a.bestTimeMs > 0 ? a.bestTimeMs : Number.POSITIVE_INFINITY;
      const bt = b.bestTimeMs != null && b.bestTimeMs > 0 ? b.bestTimeMs : Number.POSITIVE_INFINITY;
      if (at !== bt) {
        return at - bt;
      }
      return a.userId < b.userId ? -1 : 1;
    });
    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  }
  function findPasser(userId, oldRank, rows, oldRanks) {
    var _a, _b;
    if (oldRank <= 0) {
      return null;
    }
    const self = rows.find((row) => row.userId === userId);
    if (!self || self.rank <= oldRank) {
      return null;
    }
    let passer = null;
    for (const row of rows) {
      if (row.userId === userId || row.rank >= self.rank) {
        continue;
      }
      const prev = (_a = oldRanks.get(row.userId)) != null ? _a : 0;
      if (prev === 0 || prev > oldRank) {
        if (!passer || row.rank > passer.rank) {
          passer = row;
        }
      }
    }
    return (_b = passer == null ? void 0 : passer.userId) != null ? _b : null;
  }
  function formatWxIdDisplay(raw, max = 12) {
    const text = raw.trim();
    if (!text) {
      return "\u2014";
    }
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, Math.max(4, max - 3))}\u2026`;
  }
  function formatScoreNumber(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function formatLeaderboardLine(row, tab = "level") {
    var _a, _b, _c;
    const nickName = (row.nickName || "").trim() || "\u5FAE\u4FE1\u73A9\u5BB6";
    const wxId = formatWxIdDisplay(row.wxId || row.userId);
    const score = Math.max(0, Math.floor((_a = row.score) != null ? _a : row.maxLevel));
    const maxLevel = Math.max(0, Math.floor(row.maxLevel));
    const isWeek = tab === "week";
    const weekScore = Math.max(0, Math.floor((_b = row.weekScore) != null ? _b : isWeek ? score : 0));
    const totalScore = Math.max(0, Math.floor((_c = row.totalScore) != null ? _c : 0));
    return {
      tag: row.rank > 0 ? String(row.rank) : "\u672A\u4E0A\u699C",
      text: "",
      highlight: row.isSelf,
      badge: nickName.slice(0, 1) || "\u73A9",
      kind: "player",
      avatarUrl: row.avatarUrl,
      nickName,
      wxId,
      score,
      scoreText: isWeek ? formatScoreNumber(weekScore) : `\u7B2C ${maxLevel} \u5173`,
      scoreUnit: isWeek ? "\u672C\u5468\u5206" : "\u6700\u9AD8\u901A\u5173",
      sub: isWeek ? `\u5DF2\u901A\u5173 ${maxLevel} \u5173` : totalScore > 0 ? `\u7D2F\u8BA1 ${formatScoreNumber(totalScore)} \u5206` : ""
    };
  }
  function leaderboardGapHint(input) {
    var _a, _b, _c, _d, _e, _f;
    if (input.selfRank === 1) {
      return input.tab === "week" ? "\u672C\u5468\u7B2C\u4E00\uFF01\u5B88\u4F4F\u5B83\uFF0C\u5468\u4E00\u9886\u5927\u5956" : "\u4F60\u662F\u5168\u670D\u7B2C\u4E00\uFF01";
    }
    if (!input.self || !input.above) {
      if (input.tab === "week") {
        const mine = Math.max(0, Math.floor((_b = (_a = input.self) == null ? void 0 : _a.weekScore) != null ? _b : 0));
        if (mine > 0) {
          return `\u4F60\u672C\u5468 ${formatScoreNumber(mine)} \u5206\uFF0C\u9080\u8BF7\u597D\u53CB\u4E00\u8D77\u51B2\u699C`;
        }
        return "";
      }
      return "";
    }
    const name = (input.above.nickName || "\u4E0A\u4E00\u540D").slice(0, 8);
    if (input.tab === "week") {
      const gap = Math.max(0, Math.floor((_c = input.above.weekScore) != null ? _c : 0) - Math.floor((_d = input.self.weekScore) != null ? _d : 0)) + 1;
      return `\u518D\u5F97 ${formatScoreNumber(gap)} \u5206\u5C31\u80FD\u8D85\u8FC7 ${name}`;
    }
    const levelGap = Math.floor(input.above.maxLevel) - Math.floor(input.self.maxLevel);
    if (levelGap > 0) {
      return `\u518D\u901A\u5173 ${levelGap} \u5173\u5C31\u80FD\u8FFD\u4E0A ${name}`;
    }
    const scoreGap = Math.max(0, Math.floor((_e = input.above.totalScore) != null ? _e : 0) - Math.floor((_f = input.self.totalScore) != null ? _f : 0)) + 1;
    return `\u540C\u5173\u6BD4\u7D2F\u8BA1\u5206\uFF0C\u518D\u591A ${formatScoreNumber(scoreGap)} \u5206\u8D85\u8FC7 ${name}`;
  }
  function fill(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      var _a;
      return String((_a = vars[key]) != null ? _a : "");
    });
  }
  function passedHint(name) {
    return fill(notice_default.leaderboard.passed, { name });
  }
  function hintFromNotify(message) {
    const name = nameFromNotify(message);
    return name ? passedHint(name) : message;
  }
  function nameFromNotify(message) {
    const template = notice_default.leaderboard.notify;
    const token = "{name}";
    const at = template.indexOf(token);
    if (at < 0) {
      return null;
    }
    const prefix = template.slice(0, at);
    const suffix = template.slice(at + token.length);
    if (!message.startsWith(prefix) || !message.endsWith(suffix)) {
      return null;
    }
    const name = message.slice(prefix.length, message.length - suffix.length);
    return name || null;
  }
  function buildLeaderboardHint(input) {
    if (input.passedBy) {
      return passedHint(input.passedBy);
    }
    if (input.aboveScore != null && input.aboveScore - input.selfScore === 1) {
      return notice_default.leaderboard.closeGap;
    }
    return "";
  }
  var GRANT_NAME = {
    hammer: "\u9524\u5B50",
    shuffle: "\u91CD\u6392",
    extraMoves: "\u52A0\u6B65"
  };
  function formatGrantList(grants) {
    return grants.filter((item) => item.amount > 0).map((item) => `${GRANT_NAME[item.id]}x${item.amount}`).join(" ");
  }
  function leaderboardRewardText() {
    const tiers = leaderboardRewardTierLines();
    return tiers.length > 0 ? fill(notice_default.leaderboard.reward, { tiers: tiers.join(" \xB7 ") }) : "";
  }
  function leaderboardRewardTierLines() {
    return readLeaderboardConfig().tiers.map((tier) => {
      const range = tier.minRank === tier.maxRank ? `\u7B2C${tier.minRank}\u540D` : `\u7B2C${tier.minRank}-${tier.maxRank}\u540D`;
      const grants = formatGrantList(tier.rewards);
      return grants ? `${range}  ${grants}` : range;
    });
  }
  function leaderboardRewardedText(rank, grants, tierMatched = true) {
    if (!tierMatched) {
      const tiers = readLeaderboardConfig().tiers;
      const top = tiers.length > 0 ? tiers[tiers.length - 1].maxRank : 0;
      return fill(notice_default.leaderboard.rewardedNone, { rank, top });
    }
    const list = formatGrantList(grants);
    if (!list) {
      return fill(notice_default.leaderboard.rewardedFull, { rank });
    }
    return fill(notice_default.leaderboard.rewarded, { rank, rewards: list });
  }
  function nextWeeklySettleMs(nowMs) {
    const date = new Date(nowMs);
    const dow = date.getDay() || 7;
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return midnight + (8 - dow) * 864e5;
  }
  function weeklySettleCountdownText(nowMs, settleAtMs = nextWeeklySettleMs(nowMs)) {
    const left = Math.max(0, settleAtMs - nowMs);
    const days = Math.floor(left / 864e5);
    const hours = Math.floor(left % 864e5 / 36e5);
    const minutes = Math.max(1, Math.floor(left % 36e5 / 6e4));
    if (days > 0) {
      return `\u8DDD\u7ED3\u7B97 ${days}\u5929${hours}\u5C0F\u65F6`;
    }
    if (hours > 0) {
      return `\u8DDD\u7ED3\u7B97 ${hours}\u5C0F\u65F6${minutes}\u5206`;
    }
    return `\u8DDD\u7ED3\u7B97 ${minutes}\u5206\u949F`;
  }
  function localIsoWeek(nowMs) {
    const date = new Date(nowMs);
    return isoWeekFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
  function isoWeekFromParts(year, month, day) {
    const utc = new Date(Date.UTC(year, month - 1, day));
    const dow = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - dow);
    const isoYear = utc.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
    return `${isoYear}-W${String(week).padStart(2, "0")}`;
  }

  // src/logic/level/LevelStars.ts
  function starsForClear(input) {
    const total = Math.max(1, Math.floor(input.movesTotal));
    const left = Math.max(0, Math.floor(input.movesLeft) - Math.max(0, Math.floor(input.movesGranted)));
    if (left >= Math.max(3, Math.ceil(total * 0.25))) {
      return 3;
    }
    if (left >= Math.max(1, Math.ceil(total * 0.1))) {
      return 2;
    }
    return 1;
  }
  function starClearLabel(stars) {
    return `${stars} \u661F\u901A\u5173`;
  }
  function starsHint(stars) {
    if (stars === 3) {
      return "\u5B8C\u7F8E\u901A\u5173\uFF01";
    }
    if (stars === 2) {
      return "\u518D\u7701\u51E0\u6B65\u5C31\u80FD\u62FF\u4E09\u661F";
    }
    return "\u7701\u4E0B\u66F4\u591A\u6B65\u6570\u53EF\u4EE5\u62FF\u66F4\u591A\u661F";
  }

  // src/logic/mahjong/mahjongHallUnlockCopy.ts
  var COPY = notice_default;
  var MAHJONG_NOTICE_MARK = "\u9EBB\u5C06\u9986";
  function isMahjongUnlockNoticeLine(line) {
    return line.includes(MAHJONG_NOTICE_MARK);
  }
  function lobbyNoticeForMahjongState(mahjongUnlocked) {
    var _a, _b, _c, _d, _e;
    const rawBubbles = (_a = COPY.bubbles) != null ? _a : [];
    const bubbles = mahjongUnlocked ? rawBubbles.filter((line) => !isMahjongUnlockNoticeLine(line)) : rawBubbles.slice();
    const body = mahjongUnlocked ? (_c = (_b = COPY.bodyWhenUnlocked) != null ? _b : COPY.body) != null ? _c : "" : (_d = COPY.body) != null ? _d : "";
    const mahjongTeaser = (_e = COPY.mahjongHallUnlockTeaser) != null ? _e : `\u7D2F\u8BA1 ${MAHJONG_HALL_UNLOCK_LADDER_COINS} \u68AF\u5B50\u91D1\u5E01\u2B50\uFF0C\u6216\u901A\u5173\u7B2C 20 \u5173\uFF0C\u89E3\u9501\u840C\u5BA0\u9EBB\u5C06\u9986`;
    return {
      body,
      bubbles,
      showMahjongTeaser: !mahjongUnlocked,
      mahjongTeaser
    };
  }
  function mahjongHallLockHint() {
    var _a;
    return (_a = COPY.mahjongHallLockHint) != null ? _a : `\u901A\u5173\u7B2C 20 \u5173\uFF0C\u6216\u68AF\u5B50\u7D2F\u8BA1 ${MAHJONG_HALL_UNLOCK_LADDER_COINS} \u91D1\u5E01\u2B50\uFF0C\u5373\u53EF\u89E3\u9501\u840C\u5BA0\u9EBB\u5C06\u9986`;
  }
  function mahjongHallLockPanelBody(maxClearedLevelId) {
    const hint = mahjongHallLockHint().replace(/⭐/g, "");
    if (maxClearedLevelId >= 20) {
      return hint;
    }
    const cleared = Math.max(0, maxClearedLevelId);
    return `\u4F60\u5DF2\u901A\u5173\u7B2C ${cleared} \u5173\u3002
${hint}`;
  }
  function mahjongHallLockToastTitle(maxClearedLevelId) {
    if (maxClearedLevelId >= 20) {
      return "\u9EBB\u5C06\u9986\u672A\u89E3\u9501";
    }
    const need = Math.max(1, 20 - Math.max(0, maxClearedLevelId));
    return `\u8FD8\u5DEE ${need} \u5173\u89E3\u9501\u9EBB\u5C06\u9986`;
  }
  function mahjongHallUnlockAnnouncement() {
    var _a, _b;
    return (_b = (_a = COPY.postClear) == null ? void 0 : _a.mahjongUnlock) != null ? _b : "\u840C\u5BA0\u9EBB\u5C06\u9986\u5DF2\u89E3\u9501\uFF01\u5DE6\u4E0B\u89D2\u5165\u53E3\uFF0C\u968F\u65F6\u6765\u6413\u724C";
  }

  // src/logic/economy/postClearAnnouncement.ts
  var COPY2 = notice_default;
  function buildPostClearAnnouncement(input) {
    var _a, _b;
    const hint = ((_a = input.leaderboardHint) != null ? _a : "").trim();
    if (hint) {
      return hint;
    }
    const id = Math.max(1, Math.floor(input.clearedLevelId));
    const post = COPY2.postClear;
    if (id === 20) {
      return mahjongHallUnlockAnnouncement();
    }
    const tpl = (_b = post == null ? void 0 : post.cleared) != null ? _b : "\u606D\u559C\u901A\u5173\u7B2C {level} \u5173\uFF01";
    return tpl.replace(/\{level\}/g, String(id));
  }

  // src/core/adapters/WxUserProfile.ts
  var WX_PROFILE_STORAGE_KEY = "crush_wx_profile";
  var WX_PROFILE_ASKED_KEY = "crush_wx_profile_asked";
  function hasAskedWxProfile() {
    const api = wxApi();
    if (!(api == null ? void 0 : api.getStorageSync)) {
      return false;
    }
    try {
      return !!api.getStorageSync(WX_PROFILE_ASKED_KEY);
    } catch (e) {
      return false;
    }
  }
  function markWxProfileAsked() {
    const api = wxApi();
    if (!(api == null ? void 0 : api.setStorageSync)) {
      return;
    }
    try {
      api.setStorageSync(WX_PROFILE_ASKED_KEY, 1);
    } catch (e) {
    }
  }
  function wxApi() {
    try {
      if (typeof wx === "undefined") {
        return null;
      }
      return wx;
    } catch (e) {
      return null;
    }
  }
  function hasRealWxProfile(profile) {
    return !!(profile && profile.avatarUrl);
  }
  function readCachedWxProfile(fallbackWxId = "") {
    const api = wxApi();
    if (!(api == null ? void 0 : api.getStorageSync)) {
      return null;
    }
    try {
      const raw = api.getStorageSync(WX_PROFILE_STORAGE_KEY);
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || typeof data !== "object") {
        return null;
      }
      const nickName = String(data.nickName || "").trim();
      const avatarUrl = String(data.avatarUrl || "").trim();
      if (!avatarUrl) {
        return null;
      }
      return {
        nickName: nickName || "\u5FAE\u4FE1\u7528\u6237",
        avatarUrl,
        wxId: fallbackWxId
      };
    } catch (e) {
      return null;
    }
  }
  function saveCachedWxProfile(profile) {
    const api = wxApi();
    if (!(api == null ? void 0 : api.setStorageSync)) {
      return;
    }
    try {
      api.setStorageSync(WX_PROFILE_STORAGE_KEY, {
        nickName: profile.nickName.trim(),
        avatarUrl: profile.avatarUrl.trim(),
        updatedAt: Date.now()
      });
    } catch (e) {
    }
  }
  function parseUserInfo(raw) {
    if (!raw) {
      return null;
    }
    const nickName = String(raw.nickName || "").trim();
    const avatarUrl = String(raw.avatarUrl || "").trim();
    if (!avatarUrl) {
      return null;
    }
    return {
      nickName: nickName || "\u5FAE\u4FE1\u7528\u6237",
      avatarUrl
    };
  }
  function humanizeAuthError(errMsg) {
    const msg = String(errMsg || "");
    if (msg.includes("privacy") || msg.includes("1025") || msg.includes("1026") || msg.includes("112") || msg.includes("please go to mp") || msg.includes("api scope is not declared")) {
      console.warn(
        "[crush-crush][auth] \u9700\u5728\u516C\u4F17\u5E73\u53F0\u300A\u7528\u6237\u9690\u79C1\u4FDD\u62A4\u6307\u5F15\u300B\u58F0\u660E\u300C\u7528\u6237\u4FE1\u606F\uFF08\u6635\u79F0\u3001\u5934\u50CF\uFF09\u300D\u5E76\u5F00\u542F\u9690\u79C1\u5F39\u7A97",
        msg
      );
      return "\u6682\u65F6\u65E0\u6CD5\u83B7\u53D6\u5934\u50CF\uFF0C\u4E0D\u5F71\u54CD\u7EE7\u7EED\u73A9";
    }
    if (msg.includes("auth deny") || msg.includes("deny") || msg.includes("cancel")) {
      return "\u5DF2\u8DF3\u8FC7\u6388\u6743\uFF0C\u53EF\u968F\u65F6\u5728\u4E0B\u6B21\u8FDB\u5165\u65F6\u518D\u6388\u6743";
    }
    if (!msg) {
      return "\u6682\u65F6\u65E0\u6CD5\u83B7\u53D6\u5934\u50CF\uFF0C\u4E0D\u5F71\u54CD\u7EE7\u7EED\u73A9";
    }
    console.warn("[crush-crush][auth]", msg);
    return "\u6682\u65F6\u65E0\u6CD5\u83B7\u53D6\u5934\u50CF\uFF0C\u4E0D\u5F71\u54CD\u7EE7\u7EED\u73A9";
  }
  function showAuthFailModal(message) {
    const api = wxApi();
    if (typeof (api == null ? void 0 : api.showToast) === "function") {
      try {
        api.showToast({
          title: message.slice(0, 14),
          icon: "none",
          duration: 2500
        });
        return;
      } catch (e) {
      }
    }
    console.warn("[crush-crush][auth]", message);
  }
  function getUserInfoAuthState() {
    const api = wxApi();
    if (!(api == null ? void 0 : api.getSetting)) {
      return Promise.resolve("unknown");
    }
    return new Promise((resolve) => {
      try {
        api.getSetting({
          success: (res) => {
            var _a;
            const flag = (_a = res.authSetting) == null ? void 0 : _a["scope.userInfo"];
            if (flag === true) {
              resolve("authorized");
              return;
            }
            if (flag === false) {
              resolve("denied");
              return;
            }
            resolve("unknown");
          },
          fail: () => resolve("unknown")
        });
      } catch (e) {
        resolve("unknown");
      }
    });
  }
  function fetchWxUserInfoOnce() {
    const api = wxApi();
    if (!(api == null ? void 0 : api.getUserInfo)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        api.getUserInfo({
          withCredentials: false,
          lang: "zh_CN",
          success: (res) => resolve(parseUserInfo(res.userInfo)),
          fail: () => resolve(null)
        });
      } catch (e) {
        resolve(null);
      }
    });
  }
  async function ensureWxUserProfile(fallbackWxId = "") {
    const cached = readCachedWxProfile(fallbackWxId);
    if (hasRealWxProfile(cached)) {
      return { ...cached, wxId: fallbackWxId || cached.wxId };
    }
    const auth = await getUserInfoAuthState();
    if (auth === "authorized") {
      const info = await fetchWxUserInfoOnce();
      if (info) {
        saveCachedWxProfile(info);
        return { ...info, wxId: fallbackWxId };
      }
    }
    return null;
  }
  function mountWxUserInfoAuthButton(input) {
    const api = wxApi();
    if (!(api == null ? void 0 : api.createUserInfoButton)) {
      input.onFail("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u5FAE\u4FE1\u6388\u6743\u6309\u94AE\uFF0C\u8BF7\u7528\u624B\u673A\u5FAE\u4FE1\u6253\u5F00\u4F53\u9A8C\u7248");
      return null;
    }
    try {
      const button = api.createUserInfoButton({
        type: "text",
        text: input.text || "\u5C55\u793A\u6211\u7684\u5FAE\u4FE1\u5934\u50CF\uFF08\u53EF\u9009\uFF09",
        withCredentials: false,
        lang: "zh_CN",
        style: {
          left: Math.round(input.left),
          top: Math.round(input.top),
          width: Math.round(input.width),
          height: Math.round(input.height),
          lineHeight: Math.round(input.height),
          backgroundColor: "#1c7ed6",
          color: "#ffffff",
          textAlign: "center",
          fontSize: 14,
          borderRadius: 18
        }
      });
      button.onTap((res) => {
        console.info("[crush-crush] userInfoButton tap", res == null ? void 0 : res.errMsg, !!(res == null ? void 0 : res.userInfo), !!(res == null ? void 0 : res.rawData));
        const ok = String((res == null ? void 0 : res.errMsg) || "").includes(":ok");
        if (ok) {
          const parsed = parseUserInfo(res.userInfo);
          if (parsed) {
            saveCachedWxProfile(parsed);
            input.onProfile(parsed);
            return;
          }
          void fetchWxUserInfoOnce().then((info) => {
            if (info) {
              saveCachedWxProfile(info);
              input.onProfile(info);
              return;
            }
            input.onFail(humanizeAuthError("privacy not declared"));
          });
          return;
        }
        input.onFail(humanizeAuthError((res == null ? void 0 : res.errMsg) || ""));
      });
      try {
        button.show();
      } catch (e) {
      }
      return {
        destroy: () => {
          try {
            button.hide();
          } catch (e) {
          }
          try {
            button.destroy();
          } catch (e) {
          }
        }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      input.onFail(humanizeAuthError(message));
      return null;
    }
  }

  // src/config/mahjong-themes.json
  var mahjong_themes_default = {
    version: 2,
    defaultThemeId: "default",
    themes: [
      {
        themeId: "default",
        name: "\u840C\u5BA0\u7ECF\u5178",
        tiles: [
          "assets/main/tiles/red.png",
          "assets/main/tiles/blue.png",
          "assets/main/tiles/green.png",
          "assets/main/tiles/yellow.png",
          "assets/main/tiles/purple.png",
          "assets/main/tiles/owl.png",
          "assets/main/tiles/bear.png",
          "assets/main/tiles/pig.png",
          "assets/main/tiles/panda.png",
          "assets/main/tiles/corgi.png"
        ],
        background: "#5eb8b8"
      },
      {
        themeId: "corgi_01",
        name: "\u67F4\u72AC\u9EBB\u5C06\u9986",
        tiles: [
          "themes/corgi_01/tile_0.png",
          "themes/corgi_01/tile_1.png",
          "themes/corgi_01/tile_2.png",
          "themes/corgi_01/tile_3.png",
          "themes/corgi_01/tile_4.png",
          "themes/corgi_01/tile_5.png"
        ],
        background: "#fff3bf"
      },
      {
        themeId: "cat_01",
        name: "\u732B\u54AA\u9EBB\u5C06\u9986",
        tiles: [
          "themes/cat_01/tile_0.png",
          "themes/cat_01/tile_1.png",
          "themes/cat_01/tile_2.png",
          "themes/cat_01/tile_3.png",
          "themes/cat_01/tile_4.png",
          "themes/cat_01/tile_5.png"
        ],
        background: "#e5dbff"
      },
      {
        themeId: "bunny_01",
        name: "\u5154\u5154\u9EBB\u5C06\u9986",
        tiles: [
          "themes/bunny_01/tile_0.png",
          "themes/bunny_01/tile_1.png",
          "themes/bunny_01/tile_2.png",
          "themes/bunny_01/tile_3.png",
          "themes/bunny_01/tile_4.png",
          "themes/bunny_01/tile_5.png"
        ],
        background: "#d3f9d8"
      },
      {
        themeId: "panda_01",
        name: "\u718A\u732B\u9EBB\u5C06\u9986",
        tiles: [
          "themes/panda_01/tile_0.png",
          "themes/panda_01/tile_1.png",
          "themes/panda_01/tile_2.png",
          "themes/panda_01/tile_3.png",
          "themes/panda_01/tile_4.png",
          "themes/panda_01/tile_5.png"
        ],
        background: "#edf2ff"
      }
    ]
  };

  // src/logic/mahjong/MahjongThemeCatalog.ts
  var manifest = normalizeManifest(mahjong_themes_default);
  var remoteLoaded = false;
  function normalizeManifest(raw) {
    var _a;
    const themes = Array.isArray(raw.themes) ? raw.themes : [];
    return {
      version: typeof raw.version === "number" ? raw.version : 1,
      defaultThemeId: (_a = raw.defaultThemeId) != null ? _a : "default",
      themes: themes.map((t) => {
        var _a2;
        return {
          themeId: t.themeId,
          name: t.name,
          tiles: [...(_a2 = t.tiles) != null ? _a2 : []],
          background: t.background,
          tileBack: t.tileBack
        };
      })
    };
  }
  function byIdMap() {
    return new Map(manifest.themes.map((t) => [t.themeId, t]));
  }
  function getMahjongThemeManifestVersion() {
    return manifest.version;
  }
  function isMahjongCdnEnabled() {
    var _a, _b;
    return mahjong_cdn_default.enabled === true && ((_b = (_a = mahjong_cdn_default.cdnBaseUrl) == null ? void 0 : _a.length) != null ? _b : 0) > 0;
  }
  function resolveMahjongAssetUrl(pathOrUrl) {
    var _a;
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }
    if (pathOrUrl.startsWith("assets/")) {
      return pathOrUrl;
    }
    const base = ((_a = mahjong_cdn_default.cdnBaseUrl) != null ? _a : "").replace(/\/+$/, "");
    if (mahjong_cdn_default.enabled && base.length > 0) {
      const rel = pathOrUrl.replace(/^\/+/, "");
      return `${base}/${rel}`;
    }
    return pathOrUrl;
  }
  function applyMahjongThemeManifest(next) {
    manifest = normalizeManifest(next);
    remoteLoaded = true;
  }
  async function fetchMahjongThemeManifestFromCdn(fetchJson) {
    var _a;
    if (!mahjong_cdn_default.enabled) {
      return false;
    }
    const url = ((_a = mahjong_cdn_default.manifestUrl) != null ? _a : "").trim();
    if (url.length === 0) {
      return false;
    }
    try {
      const data = await fetchJson(url);
      if (!data || typeof data !== "object") {
        return false;
      }
      applyMahjongThemeManifest(data);
      return true;
    } catch (e) {
      return false;
    }
  }
  function getMahjongTheme(themeId) {
    var _a;
    return (_a = byIdMap().get(themeId)) != null ? _a : null;
  }
  function getDefaultMahjongTheme() {
    var _a, _b;
    const id = (_a = manifest.defaultThemeId) != null ? _a : "default";
    return (_b = getMahjongTheme(id)) != null ? _b : manifest.themes[0];
  }
  function pickMahjongThemeForLevel(level, seed) {
    var _a, _b, _c, _d, _e;
    const override = getMahjongLevelOverride(level);
    if (override == null ? void 0 : override.themeId) {
      return (_a = getMahjongTheme(override.themeId)) != null ? _a : getDefaultMahjongTheme();
    }
    const ops2 = getMahjongOps();
    if (level <= 1) {
      return (_b = getMahjongTheme(ops2.theme.level1ThemeId)) != null ? _b : getDefaultMahjongTheme();
    }
    if (level <= 2) {
      return (_c = getMahjongTheme(ops2.theme.level2ThemeId)) != null ? _c : getDefaultMahjongTheme();
    }
    const themeLevel = mahjongThemePickLevel(level);
    const pool = manifest.themes.length > 0 ? manifest.themes : [getDefaultMahjongTheme()];
    if (ops2.theme.sequentialFromLevel3) {
      const idx2 = (themeLevel - 3) % pool.length;
      return (_d = pool[idx2]) != null ? _d : getDefaultMahjongTheme();
    }
    const rng = createSeededRandom(seed ^ 2654435769 ^ themeLevel);
    const idx = Math.floor(rng() * pool.length);
    return (_e = pool[idx]) != null ? _e : getDefaultMahjongTheme();
  }
  function tileAssetPath(theme, typeIndex) {
    var _a, _b;
    if (theme.tiles.length === 0 || typeIndex < 0) {
      return null;
    }
    let raw = theme.tiles[typeIndex % theme.tiles.length];
    if (!raw) {
      return null;
    }
    if (!isMahjongCdnEnabled() && /^themes\//.test(raw)) {
      const fallback = getDefaultMahjongTheme();
      raw = (_b = (_a = fallback.tiles[typeIndex % fallback.tiles.length]) != null ? _a : fallback.tiles[0]) != null ? _b : raw;
    }
    return resolveMahjongAssetUrl(raw);
  }

  // src/logic/mahjong/MahjongFaceDown.ts
  function buildInitialPileFaceDown(poses, level, seed) {
    if (level <= 1 || poses.length === 0) {
      return poses.map(() => false);
    }
    const rng = createSeededRandom(seed ^ 4207857837 ^ level);
    const n = poses.length;
    const target = Math.max(1, Math.floor(n * 0.3));
    const order = poses.map((p, i) => ({ i, z: p.z })).sort((a, b) => a.z - b.z);
    const faceDown = poses.map(() => false);
    for (let k = 0; k < target; k += 1) {
      let pick = order[Math.min(order.length - 1, Math.floor(rng() * rng() * n))];
      if (rng() < 0.72) {
        const flatPool = order.filter((o) => {
          var _a, _b;
          return ((_b = (_a = poses[o.i]) == null ? void 0 : _a.stand) != null ? _b : 1) === 0;
        });
        if (flatPool.length > 0) {
          pick = flatPool[Math.floor(rng() * flatPool.length)];
        }
      }
      faceDown[pick.i] = true;
    }
    return faceDown;
  }

  // src/logic/mahjong/MahjongPilePoses.ts
  var MAHJONG_STAND_FLAT = 0;
  var MAHJONG_STAND_UPRIGHT = 1;
  var MAHJONG_STAND_EDGE_SHORT = 2;
  var MAHJONG_STAND_EDGE_LONG = 3;
  var MAHJONG_STAND_TILT = 4;
  var MAHJONG_PILE_POSE_VERSION = 3;
  function pickPileStand(rng, level) {
    const r = rng();
    if (level <= 1) {
      if (r < 0.7) {
        return MAHJONG_STAND_FLAT;
      }
      if (r < 0.85) {
        return MAHJONG_STAND_TILT;
      }
      return MAHJONG_STAND_UPRIGHT;
    }
    if (r < 0.64) {
      return MAHJONG_STAND_FLAT;
    }
    if (r < 0.72) {
      return MAHJONG_STAND_TILT;
    }
    if (r < 0.86) {
      return MAHJONG_STAND_EDGE_SHORT;
    }
    if (r < 0.94) {
      return MAHJONG_STAND_EDGE_LONG;
    }
    return MAHJONG_STAND_UPRIGHT;
  }
  function rotForPileStand(stand, rng, _level) {
    const t = rng() - 0.5;
    switch (stand) {
      case MAHJONG_STAND_FLAT:
        return t * 0.5;
      case MAHJONG_STAND_TILT:
        return t * 0.7;
      default:
        return t * 0.24;
    }
  }
  function buildMahjongPilePoses(pileLength, seed, level) {
    if (pileLength <= 0) {
      return [];
    }
    const rng = createSeededRandom(seed ^ level * 1315423911 ^ pileLength * 2654435761);
    const compact = pileLength <= 12;
    const layerCount = compact ? 3 : 5;
    const perLayer = Math.ceil(pileLength / layerCount);
    const poses = [];
    const clusterCount = compact ? 2 : 3;
    const clusters = Array.from({ length: clusterCount }, () => ({
      cx: 0.28 + rng() * 0.44,
      cy: 0.3 + rng() * 0.4
    }));
    for (let i = 0; i < pileLength; i += 1) {
      const layer = Math.min(layerCount - 1, Math.floor(i / perLayer));
      const spreadX = (compact ? 0.92 : 0.94) - layer * (compact ? 0.035 : 0.028);
      const spreadY = (compact ? 0.9 : 0.92) - layer * (compact ? 0.035 : 0.028);
      const cluster = clusters[Math.floor(rng() * clusterCount)];
      const nx = cluster.cx + (rng() - 0.5) * spreadX;
      const ny = cluster.cy + (rng() - 0.5) * spreadY;
      const stand = pickPileStand(rng, level);
      poses.push({
        nx: Math.min(0.98, Math.max(0.02, nx)),
        ny: Math.min(0.98, Math.max(0.02, ny)),
        scale: (compact ? 0.25 : 0.158) - layer * (compact ? 0.012 : 25e-4) + rng() * 0.018,
        rot: rotForPileStand(stand, rng, level),
        z: layer * 1e3 + i + rng() * 0.01,
        stand
      });
    }
    return poses;
  }
  function appendRandomPilePose(poses, seed, level) {
    const rng = createSeededRandom(seed ^ poses.length ^ 991 ^ level);
    const scale = level <= 1 ? 0.2 : 0.144 + rng() * 0.02;
    const stand = pickPileStand(rng, level);
    return {
      nx: Math.min(0.98, Math.max(0.02, 0.5 + (rng() - 0.5) * 0.92)),
      ny: Math.min(0.98, Math.max(0.02, 0.5 + (rng() - 0.5) * 0.9)),
      scale,
      rot: rotForPileStand(stand, rng, level),
      z: 5e3 + poses.length + rng(),
      stand
    };
  }

  // src/logic/mahjong/MahjongGame.ts
  function mahjongMatchKindCount(typeCount, themeTileCount) {
    const tiles = Math.max(1, Math.floor(themeTileCount));
    const kinds = Math.max(1, Math.floor(typeCount));
    return Math.min(kinds, tiles);
  }
  function resolveTriplesByKind(slots, kindOf) {
    var _a, _b;
    const counts = /* @__PURE__ */ new Map();
    for (const t of slots) {
      const k = kindOf(t);
      counts.set(k, ((_a = counts.get(k)) != null ? _a : 0) + 1);
    }
    const keep = /* @__PURE__ */ new Map();
    for (const [k, c] of counts) {
      keep.set(k, c % 3);
    }
    const out = [];
    for (const t of slots) {
      const k = kindOf(t);
      const left = (_b = keep.get(k)) != null ? _b : 0;
      if (left > 0) {
        keep.set(k, left - 1);
        out.push(t);
      }
    }
    return out;
  }
  var MahjongGame = class _MahjongGame {
    constructor(generated, themeId, tools, guideShown, remainingMs = mahjongTimeoutMsForLevel(generated.level), themeTileCount = generated.typeCount) {
      this.slots = [];
      this.starsThisRun = 0;
      this.coinsThisRun = 0;
      this.adSlotUnlocked = false;
      this.phase = "playing";
      /** 牌堆布局变更计数（供渲染缓存失效）。 */
      this.pileLayoutEpoch = 0;
      this.level = generated.level;
      this.pile = generated.pile.slice();
      this.pilePoses = buildMahjongPilePoses(this.pile.length, generated.seed, generated.level);
      this.pileFaceDown = buildInitialPileFaceDown(this.pilePoses, generated.level, generated.seed);
      this.remainingMs = remainingMs;
      this.themeId = themeId;
      this.typeCount = generated.typeCount;
      this.matchKindCount = mahjongMatchKindCount(generated.typeCount, themeTileCount);
      this.seed = generated.seed;
      this.tools = { ...tools };
      this.guideShown = guideShown;
    }
    maxSlots() {
      return MAHJONG_BASE_SLOTS + (this.adSlotUnlocked ? 1 : 0);
    }
    matchKind(type) {
      if (this.matchKindCount >= this.typeCount) {
        return type;
      }
      return (type % this.matchKindCount + this.matchKindCount) % this.matchKindCount;
    }
    bumpPileLayout() {
      this.pileLayoutEpoch += 1;
    }
    /** 槽内按视觉种类三消并发放本局星/金币。 */
    compactSlotsTriplesWithReward() {
      const beforeLen = this.slots.length;
      this.slots = resolveTriplesByKind(this.slots, (t) => this.matchKind(t));
      const removed = beforeLen - this.slots.length;
      if (removed >= 3) {
        const triples = Math.floor(removed / 3);
        this.starsThisRun += triples * mahjongStarPerTriple();
        this.coinsThisRun += triples * mahjongCoinPerTriple();
      }
    }
    tick(dtMs) {
      if (this.phase !== "playing") {
        return;
      }
      this.remainingMs = Math.max(0, this.remainingMs - dtMs);
      if (this.remainingMs <= 0 && this.pile.length + this.slots.length > 0) {
        this.phase = "lost";
        this.failReason = "timeout";
      }
    }
    canAutoMatch() {
      var _a;
      const counts = /* @__PURE__ */ new Map();
      for (const t of this.slots) {
        const k = this.matchKind(t);
        counts.set(k, ((_a = counts.get(k)) != null ? _a : 0) + 1);
      }
      for (const c of counts.values()) {
        if (c >= 3) {
          return true;
        }
      }
      return false;
    }
    /** 给定槽位追加一张牌并按种类三消后的结果（不改本局状态）。 */
    slotsAfterAppend(slots, tile) {
      return resolveTriplesByKind([...slots, tile], (t) => this.matchKind(t));
    }
    /** 入槽后检测是否刚完成三消（用于奖励）。 */
    applySlotWithReward(tile) {
      const beforeLen = this.slots.length;
      this.slots = this.slotsAfterAppend(this.slots, tile);
      const removed = beforeLen + 1 - this.slots.length;
      if (removed >= 3) {
        const triples = Math.floor(removed / 3);
        this.starsThisRun += triples * mahjongStarPerTriple();
        this.coinsThisRun += triples * mahjongCoinPerTriple();
      }
    }
    tapPile(index) {
      if (this.phase !== "playing" || index < 0 || index >= this.pile.length) {
        return false;
      }
      const tile = this.pile.splice(index, 1)[0];
      this.pilePoses.splice(index, 1);
      this.pileFaceDown.splice(index, 1);
      this.bumpPileLayout();
      this.applySlotWithReward(tile);
      if (this.pile.length === 0 && this.slots.length === 0) {
        this.phase = "won";
        return true;
      }
      if (this.slots.length >= this.maxSlots() && !this.canAutoMatch()) {
        this.phase = "lost";
        this.failReason = "slot_full";
      }
      return true;
    }
    unlockAdSlot() {
      this.adSlotUnlocked = true;
    }
    /** 槽位已满失败且槽内仍有牌时可走广告移出继续。 */
    canReviveFromSlotFullAd() {
      return this.phase === "lost" && this.failReason === "slot_full" && this.slots.length > 0;
    }
    /** 看广告后移出槽内若干张回牌堆并继续本局。 */
    reviveMoveOutFromSlots(count = MAHJONG_SLOT_FULL_AD_MOVE_COUNT) {
      if (!this.canReviveFromSlotFullAd()) {
        return false;
      }
      const n = Math.min(Math.max(1, count), this.slots.length);
      for (let i = 0; i < n; i += 1) {
        const tile = this.slots.pop();
        this.pile.unshift(tile);
        this.pilePoses.unshift(appendRandomPilePose(this.pilePoses, this.seed, this.level));
        this.pileFaceDown.unshift(false);
      }
      this.phase = "playing";
      this.failReason = void 0;
      this.bumpPileLayout();
      this.compactSlotsTriplesWithReward();
      this.checkWinOrLose();
      return true;
    }
    useTool(tool) {
      if (this.phase !== "playing" || this.tools[tool] <= 0) {
        return false;
      }
      let ok = false;
      switch (tool) {
        case "move_out":
          ok = this.toolMoveOut();
          break;
        case "gather":
          ok = this.toolGather();
          break;
        case "shuffle":
          ok = this.toolShuffle();
          break;
        case "reveal":
          ok = this.toolReveal();
          break;
        default:
          ok = false;
      }
      if (ok) {
        this.tools[tool] -= 1;
      }
      return ok;
    }
    toolMoveOut() {
      if (this.slots.length === 0) {
        return false;
      }
      const tile = this.slots.pop();
      this.pile.unshift(tile);
      this.pilePoses.unshift(appendRandomPilePose(this.pilePoses, this.seed, this.level));
      this.pileFaceDown.unshift(false);
      this.bumpPileLayout();
      return true;
    }
    toolGather() {
      if (this.slots.length === 0) {
        return false;
      }
      const target = this.slots[this.slots.length - 1];
      const targetKind = this.matchKind(target);
      let need = 3 - this.slots.filter((t) => this.matchKind(t) === targetKind).length;
      if (need <= 0) {
        need = 2;
      }
      let moved = 0;
      for (let i = 0; i < this.pile.length && moved < need; ) {
        if (this.matchKind(this.pile[i]) === targetKind) {
          const t = this.pile.splice(i, 1)[0];
          this.pilePoses.splice(i, 1);
          this.pileFaceDown.splice(i, 1);
          this.applySlotWithReward(t);
          moved += 1;
        } else {
          i += 1;
        }
      }
      if (moved === 0) {
        return false;
      }
      this.bumpPileLayout();
      this.checkWinOrLose();
      return true;
    }
    toolShuffle() {
      if (this.pile.length < 2) {
        return false;
      }
      for (let i = this.pile.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = this.pile[i];
        this.pile[i] = this.pile[j];
        this.pile[j] = tmp;
        const tmpP = this.pilePoses[i];
        this.pilePoses[i] = this.pilePoses[j];
        this.pilePoses[j] = tmpP;
        const tmpF = this.pileFaceDown[i];
        this.pileFaceDown[i] = this.pileFaceDown[j];
        this.pileFaceDown[j] = tmpF;
      }
      this.bumpPileLayout();
      return true;
    }
    /** 翻开 z 最高的一张扣牌（最上层未明牌）。 */
    toolReveal() {
      var _a, _b;
      let pick = -1;
      let bestZ = -Infinity;
      for (let i = 0; i < this.pileFaceDown.length; i += 1) {
        if (!this.pileFaceDown[i]) {
          continue;
        }
        const z = (_b = (_a = this.pilePoses[i]) == null ? void 0 : _a.z) != null ? _b : i;
        if (z > bestZ) {
          bestZ = z;
          pick = i;
        }
      }
      if (pick < 0) {
        return false;
      }
      this.pileFaceDown[pick] = false;
      this.bumpPileLayout();
      return true;
    }
    faceDownCountInPile() {
      return this.pileFaceDown.filter(Boolean).length;
    }
    checkWinOrLose() {
      if (this.pile.length === 0 && this.slots.length === 0) {
        this.phase = "won";
        return;
      }
      if (this.slots.length >= this.maxSlots() && !this.canAutoMatch()) {
        this.phase = "lost";
        this.failReason = "slot_full";
      }
    }
    toSnapshot() {
      return {
        level: this.level,
        pile: this.pile.slice(),
        pilePoses: this.pilePoses.map((p) => ({ ...p })),
        poseVersion: MAHJONG_PILE_POSE_VERSION,
        pileFaceDown: this.pileFaceDown.slice(),
        slots: this.slots.slice(),
        remainingMs: this.remainingMs,
        starsThisRun: this.starsThisRun,
        coinsThisRun: this.coinsThisRun,
        adSlotUnlocked: this.adSlotUnlocked,
        phase: this.phase,
        failReason: this.failReason,
        themeId: this.themeId,
        typeCount: this.typeCount,
        seed: this.seed,
        tools: { ...this.tools },
        guideShown: this.guideShown
      };
    }
    static fromSnapshot(s) {
      var _a, _b;
      const g = {
        level: s.level,
        pile: s.pile.slice(),
        typeCount: s.typeCount,
        seed: s.seed,
        themeId: s.themeId
      };
      const themeTiles = (_b = (_a = getMahjongTheme(s.themeId)) == null ? void 0 : _a.tiles.length) != null ? _b : s.typeCount;
      const game = new _MahjongGame(g, s.themeId, s.tools, s.guideShown, s.remainingMs, themeTiles);
      game.pile = s.pile.slice();
      const refPoses = buildMahjongPilePoses(s.pile.length, s.seed, s.level);
      game.pilePoses = s.pilePoses && s.pilePoses.length === s.pile.length && s.poseVersion === MAHJONG_PILE_POSE_VERSION ? s.pilePoses.map((p) => ({ ...p })) : refPoses.map((p) => ({ ...p }));
      game.pileFaceDown = s.pileFaceDown && s.pileFaceDown.length === s.pile.length ? s.pileFaceDown.slice() : buildInitialPileFaceDown(game.pilePoses, s.level, s.seed);
      if (s.level <= 1) {
        game.pileFaceDown.fill(false);
      }
      game.starsThisRun = s.starsThisRun;
      game.coinsThisRun = s.coinsThisRun;
      game.slots = s.slots.slice();
      if (game.phase === "playing") {
        game.compactSlotsTriplesWithReward();
      }
      game.adSlotUnlocked = s.adSlotUnlocked;
      game.phase = s.phase;
      game.failReason = s.failReason;
      game.bumpPileLayout();
      return game;
    }
  };

  // src/logic/mahjong/MahjongGenerator.ts
  function hashSeed(playerKey, level) {
    const raw = `${playerKey}|${level}|${mahjongSeedVersion()}`;
    let h = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function buildLevel1TutorialPile(seed) {
    const rng = createSeededRandom(seed ^ 130129921);
    const pile = [];
    for (let row = 0; row < 3; row += 1) {
      const rowTypes = [0, 1, 2];
      shuffleInPlace(rowTypes, rng);
      pile.push(rowTypes[0], rowTypes[1], rowTypes[2]);
    }
    return pile;
  }
  function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
  function buildSolvablePile(totalTiles, typeCount, rng) {
    const blockTotal = totalTiles / 3;
    const blocksPerType = new Array(typeCount).fill(0);
    for (let i = 0; i < blockTotal; i += 1) {
      const t = Math.floor(rng() * typeCount);
      blocksPerType[t] += 1;
    }
    const blockTypes = [];
    for (let t = 0; t < typeCount; t += 1) {
      for (let b = 0; b < blocksPerType[t]; b += 1) {
        blockTypes.push(t);
      }
    }
    shuffleInPlace(blockTypes, rng);
    const pile = [];
    for (const t of blockTypes) {
      pile.push(t, t, t);
    }
    return pile;
  }
  function generateMahjongStandard105Level(level, playerKey, seed, themeId) {
    const maxAttempts = mahjongGenerationMaxAttempts();
    const standardTiles = mahjongStandardTiles();
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const rng = createSeededRandom(seed + attempt * 9973);
      const typeCount2 = mahjongTypeCountForGeneration(level, rng);
      const pile2 = buildSolvablePile(standardTiles, typeCount2, rng);
      if (verifySolvablePile(pile2, MAHJONG_BASE_SLOTS)) {
        return { level, pile: pile2, typeCount: typeCount2, seed: seed + attempt, themeId };
      }
    }
    const fallbackRng = createSeededRandom(seed);
    const typeCount = mahjongTypeCountForGeneration(level, fallbackRng);
    const pile = buildSolvablePile(standardTiles, typeCount, fallbackRng);
    return { level, pile, typeCount, seed, themeId };
  }
  function generateMahjongLevel(level, playerKey) {
    const safeLevel = Math.max(1, Math.floor(level));
    const seed = hashSeed(playerKey, safeLevel);
    const theme = pickMahjongThemeForLevel(safeLevel, seed);
    const total = mahjongTileCountForLevel(safeLevel);
    if (total === mahjongLevel1Tiles()) {
      const pile = buildLevel1TutorialPile(seed);
      return {
        level: safeLevel,
        pile,
        typeCount: 3,
        seed,
        /** 第一关固定「萌宠经典」，便于对照五面小兔子样板（红狐/蓝兔/绿蛙） */
        themeId: "default"
      };
    }
    return generateMahjongStandard105Level(safeLevel, playerKey, seed, theme.themeId);
  }
  function verifySolvablePile(pile, maxSlots) {
    const pileCopy = pile.slice();
    let slots = [];
    const resolve = (next) => {
      var _a, _b;
      const counts = /* @__PURE__ */ new Map();
      for (const t of next) {
        counts.set(t, ((_a = counts.get(t)) != null ? _a : 0) + 1);
      }
      const keep = /* @__PURE__ */ new Map();
      for (const [t, c] of counts) {
        keep.set(t, c % 3);
      }
      const out = [];
      for (const t of next) {
        const left = (_b = keep.get(t)) != null ? _b : 0;
        if (left > 0) {
          keep.set(t, left - 1);
          out.push(t);
        }
      }
      return out;
    };
    while (pileCopy.length > 0) {
      const tile = pileCopy.shift();
      slots = resolve([...slots, tile]);
      if (slots.length > maxSlots) {
        return false;
      }
    }
    return slots.length === 0;
  }

  // src/services/MahjongHallService.ts
  var MahjongHallService = class {
    constructor(storage, analytics) {
      this.storage = storage;
      this.analytics = analytics;
      this.data = emptyMahjongProgress();
      this.active = null;
      this.playerKey = "local";
      this.cloudSyncHook = null;
      this.ladderCoinWallet = null;
    }
    /** 本地麻将进度变更后触发云存档推送（由 GameSession 注入）。 */
    setCloudSyncHook(hook) {
      this.cloudSyncHook = hook;
    }
    /** 萌宠麻将馆消耗统一走梯子关卡折算金币。 */
    setLadderCoinWallet(wallet) {
      this.ladderCoinWallet = wallet;
    }
    getSpendableCoins() {
      if (this.ladderCoinWallet) {
        return this.ladderCoinWallet.getAvailable();
      }
      return this.data.coins;
    }
    setPlayerKey(key) {
      this.playerKey = key.length > 0 ? key : "local";
    }
    async load() {
      const saved = await this.storage.get(StorageKeys.MahjongHallProgress);
      this.data = normalizeMahjongProgress(saved);
    }
    async persist() {
      var _a;
      await this.storage.set(StorageKeys.MahjongHallProgress, this.data);
      (_a = this.cloudSyncHook) == null ? void 0 : _a.call(this);
    }
    getProgress() {
      return this.data;
    }
    getCloudSlice() {
      return normalizeMahjongProgress(this.data);
    }
    loadProgress(data) {
      var _a, _b;
      this.data = normalizeMahjongProgress(data);
      if (this.active && ((_a = this.data.savedRun) == null ? void 0 : _a.phase) === "playing") {
        if (this.active.level !== this.data.savedRun.level) {
          this.active = null;
        }
      } else if (((_b = this.active) == null ? void 0 : _b.phase) === "playing") {
        this.active = null;
      }
    }
    getActiveGame() {
      return this.active;
    }
    isLevelUnlocked(level) {
      return level >= 1 && level <= this.data.highestUnlocked;
    }
    bestStars(level) {
      var _a;
      return (_a = this.data.starsByLevel[String(level)]) != null ? _a : 0;
    }
    /** 入口直进对局：有未完成局则恢复，否则当前进度关（无限叠加的最高可挑战关）。 */
    resolveEntryLevel() {
      var _a, _b;
      if (((_a = this.data.savedRun) == null ? void 0 : _a.phase) === "playing" || ((_b = this.data.savedRun) == null ? void 0 : _b.phase) === "lost") {
        return this.data.savedRun.level;
      }
      if (this.data.blockedReplayLevel != null) {
        return this.data.blockedReplayLevel;
      }
      return this.data.highestUnlocked;
    }
    /** 无未完成局且本关已失败锁定时，不可免费再进。 */
    canFreeEnterMahjongLevel(level) {
      const safeLevel = Math.max(1, Math.floor(level));
      if (this.data.savedRun && this.data.savedRun.level === safeLevel && (this.data.savedRun.phase === "playing" || this.data.savedRun.phase === "lost")) {
        return true;
      }
      return this.data.blockedReplayLevel !== safeLevel;
    }
    enterFromHall() {
      const level = this.resolveEntryLevel();
      if (!this.canFreeEnterMahjongLevel(level)) {
        throw new Error("MAHJONG_REPLAY_REQUIRED");
      }
      const resume = this.data.savedRun != null && this.data.savedRun.level === level && (this.data.savedRun.phase === "playing" || this.data.savedRun.phase === "lost");
      return this.startLevel(level, resume);
    }
    /** 本关重开：清存档并重新生成牌局（需已付金币或从失败 UI 触发）。 */
    async restartLevel(level) {
      if (this.active) {
        this.data.tools = { ...this.active.tools };
        this.active = null;
      }
      this.data.savedRun = null;
      this.data.blockedReplayLevel = null;
      await this.persist();
      return this.startLevel(level, false);
    }
    startLevel(level, resume = true) {
      var _a, _b, _c, _d;
      const safeLevel = Math.min(
        MAHJONG_INFINITE_LEVEL_CAP,
        Math.max(1, Math.floor(level))
      );
      if (resume && this.data.savedRun && this.data.savedRun.level === safeLevel && (this.data.savedRun.phase === "playing" || this.data.savedRun.phase === "lost")) {
        if (this.data.savedRun.phase === "playing" && this.data.blockedReplayLevel === safeLevel) {
          resume = false;
        } else {
          this.active = MahjongGame.fromSnapshot(this.data.savedRun);
          this.analytics.track("mahjong_level_resume", {
            level: safeLevel,
            phase: this.active.phase
          });
          return this.active;
        }
      }
      if (!resume && this.data.blockedReplayLevel === safeLevel) {
        throw new Error("MAHJONG_REPLAY_REQUIRED");
      }
      const generated = generateMahjongLevel(safeLevel, this.playerKey);
      if (shouldMahjongOpsSampleLevel(safeLevel)) {
        const solvable = verifySolvablePile(generated.pile, MAHJONG_BASE_SLOTS);
        this.analytics.track("mahjong_ops_level_sample", {
          level: safeLevel,
          solvable,
          seed: generated.seed,
          typeCount: generated.typeCount,
          opsVersion: getMahjongOpsVersion()
        });
      }
      const themeId = generated.themeId;
      const themeTileCount = (_b = (_a = getMahjongTheme(themeId)) == null ? void 0 : _a.tiles.length) != null ? _b : generated.typeCount;
      this.active = new MahjongGame(
        generated,
        themeId,
        { ...this.data.tools },
        this.data.guideSeen,
        mahjongTimeoutMsForLevel(safeLevel),
        themeTileCount
      );
      if (safeLevel === 1 && !this.data.guideSeen) {
        this.active.guideShown = false;
      }
      this.data.savedRun = this.active.toSnapshot();
      void this.persist();
      const themeName = (_d = (_c = getMahjongTheme(themeId)) == null ? void 0 : _c.name) != null ? _d : themeId;
      this.analytics.track("mahjong_level_start", { level: safeLevel, themeId, themeName });
      this.analytics.track("mahjong_theme_exposure", { level: safeLevel, themeId, themeName });
      return this.active;
    }
    trackTileTap(level) {
      this.analytics.track("mahjong_tile_tap", { level });
    }
    trackTripleClear(level, stars) {
      this.analytics.track("mahjong_triple_clear", { level, stars });
    }
    trackToolUse(tool, level) {
      this.analytics.track("mahjong_tool_use", { tool, level });
    }
    trackHallEnter(level) {
      this.analytics.track("mahjong_hall_enter", { level });
    }
    trackAutoNext(level) {
      this.analytics.track("mahjong_auto_next", { level });
    }
    trackThemeCdnFallback(requestedThemeId) {
      this.analytics.track("mahjong_theme_cdn_fallback", { requestedThemeId });
    }
    async saveActiveRun() {
      if (!this.active || this.active.phase !== "playing") {
        return;
      }
      this.data.savedRun = this.active.toSnapshot();
      await this.persist();
      this.analytics.track("mahjong_progress_save");
    }
    /** 失败瞬间写入 lost 快照，避免磁盘仍留 playing 可白嫖续玩。 */
    async persistFailedRun() {
      if (!this.active || this.active.phase !== "lost") {
        return;
      }
      this.data.savedRun = this.active.toSnapshot();
      this.data.blockedReplayLevel = this.active.level;
      await this.persist();
    }
    async clearSavedRun() {
      this.data.savedRun = null;
      this.data.blockedReplayLevel = null;
      await this.persist();
    }
    async finishActive(won) {
      var _a;
      if (!this.active) {
        return;
      }
      const game = this.active;
      if (won) {
        this.data = recordMahjongClear(this.data, game.level, game.starsThisRun, 0);
        this.data.tools = { ...game.tools };
        if (game.level === 1) {
          this.data.guideSeen = true;
        }
        this.analytics.track("mahjong_level_win", {
          level: game.level,
          stars: game.starsThisRun,
          coins: game.coinsThisRun
        });
      } else {
        this.data.tools = { ...game.tools };
        this.data.savedRun = null;
        if (this.data.blockedReplayLevel == null) {
          this.data.blockedReplayLevel = game.level;
        }
        this.analytics.track("mahjong_level_fail", {
          level: game.level,
          reason: (_a = game.failReason) != null ? _a : "unknown"
        });
      }
      this.active = null;
      await this.persist();
    }
    leaveTable() {
      var _a, _b;
      if (((_a = this.active) == null ? void 0 : _a.phase) === "playing") {
        this.data.savedRun = this.active.toSnapshot();
        void this.persist();
      } else if (((_b = this.active) == null ? void 0 : _b.phase) === "lost") {
        void this.persistFailedRun();
      }
      this.active = null;
    }
    spendCoins(amount) {
      const cost = Math.floor(amount);
      if (cost <= 0) {
        return true;
      }
      if (this.ladderCoinWallet) {
        return this.ladderCoinWallet.spend(cost);
      }
      if (this.data.coins < cost) {
        return false;
      }
      this.data.coins -= cost;
      void this.persist();
      return true;
    }
    buyTool(tool) {
      if (!this.spendCoins(mahjongCoinCost())) {
        return false;
      }
      this.grantTool(tool, "coin");
      return true;
    }
    /** 看广告等途径发放 1 个道具 */
    grantTool(tool, source = "ad") {
      this.data.tools[tool] += 1;
      if (this.active) {
        this.active.tools[tool] += 1;
      }
      void this.persist();
      if (source === "coin") {
        this.analytics.track("mahjong_coin_buy_tool", { tool });
      }
    }
    payReplay(coinCost = MAHJONG_REPLAY_COIN_COST) {
      if (!this.spendCoins(coinCost)) {
        return false;
      }
      this.analytics.track("mahjong_coin_replay");
      return true;
    }
    async unlockAdSlot() {
      if (!this.active || this.active.adSlotUnlocked) {
        return false;
      }
      this.active.unlockAdSlot();
      this.data.savedRun = this.active.toSnapshot();
      await this.persist();
      this.analytics.track("mahjong_ad_slot");
      return true;
    }
    async reviveAfterSlotFullAd() {
      var _a;
      if (!((_a = this.active) == null ? void 0 : _a.reviveMoveOutFromSlots())) {
        return false;
      }
      this.data.blockedReplayLevel = null;
      this.data.savedRun = this.active.toSnapshot();
      await this.persist();
      this.analytics.track("mahjong_slot_full_revive", { level: this.active.level });
      return true;
    }
  };

  // src/core/adapters/MahjongCdnFetch.ts
  function createWxMahjongManifestFetcher() {
    return (url) => new Promise((resolve, reject) => {
      if (typeof wx === "undefined" || typeof wx.request !== "function") {
        reject(new Error("wx.request unavailable"));
        return;
      }
      wx.request({
        url,
        method: "GET",
        success: (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          resolve(res.data);
        },
        fail: (err) => reject(err)
      });
    });
  }

  // src/core/adapters/WxMahjongOpsCloud.ts
  function cloudApi2() {
    try {
      if (typeof wx === "undefined" || !wx.cloud) {
        return null;
      }
      return wx.cloud;
    } catch (e) {
      return null;
    }
  }
  var cloudReady = null;
  function ensureCloudInit() {
    if (cloudReady) {
      return cloudReady;
    }
    cloudReady = (async () => {
      if (cloud_default.enabled === false) {
        return false;
      }
      const cloud = cloudApi2();
      if (!cloud || typeof cloud.init !== "function") {
        return false;
      }
      try {
        const env = cloud_default.envId || cloud.DYNAMIC_CURRENT_ENV;
        cloud.init(env ? { env, traceUser: true } : { traceUser: true });
        return true;
      } catch (e) {
        return false;
      }
    })();
    return cloudReady;
  }
  async function fetchMahjongOpsViaCloudFunction() {
    if (cloud_default.enabled === false) {
      return null;
    }
    if (!await ensureCloudInit()) {
      return null;
    }
    const cloud = cloudApi2();
    if (!cloud || typeof cloud.callFunction !== "function") {
      return null;
    }
    try {
      const res = await cloud.callFunction({ name: "getMahjongOps", data: {} });
      const payload = res.result;
      if (!(payload == null ? void 0 : payload.ok) || !payload.config) {
        return null;
      }
      return payload.config;
    } catch (e) {
      return null;
    }
  }

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
      /** 通关后顶部公告（大厅 / 局内），进下一关时清除 */
      this.postClearAnnouncement = null;
      this.lastLeaderboardSelfRank = 0;
      this.lastLeaderboardRanks = /* @__PURE__ */ new Map();
      this.claimingInvite = false;
      this.seenNoticeIds = /* @__PURE__ */ new Set();
      /** 大厅麻将馆 NEW 角标：点过入口后不再展示 */
      this.mahjongHallNewDismissed = false;
      this.extraMovesGrant = items_default.extraMoves.moves;
      /** 本周榜：本地累计的通关分，跨周清零 */
      this.weekly = { week: "", score: 0 };
      /** 上周榜结算到账提示，大厅取一次 */
      this.leaderboardRewardToast = null;
      /** 每日任务计数已改但还没落盘（逐步记，关末再写，避免每步都推云） */
      this.dailyTasksDirty = false;
      /** 本关额外拿到的步数（加步 / 看广告 / 复活），算星级时扣掉 */
      this.movesGrantedThisLevel = 0;
      this.lastStars = 0;
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
        if (!(cloud == null ? void 0 : cloud.claimInvite)) {
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
        } catch (e) {
        } finally {
          this.claimingInvite = false;
        }
      };
      var _a;
      this.fsm = new GameStateMachine("Boot");
      this.events = new GameEventBus();
      this.progress = new LevelProgress();
      this.mahjong = new MahjongHallService(deps.storage, deps.analytics);
      this.mahjong.setCloudSyncHook(() => {
        this.queueCloudPush();
      });
      const movesGranted = typeof balance_default.reviveMovesGranted === "number" ? balance_default.reviveMovesGranted : 5;
      this.revivePolicy = new RevivePolicy({
        maxRevivesPerLevel: Number.POSITIVE_INFINITY,
        movesGranted
      });
      this.adPolicy = new AdPlacementPolicy({
        offerReviveOnFail: true,
        interstitialEveryNLevels: (_a = ad_placements_default.interstitial_settle.everyNLevels) != null ? _a : 2
      });
      this.fsm.subscribe((from, to) => {
        this.events.emit({ type: "StateChanged", from, to });
      });
    }
    /**
     * 初始化会话：读档并进入大厅。
     */
    async init() {
      var _a, _b, _c;
      let saved = null;
      let readOk = false;
      try {
        saved = await this.deps.storage.get(StorageKeys.PlayerProgress);
        readOk = true;
      } catch (e) {
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
      this.boosters.loadStock(clampBoosterWallet(savedWallet != null ? savedWallet : EMPTY_BOOSTER_WALLET));
      const savedWeekly = await this.deps.storage.get(
        StorageKeys.Weekly
      );
      this.weekly = this.alignWeekly(savedWeekly);
      const savedInvite = await this.deps.storage.get(StorageKeys.Invite);
      this.invite = ensureInviteCode(parseInviteState(savedInvite));
      const savedNotices = await this.deps.storage.get(StorageKeys.NoticeSeen);
      this.seenNoticeIds = new Set(
        Array.isArray(savedNotices) ? savedNotices.filter((id) => typeof id === "string" && id.length > 0) : []
      );
      const mahjongNewDismissed = await this.deps.storage.get(
        StorageKeys.MahjongHallNewDismissed
      );
      this.mahjongHallNewDismissed = mahjongNewDismissed === true;
      await this.mahjong.load();
      this.mahjong.setPlayerKey(this.getInviteCode() || "local");
      this.mahjong.setLadderCoinWallet({
        getAvailable: () => this.progress.getLadderCoinsAvailable(),
        spend: (amount) => {
          const ok = this.progress.spendLadderCoins(amount);
          if (ok) {
            void this.deps.storage.set(StorageKeys.PlayerProgress, this.progress.getData());
          }
          return ok;
        }
      });
      void this.refreshMahjongThemeCatalog();
      void this.refreshMahjongOpsConfig();
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
      if (isWxDesktopIdeHost() || isDouyinMiniGameHost()) {
        this.cloudHydrated = true;
      } else {
        await this.syncCloudSave();
      }
      this.bindInviteFromQuery((_c = (_b = (_a = this.deps.platform).getLaunchQuery) == null ? void 0 : _b.call(_a)) != null ? _c : {});
      await this.persistInvite();
      void this.retryClaimInvite();
      if (readOk) {
        await this.deps.storage.set(StorageKeys.PlayerProgress, this.progress.getData());
      }
      this.deps.analytics.track("app_boot");
      this.fsm.transitionTo("Lobby");
      if (this.deps.challengeApi && !isWxDesktopIdeHost()) {
        void this.loadFriendLeaderboard();
      }
    }
    /**
     * 覆盖关卡表（单测注入短关卡用）。
     * @param levels - 关卡配置列表
     */
    setLevelTable(levels) {
      this.levelTable = levels.slice();
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
      var _a;
      const from = this.fsm.getCurrent();
      if (from === "Boot") {
        this.fsm.transitionTo("Lobby");
      }
      if (!this.fsm.transitionTo("LoadingLevel")) {
        throw new Error(`Cannot start level from state: ${this.fsm.getCurrent()}`);
      }
      this.clearPostClearAnnouncement();
      this.level = config;
      this.goals = new LevelGoals(config.goals);
      this.movesLeft = config.moves;
      this.score = 0;
      this.crush = null;
      this.clean = null;
      this.cleaningUsedThisSettle = false;
      this.pendingMovesBonus = false;
      this.movesGrantedThisLevel = 0;
      this.lastStars = 0;
      this.buriedNotified.clear();
      this.revivePolicy.resetForLevel();
      this.revivePolicy.setMaxPerLevel(Number.POSITIVE_INFINITY);
      this.board = new BoardModel(config.board);
      applyBoardShape(this.board, config.shape);
      const basicKinds = match3BasicKindCount(config.id, config);
      this.resolver.setBasicKindCount(basicKinds);
      generatePlayableBoard(this.board, config.seed, basicKinds);
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
      } else if (config.cloud && typeof config.cloud === "object" && "midRows" in config.cloud) {
        const bottomCenterGap = "bottomCenterGap" in config.cloud && typeof config.cloud.bottomCenterGap === "number" ? config.cloud.bottomCenterGap : 0;
        this.cloudsAtStart = this.board.coverMiddleRowsWithCloud(
          config.cloud.midRows,
          bottomCenterGap
        );
      } else if (config.cloud && typeof config.cloud === "object" && "skipTopRows" in config.cloud) {
        this.cloudsAtStart = this.board.coverPlayableSkippingTopRowsWithCloud(config.cloud.skipTopRows);
      } else if (config.cloud && typeof config.cloud === "object" && "bottomRows" in config.cloud) {
        const centerCap = "centerCap" in config.cloud && typeof config.cloud.centerCap === "number" ? config.cloud.centerCap : 0;
        const topCenterGap = "topCenterGap" in config.cloud && typeof config.cloud.topCenterGap === "number" ? config.cloud.topCenterGap : 0;
        if (topCenterGap > 0) {
          const rightClear = "rightClear" in config.cloud && typeof config.cloud.rightClear === "number" ? config.cloud.rightClear : 0;
          this.cloudsAtStart = this.board.coverBottomRowsWithCloudTopGap(
            config.cloud.bottomRows,
            topCenterGap,
            rightClear
          );
        } else if (centerCap > 0) {
          this.cloudsAtStart = this.board.coverBottomRowsWithCloudCap(
            config.cloud.bottomRows,
            centerCap
          );
        } else {
          this.cloudsAtStart = this.board.coverBottomRowsWithCloud(config.cloud.bottomRows);
        }
      } else if (typeof config.cloudRows === "number" && config.cloudRows > 0) {
        this.cloudsAtStart = this.board.coverBottomRowsWithCloud(config.cloudRows);
      }
      if (this.cloudsAtStart > 0) {
        this.goals.bindClearCloudTarget(this.cloudsAtStart);
      }
      if (config.eggs) {
        this.eggsAtStart = this.board.placeEggs(
          config.eggs.count,
          (_a = config.eggs.layers) != null ? _a : 1,
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
    /**
     * 在用户点击「好友排行」手势里尝试拉微信头像/昵称。
     * 未授权时返回 false，需 UI 弹出 createUserInfoButton。
     * 真实微信号永远拿不到，只用邀请码。
     */
    async ensureWxUserProfile() {
      const wxId = this.getInviteCode() || "";
      const profile = await ensureWxUserProfile(wxId);
      return !!(profile == null ? void 0 : profile.avatarUrl) || !!(profile && profile.nickName && profile.nickName !== "\u5FAE\u4FE1\u73A9\u5BB6");
    }
    /**
     * 玩家排行：拉取所有玩过本小游戏的用户。
     * 展示排名、头像、昵称、微信号、分数；接口不可用时至少展示自己。
     */
    async loadFriendLeaderboard() {
      const userId = this.getInviteCode() || "me";
      const maxLevel = this.getMaxClearedLevelId();
      const profile = this.readWxProfile();
      const nowMs = Date.now();
      this.weekly = this.alignWeekly(this.weekly, nowMs);
      const totalScore = Math.max(0, Math.floor(this.progress.getData().totalScore || 0));
      const selfInput = {
        rank: 0,
        userId,
        maxLevel,
        bestTimeMs: null,
        completed: false,
        isSelf: true,
        nickName: profile.nickName || "\u5FAE\u4FE1\u73A9\u5BB6",
        avatarUrl: profile.avatarUrl,
        wxId: profile.wxId || userId,
        score: maxLevel,
        totalScore,
        weekScore: this.weekly.score
      };
      const api = this.deps.challengeApi;
      if (api) {
        try {
          const res = await api.leaderboard(userId, maxLevel, {
            ...this.leaderboardProfileExtra(profile),
            totalScore,
            weekKey: this.weekly.week,
            weekScore: this.weekly.score
          });
          if (res.ok) {
            this.absorbLeaderboardResponse(res);
            selfInput.weekScore = this.weekly.score;
            return this.buildLeaderboardView(res, selfInput, profile, nowMs);
          }
        } catch (e) {
        }
      }
      return this.buildLeaderboardView(null, selfInput, profile, nowMs);
    }
    /** 上周结算到账提示（大厅弹一次）。 */
    takeLeaderboardRewardToast() {
      const text = this.leaderboardRewardToast;
      this.leaderboardRewardToast = null;
      return text;
    }
    getWeeklyScore() {
      this.weekly = this.alignWeekly(this.weekly);
      return this.weekly.score;
    }
    alignWeekly(raw, nowMs = Date.now()) {
      const week = localIsoWeek(nowMs);
      if (!raw || raw.week !== week) {
        return { week, score: 0 };
      }
      return { week, score: Math.max(0, Math.floor(Number(raw.score) || 0)) };
    }
    addWeeklyScore(points) {
      this.weekly = this.alignWeekly(this.weekly);
      const add = Math.max(0, Math.floor(points));
      if (add <= 0) {
        return;
      }
      this.weekly = { ...this.weekly, score: this.weekly.score + add };
      void this.deps.storage.set(StorageKeys.Weekly, this.weekly);
    }
    leaderboardProfileExtra(profile) {
      return {
        nickName: profile.nickName && profile.nickName !== "\u5FAE\u4FE1\u73A9\u5BB6" ? profile.nickName : void 0,
        avatarUrl: profile.avatarUrl || void 0
      };
    }
    /** 服务端回包里的本周分补本地（换机）和上周结算奖励。 */
    absorbLeaderboardResponse(res) {
      var _a;
      const serverWeekly = Math.max(0, Math.floor((_a = res.selfWeekScore) != null ? _a : 0));
      if (res.week && res.week === this.weekly.week && serverWeekly > this.weekly.score) {
        this.weekly = { ...this.weekly, score: serverWeekly };
        void this.deps.storage.set(StorageKeys.Weekly, this.weekly);
      }
      const reward = res.weeklyReward;
      if (!reward || !(reward.rank >= 1)) {
        return;
      }
      const tier = leaderboardTierForRank(reward.rank);
      const plan = planLeaderboardGrants(this.boosters.getStock(), reward.rank);
      if (tier) {
        this.boosters.loadStock(plan.wallet);
        void this.persistBoosters();
      }
      this.leaderboardRewardToast = leaderboardRewardedText(reward.rank, plan.grants, !!tier);
      this.deps.analytics.track("leaderboard_reward", {
        week: reward.week,
        rank: reward.rank,
        score: reward.score
      });
      this.events.emit({ type: "LeaderboardReward" });
    }
    leaderboardRowInput(row, profile) {
      var _a, _b;
      return {
        ...row,
        rank: Math.max(0, Math.floor((_a = row.rank) != null ? _a : 0)),
        nickName: row.nickName || (row.isSelf ? profile.nickName || "\u5FAE\u4FE1\u73A9\u5BB6" : void 0),
        avatarUrl: row.avatarUrl || (row.isSelf ? profile.avatarUrl : void 0),
        wxId: row.wxId || row.userId,
        score: (_b = row.score) != null ? _b : row.maxLevel
      };
    }
    buildLeaderboardTab(id, board, selfInput, profile) {
      var _a, _b, _c, _d, _e, _f, _g;
      const rows = ((_a = board == null ? void 0 : board.rows) != null ? _a : []).map((row) => this.leaderboardRowInput(row, profile));
      const listed = rows.find((row) => row.isSelf);
      const selfRank = Math.max(0, Math.floor((_c = (_b = board == null ? void 0 : board.selfRank) != null ? _b : listed == null ? void 0 : listed.rank) != null ? _c : 0));
      const selfRow = (_d = listed != null ? listed : (board == null ? void 0 : board.self) ? this.leaderboardRowInput(board.self, profile) : null) != null ? _d : { ...selfInput, rank: selfRank };
      if (id === "week") {
        selfRow.weekScore = Math.max((_e = selfRow.weekScore) != null ? _e : 0, (_f = selfInput.weekScore) != null ? _f : 0);
      }
      const above = selfRank > 1 ? (_g = rows.find((row) => row.rank === selfRank - 1)) != null ? _g : null : null;
      return {
        id,
        label: id === "week" ? notice_default.leaderboard.tabWeek : notice_default.leaderboard.tabLevel,
        rule: id === "week" ? notice_default.leaderboard.ruleWeek : notice_default.leaderboard.ruleLevel,
        rows: rows.map((row) => formatLeaderboardLine(row, id)),
        self: formatLeaderboardLine({ ...selfRow, rank: selfRank, isSelf: true }, id),
        selfRank,
        gapHint: leaderboardGapHint({ tab: id, selfRank, self: selfRow, above })
      };
    }
    buildLeaderboardView(res, selfInput, profile, nowMs) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const levelBoard = res ? (_c = res.level) != null ? _c : { rows: (_a = res.rows) != null ? _a : [], selfRank: (_b = res.selfRank) != null ? _b : 0 } : null;
      if (levelBoard == null ? void 0 : levelBoard.rows.length) {
        this.syncLeaderboardRankSnapshot(levelBoard.rows);
      }
      const levelTab = (levelBoard == null ? void 0 : levelBoard.rows.length) ? this.buildLeaderboardTab("level", levelBoard, selfInput, profile) : this.buildLeaderboardTab(
        "level",
        { rows: rankFriends([selfInput]), selfRank: 1 },
        selfInput,
        profile
      );
      let weekBoard = (_d = res == null ? void 0 : res.weekly) != null ? _d : null;
      if (!((_e = weekBoard == null ? void 0 : weekBoard.rows) == null ? void 0 : _e.length) && ((_f = selfInput.weekScore) != null ? _f : 0) > 0) {
        weekBoard = {
          rows: rankFriends([selfInput]),
          selfRank: 1
        };
      }
      const weekTab = this.buildLeaderboardTab("week", weekBoard, selfInput, profile);
      return {
        title: notice_default.leaderboard.title,
        hint: (_g = res == null ? void 0 : res.hint) != null ? _g : "",
        rewardText: (_h = res == null ? void 0 : res.rewardText) != null ? _h : leaderboardRewardText(),
        selfRank: levelTab.selfRank,
        rows: levelTab.rows,
        tabs: { level: levelTab, week: weekTab },
        settleText: weeklySettleCountdownText(nowMs, res == null ? void 0 : res.settleAt)
      };
    }
    readWxProfile() {
      const wxId = this.getInviteCode();
      const cached = readCachedWxProfile(wxId);
      if (cached && cached.avatarUrl) {
        return {
          nickName: cached.nickName || "\u5FAE\u4FE1\u73A9\u5BB6",
          avatarUrl: cached.avatarUrl,
          wxId: cached.wxId || wxId
        };
      }
      return { nickName: "\u5FAE\u4FE1\u73A9\u5BB6", wxId };
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
    getPostClearAnnouncement() {
      var _a;
      const text = (_a = this.postClearAnnouncement) == null ? void 0 : _a.trim();
      return text || null;
    }
    clearPostClearAnnouncement() {
      this.postClearAnnouncement = null;
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
        invite: toInviteCloudSlice(this.invite),
        mahjong: this.mahjong.getCloudSlice()
      };
    }
    queueCloudPush() {
      var _a;
      if (!this.cloudHydrated || !((_a = this.deps.cloudSave) == null ? void 0 : _a.isEnabled())) {
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
      if (!this.cloudHydrated || !(cloud == null ? void 0 : cloud.isEnabled())) {
        return;
      }
      this.cloudPushInFlight = true;
      try {
        do {
          this.cloudPushQueued = false;
          await cloud.push(this.captureCloudSnapshot());
        } while (this.cloudPushQueued);
      } catch (e) {
      } finally {
        this.cloudPushInFlight = false;
        if (this.cloudPushQueued) {
          void this.flushCloudPush();
        }
      }
    }
    /** 用当前微信用户的云档和本地档合并：清缓存、换机、升版本都续关。 */
    async syncCloudSave() {
      var _a, _b;
      const cloud = this.deps.cloudSave;
      if (!(cloud == null ? void 0 : cloud.isEnabled())) {
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
        const credited = applyInviteCredit(this.invite, (_b = (_a = merged.invite) == null ? void 0 : _a.creditHammer) != null ? _b : 0);
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
        if (merged.mahjong) {
          this.mahjong.loadProgress(merged.mahjong);
          await this.deps.storage.set(StorageKeys.MahjongHallProgress, this.mahjong.getCloudSlice());
        }
        this.cloudHydrated = true;
        await this.flushCloudPush();
      } catch (e) {
        this.cloudHydrated = false;
      }
    }
    noteDailyClear() {
      this.daily = recordDailyClear(this.daily, Date.now());
      if (this.movesLeft >= LEFTOVER_MOVES_FOR_EXTRA && !this.daily.playExtraGranted) {
        this.boosters.add("extraMoves", 1);
        this.daily = { ...this.daily, playExtraGranted: true };
      }
      this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
      void this.persistDaily();
      void this.persistBoosters();
    }
    /** 大厅进度条满 3 格后，玩家点领取才发重排。 */
    claimDailyShuffle() {
      const claimed = claimDailyShuffle(this.daily);
      if (!claimed.granted) {
        return false;
      }
      this.daily = claimed.data;
      this.boosters.add("shuffle", 1);
      this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
      void this.persistDaily();
      void this.persistBoosters();
      return true;
    }
    /** 每日任务面板数据；跨天先对齐到今天。 */
    getDailyTasksView() {
      const aligned = applyDailyLogin(this.daily, Date.now());
      if (aligned.data.ymd !== this.daily.ymd) {
        this.daily = aligned.data;
        if (aligned.grantedHammer) {
          this.boosters.loadStock(addBoosterToWallet(this.boosters.getStock(), "hammer", 1));
          this.daily = { ...this.daily, bonusHammer: 0 };
          this.dailyGrantPending = true;
          void this.persistBoosters();
        }
        void this.persistDaily();
      }
      return viewDailyTasks(this.daily);
    }
    /** 领取单个每日任务奖励；返回到账文案，未完成或已领返回 null。 */
    claimDailyTask(id) {
      this.getDailyTasksView();
      const claimed = claimDailyTask(this.daily, id);
      if (!claimed.reward) {
        return null;
      }
      this.daily = claimed.data;
      const text = this.grantDailyRewards([claimed.reward]);
      void this.persistDaily();
      this.deps.analytics.track("daily_task_claim", { task: id });
      return text;
    }
    /** 4 个任务都领完后开宝箱；doubled 时先看激励视频，没看完不发。 */
    async claimDailyChest(doubled) {
      if (!this.getDailyTasksView().chestReady) {
        return null;
      }
      if (doubled) {
        this.deps.analytics.track("ad_show", { placement: "rewarded_revive", reason: "daily_chest" });
        const result = await this.deps.ads.show("rewarded_revive");
        if (result !== "completed") {
          return null;
        }
        this.deps.analytics.track("ad_complete", { placement: "rewarded_revive", reason: "daily_chest" });
      }
      const claimed = claimDailyChest(this.daily, doubled);
      if (!claimed.rewards) {
        return null;
      }
      this.daily = claimed.data;
      const text = this.grantDailyRewards(claimed.rewards);
      void this.persistDaily();
      this.deps.analytics.track("daily_chest_claim", { doubled });
      return text;
    }
    /** 道具入包（9 个封顶），返回实际到账文案。 */
    grantDailyRewards(rewards) {
      let wallet = this.boosters.getStock();
      const granted = [];
      for (const item of rewards) {
        const next = addBoosterToWallet(wallet, item.id, item.amount);
        granted.push({ id: item.id, amount: Math.max(0, next[item.id] - wallet[item.id]) });
        wallet = next;
      }
      this.boosters.loadStock(wallet);
      void this.persistBoosters();
      const text = formatDailyReward(granted);
      return text ? `\u9886\u53D6\u6210\u529F\uFF1A${text}` : "\u9053\u5177\u5DF2\u6EE1 9 \u4E2A\uFF0C\u5148\u7528\u6389\u4E00\u4E9B\u518D\u6765\u9886\u5427";
    }
    /** 局内逐步记任务进度，关末统一落盘。 */
    noteDailyTaskStats(patch) {
      const recorded = recordDailyTaskStats(this.daily, patch, Date.now());
      this.daily = recorded.data;
      this.dailyTasksDirty = true;
      for (const task of recorded.completed) {
        this.events.emit({ type: "DailyTaskCompleted", title: task.title });
      }
    }
    flushDailyTasks() {
      if (!this.dailyTasksDirty) {
        return;
      }
      this.dailyTasksDirty = false;
      void this.persistDaily();
    }
    /** 交换 / 锤子 / 步数加成这类消除结算后记任务进度。 */
    noteResolveForDailyTasks(result, countChain) {
      let specials = 0;
      for (const wave of result.waves) {
        specials += wave.specialSpawns.length;
      }
      this.noteDailyTaskStats({
        tiles: result.cleared,
        specials,
        chain: countChain ? result.cascadeDepth : 0,
        collectedKinds: result.clearedKinds.filter((kind) => isBasicTile(kind))
      });
    }
    /** 最近一次通关的星级（结算页用），未通关为 0。 */
    getLastStars() {
      return this.lastStars;
    }
    getLevelStars(levelId) {
      return this.progress.getStars(levelId);
    }
    commitLevelCleared() {
      if (!this.level) {
        return;
      }
      const clearedLevelId = this.level.id;
      const firstClear = isFreshPlayer(this.progress.getData());
      const stars = this.lastStars || 1;
      this.progress.markLevelCleared(clearedLevelId, this.score, stars);
      this.addWeeklyScore(this.score);
      this.noteDailyTaskStats({ threeStar: stars === 3 });
      this.dailyTasksDirty = false;
      const before = viewDailyTasks(this.daily).tasks;
      this.noteDailyClear();
      viewDailyTasks(this.daily).tasks.forEach((task, i) => {
        var _a;
        if (task.done && !task.claimed && !((_a = before[i]) == null ? void 0 : _a.done)) {
          this.events.emit({ type: "DailyTaskCompleted", title: task.title });
        }
      });
      if (firstClear) {
        this.noteInviteFirstClear();
      }
      this.persistProgress();
      this.postClearAnnouncement = buildPostClearAnnouncement({ clearedLevelId });
      void this.enrichPostClearAnnouncement(clearedLevelId);
    }
    syncLeaderboardRankSnapshot(rows) {
      var _a;
      const self = rows.find((row) => row.isSelf);
      this.lastLeaderboardSelfRank = (_a = self == null ? void 0 : self.rank) != null ? _a : 0;
      this.lastLeaderboardRanks = new Map(
        rows.map((row) => {
          var _a2;
          return [row.userId, Math.max(0, Math.floor((_a2 = row.rank) != null ? _a2 : 0))];
        })
      );
    }
    async enrichPostClearAnnouncement(_clearedLevelId) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      const api = this.deps.challengeApi;
      if (!api) {
        return;
      }
      const userId = this.getInviteCode() || "me";
      const profile = this.readWxProfile();
      const oldRank = this.lastLeaderboardSelfRank;
      const oldRanks = new Map(this.lastLeaderboardRanks);
      try {
        this.weekly = this.alignWeekly(this.weekly);
        const res = await api.leaderboard(userId, this.getMaxClearedLevelId(), {
          ...this.leaderboardProfileExtra(profile),
          totalScore: Math.max(0, Math.floor(this.progress.getData().totalScore || 0)),
          weekKey: this.weekly.week,
          weekScore: this.weekly.score
        });
        if (res.ok) {
          this.absorbLeaderboardResponse(res);
        }
        if (!res.ok || !((_a = res.rows) == null ? void 0 : _a.length)) {
          return;
        }
        this.syncLeaderboardRankSnapshot(res.rows);
        const ranked = res.rows.map((row) => {
          var _a2;
          return {
            userId: row.userId,
            rank: Math.max(1, Math.floor((_a2 = row.rank) != null ? _a2 : 0))
          };
        });
        const self = res.rows.find((row) => row.isSelf);
        const selfRank = (_c = (_b = self == null ? void 0 : self.rank) != null ? _b : res.selfRank) != null ? _c : 0;
        let hint = ((_d = res.hint) != null ? _d : "").trim();
        if (!hint && ((_e = res.notifies) == null ? void 0 : _e.length)) {
          const unread = res.notifies.find((n) => {
            var _a2;
            return !n.read && ((_a2 = n.message) == null ? void 0 : _a2.trim());
          });
          if (unread == null ? void 0 : unread.message) {
            hint = hintFromNotify(unread.message);
          }
        }
        if (!hint) {
          const passerId = findPasser(userId, oldRank, ranked, oldRanks);
          const passer = res.rows.find((row) => row.userId === passerId);
          const passerName = ((passer == null ? void 0 : passer.nickName) || (passer == null ? void 0 : passer.userId) || "").trim();
          const above = res.rows.find((row) => row.rank === selfRank - 1);
          hint = buildLeaderboardHint({
            passedBy: passerName ? passerName.slice(0, 12) : null,
            selfScore: Math.max(0, Math.floor((_g = (_f = self == null ? void 0 : self.score) != null ? _f : self == null ? void 0 : self.maxLevel) != null ? _g : 0)),
            aboveScore: above != null ? Math.max(0, Math.floor((_i = (_h = above.score) != null ? _h : above.maxLevel) != null ? _i : 0)) : null
          });
        }
        if (hint) {
          this.postClearAnnouncement = hint;
          this.events.emit({ type: "PostClearAnnouncement" });
        }
      } catch (e) {
      }
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
      this.noteDailyTaskStats({ boosterUsed: true });
      this.noteResolveForDailyTasks(result, false);
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
      this.noteDailyTaskStats({ boosterUsed: true });
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
      this.movesGrantedThisLevel += this.extraMovesGrant;
      this.playSfx("sfx_extra");
      this.noteDailyTaskStats({ boosterUsed: true });
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
    /** 空库存补给通道：好友 → 群 → 广告。非对局返回 none。 */
    getBoosterRefillChannel(id) {
      if (!this.allowsRewardedBooster(id)) {
        return "none";
      }
      return boosterRefillChannel(this.daily, id);
    }
    /**
     * 转发好友 / 群成功后发 1 个道具（重排只入包，不自动洗牌）。
     * 每个道具每天好友、群各允许 1 次。
     */
    claimBoosterShare(id) {
      var _a, _b;
      const channel = this.getBoosterRefillChannel(id);
      if (channel !== "friend" && channel !== "group") {
        return false;
      }
      this.applyBoosterRefill(id);
      this.daily = { ...this.daily, ...markBoosterShare(this.daily, id, channel) };
      void this.persistDaily();
      this.deps.analytics.track("booster_share", {
        boosterId: id,
        channel,
        levelId: (_b = (_a = this.level) == null ? void 0 : _a.id) != null ? _b : 0
      });
      return true;
    }
    /** 只推进好友/群阶梯，不发道具（测试解锁广告通道用）。 */
    markBoosterShareStep(id) {
      const channel = this.getBoosterRefillChannel(id);
      if (channel !== "friend" && channel !== "group") {
        return false;
      }
      this.daily = { ...this.daily, ...markBoosterShare(this.daily, id, channel) };
      void this.persistDaily();
      return true;
    }
    /**
     * 库存为 0 且已用完当日好友/群转发后看广告：锤子/重排 +1 入包；加步立刻 +5。
     */
    async watchAdForBooster(id) {
      if (this.getBoosterRefillChannel(id) !== "ad") {
        return "unavailable";
      }
      this.deps.analytics.track("ad_show", {
        placement: "rewarded_revive",
        levelId: this.level.id,
        reason: `booster_${id}`
      });
      const result = await this.deps.ads.show("rewarded_revive");
      if (result === "completed") {
        this.applyBoosterRefill(id);
        this.daily = { ...this.daily, ...bumpBoosterAd(this.daily, id) };
        void this.persistDaily();
        this.deps.analytics.track("ad_complete", {
          placement: "rewarded_revive",
          reason: `booster_${id}`
        });
        return "revived";
      }
      if (result === "skipped") {
        return "skipped";
      }
      return result === "not_ready" ? "unavailable" : "error";
    }
    /** 补给入包；重排不自动洗牌，需玩家再点道具。 */
    applyBoosterRefill(id) {
      if (id === "extraMoves") {
        this.movesLeft += this.extraMovesGrant;
        this.movesGrantedThisLevel += this.extraMovesGrant;
        this.playSfx("sfx_extra");
        this.events.emit({
          type: "BoosterUsed",
          boosterId: id,
          remaining: this.boosters.getCount(id),
          movesGranted: this.extraMovesGrant
        });
        return;
      }
      if (id === "shuffle") {
        this.boosters.add("shuffle", 1);
        this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
        void this.persistBoosters();
        return;
      }
      this.boosters.add(id, 1);
      this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
      void this.persistBoosters();
      this.playSfx("sfx_hammer");
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
      this.deps.audio.play("bgm_main", { loop: true, volume: 0.45 });
    }
    suspendForBackground() {
      var _a, _b;
      this.flushDailyTasks();
      (_b = (_a = this.deps.audio).suspendForBackground) == null ? void 0 : _b.call(_a);
    }
    resumeFromBackground() {
      var _a, _b;
      (_b = (_a = this.deps.audio).resumeFromBackground) == null ? void 0 : _b.call(_a);
    }
    /** 首次触摸时预加载短音效，避免消除飘字时音效尚未就绪 */
    preloadSfx() {
      var _a, _b;
      (_b = (_a = this.deps.audio).preloadSfx) == null ? void 0 : _b.call(_a);
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
    /** 大厅梯子展示关数（含未解锁预览）；配置模板仍为 1–20。 */
    getLevelCount() {
      return match3LobbyDisplayLevelCount(this.progress.getHighestLevelId());
    }
    /** 正式关卡模板数量（1–20）。 */
    getOfficialLevelTemplateCount() {
      return this.levelTable.length;
    }
    getBestScore(levelId) {
      return this.progress.getBestScore(levelId);
    }
    getLadderCoinsAvailable() {
      return this.progress.getLadderCoinsAvailable();
    }
    getLadderCoinsForLevel(levelId) {
      return this.progress.getLadderCoinsForLevel(levelId);
    }
    isLevelUnlocked(levelId) {
      return isLevelUnlockedForPlayer(
        levelId,
        this.progress.getHighestLevelId(),
        this.getLevelCount(),
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
    /** 已通关的最高关卡。highestLevelId 是下一关，所以要减 1，再和每关分数对一下。 */
    getMaxClearedLevelId() {
      var _a;
      const data = this.progress.getData();
      const scored = Object.keys((_a = data.levelScores) != null ? _a : {}).map((key) => Number(key)).filter((id) => Number.isFinite(id) && this.progress.isLevelCleared(id));
      const fromScores = scored.length > 0 ? Math.max(...scored) : 0;
      const fromHighest = Math.max(0, data.highestLevelId - 1);
      return Math.max(fromScores, fromHighest);
    }
    /** 通关第 20 关，或梯子累计金币达标，解锁萌宠麻将馆；开发版/体验版/开发者工具便于联调。 */
    isMahjongHallUnlocked() {
      if (shouldUnlockAllLevelsForPreview()) {
        return true;
      }
      if (this.getMaxClearedLevelId() >= 20) {
        return true;
      }
      const earned = totalLadderCoinsEarned(this.progress.getData().levelScores);
      return earned >= MAHJONG_HALL_UNLOCK_LADDER_COINS;
    }
    shouldShowMahjongHallNewBadge() {
      return !this.mahjongHallNewDismissed;
    }
    async dismissMahjongHallNewBadge() {
      if (this.mahjongHallNewDismissed) {
        return;
      }
      this.mahjongHallNewDismissed = true;
      await this.deps.storage.set(StorageKeys.MahjongHallNewDismissed, true);
    }
    /** 从 CDN 拉取麻将主题 manifest（`mahjong-cdn.json` 配置）。 */
    async refreshMahjongThemeCatalog() {
      try {
        const ok = await fetchMahjongThemeManifestFromCdn(createWxMahjongManifestFetcher());
        if (ok) {
          this.deps.analytics.track("mahjong_cdn_manifest_ok", {
            version: getMahjongThemeManifestVersion()
          });
        }
        return ok;
      } catch (e) {
        this.deps.analytics.track("mahjong_cdn_manifest_fail", {});
        return false;
      }
    }
    /** 运营配置：CDN opsConfigUrl 优先，否则云函数 getMahjongOps。 */
    async refreshMahjongOpsConfig() {
      try {
        const fetchJson = createWxMahjongManifestFetcher();
        const cdnOk = await fetchMahjongOpsFromCdn(fetchJson);
        if (cdnOk) {
          this.deps.analytics.track("mahjong_ops_config_ok", {
            source: "cdn",
            version: getMahjongOpsVersion()
          });
          return true;
        }
        const cloudOk = await fetchMahjongOpsFromCloud(() => fetchMahjongOpsViaCloudFunction());
        if (cloudOk) {
          this.deps.analytics.track("mahjong_ops_config_ok", {
            source: "cloud",
            version: getMahjongOpsVersion()
          });
          return true;
        }
        return false;
      } catch (e) {
        this.deps.analytics.track("mahjong_ops_config_fail", {});
        return false;
      }
    }
    /** 激励视频解锁麻将馆本局第 7 槽。 */
    async showMahjongAdSlot() {
      const game = this.mahjong.getActiveGame();
      if (!game || game.adSlotUnlocked) {
        return "unavailable";
      }
      if (!isMahjongRewardedVideoSlotEnabled()) {
        return "disabled";
      }
      this.deps.analytics.track("ad_show", {
        placement: "rewarded_revive",
        reason: "mahjong_ad_slot",
        levelId: game.level
      });
      if (!canCreateWxFullscreenAds()) {
        if (!shouldUnlockAllLevelsForPreview()) {
          return "unavailable";
        }
        const ok = await this.mahjong.unlockAdSlot();
        if (ok) {
          this.deps.analytics.track("ad_complete", {
            placement: "rewarded_revive",
            reason: "mahjong_ad_slot_dev"
          });
        }
        return ok ? "unlocked" : "error";
      }
      void this.deps.ads.load("rewarded_revive");
      const result = await this.deps.ads.show("rewarded_revive");
      if (result === "completed") {
        this.deps.analytics.track("ad_complete", {
          placement: "rewarded_revive",
          reason: "mahjong_ad_slot"
        });
        const ok = await this.mahjong.unlockAdSlot();
        return ok ? "unlocked" : "error";
      }
      if (result === "skipped") {
        return "skipped";
      }
      this.deps.analytics.track("ad_error", {
        placement: "rewarded_revive",
        reason: "mahjong_ad_slot",
        result
      });
      return result === "not_ready" ? "unavailable" : "error";
    }
    /** 大厅入口金币不足：看广告免金币重开本关。 */
    async showMahjongAdReplayUnlock() {
      const level = this.mahjong.resolveEntryLevel();
      this.deps.analytics.track("ad_show", {
        placement: "rewarded_revive",
        reason: "mahjong_replay_gate",
        levelId: level
      });
      if (!canCreateWxFullscreenAds()) {
        if (!shouldUnlockAllLevelsForPreview()) {
          return "unavailable";
        }
        await this.mahjong.restartLevel(level);
        this.deps.analytics.track("ad_complete", {
          placement: "rewarded_revive",
          reason: "mahjong_replay_gate_dev",
          levelId: level
        });
        return "restarted";
      }
      void this.deps.ads.load("rewarded_revive");
      const result = await this.deps.ads.show("rewarded_revive");
      if (result === "completed") {
        this.deps.analytics.track("ad_complete", {
          placement: "rewarded_revive",
          reason: "mahjong_replay_gate",
          levelId: level
        });
        await this.mahjong.restartLevel(level);
        return "restarted";
      }
      if (result === "skipped") {
        return "skipped";
      }
      this.deps.analytics.track("ad_error", {
        placement: "rewarded_revive",
        reason: "mahjong_replay_gate",
        result
      });
      return result === "not_ready" ? "unavailable" : "error";
    }
    /** 槽位已满：看激励视频移出 3 张后继续本局。 */
    async showMahjongSlotFullReviveAd() {
      const game = this.mahjong.getActiveGame();
      if (!(game == null ? void 0 : game.canReviveFromSlotFullAd())) {
        return "unavailable";
      }
      this.deps.analytics.track("ad_show", {
        placement: "rewarded_revive",
        reason: "mahjong_slot_full",
        levelId: game.level
      });
      if (!canCreateWxFullscreenAds()) {
        if (!shouldUnlockAllLevelsForPreview()) {
          return "unavailable";
        }
        const ok = await this.mahjong.reviveAfterSlotFullAd();
        if (ok) {
          this.deps.analytics.track("ad_complete", {
            placement: "rewarded_revive",
            reason: "mahjong_slot_full_dev"
          });
        }
        return ok ? "revived" : "error";
      }
      void this.deps.ads.load("rewarded_revive");
      const result = await this.deps.ads.show("rewarded_revive");
      if (result === "completed") {
        this.deps.analytics.track("ad_complete", {
          placement: "rewarded_revive",
          reason: "mahjong_slot_full"
        });
        const ok = await this.mahjong.reviveAfterSlotFullAd();
        return ok ? "revived" : "error";
      }
      if (result === "skipped") {
        return "skipped";
      }
      this.deps.analytics.track("ad_error", {
        placement: "rewarded_revive",
        reason: "mahjong_slot_full",
        result
      });
      return result === "not_ready" ? "unavailable" : "error";
    }
    /** 道具数量为 0：看激励视频获得 1 个。 */
    async showMahjongToolGrantAd(tool) {
      this.deps.analytics.track("ad_show", {
        placement: "rewarded_revive",
        reason: "mahjong_tool",
        tool
      });
      if (!canCreateWxFullscreenAds()) {
        if (!shouldUnlockAllLevelsForPreview()) {
          return "unavailable";
        }
        this.mahjong.grantTool(tool, "ad");
        this.deps.analytics.track("ad_complete", {
          placement: "rewarded_revive",
          reason: "mahjong_tool_dev",
          tool
        });
        return "granted";
      }
      void this.deps.ads.load("rewarded_revive");
      const result = await this.deps.ads.show("rewarded_revive");
      if (result === "completed") {
        this.deps.analytics.track("ad_complete", {
          placement: "rewarded_revive",
          reason: "mahjong_tool",
          tool
        });
        this.mahjong.grantTool(tool, "ad");
        return "granted";
      }
      if (result === "skipped") {
        return "skipped";
      }
      this.deps.analytics.track("ad_error", {
        placement: "rewarded_revive",
        reason: "mahjong_tool",
        tool,
        result
      });
      return result === "not_ready" ? "unavailable" : "error";
    }
    /** 大厅藤蔓：当前节点的 5 关（兼容旧逻辑） */
    getVineNode() {
      return getActiveVineNode(
        this.progress.getHighestLevelId(),
        this.getLevelCount()
      );
    }
    /** 大厅地图：配置表里的每一段都展示，未解锁也能上滑看到。 */
    listLobbyVineNodes() {
      return listAllVineNodes(
        this.progress.getHighestLevelId(),
        this.getLevelCount()
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
      var _a, _b;
      return (_b = (_a = this.crush) == null ? void 0 : _a.crushScore) != null ? _b : 0;
    }
    /**
     * 本局粉碎点击次数。
     */
    getCrushTapCount() {
      var _a, _b;
      return (_b = (_a = this.crush) == null ? void 0 : _a.tapCount) != null ? _b : 0;
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
      const basicKinds = match3BasicKindCount(this.level.id, this.level);
      generatePlayableBoard(this.board, this.level.seed + 7777 + this.level.id, basicKinds);
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
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      if (this.fsm.getCurrent() !== "Cleaning") {
        return false;
      }
      this.deps.analytics.track("crush_end", {
        levelId: (_b = (_a = this.level) == null ? void 0 : _a.id) != null ? _b : 0,
        mode: "cleaning",
        tapCount: (_d = (_c = this.clean) == null ? void 0 : _c.tapCount) != null ? _d : 0,
        cleanScore: (_f = (_e = this.clean) == null ? void 0 : _e.crushScore) != null ? _f : 0
      });
      this.events.emit({
        type: "CleaningEnded",
        cleanScore: (_h = (_g = this.clean) == null ? void 0 : _g.crushScore) != null ? _h : 0,
        tapCount: (_j = (_i = this.clean) == null ? void 0 : _i.tapCount) != null ? _j : 0
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
      return isMatch3LevelWithinCap(this.level.id + 1);
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
      this.noteResolveForDailyTasks(result, true);
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
      var _a, _b, _c;
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
        row: (_a = primary == null ? void 0 : primary.epicenter.r) != null ? _a : row,
        col: (_b = primary == null ? void 0 : primary.epicenter.c) != null ? _b : col,
        radius: (_c = primary == null ? void 0 : primary.radius) != null ? _c : burst.tapPower,
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
      var _a, _b;
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
          levelId: (_b = (_a = this.level) == null ? void 0 : _a.id) != null ? _b : 0,
          crushScore: this.crush.crushScore,
          tapCount: this.crush.tapCount
        });
        this.noteDailyTaskStats({ crushRound: true });
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
        this.movesGrantedThisLevel += offer.movesGranted;
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
      var _a;
      return ((_a = ad_placements_default.interstitial_launch) == null ? void 0 : _a.enabled) === true;
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
      var _a;
      const value = (_a = ad_placements_default.interstitial_launch) == null ? void 0 : _a[key];
      return typeof value === "number" && value >= 0 ? value : fallback;
    }
    /**
     * 大厅底部原生模板横幅：流量主已开通且填了广告位。
     */
    isLobbyBannerEnabled() {
      var _a, _b;
      const unit = (_a = ad_placements_default.banner_lobby) == null ? void 0 : _a.adUnitId;
      return ((_b = ad_placements_default.banner_lobby) == null ? void 0 : _b.enabled) === true && typeof unit === "string" && unit.startsWith("adunit-");
    }
    /**
     * 大厅底部给横幅留的高度，设置/玩法按钮要抬上去。
     */
    getLobbyBannerReservePx() {
      var _a;
      if (!this.isLobbyBannerEnabled()) {
        return 0;
      }
      const info = this.deps.platform.getSystemInfo();
      return lobbyBannerReserveHeight(
        info.windowWidth,
        info.windowHeight,
        (_a = info.safeAreaBottom) != null ? _a : 0
      );
    }
    /**
     * 在大厅展示底部横幅。进关、麻将馆对局或弹层时不要调。
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
      if (this.mahjong.getActiveGame()) {
        this.hideLobbyBanner();
        return "error";
      }
      const result = await this.deps.ads.show("banner_lobby");
      if (this.fsm.getCurrent() !== "Lobby" || this.mahjong.getActiveGame()) {
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
      var _a, _b;
      (_b = (_a = this.deps.ads).hide) == null ? void 0 : _b.call(_a, "banner_lobby");
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
      if (!isMatch3LevelWithinCap(nextId)) {
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
      this.flushDailyTasks();
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
      var _a;
      if (!this.level || !this.goals) {
        return;
      }
      if (this.goals.isAllCompleted()) {
        if (this.fsm.getCurrent() === "PlayerInput") {
          this.fsm.transitionTo("Resolving");
        }
        this.fsm.transitionTo("LevelWon");
        this.lastStars = starsForClear({
          movesLeft: this.movesLeft,
          movesTotal: this.level.moves,
          movesGranted: this.movesGrantedThisLevel
        });
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
      if ((_a = this.board) == null ? void 0 : _a.hasRevealedUnharvestedBuried()) {
        if (this.movesLeft <= 0) {
          return;
        }
        this.fsm.transitionTo("PlayerInput");
        this.ensurePlayableBoard();
        return;
      }
      if (this.movesLeft <= 0) {
        this.fsm.transitionTo("LevelFailed");
        this.flushDailyTasks();
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
      var _a, _b;
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
      (_a = this.goals) == null ? void 0 : _a.applyClearedKinds(result.clearedKinds);
      (_b = this.goals) == null ? void 0 : _b.syncScore(this.score);
      this.emitGoalProgress();
      this.noteResolveForDailyTasks(result, false);
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
      return resolveMatch3LevelConfig(
        levelId,
        this.levelTable,
        this.getInviteCode() || "local"
      );
    }
  };

  // src/config/challenge.json
  var challenge_default = {
    provider: "cloud",
    cloudFunction: "leaderboard",
    baseUrl: "",
    _comment: "\u4F53\u9A8C\u7248/\u6B63\u5F0F\u7248\u8D70\u5FAE\u4FE1\u4E91\u51FD\u6570 leaderboard\uFF1B\u672C\u5730 HTTP \u8C03\u8BD5\u53EF\u6539 provider=http \u5E76\u586B baseUrl\u3002"
  };

  // src/core/adapters/HttpChallengeApi.ts
  async function requestJson(url, method, body) {
    if (typeof wx !== "undefined" && typeof wx.request === "function") {
      return new Promise((resolve, reject) => {
        wx.request({
          url,
          method,
          data: body,
          header: { "content-type": "application/json" },
          timeout: 1500,
          success: (res) => resolve(res.data),
          fail: (err) => reject(new Error(err.errMsg || "request failed"))
        });
      });
    }
    const fetchFn = globalThis.fetch;
    if (typeof fetchFn === "function") {
      const res = await fetchFn(url, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify(body != null ? body : {}) : void 0
      });
      return res.json();
    }
    throw new Error("no http client");
  }
  var HttpChallengeApi = class {
    constructor(baseUrl = challenge_default.baseUrl) {
      this.baseUrl = baseUrl;
    }
    async create(body) {
      return this.post("/api/challenge/create", body);
    }
    async verify(body) {
      return this.post("/api/challenge/verify", body);
    }
    async status(userId) {
      const url = `${this.base()}/api/challenge/status?user_id=${encodeURIComponent(userId)}&consume=1`;
      return await requestJson(url, "GET");
    }
    async dailyToday(userId) {
      const url = `${this.base()}/api/daily-challenge?user_id=${encodeURIComponent(userId)}`;
      if (!this.baseUrl) {
        return { ok: false, reason: "no_api" };
      }
      return await requestJson(url, "GET");
    }
    async dailySubmit(body) {
      return this.post("/api/daily-challenge/complete", body);
    }
    async leaderboard(userId, maxClearedLevel = 0, extra) {
      var _a, _b;
      const qs = [
        `user_id=${encodeURIComponent(userId)}`,
        `max_level=${Math.max(0, Math.floor(maxClearedLevel))}`,
        `total_score=${Math.max(0, Math.floor((_a = extra == null ? void 0 : extra.totalScore) != null ? _a : 0))}`,
        `week_score=${Math.max(0, Math.floor((_b = extra == null ? void 0 : extra.weekScore) != null ? _b : 0))}`,
        "scope=all"
      ];
      if (extra == null ? void 0 : extra.weekKey) {
        qs.push(`week_key=${encodeURIComponent(extra.weekKey)}`);
      }
      if (extra == null ? void 0 : extra.nickName) {
        qs.push(`nick_name=${encodeURIComponent(extra.nickName)}`);
      }
      if (extra == null ? void 0 : extra.avatarUrl) {
        qs.push(`avatar_url=${encodeURIComponent(extra.avatarUrl)}`);
      }
      const url = `${this.base()}/api/leaderboard?${qs.join("&")}`;
      if (!this.baseUrl) {
        return { ok: false, reason: "no_api" };
      }
      return await requestJson(url, "GET");
    }
    async leaderboardNotify(body) {
      return this.post("/api/leaderboard/notify", body);
    }
    base() {
      return this.baseUrl.replace(/\/$/, "");
    }
    async post(path, body) {
      if (!this.baseUrl) {
        return { ok: false, reason: "no_api" };
      }
      return requestJson(`${this.base()}${path}`, "POST", body);
    }
  };

  // src/core/adapters/WxCloudChallengeApi.ts
  function cloudApi3() {
    try {
      if (typeof wx === "undefined" || !wx.cloud) {
        return null;
      }
      return wx.cloud;
    } catch (e) {
      return null;
    }
  }
  var cloudReady2 = null;
  function ensureCloud() {
    if (cloudReady2) {
      return cloudReady2;
    }
    cloudReady2 = (async () => {
      const cloud = cloudApi3();
      if (!cloud || typeof cloud.callFunction !== "function") {
        return false;
      }
      try {
        const env = cloud_default.envId || cloud.DYNAMIC_CURRENT_ENV;
        cloud.init(env ? { env, traceUser: true } : { traceUser: true });
        return true;
      } catch (e) {
        return false;
      }
    })();
    return cloudReady2;
  }
  var NO_API = { ok: false, reason: "no_api" };
  var WxCloudChallengeApi = class {
    constructor(functionName = challenge_default.cloudFunction || "leaderboard") {
      this.functionName = functionName;
    }
    async create(_body) {
      return NO_API;
    }
    async verify(_body) {
      return NO_API;
    }
    async status(_userId) {
      return NO_API;
    }
    async dailyToday(_userId) {
      return NO_API;
    }
    async dailySubmit(_body) {
      return NO_API;
    }
    async leaderboard(userId, maxClearedLevel = 0, extra) {
      var _a, _b, _c;
      if (!await ensureCloud()) {
        return { ok: false, reason: "cloud_unavailable" };
      }
      const cloud = cloudApi3();
      if (!(cloud == null ? void 0 : cloud.callFunction)) {
        return { ok: false, reason: "cloud_unavailable" };
      }
      try {
        const res = await cloud.callFunction({
          name: this.functionName,
          data: {
            userId,
            wxId: userId,
            maxLevel: Math.max(0, Math.floor(maxClearedLevel)),
            totalScore: Math.max(0, Math.floor((_a = extra == null ? void 0 : extra.totalScore) != null ? _a : 0)),
            weekKey: (extra == null ? void 0 : extra.weekKey) || "",
            weekScore: Math.max(0, Math.floor((_b = extra == null ? void 0 : extra.weekScore) != null ? _b : 0)),
            nickName: (extra == null ? void 0 : extra.nickName) || "",
            avatarUrl: (extra == null ? void 0 : extra.avatarUrl) || ""
          }
        });
        const result = (_c = res.result) != null ? _c : {};
        if (result && result.ok) {
          return result;
        }
        return {
          ok: false,
          reason: result && result.reason || "cloud_error"
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[crush-crush][leaderboard] cloud call failed", message);
        return { ok: false, reason: "cloud_error" };
      }
    }
    async leaderboardNotify() {
      return NO_API;
    }
  };

  // src/services/Bootstrap.ts
  function createChallengeApi() {
    const provider = String(challenge_default.provider || "").toLowerCase();
    if (provider === "cloud" || !challenge_default.baseUrl) {
      return new WxCloudChallengeApi();
    }
    return new HttpChallengeApi();
  }
  function createAppContainer() {
    const storage = new WxStorageAdapter();
    const ads = new WxAdAdapter({
      rewarded_revive: ad_placements_default.rewarded_revive.adUnitId,
      rewarded_crush_extend: ad_placements_default.rewarded_crush_extend.adUnitId,
      interstitial_settle: ad_placements_default.interstitial_settle.adUnitId,
      banner_lobby: ad_placements_default.banner_lobby.adUnitId
    });
    const audio = new WxAudioAdapter();
    const analytics = new WxAnalyticsAdapter();
    const platform = new WxPlatformAdapter();
    const cloudSave = new WxCloudSaveAdapter();
    const challengeApi = createChallengeApi();
    const session = new GameSession({
      storage,
      ads,
      audio,
      analytics,
      platform,
      cloudSave,
      challengeApi
    });
    return {
      storage,
      ads,
      audio,
      analytics,
      platform,
      session
    };
  }
  var Bootstrap = class {
    constructor(container) {
      this.container = container;
    }
    async run() {
      const { platform, session, ads } = this.container;
      const onHide = () => {
      };
      const onShow = () => {
        setTimeout(() => {
          void ads.load("rewarded_revive");
        }, 2800);
      };
      platform.onHide(onHide);
      platform.onShow(onShow);
      await session.init();
      return session;
    }
  };

  // src/presentation/views/TileView.ts
  var TileView = class {
    constructor() {
      /** 稳定 id，与 BoardModel.tileIds 对应 */
      this.tileId = 0;
      /** 方块种类；null 表示未占用 */
      this.kind = null;
      /** 逻辑行 */
      this.row = 0;
      /** 逻辑列 */
      this.col = 0;
      /** 表现层本地坐标 X（像素） */
      this.x = 0;
      /** 表现层本地坐标 Y（像素） */
      this.y = 0;
      /** 是否可见 */
      this.visible = false;
      /** 是否为当前选中格 */
      this.selected = false;
      /** 四连闪光同色 */
      this.sparkle = false;
    }
    /**
     * 重置到池化初始态。
     */
    reset() {
      this.tileId = 0;
      this.kind = null;
      this.row = 0;
      this.col = 0;
      this.x = 0;
      this.y = 0;
      this.visible = false;
      this.selected = false;
      this.sparkle = false;
    }
    /**
     * 绑定盘面数据与布局坐标。
     */
    bind(tileId, kind, row, col, x, y, sparkle = false) {
      this.tileId = tileId;
      this.kind = kind;
      this.row = row;
      this.col = col;
      this.x = x;
      this.y = y;
      this.visible = true;
      this.sparkle = sparkle;
    }
  };

  // src/presentation/views/BoardView.ts
  var DEFAULT_LAYOUT = {
    cellSize: 64,
    originX: 0,
    originY: 0
  };
  var SWAP_COMMIT_RATIO = 0.34;
  var AXIS_DEAD_RATIO = 0.06;
  var AXIS_SWITCH_RATIO = 1.35;
  var TAP_DRAG_RATIO = 0.18;
  var KIND_CHAR = {
    [0 /* Empty */]: ".",
    [1 /* Red */]: "R",
    [2 /* Blue */]: "B",
    [3 /* Green */]: "G",
    [4 /* Yellow */]: "Y",
    [5 /* Purple */]: "P",
    [9 /* Bear */]: "E",
    [10 /* Pig */]: "I",
    [11 /* Panda */]: "A",
    [12 /* Corgi */]: "C",
    [6 /* Bomb */]: "*",
    [7 /* ColorBomb */]: "@",
    [8 /* Hole */]: "."
  };
  var BoardView = class {
    /**
     * @param layout - 布局；可在 mount 后 updateLayout
     * @param host - 可选视觉宿主
     */
    constructor(layout = {}, host = null) {
      this.swapHandler = null;
      /** tileId → 视图 */
      this.tilesById = /* @__PURE__ */ new Map();
      /** 视图对象池 */
      this.pool = [];
      this.syncedVersion = -1;
      this.rows = 0;
      this.cols = 0;
      this.holes = new Uint8Array(0);
      this.ice = new Uint8Array(0);
      this.cloud = new Uint8Array(0);
      this.iceLocksTiles = false;
      this.selectedRow = null;
      this.selectedCol = null;
      this.pointerDownRow = null;
      this.pointerDownCol = null;
      this.pointerDownX = 0;
      this.pointerDownY = 0;
      this.dragDx = 0;
      this.dragDy = 0;
      this.swipeCommitted = false;
      /** 滑动轴向锁定：非边缘四向滑动更稳 */
      this.axisLock = null;
      this.pressStartMs = 0;
      this.inputBound = false;
      this.layout = { ...DEFAULT_LAYOUT, ...layout };
      this.host = host;
    }
    /**
     * 绑定交换意图处理器。
     * @param handler - 收到合法手势后回调
     */
    bindInput(handler) {
      this.swapHandler = handler;
      this.inputBound = true;
    }
    /**
     * 更新布局参数并在下次 sync 时生效。
     * @param layout - 部分布局字段
     */
    updateLayout(layout) {
      const next = { ...this.layout, ...layout };
      const changed = next.cellSize !== this.layout.cellSize || next.originX !== this.layout.originX || next.originY !== this.layout.originY;
      this.layout = next;
      if (changed) {
        this.syncedVersion = -1;
      }
    }
    /**
     * 按版本脏检查后，从 BoardModel **只读**同步全部可见方块。
     * @param board - 逻辑棋盘
     * @param force - 忽略 version 强制全量同步
     */
    syncFromBoard(board, force = false) {
      var _a, _b, _c, _d;
      if (!force && board.version === this.syncedVersion) {
        return;
      }
      this.rows = board.size.rows;
      this.cols = board.size.cols;
      this.holes = new Uint8Array(board.length);
      this.ice = new Uint8Array(board.length);
      this.cloud = new Uint8Array(board.length);
      this.iceLocksTiles = board.iceLocksTiles;
      for (let i = 0; i < board.length; i += 1) {
        if (board.cells[i] === 8 /* Hole */) {
          this.holes[i] = 1;
        }
        this.ice[i] = board.ice[i];
        this.cloud[i] = board.cloud[i];
      }
      const seen = /* @__PURE__ */ new Set();
      const { cellSize, originX, originY } = this.layout;
      for (let r = 0; r < board.size.rows; r += 1) {
        for (let c = 0; c < board.size.cols; c += 1) {
          const kind = board.getTile(r, c);
          const tileId = board.getTileId(r, c);
          if (kind === 0 /* Empty */ || kind === 8 /* Hole */ || tileId === 0) {
            continue;
          }
          seen.add(tileId);
          const tile = this.ensureTile(tileId);
          const x = originX + c * cellSize + cellSize * 0.5;
          const y = originY - r * cellSize - cellSize * 0.5;
          tile.bind(tileId, kind, r, c, x, y, board.isSparkle(r, c));
          tile.selected = this.selectedRow === r && this.selectedCol === c;
          (_b = (_a = this.host) == null ? void 0 : _a.onTileUpdated) == null ? void 0 : _b.call(_a, tile);
        }
      }
      for (const [tileId, tile] of this.tilesById) {
        if (!seen.has(tileId)) {
          this.releaseTile(tileId, tile);
        }
      }
      this.syncedVersion = board.version;
      (_d = (_c = this.host) == null ? void 0 : _c.onBoardSynced) == null ? void 0 : _d.call(_c, board.version);
    }
    /**
     * 指针按下（屏幕坐标 → 格子）。
     * @param screenX - 屏幕 X
     * @param screenY - 屏幕 Y
     * @returns 是否命中棋盘
     */
    onPointerDown(screenX, screenY) {
      if (!this.inputBound) {
        return false;
      }
      const cell = this.screenToCell(screenX, screenY);
      if (!cell) {
        this.clearSelection();
        this.resetPointer();
        return false;
      }
      if (this.isCellMovementLocked(cell.row, cell.col)) {
        this.clearSelection();
        this.resetPointer();
        return true;
      }
      this.pointerDownRow = cell.row;
      this.pointerDownCol = cell.col;
      this.pointerDownX = screenX;
      this.pointerDownY = screenY;
      this.dragDx = 0;
      this.dragDy = 0;
      this.swipeCommitted = false;
      this.axisLock = null;
      this.pressStartMs = Date.now();
      const selAdj = this.selectedRow !== null && this.selectedCol !== null && Math.abs(this.selectedRow - cell.row) + Math.abs(this.selectedCol - cell.col) === 1;
      if (!selAdj) {
        this.setSelection(cell.row, cell.col);
      }
      return true;
    }
    /** 当前是否有未结束的棋盘手势（按下未抬起） */
    hasActivePointer() {
      return this.pointerDownRow !== null && this.pointerDownCol !== null;
    }
    /**
     * 指针移动：四向跟手；有邻格时 1:1 镜像挤开，越过阈值立刻交换。
     */
    onPointerMove(screenX, screenY) {
      if (!this.inputBound || this.swipeCommitted) {
        return false;
      }
      if (this.pointerDownRow === null || this.pointerDownCol === null) {
        return false;
      }
      const cellSize = Math.max(1, this.layout.cellSize);
      const rawDx = screenX - this.pointerDownX;
      const rawDy = screenY - this.pointerDownY;
      const dead = cellSize * AXIS_DEAD_RATIO;
      const absX = Math.abs(rawDx);
      const absY = Math.abs(rawDy);
      if (absX >= dead || absY >= dead) {
        if (this.axisLock === null) {
          this.axisLock = absX >= absY ? "x" : "y";
        } else if (this.axisLock === "x" && absY > absX * AXIS_SWITCH_RATIO) {
          this.axisLock = "y";
        } else if (this.axisLock === "y" && absX > absY * AXIS_SWITCH_RATIO) {
          this.axisLock = "x";
        }
      }
      let axisDx = 0;
      let axisDy = 0;
      if (this.axisLock === "x") {
        axisDx = rawDx;
      } else if (this.axisLock === "y") {
        axisDy = rawDy;
      } else {
        axisDx = rawDx * 0.55;
        axisDy = rawDy * 0.55;
      }
      const neighbor = this.resolveNeighbor(
        this.pointerDownRow,
        this.pointerDownCol,
        axisDx,
        axisDy
      );
      if (neighbor) {
        this.dragDx = clamp2(axisDx, -cellSize, cellSize);
        this.dragDy = clamp2(axisDy, -cellSize, cellSize);
      } else if (this.axisLock) {
        this.dragDx = this.axisLock === "x" ? rubberBand(axisDx, cellSize * 0.42) : 0;
        this.dragDy = this.axisLock === "y" ? rubberBand(axisDy, cellSize * 0.42) : 0;
      } else {
        this.dragDx = axisDx;
        this.dragDy = axisDy;
      }
      const threshold = cellSize * SWAP_COMMIT_RATIO;
      const commitByDistance = Math.abs(this.dragDx) >= threshold || Math.abs(this.dragDy) >= threshold;
      const fingerCell = this.screenToCell(screenX, screenY);
      const commitByCell = !!neighbor && !!fingerCell && fingerCell.row === neighbor.row && fingerCell.col === neighbor.col;
      if (!commitByDistance && !commitByCell) {
        return true;
      }
      if (!neighbor) {
        return true;
      }
      this.swipeCommitted = true;
      this.dragDx = 0;
      this.dragDy = 0;
      this.emitSwap(
        this.pointerDownRow,
        this.pointerDownCol,
        neighbor.row,
        neighbor.col
      );
      this.clearSelection();
      this.pointerDownRow = null;
      this.pointerDownCol = null;
      this.axisLock = null;
      return true;
    }
    /**
     * 指针抬起：若滑动已提交则忽略；否则点选 / 抬起格交换。
     */
    onPointerUp(screenX, screenY) {
      if (!this.inputBound) {
        return false;
      }
      if (this.swipeCommitted) {
        this.resetPointer();
        return true;
      }
      const cell = this.screenToCell(screenX, screenY);
      const downRow = this.pointerDownRow;
      const downCol = this.pointerDownCol;
      const cellSize = Math.max(1, this.layout.cellSize);
      const dragDist = Math.hypot(this.dragDx, this.dragDy);
      const tapLike = dragDist < cellSize * TAP_DRAG_RATIO;
      this.resetPointer();
      if (downRow === null || downCol === null) {
        return false;
      }
      if (!cell) {
        this.setSelection(downRow, downCol);
        return true;
      }
      if (downRow !== cell.row || downCol !== cell.col) {
        const adj = Math.abs(downRow - cell.row) + Math.abs(downCol - cell.col) === 1;
        if (adj) {
          this.emitSwap(downRow, downCol, cell.row, cell.col);
          this.clearSelection();
        } else {
          this.setSelection(cell.row, cell.col);
        }
        return true;
      }
      if (tapLike && this.selectedRow !== null && this.selectedCol !== null && (this.selectedRow !== cell.row || this.selectedCol !== cell.col)) {
        const adj = Math.abs(this.selectedRow - cell.row) + Math.abs(this.selectedCol - cell.col) === 1;
        if (adj) {
          this.emitSwap(this.selectedRow, this.selectedCol, cell.row, cell.col);
          this.clearSelection();
          return true;
        }
      }
      this.setSelection(cell.row, cell.col);
      return true;
    }
    /** 手势被系统取消时复位，避免卡死跟手态 */
    onPointerCancel() {
      this.resetPointer();
    }
    /** 当前跟手拖动预览；按下中也会返回（抬起感） */
    getDragPreview(nowMs = Date.now()) {
      if (this.pointerDownRow === null || this.pointerDownCol === null || this.swipeCommitted) {
        return null;
      }
      const cellSize = Math.max(1, this.layout.cellSize);
      const neighbor = this.resolveNeighbor(
        this.pointerDownRow,
        this.pointerDownCol,
        this.dragDx,
        this.dragDy
      );
      const abs = Math.max(Math.abs(this.dragDx), Math.abs(this.dragDy));
      const slideProgress = Math.min(1, abs / cellSize);
      const pressAge = Math.max(0, nowMs - this.pressStartMs);
      const pressLift = slideProgress > 0.02 ? 1 : Math.min(1, 0.55 + 0.45 * Math.sin(Math.min(1, pressAge / 90) * Math.PI));
      const otherDx = neighbor ? -this.dragDx : 0;
      const otherDy = neighbor ? -this.dragDy : 0;
      return {
        row: this.pointerDownRow,
        col: this.pointerDownCol,
        dx: this.dragDx,
        dy: this.dragDy,
        otherRow: neighbor ? neighbor.row : this.pointerDownRow,
        otherCol: neighbor ? neighbor.col : this.pointerDownCol,
        otherDx,
        otherDy,
        pressed: true,
        pressLift,
        slideProgress
      };
    }
    /** 根据拖动向量解析相邻目标格（仅四向） */
    resolveNeighbor(row, col, dx, dy) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 0.5 && absY < 0.5) {
        return null;
      }
      let toRow = row;
      let toCol = col;
      if (this.axisLock === "x" || this.axisLock === null && absX >= absY) {
        toCol = col + (dx > 0 ? 1 : -1);
      } else {
        toRow = row + (dy > 0 ? -1 : 1);
      }
      if (toRow < 0 || toRow >= this.rows || toCol < 0 || toCol >= this.cols) {
        return null;
      }
      if (toRow === row && toCol === col) {
        return null;
      }
      if (this.holes[toRow * this.cols + toCol] === 1) {
        return null;
      }
      if (this.isCellMovementLocked(toRow, toCol) || this.isCellMovementLocked(row, col)) {
        return null;
      }
      return { row: toRow, col: toCol };
    }
    /**
     * 直接注入格子交换意图（单测 / 非指针环境）。
     */
    requestSwap(rowA, colA, rowB, colB) {
      this.emitSwap(rowA, colA, rowB, colB);
    }
    /**
     * 屏幕坐标转格子；超出棋盘返回 null。
     */
    screenToCell(screenX, screenY) {
      if (this.rows <= 0 || this.cols <= 0) {
        return null;
      }
      const { cellSize, originX, originY } = this.layout;
      const col = Math.floor((screenX - originX) / cellSize);
      const row = Math.floor((originY - screenY) / cellSize);
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
        return null;
      }
      if (this.holes[row * this.cols + col] === 1) {
        return null;
      }
      return { row, col };
    }
    /**
     * 命中格子；点在棋盘外框附近时吸附到最近格，减少「点了没反应」。
     */
    hitCell(screenX, screenY, padPx = 0) {
      const exact = this.screenToCell(screenX, screenY);
      if (exact) {
        return exact;
      }
      if (padPx <= 0 || this.rows <= 0 || this.cols <= 0) {
        return null;
      }
      const { cellSize, originX, originY } = this.layout;
      const boardW = cellSize * this.cols;
      const boardH = cellSize * this.rows;
      if (screenX < originX - padPx || screenX > originX + boardW + padPx || screenY < originY - boardH - padPx || screenY > originY + padPx) {
        return null;
      }
      const col = Math.max(
        0,
        Math.min(this.cols - 1, Math.floor((screenX - originX) / cellSize))
      );
      const row = Math.max(
        0,
        Math.min(this.rows - 1, Math.floor((originY - screenY) / cellSize))
      );
      if (this.holes[row * this.cols + col] === 1) {
        return null;
      }
      return { row, col };
    }
    /**
     * 当前选中格。
     */
    getSelection() {
      if (this.selectedRow === null || this.selectedCol === null) {
        return null;
      }
      return { row: this.selectedRow, col: this.selectedCol };
    }
    /**
     * 生成 ASCII 棋盘，便于调试与单测「看见」盘面。
     */
    toAscii(board) {
      var _a;
      const lines = [];
      for (let r = 0; r < board.size.rows; r += 1) {
        const cells = [];
        for (let c = 0; c < board.size.cols; c += 1) {
          const kind = board.getTile(r, c);
          const ch = (_a = KIND_CHAR[kind]) != null ? _a : "?";
          const mark = this.selectedRow === r && this.selectedCol === c ? `[${ch}]` : ` ${ch} `;
          cells.push(mark);
        }
        lines.push(cells.join(""));
      }
      return lines.join("\n");
    }
    /**
     * 卸载输入与视图引用。
     */
    dispose() {
      this.swapHandler = null;
      this.inputBound = false;
      this.clearSelection();
      this.resetPointer();
      for (const [tileId, tile] of this.tilesById) {
        this.releaseTile(tileId, tile);
      }
      this.tilesById.clear();
      this.pool.length = 0;
      this.syncedVersion = -1;
    }
    resetPointer() {
      this.pointerDownRow = null;
      this.pointerDownCol = null;
      this.dragDx = 0;
      this.dragDy = 0;
      this.swipeCommitted = false;
      this.axisLock = null;
    }
    /**
     * 发出交换意图（仅当存在 handler）。
     */
    emitSwap(rowA, colA, rowB, colB) {
      var _a;
      if (this.isCellMovementLocked(rowA, colA) || this.isCellMovementLocked(rowB, colB)) {
        return;
      }
      (_a = this.swapHandler) == null ? void 0 : _a.call(this, rowA, colA, rowB, colB);
    }
    isCellMovementLocked(row, col) {
      const index = row * this.cols + col;
      if (this.cloud.length > 0 && this.cloud[index] > 0) {
        return true;
      }
      if (!this.iceLocksTiles || this.ice.length === 0) {
        return false;
      }
      return this.ice[index] > 0;
    }
    setSelection(row, col) {
      var _a, _b, _c, _d;
      this.selectedRow = row;
      this.selectedCol = col;
      (_b = (_a = this.host) == null ? void 0 : _a.onSelectionChanged) == null ? void 0 : _b.call(_a, row, col);
      for (const tile of this.tilesById.values()) {
        tile.selected = tile.row === row && tile.col === col;
        (_d = (_c = this.host) == null ? void 0 : _c.onTileUpdated) == null ? void 0 : _d.call(_c, tile);
      }
    }
    /** 外部恢复/强制选中某一格（如非法交换回弹后） */
    selectCell(row, col) {
      if (this.rows <= 0 || this.cols <= 0) {
        return;
      }
      if (row < 0 || col < 0 || row >= this.rows || col >= this.cols) {
        return;
      }
      this.setSelection(row, col);
    }
    clearSelection() {
      var _a, _b, _c, _d;
      if (this.selectedRow === null && this.selectedCol === null) {
        return;
      }
      this.selectedRow = null;
      this.selectedCol = null;
      (_b = (_a = this.host) == null ? void 0 : _a.onSelectionChanged) == null ? void 0 : _b.call(_a, null, null);
      for (const tile of this.tilesById.values()) {
        if (tile.selected) {
          tile.selected = false;
          (_d = (_c = this.host) == null ? void 0 : _c.onTileUpdated) == null ? void 0 : _d.call(_c, tile);
        }
      }
    }
    ensureTile(tileId) {
      var _a;
      let tile = this.tilesById.get(tileId);
      if (tile) {
        return tile;
      }
      tile = (_a = this.pool.pop()) != null ? _a : new TileView();
      this.tilesById.set(tileId, tile);
      return tile;
    }
    releaseTile(tileId, tile) {
      this.tilesById.delete(tileId);
      tile.reset();
      this.pool.push(tile);
    }
  };
  function clamp2(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function rubberBand(delta, limit) {
    const sign = delta < 0 ? -1 : 1;
    const mag = Math.abs(delta);
    if (mag <= limit) {
      return delta;
    }
    const over = mag - limit;
    return sign * (limit + over * 0.2);
  }

  // src/presentation/fx/BoardMatchAnimator.ts
  var CLEAR_MS = 200;
  var CLEAR_HOLD_MS = 28;
  var SPECIAL_POP_MS = 150;
  var FALL_MS = 200;
  var SPAWN_MS = 210;
  var WAVE_GAP_MS = 40;
  var BoardMatchAnimator = class {
    constructor() {
      this.tiles = /* @__PURE__ */ new Map();
      this.waves = [];
      this.waveIndex = 0;
      this.phase = "done";
      this.phaseStart = 0;
      this.playing = false;
      this.completeCb = null;
      this.waveClearCb = null;
      this.clearFinishedCb = null;
      this.rows = 0;
      this.cols = 0;
    }
    /**
     * 从交换后快照开始播放分波次结算。
     */
    start(snapshot, waves, nowMs) {
      var _a, _b;
      this.rows = snapshot.rows;
      this.cols = snapshot.cols;
      this.waves = waves;
      this.waveIndex = 0;
      this.tiles.clear();
      this.playing = true;
      this.phaseStart = nowMs;
      for (let r = 0; r < snapshot.rows; r += 1) {
        for (let c = 0; c < snapshot.cols; c += 1) {
          const i = r * snapshot.cols + c;
          const kind = snapshot.cells[i];
          const tileId = snapshot.tileIds[i];
          if (kind === 0 /* Empty */ || tileId === 0) {
            continue;
          }
          this.tiles.set(tileId, {
            kind,
            tileId,
            col: c,
            row: r,
            displayRow: r,
            scale: 1,
            alpha: 1,
            fromRow: r,
            toRow: r,
            clearing: false,
            spawning: false,
            specialPopping: false,
            sparkle: ((_b = (_a = snapshot.sparkles) == null ? void 0 : _a[i]) != null ? _b : 0) === 1
          });
        }
      }
      if (waves.length === 0) {
        this.phase = "done";
        this.playing = false;
        this.finish();
        return;
      }
      this.beginClear(nowMs);
    }
    onComplete(cb) {
      this.completeCb = cb;
    }
    /** 每一波开始消除时回调（用于粒子 / 飘分 / 连锁音效） */
    onWaveClear(cb) {
      this.waveClearCb = cb;
    }
    /** 小动物消完后回调（用于棉花掉层） */
    onClearFinished(cb) {
      this.clearFinishedCb = cb;
    }
    /**
     * 已经消完小动物的波次数。当前波还在缩小消失时不计入，
     * 这样棉花会等动物消失后再掉层。
     */
    getClearedWaveCount() {
      if (!this.playing) {
        return this.waves.length;
      }
      if (this.phase === "clear") {
        return this.waveIndex;
      }
      return this.waveIndex + 1;
    }
    isPlaying() {
      return this.playing;
    }
    /** 立刻停掉播放，不触发 onComplete（进入粉碎/清洁时丢掉三消残留）。 */
    stop() {
      this.playing = false;
      this.phase = "done";
      this.waves = [];
      this.waveIndex = 0;
      this.tiles.clear();
      this.completeCb = null;
      this.waveClearCb = null;
      this.clearFinishedCb = null;
    }
    /**
     * 推进动画；返回是否仍在播放。
     */
    update(nowMs) {
      if (!this.playing) {
        return false;
      }
      const wave = this.waves[this.waveIndex];
      if (!wave && this.phase !== "done") {
        this.playing = false;
        this.phase = "done";
        this.finish();
        return false;
      }
      const elapsed = nowMs - this.phaseStart;
      switch (this.phase) {
        case "clear": {
          const t = Math.min(1, elapsed / CLEAR_MS);
          const pop = t < 0.22 ? 1 + 0.22 * easeOutCubic(t / 0.22) : 1.22;
          const shrinkT = t < 0.22 ? 0 : (t - 0.22) / 0.78;
          const ease = easeInCubic(shrinkT);
          for (const tile of this.tiles.values()) {
            if (!tile.clearing) {
              continue;
            }
            if (t < 0.22) {
              tile.scale = pop;
              tile.alpha = 1;
            } else {
              tile.scale = Math.max(0.08, pop * (1 - ease * 0.92));
              tile.alpha = 1 - ease;
            }
          }
          if (t >= 1) {
            this.removeClearingTiles();
            this.beginAfterClear(nowMs);
          }
          break;
        }
        case "clearHold": {
          if (elapsed >= CLEAR_HOLD_MS) {
            this.beginFall(nowMs);
          }
          break;
        }
        case "specialPop": {
          const t = Math.min(1, elapsed / SPECIAL_POP_MS);
          for (const tile of this.tiles.values()) {
            if (!tile.specialPopping) {
              continue;
            }
            tile.scale = specialPopScale(t);
            tile.alpha = Math.min(1, 0.55 + 0.45 * easeOutCubic(Math.min(1, t * 1.6)));
          }
          if (t >= 1) {
            for (const tile of this.tiles.values()) {
              if (!tile.specialPopping) {
                continue;
              }
              tile.scale = 1;
              tile.alpha = 1;
              tile.specialPopping = false;
            }
            this.beginFall(nowMs);
          }
          break;
        }
        case "fall": {
          const t = Math.min(1, elapsed / FALL_MS);
          const ease = easeOutCubic(t);
          for (const tile of this.tiles.values()) {
            if (tile.fromRow === tile.toRow) {
              continue;
            }
            tile.displayRow = tile.fromRow + (tile.toRow - tile.fromRow) * ease;
          }
          if (t >= 1) {
            for (const tile of this.tiles.values()) {
              tile.row = tile.toRow;
              tile.displayRow = tile.toRow;
              tile.fromRow = tile.toRow;
            }
            this.beginSpawn(nowMs);
          }
          break;
        }
        case "spawn": {
          const t = Math.min(1, elapsed / SPAWN_MS);
          const ease = easeOutCubic(t);
          for (const tile of this.tiles.values()) {
            if (!tile.spawning) {
              continue;
            }
            tile.displayRow = tile.fromRow + (tile.toRow - tile.fromRow) * ease;
            tile.scale = 0.65 + 0.35 * ease;
            tile.alpha = Math.min(1, 0.35 + 0.65 * ease);
          }
          if (t >= 1) {
            for (const tile of this.tiles.values()) {
              if (!tile.spawning) {
                continue;
              }
              tile.row = tile.toRow;
              tile.displayRow = tile.toRow;
              tile.fromRow = tile.toRow;
              tile.scale = 1;
              tile.alpha = 1;
              tile.spawning = false;
            }
            this.advanceWave(nowMs);
          }
          break;
        }
        case "waveGap": {
          if (elapsed >= WAVE_GAP_MS) {
            this.beginClear(nowMs);
          }
          break;
        }
        default:
          break;
      }
      return this.playing;
    }
    /**
     * 当前应绘制的方块（不含已消失空位）。
     */
    getVisualTiles() {
      const out = [];
      for (const tile of this.tiles.values()) {
        if (tile.alpha <= 0.01) {
          continue;
        }
        out.push({
          kind: tile.kind,
          tileId: tile.tileId,
          col: tile.col,
          displayRow: tile.displayRow,
          scale: tile.scale,
          alpha: tile.alpha,
          sparkle: tile.sparkle
        });
      }
      return out;
    }
    getSize() {
      return { rows: this.rows, cols: this.cols };
    }
    beginClear(nowMs) {
      var _a;
      const wave = this.waves[this.waveIndex];
      if (!wave) {
        this.playing = false;
        this.phase = "done";
        this.finish();
        return;
      }
      const clearSet = new Set(wave.clearedIndices);
      const clearedCells = [];
      for (const tile of this.tiles.values()) {
        const index = tile.row * this.cols + tile.col;
        tile.clearing = clearSet.has(index);
        if (tile.clearing) {
          tile.scale = 1;
          tile.alpha = 1;
          clearedCells.push({ row: tile.row, col: tile.col, kind: tile.kind });
        }
      }
      (_a = this.waveClearCb) == null ? void 0 : _a.call(
        this,
        this.waveIndex,
        clearedCells,
        wave.specialSpawns.length > 0
      );
      this.phase = "clear";
      this.phaseStart = nowMs;
    }
    removeClearingTiles() {
      for (const [id, tile] of this.tiles) {
        if (tile.clearing) {
          this.tiles.delete(id);
        }
      }
    }
    /** 消除后：有特殊块则立刻弹出，否则短暂停顿再下落 */
    beginAfterClear(nowMs) {
      var _a;
      const wave = this.waves[this.waveIndex];
      (_a = this.clearFinishedCb) == null ? void 0 : _a.call(
        this,
        this.waveIndex,
        wave.chippedCloudIndices,
        wave.chippedEggIndices,
        wave.chippedVineIndices
      );
      if (wave.specialSpawns.length > 0) {
        this.beginSpecialPop(nowMs);
        return;
      }
      this.phase = "clearHold";
      this.phaseStart = nowMs;
    }
    /**
     * 四连/五连合成块立刻弹出（带弹性），不再等整段动画结束。
     */
    beginSpecialPop(nowMs) {
      const wave = this.waves[this.waveIndex];
      for (const spawn of wave.specialSpawns) {
        this.tiles.set(spawn.tileId, {
          kind: spawn.kind,
          tileId: spawn.tileId,
          col: spawn.col,
          row: spawn.row,
          displayRow: spawn.row,
          scale: 0.2,
          alpha: 0.6,
          fromRow: spawn.row,
          toRow: spawn.row,
          clearing: false,
          spawning: false,
          specialPopping: true,
          sparkle: !!spawn.sparkle
        });
      }
      this.phase = "specialPop";
      this.phaseStart = nowMs;
      if (wave.specialSpawns.length === 0) {
        this.beginFall(nowMs);
      }
    }
    beginFall(nowMs) {
      const wave = this.waves[this.waveIndex];
      for (const tile of this.tiles.values()) {
        tile.fromRow = tile.row;
        tile.toRow = tile.row;
        tile.displayRow = tile.row;
      }
      for (const fell of wave.fell) {
        const tile = this.tiles.get(fell.tileId);
        if (!tile) {
          continue;
        }
        tile.col = fell.col;
        tile.fromRow = fell.fromRow;
        tile.toRow = fell.toRow;
        tile.row = fell.fromRow;
        tile.displayRow = fell.fromRow;
      }
      this.phase = "fall";
      this.phaseStart = nowMs;
      if (wave.fell.length === 0) {
        this.beginSpawn(nowMs);
      }
    }
    beginSpawn(nowMs) {
      var _a, _b, _c;
      const wave = this.waves[this.waveIndex];
      const colCounts = /* @__PURE__ */ new Map();
      for (const spawn of wave.spawned) {
        colCounts.set(spawn.col, ((_a = colCounts.get(spawn.col)) != null ? _a : 0) + 1);
      }
      const colCursor = /* @__PURE__ */ new Map();
      for (const spawn of wave.spawned) {
        const count = (_b = colCounts.get(spawn.col)) != null ? _b : 1;
        const order = (_c = colCursor.get(spawn.col)) != null ? _c : 0;
        colCursor.set(spawn.col, order + 1);
        const startRow = spawn.row - count - (count - order);
        this.tiles.set(spawn.tileId, {
          kind: spawn.kind,
          tileId: spawn.tileId,
          col: spawn.col,
          row: spawn.row,
          displayRow: startRow,
          scale: 0.65,
          alpha: 0.35,
          fromRow: startRow,
          toRow: spawn.row,
          clearing: false,
          spawning: true,
          specialPopping: false,
          sparkle: !!spawn.sparkle
        });
      }
      this.phase = "spawn";
      this.phaseStart = nowMs;
      if (wave.spawned.length === 0) {
        this.advanceWave(nowMs);
      }
    }
    advanceWave(nowMs) {
      this.waveIndex += 1;
      if (this.waveIndex >= this.waves.length) {
        this.playing = false;
        this.phase = "done";
        this.finish();
        return;
      }
      this.phase = "waveGap";
      this.phaseStart = nowMs;
    }
    finish() {
      const cb = this.completeCb;
      this.completeCb = null;
      cb == null ? void 0 : cb();
    }
  };
  function easeOutCubic(t) {
    const u = 1 - t;
    return 1 - u * u * u;
  }
  function easeInCubic(t) {
    return t * t * t;
  }
  function specialPopScale(t) {
    if (t < 0.55) {
      const u2 = t / 0.55;
      return 0.15 + 1.2 * easeOutCubic(u2);
    }
    const u = (t - 0.55) / 0.45;
    return 1.35 - 0.35 * easeOutCubic(u);
  }

  // src/presentation/fx/CuteSceneBackground.ts
  var CuteSceneBackground = class {
    constructor() {
      this.sparkles = [];
      this.width = 0;
      this.height = 0;
      this.lite = false;
    }
    /** 开发者工具降低绘制量，避免模拟器看门狗。 */
    setLite(lite) {
      this.lite = lite;
    }
    /**
     * 按屏幕尺寸重建漂浮层（分辨率变化时调用）。
     */
    layout(width, height) {
      this.width = width;
      this.height = height;
      this.sparkles.length = 0;
      const count = this.lite ? 6 : 12;
      for (let i = 0; i < count; i += 1) {
        this.sparkles.push({
          x: i * 97 % width + i % 5 * 7,
          y: i * 53 % Math.floor(height * 0.62) + 12,
          r: 1 + i % 5 * 0.55,
          phase: i * 0.62,
          speed: 1.15 + i % 6 * 0.28
        });
      }
    }
    /**
     * 绘制完整动态背景。
     * @param mode - lobby | level（闯关）
     * @param lobbyPanY - 保留参数兼容调用方；大厅底图固定不随相机平移
     */
    draw(ctx, images, mode, nowMs, _lobbyPanY = 0, levelHue) {
      const { width, height } = this;
      if (width <= 0 || height <= 0) {
        return;
      }
      const t = nowMs * 1e-3;
      const img = mode === "lobby" ? images.lobby : images.level;
      if (mode === "lobby") {
        this.drawLobbyWorld(ctx, images, t);
        return;
      }
      if (typeof levelHue === "number") {
        this.drawLevelHueGradient(ctx, width, height, levelHue);
      } else if (img) {
        this.drawFallbackGradient(ctx, mode, width, height);
        try {
          this.drawCoverImage(ctx, img, width, height, 1, 0, 0, 0.92);
        } catch (err) {
          console.warn("[crush-crush] level bg draw failed", err);
        }
      } else {
        this.drawFallbackGradient(ctx, mode, width, height);
      }
      if (img && typeof levelHue === "number") {
        ctx.save();
        ctx.globalAlpha = 0.42;
        try {
          this.drawCoverImage(ctx, img, width, height, 1, 0, 0, 0.92);
        } catch (e) {
        }
        ctx.restore();
      }
      this.drawSparkles(ctx, t, 0.2);
    }
    drawLevelHueGradient(ctx, width, height, hue) {
      const h = (hue % 360 + 360) % 360;
      const stop = (hh, s, l) => {
        const c = (1 - Math.abs(2 * (l / 100) - 1)) * (s / 100);
        const x = c * (1 - Math.abs(hh / 60 % 2 - 1));
        const m = l / 100 - c / 2;
        let r = 0;
        let g2 = 0;
        let b = 0;
        if (hh < 60) {
          r = c;
          g2 = x;
        } else if (hh < 120) {
          r = x;
          g2 = c;
        } else if (hh < 180) {
          g2 = c;
          b = x;
        } else if (hh < 240) {
          g2 = x;
          b = c;
        } else if (hh < 300) {
          r = x;
          b = c;
        } else {
          r = c;
          b = x;
        }
        const byte = (v) => Math.round((v + m) * 255);
        return `rgb(${byte(r)},${byte(g2)},${byte(b)})`;
      };
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, stop(h, 55, 78));
      g.addColorStop(0.45, stop((h + 20) % 360, 50, 88));
      g.addColorStop(0.72, stop((h + 55) % 360, 45, 82));
      g.addColorStop(1, stop((h + 90) % 360, 50, 58));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    /**
     * 大厅世界：先铺渐变底，再叠首页图。iOS 上 drawImage 失败时不至于整页黑屏。
     */
    drawLobbyWorld(ctx, images, t) {
      const { width, height } = this;
      this.drawFallbackGradient(ctx, "lobby", width, height);
      const img = images.lobby;
      const iw = (img == null ? void 0 : img.width) || 0;
      const ih = (img == null ? void 0 : img.height) || 0;
      if (img && iw > 0 && ih > 0) {
        try {
          const layout = this.getCoverLayout(img, 0.5);
          ctx.drawImage(img, layout.dx, layout.dy, layout.dw, layout.dh);
        } catch (err) {
          console.warn("[crush-crush] lobby bg draw failed", err);
        }
      }
      this.drawSparkles(ctx, t, 0.16);
    }
    /**
     * cover 绘制矩形（与大厅静止底图一致），供热区换算。
     */
    getCoverLayout(img, vBias = 0.5) {
      const { width, height } = this;
      const iw = Math.max(1, img.width || width);
      const ih = Math.max(1, img.height || height);
      const cover = Math.max(width / iw, height / ih);
      const dw = iw * cover;
      const dh = ih * cover;
      const dx = (width - dw) * 0.5;
      const bias = Math.max(0, Math.min(1, vBias));
      const dy = (height - dh) * bias;
      return { dx, dy, dw, dh };
    }
    drawCoverImage(ctx, img, width, height, scale, panX, panY, vBias = 0.5) {
      const iw = img.width || width;
      const ih = img.height || height;
      const cover = Math.max(width / iw, height / ih) * scale;
      const dw = iw * cover;
      const dh = ih * cover;
      const dx = (width - dw) * 0.5 + panX;
      const bias = Math.max(0, Math.min(1, vBias));
      const dy = (height - dh) * bias + panY;
      ctx.drawImage(img, dx, dy, dw, dh);
    }
    drawFallbackGradient(ctx, mode, width, height) {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      if (mode === "level") {
        g.addColorStop(0, "#8fd6ff");
        g.addColorStop(0.45, "#c8f0ff");
        g.addColorStop(0.72, "#b8e89a");
        g.addColorStop(1, "#7bc96a");
      } else {
        g.addColorStop(0, "#a7f0d4");
        g.addColorStop(0.7, "#b6f0d8");
        g.addColorStop(1, "#ffe6f0");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    drawSparkles(ctx, t, strength) {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      for (const s of this.sparkles) {
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * s.speed + s.phase));
        ctx.globalAlpha = twinkle * strength;
        ctx.beginPath();
        ctx.arc(s.x, s.y + Math.sin(t * 0.6 + s.phase) * 4, s.r * twinkle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  // src/presentation/fx/LevelResultFx.ts
  var WIN_COLORS = [
    "#ff6b6b",
    "#4dabf7",
    "#51cf66",
    "#ffd43b",
    "#b197fc",
    "#ff85c0",
    "#ffffff",
    "#ff922b"
  ];
  var FAIL_COLORS = ["#ffc9c9", "#ffd8a8", "#e9ecef", "#ffc078", "#adb5bd"];
  var LevelResultFx = class {
    constructor() {
      this.active = false;
      this.won = true;
      this.startMs = 0;
      this.width = 0;
      this.height = 0;
      this.targetScore = 0;
      this.particles = [];
      this.burstAt = 0;
      this.lite = false;
      this.maxParticles = 56;
    }
    /** 模拟器 / 低端机减少粒子，动效仍连续。 */
    setLite(lite) {
      this.lite = lite;
      this.maxParticles = lite ? 32 : 56;
      if (this.particles.length > this.maxParticles) {
        this.particles.length = this.maxParticles;
      }
    }
    /**
     * 开始播放结算动画。
     */
    start(won, nowMs, width, height, score) {
      this.active = true;
      this.won = won;
      this.startMs = nowMs;
      this.width = width;
      this.height = height;
      this.targetScore = score;
      this.particles = [];
      this.burstAt = nowMs;
      this.spawnBurst(won ? this.lite ? 28 : 42 : this.lite ? 12 : 18);
      if (won) {
        this.spawnSideCannons(this.lite ? 8 : 12);
      }
    }
    stop() {
      this.active = false;
      this.particles = [];
    }
    isActive() {
      return this.active;
    }
    /** 测试 / 调试：当前粒子数。 */
    particleCount() {
      return this.particles.length;
    }
    /**
     * 推进粒子；每帧调用。
     */
    update(nowMs) {
      if (!this.active) {
        return;
      }
      const dt = 1 / 60;
      const elapsed = nowMs - this.startMs;
      const gap = elapsed < 1600 ? 240 : 520;
      if (this.won && nowMs - this.burstAt > gap) {
        this.burstAt = nowMs;
        this.spawnFalling(elapsed < 1600 ? this.lite ? 5 : 8 : this.lite ? 2 : 4);
      }
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += (p.kind === "confetti" || p.kind === "ribbon" ? 0.22 : 0.06) * 60 * dt;
        p.rot += p.vr * dt * 60;
        p.life += dt * 1e3;
        if (p.life >= p.maxLife || p.y > this.height + 40) {
          this.particles.splice(i, 1);
        }
      }
    }
    /**
     * 当前布局插值状态。
     */
    getLayout(nowMs) {
      if (!this.active) {
        return {
          veilAlpha: 0.45,
          panelScale: 1,
          panelAlpha: 1,
          titleScale: 1,
          buttonProgress: 1,
          displayScore: this.targetScore,
          interactive: true,
          glow: this.won ? 0.5 : 0,
          flash: 0,
          scorePunch: 1
        };
      }
      const t = Math.max(0, nowMs - this.startMs);
      const veilAlpha = 0.52 * easeOutCubic2(clamp01(t / 260));
      const panelT = clamp01((t - 60) / 460);
      const panelScale = this.won ? elasticOut(panelT) * 0.42 + 0.58 * easeOutBack(panelT) : 0.7 + 0.3 * easeOutCubic2(panelT);
      const panelAlpha = easeOutCubic2(clamp01((t - 30) / 240));
      const titleScale = 1 + (this.won ? Math.sin(Math.min(1, (t - 140) / 420) * Math.PI) * 0.16 : 0);
      const buttonProgress = easeOutCubic2(clamp01((t - 420) / 400));
      const scoreT = clamp01((t - 160) / 780);
      const displayScore = Math.round(this.targetScore * easeOutCubic2(scoreT));
      const glow = this.won ? 0.4 + 0.4 * Math.abs(Math.sin((nowMs - this.startMs) * 7e-3)) : 0;
      const flash = this.won ? Math.max(0, 1 - t / 220) * 0.55 : 0;
      const scorePunch = this.won && scoreT > 0.85 && scoreT < 1 ? 1 + 0.12 * Math.sin((scoreT - 0.85) / 0.15 * Math.PI) : 1;
      return {
        veilAlpha,
        panelScale: Math.max(0.01, panelScale),
        panelAlpha,
        titleScale: Math.max(0.01, titleScale),
        buttonProgress,
        displayScore,
        interactive: buttonProgress > 0.85,
        glow,
        flash,
        scorePunch
      };
    }
    /**
     * 绘制彩带 / 星光粒子（在 UI 之上或之下由调用方决定）。
     */
    drawParticles(ctx, nowMs) {
      if (!this.active) {
        return;
      }
      void nowMs;
      for (const p of this.particles) {
        const lifeRatio = 1 - p.life / p.maxLife;
        const alpha = Math.max(0, Math.min(1, lifeRatio * 1.35));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * 0.35);
        if (p.kind === "star") {
          this.drawStar(ctx, 0, 0, p.size, p.color);
        } else if (p.kind === "spark") {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "ribbon") {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size * 0.2, -p.size * 1.4, p.size * 0.4, p.size * 2.8);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size * 0.4, -p.size, p.size * 0.8, p.size * 2);
        }
        ctx.restore();
      }
    }
    spawnBurst(count) {
      const cx = this.width * 0.5;
      const cy = this.height * 0.34;
      const colors = this.won ? WIN_COLORS : FAIL_COLORS;
      const n = this.roomFor(count);
      for (let i = 0; i < n; i += 1) {
        const ang = Math.PI * 2 * i / n + i % 3 * 0.18;
        const speed = this.won ? 4.2 + i % 6 * 1.35 : 1.2 + i % 3 * 0.6;
        const kindRoll = i % 7;
        const kind = this.won ? kindRoll === 0 ? "star" : kindRoll === 1 || kindRoll === 2 ? "spark" : kindRoll === 3 ? "ribbon" : "confetti" : "spark";
        this.particles.push({
          x: cx + (i % 5 - 2) * 6,
          y: cy,
          vx: Math.cos(ang) * speed * (0.7 + i % 4 * 0.18),
          vy: Math.sin(ang) * speed * 0.5 - (this.won ? 3.2 : 0.5),
          rot: i * 0.45,
          vr: (i % 2 === 0 ? 1 : -1) * (0.1 + i % 5 * 0.04),
          size: this.won ? 6 + i % 5 * 2.2 : 4,
          color: colors[i % colors.length],
          life: 0,
          maxLife: this.won ? 1600 + i % 7 * 200 : 900,
          kind
        });
      }
    }
    /** 左右礼炮，增强过关爆发感 */
    spawnSideCannons(count) {
      for (let side = 0; side < 2; side += 1) {
        const baseX = side === 0 ? this.width * 0.08 : this.width * 0.92;
        const baseY = this.height * 0.62;
        const n = this.roomFor(count);
        for (let i = 0; i < n; i += 1) {
          const dir = side === 0 ? 1 : -1;
          const ang = -0.9 + i / Math.max(1, n) * 1.2;
          const speed = 3.5 + i % 4 * 1.1;
          this.particles.push({
            x: baseX,
            y: baseY,
            vx: Math.cos(ang) * speed * dir,
            vy: Math.sin(ang) * speed - 2.2,
            rot: i,
            vr: dir * 0.14,
            size: 5 + i % 4 * 2,
            color: WIN_COLORS[i % WIN_COLORS.length],
            life: 0,
            maxLife: 1400 + i * 40,
            kind: i % 3 === 0 ? "star" : i % 2 === 0 ? "ribbon" : "confetti"
          });
        }
      }
    }
    spawnFalling(count) {
      const n = this.roomFor(count);
      for (let i = 0; i < n; i += 1) {
        this.particles.push({
          x: (i * 97 + this.particles.length * 13) % this.width,
          y: -20 - i % 4 * 12,
          vx: -0.8 + i % 5 * 0.35,
          vy: 1.8 + i % 4 * 0.55,
          rot: i,
          vr: (i % 2 === 0 ? 1 : -1) * 0.12,
          size: 5 + i % 3 * 2,
          color: WIN_COLORS[i % WIN_COLORS.length],
          life: 0,
          maxLife: 2400,
          kind: i % 4 === 0 ? "star" : i % 3 === 0 ? "ribbon" : "confetti"
        });
      }
    }
    roomFor(count) {
      return Math.max(0, Math.min(count, this.maxParticles - this.particles.length));
    }
    drawStar(ctx, cx, cy, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        const a2 = a + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
      }
      ctx.closePath();
      ctx.fill();
    }
  };
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }
  function easeOutCubic2(t) {
    const u = 1 - t;
    return 1 - u * u * u;
  }
  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  }
  function elasticOut(t) {
    if (t === 0 || t === 1) {
      return t;
    }
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  }

  // src/presentation/fx/ResultSceneBackdrop.ts
  function drawResultSceneBackdrop(ctx, width, height, opts) {
    const { veilAlpha, tone, isFail = false } = opts;
    const strength = Math.min(1, veilAlpha * (isFail ? 1 : 0.96));
    const cx = width / 2;
    const focusY = height * 0.38;
    ctx.fillStyle = `rgba(18, 12, 28, ${0.58 + strength * 0.32})`;
    ctx.fillRect(0, 0, width, height);
    const radial = ctx.createRadialGradient(cx, focusY, width * 0.06, cx, focusY, width * 0.92);
    if (tone === "pink") {
      radial.addColorStop(0, `rgba(255, 215, 235, ${0.28 * strength})`);
      radial.addColorStop(0.42, `rgba(100, 48, 88, ${0.4 * strength})`);
      radial.addColorStop(1, `rgba(8, 6, 18, ${0.72 * strength})`);
    } else {
      radial.addColorStop(0, `rgba(190, 240, 225, ${0.22 * strength})`);
      radial.addColorStop(0.48, `rgba(28, 72, 64, ${0.44 * strength})`);
      radial.addColorStop(1, `rgba(6, 14, 18, ${0.68 * strength})`);
    }
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
    const edge = ctx.createLinearGradient(0, 0, 0, height);
    edge.addColorStop(0, `rgba(0,0,0,${0.14 * strength})`);
    edge.addColorStop(0.22, "rgba(0,0,0,0)");
    edge.addColorStop(0.78, "rgba(0,0,0,0)");
    edge.addColorStop(1, `rgba(0,0,0,${0.2 * strength})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
  }

  // src/config/share-images.json
  var share_images_default = {
    lobby: {
      imageUrlId: "",
      imageUrl: "assets/main/share/lobby-500x400.jpg"
    },
    playing: {
      imageUrlId: "",
      imageUrl: "assets/main/share/playing-500x400.jpg"
    },
    sparkle: {
      imageUrlId: "",
      imageUrl: "assets/main/share/sparkle-500x400.jpg"
    }
  };

  // src/presentation/ui/LobbyLevelMap.ts
  var LADDER_BAR_H_OF_HEIGHT = 0.042;
  var LADDER_BAR_W_OF_WIDTH = 0.48;
  var LADDER_ZIGZAG_OF_WIDTH = 0.055;
  var LADDER_STEP_OF_HEIGHT = 0.06;
  var LADDER_CIRCLE_OF_BAR = 1.12;
  var LADDER_BOTTOM_PAD_OF_HEIGHT = 0.22;
  var LOBBY_FIRST_SCREEN_LEVELS = 8;
  var LOBBY_LADDER_BOTTOM_GAP = 10;
  var LOBBY_LADDER_TOP_INSET = 10;
  var MACARON_RADIUS_OF_COVER = 30 / 576;
  var TREE_CAPTION_UY = 0.78;
  var LOBBY_MORE_LEVELS_HINT = "\u4E0A\u6ED1\u95EF\u5173";
  var LOBBY_SWIPE_HINT_HOLD_MS = 3e3;
  var LOBBY_SWIPE_HINT_FADE_MS = 480;
  var LOBBY_BRAND_TITLE = "\u840C\u5BA0\u7C89\u788E\u6D88";
  var LOBBY_BRAND_SUBTITLE = "\u95EF\u5173\u6D88\u9664 \xB7 \u53EF\u7231\u5C0F\u52A8\u7269";
  var LOBBY_TITLE_UY = 92 / 1024;
  var LOBBY_SUBTITLE_UY = 142 / 1024;
  var LADDER_CLEARED_THEMES = [
    {
      barTop: "#9ad8f8",
      barBottom: "#5eb8ef",
      circleTop: "#7ec8f5",
      circleBottom: "#3aa0d8",
      stripe: "rgba(255,255,255,0.22)",
      pattern: "none"
    },
    {
      barTop: "#d0bcfa",
      barBottom: "#9b7aef",
      circleTop: "#b9a0f5",
      circleBottom: "#7c5ce0",
      stripe: "rgba(255,255,255,0.28)",
      pattern: "stripe"
    },
    {
      barTop: "#8eebc0",
      barBottom: "#4ecf8a",
      circleTop: "#6edc9e",
      circleBottom: "#2fb872",
      stripe: "rgba(255,255,255,0.35)",
      pattern: "sprinkle"
    }
  ];
  var LADDER_CURRENT_THEME = {
    barTop: "#ffc078",
    barBottom: "#f18a2c",
    circleTop: "#ffb056",
    circleBottom: "#ef7a1a",
    stripe: "rgba(255,255,255,0.38)",
    pattern: "stripe",
    startTop: "#ff8f6b",
    startBottom: "#ff5c38"
  };
  var LADDER_LOCKED_THEME = {
    barTop: "rgba(210, 224, 224, 0.78)",
    barBottom: "rgba(180, 198, 200, 0.72)",
    circleTop: "rgba(190, 205, 208, 0.92)",
    circleBottom: "rgba(160, 178, 182, 0.9)",
    stripe: "rgba(255,255,255,0.12)",
    pattern: "none"
  };
  function lobbyBrandAnchorY(cover, _camY, uy) {
    return cover.dy + cover.dh * uy;
  }
  function layoutLobbyMoreLevelsHint(width, statusBarHeight, bobY = 0) {
    const h = 28;
    const r = h / 2;
    const w = 86;
    const y = Math.max(statusBarHeight + 56, 72) + bobY - h / 2;
    const x = width - w + 6;
    const cy = y + r;
    return {
      x,
      y,
      w,
      h,
      r,
      cy,
      chevronX: x + 16,
      textX: x + 48
    };
  }
  function lobbySwipeHintOpacity(shownAtMs, nowMs, dismissed) {
    if (dismissed || shownAtMs <= 0) {
      return 0;
    }
    const elapsed = Math.max(0, nowMs - shownAtMs);
    if (elapsed < LOBBY_SWIPE_HINT_HOLD_MS) {
      return 1;
    }
    const t = (elapsed - LOBBY_SWIPE_HINT_HOLD_MS) / LOBBY_SWIPE_HINT_FADE_MS;
    return Math.max(0, 1 - t);
  }
  function lobbyLadderStep(height, ladderStep) {
    if (typeof ladderStep === "number" && Number.isFinite(ladderStep) && ladderStep > 0) {
      return ladderStep;
    }
    return Math.max(40, height * LADDER_STEP_OF_HEIGHT);
  }
  function lobbyLadderStepForBand(bandHeight, barH = 36, levels = LOBBY_FIRST_SCREEN_LEVELS) {
    const gaps = Math.max(1, levels - 1);
    const band = Math.max(1, bandHeight);
    return Math.max(barH + 6, (band + barH * 0.15) / gaps - 1);
  }
  function lobbyFirstScreenLadderLayout(args) {
    var _a, _b, _c;
    const bottomGap = (_a = args.bottomGap) != null ? _a : LOBBY_LADDER_BOTTOM_GAP;
    const topInset = (_b = args.topInset) != null ? _b : LOBBY_LADDER_TOP_INSET;
    const levels = (_c = args.levels) != null ? _c : LOBBY_FIRST_SCREEN_LEVELS;
    const ceiling = args.contentTop - bottomGap - args.barH * 0.5;
    const clipTop = args.bandTop + topInset;
    const step = lobbyLadderStepForBand(
      Math.max(1, ceiling - clipTop),
      args.barH,
      levels
    );
    return { ceiling, step, bandTop: clipTop };
  }
  function lobbyBarSize(width, height) {
    return {
      w: Math.min(width * LADDER_BAR_W_OF_WIDTH, width - 72),
      h: Math.max(32, height * LADDER_BAR_H_OF_HEIGHT)
    };
  }
  function lobbyCircleSide(levelId) {
    return levelId % 2 === 1 ? "right" : "left";
  }
  function lobbyLadderSlot(levelId) {
    const i = Math.max(0, levelId - 1);
    const side = lobbyCircleSide(levelId);
    const ux = side === "left" ? 0.5 - LADDER_ZIGZAG_OF_WIDTH : 0.5 + LADDER_ZIGZAG_OF_WIDTH;
    return { ux, uy: i };
  }
  function lobbyPageHeight(height) {
    return Math.max(1, height);
  }
  function lobbyPageIndex(camY, height) {
    const pageH = lobbyPageHeight(height);
    return Math.max(0, Math.round(camY / pageH));
  }
  var LOBBY_SNAP_MS = 220;
  function lobbySnapEase(t) {
    const u = Math.max(0, Math.min(1, t));
    const inv = 1 - u;
    return 1 - inv * inv * inv * inv;
  }
  function lobbySnapCamY(from, to, elapsedMs, durationMs = LOBBY_SNAP_MS) {
    if (durationMs <= 0 || elapsedMs >= durationMs) {
      return to;
    }
    if (elapsedMs <= 0) {
      return from;
    }
    return from + (to - from) * lobbySnapEase(elapsedMs / durationMs);
  }
  function isLobbyNodeExposed(node, _camY, _height, hideBelowY, hideAboveY) {
    if (typeof hideBelowY === "number" && Number.isFinite(hideBelowY) && node.barY + node.barH * 0.35 > hideBelowY) {
      return false;
    }
    if (typeof hideAboveY === "number" && Number.isFinite(hideAboveY) && node.barY + node.barH * 0.65 < hideAboveY) {
      return false;
    }
    return true;
  }
  function lobbyLevelBandTop(cover, statusBarHeight) {
    const subY = lobbyBrandAnchorY(cover, 0, LOBBY_SUBTITLE_UY);
    const titleFloor = subY + Math.max(96, cover.dh * 0.105);
    return Math.max(statusBarHeight + 84, titleFloor);
  }
  function lobbyCameraMax(totalLevels, height, ladderStep) {
    const step = lobbyLadderStep(height, ladderStep);
    const levels = Math.max(1, totalLevels);
    return Math.max(0, (levels - 1) * step + step * 2.4);
  }
  function lobbyMaxPageIndex(totalLevels) {
    const h = 800;
    const maxCam = lobbyCameraMax(totalLevels, h);
    return Math.max(0, Math.round(maxCam / h));
  }
  function lobbyComingSoonLine(_page = 0, _totalLevels = 0) {
    return "";
  }
  function lobbyCamFromDrag(camStart, dragDy, min, max, extra = 48) {
    const raw = camStart - dragDy;
    return Math.max(min - extra, Math.min(max + extra, raw));
  }
  function lobbySnapTarget(camStart, camNow, height, maxCamOrPage, velY, ladderStep) {
    const pageH = lobbyPageHeight(height);
    const maxCam = maxCamOrPage > pageH * 1.5 ? maxCamOrPage : Math.max(0, maxCamOrPage) * pageH;
    const step = lobbyLadderStep(height, ladderStep);
    const delta = camNow - camStart;
    let target = camNow;
    if (Math.abs(velY) <= 0.35 && Math.abs(delta) < pageH * 0.12) {
      target = Math.round(camStart / step) * step;
    } else if (velY > 0.35 || delta > pageH * 0.12) {
      target = camNow + Math.min(pageH * 0.55, 120 + Math.abs(velY) * 180);
      target = Math.round(target / step) * step;
    } else if (velY < -0.35 || delta < -pageH * 0.12) {
      target = camNow - Math.min(pageH * 0.55, 120 + Math.abs(velY) * 180);
      target = Math.round(target / step) * step;
    } else {
      target = Math.round(target / step) * step;
    }
    return Math.max(0, Math.min(maxCam, target));
  }
  function layoutLobbyLevelNodes(args) {
    const { vines, width, height, camY } = args;
    const { w: barW, h: barH } = lobbyBarSize(width, height);
    const circleR = barH * LADDER_CIRCLE_OF_BAR / 2;
    const step = lobbyLadderStep(height, args.ladderStep);
    const bottom = typeof args.ladderBottomY === "number" && Number.isFinite(args.ladderBottomY) ? args.ladderBottomY : typeof args.maxCloudCenterY === "number" && Number.isFinite(args.maxCloudCenterY) ? args.maxCloudCenterY : height * (1 - LADDER_BOTTOM_PAD_OF_HEIGHT);
    const levelIds = [];
    for (const vine of vines) {
      for (const id of vine.levelIds) {
        levelIds.push(id);
      }
    }
    levelIds.sort((a, b) => a - b);
    const baseX = (width - barW) / 2;
    const zigzag = width * LADDER_ZIGZAG_OF_WIDTH;
    const out = [];
    for (const levelId of levelIds) {
      const slot = lobbyLadderSlot(levelId);
      const side = lobbyCircleSide(levelId);
      const cy = bottom - slot.uy * step + camY;
      const barY = cy - barH / 2;
      const barX = side === "left" ? baseX - zigzag : baseX + zigzag;
      const circleX = side === "left" ? barX + circleR * 0.15 + circleR * 0.55 : barX + barW - circleR * 0.15 - circleR * 0.55;
      const nodeIndex = Math.floor((levelId - 1) / LEVELS_PER_VINE_NODE);
      const slotIndex = (levelId - 1) % LEVELS_PER_VINE_NODE;
      out.push({
        levelId,
        nodeIndex,
        slotIndex,
        x: circleX,
        y: cy,
        hitR: circleR,
        kind: "ladder",
        barX,
        barY,
        barW,
        barH,
        circleSide: side,
        circleR
      });
    }
    return out;
  }
  function lobbyLevelHitRect(node) {
    const sidePad = Math.max(18, node.circleR * 1.05);
    const vertPad = Math.max(6, node.circleR - node.barH * 0.5 + 4);
    return {
      x: node.barX - sidePad,
      y: node.barY - vertPad,
      w: node.barW + sidePad * 2,
      h: node.barH + vertPad * 2
    };
  }
  function lobbyCloudDecorPoints(nodes, height, pad = 80) {
    return nodes.filter((n) => n.y > -pad && n.y < height + pad).map((n) => {
      const x = n.circleSide === "left" ? n.barX + n.barW - n.circleR * 0.35 : n.barX + n.circleR * 0.35;
      return {
        x,
        y: n.y + n.circleR * 0.08,
        side: n.circleSide,
        circleR: n.circleR
      };
    });
  }
  function lobbyLadderSideTrailPoints(nodes, height, pad = 100) {
    const sorted = nodes.filter((n) => n.y > -pad && n.y < height + pad).slice().sort((a, b) => a.levelId - b.levelId);
    if (sorted.length < 2) {
      return [];
    }
    const leftXs = sorted.filter((n) => n.circleSide === "left").map((n) => n.x);
    const rightXs = sorted.filter((n) => n.circleSide === "right").map((n) => n.x);
    const leftX = leftXs.length > 0 ? leftXs.reduce((s, v) => s + v, 0) / leftXs.length : Math.min(...sorted.map((n) => n.barX)) - 10;
    const rightX = rightXs.length > 0 ? rightXs.reduce((s, v) => s + v, 0) / rightXs.length : Math.max(...sorted.map((n) => n.barX + n.barW)) + 10;
    const out = [];
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const dy = b.y - a.y;
      const spots = [
        { t: 0.32, r: 4.2 },
        { t: 0.55, r: 2.7 },
        { t: 0.72, r: 3.4 }
      ];
      for (let s = 0; s < spots.length; s += 1) {
        const spot = spots[s];
        const y = a.y + dy * spot.t;
        if (y < -24 || y > height + 24) {
          continue;
        }
        const tone = (i + s) % 2 === 0 ? "white" : "cream";
        out.push({ x: leftX, y, r: spot.r, tone });
        out.push({ x: rightX, y, r: spot.r, tone });
      }
    }
    return out;
  }
  function isLobbyNodeOnScreen(node, height, pad = 72) {
    return node.barY + node.barH > -pad && node.barY < height + pad;
  }
  function lobbyCaptionY(cover, camY, height, page) {
    if (page <= 0) {
      return cover.dy + cover.dh * TREE_CAPTION_UY + camY * 0.15;
    }
    return height * 0.16;
  }
  function ladderThemeForLevel(levelId, state) {
    if (state === "current") {
      return LADDER_CURRENT_THEME;
    }
    if (state === "locked") {
      return LADDER_LOCKED_THEME;
    }
    return LADDER_CLEARED_THEMES[(levelId - 1) % LADDER_CLEARED_THEMES.length];
  }

  // src/presentation/ui/LobbyNoticeBubble.ts
  var NOTICE_BUBBLE_HOLD_MS = 3400;
  var NOTICE_BUBBLE_FADE_MS = 480;
  var NOTICE_BUBBLE_DRIFT_MS = 6200;
  function lobbyNoticeBubbleLines(input) {
    const raw = input.bubbles && input.bubbles.length > 0 ? input.bubbles : input.body ? [input.body] : [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of raw) {
      const text = String(item != null ? item : "").trim();
      if (!text || seen.has(text)) {
        continue;
      }
      seen.add(text);
      out.push(text);
    }
    return out;
  }
  function lobbyNoticeBubbleCycle(nowMs, lineCount, holdMs = NOTICE_BUBBLE_HOLD_MS, fadeMs = NOTICE_BUBBLE_FADE_MS) {
    const n = Math.max(1, Math.floor(lineCount));
    if (n <= 1) {
      return { index: 0, opacity: 1, nextIndex: 0, nextOpacity: 0 };
    }
    const period = Math.max(1, holdMs + fadeMs);
    const t = (Math.max(0, nowMs) % (period * n) + period * n) % (period * n);
    const index = Math.floor(t / period) % n;
    const local = t - index * period;
    if (local < holdMs) {
      return { index, opacity: 1, nextIndex: (index + 1) % n, nextOpacity: 0 };
    }
    const u = Math.max(0, Math.min(1, (local - holdMs) / fadeMs));
    return {
      index,
      opacity: 1 - u,
      nextIndex: (index + 1) % n,
      nextOpacity: u
    };
  }
  function lobbyNoticeBubbleDrift(nowMs, legMs = NOTICE_BUBBLE_DRIFT_MS) {
    const leg = Math.max(1, legMs);
    const round = leg * 2;
    const clock = (Math.max(0, nowMs) % round + round) % round;
    if (clock < leg) {
      return { progress: clock / leg, goingUp: true, opacity: 1 };
    }
    return {
      progress: 1 - (clock - leg) / leg,
      goingUp: false,
      opacity: 1
    };
  }
  function easeInOut(t) {
    const u = Math.max(0, Math.min(1, t));
    const smooth = u * u * (3 - 2 * u);
    return u * 0.35 + smooth * 0.65;
  }
  function layoutLobbyNoticeBubble(input) {
    const padX = 16;
    const maxW = Math.min(268, Math.floor(input.width * 0.7));
    const textW = Math.min(maxW - padX * 2, Math.ceil(input.measureWidth(input.text)));
    const w = Math.max(120, Math.min(maxW, textW + padX * 2));
    const h = 34;
    const t = easeInOut(input.progress);
    const startX = 10;
    const startY = Math.min(
      input.height - h - 24,
      Math.max(input.statusBarHeight + 80, input.contentTop - h - 18)
    );
    const endX = Math.max(startX, input.width - w - 12);
    const endY = Math.max(input.statusBarHeight + 50, 64);
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    return {
      x,
      y,
      w,
      h,
      textX: x + w / 2,
      textY: y + h / 2,
      driftOpacity: 1
    };
  }

  // src/presentation/ui/GameplayAnnouncementBar.ts
  var GAMEPLAY_ANNOUNCEMENT_H = 30;
  var GAMEPLAY_ANNOUNCEMENT_GAP = 4;
  function layoutGameplayAnnouncementBar(input) {
    var _a;
    const side = (_a = input.sidePad) != null ? _a : 12;
    const w = Math.max(80, input.width - side * 2);
    const tagW = 44;
    return {
      x: side,
      y: input.top,
      w,
      h: GAMEPLAY_ANNOUNCEMENT_H,
      tagW,
      textX: side + tagW + 6,
      textMaxW: w - tagW - 14
    };
  }
  function truncateAnnouncementText(ctx, text, maxWidth) {
    const raw = String(text != null ? text : "").trim();
    if (!raw || maxWidth <= 0) {
      return "";
    }
    if (ctx.measureText(raw).width <= maxWidth) {
      return raw;
    }
    const ell = "\u2026";
    let lo = 0;
    let hi = raw.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const slice = raw.slice(0, mid) + ell;
      if (ctx.measureText(slice).width <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return raw.slice(0, Math.max(0, lo)) + ell;
  }
  function drawGameplayAnnouncementBar(ctx, layout, message, roundRect4) {
    const title = notice_default.title || "\u516C\u544A";
    const { x, y, w, h, tagW, textX, textMaxW } = layout;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#1c4b7a";
    roundRect4(x + 1, y + 2, w, h, h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const fill2 = ctx.createLinearGradient(x, y, x, y + h);
    fill2.addColorStop(0, "rgba(255,255,255,0.98)");
    fill2.addColorStop(0.45, "rgba(232, 248, 255, 0.97)");
    fill2.addColorStop(1, "rgba(208, 235, 255, 0.96)");
    ctx.fillStyle = fill2;
    roundRect4(x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    roundRect4(x + 0.5, y + 0.5, w - 1, h - 1, h / 2 - 0.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(116, 192, 252, 0.55)";
    ctx.lineWidth = 1;
    roundRect4(x - 0.5, y - 0.5, w + 1, h + 1, h / 2 + 0.5);
    ctx.stroke();
    ctx.textBaseline = "middle";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#1864ab";
    ctx.fillText(title, x + tagW / 2, y + h / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.font = "bold 12px sans-serif";
    const line = truncateAnnouncementText(ctx, message, textMaxW);
    ctx.fillStyle = "#1864ab";
    ctx.fillText(line, textX, y + h / 2 + 0.5);
    ctx.restore();
  }

  // src/logic/level/levelDifficultyTip.ts
  var COPY3 = notice_default;
  function levelDifficultyArt(levelId, procedural) {
    var _a;
    const id = Math.floor(Number(levelId) || 0);
    if (id > MATCH3_TEMPLATE_LEVEL_COUNT && procedural) {
      return { title: procedural.entryTitle, subtitle: procedural.entrySubtitle };
    }
    if (id < 6) {
      return null;
    }
    const cycleId = (id - 1) % MATCH3_TEMPLATE_LEVEL_COUNT + 1;
    const title = (_a = COPY3.difficultyUp) != null ? _a : "\u96BE\u5EA6\u63D0\u5347";
    if (cycleId === 6) {
      return { title, subtitle: chapterSub(COPY3.difficultyUpCotton, "\u68C9\u82B1\u5173\u5F00\u59CB") };
    }
    if (cycleId === 11) {
      return { title, subtitle: chapterSub(COPY3.difficultyUpParty, "\u5F02\u5F62\u5173\u5361") };
    }
    if (cycleId === 16) {
      return { title, subtitle: chapterSub(COPY3.difficultyUpIce, "\u51B0\u96EA\u57CB\u85CF") };
    }
    return { title, subtitle: null };
  }
  function chapterSub(raw, fallback) {
    if (!raw) {
      return fallback;
    }
    const parts = raw.split("\xB7");
    const tail = parts.length > 1 ? parts.slice(1).join("\xB7").trim() : raw.trim();
    return tail || fallback;
  }

  // src/logic/level/LevelPresentation.ts
  function hslToHex(h, s, l) {
    const hh = (h % 360 + 360) % 360;
    const ss = Math.max(0, Math.min(100, s)) / 100;
    const ll = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * ll - 1)) * ss;
    const x = c * (1 - Math.abs(hh / 60 % 2 - 1));
    const m = ll - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hh < 60) {
      r = c;
      g = x;
    } else if (hh < 120) {
      r = x;
      g = c;
    } else if (hh < 180) {
      g = c;
      b = x;
    } else if (hh < 240) {
      g = x;
      b = c;
    } else if (hh < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    const toByte = (v) => Math.round((v + m) * 255);
    const hex = (n) => n.toString(16).padStart(2, "0");
    return `#${hex(toByte(r))}${hex(toByte(g))}${hex(toByte(b))}`;
  }
  function hudPaletteFromHue(hue) {
    const h = hue % 360;
    return {
      deep: hslToHex(h, 70, 42),
      mid: hslToHex(h, 75, 58),
      lite: hslToHex(h, 85, 88),
      ink: hslToHex(h, 80, 28),
      inkSoft: hslToHex(h, 70, 48),
      shadow: hslToHex(h, 60, 22)
    };
  }

  // src/config/buriedTileSprites.ts
  var BURIED_TILE_SPRITE_SRC = {
    penguin: "assets/main/tiles/penguin.png",
    snowman: "assets/main/tiles/snowman.png"
  };

  // src/presentation/ui/HudGoalText.ts
  var KIND_NAME2 = {
    [1 /* Red */]: "\u7EA2\u72D0",
    [2 /* Blue */]: "\u84DD\u5154",
    [3 /* Green */]: "\u7EFF\u86D9",
    [4 /* Yellow */]: "\u9EC4\u9E21",
    [5 /* Purple */]: "\u7D2B\u732B",
    [9 /* Bear */]: "\u68D5\u718A",
    [10 /* Pig */]: "\u5C0F\u732A",
    [11 /* Panda */]: "\u718A\u732B",
    [12 /* Corgi */]: "\u67F4\u72AC"
  };
  function describeHudGoal(goal, compact) {
    var _a;
    const n = `${goal.current}/${goal.target}`;
    switch (goal.goal.type) {
      case "collect": {
        const name = (_a = KIND_NAME2[goal.goal.kind]) != null ? _a : "\u840C\u5BA0";
        return compact ? `${name} ${n}` : `\u6536\u96C6${name} ${n}`;
      }
      case "clear_ice":
        return compact ? `\u51B0\u5757 ${n}` : `\u6E05\u9664\u51B0\u5757 ${n}`;
      case "clear_cloud":
        return compact ? `\u68C9\u82B1 ${n}` : `\u6E05\u9664\u68C9\u82B1 ${n}`;
      case "collect_gems":
        return compact ? `\u7C89\u7403 ${n}` : `\u6536\u96C6\u7C89\u7403 ${n}`;
      case "collect_snowmen":
        return compact ? `\u96EA\u4EBA ${n}` : `\u6536\u96C6\u96EA\u4EBA ${n}`;
      case "collect_penguins":
        return compact ? `\u4F01\u9E45 ${n}` : `\u6536\u96C6\u4F01\u9E45 ${n}`;
      case "collect_chicks":
        return compact ? `\u840C\u9E21 ${n}` : `\u6536\u96C6\u840C\u9E21 ${n}`;
      case "clear_vines":
        return compact ? `\u85E4\u8513 ${n}` : `\u89E3\u5F00\u85E4\u8513 ${n}`;
      case "score":
        return compact ? `\u5206\u6570 ${n}` : `\u8FBE\u5230\u5206\u6570 ${n}`;
      case "clear_blocks":
        return compact ? `\u6D88\u9664 ${n}` : `\u6D88\u9664\u65B9\u5757 ${n}`;
      default:
        return `\u76EE\u6807 ${n}`;
    }
  }
  function formatHudGoals(goals) {
    if (goals.length === 0) {
      return { text: "\u5B8C\u6210\u76EE\u6807", progress: 0 };
    }
    const compact = goals.length >= 3;
    const text = goals.map((item) => describeHudGoal(item, compact)).join(" \xB7 ");
    const progress = goals.reduce(
      (sum, item) => sum + Math.min(1, item.current / Math.max(1, item.target)),
      0
    ) / goals.length;
    const collect = goals.find((item) => item.goal.type === "collect");
    return {
      text,
      progress,
      collectKind: collect && collect.goal.type === "collect" ? collect.goal.kind : void 0
    };
  }

  // src/logic/share/shareCopy.ts
  function buildShareTitle(scene, levelId, score) {
    const level = Math.max(1, Math.floor(levelId) || 1);
    const points = Math.max(0, Math.floor(score) || 0);
    switch (scene) {
      case "playing":
        return `\u6211\u5728\u7B2C ${level} \u5173\uFF0C\u4F60\u4E5F\u6765\u8BD5\u8BD5\uFF1F`;
      case "crush":
        return `\u7B2C ${level} \u5173\u7C89\u788E\u4E2D\uFF0C\u70B9\u683C\u5B50\u8D85\u89E3\u538B`;
      case "clean":
        return `\u7B2C ${level} \u5173\u6253\u626B\u4E2D\uFF0C\u4E00\u8D77\u6765\u6536\u5C3E`;
      case "result":
        return `\u6211\u5728\u7B2C ${level} \u5173\u62FF\u4E86 ${points} \u5206\uFF0C\u4F60\u6765\u6311\u6218`;
      case "booster_friend":
        return `\u6211\u5728\u7B2C ${level} \u5173\u7F3A\u4E2A\u9053\u5177\uFF0C\u8F6C\u53D1\u7ED9\u6211\u5C31\u884C`;
      case "booster_group":
        return `\u53D1\u5230\u7FA4\u91CC\u4E00\u8D77\u73A9\uFF0C\u7B2C ${level} \u5173\u66F4\u597D\u8FC7`;
      default:
        return "\u840C\u5BA0\u7C89\u788E\u6D88\uFF0C\u6CBF\u7CD6\u679C\u68AF\u5B50\u4E00\u8DEF\u95EF\u5173";
    }
  }
  function buildShareQuery(scene, levelId, score, inviteCode) {
    const level = Math.max(1, Math.floor(levelId) || 1);
    const points = Math.max(0, Math.floor(score) || 0);
    let query = "from=lobby";
    if (scene === "playing") {
      query = `from=playing&level=${level}`;
    } else if (scene === "crush") {
      query = `from=crush&level=${level}`;
    } else if (scene === "clean") {
      query = `from=clean&level=${level}`;
    } else if (scene === "result") {
      query = `from=result&level=${level}&score=${points}`;
    } else if (scene === "booster_friend") {
      query = `from=booster_friend&level=${level}`;
    } else if (scene === "booster_group") {
      query = `from=booster_group&level=${level}`;
    }
    return withInviterQuery(query, inviteCode);
  }

  // src/presentation/ui/PanelChrome.ts
  var PANEL_CORNER_SIZE = 34;
  var CORNER_PALETTE = {
    top: "transparent",
    bottom: "transparent",
    border: "transparent",
    gloss: false
  };
  function panelBackButton(panel) {
    return {
      id: "resume",
      x: panel.x + 10,
      y: panel.y + 8,
      w: PANEL_CORNER_SIZE,
      h: PANEL_CORNER_SIZE,
      label: "<",
      palette: CORNER_PALETTE
    };
  }
  function panelCloseButton(panel) {
    return {
      id: "resume",
      x: panel.x + panel.w - PANEL_CORNER_SIZE - 10,
      y: panel.y + 8,
      w: PANEL_CORNER_SIZE,
      h: PANEL_CORNER_SIZE,
      label: "\xD7",
      palette: CORNER_PALETTE
    };
  }
  function isPanelBackLabel(label) {
    return label === "<" || label === "\u2039";
  }
  function isPanelCloseLabel(label) {
    return label === "\xD7" || label === "X" || label === "x";
  }

  // src/presentation/ui/LeaderboardPanel.ts
  var PLAYER_ROW_H = 52;
  var PLAYER_ROW_GAP = 6;
  var AVATAR_R = 16;
  var INFO_LINE_H = 16;
  var MAX_VISIBLE_ROWS = 5;
  var MIN_VISIBLE_ROWS = 2;
  var LEADERBOARD_PODIUM_H = 56;
  function playerRowStride() {
    return PLAYER_ROW_H + PLAYER_ROW_GAP;
  }
  function leaderboardShowPodium(playerCount, listViewportH) {
    return playerCount >= 3 && listViewportH > LEADERBOARD_PODIUM_H + playerRowStride();
  }
  function layoutLeaderboardPanel(input) {
    var _a, _b, _c, _d, _e, _f;
    const panelW = Math.min(360, input.width - 24);
    const padX = 14;
    const tagW = 30;
    const avatarGap = 8;
    const scoreColW = 78;
    const innerW = panelW - padX * 2;
    const tab = input.tab;
    const isWeek = input.activeTab === "week";
    const ruleLines = (tab == null ? void 0 : tab.rule) ? input.wrap(tab.rule, innerW) : [];
    const rawTiers = isWeek ? leaderboardRewardTierLines() : [];
    const settleLines = isWeek && ((_a = input.settleText) == null ? void 0 : _a.trim()) ? input.wrap(input.settleText.trim(), innerW) : [];
    const settleNote = isWeek && (settleLines.length > 0 || rawTiers.length > 0) ? (_b = notice_default.leaderboard.settleNote) != null ? _b : "" : "";
    const settleNoteLines = settleNote ? input.wrap(settleNote, innerW) : [];
    const rewardTierLines = rawTiers.flatMap((line) => input.wrap(line, innerW));
    const rewardTitle = isWeek && rewardTierLines.length > 0 ? (_c = notice_default.leaderboard.rewardTitle) != null ? _c : "\u5468\u5956\u52B1" : null;
    const rewardLines = [];
    const playerRows = ((_d = tab == null ? void 0 : tab.rows) != null ? _d : []).filter((row) => {
      var _a2;
      return ((_a2 = row.kind) != null ? _a2 : "player") === "player";
    });
    const selfRow = (_e = tab == null ? void 0 : tab.self) != null ? _e : null;
    const gapHint = (_f = tab == null ? void 0 : tab.gapHint) != null ? _f : "";
    const titleH = 46;
    const tabsH = 34;
    const rewardBlockPad = rewardTierLines.length > 0 ? 10 : 0;
    const infoLineCount = ruleLines.length + settleLines.length + settleNoteLines.length + (rewardTitle ? 1 : 0) + rewardTierLines.length;
    const infoH = infoLineCount * INFO_LINE_H + rewardBlockPad + 8;
    const gapH = gapHint ? 22 : 0;
    const selfBarH = selfRow ? PLAYER_ROW_H + 8 : 0;
    const inviteH = 40;
    const footH = 14;
    const fixedH = titleH + tabsH + 8 + infoH + gapH + 6 + selfBarH + 8 + inviteH + footH;
    const stride = playerRowStride();
    const podiumEstimate = playerRows.length >= 3 ? LEADERBOARD_PODIUM_H : 0;
    const scrollEstimate = playerRows.length >= 3 ? Math.max(0, playerRows.length - 3) : playerRows.length;
    const wantRows = Math.max(
      MIN_VISIBLE_ROWS,
      Math.min(MAX_VISIBLE_ROWS, scrollEstimate || playerRows.length)
    );
    const desiredH = fixedH + podiumEstimate + wantRows * stride;
    const panelH = Math.min(input.height * 0.9, desiredH);
    const x = (input.width - panelW) / 2;
    const y = Math.max(12, (input.height - panelH) / 2);
    const tabsY = y + titleH;
    const tabGap = 8;
    const tabW = (innerW - tabGap) / 2;
    const tabs = [
      {
        id: "lb_tab_level",
        x: x + padX,
        y: tabsY,
        w: tabW,
        h: tabsH,
        label: notice_default.leaderboard.tabLevel,
        active: !isWeek
      },
      {
        id: "lb_tab_week",
        x: x + padX + tabW + tabGap,
        y: tabsY,
        w: tabW,
        h: tabsH,
        label: notice_default.leaderboard.tabWeek,
        active: isWeek
      }
    ];
    const infoTop = tabsY + tabsH + 8;
    const gapY = infoTop + infoH;
    const listTop = gapY + gapH + 6;
    const inviteY = y + panelH - footH - inviteH;
    const selfBarY = inviteY - 8 - selfBarH;
    const listBottom = selfRow ? selfBarY - 4 : inviteY - 8;
    const listViewportH = Math.max(0, listBottom - listTop);
    const showPodium = leaderboardShowPodium(playerRows.length, listViewportH);
    const podiumH = showPodium ? LEADERBOARD_PODIUM_H : 0;
    const scrollRowCount = showPodium ? Math.max(0, playerRows.length - 3) : playerRows.length;
    const listContentH = scrollRowCount * stride;
    const tagX = x + padX;
    const avatarX = tagX + tagW + avatarGap + AVATAR_R;
    const textX = avatarX + AVATAR_R + avatarGap;
    const scoreX = x + panelW - padX - 4;
    const textWidth = Math.max(60, scoreX - scoreColW - textX);
    const invite = {
      id: "invite",
      x: x + padX + 20,
      y: inviteY,
      w: innerW - 40,
      h: inviteH,
      label: notice_default.leaderboard.invite
    };
    const close = panelCloseButton({ x, y, w: panelW });
    return {
      panel: { x, y, w: panelW, h: panelH },
      title: notice_default.leaderboard.title,
      activeTab: input.activeTab,
      tabs,
      ruleLines,
      rewardLines,
      settleLines,
      settleNoteLines,
      rewardTitle,
      rewardTierLines,
      infoTop,
      infoLineH: INFO_LINE_H,
      gapHint,
      gapY,
      playerRows,
      emptyText: tab ? isWeek ? notice_default.leaderboard.weekEmpty : notice_default.leaderboard.empty : notice_default.leaderboard.unavailable,
      textWidth,
      tagX,
      avatarX,
      avatarR: AVATAR_R,
      textX,
      scoreX,
      listTop,
      listBottom,
      listViewportH,
      listContentH,
      podiumH,
      listScrollTop: listTop + podiumH,
      listScrollViewportH: Math.max(0, listBottom - listTop - podiumH),
      rowH: PLAYER_ROW_H,
      rowGap: PLAYER_ROW_GAP,
      selfRow,
      selfBar: { x: x + 8, y: selfBarY, w: panelW - 16, h: selfBarH },
      buttons: [{ ...close }, ...tabs, invite]
    };
  }
  function clampLeaderboardScroll(scrollY, layout) {
    const viewport = layout.listScrollViewportH > 0 ? layout.listScrollViewportH : layout.listViewportH;
    const maxScroll = Math.max(0, layout.listContentH - viewport);
    if (!Number.isFinite(scrollY) || scrollY < 0) {
      return 0;
    }
    if (scrollY > maxScroll) {
      return maxScroll;
    }
    return scrollY;
  }
  function leaderboardMedal(tag) {
    if (tag === "1") {
      return "gold";
    }
    if (tag === "2") {
      return "silver";
    }
    if (tag === "3") {
      return "bronze";
    }
    return null;
  }

  // src/presentation/ui/DailyTasksPanel.ts
  var ROW_H = 64;
  var ROW_GAP = 8;
  var CHEST_H = 96;
  function layoutDailyTasksPanel(input) {
    const panelW = Math.min(352, input.width - 24);
    const padX = 14;
    const titleH = 62;
    const footH = 16;
    const tasks = input.view.tasks;
    const listH = tasks.length * ROW_H + Math.max(0, tasks.length - 1) * ROW_GAP;
    const panelH = Math.min(input.height * 0.92, titleH + listH + 12 + CHEST_H + footH);
    const x = (input.width - panelW) / 2;
    const y = Math.max(12, (input.height - panelH) / 2);
    const innerW = panelW - padX * 2;
    const btnW = 64;
    const btnH = 32;
    const buttons = [{ ...panelCloseButton({ x, y, w: panelW }) }];
    const rows = tasks.map((task, index) => {
      const ry = y + titleH + index * (ROW_H + ROW_GAP);
      const rx = x + padX;
      const iconCx = rx + 26;
      const textX = rx + 54;
      const barX = textX;
      const barW = Math.max(60, rx + innerW - btnW - 14 - textX);
      const state = task.claimed ? "claimed" : task.done ? "claim" : "todo";
      const button = state === "claim" ? {
        id: "daily_claim",
        x: rx + innerW - btnW - 6,
        y: ry + (ROW_H - btnH) / 2,
        w: btnW,
        h: btnH,
        label: "\u9886\u53D6",
        index
      } : null;
      if (button) {
        buttons.push(button);
      }
      return {
        task,
        index,
        x: rx,
        y: ry,
        w: innerW,
        h: ROW_H,
        iconCx,
        textX,
        barX,
        barY: ry + 39,
        barW,
        barH: 14,
        ratio: task.target > 0 ? Math.min(1, task.progress / task.target) : 0,
        state,
        button
      };
    });
    const chestY = y + titleH + listH + 12;
    const claimedCount = tasks.filter((task) => task.claimed).length;
    const chestState = input.view.chestClaimed ? "claimed" : input.view.chestReady ? "ready" : "locked";
    const chestX = x + padX;
    if (chestState === "ready") {
      const half = (innerW - 24 - 10) / 2;
      const by = chestY + CHEST_H - 44;
      buttons.push(
        {
          id: "daily_chest",
          x: chestX + 12,
          y: by,
          w: half,
          h: 36,
          label: notice_default.dailyTasks.chestClaim
        },
        {
          id: "daily_chest_double",
          x: chestX + 12 + half + 10,
          y: by,
          w: half,
          h: 36,
          label: notice_default.dailyTasks.chestDouble
        }
      );
    }
    return {
      panel: { x, y, w: panelW, h: panelH },
      title: notice_default.dailyTasks.title,
      subtitle: notice_default.dailyTasks.refresh,
      rows,
      chest: {
        x: chestX,
        y: chestY,
        w: innerW,
        h: CHEST_H,
        iconCx: chestX + 34,
        iconCy: chestY + (chestState === "ready" ? 26 : CHEST_H / 2),
        textX: chestX + 68,
        claimedCount,
        total: tasks.length,
        state: chestState,
        hint: chestState === "claimed" ? "\u4ECA\u65E5\u5B9D\u7BB1\u5DF2\u9886\u53D6\uFF0C\u660E\u5929\u518D\u6765" : notice_default.dailyTasks.chestHint
      },
      buttons
    };
  }
  function dailyTasksSideLabel(_view) {
    return notice_default.dailyTasks.title;
  }

  // src/presentation/fx/LevelFx.ts
  var BANNER_DURATION_MS = {
    intro: 1500,
    goal: 1100,
    bonus: 1200,
    low_moves: 1100,
    mahjong_intro: 1500,
    mahjong_fail: 1400
  };
  function makeLevelBanner(kind, title, subtitle) {
    return { kind, title, subtitle, startMs: 0, durationMs: BANNER_DURATION_MS[kind] };
  }
  function clamp012(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function easeOutBack2(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function bannerFrame(banner, nowMs) {
    const elapsed = nowMs - banner.startMs;
    if (elapsed >= banner.durationMs) {
      return { done: true, offset: 1, alpha: 0, scale: 1, ribbon: 0 };
    }
    const t = clamp012(elapsed / banner.durationMs);
    const inEnd = 0.2;
    const outStart = 0.82;
    if (t < inEnd) {
      const u = t / inEnd;
      return {
        done: false,
        offset: -(1 - easeOutBack2(u)),
        alpha: clamp012(u * 1.6),
        scale: 0.9 + 0.1 * u,
        ribbon: clamp012(u * 1.4)
      };
    }
    if (t > outStart) {
      const u = (t - outStart) / (1 - outStart);
      return {
        done: false,
        offset: u * u,
        alpha: 1 - u,
        scale: 1,
        ribbon: 1 - u
      };
    }
    const holdPulse = 1 + 0.035 * Math.sin(nowMs * 0.012 + banner.startMs * 1e-3);
    return { done: false, offset: 0, alpha: 1, scale: holdPulse, ribbon: 1 };
  }
  function bannerShimmerPhase(banner, nowMs) {
    const elapsed = nowMs - banner.startMs;
    if (elapsed <= 0 || elapsed >= banner.durationMs) {
      return -1;
    }
    const t = clamp012(elapsed / banner.durationMs);
    if (t < 0.2 || t > 0.82) {
      return -1;
    }
    return elapsed * 85e-5 % 1.35 - 0.2;
  }
  function planGoalFlyers(cells, goalKind, max) {
    if (goalKind === void 0) {
      return [];
    }
    const hits = cells.filter((cell) => cell.kind === goalKind);
    if (hits.length <= max) {
      return hits.slice();
    }
    const out = [];
    const step = hits.length / max;
    for (let i = 0; i < max; i += 1) {
      out.push(hits[Math.floor(i * step)]);
    }
    return out;
  }
  function flyerPoint(flyer, nowMs) {
    const elapsed = nowMs - flyer.startMs;
    if (elapsed < 0) {
      return { done: false, started: false, x: flyer.fromX, y: flyer.fromY, scale: 1, alpha: 0 };
    }
    if (elapsed >= flyer.durationMs) {
      return { done: true, started: true, x: flyer.toX, y: flyer.toY, scale: 0.5, alpha: 0 };
    }
    const t = easeInOutQuad(elapsed / flyer.durationMs);
    const midX = (flyer.fromX + flyer.toX) / 2 + (flyer.fromX < flyer.toX ? -30 : 30);
    const midY = Math.min(flyer.fromY, flyer.toY) - 60;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return {
      done: false,
      started: true,
      x: a * flyer.fromX + b * midX + c * flyer.toX,
      y: a * flyer.fromY + b * midY + c * flyer.toY,
      scale: t < 0.15 ? 1 + t * 1.6 : 1.24 - 0.7 * t,
      alpha: t > 0.92 ? (1 - t) / 0.08 : 1
    };
  }
  var STAR_POP_DELAY_MS = 420;
  var STAR_POP_STEP_MS = 280;
  var STAR_POP_MS = 360;
  function starPopFrame(index, elapsedMs) {
    const start = STAR_POP_DELAY_MS + index * STAR_POP_STEP_MS;
    const local = elapsedMs - start;
    if (local < 0) {
      return { visible: false, scale: 0, alpha: 0, landed: false };
    }
    if (local >= STAR_POP_MS) {
      return { visible: true, scale: 1, alpha: 1, landed: true };
    }
    const u = local / STAR_POP_MS;
    return { visible: true, scale: 0.2 + 1.3 * easeOutBack2(u) - 0.5 * u, alpha: clamp012(u * 2), landed: false };
  }
  function starPopTotalMs(count) {
    return STAR_POP_DELAY_MS + Math.max(0, count - 1) * STAR_POP_STEP_MS + STAR_POP_MS;
  }
  function starPath(ctx, cx, cy, r) {
    const inner = r * 0.48;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rr = i % 2 === 0 ? r : inner;
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  }
  function drawCandyStar(ctx, cx, cy, r, filled) {
    ctx.save();
    ctx.lineJoin = "round";
    starPath(ctx, cx, cy + r * 0.08, r);
    ctx.fillStyle = "rgba(90, 40, 70, 0.22)";
    ctx.fill();
    starPath(ctx, cx, cy, r);
    if (filled) {
      const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      g.addColorStop(0, "#fff3bf");
      g.addColorStop(0.45, "#ffd43b");
      g.addColorStop(1, "#f59f00");
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = "rgba(222, 226, 230, 0.95)";
    }
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.strokeStyle = filled ? "#ffffff" : "rgba(255,255,255,0.9)";
    ctx.stroke();
    if (filled) {
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.22, cy - r * 0.28, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function bannerPalette(kind) {
    switch (kind) {
      case "goal":
        return { top: "#b2f2bb", bottom: "#37b24d", ink: "#ffffff", edge: "#2b8a3e" };
      case "bonus":
        return { top: "#ffe066", bottom: "#f76707", ink: "#ffffff", edge: "#d9480f" };
      case "low_moves":
      case "mahjong_fail":
        return { top: "#ffa8a8", bottom: "#e03131", ink: "#ffffff", edge: "#c92a2a" };
      case "mahjong_intro":
      case "intro":
      default:
        return { top: "#d0bfff", bottom: "#7048e8", ink: "#ffffff", edge: "#5f3dc4" };
    }
  }

  // src/core/utils/lobbyNav.ts
  var LOBBY_GEAR_SIZE = 34;
  var LOBBY_SIDE_ACTION_H = 26;
  var LOBBY_SIDE_ACTION_GAP = 5;
  var LOBBY_SIDE_ACTION_X = 10;
  var LOBBY_SIDE_ACTION_MIN_W = 72;
  var LOBBY_SIDE_ACTION_MAX_W = 86;
  var LOBBY_MAHJONG_ENTRY_ABS_MIN_PX = 48;
  var LOBBY_MAHJONG_ENTRY_TARGET_PX = 104;
  var LOBBY_MAHJONG_ENTRY_MAX_PX = 126;
  var LOBBY_MAHJONG_ENTRY_WIDTH_OF_SCREEN = 0.3;
  var LOBBY_MAHJONG_ENTRY_LADDER_GAP = 5;
  var LOBBY_MAHJONG_ENTRY_WIDTH_BOOST_PX = 6;
  var LOBBY_MAHJONG_ENTRY_ABOVE_SETTINGS_GAP = 6;
  var LOBBY_SIDE_ACTION_FONT = 11;
  var LOBBY_SIDE_ACTION_TOP_PAD = -6;
  var LOBBY_GEAR_X = 12;
  var LOBBY_TITLE_BOTTOM_RATIO = 142 / 1024;
  var LOBBY_NAV_CHIP_H = 36;
  var LOBBY_NAV_CHIP_MIN_W = 68;
  var LOBBY_NAV_HIT_PAD = 16;
  var LOBBY_DAILY_BAR_LABEL = "\u6BCF\u65E5\u4EFB\u52A1 \xB7 {n} \u4E2A\u5956\u52B1\u5F85\u9886\u53D6";
  var LOBBY_SIDE_ACTIONS = [
    { id: "invite", label: "\u9080\u8BF7\u597D\u53CB" },
    { id: "daily_open", label: "\u6BCF\u65E5\u4EFB\u52A1" },
    { id: "leaderboard", label: "\u6392\u884C\u699C" },
    { id: "howto", label: "\u600E\u4E48\u73A9" }
  ];
  function lobbySideActionsTop(statusBarHeight, _coverDy, _coverDh) {
    return Math.max(2, statusBarHeight + LOBBY_SIDE_ACTION_TOP_PAD);
  }
  function layoutLobbyGear(chipY, chipH = LOBBY_NAV_CHIP_H) {
    return {
      id: "settings",
      x: LOBBY_GEAR_X,
      y: chipY + Math.max(0, Math.floor((chipH - LOBBY_GEAR_SIZE) / 2)),
      w: LOBBY_GEAR_SIZE,
      h: LOBBY_GEAR_SIZE
    };
  }
  function layoutLobbySideActions(top, screenWidth) {
    const w = Math.min(
      LOBBY_SIDE_ACTION_MAX_W,
      Math.max(LOBBY_SIDE_ACTION_MIN_W, Math.floor(screenWidth * 0.2))
    );
    let y = top;
    return LOBBY_SIDE_ACTIONS.map((item) => {
      const frame = {
        ...item,
        x: LOBBY_SIDE_ACTION_X,
        y,
        w,
        h: LOBBY_SIDE_ACTION_H
      };
      y += frame.h + LOBBY_SIDE_ACTION_GAP;
      return frame;
    });
  }
  function lobbyNavBottomGap(bannerReserve, safeBottom) {
    const banner = Math.max(0, bannerReserve);
    const safe = Math.max(0, safeBottom);
    if (banner > 0) {
      return 12 + banner;
    }
    return Math.max(24, safe + 14);
  }
  function layoutLobbyBottom(input) {
    const side = 12;
    const gap = 12;
    const chipH = LOBBY_NAV_CHIP_H;
    const bottom = lobbyNavBottomGap(input.bannerReserve, input.safeBottom);
    const chipY = input.height - chipH - bottom;
    const settings = layoutLobbyGear(chipY, chipH);
    const labels = [
      { id: "recommend", label: "\u63A8\u8350" },
      { id: "club", label: "\u5708\u5B50" }
    ];
    const chipW = Math.min(
      108,
      Math.max(LOBBY_NAV_CHIP_MIN_W, Math.floor(input.width * 0.26))
    );
    const rowW = labels.length * chipW + (labels.length - 1) * gap;
    const gearRight = settings.x + settings.w + gap;
    const rowX = Math.max(gearRight, Math.floor((input.width - rowW) / 2));
    const chips = labels.map((item, index) => ({
      ...item,
      x: rowX + index * (chipW + gap),
      y: chipY,
      w: chipW,
      h: chipH
    }));
    const claimable = Math.max(0, Math.floor(input.dailyClaimable) || 0);
    const claimH = 36;
    const claim = claimable > 0 ? {
      id: "daily_open",
      label: LOBBY_DAILY_BAR_LABEL.replace("{n}", String(claimable)),
      x: side,
      y: chipY - gap - claimH,
      w: input.width - side * 2,
      h: claimH
    } : null;
    return {
      chips,
      claim,
      settings,
      contentTop: claim ? claim.y : chipY
    };
  }

  // src/core/utils/foregroundGate.ts
  var FOREGROUND_HIDE_DEBOUNCE_MS = 120;
  var ForegroundGate = class {
    constructor(hooks) {
      this.hidden = false;
      this.overlayDepth = 0;
      this.hideTimer = 0;
      this.ignoreHideUntil = 0;
      this.hooks = hooks;
    }
    isHidden() {
      return this.hidden;
    }
    hasOverlay() {
      return this.overlayDepth > 0;
    }
    /** 原生横幅刚创建时，短时间忽略 onHide，避免大厅一出广告就黑屏。 */
    holdNativeChrome(ms = 1600) {
      const until = this.hooks.now() + Math.max(0, ms);
      if (until > this.ignoreHideUntil) {
        this.ignoreHideUntil = until;
      }
    }
    /**
     * 游戏圈按钮已点下：立刻停画布，不要等 onHide，也不要被横幅 hold 挡住。
     * 圈子原生页要 1～2 秒才起来，这期间 JS 还在画就会弹出「微信无响应」。
     */
    forcePause() {
      this.cancelHideTimer();
      if (this.overlayDepth > 0 || this.hidden) {
        return;
      }
      this.hidden = true;
      this.hooks.pause();
    }
    /** 激励视频 / 插屏：自己先停画布，后续假 onHide 不再处理。 */
    enterOverlay() {
      this.overlayDepth += 1;
      this.cancelHideTimer();
      if (!this.hidden) {
        this.hidden = true;
        this.hooks.pause();
      }
    }
    leaveOverlay() {
      this.finishOverlay("overlay-end");
    }
    /** show() 立刻失败（频控 2001 / 未就绪）：不要按关广告去做画布重建。 */
    abortOverlay() {
      this.finishOverlay("overlay-abort");
    }
    onHide() {
      if (this.overlayDepth > 0 || this.hidden) {
        return;
      }
      if (this.hooks.now() < this.ignoreHideUntil) {
        return;
      }
      this.cancelHideTimer();
      this.hideTimer = this.hooks.schedule(() => {
        this.hideTimer = 0;
        if (this.overlayDepth > 0 || this.hidden) {
          return;
        }
        this.hidden = true;
        this.hooks.pause();
      }, FOREGROUND_HIDE_DEBOUNCE_MS);
    }
    onShow() {
      const hadPendingHide = this.hideTimer !== 0;
      this.cancelHideTimer();
      if (this.overlayDepth > 0) {
        return;
      }
      if (!this.hidden && !hadPendingHide) {
        return;
      }
      this.hidden = false;
      this.hooks.resume("show");
    }
    dispose() {
      this.cancelHideTimer();
      this.overlayDepth = 0;
      this.hidden = false;
    }
    finishOverlay(reason) {
      this.overlayDepth = Math.max(0, this.overlayDepth - 1);
      if (this.overlayDepth > 0) {
        return;
      }
      this.hidden = false;
      this.hooks.resume(reason);
    }
    cancelHideTimer() {
      if (!this.hideTimer) {
        return;
      }
      this.hooks.cancel(this.hideTimer);
      this.hideTimer = 0;
    }
  };

  // src/core/utils/gameRecommend.ts
  var GAME_RECOMMEND_OPENLINK = "TWFRCqV5WeM2AkMXhKwJ03MhfPOieJfAsvXKUbWvQFQtLyyA5etMPabBehga950uzfZcH3Vi3QeEh41xRGEVFw";
  function canCreateGameRecommend() {
    try {
      return typeof wx !== "undefined" && typeof wx.createPageManager === "function";
    } catch (e) {
      return false;
    }
  }
  var GameRecommendLauncher = class {
    constructor() {
      this.manager = null;
      this.loadPromise = null;
    }
    async preload() {
      if (!canCreateGameRecommend()) {
        return false;
      }
      if (this.loadPromise) {
        return this.loadPromise;
      }
      this.loadPromise = this.loadNow();
      return this.loadPromise;
    }
    async show() {
      if (!canCreateGameRecommend()) {
        return "unsupported";
      }
      try {
        const ok = await this.preload();
        if (!ok || !this.manager) {
          return "error";
        }
        await this.manager.show({ openlink: GAME_RECOMMEND_OPENLINK });
        return "shown";
      } catch (e) {
        this.reset();
        return "error";
      }
    }
    dispose() {
      var _a, _b;
      try {
        (_b = (_a = this.manager) == null ? void 0 : _a.destroy) == null ? void 0 : _b.call(_a);
      } catch (e) {
      }
      this.reset();
    }
    reset() {
      this.manager = null;
      this.loadPromise = null;
    }
    async loadNow() {
      try {
        const manager = wx.createPageManager();
        await manager.load({ openlink: GAME_RECOMMEND_OPENLINK });
        this.manager = manager;
        return true;
      } catch (e) {
        this.reset();
        return false;
      }
    }
  };

  // src/core/utils/adForeground.ts
  function shouldRestoreCanvasSurface(args) {
    if (args.desktopIde || !args.forceSurface) {
      return false;
    }
    return true;
  }
  function adOverlaySettleMs(desktopIde) {
    return desktopIde ? 50 : 480;
  }
  var AD_OVERLAY_ABORT_MS = 80;
  function shouldAbortAdOverlay(elapsedMs) {
    return Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < AD_OVERLAY_ABORT_MS;
  }
  function adInputMuteMs(desktopIde) {
    return desktopIde ? 160 : 800;
  }
  function shouldResumeBgm(args) {
    return args.bgmStarted && !args.muted && (args.wasHidden || args.longAway);
  }
  function shouldFollowupRestoreCanvas(canvasWidth, expectedWidth) {
    if (!Number.isFinite(canvasWidth) || !Number.isFinite(expectedWidth)) {
      return true;
    }
    if (expectedWidth < 1) {
      return true;
    }
    return canvasWidth !== expectedWidth;
  }
  function afterAdClosed(desktopIde) {
    return {
      restoreCanvas: shouldRestoreCanvasSurface({
        desktopIde,
        forceSurface: true
      }),
      settleMs: adOverlaySettleMs(desktopIde),
      muteMs: adInputMuteMs(desktopIde),
      kickLoop: true,
      keepPlayable: true
    };
  }

  // src/core/utils/perfBudget.ts
  function juiceSparkCount(cheapFx, waveIndex) {
    const wave = Number.isFinite(waveIndex) ? Math.max(0, waveIndex) : 0;
    if (cheapFx) {
      return 3;
    }
    return 10 + Math.min(6, wave * 2);
  }
  function crushSparkCount(cheapFx, cleared) {
    const n = Number.isFinite(cleared) ? Math.max(0, cleared) : 0;
    if (cheapFx) {
      return Math.min(8, 4 + n);
    }
    return Math.min(28, 10 + n * 3);
  }
  function cottonFluffCount(cheapFx) {
    return cheapFx ? 4 : 14;
  }
  function timedListCap(kind, cheapFx) {
    if (kind === "bursts") {
      return cheapFx ? 8 : 24;
    }
    if (kind === "scores") {
      return cheapFx ? 6 : 16;
    }
    return cheapFx ? 18 : 72;
  }
  function compactTimed(list, now, cap) {
    const nowMs = Number.isFinite(now) ? now : 0;
    const limit = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0;
    let write = 0;
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (nowMs - item.startMs < item.durationMs) {
        list[write] = item;
        write += 1;
      }
    }
    list.length = write;
    if (list.length > limit) {
      list.splice(0, list.length - limit);
    }
  }
  var IDLE_STOP_MS = 1800;
  var AMBIENT_IDLE_MS = Number.POSITIVE_INFINITY;
  var DESKTOP_IDLE_STOP_MS = 6e3;
  var FRAME_ERROR_LIMIT = 3;
  function resolveRenderIdleStopMs(args) {
    if (args.desktopIde) {
      return DESKTOP_IDLE_STOP_MS;
    }
    if (args.ambientFx) {
      return AMBIENT_IDLE_MS;
    }
    return IDLE_STOP_MS;
  }
  function resolveNextFrameDelayMs(args) {
    const base = typeof args.baseDelayMs === "number" && Number.isFinite(args.baseDelayMs) ? Math.max(16, args.baseDelayMs) : 33;
    if (args.animating) {
      return base;
    }
    return args.desktopIde ? Math.max(base, 80) : Math.max(base, 90);
  }
  function shouldKeepRenderLoop(args) {
    if (args.animating) {
      return true;
    }
    const last = Number.isFinite(args.lastInteractMs) ? args.lastInteractMs : 0;
    const now = Number.isFinite(args.nowMs) ? args.nowMs : 0;
    const windowMs = typeof args.idleStopMs === "number" && !Number.isNaN(args.idleStopMs) ? Math.max(0, args.idleStopMs) : IDLE_STOP_MS;
    if (!Number.isFinite(windowMs)) {
      return true;
    }
    return now - last < windowMs;
  }
  function shouldBackoffAfterFrameErrors(errorCount) {
    if (!Number.isFinite(errorCount) || errorCount < 0) {
      return false;
    }
    return errorCount >= FRAME_ERROR_LIMIT;
  }

  // src/presentation/wechat/SharePoster.ts
  var SHARE_POSTER_WIDTH = 750;
  var SHARE_POSTER_HEIGHT = 1200;
  function paintSharePoster(ctx, width, height, images) {
    ctx.clearRect(0, 0, width, height);
    const artH = Math.floor(height * 0.62);
    drawCover(ctx, images.cover, width, artH);
    const fade = ctx.createLinearGradient(0, artH - 90, 0, artH);
    fade.addColorStop(0, "rgba(255, 236, 245, 0)");
    fade.addColorStop(1, "#fff5fb");
    ctx.fillStyle = fade;
    ctx.fillRect(0, artH - 90, width, 90);
    ctx.fillStyle = "#fff5fb";
    ctx.fillRect(0, artH, width, height - artH);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(width * 0.072)}px sans-serif`;
    ctx.fillStyle = "#c2255c";
    fillCenteredSpaced(ctx, "\u840C\u5BA0\u7C89\u788E\u6D88", width / 2, artH - 56, 6);
    ctx.font = `bold ${Math.round(width * 0.032)}px sans-serif`;
    ctx.fillStyle = "#a61e4d";
    fillCenteredSpaced(ctx, "\u95EF\u5173\u6D88\u9664 \xB7 \u53EF\u7231\u5C0F\u52A8\u7269", width / 2, artH - 18, 4);
    const qrSize = Math.min(280, Math.floor(width * 0.42));
    const cardW = qrSize + 72;
    const cardH = qrSize + 118;
    const cardX = (width - cardW) / 2;
    const cardY = artH + Math.max(18, (height - artH - cardH) / 2 - 8);
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardGrad.addColorStop(0, "#ffffff");
    cardGrad.addColorStop(1, "#ffe8f3");
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 170, 210, 0.95)";
    ctx.lineWidth = 4;
    ctx.stroke();
    const qrX = cardX + (cardW - qrSize) / 2;
    const qrY = cardY + 28;
    roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    if (images.qr && (images.qr.width || 0) > 0) {
      ctx.drawImage(images.qr, qrX, qrY, qrSize, qrSize);
    } else {
      ctx.fillStyle = "#f1f3f5";
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = "#868e96";
      ctx.font = `bold ${Math.round(qrSize * 0.08)}px sans-serif`;
      ctx.fillText("\u5FAE\u4FE1\u641C\u7D22", qrX + qrSize / 2, qrY + qrSize / 2 - 10);
      ctx.fillText("\u840C\u5BA0\u7C89\u788E\u6D88", qrX + qrSize / 2, qrY + qrSize / 2 + 16);
    }
    ctx.fillStyle = "#c2255c";
    ctx.font = `bold ${Math.round(width * 0.036)}px sans-serif`;
    fillCenteredSpaced(ctx, "\u5FAE\u4FE1\u626B\u7801 \u4E00\u8D77\u6D88\u840C\u5BA0", width / 2, cardY + cardH - 36, 3);
  }
  function fillCenteredSpaced(ctx, text, cx, cy, extra) {
    var _a;
    const chars = [...text];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((sum, w) => sum + w, 0) + extra * Math.max(0, chars.length - 1);
    let x = cx - total / 2;
    const prevAlign = ctx.textAlign;
    ctx.textAlign = "left";
    for (let i = 0; i < chars.length; i += 1) {
      ctx.fillText(chars[i], x, cy);
      x += ((_a = widths[i]) != null ? _a : 0) + extra;
    }
    ctx.textAlign = prevAlign;
  }
  function drawCover(ctx, img, width, height) {
    if (!img || (img.width || 0) <= 0) {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#9ed4fb");
      g.addColorStop(1, "#ffe0ef");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      return;
    }
    const iw = Math.max(1, img.width);
    const ih = Math.max(1, img.height);
    const cover = Math.max(width / iw, height / ih);
    const dw = iw * cover;
    const dh = ih * cover;
    const dx = (width - dw) / 2;
    const dy = (height - dh) * 0.42;
    ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
  }
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  // src/presentation/mahjong/MahjongPlayLayoutMetrics.ts
  var MAHJONG_PLAY_BACK_HOME_W = 58;
  var MAHJONG_PLAY_BACK_HOME_H = 28;
  var MAHJONG_PLAY_BACK_HOME_X = 10;
  var MAHJONG_PLAY_HEADER_BAR_H = 32;
  function mahjongPlayBackHomeFrame(safeTop) {
    const y = safeTop + 4 + (MAHJONG_PLAY_HEADER_BAR_H - MAHJONG_PLAY_BACK_HOME_H) / 2;
    return {
      x: MAHJONG_PLAY_BACK_HOME_X,
      y,
      w: MAHJONG_PLAY_BACK_HOME_W,
      h: MAHJONG_PLAY_BACK_HOME_H
    };
  }
  function mahjongPlayHeaderLeftReserve() {
    return MAHJONG_PLAY_BACK_HOME_X + MAHJONG_PLAY_BACK_HOME_W + 8;
  }
  var MAHJONG_TOOL_LEFT_RESERVE_RATIO = 0.3;
  var MAHJONG_TOOL_AFTER_PET_GAP = 14;
  function mahjongPlayMetrics(width, height) {
    const pad = 10;
    const safeTop = Math.max(44, height * 0.055);
    const headerBottom = safeTop + 48;
    const slotH = Math.min(52, width * 0.124);
    const slotW = (width - pad * 2 - 6 * 5) / 7;
    const toolD = Math.min(50, width * 0.118);
    const toolLabelSpace = 11;
    const toolY = height - toolD - toolLabelSpace - Math.max(12, height * 0.02);
    const slotY = toolY - slotH - 38;
    const pileTop = headerBottom + 6;
    const pileBottom = slotY - 10;
    return {
      pad,
      safeTop,
      headerBottom,
      pileTop,
      pileBottom,
      slotY,
      slotW,
      slotH,
      toolY,
      toolD
    };
  }
  function mahjongSlotTileRect(width, height, slotIndex) {
    const m = mahjongPlayMetrics(width, height);
    const x = m.pad + slotIndex * (m.slotW + 5) + 3;
    const y = m.slotY + 3;
    return { x, y, w: m.slotW - 6, h: m.slotH - 6 };
  }
  var TOOL_IDS = ["move_out", "gather", "shuffle", "reveal"];
  function mahjongToolButtonLayout(width, height) {
    const m = mahjongPlayMetrics(width, height);
    const gap = 4;
    const d = m.toolD;
    const clusterW = TOOL_IDS.length * d + (TOOL_IDS.length - 1) * gap;
    const leftLimit = Math.floor(width * MAHJONG_TOOL_LEFT_RESERVE_RATIO);
    let startX = leftLimit + MAHJONG_TOOL_AFTER_PET_GAP;
    const maxStart = width - m.pad - clusterW;
    if (startX > maxStart) {
      startX = maxStart;
    }
    return TOOL_IDS.map((tool, idx) => ({
      tool,
      x: startX + idx * (d + gap),
      y: m.toolY,
      w: d,
      h: d
    }));
  }

  // src/presentation/mahjong/MahjongPileLayout.ts
  var MAHJONG_PILE_REF_POSE_SCALE = 0.16;
  var MAHJONG_PILE_TILE_SIZE_FACTOR = 0.99;
  var MAHJONG_PILE_TILE_WIDTH_RATIO = 0.21;
  var MAHJONG_TILE_FACE_ASPECT = 120 / 88;
  function mahjongBlockShape(stand) {
    switch (stand) {
      case MAHJONG_STAND_EDGE_SHORT:
        return { topW: 0.86, topH: MAHJONG_TILE_FACE_ASPECT, ext: 0.2 };
      case MAHJONG_STAND_EDGE_LONG:
        return { topW: 1, topH: 0.32, ext: 0.88 };
      case MAHJONG_STAND_TILT:
        return { topW: 1, topH: MAHJONG_TILE_FACE_ASPECT, ext: 0.26 };
      case MAHJONG_STAND_UPRIGHT:
        return { topW: 1, topH: MAHJONG_TILE_FACE_ASPECT, ext: 0.3 };
      default:
        return { topW: 1, topH: MAHJONG_TILE_FACE_ASPECT, ext: 0.2 };
    }
  }
  function mahjongPileNormToCenter(n, halfSizeRatio) {
    const inset = Math.min(0.48, Math.max(0.04, halfSizeRatio));
    return inset + n * (1 - 2 * inset);
  }
  function mahjongPileTileWidth(screenWidth, poseScale) {
    const scale = poseScale / MAHJONG_PILE_REF_POSE_SCALE;
    return screenWidth * MAHJONG_PILE_TILE_WIDTH_RATIO * MAHJONG_PILE_TILE_SIZE_FACTOR * scale;
  }
  function pilePosesToHits(poses, width, height) {
    const m = mahjongPlayMetrics(width, height);
    const pad = 10;
    const pileTop = m.pileTop;
    const pileBottom = m.pileBottom;
    const areaW = width - pad * 2;
    const areaH = Math.max(80, pileBottom - pileTop);
    const hits = [];
    for (let index = 0; index < poses.length; index += 1) {
      const p = poses[index];
      const faceW = mahjongPileTileWidth(width, p.scale);
      const shape = mahjongBlockShape(p.stand);
      const w = faceW * shape.topW;
      const h = faceW * (shape.topH + shape.ext);
      const cos = Math.abs(Math.cos(p.rot));
      const sin = Math.abs(Math.sin(p.rot));
      const boundW = w * cos + h * sin;
      const boundH = w * sin + h * cos;
      const cx = pad + mahjongPileNormToCenter(p.nx, boundW / 2 / Math.max(1, areaW)) * areaW;
      const cy = pileTop + mahjongPileNormToCenter(p.ny, boundH / 2 / Math.max(1, areaH)) * areaH;
      hits.push({
        index,
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
        rot: p.rot
      });
    }
    hits.sort((a, b) => {
      var _a, _b, _c, _d;
      const za = (_b = (_a = poses[a.index]) == null ? void 0 : _a.z) != null ? _b : a.index;
      const zb = (_d = (_c = poses[b.index]) == null ? void 0 : _c.z) != null ? _d : b.index;
      return za - zb;
    });
    return hits;
  }
  var pileLayoutCache = null;
  function clearMahjongPileLayoutCache() {
    pileLayoutCache = null;
  }
  function pilePosesToHitsCached(poses, width, height, layoutEpoch) {
    const key = `${width}x${height}:${layoutEpoch}:${poses.length}`;
    if ((pileLayoutCache == null ? void 0 : pileLayoutCache.key) === key) {
      return { hits: pileLayoutCache.hits, zMax: pileLayoutCache.zMax };
    }
    const hits = pilePosesToHits(poses, width, height);
    let zMax = 1;
    for (const p of poses) {
      zMax = Math.max(zMax, p.z);
    }
    pileLayoutCache = { key, hits, zMax };
    return pileLayoutCache;
  }

  // src/presentation/mahjong/MahjongTileRasterCache.ts
  var MAX_ENTRIES = 160;
  var cache = /* @__PURE__ */ new Map();
  var touchOrder = [];
  var rasterScaleMemo = 0;
  function clearMahjongTileRasterCache() {
    cache.clear();
    touchOrder.length = 0;
    rasterScaleMemo = 0;
  }
  function createOffscreenCanvas(width, height) {
    try {
      const wxApi2 = globalThis.wx;
      if (!(wxApi2 == null ? void 0 : wxApi2.createCanvas)) {
        return null;
      }
      const canvas = wxApi2.createCanvas();
      canvas.width = Math.max(1, Math.ceil(width));
      canvas.height = Math.max(1, Math.ceil(height));
      return canvas;
    } catch (e) {
      return null;
    }
  }
  function resolveRasterScale() {
    var _a, _b, _c;
    if (rasterScaleMemo > 0) {
      return rasterScaleMemo;
    }
    let scale = 1;
    try {
      const wxApi2 = globalThis.wx;
      const pr = (_c = (_b = (_a = wxApi2 == null ? void 0 : wxApi2.getSystemInfoSync) == null ? void 0 : _a.call(wxApi2)) == null ? void 0 : _b.pixelRatio) != null ? _c : 1;
      scale = pr >= 2 ? 2 : 1;
    } catch (e) {
      scale = 1;
    }
    rasterScaleMemo = scale;
    return scale;
  }
  function quantizeMahjongTileFaceW(faceW) {
    return Math.max(6, Math.round(faceW * 4) / 4);
  }
  function cacheKey(themeKey, type, stand, faceDown, faceW, scale) {
    return `${themeKey}|${type}|${stand}|${faceDown ? 1 : 0}|${faceW}|s${scale}`;
  }
  function touchKey(key) {
    const idx = touchOrder.indexOf(key);
    if (idx >= 0) {
      touchOrder.splice(idx, 1);
    }
    touchOrder.push(key);
    while (touchOrder.length > MAX_ENTRIES) {
      const evict = touchOrder.shift();
      if (evict) {
        cache.delete(evict);
      }
    }
  }
  function getMahjongTileRasterBlit(themeKey, type, stand, faceDown, faceW, lookup, rasterize) {
    const scale = resolveRasterScale();
    const qFaceW = quantizeMahjongTileFaceW(faceW);
    const key = cacheKey(themeKey, type, stand, faceDown, qFaceW, scale);
    const hit = cache.get(key);
    if (hit) {
      touchKey(key);
      return hit;
    }
    const pad = 3;
    const shape = mahjongBlockShape(stand);
    const boundsW = qFaceW * shape.topW;
    const boundsH = qFaceW * (shape.topH + shape.ext);
    const logicalW = boundsW + pad * 2;
    const logicalH = boundsH + pad * 2;
    const canvas = createOffscreenCanvas(logicalW * scale, logicalH * scale);
    if (!canvas) {
      return null;
    }
    const off = canvas.getContext("2d");
    if (!off) {
      return null;
    }
    off.clearRect(0, 0, canvas.width, canvas.height);
    off.save();
    off.scale(scale, scale);
    off.translate(logicalW / 2, logicalH / 2);
    rasterize(off, type, stand, faceDown, qFaceW, lookup);
    off.restore();
    const entry = {
      themeKey,
      canvas,
      w: logicalW,
      h: logicalH
    };
    cache.set(key, entry);
    touchKey(key);
    return entry;
  }
  function mahjongTileRasterEligible(opts) {
    var _a, _b;
    if (((_a = opts.alpha) != null ? _a : 1) !== 1) {
      return false;
    }
    if (((_b = opts.lift) != null ? _b : 0) !== 0) {
      return false;
    }
    if (!opts.rasterThemeKey) {
      return false;
    }
    return true;
  }
  function warmMahjongTileRasterCache(themeKey, typeCount, lookup, rasterize, screenWidth = 390) {
    if (!lookup || !themeKey) {
      return;
    }
    const faceW = mahjongPileTileWidth(screenWidth, MAHJONG_PILE_REF_POSE_SCALE);
    const types = Math.min(Math.max(1, typeCount), 10);
    const stands = [
      MAHJONG_STAND_FLAT,
      MAHJONG_STAND_TILT,
      MAHJONG_STAND_EDGE_SHORT,
      MAHJONG_STAND_EDGE_LONG
    ];
    for (let type = 0; type < types; type += 1) {
      for (const stand of stands) {
        getMahjongTileRasterBlit(themeKey, type, stand, false, faceW, lookup, rasterize);
        getMahjongTileRasterBlit(themeKey, type, stand, true, faceW, lookup, rasterize);
      }
    }
  }

  // src/presentation/mahjong/MahjongTileShellAssets.ts
  var MAHJONG_SHELL_ASSET_VER = 3;
  var MAHJONG_SHELL_SRC = {
    front: "assets/main/mahjong/shell_front_88x120.png",
    frontWhite: "assets/main/mahjong/shell_front_white_88x120.png",
    /** 主线萌宠「蓝兔」，与三消 TileKind.Blue 同款 */
    frontPetRabbit: "assets/main/tiles/blue.png",
    top: "assets/main/mahjong/shell_top_88x40.png",
    bottom: "assets/main/mahjong/shell_bottom_88x40.png",
    left: "assets/main/mahjong/shell_left_40x120.png",
    right: "assets/main/mahjong/shell_right_40x120.png",
    back: "assets/main/mahjong/shell_back_88x120.png"
  };
  var shellPack;
  var shellMissingKeys = [];
  function setMahjongTileShellPack(pack) {
    shellPack = pack;
    if (pack) {
      shellMissingKeys = [];
    }
  }
  function getMahjongShellMissingKeys() {
    return shellMissingKeys;
  }
  function isMahjongTileShellReady() {
    return shellPack !== void 0;
  }
  function applyMahjongShellImages(parts) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const frontWhite = (_a = parts.frontWhite) != null ? _a : void 0;
    const frontPetRabbit = (_b = parts.frontPetRabbit) != null ? _b : void 0;
    const top = (_c = parts.top) != null ? _c : void 0;
    const bottom = (_d = parts.bottom) != null ? _d : void 0;
    const left = (_e = parts.left) != null ? _e : void 0;
    const right = (_f = parts.right) != null ? _f : void 0;
    const back = (_g = parts.back) != null ? _g : void 0;
    const missing = [];
    if (!frontWhite) {
      missing.push("frontWhite");
    }
    if (!frontPetRabbit) {
      missing.push("frontPetRabbit");
    }
    if (!top) {
      missing.push("top");
    }
    if (!bottom) {
      missing.push("bottom");
    }
    if (!left) {
      missing.push("left");
    }
    if (!right) {
      missing.push("right");
    }
    if (!back) {
      missing.push("back");
    }
    if (missing.length > 0) {
      shellMissingKeys = missing;
      if (back) {
        setMahjongTileBackPattern(back);
      }
      return false;
    }
    setMahjongTileShellPack({
      front: (_h = parts.front) != null ? _h : frontWhite,
      frontWhite,
      frontPetRabbit,
      top,
      bottom,
      left,
      right,
      back
    });
    setMahjongTileBackPattern(back);
    return true;
  }
  function getMahjongTileShellPack() {
    return shellPack;
  }
  var MAHJONG_TILE_BACK_SRC = MAHJONG_SHELL_SRC.back;
  var backFacePattern;
  function setMahjongTileBackPattern(img) {
    backFacePattern = img;
  }

  // src/presentation/mahjong/MahjongTileRender.ts
  var TILE_COLORS = ["#ff6b6b", "#4dabf7", "#51cf66", "#ffd43b", "#cc5de8", "#ff922b", "#20c997", "#868e96"];
  var C = {
    faceTop: "#ffffff",
    faceBottom: "#faf6ee",
    sideLight: "#f3efe6",
    sideDeep: "#e6e0d4",
    green: "#62d48a",
    greenLight: "#9aebb8",
    greenDeep: "#42c06e",
    edgeLine: "rgba(120, 110, 90, 0.16)"
  };
  function roundRect2(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
  function fillEllipse(ctx, cx, cy, rx, ry, rot) {
    ctx.beginPath();
    if (ctx.ellipse) {
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    } else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(rx, ry);
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
    }
    ctx.fill();
  }
  function drawImageContain(ctx, img, x, y, w, h) {
    var _a, _b;
    const src = img;
    const iw = (_a = src.width) != null ? _a : w;
    const ih = (_b = src.height) != null ? _b : h;
    if (iw <= 0 || ih <= 0) {
      ctx.drawImage(img, x, y, w, h);
      return;
    }
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function drawImageCover(ctx, img, x, y, w, h) {
    var _a, _b;
    const src = img;
    const iw = (_a = src.width) != null ? _a : w;
    const ih = (_b = src.height) != null ? _b : h;
    if (iw <= 0 || ih <= 0) {
      ctx.drawImage(img, x, y, w, h);
      return;
    }
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  }
  function petImage(lookup, type) {
    var _a, _b;
    return (_b = lookup == null ? void 0 : lookup(type)) != null ? _b : (_a = getMahjongTileShellPack()) == null ? void 0 : _a.frontPetRabbit;
  }
  function drawPetOrSwatch(ctx, lookup, type, x, y, w, h, mode = "cover") {
    var _a;
    const img = petImage(lookup, type);
    if (img) {
      if (mode === "cover") {
        drawImageCover(ctx, img, x, y, w, h);
      } else {
        drawImageContain(ctx, img, x, y, w, h);
      }
      return;
    }
    ctx.fillStyle = (_a = TILE_COLORS[type % TILE_COLORS.length]) != null ? _a : "#adb5bd";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawBlockBody(ctx, x, y, w, topH, ext, r, greenFrom, greenTo, extTint = "green") {
    const h = topH + ext;
    const side = ctx.createLinearGradient(0, y + topH - r, 0, y + h);
    side.addColorStop(0, C.sideLight);
    side.addColorStop(1, C.sideDeep);
    ctx.fillStyle = side;
    roundRect2(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.save();
    roundRect2(ctx, x, y, w, h, r);
    ctx.clip();
    if (greenTo > greenFrom) {
      const gy0 = y + topH + ext * greenFrom - (greenFrom <= 0 ? r : 0);
      const gy1 = y + topH + ext * greenTo;
      const g = ctx.createLinearGradient(0, gy0, 0, gy1);
      if (extTint === "jade") {
        g.addColorStop(0, C.faceTop);
        g.addColorStop(0.4, C.faceBottom);
        g.addColorStop(1, "#ebe3d4");
      } else {
        g.addColorStop(0, C.greenLight);
        g.addColorStop(0.42, C.green);
        g.addColorStop(1, C.greenDeep);
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, gy0, w, gy1 - gy0);
      if (greenFrom <= 0.02) {
        const seamH = Math.max(0.8, ext * 0.12);
        const seam = ctx.createLinearGradient(0, y + topH - seamH * 0.3, 0, y + topH + seamH);
        seam.addColorStop(0, "rgba(255,255,255,0.5)");
        seam.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = seam;
        ctx.fillRect(x, y + topH - seamH * 0.3, w, seamH * 1.3);
      }
    }
    const sideShade = ctx.createLinearGradient(x, 0, x + w, 0);
    sideShade.addColorStop(0, "rgba(255,255,255,0.22)");
    sideShade.addColorStop(0.5, "rgba(255,255,255,0)");
    sideShade.addColorStop(1, "rgba(40, 32, 18, 0.1)");
    ctx.fillStyle = sideShade;
    ctx.fillRect(x, y + topH - r * 0.5, w, ext + r * 0.5);
    if (ext > 0) {
      const rimH = Math.max(1, ext * 0.35);
      const rim = ctx.createLinearGradient(0, y + h - rimH, 0, y + h);
      rim.addColorStop(0, "rgba(30, 70, 45, 0)");
      rim.addColorStop(
        1,
        extTint === "jade" ? "rgba(100, 88, 70, 0.14)" : "rgba(25, 55, 38, 0.22)"
      );
      ctx.fillStyle = rim;
      ctx.fillRect(x, y + h - rimH, w, rimH);
    }
    ctx.restore();
    ctx.strokeStyle = C.edgeLine;
    ctx.lineWidth = Math.max(0.65, w * 0.013);
    roundRect2(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = Math.max(0.45, w * 8e-3);
    roundRect2(ctx, x + w * 0.01, y + w * 0.01, w - w * 0.02, h - w * 0.02, r - w * 0.01);
    ctx.stroke();
  }
  function drawFaceThicknessLedge(ctx, x, y, w, topH, ext, r) {
    if (ext <= 0) {
      return;
    }
    ctx.save();
    roundRect2(ctx, x, y, w, topH + ext, r);
    ctx.clip();
    const ly = y + topH - Math.max(0.6, w * 0.01);
    const lh = Math.max(1.4, ext * 0.28);
    const ledge = ctx.createLinearGradient(0, ly, 0, ly + lh);
    ledge.addColorStop(0, "rgba(70, 62, 48, 0.16)");
    ledge.addColorStop(0.4, "rgba(255,255,255,0.32)");
    ledge.addColorStop(1, "rgba(110, 98, 78, 0.1)");
    ctx.fillStyle = ledge;
    ctx.fillRect(x + w * 0.05, ly, w * 0.9, lh);
    const ao = ctx.createLinearGradient(0, ly + lh * 0.3, 0, ly + lh + ext * 0.25);
    ao.addColorStop(0, "rgba(50, 42, 30, 0)");
    ao.addColorStop(1, "rgba(50, 42, 30, 0.1)");
    ctx.fillStyle = ao;
    ctx.fillRect(x, ly, w, ext * 0.35);
    ctx.restore();
  }
  function drawFaceTactileFinish(ctx, x, y, w, h, r, alpha) {
    ctx.save();
    roundRect2(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.globalAlpha = alpha;
    const sweep = ctx.createLinearGradient(x, y, x + w * 0.72, y + h * 0.78);
    sweep.addColorStop(0, "rgba(255,255,255,0.38)");
    sweep.addColorStop(0.45, "rgba(255,255,255,0.06)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(x, y, w, h);
    const ao = ctx.createRadialGradient(
      x + w * 0.9,
      y + h * 0.92,
      0,
      x + w * 0.9,
      y + h * 0.92,
      w * 0.62
    );
    ao.addColorStop(0, "rgba(45, 38, 28, 0.14)");
    ao.addColorStop(1, "rgba(45, 38, 28, 0)");
    ctx.fillStyle = ao;
    ctx.fillRect(x, y, w, h);
    const spec = ctx.createRadialGradient(
      x + w * 0.2,
      y + h * 0.16,
      0,
      x + w * 0.2,
      y + h * 0.16,
      w * 0.14
    );
    spec.addColorStop(0, "rgba(255,255,255,0.65)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spec;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  function drawWhiteTopFace(ctx, x, y, w, h, r) {
    const face = ctx.createLinearGradient(x, y, x + w * 0.38, y + h);
    face.addColorStop(0, C.faceTop);
    face.addColorStop(0.65, C.faceBottom);
    face.addColorStop(1, "#f2ebe0");
    ctx.fillStyle = face;
    roundRect2(ctx, x, y, w, h, r);
    ctx.fill();
    const gx = x + w * 0.28;
    const gy = y + h * 0.22;
    const gloss = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.68);
    gloss.addColorStop(0, "rgba(255,255,255,0.92)");
    gloss.addColorStop(0.4, "rgba(255,255,255,0.28)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    roundRect2(ctx, x, y, w, h, r);
    ctx.fill();
    const spec2 = ctx.createRadialGradient(
      x + w * 0.78,
      y + h * 0.12,
      0,
      x + w * 0.78,
      y + h * 0.12,
      w * 0.2
    );
    spec2.addColorStop(0, "rgba(255,255,255,0.35)");
    spec2.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spec2;
    roundRect2(ctx, x, y, w, h, r);
    ctx.fill();
  }
  function drawTopFaceBevel(ctx, x, y, w, h, r, alpha) {
    const lw = Math.max(0.75, w * 0.032);
    const bevel = ctx.createLinearGradient(x, y, x + w * 0.75, y + h);
    bevel.addColorStop(0, "rgba(255,255,255,0.96)");
    bevel.addColorStop(0.45, "rgba(255,255,255,0.45)");
    bevel.addColorStop(1, "rgba(130, 115, 88, 0.35)");
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = bevel;
    ctx.lineWidth = lw;
    roundRect2(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, r - lw / 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120, 108, 82, 0.22)";
    ctx.lineWidth = Math.max(0.55, w * 0.013);
    roundRect2(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  function drawGreenBackTop(ctx, x, y, w, h, r) {
    ctx.save();
    roundRect2(ctx, x, y, w, h, r);
    ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    g.addColorStop(0, C.greenLight);
    g.addColorStop(0.55, C.green);
    g.addColorStop(1, C.greenDeep);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const u = Math.min(w, h);
    if (h > w * 0.8) {
      drawPawEmblem(ctx, x + w / 2, y + h * 0.53, u * 0.2);
    }
    const gx = x + w * 0.3;
    const gy = y + h * 0.2;
    const gloss = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.65);
    gloss.addColorStop(0, "rgba(255,255,255,0.58)");
    gloss.addColorStop(0.55, "rgba(255,255,255,0.12)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y, w, h);
    drawFaceTactileFinish(ctx, x, y, w, h, r, 1);
    ctx.restore();
  }
  function drawPawEmblem(ctx, cx, cy, s) {
    const pads = [
      [-0.62, -0.62, 0.24],
      [-0.22, -0.92, 0.26],
      [0.22, -0.92, 0.26],
      [0.62, -0.62, 0.24]
    ];
    ctx.fillStyle = "rgba(120, 210, 155, 0.92)";
    fillEllipse(ctx, cx, cy + s * 0.15, s * 0.5, s * 0.4, 0);
    for (const [px, py, pr] of pads) {
      ctx.beginPath();
      ctx.arc(cx + px * s, cy + py * s, pr * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawFaceUpBlock(ctx, type, lookup, w, topH, ext, faceDown, alpha) {
    const x = -w / 2;
    const y = -(topH + ext) / 2;
    const r = w * 0.13;
    ctx.globalAlpha = alpha;
    if (faceDown) {
      drawBlockBody(ctx, x, y, w, topH, ext, r, 0, 0.45);
      drawGreenBackTop(ctx, x, y, w, topH, r);
    } else {
      drawBlockBody(ctx, x, y, w, topH, ext, r, 0.06, 1, "jade");
      drawWhiteTopFace(ctx, x, y, w, topH, r);
      drawFaceTactileFinish(ctx, x, y, w, topH, r, alpha);
      drawFaceThicknessLedge(ctx, x, y, w, topH, ext, r);
      const pad = w * 0.118;
      ctx.save();
      roundRect2(ctx, x + pad, y + pad, w - pad * 2, topH - pad * 2, r - pad);
      ctx.clip();
      drawPetOrSwatch(
        ctx,
        lookup,
        type,
        x + pad,
        y + pad,
        w - pad * 2,
        topH - pad * 2,
        "cover"
      );
      ctx.restore();
    }
    drawTopFaceBevel(ctx, x, y, w, topH, r, alpha);
  }
  function drawEdgeShortBlock(ctx, type, lookup, faceW, faceDown, alpha) {
    const shape = mahjongBlockShape(MAHJONG_STAND_EDGE_SHORT);
    const w = faceW * shape.topW;
    const topH = faceW * shape.topH;
    const ext = faceW * shape.ext;
    const x = -w / 2;
    const y = -(topH + ext) / 2;
    const r = w * 0.14;
    ctx.globalAlpha = alpha;
    drawBlockBody(ctx, x, y, w, topH, ext, r, 0, 0);
    const faceStripW = w * 0.66;
    const sideX = x + faceStripW;
    const sideW = w - faceStripW;
    const greenW = sideW * 0.42;
    ctx.save();
    roundRect2(ctx, x, y, w, topH, r);
    ctx.clip();
    const side = ctx.createLinearGradient(sideX, 0, x + w, 0);
    side.addColorStop(0, C.faceTop);
    side.addColorStop(1, C.sideLight);
    ctx.fillStyle = side;
    ctx.fillRect(sideX, y, sideW, topH);
    const gx = faceDown ? sideX : x + w - greenW;
    const g = ctx.createLinearGradient(gx, 0, gx + greenW, 0);
    g.addColorStop(0, faceDown ? C.greenDeep : C.greenLight);
    g.addColorStop(1, faceDown ? C.greenLight : C.greenDeep);
    ctx.fillStyle = g;
    ctx.fillRect(gx, y, greenW, topH);
    ctx.restore();
    if (faceDown) {
      drawGreenBackTop(ctx, x, y, faceStripW, topH, r);
    } else {
      const fx = x;
      const fy = y;
      const fw = faceStripW + r;
      drawWhiteTopFace(ctx, fx, fy, fw, topH, r);
      drawFaceTactileFinish(ctx, fx, fy, fw, topH, r, alpha);
      drawFaceThicknessLedge(ctx, x, y, w, topH, ext, r);
      const img = petImage(lookup, type);
      if (img) {
        ctx.save();
        ctx.translate(x + faceStripW / 2, y + topH / 2);
        ctx.scale(0.72, 1);
        const s = faceW * 0.74;
        drawImageContain(ctx, img, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    ctx.strokeStyle = "rgba(150, 140, 115, 0.35)";
    ctx.lineWidth = Math.max(0.5, w * 0.016);
    ctx.beginPath();
    ctx.moveTo(sideX, y + r * 0.3);
    ctx.lineTo(sideX, y + topH + ext - r * 0.3);
    ctx.stroke();
    drawTopFaceBevel(ctx, x, y, w, topH, r, alpha);
  }
  function drawEdgeLongBlock(ctx, type, lookup, faceW, faceDown, alpha) {
    const shape = mahjongBlockShape(MAHJONG_STAND_EDGE_LONG);
    const w = faceW * shape.topW;
    const topH = faceW * shape.topH;
    const ext = faceW * shape.ext;
    const x = -w / 2;
    const y = -(topH + ext) / 2;
    const r = w * 0.12;
    const h = topH + ext;
    ctx.globalAlpha = alpha;
    ctx.save();
    roundRect2(ctx, x, y, w, h, r);
    ctx.clip();
    if (faceDown) {
      drawGreenBackTop(ctx, x, y + topH, w, ext, 0);
    } else {
      const front = ctx.createLinearGradient(0, y + topH, 0, y + h);
      front.addColorStop(0, "#fcfaf4");
      front.addColorStop(1, "#f0ebe2");
      ctx.fillStyle = front;
      ctx.fillRect(x, y + topH, w, ext);
      const img = petImage(lookup, type);
      if (img) {
        ctx.save();
        ctx.translate(0, y + topH + ext * 0.5);
        ctx.scale(1, 0.7);
        const s = faceW * 0.72;
        drawImageContain(ctx, img, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    const edge = ctx.createLinearGradient(0, y, 0, y + topH);
    edge.addColorStop(0, C.faceTop);
    edge.addColorStop(1, C.sideLight);
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, w, topH);
    const stripH = topH * 0.42;
    const gy = faceDown ? y + topH - stripH : y;
    const g = ctx.createLinearGradient(0, gy, 0, gy + stripH);
    g.addColorStop(0, faceDown ? C.green : C.greenLight);
    g.addColorStop(1, faceDown ? C.greenDeep : C.green);
    ctx.fillStyle = g;
    ctx.fillRect(x, gy, w, stripH);
    ctx.restore();
    ctx.strokeStyle = "rgba(150, 140, 115, 0.35)";
    ctx.lineWidth = Math.max(0.5, w * 0.012);
    ctx.beginPath();
    ctx.moveTo(x + r * 0.3, y + topH);
    ctx.lineTo(x + w - r * 0.3, y + topH);
    ctx.stroke();
    drawTopFaceBevel(ctx, x, y, w, h, r, alpha);
  }
  function drawStandingMahjongTileBlocks(ctx, type, lookup, stand, faceW, faceDown, alpha) {
    const shape = mahjongBlockShape(stand);
    if (stand === MAHJONG_STAND_EDGE_SHORT) {
      drawEdgeShortBlock(ctx, type, lookup, faceW, faceDown, alpha);
      return { w: faceW * shape.topW, h: faceW * (shape.topH + shape.ext) };
    }
    if (stand === MAHJONG_STAND_EDGE_LONG) {
      drawEdgeLongBlock(ctx, type, lookup, faceW, faceDown, alpha);
      return { w: faceW * shape.topW, h: faceW * (shape.topH + shape.ext) };
    }
    drawFaceUpBlock(
      ctx,
      type,
      lookup,
      faceW,
      faceW * shape.topH,
      faceW * shape.ext,
      faceDown,
      alpha
    );
    return { w: faceW * shape.topW, h: faceW * (shape.topH + shape.ext) };
  }
  function drawStandingMahjongTile(ctx, x, y, w, h, rot, type, lookup, opts = {}) {
    var _a, _b, _c, _d, _e;
    const stand = (_a = opts.stand) != null ? _a : MAHJONG_STAND_FLAT;
    const shape = mahjongBlockShape(stand);
    const faceW = Math.min(w / shape.topW, h / (shape.topH + shape.ext));
    if (!(faceW > 0)) {
      return;
    }
    const alpha = (_b = opts.alpha) != null ? _b : 1;
    const faceDown = opts.faceDown === true;
    if (mahjongTileRasterEligible(opts)) {
      const rasterFaceW = quantizeMahjongTileFaceW((_c = opts.rasterFaceW) != null ? _c : faceW);
      const blit = getMahjongTileRasterBlit(
        opts.rasterThemeKey,
        type,
        stand,
        faceDown,
        rasterFaceW,
        lookup,
        (offCtx, t, st, fd, fw, lu) => drawStandingMahjongTileBlocks(offCtx, t, lu, st, fw, fd, 1)
      );
      if (blit) {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2 + ((_d = opts.lift) != null ? _d : 0));
        ctx.rotate(rot);
        const smooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        const quality = ctx.imageSmoothingQuality;
        if (quality !== void 0) {
          ctx.imageSmoothingQuality = "high";
        }
        const k = faceW / rasterFaceW;
        const bw = blit.w * k;
        const bh = blit.h * k;
        try {
          ctx.drawImage(blit.canvas, -bw / 2, -bh / 2, bw, bh);
        } catch (e) {
          drawStandingMahjongTileBlocks(ctx, type, lookup, stand, faceW, faceDown, alpha);
        }
        ctx.imageSmoothingEnabled = smooth;
        if (quality !== void 0) {
          ctx.imageSmoothingQuality = quality;
        }
        ctx.restore();
        return;
      }
    }
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 + ((_e = opts.lift) != null ? _e : 0));
    ctx.rotate(rot);
    drawStandingMahjongTileBlocks(ctx, type, lookup, stand, faceW, faceDown, alpha);
    ctx.restore();
  }

  // src/presentation/mahjong/MahjongCutePanel.ts
  var MJ_CARD_DEFAULT = {
    radius: 22,
    fillTop: "rgba(255,255,255,0.98)",
    fillBottom: "rgba(224, 248, 245, 0.97)",
    border: "rgba(56, 178, 172, 0.92)",
    borderWidth: 3,
    shadow: false,
    sparkle: true
  };
  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
  function mahjongCoverLayout(img, width, height, vBias = 0.52) {
    const iw = Math.max(1, img.width || width);
    const ih = Math.max(1, img.height || height);
    const cover = Math.max(width / iw, height / ih);
    const dw = iw * cover;
    const dh = ih * cover;
    const dx = (width - dw) * 0.5;
    const bias = Math.max(0, Math.min(1, vBias));
    const dy = (height - dh) * bias;
    return { dx, dy, dw, dh };
  }
  var MAHJONG_PLAY_LOBBY_SRC_TOP_RATIO = 0.14;
  function mahjongPlayLobbyCoverLayout(img, width, height, pileTop, pileBottom) {
    const iw = Math.max(1, img.width || width);
    const ih = Math.max(1, img.height || height);
    const sy = Math.floor(ih * MAHJONG_PLAY_LOBBY_SRC_TOP_RATIO);
    const sh = Math.max(1, ih - sy);
    const pileMidNorm = pileBottom > pileTop ? (pileTop + pileBottom) * 0.5 / Math.max(1, height) : 0.55;
    const vBias = Math.max(0.48, Math.min(0.74, 0.5 + pileMidNorm * 0.32));
    const cover = Math.max(width / iw, height / sh);
    const dw = iw * cover;
    const dh = sh * cover;
    const dx = (width - dw) * 0.5;
    const dy = (height - dh) * vBias;
    return { sx: 0, sy, sw: iw, sh, dx, dy, dw, dh };
  }
  function drawMahjongPlaySceneBackground(ctx, width, height, pileTop, pileBottom, bgImage, _slotY, bgShift = { dx: 0, dy: 0 }) {
    ctx.save();
    const bleed = 28;
    ctx.translate(bgShift.dx, bgShift.dy);
    ctx.fillStyle = "#b8ddd8";
    ctx.fillRect(-bleed, -bleed, width + bleed * 2, height + bleed * 2);
    if (bgImage) {
      try {
        const layout = mahjongPlayLobbyCoverLayout(bgImage, width, height, pileTop, pileBottom);
        ctx.drawImage(
          bgImage,
          layout.sx,
          layout.sy,
          layout.sw,
          layout.sh,
          layout.dx - bleed,
          layout.dy - bleed,
          layout.dw + bleed * 2,
          layout.dh + bleed * 2
        );
      } catch (e) {
      }
    }
    ctx.restore();
  }
  function drawMahjongModalVeil(ctx, width, height, strength = 0.48, tone = "teal") {
    drawResultSceneBackdrop(ctx, width, height, {
      veilAlpha: Math.min(1, strength / 0.48),
      tone
    });
  }
  function drawMahjongCuteCard(ctx, x, y, w, h, style = {}) {
    var _a;
    const s = { ...MJ_CARD_DEFAULT, ...style };
    const r = s.radius;
    if (s.shadow) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#1a4a44";
      roundRectPath(ctx, x + 3, y + 7, w, h, r);
      ctx.fill();
      ctx.restore();
    }
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, s.fillTop);
    grad.addColorStop(1, s.fillBottom);
    ctx.fillStyle = grad;
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.5;
    const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.45);
    gloss.addColorStop(0, "rgba(255,255,255,0.92)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    roundRectPath(ctx, x + 4, y + 3, w - 8, h * 0.4, Math.max(8, r - 6));
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = s.border;
    ctx.lineWidth = s.borderWidth;
    roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(4, r - 1));
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 6));
    ctx.stroke();
    if (s.sparkle) {
      const t = ((_a = s.nowMs) != null ? _a : 0) * 6e-3;
      const dots = [
        { dx: 18, dy: 16 },
        { dx: w - 20, dy: 18 },
        { dx: 22, dy: h - 18 },
        { dx: w - 24, dy: h - 20 }
      ];
      for (let i = 0; i < dots.length; i += 1) {
        const d = dots[i];
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t + i));
        ctx.save();
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = "#96f2d7";
        ctx.beginPath();
        ctx.arc(x + d.dx, y + d.dy, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  function layoutMahjongModalCard(width, height, cardW, cardH, footerH) {
    const x = (width - cardW) / 2;
    const y = (height - cardH) / 2;
    return {
      x,
      y,
      w: cardW,
      h: cardH,
      cx: x + cardW / 2,
      cy: y + cardH / 2,
      heroH: Math.max(120, cardH - footerH),
      footerH
    };
  }
  function drawMahjongToolNameLabel(ctx, text, anchorX, cy, align = "center") {
    ctx.save();
    ctx.font = "bold 9px sans-serif";
    const padX = 5;
    const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
    const h = 14;
    const x = align === "right" ? anchorX - w : anchorX - w / 2;
    const y = cy - h / 2;
    const r = h / 2;
    const body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, "rgba(255,255,255,0.98)");
    body.addColorStop(0.42, "rgba(245,252,250,0.96)");
    body.addColorStop(1, "rgba(196, 228, 220, 0.94)");
    ctx.fillStyle = body;
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ffffff";
    roundRectPath(ctx, x + 2, y + 1.5, w - 4, h * 0.38, Math.max(2, r - 3));
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.98)";
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.strokeStyle = "rgba(46, 138, 128, 0.45)";
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, r - 1);
    ctx.stroke();
    const tx = align === "right" ? anchorX - padX : anchorX;
    ctx.textAlign = align === "right" ? "right" : "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 9px sans-serif";
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeText(text, tx, cy);
    ctx.fillStyle = "#15524a";
    ctx.fillText(text, tx, cy);
    ctx.restore();
  }
  function drawMahjongToolCountBadge(ctx, count, bx, by) {
    const r = 11;
    ctx.save();
    const g = ctx.createRadialGradient(bx - 3, by - 4, 1, bx, by, r);
    g.addColorStop(0, "#ff8787");
    g.addColorStop(1, "#e03131");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawMahjongCenterText(ctx, String(count), bx, by, "bold 11px sans-serif", "#ffffff");
    ctx.restore();
  }
  function drawMahjongCenterText(ctx, text, cx, cy, font, fill2) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font;
    ctx.fillStyle = fill2;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }
  var MJ_CELEBRATE_CROP_TOP = 0.36;
  function drawMahjongCelebrateHeroImage(ctx, img, cardX, cardY, cardW, heroH, radius, cropTopRatio = MJ_CELEBRATE_CROP_TOP, cropBottomRatio = 0) {
    const iw = Math.max(1, img.width || 576);
    const ih = Math.max(1, img.height || 604);
    const sy = Math.floor(ih * Math.max(0, Math.min(0.55, cropTopRatio)));
    const bottomCut = Math.floor(ih * Math.max(0, Math.min(0.45, cropBottomRatio)));
    const sh = Math.max(1, ih - sy - bottomCut);
    const pad = 8;
    const drawW = cardW - pad * 2;
    const drawH = heroH - pad - 6;
    const drawX = cardX + pad;
    const drawY = cardY + 6;
    ctx.save();
    roundRectPath(ctx, drawX, drawY, drawW, drawH, radius - 4);
    ctx.clip();
    ctx.drawImage(img, 0, sy, iw, sh, drawX, drawY, drawW, drawH);
    ctx.restore();
  }
  function drawMahjongModalPlayBackgroundPanel(ctx, img, x, y, w, h, radius) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
    try {
      const layout = mahjongCoverLayout(img, w, h, 0.5);
      ctx.drawImage(img, x + layout.dx, y + layout.dy, layout.dw, layout.dh);
    } catch (e) {
      ctx.fillStyle = "#e8f8f5";
      ctx.fillRect(x, y, w, h);
    }
    const wash = ctx.createLinearGradient(x, y, x, y + h);
    wash.addColorStop(0, "rgba(255,255,255,0.38)");
    wash.addColorStop(0.45, "rgba(255,255,255,0.12)");
    wash.addColorStop(1, "rgba(255,255,255,0.36)");
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  function drawMahjongModalFooterReadableBand(ctx, cardX, cardY, cardW, cardH, footerH) {
    const footY = cardY + cardH - footerH;
    ctx.save();
    roundRectPath(ctx, cardX, cardY, cardW, cardH, 22);
    ctx.clip();
    const g = ctx.createLinearGradient(0, footY - 24, 0, cardY + cardH);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(cardX, footY - 24, cardW, footerH + 24);
    ctx.restore();
  }
  function drawMahjongModalPanelImage(ctx, img, x, y, w, h, radius) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
    try {
      ctx.drawImage(img, x, y, w, h);
    } catch (e) {
    }
    ctx.restore();
  }
  function drawMahjongModalCardFace(ctx, x, y, w, h, radius, chrome, nowMs) {
    if (chrome.playBgImage) {
      drawMahjongModalPlayBackgroundPanel(ctx, chrome.playBgImage, x, y, w, h, radius);
      return;
    }
    if (chrome.slotFullModalBg) {
      drawMahjongModalPanelImage(ctx, chrome.slotFullModalBg, x, y, w, h, radius);
      return;
    }
    drawMahjongCuteCard(ctx, x, y, w, h, {
      nowMs,
      radius,
      borderWidth: 0,
      border: "transparent",
      shadow: false,
      sparkle: false
    });
  }
  function drawMahjongModalFooterBand(ctx, cardX, cardY, cardW, cardH, footerH) {
    const footY = cardY + cardH - footerH;
    const g = ctx.createLinearGradient(0, footY, 0, cardY + cardH);
    g.addColorStop(0, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(224, 248, 245, 0.65)");
    ctx.fillStyle = g;
    roundRectPath(ctx, cardX + 8, footY, cardW - 16, footerH - 6, 14);
    ctx.fill();
  }
  function drawMahjongPrimaryCapsuleButton(ctx, x, y, w, h, label, top = "#ffe066", bottom = "#fab005", textColor = "#5c3d00", fontSize = 16) {
    const r = h / 2;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#4a3728";
    roundRectPath(ctx, x + 1, y + 4, w, h, r);
    ctx.fill();
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    roundRectPath(ctx, x + 4, y + 3, w - 8, h * 0.38, Math.max(4, r - 4));
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, r - 1);
    ctx.stroke();
    ctx.restore();
    drawMahjongCenterText(
      ctx,
      label,
      x + w / 2,
      y + h / 2,
      `bold ${fontSize}px sans-serif`,
      textColor
    );
  }
  function drawMahjongPanelCloseOrb(ctx, cx, cy, r) {
    ctx.save();
    ctx.fillStyle = "#ffd43b";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(92, 61, 0, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawMahjongCenterText(
      ctx,
      "\xD7",
      cx,
      cy + 1,
      `${Math.floor(r * 1.05)}px sans-serif`,
      "#5c3d00"
    );
    ctx.restore();
  }

  // src/presentation/mahjong/MahjongPlayPalette.ts
  var MJ_PALETTE = {
    bgTop: "#5eb8b8",
    bgMid: "#52adad",
    bgDeep: "#489e9e",
    matGlow: "rgba(255,255,255,0.1)",
    matShade: "rgba(28,92,92,0.12)",
    /** 牌侧白塑壳（参考实物侧面） */
    mahjongSideLight: "#ffffff",
    mahjongSide: "#f3f3f3",
    mahjongSideDeep: "#dcdcdc",
    /** 牌面白塑 + 内凹萌宠填色绿 */
    mahjongFaceTop: "#ffffff",
    mahjongFaceMid: "#fafafa",
    mahjongFaceBottom: "#ececec",
    mahjongFaceSheen: "rgba(255,255,255,0.55)",
    mahjongEngraveShadow: "#1a4d38",
    mahjongEngraveFill: "#2d8a58",
    mahjongEngraveHighlight: "#45b872",
    /** 牌背亮绿（与 ref 抠图一致） */
    mahjongBackGreen: "#8ecf8a",
    mahjongBackGreenDeep: "#6fb86c",
    /** @deprecated 旧玉牌侧色，保留避免 bundle 外引用断裂 */
    jadeSideLight: "rgba(196, 232, 224, 0.92)",
    jadeSide: "rgba(142, 196, 186, 0.88)",
    jadeSideDeep: "rgba(98, 158, 148, 0.86)",
    jadeFaceTop: "rgba(255, 255, 255, 0.94)",
    jadeFaceMid: "rgba(228, 246, 242, 0.88)",
    jadeFaceBottom: "rgba(205, 232, 224, 0.82)",
    jadeInnerGlow: "rgba(210, 248, 238, 0.35)",
    tileShadow: "rgba(8, 48, 44, 0.28)",
    tileShadowSoft: "rgba(12, 58, 52, 0.14)",
    tileShadowContact: "rgba(6, 36, 34, 0.36)",
    glass: "rgba(255,255,255,0.24)",
    glassDeep: "rgba(45,120,118,0.42)",
    glassStroke: "rgba(255,255,255,0.38)",
    slotWell: "rgba(32,96,94,0.28)",
    textPrimary: "#ffffff",
    textSoft: "rgba(255,255,255,0.88)",
    accentWarm: "#e8b070",
    accentWarmDeep: "#c8925a"
  };

  // src/presentation/mahjong/MahjongPileSway.ts
  var SWAY_CLAMP = 36;
  function createMahjongPileSway() {
    return { ox: 0, oy: 0, rot: 0, vx: 0, vy: 0, vr: 0 };
  }
  function clampSway(s) {
    s.ox = Math.max(-SWAY_CLAMP, Math.min(SWAY_CLAMP, s.ox));
    s.oy = Math.max(-SWAY_CLAMP, Math.min(SWAY_CLAMP, s.oy));
    s.rot = Math.max(-0.08, Math.min(0.08, s.rot));
  }
  function updateMahjongPileSway(s, dtMs) {
    const dt = Math.min(48, Math.max(1, dtMs));
    const damp = Math.exp(-dt / 420);
    const spring = 4e-3 * dt;
    s.ox += s.vx * (dt / 16.67);
    s.oy += s.vy * (dt / 16.67);
    s.rot += s.vr * (dt / 16.67);
    clampSway(s);
    s.vx = (s.vx - s.ox * spring) * damp;
    s.vy = (s.vy - s.oy * spring) * damp;
    s.vr = (s.vr - s.rot * spring * 1.1) * damp;
    const still = Math.abs(s.vx) > 0.03 || Math.abs(s.vy) > 0.03 || Math.abs(s.vr) > 3e-5 || Math.abs(s.ox) > 0.2 || Math.abs(s.oy) > 0.2 || Math.abs(s.rot) > 2e-4;
    return still;
  }
  function tileMahjongPileSwayOffset(s, nx, ny, layerDepth) {
    const depth = 0.78 + layerDepth * 0.42;
    const px = (nx - 0.5) * 0.55;
    const py = (ny - 0.5) * 0.55;
    return {
      dx: s.ox * depth + s.ox * px * 0.35,
      dy: s.oy * depth + s.oy * py * 0.35,
      drot: s.rot * depth * 1.35
    };
  }
  function mahjongPileSwayBackgroundShift(s) {
    return { dx: s.ox * 0.22, dy: s.oy * 0.22 };
  }
  function applyMahjongPileSwayToHits(hits, poses, zMax, sway) {
    var _a, _b, _c;
    for (const hit of hits) {
      const pose = poses[hit.index];
      const layerDepth = ((_a = pose == null ? void 0 : pose.z) != null ? _a : hit.index) / Math.max(1, zMax);
      const { dx, dy, drot } = tileMahjongPileSwayOffset(
        sway,
        (_b = pose == null ? void 0 : pose.nx) != null ? _b : 0.5,
        (_c = pose == null ? void 0 : pose.ny) != null ? _c : 0.5,
        layerDepth
      );
      hit.x += dx;
      hit.y += dy;
      hit.rot += drot;
    }
  }
  var TILE_JITTER_CLAMP = 22;
  function createMahjongTileJitter() {
    return createMahjongPileSway();
  }
  function syncMahjongTileJitters(jitters, pileLength) {
    while (jitters.length < pileLength) {
      jitters.push(createMahjongTileJitter());
    }
    if (jitters.length > pileLength) {
      jitters.length = pileLength;
    }
  }
  function clampTileJitter(j) {
    j.ox = Math.max(-TILE_JITTER_CLAMP, Math.min(TILE_JITTER_CLAMP, j.ox));
    j.oy = Math.max(-TILE_JITTER_CLAMP, Math.min(TILE_JITTER_CLAMP, j.oy));
    j.rot = Math.max(-0.12, Math.min(0.12, j.rot));
  }
  function pokeMahjongTileJitter(j, dx, dy) {
    if (dx === 0 && dy === 0) {
      return;
    }
    j.ox += dx * 0.42;
    j.oy += dy * 0.42;
    j.vx += dx * 0.68;
    j.vy += dy * 0.68;
    j.vr += (dx - dy) * 32e-4;
    clampTileJitter(j);
  }
  function updateMahjongTileJitters(jitters, dtMs) {
    let any = false;
    for (const j of jitters) {
      const dt = Math.min(48, Math.max(1, dtMs));
      const damp = Math.exp(-dt / 320);
      const spring = 55e-4 * dt;
      j.ox += j.vx * (dt / 16.67);
      j.oy += j.vy * (dt / 16.67);
      j.rot += j.vr * (dt / 16.67);
      clampTileJitter(j);
      j.vx = (j.vx - j.ox * spring) * damp;
      j.vy = (j.vy - j.oy * spring) * damp;
      j.vr = (j.vr - j.rot * spring * 1.15) * damp;
      if (Math.abs(j.vx) > 0.04 || Math.abs(j.vy) > 0.04 || Math.abs(j.vr) > 4e-5 || Math.abs(j.ox) > 0.15 || Math.abs(j.oy) > 0.15 || Math.abs(j.rot) > 15e-5) {
        any = true;
      }
    }
    return any;
  }
  function pointInMahjongTileHit(x, y, hit, pad) {
    return x >= hit.x - pad && x <= hit.x + hit.w + pad && y >= hit.y - pad && y <= hit.y + hit.h + pad;
  }
  function pokeMahjongTilesOnPointerMove(hits, jitters, prevX, prevY, x, y, dx, dy) {
    var _a;
    if (hits.length === 0 || dx === 0 && dy === 0) {
      return;
    }
    let maxIndex = 0;
    for (const hit of hits) {
      maxIndex = Math.max(maxIndex, hit.index);
    }
    syncMahjongTileJitters(jitters, maxIndex + 1);
    const dist = Math.hypot(x - prevX, y - prevY);
    const steps = Math.max(1, Math.ceil(dist / 10));
    const pad = Math.max(8, ((_a = hits[0]) == null ? void 0 : _a.w) ? hits[0].w * 0.08 : 8);
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const px = prevX + (x - prevX) * t;
      const py = prevY + (y - prevY) * t;
      const sdx = dx / steps;
      const sdy = dy / steps;
      for (const hit of hits) {
        if (!pointInMahjongTileHit(px, py, hit, pad)) {
          continue;
        }
        const j = jitters[hit.index];
        if (j) {
          pokeMahjongTileJitter(j, sdx, sdy);
        }
      }
    }
  }
  function applyMahjongTileJitterToHits(hits, jitters) {
    for (const hit of hits) {
      const j = jitters[hit.index];
      if (!j) {
        continue;
      }
      hit.x += j.ox;
      hit.y += j.oy;
      hit.rot += j.rot;
    }
  }

  // src/presentation/mahjong/MahjongTileFlyAnim.ts
  function easeOutCubic3(t) {
    return 1 - (1 - t) ** 3;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function createMahjongFlyAnim(params) {
    var _a;
    return {
      ...params,
      durationMs: (_a = params.durationMs) != null ? _a : 320
    };
  }
  function mahjongFlyAnimDone(anim, nowMs) {
    return nowMs - anim.startMs >= anim.durationMs;
  }
  function sampleMahjongFlyAnim(anim, nowMs) {
    const elapsed = nowMs - anim.startMs;
    const t = Math.min(1, Math.max(0, elapsed / anim.durationMs));
    const e = easeOutCubic3(t);
    const arc = Math.sin(t * Math.PI) * Math.max(12, anim.fromH * 0.35);
    const pop = 1 + Math.sin(t * Math.PI) * 0.11;
    return {
      x: lerp(anim.fromX, anim.toX, e),
      y: lerp(anim.fromY, anim.toY, e) - arc,
      w: lerp(anim.fromW, anim.toW, e) * pop,
      h: lerp(anim.fromH, anim.toH, e) * pop,
      rot: lerp(anim.fromRot, 0, e),
      done: t >= 1
    };
  }
  function createMahjongSlotFlight() {
    return { baseSlots: [], anims: [] };
  }
  function resetMahjongSlotFlight(flight) {
    flight.baseSlots = [];
    flight.anims.length = 0;
  }
  function launchMahjongSlotFlight(flight, slotsBeforeTap, anim) {
    if (flight.anims.length === 0) {
      flight.baseSlots = slotsBeforeTap.slice();
    }
    flight.anims.push(anim);
  }
  function pruneMahjongSlotFlight(flight, nowMs, append, onLand) {
    while (flight.anims.length > 0 && mahjongFlyAnimDone(flight.anims[0], nowMs)) {
      const anim = flight.anims[0];
      const slotsBefore = flight.baseSlots;
      const slotsAfter = append(slotsBefore, anim.type);
      if (onLand) {
        onLand({
          type: anim.type,
          slotsBefore,
          slotsAfter,
          removedCount: slotsBefore.length + 1 - slotsAfter.length,
          anim
        });
      }
      flight.baseSlots = slotsAfter;
      flight.anims.shift();
    }
    return flight.anims.length > 0;
  }
  function sameSlots(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  function mahjongSlotsForDisplay(actualSlots, flight, nowMs, append) {
    if (flight.anims.length === 0) {
      return actualSlots;
    }
    let predicted = flight.baseSlots;
    for (const anim of flight.anims) {
      predicted = append(predicted, anim.type);
    }
    if (!sameSlots(predicted, actualSlots)) {
      return actualSlots;
    }
    let shown = flight.baseSlots;
    for (const anim of flight.anims) {
      if (!mahjongFlyAnimDone(anim, nowMs)) {
        break;
      }
      shown = append(shown, anim.type);
    }
    return shown;
  }

  // src/presentation/mahjong/MahjongPlaySceneBgCache.ts
  var sceneBgCache = null;
  function createOffscreenCanvas2(width, height) {
    try {
      const wxApi2 = globalThis.wx;
      if (!(wxApi2 == null ? void 0 : wxApi2.createCanvas)) {
        return null;
      }
      const canvas = wxApi2.createCanvas();
      canvas.width = Math.max(1, Math.ceil(width));
      canvas.height = Math.max(1, Math.ceil(height));
      return canvas;
    } catch (e) {
      return null;
    }
  }
  function sceneBgCacheKey(width, height, pileTop, pileBottom, bgImage) {
    var _a, _b;
    const iw = (_a = bgImage == null ? void 0 : bgImage.width) != null ? _a : 0;
    const ih = (_b = bgImage == null ? void 0 : bgImage.height) != null ? _b : 0;
    return `${width}x${height}:${pileTop}:${pileBottom}:${iw}x${ih}`;
  }
  function clearMahjongPlaySceneBackgroundCache() {
    sceneBgCache = null;
  }
  function drawMahjongPlaySceneBackgroundCached(ctx, width, height, pileTop, pileBottom, bgImage, bgShift = { dx: 0, dy: 0 }) {
    const key = sceneBgCacheKey(width, height, pileTop, pileBottom, bgImage);
    if (!sceneBgCache || sceneBgCache.key !== key) {
      const canvas = createOffscreenCanvas2(width, height);
      if (!canvas) {
        drawMahjongPlaySceneBackground(
          ctx,
          width,
          height,
          pileTop,
          pileBottom,
          bgImage,
          void 0,
          bgShift
        );
        return;
      }
      const off = canvas.getContext("2d");
      if (!off) {
        drawMahjongPlaySceneBackground(
          ctx,
          width,
          height,
          pileTop,
          pileBottom,
          bgImage,
          void 0,
          bgShift
        );
        return;
      }
      drawMahjongPlaySceneBackground(
        off,
        width,
        height,
        pileTop,
        pileBottom,
        bgImage,
        void 0,
        { dx: 0, dy: 0 }
      );
      sceneBgCache = { key, canvas };
    }
    ctx.save();
    ctx.translate(bgShift.dx, bgShift.dy);
    try {
      ctx.drawImage(sceneBgCache.canvas, 0, 0, width, height);
    } catch (e) {
      drawMahjongPlaySceneBackground(
        ctx,
        width,
        height,
        pileTop,
        pileBottom,
        bgImage,
        void 0,
        bgShift
      );
    }
    ctx.restore();
  }

  // src/presentation/mahjong/MahjongStageFx.ts
  function makeMahjongIntroBanner(level, subtitle) {
    return makeLevelBanner("mahjong_intro", `\u7B2C ${level} \u5173`, subtitle);
  }
  function mahjongIntroSubtitle(themeName) {
    const base = "\u4E09\u5F20\u540C\u724C\u5165\u69FD\u6D88\u9664";
    if (!themeName) {
      return base;
    }
    const short = themeName.replace(/麻将馆$/, "").trim();
    return short ? `${short} \xB7 ${base}` : base;
  }
  function makeMahjongFailBanner(reason) {
    return makeLevelBanner("mahjong_fail", "\u6311\u6218\u5931\u8D25", reason);
  }
  function mahjongFailReasonLabel(failReason) {
    if (failReason === "timeout") {
      return "\u65F6\u95F4\u5230\u5566\uFF0C\u518D\u8BD5\u4E00\u6B21\u5427";
    }
    if (failReason === "slot_full") {
      return "\u69FD\u4F4D\u5DF2\u6EE1";
    }
    return "\u52A0\u6CB9\uFF0C\u4E0B\u628A\u4E00\u5B9A\u80FD\u8FC7";
  }
  function mahjongResultRevealFrame(startMs, nowMs, durationMs = 520) {
    const elapsed = nowMs - startMs;
    if (elapsed <= 0) {
      return { alpha: 0, scale: 0.82, offsetY: 28 };
    }
    const t = Math.min(1, elapsed / durationMs);
    const u = 1 - (1 - t) ** 3;
    const bounce = 1 + 0.06 * Math.sin(t * Math.PI);
    return {
      alpha: Math.min(1, t * 1.35),
      scale: (0.82 + 0.18 * u) * bounce,
      offsetY: (1 - u) * 28
    };
  }
  function drawMahjongLevelStageBanner(ctx, width, height, banner, nowMs, centerY = height * 0.42) {
    if (banner.startMs === 0) {
      banner.startMs = nowMs;
    }
    const frame = bannerFrame(banner, nowMs);
    if (frame.done) {
      return false;
    }
    const pal = bannerPalette(banner.kind);
    const bandH = banner.subtitle ? 82 : 62;
    const top = centerY - bandH / 2;
    if (banner.kind === "mahjong_fail") {
      ctx.save();
      ctx.globalAlpha = frame.alpha * 0.28;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = frame.ribbon * 0.92;
    const g = ctx.createLinearGradient(0, top, 0, top + bandH);
    g.addColorStop(0, pal.top);
    g.addColorStop(1, pal.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, width, bandH);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(0, top, width, 3);
    ctx.fillRect(0, top + bandH - 3, width, 3);
    const shimmer = bannerShimmerPhase(banner, nowMs);
    if (shimmer >= 0) {
      const sx = shimmer * width;
      const sg = ctx.createLinearGradient(sx - 40, top, sx + 40, top + bandH);
      sg.addColorStop(0, "rgba(255,255,255,0)");
      sg.addColorStop(0.5, "rgba(255,255,255,0.45)");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 50, top, 100, bandH);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = frame.alpha;
    ctx.translate(width / 2 + frame.offset * width, centerY);
    ctx.scale(frame.scale, frame.scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const titleSize = banner.kind === "mahjong_intro" ? 34 : 30;
    const ty = banner.subtitle ? -13 : 0;
    ctx.font = `bold ${titleSize}px sans-serif`;
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = 7;
    ctx.strokeText(banner.title, 0, ty);
    ctx.fillStyle = pal.ink;
    ctx.fillText(banner.title, 0, ty);
    if (banner.subtitle) {
      ctx.font = "bold 14px sans-serif";
      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = 4;
      ctx.strokeText(banner.subtitle, 0, 22);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(banner.subtitle, 0, 22);
    }
    ctx.restore();
    return true;
  }

  // src/presentation/mahjong/MahjongHallUi.ts
  function formatTime(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1e3));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  function pushBtn(buttons, btn) {
    buttons.push(btn);
  }
  function drawMahjongPlayBackground(ctx, width, height, pileTop, pileBottom, chrome, pileSway) {
    const bgShift = pileSway ? mahjongPileSwayBackgroundShift(pileSway) : { dx: 0, dy: 0 };
    drawMahjongPlaySceneBackgroundCached(
      ctx,
      width,
      height,
      pileTop,
      pileBottom,
      chrome.playBgImage,
      bgShift
    );
    if (chrome.background && !chrome.playBgImage) {
      ctx.save();
      ctx.translate(bgShift.dx, bgShift.dy);
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = chrome.background;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
  function drawMahjongGlassBar3D(ctx, x, y, w, h, r) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = MJ_PALETTE.tileShadow;
    roundRect3(ctx, x + 1.5, y + 4, w, h, r);
    ctx.fill();
    ctx.globalAlpha = 1;
    const body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, "rgba(255,255,255,0.38)");
    body.addColorStop(0.42, MJ_PALETTE.glass);
    body.addColorStop(1, MJ_PALETTE.glassDeep);
    ctx.fillStyle = body;
    roundRect3(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.55;
    const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.55);
    gloss.addColorStop(0, "rgba(255,255,255,0.72)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    roundRect3(ctx, x + 3, y + 2, w - 6, h * 0.42, Math.max(4, r - 4));
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = MJ_PALETTE.glassStroke;
    ctx.lineWidth = 2;
    roundRect3(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    roundRect3(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 3));
    ctx.stroke();
    ctx.restore();
  }
  function drawMahjongPlayHeader(ctx, width, game, ladderCoins, mahjongRunCoins, safeTop, nowMs = 0) {
    const leftReserve = mahjongPlayHeaderLeftReserve();
    const rightReserve = Math.max(118, width * 0.3);
    const bx = leftReserve;
    const bannerW = Math.max(160, width - leftReserve - rightReserve);
    const by = safeTop + 4;
    const barH = 32;
    drawMahjongGlassBar3D(ctx, bx, by, bannerW, barH, 12);
    const midY = by + barH / 2;
    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "bold 14px sans-serif";
    const levelLabel = `\u5173\u5361 ${game.level}`;
    const levelX = bx + 12;
    ctx.strokeStyle = "rgba(8, 48, 44, 0.35)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText(levelLabel, levelX, midY);
    ctx.fillStyle = MJ_PALETTE.textPrimary;
    ctx.fillText(levelLabel, levelX, midY);
    const levelW = ctx.measureText(levelLabel).width;
    ctx.font = "bold 13px sans-serif";
    const timerLabel = `\u23F1 ${formatTime(game.remainingMs)}`;
    const timerX = levelX + levelW + 10;
    const urgent = game.remainingMs > 0 && game.remainingMs <= 45e3;
    if (urgent) {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(nowMs * 0.012));
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = "rgba(255, 107, 107, 0.28)";
      ctx.fillRect(timerX - 4, midY - 12, ctx.measureText(timerLabel).width + 8, 24);
      ctx.restore();
    }
    ctx.fillStyle = urgent ? "#c92a2a" : MJ_PALETTE.textPrimary;
    ctx.strokeText(timerLabel, timerX, midY);
    ctx.fillText(timerLabel, timerX, midY);
    ctx.textAlign = "right";
    ctx.font = "bold 11px sans-serif";
    const coinLine = `\u68AF\u5B50${formatMahjongGlobalCoinAmount(ladderCoins)} \u672C\u5C40${formatMahjongGlobalCoinAmount(mahjongRunCoins)}`;
    ctx.strokeText(coinLine, bx + bannerW - 8, midY);
    ctx.fillStyle = MJ_PALETTE.textSoft;
    ctx.fillText(coinLine, bx + bannerW - 8, midY);
    ctx.restore();
  }
  function drawMahjongSlotBar(ctx, width, slotY, slotW, slotH, pad, slotCount = 0, maxSlots = 6, nowMs = 0) {
    const barPad = 6;
    const barH = slotH + barPad * 2;
    const barY = slotY - barPad;
    const barX = pad - 4;
    const barW = width - pad * 2 + 8;
    drawMahjongGlassBar3D(ctx, barX, barY, barW, barH, 16);
    const tight = maxSlots > 0 && slotCount >= Math.max(1, maxSlots - 1);
    if (tight) {
      const pulse = 0.35 + 0.35 * Math.abs(Math.sin(nowMs * 9e-3));
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = slotCount >= maxSlots ? "#ff6b6b" : "#ff922b";
      ctx.lineWidth = 3;
      roundRect3(ctx, barX + 1, barY + 1, barW - 2, barH - 2, 15);
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 7; i += 1) {
      const x = pad + i * (slotW + 5);
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#000000";
      roundRect3(ctx, x + 1, slotY + 3, slotW, slotH, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      const well = ctx.createLinearGradient(x, slotY, x, slotY + slotH);
      well.addColorStop(0, "rgba(18, 72, 68, 0.55)");
      well.addColorStop(0.5, MJ_PALETTE.slotWell);
      well.addColorStop(1, "rgba(12, 48, 46, 0.62)");
      ctx.fillStyle = well;
      roundRect3(ctx, x, slotY, slotW, slotH, 8);
      ctx.fill();
      const wellShine = ctx.createLinearGradient(x, slotY, x, slotY + slotH);
      wellShine.addColorStop(0, "rgba(255,255,255,0.48)");
      wellShine.addColorStop(0.55, "rgba(255,255,255,0.1)");
      wellShine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = wellShine;
      roundRect3(ctx, x + 1, slotY + 1, slotW - 2, slotH * 0.48, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.lineWidth = 1.5;
      roundRect3(ctx, x + 0.5, slotY + 0.5, slotW - 1, slotH - 1, 7.5);
      ctx.stroke();
      ctx.restore();
    }
  }
  function layoutMahjongPlay(width, height, game, tileHits, buttons) {
    tileHits.length = 0;
    const m = mahjongPlayMetrics(width, height);
    const backHome = mahjongPlayBackHomeFrame(m.safeTop);
    pushBtn(buttons, {
      id: "mahjong_back_lobby",
      x: backHome.x,
      y: backHome.y,
      w: backHome.w,
      h: backHome.h,
      label: "\u56DE\u9996\u9875"
    });
    const pileLayout = pilePosesToHitsCached(
      game.pilePoses,
      width,
      height,
      game.pileLayoutEpoch
    );
    for (const hit of pileLayout.hits) {
      tileHits.push(hit);
    }
    const pileZMax = pileLayout.zMax;
    for (let i = 0; i < 7; i += 1) {
      const x = m.pad + i * (m.slotW + 5);
      const locked = i === 6 && !game.adSlotUnlocked;
      if (locked) {
        pushBtn(buttons, {
          id: "mahjong_ad_slot",
          x: x - 4,
          y: m.slotY - 6,
          w: m.slotW + 8,
          h: m.slotH + 12,
          label: "\u89E3\u9501"
        });
      }
    }
    for (const slot of mahjongToolButtonLayout(width, height)) {
      pushBtn(buttons, {
        id: `mahjong_tool_${slot.tool}`,
        x: slot.x,
        y: slot.y,
        w: slot.w,
        h: slot.h,
        label: MAHJONG_TOOL_LABELS[slot.tool]
      });
    }
    return pileZMax;
  }
  function drawMahjongPlay(ctx, width, height, game, ladderCoins, tileHits, buttons, chrome = {}, slotFlight, nowMs = 0) {
    var _a, _b, _c, _d;
    buttons.length = 0;
    tileHits.length = 0;
    const m = mahjongPlayMetrics(width, height);
    drawMahjongPlayBackground(
      ctx,
      width,
      height,
      m.pileTop,
      m.pileBottom,
      chrome,
      chrome.pileSway
    );
    drawMahjongPlayHeader(ctx, width, game, ladderCoins, game.coinsThisRun, m.safeTop, nowMs);
    const pileZMax = layoutMahjongPlay(width, height, game, tileHits, buttons);
    const tileDrawOptsBase = {
      mahjongLevel: game.level,
      rasterThemeKey: chrome.tileRasterThemeKey
    };
    if (chrome.pileSway) {
      applyMahjongPileSwayToHits(tileHits, game.pilePoses, pileZMax, chrome.pileSway);
    }
    if (chrome.tileJitters && chrome.tileJitters.length > 0) {
      applyMahjongTileJitterToHits(tileHits, chrome.tileJitters);
    }
    for (const hit of tileHits) {
      const type = game.pile[hit.index];
      const z = (_b = (_a = game.pilePoses[hit.index]) == null ? void 0 : _a.z) != null ? _b : hit.index;
      const layerDepth = z / pileZMax;
      const pose = game.pilePoses[hit.index];
      drawStandingMahjongTile(ctx, hit.x, hit.y, hit.w, hit.h, hit.rot, type, chrome.tileImage, {
        ...tileDrawOptsBase,
        layerDepth,
        faceDown: game.pileFaceDown[hit.index] === true,
        stand: pose == null ? void 0 : pose.stand
      });
    }
    const shownSlots = slotFlight ? mahjongSlotsForDisplay(
      game.slots,
      slotFlight,
      nowMs,
      (slots, tile) => game.slotsAfterAppend(slots, tile)
    ) : game.slots;
    drawMahjongSlotBar(
      ctx,
      width,
      m.slotY,
      m.slotW,
      m.slotH,
      m.pad,
      shownSlots.length,
      game.maxSlots(),
      nowMs
    );
    for (let i = 0; i < 7; i += 1) {
      const locked = i === 6 && !game.adSlotUnlocked;
      if (locked) {
        const x = m.pad + i * (m.slotW + 5);
        ctx.fillStyle = "rgba(232, 176, 112, 0.55)";
        roundRect3(ctx, x, m.slotY, m.slotW, m.slotH, 8);
        ctx.fill();
        ctx.strokeStyle = MJ_PALETTE.glassStroke;
        ctx.lineWidth = 1;
        roundRect3(ctx, x, m.slotY, m.slotW, m.slotH, 8);
        ctx.stroke();
        ctx.fillStyle = MJ_PALETTE.textPrimary;
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("\u89E3\u9501", x + m.slotW / 2, m.slotY + m.slotH * 0.62);
      }
    }
    shownSlots.forEach((type, idx) => {
      if (idx >= game.maxSlots()) {
        return;
      }
      const sr = mahjongSlotTileRect(width, height, idx);
      drawStandingMahjongTile(ctx, sr.x, sr.y, sr.w, sr.h, 0, type, chrome.tileImage, {
        layerDepth: 1,
        mahjongLevel: game.level,
        rasterThemeKey: chrome.tileRasterThemeKey
      });
    });
    for (const anim of (_c = slotFlight == null ? void 0 : slotFlight.anims) != null ? _c : []) {
      const s = sampleMahjongFlyAnim(anim, nowMs);
      if (s.done) {
        continue;
      }
      drawStandingMahjongTile(ctx, s.x, s.y, s.w, s.h, s.rot, anim.type, chrome.tileImage, {
        layerDepth: 1,
        mahjongLevel: game.level,
        rasterThemeKey: chrome.tileRasterThemeKey,
        rasterFaceW: anim.fromW
      });
    }
    if (game.level === 1 && !game.guideShown) {
      const gy = m.headerBottom - 4;
      const gw = width - m.pad * 2;
      drawMahjongGlassBar3D(ctx, m.pad, gy, gw, 26, 10);
      ctx.fillStyle = MJ_PALETTE.textPrimary;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(8, 48, 44, 0.32)";
      ctx.lineWidth = 2.5;
      const tip = "\u70B9\u51FB\u9EBB\u5C06\u653E\u5165\u69FD\u4F4D\uFF0C3 \u4E2A\u76F8\u540C\u81EA\u52A8\u6D88\u9664";
      ctx.strokeText(tip, width / 2, gy + 13);
      ctx.fillText(tip, width / 2, gy + 13);
    }
    for (const btn of buttons) {
      if (btn.id.startsWith("mahjong_tool_")) {
        const tool = btn.id.replace("mahjong_tool_", "");
        const cx = btn.x + btn.w / 2;
        const cy = btn.y + btn.h / 2;
        const icon = (_d = chrome.toolIcon) == null ? void 0 : _d.call(chrome, tool);
        let drewIcon = false;
        if (icon) {
          try {
            ctx.drawImage(icon, btn.x, btn.y, btn.w, btn.h);
            drewIcon = true;
          } catch (e) {
            drewIcon = false;
          }
        }
        if (!drewIcon) {
          const toolGrad = ctx.createRadialGradient(cx, cy - 4, 2, cx, cy, btn.w / 2);
          toolGrad.addColorStop(0, MJ_PALETTE.glass);
          toolGrad.addColorStop(1, MJ_PALETTE.glassDeep);
          ctx.fillStyle = toolGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, btn.w / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = MJ_PALETTE.glassStroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        drawMahjongToolNameLabel(ctx, btn.label, cx, btn.y + btn.h + 8);
        drawMahjongToolCountBadge(ctx, game.tools[tool], btn.x + btn.w - 2, btn.y + 8);
      } else if (btn.id === "mahjong_back_lobby") {
        drawMahjongPrimaryCapsuleButton(
          ctx,
          btn.x,
          btn.y,
          btn.w,
          btn.h,
          btn.label,
          "#a5d8ff",
          "#339af0",
          "#ffffff",
          12
        );
      }
    }
    ctx.textAlign = "left";
  }
  function mahjongSlotFullPreviewTypes(game) {
    const n = Math.min(MAHJONG_SLOT_FULL_AD_MOVE_COUNT, game.slots.length);
    if (n <= 0) {
      return [0, 1, 2];
    }
    return game.slots.slice(-n);
  }
  function drawMahjongSlotFullReviveOffer(ctx, width, height, game, chrome, buttons, nowMs) {
    drawMahjongModalVeil(ctx, width, height, 0.46);
    const cardW = Math.min(width * 0.86, 328);
    const footerH = 112;
    const cardH = Math.min(Math.max(340, height * 0.44), height - 96);
    const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);
    const panelR = 22;
    drawMahjongModalCardFace(ctx, card.x, card.y, card.w, card.h, panelR, chrome, nowMs);
    if (chrome.playBgImage) {
      drawMahjongModalFooterReadableBand(ctx, card.x, card.y, card.w, card.h, footerH);
    }
    drawMahjongCenterText(
      ctx,
      "\u724C\u69FD\u5DF2\u6EE1",
      card.cx,
      card.y + 36,
      "bold 18px sans-serif",
      "#1e5c56"
    );
    const closeX = card.x + card.w - 34;
    const closeY = card.y + 22;
    pushBtn(buttons, {
      id: "mahjong_slot_full_close",
      x: closeX - 18,
      y: closeY - 18,
      w: 36,
      h: 36,
      label: "\xD7"
    });
    drawMahjongPanelCloseOrb(ctx, closeX, closeY, 18);
    const previewTypes = mahjongSlotFullPreviewTypes(game);
    const tileW = Math.min(58, card.w * 0.19);
    const tileH = tileW * 1.18;
    const gap = tileW * 0.22;
    const tilesW = previewTypes.length * tileW + (previewTypes.length - 1) * gap;
    const tilesY = card.y + card.heroH * 0.54;
    const subtitleY = card.y + 62;
    drawMahjongCenterText(ctx, "\u79FB\u51FA3\u5F20\u82B1\u724C", card.cx, subtitleY, "15px sans-serif", "#2f6f66");
    let tx = card.cx - tilesW / 2;
    for (const type of previewTypes) {
      ctx.save();
      ctx.fillStyle = MJ_PALETTE.slotWell;
      roundRect3(ctx, tx - 3, tilesY - 3, tileW + 6, tileH + 8, 10);
      ctx.fill();
      ctx.restore();
      drawStandingMahjongTile(ctx, tx, tilesY, tileW, tileH, 0, type, chrome.tileImage, {
        layerDepth: 1,
        mahjongLevel: game.level
      });
      tx += tileW + gap;
    }
    const adPad = 24;
    const adBtnH = 48;
    const adBtnY = card.y + card.h - footerH + 26;
    const adBtnW = card.w - adPad * 2;
    pushBtn(buttons, {
      id: "mahjong_slot_full_ad",
      x: card.x + adPad,
      y: adBtnY,
      w: adBtnW,
      h: adBtnH,
      label: "\u79FB\u51FA\u7EE7\u7EED"
    });
    drawMahjongPrimaryCapsuleButton(ctx, card.x + adPad, adBtnY, adBtnW, adBtnH, "\u25B6  \u79FB\u51FA\u7EE7\u7EED");
  }
  function drawMahjongToolOfferModal(ctx, width, height, tool, buttons, chrome, coinCost) {
    var _a;
    drawMahjongModalVeil(ctx, width, height, 0.48);
    const cardW = Math.min(width * 0.88, 340);
    const pad = 28;
    const btnH = 46;
    const btnGap = 8;
    const contentTop = 24;
    const iconSize = Math.min(88, cardW * 0.26);
    const coinPay = isMahjongCoinPaymentsEnabled();
    const btnBlockH = coinPay ? btnH * 2 + btnGap : btnH;
    const cardH = Math.min(
      Math.max(contentTop + iconSize + 16 + 22 + btnBlockH + 22, coinPay ? 248 : 220),
      height - 88
    );
    const footerH = btnBlockH + 22;
    const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);
    const panelR = 22;
    drawMahjongModalCardFace(ctx, card.x, card.y, card.w, card.h, panelR, chrome, 0);
    if (chrome.playBgImage) {
      drawMahjongModalFooterReadableBand(ctx, card.x, card.y, card.w, card.h, footerH);
    }
    const closeX = card.x + card.w - 34;
    const closeY = card.y + 22;
    pushBtn(buttons, {
      id: "mahjong_tool_modal_close",
      x: closeX - 18,
      y: closeY - 18,
      w: 36,
      h: 36,
      label: "\xD7"
    });
    drawMahjongPanelCloseOrb(ctx, closeX, closeY, 18);
    const iconX = card.cx - iconSize / 2;
    const iconY = card.y + contentTop;
    const toolImg = (_a = chrome.toolIcon) == null ? void 0 : _a.call(chrome, tool);
    if (toolImg) {
      try {
        ctx.drawImage(toolImg, iconX, iconY, iconSize, iconSize);
      } catch (e) {
      }
    }
    const toolName = MAHJONG_TOOL_LABELS[tool];
    if (toolImg) {
      const nameY = iconY + iconSize + 14;
      drawMahjongCenterText(
        ctx,
        toolName,
        card.cx,
        nameY,
        "bold 18px sans-serif",
        "#1e5c56"
      );
    } else {
      drawMahjongCenterText(
        ctx,
        toolName,
        card.cx,
        iconY + iconSize / 2,
        "bold 20px sans-serif",
        "#1e5c56"
      );
    }
    const labelBottomY = toolImg ? iconY + iconSize + 14 : iconY + iconSize;
    const btnW = card.w - pad * 2;
    const adY = labelBottomY + (toolImg ? 18 : 14);
    const coinY = adY + btnH + btnGap;
    pushBtn(buttons, {
      id: "mahjong_tool_modal_ad",
      x: card.x + pad,
      y: adY,
      w: btnW,
      h: btnH,
      label: "\u514D\u8D39\u83B7\u5F97"
    });
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad,
      adY,
      btnW,
      btnH,
      "\u25B6  \u770B\u5E7F\u544A\u83B7\u5F97",
      "#ffe066",
      "#fab005",
      "#5c3d00"
    );
    if (coinPay) {
      pushBtn(buttons, {
        id: "mahjong_tool_modal_coin",
        x: card.x + pad,
        y: coinY,
        w: btnW,
        h: btnH,
        label: "\u91D1\u5E01\u5151\u6362"
      });
      drawMahjongPrimaryCapsuleButton(
        ctx,
        card.x + pad,
        coinY,
        btnW,
        btnH,
        `\u{1FA99}  ${formatMahjongGlobalCoinAmount(coinCost)}`,
        "#69db7c",
        "#37b24d",
        "#ffffff"
      );
    }
  }
  function drawMahjongSlotFullChallengeFailed(ctx, width, height, buttons, nowMs, chrome, resultRevealStartMs = 0) {
    ctx.save();
    if (resultRevealStartMs > 0) {
      const rev = mahjongResultRevealFrame(resultRevealStartMs, nowMs);
      ctx.globalAlpha = rev.alpha;
      ctx.translate(width / 2, height / 2 + rev.offsetY);
      ctx.scale(rev.scale, rev.scale);
      ctx.translate(-width / 2, -height / 2);
    }
    drawMahjongModalVeil(ctx, width, height, 0.46);
    const cardW = Math.min(width * 0.86, 328);
    const footerH = 112;
    const cardH = Math.min(Math.max(268, height * 0.34), height - 96);
    const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);
    const panelR = 22;
    drawMahjongModalCardFace(ctx, card.x, card.y, card.w, card.h, panelR, chrome, nowMs);
    if (chrome.playBgImage) {
      drawMahjongModalFooterReadableBand(ctx, card.x, card.y, card.w, card.h, footerH);
    }
    const closeX = card.x + card.w - 34;
    const closeY = card.y + 22;
    pushBtn(buttons, {
      id: "mahjong_fail_close",
      x: closeX - 18,
      y: closeY - 18,
      w: 36,
      h: 36,
      label: "\xD7"
    });
    drawMahjongPanelCloseOrb(ctx, closeX, closeY, 18);
    const bodyMidY = card.y + (card.h - footerH) / 2;
    drawMahjongCenterText(
      ctx,
      "\u6311\u6218\u5931\u8D25",
      card.cx,
      bodyMidY,
      "bold 20px sans-serif",
      "#1e5c56"
    );
    const pad = 24;
    const btnH = 46;
    const btnY = card.y + card.h - footerH + 26;
    const bw = (card.w - pad * 2 - 10) / 2;
    const coinPay = isMahjongCoinPaymentsEnabled();
    const replayCost = MAHJONG_REPLAY_COIN_COST;
    pushBtn(buttons, {
      id: coinPay ? "mahjong_fail_replay" : "mahjong_replay_ad",
      x: card.x + pad,
      y: btnY,
      w: bw,
      h: btnH,
      label: coinPay ? "\u91CD\u73A9" : "\u770B\u5E7F\u544A\u91CD\u5F00"
    });
    pushBtn(buttons, {
      id: "mahjong_fail_revive",
      x: card.x + pad + bw + 10,
      y: btnY,
      w: bw,
      h: btnH,
      label: "\u590D\u6D3B"
    });
    if (coinPay) {
      drawMahjongPrimaryCapsuleButton(
        ctx,
        card.x + pad,
        btnY,
        bw,
        btnH,
        `\u91CD\u73A9 ${formatMahjongGlobalCoinCostLabel(replayCost)}`
      );
    } else {
      drawMahjongPrimaryCapsuleButton(
        ctx,
        card.x + pad,
        btnY,
        bw,
        btnH,
        "\u25B6 \u770B\u5E7F\u544A\u91CD\u5F00",
        "#74c0fc",
        "#339af0",
        "#ffffff"
      );
    }
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad + bw + 10,
      btnY,
      bw,
      btnH,
      "\u25B6 \u770B\u5E7F\u544A\u590D\u6D3B",
      "#69db7c",
      "#37b24d",
      "#ffffff"
    );
    ctx.restore();
  }
  function drawMahjongWinCelebratePanel(ctx, width, height, game, buttons, autoNextMs, nowMs, celebrateImage) {
    drawMahjongModalVeil(ctx, width, height, 0.88, "pink");
    const cardW = Math.min(width * 0.86, 328);
    const footerH = autoNextMs > 0 ? 132 : 112;
    const cardH = Math.min(Math.max(440, height * 0.56), height - 64);
    const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);
    drawMahjongCuteCard(ctx, card.x, card.y, card.w, card.h, {
      nowMs,
      radius: 22,
      border: "rgba(255, 170, 210, 0.95)",
      fillTop: "rgba(255,255,255,0.98)",
      fillBottom: "rgba(255,236,245,0.98)"
    });
    drawMahjongCelebrateHeroImage(ctx, celebrateImage, card.x, card.y, card.w, card.heroH, 22);
    const title = `\u7B2C ${game.level} \u5173\u80DC\u5229`;
    drawMahjongCenterText(ctx, title, card.cx, card.y + card.heroH * 0.72, "bold 20px sans-serif", "#c2255c");
    drawMahjongCenterText(
      ctx,
      `\u83B7\u5F97 \u2605${game.starsThisRun}  \u91D1\u5E01 +${formatMahjongGlobalCoinAmount(game.coinsThisRun)}`,
      card.cx,
      card.y + card.heroH * 0.82,
      "bold 13px sans-serif",
      "#a61e4d"
    );
    if (autoNextMs > 0) {
      drawMahjongCenterText(
        ctx,
        `${Math.ceil(autoNextMs / 1e3)} \u79D2\u540E\u81EA\u52A8\u8FDB\u5165\u4E0B\u4E00\u5173`,
        card.cx,
        card.y + card.heroH * 0.9,
        "12px sans-serif",
        "#1864ab"
      );
    }
    drawMahjongModalFooterBand(ctx, card.x, card.y, card.w, card.h, footerH);
    const pad = 24;
    const bw = (card.w - pad * 2 - 8) / 2;
    const by = card.y + card.h - footerH + 28;
    pushBtn(buttons, { id: "mahjong_next", x: card.x + pad, y: by, w: bw, h: 44, label: "\u4E0B\u4E00\u5173" });
    pushBtn(buttons, {
      id: "mahjong_retry",
      x: card.x + pad + bw + 8,
      y: by,
      w: bw,
      h: 44,
      label: "\u518D\u73A9\u4E00\u6B21"
    });
    pushBtn(buttons, {
      id: "mahjong_back_lobby",
      x: card.x + pad,
      y: by + 52,
      w: card.w - pad * 2,
      h: 40,
      label: "\u8FD4\u56DE\u9996\u9875"
    });
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad,
      by,
      bw,
      44,
      "\u4E0B\u4E00\u5173",
      "#74c0fc",
      "#1c7ed6",
      "#ffffff"
    );
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad + bw + 8,
      by,
      bw,
      44,
      "\u518D\u73A9\u4E00\u6B21",
      "#a5d8ff",
      "#339af0",
      "#ffffff"
    );
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad,
      by + 52,
      card.w - pad * 2,
      40,
      "\u8FD4\u56DE\u9996\u9875",
      "#dee2e6",
      "#ced4da",
      "#495057"
    );
  }
  function drawMahjongResult(ctx, width, height, game, buttons, autoNextMs = 0, slotFullOfferDismissed = false, nowMs = 0, celebrateImage, chrome = {}, resultRevealStartMs = 0) {
    buttons.length = 0;
    if (game.phase === "lost" && game.failReason === "slot_full") {
      if (!slotFullOfferDismissed) {
        drawMahjongSlotFullReviveOffer(ctx, width, height, game, chrome, buttons, nowMs);
      } else {
        drawMahjongSlotFullChallengeFailed(
          ctx,
          width,
          height,
          buttons,
          nowMs,
          chrome,
          resultRevealStartMs
        );
      }
      return;
    }
    const won = game.phase === "won";
    if (won && celebrateImage) {
      drawMahjongWinCelebratePanel(
        ctx,
        width,
        height,
        game,
        buttons,
        autoNextMs,
        nowMs,
        celebrateImage
      );
      return;
    }
    ctx.save();
    if (resultRevealStartMs > 0) {
      const rev = mahjongResultRevealFrame(resultRevealStartMs, nowMs);
      ctx.globalAlpha = rev.alpha;
      ctx.translate(width / 2, height / 2 + rev.offsetY);
      ctx.scale(rev.scale, rev.scale);
      ctx.translate(-width / 2, -height / 2);
    }
    drawMahjongModalVeil(ctx, width, height, won ? 0.42 : 0.48);
    const cardW = width * 0.82;
    const cardH = 280;
    const cx = (width - cardW) / 2;
    const cy = (height - cardH) / 2;
    drawMahjongCuteCard(ctx, cx, cy, cardW, cardH, {
      nowMs,
      radius: 20,
      fillTop: won ? "rgba(240, 255, 230, 0.98)" : "rgba(255,255,255,0.98)",
      fillBottom: won ? "rgba(210, 248, 200, 0.97)" : "rgba(232, 248, 255, 0.97)",
      border: won ? "rgba(91, 186, 72, 0.92)" : "rgba(116, 192, 252, 0.92)"
    });
    drawMahjongCenterText(
      ctx,
      won ? "\u5173\u5361\u80DC\u5229" : "\u6311\u6218\u5931\u8D25",
      width / 2,
      cy + 48,
      "bold 20px sans-serif",
      won ? "#2b8a3e" : "#1864ab"
    );
    if (won) {
      drawMahjongCenterText(
        ctx,
        `\u83B7\u5F97 \u2605${game.starsThisRun}  \u91D1\u5E01 +${formatMahjongGlobalCoinAmount(game.coinsThisRun)}`,
        width / 2,
        cy + 88,
        "15px sans-serif",
        "#495057"
      );
      drawMahjongCenterText(
        ctx,
        `\u5269\u4F59 ${formatTime(game.remainingMs)}`,
        width / 2,
        cy + 118,
        "15px sans-serif",
        "#495057"
      );
      if (autoNextMs > 0) {
        drawMahjongCenterText(
          ctx,
          `${Math.ceil(autoNextMs / 1e3)} \u79D2\u540E\u81EA\u52A8\u8FDB\u5165\u4E0B\u4E00\u5173`,
          width / 2,
          cy + 142,
          "13px sans-serif",
          "#1864ab"
        );
      }
    } else {
      const reason = game.failReason === "timeout" ? "\u65F6\u95F4\u5230" : "\u69FD\u4F4D\u5DF2\u6EE1";
      drawMahjongCenterText(ctx, reason, width / 2, cy + 88, "15px sans-serif", "#495057");
    }
    const pad = cx + 24;
    const bw = (cardW - 48 - 8) / 2;
    const by = cy + cardH - 72;
    if (won) {
      pushBtn(buttons, { id: "mahjong_next", x: pad, y: by, w: bw, h: 44, label: "\u4E0B\u4E00\u5173" });
      pushBtn(buttons, {
        id: "mahjong_retry",
        x: pad + bw + 8,
        y: by,
        w: bw,
        h: 44,
        label: "\u518D\u73A9\u4E00\u6B21"
      });
      pushBtn(buttons, {
        id: "mahjong_back_lobby",
        x: pad,
        y: by + 52,
        w: cardW - 48,
        h: 40,
        label: "\u8FD4\u56DE\u9996\u9875"
      });
    } else {
      const coinPay = isMahjongCoinPaymentsEnabled();
      pushBtn(buttons, {
        id: coinPay ? "mahjong_replay_coin" : "mahjong_replay_ad",
        x: pad,
        y: by,
        w: bw,
        h: 44,
        label: coinPay ? `\u91CD\u73A9 ${formatMahjongGlobalCoinCostLabel(MAHJONG_REPLAY_COIN_COST)}` : "\u770B\u5E7F\u544A\u91CD\u73A9"
      });
      pushBtn(buttons, {
        id: "mahjong_back_lobby",
        x: pad + bw + 8,
        y: by,
        w: bw,
        h: 44,
        label: "\u8FD4\u56DE"
      });
    }
    for (const btn of buttons) {
      ctx.fillStyle = btn.id === "mahjong_back_lobby" ? "#f1f3f5" : "#4dabf7";
      roundRect3(ctx, btn.x, btn.y, btn.w, btn.h, 10);
      ctx.fill();
      drawMahjongCenterText(
        ctx,
        btn.label,
        btn.x + btn.w / 2,
        btn.y + btn.h / 2,
        "14px sans-serif",
        btn.id === "mahjong_back_lobby" ? "#495057" : "#ffffff"
      );
    }
    ctx.restore();
  }
  function roundRect3(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
  function hitMahjongTile(tileHits, x, y) {
    for (let i = tileHits.length - 1; i >= 0; i -= 1) {
      const t = tileHits[i];
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
        return t.index;
      }
    }
    return null;
  }
  function drawMahjongLadderCoinGateModal(ctx, width, height, ladderCoins, replayCost, buttons, nowMs = 0) {
    buttons.length = 0;
    const shortOnCoins = ladderCoins < replayCost;
    const pad = 22;
    const btnH = 44;
    const btnGap = 10;
    const footerH = btnH + 28;
    drawMahjongModalVeil(ctx, width, height, 0.52);
    const cardW = Math.min(width * 0.88, 320);
    const cardH = Math.min(232, height * 0.38);
    const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);
    drawMahjongCuteCard(ctx, card.x, card.y, card.w, card.h, {
      radius: 20,
      border: "rgba(255, 190, 120, 0.95)",
      fillTop: "rgba(255,255,255,0.98)",
      fillBottom: "rgba(255,248,235,0.98)",
      shadow: true,
      sparkle: true,
      nowMs
    });
    drawMahjongCenterText(
      ctx,
      shortOnCoins ? "\u9986\u9986\u91D1\u5E01\u4E0D\u591F\u5566" : "\u7EE7\u7EED\u672C\u5173",
      card.cx,
      card.y + 32,
      "bold 19px sans-serif",
      shortOnCoins ? "#c92a2a" : "#1864ab"
    );
    drawMahjongCenterText(
      ctx,
      formatMahjongGlobalCoinAmount(ladderCoins),
      card.cx,
      card.y + 58,
      "bold 22px sans-serif",
      "#1864ab"
    );
    drawMahjongCenterText(
      ctx,
      shortOnCoins ? "\u5FEB\u53BB\u7CD6\u679C\u68AF\u5B50\u95EF\u5173\u8D5A\u91D1\u5E01\u5427" : "\u7528\u91D1\u5E01\u6216\u770B\u5E7F\u544A\uFF0C\u4EFB\u9009\u4E00\u79CD\u91CD\u5F00",
      card.cx,
      card.y + 88,
      "14px sans-serif",
      "#495057"
    );
    const innerW = card.w - pad * 2;
    const halfW = (innerW - btnGap) / 2;
    const y0 = card.y + card.h - footerH + 20;
    pushBtn(buttons, {
      id: "mahjong_gate_coin",
      x: card.x + pad,
      y: y0,
      w: halfW,
      h: btnH,
      label: "\u91D1\u5E01\u91CD\u5F00"
    });
    pushBtn(buttons, {
      id: "mahjong_gate_ad",
      x: card.x + pad + halfW + btnGap,
      y: y0,
      w: halfW,
      h: btnH,
      label: "\u590D\u6D3B"
    });
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad,
      y0,
      halfW,
      btnH,
      formatMahjongGlobalCoinAmount(replayCost)
    );
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad + halfW + btnGap,
      y0,
      halfW,
      btnH,
      "\u25B6 \u590D\u6D3B",
      "#69db7c",
      "#37b24d",
      "#ffffff"
    );
    const closeX = card.x + card.w - 28;
    const closeY = card.y + 16;
    pushBtn(buttons, {
      id: "mahjong_gate_close",
      x: closeX - 18,
      y: closeY - 18,
      w: 36,
      h: 36,
      label: "\xD7"
    });
    drawMahjongPanelCloseOrb(ctx, closeX, closeY, 18);
  }
  function hitMahjongButton(buttons, x, y) {
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      const b = buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  // src/presentation/mahjong/MahjongThemeAssets.ts
  var MahjongThemeAssets = class {
    constructor(loadImage) {
      this.loadImage = loadImage;
      this.cache = /* @__PURE__ */ new Map();
      this.activeThemeId = null;
      this.lastLoadUsedFallback = false;
    }
    getActiveThemeId() {
      return this.activeThemeId;
    }
    didLastLoadUseFallback() {
      return this.lastLoadUsedFallback;
    }
    resolveTheme(themeId) {
      var _a;
      return (_a = getMahjongTheme(themeId)) != null ? _a : getDefaultMahjongTheme();
    }
    defaultTileImage(typeIndex) {
      var _a;
      const defaultTheme = getDefaultMahjongTheme();
      return (_a = this.cache.get(defaultTheme.themeId)) == null ? void 0 : _a.get(typeIndex);
    }
    async loadThemeTiles(theme, typeCount, allowPerTileFallback) {
      var _a;
      let bucket = this.cache.get(theme.themeId);
      if (!bucket) {
        bucket = /* @__PURE__ */ new Map();
        this.cache.set(theme.themeId, bucket);
      }
      const defaultTheme = getDefaultMahjongTheme();
      const need = Math.max(typeCount, theme.tiles.length);
      let loaded = 0;
      for (let i = 0; i < need; i += 1) {
        if (bucket.has(i)) {
          loaded += 1;
          continue;
        }
        const path = tileAssetPath(theme, i);
        if (!path) {
          continue;
        }
        let img = await this.loadImage(path);
        if (!img && allowPerTileFallback && theme.themeId !== defaultTheme.themeId) {
          const fallbackPath = tileAssetPath(defaultTheme, i);
          if (fallbackPath) {
            img = (_a = this.defaultTileImage(i)) != null ? _a : fallbackPath === path ? null : await this.loadImage(fallbackPath);
          }
          if (img) {
            this.lastLoadUsedFallback = true;
          }
        }
        if (img) {
          bucket.set(i, img);
          loaded += 1;
        }
      }
      return loaded;
    }
    async ensureTheme(themeId, typeCount) {
      var _a;
      const requested = (_a = getMahjongTheme(themeId)) != null ? _a : getDefaultMahjongTheme();
      const defaultTheme = getDefaultMahjongTheme();
      this.lastLoadUsedFallback = false;
      await this.loadThemeTiles(defaultTheme, typeCount, false);
      let theme = requested;
      let loaded = await this.loadThemeTiles(theme, typeCount, true);
      const minRequired = Math.min(3, Math.max(1, theme.tiles.length));
      if (theme.themeId !== defaultTheme.themeId && loaded < minRequired) {
        theme = defaultTheme;
        loaded = await this.loadThemeTiles(theme, typeCount, false);
        this.lastLoadUsedFallback = true;
      }
      this.activeThemeId = theme.themeId;
      return {
        theme,
        requestedThemeId: requested.themeId,
        usedFallback: this.lastLoadUsedFallback
      };
    }
    getTileImage(themeId, typeIndex) {
      var _a, _b, _c, _d;
      const direct = (_a = this.cache.get(themeId)) == null ? void 0 : _a.get(typeIndex);
      if (direct) {
        return direct;
      }
      const defaultTheme = getDefaultMahjongTheme();
      if (themeId !== defaultTheme.themeId) {
        return (_d = this.defaultTileImage(typeIndex)) != null ? _d : (_c = this.cache.get((_b = this.activeThemeId) != null ? _b : "")) == null ? void 0 : _c.get(typeIndex);
      }
      return void 0;
    }
  };

  // src/presentation/mahjong/MahjongModalAssets.ts
  var MAHJONG_MODAL_BG_SRC = {
    slotFull: "assets/main/mahjong/modal-slot-full-bg.png"
  };

  // src/presentation/mahjong/MahjongToolIcons.ts
  var MAHJONG_TOOL_ICON_SRC = {
    move_out: "assets/main/mahjong/tools/tool-move-out.png",
    gather: "assets/main/mahjong/tools/tool-gather.png",
    shuffle: "assets/main/mahjong/tools/tool-shuffle.png",
    reveal: "assets/main/mahjong/tools/tool-reveal.png"
  };

  // src/presentation/mahjong/MahjongSlotClearFx.ts
  function spawnMahjongSlotClearRings(rings, cx, cy, nowMs, count = 1) {
    for (let i = 0; i < count; i += 1) {
      rings.push({
        cx,
        cy: cy - i * 4,
        startMs: nowMs + i * 40,
        durationMs: 460 + i * 30
      });
    }
  }
  function pruneMahjongSlotClearRings(rings, nowMs) {
    let any = false;
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      if (nowMs - r.startMs >= r.durationMs) {
        rings.splice(i, 1);
      } else {
        any = true;
      }
    }
    return any;
  }
  function drawMiniSparkle(ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.2, r * 0.35);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
    ctx.strokeStyle = "#96f2d7";
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.65, y - r * 0.65);
    ctx.lineTo(x + r * 0.65, y + r * 0.65);
    ctx.moveTo(x + r * 0.65, y - r * 0.65);
    ctx.lineTo(x - r * 0.65, y + r * 0.65);
    ctx.stroke();
    ctx.restore();
  }
  function drawMahjongSlotClearRings(ctx, rings, nowMs) {
    for (const ring of rings) {
      const elapsed = nowMs - ring.startMs;
      if (elapsed < 0) {
        continue;
      }
      const t = Math.min(1, elapsed / ring.durationMs);
      const fade = (1 - t) * (1 - t);
      const baseR = 18 + t * 52;
      ctx.save();
      ctx.globalAlpha = fade * 0.92;
      ctx.strokeStyle = "#51cf66";
      ctx.lineWidth = 3.5 * (1 - t * 0.35);
      ctx.beginPath();
      ctx.arc(ring.cx, ring.cy, baseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = fade * 0.55;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.cx, ring.cy, baseR * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      if (t < 0.55) {
        drawMiniSparkle(ctx, ring.cx, ring.cy, 5 + (1 - t) * 6, fade);
      }
      ctx.restore();
    }
  }

  // src/presentation/wechat/WxCanvasGameApp.ts
  var MAHJONG_AUTO_NEXT_MS = 1800;
  var BURIED_POSE_MS = 1100;
  var BURIED_LEAVE_MS = 560;
  var TILE_FALLBACK_COLORS = {
    [0 /* Empty */]: "transparent",
    [1 /* Red */]: "#e74c3c",
    [2 /* Blue */]: "#3498db",
    [3 /* Green */]: "#2ecc71",
    [4 /* Yellow */]: "#f1c40f",
    [5 /* Purple */]: "#9b59b6",
    [9 /* Bear */]: "#a0522d",
    [10 /* Pig */]: "#ffb6c1",
    [11 /* Panda */]: "#4a4a4a",
    [12 /* Corgi */]: "#e8a54b",
    [6 /* Bomb */]: "#e67e22",
    [7 /* ColorBomb */]: "#1abc9c",
    [8 /* Hole */]: "transparent"
  };
  var TILE_SPRITE_SRC = {
    [1 /* Red */]: "assets/main/tiles/red.png",
    [2 /* Blue */]: "assets/main/tiles/blue.png",
    [3 /* Green */]: "assets/main/tiles/green.png",
    [4 /* Yellow */]: "assets/main/tiles/yellow.png",
    [5 /* Purple */]: "assets/main/tiles/purple.png",
    [9 /* Bear */]: "assets/main/tiles/bear.png",
    [10 /* Pig */]: "assets/main/tiles/pig.png",
    [11 /* Panda */]: "assets/main/tiles/panda.png",
    [12 /* Corgi */]: "assets/main/tiles/corgi.png",
    [7 /* ColorBomb */]: "assets/main/tiles/owl.png"
  };
  var BG_SRC = {
    lobby: "assets/main/bg/lobby.jpg",
    level: "assets/main/bg/level.jpg"
  };
  var LOBBY_LADDER_ICON_SRC = {
    check: "assets/main/ui/lobby-ladder/icon-check.png",
    star: "assets/main/ui/lobby-ladder/icon-star.png",
    lock: "assets/main/ui/lobby-ladder/icon-lock.png",
    cloud: "assets/main/ui/lobby-ladder/deco-cloud.png",
    cloudSm: "assets/main/ui/lobby-ladder/deco-cloud-sm.png"
  };
  var BOOSTER_ICON_SRC = {
    hammer: "assets/main/ui/icon-hammer.png",
    shuffle: "assets/main/ui/icon-shuffle.png",
    extra: "assets/main/ui/icon-extra.png",
    sound: "assets/main/ui/icon-sound.png",
    mute: "assets/main/ui/icon-mute.png"
  };
  var MAHJONG_HALL_SRC = "assets/main/mahjong/mahjong_button_test.png";
  var MAHJONG_NEW_BADGE_SRC = "assets/main/mahjong/NEW.png";
  var SHARE_QR_SRC = "assets/main/ui/game-qr.png";
  var MACARON_SRC = [
    "assets/main/ui/macaron-pink.png",
    "assets/main/ui/macaron-mint.png",
    "assets/main/ui/macaron-purple.png",
    "assets/main/ui/macaron-orange.png",
    "assets/main/ui/macaron-blue.png"
  ];
  var DIGIT_SRC = [
    "assets/main/ui/digit-0.png",
    "assets/main/ui/digit-1.png",
    "assets/main/ui/digit-2.png",
    "assets/main/ui/digit-3.png",
    "assets/main/ui/digit-4.png",
    "assets/main/ui/digit-5.png",
    "assets/main/ui/digit-6.png",
    "assets/main/ui/digit-7.png",
    "assets/main/ui/digit-8.png",
    "assets/main/ui/digit-9.png"
  ];
  var MACARON_NUM_STROKE = [
    "#c07280",
    "#3d8a68",
    "#9c4a88",
    "#b44a28",
    "#2f6d82"
  ];
  var HOWTO_LINES = [
    { tag: "\u6D88\u9664", text: "\u6ED1\u52A8\u4EA4\u6362\u76F8\u90BB\u840C\u5BA0\u3002\u540C\u8272\u6A2A\u6216\u7AD6\u8FDE\u6210 3 \u4E2A\u53CA\u4EE5\u4E0A\u5373\u53EF\u6D88\u9664\uFF0C\u4E0B\u843D\u586B\u7A7A\u540E\u8FD8\u80FD\u8FDE\u9501\u3002" },
    { tag: "\u8FC7\u5173", text: "\u5B8C\u6210\u5934\u9876\u5168\u90E8\u76EE\u6807\u5373\u901A\u5173\u3002\u6BCF\u6B21\u5408\u6CD5\u4EA4\u6362\u6263 1 \u6B65\uFF1B\u6B65\u6570\u7528\u5C3D\u53EF\u91CD\u5F00\uFF0C\u6216\u770B\u5E7F\u544A\u6BCF\u6B21\u8865 5 \u6B65\u7EE7\u7EED\u3002" },
    { tag: "\u51B0\u5757", text: "\u6D88\u9664\u6CE2\u53CA\u51B0\u5757\u4F1A\u788E\u4E00\u5C42\u3002\u51B0\u5C01\u683C\u4E0A\u7684\u840C\u5BA0\u4E0D\u80FD\u6ED1\u52A8\uFF0C\u9700\u5148\u6253\u788E\u51B0\u5757\u3002" },
    { tag: "\u68C9\u82B1", text: "\u68C9\u82B1\u76D6\u4F4F\u7684\u683C\u5B50\u4E0D\u80FD\u4EA4\u6362\u3002\u90BB\u6D88\u524A\u4E00\u5C42\uFF0C\u4E24\u6B21\u6E05\u6389\uFF1B\u4E91\u4E0B\u53EF\u80FD\u85CF\u7C89\u7403\uFF0C\u4E91\u6E05\u540E\u518D\u6D88\u624D\u7B97\u6536\u96C6\u3002" },
    { tag: "\u4F19\u4F34", text: "\u96EA\u4EBA\u3001\u4F01\u9E45\u85CF\u5728\u51B0\u4E0B\uFF0C\u5404\u5360\u591A\u683C\u3002\u5360\u5730\u51B0\u5757\u5168\u788E\u540E\u624D\u9732\u51FA\u5E76\u6536\u83B7\uFF1B\u96EA\u4EBA\u9732\u51FA\u65F6\u4F1A\u9707\u788E\u5468\u56F4\u4E00\u5708\u51B0\u3002" },
    { tag: "\u5927\u62DB", text: "\u56DB\u8FDE\u6216 L/T \u5F62\u51FA\u95EA\u5149\uFF08\u8303\u56F4\u7206\u70B8\uFF09\uFF1B\u4E94\u8FDE\u51FA\u8D85\u7EA7\u732B\u5934\u9E70\uFF08\u6E05\u540C\u8272\uFF09\u3002\u4E24\u679A\u95EA\u5149\u4E92\u6ED1\u53EF\u540C\u65F6\u5F15\u7206\u3002" },
    { tag: "\u7C89\u788E", text: "\u901A\u5173\u540E\u8FDB\u5165\u9650\u65F6\u70B9\u51FB\u7C89\u788E\u52A0\u5206\uFF0C\u53EF\u770B\u5E7F\u544A\u52A0\u65F6\u3002\u603B\u5206\u591F\u9AD8\u65F6\u8FD8\u53EF\u9009\u6E05\u6D01\u5C0F\u6E38\u620F\uFF08\u4E0D\u52A0\u4E3B\u7EBF\u5206\uFF09\u3002" },
    {
      tag: "\u661F\u7EA7",
      text: "\u8FC7\u5173\u65F6\u7701\u4E0B\u7684\u6B65\u6570\u8D8A\u591A\uFF0C\u661F\u7EA7\u8D8A\u9AD8\uFF08\u6700\u591A 3 \u661F\uFF0C\u663E\u793A\u5728\u5173\u5361\u5706\u4E0B\u65B9\u7684\u5C0F\u91D1\u661F\uFF09\u3002\u4E0E\u68AF\u5B50\u4E0A\u7684\u300C\u9986\u5E01\u300D\u65E0\u5173\uFF1A\u9986\u5E01\u6309\u5386\u53F2\u6700\u9AD8\u5206\u6298\u7B97\uFF0C\u7528\u4E8E\u840C\u5BA0\u9EBB\u5C06\u9986\u3002"
    },
    { tag: "\u9053\u5177", text: "\u9524\u5B50\u7838\u4E00\u683C\u3001\u91CD\u6392\u6D17\u76D8\u3001\u52A0\u6B65 +5\uFF0C\u5F00\u5C40\u4E0D\u9001\u3002\u5E93\u5B58\u7A7A\u65F6\uFF1A\u8F6C\u53D1\u597D\u53CB\u8FD4\u56DE +1 \u2192 \u8F6C\u53D1\u7FA4\u8FD4\u56DE +1 \u2192 \u518D\u770B\u5E7F\u544A\uFF1B\u91CD\u6392\u5165\u5305\u540E\u9700\u518D\u70B9\u4E00\u6B21\u624D\u6D17\u724C\u3002" },
    { tag: "\u5956\u52B1", text: "\u6BCF\u65E5\u767B\u5F55\u9001\u9524\u5B50\uFF1B\u5F53\u65E5\u901A\u5173\u6EE1 3 \u5173\u9886\u91CD\u6392\uFF1B\u67D0\u6B21\u5269 \u22656 \u6B65\u901A\u5173\u9001\u52A0\u6B65\u3002\u9053\u5177\u53EF\u5E26\u5165\u4E0B\u5173\uFF0C\u5404\u6700\u591A 9 \u4E2A\u3002" },
    { tag: "\u9080\u8BF7", text: "\u5206\u4EAB\u7ED9\u6CA1\u73A9\u8FC7\u7684\u597D\u53CB\uFF0C\u5BF9\u65B9\u901A\u5173\u540E\u53CC\u65B9\u5404\u5F97 1 \u9524\u5B50\u3002" },
    {
      tag: "\u9986\u9986",
      text: "\u7CD6\u679C\u68AF\u5B50\u6761\u4E0A\u300C123\u5206 \xB7 \u99863\u300D= \u8BE5\u5173\u6700\u9AD8\u5206\u4E0E\u6298\u7B97\u9986\u5E01\uFF08\u6362\u9EBB\u5C06\u7528\uFF09\u3002\u6587\u6848\u91CC\u7684\u91D1\u5E01\u2B50\u662F\u9986\u5E01\u56FE\u6807\uFF0C\u4E0D\u662F\u901A\u5173\u661F\u7EA7\u3002"
    }
  ];
  var WIN_CELEBRATE_SRC = "assets/main/ui/win-celebrate.jpg";
  var WIN_CELEBRATE_CROP_TOP = 0.36;
  var WIN_BANNER_CY = 0.82;
  var SLOT_FILL_BOTTOM = "rgba(232, 248, 252, 0.9)";
  var SLOT_LINE = "rgba(140, 198, 220, 0.42)";
  var BOARD_PANEL_TOP = "rgba(255, 255, 255, 0.97)";
  var BOARD_PANEL_BOTTOM = "rgba(232, 248, 255, 0.95)";
  var BOARD_PANEL_OUTER = "rgba(160, 210, 230, 0.92)";
  var WxCanvasGameApp = class {
    constructor(session) {
      this.animator = new BoardMatchAnimator();
      this.sceneBg = new CuteSceneBackground();
      this.resultFx = new LevelResultFx();
      this.mode = "lobby";
      this.overlay = "none";
      /** 从设置点进玩法 / 公告时，关闭后回到设置 */
      this.overlayFromSettings = false;
      this.boardViewModel = null;
      this.avatarCache = /* @__PURE__ */ new Map();
      /** 好友排行列表纵向滚动偏移（像素） */
      this.leaderboardScrollY = 0;
      /** 排行榜列表拖拽：起点与是否已滑动（滑动则不触发关闭按钮） */
      this.leaderboardDrag = null;
      /** 首次进入大厅：可选授权头像昵称（原生按钮，关闭面板时销毁） */
      this.userInfoAuthButton = null;
      this.buttons = [];
      this.mahjongButtons = [];
      this.mahjongTileHits = [];
      this.mahjongToolIcons = /* @__PURE__ */ new Map();
      this.mahjongSlotFullModalBg = null;
      this.mahjongActiveTheme = null;
      /** 实际用于渲染贴图的主题（CDN 失败时为 default） */
      this.mahjongDisplayThemeId = null;
      this.mahjongWinShownAtMs = 0;
      this.mahjongSuppressAutoNext = false;
      this.mahjongAutoNextInFlight = false;
      this.mahjongSlotFlight = createMahjongSlotFlight();
      this.mahjongSlotClearRings = [];
      this.mahjongStageBanner = null;
      this.mahjongFailBannerQueued = false;
      this.mahjongResultRevealStartMs = 0;
      this.mahjongPileSway = createMahjongPileSway();
      this.mahjongTileJitters = [];
      this.mahjongPileLastX = 0;
      this.mahjongPileLastY = 0;
      /** 牌堆区滑动过则抬起不当作点牌 */
      this.mahjongPileDragMoved = false;
      /** 按在牌堆区或正在拖牌堆 */
      this.mahjongPilePointerDown = false;
      /** 倒计时 UI 按秒刷新，避免麻将对局每帧全量重绘卡死模拟器 */
      this.mahjongTimerPaintSec = -1;
      this.mahjongDrawRecoverAttempted = false;
      /** 槽满首屏「牌槽已满」关闭后，展示「挑战失败」复活页。 */
      this.mahjongSlotFullOfferDismissed = false;
      /** 大厅入口：需重开但梯子金币不足时展示引导弹窗 */
      this.mahjongEntryGateLevel = null;
      this.mahjongGateButtons = [];
      /** 道具数量为 0 时展示的获取弹窗 */
      this.mahjongToolOffer = null;
      this.raf = 0;
      this.statusText = "";
      /** 点道具后贴在按钮上方的短提示 */
      this.toastText = "";
      this.toastUntilMs = 0;
      /** 进关「难度提升」艺术字提示 */
      this.difficultyArt = null;
      /** 关卡横幅队列：开局 / 目标达成 / 步数奖励 / 只剩 5 步，一次放一条 */
      this.levelBanners = [];
      /** 目标块飞向 HUD 目标栏 */
      this.goalFlyers = [];
      /** HUD 目标图标中心，drawHud 时更新，飞行终点 */
      this.hudGoalIconPos = null;
      this.lowMovesWarned = false;
      /** 局内刚完成的每日任务提示 */
      this.dailyTaskPop = null;
      /** 结算页打开时刻（星星逐颗弹出） */
      this.resultOpenedMs = 0;
      this.resultStars = 0;
      this.leaderboardTab = "level";
      this.dailyChestBusy = false;
      /** 锤子选格模式 */
      this.hammerTargeting = false;
      /** 锤子光标屏幕坐标（选中后跟随手指/鼠标） */
      this.hammerCursor = null;
      this.unsub = null;
      this.started = false;
      this.pumping = false;
      /** 广告/切关进行中，避免连点弹出两层广告 */
      this.tapBusy = false;
      this.scheduleFrame = (cb) => setTimeout(() => cb(Date.now()), 80);
      this.cancelFrame = (id) => clearTimeout(id);
      this.frameDelayMs = 80;
      this.baseFrameDelayMs = 80;
      /** 已加载的小动物贴图 */
      this.tileImages = /* @__PURE__ */ new Map();
      this.buriedPenguin = null;
      this.buriedSnowman = null;
      this.bgLobby = null;
      this.bgLevel = null;
      this.layoutCacheKey = "";
      this.layoutCache = { cellSize: 40, originX: 0, originY: 0 };
      /** 闯关成功庆祝图 */
      this.winCelebrate = null;
      /** 道具栏图标 */
      this.uiIcons = /* @__PURE__ */ new Map();
      this.share = new WxShareAdapter();
      this.recommend = new GameRecommendLauncher();
      /** 微信常需用户手势后才能播 BGM */
      this.bgmStarted = false;
      /** 覆盖在「圈子」上的微信原生游戏圈按钮 */
      this.gameClubButton = null;
      this.gameClubButtonKey = "";
      this.gameClubTapHooked = false;
      /** 进游戏圈 / 切后台后 rAF 会停，返回时必须主动续上，否则首页黑屏 */
      this.foregroundHidden = false;
      /** 避免 onShow 连续恢复叠两次循环 */
      this.resumeToken = 0;
      this.resumeFollowupTimers = [];
      /** 冷启动进大厅插屏定时器 */
      this.launchAdTimer = 0;
      /** 超过此时刻仍未弹出则放弃进门插屏 */
      this.launchAdDeadline = 0;
      /** 大厅横幅延迟到首帧之后，避免启动时 createCustomAd 卡死模拟器 */
      this.lobbyBannerTimer = 0;
      this.lobbyBannerArmed = false;
      this.lobbyBannerRetryTimer = 0;
      this.lobbyBannerRetries = 0;
      /** 进关过程中 mode 还可能是 lobby，必须先拦住迟到的原生横幅 */
      this.leavingLobby = false;
      /** 广告关闭后的穿透点击：这段时间忽略触摸 */
      this.inputMuteUntilMs = 0;
      /** 防止 canvas.requestAnimationFrame 同步重入把模拟器卡死 */
      this.frameGuard = false;
      this.onHideBound = () => {
        if (this.pendingBoosterShare && !this.pendingBoosterShareHiddenAtMs) {
          this.pendingBoosterShareHiddenAtMs = this.nowMs || Date.now();
        }
        if (!isWxDesktopIdeHost()) {
          this.foreground.onHide();
        }
      };
      this.onShowBound = () => {
        if (!isWxDesktopIdeHost()) {
          this.foreground.onShow();
        }
        if (this.session.bindInviteFromQuery(readWxLaunchQuery())) {
          this.notifyUser("\u901A\u5173\u7B2C 1 \u5173\uFF0C\u4F60\u548C\u597D\u53CB\u5404\u5F97\u9524\u5B50", "\u9080\u8BF7\u5230\u8D26");
        }
        const inviteToast = this.session.takeInviteToast();
        if (inviteToast) {
          this.notifyUser(inviteToast, "\u9524\u5B50\u5230\u8D26");
        }
        if (!isWxDesktopIdeHost()) {
          this.trySettleBoosterShareAfterReturn();
        }
      };
      this.onAudioInterruptionBeginBound = () => {
        this.session.suspendForBackground();
      };
      this.onAudioInterruptionEndBound = () => {
        if (!this.foregroundHidden) {
          this.session.resumeFromBackground();
          this.kickRenderLoop();
        }
      };
      /** 与 rAF 同步的时钟（微信环境无 performance） */
      this.nowMs = 0;
      /** 大厅相机：树下移、天空云层展开 */
      this.lobbyCamY = 0;
      this.lobbyCamInited = false;
      /** 用户跟手拖过大厅后，不再强行吸回当前段 */
      this.lobbyCamUserHeld = false;
      /** 新解锁云层时一次性滚过去 */
      this.lobbyCamAutoTarget = null;
      this.lobbyCamSnapFrom = 0;
      this.lobbyCamSnapAtMs = 0;
      this.lobbyCamVel = 0;
      /** 「更多关卡」把手首次亮起的时刻；0 表示尚未计时。 */
      this.lobbySwipeHintShownAtMs = 0;
      /** 首次滑动或淡出结束后不再画把手。 */
      this.lobbySwipeHintDismissed = false;
      /** 空道具转发补给：从分享页返回后发奖 */
      this.pendingBoosterShare = null;
      /** 墙钟时间，避免 nowMs 暂停/重置导致误判已超时 */
      this.pendingBoosterShareAtMs = 0;
      /** 有待结算转发时，onHide 记下离开时刻；未离开过不发奖 */
      this.pendingBoosterShareHiddenAtMs = 0;
      /** 已从分享返回、等待玩家再点道具领取（防止面板未关就入包） */
      this.boosterShareClaimReady = null;
      /** 开发者工具领取弹窗进行中，避免重复弹出 */
      this.boosterShareModalOpen = false;
      this.boosterShareScene = null;
      this.lobbyDrag = null;
      /** 动画播放期间暂存胜负，播完再弹结算或进入粉碎 */
      this.pendingResult = null;
      /** 粉碎爆炸视觉反馈 */
      this.crushBursts = [];
      /** 点击飘分 */
      this.floatingScores = [];
      /** 粉碎火花粒子 */
      this.crushSparks = [];
      /** 屏幕震动剩余时间 */
      this.shakeMs = 0;
      /** HUD 进度条果冻脉冲（消除/目标推进时） */
      this.hudBarPulse = 0;
      /** 分数数字砸地脉冲 */
      this.hudScorePunch = 1;
      /** 粉碎/清洁进度条满格对应加成分（开局占用格 ×10） */
      this.burstScoreBarMax = 640;
      /** 粉碎/清洁进度条当前展示值（平滑跟上真实分数） */
      this.hudBurstBarDisplay = 0;
      /** 是否已经成功点击粉碎过（用于引导） */
      this.crushHasTapped = false;
      /** 按下时已处理粉碎点击，抬起不再打第二次 */
      this.crushTapOnDown = false;
      /** 最近一次有效触点（touchEnd 坐标偶发丢失） */
      this.lastPointerX = 0;
      this.lastPointerY = 0;
      /** 本局粉碎点击次数（结算展示） */
      this.lastCrushTapCount = 0;
      this.lastFrameMs = 0;
      /** 有输入或动效才继续跑帧，空闲停循环省电 */
      this.needsPaint = true;
      /** 最近一次触摸，用来判断该不该停循环 */
      this.lastInteractMs = Date.now();
      /** 连续画帧失败次数，过多则停循环等下一次触摸 */
      this.frameErrors = 0;
      /** 避免 draw 异常每帧打 log，拖死微信开发者工具控制台 */
      this.lastDrawErrorLogMs = 0;
      /** 胜利结算：是否询问进入清洁模式 */
      this.offerCleanPrompt = false;
      /** 交换滑动过渡 */
      this.swapSlide = null;
      /** 等交换动画结束后再播消除 */
      this.pendingPlayback = null;
      /** 播放中的棉花/冰块/蛋壳/藤蔓快照：等小动物消完再掉层 */
      this.animCloudStart = null;
      this.animIceStart = null;
      this.animEggStart = null;
      this.animVineStart = null;
      this.animCloudWaves = [];
      /** 整只露出后先亮相，再飞离收集 */
      this.buriedFx = /* @__PURE__ */ new Map();
      this.loopBound = () => {
        this.onAnimationFrame();
      };
      /** 点到原生「圈子」：立刻停 rAF，别等 onHide（圈子起来前 onHide 经常晚 1～2 秒）。 */
      this.onGameClubTapped = () => {
        this.foreground.forcePause();
      };
      this.mahjongShellLoadAttempts = 0;
      var _a, _b, _c, _d, _e;
      const info = readWxSystemInfo();
      this.wxPlatform = (info.platform || "").toLowerCase();
      const desktopIde = isWxDesktopIdeHost();
      const profile = resolveWxRenderProfile(info, desktopIde);
      this.lite = profile.lite;
      this.cheapFx = profile.cheapFx;
      this.dpr = profile.dpr;
      this.width = Math.max(1, info.windowWidth || info.screenWidth || 375);
      this.height = Math.max(1, info.windowHeight || info.screenHeight || 667);
      this.statusBarHeight = (_c = (_b = info.statusBarHeight) != null ? _b : (_a = info.safeArea) == null ? void 0 : _a.top) != null ? _c : 44;
      this.safeAreaBottom = Math.max(
        0,
        this.height - ((_e = (_d = info.safeArea) == null ? void 0 : _d.bottom) != null ? _e : this.height)
      );
      this.menuButton = typeof wx.getMenuButtonBoundingClientRect === "function" ? wx.getMenuButtonBoundingClientRect() : null;
      const canvasBinding = bindMainCanvas2d();
      this.canvas = canvasBinding.canvas;
      this.canvasPresent = canvasBinding.present;
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx = canvasBinding.ctx;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.applyCanvasDrawQuality();
      this.ctx.fillStyle = "#b6e8fc";
      this.ctx.fillRect(0, 0, this.width, this.height);
      if (profile.useRaf && typeof this.canvas.requestAnimationFrame === "function") {
        this.useCanvasRaf();
      } else {
        this.baseFrameDelayMs = profile.frameDelayMs;
        this.useTimeoutFrames(profile.frameDelayMs);
      }
      this.sceneBg.setLite(this.lite);
      this.resultFx.setLite(this.lite);
      if (typeof wx.setPreferredFramesPerSecond === "function") {
        try {
          wx.setPreferredFramesPerSecond(profile.fps);
        } catch (e) {
        }
      }
      this.session = session;
      this.mahjongThemeAssets = new MahjongThemeAssets((src) => this.loadBgImage(src));
      this.boardView = new BoardView({ cellSize: 40, originX: 0, originY: 0 });
      this.sceneBg.layout(this.width, this.height);
      this.onTouchStartBound = (e) => this.handleTouchStart(e);
      this.onTouchMoveBound = (e) => this.handleTouchMove(e);
      this.onMahjongMouseMoveBound = (e) => {
        if (!isWxDesktopIdeHost()) {
          return;
        }
        const { x, y } = this.mapClientPointToGame(e.clientX, e.clientY);
        const inPile = this.isInMahjongPileArea(x, y);
        if (!inPile && !this.mahjongPilePointerDown) {
          this.mahjongPileLastX = x;
          this.mahjongPileLastY = y;
          return;
        }
        const gain = this.mahjongPilePointerDown || e.buttons === 1 ? 1 : 0.42;
        this.handleMahjongPilePointerMove(x, y, true, gain);
      };
      this.onMahjongMouseDownBound = (e) => {
        const { x, y } = this.mapClientPointToGame(e.clientX, e.clientY);
        if (this.mode === "mahjong_play" && this.isInMahjongPileArea(x, y)) {
          this.mahjongPilePointerDown = true;
          this.mahjongPileLastX = x;
          this.mahjongPileLastY = y;
          this.mahjongPileDragMoved = false;
        }
      };
      this.onMahjongMouseUpBound = (e) => {
        if (this.mode === "mahjong_play" && this.overlay === "none" && !this.isInputMuted()) {
          const { x, y } = this.mapClientPointToGame(e.clientX, e.clientY);
          this.handleMahjongPlayTap(x, y);
        }
        this.mahjongPilePointerDown = false;
      };
      this.onTouchEndBound = (e) => this.handleTouchEnd(e);
      this.onTouchCancelBound = (e) => this.handleTouchCancel(e);
      this.foreground = new ForegroundGate({
        now: () => Date.now(),
        schedule: (fn, ms) => setTimeout(fn, ms),
        cancel: (id) => clearTimeout(id),
        pause: () => this.applyBackgroundPause(),
        resume: (reason) => {
          if (reason === "overlay-end") {
            this.applyForegroundResume("full");
            return;
          }
          if (reason === "overlay-abort") {
            this.applyForegroundResume("light");
            return;
          }
          this.applyForegroundResume(this.foregroundHidden ? "full" : "light");
        }
      });
    }
    /** 呼吸 / 按钮弹性幅度 */
    fxAmt(full, lite = full * 0.55) {
      return this.lite ? lite : full;
    }
    /**
     * 预加载糖果色小动物贴图 + 可爱场景背景。
     */
    async preloadAssets() {
      const jobs = [];
      for (const [kindText, src] of Object.entries(TILE_SPRITE_SRC)) {
        const kind = Number(kindText);
        if (!src) {
          continue;
        }
        jobs.push(() => this.loadTileImage(kind, src));
      }
      jobs.push(async () => {
        this.bgLobby = await this.loadBgImage(BG_SRC.lobby);
        clearMahjongPlaySceneBackgroundCache();
      });
      jobs.push(async () => {
        this.bgLevel = await this.loadBgImage(BG_SRC.level);
      });
      for (const [key, src] of Object.entries(BOOSTER_ICON_SRC)) {
        jobs.push(async () => {
          const img = await this.loadBgImage(src);
          if (img) {
            this.uiIcons.set(key, img);
          }
        });
      }
      for (const [key, src] of Object.entries(LOBBY_LADDER_ICON_SRC)) {
        jobs.push(async () => {
          const img = await this.loadBgImage(src);
          if (img) {
            this.uiIcons.set(`ladder-${key}`, img);
          }
        });
      }
      MACARON_SRC.forEach((src, index) => {
        jobs.push(async () => {
          const img = await this.loadBgImage(src);
          if (img) {
            this.uiIcons.set(`macaron-${index}`, img);
          }
        });
      });
      DIGIT_SRC.forEach((src, index) => {
        jobs.push(async () => {
          const img = await this.loadBgImage(src);
          if (img) {
            this.uiIcons.set(`digit-${index}`, img);
          }
        });
      });
      jobs.push(async () => {
        this.buriedPenguin = await this.loadBgImage(BURIED_TILE_SPRITE_SRC.penguin);
      });
      jobs.push(async () => {
        this.buriedSnowman = await this.loadBgImage(BURIED_TILE_SPRITE_SRC.snowman);
      });
      jobs.push(async () => {
        const img = await this.loadBgImage(MAHJONG_HALL_SRC);
        if (img) {
          this.uiIcons.set("mahjong_hall", img);
        }
        const badge = await this.loadBgImage(MAHJONG_NEW_BADGE_SRC);
        if (badge) {
          this.uiIcons.set("mahjong_new_badge", badge);
        }
        const [front, frontWhite, frontPetRabbit, top, bottom, left, right, back] = await Promise.all([
          this.loadBgImage(MAHJONG_SHELL_SRC.front),
          this.loadBgImage(MAHJONG_SHELL_SRC.frontWhite),
          this.loadBgImage(MAHJONG_SHELL_SRC.frontPetRabbit),
          this.loadBgImage(MAHJONG_SHELL_SRC.top),
          this.loadBgImage(MAHJONG_SHELL_SRC.bottom),
          this.loadBgImage(MAHJONG_SHELL_SRC.left),
          this.loadBgImage(MAHJONG_SHELL_SRC.right),
          this.loadBgImage(MAHJONG_SHELL_SRC.back)
        ]);
        const shellOk = applyMahjongShellImages({
          front,
          frontWhite,
          frontPetRabbit,
          top,
          bottom,
          left,
          right,
          back
        });
        console.info(
          "[mahjong-shell] preload",
          shellOk ? "ready" : "incomplete",
          shellOk ? "" : getMahjongShellMissingKeys().join(",")
        );
        for (const tool of Object.keys(MAHJONG_TOOL_ICON_SRC)) {
          const timg = await this.loadBgImage(MAHJONG_TOOL_ICON_SRC[tool]);
          if (timg) {
            this.mahjongToolIcons.set(tool, timg);
          }
        }
        this.mahjongSlotFullModalBg = await this.loadBgImage(MAHJONG_MODAL_BG_SRC.slotFull);
      });
      jobs.push(async () => {
        await this.mahjongThemeAssets.ensureTheme("default", 6);
      });
      if (isWxDesktopIdeHost()) {
        for (const job of jobs) {
          await job();
          await new Promise((resolve) => {
            setTimeout(resolve, 16);
          });
        }
      } else {
        await Promise.all(jobs.map((job) => job()));
      }
      this.requestPaint();
      void this.preloadDeferredAssets();
      const kickAfterAssets = () => {
        this.sceneBg.layout(this.width, this.height);
        this.needsPaint = true;
        this.kickRenderLoop();
      };
      if (!isWxDesktopIdeHost()) {
        setTimeout(kickAfterAssets, 40);
        setTimeout(kickAfterAssets, 200);
      } else {
        setTimeout(kickAfterAssets, 0);
      }
      console.info(
        "[crush-crush] assets loaded tiles=",
        this.tileImages.size,
        "bgLobby=",
        !!this.bgLobby,
        "bgLevel=",
        !!this.bgLevel,
        "uiIcons=",
        this.uiIcons.size
      );
    }
    /** 过关海报、小程序码：不挡首屏。 */
    async preloadDeferredAssets() {
      if (isWxDesktopIdeHost()) {
        await new Promise((resolve) => {
          setTimeout(resolve, 2800);
        });
      }
      await Promise.all([
        this.loadBgImage(WIN_CELEBRATE_SRC).then((img) => {
          this.winCelebrate = img;
        }),
        this.loadBgImage(SHARE_QR_SRC).then((img) => {
          if (img) {
            this.uiIcons.set("qr", img);
          }
        })
      ]);
      this.requestPaint();
    }
    /** 启动进入首页大厅（首页插画选关） */
    bootIntoLobby() {
      this.showLobby();
    }
    /** 兼容旧入口：直接开战 */
    async bootIntoPlay() {
      await this.enterLevel(this.resolveEntryLevelId());
    }
    /** 展示大厅（放弃当前对局态） */
    showLobby() {
      this.session.quitToLobby();
      this.leavingLobby = false;
      this.mode = "lobby";
      this.statusText = "";
      this.difficultyArt = null;
      this.pendingResult = null;
      this.offerCleanPrompt = false;
      this.hammerTargeting = false;
      this.hammerCursor = null;
      this.resultFx.stop();
      this.crushBursts = [];
      this.floatingScores = [];
      this.crushSparks = [];
      this.swapSlide = null;
      this.pendingPlayback = null;
      this.closeOverlay();
      this.prepareLobbyCamera();
      this.lobbySwipeHintShownAtMs = 0;
      this.lobbySwipeHintDismissed = false;
      this.syncLobbyBanner();
      this.boardView.bindInput((_a, _b, _c, _d) => {
      });
      this.maybeOfferLaunchProfileAuth();
    }
    resolveEntryLevelId() {
      const total = Math.max(1, this.session.getLevelCount());
      return Math.max(1, Math.min(this.session.progress.getHighestLevelId(), total));
    }
    /**
     * 启动渲染循环与触摸监听。
     */
    start() {
      if (this.started) {
        return;
      }
      this.started = true;
      this.unsub = this.session.events.subscribe((event) => {
        this.onGameEvent(event);
      });
      this.share.setProvider(() => this.buildSharePayload());
      if (!isWxDesktopIdeHost()) {
        this.share.enable();
      }
      if (this.session.takeDailyGrantToast()) {
        this.statusText = "\u4ECA\u65E5\u767B\u5F55 +1 \u9524\u5B50\uFF0C\u8F7B\u677E\u6162\u6162\u73A9";
      }
      const inviteToast = this.session.takeInviteToast();
      if (inviteToast) {
        this.statusText = inviteToast;
      }
      this.showLeaderboardRewardToast();
      wx.onTouchStart(this.onTouchStartBound);
      wx.onTouchMove(this.onTouchMoveBound);
      wx.onTouchEnd(this.onTouchEndBound);
      wx.onTouchCancel(this.onTouchCancelBound);
      if (isWxDesktopIdeHost()) {
        this.bindMahjongDesktopMouseListeners(true);
      }
      if (!isWxDesktopIdeHost()) {
        wx.onHide(this.onHideBound);
        wx.onShow(this.onShowBound);
        if (typeof wx.onAudioInterruptionBegin === "function") {
          wx.onAudioInterruptionBegin(this.onAudioInterruptionBeginBound);
        }
        if (typeof wx.onAudioInterruptionEnd === "function") {
          wx.onAudioInterruptionEnd(this.onAudioInterruptionEndBound);
        }
      }
      this.raf = this.scheduleFrame(this.loopBound);
      this.armLobbyBanner();
      if (!isWxDesktopIdeHost()) {
        setTimeout(() => this.tryStartBgm(), 200);
        setTimeout(() => void this.recommend.preload(), 900);
        setTimeout(() => this.session.warmupAds(), 1600);
        if (this.session.isLaunchInterstitialEnabled() && canCreateWxFullscreenAds()) {
          this.scheduleLaunchInterstitial();
        }
      }
      console.info(
        "[crush-crush] WxCanvasGameApp started",
        this.width,
        this.height,
        this.wxPlatform,
        "ide=",
        isWxDesktopIdeHost()
      );
    }
    /**
     * 进门广告：大厅先出一帧，广告就绪就弹插屏。
     * 微信启动频控（2001）拦了就在大厅里接着试；进关或超时则停。
     */
    scheduleLaunchInterstitial() {
      if (this.launchAdTimer) {
        return;
      }
      this.launchAdDeadline = Date.now() + this.session.getLaunchInterstitialTimeoutMs();
      this.armLaunchInterstitial(this.session.getLaunchInterstitialDelayMs());
    }
    armLaunchInterstitial(delayMs) {
      if (this.launchAdTimer) {
        return;
      }
      this.launchAdTimer = setTimeout(() => {
        this.launchAdTimer = 0;
        void this.tryLaunchInterstitial();
      }, delayMs);
    }
    clearLaunchInterstitialTimer() {
      if (!this.launchAdTimer) {
        return;
      }
      clearTimeout(this.launchAdTimer);
      this.launchAdTimer = 0;
    }
    async tryLaunchInterstitial() {
      if (this.mode !== "lobby" || this.leavingLobby) {
        return;
      }
      if (this.overlay !== "none" || this.foregroundHidden) {
        this.armLaunchInterstitialRetry();
        return;
      }
      this.beginAdOverlay();
      const result = await this.session.maybeShowLaunchInterstitial();
      const leftLobby = this.mode !== "lobby" || this.leavingLobby;
      if (result === "shown") {
        this.endAdOverlay();
      } else {
        this.inputMuteUntilMs = Date.now();
        this.foreground.abortOverlay();
      }
      console.info("[crush-crush] launch interstitial", result);
      if (leftLobby || result === "shown" || result === "stop") {
        return;
      }
      this.armLaunchInterstitialRetry();
    }
    armLaunchInterstitialRetry() {
      if (this.mode !== "lobby" || this.leavingLobby) {
        return;
      }
      if (Date.now() >= this.launchAdDeadline) {
        return;
      }
      this.armLaunchInterstitial(this.session.getLaunchInterstitialRetryMs());
    }
    /**
     * 大厅底部横幅：仅大厅且无弹层、在前台时展示。
     * 原生模板层级最高，设置/玩法打开时必须藏起来。
     */
    isLobbyBannerWanted() {
      return this.lobbyBannerArmed && !this.leavingLobby && this.mode === "lobby" && this.overlay === "none" && !this.foregroundHidden && this.session.isLobbyBannerEnabled();
    }
    interceptLobbyBanner() {
      this.clearLobbyBannerRetry();
      this.session.hideLobbyBanner();
    }
    syncLobbyBanner() {
      if (!this.isLobbyBannerWanted()) {
        this.interceptLobbyBanner();
        return;
      }
      this.foreground.holdNativeChrome(1600);
      void this.session.showLobbyBanner().then((result) => {
        if (!this.isLobbyBannerWanted()) {
          this.interceptLobbyBanner();
          return;
        }
        if (result === "completed") {
          this.lobbyBannerRetries = 0;
          return;
        }
        this.armLobbyBannerRetry();
      });
    }
    armLobbyBannerRetry() {
      if (this.lobbyBannerRetryTimer || this.lobbyBannerRetries >= 5) {
        return;
      }
      if (!this.isLobbyBannerWanted()) {
        return;
      }
      this.lobbyBannerRetries += 1;
      this.lobbyBannerRetryTimer = setTimeout(() => {
        this.lobbyBannerRetryTimer = 0;
        this.syncLobbyBanner();
      }, 2500);
    }
    clearLobbyBannerRetry() {
      if (this.lobbyBannerRetryTimer) {
        clearTimeout(this.lobbyBannerRetryTimer);
        this.lobbyBannerRetryTimer = 0;
      }
    }
    /**
     * 真机首帧后再创建原生横幅。开发者工具不创建，避免 insertTextView parent not found。
     */
    armLobbyBanner() {
      if (this.lobbyBannerTimer || this.lobbyBannerArmed) {
        return;
      }
      if (isWxDesktopIdeHost() || !canCreateWxNativeAds()) {
        return;
      }
      if (!this.session.isLobbyBannerEnabled()) {
        return;
      }
      const delayMs = 1200;
      this.lobbyBannerTimer = setTimeout(() => {
        this.lobbyBannerTimer = 0;
        this.lobbyBannerArmed = true;
        this.syncLobbyBanner();
      }, delayMs);
    }
    requestPaint() {
      this.needsPaint = true;
      this.frameErrors = 0;
      this.ensureLoop();
    }
    markUserActivity() {
      this.lastInteractMs = Date.now();
      this.frameErrors = 0;
      this.requestPaint();
    }
    ensureLoop() {
      if (!this.started || this.foregroundHidden || this.raf) {
        return;
      }
      this.raf = this.scheduleFrame(this.loopBound);
    }
    sceneIsBusy() {
      if (this.animator.isPlaying() || this.swapSlide || this.pendingPlayback || this.buriedFx.size > 0) {
        return true;
      }
      if (this.hammerTargeting) {
        return true;
      }
      if (this.mode === "crush" || this.mode === "clean") {
        return true;
      }
      if (this.shakeMs > 0 || this.hudBarPulse > 0 || this.hudScorePunch > 1) {
        return true;
      }
      const now = this.nowMs || Date.now();
      if (this.toastText && now < this.toastUntilMs) {
        return true;
      }
      if (this.difficultyArt && now < this.difficultyArt.startMs + this.difficultyArt.durationMs) {
        return true;
      }
      if (this.floatingScores.length || this.crushSparks.length || this.crushBursts.length) {
        return true;
      }
      if (this.levelBanners.length > 0 || this.goalFlyers.length > 0) {
        return true;
      }
      if (this.dailyTaskPop && now < this.dailyTaskPop.startMs + 2400) {
        return true;
      }
      if (this.mode === "result" && this.resultStars > 0 && now < this.resultOpenedMs + starPopTotalMs(this.resultStars) + 100) {
        return true;
      }
      if (this.lobbyDrag || this.lobbyCamAutoTarget !== null) {
        return true;
      }
      if (Math.abs(this.lobbyCamVel) > 0.02) {
        return true;
      }
      if (this.resultFx.isActive()) {
        return true;
      }
      if (this.mode === "mahjong_play" && this.mahjongPileSwayAnimating()) {
        return true;
      }
      if (this.mode === "mahjong_play" && this.mahjongSlotFlight.anims.length > 0) {
        return true;
      }
      if (this.mode === "mahjong_play" && this.mahjongSlotClearRings.length > 0) {
        return true;
      }
      if (this.mode === "mahjong_play" && this.mahjongStageBanner) {
        return true;
      }
      if (this.mode === "mahjong_play" && this.mahjongResultRevealStartMs > 0 && now < this.mahjongResultRevealStartMs + 560) {
        return true;
      }
      if (this.mode === "mahjong_play") {
        const mj = this.session.mahjong.getActiveGame();
        if ((mj == null ? void 0 : mj.phase) === "playing") {
          if (mj.remainingMs > 0 && mj.remainingMs <= 45e3) {
            return true;
          }
          if (mj.slots.length >= mj.maxSlots() - 1) {
            return true;
          }
        }
      }
      return false;
    }
    mahjongPileSwayAnimating() {
      const s = this.mahjongPileSway;
      return Math.abs(s.vx) > 0.07 || Math.abs(s.vy) > 0.07 || Math.abs(s.vr) > 6e-5 || Math.abs(s.ox) > 0.35 || Math.abs(s.oy) > 0.35 || Math.abs(s.rot) > 35e-5;
    }
    handleMahjongPlayTap(x, y) {
      const mjHit = hitMahjongButton(this.mahjongButtons, x, y);
      if (mjHit) {
        void this.handleMahjongUi(mjHit);
        return;
      }
      if (this.mahjongToolOffer) {
        return;
      }
      const game = this.session.mahjong.getActiveGame();
      if ((game == null ? void 0 : game.phase) !== "playing" || this.mahjongPileDragMoved) {
        return;
      }
      const tileIdx = hitMahjongTile(this.mahjongTileHits, x, y);
      if (tileIdx === null) {
        return;
      }
      this.session.playUiSfx();
      const starsBefore = game.starsThisRun;
      const tileType = game.pile[tileIdx];
      const targetSlot = Math.min(game.maxSlots() - 1, game.slots.length);
      const fromHit = this.mahjongTileHits.find((h) => h.index === tileIdx);
      const slotRect = mahjongSlotTileRect(this.width, this.height, targetSlot);
      const slotsBeforeTap = game.slots.slice();
      this.session.mahjong.trackTileTap(game.level);
      const tapped = game.tapPile(tileIdx);
      if (!tapped) {
        this.requestPaint();
        return;
      }
      if (fromHit) {
        launchMahjongSlotFlight(
          this.mahjongSlotFlight,
          slotsBeforeTap,
          createMahjongFlyAnim({
            type: tileType,
            fromX: fromHit.x,
            fromY: fromHit.y,
            fromW: fromHit.w,
            fromH: fromHit.h,
            fromRot: fromHit.rot,
            toX: slotRect.x,
            toY: slotRect.y,
            toW: slotRect.w,
            toH: slotRect.h,
            startMs: Date.now()
          })
        );
      }
      if (game.starsThisRun > starsBefore) {
        this.session.mahjong.trackTripleClear(game.level, game.starsThisRun);
      }
      if (game.level === 1) {
        game.guideShown = true;
      }
      if (game.phase === "won") {
        this.mahjongWinShownAtMs = this.nowMs || Date.now();
      }
      if (game.phase === "lost") {
        void this.session.mahjong.persistFailedRun();
      } else {
        void this.session.mahjong.saveActiveRun();
      }
      this.markUserActivity();
      this.kickRenderLoop();
    }
    onMahjongTileLandedInSlot(ev) {
      if (ev.removedCount < 3) {
        return;
      }
      const now = this.nowMs || Date.now();
      const triples = Math.floor(ev.removedCount / 3);
      const cx = ev.anim.toX + ev.anim.toW / 2;
      const cy = ev.anim.toY + ev.anim.toH / 2;
      this.session.playMatchSfx();
      this.shakeMs = Math.max(this.shakeMs, 100 + triples * 28);
      spawnMahjongSlotClearRings(this.mahjongSlotClearRings, cx, cy, now, triples);
      const starGain = triples * mahjongStarPerTriple();
      const coinGain = triples * mahjongCoinPerTriple();
      this.floatingScores.push({
        x: cx,
        y: cy - 28,
        text: `+${starGain}\u2605`,
        startMs: now,
        durationMs: 920,
        color: "#ffd43b",
        fontSize: 22
      });
      if (coinGain > 0) {
        this.floatingScores.push({
          x: cx,
          y: cy - 4,
          text: `+${coinGain}`,
          startMs: now + 60,
          durationMs: 880,
          color: "#ffe566",
          fontSize: 20
        });
      }
      const sparkCount = this.cheapFx ? 6 : 10;
      for (let i = 0; i < sparkCount; i += 1) {
        const ang = Math.PI * 2 * i / sparkCount + Math.random() * 0.35;
        const speed = 48 + Math.random() * 95;
        this.crushSparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 36,
          startMs: now,
          durationMs: 380 + Math.random() * 220,
          color: ["#96f2d7", "#51cf66", "#ffd43b", "#ffffff"][i % 4],
          style: i % 3 === 0 ? "star" : "dot"
        });
      }
      this.kickRenderLoop();
    }
    isInMahjongPileArea(x, y) {
      const m = mahjongPlayMetrics(this.width, this.height);
      const pad = 6;
      return x >= pad && x <= this.width - pad && y >= m.pileTop - 28 && y <= m.pileBottom + 28;
    }
    bindMahjongDesktopMouseListeners(bind) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const g = globalThis;
      const win = g.window;
      if (!(win == null ? void 0 : win.addEventListener) || !win.removeEventListener) {
        const canvasNode = this.canvas;
        if (bind) {
          (_a = canvasNode.addEventListener) == null ? void 0 : _a.call(canvasNode, "mousemove", this.onMahjongMouseMoveBound);
          (_b = canvasNode.addEventListener) == null ? void 0 : _b.call(canvasNode, "mousedown", this.onMahjongMouseDownBound);
          (_c = canvasNode.addEventListener) == null ? void 0 : _c.call(canvasNode, "mouseup", this.onMahjongMouseUpBound);
          (_d = canvasNode.addEventListener) == null ? void 0 : _d.call(canvasNode, "mouseleave", this.onMahjongMouseUpBound);
        } else {
          (_e = canvasNode.removeEventListener) == null ? void 0 : _e.call(canvasNode, "mousemove", this.onMahjongMouseMoveBound);
          (_f = canvasNode.removeEventListener) == null ? void 0 : _f.call(canvasNode, "mousedown", this.onMahjongMouseDownBound);
          (_g = canvasNode.removeEventListener) == null ? void 0 : _g.call(canvasNode, "mouseup", this.onMahjongMouseUpBound);
          (_h = canvasNode.removeEventListener) == null ? void 0 : _h.call(canvasNode, "mouseleave", this.onMahjongMouseUpBound);
        }
        return;
      }
      if (bind) {
        win.addEventListener("mousemove", this.onMahjongMouseMoveBound);
        win.addEventListener("mousedown", this.onMahjongMouseDownBound);
        win.addEventListener("mouseup", this.onMahjongMouseUpBound);
      } else {
        win.removeEventListener("mousemove", this.onMahjongMouseMoveBound);
        win.removeEventListener("mousedown", this.onMahjongMouseDownBound);
        win.removeEventListener("mouseup", this.onMahjongMouseUpBound);
      }
    }
    /** 开发者工具：DOM 坐标 → 逻辑画布坐标 */
    mapClientPointToGame(clientX, clientY) {
      const canvas = this.canvas;
      if (typeof canvas.getBoundingClientRect === "function") {
        const rect = canvas.getBoundingClientRect();
        const scaleX = this.width / Math.max(1, rect.width);
        const scaleY = this.height / Math.max(1, rect.height);
        return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY
        };
      }
      return { x: clientX, y: clientY };
    }
    handleMahjongPilePointerMove(x, y, force = false, gain = 1) {
      if (this.mode !== "mahjong_play" || this.overlay !== "none") {
        return;
      }
      if (!force && !this.mahjongPilePointerDown && !this.isInMahjongPileArea(x, y)) {
        this.mahjongPileLastX = x;
        this.mahjongPileLastY = y;
        return;
      }
      const dx = (x - this.mahjongPileLastX) * gain;
      const dy = (y - this.mahjongPileLastY) * gain;
      if (dx !== 0 || dy !== 0) {
        const game = this.session.mahjong.getActiveGame();
        if ((game == null ? void 0 : game.phase) === "playing") {
          const pileHits = pilePosesToHits(game.pilePoses, this.width, this.height);
          pokeMahjongTilesOnPointerMove(
            pileHits,
            this.mahjongTileJitters,
            this.mahjongPileLastX,
            this.mahjongPileLastY,
            x,
            y,
            dx,
            dy
          );
        }
        if (Math.hypot(dx, dy) > 2) {
          this.mahjongPileDragMoved = true;
        }
        this.markUserActivity();
        this.requestPaint();
        this.kickRenderLoop();
      }
      this.mahjongPileLastX = x;
      this.mahjongPileLastY = y;
    }
    resetMahjongPileSway() {
      const s = this.mahjongPileSway;
      s.ox = 0;
      s.oy = 0;
      s.rot = 0;
      s.vx = 0;
      s.vy = 0;
      s.vr = 0;
      this.mahjongTileJitters.length = 0;
      this.mahjongPileDragMoved = false;
      this.mahjongPilePointerDown = false;
    }
    resetMahjongSlotAnimations() {
      resetMahjongSlotFlight(this.mahjongSlotFlight);
      this.mahjongSlotClearRings.length = 0;
    }
    queueMahjongIntroBanner() {
      var _a;
      const game = this.session.mahjong.getActiveGame();
      if (!game) {
        return;
      }
      this.mahjongStageBanner = makeMahjongIntroBanner(
        game.level,
        mahjongIntroSubtitle((_a = this.mahjongActiveTheme) == null ? void 0 : _a.name)
      );
      this.mahjongFailBannerQueued = false;
      this.mahjongResultRevealStartMs = 0;
      this.kickRenderLoop();
    }
    syncMahjongFailStageBanner(game) {
      if (game.phase !== "lost") {
        this.mahjongFailBannerQueued = false;
        return;
      }
      if (game.failReason === "slot_full" && !this.mahjongSlotFullOfferDismissed) {
        return;
      }
      if (this.mahjongFailBannerQueued) {
        return;
      }
      this.mahjongFailBannerQueued = true;
      this.mahjongStageBanner = makeMahjongFailBanner(mahjongFailReasonLabel(game.failReason));
      this.mahjongResultRevealStartMs = 0;
      this.shakeMs = Math.max(this.shakeMs, 220);
      this.kickRenderLoop();
    }
    updateMahjongStageBanner(now) {
      const banner = this.mahjongStageBanner;
      if (!banner) {
        return;
      }
      if (banner.startMs === 0) {
        banner.startMs = now;
      }
      const frame = bannerFrame(banner, now);
      if (banner.kind === "mahjong_fail" && frame.done && this.mahjongResultRevealStartMs === 0) {
        this.mahjongResultRevealStartMs = now;
      }
      if (frame.done) {
        this.mahjongStageBanner = null;
      }
    }
    shouldDeferMahjongResultModal(game) {
      var _a;
      if (game.phase !== "lost") {
        return false;
      }
      if (game.failReason === "slot_full" && !this.mahjongSlotFullOfferDismissed) {
        return false;
      }
      return ((_a = this.mahjongStageBanner) == null ? void 0 : _a.kind) === "mahjong_fail";
    }
    /** 大厅呼吸、结算彩带、粉碎倒计时、公告泡泡需要持续转；对局静止盘面可停循环。 */
    wantsAmbientFx() {
      return this.mode === "lobby" || this.mode === "result" || this.mode === "crush" || this.mode === "clean";
    }
    /** 首页公告泡泡在漂：开发者工具空闲停循环时也要慢速续画，避免冻在半路。 */
    /** 每日任务面板动效：真机全速；开发者工具降帧，减轻模拟器崩溃。 */
    dailyTasksOverlayNeedsTick() {
      return this.overlay === "daily_tasks";
    }
    logThrottledDrawError(label, err) {
      const now = this.nowMs || Date.now();
      if (now - this.lastDrawErrorLogMs < 3e3) {
        return;
      }
      this.lastDrawErrorLogMs = now;
      console.error(label, err);
    }
    lobbyNoticeBubbleNeedsTick() {
      if (this.mode !== "lobby" || this.overlay !== "none") {
        return false;
      }
      if (this.lobbyCamY > this.height * 0.18) {
        return false;
      }
      const notice = lobbyNoticeForMahjongState(this.session.isMahjongHallUnlocked());
      return lobbyNoticeBubbleLines({
        body: notice.body,
        bubbles: notice.bubbles
      }).length > 0;
    }
    useCanvasRaf() {
      this.baseFrameDelayMs = 16;
      this.frameDelayMs = 16;
      this.scheduleFrame = (cb) => {
        const raf = this.canvas.requestAnimationFrame;
        if (typeof raf === "function") {
          return raf.call(this.canvas, cb);
        }
        return setTimeout(() => cb(Date.now()), 16);
      };
      this.cancelFrame = (id) => this.clearScheduledFrame(id);
    }
    useTimeoutFrames(delayMs = this.frameDelayMs) {
      this.frameDelayMs = Math.max(16, delayMs);
      this.scheduleFrame = (cb) => setTimeout(() => cb(Date.now()), this.frameDelayMs);
      this.cancelFrame = (id) => this.clearScheduledFrame(id);
    }
    clearScheduledFrame(id) {
      if (!id) {
        return;
      }
      clearTimeout(id);
      const cancel = this.canvas.cancelAnimationFrame;
      if (typeof cancel === "function") {
        try {
          cancel.call(this.canvas, id);
        } catch (e) {
        }
      }
    }
    onAnimationFrame() {
      if (!this.started || this.foregroundHidden) {
        return;
      }
      if (this.frameGuard) {
        return;
      }
      this.frameGuard = true;
      let keepLoop = false;
      try {
        if (this.pumping) {
          keepLoop = this.needsPaint;
          return;
        }
        this.pumping = true;
        try {
          const now = Date.now();
          const dt = this.lastFrameMs > 0 ? Math.min(64, now - this.lastFrameMs) : 16;
          this.lastFrameMs = now;
          this.nowMs = now;
          this.animator.update(this.nowMs);
          this.resultFx.update(this.nowMs);
          this.updateSwapSlide(this.nowMs);
          this.updateBuriedCollect(this.nowMs);
          if (this.mode === "lobby") {
            this.updateLobbyCamera(dt);
          }
          if (this.mode === "mahjong_play") {
            const mj = this.session.mahjong.getActiveGame();
            if ((mj == null ? void 0 : mj.phase) === "playing") {
              mj.tick(dt);
              if (mj.phase === "lost") {
                void this.session.mahjong.persistFailedRun();
              }
            }
            if (updateMahjongPileSway(this.mahjongPileSway, dt)) {
              this.requestPaint();
            }
            if (updateMahjongTileJitters(this.mahjongTileJitters, dt)) {
              this.requestPaint();
            }
            if (mj && this.mahjongSlotFlight.anims.length > 0) {
              pruneMahjongSlotFlight(
                this.mahjongSlotFlight,
                now,
                (slots, tile) => mj.slotsAfterAppend(slots, tile),
                (ev) => this.onMahjongTileLandedInSlot(ev)
              );
              this.requestPaint();
            }
            if (pruneMahjongSlotClearRings(this.mahjongSlotClearRings, now)) {
              this.requestPaint();
            }
            if (this.mode === "mahjong_play" && this.shakeMs > 0) {
              this.shakeMs = Math.max(0, this.shakeMs - dt);
            }
            this.updateMahjongStageBanner(now);
            if ((mj == null ? void 0 : mj.phase) === "lost") {
              this.syncMahjongFailStageBanner(mj);
            }
            this.pruneCrushBursts(now);
            if ((mj == null ? void 0 : mj.phase) === "won") {
              if (this.mahjongWinShownAtMs === 0) {
                this.mahjongWinShownAtMs = now;
              }
              if (!this.mahjongSuppressAutoNext && now - this.mahjongWinShownAtMs >= MAHJONG_AUTO_NEXT_MS) {
                void this.advanceMahjongAfterWin();
              }
            } else {
              this.mahjongWinShownAtMs = 0;
            }
          }
          if (this.mode === "crush" || this.mode === "clean" || this.mode === "playing" || this.mode === "result") {
            this.pruneCrushBursts(now);
            if (this.shakeMs > 0) {
              this.shakeMs = Math.max(0, this.shakeMs - dt);
            }
            if (this.hudBarPulse > 0) {
              this.hudBarPulse = Math.max(0, this.hudBarPulse - dt);
            }
            if (this.hudScorePunch > 1) {
              this.hudScorePunch = Math.max(1, this.hudScorePunch - dt * 22e-4);
            }
            if (this.mode === "crush" || this.mode === "clean") {
              this.updateBurstScoreBar(dt);
            }
          }
          if ((this.mode === "crush" || this.mode === "clean") && this.overlay === "none") {
            this.session.tickCrushReward(dt);
          }
          const animating = this.sceneIsBusy();
          const dailyTasksFx = this.dailyTasksOverlayNeedsTick();
          const ambientBubble = this.lobbyNoticeBubbleNeedsTick();
          const mjGame = this.session.mahjong.getActiveGame();
          const mahjongPlaying = this.mode === "mahjong_play" && (mjGame == null ? void 0 : mjGame.phase) === "playing";
          const mahjongWon = (mjGame == null ? void 0 : mjGame.phase) === "won";
          let mahjongTimerPaint = false;
          if (mahjongPlaying && mjGame) {
            const sec = Math.ceil(mjGame.remainingMs / 1e3);
            if (sec !== this.mahjongTimerPaintSec) {
              this.mahjongTimerPaintSec = sec;
              mahjongTimerPaint = true;
            }
          } else if (!mahjongWon) {
            this.mahjongTimerPaintSec = -1;
          }
          const mahjongKeepLoop = mahjongPlaying || mahjongWon;
          const desktopIde = isWxDesktopIdeHost();
          keepLoop = shouldKeepRenderLoop({
            animating,
            lastInteractMs: this.lastInteractMs,
            nowMs: now,
            idleStopMs: resolveRenderIdleStopMs({
              desktopIde,
              ambientFx: this.wantsAmbientFx()
            })
          }) || ambientBubble || dailyTasksFx || mahjongKeepLoop || animating;
          this.frameDelayMs = resolveNextFrameDelayMs({
            animating: animating || dailyTasksFx,
            desktopIde,
            baseDelayMs: this.baseFrameDelayMs
          });
          if (ambientBubble && !animating && !dailyTasksFx) {
            this.frameDelayMs = Math.max(this.frameDelayMs, desktopIde ? 90 : 70);
          }
          if (dailyTasksFx && desktopIde) {
            this.frameDelayMs = Math.max(this.frameDelayMs, 110);
          } else if (dailyTasksFx) {
            this.frameDelayMs = Math.max(this.frameDelayMs, 66);
          }
          if (mahjongKeepLoop && !animating && !dailyTasksFx && desktopIde) {
            this.frameDelayMs = Math.max(this.frameDelayMs, 280);
          } else if (mahjongKeepLoop && !animating && !dailyTasksFx) {
            this.frameDelayMs = Math.max(this.frameDelayMs, desktopIde ? 160 : 200);
          }
          const shouldDraw = this.needsPaint || animating || ambientBubble || dailyTasksFx || mahjongTimerPaint || mahjongWon;
          if (shouldDraw) {
            this.draw();
            this.frameErrors = 0;
            if (!animating && !mahjongTimerPaint && !mahjongWon) {
              this.needsPaint = false;
            }
          }
        } catch (err) {
          this.logThrottledDrawError("[crush-crush] frame failed", err);
          this.frameErrors += 1;
          this.needsPaint = !shouldBackoffAfterFrameErrors(this.frameErrors);
          keepLoop = this.needsPaint;
        } finally {
          this.pumping = false;
        }
        if (!this.foregroundHidden && this.started && keepLoop) {
          this.raf = this.scheduleFrame(this.loopBound);
        } else {
          this.raf = 0;
        }
      } finally {
        this.frameGuard = false;
      }
    }
    applyBackgroundPause() {
      if (this.foregroundHidden) {
        return;
      }
      this.foregroundHidden = true;
      this.cancelFrame(this.raf);
      this.raf = 0;
      this.pumping = false;
      this.frameGuard = false;
      this.needsPaint = false;
      this.session.suspendForBackground();
      setTimeout(() => {
        if (!this.foregroundHidden) {
          return;
        }
        this.session.hideLobbyBanner();
      }, 80);
    }
    clearResumeFollowups() {
      for (const id of this.resumeFollowupTimers) {
        clearTimeout(id);
      }
      this.resumeFollowupTimers = [];
    }
    applyForegroundResume(kind) {
      const wasHidden = this.foregroundHidden;
      this.foregroundHidden = false;
      this.clearResumeFollowups();
      const token = ++this.resumeToken;
      const desktopIde = isWxDesktopIdeHost();
      const restoreNow = kind === "full";
      const recover = (forceSurface) => {
        if (token !== this.resumeToken || this.foregroundHidden) {
          return;
        }
        this.lastFrameMs = 0;
        this.nowMs = Date.now();
        this.pumping = false;
        this.frameGuard = false;
        if (shouldRestoreCanvasSurface({
          desktopIde,
          forceSurface
        })) {
          this.restoreCanvasSurface();
        }
        this.needsPaint = true;
        try {
          this.draw();
        } catch (err) {
          console.error("[crush-crush] resume draw failed", err);
        }
        this.kickRenderLoop();
      };
      recover(restoreNow);
      if (!desktopIde && restoreNow) {
        this.resumeFollowupTimers.push(
          setTimeout(() => recover(false), 80)
        );
        this.resumeFollowupTimers.push(
          setTimeout(() => {
            const expected = Math.max(1, Math.floor(this.width * this.dpr));
            recover(shouldFollowupRestoreCanvas(this.canvas.width, expected));
          }, 360)
        );
        this.resumeFollowupTimers.push(
          setTimeout(() => {
            if (token !== this.resumeToken || this.foregroundHidden) {
              return;
            }
            this.sceneBg.layout(this.width, this.height);
            this.needsPaint = true;
            try {
              this.draw();
            } catch (err) {
              console.error("[crush-crush] resume lobby redraw failed", err);
            }
            this.kickRenderLoop();
          }, 120)
        );
      }
      if (shouldResumeBgm({
        bgmStarted: this.bgmStarted,
        muted: this.session.isMuted(),
        wasHidden: wasHidden || restoreNow,
        longAway: restoreNow || wasHidden
      })) {
        this.session.resumeFromBackground();
      }
      if (this.mode === "lobby" && !this.leavingLobby) {
        this.syncLobbyBanner();
      } else {
        this.interceptLobbyBanner();
      }
    }
    kickRenderLoop() {
      if (!this.started) {
        return;
      }
      this.needsPaint = true;
      this.cancelFrame(this.raf);
      this.raf = 0;
      this.pumping = false;
      this.frameGuard = false;
      this.raf = setTimeout(() => {
        this.raf = 0;
        this.loopBound();
      }, 16);
    }
    beginAdOverlay() {
      this.boardView.onPointerCancel();
      this.lobbyDrag = null;
      this.crushTapOnDown = false;
      this.inputMuteUntilMs = Number.POSITIVE_INFINITY;
      this.foreground.enterOverlay();
    }
    endAdOverlay() {
      const plan = afterAdClosed(isWxDesktopIdeHost());
      setTimeout(() => {
        this.inputMuteUntilMs = Date.now() + plan.muteMs;
        this.foreground.leaveOverlay();
      }, plan.settleMs);
    }
    isInputMuted() {
      return Date.now() < this.inputMuteUntilMs;
    }
    clearAdPrompt() {
      const adLike = (text) => text.includes("\u5E7F\u544A");
      if (adLike(this.toastText) || adLike(this.statusText)) {
        this.toastText = "";
        this.toastUntilMs = 0;
        if (adLike(this.statusText)) {
          this.statusText = "";
        }
      }
      if (typeof wx.hideToast === "function") {
        try {
          wx.hideToast();
        } catch (e) {
        }
      }
      this.requestPaint();
    }
    async runDuringAd(work) {
      const started = Date.now();
      this.beginAdOverlay();
      try {
        return await work();
      } finally {
        if (shouldAbortAdOverlay(Date.now() - started)) {
          this.inputMuteUntilMs = Date.now();
          this.foreground.abortOverlay();
        } else {
          this.endAdOverlay();
        }
      }
    }
    /** 离开结算前先收尾粉碎/清洁/失败确认，再弹插屏或切关。 */
    settleBurstModesForLeave() {
      if (this.session.fsm.getCurrent() === "LevelFailed") {
        this.session.acknowledgeFailure();
      }
      if (this.session.fsm.getCurrent() === "CrushReward") {
        this.session.finishCrushReward();
      }
      if (this.session.fsm.getCurrent() === "Cleaning") {
        this.session.finishCleaningMode();
      }
    }
    async maybeRunSettleInterstitial() {
      if (this.pendingResult === "won" && this.session.fsm.getCurrent() === "Settle") {
        await this.runDuringAd(() => this.session.maybeShowSettleInterstitial());
      }
    }
    /** 从后台/广告回来时 2D 缓冲常被丢掉；同尺寸赋值不会重建，必须先撑一下再改回。 */
    restoreCanvasSurface() {
      const pixelW = Math.max(1, Math.floor(this.width * this.dpr));
      const pixelH = Math.max(1, Math.floor(this.height * this.dpr));
      try {
        this.canvas.width = pixelW + 1;
        this.canvas.height = pixelH + 1;
      } catch (e) {
      }
      this.canvas.width = pixelW;
      this.canvas.height = pixelH;
      const next = this.canvas.getContext("2d");
      if (next) {
        this.ctx = next;
      }
      if (typeof this.ctx.setTransform === "function") {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      this.ctx.scale(this.dpr, this.dpr);
      this.applyCanvasDrawQuality();
      this.ctx.fillStyle = "#b6e8fc";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
    applyCanvasDrawQuality() {
      this.ctx.imageSmoothingEnabled = true;
      const quality = this.ctx;
      if (quality.imageSmoothingQuality) {
        quality.imageSmoothingQuality = "high";
      }
    }
    drawTileSprite(sprite, x, y, size) {
      this.ctx.drawImage(sprite, x, y, size, size);
    }
    /**
     * 停止循环并卸载监听。
     */
    dispose() {
      var _a;
      this.clearLaunchInterstitialTimer();
      if (this.lobbyBannerTimer) {
        clearTimeout(this.lobbyBannerTimer);
        this.lobbyBannerTimer = 0;
      }
      this.clearLobbyBannerRetry();
      this.clearResumeFollowups();
      this.foreground.dispose();
      this.cancelFrame(this.raf);
      wx.offHide(this.onHideBound);
      wx.offShow(this.onShowBound);
      if (typeof wx.offAudioInterruptionBegin === "function") {
        wx.offAudioInterruptionBegin(this.onAudioInterruptionBeginBound);
      }
      if (typeof wx.offAudioInterruptionEnd === "function") {
        wx.offAudioInterruptionEnd(this.onAudioInterruptionEndBound);
      }
      wx.offTouchStart(this.onTouchStartBound);
      wx.offTouchMove(this.onTouchMoveBound);
      wx.offTouchEnd(this.onTouchEndBound);
      wx.offTouchCancel(this.onTouchCancelBound);
      if (isWxDesktopIdeHost()) {
        this.bindMahjongDesktopMouseListeners(false);
      }
      (_a = this.unsub) == null ? void 0 : _a.call(this);
      this.unsub = null;
      this.share.dispose();
      this.recommend.dispose();
      this.boardView.dispose();
      this.destroyGameClubButton();
      this.session.hideLobbyBanner();
    }
    onGameEvent(event) {
      var _a, _b, _c, _d;
      this.requestPaint();
      if (event.type === "InviteReward") {
        this.notifyUser(
          event.kind === "invitee" ? "\u9080\u8BF7\u793C\u5230\u8D26 +1 \u9524\u5B50" : `\u597D\u53CB\u901A\u5173\u4E86\uFF0C\u4F60 +${event.hammers} \u9524\u5B50`,
          "\u9524\u5B50\u5230\u8D26"
        );
        return;
      }
      if (event.type === "PostClearAnnouncement") {
        return;
      }
      if (event.type === "LeaderboardReward") {
        this.showLeaderboardRewardToast();
        return;
      }
      if (event.type === "DailyTaskCompleted") {
        this.dailyTaskPop = {
          text: notice_default.dailyTasks.taskDone.replace("{title}", event.title),
          startMs: this.nowMs || Date.now()
        };
        this.shakeMs = Math.max(this.shakeMs, 120);
        return;
      }
      if (event.type === "LevelWon") {
        this.pendingResult = "won";
        this.statusText = "\u5173\u5361\u80DC\u5229\uFF01";
        this.enqueueLevelBanner(makeLevelBanner("goal", "\u76EE\u6807\u8FBE\u6210\uFF01"));
        this.shakeMs = Math.max(this.shakeMs, 340);
        this.hudScorePunch = Math.max(this.hudScorePunch, 1.14);
        if (!this.animator.isPlaying() && !this.swapSlide) {
          this.afterLevelResolved();
        }
        return;
      }
      if (event.type === "LevelFailed") {
        this.pendingResult = "failed";
        this.statusText = "\u6B65\u6570\u7528\u5B8C\u4E86\uFF0C\u5C31\u5DEE\u4E00\u70B9\uFF01";
        if (!this.animator.isPlaying() && !this.swapSlide) {
          this.afterLevelResolved();
        }
        return;
      }
      if (event.type === "SwapAccepted") {
        this.beginSwapSlide(event.rowA, event.colA, event.rowB, event.colB, false);
        const total = (_b = (_a = this.session.getLevelConfig()) == null ? void 0 : _a.moves) != null ? _b : 0;
        if (!this.lowMovesWarned && total > 8 && this.session.getMovesLeft() === 5) {
          this.lowMovesWarned = true;
          this.enqueueLevelBanner(makeLevelBanner("low_moves", "\u53EA\u5269 5 \u6B65\uFF01", "\u6293\u7D27\u5B8C\u6210\u76EE\u6807"));
        }
        return;
      }
      if (event.type === "SwapRejected") {
        this.beginSwapSlide(event.rowA, event.colA, event.rowB, event.colB, true);
        this.boardView.selectCell(event.rowA, event.colA);
        return;
      }
      if (event.type === "ResolvePlayback") {
        if (this.mode === "crush" || this.mode === "clean" || this.mode === "result") {
          return;
        }
        this.pendingPlayback = {
          rows: event.rows,
          cols: event.cols,
          cells: event.cells,
          tileIds: event.tileIds,
          sparkles: event.sparkles,
          cloud: event.cloud,
          ice: event.ice,
          egg: event.egg,
          vine: event.vine,
          waves: event.waves
        };
        if (!this.swapSlide) {
          this.flushPendingPlayback();
        }
        return;
      }
      if (event.type === "MovesBonusApplied") {
        this.statusText = event.movesConverted > 0 ? `\u5269\u4F59 ${event.movesConverted} \u6B65\u52A0\u6210\u95EA\u5149\uFF01` : "\u6B65\u6570\u52A0\u6210";
        if (event.movesConverted > 0) {
          this.enqueueLevelBanner(
            makeLevelBanner("bonus", "\u6B65\u6570\u5956\u52B1\u65F6\u95F4\uFF01", `\u5269\u4F59 ${event.movesConverted} \u6B65\u53D8\u95EA\u5149`)
          );
        }
        this.syncBoardView();
        return;
      }
      if (event.type === "MovesBonusDone") {
        if (event.bonusScore > 0) {
          this.statusText = `\u6B65\u6570\u52A0\u6210 +${event.bonusScore}`;
        }
        return;
      }
      if (event.type === "CrushBurstFired") {
        const board = this.session.getBoard();
        const cols = (_c = board == null ? void 0 : board.size.cols) != null ? _c : 8;
        const clearedCells = event.clearedIndices.map((index) => ({
          row: Math.floor(index / cols),
          col: index % cols
        }));
        const now = this.nowMs || Date.now();
        this.crushBursts.push({
          row: event.row,
          col: event.col,
          radius: event.radius,
          startMs: now,
          durationMs: event.scoreAdded > 0 ? 560 : 320,
          scoreAdded: event.scoreAdded,
          clearedCells
        });
        if (this.mode === "crush" || this.mode === "clean") {
          this.syncBoardView();
          this.spawnCrushFeedback(event.row, event.col, event.scoreAdded, clearedCells, now);
          if (event.scoreAdded > 0) {
            this.crushHasTapped = true;
            this.statusText = this.mode === "clean" ? `\u6253\u626B\u5E72\u51C0 +${event.scoreAdded}` : `\u7830\uFF01\u7C89\u788E +${event.scoreAdded}`;
            this.shakeMs = Math.min(180, 60 + event.scoreAdded);
            this.vibrateLight();
          } else {
            this.statusText = this.mode === "clean" ? "\u70B9\u6709\u5C0F\u52A8\u7269\u7684\u683C\u5B50\u6E05\u626B\uFF01" : "\u518D\u70B9\u6709\u52A8\u7269\u7684\u683C\u5B50\uFF01";
          }
        }
        return;
      }
      if (event.type === "CrushEnded") {
        this.lastCrushTapCount = this.session.getCrushTapCount();
        this.statusText = event.leftoverCleared > 0 ? `\u65F6\u95F4\u5230\uFF0C\u5269\u4F59\u5C0F\u52A8\u7269\u6536\u5C3E\u7206\u70B8 +${event.crushScore}` : `\u7C89\u788E\u52A0\u6210 +${event.crushScore}`;
        if (this.mode === "crush") {
          this.openResult();
        }
        return;
      }
      if (event.type === "CleaningEnded") {
        this.statusText = event.tapCount > 0 ? `\u6E05\u6D01\u5B8C\u6210\uFF0C\u6253\u626B\u4E86 ${event.tapCount} \u6B21` : "\u6E05\u6D01\u7ED3\u675F";
        if (this.mode === "clean") {
          this.openResult();
        }
        return;
      }
      if (event.type === "BuriedRevealed") {
        this.buriedFx.set(event.id, {
          id: event.id,
          kind: event.kind,
          poseFrom: 0,
          leaveFrom: 0
        });
        this.statusText = event.kind === BURIED_SNOWMAN ? "\u96EA\u4EBA\u6574\u53EA\u9732\u51FA\u6765\u4E86\uFF01" : "\u4F01\u9E45\u6574\u53EA\u9732\u51FA\u6765\u4E86\uFF01";
        return;
      }
      if (event.type === "SnowmanQuake") {
        this.shakeMs = Math.max(this.shakeMs, 280);
        this.vibrateMedium();
        this.statusText = "\u96EA\u4EBA\u9707\u52A8\uFF0C\u5468\u56F4\u51B0\u5757\u88C2\u5F00\u4E86\uFF01";
        return;
      }
      if (event.type === "BuriedHarvested") {
        this.spawnCoverChipJuice(event.indices, ["#f8f9fa", "#74c0fc", "#ffe066"]);
        this.statusText = "\u51B0\u788E\u4E86\uFF0C\u4F01\u9E45\u548C\u96EA\u4EBA\u5DF2\u6536\u96C6\uFF01";
        return;
      }
      if (event.type === "BoosterUsed") {
        if (event.boosterId === "hammer") {
          this.statusText = `\u9524\u5B50\u7838\u4E2D\uFF01\u5269\u4F59 ${event.remaining}`;
        } else if (event.boosterId === "shuffle") {
          this.statusText = `\u76D8\u9762\u5DF2\u91CD\u6392 \xB7 \u5269\u4F59 ${event.remaining}`;
        } else {
          this.statusText = `+${(_d = event.movesGranted) != null ? _d : 5} \u6B65 \xB7 \u5269\u4F59 ${event.remaining}`;
        }
        this.hammerTargeting = false;
        this.hammerCursor = null;
        if (!this.animator.isPlaying()) {
          this.syncBoardView();
        }
        return;
      }
      if (event.type === "StateChanged" && event.to === "PlayerInput") {
        if (this.mode === "result" || this.mode === "crush" || this.mode === "clean") {
          this.mode = "playing";
          this.statusText = "";
          this.pendingResult = null;
          this.offerCleanPrompt = false;
          this.resultFx.stop();
          this.crushBursts = [];
          this.floatingScores = [];
          this.crushSparks = [];
          this.shakeMs = 0;
          this.crushHasTapped = false;
        }
        if (!this.animator.isPlaying()) {
          this.syncBoardView();
        }
        return;
      }
      if (event.type === "BoardShuffled") {
        this.statusText = event.reason === "booster" ? "\u5C0F\u52A8\u7269\u91CD\u65B0\u6392\u5217\u5566\uFF01" : "\u6CA1\u6709\u53EF\u79FB\u52A8\u7684\u4E86\uFF0C\u91CD\u65B0\u6392\u5217\uFF01";
        this.syncBoardView();
        return;
      }
      if (event.type === "BoardChanged" || event.type === "CascadeDone") {
        if (!this.animator.isPlaying() && !this.swapSlide) {
          this.syncBoardView();
        }
      }
    }
    /**
     * 消除动画结束后：先播剩余步数加成，再进粉碎/结算。
     */
    afterLevelResolved() {
      if (this.animator.isPlaying() || this.swapSlide) {
        return;
      }
      if (this.pendingResult === "won") {
        if (this.session.hasPendingMovesBonus()) {
          this.statusText = "\u5269\u4F59\u6B65\u6570\u52A0\u6210\u4E2D\u2026";
          this.session.runMovesBonus();
          return;
        }
        const level = this.session.getLevelConfig();
        if ((level == null ? void 0 : level.crushEnabled) && this.session.fsm.getCurrent() === "CrushReward") {
          this.openCrush();
          return;
        }
      }
      this.openResult();
    }
    openCrush() {
      this.mode = "crush";
      this.stopMatchPresentation();
      this.session.stopMatchPraiseSfx();
      this.crushBursts = [];
      this.floatingScores = [];
      this.crushSparks = [];
      this.shakeMs = 0;
      this.crushHasTapped = false;
      this.lastCrushTapCount = 0;
      this.offerCleanPrompt = false;
      this.statusText = "\u9650\u65F6\u7C89\u788E\uFF01\u70B9\u52A8\u7269\u4F1A\u7206\u70B8\u52A0\u5206";
      this.resultFx.stop();
      this.captureBurstScoreBarMax();
      this.syncBoardView();
    }
    openClean() {
      this.mode = "clean";
      this.stopMatchPresentation();
      this.session.stopMatchPraiseSfx();
      this.crushBursts = [];
      this.floatingScores = [];
      this.crushSparks = [];
      this.shakeMs = 0;
      this.crushHasTapped = false;
      this.offerCleanPrompt = false;
      this.statusText = "\u6E05\u6D01\u6A21\u5F0F\uFF01\u70B9\u4E00\u70B9\uFF0C\u6253\u626B\u5E72\u51C0\uFF01";
      this.resultFx.stop();
      this.captureBurstScoreBarMax();
      this.syncBoardView();
    }
    openResult() {
      this.mode = "result";
      const won = this.pendingResult === "won";
      this.offerCleanPrompt = won && this.session.canOfferCleaning();
      this.levelBanners = [];
      this.goalFlyers = [];
      this.resultOpenedMs = this.nowMs || Date.now();
      this.resultStars = won ? this.session.getLastStars() : 0;
      if (won) {
        this.session.playWinSfx();
        this.shakeMs = 220;
        this.vibrateMedium();
      }
      this.resultFx.start(
        won,
        this.nowMs || Date.now(),
        this.width,
        this.height,
        this.session.getScore()
      );
    }
    pruneCrushBursts(now) {
      compactTimed(this.crushBursts, now, timedListCap("bursts", this.cheapFx));
      compactTimed(this.floatingScores, now, timedListCap("scores", this.cheapFx));
      compactTimed(this.crushSparks, now, timedListCap("sparks", this.cheapFx));
    }
    /**
     * 点击粉碎成功后的飘分 / 火花。
     */
    spawnCrushFeedback(row, col, scoreAdded, clearedCells, now) {
      const board = this.session.getBoard();
      if (!board) {
        return;
      }
      const layout = this.computeBoardLayout(board);
      const cx = layout.originX + (col + 0.5) * layout.cellSize;
      const cy = layout.originY - (row + 0.5) * layout.cellSize;
      if (scoreAdded > 0) {
        const praise = matchPraiseForScore(scoreAdded);
        this.floatingScores.push({
          x: cx,
          y: cy - layout.cellSize * 0.55,
          text: praise.word,
          startMs: now,
          durationMs: praise.tier === "excellent" ? 1100 : 920,
          color: praise.color,
          fontSize: praise.tier === "excellent" ? 48 : praise.tier === "great" ? 42 : 36
        });
        this.floatingScores.push({
          x: cx,
          y: cy - layout.cellSize * 0.08,
          text: `+${scoreAdded}`,
          startMs: now,
          durationMs: 900,
          color: "#ffe566"
        });
        this.hudBarPulse = 420;
        this.hudScorePunch = 1.2;
        const target = this.burstScoreBarTarget();
        this.hudBurstBarDisplay = Math.max(
          this.hudBurstBarDisplay,
          Math.min(1, this.hudBurstBarDisplay + Math.max(0.08, target * 0.12))
        );
      }
      const sparkCount = crushSparkCount(this.cheapFx, clearedCells.length);
      for (let i = 0; i < sparkCount; i += 1) {
        const ang = Math.PI * 2 * i / sparkCount + Math.random() * 0.4;
        const speed = 55 + Math.random() * 120;
        const style = i % 3 === 0 ? "star" : i % 3 === 1 ? "streak" : "dot";
        this.crushSparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 40,
          startMs: now,
          durationMs: 420 + Math.random() * 280,
          color: ["#fff3a0", "#ff7a3d", "#ff85c0", "#ffffff", "#74c0fc"][i % 5],
          style
        });
      }
      for (const cell of clearedCells.slice(0, 12)) {
        const px = layout.originX + (cell.col + 0.5) * layout.cellSize;
        const py = layout.originY - (cell.row + 0.5) * layout.cellSize;
        this.crushSparks.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 80,
          vy: -50 - Math.random() * 70,
          startMs: now,
          durationMs: 420,
          color: "#ffffff",
          style: "star"
        });
      }
    }
    /** 轻触震动（支持则调用）。 */
    vibrateLight() {
      if (typeof wx.vibrateShort === "function") {
        try {
          wx.vibrateShort({ type: "light" });
        } catch (e) {
        }
      }
    }
    vibrateMedium() {
      if (typeof wx.vibrateShort === "function") {
        try {
          wx.vibrateShort({ type: "medium" });
        } catch (e) {
          this.vibrateLight();
        }
      }
    }
    beginSwapSlide(rowA, colA, rowB, colB, rejected) {
      const board = this.session.getBoard();
      if (!board) {
        return;
      }
      this.swapSlide = {
        rowA,
        colA,
        kindA: board.getTile(rowA, colA),
        sparkleA: board.isSparkle(rowA, colA),
        rowB,
        colB,
        kindB: board.getTile(rowB, colB),
        sparkleB: board.isSparkle(rowB, colB),
        startMs: this.nowMs || Date.now(),
        durationMs: rejected ? 220 : 140,
        rejected
      };
    }
    updateSwapSlide(now) {
      if (!this.swapSlide) {
        return;
      }
      if (now - this.swapSlide.startMs < this.swapSlide.durationMs) {
        return;
      }
      const rejected = this.swapSlide.rejected;
      this.swapSlide = null;
      if (!rejected) {
        this.flushPendingPlayback();
      } else if (!this.animator.isPlaying()) {
        this.syncBoardView();
      }
      if (this.pendingResult && !this.animator.isPlaying()) {
        this.afterLevelResolved();
      }
    }
    /** 丢掉三消交换/消除残留，避免粉碎关还在画旧盘面 */
    stopMatchPresentation() {
      this.animator.stop();
      this.swapSlide = null;
      this.pendingPlayback = null;
      this.animCloudStart = null;
      this.animIceStart = null;
      this.animEggStart = null;
      this.animVineStart = null;
      this.animCloudWaves = [];
    }
    /** 粉碎/清洁开局：进度条从 0 开始，满格=当前盘面占用分 */
    captureBurstScoreBarMax() {
      const board = this.session.getBoard();
      let occupied = 0;
      if (board) {
        for (let r = 0; r < board.size.rows; r += 1) {
          for (let c = 0; c < board.size.cols; c += 1) {
            if (board.getTile(r, c) !== 0 /* Empty */) {
              occupied += 1;
            }
          }
        }
      }
      this.burstScoreBarMax = Math.max(80, occupied * 10);
      this.hudBurstBarDisplay = 0;
    }
    burstScoreBarTarget() {
      var _a;
      const burst = this.mode === "clean" ? this.session.getCleanSession() : this.session.getCrushSession();
      const score = (_a = burst == null ? void 0 : burst.crushScore) != null ? _a : 0;
      return Math.max(0, Math.min(1, score / Math.max(1, this.burstScoreBarMax)));
    }
    updateBurstScoreBar(dt) {
      const target = this.burstScoreBarTarget();
      const k = 1 - Math.exp(-dt * 0.018);
      this.hudBurstBarDisplay += (target - this.hudBurstBarDisplay) * k;
      if (Math.abs(target - this.hudBurstBarDisplay) < 2e-3) {
        this.hudBurstBarDisplay = target;
      }
    }
    flushPendingPlayback() {
      if (this.mode === "crush" || this.mode === "clean" || this.mode === "result") {
        this.pendingPlayback = null;
        return;
      }
      const playback = this.pendingPlayback;
      if (!playback) {
        return;
      }
      this.pendingPlayback = null;
      this.animCloudStart = Uint8Array.from(playback.cloud);
      this.animIceStart = Uint8Array.from(playback.ice);
      this.animEggStart = Uint8Array.from(playback.egg);
      this.animVineStart = Uint8Array.from(playback.vine);
      this.animCloudWaves = playback.waves;
      this.animator.onComplete(() => {
        this.animCloudStart = null;
        this.animIceStart = null;
        this.animEggStart = null;
        this.animVineStart = null;
        this.animCloudWaves = [];
        this.syncBoardView();
        if (this.pendingResult) {
          this.afterLevelResolved();
        }
      });
      this.animator.onWaveClear((waveIndex, cells, hasSpecial) => {
        this.spawnMatchClearJuice(cells, waveIndex, hasSpecial);
      });
      this.animator.onClearFinished((_waveIndex, chippedCloudIndices, chippedEggIndices, chippedVineIndices) => {
        this.spawnCottonChipJuice(chippedCloudIndices);
        this.spawnCoverChipJuice(chippedEggIndices != null ? chippedEggIndices : [], ["#fff4cc", "#ffd43b", "#ffe8a3"]);
        this.spawnCoverChipJuice(chippedVineIndices != null ? chippedVineIndices : [], ["#b2f2bb", "#51cf66", "#2f9e44"]);
      });
      this.animator.start(
        {
          rows: playback.rows,
          cols: playback.cols,
          cells: playback.cells,
          tileIds: playback.tileIds,
          sparkles: playback.sparkles
        },
        playback.waves,
        this.nowMs || Date.now()
      );
    }
    /**
     * 三消波次：粒子炸开 + 飘分 + 震动；连锁再播消除音。
     */
    spawnMatchClearJuice(cells, waveIndex, hasSpecial) {
      var _a, _b;
      if (this.mode === "crush" || this.mode === "clean" || this.mode === "result") {
        return;
      }
      const board = this.session.getBoard();
      if (!board || cells.length === 0) {
        return;
      }
      const layout = this.computeBoardLayout(board);
      const now = this.nowMs || Date.now();
      const chain = waveIndex + 1;
      const points = Math.max(30, cells.length * 10) * chain;
      const praise = matchPraiseForScore(points);
      const skipFirstWaveSfx = waveIndex === 0 && this.session.takeFirstWavePraiseAlreadyPlayed();
      if (!skipFirstWaveSfx) {
        this.session.playMatchPraiseSfx(points);
      }
      this.vibrateLight();
      this.shakeMs = Math.min(160, 48 + cells.length * 9 + waveIndex * 14);
      this.hudBarPulse = Math.min(420, 180 + waveIndex * 60);
      this.hudScorePunch = Math.min(1.22, 1.08 + waveIndex * 0.04);
      let sx = 0;
      let sy = 0;
      for (const cell of cells) {
        sx += layout.originX + (cell.col + 0.5) * layout.cellSize;
        sy += layout.originY - (cell.row + 0.5) * layout.cellSize;
      }
      sx /= cells.length;
      sy /= cells.length;
      this.floatingScores.push({
        x: sx,
        y: sy - layout.cellSize * 0.58,
        text: praise.word,
        startMs: now,
        durationMs: praise.tier === "excellent" ? 1100 : 920,
        color: praise.color,
        fontSize: praise.tier === "excellent" ? 48 : praise.tier === "great" ? 42 : 36
      });
      this.floatingScores.push({
        x: sx,
        y: sy - layout.cellSize * 0.12,
        text: `+${points}`,
        startMs: now,
        durationMs: 860,
        color: waveIndex >= 2 ? "#ffe066" : "#ffffff"
      });
      if (waveIndex >= 1) {
        this.floatingScores.push({
          x: sx,
          y: sy + layout.cellSize * 0.72,
          text: `\u8FDE\u51FB x${chain}\uFF01`,
          startMs: now,
          durationMs: 720,
          color: "#ff85c0"
        });
      }
      if (waveIndex >= 3) {
        this.floatingScores.push({
          x: sx,
          y: sy - layout.cellSize * 0.78,
          text: "\u8D85\u723D\uFF01",
          startMs: now,
          durationMs: 680,
          color: "#ff922b"
        });
      }
      if (hasSpecial) {
        this.floatingScores.push({
          x: sx,
          y: sy - layout.cellSize * 0.55,
          text: "\u7279\u6B8A\u5408\u6210\uFF01",
          startMs: now,
          durationMs: 750,
          color: "#74c0fc"
        });
      }
      const goalKind = formatHudGoals((_b = (_a = this.session.getGoals()) == null ? void 0 : _a.getSnapshots()) != null ? _b : []).collectKind;
      const target = this.hudGoalIconPos;
      if (target && goalKind !== void 0 && this.tileImages.has(goalKind)) {
        const picks = planGoalFlyers(cells, goalKind, this.cheapFx ? 3 : 6);
        picks.forEach((cell, i) => {
          this.goalFlyers.push({
            kind: cell.kind,
            fromX: layout.originX + (cell.col + 0.5) * layout.cellSize,
            fromY: layout.originY - (cell.row + 0.5) * layout.cellSize,
            toX: target.x,
            toY: target.y,
            startMs: now + 120 + i * 45,
            durationMs: 560,
            size: layout.cellSize * 0.78
          });
        });
      }
      for (const cell of cells) {
        const cx = layout.originX + (cell.col + 0.5) * layout.cellSize;
        const cy = layout.originY - (cell.row + 0.5) * layout.cellSize;
        const n = juiceSparkCount(this.cheapFx, waveIndex);
        for (let i = 0; i < n; i += 1) {
          const ang = Math.PI * 2 * i / n + Math.random() * 0.35;
          const speed = 70 + Math.random() * 130 + waveIndex * 12;
          const style = i % 4 === 0 ? "star" : i % 4 === 1 ? "streak" : "dot";
          this.crushSparks.push({
            x: cx,
            y: cy,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed - 40,
            startMs: now,
            durationMs: 460 + Math.random() * 220,
            color: ["#fff", "#ffe066", "#ff85c0", "#74c0fc", "#8ce99a", "#ff922b"][i % 6],
            style
          });
        }
      }
    }
    /** 邻格小动物消完后，棉花掉层并喷出棉絮。 */
    spawnCottonChipJuice(chippedCloudIndices) {
      if (chippedCloudIndices.length === 0) {
        return;
      }
      const board = this.session.getBoard();
      if (!board) {
        return;
      }
      const layout = this.computeBoardLayout(board);
      const now = this.nowMs || Date.now();
      const cols = board.size.cols;
      for (const index of chippedCloudIndices) {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const cx = layout.originX + (col + 0.5) * layout.cellSize;
        const cy = layout.originY - (row + 0.5) * layout.cellSize;
        const fluff = cottonFluffCount(this.cheapFx);
        for (let i = 0; i < fluff; i += 1) {
          const ang = Math.PI * 2 * i / fluff + Math.random() * 0.4;
          const speed = 36 + Math.random() * 90;
          this.crushSparks.push({
            x: cx,
            y: cy,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed - 28,
            startMs: now,
            durationMs: 520 + Math.random() * 180,
            color: i % 2 === 0 ? "#f7fbff" : "#d7e4f0",
            style: i % 3 === 0 ? "star" : "dot"
          });
        }
      }
    }
    spawnCoverChipJuice(indices, colors) {
      if (indices.length === 0) {
        return;
      }
      const board = this.session.getBoard();
      if (!board) {
        return;
      }
      const layout = this.computeBoardLayout(board);
      const now = this.nowMs || Date.now();
      const cols = board.size.cols;
      const fluff = cottonFluffCount(this.cheapFx);
      for (const index of indices) {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const cx = layout.originX + (col + 0.5) * layout.cellSize;
        const cy = layout.originY - (row + 0.5) * layout.cellSize;
        for (let i = 0; i < fluff; i += 1) {
          const ang = Math.PI * 2 * i / fluff + Math.random() * 0.4;
          const speed = 40 + Math.random() * 100;
          this.crushSparks.push({
            x: cx,
            y: cy,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed - 30,
            startMs: now,
            durationMs: 500 + Math.random() * 180,
            color: colors[i % colors.length],
            style: i % 3 === 0 ? "star" : "dot"
          });
        }
      }
    }
    cellScreenRect(layout, row, col) {
      return {
        x: layout.originX + col * layout.cellSize,
        y: layout.originY - (row + 1) * layout.cellSize
      };
    }
    swapSlideProgress(now) {
      if (!this.swapSlide) {
        return 1;
      }
      const t = (now - this.swapSlide.startMs) / this.swapSlide.durationMs;
      return Math.max(0, Math.min(1, t));
    }
    /** easeOutCubic */
    easeOutSwap(t) {
      const u = 1 - t;
      return 1 - u * u * u;
    }
    syncBoardView() {
      const board = this.session.getBoard();
      if (!board) {
        return;
      }
      const layout = this.computeBoardLayout(board);
      this.boardView.updateLayout(layout);
      this.boardView.syncFromBoard(board, true);
    }
    computeBoardLayout(board) {
      const top = this.getHudBottom() + (this.mode === "crush" || this.mode === "clean" ? 28 : 12);
      const bottomReserve = this.mode === "crush" || this.mode === "clean" ? 88 : this.mode === "playing" ? 96 : 24;
      const key = `${this.mode}:${board.size.rows}x${board.size.cols}:${top}:${bottomReserve}:${this.width}x${this.height}`;
      if (key === this.layoutCacheKey) {
        return this.layoutCache;
      }
      const sidePad = 20;
      const areaBottom = this.height - bottomReserve;
      const maxW = this.width - sidePad * 2;
      const maxH = Math.max(80, areaBottom - top - 16);
      const cellSize = Math.floor(
        Math.min(maxW / board.size.cols, maxH / board.size.rows)
      );
      const boardW = cellSize * board.size.cols;
      const boardH = cellSize * board.size.rows;
      const originX = Math.floor((this.width - boardW) / 2);
      const freeH = Math.max(0, areaBottom - top - boardH);
      const lift = Math.min(freeH * 0.72, freeH);
      this.layoutCacheKey = key;
      this.layoutCache.cellSize = cellSize;
      this.layoutCache.originX = originX;
      this.layoutCache.originY = Math.floor(top + (freeH - lift) + boardH);
      return this.layoutCache;
    }
    /**
     * 顶部安全区与胶囊避让后的 HUD 可用区域。
     */
    getPostClearAnnouncementText() {
      if (this.overlay !== "none") {
        return null;
      }
      return this.session.getPostClearAnnouncement();
    }
    getClearAnnouncementReserve() {
      return this.getPostClearAnnouncementText() ? GAMEPLAY_ANNOUNCEMENT_H + GAMEPLAY_ANNOUNCEMENT_GAP : 0;
    }
    getClearAnnouncementTop() {
      var _a, _b;
      const belowCapsule = ((_b = (_a = this.menuButton) == null ? void 0 : _a.bottom) != null ? _b : this.statusBarHeight + 32) + 4;
      return Math.max(this.statusBarHeight + 4, belowCapsule);
    }
    pushClearAnnouncementButton() {
      const message = this.getPostClearAnnouncementText();
      if (!message) {
        return;
      }
      const layout = layoutGameplayAnnouncementBar({
        width: this.width,
        top: this.getClearAnnouncementTop()
      });
      this.buttons.push({
        id: "dismiss_clear_announce",
        x: layout.x,
        y: layout.y,
        w: layout.w,
        h: layout.h,
        label: "",
        hitPad: 4
      });
    }
    drawPostClearAnnouncementBar() {
      const message = this.getPostClearAnnouncementText();
      if (!message) {
        return;
      }
      const layout = layoutGameplayAnnouncementBar({
        width: this.width,
        top: this.getClearAnnouncementTop()
      });
      drawGameplayAnnouncementBar(
        this.ctx,
        layout,
        message,
        (x, y, w, h, r) => this.roundRectPath(x, y, w, h, r)
      );
    }
    getHudFrame() {
      var _a, _b;
      const belowCapsule = ((_b = (_a = this.menuButton) == null ? void 0 : _a.bottom) != null ? _b : this.statusBarHeight + 32) + 8;
      const top = Math.max(this.statusBarHeight + 8, belowCapsule) + this.getClearAnnouncementReserve();
      const left = 12;
      const right = this.menuButton ? Math.max(left + 140, this.menuButton.left - 12) : this.width - 12;
      return { top, left, right, width: Math.max(80, right - left) };
    }
    getHudBottom() {
      return this.getHudFrame().top + 26 + 8 + 64;
    }
    handleTouchStart(e) {
      this.markUserActivity();
      this.tryStartBgm();
      this.trySettleBoosterShareAfterReturn();
      if (this.isInputMuted()) {
        return;
      }
      if (this.overlay === "leaderboard") {
        const p2 = this.readTouchPoint(e, false);
        if (!p2) {
          return;
        }
        this.lastPointerX = p2.x;
        this.lastPointerY = p2.y;
        this.beginLeaderboardScroll(p2.x, p2.y);
        return;
      }
      if (this.overlay !== "none") {
        return;
      }
      const p = this.readTouchPoint(e, false);
      if (!p) {
        return;
      }
      this.lastPointerX = p.x;
      this.lastPointerY = p.y;
      this.crushTapOnDown = false;
      this.ensureBoardLayoutSynced();
      if (this.hammerTargeting) {
        this.hammerCursor = { x: p.x, y: p.y };
      }
      if (this.mode === "lobby") {
        if (this.hitLobbyNavChip(p.x, p.y)) {
          return;
        }
        this.beginLobbyDrag(p.x, p.y);
        return;
      }
      if (this.mode === "crush" || this.mode === "clean") {
        this.crushTapOnDown = this.tryHandleCrushTap(p.x, p.y);
        return;
      }
      if (this.mode === "mahjong_play") {
        this.mahjongPileLastX = p.x;
        this.mahjongPileLastY = p.y;
        this.mahjongPileDragMoved = false;
        this.mahjongPilePointerDown = this.isInMahjongPileArea(p.x, p.y);
        return;
      }
      if (this.mode === "playing" && !this.animator.isPlaying() && !this.swapSlide && !this.hammerTargeting) {
        const chrome = this.hitButton(p.x, p.y);
        if (chrome && chrome.id !== "level") {
          return;
        }
        this.boardView.onPointerDown(p.x, p.y);
      }
    }
    handleTouchMove(e) {
      this.markUserActivity();
      if (this.isInputMuted()) {
        return;
      }
      if (this.overlay === "leaderboard") {
        const p2 = this.readTouchPoint(e, false);
        if (!p2) {
          return;
        }
        this.lastPointerX = p2.x;
        this.lastPointerY = p2.y;
        this.moveLeaderboardScroll(p2.y);
        return;
      }
      if (this.overlay !== "none") {
        return;
      }
      const p = this.readTouchPoint(e, false);
      if (!p) {
        return;
      }
      this.lastPointerX = p.x;
      this.lastPointerY = p.y;
      if (this.hammerTargeting) {
        this.hammerCursor = { x: p.x, y: p.y };
      }
      if (this.mode === "lobby") {
        this.moveLobbyDrag(p.x, p.y);
        return;
      }
      if (this.mode === "mahjong_play") {
        const inPile = this.isInMahjongPileArea(p.x, p.y);
        this.handleMahjongPilePointerMove(
          p.x,
          p.y,
          this.mahjongPilePointerDown || inPile,
          1
        );
        return;
      }
      if (this.mode === "playing" && !this.animator.isPlaying() && !this.swapSlide && !this.hammerTargeting) {
        this.boardView.onPointerMove(p.x, p.y);
      }
    }
    handleTouchEnd(e) {
      var _a;
      this.markUserActivity();
      if (this.isInputMuted()) {
        this.boardView.onPointerCancel();
        this.lobbyDrag = null;
        this.leaderboardDrag = null;
        this.crushTapOnDown = false;
        return;
      }
      const p = (_a = this.readTouchPoint(e, true)) != null ? _a : {
        x: this.lastPointerX,
        y: this.lastPointerY
      };
      const x = p.x;
      const y = p.y;
      this.ensureBoardLayoutSynced();
      if (this.overlay === "leaderboard") {
        const scrolled = this.endLeaderboardScroll();
        this.lobbyDrag = null;
        this.crushTapOnDown = false;
        if (!scrolled) {
          const overlayHit = this.hitButton(x, y);
          if (overlayHit) {
            void this.onButton(overlayHit.id, overlayHit.levelId);
          }
        }
        return;
      }
      if (this.overlay !== "none") {
        this.lobbyDrag = null;
        this.crushTapOnDown = false;
        const overlayHit = this.hitButton(x, y);
        if (overlayHit) {
          void this.onButton(overlayHit.id, overlayHit.levelId);
        }
        return;
      }
      if (this.mode === "lobby" && this.endLobbyDrag()) {
        return;
      }
      if (this.mode === "lobby" && this.mahjongEntryGateLevel != null) {
        const gateHit = hitMahjongButton(this.mahjongGateButtons, x, y);
        if (gateHit) {
          void this.handleMahjongGateUi(gateHit.id);
        }
        return;
      }
      if (this.mode === "mahjong_play") {
        this.mahjongPilePointerDown = false;
        this.handleMahjongPlayTap(x, y);
        return;
      }
      if (this.crushTapOnDown) {
        this.crushTapOnDown = false;
        this.boardView.onPointerCancel();
        return;
      }
      const boardGestureActive = this.mode === "playing" && !this.hammerTargeting && this.boardView.hasActivePointer();
      if (boardGestureActive && !this.animator.isPlaying() && !this.swapSlide) {
        this.boardView.onPointerUp(x, y);
        return;
      }
      if (this.mode === "crush" || this.mode === "clean") {
        if (this.tryHandleCrushTap(x, y)) {
          return;
        }
      }
      const hit = this.hitButton(x, y);
      if (hit) {
        if (this.mode === "result") {
          const layout = this.resultFx.getLayout(this.nowMs || Date.now());
          if (!layout.interactive) {
            return;
          }
        }
        void this.onButton(hit.id, hit.levelId);
        return;
      }
      if (this.overlay !== "none") {
        return;
      }
      if (this.mode === "playing" && !this.animator.isPlaying() && !this.swapSlide) {
        if (this.hammerTargeting) {
          const cell = this.boardView.hitCell(x, y, 12);
          if (cell) {
            const ok = this.session.useHammer(cell.row, cell.col);
            if (!ok) {
              this.statusText = "\u8BF7\u70B9\u6709\u5C0F\u52A8\u7269\u7684\u683C\u5B50";
            } else {
              this.hammerCursor = null;
            }
          } else {
            this.hammerTargeting = false;
            this.hammerCursor = null;
            this.statusText = "\u5DF2\u53D6\u6D88\u9524\u5B50";
          }
          return;
        }
        this.boardView.onPointerUp(x, y);
      }
    }
    handleTouchCancel(_e) {
      this.mahjongPilePointerDown = false;
      this.crushTapOnDown = false;
      this.lobbyDrag = null;
      this.leaderboardDrag = null;
      this.lobbyCamVel = 0;
      this.boardView.onPointerCancel();
      if (this.hammerTargeting) {
        this.hammerCursor = null;
      }
      this.requestPaint();
    }
    readTouchPoint(e, preferChanged) {
      var _a, _b;
      const t = preferChanged ? (_a = e.changedTouches[0]) != null ? _a : e.touches[0] : (_b = e.touches[0]) != null ? _b : e.changedTouches[0];
      if (!t) {
        return null;
      }
      const x = this.pickTouchCoord(t.clientX, t.x, t.pageX);
      const y = this.pickTouchCoord(t.clientY, t.y, t.pageY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      if (preferChanged && x === 0 && y === 0 && (this.lastPointerX !== 0 || this.lastPointerY !== 0)) {
        return { x: this.lastPointerX, y: this.lastPointerY };
      }
      return { x, y };
    }
    pickTouchCoord(client, canvas, page) {
      if (Number.isFinite(client)) {
        return client;
      }
      if (Number.isFinite(canvas)) {
        return canvas;
      }
      if (Number.isFinite(page)) {
        return page;
      }
      return Number.NaN;
    }
    /** 粉碎/清洁：按下即点格子，棋盘优先于底部按钮 */
    tryHandleCrushTap(x, y) {
      const cell = this.boardView.hitCell(x, y, 12);
      if (!cell) {
        return false;
      }
      const ok = this.session.tryCrushTap(cell.row, cell.col);
      if (!ok) {
        this.statusText = this.mode === "clean" ? "\u6E05\u6D01\u5DF2\u7ED3\u675F" : "\u7C89\u788E\u65F6\u95F4\u5230\u4E86";
      }
      return true;
    }
    /** 保证命中检测与绘制使用同一套棋盘布局 */
    ensureBoardLayoutSynced() {
      const board = this.session.getBoard();
      if (!board) {
        return;
      }
      if (this.mode !== "playing" && this.mode !== "crush" && this.mode !== "clean" && this.mode !== "result") {
        return;
      }
      this.boardView.updateLayout(this.computeBoardLayout(board));
    }
    /** 按当前页面生成转发 / 朋友圈文案。 */
    buildSharePayload() {
      var _a, _b;
      const level = this.session.getLevelConfig();
      const levelId = (_a = level == null ? void 0 : level.id) != null ? _a : 1;
      const score = this.session.getScore();
      const scene = (_b = this.boosterShareScene) != null ? _b : this.mode === "playing" || this.mode === "crush" || this.mode === "clean" || this.mode === "result" ? this.mode : "lobby";
      const title = buildShareTitle(scene, levelId, score);
      const query = buildShareQuery(
        scene,
        levelId,
        score,
        this.session.getInviteCode()
      );
      const imageSlot = scene === "crush" || scene === "clean" ? "sparkle" : scene === "lobby" ? "lobby" : "playing";
      return {
        title,
        ...this.resolveShareImage(imageSlot),
        query
      };
    }
    /**
     * 会话分享图：未过审时用包内 5:4 图；过审后把编号和官方地址填进 share-images.json。
     */
    resolveShareImage(slot) {
      const entry = share_images_default[slot];
      const imageUrl = entry.imageUrl || "assets/main/share/lobby-500x400.jpg";
      const imageUrlId = entry.imageUrlId.trim();
      return imageUrlId ? { imageUrl, imageUrlId } : { imageUrl };
    }
    /** 左下角导航槽位尺寸，供道具栏避让；与底部胶囊行垂直居中。 */
    getNavChipFrame() {
      if (this.mode !== "lobby") {
        const layout = this.getInLevelBottomNavLayout();
        return {
          x: layout.muteX,
          y: layout.muteY,
          w: layout.muteSize,
          h: layout.muteSize
        };
      }
      const banner = this.session.getLobbyBannerReservePx();
      const bottom = lobbyNavBottomGap(banner, this.safeAreaBottom);
      const chipY = this.height - LOBBY_NAV_CHIP_H - bottom;
      return layoutLobbyGear(chipY, LOBBY_NAV_CHIP_H);
    }
    /** 局内左下：音效与道具栏底边对齐，「回首页」叠在音效上方。 */
    getInLevelBottomNavLayout() {
      const boosterSize = 58;
      const boosterY = this.height - boosterSize - 22;
      const muteSize = 42;
      const muteX = LOBBY_GEAR_X;
      const muteY = boosterY + (boosterSize - muteSize) / 2;
      const homeW = Math.max(56, muteSize + 14);
      const homeH = 28;
      return {
        muteX,
        muteY,
        muteSize,
        homeX: muteX + (muteSize - homeW) / 2,
        homeY: muteY - homeH - 6,
        homeW,
        homeH
      };
    }
    hitLobbyNavChip(x, y) {
      const hit = this.hitButton(x, y);
      return !!hit && hit.id !== "level";
    }
    /** 大厅麻将馆入口：单行 caption，贴图无字，按按钮宽度自适应字号。 */
    drawMahjongHallLobbyCaption(entryX, entryY, entrySize, unlocked) {
      const { ctx } = this;
      const label = MAHJONG_HALL_LOBBY_CAPTION;
      const cx = entryX + entrySize / 2;
      const cy = Math.round(entryY + entrySize * 0.795);
      const maxTextW = entrySize * 0.9;
      let fontSize = Math.max(11, Math.round(entrySize * 0.155));
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (; ; ) {
        ctx.font = `900 ${fontSize}px sans-serif`;
        if (ctx.measureText(label).width <= maxTextW || fontSize <= 10) {
          break;
        }
        fontSize -= 1;
      }
      ctx.strokeStyle = unlocked ? "rgba(26, 92, 58, 0.88)" : "rgba(55, 55, 55, 0.65)";
      ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.22));
      ctx.lineJoin = "round";
      ctx.strokeText(label, cx, cy);
      ctx.fillStyle = unlocked ? "#ffffff" : "rgba(255,255,255,0.82)";
      ctx.fillText(label, cx, cy);
      ctx.restore();
    }
    /** 大厅左下角：萌宠麻将馆入口（锚在音效钮上，可轻叠关卡条；NavChips 后绘）。 */
    drawLobbyMahjongEntry(settings) {
      var _a, _b, _c, _d, _e;
      const img = this.uiIcons.get("mahjong_hall");
      if (!img || ((_a = img.width) != null ? _a : 0) <= 0) {
        return;
      }
      const { w: barW } = lobbyBarSize(this.width, this.height);
      const ladderLeft = (this.width - barW) / 2 - this.width * LADDER_ZIGZAG_OF_WIDTH;
      const targetW = Math.min(
        LOBBY_MAHJONG_ENTRY_MAX_PX,
        Math.max(
          LOBBY_MAHJONG_ENTRY_TARGET_PX,
          Math.floor(this.width * LOBBY_MAHJONG_ENTRY_WIDTH_OF_SCREEN)
        )
      );
      const x = LOBBY_SIDE_ACTION_X;
      const widthBudget = ladderLeft - LOBBY_MAHJONG_ENTRY_LADDER_GAP - x + LOBBY_MAHJONG_ENTRY_WIDTH_BOOST_PX;
      const size = Math.floor(Math.min(targetW, widthBudget));
      if (size < LOBBY_MAHJONG_ENTRY_ABS_MIN_PX) {
        return;
      }
      const sideBottom = lobbySideActionsTop(this.statusBarHeight) + LOBBY_SIDE_ACTION_H * 3 + LOBBY_SIDE_ACTION_GAP * 2 + 6;
      const y = Math.max(
        settings.y - LOBBY_MAHJONG_ENTRY_ABOVE_SETTINGS_GAP - size,
        sideBottom
      );
      const btn = {
        id: "mahjong_hall",
        x,
        y,
        w: size,
        h: size,
        label: "",
        hitPad: 10
      };
      this.buttons.push(btn);
      const unlocked = this.session.isMahjongHallUnlocked();
      const showNew = this.session.shouldShowMahjongHallNewBadge();
      const { ctx } = this;
      const now = this.nowMs || Date.now();
      const cx = x + size / 2;
      const cy = y + size / 2;
      const pulse = unlocked ? 1 + this.fxAmt(0.028, 0.014) * Math.sin(now * 45e-4 + x * 0.02) : 1;
      ctx.save();
      ctx.globalAlpha = unlocked ? 0.32 : 0.18;
      ctx.fillStyle = "#3d5a40";
      this.fillEllipse(cx + 2, y + size + 5, size * 0.44, size * 0.11);
      ctx.globalAlpha = 1;
      if (unlocked) {
        ctx.save();
        const glowA = 0.28 + 0.14 * Math.sin(now * 6e-3);
        ctx.globalAlpha = glowA;
        ctx.strokeStyle = showNew ? "#ff922b" : "#51cf66";
        ctx.lineWidth = Math.max(3, size * 0.04);
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.54, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = glowA * 0.45;
        ctx.lineWidth = Math.max(5, size * 0.07);
        ctx.stroke();
        ctx.restore();
        if (showNew || Math.sin(now * 3e-3) > 0.82) {
          this.drawSparkleStar(x + size * 0.18, y + size * 0.22, 5, 0.9);
          this.drawSparkleStar(x + size * 0.82, y + size * 0.35, 4, 0.75);
        }
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      ctx.translate(-cx, -cy);
      if (!unlocked) {
        ctx.filter = "grayscale(100%)";
        ctx.globalAlpha = 0.72;
      }
      ctx.drawImage(img, x, y, size, size);
      ctx.restore();
      const badge = this.uiIcons.get("mahjong_new_badge");
      if (showNew && badge && ((_b = badge.width) != null ? _b : 0) > 0 && ((_c = badge.height) != null ? _c : 0) > 0) {
        const srcW = Math.max(1, (_d = badge.width) != null ? _d : 1);
        const srcH = Math.max(1, (_e = badge.height) != null ? _e : 1);
        const badgeH = Math.max(14, Math.round(size * 0.3));
        const badgeW = Math.round(badgeH * (srcW / srcH));
        const overlap = Math.round(size * 0.05);
        const badgeX = x + size - badgeW + overlap;
        const badgeBob = Math.sin(now / 520) * this.fxAmt(2.5, 1.2);
        const badgeY = y - Math.round(badgeH * 0.2) + badgeBob;
        ctx.save();
        ctx.shadowColor = "rgba(240, 62, 62, 0.45)";
        ctx.shadowBlur = 6;
        ctx.drawImage(badge, badgeX, badgeY, badgeW, badgeH);
        ctx.restore();
      }
      this.drawMahjongHallLobbyCaption(x, y, size, unlocked);
      ctx.restore();
    }
    /** 大厅 / 局内左下角：音效开关。局内与道具栏同高，上方附「回首页」。 */
    drawNavChips() {
      if (this.mode !== "lobby") {
        this.hideGameClubNativeButton();
        const layout = this.getInLevelBottomNavLayout();
        this.pushMuteNavButton(
          layout.muteX,
          layout.muteY,
          layout.muteSize,
          layout.muteSize,
          LOBBY_NAV_HIT_PAD
        );
        const homeBtn = {
          id: "lobby",
          x: layout.homeX,
          y: layout.homeY,
          w: layout.homeW,
          h: layout.homeH,
          label: "\u56DE\u9996\u9875",
          hitPad: 6
        };
        this.buttons.push(homeBtn);
        this.drawCuteButton(homeBtn, {
          top: "#a5d8ff",
          bottom: "#339af0",
          border: "#ffffff",
          gloss: true,
          fontSize: 12
        });
        return;
      }
      const chrome = layoutLobbyBottom({
        width: this.width,
        height: this.height,
        bannerReserve: this.session.getLobbyBannerReservePx(),
        safeBottom: this.safeAreaBottom,
        dailyClaimable: this.session.getDailyTasksView().claimable
      });
      this.pushMuteNavButton(
        chrome.settings.x,
        chrome.settings.y,
        chrome.settings.w,
        chrome.settings.h,
        8
      );
      this.drawLobbyMahjongEntry(chrome.settings);
      if (chrome.claim) {
        const claimBtn = {
          id: "daily_open",
          x: chrome.claim.x,
          y: chrome.claim.y,
          w: chrome.claim.w,
          h: chrome.claim.h,
          label: chrome.claim.label,
          hitPad: 6
        };
        this.buttons.push(claimBtn);
        this.drawCuteButton(claimBtn, {
          top: "#ffe066",
          bottom: "#f59f00",
          border: "#ffffff",
          gloss: true
        });
      }
      const palettes = {
        recommend: { top: "#8ce99a", bottom: "#37b24d", border: "#ffffff", gloss: true },
        club: { top: "#74c0fc", bottom: "#1c7ed6", border: "#ffffff", gloss: true }
      };
      for (const item of chrome.chips) {
        const btn = {
          id: item.id,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          label: item.label,
          hitPad: 8
        };
        this.buttons.push(btn);
        this.drawCuteButton(btn, palettes[item.id]);
        if (item.id === "club") {
          this.syncGameClubNativeButton(btn);
        }
      }
    }
    /** 左下角音效：开=彩色喇叭，关=灰色静音。 */
    pushMuteNavButton(x, y, w, h, hitPad) {
      const size = Math.max(w, h, 42);
      const btn = {
        id: "mute",
        x: x + w / 2 - size / 2,
        y: y + h / 2 - size / 2,
        w: size,
        h: size,
        label: "",
        hitPad
      };
      this.buttons.push(btn);
      this.drawMuteToggleButton(btn, this.session.isMuted());
    }
    /** 首页左上角糖果列表（邀请 / 排行 / 怎么玩）。 */
    drawLobbySideActions() {
      if (this.mode !== "lobby") {
        return;
      }
      const top = lobbySideActionsTop(this.statusBarHeight);
      const frames = layoutLobbySideActions(top, this.width);
      const palettes = {
        invite: {
          top: "#63e6be",
          bottom: "#12b886",
          border: "#ffffff",
          gloss: true,
          fontSize: LOBBY_SIDE_ACTION_FONT
        },
        daily_open: {
          top: "#ffe066",
          bottom: "#f59f00",
          border: "#ffffff",
          gloss: true,
          fontSize: LOBBY_SIDE_ACTION_FONT
        },
        leaderboard: {
          top: "#d0bfff",
          bottom: "#845ef7",
          border: "#ffffff",
          gloss: true,
          fontSize: LOBBY_SIDE_ACTION_FONT
        },
        howto: {
          top: "#ffc078",
          bottom: "#f76707",
          border: "#ffffff",
          gloss: true,
          fontSize: LOBBY_SIDE_ACTION_FONT
        }
      };
      for (const frame of frames) {
        const dailyView = frame.id === "daily_open" ? this.session.getDailyTasksView() : null;
        const btn = {
          id: frame.id,
          x: frame.x,
          y: frame.y,
          w: frame.w,
          h: frame.h,
          label: dailyView ? dailyTasksSideLabel(dailyView) : frame.label,
          hitPad: 6
        };
        this.buttons.push(btn);
        this.drawCuteButton(btn, palettes[frame.id]);
        if (frame.id === "daily_open" && dailyView) {
          const claimable = dailyView.claimable;
          if (claimable > 0) {
            this.drawRedDotBadge(frame.x + frame.w - 3, frame.y + 3, String(claimable));
          } else if (!dailyView.chestClaimed && dailyView.tasks.some((task) => !task.done)) {
            this.drawRedDotBadge(frame.x + frame.w - 3, frame.y + 3, "");
          }
        }
      }
    }
    drawRedDotBadge(cx, cy, text) {
      const { ctx } = this;
      const pulse = 1 + 0.08 * Math.sin((this.nowMs || Date.now()) * 8e-3);
      const r = (text ? 8 : 5) * pulse;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#fa5252";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      if (text) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, cx, cy + 0.5);
      }
      ctx.restore();
    }
    hideGameClubNativeButton() {
      var _a, _b;
      if (this.gameClubButtonKey === "hidden") {
        return;
      }
      this.gameClubButtonKey = "hidden";
      (_b = (_a = this.gameClubButton) == null ? void 0 : _a.hide) == null ? void 0 : _b.call(_a);
    }
    destroyGameClubButton() {
      var _a, _b, _c, _d;
      try {
        (_b = (_a = this.gameClubButton) == null ? void 0 : _a.offTap) == null ? void 0 : _b.call(_a, this.onGameClubTapped);
      } catch (e) {
      }
      this.gameClubTapHooked = false;
      (_d = (_c = this.gameClubButton) == null ? void 0 : _c.destroy) == null ? void 0 : _d.call(_c);
      this.gameClubButton = null;
      this.gameClubButtonKey = "";
    }
    hookGameClubTap() {
      var _a, _b;
      if (this.gameClubTapHooked || !this.gameClubButton) {
        return;
      }
      (_b = (_a = this.gameClubButton).onTap) == null ? void 0 : _b.call(_a, this.onGameClubTapped);
      this.gameClubTapHooked = true;
    }
    isMobileWechat() {
      if (isWxDesktopIdeHost()) {
        return false;
      }
      return this.wxPlatform === "ios" || this.wxPlatform === "android" || this.wxPlatform === "ohos" || this.wxPlatform === "harmonyos";
    }
    /**
     * 大厅「圈子」用微信原生游戏圈按钮（不传 openlink，打开默认游戏圈）。
     * 后台「游戏内打开」长串给 PageManager 会 openPage:fail。
     */
    syncGameClubNativeButton(chip) {
      var _a, _b, _c, _d, _e, _f;
      const box = toNativeViewStyle({
        left: chip.x,
        top: chip.y,
        width: chip.w,
        height: chip.h
      });
      const visible = !!box && this.mode === "lobby" && this.overlay === "none" && this.isMobileWechat() && !this.foregroundHidden;
      const key = visible && box ? `club-v4:${box.left},${box.top},${box.width},${box.height}` : "hidden";
      if (key === this.gameClubButtonKey) {
        return;
      }
      this.gameClubButtonKey = key;
      if (!visible || !box || typeof wx.createGameClubButton !== "function") {
        (_b = (_a = this.gameClubButton) == null ? void 0 : _a.hide) == null ? void 0 : _b.call(_a);
        return;
      }
      if (this.gameClubButton) {
        const style = this.gameClubButton.style;
        if (style) {
          style.left = box.left;
          style.top = box.top;
          style.width = box.width;
          style.height = box.height;
          style.lineHeight = box.height;
        }
        this.hookGameClubTap();
        (_d = (_c = this.gameClubButton).show) == null ? void 0 : _d.call(_c);
        this.foreground.holdNativeChrome(800);
        return;
      }
      try {
        this.gameClubButton = wx.createGameClubButton({
          type: "text",
          text: "",
          hasRedDot: false,
          style: {
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            backgroundColor: "rgba(0,0,0,0)",
            borderWidth: 0,
            color: "rgba(0,0,0,0)",
            textAlign: "center",
            fontSize: 1,
            lineHeight: box.height
          }
        });
        this.hookGameClubTap();
        (_f = (_e = this.gameClubButton).show) == null ? void 0 : _f.call(_e);
        this.foreground.holdNativeChrome(800);
      } catch (e) {
        this.gameClubButton = null;
        this.gameClubButtonKey = "";
      }
    }
    /**
     * 画布点击兜底：原生按钮未盖住时，仍不要用首页长 openlink 调 PageManager。
     */
    openGameClub() {
      this.statusText = this.isMobileWechat() ? "\u8BF7\u70B9\u84DD\u8272\u300C\u5708\u5B50\u300D\u6309\u94AE" : "\u6E38\u620F\u5708\u53EA\u80FD\u5728\u624B\u673A\u5FAE\u4FE1\u91CC\u6253\u5F00";
    }
    /** 拉起官方推荐半屏：玩家点推荐后会出现在「发现-游戏」好友流。 */
    async openGameRecommend() {
      if (isWxDesktopIdeHost() || !this.isMobileWechat()) {
        this.statusText = "\u63A8\u8350\u53EA\u80FD\u5728\u624B\u673A\u5FAE\u4FE1\u91CC\u6253\u5F00";
        return;
      }
      this.foreground.forcePause();
      const result = await this.recommend.show();
      if (result === "shown") {
        return;
      }
      this.foreground.onShow();
      this.statusText = result === "unsupported" ? "\u5F53\u524D\u5FAE\u4FE1\u7248\u672C\u6682\u4E0D\u652F\u6301\u63A8\u8350" : "\u63A8\u8350\u6682\u65F6\u6253\u4E0D\u5F00\uFF0C\u7A0D\u540E\u518D\u8BD5";
    }
    /** 设置 / 玩法弹层 */
    drawPageOverlay() {
      if (this.overlay === "none") {
        return;
      }
      const { ctx, width, height } = this;
      this.buttons = [];
      this.buttons.push({
        id: "resume",
        x: 0,
        y: 0,
        w: width,
        h: height,
        label: ""
      });
      ctx.save();
      ctx.fillStyle = this.overlay === "leaderboard" ? "rgba(28, 52, 96, 0.55)" : "rgba(40, 20, 55, 0.46)";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      if (this.overlay === "howto") {
        this.drawHowToPanel();
        return;
      }
      if (this.overlay === "notice") {
        this.drawNoticePanel();
        return;
      }
      if (this.overlay === "leaderboard") {
        this.drawLeaderboardPanel();
        return;
      }
      if (this.overlay === "daily_tasks") {
        this.drawDailyTasksPanel();
        return;
      }
      if (this.overlay === "profile_welcome") {
        this.drawProfileWelcomePanel();
        return;
      }
      if (this.overlay === "mahjong_lock") {
        this.drawMahjongHallLockPanel();
        return;
      }
      this.drawSettingsPanel();
    }
    /** 未解锁麻将馆：说明条件（真机 Toast 常只显示小游戏名，必须用弹窗）。 */
    drawMahjongHallLockPanel() {
      const { ctx, width, height } = this;
      const panelW = Math.min(300, width - 48);
      const body = mahjongHallLockPanelBody(this.session.getMaxClearedLevelId());
      const bodyLines = [];
      for (const paragraph of body.split("\n")) {
        bodyLines.push(...this.wrapText(paragraph.trim(), panelW - 48));
      }
      const panelH = 168 + Math.max(0, bodyLines.length - 2) * 22;
      const x = (width - panelW) / 2;
      const y = Math.max(24, height * 0.26);
      this.drawCuteCard(x, y, panelW, panelH, {
        radius: 24,
        fillTop: "rgba(255,255,255,0.98)",
        fillBottom: "rgba(255, 236, 245, 0.97)",
        border: "rgba(255, 170, 210, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        sparkleColor: "#ffc9e8",
        nowMs: this.nowMs || Date.now()
      });
      this.paintPanelCornerChrome(panelCloseButton({ x, y, w: panelW }), "#c2255c");
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 20px sans-serif";
      ctx.fillStyle = "#c2255c";
      ctx.fillText("\u840C\u5BA0\u9EBB\u5C06\u9986\u672A\u89E3\u9501", x + panelW / 2, y + 40);
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "#862e4a";
      let ty = y + 78;
      for (const line of bodyLines) {
        ctx.fillText(line, x + panelW / 2, ty);
        ty += 22;
      }
      ctx.restore();
      const btnH = 44;
      const btnY = y + panelH - btnH - 18;
      this.buttons.push({
        id: "resume",
        x: x + 24,
        y: btnY,
        w: panelW - 48,
        h: btnH,
        label: "\u77E5\u9053\u4E86\uFF0C\u5148\u53BB\u95EF\u5173"
      });
      this.drawCuteButton(
        { id: "resume", x: x + 24, y: btnY, w: panelW - 48, h: btnH, label: "\u77E5\u9053\u4E86\uFF0C\u5148\u53BB\u95EF\u5173" },
        { top: "#74c0fc", bottom: "#1c7ed6", border: "#ffffff", gloss: true },
        1
      );
    }
    /** 排行榜弹窗内景：天空渐变 + 云 + 名单区纸感底，与大厅糖果风一致。 */
    drawLeaderboardPanelBackdrop(layout, nowMs) {
      const { ctx } = this;
      const panel = layout.panel;
      const { x, y, w, h } = panel;
      const radius = 24;
      const drift = Math.sin(nowMs * 85e-5) * 5;
      ctx.save();
      this.roundRectPath(x, y, w, h, radius);
      ctx.clip();
      const sky = ctx.createLinearGradient(x, y, x, y + h * 0.5);
      sky.addColorStop(0, "rgba(186, 230, 253, 0.72)");
      sky.addColorStop(0.45, "rgba(224, 242, 254, 0.35)");
      sky.addColorStop(1, "rgba(224, 242, 254, 0)");
      ctx.fillStyle = sky;
      ctx.fillRect(x, y, w, h * 0.52);
      const candy = ctx.createLinearGradient(x, y + h * 0.35, x, y + h);
      candy.addColorStop(0, "rgba(237, 221, 255, 0)");
      candy.addColorStop(0.35, "rgba(208, 169, 255, 0.28)");
      candy.addColorStop(1, "rgba(165, 216, 255, 0.42)");
      ctx.fillStyle = candy;
      ctx.fillRect(x, y, w, h);
      if (layout.podiumH > 0) {
        const glow = ctx.createRadialGradient(
          x + w / 2,
          layout.listTop + layout.podiumH * 0.45,
          6,
          x + w / 2,
          layout.listTop + layout.podiumH * 0.45,
          w * 0.52
        );
        glow.addColorStop(0, "rgba(255, 212, 59, 0.38)");
        glow.addColorStop(0.55, "rgba(255, 243, 191, 0.12)");
        glow.addColorStop(1, "rgba(255, 243, 191, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x + 8, layout.listTop - 6, w - 16, layout.podiumH + 16);
      }
      const listH = Math.max(0, layout.listBottom - layout.listTop);
      if (listH > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.48)";
        this.roundRectPath(x + 10, layout.listTop - 2, w - 20, listH + 6, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.strokeStyle = "#74c0fc";
        ctx.lineWidth = 1;
        for (let row = layout.listTop + 18; row < layout.listBottom; row += 14) {
          ctx.beginPath();
          ctx.moveTo(x + 18, row);
          ctx.lineTo(x + w - 18, row);
          ctx.stroke();
        }
        ctx.restore();
      }
      const drawCloud = (img, cx, cy, scale, alpha) => {
        if (!img || !(img.width > 0)) {
          return;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        const iw = img.width * scale;
        const ih = img.height * scale;
        ctx.drawImage(img, cx - iw / 2 + drift * (cx < x + w / 2 ? 1 : -1), cy - ih / 2, iw, ih);
        ctx.restore();
      };
      drawCloud(this.uiIcons.get("ladder-cloud"), x + w * 0.14, y + h * 0.11, 0.34, 0.38);
      drawCloud(this.uiIcons.get("ladder-cloudSm"), x + w * 0.86, y + h * 0.09, 0.42, 0.32);
      drawCloud(this.uiIcons.get("ladder-cloudSm"), x + w * 0.78, y + h * 0.62, 0.48, 0.2);
      const tw = nowMs * 4e-3;
      for (let i = 0; i < 4; i += 1) {
        const sx = x + 22 + i * 71 % Math.max(40, w - 44);
        const sy = y + 48 + i * 37 % Math.max(24, layout.listTop - y - 12);
        ctx.save();
        ctx.globalAlpha = 0.28 + 0.32 * Math.abs(Math.sin(tw + i * 1.3));
        drawCandyStar(ctx, sx, sy, 4.5 + i % 2, true);
        ctx.restore();
      }
      ctx.restore();
    }
    /** 排行榜：关卡榜 / 本周榜切换，名单可滑动，底部固定「我的排名」。 */
    drawLeaderboardPanel() {
      var _a;
      const layout = this.resolveLeaderboardLayout();
      this.leaderboardScrollY = clampLeaderboardScroll(this.leaderboardScrollY, layout);
      const { ctx } = this;
      const { panel } = layout;
      const now = this.nowMs || Date.now();
      this.drawCuteCard(panel.x, panel.y, panel.w, panel.h, {
        radius: 24,
        fillTop: "rgba(248, 251, 255, 0.97)",
        fillBottom: "rgba(232, 240, 255, 0.96)",
        border: "rgba(132, 94, 247, 0.88)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        sparkleColor: "#d0bfff",
        nowMs: now
      });
      this.drawLeaderboardPanelBackdrop(layout, now);
      const titleY = panel.y + 26;
      ctx.save();
      const ribbonW = Math.min(panel.w - 40, 168);
      const ribbonX = panel.x + (panel.w - ribbonW) / 2;
      const ribbonG = ctx.createLinearGradient(ribbonX, titleY - 18, ribbonX, titleY + 18);
      ribbonG.addColorStop(0, "rgba(116, 192, 252, 0.92)");
      ribbonG.addColorStop(1, "rgba(28, 126, 214, 0.92)");
      ctx.fillStyle = ribbonG;
      this.roundRectPath(ribbonX, titleY - 18, ribbonW, 36, 18);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 20px sans-serif";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(21, 101, 192, 0.35)";
      ctx.lineWidth = 4;
      ctx.strokeText(layout.title, panel.x + panel.w / 2, titleY);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(layout.title, panel.x + panel.w / 2, titleY);
      ctx.restore();
      for (const tab of layout.tabs) {
        ctx.save();
        this.roundRectPath(tab.x, tab.y, tab.w, tab.h, tab.h / 2);
        if (tab.active) {
          const g = ctx.createLinearGradient(tab.x, tab.y, tab.x, tab.y + tab.h);
          g.addColorStop(0, "#74c0fc");
          g.addColorStop(1, "#1c7ed6");
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = "rgba(208, 235, 255, 0.85)";
        }
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = tab.active ? "#ffffff" : "#1c7ed6";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tab.label, tab.x + tab.w / 2, tab.y + tab.h / 2 + 0.5);
        ctx.restore();
      }
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      let ly = layout.infoTop;
      const cx = panel.x + panel.w / 2;
      const innerX = panel.x + 14;
      const innerW = panel.w - 28;
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#5c7cfa";
      for (const line of layout.ruleLines) {
        ctx.fillText(line, cx, ly);
        ly += layout.infoLineH;
      }
      if (layout.settleLines.length > 0) {
        ly += 2;
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#e67700";
        for (const line of layout.settleLines) {
          ctx.fillText(line, cx, ly);
          ly += layout.infoLineH;
        }
      }
      if (layout.settleNoteLines.length > 0) {
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#868e96";
        for (const line of layout.settleNoteLines) {
          ctx.fillText(line, cx, ly);
          ly += layout.infoLineH;
        }
      }
      if (layout.rewardTierLines.length > 0) {
        ly += 4;
        const titleH = layout.infoLineH;
        const tierH = layout.rewardTierLines.length * layout.infoLineH;
        const blockH = titleH + tierH + 10;
        ctx.fillStyle = "rgba(255, 243, 191, 0.72)";
        this.roundRectPath(innerX, ly, innerW, blockH, 12);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 212, 59, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#c92a2a";
        ctx.fillText((_a = layout.rewardTitle) != null ? _a : "\u5468\u5956\u52B1", cx, ly + 8);
        ly += titleH + 2;
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#862e00";
        for (const line of layout.rewardTierLines) {
          ctx.fillText(line, cx, ly);
          ly += layout.infoLineH;
        }
        ly += 6;
      }
      if (layout.gapHint) {
        ctx.font = "bold 12px sans-serif";
        const w = Math.min(panel.w - 28, ctx.measureText(layout.gapHint).width + 24);
        ctx.fillStyle = "rgba(255, 243, 191, 0.95)";
        this.roundRectPath(cx - w / 2, layout.gapY, w, 20, 10);
        ctx.fill();
        ctx.fillStyle = "#e67700";
        ctx.textBaseline = "middle";
        ctx.fillText(layout.gapHint, cx, layout.gapY + 10.5);
      }
      ctx.restore();
      if (layout.playerRows.length === 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(panel.x + 6, layout.listTop, panel.w - 12, layout.listViewportH);
        ctx.clip();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#74c0fc";
        const emptyY = layout.listTop + Math.min(36, layout.listViewportH / 2 - 8);
        ctx.fillText(layout.emptyText, cx, emptyY);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#91a7ff";
        const tip = layout.activeTab === "week" ? "\u901A\u5173\u4E00\u5173\u5373\u53EF\u4E0A\u699C" : "\u9080\u8BF7\u597D\u53CB\u4E00\u8D77\u95EF\u5173 \xB7 \u540C\u5173\u6BD4\u7D2F\u8BA1\u5206";
        ctx.fillText(tip, cx, emptyY + 22);
        ctx.restore();
      } else {
        if (layout.podiumH > 0) {
          this.drawLeaderboardPodium(layout, cx);
        }
        const scrollTop = layout.listScrollTop;
        const scrollH = layout.listScrollViewportH;
        ctx.save();
        ctx.beginPath();
        ctx.rect(panel.x + 6, scrollTop, panel.w - 12, scrollH);
        ctx.clip();
        let py = scrollTop - this.leaderboardScrollY;
        const stride = layout.rowH + layout.rowGap;
        const listRows = layout.podiumH > 0 ? layout.playerRows.slice(3) : layout.playerRows;
        for (const row of listRows) {
          if (py + stride > scrollTop && py < layout.listBottom) {
            this.drawLeaderboardPlayerRow(row, layout, py, layout.rowH, false);
          }
          py += stride;
        }
        ctx.restore();
      }
      const scrollViewport = layout.listScrollViewportH > 0 ? layout.listScrollViewportH : layout.listViewportH;
      const maxScroll = Math.max(0, layout.listContentH - scrollViewport);
      if (maxScroll > 4 && scrollViewport > 20) {
        const trackX = panel.x + panel.w - 10;
        const trackTop = (layout.podiumH > 0 ? layout.listScrollTop : layout.listTop) + 4;
        const trackH = scrollViewport - 8;
        const thumbH = Math.max(18, scrollViewport / Math.max(1, layout.listContentH) * trackH);
        const thumbY = trackTop + this.leaderboardScrollY / maxScroll * (trackH - thumbH);
        ctx.fillStyle = "rgba(116, 192, 252, 0.25)";
        this.roundRectPath(trackX, trackTop, 3, trackH, 2);
        ctx.fill();
        ctx.fillStyle = "rgba(28, 126, 214, 0.55)";
        this.roundRectPath(trackX, thumbY, 3, thumbH, 2);
        ctx.fill();
      }
      if (layout.selfRow) {
        const bar = layout.selfBar;
        ctx.save();
        ctx.shadowColor = "rgba(28, 126, 214, 0.25)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = -2;
        const g = ctx.createLinearGradient(bar.x, bar.y, bar.x, bar.y + bar.h);
        g.addColorStop(0, "#e7f5ff");
        g.addColorStop(1, "#a5d8ff");
        ctx.fillStyle = g;
        this.roundRectPath(bar.x, bar.y, bar.w, bar.h, 16);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        this.drawLeaderboardPlayerRow(layout.selfRow, layout, bar.y + (bar.h - layout.rowH) / 2, layout.rowH, true);
      }
      for (const spec of layout.buttons) {
        const btn = {
          id: spec.id,
          x: spec.x,
          y: spec.y,
          w: spec.w,
          h: spec.h,
          label: spec.label
        };
        this.buttons.push(btn);
        if (isPanelCloseLabel(spec.label) || isPanelBackLabel(spec.label)) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "bold 22px sans-serif";
          ctx.fillStyle = "#74c0fc";
          ctx.fillText(spec.label, spec.x + spec.w / 2, spec.y + spec.h / 2);
        } else if (spec.id === "invite") {
          this.drawCuteButton(btn, { top: "#8ce99a", bottom: "#37b24d", border: "#ffffff", gloss: true });
        }
      }
    }
    resolveLeaderboardLayout() {
      var _a, _b;
      const view = this.boardViewModel;
      this.ctx.font = "12px sans-serif";
      return layoutLeaderboardPanel({
        width: this.width,
        height: this.height,
        activeTab: this.leaderboardTab,
        tab: (_b = (_a = view == null ? void 0 : view.tabs) == null ? void 0 : _a[this.leaderboardTab]) != null ? _b : null,
        settleText: view == null ? void 0 : view.settleText,
        rewardText: view == null ? void 0 : view.rewardText,
        wrap: (text, maxWidth) => this.wrapText(text, maxWidth)
      });
    }
    beginLeaderboardScroll(x, y) {
      const layout = this.resolveLeaderboardLayout();
      const scrollTop = layout.podiumH > 0 ? layout.listScrollTop : layout.listTop;
      const inScroll = x >= layout.panel.x && x <= layout.panel.x + layout.panel.w && y >= scrollTop && y <= layout.listBottom;
      const scrollViewport = layout.listScrollViewportH > 0 ? layout.listScrollViewportH : layout.listViewportH;
      if (!inScroll || layout.listContentH <= scrollViewport + 1) {
        this.leaderboardDrag = null;
        return;
      }
      this.leaderboardDrag = { startY: y, lastY: y, scrolled: false };
    }
    moveLeaderboardScroll(y) {
      if (!this.leaderboardDrag) {
        return;
      }
      const dy = this.leaderboardDrag.lastY - y;
      this.leaderboardDrag.lastY = y;
      if (Math.abs(y - this.leaderboardDrag.startY) > 6) {
        this.leaderboardDrag.scrolled = true;
      }
      if (Math.abs(dy) < 0.5) {
        return;
      }
      const layout = this.resolveLeaderboardLayout();
      this.leaderboardScrollY = clampLeaderboardScroll(
        this.leaderboardScrollY + dy,
        layout
      );
      this.requestPaint();
    }
    /** @returns 是否发生了滑动（滑动则不当作点击） */
    endLeaderboardScroll() {
      var _a;
      const scrolled = !!((_a = this.leaderboardDrag) == null ? void 0 : _a.scrolled);
      this.leaderboardDrag = null;
      return scrolled;
    }
    resolveDailyTasksLayout() {
      return layoutDailyTasksPanel({
        width: this.width,
        height: this.height,
        view: this.session.getDailyTasksView()
      });
    }
    dailyTaskKindEmoji(id) {
      switch (id) {
        case "clear_levels":
          return "\u{1F3AF}";
        case "clear_tiles":
          return "\u{1F43E}";
        case "make_specials":
          return "\u2728";
        case "combo_chain":
          return "\u26A1";
        case "crush_rounds":
          return "\u{1F4A5}";
        case "collect_kind":
          return "\u{1F381}";
        case "three_star":
          return "\u2B50";
        case "use_boosters":
          return "\u{1F528}";
        default:
          return "\u{1F4CB}";
      }
    }
    /** 进度条上扫光 + 尖端星点（每日任务专用）。 */
    drawDailyTaskBarFx(barX, barY, barW, barH, ratio, state, nowMs, rowIndex) {
      if (state === "claimed" || ratio <= 1e-3) {
        return;
      }
      const { ctx } = this;
      const inset = 3.5;
      const innerH = Math.max(6, barH - inset * 2);
      const innerMaxW = Math.max(0, barW - inset * 2);
      let fillW = Math.floor(innerMaxW * Math.min(1, ratio));
      if (fillW < innerH) {
        fillW = Math.min(innerMaxW, Math.max(fillW, Math.floor(innerH * 0.95)));
      }
      const fx = barX + inset;
      const fy = barY + inset;
      ctx.save();
      this.roundRectPath(fx, fy, fillW, innerH, innerH / 2);
      ctx.clip();
      const period = state === "claim" ? 1600 : 2400;
      const phase = (nowMs + rowIndex * 380) % period / period;
      const bandW = Math.max(22, barH * 2.2);
      const sx = fx + phase * (fillW + bandW) - bandW;
      ctx.globalAlpha = state === "claim" ? 0.55 : 0.38;
      const shine = ctx.createLinearGradient(sx, fy, sx + bandW, fy);
      shine.addColorStop(0, "rgba(255,255,255,0)");
      shine.addColorStop(0.45, "rgba(255,255,255,0.92)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      ctx.fillRect(fx - bandW, fy, fillW + bandW * 2, innerH);
      ctx.restore();
      const tipX = fx + fillW;
      const tipY = barY + barH / 2;
      const twinkle = 0.65 + 0.35 * Math.abs(Math.sin(nowMs * 9e-3 + rowIndex));
      if (state === "claim" || state === "todo" && ratio < 1) {
        this.drawSparkleStar(tipX - 3, tipY, 3.8 + twinkle, twinkle);
      }
      if (state === "claim") {
        this.drawSparkleStar(fx + fillW * 0.42, fy + 2, 3.2, 0.5 + 0.5 * Math.sin(nowMs * 0.011));
      }
    }
    /** 每日任务行左侧：渐变圆牌 + 投影，托住 emoji。 */
    drawDailyTaskIconBadge(cx, cy, emoji, tone, size = 22, nowMs = 0) {
      const { ctx } = this;
      let drawCx = cx;
      let drawCy = cy;
      let scale = 1;
      if (tone === "claim") {
        scale = 1 + 0.07 * Math.sin(nowMs * 9e-3);
        drawCy += Math.sin(nowMs * 7e-3) * 1.8;
      } else if (tone === "active") {
        scale = 1 + 0.025 * Math.sin(nowMs * 5e-3 + cx * 0.04);
      }
      const r = size * scale;
      const palettes = {
        active: { top: "#ffffff", bottom: "#ffe8cc", border: "#ffc078", shadow: "#8d6e3a" },
        claim: { top: "#fff9db", bottom: "#ffd43b", border: "#f59f00", shadow: "#a65d00" },
        claimed: { top: "#f8f9fa", bottom: "#dee2e6", border: "#ced4da", shadow: "#6c757d" },
        locked: { top: "#f1f3f5", bottom: "#e9ecef", border: "#dee2e6", shadow: "#868e96" }
      };
      const p = palettes[tone];
      ctx.save();
      ctx.globalAlpha = tone === "claimed" || tone === "locked" ? 0.2 : 0.28;
      ctx.fillStyle = p.shadow;
      this.fillEllipse(drawCx + 1.5, drawCy + 3.5, r * 0.98, r * 0.9);
      ctx.globalAlpha = 1;
      if (tone === "claim") {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(nowMs * 8e-3);
        ctx.strokeStyle = "#ffd43b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(drawCx, drawCy, r + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const body = ctx.createLinearGradient(drawCx, drawCy - r, drawCx, drawCy + r);
      body.addColorStop(0, p.top);
      body.addColorStop(0.55, p.bottom);
      body.addColorStop(1, this.shadeHex(p.bottom, -12));
      ctx.fillStyle = body;
      this.fillEllipse(drawCx, drawCy, r - 1, (r - 1) * 0.94);
      ctx.strokeStyle = p.border;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = "#ffffff";
      this.fillEllipse(drawCx, drawCy - r * 0.42, r * 0.68, r * 0.32);
      ctx.restore();
      ctx.font = `${Math.round(r * 0.82)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = tone === "claimed" || tone === "locked" ? 0.62 : 1;
      ctx.fillText(emoji, drawCx, drawCy - 1);
      ctx.restore();
    }
    dailyTaskProgressColors(state) {
      if (state === "claimed") {
        return {
          track: "#e9ecef",
          fillTop: "#dee2e6",
          fillMid: "#ced4da",
          fillBottom: "#adb5bd",
          border: "#ced4da"
        };
      }
      if (state === "claim") {
        return {
          track: "#fff3bf",
          fillTop: "#ffe066",
          fillMid: "#ffc078",
          fillBottom: "#f08c00",
          border: "#ffd43b"
        };
      }
      return {
        track: "#fff9db",
        fillTop: "#ffe066",
        fillMid: "#ffd43b",
        fillBottom: "#f59f00",
        border: "#ffc078"
      };
    }
    /** 每日任务：4 行进度 + 活跃宝箱（参考同类小游戏任务页）。 */
    drawDailyTasksPanel() {
      const layout = this.resolveDailyTasksLayout();
      const { ctx } = this;
      const { panel } = layout;
      const now = this.nowMs || Date.now();
      this.drawCuteCard(panel.x, panel.y, panel.w, panel.h, {
        radius: 24,
        fillTop: "rgba(255,255,255,0.98)",
        fillBottom: "rgba(255, 248, 220, 0.97)",
        border: "rgba(255, 212, 59, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        sparkleColor: "#ffe066",
        nowMs: now
      });
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 20px sans-serif";
      ctx.fillStyle = "#e67700";
      ctx.fillText(layout.title, panel.x + panel.w / 2, panel.y + 26);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#f59f00";
      ctx.fillText(layout.subtitle, panel.x + panel.w / 2, panel.y + 48);
      ctx.restore();
      for (const row of layout.rows) {
        const { task } = row;
        ctx.save();
        this.roundRectPath(row.x, row.y, row.w, row.h, 14);
        ctx.fillStyle = row.state === "claim" ? "rgba(255, 243, 191, 0.92)" : row.state === "claimed" ? "rgba(241, 243, 245, 0.92)" : "rgba(255, 255, 255, 0.88)";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (row.state === "claim") {
          ctx.strokeStyle = `rgba(245, 159, 0, ${0.5 + 0.35 * Math.sin(now * 8e-3 + row.index)})`;
          ctx.lineWidth = 2.5;
          this.roundRectPath(row.x + 0.5, row.y + 0.5, row.w - 1, row.h - 1, 13);
          ctx.stroke();
        } else if (row.state === "todo" && row.ratio > 0 && row.ratio < 1) {
          ctx.strokeStyle = `rgba(255, 212, 59, ${0.35 + 0.2 * Math.sin(now * 6e-3 + row.index * 0.7)})`;
          ctx.lineWidth = 1.5;
          this.roundRectPath(row.x + 0.5, row.y + 0.5, row.w - 1, row.h - 1, 13);
          ctx.stroke();
        }
        const iconTone = row.state === "claimed" ? "claimed" : row.state === "claim" ? "claim" : "active";
        this.drawDailyTaskIconBadge(
          row.iconCx,
          row.y + row.h / 2 - 2,
          this.dailyTaskKindEmoji(task.id),
          iconTone,
          21,
          now
        );
        ctx.textAlign = "left";
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#862e00";
        ctx.fillText(task.title, row.textX, row.y + 18);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#e67700";
        const rewardLabel = formatDailyReward([task.reward]);
        ctx.fillText(rewardLabel ? `\u5956\u52B1 ${rewardLabel}` : "", row.textX, row.y + 34);
        const barPulse = row.state === "claim" ? 1.03 + 0.025 * Math.sin(now * 0.01 + row.index) : row.state === "todo" && row.ratio > 0 && row.ratio < 1 ? 1 + 0.012 * Math.sin(now * 8e-3 + row.index) : 1;
        this.drawCartoonProgressBar(
          row.barX,
          row.barY,
          row.barW,
          row.barH,
          row.ratio,
          this.dailyTaskProgressColors(row.state),
          barPulse
        );
        this.drawDailyTaskBarFx(row.barX, row.barY, row.barW, row.barH, row.ratio, row.state, now, row.index);
        ctx.font = "bold 10px sans-serif";
        ctx.fillStyle = row.state === "claimed" ? "#868e96" : "#d9480f";
        ctx.textAlign = "right";
        ctx.textBaseline = "alphabetic";
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2.5;
        const progLabel = `${task.progress}/${task.target}`;
        const progX = row.barX + row.barW - 2;
        const progY = row.barY - 5;
        ctx.strokeText(progLabel, progX, progY);
        ctx.fillText(progLabel, progX, progY);
        if (row.state === "claimed") {
          ctx.textAlign = "center";
          ctx.font = "bold 12px sans-serif";
          ctx.fillStyle = "#868e96";
          ctx.fillText("\u5DF2\u9886", row.x + row.w - 38, row.y + row.h / 2);
        } else if (row.state === "todo") {
          ctx.textAlign = "center";
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#fab005";
          const todoPulse = 0.88 + 0.12 * Math.sin(now * 7e-3 + row.index);
          ctx.globalAlpha = todoPulse;
          ctx.fillText("\u8FDB\u884C\u4E2D", row.x + row.w - 38, row.y + row.h / 2);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
      const chest = layout.chest;
      const chestRatio = chest.total > 0 ? chest.claimedCount / chest.total : 0;
      ctx.save();
      this.roundRectPath(chest.x, chest.y, chest.w, chest.h, 16);
      const chestG = ctx.createLinearGradient(chest.x, chest.y, chest.x, chest.y + chest.h);
      if (chest.state === "ready") {
        chestG.addColorStop(0, "#fff3bf");
        chestG.addColorStop(1, "#ffd43b");
      } else if (chest.state === "claimed") {
        chestG.addColorStop(0, "#f1f3f5");
        chestG.addColorStop(1, "#dee2e6");
      } else {
        chestG.addColorStop(0, "#f8f9fa");
        chestG.addColorStop(1, "#e9ecef");
      }
      ctx.fillStyle = chestG;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (chest.state === "ready") {
        ctx.strokeStyle = `rgba(245, 159, 0, ${0.55 + 0.4 * Math.sin(now * 7e-3)})`;
        ctx.lineWidth = 3;
        this.roundRectPath(chest.x + 1, chest.y + 1, chest.w - 2, chest.h - 2, 15);
        ctx.stroke();
      }
      const chestIconTone = chest.state === "claimed" ? "claimed" : chest.state === "ready" ? "claim" : "locked";
      this.drawDailyTaskIconBadge(
        chest.iconCx,
        chest.iconCy,
        chest.state === "claimed" ? "\u{1F4E6}" : "\u{1F381}",
        chestIconTone,
        28,
        now
      );
      const chestBarX = chest.textX;
      const chestBarW = chest.x + chest.w - chestBarX - 10;
      const chestBarH = 9;
      const chestBarY = chest.state === "ready" ? chest.y + 42 : chest.y + chest.h - 16;
      if (chest.state !== "claimed") {
        this.drawCartoonProgressBar(
          chestBarX,
          chestBarY,
          chestBarW,
          chestBarH,
          chestRatio,
          chest.state === "ready" ? this.dailyTaskProgressColors("claim") : this.dailyTaskProgressColors("todo"),
          chest.state === "ready" ? 1.04 + 0.02 * Math.sin(now * 9e-3) : 1
        );
        this.drawDailyTaskBarFx(
          chestBarX,
          chestBarY,
          chestBarW,
          chestBarH,
          chestRatio,
          chest.state === "ready" ? "claim" : "todo",
          now,
          99
        );
      }
      ctx.textAlign = "left";
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = chest.state === "ready" ? "#e67700" : "#495057";
      ctx.fillText(notice_default.dailyTasks.chest, chest.textX, chest.y + 22);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#868e96";
      const chestReward = formatDailyReward(this.session.getDailyTasksView().chest);
      ctx.fillText(
        chest.state === "claimed" ? chest.hint : `${chest.hint} \xB7 ${chestReward}`,
        chest.textX,
        chest.y + 40
      );
      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = "#f59f00";
      ctx.fillText(
        `${chest.claimedCount}/${chest.total} \u5DF2\u9886`,
        chest.textX,
        chest.y + 58
      );
      ctx.restore();
      for (const spec of layout.buttons) {
        const btn = {
          id: spec.id,
          x: spec.x,
          y: spec.y,
          w: spec.w,
          h: spec.h,
          label: spec.label,
          hitPad: 6,
          ...spec.id === "daily_claim" && spec.index != null ? { levelId: spec.index } : {}
        };
        this.buttons.push(btn);
        if (isPanelCloseLabel(spec.label) || isPanelBackLabel(spec.label)) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "bold 22px sans-serif";
          ctx.fillStyle = "#fab005";
          ctx.fillText(spec.label, spec.x + spec.w / 2, spec.y + spec.h / 2);
        } else if (spec.id === "daily_claim") {
          this.drawCuteButton(btn, {
            top: "#ffe066",
            bottom: "#f59f00",
            border: "#ffffff",
            gloss: true,
            fontSize: 13
          });
        } else if (spec.id === "daily_chest" || spec.id === "daily_chest_double") {
          this.drawCuteButton(
            btn,
            spec.id === "daily_chest_double" ? { top: "#ffa8a8", bottom: "#f03e3e", border: "#ffffff", gloss: true, fontSize: 12 } : { top: "#8ce99a", bottom: "#37b24d", border: "#ffffff", gloss: true, fontSize: 12 }
          );
        }
      }
    }
    /** 首次进入：可选授权头像昵称（不强制）。 */
    drawProfileWelcomePanel() {
      var _a, _b, _c;
      const { ctx, width, height } = this;
      const welcome = notice_default.profileWelcome;
      const panelW = Math.min(320, width - 40);
      const body = (_a = welcome == null ? void 0 : welcome.body) != null ? _a : "\u6388\u6743\u540E\uFF0C\u597D\u53CB\u6392\u884C\u4F1A\u663E\u793A\u4F60\u7684\u5934\u50CF\u548C\u6635\u79F0\u3002\u4E5F\u53EF\u8DF3\u8FC7\uFF0C\u4E0D\u5F71\u54CD\u6E38\u73A9\u3002";
      ctx.font = "13px sans-serif";
      const lines = this.wrapText(body, panelW - 40);
      const panelH = 168 + lines.length * 18;
      const x = (width - panelW) / 2;
      const y = Math.max(80, height * 0.28);
      this.drawCuteCard(x, y, panelW, panelH, {
        radius: 22,
        fillTop: "rgba(255,255,255,0.98)",
        fillBottom: "rgba(232, 248, 255, 0.97)",
        border: "rgba(116, 192, 252, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        sparkleColor: "#a5d8ff",
        nowMs: this.nowMs || Date.now()
      });
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = "#1864ab";
      ctx.fillText((_b = welcome == null ? void 0 : welcome.title) != null ? _b : "\u5C55\u793A\u5FAE\u4FE1\u5934\u50CF", x + panelW / 2, y + 32);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#495057";
      ctx.textBaseline = "top";
      let ly = y + 56;
      for (const line of lines) {
        ctx.fillText(line, x + panelW / 2, ly);
        ly += 18;
      }
      const skip = {
        id: "profile_skip",
        x: x + 24,
        y: y + panelH - 36,
        w: panelW - 48,
        h: 28,
        label: (_c = welcome == null ? void 0 : welcome.skip) != null ? _c : "\u6682\u4E0D\u6388\u6743"
      };
      this.buttons.push(skip);
      ctx.textBaseline = "middle";
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#74c0fc";
      ctx.fillText(skip.label, skip.x + skip.w / 2, skip.y + skip.h / 2);
    }
    /** 前三名领奖台（固定在滚动区上方，不随列表滚动） */
    drawLeaderboardPodium(layout, cx) {
      var _a, _b;
      const { ctx } = this;
      const panel = layout.panel;
      const podiumH = layout.podiumH || LEADERBOARD_PODIUM_H;
      const baseY = layout.listTop + podiumH;
      const slots = [
        { row: layout.playerRows[1], x: cx - 72, h: 38, medal: "silver" },
        { row: layout.playerRows[0], x: cx, h: 46, medal: "gold" },
        { row: layout.playerRows[2], x: cx + 72, h: 34, medal: "bronze" }
      ];
      ctx.save();
      ctx.beginPath();
      ctx.rect(panel.x + 6, layout.listTop, panel.w - 12, podiumH);
      ctx.clip();
      for (const slot of slots) {
        if (!slot.row) {
          continue;
        }
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1864ab";
        ctx.fillText((_b = (_a = slot.row.nickName) == null ? void 0 : _a.slice(0, 4)) != null ? _b : "\u73A9\u5BB6", slot.x, layout.listTop + 12);
        ctx.beginPath();
        ctx.arc(slot.x, layout.listTop + podiumH - slot.h / 2, 14, 0, Math.PI * 2);
        ctx.fillStyle = slot.medal === "gold" ? "#ffd43b" : slot.medal === "silver" ? "#dee2e6" : "#f2b98a";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(slot.row.tag, slot.x, layout.listTop + podiumH - slot.h / 2 + 0.5);
      }
      ctx.fillStyle = "rgba(116, 192, 252, 0.35)";
      ctx.fillRect(panel.x + 20, baseY - 4, panel.w - 40, 3);
      ctx.restore();
    }
    /** 关卡榜第一名头像上的小皇冠 */
    drawLeaderboardCrown(cx, cy) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.moveTo(-11, 4);
      ctx.lineTo(-8, -6);
      ctx.lineTo(-4, 2);
      ctx.lineTo(0, -9);
      ctx.lineTo(4, 2);
      ctx.lineTo(8, -6);
      ctx.lineTo(11, 4);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -9, 0, 6);
      g.addColorStop(0, "#ffe066");
      g.addColorStop(0.5, "#ffd43b");
      g.addColorStop(1, "#f59f00");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.fillStyle = "#fa5252";
      ctx.beginPath();
      ctx.arc(-6, -2, 2.2, 0, Math.PI * 2);
      ctx.arc(0, -5, 2.4, 0, Math.PI * 2);
      ctx.arc(6, -2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawLeaderboardPlayerRow(row, layout, ty, rowH, pinned) {
      var _a;
      const { ctx } = this;
      const { panel } = layout;
      const medal = leaderboardMedal(row.tag);
      const medalColors = {
        gold: { fill: "#ffd43b", deep: "#f59f00", row: "rgba(255, 243, 191, 0.92)" },
        silver: { fill: "#dee2e6", deep: "#868e96", row: "rgba(241, 243, 245, 0.95)" },
        bronze: { fill: "#f2b98a", deep: "#c0703a", row: "rgba(255, 232, 214, 0.92)" }
      };
      if (!pinned) {
        if (row.highlight) {
          ctx.fillStyle = "rgba(208, 235, 255, 0.95)";
          this.roundRectPath(panel.x + 8, ty - 2, panel.w - 16, rowH, 14);
          ctx.fill();
        } else if (medal) {
          ctx.fillStyle = medalColors[medal].row;
          this.roundRectPath(panel.x + 8, ty - 2, panel.w - 16, rowH, 14);
          ctx.fill();
        }
      }
      const rankCx = layout.tagX + 13;
      const rankCy = ty + rowH / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (medal) {
        const c = medalColors[medal];
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(rankCx - 7, rankCy - 18);
        ctx.lineTo(rankCx - 2, rankCy - 6);
        ctx.lineTo(rankCx + 2, rankCy - 6);
        ctx.lineTo(rankCx + 7, rankCy - 18);
        ctx.closePath();
        ctx.fillStyle = "#ff6b6b";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rankCx, rankCy + 2, 12, 0, Math.PI * 2);
        const g = ctx.createLinearGradient(rankCx, rankCy - 10, rankCx, rankCy + 14);
        g.addColorStop(0, c.fill);
        g.addColorStop(1, c.deep);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(row.tag, rankCx, rankCy + 2.5);
        ctx.restore();
        if (medal === "gold") {
          this.drawLeaderboardCrown(layout.avatarX, rankCy - layout.avatarR - 3);
        }
      } else if (/^\d+$/.test(row.tag)) {
        ctx.beginPath();
        ctx.arc(rankCx, rankCy, 11, 0, Math.PI * 2);
        ctx.fillStyle = row.highlight ? "#1c7ed6" : "#74c0fc";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = row.tag.length >= 3 ? "bold 10px sans-serif" : "bold 12px sans-serif";
        ctx.fillText(row.tag, rankCx, rankCy);
      } else {
        ctx.fillStyle = "#868e96";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText(row.tag, rankCx, rankCy);
      }
      const ax = layout.avatarX;
      const ay = rankCy;
      const ar = layout.avatarR;
      const avatar = row.avatarUrl ? this.avatarCache.get(row.avatarUrl) : null;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, ar, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (avatar && (avatar.width || 0) > 0) {
        ctx.drawImage(avatar, ax - ar, ay - ar, ar * 2, ar * 2);
      } else {
        ctx.fillStyle = row.highlight ? "#1c7ed6" : "#a5d8ff";
        ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(row.badge || (row.nickName || "\u73A9").slice(0, 1), ax, ay);
        if (row.avatarUrl && !this.avatarCache.has(row.avatarUrl)) {
          this.prefetchAvatar(row.avatarUrl);
        }
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(ax, ay, ar, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#1864ab";
      const name = row.nickName || "\u5FAE\u4FE1\u73A9\u5BB6";
      ctx.fillText(name, layout.textX, ty + rowH * 0.36);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#4c6ef5";
      ctx.fillText(`\u9080\u8BF7\u7801 ${row.wxId || "\u2014"}`, layout.textX, ty + rowH * 0.68);
      ctx.textAlign = "right";
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "#1864ab";
      ctx.fillText(String((_a = row.score) != null ? _a : 0), layout.scoreX, rankCy);
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#74c0fc";
      ctx.fillText("\u5173\u5361", layout.scoreX, rankCy + 14);
    }
    prefetchAvatar(url) {
      if (!url || this.avatarCache.has(url) || typeof wx === "undefined") {
        return;
      }
      try {
        const img = wx.createImage();
        this.avatarCache.set(url, img);
        img.onload = () => this.requestPaint();
        img.onerror = () => {
          this.avatarCache.delete(url);
          this.downloadAvatar(url);
        };
        img.src = url;
      } catch (e) {
        this.downloadAvatar(url);
      }
    }
    downloadAvatar(url) {
      if (!url || this.avatarCache.has(url) || typeof wx === "undefined") {
        return;
      }
      const download = wx.downloadFile;
      if (typeof download !== "function") {
        return;
      }
      try {
        download({
          url,
          success: (res) => {
            const path = res.tempFilePath;
            if (!path || res.statusCode != null && res.statusCode !== 200) {
              return;
            }
            try {
              const img = wx.createImage();
              this.avatarCache.set(url, img);
              img.onload = () => this.requestPaint();
              img.onerror = () => {
                this.avatarCache.delete(url);
              };
              img.src = path;
            } catch (e) {
            }
          }
        });
      } catch (e) {
      }
    }
    drawNoticePanel() {
      const { ctx, width, height } = this;
      const panelW = Math.min(300, width - 48);
      ctx.font = "bold 16px sans-serif";
      const noticeBody = lobbyNoticeForMahjongState(this.session.isMahjongHallUnlocked()).body;
      const bodyLines = this.wrapText(noticeBody, panelW - 48);
      const panelH = 120 + Math.max(0, bodyLines.length - 1) * 22;
      const x = (width - panelW) / 2;
      const y = Math.max(24, height * 0.28);
      this.drawCuteCard(x, y, panelW, panelH, {
        radius: 24,
        fillTop: "rgba(255,255,255,0.98)",
        fillBottom: "rgba(232, 248, 255, 0.97)",
        border: "rgba(116, 192, 252, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        sparkleColor: "#a5d8ff",
        nowMs: this.nowMs || Date.now()
      });
      this.paintPanelCornerChrome(
        this.overlayFromSettings ? panelBackButton({ x, y }) : panelCloseButton({ x, y, w: panelW }),
        "#1c7ed6"
      );
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#1864ab";
      ctx.fillText(notice_default.title, x + panelW / 2, y + 38);
      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = "#1c7ed6";
      let ty = y + 82;
      for (const line of bodyLines) {
        ctx.fillText(line, x + panelW / 2, ty);
        ty += 22;
      }
      ctx.restore();
    }
    drawSettingsPanel() {
      const { ctx, width, height } = this;
      const inLobby = this.mode === "lobby";
      const panelW = Math.min(280, width - 48);
      const padX = 16;
      const titleH = 44;
      const footH = inLobby ? 72 : 100;
      const panelH = titleH + footH;
      const x = (width - panelW) / 2;
      const y = Math.max(12, Math.min(height * 0.28, height - panelH - 12));
      this.drawCuteCard(x, y, panelW, panelH, {
        radius: 24,
        fillTop: "rgba(255,255,255,0.98)",
        fillBottom: "rgba(232, 248, 255, 0.97)",
        border: "rgba(116, 192, 252, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        sparkleColor: "#a5d8ff",
        nowMs: this.nowMs || Date.now()
      });
      this.paintPanelCornerChrome(panelCloseButton({ x, y, w: panelW }), "#1c7ed6");
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#1864ab";
      ctx.fillText("\u8BBE\u7F6E", x + panelW / 2, y + 26);
      ctx.restore();
      if (inLobby) {
        ctx.save();
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#1c7ed6";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u97F3\u6548\u5F00\u5173\u5728\u5DE6\u4E0B\u89D2\u54E6", x + panelW / 2, y + titleH + 28);
        ctx.restore();
        return;
      }
      const homeBtn = {
        id: "lobby",
        x: x + padX,
        y: y + titleH + 18,
        w: panelW - padX * 2,
        h: 44,
        label: "\u8FD4\u56DE\u9996\u9875"
      };
      this.buttons.push(homeBtn);
      this.drawCuteButton(homeBtn, {
        top: "#a5d8ff",
        bottom: "#339af0",
        border: "#ffffff",
        gloss: true
      });
    }
    /** 关卡同款音效钮：彩色 = 开，灰色 = 关（贴图自带立体壳）。 */
    drawMuteToggleButton(btn, muted) {
      const { ctx } = this;
      const key = muted ? "mute" : "sound";
      const img = this.uiIcons.get(key);
      const cx = btn.x + btn.w / 2;
      const cy = btn.y + btn.h / 2;
      if (img && (img.width || 0) > 0) {
        ctx.save();
        ctx.drawImage(img, btn.x, btn.y, btn.w, btn.h);
        ctx.restore();
        return;
      }
      ctx.save();
      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      if (muted) {
        grad.addColorStop(0, "#e9ecef");
        grad.addColorStop(1, "#adb5bd");
      } else {
        grad.addColorStop(0, "#ffa8a8");
        grad.addColorStop(1, "#f06595");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, btn.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(muted ? "\u9759" : "\u97F3", cx, cy);
      ctx.restore();
    }
    /** 首页玩法：一屏速查，打开就能看完。 */
    drawHowToPanel() {
      const { ctx, width, height } = this;
      const panelW = Math.min(340, width - 28);
      const padX = 16;
      const tagW = 44;
      const titleH = 46;
      const footH = 16;
      const gap = 8;
      ctx.font = "12px sans-serif";
      const textW = panelW - padX * 2 - tagW - 10;
      let bodyH = 4;
      for (const row of HOWTO_LINES) {
        bodyH += Math.max(28, this.wrapText(row.text, textW).length * 16 + 10) + gap;
      }
      const panelH = Math.min(height * 0.88, titleH + bodyH + footH);
      const x = (width - panelW) / 2;
      const y = Math.max(16, (height - panelH) / 2);
      this.drawCuteCard(x, y, panelW, panelH, {
        radius: 24,
        fillTop: "rgba(255,255,255,0.98)",
        fillBottom: "rgba(230, 246, 255, 0.97)",
        border: "rgba(116, 192, 252, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        sparkleColor: "#a5d8ff",
        nowMs: this.nowMs || Date.now()
      });
      this.paintPanelCornerChrome(
        this.overlayFromSettings ? panelBackButton({ x, y }) : panelCloseButton({ x, y, w: panelW }),
        "#339af0"
      );
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#1c7ed6";
      ctx.fillText("\u600E\u4E48\u73A9", x + panelW / 2, y + 26);
      ctx.restore();
      let ty = y + titleH;
      const maxY = y + panelH - footH;
      for (const row of HOWTO_LINES) {
        const lines = this.wrapText(row.text, textW);
        const rowH = Math.max(28, lines.length * 16 + 10);
        if (ty + rowH > maxY) {
          break;
        }
        ctx.fillStyle = "#4dabf7";
        this.roundRectPath(x + padX, ty, tagW, 24, 12);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(row.tag, x + padX + tagW / 2, ty + 12);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#3b5166";
        let ly = ty + 2;
        for (const line of lines) {
          ctx.fillText(line, x + padX + tagW + 10, ly);
          ly += 16;
        }
        ty += rowH + gap;
      }
    }
    /** 按宽度逐字折行（中文规则说明用）。 */
    wrapText(text, maxWidth) {
      const { ctx } = this;
      const lines = [];
      let line = "";
      for (const ch of text) {
        const trial = line + ch;
        if (line && ctx.measureText(trial).width > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line = trial;
        }
      }
      if (line) {
        lines.push(line);
      }
      return lines;
    }
    /** 弹窗角标：左上「<」返回 / 右上「×」关闭。 */
    paintPanelCornerChrome(spec, accent = "#1c7ed6") {
      const btn = {
        id: spec.id,
        x: spec.x,
        y: spec.y,
        w: spec.w,
        h: spec.h,
        label: spec.label,
        hitPad: 12
      };
      this.buttons.push(btn);
      if (isPanelCloseLabel(spec.label)) {
        this.drawPanelCloseX(btn, accent);
      } else {
        this.drawPanelBackChevron(btn, accent);
      }
    }
    /** 弹窗返回：无圆底，大张角折线箭头。 */
    drawPanelBackChevron(btn, accent = "#1c7ed6") {
      const { ctx } = this;
      const cx = btn.x + btn.w * 0.52;
      const cy = btn.y + btn.h / 2;
      const armX = Math.min(11, btn.w * 0.32);
      const armY = Math.min(9, btn.h * 0.28);
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx + armX * 0.15, cy - armY);
      ctx.lineTo(cx - armX, cy);
      ctx.lineTo(cx + armX * 0.15, cy + armY);
      ctx.stroke();
      ctx.restore();
    }
    /** 弹窗关闭：无圆底，描线 ×。 */
    drawPanelCloseX(btn, accent = "#1c7ed6") {
      const { ctx } = this;
      const cx = btn.x + btn.w / 2;
      const cy = btn.y + btn.h / 2;
      const arm = Math.min(9, btn.w * 0.28);
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - arm, cy - arm);
      ctx.lineTo(cx + arm, cy + arm);
      ctx.moveTo(cx + arm, cy - arm);
      ctx.lineTo(cx - arm, cy + arm);
      ctx.stroke();
      ctx.restore();
    }
    /** 启动或续上循环 BGM（静音时跳过；按钮音效后微信常把 BGM 掐掉） */
    tryStartBgm() {
      if (isWxDesktopIdeHost()) {
        return;
      }
      this.session.preloadSfx();
      if (this.session.isMuted()) {
        return;
      }
      if (this.bgmStarted) {
        this.session.resumeFromBackground();
        return;
      }
      this.session.startBgm();
      this.bgmStarted = true;
    }
    async onButton(id, levelId) {
      const busyIds = [
        "revive",
        "crush_extend",
        "next",
        "lobby",
        "booster_extra",
        "booster_hammer",
        "booster_shuffle",
        "post"
      ];
      if (this.tapBusy && busyIds.includes(id)) {
        this.notifyUser("\u5E7F\u544A\u6B63\u5728\u6253\u5F00\uFF0C\u7A0D\u7B49\u4E00\u4E0B", "\u6B63\u5728\u6253\u5F00\u5E7F\u544A");
        return;
      }
      if (busyIds.includes(id)) {
        this.tapBusy = true;
      }
      try {
        await this.handleButton(id, levelId);
      } finally {
        if (busyIds.includes(id)) {
          this.tapBusy = false;
        }
      }
    }
    adWatchTip(result) {
      if (result === "skipped") {
        return "\u770B\u5B8C\u624D\u80FD\u9886\u5956\u52B1\uFF0C\u518D\u70B9\u4E00\u6B21\u5427";
      }
      if (isWxDesktopIdeHost()) {
        return "\u6A21\u62DF\u5668\u64AD\u4E0D\u4E86\u6FC0\u52B1\u89C6\u9891\uFF0C\u8BF7\u70B9\u9884\u89C8\u7528\u624B\u673A\u770B";
      }
      if (result === "error") {
        return "\u5E7F\u544A\u51FA\u4E86\u70B9\u95EE\u9898\uFF0C\u518D\u8BD5\u4E00\u6B21";
      }
      return "\u5E7F\u544A\u8FD8\u5728\u52A0\u8F7D\uFF0C\u8FC7\u51E0\u79D2\u518D\u70B9";
    }
    adWatchNativeTitle(result) {
      if (result === "skipped") {
        return "\u770B\u5B8C\u624D\u80FD\u9886";
      }
      if (isWxDesktopIdeHost()) {
        return "\u8BF7\u7528\u771F\u673A\u9884\u89C8";
      }
      if (result === "error") {
        return "\u5E7F\u544A\u6253\u5F00\u5931\u8D25";
      }
      return "\u5E7F\u544A\u8FD8\u5728\u52A0\u8F7D";
    }
    boosterIdFromButton(id) {
      if (id === "booster_hammer") {
        return "hammer";
      }
      if (id === "booster_shuffle") {
        return "shuffle";
      }
      return "extraMoves";
    }
    async requestBoosterRefill(id) {
      if (this.boosterShareClaimReady === id) {
        this.grantBoosterShareClaim(id);
        return;
      }
      const channel = this.session.getBoosterRefillChannel(id);
      if (channel === "none") {
        this.notifyUser("\u73B0\u5728\u4E0D\u80FD\u9886\u9053\u5177", "\u6682\u65F6\u4E0D\u80FD\u9886");
        return;
      }
      if (channel === "ad") {
        this.notifyUser("\u6B63\u5728\u6253\u5F00\u5E7F\u544A\u2026", "\u6B63\u5728\u6253\u5F00\u5E7F\u544A");
        const result = await this.runDuringAd(() => this.session.watchAdForBooster(id));
        this.clearAdPrompt();
        if (result === "revived") {
          this.onBoosterRefillGranted(id, "ad");
        } else {
          this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
        }
        return;
      }
      this.boosterShareScene = channel === "friend" ? "booster_friend" : "booster_group";
      this.pendingBoosterShare = id;
      this.pendingBoosterShareAtMs = Date.now();
      this.pendingBoosterShareHiddenAtMs = 0;
      this.boosterShareClaimReady = null;
      const opened = this.share.shareToFriend();
      this.boosterShareScene = null;
      if (!opened) {
        this.clearPendingBoosterShare();
        this.notifyUser("\u8BF7\u8F6C\u53D1\u7ED9\u597D\u53CB\u540E\u518D\u9886\u53D6", "\u8BF7\u5148\u8F6C\u53D1");
        return;
      }
      this.notifyUser(
        channel === "friend" ? "\u8BF7\u70B9\u300C\u53D1\u9001\u300D\uFF0C\u5173\u95ED\u540E\u518D\u9886\u53D6\u7EA2\u8272 1" : "\u8BF7\u70B9\u300C\u53D1\u9001\u300D\uFF0C\u5173\u95ED\u540E\u518D\u9886\u53D6\u7EA2\u8272 1",
        channel === "friend" ? "\u8F6C\u53D1\u597D\u53CB" : "\u8F6C\u53D1\u5230\u7FA4"
      );
    }
    clearPendingBoosterShare() {
      this.pendingBoosterShare = null;
      this.pendingBoosterShareAtMs = 0;
      this.pendingBoosterShareHiddenAtMs = 0;
      this.boosterShareClaimReady = null;
      this.boosterShareModalOpen = false;
    }
    /** 开发者工具：分享面板关掉并点到游戏后，才弹出领取确认。 */
    promptDevtoolsBoosterClaim(id) {
      return new Promise((resolve) => {
        if (typeof wx.showModal !== "function") {
          this.grantBoosterShareClaim(id);
          resolve();
          return;
        }
        try {
          wx.showModal({
            title: id === "shuffle" ? "\u9886\u53D6\u91CD\u6392" : "\u9886\u53D6\u9053\u5177",
            content: "\u82E5\u5DF2\u70B9\u5206\u4EAB\u9762\u677F\u300C\u53D1\u9001\u300D\uFF0C\u8BF7\u70B9\u300C\u9886\u53D6\u300D\u3002\n\u91CD\u6392\u4F1A\u50CF\u9524\u5B50\u4E00\u6837\u51FA\u73B0\u7EA2\u8272 1\u3002",
            confirmText: "\u9886\u53D6",
            cancelText: "\u672A\u8F6C\u53D1",
            success: (res) => {
              if (res.confirm && (this.pendingBoosterShare === id || this.boosterShareClaimReady === id)) {
                this.grantBoosterShareClaim(id);
              } else {
                this.clearPendingBoosterShare();
                this.notifyUser("\u672A\u9886\u53D6\uFF0C\u8F6C\u53D1\u540E\u53EF\u518D\u8BD5", "\u672A\u9886\u53D6");
              }
              resolve();
            },
            fail: () => {
              this.grantBoosterShareClaim(id);
              resolve();
            }
          });
        } catch (e) {
          this.grantBoosterShareClaim(id);
          resolve();
        }
      });
    }
    /**
     * 从分享返回后的结算入口。
     * 分享面板开着时点不到画布，因此开发者工具里「点到游戏」= 面板已关。
     */
    trySettleBoosterShareAfterReturn() {
      const id = this.pendingBoosterShare;
      if (!id) {
        return;
      }
      const elapsed = Date.now() - this.pendingBoosterShareAtMs;
      if (elapsed < 900) {
        return;
      }
      if (isWxDesktopIdeHost()) {
        if (this.boosterShareModalOpen) {
          return;
        }
        this.boosterShareModalOpen = true;
        this.boosterShareClaimReady = id;
        void this.promptDevtoolsBoosterClaim(id).finally(() => {
          this.boosterShareModalOpen = false;
        });
        return;
      }
      if (this.boosterShareClaimReady === id) {
        return;
      }
      this.boosterShareClaimReady = id;
      this.notifyUser(
        id === "shuffle" ? "\u8F6C\u53D1\u5B8C\u6210\uFF0C\u518D\u70B9\u91CD\u6392\u9886\u53D6\u7EA2\u8272 1" : "\u8F6C\u53D1\u5B8C\u6210\uFF0C\u518D\u70B9\u9053\u5177\u9886\u53D6",
        "\u518D\u70B9\u9886\u53D6"
      );
      this.requestPaint();
    }
    grantBoosterShareClaim(id) {
      if (this.pendingBoosterShare !== id && this.boosterShareClaimReady !== id) {
        return;
      }
      const channel = this.session.getBoosterRefillChannel(id);
      this.clearPendingBoosterShare();
      if (channel !== "friend" && channel !== "group") {
        return;
      }
      if (!this.session.claimBoosterShare(id)) {
        return;
      }
      this.inputMuteUntilMs = Math.max(this.inputMuteUntilMs, (this.nowMs || Date.now()) + 480);
      this.onBoosterRefillGranted(id, channel);
    }
    onBoosterRefillGranted(id, channel) {
      if (id === "hammer") {
        this.hammerTargeting = true;
        this.hammerCursor = { x: this.width / 2, y: this.height * 0.45 };
        this.notifyUser(
          channel === "ad" ? "\u770B\u5E7F\u544A\u83B7\u5F97\u9524\u5B50\uFF0C\u70B9\u4E00\u683C\u7838\u6389" : "\u5DF2\u83B7\u5F97\u9524\u5B50\uFF0C\u70B9\u4E00\u683C\u7838\u6389",
          "\u5DF2\u83B7\u5F97\u9524\u5B50"
        );
        return;
      }
      if (id === "shuffle") {
        this.notifyUser(
          `\u91CD\u6392 +1 \xB7 \u5269\u4F59 ${this.session.getBoosterCount("shuffle")}`,
          "\u91CD\u6392+1"
        );
        this.requestPaint();
        return;
      }
      this.notifyUser(`\u6B65\u6570 +${5} \xB7 \u5269\u4F59 ${this.session.getMovesLeft()}`, "\u6B65\u6570+5");
    }
    /** 画布提示 + 微信 Toast，点底部广告时一定看得到。 */
    notifyUser(text, nativeTitle) {
      this.statusText = text;
      this.toastText = text;
      this.toastUntilMs = (this.nowMs || Date.now()) + 3200;
      this.requestPaint();
      if (isWxDesktopIdeHost()) {
        return;
      }
      if (typeof wx.showToast === "function") {
        try {
          wx.showToast({
            title: nativeTitle != null ? nativeTitle : text.slice(0, 7),
            icon: "none",
            duration: 2500
          });
        } catch (e) {
        }
      }
    }
    /** 点击入口：直进当前关（无限进度叠加，无关卡列表页）。 */
    enterMahjongPlay() {
      this.leavingLobby = true;
      this.interceptLobbyBanner();
      const level = this.session.mahjong.resolveEntryLevel();
      const needReplayGate = !this.session.mahjong.canFreeEnterMahjongLevel(level);
      if (needReplayGate) {
        this.mahjongEntryGateLevel = level;
        this.leavingLobby = false;
        this.statusText = "\u672C\u5173\u9700\u6D88\u8017\u9986\u9986\u91D1\u5E01\u6216\u770B\u5E7F\u544A\u540E\u518D\u8FDB";
        this.requestPaint();
        return;
      }
      this.mahjongEntryGateLevel = null;
      this.session.mahjong.trackHallEnter(level);
      void this.openMahjongPlayWhenReady();
    }
    /** 先加载五面壳 + 萌宠贴图，再进对局，避免第 1 关首帧空白/绿牌。 */
    async openMahjongPlayWhenReady() {
      try {
        this.session.mahjong.enterFromHall();
        this.mahjongWinShownAtMs = 0;
        this.mahjongSuppressAutoNext = false;
        this.resetMahjongSlotAnimations();
        this.resetMahjongPileSway();
        this.mahjongTimerPaintSec = -1;
        this.mahjongDrawRecoverAttempted = false;
        this.mahjongSlotFullOfferDismissed = false;
        await this.ensureMahjongTileShellPackLoaded();
        await this.syncMahjongThemeAssets();
        void this.session.refreshMahjongThemeCatalog().finally(() => {
          void this.syncMahjongThemeAssets();
        });
        this.mode = "mahjong_play";
        this.queueMahjongIntroBanner();
        this.markUserActivity();
        this.requestPaint();
      } catch (err) {
        console.error("[crush-crush] mahjong enter failed", err);
        this.leavingLobby = false;
        this.syncLobbyBanner();
        this.notifyUser("\u9EBB\u5C06\u9986\u8FDB\u4E0D\u53BB\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u8FDB\u9986\u5931\u8D25");
        this.requestPaint();
      }
    }
    async loadMahjongShellPackOnce() {
      const [front, frontWhite, frontPetRabbit, top, bottom, left, right, back] = await Promise.all([
        this.loadBgImage(MAHJONG_SHELL_SRC.front),
        this.loadBgImage(MAHJONG_SHELL_SRC.frontWhite),
        this.loadBgImage(MAHJONG_SHELL_SRC.frontPetRabbit),
        this.loadBgImage(MAHJONG_SHELL_SRC.top),
        this.loadBgImage(MAHJONG_SHELL_SRC.bottom),
        this.loadBgImage(MAHJONG_SHELL_SRC.left),
        this.loadBgImage(MAHJONG_SHELL_SRC.right),
        this.loadBgImage(MAHJONG_SHELL_SRC.back)
      ]);
      return applyMahjongShellImages({
        front,
        frontWhite,
        frontPetRabbit,
        top,
        bottom,
        left,
        right,
        back
      });
    }
    async ensureMahjongTileShellPackLoaded() {
      if (isMahjongTileShellReady()) {
        return;
      }
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        this.mahjongShellLoadAttempts += 1;
        const ok = await this.loadMahjongShellPackOnce();
        if (ok) {
          console.info(
            "[mahjong-shell] ready v",
            MAHJONG_SHELL_ASSET_VER,
            "(attempt",
            this.mahjongShellLoadAttempts,
            ")"
          );
          return;
        }
        console.warn(
          "[mahjong-shell] missing:",
          getMahjongShellMissingKeys().join(", "),
          "paths=",
          Object.values(MAHJONG_SHELL_SRC).join(" | ")
        );
        await new Promise((resolve) => {
          setTimeout(resolve, 180);
        });
      }
    }
    async syncMahjongThemeAssets() {
      var _a;
      const game = this.session.mahjong.getActiveGame();
      if (!game) {
        return;
      }
      await this.ensureMahjongTileShellPackLoaded();
      const result = await this.mahjongThemeAssets.ensureTheme(game.themeId, game.typeCount);
      this.mahjongActiveTheme = result.theme;
      this.mahjongDisplayThemeId = result.theme.themeId;
      if (result.usedFallback) {
        this.session.mahjong.trackThemeCdnFallback(result.requestedThemeId);
      }
      clearMahjongTileRasterCache();
      clearMahjongPileLayoutCache();
      clearMahjongPlaySceneBackgroundCache();
      const themeKey = (_a = this.mahjongDisplayThemeId) != null ? _a : game.themeId;
      warmMahjongTileRasterCache(
        themeKey,
        game.typeCount,
        (typeIndex) => this.mahjongThemeAssets.getTileImage(themeKey, typeIndex),
        (offCtx, t, st, fd, fw, lu) => drawStandingMahjongTileBlocks(offCtx, t, lu, st, fw, fd, 1),
        this.width
      );
      this.requestPaint();
    }
    buildMahjongPlayChrome(game) {
      var _a, _b;
      const theme = this.mahjongActiveTheme;
      const now = this.nowMs || Date.now();
      const autoNextMs = game.phase === "won" && !this.mahjongSuppressAutoNext && this.mahjongWinShownAtMs > 0 ? Math.max(0, MAHJONG_AUTO_NEXT_MS - (now - this.mahjongWinShownAtMs)) : 0;
      return {
        themeName: theme == null ? void 0 : theme.name,
        background: theme == null ? void 0 : theme.background,
        playBgImage: (_a = this.bgLobby) != null ? _a : this.bgLevel,
        autoNextMs,
        pileSway: this.mahjongPileSway,
        tileJitters: this.mahjongTileJitters,
        tileImage: (typeIndex) => {
          var _a2;
          return this.mahjongThemeAssets.getTileImage(
            (_a2 = this.mahjongDisplayThemeId) != null ? _a2 : game.themeId,
            typeIndex
          );
        },
        tileRasterThemeKey: (_b = this.mahjongDisplayThemeId) != null ? _b : game.themeId,
        toolIcon: (tool) => this.mahjongToolIcons.get(tool),
        slotFullModalBg: this.mahjongSlotFullModalBg,
        toolOfferModalBg: this.mahjongSlotFullModalBg
      };
    }
    async advanceMahjongAfterWin() {
      if (this.mahjongAutoNextInFlight) {
        return;
      }
      const game = this.session.mahjong.getActiveGame();
      if (!game || game.phase !== "won") {
        return;
      }
      this.mahjongAutoNextInFlight = true;
      const next = game.level + 1;
      this.mahjongWinShownAtMs = 0;
      this.mahjongSuppressAutoNext = false;
      this.resetMahjongSlotAnimations();
      await this.session.mahjong.finishActive(true);
      this.session.mahjong.startLevel(next, false);
      this.session.mahjong.trackAutoNext(next);
      void this.syncMahjongThemeAssets();
      this.mode = "mahjong_play";
      this.queueMahjongIntroBanner();
      this.requestPaint();
      this.mahjongAutoNextInFlight = false;
    }
    async runMahjongAdReplayRestart(fromLobbyGate = false) {
      const result = await this.session.showMahjongAdReplayUnlock();
      if (result === "restarted") {
        this.mahjongEntryGateLevel = null;
        this.mahjongSlotFullOfferDismissed = false;
        this.mahjongSuppressAutoNext = false;
        this.resetMahjongSlotAnimations();
        if (fromLobbyGate) {
          this.leavingLobby = true;
          await this.openMahjongPlayWhenReady();
        } else {
          void this.syncMahjongThemeAssets();
          this.mode = "mahjong_play";
          this.queueMahjongIntroBanner();
        }
      } else if (result === "skipped") {
        this.notifyUser("\u770B\u5B8C\u89C6\u9891\u624D\u80FD\u7EE7\u7EED", "\u6FC0\u52B1\u89C6\u9891");
      } else if (result === "unavailable") {
        this.notifyUser("\u89C6\u9891\u52A0\u8F7D\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u5E7F\u544A");
      } else {
        this.notifyUser("\u91CD\u5F00\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u5E7F\u544A");
      }
      this.requestPaint();
    }
    async runMahjongSlotFullReviveAd() {
      const result = await this.session.showMahjongSlotFullReviveAd();
      if (result === "revived") {
        this.mahjongSuppressAutoNext = false;
        this.mahjongSlotFullOfferDismissed = false;
        this.notifyUser("\u5DF2\u79FB\u51FA3\u5F20\u82B1\u724C\uFF0C\u8BF7\u7EE7\u7EED\u6D88\u9664", "\u79FB\u51FA\u6210\u529F");
        void this.session.mahjong.saveActiveRun();
      } else if (result === "skipped") {
        this.notifyUser("\u770B\u5B8C\u89C6\u9891\u624D\u80FD\u590D\u6D3B", "\u6FC0\u52B1\u89C6\u9891");
      } else if (result === "unavailable") {
        this.notifyUser("\u89C6\u9891\u52A0\u8F7D\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u5E7F\u544A");
      } else if (result === "error") {
        this.notifyUser("\u590D\u6D3B\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u5E7F\u544A");
      }
      this.requestPaint();
    }
    mahjongToolLabel(tool) {
      return MAHJONG_TOOL_LABELS[tool];
    }
    async handleMahjongUi(btn) {
      var _a, _b, _c, _d, _e;
      this.session.playUiSfx();
      this.markUserActivity();
      const gamePhase = (_a = this.session.mahjong.getActiveGame()) == null ? void 0 : _a.phase;
      if (gamePhase === "won" || gamePhase === "lost") {
        this.mahjongSuppressAutoNext = true;
      }
      let id = btn.id;
      if (id === "mahjong_fail_close") {
        id = "mahjong_back_lobby";
      }
      if (id === "mahjong_slot_full_close") {
        this.mahjongSlotFullOfferDismissed = true;
        const lostGame = this.session.mahjong.getActiveGame();
        if (lostGame) {
          this.syncMahjongFailStageBanner(lostGame);
        }
        this.requestPaint();
        return;
      }
      if (id === "mahjong_back_home") {
        this.session.mahjong.leaveTable();
        this.mode = "lobby";
        this.leavingLobby = false;
        this.syncLobbyBanner();
        this.requestPaint();
        return;
      }
      if (id === "mahjong_back_lobby") {
        const game = this.session.mahjong.getActiveGame();
        if ((game == null ? void 0 : game.phase) === "won") {
          await this.session.mahjong.finishActive(true);
        } else if ((game == null ? void 0 : game.phase) === "lost") {
          await this.session.mahjong.finishActive(false);
        } else {
          this.session.mahjong.leaveTable();
        }
        this.mahjongSlotFullOfferDismissed = false;
        this.mode = "lobby";
        this.leavingLobby = false;
        this.syncLobbyBanner();
        this.requestPaint();
        return;
      }
      if (id === "mahjong_slot_full_ad" || id === "mahjong_fail_revive") {
        await this.runMahjongSlotFullReviveAd();
        return;
      }
      if (id === "mahjong_replay_ad") {
        await this.runMahjongAdReplayRestart(false);
        return;
      }
      if (id === "mahjong_ad_slot") {
        const result = await this.session.showMahjongAdSlot();
        if (result === "unlocked") {
          this.notifyUser("\u5DF2\u89E3\u9501\u672C\u5C40\u7B2C 7 \u69FD", "\u89E3\u9501\u6210\u529F");
        } else if (result === "skipped") {
          this.notifyUser("\u770B\u5B8C\u89C6\u9891\u624D\u80FD\u89E3\u9501", "\u6FC0\u52B1\u89C6\u9891");
        } else if (result === "disabled") {
          this.notifyUser("\u89C6\u9891\u69FD\u6682\u672A\u5F00\u653E", "\u89E3\u9501");
        } else if (result === "unavailable") {
          this.notifyUser("\u89C6\u9891\u52A0\u8F7D\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u5E7F\u544A");
        } else if (result === "error") {
          this.notifyUser("\u89E3\u9501\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u5E7F\u544A");
        }
        this.requestPaint();
        return;
      }
      if (id === "mahjong_tool_modal_close") {
        this.mahjongToolOffer = null;
        this.requestPaint();
        return;
      }
      if (id === "mahjong_tool_modal_ad") {
        const tool = this.mahjongToolOffer;
        if (!tool) {
          return;
        }
        const result = await this.session.showMahjongToolGrantAd(tool);
        if (result === "granted") {
          this.mahjongToolOffer = null;
          this.notifyUser(`\u5DF2\u83B7\u5F97 1 \u4E2A${this.mahjongToolLabel(tool)}`, "\u9053\u5177");
          void this.session.mahjong.saveActiveRun();
        } else if (result === "skipped") {
          this.notifyUser("\u770B\u5B8C\u89C6\u9891\u624D\u80FD\u9886\u53D6", "\u6FC0\u52B1\u89C6\u9891");
        } else if (result === "unavailable") {
          this.notifyUser("\u89C6\u9891\u52A0\u8F7D\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u5E7F\u544A");
        } else {
          this.notifyUser("\u9886\u53D6\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "\u5E7F\u544A");
        }
        this.requestPaint();
        return;
      }
      if (id === "mahjong_tool_modal_coin") {
        if (!isMahjongCoinPaymentsEnabled()) {
          return;
        }
        const tool = this.mahjongToolOffer;
        if (!tool) {
          return;
        }
        const cost = mahjongCoinCost();
        if (this.session.mahjong.buyTool(tool)) {
          this.mahjongToolOffer = null;
          this.notifyUser(
            `\u5DF2\u5151\u6362 1 \u4E2A${this.mahjongToolLabel(tool)}`,
            `\u91D1\u5E01 -${formatMahjongGlobalCoinAmount(cost)}`
          );
        } else {
          this.notifyUser(
            "\u68AF\u5B50\u91D1\u5E01\u4E0D\u8DB3\uFF0C\u53BB\u7CD6\u679C\u68AF\u5B50\u95EF\u5173\u5427",
            `\u9700\u8981${formatMahjongGlobalCoinCostLabel(cost)}`
          );
        }
        this.requestPaint();
        return;
      }
      if (id.startsWith("mahjong_tool_")) {
        const tool = id.replace("mahjong_tool_", "");
        const game = this.session.mahjong.getActiveGame();
        if (!game || game.phase !== "playing") {
          return;
        }
        if (game.tools[tool] <= 0) {
          this.mahjongToolOffer = tool;
          this.requestPaint();
          return;
        }
        this.resetMahjongSlotAnimations();
        if (!game.useTool(tool)) {
          const hint = tool === "reveal" ? "\u6CA1\u6709\u53EF\u7FFB\u5F00\u7684\u6263\u724C" : "\u5F53\u524D\u65E0\u6CD5\u4F7F\u7528\u8BE5\u9053\u5177";
          this.notifyUser(hint, "\u9053\u5177");
        } else {
          if (tool === "reveal") {
            this.notifyUser("\u5DF2\u7FFB\u5F00\u4E00\u5F20\u6263\u724C", "\u7FFB\u724C");
          }
          this.session.mahjong.trackToolUse(tool, game.level);
          void this.session.mahjong.saveActiveRun();
        }
        this.requestPaint();
        return;
      }
      if (id === "mahjong_next") {
        const game = this.session.mahjong.getActiveGame();
        const next = ((_b = game == null ? void 0 : game.level) != null ? _b : 1) + 1;
        await this.session.mahjong.finishActive(true);
        this.session.mahjong.startLevel(next, false);
        this.mahjongWinShownAtMs = 0;
        void this.syncMahjongThemeAssets();
        this.mode = "mahjong_play";
        this.queueMahjongIntroBanner();
        this.requestPaint();
        return;
      }
      if (id === "mahjong_retry") {
        const game = this.session.mahjong.getActiveGame();
        const level = (_c = game == null ? void 0 : game.level) != null ? _c : 1;
        await this.session.mahjong.finishActive(true);
        await this.session.mahjong.clearSavedRun();
        this.session.mahjong.startLevel(level, false);
        this.mode = "mahjong_play";
        this.queueMahjongIntroBanner();
        this.requestPaint();
        return;
      }
      if (id === "mahjong_fail_replay") {
        if (!isMahjongCoinPaymentsEnabled()) {
          await this.runMahjongAdReplayRestart(false);
          return;
        }
        const game = this.session.mahjong.getActiveGame();
        const level = (_d = game == null ? void 0 : game.level) != null ? _d : 1;
        if (!this.session.mahjong.payReplay()) {
          this.notifyUser(
            "\u989D\u5EA6\u4E0D\u8DB3",
            `\u9700\u8981${formatMahjongGlobalCoinCostLabel(MAHJONG_REPLAY_COIN_COST)}`
          );
          return;
        }
        this.mahjongSlotFullOfferDismissed = false;
        this.mahjongSuppressAutoNext = false;
        this.resetMahjongSlotAnimations();
        await this.session.mahjong.restartLevel(level);
        void this.syncMahjongThemeAssets();
        this.mode = "mahjong_play";
        this.queueMahjongIntroBanner();
        this.requestPaint();
        return;
      }
      if (id === "mahjong_replay_coin") {
        if (!isMahjongCoinPaymentsEnabled()) {
          await this.runMahjongAdReplayRestart(false);
          return;
        }
        const game = this.session.mahjong.getActiveGame();
        const level = (_e = game == null ? void 0 : game.level) != null ? _e : 1;
        if (!this.session.mahjong.payReplay()) {
          this.notifyUser(
            "\u989D\u5EA6\u4E0D\u8DB3",
            `\u9700\u8981${formatMahjongGlobalCoinCostLabel(MAHJONG_REPLAY_COIN_COST)}`
          );
          return;
        }
        await this.session.mahjong.finishActive(false);
        await this.session.mahjong.clearSavedRun();
        this.mahjongSlotFullOfferDismissed = false;
        this.session.mahjong.startLevel(level, false);
        this.mode = "mahjong_play";
        this.queueMahjongIntroBanner();
        this.requestPaint();
        return;
      }
    }
    async handleButton(id, levelId) {
      var _a, _b, _c, _d;
      if (id === "booster_hammer" || id === "booster_shuffle" || id === "booster_extra" || id === "mute" || id === "level" || id === "lobby" || id === "settings" || id === "howto" || id === "notice" || id === "club" || id === "recommend" || id === "post" || id === "invite" || id === "daily_open" || id === "daily_claim" || id === "lb_tab_level" || id === "lb_tab_week" || id === "resume" || id === "mahjong_hall") {
        this.session.playUiSfx();
      }
      if (id === "mahjong_hall") {
        void this.session.dismissMahjongHallNewBadge().then(() => {
          this.requestPaint();
        });
        if (!this.session.isMahjongHallUnlocked()) {
          const cleared = this.session.getMaxClearedLevelId();
          this.notifyUser(
            mahjongHallLockHint(),
            mahjongHallLockToastTitle(cleared)
          );
          this.openOverlay("mahjong_lock");
          return;
        }
        this.enterMahjongPlay();
        return;
      }
      if (id === "level") {
        const target = levelId != null ? levelId : this.resolveEntryLevelId();
        if (target < 1 || target > this.session.getLevelCount()) {
          this.statusText = "\u5173\u5361\u4E0D\u5B58\u5728";
          return;
        }
        if (!this.session.isLevelUnlocked(target)) {
          const need = Math.max(1, target - 1);
          this.statusText = `\u7B2C ${target} \u5173\u672A\u89E3\u9501\uFF0C\u5148\u901A\u5173\u7B2C ${need} \u5173`;
          return;
        }
        await this.enterLevel(target);
        return;
      }
      if (id === "settings") {
        this.openOverlay("settings");
        return;
      }
      if (id === "howto") {
        this.overlayFromSettings = this.overlay === "settings";
        this.openOverlay("howto");
        return;
      }
      if (id === "dismiss_clear_announce") {
        this.session.clearPostClearAnnouncement();
        this.requestPaint();
        return;
      }
      if (id === "notice") {
        this.overlayFromSettings = this.overlay === "settings";
        this.openOverlay("notice");
        return;
      }
      if (id === "daily_open") {
        this.openOverlay("daily_tasks");
        return;
      }
      if (id === "daily_claim") {
        const task = this.session.getDailyTasksView().tasks[levelId != null ? levelId : -1];
        const text = task ? this.session.claimDailyTask(task.id) : null;
        if (text) {
          this.notifyUser(text, "\u4EFB\u52A1\u5956\u52B1");
        }
        this.requestPaint();
        return;
      }
      if (id === "daily_chest" || id === "daily_chest_double") {
        if (this.dailyChestBusy) {
          return;
        }
        this.dailyChestBusy = true;
        try {
          const doubled = id === "daily_chest_double";
          const text = doubled ? await this.runDuringAd(() => this.session.claimDailyChest(true)) : await this.session.claimDailyChest(false);
          if (text) {
            this.notifyUser(text, doubled ? "\u53CC\u500D\u5B9D\u7BB1" : "\u6D3B\u8DC3\u5B9D\u7BB1");
          } else if (doubled) {
            this.notifyUser("\u770B\u5B8C\u89C6\u9891\u624D\u80FD\u9886\u53CC\u500D\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u9886\u53D6", "\u5B9D\u7BB1");
          }
        } finally {
          this.dailyChestBusy = false;
          this.requestPaint();
        }
        return;
      }
      if (id === "lb_tab_level" || id === "lb_tab_week") {
        this.leaderboardTab = id === "lb_tab_week" ? "week" : "level";
        this.leaderboardScrollY = 0;
        this.requestPaint();
        return;
      }
      if (id === "club") {
        this.openGameClub();
        return;
      }
      if (id === "recommend") {
        await this.openGameRecommend();
        return;
      }
      if (id === "resume") {
        if (this.overlayFromSettings && (this.overlay === "howto" || this.overlay === "notice")) {
          if (this.overlay === "notice") {
            void this.session.markNoticeSeen(notice_default.id);
          }
          this.overlayFromSettings = false;
          this.openOverlay("settings");
          return;
        }
        this.closeOverlay();
        return;
      }
      if (id === "post") {
        await this.publishOfficialAccountPost();
        return;
      }
      if (id === "invite") {
        this.share.shareToFriend();
        return;
      }
      if (id === "leaderboard") {
        void (async () => {
          await this.session.ensureWxUserProfile();
          await this.refreshLeaderboardView();
          this.openOverlay("leaderboard");
        })();
        return;
      }
      if (id === "profile_skip") {
        markWxProfileAsked();
        this.destroyUserInfoAuthButton();
        this.closeOverlay();
        return;
      }
      if (id === "lobby") {
        this.settleBurstModesForLeave();
        await this.maybeRunSettleInterstitial();
        if (!this.session.returnToLobby()) {
          this.session.quitToLobby();
        }
        this.showLobby();
        return;
      }
      if (id === "mute") {
        this.session.setMuted(!this.session.isMuted());
        this.statusText = this.session.isMuted() ? "\u5DF2\u9759\u97F3" : "\u97F3\u6548\u5DF2\u5F00";
        if (!this.session.isMuted()) {
          this.bgmStarted = false;
          this.tryStartBgm();
        }
        return;
      }
      if (id === "booster_hammer") {
        if (this.session.getBoosterCount("hammer") <= 0) {
          await this.requestBoosterRefill("hammer");
          return;
        }
        this.hammerTargeting = !this.hammerTargeting;
        if (this.hammerTargeting) {
          this.hammerCursor = { x: this.width / 2, y: this.height * 0.45 };
          this.statusText = "\u70B9\u4E00\u683C\u4F7F\u7528\u9524\u5B50";
        } else {
          this.hammerCursor = null;
          this.statusText = "\u5DF2\u53D6\u6D88\u9524\u5B50";
        }
        return;
      }
      if (id === "booster_shuffle") {
        this.hammerTargeting = false;
        this.hammerCursor = null;
        if (this.animator.isPlaying()) {
          this.statusText = "\u8BF7\u7B49\u6D88\u9664\u64AD\u5B8C\u518D\u91CD\u6392";
          return;
        }
        if (this.session.getBoosterCount("shuffle") <= 0) {
          await this.requestBoosterRefill("shuffle");
          return;
        }
        if (!this.session.useShuffle()) {
          this.statusText = "\u73B0\u5728\u4E0D\u80FD\u91CD\u6392";
          return;
        }
        this.boardView.clearSelection();
        this.syncBoardView();
        this.statusText = "\u5C0F\u52A8\u7269\u91CD\u65B0\u6392\u5217\u5566\uFF01";
        return;
      }
      if (id === "booster_extra") {
        this.hammerTargeting = false;
        this.hammerCursor = null;
        if (this.session.getBoosterCount("extraMoves") > 0) {
          if (!this.session.useExtraMoves()) {
            this.statusText = "\u73B0\u5728\u4E0D\u80FD\u52A0\u6B65";
          } else {
            this.statusText = `\u6B65\u6570 +${5} \xB7 \u5269\u4F59 ${this.session.getMovesLeft()}`;
          }
          return;
        }
        await this.requestBoosterRefill("extraMoves");
        return;
      }
      if (id === "crush_skip") {
        if (this.session.fsm.getCurrent() === "CrushReward") {
          this.session.finishCrushReward();
        }
        return;
      }
      if (id === "clean_skip") {
        if (this.session.fsm.getCurrent() === "Cleaning") {
          this.session.finishCleaningMode();
        }
        return;
      }
      if (id === "clean_yes") {
        if (this.session.startCleaningMode()) {
          this.openClean();
        } else {
          this.offerCleanPrompt = false;
          this.statusText = "\u6682\u65F6\u65E0\u6CD5\u8FDB\u5165\u6E05\u6D01\u6A21\u5F0F";
        }
        return;
      }
      if (id === "clean_no") {
        this.session.declineCleaningOffer();
        this.offerCleanPrompt = false;
        this.resultFx.start(
          true,
          this.nowMs || Date.now(),
          this.width,
          this.height,
          this.session.getScore()
        );
        this.statusText = this.session.hasNextLevel() ? "\u53EF\u8FDB\u5165\u4E0B\u4E00\u5173" : "\u672C\u5173\u7ED3\u7B97\u5B8C\u6210";
        return;
      }
      if (id === "crush_extend") {
        this.notifyUser("\u6B63\u5728\u6253\u5F00\u5E7F\u544A\u2026", "\u6B63\u5728\u6253\u5F00\u5E7F\u544A");
        const result = await this.runDuringAd(
          () => this.session.watchAdToExtendCrush()
        );
        this.clearAdPrompt();
        if (result === "revived") {
          this.notifyUser("\u7C89\u788E\u65F6\u95F4\u5EF6\u957F\uFF01", "\u65F6\u95F4+5\u79D2");
        } else {
          this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
        }
        return;
      }
      if (id === "revive") {
        this.notifyUser("\u6B63\u5728\u6253\u5F00\u5E7F\u544A\u2026", "\u6B63\u5728\u6253\u5F00\u5E7F\u544A");
        const result = await this.runDuringAd(() => this.session.watchAdToRevive());
        this.clearAdPrompt();
        if (result === "revived") {
          this.notifyUser("\u590D\u6D3B\u6210\u529F\uFF0C\u7EE7\u7EED\u95EF\u5173\uFF01", "\u590D\u6D3B\u6210\u529F");
        } else {
          this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
        }
        if (result === "revived") {
          this.closeOverlay();
          this.mode = "playing";
          this.pendingResult = null;
          this.resultFx.stop();
          this.boardView.bindInput((a, b, c, d) => {
            this.session.trySwap(a, b, c, d);
          });
          this.syncBoardView();
        }
        return;
      }
      if (id === "retry") {
        this.settleBurstModesForLeave();
        await this.session.retryLevel();
        this.mode = "playing";
        this.buriedFx.clear();
        this.applyLevelEntryTip((_b = (_a = this.session.getLevelConfig()) == null ? void 0 : _a.id) != null ? _b : 0);
        this.pendingResult = null;
        this.offerCleanPrompt = false;
        this.resultFx.stop();
        this.crushBursts = [];
        this.closeOverlay();
        this.boardView.bindInput((a, b, c, d) => {
          this.session.trySwap(a, b, c, d);
        });
        this.syncBoardView();
        return;
      }
      if (id === "next") {
        this.settleBurstModesForLeave();
        await this.maybeRunSettleInterstitial();
        const ok = await this.session.continueToNextLevel();
        if (!ok) {
          this.statusText = notice_default.body;
          this.notifyUser(notice_default.body);
          if (!this.session.returnToLobby()) {
            this.session.quitToLobby();
          }
          this.showLobby();
          return;
        }
        this.mode = "playing";
        this.applyLevelEntryTip((_d = (_c = this.session.getLevelConfig()) == null ? void 0 : _c.id) != null ? _d : 0);
        this.pendingResult = null;
        this.offerCleanPrompt = false;
        this.resultFx.stop();
        this.crushBursts = [];
        this.closeOverlay();
        this.boardView.bindInput((a, b, c, d) => {
          this.session.trySwap(a, b, c, d);
        });
        this.syncBoardView();
        return;
      }
    }
    async refreshLeaderboardView() {
      const view = await this.session.loadFriendLeaderboard();
      this.boardViewModel = view;
      for (const row of view.rows) {
        if (row.avatarUrl) {
          this.prefetchAvatar(row.avatarUrl);
        }
      }
      this.requestPaint();
    }
    /**
     * 首次进入 / 冷启动进大厅：可选授权头像昵称。
     * 已授权或已问过则不再打扰。
     */
    maybeOfferLaunchProfileAuth() {
      if (this.mode !== "lobby") {
        return;
      }
      if (hasAskedWxProfile()) {
        return;
      }
      const cached = readCachedWxProfile(this.session.getInviteCode());
      if (hasRealWxProfile(cached)) {
        markWxProfileAsked();
        return;
      }
      setTimeout(() => {
        if (this.mode !== "lobby" || this.overlay !== "none") {
          return;
        }
        if (hasAskedWxProfile() || hasRealWxProfile(readCachedWxProfile(this.session.getInviteCode()))) {
          return;
        }
        this.openOverlay("profile_welcome");
        this.mountLaunchProfileAuthButton();
      }, 400);
    }
    mountLaunchProfileAuthButton() {
      var _a, _b, _c;
      this.destroyUserInfoAuthButton();
      if (this.overlay !== "profile_welcome") {
        return;
      }
      const panelW = Math.min(320, this.width - 40);
      const body = (_b = (_a = notice_default.profileWelcome) == null ? void 0 : _a.body) != null ? _b : "\u6388\u6743\u540E\uFF0C\u597D\u53CB\u6392\u884C\u4F1A\u663E\u793A\u4F60\u7684\u5934\u50CF\u548C\u6635\u79F0\u3002\u4E5F\u53EF\u8DF3\u8FC7\uFF0C\u4E0D\u5F71\u54CD\u6E38\u73A9\u3002";
      this.ctx.font = "13px sans-serif";
      const lines = this.wrapText(body, panelW - 40);
      const panelH = 168 + lines.length * 18;
      const panelY = Math.max(80, this.height * 0.28);
      const btnW = Math.min(220, panelW - 48);
      const btnH = 40;
      const left = (this.width - btnW) / 2;
      const top = panelY + panelH - 36 - 12 - btnH;
      const welcome = notice_default.profileWelcome;
      this.userInfoAuthButton = mountWxUserInfoAuthButton({
        left,
        top,
        width: btnW,
        height: btnH,
        text: (_c = welcome == null ? void 0 : welcome.btn) != null ? _c : "\u6388\u6743\u5934\u50CF\u6635\u79F0",
        onProfile: () => {
          var _a2;
          markWxProfileAsked();
          this.destroyUserInfoAuthButton();
          this.closeOverlay();
          this.notifyUser((_a2 = welcome == null ? void 0 : welcome.ok) != null ? _a2 : "\u5934\u50CF\u6635\u79F0\u5DF2\u4FDD\u5B58", "\u6388\u6743\u6210\u529F");
        },
        onFail: (message) => {
          var _a2;
          markWxProfileAsked();
          this.destroyUserInfoAuthButton();
          this.closeOverlay();
          showAuthFailModal((_a2 = welcome == null ? void 0 : welcome.fail) != null ? _a2 : message);
        }
      });
    }
    destroyUserInfoAuthButton() {
      if (!this.userInfoAuthButton) {
        return;
      }
      try {
        this.userInfoAuthButton.destroy();
      } catch (e) {
      }
      this.userInfoAuthButton = null;
    }
    openOverlay(kind) {
      if (kind !== "profile_welcome") {
        this.destroyUserInfoAuthButton();
      }
      this.overlay = kind;
      this.leaderboardScrollY = 0;
      this.leaderboardDrag = null;
      this.hammerTargeting = false;
      this.hammerCursor = null;
      this.boardView.onPointerCancel();
      this.syncLobbyBanner();
      this.requestPaint();
    }
    /** 进游戏不再自动弹公告；设置里仍可手动打开。 */
    maybeOpenLobbyNotice() {
      return;
    }
    closeOverlay() {
      if (this.overlay === "notice") {
        void this.session.markNoticeSeen(notice_default.id);
      }
      this.destroyUserInfoAuthButton();
      this.overlayFromSettings = false;
      this.leaderboardScrollY = 0;
      this.leaderboardDrag = null;
      this.overlay = "none";
      this.syncLobbyBanner();
      this.requestPaint();
    }
    /** 分享图菜单关掉（含取消）后把循环拉回来，否则设置页再也画不出来。 */
    restoreAfterShareSheet() {
      this.foreground.onShow();
      this.kickRenderLoop();
    }
    /** 首页「发表贴图」：合成带小游戏码的海报。 */
    async publishOfficialAccountPost() {
      const post = this.buildOfficialAccountPost();
      this.closeOverlay();
      try {
        this.draw();
      } catch (err) {
        console.error("[crush-crush] share capture draw failed", err);
      }
      const shot = await this.captureSharePoster();
      try {
        this.draw();
      } catch (err) {
        console.error("[crush-crush] share restore draw failed", err);
      }
      const images = shot ? [shot] : void 0;
      let opened = await this.share.shareToOfficialAccount({ ...post, images });
      if (!opened && shot) {
        opened = await this.share.sharePoster(shot);
      }
      this.restoreAfterShareSheet();
      this.statusText = opened ? "\u53EF\u628A\u6D77\u62A5\u53D1\u5230\u516C\u4F17\u53F7 / \u670B\u53CB\u5708" : "\u8BF7\u7528\u53F3\u4E0A\u89D2 \xB7\xB7\xB7 \u8F6C\u53D1\uFF0C\u6216\u5230\u516C\u4F17\u53F7\u53D1\u8D34\u56FE";
    }
    captureSharePoster() {
      var _a, _b;
      const poster = this.createPosterCanvas();
      if (poster) {
        const ctx = poster.getContext("2d");
        paintSharePoster(ctx, SHARE_POSTER_WIDTH, SHARE_POSTER_HEIGHT, {
          cover: this.bgLobby,
          qr: (_a = this.uiIcons.get("qr")) != null ? _a : null
        });
        return this.canvasToTempPath(poster);
      }
      paintSharePoster(this.ctx, this.width, this.height, {
        cover: this.bgLobby,
        qr: (_b = this.uiIcons.get("qr")) != null ? _b : null
      });
      return this.canvasToTempPath(this.canvas);
    }
    createPosterCanvas() {
      if (typeof wx.createCanvas !== "function") {
        return null;
      }
      const poster = wx.createCanvas();
      poster.width = SHARE_POSTER_WIDTH;
      poster.height = SHARE_POSTER_HEIGHT;
      return poster;
    }
    canvasToTempPath(canvas) {
      return new Promise((resolve) => {
        if (typeof canvas.toTempFilePath !== "function") {
          resolve(null);
          return;
        }
        canvas.toTempFilePath({
          fileType: "jpg",
          quality: 0.9,
          success: (res) => resolve(res.tempFilePath),
          fail: () => resolve(null)
        });
      });
    }
    buildOfficialAccountPost() {
      var _a, _b;
      const levelId = (_b = (_a = this.session.getLevelConfig()) == null ? void 0 : _a.id) != null ? _b : 1;
      const score = this.session.getScore();
      const tags = ["\u6765\u5FAE\u4FE1\u505A\u4E2A\u5C0F\u7A0B\u5E8F", "\u6D88\u6D88\u4E50", "\u89E3\u538B\u5C0F\u6E38\u620F"];
      const recommendTitle = "\u840C\u5BA0\u7C89\u788E\u6D88";
      if (this.mode === "playing" || this.mode === "result") {
        return {
          title: `\u6211\u5728\u300A\u840C\u5BA0\u7C89\u788E\u6D88\u300B\u7B2C ${levelId} \u5173\u62FF\u5230 ${score} \u5206`,
          content: `\u521A\u5728\u7CD6\u679C\u4E50\u56ED\u6D88\u5B8C\u840C\u5BA0\uFF1A\u7B2C ${levelId} \u5173 ${score} \u5206\u3002\u4E09\u8FDE\u6D88\u9664\uFF0C\u56DB\u8FDE\u51FA\u95EA\u5149\uFF0C\u4E94\u8FDE\u51FA\u8D85\u7EA7\u732B\u5934\u9E70\uFF1B\u8FC7\u5173\u8FD8\u80FD\u9650\u65F6\u7C89\u788E\uFF0C\u603B\u5206\u6EE1 1500 \u53EF\u53BB\u6E05\u6D01\u6E05\u626B\u3002#\u6765\u5FAE\u4FE1\u505A\u4E2A\u5C0F\u7A0B\u5E8F`,
          tags,
          recommendTitle
        };
      }
      if (this.mode === "crush" || this.mode === "clean") {
        return {
          title: "\u8FC7\u5173\u540E\u8FD8\u80FD\u70B9\u7740\u6E05\u626B\uFF0C\u8FD9\u6B3E\u840C\u5BA0\u4E09\u6D88\u592A\u89E3\u538B\u4E86",
          content: "\u300A\u840C\u5BA0\u7C89\u788E\u6D88\u300B\u901A\u5173\u4E0D\u53EA\u7ED3\u7B97\uFF1A\u9650\u65F6\u70B9\u51FB\u7206\u70B8\u52A0\u5206\uFF0C\u603B\u5206\u8FBE\u5230 1500 \u8FD8\u80FD\u8FDB\u6E05\u6D01\u6A21\u5F0F\u63A5\u7740\u626B\u3002\u6ED1\u52A8\u6D88\u9664 + \u70B9\u51FB\u6E05\u626B\uFF0C\u788E\u7247\u65F6\u95F4\u521A\u521A\u597D\u3002#\u6765\u5FAE\u4FE1\u505A\u4E2A\u5C0F\u7A0B\u5E8F",
          tags,
          recommendTitle
        };
      }
      return {
        title: "\u4ECE\u60F3\u6CD5\u5230\u4E0A\u7EBF\uFF1A\u6211\u4EEC\u4E3A\u4EC0\u4E48\u7528\u5FAE\u4FE1\u505A\u4E00\u6B3E\u6CA1\u6709\u5185\u8D2D\u7684\u840C\u5BA0\u4E09\u6D88",
        content: "\u300A\u840C\u5BA0\u7C89\u788E\u6D88\u300B\u662F\u4E00\u6B3E\u5FAE\u4FE1\u5C0F\u6E38\u620F\uFF1A7\xD77 \u68CB\u76D8\u6ED1\u52A8\u7EA2\u72D0\u3001\u84DD\u5154\u3001\u7EFF\u86D9\u3001\u9EC4\u9E21\u3001\u7D2B\u732B\uFF0C\u4E09\u8FDE\u6D88\u9664\uFF1B\u56DB\u8FDE/L/T \u51FA\u95EA\u5149\uFF0C\u4E94\u8FDE\u51FA\u8D85\u7EA7\u732B\u5934\u9E70\u3002\u8FC7\u5173\u81EA\u52A8\u8FDB\u9650\u65F6\u7C89\u788E\u52A0\u5206\uFF0C\u603B\u5206\u6EE1 1500 \u53EF\u9009\u6E05\u6D01\u6A21\u5F0F\uFF08\u6E05\u6D01\u4E0D\u52A0\u4E3B\u7EBF\u5206\uFF09\u3002\u5168\u7A0B\u65E0\u5185\u8D2D\uFF0C\u6CBF\u7CD6\u679C\u68AF\u5B50\u4E00\u8DEF\u95EF\u5173\u5C31\u80FD\u5F00\u73A9\u3002#\u6765\u5FAE\u4FE1\u505A\u4E2A\u5C0F\u7A0B\u5E8F",
        tags,
        recommendTitle
      };
    }
    enqueueLevelBanner(banner) {
      if (this.levelBanners.some((item) => item.kind === banner.kind)) {
        return;
      }
      this.levelBanners.push(banner);
      this.requestPaint();
    }
    showLeaderboardRewardToast() {
      const text = this.session.takeLeaderboardRewardToast();
      if (text) {
        this.notifyUser(text, "\u5468\u699C\u5956\u52B1");
      }
    }
    /** 棋盘中线的横幅：滑入 → 停留 → 滑出，队列里一条接一条。 */
    drawLevelBanner() {
      var _a;
      if (this.mode !== "playing") {
        return;
      }
      const banner = this.levelBanners[0];
      if (!banner) {
        return;
      }
      const now = this.nowMs || Date.now();
      if (banner.startMs === 0) {
        banner.startMs = now;
      }
      const frame = bannerFrame(banner, now);
      if (frame.done) {
        this.levelBanners.shift();
        return;
      }
      const { ctx, width } = this;
      const pal = bannerPalette(banner.kind);
      const board = this.session.getBoard();
      let cy = this.height * 0.45;
      if (board) {
        const layout = this.computeBoardLayout(board);
        cy = layout.originY - board.size.rows * layout.cellSize / 2;
      }
      const bandH = banner.subtitle ? 82 : 62;
      const top = cy - bandH / 2;
      ctx.save();
      ctx.globalAlpha = frame.ribbon * 0.92;
      const g = ctx.createLinearGradient(0, top, 0, top + bandH);
      g.addColorStop(0, pal.top);
      g.addColorStop(1, pal.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, top, width, bandH);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(0, top, width, 3);
      ctx.fillRect(0, top + bandH - 3, width, 3);
      const shimmer = bannerShimmerPhase(banner, now);
      if (shimmer >= 0) {
        const sx = top + shimmer * width;
        const sg = ctx.createLinearGradient(sx - 40, top, sx + 40, top + bandH);
        sg.addColorStop(0, "rgba(255,255,255,0)");
        sg.addColorStop(0.5, "rgba(255,255,255,0.45)");
        sg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(sx - 50, top, 100, bandH);
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = frame.alpha;
      ctx.translate(width / 2 + frame.offset * width, cy);
      ctx.scale(frame.scale, frame.scale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const titleSize = banner.kind === "intro" ? 34 : 30;
      const ty = banner.subtitle ? -13 : 0;
      ctx.font = `bold ${titleSize}px sans-serif`;
      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = 7;
      ctx.strokeText(banner.title, 0, ty);
      ctx.fillStyle = pal.ink;
      ctx.fillText(banner.title, 0, ty);
      if (banner.subtitle) {
        ctx.font = "bold 14px sans-serif";
        const sub = (_a = this.wrapText(banner.subtitle, width - 40)[0]) != null ? _a : banner.subtitle;
        ctx.strokeStyle = pal.edge;
        ctx.lineWidth = 4;
        ctx.strokeText(sub, 0, 22);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(sub, 0, 22);
      }
      ctx.restore();
    }
    /** 收集目标飞向 HUD；落进目标栏时让进度条跳一下。 */
    drawGoalFlyers() {
      if (this.goalFlyers.length === 0) {
        return;
      }
      if (this.mode !== "playing") {
        this.goalFlyers = [];
        return;
      }
      const now = this.nowMs || Date.now();
      const { ctx } = this;
      let landed = false;
      const keep = [];
      for (const flyer of this.goalFlyers) {
        const p = flyerPoint(flyer, now);
        if (p.done) {
          landed = true;
          continue;
        }
        keep.push(flyer);
        const img = p.started ? this.tileImages.get(flyer.kind) : void 0;
        if (!img) {
          continue;
        }
        const s = flyer.size * p.scale;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        this.drawTileSprite(img, p.x - s / 2, p.y - s / 2, s);
        ctx.restore();
      }
      this.goalFlyers = keep;
      if (landed) {
        this.hudBarPulse = Math.max(this.hudBarPulse, 260);
        this.hudScorePunch = Math.max(this.hudScorePunch, 1.06);
      }
    }
    /** 局内完成每日任务的小胶囊；结算页时挪到底部，避免压住胜利卡。 */
    drawDailyTaskPop() {
      var _a;
      const pop = this.dailyTaskPop;
      if (!pop) {
        return;
      }
      const now = this.nowMs || Date.now();
      const t = now - pop.startMs;
      if (t >= 2400) {
        this.dailyTaskPop = null;
        return;
      }
      if (this.mode === "lobby" || this.mode === "mahjong_play") {
        return;
      }
      const { ctx, width } = this;
      const alpha = t < 200 ? t / 200 : t > 2e3 ? (2400 - t) / 400 : 1;
      const drop = t < 200 ? (1 - t / 200) * -12 : 0;
      ctx.save();
      ctx.font = "bold 13px sans-serif";
      const w = Math.min(width - 24, ctx.measureText(pop.text).width + 44);
      const h = 30;
      const x = (width - w) / 2;
      const y = this.mode === "result" ? this.height - this.safeAreaBottom - h - 18 + drop : this.getHudBottom() + 28 + drop;
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#fff9db");
      g.addColorStop(1, "#ffe066");
      ctx.fillStyle = g;
      this.roundRectPath(x, y, w, h, h / 2);
      ctx.fill();
      ctx.strokeStyle = "#f59f00";
      ctx.lineWidth = 2;
      ctx.stroke();
      drawCandyStar(ctx, x + 17, y + h / 2, 8, true);
      ctx.fillStyle = "#d9480f";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText((_a = this.wrapText(pop.text, w - 38)[0]) != null ? _a : pop.text, x + 30, y + h / 2 + 0.5);
      ctx.restore();
    }
    /** 结算：星数文案 + 评星说明（与馆币 ⭐ 无关）。 */
    drawResultStarCaption(cx, starsCy, starSize) {
      const count = this.resultStars;
      if (count <= 0) {
        return;
      }
      const stars = count;
      const { ctx } = this;
      const baseY = starsCy + starSize * 1.85;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "bold 15px sans-serif";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
      ctx.lineWidth = 4;
      ctx.strokeText(starClearLabel(stars), cx, baseY);
      ctx.fillStyle = "#e67700";
      ctx.fillText(starClearLabel(stars), cx, baseY);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#868e96";
      ctx.fillText(starsHint(stars), cx, baseY + 20);
      ctx.restore();
    }
    /** 结算星星：空槽先在，金星逐颗弹进去，中间那颗更大更高。 */
    drawResultStars(cx, cy, size, now) {
      const count = this.resultStars;
      if (count <= 0) {
        return;
      }
      const { ctx } = this;
      const elapsed = now - this.resultOpenedMs;
      const gap = size * 2.25;
      for (let i = 0; i < 3; i += 1) {
        const x = cx + (i - 1) * gap;
        const y = cy + (i === 1 ? -size * 0.4 : 0);
        const r = i === 1 ? size * 1.2 : size;
        drawCandyStar(ctx, x, y, r, false);
        if (i >= count) {
          continue;
        }
        const f = starPopFrame(i, elapsed);
        if (!f.visible) {
          continue;
        }
        ctx.save();
        ctx.globalAlpha = f.alpha;
        ctx.translate(x, y);
        ctx.scale(f.scale, f.scale);
        drawCandyStar(ctx, 0, 0, r, true);
        ctx.restore();
      }
    }
    /** 关卡条内横向三星（空槽 + 金星，居中一行）。 */
    drawLobbyBarStarRow(leftX, cy, r, earned) {
      const { ctx } = this;
      const gap = r * 2.08;
      for (let i = 0; i < 3; i += 1) {
        const x = leftX + i * gap;
        const y = cy + (i === 1 ? -r * 0.12 : 0);
        const filled = i < earned;
        ctx.save();
        if (filled) {
          ctx.shadowColor = "rgba(255, 212, 59, 0.85)";
          ctx.shadowBlur = r * 0.55;
        }
        drawCandyStar(ctx, x, y, r, filled);
        ctx.restore();
      }
      return gap * 2 + r * 0.5;
    }
    /** 6–20 进关/重试/下一关：艺术字「难度提升」。 */
    applyLevelEntryTip(levelId) {
      var _a, _b;
      this.levelBanners = [];
      this.goalFlyers = [];
      this.lowMovesWarned = false;
      this.dailyTaskPop = null;
      const level = this.session.getLevelConfig();
      const goalText = formatHudGoals((_b = (_a = this.session.getGoals()) == null ? void 0 : _a.getSnapshots()) != null ? _b : []).text;
      const intro = makeLevelBanner(
        "intro",
        `\u7B2C ${levelId} \u5173`,
        [goalText, level ? `${level.moves} \u6B65` : ""].filter(Boolean).join(" \xB7 ")
      );
      this.enqueueLevelBanner(intro);
      const procedural = level == null ? void 0 : level.procedural;
      const art = levelDifficultyArt(levelId, procedural);
      if (art) {
        this.statusText = "";
        this.difficultyArt = {
          title: art.title,
          subtitle: art.subtitle,
          startMs: (this.nowMs || Date.now()) + intro.durationMs,
          durationMs: 2800
        };
        this.requestPaint();
        return;
      }
      this.statusText = "";
      this.difficultyArt = null;
    }
    /** 进关艺术字：描边糖果色主标题 + 章节副标，弹入后淡出。 */
    drawDifficultyArtTip() {
      const tip = this.difficultyArt;
      if (!tip || this.mode !== "playing") {
        return;
      }
      const now = this.nowMs || Date.now();
      const elapsed = now - tip.startMs;
      if (elapsed < 0) {
        return;
      }
      if (elapsed >= tip.durationMs) {
        this.difficultyArt = null;
        return;
      }
      const t = elapsed / tip.durationMs;
      let scale = 1;
      let alpha = 1;
      let lift = 0;
      if (t < 0.18) {
        const u = t / 0.18;
        const bounce = Math.sin(u * Math.PI);
        scale = 0.55 + 0.55 * bounce + 0.12 * Math.sin(u * Math.PI * 2);
        alpha = Math.min(1, u * 1.4);
      } else if (t > 0.72) {
        const u = (t - 0.72) / 0.28;
        alpha = 1 - u * u;
        lift = -18 * u;
        scale = 1 + 0.06 * u;
      } else {
        scale = 1 + 0.03 * Math.sin((now - tip.startMs) * 8e-3);
      }
      const { ctx, width } = this;
      const cx = width / 2;
      const cy = this.getHudBottom() + 52 + lift;
      const titleSize = Math.max(34, Math.min(44, Math.round(width * 0.11)));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, titleSize * 2.2);
      glow.addColorStop(0, "rgba(255, 200, 120, 0.45)");
      glow.addColorStop(0.55, "rgba(255, 140, 160, 0.18)");
      glow.addColorStop(1, "rgba(255, 140, 160, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, tip.subtitle ? -6 : 0, titleSize * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `bold ${titleSize}px sans-serif`;
      ctx.shadowColor = "rgba(180, 60, 40, 0.35)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.strokeStyle = "rgba(120, 40, 30, 0.88)";
      ctx.lineWidth = Math.max(8, Math.round(titleSize * 0.22));
      ctx.strokeText(tip.title, 0, tip.subtitle ? -10 : 0);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "rgba(255, 252, 245, 0.98)";
      ctx.lineWidth = Math.max(5, Math.round(titleSize * 0.12));
      ctx.strokeText(tip.title, 0, tip.subtitle ? -10 : 0);
      const grad = ctx.createLinearGradient(0, -titleSize * 0.55, 0, titleSize * 0.55);
      grad.addColorStop(0, "#ffe066");
      grad.addColorStop(0.45, "#ff922b");
      grad.addColorStop(1, "#ff6b6b");
      ctx.fillStyle = grad;
      ctx.fillText(tip.title, 0, tip.subtitle ? -10 : 0);
      if (tip.subtitle) {
        const subSize = Math.max(13, Math.min(16, Math.round(titleSize * 0.38)));
        ctx.font = `bold ${subSize}px sans-serif`;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 3.5;
        ctx.strokeText(tip.subtitle, 0, titleSize * 0.42);
        ctx.fillStyle = "#c2255c";
        ctx.fillText(tip.subtitle, 0, titleSize * 0.42);
      }
      const sparkleT = (now - tip.startMs) * 0.01;
      for (const side of [-1, 1]) {
        const sx = side * (titleSize * 1.55 + Math.sin(sparkleT + side) * 3);
        const sy = -8 + Math.cos(sparkleT * 1.3 + side) * 4;
        const sr = 3.2 + Math.sin(sparkleT * 2 + side) * 0.8;
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const a = i / 4 * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? sr : sr * 0.4;
          const px = sx + Math.cos(a) * r;
          const py = sy + Math.sin(a) * r;
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    async enterLevel(levelId) {
      this.leavingLobby = true;
      this.clearLaunchInterstitialTimer();
      this.interceptLobbyBanner();
      try {
        await this.session.startLevel(levelId);
      } catch (err) {
        this.leavingLobby = false;
        this.mode = "lobby";
        this.syncLobbyBanner();
        throw err;
      }
      this.mode = "playing";
      this.buriedFx.clear();
      this.interceptLobbyBanner();
      this.applyLevelEntryTip(levelId);
      this.pendingResult = null;
      this.offerCleanPrompt = false;
      this.hammerTargeting = false;
      this.hammerCursor = null;
      this.resultFx.stop();
      this.crushBursts = [];
      this.floatingScores = [];
      this.crushSparks = [];
      this.closeOverlay();
      this.boardView.bindInput((a, b, c, d) => {
        this.session.trySwap(a, b, c, d);
      });
      this.syncBoardView();
      this.syncLobbyBanner();
      this.tryStartBgm();
    }
    hitButton(x, y) {
      var _a, _b;
      if (this.mode === "lobby" && this.overlay === "none") {
        const side = this.hitLobbySideAction(x, y);
        if (side) {
          return side;
        }
      }
      if (this.mode === "lobby" && this.overlay === "none") {
        const mahjongHall = this.buttons.find((b) => b.id === "mahjong_hall");
        if (mahjongHall) {
          const pad = (_a = mahjongHall.hitPad) != null ? _a : 0;
          if (x >= mahjongHall.x - pad && x <= mahjongHall.x + mahjongHall.w + pad && y >= mahjongHall.y - pad && y <= mahjongHall.y + mahjongHall.h + pad) {
            return mahjongHall;
          }
        }
      }
      if (this.mode === "lobby" && this.overlay === "none") {
        let best = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const btn of this.buttons) {
          if (btn.id !== "level") {
            continue;
          }
          if (x < btn.x || x > btn.x + btn.w || y < btn.y || y > btn.y + btn.h) {
            continue;
          }
          const cx = btn.x + btn.w / 2;
          const cy = btn.y + btn.h / 2;
          const dist = Math.hypot(x - cx, y - cy);
          if (dist < bestDist) {
            best = btn;
            bestDist = dist;
          }
        }
        if (best) {
          return best;
        }
      }
      for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
        const btn = this.buttons[i];
        if (btn.id === "level") {
          continue;
        }
        const pad = (_b = btn.hitPad) != null ? _b : 0;
        if (x >= btn.x - pad && x <= btn.x + btn.w + pad && y >= btn.y - pad && y <= btn.y + btn.h + pad) {
          return btn;
        }
      }
      return null;
    }
    hitLobbySideAction(x, y) {
      var _a;
      for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
        const btn = this.buttons[i];
        if (btn.id !== "invite" && btn.id !== "howto" && btn.id !== "settings" && btn.id !== "daily_open" && btn.id !== "recommend" && btn.id !== "club") {
          continue;
        }
        const pad = (_a = btn.hitPad) != null ? _a : 0;
        if (x >= btn.x - pad && x <= btn.x + btn.w + pad && y >= btn.y - pad && y <= btn.y + btn.h + pad) {
          return btn;
        }
      }
      return null;
    }
    draw() {
      var _a, _b, _c, _d;
      const { ctx } = this;
      this.buttons.length = 0;
      try {
        ctx.fillStyle = this.mode === "lobby" ? "#a7f0d4" : "#b6e8fc";
        ctx.fillRect(0, 0, this.width, this.height);
      } catch (e) {
      }
      try {
        if (this.mode !== "mahjong_play") {
          const bgMode = this.mode === "lobby" ? "lobby" : "level";
          const levelHue = bgMode === "level" ? (_b = (_a = this.session.getLevelConfig()) == null ? void 0 : _a.procedural) == null ? void 0 : _b.hue : void 0;
          this.sceneBg.draw(
            ctx,
            {
              lobby: this.bgLobby,
              level: this.bgLevel
            },
            bgMode,
            this.nowMs || Date.now(),
            bgMode === "lobby" ? this.lobbyCamY : 0,
            levelHue
          );
        }
        if (this.mode === "lobby") {
          this.drawLobby();
          this.drawNavChips();
          this.drawLobbySideActions();
          this.drawPageOverlay();
          return;
        }
        if (this.mode === "mahjong_play") {
          let game = this.session.mahjong.getActiveGame();
          if (!game && !this.mahjongDrawRecoverAttempted) {
            this.mahjongDrawRecoverAttempted = true;
            const recoverLevel = this.session.mahjong.resolveEntryLevel();
            if (this.session.mahjong.canFreeEnterMahjongLevel(recoverLevel)) {
              try {
                this.session.mahjong.enterFromHall();
              } catch (e) {
              }
            }
            game = this.session.mahjong.getActiveGame();
          }
          if (!game) {
            this.mode = "lobby";
            this.requestPaint();
            return;
          }
          if (game.phase !== "playing") {
            this.mahjongToolOffer = null;
          }
          if (!isMahjongTileShellReady() && this.mahjongShellLoadAttempts < 12) {
            void this.ensureMahjongTileShellPackLoaded().then(() => this.requestPaint());
          }
          const chrome = this.buildMahjongPlayChrome(game);
          const now = this.nowMs || Date.now();
          ctx.save();
          if (this.shakeMs > 0) {
            const mag = Math.min(5, this.shakeMs / 24);
            ctx.translate(
              Math.sin(now * 0.09) * mag,
              Math.cos(now * 0.075) * mag
            );
          }
          drawMahjongPlay(
            ctx,
            this.width,
            this.height,
            game,
            this.session.getLadderCoinsAvailable(),
            this.mahjongTileHits,
            this.mahjongButtons,
            chrome,
            this.mahjongSlotFlight,
            now
          );
          drawMahjongSlotClearRings(ctx, this.mahjongSlotClearRings, now);
          this.drawMatchJuiceOverlays();
          if (this.mahjongStageBanner) {
            drawMahjongLevelStageBanner(
              ctx,
              this.width,
              this.height,
              this.mahjongStageBanner,
              now
            );
          }
          ctx.restore();
          if (this.mahjongToolOffer && game.phase === "playing") {
            drawMahjongToolOfferModal(
              ctx,
              this.width,
              this.height,
              this.mahjongToolOffer,
              this.mahjongButtons,
              chrome,
              mahjongCoinCost()
            );
          }
          const showMahjongResult = (game.phase === "won" || game.phase === "lost") && !this.shouldDeferMahjongResultModal(game);
          if (showMahjongResult) {
            const revealStart = game.phase === "lost" ? this.mahjongResultRevealStartMs : 0;
            drawMahjongResult(
              ctx,
              this.width,
              this.height,
              game,
              this.mahjongButtons,
              game.phase === "won" ? (_c = chrome.autoNextMs) != null ? _c : 0 : 0,
              this.mahjongSlotFullOfferDismissed,
              this.nowMs || Date.now(),
              this.winCelebrate,
              chrome,
              revealStart
            );
          }
          return;
        }
        this.drawHud();
        if (this.mode === "playing" || this.mode === "result" || this.mode === "crush" || this.mode === "clean") {
          ctx.save();
          if (this.shakeMs > 0 && (this.mode === "playing" || this.mode === "crush" || this.mode === "clean" || this.mode === "result")) {
            const mag = this.mode === "result" ? Math.min(10, this.shakeMs / 16) : Math.min(7, this.shakeMs / 18);
            ctx.translate(
              Math.sin(this.nowMs * 0.08) * mag,
              Math.cos(this.nowMs * 0.11) * mag
            );
          }
          this.drawBoard();
          if (this.mode === "crush" || this.mode === "clean") {
            this.drawCrushOverlays();
            this.drawCrushGuide();
          } else if (this.mode === "playing") {
            this.drawMatchJuiceOverlays();
          }
          ctx.restore();
        }
        if (this.mode === "crush") {
          this.drawCrushChrome();
        }
        if (this.mode === "clean") {
          this.drawCleanChrome();
        }
        if (this.mode === "playing") {
          this.drawBoosterBar();
          this.drawGoalFlyers();
        }
        this.drawActionToast();
        this.drawDifficultyArtTip();
        this.drawLevelBanner();
        if (this.hammerTargeting) {
          this.drawHammerCursor();
        }
        if (this.mode === "result") {
          this.drawResultOverlay();
        }
        this.drawDailyTaskPop();
        this.drawNavChips();
        this.drawPageOverlay();
      } catch (err) {
        this.logThrottledDrawError("[crush-crush] draw failed", err);
        try {
          ctx.fillStyle = this.mode === "lobby" ? "#a7f0d4" : "#b6e8fc";
          ctx.fillRect(0, 0, this.width, this.height);
        } catch (e) {
        }
      } finally {
        try {
          (_d = this.canvasPresent) == null ? void 0 : _d.call(this);
        } catch (presentErr) {
          console.warn("[crush-crush] canvas present failed", presentErr);
        }
      }
    }
    /** 锤子瞄准时绘制跟随指针的锤子光标 */
    drawHammerCursor() {
      var _a;
      const { ctx } = this;
      const pos = (_a = this.hammerCursor) != null ? _a : { x: this.width / 2, y: this.height * 0.45 };
      const img = this.uiIcons.get("hammer");
      const size = 56;
      const x = pos.x - size * 0.25;
      const y = pos.y - size * 0.75;
      ctx.save();
      ctx.globalAlpha = 0.95;
      if (img) {
        ctx.drawImage(img, x, y, size, size);
      } else {
        ctx.fillStyle = "#ff6b6b";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u9524", pos.x, pos.y);
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(250, 82, 82, 0.85)";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    /**
     * 首页大厅：关卡列表夹在标题与底栏提示之间；云朵盖在糖果条之上。
     */
    drawLobby() {
      const { height } = this;
      const now = this.nowMs || Date.now();
      const nodes = this.getLobbyLevelNodes();
      const currentId = this.resolveEntryLevelId();
      const page = lobbyPageIndex(this.lobbyCamY, height);
      const maxPage = lobbyMaxPageIndex(this.session.getLevelCount());
      const hideBelowY = this.lobbyContentTop();
      const { bandTop: hideAboveY } = this.getLobbyLadderLayout();
      const drawNodes = nodes.filter(
        (node) => isLobbyNodeOnScreen(node, height) && isLobbyNodeExposed(node, this.lobbyCamY, height, hideBelowY, hideAboveY)
      ).sort((a, b) => a.levelId - b.levelId);
      this.drawLobbyLadderTrail(drawNodes, height);
      for (const node of drawNodes) {
        const unlocked = this.session.isLevelUnlocked(node.levelId);
        const cleared = this.session.isLevelCleared(node.levelId);
        const isCurrent = unlocked && node.levelId === currentId && !cleared;
        const hit = lobbyLevelHitRect(node);
        this.buttons.push({
          id: "level",
          levelId: node.levelId,
          x: hit.x,
          y: hit.y,
          w: hit.w,
          h: hit.h,
          label: String(node.levelId)
        });
        this.drawLobbyLevelBar(node, unlocked, cleared, isCurrent, now);
      }
      this.drawLobbyCloudDecors(drawNodes, height);
      this.drawLobbyBrandCopy();
      this.drawLobbySwipeHint(page, maxPage, now);
      this.drawLobbyPageDots(page, maxPage);
      this.drawPostClearAnnouncementBar();
      this.pushClearAnnouncementButton();
      this.drawLobbyStatusCaption();
      this.drawLobbyNoticeBubble(now);
      if (this.mahjongEntryGateLevel != null) {
        drawMahjongLadderCoinGateModal(
          this.ctx,
          this.width,
          this.height,
          this.session.getLadderCoinsAvailable(),
          MAHJONG_REPLAY_COIN_COST,
          this.mahjongGateButtons,
          now
        );
      }
    }
    async handleMahjongGateUi(id) {
      this.session.playUiSfx();
      if (id === "mahjong_gate_close") {
        this.mahjongEntryGateLevel = null;
        this.requestPaint();
        return;
      }
      if (id === "mahjong_gate_ladder") {
        this.mahjongEntryGateLevel = null;
        this.notifyUser("\u9986\u9986\u91D1\u5E01\u5728\u7CD6\u679C\u68AF\u5B50\u8D5A\uFF1A100 \u5206 = 1 \u91D1\u5E01", "\u53BB\u95EF\u5173\u5427");
        this.requestPaint();
        return;
      }
      if (id === "mahjong_gate_ad") {
        await this.runMahjongAdReplayRestart(true);
        return;
      }
      if (id === "mahjong_gate_coin") {
        if (!this.session.mahjong.payReplay()) {
          this.notifyUser("\u5FEB\u53BB\u7CD6\u679C\u68AF\u5B50\u95EF\u5173\u8D5A\u91D1\u5E01\u5427", "\u5FEB\u53BB\u7CD6\u679C\u68AF\u5B50\u95EF\u5173\u8D5A\u91D1\u5E01\u5427");
          this.requestPaint();
          return;
        }
        this.mahjongEntryGateLevel = null;
        this.leavingLobby = true;
        const level = this.session.mahjong.resolveEntryLevel();
        this.resetMahjongSlotAnimations();
        await this.session.mahjong.restartLevel(level);
        await this.openMahjongPlayWhenReady();
        this.requestPaint();
      }
    }
    /** 首页公告冷色泡泡：左下↔右上乒乓循环，文案轮播，点一下打开公告。 */
    drawLobbyNoticeBubble(nowMs) {
      var _a, _b;
      if (this.overlay !== "none" || this.lobbyCamY > this.height * 0.18) {
        return;
      }
      const notice = lobbyNoticeForMahjongState(this.session.isMahjongHallUnlocked());
      const lines = lobbyNoticeBubbleLines({
        body: notice.body,
        bubbles: notice.bubbles
      });
      if (lines.length === 0) {
        return;
      }
      const cycle = lobbyNoticeBubbleCycle(nowMs, lines.length);
      const drift = lobbyNoticeBubbleDrift(nowMs);
      const primary = (_a = lines[cycle.index]) != null ? _a : lines[0];
      const secondary = cycle.nextOpacity > 0.02 ? (_b = lines[cycle.nextIndex]) != null ? _b : "" : "";
      const { ctx } = this;
      ctx.save();
      ctx.font = "bold 12px sans-serif";
      const frame = layoutLobbyNoticeBubble({
        width: this.width,
        height: this.height,
        statusBarHeight: this.statusBarHeight,
        contentTop: this.lobbyContentTop(),
        progress: drift.progress,
        text: primary.length >= secondary.length ? primary : secondary,
        measureWidth: (text) => ctx.measureText(text).width
      });
      const bob = Math.sin(nowMs / 680) * this.fxAmt(2.2, 1);
      const x = frame.x;
      const y = frame.y + bob;
      const { w, h } = frame;
      const alpha = drift.opacity;
      ctx.globalAlpha = 0.18 * alpha;
      ctx.fillStyle = "#1c4b7a";
      this.roundRectPath(x + 1, y + 3, w, h, h / 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      const fill2 = ctx.createLinearGradient(x, y, x, y + h);
      fill2.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      fill2.addColorStop(0.4, "rgba(232, 248, 255, 0.97)");
      fill2.addColorStop(1, "rgba(208, 235, 255, 0.96)");
      ctx.fillStyle = fill2;
      this.roundRectPath(x, y, w, h, h / 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.4;
      this.roundRectPath(x + 0.5, y + 0.5, w - 1, h - 1, h / 2 - 0.5);
      ctx.stroke();
      ctx.strokeStyle = "rgba(116, 192, 252, 0.55)";
      ctx.lineWidth = 1;
      this.roundRectPath(x - 0.5, y - 0.5, w + 1, h + 1, h / 2 + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 0.5 * alpha;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      this.roundRectPath(x + 8, y + 3, w - 16, h * 0.34, h * 0.2);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 12px sans-serif";
      const ink = "#1864ab";
      if (cycle.opacity > 0.02) {
        ctx.globalAlpha = cycle.opacity * alpha;
        ctx.fillStyle = ink;
        ctx.fillText(primary, x + w / 2, y + h / 2 + 0.5);
      }
      if (secondary && cycle.nextOpacity > 0.02) {
        ctx.globalAlpha = cycle.nextOpacity * alpha;
        ctx.fillStyle = ink;
        ctx.fillText(secondary, x + w / 2, y + h / 2 + 0.5);
      }
      ctx.restore();
      this.buttons.push({
        id: "notice",
        x,
        y,
        w,
        h,
        label: "",
        hitPad: 4
      });
    }
    /** 关卡列表左右两侧糖点轨，连接编号糖果（对齐设计稿）。 */
    drawLobbyLadderTrail(nodes, height) {
      const pts = lobbyLadderSideTrailPoints(nodes, height);
      if (pts.length === 0) {
        return;
      }
      const { ctx } = this;
      ctx.save();
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.tone === "cream" ? "rgba(255,236,153,0.86)" : "rgba(255,255,255,0.92)";
        ctx.fill();
        if (p.r >= 3.6) {
          ctx.beginPath();
          ctx.arc(p.x - p.r * 0.22, p.y - p.r * 0.28, p.r * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fill();
        }
      }
      ctx.restore();
    }
    drawLobbyCloudDecors(nodes, height) {
      const pts = lobbyCloudDecorPoints(nodes, height);
      const cloudBig = this.uiIcons.get("ladder-cloud");
      const cloudSm = this.uiIcons.get("ladder-cloudSm");
      const { ctx } = this;
      for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i];
        const cloud = i % 2 === 0 ? cloudBig != null ? cloudBig : cloudSm : cloudSm != null ? cloudSm : cloudBig;
        const drawW = Math.max(38, Math.min(68, p.circleR * 2.15));
        if (cloud && (cloud.width || 0) > 0 && (cloud.height || 0) > 0) {
          const iw = cloud.width || drawW;
          const ih = cloud.height || drawW;
          const drawH = drawW * (ih / Math.max(1, iw));
          const x = p.x;
          const y = p.y;
          ctx.save();
          ctx.globalAlpha = 0.98;
          ctx.drawImage(cloud, x - drawW / 2, y - drawH / 2, drawW, drawH);
          ctx.restore();
        } else {
          const r = drawW * 0.28;
          const x = p.x;
          const y = p.y;
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.96)";
          ctx.beginPath();
          ctx.arc(x, y - r * 0.1, r, 0, Math.PI * 2);
          ctx.arc(x - r * 0.85, y + r * 0.25, r * 0.78, 0, Math.PI * 2);
          ctx.arc(x + r * 0.85, y + r * 0.25, r * 0.78, 0, Math.PI * 2);
          ctx.arc(x - r * 0.3, y - r * 0.55, r * 0.65, 0, Math.PI * 2);
          ctx.arc(x + r * 0.3, y - r * 0.55, r * 0.65, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    /** 设计稿胶囊关卡条：已通关 / 当前 / 锁定。 */
    drawLobbyLevelBar(node, unlocked, cleared, isCurrent, nowMs) {
      const state = !unlocked ? "locked" : isCurrent ? "current" : cleared ? "cleared" : "locked";
      const theme = ladderThemeForLevel(node.levelId, state);
      const { ctx } = this;
      const { barX, barY, barW, barH, circleR, x: cx, y: cy } = node;
      const r = barH / 2;
      ctx.save();
      ctx.shadowColor = "rgba(80, 120, 130, 0.22)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      this.roundRectPath(barX, barY, barW, barH, r);
      const barGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      barGrad.addColorStop(0, theme.barTop);
      barGrad.addColorStop(1, theme.barBottom);
      ctx.fillStyle = barGrad;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.stroke();
      if (theme.pattern === "stripe") {
        this.drawLobbyBarStripes(barX, barY, barW, barH, r, theme.stripe);
      } else if (theme.pattern === "sprinkle") {
        this.drawLobbyBarSprinkles(barX, barY, barW, barH, node.levelId);
      }
      ctx.shadowColor = "rgba(60, 90, 110, 0.28)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
      const cg = ctx.createLinearGradient(cx, cy - circleR, cx, cy + circleR);
      cg.addColorStop(0, theme.circleTop);
      cg.addColorStop(1, theme.circleBottom);
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = Math.max(3, circleR * 0.12);
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      if (state === "locked") {
        const lock = this.uiIcons.get("ladder-lock");
        const s = circleR * 1.1;
        if (lock && (lock.width || 0) > 0) {
          ctx.drawImage(lock, cx - s / 2, cy - s / 2, s, s);
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.round(circleR * 0.9)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("\u9501", cx, cy + 1);
        }
      } else {
        ctx.font = `bold ${Math.round(circleR * 1.05)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(3, Math.round(circleR * 0.14));
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.fillStyle = "#ffffff";
        const label = String(node.levelId);
        ctx.strokeText(label, cx, cy + 1);
        ctx.fillText(label, cx, cy + 1);
      }
      if (cleared && unlocked) {
        const check = this.uiIcons.get("ladder-check");
        const badge = circleR * 0.72;
        const bx = cx + circleR * 0.62;
        const by = cy - circleR * 0.62;
        if (check && (check.width || 0) > 0) {
          ctx.drawImage(check, bx - badge / 2, by - badge / 2, badge, badge);
        } else {
          this.drawLobbyMacaronCheck(bx, by, badge * 0.55);
        }
      }
      if (isCurrent) {
        if ("startTop" in theme) {
          this.drawLobbyStartChip(node, theme.startTop, theme.startBottom);
        }
      } else if (cleared && unlocked) {
        const stars = Math.min(3, Math.max(1, this.session.getLevelStars(node.levelId)));
        const score = this.session.getBestScore(node.levelId);
        this.drawLobbyClearedBarMeta(node, stars, score);
      }
      ctx.restore();
    }
    drawLobbyBarStripes(x, y, w, h, r, color) {
      const { ctx } = this;
      ctx.save();
      this.roundRectPath(x, y, w, h, r);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(6, h * 0.14);
      ctx.lineCap = "butt";
      for (let i = -2; i < 14; i += 1) {
        const sx = x + i * h * 0.55;
        ctx.beginPath();
        ctx.moveTo(sx, y + h + 4);
        ctx.lineTo(sx + h * 1.15, y - 4);
        ctx.stroke();
      }
      ctx.restore();
    }
    drawLobbyBarSprinkles(x, y, w, h, seed) {
      const { ctx } = this;
      ctx.save();
      this.roundRectPath(x, y, w, h, h / 2);
      ctx.clip();
      const colors = ["#ff8fab", "#ffe066", "#ffffff", "#74c0fc"];
      for (let i = 0; i < 14; i += 1) {
        const px = x + (seed * 37 + i * 53) % 97 / 97 * w;
        const py = y + (seed * 19 + i * 29) % 71 / 71 * h;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    drawLobbyStartChip(node, top, bottom) {
      const { ctx } = this;
      const chipW = Math.min(92, node.barW * 0.28);
      const chipH = Math.min(34, node.barH * 0.55);
      const chipX = node.circleSide === "left" ? node.barX + node.barW - chipW - 16 : node.barX + 16;
      const chipY = node.y - chipH / 2;
      const g = ctx.createLinearGradient(chipX, chipY, chipX, chipY + chipH);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      ctx.save();
      ctx.shadowColor = "rgba(180, 60, 40, 0.35)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      this.roundRectPath(chipX, chipY, chipW, chipH, chipH / 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.stroke();
      ctx.font = `bold ${Math.round(chipH * 0.55)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("\u5F00\u59CB", chipX + chipW / 2, chipY + chipH / 2 + 1);
      ctx.restore();
    }
    /** 已通关条：白底胶囊内「三星 + 最高分 + 馆币」，与彩色条拉开对比。 */
    drawLobbyClearedBarMeta(node, stars, score) {
      const { ctx } = this;
      const { barX, barW, barH, circleR, circleSide } = node;
      const cy = node.y;
      const starR = Math.max(8, barH * 0.24);
      const scoreText = `${Math.max(0, Math.floor(score))}\u5206`;
      const coinText = formatLadderCoinChip(this.session.getLadderCoinsForLevel(node.levelId));
      let fontSize = Math.max(13, Math.round(barH * 0.38));
      const coinPadX = 6;
      const coinGap = 6;
      ctx.save();
      ctx.font = `bold ${fontSize}px sans-serif`;
      const starsBlockW = starR * 2.08 * 2 + starR;
      const textGap = 8;
      const measureTextBlock = () => {
        const scoreW2 = ctx.measureText(scoreText).width;
        const coinInner = ctx.measureText(coinText).width + coinPadX * 2;
        return scoreW2 + coinGap + coinInner;
      };
      let textBlockW = measureTextBlock();
      const pad = 10;
      let chipH = Math.min(barH - 3, Math.max(30, barH * 0.92));
      let chipW = pad * 2 + starsBlockW + textGap + textBlockW;
      const circleReserve = circleSide === "left" ? circleR * 2 + 12 : circleR * 2 + 8;
      const maxW = Math.max(40, barW - circleReserve - 10);
      while (chipW > maxW && fontSize > 10) {
        fontSize -= 1;
        ctx.font = `bold ${fontSize}px sans-serif`;
        textBlockW = measureTextBlock();
        chipW = pad * 2 + starsBlockW + textGap + textBlockW;
      }
      let chipX = circleSide === "left" ? barX + circleR * 2 + 10 : barX + 12;
      chipX = Math.min(chipX, barX + barW - chipW - 6);
      chipX = Math.max(chipX, barX + 6);
      const chipY = cy - chipH / 2;
      ctx.shadowColor = "rgba(40, 60, 80, 0.28)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      this.roundRectPath(chipX, chipY, chipW, chipH, chipH / 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 212, 59, 0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
      const starLeft = chipX + pad + starR;
      this.drawLobbyBarStarRow(starLeft, cy, starR, stars);
      const textX = chipX + pad + starsBlockW + textGap;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = "#495057";
      ctx.fillText(scoreText, textX, cy + 0.5);
      const scoreW = ctx.measureText(scoreText).width;
      ctx.font = `bold ${fontSize}px sans-serif`;
      const coinW = ctx.measureText(coinText).width;
      const coinPadY = 3;
      const coinBoxX = textX + scoreW + coinGap;
      const coinBoxW = coinW + coinPadX * 2;
      const coinBoxH = chipH - coinPadY * 2;
      const coinBoxY = chipY + coinPadY;
      const cg = ctx.createLinearGradient(coinBoxX, coinBoxY, coinBoxX, coinBoxY + coinBoxH);
      cg.addColorStop(0, "#fff3bf");
      cg.addColorStop(1, "#ffd43b");
      this.roundRectPath(coinBoxX, coinBoxY, coinBoxW, coinBoxH, coinBoxH / 2);
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = "#f59f00";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#d9480f";
      ctx.textAlign = "center";
      ctx.fillText(coinText, coinBoxX + coinBoxW / 2, cy + 0.5);
      ctx.restore();
    }
    lobbyContentTop() {
      return layoutLobbyBottom({
        width: this.width,
        height: this.height,
        bannerReserve: this.mode === "lobby" ? this.session.getLobbyBannerReservePx() : 0,
        safeBottom: this.safeAreaBottom,
        dailyClaimable: this.session.getDailyTasksView().claimable
      }).contentTop;
    }
    /** 未解锁等提示画在树干标语处。树屏的文案由 drawLobbyTreePrompt 盖住底图。 */
    drawLobbyStatusCaption() {
      if (!this.statusText || lobbyPageIndex(this.lobbyCamY, this.height) === 0) {
        return;
      }
      const { ctx, width } = this;
      const y = lobbyCaptionY(
        this.getLobbyCoverRect(),
        this.lobbyCamY,
        this.height,
        lobbyPageIndex(this.lobbyCamY, this.height)
      );
      ctx.save();
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.96)";
      ctx.lineWidth = 8;
      ctx.strokeText(this.statusText, width / 2, y);
      ctx.fillStyle = "#c2255c";
      ctx.fillText(this.statusText, width / 2, y);
      ctx.restore();
    }
    /** 与树上底图马卡龙同一视觉半径。 */
    lobbyMacaronVisualR(node) {
      return node.hitR;
    }
    /** 未解锁：霜住内馅，锁放到下方。 */
    drawLobbyMacaronLocked(x, y, r) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(x, y);
      const innerR = r * 0.72;
      ctx.beginPath();
      ctx.arc(0, r * 0.02, innerR, 0, Math.PI * 2);
      ctx.clip();
      const frost = ctx.createLinearGradient(0, -innerR, 0, innerR);
      frost.addColorStop(0, "rgba(255, 255, 255, 0.18)");
      frost.addColorStop(0.45, "rgba(236, 228, 255, 0.34)");
      frost.addColorStop(1, "rgba(255, 255, 255, 0.5)");
      ctx.fillStyle = frost;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      const plateW = r * 0.92;
      const plateH = r * 0.36;
      const plateY = r * 0.28;
      ctx.fillStyle = "rgba(255, 252, 248, 0.92)";
      this.roundRectPath(-plateW / 2, plateY, plateW, plateH, plateH / 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.2;
      this.roundRectPath(-plateW / 2, plateY, plateW, plateH, plateH / 2);
      ctx.stroke();
      const cx = 0;
      const cy = plateY + plateH / 2 + r * 0.02;
      const bodyW = r * 0.22;
      const bodyH = r * 0.16;
      const shackleR = r * 0.09;
      ctx.strokeStyle = "#7b6aa6";
      ctx.lineWidth = Math.max(1.8, r * 0.055);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy - bodyH * 0.42, shackleR, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "#8f7bb8";
      this.roundRectPath(cx - bodyW / 2, cy - bodyH * 0.18, bodyW, bodyH, r * 0.045);
      ctx.fill();
      ctx.fillStyle = "#fff8ff";
      ctx.beginPath();
      ctx.arc(cx, cy + bodyH * 0.02, r * 0.028, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    /** 已通关勾：贴在右上角壳边。 */
    drawLobbyMacaronCheck(x, y, r) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(x, y);
      const badge = Math.max(6.5, Math.min(9, r * 0.17));
      const bx = r * 0.62;
      const by = -r * 0.58;
      ctx.fillStyle = "#51cf66";
      ctx.beginPath();
      ctx.arc(bx, by, badge, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.4, badge * 0.16);
      ctx.stroke();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1.8, badge * 0.26);
      ctx.beginPath();
      ctx.moveTo(bx - badge * 0.4, by + badge * 0.02);
      ctx.lineTo(bx - badge * 0.06, by + badge * 0.36);
      ctx.lineTo(bx + badge * 0.44, by - badge * 0.34);
      ctx.stroke();
      ctx.restore();
    }
    /** 该关最高分：单独一层画在马卡龙内馅上，分数变化后下一帧重绘。 */
    drawLobbyMacaronScore(x, y, r, bestScore, slotIndex) {
      const { ctx } = this;
      const text = String(Math.max(0, Math.floor(bestScore)));
      const stroke = MACARON_NUM_STROKE[slotIndex % MACARON_NUM_STROKE.length];
      ctx.save();
      ctx.translate(x, y);
      const fontSize = Math.round(Math.max(10, r * (text.length >= 4 ? 0.16 : 0.18)));
      ctx.font = `800 ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const sy = r * 0.38;
      ctx.strokeStyle = this.shadeHex(stroke, -18);
      ctx.lineWidth = Math.max(2.6, r * 0.06);
      ctx.strokeText(text, 0, sy);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, 0, sy);
      ctx.restore();
    }
    /** 当前可挑战关：贴外壳一圈细光，不再铺径向光斑。 */
    drawLobbyMacaronActiveGlow(x, y, r, nowMs) {
      const pulse = 0.72 + Math.sin(nowMs / 380) * 0.28;
      const { ctx } = this;
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = `rgba(255,255,255,${0.45 + pulse * 0.4})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.97 + 0.02 * pulse), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    /**
     * 树上马卡龙 + 天空云朵关卡挂点。
     */
    getLobbyCoverRect() {
      const lobbyImg = this.bgLobby;
      if (lobbyImg && (lobbyImg.width || 0) > 0 && (lobbyImg.height || 0) > 0) {
        return this.sceneBg.getCoverLayout(lobbyImg, 0.5);
      }
      return { dx: 0, dy: 0, dw: this.width, dh: this.height };
    }
    getCloudCoverRect() {
      return this.getLobbyCoverRect();
    }
    getLobbyLevelNodes() {
      const cover = this.getLobbyCoverRect();
      const { ceiling, step } = this.getLobbyLadderLayout();
      return layoutLobbyLevelNodes({
        vines: this.session.listLobbyVineNodes(),
        cover,
        cloudCover: this.getCloudCoverRect(),
        width: this.width,
        height: this.height,
        camY: this.lobbyCamY,
        ladderBottomY: ceiling,
        maxCloudCenterY: ceiling,
        ladderStep: step
      });
    }
    /** 标题区～底栏留白后的带宽 → 首屏约 8 关紧凑步长（布局与相机共用）。 */
    getLobbyLadderLayout() {
      const cover = this.getLobbyCoverRect();
      const titleBandTop = lobbyLevelBandTop(cover, this.statusBarHeight);
      const { h: barH } = lobbyBarSize(this.width, this.height);
      return lobbyFirstScreenLadderLayout({
        bandTop: titleBandTop,
        contentTop: this.lobbyContentTop(),
        barH
      });
    }
    prepareLobbyCamera() {
      if (!this.lobbyCamInited) {
        this.lobbyCamY = 0;
        this.lobbyCamInited = true;
        this.lobbyCamUserHeld = false;
        this.lobbyCamAutoTarget = null;
        this.lobbyCamSnapFrom = 0;
        this.lobbyCamSnapAtMs = 0;
        this.lobbyCamVel = 0;
        this.lobbySwipeHintShownAtMs = 0;
        this.lobbySwipeHintDismissed = false;
      }
    }
    getLobbyCamRange() {
      const total = this.session.getLevelCount();
      const { step } = this.getLobbyLadderLayout();
      return { min: 0, max: lobbyCameraMax(total, this.height, step) };
    }
    beginLobbyDrag(x, y) {
      this.lobbyCamVel = 0;
      this.lobbyDrag = {
        startX: x,
        startY: y,
        lastY: y,
        lastMs: this.nowMs || Date.now(),
        camStart: this.lobbyCamY,
        moved: false,
        velY: 0
      };
    }
    moveLobbyDrag(x, y) {
      const drag = this.lobbyDrag;
      if (!drag) {
        return;
      }
      const now = this.nowMs || Date.now();
      const dist = Math.hypot(x - drag.startX, y - drag.startY);
      if (dist > 12) {
        drag.moved = true;
        this.lobbyCamUserHeld = true;
        this.lobbyCamAutoTarget = null;
        this.lobbySwipeHintDismissed = true;
      }
      if (drag.moved) {
        const range = this.getLobbyCamRange();
        this.lobbyCamY = lobbyCamFromDrag(
          drag.camStart,
          y - drag.startY,
          range.min,
          range.max
        );
        const dt = Math.max(8, now - drag.lastMs);
        drag.velY = -(y - drag.lastY) / dt;
      }
      drag.lastY = y;
      drag.lastMs = now;
    }
    /** @returns 是否已作为滑动消费（不再点选关卡） */
    endLobbyDrag() {
      const drag = this.lobbyDrag;
      this.lobbyDrag = null;
      if (!drag) {
        return false;
      }
      if (!drag.moved) {
        return false;
      }
      const range = this.getLobbyCamRange();
      this.lobbyCamUserHeld = false;
      this.lobbyCamVel = Math.max(-1.8, Math.min(1.8, drag.velY));
      this.lobbyCamSnapFrom = this.lobbyCamY;
      this.lobbyCamSnapAtMs = this.nowMs || Date.now();
      this.lobbyCamAutoTarget = lobbySnapTarget(
        drag.camStart,
        this.lobbyCamY,
        this.height,
        range.max,
        drag.velY,
        this.getLobbyLadderLayout().step
      );
      return true;
    }
    updateLobbyCamera(dt) {
      var _a;
      if (!this.lobbyCamInited) {
        this.prepareLobbyCamera();
      }
      const range = this.getLobbyCamRange();
      if ((_a = this.lobbyDrag) == null ? void 0 : _a.moved) {
        return;
      }
      if (this.lobbyCamAutoTarget !== null && !this.lobbyCamUserHeld) {
        const target = this.lobbyCamAutoTarget;
        const elapsed = (this.nowMs || Date.now()) - this.lobbyCamSnapAtMs;
        this.lobbyCamY = lobbySnapCamY(this.lobbyCamSnapFrom, target, elapsed);
        this.lobbyCamVel = 0;
        if (elapsed >= LOBBY_SNAP_MS) {
          this.lobbyCamY = target;
          this.lobbyCamAutoTarget = null;
        }
        const kSpring2 = 1 - Math.exp(-dt / 70);
        if (this.lobbyCamY < range.min) {
          this.lobbyCamY += (range.min - this.lobbyCamY) * kSpring2;
        } else if (this.lobbyCamY > range.max) {
          this.lobbyCamY += (range.max - this.lobbyCamY) * kSpring2;
        }
        return;
      }
      if (Math.abs(this.lobbyCamVel) > 0.02) {
        this.lobbyCamY += this.lobbyCamVel * dt;
        this.lobbyCamVel *= Math.exp(-dt / 180);
      } else {
        this.lobbyCamVel = 0;
      }
      const kSpring = 1 - Math.exp(-dt / 70);
      if (this.lobbyCamY < range.min) {
        this.lobbyCamY += (range.min - this.lobbyCamY) * kSpring;
        this.lobbyCamVel *= 0.4;
      } else if (this.lobbyCamY > range.max) {
        this.lobbyCamY += (range.max - this.lobbyCamY) * kSpring;
        this.lobbyCamVel *= 0.4;
      }
    }
    /** 品牌主标题 + 副标题 +「20关后…」：固定在关卡列表上方，上滑不换样式。 */
    drawLobbyBrandCopy() {
      const { ctx, width } = this;
      const cover = this.getLobbyCoverRect();
      const titleY = lobbyBrandAnchorY(cover, 0, LOBBY_TITLE_UY);
      const subY = lobbyBrandAnchorY(cover, 0, LOBBY_SUBTITLE_UY);
      if (subY < this.statusBarHeight) {
        return;
      }
      const titleSize = Math.max(28, Math.min(40, Math.round(cover.dh * 0.048)));
      const subSize = Math.max(13, Math.min(17, Math.round(cover.dh * 0.018)));
      const mahjongNotice = lobbyNoticeForMahjongState(this.session.isMahjongHallUnlocked());
      const teaser = lobbyComingSoonLine();
      const teaserY = subY + Math.max(22, cover.dh * 0.028);
      const mahjongTeaserY = subY + Math.max(38, cover.dh * 0.048);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.font = `bold ${titleSize}px sans-serif`;
      ctx.shadowColor = "rgba(70, 130, 180, 0.35)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.strokeStyle = "rgba(140, 200, 230, 0.95)";
      ctx.lineWidth = Math.max(5, Math.round(titleSize * 0.18));
      ctx.strokeText(LOBBY_BRAND_TITLE, width / 2, titleY);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(LOBBY_BRAND_TITLE, width / 2, titleY);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.font = `bold ${subSize}px sans-serif`;
      ctx.strokeStyle = "rgba(120, 180, 215, 0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(LOBBY_BRAND_SUBTITLE, width / 2, subY);
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.fillText(LOBBY_BRAND_SUBTITLE, width / 2, subY);
      if (teaser) {
        ctx.font = "bold 12px sans-serif";
        ctx.strokeStyle = "rgba(255,255,255,0.96)";
        ctx.lineWidth = 4;
        ctx.strokeText(teaser, width / 2, teaserY);
        ctx.fillStyle = "#c2255c";
        ctx.fillText(teaser, width / 2, teaserY);
      }
      if (mahjongNotice.showMahjongTeaser && mahjongNotice.mahjongTeaser) {
        const tipSize = Math.max(11, Math.min(13, Math.round(cover.dh * 0.016)));
        ctx.font = `bold ${tipSize}px sans-serif`;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        ctx.lineWidth = 3.5;
        const tip = mahjongNotice.mahjongTeaser;
        ctx.strokeText(tip, width / 2, mahjongTeaserY);
        ctx.fillStyle = "#e03131";
        ctx.fillText(tip, width / 2, mahjongTeaserY);
      }
      ctx.restore();
    }
    drawLobbySwipeHint(page, maxPage, nowMs) {
      if (maxPage <= 0) {
        return;
      }
      const { ctx, width } = this;
      if (page < maxPage) {
        if (this.lobbySwipeHintShownAtMs <= 0) {
          this.lobbySwipeHintShownAtMs = nowMs;
        }
        const alpha = lobbySwipeHintOpacity(
          this.lobbySwipeHintShownAtMs,
          nowMs,
          this.lobbySwipeHintDismissed
        );
        if (alpha <= 0.01) {
          this.lobbySwipeHintDismissed = true;
        } else {
          const bob = Math.sin(nowMs / 520) * this.fxAmt(4, 2.5);
          const frame = layoutLobbyMoreLevelsHint(width, this.statusBarHeight, bob);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "rgba(32, 40, 56, 0.42)";
          this.roundRectPath(frame.x, frame.y, width - frame.x + 10, frame.h, frame.r);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.28)";
          ctx.lineWidth = 1;
          this.roundRectPath(frame.x, frame.y, width - frame.x + 10, frame.h, frame.r);
          ctx.stroke();
          this.drawSwipeChevrons(frame.chevronX, frame.cy, -1);
          ctx.font = "bold 11px sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            page <= 0 ? LOBBY_MORE_LEVELS_HINT : "\u4E0A\u6ED1\u7EE7\u7EED",
            frame.textX,
            frame.cy
          );
          ctx.restore();
        }
      }
      if (page > 0) {
        const nav = this.getNavChipFrame();
        const bob = Math.sin(nowMs / 520) * this.fxAmt(3, 2);
        const y = nav.y - 44 - bob * 0.35;
        ctx.save();
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fillText("\u4E0B\u6ED1\u8FD4\u56DE", width / 2, y);
        ctx.restore();
      }
    }
    drawSwipeChevrons(x, y, dir) {
      const { ctx } = this;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < 2; i += 1) {
        const oy = dir * i * 5;
        ctx.beginPath();
        ctx.moveTo(x - 5, y + 3.5 + oy);
        ctx.lineTo(x, y - 1.5 + oy);
        ctx.lineTo(x + 5, y + 3.5 + oy);
        ctx.stroke();
      }
    }
    drawLobbyPageDots(page, maxPage) {
      if (maxPage <= 0) {
        return;
      }
      const { ctx, width, height } = this;
      const total = maxPage + 1;
      const x = width - 16;
      const gap = Math.min(14, height * 0.22 / Math.max(1, total - 1));
      const r = 3.5;
      const startY = height * 0.42 - (total - 1) * gap / 2;
      ctx.save();
      for (let i = 0; i < total; i += 1) {
        ctx.beginPath();
        ctx.arc(x, startY + i * gap, i === page ? 4.5 : r, 0, Math.PI * 2);
        ctx.fillStyle = i === page ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.38)";
        ctx.fill();
      }
      ctx.restore();
    }
    /**
     * 马卡龙三层：外壳贴图、关卡号、得分。树上底图的假分数会被外壳盖住。
     */
    drawLobbyMacaronVisual(node, unlocked, cleared, isCurrent, nowMs) {
      const r = this.lobbyMacaronVisualR(node);
      const score = cleared ? this.session.getBestScore(node.levelId) : 0;
      const showScore = cleared && score > 0;
      this.drawLobbyMacaronShell(node, unlocked);
      const { ctx } = this;
      ctx.save();
      ctx.translate(node.x, node.y);
      this.drawLobbyMacaronLevelLabel(
        String(node.levelId),
        r,
        unlocked,
        node.slotIndex,
        showScore
      );
      ctx.restore();
      if (showScore) {
        this.drawLobbyMacaronScore(node.x, node.y, r, score, node.slotIndex);
      }
      if (cleared) {
        this.drawLobbyMacaronCheck(node.x, node.y, r);
      }
      if (!unlocked) {
        this.drawLobbyMacaronLocked(node.x, node.y, r);
        return;
      }
      if (isCurrent) {
        this.drawLobbyMacaronActiveGlow(node.x, node.y, r, nowMs);
      }
    }
    /** 马卡龙外壳：干净贴图，不含关号和分数。 */
    drawLobbyMacaronShell(node, unlocked) {
      const { ctx } = this;
      const r = this.lobbyMacaronVisualR(node);
      const sprite = this.uiIcons.get(`macaron-${node.slotIndex % MACARON_SRC.length}`);
      const size = r * 2 / MACARON_SPRITE_FILL;
      ctx.save();
      ctx.translate(node.x, node.y);
      if (!unlocked) {
        ctx.globalAlpha = 0.92;
      }
      if (sprite && (sprite.width || 0) > 0) {
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      } else {
        this.drawLobbyMacaronFallbackShell(r, node.slotIndex);
      }
      ctx.restore();
    }
    /** 贴图未就绪时：粉壳 + 象牙珍珠圈，尽量接近树上底图。 */
    drawLobbyMacaronFallbackShell(r, slotIndex) {
      const { ctx } = this;
      const palettes = [
        { shell: "#ff9ec8", cream: "#fff0f6", edge: "#f783ac" },
        { shell: "#8ee4c0", cream: "#e6fff6", edge: "#38d9a9" },
        { shell: "#d0b3ff", cream: "#f3e8ff", edge: "#9775fa" },
        { shell: "#ffc078", cream: "#fff4e0", edge: "#ff922b" },
        { shell: "#74c0fc", cream: "#e7f5ff", edge: "#4dabf7" }
      ];
      const pal = palettes[slotIndex % palettes.length];
      ctx.fillStyle = pal.edge;
      ctx.beginPath();
      ctx.arc(0, 3, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.shell;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.cream;
      ctx.beginPath();
      ctx.arc(0, 1, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      const pearls = 8;
      const ring = r * 0.82;
      const pr = r * 0.09;
      ctx.fillStyle = "#f3e2c8";
      for (let i = 0; i < pearls; i += 1) {
        const ang = i / pearls * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * ring, Math.sin(ang) * ring, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    /**
     * 关号：白字 + 跟树上底图一样的深色同系描边（粉/薄荷/紫/橙/蓝）。
     * 1 位和 2 位同一高度，尽量填满内馅；有得分时只上移，不缩小。
     */
    drawLobbyMacaronLevelLabel(label, r, unlocked, slotIndex, compact = false) {
      const { ctx } = this;
      ctx.save();
      const stroke = MACARON_NUM_STROKE[slotIndex % MACARON_NUM_STROKE.length];
      const glyphs = Array.from(label, (ch) => this.uiIcons.get(`digit-${ch}`));
      if (glyphs.every((img) => !!img && (img.width || 0) > 0)) {
        this.drawLobbyMacaronDigitSprites(
          glyphs,
          r,
          unlocked,
          stroke,
          compact
        );
        ctx.restore();
        return;
      }
      const lift = compact ? r * 0.18 : 0;
      const ny = -r * 0.06 - lift;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.font = `900 ${Math.round(r * 0.62)}px sans-serif`;
      ctx.strokeStyle = this.shadeHex(stroke, -28);
      ctx.lineWidth = Math.max(3.2, r * 0.1);
      ctx.strokeText(label, 0, ny + Math.max(0.8, r * 0.028));
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(2.6, r * 0.08);
      ctx.strokeText(label, 0, ny);
      ctx.fillStyle = unlocked ? "#ffffff" : "rgba(255,255,255,0.78)";
      ctx.fillText(label, 0, ny);
      ctx.restore();
    }
    drawLobbyMacaronDigitSprites(glyphs, r, unlocked, stroke, compact = false) {
      const { ctx } = this;
      const h = r * 0.82;
      const gap = h * 0.04;
      const widths = glyphs.map((img) => h * ((img.width || 1) / (img.height || 1)));
      const total = widths.reduce((sum, w) => sum + w, 0) + gap * (glyphs.length - 1);
      const x0 = -total / 2;
      const lift = compact ? r * 0.18 : 0;
      const y = -r * 0.06 - h / 2 - lift;
      const ox = Math.max(1.7, h * 0.09);
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1]
      ];
      ctx.save();
      if (!unlocked) {
        ctx.globalAlpha *= 0.78;
      }
      ctx.shadowColor = this.shadeHex(stroke, -24);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = ox * 0.35;
      ctx.shadowOffsetY = ox * 0.55;
      this.drawLobbyDigitRow(glyphs, widths, gap, x0, y, h);
      ctx.shadowColor = stroke;
      for (const [dx, dy] of dirs) {
        ctx.shadowOffsetX = dx * ox;
        ctx.shadowOffsetY = dy * ox;
        this.drawLobbyDigitRow(glyphs, widths, gap, x0, y, h);
      }
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      this.drawLobbyDigitRow(glyphs, widths, gap, x0, y, h);
      ctx.restore();
    }
    drawLobbyDigitRow(glyphs, widths, gap, x0, y, h) {
      const { ctx } = this;
      let x = x0;
      for (let i = 0; i < glyphs.length; i += 1) {
        const img = glyphs[i];
        const w = widths[i];
        ctx.drawImage(img, x, y, w, h);
        x += w + gap;
      }
    }
    /** 局内道具栏：图片圆形按钮 + 数量角标 */
    drawBoosterBar() {
      const { ctx, width, height } = this;
      const stock = this.session.getBoosterStock();
      const size = 58;
      const gap = 14;
      const y = height - size - 22;
      const items = [
        {
          id: "booster_hammer",
          iconKey: "hammer",
          count: stock.hammer,
          active: this.hammerTargeting
        },
        { id: "booster_shuffle", iconKey: "shuffle", count: stock.shuffle },
        { id: "booster_extra", iconKey: "extra", count: stock.extraMoves }
      ];
      const totalW = items.length * size + (items.length - 1) * gap;
      const nav = this.getNavChipFrame();
      const leftReserve = nav.x + nav.w + 10;
      const avail = Math.max(totalW, width - leftReserve - 14);
      let x = leftReserve + Math.floor((avail - totalW) / 2);
      for (const item of items) {
        const boosterId = this.boosterIdFromButton(item.id);
        const refill = item.count === 0 ? this.session.getBoosterRefillChannel(boosterId) : "none";
        const extraAd = refill !== "none";
        const disabled = item.count === 0 && !extraAd;
        const btn = {
          id: item.id,
          x,
          y,
          w: size,
          h: size,
          label: item.iconKey,
          hitPad: extraAd ? 18 : 8
        };
        this.buttons.push(btn);
        this.drawBoosterIconButton(btn, item.iconKey, {
          disabled,
          active: !!item.active,
          count: extraAd ? -1 : item.count,
          badge: extraAd && refill !== "none" ? boosterRefillBadge(refill) : void 0
        });
        x += size + gap;
      }
      if (this.hammerTargeting) {
        ctx.fillStyle = "rgba(90,60,40,0.85)";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u70B9\u68CB\u76D8\u4E00\u683C\u7838\u6389 \xB7 \u518D\u70B9\u9524\u5B50\u53D6\u6D88", width / 2, y - 16);
      }
    }
    /** 点底部道具后的气泡，避免提示只出现在头顶 HUD 被忽略。 */
    drawActionToast() {
      const now = this.nowMs || Date.now();
      if (!this.toastText || now >= this.toastUntilMs) {
        return;
      }
      const { ctx, width, height } = this;
      const remain = this.toastUntilMs - now;
      const fade = remain < 400 ? remain / 400 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const padX = 18;
      const tipW = Math.min(width - 28, ctx.measureText(this.toastText).width + padX * 2);
      const tipH = 36;
      const x = (width - tipW) / 2;
      const y = height - 58 - 22 - tipH - 12;
      this.drawHudPill(x, y, tipW, tipH, "rgba(255,248,230,0.96)", "#ff922b");
      ctx.fillStyle = "#d35400";
      ctx.fillText(this.toastText, width / 2, y + tipH / 2 + 0.5);
      ctx.restore();
    }
    drawBoosterIconButton(btn, iconKey, opts) {
      const { ctx } = this;
      const img = this.uiIcons.get(iconKey);
      const cx = btn.x + btn.w / 2;
      const cy = btn.y + btn.h / 2;
      const r = btn.w / 2;
      const now = this.nowMs || Date.now();
      const bounce = opts.active ? 1.08 + 0.04 * Math.sin(now * 0.012) : 1 + this.fxAmt(0.025, 0.014) * Math.sin(now * 5e-3 + btn.x * 0.03);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(bounce, bounce);
      ctx.translate(-cx, -cy);
      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      if (opts.disabled) {
        grad.addColorStop(0, "#f1f3f5");
        grad.addColorStop(1, "#ced4da");
      } else if (opts.active) {
        grad.addColorStop(0, "#fff3bf");
        grad.addColorStop(1, "#ffd43b");
      } else {
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(1, "#ffe8cc");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = opts.active ? "#fab005" : "#ffffff";
      ctx.lineWidth = opts.active ? 3.5 : 3;
      ctx.stroke();
      if (img) {
        const pad = opts.disabled ? 8 : 5;
        const iw = btn.w - pad * 2;
        const ih = btn.h - pad * 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
        ctx.clip();
        if (opts.disabled) {
          ctx.globalAlpha = 0.45;
        }
        ctx.drawImage(img, btn.x + pad, btn.y + pad, iw, ih);
        ctx.restore();
      } else {
        ctx.fillStyle = opts.disabled ? "#868e96" : "#5c3d2e";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fallback = iconKey === "hammer" ? "\u9524" : iconKey === "shuffle" ? "\u6392" : iconKey === "extra" ? "+5" : iconKey === "mute" ? "\u9759" : "\u97F3";
        ctx.fillText(fallback, cx, cy);
      }
      if (opts.badge) {
        const bx = btn.x + btn.w - 2;
        const by = btn.y + 6;
        const fill2 = opts.badge === "\u597D\u53CB" ? "#12b886" : opts.badge === "\u7FA4" ? "#339af0" : "#ff922b";
        ctx.fillStyle = fill2;
        this.roundRectPath(bx - 18, by - 9, 36, 18, 9);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        this.roundRectPath(bx - 18, by - 9, 36, 18, 9);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(opts.badge, bx, by + 0.5);
      } else if (opts.count >= 0) {
        const bx = btn.x + btn.w - 4;
        const by = btn.y + 4;
        ctx.fillStyle = opts.disabled ? "#adb5bd" : "#fa5252";
        ctx.beginPath();
        ctx.arc(bx, by, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(opts.count), bx, by + 0.5);
      }
      ctx.restore();
    }
    drawHud() {
      var _a, _b, _c, _d, _e, _f;
      const { ctx } = this;
      this.drawPostClearAnnouncementBar();
      this.pushClearAnnouncementButton();
      const level = this.session.getLevelConfig();
      const goals = (_b = (_a = this.session.getGoals()) == null ? void 0 : _a.getSnapshots()) != null ? _b : [];
      const frame = this.getHudFrame();
      const crush = this.session.getCrushSession();
      const clean = this.session.getCleanSession();
      const inCrush = this.mode === "crush" && !!crush;
      const inClean = this.mode === "clean" && !!clean;
      const inBurst = inCrush || inClean;
      const burstSession = inClean ? clean : crush;
      const moves = this.session.getMovesLeft();
      const score = this.session.getScore();
      const hudGoal = formatHudGoals(goals);
      const y0 = frame.top;
      const levelLabel = inClean ? "\u6E05\u6D01\u6A21\u5F0F" : inCrush ? "\u7C89\u788E\u5956\u52B1" : `\u7B2C ${(_c = level == null ? void 0 : level.id) != null ? _c : "-"} \u5173`;
      ctx.font = "bold 13px sans-serif";
      const levelW = Math.max(64, ctx.measureText(levelLabel).width + 26);
      const levelH = 26;
      const lx = frame.left;
      const ly = y0;
      const proceduralHue = (_e = (_d = this.session.getLevelConfig()) == null ? void 0 : _d.procedural) == null ? void 0 : _e.hue;
      const candy = proceduralHue !== void 0 && !inBurst ? hudPaletteFromHue(proceduralHue) : this.getHudCandyPalette(inClean, inCrush);
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = candy.shadow;
      this.roundRectPath(lx + 2, ly + 3, levelW, levelH, levelH / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const lg = ctx.createLinearGradient(lx, ly, lx, ly + levelH);
      lg.addColorStop(0, candy.lite);
      lg.addColorStop(0.45, candy.mid);
      lg.addColorStop(1, candy.deep);
      ctx.fillStyle = lg;
      this.roundRectPath(lx, ly, levelW, levelH, levelH / 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      this.roundRectPath(lx + 3, ly + 3, levelW - 6, levelH - 6, (levelH - 6) / 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      this.roundRectPath(lx + 1, ly + 1, levelW - 2, levelH - 2, levelH / 2 - 1);
      ctx.stroke();
      ctx.fillStyle = candy.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(levelLabel, lx + levelW / 2, ly + levelH / 2);
      ctx.restore();
      const rowY = y0 + 34;
      const circleR = 28;
      const circleCx = frame.left + circleR + 2;
      const circleCy = rowY + circleR;
      const cardLeft = circleCx + circleR + 8;
      const cardRight = frame.right;
      const cardW = Math.max(100, cardRight - cardLeft);
      const cardH = 64;
      const lowMoves = !inBurst && moves <= 5;
      const movePulse = lowMoves ? 1 + 0.05 * Math.sin((this.nowMs || Date.now()) * 0.02) : 1;
      const circleValue = inBurst ? String(Math.ceil(((_f = burstSession == null ? void 0 : burstSession.remainingMs) != null ? _f : 0) / 1e3)) : String(moves);
      this.drawHudCandyMovesBadge(circleCx, circleCy, circleR, {
        label: inBurst ? "\u5269\u4F59" : "\u6B65\u6570",
        value: circleValue,
        pulse: movePulse,
        low: lowMoves,
        candy
      });
      this.drawHudCandyPlaque(cardLeft, rowY, cardW, cardH, candy);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = candy.inkSoft;
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("\u5206\u6570", cardLeft + 16, rowY + 14);
      ctx.save();
      ctx.translate(cardLeft + 48, rowY + 14);
      ctx.scale(this.hudScorePunch, this.hudScorePunch);
      ctx.fillStyle = candy.ink;
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(score), 0, 0);
      ctx.restore();
      const barX = cardLeft + 12;
      const barY = rowY + 30;
      const iconSize = 18;
      const buriedHudIcon = !inBurst ? this.pickHudBuriedGoalIcon(goals) : null;
      const collectSprite = !inBurst && hudGoal.collectKind ? this.tileImages.get(hudGoal.collectKind) : void 0;
      const hasIcon = !!(buriedHudIcon || collectSprite);
      const barW = cardW - 24;
      const barH = 24;
      const barPulse = this.hudBarPulse > 0 ? 1 + (inBurst ? 0.16 : 0.08) * Math.sin((1 - this.hudBarPulse / 420) * Math.PI) : 1;
      let progress = 0;
      let goalLabel = "\u76EE\u6807 -";
      let barTheme = {
        track: "#d0ebff",
        fillTop: "#a5d8ff",
        fillMid: "#4dabf7",
        fillBottom: "#228be6",
        border: "#74c0fc"
      };
      if (inClean && clean) {
        progress = this.hudBurstBarDisplay;
        goalLabel = `\u6E05\u626B +${clean.crushScore}`;
        barTheme = {
          track: "#d0ebff",
          fillTop: "#74c0fc",
          fillMid: "#339af0",
          fillBottom: "#1c7ed6",
          border: "#4dabf7"
        };
      } else if (inCrush && crush) {
        progress = this.hudBurstBarDisplay;
        goalLabel = `\u7C89\u788E +${crush.crushScore}`;
        barTheme = {
          track: "#c5f6fa",
          fillTop: "#66d9e8",
          fillMid: "#22b8cf",
          fillBottom: "#1098ad",
          border: "#3bc9db"
        };
      } else if (hudGoal.text) {
        progress = hudGoal.progress;
        goalLabel = hudGoal.text;
      }
      this.drawCartoonProgressBar(barX, barY, barW, barH, progress, barTheme, barPulse);
      if (buriedHudIcon) {
        this.drawTileSprite(
          buriedHudIcon,
          barX + 4,
          barY + (barH - iconSize) / 2,
          iconSize
        );
      } else if (collectSprite) {
        this.drawTileSprite(
          collectSprite,
          barX + 4,
          barY + (barH - iconSize) / 2,
          iconSize
        );
      }
      this.hudGoalIconPos = collectSprite ? { x: barX + 4 + iconSize / 2, y: barY + barH / 2 } : null;
      ctx.font = goalLabel.length > 22 ? "bold 10px sans-serif" : "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelX = barX + (hasIcon ? 8 : 0) + barW / 2;
      const labelY = barY + barH / 2 + 0.5;
      ctx.save();
      if (inBurst && this.hudScorePunch > 1) {
        ctx.translate(labelX, labelY);
        ctx.scale(this.hudScorePunch, this.hudScorePunch);
        ctx.translate(-labelX, -labelY);
      }
      ctx.strokeStyle = inBurst ? "rgba(12, 80, 100, 0.35)" : "rgba(24, 100, 160, 0.35)";
      ctx.lineWidth = 3.5;
      ctx.strokeText(goalLabel, labelX, labelY);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(goalLabel, labelX, labelY);
      ctx.restore();
      if (this.statusText && (this.mode === "playing" || this.mode === "crush" || this.mode === "clean")) {
        const tipY = this.getHudBottom() + 2;
        ctx.font = "12px sans-serif";
        const tipW = Math.min(frame.width, ctx.measureText(this.statusText).width + 20);
        this.drawHudPill(frame.left, tipY, tipW, 22, "rgba(232,248,255,0.95)", "#74c0fc");
        ctx.fillStyle = "#1864ab";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.statusText, frame.left + 10, tipY + 11);
      }
    }
    /** 糖果枝配色：对局 / 粉碎 / 清洁统一天蓝冷色 */
    getHudCandyPalette(inClean, inCrush) {
      if (inClean) {
        return {
          deep: "#1c7ed6",
          mid: "#74c0fc",
          lite: "#d0ebff",
          ink: "#1864ab",
          inkSoft: "#4dabf7",
          shadow: "#1c4b7a"
        };
      }
      if (inCrush) {
        return {
          deep: "#1098ad",
          mid: "#3bc9db",
          lite: "#c5f6fa",
          ink: "#0b7285",
          inkSoft: "#15aabf",
          shadow: "#0b4f5c"
        };
      }
      return {
        deep: "#339af0",
        mid: "#74c0fc",
        lite: "#d0ebff",
        ink: "#1864ab",
        inkSoft: "#4dabf7",
        shadow: "#1c4b7a"
      };
    }
    /** 兼容微信 Canvas 的椭圆填充 */
    fillEllipse(cx, cy, rx, ry, rot = 0) {
      const { ctx } = this;
      ctx.beginPath();
      if (typeof ctx.ellipse === "function") {
        ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      } else {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.scale(rx, ry);
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.restore();
      }
      ctx.fill();
    }
    /** 立体糖果环步数徽章（马卡龙感） */
    drawHudCandyMovesBadge(cx, cy, r, opts) {
      const { ctx } = this;
      const c = opts.candy;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(opts.pulse, opts.pulse);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = c.shadow;
      this.fillEllipse(cx + 2, cy + 5, r + 2, r * 0.55, 0);
      ctx.globalAlpha = 1;
      const ring = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r + 4);
      ring.addColorStop(0, "#ffffff");
      ring.addColorStop(0.35, c.lite);
      ring.addColorStop(0.75, c.mid);
      ring.addColorStop(1, c.deep);
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.fill();
      const face = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      face.addColorStop(0, "#ffffff");
      face.addColorStop(1, c.lite);
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1, -Math.PI * 0.9, -Math.PI * 0.18);
      ctx.stroke();
      ctx.strokeStyle = opts.low ? "#339af0" : "#ffffff";
      ctx.lineWidth = opts.low ? 3.2 : 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 3.8, 0, Math.PI * 2);
      ctx.stroke();
      const pearls = [
        { x: -0.55, y: -0.82, color: "#a5d8ff" },
        { x: 0.05, y: -0.95, color: "#74c0fc" },
        { x: 0.58, y: -0.78, color: "#4dabf7" }
      ];
      for (const p of pearls) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(cx + r * p.x, cy + r * p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = opts.low ? "#1c7ed6" : c.inkSoft;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.label, cx, cy - 9);
      ctx.fillStyle = opts.low ? "#1864ab" : c.ink;
      ctx.font = "bold 19px sans-serif";
      ctx.fillText(opts.value, cx, cy + 8);
      ctx.restore();
    }
    /** 糖霜信息牌（分数 + 目标） */
    drawHudCandyPlaque(x, y, w, h, candy) {
      const { ctx } = this;
      const r = Math.min(20, h * 0.45);
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = candy.shadow;
      this.roundRectPath(x + 3, y + 6, w, h, r);
      ctx.fill();
      ctx.globalAlpha = 1;
      const shell = ctx.createLinearGradient(x, y, x, y + h);
      shell.addColorStop(0, candy.lite);
      shell.addColorStop(1, candy.deep);
      ctx.fillStyle = shell;
      this.roundRectPath(x, y, w, h, r);
      ctx.fill();
      const inset = 5;
      ctx.fillStyle = "#ffffff";
      this.roundRectPath(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(10, r - 4));
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.2;
      this.roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
      ctx.stroke();
      ctx.restore();
    }
    /**
     * 卡通饱满进度条：厚边胶囊槽 + 内嵌果冻填充 + 双层高光。
     */
    drawCartoonProgressBar(x, y, w, h, progress, colors, pulse = 1) {
      const { ctx } = this;
      const r = h / 2;
      const p = Math.max(0, Math.min(1, progress));
      const inset = 3.5;
      const innerH = Math.max(8, h - inset * 2);
      const innerR = innerH / 2;
      const innerMaxW = Math.max(0, w - inset * 2);
      let fillW = Math.floor(innerMaxW * p);
      if (p > 0.01 && fillW < innerH) {
        fillW = Math.min(innerMaxW, Math.max(fillW, Math.floor(innerH * 0.95)));
      }
      ctx.save();
      if (pulse !== 1) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);
        ctx.translate(-cx, -cy);
      }
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#4a7090";
      this.roundRectPath(x + 1.5, y + 3, w, h, r);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#f1f8ff";
      this.roundRectPath(x, y, w, h, r);
      ctx.fill();
      const trackGrad = ctx.createLinearGradient(x, y, x, y + h);
      trackGrad.addColorStop(0, this.shadeHex(colors.track, -18));
      trackGrad.addColorStop(0.35, colors.track);
      trackGrad.addColorStop(1, this.shadeHex(colors.track, -28));
      ctx.fillStyle = trackGrad;
      this.roundRectPath(x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 2));
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#000000";
      this.roundRectPath(x + 4, y + 3, w - 8, Math.max(3, h * 0.28), Math.min(r - 2, 7));
      ctx.fill();
      ctx.restore();
      if (fillW >= 2) {
        const fx = x + inset;
        const fy = y + inset;
        const bodyW = Math.min(innerMaxW, fillW);
        const jelly = ctx.createLinearGradient(fx, fy, fx, fy + innerH);
        jelly.addColorStop(0, colors.fillTop);
        jelly.addColorStop(0.45, colors.fillMid);
        jelly.addColorStop(1, colors.fillBottom);
        ctx.fillStyle = jelly;
        this.roundRectPath(fx, fy, bodyW, innerH, innerR);
        ctx.fill();
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = colors.fillBottom;
        this.roundRectPath(
          fx + 1,
          fy + innerH * 0.55,
          Math.max(0, bodyW - 2),
          innerH * 0.42,
          Math.max(2, innerR - 1)
        );
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.72;
        const gloss = ctx.createLinearGradient(fx, fy, fx, fy + innerH * 0.55);
        gloss.addColorStop(0, "rgba(255,255,255,0.95)");
        gloss.addColorStop(0.55, "rgba(255,255,255,0.35)");
        gloss.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gloss;
        this.roundRectPath(
          fx + 3,
          fy + 2,
          Math.max(0, bodyW - 6),
          innerH * 0.42,
          Math.max(3, innerR - 3)
        );
        ctx.fill();
        ctx.restore();
        if (bodyW > innerH * 0.45) {
          const tipX = fx + bodyW - innerR * 0.55;
          const tipY = fy + innerH * 0.38;
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(tipX, tipY, Math.max(2.4, innerR * 0.32), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(fx + Math.min(10, bodyW * 0.18), fy + innerH * 0.28, 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (pulse > 1.02) {
            this.drawSparkleStar(tipX, tipY - 1, 4.2, 1);
            this.drawSparkleStar(tipX - innerH * 0.55, fy + 2, 2.6, 0.85);
          }
        } else if (pulse > 1.02 && bodyW >= 2) {
          this.drawSparkleStar(fx + bodyW * 0.55, fy + innerH * 0.35, 3.4, 0.95);
        }
      }
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 3.2;
      this.roundRectPath(x + 1.4, y + 1.4, w - 2.8, h - 2.8, Math.max(1, r - 1));
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.lineWidth = 1.6;
      this.roundRectPath(x + 4.2, y + 4.2, w - 8.4, h - 8.4, Math.max(1, r - 4));
      ctx.stroke();
      ctx.restore();
    }
    /** 简易色值加减亮度（#rrggbb） */
    shadeHex(hex, delta) {
      const raw = hex.replace("#", "");
      if (raw.length !== 6) {
        return hex;
      }
      const clamp3 = (n) => Math.max(0, Math.min(255, n));
      const r = clamp3(parseInt(raw.slice(0, 2), 16) + delta);
      const g = clamp3(parseInt(raw.slice(2, 4), 16) + delta);
      const b = clamp3(parseInt(raw.slice(4, 6), 16) + delta);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    drawHudPill(x, y, w, h, fill2, stroke) {
      const { ctx } = this;
      const r = Math.min(h / 2, 14);
      ctx.save();
      ctx.fillStyle = fill2;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      this.roundRectPath(x, y, w, h, r);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    roundRectPath(x, y, w, h, r) {
      const { ctx } = this;
      const width = Math.max(0, w);
      const height = Math.max(0, h);
      const rr = Math.max(0, Math.min(r, width / 2, height / 2));
      ctx.beginPath();
      if (width <= 0 || height <= 0) {
        return;
      }
      if (rr <= 0) {
        ctx.rect(x, y, width, height);
        return;
      }
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + width - rr, y);
      ctx.arc(x + width - rr, y + rr, rr, -Math.PI / 2, 0);
      ctx.lineTo(x + width, y + height - rr);
      ctx.arc(x + width - rr, y + height - rr, rr, 0, Math.PI / 2);
      ctx.lineTo(x + rr, y + height);
      ctx.arc(x + rr, y + height - rr, rr, Math.PI / 2, Math.PI);
      ctx.lineTo(x, y + rr);
      ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 3 / 2);
      ctx.closePath();
    }
    drawBoard() {
      const board = this.session.getBoard();
      if (!board) {
        return;
      }
      const layout = this.computeBoardLayout(board);
      this.boardView.updateLayout(layout);
      this.drawBoardPanel(board, layout);
      this.drawBoardSlots(board, layout);
      this.drawBuriedGroups(board, layout, "base");
      const encaseIce = this.iceEncasesAnimals();
      const liveBurstBoard = this.mode === "crush" || this.mode === "clean";
      if (!liveBurstBoard && this.animator.isPlaying()) {
        this.drawAnimatedTiles(layout);
        if (encaseIce) {
          this.drawIceOverlays(board, layout);
        }
        this.drawCloudOverlays(board, layout);
        this.drawEggAndVineOverlays(board, layout);
        this.drawBuriedGroups(board, layout, "leave");
        return;
      }
      const now = this.nowMs || Date.now();
      const slide = liveBurstBoard ? null : this.swapSlide;
      if (slide) {
        this.drawBoardWithSwapSlide(board, layout, slide, now);
        if (encaseIce) {
          this.drawIceOverlays(board, layout);
        }
        this.drawCloudOverlays(board, layout);
        this.drawEggAndVineOverlays(board, layout);
        this.drawBuriedGroups(board, layout, "leave");
        return;
      }
      const sel = this.boardView.getSelection();
      const drag = this.boardView.getDragPreview(now);
      const topTiles = [];
      const rows = board.size.rows;
      const cols = board.size.cols;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const kind = board.getTile(r, c);
          if (kind === 0 /* Empty */ || kind === 8 /* Hole */) {
            continue;
          }
          const sparkle = board.isSparkle(r, c);
          let x = layout.originX + c * layout.cellSize;
          let y = layout.originY - (r + 1) * layout.cellSize;
          let drawSize = layout.cellSize;
          let lift = false;
          let showRing = false;
          if (drag) {
            if (r === drag.row && c === drag.col) {
              this.drawDragGhostSlot(x, y, layout.cellSize, drag.slideProgress);
              x += drag.dx;
              y += drag.dy;
              const liftScale = 1.14 + 0.1 * drag.pressLift + 0.12 * drag.slideProgress;
              drawSize = layout.cellSize * liftScale;
              x -= (drawSize - layout.cellSize) / 2;
              y -= (drawSize - layout.cellSize) / 2 + layout.cellSize * 0.04 * drag.pressLift;
              lift = true;
              showRing = true;
            } else if (r === drag.otherRow && c === drag.otherCol && (drag.otherDx !== 0 || drag.otherDy !== 0)) {
              this.drawSwapTargetHint(x, y, layout.cellSize, drag.slideProgress);
              x += drag.otherDx;
              y += drag.otherDy;
              const pushScale = 1.02 + 0.06 * drag.slideProgress;
              drawSize = layout.cellSize * pushScale;
              x -= (drawSize - layout.cellSize) / 2;
              y -= (drawSize - layout.cellSize) / 2;
              lift = true;
            }
          }
          if (lift) {
            topTiles.push({ x, y, size: drawSize, kind, sparkle, ring: showRing });
            continue;
          }
          const frozen = encaseIce && this.getDisplayIce(board, r, c) > 0 || this.getDisplayCloud(board, r, c) > 0 || this.getDisplayEgg(board, r, c) > 0 || this.getDisplayVine(board, r, c) > 0;
          const idle = frozen ? 1 : 1 + this.fxAmt(0.042, 0.022) * Math.sin(now * 42e-4 + r * 1.7 + c * 2.1);
          const sit = this.sitOnGemRect(
            x,
            y,
            drawSize,
            this.tileSitsOnBase(board, r, c)
          );
          this.drawTileAt(sit.x, sit.y, sit.size, kind, 1, idle, sparkle, now);
          if (sel && sel.row === r && sel.col === c && !drag) {
            this.drawSelectionRing(x, y, layout.cellSize, now);
          }
        }
      }
      for (const tile of topTiles) {
        if (!tile.ring) {
          this.drawTileAt(tile.x, tile.y, tile.size, tile.kind, 1, 1, tile.sparkle, now);
        }
      }
      for (const tile of topTiles) {
        if (tile.ring) {
          this.drawDragShadow(tile.x, tile.y, tile.size);
          this.drawTileAt(tile.x, tile.y, tile.size, tile.kind, 1, 1, tile.sparkle, now);
          this.drawSelectionRing(tile.x, tile.y, tile.size, now, true);
        }
      }
      if (encaseIce) {
        this.drawIceOverlays(board, layout);
      }
      this.drawCloudOverlays(board, layout);
      this.drawEggAndVineOverlays(board, layout);
      this.drawBuriedGroups(board, layout, "leave");
    }
    /** 拖起时原点淡影 */
    drawDragGhostSlot(x, y, cellSize, slideProgress) {
      const { ctx } = this;
      const pad = Math.max(2, Math.floor(cellSize * 0.08));
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.18 * slideProgress;
      ctx.fillStyle = "rgba(255, 140, 180, 0.55)";
      this.roundRectPath(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.22);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 2;
      this.roundRectPath(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.22);
      ctx.stroke();
      ctx.restore();
    }
    /** 邻格可交换高亮 */
    drawSwapTargetHint(x, y, cellSize, slideProgress) {
      const { ctx } = this;
      const pad = Math.max(1, Math.floor(cellSize * 0.04));
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.45 * slideProgress;
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 3;
      this.roundRectPath(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.2);
      ctx.stroke();
      ctx.restore();
    }
    /** 拖动块脚下阴影，增强“拎起”感 */
    drawDragShadow(x, y, cellSize) {
      const { ctx } = this;
      const cx = x + cellSize / 2;
      const cy = y + cellSize * 0.78;
      ctx.save();
      const shadow = ctx.createRadialGradient(cx, cy, cellSize * 0.08, cx, cy, cellSize * 0.42);
      shadow.addColorStop(0, "rgba(80, 40, 60, 0.35)");
      shadow.addColorStop(1, "rgba(80, 40, 60, 0)");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.42);
      ctx.arc(0, 0, cellSize * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    /** 交换滑动：成功滑入 / 失败回弹，期间用快照绘制避免跳变 */
    drawBoardWithSwapSlide(board, layout, slide, now) {
      var _a, _b;
      const rawT = this.swapSlideProgress(now);
      let moveT;
      if (slide.rejected) {
        moveT = rawT < 0.5 ? this.easeOutSwap(rawT * 2) : this.easeOutSwap((1 - rawT) * 2);
      } else {
        moveT = this.easeOutSwap(rawT);
      }
      const posA = this.cellScreenRect(layout, slide.rowA, slide.colA);
      const posB = this.cellScreenRect(layout, slide.rowB, slide.colB);
      const drawAx = slide.rejected ? posA.x + (posB.x - posA.x) * moveT : posB.x + (posA.x - posB.x) * moveT;
      const drawAy = slide.rejected ? posA.y + (posB.y - posA.y) * moveT : posB.y + (posA.y - posB.y) * moveT;
      const drawBx = slide.rejected ? posB.x + (posA.x - posB.x) * moveT : posA.x + (posB.x - posA.x) * moveT;
      const drawBy = slide.rejected ? posB.y + (posA.y - posB.y) * moveT : posA.y + (posB.y - posA.y) * moveT;
      const snapshot = this.pendingPlayback;
      const rows = (_a = snapshot == null ? void 0 : snapshot.rows) != null ? _a : board.size.rows;
      const cols = (_b = snapshot == null ? void 0 : snapshot.cols) != null ? _b : board.size.cols;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (r === slide.rowA && c === slide.colA || r === slide.rowB && c === slide.colB) {
            continue;
          }
          let kind;
          let sparkle = false;
          if (snapshot) {
            const i = r * cols + c;
            kind = snapshot.cells[i];
            sparkle = snapshot.sparkles[i] === 1;
          } else {
            kind = board.getTile(r, c);
            sparkle = board.isSparkle(r, c);
          }
          if (kind === 0 /* Empty */ || kind === 8 /* Hole */) {
            continue;
          }
          const x = layout.originX + c * layout.cellSize;
          const y = layout.originY - (r + 1) * layout.cellSize;
          const sit = this.sitOnGemRect(
            x,
            y,
            layout.cellSize,
            this.tileSitsOnBase(board, r, c)
          );
          this.drawTileAt(sit.x, sit.y, sit.size, kind, 1, 1, sparkle, now);
        }
      }
      const size = layout.cellSize * 1.12;
      const ox = (size - layout.cellSize) / 2;
      this.drawDragShadow(drawAx - ox, drawAy - ox, size);
      this.drawTileAt(
        drawAx - ox,
        drawAy - ox,
        size,
        slide.kindA,
        1,
        1,
        slide.sparkleA,
        now
      );
      this.drawDragShadow(drawBx - ox, drawBy - ox, size);
      this.drawTileAt(
        drawBx - ox,
        drawBy - ox,
        size,
        slide.kindB,
        1,
        1,
        slide.sparkleB,
        now
      );
    }
    /** 棋盘外框：白底圆角红框，矩形和异形关都画。 */
    drawBoardPanel(board, layout) {
      const { ctx } = this;
      const pad = 14;
      const w = board.size.cols * layout.cellSize + pad * 2;
      const h = board.size.rows * layout.cellSize + pad * 2;
      const x = layout.originX - pad;
      const y = layout.originY - board.size.rows * layout.cellSize - pad;
      const radius = Math.min(22, Math.floor(layout.cellSize * 0.38));
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#4a7090";
      this.roundRectPath(x + 2, y + 5, w, h, radius);
      ctx.fill();
      ctx.restore();
      const panel = ctx.createLinearGradient(x, y, x, y + h);
      panel.addColorStop(0, BOARD_PANEL_TOP);
      panel.addColorStop(1, BOARD_PANEL_BOTTOM);
      ctx.fillStyle = panel;
      this.roundRectPath(x, y, w, h, radius);
      ctx.fill();
      ctx.strokeStyle = BOARD_PANEL_OUTER;
      ctx.lineWidth = 3;
      this.roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(4, radius - 1));
      ctx.stroke();
    }
    /** 格子槽：圆角浅槽 + 中心圆台高光，动物坐在浅盘里 */
    drawBoardSlots(board, layout) {
      const { ctx } = this;
      const gap = Math.max(2, Math.floor(layout.cellSize * 0.06));
      const slotR = Math.max(6, Math.floor(layout.cellSize * 0.18));
      for (let r = 0; r < board.size.rows; r += 1) {
        for (let c = 0; c < board.size.cols; c += 1) {
          if (board.getTile(r, c) === 8 /* Hole */) {
            continue;
          }
          const x = layout.originX + c * layout.cellSize + gap;
          const y = layout.originY - (r + 1) * layout.cellSize + gap;
          const s = layout.cellSize - gap * 2;
          ctx.fillStyle = SLOT_FILL_BOTTOM;
          this.roundRectPath(x, y, s, s, slotR);
          ctx.fill();
          ctx.strokeStyle = SLOT_LINE;
          ctx.lineWidth = 1.2;
          this.roundRectPath(x + 0.5, y + 0.5, s - 1, s - 1, Math.max(4, slotR - 0.5));
          ctx.stroke();
          if (board.getGem(r, c) > 0) {
            this.drawPinkGemOnSlot(x, y, s, this.getDisplayCloud(board, r, c) > 0);
          }
        }
      }
      if (!this.iceEncasesAnimals()) {
        for (let r = 0; r < board.size.rows; r += 1) {
          for (let c = 0; c < board.size.cols; c += 1) {
            if (this.getDisplayIce(board, r, c) <= 0) {
              continue;
            }
            const x = layout.originX + c * layout.cellSize;
            const y = layout.originY - (r + 1) * layout.cellSize;
            this.drawIceOnSlot(x, y, layout.cellSize, slotR);
          }
        }
      }
    }
    updateBuriedCollect(now) {
      if (this.buriedFx.size === 0) {
        return;
      }
      const waiting = this.animator.isPlaying() || !!this.pendingPlayback || !!this.swapSlide;
      const done = [];
      for (const fx of this.buriedFx.values()) {
        if (fx.poseFrom <= 0) {
          if (!waiting) {
            fx.poseFrom = now;
          }
          continue;
        }
        if (fx.leaveFrom <= 0) {
          if (!waiting && now - fx.poseFrom >= BURIED_POSE_MS) {
            fx.leaveFrom = now;
          }
          continue;
        }
        if (now - fx.leaveFrom >= BURIED_LEAVE_MS) {
          done.push(fx.id);
        }
      }
      for (const id of done) {
        this.buriedFx.delete(id);
        this.session.collectBuriedGroup(id);
      }
    }
    drawBuriedGroups(board, layout, layer = "base") {
      const cs = layout.cellSize;
      const cols = board.size.cols;
      const now = this.nowMs || Date.now();
      for (const group of board.listBuriedGroups()) {
        const peek = [];
        for (const i of group.cells) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          if (this.getDisplayIce(board, r, c) <= 0) {
            peek.push(i);
          }
        }
        if (peek.length === 0) {
          continue;
        }
        let minR = board.size.rows;
        let maxR = 0;
        let minC = cols;
        let maxC = 0;
        for (const i of group.cells) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
        const x = layout.originX + minC * cs;
        const y = layout.originY - (maxR + 1) * cs;
        const w = (maxC - minC + 1) * cs;
        const h = (maxR - minR + 1) * cs;
        const fx = this.buriedFx.get(group.id);
        const fullyOut = peek.length === group.cells.length;
        const leaving = !!fx && fx.leaveFrom > 0;
        if (layer === "leave" && !leaving) {
          continue;
        }
        if (layer === "base" && leaving) {
          continue;
        }
        let lift = 0;
        let scale = fullyOut ? 1.04 : 1;
        let alpha = 1;
        if (fx && fx.poseFrom > 0 && fx.leaveFrom <= 0) {
          const pulse = 0.5 + 0.5 * Math.sin((now - fx.poseFrom) / 180 * Math.PI);
          scale = 1.04 + 0.05 * pulse;
        }
        if (leaving) {
          const t = Math.min(1, (now - fx.leaveFrom) / BURIED_LEAVE_MS);
          const e = t * t * (3 - 2 * t);
          lift = e * cs * 1.15;
          scale = 1.08 + 0.22 * e;
          alpha = 1 - e;
        }
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (!fullyOut && !leaving) {
          ctx.beginPath();
          for (const i of peek) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const px = layout.originX + c * cs;
            const py = layout.originY - (r + 1) * cs;
            ctx.rect(px, py, cs, cs);
          }
          ctx.clip();
        }
        const dw = w * scale;
        const dh = h * scale;
        const dx = x + (w - dw) / 2;
        const dy = y + (h - dh) / 2 - lift;
        if (group.kind === BURIED_SNOWMAN) {
          this.drawBuriedSprite(this.buriedSnowman, dx, dy, dw, dh);
        } else if (group.kind === BURIED_PENGUIN) {
          this.drawBuriedSprite(this.buriedPenguin, dx, dy, dw, dh);
        }
        ctx.restore();
      }
    }
    iceEncasesAnimals() {
      var _a;
      return ((_a = this.session.getLevelConfig()) == null ? void 0 : _a.iceStyle) === "encase";
    }
    drawIceOnSlot(x, y, s, slotR) {
      this.paintIceCell(x, y, s, slotR, false, 0, 0);
    }
    drawIceOverlays(board, layout) {
      const cs = layout.cellSize;
      const slotR = Math.max(6, Math.floor(cs * 0.18));
      for (let r = 0; r < board.size.rows; r += 1) {
        for (let c = 0; c < board.size.cols; c += 1) {
          if (board.getTile(r, c) === 8 /* Hole */ || this.getDisplayIce(board, r, c) <= 0) {
            continue;
          }
          const x = layout.originX + c * cs;
          const y = layout.originY - (r + 1) * cs;
          this.paintIceCell(x, y, cs, slotR, true, r, c);
        }
      }
    }
    /** 冰块：实色玻璃罩 + 一笔裂纹，避免每格两套渐变。 */
    paintIceCell(x, y, s, slotR, encase, row, col) {
      const { ctx } = this;
      ctx.save();
      this.roundRectPath(x + 1, y + 1, s - 2, s - 2, slotR);
      ctx.clip();
      ctx.fillStyle = encase ? "rgba(164, 220, 245, 0.46)" : "rgba(186, 232, 255, 0.9)";
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.12, y + s * 0.22);
      ctx.lineTo(x + s * 0.3, y + s * 0.08);
      if (encase) {
        const crack = this.cottonHash(row, col, 9);
        ctx.moveTo(x + s * (0.2 + crack * 0.15), y + s * 0.14);
        ctx.lineTo(x + s * 0.55, y + s * 0.78);
      }
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = encase ? "rgba(255,255,255,0.85)" : "rgba(90, 170, 220, 0.95)";
      ctx.lineWidth = 2.2;
      this.roundRectPath(x + 2, y + 2, s - 4, s - 4, Math.max(3, slotR - 1));
      ctx.stroke();
      ctx.restore();
    }
    tileSitsOnBase(board, row, col) {
      if (this.getDisplayCloud(board, row, col) > 0) {
        return false;
      }
      if (board.getGem(row, col) > 0) {
        return true;
      }
      return board.getBuried(row, col) > 0 && this.getDisplayIce(board, row, col) <= 0;
    }
    /** 揭开棉花后动物略缩小，坐在粉球上。 */
    sitOnGemRect(x, y, cellSize, sit) {
      if (!sit) {
        return { x, y, size: cellSize };
      }
      const size = cellSize * 0.9;
      return {
        x: x + (cellSize - size) * 0.5,
        y: y + cellSize * 0.01,
        size
      };
    }
    drawPinkGemOnSlot(x, y, s, underCloud) {
      const { ctx } = this;
      const cx = x + s * 0.5;
      const cy = y + s * 0.78;
      const r = s * (underCloud ? 0.26 : 0.34);
      ctx.save();
      ctx.globalAlpha = underCloud ? 0.35 : 1;
      ctx.fillStyle = "rgba(90, 40, 70, 0.28)";
      this.fillEllipse(cx, cy + r * 0.42, r * 0.92, r * 0.28, 0);
      ctx.fillStyle = "#ff7eb6";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      this.fillEllipse(cx - r * 0.28, cy - r * 0.32, r * 0.32, r * 0.18, -0.5);
      ctx.strokeStyle = "rgba(176, 32, 90, 0.5)";
      ctx.lineWidth = Math.max(0.9, s * 0.022);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    /** 17–20 关 HUD：优先雪人 / 企鹅目标小图标 */
    pickHudBuriedGoalIcon(goals) {
      var _a, _b;
      const levelId = (_b = (_a = this.session.getLevelConfig()) == null ? void 0 : _a.id) != null ? _b : 0;
      if (levelId < 1 || levelId > 20) {
        return null;
      }
      if (goals.some((item) => item.goal.type === "collect_snowmen") && this.buriedSnowman) {
        return this.buriedSnowman;
      }
      if (goals.some((item) => item.goal.type === "collect_penguins") && this.buriedPenguin) {
        return this.buriedPenguin;
      }
      return null;
    }
    drawBuriedSprite(sprite, x, y, w, h) {
      var _a, _b;
      const iw = (_a = sprite == null ? void 0 : sprite.width) != null ? _a : 0;
      const ih = (_b = sprite == null ? void 0 : sprite.height) != null ? _b : 0;
      if (!sprite || iw <= 0 || ih <= 0) {
        return;
      }
      const k = Math.max(w / iw, h / ih) * 1.08;
      const dw = iw * k;
      const dh = ih * k;
      const dx = x + (w - dw) / 2;
      const dy = y + h - dh + h * 0.03;
      this.ctx.drawImage(sprite, dx, dy, dw, dh);
    }
    getDisplayCloud(board, row, col) {
      var _a, _b;
      return this.getDisplayCoverLayers(
        (_b = this.animCloudStart) != null ? _b : (_a = this.pendingPlayback) == null ? void 0 : _a.cloud,
        board.getCloud(row, col),
        row * board.size.cols + col,
        "chippedCloudIndices"
      );
    }
    getDisplayIce(board, row, col) {
      var _a, _b;
      return this.getDisplayCoverLayers(
        (_b = this.animIceStart) != null ? _b : (_a = this.pendingPlayback) == null ? void 0 : _a.ice,
        board.getIce(row, col),
        row * board.size.cols + col,
        "clearedIndices"
      );
    }
    getDisplayEgg(board, row, col) {
      var _a, _b;
      return this.getDisplayCoverLayers(
        (_b = this.animEggStart) != null ? _b : (_a = this.pendingPlayback) == null ? void 0 : _a.egg,
        board.getEgg(row, col),
        row * board.size.cols + col,
        "chippedEggIndices"
      );
    }
    getDisplayVine(board, row, col) {
      var _a, _b;
      return this.getDisplayCoverLayers(
        (_b = this.animVineStart) != null ? _b : (_a = this.pendingPlayback) == null ? void 0 : _a.vine,
        board.getVine(row, col),
        row * board.size.cols + col,
        "chippedVineIndices"
      );
    }
    getDisplayCoverLayers(snapshot, live, index, chipKey) {
      var _a, _b, _c, _d;
      if (!snapshot) {
        return live;
      }
      let layers = (_a = snapshot[index]) != null ? _a : 0;
      if (!this.animator.isPlaying()) {
        return layers;
      }
      const done = this.animator.getClearedWaveCount();
      const waves = this.animCloudWaves.length > 0 ? this.animCloudWaves : (_c = (_b = this.pendingPlayback) == null ? void 0 : _b.waves) != null ? _c : [];
      for (let w = 0; w < done; w += 1) {
        const hits = (_d = waves[w]) == null ? void 0 : _d[chipKey];
        if (hits && hits.includes(index)) {
          layers = Math.max(0, layers - 1);
        }
      }
      return layers;
    }
    drawCloudOverlays(board, layout) {
      var _a, _b;
      const { ctx } = this;
      const cs = layout.cellSize;
      const slotR = Math.max(6, Math.floor(cs * 0.18));
      const cloudy = [];
      const keyOf = (r, c) => r * board.size.cols + c;
      const layerAt = /* @__PURE__ */ new Map();
      for (let r = 0; r < board.size.rows; r += 1) {
        for (let c = 0; c < board.size.cols; c += 1) {
          const layers = this.getDisplayCloud(board, r, c);
          if (layers > 0) {
            cloudy.push({ r, c, layers });
            layerAt.set(keyOf(r, c), layers);
          }
        }
      }
      if (cloudy.length === 0) {
        return;
      }
      const cloudyAt = (row, col) => layerAt.has(keyOf(row, col));
      const visited = /* @__PURE__ */ new Set();
      const blobs = [];
      for (const seed of cloudy) {
        const sk = keyOf(seed.r, seed.c);
        if (visited.has(sk)) {
          continue;
        }
        const blob = [];
        const queue = [seed];
        visited.add(sk);
        while (queue.length > 0) {
          const cur = queue.pop();
          blob.push(cur);
          const nbs = [
            [cur.r + 1, cur.c],
            [cur.r - 1, cur.c],
            [cur.r, cur.c + 1],
            [cur.r, cur.c - 1]
          ];
          for (const [nr, nc] of nbs) {
            const nk = keyOf(nr, nc);
            if (visited.has(nk) || !layerAt.has(nk)) {
              continue;
            }
            visited.add(nk);
            queue.push({ r: nr, c: nc, layers: layerAt.get(nk) });
          }
        }
        blobs.push(blob);
      }
      const join = Math.max(6, Math.ceil(cs * 0.22));
      const corner = Math.max(6, slotR * 0.7);
      for (const blob of blobs) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        ctx.save();
        ctx.beginPath();
        for (const cell of blob) {
          let x = layout.originX + cell.c * cs;
          let y = layout.originY - (cell.r + 1) * cs;
          let w = cs;
          let h = cs;
          if (cloudyAt(cell.r, cell.c - 1)) {
            x -= join;
            w += join;
          }
          if (cloudyAt(cell.r, cell.c + 1)) {
            w += join;
          }
          if (cloudyAt(cell.r + 1, cell.c)) {
            y -= join;
            h += join;
          }
          if (cloudyAt(cell.r - 1, cell.c)) {
            h += join;
          }
          this.appendRoundRectPath(x, y, w, h, corner);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        }
        ctx.clip();
        const wornBlob = blob.every((cell) => cell.layers <= 1);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const span = Math.max(maxX - minX, maxY - minY);
        const sheet = ctx.createRadialGradient(midX, midY - span * 0.08, span * 0.05, midX, midY, span * 0.72);
        if (wornBlob) {
          sheet.addColorStop(0, "rgba(255,255,255,0.5)");
          sheet.addColorStop(0.55, "rgba(234,242,250,0.32)");
          sheet.addColorStop(1, "rgba(214,226,240,0.1)");
        } else {
          sheet.addColorStop(0, "rgba(255,255,255,0.82)");
          sheet.addColorStop(0.5, "rgba(238,246,252,0.62)");
          sheet.addColorStop(1, "rgba(216,228,242,0.2)");
        }
        ctx.fillStyle = sheet;
        ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
        for (const cell of blob) {
          const cx = layout.originX + (cell.c + 0.5) * cs;
          const cy = layout.originY - (cell.r + 0.5) * cs;
          this.drawThickCotton(cx, cy, cs * 1.12, cell.r, cell.c, cell.layers);
          if (cloudyAt(cell.r, cell.c + 1)) {
            this.drawThickCotton(
              cx + cs * 0.5,
              cy,
              cs * 0.88,
              cell.r,
              cell.c + 17,
              Math.min(cell.layers, (_a = layerAt.get(keyOf(cell.r, cell.c + 1))) != null ? _a : cell.layers)
            );
          }
          if (cloudyAt(cell.r + 1, cell.c)) {
            this.drawThickCotton(
              cx,
              cy - cs * 0.5,
              cs * 0.88,
              cell.r + 17,
              cell.c,
              Math.min(cell.layers, (_b = layerAt.get(keyOf(cell.r + 1, cell.c))) != null ? _b : cell.layers)
            );
          }
        }
        ctx.restore();
      }
    }
    /** 往当前 path 追加圆角矩形子路径（不 beginPath），用于棉花并集裁剪。 */
    appendRoundRectPath(x, y, w, h, r) {
      const { ctx } = this;
      const width = Math.max(0, w);
      const height = Math.max(0, h);
      if (width <= 0 || height <= 0) {
        return;
      }
      const rr = Math.max(0, Math.min(r, width / 2, height / 2));
      if (rr <= 0) {
        ctx.rect(x, y, width, height);
        return;
      }
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + width - rr, y);
      ctx.arc(x + width - rr, y + rr, rr, -Math.PI / 2, 0);
      ctx.lineTo(x + width, y + height - rr);
      ctx.arc(x + width - rr, y + height - rr, rr, 0, Math.PI / 2);
      ctx.lineTo(x + rr, y + height);
      ctx.arc(x + rr, y + height - rr, rr, Math.PI / 2, Math.PI);
      ctx.lineTo(x, y + rr);
      ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
      ctx.closePath();
    }
    drawThickCotton(cx, cy, s, row, col, layers = 2) {
      const { ctx } = this;
      const worn = layers <= 1;
      ctx.save();
      ctx.globalAlpha = worn ? 0.52 : 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const core = ctx.createRadialGradient(
        cx - s * 0.12,
        cy - s * 0.18,
        s * 0.06,
        cx,
        cy,
        s * 0.5
      );
      core.addColorStop(0, worn ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.92)");
      core.addColorStop(0.5, worn ? "rgba(236,244,252,0.34)" : "rgba(232,242,252,0.55)");
      core.addColorStop(1, "rgba(200,214,232,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      const pastels = [
        [255, 246, 250],
        [234, 246, 255],
        [236, 252, 244],
        [246, 238, 255],
        [255, 250, 236],
        [240, 248, 255]
      ];
      const puffCount = worn ? 5 : 7;
      for (let i = 0; i < puffCount; i += 1) {
        const u = this.cottonHash(row, col, i);
        const v = this.cottonHash(row, col, i + 18);
        const w = this.cottonHash(row, col, i + 36);
        const px = cx + (u - 0.5) * s * 0.52;
        const py = cy + (v - 0.5) * s * 0.5;
        const pr = s * (0.2 + w * 0.17);
        const [pr_, pg, pb] = pastels[i % pastels.length];
        const hx = px - pr * 0.32;
        const hy = py - pr * 0.38;
        const g = ctx.createRadialGradient(hx, hy, pr * 0.06, px + pr * 0.08, py + pr * 0.18, pr);
        g.addColorStop(0, `rgba(255,255,255,${worn ? 0.88 : 1})`);
        g.addColorStop(
          0.42,
          `rgba(${pr_}, ${pg}, ${pb}, ${worn ? 0.72 : 0.94})`
        );
        g.addColorStop(
          0.82,
          `rgba(${Math.max(180, pr_ - 36)}, ${Math.max(190, pg - 28)}, ${Math.max(205, pb - 18)}, ${worn ? 0.28 : 0.48})`
        );
        g.addColorStop(1, "rgba(186, 200, 218, 0.02)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        if (!worn || i % 2 === 0) {
          ctx.fillStyle = `rgba(255,255,255,${worn ? 0.45 : 0.7})`;
          ctx.beginPath();
          ctx.arc(hx + pr * 0.08, hy + pr * 0.1, pr * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const fiber = worn ? 3 : 5;
      for (let i = 0; i < fiber; i += 1) {
        const u = this.cottonHash(row, col, i + 80);
        const v = this.cottonHash(row, col, i + 102);
        const ang = u * Math.PI * 2;
        const len = s * (0.1 + v * 0.16);
        const ox = cx + (u - 0.5) * s * 0.42;
        const oy = cy + (v - 0.5) * s * 0.42;
        ctx.strokeStyle = `rgba(255,255,255,${worn ? 0.35 : 0.55})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(ox, oy, len, ang - 0.55, ang + 0.55);
        ctx.stroke();
      }
      const dots = worn ? 3 : 6;
      for (let i = 0; i < dots; i += 1) {
        const u = this.cottonHash(row, col, i + 280);
        const v = this.cottonHash(row, col, i + 300);
        const dr = 0.9 + this.cottonHash(row, col, i + 320) * 1.4;
        ctx.fillStyle = `rgba(255,255,255,${worn ? 0.5 : 0.78})`;
        ctx.beginPath();
        ctx.arc(
          cx + (u - 0.5) * s * 0.58,
          cy + (v - 0.5) * s * 0.58,
          dr,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
    }
    cottonHash(row, col, salt) {
      const n = Math.sin(row * 12.9898 + col * 78.233 + salt * 37.719) * 43758.5453;
      return n - Math.floor(n);
    }
    drawEggAndVineOverlays(board, layout) {
      const cs = layout.cellSize;
      for (let r = 0; r < board.size.rows; r += 1) {
        for (let c = 0; c < board.size.cols; c += 1) {
          const x = layout.originX + c * cs;
          const y = layout.originY - (r + 1) * cs;
          const egg = this.getDisplayEgg(board, r, c);
          if (egg > 0) {
            this.drawEggShell(x, y, cs, egg);
          }
          const vine = this.getDisplayVine(board, r, c);
          if (vine > 0) {
            this.drawVineWrap(x, y, cs, vine, r, c, board);
          }
        }
      }
    }
    drawEggShell(x, y, s, layers) {
      const { ctx } = this;
      const cx = x + s * 0.5;
      const cy = y + s * 0.52;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(0.92, 1.14);
      ctx.fillStyle = layers > 1 ? "#fff4d6" : "#ffe8b0";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(212, 168, 80, 0.95)";
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(-s * 0.1, -s * 0.1, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      if (layers <= 1) {
        ctx.strokeStyle = "rgba(120, 80, 30, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-s * 0.08, -s * 0.22);
        ctx.lineTo(-s * 0.02, -s * 0.04);
        ctx.lineTo(-s * 0.12, s * 0.12);
        ctx.moveTo(s * 0.1, -s * 0.18);
        ctx.lineTo(s * 0.04, s * 0.02);
        ctx.stroke();
        ctx.fillStyle = "#f4c430";
        ctx.beginPath();
        ctx.arc(0, s * 0.08, s * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3d3d3d";
        ctx.beginPath();
        ctx.arc(-s * 0.04, s * 0.06, s * 0.018, 0, Math.PI * 2);
        ctx.arc(s * 0.04, s * 0.06, s * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    drawVineWrap(x, y, s, layers, row, col, board) {
      const { ctx } = this;
      const cx = x + s * 0.5;
      const cy = y + s * 0.5;
      const thick = layers > 1;
      const h = (salt) => this.cottonHash(row, col, salt);
      const palette = thick ? ["#14532d", "#1b4332", "#166534", "#1e5631"] : ["#1b4332", "#2d6a4f", "#14532d", "#1e5631"];
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const rings = thick ? 2 : 1;
      for (let ring = 0; ring < rings; ring += 1) {
        const pad = s * (ring === 0 ? 0.2 : 0.28);
        const box = s - pad * 2;
        const x0 = x + pad;
        const y0 = y + pad;
        const radius = box * 0.28;
        this.roundRectPath(x0, y0, box, box, radius);
        ctx.fillStyle = thick ? "rgba(20, 64, 40, 0.08)" : "rgba(27, 67, 50, 0.06)";
        ctx.fill();
        const count = 8;
        const len = s * (ring === 0 ? 0.155 : 0.12);
        const wid = s * (ring === 0 ? 0.07 : 0.055);
        for (let i = 0; i < count; i += 1) {
          const p = this.sampleRoundRect(x0, y0, box, box, radius, (i + 0.5) / count);
          const flip = (i % 2 === 0 ? 0.08 : -0.08) + (h(16 + ring * 8 + i) - 0.5) * 0.06;
          this.drawRoseLeaf(
            p.x,
            p.y,
            len * (0.95 + h(50 + i) * 0.08),
            wid,
            p.ang + flip,
            palette[(i + ring) % palette.length]
          );
        }
      }
      const links = [];
      if (col + 1 < board.size.cols && this.getDisplayVine(board, row, col + 1) > 0) {
        links.push({ tx: x + s, ty: cy + (h(7) - 0.5) * s * 0.04 });
      }
      if (row + 1 < board.size.rows && this.getDisplayVine(board, row + 1, col) > 0) {
        links.push({ tx: cx + (h(8) - 0.5) * s * 0.04, ty: y });
      }
      const beads = 2;
      for (const link of links) {
        for (let i = 1; i <= beads; i += 1) {
          const t = i / (beads + 1);
          const lx = cx + (link.tx - cx) * t;
          const ly = cy + (link.ty - cy) * t;
          const ang = Math.atan2(link.ty - cy, link.tx - cx) + Math.PI * 0.5 + (i % 2 === 0 ? 0.16 : -0.16);
          this.drawRoseLeaf(lx, ly, s * 0.12, s * 0.052, ang, palette[i % palette.length]);
        }
      }
      ctx.restore();
    }
    sampleRoundRect(x, y, w, h, r, t) {
      const rr = Math.min(r, w * 0.5, h * 0.5);
      const straightW = Math.max(0, w - rr * 2);
      const straightH = Math.max(0, h - rr * 2);
      const arc = Math.PI * 0.5 * rr;
      const perim = straightW * 2 + straightH * 2 + arc * 4;
      let d = (t % 1 + 1) % 1 * perim;
      if (d <= straightW) {
        return { x: x + rr + d, y, ang: 0 };
      }
      d -= straightW;
      if (d <= arc) {
        const a2 = -Math.PI * 0.5 + d / arc * (Math.PI * 0.5);
        return { x: x + w - rr + Math.cos(a2) * rr, y: y + rr + Math.sin(a2) * rr, ang: a2 + Math.PI * 0.5 };
      }
      d -= arc;
      if (d <= straightH) {
        return { x: x + w, y: y + rr + d, ang: Math.PI * 0.5 };
      }
      d -= straightH;
      if (d <= arc) {
        const a2 = d / arc * (Math.PI * 0.5);
        return { x: x + w - rr + Math.cos(a2) * rr, y: y + h - rr + Math.sin(a2) * rr, ang: a2 + Math.PI * 0.5 };
      }
      d -= arc;
      if (d <= straightW) {
        return { x: x + w - rr - d, y: y + h, ang: Math.PI };
      }
      d -= straightW;
      if (d <= arc) {
        const a2 = Math.PI * 0.5 + d / arc * (Math.PI * 0.5);
        return { x: x + rr + Math.cos(a2) * rr, y: y + h - rr + Math.sin(a2) * rr, ang: a2 + Math.PI * 0.5 };
      }
      d -= arc;
      if (d <= straightH) {
        return { x, y: y + h - rr - d, ang: -Math.PI * 0.5 };
      }
      d -= straightH;
      const a = Math.PI + d / Math.max(arc, 1e-4) * (Math.PI * 0.5);
      return { x: x + rr + Math.cos(a) * rr, y: y + rr + Math.sin(a) * rr, ang: a + Math.PI * 0.5 };
    }
    /** 卡通圆润叶，沿圆角方框包裹小动物。 */
    drawRoseLeaf(x, y, len, wid, ang, color) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(10, 36, 22, 0.7)";
      ctx.lineWidth = Math.max(1, wid * 0.14);
      ctx.beginPath();
      ctx.moveTo(0, wid * 0.12);
      ctx.bezierCurveTo(wid * 1.15, -len * 0.18, wid * 0.95, -len * 0.62, 0, -len);
      ctx.bezierCurveTo(-wid * 0.95, -len * 0.62, -wid * 1.15, -len * 0.18, 0, wid * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(200, 230, 190, 0.16)";
      this.fillEllipse(wid * 0.12, -len * 0.4, wid * 0.22, len * 0.18, -0.15);
      ctx.strokeStyle = "rgba(186, 220, 170, 0.2)";
      ctx.lineWidth = Math.max(0.6, wid * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.08);
      ctx.quadraticCurveTo(wid * 0.06, -len * 0.45, 0, -len * 0.78);
      ctx.stroke();
      ctx.restore();
    }
    drawAnimatedTiles(layout) {
      const visuals = this.animator.getVisualTiles();
      const now = this.nowMs || Date.now();
      for (const tile of visuals) {
        if (tile.kind === 0 /* Empty */ || tile.kind === 8 /* Hole */) {
          continue;
        }
        const size = layout.cellSize * tile.scale;
        const cx = layout.originX + tile.col * layout.cellSize + layout.cellSize * 0.5;
        const cy = layout.originY - (tile.displayRow + 0.5) * layout.cellSize;
        this.drawTileAt(
          cx - size * 0.5,
          cy - size * 0.5,
          size,
          tile.kind,
          tile.alpha,
          tile.scale,
          tile.sparkle,
          now
        );
      }
    }
    drawTileAt(x, y, cellSize, kind, alpha, scale, sparkle = false, nowMs = Date.now()) {
      var _a;
      if (kind === 0 /* Empty */ || kind === 8 /* Hole */) {
        return;
      }
      const { ctx } = this;
      const pad = Math.max(1, Math.floor(cellSize * 0.02));
      const size = cellSize - pad * 2;
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (scale !== 1) {
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
      }
      if (kind === 7 /* ColorBomb */) {
        this.drawOwlAura(cx, cy, size, nowMs, alpha);
      }
      if (sparkle) {
        this.drawSparkleGlowBehind(cx, cy, size, nowMs, alpha);
      }
      const sprite = this.tileImages.get(kind);
      if (sprite) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.16;
        ctx.fillStyle = "#6b4a32";
        ctx.translate(cx, cy + size * 0.34);
        ctx.scale(1, 0.35);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = alpha;
        this.drawTileSprite(sprite, x + pad, y + pad, size);
      } else if (kind === 7 /* ColorBomb */) {
        this.drawSuperOwlTile(cx, cy, size);
      } else {
        ctx.fillStyle = (_a = TILE_FALLBACK_COLORS[kind]) != null ? _a : "#666";
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sparkle) {
        this.drawSparkleGlowFront(cx, cy, size, nowMs, alpha);
      }
      ctx.restore();
    }
    /** 猫头鹰特殊块柔光（不抢贴图主体） */
    drawOwlAura(cx, cy, size, nowMs, alpha) {
      const { ctx } = this;
      const pulse = 0.7 + 0.3 * Math.sin(nowMs * 0.01);
      const r = size * (0.58 + 0.04 * pulse);
      ctx.save();
      ctx.globalAlpha = alpha * 0.55 * pulse;
      const glow = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, r);
      glow.addColorStop(0, "rgba(200, 180, 255, 0.55)");
      glow.addColorStop(0.45, "rgba(120, 220, 255, 0.28)");
      glow.addColorStop(1, "rgba(100, 255, 200, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    /** 闪光块背后：金光脉冲晕 */
    drawSparkleGlowBehind(cx, cy, size, nowMs, alpha) {
      const { ctx } = this;
      const pulse = 0.65 + 0.35 * Math.sin(nowMs * 0.028);
      const glowR = size * (0.7 + 0.1 * pulse);
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = "rgba(255, 220, 80, 0.42)";
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    /** 闪光块前景：亮环 + 闪点 */
    drawSparkleGlowFront(cx, cy, size, nowMs, alpha) {
      const { ctx } = this;
      const ringPulse = 0.55 + 0.45 * Math.sin(nowMs * 0.04);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgba(255, 245, 160, ${0.85 * ringPulse})`;
      ctx.lineWidth = Math.max(2.4, size * 0.07);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      const twinkle = 0.5 + 0.5 * Math.abs(Math.sin(nowMs * 0.036));
      this.drawSparkleStar(cx - size * 0.28, cy - size * 0.3, size * 0.14 * twinkle, twinkle);
      this.drawSparkleStar(cx + size * 0.3, cy - size * 0.16, size * 0.1 * twinkle, twinkle);
      ctx.restore();
    }
    /** 十字四角星闪光 */
    drawSparkleStar(x, y, r, intensity) {
      const { ctx } = this;
      ctx.save();
      ctx.globalAlpha = Math.min(1, 0.55 + 0.45 * intensity);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
      glow.addColorStop(0, "rgba(255, 255, 255, 1)");
      glow.addColorStop(0.35, "rgba(255, 240, 150, 0.75)");
      glow.addColorStop(1, "rgba(255, 200, 80, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      const tip = r;
      const mid = r * 0.22;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x, y - tip);
      ctx.lineTo(x + mid, y - mid);
      ctx.lineTo(x + tip, y);
      ctx.lineTo(x + mid, y + mid);
      ctx.lineTo(x, y + tip);
      ctx.lineTo(x - mid, y + mid);
      ctx.lineTo(x - tip, y);
      ctx.lineTo(x - mid, y - mid);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 220, 0.95)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.2, r * 0.18), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    /** 五连合成：超级猫头鹰（魔力鸟） */
    drawSuperOwlTile(cx, cy, size) {
      const { ctx } = this;
      const r = size * 0.44;
      const ring = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
      ring.addColorStop(0, "#a29bfe");
      ring.addColorStop(0.5, "#74b9ff");
      ring.addColorStop(1, "#55efc4");
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, size * 0.05);
      ctx.stroke();
      ctx.fillStyle = "#6c5ce7";
      ctx.beginPath();
      ctx.arc(cx, cy + size * 0.02, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a29bfe";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy - r * 0.35);
      ctx.lineTo(cx - r * 0.72, cy - r * 0.85);
      ctx.lineTo(cx - r * 0.15, cy - r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.45, cy - r * 0.35);
      ctx.lineTo(cx + r * 0.72, cy - r * 0.85);
      ctx.lineTo(cx + r * 0.15, cy - r * 0.55);
      ctx.closePath();
      ctx.fill();
      const eyeY = cy - size * 0.02;
      const eyeDx = r * 0.28;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx - eyeDx, eyeY, size * 0.11, 0, Math.PI * 2);
      ctx.arc(cx + eyeDx, eyeY, size * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2d3436";
      ctx.beginPath();
      ctx.arc(cx - eyeDx, eyeY, size * 0.055, 0, Math.PI * 2);
      ctx.arc(cx + eyeDx, eyeY, size * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fdcb6e";
      ctx.beginPath();
      ctx.moveTo(cx, cy + size * 0.02);
      ctx.lineTo(cx - size * 0.07, cy + size * 0.14);
      ctx.lineTo(cx + size * 0.07, cy + size * 0.14);
      ctx.closePath();
      ctx.fill();
    }
    drawSelectionRing(x, y, cellSize, nowMs = Date.now(), pressing = false) {
      const { ctx } = this;
      const pad = Math.max(2, Math.floor(cellSize * 0.04));
      const size = cellSize - pad * 2;
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const pulse = 0.52 + 0.06 * Math.sin(nowMs * 0.016);
      const radius = size * (pressing ? pulse + 0.05 : pulse);
      ctx.save();
      ctx.globalAlpha = pressing ? 0.5 : 0.36;
      ctx.fillStyle = "#ff8fc8";
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      const dashAlpha = 0.55 + 0.25 * Math.sin(nowMs * 0.02);
      ctx.strokeStyle = `rgba(255, 230, 120, ${dashAlpha})`;
      ctx.lineWidth = 2.2;
      const outerR = radius + 10;
      const start = nowMs * 4e-3;
      for (let i = 0; i < 10; i += 1) {
        const a0 = start + i / 10 * Math.PI * 2;
        const a1 = a0 + Math.PI * 0.08;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, a0, a1);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = pressing ? 4.5 : 3.8;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ff4fa3";
      ctx.lineWidth = pressing ? 2.8 : 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      this.drawSparkleStar(cx + radius * 0.72, cy - radius * 0.55, 3.5, 0.85);
    }
    /** 粉碎爆炸扩散圈 + 飘分 + 火花 */
    drawCrushOverlays() {
      const board = this.session.getBoard();
      if (!board) {
        return;
      }
      const layout = this.computeBoardLayout(board);
      const { ctx } = this;
      const now = this.nowMs || Date.now();
      for (const burst of this.crushBursts) {
        const t = Math.min(1, (now - burst.startMs) / burst.durationMs);
        const cx = layout.originX + (burst.col + 0.5) * layout.cellSize;
        const cy = layout.originY - (burst.row + 0.5) * layout.cellSize;
        const maxR = (burst.radius + 1.1) * layout.cellSize;
        const r = maxR * (0.25 + t * 0.85);
        const alpha = (1 - t) * 0.85;
        for (const cell of burst.clearedCells) {
          const px = layout.originX + cell.col * layout.cellSize;
          const py = layout.originY - (cell.row + 1) * layout.cellSize;
          const flash = Math.max(0, 1 - t * 1.6);
          if (flash <= 0) {
            continue;
          }
          ctx.save();
          ctx.globalAlpha = flash * 0.75;
          ctx.fillStyle = "#fff6c8";
          ctx.fillRect(px + 2, py + 2, layout.cellSize - 4, layout.cellSize - 4);
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, "rgba(255, 255, 220, 1)");
        grad.addColorStop(0.28, "rgba(255, 180, 90, 0.75)");
        grad.addColorStop(0.55, "rgba(255, 110, 170, 0.45)");
        grad.addColorStop(1, "rgba(255, 40, 80, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,140,200,${0.9 * (1 - t)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.95 * (1 - t)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - t) * 0.95;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, layout.cellSize * 0.2 * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
        if (t < 0.45) {
          this.drawSparkleStar(cx, cy, layout.cellSize * 0.22 * (1 - t), 1);
        }
        ctx.restore();
      }
      for (const spark of this.crushSparks) {
        this.drawJuiceSpark(spark, now, 60);
      }
      for (const pop of this.floatingScores) {
        this.drawFloatingScorePop(pop, now, 46);
      }
    }
    /** 对局消除特效层：火花 + 飘分（复用粉碎粒子池） */
    drawMatchJuiceOverlays() {
      const now = this.nowMs || Date.now();
      for (const spark of this.crushSparks) {
        this.drawJuiceSpark(spark, now, 70);
      }
      for (const pop of this.floatingScores) {
        this.drawFloatingScorePop(pop, now, 52);
      }
    }
    drawJuiceSpark(spark, now, gravity) {
      var _a;
      const { ctx } = this;
      const t = Math.min(1, (now - spark.startMs) / spark.durationMs);
      const life = now - spark.startMs;
      const x = spark.x + spark.vx * (life / 1e3);
      const y = spark.y + spark.vy * (life / 1e3) + gravity * (life / 1e3) * (life / 1e3);
      const style = (_a = spark.style) != null ? _a : "dot";
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.96;
      ctx.fillStyle = spark.color;
      if (style === "star") {
        this.drawSparkleStar(x, y, 3.2 + (1 - t) * 3.2, 1 - t);
      } else if (style === "streak") {
        const len = 6 + (1 - t) * 10;
        const ang = Math.atan2(spark.vy, spark.vx);
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillRect(-len * 0.2, -1.4, len, 2.8);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 2.8 + (1 - t) * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    drawFloatingScorePop(pop, now, rise) {
      const { ctx } = this;
      const t = Math.min(1, (now - pop.startMs) / pop.durationMs);
      const y = pop.y - t * rise;
      const scale = 1 + Math.sin(Math.min(1, t * 3.2) * Math.PI) * 0.34;
      ctx.save();
      ctx.globalAlpha = 1 - t * t;
      ctx.translate(pop.x, y);
      ctx.scale(scale, scale);
      ctx.font = pop.fontSize ? `bold ${pop.fontSize}px sans-serif` : pop.text.startsWith("+") ? "bold 26px sans-serif" : "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(40,20,50,0.92)";
      ctx.lineWidth = pop.fontSize ? 7 : 4.5;
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, 0, 0);
      ctx.restore();
    }
    /** 首次点击前的引导条 */
    drawCrushGuide() {
      if (this.crushHasTapped) {
        return;
      }
      const { ctx, width } = this;
      const now = this.nowMs || Date.now();
      const pulse = 0.65 + Math.sin(now * 8e-3) * 0.35;
      const y = this.getHudBottom() + 6;
      const w = Math.min(300, width - 32);
      const x = (width - w) / 2;
      const h = 34;
      ctx.save();
      ctx.globalAlpha = 0.6 + pulse * 0.4;
      const fill2 = this.mode === "clean" ? "rgba(51, 154, 240, 0.94)" : "rgba(255, 90, 120, 0.94)";
      this.drawHudPill(x, y, w, h, fill2, "#ffffff");
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(80,20,40,0.35)";
      ctx.lineWidth = 3;
      const tip = this.mode === "clean" ? "\u2728 \u70B9\u683C\u5B50\u6E05\u626B\u5C0F\u52A8\u7269\uFF01" : "\u2728 \u70B9\u683C\u5B50\u7C89\u788E\u52A8\u7269\u62FF\u52A0\u5206\uFF01";
      ctx.strokeText(tip, width / 2, y + h / 2);
      ctx.fillText(tip, width / 2, y + h / 2);
      ctx.restore();
    }
    /** 粉碎底部操作：加时 / 领取结算 */
    drawCrushChrome() {
      const { width, height } = this;
      const nav = this.getNavChipFrame();
      const y = height - 72;
      const gap = 10;
      const left = nav.x + nav.w + 8;
      const right = width - 16;
      const btnW = Math.min(150, Math.max(88, (right - left - gap) / 2));
      const x0 = left;
      const extendBtn = {
        id: "crush_extend",
        x: x0,
        y,
        w: btnW,
        h: 44,
        label: "\u770B\u5E7F\u544A+5\u79D2"
      };
      const skipBtn = {
        id: "crush_skip",
        x: x0 + btnW + gap,
        y,
        w: btnW,
        h: 44,
        label: "\u9886\u53D6\u5956\u52B1"
      };
      this.buttons.push(extendBtn, skipBtn);
      this.drawCuteButton(extendBtn, {
        top: "#66d9e8",
        bottom: "#1098ad",
        border: "#ffffff",
        gloss: true
      });
      this.drawCuteButton(skipBtn, {
        top: "#74c0fc",
        bottom: "#1c7ed6",
        border: "#ffffff",
        gloss: true
      });
    }
    /** 清洁模式底部：结束清洁 */
    drawCleanChrome() {
      const { width, height } = this;
      const btn = {
        id: "clean_skip",
        x: width / 2 - 100,
        y: height - 72,
        w: 200,
        h: 44,
        label: "\u7ED3\u675F\u6E05\u6D01"
      };
      this.buttons.push(btn);
      this.drawCuteButton(btn, {
        top: "#74c0fc",
        bottom: "#339af0",
        border: "#ffffff",
        gloss: true
      });
    }
    loadTileImage(kind, src) {
      return new Promise((resolve) => {
        const img = this.createImage();
        if (!img) {
          console.warn("[crush-crush] createImage unavailable, fallback colors");
          resolve();
          return;
        }
        let settled = false;
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve();
        };
        const timer = setTimeout(() => {
          console.warn("[crush-crush] tile load timeout", src);
          finish();
        }, 8e3);
        img.onload = () => {
          clearTimeout(timer);
          this.tileImages.set(kind, img);
          finish();
        };
        img.onerror = () => {
          clearTimeout(timer);
          console.warn("[crush-crush] failed to load tile", src);
          finish();
        };
        img.src = src;
      });
    }
    loadBgImage(src) {
      return new Promise((resolve) => {
        const img = this.createImage();
        if (!img) {
          resolve(null);
          return;
        }
        let settled = false;
        const finish = (value) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
        };
        const timer = setTimeout(() => {
          console.warn("[crush-crush] bg load timeout", src);
          finish(null);
        }, 8e3);
        img.onload = () => {
          clearTimeout(timer);
          finish(img);
        };
        img.onerror = () => {
          clearTimeout(timer);
          console.warn("[crush-crush] failed to load bg", src);
          finish(null);
        };
        img.src = src;
      });
    }
    createImage() {
      if (typeof wx.createImage === "function") {
        return wx.createImage();
      }
      const canvasImg = this.canvas;
      if (typeof canvasImg.createImage === "function") {
        return canvasImg.createImage();
      }
      return null;
    }
    drawResultOverlay() {
      const { ctx, width, height } = this;
      const now = this.nowMs || Date.now();
      const anim = this.resultFx.getLayout(now);
      const isFail = this.pendingResult === "failed" || this.session.fsm.getCurrent() === "LevelFailed";
      drawResultSceneBackdrop(ctx, width, height, {
        veilAlpha: anim.veilAlpha,
        tone: "pink",
        isFail
      });
      this.resultFx.drawParticles(ctx, now);
      if (!isFail && anim.flash > 0.01) {
        ctx.save();
        ctx.globalAlpha = anim.flash;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      if (!isFail && this.winCelebrate) {
        this.drawWinCelebrateResult(anim, now);
        return;
      }
      const title = isFail ? "\u5DEE\u4E00\u70B9\u70B9" : "\u5173\u5361\u80DC\u5229";
      const panelW = 280;
      const crushBonus = this.session.getCrushScore();
      const panelH = !isFail && crushBonus > 0 ? 118 : isFail ? 118 : 100;
      const panelCx = width / 2;
      const panelCy = height * 0.36;
      ctx.save();
      ctx.globalAlpha = anim.panelAlpha;
      ctx.translate(panelCx, panelCy);
      ctx.scale(anim.panelScale, anim.panelScale);
      if (!isFail && anim.glow > 0) {
        ctx.fillStyle = `rgba(255, 215, 120, ${0.22 * anim.glow})`;
        ctx.beginPath();
        ctx.arc(0, 0, 90 + anim.glow * 18, 0, Math.PI * 2);
        ctx.fill();
      }
      this.drawCuteCard(-panelW / 2, -panelH / 2, panelW, panelH, {
        radius: 24,
        fillTop: isFail ? "rgba(255,255,255,0.97)" : "rgba(180, 235, 120, 0.98)",
        fillBottom: isFail ? "rgba(232, 248, 255, 0.95)" : "rgba(120, 200, 70, 0.96)",
        border: isFail ? "#74c0fc" : "#7bc84a",
        borderWidth: 3,
        shadow: false,
        sparkle: !isFail,
        nowMs: now
      });
      ctx.save();
      ctx.scale(anim.titleScale, anim.titleScale);
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 5;
      ctx.strokeText(title, 0, -14);
      ctx.fillStyle = isFail ? "#1864ab" : "#2d6a1f";
      ctx.fillText(title, 0, -14);
      ctx.restore();
      ctx.font = "bold 17px sans-serif";
      ctx.fillStyle = isFail ? "#4dabf7" : "#3d5c2e";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.scale(anim.scorePunch, anim.scorePunch);
      ctx.fillText(`\u5F97\u5206 ${anim.displayScore}`, 0, 18);
      ctx.restore();
      if (isFail) {
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#339af0";
        ctx.fillText("\u6CA1\u5173\u7CFB\uFF0C\u518D\u8BD5\u4E00\u6B21\u5C31\u597D", 0, 42);
      }
      if (!isFail && crushBonus > 0) {
        const taps = this.lastCrushTapCount > 0 ? this.lastCrushTapCount : this.session.getCrushTapCount();
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#1f6b2a";
        ctx.fillText(`\u7C89\u788E\u52A0\u6210 +${crushBonus}`, 0, 36);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#3d6b2e";
        ctx.fillText(
          taps > 0 ? `\u4F60\u70B9\u51FB\u7C89\u788E\u4E86 ${taps} \u6B21` : "\u6536\u5C3E\u7206\u70B8\u8BA1\u5165\u52A0\u6210",
          0,
          54
        );
      }
      ctx.restore();
      if (!isFail) {
        ctx.save();
        ctx.globalAlpha = anim.panelAlpha;
        const starCy = panelCy - panelH / 2 - 6;
        this.drawResultStars(panelCx, starCy, 20, now);
        this.drawResultStarCaption(panelCx, starCy, 20);
        ctx.restore();
      }
      const revive = isFail ? this.session.getReviveOffer() : { allowed: false, movesGranted: 0 };
      const y0 = height * 0.5;
      const btns = [];
      if (!isFail && this.offerCleanPrompt) {
        this.drawCleanOfferButtons(anim, y0 - 8);
        return;
      }
      if (revive.allowed) {
        btns.push({
          id: "revive",
          x: width / 2 - 100,
          y: y0,
          w: 200,
          h: 44,
          label: `\u770B\u5E7F\u544A\u590D\u6D3B +${revive.movesGranted}\u6B65`
        });
      }
      if (!isFail && this.session.hasNextLevel()) {
        btns.push({
          id: "next",
          x: width / 2 - 100,
          y: y0 + (btns.length ? 56 : 0),
          w: 200,
          h: 44,
          label: "\u4E0B\u4E00\u5173"
        });
      }
      btns.push({
        id: "retry",
        x: width / 2 - 100,
        y: y0 + btns.length * 56,
        w: 200,
        h: 44,
        label: "\u518D\u8BD5\u4E00\u6B21"
      });
      btns.push({
        id: "lobby",
        x: width / 2 - 100,
        y: y0 + btns.length * 56,
        w: 200,
        h: 44,
        label: "\u56DE\u5927\u5385"
      });
      this.buttons = btns;
      for (let i = 0; i < btns.length; i += 1) {
        const b = btns[i];
        const stagger = clamp013((anim.buttonProgress - i * 0.12) / 0.55);
        const slide = (1 - easeOutBackLocal(stagger)) * 36;
        const palette = b.id === "revive" ? { top: "#74c0fc", bottom: "#1c7ed6", border: "#ffffff", gloss: true } : b.id === "next" ? { top: "#8ce99a", bottom: "#37b24d", border: "#ffffff", gloss: true } : b.id === "lobby" ? { top: "#d0ebff", bottom: "#74c0fc", border: "#ffffff", gloss: true } : { top: "#a5d8ff", bottom: "#339af0", border: "#ffffff", gloss: true };
        ctx.save();
        ctx.globalAlpha = stagger;
        this.drawCuteButton(
          { ...b, y: b.y + slide, h: Math.max(b.h, 50) },
          palette,
          0.92 + 0.08 * stagger
        );
        ctx.restore();
      }
      if (!isFail) {
        this.resultFx.drawParticles(ctx, now);
      }
    }
    /**
     * 闯关成功：统一弹窗（庆祝图 + 下方按钮同框）。
     */
    drawWinCelebrateResult(anim, now) {
      var _a;
      const { ctx } = this;
      const img = this.winCelebrate;
      if (!img) {
        return;
      }
      const panel = this.layoutWinCelebratePanel();
      const { card, image } = panel;
      const crushBonus = this.session.getCrushScore();
      const levelId = (_a = this.session.getLevelConfig()) == null ? void 0 : _a.id;
      ctx.save();
      ctx.globalAlpha = anim.panelAlpha * 0.24;
      ctx.fillStyle = "#5c3d6e";
      this.roundRectPath(card.x + 4, card.y + 8, card.w, card.h, 24);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = anim.panelAlpha;
      ctx.translate(card.cx, card.cy);
      ctx.scale(anim.panelScale, anim.panelScale);
      const lx = -card.w / 2;
      const ly = -card.h / 2;
      this.roundRectPath(lx, ly, card.w, card.h, 24);
      const cardGrad = ctx.createLinearGradient(0, ly, 0, ly + card.h);
      cardGrad.addColorStop(0, "rgba(255,255,255,0.98)");
      cardGrad.addColorStop(0.55, "rgba(255,248,255,0.97)");
      cardGrad.addColorStop(1, "rgba(255,236,245,0.98)");
      ctx.fillStyle = cardGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 170, 210, 0.95)";
      ctx.lineWidth = 3;
      ctx.stroke();
      const imgLx = -image.w / 2;
      const imgLy = ly + 6;
      const src = panel.source;
      ctx.save();
      ctx.beginPath();
      this.roundRectPath(imgLx, imgLy, image.w, image.h, 18);
      ctx.clip();
      ctx.drawImage(
        img,
        src.sx,
        src.sy,
        src.sw,
        src.sh,
        imgLx,
        imgLy,
        image.w,
        image.h
      );
      ctx.restore();
      const footY = imgLy + image.h + 2;
      const footH = card.h - (footY - ly) - 8;
      if (footH > 8) {
        const footGrad = ctx.createLinearGradient(0, footY, 0, footY + footH);
        footGrad.addColorStop(0, "rgba(255,255,255,0.15)");
        footGrad.addColorStop(1, "rgba(255,230,245,0.55)");
        ctx.fillStyle = footGrad;
        this.roundRectPath(lx + 8, footY, card.w - 16, footH, 14);
        ctx.fill();
      }
      ctx.restore();
      const bannerX = image.x + image.w * 0.5;
      const bannerY = image.y + image.h * WIN_BANNER_CY;
      ctx.save();
      ctx.globalAlpha = anim.panelAlpha;
      ctx.translate(bannerX, bannerY);
      ctx.scale(anim.titleScale, anim.titleScale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 22px sans-serif";
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 5;
      const title = levelId ? `\u7B2C ${levelId} \u5173\u80DC\u5229` : "\u5173\u5361\u80DC\u5229";
      ctx.strokeText(title, 0, -8);
      ctx.fillStyle = "#c2255c";
      ctx.fillText(title, 0, -8);
      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#a61e4d";
      ctx.save();
      ctx.scale(anim.scorePunch, anim.scorePunch);
      ctx.fillText(`\u5F97\u5206 ${anim.displayScore}`, 0, 12);
      ctx.restore();
      if (crushBonus > 0) {
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#d6336c";
        ctx.fillText(`\u7C89\u788E\u52A0\u6210 +${crushBonus}`, 0, 28);
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = anim.panelAlpha;
      const starSize = Math.min(22, card.w * 0.07);
      const starCy = card.y + 4;
      this.drawResultStars(card.cx, starCy, starSize, now);
      this.drawResultStarCaption(card.cx, starCy, starSize);
      ctx.restore();
      const actionTop = panel.actionTop;
      if (this.offerCleanPrompt) {
        this.drawCleanOfferButtons(anim, actionTop, card.w - 28);
        this.resultFx.drawParticles(ctx, now);
        return;
      }
      const btns = [];
      const primaryId = this.session.hasNextLevel() ? "next" : "lobby";
      const mainW = Math.min(200, card.w - 36);
      btns.push({
        id: primaryId,
        x: card.cx - mainW / 2,
        y: actionTop,
        w: mainW,
        h: 44,
        label: primaryId === "next" ? "\u4E0B\u4E00\u5173" : "\u56DE\u5927\u5385"
      });
      const subY = actionTop + 52;
      const subW = Math.min(128, (card.w - 40) / 2);
      btns.push({
        id: "retry",
        x: card.cx - subW - 5,
        y: subY,
        w: subW,
        h: 40,
        label: "\u91CD\u73A9\u672C\u5173"
      });
      if (primaryId === "next") {
        btns.push({
          id: "lobby",
          x: card.cx + 5,
          y: subY,
          w: subW,
          h: 40,
          label: "\u56DE\u5927\u5385"
        });
      }
      this.buttons = btns;
      for (let i = 0; i < btns.length; i += 1) {
        const b = btns[i];
        const stagger = clamp013((anim.buttonProgress - i * 0.1) / 0.55);
        const slide = (1 - easeOutBackLocal(stagger)) * 20;
        const palette = b.id === "next" ? { top: "#74c0fc", bottom: "#1c7ed6", border: "#ffffff", gloss: true } : b.id === "lobby" ? { top: "#d0ebff", bottom: "#74c0fc", border: "#ffffff", gloss: true } : { top: "#a5d8ff", bottom: "#339af0", border: "#ffffff", gloss: true };
        ctx.save();
        ctx.globalAlpha = stagger;
        this.drawCuteButton(
          { ...b, y: b.y + slide, h: Math.max(b.h, 44) },
          palette,
          0.94 + 0.06 * stagger
        );
        ctx.restore();
      }
      this.resultFx.drawParticles(ctx, now);
    }
    /** 统一弹窗布局：上图下按钮；庆祝图顶部空白已裁切 */
    layoutWinCelebratePanel() {
      const { width, height } = this;
      const img = this.winCelebrate;
      const iw = Math.max(1, img.width || 576);
      const ih = Math.max(1, img.height || 604);
      const sy = Math.floor(ih * WIN_CELEBRATE_CROP_TOP);
      const sh = Math.max(1, ih - sy);
      const sw = iw;
      const footerH = this.offerCleanPrompt ? 128 : 112;
      const pad = 6;
      const topPad = Math.max(this.statusBarHeight + 6, 48);
      const bottomPad = 24;
      const maxCardW = Math.min(width * 0.86, 328);
      const maxCardH = height - topPad - bottomPad;
      let imgW = maxCardW - pad * 2;
      let imgH = imgW / sw * sh;
      let cardW = maxCardW;
      let cardH = pad + imgH + footerH + pad;
      if (cardH > maxCardH) {
        const scale = maxCardH / cardH;
        imgW *= scale;
        imgH *= scale;
        cardW = Math.min(maxCardW, imgW + pad * 2);
        cardH = pad + imgH + footerH + pad;
      }
      const cardX = (width - cardW) / 2;
      const cardY = topPad + Math.max(0, (maxCardH - cardH) * 0.5);
      const imageX = cardX + (cardW - imgW) / 2;
      const imageY = cardY + pad;
      const actionTop = imageY + imgH + (this.offerCleanPrompt ? 10 : 14);
      return {
        card: {
          x: cardX,
          y: cardY,
          w: cardW,
          h: cardH,
          cx: cardX + cardW / 2,
          cy: cardY + cardH / 2
        },
        image: { x: imageX, y: imageY, w: imgW, h: imgH },
        source: { sx: 0, sy, sw, sh },
        actionTop
      };
    }
    drawCleanOfferButtons(anim, tipY, maxBtnW = 200) {
      const { ctx, width } = this;
      const btnW = Math.min(200, Math.max(160, maxBtnW));
      const btns = [];
      ctx.save();
      ctx.globalAlpha = anim.buttonProgress;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#2b4c7e";
      ctx.fillText("\u606D\u559C\u83B7\u5F97\u4E00\u6B21\u6E05\u6D01\u673A\u4F1A\uFF0C\u662F\u5426\u53BB\u6E05\u6D01\uFF1F", width / 2, tipY);
      ctx.restore();
      btns.push({
        id: "clean_yes",
        x: width / 2 - btnW / 2,
        y: tipY + 18,
        w: btnW,
        h: 42,
        label: "\u53BB\u6E05\u6D01"
      });
      btns.push({
        id: "clean_no",
        x: width / 2 - btnW / 2,
        y: tipY + 66,
        w: btnW,
        h: 42,
        label: "\u6682\u4E0D"
      });
      this.buttons = btns;
      for (let i = 0; i < btns.length; i += 1) {
        const b = btns[i];
        const stagger = clamp013((anim.buttonProgress - i * 0.12) / 0.55);
        const slide = (1 - easeOutBackLocal(stagger)) * 22;
        const palette = b.id === "clean_yes" ? { top: "#74c0fc", bottom: "#339af0", border: "#ffffff", gloss: true } : { top: "#ced4da", bottom: "#adb5bd", border: "#ffffff", gloss: true };
        ctx.save();
        ctx.globalAlpha = stagger;
        this.drawCuteButton(
          { ...b, y: b.y + slide, h: Math.max(b.h, 44) },
          palette,
          0.92 + 0.08 * stagger
        );
        ctx.restore();
      }
    }
    /**
     * 可爱圆角卡片：渐变填充 + 粗描边 + 高光 + 可选星点。
     */
    drawCuteCard(x, y, w, h, style) {
      var _a, _b;
      const { ctx } = this;
      const r = style.radius;
      if (style.shadow) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#6b4a8a";
        this.roundRectPath(x + 3, y + 6, w, h, r);
        ctx.fill();
        ctx.restore();
      }
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, style.fillTop);
      grad.addColorStop(1, style.fillBottom);
      ctx.fillStyle = grad;
      this.roundRectPath(x, y, w, h, r);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.55;
      const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.45);
      gloss.addColorStop(0, "rgba(255,255,255,0.95)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss;
      this.roundRectPath(x + 4, y + 3, w - 8, h * 0.42, Math.max(8, r - 6));
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = style.border;
      ctx.lineWidth = style.borderWidth;
      this.roundRectPath(x + 1, y + 1, w - 2, h - 2, Math.max(4, r - 1));
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.5;
      this.roundRectPath(x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 6));
      ctx.stroke();
      if (style.sparkle) {
        const t = ((_a = style.nowMs) != null ? _a : 0) * 6e-3;
        const dots = [
          { dx: 16, dy: 14 },
          { dx: w - 18, dy: 16 },
          { dx: 20, dy: h - 16 },
          { dx: w - 22, dy: h - 18 }
        ];
        for (let i = 0; i < dots.length; i += 1) {
          const d = dots[i];
          const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(t + i));
          ctx.save();
          ctx.globalAlpha = twinkle;
          ctx.fillStyle = (_b = style.sparkleColor) != null ? _b : "#ffd6ef";
          ctx.beginPath();
          ctx.arc(x + d.dx, y + d.dy, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    /**
     * 泡泡感可爱按钮：圆角胶囊 + 渐变 + 白边 + 顶部高光。
     */
    drawCuteButton(btn, palette, scale = 1) {
      var _a;
      const { ctx } = this;
      const now = this.nowMs || Date.now();
      const idle = scale !== 1 ? scale : 1 + this.fxAmt(0.018, 0.01) * Math.sin(now * 6e-3 + btn.x * 0.02);
      const cx = btn.x + btn.w / 2;
      const cy = btn.y + btn.h / 2;
      const r = btn.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(idle, idle);
      ctx.translate(-cx, -cy);
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#5b3a6e";
      this.roundRectPath(btn.x + 2, btn.y + 5, btn.w, btn.h, r);
      ctx.fill();
      ctx.restore();
      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      grad.addColorStop(0, palette.top);
      grad.addColorStop(1, palette.bottom);
      ctx.fillStyle = grad;
      this.roundRectPath(btn.x, btn.y, btn.w, btn.h, r);
      ctx.fill();
      if (palette.gloss !== false) {
        const insetX = btn.h <= 22 ? 3 : 6;
        const insetY = btn.h <= 22 ? 2 : 4;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        this.roundRectPath(
          btn.x + insetX,
          btn.y + insetY,
          btn.w - insetX * 2,
          btn.h * 0.38,
          Math.max(btn.h <= 22 ? 4 : 8, r - 8)
        );
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = btn.h <= 22 ? 1.5 : 2.5;
      this.roundRectPath(btn.x + 1.5, btn.y + 1.5, btn.w - 3, btn.h - 3, r - 1);
      ctx.stroke();
      if (btn.label) {
        const fontSize = (_a = palette.fontSize) != null ? _a : btn.h <= 22 ? 11 : btn.h <= 28 ? 12 : btn.h <= 36 ? 15 : 17;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(120,40,90,0.25)";
        ctx.lineWidth = fontSize <= 11 ? 2 : 3;
        ctx.strokeText(btn.label, cx, cy + 1);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(btn.label, cx, cy);
      }
      ctx.restore();
    }
  };
  function clamp013(v) {
    return Math.max(0, Math.min(1, v));
  }
  function easeOutBackLocal(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const u = Math.max(0, Math.min(1, t));
    return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
  }

  // src/minigame/entry.ts
  function waitWxBridge() {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      try {
        if (typeof wx !== "undefined" && typeof wx.nextTick === "function") {
          wx.nextTick(done);
        }
      } catch (e) {
      }
      setTimeout(done, 48);
    });
  }
  async function bootWechatMiniGame() {
    await waitWxBridge();
    const container = createAppContainer();
    const bootstrap = new Bootstrap(container);
    const session = await bootstrap.run();
    const app = new WxCanvasGameApp(session);
    app.bootIntoLobby();
    app.start();
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    await app.preloadAssets();
  }
  void bootWechatMiniGame().catch((err) => {
    console.error("[crush-crush] wechat boot failed", err);
  });
})();
//# sourceMappingURL=game.js.map

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
    Invite: "crush.player.invite"
  };

  // src/core/adapters/WxStorageAdapter.ts
  var WxStorageAdapter = class {
    async get(key) {
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
    playShuffleGranted: false,
    playExtraGranted: false
  };
  function parseBoosterDaily(raw) {
    var _a, _b, _c;
    return {
      adHammer: Math.max(0, Math.floor((_a = raw == null ? void 0 : raw.adHammer) != null ? _a : 0)),
      adShuffle: Math.max(0, Math.floor((_b = raw == null ? void 0 : raw.adShuffle) != null ? _b : 0)),
      adExtra: Math.max(0, Math.floor((_c = raw == null ? void 0 : raw.adExtra) != null ? _c : 0)),
      playShuffleGranted: !!(raw == null ? void 0 : raw.playShuffleGranted),
      playExtraGranted: !!(raw == null ? void 0 : raw.playExtraGranted)
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
  function inviteSettingsHint(state) {
    if (state.pendingInviter && !state.inviteeGiftGranted) {
      return "\u901A\u5173\u4EFB\u610F\u4E00\u5173\uFF0C\u4F60\u548C\u9080\u8BF7\u4EBA\u5404\u5F97 1 \u9524\u5B50";
    }
    if (state.appliedCreditHammer > 0 && state.inviteeGiftGranted) {
      return `\u5DF2\u9886\u9080\u8BF7\u9524\u5B50 \xB7 \u5DF2\u6210\u529F\u9080\u8BF7 ${state.appliedCreditHammer} \u4EBA`;
    }
    if (state.inviteeGiftGranted) {
      return "\u5DF2\u9886\u9080\u8BF7\u9524\u5B50 \xB7 \u518D\u9080\u65B0\u670B\u53CB\u901A\u5173\uFF0C\u4F60\u4E5F\u5F97\u9524\u5B50";
    }
    if (state.appliedCreditHammer > 0) {
      return `\u5DF2\u6210\u529F\u9080\u8BF7 ${state.appliedCreditHammer} \u4EBA\uFF0C\u5404\u5F97 1 \u9524\u5B50`;
    }
    return "\u9080\u8BF7\u65B0\u73A9\u5BB6\uFF0C\u5BF9\u65B9\u901A\u5173\u540E\u53CC\u65B9\u5404\u5F97 1 \u9524\u5B50";
  }
  function lobbyInviteHint(state) {
    if (state.pendingInviter && !state.inviteeGiftGranted) {
      return "\u901A\u5173\u7B2C 1 \u5173\uFF0C\u4F60\u548C\u597D\u53CB\u5404\u5F97\u9524\u5B50";
    }
    return null;
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
        invite
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
            "invite.creditHammer": command.max ? command.max(invite.creditHammer) : invite.creditHammer
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
        playShuffleGranted: false,
        playExtraGranted: false
      },
      invite: parseInviteCloudSlice(row.invite)
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
    var _a, _b;
    try {
      if (typeof wx === "undefined" || typeof wx.getAccountInfoSync !== "function") {
        return null;
      }
      const env = (_b = (_a = wx.getAccountInfoSync()) == null ? void 0 : _a.miniProgram) == null ? void 0 : _b.envVersion;
      if (env === "develop" || env === "trial" || env === "release") {
        return env;
      }
    } catch (e) {
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
  function resolveWxMainCanvas() {
    var _a, _b;
    const g = globalThis;
    const existing = (_b = (_a = g.GameGlobal) == null ? void 0 : _a.canvas) != null ? _b : g.canvas;
    if (existing && typeof existing.getContext === "function") {
      return existing;
    }
    return wx.createCanvas();
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
      this.bgmVolume = 0.42;
      this.innerAudioOptionApplied = false;
      this.bgmKeepAliveTimer = 0;
      this.lastBgmPlayMs = 0;
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
      ctx.volume = (_a = options == null ? void 0 : options.volume) != null ? _a : 0.85;
      this.startSfx(ctx);
      this.scheduleBgmKeepAlive();
    }
    suspendForBackground() {
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
      } catch (e) {
      }
    }
    scheduleBgmKeepAlive() {
      if (!this.bgmWanted || this.muted) {
        return;
      }
      if (this.bgmKeepAliveTimer) {
        clearTimeout(this.bgmKeepAliveTimer);
      }
      this.bgmKeepAliveTimer = setTimeout(() => {
        this.bgmKeepAliveTimer = 0;
        this.resumeBgm();
      }, 80);
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
      } catch (e) {
      }
    }
    /** paused===false 已在播；系统掐掉后 paused 变 true，必须再 play。 */
    shouldKickBgm() {
      if (!this.bgm) {
        return true;
      }
      if (this.bgm.paused === false) {
        return false;
      }
      if (this.bgm.paused === true) {
        return true;
      }
      return this.lastBgmPlayMs === 0 || Date.now() - this.lastBgmPlayMs > 800;
    }
    stopBgm(clearWant) {
      if (clearWant) {
        this.bgmWanted = false;
      }
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
  function lobbyDailyHint(clearsToday, shuffleGranted) {
    if (clearsToday >= DAILY_GOAL_CLEARS) {
      return shuffleGranted ? "\u4ECA\u65E5\u76EE\u6807\u5B8C\u6210 \xB7 \u91CD\u6392\u5DF2\u5230\u8D26" : "\u4ECA\u65E5\u76EE\u6807\u5B8C\u6210\uFF0C\u968F\u65F6\u518D\u5F00\u4E00\u5173\u653E\u677E\u4E00\u4E0B";
    }
    const left = DAILY_GOAL_CLEARS - Math.max(0, clearsToday);
    return `\u4ECA\u65E5\u518D\u8FC7 ${left} \u5173\u53EF\u9886\u91CD\u6392`;
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
      var _a;
      return {
        ...this.data,
        levelScores: { ...(_a = this.data.levelScores) != null ? _a : {} }
      };
    }
    getHighestLevelId() {
      return this.data.highestLevelId;
    }
    getBestScore(levelId) {
      var _a, _b;
      return (_b = (_a = this.data.levelScores) == null ? void 0 : _a[String(levelId)]) != null ? _b : 0;
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
      var _a, _b;
      this.data.lastPlayedLevelId = levelId;
      const scores = (_a = this.data.levelScores) != null ? _a : this.data.levelScores = {};
      const key = String(levelId);
      const prev = (_b = scores[key]) != null ? _b : 0;
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
    var _a, _b, _c;
    const a = normalizeLevelProgressData(local);
    const b = normalizeLevelProgressData(remote);
    const scores = { ...(_a = a.levelScores) != null ? _a : {} };
    for (const [key, value] of Object.entries((_b = b.levelScores) != null ? _b : {})) {
      const prev = (_c = scores[key]) != null ? _c : 0;
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
      this.bindInviteFromQuery((_c = (_b = (_a = this.deps.platform).getLaunchQuery) == null ? void 0 : _b.call(_a)) != null ? _c : {});
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
      if (this.iceAtStart > 0) {
        this.goals.bindClearIceTarget(this.iceAtStart);
      }
      this.board.iceLocksTiles = config.iceStyle === "encase";
      if (typeof config.cloudGems === "number" && config.cloudGems > 0) {
        this.gemsAtStart = this.board.placeGemsFromBottom(config.cloudGems);
        this.goals.bindCollectGemsTarget(this.gemsAtStart);
      }
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
        this.cloudHydrated = true;
        await this.flushCloudPush();
      } catch (e) {
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
      var _a, _b;
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
      var _a;
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

  // src/services/Bootstrap.ts
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
    const session = new GameSession({
      storage,
      ads,
      audio,
      analytics,
      platform,
      cloudSave
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

  // src/config/notice.json
  var notice_default = {
    id: "post20-gameplay",
    title: "\u516C\u544A",
    body: "20\u5173\u540E\u6709\u65B0\u73A9\u6CD5\uFF0C\u656C\u8BF7\u671F\u5F85",
    confirm: "\u77E5\u9053\u4E86"
  };

  // src/presentation/ui/LobbyLevelMap.ts
  var MACARON_RADIUS_OF_COVER = 62 / 576;
  var MACARON_SPRITE_FILL = 0.97;
  var TREE_MACARON_SLOTS = [
    { ux: 0.205, uy: 0.39 },
    { ux: 0.485, uy: 0.315 },
    { ux: 0.49, uy: 0.42 },
    { ux: 0.47, uy: 0.55 },
    { ux: 0.785, uy: 0.47 }
  ];
  var TREE_CAPTION_UY = 0.645;
  var CLOUD_PAGE_SLOTS = [
    [
      { ux: 0.33, uy: 0.28 },
      { ux: 0.58, uy: 0.23 },
      { ux: 0.39, uy: 0.39 },
      { ux: 0.69, uy: 0.47 },
      { ux: 0.51, uy: 0.56 }
    ],
    [
      { ux: 0.56, uy: 0.26 },
      { ux: 0.33, uy: 0.34 },
      { ux: 0.65, uy: 0.41 },
      { ux: 0.68, uy: 0.52 },
      { ux: 0.47, uy: 0.58 }
    ],
    [
      { ux: 0.375, uy: 0.31 },
      { ux: 0.625, uy: 0.31 },
      { ux: 0.35, uy: 0.43 },
      { ux: 0.67, uy: 0.43 },
      { ux: 0.5, uy: 0.52 }
    ]
  ];
  function cloudLevelSlots(nodeIndex) {
    const page = Math.max(0, nodeIndex - 1);
    return CLOUD_PAGE_SLOTS[page % CLOUD_PAGE_SLOTS.length];
  }
  function lobbyPageHeight(height) {
    return Math.max(1, height);
  }
  function lobbyPageIndex(camY, height) {
    const pageH = lobbyPageHeight(height);
    return Math.max(0, Math.round(camY / pageH));
  }
  var LOBBY_SNAP_MS = 200;
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
  function lobbyPageOriginY(page, camY, height) {
    const h = Math.max(1, height);
    const current = camY / h;
    if (page <= current) {
      return camY - page * h;
    }
    if (page <= current + 1) {
      return 0;
    }
    return camY - page * h;
  }
  function isLobbyNodeExposed(node, camY, height, hideBelowY) {
    const h = Math.max(1, height);
    const front = Math.max(0, Math.floor(camY / h + 1e-4));
    if (node.nodeIndex < front) {
      return false;
    }
    if (typeof hideBelowY === "number" && Number.isFinite(hideBelowY) && node.y - node.hitR * 0.15 > hideBelowY) {
      return false;
    }
    if (node.nodeIndex === front) {
      return true;
    }
    if (node.nodeIndex === front + 1) {
      const reveal = camY - front * h;
      return node.y + node.hitR * 0.55 < reveal;
    }
    return false;
  }
  function lobbyCameraMax(maxNodeIndex, height) {
    return Math.max(0, maxNodeIndex) * lobbyPageHeight(height);
  }
  function lobbyMaxPageIndex(totalLevels) {
    return Math.max(0, vineNodeCount(totalLevels) - 1);
  }
  function lobbyComingSoonLine(page, totalLevels) {
    if (totalLevels <= 0 || page !== lobbyMaxPageIndex(totalLevels)) {
      return "";
    }
    return notice_default.body;
  }
  function lobbyCamFromDrag(camStart, dragDy, min, max, extra = 48) {
    const raw = camStart - dragDy;
    return Math.max(min - extra, Math.min(max + extra, raw));
  }
  function lobbySnapTarget(camStart, camNow, height, maxPage, velY) {
    const pageH = lobbyPageHeight(height);
    const startPage = Math.round(camStart / pageH);
    const delta = camNow - camStart;
    let page = startPage;
    if (velY > 0.42 || delta > pageH * 0.18) {
      page = startPage + 1;
    } else if (velY < -0.42 || delta < -pageH * 0.18) {
      page = startPage - 1;
    }
    page = Math.max(0, Math.min(maxPage, page));
    return page * pageH;
  }
  function lobbyMacaronRadius(coverDw) {
    return coverDw * MACARON_RADIUS_OF_COVER;
  }
  function layoutLobbyLevelNodes(args) {
    var _a;
    const { vines, cover, width, height, camY } = args;
    const macaronR = lobbyMacaronRadius(cover.dw);
    const cloudCover = (_a = args.cloudCover) != null ? _a : { dx: 0, dy: 0, dw: width, dh: height };
    const out = [];
    for (const vine of vines) {
      const lift = vine.nodeIndex === 0 ? 0 : cloudPageLiftY(vine.nodeIndex, cloudCover, args.maxCloudCenterY);
      for (const levelId of vine.levelIds) {
        const slotIndex = levelId - vine.startLevelId;
        if (vine.nodeIndex === 0) {
          const slot2 = TREE_MACARON_SLOTS[slotIndex];
          if (!slot2) {
            continue;
          }
          out.push({
            levelId,
            nodeIndex: 0,
            slotIndex,
            x: cover.dx + cover.dw * slot2.ux,
            y: cover.dy + cover.dh * slot2.uy + lobbyPageOriginY(0, camY, height),
            hitR: macaronR,
            kind: "tree"
          });
          continue;
        }
        const slot = cloudLevelSlots(vine.nodeIndex)[slotIndex];
        if (!slot) {
          continue;
        }
        out.push({
          levelId,
          nodeIndex: vine.nodeIndex,
          slotIndex,
          x: cloudCover.dx + cloudCover.dw * slot.ux,
          y: cloudCover.dy + cloudCover.dh * slot.uy - lift + lobbyPageOriginY(vine.nodeIndex, camY, height),
          hitR: macaronR,
          kind: "candy-cloud"
        });
      }
    }
    return out;
  }
  function cloudPageLiftY(nodeIndex, cloudCover, maxCloudCenterY) {
    if (typeof maxCloudCenterY !== "number" || !Number.isFinite(maxCloudCenterY)) {
      return 0;
    }
    let lowest = Number.NEGATIVE_INFINITY;
    for (const slot of cloudLevelSlots(nodeIndex)) {
      lowest = Math.max(lowest, cloudCover.dy + cloudCover.dh * slot.uy);
    }
    return lowest > maxCloudCenterY ? lowest - maxCloudCenterY : 0;
  }
  function isLobbyNodeOnScreen(node, height, pad = 72) {
    return node.y > -pad && node.y < height + pad;
  }
  function lobbyPageCaption(page, totalLevels = 0) {
    if (page <= 0) {
      return "";
    }
    const start = page * LEVELS_PER_VINE_NODE + 1;
    const rawEnd = start + LEVELS_PER_VINE_NODE - 1;
    const end = totalLevels > 0 ? Math.min(totalLevels, rawEnd) : rawEnd;
    if (start > end) {
      return "";
    }
    if (start === end) {
      return `\u7B2C ${start} \u5173`;
    }
    return `\u7B2C ${start}-${end} \u5173`;
  }
  function lobbyCaptionY(cover, camY, height, page) {
    if (page <= 0) {
      return cover.dy + cover.dh * TREE_CAPTION_UY + lobbyPageOriginY(0, camY, height);
    }
    return height * TREE_CAPTION_UY + lobbyPageOriginY(page, camY, height);
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
     * @param lobbyPanY - 大厅相机下移：树往下走，上方露出天空云层
     */
    draw(ctx, images, mode, nowMs, lobbyPanY = 0) {
      const { width, height } = this;
      if (width <= 0 || height <= 0) {
        return;
      }
      const t = nowMs * 1e-3;
      const img = mode === "lobby" ? images.lobby : images.level;
      if (mode === "lobby") {
        this.drawLobbyWorld(ctx, images, t, lobbyPanY);
        return;
      }
      if (img) {
        this.drawCoverImage(ctx, img, width, height, 1, 0, 0, 0.92);
      } else {
        this.drawFallbackGradient(ctx, mode, width, height);
      }
      this.drawSparkles(ctx, t, this.lite ? 0.16 : 0.22);
    }
    /**
     * 大厅世界：第 1 屏树冠底图；上滑后整屏换上与树冠同质感的糖果云背景。
     */
    drawLobbyWorld(ctx, images, t, panY) {
      var _a;
      const { width, height } = this;
      const img = images.lobby;
      const hasCloudArt = ((_a = images.lobbyCloudPages) != null ? _a : []).some((page) => !!page);
      const treeOrigin = lobbyPageOriginY(0, panY, height);
      const open = Math.max(0, Math.min(1, treeOrigin / Math.max(24, height * 0.55)));
      let destY = 0;
      let destH = height;
      let layout = null;
      if (img && (img.width || 0) > 0) {
        layout = this.getCoverLayout(img, 0.5);
        destY = layout.dy + treeOrigin;
        destH = layout.dh;
      }
      if (!layout || destY > 1) {
        this.drawSkyGradient(ctx, width, height);
        if (!hasCloudArt) {
          this.drawAmbientSkyClouds(ctx, t, open);
        }
      }
      if (treeOrigin > 1 || panY > height * 0.5) {
        this.drawPagedCandyCloudBackdrops(ctx, images, panY);
      }
      if (layout && img && destY < height && destY + destH > 0) {
        ctx.drawImage(
          img,
          0,
          0,
          Math.max(1, img.width || width),
          Math.max(1, img.height || height),
          layout.dx - 4,
          destY - 6,
          layout.dw + 8,
          destH + 10
        );
        this.coverLobbyBakedCornerIcons(ctx, layout, destY, destH, img);
      } else if (!layout && open < 0.2) {
        this.drawFallbackGradient(ctx, "lobby", width, height);
      }
      this.coverLobbyTopSeam(ctx, width, destY - 6);
      this.drawSparkles(ctx, t, (this.lite ? 0.18 : 0.28) + open * 0.12);
      if (open > 0.08) {
        this.drawCandyDust(ctx, t, (this.lite ? 0.12 : 0.22) + open * 0.12);
      }
    }
    /** 云层翻页：后续关卡沿用 6-10 关薄荷棉花糖岛设计 */
    drawPagedCandyCloudBackdrops(ctx, images, panY) {
      var _a;
      const { height } = this;
      if (height <= 0) {
        return;
      }
      const pages = ((_a = images.lobbyCloudPages) != null ? _a : []).filter(
        (img) => !!img && (img.width || 0) > 0
      );
      if (pages.length === 0) {
        return;
      }
      const first = Math.max(1, Math.floor(panY / Math.max(1, height)));
      const last = first + 1;
      for (let page = last; page >= first; page -= 1) {
        if (page < 1) {
          continue;
        }
        const img = pages[(page - 1) % pages.length];
        const layout = this.getCoverLayout(img, 0.48);
        const y = layout.dy + lobbyPageOriginY(page, panY, height);
        if (y + layout.dh < -8 || y > height + 8) {
          continue;
        }
        ctx.drawImage(
          img,
          0,
          0,
          img.width || layout.dw,
          img.height || layout.dh,
          layout.dx - 4,
          y - 6,
          layout.dw + 8,
          layout.dh + 10
        );
      }
    }
    drawSkyGradient(ctx, width, height) {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#9ed4fb");
      g.addColorStop(0.18, "#b5e4fc");
      g.addColorStop(0.48, "#ffe3f2");
      g.addColorStop(0.78, "#fff0c8");
      g.addColorStop(1, "#e7fff6");
      ctx.fillStyle = g;
      ctx.fillRect(0, -4, width, height + 8);
    }
    /**
     * 树屏顶边与上一层天空相接时，抹掉 1px 硬边，不铺色带。
     */
    coverLobbyTopSeam(ctx, width, destY) {
      const y0 = destY - 2;
      const capH = 8;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + capH);
      g.addColorStop(0, "rgba(103, 200, 253, 0.22)");
      g.addColorStop(1, "rgba(103, 200, 253, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, width, capH);
    }
    /**
     * 底图右上角烘焙了两枚装饰图标，实机上会和微信胶囊叠在一起。
     * 用与顶空一致的渐变盖住，不改 JPEG。
     */
    coverLobbyBakedCornerIcons(ctx, layout, destY, destH, img) {
      const iw = Math.max(1, img.width || 576);
      const ih = Math.max(1, img.height || 1024);
      const dw = layout.dw + 8;
      const dh = destH + 10;
      const x = layout.dx - 4 + 484 / iw * dw;
      const y = destY - 6 + 30 / ih * dh;
      const h = (198 - 30) / ih * dh;
      const w = this.width - x + 6;
      if (w <= 0 || h <= 0) {
        return;
      }
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#9ed4fb");
      g.addColorStop(0.4, "#b6e8fc");
      g.addColorStop(1, "#c5eefd");
      ctx.fillStyle = g;
      ctx.fillRect(x + 14, y, Math.max(0, w - 14), h);
      const edge = ctx.createLinearGradient(x, y, x + 16, y);
      edge.addColorStop(0, "rgba(182, 232, 252, 0)");
      edge.addColorStop(1, "rgba(182, 232, 252, 1)");
      ctx.fillStyle = edge;
      ctx.fillRect(x, y, 16, h);
    }
    drawAmbientSkyClouds(ctx, t, open) {
      if (open <= 0.02) {
        return;
      }
      ctx.save();
      ctx.globalAlpha = 0.4 + open * 0.45;
      const candy = [
        { x: 0.12, y: 0.1, s: 1.35, tint: "#ffd0ea", dots: true },
        { x: 0.78, y: 0.08, s: 1.5, tint: "#ffe6a8", dots: true },
        { x: 0.48, y: 0.06, s: 1.05, tint: "#d9f5c8", dots: true },
        { x: 0.9, y: 0.22, s: 1, tint: "#e4d4ff", dots: true },
        { x: 0.22, y: 0.78, s: 1.1, tint: "#fff0c8", dots: true }
      ];
      const shown = this.lite ? candy.slice(0, 3) : candy;
      for (let i = 0; i < shown.length; i += 1) {
        const c = shown[i];
        const bob = Math.sin(t * 0.7 + i) * 6;
        const drift = Math.sin(t * 0.15 + i * 0.8) * 8;
        this.drawCottonCandySwirl(
          ctx,
          this.width * c.x + drift,
          this.height * c.y + bob,
          c.s,
          c.tint,
          c.dots
        );
      }
      ctx.restore();
    }
    /**
     * 关卡宿主云：棉花糖旋涡，贴合大厅树冠质感。
     */
    drawLevelHostCloud(ctx, x, y, scale, candy, nowMs, slotIndex = 0) {
      const t = nowMs * 1e-3;
      const bob = Math.sin(t * 1.05 + x * 0.01) * 2.4;
      const tint = candy ? this.candyCloudTint(slotIndex * 17 + 3) : "#e7fff6";
      this.drawCottonCandySwirl(ctx, x, y + bob + 10, scale * 1.42, tint, candy);
    }
    /**
     * 树冠连到云朵：一串棉花糖，而不是细线。
     */
    drawCottonCandyStrand(ctx, x0, y0, x1, y1, nowMs) {
      const t = nowMs * 1e-3;
      const cx = (x0 + x1) / 2 + 18;
      const cy = (y0 + y1) / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(186, 245, 220, 0.7)";
      ctx.lineWidth = 22;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.restore();
      const steps = 3;
      for (let i = 0; i <= steps; i += 1) {
        const u = i / steps;
        const mt = 1 - u;
        const x = mt * mt * x0 + 2 * mt * u * cx + u * u * x1;
        const y = mt * mt * y0 + 2 * mt * u * cy + u * u * y1;
        const bob = Math.sin(t * 1.2 + i) * 3;
        this.drawCottonCandySwirl(
          ctx,
          x,
          y + bob,
          0.55 + i % 2 * 0.18,
          i % 2 === 0 ? "#d9fff0" : "#fff6fb",
          false
        );
      }
    }
    candyCloudTint(seed) {
      const tints = ["#c8f8e4", "#d9fff0", "#e7fff6", "#c8f8e4", "#b8f0dc"];
      const i = Math.abs(Math.floor(seed)) % tints.length;
      return tints[i];
    }
    /** 棉花糖旋涡：大厅树冠那种厚 spiral 糖霜 */
    drawCottonCandySwirl(ctx, x, y, scale, tint, candyDots) {
      const r = 24 * scale;
      ctx.save();
      ctx.fillStyle = "rgba(120, 170, 200, 0.14)";
      this.ellipse(ctx, x, y + r * 0.5, r * 1.75, r * 0.4);
      ctx.fillStyle = tint;
      this.ellipse(ctx, x, y, r * 1.62, r * 1.22);
      const lobes = this.lite ? 3 : 5;
      for (let i = 0; i < lobes; i += 1) {
        const ang = i * 0.95 + 0.15;
        const spin = 0.55 + i % 4 * 0.08;
        this.ellipse(
          ctx,
          x + Math.cos(ang) * r * spin,
          y + Math.sin(ang) * r * 0.38,
          r * (0.7 + i % 3 * 0.1),
          r * 0.5
        );
      }
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = this.shadeHex(tint, -28);
      this.ellipse(ctx, x - r * 0.18, y + r * 0.08, r * 0.85, r * 0.28);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      this.ellipse(ctx, x - r * 0.32, y - r * 0.4, r * 0.7, r * 0.32);
      if (candyDots) {
        const dots = ["#ff85c0", "#ffe066", "#74c0fc"];
        for (let i = 0; i < dots.length; i += 1) {
          const ang = i / dots.length * Math.PI * 2 + 0.4;
          ctx.fillStyle = dots[i];
          ctx.beginPath();
          ctx.arc(
            x + Math.cos(ang) * r * 0.82,
            y + Math.sin(ang) * r * 0.3 + 3,
            2.4 + i % 2,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
      ctx.restore();
    }
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
        g.addColorStop(0, "#9ed4fb");
        g.addColorStop(0.45, "#b8e4ff");
        g.addColorStop(1, "#ffe6f0");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    ellipse(ctx, cx, cy, rx, ry) {
      ctx.beginPath();
      if (typeof ctx.ellipse === "function") {
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
      }
      ctx.fill();
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
    /** 彩色糖屑漂浮，增强欢乐氛围 */
    drawCandyDust(ctx, t, strength) {
      const colors = ["#ff85c0", "#ffe066", "#74c0fc", "#8ce99a", "#ff922b"];
      ctx.save();
      const dust = this.lite ? 4 : 8;
      for (let i = 0; i < dust; i += 1) {
        const x = (i * 137 + t * (10 + i % 4 * 4)) % (this.width + 40) - 20;
        const y = i * 89 % Math.floor(this.height * 0.7) + Math.sin(t * 0.9 + i) * 8 + 20;
        ctx.globalAlpha = (0.25 + 0.45 * Math.abs(Math.sin(t * 1.4 + i))) * strength;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + i % 3 * 0.7, 0, Math.PI * 2);
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

  // src/presentation/ui/HudGoalText.ts
  var KIND_NAME = {
    [1 /* Red */]: "\u7EA2\u72D0",
    [2 /* Blue */]: "\u84DD\u5154",
    [3 /* Green */]: "\u7EFF\u86D9",
    [4 /* Yellow */]: "\u9EC4\u9E21",
    [5 /* Purple */]: "\u7D2B\u732B"
  };
  function describeHudGoal(goal, compact) {
    var _a;
    const n = `${goal.current}/${goal.target}`;
    switch (goal.goal.type) {
      case "collect": {
        const name = (_a = KIND_NAME[goal.goal.kind]) != null ? _a : "\u840C\u5BA0";
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
      default:
        return "\u840C\u5BA0\u7C89\u788E\u6D88\uFF0C\u70B9\u6811\u4E0A\u9A6C\u5361\u9F99\u5C31\u80FD\u73A9";
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
    }
    return withInviterQuery(query, inviteCode);
  }

  // src/core/utils/lobbyNav.ts
  var LOBBY_NAV_CHIP_H = 36;
  var LOBBY_NAV_CHIP_MIN_W = 68;
  var LOBBY_NAV_HIT_PAD = 16;
  function lobbyNavBottomGap(bannerReserve, safeBottom) {
    const banner = Math.max(0, bannerReserve);
    const safe = Math.max(0, safeBottom);
    if (banner > 0) {
      return 12 + banner;
    }
    return Math.max(24, safe + 14);
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
  var FRAME_ERROR_LIMIT = 3;
  function resolveRenderIdleStopMs(args) {
    if (args.desktopIde || args.ambientFx) {
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

  // src/presentation/wechat/WxCanvasGameApp.ts
  var BURIED_POSE_MS = 1100;
  var BURIED_LEAVE_MS = 560;
  var TILE_FALLBACK_COLORS = {
    [0 /* Empty */]: "transparent",
    [1 /* Red */]: "#e74c3c",
    [2 /* Blue */]: "#3498db",
    [3 /* Green */]: "#2ecc71",
    [4 /* Yellow */]: "#f1c40f",
    [5 /* Purple */]: "#9b59b6",
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
    [7 /* ColorBomb */]: "assets/main/tiles/owl.png"
  };
  var BURIED_SPRITE_SRC = {
    penguin: "assets/main/tiles/penguin.png",
    snowman: "assets/main/tiles/snowman.png"
  };
  var BG_SRC = {
    lobby: "assets/main/bg/lobby.jpg",
    level: "assets/main/bg/level.jpg",
    lobbyCloudMint: "assets/main/bg/lobby-clouds-mint.jpg",
    lobbyCloudMintB: "assets/main/bg/lobby-clouds-mint-b.jpg",
    lobbyCloudMintC: "assets/main/bg/lobby-clouds-mint-c.jpg"
  };
  var BOOSTER_ICON_SRC = {
    hammer: "assets/main/ui/icon-hammer.png",
    shuffle: "assets/main/ui/icon-shuffle.png",
    extra: "assets/main/ui/icon-extra.png",
    sound: "assets/main/ui/icon-sound.png",
    mute: "assets/main/ui/icon-mute.png"
  };
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
  function lobbyBottomHint(vine, totalLevels) {
    if (!vine.unlocked) {
      return "\u901A\u5173\u4E0A\u4E00\u6BB5\u5168\u90E8\u5173\u5361\u540E\u89E3\u9501\u8FD9\u91CC";
    }
    if (vine.clearedInNode <= 0) {
      if (vine.startLevelId > 1) {
        return `\u5148\u901A\u5173\u7B2C ${vine.startLevelId} \u5173\uFF0C\u624D\u80FD\u89E3\u9501\u540E\u9762\u7684\u5173\u5361`;
      }
      return "\u5148\u901A\u5173\u7B2C 1 \u5173\uFF0C\u624D\u80FD\u89E3\u9501\u540E\u9762\u7684\u5173\u5361";
    }
    if (vine.clearedInNode >= vine.levelIds.length) {
      if (vine.endLevelId >= totalLevels) {
        return notice_default.body;
      }
      return "\u672C\u6BB5\u5DF2\u901A\u5173\uFF0C\u7EE7\u7EED\u6311\u6218\u4E91\u6735\u4E0A\u7684\u65B0\u5173\u5361";
    }
    if (vine.startLevelId > 5) {
      return "\u7CD6\u679C\u4E91\u6735\u91CC\u85CF\u7740\u4E0B\u4E00\u5173\uFF0C\u70B9\u5B83\u5F00\u59CB";
    }
    return "\u7C89\u5149\u6655=\u53EF\u6311\u6218 \xB7 \u7EFF\u52FE=\u5DF2\u901A\u5173 \xB7 \u7070\u9501=\u672A\u89E3\u9501";
  }
  var HOWTO_LINES = [
    { tag: "\u6D88\u9664", text: "\u6ED1\u52A8\u4EA4\u6362\u76F8\u90BB\u840C\u5BA0\uFF0C\u6A2A\u7AD6 3 \u4E2A\u540C\u8272\u5C31\u4F1A\u6D88\uFF0C\u8FD8\u80FD\u8FDE\u6D88\u3002" },
    { tag: "\u8FC7\u5173", text: "\u5934\u9876\u5217\u51FA\u7684\u76EE\u6807\u90FD\u8981\u505A\u5B8C\u3002\u6ED1\u4E00\u6B21\u7B97\u4E00\u6B65\uFF0C\u6CA1\u6B65\u4E86\u53EF\u91CD\u5F00\uFF0C\u6216\u53CD\u590D\u770B\u5E7F\u544A\u6BCF\u6B21\u8865 5 \u6B65\u3002" },
    { tag: "\u51B0\u5757", text: "\u4E09\u6D88\u6253\u5230\u51B0\u5757\u5C31\u4F1A\u788E\u3002\u88AB\u51BB\u4F4F\u7684\u683C\u5B50\u4E0D\u80FD\u6ED1\uFF0C\u5148\u6D88\u65C1\u8FB9\u6216\u8FDE\u5230\u51B0\u4E0A\u3002" },
    { tag: "\u68C9\u82B1", text: "\u76D6\u4F4F\u7684\u4E0D\u80FD\u6ED1\u3002\u65C1\u8FB9\u5C0F\u52A8\u7269\u6D88\u6389\u540E\u68C9\u82B1\u624D\u6389\u4E00\u5C42\uFF0C\u6D88\u4E24\u6B21\u6E05\u6389\u3002\u4E0B\u9762\u6709\u65F6\u85CF\u7C89\u7403\uFF0C\u518D\u6D88\u4E00\u6B21\u624D\u80FD\u6536\u3002" },
    { tag: "\u4F19\u4F34", text: "\u96EA\u4EBA\u3001\u4F01\u9E45\u85CF\u5728\u51B0\u4E0B\uFF0C\u5404\u5360 2\uFF5E4 \u683C\u3002\u8FD9\u51E0\u683C\u7684\u51B0\u5168\u788E\u4E86\u624D\u80FD\u6536\u4E0B\u3002\u4F01\u9E45\u4E00\u53EA\u4E00\u53EA\u7B97\uFF1B\u4E24\u53EA\u96EA\u4EBA\u90FD\u9732\u51FA\u624D\u7B97\uFF0C\u8FD8\u4F1A\u9707\u788E\u5468\u56F4\u51B0\u3002" },
    { tag: "\u5927\u62DB", text: "\u8FDE 4 \u4E2A\u51FA\u95EA\u5149\u4F1A\u7206\u70B8\uFF1B\u8FDE 5 \u4E2A\u51FA\u732B\u5934\u9E70\u6E05\u540C\u8272\u3002\u8FC7\u5173\u540E\u9650\u65F6\u70B9\u683C\u5B50\u7C89\u788E\u52A0\u5206\u3002" },
    { tag: "\u9053\u5177", text: "\u9524\u5B50\u7838\u4E00\u683C\uFF0C\u91CD\u6392\u6253\u4E71\u68CB\u76D8\uFF0C\u52A0\u6B65 +5\u3002\u5F00\u5C40\u4E0D\u9001\u3002\u6309\u94AE\u7A7A\u4E86\u5C31\u770B\u5E7F\u544A\uFF0C\u770B\u5B8C\u5C31\u7ED9\uFF0C\u80FD\u4E00\u76F4\u770B\u3002" },
    { tag: "\u9886\u53D6", text: "\u6BCF\u5929\u767B\u5F55\u9001\u9524\u5B50\uFF0C\u8FC7 3 \u5173\u9001\u91CD\u6392\uFF0C\u5269 6 \u6B65\u901A\u5173\u9001\u52A0\u6B65\u3002\u5E26\u5230\u4E0B\u4E00\u5173\uFF0C\u5404\u6700\u591A 9 \u4E2A\u3002" },
    { tag: "\u9080\u8BF7", text: "\u628A\u6E38\u620F\u53D1\u7ED9\u6CA1\u73A9\u8FC7\u7684\u597D\u53CB\u3002\u5BF9\u65B9\u901A\u5173\u540E\u53CC\u65B9\u5404\u5F97 1 \u9524\u5B50\u3002\u770B\u5E7F\u544A\u9886\u9053\u5177\u4ECD\u7136\u9A6C\u4E0A\u5230\u8D26\u3002" }
  ];
  var WIN_CELEBRATE_SRC = "assets/main/ui/win-celebrate.jpg";
  var WIN_CELEBRATE_CROP_TOP = 0.36;
  var WIN_BANNER_CY = 0.82;
  var SLOT_FILL_BOTTOM = "rgba(255, 236, 220, 0.88)";
  var SLOT_LINE = "rgba(255, 170, 140, 0.42)";
  var BOARD_PANEL_TOP = "rgba(255, 252, 255, 0.96)";
  var BOARD_PANEL_BOTTOM = "rgba(255, 246, 250, 0.94)";
  var BOARD_PANEL_OUTER = "rgba(232, 214, 220, 0.95)";
  var WxCanvasGameApp = class {
    constructor(session) {
      this.animator = new BoardMatchAnimator();
      this.sceneBg = new CuteSceneBackground();
      this.resultFx = new LevelResultFx();
      this.mode = "lobby";
      this.overlay = "none";
      /** 从设置点进玩法 / 公告时，关闭后回到设置 */
      this.overlayFromSettings = false;
      this.buttons = [];
      this.raf = 0;
      this.statusText = "";
      /** 点道具后贴在按钮上方的短提示 */
      this.toastText = "";
      this.toastUntilMs = 0;
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
      this.lobbyCloudPages = [null, null, null];
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
      this.canvas = resolveWxMainCanvas();
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx = this.canvas.getContext("2d");
      this.ctx.scale(this.dpr, this.dpr);
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
      this.boardView = new BoardView({ cellSize: 40, originX: 0, originY: 0 });
      this.sceneBg.layout(this.width, this.height);
      this.onTouchStartBound = (e) => this.handleTouchStart(e);
      this.onTouchMoveBound = (e) => this.handleTouchMove(e);
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
      });
      jobs.push(async () => {
        this.bgLevel = await this.loadBgImage(BG_SRC.level);
      });
      jobs.push(async () => {
        this.lobbyCloudPages[0] = await this.loadBgImage(BG_SRC.lobbyCloudMint);
      });
      for (const [key, src] of Object.entries(BOOSTER_ICON_SRC)) {
        jobs.push(async () => {
          const img = await this.loadBgImage(src);
          if (img) {
            this.uiIcons.set(key, img);
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
      if (!isWxDesktopIdeHost()) {
        jobs.push(async () => {
          this.buriedPenguin = await this.loadBgImage(BURIED_SPRITE_SRC.penguin);
        });
        jobs.push(async () => {
          this.buriedSnowman = await this.loadBgImage(BURIED_SPRITE_SRC.snowman);
        });
      }
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
    /** 云层翻页、过关海报、小程序码：不挡首屏。 */
    async preloadDeferredAssets() {
      if (isWxDesktopIdeHost()) {
        await new Promise((resolve) => {
          setTimeout(resolve, 2800);
        });
      }
      await Promise.all([
        this.loadBgImage(BG_SRC.lobbyCloudMintB).then((img) => {
          this.lobbyCloudPages[1] = img;
        }),
        this.loadBgImage(BG_SRC.lobbyCloudMintC).then((img) => {
          this.lobbyCloudPages[2] = img;
        }),
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
      this.maybeOpenLobbyNotice();
      this.syncLobbyBanner();
      this.boardView.bindInput((_a, _b, _c, _d) => {
      });
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
      wx.onTouchStart(this.onTouchStartBound);
      wx.onTouchMove(this.onTouchMoveBound);
      wx.onTouchEnd(this.onTouchEndBound);
      wx.onTouchCancel(this.onTouchCancelBound);
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
      if (this.floatingScores.length || this.crushSparks.length || this.crushBursts.length) {
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
      return false;
    }
    /** 大厅呼吸、结算彩带、粉碎倒计时需要持续转；对局静止盘面可停循环。 */
    wantsAmbientFx() {
      return this.mode === "lobby" || this.mode === "result" || this.mode === "crush" || this.mode === "clean";
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
      try {
        if (this.pumping) {
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
          const desktopIde = isWxDesktopIdeHost();
          const busy = shouldKeepRenderLoop({
            animating,
            lastInteractMs: this.lastInteractMs,
            nowMs: now,
            idleStopMs: resolveRenderIdleStopMs({
              desktopIde,
              ambientFx: this.wantsAmbientFx()
            })
          });
          this.frameDelayMs = resolveNextFrameDelayMs({
            animating,
            desktopIde,
            baseDelayMs: this.baseFrameDelayMs
          });
          if (this.needsPaint || busy) {
            this.draw();
            this.frameErrors = 0;
          }
          this.needsPaint = busy;
        } catch (err) {
          console.error("[crush-crush] frame failed", err);
          this.frameErrors += 1;
          this.needsPaint = !shouldBackoffAfterFrameErrors(this.frameErrors);
        } finally {
          this.pumping = false;
        }
        if (!this.foregroundHidden && this.started && this.needsPaint) {
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
      (_a = this.unsub) == null ? void 0 : _a.call(this);
      this.unsub = null;
      this.share.dispose();
      this.recommend.dispose();
      this.boardView.dispose();
      this.destroyGameClubButton();
      this.session.hideLobbyBanner();
    }
    onGameEvent(event) {
      var _a, _b;
      this.requestPaint();
      if (event.type === "InviteReward") {
        this.notifyUser(
          event.kind === "invitee" ? "\u9080\u8BF7\u793C\u5230\u8D26 +1 \u9524\u5B50" : `\u597D\u53CB\u901A\u5173\u4E86\uFF0C\u4F60 +${event.hammers} \u9524\u5B50`,
          "\u9524\u5B50\u5230\u8D26"
        );
        return;
      }
      if (event.type === "LevelWon") {
        this.pendingResult = "won";
        this.statusText = "\u5173\u5361\u80DC\u5229\uFF01";
        if (!this.animator.isPlaying() && !this.swapSlide) {
          this.afterLevelResolved();
        }
        return;
      }
      if (event.type === "LevelFailed") {
        this.pendingResult = "failed";
        this.statusText = "\u6B65\u6570\u7528\u5B8C\u4E86\uFF0C\u518D\u8BD5\u4E00\u6B21\u4E5F\u5F88\u8F7B\u677E";
        if (!this.animator.isPlaying() && !this.swapSlide) {
          this.afterLevelResolved();
        }
        return;
      }
      if (event.type === "SwapAccepted") {
        this.beginSwapSlide(event.rowA, event.colA, event.rowB, event.colB, false);
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
        const cols = (_a = board == null ? void 0 : board.size.cols) != null ? _a : 8;
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
          this.statusText = `+${(_b = event.movesGranted) != null ? _b : 5} \u6B65 \xB7 \u5269\u4F59 ${event.remaining}`;
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
    getHudFrame() {
      var _a, _b;
      const belowCapsule = ((_b = (_a = this.menuButton) == null ? void 0 : _a.bottom) != null ? _b : this.statusBarHeight + 32) + 8;
      const top = Math.max(this.statusBarHeight + 8, belowCapsule);
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
      if (this.isInputMuted()) {
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
      this.crushTapOnDown = false;
      this.lobbyDrag = null;
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
    /** 按当前页面生成转发 / 朋友圈文案 */
    buildSharePayload() {
      var _a;
      const level = this.session.getLevelConfig();
      const levelId = (_a = level == null ? void 0 : level.id) != null ? _a : 1;
      const score = this.session.getScore();
      const scene = this.mode === "playing" || this.mode === "crush" || this.mode === "clean" || this.mode === "result" ? this.mode : "lobby";
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
    /** 左下角导航标签尺寸，供道具栏避让。 */
    getNavChipFrame() {
      const w = 88;
      const h = LOBBY_NAV_CHIP_H;
      const banner = this.mode === "lobby" ? this.session.getLobbyBannerReservePx() : 0;
      const bottom = lobbyNavBottomGap(banner, this.safeAreaBottom);
      return { x: 12, y: this.height - h - bottom, w, h };
    }
    hitLobbyNavChip(x, y) {
      const hit = this.hitButton(x, y);
      return !!hit && hit.id !== "level";
    }
    /** 左下角「设置」；大厅再并排「推荐 / 圈子」。玩法在设置里。 */
    drawNavChips() {
      const frame = this.getNavChipFrame();
      if (this.mode !== "lobby") {
        this.hideGameClubNativeButton();
        const settingsBtn = {
          id: "settings",
          x: frame.x,
          y: frame.y,
          w: frame.w,
          h: frame.h,
          label: "\u8BBE\u7F6E",
          hitPad: LOBBY_NAV_HIT_PAD
        };
        this.buttons.push(settingsBtn);
        this.drawCuteButton(settingsBtn, {
          top: "#b197fc",
          bottom: "#7950f2",
          border: "#ffffff",
          gloss: true
        });
        return;
      }
      const gap = 8;
      const side = 12;
      const items = [
        {
          id: "settings",
          label: "\u8BBE\u7F6E",
          palette: { top: "#b197fc", bottom: "#7950f2", border: "#ffffff", gloss: true }
        },
        {
          id: "recommend",
          label: "\u63A8\u8350",
          palette: { top: "#ffa8a8", bottom: "#fa5252", border: "#ffffff", gloss: true }
        },
        {
          id: "club",
          label: "\u5708\u5B50",
          palette: { top: "#74c0fc", bottom: "#1c7ed6", border: "#ffffff", gloss: true }
        }
      ];
      const chipW = Math.max(
        LOBBY_NAV_CHIP_MIN_W,
        Math.floor((this.width - side * 2 - gap * (items.length - 1)) / items.length)
      );
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const btn = {
          id: item.id,
          x: side + i * (chipW + gap),
          y: frame.y,
          w: chipW,
          h: frame.h,
          label: item.label,
          hitPad: LOBBY_NAV_HIT_PAD
        };
        this.buttons.push(btn);
        this.drawCuteButton(btn, item.palette);
        if (item.id === "club") {
          this.syncGameClubNativeButton(btn);
        }
      }
      this.drawLobbyNavHint(frame);
    }
    /** 每日目标提示贴在设置、推荐、圈子这一排上面。 */
    drawLobbyNavHint(frame) {
      var _a;
      if (this.overlay !== "none") {
        return;
      }
      const { ctx, width } = this;
      const daily = this.session.getDailyLoop();
      const page = lobbyPageIndex(this.lobbyCamY, this.height);
      const vine = (_a = this.session.listLobbyVineNodes().find((node) => node.nodeIndex === page)) != null ? _a : this.session.getVineNode();
      const inviteTip = lobbyInviteHint(this.session.getInviteState());
      const tip = inviteTip != null ? inviteTip : daily.clearsToday >= DAILY_GOAL_CLEARS ? lobbyBottomHint(vine, this.session.getLevelCount()) : lobbyDailyHint(daily.clearsToday, daily.playShuffleGranted);
      ctx.font = "bold 13px sans-serif";
      const tipW = Math.min(width - 48, ctx.measureText(tip).width + 36);
      const tipH = 32;
      const tipX = (width - tipW) / 2;
      const bob = Math.sin((this.nowMs || Date.now()) / 420) * 2;
      const tipY = frame.y - tipH - 10 + bob;
      this.drawHudPill(
        tipX,
        tipY,
        tipW,
        tipH,
        "rgba(255,255,255,0.9)",
        "rgba(255,150,200,0.85)"
      );
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#7a3e6a";
      ctx.fillText(tip, width / 2, tipY + tipH / 2);
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
      ctx.fillStyle = "rgba(40, 20, 55, 0.46)";
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
      this.drawSettingsPanel();
    }
    drawNoticePanel() {
      const { ctx, width, height } = this;
      const panelW = Math.min(300, width - 48);
      ctx.font = "bold 16px sans-serif";
      const bodyLines = this.wrapText(notice_default.body, panelW - 48);
      const panelH = 168 + Math.max(0, bodyLines.length - 1) * 22;
      const x = (width - panelW) / 2;
      const y = Math.max(24, height * 0.28);
      this.drawCuteCard(x, y, panelW, panelH, {
        radius: 24,
        fillTop: "rgba(255,255,255,0.98)",
        fillBottom: "rgba(255,236,245,0.97)",
        border: "rgba(255, 170, 210, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        nowMs: this.nowMs || Date.now()
      });
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#c2255c";
      ctx.fillText(notice_default.title, x + panelW / 2, y + 38);
      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = "#5c3d4a";
      let ty = y + 82;
      for (const line of bodyLines) {
        ctx.fillText(line, x + panelW / 2, ty);
        ty += 22;
      }
      ctx.restore();
      const btnW = Math.min(220, panelW - 48);
      const closeBtn = {
        id: "resume",
        x: x + (panelW - btnW) / 2,
        y: y + panelH - 62,
        w: btnW,
        h: 46,
        label: this.overlayFromSettings ? "\u8FD4\u56DE\u8BBE\u7F6E" : notice_default.confirm
      };
      this.buttons.push(closeBtn);
      this.drawCuteButton(closeBtn, {
        top: "#ffd43b",
        bottom: "#fab005",
        border: "#ffffff",
        gloss: true
      });
    }
    drawSettingsPanel() {
      const { ctx, width, height } = this;
      const inLobby = this.mode === "lobby";
      const panelW = Math.min(300, width - 48);
      const hint = inviteSettingsHint(this.session.getInviteState());
      const panelH = inLobby ? 492 : 548;
      const x = (width - panelW) / 2;
      const y = Math.max(12, Math.min(height * 0.16, height - panelH - 12));
      this.drawCuteCard(x, y, panelW, panelH, {
        radius: 24,
        fillTop: "rgba(255,255,255,0.98)",
        fillBottom: "rgba(255,236,245,0.97)",
        border: "rgba(255, 170, 210, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        nowMs: this.nowMs || Date.now()
      });
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#c2255c";
      ctx.fillText("\u8BBE\u7F6E", x + panelW / 2, y + 32);
      ctx.restore();
      ctx.save();
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#a61e4d";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const hintLines = this.wrapText(hint, panelW - 36);
      let hintY = y + 50;
      for (const line of hintLines.slice(0, 2)) {
        ctx.fillText(line, x + panelW / 2, hintY);
        hintY += 16;
      }
      ctx.restore();
      const muted = this.session.isMuted();
      const btnW = Math.min(220, panelW - 48);
      const btnX = x + (panelW - btnW) / 2;
      let btnY = y + 88;
      const muteBtn = {
        id: "mute",
        x: btnX,
        y: btnY,
        w: btnW,
        h: 46,
        label: muted ? "\u97F3\u6548\uFF1A\u5173" : "\u97F3\u6548\uFF1A\u5F00"
      };
      this.buttons.push(muteBtn);
      this.drawCuteButton(
        muteBtn,
        muted ? { top: "#ced4da", bottom: "#868e96", border: "#ffffff", gloss: true } : { top: "#8ce99a", bottom: "#37b24d", border: "#ffffff", gloss: true }
      );
      btnY += 56;
      const inviteBtn = {
        id: "invite",
        x: btnX,
        y: btnY,
        w: btnW,
        h: 46,
        label: "\u9080\u8BF7\u597D\u53CB"
      };
      this.buttons.push(inviteBtn);
      this.drawCuteButton(inviteBtn, {
        top: "#b197fc",
        bottom: "#7950f2",
        border: "#ffffff",
        gloss: true
      });
      btnY += 56;
      const postBtn = {
        id: "post",
        x: btnX,
        y: btnY,
        w: btnW,
        h: 46,
        label: "\u53D1\u8868\u8D34\u56FE"
      };
      this.buttons.push(postBtn);
      this.drawCuteButton(postBtn, {
        top: "#ffd43b",
        bottom: "#fab005",
        border: "#ffffff",
        gloss: true
      });
      btnY += 56;
      const howtoBtn = {
        id: "howto",
        x: btnX,
        y: btnY,
        w: btnW,
        h: 46,
        label: "\u600E\u4E48\u73A9"
      };
      this.buttons.push(howtoBtn);
      this.drawCuteButton(howtoBtn, {
        top: "#ffc078",
        bottom: "#fd7e14",
        border: "#ffffff",
        gloss: true
      });
      btnY += 56;
      const noticeBtn = {
        id: "notice",
        x: btnX,
        y: btnY,
        w: btnW,
        h: 46,
        label: notice_default.title
      };
      this.buttons.push(noticeBtn);
      this.drawCuteButton(noticeBtn, {
        top: "#ffa8d4",
        bottom: "#f06595",
        border: "#ffffff",
        gloss: true
      });
      if (!inLobby) {
        btnY += 56;
        const homeBtn = {
          id: "lobby",
          x: btnX,
          y: btnY,
          w: btnW,
          h: 46,
          label: "\u8FD4\u56DE\u9996\u9875"
        };
        this.buttons.push(homeBtn);
        this.drawCuteButton(homeBtn, {
          top: "#ffa8d4",
          bottom: "#ff6baf",
          border: "#ffffff",
          gloss: true
        });
      }
      btnY += 56;
      const closeBtn = {
        id: "resume",
        x: btnX,
        y: btnY,
        w: btnW,
        h: 46,
        label: inLobby ? "\u5173\u95ED" : "\u7EE7\u7EED\u6E38\u620F"
      };
      this.buttons.push(closeBtn);
      this.drawCuteButton(closeBtn, {
        top: "#a5d8ff",
        bottom: "#4dabf7",
        border: "#ffffff",
        gloss: true
      });
    }
    /** 首页玩法：一屏速查，打开就能看完。 */
    drawHowToPanel() {
      const { ctx, width, height } = this;
      const panelW = Math.min(340, width - 28);
      const padX = 16;
      const tagW = 44;
      const titleH = 46;
      const btnH = 46;
      const footH = 70;
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
        fillBottom: "rgba(255,236,245,0.97)",
        border: "rgba(255, 170, 210, 0.95)",
        borderWidth: 3,
        shadow: true,
        sparkle: true,
        nowMs: this.nowMs || Date.now()
      });
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#c2255c";
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
        ctx.fillStyle = "#ff8cc8";
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
        ctx.fillStyle = "#5c3d4a";
        let ly = ty + 2;
        for (const line of lines) {
          ctx.fillText(line, x + padX + tagW + 10, ly);
          ly += 16;
        }
        ty += rowH + gap;
      }
      const btnW = Math.min(200, panelW - 48);
      const closeBtn = {
        id: "resume",
        x: x + (panelW - btnW) / 2,
        y: y + panelH - 58,
        w: btnW,
        h: btnH,
        label: this.overlayFromSettings ? "\u8FD4\u56DE\u8BBE\u7F6E" : "\u77E5\u9053\u4E86\uFF0C\u53BB\u73A9"
      };
      this.buttons.push(closeBtn);
      this.drawCuteButton(closeBtn, {
        top: "#ffd43b",
        bottom: "#fab005",
        border: "#ffffff",
        gloss: true
      });
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
    async handleButton(id, levelId) {
      if (id === "booster_hammer" || id === "booster_shuffle" || id === "booster_extra" || id === "mute" || id === "level" || id === "lobby" || id === "settings" || id === "howto" || id === "notice" || id === "club" || id === "recommend" || id === "post" || id === "invite" || id === "resume") {
        this.session.playUiSfx();
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
      if (id === "notice") {
        this.overlayFromSettings = this.overlay === "settings";
        this.openOverlay("notice");
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
        this.notifyUser("\u53D1\u7ED9\u65B0\u670B\u53CB\uFF0C\u5BF9\u65B9\u901A\u5173\u540E\u53CC\u65B9\u5404\u5F97\u9524\u5B50", "\u9080\u8BF7\u597D\u53CB");
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
          this.notifyUser("\u6B63\u5728\u6253\u5F00\u5E7F\u544A\u2026", "\u6B63\u5728\u6253\u5F00\u5E7F\u544A");
          const result = await this.runDuringAd(
            () => this.session.watchAdForBooster("hammer")
          );
          this.clearAdPrompt();
          if (result === "revived") {
            this.hammerTargeting = true;
            this.hammerCursor = { x: this.width / 2, y: this.height * 0.45 };
            this.notifyUser("\u770B\u5E7F\u544A\u83B7\u5F97\u9524\u5B50\uFF0C\u70B9\u4E00\u683C\u7838\u6389", "\u5DF2\u83B7\u5F97\u9524\u5B50");
          } else {
            this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
          }
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
          this.notifyUser("\u6B63\u5728\u6253\u5F00\u5E7F\u544A\u2026", "\u6B63\u5728\u6253\u5F00\u5E7F\u544A");
          const result = await this.runDuringAd(
            () => this.session.watchAdForBooster("shuffle")
          );
          this.clearAdPrompt();
          if (result === "revived") {
            this.boardView.clearSelection();
            this.syncBoardView();
            this.notifyUser("\u5C0F\u52A8\u7269\u91CD\u65B0\u6392\u5217\u5566\uFF01", "\u5DF2\u91CD\u6392");
          } else {
            this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
          }
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
        this.notifyUser("\u6B63\u5728\u6253\u5F00\u5E7F\u544A\u2026", "\u6B63\u5728\u6253\u5F00\u5E7F\u544A");
        const result = await this.runDuringAd(() => this.session.watchAdToAddMoves());
        this.clearAdPrompt();
        if (result === "revived") {
          this.notifyUser(
            `\u770B\u5E7F\u544A +${5} \u6B65 \xB7 \u5269\u4F59 ${this.session.getMovesLeft()}`,
            "\u6B65\u6570+5"
          );
        } else {
          this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
        }
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
        this.statusText = "";
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
        this.statusText = "";
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
    openOverlay(kind) {
      this.overlay = kind;
      this.hammerTargeting = false;
      this.hammerCursor = null;
      this.boardView.onPointerCancel();
      this.syncLobbyBanner();
      this.requestPaint();
    }
    maybeOpenLobbyNotice() {
      if (this.mode !== "lobby" || this.session.hasSeenNotice(notice_default.id)) {
        return;
      }
      this.openOverlay("notice");
    }
    closeOverlay() {
      if (this.overlay === "notice") {
        void this.session.markNoticeSeen(notice_default.id);
      }
      this.overlayFromSettings = false;
      this.overlay = "none";
      this.syncLobbyBanner();
      this.requestPaint();
    }
    /** 分享图菜单关掉（含取消）后把循环拉回来，否则设置页再也画不出来。 */
    restoreAfterShareSheet() {
      this.foreground.onShow();
      this.kickRenderLoop();
    }
    /** 设置里「发表贴图」：合成带小游戏码的海报，不截设置弹窗。 */
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
      this.openOverlay("settings");
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
        content: "\u300A\u840C\u5BA0\u7C89\u788E\u6D88\u300B\u662F\u4E00\u6B3E\u5FAE\u4FE1\u5C0F\u6E38\u620F\uFF1A7\xD77 \u68CB\u76D8\u6ED1\u52A8\u7EA2\u72D0\u3001\u84DD\u5154\u3001\u7EFF\u86D9\u3001\u9EC4\u9E21\u3001\u7D2B\u732B\uFF0C\u4E09\u8FDE\u6D88\u9664\uFF1B\u56DB\u8FDE/L/T \u51FA\u95EA\u5149\uFF0C\u4E94\u8FDE\u51FA\u8D85\u7EA7\u732B\u5934\u9E70\u3002\u8FC7\u5173\u81EA\u52A8\u8FDB\u9650\u65F6\u7C89\u788E\u52A0\u5206\uFF0C\u603B\u5206\u6EE1 1500 \u53EF\u9009\u6E05\u6D01\u6A21\u5F0F\uFF08\u6E05\u6D01\u4E0D\u52A0\u4E3B\u7EBF\u5206\uFF09\u3002\u5168\u7A0B\u65E0\u5185\u8D2D\uFF0C\u70B9\u6811\u4E0A\u7684\u9A6C\u5361\u9F99\u5C31\u80FD\u5F00\u73A9\u3002#\u6765\u5FAE\u4FE1\u505A\u4E2A\u5C0F\u7A0B\u5E8F",
        tags,
        recommendTitle
      };
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
      this.statusText = "";
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
      var _a;
      if (this.mode === "lobby" && this.overlay === "none") {
        let best = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const btn of this.buttons) {
          if (btn.id !== "level") {
            continue;
          }
          const cx = btn.x + btn.w / 2;
          const cy = btn.y + btn.h / 2;
          const r = Math.min(btn.w, btn.h) / 2;
          const dist = Math.hypot(x - cx, y - cy);
          if (dist <= r && dist < bestDist) {
            best = btn;
            bestDist = dist;
          }
        }
        if (best) {
          return best;
        }
        let near = null;
        let nearDist = 36;
        for (const btn of this.buttons) {
          if (btn.id !== "level") {
            continue;
          }
          const cx = btn.x + btn.w / 2;
          const cy = btn.y + btn.h / 2;
          const dist = Math.hypot(x - cx, y - cy);
          if (dist < nearDist) {
            near = btn;
            nearDist = dist;
          }
        }
        if (near) {
          return near;
        }
      }
      for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
        const btn = this.buttons[i];
        if (btn.id === "level") {
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
      const { ctx } = this;
      this.buttons.length = 0;
      const bgMode = this.mode === "lobby" ? "lobby" : "level";
      this.sceneBg.draw(
        ctx,
        {
          lobby: this.bgLobby,
          level: this.bgLevel,
          lobbyCloudPages: this.lobbyCloudPages
        },
        bgMode,
        this.nowMs || Date.now(),
        bgMode === "lobby" ? this.lobbyCamY : 0
      );
      if (this.mode === "lobby") {
        this.drawLobby();
        this.drawNavChips();
        this.drawPageOverlay();
        return;
      }
      this.drawHud();
      if (this.mode === "playing" || this.mode === "result" || this.mode === "crush" || this.mode === "clean") {
        const { ctx: ctx2 } = this;
        ctx2.save();
        if (this.shakeMs > 0 && (this.mode === "playing" || this.mode === "crush" || this.mode === "clean" || this.mode === "result")) {
          const mag = this.mode === "result" ? Math.min(10, this.shakeMs / 16) : Math.min(7, this.shakeMs / 18);
          ctx2.translate(
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
        ctx2.restore();
      }
      if (this.mode === "crush") {
        this.drawCrushChrome();
      }
      if (this.mode === "clean") {
        this.drawCleanChrome();
      }
      if (this.mode === "playing") {
        this.drawBoosterBar();
      }
      this.drawActionToast();
      if (this.hammerTargeting) {
        this.drawHammerCursor();
      }
      if (this.mode === "result") {
        this.drawResultOverlay();
      }
      this.drawNavChips();
      this.drawPageOverlay();
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
     * 首页大厅：第 1 屏树上 1-5；其后每 5 关一朵糖果云，按配置表总关数翻页。
     */
    drawLobby() {
      const { height } = this;
      const now = this.nowMs || Date.now();
      const nodes = this.getLobbyLevelNodes();
      const currentId = this.resolveEntryLevelId();
      const page = lobbyPageIndex(this.lobbyCamY, height);
      const maxPage = lobbyMaxPageIndex(this.session.getLevelCount());
      const hideBelowY = this.getNavChipFrame().y - 10;
      if (page > 0) {
        this.drawLobbySkyTitle(page);
      }
      const drawNodes = nodes.filter(
        (node) => isLobbyNodeOnScreen(node, height) && isLobbyNodeExposed(node, this.lobbyCamY, height, hideBelowY)
      ).sort((a, b) => b.nodeIndex - a.nodeIndex);
      for (const node of drawNodes) {
        const unlocked = this.session.isLevelUnlocked(node.levelId);
        const cleared = this.session.isLevelCleared(node.levelId);
        const isCurrent = unlocked && node.levelId === currentId && !cleared;
        const r = node.hitR;
        this.buttons.push({
          id: "level",
          levelId: node.levelId,
          x: node.x - r,
          y: node.y - r,
          w: r * 2,
          h: r * 2,
          label: String(node.levelId)
        });
        this.drawLobbyMacaronVisual(node, unlocked, cleared, isCurrent, now);
      }
      this.drawLobbySwipeHint(page, maxPage, now);
      this.drawLobbyPageDots(page, maxPage);
      this.drawLobbyStatusCaption();
      this.drawLobbyPreviewUnlockHint(page);
    }
    /** 未解锁等提示画在树干标语处，不再压住底部按钮。 */
    drawLobbyStatusCaption() {
      if (!this.statusText) {
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
    /** 开发/体验版提示：正式上线后仍按通关锁关。 */
    drawLobbyPreviewUnlockHint(page) {
      if (page > 0 || !this.session.isPreviewUnlockAll()) {
        return;
      }
      const { ctx, width } = this;
      const y = Math.max(this.statusBarHeight + 18, 36);
      ctx.save();
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 5;
      ctx.strokeText("\u6D4B\u8BD5\u5305\uFF1A\u53EF\u70B9\u4EFB\u610F\u5173", width / 2, y);
      ctx.fillStyle = "#7048e8";
      ctx.fillText("\u6D4B\u8BD5\u5305\uFF1A\u53EF\u70B9\u4EFB\u610F\u5173", width / 2, y);
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
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + pulse * 0.4})`;
      ctx.lineWidth = this.lite ? 2.4 : 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.97 + 0.02 * pulse), 0, Math.PI * 2);
      ctx.stroke();
      if (!this.lite) {
        ctx.strokeStyle = `rgba(255, 150, 210,${0.4 + pulse * 0.35})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.02, 0, Math.PI * 2);
        ctx.stroke();
      }
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
      const img = this.lobbyCloudPages.find(
        (page) => !!page && (page.width || 0) > 0
      );
      if (img) {
        return this.sceneBg.getCoverLayout(img, 0.48);
      }
      return { dx: 0, dy: 0, dw: this.width, dh: this.height };
    }
    getLobbyLevelNodes() {
      const cover = this.getLobbyCoverRect();
      const nav = this.getNavChipFrame();
      const macaronR = lobbyMacaronRadius(cover.dw);
      return layoutLobbyLevelNodes({
        vines: this.session.listLobbyVineNodes(),
        cover,
        cloudCover: this.getCloudCoverRect(),
        width: this.width,
        height: this.height,
        camY: this.lobbyCamY,
        maxCloudCenterY: nav.y - 36 - macaronR
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
      }
    }
    getLobbyCamRange() {
      const maxNode = lobbyMaxPageIndex(this.session.getLevelCount());
      return { min: 0, max: lobbyCameraMax(maxNode, this.height) };
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
      const maxPage = Math.round(range.max / Math.max(1, this.height));
      this.lobbyCamVel = 0;
      this.lobbyCamUserHeld = false;
      this.lobbyCamSnapFrom = this.lobbyCamY;
      this.lobbyCamSnapAtMs = this.nowMs || Date.now();
      this.lobbyCamAutoTarget = lobbySnapTarget(
        drag.camStart,
        this.lobbyCamY,
        this.height,
        maxPage,
        drag.velY
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
    drawLobbySkyTitle(page) {
      const { ctx, width } = this;
      const y = Math.max(this.statusBarHeight + 26, 44);
      const caption = lobbyPageCaption(page, this.session.getLevelCount());
      const comingSoon = lobbyComingSoonLine(page, this.session.getLevelCount());
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 20px sans-serif";
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.strokeText("\u7CD6\u679C\u4E91\u6735", width / 2, y);
      ctx.fillStyle = "#ff8cc8";
      ctx.fillText("\u7CD6\u679C\u4E91\u6735", width / 2, y);
      if (caption) {
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#7a3e6a";
        ctx.fillText(caption, width / 2, y + 22);
      }
      if (comingSoon) {
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#c2255c";
        ctx.fillText(comingSoon, width / 2, y + (caption ? 42 : 22));
      }
      ctx.restore();
    }
    drawLobbySwipeHint(page, maxPage, nowMs) {
      if (maxPage <= 0) {
        return;
      }
      const { ctx, width } = this;
      const bob = Math.sin(nowMs / 260) * this.fxAmt(5, 3);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (page < maxPage) {
        const y = page <= 0 ? Math.max(this.statusBarHeight + 18, 36) + bob : Math.max(this.statusBarHeight + 88, 108) + bob;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        this.roundRectPath(width / 2 - 72, y - 16, 144, 32, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 140, 200, 0.95)";
        ctx.lineWidth = 2;
        this.roundRectPath(width / 2 - 72, y - 16, 144, 32, 16);
        ctx.stroke();
        this.drawSwipeChevrons(width / 2 - 54, y, -1);
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#c2255c";
        ctx.fillText(page <= 0 ? "\u4E0A\u6ED1\u770B\u4E91\u6735\u5173\u5361" : "\u4E0A\u6ED1\u7EE7\u7EED", width / 2 + 12, y);
      }
      if (page > 0) {
        const nav = this.getNavChipFrame();
        const y = nav.y - 44 - bob * 0.35;
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "rgba(122, 62, 106, 0.85)";
        ctx.fillText("\u4E0B\u6ED1\u8FD4\u56DE", width / 2, y);
      }
      ctx.restore();
    }
    drawSwipeChevrons(x, y, dir) {
      const { ctx } = this;
      ctx.strokeStyle = "#ff6baf";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < 2; i += 1) {
        const oy = dir * i * 5;
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 4 + oy);
        ctx.lineTo(x, y - 2 + oy);
        ctx.lineTo(x + 6, y + 4 + oy);
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
      const r = 4;
      const startY = height * 0.38 - (total - 1) * gap / 2;
      ctx.save();
      for (let i = 0; i < total; i += 1) {
        ctx.beginPath();
        ctx.arc(x, startY + i * gap, i === page ? 5 : r, 0, Math.PI * 2);
        ctx.fillStyle = i === page ? "#ff6baf" : "rgba(255,255,255,0.7)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 140, 200, 0.85)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
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
      const pearls = this.lite ? 8 : 12;
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
        { id: "booster_extra", iconKey: "extra", count: stock.extraMoves },
        {
          id: "mute",
          iconKey: this.session.isMuted() ? "mute" : "sound",
          count: -1
        }
      ];
      const totalW = items.length * size + (items.length - 1) * gap;
      const nav = this.getNavChipFrame();
      const leftReserve = nav.x + nav.w + 10;
      const avail = Math.max(totalW, width - leftReserve - 14);
      let x = leftReserve + Math.floor((avail - totalW) / 2);
      for (const item of items) {
        const extraAd = item.id === "booster_extra" && item.count === 0 && this.session.allowsRewardedBooster("extraMoves") || item.id === "booster_hammer" && item.count === 0 && this.session.allowsRewardedBooster("hammer") || item.id === "booster_shuffle" && item.count === 0 && this.session.allowsRewardedBooster("shuffle");
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
          ad: extraAd
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
      if (opts.ad) {
        const bx = btn.x + btn.w - 2;
        const by = btn.y + 6;
        ctx.fillStyle = "#ff922b";
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
        ctx.fillText("\u5E7F\u544A", bx, by + 0.5);
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
      var _a, _b, _c, _d;
      const { ctx } = this;
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
      const candy = this.getHudCandyPalette(inClean, inCrush);
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
      if (!this.lite) {
        this.drawHudCandyBranchRail(
          circleCx,
          circleCy,
          cardLeft + cardW - 8,
          rowY + cardH * 0.58,
          candy
        );
      }
      const lowMoves = !inBurst && moves <= 5;
      const movePulse = lowMoves ? 1 + 0.05 * Math.sin((this.nowMs || Date.now()) * 0.02) : 1;
      const circleValue = inBurst ? String(Math.ceil(((_d = burstSession == null ? void 0 : burstSession.remainingMs) != null ? _d : 0) / 1e3)) : String(moves);
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
      const hasIcon = !inBurst && !!(hudGoal.collectKind && this.tileImages.get(hudGoal.collectKind));
      const barW = cardW - 24;
      const barH = 24;
      const barPulse = this.hudBarPulse > 0 ? 1 + (inBurst ? 0.16 : 0.08) * Math.sin((1 - this.hudBarPulse / 420) * Math.PI) : 1;
      let progress = 0;
      let goalLabel = "\u76EE\u6807 -";
      let barTheme = {
        track: "#ffe8cc",
        fillTop: "#ffc078",
        fillMid: "#ff922b",
        fillBottom: "#f76707",
        border: "#ffa94d"
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
          track: "#ffe3e3",
          fillTop: "#ff9f7a",
          fillMid: "#ff6b6b",
          fillBottom: "#e03131",
          border: "#ff8787"
        };
      } else if (hudGoal.text) {
        progress = hudGoal.progress;
        goalLabel = hudGoal.text;
      }
      this.drawCartoonProgressBar(barX, barY, barW, barH, progress, barTheme, barPulse);
      if (hasIcon && hudGoal.collectKind) {
        const sprite = this.tileImages.get(hudGoal.collectKind);
        this.drawTileSprite(
          sprite,
          barX + 4,
          barY + (barH - iconSize) / 2,
          iconSize
        );
      }
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
      ctx.strokeStyle = "rgba(90,40,20,0.35)";
      ctx.lineWidth = 3.5;
      ctx.strokeText(goalLabel, labelX, labelY);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(goalLabel, labelX, labelY);
      ctx.restore();
      if (this.statusText && (this.mode === "playing" || this.mode === "crush" || this.mode === "clean")) {
        const tipY = this.getHudBottom() + 2;
        ctx.font = "12px sans-serif";
        const tipW = Math.min(frame.width, ctx.measureText(this.statusText).width + 20);
        this.drawHudPill(frame.left, tipY, tipW, 22, "rgba(255,248,230,0.95)", "#ffb347");
        ctx.fillStyle = "#d35400";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.statusText, frame.left + 10, tipY + 11);
      }
    }
    /** 糖果枝配色：对局粉 / 粉碎红 / 清洁薄荷绿 */
    getHudCandyPalette(inClean, inCrush) {
      if (inClean) {
        return {
          deep: "#1c7ed6",
          mid: "#74c0fc",
          lite: "#d0ebff",
          stripe: "#ffffff",
          accent: "#339af0",
          ink: "#1864ab",
          inkSoft: "#4dabf7",
          shadow: "#1c4b7a"
        };
      }
      if (inCrush) {
        return {
          deep: "#e03131",
          mid: "#ff8787",
          lite: "#ffe3e3",
          stripe: "#ffffff",
          accent: "#ff6b6b",
          ink: "#c92a2a",
          inkSoft: "#fa5252",
          shadow: "#862e2e"
        };
      }
      return {
        deep: "#f06595",
        mid: "#ffa8cc",
        lite: "#ffe3f0",
        stripe: "#ffffff",
        accent: "#ff85c0",
        ink: "#a61e4d",
        inkSoft: "#e64980",
        shadow: "#862e4b"
      };
    }
    /** 连接步数环与信息牌的立体糖果枝（拐杖糖条纹） */
    drawHudCandyBranchRail(fromX, fromY, toX, toY, candy) {
      const { ctx } = this;
      const midX = (fromX + toX) * 0.5;
      const midY = Math.min(fromY, toY) - 6;
      const pointAt = (t) => {
        const u = 1 - t;
        return {
          x: u * u * fromX + 2 * u * t * midX + t * t * toX,
          y: u * u * fromY + 2 * u * t * midY + t * t * toY
        };
      };
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = candy.shadow;
      ctx.lineWidth = 15;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(fromX + 2, fromY + 5);
      ctx.quadraticCurveTo(midX + 2, midY + 8, toX + 2, toY + 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const body = ctx.createLinearGradient(fromX, fromY - 12, fromX, fromY + 14);
      body.addColorStop(0, candy.lite);
      body.addColorStop(0.4, candy.mid);
      body.addColorStop(1, candy.deep);
      ctx.strokeStyle = body;
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.quadraticCurveTo(midX, midY, toX, toY);
      ctx.stroke();
      ctx.strokeStyle = candy.stripe;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.92;
      for (let i = 0; i < 7; i += 1) {
        const t0 = 0.08 + i * 0.12;
        const t1 = Math.min(0.98, t0 + 0.045);
        const a = pointAt(t0);
        const b = pointAt(t1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY - 4);
      ctx.quadraticCurveTo(midX, midY - 5, toX, toY - 4);
      ctx.stroke();
      this.drawHudCandyBud(fromX + (toX - fromX) * 0.28, midY + 4, -0.65, candy);
      this.drawHudCandyBud(fromX + (toX - fromX) * 0.7, midY + 2, 0.5, candy);
      ctx.restore();
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
    /** 糖果枝上的糖珠 / 小棒棒糖 */
    drawHudCandyBud(x, y, tilt, candy) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.strokeStyle = candy.mid;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(5, -7, 8, -14);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(7, -12);
      ctx.stroke();
      const ball = ctx.createRadialGradient(8, -18, 1, 8, -17, 7);
      ball.addColorStop(0, "#ffffff");
      ball.addColorStop(0.35, candy.lite);
      ball.addColorStop(1, candy.deep);
      ctx.fillStyle = ball;
      ctx.beginPath();
      ctx.arc(8, -17, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.arc(2, -8, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#74c0fc";
      ctx.beginPath();
      ctx.arc(12, -10, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
      ctx.strokeStyle = opts.low ? "#ff6b6b" : "#ffffff";
      ctx.lineWidth = opts.low ? 3.2 : 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 3.8, 0, Math.PI * 2);
      ctx.stroke();
      const pearls = [
        { x: -0.55, y: -0.82, color: "#ffe066" },
        { x: 0.05, y: -0.95, color: "#ff85c0" },
        { x: 0.58, y: -0.78, color: "#74c0fc" }
      ];
      for (const p of pearls) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(cx + r * p.x, cy + r * p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = opts.low ? "#e03131" : c.inkSoft;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.label, cx, cy - 9);
      ctx.fillStyle = opts.low ? "#c92a2a" : c.ink;
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
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#8d6e4a";
      this.roundRectPath(x + 1.5, y + 3, w, h, r);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#fff8f0";
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
    drawHudPill(x, y, w, h, fill, stroke) {
      const { ctx } = this;
      const r = Math.min(h / 2, 14);
      ctx.save();
      ctx.fillStyle = fill;
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
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#7a5a3a";
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
          this.drawBuriedSprite(
            this.buriedSnowman,
            dx,
            dy,
            dw,
            dh,
            () => this.drawCuteSnowman(dx, dy, dw, dh)
          );
        } else if (group.kind === BURIED_PENGUIN) {
          this.drawBuriedSprite(
            this.buriedPenguin,
            dx,
            dy,
            dw,
            dh,
            () => this.drawCutePenguin(dx, dy, dw, dh)
          );
        }
        ctx.restore();
      }
    }
    iceEncasesAnimals() {
      var _a;
      return ((_a = this.session.getLevelConfig()) == null ? void 0 : _a.iceStyle) === "encase";
    }
    drawIceOnSlot(x, y, s, slotR) {
      const { ctx } = this;
      ctx.save();
      this.roundRectPath(x, y, s, s, slotR);
      ctx.clip();
      const frost = ctx.createLinearGradient(x, y, x + s, y + s);
      frost.addColorStop(0, "rgba(186, 232, 255, 0.95)");
      frost.addColorStop(0.5, "rgba(140, 206, 242, 0.88)");
      frost.addColorStop(1, "rgba(210, 244, 255, 0.92)");
      ctx.fillStyle = frost;
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.1, y + s * 0.82);
      ctx.lineTo(x + s * 0.28, y + s * 0.92);
      ctx.moveTo(x + s * 0.72, y + s * 0.1);
      ctx.lineTo(x + s * 0.9, y + s * 0.22);
      ctx.stroke();
      ctx.strokeStyle = "rgba(90, 170, 220, 0.95)";
      ctx.lineWidth = 2.2;
      this.roundRectPath(x + 1, y + 1, s - 2, s - 2, Math.max(3, slotR - 1));
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      this.roundRectPath(x + 3, y + 3, s - 6, s - 6, Math.max(2, slotR - 2));
      ctx.stroke();
      ctx.restore();
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
          this.drawFrozenOverlay(x, y, cs, slotR, r, c);
        }
      }
    }
    drawFrozenOverlay(x, y, s, slotR, row, col) {
      const { ctx } = this;
      ctx.save();
      this.roundRectPath(x + 1, y + 1, s - 2, s - 2, slotR);
      ctx.clip();
      const sheet = ctx.createLinearGradient(x, y, x + s, y + s);
      sheet.addColorStop(0, "rgba(236, 250, 255, 0.42)");
      sheet.addColorStop(0.35, "rgba(164, 220, 245, 0.5)");
      sheet.addColorStop(0.7, "rgba(120, 198, 236, 0.46)");
      sheet.addColorStop(1, "rgba(210, 242, 255, 0.4)");
      ctx.fillStyle = sheet;
      ctx.fillRect(x, y, s, s);
      const gloss = ctx.createLinearGradient(x, y, x, y + s * 0.45);
      gloss.addColorStop(0, "rgba(255,255,255,0.55)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss;
      ctx.fillRect(x, y, s, s * 0.38);
      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.12, y + s * 0.22);
      ctx.lineTo(x + s * 0.28, y + s * 0.08);
      ctx.moveTo(x + s * 0.18, y + s * 0.7);
      ctx.lineTo(x + s * 0.34, y + s * 0.88);
      ctx.moveTo(x + s * 0.62, y + s * 0.16);
      ctx.lineTo(x + s * 0.86, y + s * 0.34);
      ctx.stroke();
      const crack = this.cottonHash(row, col, 9);
      ctx.strokeStyle = "rgba(70, 150, 200, 0.45)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x + s * (0.2 + crack * 0.15), y + s * 0.12);
      ctx.lineTo(x + s * 0.42, y + s * (0.4 + crack * 0.1));
      ctx.lineTo(x + s * (0.55 + crack * 0.1), y + s * 0.78);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2.4;
      this.roundRectPath(x + 2, y + 2, s - 4, s - 4, Math.max(4, slotR - 1));
      ctx.stroke();
      ctx.strokeStyle = "rgba(80, 170, 220, 0.55)";
      ctx.lineWidth = 1.2;
      this.roundRectPath(x + 4, y + 4, s - 8, s - 8, Math.max(3, slotR - 2));
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
      ctx.save();
      ctx.fillStyle = "rgba(90, 40, 70, 0.28)";
      ctx.translate(cx, cy + r * 0.55);
      ctx.scale(1, 0.3);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const ball = ctx.createRadialGradient(
        cx - r * 0.28,
        cy - r * 0.4,
        r * 0.06,
        cx + r * 0.1,
        cy + r * 0.14,
        r * 1.08
      );
      ball.addColorStop(0, "#fff7fb");
      ball.addColorStop(0.16, "#ffc4de");
      ball.addColorStop(0.42, "#ff7eb6");
      ball.addColorStop(0.74, "#ee4588");
      ball.addColorStop(1, "#b01d58");
      ctx.fillStyle = ball;
      ctx.fillRect(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2);
      const shade = ctx.createRadialGradient(
        cx,
        cy + r * 0.58,
        r * 0.08,
        cx,
        cy + r * 0.12,
        r
      );
      shade.addColorStop(0, "rgba(132, 18, 68, 0.46)");
      shade.addColorStop(1, "rgba(132, 18, 68, 0)");
      ctx.fillStyle = shade;
      ctx.fillRect(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2);
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = Math.max(1.1, r * 0.11);
      for (let i = 0; i < 3; i += 1) {
        const oy = cy - r * 0.24 + i * r * 0.27;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.74, oy);
        ctx.quadraticCurveTo(cx, oy + (i % 2 === 0 ? -r * 0.18 : r * 0.18), cx + r * 0.76, oy);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(190, 28, 92, 0.32)";
      ctx.lineWidth = Math.max(0.7, r * 0.065);
      for (let i = 0; i < 3; i += 1) {
        const oy = cy - r * 0.16 + i * r * 0.27;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.7, oy + r * 0.05);
        ctx.quadraticCurveTo(cx + r * 0.06, oy + (i % 2 === 0 ? r * 0.16 : -r * 0.16), cx + r * 0.72, oy);
        ctx.stroke();
      }
      const grain = Math.max(8, Math.round(r * 0.6));
      const seed = Math.floor(cx * 13 + cy * 17);
      for (let i = 0; i < grain; i += 1) {
        const a = (i * 2.39996 + seed * 0.01) % (Math.PI * 2);
        const d = r * (0.16 + (i * 19 + seed) % 72 / 125);
        const gx = cx + Math.cos(a) * d;
        const gy = cy + Math.sin(a) * d * 0.9;
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.5)" : "rgba(255, 176, 208, 0.58)";
        ctx.beginPath();
        ctx.arc(gx, gy, r * (0.026 + i % 3 * 0.01), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.translate(cx - r * 0.3, cy - r * 0.36);
      ctx.rotate(-0.55);
      ctx.scale(1, 0.52);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(cx + r * 0.22, cy - r * 0.2, r * 0.065, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(176, 32, 90, 0.5)";
      ctx.lineWidth = Math.max(0.9, s * 0.022);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 232, 242, 0.95)";
      ctx.lineWidth = Math.max(1.1, s * 0.026);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.94, Math.PI * 1.05, Math.PI * 1.85);
      ctx.stroke();
      ctx.restore();
    }
    drawBuriedSprite(sprite, x, y, w, h, fallback) {
      var _a, _b;
      const iw = (_a = sprite == null ? void 0 : sprite.width) != null ? _a : 0;
      const ih = (_b = sprite == null ? void 0 : sprite.height) != null ? _b : 0;
      if (!sprite || iw <= 0 || ih <= 0) {
        fallback();
        return;
      }
      const k = Math.max(w / iw, h / ih) * 1.08;
      const dw = iw * k;
      const dh = ih * k;
      const dx = x + (w - dw) / 2;
      const dy = y + h - dh + h * 0.03;
      this.ctx.drawImage(sprite, dx, dy, dw, dh);
    }
    fillCuteBall(cx, cy, r, lite, mid, deep) {
      const { ctx } = this;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      try {
        const g = ctx.createRadialGradient(
          cx - r * 0.32,
          cy - r * 0.38,
          r * 0.08,
          cx,
          cy + r * 0.08,
          r
        );
        g.addColorStop(0, lite);
        g.addColorStop(0.55, mid);
        g.addColorStop(1, deep);
        ctx.fillStyle = g;
      } catch (e) {
        ctx.fillStyle = mid;
      }
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.22, cy - r * 0.32, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawCuteSnowman(x, y, w, h) {
      const { ctx } = this;
      const s = Math.min(w, h);
      const cx = x + w * 0.5;
      ctx.save();
      ctx.fillStyle = "rgba(70, 100, 130, 0.18)";
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.93, s * 0.34, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      const baseR = s * 0.3;
      const midR = s * 0.23;
      const headR = s * 0.175;
      const baseY = y + h * 0.74;
      const midY = y + h * 0.48;
      const headY = y + h * 0.26;
      ctx.strokeStyle = "#8b5a2b";
      ctx.lineWidth = Math.max(2.2, s * 0.035);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - midR * 0.85, midY);
      ctx.quadraticCurveTo(cx - s * 0.42, midY - s * 0.02, cx - s * 0.46, midY - s * 0.16);
      ctx.moveTo(cx + midR * 0.85, midY);
      ctx.quadraticCurveTo(cx + s * 0.4, midY + s * 0.02, cx + s * 0.48, midY - s * 0.12);
      ctx.stroke();
      this.fillCuteBall(cx, baseY, baseR, "#ffffff", "#eef7ff", "#b9d0e4");
      this.fillCuteBall(cx, midY, midR, "#ffffff", "#f4fbff", "#c4d8ea");
      this.fillCuteBall(cx, headY, headR, "#ffffff", "#f7fcff", "#cddcea");
      ctx.fillStyle = "#1f2933";
      for (const t of [-0.06, 0.02, 0.1]) {
        ctx.beginPath();
        ctx.arc(cx, midY + s * t, s * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ff6b8a";
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(cx - headR * 0.42, headY + headR * 0.18, headR * 0.18, headR * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + headR * 0.42, headY + headR * 0.18, headR * 0.18, headR * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#2b3540";
      ctx.beginPath();
      ctx.arc(cx - headR * 0.28, headY - headR * 0.08, headR * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + headR * 0.28, headY - headR * 0.08, headR * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx - headR * 0.24, headY - headR * 0.12, headR * 0.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + headR * 0.32, headY - headR * 0.12, headR * 0.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8a3d";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.01, headY + headR * 0.02);
      ctx.lineTo(cx + headR * 0.72, headY + headR * 0.12);
      ctx.lineTo(cx - s * 0.01, headY + headR * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffc48a";
      ctx.beginPath();
      ctx.arc(cx + headR * 0.18, headY + headR * 0.1, s * 0.012, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e85d4c";
      ctx.beginPath();
      ctx.ellipse(cx, midY - midR * 0.72, s * 0.2, s * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx + s * 0.08, midY - midR * 0.7, s * 0.09, s * 0.16);
      const brimW = headR * 1.35;
      const hatY = headY - headR * 0.72;
      ctx.fillStyle = "#3d4f6f";
      ctx.beginPath();
      ctx.ellipse(cx, hatY + headR * 0.12, brimW, headR * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4c6488";
      this.roundRectPath(
        cx - headR * 0.62,
        hatY - headR * 0.55,
        headR * 1.24,
        headR * 0.72,
        headR * 0.16
      );
      ctx.fill();
      ctx.fillStyle = "#ffd56a";
      ctx.fillRect(cx - headR * 0.62, hatY - headR * 0.08, headR * 1.24, headR * 0.12);
      ctx.restore();
    }
    drawCutePenguin(x, y, w, h) {
      const { ctx } = this;
      const s = Math.min(w * 1.15, h);
      const cx = x + w * 0.5;
      ctx.save();
      ctx.fillStyle = "rgba(40, 60, 90, 0.16)";
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.94, s * 0.28, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      const bodyY = y + h * 0.58;
      const headY = y + h * 0.26;
      const bodyR = s * 0.3;
      ctx.fillStyle = "#1a2740";
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.3, bodyY + s * 0.02, s * 0.1, s * 0.16, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.3, bodyY + s * 0.02, s * 0.1, s * 0.16, 0.45, 0, Math.PI * 2);
      ctx.fill();
      this.fillCuteBall(cx, bodyY, bodyR, "#3a4d6b", "#24344f", "#152033");
      ctx.fillStyle = "#fff8ef";
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + s * 0.04, s * 0.18, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      this.fillCuteBall(cx, headY, s * 0.2, "#4a5f80", "#2a3b56", "#182436");
      ctx.fillStyle = "#fff8ef";
      ctx.beginPath();
      ctx.ellipse(cx, headY + s * 0.04, s * 0.13, s * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8aa8";
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.11, headY + s * 0.06, s * 0.045, s * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.11, headY + s * 0.06, s * 0.045, s * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.07, headY - s * 0.02, s * 0.055, s * 0.062, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.07, headY - s * 0.02, s * 0.055, s * 0.062, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b2433";
      ctx.beginPath();
      ctx.arc(cx - s * 0.065, headY - s * 0.015, s * 0.028, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + s * 0.075, headY - s * 0.015, s * 0.028, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx - s * 0.055, headY - s * 0.03, s * 0.01, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + s * 0.085, headY - s * 0.03, s * 0.01, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffb703";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.055, headY + s * 0.05);
      ctx.quadraticCurveTo(cx, headY + s * 0.13, cx + s * 0.055, headY + s * 0.05);
      ctx.quadraticCurveTo(cx, headY + s * 0.075, cx - s * 0.055, headY + s * 0.05);
      ctx.fill();
      ctx.fillStyle = "#ff9f1c";
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.1, y + h * 0.9, s * 0.1, s * 0.045, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.1, y + h * 0.9, s * 0.1, s * 0.045, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
      const { ctx } = this;
      const cs = layout.cellSize;
      const slotR = Math.max(6, Math.floor(cs * 0.18));
      const cloudy = [];
      for (let r = 0; r < board.size.rows; r += 1) {
        for (let c = 0; c < board.size.cols; c += 1) {
          const layers = this.getDisplayCloud(board, r, c);
          if (layers > 0) {
            cloudy.push({ r, c, layers });
          }
        }
      }
      if (cloudy.length === 0) {
        return;
      }
      const cloudyAt = (row, col) => row >= 0 && col >= 0 && row < board.size.rows && col < board.size.cols && this.getDisplayCloud(board, row, col) > 0;
      for (const cell of cloudy) {
        const layers = cell.layers;
        const left = cloudyAt(cell.r, cell.c - 1);
        const right = cloudyAt(cell.r, cell.c + 1);
        const up = cloudyAt(cell.r + 1, cell.c);
        const down = cloudyAt(cell.r - 1, cell.c);
        let x = layout.originX + cell.c * cs;
        let y = layout.originY - (cell.r + 1) * cs;
        let w = cs;
        let h = cs;
        const join = Math.max(3, Math.ceil(cs * 0.08));
        if (left) {
          x -= join;
          w += join;
        }
        if (right) {
          w += join;
        }
        if (up) {
          y -= join;
          h += join;
        }
        if (down) {
          h += join;
        }
        const cx = layout.originX + (cell.c + 0.5) * cs;
        const cy = layout.originY - (cell.r + 0.5) * cs;
        ctx.save();
        this.roundRectPath(x, y, w, h, Math.max(4, slotR * 0.45));
        ctx.clip();
        ctx.fillStyle = layers <= 1 ? "rgba(242, 246, 250, 0.38)" : "#f2f6fa";
        ctx.fillRect(x, y, w, h);
        this.drawThickCotton(cx, cy, cs * 0.98, cell.r, cell.c, layers);
        ctx.restore();
      }
    }
    drawThickCotton(cx, cy, s, row, col, layers = 2) {
      const { ctx } = this;
      const worn = layers <= 1;
      ctx.save();
      ctx.globalAlpha = worn ? 0.42 : 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const puffCount = worn ? 4 : 6;
      for (let i = 0; i < puffCount; i += 1) {
        const u = this.cottonHash(row, col, i);
        const v = this.cottonHash(row, col, i + 18);
        const w = this.cottonHash(row, col, i + 36);
        const px = cx + (u - 0.5) * s * 0.58;
        const py = cy + (v - 0.5) * s * 0.58;
        const pr = s * (0.18 + w * 0.16);
        ctx.fillStyle = `rgba(${210 + Math.round(w * 30)}, ${220 + Math.round(u * 20)}, ${228 + Math.round(v * 18)}, ${worn ? 0.55 : 0.92})`;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      const fiber = this.lite ? 5 : 8;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.1;
      for (let i = 0; i < fiber; i += 1) {
        const u = this.cottonHash(row, col, i + 80);
        const v = this.cottonHash(row, col, i + 102);
        const ang = u * Math.PI * 2;
        const len = s * (0.12 + v * 0.22);
        const ox = cx + (u - 0.5) * s * 0.5;
        const oy = cy + (v - 0.5) * s * 0.5;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      const dots = this.lite ? 4 : 6;
      for (let i = 0; i < dots; i += 1) {
        const u = this.cottonHash(row, col, i + 280);
        const v = this.cottonHash(row, col, i + 300);
        ctx.beginPath();
        ctx.arc(cx + (u - 0.5) * s * 0.62, cy + (v - 0.5) * s * 0.62, 1.1, 0, Math.PI * 2);
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
        const count = this.lite ? 8 : 10;
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
      const beads = this.lite ? 2 : 3;
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
      const fill = this.mode === "clean" ? "rgba(51, 154, 240, 0.94)" : "rgba(255, 90, 120, 0.94)";
      this.drawHudPill(x, y, w, h, fill, "#ffffff");
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
        top: "#ffb347",
        bottom: "#ff8c42",
        border: "#ffffff",
        gloss: true
      });
      this.drawCuteButton(skipBtn, {
        top: "#ff7eb3",
        bottom: "#ff4d8d",
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
      ctx.fillStyle = `rgba(40, 20, 50, ${anim.veilAlpha * (isFail ? 1 : 0.72)})`;
      ctx.fillRect(0, 0, width, height);
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
        fillTop: isFail ? "rgba(255,255,255,0.96)" : "rgba(180, 235, 120, 0.98)",
        fillBottom: isFail ? "rgba(240,240,245,0.94)" : "rgba(120, 200, 70, 0.96)",
        border: isFail ? "#c5c8d0" : "#7bc84a",
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
      ctx.fillStyle = isFail ? "#7f8c8d" : "#2d6a1f";
      ctx.fillText(title, 0, -14);
      ctx.restore();
      ctx.font = "bold 17px sans-serif";
      ctx.fillStyle = isFail ? "#6b5344" : "#3d5c2e";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.scale(anim.scorePunch, anim.scorePunch);
      ctx.fillText(`\u5F97\u5206 ${anim.displayScore}`, 0, 18);
      ctx.restore();
      if (isFail) {
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#8d6e63";
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
        const stagger = clamp012((anim.buttonProgress - i * 0.12) / 0.55);
        const slide = (1 - easeOutBackLocal(stagger)) * 36;
        const palette = b.id === "revive" ? { top: "#ffc078", bottom: "#ff922b", border: "#ffffff", gloss: true } : b.id === "next" ? { top: "#8ce99a", bottom: "#37b24d", border: "#ffffff", gloss: true } : b.id === "lobby" ? { top: "#a5d8ff", bottom: "#4dabf7", border: "#ffffff", gloss: true } : { top: "#ffa8d4", bottom: "#ff6baf", border: "#ffffff", gloss: true };
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
        const stagger = clamp012((anim.buttonProgress - i * 0.1) / 0.55);
        const slide = (1 - easeOutBackLocal(stagger)) * 20;
        const palette = b.id === "next" ? { top: "#ffd43b", bottom: "#ff922b", border: "#ffffff", gloss: true } : b.id === "lobby" ? { top: "#a5d8ff", bottom: "#4dabf7", border: "#ffffff", gloss: true } : { top: "#ffa8d4", bottom: "#ff6baf", border: "#ffffff", gloss: true };
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
        const stagger = clamp012((anim.buttonProgress - i * 0.12) / 0.55);
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
      var _a;
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
          ctx.fillStyle = "#ffd6ef";
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
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        this.roundRectPath(
          btn.x + 6,
          btn.y + 4,
          btn.w - 12,
          btn.h * 0.38,
          Math.max(8, r - 8)
        );
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 2.5;
      this.roundRectPath(btn.x + 1.5, btn.y + 1.5, btn.w - 3, btn.h - 3, r - 1);
      ctx.stroke();
      if (btn.label) {
        const fontSize = btn.h <= 28 ? 13 : btn.h <= 36 ? 15 : 17;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(120,40,90,0.25)";
        ctx.lineWidth = 3;
        ctx.strokeText(btn.label, cx, cy + 1);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(btn.label, cx, cy);
      }
      ctx.restore();
    }
  };
  function clamp012(v) {
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

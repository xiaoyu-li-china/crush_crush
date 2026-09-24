import type {
  AdShowResult,
  IAdService,
  IAnalytics,
  IAudio,
  IPlatform,
  IStorage,
} from '../core';
import type { IPlayerCloudSave } from '../core/ports/IPlayerCloudSave';
import { mergePlayerCloudSnapshots } from '../logic/save/mergePlayerCloudSave';
import { createSeededRandom } from '../core/utils/math';
import { BoardModel } from '../logic/board/BoardModel';
import { generatePlayableBoard } from '../logic/board/BoardGenerator';
import { applyBoardShape } from '../logic/board/BoardShape';
import { hasAnyValidMove, shuffleUntilPlayable } from '../logic/board/BoardShuffle';
import { MatchFinder } from '../logic/board/MatchFinder';
import { MatchResolver } from '../logic/board/MatchResolver';
import { MoveValidator } from '../logic/board/MoveValidator';
import { expandSparkleBlasts, expandSpecialClears } from '../logic/board/SpecialRules';
import { isBasicTile, isHole, isSpecialTile, TileKind } from '../logic/board/TileType';
import { AdPlacementPolicy } from '../logic/economy/AdPlacementPolicy';
import { lobbyBannerReserveHeight } from '../core/utils/lobbyBanner';
import {
  canCreateWxFullscreenAds,
  isWxDesktopIdeHost,
  shouldUnlockAllLevelsForPreview,
} from '../core/utils/wxHost';
import {
  applyDailyLogin,
  claimDailyShuffle,
  EMPTY_DAILY_LOOP,
  recordDailyClear,
  type DailyLoopData,
} from '../logic/economy/DailyLoop';
import {
  addInviteHammers,
  applyInviteCredit,
  bindPendingInviter,
  EMPTY_INVITE_STATE,
  ensureInviteCode,
  grantInviteeGift,
  hydrateInviteFromCloud,
  isFreshPlayer,
  parseInviterFromQuery,
  parseInviteState,
  toInviteCloudSlice,
  type InviteState,
} from '../logic/economy/InviteLoop';
import { RevivePolicy, type ReviveOffer } from '../logic/economy/RevivePolicy';
import {
  BoosterInventory,
  type BoosterId,
  type BoosterStock,
} from '../logic/economy/BoosterInventory';
import {
  addBoosterToWallet,
  boosterRefillChannel,
  bumpBoosterAd,
  clampBoosterWallet,
  EMPTY_BOOSTER_WALLET,
  LEFTOVER_MOVES_FOR_EXTRA,
  markBoosterShare,
  type BoosterRefillChannel,
} from '../logic/economy/BoosterEconomy';
import { GameEventBus } from '../logic/events/GameEvents';
import { GameStateMachine } from '../logic/fsm/GameStateMachine';
import type { LevelConfig } from '../logic/level/LevelConfig';
import { LevelGoals } from '../logic/level/LevelGoals';
import {
  LevelProgress,
  normalizeLevelProgressData,
  type LevelProgressData,
} from '../logic/level/LevelProgress';
import {
  getActiveVineNode,
  isLevelUnlockedForPlayer,
  listAllVineNodes,
  type VineNodeInfo,
} from '../logic/level/LevelVine';
import { CrushRewardModel } from '../logic/crush/CrushRewardModel';
import { CrushResolver } from '../logic/crush/CrushResolver';
import { matchPraiseForScore } from '../logic/fx/MatchPraise';
import { StorageKeys, type PlayerSettings } from '../core/ports/IStorage';
import levelsJson from '../config/levels.json';
import adPlacementsJson from '../config/ad-placements.json';
import balanceJson from '../config/balance.json';
import itemsJson from '../config/items.json';
import noticeJson from '../config/notice.json';
import type { IChallengeApi } from '../core/ports/IChallengeApi';
import {
  formatLeaderboardLine,
  leaderboardRewardText,
  rankFriends,
} from '../logic/economy/FriendLeaderboard';
import type { LeaderboardView } from '../logic/economy/FriendLeaderboard';
import {
  ensureWxUserProfile,
  readCachedWxProfile,
} from '../core/adapters/WxUserProfile';

export interface GameSessionDeps {
  storage: IStorage;
  ads: IAdService;
  audio: IAudio;
  analytics: IAnalytics;
  platform: IPlatform;
  cloudSave?: IPlayerCloudSave;
  challengeApi?: IChallengeApi;
}

/** 看广告复活结果。 */
export type ReviveAdResult = 'revived' | 'skipped' | 'unavailable' | 'error';

/**
 * 单局 / 会话编排：棋盘交换、关卡目标、FSM 胜负、广告复活与下一关。
 */
export class GameSession {
  public readonly fsm: GameStateMachine;
  public readonly events: GameEventBus;
  public readonly progress: LevelProgress;

  private readonly finder = new MatchFinder();
  private readonly resolver = new MatchResolver(new MatchFinder());
  private readonly validator = new MoveValidator(new MatchFinder());
  private readonly crushResolver = new CrushResolver();
  private readonly revivePolicy: RevivePolicy;
  private readonly adPolicy: AdPlacementPolicy;
  /** 上次成功弹出通关插屏的时间，配合冷却避免连关连弹 */
  private lastInterstitialMs = 0;
  private interstitialShowing = false;
  /** 本次冷启动是否已尝试过进大厅插屏 */
  private launchInterstitialTried = false;
  private readonly boosters = new BoosterInventory();
  private daily: DailyLoopData = { ...EMPTY_DAILY_LOOP };
  private dailyGrantPending = false;
  private invite: InviteState = { ...EMPTY_INVITE_STATE };
  private inviteToast: string | null = null;
  private claimingInvite = false;
  private seenNoticeIds = new Set<string>();
  private readonly extraMovesGrant = itemsJson.extraMoves.moves;

  private board: BoardModel | null = null;
  private level: LevelConfig | null = null;
  private goals: LevelGoals | null = null;
  private movesLeft = 0;
  private score = 0;
  /** 交换手势里已播过本波第一档赞赏音，避免消除动画再播一次 */
  private firstWavePraisePlayed = false;
  private crush: CrushRewardModel | null = null;
  /** 清洁小游戏会话（与粉碎加成分离） */
  private clean: CrushRewardModel | null = null;
  /** 本局结算是否已用过一次清洁机会 */
  private cleaningUsedThisSettle = false;
  /** 当前结算是否来自通关（失败确认进结算则不弹通关插屏） */
  private lastSettleWon = false;
  /** 通关后待执行的剩余步数加成（开心消消乐式） */
  private pendingMovesBonus = false;
  /** 已经通知过「整只露出」的埋藏组，避免每波重复播。 */
  private readonly buriedNotified = new Set<number>();
  /** 云档拉过之后才允许回写，避免清缓存时空档盖掉微信用户进度。 */
  private cloudHydrated = false;
  private cloudPushInFlight = false;
  private cloudPushQueued = false;
  private iceAtStart = 0;
  private gemsAtStart = 0;
  private cloudsAtStart = 0;
  private eggsAtStart = 0;
  private vinesAtStart = 0;
  private crushFinaleMaxBursts =
    typeof balanceJson.crushFinaleMaxBursts === 'number'
      ? balanceJson.crushFinaleMaxBursts
      : 16;
  private crushTapPower =
    typeof balanceJson.crushDefaultTapPower === 'number'
      ? balanceJson.crushDefaultTapPower
      : 1;
  private cleanScoreThreshold =
    typeof balanceJson.cleanScoreThreshold === 'number'
      ? balanceJson.cleanScoreThreshold
      : 1500;
  private cleanDurationMs =
    typeof balanceJson.cleanDurationMs === 'number'
      ? balanceJson.cleanDurationMs
      : 20000;
  /** 测试或运行时可覆盖的关卡表 */
  private levelTable: LevelConfig[] = levelsJson as LevelConfig[];

  public constructor(private readonly deps: GameSessionDeps) {
    this.fsm = new GameStateMachine('Boot');
    this.events = new GameEventBus();
    this.progress = new LevelProgress();

    const movesGranted =
      typeof balanceJson.reviveMovesGranted === 'number'
        ? balanceJson.reviveMovesGranted
        : 5;
    this.revivePolicy = new RevivePolicy({
      maxRevivesPerLevel: Number.POSITIVE_INFINITY,
      movesGranted,
    });
    this.adPolicy = new AdPlacementPolicy({
      offerReviveOnFail: true,
      interstitialEveryNLevels: adPlacementsJson.interstitial_settle.everyNLevels ?? 2,
    });

    this.fsm.subscribe((from, to) => {
      this.events.emit({ type: 'StateChanged', from, to });
    });
  }

  /**
   * 初始化会话：读档并进入大厅。
   */
  public async init(): Promise<void> {
    let saved: LevelProgressData | null = null;
    let readOk = false;
    try {
      saved = await this.deps.storage.get<LevelProgressData>(StorageKeys.PlayerProgress);
      readOk = true;
    } catch {
      // 读档失败不写默认档，避免把已通关覆盖成新号。
    }
    if (readOk && saved) {
      this.progress.load(normalizeLevelProgressData(saved));
    }
    const settings = await this.deps.storage.get<PlayerSettings>(StorageKeys.Settings);
    if (settings && typeof settings.muted === 'boolean') {
      this.deps.audio.setMuted(settings.muted);
    }
    const savedDaily = await this.deps.storage.get<DailyLoopData>(StorageKeys.DailyLoop);
    const daily = applyDailyLogin(savedDaily, Date.now());
    this.daily = daily.data;
    this.dailyGrantPending = daily.grantedHammer;
    const savedWallet = await this.deps.storage.get<BoosterStock>(StorageKeys.Boosters);
    this.boosters.loadStock(clampBoosterWallet(savedWallet ?? EMPTY_BOOSTER_WALLET));
    const savedInvite = await this.deps.storage.get<InviteState>(StorageKeys.Invite);
    this.invite = ensureInviteCode(parseInviteState(savedInvite));
    const savedNotices = await this.deps.storage.get<string[]>(StorageKeys.NoticeSeen);
    this.seenNoticeIds = new Set(
      Array.isArray(savedNotices)
        ? savedNotices.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [],
    );
    if (daily.grantedHammer) {
      this.boosters.loadStock(addBoosterToWallet(this.boosters.getStock(), 'hammer', 1));
      this.daily = { ...this.daily, bonusHammer: 0 };
    }
    if (daily.grantedHammer || !savedDaily || savedWallet) {
      await this.deps.storage.set(StorageKeys.DailyLoop, this.daily);
      await this.deps.storage.set(
        StorageKeys.Boosters,
        clampBoosterWallet(this.boosters.getStock()),
      );
    }
    if (isWxDesktopIdeHost()) {
      // 模拟器不拉云，避免 cloud.init 堵死开发者工具。
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
    this.deps.analytics.track('app_boot');
    this.fsm.transitionTo('Lobby');
  }

  /**
   * 覆盖关卡表（单测注入短关卡用）。
   * @param levels - 关卡配置列表
   */
  public setLevelTable(levels: readonly LevelConfig[]): void {
    this.levelTable = levels.slice();
  }

  /**
   * 开始指定关卡。
   * @param levelId - 关卡 id
   */
  public async startLevel(levelId: number): Promise<void> {
    const config = this.findLevelConfig(levelId);
    await this.startLevelWithConfig(config);
  }

  /**
   * 使用完整配置开局（供测试或动态关卡）。
   * @param config - 关卡配置
   */
  public async startLevelWithConfig(config: LevelConfig): Promise<void> {
    const from = this.fsm.getCurrent();
    if (from === 'Boot') {
      this.fsm.transitionTo('Lobby');
    }

    if (!this.fsm.transitionTo('LoadingLevel')) {
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
    if (config.ice === 'all') {
      this.iceAtStart = this.board.coverPlayableWithIce();
    } else if (config.ice && typeof config.ice === 'object' && 'skipTopRows' in config.ice) {
      this.iceAtStart = this.board.coverPlayableSkippingTopRows(config.ice.skipTopRows);
    } else if (config.ice && typeof config.ice === 'object' && 'bottomRows' in config.ice) {
      this.iceAtStart = this.board.coverBottomRowsWithIce(config.ice.bottomRows);
    }
    this.board.iceLocksTiles = config.iceStyle === 'encase';
    // 必须在铺冰/锁定之后洗牌，否则 7–8 关只检查未冻结盘面会开局无合法滑动
    shuffleUntilPlayable(this.board, config.seed + 99);
    this.stabilizeBoard({ animate: false });
    if (config.buried) {
      const skipTop =
        config.ice && typeof config.ice === 'object' && 'skipTopRows' in config.ice
          ? config.ice.skipTopRows
          : 0;
      const placed = this.board.placeBuried(
        config.buried.snowmen,
        config.buried.penguins,
        config.seed + 17,
        { skipTopRows: skipTop, requireIce: true },
      );
      this.goals.bindCollectSnowmenTarget(placed.snowmen);
      this.goals.bindCollectPenguinsTarget(placed.penguins);
    }
    if (this.iceAtStart > 0) {
      this.iceAtStart = this.board.countIce();
      this.goals.bindClearIceTarget(this.iceAtStart);
    }
    // 粉球和棉花都在开局三消之后再铺，避免结算时把粉球提前收走
    if (typeof config.cloudGems === 'number' && config.cloudGems > 0) {
      this.gemsAtStart = this.board.placeGemsFromBottom(config.cloudGems);
      this.goals.bindCollectGemsTarget(this.gemsAtStart);
    }
    // 棉花在结算之后再铺，避免开局三消把旁边的棉花削掉
    if (config.cloud === 'all') {
      this.cloudsAtStart = this.board.coverPlayableWithCloud();
    } else if (config.cloud && typeof config.cloud === 'object' && 'midRows' in config.cloud) {
      const bottomCenterGap =
        'bottomCenterGap' in config.cloud && typeof config.cloud.bottomCenterGap === 'number'
          ? config.cloud.bottomCenterGap
          : 0;
      this.cloudsAtStart = this.board.coverMiddleRowsWithCloud(
        config.cloud.midRows,
        bottomCenterGap,
      );
    } else if (config.cloud && typeof config.cloud === 'object' && 'skipTopRows' in config.cloud) {
      this.cloudsAtStart = this.board.coverPlayableSkippingTopRowsWithCloud(config.cloud.skipTopRows);
    } else if (config.cloud && typeof config.cloud === 'object' && 'bottomRows' in config.cloud) {
      const centerCap =
        'centerCap' in config.cloud && typeof config.cloud.centerCap === 'number'
          ? config.cloud.centerCap
          : 0;
      const topCenterGap =
        'topCenterGap' in config.cloud && typeof config.cloud.topCenterGap === 'number'
          ? config.cloud.topCenterGap
          : 0;
      if (topCenterGap > 0) {
        const rightClear =
          'rightClear' in config.cloud && typeof config.cloud.rightClear === 'number'
            ? config.cloud.rightClear
            : 0;
        this.cloudsAtStart = this.board.coverBottomRowsWithCloudTopGap(
          config.cloud.bottomRows,
          topCenterGap,
          rightClear,
        );
      } else if (centerCap > 0) {
        this.cloudsAtStart = this.board.coverBottomRowsWithCloudCap(
          config.cloud.bottomRows,
          centerCap,
        );
      } else {
        this.cloudsAtStart = this.board.coverBottomRowsWithCloud(config.cloud.bottomRows);
      }
    } else if (typeof config.cloudRows === 'number' && config.cloudRows > 0) {
      this.cloudsAtStart = this.board.coverBottomRowsWithCloud(config.cloudRows);
    }
    if (this.cloudsAtStart > 0) {
      this.goals.bindClearCloudTarget(this.cloudsAtStart);
    }
    if (config.eggs) {
      this.eggsAtStart = this.board.placeEggs(
        config.eggs.count,
        config.eggs.layers ?? 1,
        config.seed + 31,
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
    this.deps.analytics.track('level_start', { levelId: config.id });
    void this.deps.ads.load('rewarded_revive');
    this.fsm.transitionTo('PlayerInput');
    this.events.emit({ type: 'BoardChanged', version: this.board.version });
    this.emitGoalProgress();
  }

  public getBoard(): BoardModel | null {
    return this.board;
  }

  public getLevelConfig(): LevelConfig | null {
    return this.level;
  }

  public getGoals(): LevelGoals | null {
    return this.goals;
  }

  public getMovesLeft(): number {
    return this.movesLeft;
  }

  /** 当前关卡剩余道具数量 */
  public getBoosterStock(): Readonly<BoosterStock> {
    return this.boosters.getStock();
  }

  public getBoosterCount(id: BoosterId): number {
    return this.boosters.getCount(id);
  }

  public getDailyLoop(): Readonly<DailyLoopData> {
    return { ...this.daily };
  }

  public getInviteState(): Readonly<InviteState> {
    return { ...this.invite };
  }

  public getInviteCode(): string {
    return this.invite.code;
  }

  /**
   * 在用户点击「好友排行」手势里尝试拉微信头像/昵称。
   * 未授权时返回 false，需 UI 弹出 createUserInfoButton。
   * 真实微信号永远拿不到，只用邀请码。
   */
  public async ensureWxUserProfile(): Promise<boolean> {
    const wxId = this.getInviteCode() || '';
    const profile = await ensureWxUserProfile(wxId);
    return !!profile?.avatarUrl || !!(profile && profile.nickName && profile.nickName !== '微信玩家');
  }

  /**
   * 玩家排行：拉取所有玩过本小游戏的用户。
   * 展示排名、头像、昵称、微信号、分数；接口不可用时至少展示自己。
   */
  public async loadFriendLeaderboard(): Promise<LeaderboardView> {
    const userId = this.getInviteCode() || 'me';
    const maxLevel = this.getMaxClearedLevelId();
    const profile = this.readWxProfile();
    const selfInput = {
      userId,
      maxLevel,
      bestTimeMs: null as number | null,
      completed: false,
      isSelf: true,
      nickName: profile.nickName || '微信玩家',
      avatarUrl: profile.avatarUrl,
      wxId: profile.wxId || userId,
      score: maxLevel,
    };

    const api = this.deps.challengeApi;
    if (api) {
      try {
        const res = await api.leaderboard(userId, maxLevel, {
          nickName:
            profile.nickName && profile.nickName !== '微信玩家'
              ? profile.nickName
              : undefined,
          avatarUrl: profile.avatarUrl || undefined,
        });
        if (res.ok && res.rows && res.rows.length > 0) {
          const rows = res.rows.map((row) =>
            formatLeaderboardLine({
              ...row,
              nickName:
                row.nickName
                || (row.isSelf ? profile.nickName || '微信玩家' : undefined),
              avatarUrl: row.avatarUrl || (row.isSelf ? profile.avatarUrl : undefined),
              wxId: row.wxId || row.userId,
              score: row.score ?? row.maxLevel,
            }),
          );
          return {
            title: noticeJson.leaderboard.title,
            hint: res.hint ?? '',
            rewardText: res.rewardText ?? leaderboardRewardText(),
            selfRank: res.selfRank ?? res.rows.find((r) => r.isSelf)?.rank ?? 0,
            rows,
          };
        }
        if (res.ok) {
          return {
            title: noticeJson.leaderboard.title,
            hint: res.hint ?? '',
            rewardText: res.rewardText ?? leaderboardRewardText(),
            selfRank: res.selfRank ?? 1,
            rows: [
              ...rankFriends([selfInput]).map(formatLeaderboardLine),
              { tag: '提示', text: noticeJson.leaderboard.empty, kind: 'meta' },
            ],
          };
        }
      } catch {
        // 走本地兜底
      }
    }

    const ranked = rankFriends([selfInput]);
    return {
      title: noticeJson.leaderboard.title,
      hint: '',
      rewardText: leaderboardRewardText(),
      selfRank: 1,
      rows: ranked.map(formatLeaderboardLine),
    };
  }

  private readWxProfile(): { nickName: string; avatarUrl?: string; wxId: string } {
    const wxId = this.getInviteCode();
    const cached = readCachedWxProfile(wxId);
    if (cached && cached.avatarUrl) {
      return {
        nickName: cached.nickName || '微信玩家',
        avatarUrl: cached.avatarUrl,
        wxId: cached.wxId || wxId,
      };
    }
    return { nickName: '微信玩家', wxId };
  }

  /** 从分享卡片绑定邀请人；仅新用户且非自己。 */
  public bindInviteFromQuery(query: Record<string, string>): boolean {
    const prev = this.invite.pendingInviter;
    this.invite = bindPendingInviter(
      this.invite,
      parseInviterFromQuery(query),
      isFreshPlayer(this.progress.getData()),
    );
    if (this.invite.pendingInviter && this.invite.pendingInviter !== prev) {
      this.deps.analytics.track('invite_bind', {
        inviter: this.invite.pendingInviter,
      });
      void this.persistInvite();
      return true;
    }
    return false;
  }

  /** 大厅弹出邀请锤子到账一次。 */
  public takeInviteToast(): string | null {
    const text = this.inviteToast;
    this.inviteToast = null;
    return text;
  }

  public hasSeenNotice(id: string): boolean {
    return this.seenNoticeIds.has(id);
  }

  public async markNoticeSeen(id: string): Promise<void> {
    if (!id || this.seenNoticeIds.has(id)) {
      return;
    }
    this.seenNoticeIds.add(id);
    await this.deps.storage.set(StorageKeys.NoticeSeen, [...this.seenNoticeIds]);
  }

  /** 大厅弹出「今日登录 +1 锤子」一次。 */
  public takeDailyGrantToast(): boolean {
    if (!this.dailyGrantPending) {
      return false;
    }
    this.dailyGrantPending = false;
    return true;
  }

  private async persistDaily(): Promise<void> {
    await this.deps.storage.set(StorageKeys.DailyLoop, this.daily);
    this.queueCloudPush();
  }

  private async persistBoosters(): Promise<void> {
    await this.deps.storage.set(StorageKeys.Boosters, clampBoosterWallet(this.boosters.getStock()));
    this.queueCloudPush();
  }

  private async persistInvite(): Promise<void> {
    await this.deps.storage.set(StorageKeys.Invite, this.invite);
    this.queueCloudPush();
  }

  private persistProgress(): void {
    void this.deps.storage.set(StorageKeys.PlayerProgress, this.progress.getData()).then(() => {
      this.queueCloudPush();
    });
  }

  private captureCloudSnapshot() {
    return {
      updatedAt: Date.now(),
      progress: this.progress.getData(),
      boosters: clampBoosterWallet(this.boosters.getStock()),
      settings: { muted: this.deps.audio.isMuted() },
      daily: { ...this.daily },
      invite: toInviteCloudSlice(this.invite),
    };
  }

  private queueCloudPush(): void {
    if (!this.cloudHydrated || !this.deps.cloudSave?.isEnabled()) {
      return;
    }
    if (this.cloudPushInFlight) {
      this.cloudPushQueued = true;
      return;
    }
    void this.flushCloudPush();
  }

  private async flushCloudPush(): Promise<void> {
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
      // 云失败不影响本地游玩，下次操作再推
    } finally {
      this.cloudPushInFlight = false;
      if (this.cloudPushQueued) {
        void this.flushCloudPush();
      }
    }
  }

  /** 用当前微信用户的云档和本地档合并：清缓存、换机、升版本都续关。 */
  private async syncCloudSave(): Promise<void> {
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
        this.boosters.loadStock(addBoosterToWallet(this.boosters.getStock(), 'hammer', 1));
        this.daily = { ...this.daily, bonusHammer: 0 };
        this.dailyGrantPending = true;
      }
      if (typeof merged.settings.muted === 'boolean') {
        this.deps.audio.setMuted(merged.settings.muted);
      }
      this.invite = hydrateInviteFromCloud(this.invite, merged.invite);
      const credited = applyInviteCredit(this.invite, merged.invite?.creditHammer ?? 0);
      this.invite = credited.state;
      if (credited.granted > 0) {
        this.boosters.loadStock(addInviteHammers(this.boosters.getStock(), credited.granted));
        this.inviteToast =
          credited.granted === 1
            ? '好友通关了，你也 +1 锤子'
            : `好友通关了，你 +${credited.granted} 锤子`;
      }
      await this.deps.storage.set(StorageKeys.PlayerProgress, this.progress.getData());
      await this.deps.storage.set(StorageKeys.Boosters, this.boosters.getStock());
      await this.deps.storage.set(StorageKeys.DailyLoop, this.daily);
      await this.deps.storage.set(StorageKeys.Settings, merged.settings);
      await this.deps.storage.set(StorageKeys.Invite, this.invite);
      this.cloudHydrated = true;
      await this.flushCloudPush();
    } catch {
      // 拉云失败禁止回写，避免空/旧本地盖掉微信档。
      this.cloudHydrated = false;
    }
  }

  private noteDailyClear(): void {
    this.daily = recordDailyClear(this.daily, Date.now());
    if (this.movesLeft >= LEFTOVER_MOVES_FOR_EXTRA && !this.daily.playExtraGranted) {
      this.boosters.add('extraMoves', 1);
      this.daily = { ...this.daily, playExtraGranted: true };
    }
    this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
    void this.persistDaily();
    void this.persistBoosters();
  }

  /** 大厅进度条满 3 格后，玩家点领取才发重排。 */
  public claimDailyShuffle(): boolean {
    const claimed = claimDailyShuffle(this.daily);
    if (!claimed.granted) {
      return false;
    }
    this.daily = claimed.data;
    this.boosters.add('shuffle', 1);
    this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
    void this.persistDaily();
    void this.persistBoosters();
    return true;
  }

  private commitLevelCleared(): void {
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

  private noteInviteFirstClear(): void {
    const gift = grantInviteeGift(this.invite);
    this.invite = gift.state;
    if (gift.granted > 0) {
      this.boosters.loadStock(addInviteHammers(this.boosters.getStock(), gift.granted));
      this.inviteToast = '邀请礼到账 +1 锤子';
      this.deps.analytics.track('invite_gift', { hammers: gift.granted });
      this.events.emit({
        type: 'InviteReward',
        kind: 'invitee',
        hammers: gift.granted,
      });
      void this.persistBoosters();
    }
    void this.persistInvite();
    void this.retryClaimInvite();
  }

  /** 实例方法，避免打包漏掉原型函数导致启动 TypeError。 */
  private retryClaimInvite = async (): Promise<void> => {
    if (this.claimingInvite) {
      return;
    }
    if (
      !this.invite.pendingInviter ||
      this.invite.cloudClaimed ||
      !this.invite.inviteeGiftGranted
    ) {
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
        this.deps.analytics.track('invite_claim', {
          inviter: this.invite.pendingInviter,
        });
        await this.persistInvite();
      }
    } catch {
      // 云函数未部署或网络失败时下次启动再试
    } finally {
      this.claimingInvite = false;
    }
  };

  /**
   * 锤子：清除一格并连锁下落（不消耗步数）。
   */
  public useHammer(row: number, col: number): boolean {
    if (this.fsm.getCurrent() !== 'PlayerInput' || !this.board || !this.level || !this.goals) {
      return false;
    }
    if (!this.boosters.canUse('hammer')) {
      return false;
    }
    if (!this.board.inBounds(row, col) || this.board.getTile(row, col) === TileKind.Empty) {
      return false;
    }
    if (this.board.getTile(row, col) === TileKind.Hole) {
      return false;
    }

    this.fsm.transitionTo('Resolving');
    if (!this.boosters.consume('hammer')) {
      this.fsm.transitionTo('PlayerInput');
      return false;
    }
    void this.persistBoosters();

    const clear = new Set<number>([this.board.index(row, col)]);
    const kind = this.board.getTile(row, col);
    if (kind === TileKind.ColorBomb) {
      let targetKind: TileKind | null = null;
      for (let i = 0; i < this.board.length; i += 1) {
        const k = this.board.cells[i] as TileKind;
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
    } else if (kind === TileKind.Bomb || this.board.isSparkle(row, col)) {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const rr = row + dr;
          const cc = col + dc;
          if (!this.board.inBounds(rr, cc)) {
            continue;
          }
          if (this.board.getTile(rr, cc) === TileKind.Empty) {
            continue;
          }
          clear.add(this.board.index(rr, cc));
        }
      }
    }
    expandSparkleBlasts(this.board, clear);
    const clearIndices = [...clear];

    const firstKinds: TileKind[] = clearIndices.map(
      (index) => this.board!.cells[index] as TileKind,
    );
    const playback = this.capturePlaybackSnapshot();

    this.playSfx('sfx_hammer');
    this.events.emit({
      type: 'BoosterUsed',
      boosterId: 'hammer',
      remaining: this.boosters.getCount('hammer'),
      row,
      col,
    });
    this.events.emit({ type: 'TilesCleared', indices: clearIndices, kinds: firstKinds });

    const emptyMatches = this.finder.findMatches(this.board);
    emptyMatches.size = 0;
    const result = this.resolver.resolve(this.board, emptyMatches, {
      seed: this.level.seed + this.board.version + 31,
      initialClearIndices: clearIndices,
      spawnSpecials: false,
    });

    this.events.emit({
      type: 'ResolvePlayback',
      ...playback,
      waves: result.waves,
    });

    this.score += result.cleared * 10;
    this.goals.applyClearedKinds(result.clearedKinds);
    this.goals.syncScore(this.score);
    this.emitGoalProgress();
    this.events.emit({ type: 'CascadeDone', depth: result.cascadeDepth });
    this.events.emit({ type: 'BoardChanged', version: this.board.version });
    this.evaluateLevelOutcome();
    return true;
  }

  /**
   * 重排：强制洗牌刷新盘面，直到有合法步（不消耗步数）。
   */
  public useShuffle(): boolean {
    if (this.fsm.getCurrent() !== 'PlayerInput' || !this.board || !this.level) {
      return false;
    }
    if (!this.boosters.consume('shuffle')) {
      return false;
    }
    void this.persistBoosters();
    const ok = shuffleUntilPlayable(
      this.board,
      this.level.seed + this.board.version + 777,
      48,
      true,
    );
    this.playSfx('sfx_shuffle');
    this.events.emit({
      type: 'BoosterUsed',
      boosterId: 'shuffle',
      remaining: this.boosters.getCount('shuffle'),
    });
    if (ok) {
      this.events.emit({ type: 'BoardShuffled', reason: 'booster' });
    }
    this.events.emit({ type: 'BoardChanged', version: this.board.version });
    this.stabilizeBoard({ animate: true });
    return true;
  }

  /**
   * 加步：增加若干步数。
   */
  public useExtraMoves(): boolean {
    if (this.fsm.getCurrent() !== 'PlayerInput' || !this.level) {
      return false;
    }
    if (!this.boosters.consume('extraMoves')) {
      return false;
    }
    void this.persistBoosters();
    this.movesLeft += this.extraMovesGrant;
    this.playSfx('sfx_extra');
    this.events.emit({
      type: 'BoosterUsed',
      boosterId: 'extraMoves',
      remaining: this.boosters.getCount('extraMoves'),
      movesGranted: this.extraMovesGrant,
    });
    return true;
  }

  public allowsRewardedBooster(_id: BoosterId): boolean {
    return this.fsm.getCurrent() === 'PlayerInput' && !!this.level;
  }

  public allowsRewardedExtraMoves(): boolean {
    return this.allowsRewardedBooster('extraMoves');
  }

  /** 空库存补给通道：好友 → 群 → 广告。非对局返回 none。 */
  public getBoosterRefillChannel(id: BoosterId): BoosterRefillChannel | 'none' {
    if (!this.allowsRewardedBooster(id)) {
      return 'none';
    }
    return boosterRefillChannel(this.daily, id);
  }

  /**
   * 转发好友 / 群成功后发 1 个道具。每个道具每天各允许 1 次。
   */
  public claimBoosterShare(id: BoosterId): boolean {
    const channel = this.getBoosterRefillChannel(id);
    if (channel !== 'friend' && channel !== 'group') {
      return false;
    }
    this.applyBoosterRefill(id, id === 'shuffle');
    this.daily = { ...this.daily, ...markBoosterShare(this.daily, id, channel) };
    void this.persistDaily();
    this.deps.analytics.track('booster_share', {
      boosterId: id,
      channel,
      levelId: this.level?.id ?? 0,
    });
    return true;
  }

  /** 只推进好友/群阶梯，不发道具（测试解锁广告通道用）。 */
  public markBoosterShareStep(id: BoosterId): boolean {
    const channel = this.getBoosterRefillChannel(id);
    if (channel !== 'friend' && channel !== 'group') {
      return false;
    }
    this.daily = { ...this.daily, ...markBoosterShare(this.daily, id, channel) };
    void this.persistDaily();
    return true;
  }

  /**
   * 库存为 0 且已用完当日好友/群转发后看广告：锤子/重排 +1；加步立刻 +5。
   */
  public async watchAdForBooster(id: BoosterId): Promise<ReviveAdResult> {
    if (this.getBoosterRefillChannel(id) !== 'ad') {
      return 'unavailable';
    }
    this.deps.analytics.track('ad_show', {
      placement: 'rewarded_revive',
      levelId: this.level!.id,
      reason: `booster_${id}`,
    });
    const result = await this.deps.ads.show('rewarded_revive');
    if (result === 'completed') {
      this.applyBoosterRefill(id, true);
      this.daily = { ...this.daily, ...bumpBoosterAd(this.daily, id) };
      void this.persistDaily();
      this.deps.analytics.track('ad_complete', {
        placement: 'rewarded_revive',
        reason: `booster_${id}`,
      });
      return 'revived';
    }
    if (result === 'skipped') {
      return 'skipped';
    }
    return result === 'not_ready' ? 'unavailable' : 'error';
  }

  private applyBoosterRefill(id: BoosterId, consumeShuffle: boolean): void {
    if (id === 'extraMoves') {
      this.movesLeft += this.extraMovesGrant;
      this.playSfx('sfx_extra');
      this.events.emit({
        type: 'BoosterUsed',
        boosterId: id,
        remaining: this.boosters.getCount(id),
        movesGranted: this.extraMovesGrant,
      });
      return;
    }
    if (id === 'shuffle') {
      this.boosters.add('shuffle', 1);
      this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
      if (consumeShuffle) {
        this.useShuffle();
      } else {
        void this.persistBoosters();
        this.playSfx('sfx_shuffle');
      }
      return;
    }
    this.boosters.add(id, 1);
    this.boosters.loadStock(clampBoosterWallet(this.boosters.getStock()));
    void this.persistBoosters();
    this.playSfx('sfx_hammer');
  }

  /**
   * 对局中看广告加 5 步（与失败复活同一激励广告位）。
   */
  public async watchAdToAddMoves(): Promise<ReviveAdResult> {
    return this.watchAdForBooster('extraMoves');
  }

  public setMuted(muted: boolean): void {
    this.deps.audio.setMuted(muted);
    void this.deps.storage.set<PlayerSettings>(StorageKeys.Settings, { muted });
    this.queueCloudPush();
  }

  public isMuted(): boolean {
    return this.deps.audio.isMuted();
  }

  /** 启动循环背景音乐（可重复调用，适配器内幂等） */
  public startBgm(): void {
    this.deps.audio.play('bgm_main', { loop: true, volume: 0.55 });
  }

  public suspendForBackground(): void {
    this.deps.audio.suspendForBackground?.();
  }

  public resumeFromBackground(): void {
    this.deps.audio.resumeFromBackground?.();
  }

  /** 首次触摸时预加载短音效，避免消除飘字时音效尚未就绪 */
  public preloadSfx(): void {
    this.deps.audio.preloadSfx?.();
  }

  /** 表现层按钮点击等短音效 */
  public playUiSfx(): void {
    this.playSfx('sfx_ui');
  }

  /** 消除 / 连锁音效（表现层波次回调用） */
  public playMatchSfx(): void {
    this.playSfx('sfx_match');
  }

  /** 按本波分值播放 Good / Great / Excellent */
  public playMatchPraiseSfx(score: number): void {
    this.playSfx(matchPraiseForScore(score).sfxId, 1);
  }

  /** 停掉未播完的赞赏音，避免通关残留音效在粉碎关里才响 */
  public stopMatchPraiseSfx(): void {
    this.deps.audio.stop('sfx_good');
    this.deps.audio.stop('sfx_great');
    this.deps.audio.stop('sfx_excellent');
  }

  /** 交换时已在手势里播过第一波，消除飘字阶段应跳过 */
  public takeFirstWavePraiseAlreadyPlayed(): boolean {
    const played = this.firstWavePraisePlayed;
    this.firstWavePraisePlayed = false;
    return played;
  }

  /** 过关结算打开时再播胜利音，和庆祝动画对齐 */
  public playWinSfx(): void {
    this.playSfx('sfx_win');
  }

  private playSfx(clipId: string, volume?: number): void {
    this.deps.audio.play(clipId, volume === undefined ? undefined : { volume });
  }

  public getScore(): number {
    return this.score;
  }

  /** 全部关卡配置（只读） */
  public getLevelTable(): readonly LevelConfig[] {
    return this.levelTable;
  }

  public getLevelCount(): number {
    return this.levelTable.length;
  }

  public getBestScore(levelId: number): number {
    return this.progress.getBestScore(levelId);
  }

  public isLevelUnlocked(levelId: number): boolean {
    return isLevelUnlockedForPlayer(
      levelId,
      this.progress.getHighestLevelId(),
      this.levelTable.length,
      shouldUnlockAllLevelsForPreview(),
    );
  }

  /** 开发版 / 体验版：大厅可点任意关预览效果。 */
  public isPreviewUnlockAll(): boolean {
    return shouldUnlockAllLevelsForPreview();
  }

  public isLevelCleared(levelId: number): boolean {
    return this.progress.isLevelCleared(levelId);
  }

  /** 已通关的最高关卡。highestLevelId 是下一关，所以要减 1，再和每关分数对一下。 */
  public getMaxClearedLevelId(): number {
    const data = this.progress.getData();
    const scored = Object.keys(data.levelScores ?? {})
      .map((key) => Number(key))
      .filter((id) => Number.isFinite(id) && this.progress.isLevelCleared(id));
    const fromScores = scored.length > 0 ? Math.max(...scored) : 0;
    const fromHighest = Math.max(0, data.highestLevelId - 1);
    return Math.max(fromScores, fromHighest);
  }



  /** 大厅藤蔓：当前节点的 5 关（兼容旧逻辑） */
  public getVineNode(): VineNodeInfo {
    return getActiveVineNode(
      this.progress.getHighestLevelId(),
      this.levelTable.length,
    );
  }

  /** 大厅地图：配置表里的每一段都展示，未解锁也能上滑看到。 */
  public listLobbyVineNodes(): VineNodeInfo[] {
    return listAllVineNodes(
      this.progress.getHighestLevelId(),
      this.levelTable.length,
    );
  }

  /**
   * 仅供单测：覆盖当前总分（用于清洁门槛等断言）。
   */
  public forceScoreForTest(score: number): void {
    this.score = Math.max(0, Math.floor(score));
  }

  /**
   * 当前粉碎奖励会话（未开启时为 null）。
   */
  public getCrushSession(): CrushRewardModel | null {
    return this.crush;
  }

  /**
   * 粉碎加成分（未开启为 0）。
   */
  public getCrushScore(): number {
    return this.crush?.crushScore ?? 0;
  }

  /**
   * 本局粉碎点击次数。
   */
  public getCrushTapCount(): number {
    return this.crush?.tapCount ?? 0;
  }

  /**
   * 清洁小游戏门槛分。
   */
  public getCleanScoreThreshold(): number {
    return this.cleanScoreThreshold;
  }

  /**
   * 清洁小游戏时长（毫秒）。
   */
  public getCleanDurationMs(): number {
    return this.cleanDurationMs;
  }

  /**
   * 当前是否可询问「进入清洁模式」（通关结算且总分达标，本关仅一次）。
   */
  public canOfferCleaning(): boolean {
    return (
      this.fsm.getCurrent() === 'Settle' &&
      !this.cleaningUsedThisSettle &&
      this.score >= this.cleanScoreThreshold
    );
  }

  /**
   * 清洁模式会话。
   */
  public getCleanSession(): CrushRewardModel | null {
    return this.clean;
  }

  /**
   * 开始清洁小游戏：刷新盘面，限时点击清扫（不计主线胜负压力）。
   */
  public startCleaningMode(): boolean {
    if (!this.canOfferCleaning() || !this.board || !this.level) {
      return false;
    }
    if (!this.fsm.transitionTo('Cleaning')) {
      return false;
    }
    this.cleaningUsedThisSettle = true;
    generatePlayableBoard(this.board, this.level.seed + 7777 + this.level.id);
    this.clean = new CrushRewardModel(this.cleanDurationMs, Math.max(1, this.crushTapPower));
    this.deps.analytics.track('crush_start', {
      levelId: this.level.id,
      mode: 'cleaning',
    });
    this.events.emit({ type: 'BoardChanged', version: this.board.version });
    return true;
  }

  /**
   * 结算时拒绝进入清洁模式（本关机会作废，不再弹窗）。
   */
  public declineCleaningOffer(): boolean {
    if (!this.canOfferCleaning()) {
      return false;
    }
    this.cleaningUsedThisSettle = true;
    return true;
  }

  /**
   * 结束清洁模式，回到结算。
   */
  public finishCleaningMode(): boolean {
    if (this.fsm.getCurrent() !== 'Cleaning') {
      return false;
    }
    this.deps.analytics.track('crush_end', {
      levelId: this.level?.id ?? 0,
      mode: 'cleaning',
      tapCount: this.clean?.tapCount ?? 0,
      cleanScore: this.clean?.crushScore ?? 0,
    });
    this.events.emit({
      type: 'CleaningEnded',
      cleanScore: this.clean?.crushScore ?? 0,
      tapCount: this.clean?.tapCount ?? 0,
    });
    this.clean = null;
    return this.fsm.transitionTo('Settle');
  }

  /**
   * 是否还有下一关配置。
   */
  public hasNextLevel(): boolean {
    if (!this.level) {
      return false;
    }
    return this.levelTable.some((item) => item.id === this.level!.id + 1);
  }

  /**
   * 尝试交换两格并结算；结束后按目标与步数更新 FSM。
   */
  public trySwap(
    rowA: number,
    colA: number,
    rowB: number,
    colB: number,
  ): boolean {
    if (this.fsm.getCurrent() !== 'PlayerInput' || !this.board || !this.level || !this.goals) {
      return false;
    }

    if (!this.validator.canSwap(this.board, rowA, colA, rowB, colB)) {
      this.events.emit({ type: 'SwapRejected', rowA, colA, rowB, colB });
      return false;
    }

    this.fsm.transitionTo('Resolving');
    this.board.swap(rowA, colA, rowB, colB);
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.playSfx('sfx_swap');
    this.events.emit({ type: 'SwapAccepted', rowA, colA, rowB, colB });

    const matches = this.finder.findMatches(this.board);
    const baseIndices: number[] = [];
    for (let i = 0; i < matches.size; i += 1) {
      baseIndices.push(matches.indices[i]!);
    }

    const kindA = this.board.getTile(rowA, colA);
    const kindB = this.board.getTile(rowB, colB);
    const sparkleCombo =
      this.board.isSparkle(rowA, colA) && this.board.isSparkle(rowB, colB);
    const specialMove =
      kindA === TileKind.ColorBomb ||
      kindB === TileKind.ColorBomb ||
      (isSpecialTile(kindA) && isSpecialTile(kindB)) ||
      sparkleCombo;

    const clearIndices = expandSpecialClears(
      this.board,
      rowA,
      colA,
      rowB,
      colB,
      baseIndices,
    );

    // 特殊交换但未产生任何清除（理论上不应发生）
    if (clearIndices.length === 0 && !specialMove) {
      this.board.swap(rowA, colA, rowB, colB);
      this.movesLeft += 1;
      this.fsm.transitionTo('PlayerInput');
      this.events.emit({ type: 'SwapRejected', rowA, colA, rowB, colB });
      return false;
    }

    if (clearIndices.length > 0) {
      this.playMatchPraiseSfx(Math.max(30, clearIndices.length * 10));
      this.firstWavePraisePlayed = true;
    }

    const firstKinds: TileKind[] = clearIndices.map(
      (index) => this.board!.cells[index] as TileKind,
    );

    const playback = this.capturePlaybackSnapshot();

    this.events.emit({
      type: 'TilesCleared',
      indices: clearIndices,
      kinds: firstKinds,
    });

    // 优先在玩家换入的那一格生成特殊块（开心消消乐手感）
    const preferredSpawnRow = rowB;
    const preferredSpawnCol = colB;

    const result = this.resolver.resolve(this.board, matches, {
      seed: this.level.seed + this.board.version,
      preferredSpawnRow,
      preferredSpawnCol,
      initialClearIndices: clearIndices,
      spawnSpecials: !(
        kindA === TileKind.ColorBomb || kindB === TileKind.ColorBomb
      ),
    });

    this.events.emit({
      type: 'ResolvePlayback',
      ...playback,
      waves: result.waves,
    });

    this.score += result.cleared * 10;
    this.goals.applyClearedKinds(result.clearedKinds);
    this.goals.syncScore(this.score);
    this.emitGoalProgress();

    if (result.fell.length > 0) {
      this.events.emit({
        type: 'TilesFell',
        moves: result.fell.map((f) => ({
          tileId: f.tileId,
          fromRow: f.fromRow,
          toRow: f.toRow,
          col: f.col,
        })),
      });
    }

    if (result.spawned.length > 0) {
      this.events.emit({
        type: 'TilesSpawned',
        indices: result.spawned.map((s) => this.board!.index(s.row, s.col)),
        tileIds: result.spawned.map((s) => s.tileId),
        kinds: result.spawned.map((s) => s.kind),
      });
    }

    this.events.emit({ type: 'CascadeDone', depth: result.cascadeDepth });
    this.events.emit({ type: 'BoardChanged', version: this.board.version });

    this.evaluateLevelOutcome();
    return true;
  }

  /**
   * 粉碎奖励 / 清洁模式：点击格子触发爆炸。
   * @returns 是否成功触发（状态/坐标非法时 false）
   */
  public tryCrushTap(row: number, col: number): boolean {
    const state = this.fsm.getCurrent();
    const burst =
      state === 'CrushReward' ? this.crush : state === 'Cleaning' ? this.clean : null;
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
    // 清洁模式不加主线总分，避免解压局扭曲闯关分数
    if (state === 'CrushReward') {
      this.score += scoreAdded;
    }

    const primary = result.fired[0];
    if (scoreAdded > 0) {
      this.playMatchPraiseSfx(scoreAdded);
    }
    this.events.emit({
      type: 'CrushBurstFired',
      row: primary?.epicenter.r ?? row,
      col: primary?.epicenter.c ?? col,
      radius: primary?.radius ?? burst.tapPower,
      clearedIndices: result.clearedIndices.slice(),
      scoreAdded,
    });
    this.events.emit({ type: 'BoardChanged', version: this.board.version });

    // 粉碎 / 清洁：盘面扫空后剩余立刻清零并弹出完成
    if (this.isBoardFullyCleared()) {
      burst.forceExpire();
      if (state === 'Cleaning') {
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
  public tickCrushReward(dtMs: number): boolean {
    const state = this.fsm.getCurrent();
    if (state === 'CrushReward' && this.crush) {
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
    if (state === 'Cleaning' && this.clean) {
      // 已扫空却仍有剩余：立刻清零收尾（防止空盘空等）
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
  public async watchAdToExtendCrush(): Promise<ReviveAdResult> {
    if (this.fsm.getCurrent() !== 'CrushReward' || !this.crush || !this.level) {
      return 'unavailable';
    }

    this.deps.analytics.track('ad_show', {
      placement: 'rewarded_crush_extend',
      levelId: this.level.id,
    });

    const result = await this.deps.ads.show('rewarded_crush_extend');
    if (result === 'completed') {
      const extra =
        typeof adPlacementsJson.rewarded_crush_extend.extraMs === 'number'
          ? adPlacementsJson.rewarded_crush_extend.extraMs
          : 5000;
      this.crush.extend(extra);
      this.deps.analytics.track('ad_complete', {
        placement: 'rewarded_crush_extend',
        extraMs: extra,
      });
      return 'revived';
    }

    if (result === 'skipped') {
      return 'skipped';
    }

    this.deps.analytics.track('ad_error', {
      placement: 'rewarded_crush_extend',
      result,
    });
    return result === 'not_ready' ? 'unavailable' : 'error';
  }

  /**
   * 粉碎结束：时间到或点领取。剩余小动物收尾爆炸加分，然后进结算，不必点完。
   * 注意：必须先进入 Settle，再发 CrushEnded，否则结算页询问清洁时状态仍是 CrushReward。
   */
  public finishCrushReward(): boolean {
    if (this.fsm.getCurrent() !== 'CrushReward') {
      return false;
    }

    let crushScore = 0;
    let leftoverCleared = 0;
    if (this.board && this.crush) {
      this.crush.clearQueue();
      const finale = this.crushResolver.resolveFinale(
        this.board,
        this.crush,
        this.crushFinaleMaxBursts,
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
        const primary = finale.fired[0]!;
        this.events.emit({
          type: 'CrushBurstFired',
          row: primary.epicenter.r,
          col: primary.epicenter.c,
          radius: primary.radius,
          clearedIndices: finale.clearedIndices.slice(),
          scoreAdded,
        });
        this.events.emit({ type: 'BoardChanged', version: this.board.version });
      }

      this.deps.analytics.track('crush_end', {
        levelId: this.level?.id ?? 0,
        crushScore: this.crush.crushScore,
        tapCount: this.crush.tapCount,
      });

      if (this.level) {
        this.commitLevelCleared();
      }
    }

    this.lastSettleWon = true;
    if (!this.fsm.transitionTo('Settle')) {
      return false;
    }

    this.events.emit({
      type: 'CrushEnded',
      crushScore,
      totalScore: this.score,
      leftoverCleared,
    });
    return true;
  }

  /**
   * 查询失败后的看广告复活报价（仅 LevelFailed 有效）。
   */
  public getReviveOffer(): ReviveOffer {
    if (this.fsm.getCurrent() !== 'LevelFailed' || !this.level) {
      return {
        allowed: false,
        movesGranted: 0,
        used: 0,
        maxPerLevel: 0,
      };
    }
    const decision = this.adPolicy.decideOnSettle(this.level.id, false);
    const offer = this.revivePolicy.offer();
    if (!decision.offerRewardedRevive) {
      return {
        allowed: false,
        movesGranted: 0,
        used: offer.used,
        maxPerLevel: offer.maxPerLevel,
      };
    }
    return offer;
  }

  /**
   * 观看激励视频复活：成功则加步并回到 PlayerInput。
   * @returns revived / skipped / unavailable / error
   */
  public async watchAdToRevive(): Promise<ReviveAdResult> {
    const offer = this.getReviveOffer();
    if (!offer.allowed || !this.level) {
      return 'unavailable';
    }

    this.deps.analytics.track('ad_show', {
      placement: 'rewarded_revive',
      levelId: this.level.id,
    });

    const result = await this.deps.ads.show('rewarded_revive');
    if (result === 'completed') {
      this.revivePolicy.consume();
      this.movesLeft += offer.movesGranted;
      this.deps.analytics.track('ad_complete', {
        placement: 'rewarded_revive',
        movesGranted: offer.movesGranted,
      });
      if (!this.fsm.transitionTo('PlayerInput')) {
        this.fsm.forceTo('PlayerInput');
      }
      return 'revived';
    }

    if (result === 'skipped') {
      return 'skipped';
    }

    this.deps.analytics.track('ad_error', {
      placement: 'rewarded_revive',
      result,
    });
    return result === 'not_ready' ? 'unavailable' : 'error';
  }

  /**
   * 通关离开结算时尝试插屏：点「下一关 / 回大厅」才弹，先让玩家看完胜利。
   * 未就绪或冷却中会静默跳过，不挡住去下一关。
   */
  public async maybeShowSettleInterstitial(): Promise<void> {
    if (this.fsm.getCurrent() !== 'Settle' || !this.level) {
      return;
    }
    const cooldownSeconds =
      typeof adPlacementsJson.interstitial_settle.cooldownSeconds === 'number'
        ? adPlacementsJson.interstitial_settle.cooldownSeconds
        : 60;
    const now = Date.now();
    if (
      !      this.adPolicy.shouldShowInterstitial(
        this.level.id,
        this.lastSettleWon,
        this.lastInterstitialMs,
        now,
        cooldownSeconds,
      )
    ) {
      return;
    }
    if (this.interstitialShowing) {
      return;
    }
    this.interstitialShowing = true;
    this.deps.analytics.track('ad_show', {
      placement: 'interstitial_settle',
      levelId: this.level.id,
    });
    try {
      const result = await this.deps.ads.show('interstitial_settle');
      if (result === 'completed' || result === 'skipped') {
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
  public async maybeShowLaunchInterstitial(): Promise<'shown' | 'retry' | 'stop'> {
    if (!this.isLaunchInterstitialEnabled()) {
      return 'stop';
    }
    if (this.launchInterstitialTried) {
      return 'stop';
    }
    if (this.fsm.getCurrent() !== 'Lobby') {
      return 'stop';
    }
    if (this.interstitialShowing) {
      return 'retry';
    }
    this.interstitialShowing = true;
    try {
      const result = await this.deps.ads.show('interstitial_settle');
      if (result === 'completed' || result === 'skipped') {
        this.launchInterstitialTried = true;
        this.lastInterstitialMs = Date.now();
        this.deps.analytics.track('ad_show', {
          placement: 'interstitial_settle',
          reason: 'launch',
        });
        return 'shown';
      }
      return 'retry';
    } finally {
      this.interstitialShowing = false;
    }
  }

  public isLaunchInterstitialEnabled(): boolean {
    return adPlacementsJson.interstitial_launch?.enabled === true;
  }

  /** 首页先画一帧再弹，毫秒。 */
  public getLaunchInterstitialDelayMs(): number {
    return this.readLaunchMs('delayMs', 800);
  }

  /** 被微信频控拦住后的重试间隔。 */
  public getLaunchInterstitialRetryMs(): number {
    return this.readLaunchMs('retryMs', 3000);
  }

  /** 大厅里最长等到何时放弃进门插屏。 */
  public getLaunchInterstitialTimeoutMs(): number {
    return this.readLaunchMs('timeoutMs', 35000);
  }

  private readLaunchMs(
    key: 'delayMs' | 'retryMs' | 'timeoutMs',
    fallback: number,
  ): number {
    const value = adPlacementsJson.interstitial_launch?.[key];
    return typeof value === 'number' && value >= 0 ? value : fallback;
  }

  /**
   * 大厅底部原生模板横幅：流量主已开通且填了广告位。
   */
  public isLobbyBannerEnabled(): boolean {
    const unit = adPlacementsJson.banner_lobby?.adUnitId;
    return (
      adPlacementsJson.banner_lobby?.enabled === true &&
      typeof unit === 'string' &&
      unit.startsWith('adunit-')
    );
  }

  /**
   * 大厅底部给横幅留的高度，设置/玩法按钮要抬上去。
   */
  public getLobbyBannerReservePx(): number {
    if (!this.isLobbyBannerEnabled()) {
      return 0;
    }
    const info = this.deps.platform.getSystemInfo();
    return lobbyBannerReserveHeight(
      info.windowWidth,
      info.windowHeight,
      info.safeAreaBottom ?? 0,
    );
  }

  /**
   * 在大厅展示底部横幅。进关或弹层时不要调。
   */
  public async showLobbyBanner(): Promise<AdShowResult> {
    if (!this.isLobbyBannerEnabled()) {
      this.hideLobbyBanner();
      return 'not_ready';
    }
    if (this.fsm.getCurrent() !== 'Lobby') {
      this.hideLobbyBanner();
      return 'error';
    }
    const result = await this.deps.ads.show('banner_lobby');
    if (this.fsm.getCurrent() !== 'Lobby') {
      this.hideLobbyBanner();
      return 'error';
    }
    if (result === 'completed') {
      this.deps.analytics.track('ad_show', { placement: 'banner_lobby' });
    }
    return result;
  }

  /**
   * 隐藏大厅横幅（进关、设置页、切后台）。
   */
  public hideLobbyBanner(): void {
    this.deps.ads.hide?.('banner_lobby');
  }

  /**
   * 画布起来后再预加载广告，避免启动瞬间创建原生广告卡死模拟器。
   */
  public warmupAds(): void {
    if (!canCreateWxFullscreenAds()) {
      return;
    }
    void this.deps.ads.load('rewarded_revive');
    void this.deps.ads.load('interstitial_settle');
    setTimeout(() => {
      void this.deps.ads.load('rewarded_crush_extend');
    }, 800);
  }

  /**
   * 失败确认后进入结算态（放弃复活）。
   */
  public acknowledgeFailure(): boolean {
    if (this.fsm.getCurrent() !== 'LevelFailed') {
      return false;
    }
    this.lastSettleWon = false;
    return this.fsm.transitionTo('Settle');
  }

  /**
   * 结算后进入下一关。
   * 插屏由界面在带遮罩的 runDuringAd 里先弹，这里只切关，避免连弹两次。
   * @returns 是否成功开局；无下一关时返回 false（保持结算态）
   */
  public async continueToNextLevel(): Promise<boolean> {
    if (this.fsm.getCurrent() !== 'Settle' || !this.level) {
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
  public async retryLevel(): Promise<boolean> {
    if (this.fsm.getCurrent() !== 'Settle' || !this.level) {
      return false;
    }
    await this.startLevel(this.level.id);
    return true;
  }

  /**
   * 结算后返回大厅。
   */
  public returnToLobby(): boolean {
    if (this.fsm.getCurrent() !== 'Settle') {
      return false;
    }
    return this.fsm.transitionTo('Lobby');
  }

  /**
   * 任意对局态中途退出回首页（放弃当前关）。
   */
  public quitToLobby(): boolean {
    const state = this.fsm.getCurrent();
    if (state === 'Lobby' || state === 'Boot') {
      return true;
    }
    this.crush = null;
    this.clean = null;
    this.cleaningUsedThisSettle = false;
    this.board = null;
    this.goals = null;
    // level 保留最后一关信息也可清掉；回大厅不依赖它
    return this.fsm.forceTo('Lobby');
  }

  public dispose(): void {
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
  private evaluateLevelOutcome(): void {
    if (!this.level || !this.goals) {
      return;
    }

    if (this.goals.isAllCompleted()) {
      if (this.fsm.getCurrent() === 'PlayerInput') {
        this.fsm.transitionTo('Resolving');
      }
      this.fsm.transitionTo('LevelWon');
      // 胜利音效改由结算页打开时播放，与庆祝动画对齐
      this.events.emit({
        type: 'LevelWon',
        levelId: this.level.id,
        score: this.score,
      });
      this.deps.analytics.track('level_win', {
        levelId: this.level.id,
        score: this.score,
      });

      // 有剩余步数：先加成到彩色块再爆炸（开心消消乐），表现层播完消除后再 runMovesBonus
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
      this.fsm.transitionTo('PlayerInput');
      this.ensurePlayableBoard();
      return;
    }

    if (this.movesLeft <= 0) {
      this.fsm.transitionTo('LevelFailed');
      this.playSfx('sfx_fail');
      this.events.emit({ type: 'LevelFailed', levelId: this.level.id });
      this.deps.analytics.track('level_fail', { levelId: this.level.id });
      void this.deps.ads.load('rewarded_revive');
      return;
    }

    this.fsm.transitionTo('PlayerInput');
    this.ensurePlayableBoard();
  }

  /**
   * 是否有待播放的「剩余步数加成」阶段。
   */
  public hasPendingMovesBonus(): boolean {
    return this.pendingMovesBonus;
  }

  /**
   * 执行剩余步数加成：步数打到彩色块变成闪光，再连锁爆炸加分。
   * 表现层应在胜利消除动画播完后调用。
   */
  public runMovesBonus(): boolean {
    if (!this.pendingMovesBonus || !this.board || !this.level) {
      return false;
    }
    if (this.fsm.getCurrent() !== 'LevelWon') {
      return false;
    }

    this.pendingMovesBonus = false;
    if (!this.fsm.transitionTo('MovesBonus')) {
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
      type: 'MovesBonusApplied',
      movesConverted: movesToConvert,
      targets: targets.slice(),
    });
    this.events.emit({ type: 'BoardChanged', version: this.board.version });

    const clear = new Set<number>();
    for (let i = 0; i < this.board.length; i += 1) {
      if (this.board.sparkles[i] === 1) {
        clear.add(i);
      }
    }
    expandSparkleBlasts(this.board, clear);
    const clearIndices = [...clear];

    if (clearIndices.length === 0) {
      this.events.emit({
        type: 'MovesBonusDone',
        bonusScore: 0,
        totalScore: this.score,
      });
      this.finishAfterLevelWon();
      return true;
    }

    const firstKinds: TileKind[] = clearIndices.map(
      (index) => this.board!.cells[index] as TileKind,
    );
    const playback = this.capturePlaybackSnapshot();

    const emptyMatches = this.finder.findMatches(this.board);
    const result = this.resolver.resolve(this.board, emptyMatches, {
      seed: this.level.seed + this.board.version + 911,
      initialClearIndices: clearIndices,
      spawnSpecials: true,
    });

    const bonusScore = result.cleared * 10;
    this.score += bonusScore;
    this.goals?.applyClearedKinds(result.clearedKinds);
    this.goals?.syncScore(this.score);
    this.emitGoalProgress();

    this.events.emit({
      type: 'TilesCleared',
      indices: clearIndices,
      kinds: firstKinds,
    });
    this.events.emit({
      type: 'ResolvePlayback',
      ...playback,
      waves: result.waves,
    });
    this.events.emit({ type: 'CascadeDone', depth: result.cascadeDepth });
    this.events.emit({ type: 'BoardChanged', version: this.board.version });
    this.events.emit({
      type: 'MovesBonusDone',
      bonusScore,
      totalScore: this.score,
    });

    this.finishAfterLevelWon();
    return true;
  }

  /**
   * 通关后进入粉碎或结算。
   */
  private finishAfterLevelWon(): void {
    if (!this.level) {
      this.fsm.forceTo('Settle');
      return;
    }
    if (this.level.crushEnabled) {
      this.beginCrushReward();
      return;
    }
    this.commitLevelCleared();
    this.lastSettleWon = true;
    if (
      this.fsm.getCurrent() === 'MovesBonus' ||
      this.fsm.getCurrent() === 'LevelWon'
    ) {
      this.fsm.transitionTo('Settle');
    } else if (this.fsm.getCurrent() !== 'Settle') {
      this.fsm.forceTo('Settle');
    }
  }

  /**
   * 按剩余步数随机挑彩色块（优先未闪光）。
   */
  private pickMovesBonusTargets(
    count: number,
  ): Array<{ row: number; col: number }> {
    if (!this.board || !this.level || count <= 0) {
      return [];
    }
    const random = createSeededRandom(this.level.seed + this.board.version + 4242);
    const candidates: Array<{ row: number; col: number; sparkle: boolean }> = [];
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

    const picks: Array<{ row: number; col: number }> = [];
    const used = new Set<number>();
    const n = Math.min(count, pool.length);
    let guard = 0;
    while (picks.length < n && guard < n * 8) {
      guard += 1;
      const idx = Math.floor(random() * pool.length);
      const cell = pool[idx]!;
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
  private ensurePlayableBoard(): void {
    this.stabilizeBoard({ animate: true });
  }

  /**
   * 铺上棉花后只能洗牌，不能再结算三消，否则会提前削掉邻格棉花。
   */
  private shuffleAroundCloudLocks(seed: number): void {
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
  private stabilizeBoard(options: { animate: boolean }): void {
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
        true,
      );
      if (ok && options.animate) {
        this.events.emit({ type: 'BoardShuffled', reason: 'deadlock' });
        this.events.emit({ type: 'BoardChanged', version: this.board.version });
      }
    }
  }

  /**
   * 若盘面已有 ≥3 连（冰封格同样计入），立刻连锁消除，不必先滑动。
   * @returns 是否发生了消除
   */
  private commitStandingMatches(animate: boolean): boolean {
    if (!this.board || !this.level || !this.goals) {
      return false;
    }
    const matches = this.finder.findMatches(this.board);
    if (matches.isEmpty()) {
      return false;
    }

    if (animate && this.fsm.getCurrent() === 'PlayerInput') {
      this.fsm.transitionTo('Resolving');
    }

    const standingIndices = Array.from(matches.indices.subarray(0, matches.size));
    const firstKinds: TileKind[] = standingIndices.map(
      (index) => this.board!.cells[index] as TileKind,
    );
    const playback = this.capturePlaybackSnapshot();

    const result = this.resolver.resolve(this.board, matches, {
      seed: this.level.seed + this.board.version + 53,
    });
    if (result.cleared <= 0) {
      if (animate && this.fsm.getCurrent() === 'Resolving') {
        this.fsm.transitionTo('PlayerInput');
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
        type: 'TilesCleared',
        indices: standingIndices,
        kinds: firstKinds,
      });
      this.events.emit({
        type: 'ResolvePlayback',
        ...playback,
        waves: result.waves,
      });
      if (result.fell.length > 0) {
        this.events.emit({
          type: 'TilesFell',
          moves: result.fell.map((f) => ({
            tileId: f.tileId,
            fromRow: f.fromRow,
            toRow: f.toRow,
            col: f.col,
          })),
        });
      }
      if (result.spawned.length > 0) {
        this.events.emit({
          type: 'TilesSpawned',
          indices: result.spawned.map((s) => this.board!.index(s.row, s.col)),
          tileIds: result.spawned.map((s) => s.tileId),
          kinds: result.spawned.map((s) => s.kind),
        });
      }
      this.events.emit({ type: 'CascadeDone', depth: result.cascadeDepth });
    }
    this.events.emit({ type: 'BoardChanged', version: this.board.version });
    return true;
  }

  /** 盘面是否已无任何小动物（洞格不算占用）。 */
  private isBoardFullyCleared(): boolean {
    if (!this.board) {
      return true;
    }
    for (let i = 0; i < this.board.length; i += 1) {
      const kind = this.board.cells[i]!;
      if (!isHole(kind) && kind !== TileKind.Empty) {
        return false;
      }
    }
    return true;
  }

  private capturePlaybackSnapshot(): {
    rows: number;
    cols: number;
    cells: Int8Array;
    tileIds: Int32Array;
    sparkles: Uint8Array;
    cloud: Uint8Array;
    ice: Uint8Array;
    egg: Uint8Array;
    vine: Uint8Array;
  } {
    const board = this.board!;
    return {
      rows: board.size.rows,
      cols: board.size.cols,
      cells: Int8Array.from(board.cells),
      tileIds: Int32Array.from(board.tileIds),
      sparkles: Uint8Array.from(board.sparkles),
      cloud: Uint8Array.from(board.cloud),
      ice: Uint8Array.from(board.ice),
      egg: Uint8Array.from(board.egg),
      vine: Uint8Array.from(board.vine),
    };
  }

  private emitGoalProgress(): void {
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
        this.events.emit({ type: 'SnowmanQuake', centers: quakes });
      }
      this.goals.syncCollectSnowmen(this.board.harvestedSnowmen);
      this.goals.syncCollectPenguins(this.board.harvestedPenguins);
      for (const group of this.board.listBuriedGroups()) {
        if (!group.revealed || this.buriedNotified.has(group.id)) {
          continue;
        }
        this.buriedNotified.add(group.id);
        this.events.emit({
          type: 'BuriedRevealed',
          id: group.id,
          kind: group.kind,
          cells: group.cells.slice(),
        });
      }
    }
    this.events.emit({
      type: 'GoalProgress',
      progress: this.goals.getProgress().slice(),
      completed: this.goals.isAllCompleted(),
    });
  }

  /** 整只露出并展示完毕后收走一只企鹅/雪人。 */
  public collectBuriedGroup(groupId: number): boolean {
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
    this.events.emit({ type: 'BuriedHarvested', indices: harvested });
    this.events.emit({
      type: 'GoalProgress',
      progress: this.goals.getProgress().slice(),
      completed: this.goals.isAllCompleted(),
    });
    this.evaluateLevelOutcome();
    return true;
  }

  /**
   * 进入粉碎奖励环节。
   */
  private beginCrushReward(): void {
    if (!this.level) {
      this.fsm.transitionTo('Settle');
      return;
    }
    const duration = Math.max(0, this.level.crushDurationMs);
    this.crush = new CrushRewardModel(duration, this.crushTapPower);
    this.fsm.transitionTo('CrushReward');
    this.deps.analytics.track('crush_start', {
      levelId: this.level.id,
      durationMs: duration,
    });
    void this.deps.ads.load('rewarded_crush_extend');
  }

  private findLevelConfig(levelId: number): LevelConfig {
    const found = this.levelTable.find((item) => item.id === levelId);
    if (found) {
      return found;
    }
    if (this.levelTable[0]) {
      return this.levelTable[0];
    }
    throw new Error(`Level config not found: ${levelId}`);
  }
}

import { TileKind } from '../../logic/board/TileType';
import type { BoardModel } from '../../logic/board/BoardModel';
import { BURIED_PENGUIN, BURIED_SNOWMAN } from '../../logic/board/BoardModel';
import type { ResolveWave } from '../../logic/board/MatchResolver';
import type { GameSession, ReviveAdResult } from '../../services/GameSession';
import type { GameEvent } from '../../logic/events/GameEvents';
import { BoardView } from '../views/BoardView';
import { BoardMatchAnimator } from '../fx/BoardMatchAnimator';
import { CuteSceneBackground } from '../fx/CuteSceneBackground';
import { LevelResultFx } from '../fx/LevelResultFx';
import { WxShareAdapter } from '../../core/adapters/WxShareAdapter';
import shareImagesJson from '../../config/share-images.json';
import {
  isLobbyNodeExposed,
  isLobbyNodeOnScreen,
  layoutLobbyLevelNodes,
  lobbyCamFromDrag,
  lobbyCameraMax,
  lobbyCaptionY,
  lobbyCloudDecorPoints,
  lobbyLevelBandTop,
  lobbyLevelHitRect,
  lobbyFirstScreenLadderLayout,
  lobbyLadderSideTrailPoints,
  lobbyBarSize,
  lobbyMaxPageIndex,
  lobbyComingSoonLine,
  lobbyPageCaption,
  lobbyPageIndex,
  lobbySnapCamY,
  lobbySnapTarget,
  layoutLobbyMoreLevelsHint,
  lobbySwipeHintOpacity,
  ladderThemeForLevel,
  LOBBY_BRAND_SUBTITLE,
  LOBBY_BRAND_TITLE,
  LOBBY_MORE_LEVELS_HINT,
  LOBBY_SNAP_MS,
  LOBBY_SUBTITLE_UY,
  LOBBY_TITLE_UY,
  lobbyBrandAnchorY,
  type LobbyLevelNode,
} from '../ui/LobbyLevelMap';
import {
  layoutLobbyNoticeBubble,
  lobbyNoticeBubbleCycle,
  lobbyNoticeBubbleDrift,
  lobbyNoticeBubbleLines,
} from '../ui/LobbyNoticeBubble';
import noticeJson from '../../config/notice.json';
import { levelDifficultyArt } from '../../logic/level/levelDifficultyTip';
import { formatHudGoals } from '../ui/HudGoalText';
import { matchPraiseForScore } from '../../logic/fx/MatchPraise';
import { buildShareQuery, buildShareTitle, type ShareScene } from '../../logic/share/shareCopy';
import {
  boosterRefillBadge,
  type BoosterRefillChannel,
} from '../../logic/economy/BoosterEconomy';
import type { BoosterId } from '../../logic/economy/BoosterInventory';
import {
  isPanelBackLabel,
  isPanelCloseLabel,
  panelBackButton,
  panelCloseButton,
} from '../ui/PanelChrome';
import { layoutLeaderboardPanel, clampLeaderboardScroll } from '../ui/LeaderboardPanel';
import type { LeaderboardView } from '../../logic/economy/FriendLeaderboard';
import type { LeaderboardLine } from '../../logic/economy/FriendLeaderboard';
import {
  hasAskedWxProfile,
  hasRealWxProfile,
  markWxProfileAsked,
  mountWxUserInfoAuthButton,
  readCachedWxProfile,
  showAuthFailModal,
  type WxUserInfoButtonHandle,
} from '../../core/adapters/WxUserProfile';
import { readWxLaunchQuery } from '../../core/utils/wxLaunchQuery';
import { toNativeViewStyle } from '../../core/utils/lobbyBanner';
import {
  LOBBY_GEAR_X,
  LOBBY_NAV_CHIP_H,
  LOBBY_NAV_HIT_PAD,
  LOBBY_SIDE_ACTION_FONT,
  layoutLobbyBottom,
  layoutLobbyGear,
  layoutLobbySideActions,
  lobbyNavBottomGap,
  lobbySideActionsTop,
  type LobbySideActionFrame,
} from '../../core/utils/lobbyNav';
import {
  canCreateWxFullscreenAds,
  canCreateWxNativeAds,
  isWxDesktopIdeHost,
  readWxSystemInfo,
  resolveWxMainCanvas,
  resolveWxRenderProfile,
} from '../../core/utils/wxHost';
import { ForegroundGate } from '../../core/utils/foregroundGate';
import { GameRecommendLauncher } from '../../core/utils/gameRecommend';
import {
  afterAdClosed,
  shouldAbortAdOverlay,
  shouldFollowupRestoreCanvas,
  shouldRestoreCanvasSurface,
  shouldResumeBgm,
} from '../../core/utils/adForeground';
import {
  compactTimed,
  cottonFluffCount,
  crushSparkCount,
  juiceSparkCount,
  shouldBackoffAfterFrameErrors,
  resolveNextFrameDelayMs,
  resolveRenderIdleStopMs,
  shouldKeepRenderLoop,
  timedListCap,
} from '../../core/utils/perfBudget';
import {
  paintSharePoster,
  SHARE_POSTER_HEIGHT,
  SHARE_POSTER_WIDTH,
} from './SharePoster';

type ScreenMode = 'lobby' | 'playing' | 'crush' | 'clean' | 'result';
type PageOverlay = 'none' | 'settings' | 'howto' | 'notice' | 'leaderboard' | 'profile_welcome';

interface UiButton {
  id:
    | 'next'
    | 'retry'
    | 'revive'
    | 'lobby'
    | 'level'
    | 'crush_skip'
    | 'crush_extend'
    | 'clean_yes'
    | 'clean_no'
    | 'clean_skip'
    | 'booster_hammer'
    | 'booster_shuffle'
    | 'booster_extra'
    | 'mute'
    | 'settings'
    | 'howto'
    | 'notice'
    | 'club'
    | 'recommend'
    | 'post'
    | 'invite'
    | 'leaderboard'
    | 'claim_shuffle'
    | 'resume'
    | 'profile_skip';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** 大厅关卡节点 id（仅 id === 'level'） */
  levelId?: number;
  /** 点击热区外扩，给「广告」角标留点按空间 */
  hitPad?: number;
}

interface CrushBurstVisual {
  row: number;
  col: number;
  radius: number;
  startMs: number;
  durationMs: number;
  scoreAdded: number;
  clearedCells: Array<{ row: number; col: number }>;
}

interface FloatingScorePop {
  x: number;
  y: number;
  text: string;
  startMs: number;
  durationMs: number;
  color: string;
  /** 飘字字号，缺省按是否 +分 自动选 */
  fontSize?: number;
}

interface CrushSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  startMs: number;
  durationMs: number;
  color: string;
  /** 粒子造型：圆点 / 星 / 拖尾条 */
  style?: 'dot' | 'star' | 'streak';
}

/** 交换滑动过渡（成功滑入 / 失败回弹） */
interface SwapSlideFx {
  rowA: number;
  colA: number;
  kindA: TileKind;
  sparkleA: boolean;
  rowB: number;
  colB: number;
  kindB: TileKind;
  sparkleB: boolean;
  startMs: number;
  durationMs: number;
  rejected: boolean;
}

interface PendingResolvePlayback {
  rows: number;
  cols: number;
  cells: Int8Array;
  tileIds: Int32Array;
  sparkles: Uint8Array;
  cloud: Uint8Array;
  ice: Uint8Array;
  egg: Uint8Array;
  vine: Uint8Array;
  waves: ResolveWave[];
}

interface BuriedCollectFx {
  id: number;
  kind: number;
  poseFrom: number;
  leaveFrom: number;
}

const BURIED_POSE_MS = 1100;
const BURIED_LEAVE_MS = 560;


const TILE_FALLBACK_COLORS: Record<number, string> = {
  [TileKind.Empty]: 'transparent',
  [TileKind.Red]: '#e74c3c',
  [TileKind.Blue]: '#3498db',
  [TileKind.Green]: '#2ecc71',
  [TileKind.Yellow]: '#f1c40f',
  [TileKind.Purple]: '#9b59b6',
  [TileKind.Bomb]: '#e67e22',
  [TileKind.ColorBomb]: '#1abc9c',
  [TileKind.Hole]: 'transparent',
};

const TILE_SPRITE_SRC: Partial<Record<number, string>> = {
  [TileKind.Red]: 'assets/main/tiles/red.png',
  [TileKind.Blue]: 'assets/main/tiles/blue.png',
  [TileKind.Green]: 'assets/main/tiles/green.png',
  [TileKind.Yellow]: 'assets/main/tiles/yellow.png',
  [TileKind.Purple]: 'assets/main/tiles/purple.png',
  [TileKind.ColorBomb]: 'assets/main/tiles/owl.png',
};

const BURIED_SPRITE_SRC = {
  penguin: 'assets/main/tiles/penguin.png',
  snowman: 'assets/main/tiles/snowman.png',
} as const;

const BG_SRC = {
  lobby: 'assets/main/bg/lobby.jpg',
  level: 'assets/main/bg/level.jpg',
  lobbyCloudMint: 'assets/main/bg/lobby-clouds-mint.jpg',
  lobbyCloudMintB: 'assets/main/bg/lobby-clouds-mint-b.jpg',
  lobbyCloudMintC: 'assets/main/bg/lobby-clouds-mint-c.jpg',
} as const;

const LOBBY_LADDER_ICON_SRC = {
  check: 'assets/main/ui/lobby-ladder/icon-check.png',
  star: 'assets/main/ui/lobby-ladder/icon-star.png',
  lock: 'assets/main/ui/lobby-ladder/icon-lock.png',
  cloud: 'assets/main/ui/lobby-ladder/deco-cloud.png',
  cloudSm: 'assets/main/ui/lobby-ladder/deco-cloud-sm.png',
} as const;

const BOOSTER_ICON_SRC = {
  hammer: 'assets/main/ui/icon-hammer.png',
  shuffle: 'assets/main/ui/icon-shuffle.png',
  extra: 'assets/main/ui/icon-extra.png',
  sound: 'assets/main/ui/icon-sound.png',
  mute: 'assets/main/ui/icon-mute.png',
} as const;

/** 贴图海报用的小游戏码（可替换成公众平台下载的正式码） */
const SHARE_QR_SRC = 'assets/main/ui/game-qr.png';

const MACARON_SRC = [
  'assets/main/ui/macaron-pink.png',
  'assets/main/ui/macaron-mint.png',
  'assets/main/ui/macaron-purple.png',
  'assets/main/ui/macaron-orange.png',
  'assets/main/ui/macaron-blue.png',
] as const;

const DIGIT_SRC = [
  'assets/main/ui/digit-0.png',
  'assets/main/ui/digit-1.png',
  'assets/main/ui/digit-2.png',
  'assets/main/ui/digit-3.png',
  'assets/main/ui/digit-4.png',
  'assets/main/ui/digit-5.png',
  'assets/main/ui/digit-6.png',
  'assets/main/ui/digit-7.png',
  'assets/main/ui/digit-8.png',
  'assets/main/ui/digit-9.png',
] as const;

/** 树上底图关号描边：跟马卡龙同色系的深色边，不是奶油白边 */
const MACARON_NUM_STROKE = [
  '#c07280',
  '#3d8a68',
  '#9c4a88',
  '#b44a28',
  '#2f6d82',
] as const;

/** 一屏就能看完的玩法速查，不翻页。 */
const HOWTO_LINES: ReadonlyArray<{ tag: string; text: string }> = [
  { tag: '消除', text: '滑动交换相邻萌宠。同色横或竖连成 3 个及以上即可消除，下落填空后还能连锁。' },
  { tag: '过关', text: '完成头顶全部目标即通关。每次合法交换扣 1 步；步数用尽可重开，或看广告每次补 5 步继续。' },
  { tag: '冰块', text: '消除波及冰块会碎一层。冰封格上的萌宠不能滑动，需先打碎冰块。' },
  { tag: '棉花', text: '棉花盖住的格子不能交换。邻消削一层，两次清掉；云下可能藏粉球，云清后再消才算收集。' },
  { tag: '伙伴', text: '雪人、企鹅藏在冰下，各占多格。占地冰块全碎后才露出并收获；雪人露出时会震碎周围一圈冰。' },
  { tag: '大招', text: '四连或 L/T 形出闪光（范围爆炸）；五连出超级猫头鹰（清同色）。两枚闪光互滑可同时引爆。' },
  { tag: '粉碎', text: '通关后进入限时点击粉碎加分，可看广告加时。总分够高时还可选清洁小游戏（不加主线分）。' },
  { tag: '道具', text: '锤子砸一格、重排洗盘、加步 +5，开局不送。库存空时：先转发好友 → 再转发群 → 再看广告领取。' },
  { tag: '奖励', text: '每日登录送锤子；当日通关满 3 关领重排；某次剩 ≥6 步通关送加步。道具可带入下关，各最多 9 个。' },
  { tag: '邀请', text: '分享给没玩过的好友，对方通关后双方各得 1 锤子。' },
];

/** 闯关成功庆祝图 */
const WIN_CELEBRATE_SRC = 'assets/main/ui/win-celebrate.jpg';
/** 裁掉庆祝图顶部空白渐变区（相对原图高度） */
const WIN_CELEBRATE_CROP_TOP = 0.36;
/** 粉横幅中心（相对裁剪后图片） */
const WIN_BANNER_CY = 0.82;

/** 关卡棋盘槽：冷色浅台，贴合薄荷绿关卡底图 */
const SLOT_FILL_BOTTOM = 'rgba(232, 248, 252, 0.9)';
const SLOT_LINE = 'rgba(140, 198, 220, 0.42)';
const BOARD_PANEL_TOP = 'rgba(255, 255, 255, 0.97)';
const BOARD_PANEL_BOTTOM = 'rgba(232, 248, 255, 0.95)';
const BOARD_PANEL_OUTER = 'rgba(160, 210, 230, 0.92)';

/**
 * 微信小游戏 Canvas 壳：大厅 / 对局 / 结算，接通现有 GameSession。
 * 不依赖 Cocos，可在微信开发者工具直接预览。
 */
export class WxCanvasGameApp {
  private readonly canvas: WxCanvas;
  private ctx: WxCanvasRenderingContext2D;
  private readonly session: GameSession;
  private readonly boardView: BoardView;
  private readonly animator = new BoardMatchAnimator();
  private readonly sceneBg = new CuteSceneBackground();
  private readonly resultFx = new LevelResultFx();

  private readonly width: number;
  private readonly height: number;
  private readonly dpr: number;
  /** 模拟器 / 低端机：少装饰绘制，贴图与环境动画仍保留 */
  private readonly lite: boolean;
  /** 真机低端：粒子上限更紧 */
  private readonly cheapFx: boolean;
  /** 呼吸 / 按钮弹性幅度 */
  private fxAmt(full: number, lite = full * 0.55): number {
    return this.lite ? lite : full;
  }
  /** 状态栏高度 */
  private readonly statusBarHeight: number;
  /** 底部 Home 条，大厅按钮要抬上去 */
  private readonly safeAreaBottom: number;
  /** 微信右上角胶囊区域，避让用 */
  private readonly menuButton: WxMenuButtonRect | null;

  private mode: ScreenMode = 'lobby';
  private overlay: PageOverlay = 'none';
  /** 从设置点进玩法 / 公告时，关闭后回到设置 */
  private overlayFromSettings = false;
  private boardViewModel: LeaderboardView | null = null;
  private readonly avatarCache = new Map<string, WxImage>();
  /** 好友排行列表纵向滚动偏移（像素） */
  private leaderboardScrollY = 0;
  /** 排行榜列表拖拽：起点与是否已滑动（滑动则不触发关闭按钮） */
  private leaderboardDrag: { startY: number; lastY: number; scrolled: boolean } | null = null;
  /** 首次进入大厅：可选授权头像昵称（原生按钮，关闭面板时销毁） */
  private userInfoAuthButton: WxUserInfoButtonHandle | null = null;
  private buttons: UiButton[] = [];
  private raf = 0;
  private statusText = '';
  /** 点道具后贴在按钮上方的短提示 */
  private toastText = '';
  private toastUntilMs = 0;
  /** 进关「难度提升」艺术字提示 */
  private difficultyArt: {
    title: string;
    subtitle: string | null;
    startMs: number;
    durationMs: number;
  } | null = null;
  /** 锤子选格模式 */
  private hammerTargeting = false;
  /** 锤子光标屏幕坐标（选中后跟随手指/鼠标） */
  private hammerCursor: { x: number; y: number } | null = null;
  private unsub: (() => void) | null = null;
  private readonly wxPlatform: string;
  private started = false;
  private pumping = false;
  /** 广告/切关进行中，避免连点弹出两层广告 */
  private tapBusy = false;
  private scheduleFrame: (cb: (time: number) => void) => number = (cb) =>
    setTimeout(() => cb(Date.now()), 80) as unknown as number;
  private cancelFrame: (id: number) => void = (id) => clearTimeout(id);
  private frameDelayMs = 80;
  private baseFrameDelayMs = 80;

  private readonly onTouchStartBound: (e: WxTouchEvent) => void;
  private readonly onTouchMoveBound: (e: WxTouchEvent) => void;
  private readonly onTouchEndBound: (e: WxTouchEvent) => void;
  private readonly onTouchCancelBound: (e: WxTouchEvent) => void;

  /** 已加载的小动物贴图 */
  private readonly tileImages = new Map<number, WxImage>();
  private buriedPenguin: WxImage | null = null;
  private buriedSnowman: WxImage | null = null;

  private bgLobby: WxImage | null = null;
  private bgLevel: WxImage | null = null;
  private readonly lobbyCloudPages: Array<WxImage | null> = [null, null, null];
  private layoutCacheKey = '';
  private readonly layoutCache = { cellSize: 40, originX: 0, originY: 0 };
  /** 闯关成功庆祝图 */
  private winCelebrate: WxImage | null = null;
  /** 道具栏图标 */
  private readonly uiIcons = new Map<string, WxImage>();
  private readonly share = new WxShareAdapter();
  private readonly recommend = new GameRecommendLauncher();
  /** 微信常需用户手势后才能播 BGM */
  private bgmStarted = false;
  /** 覆盖在「圈子」上的微信原生游戏圈按钮 */
  private gameClubButton: {
    show?: () => void;
    hide?: () => void;
    destroy?: () => void;
    onTap?: (listener: () => void) => void;
    offTap?: (listener?: () => void) => void;
    style?: {
      left: number;
      top: number;
      width: number;
      height: number;
      lineHeight?: number;
    };
  } | null = null;
  private gameClubButtonKey = '';
  private gameClubTapHooked = false;
  /** 进游戏圈 / 切后台后 rAF 会停，返回时必须主动续上，否则首页黑屏 */
  private foregroundHidden = false;
  private readonly foreground: ForegroundGate;
  /** 避免 onShow 连续恢复叠两次循环 */
  private resumeToken = 0;
  private resumeFollowupTimers: number[] = [];
  /** 冷启动进大厅插屏定时器 */
  private launchAdTimer = 0;
  /** 超过此时刻仍未弹出则放弃进门插屏 */
  private launchAdDeadline = 0;
  /** 大厅横幅延迟到首帧之后，避免启动时 createCustomAd 卡死模拟器 */
  private lobbyBannerTimer = 0;
  private lobbyBannerArmed = false;
  private lobbyBannerRetryTimer = 0;
  private lobbyBannerRetries = 0;
  /** 进关过程中 mode 还可能是 lobby，必须先拦住迟到的原生横幅 */
  private leavingLobby = false;
  /** 广告关闭后的穿透点击：这段时间忽略触摸 */
  private inputMuteUntilMs = 0;
  /** 防止 canvas.requestAnimationFrame 同步重入把模拟器卡死 */
  private frameGuard = false;
  private readonly onHideBound = (): void => {
    if (!isWxDesktopIdeHost()) {
      this.foreground.onHide();
    }
  };
  private readonly onShowBound = (): void => {
    if (!isWxDesktopIdeHost()) {
      this.foreground.onShow();
    }
    if (this.session.bindInviteFromQuery(readWxLaunchQuery())) {
      this.notifyUser('通关第 1 关，你和好友各得锤子', '邀请到账');
    }
    const inviteToast = this.session.takeInviteToast();
    if (inviteToast) {
      this.notifyUser(inviteToast, '锤子到账');
    }
    this.settlePendingBoosterShare();
  };
  private readonly onAudioInterruptionBeginBound = (): void => {
    this.session.suspendForBackground();
  };
  private readonly onAudioInterruptionEndBound = (): void => {
    if (!this.foregroundHidden) {
      this.session.resumeFromBackground();
      this.kickRenderLoop();
    }
  };

  /** 与 rAF 同步的时钟（微信环境无 performance） */
  private nowMs = 0;
  /** 大厅相机：树下移、天空云层展开 */
  private lobbyCamY = 0;
  private lobbyCamInited = false;
  /** 用户跟手拖过大厅后，不再强行吸回当前段 */
  private lobbyCamUserHeld = false;
  /** 新解锁云层时一次性滚过去 */
  private lobbyCamAutoTarget: number | null = null;
  private lobbyCamSnapFrom = 0;
  private lobbyCamSnapAtMs = 0;
  private lobbyCamVel = 0;
  /** 「更多关卡」把手首次亮起的时刻；0 表示尚未计时。 */
  private lobbySwipeHintShownAtMs = 0;
  /** 首次滑动或淡出结束后不再画把手。 */
  private lobbySwipeHintDismissed = false;
  /** 空道具转发补给：从分享页返回后发奖 */
  private pendingBoosterShare: BoosterId | null = null;
  private pendingBoosterShareAtMs = 0;
  private boosterShareScene: Extract<ShareScene, 'booster_friend' | 'booster_group'> | null =
    null;
  private lobbyDrag: {
    startX: number;
    startY: number;
    lastY: number;
    lastMs: number;
    camStart: number;
    moved: boolean;
    velY: number;
  } | null = null;

  /** 动画播放期间暂存胜负，播完再弹结算或进入粉碎 */
  private pendingResult: 'won' | 'failed' | null = null;

  /** 粉碎爆炸视觉反馈 */
  private crushBursts: CrushBurstVisual[] = [];
  /** 点击飘分 */
  private floatingScores: FloatingScorePop[] = [];
  /** 粉碎火花粒子 */
  private crushSparks: CrushSpark[] = [];
  /** 屏幕震动剩余时间 */
  private shakeMs = 0;
  /** HUD 进度条果冻脉冲（消除/目标推进时） */
  private hudBarPulse = 0;
  /** 分数数字砸地脉冲 */
  private hudScorePunch = 1;
  /** 粉碎/清洁进度条满格对应加成分（开局占用格 ×10） */
  private burstScoreBarMax = 640;
  /** 粉碎/清洁进度条当前展示值（平滑跟上真实分数） */
  private hudBurstBarDisplay = 0;
  /** 是否已经成功点击粉碎过（用于引导） */
  private crushHasTapped = false;
  /** 按下时已处理粉碎点击，抬起不再打第二次 */
  private crushTapOnDown = false;
  /** 最近一次有效触点（touchEnd 坐标偶发丢失） */
  private lastPointerX = 0;
  private lastPointerY = 0;
  /** 本局粉碎点击次数（结算展示） */
  private lastCrushTapCount = 0;
  private lastFrameMs = 0;
  /** 有输入或动效才继续跑帧，空闲停循环省电 */
  private needsPaint = true;
  /** 最近一次触摸，用来判断该不该停循环 */
  private lastInteractMs = Date.now();
  /** 连续画帧失败次数，过多则停循环等下一次触摸 */
  private frameErrors = 0;
  /** 胜利结算：是否询问进入清洁模式 */
  private offerCleanPrompt = false;
  /** 交换滑动过渡 */
  private swapSlide: SwapSlideFx | null = null;
  /** 等交换动画结束后再播消除 */
  private pendingPlayback: PendingResolvePlayback | null = null;
  /** 播放中的棉花/冰块/蛋壳/藤蔓快照：等小动物消完再掉层 */
  private animCloudStart: Uint8Array | null = null;
  private animIceStart: Uint8Array | null = null;
  private animEggStart: Uint8Array | null = null;
  private animVineStart: Uint8Array | null = null;
  private animCloudWaves: ResolveWave[] = [];
  /** 整只露出后先亮相，再飞离收集 */
  private readonly buriedFx = new Map<number, BuriedCollectFx>();

  public constructor(session: GameSession) {
    const info = readWxSystemInfo();
    this.wxPlatform = (info.platform || '').toLowerCase();
    const desktopIde = isWxDesktopIdeHost();
    const profile = resolveWxRenderProfile(info, desktopIde);
    this.lite = profile.lite;
    this.cheapFx = profile.cheapFx;
    this.dpr = profile.dpr;
    this.width = Math.max(1, info.windowWidth || info.screenWidth || 375);
    this.height = Math.max(1, info.windowHeight || info.screenHeight || 667);
    this.statusBarHeight =
      info.statusBarHeight ??
      info.safeArea?.top ??
      44;
    this.safeAreaBottom = Math.max(
      0,
      this.height - (info.safeArea?.bottom ?? this.height),
    );
    this.menuButton =
      typeof wx.getMenuButtonBoundingClientRect === 'function'
        ? wx.getMenuButtonBoundingClientRect()
        : null;

    this.canvas = resolveWxMainCanvas();
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);
    this.applyCanvasDrawQuality();
    this.ctx.fillStyle = '#b6e8fc';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 开发者工具 / 低端机用 setTimeout；中高端真机用 rAF。
    if (profile.useRaf && typeof this.canvas.requestAnimationFrame === 'function') {
      this.useCanvasRaf();
    } else {
      this.baseFrameDelayMs = profile.frameDelayMs;
      this.useTimeoutFrames(profile.frameDelayMs);
    }
    this.sceneBg.setLite(this.lite);
    this.resultFx.setLite(this.lite);
    if (typeof wx.setPreferredFramesPerSecond === 'function') {
      try {
        wx.setPreferredFramesPerSecond(profile.fps);
      } catch {
        // ignore
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
      schedule: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      cancel: (id) => clearTimeout(id),
      pause: () => this.applyBackgroundPause(),
      resume: (reason) => {
        if (reason === 'overlay-end') {
          this.applyForegroundResume('full');
          return;
        }
        if (reason === 'overlay-abort') {
          this.applyForegroundResume('light');
          return;
        }
        this.applyForegroundResume(this.foregroundHidden ? 'full' : 'light');
      },
    });
  }

  /**
   * 预加载糖果色小动物贴图 + 可爱场景背景。
   */
  public async preloadAssets(): Promise<void> {
    const jobs: Array<() => Promise<void>> = [];
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
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 16);
        });
      }
    } else {
      await Promise.all(jobs.map((job) => job()));
    }
    this.requestPaint();
    void this.preloadDeferredAssets();
    // iOS：大批量贴图加载完后首帧 drawImage 偶发黑屏，补踢两帧
    if (!isWxDesktopIdeHost()) {
      setTimeout(() => {
        this.sceneBg.layout(this.width, this.height);
        this.needsPaint = true;
        this.kickRenderLoop();
      }, 40);
      setTimeout(() => {
        this.needsPaint = true;
        this.kickRenderLoop();
      }, 200);
    }
    console.info(
      '[crush-crush] assets loaded tiles=',
      this.tileImages.size,
      'bgLobby=',
      !!this.bgLobby,
      'bgLevel=',
      !!this.bgLevel,
      'uiIcons=',
      this.uiIcons.size,
    );
  }

  /** 云层翻页、过关海报、小程序码：不挡首屏。 */
  private async preloadDeferredAssets(): Promise<void> {
    if (isWxDesktopIdeHost()) {
      await new Promise<void>((resolve) => {
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
          this.uiIcons.set('qr', img);
        }
      }),
    ]);
    this.requestPaint();
  }

  /** 启动进入首页大厅（首页插画选关） */
  public bootIntoLobby(): void {
    this.showLobby();
  }

  /** 兼容旧入口：直接开战 */
  public async bootIntoPlay(): Promise<void> {
    await this.enterLevel(this.resolveEntryLevelId());
  }

  /** 展示大厅（放弃当前对局态） */
  public showLobby(): void {
    this.session.quitToLobby();
    this.leavingLobby = false;
    this.mode = 'lobby';
    this.statusText = '';
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
      /* 大厅无棋盘交换 */
    });
    this.maybeOfferLaunchProfileAuth();
  }

  private resolveEntryLevelId(): number {
    const total = Math.max(1, this.session.getLevelCount());
    return Math.max(1, Math.min(this.session.progress.getHighestLevelId(), total));
  }

  /**
   * 启动渲染循环与触摸监听。
   */
  public start(): void {
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
      this.statusText = '今日登录 +1 锤子，轻松慢慢玩';
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
      if (typeof wx.onAudioInterruptionBegin === 'function') {
        wx.onAudioInterruptionBegin(this.onAudioInterruptionBeginBound);
      }
      if (typeof wx.onAudioInterruptionEnd === 'function') {
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
      '[crush-crush] WxCanvasGameApp started',
      this.width,
      this.height,
      this.wxPlatform,
      'ide=',
      isWxDesktopIdeHost(),
    );
  }

  /**
   * 进门广告：大厅先出一帧，广告就绪就弹插屏。
   * 微信启动频控（2001）拦了就在大厅里接着试；进关或超时则停。
   */
  private scheduleLaunchInterstitial(): void {
    if (this.launchAdTimer) {
      return;
    }
    this.launchAdDeadline =
      Date.now() + this.session.getLaunchInterstitialTimeoutMs();
    this.armLaunchInterstitial(this.session.getLaunchInterstitialDelayMs());
  }

  private armLaunchInterstitial(delayMs: number): void {
    if (this.launchAdTimer) {
      return;
    }
    this.launchAdTimer = setTimeout(() => {
      this.launchAdTimer = 0;
      void this.tryLaunchInterstitial();
    }, delayMs) as unknown as number;
  }

  private clearLaunchInterstitialTimer(): void {
    if (!this.launchAdTimer) {
      return;
    }
    clearTimeout(this.launchAdTimer);
    this.launchAdTimer = 0;
  }

  private async tryLaunchInterstitial(): Promise<void> {
    if (this.mode !== 'lobby' || this.leavingLobby) {
      return;
    }
    if (this.overlay !== 'none' || this.foregroundHidden) {
      this.armLaunchInterstitialRetry();
      return;
    }
    // 进门插屏失败会连试几十秒；失败立刻 abort 遮罩，避免大厅每 2.5s 闪黑。
    // 真正弹出时遮罩盖住整段观看：藏横幅、禁点击、停画布。
    this.beginAdOverlay();
    const result = await this.session.maybeShowLaunchInterstitial();
    const leftLobby = this.mode !== 'lobby' || this.leavingLobby;
    if (result === 'shown') {
      this.endAdOverlay();
    } else {
      this.inputMuteUntilMs = Date.now();
      this.foreground.abortOverlay();
    }
    console.info('[crush-crush] launch interstitial', result);
    if (leftLobby || result === 'shown' || result === 'stop') {
      return;
    }
    this.armLaunchInterstitialRetry();
  }

  private armLaunchInterstitialRetry(): void {
    if (this.mode !== 'lobby' || this.leavingLobby) {
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
  private isLobbyBannerWanted(): boolean {
    return (
      this.lobbyBannerArmed &&
      !this.leavingLobby &&
      this.mode === 'lobby' &&
      this.overlay === 'none' &&
      !this.foregroundHidden &&
      this.session.isLobbyBannerEnabled()
    );
  }

  private interceptLobbyBanner(): void {
    this.clearLobbyBannerRetry();
    this.session.hideLobbyBanner();
  }

  private syncLobbyBanner(): void {
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
      if (result === 'completed') {
        this.lobbyBannerRetries = 0;
        return;
      }
      this.armLobbyBannerRetry();
    });
  }

  private armLobbyBannerRetry(): void {
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
    }, 2500) as unknown as number;
  }

  private clearLobbyBannerRetry(): void {
    if (this.lobbyBannerRetryTimer) {
      clearTimeout(this.lobbyBannerRetryTimer);
      this.lobbyBannerRetryTimer = 0;
    }
  }

  /**
   * 真机首帧后再创建原生横幅。开发者工具不创建，避免 insertTextView parent not found。
   */
  private armLobbyBanner(): void {
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
    }, delayMs) as unknown as number;
  }

  private readonly loopBound = (): void => {
    this.onAnimationFrame();
  };

  private requestPaint(): void {
    this.needsPaint = true;
    this.frameErrors = 0;
    this.ensureLoop();
  }

  private markUserActivity(): void {
    this.lastInteractMs = Date.now();
    this.frameErrors = 0;
    this.requestPaint();
  }

  private ensureLoop(): void {
    if (!this.started || this.foregroundHidden || this.raf) {
      return;
    }
    this.raf = this.scheduleFrame(this.loopBound);
  }

  private sceneIsBusy(): boolean {
    if (this.animator.isPlaying() || this.swapSlide || this.pendingPlayback || this.buriedFx.size > 0) {
      return true;
    }
    if (this.hammerTargeting) {
      return true;
    }
    if (this.mode === 'crush' || this.mode === 'clean') {
      return true;
    }
    if (this.shakeMs > 0 || this.hudBarPulse > 0 || this.hudScorePunch > 1) {
      return true;
    }
    const now = this.nowMs || Date.now();
    if (this.toastText && now < this.toastUntilMs) {
      return true;
    }
    if (
      this.difficultyArt &&
      now < this.difficultyArt.startMs + this.difficultyArt.durationMs
    ) {
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

  /** 大厅呼吸、结算彩带、粉碎倒计时、公告泡泡需要持续转；对局静止盘面可停循环。 */
  private wantsAmbientFx(): boolean {
    return (
      this.mode === 'lobby' ||
      this.mode === 'result' ||
      this.mode === 'crush' ||
      this.mode === 'clean'
    );
  }

  /** 首页公告泡泡在漂：开发者工具空闲停循环时也要慢速续画，避免冻在半路。 */
  private lobbyNoticeBubbleNeedsTick(): boolean {
    if (this.mode !== 'lobby' || this.overlay !== 'none') {
      return false;
    }
    if (this.lobbyCamY > this.height * 0.18) {
      return false;
    }
    return (
      lobbyNoticeBubbleLines({
        body: noticeJson.body,
        bubbles: (noticeJson as { bubbles?: string[] }).bubbles,
      }).length > 0
    );
  }

  private useCanvasRaf(): void {
    this.baseFrameDelayMs = 16;
    this.frameDelayMs = 16;
    this.scheduleFrame = (cb) => {
      const raf = this.canvas.requestAnimationFrame;
      if (typeof raf === 'function') {
        return raf.call(this.canvas, cb);
      }
      return setTimeout(() => cb(Date.now()), 16) as unknown as number;
    };
    this.cancelFrame = (id) => this.clearScheduledFrame(id);
  }

  private useTimeoutFrames(delayMs = this.frameDelayMs): void {
    this.frameDelayMs = Math.max(16, delayMs);
    this.scheduleFrame = (cb) =>
      setTimeout(() => cb(Date.now()), this.frameDelayMs) as unknown as number;
    this.cancelFrame = (id) => this.clearScheduledFrame(id);
  }

  private clearScheduledFrame(id: number): void {
    if (!id) {
      return;
    }
    clearTimeout(id);
    const cancel = this.canvas.cancelAnimationFrame;
    if (typeof cancel === 'function') {
      try {
        cancel.call(this.canvas, id);
      } catch {
        // 超时 id 和 rAF id 不是同一套，忽略
      }
    }
  }

  private onAnimationFrame(): void {
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
      if (this.mode === 'lobby') {
        this.updateLobbyCamera(dt);
      }
      if (this.mode === 'crush' || this.mode === 'clean' || this.mode === 'playing' || this.mode === 'result') {
        this.pruneCrushBursts(now);
        if (this.shakeMs > 0) {
          this.shakeMs = Math.max(0, this.shakeMs - dt);
        }
        if (this.hudBarPulse > 0) {
          this.hudBarPulse = Math.max(0, this.hudBarPulse - dt);
        }
        if (this.hudScorePunch > 1) {
          this.hudScorePunch = Math.max(1, this.hudScorePunch - dt * 0.0022);
        }
        if (this.mode === 'crush' || this.mode === 'clean') {
          this.updateBurstScoreBar(dt);
        }
      }
      if ((this.mode === 'crush' || this.mode === 'clean') && this.overlay === 'none') {
        this.session.tickCrushReward(dt);
      }
      const animating = this.sceneIsBusy();
      const ambientBubble = this.lobbyNoticeBubbleNeedsTick();
      const desktopIde = isWxDesktopIdeHost();
      const busy =
        shouldKeepRenderLoop({
          animating,
          lastInteractMs: this.lastInteractMs,
          nowMs: now,
          idleStopMs: resolveRenderIdleStopMs({
            desktopIde,
            ambientFx: this.wantsAmbientFx(),
          }),
        }) || ambientBubble;
      this.frameDelayMs = resolveNextFrameDelayMs({
        animating,
        desktopIde,
        baseDelayMs: this.baseFrameDelayMs,
      });
      // 仅泡泡在漂：降到约 11～14fps，模拟器不占满主线程
      if (ambientBubble && !animating) {
        this.frameDelayMs = Math.max(this.frameDelayMs, desktopIde ? 90 : 70);
      }
      if (this.needsPaint || busy) {
        this.draw();
        this.frameErrors = 0;
      }
      this.needsPaint = busy;
    } catch (err) {
      console.error('[crush-crush] frame failed', err);
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

  private applyBackgroundPause(): void {
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
    // 圈子原生页正在起来时 hide 按钮/横幅会和微信抢主线程，拖到下一拍。
    setTimeout(() => {
      if (!this.foregroundHidden) {
        return;
      }
      this.session.hideLobbyBanner();
    }, 80);
  }

  /** 点到原生「圈子」：立刻停 rAF，别等 onHide（圈子起来前 onHide 经常晚 1～2 秒）。 */
  private onGameClubTapped = (): void => {
    this.foreground.forcePause();
  };

  private clearResumeFollowups(): void {
    for (const id of this.resumeFollowupTimers) {
      clearTimeout(id);
    }
    this.resumeFollowupTimers = [];
  }

  private applyForegroundResume(kind: 'full' | 'light'): void {
    const wasHidden = this.foregroundHidden;
    this.foregroundHidden = false;
    this.clearResumeFollowups();
    const token = ++this.resumeToken;
    const desktopIde = isWxDesktopIdeHost();
    const restoreNow = kind === 'full';
    const recover = (forceSurface: boolean): void => {
      if (token !== this.resumeToken || this.foregroundHidden) {
        return;
      }
      this.lastFrameMs = 0;
      this.nowMs = Date.now();
      this.pumping = false;
      this.frameGuard = false;
      if (
        shouldRestoreCanvasSurface({
          desktopIde,
          forceSurface,
        })
      ) {
        this.restoreCanvasSurface();
      }
      this.needsPaint = true;
      try {
        this.draw();
      } catch (err) {
        console.error('[crush-crush] resume draw failed', err);
      }
      this.kickRenderLoop();
    };
    recover(restoreNow);
    if (!desktopIde && restoreNow) {
      this.resumeFollowupTimers.push(
        setTimeout(() => recover(false), 80) as unknown as number,
      );
      this.resumeFollowupTimers.push(
        setTimeout(() => {
          const expected = Math.max(1, Math.floor(this.width * this.dpr));
          recover(shouldFollowupRestoreCanvas(this.canvas.width, expected));
        }, 360) as unknown as number,
      );
      // iOS 返回首页：再补一帧，避免进度/大厅停在黑缓冲
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
            console.error('[crush-crush] resume lobby redraw failed', err);
          }
          this.kickRenderLoop();
        }, 120) as unknown as number,
      );
    }
    if (
      shouldResumeBgm({
        bgmStarted: this.bgmStarted,
        muted: this.session.isMuted(),
        wasHidden: wasHidden || restoreNow,
        longAway: restoreNow || wasHidden,
      })
    ) {
      this.session.resumeFromBackground();
    }
    if (this.mode === 'lobby' && !this.leavingLobby) {
      this.syncLobbyBanner();
    }
  }

  private kickRenderLoop(): void {
    if (!this.started) {
      return;
    }
    this.needsPaint = true;
    this.cancelFrame(this.raf);
    this.raf = 0;
    this.pumping = false;
    this.frameGuard = false;
    // 切后台回来后 canvas.rAF 经常不再回调，先用 timeout 踢一帧。
    this.raf = setTimeout(() => {
      this.raf = 0;
      this.loopBound();
    }, 16) as unknown as number;
  }

  private beginAdOverlay(): void {
    this.boardView.onPointerCancel();
    this.lobbyDrag = null;
    this.crushTapOnDown = false;
    this.inputMuteUntilMs = Number.POSITIVE_INFINITY;
    this.foreground.enterOverlay();
  }

  private endAdOverlay(): void {
    const plan = afterAdClosed(isWxDesktopIdeHost());
    setTimeout(() => {
      this.inputMuteUntilMs = Date.now() + plan.muteMs;
      this.foreground.leaveOverlay();
    }, plan.settleMs);
  }

  private isInputMuted(): boolean {
    return Date.now() < this.inputMuteUntilMs;
  }

  private clearAdPrompt(): void {
    const adLike = (text: string) => text.includes('广告');
    if (adLike(this.toastText) || adLike(this.statusText)) {
      this.toastText = '';
      this.toastUntilMs = 0;
      if (adLike(this.statusText)) {
        this.statusText = '';
      }
    }
    if (typeof wx.hideToast === 'function') {
      try {
        wx.hideToast();
      } catch {
        // ignore
      }
    }
    this.requestPaint();
  }

  private async runDuringAd<T>(work: () => Promise<T>): Promise<T> {
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
  private settleBurstModesForLeave(): void {
    if (this.session.fsm.getCurrent() === 'LevelFailed') {
      this.session.acknowledgeFailure();
    }
    if (this.session.fsm.getCurrent() === 'CrushReward') {
      this.session.finishCrushReward();
    }
    if (this.session.fsm.getCurrent() === 'Cleaning') {
      this.session.finishCleaningMode();
    }
  }

  private async maybeRunSettleInterstitial(): Promise<void> {
    if (this.pendingResult === 'won' && this.session.fsm.getCurrent() === 'Settle') {
      await this.runDuringAd(() => this.session.maybeShowSettleInterstitial());
    }
  }

  /** 从后台/广告回来时 2D 缓冲常被丢掉；同尺寸赋值不会重建，必须先撑一下再改回。 */
  private restoreCanvasSurface(): void {
    const pixelW = Math.max(1, Math.floor(this.width * this.dpr));
    const pixelH = Math.max(1, Math.floor(this.height * this.dpr));
    try {
      this.canvas.width = pixelW + 1;
      this.canvas.height = pixelH + 1;
    } catch {
      // ignore
    }
    this.canvas.width = pixelW;
    this.canvas.height = pixelH;
    const next = this.canvas.getContext('2d');
    if (next) {
      this.ctx = next;
    }
    if (typeof this.ctx.setTransform === 'function') {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ctx.scale(this.dpr, this.dpr);
    this.applyCanvasDrawQuality();
    this.ctx.fillStyle = '#b6e8fc';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private applyCanvasDrawQuality(): void {
    this.ctx.imageSmoothingEnabled = true;
    const quality = this.ctx as CanvasRenderingContext2D & {
      imageSmoothingQuality?: 'low' | 'medium' | 'high';
    };
    if (quality.imageSmoothingQuality) {
      quality.imageSmoothingQuality = 'high';
    }
  }

  private drawTileSprite(sprite: WxImage, x: number, y: number, size: number): void {
    this.ctx.drawImage(sprite, x, y, size, size);
  }

  /**
   * 停止循环并卸载监听。
   */
  public dispose(): void {
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
    if (typeof wx.offAudioInterruptionBegin === 'function') {
      wx.offAudioInterruptionBegin(this.onAudioInterruptionBeginBound);
    }
    if (typeof wx.offAudioInterruptionEnd === 'function') {
      wx.offAudioInterruptionEnd(this.onAudioInterruptionEndBound);
    }
    wx.offTouchStart(this.onTouchStartBound);
    wx.offTouchMove(this.onTouchMoveBound);
    wx.offTouchEnd(this.onTouchEndBound);
    wx.offTouchCancel(this.onTouchCancelBound);
    this.unsub?.();
    this.unsub = null;
    this.share.dispose();
    this.recommend.dispose();
    this.boardView.dispose();
    this.destroyGameClubButton();
    this.session.hideLobbyBanner();
  }

  private onGameEvent(event: GameEvent): void {
    this.requestPaint();
    if (event.type === 'InviteReward') {
      this.notifyUser(
        event.kind === 'invitee'
          ? '邀请礼到账 +1 锤子'
          : `好友通关了，你 +${event.hammers} 锤子`,
        '锤子到账',
      );
      return;
    }
    if (event.type === 'LevelWon') {
      this.pendingResult = 'won';
      this.statusText = '关卡胜利！';
      if (!this.animator.isPlaying() && !this.swapSlide) {
        this.afterLevelResolved();
      }
      return;
    }
    if (event.type === 'LevelFailed') {
      this.pendingResult = 'failed';
      this.statusText = '步数用完了，就差一点！';
      if (!this.animator.isPlaying() && !this.swapSlide) {
        this.afterLevelResolved();
      }
      return;
    }

    if (event.type === 'SwapAccepted') {
      this.beginSwapSlide(event.rowA, event.colA, event.rowB, event.colB, false);
      return;
    }

    if (event.type === 'SwapRejected') {
      this.beginSwapSlide(event.rowA, event.colA, event.rowB, event.colB, true);
      this.boardView.selectCell(event.rowA, event.colA);
      return;
    }

    if (event.type === 'ResolvePlayback') {
      if (this.mode === 'crush' || this.mode === 'clean' || this.mode === 'result') {
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
        waves: event.waves,
      };
      // 交换滑完再播消除；若无滑动则立刻播
      if (!this.swapSlide) {
        this.flushPendingPlayback();
      }
      return;
    }

    if (event.type === 'MovesBonusApplied') {
      this.statusText =
        event.movesConverted > 0
          ? `剩余 ${event.movesConverted} 步加成闪光！`
          : '步数加成';
      this.syncBoardView();
      return;
    }

    if (event.type === 'MovesBonusDone') {
      if (event.bonusScore > 0) {
        this.statusText = `步数加成 +${event.bonusScore}`;
      }
      return;
    }

    if (event.type === 'CrushBurstFired') {
      const board = this.session.getBoard();
      const cols = board?.size.cols ?? 8;
      const clearedCells = event.clearedIndices.map((index) => ({
        row: Math.floor(index / cols),
        col: index % cols,
      }));
      const now = this.nowMs || Date.now();
      this.crushBursts.push({
        row: event.row,
        col: event.col,
        radius: event.radius,
        startMs: now,
        durationMs: event.scoreAdded > 0 ? 560 : 320,
        scoreAdded: event.scoreAdded,
        clearedCells,
      });

      if (this.mode === 'crush' || this.mode === 'clean') {
        this.syncBoardView();
        this.spawnCrushFeedback(event.row, event.col, event.scoreAdded, clearedCells, now);
        if (event.scoreAdded > 0) {
          this.crushHasTapped = true;
          this.statusText =
            this.mode === 'clean'
              ? `打扫干净 +${event.scoreAdded}`
              : `砰！粉碎 +${event.scoreAdded}`;
          this.shakeMs = Math.min(180, 60 + event.scoreAdded);
          this.vibrateLight();
        } else {
          this.statusText =
            this.mode === 'clean' ? '点有小动物的格子清扫！' : '再点有动物的格子！';
        }
      }
      return;
    }

    if (event.type === 'CrushEnded') {
      this.lastCrushTapCount = this.session.getCrushTapCount();
      this.statusText =
        event.leftoverCleared > 0
          ? `时间到，剩余小动物收尾爆炸 +${event.crushScore}`
          : `粉碎加成 +${event.crushScore}`;
      if (this.mode === 'crush') {
        this.openResult();
      }
      return;
    }

    if (event.type === 'CleaningEnded') {
      this.statusText =
        event.tapCount > 0
          ? `清洁完成，打扫了 ${event.tapCount} 次`
          : '清洁结束';
      if (this.mode === 'clean') {
        this.openResult();
      }
      return;
    }

    if (event.type === 'BuriedRevealed') {
      this.buriedFx.set(event.id, {
        id: event.id,
        kind: event.kind,
        poseFrom: 0,
        leaveFrom: 0,
      });
      this.statusText = event.kind === BURIED_SNOWMAN ? '雪人整只露出来了！' : '企鹅整只露出来了！';
      return;
    }

    if (event.type === 'SnowmanQuake') {
      this.shakeMs = Math.max(this.shakeMs, 280);
      this.vibrateMedium();
      this.statusText = '雪人震动，周围冰块裂开了！';
      return;
    }

    if (event.type === 'BuriedHarvested') {
      this.spawnCoverChipJuice(event.indices, ['#f8f9fa', '#74c0fc', '#ffe066']);
      this.statusText = '冰碎了，企鹅和雪人已收集！';
      return;
    }

    if (event.type === 'BoosterUsed') {
      if (event.boosterId === 'hammer') {
        this.statusText = `锤子砸中！剩余 ${event.remaining}`;
      } else if (event.boosterId === 'shuffle') {
        this.statusText = `盘面已重排 · 剩余 ${event.remaining}`;
      } else {
        this.statusText = `+${event.movesGranted ?? 5} 步 · 剩余 ${event.remaining}`;
      }
      this.hammerTargeting = false;
      this.hammerCursor = null;
      if (!this.animator.isPlaying()) {
        this.syncBoardView();
      }
      return;
    }

    if (event.type === 'StateChanged' && event.to === 'PlayerInput') {
      if (this.mode === 'result' || this.mode === 'crush' || this.mode === 'clean') {
        this.mode = 'playing';
        this.statusText = '';
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

    if (event.type === 'BoardShuffled') {
      this.statusText =
        event.reason === 'booster'
          ? '小动物重新排列啦！'
          : '没有可移动的了，重新排列！';
      this.syncBoardView();
      return;
    }

    if (event.type === 'BoardChanged' || event.type === 'CascadeDone') {
      if (!this.animator.isPlaying() && !this.swapSlide) {
        this.syncBoardView();
      }
    }
  }

  /**
   * 消除动画结束后：先播剩余步数加成，再进粉碎/结算。
   */
  private afterLevelResolved(): void {
    if (this.animator.isPlaying() || this.swapSlide) {
      return;
    }
    if (this.pendingResult === 'won') {
      if (this.session.hasPendingMovesBonus()) {
        this.statusText = '剩余步数加成中…';
        this.session.runMovesBonus();
        // runMovesBonus 会再发 ResolvePlayback；播完再进这里
        return;
      }
      const level = this.session.getLevelConfig();
      if (level?.crushEnabled && this.session.fsm.getCurrent() === 'CrushReward') {
        this.openCrush();
        return;
      }
    }
    this.openResult();
  }

  private openCrush(): void {
    this.mode = 'crush';
    this.stopMatchPresentation();
    this.session.stopMatchPraiseSfx();
    this.crushBursts = [];
    this.floatingScores = [];
    this.crushSparks = [];
    this.shakeMs = 0;
    this.crushHasTapped = false;
    this.lastCrushTapCount = 0;
    this.offerCleanPrompt = false;
    this.statusText = '限时粉碎！点动物会爆炸加分';
    this.resultFx.stop();
    this.captureBurstScoreBarMax();
    this.syncBoardView();
  }

  private openClean(): void {
    this.mode = 'clean';
    this.stopMatchPresentation();
    this.session.stopMatchPraiseSfx();
    this.crushBursts = [];
    this.floatingScores = [];
    this.crushSparks = [];
    this.shakeMs = 0;
    this.crushHasTapped = false;
    this.offerCleanPrompt = false;
    this.statusText = '清洁模式！点一点，打扫干净！';
    this.resultFx.stop();
    this.captureBurstScoreBarMax();
    this.syncBoardView();
  }

  private openResult(): void {
    this.mode = 'result';
    const won = this.pendingResult === 'won';
    // 胜利且达标时询问清洁（依赖 finishCrushReward 先进入 Settle）
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
      this.session.getScore(),
    );
  }

  private pruneCrushBursts(now: number): void {
    compactTimed(this.crushBursts, now, timedListCap('bursts', this.cheapFx));
    compactTimed(this.floatingScores, now, timedListCap('scores', this.cheapFx));
    compactTimed(this.crushSparks, now, timedListCap('sparks', this.cheapFx));
  }

  /**
   * 点击粉碎成功后的飘分 / 火花。
   */
  private spawnCrushFeedback(
    row: number,
    col: number,
    scoreAdded: number,
    clearedCells: Array<{ row: number; col: number }>,
    now: number,
  ): void {
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
        durationMs: praise.tier === 'excellent' ? 1100 : 920,
        color: praise.color,
        fontSize: praise.tier === 'excellent' ? 48 : praise.tier === 'great' ? 42 : 36,
      });
      this.floatingScores.push({
        x: cx,
        y: cy - layout.cellSize * 0.08,
        text: `+${scoreAdded}`,
        startMs: now,
        durationMs: 900,
        color: '#ffe566',
      });
      this.hudBarPulse = 420;
      this.hudScorePunch = 1.2;
      const target = this.burstScoreBarTarget();
      this.hudBurstBarDisplay = Math.max(
        this.hudBurstBarDisplay,
        Math.min(1, this.hudBurstBarDisplay + Math.max(0.08, target * 0.12)),
      );
    }

    const sparkCount = crushSparkCount(this.cheapFx, clearedCells.length);
    for (let i = 0; i < sparkCount; i += 1) {
      const ang = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.4;
      const speed = 55 + Math.random() * 120;
      const style: CrushSpark['style'] =
        i % 3 === 0 ? 'star' : i % 3 === 1 ? 'streak' : 'dot';
      this.crushSparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 40,
        startMs: now,
        durationMs: 420 + Math.random() * 280,
        color: ['#fff3a0', '#ff7a3d', '#ff85c0', '#ffffff', '#74c0fc'][i % 5]!,
        style,
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
        color: '#ffffff',
        style: 'star',
      });
    }
  }

  /** 轻触震动（支持则调用）。 */
  private vibrateLight(): void {
    if (typeof wx.vibrateShort === 'function') {
      try {
        wx.vibrateShort({ type: 'light' });
      } catch {
        // ignore
      }
    }
  }

  private vibrateMedium(): void {
    if (typeof wx.vibrateShort === 'function') {
      try {
        wx.vibrateShort({ type: 'medium' });
      } catch {
        this.vibrateLight();
      }
    }
  }

  private beginSwapSlide(
    rowA: number,
    colA: number,
    rowB: number,
    colB: number,
    rejected: boolean,
  ): void {
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
      rejected,
    };
  }

  private updateSwapSlide(now: number): void {
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
  private stopMatchPresentation(): void {
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
  private captureBurstScoreBarMax(): void {
    const board = this.session.getBoard();
    let occupied = 0;
    if (board) {
      for (let r = 0; r < board.size.rows; r += 1) {
        for (let c = 0; c < board.size.cols; c += 1) {
          if (board.getTile(r, c) !== TileKind.Empty) {
            occupied += 1;
          }
        }
      }
    }
    this.burstScoreBarMax = Math.max(80, occupied * 10);
    this.hudBurstBarDisplay = 0;
  }

  private burstScoreBarTarget(): number {
    const burst =
      this.mode === 'clean'
        ? this.session.getCleanSession()
        : this.session.getCrushSession();
    const score = burst?.crushScore ?? 0;
    return Math.max(0, Math.min(1, score / Math.max(1, this.burstScoreBarMax)));
  }

  private updateBurstScoreBar(dt: number): void {
    const target = this.burstScoreBarTarget();
    const k = 1 - Math.exp(-dt * 0.018);
    this.hudBurstBarDisplay += (target - this.hudBurstBarDisplay) * k;
    if (Math.abs(target - this.hudBurstBarDisplay) < 0.002) {
      this.hudBurstBarDisplay = target;
    }
  }

  private flushPendingPlayback(): void {
    if (this.mode === 'crush' || this.mode === 'clean' || this.mode === 'result') {
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
      this.spawnCoverChipJuice(chippedEggIndices ?? [], ['#fff4cc', '#ffd43b', '#ffe8a3']);
      this.spawnCoverChipJuice(chippedVineIndices ?? [], ['#b2f2bb', '#51cf66', '#2f9e44']);
    });
    this.animator.start(
      {
        rows: playback.rows,
        cols: playback.cols,
        cells: playback.cells,
        tileIds: playback.tileIds,
        sparkles: playback.sparkles,
      },
      playback.waves,
      this.nowMs || Date.now(),
    );
  }

  /**
   * 三消波次：粒子炸开 + 飘分 + 震动；连锁再播消除音。
   */
  private spawnMatchClearJuice(
    cells: Array<{ row: number; col: number; kind: number }>,
    waveIndex: number,
    hasSpecial: boolean,
  ): void {
    if (this.mode === 'crush' || this.mode === 'clean' || this.mode === 'result') {
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

    const skipFirstWaveSfx =
      waveIndex === 0 && this.session.takeFirstWavePraiseAlreadyPlayed();
    if (!skipFirstWaveSfx) {
      this.session.playMatchPraiseSfx(points);
    }
    this.vibrateLight();
    this.shakeMs = Math.min(160, 48 + cells.length * 9 + waveIndex * 14);
    this.hudBarPulse = Math.min(420, 180 + waveIndex * 60);
    this.hudScorePunch = Math.min(1.22, 1.08 + waveIndex * 0.04);

    // 中心飘分 / 连击字
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
      durationMs: praise.tier === 'excellent' ? 1100 : 920,
      color: praise.color,
      fontSize: praise.tier === 'excellent' ? 48 : praise.tier === 'great' ? 42 : 36,
    });
    this.floatingScores.push({
      x: sx,
      y: sy - layout.cellSize * 0.12,
      text: `+${points}`,
      startMs: now,
      durationMs: 860,
      color: waveIndex >= 2 ? '#ffe066' : '#ffffff',
    });
    if (waveIndex >= 1) {
      this.floatingScores.push({
        x: sx,
        y: sy + layout.cellSize * 0.72,
        text: `连击 x${chain}！`,
        startMs: now,
        durationMs: 720,
        color: '#ff85c0',
      });
    }
    if (waveIndex >= 3) {
      this.floatingScores.push({
        x: sx,
        y: sy - layout.cellSize * 0.78,
        text: '超爽！',
        startMs: now,
        durationMs: 680,
        color: '#ff922b',
      });
    }
    if (hasSpecial) {
      this.floatingScores.push({
        x: sx,
        y: sy - layout.cellSize * 0.55,
        text: '特殊合成！',
        startMs: now,
        durationMs: 750,
        color: '#74c0fc',
      });
    }

    // 每格小爆炸：星 + 拖尾 + 糖屑
    for (const cell of cells) {
      const cx = layout.originX + (cell.col + 0.5) * layout.cellSize;
      const cy = layout.originY - (cell.row + 0.5) * layout.cellSize;
      const n = juiceSparkCount(this.cheapFx, waveIndex);
      for (let i = 0; i < n; i += 1) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.35;
        const speed = 70 + Math.random() * 130 + waveIndex * 12;
        const style: CrushSpark['style'] =
          i % 4 === 0 ? 'star' : i % 4 === 1 ? 'streak' : 'dot';
        this.crushSparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 40,
          startMs: now,
          durationMs: 460 + Math.random() * 220,
          color: ['#fff', '#ffe066', '#ff85c0', '#74c0fc', '#8ce99a', '#ff922b'][i % 6]!,
          style,
        });
      }
    }
  }

  /** 邻格小动物消完后，棉花掉层并喷出棉絮。 */
  private spawnCottonChipJuice(chippedCloudIndices: number[]): void {
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
        const ang = (Math.PI * 2 * i) / fluff + Math.random() * 0.4;
        const speed = 36 + Math.random() * 90;
        this.crushSparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 28,
          startMs: now,
          durationMs: 520 + Math.random() * 180,
          color: i % 2 === 0 ? '#f7fbff' : '#d7e4f0',
          style: i % 3 === 0 ? 'star' : 'dot',
        });
      }
    }
  }

  private spawnCoverChipJuice(indices: number[], colors: string[]): void {
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
        const ang = (Math.PI * 2 * i) / fluff + Math.random() * 0.4;
        const speed = 40 + Math.random() * 100;
        this.crushSparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 30,
          startMs: now,
          durationMs: 500 + Math.random() * 180,
          color: colors[i % colors.length]!,
          style: i % 3 === 0 ? 'star' : 'dot',
        });
      }
    }
  }

  private cellScreenRect(
    layout: { cellSize: number; originX: number; originY: number },
    row: number,
    col: number,
  ): { x: number; y: number } {
    return {
      x: layout.originX + col * layout.cellSize,
      y: layout.originY - (row + 1) * layout.cellSize,
    };
  }

  private swapSlideProgress(now: number): number {
    if (!this.swapSlide) {
      return 1;
    }
    const t = (now - this.swapSlide.startMs) / this.swapSlide.durationMs;
    return Math.max(0, Math.min(1, t));
  }

  /** easeOutCubic */
  private easeOutSwap(t: number): number {
    const u = 1 - t;
    return 1 - u * u * u;
  }

  private syncBoardView(): void {
    const board = this.session.getBoard();
    if (!board) {
      return;
    }
    const layout = this.computeBoardLayout(board);
    this.boardView.updateLayout(layout);
    this.boardView.syncFromBoard(board, true);
  }

  private computeBoardLayout(board: { size: { rows: number; cols: number } }): {
    cellSize: number;
    originX: number;
    originY: number;
  } {
    const top = this.getHudBottom() + (this.mode === 'crush' || this.mode === 'clean' ? 28 : 12);
    const bottomReserve =
      this.mode === 'crush' || this.mode === 'clean' ? 88 : this.mode === 'playing' ? 96 : 24;
    const key = `${this.mode}:${board.size.rows}x${board.size.cols}:${top}:${bottomReserve}:${this.width}x${this.height}`;
    if (key === this.layoutCacheKey) {
      return this.layoutCache;
    }
    const sidePad = 20;
    const areaBottom = this.height - bottomReserve;
    const maxW = this.width - sidePad * 2;
    const maxH = Math.max(80, areaBottom - top - 16);
    const cellSize = Math.floor(
      Math.min(maxW / board.size.cols, maxH / board.size.rows),
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
  private getHudFrame(): {
    top: number;
    left: number;
    right: number;
    width: number;
  } {
    // 整体放在状态栏/胶囊下方，右侧不超过胶囊左缘
    const belowCapsule = (this.menuButton?.bottom ?? this.statusBarHeight + 32) + 8;
    const top = Math.max(this.statusBarHeight + 8, belowCapsule);
    const left = 12;
    const right = this.menuButton
      ? Math.max(left + 140, this.menuButton.left - 12)
      : this.width - 12;
    return { top, left, right, width: Math.max(80, right - left) };
  }

  private getHudBottom(): number {
    // 关卡行 26 + 间距 8 + 信息行 64（含饱满进度条）
    return this.getHudFrame().top + 26 + 8 + 64;
  }

  private handleTouchStart(e: WxTouchEvent): void {
    this.markUserActivity();
    this.tryStartBgm();
    if (this.isInputMuted()) {
      return;
    }
    if (this.overlay === 'leaderboard') {
      const p = this.readTouchPoint(e, false);
      if (!p) {
        return;
      }
      this.lastPointerX = p.x;
      this.lastPointerY = p.y;
      this.beginLeaderboardScroll(p.x, p.y);
      return;
    }
    if (this.overlay !== 'none') {
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
    if (this.mode === 'lobby') {
      if (this.hitLobbyNavChip(p.x, p.y)) {
        return;
      }
      this.beginLobbyDrag(p.x, p.y);
      return;
    }
    if (this.mode === 'crush' || this.mode === 'clean') {
      this.crushTapOnDown = this.tryHandleCrushTap(p.x, p.y);
      return;
    }
    if (this.mode === 'playing' && !this.animator.isPlaying() && !this.swapSlide && !this.hammerTargeting) {
      const chrome = this.hitButton(p.x, p.y);
      if (chrome && chrome.id !== 'level') {
        return;
      }
      this.boardView.onPointerDown(p.x, p.y);
    }
  }

  private handleTouchMove(e: WxTouchEvent): void {
    this.markUserActivity();
    if (this.isInputMuted()) {
      return;
    }
    if (this.overlay === 'leaderboard') {
      const p = this.readTouchPoint(e, false);
      if (!p) {
        return;
      }
      this.lastPointerX = p.x;
      this.lastPointerY = p.y;
      this.moveLeaderboardScroll(p.y);
      return;
    }
    if (this.overlay !== 'none') {
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
    if (this.mode === 'lobby') {
      this.moveLobbyDrag(p.x, p.y);
      return;
    }
    if (this.mode === 'playing' && !this.animator.isPlaying() && !this.swapSlide && !this.hammerTargeting) {
      this.boardView.onPointerMove(p.x, p.y);
    }
  }

  private handleTouchEnd(e: WxTouchEvent): void {
    this.markUserActivity();
    if (this.isInputMuted()) {
      this.boardView.onPointerCancel();
      this.lobbyDrag = null;
      this.leaderboardDrag = null;
      this.crushTapOnDown = false;
      return;
    }
    const p = this.readTouchPoint(e, true) ?? {
      x: this.lastPointerX,
      y: this.lastPointerY,
    };
    const x = p.x;
    const y = p.y;
    this.ensureBoardLayoutSynced();

    if (this.overlay === 'leaderboard') {
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

    if (this.overlay !== 'none') {
      this.lobbyDrag = null;
      this.crushTapOnDown = false;
      const overlayHit = this.hitButton(x, y);
      if (overlayHit) {
        void this.onButton(overlayHit.id, overlayHit.levelId);
      }
      return;
    }

    if (this.mode === 'lobby' && this.endLobbyDrag()) {
      return;
    }

    if (this.crushTapOnDown) {
      this.crushTapOnDown = false;
      this.boardView.onPointerCancel();
      return;
    }

    // 棋盘手势进行中：优先结束棋盘逻辑，避免抬起落在道具按钮上导致“点了没反应”
    const boardGestureActive =
      this.mode === 'playing' &&
      !this.hammerTargeting &&
      this.boardView.hasActivePointer();
    if (boardGestureActive && !this.animator.isPlaying() && !this.swapSlide) {
      this.boardView.onPointerUp(x, y);
      return;
    }

    if (this.mode === 'crush' || this.mode === 'clean') {
      if (this.tryHandleCrushTap(x, y)) {
        return;
      }
    }

    const hit = this.hitButton(x, y);
    if (hit) {
      if (this.mode === 'result') {
        const layout = this.resultFx.getLayout(this.nowMs || Date.now());
        if (!layout.interactive) {
          return;
        }
      }
      void this.onButton(hit.id, hit.levelId);
      return;
    }

    if (this.overlay !== 'none') {
      return;
    }

    if (this.mode === 'playing' && !this.animator.isPlaying() && !this.swapSlide) {
      if (this.hammerTargeting) {
        const cell = this.boardView.hitCell(x, y, 12);
        if (cell) {
          const ok = this.session.useHammer(cell.row, cell.col);
          if (!ok) {
            this.statusText = '请点有小动物的格子';
          } else {
            this.hammerCursor = null;
          }
        } else {
          this.hammerTargeting = false;
          this.hammerCursor = null;
          this.statusText = '已取消锤子';
        }
        return;
      }
      this.boardView.onPointerUp(x, y);
    }
  }

  private handleTouchCancel(_e: WxTouchEvent): void {
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

  private readTouchPoint(
    e: WxTouchEvent,
    preferChanged: boolean,
  ): { x: number; y: number } | null {
    const t = preferChanged
      ? (e.changedTouches[0] ?? e.touches[0])
      : (e.touches[0] ?? e.changedTouches[0]);
    if (!t) {
      return null;
    }
    const x = this.pickTouchCoord(t.clientX, t.x, t.pageX);
    const y = this.pickTouchCoord(t.clientY, t.y, t.pageY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    // 微信偶发抬起坐标变成 0,0
    if (preferChanged && x === 0 && y === 0 && (this.lastPointerX !== 0 || this.lastPointerY !== 0)) {
      return { x: this.lastPointerX, y: this.lastPointerY };
    }
    return { x, y };
  }

  private pickTouchCoord(
    client: number | undefined,
    canvas: number | undefined,
    page: number | undefined,
  ): number {
    if (Number.isFinite(client)) {
      return client as number;
    }
    if (Number.isFinite(canvas)) {
      return canvas as number;
    }
    if (Number.isFinite(page)) {
      return page as number;
    }
    return Number.NaN;
  }

  /** 粉碎/清洁：按下即点格子，棋盘优先于底部按钮 */
  private tryHandleCrushTap(x: number, y: number): boolean {
    const cell = this.boardView.hitCell(x, y, 12);
    if (!cell) {
      return false;
    }
    const ok = this.session.tryCrushTap(cell.row, cell.col);
    if (!ok) {
      this.statusText =
        this.mode === 'clean' ? '清洁已结束' : '粉碎时间到了';
    }
    return true;
  }

  /** 保证命中检测与绘制使用同一套棋盘布局 */
  private ensureBoardLayoutSynced(): void {
    const board = this.session.getBoard();
    if (!board) {
      return;
    }
    if (
      this.mode !== 'playing' &&
      this.mode !== 'crush' &&
      this.mode !== 'clean' &&
      this.mode !== 'result'
    ) {
      return;
    }
    this.boardView.updateLayout(this.computeBoardLayout(board));
  }

  /** 按当前页面生成转发 / 朋友圈文案。 */
  private buildSharePayload(): {
    title: string;
    imageUrl: string;
    imageUrlId?: string;
    query: string;
  } {
    const level = this.session.getLevelConfig();
    const levelId = level?.id ?? 1;
    const score = this.session.getScore();
    const scene: ShareScene =
      this.boosterShareScene ??
      (this.mode === 'playing' ||
      this.mode === 'crush' ||
      this.mode === 'clean' ||
      this.mode === 'result'
        ? this.mode
        : 'lobby');
    const title = buildShareTitle(scene, levelId, score);
    const query = buildShareQuery(
      scene,
      levelId,
      score,
      this.session.getInviteCode(),
    );
    const imageSlot =
      scene === 'crush' || scene === 'clean' ? 'sparkle' : scene === 'lobby' ? 'lobby' : 'playing';
    return {
      title,
      ...this.resolveShareImage(imageSlot),
      query,
    };
  }

  /**
   * 会话分享图：未过审时用包内 5:4 图；过审后把编号和官方地址填进 share-images.json。
   */
  private resolveShareImage(slot: 'lobby' | 'playing' | 'sparkle'): {
    imageUrl: string;
    imageUrlId?: string;
  } {
    const entry = shareImagesJson[slot];
    const imageUrl = entry.imageUrl || 'assets/main/share/lobby-500x400.jpg';
    const imageUrlId = entry.imageUrlId.trim();
    return imageUrlId ? { imageUrl, imageUrlId } : { imageUrl };
  }

  /** 左下角导航槽位尺寸，供道具栏避让；与底部胶囊行垂直居中。 */
  private getNavChipFrame(): { x: number; y: number; w: number; h: number } {
    if (this.mode !== 'lobby') {
      const layout = this.getInLevelBottomNavLayout();
      return {
        x: layout.muteX,
        y: layout.muteY,
        w: layout.muteSize,
        h: layout.muteSize,
      };
    }
    const banner = this.session.getLobbyBannerReservePx();
    const bottom = lobbyNavBottomGap(banner, this.safeAreaBottom);
    const chipY = this.height - LOBBY_NAV_CHIP_H - bottom;
    return layoutLobbyGear(chipY, LOBBY_NAV_CHIP_H);
  }

  /** 局内左下：音效与道具栏底边对齐，「回首页」叠在音效上方。 */
  private getInLevelBottomNavLayout(): {
    muteX: number;
    muteY: number;
    muteSize: number;
    homeX: number;
    homeY: number;
    homeW: number;
    homeH: number;
  } {
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
      homeH,
    };
  }

  private hitLobbyNavChip(x: number, y: number): boolean {
    const hit = this.hitButton(x, y);
    return !!hit && hit.id !== 'level';
  }

  /** 大厅 / 局内左下角：音效开关。局内与道具栏同高，上方附「回首页」。 */
  private drawNavChips(): void {
    if (this.mode !== 'lobby') {
      this.hideGameClubNativeButton();
      const layout = this.getInLevelBottomNavLayout();
      this.pushMuteNavButton(
        layout.muteX,
        layout.muteY,
        layout.muteSize,
        layout.muteSize,
        LOBBY_NAV_HIT_PAD,
      );
      const homeBtn: UiButton = {
        id: 'lobby',
        x: layout.homeX,
        y: layout.homeY,
        w: layout.homeW,
        h: layout.homeH,
        label: '回首页',
        hitPad: 6,
      };
      this.buttons.push(homeBtn);
      this.drawCuteButton(homeBtn, {
        top: '#a5d8ff',
        bottom: '#339af0',
        border: '#ffffff',
        gloss: true,
        fontSize: 12,
      });
      return;
    }

    const daily = this.session.getDailyLoop();
    const chrome = layoutLobbyBottom({
      width: this.width,
      height: this.height,
      bannerReserve: this.session.getLobbyBannerReservePx(),
      safeBottom: this.safeAreaBottom,
      clearsToday: daily.clearsToday,
      shuffleGranted: daily.playShuffleGranted,
    });
    this.pushMuteNavButton(
      chrome.settings.x,
      chrome.settings.y,
      chrome.settings.w,
      chrome.settings.h,
      8,
    );

    if (chrome.claim) {
      const claimBtn: UiButton = {
        id: 'claim_shuffle',
        x: chrome.claim.x,
        y: chrome.claim.y,
        w: chrome.claim.w,
        h: chrome.claim.h,
        label: chrome.claim.label,
        hitPad: 6,
      };
      this.buttons.push(claimBtn);
      this.drawCuteButton(claimBtn, {
        top: '#ffe066',
        bottom: '#f59f00',
        border: '#ffffff',
        gloss: true,
      });
    }

    const palettes: Record<
      'recommend' | 'club',
      { top: string; bottom: string; border: string; gloss: boolean }
    > = {
      recommend: { top: '#8ce99a', bottom: '#37b24d', border: '#ffffff', gloss: true },
      club: { top: '#74c0fc', bottom: '#1c7ed6', border: '#ffffff', gloss: true },
    };
    for (const item of chrome.chips) {
      const btn: UiButton = {
        id: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        label: item.label,
        hitPad: 8,
      };
      this.buttons.push(btn);
      this.drawCuteButton(btn, palettes[item.id]);
      if (item.id === 'club') {
        this.syncGameClubNativeButton(btn);
      }
    }
  }

  /** 左下角音效：开=彩色喇叭，关=灰色静音。 */
  private pushMuteNavButton(
    x: number,
    y: number,
    w: number,
    h: number,
    hitPad: number,
  ): void {
    const size = Math.max(w, h, 42);
    const btn: UiButton = {
      id: 'mute',
      x: x + w / 2 - size / 2,
      y: y + h / 2 - size / 2,
      w: size,
      h: size,
      label: '',
      hitPad,
    };
    this.buttons.push(btn);
    this.drawMuteToggleButton(btn, this.session.isMuted());
  }

  /** 首页左上角糖果列表（邀请 / 排行 / 怎么玩）。 */
  private drawLobbySideActions(): void {
    if (this.mode !== 'lobby') {
      return;
    }
    const top = lobbySideActionsTop(this.statusBarHeight);
    const frames = layoutLobbySideActions(top, this.width);
    const palettes: Record<
      LobbySideActionFrame['id'],
      { top: string; bottom: string; border: string; gloss: boolean; fontSize: number }
    > = {
      invite: {
        top: '#63e6be',
        bottom: '#12b886',
        border: '#ffffff',
        gloss: true,
        fontSize: LOBBY_SIDE_ACTION_FONT,
      },
      leaderboard: {
        top: '#d0bfff',
        bottom: '#845ef7',
        border: '#ffffff',
        gloss: true,
        fontSize: LOBBY_SIDE_ACTION_FONT,
      },
      howto: {
        top: '#ffc078',
        bottom: '#f76707',
        border: '#ffffff',
        gloss: true,
        fontSize: LOBBY_SIDE_ACTION_FONT,
      },
    };
    for (const frame of frames) {
      const btn: UiButton = {
        id: frame.id,
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h,
        label: frame.label,
        hitPad: 6,
      };
      this.buttons.push(btn);
      this.drawCuteButton(btn, palettes[frame.id]);
    }
  }


  private hideGameClubNativeButton(): void {
    if (this.gameClubButtonKey === 'hidden') {
      return;
    }
    this.gameClubButtonKey = 'hidden';
    this.gameClubButton?.hide?.();
  }

  private destroyGameClubButton(): void {
    try {
      this.gameClubButton?.offTap?.(this.onGameClubTapped);
    } catch {
      // ignore
    }
    this.gameClubTapHooked = false;
    this.gameClubButton?.destroy?.();
    this.gameClubButton = null;
    this.gameClubButtonKey = '';
  }

  private hookGameClubTap(): void {
    if (this.gameClubTapHooked || !this.gameClubButton) {
      return;
    }
    this.gameClubButton.onTap?.(this.onGameClubTapped);
    this.gameClubTapHooked = true;
  }

  private isMobileWechat(): boolean {
    if (isWxDesktopIdeHost()) {
      return false;
    }
    return (
      this.wxPlatform === 'ios' ||
      this.wxPlatform === 'android' ||
      this.wxPlatform === 'ohos' ||
      this.wxPlatform === 'harmonyos'
    );
  }

  /**
   * 大厅「圈子」用微信原生游戏圈按钮（不传 openlink，打开默认游戏圈）。
   * 后台「游戏内打开」长串给 PageManager 会 openPage:fail。
   */
  private syncGameClubNativeButton(chip: { x: number; y: number; w: number; h: number }): void {
    const box = toNativeViewStyle({
      left: chip.x,
      top: chip.y,
      width: chip.w,
      height: chip.h,
    });
    const visible =
      !!box &&
      this.mode === 'lobby' &&
      this.overlay === 'none' &&
      this.isMobileWechat() &&
      !this.foregroundHidden;
    const key = visible && box
      ? `club-v4:${box.left},${box.top},${box.width},${box.height}`
      : 'hidden';
    if (key === this.gameClubButtonKey) {
      return;
    }
    this.gameClubButtonKey = key;
    if (!visible || !box || typeof wx.createGameClubButton !== 'function') {
      this.gameClubButton?.hide?.();
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
      this.gameClubButton.show?.();
      this.foreground.holdNativeChrome(800);
      return;
    }
    try {
      this.gameClubButton = wx.createGameClubButton({
        type: 'text',
        text: '',
        hasRedDot: false,
        style: {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          backgroundColor: 'rgba(0,0,0,0)',
          borderWidth: 0,
          color: 'rgba(0,0,0,0)',
          textAlign: 'center',
          fontSize: 1,
          lineHeight: box.height,
        },
      });
      this.hookGameClubTap();
      this.gameClubButton.show?.();
      this.foreground.holdNativeChrome(800);
    } catch {
      this.gameClubButton = null;
      this.gameClubButtonKey = '';
    }
  }

  /**
   * 画布点击兜底：原生按钮未盖住时，仍不要用首页长 openlink 调 PageManager。
   */
  private openGameClub(): void {
    this.statusText = this.isMobileWechat()
      ? '请点蓝色「圈子」按钮'
      : '游戏圈只能在手机微信里打开';
  }

  /** 拉起官方推荐半屏：玩家点推荐后会出现在「发现-游戏」好友流。 */
  private async openGameRecommend(): Promise<void> {
    if (isWxDesktopIdeHost() || !this.isMobileWechat()) {
      this.statusText = '推荐只能在手机微信里打开';
      return;
    }
    this.foreground.forcePause();
    const result = await this.recommend.show();
    if (result === 'shown') {
      return;
    }
    this.foreground.onShow();
    this.statusText =
      result === 'unsupported' ? '当前微信版本暂不支持推荐' : '推荐暂时打不开，稍后再试';
  }

  /** 设置 / 玩法弹层 */
  private drawPageOverlay(): void {
    if (this.overlay === 'none') {
      return;
    }
    const { ctx, width, height } = this;
    this.buttons = [];

    this.buttons.push({
      id: 'resume',
      x: 0,
      y: 0,
      w: width,
      h: height,
      label: '',
    });

    ctx.save();
    ctx.fillStyle = 'rgba(40, 20, 55, 0.46)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (this.overlay === 'howto') {
      this.drawHowToPanel();
      return;
    }
    if (this.overlay === 'notice') {
      this.drawNoticePanel();
      return;
    }
    if (this.overlay === 'leaderboard') {
      this.drawLeaderboardPanel();
      return;
    }
    if (this.overlay === 'profile_welcome') {
      this.drawProfileWelcomePanel();
      return;
    }
    this.drawSettingsPanel();
  }

  /** 好友排行：标题/奖励固定，玩家列表可滑动。 */
  private drawLeaderboardPanel(): void {
    this.ctx.font = '12px sans-serif';
    const view = this.boardViewModel;
    const layout = layoutLeaderboardPanel({
      width: this.width,
      height: this.height,
      hint: view?.hint ?? '',
      rewardText: view?.rewardText ?? '',
      rows: view?.rows ?? [],
      wrap: (text, maxWidth) => this.wrapText(text, maxWidth),
    });
    this.leaderboardScrollY = clampLeaderboardScroll(this.leaderboardScrollY, layout);
    const { ctx } = this;
    const { panel } = layout;
    this.drawCuteCard(panel.x, panel.y, panel.w, panel.h, {
      radius: 24,
      fillTop: 'rgba(255,255,255,0.98)',
      fillBottom: 'rgba(232, 248, 255, 0.97)',
      border: 'rgba(116, 192, 252, 0.95)',
      borderWidth: 3,
      shadow: true,
      sparkle: true,
      sparkleColor: '#a5d8ff',
      nowMs: this.nowMs || Date.now(),
    });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#1864ab';
    ctx.fillText(layout.title, panel.x + panel.w / 2, panel.y + 28);
    ctx.restore();

    let ty = layout.bodyTop;
    for (const row of layout.headerRows) {
      if (row.kind === 'reward') {
        const rewardW = panel.w - 28;
        ctx.font = '12px sans-serif';
        const lines = this.wrapText(row.text, rewardW);
        const rowH = Math.max(layout.metaRowH, lines.length * 16 + 8);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#fa5252';
        let ly = ty + 2;
        const cx = panel.x + panel.w / 2;
        for (const line of lines) {
          ctx.fillText(line, cx, ly);
          ly += 16;
        }
        ty += rowH + 6;
        continue;
      }
      ctx.font = '12px sans-serif';
      const lines = this.wrapText(row.text, layout.textWidth + 56);
      const rowH = Math.max(layout.metaRowH, lines.length * 16 + 10);
      ctx.fillStyle = '#74c0fc';
      this.roundRectPath(layout.tagX, ty, 44, 24, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.tag, layout.tagX + 22, ty + 12);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#1864ab';
      let ly = ty + 2;
      for (const line of lines) {
        ctx.fillText(line, layout.textX - 20, ly);
        ly += 16;
      }
      ty += rowH + 6;
    }

    // 可滑动玩家列表
    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x + 6, layout.listTop, panel.w - 12, layout.listViewportH);
    ctx.clip();
    let py = layout.listTop - this.leaderboardScrollY;
    for (const row of layout.playerRows) {
      const rowH = layout.rowH;
      const nextY = py + rowH + 6;
      if (nextY > layout.listTop && py < layout.listBottom) {
        this.drawLeaderboardPlayerRow(row, layout, py, rowH);
      }
      py = nextY;
    }
    ctx.restore();

    // 可滑时画右侧细滚动条
    const maxScroll = Math.max(0, layout.listContentH - layout.listViewportH);
    if (maxScroll > 4 && layout.listViewportH > 20) {
      const trackX = panel.x + panel.w - 10;
      const trackTop = layout.listTop + 4;
      const trackH = layout.listViewportH - 8;
      const thumbH = Math.max(18, (layout.listViewportH / layout.listContentH) * trackH);
      const thumbY = trackTop + (this.leaderboardScrollY / maxScroll) * (trackH - thumbH);
      ctx.fillStyle = 'rgba(116, 192, 252, 0.25)';
      this.roundRectPath(trackX, trackTop, 3, trackH, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(28, 126, 214, 0.55)';
      this.roundRectPath(trackX, thumbY, 3, thumbH, 2);
      ctx.fill();
    }

    for (const spec of layout.buttons) {
      const btn: UiButton = {
        id: spec.id,
        x: spec.x,
        y: spec.y,
        w: spec.w,
        h: spec.h,
        label: spec.label,
      };
      this.buttons.push(btn);
      if (isPanelCloseLabel(spec.label) || isPanelBackLabel(spec.label)) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = '#74c0fc';
        ctx.fillText(spec.label, spec.x + spec.w / 2, spec.y + spec.h / 2);
      } else {
        this.drawCuteButton(btn, spec.palette);
      }
    }
  }

  private resolveLeaderboardLayout() {
    const view = this.boardViewModel;
    return layoutLeaderboardPanel({
      width: this.width,
      height: this.height,
      hint: view?.hint ?? '',
      rewardText: view?.rewardText ?? '',
      rows: view?.rows ?? [],
      wrap: (text, maxWidth) => this.wrapText(text, maxWidth),
    });
  }

  private beginLeaderboardScroll(x: number, y: number): void {
    const layout = this.resolveLeaderboardLayout();
    const inList =
      x >= layout.panel.x
      && x <= layout.panel.x + layout.panel.w
      && y >= layout.listTop
      && y <= layout.listBottom;
    if (!inList || layout.listContentH <= layout.listViewportH + 1) {
      this.leaderboardDrag = null;
      return;
    }
    this.leaderboardDrag = { startY: y, lastY: y, scrolled: false };
  }

  private moveLeaderboardScroll(y: number): void {
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
      layout,
    );
    this.requestPaint();
  }

  /** @returns 是否发生了滑动（滑动则不当作点击） */
  private endLeaderboardScroll(): boolean {
    const scrolled = !!this.leaderboardDrag?.scrolled;
    this.leaderboardDrag = null;
    return scrolled;
  }

  /** 首次进入：可选授权头像昵称（不强制）。 */
  private drawProfileWelcomePanel(): void {
    const { ctx, width, height } = this;
    const welcome = (noticeJson as { profileWelcome?: {
      title?: string;
      body?: string;
      skip?: string;
    } }).profileWelcome;
    const panelW = Math.min(320, width - 40);
    const body = welcome?.body ?? '授权后，好友排行会显示你的头像和昵称。也可跳过，不影响游玩。';
    ctx.font = '13px sans-serif';
    const lines = this.wrapText(body, panelW - 40);
    const panelH = 168 + lines.length * 18;
    const x = (width - panelW) / 2;
    const y = Math.max(80, height * 0.28);
    this.drawCuteCard(x, y, panelW, panelH, {
      radius: 22,
      fillTop: 'rgba(255,255,255,0.98)',
      fillBottom: 'rgba(232, 248, 255, 0.97)',
      border: 'rgba(116, 192, 252, 0.95)',
      borderWidth: 3,
      shadow: true,
      sparkle: true,
      sparkleColor: '#a5d8ff',
      nowMs: this.nowMs || Date.now(),
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#1864ab';
    ctx.fillText(welcome?.title ?? '展示微信头像', x + panelW / 2, y + 32);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#495057';
    ctx.textBaseline = 'top';
    let ly = y + 56;
    for (const line of lines) {
      ctx.fillText(line, x + panelW / 2, ly);
      ly += 18;
    }
    const skip: UiButton = {
      id: 'profile_skip',
      x: x + 24,
      y: y + panelH - 36,
      w: panelW - 48,
      h: 28,
      label: welcome?.skip ?? '暂不授权',
    };
    this.buttons.push(skip);
    ctx.textBaseline = 'middle';
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#74c0fc';
    ctx.fillText(skip.label, skip.x + skip.w / 2, skip.y + skip.h / 2);
  }

  private drawLeaderboardPlayerRow(
    row: LeaderboardLine,
    layout: ReturnType<typeof layoutLeaderboardPanel>,
    ty: number,
    rowH: number,
  ): void {
    const { ctx } = this;
    const { panel } = layout;
    if (row.highlight) {
      ctx.fillStyle = 'rgba(208, 235, 255, 0.95)';
      this.roundRectPath(panel.x + 8, ty - 2, panel.w - 16, rowH, 14);
      ctx.fill();
    }
    // 排名圆
    const rankCx = layout.tagX + 12;
    const rankCy = ty + rowH / 2;
    ctx.beginPath();
    ctx.arc(rankCx, rankCy, 11, 0, Math.PI * 2);
    ctx.fillStyle = row.highlight ? '#1c7ed6' : '#74c0fc';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.tag, rankCx, rankCy);

    // 头像
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
      ctx.fillStyle = row.highlight ? '#1c7ed6' : '#a5d8ff';
      ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(row.badge || (row.nickName || '玩').slice(0, 1), ax, ay);
      if (row.avatarUrl && !this.avatarCache.has(row.avatarUrl)) {
        this.prefetchAvatar(row.avatarUrl);
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 昵称 + 微信号
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#1864ab';
    const name = row.nickName || '微信玩家';
    ctx.fillText(name, layout.textX, ty + rowH * 0.36);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#4c6ef5';
    ctx.fillText(`邀请码 ${row.wxId || '—'}`, layout.textX, ty + rowH * 0.68);

    // 分数
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#1864ab';
    ctx.fillText(String(row.score ?? 0), layout.scoreX, rankCy);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#74c0fc';
    ctx.fillText('关卡', layout.scoreX, rankCy + 14);
  }

  private prefetchAvatar(url: string): void {
    if (!url || this.avatarCache.has(url) || typeof wx === 'undefined') {
      return;
    }
    try {
      const img = wx.createImage();
      this.avatarCache.set(url, img);
      img.onload = () => this.requestPaint();
      img.onerror = () => {
        // createImage 失败时改走 downloadFile（需后台配置 downloadFile 合法域名）
        this.avatarCache.delete(url);
        this.downloadAvatar(url);
      };
      img.src = url;
    } catch {
      this.downloadAvatar(url);
    }
  }

  private downloadAvatar(url: string): void {
    if (!url || this.avatarCache.has(url) || typeof wx === 'undefined') {
      return;
    }
    const download = (wx as typeof wx & {
      downloadFile?: (opts: {
        url: string;
        success?: (res: { tempFilePath?: string; statusCode?: number }) => void;
        fail?: () => void;
      }) => void;
    }).downloadFile;
    if (typeof download !== 'function') {
      return;
    }
    try {
      download({
        url,
        success: (res) => {
          const path = res.tempFilePath;
          if (!path || (res.statusCode != null && res.statusCode !== 200)) {
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
          } catch {
            // ignore
          }
        },
      });
    } catch {
      // ignore
    }
  }

  private drawNoticePanel(): void {
    const { ctx, width, height } = this;
    const panelW = Math.min(300, width - 48);
    ctx.font = 'bold 16px sans-serif';
    const bodyLines = this.wrapText(noticeJson.body, panelW - 48);
    const panelH = 120 + Math.max(0, bodyLines.length - 1) * 22;
    const x = (width - panelW) / 2;
    const y = Math.max(24, height * 0.28);

    this.drawCuteCard(x, y, panelW, panelH, {
      radius: 24,
      fillTop: 'rgba(255,255,255,0.98)',
      fillBottom: 'rgba(232, 248, 255, 0.97)',
      border: 'rgba(116, 192, 252, 0.95)',
      borderWidth: 3,
      shadow: true,
      sparkle: true,
      sparkleColor: '#a5d8ff',
      nowMs: this.nowMs || Date.now(),
    });

    this.paintPanelCornerChrome(
      this.overlayFromSettings
        ? panelBackButton({ x, y })
        : panelCloseButton({ x, y, w: panelW }),
      '#1c7ed6',
    );

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#1864ab';
    ctx.fillText(noticeJson.title, x + panelW / 2, y + 38);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#1c7ed6';
    let ty = y + 82;
    for (const line of bodyLines) {
      ctx.fillText(line, x + panelW / 2, ty);
      ty += 22;
    }
    ctx.restore();
  }

  private drawSettingsPanel(): void {
    const { ctx, width, height } = this;
    const inLobby = this.mode === 'lobby';
    const panelW = Math.min(280, width - 48);
    const padX = 16;
    const titleH = 44;
    // 音效已挪到左下角；设置页仅保留局内「返回首页」
    const footH = inLobby ? 72 : 100;
    const panelH = titleH + footH;
    const x = (width - panelW) / 2;
    const y = Math.max(12, Math.min(height * 0.28, height - panelH - 12));

    this.drawCuteCard(x, y, panelW, panelH, {
      radius: 24,
      fillTop: 'rgba(255,255,255,0.98)',
      fillBottom: 'rgba(232, 248, 255, 0.97)',
      border: 'rgba(116, 192, 252, 0.95)',
      borderWidth: 3,
      shadow: true,
      sparkle: true,
      sparkleColor: '#a5d8ff',
      nowMs: this.nowMs || Date.now(),
    });

    this.paintPanelCornerChrome(panelCloseButton({ x, y, w: panelW }), '#1c7ed6');

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#1864ab';
    ctx.fillText('设置', x + panelW / 2, y + 26);
    ctx.restore();

    if (inLobby) {
      ctx.save();
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#1c7ed6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('音效开关在左下角哦', x + panelW / 2, y + titleH + 28);
      ctx.restore();
      return;
    }

    const homeBtn: UiButton = {
      id: 'lobby',
      x: x + padX,
      y: y + titleH + 18,
      w: panelW - padX * 2,
      h: 44,
      label: '返回首页',
    };
    this.buttons.push(homeBtn);
    this.drawCuteButton(homeBtn, {
      top: '#a5d8ff',
      bottom: '#339af0',
      border: '#ffffff',
      gloss: true,
    });
  }

  /** 关卡同款音效钮：彩色 = 开，灰色 = 关（贴图自带立体壳）。 */
  private drawMuteToggleButton(btn: UiButton, muted: boolean): void {
    const { ctx } = this;
    const key = muted ? 'mute' : 'sound';
    const img = this.uiIcons.get(key);
    const cx = btn.x + btn.w / 2;
    const cy = btn.y + btn.h / 2;
    if (img && (img.width || 0) > 0) {
      ctx.save();
      ctx.drawImage(img, btn.x, btn.y, btn.w, btn.h);
      ctx.restore();
      return;
    }
    // 贴图未就绪时的兜底：有色 / 灰色圆钮
    ctx.save();
    const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
    if (muted) {
      grad.addColorStop(0, '#e9ecef');
      grad.addColorStop(1, '#adb5bd');
    } else {
      grad.addColorStop(0, '#ffa8a8');
      grad.addColorStop(1, '#f06595');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, btn.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(muted ? '静' : '音', cx, cy);
    ctx.restore();
  }

  /** 首页玩法：一屏速查，打开就能看完。 */
  private drawHowToPanel(): void {
    const { ctx, width, height } = this;
    const panelW = Math.min(340, width - 28);
    const padX = 16;
    const tagW = 44;
    const titleH = 46;
    const footH = 16;
    const gap = 8;
    ctx.font = '12px sans-serif';
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
      fillTop: 'rgba(255,255,255,0.98)',
      fillBottom: 'rgba(230, 246, 255, 0.97)',
      border: 'rgba(116, 192, 252, 0.95)',
      borderWidth: 3,
      shadow: true,
      sparkle: true,
      sparkleColor: '#a5d8ff',
      nowMs: this.nowMs || Date.now(),
    });

    this.paintPanelCornerChrome(
      this.overlayFromSettings
        ? panelBackButton({ x, y })
        : panelCloseButton({ x, y, w: panelW }),
      '#339af0',
    );

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#1c7ed6';
    ctx.fillText('怎么玩', x + panelW / 2, y + 26);
    ctx.restore();

    let ty = y + titleH;
    const maxY = y + panelH - footH;
    for (const row of HOWTO_LINES) {
      const lines = this.wrapText(row.text, textW);
      const rowH = Math.max(28, lines.length * 16 + 10);
      if (ty + rowH > maxY) {
        break;
      }
      ctx.fillStyle = '#4dabf7';
      this.roundRectPath(x + padX, ty, tagW, 24, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.tag, x + padX + tagW / 2, ty + 12);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#3b5166';
      let ly = ty + 2;
      for (const line of lines) {
        ctx.fillText(line, x + padX + tagW + 10, ly);
        ly += 16;
      }
      ty += rowH + gap;
    }
  }

  /** 按宽度逐字折行（中文规则说明用）。 */
  private wrapText(text: string, maxWidth: number): string[] {
    const { ctx } = this;
    const lines: string[] = [];
    let line = '';
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
  private paintPanelCornerChrome(
    spec: {
      id: UiButton['id'];
      x: number;
      y: number;
      w: number;
      h: number;
      label: string;
    },
    accent = '#1c7ed6',
  ): void {
    const btn: UiButton = {
      id: spec.id,
      x: spec.x,
      y: spec.y,
      w: spec.w,
      h: spec.h,
      label: spec.label,
      hitPad: 12,
    };
    this.buttons.push(btn);
    if (isPanelCloseLabel(spec.label)) {
      this.drawPanelCloseX(btn, accent);
    } else {
      this.drawPanelBackChevron(btn, accent);
    }
  }

  /** 弹窗返回：无圆底，大张角折线箭头。 */
  private drawPanelBackChevron(btn: UiButton, accent = '#1c7ed6'): void {
    const { ctx } = this;
    const cx = btn.x + btn.w * 0.52;
    const cy = btn.y + btn.h / 2;
    // 张角更大：横向跨度更大、竖向更扁
    const armX = Math.min(11, btn.w * 0.32);
    const armY = Math.min(9, btn.h * 0.28);
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + armX * 0.15, cy - armY);
    ctx.lineTo(cx - armX, cy);
    ctx.lineTo(cx + armX * 0.15, cy + armY);
    ctx.stroke();
    ctx.restore();
  }

  /** 弹窗关闭：无圆底，描线 ×。 */
  private drawPanelCloseX(btn: UiButton, accent = '#1c7ed6'): void {
    const { ctx } = this;
    const cx = btn.x + btn.w / 2;
    const cy = btn.y + btn.h / 2;
    const arm = Math.min(9, btn.w * 0.28);
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy - arm);
    ctx.lineTo(cx + arm, cy + arm);
    ctx.moveTo(cx + arm, cy - arm);
    ctx.lineTo(cx - arm, cy + arm);
    ctx.stroke();
    ctx.restore();
  }















  /** 启动或续上循环 BGM（静音时跳过；按钮音效后微信常把 BGM 掐掉） */
  private tryStartBgm(): void {
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

  private async onButton(id: UiButton['id'], levelId?: number): Promise<void> {
    const busyIds: Array<UiButton['id']> = [
      'revive',
      'crush_extend',
      'next',
      'lobby',
      'booster_extra',
      'booster_hammer',
      'booster_shuffle',
      'post',
    ];
    if (this.tapBusy && busyIds.includes(id)) {
      this.notifyUser('广告正在打开，稍等一下', '正在打开广告');
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

  private adWatchTip(result: ReviveAdResult): string {
    if (result === 'skipped') {
      return '看完才能领奖励，再点一次吧';
    }
    if (isWxDesktopIdeHost()) {
      return '模拟器播不了激励视频，请点预览用手机看';
    }
    if (result === 'error') {
      return '广告出了点问题，再试一次';
    }
    return '广告还在加载，过几秒再点';
  }

  private adWatchNativeTitle(result: ReviveAdResult): string {
    if (result === 'skipped') {
      return '看完才能领';
    }
    if (isWxDesktopIdeHost()) {
      return '请用真机预览';
    }
    if (result === 'error') {
      return '广告打开失败';
    }
    return '广告还在加载';
  }

  private boosterIdFromButton(
    id: 'booster_hammer' | 'booster_shuffle' | 'booster_extra',
  ): BoosterId {
    if (id === 'booster_hammer') {
      return 'hammer';
    }
    if (id === 'booster_shuffle') {
      return 'shuffle';
    }
    return 'extraMoves';
  }

  private async requestBoosterRefill(id: BoosterId): Promise<void> {
    const channel = this.session.getBoosterRefillChannel(id);
    if (channel === 'none') {
      this.notifyUser('现在不能领道具', '暂时不能领');
      return;
    }
    if (channel === 'ad') {
      this.notifyUser('正在打开广告…', '正在打开广告');
      const result = await this.runDuringAd(() => this.session.watchAdForBooster(id));
      this.clearAdPrompt();
      if (result === 'revived') {
        this.onBoosterRefillGranted(id, 'ad');
      } else {
        this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
      }
      return;
    }
    this.boosterShareScene = channel === 'friend' ? 'booster_friend' : 'booster_group';
    this.pendingBoosterShare = id;
    this.pendingBoosterShareAtMs = this.nowMs || Date.now();
    const opened = this.share.shareToFriend();
    this.boosterShareScene = null;
    if (!opened) {
      this.pendingBoosterShareAtMs = 0;
      this.settlePendingBoosterShare();
      return;
    }
    this.notifyUser(
      channel === 'friend' ? '转发给 1 个好友就能领' : '转发到群就能再领 1 个',
      channel === 'friend' ? '转发好友' : '转发到群',
    );
    setTimeout(() => {
      this.settlePendingBoosterShare();
    }, 700);
  }

  private settlePendingBoosterShare(): void {
    const id = this.pendingBoosterShare;
    if (!id) {
      return;
    }
    const elapsed = (this.nowMs || Date.now()) - this.pendingBoosterShareAtMs;
    if (elapsed < 280) {
      return;
    }
    this.pendingBoosterShare = null;
    const channel = this.session.getBoosterRefillChannel(id);
    if (channel !== 'friend' && channel !== 'group') {
      return;
    }
    if (!this.session.claimBoosterShare(id)) {
      return;
    }
    this.onBoosterRefillGranted(id, channel);
  }

  private onBoosterRefillGranted(id: BoosterId, channel: BoosterRefillChannel): void {
    if (id === 'hammer') {
      this.hammerTargeting = true;
      this.hammerCursor = { x: this.width / 2, y: this.height * 0.45 };
      this.notifyUser(
        channel === 'ad' ? '看广告获得锤子，点一格砸掉' : '已获得锤子，点一格砸掉',
        '已获得锤子',
      );
      return;
    }
    if (id === 'shuffle') {
      this.boardView.clearSelection();
      this.syncBoardView();
      this.notifyUser('小动物重新排列啦！', '已重排');
      return;
    }
    this.notifyUser(`步数 +${5} · 剩余 ${this.session.getMovesLeft()}`, '步数+5');
  }

  /** 画布提示 + 微信 Toast，点底部广告时一定看得到。 */
  private notifyUser(text: string, nativeTitle?: string): void {
    this.statusText = text;
    this.toastText = text;
    this.toastUntilMs = (this.nowMs || Date.now()) + 3200;
    this.requestPaint();
    if (isWxDesktopIdeHost()) {
      return;
    }
    if (typeof wx.showToast === 'function') {
      try {
        wx.showToast({
          title: nativeTitle ?? text.slice(0, 7),
          icon: 'none',
          duration: 2500,
        });
      } catch {
        // 部分基础库无 showToast
      }
    }
  }

  private async handleButton(id: UiButton['id'], levelId?: number): Promise<void> {
    if (
      id === 'booster_hammer' ||
      id === 'booster_shuffle' ||
      id === 'booster_extra' ||
      id === 'mute' ||
      id === 'level' ||
      id === 'lobby' ||
      id === 'settings' ||
      id === 'howto' ||
      id === 'notice' ||
      id === 'club' ||
      id === 'recommend' ||
      id === 'post' ||
      id === 'invite' ||
      id === 'claim_shuffle' ||
      id === 'resume'
    ) {
      this.session.playUiSfx();
    }

    if (id === 'level') {
      const target = levelId ?? this.resolveEntryLevelId();
      if (target < 1 || target > this.session.getLevelCount()) {
        this.statusText = '关卡不存在';
        return;
      }
      if (!this.session.isLevelUnlocked(target)) {
        const need = Math.max(1, target - 1);
        this.statusText = `第 ${target} 关未解锁，先通关第 ${need} 关`;
        return;
      }
      await this.enterLevel(target);
      return;
    }

    if (id === 'settings') {
      this.openOverlay('settings');
      return;
    }

    if (id === 'howto') {
      this.overlayFromSettings = this.overlay === 'settings';
      this.openOverlay('howto');
      return;
    }

    if (id === 'notice') {
      this.overlayFromSettings = this.overlay === 'settings';
      this.openOverlay('notice');
      return;
    }

    if (id === 'claim_shuffle') {
      if (this.session.claimDailyShuffle()) {
        this.notifyUser('重排 x1 已到账', '领取成功');
      }
      return;
    }

    if (id === 'club') {
      this.openGameClub();
      return;
    }

    if (id === 'recommend') {
      await this.openGameRecommend();
      return;
    }

    if (id === 'resume') {
      if (
        this.overlayFromSettings &&
        (this.overlay === 'howto' || this.overlay === 'notice')
      ) {
        if (this.overlay === 'notice') {
          void this.session.markNoticeSeen(noticeJson.id);
        }
        this.overlayFromSettings = false;
        this.openOverlay('settings');
        return;
      }
      this.closeOverlay();
      return;
    }

    if (id === 'post') {
      await this.publishOfficialAccountPost();
      return;
    }

    if (id === 'invite') {
      this.share.shareToFriend();
      return;
    }

    if (id === 'leaderboard') {
      void (async () => {
        await this.session.ensureWxUserProfile();
        await this.refreshLeaderboardView();
        this.openOverlay('leaderboard');
      })();
      return;
    }

    if (id === 'profile_skip') {
      markWxProfileAsked();
      this.destroyUserInfoAuthButton();
      this.closeOverlay();
      return;
    }

    if (id === 'lobby') {
      this.settleBurstModesForLeave();
      await this.maybeRunSettleInterstitial();
      if (!this.session.returnToLobby()) {
        this.session.quitToLobby();
      }
      this.showLobby();
      return;
    }

    if (id === 'mute') {
      this.session.setMuted(!this.session.isMuted());
      this.statusText = this.session.isMuted() ? '已静音' : '音效已开';
      if (!this.session.isMuted()) {
        this.bgmStarted = false;
        this.tryStartBgm();
      }
      return;
    }

    if (id === 'booster_hammer') {
      if (this.session.getBoosterCount('hammer') <= 0) {
        await this.requestBoosterRefill('hammer');
        return;
      }
      this.hammerTargeting = !this.hammerTargeting;
      if (this.hammerTargeting) {
        this.hammerCursor = { x: this.width / 2, y: this.height * 0.45 };
        this.statusText = '点一格使用锤子';
      } else {
        this.hammerCursor = null;
        this.statusText = '已取消锤子';
      }
      return;
    }

    if (id === 'booster_shuffle') {
      this.hammerTargeting = false;
      this.hammerCursor = null;
      if (this.animator.isPlaying()) {
        this.statusText = '请等消除播完再重排';
        return;
      }
      if (this.session.getBoosterCount('shuffle') <= 0) {
        await this.requestBoosterRefill('shuffle');
        return;
      }
      if (!this.session.useShuffle()) {
        this.statusText = '现在不能重排';
        return;
      }
      this.boardView.clearSelection();
      this.syncBoardView();
      this.statusText = '小动物重新排列啦！';
      return;
    }

    if (id === 'booster_extra') {
      this.hammerTargeting = false;
      this.hammerCursor = null;
      if (this.session.getBoosterCount('extraMoves') > 0) {
        if (!this.session.useExtraMoves()) {
          this.statusText = '现在不能加步';
        } else {
          this.statusText = `步数 +${5} · 剩余 ${this.session.getMovesLeft()}`;
        }
        return;
      }
      await this.requestBoosterRefill('extraMoves');
      return;
    }

    if (id === 'crush_skip') {
      if (this.session.fsm.getCurrent() === 'CrushReward') {
        this.session.finishCrushReward();
      }
      return;
    }

    if (id === 'clean_skip') {
      if (this.session.fsm.getCurrent() === 'Cleaning') {
        this.session.finishCleaningMode();
      }
      return;
    }

    if (id === 'clean_yes') {
      if (this.session.startCleaningMode()) {
        this.openClean();
      } else {
        this.offerCleanPrompt = false;
        this.statusText = '暂时无法进入清洁模式';
      }
      return;
    }

    if (id === 'clean_no') {
      this.session.declineCleaningOffer();
      this.offerCleanPrompt = false;
      // 露出结算按钮（含下一关），重新播入场
      this.resultFx.start(
        true,
        this.nowMs || Date.now(),
        this.width,
        this.height,
        this.session.getScore(),
      );
      this.statusText = this.session.hasNextLevel()
        ? '可进入下一关'
        : '本关结算完成';
      return;
    }

    if (id === 'crush_extend') {
      this.notifyUser('正在打开广告…', '正在打开广告');
      const result = await this.runDuringAd(() =>
        this.session.watchAdToExtendCrush(),
      );
      this.clearAdPrompt();
      if (result === 'revived') {
        this.notifyUser('粉碎时间延长！', '时间+5秒');
      } else {
        this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
      }
      return;
    }

    if (id === 'revive') {
      this.notifyUser('正在打开广告…', '正在打开广告');
      const result = await this.runDuringAd(() => this.session.watchAdToRevive());
      this.clearAdPrompt();
      if (result === 'revived') {
        this.notifyUser('复活成功，继续闯关！', '复活成功');
      } else {
        this.notifyUser(this.adWatchTip(result), this.adWatchNativeTitle(result));
      }
      if (result === 'revived') {
        this.closeOverlay();
        this.mode = 'playing';
        this.pendingResult = null;
        this.resultFx.stop();
        this.boardView.bindInput((a, b, c, d) => {
          this.session.trySwap(a, b, c, d);
        });
        this.syncBoardView();
      }
      return;
    }

    if (id === 'retry') {
      this.settleBurstModesForLeave();
      await this.session.retryLevel();
      this.mode = 'playing';
      this.buriedFx.clear();
      this.applyLevelEntryTip(this.session.getLevelConfig()?.id ?? 0);
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

    if (id === 'next') {
      this.settleBurstModesForLeave();
      await this.maybeRunSettleInterstitial();
      const ok = await this.session.continueToNextLevel();
      if (!ok) {
        this.statusText = noticeJson.body;
        this.notifyUser(noticeJson.body);
        if (!this.session.returnToLobby()) {
          this.session.quitToLobby();
        }
        this.showLobby();
        return;
      }
      this.mode = 'playing';
      this.applyLevelEntryTip(this.session.getLevelConfig()?.id ?? 0);
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

  private async refreshLeaderboardView(): Promise<void> {
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
  private maybeOfferLaunchProfileAuth(): void {
    if (this.mode !== 'lobby') {
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
    // 延后一帧，等大厅画完再挂原生按钮
    setTimeout(() => {
      if (this.mode !== 'lobby' || this.overlay !== 'none') {
        return;
      }
      if (hasAskedWxProfile() || hasRealWxProfile(readCachedWxProfile(this.session.getInviteCode()))) {
        return;
      }
      this.openOverlay('profile_welcome');
      this.mountLaunchProfileAuthButton();
    }, 400);
  }

  private mountLaunchProfileAuthButton(): void {
    this.destroyUserInfoAuthButton();
    if (this.overlay !== 'profile_welcome') {
      return;
    }
    const panelW = Math.min(320, this.width - 40);
    const body = ((noticeJson as { profileWelcome?: { body?: string } }).profileWelcome)?.body
      ?? '授权后，好友排行会显示你的头像和昵称。也可跳过，不影响游玩。';
    this.ctx.font = '13px sans-serif';
    const lines = this.wrapText(body, panelW - 40);
    const panelH = 168 + lines.length * 18;
    const panelY = Math.max(80, this.height * 0.28);
    const btnW = Math.min(220, panelW - 48);
    const btnH = 40;
    // 原生按钮叠在「暂不授权」上方，与 drawProfileWelcomePanel 对齐
    const left = (this.width - btnW) / 2;
    const top = panelY + panelH - 36 - 12 - btnH;
    const welcome = (noticeJson as { profileWelcome?: { btn?: string; ok?: string; fail?: string } }).profileWelcome;
    this.userInfoAuthButton = mountWxUserInfoAuthButton({
      left,
      top,
      width: btnW,
      height: btnH,
      text: welcome?.btn ?? '授权头像昵称',
      onProfile: () => {
        markWxProfileAsked();
        this.destroyUserInfoAuthButton();
        this.closeOverlay();
        this.notifyUser(welcome?.ok ?? '头像昵称已保存', '授权成功');
      },
      onFail: (message) => {
        // 失败不阻断；记为已问过，避免每次进大厅都弹
        markWxProfileAsked();
        this.destroyUserInfoAuthButton();
        this.closeOverlay();
        showAuthFailModal(welcome?.fail ?? message);
      },
    });
  }

  private destroyUserInfoAuthButton(): void {
    if (!this.userInfoAuthButton) {
      return;
    }
    try {
      this.userInfoAuthButton.destroy();
    } catch {
      // ignore
    }
    this.userInfoAuthButton = null;
  }

  private openOverlay(kind: Exclude<PageOverlay, 'none'>): void {
    if (kind !== 'profile_welcome') {
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
  private maybeOpenLobbyNotice(): void {
    return;
  }

  private closeOverlay(): void {
    if (this.overlay === 'notice') {
      void this.session.markNoticeSeen(noticeJson.id);
    }
    this.destroyUserInfoAuthButton();
    this.overlayFromSettings = false;
    this.leaderboardScrollY = 0;
    this.leaderboardDrag = null;
    this.overlay = 'none';
    this.syncLobbyBanner();
    this.requestPaint();
  }

  /** 分享图菜单关掉（含取消）后把循环拉回来，否则设置页再也画不出来。 */
  private restoreAfterShareSheet(): void {
    this.foreground.onShow();
    this.kickRenderLoop();
  }

  /** 首页「发表贴图」：合成带小游戏码的海报。 */
  private async publishOfficialAccountPost(): Promise<void> {
    const post = this.buildOfficialAccountPost();
    this.closeOverlay();
    try {
      this.draw();
    } catch (err) {
      console.error('[crush-crush] share capture draw failed', err);
    }
    const shot = await this.captureSharePoster();
    try {
      this.draw();
    } catch (err) {
      console.error('[crush-crush] share restore draw failed', err);
    }

    const images = shot ? [shot] : undefined;
    let opened = await this.share.shareToOfficialAccount({ ...post, images });
    if (!opened && shot) {
      opened = await this.share.sharePoster(shot);
    }
    this.restoreAfterShareSheet();
    this.statusText = opened
      ? '可把海报发到公众号 / 朋友圈'
      : '请用右上角 ··· 转发，或到公众号发贴图';
  }

  private captureSharePoster(): Promise<string | null> {
    const poster = this.createPosterCanvas();
    if (poster) {
      const ctx = poster.getContext('2d');
      paintSharePoster(ctx, SHARE_POSTER_WIDTH, SHARE_POSTER_HEIGHT, {
        cover: this.bgLobby,
        qr: this.uiIcons.get('qr') ?? null,
      });
      return this.canvasToTempPath(poster);
    }
    paintSharePoster(this.ctx, this.width, this.height, {
      cover: this.bgLobby,
      qr: this.uiIcons.get('qr') ?? null,
    });
    return this.canvasToTempPath(this.canvas);
  }

  private createPosterCanvas(): WxCanvas | null {
    if (typeof wx.createCanvas !== 'function') {
      return null;
    }
    const poster = wx.createCanvas();
    poster.width = SHARE_POSTER_WIDTH;
    poster.height = SHARE_POSTER_HEIGHT;
    return poster;
  }

  private canvasToTempPath(canvas: WxCanvas): Promise<string | null> {
    return new Promise((resolve) => {
      if (typeof canvas.toTempFilePath !== 'function') {
        resolve(null);
        return;
      }
      canvas.toTempFilePath({
        fileType: 'jpg',
        quality: 0.9,
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve(null),
      });
    });
  }

  private buildOfficialAccountPost(): {
    title: string;
    content: string;
    tags: string[];
    recommendTitle: string;
  } {
    const levelId = this.session.getLevelConfig()?.id ?? 1;
    const score = this.session.getScore();
    const tags = ['来微信做个小程序', '消消乐', '解压小游戏'];
    const recommendTitle = '萌宠粉碎消';
    if (this.mode === 'playing' || this.mode === 'result') {
      return {
        title: `我在《萌宠粉碎消》第 ${levelId} 关拿到 ${score} 分`,
        content:
          `刚在糖果乐园消完萌宠：第 ${levelId} 关 ${score} 分。三连消除，四连出闪光，五连出超级猫头鹰；过关还能限时粉碎，总分满 1500 可去清洁清扫。#来微信做个小程序`,
        tags,
        recommendTitle,
      };
    }
    if (this.mode === 'crush' || this.mode === 'clean') {
      return {
        title: '过关后还能点着清扫，这款萌宠三消太解压了',
        content:
          '《萌宠粉碎消》通关不只结算：限时点击爆炸加分，总分达到 1500 还能进清洁模式接着扫。滑动消除 + 点击清扫，碎片时间刚刚好。#来微信做个小程序',
        tags,
        recommendTitle,
      };
    }
    return {
      title: '从想法到上线：我们为什么用微信做一款没有内购的萌宠三消',
      content:
        '《萌宠粉碎消》是一款微信小游戏：7×7 棋盘滑动红狐、蓝兔、绿蛙、黄鸡、紫猫，三连消除；四连/L/T 出闪光，五连出超级猫头鹰。过关自动进限时粉碎加分，总分满 1500 可选清洁模式（清洁不加主线分）。全程无内购，沿糖果梯子闯关、冲进糖果屋就能开玩。#来微信做个小程序',
      tags,
      recommendTitle,
    };
  }

  /** 6–20 进关/重试/下一关：艺术字「难度提升」。 */
  private applyLevelEntryTip(levelId: number): void {
    const art = levelDifficultyArt(levelId);
    if (art) {
      this.statusText = '';
      this.difficultyArt = {
        title: art.title,
        subtitle: art.subtitle,
        startMs: this.nowMs || Date.now(),
        durationMs: 2800,
      };
      this.requestPaint();
      return;
    }
    this.statusText = '';
    this.difficultyArt = null;
  }

  /** 进关艺术字：描边糖果色主标题 + 章节副标，弹入后淡出。 */
  private drawDifficultyArtTip(): void {
    const tip = this.difficultyArt;
    if (!tip || this.mode !== 'playing') {
      return;
    }
    const now = this.nowMs || Date.now();
    const elapsed = now - tip.startMs;
    if (elapsed >= tip.durationMs) {
      this.difficultyArt = null;
      return;
    }
    const t = elapsed / tip.durationMs;
    // 0–18% 弹入，中间轻晃，末 28% 上飘淡出
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
      scale = 1 + 0.03 * Math.sin((now - tip.startMs) * 0.008);
    }

    const { ctx, width } = this;
    const cx = width / 2;
    const cy = this.getHudBottom() + 52 + lift;
    const titleSize = Math.max(34, Math.min(44, Math.round(width * 0.11)));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 柔光底晕
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, titleSize * 2.2);
    glow.addColorStop(0, 'rgba(255, 200, 120, 0.45)');
    glow.addColorStop(0.55, 'rgba(255, 140, 160, 0.18)');
    glow.addColorStop(1, 'rgba(255, 140, 160, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, tip.subtitle ? -6 : 0, titleSize * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `bold ${titleSize}px sans-serif`;
    ctx.shadowColor = 'rgba(180, 60, 40, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    // 外圈深描边
    ctx.strokeStyle = 'rgba(120, 40, 30, 0.88)';
    ctx.lineWidth = Math.max(8, Math.round(titleSize * 0.22));
    ctx.strokeText(tip.title, 0, tip.subtitle ? -10 : 0);
    // 白描边
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255, 252, 245, 0.98)';
    ctx.lineWidth = Math.max(5, Math.round(titleSize * 0.12));
    ctx.strokeText(tip.title, 0, tip.subtitle ? -10 : 0);
    // 糖果渐变填充
    const grad = ctx.createLinearGradient(0, -titleSize * 0.55, 0, titleSize * 0.55);
    grad.addColorStop(0, '#ffe066');
    grad.addColorStop(0.45, '#ff922b');
    grad.addColorStop(1, '#ff6b6b');
    ctx.fillStyle = grad;
    ctx.fillText(tip.title, 0, tip.subtitle ? -10 : 0);

    if (tip.subtitle) {
      const subSize = Math.max(13, Math.min(16, Math.round(titleSize * 0.38)));
      ctx.font = `bold ${subSize}px sans-serif`;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(tip.subtitle, 0, titleSize * 0.42);
      ctx.fillStyle = '#c2255c';
      ctx.fillText(tip.subtitle, 0, titleSize * 0.42);
    }

    // 两侧小星点
    const sparkleT = (now - tip.startMs) * 0.01;
    for (const side of [-1, 1]) {
      const sx = side * (titleSize * 1.55 + Math.sin(sparkleT + side) * 3);
      const sy = -8 + Math.cos(sparkleT * 1.3 + side) * 4;
      const sr = 3.2 + Math.sin(sparkleT * 2 + side) * 0.8;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
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

  private async enterLevel(levelId: number): Promise<void> {
    this.leavingLobby = true;
    this.clearLaunchInterstitialTimer();
    this.interceptLobbyBanner();
    try {
      await this.session.startLevel(levelId);
    } catch (err) {
      this.leavingLobby = false;
      this.mode = 'lobby';
      this.syncLobbyBanner();
      throw err;
    }
    this.mode = 'playing';
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

  private hitButton(x: number, y: number): UiButton | null {
    if (this.mode === 'lobby' && this.overlay === 'none') {
      const side = this.hitLobbySideAction(x, y);
      if (side) {
        return side;
      }
    }
    // 大厅关卡：整条矩形热区（含数字圆与云朵），重叠时取中心更近的
    if (this.mode === 'lobby' && this.overlay === 'none') {
      let best: UiButton | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const btn of this.buttons) {
        if (btn.id !== 'level') {
          continue;
        }
        if (
          x < btn.x ||
          x > btn.x + btn.w ||
          y < btn.y ||
          y > btn.y + btn.h
        ) {
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
      const btn = this.buttons[i]!;
      if (btn.id === 'level') {
        continue;
      }
      const pad = btn.hitPad ?? 0;
      if (
        x >= btn.x - pad &&
        x <= btn.x + btn.w + pad &&
        y >= btn.y - pad &&
        y <= btn.y + btn.h + pad
      ) {
        return btn;
      }
    }
    return null;
  }

  private hitLobbySideAction(x: number, y: number): UiButton | null {
    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const btn = this.buttons[i]!;
      if (
        btn.id !== 'invite' &&
        btn.id !== 'howto' &&
        btn.id !== 'settings' &&
        btn.id !== 'claim_shuffle' &&
        btn.id !== 'recommend' &&
        btn.id !== 'club'
      ) {
        continue;
      }
      const pad = btn.hitPad ?? 0;
      if (
        x >= btn.x - pad &&
        x <= btn.x + btn.w + pad &&
        y >= btn.y - pad &&
        y <= btn.y + btn.h + pad
      ) {
        return btn;
      }
    }
    return null;
  }

  private draw(): void {
    const { ctx } = this;
    this.buttons.length = 0;

    // iOS 刷新 / 切回前台后缓冲常是透明黑；先铺底再画，避免整页黑屏
    try {
      ctx.fillStyle = this.mode === 'lobby' ? '#a7f0d4' : '#b6e8fc';
      ctx.fillRect(0, 0, this.width, this.height);
    } catch {
      // ignore
    }

    try {
      const bgMode = this.mode === 'lobby' ? 'lobby' : 'level';
      this.sceneBg.draw(
        ctx,
        {
          lobby: this.bgLobby,
          level: this.bgLevel,
          lobbyCloudPages: this.lobbyCloudPages,
        },
        bgMode,
        this.nowMs || Date.now(),
        bgMode === 'lobby' ? this.lobbyCamY : 0,
      );

      if (this.mode === 'lobby') {
        this.drawLobby();
        this.drawNavChips();
        this.drawLobbySideActions();
        this.drawPageOverlay();
        return;
      }

      this.drawHud();
      if (
        this.mode === 'playing' ||
        this.mode === 'result' ||
        this.mode === 'crush' ||
        this.mode === 'clean'
      ) {
        ctx.save();
        if (
          this.shakeMs > 0 &&
          (this.mode === 'playing' ||
            this.mode === 'crush' ||
            this.mode === 'clean' ||
            this.mode === 'result')
        ) {
          const mag =
            this.mode === 'result'
              ? Math.min(10, this.shakeMs / 16)
              : Math.min(7, this.shakeMs / 18);
          ctx.translate(
            Math.sin(this.nowMs * 0.08) * mag,
            Math.cos(this.nowMs * 0.11) * mag,
          );
        }
        this.drawBoard();
        if (this.mode === 'crush' || this.mode === 'clean') {
          this.drawCrushOverlays();
          this.drawCrushGuide();
        } else if (this.mode === 'playing') {
          this.drawMatchJuiceOverlays();
        }
        ctx.restore();
      }
      if (this.mode === 'crush') {
        this.drawCrushChrome();
      }
      if (this.mode === 'clean') {
        this.drawCleanChrome();
      }
      if (this.mode === 'playing') {
        this.drawBoosterBar();
      }
      this.drawActionToast();
      this.drawDifficultyArtTip();
      if (this.hammerTargeting) {
        this.drawHammerCursor();
      }
      if (this.mode === 'result') {
        this.drawResultOverlay();
      }
      this.drawNavChips();
      this.drawPageOverlay();
    } catch (err) {
      console.error('[crush-crush] draw failed', err);
      try {
        ctx.fillStyle = this.mode === 'lobby' ? '#a7f0d4' : '#b6e8fc';
        ctx.fillRect(0, 0, this.width, this.height);
      } catch {
        // ignore
      }
    }
  }

  /** 锤子瞄准时绘制跟随指针的锤子光标 */
  private drawHammerCursor(): void {
    const { ctx } = this;
    const pos = this.hammerCursor ?? { x: this.width / 2, y: this.height * 0.45 };
    const img = this.uiIcons.get('hammer');
    const size = 56;
    const x = pos.x - size * 0.25;
    const y = pos.y - size * 0.75;

    ctx.save();
    ctx.globalAlpha = 0.95;
    if (img) {
      ctx.drawImage(img, x, y, size, size);
    } else {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('锤', pos.x, pos.y);
    }
    // 准星小圆，提示落点
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(250, 82, 82, 0.85)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 首页大厅：关卡列表夹在标题与底栏提示之间；云朵盖在糖果条之上。
   */
  private drawLobby(): void {
    const { height } = this;
    const now = this.nowMs || Date.now();
    const nodes = this.getLobbyLevelNodes();
    const currentId = this.resolveEntryLevelId();
    const page = lobbyPageIndex(this.lobbyCamY, height);
    const maxPage = lobbyMaxPageIndex(this.session.getLevelCount());
    const hideBelowY = this.lobbyContentTop();
    const { bandTop: hideAboveY } = this.getLobbyLadderLayout();

    const drawNodes = nodes
      .filter(
        (node) =>
          isLobbyNodeOnScreen(node, height) &&
          isLobbyNodeExposed(node, this.lobbyCamY, height, hideBelowY, hideAboveY),
      )
      .sort((a, b) => a.levelId - b.levelId);

    this.drawLobbyLadderTrail(drawNodes, height);

    for (const node of drawNodes) {
      const unlocked = this.session.isLevelUnlocked(node.levelId);
      const cleared = this.session.isLevelCleared(node.levelId);
      const isCurrent = unlocked && node.levelId === currentId && !cleared;

      const hit = lobbyLevelHitRect(node);
      this.buttons.push({
        id: 'level',
        levelId: node.levelId,
        x: hit.x,
        y: hit.y,
        w: hit.w,
        h: hit.h,
        label: String(node.levelId),
      });

      this.drawLobbyLevelBar(node, unlocked, cleared, isCurrent, now);
    }

    // 云朵在糖果条上层
    this.drawLobbyCloudDecors(drawNodes, height);

    // 标题区固定：上滑后仍用左侧品牌样式，不再切到粉字顶栏
    this.drawLobbyBrandCopy();

    this.drawLobbySwipeHint(page, maxPage, now);
    this.drawLobbyPageDots(page, maxPage);
    this.drawLobbyStatusCaption();
    this.drawLobbyNoticeBubble(now);
  }

  /** 首页公告冷色泡泡：左下↔右上乒乓循环，文案轮播，点一下打开公告。 */
  private drawLobbyNoticeBubble(nowMs: number): void {
    if (this.overlay !== 'none' || this.lobbyCamY > this.height * 0.18) {
      return;
    }
    const lines = lobbyNoticeBubbleLines({
      body: noticeJson.body,
      bubbles: (noticeJson as { bubbles?: string[] }).bubbles,
    });
    if (lines.length === 0) {
      return;
    }
    const cycle = lobbyNoticeBubbleCycle(nowMs, lines.length);
    const drift = lobbyNoticeBubbleDrift(nowMs);
    const primary = lines[cycle.index] ?? lines[0]!;
    const secondary =
      cycle.nextOpacity > 0.02 ? lines[cycle.nextIndex] ?? '' : '';

    const { ctx } = this;
    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    const frame = layoutLobbyNoticeBubble({
      width: this.width,
      height: this.height,
      statusBarHeight: this.statusBarHeight,
      contentTop: this.lobbyContentTop(),
      progress: drift.progress,
      text: primary.length >= secondary.length ? primary : secondary,
      measureWidth: (text) => ctx.measureText(text).width,
    });

    const bob = Math.sin(nowMs / 680) * this.fxAmt(2.2, 1);
    const x = frame.x;
    const y = frame.y + bob;
    const { w, h } = frame;
    const alpha = drift.opacity;

    // 阴影：与 HUD 糖果枝同系深蓝
    ctx.globalAlpha = 0.18 * alpha;
    ctx.fillStyle = '#1c4b7a';
    this.roundRectPath(x + 1, y + 3, w, h, h / 2);
    ctx.fill();

    // 填充：对齐对局步数条冷色（lite → mid），白边
    ctx.globalAlpha = alpha;
    const fill = ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    fill.addColorStop(0.4, 'rgba(232, 248, 255, 0.97)');
    fill.addColorStop(1, 'rgba(208, 235, 255, 0.96)');
    ctx.fillStyle = fill;
    this.roundRectPath(x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    this.roundRectPath(x + 0.5, y + 0.5, w - 1, h - 1, h / 2 - 0.5);
    ctx.stroke();
    // 外圈淡天蓝，贴合棋盘槽描边
    ctx.strokeStyle = 'rgba(116, 192, 252, 0.55)';
    ctx.lineWidth = 1;
    this.roundRectPath(x - 0.5, y - 0.5, w + 1, h + 1, h / 2 + 0.5);
    ctx.stroke();

    // 顶部高光
    ctx.globalAlpha = 0.5 * alpha;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.roundRectPath(x + 8, y + 3, w - 16, h * 0.34, h * 0.2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px sans-serif';
    // 字色对齐 HUD ink
    const ink = '#1864ab';
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
      id: 'notice',
      x,
      y,
      w,
      h,
      label: '',
      hitPad: 4,
    });
  }

  /** 关卡列表左右两侧糖点轨，连接编号糖果（对齐设计稿）。 */
  private drawLobbyLadderTrail(
    nodes: ReadonlyArray<LobbyLevelNode>,
    height: number,
  ): void {
    const pts = lobbyLadderSideTrailPoints(nodes, height);
    if (pts.length === 0) {
      return;
    }
    const { ctx } = this;
    ctx.save();
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle =
        p.tone === 'cream' ? 'rgba(255,236,153,0.86)' : 'rgba(255,255,255,0.92)';
      ctx.fill();
      if (p.r >= 3.6) {
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.22, p.y - p.r * 0.28, p.r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawLobbyCloudDecors(
    nodes: ReadonlyArray<LobbyLevelNode>,
    height: number,
  ): void {
    const pts = lobbyCloudDecorPoints(nodes, height);
    const cloudBig = this.uiIcons.get('ladder-cloud');
    const cloudSm = this.uiIcons.get('ladder-cloudSm');
    const { ctx } = this;
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i]!;
      const cloud = i % 2 === 0 ? cloudBig ?? cloudSm : cloudSm ?? cloudBig;
      // 贴在数字对侧条尾，尺寸跟圆走（略放大，更像设计稿蓬松云）
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
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
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
  private drawLobbyLevelBar(
    node: LobbyLevelNode,
    unlocked: boolean,
    cleared: boolean,
    isCurrent: boolean,
    nowMs: number,
  ): void {
    const state = !unlocked ? 'locked' : isCurrent ? 'current' : cleared ? 'cleared' : 'locked';
    const theme = ladderThemeForLevel(node.levelId, state);
    const { ctx } = this;
    const { barX, barY, barW, barH, circleR, x: cx, y: cy } = node;
    const r = barH / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(80, 120, 130, 0.22)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    this.roundRectPath(barX, barY, barW, barH, r);
    const barGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    barGrad.addColorStop(0, theme.barTop);
    barGrad.addColorStop(1, theme.barBottom);
    ctx.fillStyle = barGrad;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();

    if (theme.pattern === 'stripe') {
      this.drawLobbyBarStripes(barX, barY, barW, barH, r, theme.stripe);
    } else if (theme.pattern === 'sprinkle') {
      this.drawLobbyBarSprinkles(barX, barY, barW, barH, node.levelId);
    }

    ctx.shadowColor = 'rgba(60, 90, 110, 0.28)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
    const cg = ctx.createLinearGradient(cx, cy - circleR, cx, cy + circleR);
    cg.addColorStop(0, theme.circleTop);
    cg.addColorStop(1, theme.circleBottom);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(3, circleR * 0.12);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    if (state === 'locked') {
      const lock = this.uiIcons.get('ladder-lock');
      const s = circleR * 1.1;
      if (lock && (lock.width || 0) > 0) {
        ctx.drawImage(lock, cx - s / 2, cy - s / 2, s, s);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(circleR * 0.9)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('锁', cx, cy + 1);
      }
    } else {
      ctx.font = `bold ${Math.round(circleR * 1.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, Math.round(circleR * 0.14));
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.fillStyle = '#ffffff';
      const label = String(node.levelId);
      ctx.strokeText(label, cx, cy + 1);
      ctx.fillText(label, cx, cy + 1);
    }

    if (cleared && unlocked) {
      const check = this.uiIcons.get('ladder-check');
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
      const star = this.uiIcons.get('ladder-star');
      const badge = circleR * 0.7;
      const bx = cx + circleR * 0.55;
      const by = cy - circleR * 0.78;
      if (star && (star.width || 0) > 0) {
        const bob = Math.sin(nowMs * 0.006) * 2;
        ctx.drawImage(star, bx - badge / 2, by - badge / 2 + bob, badge, badge);
      }
      if ('startTop' in theme) {
        this.drawLobbyStartChip(node, theme.startTop, theme.startBottom);
      }
    } else if (cleared && unlocked) {
      const score = this.session.getBestScore(node.levelId);
      if (score > 0) {
        this.drawLobbyScoreChip(node, score);
      }
    }

    ctx.restore();
  }

  private drawLobbyBarStripes(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string,
  ): void {
    const { ctx } = this;
    ctx.save();
    this.roundRectPath(x, y, w, h, r);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(6, h * 0.14);
    ctx.lineCap = 'butt';
    for (let i = -2; i < 14; i += 1) {
      const sx = x + i * h * 0.55;
      ctx.beginPath();
      ctx.moveTo(sx, y + h + 4);
      ctx.lineTo(sx + h * 1.15, y - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLobbyBarSprinkles(
    x: number,
    y: number,
    w: number,
    h: number,
    seed: number,
  ): void {
    const { ctx } = this;
    ctx.save();
    this.roundRectPath(x, y, w, h, h / 2);
    ctx.clip();
    const colors = ['#ff8fab', '#ffe066', '#ffffff', '#74c0fc'];
    for (let i = 0; i < 14; i += 1) {
      const px = x + (((seed * 37 + i * 53) % 97) / 97) * w;
      const py = y + (((seed * 19 + i * 29) % 71) / 71) * h;
      ctx.fillStyle = colors[i % colors.length]!;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLobbyStartChip(
    node: LobbyLevelNode,
    top: string,
    bottom: string,
  ): void {
    const { ctx } = this;
    const chipW = Math.min(92, node.barW * 0.28);
    const chipH = Math.min(34, node.barH * 0.55);
    const chipX =
      node.circleSide === 'left'
        ? node.barX + node.barW - chipW - 16
        : node.barX + 16;
    const chipY = node.y - chipH / 2;
    const g = ctx.createLinearGradient(chipX, chipY, chipX, chipY + chipH);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.save();
    ctx.shadowColor = 'rgba(180, 60, 40, 0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    this.roundRectPath(chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    ctx.font = `bold ${Math.round(chipH * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('开始', chipX + chipW / 2, chipY + chipH / 2 + 1);
    ctx.restore();
  }

  private drawLobbyScoreChip(node: LobbyLevelNode, score: number): void {
    const { ctx } = this;
    const label = String(Math.max(0, Math.floor(score)));
    ctx.save();
    ctx.font = `bold ${Math.max(11, Math.round(node.barH * 0.28))}px sans-serif`;
    const tw = ctx.measureText(label).width;
    const chipW = tw + 18;
    const chipH = Math.min(26, node.barH * 0.42);
    const chipX =
      node.circleSide === 'left'
        ? node.barX + node.barW * 0.42
        : node.barX + node.barW * 0.22;
    const chipY = node.y - chipH / 2;
    this.roundRectPath(chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.98)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#6b5b6e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, chipX + chipW / 2, chipY + chipH / 2 + 0.5);
    ctx.restore();
  }


  private lobbyContentTop(): number {
    const daily = this.session.getDailyLoop();
    return layoutLobbyBottom({
      width: this.width,
      height: this.height,
      bannerReserve: this.mode === 'lobby' ? this.session.getLobbyBannerReservePx() : 0,
      safeBottom: this.safeAreaBottom,
      clearsToday: daily.clearsToday,
      shuffleGranted: daily.playShuffleGranted,
    }).contentTop;
  }

  /** 未解锁等提示画在树干标语处。树屏的文案由 drawLobbyTreePrompt 盖住底图。 */
  private drawLobbyStatusCaption(): void {
    if (!this.statusText || lobbyPageIndex(this.lobbyCamY, this.height) === 0) {
      return;
    }
    const { ctx, width } = this;
    const y = lobbyCaptionY(
      this.getLobbyCoverRect(),
      this.lobbyCamY,
      this.height,
      lobbyPageIndex(this.lobbyCamY, this.height),
    );
    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.lineWidth = 8;
    ctx.strokeText(this.statusText, width / 2, y);
    ctx.fillStyle = '#c2255c';
    ctx.fillText(this.statusText, width / 2, y);
    ctx.restore();
  }

  /** 与树上底图马卡龙同一视觉半径。 */
  private lobbyMacaronVisualR(node: LobbyLevelNode): number {
    return node.hitR;
  }

  /** 未解锁：霜住内馅，锁放到下方。 */
  private drawLobbyMacaronLocked(x: number, y: number, r: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);

    const innerR = r * 0.72;
    ctx.beginPath();
    ctx.arc(0, r * 0.02, innerR, 0, Math.PI * 2);
    ctx.clip();
    const frost = ctx.createLinearGradient(0, -innerR, 0, innerR);
    frost.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    frost.addColorStop(0.45, 'rgba(236, 228, 255, 0.34)');
    frost.addColorStop(1, 'rgba(255, 255, 255, 0.5)');
    ctx.fillStyle = frost;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    const plateW = r * 0.92;
    const plateH = r * 0.36;
    const plateY = r * 0.28;
    ctx.fillStyle = 'rgba(255, 252, 248, 0.92)';
    this.roundRectPath(-plateW / 2, plateY, plateW, plateH, plateH / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.2;
    this.roundRectPath(-plateW / 2, plateY, plateW, plateH, plateH / 2);
    ctx.stroke();

    const cx = 0;
    const cy = plateY + plateH / 2 + r * 0.02;
    const bodyW = r * 0.22;
    const bodyH = r * 0.16;
    const shackleR = r * 0.09;
    ctx.strokeStyle = '#7b6aa6';
    ctx.lineWidth = Math.max(1.8, r * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy - bodyH * 0.42, shackleR, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#8f7bb8';
    this.roundRectPath(cx - bodyW / 2, cy - bodyH * 0.18, bodyW, bodyH, r * 0.045);
    ctx.fill();
    ctx.fillStyle = '#fff8ff';
    ctx.beginPath();
    ctx.arc(cx, cy + bodyH * 0.02, r * 0.028, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 已通关勾：贴在右上角壳边。 */
  private drawLobbyMacaronCheck(x: number, y: number, r: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    const badge = Math.max(6.5, Math.min(9, r * 0.17));
    const bx = r * 0.62;
    const by = -r * 0.58;
    ctx.fillStyle = '#51cf66';
    ctx.beginPath();
    ctx.arc(bx, by, badge, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.4, badge * 0.16);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.8, badge * 0.26);
    ctx.beginPath();
    ctx.moveTo(bx - badge * 0.4, by + badge * 0.02);
    ctx.lineTo(bx - badge * 0.06, by + badge * 0.36);
    ctx.lineTo(bx + badge * 0.44, by - badge * 0.34);
    ctx.stroke();
    ctx.restore();
  }

  /** 该关最高分：单独一层画在马卡龙内馅上，分数变化后下一帧重绘。 */
  private drawLobbyMacaronScore(
    x: number,
    y: number,
    r: number,
    bestScore: number,
    slotIndex: number,
  ): void {
    const { ctx } = this;
    const text = String(Math.max(0, Math.floor(bestScore)));
    const stroke = MACARON_NUM_STROKE[slotIndex % MACARON_NUM_STROKE.length]!;
    ctx.save();
    ctx.translate(x, y);
    const fontSize = Math.round(Math.max(10, r * (text.length >= 4 ? 0.16 : 0.18)));
    ctx.font = `800 ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const sy = r * 0.38;
    ctx.strokeStyle = this.shadeHex(stroke, -18);
    ctx.lineWidth = Math.max(2.6, r * 0.06);
    ctx.strokeText(text, 0, sy);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, sy);
    ctx.restore();
  }

  /** 当前可挑战关：贴外壳一圈细光，不再铺径向光斑。 */
  private drawLobbyMacaronActiveGlow(
    x: number,
    y: number,
    r: number,
    nowMs: number,
  ): void {
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
  private getLobbyCoverRect(): { dx: number; dy: number; dw: number; dh: number } {
    const lobbyImg = this.bgLobby;
    if (lobbyImg && (lobbyImg.width || 0) > 0 && (lobbyImg.height || 0) > 0) {
      return this.sceneBg.getCoverLayout(lobbyImg, 0.5);
    }
    return { dx: 0, dy: 0, dw: this.width, dh: this.height };
  }

  private getCloudCoverRect(): { dx: number; dy: number; dw: number; dh: number } {
    const img = this.lobbyCloudPages.find(
      (page) => !!page && (page.width || 0) > 0,
    );
    if (img) {
      return this.sceneBg.getCoverLayout(img, 0.48);
    }
    return { dx: 0, dy: 0, dw: this.width, dh: this.height };
  }

  private getLobbyLevelNodes(): LobbyLevelNode[] {
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
      ladderStep: step,
    });
  }

  /** 标题区～底栏留白后的带宽 → 首屏约 8 关紧凑步长（布局与相机共用）。 */
  private getLobbyLadderLayout(): { ceiling: number; bandTop: number; step: number } {
    const cover = this.getLobbyCoverRect();
    const titleBandTop = lobbyLevelBandTop(cover, this.statusBarHeight);
    const { h: barH } = lobbyBarSize(this.width, this.height);
    return lobbyFirstScreenLadderLayout({
      bandTop: titleBandTop,
      contentTop: this.lobbyContentTop(),
      barH,
    });
  }

  private prepareLobbyCamera(): void {
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

  private getLobbyCamRange(): { min: number; max: number } {
    const total = this.session.getLevelCount();
    const { step } = this.getLobbyLadderLayout();
    return { min: 0, max: lobbyCameraMax(total, this.height, step) };
  }

  private beginLobbyDrag(x: number, y: number): void {
    this.lobbyCamVel = 0;
    this.lobbyDrag = {
      startX: x,
      startY: y,
      lastY: y,
      lastMs: this.nowMs || Date.now(),
      camStart: this.lobbyCamY,
      moved: false,
      velY: 0,
    };
  }

  private moveLobbyDrag(x: number, y: number): void {
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
        range.max,
      );
      const dt = Math.max(8, now - drag.lastMs);
      drag.velY = -(y - drag.lastY) / dt;
    }
    drag.lastY = y;
    drag.lastMs = now;
  }

  /** @returns 是否已作为滑动消费（不再点选关卡） */
  private endLobbyDrag(): boolean {
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
    // 连续梯子：保留惯性，再轻吸附到最近糖豆步长
    this.lobbyCamVel = Math.max(-1.8, Math.min(1.8, drag.velY));
    this.lobbyCamSnapFrom = this.lobbyCamY;
    this.lobbyCamSnapAtMs = this.nowMs || Date.now();
    this.lobbyCamAutoTarget = lobbySnapTarget(
      drag.camStart,
      this.lobbyCamY,
      this.height,
      range.max,
      drag.velY,
      this.getLobbyLadderLayout().step,
    );
    return true;
  }

  private updateLobbyCamera(dt: number): void {
    if (!this.lobbyCamInited) {
      this.prepareLobbyCamera();
    }
    const range = this.getLobbyCamRange();
    if (this.lobbyDrag?.moved) {
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
      const kSpring = 1 - Math.exp(-dt / 70);
      if (this.lobbyCamY < range.min) {
        this.lobbyCamY += (range.min - this.lobbyCamY) * kSpring;
      } else if (this.lobbyCamY > range.max) {
        this.lobbyCamY += (range.max - this.lobbyCamY) * kSpring;
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
  private drawLobbyBrandCopy(): void {
    const { ctx, width } = this;
    const cover = this.getLobbyCoverRect();
    const titleY = lobbyBrandAnchorY(cover, 0, LOBBY_TITLE_UY);
    const subY = lobbyBrandAnchorY(cover, 0, LOBBY_SUBTITLE_UY);
    if (subY < this.statusBarHeight) {
      return;
    }
    const titleSize = Math.max(28, Math.min(40, Math.round(cover.dh * 0.048)));
    const subSize = Math.max(13, Math.min(17, Math.round(cover.dh * 0.018)));
    const teaser = lobbyComingSoonLine();
    const teaserY = subY + Math.max(22, cover.dh * 0.028);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    ctx.font = `bold ${titleSize}px sans-serif`;
    ctx.shadowColor = 'rgba(70, 130, 180, 0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = 'rgba(140, 200, 230, 0.95)';
    ctx.lineWidth = Math.max(5, Math.round(titleSize * 0.18));
    ctx.strokeText(LOBBY_BRAND_TITLE, width / 2, titleY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(LOBBY_BRAND_TITLE, width / 2, titleY);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.font = `bold ${subSize}px sans-serif`;
    ctx.strokeStyle = 'rgba(120, 180, 215, 0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(LOBBY_BRAND_SUBTITLE, width / 2, subY);
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillText(LOBBY_BRAND_SUBTITLE, width / 2, subY);

    if (teaser) {
      // 警示色：与原先糖果屋/敬请期待同款，区别于标题白字
      ctx.font = 'bold 12px sans-serif';
      ctx.strokeStyle = 'rgba(255,255,255,0.96)';
      ctx.lineWidth = 4;
      ctx.strokeText(teaser, width / 2, teaserY);
      ctx.fillStyle = '#c2255c';
      ctx.fillText(teaser, width / 2, teaserY);
    }
    ctx.restore();
  }

  private drawLobbySwipeHint(page: number, maxPage: number, nowMs: number): void {
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
        this.lobbySwipeHintDismissed,
      );
      if (alpha <= 0.01) {
        this.lobbySwipeHintDismissed = true;
      } else {
        const bob = Math.sin(nowMs / 520) * this.fxAmt(4, 2.5);
        const frame = layoutLobbyMoreLevelsHint(width, this.statusBarHeight, bob);
        ctx.save();
        ctx.globalAlpha = alpha;
        // 右缘半圆把手：左端圆、右端画出屏幕
        ctx.fillStyle = 'rgba(32, 40, 56, 0.42)';
        this.roundRectPath(frame.x, frame.y, width - frame.x + 10, frame.h, frame.r);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1;
        this.roundRectPath(frame.x, frame.y, width - frame.x + 10, frame.h, frame.r);
        ctx.stroke();
        this.drawSwipeChevrons(frame.chevronX, frame.cy, -1);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          page <= 0 ? LOBBY_MORE_LEVELS_HINT : '上滑继续',
          frame.textX,
          frame.cy,
        );
        ctx.restore();
      }
    }
    if (page > 0) {
      const nav = this.getNavChipFrame();
      const bob = Math.sin(nowMs / 520) * this.fxAmt(3, 2);
      const y = nav.y - 44 - bob * 0.35;
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText('下滑返回', width / 2, y);
      ctx.restore();
    }
  }

  private drawSwipeChevrons(x: number, y: number, dir: number): void {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 2; i += 1) {
      const oy = dir * i * 5;
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 3.5 + oy);
      ctx.lineTo(x, y - 1.5 + oy);
      ctx.lineTo(x + 5, y + 3.5 + oy);
      ctx.stroke();
    }
  }

  private drawLobbyPageDots(page: number, maxPage: number): void {
    if (maxPage <= 0) {
      return;
    }
    const { ctx, width, height } = this;
    const total = maxPage + 1;
    const x = width - 16;
    const gap = Math.min(14, (height * 0.22) / Math.max(1, total - 1));
    const r = 3.5;
    const startY = height * 0.42 - ((total - 1) * gap) / 2;
    ctx.save();
    for (let i = 0; i < total; i += 1) {
      ctx.beginPath();
      ctx.arc(x, startY + i * gap, i === page ? 4.5 : r, 0, Math.PI * 2);
      ctx.fillStyle = i === page ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.38)';
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 马卡龙三层：外壳贴图、关卡号、得分。树上底图的假分数会被外壳盖住。
   */
  private drawLobbyMacaronVisual(
    node: LobbyLevelNode,
    unlocked: boolean,
    cleared: boolean,
    isCurrent: boolean,
    nowMs: number,
  ): void {
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
      showScore,
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
  private drawLobbyMacaronShell(node: LobbyLevelNode, unlocked: boolean): void {
    const { ctx } = this;
    const r = this.lobbyMacaronVisualR(node);
    const sprite = this.uiIcons.get(`macaron-${node.slotIndex % MACARON_SRC.length}`);
    const size = (r * 2) / MACARON_SPRITE_FILL;
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
  private drawLobbyMacaronFallbackShell(r: number, slotIndex: number): void {
    const { ctx } = this;
    const palettes = [
      { shell: '#ff9ec8', cream: '#fff0f6', edge: '#f783ac' },
      { shell: '#8ee4c0', cream: '#e6fff6', edge: '#38d9a9' },
      { shell: '#d0b3ff', cream: '#f3e8ff', edge: '#9775fa' },
      { shell: '#ffc078', cream: '#fff4e0', edge: '#ff922b' },
      { shell: '#74c0fc', cream: '#e7f5ff', edge: '#4dabf7' },
    ];
    const pal = palettes[slotIndex % palettes.length]!;
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
    ctx.fillStyle = '#f3e2c8';
    for (let i = 0; i < pearls; i += 1) {
      const ang = (i / pearls) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * ring, Math.sin(ang) * ring, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 关号：白字 + 跟树上底图一样的深色同系描边（粉/薄荷/紫/橙/蓝）。
   * 1 位和 2 位同一高度，尽量填满内馅；有得分时只上移，不缩小。
   */
  private drawLobbyMacaronLevelLabel(
    label: string,
    r: number,
    unlocked: boolean,
    slotIndex: number,
    compact = false,
  ): void {
    const { ctx } = this;
    ctx.save();
    const stroke = MACARON_NUM_STROKE[slotIndex % MACARON_NUM_STROKE.length]!;
    const glyphs = Array.from(label, (ch) => this.uiIcons.get(`digit-${ch}`));
    if (glyphs.every((img) => !!img && (img.width || 0) > 0)) {
      this.drawLobbyMacaronDigitSprites(
        glyphs as WxImage[],
        r,
        unlocked,
        stroke,
        compact,
      );
      ctx.restore();
      return;
    }
    const lift = compact ? r * 0.18 : 0;
    const ny = -r * 0.06 - lift;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.font = `900 ${Math.round(r * 0.62)}px sans-serif`;
    ctx.strokeStyle = this.shadeHex(stroke, -28);
    ctx.lineWidth = Math.max(3.2, r * 0.1);
    ctx.strokeText(label, 0, ny + Math.max(0.8, r * 0.028));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(2.6, r * 0.08);
    ctx.strokeText(label, 0, ny);
    ctx.fillStyle = unlocked ? '#ffffff' : 'rgba(255,255,255,0.78)';
    ctx.fillText(label, 0, ny);
    ctx.restore();
  }

  private drawLobbyMacaronDigitSprites(
    glyphs: WxImage[],
    r: number,
    unlocked: boolean,
    stroke: string,
    compact = false,
  ): void {
    const { ctx } = this;
    const h = r * 0.82;
    const gap = h * 0.04;
    const widths = glyphs.map((img) => h * ((img.width || 1) / (img.height || 1)));
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (glyphs.length - 1);
    const x0 = -total / 2;
    const lift = compact ? r * 0.18 : 0;
    const y = -r * 0.06 - h / 2 - lift;
    const ox = Math.max(1.7, h * 0.09);
    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
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
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    this.drawLobbyDigitRow(glyphs, widths, gap, x0, y, h);
    ctx.restore();
  }

  private drawLobbyDigitRow(
    glyphs: WxImage[],
    widths: number[],
    gap: number,
    x0: number,
    y: number,
    h: number,
  ): void {
    const { ctx } = this;
    let x = x0;
    for (let i = 0; i < glyphs.length; i += 1) {
      const img = glyphs[i]!;
      const w = widths[i]!;
      ctx.drawImage(img, x, y, w, h);
      x += w + gap;
    }
  }

  /** 局内道具栏：图片圆形按钮 + 数量角标 */
  private drawBoosterBar(): void {
    const { ctx, width, height } = this;
    const stock = this.session.getBoosterStock();
    const size = 58;
    const gap = 14;
    const y = height - size - 22;
    const items: Array<{
      id: UiButton['id'];
      iconKey: keyof typeof BOOSTER_ICON_SRC;
      count: number;
      active?: boolean;
    }> = [
      {
        id: 'booster_hammer',
        iconKey: 'hammer',
        count: stock.hammer,
        active: this.hammerTargeting,
      },
      { id: 'booster_shuffle', iconKey: 'shuffle', count: stock.shuffle },
      { id: 'booster_extra', iconKey: 'extra', count: stock.extraMoves },
    ];
    const totalW = items.length * size + (items.length - 1) * gap;
    const nav = this.getNavChipFrame();
    const leftReserve = nav.x + nav.w + 10;
    const avail = Math.max(totalW, width - leftReserve - 14);
    let x = leftReserve + Math.floor((avail - totalW) / 2);

    for (const item of items) {
      const boosterId = this.boosterIdFromButton(item.id);
      const refill =
        item.count === 0 ? this.session.getBoosterRefillChannel(boosterId) : 'none';
      const extraAd = refill !== 'none';
      const disabled = item.count === 0 && !extraAd;
      const btn: UiButton = {
        id: item.id,
        x,
        y,
        w: size,
        h: size,
        label: item.iconKey,
        hitPad: extraAd ? 18 : 8,
      };
      this.buttons.push(btn);
      this.drawBoosterIconButton(btn, item.iconKey, {
        disabled,
        active: !!item.active,
        count: extraAd ? -1 : item.count,
        badge: extraAd && refill !== 'none' ? boosterRefillBadge(refill) : undefined,
      });
      x += size + gap;
    }

    if (this.hammerTargeting) {
      ctx.fillStyle = 'rgba(90,60,40,0.85)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('点棋盘一格砸掉 · 再点锤子取消', width / 2, y - 16);
    }
  }

  /** 点底部道具后的气泡，避免提示只出现在头顶 HUD 被忽略。 */
  private drawActionToast(): void {
    const now = this.nowMs || Date.now();
    if (!this.toastText || now >= this.toastUntilMs) {
      return;
    }
    const { ctx, width, height } = this;
    const remain = this.toastUntilMs - now;
    const fade = remain < 400 ? remain / 400 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const padX = 18;
    const tipW = Math.min(width - 28, ctx.measureText(this.toastText).width + padX * 2);
    const tipH = 36;
    const x = (width - tipW) / 2;
    const y = height - 58 - 22 - tipH - 12;
    this.drawHudPill(x, y, tipW, tipH, 'rgba(255,248,230,0.96)', '#ff922b');
    ctx.fillStyle = '#d35400';
    ctx.fillText(this.toastText, width / 2, y + tipH / 2 + 0.5);
    ctx.restore();
  }

  private drawBoosterIconButton(
    btn: UiButton,
    iconKey: keyof typeof BOOSTER_ICON_SRC,
    opts: { disabled: boolean; active: boolean; count: number; badge?: string },
  ): void {
    const { ctx } = this;
    const img = this.uiIcons.get(iconKey);
    const cx = btn.x + btn.w / 2;
    const cy = btn.y + btn.h / 2;
    const r = btn.w / 2;
    const now = this.nowMs || Date.now();
    const bounce = opts.active
      ? 1.08 + 0.04 * Math.sin(now * 0.012)
      : 1 + this.fxAmt(0.025, 0.014) * Math.sin(now * 0.005 + btn.x * 0.03);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(bounce, bounce);
    ctx.translate(-cx, -cy);

    // 底托圆
    const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
    if (opts.disabled) {
      grad.addColorStop(0, '#f1f3f5');
      grad.addColorStop(1, '#ced4da');
    } else if (opts.active) {
      grad.addColorStop(0, '#fff3bf');
      grad.addColorStop(1, '#ffd43b');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#ffe8cc');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = opts.active ? '#fab005' : '#ffffff';
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
      // 图标未加载时的文字兜底
      ctx.fillStyle = opts.disabled ? '#868e96' : '#5c3d2e';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fallback =
        iconKey === 'hammer'
          ? '锤'
          : iconKey === 'shuffle'
            ? '排'
            : iconKey === 'extra'
              ? '+5'
              : iconKey === 'mute'
                ? '静'
                : '音';
      ctx.fillText(fallback, cx, cy);
    }

    if (opts.badge) {
      const bx = btn.x + btn.w - 2;
      const by = btn.y + 6;
      const fill =
        opts.badge === '好友' ? '#12b886' : opts.badge === '群' ? '#339af0' : '#ff922b';
      ctx.fillStyle = fill;
      this.roundRectPath(bx - 18, by - 9, 36, 18, 9);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      this.roundRectPath(bx - 18, by - 9, 36, 18, 9);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.badge, bx, by + 0.5);
    } else if (opts.count >= 0) {
      const bx = btn.x + btn.w - 4;
      const by = btn.y + 4;
      ctx.fillStyle = opts.disabled ? '#adb5bd' : '#fa5252';
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(opts.count), bx, by + 0.5);
    }
    ctx.restore();
  }

  private drawHud(): void {
    const { ctx } = this;
    const level = this.session.getLevelConfig();
    const goals = this.session.getGoals()?.getSnapshots() ?? [];
    const frame = this.getHudFrame();
    const crush = this.session.getCrushSession();
    const clean = this.session.getCleanSession();
    const inCrush = this.mode === 'crush' && !!crush;
    const inClean = this.mode === 'clean' && !!clean;
    const inBurst = inCrush || inClean;
    const burstSession = inClean ? clean : crush;
    const moves = this.session.getMovesLeft();
    const score = this.session.getScore();
    const hudGoal = formatHudGoals(goals);

    // 不再铺满整宽白条，避开刘海与右上角胶囊
    const y0 = frame.top;

    // 关卡小徽章（糖果标签）
    const levelLabel = inClean
      ? '清洁模式'
      : inCrush
        ? '粉碎奖励'
        : `第 ${level?.id ?? '-'} 关`;
    ctx.font = 'bold 13px sans-serif';
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
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    this.roundRectPath(lx + 3, ly + 3, levelW - 6, levelH - 6, (levelH - 6) / 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    this.roundRectPath(lx + 1, ly + 1, levelW - 2, levelH - 2, levelH / 2 - 1);
    ctx.stroke();
    ctx.fillStyle = candy.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(levelLabel, lx + levelW / 2, ly + levelH / 2);
    ctx.restore();

    // 第二行：糖果枝托盘 = 步数糖环 + 糖霜信息牌
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
    const circleValue = inBurst
      ? String(Math.ceil((burstSession?.remainingMs ?? 0) / 1000))
      : String(moves);
    this.drawHudCandyMovesBadge(circleCx, circleCy, circleR, {
      label: inBurst ? '剩余' : '步数',
      value: circleValue,
      pulse: movePulse,
      low: lowMoves,
      candy,
    });

    this.drawHudCandyPlaque(cardLeft, rowY, cardW, cardH, candy);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = candy.inkSoft;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('分数', cardLeft + 16, rowY + 14);
    ctx.save();
    ctx.translate(cardLeft + 48, rowY + 14);
    ctx.scale(this.hudScorePunch, this.hudScorePunch);
    ctx.fillStyle = candy.ink;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(score), 0, 0);
    ctx.restore();

    // 目标 / 粉碎 / 清扫进度条（卡通饱满）
    const barX = cardLeft + 12;
    const barY = rowY + 30;
    const iconSize = 18;
    const hasIcon = !inBurst && !!(hudGoal.collectKind && this.tileImages.get(hudGoal.collectKind));
    const barW = cardW - 24;
    const barH = 24;
    const barPulse =
      this.hudBarPulse > 0
        ? 1 + (inBurst ? 0.16 : 0.08) * Math.sin((1 - this.hudBarPulse / 420) * Math.PI)
        : 1;

    let progress = 0;
    let goalLabel = '目标 -';
    let barTheme: {
      track: string;
      fillTop: string;
      fillMid: string;
      fillBottom: string;
      border: string;
    } = {
      track: '#d0ebff',
      fillTop: '#a5d8ff',
      fillMid: '#4dabf7',
      fillBottom: '#228be6',
      border: '#74c0fc',
    };
    if (inClean && clean) {
      progress = this.hudBurstBarDisplay;
      goalLabel = `清扫 +${clean.crushScore}`;
      barTheme = {
        track: '#d0ebff',
        fillTop: '#74c0fc',
        fillMid: '#339af0',
        fillBottom: '#1c7ed6',
        border: '#4dabf7',
      };
    } else if (inCrush && crush) {
      progress = this.hudBurstBarDisplay;
      goalLabel = `粉碎 +${crush.crushScore}`;
      barTheme = {
        track: '#c5f6fa',
        fillTop: '#66d9e8',
        fillMid: '#22b8cf',
        fillBottom: '#1098ad',
        border: '#3bc9db',
      };
    } else if (hudGoal.text) {
      progress = hudGoal.progress;
      goalLabel = hudGoal.text;
    }

    this.drawCartoonProgressBar(barX, barY, barW, barH, progress, barTheme, barPulse);

    if (hasIcon && hudGoal.collectKind) {
      const sprite = this.tileImages.get(hudGoal.collectKind)!;
      this.drawTileSprite(
        sprite,
        barX + 4,
        barY + (barH - iconSize) / 2,
        iconSize,
      );
    }

    ctx.font = goalLabel.length > 22 ? 'bold 10px sans-serif' : 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelX = barX + (hasIcon ? 8 : 0) + barW / 2;
    const labelY = barY + barH / 2 + 0.5;
    ctx.save();
    if (inBurst && this.hudScorePunch > 1) {
      ctx.translate(labelX, labelY);
      ctx.scale(this.hudScorePunch, this.hudScorePunch);
      ctx.translate(-labelX, -labelY);
    }
    ctx.strokeStyle = inBurst ? 'rgba(12, 80, 100, 0.35)' : 'rgba(24, 100, 160, 0.35)';
    ctx.lineWidth = 3.5;
    ctx.strokeText(goalLabel, labelX, labelY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(goalLabel, labelX, labelY);
    ctx.restore();

    // 状态提示（复活成功等），放在 HUD 下方，不挤顶部
    if (
      this.statusText &&
      (this.mode === 'playing' || this.mode === 'crush' || this.mode === 'clean')
    ) {
      const tipY = this.getHudBottom() + 2;
      ctx.font = '12px sans-serif';
      const tipW = Math.min(frame.width, ctx.measureText(this.statusText).width + 20);
      this.drawHudPill(frame.left, tipY, tipW, 22, 'rgba(232,248,255,0.95)', '#74c0fc');
      ctx.fillStyle = '#1864ab';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.statusText, frame.left + 10, tipY + 11);
    }
  }

  /** 糖果枝配色：对局 / 粉碎 / 清洁统一天蓝冷色 */
  private getHudCandyPalette(
    inClean: boolean,
    inCrush: boolean,
  ): {
    deep: string;
    mid: string;
    lite: string;
    ink: string;
    inkSoft: string;
    shadow: string;
  } {
    if (inClean) {
      return {
        deep: '#1c7ed6',
        mid: '#74c0fc',
        lite: '#d0ebff',
        ink: '#1864ab',
        inkSoft: '#4dabf7',
        shadow: '#1c4b7a',
      };
    }
    if (inCrush) {
      return {
        deep: '#1098ad',
        mid: '#3bc9db',
        lite: '#c5f6fa',
        ink: '#0b7285',
        inkSoft: '#15aabf',
        shadow: '#0b4f5c',
      };
    }
    return {
      deep: '#339af0',
      mid: '#74c0fc',
      lite: '#d0ebff',
      ink: '#1864ab',
      inkSoft: '#4dabf7',
      shadow: '#1c4b7a',
    };
  }

  /** 兼容微信 Canvas 的椭圆填充 */
  private fillEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rot = 0,
  ): void {
    const { ctx } = this;
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
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
  private drawHudCandyMovesBadge(
    cx: number,
    cy: number,
    r: number,
    opts: {
      label: string;
      value: string;
      pulse: number;
      low: boolean;
      candy: ReturnType<WxCanvasGameApp['getHudCandyPalette']>;
    },
  ): void {
    const { ctx } = this;
    const c = opts.candy;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(opts.pulse, opts.pulse);
    ctx.translate(-cx, -cy);

    // 投影
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = c.shadow;
    this.fillEllipse(cx + 2, cy + 5, r + 2, r * 0.55, 0);
    ctx.globalAlpha = 1;

    // 外糖环
    const ring = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r + 4);
    ring.addColorStop(0, '#ffffff');
    ring.addColorStop(0.35, c.lite);
    ring.addColorStop(0.75, c.mid);
    ring.addColorStop(1, c.deep);
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.fill();

    // 内奶油面
    const face = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(1, c.lite);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 高光弧
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, -Math.PI * 0.9, -Math.PI * 0.18);
    ctx.stroke();

    // 彩色描边：步数紧张时用深蓝警示（冷色），不用红
    ctx.strokeStyle = opts.low ? '#339af0' : '#ffffff';
    ctx.lineWidth = opts.low ? 3.2 : 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3.8, 0, Math.PI * 2);
    ctx.stroke();

    // 顶部糖珠
    const pearls = [
      { x: -0.55, y: -0.82, color: '#a5d8ff' },
      { x: 0.05, y: -0.95, color: '#74c0fc' },
      { x: 0.58, y: -0.78, color: '#4dabf7' },
    ];
    for (const p of pearls) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx + r * p.x, cy + r * p.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = opts.low ? '#1c7ed6' : c.inkSoft;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label, cx, cy - 9);
    ctx.fillStyle = opts.low ? '#1864ab' : c.ink;
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(opts.value, cx, cy + 8);
    ctx.restore();
  }

  /** 糖霜信息牌（分数 + 目标） */
  private drawHudCandyPlaque(
    x: number,
    y: number,
    w: number,
    h: number,
    candy: ReturnType<WxCanvasGameApp['getHudCandyPalette']>,
  ): void {
    const { ctx } = this;
    const r = Math.min(20, h * 0.45);

    ctx.save();
    // 投影
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
    ctx.fillStyle = '#ffffff';
    this.roundRectPath(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(10, r - 4));
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    this.roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 卡通饱满进度条：厚边胶囊槽 + 内嵌果冻填充 + 双层高光。
   */
  private drawCartoonProgressBar(
    x: number,
    y: number,
    w: number,
    h: number,
    progress: number,
    colors: {
      track: string;
      fillTop: string;
      fillMid: string;
      fillBottom: string;
      border: string;
    },
    pulse = 1,
  ): void {
    const { ctx } = this;
    const r = h / 2;
    const p = Math.max(0, Math.min(1, progress));
    const inset = 3.5;
    const innerH = Math.max(8, h - inset * 2);
    const innerR = innerH / 2;
    const innerMaxW = Math.max(0, w - inset * 2);
    let fillW = Math.floor(innerMaxW * p);
    // 有进度时至少画出一颗圆润糖豆，避免细长扁条
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

    // 外阴影（软落地）
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#4a7090';
    this.roundRectPath(x + 1.5, y + 3, w, h, r);
    ctx.fill();
    ctx.restore();

    // 外轮廓底（偏白，衬出厚边）
    ctx.fillStyle = '#f1f8ff';
    this.roundRectPath(x, y, w, h, r);
    ctx.fill();

    // 底槽渐变（上下略深，中间亮，像凹槽）
    const trackGrad = ctx.createLinearGradient(x, y, x, y + h);
    trackGrad.addColorStop(0, this.shadeHex(colors.track, -18));
    trackGrad.addColorStop(0.35, colors.track);
    trackGrad.addColorStop(1, this.shadeHex(colors.track, -28));
    ctx.fillStyle = trackGrad;
    this.roundRectPath(x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 2));
    ctx.fill();

    // 槽内上沿阴影（凹陷）
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000000';
    this.roundRectPath(x + 4, y + 3, w - 8, Math.max(3, h * 0.28), Math.min(r - 2, 7));
    ctx.fill();
    ctx.restore();

    if (fillW >= 2) {
      const fx = x + inset;
      const fy = y + inset;
      const bodyW = Math.min(innerMaxW, fillW);

      // 果冻主体
      const jelly = ctx.createLinearGradient(fx, fy, fx, fy + innerH);
      jelly.addColorStop(0, colors.fillTop);
      jelly.addColorStop(0.45, colors.fillMid);
      jelly.addColorStop(1, colors.fillBottom);
      ctx.fillStyle = jelly;
      this.roundRectPath(fx, fy, bodyW, innerH, innerR);
      ctx.fill();

      // 底部略深一截，增加体积感
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = colors.fillBottom;
      this.roundRectPath(
        fx + 1,
        fy + innerH * 0.55,
        Math.max(0, bodyW - 2),
        innerH * 0.42,
        Math.max(2, innerR - 1),
      );
      ctx.fill();
      ctx.restore();

      // 顶部宽高光带
      ctx.save();
      ctx.globalAlpha = 0.72;
      const gloss = ctx.createLinearGradient(fx, fy, fx, fy + innerH * 0.55);
      gloss.addColorStop(0, 'rgba(255,255,255,0.95)');
      gloss.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      this.roundRectPath(
        fx + 3,
        fy + 2,
        Math.max(0, bodyW - 6),
        innerH * 0.42,
        Math.max(3, innerR - 3),
      );
      ctx.fill();
      ctx.restore();

      // 前端糖豆亮点 + 小反光点
      if (bodyW > innerH * 0.45) {
        const tipX = fx + bodyW - innerR * 0.55;
        const tipY = fy + innerH * 0.38;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tipX, tipY, Math.max(2.4, innerR * 0.32), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(fx + Math.min(10, bodyW * 0.18), fy + innerH * 0.28, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // 脉冲星点（目标推进 / 粉碎加分时更炫）
        if (pulse > 1.02) {
          this.drawSparkleStar(tipX, tipY - 1, 4.2, 1);
          this.drawSparkleStar(tipX - innerH * 0.55, fy + 2, 2.6, 0.85);
        }
      } else if (pulse > 1.02 && bodyW >= 2) {
        this.drawSparkleStar(fx + bodyW * 0.55, fy + innerH * 0.35, 3.4, 0.95);
      }
    }

    // 粗彩外边
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 3.2;
    this.roundRectPath(x + 1.4, y + 1.4, w - 2.8, h - 2.8, Math.max(1, r - 1));
    ctx.stroke();

    // 内白描边，糖果包装感
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = 1.6;
    this.roundRectPath(x + 4.2, y + 4.2, w - 8.4, h - 8.4, Math.max(1, r - 4));
    ctx.stroke();
    ctx.restore();
  }

  /** 简易色值加减亮度（#rrggbb） */
  private shadeHex(hex: string, delta: number): string {
    const raw = hex.replace('#', '');
    if (raw.length !== 6) {
      return hex;
    }
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    const r = clamp(parseInt(raw.slice(0, 2), 16) + delta);
    const g = clamp(parseInt(raw.slice(2, 4), 16) + delta);
    const b = clamp(parseInt(raw.slice(4, 6), 16) + delta);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
      .toString(16)
      .padStart(2, '0')}`;
  }

  private drawHudPill(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke: string,
  ): void {
    const { ctx } = this;
    const r = Math.min(h / 2, 14);
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    this.roundRectPath(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
    // 轻微投影感
    ctx.restore();
  }

  private roundRectPath(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const { ctx } = this;
    // 微信小游戏 Canvas 的 roundRect 半径参数与标准不一致，统一用手动画弧
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
    ctx.arc(x + rr, y + rr, rr, Math.PI, (Math.PI * 3) / 2);
    ctx.closePath();
  }

  private drawBoard(): void {
    const board = this.session.getBoard();
    if (!board) {
      return;
    }
    const layout = this.computeBoardLayout(board);
    // 与触摸命中共用同一布局，避免点偏/无选中
    this.boardView.updateLayout(layout);

    this.drawBoardPanel(board, layout);
    this.drawBoardSlots(board, layout);
    this.drawBuriedGroups(board, layout, 'base');
    const encaseIce = this.iceEncasesAnimals();

    const liveBurstBoard = this.mode === 'crush' || this.mode === 'clean';
    if (!liveBurstBoard && this.animator.isPlaying()) {
      this.drawAnimatedTiles(layout);
      if (encaseIce) {
        this.drawIceOverlays(board, layout);
      }
      this.drawCloudOverlays(board, layout);
      this.drawEggAndVineOverlays(board, layout);
      this.drawBuriedGroups(board, layout, 'leave');
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
      this.drawBuriedGroups(board, layout, 'leave');
      return;
    }

    const sel = this.boardView.getSelection();
    const drag = this.boardView.getDragPreview(now);
    const topTiles: Array<{
      x: number;
      y: number;
      size: number;
      kind: TileKind;
      sparkle: boolean;
      ring?: boolean;
    }> = [];

    const rows = board.size.rows;
    const cols = board.size.cols;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const kind = board.getTile(r, c);
        if (kind === TileKind.Empty || kind === TileKind.Hole) {
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
            // 原点留下淡影，表示“被拎起”
            this.drawDragGhostSlot(x, y, layout.cellSize, drag.slideProgress);
            x += drag.dx;
            y += drag.dy;
            // 跟手放大更明显：按下约 1.12，滑到邻格约 1.22
            const liftScale = 1.14 + 0.1 * drag.pressLift + 0.12 * drag.slideProgress;
            drawSize = layout.cellSize * liftScale;
            x -= (drawSize - layout.cellSize) / 2;
            y -= (drawSize - layout.cellSize) / 2 + layout.cellSize * 0.04 * drag.pressLift;
            lift = true;
            showRing = true;
          } else if (
            (r === drag.otherRow && c === drag.otherCol) &&
            (drag.otherDx !== 0 || drag.otherDy !== 0)
          ) {
            // 目标邻格高亮提示可交换
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

        const frozen =
          (encaseIce && this.getDisplayIce(board, r, c) > 0) ||
          this.getDisplayCloud(board, r, c) > 0 ||
          this.getDisplayEgg(board, r, c) > 0 ||
          this.getDisplayVine(board, r, c) > 0;
        const idle = frozen
          ? 1
          : 1 + this.fxAmt(0.042, 0.022) * Math.sin(now * 0.0042 + r * 1.7 + c * 2.1);
        const sit = this.sitOnGemRect(
          x,
          y,
          drawSize,
          this.tileSitsOnBase(board, r, c),
        );
        this.drawTileAt(sit.x, sit.y, sit.size, kind, 1, idle, sparkle, now);
        if (sel && sel.row === r && sel.col === c && !drag) {
          this.drawSelectionRing(x, y, layout.cellSize, now);
        }
      }
    }

    // 拖动块置顶：先对向格，再主拖动格（带阴影 + 光环）
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
    this.drawBuriedGroups(board, layout, 'leave');
  }

  /** 拖起时原点淡影 */
  private drawDragGhostSlot(
    x: number,
    y: number,
    cellSize: number,
    slideProgress: number,
  ): void {
    const { ctx } = this;
    const pad = Math.max(2, Math.floor(cellSize * 0.08));
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.18 * slideProgress;
    ctx.fillStyle = 'rgba(255, 140, 180, 0.55)';
    this.roundRectPath(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    this.roundRectPath(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.22);
    ctx.stroke();
    ctx.restore();
  }

  /** 邻格可交换高亮 */
  private drawSwapTargetHint(
    x: number,
    y: number,
    cellSize: number,
    slideProgress: number,
  ): void {
    const { ctx } = this;
    const pad = Math.max(1, Math.floor(cellSize * 0.04));
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.45 * slideProgress;
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    this.roundRectPath(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  /** 拖动块脚下阴影，增强“拎起”感 */
  private drawDragShadow(x: number, y: number, cellSize: number): void {
    const { ctx } = this;
    const cx = x + cellSize / 2;
    const cy = y + cellSize * 0.78;
    ctx.save();
    const shadow = ctx.createRadialGradient(cx, cy, cellSize * 0.08, cx, cy, cellSize * 0.42);
    shadow.addColorStop(0, 'rgba(80, 40, 60, 0.35)');
    shadow.addColorStop(1, 'rgba(80, 40, 60, 0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.42);
    ctx.arc(0, 0, cellSize * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 交换滑动：成功滑入 / 失败回弹，期间用快照绘制避免跳变 */
  private drawBoardWithSwapSlide(
    board: BoardModel,
    layout: { cellSize: number; originX: number; originY: number },
    slide: SwapSlideFx,
    now: number,
  ): void {
    const rawT = this.swapSlideProgress(now);
    let moveT: number;
    if (slide.rejected) {
      // 0→1→0 回弹
      moveT = rawT < 0.5 ? this.easeOutSwap(rawT * 2) : this.easeOutSwap((1 - rawT) * 2);
    } else {
      moveT = this.easeOutSwap(rawT);
    }

    const posA = this.cellScreenRect(layout, slide.rowA, slide.colA);
    const posB = this.cellScreenRect(layout, slide.rowB, slide.colB);
    // 成功：盘面已交换，A 格内容从 B 滑向 A；失败：原格向对方滑再回
    const drawAx = slide.rejected
      ? posA.x + (posB.x - posA.x) * moveT
      : posB.x + (posA.x - posB.x) * moveT;
    const drawAy = slide.rejected
      ? posA.y + (posB.y - posA.y) * moveT
      : posB.y + (posA.y - posB.y) * moveT;
    const drawBx = slide.rejected
      ? posB.x + (posA.x - posB.x) * moveT
      : posA.x + (posB.x - posA.x) * moveT;
    const drawBy = slide.rejected
      ? posB.y + (posA.y - posB.y) * moveT
      : posA.y + (posB.y - posA.y) * moveT;

    const snapshot = this.pendingPlayback;
    const rows = snapshot?.rows ?? board.size.rows;
    const cols = snapshot?.cols ?? board.size.cols;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (
          (r === slide.rowA && c === slide.colA) ||
          (r === slide.rowB && c === slide.colB)
        ) {
          continue;
        }
        let kind: TileKind;
        let sparkle = false;
        if (snapshot) {
          const i = r * cols + c;
          kind = snapshot.cells[i] as TileKind;
          sparkle = snapshot.sparkles[i] === 1;
        } else {
          kind = board.getTile(r, c);
          sparkle = board.isSparkle(r, c);
        }
        if (kind === TileKind.Empty || kind === TileKind.Hole) {
          continue;
        }
        const x = layout.originX + c * layout.cellSize;
        const y = layout.originY - (r + 1) * layout.cellSize;
        const sit = this.sitOnGemRect(
          x,
          y,
          layout.cellSize,
          this.tileSitsOnBase(board, r, c),
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
      now,
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
      now,
    );
  }

  /** 棋盘外框：白底圆角红框，矩形和异形关都画。 */
  private drawBoardPanel(
    board: BoardModel,
    layout: { cellSize: number; originX: number; originY: number },
  ): void {
    const { ctx } = this;
    const pad = 14;
    const w = board.size.cols * layout.cellSize + pad * 2;
    const h = board.size.rows * layout.cellSize + pad * 2;
    const x = layout.originX - pad;
    const y = layout.originY - board.size.rows * layout.cellSize - pad;
    const radius = Math.min(22, Math.floor(layout.cellSize * 0.38));

    // 软投影
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#4a7090';
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
  private drawBoardSlots(
    board: BoardModel,
    layout: { cellSize: number; originX: number; originY: number },
  ): void {
    const { ctx } = this;
    const gap = Math.max(2, Math.floor(layout.cellSize * 0.06));
    const slotR = Math.max(6, Math.floor(layout.cellSize * 0.18));

    for (let r = 0; r < board.size.rows; r += 1) {
      for (let c = 0; c < board.size.cols; c += 1) {
        if (board.getTile(r, c) === TileKind.Hole) {
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

  private updateBuriedCollect(now: number): void {
    if (this.buriedFx.size === 0) {
      return;
    }
    const waiting = this.animator.isPlaying() || !!this.pendingPlayback || !!this.swapSlide;
    const done: number[] = [];
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

  private drawBuriedGroups(
    board: BoardModel,
    layout: { cellSize: number; originX: number; originY: number },
    layer: 'base' | 'leave' = 'base',
  ): void {
    const cs = layout.cellSize;
    const cols = board.size.cols;
    const now = this.nowMs || Date.now();
    for (const group of board.listBuriedGroups()) {
      const peek: number[] = [];
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
      if (layer === 'leave' && !leaving) {
        continue;
      }
      if (layer === 'base' && leaving) {
        continue;
      }
      let lift = 0;
      let scale = fullyOut ? 1.04 : 1;
      let alpha = 1;
      if (fx && fx.poseFrom > 0 && fx.leaveFrom <= 0) {
        const pulse = 0.5 + 0.5 * Math.sin(((now - fx.poseFrom) / 180) * Math.PI);
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
        this.drawBuriedSprite(this.buriedSnowman, dx, dy, dw, dh, () =>
          this.drawCuteSnowman(dx, dy, dw, dh),
        );
      } else if (group.kind === BURIED_PENGUIN) {
        this.drawBuriedSprite(this.buriedPenguin, dx, dy, dw, dh, () =>
          this.drawCutePenguin(dx, dy, dw, dh),
        );
      }
      ctx.restore();
    }
  }

  private iceEncasesAnimals(): boolean {
    return this.session.getLevelConfig()?.iceStyle === 'encase';
  }

  private drawIceOnSlot(x: number, y: number, s: number, slotR: number): void {
    this.paintIceCell(x, y, s, slotR, false, 0, 0);
  }

  private drawIceOverlays(
    board: BoardModel,
    layout: { cellSize: number; originX: number; originY: number },
  ): void {
    const cs = layout.cellSize;
    const slotR = Math.max(6, Math.floor(cs * 0.18));
    for (let r = 0; r < board.size.rows; r += 1) {
      for (let c = 0; c < board.size.cols; c += 1) {
        if (
          board.getTile(r, c) === TileKind.Hole ||
          this.getDisplayIce(board, r, c) <= 0
        ) {
          continue;
        }
        const x = layout.originX + c * cs;
        const y = layout.originY - (r + 1) * cs;
        this.paintIceCell(x, y, cs, slotR, true, r, c);
      }
    }
  }

  /** 冰块：实色玻璃罩 + 一笔裂纹，避免每格两套渐变。 */
  private paintIceCell(
    x: number,
    y: number,
    s: number,
    slotR: number,
    encase: boolean,
    row: number,
    col: number,
  ): void {
    const { ctx } = this;
    ctx.save();
    this.roundRectPath(x + 1, y + 1, s - 2, s - 2, slotR);
    ctx.clip();
    ctx.fillStyle = encase ? 'rgba(164, 220, 245, 0.46)' : 'rgba(186, 232, 255, 0.9)';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
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
    ctx.strokeStyle = encase ? 'rgba(255,255,255,0.85)' : 'rgba(90, 170, 220, 0.95)';
    ctx.lineWidth = 2.2;
    this.roundRectPath(x + 2, y + 2, s - 4, s - 4, Math.max(3, slotR - 1));
    ctx.stroke();
    ctx.restore();
  }

  private tileSitsOnBase(board: BoardModel, row: number, col: number): boolean {
    if (this.getDisplayCloud(board, row, col) > 0) {
      return false;
    }
    if (board.getGem(row, col) > 0) {
      return true;
    }
    return board.getBuried(row, col) > 0 && this.getDisplayIce(board, row, col) <= 0;
  }

  /** 揭开棉花后动物略缩小，坐在粉球上。 */
  private sitOnGemRect(
    x: number,
    y: number,
    cellSize: number,
    sit: boolean,
  ): { x: number; y: number; size: number } {
    if (!sit) {
      return { x, y, size: cellSize };
    }
    const size = cellSize * 0.9;
    return {
      x: x + (cellSize - size) * 0.5,
      y: y + cellSize * 0.01,
      size,
    };
  }

  private drawPinkGemOnSlot(x: number, y: number, s: number, underCloud: boolean): void {
    const { ctx } = this;
    const cx = x + s * 0.5;
    const cy = y + s * 0.78;
    const r = s * (underCloud ? 0.26 : 0.34);
    ctx.save();
    ctx.globalAlpha = underCloud ? 0.35 : 1;
    ctx.fillStyle = 'rgba(90, 40, 70, 0.28)';
    this.fillEllipse(cx, cy + r * 0.42, r * 0.92, r * 0.28, 0);
    ctx.fillStyle = '#ff7eb6';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    this.fillEllipse(cx - r * 0.28, cy - r * 0.32, r * 0.32, r * 0.18, -0.5);
    ctx.strokeStyle = 'rgba(176, 32, 90, 0.5)';
    ctx.lineWidth = Math.max(0.9, s * 0.022);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBuriedSprite(
    sprite: WxImage | null,
    x: number,
    y: number,
    w: number,
    h: number,
    fallback: () => void,
  ): void {
    const iw = sprite?.width ?? 0;
    const ih = sprite?.height ?? 0;
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

  private fillCuteBall(
    cx: number,
    cy: number,
    r: number,
    lite: string,
    mid: string,
    deep: string,
  ): void {
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
        r,
      );
      g.addColorStop(0, lite);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
    } catch {
      ctx.fillStyle = mid;
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.22, cy - r * 0.32, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCuteSnowman(x: number, y: number, w: number, h: number): void {
    const { ctx } = this;
    const s = Math.min(w, h);
    const cx = x + w * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(70, 100, 130, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.93, s * 0.34, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    const baseR = s * 0.3;
    const midR = s * 0.23;
    const headR = s * 0.175;
    const baseY = y + h * 0.74;
    const midY = y + h * 0.48;
    const headY = y + h * 0.26;

    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = Math.max(2.2, s * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - midR * 0.85, midY);
    ctx.quadraticCurveTo(cx - s * 0.42, midY - s * 0.02, cx - s * 0.46, midY - s * 0.16);
    ctx.moveTo(cx + midR * 0.85, midY);
    ctx.quadraticCurveTo(cx + s * 0.4, midY + s * 0.02, cx + s * 0.48, midY - s * 0.12);
    ctx.stroke();

    this.fillCuteBall(cx, baseY, baseR, '#ffffff', '#eef7ff', '#b9d0e4');
    this.fillCuteBall(cx, midY, midR, '#ffffff', '#f4fbff', '#c4d8ea');
    this.fillCuteBall(cx, headY, headR, '#ffffff', '#f7fcff', '#cddcea');

    ctx.fillStyle = '#1f2933';
    for (const t of [-0.06, 0.02, 0.1] as const) {
      ctx.beginPath();
      ctx.arc(cx, midY + s * t, s * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ff6b8a';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(cx - headR * 0.42, headY + headR * 0.18, headR * 0.18, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + headR * 0.42, headY + headR * 0.18, headR * 0.18, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#2b3540';
    ctx.beginPath();
    ctx.arc(cx - headR * 0.28, headY - headR * 0.08, headR * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + headR * 0.28, headY - headR * 0.08, headR * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - headR * 0.24, headY - headR * 0.12, headR * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + headR * 0.32, headY - headR * 0.12, headR * 0.035, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.01, headY + headR * 0.02);
    ctx.lineTo(cx + headR * 0.72, headY + headR * 0.12);
    ctx.lineTo(cx - s * 0.01, headY + headR * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffc48a';
    ctx.beginPath();
    ctx.arc(cx + headR * 0.18, headY + headR * 0.1, s * 0.012, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e85d4c';
    ctx.beginPath();
    ctx.ellipse(cx, midY - midR * 0.72, s * 0.2, s * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx + s * 0.08, midY - midR * 0.7, s * 0.09, s * 0.16);

    const brimW = headR * 1.35;
    const hatY = headY - headR * 0.72;
    ctx.fillStyle = '#3d4f6f';
    ctx.beginPath();
    ctx.ellipse(cx, hatY + headR * 0.12, brimW, headR * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4c6488';
    this.roundRectPath(
      cx - headR * 0.62,
      hatY - headR * 0.55,
      headR * 1.24,
      headR * 0.72,
      headR * 0.16,
    );
    ctx.fill();
    ctx.fillStyle = '#ffd56a';
    ctx.fillRect(cx - headR * 0.62, hatY - headR * 0.08, headR * 1.24, headR * 0.12);
    ctx.restore();
  }

  private drawCutePenguin(x: number, y: number, w: number, h: number): void {
    const { ctx } = this;
    const s = Math.min(w * 1.15, h);
    const cx = x + w * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(40, 60, 90, 0.16)';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.94, s * 0.28, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyY = y + h * 0.58;
    const headY = y + h * 0.26;
    const bodyR = s * 0.3;

    ctx.fillStyle = '#1a2740';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.3, bodyY + s * 0.02, s * 0.1, s * 0.16, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.3, bodyY + s * 0.02, s * 0.1, s * 0.16, 0.45, 0, Math.PI * 2);
    ctx.fill();

    this.fillCuteBall(cx, bodyY, bodyR, '#3a4d6b', '#24344f', '#152033');
    ctx.fillStyle = '#fff8ef';
    ctx.beginPath();
    ctx.ellipse(cx, bodyY + s * 0.04, s * 0.18, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    this.fillCuteBall(cx, headY, s * 0.2, '#4a5f80', '#2a3b56', '#182436');
    ctx.fillStyle = '#fff8ef';
    ctx.beginPath();
    ctx.ellipse(cx, headY + s * 0.04, s * 0.13, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff8aa8';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.11, headY + s * 0.06, s * 0.045, s * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.11, headY + s * 0.06, s * 0.045, s * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.07, headY - s * 0.02, s * 0.055, s * 0.062, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.07, headY - s * 0.02, s * 0.055, s * 0.062, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b2433';
    ctx.beginPath();
    ctx.arc(cx - s * 0.065, headY - s * 0.015, s * 0.028, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.075, headY - s * 0.015, s * 0.028, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - s * 0.055, headY - s * 0.03, s * 0.01, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.085, headY - s * 0.03, s * 0.01, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.055, headY + s * 0.05);
    ctx.quadraticCurveTo(cx, headY + s * 0.13, cx + s * 0.055, headY + s * 0.05);
    ctx.quadraticCurveTo(cx, headY + s * 0.075, cx - s * 0.055, headY + s * 0.05);
    ctx.fill();

    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.1, y + h * 0.9, s * 0.1, s * 0.045, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.1, y + h * 0.9, s * 0.1, s * 0.045, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private getDisplayCloud(board: BoardModel, row: number, col: number): number {
    return this.getDisplayCoverLayers(
      this.animCloudStart ?? this.pendingPlayback?.cloud,
      board.getCloud(row, col),
      row * board.size.cols + col,
      'chippedCloudIndices',
    );
  }

  private getDisplayIce(board: BoardModel, row: number, col: number): number {
    return this.getDisplayCoverLayers(
      this.animIceStart ?? this.pendingPlayback?.ice,
      board.getIce(row, col),
      row * board.size.cols + col,
      'clearedIndices',
    );
  }

  private getDisplayEgg(board: BoardModel, row: number, col: number): number {
    return this.getDisplayCoverLayers(
      this.animEggStart ?? this.pendingPlayback?.egg,
      board.getEgg(row, col),
      row * board.size.cols + col,
      'chippedEggIndices',
    );
  }

  private getDisplayVine(board: BoardModel, row: number, col: number): number {
    return this.getDisplayCoverLayers(
      this.animVineStart ?? this.pendingPlayback?.vine,
      board.getVine(row, col),
      row * board.size.cols + col,
      'chippedVineIndices',
    );
  }

  private getDisplayCoverLayers(
    snapshot: Uint8Array | null | undefined,
    live: number,
    index: number,
    chipKey: 'chippedCloudIndices' | 'chippedEggIndices' | 'chippedVineIndices' | 'clearedIndices',
  ): number {
    if (!snapshot) {
      return live;
    }
    let layers = snapshot[index] ?? 0;
    if (!this.animator.isPlaying()) {
      return layers;
    }
    const done = this.animator.getClearedWaveCount();
    const waves =
      this.animCloudWaves.length > 0 ? this.animCloudWaves : this.pendingPlayback?.waves ?? [];
    for (let w = 0; w < done; w += 1) {
      const hits = waves[w]?.[chipKey];
      if (hits && hits.includes(index)) {
        layers = Math.max(0, layers - 1);
      }
    }
    return layers;
  }

  private drawCloudOverlays(
    board: BoardModel,
    layout: { cellSize: number; originX: number; originY: number },
  ): void {
    const { ctx } = this;
    const cs = layout.cellSize;
    const slotR = Math.max(6, Math.floor(cs * 0.18));
    const cloudy: Array<{ r: number; c: number; layers: number }> = [];
    const keyOf = (r: number, c: number) => r * board.size.cols + c;
    const layerAt = new Map<number, number>();
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

    const cloudyAt = (row: number, col: number) => layerAt.has(keyOf(row, col));

    // 四连通成片，相邻棉花合成一块云
    const visited = new Set<number>();
    const blobs: Array<Array<{ r: number; c: number; layers: number }>> = [];
    for (const seed of cloudy) {
      const sk = keyOf(seed.r, seed.c);
      if (visited.has(sk)) {
        continue;
      }
      const blob: Array<{ r: number; c: number; layers: number }> = [];
      const queue = [seed];
      visited.add(sk);
      while (queue.length > 0) {
        const cur = queue.pop()!;
        blob.push(cur);
        const nbs: Array<[number, number]> = [
          [cur.r + 1, cur.c],
          [cur.r - 1, cur.c],
          [cur.r, cur.c + 1],
          [cur.r, cur.c - 1],
        ];
        for (const [nr, nc] of nbs) {
          const nk = keyOf(nr, nc);
          if (visited.has(nk) || !layerAt.has(nk)) {
            continue;
          }
          visited.add(nk);
          queue.push({ r: nr, c: nc, layers: layerAt.get(nk)! });
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

      // 整片底雾，把格缝糊成一块
      const wornBlob = blob.every((cell) => cell.layers <= 1);
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      const span = Math.max(maxX - minX, maxY - minY);
      const sheet = ctx.createRadialGradient(midX, midY - span * 0.08, span * 0.05, midX, midY, span * 0.72);
      if (wornBlob) {
        sheet.addColorStop(0, 'rgba(255,255,255,0.5)');
        sheet.addColorStop(0.55, 'rgba(234,242,250,0.32)');
        sheet.addColorStop(1, 'rgba(214,226,240,0.1)');
      } else {
        sheet.addColorStop(0, 'rgba(255,255,255,0.82)');
        sheet.addColorStop(0.5, 'rgba(238,246,252,0.62)');
        sheet.addColorStop(1, 'rgba(216,228,242,0.2)');
      }
      ctx.fillStyle = sheet;
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

      // 格心棉团 + 邻格桥接，视觉连成一片
      for (const cell of blob) {
        const cx = layout.originX + (cell.c + 0.5) * cs;
        const cy = layout.originY - (cell.r + 0.5) * cs;
        this.drawThickCotton(cx, cy, cs * 1.12, cell.r, cell.c, cell.layers);
        // 只向右 / 上桥接，避免重复画
        if (cloudyAt(cell.r, cell.c + 1)) {
          this.drawThickCotton(
            cx + cs * 0.5,
            cy,
            cs * 0.88,
            cell.r,
            cell.c + 17,
            Math.min(cell.layers, layerAt.get(keyOf(cell.r, cell.c + 1)) ?? cell.layers),
          );
        }
        if (cloudyAt(cell.r + 1, cell.c)) {
          this.drawThickCotton(
            cx,
            cy - cs * 0.5,
            cs * 0.88,
            cell.r + 17,
            cell.c,
            Math.min(cell.layers, layerAt.get(keyOf(cell.r + 1, cell.c)) ?? cell.layers),
          );
        }
      }
      ctx.restore();
    }
  }

  /** 往当前 path 追加圆角矩形子路径（不 beginPath），用于棉花并集裁剪。 */
  private appendRoundRectPath(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
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

  private drawThickCotton(
    cx: number,
    cy: number,
    s: number,
    row: number,
    col: number,
    layers = 2,
  ): void {
    const { ctx } = this;
    const worn = layers <= 1;
    ctx.save();
    ctx.globalAlpha = worn ? 0.52 : 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 中心蓬松底光，让整团有厚度
    const core = ctx.createRadialGradient(
      cx - s * 0.12,
      cy - s * 0.18,
      s * 0.06,
      cx,
      cy,
      s * 0.5,
    );
    core.addColorStop(0, worn ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.92)');
    core.addColorStop(0.5, worn ? 'rgba(236,244,252,0.34)' : 'rgba(232,242,252,0.55)');
    core.addColorStop(1, 'rgba(200,214,232,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 粉彩棉团：左上高光 + 右下柔阴影，对齐萌宠球的立体感
    const pastels: Array<[number, number, number]> = [
      [255, 246, 250],
      [234, 246, 255],
      [236, 252, 244],
      [246, 238, 255],
      [255, 250, 236],
      [240, 248, 255],
    ];
    const puffCount = worn ? 5 : 7;
    for (let i = 0; i < puffCount; i += 1) {
      const u = this.cottonHash(row, col, i);
      const v = this.cottonHash(row, col, i + 18);
      const w = this.cottonHash(row, col, i + 36);
      const px = cx + (u - 0.5) * s * 0.52;
      const py = cy + (v - 0.5) * s * 0.5;
      const pr = s * (0.2 + w * 0.17);
      const [pr_, pg, pb] = pastels[i % pastels.length]!;
      const hx = px - pr * 0.32;
      const hy = py - pr * 0.38;
      const g = ctx.createRadialGradient(hx, hy, pr * 0.06, px + pr * 0.08, py + pr * 0.18, pr);
      g.addColorStop(0, `rgba(255,255,255,${worn ? 0.88 : 1})`);
      g.addColorStop(
        0.42,
        `rgba(${pr_}, ${pg}, ${pb}, ${worn ? 0.72 : 0.94})`,
      );
      g.addColorStop(
        0.82,
        `rgba(${Math.max(180, pr_ - 36)}, ${Math.max(190, pg - 28)}, ${Math.max(205, pb - 18)}, ${worn ? 0.28 : 0.48})`,
      );
      g.addColorStop(1, 'rgba(186, 200, 218, 0.02)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();

      // 顶部小高光点，蹭一点糖果质感
      if (!worn || i % 2 === 0) {
        ctx.fillStyle = `rgba(255,255,255,${worn ? 0.45 : 0.7})`;
        ctx.beginPath();
        ctx.arc(hx + pr * 0.08, hy + pr * 0.1, pr * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 柔边丝光：短弧代替硬划线，更像绒毛反光
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

    // 细碎亮点
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
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  private cottonHash(row: number, col: number, salt: number): number {
    const n = Math.sin(row * 12.9898 + col * 78.233 + salt * 37.719) * 43758.5453;
    return n - Math.floor(n);
  }

  private drawEggAndVineOverlays(
    board: BoardModel,
    layout: { cellSize: number; originX: number; originY: number },
  ): void {
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

  private drawEggShell(x: number, y: number, s: number, layers: number): void {
    const { ctx } = this;
    const cx = x + s * 0.5;
    const cy = y + s * 0.52;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.92, 1.14);
    ctx.fillStyle = layers > 1 ? '#fff4d6' : '#ffe8b0';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 168, 80, 0.95)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(-s * 0.1, -s * 0.1, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    if (layers <= 1) {
      ctx.strokeStyle = 'rgba(120, 80, 30, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 0.22);
      ctx.lineTo(-s * 0.02, -s * 0.04);
      ctx.lineTo(-s * 0.12, s * 0.12);
      ctx.moveTo(s * 0.1, -s * 0.18);
      ctx.lineTo(s * 0.04, s * 0.02);
      ctx.stroke();
      ctx.fillStyle = '#f4c430';
      ctx.beginPath();
      ctx.arc(0, s * 0.08, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d3d3d';
      ctx.beginPath();
      ctx.arc(-s * 0.04, s * 0.06, s * 0.018, 0, Math.PI * 2);
      ctx.arc(s * 0.04, s * 0.06, s * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawVineWrap(
    x: number,
    y: number,
    s: number,
    layers: number,
    row: number,
    col: number,
    board: BoardModel,
  ): void {
    const { ctx } = this;
    const cx = x + s * 0.5;
    const cy = y + s * 0.5;
    const thick = layers > 1;
    const h = (salt: number) => this.cottonHash(row, col, salt);
    const palette = thick
      ? ['#14532d', '#1b4332', '#166534', '#1e5631']
      : ['#1b4332', '#2d6a4f', '#14532d', '#1e5631'];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const rings = thick ? 2 : 1;
    for (let ring = 0; ring < rings; ring += 1) {
      const pad = s * (ring === 0 ? 0.2 : 0.28);
      const box = s - pad * 2;
      const x0 = x + pad;
      const y0 = y + pad;
      const radius = box * 0.28;
      this.roundRectPath(x0, y0, box, box, radius);
      ctx.fillStyle = thick ? 'rgba(20, 64, 40, 0.08)' : 'rgba(27, 67, 50, 0.06)';
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
          palette[(i + ring) % palette.length]!,
        );
      }
    }
    const links: Array<{ tx: number; ty: number }> = [];
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
        this.drawRoseLeaf(lx, ly, s * 0.12, s * 0.052, ang, palette[i % palette.length]!);
      }
    }
    ctx.restore();
  }

  private sampleRoundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    t: number,
  ): { x: number; y: number; ang: number } {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    const straightW = Math.max(0, w - rr * 2);
    const straightH = Math.max(0, h - rr * 2);
    const arc = (Math.PI * 0.5) * rr;
    const perim = straightW * 2 + straightH * 2 + arc * 4;
    let d = ((t % 1) + 1) % 1 * perim;
    if (d <= straightW) {
      return { x: x + rr + d, y, ang: 0 };
    }
    d -= straightW;
    if (d <= arc) {
      const a = -Math.PI * 0.5 + (d / arc) * (Math.PI * 0.5);
      return { x: x + w - rr + Math.cos(a) * rr, y: y + rr + Math.sin(a) * rr, ang: a + Math.PI * 0.5 };
    }
    d -= arc;
    if (d <= straightH) {
      return { x: x + w, y: y + rr + d, ang: Math.PI * 0.5 };
    }
    d -= straightH;
    if (d <= arc) {
      const a = (d / arc) * (Math.PI * 0.5);
      return { x: x + w - rr + Math.cos(a) * rr, y: y + h - rr + Math.sin(a) * rr, ang: a + Math.PI * 0.5 };
    }
    d -= arc;
    if (d <= straightW) {
      return { x: x + w - rr - d, y: y + h, ang: Math.PI };
    }
    d -= straightW;
    if (d <= arc) {
      const a = Math.PI * 0.5 + (d / arc) * (Math.PI * 0.5);
      return { x: x + rr + Math.cos(a) * rr, y: y + h - rr + Math.sin(a) * rr, ang: a + Math.PI * 0.5 };
    }
    d -= arc;
    if (d <= straightH) {
      return { x, y: y + h - rr - d, ang: -Math.PI * 0.5 };
    }
    d -= straightH;
    const a = Math.PI + (d / Math.max(arc, 0.0001)) * (Math.PI * 0.5);
    return { x: x + rr + Math.cos(a) * rr, y: y + rr + Math.sin(a) * rr, ang: a + Math.PI * 0.5 };
  }

  /** 卡通圆润叶，沿圆角方框包裹小动物。 */
  private drawRoseLeaf(x: number, y: number, len: number, wid: number, ang: number, color: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(10, 36, 22, 0.7)';
    ctx.lineWidth = Math.max(1, wid * 0.14);
    ctx.beginPath();
    ctx.moveTo(0, wid * 0.12);
    ctx.bezierCurveTo(wid * 1.15, -len * 0.18, wid * 0.95, -len * 0.62, 0, -len);
    ctx.bezierCurveTo(-wid * 0.95, -len * 0.62, -wid * 1.15, -len * 0.18, 0, wid * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(200, 230, 190, 0.16)';
    this.fillEllipse(wid * 0.12, -len * 0.4, wid * 0.22, len * 0.18, -0.15);
    ctx.strokeStyle = 'rgba(186, 220, 170, 0.2)';
    ctx.lineWidth = Math.max(0.6, wid * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.08);
    ctx.quadraticCurveTo(wid * 0.06, -len * 0.45, 0, -len * 0.78);
    ctx.stroke();
    ctx.restore();
  }

  private drawAnimatedTiles(layout: {
    cellSize: number;
    originX: number;
    originY: number;
  }): void {
    const visuals = this.animator.getVisualTiles();
    const now = this.nowMs || Date.now();
    for (const tile of visuals) {
      if (tile.kind === TileKind.Empty || tile.kind === TileKind.Hole) {
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
        now,
      );
    }
  }

  private drawTileAt(
    x: number,
    y: number,
    cellSize: number,
    kind: TileKind,
    alpha: number,
    scale: number,
    sparkle = false,
    nowMs = Date.now(),
  ): void {
    if (kind === TileKind.Empty || kind === TileKind.Hole) {
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

    if (kind === TileKind.ColorBomb) {
      this.drawOwlAura(cx, cy, size, nowMs, alpha);
    }
    if (sparkle) {
      this.drawSparkleGlowBehind(cx, cy, size, nowMs, alpha);
    }

    const sprite = this.tileImages.get(kind);
    if (sprite) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillStyle = '#6b4a32';
      ctx.translate(cx, cy + size * 0.34);
      ctx.scale(1, 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = alpha;
      this.drawTileSprite(sprite, x + pad, y + pad, size);
    } else if (kind === TileKind.ColorBomb) {
      this.drawSuperOwlTile(cx, cy, size);
    } else {
      ctx.fillStyle = TILE_FALLBACK_COLORS[kind] ?? '#666';
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
  private drawOwlAura(
    cx: number,
    cy: number,
    size: number,
    nowMs: number,
    alpha: number,
  ): void {
    const { ctx } = this;
    const pulse = 0.7 + 0.3 * Math.sin(nowMs * 0.01);
    const r = size * (0.58 + 0.04 * pulse);
    ctx.save();
    ctx.globalAlpha = alpha * 0.55 * pulse;
    const glow = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, r);
    glow.addColorStop(0, 'rgba(200, 180, 255, 0.55)');
    glow.addColorStop(0.45, 'rgba(120, 220, 255, 0.28)');
    glow.addColorStop(1, 'rgba(100, 255, 200, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 闪光块背后：金光脉冲晕 */
  private drawSparkleGlowBehind(
    cx: number,
    cy: number,
    size: number,
    nowMs: number,
    alpha: number,
  ): void {
    const { ctx } = this;
    const pulse = 0.65 + 0.35 * Math.sin(nowMs * 0.028);
    const glowR = size * (0.7 + 0.1 * pulse);
    ctx.save();
    ctx.globalAlpha = alpha * pulse;
    ctx.fillStyle = 'rgba(255, 220, 80, 0.42)';
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 闪光块前景：亮环 + 闪点 */
  private drawSparkleGlowFront(
    cx: number,
    cy: number,
    size: number,
    nowMs: number,
    alpha: number,
  ): void {
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
  private drawSparkleStar(x: number, y: number, r: number, intensity: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.55 + 0.45 * intensity);

    // 柔光底
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.35, 'rgba(255, 240, 150, 0.75)');
    glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // 菱形十字星（尖角）
    const tip = r;
    const mid = r * 0.22;
    ctx.fillStyle = '#ffffff';
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

    // 核心亮点
    ctx.fillStyle = 'rgba(255, 255, 220, 0.95)';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.2, r * 0.18), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 五连合成：超级猫头鹰（魔力鸟） */
  private drawSuperOwlTile(cx: number, cy: number, size: number): void {
    const { ctx } = this;
    const r = size * 0.44;

    const ring = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    ring.addColorStop(0, '#a29bfe');
    ring.addColorStop(0.5, '#74b9ff');
    ring.addColorStop(1, '#55efc4');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, size * 0.05);
    ctx.stroke();

    // 脸（圆）
    ctx.fillStyle = '#6c5ce7';
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.02, r * 0.58, 0, Math.PI * 2);
    ctx.fill();

    // 耳羽
    ctx.fillStyle = '#a29bfe';
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
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - eyeDx, eyeY, size * 0.11, 0, Math.PI * 2);
    ctx.arc(cx + eyeDx, eyeY, size * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(cx - eyeDx, eyeY, size * 0.055, 0, Math.PI * 2);
    ctx.arc(cx + eyeDx, eyeY, size * 0.055, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fdcb6e';
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.02);
    ctx.lineTo(cx - size * 0.07, cy + size * 0.14);
    ctx.lineTo(cx + size * 0.07, cy + size * 0.14);
    ctx.closePath();
    ctx.fill();
  }

  private drawSelectionRing(
    x: number,
    y: number,
    cellSize: number,
    nowMs = Date.now(),
    pressing = false,
  ): void {
    const { ctx } = this;
    const pad = Math.max(2, Math.floor(cellSize * 0.04));
    const size = cellSize - pad * 2;
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    const pulse = 0.52 + 0.06 * Math.sin(nowMs * 0.016);
    const radius = size * (pressing ? pulse + 0.05 : pulse);

    // 外发光（更明显）
    ctx.save();
    ctx.globalAlpha = pressing ? 0.5 : 0.36;
    ctx.fillStyle = '#ff8fc8';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 旋转虚线外环，增强选中炫感（不用 setLineDash，兼容微信类型）
    ctx.save();
    const dashAlpha = 0.55 + 0.25 * Math.sin(nowMs * 0.02);
    ctx.strokeStyle = `rgba(255, 230, 120, ${dashAlpha})`;
    ctx.lineWidth = 2.2;
    const outerR = radius + 10;
    const start = nowMs * 0.004;
    for (let i = 0; i < 10; i += 1) {
      const a0 = start + (i / 10) * Math.PI * 2;
      const a1 = a0 + Math.PI * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, a0, a1);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = pressing ? 4.5 : 3.8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff4fa3';
    ctx.lineWidth = pressing ? 2.8 : 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    this.drawSparkleStar(cx + radius * 0.72, cy - radius * 0.55, 3.5, 0.85);
  }

  /** 粉碎爆炸扩散圈 + 飘分 + 火花 */
  private drawCrushOverlays(): void {
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

      // 被粉碎格子闪光
      for (const cell of burst.clearedCells) {
        const px = layout.originX + cell.col * layout.cellSize;
        const py = layout.originY - (cell.row + 1) * layout.cellSize;
        const flash = Math.max(0, 1 - t * 1.6);
        if (flash <= 0) {
          continue;
        }
        ctx.save();
        ctx.globalAlpha = flash * 0.75;
        ctx.fillStyle = '#fff6c8';
        ctx.fillRect(px + 2, py + 2, layout.cellSize - 4, layout.cellSize - 4);
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(255, 255, 220, 1)');
      grad.addColorStop(0.28, 'rgba(255, 180, 90, 0.75)');
      grad.addColorStop(0.55, 'rgba(255, 110, 170, 0.45)');
      grad.addColorStop(1, 'rgba(255, 40, 80, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // 第二层粉心环
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

      // 中心冲击点
      ctx.globalAlpha = (1 - t) * 0.95;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, layout.cellSize * 0.2 * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
      if (t < 0.45) {
        this.drawSparkleStar(cx, cy, layout.cellSize * 0.22 * (1 - t), 1);
      }
      ctx.restore();
    }

    // 火花
    for (const spark of this.crushSparks) {
      this.drawJuiceSpark(spark, now, 60);
    }

    // 飘分
    for (const pop of this.floatingScores) {
      this.drawFloatingScorePop(pop, now, 46);
    }
  }

  /** 对局消除特效层：火花 + 飘分（复用粉碎粒子池） */
  private drawMatchJuiceOverlays(): void {
    const now = this.nowMs || Date.now();
    for (const spark of this.crushSparks) {
      this.drawJuiceSpark(spark, now, 70);
    }
    for (const pop of this.floatingScores) {
      this.drawFloatingScorePop(pop, now, 52);
    }
  }

  private drawJuiceSpark(spark: CrushSpark, now: number, gravity: number): void {
    const { ctx } = this;
    const t = Math.min(1, (now - spark.startMs) / spark.durationMs);
    const life = now - spark.startMs;
    const x = spark.x + spark.vx * (life / 1000);
    const y = spark.y + spark.vy * (life / 1000) + gravity * (life / 1000) * (life / 1000);
    const style = spark.style ?? 'dot';
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.96;
    ctx.fillStyle = spark.color;
    if (style === 'star') {
      this.drawSparkleStar(x, y, 3.2 + (1 - t) * 3.2, 1 - t);
    } else if (style === 'streak') {
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

  private drawFloatingScorePop(pop: FloatingScorePop, now: number, rise: number): void {
    const { ctx } = this;
    const t = Math.min(1, (now - pop.startMs) / pop.durationMs);
    const y = pop.y - t * rise;
    const scale = 1 + Math.sin(Math.min(1, t * 3.2) * Math.PI) * 0.34;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.translate(pop.x, y);
    ctx.scale(scale, scale);
    ctx.font = pop.fontSize
      ? `bold ${pop.fontSize}px sans-serif`
      : pop.text.startsWith('+')
        ? 'bold 26px sans-serif'
        : 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(40,20,50,0.92)';
    ctx.lineWidth = pop.fontSize ? 7 : 4.5;
    ctx.strokeText(pop.text, 0, 0);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, 0, 0);
    ctx.restore();
  }

  /** 首次点击前的引导条 */
  private drawCrushGuide(): void {
    if (this.crushHasTapped) {
      return;
    }
    const { ctx, width } = this;
    const now = this.nowMs || Date.now();
    const pulse = 0.65 + Math.sin(now * 0.008) * 0.35;
    const y = this.getHudBottom() + 6;
    const w = Math.min(300, width - 32);
    const x = (width - w) / 2;
    const h = 34;
    ctx.save();
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    const fill =
      this.mode === 'clean' ? 'rgba(51, 154, 240, 0.94)' : 'rgba(255, 90, 120, 0.94)';
    this.drawHudPill(x, y, w, h, fill, '#ffffff');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(80,20,40,0.35)';
    ctx.lineWidth = 3;
    const tip =
      this.mode === 'clean'
        ? '✨ 点格子清扫小动物！'
        : '✨ 点格子粉碎动物拿加分！';
    ctx.strokeText(tip, width / 2, y + h / 2);
    ctx.fillText(tip, width / 2, y + h / 2);
    ctx.restore();
  }

  /** 粉碎底部操作：加时 / 领取结算 */
  private drawCrushChrome(): void {
    const { width, height } = this;
    const nav = this.getNavChipFrame();
    const y = height - 72;
    const gap = 10;
    const left = nav.x + nav.w + 8;
    const right = width - 16;
    const btnW = Math.min(150, Math.max(88, (right - left - gap) / 2));
    const x0 = left;

    const extendBtn: UiButton = {
      id: 'crush_extend',
      x: x0,
      y,
      w: btnW,
      h: 44,
      label: '看广告+5秒',
    };
    const skipBtn: UiButton = {
      id: 'crush_skip',
      x: x0 + btnW + gap,
      y,
      w: btnW,
      h: 44,
      label: '领取奖励',
    };
    this.buttons.push(extendBtn, skipBtn);
    this.drawCuteButton(extendBtn, {
      top: '#66d9e8',
      bottom: '#1098ad',
      border: '#ffffff',
      gloss: true,
    });
    this.drawCuteButton(skipBtn, {
      top: '#74c0fc',
      bottom: '#1c7ed6',
      border: '#ffffff',
      gloss: true,
    });
  }

  /** 清洁模式底部：结束清洁 */
  private drawCleanChrome(): void {
    const { width, height } = this;
    const btn: UiButton = {
      id: 'clean_skip',
      x: width / 2 - 100,
      y: height - 72,
      w: 200,
      h: 44,
      label: '结束清洁',
    };
    this.buttons.push(btn);
    this.drawCuteButton(btn, {
      top: '#74c0fc',
      bottom: '#339af0',
      border: '#ffffff',
      gloss: true,
    });
  }

  private loadTileImage(kind: number, src: string): Promise<void> {
    return new Promise((resolve) => {
      const img = this.createImage();
      if (!img) {
        console.warn('[crush-crush] createImage unavailable, fallback colors');
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
        console.warn('[crush-crush] tile load timeout', src);
        finish();
      }, 8000);
      img.onload = () => {
        clearTimeout(timer);
        this.tileImages.set(kind, img);
        finish();
      };
      img.onerror = () => {
        clearTimeout(timer);
        console.warn('[crush-crush] failed to load tile', src);
        finish();
      };
      img.src = src;
    });
  }

  private loadBgImage(src: string): Promise<WxImage | null> {
    return new Promise((resolve) => {
      const img = this.createImage();
      if (!img) {
        resolve(null);
        return;
      }
      let settled = false;
      const finish = (value: WxImage | null) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };
      const timer = setTimeout(() => {
        console.warn('[crush-crush] bg load timeout', src);
        finish(null);
      }, 8000);
      img.onload = () => {
        clearTimeout(timer);
        finish(img);
      };
      img.onerror = () => {
        clearTimeout(timer);
        console.warn('[crush-crush] failed to load bg', src);
        finish(null);
      };
      img.src = src;
    });
  }

  private createImage(): WxImage | null {
    if (typeof wx.createImage === 'function') {
      return wx.createImage();
    }
    const canvasImg = this.canvas as WxCanvas & {
      createImage?: () => WxImage;
    };
    if (typeof canvasImg.createImage === 'function') {
      return canvasImg.createImage();
    }
    return null;
  }

  private drawResultOverlay(): void {
    const { ctx, width, height } = this;
    const now = this.nowMs || Date.now();
    const anim = this.resultFx.getLayout(now);
    const isFail =
      this.pendingResult === 'failed' ||
      this.session.fsm.getCurrent() === 'LevelFailed';

    // 遮罩淡入（胜利弹窗稍深一点，突出居中卡片）
    ctx.fillStyle = `rgba(40, 20, 50, ${anim.veilAlpha * (isFail ? 1 : 0.72)})`;
    ctx.fillRect(0, 0, width, height);
    this.resultFx.drawParticles(ctx, now);

    // 开场白闪
    if (!isFail && anim.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = anim.flash;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 胜利：优先用庆祝整图（粉横幅叠字 + 勾选主按钮）
    if (!isFail && this.winCelebrate) {
      this.drawWinCelebrateResult(anim, now);
      return;
    }

    const title = isFail ? '差一点点' : '关卡胜利';

    // 标题面板弹性弹出（失败 / 无庆祝图时走旧样式）
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
      fillTop: isFail ? 'rgba(255,255,255,0.97)' : 'rgba(180, 235, 120, 0.98)',
      fillBottom: isFail ? 'rgba(232, 248, 255, 0.95)' : 'rgba(120, 200, 70, 0.96)',
      border: isFail ? '#74c0fc' : '#7bc84a',
      borderWidth: 3,
      shadow: false,
      sparkle: !isFail,
      nowMs: now,
    });

    ctx.save();
    ctx.scale(anim.titleScale, anim.titleScale);
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    ctx.strokeText(title, 0, -14);
    ctx.fillStyle = isFail ? '#1864ab' : '#2d6a1f';
    ctx.fillText(title, 0, -14);
    ctx.restore();

    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = isFail ? '#4dabf7' : '#3d5c2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.scale(anim.scorePunch, anim.scorePunch);
    ctx.fillText(`得分 ${anim.displayScore}`, 0, 18);
    ctx.restore();
    if (isFail) {
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#339af0';
      ctx.fillText('没关系，再试一次就好', 0, 42);
    }
    if (!isFail && crushBonus > 0) {
      const taps =
        this.lastCrushTapCount > 0
          ? this.lastCrushTapCount
          : this.session.getCrushTapCount();
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#1f6b2a';
      ctx.fillText(`粉碎加成 +${crushBonus}`, 0, 36);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#3d6b2e';
      ctx.fillText(
        taps > 0 ? `你点击粉碎了 ${taps} 次` : '收尾爆炸计入加成',
        0,
        54,
      );
    }
    ctx.restore();

    // 按钮错落入场
    const revive = isFail ? this.session.getReviveOffer() : { allowed: false, movesGranted: 0 };
    const y0 = height * 0.5;
    const btns: UiButton[] = [];

    if (!isFail && this.offerCleanPrompt) {
      this.drawCleanOfferButtons(anim, y0 - 8);
      return;
    }

    if (revive.allowed) {
      btns.push({
        id: 'revive',
        x: width / 2 - 100,
        y: y0,
        w: 200,
        h: 44,
        label: `看广告复活 +${revive.movesGranted}步`,
      });
    }
    if (!isFail && this.session.hasNextLevel()) {
      btns.push({
        id: 'next',
        x: width / 2 - 100,
        y: y0 + (btns.length ? 56 : 0),
        w: 200,
        h: 44,
        label: '下一关',
      });
    }
    btns.push({
      id: 'retry',
      x: width / 2 - 100,
      y: y0 + btns.length * 56,
      w: 200,
      h: 44,
      label: '再试一次',
    });
    btns.push({
      id: 'lobby',
      x: width / 2 - 100,
      y: y0 + btns.length * 56,
      w: 200,
      h: 44,
      label: '回大厅',
    });

    this.buttons = btns;
    for (let i = 0; i < btns.length; i += 1) {
      const b = btns[i]!;
      const stagger = clamp01((anim.buttonProgress - i * 0.12) / 0.55);
      const slide = (1 - easeOutBackLocal(stagger)) * 36;
      const palette =
        b.id === 'revive'
          ? { top: '#74c0fc', bottom: '#1c7ed6', border: '#ffffff', gloss: true }
          : b.id === 'next'
            ? { top: '#8ce99a', bottom: '#37b24d', border: '#ffffff', gloss: true }
            : b.id === 'lobby'
              ? { top: '#d0ebff', bottom: '#74c0fc', border: '#ffffff', gloss: true }
              : { top: '#a5d8ff', bottom: '#339af0', border: '#ffffff', gloss: true };
      ctx.save();
      ctx.globalAlpha = stagger;
      this.drawCuteButton(
        { ...b, y: b.y + slide, h: Math.max(b.h, 50) },
        palette,
        0.92 + 0.08 * stagger,
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
  private drawWinCelebrateResult(
    anim: ReturnType<LevelResultFx['getLayout']>,
    now: number,
  ): void {
    const { ctx } = this;
    const img = this.winCelebrate;
    if (!img) {
      return;
    }

    const panel = this.layoutWinCelebratePanel();
    const { card, image } = panel;
    const crushBonus = this.session.getCrushScore();
    const levelId = this.session.getLevelConfig()?.id;

    // 整卡阴影
    ctx.save();
    ctx.globalAlpha = anim.panelAlpha * 0.24;
    ctx.fillStyle = '#5c3d6e';
    this.roundRectPath(card.x + 4, card.y + 8, card.w, card.h, 24);
    ctx.fill();
    ctx.restore();

    // 整卡底板（上图下按钮同一框）
    ctx.save();
    ctx.globalAlpha = anim.panelAlpha;
    ctx.translate(card.cx, card.cy);
    ctx.scale(anim.panelScale, anim.panelScale);
    const lx = -card.w / 2;
    const ly = -card.h / 2;

    this.roundRectPath(lx, ly, card.w, card.h, 24);
    const cardGrad = ctx.createLinearGradient(0, ly, 0, ly + card.h);
    cardGrad.addColorStop(0, 'rgba(255,255,255,0.98)');
    cardGrad.addColorStop(0.55, 'rgba(255,248,255,0.97)');
    cardGrad.addColorStop(1, 'rgba(255,236,245,0.98)');
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 170, 210, 0.95)';
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
      image.h,
    );
    ctx.restore();

    const footY = imgLy + image.h + 2;
    const footH = card.h - (footY - ly) - 8;
    if (footH > 8) {
      const footGrad = ctx.createLinearGradient(0, footY, 0, footY + footH);
      footGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
      footGrad.addColorStop(1, 'rgba(255,230,245,0.55)');
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px sans-serif';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 5;
    const title = levelId ? `第 ${levelId} 关胜利` : '关卡胜利';
    ctx.strokeText(title, 0, -8);
    ctx.fillStyle = '#c2255c';
    ctx.fillText(title, 0, -8);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#a61e4d';
    ctx.save();
    ctx.scale(anim.scorePunch, anim.scorePunch);
    ctx.fillText(`得分 ${anim.displayScore}`, 0, 12);
    ctx.restore();
    if (crushBonus > 0) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#d6336c';
      ctx.fillText(`粉碎加成 +${crushBonus}`, 0, 28);
    }
    ctx.restore();

    const actionTop = panel.actionTop;
    if (this.offerCleanPrompt) {
      this.drawCleanOfferButtons(anim, actionTop, card.w - 28);
      this.resultFx.drawParticles(ctx, now);
      return;
    }

    const btns: UiButton[] = [];
    const primaryId: UiButton['id'] = this.session.hasNextLevel() ? 'next' : 'lobby';
    const mainW = Math.min(200, card.w - 36);
    btns.push({
      id: primaryId,
      x: card.cx - mainW / 2,
      y: actionTop,
      w: mainW,
      h: 44,
      label: primaryId === 'next' ? '下一关' : '回大厅',
    });

    const subY = actionTop + 52;
    const subW = Math.min(128, (card.w - 40) / 2);
    btns.push({
      id: 'retry',
      x: card.cx - subW - 5,
      y: subY,
      w: subW,
      h: 40,
      label: '重玩本关',
    });
    if (primaryId === 'next') {
      btns.push({
        id: 'lobby',
        x: card.cx + 5,
        y: subY,
        w: subW,
        h: 40,
        label: '回大厅',
      });
    }

    this.buttons = btns;
    for (let i = 0; i < btns.length; i += 1) {
      const b = btns[i]!;
      const stagger = clamp01((anim.buttonProgress - i * 0.1) / 0.55);
      const slide = (1 - easeOutBackLocal(stagger)) * 20;
      const palette =
        b.id === 'next'
          ? { top: '#74c0fc', bottom: '#1c7ed6', border: '#ffffff', gloss: true }
          : b.id === 'lobby'
            ? { top: '#d0ebff', bottom: '#74c0fc', border: '#ffffff', gloss: true }
            : { top: '#a5d8ff', bottom: '#339af0', border: '#ffffff', gloss: true };
      ctx.save();
      ctx.globalAlpha = stagger;
      this.drawCuteButton(
        { ...b, y: b.y + slide, h: Math.max(b.h, 44) },
        palette,
        0.94 + 0.06 * stagger,
      );
      ctx.restore();
    }

    this.resultFx.drawParticles(ctx, now);
  }

  /** 统一弹窗布局：上图下按钮；庆祝图顶部空白已裁切 */
  private layoutWinCelebratePanel(): {
    card: { x: number; y: number; w: number; h: number; cx: number; cy: number };
    image: { x: number; y: number; w: number; h: number };
    source: { sx: number; sy: number; sw: number; sh: number };
    actionTop: number;
  } {
    const { width, height } = this;
    const img = this.winCelebrate!;
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
    let imgH = (imgW / sw) * sh;
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
    // 垂直居中（避开状态栏后在可用区内居中）
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
        cy: cardY + cardH / 2,
      },
      image: { x: imageX, y: imageY, w: imgW, h: imgH },
      source: { sx: 0, sy, sw, sh },
      actionTop,
    };
  }

  private drawCleanOfferButtons(
    anim: ReturnType<LevelResultFx['getLayout']>,
    tipY: number,
    maxBtnW = 200,
  ): void {
    const { ctx, width } = this;
    const btnW = Math.min(200, Math.max(160, maxBtnW));
    const btns: UiButton[] = [];
    ctx.save();
    ctx.globalAlpha = anim.buttonProgress;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2b4c7e';
    ctx.fillText('恭喜获得一次清洁机会，是否去清洁？', width / 2, tipY);
    ctx.restore();

    btns.push({
      id: 'clean_yes',
      x: width / 2 - btnW / 2,
      y: tipY + 18,
      w: btnW,
      h: 42,
      label: '去清洁',
    });
    btns.push({
      id: 'clean_no',
      x: width / 2 - btnW / 2,
      y: tipY + 66,
      w: btnW,
      h: 42,
      label: '暂不',
    });

    this.buttons = btns;
    for (let i = 0; i < btns.length; i += 1) {
      const b = btns[i]!;
      const stagger = clamp01((anim.buttonProgress - i * 0.12) / 0.55);
      const slide = (1 - easeOutBackLocal(stagger)) * 22;
      const palette =
        b.id === 'clean_yes'
          ? { top: '#74c0fc', bottom: '#339af0', border: '#ffffff', gloss: true }
          : { top: '#ced4da', bottom: '#adb5bd', border: '#ffffff', gloss: true };
      ctx.save();
      ctx.globalAlpha = stagger;
      this.drawCuteButton(
        { ...b, y: b.y + slide, h: Math.max(b.h, 44) },
        palette,
        0.92 + 0.08 * stagger,
      );
      ctx.restore();
    }
  }

  /**
   * 可爱圆角卡片：渐变填充 + 粗描边 + 高光 + 可选星点。
   */
  private drawCuteCard(
    x: number,
    y: number,
    w: number,
    h: number,
    style: {
      radius: number;
      fillTop: string;
      fillBottom: string;
      border: string;
      borderWidth: number;
      shadow?: boolean;
      sparkle?: boolean;
      sparkleColor?: string;
      nowMs?: number;
    },
  ): void {
    const { ctx } = this;
    const r = style.radius;

    if (style.shadow) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#6b4a8a';
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

    // 顶部高光条
    ctx.save();
    ctx.globalAlpha = 0.55;
    const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.45);
    gloss.addColorStop(0, 'rgba(255,255,255,0.95)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    this.roundRectPath(x + 4, y + 3, w - 8, h * 0.42, Math.max(8, r - 6));
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = style.border;
    ctx.lineWidth = style.borderWidth;
    this.roundRectPath(x + 1, y + 1, w - 2, h - 2, Math.max(4, r - 1));
    ctx.stroke();

    // 内描边更精致
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    this.roundRectPath(x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 6));
    ctx.stroke();

    if (style.sparkle) {
      const t = (style.nowMs ?? 0) * 0.006;
      const dots = [
        { dx: 16, dy: 14 },
        { dx: w - 18, dy: 16 },
        { dx: 20, dy: h - 16 },
        { dx: w - 22, dy: h - 18 },
      ];
      for (let i = 0; i < dots.length; i += 1) {
        const d = dots[i]!;
        const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(t + i));
        ctx.save();
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = style.sparkleColor ?? '#ffd6ef';
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
  private drawCuteButton(
    btn: UiButton,
    palette: {
      top: string;
      bottom: string;
      border: string;
      gloss?: boolean;
      fontSize?: number;
    },
    scale = 1,
  ): void {
    const { ctx } = this;
    const now = this.nowMs || Date.now();
    const idle =
      scale !== 1
        ? scale
        : 1 + this.fxAmt(0.018, 0.01) * Math.sin(now * 0.006 + btn.x * 0.02);
    const cx = btn.x + btn.w / 2;
    const cy = btn.y + btn.h / 2;
    const r = btn.h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(idle, idle);
    ctx.translate(-cx, -cy);

    // 软阴影
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#5b3a6e';
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
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      this.roundRectPath(
        btn.x + insetX,
        btn.y + insetY,
        btn.w - insetX * 2,
        btn.h * 0.38,
        Math.max(btn.h <= 22 ? 4 : 8, r - 8),
      );
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = palette.border;
    ctx.lineWidth = btn.h <= 22 ? 1.5 : 2.5;
    this.roundRectPath(btn.x + 1.5, btn.y + 1.5, btn.w - 3, btn.h - 3, r - 1);
    ctx.stroke();

    if (btn.label) {
      const fontSize =
        palette.fontSize ??
        (btn.h <= 22 ? 11 : btn.h <= 28 ? 12 : btn.h <= 36 ? 15 : 17);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(120,40,90,0.25)';
      ctx.lineWidth = fontSize <= 11 ? 2 : 3;
      ctx.strokeText(btn.label, cx, cy + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(btn.label, cx, cy);
    }

    ctx.restore();
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutBackLocal(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = Math.max(0, Math.min(1, t));
  return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
}

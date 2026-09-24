/**
 * 大厅导航。
 * 左上角竖排：邀请好友 / 怎么玩。
 * 底部：音效开关（左下，与推荐/圈子同高）、领取（满进度时）、推荐 / 圈子。
 * 热区要比绘制更大，并避开 Home 条。
 */
import { lobbyDailyProgress } from '../../logic/economy/DailyLoop';

export const LOBBY_GEAR_SIZE = 34;
/** 左侧入口列表：小胶囊，贴左上角。 */
export const LOBBY_SIDE_ACTION_H = 26;
export const LOBBY_FRIEND_ACTION_H = LOBBY_SIDE_ACTION_H;
export const LOBBY_SOCIAL_ACTION_H = LOBBY_SIDE_ACTION_H;
export const LOBBY_SIDE_ACTION_GAP = 5;
export const LOBBY_SIDE_ACTION_X = 10;
export const LOBBY_SIDE_ACTION_MIN_W = 72;
export const LOBBY_SIDE_ACTION_MAX_W = 86;
/** 侧栏文案字号 */
export const LOBBY_SIDE_ACTION_FONT = 11;
/** 左上角列表：相对状态栏再上移，尽量贴顶 */
export const LOBBY_SIDE_ACTION_TOP_PAD = -6;
/** 底部设置齿轮左边距（与侧栏可不同） */
export const LOBBY_GEAR_X = 12;
/** 底图「萌宠粉碎消」字底约占封面高度的比例（关卡标题区用，侧栏不再参考）。 */
export const LOBBY_TITLE_BOTTOM_RATIO = 142 / 1024;
/** @deprecated 侧栏已改贴左上角，不再相对标题下移 */
export const LOBBY_TITLE_CLEARANCE = 14;

export const LOBBY_NAV_CHIP_H = 36;
export const LOBBY_NAV_CHIP_MIN_W = 68;
export const LOBBY_NAV_HIT_PAD = 16;

export const LOBBY_CLAIM_LABEL = '点击领取 重排 x1';

export interface LobbyGearFrame {
  id: 'settings';
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LobbySideActionId = 'invite' | 'howto' | 'leaderboard';

export interface LobbySideActionFrame {
  id: LobbySideActionId;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LobbyBarFrame {
  id: 'claim_shuffle';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LobbyChipFrame {
  id: 'recommend' | 'club';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LobbyBottomChrome {
  chips: LobbyChipFrame[];
  claim: LobbyBarFrame | null;
  /** 左下角音效槽位（原设置齿轮坐标），与推荐/圈子同一水平线。 */
  settings: LobbyGearFrame;
  /** 底部这一叠的顶边，关卡热区要停在它上面。 */
  contentTop: number;
}

const LOBBY_SIDE_ACTIONS: ReadonlyArray<Pick<LobbySideActionFrame, 'id' | 'label'>> = [
  { id: 'invite', label: '邀请好友' },
  { id: 'leaderboard', label: '好友排行' },
  { id: 'howto', label: '怎么玩' },
];

/**
 * 左侧按钮顶边：尽量贴屏幕最上（状态栏内侧），不跟右侧胶囊底对齐。
 */
export function lobbySideActionsTop(
  statusBarHeight: number,
  _coverDy?: number,
  _coverDh?: number,
): number {
  return Math.max(2, statusBarHeight + LOBBY_SIDE_ACTION_TOP_PAD);
}

/** 与底部胶囊行垂直居中对齐的设置齿轮。 */
export function layoutLobbyGear(chipY: number, chipH = LOBBY_NAV_CHIP_H): LobbyGearFrame {
  return {
    id: 'settings',
    x: LOBBY_GEAR_X,
    y: chipY + Math.max(0, Math.floor((chipH - LOBBY_GEAR_SIZE) / 2)),
    w: LOBBY_GEAR_SIZE,
    h: LOBBY_GEAR_SIZE,
  };
}

/** 首页左侧入口：等宽等高糖果胶囊，不盖住中间关卡条。 */
export function layoutLobbySideActions(
  top: number,
  screenWidth: number,
): LobbySideActionFrame[] {
  const w = Math.min(
    LOBBY_SIDE_ACTION_MAX_W,
    Math.max(LOBBY_SIDE_ACTION_MIN_W, Math.floor(screenWidth * 0.2)),
  );
  let y = top;
  return LOBBY_SIDE_ACTIONS.map((item) => {
    const frame: LobbySideActionFrame = {
      ...item,
      x: LOBBY_SIDE_ACTION_X,
      y,
      w,
      h: LOBBY_SIDE_ACTION_H,
    };
    y += frame.h + LOBBY_SIDE_ACTION_GAP;
    return frame;
  });
}

export function lobbyNavBottomGap(bannerReserve: number, safeBottom: number): number {
  const banner = Math.max(0, bannerReserve);
  const safe = Math.max(0, safeBottom);
  if (banner > 0) {
    return 12 + banner;
  }
  return Math.max(24, safe + 14);
}

/** 底部：设置齿轮、领取（满 3 关时）、推荐 / 圈子。 */
export function layoutLobbyBottom(input: {
  width: number;
  height: number;
  bannerReserve: number;
  safeBottom: number;
  clearsToday: number;
  shuffleGranted: boolean;
}): LobbyBottomChrome {
  const side = 12;
  const gap = 12;
  const chipH = LOBBY_NAV_CHIP_H;
  const bottom = lobbyNavBottomGap(input.bannerReserve, input.safeBottom);
  const chipY = input.height - chipH - bottom;
  const settings = layoutLobbyGear(chipY, chipH);
  const labels: Array<Pick<LobbyChipFrame, 'id' | 'label'>> = [
    { id: 'recommend', label: '推荐' },
    { id: 'club', label: '圈子' },
  ];
  // 只留两个时不要把整行宽度平分，否则按钮会被拉得很宽；左侧给齿轮留空。
  const chipW = Math.min(
    108,
    Math.max(LOBBY_NAV_CHIP_MIN_W, Math.floor(input.width * 0.26)),
  );
  const rowW = labels.length * chipW + (labels.length - 1) * gap;
  const gearRight = settings.x + settings.w + gap;
  const rowX = Math.max(gearRight, Math.floor((input.width - rowW) / 2));
  const chips = labels.map((item, index) => ({
    ...item,
    x: rowX + index * (chipW + gap),
    y: chipY,
    w: chipW,
    h: chipH,
  }));

  const progressState = lobbyDailyProgress(input.clearsToday, input.shuffleGranted);
  const claimH = 36;
  const claim: LobbyBarFrame | null = progressState.readyToClaim
    ? {
        id: 'claim_shuffle',
        label: LOBBY_CLAIM_LABEL,
        x: side,
        y: chipY - gap - claimH,
        w: input.width - side * 2,
        h: claimH,
      }
    : null;

  return {
    chips,
    claim,
    settings,
    contentTop: claim ? claim.y : chipY,
  };
}

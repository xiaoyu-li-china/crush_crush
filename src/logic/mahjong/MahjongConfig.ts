/** 萌宠麻将馆数值与常量（PRD V1.1 + V1.2 运营配置） */

export {
  getMahjongOps,
  getMahjongOpsVersion,
  mahjongCoinCost,
  mahjongCoinPerTriple,
  mahjongStarPerTriple,
  mahjongTimeoutMsForLevel,
  mahjongTileCountForLevel,
  mahjongSeedVersion,
  mahjongGenerationMaxAttempts,
  mahjongStandardTiles,
  mahjongLevel1Tiles,
  isMahjongRewardedVideoSlotEnabled,
} from './MahjongOpsConfig';

export const MAHJONG_BASE_SLOTS = 6;
export const MAHJONG_AD_EXTRA_SLOTS = 1;

/** 槽位已满看广告复活时，从槽位移回牌堆的张数（对齐「移出3张」玩法）。 */
export const MAHJONG_SLOT_FULL_AD_MOVE_COUNT = 3;

/** 任意「重玩本关/重玩」消耗金币（固定 300，与道具兑换价独立）。 */
export const MAHJONG_REPLAY_COIN_COST = 300;

/** 第 2 关起标准关（105 张）可无限递增的关卡号上限（主题在此后循环，生成仍用真实关卡号作种子）。 */
export const MAHJONG_INFINITE_LEVEL_CAP = 50_000;

/** 关卡列表：已解锁关 + 末尾预览锁定关数量（PRD 无限关滚动）。 */
export const MAHJONG_LOBBY_TAIL_LOCKED_LEVELS = 3;

/** 关卡列表一次展示的最大行数（配合 scrollY）。 */
export const MAHJONG_LOBBY_LEVEL_WINDOW = 32;

/** 关卡页可见关卡区间 [start, end]（含端点）。 */
export function mahjongLobbyLevelRange(highestUnlocked: number): { start: number; end: number } {
  const unlocked = Math.max(1, Math.floor(highestUnlocked));
  const end = unlocked + MAHJONG_LOBBY_TAIL_LOCKED_LEVELS;
  const start = Math.max(1, end - MAHJONG_LOBBY_LEVEL_WINDOW + 1);
  return { start, end };
}

/** 全局金币数字后的立体金星（展示用）。 */
export const MAHJONG_GLOBAL_COIN_STAR = '⭐';

export function formatMahjongGlobalCoinAmount(amount: number): string {
  const n = Math.max(0, Math.floor(amount));
  return `${n}${MAHJONG_GLOBAL_COIN_STAR}`;
}

/** 如 `300金币⭐` */
export function formatMahjongGlobalCoinCostLabel(amount: number): string {
  const n = Math.max(0, Math.floor(amount));
  return `${n}金币${MAHJONG_GLOBAL_COIN_STAR}`;
}

export type MahjongToolId = 'move_out' | 'gather' | 'shuffle' | 'reveal';

export const MAHJONG_TOOL_LABELS: Record<MahjongToolId, string> = {
  move_out: '移出',
  gather: '凑齐',
  shuffle: '重排',
  reveal: '翻牌',
};

/** 道具说明弹窗文案（与 tool* 逻辑一致） */
export const MAHJONG_TOOL_DESCRIPTIONS: Record<MahjongToolId, string> = {
  move_out: '将1张牌从槽位移回牌堆',
  gather: '从牌堆凑齐1组槽位同类牌',
  shuffle: '打乱牌堆摆放',
  reveal: '翻开最上层一张扣牌',
};

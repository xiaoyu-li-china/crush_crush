/**
 * 每日任务：每天 4 个任务，首个固定为「通关 3 关」，其余 3 个按日期从任务池里抽。
 * 任务列表由日期算出来，不入档；入档的只有当天计数和已领取标记（挂在 DailyLoopData.tasks 上）。
 * 4 个任务都领完后可开活跃宝箱，看视频可翻倍。
 */
import { TileKind } from '../board/TileType';
import type { BoosterId } from './BoosterInventory';
import { DAILY_GOAL_CLEARS, applyDailyLogin, type DailyLoopData } from './DailyLoop';

export type DailyTaskKind =
  | 'clear_levels'
  | 'clear_tiles'
  | 'make_specials'
  | 'combo_chain'
  | 'crush_rounds'
  | 'collect_kind'
  | 'three_star'
  | 'use_boosters';

export interface DailyTaskReward {
  id: BoosterId;
  amount: number;
}

export interface DailyTaskDef {
  id: DailyTaskKind;
  target: number;
  /** 仅 collect_kind */
  tileKind?: TileKind;
  reward: DailyTaskReward;
}

export interface DailyTaskCounters {
  tiles: number;
  specials: number;
  maxChain: number;
  /** 当日完成并结算的粉碎奖励局数 */
  crushRounds: number;
  /** key 为 TileKind 数值 */
  collected: Record<string, number>;
  threeStars: number;
  boostersUsed: number;
  claimed: DailyTaskKind[];
  chestClaimed: boolean;
}

export interface DailyTaskView extends DailyTaskDef {
  title: string;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export interface DailyTasksView {
  tasks: DailyTaskView[];
  /** 已完成未领取的任务数（含宝箱） */
  claimable: number;
  chestReady: boolean;
  chestClaimed: boolean;
  chest: DailyTaskReward[];
}

export interface DailyTaskStatsPatch {
  tiles?: number;
  specials?: number;
  chain?: number;
  /** 完成一局粉碎奖励（过关后点领取或时间到） */
  crushRound?: boolean;
  collectedKinds?: readonly TileKind[];
  threeStar?: boolean;
  boosterUsed?: boolean;
}

export const DAILY_TASK_COUNT = 4;

/** 四任务全领后的宝箱：单件奖励，看视频双倍（避免一日道具过多）。 */
export const DAILY_CHEST_REWARDS: readonly DailyTaskReward[] = [{ id: 'hammer', amount: 1 }];

export const EMPTY_DAILY_TASK_COUNTERS: DailyTaskCounters = {
  tiles: 0,
  specials: 0,
  maxChain: 0,
  crushRounds: 0,
  collected: {},
  threeStars: 0,
  boostersUsed: 0,
  claimed: [],
  chestClaimed: false,
};

const FIXED_TASK: DailyTaskDef = {
  id: 'clear_levels',
  target: DAILY_GOAL_CLEARS,
  reward: { id: 'shuffle', amount: 1 },
};

/**
 * 随机 3 条：门槛略高于「随便玩几局就能完成」，奖励各 1 个道具。
 * 全完成 + 固定通关 + 登录 + 宝箱 ≈ 日常上限 5～6 个道具（库存仍受 9 封顶）。
 */
const POOL: ReadonlyArray<{
  id: Exclude<DailyTaskKind, 'clear_levels'>;
  targets: readonly number[];
  reward: DailyTaskReward;
}> = [
  { id: 'clear_tiles', targets: [220, 260, 300], reward: { id: 'hammer', amount: 1 } },
  { id: 'make_specials', targets: [4, 5, 6], reward: { id: 'extraMoves', amount: 1 } },
  { id: 'combo_chain', targets: [4], reward: { id: 'extraMoves', amount: 1 } },
  { id: 'crush_rounds', targets: [1], reward: { id: 'extraMoves', amount: 1 } },
  { id: 'collect_kind', targets: [55, 75], reward: { id: 'hammer', amount: 1 } },
  { id: 'three_star', targets: [2, 3], reward: { id: 'hammer', amount: 1 } },
  { id: 'use_boosters', targets: [2, 3], reward: { id: 'shuffle', amount: 1 } },
];

/** 所有关卡都会出现的前 4 种萌宠，收集任务只从这里挑。 */
const COLLECT_KINDS: readonly TileKind[] = [
  TileKind.Red,
  TileKind.Blue,
  TileKind.Green,
  TileKind.Yellow,
];

const KIND_NAME: Partial<Record<number, string>> = {
  [TileKind.Red]: '红狐',
  [TileKind.Blue]: '蓝兔',
  [TileKind.Green]: '绿蛙',
  [TileKind.Yellow]: '黄鸡',
};

const VALID_KINDS = new Set<string>([FIXED_TASK.id, ...POOL.map((item) => item.id)]);

function hashYmd(ymd: string): number {
  let h = 2166136261;
  for (let i = 0; i < ymd.length; i += 1) {
    h ^= ymd.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function nextRand(state: { s: number }): number {
  state.s = (Math.imul(state.s, 1664525) + 1013904223) >>> 0;
  return state.s / 4294967296;
}

/** 当天的任务表：同一天任何设备算出来都一样。 */
export function dailyTasksFor(ymd: string): DailyTaskDef[] {
  const rand = { s: hashYmd(ymd || 'none') || 1 };
  const pool = POOL.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand(rand) * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const picked = pool.slice(0, DAILY_TASK_COUNT - 1).map((item): DailyTaskDef => {
    const target = item.targets[Math.floor(nextRand(rand) * item.targets.length)]!;
    const def: DailyTaskDef = { id: item.id, target, reward: { ...item.reward } };
    if (item.id === 'collect_kind') {
      def.tileKind = COLLECT_KINDS[Math.floor(nextRand(rand) * COLLECT_KINDS.length)]!;
    }
    return def;
  });
  return [{ ...FIXED_TASK, reward: { ...FIXED_TASK.reward } }, ...picked];
}

export function dailyTaskTitle(def: DailyTaskDef): string {
  const t = def.target;
  switch (def.id) {
    case 'clear_levels':
      return `通关 ${t} 关`;
    case 'clear_tiles':
      return `消除萌宠${t}只`;
    case 'make_specials':
      return `合成 ${t} 个闪光或猫头鹰`;
    case 'combo_chain':
      return `一步打出 ${t} 连击`;
    case 'crush_rounds':
      return t <= 1 ? '粉碎1局' : `粉碎${t}局`;
    case 'collect_kind':
      return `收集 ${t} 只${KIND_NAME[def.tileKind ?? TileKind.Red] ?? '萌宠'}`;
    case 'three_star':
      return `三星通关 ${t} 次`;
    case 'use_boosters':
      return `使用道具 ${t} 次`;
    default:
      return '每日任务';
  }
}

function nonNeg(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseDailyTaskCounters(raw: unknown): DailyTaskCounters {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_DAILY_TASK_COUNTERS, collected: {}, claimed: [] };
  }
  const data = raw as Partial<DailyTaskCounters>;
  const collected: Record<string, number> = {};
  if (data.collected && typeof data.collected === 'object') {
    for (const [key, value] of Object.entries(data.collected)) {
      const n = nonNeg(value);
      if (n > 0) {
        collected[key] = n;
      }
    }
  }
  const claimed = Array.isArray(data.claimed)
    ? data.claimed.filter((id): id is DailyTaskKind => typeof id === 'string' && VALID_KINDS.has(id))
    : [];
  return {
    tiles: nonNeg(data.tiles),
    specials: nonNeg(data.specials),
    maxChain: nonNeg(data.maxChain),
    crushRounds: nonNeg(data.crushRounds),
    collected,
    threeStars: nonNeg(data.threeStars),
    boostersUsed: nonNeg(data.boostersUsed),
    claimed: [...new Set(claimed)],
    chestClaimed: !!data.chestClaimed,
  };
}

/** 同一天的两份计数取并集：各项取大，已领取取并。 */
export function mergeDailyTaskCounters(a: unknown, b: unknown): DailyTaskCounters {
  const x = parseDailyTaskCounters(a);
  const y = parseDailyTaskCounters(b);
  const collected: Record<string, number> = { ...x.collected };
  for (const [key, value] of Object.entries(y.collected)) {
    collected[key] = Math.max(collected[key] ?? 0, value);
  }
  return {
    tiles: Math.max(x.tiles, y.tiles),
    specials: Math.max(x.specials, y.specials),
    maxChain: Math.max(x.maxChain, y.maxChain),
    crushRounds: Math.max(x.crushRounds, y.crushRounds),
    collected,
    threeStars: Math.max(x.threeStars, y.threeStars),
    boostersUsed: Math.max(x.boostersUsed, y.boostersUsed),
    claimed: [...new Set([...x.claimed, ...y.claimed])],
    chestClaimed: x.chestClaimed || y.chestClaimed,
  };
}

function progressOf(def: DailyTaskDef, data: DailyLoopData, c: DailyTaskCounters): number {
  switch (def.id) {
    case 'clear_levels':
      return data.clearsToday;
    case 'clear_tiles':
      return c.tiles;
    case 'make_specials':
      return c.specials;
    case 'combo_chain':
      return c.maxChain;
    case 'crush_rounds':
      return c.crushRounds;
    case 'collect_kind':
      return c.collected[String(def.tileKind ?? TileKind.Red)] ?? 0;
    case 'three_star':
      return c.threeStars;
    case 'use_boosters':
      return c.boostersUsed;
    default:
      return 0;
  }
}

function isClaimed(def: DailyTaskDef, data: DailyLoopData, c: DailyTaskCounters): boolean {
  if (c.claimed.includes(def.id)) {
    return true;
  }
  // 旧版「今日 3 关领重排」已领过的，算作本任务已领
  return def.id === 'clear_levels' && !!data.playShuffleGranted;
}

export function viewDailyTasks(data: DailyLoopData): DailyTasksView {
  const counters = parseDailyTaskCounters(data.tasks);
  const tasks = dailyTasksFor(data.ymd).map((def): DailyTaskView => {
    const progress = Math.min(def.target, progressOf(def, data, counters));
    return {
      ...def,
      title: dailyTaskTitle(def),
      progress,
      done: progress >= def.target,
      claimed: isClaimed(def, data, counters),
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
    chest: DAILY_CHEST_REWARDS.map((item) => ({ ...item })),
  };
}

/**
 * 记一笔当天进度。跨天先对齐到新的一天再记。
 * @returns 新数据，以及这次刚好达成的任务（供局内提示）
 */
export function recordDailyTaskStats(
  data: DailyLoopData,
  patch: DailyTaskStatsPatch,
  nowMs: number,
): { data: DailyLoopData; completed: DailyTaskView[] } {
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
      c.collected[key] = (c.collected[key] ?? 0) + 1;
    }
  }
  if (patch.threeStar) {
    c.threeStars += 1;
  }
  if (patch.boosterUsed) {
    c.boostersUsed += 1;
  }
  const next: DailyLoopData = { ...aligned, tasks: c };
  const after = viewDailyTasks(next).tasks;
  const completed = after.filter((task, i) => task.done && !task.claimed && !before[i]!.done);
  return { data: next, completed };
}

export function claimDailyTask(
  data: DailyLoopData,
  taskId: DailyTaskKind,
): { data: DailyLoopData; reward: DailyTaskReward | null } {
  const view = viewDailyTasks(data);
  const task = view.tasks.find((item) => item.id === taskId);
  if (!task || !task.done || task.claimed) {
    return { data, reward: null };
  }
  const c = parseDailyTaskCounters(data.tasks);
  c.claimed = [...c.claimed, task.id];
  const next: DailyLoopData = {
    ...data,
    tasks: c,
    playShuffleGranted: task.id === 'clear_levels' ? true : data.playShuffleGranted,
  };
  return { data: next, reward: { ...task.reward } };
}

export function claimDailyChest(
  data: DailyLoopData,
  doubled: boolean,
): { data: DailyLoopData; rewards: DailyTaskReward[] | null } {
  if (!viewDailyTasks(data).chestReady) {
    return { data, rewards: null };
  }
  const c = parseDailyTaskCounters(data.tasks);
  c.chestClaimed = true;
  const factor = doubled ? 2 : 1;
  return {
    data: { ...data, tasks: c },
    rewards: DAILY_CHEST_REWARDS.map((item) => ({ id: item.id, amount: item.amount * factor })),
  };
}

const BOOSTER_NAME: Record<BoosterId, string> = {
  hammer: '锤子',
  shuffle: '重排',
  extraMoves: '加步',
};

export function formatDailyReward(rewards: readonly DailyTaskReward[]): string {
  return rewards
    .filter((item) => item.amount > 0)
    .map((item) => `${BOOSTER_NAME[item.id]} x${item.amount}`)
    .join('、');
}

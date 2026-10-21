/**
 * 排行榜周结算配置读取。
 * 名次分档奖励读 balance.json，库存封顶走 BoosterEconomy。
 */
import balanceJson from '../../config/balance.json';
import {
  addBoosterToWallet,
} from './BoosterEconomy';
import type { BoosterId, BoosterStock } from './BoosterInventory';

export interface ChallengeGrantSpec {
  id: BoosterId;
  amount: number;
}

export interface LeaderboardRewardTier {
  minRank: number;
  maxRank: number;
  rewards: ChallengeGrantSpec[];
}

export interface LeaderboardConfig {
  limit: number;
  settleWeekday: number;
  settleHour: number;
  tiers: LeaderboardRewardTier[];
}

export interface PlannedLeaderboardGrants {
  grants: ChallengeGrantSpec[];
  wallet: BoosterStock;
  /** 配置里想发、但库存已满、实际没加上的道具 */
  blocked: BoosterId[];
}

const DEFAULT_TIERS: LeaderboardRewardTier[] = [
  { minRank: 1, maxRank: 1, rewards: [{ id: 'hammer', amount: 3 }, { id: 'shuffle', amount: 2 }] },
  { minRank: 2, maxRank: 3, rewards: [{ id: 'hammer', amount: 2 }, { id: 'shuffle', amount: 1 }] },
  { minRank: 4, maxRank: 10, rewards: [{ id: 'hammer', amount: 1 }] },
];

function readSpec(raw: { id?: string; amount?: number } | undefined, fallback: BoosterId): ChallengeGrantSpec {
  const id = raw?.id === 'hammer' || raw?.id === 'shuffle' || raw?.id === 'extraMoves'
    ? raw.id
    : fallback;
  return {
    id,
    amount: Math.max(0, Math.floor(Number(raw?.amount) || 0)),
  };
}

function readTiers(raw: unknown): LeaderboardRewardTier[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_TIERS.map((tier) => ({ ...tier, rewards: tier.rewards.map((r) => ({ ...r })) }));
  }
  const tiers: LeaderboardRewardTier[] = [];
  for (const item of raw as Array<{ minRank?: number; maxRank?: number; rewards?: unknown }>) {
    const minRank = Math.max(1, Math.floor(Number(item?.minRank) || 1));
    const maxRank = Math.max(minRank, Math.floor(Number(item?.maxRank) || minRank));
    const rewards = Array.isArray(item?.rewards)
      ? (item.rewards as Array<{ id?: string; amount?: number }>).map((r) => readSpec(r, 'hammer'))
      : [];
    tiers.push({ minRank, maxRank, rewards: rewards.filter((r) => r.amount > 0) });
  }
  return tiers.sort((a, b) => a.minRank - b.minRank);
}

export function readLeaderboardConfig(): LeaderboardConfig {
  const raw = (balanceJson as { leaderboard?: {
    limit?: number;
    settleWeekday?: number;
    settleHour?: number;
    tiers?: unknown;
  } }).leaderboard;
  return {
    limit: Math.max(1, Math.floor(Number(raw?.limit) || 50)),
    settleWeekday: Math.min(6, Math.max(0, Math.floor(Number(raw?.settleWeekday ?? 1)))),
    settleHour: Math.min(23, Math.max(0, Math.floor(Number(raw?.settleHour) || 0))),
    tiers: readTiers(raw?.tiers),
  };
}

/** 名次落在哪一档；不在任何档返回 null。 */
export function leaderboardTierForRank(rank: number): LeaderboardRewardTier | null {
  const r = Math.floor(rank);
  if (!Number.isFinite(r) || r < 1) {
    return null;
  }
  return readLeaderboardConfig().tiers.find((tier) => r >= tier.minRank && r <= tier.maxRank) ?? null;
}

/** 按上周名次发奖，库存满的道具记进 blocked。 */
export function planLeaderboardGrants(wallet: BoosterStock, rank: number): PlannedLeaderboardGrants {
  const tier = leaderboardTierForRank(rank);
  let next = wallet;
  const grants: ChallengeGrantSpec[] = [];
  const blocked: BoosterId[] = [];
  for (const spec of tier?.rewards ?? []) {
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

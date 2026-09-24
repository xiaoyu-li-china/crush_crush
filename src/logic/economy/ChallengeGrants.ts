/**
 * 排行榜结算相关配置读取。
 * 周榜奖励数量读 balance.json，库存封顶走 BoosterEconomy。
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

export interface LeaderboardConfig {
  limit: number;
  rewardRanks: number;
  settleWeekday: number;
  settleHour: number;
  rewards: ChallengeGrantSpec[];
}

export interface PlannedLeaderboardGrants {
  grants: ChallengeGrantSpec[];
  wallet: BoosterStock;
  /** 配置里想发、但库存已满、实际没加上的道具 */
  blocked: BoosterId[];
}

function readSpec(raw: { id?: string; amount?: number } | undefined, fallback: BoosterId): ChallengeGrantSpec {
  const id = raw?.id === 'hammer' || raw?.id === 'shuffle' || raw?.id === 'extraMoves'
    ? raw.id
    : fallback;
  return {
    id,
    amount: Math.max(0, Math.floor(Number(raw?.amount) || 0)),
  };
}

function applySpec(
  wallet: BoosterStock,
  spec: ChallengeGrantSpec,
): { wallet: BoosterStock; grant: ChallengeGrantSpec } {
  if (spec.amount <= 0) {
    return { wallet, grant: { id: spec.id, amount: 0 } };
  }
  const next = addBoosterToWallet(wallet, spec.id, spec.amount);
  const gained = next[spec.id] - wallet[spec.id];
  return {
    wallet: next,
    grant: { id: spec.id, amount: Math.max(0, gained) },
  };
}

export function readLeaderboardConfig(): LeaderboardConfig {
  const raw = (balanceJson as { leaderboard?: {
    limit?: number;
    rewardRanks?: number;
    settleWeekday?: number;
    settleHour?: number;
    rewards?: Array<{ id?: string; amount?: number }>;
  } }).leaderboard;
  const listed = Array.isArray(raw?.rewards) ? raw.rewards : undefined;
  const rewards = listed && listed.length > 0
    ? listed.map((item) => readSpec(item, 'hammer'))
    : [
      readSpec({ id: 'hammer', amount: 1 }, 'hammer'),
      readSpec({ id: 'shuffle', amount: 1 }, 'shuffle'),
    ];
  return {
    limit: Math.max(1, Math.floor(Number(raw?.limit) || 50)),
    rewardRanks: Math.max(1, Math.floor(Number(raw?.rewardRanks) || 3)),
    settleWeekday: Math.min(6, Math.max(0, Math.floor(Number(raw?.settleWeekday) ?? 1))),
    settleHour: Math.min(23, Math.max(0, Math.floor(Number(raw?.settleHour) || 0))),
    rewards,
  };
}

export function planLeaderboardGrants(wallet: BoosterStock): PlannedLeaderboardGrants {
  const config = readLeaderboardConfig();
  let next = wallet;
  const grants: ChallengeGrantSpec[] = [];
  const blocked: BoosterId[] = [];
  for (const spec of config.rewards) {
    const applied = applySpec(next, spec);
    next = applied.wallet;
    grants.push(applied.grant);
    if (spec.amount > 0 && applied.grant.amount <= 0) {
      blocked.push(spec.id);
    }
  }
  return { grants, wallet: next, blocked };
}

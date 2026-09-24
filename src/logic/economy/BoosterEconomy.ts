/**
 * 道具获取：库存跨关保存；空库存按阶梯补给。
 * 每个道具每天：先转发 1 个好友 → 再转发 1 个群 → 之后看广告。
 */
import type { BoosterId, BoosterStock } from './BoosterInventory';

export const BOOSTER_WALLET_CAP = 9;
export const LEFTOVER_MOVES_FOR_EXTRA = 6;

export const EMPTY_BOOSTER_WALLET: BoosterStock = {
  hammer: 0,
  shuffle: 0,
  extraMoves: 0,
};

export function clampBoosterWallet(stock: BoosterStock): BoosterStock {
  const cap = (n: number): number =>
    Math.max(0, Math.min(BOOSTER_WALLET_CAP, Math.floor(n)));
  return {
    hammer: cap(stock.hammer),
    shuffle: cap(stock.shuffle),
    extraMoves: cap(stock.extraMoves),
  };
}

export function addBoosterToWallet(
  stock: BoosterStock,
  id: BoosterId,
  amount: number,
): BoosterStock {
  const next = { ...stock };
  next[id] = next[id] + Math.floor(amount);
  return clampBoosterWallet(next);
}

export interface BoosterDailyFlags {
  adHammer: number;
  adShuffle: number;
  adExtra: number;
  shareFriendHammer: boolean;
  shareFriendShuffle: boolean;
  shareFriendExtra: boolean;
  shareGroupHammer: boolean;
  shareGroupShuffle: boolean;
  shareGroupExtra: boolean;
  playShuffleGranted: boolean;
  playExtraGranted: boolean;
}

export const EMPTY_BOOSTER_DAILY: BoosterDailyFlags = {
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
  playExtraGranted: false,
};

export type BoosterRefillChannel = 'friend' | 'group' | 'ad';

export function parseBoosterDaily(raw: Partial<BoosterDailyFlags> | null | undefined): BoosterDailyFlags {
  return {
    adHammer: Math.max(0, Math.floor(raw?.adHammer ?? 0)),
    adShuffle: Math.max(0, Math.floor(raw?.adShuffle ?? 0)),
    adExtra: Math.max(0, Math.floor(raw?.adExtra ?? 0)),
    shareFriendHammer: !!raw?.shareFriendHammer,
    shareFriendShuffle: !!raw?.shareFriendShuffle,
    shareFriendExtra: !!raw?.shareFriendExtra,
    shareGroupHammer: !!raw?.shareGroupHammer,
    shareGroupShuffle: !!raw?.shareGroupShuffle,
    shareGroupExtra: !!raw?.shareGroupExtra,
    playShuffleGranted: !!raw?.playShuffleGranted,
    playExtraGranted: !!raw?.playExtraGranted,
  };
}

export function boosterRefillChannel(
  flags: BoosterDailyFlags,
  id: BoosterId,
): BoosterRefillChannel {
  if (id === 'hammer') {
    if (!flags.shareFriendHammer) {
      return 'friend';
    }
    if (!flags.shareGroupHammer) {
      return 'group';
    }
    return 'ad';
  }
  if (id === 'shuffle') {
    if (!flags.shareFriendShuffle) {
      return 'friend';
    }
    if (!flags.shareGroupShuffle) {
      return 'group';
    }
    return 'ad';
  }
  if (!flags.shareFriendExtra) {
    return 'friend';
  }
  if (!flags.shareGroupExtra) {
    return 'group';
  }
  return 'ad';
}

export function markBoosterShare(
  flags: BoosterDailyFlags,
  id: BoosterId,
  channel: 'friend' | 'group',
): BoosterDailyFlags {
  const next = { ...flags };
  if (id === 'hammer') {
    if (channel === 'friend') {
      next.shareFriendHammer = true;
    } else {
      next.shareGroupHammer = true;
    }
  } else if (id === 'shuffle') {
    if (channel === 'friend') {
      next.shareFriendShuffle = true;
    } else {
      next.shareGroupShuffle = true;
    }
  } else if (channel === 'friend') {
    next.shareFriendExtra = true;
  } else {
    next.shareGroupExtra = true;
  }
  return next;
}

export function bumpBoosterAd(flags: BoosterDailyFlags, id: BoosterId): BoosterDailyFlags {
  const next = { ...flags };
  if (id === 'hammer') {
    next.adHammer += 1;
  } else if (id === 'shuffle') {
    next.adShuffle += 1;
  } else {
    next.adExtra += 1;
  }
  return next;
}

export function boosterRefillBadge(channel: BoosterRefillChannel): string {
  if (channel === 'friend') {
    return '好友';
  }
  if (channel === 'group') {
    return '群';
  }
  return '广告';
}

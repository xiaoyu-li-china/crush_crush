/**
 * 道具获取：库存跨关保存；看广告补给；玩游戏领取。
 * 对标常见三消 IAA：不白送局内道具。看完广告就发，锤子/重排/加步都不限次数。
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
  playShuffleGranted: boolean;
  playExtraGranted: boolean;
}

export const EMPTY_BOOSTER_DAILY: BoosterDailyFlags = {
  adHammer: 0,
  adShuffle: 0,
  adExtra: 0,
  playShuffleGranted: false,
  playExtraGranted: false,
};

export function parseBoosterDaily(raw: Partial<BoosterDailyFlags> | null | undefined): BoosterDailyFlags {
  return {
    adHammer: Math.max(0, Math.floor(raw?.adHammer ?? 0)),
    adShuffle: Math.max(0, Math.floor(raw?.adShuffle ?? 0)),
    adExtra: Math.max(0, Math.floor(raw?.adExtra ?? 0)),
    playShuffleGranted: !!raw?.playShuffleGranted,
    playExtraGranted: !!raw?.playExtraGranted,
  };
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

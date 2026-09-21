/**
 * 局内道具库存（跨关钱包，开局载入、使用后写回）。
 */
export type BoosterId = 'hammer' | 'shuffle' | 'extraMoves';

export interface BoosterStock {
  hammer: number;
  shuffle: number;
  extraMoves: number;
}

export interface BoosterGrantConfig {
  hammer: { perLevel: number };
  shuffle: { perLevel: number };
  extraMoves: { perLevel: number; moves: number };
}

const EMPTY: BoosterStock = { hammer: 0, shuffle: 0, extraMoves: 0 };

export class BoosterInventory {
  private stock: BoosterStock = { ...EMPTY };

  public resetFromConfig(config: BoosterGrantConfig): void {
    this.stock = {
      hammer: Math.max(0, Math.floor(config.hammer.perLevel)),
      shuffle: Math.max(0, Math.floor(config.shuffle.perLevel)),
      extraMoves: Math.max(0, Math.floor(config.extraMoves.perLevel)),
    };
  }

  public loadStock(stock: BoosterStock): void {
    this.stock = {
      hammer: Math.max(0, Math.floor(stock.hammer)),
      shuffle: Math.max(0, Math.floor(stock.shuffle)),
      extraMoves: Math.max(0, Math.floor(stock.extraMoves)),
    };
  }

  public getStock(): Readonly<BoosterStock> {
    return { ...this.stock };
  }

  public getCount(id: BoosterId): number {
    return this.stock[id];
  }

  public add(id: BoosterId, amount: number): void {
    const n = Math.floor(amount);
    if (n === 0) {
      return;
    }
    this.stock[id] = Math.max(0, this.stock[id] + n);
  }

  public canUse(id: BoosterId): boolean {
    return this.stock[id] > 0;
  }

  /** @returns 是否成功扣减 */
  public consume(id: BoosterId): boolean {
    if (this.stock[id] <= 0) {
      return false;
    }
    this.stock[id] -= 1;
    return true;
  }
}

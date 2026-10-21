/**
 * 通关星级：看过关时省下的步数。
 * 加步道具、看广告复活补的步数不算省下的，先扣掉再评。
 */
export type LevelStarCount = 1 | 2 | 3;

export function starsForClear(input: {
  movesLeft: number;
  movesTotal: number;
  movesGranted: number;
}): LevelStarCount {
  const total = Math.max(1, Math.floor(input.movesTotal));
  const left = Math.max(0, Math.floor(input.movesLeft) - Math.max(0, Math.floor(input.movesGranted)));
  if (left >= Math.max(3, Math.ceil(total * 0.25))) {
    return 3;
  }
  if (left >= Math.max(1, Math.ceil(total * 0.1))) {
    return 2;
  }
  return 1;
}

/** 结算 / 大厅用：「3 星通关」 */
export function starClearLabel(stars: LevelStarCount): string {
  return `${stars} 星通关`;
}

/** 结算页一句话说明为什么是这个星数 */
export function starsHint(stars: LevelStarCount): string {
  if (stars === 3) {
    return '完美通关！';
  }
  if (stars === 2) {
    return '再省几步就能拿三星';
  }
  return '省下更多步数可以拿更多星';
}

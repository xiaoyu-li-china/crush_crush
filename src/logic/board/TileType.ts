/**
 * 棋盘与方块基础类型定义。
 * 逻辑层纯类型模块：禁止引用 wx.* / Cocos。
 */

/**
 * 方块种类。
 * 使用数字枚举，便于直接写入 `Int8Array` 棋盘存储。
 */
export enum TileKind {
  /** 空格子 */
  Empty = 0,
  /** 红色普通块 */
  Red = 1,
  /** 蓝色普通块 */
  Blue = 2,
  /** 绿色普通块 */
  Green = 3,
  /** 黄色普通块 */
  Yellow = 4,
  /** 紫色普通块 */
  Purple = 5,
  /** 范围爆炸特殊块（遗留；四连现改为闪光同色） */
  Bomb = 6,
  /** 同色全消特殊块（可由五连等规则生成）→ 超级猫头鹰 */
  ColorBomb = 7,
  /** 洞格：菱形等异形棋盘的挖空，不落子、不填充 */
  Hole = 8,
}

/**
 * 棋盘尺寸（行 × 列）。
 * 建议默认 7×7，格子更大更好点。
 */
export interface BoardSize {
  /** 行数（垂直方向格子数） */
  rows: number;
  /** 列数（水平方向格子数） */
  cols: number;
}

/** 可参与三消匹配的基础色块（不含 Empty / 特殊块）。 */
export const BASIC_TILE_KINDS: readonly TileKind[] = [
  TileKind.Red,
  TileKind.Blue,
  TileKind.Green,
  TileKind.Yellow,
  TileKind.Purple,
] as const;

/**
 * 判断是否为基础可匹配色块。
 * @param kind - 方块种类
 * @returns 是否为 Red~Purple
 */
export function isBasicTile(kind: TileKind): boolean {
  return kind >= TileKind.Red && kind <= TileKind.Purple;
}

/**
 * 判断是否为特殊块（Bomb / ColorBomb）。
 * @param kind - 方块种类
 * @returns 是否为特殊块
 */
export function isSpecialTile(kind: TileKind): boolean {
  return kind === TileKind.Bomb || kind === TileKind.ColorBomb;
}

/**
 * 判断该种类是否可参与「连续相同 ≥3」的三消匹配。
 * 当前规则：仅基础色块可匹配；Empty / Bomb / ColorBomb 不参与同色连消扫描。
 * @param kind - 方块种类
 * @returns 是否可匹配
 */
export function isMatchable(kind: TileKind): boolean {
  return isBasicTile(kind);
}

export function isHole(kind: TileKind): boolean {
  return kind === TileKind.Hole;
}

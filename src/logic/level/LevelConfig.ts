import type { BoardShape } from '../board/BoardShape';
import type { BoardSize, TileKind } from '../board/TileType';

export type LevelGoal =
  | { type: 'collect'; kind: TileKind; count: number }
  | { type: 'score'; score: number }
  | { type: 'clear_blocks'; count: number }
  | { type: 'clear_ice'; count: number }
  | { type: 'clear_cloud'; count: number }
  | { type: 'collect_gems'; count: number }
  | { type: 'collect_snowmen'; count: number }
  | { type: 'collect_penguins'; count: number }
  | { type: 'collect_chicks'; count: number }
  | { type: 'clear_vines'; count: number };

export type LevelIce =
  | 'all'
  | { bottomRows: number }
  | { skipTopRows: number };
export type LevelCloud =
  | 'all'
  | { bottomRows: number; centerCap?: number; topCenterGap?: number; rightClear?: number }
  | { skipTopRows: number }
  /** 居中半层；bottomCenterGap = 最底一层中间留空若干格 */
  | { midRows: number; bottomCenterGap?: number };
export type IceStyle = 'under' | 'encase';

export interface LevelConfig {
  id: number;
  seed: number;
  moves: number;
  board: BoardSize;
  /** 缺省矩形；diamond 菱形；heart 心形 */
  shape?: BoardShape;
  /** 背景冰块：all = 全盘一层；{ bottomRows } = 从底向上若干行；{ skipTopRows } = 全盘铺冰但最上若干行不铺 */
  ice?: LevelIce;
  /** under = 动物在冰上可自由滑动；encase = 动物冻在冰下 */
  iceStyle?: IceStyle;
  /** 从底部铺 N 格：白云盖住粉球，先消云再收集粉球 */
  cloudGems?: number;
  /** 从底部向上铺几行连绵棉花云（与粉球可分开） */
  cloudRows?: number;
  /** 棉花：all = 全盘；{ bottomRows, centerCap? } 底满铺并可在上一行居中盖 N 格；{ midRows } 居中半层；{ skipTopRows } 留顶窗 */
  cloud?: LevelCloud;
  /** 冰下埋藏的雪人 / 企鹅 */
  buried?: { snowmen: number; penguins: number };
  /** 蛋壳萌鸡：邻消砸壳，砸碎收获萌鸡 */
  eggs?: { count: number; layers?: number };
  /** 绿色藤蔓缠绕 */
  vines?: {
    pattern: 'scatter' | 'columns' | 'rows' | 'clusters' | 'web';
    count?: number;
    layers: number;
  };
  /** 开局预置猫头鹰 / 闪光，制造大连锁 */
  starterSpecials?: { owls?: number; sparkles?: number };
  goals: LevelGoal[];
  crushEnabled: boolean;
  crushDurationMs: number;
}

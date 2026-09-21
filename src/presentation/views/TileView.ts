import type { TileKind } from '../../logic/board/TileType';

/**
 * 单格方块视图模型（与引擎 Node 解耦）。
 * Cocos 侧可根据 tileId 映射真实节点；本对象负责逻辑坐标与显示态。
 */
export class TileView {
  /** 稳定 id，与 BoardModel.tileIds 对应 */
  public tileId = 0;

  /** 方块种类；null 表示未占用 */
  public kind: TileKind | null = null;

  /** 逻辑行 */
  public row = 0;

  /** 逻辑列 */
  public col = 0;

  /** 表现层本地坐标 X（像素） */
  public x = 0;

  /** 表现层本地坐标 Y（像素） */
  public y = 0;

  /** 是否可见 */
  public visible = false;

  /** 是否为当前选中格 */
  public selected = false;

  /** 四连闪光同色 */
  public sparkle = false;

  /**
   * 重置到池化初始态。
   */
  public reset(): void {
    this.tileId = 0;
    this.kind = null;
    this.row = 0;
    this.col = 0;
    this.x = 0;
    this.y = 0;
    this.visible = false;
    this.selected = false;
    this.sparkle = false;
  }

  /**
   * 绑定盘面数据与布局坐标。
   */
  public bind(
    tileId: number,
    kind: TileKind,
    row: number,
    col: number,
    x: number,
    y: number,
    sparkle = false,
  ): void {
    this.tileId = tileId;
    this.kind = kind;
    this.row = row;
    this.col = col;
    this.x = x;
    this.y = y;
    this.visible = true;
    this.sparkle = sparkle;
  }
}

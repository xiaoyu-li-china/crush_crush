import type { BoardModel } from '../../logic/board/BoardModel';
import { TileKind } from '../../logic/board/TileType';
import { TileView } from './TileView';

/** 交换意图回调：不得在此回调内直接改 BoardModel。 */
export type SwapIntentHandler = (
  rowA: number,
  colA: number,
  rowB: number,
  colB: number,
) => void;

/** 棋盘视图布局配置。 */
export interface BoardViewLayout {
  /** 单格边长（像素） */
  cellSize: number;
  /** 棋盘左上角原点 X */
  originX: number;
  /** 棋盘左上角原点 Y（行增大时 Y 减小，符合常见 2D 屏幕坐标） */
  originY: number;
}

/** 可选宿主：Cocos / Canvas / 调试层监听视觉变更。 */
export interface BoardViewHost {
  /** 单格视觉更新 */
  onTileUpdated?(tile: TileView): void;
  /** 选中态变化 */
  onSelectionChanged?(row: number | null, col: number | null): void;
  /** 整盘刷新完成 */
  onBoardSynced?(version: number): void;
}

/** 滑动跟手预览 */
export interface DragPreview {
  row: number;
  col: number;
  dx: number;
  dy: number;
  /** 对向被挤开的格子 */
  otherRow: number;
  otherCol: number;
  otherDx: number;
  otherDy: number;
  /** 按下抬起感（无位移时也为 true） */
  pressed: boolean;
  /** 0~1 点中弹跳/抬起强度 */
  pressLift: number;
  /** 滑动进度 0~1（用于对向挤开与描边） */
  slideProgress: number;
}

const DEFAULT_LAYOUT: BoardViewLayout = {
  cellSize: 64,
  originX: 0,
  originY: 0,
};

/** 超过格子边长该比例即触发交换（过低会导致轻触被当成滑动） */
const SWAP_COMMIT_RATIO = 0.34;
/** 轴向锁定死区 */
const AXIS_DEAD_RATIO = 0.06;
/** 换轴所需主导倍率（防斜滑乱跳） */
const AXIS_SWITCH_RATIO = 1.35;
/** 低于该比例视为「轻点」，仍走点选交换 */
const TAP_DRAG_RATIO = 0.18;

const KIND_CHAR: Record<number, string> = {
  [TileKind.Empty]: '.',
  [TileKind.Red]: 'R',
  [TileKind.Blue]: 'B',
  [TileKind.Green]: 'G',
  [TileKind.Yellow]: 'Y',
  [TileKind.Purple]: 'P',
  [TileKind.Bomb]: '*',
  [TileKind.ColorBomb]: '@',
  [TileKind.Hole]: '.',
};

/**
 * 棋盘视图：负责布局同步与输入手势，**禁止**直接修改 BoardModel。
 *
 * 输入模式：
 * 1. 点选两格（第二次点相邻格发出 SwapIntent）
 * 2. 滑动：跟手拖动，越过阈值立刻发出 SwapIntent（不必等抬手）
 */
export class BoardView {
  private layout: BoardViewLayout;
  private readonly host: BoardViewHost | null;
  private swapHandler: SwapIntentHandler | null = null;

  /** tileId → 视图 */
  private readonly tilesById = new Map<number, TileView>();

  /** 视图对象池 */
  private readonly pool: TileView[] = [];

  private syncedVersion = -1;
  private rows = 0;
  private cols = 0;
  private holes = new Uint8Array(0);
  private ice = new Uint8Array(0);
  private cloud = new Uint8Array(0);
  private iceLocksTiles = false;

  private selectedRow: number | null = null;
  private selectedCol: number | null = null;

  private pointerDownRow: number | null = null;
  private pointerDownCol: number | null = null;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private dragDx = 0;
  private dragDy = 0;
  private swipeCommitted = false;
  /** 滑动轴向锁定：非边缘四向滑动更稳 */
  private axisLock: 'x' | 'y' | null = null;
  private pressStartMs = 0;
  private inputBound = false;

  /**
   * @param layout - 布局；可在 mount 后 updateLayout
   * @param host - 可选视觉宿主
   */
  public constructor(layout: Partial<BoardViewLayout> = {}, host: BoardViewHost | null = null) {
    this.layout = { ...DEFAULT_LAYOUT, ...layout };
    this.host = host;
  }

  /**
   * 绑定交换意图处理器。
   * @param handler - 收到合法手势后回调
   */
  public bindInput(handler: SwapIntentHandler): void {
    this.swapHandler = handler;
    this.inputBound = true;
  }

  /**
   * 更新布局参数并在下次 sync 时生效。
   * @param layout - 部分布局字段
   */
  public updateLayout(layout: Partial<BoardViewLayout>): void {
    const next = { ...this.layout, ...layout };
    const changed =
      next.cellSize !== this.layout.cellSize ||
      next.originX !== this.layout.originX ||
      next.originY !== this.layout.originY;
    this.layout = next;
    // 布局变了才脏标记，避免每帧 update 打断同步
    if (changed) {
      this.syncedVersion = -1;
    }
  }

  /**
   * 按版本脏检查后，从 BoardModel **只读**同步全部可见方块。
   * @param board - 逻辑棋盘
   * @param force - 忽略 version 强制全量同步
   */
  public syncFromBoard(board: BoardModel, force = false): void {
    if (!force && board.version === this.syncedVersion) {
      return;
    }

    this.rows = board.size.rows;
    this.cols = board.size.cols;
    this.holes = new Uint8Array(board.length);
    this.ice = new Uint8Array(board.length);
    this.cloud = new Uint8Array(board.length);
    this.iceLocksTiles = board.iceLocksTiles;
    for (let i = 0; i < board.length; i += 1) {
      if (board.cells[i] === TileKind.Hole) {
        this.holes[i] = 1;
      }
      this.ice[i] = board.ice[i]!;
      this.cloud[i] = board.cloud[i]!;
    }

    const seen = new Set<number>();
    const { cellSize, originX, originY } = this.layout;

    for (let r = 0; r < board.size.rows; r += 1) {
      for (let c = 0; c < board.size.cols; c += 1) {
        const kind = board.getTile(r, c);
        const tileId = board.getTileId(r, c);
        if (kind === TileKind.Empty || kind === TileKind.Hole || tileId === 0) {
          continue;
        }
        seen.add(tileId);
        const tile = this.ensureTile(tileId);
        const x = originX + c * cellSize + cellSize * 0.5;
        const y = originY - r * cellSize - cellSize * 0.5;
        tile.bind(tileId, kind, r, c, x, y, board.isSparkle(r, c));
        tile.selected =
          this.selectedRow === r && this.selectedCol === c;
        this.host?.onTileUpdated?.(tile);
      }
    }

    for (const [tileId, tile] of this.tilesById) {
      if (!seen.has(tileId)) {
        this.releaseTile(tileId, tile);
      }
    }

    this.syncedVersion = board.version;
    this.host?.onBoardSynced?.(board.version);
  }

  /**
   * 指针按下（屏幕坐标 → 格子）。
   * @param screenX - 屏幕 X
   * @param screenY - 屏幕 Y
   * @returns 是否命中棋盘
   */
  public onPointerDown(screenX: number, screenY: number): boolean {
    if (!this.inputBound) {
      return false;
    }
    const cell = this.screenToCell(screenX, screenY);
    if (!cell) {
      this.clearSelection();
      this.resetPointer();
      return false;
    }
    if (this.isCellMovementLocked(cell.row, cell.col)) {
      this.clearSelection();
      this.resetPointer();
      return true;
    }
    this.pointerDownRow = cell.row;
    this.pointerDownCol = cell.col;
    this.pointerDownX = screenX;
    this.pointerDownY = screenY;
    this.dragDx = 0;
    this.dragDy = 0;
    this.swipeCommitted = false;
    this.axisLock = null;
    this.pressStartMs = Date.now();

    // 已选中且点邻格：保留原选中，抬起时交换；否则点中高亮
    const selAdj =
      this.selectedRow !== null &&
      this.selectedCol !== null &&
      Math.abs(this.selectedRow - cell.row) + Math.abs(this.selectedCol - cell.col) === 1;
    if (!selAdj) {
      this.setSelection(cell.row, cell.col);
    }
    return true;
  }

  /** 当前是否有未结束的棋盘手势（按下未抬起） */
  public hasActivePointer(): boolean {
    return this.pointerDownRow !== null && this.pointerDownCol !== null;
  }

  /**
   * 指针移动：四向跟手；有邻格时 1:1 镜像挤开，越过阈值立刻交换。
   */
  public onPointerMove(screenX: number, screenY: number): boolean {
    if (!this.inputBound || this.swipeCommitted) {
      return false;
    }
    if (this.pointerDownRow === null || this.pointerDownCol === null) {
      return false;
    }

    const cellSize = Math.max(1, this.layout.cellSize);
    const rawDx = screenX - this.pointerDownX;
    const rawDy = screenY - this.pointerDownY;
    const dead = cellSize * AXIS_DEAD_RATIO;
    const absX = Math.abs(rawDx);
    const absY = Math.abs(rawDy);

    // 更新轴向锁（斜向不乱跳）
    if (absX >= dead || absY >= dead) {
      if (this.axisLock === null) {
        this.axisLock = absX >= absY ? 'x' : 'y';
      } else if (this.axisLock === 'x' && absY > absX * AXIS_SWITCH_RATIO) {
        this.axisLock = 'y';
      } else if (this.axisLock === 'y' && absX > absY * AXIS_SWITCH_RATIO) {
        this.axisLock = 'x';
      }
    }

    let axisDx = 0;
    let axisDy = 0;
    if (this.axisLock === 'x') {
      axisDx = rawDx;
    } else if (this.axisLock === 'y') {
      axisDy = rawDy;
    } else {
      axisDx = rawDx * 0.55;
      axisDy = rawDy * 0.55;
    }

    const neighbor = this.resolveNeighbor(
      this.pointerDownRow,
      this.pointerDownCol,
      axisDx,
      axisDy,
    );

    if (neighbor) {
      // 非边缘（有对向邻格）：硬跟手，最多一格，手感干脆
      this.dragDx = clamp(axisDx, -cellSize, cellSize);
      this.dragDy = clamp(axisDy, -cellSize, cellSize);
    } else if (this.axisLock) {
      // 边缘外推：轻橡皮筋，提示不可换
      this.dragDx = this.axisLock === 'x' ? rubberBand(axisDx, cellSize * 0.42) : 0;
      this.dragDy = this.axisLock === 'y' ? rubberBand(axisDy, cellSize * 0.42) : 0;
    } else {
      this.dragDx = axisDx;
      this.dragDy = axisDy;
    }

    const threshold = cellSize * SWAP_COMMIT_RATIO;
    const commitByDistance =
      Math.abs(this.dragDx) >= threshold || Math.abs(this.dragDy) >= threshold;

    // 手指进入邻格也立刻交换（非边缘四向更跟手）
    const fingerCell = this.screenToCell(screenX, screenY);
    const commitByCell =
      !!neighbor &&
      !!fingerCell &&
      fingerCell.row === neighbor.row &&
      fingerCell.col === neighbor.col;

    if (!commitByDistance && !commitByCell) {
      return true;
    }

    if (!neighbor) {
      return true;
    }

    this.swipeCommitted = true;
    this.dragDx = 0;
    this.dragDy = 0;
    this.emitSwap(
      this.pointerDownRow,
      this.pointerDownCol,
      neighbor.row,
      neighbor.col,
    );
    this.clearSelection();
    this.pointerDownRow = null;
    this.pointerDownCol = null;
    this.axisLock = null;
    return true;
  }

  /**
   * 指针抬起：若滑动已提交则忽略；否则点选 / 抬起格交换。
   */
  public onPointerUp(screenX: number, screenY: number): boolean {
    if (!this.inputBound) {
      return false;
    }

    if (this.swipeCommitted) {
      this.resetPointer();
      return true;
    }

    const cell = this.screenToCell(screenX, screenY);
    const downRow = this.pointerDownRow;
    const downCol = this.pointerDownCol;
    const cellSize = Math.max(1, this.layout.cellSize);
    const dragDist = Math.hypot(this.dragDx, this.dragDy);
    // 微抖仍算轻点，避免「点邻格想交换却只换选中」
    const tapLike = dragDist < cellSize * TAP_DRAG_RATIO;
    this.resetPointer();

    if (downRow === null || downCol === null) {
      return false;
    }

    // 抬起落在盘外：保留按下格选中，避免“点了没反应”
    if (!cell) {
      this.setSelection(downRow, downCol);
      return true;
    }

    // 滑动抬起：落在邻格则交换
    if (downRow !== cell.row || downCol !== cell.col) {
      const adj =
        Math.abs(downRow - cell.row) + Math.abs(downCol - cell.col) === 1;
      if (adj) {
        this.emitSwap(downRow, downCol, cell.row, cell.col);
        this.clearSelection();
      } else {
        this.setSelection(cell.row, cell.col);
      }
      return true;
    }

    // 点选邻格交换：先选 A，再点 B（含轻微抖动）
    if (
      tapLike &&
      this.selectedRow !== null &&
      this.selectedCol !== null &&
      (this.selectedRow !== cell.row || this.selectedCol !== cell.col)
    ) {
      const adj =
        Math.abs(this.selectedRow - cell.row) +
          Math.abs(this.selectedCol - cell.col) ===
        1;
      if (adj) {
        this.emitSwap(this.selectedRow, this.selectedCol, cell.row, cell.col);
        this.clearSelection();
        return true;
      }
    }

    // 轻点同一格：保持选中（按下时已高亮）
    this.setSelection(cell.row, cell.col);
    return true;
  }

  /** 手势被系统取消时复位，避免卡死跟手态 */
  public onPointerCancel(): void {
    this.resetPointer();
  }

  /** 当前跟手拖动预览；按下中也会返回（抬起感） */
  public getDragPreview(nowMs = Date.now()): DragPreview | null {
    if (
      this.pointerDownRow === null ||
      this.pointerDownCol === null ||
      this.swipeCommitted
    ) {
      return null;
    }

    const cellSize = Math.max(1, this.layout.cellSize);
    const neighbor = this.resolveNeighbor(
      this.pointerDownRow,
      this.pointerDownCol,
      this.dragDx,
      this.dragDy,
    );
    const abs = Math.max(Math.abs(this.dragDx), Math.abs(this.dragDy));
    const slideProgress = Math.min(1, abs / cellSize);
    const pressAge = Math.max(0, nowMs - this.pressStartMs);
    const pressLift =
      slideProgress > 0.02
        ? 1
        : Math.min(1, 0.55 + 0.45 * Math.sin(Math.min(1, pressAge / 90) * Math.PI));

    // 有邻格：1:1 镜像挤开；无邻格：不对向移动
    const otherDx = neighbor ? -this.dragDx : 0;
    const otherDy = neighbor ? -this.dragDy : 0;

    return {
      row: this.pointerDownRow,
      col: this.pointerDownCol,
      dx: this.dragDx,
      dy: this.dragDy,
      otherRow: neighbor ? neighbor.row : this.pointerDownRow,
      otherCol: neighbor ? neighbor.col : this.pointerDownCol,
      otherDx,
      otherDy,
      pressed: true,
      pressLift,
      slideProgress,
    };
  }

  /** 根据拖动向量解析相邻目标格（仅四向） */
  private resolveNeighbor(
    row: number,
    col: number,
    dx: number,
    dy: number,
  ): { row: number; col: number } | null {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 0.5 && absY < 0.5) {
      return null;
    }
    let toRow = row;
    let toCol = col;
    if (this.axisLock === 'x' || (this.axisLock === null && absX >= absY)) {
      toCol = col + (dx > 0 ? 1 : -1);
    } else {
      toRow = row + (dy > 0 ? -1 : 1);
    }
    if (toRow < 0 || toRow >= this.rows || toCol < 0 || toCol >= this.cols) {
      return null;
    }
    if (toRow === row && toCol === col) {
      return null;
    }
    if (this.holes[toRow * this.cols + toCol] === 1) {
      return null;
    }
    if (this.isCellMovementLocked(toRow, toCol) || this.isCellMovementLocked(row, col)) {
      return null;
    }
    return { row: toRow, col: toCol };
  }

  /**
   * 直接注入格子交换意图（单测 / 非指针环境）。
   */
  public requestSwap(rowA: number, colA: number, rowB: number, colB: number): void {
    this.emitSwap(rowA, colA, rowB, colB);
  }

  /**
   * 屏幕坐标转格子；超出棋盘返回 null。
   */
  public screenToCell(
    screenX: number,
    screenY: number,
  ): { row: number; col: number } | null {
    if (this.rows <= 0 || this.cols <= 0) {
      return null;
    }
    const { cellSize, originX, originY } = this.layout;
    const col = Math.floor((screenX - originX) / cellSize);
    const row = Math.floor((originY - screenY) / cellSize);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return null;
    }
    if (this.holes[row * this.cols + col] === 1) {
      return null;
    }
    return { row, col };
  }

  /**
   * 命中格子；点在棋盘外框附近时吸附到最近格，减少「点了没反应」。
   */
  public hitCell(
    screenX: number,
    screenY: number,
    padPx = 0,
  ): { row: number; col: number } | null {
    const exact = this.screenToCell(screenX, screenY);
    if (exact) {
      return exact;
    }
    if (padPx <= 0 || this.rows <= 0 || this.cols <= 0) {
      return null;
    }
    const { cellSize, originX, originY } = this.layout;
    const boardW = cellSize * this.cols;
    const boardH = cellSize * this.rows;
    if (
      screenX < originX - padPx ||
      screenX > originX + boardW + padPx ||
      screenY < originY - boardH - padPx ||
      screenY > originY + padPx
    ) {
      return null;
    }
    const col = Math.max(
      0,
      Math.min(this.cols - 1, Math.floor((screenX - originX) / cellSize)),
    );
    const row = Math.max(
      0,
      Math.min(this.rows - 1, Math.floor((originY - screenY) / cellSize)),
    );
    if (this.holes[row * this.cols + col] === 1) {
      return null;
    }
    return { row, col };
  }

  /**
   * 当前选中格。
   */
  public getSelection(): { row: number; col: number } | null {
    if (this.selectedRow === null || this.selectedCol === null) {
      return null;
    }
    return { row: this.selectedRow, col: this.selectedCol };
  }

  /**
   * 生成 ASCII 棋盘，便于调试与单测「看见」盘面。
   */
  public toAscii(board: BoardModel): string {
    const lines: string[] = [];
    for (let r = 0; r < board.size.rows; r += 1) {
      const cells: string[] = [];
      for (let c = 0; c < board.size.cols; c += 1) {
        const kind = board.getTile(r, c);
        const ch = KIND_CHAR[kind] ?? '?';
        const mark =
          this.selectedRow === r && this.selectedCol === c ? `[${ch}]` : ` ${ch} `;
        cells.push(mark);
      }
      lines.push(cells.join(''));
    }
    return lines.join('\n');
  }

  /**
   * 卸载输入与视图引用。
   */
  public dispose(): void {
    this.swapHandler = null;
    this.inputBound = false;
    this.clearSelection();
    this.resetPointer();
    for (const [tileId, tile] of this.tilesById) {
      this.releaseTile(tileId, tile);
    }
    this.tilesById.clear();
    this.pool.length = 0;
    this.syncedVersion = -1;
  }

  private resetPointer(): void {
    this.pointerDownRow = null;
    this.pointerDownCol = null;
    this.dragDx = 0;
    this.dragDy = 0;
    this.swipeCommitted = false;
    this.axisLock = null;
  }

  /**
   * 发出交换意图（仅当存在 handler）。
   */
  private emitSwap(
    rowA: number,
    colA: number,
    rowB: number,
    colB: number,
  ): void {
    if (this.isCellMovementLocked(rowA, colA) || this.isCellMovementLocked(rowB, colB)) {
      return;
    }
    this.swapHandler?.(rowA, colA, rowB, colB);
  }

  private isCellMovementLocked(row: number, col: number): boolean {
    const index = row * this.cols + col;
    if (this.cloud.length > 0 && this.cloud[index]! > 0) {
      return true;
    }
    if (!this.iceLocksTiles || this.ice.length === 0) {
      return false;
    }
    return this.ice[index]! > 0;
  }

  private setSelection(row: number, col: number): void {
    this.selectedRow = row;
    this.selectedCol = col;
    this.host?.onSelectionChanged?.(row, col);
    for (const tile of this.tilesById.values()) {
      tile.selected = tile.row === row && tile.col === col;
      this.host?.onTileUpdated?.(tile);
    }
  }

  /** 外部恢复/强制选中某一格（如非法交换回弹后） */
  public selectCell(row: number, col: number): void {
    if (this.rows <= 0 || this.cols <= 0) {
      return;
    }
    if (row < 0 || col < 0 || row >= this.rows || col >= this.cols) {
      return;
    }
    this.setSelection(row, col);
  }

  public clearSelection(): void {
    if (this.selectedRow === null && this.selectedCol === null) {
      return;
    }
    this.selectedRow = null;
    this.selectedCol = null;
    this.host?.onSelectionChanged?.(null, null);
    for (const tile of this.tilesById.values()) {
      if (tile.selected) {
        tile.selected = false;
        this.host?.onTileUpdated?.(tile);
      }
    }
  }

  private ensureTile(tileId: number): TileView {
    let tile = this.tilesById.get(tileId);
    if (tile) {
      return tile;
    }
    tile = this.pool.pop() ?? new TileView();
    this.tilesById.set(tileId, tile);
    return tile;
  }

  private releaseTile(tileId: number, tile: TileView): void {
    this.tilesById.delete(tileId);
    tile.reset();
    this.pool.push(tile);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 超过限度后带阻尼的跟手位移（边缘外推） */
function rubberBand(delta: number, limit: number): number {
  const sign = delta < 0 ? -1 : 1;
  const mag = Math.abs(delta);
  if (mag <= limit) {
    return delta;
  }
  const over = mag - limit;
  return sign * (limit + over * 0.2);
}

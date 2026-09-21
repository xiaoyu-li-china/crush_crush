import type { ResolveWave } from '../../logic/board/MatchResolver';
import { TileKind } from '../../logic/board/TileType';

/** 消除缩放淡出时长（ms）——略拉长，避免「瞬间消失」 */
const CLEAR_MS = 200;
/** 消除后短暂停顿（无特殊块合成时） */
const CLEAR_HOLD_MS = 28;
/** 特殊块弹出时长（ms）——四连闪光 / 五连猫头鹰 */
const SPECIAL_POP_MS = 150;
/** 下落时长 */
const FALL_MS = 200;
/** 新生下落时长 */
const SPAWN_MS = 210;
/** 波次间隔 */
const WAVE_GAP_MS = 40;

export type WaveClearListener = (
  waveIndex: number,
  cells: Array<{ row: number; col: number; kind: TileKind }>,
  hasSpecial: boolean,
) => void;

export type WaveClearFinishedListener = (
  waveIndex: number,
  chippedCloudIndices: number[],
  chippedEggIndices?: number[],
  chippedVineIndices?: number[],
) => void;

export interface BoardSnapshot {
  rows: number;
  cols: number;
  cells: ArrayLike<number>;
  tileIds: ArrayLike<number>;
  sparkles?: ArrayLike<number>;
}

/** 供 Canvas 绘制的可视方块（开心消消乐：可缩放/透明/亚像素行） */
export interface AnimVisualTile {
  kind: TileKind;
  tileId: number;
  /** 逻辑列 */
  col: number;
  /** 显示行（可小数，用于下落插值） */
  displayRow: number;
  scale: number;
  alpha: number;
  sparkle: boolean;
}

interface LiveTile {
  kind: TileKind;
  tileId: number;
  col: number;
  row: number;
  displayRow: number;
  scale: number;
  alpha: number;
  fromRow: number;
  toRow: number;
  clearing: boolean;
  spawning: boolean;
  /** 特殊块弹出动画中 */
  specialPopping: boolean;
  sparkle: boolean;
}

type Phase =
  | 'clear'
  | 'clearHold'
  | 'specialPop'
  | 'fall'
  | 'spawn'
  | 'waveGap'
  | 'done';

/**
 * 开心消消乐式三消播放器：消除消失 → 特殊块弹出 → 下落 → 顶部补块 → 连锁。
 * 纯数据驱动，不依赖 wx / Canvas。
 */
export class BoardMatchAnimator {
  private tiles = new Map<number, LiveTile>();
  private waves: ResolveWave[] = [];
  private waveIndex = 0;
  private phase: Phase = 'done';
  private phaseStart = 0;
  private playing = false;
  private completeCb: (() => void) | null = null;
  private waveClearCb: WaveClearListener | null = null;
  private clearFinishedCb: WaveClearFinishedListener | null = null;
  private rows = 0;
  private cols = 0;

  /**
   * 从交换后快照开始播放分波次结算。
   */
  public start(snapshot: BoardSnapshot, waves: ResolveWave[], nowMs: number): void {
    this.rows = snapshot.rows;
    this.cols = snapshot.cols;
    this.waves = waves;
    this.waveIndex = 0;
    this.tiles.clear();
    this.playing = true;
    this.phaseStart = nowMs;

    for (let r = 0; r < snapshot.rows; r += 1) {
      for (let c = 0; c < snapshot.cols; c += 1) {
        const i = r * snapshot.cols + c;
        const kind = snapshot.cells[i] as TileKind;
        const tileId = snapshot.tileIds[i]!;
        if (kind === TileKind.Empty || tileId === 0) {
          continue;
        }
        this.tiles.set(tileId, {
          kind,
          tileId,
          col: c,
          row: r,
          displayRow: r,
          scale: 1,
          alpha: 1,
          fromRow: r,
          toRow: r,
          clearing: false,
          spawning: false,
          specialPopping: false,
          sparkle: (snapshot.sparkles?.[i] ?? 0) === 1,
        });
      }
    }

    if (waves.length === 0) {
      this.phase = 'done';
      this.playing = false;
      this.finish();
      return;
    }

    this.beginClear(nowMs);
  }

  public onComplete(cb: (() => void) | null): void {
    this.completeCb = cb;
  }

  /** 每一波开始消除时回调（用于粒子 / 飘分 / 连锁音效） */
  public onWaveClear(cb: WaveClearListener | null): void {
    this.waveClearCb = cb;
  }

  /** 小动物消完后回调（用于棉花掉层） */
  public onClearFinished(cb: WaveClearFinishedListener | null): void {
    this.clearFinishedCb = cb;
  }

  /**
   * 已经消完小动物的波次数。当前波还在缩小消失时不计入，
   * 这样棉花会等动物消失后再掉层。
   */
  public getClearedWaveCount(): number {
    if (!this.playing) {
      return this.waves.length;
    }
    if (this.phase === 'clear') {
      return this.waveIndex;
    }
    return this.waveIndex + 1;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  /** 立刻停掉播放，不触发 onComplete（进入粉碎/清洁时丢掉三消残留）。 */
  public stop(): void {
    this.playing = false;
    this.phase = 'done';
    this.waves = [];
    this.waveIndex = 0;
    this.tiles.clear();
    this.completeCb = null;
    this.waveClearCb = null;
    this.clearFinishedCb = null;
  }

  /**
   * 推进动画；返回是否仍在播放。
   */
  public update(nowMs: number): boolean {
    if (!this.playing) {
      return false;
    }

    const wave = this.waves[this.waveIndex];
    if (!wave && this.phase !== 'done') {
      this.playing = false;
      this.phase = 'done';
      this.finish();
      return false;
    }

    const elapsed = nowMs - this.phaseStart;

    switch (this.phase) {
      case 'clear': {
        const t = Math.min(1, elapsed / CLEAR_MS);
        // 先微弹再缩小，增强「啪」的爽感
        const pop = t < 0.22 ? 1 + 0.22 * easeOutCubic(t / 0.22) : 1.22;
        const shrinkT = t < 0.22 ? 0 : (t - 0.22) / 0.78;
        const ease = easeInCubic(shrinkT);
        for (const tile of this.tiles.values()) {
          if (!tile.clearing) {
            continue;
          }
          if (t < 0.22) {
            tile.scale = pop;
            tile.alpha = 1;
          } else {
            tile.scale = Math.max(0.08, pop * (1 - ease * 0.92));
            tile.alpha = 1 - ease;
          }
        }
        if (t >= 1) {
          this.removeClearingTiles();
          this.beginAfterClear(nowMs);
        }
        break;
      }
      case 'clearHold': {
        if (elapsed >= CLEAR_HOLD_MS) {
          this.beginFall(nowMs);
        }
        break;
      }
      case 'specialPop': {
        const t = Math.min(1, elapsed / SPECIAL_POP_MS);
        for (const tile of this.tiles.values()) {
          if (!tile.specialPopping) {
            continue;
          }
          tile.scale = specialPopScale(t);
          tile.alpha = Math.min(1, 0.55 + 0.45 * easeOutCubic(Math.min(1, t * 1.6)));
        }
        if (t >= 1) {
          for (const tile of this.tiles.values()) {
            if (!tile.specialPopping) {
              continue;
            }
            tile.scale = 1;
            tile.alpha = 1;
            tile.specialPopping = false;
          }
          this.beginFall(nowMs);
        }
        break;
      }
      case 'fall': {
        const t = Math.min(1, elapsed / FALL_MS);
        const ease = easeOutCubic(t);
        for (const tile of this.tiles.values()) {
          if (tile.fromRow === tile.toRow) {
            continue;
          }
          tile.displayRow = tile.fromRow + (tile.toRow - tile.fromRow) * ease;
        }
        if (t >= 1) {
          for (const tile of this.tiles.values()) {
            tile.row = tile.toRow;
            tile.displayRow = tile.toRow;
            tile.fromRow = tile.toRow;
          }
          this.beginSpawn(nowMs);
        }
        break;
      }
      case 'spawn': {
        const t = Math.min(1, elapsed / SPAWN_MS);
        const ease = easeOutCubic(t);
        for (const tile of this.tiles.values()) {
          if (!tile.spawning) {
            continue;
          }
          tile.displayRow = tile.fromRow + (tile.toRow - tile.fromRow) * ease;
          tile.scale = 0.65 + 0.35 * ease;
          tile.alpha = Math.min(1, 0.35 + 0.65 * ease);
        }
        if (t >= 1) {
          for (const tile of this.tiles.values()) {
            if (!tile.spawning) {
              continue;
            }
            tile.row = tile.toRow;
            tile.displayRow = tile.toRow;
            tile.fromRow = tile.toRow;
            tile.scale = 1;
            tile.alpha = 1;
            tile.spawning = false;
          }
          this.advanceWave(nowMs);
        }
        break;
      }
      case 'waveGap': {
        if (elapsed >= WAVE_GAP_MS) {
          this.beginClear(nowMs);
        }
        break;
      }
      default:
        break;
    }

    return this.playing;
  }

  /**
   * 当前应绘制的方块（不含已消失空位）。
   */
  public getVisualTiles(): AnimVisualTile[] {
    const out: AnimVisualTile[] = [];
    for (const tile of this.tiles.values()) {
      if (tile.alpha <= 0.01) {
        continue;
      }
      out.push({
        kind: tile.kind,
        tileId: tile.tileId,
        col: tile.col,
        displayRow: tile.displayRow,
        scale: tile.scale,
        alpha: tile.alpha,
        sparkle: tile.sparkle,
      });
    }
    return out;
  }

  public getSize(): { rows: number; cols: number } {
    return { rows: this.rows, cols: this.cols };
  }

  private beginClear(nowMs: number): void {
    const wave = this.waves[this.waveIndex];
    if (!wave) {
      this.playing = false;
      this.phase = 'done';
      this.finish();
      return;
    }
    const clearSet = new Set(wave.clearedIndices);
    const clearedCells: Array<{ row: number; col: number; kind: TileKind }> = [];
    for (const tile of this.tiles.values()) {
      const index = tile.row * this.cols + tile.col;
      tile.clearing = clearSet.has(index);
      if (tile.clearing) {
        tile.scale = 1;
        tile.alpha = 1;
        clearedCells.push({ row: tile.row, col: tile.col, kind: tile.kind });
      }
    }
    this.waveClearCb?.(
      this.waveIndex,
      clearedCells,
      wave.specialSpawns.length > 0,
    );
    this.phase = 'clear';
    this.phaseStart = nowMs;
  }

  private removeClearingTiles(): void {
    for (const [id, tile] of this.tiles) {
      if (tile.clearing) {
        this.tiles.delete(id);
      }
    }
  }

  /** 消除后：有特殊块则立刻弹出，否则短暂停顿再下落 */
  private beginAfterClear(nowMs: number): void {
    const wave = this.waves[this.waveIndex]!;
    this.clearFinishedCb?.(
      this.waveIndex,
      wave.chippedCloudIndices,
      wave.chippedEggIndices,
      wave.chippedVineIndices,
    );
    if (wave.specialSpawns.length > 0) {
      this.beginSpecialPop(nowMs);
      return;
    }
    this.phase = 'clearHold';
    this.phaseStart = nowMs;
  }

  /**
   * 四连/五连合成块立刻弹出（带弹性），不再等整段动画结束。
   */
  private beginSpecialPop(nowMs: number): void {
    const wave = this.waves[this.waveIndex]!;
    for (const spawn of wave.specialSpawns) {
      this.tiles.set(spawn.tileId, {
        kind: spawn.kind,
        tileId: spawn.tileId,
        col: spawn.col,
        row: spawn.row,
        displayRow: spawn.row,
        scale: 0.2,
        alpha: 0.6,
        fromRow: spawn.row,
        toRow: spawn.row,
        clearing: false,
        spawning: false,
        specialPopping: true,
        sparkle: !!spawn.sparkle,
      });
    }
    this.phase = 'specialPop';
    this.phaseStart = nowMs;
    if (wave.specialSpawns.length === 0) {
      this.beginFall(nowMs);
    }
  }

  private beginFall(nowMs: number): void {
    const wave = this.waves[this.waveIndex]!;
    for (const tile of this.tiles.values()) {
      tile.fromRow = tile.row;
      tile.toRow = tile.row;
      tile.displayRow = tile.row;
    }
    for (const fell of wave.fell) {
      const tile = this.tiles.get(fell.tileId);
      if (!tile) {
        continue;
      }
      tile.col = fell.col;
      tile.fromRow = fell.fromRow;
      tile.toRow = fell.toRow;
      tile.row = fell.fromRow;
      tile.displayRow = fell.fromRow;
    }
    this.phase = 'fall';
    this.phaseStart = nowMs;
    if (wave.fell.length === 0) {
      this.beginSpawn(nowMs);
    }
  }

  private beginSpawn(nowMs: number): void {
    const wave = this.waves[this.waveIndex]!;
    const colCounts = new Map<number, number>();
    for (const spawn of wave.spawned) {
      colCounts.set(spawn.col, (colCounts.get(spawn.col) ?? 0) + 1);
    }
    const colCursor = new Map<number, number>();

    for (const spawn of wave.spawned) {
      const count = colCounts.get(spawn.col) ?? 1;
      const order = colCursor.get(spawn.col) ?? 0;
      colCursor.set(spawn.col, order + 1);
      const startRow = spawn.row - count - (count - order);
      this.tiles.set(spawn.tileId, {
        kind: spawn.kind,
        tileId: spawn.tileId,
        col: spawn.col,
        row: spawn.row,
        displayRow: startRow,
        scale: 0.65,
        alpha: 0.35,
        fromRow: startRow,
        toRow: spawn.row,
        clearing: false,
        spawning: true,
        specialPopping: false,
        sparkle: !!spawn.sparkle,
      });
    }

    this.phase = 'spawn';
    this.phaseStart = nowMs;
    if (wave.spawned.length === 0) {
      this.advanceWave(nowMs);
    }
  }

  private advanceWave(nowMs: number): void {
    this.waveIndex += 1;
    if (this.waveIndex >= this.waves.length) {
      this.playing = false;
      this.phase = 'done';
      this.finish();
      return;
    }
    this.phase = 'waveGap';
    this.phaseStart = nowMs;
  }

  private finish(): void {
    const cb = this.completeCb;
    this.completeCb = null;
    cb?.();
  }
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

/** 特殊块弹出：快速放大过头再回落 */
function specialPopScale(t: number): number {
  if (t < 0.55) {
    const u = t / 0.55;
    return 0.15 + 1.2 * easeOutCubic(u);
  }
  const u = (t - 0.55) / 0.45;
  return 1.35 - 0.35 * easeOutCubic(u);
}

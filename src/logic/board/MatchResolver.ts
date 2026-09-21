import { createSeededRandom } from '../../core/utils/math';
import type { BoardModel } from './BoardModel';
import { MatchFinder, type MatchSet } from './MatchFinder';
import { expandSparkleBlasts, planSpecialSpawns, type SpecialSpawn } from './SpecialRules';
import { BASIC_TILE_KINDS, isBasicTile, isHole, isSpecialTile, TileKind } from './TileType';

/** 空格子 tileId。 */
const EMPTY_TILE_ID = 0;

/** 默认最大连锁层数，防止异常盘面死循环。 */
const DEFAULT_MAX_CASCADE = 64;

/**
 * 方块下落记录：从 fromRow 落到 toRow（同一列）。
 */
export interface FellRecord {
  /** 方块稳定 id */
  tileId: number;
  /** 列 */
  col: number;
  /** 下落前行 */
  fromRow: number;
  /** 下落后行 */
  toRow: number;
}

/**
 * 顶部填充生成的新方块记录。
 */
export interface SpawnRecord {
  /** 新分配的 tileId */
  tileId: number;
  /** 行 */
  row: number;
  /** 列 */
  col: number;
  /** 方块种类 */
  kind: TileKind;
  /** 是否为闪光同色块 */
  sparkle?: boolean;
}

/**
 * 单波「消除 → 下落 → 填充」记录，供表现层按开心消消乐节奏播放。
 */
export interface ResolveWave {
  /** 本波消除格子的一维下标 */
  clearedIndices: number[];
  /** 本波消除前的种类（与 clearedIndices 等长） */
  clearedKinds: TileKind[];
  /** 本波重力下落 */
  fell: FellRecord[];
  /** 本波顶部新生 */
  spawned: SpawnRecord[];
  /** 本波合成的特殊块（四连炸弹 / 五连猫头鹰） */
  specialSpawns: SpawnRecord[];
  /** 本波在邻格小动物消掉之后削到的棉花下标 */
  chippedCloudIndices: number[];
  chippedEggIndices: number[];
  chippedVineIndices: number[];
}

/**
 * 一次完整结算（含连锁）的结果。
 */
export interface ResolveResult {
  /** 累计消除格子数（含所有连锁波次） */
  cleared: number;
  /** 本局打碎的冰块层数 */
  iceBroken: number;
  /** 连锁深度：每完成一轮「消除→下落→填充」+1；无消除时为 0 */
  cascadeDepth: number;
  /** 全部下落记录（按发生顺序） */
  fell: FellRecord[];
  /** 全部新生方块记录（按发生顺序） */
  spawned: SpawnRecord[];
  /** 各波次消除前记录的方块种类（与 cleared 等长） */
  clearedKinds: TileKind[];
  /** 分波次明细（按连锁顺序） */
  waves: ResolveWave[];
}

/**
 * 结算选项。
 */
export interface ResolveOptions {
  /** 填充用随机种子（保证可复现） */
  seed: number;
  /** 最大连锁层数，默认 64 */
  maxCascade?: number;
  /** 优先生成特殊块的格子（玩家换入位置） */
  preferredSpawnRow?: number;
  preferredSpawnCol?: number;
  /**
   * 首波直接使用的消除下标（特殊块激活已展开时传入）；
   * 不传则使用 initialMatches。
   */
  initialClearIndices?: number[];
  /** 是否尝试生成特殊块，默认 true；猫头鹰激活清色时关闭 */
  spawnSpecials?: boolean;
}

/**
 * 三消结算器：消除 → 下落（Gravity）→ 填充（Fill）→ 连锁，直至无匹配。
 *
 * 约束：
 * - 不引用 wx.* / Cocos
 * - 热点路径复用预分配缓冲，避免频繁 new
 */
export class MatchResolver {
  private readonly finder: MatchFinder;

  /** 消除前拷贝 MatchSet 下标，避免与 finder 内部缓冲别名冲突。 */
  private clearIndices: Int32Array;

  /** 下落记录缓冲（复用对象）。 */
  private readonly fellScratch: FellRecord[] = [];

  /** 新生记录缓冲（复用对象）。 */
  private readonly spawnedScratch: SpawnRecord[] = [];

  /** 消除种类缓冲（复用）。 */
  private clearedKindScratch: TileKind[] = [];

  private fellCount = 0;
  private spawnedCount = 0;
  private clearedKindCount = 0;
  private clearCapacity: number;

  /**
   * @param finder - 可选；默认内部创建 MatchFinder
   * @param maxCells - 预分配容量
   */
  public constructor(finder?: MatchFinder, maxCells = 100) {
    this.finder = finder ?? new MatchFinder(maxCells);
    this.clearIndices = new Int32Array(maxCells);
    this.clearCapacity = maxCells;
  }

  /**
   * 从给定匹配集合开始，执行完整连锁结算。
   * @param board - 棋盘（会被原地修改）
   * @param initialMatches - 首轮待消除集合；若为空且无 initialClearIndices 则直接返回零结果
   * @param options - 种子与连锁上限
   * @returns 结算结果（`fell` / `spawned` 为新数组快照，可安全保留）
   */
  public resolve(
    board: BoardModel,
    initialMatches: MatchSet,
    options: ResolveOptions,
  ): ResolveResult {
    this.resetCounters();
    const random = createSeededRandom(options.seed);
    const maxCascade = options.maxCascade ?? DEFAULT_MAX_CASCADE;

    let cleared = 0;
    let iceBroken = 0;
    let cascadeDepth = 0;
    const waves: ResolveWave[] = [];

    let clearIndicesList: number[] =
      options.initialClearIndices?.slice() ??
      Array.from(initialMatches.indices.subarray(0, initialMatches.size));

    // 首波也扩爆匹配中的炸弹
    if (!options.initialClearIndices && clearIndicesList.length > 0) {
      const set = new Set(clearIndicesList);
      expandSparkleBlasts(board, set);
      clearIndicesList = [...set];
    }

    let preferredRow = options.preferredSpawnRow;
    let preferredCol = options.preferredSpawnCol;

    while (clearIndicesList.length > 0) {
      if (cascadeDepth >= maxCascade) {
        break;
      }

      const fellBefore = this.fellCount;
      const spawnedBefore = this.spawnedCount;
      const kindsBefore = this.clearedKindCount;

      const planned: SpecialSpawn[] =
        options.spawnSpecials === false && cascadeDepth === 0
          ? []
          : cascadeDepth === 0
            ? planSpecialSpawns(board, clearIndicesList, preferredRow, preferredCol)
            : planSpecialSpawns(board, clearIndicesList);

      const clearCount = this.loadClearIndices(clearIndicesList);
      const clearedIndices: number[] = [];
      for (let i = 0; i < clearCount; i += 1) {
        const index = this.clearIndices[i]!;
        if (board.isCoveredIndex(index)) {
          continue;
        }
        clearedIndices.push(index);
      }
      const clearedNow = this.applyClear(board, clearCount);
      cleared += clearedNow.tiles;
      iceBroken += clearedNow.ice;

      const specialSpawns = this.applySpecialSpawns(board, planned);
      this.applyGravity(board);
      this.applyFill(board, random);
      cascadeDepth += 1;

      waves.push({
        clearedIndices,
        clearedKinds: this.clearedKindScratch.slice(kindsBefore, this.clearedKindCount),
        fell: this.snapshotFellRange(fellBefore, this.fellCount),
        spawned: this.snapshotSpawnedRange(spawnedBefore, this.spawnedCount),
        specialSpawns,
        chippedCloudIndices: clearedNow.cloudHits,
        chippedEggIndices: clearedNow.eggHits,
        chippedVineIndices: clearedNow.vineHits,
      });

      preferredRow = undefined;
      preferredCol = undefined;

      const nextMatches = this.finder.findMatches(board);
      if (nextMatches.isEmpty()) {
        clearIndicesList = [];
      } else {
        const set = new Set(
          Array.from(nextMatches.indices.subarray(0, nextMatches.size)),
        );
        expandSparkleBlasts(board, set);
        clearIndicesList = [...set];
      }
    }

    return {
      cleared,
      iceBroken,
      cascadeDepth,
      fell: this.snapshotFell(),
      spawned: this.snapshotSpawned(),
      clearedKinds: this.snapshotClearedKinds(),
      waves,
    };
  }

  /**
   * 先扫描盘面，若有匹配则执行完整连锁结算。
   * @param board - 棋盘
   * @param options - 种子与连锁上限
   * @returns 结算结果
   */
  public resolveBoard(board: BoardModel, options: ResolveOptions): ResolveResult {
    const matches = this.finder.findMatches(board);
    return this.resolve(board, matches, options);
  }

  /**
   * 将匹配格置为 Empty，累加消除数。
   * @param board - 棋盘
   * @param count - `clearIndices` 中有效下标数量
   * @returns 本波消除数量与碎冰数量
   */
  private applyClear(board: BoardModel, count: number): {
    tiles: number;
    ice: number;
    cloudHits: number[];
    eggHits: number[];
    vineHits: number[];
  } {
    const { cells, tileIds, sparkles } = board;
    let ice = 0;
    let tiles = 0;
    const directCloud: number[] = [];
    const directEgg: number[] = [];
    const directVine: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const index = this.clearIndices[i]!;
      const kind = cells[index] as TileKind;
      if (isHole(kind) || kind === TileKind.Empty) {
        continue;
      }
      const peeled = board.peelCoverAtIndex(index);
      if (peeled === 'cloud') {
        directCloud.push(index);
        continue;
      }
      if (peeled === 'egg') {
        directEgg.push(index);
        continue;
      }
      if (peeled === 'vine') {
        directVine.push(index);
        continue;
      }
      this.pushClearedKind(kind);
      tiles += 1;
      board.hitCloudOrGemAtIndex(index);
      if ((isBasicTile(kind) || isSpecialTile(kind)) && board.breakIceAtIndex(index)) {
        ice += 1;
      }
      cells[index] = TileKind.Empty;
      tileIds[index] = EMPTY_TILE_ID;
      sparkles[index] = 0;
    }
    const cloudHits = [
      ...directCloud,
      ...(count > 0 ? board.chipCloudsAdjacentToClears(this.clearIndices, count) : []),
    ];
    const eggHits = [
      ...directEgg,
      ...(count > 0 ? board.chipEggsAdjacentToClears(this.clearIndices, count) : []),
    ];
    const vineHits = [
      ...directVine,
      ...(count > 0 ? board.chipVinesAdjacentToClears(this.clearIndices, count) : []),
    ];
    if (count > 0) {
      ice += board.applySnowmanQuakes().ice;
      board.version += 1;
    }
    return { tiles, ice, cloudHits, eggHits, vineHits };
  }

  /**
   * 重力下落：每列自底向上压实非空块，记录 fromRow → toRow。
   * 棉花格锁住动物，不参与下落，也不让其他块穿过；洞格仍可绕开。
   */
  private applyGravity(board: BoardModel): void {
    const { rows, cols } = board.size;
    const { cells, tileIds, sparkles } = board;
    let moved = false;

    for (let c = 0; c < cols; c += 1) {
      let floor = rows - 1;
      while (floor >= 0) {
        if (board.isCoveredIndex(floor * cols + c)) {
          floor -= 1;
          continue;
        }

        let start = floor;
        while (start - 1 >= 0 && !board.isCoveredIndex((start - 1) * cols + c)) {
          start -= 1;
        }

        const falling: Array<{
          kind: TileKind;
          tileId: number;
          spark: number;
          fromRow: number;
        }> = [];
        for (let readRow = floor; readRow >= start; readRow -= 1) {
          const readIndex = readRow * cols + c;
          const kind = cells[readIndex] as TileKind;
          if (isHole(kind) || kind === TileKind.Empty) {
            continue;
          }
          falling.push({
            kind,
            tileId: tileIds[readIndex]!,
            spark: sparkles[readIndex]!,
            fromRow: readRow,
          });
        }

        let fallAt = 0;
        for (let destRow = floor; destRow >= start; destRow -= 1) {
          const destIndex = destRow * cols + c;
          if (isHole(cells[destIndex] as TileKind)) {
            continue;
          }
          const next = falling[fallAt];
          if (!next) {
            if (cells[destIndex] !== TileKind.Empty) {
              cells[destIndex] = TileKind.Empty;
              tileIds[destIndex] = EMPTY_TILE_ID;
              sparkles[destIndex] = 0;
              moved = true;
            }
            continue;
          }
          fallAt += 1;
          if (next.fromRow !== destRow) {
            cells[destIndex] = next.kind;
            tileIds[destIndex] = next.tileId;
            sparkles[destIndex] = next.spark;
            this.pushFell(next.tileId, c, next.fromRow, destRow);
            moved = true;
          }
        }

        floor = start - 1;
      }
    }

    if (moved) {
      board.version += 1;
    }
  }

  /**
   * 顶部空位填充：按 seed 从基础色块中选取种类并分配新 tileId。
   */
  private applyFill(board: BoardModel, random: () => number): void {
    const { rows, cols } = board.size;
    const { cells, tileIds, sparkles } = board;
    const kindCount = BASIC_TILE_KINDS.length;
    let spawned = false;

    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const index = r * cols + c;
        if (isHole(cells[index] as TileKind) || cells[index] !== TileKind.Empty) {
          continue;
        }
        const kind = BASIC_TILE_KINDS[Math.floor(random() * kindCount)]!;
        const tileId = board.allocTileId();
        cells[index] = kind;
        tileIds[index] = tileId;
        sparkles[index] = 0;
        this.pushSpawned(tileId, r, c, kind);
        spawned = true;
      }
    }

    if (spawned) {
      board.version += 1;
    }
  }

  /**
   * 将下标列表载入内部缓冲。
   */
  private loadClearIndices(indices: readonly number[]): number {
    const count = indices.length;
    this.ensureClearCapacity(count);
    for (let i = 0; i < count; i += 1) {
      this.clearIndices[i] = indices[i]!;
    }
    return count;
  }

  /**
   * 在已清空的格子上生成特殊块。
   */
  private applySpecialSpawns(
    board: BoardModel,
    planned: readonly SpecialSpawn[],
  ): SpawnRecord[] {
    const out: SpawnRecord[] = [];
    for (const spawn of planned) {
      const tileId = board.allocTileId();
      board.setTile(spawn.row, spawn.col, spawn.kind, tileId);
      if (spawn.sparkle) {
        board.setSparkle(spawn.row, spawn.col, true);
      }
      out.push({
        tileId,
        row: spawn.row,
        col: spawn.col,
        kind: spawn.kind,
        sparkle: spawn.sparkle,
      });
    }
    return out;
  }

  /**
   * 追加一条下落记录（复用对象槽位）。
   */
  private pushFell(tileId: number, col: number, fromRow: number, toRow: number): void {
    if (this.fellCount >= this.fellScratch.length) {
      this.fellScratch.push({ tileId: 0, col: 0, fromRow: 0, toRow: 0 });
    }
    const rec = this.fellScratch[this.fellCount]!;
    rec.tileId = tileId;
    rec.col = col;
    rec.fromRow = fromRow;
    rec.toRow = toRow;
    this.fellCount += 1;
  }

  /**
   * 追加一条新生记录（复用对象槽位）。
   */
  private pushSpawned(tileId: number, row: number, col: number, kind: TileKind): void {
    if (this.spawnedCount >= this.spawnedScratch.length) {
      this.spawnedScratch.push({
        tileId: 0,
        row: 0,
        col: 0,
        kind: TileKind.Empty,
      });
    }
    const rec = this.spawnedScratch[this.spawnedCount]!;
    rec.tileId = tileId;
    rec.row = row;
    rec.col = col;
    rec.kind = kind;
    this.spawnedCount += 1;
  }

  /**
   * 导出下落快照（浅拷贝记录对象，避免后续 resolve 覆盖）。
   */
  private snapshotFell(): FellRecord[] {
    return this.snapshotFellRange(0, this.fellCount);
  }

  /**
   * 导出 [from, to) 区间的下落快照。
   */
  private snapshotFellRange(from: number, to: number): FellRecord[] {
    const out: FellRecord[] = new Array(to - from);
    for (let i = from; i < to; i += 1) {
      const src = this.fellScratch[i]!;
      out[i - from] = {
        tileId: src.tileId,
        col: src.col,
        fromRow: src.fromRow,
        toRow: src.toRow,
      };
    }
    return out;
  }

  /**
   * 导出新生快照。
   */
  private snapshotSpawned(): SpawnRecord[] {
    return this.snapshotSpawnedRange(0, this.spawnedCount);
  }

  /**
   * 导出 [from, to) 区间的新生快照。
   */
  private snapshotSpawnedRange(from: number, to: number): SpawnRecord[] {
    const out: SpawnRecord[] = new Array(to - from);
    for (let i = from; i < to; i += 1) {
      const src = this.spawnedScratch[i]!;
      out[i - from] = {
        tileId: src.tileId,
        row: src.row,
        col: src.col,
        kind: src.kind,
      };
    }
    return out;
  }

  /**
   * 追加一个被消除的种类。
   * @param kind - 消除前的种类
   */
  private pushClearedKind(kind: TileKind): void {
    if (this.clearedKindCount >= this.clearedKindScratch.length) {
      this.clearedKindScratch.push(TileKind.Empty);
    }
    this.clearedKindScratch[this.clearedKindCount] = kind;
    this.clearedKindCount += 1;
  }

  /**
   * 导出消除种类快照。
   */
  private snapshotClearedKinds(): TileKind[] {
    return this.clearedKindScratch.slice(0, this.clearedKindCount);
  }

  /** 重置波次计数器。 */
  private resetCounters(): void {
    this.fellCount = 0;
    this.spawnedCount = 0;
    this.clearedKindCount = 0;
  }

  /**
   * 确保消除下标缓冲足够大。
   * @param count - 需要的最小容量
   */
  private ensureClearCapacity(count: number): void {
    if (count <= this.clearCapacity) {
      return;
    }
    this.clearCapacity = count;
    this.clearIndices = new Int32Array(count);
  }
}

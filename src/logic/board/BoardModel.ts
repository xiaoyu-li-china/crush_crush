import { isBasicTile, TileKind, type BoardSize } from './TileType';

export type { BoardSize };

export const BURIED_SNOWMAN = 1;
export const BURIED_PENGUIN = 2;

/** 企鹅优先竖站 2 格；雪人固定 2×2。其它连通形作回退。 */
const BURIED_SHAPES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [0, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
];

export interface BuriedGroup {
  id: number;
  kind: number;
  cells: number[];
  revealed: boolean;
}

/** 空格子对应的 tileId，表示无可映射视图节点。 */
const EMPTY_TILE_ID = 0;

/** 一格棉花需要相邻消除几次才能清掉。 */
export const CLOUD_HIT_LAYERS = 2;

/**
 * 棋盘数据模型。
 *
 * 使用行优先一维 TypedArray 存储盘面，降低微信环境下频繁 GC 的压力：
 * - `cells`：`Int8Array`，存 `TileKind`
 * - `tileIds`：平行 `Int32Array`，存稳定 id（供表现层映射）
 *
 * 本类不依赖 wx.* / Cocos，可在 Node 单测中直接使用。
 */
export class BoardModel {
  /** 棋盘尺寸（构造后只读）。 */
  public readonly size: BoardSize;

  /** 行优先一维数组，存方块种类。 */
  public readonly cells: Int8Array;

  /** 与 `cells` 平行的 tileId 数组；空格为 0。 */
  public readonly tileIds: Int32Array;

  /**
   * 与 `cells` 平行：1 = 四连/L·T 合成的「闪光」同色块（再次三消时小范围爆炸）。
   */
  public readonly sparkles: Uint8Array;

  /**
   * 与 `cells` 平行：格子上的冰块层数（0 = 无冰）。冰块贴在格子上，不随方块下落。
   */
  public readonly ice: Uint8Array;

  /** 棉花层数（0 = 无；满层为 `CLOUD_HIT_LAYERS`）。贴在格子上，不随方块下落。 */
  public readonly cloud: Uint8Array;

  /** 粉色圆球（0/1）。在云层之下，不随方块下落。 */
  public readonly gem: Uint8Array;

  /** 冰下埋藏：0 无，1 雪人，2 企鹅。不随方块下落。 */
  public readonly buried: Uint8Array;

  /** 同一只雪人/企鹅共用一个 id；0 表示单格（旧数据）。 */
  public readonly buriedId: Uint8Array;

  /** 雪人是否已震动过（揭开后只震一次）。 */
  public readonly snowmanQuaked: Uint8Array;

  /** 蛋壳层数（0 无）。砸碎后收获萌鸡。 */
  public readonly egg: Uint8Array;

  /** 藤蔓层数（0 无）。缠住格子，邻消可解开。 */
  public readonly vine: Uint8Array;

  /**
   * 盘面版本号。
   * 每次发生写入类变更（set / swap / fill 等）时 +1，供视图脏检查。
   */
  public version: number;

  /** 下一个可分配的 tileId（从 1 递增）。 */
  private nextTileId: number;

  /**
   * 创建空棋盘（全部为 Empty）。
   * @param size - 行列尺寸，必须为正整数
   * @param nextTileId - 起始 tileId，默认 1
   */
  public constructor(size: BoardSize, nextTileId = 1) {
    if (size.rows <= 0 || size.cols <= 0) {
      throw new Error(`Invalid board size: ${size.rows}x${size.cols}`);
    }
    const length = size.rows * size.cols;
    this.size = { rows: size.rows, cols: size.cols };
    this.cells = new Int8Array(length);
    this.tileIds = new Int32Array(length);
    this.sparkles = new Uint8Array(length);
    this.ice = new Uint8Array(length);
    this.cloud = new Uint8Array(length);
    this.gem = new Uint8Array(length);
    this.buried = new Uint8Array(length);
    this.buriedId = new Uint8Array(length);
    this.snowmanQuaked = new Uint8Array(length);
    this.egg = new Uint8Array(length);
    this.vine = new Uint8Array(length);
    this.version = 0;
    this.nextTileId = nextTileId;
  }

  /** 为 true 时，有冰的格子上的动物不能交换（第 7/8 关冰封）。 */
  public iceLocksTiles = false;

  /**
   * 格子总数（rows × cols）。
   */
  public get length(): number {
    return this.cells.length;
  }

  /**
   * 将 (row, col) 转为行优先一维下标。
   * @param row - 行（从 0 起）
   * @param col - 列（从 0 起）
   * @returns 一维下标
   */
  public index(row: number, col: number): number {
    return row * this.size.cols + col;
  }

  /**
   * 判断坐标是否在棋盘范围内。
   * @param row - 行
   * @param col - 列
   * @returns 是否合法
   */
  public inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.size.rows && col >= 0 && col < this.size.cols;
  }

  /**
   * 读取指定格子的方块种类。
   * @param row - 行
   * @param col - 列
   * @returns 方块种类
   */
  public getTile(row: number, col: number): TileKind {
    this.assertInBounds(row, col);
    return this.cells[this.index(row, col)] as TileKind;
  }

  /**
   * 读取指定格子的 tileId。
   * @param row - 行
   * @param col - 列
   * @returns tileId；空格为 0
   */
  public getTileId(row: number, col: number): number {
    this.assertInBounds(row, col);
    return this.tileIds[this.index(row, col)];
  }

  /**
   * 写入指定格子的方块种类。
   * - 写入 `Empty` 时清除 tileId 与闪光标记
   * - 写入非空且未指定 `tileId` 时，若原为空则分配新 id，否则保留原 id
   * - 默认清除闪光；需要闪光请再用 `setSparkle`
   */
  public setTile(row: number, col: number, kind: TileKind, tileId?: number): void {
    this.assertInBounds(row, col);
    const i = this.index(row, col);
    this.cells[i] = kind;
    this.sparkles[i] = 0;

    if (kind === TileKind.Empty || kind === TileKind.Hole) {
      this.tileIds[i] = EMPTY_TILE_ID;
    } else if (tileId !== undefined) {
      this.tileIds[i] = tileId;
    } else if (this.tileIds[i] === EMPTY_TILE_ID) {
      this.tileIds[i] = this.allocTileId();
    }

    this.bumpVersion();
  }

  /**
   * 是否为四连合成的闪光块。
   */
  public isSparkle(row: number, col: number): boolean {
    this.assertInBounds(row, col);
    return this.sparkles[this.index(row, col)] === 1;
  }

  /**
   * 设置/清除闪光标记（不改变 kind）。
   */
  public setSparkle(row: number, col: number, sparkle: boolean): void {
    this.assertInBounds(row, col);
    const i = this.index(row, col);
    if (this.cells[i] === TileKind.Empty || this.cells[i] === TileKind.Hole) {
      this.sparkles[i] = 0;
      return;
    }
    this.sparkles[i] = sparkle ? 1 : 0;
    this.bumpVersion();
  }

  /**
   * 将指定格子清空为 Empty。
   */
  public clearTile(row: number, col: number): void {
    const index = this.index(row, col);
    const kind = this.cells[index] as TileKind;
    if (this.peelCoverAtIndex(index)) {
      return;
    }
    this.hitCloudOrGemAtIndex(index);
    if (kind !== TileKind.Empty && kind !== TileKind.Hole) {
      this.breakIceAtIndex(index);
    }
    this.applySnowmanQuakes();
    this.setTile(row, col, TileKind.Empty, EMPTY_TILE_ID);
  }

  public getIce(row: number, col: number): number {
    this.assertInBounds(row, col);
    return this.ice[this.index(row, col)]!;
  }

  public setIce(row: number, col: number, layers: number): void {
    this.assertInBounds(row, col);
    this.ice[this.index(row, col)] = Math.max(0, Math.min(3, Math.floor(layers)));
    this.bumpVersion();
  }

  /** @returns 是否打碎了一层冰 */
  public breakIceAtIndex(index: number): boolean {
    if (index < 0 || index >= this.ice.length) {
      return false;
    }
    if (this.ice[index]! <= 0) {
      return false;
    }
    this.ice[index]! -= 1;
    this.bumpVersion();
    return true;
  }

  public countIce(): number {
    let n = 0;
    for (let i = 0; i < this.ice.length; i += 1) {
      n += this.ice[i]!;
    }
    return n;
  }

  /** 给每个非洞格铺一层冰，返回冰块格数。 */
  public coverPlayableWithIce(): number {
    let n = 0;
    for (let i = 0; i < this.length; i += 1) {
      if ((this.cells[i] as TileKind) === TileKind.Hole) {
        continue;
      }
      this.ice[i] = 1;
      n += 1;
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  /** 全盘铺冰，但最上 skip 行不铺（跳过洞格）。row 越大越靠屏幕上方。 */
  public coverPlayableSkippingTopRows(skipTopRows: number): number {
    const skip = Math.max(0, Math.min(this.size.rows, Math.floor(skipTopRows)));
    const lastIcedRow = this.size.rows - 1 - skip;
    let n = 0;
    for (let r = 0; r <= lastIcedRow; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if ((this.cells[i] as TileKind) === TileKind.Hole) {
          continue;
        }
        this.ice[i] = 1;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  /** 从棋盘底部向上铺若干行冰（跳过洞格），返回冰块格数。 */
  public coverBottomRowsWithIce(bottomRows: number): number {
    const rows = Math.max(0, Math.min(this.size.rows, Math.floor(bottomRows)));
    let n = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if ((this.cells[i] as TileKind) === TileKind.Hole) {
          continue;
        }
        this.ice[i] = 1;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  public getCloud(row: number, col: number): number {
    this.assertInBounds(row, col);
    return this.cloud[this.index(row, col)]!;
  }

  public getEgg(row: number, col: number): number {
    this.assertInBounds(row, col);
    return this.egg[this.index(row, col)]!;
  }

  public getVine(row: number, col: number): number {
    this.assertInBounds(row, col);
    return this.vine[this.index(row, col)]!;
  }

  /** 棉花 / 蛋壳 / 藤蔓盖住的格子：不能三消、不能交换、不下落。 */
  public isCoveredIndex(index: number): boolean {
    if (index < 0 || index >= this.length) {
      return false;
    }
    return this.cloud[index]! > 0 || this.egg[index]! > 0 || this.vine[index]! > 0;
  }

  /** 锤子 / 爆破打在覆盖层上时削一层，返回被削的种类。 */
  public peelCoverAtIndex(index: number): 'cloud' | 'egg' | 'vine' | null {
    if (index < 0 || index >= this.length) {
      return null;
    }
    if (this.cloud[index]! > 0) {
      this.cloud[index]!--;
      this.bumpVersion();
      return 'cloud';
    }
    if (this.egg[index]! > 0) {
      this.egg[index]!--;
      this.bumpVersion();
      return 'egg';
    }
    if (this.vine[index]! > 0) {
      this.vine[index]!--;
      this.bumpVersion();
      return 'vine';
    }
    return null;
  }

  public getGem(row: number, col: number): number {
    this.assertInBounds(row, col);
    return this.gem[this.index(row, col)]!;
  }

  public getBuried(row: number, col: number): number {
    this.assertInBounds(row, col);
    return this.buried[this.index(row, col)]!;
  }

  public isBuriedRevealed(row: number, col: number): boolean {
    this.assertInBounds(row, col);
    const i = this.index(row, col);
    if (this.buried[i]! <= 0) {
      return false;
    }
    return this.isBuriedGroupFullyClear(this.buriedGroupIdAt(i));
  }

  /**
   * 在可玩格上铺雪人/企鹅，藏在冰下；占地格子上的冰全碎后自动收获。
   */
  public placeBuried(
    snowmen: number,
    penguins: number,
    seed: number,
    options?: { skipTopRows?: number; requireIce?: boolean },
  ): {
    snowmen: number;
    penguins: number;
  } {
    const wantS = Math.max(0, Math.floor(snowmen));
    const wantP = Math.max(0, Math.floor(penguins));
    const skip = Math.max(0, Math.floor(options?.skipTopRows ?? 0));
    const requireIce = options?.requireIce === true;
    const maxRow = this.size.rows - 1 - skip;
    const playable: number[] = [];
    for (let r = 0; r <= maxRow; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if ((this.cells[i] as TileKind) === TileKind.Hole) {
          continue;
        }
        if (requireIce && this.ice[i]! <= 0) {
          continue;
        }
        playable.push(i);
      }
    }
    let rng = seed >>> 0 || 1;
    const next = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng;
    };
    const occupied = new Set<number>();
    let nextId = 1;
    const placeKind = (kind: number, count: number): number => {
      let placed = 0;
      for (let n = 0; n < count; n += 1) {
        const cells = this.pickBuriedShape(
          playable,
          occupied,
          kind === BURIED_SNOWMAN ? 4 : 2,
          next,
          kind === BURIED_PENGUIN,
        );
        if (!cells) {
          continue;
        }
        const id = nextId;
        nextId += 1;
        for (const i of cells) {
          this.buried[i] = kind;
          this.buriedId[i] = id;
          occupied.add(i);
        }
        placed += 1;
      }
      return placed;
    };
    const snowCount = placeKind(BURIED_SNOWMAN, wantS);
    const penguinCount = placeKind(BURIED_PENGUIN, wantP);
    if (snowCount + penguinCount > 0) {
      this.bumpVersion();
    }
    if (requireIce) {
      return this.removeBuriedNotUnderIce();
    }
    return { snowmen: snowCount, penguins: penguinCount };
  }

  /** 去掉没被冰完全盖住的雪人/企鹅，只留冰层下的。 */
  public removeBuriedNotUnderIce(): { snowmen: number; penguins: number } {
    let removed = false;
    for (const group of this.listBuriedGroups()) {
      const covered = group.cells.every((i) => this.ice[i]! > 0);
      if (covered) {
        continue;
      }
      for (const i of group.cells) {
        this.buried[i] = 0;
        this.buriedId[i] = 0;
      }
      removed = true;
    }
    if (removed) {
      this.bumpVersion();
    }
    return {
      snowmen: this.countBuried(BURIED_SNOWMAN),
      penguins: this.countBuried(BURIED_PENGUIN),
    };
  }

  public listBuriedGroups(): BuriedGroup[] {
    const map = new Map<number, BuriedGroup>();
    for (let i = 0; i < this.buried.length; i += 1) {
      const kind = this.buried[i]!;
      if (kind <= 0) {
        continue;
      }
      const id = this.buriedGroupIdAt(i);
      let group = map.get(id);
      if (!group) {
        group = { id, kind, cells: [], revealed: true };
        map.set(id, group);
      }
      group.cells.push(i);
      if (this.ice[i]! > 0) {
        group.revealed = false;
      }
    }
    return [...map.values()];
  }

  public countBuried(kind: number): number {
    let n = 0;
    for (const group of this.listBuriedGroups()) {
      if (group.kind === kind) {
        n += 1;
      }
    }
    return n;
  }

  public countRevealedBuried(kind: number): number {
    const harvested = kind === BURIED_SNOWMAN ? this.harvestedSnowmen : this.harvestedPenguins;
    let n = 0;
    for (const group of this.listBuriedGroups()) {
      if (group.kind === kind && group.revealed) {
        n += 1;
      }
    }
    return harvested + n;
  }

  public hasRevealedUnharvestedBuried(): boolean {
    return this.listBuriedGroups().some((group) => group.revealed);
  }

  /** 收走指定已完全露出来的一只，返回被收格子。 */
  public harvestBuriedGroup(groupId: number): number[] {
    return this.harvestBuriedWhere((group) => group.revealed && group.id === groupId);
  }

  /** 冰碎露出的雪人/企鹅收走，返回被收格子。 */
  public harvestRevealedBuried(): number[] {
    return this.harvestBuriedWhere((group) => group.revealed);
  }

  private harvestBuriedWhere(match: (group: BuriedGroup) => boolean): number[] {
    const taken: number[] = [];
    for (const group of this.listBuriedGroups()) {
      if (!match(group)) {
        continue;
      }
      if (group.kind === BURIED_SNOWMAN) {
        this.harvestedSnowmen += 1;
      } else if (group.kind === BURIED_PENGUIN) {
        this.harvestedPenguins += 1;
      }
      for (const i of group.cells) {
        this.buried[i] = 0;
        this.buriedId[i] = 0;
        taken.push(i);
      }
    }
    if (taken.length > 0) {
      this.bumpVersion();
    }
    return taken;
  }

  /**
   * 整只雪人的格子冰都碎了且尚未震动：震碎占地外围上下左右的冰。
   */
  public applySnowmanQuakes(): { ice: number; centers: number[] } {
    const cols = this.size.cols;
    const rows = this.size.rows;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let ice = 0;
    const centers: number[] = [];
    let guard = 0;
    while (guard < 12) {
      guard += 1;
      let progressed = false;
      for (const group of this.listBuriedGroups()) {
        if (group.kind !== BURIED_SNOWMAN || !group.revealed) {
          continue;
        }
        if (group.cells.some((cell) => this.snowmanQuaked[cell]! > 0)) {
          continue;
        }
        const footprint = new Set(group.cells);
        for (const i of group.cells) {
          this.snowmanQuaked[i] = 1;
        }
        centers.push(group.cells[0]!);
        progressed = true;
        for (const i of group.cells) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) {
              continue;
            }
            const ni = this.index(nr, nc);
            if (footprint.has(ni) || (this.cells[ni] as TileKind) === TileKind.Hole) {
              continue;
            }
            if (this.breakIceAtIndex(ni)) {
              ice += 1;
            }
          }
        }
      }
      if (!progressed) {
        break;
      }
    }
    if (centers.length > 0) {
      this.lastSnowmanQuakeCenters = this.lastSnowmanQuakeCenters.concat(centers);
    }
    return { ice, centers };
  }

  public lastSnowmanQuakeCenters: number[] = [];
  public harvestedSnowmen = 0;
  public harvestedPenguins = 0;

  private buriedGroupIdAt(index: number): number {
    const tagged = this.buriedId[index]!;
    return tagged > 0 ? tagged : index + 1;
  }

  private isBuriedGroupFullyClear(groupId: number): boolean {
    for (let i = 0; i < this.buried.length; i += 1) {
      if (this.buried[i]! <= 0 || this.buriedGroupIdAt(i) !== groupId) {
        continue;
      }
      if (this.ice[i]! > 0) {
        return false;
      }
    }
    return true;
  }

  private pickBuriedShape(
    playable: number[],
    occupied: Set<number>,
    size: number,
    next: () => number,
    preferVertical = false,
  ): number[] | null {
    const cols = this.size.cols;
    const rows = this.size.rows;
    const allowed = new Set(playable);
    const verticalTwo: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
      [
        [0, 0],
        [1, 0],
      ],
    ];
    const shapes =
      size === 4
        ? ([
            [
              [0, 0],
              [0, 1],
              [1, 0],
              [1, 1],
            ],
          ] as ReadonlyArray<ReadonlyArray<readonly [number, number]>>)
        : size === 2
          ? BURIED_SHAPES.filter((shape) => shape.length === 2)
          : BURIED_SHAPES.filter((shape) => shape.length === size);
    if (shapes.length === 0 || playable.length === 0) {
      return null;
    }
    const tooClose = (cells: number[]) => {
      for (const a of cells) {
        const r = Math.floor(a / cols);
        const c = a % cols;
        for (const b of occupied) {
          const or = Math.floor(b / cols);
          const oc = b % cols;
          if (Math.abs(or - r) + Math.abs(oc - c) < 2) {
            return true;
          }
        }
      }
      return false;
    };
    const maxAttempts = playable.length * Math.max(4, shapes.length * 3);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const origin = playable[next() % playable.length]!;
      const shape =
        preferVertical && size === 2 && attempt < maxAttempts * 0.75
          ? verticalTwo[0]!
          : shapes[next() % shapes.length]!;
      const or = Math.floor(origin / cols);
      const oc = origin % cols;
      const cells: number[] = [];
      let ok = true;
      for (const [dr, dc] of shape) {
        const r = or + dr;
        const c = oc + dc;
        if (r < 0 || c < 0 || r >= rows || c >= cols) {
          ok = false;
          break;
        }
        const i = this.index(r, c);
        if (!allowed.has(i) || occupied.has(i) || cells.includes(i)) {
          ok = false;
          break;
        }
        cells.push(i);
      }
      if (!ok || cells.length !== size) {
        continue;
      }
      if (occupied.size > 0 && tooClose(cells) && attempt < maxAttempts * 0.7) {
        continue;
      }
      return cells;
    }
    return null;
  }

  /** 先打掉一层棉花；没有棉花则收集粉球。 */
  public hitCloudOrGemAtIndex(index: number): { cloud: boolean; gem: boolean } {
    if (index < 0 || index >= this.cloud.length) {
      return { cloud: false, gem: false };
    }
    if (this.cloud[index]! > 0) {
      this.cloud[index]! -= 1;
      this.bumpVersion();
      return { cloud: true, gem: false };
    }
    if (this.gem[index]! > 0) {
      this.gem[index]! -= 1;
      this.bumpVersion();
      return { cloud: false, gem: true };
    }
    return { cloud: false, gem: false };
  }

  /**
   * 本波已清空的格子，四向各削一层相邻棉花；同一格棉花每波最多削一次。
   * @returns 被削到的棉花下标
   */
  public chipCloudsAdjacentToClears(clearedIndices: ArrayLike<number>, count: number): number[] {
    return this.chipLayerAdjacentToClears(this.cloud, clearedIndices, count);
  }

  public chipEggsAdjacentToClears(clearedIndices: ArrayLike<number>, count: number): number[] {
    return this.chipLayerAdjacentToClears(this.egg, clearedIndices, count);
  }

  public chipVinesAdjacentToClears(clearedIndices: ArrayLike<number>, count: number): number[] {
    return this.chipLayerAdjacentToClears(this.vine, clearedIndices, count);
  }

  private chipLayerAdjacentToClears(
    layer: Uint8Array,
    clearedIndices: ArrayLike<number>,
    count: number,
  ): number[] {
    const { rows, cols } = this.size;
    const seen = new Uint8Array(this.length);
    const hit: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const index = clearedIndices[i]!;
      if (index < 0 || index >= this.length) {
        continue;
      }
      if ((this.cells[index] as TileKind) !== TileKind.Empty) {
        continue;
      }
      const r = Math.floor(index / cols);
      const c = index % cols;
      const neighbors = [
        r > 0 ? index - cols : -1,
        r < rows - 1 ? index + cols : -1,
        c > 0 ? index - 1 : -1,
        c < cols - 1 ? index + 1 : -1,
      ];
      for (const ni of neighbors) {
        if (ni < 0 || seen[ni]! > 0) {
          continue;
        }
        if (layer[ni]! <= 0) {
          continue;
        }
        seen[ni] = 1;
        layer[ni]!--;
        hit.push(ni);
      }
    }
    if (hit.length > 0) {
      this.bumpVersion();
    }
    return hit;
  }

  public countEggs(): number {
    let n = 0;
    for (let i = 0; i < this.egg.length; i += 1) {
      if (this.egg[i]! > 0) {
        n += 1;
      }
    }
    return n;
  }

  public countVines(): number {
    let n = 0;
    for (let i = 0; i < this.vine.length; i += 1) {
      if (this.vine[i]! > 0) {
        n += 1;
      }
    }
    return n;
  }

  /** 在可玩格上放蛋壳，返回蛋数。 */
  public placeEggs(count: number, layers: number, seed: number): number {
    const want = Math.max(0, Math.floor(count));
    const hp = Math.max(1, Math.min(3, Math.floor(layers)));
    const playable: number[] = [];
    for (let i = 0; i < this.length; i += 1) {
      const kind = this.cells[i] as TileKind;
      if (kind === TileKind.Hole || kind === TileKind.Empty) {
        continue;
      }
      playable.push(i);
    }
    let rng = seed >>> 0 || 1;
    const next = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng;
    };
    let placed = 0;
    const used = new Set<number>();
    for (let n = 0; n < want && playable.length > 0; n += 1) {
      let pick = playable[next() % playable.length]!;
      let guard = 0;
      while (used.has(pick) && guard < playable.length) {
        pick = playable[next() % playable.length]!;
        guard += 1;
      }
      if (used.has(pick)) {
        continue;
      }
      used.add(pick);
      this.egg[pick] = hp;
      placed += 1;
    }
    if (placed > 0) {
      this.bumpVersion();
    }
    return placed;
  }

  /** 按图案铺绿藤，返回藤蔓格数。 */
  public placeVines(
    options: {
      pattern: 'scatter' | 'columns' | 'rows' | 'clusters' | 'web';
      count?: number;
      layers: number;
    },
    seed: number,
  ): number {
    const hp = Math.max(1, Math.min(3, Math.floor(options.layers)));
    const { rows, cols } = this.size;
    const marks = new Uint8Array(this.length);
    const mark = (i: number) => {
      if (i < 0 || i >= this.length) {
        return;
      }
      if ((this.cells[i] as TileKind) === TileKind.Hole) {
        return;
      }
      marks[i] = 1;
    };
    let rng = seed >>> 0 || 1;
    const next = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng;
    };
    if (options.pattern === 'scatter') {
      const want = Math.max(0, Math.floor(options.count ?? 12));
      const playable: number[] = [];
      for (let i = 0; i < this.length; i += 1) {
        if ((this.cells[i] as TileKind) !== TileKind.Hole) {
          playable.push(i);
        }
      }
      for (let n = 0; n < want && playable.length > 0; n += 1) {
        const idx = next() % playable.length;
        mark(playable[idx]!);
        playable.splice(idx, 1);
      }
    } else if (options.pattern === 'columns') {
      const c0 = 2;
      const c1 = cols - 3;
      for (let r = 0; r < rows; r += 1) {
        mark(this.index(r, c0));
        mark(this.index(r, c1));
      }
    } else if (options.pattern === 'rows') {
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          mark(this.index(r, c));
        }
      }
    } else if (options.pattern === 'clusters') {
      const starts = [
        [1, 1],
        [1, cols - 3],
        [rows - 3, 1],
        [rows - 3, cols - 3],
      ];
      for (const [sr, sc] of starts) {
        for (let dr = 0; dr < 2; dr += 1) {
          for (let dc = 0; dc < 2; dc += 1) {
            mark(this.index(sr + dr, sc + dc));
          }
        }
      }
    } else {
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1 || (r + c) % 2 === 0) {
            mark(this.index(r, c));
          }
        }
      }
    }
    let n = 0;
    for (let i = 0; i < this.length; i += 1) {
      if (marks[i]! > 0) {
        this.vine[i] = hp;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  /** 开局放猫头鹰和闪光，优先放在未覆盖、未冰封的可玩格。 */
  public placeStarterSpecials(
    options: { owls?: number; sparkles?: number },
    seed: number,
  ): { owls: number; sparkles: number } {
    const wantOwls = Math.max(0, Math.floor(options.owls ?? 0));
    const wantSpark = Math.max(0, Math.floor(options.sparkles ?? 0));
    const collect = (allowIce: boolean): number[] => {
      const slots: number[] = [];
      for (let i = 0; i < this.length; i += 1) {
        const kind = this.cells[i] as TileKind;
        if (!isBasicTile(kind)) {
          continue;
        }
        if (this.isCoveredIndex(i)) {
          continue;
        }
        if (!allowIce && this.iceLocksTiles && this.ice[i]! > 0) {
          continue;
        }
        slots.push(i);
      }
      return slots;
    };
    let slots = collect(false);
    if (slots.length < wantOwls + wantSpark) {
      slots = collect(true);
    }
    let rng = seed >>> 0 || 1;
    const next = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng;
    };
    let owls = 0;
    let sparkles = 0;
    const take = (): number | null => {
      if (slots.length === 0) {
        return null;
      }
      const pick = next() % slots.length;
      return slots.splice(pick, 1)[0] ?? null;
    };
    const { cols } = this.size;
    for (let n = 0; n < wantOwls; n += 1) {
      const index = take();
      if (index === null) {
        break;
      }
      this.setTile(Math.floor(index / cols), index % cols, TileKind.ColorBomb);
      owls += 1;
    }
    for (let n = 0; n < wantSpark; n += 1) {
      const index = take();
      if (index === null) {
        break;
      }
      this.setSparkle(Math.floor(index / cols), index % cols, true);
      sparkles += 1;
    }
    return { owls, sparkles };
  }

  public countGems(): number {
    let n = 0;
    for (let i = 0; i < this.gem.length; i += 1) {
      n += this.gem[i]!;
    }
    return n;
  }

  /** 仍盖着棉花的格数（不论剩余层数）。 */
  public countCloud(): number {
    let n = 0;
    for (let i = 0; i < this.cloud.length; i += 1) {
      if (this.cloud[i]! > 0) {
        n += 1;
      }
    }
    return n;
  }

  /** 给每个非洞格铺满层棉花，返回格数。 */
  public coverPlayableWithCloud(): number {
    let n = 0;
    for (let i = 0; i < this.length; i += 1) {
      if ((this.cells[i] as TileKind) === TileKind.Hole) {
        continue;
      }
      this.cloud[i] = CLOUD_HIT_LAYERS;
      n += 1;
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  /** 从底部铺 N 格满层棉花+粉球，返回实际格数。 */
  public coverBottomCloudGems(count: number): number {
    const want = Math.max(0, Math.floor(count));
    let n = 0;
    for (let r = 0; r < this.size.rows && n < want; r += 1) {
      for (let c = 0; c < this.size.cols && n < want; c += 1) {
        const i = this.index(r, c);
        if ((this.cells[i] as TileKind) === TileKind.Hole) {
          continue;
        }
        this.cloud[i] = CLOUD_HIT_LAYERS;
        this.gem[i] = 1;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  /** 全盘铺棉花但最上若干行留空，返回格数。 */
  public coverPlayableSkippingTopRowsWithCloud(skipTopRows: number): number {
    const skip = Math.max(0, Math.min(this.size.rows, Math.floor(skipTopRows)));
    const last = this.size.rows - 1 - skip;
    let n = 0;
    for (let r = 0; r <= last; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if ((this.cells[i] as TileKind) === TileKind.Hole) {
          continue;
        }
        this.cloud[i] = CLOUD_HIT_LAYERS;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  /** 从底部向上铺若干行满层棉花（跳过洞格）。 */
  public coverBottomRowsWithCloud(bottomRows: number): number {
    const rows = Math.max(0, Math.min(this.size.rows, Math.floor(bottomRows)));
    let n = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if ((this.cells[i] as TileKind) === TileKind.Hole) {
          continue;
        }
        this.cloud[i] = CLOUD_HIT_LAYERS;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  /** 从底部铺 N 个粉球（不改云）。 */
  public placeGemsFromBottom(count: number): number {
    const want = Math.max(0, Math.floor(count));
    let n = 0;
    for (let r = 0; r < this.size.rows && n < want; r += 1) {
      for (let c = 0; c < this.size.cols && n < want; c += 1) {
        const i = this.index(r, c);
        if ((this.cells[i] as TileKind) === TileKind.Hole) {
          continue;
        }
        this.gem[i] = 1;
        n += 1;
      }
    }
    if (n > 0) {
      this.bumpVersion();
    }
    return n;
  }

  /**
   * 交换两个格子的 kind、tileId 与闪光标记（原子一次变更，version 只 +1）。
   */
  public swap(row1: number, col1: number, row2: number, col2: number): void {
    this.assertInBounds(row1, col1);
    this.assertInBounds(row2, col2);

    const ia = this.index(row1, col1);
    const ib = this.index(row2, col2);

    const kindA = this.cells[ia];
    this.cells[ia] = this.cells[ib];
    this.cells[ib] = kindA;

    const idA = this.tileIds[ia];
    this.tileIds[ia] = this.tileIds[ib];
    this.tileIds[ib] = idA;

    const sparkA = this.sparkles[ia];
    this.sparkles[ia] = this.sparkles[ib]!;
    this.sparkles[ib] = sparkA!;

    this.bumpVersion();
  }

  /**
   * 回填所有空位：对 Empty 格调用 `kindProvider` 生成新块并分配 tileId。
   */
  public fillEmpty(kindProvider: (row: number, col: number) => TileKind): void {
    let changed = false;
    for (let r = 0; r < this.size.rows; r += 1) {
      for (let c = 0; c < this.size.cols; c += 1) {
        const i = this.index(r, c);
        if (this.cells[i] !== TileKind.Empty) {
          continue;
        }
        const kind = kindProvider(r, c);
        this.cells[i] = kind;
        this.sparkles[i] = 0;
        this.tileIds[i] = kind === TileKind.Empty ? EMPTY_TILE_ID : this.allocTileId();
        changed = true;
      }
    }
    if (changed) {
      this.bumpVersion();
    }
  }

  /**
   * 深拷贝盘面（试交换 / 单测用）。
   */
  public clone(): BoardModel {
    const copy = new BoardModel(this.size, this.nextTileId);
    copy.cells.set(this.cells);
    copy.tileIds.set(this.tileIds);
    copy.sparkles.set(this.sparkles);
    copy.ice.set(this.ice);
    copy.cloud.set(this.cloud);
    copy.gem.set(this.gem);
    copy.buried.set(this.buried);
    copy.buriedId.set(this.buriedId);
    copy.snowmanQuaked.set(this.snowmanQuaked);
    copy.egg.set(this.egg);
    copy.vine.set(this.vine);
    copy.iceLocksTiles = this.iceLocksTiles;
    copy.harvestedSnowmen = this.harvestedSnowmen;
    copy.harvestedPenguins = this.harvestedPenguins;
    copy.version = this.version;
    return copy;
  }

  /**
   * 分配新的稳定 tileId。
   * @returns 新 id（≥ 1）
   */
  public allocTileId(): number {
    const id = this.nextTileId;
    this.nextTileId += 1;
    return id;
  }

  /**
   * 读取下一枚将分配的 tileId（不递增，供单测断言）。
   * @returns 下一个 tileId
   */
  public peekNextTileId(): number {
    return this.nextTileId;
  }

  /** 版本号 +1。 */
  private bumpVersion(): void {
    this.version += 1;
  }

  /**
   * 越界则抛错。
   * @param row - 行
   * @param col - 列
   */
  private assertInBounds(row: number, col: number): void {
    if (!this.inBounds(row, col)) {
      throw new Error(`Cell out of bounds: (${row}, ${col})`);
    }
  }
}

/**
 * 创建指定尺寸的空棋盘。
 * @param rows - 行数，默认 7
 * @param cols - 列数，默认 7
 * @returns 新棋盘实例
 */
export function createEmptyBoard(rows = 7, cols = 7): BoardModel {
  return new BoardModel({ rows, cols });
}

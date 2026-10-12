import {
  MAHJONG_BASE_SLOTS,
  MAHJONG_SLOT_FULL_AD_MOVE_COUNT,
  type MahjongToolId,
} from './MahjongConfig';
import {
  mahjongCoinPerTriple,
  mahjongStarPerTriple,
  mahjongTimeoutMsForLevel,
} from './MahjongOpsConfig';
import type { MahjongGeneratedLevel } from './MahjongGenerator';
import { getMahjongTheme } from './MahjongThemeCatalog';
import { buildInitialPileFaceDown } from './MahjongFaceDown';
import {
  appendRandomPilePose,
  buildMahjongPilePoses,
  MAHJONG_PILE_POSE_VERSION,
  type MahjongTilePose,
} from './MahjongPilePoses';

export type MahjongPhase = 'playing' | 'won' | 'lost';
export type MahjongFailReason = 'timeout' | 'slot_full';

export interface MahjongGameSnapshot {
  level: number;
  pile: number[];
  pilePoses?: MahjongTilePose[];
  /** 姿态生成规则版本，与当前不一致时按 seed 重建（只影响摆放，不影响玩法）。 */
  poseVersion?: number;
  pileFaceDown?: boolean[];
  slots: number[];
  remainingMs: number;
  starsThisRun: number;
  coinsThisRun: number;
  adSlotUnlocked: boolean;
  phase: MahjongPhase;
  failReason?: MahjongFailReason;
  themeId: string;
  typeCount: number;
  seed: number;
  tools: Record<MahjongToolId, number>;
  guideShown: boolean;
}

/** 三消分组：种类数大于主题图数量时，同一张图（type % kindCount）视为同一种萌宠。 */
export function mahjongMatchKindCount(typeCount: number, themeTileCount: number): number {
  const tiles = Math.max(1, Math.floor(themeTileCount));
  const kinds = Math.max(1, Math.floor(typeCount));
  return Math.min(kinds, tiles);
}

function resolveTriplesByKind(
  slots: number[],
  kindOf: (type: number) => number,
): number[] {
  const counts = new Map<number, number>();
  for (const t of slots) {
    const k = kindOf(t);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const keep = new Map<number, number>();
  for (const [k, c] of counts) {
    keep.set(k, c % 3);
  }
  const out: number[] = [];
  for (const t of slots) {
    const k = kindOf(t);
    const left = keep.get(k) ?? 0;
    if (left > 0) {
      keep.set(k, left - 1);
      out.push(t);
    }
  }
  return out;
}

export class MahjongGame {
  public readonly level: number;
  public pile: number[];
  public pilePoses: MahjongTilePose[];
  public pileFaceDown: boolean[];
  public slots: number[] = [];
  public remainingMs: number;
  public starsThisRun = 0;
  public coinsThisRun = 0;
  public adSlotUnlocked = false;
  public phase: MahjongPhase = 'playing';
  public failReason?: MahjongFailReason;
  public readonly themeId: string;
  public readonly typeCount: number;
  /** 与主题图取 min，用于三消判定（避免 type 0 与 6 同图却不能消）。 */
  public readonly matchKindCount: number;
  public readonly seed: number;
  public tools: Record<MahjongToolId, number>;
  public guideShown: boolean;
  /** 牌堆布局变更计数（供渲染缓存失效）。 */
  public pileLayoutEpoch = 0;

  public constructor(
    generated: MahjongGeneratedLevel,
    themeId: string,
    tools: Record<MahjongToolId, number>,
    guideShown: boolean,
    remainingMs = mahjongTimeoutMsForLevel(generated.level),
    themeTileCount = generated.typeCount,
  ) {
    this.level = generated.level;
    this.pile = generated.pile.slice();
    this.pilePoses = buildMahjongPilePoses(this.pile.length, generated.seed, generated.level);
    this.pileFaceDown = buildInitialPileFaceDown(this.pilePoses, generated.level, generated.seed);
    this.remainingMs = remainingMs;
    this.themeId = themeId;
    this.typeCount = generated.typeCount;
    this.matchKindCount = mahjongMatchKindCount(generated.typeCount, themeTileCount);
    this.seed = generated.seed;
    this.tools = { ...tools };
    this.guideShown = guideShown;
  }

  public maxSlots(): number {
    return MAHJONG_BASE_SLOTS + (this.adSlotUnlocked ? 1 : 0);
  }

  public matchKind(type: number): number {
    if (this.matchKindCount >= this.typeCount) {
      return type;
    }
    return ((type % this.matchKindCount) + this.matchKindCount) % this.matchKindCount;
  }

  private bumpPileLayout(): void {
    this.pileLayoutEpoch += 1;
  }

  /** 槽内按视觉种类三消并发放本局星/金币。 */
  private compactSlotsTriplesWithReward(): void {
    const beforeLen = this.slots.length;
    this.slots = resolveTriplesByKind(this.slots, (t) => this.matchKind(t));
    const removed = beforeLen - this.slots.length;
    if (removed >= 3) {
      const triples = Math.floor(removed / 3);
      this.starsThisRun += triples * mahjongStarPerTriple();
      this.coinsThisRun += triples * mahjongCoinPerTriple();
    }
  }

  public tick(dtMs: number): void {
    if (this.phase !== 'playing') {
      return;
    }
    this.remainingMs = Math.max(0, this.remainingMs - dtMs);
    if (this.remainingMs <= 0 && this.pile.length + this.slots.length > 0) {
      this.phase = 'lost';
      this.failReason = 'timeout';
    }
  }

  private canAutoMatch(): boolean {
    const counts = new Map<number, number>();
    for (const t of this.slots) {
      const k = this.matchKind(t);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const c of counts.values()) {
      if (c >= 3) {
        return true;
      }
    }
    return false;
  }

  /** 给定槽位追加一张牌并按种类三消后的结果（不改本局状态）。 */
  public slotsAfterAppend(slots: readonly number[], tile: number): number[] {
    return resolveTriplesByKind([...slots, tile], (t) => this.matchKind(t));
  }

  /** 入槽后检测是否刚完成三消（用于奖励）。 */
  private applySlotWithReward(tile: number): void {
    const beforeLen = this.slots.length;
    this.slots = this.slotsAfterAppend(this.slots, tile);
    const removed = beforeLen + 1 - this.slots.length;
    if (removed >= 3) {
      const triples = Math.floor(removed / 3);
      this.starsThisRun += triples * mahjongStarPerTriple();
      this.coinsThisRun += triples * mahjongCoinPerTriple();
    }
  }

  public tapPile(index: number): boolean {
    if (this.phase !== 'playing' || index < 0 || index >= this.pile.length) {
      return false;
    }
    const tile = this.pile.splice(index, 1)[0]!;
    this.pilePoses.splice(index, 1);
    this.pileFaceDown.splice(index, 1);
    this.bumpPileLayout();
    this.applySlotWithReward(tile);
    if (this.pile.length === 0 && this.slots.length === 0) {
      this.phase = 'won';
      return true;
    }
    if (this.slots.length >= this.maxSlots() && !this.canAutoMatch()) {
      this.phase = 'lost';
      this.failReason = 'slot_full';
    }
    return true;
  }

  public unlockAdSlot(): void {
    this.adSlotUnlocked = true;
  }

  /** 槽位已满失败且槽内仍有牌时可走广告移出继续。 */
  public canReviveFromSlotFullAd(): boolean {
    return (
      this.phase === 'lost' &&
      this.failReason === 'slot_full' &&
      this.slots.length > 0
    );
  }

  /** 看广告后移出槽内若干张回牌堆并继续本局。 */
  public reviveMoveOutFromSlots(
    count = MAHJONG_SLOT_FULL_AD_MOVE_COUNT,
  ): boolean {
    if (!this.canReviveFromSlotFullAd()) {
      return false;
    }
    const n = Math.min(Math.max(1, count), this.slots.length);
    for (let i = 0; i < n; i += 1) {
      const tile = this.slots.pop()!;
      this.pile.unshift(tile);
      this.pilePoses.unshift(appendRandomPilePose(this.pilePoses, this.seed, this.level));
      this.pileFaceDown.unshift(false);
    }
    this.phase = 'playing';
    this.failReason = undefined;
    this.bumpPileLayout();
    this.compactSlotsTriplesWithReward();
    this.checkWinOrLose();
    return true;
  }

  public useTool(tool: MahjongToolId): boolean {
    if (this.phase !== 'playing' || this.tools[tool] <= 0) {
      return false;
    }
    let ok = false;
    switch (tool) {
      case 'move_out':
        ok = this.toolMoveOut();
        break;
      case 'gather':
        ok = this.toolGather();
        break;
      case 'shuffle':
        ok = this.toolShuffle();
        break;
      case 'reveal':
        ok = this.toolReveal();
        break;
      default:
        ok = false;
    }
    if (ok) {
      this.tools[tool] -= 1;
    }
    return ok;
  }

  private toolMoveOut(): boolean {
    if (this.slots.length === 0) {
      return false;
    }
    const tile = this.slots.pop()!;
    this.pile.unshift(tile);
    this.pilePoses.unshift(appendRandomPilePose(this.pilePoses, this.seed, this.level));
    this.pileFaceDown.unshift(false);
    this.bumpPileLayout();
    return true;
  }

  private toolGather(): boolean {
    if (this.slots.length === 0) {
      return false;
    }
    const target = this.slots[this.slots.length - 1]!;
    const targetKind = this.matchKind(target);
    let need = 3 - this.slots.filter((t) => this.matchKind(t) === targetKind).length;
    if (need <= 0) {
      need = 2;
    }
    let moved = 0;
    for (let i = 0; i < this.pile.length && moved < need; ) {
      if (this.matchKind(this.pile[i]!) === targetKind) {
        const t = this.pile.splice(i, 1)[0]!;
        this.pilePoses.splice(i, 1);
        this.pileFaceDown.splice(i, 1);
        this.applySlotWithReward(t);
        moved += 1;
      } else {
        i += 1;
      }
    }
    if (moved === 0) {
      return false;
    }
    this.bumpPileLayout();
    this.checkWinOrLose();
    return true;
  }

  private toolShuffle(): boolean {
    if (this.pile.length < 2) {
      return false;
    }
    for (let i = this.pile.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.pile[i]!;
      this.pile[i] = this.pile[j]!;
      this.pile[j] = tmp;
      const tmpP = this.pilePoses[i]!;
      this.pilePoses[i] = this.pilePoses[j]!;
      this.pilePoses[j] = tmpP;
      const tmpF = this.pileFaceDown[i]!;
      this.pileFaceDown[i] = this.pileFaceDown[j]!;
      this.pileFaceDown[j] = tmpF;
    }
    this.bumpPileLayout();
    return true;
  }

  /** 翻开 z 最高的一张扣牌（最上层未明牌）。 */
  private toolReveal(): boolean {
    let pick = -1;
    let bestZ = -Infinity;
    for (let i = 0; i < this.pileFaceDown.length; i += 1) {
      if (!this.pileFaceDown[i]) {
        continue;
      }
      const z = this.pilePoses[i]?.z ?? i;
      if (z > bestZ) {
        bestZ = z;
        pick = i;
      }
    }
    if (pick < 0) {
      return false;
    }
    this.pileFaceDown[pick] = false;
    this.bumpPileLayout();
    return true;
  }

  public faceDownCountInPile(): number {
    return this.pileFaceDown.filter(Boolean).length;
  }

  private checkWinOrLose(): void {
    if (this.pile.length === 0 && this.slots.length === 0) {
      this.phase = 'won';
      return;
    }
    if (this.slots.length >= this.maxSlots() && !this.canAutoMatch()) {
      this.phase = 'lost';
      this.failReason = 'slot_full';
    }
  }

  public toSnapshot(): MahjongGameSnapshot {
    return {
      level: this.level,
      pile: this.pile.slice(),
      pilePoses: this.pilePoses.map((p) => ({ ...p })),
      poseVersion: MAHJONG_PILE_POSE_VERSION,
      pileFaceDown: this.pileFaceDown.slice(),
      slots: this.slots.slice(),
      remainingMs: this.remainingMs,
      starsThisRun: this.starsThisRun,
      coinsThisRun: this.coinsThisRun,
      adSlotUnlocked: this.adSlotUnlocked,
      phase: this.phase,
      failReason: this.failReason,
      themeId: this.themeId,
      typeCount: this.typeCount,
      seed: this.seed,
      tools: { ...this.tools },
      guideShown: this.guideShown,
    };
  }

  public static fromSnapshot(s: MahjongGameSnapshot): MahjongGame {
    const g: MahjongGeneratedLevel = {
      level: s.level,
      pile: s.pile.slice(),
      typeCount: s.typeCount,
      seed: s.seed,
      themeId: s.themeId,
    };
    const themeTiles = getMahjongTheme(s.themeId)?.tiles.length ?? s.typeCount;
    const game = new MahjongGame(g, s.themeId, s.tools, s.guideShown, s.remainingMs, themeTiles);
    game.pile = s.pile.slice();
    const refPoses = buildMahjongPilePoses(s.pile.length, s.seed, s.level);
    game.pilePoses =
      s.pilePoses &&
      s.pilePoses.length === s.pile.length &&
      s.poseVersion === MAHJONG_PILE_POSE_VERSION
        ? s.pilePoses.map((p) => ({ ...p }))
        : refPoses.map((p) => ({ ...p }));
    game.pileFaceDown =
      s.pileFaceDown && s.pileFaceDown.length === s.pile.length
        ? s.pileFaceDown.slice()
        : buildInitialPileFaceDown(game.pilePoses, s.level, s.seed);
    if (s.level <= 1) {
      game.pileFaceDown.fill(false);
    }
    game.starsThisRun = s.starsThisRun;
    game.coinsThisRun = s.coinsThisRun;
    game.slots = s.slots.slice();
    if (game.phase === 'playing') {
      game.compactSlotsTriplesWithReward();
    }
    game.adSlotUnlocked = s.adSlotUnlocked;
    game.phase = s.phase;
    game.failReason = s.failReason;
    game.bumpPileLayout();
    return game;
  }
}

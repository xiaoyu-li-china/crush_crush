import type { TileKind } from '../board/TileType';
import type { ResolveWave } from '../board/MatchResolver';
import type { GameState } from '../fsm/GameState';

/**
 * 领域事件：逻辑层产出，表现层订阅。
 */
export type GameEvent =
  | { type: 'StateChanged'; from: GameState; to: GameState }
  | { type: 'SwapAccepted'; rowA: number; colA: number; rowB: number; colB: number }
  | { type: 'SwapRejected'; rowA: number; colA: number; rowB: number; colB: number }
  | { type: 'TilesCleared'; indices: number[]; kinds: TileKind[] }
  | { type: 'TilesFell'; moves: Array<{ tileId: number; fromRow: number; toRow: number; col: number }> }
  | { type: 'TilesSpawned'; indices: number[]; tileIds: number[]; kinds: TileKind[] }
  | { type: 'CascadeDone'; depth: number }
  /** 交换后、结算前的盘面快照 + 分波次，供开心消消乐式播放 */
  | {
      type: 'ResolvePlayback';
      rows: number;
      cols: number;
      cells: Int8Array;
      tileIds: Int32Array;
      sparkles: Uint8Array;
      waves: ResolveWave[];
      cloud: Uint8Array;
      ice: Uint8Array;
      egg: Uint8Array;
      vine: Uint8Array;
    }
  | { type: 'LevelWon'; levelId: number; score: number }
  | { type: 'LevelFailed'; levelId: number }
  | { type: 'GoalProgress'; progress: number[]; completed: boolean }
  /** 通关剩余步数加成到彩色块（开心消消乐式） */
  | {
      type: 'MovesBonusApplied';
      movesConverted: number;
      targets: Array<{ row: number; col: number }>;
    }
  | { type: 'MovesBonusDone'; bonusScore: number; totalScore: number }
  | {
      type: 'CrushBurstFired';
      row: number;
      col: number;
      radius: number;
      clearedIndices: number[];
      scoreAdded: number;
    }
  | { type: 'CrushEnded'; crushScore: number; totalScore: number; leftoverCleared: number }
  | {
      type: 'CleaningEnded';
      cleanScore: number;
      tapCount: number;
    }
  | { type: 'BoardShuffled'; reason?: 'deadlock' | 'booster' }
  | { type: 'BoardChanged'; version: number }
  | { type: 'SnowmanQuake'; centers: number[] }
  | { type: 'BuriedRevealed'; id: number; kind: number; cells: number[] }
  | { type: 'BuriedHarvested'; indices: number[] }
  | {
      type: 'BoosterUsed';
      boosterId: 'hammer' | 'shuffle' | 'extraMoves';
      remaining: number;
      row?: number;
      col?: number;
      movesGranted?: number;
    }
  | { type: 'InviteReward'; kind: 'invitee' | 'inviter'; hammers: number };

export type GameEventListener = (event: GameEvent) => void;

export class GameEventBus {
  private readonly listeners: Set<GameEventListener> = new Set();

  public emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public subscribe(listener: GameEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.listeners.clear();
  }
}

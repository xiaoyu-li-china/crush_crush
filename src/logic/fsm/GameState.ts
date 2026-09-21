/**
 * 游戏有限状态机状态定义。
 * 使用字符串联合类型，便于穷尽检查。
 */
export type GameState =
  | 'Boot'
  | 'Lobby'
  | 'LoadingLevel'
  | 'PlayerInput'
  | 'Resolving'
  | 'LevelWon'
  | 'MovesBonus'
  | 'CrushReward'
  | 'Cleaning'
  | 'LevelFailed'
  | 'Settle'
  | 'Paused';

/** 合法迁移表（示意，状态机实现时校验）。 */
export const GAME_STATE_TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  Boot: ['Lobby'],
  Lobby: ['LoadingLevel'],
  LoadingLevel: ['PlayerInput'],
  PlayerInput: ['Resolving', 'Paused', 'LevelFailed'],
  Resolving: ['PlayerInput', 'LevelWon', 'LevelFailed'],
  LevelWon: ['MovesBonus', 'CrushReward', 'Settle'],
  MovesBonus: ['CrushReward', 'Settle'],
  CrushReward: ['Settle'],
  Cleaning: ['Settle'],
  LevelFailed: ['Settle', 'PlayerInput'],
  Settle: ['Lobby', 'LoadingLevel', 'Cleaning'],
  Paused: ['PlayerInput'],
};

export function canTransition(from: GameState, to: GameState): boolean {
  return GAME_STATE_TRANSITIONS[from].includes(to);
}

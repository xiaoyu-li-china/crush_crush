/**
 * 状态机：迁移表穷尽、非法迁移、forceTo、订阅。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canTransition,
  GAME_STATE_TRANSITIONS,
  type GameState,
} from '../../src/logic/fsm/GameState';
import { GameStateMachine } from '../../src/logic/fsm/GameStateMachine';

const STATES = Object.keys(GAME_STATE_TRANSITIONS) as GameState[];

describe('GameState 迁移表', () => {
  it('合法边 canTransition 为 true，其余为 false（状态转换穷尽）', () => {
    for (const from of STATES) {
      for (const to of STATES) {
        const allowed = GAME_STATE_TRANSITIONS[from].includes(to);
        assert.equal(canTransition(from, to), allowed, `${from} -> ${to}`);
      }
    }
  });

  it('Boot 只能进 Lobby，Paused 只能回 PlayerInput', () => {
    assert.deepEqual([...GAME_STATE_TRANSITIONS.Boot], ['Lobby']);
    assert.deepEqual([...GAME_STATE_TRANSITIONS.Paused], ['PlayerInput']);
    assert.equal(canTransition('CrushReward', 'Lobby'), false);
    assert.equal(canTransition('Settle', 'Cleaning'), true);
  });
});

describe('GameStateMachine', () => {
  it('默认 Boot，合法迁移改态并通知，非法迁移保持原态', () => {
    const fsm = new GameStateMachine();
    assert.equal(fsm.getCurrent(), 'Boot');
    const seen: Array<[GameState, GameState]> = [];
    const unsub = fsm.subscribe((from, to) => {
      seen.push([from, to]);
    });
    assert.equal(fsm.transitionTo('Lobby'), true);
    assert.equal(fsm.getCurrent(), 'Lobby');
    assert.equal(fsm.transitionTo('PlayerInput'), false);
    assert.equal(fsm.getCurrent(), 'Lobby');
    assert.deepEqual(seen, [['Boot', 'Lobby']]);
    unsub();
    assert.equal(fsm.transitionTo('LoadingLevel'), true);
    assert.deepEqual(seen, [['Boot', 'Lobby']]);
  });

  it('forceTo 同态直接成功，异态不校验表', () => {
    const fsm = new GameStateMachine('PlayerInput');
    const seen: string[] = [];
    fsm.subscribe((_from, to) => {
      seen.push(to);
    });
    assert.equal(fsm.forceTo('PlayerInput'), true);
    assert.deepEqual(seen, []);
    assert.equal(fsm.forceTo('Lobby'), true);
    assert.equal(fsm.getCurrent(), 'Lobby');
    assert.deepEqual(seen, ['Lobby']);
  });

  it('dispose 后不再派发', () => {
    const fsm = new GameStateMachine('Boot');
    let n = 0;
    fsm.subscribe(() => {
      n += 1;
    });
    fsm.dispose();
    fsm.transitionTo('Lobby');
    assert.equal(n, 0);
    assert.equal(fsm.getCurrent(), 'Lobby');
  });
});

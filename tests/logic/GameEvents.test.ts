import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GameEventBus } from '../../src/logic/events/GameEvents';

describe('GameEventBus', () => {
  it('subscribe 收到事件，退订后不再收到，dispose 清空', () => {
    const bus = new GameEventBus();
    const seen: string[] = [];
    const off = bus.subscribe((e) => {
      seen.push(e.type);
    });
    bus.emit({ type: 'BoardShuffled' });
    off();
    bus.emit({ type: 'BoardShuffled' });
    assert.deepEqual(seen, ['BoardShuffled']);
    bus.subscribe((e) => {
      seen.push(e.type);
    });
    bus.dispose();
    bus.emit({ type: 'BoardShuffled' });
    assert.deepEqual(seen, ['BoardShuffled']);
  });
});

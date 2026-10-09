import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLevel1TutorialPile,
  generateMahjongLevel,
  verifySolvablePile,
} from '../../src/logic/mahjong/MahjongGenerator';
import { MahjongGame } from '../../src/logic/mahjong/MahjongGame';
import { EMPTY_MAHJONG_TOOLS } from '../../src/logic/mahjong/MahjongProgress';

describe('萌宠麻将馆逻辑', () => {
  it('第1关每行三种各一且可清盘', () => {
    const gen = generateMahjongLevel(1, 'test-player');
    assert.equal(gen.pile.length, 9);
    for (let row = 0; row < 3; row += 1) {
      const slice = gen.pile.slice(row * 3, row * 3 + 3);
      assert.deepEqual([...slice].sort(), [0, 1, 2]);
    }
    const game = new MahjongGame(
      gen,
      'default',
      { ...EMPTY_MAHJONG_TOOLS, reveal: 9 },
      false,
    );
    while (game.pile.length > 0) {
      const visible = game.pile.findIndex((_, i) => !game.pileFaceDown[i]);
      if (visible < 0) {
        assert.equal(game.useTool('reveal'), true);
        continue;
      }
      const type = game.pile[visible]!;
      for (let k = 0; k < 3; k += 1) {
        let idx = game.pile.findIndex((tile, i) => !game.pileFaceDown[i] && tile === type);
        if (idx < 0) {
          assert.equal(game.useTool('reveal'), true);
          idx = game.pile.findIndex((tile, i) => !game.pileFaceDown[i] && tile === type);
        }
        assert.ok(idx >= 0);
        assert.equal(game.tapPile(idx), true);
      }
    }
    assert.equal(game.phase, 'won');
    assert.equal(game.starsThisRun, 3);
    assert.equal(game.coinsThisRun, 3);
  });

  it('第1关牌序随种子打乱', () => {
    const a = buildLevel1TutorialPile(1);
    const b = buildLevel1TutorialPile(999);
    assert.notDeepEqual(a, b);
  });

  it('生成 105 张牌堆可通过可解性校验', () => {
    const gen = generateMahjongLevel(2, 'player-a');
    assert.equal(gen.pile.length, 105);
    assert.equal(verifySolvablePile(gen.pile, 6), true);
    const g = new MahjongGame(
      gen,
      'default',
      { ...EMPTY_MAHJONG_TOOLS, reveal: 40 },
      true,
    );
    g.pileFaceDown.fill(false);
    let guard = 500;
    while (g.pile.length > 0 && guard > 0) {
      guard -= 1;
      assert.equal(g.tapPile(0), true);
    }
    assert.equal(g.phase, 'won');
  });

  it('第2关扣牌可直接点入槽', () => {
    const gen = generateMahjongLevel(2, 'face-down');
    const game = new MahjongGame(gen, 'default', EMPTY_MAHJONG_TOOLS, true);
    const hiddenIdx = game.pileFaceDown.findIndex((v) => v);
    assert.ok(hiddenIdx >= 0);
    const beforePile = game.pile.length;
    const epoch0 = game.pileLayoutEpoch;
    assert.equal(game.tapPile(hiddenIdx), true);
    assert.equal(game.pile.length, beforePile - 1);
    assert.equal(game.slots.length, 1);
    assert.equal(game.pileLayoutEpoch, epoch0 + 1);
  });

  it('旧存档第1关的扣牌读档后全部翻开', () => {
    const gen = generateMahjongLevel(1, 'old-save');
    const game = new MahjongGame(gen, 'default', { ...EMPTY_MAHJONG_TOOLS }, true);
    const snap = game.toSnapshot();
    snap.pileFaceDown = snap.pile.map((_, i) => i % 2 === 0);
    const restored = MahjongGame.fromSnapshot(snap);
    assert.equal(restored.faceDownCountInPile(), 0);
    assert.equal(restored.tapPile(0), true);
  });

  it('槽满失败后重开保持关卡号并回到进行中', async () => {
    const { MahjongHallService } = await import('../../src/services/MahjongHallService');
    const analytics = { track: () => {} };
    const storage = {
      get: async () => null,
      set: async () => {},
      remove: async () => {},
    };
    const svc = new MahjongHallService(storage, analytics);
    await svc.load();
    svc.setPlayerKey('restart-test');
    svc.startLevel(2, false);
    const g = svc.getActiveGame()!;
    g.phase = 'lost';
    g.failReason = 'slot_full';
    await svc.restartLevel(2);
    const next = svc.getActiveGame()!;
    assert.equal(next.level, 2);
    assert.equal(next.phase, 'playing');
    assert.ok(next.pile.length > 0);
  });

  it('主题图少于种类数时同图不同 type 可三消（第3关+）', () => {
    const gen = {
      level: 3,
      pile: [1],
      typeCount: 8,
      seed: 1,
      themeId: 'default',
    };
    const game = new MahjongGame(gen, 'default', { ...EMPTY_MAHJONG_TOOLS }, true, 120_000, 6);
    game.slots = [0, 6, 0, 1, 2, 3];
    game.phase = 'lost';
    game.failReason = 'slot_full';
    assert.equal(game.reviveMoveOutFromSlots(3), true);
    assert.equal(game.slots.length, 0);
    assert.equal(game.starsThisRun, 1);
    assert.equal(game.coinsThisRun, 1);
  });

  it('槽位已满看广告可移出3张并继续', () => {
    const gen = generateMahjongLevel(1, 'x');
    const game = new MahjongGame(
      { ...gen, pile: [0, 1, 2, 0, 1, 2, 0, 1, 2] },
      'default',
      { ...EMPTY_MAHJONG_TOOLS },
      true,
    );
    game.pileFaceDown = game.pileFaceDown.map(() => false);
    for (let i = 0; i < 6; i += 1) {
      game.tapPile(0);
    }
    assert.equal(game.phase, 'lost');
    assert.equal(game.failReason, 'slot_full');
    assert.equal(game.slots.length, 6);
    assert.equal(game.reviveMoveOutFromSlots(3), true);
    assert.equal(game.phase, 'playing');
    assert.equal(game.slots.length, 3);
    assert.equal(game.pile.length, 6);
  });

  it('槽位满且无三消时失败', () => {
    const gen = generateMahjongLevel(1, 'x');
    const game = new MahjongGame(
      { ...gen, pile: [0, 1, 2, 0, 1, 2, 0, 1, 2] },
      'default',
      { ...EMPTY_MAHJONG_TOOLS },
      true,
    );
    game.pileFaceDown = game.pileFaceDown.map(() => false);
    for (let i = 0; i < 6; i += 1) {
      game.tapPile(0);
    }
    assert.equal(game.phase, 'lost');
    assert.equal(game.failReason, 'slot_full');
  });
});

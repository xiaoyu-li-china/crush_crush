/**
 * 拉新邀请：新用户绑定、通关发锤子、不认自己、不看分享成功。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { StorageKeys } from '../../src/core';
import {
  applyInviteCredit,
  bindPendingInviter,
  EMPTY_INVITE_STATE,
  ensureInviteCode,
  generateInviteCode,
  grantInviteeGift,
  hydrateInviteFromCloud,
  inviteSettingsHint,
  isFreshPlayer,
  lobbyInviteHint,
  mergeInviteCloud,
  normalizeInviteCode,
  parseInviterFromQuery,
  parseInviteState,
  withInviterQuery,
} from '../../src/logic/economy/InviteLoop';
import { DEFAULT_LEVEL_PROGRESS } from '../../src/logic/level/LevelProgress';
import {
  createMemoryDeps,
  miniLevels,
  paintSwapMatch,
} from '../helpers/memory-deps';
import { GameSession } from '../../src/services/GameSession';
import type { IPlayerCloudSave, PlayerCloudSnapshot } from '../../src/core/ports/IPlayerCloudSave';
import { EMPTY_BOOSTER_WALLET } from '../../src/logic/economy/BoosterEconomy';
import { EMPTY_DAILY_LOOP } from '../../src/logic/economy/DailyLoop';

describe('InviteLoop', () => {
  it('生成 8 位无歧义邀请码，query 能解析', () => {
    const code = generateInviteCode(() => 0.1);
    assert.equal(code.length, 8);
    assert.equal(normalizeInviteCode('ab-cd_ef12'), 'ABCDEF12');
    assert.equal(parseInviterFromQuery({ inviter: code }), code);
    assert.equal(parseInviterFromQuery(`from=lobby&inviter=${code}`), code);
    assert.equal(
      withInviterQuery('from=result&level=3&score=100', code),
      `from=result&level=3&score=100&inviter=${code}`,
    );
  });

  it('新用户才绑定，不能绑自己，先点的邀请人有效', () => {
    const mine = ensureInviteCode(EMPTY_INVITE_STATE, () => 'ABCDEFGH');
    const fresh = isFreshPlayer({
      ...DEFAULT_LEVEL_PROGRESS,
      levelScores: {},
    });
    assert.equal(fresh, true);
    const bound = bindPendingInviter(mine, 'XYZ23456', true);
    assert.equal(bound.pendingInviter, 'XYZ23456');
    const keepFirst = bindPendingInviter(bound, 'OTHER234', true);
    assert.equal(keepFirst.pendingInviter, 'XYZ23456');
    const self = bindPendingInviter(mine, 'ABCDEFGH', true);
    assert.equal(self.pendingInviter, '');
    const veteran = bindPendingInviter(mine, 'XYZ23456', false);
    assert.equal(veteran.pendingInviter, '');
    assert.equal(
      isFreshPlayer({
        ...DEFAULT_LEVEL_PROGRESS,
        highestLevelId: 2,
        levelScores: { '1': 10 },
      }),
      false,
    );
  });

  it('通关后被邀请人领锤子；邀请人按云额度补差', () => {
    const pending = {
      ...EMPTY_INVITE_STATE,
      code: 'ABCDEFGH',
      pendingInviter: 'XYZ23456',
    };
    const gift = grantInviteeGift(pending);
    assert.equal(gift.granted, 1);
    assert.equal(gift.state.inviteeGiftGranted, true);
    assert.equal(grantInviteeGift(gift.state).granted, 0);

    const credit = applyInviteCredit(EMPTY_INVITE_STATE, 3);
    assert.equal(credit.granted, 3);
    assert.equal(applyInviteCredit(credit.state, 3).granted, 0);
    assert.equal(applyInviteCredit(credit.state, 5).granted, 2);
  });

  it('设置/大厅文案区分待领与已邀请', () => {
    assert.match(inviteSettingsHint(EMPTY_INVITE_STATE), /邀请新玩家/);
    assert.match(
      inviteSettingsHint({
        ...EMPTY_INVITE_STATE,
        pendingInviter: 'XYZ23456',
      }),
      /通关任意一关/,
    );
    assert.equal(
      lobbyInviteHint({
        ...EMPTY_INVITE_STATE,
        pendingInviter: 'XYZ23456',
      }),
      '通关第 1 关，你和好友各得锤子',
    );
    assert.match(
      inviteSettingsHint({
        ...EMPTY_INVITE_STATE,
        appliedCreditHammer: 2,
      }),
      /已成功邀请 2 人/,
    );
  });

  it('云档邀请码以远端为准，额度取更大', () => {
    const merged = mergeInviteCloud(
      { code: 'LOCAL234', creditHammer: 1, claimedAsInvitee: false },
      { code: 'REMOTE23', creditHammer: 4, claimedAsInvitee: true },
    );
    assert.equal(merged.code, 'REMOTE23');
    assert.equal(merged.creditHammer, 4);
    assert.equal(merged.claimedAsInvitee, true);
    const hydrated = hydrateInviteFromCloud(parseInviteState(null), merged);
    assert.equal(hydrated.cloudClaimed, true);
    assert.equal(hydrated.inviteeGiftGranted, true);

    const bound = mergeInviteCloud(
      {
        code: 'LOCAL234',
        creditHammer: 0,
        claimedAsInvitee: false,
        pendingInviter: 'FRIEND23',
        inviteeGiftGranted: false,
        cloudClaimed: false,
      },
      {
        code: 'REMOTE23',
        creditHammer: 0,
        claimedAsInvitee: false,
        pendingInviter: '',
        inviteeGiftGranted: false,
        cloudClaimed: false,
      },
    );
    assert.equal(bound.pendingInviter, 'FRIEND23');
    const restored = hydrateInviteFromCloud(parseInviteState(null), bound);
    assert.equal(restored.pendingInviter, 'FRIEND23');
  });
});

describe('GameSession 邀请闭环', () => {
  it('分享进来的新用户通关后本地 +1 锤子并请求给邀请人记账', async () => {
    const claims: string[] = [];
    const deps = createMemoryDeps();
    deps.platform.getLaunchQuery = () => ({ inviter: 'FRIEND23' });
    deps.cloudSave = {
      isEnabled: () => false,
      async pull() {
        return null;
      },
      async push() {},
      async claimInvite(code) {
        claims.push(code);
        return { ok: true };
      },
    };
    const session = new GameSession(deps);
    session.setLevelTable(miniLevels());
    await session.init();
    assert.equal(session.getInviteState().pendingInviter, 'FRIEND23');
    assert.equal(session.getInviteCode().length, 8);
    const before = session.getBoosterCount('hammer');
    await session.startLevel(1);
    paintSwapMatch(session);
    session.trySwap(0, 2, 1, 2);
    if (session.hasPendingMovesBonus()) {
      session.runMovesBonus();
    }
    assert.equal(session.getBoosterCount('hammer'), before + 1);
    assert.equal(session.getInviteState().inviteeGiftGranted, true);
    assert.match(session.takeInviteToast() ?? '', /邀请礼/);
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(claims, ['FRIEND23']);
    const saved = await deps.storage.get<{ pendingInviter: string }>(StorageKeys.Invite);
    assert.equal(saved?.pendingInviter, 'FRIEND23');
  });

  it('已通关玩家点分享不绑定；自己的码也不绑', async () => {
    const deps = createMemoryDeps();
    await deps.storage.set(StorageKeys.PlayerProgress, {
      ...DEFAULT_LEVEL_PROGRESS,
      highestLevelId: 3,
      totalScore: 20,
      lastPlayedLevelId: 2,
      levelScores: { '1': 10, '2': 10 },
    });
    deps.platform.getLaunchQuery = () => ({ inviter: 'FRIEND23' });
    const session = new GameSession(deps);
    await session.init();
    assert.equal(session.getInviteState().pendingInviter, '');

    const self = createMemoryDeps();
    const other = new GameSession(self);
    await other.init();
    const code = other.getInviteCode();
    assert.equal(other.bindInviteFromQuery({ inviter: code }), false);
  });

  it('邀请人下次拉云档按额度补锤子', async () => {
    const cloudSave: IPlayerCloudSave = {
      isEnabled: () => true,
      async pull(): Promise<PlayerCloudSnapshot | null> {
        return {
          updatedAt: 9,
          progress: { ...DEFAULT_LEVEL_PROGRESS, levelScores: {} },
          boosters: { ...EMPTY_BOOSTER_WALLET },
          settings: { muted: false },
          daily: { ...EMPTY_DAILY_LOOP },
          invite: { code: 'HOSTCODE', creditHammer: 2, claimedAsInvitee: false },
        };
      },
      async push() {},
    };
    const deps = createMemoryDeps();
    deps.cloudSave = cloudSave;
    const session = new GameSession(deps);
    await session.init();
    assert.equal(session.getInviteCode(), 'HOSTCODE');
    assert.ok(session.getBoosterCount('hammer') >= 2);
    assert.match(session.takeInviteToast() ?? '', /好友通关了/);
  });
});

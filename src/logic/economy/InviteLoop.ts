/**
 * 拉新邀请：分享带邀请码，新用户通关后双方各得锤子。
 * 不检测「分享成功」，也不把继续游戏卡在转发上。
 */

import type { BoosterStock } from './BoosterInventory';
import { addBoosterToWallet } from './BoosterEconomy';
import type { LevelProgressData } from '../level/LevelProgress';

export const INVITE_CODE_LENGTH = 8;
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface InviteState {
  code: string;
  pendingInviter: string;
  claimedAsInvitee: boolean;
  inviteeGiftGranted: boolean;
  cloudClaimed: boolean;
  appliedCreditHammer: number;
}

export interface InviteCloudSlice {
  code: string;
  creditHammer: number;
  claimedAsInvitee: boolean;
  pendingInviter: string;
  inviteeGiftGranted: boolean;
  cloudClaimed: boolean;
}

export const EMPTY_INVITE_STATE: InviteState = {
  code: '',
  pendingInviter: '',
  claimedAsInvitee: false,
  inviteeGiftGranted: false,
  cloudClaimed: false,
  appliedCreditHammer: 0,
};

export const EMPTY_INVITE_CLOUD: InviteCloudSlice = {
  code: '',
  creditHammer: 0,
  claimedAsInvitee: false,
  pendingInviter: '',
  inviteeGiftGranted: false,
  cloudClaimed: false,
};

export function generateInviteCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    const index = Math.floor(random() * INVITE_ALPHABET.length) % INVITE_ALPHABET.length;
    out += INVITE_ALPHABET[index]!;
  }
  return out;
}

export function normalizeInviteCode(raw: unknown): string {
  const text = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (text.length < 6 || text.length > 12) {
    return '';
  }
  return text.slice(0, INVITE_CODE_LENGTH);
}

export function parseInviterFromQuery(
  query: Record<string, string | undefined> | string | null | undefined,
): string {
  if (!query) {
    return '';
  }
  if (typeof query === 'string') {
    const raw = query.startsWith('?') ? query.slice(1) : query;
    const params = new URLSearchParams(raw);
    return normalizeInviteCode(params.get('inviter') || params.get('INVITER'));
  }
  return normalizeInviteCode(query.inviter || query.INVITER);
}

export function withInviterQuery(query: string, code: string): string {
  const inviter = normalizeInviteCode(code);
  if (!inviter) {
    return query;
  }
  if (!query) {
    return `inviter=${inviter}`;
  }
  if (/(?:^|&)inviter=/i.test(query)) {
    return query.replace(/(^|&)inviter=[^&]*/i, `$1inviter=${inviter}`);
  }
  return `${query}&inviter=${inviter}`;
}

/** 从未通关：highest 从 1 起算，不能只看 highest===1。 */
export function isFreshPlayer(progress: LevelProgressData | null | undefined): boolean {
  if (!progress) {
    return true;
  }
  const scores = progress.levelScores ?? {};
  if (Object.keys(scores).length > 0) {
    return false;
  }
  if ((progress.totalScore ?? 0) > 0) {
    return false;
  }
  return (progress.highestLevelId ?? 1) <= 1;
}

export function parseInviteState(raw: unknown): InviteState {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_INVITE_STATE };
  }
  const data = raw as Partial<InviteState>;
  return {
    code: normalizeInviteCode(data.code),
    pendingInviter: normalizeInviteCode(data.pendingInviter),
    claimedAsInvitee: !!data.claimedAsInvitee,
    inviteeGiftGranted: !!data.inviteeGiftGranted,
    cloudClaimed: !!data.cloudClaimed,
    appliedCreditHammer: Math.max(0, Math.floor(Number(data.appliedCreditHammer) || 0)),
  };
}

export function ensureInviteCode(
  state: InviteState,
  generate: () => string = generateInviteCode,
): InviteState {
  const code = normalizeInviteCode(state.code);
  if (code) {
    return { ...state, code };
  }
  return { ...state, code: normalizeInviteCode(generate()) || generateInviteCode() };
}

export function toInviteCloudSlice(state: InviteState): InviteCloudSlice {
  return {
    code: normalizeInviteCode(state.code),
    creditHammer: Math.max(0, Math.floor(state.appliedCreditHammer)),
    claimedAsInvitee: !!state.claimedAsInvitee,
    pendingInviter: normalizeInviteCode(state.pendingInviter),
    inviteeGiftGranted: !!state.inviteeGiftGranted,
    cloudClaimed: !!state.cloudClaimed,
  };
}

export function parseInviteCloudSlice(raw: unknown): InviteCloudSlice {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_INVITE_CLOUD };
  }
  const data = raw as Partial<InviteCloudSlice>;
  return {
    code: normalizeInviteCode(data.code),
    creditHammer: Math.max(0, Math.floor(Number(data.creditHammer) || 0)),
    claimedAsInvitee: !!data.claimedAsInvitee,
    pendingInviter: normalizeInviteCode(data.pendingInviter),
    inviteeGiftGranted: !!data.inviteeGiftGranted,
    cloudClaimed: !!data.cloudClaimed,
  };
}

export function mergeInviteCloud(
  local: InviteCloudSlice | undefined,
  remote: InviteCloudSlice | undefined,
): InviteCloudSlice {
  const a = local ?? EMPTY_INVITE_CLOUD;
  const b = remote ?? EMPTY_INVITE_CLOUD;
  return {
    code: b.code || a.code,
    creditHammer: Math.max(a.creditHammer, b.creditHammer),
    claimedAsInvitee: a.claimedAsInvitee || b.claimedAsInvitee,
    pendingInviter: a.pendingInviter || b.pendingInviter || '',
    inviteeGiftGranted: !!a.inviteeGiftGranted || !!b.inviteeGiftGranted,
    cloudClaimed: !!a.cloudClaimed || !!b.cloudClaimed,
  };
}

export function hydrateInviteFromCloud(
  local: InviteState,
  cloud: InviteCloudSlice | undefined,
): InviteState {
  const slice = mergeInviteCloud(toInviteCloudSlice(local), cloud);
  const next: InviteState = {
    ...local,
    code: slice.code || local.code,
    pendingInviter: local.pendingInviter || slice.pendingInviter,
    claimedAsInvitee: local.claimedAsInvitee || slice.claimedAsInvitee,
    inviteeGiftGranted: local.inviteeGiftGranted || slice.inviteeGiftGranted,
    cloudClaimed: local.cloudClaimed || slice.cloudClaimed,
  };
  if (slice.claimedAsInvitee) {
    next.inviteeGiftGranted = true;
    next.cloudClaimed = true;
  }
  return next;
}

/** 仅新用户绑定；先点的邀请人有效；不能绑自己。 */
export function bindPendingInviter(
  state: InviteState,
  inviterCode: string,
  fresh: boolean,
): InviteState {
  const code = normalizeInviteCode(inviterCode);
  if (!code || !fresh || state.claimedAsInvitee || state.inviteeGiftGranted) {
    return state;
  }
  if (code === state.code) {
    return state;
  }
  if (state.pendingInviter) {
    return state;
  }
  return { ...state, pendingInviter: code };
}

export function grantInviteeGift(state: InviteState): {
  state: InviteState;
  granted: number;
} {
  if (!state.pendingInviter || state.inviteeGiftGranted || state.claimedAsInvitee) {
    return { state, granted: 0 };
  }
  return {
    state: {
      ...state,
      inviteeGiftGranted: true,
      claimedAsInvitee: true,
    },
    granted: 1,
  };
}

export function applyInviteCredit(
  state: InviteState,
  remoteCredit: number,
): { state: InviteState; granted: number } {
  const credit = Math.max(0, Math.floor(remoteCredit));
  if (credit <= state.appliedCreditHammer) {
    return { state, granted: 0 };
  }
  return {
    state: { ...state, appliedCreditHammer: credit },
    granted: credit - state.appliedCreditHammer,
  };
}

export function addInviteHammers(stock: BoosterStock, amount: number): BoosterStock {
  if (amount <= 0) {
    return stock;
  }
  return addBoosterToWallet(stock, 'hammer', amount);
}

export function inviteSettingsHint(state: InviteState): string {
  if (state.pendingInviter && !state.inviteeGiftGranted) {
    return '通关任意一关，你和邀请人各得 1 锤子';
  }
  if (state.appliedCreditHammer > 0 && state.inviteeGiftGranted) {
    return `已领邀请锤子 · 已成功邀请 ${state.appliedCreditHammer} 人`;
  }
  if (state.inviteeGiftGranted) {
    return '已领邀请锤子 · 再邀新朋友通关，你也得锤子';
  }
  if (state.appliedCreditHammer > 0) {
    return `已成功邀请 ${state.appliedCreditHammer} 人，各得 1 锤子`;
  }
  return '邀请新玩家，对方通关后双方各得 1 锤子';
}

export function lobbyInviteHint(state: InviteState): string | null {
  if (state.pendingInviter && !state.inviteeGiftGranted) {
    return '通关第 1 关，你和好友各得锤子';
  }
  return null;
}

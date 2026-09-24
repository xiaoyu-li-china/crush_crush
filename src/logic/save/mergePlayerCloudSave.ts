import type { PlayerCloudSnapshot } from '../../core/ports/IPlayerCloudSave';
import {
  clampBoosterWallet,
  parseBoosterDaily,
} from '../economy/BoosterEconomy';
import type { BoosterStock } from '../economy/BoosterInventory';
import { EMPTY_DAILY_LOOP, type DailyLoopData } from '../economy/DailyLoop';
import {
  mergeInviteCloud,
  parseInviteCloudSlice,
} from '../economy/InviteLoop';
import {
  normalizeLevelProgressData,
  type LevelProgressData,
} from '../level/LevelProgress';

export function mergeLevelProgress(
  local: LevelProgressData,
  remote: LevelProgressData,
): LevelProgressData {
  const a = normalizeLevelProgressData(local);
  const b = normalizeLevelProgressData(remote);
  const scores: Record<string, number> = { ...(a.levelScores ?? {}) };
  for (const [key, value] of Object.entries(b.levelScores ?? {})) {
    const prev = scores[key] ?? 0;
    if (value > prev) {
      scores[key] = value;
    }
  }
  return normalizeLevelProgressData({
    highestLevelId: Math.max(a.highestLevelId, b.highestLevelId),
    totalScore: Math.max(a.totalScore, b.totalScore),
    lastPlayedLevelId:
      a.highestLevelId >= b.highestLevelId ? a.lastPlayedLevelId : b.lastPlayedLevelId,
    levelScores: scores,
  });
}

export function mergeBoosters(local: BoosterStock, remote: BoosterStock): BoosterStock {
  return clampBoosterWallet({
    hammer: Math.max(local.hammer, remote.hammer),
    shuffle: Math.max(local.shuffle, remote.shuffle),
    extraMoves: Math.max(local.extraMoves, remote.extraMoves),
  });
}

export function mergeDaily(local: DailyLoopData, remote: DailyLoopData): DailyLoopData {
  const a = local.ymd ? local : EMPTY_DAILY_LOOP;
  const b = remote.ymd ? remote : EMPTY_DAILY_LOOP;
  if (!a.ymd) {
    return { ...b };
  }
  if (!b.ymd) {
    return { ...a };
  }
  if (a.ymd !== b.ymd) {
    return a.ymd >= b.ymd ? { ...a } : { ...b };
  }
  const flagsA = parseBoosterDaily(a);
  const flagsB = parseBoosterDaily(b);
  return {
    ymd: a.ymd,
    bonusHammer: Math.max(a.bonusHammer, b.bonusHammer),
    clearsToday: Math.max(a.clearsToday, b.clearsToday),
    adHammer: Math.max(flagsA.adHammer, flagsB.adHammer),
    adShuffle: Math.max(flagsA.adShuffle, flagsB.adShuffle),
    adExtra: Math.max(flagsA.adExtra, flagsB.adExtra),
    shareFriendHammer: flagsA.shareFriendHammer || flagsB.shareFriendHammer,
    shareFriendShuffle: flagsA.shareFriendShuffle || flagsB.shareFriendShuffle,
    shareFriendExtra: flagsA.shareFriendExtra || flagsB.shareFriendExtra,
    shareGroupHammer: flagsA.shareGroupHammer || flagsB.shareGroupHammer,
    shareGroupShuffle: flagsA.shareGroupShuffle || flagsB.shareGroupShuffle,
    shareGroupExtra: flagsA.shareGroupExtra || flagsB.shareGroupExtra,
    playShuffleGranted: flagsA.playShuffleGranted || flagsB.playShuffleGranted,
    playExtraGranted: flagsA.playExtraGranted || flagsB.playExtraGranted,
  };
}

/** 云、本地取「更前进」的进度；换机登录不会把高进度覆盖掉。 */
export function mergePlayerCloudSnapshots(
  local: PlayerCloudSnapshot,
  remote: PlayerCloudSnapshot | null,
): PlayerCloudSnapshot {
  if (!remote) {
    return {
      ...local,
      progress: normalizeLevelProgressData(local.progress),
      boosters: clampBoosterWallet(local.boosters),
      invite: parseInviteCloudSlice(local.invite),
      updatedAt: Math.max(1, local.updatedAt || Date.now()),
    };
  }
  return {
    updatedAt: Math.max(local.updatedAt, remote.updatedAt, Date.now()),
    progress: mergeLevelProgress(local.progress, remote.progress),
    boosters: mergeBoosters(local.boosters, remote.boosters),
    settings:
      local.updatedAt >= remote.updatedAt ? local.settings : remote.settings,
    daily: mergeDaily(local.daily, remote.daily),
    invite: mergeInviteCloud(
      parseInviteCloudSlice(local.invite),
      parseInviteCloudSlice(remote.invite),
    ),
  };
}

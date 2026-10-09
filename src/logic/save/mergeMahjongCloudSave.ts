import type { MahjongGameSnapshot } from '../mahjong/MahjongGame';
import type { MahjongToolId } from '../mahjong/MahjongConfig';
import {
  EMPTY_MAHJONG_TOOLS,
  normalizeMahjongProgress,
  type MahjongHallProgressData,
} from '../mahjong/MahjongProgress';

function mergeStars(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) {
    out[key] = Math.max(out[key] ?? 0, value);
  }
  return out;
}

function mergeTools(
  a: Record<MahjongToolId, number>,
  b: Record<MahjongToolId, number>,
): Record<MahjongToolId, number> {
  const out = { ...EMPTY_MAHJONG_TOOLS, ...a };
  for (const k of Object.keys(EMPTY_MAHJONG_TOOLS) as MahjongToolId[]) {
    out[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  }
  return out;
}

function tilesRemaining(run: MahjongGameSnapshot): number {
  return run.pile.length + run.slots.length;
}

/** 保留进度更靠前、或唯一进行中的未完成局。 */
export function mergeMahjongSavedRun(
  local: MahjongGameSnapshot | null,
  remote: MahjongGameSnapshot | null,
): MahjongGameSnapshot | null {
  if (!local) {
    return remote;
  }
  if (!remote) {
    return local;
  }
  const localPlaying = local.phase === 'playing';
  const remotePlaying = remote.phase === 'playing';
  if (localPlaying && !remotePlaying) {
    return local;
  }
  if (remotePlaying && !localPlaying) {
    return remote;
  }
  if (localPlaying && remotePlaying) {
    const leftLocal = tilesRemaining(local);
    const leftRemote = tilesRemaining(remote);
    if (leftLocal !== leftRemote) {
      return leftLocal < leftRemote ? local : remote;
    }
    return local.remainingMs >= remote.remainingMs ? local : remote;
  }
  return null;
}

export function mergeMahjongProgress(
  local: MahjongHallProgressData,
  remote: MahjongHallProgressData | null | undefined,
): MahjongHallProgressData {
  const a = normalizeMahjongProgress(local);
  if (!remote) {
    return a;
  }
  const b = normalizeMahjongProgress(remote);
  return normalizeMahjongProgress({
    coins: Math.max(a.coins, b.coins),
    highestUnlocked: Math.max(a.highestUnlocked, b.highestUnlocked),
    starsByLevel: mergeStars(a.starsByLevel, b.starsByLevel),
    tools: mergeTools(a.tools, b.tools),
    guideSeen: a.guideSeen || b.guideSeen,
    savedRun: mergeMahjongSavedRun(a.savedRun, b.savedRun),
  });
}

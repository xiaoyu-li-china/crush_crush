/**
 * 分享文案：按当前界面写具体标题，query 带上邀请码。
 */

import { withInviterQuery } from '../economy/InviteLoop';

export type ShareScene = 'lobby' | 'playing' | 'crush' | 'clean' | 'result';

export function buildShareTitle(
  scene: ShareScene,
  levelId: number,
  score: number,
): string {
  const level = Math.max(1, Math.floor(levelId) || 1);
  const points = Math.max(0, Math.floor(score) || 0);
  switch (scene) {
    case 'playing':
      return `我在第 ${level} 关，你也来试试？`;
    case 'crush':
      return `第 ${level} 关粉碎中，点格子超解压`;
    case 'clean':
      return `第 ${level} 关打扫中，一起来收尾`;
    case 'result':
      return `我在第 ${level} 关拿了 ${points} 分，你来挑战`;
    default:
      return '萌宠粉碎消，点树上马卡龙就能玩';
  }
}

export function buildShareQuery(
  scene: ShareScene,
  levelId: number,
  score: number,
  inviteCode: string,
): string {
  const level = Math.max(1, Math.floor(levelId) || 1);
  const points = Math.max(0, Math.floor(score) || 0);
  let query = 'from=lobby';
  if (scene === 'playing') {
    query = `from=playing&level=${level}`;
  } else if (scene === 'crush') {
    query = `from=crush&level=${level}`;
  } else if (scene === 'clean') {
    query = `from=clean&level=${level}`;
  } else if (scene === 'result') {
    query = `from=result&level=${level}&score=${points}`;
  }
  return withInviterQuery(query, inviteCode);
}

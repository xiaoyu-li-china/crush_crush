/**
 * 分享文案：按当前界面写具体标题，query 带上邀请码。
 */

import { withInviterQuery } from '../economy/InviteLoop';

export type ShareScene =
  | 'lobby'
  | 'playing'
  | 'crush'
  | 'clean'
  | 'result'
  | 'booster_friend'
  | 'booster_group';

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
    case 'booster_friend':
      return `我在第 ${level} 关缺个道具，转发给我就行`;
    case 'booster_group':
      return `发到群里一起玩，第 ${level} 关更好过`;
    default:
      return '萌宠粉碎消，沿糖果梯子冲进糖果屋';
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
  } else if (scene === 'booster_friend') {
    query = `from=booster_friend&level=${level}`;
  } else if (scene === 'booster_group') {
    query = `from=booster_group&level=${level}`;
  }
  return withInviterQuery(query, inviteCode);
}

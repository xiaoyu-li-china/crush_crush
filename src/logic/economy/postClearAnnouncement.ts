/**
 * 主线通关后的顶部公告文案（大厅 + 局内）。
 */
import { mahjongHallUnlockAnnouncement } from '../mahjong/mahjongHallUnlockCopy';
import noticeJson from '../../config/notice.json';

const COPY = noticeJson as {
  postClear?: {
    cleared?: string;
  };
};

export function buildPostClearAnnouncement(input: {
  clearedLevelId: number;
  leaderboardHint?: string | null;
}): string {
  const hint = (input.leaderboardHint ?? '').trim();
  if (hint) {
    return hint;
  }
  const id = Math.max(1, Math.floor(input.clearedLevelId));
  const post = COPY.postClear;
  if (id === 20) {
    return mahjongHallUnlockAnnouncement();
  }
  const tpl = post?.cleared ?? '恭喜通关第 {level} 关！';
  return tpl.replace(/\{level\}/g, String(id));
}

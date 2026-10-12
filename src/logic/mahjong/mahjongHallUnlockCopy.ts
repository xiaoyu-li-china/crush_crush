import noticeJson from '../../config/notice.json';
import { MAHJONG_HALL_UNLOCK_LADDER_COINS } from './MahjongConfig';

type NoticeCopy = {
  body?: string;
  bodyWhenUnlocked?: string;
  bubbles?: string[];
  mahjongHallLockHint?: string;
  mahjongHallUnlockTeaser?: string;
  postClear?: { mahjongUnlock?: string };
};

const COPY = noticeJson as NoticeCopy;

const MAHJONG_NOTICE_MARK = '麻将馆';

function isMahjongUnlockNoticeLine(line: string): boolean {
  return line.includes(MAHJONG_NOTICE_MARK);
}

/** 大厅公告：未解锁时含麻将馆说明；解锁后去掉该条公告与红字提示。 */
export function lobbyNoticeForMahjongState(mahjongUnlocked: boolean): {
  body: string;
  bubbles: string[];
  showMahjongTeaser: boolean;
  mahjongTeaser: string;
} {
  const rawBubbles = COPY.bubbles ?? [];
  const bubbles = mahjongUnlocked
    ? rawBubbles.filter((line) => !isMahjongUnlockNoticeLine(line))
    : rawBubbles.slice();
  const body = mahjongUnlocked
    ? (COPY.bodyWhenUnlocked ?? COPY.body ?? '')
    : (COPY.body ?? '');
  const mahjongTeaser =
    COPY.mahjongHallUnlockTeaser ??
    `累计 ${MAHJONG_HALL_UNLOCK_LADDER_COINS} 梯子金币⭐，或通关第 20 关，解锁萌宠麻将馆`;
  return {
    body,
    bubbles,
    showMahjongTeaser: !mahjongUnlocked,
    mahjongTeaser,
  };
}

/** 点击未解锁的麻将馆入口时的 Toast 文案。 */
export function mahjongHallLockHint(): string {
  return (
    COPY.mahjongHallLockHint ??
    `通关第 20 关，或梯子累计 ${MAHJONG_HALL_UNLOCK_LADDER_COINS} 金币⭐，即可解锁萌宠麻将馆`
  );
}

/** 通关第 20 关且刚解锁时的顶部公告。 */
export function mahjongHallUnlockAnnouncement(): string {
  return COPY.postClear?.mahjongUnlock ?? '萌宠麻将馆已解锁！左下角入口，随时来搓牌';
}

/**
 * 第 6 关起进关提示：制造「难度提升」预期（艺术字主标题 + 可选章节副标）。
 */
import noticeJson from '../../config/notice.json';

const COPY = noticeJson as {
  difficultyUp?: string;
  difficultyUpCotton?: string;
  difficultyUpParty?: string;
  difficultyUpIce?: string;
};

export type DifficultyArtTip = {
  /** 艺术字主标题，固定「难度提升」 */
  title: string;
  /** 章节副标，可空 */
  subtitle: string | null;
};

/** 兼容旧调用：整句文案（副标用 · 拼接）。 */
export function levelDifficultyTip(levelId: number): string | null {
  const art = levelDifficultyArt(levelId);
  if (!art) {
    return null;
  }
  return art.subtitle ? `${art.title} · ${art.subtitle}` : art.title;
}

export function levelDifficultyArt(levelId: number): DifficultyArtTip | null {
  const id = Math.floor(Number(levelId) || 0);
  if (id < 6) {
    return null;
  }
  const title = COPY.difficultyUp ?? '难度提升';
  if (id === 6) {
    return { title, subtitle: chapterSub(COPY.difficultyUpCotton, '棉花关开始') };
  }
  if (id === 11) {
    return { title, subtitle: chapterSub(COPY.difficultyUpParty, '异形关卡') };
  }
  if (id === 16) {
    return { title, subtitle: chapterSub(COPY.difficultyUpIce, '冰雪埋藏') };
  }
  return { title, subtitle: null };
}

function chapterSub(raw: string | undefined, fallback: string): string {
  if (!raw) {
    return fallback;
  }
  const parts = raw.split('·');
  const tail = parts.length > 1 ? parts.slice(1).join('·').trim() : raw.trim();
  return tail || fallback;
}

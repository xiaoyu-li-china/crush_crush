/**
 * 三消波次按本波分值分档：不错 / 好爽 / 太棒了。
 * <40 不错；[40, 80) 好爽；>=80 太棒了。
 */
export type MatchPraiseTier = 'good' | 'great' | 'excellent';

export interface MatchPraise {
  tier: MatchPraiseTier;
  /** 弹出文字 */
  word: string;
  sfxId: 'sfx_good' | 'sfx_great' | 'sfx_excellent';
  color: string;
}

export function matchPraiseForScore(score: number): MatchPraise {
  if (score >= 80) {
    return {
      tier: 'excellent',
      word: '太棒了！',
      sfxId: 'sfx_excellent',
      color: '#ff922b',
    };
  }
  if (score >= 40) {
    return {
      tier: 'great',
      word: '好爽！',
      sfxId: 'sfx_great',
      color: '#ffe066',
    };
  }
  return {
    tier: 'good',
    word: '不错！',
    sfxId: 'sfx_good',
    color: '#8ce99a',
  };
}

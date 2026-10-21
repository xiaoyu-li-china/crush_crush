import {
  bannerFrame,
  bannerPalette,
  bannerShimmerPhase,
  BANNER_DURATION_MS,
  makeLevelBanner,
  type LevelBanner,
} from '../fx/LevelFx';

export function makeMahjongIntroBanner(level: number, subtitle: string): LevelBanner {
  return makeLevelBanner('mahjong_intro', `第 ${level} 关`, subtitle);
}

export function mahjongIntroSubtitle(themeName?: string): string {
  const base = '三张同牌入槽消除';
  if (!themeName) {
    return base;
  }
  const short = themeName.replace(/麻将馆$/, '').trim();
  return short ? `${short} · ${base}` : base;
}

export function makeMahjongFailBanner(reason: string): LevelBanner {
  return makeLevelBanner('mahjong_fail', '挑战失败', reason);
}

export function mahjongFailReasonLabel(failReason: string | undefined): string {
  if (failReason === 'timeout') {
    return '时间到啦，再试一次吧';
  }
  if (failReason === 'slot_full') {
    return '槽位已满';
  }
  return '加油，下把一定能过';
}

/** 结算卡弹入（失败/胜利通用）。 */
export function mahjongResultRevealFrame(
  startMs: number,
  nowMs: number,
  durationMs = 520,
): { alpha: number; scale: number; offsetY: number } {
  const elapsed = nowMs - startMs;
  if (elapsed <= 0) {
    return { alpha: 0, scale: 0.82, offsetY: 28 };
  }
  const t = Math.min(1, elapsed / durationMs);
  const u = 1 - (1 - t) ** 3;
  const bounce = 1 + 0.06 * Math.sin(t * Math.PI);
  return {
    alpha: Math.min(1, t * 1.35),
    scale: (0.82 + 0.18 * u) * bounce,
    offsetY: (1 - u) * 28,
  };
}

/**
 * 糖果梯子同款中线横幅。返回 false 表示仍在播放。
 */
export function drawMahjongLevelStageBanner(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  banner: LevelBanner,
  nowMs: number,
  centerY = height * 0.42,
): boolean {
  if (banner.startMs === 0) {
    banner.startMs = nowMs;
  }
  const frame = bannerFrame(banner, nowMs);
  if (frame.done) {
    return false;
  }

  const pal = bannerPalette(banner.kind);
  const bandH = banner.subtitle ? 82 : 62;
  const top = centerY - bandH / 2;

  if (banner.kind === 'mahjong_fail') {
    ctx.save();
    ctx.globalAlpha = frame.alpha * 0.28;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = frame.ribbon * 0.92;
  const g = ctx.createLinearGradient(0, top, 0, top + bandH);
  g.addColorStop(0, pal.top);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, width, bandH);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, top, width, 3);
  ctx.fillRect(0, top + bandH - 3, width, 3);
  const shimmer = bannerShimmerPhase(banner, nowMs);
  if (shimmer >= 0) {
    const sx = shimmer * width;
    const sg = ctx.createLinearGradient(sx - 40, top, sx + 40, top + bandH);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 50, top, 100, bandH);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = frame.alpha;
  ctx.translate(width / 2 + frame.offset * width, centerY);
  ctx.scale(frame.scale, frame.scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const titleSize = banner.kind === 'mahjong_intro' ? 34 : 30;
  const ty = banner.subtitle ? -13 : 0;
  ctx.font = `bold ${titleSize}px sans-serif`;
  ctx.strokeStyle = pal.edge;
  ctx.lineWidth = 7;
  ctx.strokeText(banner.title, 0, ty);
  ctx.fillStyle = pal.ink;
  ctx.fillText(banner.title, 0, ty);
  if (banner.subtitle) {
    ctx.font = 'bold 14px sans-serif';
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = 4;
    ctx.strokeText(banner.subtitle, 0, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(banner.subtitle, 0, 22);
  }
  ctx.restore();
  return true;
}

export function mahjongStageBannerDuration(kind: LevelBanner['kind']): number {
  return BANNER_DURATION_MS[kind];
}

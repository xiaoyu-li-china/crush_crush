/**
 * 通关后顶部公告条（大厅 / 局内共用样式）。
 */
import noticeJson from '../../config/notice.json';

export const GAMEPLAY_ANNOUNCEMENT_H = 30;
export const GAMEPLAY_ANNOUNCEMENT_GAP = 4;

export interface GameplayAnnouncementLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  tagW: number;
  textX: number;
  textMaxW: number;
}

export function layoutGameplayAnnouncementBar(input: {
  width: number;
  top: number;
  sidePad?: number;
}): GameplayAnnouncementLayout {
  const side = input.sidePad ?? 12;
  const w = Math.max(80, input.width - side * 2);
  const tagW = 44;
  return {
    x: side,
    y: input.top,
    w,
    h: GAMEPLAY_ANNOUNCEMENT_H,
    tagW,
    textX: side + tagW + 6,
    textMaxW: w - tagW - 14,
  };
}

export function truncateAnnouncementText(
  ctx: WxCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  const raw = String(text ?? '').trim();
  if (!raw || maxWidth <= 0) {
    return '';
  }
  if (ctx.measureText(raw).width <= maxWidth) {
    return raw;
  }
  const ell = '…';
  let lo = 0;
  let hi = raw.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const slice = raw.slice(0, mid) + ell;
    if (ctx.measureText(slice).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return raw.slice(0, Math.max(0, lo)) + ell;
}

export function drawGameplayAnnouncementBar(
  ctx: WxCanvasRenderingContext2D,
  layout: GameplayAnnouncementLayout,
  message: string,
  roundRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => void,
): void {
  const title = noticeJson.title || '公告';
  const { x, y, w, h, tagW, textX, textMaxW } = layout;
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#1c4b7a';
  roundRect(x + 1, y + 2, w, h, h / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const fill = ctx.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, 'rgba(255,255,255,0.98)');
  fill.addColorStop(0.45, 'rgba(232, 248, 255, 0.97)');
  fill.addColorStop(1, 'rgba(208, 235, 255, 0.96)');
  ctx.fillStyle = fill;
  roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2 - 0.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(116, 192, 252, 0.55)';
  ctx.lineWidth = 1;
  roundRect(x - 0.5, y - 0.5, w + 1, h + 1, h / 2 + 0.5);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1864ab';
  ctx.fillText(title, x + tagW / 2, y + h / 2 + 0.5);

  ctx.textAlign = 'left';
  ctx.font = 'bold 12px sans-serif';
  const line = truncateAnnouncementText(ctx, message, textMaxW);
  ctx.fillStyle = '#1864ab';
  ctx.fillText(line, textX, y + h / 2 + 0.5);
  ctx.restore();
}

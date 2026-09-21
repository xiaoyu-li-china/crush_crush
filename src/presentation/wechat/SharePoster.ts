/**
 * 分享贴图海报：游戏画面 + 小游戏码，不截取设置弹窗。
 */

export interface SharePosterImages {
  cover: WxImage | null;
  qr: WxImage | null;
}

export const SHARE_POSTER_WIDTH = 750;
export const SHARE_POSTER_HEIGHT = 1200;

/**
 * 在目标画布上绘制竖版分享海报。
 */
export function paintSharePoster(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  images: SharePosterImages,
): void {
  ctx.clearRect(0, 0, width, height);

  const artH = Math.floor(height * 0.62);
  drawCover(ctx, images.cover, width, artH);

  const fade = ctx.createLinearGradient(0, artH - 90, 0, artH);
  fade.addColorStop(0, 'rgba(255, 236, 245, 0)');
  fade.addColorStop(1, '#fff5fb');
  ctx.fillStyle = fade;
  ctx.fillRect(0, artH - 90, width, 90);

  ctx.fillStyle = '#fff5fb';
  ctx.fillRect(0, artH, width, height - artH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(width * 0.072)}px sans-serif`;
  ctx.fillStyle = '#c2255c';
  fillCenteredSpaced(ctx, '萌宠粉碎消', width / 2, artH - 56, 6);
  ctx.font = `bold ${Math.round(width * 0.032)}px sans-serif`;
  ctx.fillStyle = '#a61e4d';
  fillCenteredSpaced(ctx, '闯关消除 · 可爱小动物', width / 2, artH - 18, 4);

  const qrSize = Math.min(280, Math.floor(width * 0.42));
  const cardW = qrSize + 72;
  const cardH = qrSize + 118;
  const cardX = (width - cardW) / 2;
  const cardY = artH + Math.max(18, (height - artH - cardH) / 2 - 8);

  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, '#ffffff');
  cardGrad.addColorStop(1, '#ffe8f3');
  ctx.fillStyle = cardGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 170, 210, 0.95)';
  ctx.lineWidth = 4;
  ctx.stroke();

  const qrX = cardX + (cardW - qrSize) / 2;
  const qrY = cardY + 28;
  roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  if (images.qr && (images.qr.width || 0) > 0) {
    ctx.drawImage(images.qr, qrX, qrY, qrSize, qrSize);
  } else {
    ctx.fillStyle = '#f1f3f5';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = '#868e96';
    ctx.font = `bold ${Math.round(qrSize * 0.08)}px sans-serif`;
    ctx.fillText('微信搜索', qrX + qrSize / 2, qrY + qrSize / 2 - 10);
    ctx.fillText('萌宠粉碎消', qrX + qrSize / 2, qrY + qrSize / 2 + 16);
  }

  ctx.fillStyle = '#c2255c';
  ctx.font = `bold ${Math.round(width * 0.036)}px sans-serif`;
  fillCenteredSpaced(ctx, '微信扫码 一起消萌宠', width / 2, cardY + cardH - 36, 3);
}

function fillCenteredSpaced(
  ctx: WxCanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  extra: number,
): void {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + extra * Math.max(0, chars.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i]!, x, cy);
    x += (widths[i] ?? 0) + extra;
  }
  ctx.textAlign = prevAlign;
}

function drawCover(
  ctx: WxCanvasRenderingContext2D,
  img: WxImage | null,
  width: number,
  height: number,
): void {
  if (!img || (img.width || 0) <= 0) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#9ed4fb');
    g.addColorStop(1, '#ffe0ef');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const iw = Math.max(1, img.width);
  const ih = Math.max(1, img.height);
  const cover = Math.max(width / iw, height / ih);
  const dw = iw * cover;
  const dh = ih * cover;
  const dx = (width - dw) / 2;
  const dy = (height - dh) * 0.42;
  ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
}

function roundRect(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

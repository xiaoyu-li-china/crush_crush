/** 麻将馆弹窗 / 遮罩：与主线 drawCuteCard 同系列，青绿系区分。 */

export interface MahjongCuteCardStyle {
  radius?: number;
  fillTop?: string;
  fillBottom?: string;
  border?: string;
  borderWidth?: number;
  shadow?: boolean;
  sparkle?: boolean;
  nowMs?: number;
}

const MJ_CARD_DEFAULT: Required<Omit<MahjongCuteCardStyle, 'nowMs'>> = {
  radius: 22,
  fillTop: 'rgba(255,255,255,0.98)',
  fillBottom: 'rgba(224, 248, 245, 0.97)',
  border: 'rgba(56, 178, 172, 0.92)',
  borderWidth: 3,
  shadow: false,
  sparkle: true,
};

function roundRectPath(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function mahjongCoverLayout(
  img: WxImage,
  width: number,
  height: number,
  vBias = 0.52,
): { dx: number; dy: number; dw: number; dh: number } {
  const iw = Math.max(1, img.width || width);
  const ih = Math.max(1, img.height || height);
  const cover = Math.max(width / iw, height / ih);
  const dw = iw * cover;
  const dh = ih * cover;
  const dx = (width - dw) * 0.5;
  const bias = Math.max(0, Math.min(1, vBias));
  const dy = (height - dh) * bias;
  return { dx, dy, dw, dh };
}

/** 对局底图裁掉 lobby 顶部大段天空，让牌堆区露出糖果/萌宠场景。 */
export const MAHJONG_PLAY_LOBBY_SRC_TOP_RATIO = 0.14;

export function mahjongPlayLobbyCoverLayout(
  img: WxImage,
  width: number,
  height: number,
  pileTop: number,
  pileBottom: number,
): {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
} {
  const iw = Math.max(1, img.width || width);
  const ih = Math.max(1, img.height || height);
  const sy = Math.floor(ih * MAHJONG_PLAY_LOBBY_SRC_TOP_RATIO);
  const sh = Math.max(1, ih - sy);
  const pileMidNorm =
    pileBottom > pileTop ? (pileTop + pileBottom) * 0.5 / Math.max(1, height) : 0.55;
  const vBias = Math.max(0.48, Math.min(0.74, 0.5 + pileMidNorm * 0.32));
  const cover = Math.max(width / iw, height / sh);
  const dw = iw * cover;
  const dh = sh * cover;
  const dx = (width - dw) * 0.5;
  const dy = (height - dh) * vBias;
  return { sx: 0, sy, sw: iw, sh, dx, dy, dw, dh };
}

/** 关卡底：大厅 lobby 等插画 cover 铺满，不加青绿朦层。 */
export function drawMahjongPlaySceneBackground(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  pileTop: number,
  pileBottom: number,
  bgImage: WxImage | null | undefined,
  _slotY?: number,
  bgShift = { dx: 0, dy: 0 },
): void {
  ctx.save();
  const bleed = 28;
  ctx.translate(bgShift.dx, bgShift.dy);

  ctx.fillStyle = '#b8ddd8';
  ctx.fillRect(-bleed, -bleed, width + bleed * 2, height + bleed * 2);

  if (bgImage) {
    try {
      const layout = mahjongPlayLobbyCoverLayout(bgImage, width, height, pileTop, pileBottom);
      ctx.drawImage(
        bgImage,
        layout.sx,
        layout.sy,
        layout.sw,
        layout.sh,
        layout.dx - bleed,
        layout.dy - bleed,
        layout.dw + bleed * 2,
        layout.dh + bleed * 2,
      );
    } catch {
      // 模拟器 drawImage 失败时保留底色
    }
  }

  ctx.restore();
}

/** 弹窗遮罩：对齐主线结果页紫幕，改为青绿暖色。 */
export function drawMahjongModalVeil(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  strength = 0.48,
): void {
  ctx.fillStyle = `rgba(28, 64, 58, ${strength})`;
  ctx.fillRect(0, 0, width, height);
}

export function drawMahjongCuteCard(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: MahjongCuteCardStyle = {},
): void {
  const s = { ...MJ_CARD_DEFAULT, ...style };
  const r = s.radius;

  if (s.shadow) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#1a4a44';
    roundRectPath(ctx, x + 3, y + 7, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, s.fillTop);
  grad.addColorStop(1, s.fillBottom);
  ctx.fillStyle = grad;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.5;
  const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.45);
  gloss.addColorStop(0, 'rgba(255,255,255,0.92)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  roundRectPath(ctx, x + 4, y + 3, w - 8, h * 0.4, Math.max(8, r - 6));
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = s.border;
  ctx.lineWidth = s.borderWidth;
  roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(4, r - 1));
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 6));
  ctx.stroke();

  if (s.sparkle) {
    const t = (s.nowMs ?? 0) * 0.006;
    const dots = [
      { dx: 18, dy: 16 },
      { dx: w - 20, dy: 18 },
      { dx: 22, dy: h - 18 },
      { dx: w - 24, dy: h - 20 },
    ];
    for (let i = 0; i < dots.length; i += 1) {
      const d = dots[i]!;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t + i));
      ctx.save();
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#96f2d7';
      ctx.beginPath();
      ctx.arc(x + d.dx, y + d.dy, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export interface MahjongModalCardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  heroH: number;
  footerH: number;
}

/** 屏幕正中弹窗卡（与主线 layoutWinCelebratePanel 同思路）。 */
export function layoutMahjongModalCard(
  width: number,
  height: number,
  cardW: number,
  cardH: number,
  footerH: number,
): MahjongModalCardLayout {
  const x = (width - cardW) / 2;
  const y = (height - cardH) / 2;
  return {
    x,
    y,
    w: cardW,
    h: cardH,
    cx: x + cardW / 2,
    cy: y + cardH / 2,
    heroH: Math.max(120, cardH - footerH),
    footerH,
  };
}

/** 道具名标签：紧凑胶囊 + 厚白边（可右对齐，让出左侧小动物） */
export function drawMahjongToolNameLabel(
  ctx: WxCanvasRenderingContext2D,
  text: string,
  anchorX: number,
  cy: number,
  align: 'center' | 'right' = 'center',
): void {
  ctx.save();
  ctx.font = 'bold 9px sans-serif';
  const padX = 5;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = 14;
  const x = align === 'right' ? anchorX - w : anchorX - w / 2;
  const y = cy - h / 2;
  const r = h / 2;

  const body = ctx.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, 'rgba(255,255,255,0.98)');
  body.addColorStop(0.42, 'rgba(245,252,250,0.96)');
  body.addColorStop(1, 'rgba(196, 228, 220, 0.94)');
  ctx.fillStyle = body;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, x + 2, y + 1.5, w - 4, h * 0.38, Math.max(2, r - 3));
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.98)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(46, 138, 128, 0.45)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, r - 1);
  ctx.stroke();

  const tx = align === 'right' ? anchorX - padX : anchorX;
  ctx.textAlign = align === 'right' ? 'right' : 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 9px sans-serif';
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.strokeText(text, tx, cy);
  ctx.fillStyle = '#15524a';
  ctx.fillText(text, tx, cy);
  ctx.restore();
}

/** 道具次数角标：红球 + 白圈，对齐主线道具栏 */
export function drawMahjongToolCountBadge(
  ctx: WxCanvasRenderingContext2D,
  count: number,
  bx: number,
  by: number,
): void {
  const r = 11;
  ctx.save();
  const g = ctx.createRadialGradient(bx - 3, by - 4, 1, bx, by, r);
  g.addColorStop(0, '#ff8787');
  g.addColorStop(1, '#e03131');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  drawMahjongCenterText(ctx, String(count), bx, by, 'bold 11px sans-serif', '#ffffff');
  ctx.restore();
}

export function drawMahjongCenterText(
  ctx: WxCanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  font: string,
  fill: string,
): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

const MJ_CELEBRATE_CROP_TOP = 0.36;

/** 主线 win-celebrate 上图区（裁掉顶部留白，与闯关胜利弹窗一致）。 */
export function drawMahjongCelebrateHeroImage(
  ctx: WxCanvasRenderingContext2D,
  img: WxImage,
  cardX: number,
  cardY: number,
  cardW: number,
  heroH: number,
  radius: number,
  cropTopRatio = MJ_CELEBRATE_CROP_TOP,
  cropBottomRatio = 0,
): void {
  const iw = Math.max(1, img.width || 576);
  const ih = Math.max(1, img.height || 604);
  const sy = Math.floor(ih * Math.max(0, Math.min(0.55, cropTopRatio)));
  const bottomCut = Math.floor(ih * Math.max(0, Math.min(0.45, cropBottomRatio)));
  const sh = Math.max(1, ih - sy - bottomCut);
  const pad = 8;
  const drawW = cardW - pad * 2;
  const drawH = heroH - pad - 6;
  const drawX = cardX + pad;
  const drawY = cardY + 6;
  ctx.save();
  roundRectPath(ctx, drawX, drawY, drawW, drawH, radius - 4);
  ctx.clip();
  ctx.drawImage(img, 0, sy, iw, sh, drawX, drawY, drawW, drawH);
  ctx.restore();
}

/** 弹窗内衬：与对局相同的 lobby/关卡 cover + 轻蒙版（无青绿框） */
export function drawMahjongModalPlayBackgroundPanel(
  ctx: WxCanvasRenderingContext2D,
  img: WxImage,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  try {
    const layout = mahjongCoverLayout(img, w, h, 0.5);
    ctx.drawImage(img, x + layout.dx, y + layout.dy, layout.dw, layout.dh);
  } catch {
    ctx.fillStyle = '#e8f8f5';
    ctx.fillRect(x, y, w, h);
  }
  const wash = ctx.createLinearGradient(x, y, x, y + h);
  wash.addColorStop(0, 'rgba(255,255,255,0.38)');
  wash.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  wash.addColorStop(1, 'rgba(255,255,255,0.36)');
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** 底部按钮区可读性渐变（叠在关卡底图上） */
export function drawMahjongModalFooterReadableBand(
  ctx: WxCanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  footerH: number,
): void {
  const footY = cardY + cardH - footerH;
  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 22);
  ctx.clip();
  const g = ctx.createLinearGradient(0, footY - 24, 0, cardY + cardH);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(cardX, footY - 24, cardW, footerH + 24);
  ctx.restore();
}

/** 弹窗底图（拉伸至 card 区域，圆角裁剪） */
export function drawMahjongModalPanelImage(
  ctx: WxCanvasRenderingContext2D,
  img: WxImage,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  try {
    ctx.drawImage(img, x, y, w, h);
  } catch {
    // 模拟器 drawImage 失败时由调用方 fallback
  }
  ctx.restore();
}

export function drawMahjongModalCardFace(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  chrome: { playBgImage?: WxImage | null; slotFullModalBg?: WxImage | null },
  nowMs: number,
): void {
  if (chrome.playBgImage) {
    drawMahjongModalPlayBackgroundPanel(ctx, chrome.playBgImage, x, y, w, h, radius);
    return;
  }
  if (chrome.slotFullModalBg) {
    drawMahjongModalPanelImage(ctx, chrome.slotFullModalBg, x, y, w, h, radius);
    return;
  }
  drawMahjongCuteCard(ctx, x, y, w, h, {
    nowMs,
    radius,
    borderWidth: 0,
    border: 'transparent',
    shadow: false,
    sparkle: false,
  });
}

export function drawMahjongModalFooterBand(
  ctx: WxCanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  footerH: number,
): void {
  const footY = cardY + cardH - footerH;
  const g = ctx.createLinearGradient(0, footY, 0, cardY + cardH);
  g.addColorStop(0, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(224, 248, 245, 0.65)');
  ctx.fillStyle = g;
  roundRectPath(ctx, cardX + 8, footY, cardW - 16, footerH - 6, 14);
  ctx.fill();
}

export function drawMahjongPrimaryCapsuleButton(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  top = '#ffe066',
  bottom = '#fab005',
  textColor = '#5c3d00',
): void {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, h / 2 - 1);
  ctx.stroke();
  drawMahjongCenterText(ctx, label, x + w / 2, y + h / 2, 'bold 16px sans-serif', textColor);
}

/** 主线风格关闭圆钮（黄色 ×）。 */
export function drawMahjongPanelCloseOrb(
  ctx: WxCanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(92, 61, 0, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawMahjongCenterText(
    ctx,
    '×',
    cx,
    cy + 1,
    `${Math.floor(r * 1.05)}px sans-serif`,
    '#5c3d00',
  );
  ctx.restore();
}

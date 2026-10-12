import {
  MAHJONG_STAND_EDGE_LONG,
  MAHJONG_STAND_EDGE_SHORT,
  MAHJONG_STAND_FLAT,
} from '../../logic/mahjong/MahjongPilePoses';
import type { MahjongTileImageLookup } from './MahjongHallUi';
import { mahjongBlockShape } from './MahjongPileLayout';
import {
  getMahjongTileRasterBlit,
  mahjongTileRasterEligible,
  quantizeMahjongTileFaceW,
} from './MahjongTileRasterCache';
import { getMahjongTileShellPack } from './MahjongTileShellAssets';

const TILE_COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffd43b', '#cc5de8', '#ff922b', '#20c997', '#868e96'];

/** 白玉牌体 + 绿玉背层（偏亮、少压暗，避免牌堆整体发灰）。 */
const C = {
  faceTop: '#ffffff',
  faceBottom: '#faf6ee',
  sideLight: '#f3efe6',
  sideDeep: '#e6e0d4',
  green: '#62d48a',
  greenLight: '#9aebb8',
  greenDeep: '#42c06e',
  edgeLine: 'rgba(120, 110, 90, 0.16)',
} as const;

export interface DrawMahjongTileOptions {
  alpha?: number;
  lift?: number;
  /** @see MAHJONG_STAND_*；缺省按平铺牌面朝上 */
  stand?: number;
  /** 0=底层 … 1=顶层，用于堆叠明暗 */
  layerDepth?: number;
  /** 扣牌：只展示背面 */
  faceDown?: boolean;
  mahjongLevel?: number;
  /** 主题 id，用于牌面位图缓存键 */
  rasterThemeKey?: string;
  /** 飞牌等尺寸变化时用固定牌面宽取缓存再缩放 */
  rasterFaceW?: number;
}

function roundRect(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillEllipse(
  ctx: WxCanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
): void {
  ctx.beginPath();
  if (ctx.ellipse) {
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  } else {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(rx, ry);
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
  }
  ctx.fill();
}

function drawImageContain(
  ctx: WxCanvasRenderingContext2D,
  img: WxImage,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const src = img as { width?: number; height?: number };
  const iw = src.width ?? w;
  const ih = src.height ?? h;
  if (iw <= 0 || ih <= 0) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** 铺满区域并居中裁剪，牌面萌宠用 cover 才能随牌放大、只留一圈边。 */
function drawImageCover(
  ctx: WxCanvasRenderingContext2D,
  img: WxImage,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const src = img as { width?: number; height?: number };
  const iw = src.width ?? w;
  const ih = src.height ?? h;
  if (iw <= 0 || ih <= 0) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function petImage(
  lookup: MahjongTileImageLookup | undefined,
  type: number,
): WxImage | undefined {
  return lookup?.(type) ?? getMahjongTileShellPack()?.frontPetRabbit;
}

function drawPetOrSwatch(
  ctx: WxCanvasRenderingContext2D,
  lookup: MahjongTileImageLookup | undefined,
  type: number,
  x: number,
  y: number,
  w: number,
  h: number,
  mode: 'cover' | 'contain' = 'cover',
): void {
  const img = petImage(lookup, type);
  if (img) {
    if (mode === 'cover') {
      drawImageCover(ctx, img, x, y, w, h);
    } else {
      drawImageContain(ctx, img, x, y, w, h);
    }
    return;
  }
  ctx.fillStyle = TILE_COLORS[type % TILE_COLORS.length] ?? '#adb5bd';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.34, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 实心牌体：整块轮廓（顶面 + 厚度）先填侧面色，再在轮廓内画绿玉层；
 * 顶面随后盖上去，露出来的下沿就是牌的厚度。
 * greenFrom/greenTo 为厚度带内绿玉层的起止比例（0=贴顶面，1=贴桌面）。
 */
function drawBlockBody(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  topH: number,
  ext: number,
  r: number,
  greenFrom: number,
  greenTo: number,
  extTint: 'green' | 'jade' = 'green',
): void {
  const h = topH + ext;
  const side = ctx.createLinearGradient(0, y + topH - r, 0, y + h);
  side.addColorStop(0, C.sideLight);
  side.addColorStop(1, C.sideDeep);
  ctx.fillStyle = side;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  if (greenTo > greenFrom) {
    const gy0 = y + topH + ext * greenFrom - (greenFrom <= 0 ? r : 0);
    const gy1 = y + topH + ext * greenTo;
    const g = ctx.createLinearGradient(0, gy0, 0, gy1);
    if (extTint === 'jade') {
      g.addColorStop(0, C.faceTop);
      g.addColorStop(0.4, C.faceBottom);
      g.addColorStop(1, '#ebe3d4');
    } else {
      g.addColorStop(0, C.greenLight);
      g.addColorStop(0.42, C.green);
      g.addColorStop(1, C.greenDeep);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, gy0, w, gy1 - gy0);
    if (greenFrom <= 0.02) {
      const seamH = Math.max(0.8, ext * 0.12);
      const seam = ctx.createLinearGradient(0, y + topH - seamH * 0.3, 0, y + topH + seamH);
      seam.addColorStop(0, 'rgba(255,255,255,0.5)');
      seam.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = seam;
      ctx.fillRect(x, y + topH - seamH * 0.3, w, seamH * 1.3);
    }
  }

  const sideShade = ctx.createLinearGradient(x, 0, x + w, 0);
  sideShade.addColorStop(0, 'rgba(255,255,255,0.22)');
  sideShade.addColorStop(0.5, 'rgba(255,255,255,0)');
  sideShade.addColorStop(1, 'rgba(40, 32, 18, 0.1)');
  ctx.fillStyle = sideShade;
  ctx.fillRect(x, y + topH - r * 0.5, w, ext + r * 0.5);

  if (ext > 0) {
    const rimH = Math.max(1, ext * 0.35);
    const rim = ctx.createLinearGradient(0, y + h - rimH, 0, y + h);
    rim.addColorStop(0, 'rgba(30, 70, 45, 0)');
    rim.addColorStop(
      1,
      extTint === 'jade' ? 'rgba(100, 88, 70, 0.14)' : 'rgba(25, 55, 38, 0.22)',
    );
    ctx.fillStyle = rim;
    ctx.fillRect(x, y + h - rimH, w, rimH);
  }
  ctx.restore();

  ctx.strokeStyle = C.edgeLine;
  ctx.lineWidth = Math.max(0.65, w * 0.013);
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(0.45, w * 0.008);
  roundRect(ctx, x + w * 0.01, y + w * 0.01, w - w * 0.02, h - w * 0.02, r - w * 0.01);
  ctx.stroke();
}

/** 牌面与厚度交界：一圈细棱 + 下沿轻阴影，增强「实体块」手感（不超出轮廓）。 */
function drawFaceThicknessLedge(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  topH: number,
  ext: number,
  r: number,
): void {
  if (ext <= 0) {
    return;
  }
  ctx.save();
  roundRect(ctx, x, y, w, topH + ext, r);
  ctx.clip();
  const ly = y + topH - Math.max(0.6, w * 0.01);
  const lh = Math.max(1.4, ext * 0.28);
  const ledge = ctx.createLinearGradient(0, ly, 0, ly + lh);
  ledge.addColorStop(0, 'rgba(70, 62, 48, 0.16)');
  ledge.addColorStop(0.4, 'rgba(255,255,255,0.32)');
  ledge.addColorStop(1, 'rgba(110, 98, 78, 0.1)');
  ctx.fillStyle = ledge;
  ctx.fillRect(x + w * 0.05, ly, w * 0.9, lh);
  const ao = ctx.createLinearGradient(0, ly + lh * 0.3, 0, ly + lh + ext * 0.25);
  ao.addColorStop(0, 'rgba(50, 42, 30, 0)');
  ao.addColorStop(1, 'rgba(50, 42, 30, 0.1)');
  ctx.fillStyle = ao;
  ctx.fillRect(x, ly, w, ext * 0.35);
  ctx.restore();
}

/** 牌面釉光：左上高光、右下环境暗角、小高光点（类似手持亚克力/密胺牌）。 */
function drawFaceTactileFinish(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  alpha: number,
): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.globalAlpha = alpha;
  const sweep = ctx.createLinearGradient(x, y, x + w * 0.72, y + h * 0.78);
  sweep.addColorStop(0, 'rgba(255,255,255,0.38)');
  sweep.addColorStop(0.45, 'rgba(255,255,255,0.06)');
  sweep.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sweep;
  ctx.fillRect(x, y, w, h);
  const ao = ctx.createRadialGradient(
    x + w * 0.9,
    y + h * 0.92,
    0,
    x + w * 0.9,
    y + h * 0.92,
    w * 0.62,
  );
  ao.addColorStop(0, 'rgba(45, 38, 28, 0.14)');
  ao.addColorStop(1, 'rgba(45, 38, 28, 0)');
  ctx.fillStyle = ao;
  ctx.fillRect(x, y, w, h);
  const spec = ctx.createRadialGradient(
    x + w * 0.2,
    y + h * 0.16,
    0,
    x + w * 0.2,
    y + h * 0.16,
    w * 0.14,
  );
  spec.addColorStop(0, 'rgba(255,255,255,0.65)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawWhiteTopFace(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const face = ctx.createLinearGradient(x, y, x + w * 0.38, y + h);
  face.addColorStop(0, C.faceTop);
  face.addColorStop(0.65, C.faceBottom);
  face.addColorStop(1, '#f2ebe0');
  ctx.fillStyle = face;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  const gx = x + w * 0.28;
  const gy = y + h * 0.22;
  const gloss = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.68);
  gloss.addColorStop(0, 'rgba(255,255,255,0.92)');
  gloss.addColorStop(0.4, 'rgba(255,255,255,0.28)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  const spec2 = ctx.createRadialGradient(
    x + w * 0.78,
    y + h * 0.12,
    0,
    x + w * 0.78,
    y + h * 0.12,
    w * 0.2,
  );
  spec2.addColorStop(0, 'rgba(255,255,255,0.35)');
  spec2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec2;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function drawTopFaceBevel(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  alpha: number,
): void {
  const lw = Math.max(0.75, w * 0.032);
  const bevel = ctx.createLinearGradient(x, y, x + w * 0.75, y + h);
  bevel.addColorStop(0, 'rgba(255,255,255,0.96)');
  bevel.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  bevel.addColorStop(1, 'rgba(130, 115, 88, 0.35)');
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = bevel;
  ctx.lineWidth = lw;
  roundRect(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, r - lw / 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120, 108, 82, 0.22)';
  ctx.lineWidth = Math.max(0.55, w * 0.013);
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawGreenBackTop(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, C.greenLight);
  g.addColorStop(0.55, C.green);
  g.addColorStop(1, C.greenDeep);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  const u = Math.min(w, h);
  if (h > w * 0.8) {
    drawPawEmblem(ctx, x + w / 2, y + h * 0.53, u * 0.2);
  }

  const gx = x + w * 0.3;
  const gy = y + h * 0.2;
  const gloss = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.65);
  gloss.addColorStop(0, 'rgba(255,255,255,0.58)');
  gloss.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, w, h);
  drawFaceTactileFinish(ctx, x, y, w, h, r, 1);
  ctx.restore();
}

/** 绿玉背面中间的浅浮雕爪印。 */
function drawPawEmblem(
  ctx: WxCanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
): void {
  const pads: Array<[number, number, number]> = [
    [-0.62, -0.62, 0.24],
    [-0.22, -0.92, 0.26],
    [0.22, -0.92, 0.26],
    [0.62, -0.62, 0.24],
  ];
  ctx.fillStyle = 'rgba(120, 210, 155, 0.92)';
  fillEllipse(ctx, cx, cy + s * 0.15, s * 0.5, s * 0.4, 0);
  for (const [px, py, pr] of pads) {
    ctx.beginPath();
    ctx.arc(cx + px * s, cy + py * s, pr * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 平铺 / 斜靠 / 竖立：牌面（或扣着的背面）朝上。 */
function drawFaceUpBlock(
  ctx: WxCanvasRenderingContext2D,
  type: number,
  lookup: MahjongTileImageLookup | undefined,
  w: number,
  topH: number,
  ext: number,
  faceDown: boolean,
  alpha: number,
): void {
  const x = -w / 2;
  const y = -(topH + ext) / 2;
  const r = w * 0.13;
  ctx.globalAlpha = alpha;
  if (faceDown) {
    drawBlockBody(ctx, x, y, w, topH, ext, r, 0, 0.45);
    drawGreenBackTop(ctx, x, y, w, topH, r);
  } else {
    drawBlockBody(ctx, x, y, w, topH, ext, r, 0.06, 1, 'jade');
    drawWhiteTopFace(ctx, x, y, w, topH, r);
    drawFaceTactileFinish(ctx, x, y, w, topH, r, alpha);
    drawFaceThicknessLedge(ctx, x, y, w, topH, ext, r);
    const pad = w * 0.118;
    ctx.save();
    roundRect(ctx, x + pad, y + pad, w - pad * 2, topH - pad * 2, r - pad);
    ctx.clip();
    drawPetOrSwatch(
      ctx,
      lookup,
      type,
      x + pad,
      y + pad,
      w - pad * 2,
      topH - pad * 2,
      'cover',
    );
    ctx.restore();
  }
  drawTopFaceBevel(ctx, x, y, w, topH, r, alpha);
}

/**
 * 侧立：朝上的是 40 宽侧面。左侧露出一窄条被压扁的牌面（保证看得出花色），
 * 右侧一条绿玉背层，下沿是牌的端面厚度。
 */
function drawEdgeShortBlock(
  ctx: WxCanvasRenderingContext2D,
  type: number,
  lookup: MahjongTileImageLookup | undefined,
  faceW: number,
  faceDown: boolean,
  alpha: number,
): void {
  const shape = mahjongBlockShape(MAHJONG_STAND_EDGE_SHORT);
  const w = faceW * shape.topW;
  const topH = faceW * shape.topH;
  const ext = faceW * shape.ext;
  const x = -w / 2;
  const y = -(topH + ext) / 2;
  const r = w * 0.14;
  ctx.globalAlpha = alpha;
  drawBlockBody(ctx, x, y, w, topH, ext, r, 0, 0);

  const faceStripW = w * 0.66;
  const sideX = x + faceStripW;
  const sideW = w - faceStripW;
  const greenW = sideW * 0.42;
  ctx.save();
  roundRect(ctx, x, y, w, topH, r);
  ctx.clip();
  const side = ctx.createLinearGradient(sideX, 0, x + w, 0);
  side.addColorStop(0, C.faceTop);
  side.addColorStop(1, C.sideLight);
  ctx.fillStyle = side;
  ctx.fillRect(sideX, y, sideW, topH);
  const gx = faceDown ? sideX : x + w - greenW;
  const g = ctx.createLinearGradient(gx, 0, gx + greenW, 0);
  g.addColorStop(0, faceDown ? C.greenDeep : C.greenLight);
  g.addColorStop(1, faceDown ? C.greenLight : C.greenDeep);
  ctx.fillStyle = g;
  ctx.fillRect(gx, y, greenW, topH);
  ctx.restore();

  if (faceDown) {
    drawGreenBackTop(ctx, x, y, faceStripW, topH, r);
  } else {
    const fx = x;
    const fy = y;
    const fw = faceStripW + r;
    drawWhiteTopFace(ctx, fx, fy, fw, topH, r);
    drawFaceTactileFinish(ctx, fx, fy, fw, topH, r, alpha);
    drawFaceThicknessLedge(ctx, x, y, w, topH, ext, r);
    const img = petImage(lookup, type);
    if (img) {
      ctx.save();
      ctx.translate(x + faceStripW / 2, y + topH / 2);
      ctx.scale(0.72, 1);
      const s = faceW * 0.74;
      drawImageContain(ctx, img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }
  ctx.strokeStyle = 'rgba(150, 140, 115, 0.35)';
  ctx.lineWidth = Math.max(0.5, w * 0.016);
  ctx.beginPath();
  ctx.moveTo(sideX, y + r * 0.3);
  ctx.lineTo(sideX, y + topH + ext - r * 0.3);
  ctx.stroke();
  drawTopFaceBevel(ctx, x, y, w, topH, r, alpha);
}

/**
 * 横立：朝上的是 88×40 顶边，靠后一条绿玉；
 * 下方厚度带是被压扁的牌面（看得出花色）。
 */
function drawEdgeLongBlock(
  ctx: WxCanvasRenderingContext2D,
  type: number,
  lookup: MahjongTileImageLookup | undefined,
  faceW: number,
  faceDown: boolean,
  alpha: number,
): void {
  const shape = mahjongBlockShape(MAHJONG_STAND_EDGE_LONG);
  const w = faceW * shape.topW;
  const topH = faceW * shape.topH;
  const ext = faceW * shape.ext;
  const x = -w / 2;
  const y = -(topH + ext) / 2;
  const r = w * 0.12;
  const h = topH + ext;
  ctx.globalAlpha = alpha;

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  if (faceDown) {
    drawGreenBackTop(ctx, x, y + topH, w, ext, 0);
  } else {
    const front = ctx.createLinearGradient(0, y + topH, 0, y + h);
    front.addColorStop(0, '#fcfaf4');
    front.addColorStop(1, '#f0ebe2');
    ctx.fillStyle = front;
    ctx.fillRect(x, y + topH, w, ext);
    const img = petImage(lookup, type);
    if (img) {
      ctx.save();
      ctx.translate(0, y + topH + ext * 0.5);
      ctx.scale(1, 0.7);
      const s = faceW * 0.72;
      drawImageContain(ctx, img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }
  const edge = ctx.createLinearGradient(0, y, 0, y + topH);
  edge.addColorStop(0, C.faceTop);
  edge.addColorStop(1, C.sideLight);
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, topH);
  const stripH = topH * 0.42;
  const gy = faceDown ? y + topH - stripH : y;
  const g = ctx.createLinearGradient(0, gy, 0, gy + stripH);
  g.addColorStop(0, faceDown ? C.green : C.greenLight);
  g.addColorStop(1, faceDown ? C.greenDeep : C.green);
  ctx.fillStyle = g;
  ctx.fillRect(x, gy, w, stripH);
  ctx.restore();

  ctx.strokeStyle = 'rgba(150, 140, 115, 0.35)';
  ctx.lineWidth = Math.max(0.5, w * 0.012);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.3, y + topH);
  ctx.lineTo(x + w - r * 0.3, y + topH);
  ctx.stroke();
  drawTopFaceBevel(ctx, x, y, w, h, r, alpha);
}

export function drawStandingMahjongTileBlocks(
  ctx: WxCanvasRenderingContext2D,
  type: number,
  lookup: MahjongTileImageLookup | undefined,
  stand: number,
  faceW: number,
  faceDown: boolean,
  alpha: number,
): { w: number; h: number } {
  const shape = mahjongBlockShape(stand);
  if (stand === MAHJONG_STAND_EDGE_SHORT) {
    drawEdgeShortBlock(ctx, type, lookup, faceW, faceDown, alpha);
    return { w: faceW * shape.topW, h: faceW * (shape.topH + shape.ext) };
  }
  if (stand === MAHJONG_STAND_EDGE_LONG) {
    drawEdgeLongBlock(ctx, type, lookup, faceW, faceDown, alpha);
    return { w: faceW * shape.topW, h: faceW * (shape.topH + shape.ext) };
  }
  drawFaceUpBlock(
    ctx,
    type,
    lookup,
    faceW,
    faceW * shape.topH,
    faceW * shape.ext,
    faceDown,
    alpha,
  );
  return { w: faceW * shape.topW, h: faceW * (shape.topH + shape.ext) };
}

/** 在 hit 框内按姿态画一块俯视实心麻将（牌块等比缩放进框，居中）。 */
export function drawStandingMahjongTile(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rot: number,
  type: number,
  lookup?: MahjongTileImageLookup,
  opts: DrawMahjongTileOptions = {},
): void {
  const stand = opts.stand ?? MAHJONG_STAND_FLAT;
  const shape = mahjongBlockShape(stand);
  const faceW = Math.min(w / shape.topW, h / (shape.topH + shape.ext));
  if (!(faceW > 0)) {
    return;
  }
  const alpha = opts.alpha ?? 1;
  const faceDown = opts.faceDown === true;

  if (mahjongTileRasterEligible(opts)) {
    const rasterFaceW = quantizeMahjongTileFaceW(opts.rasterFaceW ?? faceW);
    const blit = getMahjongTileRasterBlit(
      opts.rasterThemeKey!,
      type,
      stand,
      faceDown,
      rasterFaceW,
      lookup,
      (offCtx, t, st, fd, fw, lu) =>
        drawStandingMahjongTileBlocks(offCtx, t, lu, st, fw, fd, 1),
    );
    if (blit) {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2 + (opts.lift ?? 0));
      ctx.rotate(rot);
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      const quality = (ctx as { imageSmoothingQuality?: string }).imageSmoothingQuality;
      if (quality !== undefined) {
        (ctx as { imageSmoothingQuality?: string }).imageSmoothingQuality = 'high';
      }
      const k = faceW / rasterFaceW;
      const bw = blit.w * k;
      const bh = blit.h * k;
      try {
        ctx.drawImage(blit.canvas, -bw / 2, -bh / 2, bw, bh);
      } catch {
        drawStandingMahjongTileBlocks(ctx, type, lookup, stand, faceW, faceDown, alpha);
      }
      ctx.imageSmoothingEnabled = smooth;
      if (quality !== undefined) {
        (ctx as { imageSmoothingQuality?: string }).imageSmoothingQuality = quality;
      }
      ctx.restore();
      return;
    }
  }

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + (opts.lift ?? 0));
  ctx.rotate(rot);
  drawStandingMahjongTileBlocks(ctx, type, lookup, stand, faceW, faceDown, alpha);
  ctx.restore();
}

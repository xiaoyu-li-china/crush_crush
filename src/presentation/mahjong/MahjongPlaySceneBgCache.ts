import { drawMahjongPlaySceneBackground } from './MahjongCutePanel';

interface SceneBgCacheEntry {
  key: string;
  canvas: WxCanvas;
}

let sceneBgCache: SceneBgCacheEntry | null = null;

function createOffscreenCanvas(width: number, height: number): WxCanvas | null {
  try {
    const wxApi = (globalThis as { wx?: { createCanvas?: () => WxCanvas } }).wx;
    if (!wxApi?.createCanvas) {
      return null;
    }
    const canvas = wxApi.createCanvas();
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    return canvas;
  } catch {
    return null;
  }
}

function sceneBgCacheKey(
  width: number,
  height: number,
  pileTop: number,
  pileBottom: number,
  bgImage: WxImage | null | undefined,
): string {
  const iw = bgImage?.width ?? 0;
  const ih = bgImage?.height ?? 0;
  return `${width}x${height}:${pileTop}:${pileBottom}:${iw}x${ih}`;
}

export function clearMahjongPlaySceneBackgroundCache(): void {
  sceneBgCache = null;
}

/** 对局底图（无 sway 位移）离屏缓存，每帧只 translate 贴图。 */
export function drawMahjongPlaySceneBackgroundCached(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  pileTop: number,
  pileBottom: number,
  bgImage: WxImage | null | undefined,
  bgShift = { dx: 0, dy: 0 },
): void {
  const key = sceneBgCacheKey(width, height, pileTop, pileBottom, bgImage);
  if (!sceneBgCache || sceneBgCache.key !== key) {
    const canvas = createOffscreenCanvas(width, height);
    if (!canvas) {
      drawMahjongPlaySceneBackground(
        ctx,
        width,
        height,
        pileTop,
        pileBottom,
        bgImage,
        undefined,
        bgShift,
      );
      return;
    }
    const off = canvas.getContext('2d');
    if (!off) {
      drawMahjongPlaySceneBackground(
        ctx,
        width,
        height,
        pileTop,
        pileBottom,
        bgImage,
        undefined,
        bgShift,
      );
      return;
    }
    drawMahjongPlaySceneBackground(
      off,
      width,
      height,
      pileTop,
      pileBottom,
      bgImage,
      undefined,
      { dx: 0, dy: 0 },
    );
    sceneBgCache = { key, canvas };
  }

  ctx.save();
  ctx.translate(bgShift.dx, bgShift.dy);
  try {
    ctx.drawImage(sceneBgCache.canvas, 0, 0, width, height);
  } catch {
    drawMahjongPlaySceneBackground(
      ctx,
      width,
      height,
      pileTop,
      pileBottom,
      bgImage,
      undefined,
      bgShift,
    );
  }
  ctx.restore();
}

/**
 * 结算 / 弹窗全屏衬底：压暗棋盘格、粉/青暖色径向晕，突出居中卡片。
 */

export type ResultBackdropTone = 'pink' | 'teal';

export interface ResultBackdropOptions {
  /** 0~1，通常来自 LevelResultFx.veilAlpha 或固定 1 */
  veilAlpha: number;
  tone: ResultBackdropTone;
  isFail?: boolean;
}

export function drawResultSceneBackdrop(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  opts: ResultBackdropOptions,
): void {
  const { veilAlpha, tone, isFail = false } = opts;
  const strength = Math.min(1, veilAlpha * (isFail ? 1 : 0.96));
  const cx = width / 2;
  const focusY = height * 0.38;

  ctx.fillStyle = `rgba(18, 12, 28, ${0.58 + strength * 0.32})`;
  ctx.fillRect(0, 0, width, height);

  const radial = ctx.createRadialGradient(cx, focusY, width * 0.06, cx, focusY, width * 0.92);
  if (tone === 'pink') {
    radial.addColorStop(0, `rgba(255, 215, 235, ${0.28 * strength})`);
    radial.addColorStop(0.42, `rgba(100, 48, 88, ${0.4 * strength})`);
    radial.addColorStop(1, `rgba(8, 6, 18, ${0.72 * strength})`);
  } else {
    radial.addColorStop(0, `rgba(190, 240, 225, ${0.22 * strength})`);
    radial.addColorStop(0.48, `rgba(28, 72, 64, ${0.44 * strength})`);
    radial.addColorStop(1, `rgba(6, 14, 18, ${0.68 * strength})`);
  }
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);

  const edge = ctx.createLinearGradient(0, 0, 0, height);
  edge.addColorStop(0, `rgba(0,0,0,${0.14 * strength})`);
  edge.addColorStop(0.22, 'rgba(0,0,0,0)');
  edge.addColorStop(0.78, 'rgba(0,0,0,0)');
  edge.addColorStop(1, `rgba(0,0,0,${0.2 * strength})`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);
}

import { bindMainCanvas2d, readWxSystemInfo } from '../core/utils/wxHost';

/** 重逻辑初始化前占住上屏 Canvas，避免 Helium 白屏。 */
export function paintMiniGameStartupSplash(): void {
  try {
    if (typeof wx === 'undefined') {
      return;
    }
    const binding = bindMainCanvas2d();
    const canvas = binding.canvas;
    const ctx = binding.ctx;
    const info = readWxSystemInfo();
    const cssW = Math.max(1, info.windowWidth || info.screenWidth || 375);
    const cssH = Math.max(1, info.windowHeight || info.screenHeight || 667);
    const dpr = Math.max(1, info.pixelRatio || 1);
    if (canvas.width < cssW * dpr * 0.5) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#b6e8fc';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#1864ab';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('萌宠粉碎消 · 加载中…', cssW / 2, cssH * 0.48);
    binding.present?.();
  } catch (err) {
    console.warn('[crush-crush] startup splash failed', err);
  }
}

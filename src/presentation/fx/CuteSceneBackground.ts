/**
 * 场景动态背景：大厅只用一张首页底图；关卡条/装饰为上层镂空绘制。
 * 纯 Canvas 绘制，不依赖 Cocos。
 */

export interface SceneBgImages {
  lobby: WxImage | null;
  level: WxImage | null;
  /** 云层页资源仍加载；大厅滑动时底图保持不动 */
  lobbyCloudPages?: Array<WxImage | null>;
}

interface SparkleSpec {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

/**
 * 场景动态背景绘制器。
 */
export class CuteSceneBackground {
  private readonly sparkles: SparkleSpec[] = [];
  private width = 0;
  private height = 0;
  private lite = false;

  /** 开发者工具降低绘制量，避免模拟器看门狗。 */
  public setLite(lite: boolean): void {
    this.lite = lite;
  }

  /**
   * 按屏幕尺寸重建漂浮层（分辨率变化时调用）。
   */
  public layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.sparkles.length = 0;
    const count = this.lite ? 6 : 12;
    for (let i = 0; i < count; i += 1) {
      this.sparkles.push({
        x: ((i * 97) % width) + (i % 5) * 7,
        y: ((i * 53) % Math.floor(height * 0.62)) + 12,
        r: 1.0 + (i % 5) * 0.55,
        phase: i * 0.62,
        speed: 1.15 + (i % 6) * 0.28,
      });
    }
  }

  /**
   * 绘制完整动态背景。
   * @param mode - lobby | level（闯关）
   * @param lobbyPanY - 保留参数兼容调用方；大厅底图固定不随相机平移
   */
  public draw(
    ctx: WxCanvasRenderingContext2D,
    images: SceneBgImages,
    mode: 'lobby' | 'level',
    nowMs: number,
    _lobbyPanY = 0,
  ): void {
    const { width, height } = this;
    if (width <= 0 || height <= 0) {
      return;
    }

    const t = nowMs * 0.001;
    const img = mode === 'lobby' ? images.lobby : images.level;

    if (mode === 'lobby') {
      this.drawLobbyWorld(ctx, images, t);
      return;
    }

    if (img) {
      this.drawFallbackGradient(ctx, mode, width, height);
      try {
        this.drawCoverImage(ctx, img, width, height, 1, 0, 0, 0.92);
      } catch (err) {
        console.warn('[crush-crush] level bg draw failed', err);
      }
    } else {
      this.drawFallbackGradient(ctx, mode, width, height);
    }

    this.drawSparkles(ctx, t, 0.2);
  }

  /**
   * 大厅世界：先铺渐变底，再叠首页图。iOS 上 drawImage 失败时不至于整页黑屏。
   */
  private drawLobbyWorld(
    ctx: WxCanvasRenderingContext2D,
    images: SceneBgImages,
    t: number,
  ): void {
    const { width, height } = this;
    this.drawFallbackGradient(ctx, 'lobby', width, height);

    const img = images.lobby;
    const iw = img?.width || 0;
    const ih = img?.height || 0;
    if (img && iw > 0 && ih > 0) {
      try {
        const layout = this.getCoverLayout(img, 0.5);
        // 真机 iOS 对 9 参 drawImage 偶发黑图，用 5 参更稳
        ctx.drawImage(img, layout.dx, layout.dy, layout.dw, layout.dh);
      } catch (err) {
        console.warn('[crush-crush] lobby bg draw failed', err);
      }
    }

    this.drawSparkles(ctx, t, 0.16);
  }

  /**
   * cover 绘制矩形（与大厅静止底图一致），供热区换算。
   */
  public getCoverLayout(
    img: WxImage,
    vBias = 0.5,
  ): { dx: number; dy: number; dw: number; dh: number } {
    const { width, height } = this;
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

  private drawCoverImage(
    ctx: WxCanvasRenderingContext2D,
    img: WxImage,
    width: number,
    height: number,
    scale: number,
    panX: number,
    panY: number,
    vBias = 0.5,
  ): void {
    const iw = img.width || width;
    const ih = img.height || height;
    const cover = Math.max(width / iw, height / ih) * scale;
    const dw = iw * cover;
    const dh = ih * cover;
    const dx = (width - dw) * 0.5 + panX;
    const bias = Math.max(0, Math.min(1, vBias));
    const dy = (height - dh) * bias + panY;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  private drawFallbackGradient(
    ctx: WxCanvasRenderingContext2D,
    mode: 'lobby' | 'level',
    width: number,
    height: number,
  ): void {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    if (mode === 'level') {
      g.addColorStop(0, '#8fd6ff');
      g.addColorStop(0.45, '#c8f0ff');
      g.addColorStop(0.72, '#b8e89a');
      g.addColorStop(1, '#7bc96a');
    } else {
      g.addColorStop(0, '#a7f0d4');
      g.addColorStop(0.7, '#b6f0d8');
      g.addColorStop(1, '#ffe6f0');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  private drawSparkles(ctx: WxCanvasRenderingContext2D, t: number, strength: number): void {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (const s of this.sparkles) {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * s.speed + s.phase));
      ctx.globalAlpha = twinkle * strength;
      ctx.beginPath();
      ctx.arc(s.x, s.y + Math.sin(t * 0.6 + s.phase) * 4, s.r * twinkle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * 场景动态背景：大厅用首页底图；闯关用关卡底图 + 轻量漂浮层。
 * 纯 Canvas 绘制，不依赖 Cocos。
 */

import { lobbyPageOriginY } from '../ui/LobbyLevelMap';

export interface SceneBgImages {
  lobby: WxImage | null;
  level: WxImage | null;
  /** 云层页背景，全部为 6-10 关同款薄荷棉花糖世界 */
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
   * @param lobbyPanY - 大厅相机下移：树往下走，上方露出天空云层
   */
  public draw(
    ctx: WxCanvasRenderingContext2D,
    images: SceneBgImages,
    mode: 'lobby' | 'level',
    nowMs: number,
    lobbyPanY = 0,
  ): void {
    const { width, height } = this;
    if (width <= 0 || height <= 0) {
      return;
    }

    const t = nowMs * 0.001;
    const img = mode === 'lobby' ? images.lobby : images.level;

    if (mode === 'lobby') {
      this.drawLobbyWorld(ctx, images, t, lobbyPanY);
      return;
    }

    if (img) {
      this.drawCoverImage(ctx, img, width, height, 1, 0, 0, 0.92);
    } else {
      this.drawFallbackGradient(ctx, mode, width, height);
    }

    this.drawSparkles(ctx, t, 0.2);
  }

  /**
   * 大厅世界：第 1 屏树冠底图；上滑后整屏换上与树冠同质感的糖果云背景。
   */
  private drawLobbyWorld(
    ctx: WxCanvasRenderingContext2D,
    images: SceneBgImages,
    t: number,
    panY: number,
  ): void {
    const { width, height } = this;
    const img = images.lobby;
    const hasCloudArt = (images.lobbyCloudPages ?? []).some((page) => !!page);
    const treeOrigin = lobbyPageOriginY(0, panY, height);
    const open = Math.max(0, Math.min(1, treeOrigin / Math.max(24, height * 0.55)));

    let destY = 0;
    let destH = height;
    let layout: ReturnType<CuteSceneBackground['getCoverLayout']> | null = null;
    if (img && (img.width || 0) > 0) {
      layout = this.getCoverLayout(img, 0.5);
      destY = layout.dy + treeOrigin;
      destH = layout.dh;
    }

    if (!layout || destY > 1) {
      this.drawSkyGradient(ctx, width, height);
      if (!hasCloudArt) {
        this.drawAmbientSkyClouds(ctx, t, open);
      }
    }

    if (treeOrigin > 1 || panY > height * 0.5) {
      this.drawPagedCandyCloudBackdrops(ctx, images, panY);
    }

    if (layout && img && destY < height && destY + destH > 0) {
      ctx.drawImage(
        img,
        0,
        0,
        Math.max(1, img.width || width),
        Math.max(1, img.height || height),
        layout.dx - 4,
        destY - 6,
        layout.dw + 8,
        destH + 10,
      );
      this.coverLobbyBakedCornerIcons(ctx, layout, destY, destH, img);
    } else if (!layout && open < 0.2) {
      this.drawFallbackGradient(ctx, 'lobby', width, height);
    }

    this.coverLobbyTopSeam(ctx, width, destY - 6);
    this.drawSparkles(ctx, t, 0.22 + open * 0.1);
    if (open > 0.08) {
      this.drawCandyDust(ctx, t, 0.16 + open * 0.1);
    }
  }

  /** 云层翻页：后续关卡沿用 6-10 关薄荷棉花糖岛设计 */
  private drawPagedCandyCloudBackdrops(
    ctx: WxCanvasRenderingContext2D,
    images: SceneBgImages,
    panY: number,
  ): void {
    const { height } = this;
    if (height <= 0) {
      return;
    }
    const pages = (images.lobbyCloudPages ?? []).filter(
      (img): img is WxImage => !!img && (img.width || 0) > 0,
    );
    if (pages.length === 0) {
      return;
    }
    const first = Math.max(1, Math.floor(panY / Math.max(1, height)));
    const last = first + 1;
    for (let page = last; page >= first; page -= 1) {
      if (page < 1) {
        continue;
      }
      const img = pages[(page - 1) % pages.length]!;
      const layout = this.getCoverLayout(img, 0.48);
      const y = layout.dy + lobbyPageOriginY(page, panY, height);
      if (y + layout.dh < -8 || y > height + 8) {
        continue;
      }
      ctx.drawImage(
        img,
        0,
        0,
        img.width || layout.dw,
        img.height || layout.dh,
        layout.dx - 4,
        y - 6,
        layout.dw + 8,
        layout.dh + 10,
      );
    }
  }

  private drawSkyGradient(
    ctx: WxCanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#9ed4fb');
    g.addColorStop(0.18, '#b5e4fc');
    g.addColorStop(0.48, '#ffe3f2');
    g.addColorStop(0.78, '#fff0c8');
    g.addColorStop(1, '#e7fff6');
    ctx.fillStyle = g;
    ctx.fillRect(0, -4, width, height + 8);
  }

  /**
   * 树屏顶边与上一层天空相接时，抹掉 1px 硬边，不铺色带。
   */
  private coverLobbyTopSeam(
    ctx: WxCanvasRenderingContext2D,
    width: number,
    destY: number,
  ): void {
    const y0 = destY - 2;
    const capH = 8;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + capH);
    g.addColorStop(0, 'rgba(103, 200, 253, 0.22)');
    g.addColorStop(1, 'rgba(103, 200, 253, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, width, capH);
  }

  /**
   * 底图右上角烘焙了两枚装饰图标，实机上会和微信胶囊叠在一起。
   * 用与顶空一致的渐变盖住，不改 JPEG。
   */
  private coverLobbyBakedCornerIcons(
    ctx: WxCanvasRenderingContext2D,
    layout: { dx: number; dw: number },
    destY: number,
    destH: number,
    img: WxImage,
  ): void {
    const iw = Math.max(1, img.width || 576);
    const ih = Math.max(1, img.height || 1024);
    const dw = layout.dw + 8;
    const dh = destH + 10;
    const x = layout.dx - 4 + (484 / iw) * dw;
    const y = destY - 6 + (30 / ih) * dh;
    const h = ((198 - 30) / ih) * dh;
    const w = this.width - x + 6;
    if (w <= 0 || h <= 0) {
      return;
    }
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#9ed4fb');
    g.addColorStop(0.4, '#b6e8fc');
    g.addColorStop(1, '#c5eefd');
    ctx.fillStyle = g;
    ctx.fillRect(x + 14, y, Math.max(0, w - 14), h);
    const edge = ctx.createLinearGradient(x, y, x + 16, y);
    edge.addColorStop(0, 'rgba(182, 232, 252, 0)');
    edge.addColorStop(1, 'rgba(182, 232, 252, 1)');
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, 16, h);
  }


  private drawAmbientSkyClouds(
    ctx: WxCanvasRenderingContext2D,
    t: number,
    open: number,
  ): void {
    if (open <= 0.02) {
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.4 + open * 0.45;
    const candy = [
      { x: 0.12, y: 0.1, s: 1.35, tint: '#ffd0ea', dots: true },
      { x: 0.78, y: 0.08, s: 1.5, tint: '#ffe6a8', dots: true },
      { x: 0.48, y: 0.06, s: 1.05, tint: '#d9f5c8', dots: true },
      { x: 0.9, y: 0.22, s: 1.0, tint: '#e4d4ff', dots: true },
    ];
    for (let i = 0; i < candy.length; i += 1) {
      const c = candy[i]!;
      const bob = Math.sin(t * 0.7 + i) * 6;
      const drift = Math.sin(t * 0.15 + i * 0.8) * 8;
      this.drawCottonCandySwirl(
        ctx,
        this.width * c.x + drift,
        this.height * c.y + bob,
        c.s,
        c.tint,
        c.dots,
      );
    }
    ctx.restore();
  }

  /** 棉花糖旋涡：大厅树冠那种厚 spiral 糖霜 */
  private drawCottonCandySwirl(
    ctx: WxCanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    tint: string,
    candyDots: boolean,
  ): void {
    const r = 24 * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(120, 170, 200, 0.14)';
    this.ellipse(ctx, x, y + r * 0.5, r * 1.75, r * 0.4);

    ctx.fillStyle = tint;
    this.ellipse(ctx, x, y, r * 1.62, r * 1.22);
    const lobes = 4;
    for (let i = 0; i < lobes; i += 1) {
      const ang = i * 0.95 + 0.15;
      const spin = 0.55 + (i % 4) * 0.08;
      this.ellipse(
        ctx,
        x + Math.cos(ang) * r * spin,
        y + Math.sin(ang) * r * 0.38,
        r * (0.7 + (i % 3) * 0.1),
        r * 0.5,
      );
    }

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = this.shadeHex(tint, -28);
    this.ellipse(ctx, x - r * 0.18, y + r * 0.08, r * 0.85, r * 0.28);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    this.ellipse(ctx, x - r * 0.32, y - r * 0.4, r * 0.7, r * 0.32);

    if (candyDots) {
      const dots = ['#ff85c0', '#ffe066', '#74c0fc'];
      for (let i = 0; i < dots.length; i += 1) {
        const ang = (i / dots.length) * Math.PI * 2 + 0.4;
        ctx.fillStyle = dots[i]!;
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(ang) * r * 0.82,
          y + Math.sin(ang) * r * 0.3 + 3,
          2.4 + (i % 2),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private shadeHex(hex: string, delta: number): string {
    const raw = hex.replace('#', '');
    if (raw.length !== 6) {
      return hex;
    }
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    const r = clamp(parseInt(raw.slice(0, 2), 16) + delta);
    const g = clamp(parseInt(raw.slice(2, 4), 16) + delta);
    const b = clamp(parseInt(raw.slice(4, 6), 16) + delta);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
      .toString(16)
      .padStart(2, '0')}`;
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
      g.addColorStop(0, '#9ed4fb');
      g.addColorStop(0.45, '#b8e4ff');
      g.addColorStop(1, '#ffe6f0');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  private ellipse(
    ctx: WxCanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
  ): void {
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
    }
    ctx.fill();
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

  /** 彩色糖屑漂浮，增强欢乐氛围 */
  private drawCandyDust(
    ctx: WxCanvasRenderingContext2D,
    t: number,
    strength: number,
  ): void {
    const colors = ['#ff85c0', '#ffe066', '#74c0fc', '#8ce99a', '#ff922b'];
    ctx.save();
    const dust = 6;
    for (let i = 0; i < dust; i += 1) {
      const x = ((i * 137 + t * (10 + (i % 4) * 4)) % (this.width + 40)) - 20;
      const y =
        ((i * 89) % Math.floor(this.height * 0.7)) +
        Math.sin(t * 0.9 + i) * 8 +
        20;
      ctx.globalAlpha = (0.25 + 0.45 * Math.abs(Math.sin(t * 1.4 + i))) * strength;
      ctx.fillStyle = colors[i % colors.length]!;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

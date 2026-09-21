/**
 * 关卡结算庆祝 / 失败动画：
 * 遮罩淡入 → 面板弹性弹出 → 彩带/星光 → 分数砸地 → 按钮入场。
 * 粒子有上限，开场密、随后稀，避免结算页把主线程拖死。
 */

export interface ResultAnimLayout {
  /** 遮罩透明度 0~1 */
  veilAlpha: number;
  /** 标题面板缩放 */
  panelScale: number;
  /** 标题面板透明度 */
  panelAlpha: number;
  /** 标题额外弹跳缩放 */
  titleScale: number;
  /** 按钮入场进度 0~1（整体） */
  buttonProgress: number;
  /** 分数滚动显示值 */
  displayScore: number;
  /** 是否可点击按钮 */
  interactive: boolean;
  /** 胜利时标题光晕强度 */
  glow: number;
  /** 开场白闪 0~1 */
  flash: number;
  /** 分数砸地缩放脉冲 */
  scorePunch: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  kind: 'confetti' | 'star' | 'spark' | 'ribbon';
}

const WIN_COLORS = [
  '#ff6b6b',
  '#4dabf7',
  '#51cf66',
  '#ffd43b',
  '#b197fc',
  '#ff85c0',
  '#ffffff',
  '#ff922b',
];
const FAIL_COLORS = ['#ffc9c9', '#ffd8a8', '#e9ecef', '#ffc078', '#adb5bd'];

/**
 * 结算页动效控制器。
 */
export class LevelResultFx {
  private active = false;
  private won = true;
  private startMs = 0;
  private width = 0;
  private height = 0;
  private targetScore = 0;
  private particles: Particle[] = [];
  private burstAt = 0;
  private lite = false;
  private maxParticles = 56;

  /** 模拟器 / 低端机减少粒子，动效仍连续。 */
  public setLite(lite: boolean): void {
    this.lite = lite;
    this.maxParticles = lite ? 32 : 56;
    if (this.particles.length > this.maxParticles) {
      this.particles.length = this.maxParticles;
    }
  }

  /**
   * 开始播放结算动画。
   */
  public start(
    won: boolean,
    nowMs: number,
    width: number,
    height: number,
    score: number,
  ): void {
    this.active = true;
    this.won = won;
    this.startMs = nowMs;
    this.width = width;
    this.height = height;
    this.targetScore = score;
    this.particles = [];
    this.burstAt = nowMs;
    this.spawnBurst(won ? (this.lite ? 28 : 42) : this.lite ? 12 : 18);
    if (won) {
      this.spawnSideCannons(this.lite ? 8 : 12);
    }
  }

  public stop(): void {
    this.active = false;
    this.particles = [];
  }

  public isActive(): boolean {
    return this.active;
  }

  /** 测试 / 调试：当前粒子数。 */
  public particleCount(): number {
    return this.particles.length;
  }

  /**
   * 推进粒子；每帧调用。
   */
  public update(nowMs: number): void {
    if (!this.active) {
      return;
    }
    const dt = 1 / 60;
    const elapsed = nowMs - this.startMs;
    const gap = elapsed < 1600 ? 240 : 520;
    if (this.won && nowMs - this.burstAt > gap) {
      this.burstAt = nowMs;
      this.spawnFalling(elapsed < 1600 ? (this.lite ? 5 : 8) : this.lite ? 2 : 4);
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i]!;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += (p.kind === 'confetti' || p.kind === 'ribbon' ? 0.22 : 0.06) * 60 * dt;
      p.rot += p.vr * dt * 60;
      p.life += dt * 1000;
      if (p.life >= p.maxLife || p.y > this.height + 40) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * 当前布局插值状态。
   */
  public getLayout(nowMs: number): ResultAnimLayout {
    if (!this.active) {
      return {
        veilAlpha: 0.45,
        panelScale: 1,
        panelAlpha: 1,
        titleScale: 1,
        buttonProgress: 1,
        displayScore: this.targetScore,
        interactive: true,
        glow: this.won ? 0.5 : 0,
        flash: 0,
        scorePunch: 1,
      };
    }

    const t = Math.max(0, nowMs - this.startMs);
    const veilAlpha = 0.52 * easeOutCubic(clamp01(t / 260));
    const panelT = clamp01((t - 60) / 460);
    const panelScale = this.won
      ? elasticOut(panelT) * 0.42 + 0.58 * easeOutBack(panelT)
      : 0.7 + 0.3 * easeOutCubic(panelT);
    const panelAlpha = easeOutCubic(clamp01((t - 30) / 240));
    const titleScale =
      1 + (this.won ? Math.sin(Math.min(1, (t - 140) / 420) * Math.PI) * 0.16 : 0);
    const buttonProgress = easeOutCubic(clamp01((t - 420) / 400));
    const scoreT = clamp01((t - 160) / 780);
    const displayScore = Math.round(this.targetScore * easeOutCubic(scoreT));
    const glow = this.won
      ? 0.4 + 0.4 * Math.abs(Math.sin((nowMs - this.startMs) * 0.007))
      : 0;
    const flash = this.won ? Math.max(0, 1 - t / 220) * 0.55 : 0;
    const scorePunch =
      this.won && scoreT > 0.85 && scoreT < 1
        ? 1 + 0.12 * Math.sin(((scoreT - 0.85) / 0.15) * Math.PI)
        : 1;

    return {
      veilAlpha,
      panelScale: Math.max(0.01, panelScale),
      panelAlpha,
      titleScale: Math.max(0.01, titleScale),
      buttonProgress,
      displayScore,
      interactive: buttonProgress > 0.85,
      glow,
      flash,
      scorePunch,
    };
  }

  /**
   * 绘制彩带 / 星光粒子（在 UI 之上或之下由调用方决定）。
   */
  public drawParticles(ctx: WxCanvasRenderingContext2D, nowMs: number): void {
    if (!this.active) {
      return;
    }
    void nowMs;
    for (const p of this.particles) {
      const lifeRatio = 1 - p.life / p.maxLife;
      const alpha = Math.max(0, Math.min(1, lifeRatio * 1.35));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * 0.35);

      if (p.kind === 'star') {
        this.drawStar(ctx, 0, 0, p.size, p.color);
      } else if (p.kind === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ribbon') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.2, -p.size * 1.4, p.size * 0.4, p.size * 2.8);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.4, -p.size, p.size * 0.8, p.size * 2);
      }
      ctx.restore();
    }
  }

  private spawnBurst(count: number): void {
    const cx = this.width * 0.5;
    const cy = this.height * 0.34;
    const colors = this.won ? WIN_COLORS : FAIL_COLORS;
    const n = this.roomFor(count);
    for (let i = 0; i < n; i += 1) {
      const ang = (Math.PI * 2 * i) / n + (i % 3) * 0.18;
      const speed = this.won ? 4.2 + (i % 6) * 1.35 : 1.2 + (i % 3) * 0.6;
      const kindRoll = i % 7;
      const kind: Particle['kind'] = this.won
        ? kindRoll === 0
          ? 'star'
          : kindRoll === 1 || kindRoll === 2
            ? 'spark'
            : kindRoll === 3
              ? 'ribbon'
              : 'confetti'
        : 'spark';
      this.particles.push({
        x: cx + (i % 5 - 2) * 6,
        y: cy,
        vx: Math.cos(ang) * speed * (0.7 + (i % 4) * 0.18),
        vy: Math.sin(ang) * speed * 0.5 - (this.won ? 3.2 : 0.5),
        rot: i * 0.45,
        vr: (i % 2 === 0 ? 1 : -1) * (0.1 + (i % 5) * 0.04),
        size: this.won ? 6 + (i % 5) * 2.2 : 4,
        color: colors[i % colors.length]!,
        life: 0,
        maxLife: this.won ? 1600 + (i % 7) * 200 : 900,
        kind,
      });
    }
  }

  /** 左右礼炮，增强过关爆发感 */
  private spawnSideCannons(count: number): void {
    for (let side = 0; side < 2; side += 1) {
      const baseX = side === 0 ? this.width * 0.08 : this.width * 0.92;
      const baseY = this.height * 0.62;
      const n = this.roomFor(count);
      for (let i = 0; i < n; i += 1) {
        const dir = side === 0 ? 1 : -1;
        const ang = -0.9 + (i / Math.max(1, n)) * 1.2;
        const speed = 3.5 + (i % 4) * 1.1;
        this.particles.push({
          x: baseX,
          y: baseY,
          vx: Math.cos(ang) * speed * dir,
          vy: Math.sin(ang) * speed - 2.2,
          rot: i,
          vr: dir * 0.14,
          size: 5 + (i % 4) * 2,
          color: WIN_COLORS[i % WIN_COLORS.length]!,
          life: 0,
          maxLife: 1400 + i * 40,
          kind: i % 3 === 0 ? 'star' : i % 2 === 0 ? 'ribbon' : 'confetti',
        });
      }
    }
  }

  private spawnFalling(count: number): void {
    const n = this.roomFor(count);
    for (let i = 0; i < n; i += 1) {
      this.particles.push({
        x: (i * 97 + this.particles.length * 13) % this.width,
        y: -20 - (i % 4) * 12,
        vx: -0.8 + (i % 5) * 0.35,
        vy: 1.8 + (i % 4) * 0.55,
        rot: i,
        vr: (i % 2 === 0 ? 1 : -1) * 0.12,
        size: 5 + (i % 3) * 2,
        color: WIN_COLORS[i % WIN_COLORS.length]!,
        life: 0,
        maxLife: 2400,
        kind: i % 4 === 0 ? 'star' : i % 3 === 0 ? 'ribbon' : 'confetti',
      });
    }
  }

  private roomFor(count: number): number {
    return Math.max(0, Math.min(count, this.maxParticles - this.particles.length));
  }

  private drawStar(
    ctx: WxCanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      const a2 = a + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function elasticOut(t: number): number {
  if (t === 0 || t === 1) {
    return t;
  }
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

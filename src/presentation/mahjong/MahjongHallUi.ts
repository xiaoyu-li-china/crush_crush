import {
  formatMahjongGlobalCoinAmount,
  formatMahjongGlobalCoinCostLabel,
  mahjongLobbyLevelRange,
  isMahjongCoinPaymentsEnabled,
  MAHJONG_REPLAY_COIN_COST,
  MAHJONG_SLOT_FULL_AD_MOVE_COUNT,
  MAHJONG_TOOL_LABELS,
  type MahjongToolId,
} from '../../logic/mahjong/MahjongConfig';
import type { MahjongGame } from '../../logic/mahjong/MahjongGame';
import type { MahjongHallProgressData } from '../../logic/mahjong/MahjongProgress';
import { pilePosesToHitsCached, type MahjongTileHit } from './MahjongPileLayout';
import {
  mahjongPlayBackHomeFrame,
  mahjongPlayHeaderLeftReserve,
  mahjongPlayMetrics,
  mahjongSlotTileRect,
  mahjongToolButtonLayout,
} from './MahjongPlayLayoutMetrics';
import { drawStandingMahjongTile } from './MahjongTileRender';
import {
  drawMahjongCelebrateHeroImage,
  drawMahjongCenterText,
  drawMahjongCuteCard,
  drawMahjongModalFooterBand,
  drawMahjongModalCardFace,
  drawMahjongModalFooterReadableBand,
  drawMahjongModalVeil,
  drawMahjongPanelCloseOrb,
  drawMahjongPrimaryCapsuleButton,
  drawMahjongToolCountBadge,
  drawMahjongToolNameLabel,
  layoutMahjongModalCard,
} from './MahjongCutePanel';
import { MJ_PALETTE as P } from './MahjongPlayPalette';
import {
  applyMahjongPileSwayToHits,
  applyMahjongTileJitterToHits,
  mahjongPileSwayBackgroundShift,
  type MahjongPileSway,
  type MahjongTileJitter,
} from './MahjongPileSway';
import {
  mahjongSlotsForDisplay,
  sampleMahjongFlyAnim,
  type MahjongSlotFlight,
} from './MahjongTileFlyAnim';
import type { MahjongToolIconLookup } from './MahjongToolIcons';
import { drawMahjongPlaySceneBackgroundCached } from './MahjongPlaySceneBgCache';
import { mahjongResultRevealFrame } from './MahjongStageFx';

export type { MahjongTileHit, MahjongTilePose } from './MahjongPileLayout';

export interface MahjongUiButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  levelId?: number;
}

const TILE_COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffd43b', '#cc5de8', '#ff922b', '#20c997', '#868e96'];

export function mahjongTileColor(type: number): string {
  return TILE_COLORS[type % TILE_COLORS.length] ?? '#adb5bd';
}

export type MahjongTileImageLookup = (typeIndex: number) => WxImage | undefined;

export interface MahjongPlayChrome {
  themeName?: string;
  background?: string;
  /** 对局底图（默认大厅 lobby.jpg，无青绿朦层） */
  playBgImage?: WxImage | null;
  tileImage?: MahjongTileImageLookup;
  toolIcon?: MahjongToolIconLookup;
  /** 「牌槽已满」弹窗底图 */
  slotFullModalBg?: WxImage | null;
  /** 道具说明/获取弹窗底图（默认同槽满底图） */
  toolOfferModalBg?: WxImage | null;
  /** 胜利后自动下一关剩余毫秒；≤0 不展示 */
  autoNextMs?: number;
  pileSway?: MahjongPileSway;
  tileJitters?: readonly MahjongTileJitter[];
  /** 牌面位图缓存主题键（换主题时需更新） */
  tileRasterThemeKey?: string;
}

function formatTime(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pushBtn(buttons: MahjongUiButton[], btn: MahjongUiButton): void {
  buttons.push(btn);
}

function drawMahjongPlayBackground(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  pileTop: number,
  pileBottom: number,
  chrome: Pick<MahjongPlayChrome, 'background' | 'playBgImage'>,
  pileSway?: MahjongPileSway,
): void {
  const bgShift = pileSway ? mahjongPileSwayBackgroundShift(pileSway) : { dx: 0, dy: 0 };
  drawMahjongPlaySceneBackgroundCached(
    ctx,
    width,
    height,
    pileTop,
    pileBottom,
    chrome.playBgImage,
    bgShift,
  );
  if (chrome.background && !chrome.playBgImage) {
    ctx.save();
    ctx.translate(bgShift.dx, bgShift.dy);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = chrome.background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

/** 青绿玻璃条：外投影 + 渐变槽 + 顶高光（麻将馆 HUD / 槽位共用）。 */
function drawMahjongGlassBar3D(
  ctx: WxCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = P.tileShadow;
  roundRect(ctx, x + 1.5, y + 4, w, h, r);
  ctx.fill();
  ctx.globalAlpha = 1;

  const body = ctx.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, 'rgba(255,255,255,0.38)');
  body.addColorStop(0.42, P.glass);
  body.addColorStop(1, P.glassDeep);
  ctx.fillStyle = body;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.55;
  const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.55);
  gloss.addColorStop(0, 'rgba(255,255,255,0.72)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  roundRect(ctx, x + 3, y + 2, w - 6, h * 0.42, Math.max(4, r - 4));
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = P.glassStroke;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 3));
  ctx.stroke();
  ctx.restore();
}

function drawMahjongPlayHeader(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  game: MahjongGame,
  ladderCoins: number,
  mahjongRunCoins: number,
  safeTop: number,
  nowMs = 0,
): void {
  const leftReserve = mahjongPlayHeaderLeftReserve();
  const rightReserve = Math.max(118, width * 0.3);
  const bx = leftReserve;
  const bannerW = Math.max(160, width - leftReserve - rightReserve);
  const by = safeTop + 4;
  const barH = 32;
  drawMahjongGlassBar3D(ctx, bx, by, bannerW, barH, 12);

  const midY = by + barH / 2;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px sans-serif';
  const levelLabel = `关卡 ${game.level}`;
  const levelX = bx + 12;
  ctx.strokeStyle = 'rgba(8, 48, 44, 0.35)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeText(levelLabel, levelX, midY);
  ctx.fillStyle = P.textPrimary;
  ctx.fillText(levelLabel, levelX, midY);
  const levelW = ctx.measureText(levelLabel).width;
  ctx.font = 'bold 13px sans-serif';
  const timerLabel = `⏱ ${formatTime(game.remainingMs)}`;
  const timerX = levelX + levelW + 10;
  const urgent = game.remainingMs > 0 && game.remainingMs <= 45_000;
  if (urgent) {
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(nowMs * 0.012));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(255, 107, 107, 0.28)';
    ctx.fillRect(timerX - 4, midY - 12, ctx.measureText(timerLabel).width + 8, 24);
    ctx.restore();
  }
  ctx.fillStyle = urgent ? '#c92a2a' : P.textPrimary;
  ctx.strokeText(timerLabel, timerX, midY);
  ctx.fillText(timerLabel, timerX, midY);
  ctx.textAlign = 'right';
  ctx.font = 'bold 11px sans-serif';
  const coinLine = `梯子${formatMahjongGlobalCoinAmount(ladderCoins)} 本局${formatMahjongGlobalCoinAmount(mahjongRunCoins)}`;
  ctx.strokeText(coinLine, bx + bannerW - 8, midY);
  ctx.fillStyle = P.textSoft;
  ctx.fillText(coinLine, bx + bannerW - 8, midY);
  ctx.restore();
}

function drawMahjongSlotBar(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  slotY: number,
  slotW: number,
  slotH: number,
  pad: number,
  slotCount = 0,
  maxSlots = 6,
  nowMs = 0,
): void {
  const barPad = 6;
  const barH = slotH + barPad * 2;
  const barY = slotY - barPad;
  const barX = pad - 4;
  const barW = width - pad * 2 + 8;
  drawMahjongGlassBar3D(ctx, barX, barY, barW, barH, 16);

  const tight = maxSlots > 0 && slotCount >= Math.max(1, maxSlots - 1);
  if (tight) {
    const pulse = 0.35 + 0.35 * Math.abs(Math.sin(nowMs * 0.009));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = slotCount >= maxSlots ? '#ff6b6b' : '#ff922b';
    ctx.lineWidth = 3;
    roundRect(ctx, barX + 1, barY + 1, barW - 2, barH - 2, 15);
    ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < 7; i += 1) {
    const x = pad + i * (slotW + 5);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000000';
    roundRect(ctx, x + 1, slotY + 3, slotW, slotH, 8);
    ctx.fill();
    ctx.globalAlpha = 1;

    const well = ctx.createLinearGradient(x, slotY, x, slotY + slotH);
    well.addColorStop(0, 'rgba(18, 72, 68, 0.55)');
    well.addColorStop(0.5, P.slotWell);
    well.addColorStop(1, 'rgba(12, 48, 46, 0.62)');
    ctx.fillStyle = well;
    roundRect(ctx, x, slotY, slotW, slotH, 8);
    ctx.fill();
    const wellShine = ctx.createLinearGradient(x, slotY, x, slotY + slotH);
    wellShine.addColorStop(0, 'rgba(255,255,255,0.48)');
    wellShine.addColorStop(0.55, 'rgba(255,255,255,0.1)');
    wellShine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wellShine;
    roundRect(ctx, x + 1, slotY + 1, slotW - 2, slotH * 0.48, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x + 0.5, slotY + 0.5, slotW - 1, slotH - 1, 7.5);
    ctx.stroke();
    ctx.restore();
  }
}

export function layoutMahjongLobby(
  width: number,
  height: number,
  progress: MahjongHallProgressData,
  scrollY: number,
  buttons: MahjongUiButton[],
): void {
  const pad = 16;
  pushBtn(buttons, {
    id: 'mahjong_back_home',
    x: pad,
    y: pad + 8,
    w: 72,
    h: 36,
    label: '返回',
  });
  const listTop = 120 - scrollY;
  const { start, end } = mahjongLobbyLevelRange(progress.highestUnlocked);
  for (let lv = start; lv <= end; lv += 1) {
    const row = lv - 1;
    const y = listTop + row * 56;
    if (y > height || y < 80) {
      continue;
    }
    const unlocked = lv <= progress.highestUnlocked;
    const stars = progress.starsByLevel[String(lv)] ?? 0;
    pushBtn(buttons, {
      id: unlocked ? 'mahjong_start' : 'mahjong_locked',
      x: pad,
      y,
      w: width - pad * 2,
      h: 48,
      label: unlocked ? `第 ${lv} 关 · ★${stars}` : `第 ${lv} 关 · 锁定`,
      levelId: lv,
    });
  }
  if (progress.savedRun) {
    pushBtn(buttons, {
      id: 'mahjong_resume',
      x: pad,
      y: height - 100,
      w: width - pad * 2,
      h: 44,
      label: `继续第 ${progress.savedRun.level} 关`,
      levelId: progress.savedRun.level,
    });
  }
}

export function drawMahjongLobby(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  progress: MahjongHallProgressData,
  scrollY: number,
  buttons: MahjongUiButton[],
): void {
  buttons.length = 0;
  ctx.fillStyle = '#d3f9d8';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#2b8a3e';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('萌宠麻将馆', width / 2, 52);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#495057';
  ctx.fillText(`金币 ${formatMahjongGlobalCoinAmount(progress.coins)}`, width / 2, 78);

  layoutMahjongLobby(width, height, progress, scrollY, buttons);
  for (const btn of buttons) {
    const locked = btn.id === 'mahjong_locked';
    ctx.fillStyle = locked ? '#ced4da' : btn.id === 'mahjong_resume' ? '#ffd43b' : '#ffffff';
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#2b8a3e';
    ctx.lineWidth = 2;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
    ctx.stroke();
    ctx.fillStyle = locked ? '#868e96' : '#212529';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(btn.label, btn.x + 14, btn.y + btn.h / 2 + 6);
    if (btn.id === 'mahjong_start' || btn.id === 'mahjong_resume') {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#2b8a3e';
      ctx.fillText('开始挑战 ›', btn.x + btn.w - 14, btn.y + btn.h / 2 + 6);
    }
  }
  ctx.textAlign = 'left';
}

export function layoutMahjongPlay(
  width: number,
  height: number,
  game: MahjongGame,
  tileHits: MahjongTileHit[],
  buttons: MahjongUiButton[],
): number {
  tileHits.length = 0;
  const m = mahjongPlayMetrics(width, height);
  const backHome = mahjongPlayBackHomeFrame(m.safeTop);
  pushBtn(buttons, {
    id: 'mahjong_back_lobby',
    x: backHome.x,
    y: backHome.y,
    w: backHome.w,
    h: backHome.h,
    label: '回首页',
  });

  const pileLayout = pilePosesToHitsCached(
    game.pilePoses,
    width,
    height,
    game.pileLayoutEpoch,
  );
  for (const hit of pileLayout.hits) {
    tileHits.push(hit);
  }
  const pileZMax = pileLayout.zMax;

  for (let i = 0; i < 7; i += 1) {
    const x = m.pad + i * (m.slotW + 5);
    const locked = i === 6 && !game.adSlotUnlocked;
    if (locked) {
      pushBtn(buttons, {
        id: 'mahjong_ad_slot',
        x: x - 4,
        y: m.slotY - 6,
        w: m.slotW + 8,
        h: m.slotH + 12,
        label: '解锁',
      });
    }
  }

  for (const slot of mahjongToolButtonLayout(width, height)) {
    pushBtn(buttons, {
      id: `mahjong_tool_${slot.tool}`,
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
      label: MAHJONG_TOOL_LABELS[slot.tool],
    });
  }
  return pileZMax;
}

export function drawMahjongPlay(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  game: MahjongGame,
  ladderCoins: number,
  tileHits: MahjongTileHit[],
  buttons: MahjongUiButton[],
  chrome: MahjongPlayChrome = {},
  slotFlight?: MahjongSlotFlight,
  nowMs = 0,
): void {
  buttons.length = 0;
  tileHits.length = 0;
  const m = mahjongPlayMetrics(width, height);

  drawMahjongPlayBackground(
    ctx,
    width,
    height,
    m.pileTop,
    m.pileBottom,
    chrome,
    chrome.pileSway,
  );
  drawMahjongPlayHeader(ctx, width, game, ladderCoins, game.coinsThisRun, m.safeTop, nowMs);

  const pileZMax = layoutMahjongPlay(width, height, game, tileHits, buttons);
  const tileDrawOptsBase = {
    mahjongLevel: game.level,
    rasterThemeKey: chrome.tileRasterThemeKey,
  };

  if (chrome.pileSway) {
    applyMahjongPileSwayToHits(tileHits, game.pilePoses, pileZMax, chrome.pileSway);
  }
  if (chrome.tileJitters && chrome.tileJitters.length > 0) {
    applyMahjongTileJitterToHits(tileHits, chrome.tileJitters);
  }

  for (const hit of tileHits) {
    const type = game.pile[hit.index]!;
    const z = game.pilePoses[hit.index]?.z ?? hit.index;
    const layerDepth = z / pileZMax;
    const pose = game.pilePoses[hit.index];
    drawStandingMahjongTile(ctx, hit.x, hit.y, hit.w, hit.h, hit.rot, type, chrome.tileImage, {
      ...tileDrawOptsBase,
      layerDepth,
      faceDown: game.pileFaceDown[hit.index] === true,
      stand: pose?.stand,
    });
  }

  const shownSlots = slotFlight
    ? mahjongSlotsForDisplay(game.slots, slotFlight, nowMs, (slots, tile) =>
        game.slotsAfterAppend(slots, tile),
      )
    : game.slots;

  drawMahjongSlotBar(
    ctx,
    width,
    m.slotY,
    m.slotW,
    m.slotH,
    m.pad,
    shownSlots.length,
    game.maxSlots(),
    nowMs,
  );

  for (let i = 0; i < 7; i += 1) {
    const locked = i === 6 && !game.adSlotUnlocked;
    if (locked) {
      const x = m.pad + i * (m.slotW + 5);
      ctx.fillStyle = 'rgba(232, 176, 112, 0.55)';
      roundRect(ctx, x, m.slotY, m.slotW, m.slotH, 8);
      ctx.fill();
      ctx.strokeStyle = P.glassStroke;
      ctx.lineWidth = 1;
      roundRect(ctx, x, m.slotY, m.slotW, m.slotH, 8);
      ctx.stroke();
      ctx.fillStyle = P.textPrimary;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('解锁', x + m.slotW / 2, m.slotY + m.slotH * 0.62);
    }
  }

  shownSlots.forEach((type, idx) => {
    if (idx >= game.maxSlots()) {
      return;
    }
    const sr = mahjongSlotTileRect(width, height, idx);
    drawStandingMahjongTile(ctx, sr.x, sr.y, sr.w, sr.h, 0, type, chrome.tileImage, {
      layerDepth: 1,
      mahjongLevel: game.level,
      rasterThemeKey: chrome.tileRasterThemeKey,
    });
  });

  for (const anim of slotFlight?.anims ?? []) {
    const s = sampleMahjongFlyAnim(anim, nowMs);
    if (s.done) {
      continue;
    }
    drawStandingMahjongTile(ctx, s.x, s.y, s.w, s.h, s.rot, anim.type, chrome.tileImage, {
      layerDepth: 1,
      mahjongLevel: game.level,
      rasterThemeKey: chrome.tileRasterThemeKey,
      rasterFaceW: anim.fromW,
    });
  }

  if (game.level === 1 && !game.guideShown) {
    const gy = m.headerBottom - 4;
    const gw = width - m.pad * 2;
    drawMahjongGlassBar3D(ctx, m.pad, gy, gw, 26, 10);
    ctx.fillStyle = P.textPrimary;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(8, 48, 44, 0.32)';
    ctx.lineWidth = 2.5;
    const tip = '点击麻将放入槽位，3 个相同自动消除';
    ctx.strokeText(tip, width / 2, gy + 13);
    ctx.fillText(tip, width / 2, gy + 13);
  }

  for (const btn of buttons) {
    if (btn.id.startsWith('mahjong_tool_')) {
      const tool = btn.id.replace('mahjong_tool_', '') as MahjongToolId;
      const cx = btn.x + btn.w / 2;
      const cy = btn.y + btn.h / 2;
      const icon = chrome.toolIcon?.(tool);
      let drewIcon = false;
      if (icon) {
        try {
          ctx.drawImage(icon, btn.x, btn.y, btn.w, btn.h);
          drewIcon = true;
        } catch {
          drewIcon = false;
        }
      }
      if (!drewIcon) {
        const toolGrad = ctx.createRadialGradient(cx, cy - 4, 2, cx, cy, btn.w / 2);
        toolGrad.addColorStop(0, P.glass);
        toolGrad.addColorStop(1, P.glassDeep);
        ctx.fillStyle = toolGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, btn.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = P.glassStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      drawMahjongToolNameLabel(ctx, btn.label, cx, btn.y + btn.h + 8);
      drawMahjongToolCountBadge(ctx, game.tools[tool], btn.x + btn.w - 2, btn.y + 8);
    } else if (btn.id === 'mahjong_back_lobby') {
      drawMahjongPrimaryCapsuleButton(
        ctx,
        btn.x,
        btn.y,
        btn.w,
        btn.h,
        btn.label,
        '#a5d8ff',
        '#339af0',
        '#ffffff',
        12,
      );
    }
  }
  ctx.textAlign = 'left';
}

function mahjongSlotFullPreviewTypes(game: MahjongGame): number[] {
  const n = Math.min(MAHJONG_SLOT_FULL_AD_MOVE_COUNT, game.slots.length);
  if (n <= 0) {
    return [0, 1, 2];
  }
  return game.slots.slice(-n);
}

function drawMahjongSlotFullReviveOffer(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  game: MahjongGame,
  chrome: MahjongPlayChrome,
  buttons: MahjongUiButton[],
  nowMs: number,
): void {
  drawMahjongModalVeil(ctx, width, height, 0.46);

  const cardW = Math.min(width * 0.86, 328);
  const footerH = 112;
  const cardH = Math.min(Math.max(340, height * 0.44), height - 96);
  const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);

  const panelR = 22;
  drawMahjongModalCardFace(ctx, card.x, card.y, card.w, card.h, panelR, chrome, nowMs);
  if (chrome.playBgImage) {
    drawMahjongModalFooterReadableBand(ctx, card.x, card.y, card.w, card.h, footerH);
  }
  drawMahjongCenterText(
    ctx,
    '牌槽已满',
    card.cx,
    card.y + 36,
    'bold 18px sans-serif',
    '#1e5c56',
  );

  const closeX = card.x + card.w - 34;
  const closeY = card.y + 22;
  pushBtn(buttons, {
    id: 'mahjong_slot_full_close',
    x: closeX - 18,
    y: closeY - 18,
    w: 36,
    h: 36,
    label: '×',
  });
  drawMahjongPanelCloseOrb(ctx, closeX, closeY, 18);

  const previewTypes = mahjongSlotFullPreviewTypes(game);
  const tileW = Math.min(58, card.w * 0.19);
  const tileH = tileW * 1.18;
  const gap = tileW * 0.22;
  const tilesW = previewTypes.length * tileW + (previewTypes.length - 1) * gap;
  const tilesY = card.y + card.heroH * 0.54;
  const subtitleY = card.y + 62;

  drawMahjongCenterText(ctx, '移出3张花牌', card.cx, subtitleY, '15px sans-serif', '#2f6f66');

  let tx = card.cx - tilesW / 2;
  for (const type of previewTypes) {
    ctx.save();
    ctx.fillStyle = P.slotWell;
    roundRect(ctx, tx - 3, tilesY - 3, tileW + 6, tileH + 8, 10);
    ctx.fill();
    ctx.restore();
    drawStandingMahjongTile(ctx, tx, tilesY, tileW, tileH, 0, type, chrome.tileImage, {
      layerDepth: 1,
      mahjongLevel: game.level,
    });
    tx += tileW + gap;
  }

  const adPad = 24;
  const adBtnH = 48;
  const adBtnY = card.y + card.h - footerH + 26;
  const adBtnW = card.w - adPad * 2;
  pushBtn(buttons, {
    id: 'mahjong_slot_full_ad',
    x: card.x + adPad,
    y: adBtnY,
    w: adBtnW,
    h: adBtnH,
    label: '移出继续',
  });
  drawMahjongPrimaryCapsuleButton(ctx, card.x + adPad, adBtnY, adBtnW, adBtnH, '▶  移出继续');
}

/** 道具数量为 0 时：说明 + 看广告 / 金币兑换（参考羊了个羊道具弹窗） */
export function drawMahjongToolOfferModal(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  tool: MahjongToolId,
  buttons: MahjongUiButton[],
  chrome: MahjongPlayChrome,
  coinCost: number,
): void {
  drawMahjongModalVeil(ctx, width, height, 0.48);

  const cardW = Math.min(width * 0.88, 340);
  const pad = 28;
  const btnH = 46;
  const btnGap = 8;
  const contentTop = 24;
  const iconSize = Math.min(88, cardW * 0.26);
  const coinPay = isMahjongCoinPaymentsEnabled();
  const btnBlockH = coinPay ? btnH * 2 + btnGap : btnH;
  const cardH = Math.min(
    Math.max(contentTop + iconSize + 16 + 22 + btnBlockH + 22, coinPay ? 248 : 220),
    height - 88,
  );
  const footerH = btnBlockH + 22;
  const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);
  const panelR = 22;
  drawMahjongModalCardFace(ctx, card.x, card.y, card.w, card.h, panelR, chrome, 0);
  if (chrome.playBgImage) {
    drawMahjongModalFooterReadableBand(ctx, card.x, card.y, card.w, card.h, footerH);
  }
  const closeX = card.x + card.w - 34;
  const closeY = card.y + 22;
  pushBtn(buttons, {
    id: 'mahjong_tool_modal_close',
    x: closeX - 18,
    y: closeY - 18,
    w: 36,
    h: 36,
    label: '×',
  });
  drawMahjongPanelCloseOrb(ctx, closeX, closeY, 18);

  const iconX = card.cx - iconSize / 2;
  const iconY = card.y + contentTop;
  const toolImg = chrome.toolIcon?.(tool);
  if (toolImg) {
    try {
      ctx.drawImage(toolImg, iconX, iconY, iconSize, iconSize);
    } catch {
      // fallback below
    }
  }
  const toolName = MAHJONG_TOOL_LABELS[tool];
  if (toolImg) {
    const nameY = iconY + iconSize + 14;
    drawMahjongCenterText(
      ctx,
      toolName,
      card.cx,
      nameY,
      'bold 18px sans-serif',
      '#1e5c56',
    );
  } else {
    drawMahjongCenterText(
      ctx,
      toolName,
      card.cx,
      iconY + iconSize / 2,
      'bold 20px sans-serif',
      '#1e5c56',
    );
  }

  const labelBottomY = toolImg ? iconY + iconSize + 14 : iconY + iconSize;

  const btnW = card.w - pad * 2;
  const adY = labelBottomY + (toolImg ? 18 : 14);
  const coinY = adY + btnH + btnGap;
  pushBtn(buttons, {
    id: 'mahjong_tool_modal_ad',
    x: card.x + pad,
    y: adY,
    w: btnW,
    h: btnH,
    label: '免费获得',
  });
  drawMahjongPrimaryCapsuleButton(
    ctx,
    card.x + pad,
    adY,
    btnW,
    btnH,
    '▶  看广告获得',
    '#ffe066',
    '#fab005',
    '#5c3d00',
  );
  if (coinPay) {
    pushBtn(buttons, {
      id: 'mahjong_tool_modal_coin',
      x: card.x + pad,
      y: coinY,
      w: btnW,
      h: btnH,
      label: '金币兑换',
    });
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad,
      coinY,
      btnW,
      btnH,
      `🪙  ${formatMahjongGlobalCoinAmount(coinCost)}`,
      '#69db7c',
      '#37b24d',
      '#ffffff',
    );
  }
}

/** 关闭「牌槽已满」后：重玩 / 看广告复活（底图与「牌槽已满」一致，无庆祝图与顶栏文案）。 */
function drawMahjongSlotFullChallengeFailed(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  buttons: MahjongUiButton[],
  nowMs: number,
  chrome: MahjongPlayChrome,
  resultRevealStartMs = 0,
): void {
  ctx.save();
  if (resultRevealStartMs > 0) {
    const rev = mahjongResultRevealFrame(resultRevealStartMs, nowMs);
    ctx.globalAlpha = rev.alpha;
    ctx.translate(width / 2, height / 2 + rev.offsetY);
    ctx.scale(rev.scale, rev.scale);
    ctx.translate(-width / 2, -height / 2);
  }
  drawMahjongModalVeil(ctx, width, height, 0.46);

  const cardW = Math.min(width * 0.86, 328);
  const footerH = 112;
  const cardH = Math.min(Math.max(268, height * 0.34), height - 96);
  const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);
  const panelR = 22;

  drawMahjongModalCardFace(ctx, card.x, card.y, card.w, card.h, panelR, chrome, nowMs);
  if (chrome.playBgImage) {
    drawMahjongModalFooterReadableBand(ctx, card.x, card.y, card.w, card.h, footerH);
  }

  const closeX = card.x + card.w - 34;
  const closeY = card.y + 22;
  pushBtn(buttons, {
    id: 'mahjong_fail_close',
    x: closeX - 18,
    y: closeY - 18,
    w: 36,
    h: 36,
    label: '×',
  });
  drawMahjongPanelCloseOrb(ctx, closeX, closeY, 18);

  const bodyMidY = card.y + (card.h - footerH) / 2;
  drawMahjongCenterText(
    ctx,
    '挑战失败',
    card.cx,
    bodyMidY,
    'bold 20px sans-serif',
    '#1e5c56',
  );

  const pad = 24;
  const btnH = 46;
  const btnY = card.y + card.h - footerH + 26;
  const bw = (card.w - pad * 2 - 10) / 2;
  const coinPay = isMahjongCoinPaymentsEnabled();
  const replayCost = MAHJONG_REPLAY_COIN_COST;
  pushBtn(buttons, {
    id: coinPay ? 'mahjong_fail_replay' : 'mahjong_replay_ad',
    x: card.x + pad,
    y: btnY,
    w: bw,
    h: btnH,
    label: coinPay ? '重玩' : '看广告重开',
  });
  pushBtn(buttons, {
    id: 'mahjong_fail_revive',
    x: card.x + pad + bw + 10,
    y: btnY,
    w: bw,
    h: btnH,
    label: '复活',
  });
  if (coinPay) {
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad,
      btnY,
      bw,
      btnH,
      `重玩 ${formatMahjongGlobalCoinCostLabel(replayCost)}`,
    );
  } else {
    drawMahjongPrimaryCapsuleButton(
      ctx,
      card.x + pad,
      btnY,
      bw,
      btnH,
      '▶ 看广告重开',
      '#74c0fc',
      '#339af0',
      '#ffffff',
    );
  }
  drawMahjongPrimaryCapsuleButton(
    ctx,
    card.x + pad + bw + 10,
    btnY,
    bw,
    btnH,
    '▶ 看广告复活',
    '#69db7c',
    '#37b24d',
    '#ffffff',
  );
  ctx.restore();
}


function drawMahjongWinCelebratePanel(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  game: MahjongGame,
  buttons: MahjongUiButton[],
  autoNextMs: number,
  nowMs: number,
  celebrateImage: WxImage,
): void {
  drawMahjongModalVeil(ctx, width, height, 0.88, 'pink');
  const cardW = Math.min(width * 0.86, 328);
  const footerH = autoNextMs > 0 ? 132 : 112;
  const cardH = Math.min(Math.max(440, height * 0.56), height - 64);
  const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);

  drawMahjongCuteCard(ctx, card.x, card.y, card.w, card.h, {
    nowMs,
    radius: 22,
    border: 'rgba(255, 170, 210, 0.95)',
    fillTop: 'rgba(255,255,255,0.98)',
    fillBottom: 'rgba(255,236,245,0.98)',
  });
  drawMahjongCelebrateHeroImage(ctx, celebrateImage, card.x, card.y, card.w, card.heroH, 22);

  const title = `第 ${game.level} 关胜利`;
  drawMahjongCenterText(ctx, title, card.cx, card.y + card.heroH * 0.72, 'bold 20px sans-serif', '#c2255c');
  drawMahjongCenterText(
    ctx,
    `获得 ★${game.starsThisRun}  金币 +${formatMahjongGlobalCoinAmount(game.coinsThisRun)}`,
    card.cx,
    card.y + card.heroH * 0.82,
    'bold 13px sans-serif',
    '#a61e4d',
  );
  if (autoNextMs > 0) {
    drawMahjongCenterText(
      ctx,
      `${Math.ceil(autoNextMs / 1000)} 秒后自动进入下一关`,
      card.cx,
      card.y + card.heroH * 0.9,
      '12px sans-serif',
      '#1864ab',
    );
  }

  drawMahjongModalFooterBand(ctx, card.x, card.y, card.w, card.h, footerH);
  const pad = 24;
  const bw = (card.w - pad * 2 - 8) / 2;
  const by = card.y + card.h - footerH + 28;
  pushBtn(buttons, { id: 'mahjong_next', x: card.x + pad, y: by, w: bw, h: 44, label: '下一关' });
  pushBtn(buttons, {
    id: 'mahjong_retry',
    x: card.x + pad + bw + 8,
    y: by,
    w: bw,
    h: 44,
    label: '再玩一次',
  });
  pushBtn(buttons, {
    id: 'mahjong_back_lobby',
    x: card.x + pad,
    y: by + 52,
    w: card.w - pad * 2,
    h: 40,
    label: '返回首页',
  });
  drawMahjongPrimaryCapsuleButton(
    ctx,
    card.x + pad,
    by,
    bw,
    44,
    '下一关',
    '#74c0fc',
    '#1c7ed6',
    '#ffffff',
  );
  drawMahjongPrimaryCapsuleButton(
    ctx,
    card.x + pad + bw + 8,
    by,
    bw,
    44,
    '再玩一次',
    '#a5d8ff',
    '#339af0',
    '#ffffff',
  );
  drawMahjongPrimaryCapsuleButton(
    ctx,
    card.x + pad,
    by + 52,
    card.w - pad * 2,
    40,
    '返回首页',
    '#dee2e6',
    '#ced4da',
    '#495057',
  );
}

export function drawMahjongResult(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  game: MahjongGame,
  buttons: MahjongUiButton[],
  autoNextMs = 0,
  slotFullOfferDismissed = false,
  nowMs = 0,
  celebrateImage?: WxImage | null,
  chrome: MahjongPlayChrome = {},
  resultRevealStartMs = 0,
): void {
  buttons.length = 0;
  if (game.phase === 'lost' && game.failReason === 'slot_full') {
    if (!slotFullOfferDismissed) {
      drawMahjongSlotFullReviveOffer(ctx, width, height, game, chrome, buttons, nowMs);
    } else {
      drawMahjongSlotFullChallengeFailed(
        ctx,
        width,
        height,
        buttons,
        nowMs,
        chrome,
        resultRevealStartMs,
      );
    }
    return;
  }
  const won = game.phase === 'won';
  if (won && celebrateImage) {
    drawMahjongWinCelebratePanel(
      ctx,
      width,
      height,
      game,
      buttons,
      autoNextMs,
      nowMs,
      celebrateImage,
    );
    return;
  }
  ctx.save();
  if (resultRevealStartMs > 0) {
    const rev = mahjongResultRevealFrame(resultRevealStartMs, nowMs);
    ctx.globalAlpha = rev.alpha;
    ctx.translate(width / 2, height / 2 + rev.offsetY);
    ctx.scale(rev.scale, rev.scale);
    ctx.translate(-width / 2, -height / 2);
  }
  drawMahjongModalVeil(ctx, width, height, won ? 0.42 : 0.48);
  const cardW = width * 0.82;
  const cardH = 280;
  const cx = (width - cardW) / 2;
  const cy = (height - cardH) / 2;
  drawMahjongCuteCard(ctx, cx, cy, cardW, cardH, {
    nowMs,
    radius: 20,
    fillTop: won ? 'rgba(240, 255, 230, 0.98)' : 'rgba(255,255,255,0.98)',
    fillBottom: won ? 'rgba(210, 248, 200, 0.97)' : 'rgba(232, 248, 255, 0.97)',
    border: won ? 'rgba(91, 186, 72, 0.92)' : 'rgba(116, 192, 252, 0.92)',
  });
  drawMahjongCenterText(
    ctx,
    won ? '关卡胜利' : '挑战失败',
    width / 2,
    cy + 48,
    'bold 20px sans-serif',
    won ? '#2b8a3e' : '#1864ab',
  );
  if (won) {
    drawMahjongCenterText(
      ctx,
      `获得 ★${game.starsThisRun}  金币 +${formatMahjongGlobalCoinAmount(game.coinsThisRun)}`,
      width / 2,
      cy + 88,
      '15px sans-serif',
      '#495057',
    );
    drawMahjongCenterText(
      ctx,
      `剩余 ${formatTime(game.remainingMs)}`,
      width / 2,
      cy + 118,
      '15px sans-serif',
      '#495057',
    );
    if (autoNextMs > 0) {
      drawMahjongCenterText(
        ctx,
        `${Math.ceil(autoNextMs / 1000)} 秒后自动进入下一关`,
        width / 2,
        cy + 142,
        '13px sans-serif',
        '#1864ab',
      );
    }
  } else {
    const reason = game.failReason === 'timeout' ? '时间到' : '槽位已满';
    drawMahjongCenterText(ctx, reason, width / 2, cy + 88, '15px sans-serif', '#495057');
  }
  const pad = cx + 24;
  const bw = (cardW - 48 - 8) / 2;
  const by = cy + cardH - 72;
  if (won) {
    pushBtn(buttons, { id: 'mahjong_next', x: pad, y: by, w: bw, h: 44, label: '下一关' });
    pushBtn(buttons, {
      id: 'mahjong_retry',
      x: pad + bw + 8,
      y: by,
      w: bw,
      h: 44,
      label: '再玩一次',
    });
    pushBtn(buttons, {
      id: 'mahjong_back_lobby',
      x: pad,
      y: by + 52,
      w: cardW - 48,
      h: 40,
      label: '返回首页',
    });
  } else {
    const coinPay = isMahjongCoinPaymentsEnabled();
    pushBtn(buttons, {
      id: coinPay ? 'mahjong_replay_coin' : 'mahjong_replay_ad',
      x: pad,
      y: by,
      w: bw,
      h: 44,
      label: coinPay
        ? `重玩 ${formatMahjongGlobalCoinCostLabel(MAHJONG_REPLAY_COIN_COST)}`
        : '看广告重玩',
    });
    pushBtn(buttons, {
      id: 'mahjong_back_lobby',
      x: pad + bw + 8,
      y: by,
      w: bw,
      h: 44,
      label: '返回',
    });
  }
  for (const btn of buttons) {
    ctx.fillStyle = btn.id === 'mahjong_back_lobby' ? '#f1f3f5' : '#4dabf7';
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fill();
    drawMahjongCenterText(
      ctx,
      btn.label,
      btn.x + btn.w / 2,
      btn.y + btn.h / 2,
      '14px sans-serif',
      btn.id === 'mahjong_back_lobby' ? '#495057' : '#ffffff',
    );
  }
  ctx.restore();
}

function roundRect(
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

export function hitMahjongTile(
  tileHits: readonly MahjongTileHit[],
  x: number,
  y: number,
): number | null {
  for (let i = tileHits.length - 1; i >= 0; i -= 1) {
    const t = tileHits[i]!;
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
      return t.index;
    }
  }
  return null;
}

/** 大厅入口：重开本关 — 馆馆金币或看广告二选一。 */
export function drawMahjongLadderCoinGateModal(
  ctx: WxCanvasRenderingContext2D,
  width: number,
  height: number,
  ladderCoins: number,
  replayCost: number,
  buttons: MahjongUiButton[],
  nowMs = 0,
): void {
  buttons.length = 0;
  const shortOnCoins = ladderCoins < replayCost;
  const pad = 22;
  const btnH = 44;
  const btnGap = 10;
  const footerH = btnH + 28;
  drawMahjongModalVeil(ctx, width, height, 0.52);
  const cardW = Math.min(width * 0.88, 320);
  const cardH = Math.min(232, height * 0.38);
  const card = layoutMahjongModalCard(width, height, cardW, cardH, footerH);
  drawMahjongCuteCard(ctx, card.x, card.y, card.w, card.h, {
    radius: 20,
    border: 'rgba(255, 190, 120, 0.95)',
    fillTop: 'rgba(255,255,255,0.98)',
    fillBottom: 'rgba(255,248,235,0.98)',
    shadow: true,
    sparkle: true,
    nowMs,
  });

  drawMahjongCenterText(
    ctx,
    shortOnCoins ? '馆馆金币不够啦' : '继续本关',
    card.cx,
    card.y + 32,
    'bold 19px sans-serif',
    shortOnCoins ? '#c92a2a' : '#1864ab',
  );
  drawMahjongCenterText(
    ctx,
    formatMahjongGlobalCoinAmount(ladderCoins),
    card.cx,
    card.y + 58,
    'bold 22px sans-serif',
    '#1864ab',
  );
  drawMahjongCenterText(
    ctx,
    shortOnCoins ? '快去糖果梯子闯关赚金币吧' : '用金币或看广告，任选一种重开',
    card.cx,
    card.y + 88,
    '14px sans-serif',
    '#495057',
  );

  const innerW = card.w - pad * 2;
  const halfW = (innerW - btnGap) / 2;
  const y0 = card.y + card.h - footerH + 20;
  pushBtn(buttons, {
    id: 'mahjong_gate_coin',
    x: card.x + pad,
    y: y0,
    w: halfW,
    h: btnH,
    label: '金币重开',
  });
  pushBtn(buttons, {
    id: 'mahjong_gate_ad',
    x: card.x + pad + halfW + btnGap,
    y: y0,
    w: halfW,
    h: btnH,
    label: '复活',
  });
  drawMahjongPrimaryCapsuleButton(
    ctx,
    card.x + pad,
    y0,
    halfW,
    btnH,
    formatMahjongGlobalCoinAmount(replayCost),
  );
  drawMahjongPrimaryCapsuleButton(
    ctx,
    card.x + pad + halfW + btnGap,
    y0,
    halfW,
    btnH,
    '▶ 复活',
    '#69db7c',
    '#37b24d',
    '#ffffff',
  );

  const closeX = card.x + card.w - 28;
  const closeY = card.y + 16;
  pushBtn(buttons, {
    id: 'mahjong_gate_close',
    x: closeX - 18,
    y: closeY - 18,
    w: 36,
    h: 36,
    label: '×',
  });
  drawMahjongPanelCloseOrb(ctx, closeX, closeY, 18);
}

export function hitMahjongButton(
  buttons: readonly MahjongUiButton[],
  x: number,
  y: number,
): MahjongUiButton | null {
  for (let i = buttons.length - 1; i >= 0; i -= 1) {
    const b = buttons[i]!;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return b;
    }
  }
  return null;
}

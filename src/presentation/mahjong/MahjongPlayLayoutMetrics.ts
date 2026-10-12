import type { MahjongToolId } from '../../logic/mahjong/MahjongConfig';

/** 对局顶栏左侧「回首页」胶囊（与主线左下回首页同款口径） */
export const MAHJONG_PLAY_BACK_HOME_W = 58;
export const MAHJONG_PLAY_BACK_HOME_H = 28;
export const MAHJONG_PLAY_BACK_HOME_X = 10;
export const MAHJONG_PLAY_HEADER_BAR_H = 32;

export function mahjongPlayBackHomeFrame(safeTop: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const y =
    safeTop +
    4 +
    (MAHJONG_PLAY_HEADER_BAR_H - MAHJONG_PLAY_BACK_HOME_H) / 2;
  return {
    x: MAHJONG_PLAY_BACK_HOME_X,
    y,
    w: MAHJONG_PLAY_BACK_HOME_W,
    h: MAHJONG_PLAY_BACK_HOME_H,
  };
}

/** 顶栏 HUD 条起始 x（让出回首页钮） */
export function mahjongPlayHeaderLeftReserve(): number {
  return MAHJONG_PLAY_BACK_HOME_X + MAHJONG_PLAY_BACK_HOME_W + 8;
}

/** 左侧留给 lobby 底图小动物（兔子等） */
export const MAHJONG_TOOL_LEFT_RESERVE_RATIO = 0.3;
/** 小动物区与道具组之间的空隙（px） */
export const MAHJONG_TOOL_AFTER_PET_GAP = 14;

/** 对局页布局：自下而上排槽位/道具，牌堆夹在顶栏与槽位之间。 */
export interface MahjongPlayMetrics {
  pad: number;
  safeTop: number;
  headerBottom: number;
  pileTop: number;
  pileBottom: number;
  slotY: number;
  slotW: number;
  slotH: number;
  toolY: number;
  toolD: number;
}

export function mahjongPlayMetrics(width: number, height: number): MahjongPlayMetrics {
  const pad = 10;
  const safeTop = Math.max(44, height * 0.055);
  const headerBottom = safeTop + 48;

  const slotH = Math.min(52, width * 0.124);
  const slotW = (width - pad * 2 - 6 * 5) / 7;
  const toolD = Math.min(50, width * 0.118);
  const toolLabelSpace = 11;

  const toolY = height - toolD - toolLabelSpace - Math.max(12, height * 0.02);
  const slotY = toolY - slotH - 38;
  const pileTop = headerBottom + 6;
  const pileBottom = slotY - 10;

  return {
    pad,
    safeTop,
    headerBottom,
    pileTop,
    pileBottom,
    slotY,
    slotW,
    slotH,
    toolY,
    toolD,
  };
}

/** 槽位内牌的可绘制区域（与 drawMahjongPlay 一致）。 */
export function mahjongSlotTileRect(
  width: number,
  height: number,
  slotIndex: number,
): { x: number; y: number; w: number; h: number } {
  const m = mahjongPlayMetrics(width, height);
  const x = m.pad + slotIndex * (m.slotW + 5) + 3;
  const y = m.slotY + 3;
  return { x, y, w: m.slotW - 6, h: m.slotH - 6 };
}

const TOOL_IDS: MahjongToolId[] = ['move_out', 'gather', 'shuffle', 'reveal'];

/** 四道具按钮：紧凑间距，组整体左移（贴小动物区右侧，如设计图红框） */
export function mahjongToolButtonLayout(
  width: number,
  height: number,
): Array<{ tool: MahjongToolId; x: number; y: number; w: number; h: number }> {
  const m = mahjongPlayMetrics(width, height);
  const gap = 4;
  const d = m.toolD;
  const clusterW = TOOL_IDS.length * d + (TOOL_IDS.length - 1) * gap;
  const leftLimit = Math.floor(width * MAHJONG_TOOL_LEFT_RESERVE_RATIO);
  let startX = leftLimit + MAHJONG_TOOL_AFTER_PET_GAP;
  const maxStart = width - m.pad - clusterW;
  if (startX > maxStart) {
    startX = maxStart;
  }
  return TOOL_IDS.map((tool, idx) => ({
    tool,
    x: startX + idx * (d + gap),
    y: m.toolY,
    w: d,
    h: d,
  }));
}

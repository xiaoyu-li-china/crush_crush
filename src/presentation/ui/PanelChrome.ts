/**
 * 弹窗角标：返回「<」/ 关闭「×」。howto、公告、设置等共用。
 */

export interface CanvasButtonSpec {
  id: 'resume';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  palette: { top: string; bottom: string; border: string; gloss?: boolean };
}

/** 弹窗角标按钮尺寸 */
export const PANEL_CORNER_SIZE = 34;
const CORNER_PALETTE = {
  top: 'transparent',
  bottom: 'transparent',
  border: 'transparent',
  gloss: false,
};

/** 左上角返回「<」 */
export function panelBackButton(panel: {
  x: number;
  y: number;
}): CanvasButtonSpec {
  return {
    id: 'resume',
    x: panel.x + 10,
    y: panel.y + 8,
    w: PANEL_CORNER_SIZE,
    h: PANEL_CORNER_SIZE,
    label: '<',
    palette: CORNER_PALETTE,
  };
}

/** 右上角关闭「×」 */
export function panelCloseButton(panel: {
  x: number;
  y: number;
  w: number;
}): CanvasButtonSpec {
  return {
    id: 'resume',
    x: panel.x + panel.w - PANEL_CORNER_SIZE - 10,
    y: panel.y + 8,
    w: PANEL_CORNER_SIZE,
    h: PANEL_CORNER_SIZE,
    label: '×',
    palette: CORNER_PALETTE,
  };
}

export function isPanelBackLabel(label: string): boolean {
  return label === '<' || label === '‹';
}

export function isPanelCloseLabel(label: string): boolean {
  return label === '×' || label === 'X' || label === 'x';
}

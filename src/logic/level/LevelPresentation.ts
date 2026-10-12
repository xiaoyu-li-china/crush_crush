import type { Match3ProceduralMeta } from './Match3ProceduralMeta';

/** HSL → #rrggbb（s/l 为 0–100） */
export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toByte = (v: number) => Math.round((v + m) * 255);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(toByte(r))}${hex(toByte(g))}${hex(toByte(b))}`;
}

export type LadderBarTheme = {
  barTop: string;
  barBottom: string;
  circleTop: string;
  circleBottom: string;
  stripe: string;
  pattern: 'none' | 'stripe' | 'sprinkle';
  startTop?: string;
  startBottom?: string;
};

/** 21+ 关：按 uiVariant + hue 生成独立梯子条配色 */
export function ladderThemeFromProceduralMeta(
  meta: Match3ProceduralMeta,
  state: 'cleared' | 'current' | 'locked',
): LadderBarTheme {
  if (state === 'locked') {
    return {
      barTop: 'rgba(210, 224, 224, 0.78)',
      barBottom: 'rgba(180, 198, 200, 0.72)',
      circleTop: 'rgba(190, 205, 208, 0.92)',
      circleBottom: 'rgba(160, 178, 182, 0.9)',
      stripe: 'rgba(255,255,255,0.12)',
      pattern: 'none',
    };
  }
  const hue = (meta.hue + meta.uiVariant * 29) % 360;
  const vivid = state === 'current';
  const s = vivid ? 72 : 58;
  const lTop = vivid ? 68 : 62;
  const lBot = vivid ? 52 : 48;
  const theme: LadderBarTheme = {
    barTop: hslToHex(hue, s, lTop),
    barBottom: hslToHex(hue, s + 6, lBot),
    circleTop: hslToHex(hue, s - 4, lTop + 4),
    circleBottom: hslToHex(hue, s + 2, lBot - 2),
    stripe: 'rgba(255,255,255,0.28)',
    pattern: meta.barPattern,
  };
  if (vivid) {
    theme.startTop = hslToHex(hue, 80, 62);
    theme.startBottom = hslToHex(hue, 85, 48);
  }
  return theme;
}

export function hudPaletteFromHue(hue: number): {
  deep: string;
  mid: string;
  lite: string;
  ink: string;
  inkSoft: string;
  shadow: string;
} {
  const h = hue % 360;
  return {
    deep: hslToHex(h, 70, 42),
    mid: hslToHex(h, 75, 58),
    lite: hslToHex(h, 85, 88),
    ink: hslToHex(h, 80, 28),
    inkSoft: hslToHex(h, 70, 48),
    shadow: hslToHex(h, 60, 22),
  };
}

export function levelSkyGradientStops(hue: number): [string, string, string, string] {
  const h = hue % 360;
  return [
    hslToHex(h, 55, 78),
    hslToHex((h + 20) % 360, 50, 88),
    hslToHex((h + 55) % 360, 45, 82),
    hslToHex((h + 90) % 360, 50, 58),
  ];
}

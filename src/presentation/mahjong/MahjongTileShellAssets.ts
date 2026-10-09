/** 贴图版本号：仅用于日志；本地路径勿加 ?query（微信 IDE 会 ENOENT）。 */
export const MAHJONG_SHELL_ASSET_VER = 3;

/** 麻将牌六面立方体贴图（88×120×40，R10），由 preload 注入。 */
/** 路径仅用 ASCII：微信小游戏对中文文件名易 ENOENT。 */
export const MAHJONG_SHELL_SRC = {
  front: 'assets/main/mahjong/shell_front_88x120.png',
  frontWhite: 'assets/main/mahjong/shell_front_white_88x120.png',
  /** 主线萌宠「蓝兔」，与三消 TileKind.Blue 同款 */
  frontPetRabbit: 'assets/main/tiles/blue.png',
  top: 'assets/main/mahjong/shell_top_88x40.png',
  bottom: 'assets/main/mahjong/shell_bottom_88x40.png',
  left: 'assets/main/mahjong/shell_left_40x120.png',
  right: 'assets/main/mahjong/shell_right_40x120.png',
  back: 'assets/main/mahjong/shell_back_88x120.png',
} as const;

/** 设计稿原生尺寸（与文件名一致） */
export const MAHJONG_TILE_NATIVE = { w: 88, h: 120, d: 40, cornerR: 10 } as const;

export interface MahjongTileShellPack {
  front: WxImage;
  frontWhite: WxImage;
  frontPetRabbit: WxImage;
  top: WxImage;
  bottom: WxImage;
  left: WxImage;
  right: WxImage;
  back: WxImage;
}

let shellPack: MahjongTileShellPack | undefined;
let shellMissingKeys: string[] = [];

export function setMahjongTileShellPack(pack: MahjongTileShellPack | undefined): void {
  shellPack = pack;
  if (pack) {
    shellMissingKeys = [];
  }
}

export function getMahjongShellMissingKeys(): readonly string[] {
  return shellMissingKeys;
}

export function isMahjongTileShellReady(): boolean {
  return shellPack !== undefined;
}

/** 五面壳最低要求：白玉正面 + 蓝兔 + 四边/顶底/背面（预合成 front 可选）。 */
export function applyMahjongShellImages(parts: {
  front?: WxImage | null;
  frontWhite?: WxImage | null;
  frontPetRabbit?: WxImage | null;
  top?: WxImage | null;
  bottom?: WxImage | null;
  left?: WxImage | null;
  right?: WxImage | null;
  back?: WxImage | null;
}): boolean {
  const frontWhite = parts.frontWhite ?? undefined;
  const frontPetRabbit = parts.frontPetRabbit ?? undefined;
  const top = parts.top ?? undefined;
  const bottom = parts.bottom ?? undefined;
  const left = parts.left ?? undefined;
  const right = parts.right ?? undefined;
  const back = parts.back ?? undefined;
  const missing: string[] = [];
  if (!frontWhite) {
    missing.push('frontWhite');
  }
  if (!frontPetRabbit) {
    missing.push('frontPetRabbit');
  }
  if (!top) {
    missing.push('top');
  }
  if (!bottom) {
    missing.push('bottom');
  }
  if (!left) {
    missing.push('left');
  }
  if (!right) {
    missing.push('right');
  }
  if (!back) {
    missing.push('back');
  }
  if (missing.length > 0) {
    shellMissingKeys = missing;
    if (back) {
      setMahjongTileBackPattern(back);
    }
    return false;
  }
  setMahjongTileShellPack({
    front: parts.front ?? frontWhite!,
    frontWhite: frontWhite!,
    frontPetRabbit: frontPetRabbit!,
    top: top!,
    bottom: bottom!,
    left: left!,
    right: right!,
    back: back!,
  });
  setMahjongTileBackPattern(back!);
  return true;
}

export function getMahjongTileShellPack(): MahjongTileShellPack | undefined {
  return shellPack;
}

/** @deprecated 旧单张背面抠图，五面贴图加载成功后不再使用 */
export const MAHJONG_TILE_BACK_SRC = MAHJONG_SHELL_SRC.back;

let backFacePattern: WxImage | undefined;

export function setMahjongTileBackPattern(img: WxImage | undefined): void {
  backFacePattern = img;
}

export function getMahjongTileBackPattern(): WxImage | undefined {
  return backFacePattern ?? shellPack?.back;
}

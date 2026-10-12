import {
  getDefaultMahjongTheme,
  getMahjongTheme,
  tileAssetPath,
  type MahjongThemePack,
} from '../../logic/mahjong/MahjongThemeCatalog';

export type MahjongImageLoader = (src: string) => Promise<WxImage | null>;

export interface MahjongThemeLoadResult {
  theme: MahjongThemePack;
  requestedThemeId: string;
  usedFallback: boolean;
}

/** 主题牌面懒加载；单张或整包失败时降级 default 贴图。 */
export class MahjongThemeAssets {
  private readonly cache = new Map<string, Map<number, WxImage>>();
  private activeThemeId: string | null = null;
  private lastLoadUsedFallback = false;

  public constructor(private readonly loadImage: MahjongImageLoader) {}

  public getActiveThemeId(): string | null {
    return this.activeThemeId;
  }

  public didLastLoadUseFallback(): boolean {
    return this.lastLoadUsedFallback;
  }

  public resolveTheme(themeId: string): MahjongThemePack {
    return getMahjongTheme(themeId) ?? getDefaultMahjongTheme();
  }

  private defaultTileImage(typeIndex: number): WxImage | undefined {
    const defaultTheme = getDefaultMahjongTheme();
    return this.cache.get(defaultTheme.themeId)?.get(typeIndex);
  }

  private async loadThemeTiles(
    theme: MahjongThemePack,
    typeCount: number,
    allowPerTileFallback: boolean,
  ): Promise<number> {
    let bucket = this.cache.get(theme.themeId);
    if (!bucket) {
      bucket = new Map();
      this.cache.set(theme.themeId, bucket);
    }
    const defaultTheme = getDefaultMahjongTheme();
    const need = Math.max(typeCount, theme.tiles.length);
    let loaded = 0;
    for (let i = 0; i < need; i += 1) {
      if (bucket.has(i)) {
        loaded += 1;
        continue;
      }
      const path = tileAssetPath(theme, i);
      if (!path) {
        continue;
      }
      let img = await this.loadImage(path);
      if (
        !img &&
        allowPerTileFallback &&
        theme.themeId !== defaultTheme.themeId
      ) {
        const fallbackPath = tileAssetPath(defaultTheme, i);
        if (fallbackPath) {
          img =
            this.defaultTileImage(i) ??
            (fallbackPath === path ? null : await this.loadImage(fallbackPath));
        }
        if (img) {
          this.lastLoadUsedFallback = true;
        }
      }
      if (img) {
        bucket.set(i, img);
        loaded += 1;
      }
    }
    return loaded;
  }

  public async ensureTheme(
    themeId: string,
    typeCount: number,
  ): Promise<MahjongThemeLoadResult> {
    const requested = getMahjongTheme(themeId) ?? getDefaultMahjongTheme();
    const defaultTheme = getDefaultMahjongTheme();
    this.lastLoadUsedFallback = false;

    await this.loadThemeTiles(defaultTheme, typeCount, false);

    let theme = requested;
    let loaded = await this.loadThemeTiles(theme, typeCount, true);
    const minRequired = Math.min(3, Math.max(1, theme.tiles.length));
    if (theme.themeId !== defaultTheme.themeId && loaded < minRequired) {
      theme = defaultTheme;
      loaded = await this.loadThemeTiles(theme, typeCount, false);
      this.lastLoadUsedFallback = true;
    }

    this.activeThemeId = theme.themeId;
    return {
      theme,
      requestedThemeId: requested.themeId,
      usedFallback: this.lastLoadUsedFallback,
    };
  }

  public getTileImage(themeId: string, typeIndex: number): WxImage | undefined {
    const direct = this.cache.get(themeId)?.get(typeIndex);
    if (direct) {
      return direct;
    }
    const defaultTheme = getDefaultMahjongTheme();
    if (themeId !== defaultTheme.themeId) {
      return (
        this.defaultTileImage(typeIndex) ??
        this.cache.get(this.activeThemeId ?? '')?.get(typeIndex)
      );
    }
    return undefined;
  }
}

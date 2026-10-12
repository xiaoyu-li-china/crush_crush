import { createSeededRandom } from '../../core/utils/math';
import bundledThemes from '../../config/mahjong-themes.json';
import cdnConfig from '../../config/mahjong-cdn.json';
import {
  getMahjongLevelOverride,
  getMahjongOps,
  mahjongThemePickLevel,
} from './MahjongOpsConfig';

export interface MahjongThemeManifest {
  version: number;
  defaultThemeId: string;
  themes: MahjongThemePack[];
}

export interface MahjongThemePack {
  themeId: string;
  name: string;
  tiles: string[];
  background?: string;
  tileBack?: string;
}

export type MahjongThemeJsonFetcher = (url: string) => Promise<unknown>;

let manifest: MahjongThemeManifest = normalizeManifest(bundledThemes as MahjongThemeManifest);
let remoteLoaded = false;

function normalizeManifest(raw: Partial<MahjongThemeManifest>): MahjongThemeManifest {
  const themes = Array.isArray(raw.themes) ? raw.themes : [];
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    defaultThemeId: raw.defaultThemeId ?? 'default',
    themes: themes.map((t) => ({
      themeId: t.themeId,
      name: t.name,
      tiles: [...(t.tiles ?? [])],
      background: t.background,
      tileBack: t.tileBack,
    })),
  };
}

function byIdMap(): Map<string, MahjongThemePack> {
  return new Map(manifest.themes.map((t) => [t.themeId, t]));
}

export function getMahjongThemeManifestVersion(): number {
  return manifest.version;
}

export function isMahjongCdnEnabled(): boolean {
  return cdnConfig.enabled === true && (cdnConfig.cdnBaseUrl?.length ?? 0) > 0;
}

/** 相对 CDN 路径、本地 assets、或完整 URL → 最终加载地址 */
export function resolveMahjongAssetUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('assets/')) {
    return pathOrUrl;
  }
  const base = (cdnConfig.cdnBaseUrl ?? '').replace(/\/+$/, '');
  if (cdnConfig.enabled && base.length > 0) {
    const rel = pathOrUrl.replace(/^\/+/, '');
    return `${base}/${rel}`;
  }
  return pathOrUrl;
}

export function applyMahjongThemeManifest(next: Partial<MahjongThemeManifest>): void {
  manifest = normalizeManifest(next);
  remoteLoaded = true;
}

export function resetMahjongThemeManifestToBundled(): void {
  manifest = normalizeManifest(bundledThemes as MahjongThemeManifest);
  remoteLoaded = false;
}

export async function fetchMahjongThemeManifestFromCdn(
  fetchJson: MahjongThemeJsonFetcher,
): Promise<boolean> {
  if (!cdnConfig.enabled) {
    return false;
  }
  const url = (cdnConfig.manifestUrl ?? '').trim();
  if (url.length === 0) {
    return false;
  }
  try {
    const data = await fetchJson(url);
    if (!data || typeof data !== 'object') {
      return false;
    }
    applyMahjongThemeManifest(data as MahjongThemeManifest);
    return true;
  } catch {
    return false;
  }
}

export function hasRemoteMahjongManifest(): boolean {
  return remoteLoaded;
}

export function listMahjongThemes(): readonly MahjongThemePack[] {
  return manifest.themes;
}

export function getMahjongTheme(themeId: string): MahjongThemePack | null {
  return byIdMap().get(themeId) ?? null;
}

export function getDefaultMahjongTheme(): MahjongThemePack {
  const id = manifest.defaultThemeId ?? 'default';
  return getMahjongTheme(id) ?? manifest.themes[0]!;
}

export function pickMahjongThemeForLevel(level: number, seed: number): MahjongThemePack {
  const override = getMahjongLevelOverride(level);
  if (override?.themeId) {
    return getMahjongTheme(override.themeId) ?? getDefaultMahjongTheme();
  }
  const ops = getMahjongOps();
  if (level <= 1) {
    return getMahjongTheme(ops.theme.level1ThemeId) ?? getDefaultMahjongTheme();
  }
  if (level <= 2) {
    return getMahjongTheme(ops.theme.level2ThemeId) ?? getDefaultMahjongTheme();
  }
  const themeLevel = mahjongThemePickLevel(level);
  const pool = manifest.themes.length > 0 ? manifest.themes : [getDefaultMahjongTheme()];
  if (ops.theme.sequentialFromLevel3) {
    const idx = (themeLevel - 3) % pool.length;
    return pool[idx] ?? getDefaultMahjongTheme();
  }
  const rng = createSeededRandom(seed ^ 0x9e3779b9 ^ themeLevel);
  const idx = Math.floor(rng() * pool.length);
  return pool[idx] ?? getDefaultMahjongTheme();
}

export function tileAssetPath(theme: MahjongThemePack, typeIndex: number): string | null {
  if (theme.tiles.length === 0 || typeIndex < 0) {
    return null;
  }
  let raw = theme.tiles[typeIndex % theme.tiles.length];
  if (!raw) {
    return null;
  }
  if (!isMahjongCdnEnabled() && /^themes\//.test(raw)) {
    const fallback = getDefaultMahjongTheme();
    raw = fallback.tiles[typeIndex % fallback.tiles.length] ?? fallback.tiles[0] ?? raw;
  }
  return resolveMahjongAssetUrl(raw);
}

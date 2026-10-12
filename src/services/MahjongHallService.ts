import type { IAnalytics, IStorage } from '../core';
import { StorageKeys } from '../core/ports/IStorage';
import {
  MAHJONG_BASE_SLOTS,
  MAHJONG_INFINITE_LEVEL_CAP,
  MAHJONG_REPLAY_COIN_COST,
  type MahjongToolId,
} from '../logic/mahjong/MahjongConfig';
import { getMahjongTheme } from '../logic/mahjong/MahjongThemeCatalog';
import { MahjongGame } from '../logic/mahjong/MahjongGame';
import { generateMahjongLevel, verifySolvablePile } from '../logic/mahjong/MahjongGenerator';
import {
  getMahjongOpsVersion,
  mahjongCoinCost,
  mahjongTimeoutMsForLevel,
  shouldMahjongOpsSampleLevel,
} from '../logic/mahjong/MahjongOpsConfig';
import {
  emptyMahjongProgress,
  normalizeMahjongProgress,
  recordMahjongClear,
  type MahjongHallProgressData,
} from '../logic/mahjong/MahjongProgress';

export type MahjongLadderCoinWallet = {
  getAvailable: () => number;
  spend: (amount: number) => boolean;
};

export class MahjongHallService {
  private data: MahjongHallProgressData = emptyMahjongProgress();
  private active: MahjongGame | null = null;
  private playerKey = 'local';
  private cloudSyncHook: (() => void) | null = null;
  private ladderCoinWallet: MahjongLadderCoinWallet | null = null;

  public constructor(
    private readonly storage: IStorage,
    private readonly analytics: IAnalytics,
  ) {}

  /** 本地麻将进度变更后触发云存档推送（由 GameSession 注入）。 */
  public setCloudSyncHook(hook: () => void): void {
    this.cloudSyncHook = hook;
  }

  /** 萌宠麻将馆消耗统一走梯子关卡折算金币。 */
  public setLadderCoinWallet(wallet: MahjongLadderCoinWallet): void {
    this.ladderCoinWallet = wallet;
  }

  public getSpendableCoins(): number {
    if (this.ladderCoinWallet) {
      return this.ladderCoinWallet.getAvailable();
    }
    return this.data.coins;
  }

  public setPlayerKey(key: string): void {
    this.playerKey = key.length > 0 ? key : 'local';
  }

  public async load(): Promise<void> {
    const saved = await this.storage.get<MahjongHallProgressData>(StorageKeys.MahjongHallProgress);
    this.data = normalizeMahjongProgress(saved);
  }

  public async persist(): Promise<void> {
    await this.storage.set(StorageKeys.MahjongHallProgress, this.data);
    this.cloudSyncHook?.();
  }

  public getProgress(): Readonly<MahjongHallProgressData> {
    return this.data;
  }

  public getCloudSlice(): MahjongHallProgressData {
    return normalizeMahjongProgress(this.data);
  }

  public loadProgress(data: MahjongHallProgressData): void {
    this.data = normalizeMahjongProgress(data);
    if (this.active && this.data.savedRun?.phase === 'playing') {
      if (this.active.level !== this.data.savedRun.level) {
        this.active = null;
      }
    } else if (this.active?.phase === 'playing') {
      this.active = null;
    }
  }

  public getActiveGame(): MahjongGame | null {
    return this.active;
  }

  public isLevelUnlocked(level: number): boolean {
    return level >= 1 && level <= this.data.highestUnlocked;
  }

  public bestStars(level: number): number {
    return this.data.starsByLevel[String(level)] ?? 0;
  }

  /** 入口直进对局：有未完成局则恢复，否则当前进度关（无限叠加的最高可挑战关）。 */
  public resolveEntryLevel(): number {
    if (
      this.data.savedRun?.phase === 'playing' ||
      this.data.savedRun?.phase === 'lost'
    ) {
      return this.data.savedRun.level;
    }
    if (this.data.blockedReplayLevel != null) {
      return this.data.blockedReplayLevel;
    }
    return this.data.highestUnlocked;
  }

  /** 无未完成局且本关已失败锁定时，不可免费再进。 */
  public canFreeEnterMahjongLevel(level: number): boolean {
    const safeLevel = Math.max(1, Math.floor(level));
    if (
      this.data.savedRun &&
      this.data.savedRun.level === safeLevel &&
      (this.data.savedRun.phase === 'playing' || this.data.savedRun.phase === 'lost')
    ) {
      return true;
    }
    return this.data.blockedReplayLevel !== safeLevel;
  }

  public enterFromHall(): MahjongGame {
    const level = this.resolveEntryLevel();
    if (!this.canFreeEnterMahjongLevel(level)) {
      throw new Error('MAHJONG_REPLAY_REQUIRED');
    }
    const resume =
      this.data.savedRun != null &&
      this.data.savedRun.level === level &&
      (this.data.savedRun.phase === 'playing' || this.data.savedRun.phase === 'lost');
    return this.startLevel(level, resume);
  }

  /** 本关重开：清存档并重新生成牌局（需已付金币或从失败 UI 触发）。 */
  public async restartLevel(level: number): Promise<MahjongGame> {
    if (this.active) {
      this.data.tools = { ...this.active.tools };
      this.active = null;
    }
    this.data.savedRun = null;
    this.data.blockedReplayLevel = null;
    await this.persist();
    return this.startLevel(level, false);
  }

  public startLevel(level: number, resume = true): MahjongGame {
    const safeLevel = Math.min(
      MAHJONG_INFINITE_LEVEL_CAP,
      Math.max(1, Math.floor(level)),
    );
    if (
      resume &&
      this.data.savedRun &&
      this.data.savedRun.level === safeLevel &&
      (this.data.savedRun.phase === 'playing' || this.data.savedRun.phase === 'lost')
    ) {
      if (
        this.data.savedRun.phase === 'playing' &&
        this.data.blockedReplayLevel === safeLevel
      ) {
        resume = false;
      } else {
        this.active = MahjongGame.fromSnapshot(this.data.savedRun);
        this.analytics.track('mahjong_level_resume', {
          level: safeLevel,
          phase: this.active.phase,
        });
        return this.active;
      }
    }
    if (!resume && this.data.blockedReplayLevel === safeLevel) {
      throw new Error('MAHJONG_REPLAY_REQUIRED');
    }
    const generated = generateMahjongLevel(safeLevel, this.playerKey);
    if (shouldMahjongOpsSampleLevel(safeLevel)) {
      const solvable = verifySolvablePile(generated.pile, MAHJONG_BASE_SLOTS);
      this.analytics.track('mahjong_ops_level_sample', {
        level: safeLevel,
        solvable,
        seed: generated.seed,
        typeCount: generated.typeCount,
        opsVersion: getMahjongOpsVersion(),
      });
    }
    const themeId = generated.themeId;
    const themeTileCount =
      getMahjongTheme(themeId)?.tiles.length ?? generated.typeCount;
    this.active = new MahjongGame(
      generated,
      themeId,
      { ...this.data.tools },
      this.data.guideSeen,
      mahjongTimeoutMsForLevel(safeLevel),
      themeTileCount,
    );
    if (safeLevel === 1 && !this.data.guideSeen) {
      this.active.guideShown = false;
    }
    this.data.savedRun = this.active.toSnapshot();
    void this.persist();
    const themeName = getMahjongTheme(themeId)?.name ?? themeId;
    this.analytics.track('mahjong_level_start', { level: safeLevel, themeId, themeName });
    this.analytics.track('mahjong_theme_exposure', { level: safeLevel, themeId, themeName });
    return this.active;
  }

  public trackTileTap(level: number): void {
    this.analytics.track('mahjong_tile_tap', { level });
  }

  public trackTripleClear(level: number, stars: number): void {
    this.analytics.track('mahjong_triple_clear', { level, stars });
  }

  public trackToolUse(tool: MahjongToolId, level: number): void {
    this.analytics.track('mahjong_tool_use', { tool, level });
  }

  public trackHallEnter(level: number): void {
    this.analytics.track('mahjong_hall_enter', { level });
  }

  public trackAutoNext(level: number): void {
    this.analytics.track('mahjong_auto_next', { level });
  }

  public trackThemeCdnFallback(requestedThemeId: string): void {
    this.analytics.track('mahjong_theme_cdn_fallback', { requestedThemeId });
  }

  public async saveActiveRun(): Promise<void> {
    if (!this.active || this.active.phase !== 'playing') {
      return;
    }
    this.data.savedRun = this.active.toSnapshot();
    await this.persist();
    this.analytics.track('mahjong_progress_save');
  }

  /** 失败瞬间写入 lost 快照，避免磁盘仍留 playing 可白嫖续玩。 */
  public async persistFailedRun(): Promise<void> {
    if (!this.active || this.active.phase !== 'lost') {
      return;
    }
    this.data.savedRun = this.active.toSnapshot();
    this.data.blockedReplayLevel = this.active.level;
    await this.persist();
  }

  public async clearSavedRun(): Promise<void> {
    this.data.savedRun = null;
    this.data.blockedReplayLevel = null;
    await this.persist();
  }

  public async finishActive(won: boolean): Promise<void> {
    if (!this.active) {
      return;
    }
    const game = this.active;
    if (won) {
      this.data = recordMahjongClear(this.data, game.level, game.starsThisRun, 0);
      this.data.tools = { ...game.tools };
      if (game.level === 1) {
        this.data.guideSeen = true;
      }
      this.analytics.track('mahjong_level_win', {
        level: game.level,
        stars: game.starsThisRun,
        coins: game.coinsThisRun,
      });
    } else {
      this.data.tools = { ...game.tools };
      this.data.savedRun = null;
      if (this.data.blockedReplayLevel == null) {
        this.data.blockedReplayLevel = game.level;
      }
      this.analytics.track('mahjong_level_fail', {
        level: game.level,
        reason: game.failReason ?? 'unknown',
      });
    }
    this.active = null;
    await this.persist();
  }

  public leaveTable(): void {
    if (this.active?.phase === 'playing') {
      this.data.savedRun = this.active.toSnapshot();
      void this.persist();
    } else if (this.active?.phase === 'lost') {
      void this.persistFailedRun();
    }
    this.active = null;
  }

  public spendCoins(amount: number): boolean {
    const cost = Math.floor(amount);
    if (cost <= 0) {
      return true;
    }
    if (this.ladderCoinWallet) {
      return this.ladderCoinWallet.spend(cost);
    }
    if (this.data.coins < cost) {
      return false;
    }
    this.data.coins -= cost;
    void this.persist();
    return true;
  }

  public buyTool(tool: MahjongToolId): boolean {
    if (!this.spendCoins(mahjongCoinCost())) {
      return false;
    }
    this.grantTool(tool, 'coin');
    return true;
  }

  /** 看广告等途径发放 1 个道具 */
  public grantTool(tool: MahjongToolId, source: 'coin' | 'ad' = 'ad'): void {
    this.data.tools[tool] += 1;
    if (this.active) {
      this.active.tools[tool] += 1;
    }
    void this.persist();
    if (source === 'coin') {
      this.analytics.track('mahjong_coin_buy_tool', { tool });
    }
  }

  public payReplay(coinCost = MAHJONG_REPLAY_COIN_COST): boolean {
    if (!this.spendCoins(coinCost)) {
      return false;
    }
    this.analytics.track('mahjong_coin_replay');
    return true;
  }

  public async unlockAdSlot(): Promise<boolean> {
    if (!this.active || this.active.adSlotUnlocked) {
      return false;
    }
    this.active.unlockAdSlot();
    this.data.savedRun = this.active.toSnapshot();
    await this.persist();
    this.analytics.track('mahjong_ad_slot');
    return true;
  }

  public async reviveAfterSlotFullAd(): Promise<boolean> {
    if (!this.active?.reviveMoveOutFromSlots()) {
      return false;
    }
    this.data.blockedReplayLevel = null;
    this.data.savedRun = this.active.toSnapshot();
    await this.persist();
    this.analytics.track('mahjong_slot_full_revive', { level: this.active.level });
    return true;
  }
}

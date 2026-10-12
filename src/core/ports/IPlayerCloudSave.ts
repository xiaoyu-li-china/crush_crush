import type { PlayerSettings } from './IStorage';
import type { BoosterStock } from '../../logic/economy/BoosterInventory';
import type { DailyLoopData } from '../../logic/economy/DailyLoop';
import type { InviteCloudSlice } from '../../logic/economy/InviteLoop';
import type { LevelProgressData } from '../../logic/level/LevelProgress';
import type { MahjongHallProgressData } from '../../logic/mahjong/MahjongProgress';

/** 绑定到微信用户（openid）的云端存档。 */
export interface PlayerCloudSnapshot {
  updatedAt: number;
  progress: LevelProgressData;
  boosters: BoosterStock;
  settings: PlayerSettings;
  daily: DailyLoopData;
  invite?: InviteCloudSlice;
  /** 萌宠麻将馆进度（V1.2 云存档） */
  mahjong?: MahjongHallProgressData;
}

export interface InviteClaimResult {
  ok: boolean;
  retry?: boolean;
}

export interface IPlayerCloudSave {
  isEnabled(): boolean;
  pull(): Promise<PlayerCloudSnapshot | null>;
  push(snapshot: PlayerCloudSnapshot): Promise<void>;
  /** 被邀请人首次通关后，给邀请人云档记锤子额度。 */
  claimInvite?(inviterCode: string): Promise<InviteClaimResult>;
}

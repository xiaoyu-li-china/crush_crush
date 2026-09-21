export type { IStorage, StorageKey, PlayerSettings } from './ports/IStorage';
export { StorageKeys } from './ports/IStorage';
export type { AdPlacement, AdShowResult, IAdService } from './ports/IAdService';
export type { AudioClipId, IAudio } from './ports/IAudio';
export type { AnalyticsEventName, IAnalytics } from './ports/IAnalytics';
export type {
  IPlatform,
  PlatformLifecycleHandler,
  PlatformSystemInfo,
} from './ports/IPlatform';

export { WxStorageAdapter } from './adapters/WxStorageAdapter';
export { WxCloudSaveAdapter } from './adapters/WxCloudSaveAdapter';
export type { IPlayerCloudSave, PlayerCloudSnapshot, InviteClaimResult } from './ports/IPlayerCloudSave';
export { WxAdAdapter, isWxCustomAdHostSupported, canCreateWxNativeAds, canCreateWxFullscreenAds } from './adapters/WxAdAdapter';
export type { WxAdUnitConfig } from './adapters/WxAdAdapter';
export { WxAudioAdapter } from './adapters/WxAudioAdapter';
export { WxAnalyticsAdapter } from './adapters/WxAnalyticsAdapter';
export { WxPlatformAdapter } from './adapters/WxPlatformAdapter';
export { WxShareAdapter } from './adapters/WxShareAdapter';
export type { SharePayload, SharePayloadProvider, OfficialAccountPost } from './adapters/WxShareAdapter';


export { ObjectPool } from './pool/ObjectPool';
export type { PoolFactory } from './pool/ObjectPool';
export { clamp, createSeededRandom, assertNever } from './utils/math';

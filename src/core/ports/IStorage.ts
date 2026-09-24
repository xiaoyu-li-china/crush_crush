/**
 * 存储端口：逻辑层 / 服务层仅依赖本接口，禁止直接调用 wx.*。
 * 微信 Storage API 变更时，只需修改 Adapter 实现。
 */
export interface IStorage {
  /**
   * 读取指定 key 的值；不存在时返回 null。
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * 写入指定 key；写入失败时抛出错误。
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * 删除指定 key；key 不存在时视为成功。
   */
  remove(key: string): Promise<void>;

  /**
   * 清空全部本地存储（慎用，通常仅调试）。
   */
  clear(): Promise<void>;
}

/** 进度与设置常用 key，集中管理避免魔法字符串。 */
export const StorageKeys = {
  PlayerProgress: 'crush.player.progress',
  Settings: 'crush.player.settings',
  AdCooldown: 'crush.ad.cooldown',
  DailyLoop: 'crush.player.daily',
  Boosters: 'crush.player.boosters',
  NoticeSeen: 'crush.player.noticeSeen',
  Invite: 'crush.player.invite',
  DeviceId: 'crush.player.device',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/** 本地玩家设置（音效开关等）。 */
export interface PlayerSettings {
  muted: boolean;
}

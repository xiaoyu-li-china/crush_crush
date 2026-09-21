/**
 * 音频端口：屏蔽 wx.createInnerAudioContext / 引擎 AudioSource 差异。
 */
export type AudioClipId = string;

export interface IAudio {
  play(clipId: AudioClipId, options?: { loop?: boolean; volume?: number }): void;
  stop(clipId: AudioClipId): void;
  stopAll(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  dispose(): void;
  /** 预加载短音效，避免首次延后播放静默失败 */
  preloadSfx?(): void;
  /** 进游戏圈 / 切后台：暂停 BGM，保留想播状态 */
  suspendForBackground?(): void;
  /** 从游戏圈返回：恢复 BGM */
  resumeFromBackground?(): void;
}

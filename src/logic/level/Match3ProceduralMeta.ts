/** 21+ 程序化关：大厅 / 进关 / HUD 展示用（与盘面 seed 绑定，可复现）。 */
export interface Match3ProceduralMeta {
  /** 0–11，决定梯子条配色与纹理 */
  uiVariant: number;
  /** 0–359，局内 HUD / 背景色调 */
  hue: number;
  /** 关卡条中部短标签，如「冰·棉」 */
  badgeShort: string;
  /** 进关艺术字主标题 */
  entryTitle: string;
  /** 进关艺术字副标题（玩法摘要） */
  entrySubtitle: string;
  /** 条带纹理 */
  barPattern: 'none' | 'stripe' | 'sprinkle';
}

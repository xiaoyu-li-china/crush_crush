import type { MahjongToolId } from '../../logic/mahjong/MahjongConfig';

export const MAHJONG_TOOL_ICON_SRC: Record<MahjongToolId, string> = {
  move_out: 'assets/main/mahjong/tools/tool-move-out.png',
  gather: 'assets/main/mahjong/tools/tool-gather.png',
  shuffle: 'assets/main/mahjong/tools/tool-shuffle.png',
  reveal: 'assets/main/mahjong/tools/tool-reveal.png',
};

export type MahjongToolIconLookup = (tool: MahjongToolId) => WxImage | undefined;

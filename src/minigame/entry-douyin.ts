/**
 * 抖音小游戏入口（打包为 dist/douyin/crush-bundle.js，由 game.js shell require）。
 */
import './installTtShim';
import './douyinEarly';

import { launchDouyinGame } from './douyinLaunch';

void launchDouyinGame().catch((err: unknown) => {
  console.error('[crush-crush] douyin boot failed', err);
});

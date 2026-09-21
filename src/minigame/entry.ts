/**
 * 微信小游戏入口（打包为根目录 game.js）。
 * 在微信开发者工具中打开本仓库根目录即可预览。
 */
import { Bootstrap, createAppContainer } from '../services/Bootstrap';
import { WxCanvasGameApp } from '../presentation/wechat/WxCanvasGameApp';

function waitWxBridge(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    try {
      if (typeof wx !== 'undefined' && typeof wx.nextTick === 'function') {
        wx.nextTick(done);
      }
    } catch {
      // 真机调试桥未就绪时 nextTick 也可能失败
    }
    setTimeout(done, 48);
  });
}

async function bootWechatMiniGame(): Promise<void> {
  await waitWxBridge();
  const container = createAppContainer();
  const bootstrap = new Bootstrap(container);
  const session = await bootstrap.run();
  const app = new WxCanvasGameApp(session);
  app.bootIntoLobby();
  app.start();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });
  await app.preloadAssets();
}

void bootWechatMiniGame().catch((err: unknown) => {
  console.error('[crush-crush] wechat boot failed', err);
});

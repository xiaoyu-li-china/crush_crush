import { Bootstrap, createAppContainer } from '../services/Bootstrap';
import { WxCanvasGameApp } from '../presentation/wechat/WxCanvasGameApp';
import { installTtWxShim } from './ttWxShim';

function waitHostBridge(): Promise<void> {
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
      // ignore
    }
    setTimeout(done, 48);
  });
}

export async function launchDouyinGame(): Promise<void> {
  if (!installTtWxShim()) {
    throw new Error('tt runtime missing');
  }
  await waitHostBridge();
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

/**
 * 构建微信小游戏入口 game.js
 * 用法：npm run build:wechat
 * 监听：npm run dev:wechat
 */
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(root, 'src/minigame/entry.ts')],
  bundle: true,
  outfile: path.join(root, 'game.js'),
  format: 'iife',
  platform: 'neutral',
  target: ['es2018'],
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.info('[build-wechat] watching… output game.js');
} else {
  await esbuild.build(options);
  console.info('[build-wechat] wrote game.js');
}

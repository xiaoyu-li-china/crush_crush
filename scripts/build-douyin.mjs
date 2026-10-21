/**
 * 构建抖音小游戏包到 dist/douyin/
 * 用法：npm run build:douyin
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'douyin');

const DOUYIN_JSON_REDIRECTS = [
  { match: /[/\\]ad-placements\.json$/, to: 'src/config/ad-placements.douyin.json' },
  { match: /[/\\]cloud\.json$/, to: 'src/config/cloud.douyin.json' },
  { match: /[/\\]challenge\.json$/, to: 'src/config/challenge.douyin.json' },
];

const douyinConfigPlugin = {
  name: 'douyin-config-alias',
  setup(build) {
    for (const { match, to } of DOUYIN_JSON_REDIRECTS) {
      build.onResolve({ filter: match }, (args) => {
        if (!args.path.includes('config')) {
          return undefined;
        }
        return { path: path.join(root, to) };
      });
    }
  },
};

async function copyDir(src, dest, { skipNames = new Set() } = {}) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    if (skipNames.has(ent.name)) {
      continue;
    }
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      await copyDir(from, to, { skipNames });
    } else if (ent.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

async function writeGameJson() {
  const src = path.join(root, 'platforms', 'douyin', 'game.json');
  const raw = await fs.readFile(src, 'utf8');
  await fs.writeFile(path.join(outDir, 'game.json'), raw, 'utf8');
}

async function writeProjectConfig() {
  const templatePath = path.join(root, 'platforms', 'douyin', 'project.config.json');
  let text = await fs.readFile(templatePath, 'utf8');
  const envAppId = process.env.DOUYIN_APPID?.trim();
  if (envAppId) {
    text = text.replace(/"appid"\s*:\s*"[^"]*"/, `"appid": "${envAppId}"`);
  } else if (text.includes('TODO_DOUYIN_APPID')) {
    console.warn('[build-douyin] appid 仍为占位，请在 platforms/douyin/project.config.json 填写或设置 DOUYIN_APPID');
  }
  await fs.writeFile(path.join(outDir, 'project.config.json'), text, 'utf8');
}

async function assembleStaticAssets() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const skipAssets = new Set(['brand', 'bundle-fx', 'bundle-game', 'remote']);
  await copyDir(path.join(root, 'assets'), path.join(outDir, 'assets'), {
    skipNames: skipAssets,
  });

  await writeGameJson();
  await writeProjectConfig();
}

await assembleStaticAssets();

const shellPath = path.join(root, 'platforms', 'douyin', 'game-entry.js');
const bundlePath = path.join(outDir, 'crush-bundle.js');

await esbuild.build({
  entryPoints: [path.join(root, 'src/minigame/entry-douyin.ts')],
  bundle: true,
  outfile: bundlePath,
  format: 'iife',
  platform: 'neutral',
  target: ['es2018'],
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
  plugins: [douyinConfigPlugin],
});

await fs.copyFile(shellPath, path.join(outDir, 'game.js'));

console.info('[build-douyin] wrote dist/douyin (game.js + crush-bundle.js)');

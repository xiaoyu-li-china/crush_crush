/**
 * 生成软著「源程序鉴别材料」：前 30 页 + 后 30 页，每页 50 行（去空行），页眉为软件全称 + 版本号。
 * 输出 HTML，并在本机有 Google Chrome 时直接打印为 PDF。
 * 用法：node scripts/generate-softcopyright-source.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'src');
const outDir = path.join(root, 'docs/douyin-softcopyright');
const outHtml = path.join(outDir, '04-源程序鉴别材料.html');
const outPdf = path.join(outDir, '04-源程序鉴别材料.pdf');

const SOFTWARE_TITLE = '萌宠粉碎消游戏软件 V1.0';
const LINES_PER_PAGE = 50;
const PAGES_EACH = 30;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** 程序入口排在最前，便于审查从启动流程读起 */
const PRIORITY = [
  'minigame/entry-douyin.ts',
  'minigame/installTtShim.ts',
  'minigame/douyinEarly.ts',
  'minigame/douyinLaunch.ts',
  'minigame/ttWxShim.ts',
  'minigame/startupSplash.ts',
];

async function walkTsFiles(dir, base = dir) {
  const out = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkTsFiles(full, base)));
    } else if (ent.name.endsWith('.ts')) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

function sortFiles(files) {
  const pri = new Map(PRIORITY.map((p, i) => [p, i]));
  return [...files].sort((a, b) => {
    const pa = pri.get(a) ?? 1000;
    const pb = pri.get(b) ?? 1000;
    return pa !== pb ? pa - pb : a.localeCompare(b);
  });
}

async function loadLines(files) {
  const lines = [];
  for (const rel of files) {
    lines.push(`// 文件：src/${rel}`);
    const text = await fs.readFile(path.join(srcRoot, rel), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) {
        lines.push(line.replace(/\t/g, '  '));
      }
    }
  }
  return lines;
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderPages(lines, firstPage) {
  const pages = [];
  for (let p = 0; p < PAGES_EACH; p++) {
    const body = lines.slice(p * LINES_PER_PAGE, (p + 1) * LINES_PER_PAGE);
    if (!body.length) break;
    pages.push(
      `<section class="page"><header><span>${SOFTWARE_TITLE}</span><span>第 ${firstPage + p} 页</span></header>` +
        `<pre>${body.map(escapeHtml).join('\n')}</pre></section>`,
    );
  }
  return pages;
}

async function main() {
  const files = sortFiles(await walkTsFiles(srcRoot));
  const lines = await loadLines(files);
  const need = PAGES_EACH * LINES_PER_PAGE;
  const totalPages = Math.ceil(lines.length / LINES_PER_PAGE);

  const pages =
    lines.length <= need * 2
      ? renderPages(lines, 1)
      : [...renderPages(lines.slice(0, need), 1), ...renderPages(lines.slice(-need), PAGES_EACH + 1)];

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${SOFTWARE_TITLE} 源程序</title>
<style>
@page { size: A4; margin: 12mm 12mm 10mm; }
body { margin: 0; font-family: Menlo, "Courier New", "PingFang SC", monospace; }
.page { page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
header { display: flex; justify-content: space-between; font-size: 9pt; border-bottom: 0.5pt solid #000; padding-bottom: 2pt; margin-bottom: 4pt; }
pre { margin: 0; font-size: 8.8pt; line-height: 1.38; white-space: pre-wrap; word-break: break-all; }
</style></head><body>
${pages.join('\n')}
</body></html>`;

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outHtml, html, 'utf8');
  console.log(`源文件 ${files.length} 个，去空行后 ${lines.length} 行（约 ${totalPages} 页），输出 ${pages.length} 页`);
  console.log('HTML:', outHtml);

  if (existsSync(CHROME)) {
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${outPdf}`,
      pathToFileURL(outHtml).href,
    ], { stdio: 'ignore' });
    console.log('PDF :', outPdf);
  } else {
    console.log('未找到 Chrome：请用浏览器打开 HTML →「打印」→「存储为 PDF」，关闭页眉页脚。');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

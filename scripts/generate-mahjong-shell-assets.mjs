/**
 * 可选：从设计导出的中文文件名分面 PNG 同步到 shell_*.png（需自行放回 assets/main/mahjong）。
 * 用法：node scripts/generate-mahjong-shell-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/main/mahjong');

const pairs = [
  ['2_底面_88x40.png', 'shell_top_88x40.png'],
  ['2_底面_88x40.png', 'shell_bottom_88x40.png'],
  ['3_左侧_40x120.png', 'shell_left_40x120.png'],
  ['4_右侧_40x120.png', 'shell_right_40x120.png'],
  ['5_背面_88x120.png', 'shell_back_88x120.png'],
  ['1_正面_白玉_88x120.png', 'shell_front_white_88x120.png'],
  ['1_正面_88x120.png', 'shell_front_88x120.png'],
];

for (const [src, dst] of pairs) {
  const from = path.join(dir, src);
  const to = path.join(dir, dst);
  if (!fs.existsSync(from)) {
    console.warn('[skip]', src, 'missing');
    continue;
  }
  fs.copyFileSync(from, to);
  console.log('[ok]', dst);
}

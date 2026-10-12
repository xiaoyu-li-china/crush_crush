/**
 * 生成运营 Token、写入本地 .env.local，并输出云函数部署清单。
 * 用法：npm run mahjong:ops-setup
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bundledOps from '../src/config/mahjong-ops.json';
import cloudJson from '../src/config/cloud.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADMIN_DIR = path.join(ROOT, 'tools/mahjong-ops-admin');
const ENV_PATH = path.join(ADMIN_DIR, '.env.local');
const GENERATED = path.join(ADMIN_DIR, 'generated');

function randomToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

async function readExistingEnv(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const text = await fs.readFile(ENV_PATH, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      map.set(t.slice(0, i).trim(), t.slice(i + 1).trim());
    }
  } catch {
    // new file
  }
  return map;
}

async function main(): Promise<void> {
  const env = await readExistingEnv();
  let token = env.get('MAHJONG_OPS_ADMIN_TOKEN');
  if (!token || token.length < 8) {
    token = randomToken();
    env.set('MAHJONG_OPS_ADMIN_TOKEN', token);
  }
  const envId = cloudJson.envId ?? '';
  env.set('TCB_ENV_ID', envId);
  if (!env.get('MAHJONG_OPS_HTTP_URL')) {
    env.set('MAHJONG_OPS_HTTP_URL', '');
  }

  const envLines = [
    '# 本地运营后台用，勿提交 git',
    `# 生成时间 ${new Date().toISOString()}`,
    `TCB_ENV_ID=${envId}`,
    `MAHJONG_OPS_ADMIN_TOKEN=${token}`,
    'MAHJONG_OPS_HTTP_URL=',
    '# 在云开发控制台为 setMahjongOps 开启 HTTP 访问后，把触发 URL 填到上一行',
  ];
  await fs.mkdir(GENERATED, { recursive: true });
  await fs.writeFile(ENV_PATH, `${envLines.join('\n')}\n`, 'utf8');

  const callFunctionPayload = {
    adminToken: token,
    config: bundledOps,
  };
  await fs.writeFile(
    path.join(GENERATED, 'setMahjongOps-callFunction.json'),
    `${JSON.stringify(callFunctionPayload, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(GENERATED, 'initMahjongOps-callFunction.json'),
    `${JSON.stringify({ config: bundledOps }, null, 2)}\n`,
    'utf8',
  );

  const checklist = `
萌宠麻将馆 · 云配置部署清单（env: ${envId || '见 cloud.json'}）

Token 已写入: tools/mahjong-ops-admin/.env.local
callFunction 测试 JSON: tools/mahjong-ops-admin/generated/

【1】微信开发者工具
  - 打开本项目 → 云开发 → 云函数
  - 右键上传并部署（云端安装依赖）:
      initMahjongOps
      getMahjongOps
      setMahjongOps
  - 云函数 setMahjongOps → 配置 → 环境变量:
      MAHJONG_OPS_ADMIN_TOKEN = ${token}

【2】初始化云库（仅首次）
  - 云开发 → 云函数 → initMahjongOps → 测试
  - 参数可用 generated/initMahjongOps-callFunction.json

【3】开启 HTTP 一键发布
  - 云函数 setMahjongOps → HTTP 访问 / 云接入 → 开启
  - 复制触发 URL → 填入 .env.local 的 MAHJONG_OPS_HTTP_URL
  - 或填到可视化后台「HTTP 触发 URL」

【4】验证
  - npm run mahjong:ops-admin
  - 发布页 → 一键发布到云（HTTP）
  - 小游戏内拉配置：getMahjongOps（CDN 未配时）

【5】可选 CDN
  - 下载 JSON → 上传 opsConfigUrl，mahjong-cdn.json enabled=true
`;
  await fs.writeFile(path.join(GENERATED, 'DEPLOY-CHECKLIST.txt'), checklist.trimStart(), 'utf8');

  console.info(checklist);
  console.info('\n[mahjong:ops-setup] 完成。下一步: npm run mahjong:ops-admin');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

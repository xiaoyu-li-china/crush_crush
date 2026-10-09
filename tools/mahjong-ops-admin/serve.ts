/**
 * 萌宠麻将馆 · 运营配置可视化后台（本地）
 * 用法：npm run mahjong:ops-admin → http://127.0.0.1:8765
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAHJONG_BASE_SLOTS } from '../../src/logic/mahjong/MahjongConfig';
import { generateMahjongLevel, verifySolvablePile } from '../../src/logic/mahjong/MahjongGenerator';
import {
  applyMahjongOpsConfig,
  normalizeMahjongOps,
  resetMahjongOpsToBundled,
  shouldMahjongOpsSampleLevel,
  type MahjongOpsConfig,
} from '../../src/logic/mahjong/MahjongOpsConfig';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ADMIN_DIR = __dirname;
const ENV_LOCAL = path.join(ADMIN_DIR, '.env.local');
const PORT = Number(process.env.MAHJONG_OPS_ADMIN_PORT ?? 8765);

async function loadEnvLocal(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const text = await fs.readFile(ENV_LOCAL, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    // optional
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v != null && v.length > 0 && out[k] == null) {
      out[k] = v;
    }
  }
  return out;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function runSample(config: MahjongOpsConfig, maxLevel: number): Promise<{
  checked: number;
  failed: number;
  failures: { level: number; seed: number }[];
}> {
  resetMahjongOpsToBundled();
  applyMahjongOpsConfig(config, 'cdn');
  let checked = 0;
  let failed = 0;
  const failures: { level: number; seed: number }[] = [];
  const playerKey = 'admin-sample';
  for (let level = 1; level <= maxLevel; level += 1) {
    if (!shouldMahjongOpsSampleLevel(level)) {
      continue;
    }
    checked += 1;
    const gen = generateMahjongLevel(level, playerKey);
    if (!verifySolvablePile(gen.pile, MAHJONG_BASE_SLOTS)) {
      failed += 1;
      failures.push({ level, seed: gen.seed });
    }
  }
  resetMahjongOpsToBundled();
  return { checked, failed, failures: failures.slice(0, 30) };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/setup-status') {
    const envLocal = await loadEnvLocal();
    let checklist = '';
    try {
      checklist = await fs.readFile(
        path.join(ADMIN_DIR, 'generated/DEPLOY-CHECKLIST.txt'),
        'utf8',
      );
    } catch {
      checklist = '请先运行: npm run mahjong:ops-setup';
    }
    json(res, 200, {
      hasEnvLocal: Object.keys(envLocal).length > 0,
      envId: envLocal.TCB_ENV_ID ?? '',
      httpUrl: envLocal.MAHJONG_OPS_HTTP_URL ?? '',
      hasAdminToken: (envLocal.MAHJONG_OPS_ADMIN_TOKEN ?? '').length >= 8,
      checklist,
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/meta') {
    const opsPath = path.join(ROOT, 'src/config/mahjong-ops.json');
    const themesPath = path.join(ROOT, 'src/config/mahjong-themes.json');
    const cloudPath = path.join(ROOT, 'src/config/cloud.json');
    const envLocal = await loadEnvLocal();
    const [opsRaw, themesRaw, cloudRaw] = await Promise.all([
      fs.readFile(opsPath, 'utf8'),
      fs.readFile(themesPath, 'utf8'),
      fs.readFile(cloudPath, 'utf8').catch(() => '{}'),
    ]);
    const ops = normalizeMahjongOps(JSON.parse(opsRaw) as Partial<MahjongOpsConfig>);
    const themes = JSON.parse(themesRaw) as { themes?: { themeId: string; name: string }[] };
    const cloud = JSON.parse(cloudRaw) as { envId?: string };
    json(res, 200, {
      defaults: ops,
      themeOptions: (themes.themes ?? []).map((t) => ({ id: t.themeId, name: t.name })),
      cloudEnvId: cloud.envId ?? envLocal.TCB_ENV_ID ?? '',
      adminTokenPrefill: envLocal.MAHJONG_OPS_ADMIN_TOKEN ?? '',
      httpPublishUrlPrefill: envLocal.MAHJONG_OPS_HTTP_URL ?? '',
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/save-http-url') {
    try {
      const body = JSON.parse(await readBody(req)) as { httpUrl?: string };
      const httpUrl = (body.httpUrl ?? '').trim();
      const envLocal = await loadEnvLocal();
      const lines = [
        '# 本地运营后台用，勿提交 git',
        `TCB_ENV_ID=${envLocal.TCB_ENV_ID ?? ''}`,
        `MAHJONG_OPS_ADMIN_TOKEN=${envLocal.MAHJONG_OPS_ADMIN_TOKEN ?? ''}`,
        `MAHJONG_OPS_HTTP_URL=${httpUrl}`,
      ];
      await fs.writeFile(ENV_LOCAL, `${lines.join('\n')}\n`, 'utf8');
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 400, { ok: false, error: String(e) });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/normalize') {
    try {
      const raw = JSON.parse(await readBody(req)) as Partial<MahjongOpsConfig>;
      json(res, 200, { ok: true, config: normalizeMahjongOps(raw) });
    } catch (e) {
      json(res, 400, { ok: false, error: String(e) });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/sample') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        config: Partial<MahjongOpsConfig>;
        maxLevel?: number;
      };
      const config = normalizeMahjongOps(body.config);
      const maxLevel = Math.min(10_000, Math.max(1, Math.floor(body.maxLevel ?? 3000)));
      const result = await runSample(config, maxLevel);
      json(res, 200, { ok: true, maxLevel, ...result });
    } catch (e) {
      json(res, 400, { ok: false, error: String(e) });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/publish-cloud') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        httpUrl: string;
        adminToken: string;
        config: Partial<MahjongOpsConfig>;
      };
      const httpUrl = (body.httpUrl ?? '').trim();
      const adminToken = body.adminToken ?? '';
      if (httpUrl.length === 0) {
        json(res, 400, { ok: false, error: 'missing_httpUrl' });
        return;
      }
      if (adminToken.length < 8) {
        json(res, 400, { ok: false, error: 'adminToken_too_short' });
        return;
      }
      const config = normalizeMahjongOps(body.config);
      const upstream = await fetch(httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ config }),
      });
      const text = await upstream.text();
      let result: unknown = text;
      try {
        result = JSON.parse(text);
      } catch {
        // plain text
      }
      if (!upstream.ok) {
        json(res, 502, { ok: false, status: upstream.status, result });
        return;
      }
      json(res, 200, { ok: true, status: upstream.status, result });
    } catch (e) {
      json(res, 400, { ok: false, error: String(e) });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/write-bundled') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        config: Partial<MahjongOpsConfig>;
        confirm?: boolean;
      };
      if (body.confirm !== true) {
        json(res, 400, { ok: false, error: '需要 confirm: true' });
        return;
      }
      const config = normalizeMahjongOps(body.config);
      const outPath = path.join(ROOT, 'src/config/mahjong-ops.json');
      const payload = {
        ...config,
        _comment: '运维可通过 CDN opsConfigUrl 或云库 mahjong_ops/config 热更新；客户端合并后以 version 为准。',
      };
      await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      json(res, 200, { ok: true, path: outPath });
    } catch (e) {
      json(res, 400, { ok: false, error: String(e) });
    }
    return;
  }

  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(ADMIN_DIR, filePath);
  if (!abs.startsWith(ADMIN_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(abs);
    const ext = path.extname(abs);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.info(`[mahjong-ops-admin] http://127.0.0.1:${PORT}`);
});

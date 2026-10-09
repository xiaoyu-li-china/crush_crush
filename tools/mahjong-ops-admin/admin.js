const STORAGE_TOKEN = 'mahjong.ops.adminToken';
const STORAGE_HTTP_URL = 'mahjong.ops.httpPublishUrl';

/** @typedef {import('../../src/logic/mahjong/MahjongOpsConfig').MahjongOpsConfig} MahjongOpsConfig */

/** @type {MahjongOpsConfig} */
let config = null;
/** @type {{ id: string; name: string }[]} */
let themeOptions = [];

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

function emptyConfig() {
  return {
    version: 1,
    economy: { coinCost: 100, coinPerTriple: 1, starPerTriple: 1 },
    session: { timeoutSec: 720 },
    generation: {
      seedVersion: 1,
      maxAttempts: 16,
      level1Tiles: 9,
      standardTiles: 105,
      typeCountLevel2: 6,
      typeCountFromLevel3: { min: 6, maxInclusive: 8 },
    },
    theme: {
      level1ThemeId: 'default',
      level2ThemeId: 'default',
      cycleAfterLevel: 3000,
      sequentialFromLevel3: false,
    },
    levelOverrides: [],
    sampling: { enabled: true, everyNLevels: 50 },
    ads: { rewardedVideoSlot: true },
    tools: { freeToUse: true },
  };
}

function configFromForm() {
  const overrides = [];
  $('overrides-body').querySelectorAll('tr').forEach((row) => {
    const level = Number(row.querySelector('[data-f="level"]')?.value);
    if (!Number.isFinite(level) || level < 1) return;
    const themeId = row.querySelector('[data-f="themeId"]')?.value;
    const typeRaw = row.querySelector('[data-f="typeCount"]')?.value;
    const timeoutRaw = row.querySelector('[data-f="timeoutSec"]')?.value;
    const note = row.querySelector('[data-f="note"]')?.value?.trim();
    /** @type {import('../../src/logic/mahjong/MahjongOpsConfig').MahjongLevelOverride} */
    const o = { level: Math.floor(level) };
    if (themeId) o.themeId = themeId;
    if (typeRaw !== '' && typeRaw != null) o.typeCount = Number(typeRaw);
    if (timeoutRaw !== '' && timeoutRaw != null) o.timeoutSec = Number(timeoutRaw);
    if (note) o.note = note;
    overrides.push(o);
  });
  overrides.sort((a, b) => a.level - b.level);

  return {
    version: Number($('f-version').value),
    economy: {
      coinCost: Number($('f-coinCost').value),
      coinPerTriple: Number($('f-coinPerTriple').value),
      starPerTriple: Number($('f-starPerTriple').value),
    },
    session: { timeoutSec: Number($('f-timeoutSec').value) },
    generation: {
      seedVersion: Number($('f-seedVersion').value),
      maxAttempts: Number($('f-maxAttempts').value),
      level1Tiles: Number($('f-level1Tiles').value),
      standardTiles: Number($('f-standardTiles').value),
      typeCountLevel2: Number($('f-typeCountLevel2').value),
      typeCountFromLevel3: {
        min: Number($('f-typeMin').value),
        maxInclusive: Number($('f-typeMax').value),
      },
    },
    theme: {
      level1ThemeId: $('f-level1ThemeId').value,
      level2ThemeId: $('f-level2ThemeId').value,
      cycleAfterLevel: Number($('f-cycleAfterLevel').value),
      sequentialFromLevel3: $('f-sequentialFromLevel3').checked,
    },
    levelOverrides: overrides,
    sampling: {
      enabled: $('f-samplingEnabled').checked,
      everyNLevels: Number($('f-everyNLevels').value),
    },
    ads: { rewardedVideoSlot: $('f-rewardedVideoSlot').checked },
    tools: { freeToUse: $('f-freeToUse').checked },
  };
}

function fillThemeSelects() {
  for (const id of ['f-level1ThemeId', 'f-level2ThemeId']) {
    const sel = $(id);
    sel.innerHTML = '';
    for (const t of themeOptions) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.id})`;
      sel.appendChild(opt);
    }
  }
}

function themeSelectHtml(selected) {
  const opts = themeOptions
    .map(
      (t) =>
        `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${t.name}</option>`,
    )
    .join('');
  return `<select data-f="themeId"><option value="">—</option>${opts}</select>`;
}

function renderOverrides() {
  const body = $('overrides-body');
  body.innerHTML = '';
  for (const o of config.levelOverrides) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="mini" type="number" data-f="level" min="1" value="${o.level}" /></td>
      <td>${themeSelectHtml(o.themeId ?? '')}</td>
      <td><input class="mini" type="number" data-f="typeCount" min="3" max="20" value="${o.typeCount ?? ''}" placeholder="—" /></td>
      <td><input class="mini" type="number" data-f="timeoutSec" min="60" value="${o.timeoutSec ?? ''}" placeholder="—" /></td>
      <td><input type="text" data-f="note" value="${o.note ?? ''}" placeholder="备注" /></td>
      <td><button type="button" class="btn ghost row-del">删</button></td>
    `;
    tr.querySelector('.row-del')?.addEventListener('click', () => {
      tr.remove();
      syncJsonPreview();
    });
    tr.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('change', () => syncJsonPreview());
    });
    body.appendChild(tr);
  }
}

function formFromConfig(c) {
  config = c;
  $('f-version').value = String(c.version);
  $('f-coinCost').value = String(c.economy.coinCost);
  $('f-coinPerTriple').value = String(c.economy.coinPerTriple);
  $('f-starPerTriple').value = String(c.economy.starPerTriple);
  $('f-timeoutSec').value = String(c.session.timeoutSec);
  $('f-seedVersion').value = String(c.generation.seedVersion);
  $('f-maxAttempts').value = String(c.generation.maxAttempts);
  $('f-level1Tiles').value = String(c.generation.level1Tiles);
  $('f-standardTiles').value = String(c.generation.standardTiles);
  $('f-typeCountLevel2').value = String(c.generation.typeCountLevel2);
  $('f-typeMin').value = String(c.generation.typeCountFromLevel3.min);
  $('f-typeMax').value = String(c.generation.typeCountFromLevel3.maxInclusive);
  $('f-level1ThemeId').value = c.theme.level1ThemeId;
  $('f-level2ThemeId').value = c.theme.level2ThemeId;
  $('f-cycleAfterLevel').value = String(c.theme.cycleAfterLevel);
  $('f-sequentialFromLevel3').checked = c.theme.sequentialFromLevel3;
  $('f-samplingEnabled').checked = c.sampling.enabled;
  $('f-everyNLevels').value = String(c.sampling.everyNLevels);
  $('f-rewardedVideoSlot').checked = c.ads.rewardedVideoSlot;
  $('f-freeToUse').checked = c.tools.freeToUse;
  renderOverrides();
  syncJsonPreview();
}

function syncJsonPreview() {
  const raw = configFromForm();
  $('json-preview').value = JSON.stringify(raw, null, 2);
}

async function apiNormalize(raw) {
  const res = await fetch('/api/normalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(raw),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'normalize failed');
  return data.config;
}

async function refreshSetupChecklist() {
  const res = await fetch('/api/setup-status');
  const data = await res.json();
  const flags = [
    data.hasEnvLocal ? '✓ .env.local 已生成' : '✗ 请运行 npm run mahjong:ops-setup',
    data.hasAdminToken ? '✓ Admin Token 已配置' : '✗ 缺少 Token',
    data.httpUrl ? '✓ HTTP URL 已写入 .env.local' : '○ 待填 MAHJONG_OPS_HTTP_URL（控制台开启 HTTP 后）',
  ].join('\n');
  $('setup-checklist').textContent = `${flags}\n\n${data.checklist || ''}`;
}

async function loadMeta() {
  const res = await fetch('/api/meta');
  const data = await res.json();
  themeOptions = data.themeOptions?.length ? data.themeOptions : [{ id: 'default', name: '默认' }];
  $('f-cloudEnv').value = data.cloudEnvId || '';
  fillThemeSelects();
  formFromConfig(data.defaults);
  const saved = localStorage.getItem(STORAGE_TOKEN);
  const token = saved || data.adminTokenPrefill || '';
  if (token) $('f-adminToken').value = token;
  const httpUrl = localStorage.getItem(STORAGE_HTTP_URL) || data.httpPublishUrlPrefill || '';
  if (httpUrl) $('f-httpPublishUrl').value = httpUrl;
  await refreshSetupChecklist();
}

function downloadJson(obj) {
  const blob = new Blob([`${JSON.stringify(obj, null, 2)}\n`], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mahjong-ops-v${obj.version}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function setupNav() {
  document.querySelectorAll('.nav').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`panel-${btn.dataset.panel}`).classList.add('active');
    });
  });
}

function bindEvents() {
  document.querySelectorAll('input, select').forEach((el) => {
    if (el.id === 'f-adminToken' || el.id === 'f-cloudEnv') return;
    el.addEventListener('change', () => syncJsonPreview());
  });

  $('btn-reload-defaults').addEventListener('click', () => loadMeta().then(() => toast('已载入包内默认')));

  $('btn-run-setup-hint').addEventListener('click', () =>
    refreshSetupChecklist().then(() => toast('已刷新')),
  );

  $('btn-open-publish').addEventListener('click', () => {
    document.querySelector('.nav[data-panel="publish"]')?.click();
  });

  $('file-import').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const normalized = await apiNormalize(raw);
      formFromConfig(normalized);
      toast('导入并已归一化');
    } catch (e) {
      toast(`导入失败: ${e.message}`);
    }
    ev.target.value = '';
  });

  $('btn-normalize').addEventListener('click', async () => {
    try {
      const normalized = await apiNormalize(configFromForm());
      formFromConfig(normalized);
      toast('校验通过，已归一化');
    } catch (e) {
      toast(`失败: ${e.message}`);
    }
  });

  $('btn-sample').addEventListener('click', async () => {
    $('sample-result').textContent = '抽检运行中…';
    try {
      const normalized = await apiNormalize(configFromForm());
      const res = await fetch('/api/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: normalized, maxLevel: 3000 }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      $('sample-result').textContent = `关卡 1…${data.maxLevel}：抽检 ${data.checked} 关，失败 ${data.failed} 关${
        data.failures?.length ? `\n${JSON.stringify(data.failures, null, 2)}` : ''
      }`;
      toast(data.failed ? '抽检有失败' : '抽检全部通过');
    } catch (e) {
      $('sample-result').textContent = String(e.message);
      toast('抽检失败');
    }
  });

  $('btn-download').addEventListener('click', async () => {
    try {
      const normalized = await apiNormalize(configFromForm());
      formFromConfig(normalized);
      downloadJson(normalized);
      toast('已下载 JSON');
    } catch (e) {
      toast(`下载前校验失败: ${e.message}`);
    }
  });

  $('btn-apply-json').addEventListener('click', async () => {
    try {
      const raw = JSON.parse($('json-preview').value);
      const normalized = await apiNormalize(raw);
      formFromConfig(normalized);
      toast('已从 JSON 应用');
    } catch (e) {
      toast(`JSON 无效: ${e.message}`);
    }
  });

  $('btn-add-override').addEventListener('click', () => {
    config.levelOverrides.push({ level: 50, note: '运营关' });
    renderOverrides();
    syncJsonPreview();
  });

  $('f-adminToken').addEventListener('change', () => {
    localStorage.setItem(STORAGE_TOKEN, $('f-adminToken').value);
  });

  $('f-httpPublishUrl').addEventListener('change', async () => {
    const url = $('f-httpPublishUrl').value.trim();
    localStorage.setItem(STORAGE_HTTP_URL, url);
    if (url.length > 0) {
      await fetch('/api/save-http-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ httpUrl: url }),
      }).catch(() => {});
    }
  });

  $('btn-publish-cloud').addEventListener('click', async () => {
    $('publish-result').textContent = '发布中…';
    try {
      const normalized = await apiNormalize(configFromForm());
      formFromConfig(normalized);
      const httpUrl = $('f-httpPublishUrl').value.trim();
      const adminToken = $('f-adminToken').value;
      const res = await fetch('/api/publish-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ httpUrl, adminToken, config: normalized }),
      });
      const data = await res.json();
      $('publish-result').textContent = JSON.stringify(data, null, 2);
      if (data.ok) {
        toast('云配置已更新');
      } else {
        toast(data.error || '发布失败');
      }
    } catch (e) {
      $('publish-result').textContent = String(e.message);
      toast('发布失败');
    }
  });

  $('btn-copy-cloud').addEventListener('click', async () => {
    try {
      const normalized = await apiNormalize(configFromForm());
      const token = $('f-adminToken').value;
      const payload = { adminToken: token, config: normalized };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast('已复制 setMahjongOps 测试参数');
    } catch (e) {
      toast(`复制失败: ${e.message}`);
    }
  });

  $('btn-write-bundled').addEventListener('click', async () => {
    if (!window.confirm('确认写回 src/config/mahjong-ops.json？')) return;
    try {
      const normalized = await apiNormalize(configFromForm());
      const res = await fetch('/api/write-bundled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: normalized, confirm: true }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast('已写回包内配置');
    } catch (e) {
      toast(`写回失败: ${e.message}`);
    }
  });
}

setupNav();
bindEvents();
loadMeta().catch((e) => toast(String(e.message)));

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTION = 'mahjong_ops';
const DOC_ID = 'config';

function parseIncomingEvent(event) {
  if (event && event.httpMethod) {
    const headers = event.headers || {};
    const authRaw = headers.authorization || headers.Authorization || '';
    const bearer = typeof authRaw === 'string' ? authRaw.replace(/^Bearer\s+/i, '').trim() : '';
    let body = event.body;
    if (event.isBase64Encoded && typeof body === 'string') {
      body = Buffer.from(body, 'base64').toString('utf8');
    }
    let parsed = {};
    if (typeof body === 'string' && body.length > 0) {
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = {};
      }
    } else if (body && typeof body === 'object') {
      parsed = body;
    }
    return {
      isHttp: true,
      adminToken: bearer || parsed.adminToken,
      config: parsed.config,
    };
  }
  return {
    isHttp: false,
    adminToken: event && event.adminToken,
    config: event && event.config,
  };
}

function httpResponse(payload, statusCode) {
  return {
    statusCode: statusCode || (payload.ok ? 200 : 400),
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  };
}

exports.main = async (event) => {
  const incoming = parseIncomingEvent(event || {});
  const expected = process.env.MAHJONG_OPS_ADMIN_TOKEN;
  const token = incoming.adminToken;
  if (!expected || typeof expected !== 'string' || expected.length < 8) {
    const out = { ok: false, reason: 'server_token_not_configured' };
    return incoming.isHttp ? httpResponse(out, 503) : out;
  }
  if (token !== expected) {
    const out = { ok: false, reason: 'unauthorized' };
    return incoming.isHttp ? httpResponse(out, 401) : out;
  }
  const config = incoming.config;
  if (!config || typeof config !== 'object') {
    const out = { ok: false, reason: 'missing_config' };
    return incoming.isHttp ? httpResponse(out, 400) : out;
  }
  const db = cloud.database();
  const now = Date.now();
  try {
    await db.createCollection(COLLECTION);
  } catch {
    // exists
  }
  try {
    await db.collection(COLLECTION).doc(DOC_ID).set({
      data: {
        config,
        updatedAt: now,
        updatedBy: 'setMahjongOps',
      },
    });
    const out = {
      ok: true,
      version: config.version ?? 1,
      updatedAt: now,
    };
    return incoming.isHttp ? httpResponse(out, 200) : out;
  } catch (err) {
    const out = {
      ok: false,
      reason: String((err && (err.errMsg || err.message)) || err),
    };
    return incoming.isHttp ? httpResponse(out, 500) : out;
  }
};

/*
 * Team Desk — code shared by the personal server (server.js) and the
 * central multi-user server (central.js). No third-party dependencies.
 */
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const APP_DIR = path.join(ROOT, 'app');
const MAGIC = Buffer.from('TDE1');
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1 };

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (s, m) => { throw new HttpError(s, m); };
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localTime = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;

/* ---------------------------------------------------------- crypto */
function deriveKey(password, salt, params = SCRYPT_PARAMS, len = 32) {
  return new Promise((res, rej) => crypto.scrypt(String(password).normalize('NFKC'), salt, len,
    { N: params.N, r: params.r, p: params.p, maxmem: 256 * 1024 * 1024 }, (e, k) => e ? rej(e) : res(k)));
}
/* file format: 'TDE1' | 12-byte IV | 16-byte GCM tag | ciphertext */
function encryptWith(k, buf) {
  if (!k) fail(423, 'locked');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]);
}
function decryptWith(k, buf) {
  if (!k) fail(423, 'locked');
  if (buf.length < 32 || !buf.subarray(0, 4).equals(MAGIC)) fail(500, 'File is not a Team Desk encrypted file');
  const d = crypto.createDecipheriv('aes-256-gcm', k, buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  return Buffer.concat([d.update(buf.subarray(32)), d.final()]);
}
/* attachment = [4-byte meta length][meta JSON][raw bytes] */
function packFile(meta, data) { const m = Buffer.from(JSON.stringify(meta)); const h = Buffer.alloc(4); h.writeUInt32BE(m.length); return Buffer.concat([h, m, data]); }
function unpackFile(buf) { const n = buf.readUInt32BE(0); return { meta: JSON.parse(buf.subarray(4, 4 + n).toString()), data: buf.subarray(4 + n) }; }

async function writeAtomic(file, buf, mode) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${crypto.randomBytes(4).toString('hex')}`;
  await fsp.writeFile(tmp, buf, mode ? { mode } : undefined);
  await fsp.rename(tmp, file);
}
async function listTde(dir) { try { return (await fsp.readdir(dir)).filter(f => f.endsWith('.tde')); } catch { return []; } }

/* ---------------------------------------------------------- HTTP helpers */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(new HttpError(413, 'That is too large to save.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function sendJSON(res, status, obj, headers = {}) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(b);
}
function sendFile(res, meta, data) {
  res.writeHead(200, { 'Content-Type': meta.type || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}` });
  res.end(data);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.map': 'application/json' };
/* file readers are served from node_modules after `npm install`; otherwise the browser fetches them from these CDNs */
const CDNS = 'https://cdn.jsdelivr.net https://cdn.sheetjs.com';
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-cache',
  'Cross-Origin-Opener-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline' ${CDNS}; worker-src 'self' blob: ${CDNS}; ` +
    `style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ${CDNS}; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
};
/* optional libraries served from node_modules when `npm install` has been run (otherwise the browser uses the CDNs above) */
const VENDOR = {
  'pdf.min.mjs': ['pdfjs-dist', 'build', 'pdf.min.mjs'],
  'pdf.worker.min.mjs': ['pdfjs-dist', 'build', 'pdf.worker.min.mjs'],
  'mammoth.browser.min.js': ['mammoth', 'mammoth.browser.min.js'],
  'xlsx.full.min.js': ['xlsx', 'dist', 'xlsx.full.min.js'],
};
/* serves the browser app; `inject(html)` fills the placeholders in index.html */
async function serveStatic(req, res, url, inject, extraHeaders = {}) {
  if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Method not allowed');
  let file;
  if (url.pathname.startsWith('/vendor/')) {
    const v = VENDOR[path.basename(url.pathname)];
    file = v && path.join(ROOT, 'node_modules', ...v);
    if (!file || !exists(file)) fail(404, 'Not installed');
  } else {
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { fail(400, 'Bad path'); }
    rel = rel === '/' ? 'index.html' : rel.replace(/^\/+/, '');
    file = path.resolve(APP_DIR, rel);
    if (!file.startsWith(APP_DIR + path.sep)) fail(403, 'Forbidden');
    if (!exists(file) || fs.statSync(file).isDirectory()) fail(404, 'Not found');
  }
  let data = await fsp.readFile(file);
  if (path.basename(file) === 'index.html') data = Buffer.from(inject(data.toString()));
  res.writeHead(200, { ...SEC_HEADERS, ...extraHeaders, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': data.length });
  res.end(req.method === 'HEAD' ? undefined : data);
}

/* tiny router: route(method, '/api/x/:id', handler, opts) */
function makeRouter(defaults) {
  const routes = [];
  const route = (method, pattern, handler, opts = {}) =>
    routes.push({ method, rx: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, ...defaults, ...opts });
  const match = (method, pathname) => {
    const r = routes.find(x => x.method === method && x.rx.test(pathname));
    if (!r) return null;
    const g = pathname.match(r.rx).groups || {};
    const params = {};
    for (const [k, v] of Object.entries(g)) { try { params[k] = decodeURIComponent(v); } catch { fail(400, 'Bad path'); } }
    return { r, params };
  };
  return { route, match, routes };
}

/* ---------------------------------------------------------- local AI (Ollama) */
const AI_DEFAULT_URL = 'http://127.0.0.1:11434';
function loopbackUrl(u) {
  let x; try { x = new URL(String(u)); } catch { fail(400, 'Invalid AI address'); }
  if (!['http:', 'https:'].includes(x.protocol) || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(x.hostname))
    fail(400, 'For privacy, the AI address must be on this machine (localhost / 127.0.0.1).');
  return x.origin;
}
async function ollama(base, pathname, body, timeoutMs) {
  const r = await fetch(base + pathname, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) { let m = `${r.status}`; try { m = (await r.json()).error || m; } catch {} throw new HttpError(502, `Local AI error: ${m}`); }
  return r.json();
}
async function aiStatus(cfg) {
  try {
    const t = await ollama(cfg.url, '/api/tags', null, 2500);
    return { ...cfg, available: true, models: (t.models || []).map(m => ({ name: m.name, size: m.size, family: m.details?.family || '', params: m.details?.parameter_size || '' })) };
  } catch (e) { return { ...cfg, available: false, models: [], error: e.name === 'TimeoutError' ? 'Ollama did not respond' : 'Ollama is not running on this machine' }; }
}
async function aiChat(cfg, body) {
  if (!cfg.enabled || !cfg.model) fail(409, 'Local AI is turned off. Turn it on in Settings › AI assistant.');
  const sys = String(body.system || '').slice(0, 8000), prompt = String(body.prompt || '').slice(0, 24000);
  const t0 = Date.now();
  let out;
  try {
    out = await ollama(cfg.url, '/api/chat', { model: cfg.model, stream: false, format: 'json', keep_alive: '10m', options: { temperature: 0.2, num_ctx: 8192 },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }] }, 240000);
  } catch (e) { if (e.status) throw e; fail(502, e.name === 'TimeoutError' ? 'The local AI took too long to answer. Try a smaller model.' : 'Could not reach Ollama. Is it running?'); }
  return { content: out.message?.content || '', model: cfg.model, ms: Date.now() - t0 };
}

module.exports = {
  ROOT, APP_DIR, MAGIC, SCRYPT_PARAMS, HttpError, fail, readJSON, exists, localDay, localTime,
  deriveKey, encryptWith, decryptWith, packFile, unpackFile, writeAtomic, listTde,
  readBody, sendJSON, sendFile, MIME, SEC_HEADERS, VENDOR, serveStatic, makeRouter,
  AI_DEFAULT_URL, loopbackUrl, ollama, aiStatus, aiChat,
};

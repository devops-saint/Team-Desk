#!/usr/bin/env node
/*
 * Team Desk — local server
 * ------------------------------------------------------------
 * Serves the Team Desk web app on http://localhost and stores all
 * data, encrypted, in a folder the manager chooses at first launch.
 *
 * - No third-party dependencies. Needs Node.js 18 or newer.
 * - Listens on 127.0.0.1 only; requests must carry a per-run token
 *   and a localhost Host header (blocks other websites and DNS rebinding).
 * - Data is encrypted with AES-256-GCM; the key is derived from the
 *   manager's password with scrypt and kept in memory only while unlocked.
 * - One encrypted file per reportee, attachments stored per reportee.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const VERSION = '3.1.0';
const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const NO_OPEN = args.includes('--no-open') || process.env.TEAMDESK_NO_OPEN === '1';
const BASE_PORT = parseInt(argVal('--port', process.env.TEAMDESK_PORT || '4317'), 10);
const CONFIG_DIR = process.env.TEAMDESK_CONFIG_DIR || path.join(os.homedir(), '.teamdesk');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const TOKEN = crypto.randomBytes(24).toString('hex');
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1 };
const MAGIC = Buffer.from('TDE1');
const VERIFY = Buffer.from('teamdesk-vault-ok');
const ID_RX = /^[A-Za-z0-9_-]{1,80}$/;
const JSON_LIMIT = 25 * 1024 * 1024;
const FILE_LIMIT = 60 * 1024 * 1024;
const KEEP_DAILY = 30, KEEP_MANUAL = 20;

let PORT = BASE_PORT;
let ALLOWED_HOSTS = new Set();
let config = readJSON(CONFIG_FILE) || {};
let key = null;
let lastActivity = Date.now();
let failures = 0, blockedUntil = 0;
let snapshotDay = null;

/* ---------------------------------------------------------- helpers */
function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function saveConfig() { fs.mkdirSync(CONFIG_DIR, { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); }
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (s, m) => { throw new HttpError(s, m); };
const checkId = id => { if (!ID_RX.test(String(id || ''))) fail(400, 'Invalid id'); return String(id); };
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localTime = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };

/* ---------------------------------------------------------- crypto */
function deriveKey(password, salt, params = SCRYPT_PARAMS) {
  return new Promise((res, rej) => crypto.scrypt(String(password).normalize('NFKC'), salt, 32,
    { N: params.N, r: params.r, p: params.p, maxmem: 256 * 1024 * 1024 }, (e, k) => e ? rej(e) : res(k)));
}
function encrypt(buf, k = key) {
  if (!k) fail(423, 'locked');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]);
}
function decrypt(buf, k = key) {
  if (!k) fail(423, 'locked');
  if (buf.length < 32 || !buf.subarray(0, 4).equals(MAGIC)) fail(500, 'File is not a Team Desk encrypted file');
  const d = crypto.createDecipheriv('aes-256-gcm', k, buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  return Buffer.concat([d.update(buf.subarray(32)), d.final()]);
}
/* attachment = [4-byte meta length][meta JSON][raw bytes] */
function packFile(meta, data) { const m = Buffer.from(JSON.stringify(meta)); const h = Buffer.alloc(4); h.writeUInt32BE(m.length); return Buffer.concat([h, m, data]); }
function unpackFile(buf) { const n = buf.readUInt32BE(0); return { meta: JSON.parse(buf.subarray(4, 4 + n).toString()), data: buf.subarray(4 + n) }; }

/* ---------------------------------------------------------- data folder layout */
const dataDir = () => config.dataDir;
const P = {
  vault: (d = dataDir()) => path.join(d, 'vault.json'),
  org: (d = dataDir()) => path.join(d, 'org.tde'),
  reps: (d = dataDir()) => path.join(d, 'reportees'),
  rep: id => path.join(dataDir(), 'reportees', checkId(id) + '.tde'),
  files: (d = dataDir()) => path.join(d, 'files'),
  fileDir: owner => path.join(dataDir(), 'files', checkId(owner)),
  file: (owner, id) => path.join(dataDir(), 'files', checkId(owner), checkId(id) + '.tde'),
  backups: (d = dataDir()) => path.join(d, 'backups'),
};
const isVault = d => !!d && exists(P.vault(d));
const configured = () => isVault(dataDir());
const README_TXT = `TEAM DESK DATA FOLDER
=====================
This folder holds your Team Desk data. Everything here is encrypted with your
Team Desk password and can only be opened by the Team Desk app.

  vault.json        password check and encryption settings (no data)
  org.tde           settings, competency framework, roles, guidelines, your leadership notes
  reportees/        one encrypted file per reportee
  files/            uploaded documents, stored per reportee
  backups/          automatic daily snapshots (last ${KEEP_DAILY} days)

Do not edit or rename files here. To move the data, use Settings > Data & backups
in Team Desk. If you forget the password, the data cannot be recovered.
`;

async function writeAtomic(file, buf) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${crypto.randomBytes(4).toString('hex')}`;
  await fsp.writeFile(tmp, buf);
  await fsp.rename(tmp, file);
}
async function writeEnc(file, buf) { await maybeSnapshot(); await writeAtomic(file, encrypt(buf)); }
async function listTde(dir) { try { return (await fsp.readdir(dir)).filter(f => f.endsWith('.tde')); } catch { return []; } }

/* ---------------------------------------------------------- vault */
async function createVault(dir, password) {
  const salt = crypto.randomBytes(16);
  const k = await deriveKey(password, salt);
  const vault = { app: 'teamdesk', format: 1, created: new Date().toISOString(),
    kdf: { name: 'scrypt', ...SCRYPT_PARAMS, salt: salt.toString('base64') }, check: encrypt(VERIFY, k).toString('base64') };
  await fsp.mkdir(dir, { recursive: true });
  for (const sub of ['reportees', 'files', 'backups']) await fsp.mkdir(path.join(dir, sub), { recursive: true });
  await writeAtomic(P.vault(dir), Buffer.from(JSON.stringify(vault, null, 2)));
  await fsp.writeFile(path.join(dir, 'README.txt'), README_TXT);
  return k;
}
async function openVault(dir, password) {
  const v = readJSON(P.vault(dir));
  if (!v || v.app !== 'teamdesk') fail(400, 'No Team Desk data found in that folder.');
  const k = await deriveKey(password, Buffer.from(v.kdf.salt, 'base64'), v.kdf);
  try { if (!decrypt(Buffer.from(v.check, 'base64'), k).equals(VERIFY)) return null; } catch { return null; }
  return k;
}
function checkRate() {
  if (Date.now() < blockedUntil) fail(429, `Too many attempts. Try again in ${Math.ceil((blockedUntil - Date.now()) / 1000)} seconds.`);
}
function noteFailure() {
  failures++;
  if (failures >= 5) blockedUntil = Date.now() + Math.min(300, 15 * 2 ** (failures - 5)) * 1000;
  fail(403, 'Incorrect password.');
}

/* ---------------------------------------------------------- snapshots */
async function snapshot(name) {
  const dst = path.join(P.backups(), name);
  await fsp.mkdir(path.join(dst, 'reportees'), { recursive: true });
  await fsp.copyFile(P.vault(), path.join(dst, 'vault.json'));
  if (exists(P.org())) await fsp.copyFile(P.org(), path.join(dst, 'org.tde'));
  for (const f of await listTde(P.reps())) await fsp.copyFile(path.join(P.reps(), f), path.join(dst, 'reportees', f));
  await prune();
}
async function maybeSnapshot() {
  const day = localDay();
  if (snapshotDay === day || !exists(P.org())) return;
  snapshotDay = day;
  if (exists(path.join(P.backups(), day))) return;
  try { await snapshot(day); } catch (e) { console.error('Snapshot failed:', e.message); }
}
async function prune() {
  const all = (await fsp.readdir(P.backups()).catch(() => [])).sort();
  const daily = all.filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)), manual = all.filter(n => !/^\d{4}-\d{2}-\d{2}$/.test(n));
  for (const n of [...daily.slice(0, Math.max(0, daily.length - KEEP_DAILY)), ...manual.slice(0, Math.max(0, manual.length - KEEP_MANUAL))])
    await fsp.rm(path.join(P.backups(), n), { recursive: true, force: true });
}
async function listBackups() {
  const names = (await fsp.readdir(P.backups()).catch(() => [])).filter(n => exists(path.join(P.backups(), n, 'vault.json'))).sort().reverse();
  const cur = readJSON(P.vault());
  return Promise.all(names.map(async n => {
    const v = readJSON(path.join(P.backups(), n, 'vault.json'));
    return { name: n, reportees: (await listTde(path.join(P.backups(), n, 'reportees'))).length, samePassword: !!v && v.kdf.salt === cur.kdf.salt,
      kind: /^\d{4}-\d{2}-\d{2}$/.test(n) ? 'Daily' : n.includes('before-restore') ? 'Before restore' : 'Manual' };
  }));
}
async function restore(name) {
  if (!/^[0-9A-Za-z_-]+$/.test(name || '')) fail(400, 'Invalid backup name');
  const src = path.join(P.backups(), name);
  if (!exists(path.join(src, 'vault.json'))) fail(404, 'Backup not found');
  if (readJSON(path.join(src, 'vault.json')).kdf.salt !== readJSON(P.vault()).kdf.salt)
    fail(409, 'That backup was made before your password was changed, so it cannot be restored here.');
  await snapshot(`${localDay()}_${localTime()}_before-restore`);
  if (exists(path.join(src, 'org.tde'))) await fsp.copyFile(path.join(src, 'org.tde'), P.org());
  for (const f of await listTde(P.reps())) await fsp.unlink(path.join(P.reps(), f));
  for (const f of await listTde(path.join(src, 'reportees'))) await fsp.copyFile(path.join(src, 'reportees', f), path.join(P.reps(), f));
}

/* ---------------------------------------------------------- password change */
async function changePassword(current, next) {
  if (String(next || '').length < 8) fail(400, 'New password must be at least 8 characters.');
  const k0 = await openVault(dataDir(), current);
  if (!k0) noteFailure();
  const salt = crypto.randomBytes(16), k1 = await deriveKey(next, salt);
  const d = dataDir(), stage = path.join(d, `.rekey-${Date.now()}`);
  const items = [];
  if (exists(P.org())) items.push('org.tde');
  for (const f of await listTde(P.reps())) items.push(path.join('reportees', f));
  for (const owner of await fsp.readdir(P.files()).catch(() => []))
    for (const f of await listTde(path.join(P.files(), owner))) items.push(path.join('files', owner, f));
  for (const rel of items) {
    const out = path.join(stage, rel);
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, encrypt(decrypt(await fsp.readFile(path.join(d, rel)), k0), k1));
  }
  for (const rel of items) await fsp.rename(path.join(stage, rel), path.join(d, rel));
  const v = readJSON(P.vault());
  v.kdf = { name: 'scrypt', ...SCRYPT_PARAMS, salt: salt.toString('base64') };
  v.check = encrypt(VERIFY, k1).toString('base64');
  v.passwordChanged = new Date().toISOString();
  await writeAtomic(P.vault(), Buffer.from(JSON.stringify(v, null, 2)));
  await fsp.rm(stage, { recursive: true, force: true });
  key = k1;
}

/* ---------------------------------------------------------- folder browsing */
function roots() {
  const h = os.homedir(), r = [{ label: 'Home', path: h }];
  for (const n of ['Documents', 'Desktop']) if (exists(path.join(h, n))) r.push({ label: n, path: path.join(h, n) });
  try { for (const e of fs.readdirSync(h)) if (/^OneDrive/.test(e)) r.push({ label: e, path: path.join(h, e) }); } catch {}
  if (process.platform === 'win32') {
    for (const L of 'CDEFGHIJKLMNOPQRSTUVWXYZ') if (exists(`${L}:\\`)) r.push({ label: `${L}:`, path: `${L}:\\` });
  } else {
    r.push({ label: 'Computer', path: '/' });
    if (process.platform === 'darwin' && exists('/Volumes')) r.push({ label: 'Volumes', path: '/Volumes' });
  }
  return r;
}
async function listDir(p) {
  const target = p ? path.resolve(String(p)) : os.homedir();
  let ents;
  try { ents = await fsp.readdir(target, { withFileTypes: true }); }
  catch { fail(400, 'That folder can’t be opened. It may not exist, or this computer may be blocking access to it.'); }
  const dirs = ents.filter(e => e.isDirectory() && !/^[.$]/.test(e.name) && !['node_modules', 'System Volume Information'].includes(e.name))
    .map(e => ({ name: e.name, path: path.join(target, e.name), teamdesk: isVault(path.join(target, e.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const parent = path.dirname(target) !== target ? path.dirname(target) : null;
  return { path: target, parent, sep: path.sep, dirs, teamdesk: isVault(target), empty: !ents.some(e => !e.name.startsWith('.')), roots: roots() };
}

/* ---------------------------------------------------------- API routes */
const routes = [];
const route = (method, pattern, handler, opts = {}) =>
  routes.push({ method, rx: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, auth: true, unlocked: false, raw: false, ...opts });

route('GET', '/api/ping', () => ({ app: 'teamdesk', version: VERSION }), { auth: false });

route('GET', '/api/status', () => ({
  app: 'teamdesk', version: VERSION, configured: configured(), dataDir: dataDir() || null, unlocked: !!key,
  autoLockMinutes: config.autoLockMinutes ?? 15, platform: process.platform, home: os.homedir(), sep: path.sep, node: process.version,
}));

route('GET', '/api/fs/list', ({ url }) => listDir(url.searchParams.get('path')));
route('POST', '/api/fs/mkdir', async ({ body }) => {
  const name = String(body.name || '').trim();
  if (!name || /[\\/:*?"<>|]/.test(name) || name.startsWith('.')) fail(400, 'Use a folder name without \\ / : * ? " < > |');
  const p = path.join(path.resolve(String(body.parent)), name);
  if (exists(p)) fail(409, 'A folder with that name already exists.');
  await fsp.mkdir(p);
  return { path: p };
});

route('POST', '/api/setup', async ({ body }) => {
  checkRate();
  let dir = path.resolve(String(body.dir || ''));
  if (body.mode === 'open') {
    if (!isVault(dir)) fail(400, 'No Team Desk data found in that folder.');
    const k = await openVault(dir, body.password);
    if (!k) noteFailure();
    failures = 0; key = k; config.dataDir = dir; saveConfig(); snapshotDay = null;
    return { dataDir: dir };
  }
  if (String(body.password || '').length < 8) fail(400, 'Password must be at least 8 characters.');
  if (isVault(dir)) fail(409, 'That folder already has Team Desk data. Choose “Open existing data” instead.');
  if (exists(dir)) {
    const visible = (await fsp.readdir(dir)).filter(n => !n.startsWith('.'));
    if (visible.length) {
      dir = path.join(dir, 'TeamDesk Data');
      if (isVault(dir)) fail(409, 'That folder already contains a “TeamDesk Data” folder with Team Desk data. Open it instead.');
      if (exists(dir) && (await fsp.readdir(dir)).some(n => !n.startsWith('.'))) fail(409, 'A non-empty “TeamDesk Data” folder already exists there. Choose an empty folder.');
    }
  }
  key = await createVault(dir, body.password);
  config.dataDir = dir; saveConfig(); snapshotDay = null;
  return { dataDir: dir };
});

route('POST', '/api/unlock', async ({ body }) => {
  checkRate();
  if (!configured()) fail(409, 'Not set up yet');
  const k = await openVault(dataDir(), body.password);
  if (!k) noteFailure();
  failures = 0; key = k; lastActivity = Date.now();
  return { ok: true };
});
route('POST', '/api/lock', () => { key = null; return { ok: true }; });
route('POST', '/api/activity', () => ({ ok: true }), { unlocked: true });
route('PUT', '/api/config', ({ body }) => {
  if (body.autoLockMinutes !== undefined) config.autoLockMinutes = Math.max(0, Math.min(240, parseInt(body.autoLockMinutes, 10) || 0));
  saveConfig(); return { autoLockMinutes: config.autoLockMinutes };
}, { unlocked: true });
route('POST', '/api/password', async ({ body }) => { checkRate(); await changePassword(body.current, body.next); failures = 0; return { ok: true }; }, { unlocked: true });

route('GET', '/api/data', async () => {
  const org = exists(P.org()) ? JSON.parse((await decryptFile(P.org())).toString()) : null;
  const reportees = [];
  for (const f of await listTde(P.reps())) {
    try { reportees.push(JSON.parse((await decryptFile(path.join(P.reps(), f))).toString())); }
    catch (e) { console.error(`Could not read ${f}:`, e.message); }
  }
  return { org, reportees };
}, { unlocked: true });
async function decryptFile(f) { return decrypt(await fsp.readFile(f)); }

route('PUT', '/api/org', async ({ raw }) => { JSON.parse(raw.toString()); await writeEnc(P.org(), raw); return { ok: true }; }, { unlocked: true, raw: true, limit: JSON_LIMIT });
route('PUT', '/api/reportees/:id', async ({ params, raw }) => {
  const obj = JSON.parse(raw.toString());
  if (obj.id !== params.id) fail(400, 'Id mismatch');
  await writeEnc(P.rep(params.id), raw); return { ok: true };
}, { unlocked: true, raw: true, limit: JSON_LIMIT });
route('DELETE', '/api/reportees/:id', async ({ params }) => {
  await fsp.rm(P.rep(params.id), { force: true });
  await fsp.rm(P.fileDir(params.id), { recursive: true, force: true });
  return { ok: true };
}, { unlocked: true });

route('PUT', '/api/files/:owner/:id', async ({ params, raw, req }) => {
  const meta = { name: decodeURIComponent(String(req.headers['x-file-name'] || 'file')), type: String(req.headers['content-type'] || 'application/octet-stream'), size: raw.length, stored: new Date().toISOString() };
  await writeAtomic(P.file(params.owner, params.id), encrypt(packFile(meta, raw)));
  return { ok: true, size: raw.length };
}, { unlocked: true, raw: true, limit: FILE_LIMIT });
route('GET', '/api/files/:owner/:id', async ({ params, res }) => {
  const f = P.file(params.owner, params.id);
  if (!exists(f)) fail(404, 'File not found');
  const { meta, data } = unpackFile(decrypt(await fsp.readFile(f)));
  res.writeHead(200, { 'Content-Type': meta.type || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}` });
  res.end(data);
}, { unlocked: true });
route('DELETE', '/api/files/:owner/:id', async ({ params }) => { await fsp.rm(P.file(params.owner, params.id), { force: true }); return { ok: true }; }, { unlocked: true });

route('GET', '/api/backups', () => listBackups(), { unlocked: true });
route('POST', '/api/backups', async () => { const n = `${localDay()}_${localTime()}_manual`; await snapshot(n); return { name: n }; }, { unlocked: true });
route('POST', '/api/backups/restore', async ({ body }) => { await restore(body.name); return { ok: true }; }, { unlocked: true });

route('POST', '/api/folder/move', async ({ body }) => {
  const target = path.resolve(String(body.target || ''));
  const src = dataDir();
  if (target === src || target.startsWith(src + path.sep)) fail(400, 'Choose a folder outside the current data folder.');
  let dst = target;
  if (exists(dst) && (await fsp.readdir(dst)).some(n => !n.startsWith('.'))) dst = path.join(target, 'TeamDesk Data');
  if (exists(dst) && (await fsp.readdir(dst)).some(n => !n.startsWith('.'))) fail(409, 'The destination isn’t empty. Choose an empty folder.');
  await fsp.cp(src, dst, { recursive: true, filter: s => !path.basename(s).startsWith('.rekey-') && !/\.tmp-[0-9a-f]+$/.test(s) });
  config.dataDir = dst; config.previousDataDir = src; saveConfig();
  return { dataDir: dst, previous: src };
}, { unlocked: true });
route('POST', '/api/folder/open', async ({ body }) => {
  const dir = path.resolve(String(body.dir || ''));
  if (!isVault(dir)) fail(400, 'No Team Desk data found in that folder.');
  key = null; config.dataDir = dir; saveConfig(); snapshotDay = null;
  return { dataDir: dir };
});

/* ---------- local AI (Ollama) — the server talks to it, the browser never does ---------- */
const AI_DEFAULT_URL = 'http://127.0.0.1:11434';
const aiCfg = () => ({ enabled: false, url: AI_DEFAULT_URL, model: '', ...(config.ai || {}) });
function loopbackUrl(u) {
  let x; try { x = new URL(String(u)); } catch { fail(400, 'Invalid AI address'); }
  if (!['http:', 'https:'].includes(x.protocol) || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(x.hostname))
    fail(400, 'For privacy, the AI address must be on this computer (localhost / 127.0.0.1).');
  return x.origin;
}
async function ollama(pathname, body, timeoutMs) {
  const r = await fetch(aiCfg().url + pathname, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) { let m = `${r.status}`; try { m = (await r.json()).error || m; } catch {} throw new HttpError(502, `Local AI error: ${m}`); }
  return r.json();
}
route('GET', '/api/ai/status', async () => {
  const c = aiCfg();
  try { const t = await ollama('/api/tags', null, 2500); return { ...c, available: true, models: (t.models || []).map(m => ({ name: m.name, size: m.size, family: m.details?.family || '', params: m.details?.parameter_size || '' })) }; }
  catch (e) { return { ...c, available: false, models: [], error: e.name === 'TimeoutError' ? 'Ollama did not respond' : 'Ollama is not running on this computer' }; }
}, { unlocked: true });
route('PUT', '/api/ai/config', ({ body }) => {
  const c = aiCfg();
  if (body.url !== undefined) c.url = loopbackUrl(body.url || AI_DEFAULT_URL);
  if (body.model !== undefined) c.model = String(body.model).slice(0, 200);
  if (body.enabled !== undefined) c.enabled = !!body.enabled;
  config.ai = c; saveConfig(); return c;
}, { unlocked: true });
route('POST', '/api/ai/chat', async ({ body }) => {
  const c = aiCfg();
  if (!c.enabled || !c.model) fail(409, 'Local AI is turned off. Turn it on in Settings › AI assistant.');
  const sys = String(body.system || '').slice(0, 8000), prompt = String(body.prompt || '').slice(0, 24000);
  const t0 = Date.now();
  let out;
  try {
    out = await ollama('/api/chat', { model: c.model, stream: false, format: 'json', keep_alive: '10m', options: { temperature: 0.2, num_ctx: 8192 },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }] }, 240000);
  } catch (e) { if (e.status) throw e; fail(502, e.name === 'TimeoutError' ? 'The local AI took too long to answer. Try a smaller model.' : 'Could not reach Ollama. Is it running?'); }
  return { content: out.message?.content || '', model: c.model, ms: Date.now() - t0 };
}, { unlocked: true, limit: 256 * 1024 });

route('POST', '/api/shutdown', ({ res }) => {
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
  console.log('\nTeam Desk was stopped from the app. Goodbye.');
  setTimeout(() => process.exit(0), 250);
});

/* ---------------------------------------------------------- HTTP plumbing */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(new HttpError(413, 'That is too large to save.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function sendJSON(res, status, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store' });
  res.end(b);
}
async function handleApi(req, res, url) {
  const r = routes.find(x => x.method === req.method && x.rx.test(url.pathname));
  if (!r) fail(404, 'Not found');
  if (r.auth && req.headers['x-td-token'] !== TOKEN) fail(401, 'Missing or invalid token. Reload the page.');
  if (r.unlocked && (!key || !configured())) fail(423, 'locked');
  if (r.auth && url.pathname !== '/api/status') lastActivity = Date.now();
  const params = url.pathname.match(r.rx).groups || {};
  let raw = null, body = {};
  if (['POST', 'PUT'].includes(req.method)) {
    raw = await readBody(req, r.limit || 1024 * 1024);
    if (!r.raw && raw.length) { try { body = JSON.parse(raw.toString()); } catch { fail(400, 'Invalid JSON'); } }
  }
  const out = await r.handler({ req, res, url, params, body, raw });
  if (!res.headersSent) sendJSON(res, 200, out ?? { ok: true });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.map': 'application/json' };
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-cache',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://cdnjs.cloudflare.com; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};
const VENDOR = {
  'pdf.min.js': ['pdfjs-dist', 'build', 'pdf.min.js'],
  'pdf.worker.min.js': ['pdfjs-dist', 'build', 'pdf.worker.min.js'],
  'mammoth.browser.min.js': ['mammoth', 'mammoth.browser.min.js'],
  'xlsx.full.min.js': ['xlsx', 'dist', 'xlsx.full.min.js'],
};
async function serveStatic(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Method not allowed');
  let file;
  if (url.pathname.startsWith('/vendor/')) {
    const v = VENDOR[path.basename(url.pathname)];
    file = v && path.join(ROOT, 'node_modules', ...v);
    if (!file || !exists(file)) fail(404, 'Not installed');
  } else {
    const rel = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    file = path.resolve(APP_DIR, rel);
    if (!file.startsWith(APP_DIR + path.sep)) fail(403, 'Forbidden');
    if (!exists(file) || fs.statSync(file).isDirectory()) fail(404, 'Not found');
  }
  let data = await fsp.readFile(file);
  if (path.basename(file) === 'index.html') data = Buffer.from(data.toString().replace('__TD_TOKEN__', TOKEN).replace(/__TD_VERSION__/g, VERSION));
  res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': data.length });
  res.end(req.method === 'HEAD' ? undefined : data);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!ALLOWED_HOSTS.has(String(req.headers.host || '').toLowerCase())) { res.writeHead(403); return res.end('Forbidden'); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (e) {
    const status = e.status || (e.code === 'ERR_CRYPTO_INVALID_AUTH_TAG' || /auth/i.test(e.message) ? 500 : 500);
    if (!e.status) console.error(e);
    if (!res.headersSent) sendJSON(res, status, { error: e.status ? e.message : `Unexpected error: ${e.message}` });
    else res.end();
  }
});

/* ---------------------------------------------------------- auto-lock */
setInterval(() => {
  const mins = config.autoLockMinutes ?? 15;
  if (key && mins > 0 && Date.now() - lastActivity > mins * 60000) { key = null; console.log(`Locked after ${mins} minutes of inactivity.`); }
}, 15000).unref();

/* ---------------------------------------------------------- start */
function ping(port) {
  return new Promise(resolve => {
    const r = http.get({ host: '127.0.0.1', port, path: '/api/ping', timeout: 800, headers: { Host: `127.0.0.1:${port}` } }, res => {
      let s = ''; res.on('data', c => s += c);
      res.on('end', () => { try { resolve(JSON.parse(s).app === 'teamdesk' ? 'teamdesk' : 'other'); } catch { resolve('other'); } });
    });
    r.on('timeout', () => { r.destroy(); resolve('other'); });
    r.on('error', e => resolve(e.code === 'ECONNREFUSED' ? null : 'other'));
  });
}
function openBrowser(url) {
  if (NO_OPEN) return;
  const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {}
}
function listen(port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
}
async function start() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) { console.error(`Team Desk needs Node.js 18 or newer (you have ${process.version}).`); process.exit(1); }
  for (let i = 0; i < 10; i++) {
    const port = BASE_PORT + i, state = await ping(port);
    if (state === 'teamdesk') { console.log(`Team Desk is already running at http://localhost:${port}`); openBrowser(`http://localhost:${port}`); return; }
    if (state === 'other') continue;
    ALLOWED_HOSTS = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
    try { await listen(port); PORT = port; break; }
    catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
  if (!server.listening) { console.error('Could not find a free port between', BASE_PORT, 'and', BASE_PORT + 9); process.exit(1); }
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Team Desk ${VERSION} is running at ${url}`);
  console.log(`  Data folder: ${configured() ? dataDir() : 'not set up yet — you will choose it in the browser'}`);
  console.log('  Keep this window open while you use Team Desk. Press Ctrl+C to stop.\n');
  openBrowser(url);
}
process.on('SIGINT', () => { console.log('\nStopping Team Desk.'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
start().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/*
 * Team Desk — personal (single-manager) server. For the multi-user
 * version see central.js.
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
const {
  ROOT, HttpError, fail, readJSON, exists, localDay, localTime, deriveKey, encryptWith, decryptWith, packFile, unpackFile,
  writeAtomic, listTde, readBody, sendJSON, sendFile, serveStatic, makeRouter, AI_DEFAULT_URL, loopbackUrl, aiStatus, aiChat, SCRYPT_PARAMS, MAGIC,
} = require('./lib/shared');

const VERSION = '4.0.1';
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const NO_OPEN = args.includes('--no-open') || process.env.TEAMDESK_NO_OPEN === '1';
const BASE_PORT = parseInt(argVal('--port', process.env.TEAMDESK_PORT || '4317'), 10);
const CONFIG_DIR = process.env.TEAMDESK_CONFIG_DIR || path.join(os.homedir(), '.teamdesk');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const TOKEN = crypto.randomBytes(24).toString('hex');
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
let dataRev = 1;  // bumped when data is changed from outside the browser (demo loader, restore)

/* ---------------------------------------------------------- helpers */
function saveConfig() { fs.mkdirSync(CONFIG_DIR, { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); }
const checkId = id => { if (!ID_RX.test(String(id || ''))) fail(400, 'Invalid id'); return String(id); };

/* ---------------------------------------------------------- crypto (key = the unlocked vault key) */
const encrypt = (buf, k = key) => encryptWith(k, buf);
const decrypt = (buf, k = key) => decryptWith(k, buf);

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

async function writeEnc(file, buf) { await maybeSnapshot(); await writeAtomic(file, encrypt(buf)); }

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
const { route, match } = makeRouter({ auth: true, unlocked: false, raw: false });

route('GET', '/api/ping', () => ({ app: 'teamdesk', version: VERSION }), { auth: false });

route('GET', '/api/status', () => ({
  app: 'teamdesk', mode: 'local', version: VERSION, configured: configured(), dataDir: dataDir() || null, unlocked: !!key,
  autoLockMinutes: config.autoLockMinutes ?? 15, platform: process.platform, home: os.homedir(), sep: path.sep, node: process.version, dataRev,
}));
route('POST', '/api/data/changed', () => { dataRev++; return { dataRev }; }, { unlocked: true });

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
  sendFile(res, meta, data);
}, { unlocked: true });
route('DELETE', '/api/files/:owner/:id', async ({ params }) => { await fsp.rm(P.file(params.owner, params.id), { force: true }); return { ok: true }; }, { unlocked: true });

route('GET', '/api/backups', () => listBackups(), { unlocked: true });
route('POST', '/api/backups', async () => { const n = `${localDay()}_${localTime()}_manual`; await snapshot(n); return { name: n }; }, { unlocked: true });
route('POST', '/api/backups/restore', async ({ body }) => { await restore(body.name); dataRev++; return { ok: true }; }, { unlocked: true });

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
const aiCfg = () => ({ enabled: false, url: AI_DEFAULT_URL, model: '', ...(config.ai || {}) });
route('GET', '/api/ai/status', () => aiStatus(aiCfg()), { unlocked: true });
route('PUT', '/api/ai/config', ({ body }) => {
  const c = aiCfg();
  if (body.url !== undefined) c.url = loopbackUrl(body.url || AI_DEFAULT_URL);
  if (body.model !== undefined) c.model = String(body.model).slice(0, 200);
  if (body.enabled !== undefined) c.enabled = !!body.enabled;
  config.ai = c; saveConfig(); return c;
}, { unlocked: true });
route('POST', '/api/ai/chat', ({ body }) => aiChat(aiCfg(), body), { unlocked: true, limit: 256 * 1024 });

route('POST', '/api/shutdown', ({ res }) => {
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
  console.log('\nTeam Desk was stopped from the app. Goodbye.');
  setTimeout(() => process.exit(0), 250);
});

/* ---------------------------------------------------------- HTTP plumbing */
async function handleApi(req, res, url) {
  const m = match(req.method, url.pathname);
  if (!m) fail(404, 'Not found');
  const { r, params } = m;
  if (r.auth && req.headers['x-td-token'] !== TOKEN) fail(401, 'Missing or invalid token. Reload the page.');
  if (r.unlocked && (!key || !configured())) fail(423, 'locked');
  if (r.auth && url.pathname !== '/api/status') lastActivity = Date.now();
  let raw = null, body = {};
  if (['POST', 'PUT'].includes(req.method)) {
    raw = await readBody(req, r.limit || 1024 * 1024);
    if (!r.raw && raw.length) { try { body = JSON.parse(raw.toString()); } catch { fail(400, 'Invalid JSON'); } }
  }
  const out = await r.handler({ req, res, url, params, body, raw });
  if (!res.headersSent) sendJSON(res, 200, out ?? { ok: true });
}

const injectIndex = html => html.replace('__TD_TOKEN__', TOKEN).replace('__TD_MODE__', 'local').replace(/__TD_VERSION__/g, VERSION);

const server = http.createServer(async (req, res) => {
  try {
    if (!ALLOWED_HOSTS.has(String(req.headers.host || '').toLowerCase())) { res.writeHead(403); return res.end('Forbidden'); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url, injectIndex);
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

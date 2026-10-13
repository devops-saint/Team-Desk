#!/usr/bin/env node
/*
 * Team Desk — central server (many managers, one installation)
 * ------------------------------------------------------------
 * Run it on a company server (plain Node or Docker). People open it in the
 * browser, register once, and sign in with their email and password.
 *
 *  • Registration: the first person to register becomes the Administrator.
 *    Everyone else waits until an Administrator approves them and puts them
 *    in the Line manager and/or People manager group.
 *  • Line managers see and edit only their own reportees.
 *  • People managers see every reportee of every manager, read-only.
 *  • Someone in both groups chooses which profile to use after signing in.
 *  • All data is encrypted at rest (AES-256-GCM) with a server key kept
 *    outside the data folder. Every sign-in, approval, ownership change and
 *    report download is written to an encrypted audit log.
 *
 * No third-party dependencies. Needs Node.js 18 or newer.
 *
 *   node server/central.js [--port 8080] [--host 0.0.0.0] [--data DIR] [--key-file FILE]
 *                          [--tls-cert FILE --tls-key FILE] [--trust-proxy]
 *   node server/central.js --reset-password user@company.com [--make-admin]
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {
  HttpError, fail, readJSON, exists, localDay, localTime, deriveKey, encryptWith, decryptWith, packFile, unpackFile,
  writeAtomic, listTde, readBody, sendJSON, sendFile, serveStatic, makeRouter, SCRYPT_PARAMS,
  AI_DEFAULT_URL, loopbackUrl, aiStatus, aiChat,
} = require('./lib/shared');

const VERSION = '4.0.1';
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = (k, env) => args.includes(k) || ['1', 'true', 'yes'].includes(String(process.env[env] || '').toLowerCase());
const env = (k, d) => process.env[k] || d;

const PORT = parseInt(argVal('--port', env('TEAMDESK_PORT', '8080')), 10);
const HOST = argVal('--host', env('TEAMDESK_HOST', '0.0.0.0'));
const DATA_DIR = path.resolve(argVal('--data', env('TEAMDESK_DATA_DIR', path.join(os.homedir(), 'teamdesk-central-data'))));
const KEY_FILE = path.resolve(argVal('--key-file', env('TEAMDESK_KEY_FILE', path.join(os.homedir(), '.teamdesk', 'central.key'))));
const TLS_CERT = argVal('--tls-cert', env('TEAMDESK_TLS_CERT', ''));
const TLS_KEY = argVal('--tls-key', env('TEAMDESK_TLS_KEY', ''));
const TRUST_PROXY = flag('--trust-proxy', 'TEAMDESK_TRUST_PROXY');
const SECURE_COOKIE = flag('--secure-cookie', 'TEAMDESK_SECURE_COOKIE');
const ALLOWED_HOSTS = new Set(String(argVal('--allowed-hosts', env('TEAMDESK_ALLOWED_HOSTS', ''))).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const AI_URL_FIXED = env('TEAMDESK_AI_URL', '');   // set by the server operator; may point to another machine

const ID_RX = /^[A-Za-z0-9_-]{1,80}$/;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JSON_LIMIT = 25 * 1024 * 1024, FILE_LIMIT = 60 * 1024 * 1024;
const KEEP_DAILY = 30, KEEP_MANUAL = 20;
const ABSOLUTE_SESSION_MS = 12 * 3600 * 1000;
const VERIFY = Buffer.from('teamdesk-central-ok');
const ORG_OWNER = '_org';
const GROUPS = ['lm', 'pm'];
const GROUP_LABEL = { lm: 'Line manager', pm: 'People manager', admin: 'Administrator' };
const BOOT = crypto.randomBytes(3).toString('hex');

let KEY = null;
let SYS = null;                 // { users: [], settings: {} } — cached, written through
const IDX = new Map();          // reportee id -> { managerId, name, archived, grade }
const sessions = new Map();     // sid -> { uid, profile, csrf, created, last, ip }
const limits = new Map();       // rate-limit buckets
let orgRev = 1, allRev = 1;
const meRev = new Map(), mgrRev = new Map();
let snapshotDay = null;

/* ---------------------------------------------------------- paths */
const checkId = id => { if (!ID_RX.test(String(id || ''))) fail(400, 'Invalid id'); return String(id); };
const P = {
  meta: () => path.join(DATA_DIR, 'central.json'),
  system: () => path.join(DATA_DIR, 'system.tde'),
  org: () => path.join(DATA_DIR, 'org.tde'),
  mgrs: () => path.join(DATA_DIR, 'managers'),
  me: uid => path.join(DATA_DIR, 'managers', checkId(uid) + '.tde'),
  reps: () => path.join(DATA_DIR, 'reportees'),
  rep: id => path.join(DATA_DIR, 'reportees', checkId(id) + '.tde'),
  fileDir: owner => path.join(DATA_DIR, 'files', checkId(owner)),
  file: (owner, id) => path.join(DATA_DIR, 'files', checkId(owner), checkId(id) + '.tde'),
  audit: () => path.join(DATA_DIR, 'audit'),
  backups: () => path.join(DATA_DIR, 'backups'),
};

/* ---------------------------------------------------------- key & encrypted storage */
function parseKey(s) {
  s = String(s || '').trim();
  const b = /^[0-9a-f]{64}$/i.test(s) ? Buffer.from(s, 'hex') : Buffer.from(s, 'base64');
  if (b.length !== 32) throw new Error('The Team Desk server key must be 32 bytes (64 hex characters or base64).');
  return b;
}
function loadKey() {
  if (process.env.TEAMDESK_MASTER_KEY) return parseKey(process.env.TEAMDESK_MASTER_KEY);
  if (exists(KEY_FILE)) return parseKey(fs.readFileSync(KEY_FILE, 'utf8'));
  if (exists(P.meta())) {
    console.error(`\n  The data folder ${DATA_DIR} already has Team Desk data, but the server key\n  was not found at ${KEY_FILE}.\n  Point TEAMDESK_KEY_FILE (or --key-file) at the original key. Without it the data cannot be read.\n`);
    process.exit(1);
  }
  const k = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(KEY_FILE, k.toString('hex') + '\n', { mode: 0o600 });
  console.log(`\n  Created a new server key: ${KEY_FILE}\n  BACK IT UP somewhere safe and separate from the data folder. Without it the data can't be read.\n`);
  return k;
}
const enc = buf => encryptWith(KEY, buf);
const dec = buf => decryptWith(KEY, buf);
async function readEnc(file) { return dec(await fsp.readFile(file)); }
async function readEncJSON(file) { return exists(file) ? JSON.parse((await readEnc(file)).toString()) : null; }
async function writeEnc(file, buf) { await maybeSnapshot(); await writeAtomic(file, enc(buf)); }

async function initData() {
  for (const d of ['', 'managers', 'reportees', 'files', 'audit', 'backups']) await fsp.mkdir(path.join(DATA_DIR, d), { recursive: true });
  if (exists(P.meta())) {
    const m = readJSON(P.meta());
    if (!m || m.app !== 'teamdesk-central') { console.error(`${P.meta()} is not a Team Desk central data file.`); process.exit(1); }
    try { if (!dec(Buffer.from(m.check, 'base64')).equals(VERIFY)) throw new Error(); }
    catch { console.error(`\n  The server key ${process.env.TEAMDESK_MASTER_KEY ? 'in TEAMDESK_MASTER_KEY' : `at ${KEY_FILE}`} does not match the data in ${DATA_DIR}.\n  Use the key that was created with this data folder.\n`); process.exit(1); }
  } else {
    await writeAtomic(P.meta(), Buffer.from(JSON.stringify({ app: 'teamdesk-central', format: 1, created: new Date().toISOString(), check: enc(VERIFY).toString('base64') }, null, 2)));
    await fsp.writeFile(path.join(DATA_DIR, 'README.txt'), `TEAM DESK CENTRAL DATA FOLDER\n=============================\nEverything here is encrypted with the server key (kept separately). Do not edit or rename files.\n\n  central.json   key check (no data)\n  system.tde     user accounts and server settings\n  org.tde        organisation configuration (competency framework, roles, guidelines)\n  managers/      each manager's personal settings and leadership notes\n  reportees/     one encrypted file per reportee\n  files/         uploaded documents, per reportee\n  audit/         encrypted audit log, one file per month\n  backups/       daily snapshots (last ${KEEP_DAILY} days)\n`);
  }
  SYS = (await readEncJSON(P.system())) || { users: [], settings: {} };
  SYS.settings = { registrationOpen: true, allowedDomains: '', sessionMinutes: 30, pmSeesPrivate: false, ai: { enabled: false, url: AI_DEFAULT_URL, model: '' }, ...SYS.settings };
  await buildIndex();
}
const saveSys = () => writeEnc(P.system(), Buffer.from(JSON.stringify(SYS)));
async function buildIndex() {
  IDX.clear();
  for (const f of await listTde(P.reps())) {
    try { const p = JSON.parse((await readEnc(path.join(P.reps(), f))).toString()); IDX.set(p.id, idxEntry(p)); }
    catch (e) { console.error(`Could not read reportees/${f}: ${e.message}`); }
  }
}
const idxEntry = p => ({ managerId: p.managerId || '', name: p.profile?.name || '', archived: !!p.archived, grade: p.grade || '' });

/* ---------------------------------------------------------- snapshots */
const isDaily = n => /^\d{4}-\d{2}-\d{2}$/.test(n);
async function copyDir(src, dst) { if (exists(src)) await fsp.cp(src, dst, { recursive: true, filter: s => !/\.tmp-[0-9a-f]+$/.test(s) }); }
async function snapshot(name) {
  const dst = path.join(P.backups(), name);
  await fsp.mkdir(dst, { recursive: true });
  for (const f of ['central.json', 'system.tde', 'org.tde']) if (exists(path.join(DATA_DIR, f))) await fsp.copyFile(path.join(DATA_DIR, f), path.join(dst, f));
  await copyDir(P.mgrs(), path.join(dst, 'managers'));
  await copyDir(P.reps(), path.join(dst, 'reportees'));
  const all = (await fsp.readdir(P.backups()).catch(() => [])).sort();
  const daily = all.filter(isDaily), manual = all.filter(n => !isDaily(n));
  for (const n of [...daily.slice(0, Math.max(0, daily.length - KEEP_DAILY)), ...manual.slice(0, Math.max(0, manual.length - KEEP_MANUAL))])
    await fsp.rm(path.join(P.backups(), n), { recursive: true, force: true });
}
async function maybeSnapshot() {
  const day = localDay();
  if (snapshotDay === day) return;
  snapshotDay = day;
  if (exists(path.join(P.backups(), day)) || !exists(P.system())) return;
  try { await snapshot(day); } catch (e) { console.error('Snapshot failed:', e.message); }
}

/* ---------------------------------------------------------- audit log (one encrypted JSON line per event) */
async function audit(evt) {
  const e = { at: new Date().toISOString(), ...evt };
  try { await fsp.appendFile(path.join(P.audit(), `${e.at.slice(0, 7)}.log`), enc(Buffer.from(JSON.stringify(e))).toString('base64') + '\n'); }
  catch (err) { console.error('Audit write failed:', err.message); }
}
const actor = (u, sess) => ({ by: u?.id || '', byName: u?.name || '', byEmail: u?.email || '', profile: sess?.profile || '' });

/* ---------------------------------------------------------- users & passwords */
const findUser = id => SYS.users.find(u => u.id === id);
const findEmail = e => SYS.users.find(u => u.email === String(e || '').trim().toLowerCase());
const activeAdmins = () => SYS.users.filter(u => u.admin && u.status === 'active');
function profilesOf(u) {
  if (!u || u.status !== 'active') return [];
  const p = GROUPS.filter(g => (u.groups || []).includes(g));
  return p.length ? p : u.admin ? ['admin'] : [];
}
const pubUser = u => u && ({ id: u.id, email: u.email, name: u.name, status: u.status, admin: !!u.admin, groups: u.groups || [], created: u.created,
  approvedAt: u.approvedAt || '', approvedBy: u.approvedBy || '', lastLogin: u.lastLogin || '', mustChange: !!u.mustChange, note: u.note || '' });
async function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = await deriveKey(pw, salt, SCRYPT_PARAMS, 32);
  return { salt: salt.toString('base64'), hash: h.toString('base64'), kdf: { ...SCRYPT_PARAMS } };
}
const DUMMY = { salt: crypto.randomBytes(16).toString('base64'), hash: crypto.randomBytes(32).toString('base64'), kdf: SCRYPT_PARAMS };
async function verifyPw(pwRec, pw) {
  const r = pwRec || DUMMY;
  const h = await deriveKey(pw, Buffer.from(r.salt, 'base64'), r.kdf || SCRYPT_PARAMS, 32);
  return crypto.timingSafeEqual(h, Buffer.from(r.hash, 'base64')) && !!pwRec;
}
function checkPassword(pw, email) {
  pw = String(pw || '');
  if (pw.length < 10) fail(400, 'Use a password of at least 10 characters. A short sentence works well.');
  if (pw.length > 200) fail(400, 'That password is too long.');
  if (email && pw.toLowerCase().includes(String(email).split('@')[0].toLowerCase())) fail(400, 'The password must not contain your email name.');
}
function tempPassword() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const b = crypto.randomBytes(14); let s = '';
  for (let i = 0; i < 14; i++) s += A[b[i] % A.length];
  return `${s.slice(0, 4)}-${s.slice(4, 9)}-${s.slice(9)}`;
}
function domainAllowed(email) {
  const doms = String(SYS.settings.allowedDomains || '').split(/[,\s]+/).map(d => d.replace(/^@/, '').toLowerCase()).filter(Boolean);
  return !doms.length || doms.includes(email.split('@')[1]);
}

/* ---------------------------------------------------------- sessions */
function clientIp(req) { return (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || ''; }
function isHttps(req) { return !!TLS_CERT || SECURE_COOKIE || (TRUST_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https'); }
function cookie(req, value, maxAge) {
  return `td_sid=${value}; Path=/; HttpOnly; SameSite=Strict${maxAge !== undefined ? `; Max-Age=${maxAge}` : ''}${isHttps(req) ? '; Secure' : ''}`;
}
function parseCookies(req) { const o = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return o; }
function newSession(u, req) {
  const sid = crypto.randomBytes(32).toString('hex');
  const pr = profilesOf(u);
  const s = { uid: u.id, profile: pr.length === 1 ? pr[0] : null, csrf: crypto.randomBytes(24).toString('hex'), created: Date.now(), last: Date.now(), ip: clientIp(req) };
  sessions.set(sid, s);
  return { sid, s };
}
function getSession(req) {
  const sid = parseCookies(req).td_sid;
  if (!sid || !/^[0-9a-f]{64}$/.test(sid)) return null;
  const s = sessions.get(sid); if (!s) return null;
  const u = findUser(s.uid), now = Date.now(), idle = (+SYS.settings.sessionMinutes || 30) * 60000;
  if (!u || u.status !== 'active' || now - s.last > idle || now - s.created > ABSOLUTE_SESSION_MS) { sessions.delete(sid); return null; }
  const pr = profilesOf(u);
  if (s.profile && !pr.includes(s.profile)) s.profile = pr.length === 1 ? pr[0] : null;   // groups changed by an admin
  if (!s.profile && pr.length === 1) s.profile = pr[0];
  return { sid, s, u };
}
const killSessions = (uid, exceptSid) => { for (const [sid, s] of sessions) if (s.uid === uid && sid !== exceptSid) sessions.delete(sid); };
setInterval(() => { const now = Date.now(), idle = (+SYS?.settings?.sessionMinutes || 30) * 60000; for (const [sid, s] of sessions) if (now - s.last > idle || now - s.created > ABSOLUTE_SESSION_MS) sessions.delete(sid); }, 60000).unref();

/* ---------------------------------------------------------- rate limits */
function limitCheck(key) { const b = limits.get(key); if (b && b.until > Date.now()) fail(429, `Too many attempts. Try again in ${Math.ceil((b.until - Date.now()) / 1000)} seconds.`); }
function limitFail(key) { const b = limits.get(key) || { n: 0, until: 0 }; b.n++; if (b.n >= 5) b.until = Date.now() + Math.min(900, 15 * 2 ** (b.n - 5)) * 1000; limits.set(key, b); }
const limitClear = key => limits.delete(key);
function limitCount(key, max, windowMs) {
  const b = limits.get(key) || { n: 0, until: 0, start: Date.now() };
  if (Date.now() - (b.start || 0) > windowMs) { b.n = 0; b.start = Date.now(); }
  b.n++; limits.set(key, b);
  if (b.n > max) fail(429, 'Too many requests from this address. Try again later.');
}

/* ---------------------------------------------------------- revisions (so open browsers refresh when data changes elsewhere) */
const bump = (map, k) => map.set(k, (map.get(k) || 0) + 1);
function revFor(s) {
  if (!s || !s.profile) return '0';
  const me = meRev.get(s.uid) || 0;
  if (s.profile === 'lm') return `${BOOT}.${orgRev}.${mgrRev.get(s.uid) || 0}.${me}`;
  if (s.profile === 'pm') return `${BOOT}.${orgRev}.${allRev}.${me}`;
  return `${BOOT}.${orgRev}.${me}`;
}
function touchedReportee(managerId) { bump(mgrRev, managerId); allRev++; }

/* ---------------------------------------------------------- privacy filter for people managers */
function forPeopleManager(p) {
  if (SYS.settings.pmSeesPrivate) return p;
  const c = JSON.parse(JSON.stringify(p));
  (c.oneOnOnes || []).forEach(o => { delete o.private; });
  if (c.profile) delete c.profile.personal;
  c.suggestions = [];   // the line manager's suggestion inbox can quote private notes
  c.privateHidden = true;
  return c;
}

/* ---------------------------------------------------------- routes */
const { route, match } = makeRouter({ access: 'ready', raw: false, profiles: null });
/* access: public | session (signed in) | ready (signed in, profile chosen, password not pending change) | admin */

function statusPayload(ses) {
  const u = ses?.u, s = ses?.s;
  const base = { app: 'teamdesk', mode: 'central', version: VERSION, hasUsers: SYS.users.length > 0, registrationOpen: !!SYS.settings.registrationOpen || !SYS.users.length,
    allowedDomains: SYS.settings.allowedDomains || '', node: process.version, platform: process.platform };
  if (!u) return { ...base, signedIn: false };
  return { ...base, signedIn: true, user: pubUser(u), profiles: profilesOf(u), profile: s.profile, csrf: s.csrf, rev: revFor(s), mustChange: !!u.mustChange,
    sessionMinutes: +SYS.settings.sessionMinutes || 30, pmSeesPrivate: !!SYS.settings.pmSeesPrivate, aiEnabled: !!SYS.settings.ai?.enabled,
    pending: u.admin ? SYS.users.filter(x => x.status === 'pending').length : 0 };
}

route('GET', '/api/ping', () => ({ app: 'teamdesk', mode: 'central', version: VERSION }), { access: 'public' });
route('GET', '/api/status', ({ ses }) => statusPayload(ses), { access: 'public' });

/* ---------- registration & sign-in ---------- */
route('POST', '/api/auth/register', async ({ body, req, res, ip }) => {
  limitCount('reg:' + ip, 10, 3600000);
  const name = String(body.name || '').trim().slice(0, 120), email = String(body.email || '').trim().toLowerCase();
  if (!name) fail(400, 'Enter your full name.');
  if (!EMAIL_RX.test(email) || email.length > 200) fail(400, 'Enter a valid work email address.');
  checkPassword(body.password, email);
  const first = SYS.users.length === 0;
  if (!first && !SYS.settings.registrationOpen) fail(403, 'Registration is closed. Ask your Team Desk administrator to open it.');
  if (!first && !domainAllowed(email)) fail(403, `Registration is limited to ${SYS.settings.allowedDomains} email addresses.`);
  if (findEmail(email)) fail(409, 'An account with this email already exists. Sign in instead, or ask an administrator to reset your password.');
  const u = { id: 'u' + crypto.randomBytes(6).toString('hex'), email, name, pw: await hashPw(body.password), status: first ? 'active' : 'pending',
    admin: first, groups: first ? ['lm'] : [], requested: GROUPS.filter(g => (body.requested || []).includes(g)), note: String(body.note || '').slice(0, 300),
    created: new Date().toISOString(), approvedAt: first ? new Date().toISOString() : '', approvedBy: first ? 'first account' : '' };
  SYS.users.push(u); await saveSys();
  await audit({ action: first ? 'register-first-admin' : 'register', ...actor(u), target: u.email });
  if (!first) return { pending: true };
  const { sid } = newSession(u, req);
  res.setHeader('Set-Cookie', cookie(req, sid));
  u.lastLogin = new Date().toISOString(); await saveSys();
  return statusPayload(getSession({ headers: { cookie: `td_sid=${sid}` }, socket: req.socket }));
}, { access: 'public' });

route('POST', '/api/auth/login', async ({ body, req, res, ip }) => {
  const email = String(body.email || '').trim().toLowerCase();
  limitCheck('ip:' + ip); limitCheck('em:' + email);
  const u = findEmail(email);
  const ok = await verifyPw(u?.pw, String(body.password || ''));
  if (!ok) { limitFail('ip:' + ip); limitFail('em:' + email); await audit({ action: 'login-failed', target: email, ip }); fail(401, 'Incorrect email or password.'); }
  limitClear('em:' + email); limitClear('ip:' + ip);
  if (u.status === 'pending') fail(403, 'Your registration is waiting for an administrator to approve it. You’ll be able to sign in once it is approved.');
  if (u.status === 'disabled') fail(403, 'This account is disabled. Contact your Team Desk administrator.');
  if (u.status !== 'active') fail(403, 'This account cannot sign in. Contact your Team Desk administrator.');
  if (!profilesOf(u).length) fail(403, 'Your account has no group yet. Ask an administrator to add you to Line manager or People manager.');
  const { sid } = newSession(u, req);
  res.setHeader('Set-Cookie', cookie(req, sid));
  u.lastLogin = new Date().toISOString(); await saveSys();
  await audit({ action: 'login', ...actor(u), ip });
  return statusPayload(getSession({ headers: { cookie: `td_sid=${sid}` }, socket: req.socket }));
}, { access: 'public' });

route('POST', '/api/auth/logout', async ({ ses, req, res }) => {
  sessions.delete(ses.sid);
  res.setHeader('Set-Cookie', cookie(req, '', 0));
  await audit({ action: 'logout', ...actor(ses.u, ses.s) });
  return { ok: true };
}, { access: 'session' });

route('POST', '/api/auth/profile', async ({ body, ses }) => {
  if (ses.u.mustChange) fail(403, 'Change your password first.');
  const p = String(body.profile || '');
  if (!profilesOf(ses.u).includes(p)) fail(403, 'You are not in that group.');
  ses.s.profile = p;
  await audit({ action: 'profile', ...actor(ses.u, ses.s), detail: GROUP_LABEL[p] });
  return statusPayload(ses);
}, { access: 'session' });

route('POST', '/api/auth/password', async ({ body, ses, ip }) => {
  limitCheck('pw:' + ses.u.id);
  if (!await verifyPw(ses.u.pw, String(body.current || ''))) { limitFail('pw:' + ses.u.id); fail(403, 'Your current password is not correct.'); }
  checkPassword(body.next, ses.u.email);
  if (body.next === body.current) fail(400, 'Choose a password that is different from the current one.');
  ses.u.pw = await hashPw(body.next); ses.u.mustChange = false; ses.u.pwChanged = new Date().toISOString();
  await saveSys(); killSessions(ses.u.id, ses.sid); limitClear('pw:' + ses.u.id);
  await audit({ action: 'password-changed', ...actor(ses.u, ses.s), ip });
  return statusPayload(ses);
}, { access: 'session' });

route('POST', '/api/activity', () => ({ ok: true }), { access: 'session' });

/* ---------- data ---------- */
route('GET', '/api/data', async ({ ses }) => {
  const { u, s } = ses;
  const org = await readEncJSON(P.org()), me = await readEncJSON(P.me(u.id));
  const reportees = [], managers = {};
  if (s.profile === 'lm' || s.profile === 'pm') {
    for (const [id, x] of IDX) {
      if (s.profile === 'lm' && x.managerId !== u.id) continue;
      try { const p = JSON.parse((await readEnc(P.rep(id))).toString()); reportees.push(s.profile === 'pm' ? forPeopleManager(p) : p); }
      catch (e) { console.error(`Could not read reportee ${id}: ${e.message}`); }
    }
  }
  if (s.profile === 'pm') {
    for (const x of SYS.users) if ((x.groups || []).includes('lm') || [...IDX.values()].some(r => r.managerId === x.id)) managers[x.id] = { name: x.name, email: x.email, status: x.status };
    if (!s.auditedAll || Date.now() - s.auditedAll > 3600000) { s.auditedAll = Date.now(); await audit({ action: 'view-all', ...actor(u, s), detail: `${reportees.length} reportees` }); }
  } else managers[u.id] = { name: u.name, email: u.email, status: u.status };
  return { org, me, reportees, managers, rev: revFor(s) };
});

route('PUT', '/api/org', async ({ raw, ses }) => {
  JSON.parse(raw.toString());
  await writeEnc(P.org(), raw); orgRev++;
  await audit({ action: 'org-config', ...actor(ses.u, ses.s) });
  return { ok: true, rev: revFor(ses.s) };
}, { access: 'admin', raw: true, limit: JSON_LIMIT });

route('PUT', '/api/me', async ({ raw, ses }) => {
  JSON.parse(raw.toString());
  await writeEnc(P.me(ses.u.id), raw); bump(meRev, ses.u.id);
  return { ok: true, rev: revFor(ses.s) };
}, { raw: true, limit: JSON_LIMIT });

route('PUT', '/api/reportees/:id', async ({ params, raw, ses }) => {
  const obj = JSON.parse(raw.toString());
  if (obj.id !== params.id) fail(400, 'Id mismatch');
  const cur = IDX.get(params.id);
  if (cur && cur.managerId !== ses.u.id) fail(403, 'This reportee belongs to another manager.');
  obj.managerId = ses.u.id;
  await writeEnc(P.rep(params.id), Buffer.from(JSON.stringify(obj)));
  IDX.set(obj.id, idxEntry(obj)); touchedReportee(ses.u.id);
  if (!cur) await audit({ action: 'reportee-created', ...actor(ses.u, ses.s), target: obj.id, targetName: obj.profile?.name || '' });
  else if (cur.archived !== !!obj.archived) await audit({ action: obj.archived ? 'reportee-archived' : 'reportee-restored', ...actor(ses.u, ses.s), target: obj.id, targetName: obj.profile?.name || '' });
  return { ok: true, rev: revFor(ses.s) };
}, { profiles: ['lm'], raw: true, limit: JSON_LIMIT });

route('DELETE', '/api/reportees/:id', async ({ params, ses }) => {
  const cur = IDX.get(checkId(params.id));
  if (!cur) return { ok: true, rev: revFor(ses.s) };
  if (cur.managerId !== ses.u.id) fail(403, 'This reportee belongs to another manager.');
  await maybeSnapshot();
  await fsp.rm(P.rep(params.id), { force: true });
  await fsp.rm(P.fileDir(params.id), { recursive: true, force: true });
  IDX.delete(params.id); touchedReportee(ses.u.id);
  await audit({ action: 'reportee-deleted', ...actor(ses.u, ses.s), target: params.id, targetName: cur.name });
  return { ok: true, rev: revFor(ses.s) };
}, { profiles: ['lm'] });

/* ---------- documents ---------- */
function fileAccess(ses, owner, write) {
  checkId(owner);
  if (owner === ORG_OWNER) { if (write && !ses.u.admin) fail(403, 'Only an administrator can change organisation documents.'); return; }
  const r = IDX.get(owner);
  if (!r) fail(404, 'Save the reportee first, then upload the file.');
  if (ses.s.profile === 'lm' && r.managerId === ses.u.id) return;
  if (!write && ses.s.profile === 'pm') return;
  fail(403, write && ses.s.profile === 'pm' ? 'People managers have view-only access.' : 'You don’t have access to this reportee.');
}
route('PUT', '/api/files/:owner/:id', async ({ params, raw, req, ses }) => {
  fileAccess(ses, params.owner, true);
  let name = 'file'; try { name = decodeURIComponent(String(req.headers['x-file-name'] || 'file')); } catch {}
  const meta = { name: name.slice(0, 240), type: String(req.headers['content-type'] || 'application/octet-stream').slice(0, 120), size: raw.length, stored: new Date().toISOString(), by: ses.u.id };
  await writeAtomic(P.file(params.owner, params.id), enc(packFile(meta, raw)));
  return { ok: true, size: raw.length };
}, { raw: true, limit: FILE_LIMIT });
route('GET', '/api/files/:owner/:id', async ({ params, res, ses }) => {
  fileAccess(ses, params.owner, false);
  const f = P.file(params.owner, params.id);
  if (!exists(f)) fail(404, 'File not found');
  const { meta, data } = unpackFile(await readEnc(f));
  if (params.owner !== ORG_OWNER && ses.s.profile === 'pm') await audit({ action: 'file-download', ...actor(ses.u, ses.s), target: params.owner, targetName: IDX.get(params.owner)?.name || '', detail: meta.name });
  sendFile(res, meta, data);
});
route('DELETE', '/api/files/:owner/:id', async ({ params, ses }) => {
  fileAccess(ses, params.owner, true);
  await fsp.rm(P.file(params.owner, params.id), { force: true });
  return { ok: true };
});

/* ---------- events reported by the browser (views and downloads) ---------- */
const CLIENT_EVENTS = { 'view-reportee': 1, 'download-report': 1, 'export-data': 1, 'import-data': 1 };
route('POST', '/api/audit', async ({ body, ses }) => {
  const action = String(body.action || '');
  if (!CLIENT_EVENTS[action]) fail(400, 'Unknown event');
  const target = String(body.target || '').slice(0, 80);
  if (target && action !== 'export-data' && action !== 'import-data') {
    const r = IDX.get(target);
    if (!r || (ses.s.profile === 'lm' && r.managerId !== ses.u.id) || !['lm', 'pm'].includes(ses.s.profile)) fail(403, 'No access');
  }
  await audit({ action, ...actor(ses.u, ses.s), target, targetName: IDX.get(target)?.name || '', detail: String(body.detail || '').slice(0, 300) });
  return { ok: true };
});

/* ---------- administration ---------- */
const ownedCount = uid => [...IDX.values()].filter(r => r.managerId === uid).length;
route('GET', '/api/admin/users', ({ ses }) => ({ me: ses.u.id, users: SYS.users.map(u => ({ ...pubUser(u), requested: u.requested || [], reportees: ownedCount(u.id) })) }), { access: 'admin' });

function cleanGroups(g) { return GROUPS.filter(x => (Array.isArray(g) ? g : []).includes(x)); }
route('POST', '/api/admin/users/:id/approve', async ({ params, body, ses }) => {
  const u = findUser(params.id); if (!u) fail(404, 'User not found');
  if (u.status !== 'pending') fail(409, 'This registration was already handled.');
  const groups = cleanGroups(body.groups);
  if (!groups.length && !body.admin) fail(400, 'Choose at least one group.');
  Object.assign(u, { status: 'active', groups, admin: !!body.admin, approvedAt: new Date().toISOString(), approvedBy: ses.u.name });
  await saveSys();
  await audit({ action: 'user-approved', ...actor(ses.u, ses.s), target: u.email, detail: [...groups.map(g => GROUP_LABEL[g]), u.admin && 'Administrator'].filter(Boolean).join(', ') });
  return pubUser(u);
}, { access: 'admin' });

route('POST', '/api/admin/users/:id/reject', async ({ params, ses }) => {
  const u = findUser(params.id); if (!u) fail(404, 'User not found');
  if (u.status !== 'pending') fail(409, 'Only pending registrations can be rejected.');
  SYS.users = SYS.users.filter(x => x.id !== u.id); await saveSys();
  await audit({ action: 'user-rejected', ...actor(ses.u, ses.s), target: u.email });
  return { ok: true };
}, { access: 'admin' });

route('PUT', '/api/admin/users/:id', async ({ params, body, ses }) => {
  const u = findUser(params.id); if (!u) fail(404, 'User not found');
  const before = JSON.stringify(pubUser(u)), changes = [];
  if (body.name !== undefined) { const n = String(body.name).trim().slice(0, 120); if (!n) fail(400, 'Name is required'); if (n !== u.name) changes.push(`name → ${n}`); u.name = n; }
  if (body.groups !== undefined) {
    const g = cleanGroups(body.groups);
    if (!g.length && !(body.admin ?? u.admin)) fail(400, 'Keep at least one group, or make the user an administrator.');
    if (u.groups.includes('lm') && !g.includes('lm') && ownedCount(u.id)) fail(409, `${u.name} still has ${ownedCount(u.id)} reportee(s). Move them to another line manager first (Administration › Reportee ownership).`);
    if (g.join() !== (u.groups || []).join()) changes.push(`groups → ${g.map(x => GROUP_LABEL[x]).join(', ') || 'none'}`);
    u.groups = g;
  }
  if (body.admin !== undefined && !!body.admin !== !!u.admin) {
    if (!body.admin && u.admin && activeAdmins().length <= 1 && u.status === 'active') fail(409, 'There must be at least one active administrator.');
    u.admin = !!body.admin; changes.push(u.admin ? 'made administrator' : 'administrator removed');
  }
  if (body.status !== undefined && body.status !== u.status) {
    if (!['active', 'disabled'].includes(body.status) || u.status === 'pending') fail(400, 'Invalid status');
    if (u.id === ses.u.id) fail(409, 'You can’t disable your own account.');
    if (body.status === 'disabled' && u.admin && activeAdmins().length <= 1) fail(409, 'There must be at least one active administrator.');
    u.status = body.status; changes.push(u.status === 'disabled' ? 'disabled' : 're-enabled');
    if (u.status === 'disabled') killSessions(u.id);
  }
  if (!profilesOf(u).length && u.status === 'active') fail(400, 'The user would have no profile to sign in with.');
  if (JSON.stringify(pubUser(u)) !== before) { await saveSys(); await audit({ action: 'user-updated', ...actor(ses.u, ses.s), target: u.email, detail: changes.join('; ') }); }
  return pubUser(u);
}, { access: 'admin' });

route('POST', '/api/admin/users/:id/reset-password', async ({ params, ses }) => {
  const u = findUser(params.id); if (!u) fail(404, 'User not found');
  if (u.id === ses.u.id) fail(409, 'Change your own password from Settings › Security.');
  const temp = tempPassword();
  u.pw = await hashPw(temp); u.mustChange = true; await saveSys(); killSessions(u.id);
  await audit({ action: 'password-reset', ...actor(ses.u, ses.s), target: u.email });
  return { temp };
}, { access: 'admin' });

route('DELETE', '/api/admin/users/:id', async ({ params, ses }) => {
  const u = findUser(params.id); if (!u) fail(404, 'User not found');
  if (u.id === ses.u.id) fail(409, 'You can’t delete your own account.');
  if (ownedCount(u.id)) fail(409, `${u.name} still owns ${ownedCount(u.id)} reportee(s). Move them first.`);
  if (u.admin && u.status === 'active' && activeAdmins().length <= 1) fail(409, 'There must be at least one active administrator.');
  SYS.users = SYS.users.filter(x => x.id !== u.id); await saveSys(); killSessions(u.id);
  await fsp.rm(P.me(u.id), { force: true });
  await audit({ action: 'user-deleted', ...actor(ses.u, ses.s), target: u.email });
  return { ok: true };
}, { access: 'admin' });

route('GET', '/api/admin/reportees', () => [...IDX.entries()].map(([id, x]) => ({ id, ...x })), { access: 'admin' });

route('POST', '/api/admin/transfer', async ({ body, ses }) => {
  const to = findUser(body.to);
  if (!to || to.status !== 'active' || !(to.groups || []).includes('lm')) fail(400, 'Choose an active line manager to move the reportees to.');
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter(id => IDX.has(id));
  if (!ids.length) fail(400, 'Select at least one reportee.');
  await maybeSnapshot();
  for (const id of ids) {
    const p = JSON.parse((await readEnc(P.rep(id))).toString()), from = p.managerId;
    if (from === to.id) continue;
    p.managerId = to.id;
    p.transfers = [...(p.transfers || []), { date: localDay(), from, fromName: findUser(from)?.name || '', to: to.id, toName: to.name, by: ses.u.name }];
    await writeAtomic(P.rep(id), enc(Buffer.from(JSON.stringify(p))));
    IDX.set(id, idxEntry(p)); touchedReportee(from); touchedReportee(to.id);
    await audit({ action: 'reportee-transferred', ...actor(ses.u, ses.s), target: id, targetName: p.profile?.name || '', detail: `${findUser(from)?.name || 'unassigned'} → ${to.name}` });
  }
  return { ok: true, moved: ids.length };
}, { access: 'admin' });

route('GET', '/api/admin/settings', () => ({ ...SYS.settings, ai: undefined }), { access: 'admin' });
route('PUT', '/api/admin/settings', async ({ body, ses }) => {
  const s = SYS.settings, changes = [];
  const set = (k, v) => { if (JSON.stringify(s[k]) !== JSON.stringify(v)) { changes.push(`${k} → ${v}`); s[k] = v; } };
  if (body.registrationOpen !== undefined) set('registrationOpen', !!body.registrationOpen);
  if (body.allowedDomains !== undefined) set('allowedDomains', String(body.allowedDomains).toLowerCase().split(/[,\s]+/).map(d => d.replace(/^@/, '')).filter(d => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)).join(', '));
  if (body.sessionMinutes !== undefined) set('sessionMinutes', Math.max(5, Math.min(480, parseInt(body.sessionMinutes, 10) || 30)));
  if (body.pmSeesPrivate !== undefined) set('pmSeesPrivate', !!body.pmSeesPrivate);
  if (changes.length) { await saveSys(); allRev++; await audit({ action: 'settings', ...actor(ses.u, ses.s), detail: changes.join('; ') }); }
  return { ...s, ai: undefined };
}, { access: 'admin' });

route('GET', '/api/admin/audit', async ({ url }) => {
  const months = (await fsp.readdir(P.audit()).catch(() => [])).filter(f => /^\d{4}-\d{2}\.log$/.test(f)).map(f => f.slice(0, 7)).sort().reverse();
  const m = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : months[0];
  const entries = [];
  if (m && exists(path.join(P.audit(), `${m}.log`))) {
    for (const line of (await fsp.readFile(path.join(P.audit(), `${m}.log`), 'utf8')).split('\n')) {
      if (!line) continue;
      try { entries.push(JSON.parse(dec(Buffer.from(line, 'base64')).toString())); } catch { entries.push({ at: '', action: 'unreadable-entry' }); }
    }
  }
  return { months, month: m || '', entries: entries.reverse() };
}, { access: 'admin' });

route('GET', '/api/admin/backups', async () => {
  const names = (await fsp.readdir(P.backups()).catch(() => [])).filter(n => exists(path.join(P.backups(), n, 'system.tde'))).sort().reverse();
  return Promise.all(names.map(async n => ({ name: n, reportees: (await listTde(path.join(P.backups(), n, 'reportees'))).length, kind: isDaily(n) ? 'Daily' : n.includes('before-restore') ? 'Before restore' : 'Manual' })));
}, { access: 'admin' });
route('POST', '/api/admin/backups', async ({ ses }) => { const n = `${localDay()}_${localTime()}_manual`; await snapshot(n); await audit({ action: 'backup', ...actor(ses.u, ses.s), detail: n }); return { name: n }; }, { access: 'admin' });
route('POST', '/api/admin/backups/restore', async ({ body, ses }) => {
  const name = String(body.name || '');
  if (!/^[0-9A-Za-z_-]+$/.test(name)) fail(400, 'Invalid backup name');
  const src = path.join(P.backups(), name);
  if (!exists(path.join(src, 'system.tde'))) fail(404, 'Backup not found');
  await snapshot(`${localDay()}_${localTime()}_before-restore`);
  /* restores organisation configuration, managers' personal data and reportees. User accounts are not rolled back. */
  if (exists(path.join(src, 'org.tde'))) await fsp.copyFile(path.join(src, 'org.tde'), P.org());
  for (const [dir, sub] of [[P.mgrs(), 'managers'], [P.reps(), 'reportees']]) {
    for (const f of await listTde(dir)) await fsp.unlink(path.join(dir, f));
    for (const f of await listTde(path.join(src, sub))) await fsp.copyFile(path.join(src, sub, f), path.join(dir, f));
  }
  await buildIndex(); orgRev++; allRev++; for (const u of SYS.users) { bump(mgrRev, u.id); bump(meRev, u.id); }
  await audit({ action: 'restore', ...actor(ses.u, ses.s), detail: name });
  return { ok: true };
}, { access: 'admin' });

/* ---------- local AI (Ollama on the server machine) ---------- */
const aiCfg = () => ({ enabled: false, url: AI_DEFAULT_URL, model: '', ...(SYS.settings.ai || {}), ...(AI_URL_FIXED ? { url: AI_URL_FIXED, fixedUrl: true } : {}) });
route('GET', '/api/ai/status', async ({ ses }) => { const st = await aiStatus(aiCfg()); return ses.u.admin ? st : { enabled: st.enabled, model: st.model, available: st.available, models: [], error: st.error }; });
route('PUT', '/api/ai/config', async ({ body, ses }) => {
  const c = { ...SYS.settings.ai };
  if (body.url !== undefined && !AI_URL_FIXED) c.url = loopbackUrl(body.url || AI_DEFAULT_URL);
  if (body.model !== undefined) c.model = String(body.model).slice(0, 200);
  if (body.enabled !== undefined) c.enabled = !!body.enabled;
  SYS.settings.ai = c; await saveSys();
  await audit({ action: 'ai-settings', ...actor(ses.u, ses.s), detail: `${c.enabled ? 'on' : 'off'} ${c.model || ''}` });
  return aiCfg();
}, { access: 'admin' });
route('POST', '/api/ai/chat', ({ body }) => aiChat(aiCfg(), body), { profiles: ['lm'], limit: 256 * 1024 });

/* ---------------------------------------------------------- HTTP plumbing */
async function handleApi(req, res, url) {
  const m = match(req.method, url.pathname);
  if (!m) fail(404, 'Not found');
  const { r, params } = m;
  const ses = getSession(req), ip = clientIp(req);
  if (req.method !== 'GET') {
    if (r.access !== 'public' && (!ses || req.headers['x-td-csrf'] !== ses.s.csrf)) fail(ses ? 403 : 401, ses ? 'Security check failed. Reload the page.' : 'Please sign in.');
  }
  if (r.access !== 'public') {
    if (!ses) fail(401, 'Please sign in.');
    if (r.access !== 'session') {
      if (ses.u.mustChange) fail(403, 'Change your password first.');
      if (r.access === 'admin' && !ses.u.admin) fail(403, 'Administrators only.');
      if (r.access === 'ready' && !ses.s.profile) fail(409, 'Choose a profile first.');
      if (r.profiles && !r.profiles.includes(ses.s.profile)) fail(403, ses.s.profile === 'pm' ? 'People managers have view-only access.' : 'Not available in this profile.');
    }
    if (url.pathname !== '/api/status') ses.s.last = Date.now();
  }
  let raw = null, body = {};
  if (['POST', 'PUT'].includes(req.method)) {
    raw = await readBody(req, r.limit || 1024 * 1024);
    /* JSON bodies must say so: browsers can't send that cross-site without a CORS pre-flight, which this server never grants */
    if (!r.raw && raw.length && !/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) fail(415, 'Expected JSON');
    if (!r.raw && raw.length) { try { body = JSON.parse(raw.toString()); } catch { fail(400, 'Invalid JSON'); } }
  }
  const out = await r.handler({ req, res, url, params, body, raw, ses, ip });
  if (!res.headersSent) sendJSON(res, 200, out ?? { ok: true });
}

const injectIndex = html => html.replace('__TD_TOKEN__', '').replace('__TD_MODE__', 'central').replace(/__TD_VERSION__/g, VERSION);
async function onRequest(req, res) {
  try {
    if (ALLOWED_HOSTS.size && !ALLOWED_HOSTS.has(String(req.headers.host || '').toLowerCase())) { res.writeHead(403); return res.end('Forbidden'); }
    const url = new URL(req.url, 'http://x');
    const extra = isHttps(req) ? { 'Strict-Transport-Security': 'max-age=31536000' } : {};
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url, injectIndex, extra);
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) sendJSON(res, e.status || 500, { error: e.status ? e.message : 'Unexpected server error. The details are in the server log.' });
    else res.end();
  }
}

/* ---------------------------------------------------------- command-line maintenance */
async function cliResetPassword(email) {
  const u = findEmail(email);
  if (!u) { console.error(`No account with the email ${email}.`); process.exit(1); }
  const temp = tempPassword();
  u.pw = await hashPw(temp); u.mustChange = true;
  if (u.status !== 'active') { u.status = 'active'; if (!profilesOf(u).length) u.groups = ['lm']; }
  if (args.includes('--make-admin')) u.admin = true;
  await saveSys();
  await audit({ action: 'password-reset-cli', target: u.email, detail: u.admin ? 'administrator' : '' });
  console.log(`\n  Temporary password for ${u.email}: ${temp}\n  They must change it after signing in.${u.admin ? ' This account is an administrator.' : ''}\n`);
  process.exit(0);
}

/* ---------------------------------------------------------- start */
async function start() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) { console.error(`Team Desk needs Node.js 18 or newer (you have ${process.version}).`); process.exit(1); }
  KEY = loadKey();
  await initData();
  if (argVal('--reset-password')) return cliResetPassword(argVal('--reset-password'));
  const tls = TLS_CERT && TLS_KEY;
  const server = tls ? https.createServer({ cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) }, onRequest) : http.createServer(onRequest);
  server.headersTimeout = 60000; server.requestTimeout = 300000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, HOST, resolve); });
  const proto = tls ? 'https' : 'http';
  const addrs = HOST === '0.0.0.0' || HOST === '::' ? ['localhost', ...Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address)] : [HOST];
  console.log(`\n  Team Desk ${VERSION} (central) is running:`);
  addrs.forEach(a => console.log(`    ${proto}://${a}:${PORT}`));
  console.log(`  Data folder: ${DATA_DIR}\n  Server key:  ${process.env.TEAMDESK_MASTER_KEY ? 'from TEAMDESK_MASTER_KEY' : KEY_FILE}`);
  console.log(`  Users: ${SYS.users.length ? `${SYS.users.filter(u => u.status === 'active').length} active, ${SYS.users.filter(u => u.status === 'pending').length} waiting for approval` : 'none yet — open the address above and register; the first account becomes the administrator'}`);
  console.log(`  Reportees: ${IDX.size}`);
  if (!tls && !TRUST_PROXY && !SECURE_COOKIE) console.log('\n  Note: running without HTTPS. Put Team Desk behind your HTTPS reverse proxy (and add --trust-proxy),\n  or start it with --tls-cert and --tls-key, before people use it over the network.');
  console.log('');
}
process.on('SIGINT', () => { console.log('\nStopping Team Desk.'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
start().catch(e => { console.error(e); process.exit(1); });

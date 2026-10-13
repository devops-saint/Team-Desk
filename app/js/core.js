/* =========================================================
   core.js — utilities, server API, storage sync, routing
   ========================================================= */
'use strict';

/* ---------- DOM & text ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const initials = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const firstName = n => String(n || '').split(' ')[0];
const list = (a, n = 3) => a.slice(0, n).join(', ') + (a.length > n ? ` +${a.length - n} more` : '');
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pct = v => v == null ? '—' : `${Math.round(v)}%`;
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

/* ---------- dates (ISO yyyy-mm-dd, local time) ---------- */
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const parseD = s => new Date(s + 'T00:00:00');
const fmt = d => d ? parseD(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtShort = d => d ? parseD(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const fmtMonth = m => parseD(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const addDays = (d, n) => { const x = parseD(d); x.setDate(x.getDate() + n); return ymd(x); };
const addMonths = (d, n) => { const x = parseD(d); x.setMonth(x.getMonth() + n); return ymd(x); };
const relDays = d => { const n = daysBetween(today(), d); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`; };

/* ---------- server API ---------- */
const TOKEN = document.querySelector('meta[name="td-token"]')?.content || '';
const APP_VERSION = document.querySelector('meta[name="td-version"]')?.content || '';
/* 'local' = personal server on this computer (one manager, password-unlocked vault)
   'central' = shared company server (accounts, groups, profiles) */
const CENTRAL = document.querySelector('meta[name="td-mode"]')?.content === 'central';
class ApiError extends Error { constructor(m, s) { super(m); this.status = s; } }
async function api(method, url, body, opts = {}) {
  const headers = { ...(CENTRAL ? { 'X-TD-CSRF': App.csrf || '' } : { 'X-TD-Token': TOKEN }), ...(opts.headers || {}) };
  let payload = body;
  const isBin = body instanceof Blob || body instanceof ArrayBuffer;
  if (body !== undefined && !isBin) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch(url, { method, headers, body: payload }); }
  catch { throw new ApiError(CENTRAL ? 'The Team Desk server is not reachable. Check your network connection.' : 'Team Desk server is not reachable. Is the Team Desk window still running?', 0); }
  if (r.status === 423 && !opts.allowLocked) { App.onLocked(); throw new ApiError('Team Desk is locked', 423); }
  if (CENTRAL && r.status === 401 && !opts.allowLocked) { App.onSignedOut(); throw new ApiError('Your session has ended. Please sign in again.', 401); }
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error || m; } catch {} throw new ApiError(m, r.status); }
  if (opts.raw) return r;
  return (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text();
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeName = s => String(s).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');

/* ---------- application state ---------- */
let S = null;          // persisted data: org-level fields + reportees[]
const V = {};          // view state (filters, sub-tabs) — not persisted
const App = { status: null, ready: false, onLocked() {}, onSignedOut() {}, user: null, profile: null, csrf: '', managers: {} };
/* role helpers — in the personal (local) version the manager can do everything */
const isPM = () => CENTRAL && App.profile === 'pm';
const isLM = () => !CENTRAL || App.profile === 'lm';
const isAdmin = () => CENTRAL && !!App.user?.admin;
const canEditConfig = () => !CENTRAL || isAdmin();
const managerName = id => App.managers?.[id]?.name || '';
const PROFILE_LABEL = { lm: 'Line manager', pm: 'People manager', admin: 'Administrator' };

/* ---------- storage sync: one encrypted file per reportee ---------- */
/* central version: organisation-wide configuration (shared, edited by administrators) is stored apart from
   each manager's personal settings and notes */
const SHARED_KEYS = ['framework', 'roles', 'skills', 'guidelines'], SHARED_SETTINGS = ['cycleStartMonth', 'distribution'];
function splitS() {
  const { reportees, ...rest } = S;
  const shared = { settings: {} }, me = { ...rest, settings: { ...rest.settings } };
  SHARED_KEYS.forEach(k => { shared[k] = rest[k]; delete me[k]; });
  SHARED_SETTINGS.forEach(k => { shared.settings[k] = rest.settings[k]; delete me.settings[k]; });
  return { shared, me };
}
let roToastAt = 0;
const roNotice = msg => { if (Date.now() - roToastAt > 4000) { roToastAt = Date.now(); toast(msg || 'View only — that change was not saved', 'err'); } };
const noteRev = r => { if (r && r.rev) App.dataRev = r.rev; };

const Store = {
  cache: { org: null, me: null, reps: {} }, timer: null, flushing: false, again: false, state: 'saved', lastSaved: null, error: null,
  async load() {
    const d = await api('GET', '/api/data');
    if (CENTRAL) {
      const def = defaultOrg(), org = d.org, me = d.me;
      S = { ...def, ...(me || {}) };
      if (org) SHARED_KEYS.forEach(k => { if (org[k] !== undefined) S[k] = org[k]; });
      S.settings = { ...def.settings, ...(me?.settings || {}), ...(org?.settings || {}) };
      if (!S.settings.managerName) S.settings.managerName = App.user?.name || '';
      S.reportees = d.reportees || [];
      App.managers = d.managers || {};
      App.dataRev = d.rev;
      migrate(S);
      this.prime();
      if (!org && isAdmin()) this.cache.org = null;   // first run: the administrator writes the default configuration
      if (!me) this.cache.me = null;
      if (this.cache.org === null || this.cache.me === null) this.save();
      return;
    }
    const org = d.org || defaultOrg();
    S = { ...org, reportees: d.reportees || [] };
    migrate(S);
    this.prime();
    if (!d.org) { this.cache.org = null; this.save(); }  // first run: write the defaults to disk
  },
  prime() {
    const { reportees, ...org } = S;
    if (CENTRAL) { const { shared, me } = splitS(); this.cache.org = JSON.stringify(shared); this.cache.me = JSON.stringify(me); }
    else this.cache.org = JSON.stringify(org);
    this.cache.reps = Object.fromEntries(reportees.map(p => [p.id, JSON.stringify(p)]));
  },
  /* people managers (and line managers on organisation settings) are view-only: undo local edits */
  revertReportees() {
    let changed = false;
    const keep = S.reportees.filter(p => this.cache.reps[p.id]);
    if (keep.length !== S.reportees.length) changed = true;
    S.reportees = keep.map(p => { const c = this.cache.reps[p.id]; if (JSON.stringify(p) !== c) { changed = true; return JSON.parse(c); } return p; });
    for (const [id, c] of Object.entries(this.cache.reps)) if (!S.reportees.some(p => p.id === id)) { S.reportees.push(JSON.parse(c)); changed = true; }
    return changed;
  },
  async flushCentral() {
    const { shared, me } = splitS();
    const sj = JSON.stringify(shared);
    if (sj !== this.cache.org) {
      if (isAdmin()) { noteRev(await api('PUT', '/api/org', shared)); this.cache.org = sj; }
      else if (this.cache.org) {
        const o = JSON.parse(this.cache.org);
        SHARED_KEYS.forEach(k => { S[k] = o[k]; }); SHARED_SETTINGS.forEach(k => { S.settings[k] = o.settings[k]; });
        roNotice('Only an administrator can change organisation settings'); setTimeout(render, 0);
      }
    }
    const mj = JSON.stringify(me);
    if (mj !== this.cache.me) { noteRev(await api('PUT', '/api/me', me)); this.cache.me = mj; }
    if (App.profile !== 'lm') { if (this.revertReportees()) { roNotice(); setTimeout(render, 0); } return; }
    for (const p of S.reportees) {
      if (!p.managerId) p.managerId = App.user.id;
      const j = JSON.stringify(p);
      if (j !== this.cache.reps[p.id]) { noteRev(await api('PUT', `/api/reportees/${p.id}`, p)); this.cache.reps[p.id] = j; }
    }
    for (const id of Object.keys(this.cache.reps)) {
      if (!S.reportees.some(p => p.id === id)) { noteRev(await api('DELETE', `/api/reportees/${id}`)); delete this.cache.reps[id]; }
    }
  },
  save() {
    clearTimeout(this.timer);
    this.state = 'pending'; renderSaveState();
    this.timer = setTimeout(() => this.flush(), 350);
  },
  /* resolves once everything changed so far is on the server (waits for a save already in progress) */
  flush() {
    if (this.flushing) { this.again = true; return this.running; }
    this.flushing = true;
    this.running = this._flush();
    return this.running;
  },
  async _flush() {
    try {
      if (CENTRAL) { await this.flushCentral(); this.state = 'saved'; this.lastSaved = new Date(); this.error = null; return; }
      const { reportees, ...org } = S;
      const oj = JSON.stringify(org);
      if (oj !== this.cache.org) { await api('PUT', '/api/org', org); this.cache.org = oj; }
      for (const p of reportees) {
        const j = JSON.stringify(p);
        if (j !== this.cache.reps[p.id]) { await api('PUT', `/api/reportees/${p.id}`, p); this.cache.reps[p.id] = j; }
      }
      for (const id of Object.keys(this.cache.reps)) {
        if (!reportees.some(p => p.id === id)) { await api('DELETE', `/api/reportees/${id}`); delete this.cache.reps[id]; }
      }
      this.state = 'saved'; this.lastSaved = new Date(); this.error = null;
    } catch (e) {
      this.state = 'error'; this.error = e.message;
      if (e.status !== 423 && e.status !== 401) toast('Could not save: ' + e.message, 'err');
      if (CENTRAL && e.status === 403) { this.state = 'saved'; setTimeout(async () => { await Store.load(); render(); }, 0); }   // e.g. a reportee was moved to another manager
    } finally {
      this.flushing = false; renderSaveState();
      if (this.again) { this.again = false; await this.flush(); }
    }
  },
  dirty() { return this.state !== 'saved'; },
};
const save = () => Store.save();

/* ---------- attachments (encrypted on the server, stored per owner) ---------- */
const Files = {
  put: async (owner, id, file) => { await Store.flush(); return api('PUT', `/api/files/${owner}/${id}`, file, { headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || 'file') } }); },
  del: (owner, id) => api('DELETE', `/api/files/${owner}/${id}`).catch(() => {}),
  async download(owner, id, name) {
    try { const r = await api('GET', `/api/files/${owner}/${id}`, undefined, { raw: true }); downloadBlob(await r.blob(), name); }
    catch (e) { toast(e.status === 404 ? 'The original file is no longer stored.' : e.message, 'err'); }
  },
};

/* ---------- routing (#/section/sub/…) ---------- */
const route = () => (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/').filter(Boolean).map(decodeURIComponent);
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
const personHref = (id, sec = 'overview') => `#/people/${id}/${sec}`;

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
class ApiError extends Error { constructor(m, s) { super(m); this.status = s; } }
async function api(method, url, body, opts = {}) {
  const headers = { 'X-TD-Token': TOKEN, ...(opts.headers || {}) };
  let payload = body;
  const isBin = body instanceof Blob || body instanceof ArrayBuffer;
  if (body !== undefined && !isBin) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch(url, { method, headers, body: payload }); }
  catch { throw new ApiError('Team Desk server is not reachable. Is the Team Desk window still running?', 0); }
  if (r.status === 423 && !opts.allowLocked) { App.onLocked(); throw new ApiError('Team Desk is locked', 423); }
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
const App = { status: null, ready: false, onLocked() {} };

/* ---------- storage sync: one encrypted file per reportee ---------- */
const Store = {
  cache: { org: null, reps: {} }, timer: null, flushing: false, again: false, state: 'saved', lastSaved: null, error: null,
  async load() {
    const d = await api('GET', '/api/data');
    const org = d.org || defaultOrg();
    S = { ...org, reportees: d.reportees || [] };
    migrate(S);
    this.prime();
    if (!d.org) { this.cache.org = null; this.save(); }  // first run: write the defaults to disk
  },
  prime() {
    const { reportees, ...org } = S;
    this.cache.org = JSON.stringify(org);
    this.cache.reps = Object.fromEntries(reportees.map(p => [p.id, JSON.stringify(p)]));
  },
  save() {
    clearTimeout(this.timer);
    this.state = 'pending'; renderSaveState();
    this.timer = setTimeout(() => this.flush(), 350);
  },
  async flush() {
    if (this.flushing) { this.again = true; return; }
    this.flushing = true;
    try {
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
      if (e.status !== 423) toast('Could not save: ' + e.message, 'err');
    } finally {
      this.flushing = false; renderSaveState();
      if (this.again) { this.again = false; this.flush(); }
    }
  },
  dirty() { return this.state !== 'saved'; },
};
const save = () => Store.save();

/* ---------- attachments (encrypted on the server, stored per owner) ---------- */
const Files = {
  put: (owner, id, file) => api('PUT', `/api/files/${owner}/${id}`, file, { headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || 'file') } }),
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

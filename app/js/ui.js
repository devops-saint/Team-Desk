/* =========================================================
   ui.js — icons, app shell, routing render, modal, drawer,
           toasts, form helpers and the calendar date picker
   ========================================================= */
'use strict';

/* ---------- icons (stroke, 24px grid) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  chevL: '<polyline points="15 18 9 12 15 6"/>', chevR: '<polyline points="9 18 15 12 9 6"/>', chevD: '<polyline points="6 9 12 15 18 9"/>', chevU: '<polyline points="18 15 12 9 6 15"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  folderPlus: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  bars: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  checkSq: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
};
const ic = (name, size = 16, extra = '') => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICONS[name] || ''}</svg>`;

/* ---------- navigation model ---------- */
const NAV = [
  ['Overview', [['dashboard', 'home', 'Dashboard', '#/dashboard'], ['upcoming', 'calendar', 'Upcoming & actions', '#/upcoming']]],
  ['People', [['people', 'users', 'Reportees', '#/people']]],
  ['Insights', [['insights/competency', 'grid', 'Competency map', '#/insights/competency'], ['insights/skills', 'layers', 'Skills map', '#/insights/skills'],
    ['insights/talent', 'award', 'Talent & succession', '#/insights/talent'], ['insights/engagement', 'heart', 'Engagement', '#/insights/engagement'],
    ['insights/calibration', 'bars', 'Calibration', '#/insights/calibration']]],
  ['My leadership', [['leadership', 'compass', 'Leadership', '#/leadership']]],
  ['Configuration', [['config/framework', 'target', 'Competency framework', '#/config/framework'], ['config/roles', 'clipboard', 'Roles & KPIs', '#/config/roles'],
    ['config/skills', 'list', 'Technical skills', '#/config/skills'], ['config/guidelines', 'book', 'Org guidelines', '#/config/guidelines']]],
];
const PAGE = { crumbs: [] };
const crumbs = c => { PAGE.crumbs = c; };

function renderSidebar(r) {
  const key = r[0] === 'insights' || r[0] === 'config' ? `${r[0]}/${r[1] || ''}` : r[0];
  const folder = (App.status?.dataDir || '').split(/[\\/]/).filter(Boolean).pop() || '';
  $('#sidebar').innerHTML = `<div class="brand"><div class="brand-mark">TD</div><div><b>Team Desk</b><span>Manager workspace</span></div></div>
    ${NAV.map(([sec, items]) => `<div class="nav-sec">${sec}</div>${items.map(([k, icon, label, href]) => {
      const on = key === k || (k === 'insights/competency' && key === 'insights/') || (k === 'config/framework' && key === 'config/');
      const count = k === 'people' ? `<span class="count">${active().length}</span>` : '';
      return `<a class="nav-item ${on ? 'on' : ''}" href="${href}">${ic(icon)}${label}${count}</a>`; }).join('')}`).join('')}
    <div class="side-foot">
      <a class="nav-item ${r[0] === 'settings' ? 'on' : ''}" href="#/settings">${ic('sliders')}Settings</a>
      <button class="nav-item" onclick="lockNow()">${ic('lock')}Lock Team Desk</button>
      <div class="vault-pill" title="${esc(App.status?.dataDir || '')}">${ic('shield', 14)}<div>Encrypted data folder<b>${esc(folder)}</b></div></div>
    </div>`;
}
function renderTopbar() {
  const c = PAGE.crumbs;
  $('#topbar').innerHTML = `<nav class="crumbs" aria-label="Breadcrumb">${c.map((x, i) => i === c.length - 1 ? `<b>${esc(x[0])}</b>` : `<a href="${x[1]}">${esc(x[0])}</a><span class="sep">/</span>`).join('')}</nav>
    <div class="search">${ic('search', 15)}<input id="gsearch" placeholder="Find a reportee…" autocomplete="off" oninput="searchPeople(this.value)" onkeydown="searchKey(event)" onblur="setTimeout(()=>$('#gresults')?.remove(),150)"></div>
    <button class="btn primary" onclick="editProfile()">${ic('plus', 15)}Add reportee</button>
    <span class="savestate" id="savestate"></span>`;
  renderSaveState();
}
function renderSaveState() {
  const el = $('#savestate'); if (!el) return;
  const st = Store.state;
  el.className = 'savestate ' + st;
  el.innerHTML = `<span class="dot"></span>${st === 'pending' ? 'Saving…' : st === 'error' ? 'Not saved' : Store.lastSaved ? `Saved ${Store.lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'All changes saved'}`;
  el.title = st === 'error' ? Store.error || '' : 'Saved to your encrypted data folder';
}
function searchPeople(q) {
  $('#gresults')?.remove();
  q = q.trim().toLowerCase(); if (!q) return;
  const hits = S.reportees.filter(p => [p.profile.name, p.profile.designation, p.profile.empId, p.grade].some(x => String(x || '').toLowerCase().includes(q))).slice(0, 7);
  const box = document.createElement('div'); box.id = 'gresults'; box.className = 'search-results';
  box.innerHTML = hits.length ? hits.map((p, i) => `<button class="${i === 0 ? 'on' : ''}" onmousedown="go('${personHref(p.id)}');$('#gsearch').value=''">${avatar(p, 'sm')}<span><b>${esc(p.profile.name)}</b><br><span class="xs muted">${esc([p.profile.designation, p.grade && 'Grade ' + p.grade, p.archived && 'Archived'].filter(Boolean).join(' · '))}</span></span></button>`).join('')
    : '<div class="small muted" style="padding:8px">No reportee matches.</div>';
  $('.search').appendChild(box);
}
function searchKey(e) {
  if (e.key === 'Enter') { const b = $('#gresults button'); if (b) b.dispatchEvent(new Event('mousedown')); }
  if (e.key === 'Escape') { e.target.value = ''; $('#gresults')?.remove(); e.target.blur(); }
}

/* ---------- render dispatcher ---------- */
let lastRouteKey = '';
function render() {
  if (!App.ready) return;
  const r = route(), rk = r.join('/');
  DP.close();
  PAGE.crumbs = [];
  let html;
  try { html = dispatch(r); }
  catch (e) { console.error(e); html = pageHead('Something went wrong', esc(e.message)) + `<div class="card card-body">${esc(e.stack || '')}</div>`; }
  $('#main').innerHTML = html;
  renderSidebar(r); renderTopbar();
  if (rk !== lastRouteKey) { window.scrollTo(0, 0); lastRouteKey = rk; }
}
function dispatch(r) {
  switch (r[0]) {
    case 'dashboard': return pgDashboard();
    case 'upcoming': return pgUpcoming();
    case 'people': return r[1] ? pgPerson(r[1], r[2] || 'overview') : pgPeople();
    case 'insights': return ({ competency: pgCompMap, skills: pgSkillMap, talent: pgTalent, engagement: pgEngagement, calibration: pgCalibration }[r[1]] || pgCompMap)();
    case 'leadership': return pgLeadership(r[1] || 'scorecard');
    case 'config':
      if (r[1] === 'roles') return r[2] ? pgRole(r[2]) : pgRoles();
      if (r[1] === 'skills') return pgSkillsCatalogue();
      if (r[1] === 'guidelines') return pgGuidelines();
      return pgFramework(r[2] || 'expectations');
    case 'settings': return pgSettings(r[1] || 'general');
    default: return pgDashboard();
  }
}

/* ---------- page building blocks ---------- */
const pageHead = (title, desc = '', actions = '', eyebrow = '') => `<div class="page-head"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
const sectionHead = (title, desc = '', actions = '') => `<div class="section-head"><div><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ''}</div>${actions ? `<div class="row">${actions}</div>` : ''}</div>`;
function card(title, body, o = {}) {
  return `<div class="card ${o.cls || ''}">${title ? `<div class="card-head"><div><h2>${title}</h2>${o.sub ? `<p>${o.sub}</p>` : ''}</div>${o.actions ? `<div class="row">${o.actions}</div>` : ''}</div>` : ''}
    <div class="card-body ${o.flush ? 'flush' : ''}">${body}</div>${o.foot ? `<div class="card-foot">${o.foot}</div>` : ''}</div>`;
}
const emptyState = (icon, title, text = '', action = '') => `<div class="empty">${ic(icon, 30)}<h3>${title}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`;
const callout = (kind, html, icon) => `<div class="callout ${kind}">${ic(icon || ({ warn: 'alert', bad: 'alert', good: 'check' }[kind] || 'info'), 16)}<div>${html}</div></div>`;
const tabsNav = (items, activeKey, hrefFn) => `<div class="tabs" role="tablist">${items.map(([k, l, n]) => `<a role="tab" class="tab ${k === activeKey ? 'on' : ''}" href="${hrefFn(k)}">${l}${n != null ? `<span class="count">${n}</span>` : ''}</a>`).join('')}</div>`;
const seg = (vkey, items, activeKey) => `<div class="seg">${items.map(([k, l]) => `<button class="${k === activeKey ? 'on' : ''}" onclick="V['${vkey}']='${k}';render()">${l}</button>`).join('')}</div>`;
const avatar = (p, size = '') => `<span class="avatar ${size}">${esc(initials(p.profile.name))}</span>`;
const personCell = (p, sub) => `<div class="person-cell">${avatar(p)}<div style="min-width:0"><b class="ellipsis">${esc(p.profile.name)}</b>${sub ? `<span class="sub">${sub}</span>` : ''}</div></div>`;
function statusBadge(s) { const c = { 'On track': 'b-good', 'Done': 'b-acc', 'At risk': 'b-warn', 'Off track': 'b-bad', 'In progress': 'b-acc', 'Deferred': 'b-warn', 'Met': 'b-good', 'Partly met': 'b-warn', 'Not yet met': 'b-bad', 'Active': 'b-warn', 'Extended': 'b-warn', 'Completed – successful': 'b-good', 'Completed – not successful': 'b-bad' }[s] || ''; return `<span class="badge ${c}">${esc(s)}</span>`; }
const riskBadge = r => r ? `<span class="badge ${r === 'High' ? 'b-bad' : r === 'Medium' ? 'b-warn' : 'b-good'}">${esc(r)} risk</span>` : '';
const progress = (v, cls = '') => `<div class="progress ${cls}"><i style="width:${clamp(+v || 0, 0, 100)}%"></i></div>`;
const sevDot = lvl => `<span class="pill-dot sev-${lvl}"></span>`;
function focusList(items, max = 99, withLinks = null) {
  if (!items.length) return `<div class="muted small">${ic('check', 14)} Nothing needs attention right now.</div>`;
  return items.slice(0, max).map(x => `<div class="focus-item">${sevDot(x.lvl)}<div class="grow"><span class="badge">${esc(x.area)}</span> ${esc(x.text)}</div>${withLinks && x.sec ? `<a class="small nowrap" href="${personHref(withLinks, x.sec)}">Open</a>` : ''}</div>`).join('');
}
function spark(vals, w = 120, h = 28, max = 5, min = 1) {
  const pts = vals.map((v, i) => v == null ? null : [i * (w - 6) / Math.max(1, vals.length - 1) + 3, h - 3 - (v - min) / (max - min) * (h - 6)]);
  const segs = []; let cur = [];
  pts.forEach(p => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } }); if (cur.length) segs.push(cur);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" stroke="var(--line)" stroke-dasharray="2 3"/>
    ${segs.map(s => `<polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${s.map(p => p.join(',')).join(' ')}"/>`).join('')}
    ${pts.filter(Boolean).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.4" fill="var(--accent)"/>`).join('')}</svg>`;
}

/* ---------- toasts & confirm ---------- */
function toast(msg, kind = '', ms = 3200) {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toast-root').appendChild(t); setTimeout(() => t.remove(), ms);
}
function confirmBox({ title, msg, yes = 'Delete', danger = true, onYes }) {
  openModal({ title, body: `<p style="margin:0">${msg}</p>`, saveText: yes, danger, onSave: async () => { await onYes(); } });
}

/* ---------- modal ---------- */
let modalState = null;
function openModal({ title, sub = '', body, onSave, saveText = 'Save', size = '', hideSave = false, cancelText = 'Cancel', danger = false, footLeft = '', onClose }) {
  closeModal(true);
  const root = $('#modal-root');
  root.innerHTML = `<div class="overlay" onmousedown="if(event.target===this)closeModal()"><div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}</div><button class="btn ghost icon sm" type="button" onclick="closeModal()" aria-label="Close">${ic('x')}</button></div>
    <form class="modal-body" id="mform" autocomplete="off" onsubmit="event.preventDefault();$('#msave')?.click()">${body}</form>
    <div class="modal-foot">${footLeft ? `<div class="left">${footLeft}</div>` : ''}<button class="btn" type="button" onclick="closeModal()">${esc(cancelText)}</button>${hideSave ? '' : `<button class="btn ${danger ? 'danger solid' : 'primary'}" type="button" id="msave">${esc(saveText)}</button>`}</div></div></div>`;
  modalState = { onClose };
  if (onSave) $('#msave').onclick = async () => {
    const b = $('#msave'); b.disabled = true;
    try { const r = await onSave(formObj($('#mform')), $('#mform')); if (r !== false) { closeModal(); render(); } }
    catch (e) { toast(e.message, 'err'); }
    finally { if ($('#msave')) $('#msave').disabled = false; }
  };
  setTimeout(() => $('#mform')?.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea,select')?.focus(), 30);
}
function closeModal(silent) {
  DP.close();
  const st = modalState; modalState = null;
  $('#modal-root').innerHTML = '';
  if (!silent && st?.onClose) st.onClose();
}
function formObj(f) {
  const o = {};
  f.querySelectorAll('[name]').forEach(el => {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
  });
  return o;
}
function mtabs(items) {
  return `<div class="mtabs-bar">${items.map(([l], i) => `<button type="button" class="${i ? '' : 'on'}" onclick="mtab(this,${i})">${l}</button>`).join('')}</div>
    ${items.map(([, h], i) => `<div class="mtab-pane ${i ? '' : 'on'}" data-i="${i}">${h}</div>`).join('')}`;
}
function mtab(btn, i) {
  const f = btn.closest('form');
  $$('.mtabs-bar button', f).forEach((b, k) => b.classList.toggle('on', k === i));
  $$('.mtab-pane', f).forEach(p => p.classList.toggle('on', +p.dataset.i === i));
  DP.close();
}

/* ---------- drawer (read-only details) ---------- */
function openDrawer({ title, sub = '', body, foot = '' }) {
  $('#drawer-root').innerHTML = `<div class="drawer-wrap" onmousedown="if(event.target===this)closeDrawer()"><aside class="drawer" role="dialog" aria-label="${esc(title)}">
    <div class="drawer-head"><div><h3>${esc(title)}</h3>${sub ? `<div class="small muted">${sub}</div>` : ''}</div><button class="btn ghost icon sm" onclick="closeDrawer()" aria-label="Close">${ic('x')}</button></div>
    <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}</aside></div>`;
}
function closeDrawer() { $('#drawer-root').innerHTML = ''; }
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (DP.el) return DP.close();
  if ($('#modal-root').innerHTML) return closeModal();
  if ($('#drawer-root').innerHTML) closeDrawer();
});

/* ---------- form field helpers ---------- */
const opts = (arr, val) => arr.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
const lbl = (label, o) => `<span>${label}${o.req ? ' <em>*</em>' : ''}${o.opt ? ' <em>(optional)</em>' : ''}</span>`;
const fld = (label, name, val = '', o = {}) => `<label class="field ${o.cls || ''}">${lbl(label, o)}<input type="${o.type || 'text'}" name="${name}" value="${esc(val ?? '')}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.attrs || ''}>${o.hint ? `<small class="hint">${o.hint}</small>` : ''}</label>`;
const area = (label, name, val = '', o = {}) => `<label class="field ${o.cls ?? 'full'}">${lbl(label, o)}<textarea name="${name}" rows="${o.rows || 3}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>${esc(val ?? '')}</textarea>${o.hint ? `<small class="hint">${o.hint}</small>` : ''}</label>`;
const sel = (label, name, arr, val, o = {}) => `<label class="field ${o.cls || ''}">${lbl(label, o)}<select name="${name}" ${o.attrs || ''}>${opts(arr, val)}</select>${o.hint ? `<small class="hint">${o.hint}</small>` : ''}</label>`;
const chk = (label, name, checked, o = {}) => `<label class="check ${o.cls || ''}"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${o.attrs || ''}>${label}</label>`;
const dfld = (label, name, val = '', o = {}) => `<div class="field ${o.cls || ''}">${lbl(label, o)}${dateInput(`name="${name}"`, val, o.ph || 'Select a date', o.quick)}${o.hint ? `<small class="hint">${o.hint}</small>` : ''}</div>`;

/* ---------- calendar date picker ---------- */
function dateInput(attrs, val, ph = 'Select a date', quick = 'future') {
  return `<div class="dp"><input type="hidden" ${attrs} value="${esc(val || '')}"><button type="button" class="dp-btn ${val ? '' : 'dp-none'}" data-ph="${esc(ph)}" data-quick="${quick || ''}" onclick="DP.open(this)">${ic('calendar', 15)}<span>${val ? fmt(val) : esc(ph)}</span></button></div>`;
}
const DP = {
  el: null, btn: null, input: null, view: null,
  open(btn) {
    if (this.btn === btn) return this.close();
    this.close();
    this.btn = btn; this.input = btn.previousElementSibling;
    const v = this.input.value || today();
    this.view = v.slice(0, 7);
    this.el = document.createElement('div'); this.el.className = 'dp-pop'; this.el.setAttribute('role', 'dialog'); this.el.setAttribute('aria-label', 'Choose date');
    $('#dp-root').appendChild(this.el);
    this.draw(); this.place();
    setTimeout(() => this.el?.querySelector('button.sel,button.today')?.focus(), 0);
  },
  place() {
    const r = this.btn.getBoundingClientRect(), h = this.el.offsetHeight, w = this.el.offsetWidth;
    let top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    this.el.style.top = top + 'px'; this.el.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  },
  draw() {
    const [y, m] = this.view.split('-').map(Number), first = new Date(y, m - 1, 1);
    const offset = (first.getDay() + 6) % 7, start = new Date(y, m - 1, 1 - offset), sel = this.input.value, td = today();
    const cy = new Date().getFullYear(), years = []; for (let i = cy + 6; i >= 1960; i--) years.push(i);
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); const iso = ymd(d);
      cells += `<button type="button" class="${d.getMonth() !== m - 1 ? 'out' : ''} ${iso === td ? 'today' : ''} ${iso === sel ? 'sel' : ''} ${[0, 6].includes(d.getDay()) ? 'wkend' : ''}" onclick="DP.pick('${iso}')" aria-label="${fmt(iso)}">${d.getDate()}</button>`;
    }
    const q = this.btn.dataset.quick;
    const quick = q === 'future' ? [['+1 week', addDays(td, 7)], ['+2 weeks', addDays(td, 14)], ['+1 month', addMonths(td, 1)]] : q === 'past' ? [['Yesterday', addDays(td, -1)], ['1 week ago', addDays(td, -7)]] : [];
    this.el.innerHTML = `<div class="dp-head"><button type="button" class="btn ghost icon sm" onclick="DP.shift(-1)" aria-label="Previous month">${ic('chevL')}</button>
      <select onchange="DP.jump(this.value,null)" aria-label="Month">${MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select onchange="DP.jump(null,this.value)" aria-label="Year">${years.map(v => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <button type="button" class="btn ghost icon sm" onclick="DP.shift(1)" aria-label="Next month" style="margin-left:auto">${ic('chevR')}</button></div>
      <div class="dp-grid">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<span class="wd">${d}</span>`).join('')}${cells}</div>
      <div class="dp-foot"><div class="dp-quick"><button type="button" class="btn sm" onclick="DP.pick('${td}')">Today</button>${quick.map(([l, v]) => `<button type="button" class="btn sm ghost" onclick="DP.pick('${v}')">${l}</button>`).join('')}</div>
      ${this.input.value ? '<button type="button" class="btn sm ghost" onclick="DP.pick(\'\')">Clear</button>' : ''}</div>`;
  },
  shift(n) { const [y, m] = this.view.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); this.view = ymd(d).slice(0, 7); this.draw(); },
  jump(m, y) { const [cy, cm] = this.view.split('-'); this.view = `${y || cy}-${String(m || cm).padStart(2, '0')}`; this.draw(); },
  pick(iso) {
    const inp = this.input, btn = this.btn;
    inp.value = iso;
    btn.classList.toggle('dp-none', !iso);
    btn.querySelector('span').textContent = iso ? fmt(iso) : btn.dataset.ph;
    this.close();
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    btn.focus();
  },
  close() { this.el?.remove(); this.el = this.btn = this.input = null; },
};
document.addEventListener('mousedown', e => { if (DP.el && !DP.el.contains(e.target) && !DP.btn?.contains(e.target)) DP.close(); }, true);
window.addEventListener('resize', () => DP.close());
document.addEventListener('scroll', e => { if (DP.el && !DP.el.contains(e.target)) DP.place(); }, true);

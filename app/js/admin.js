/* =========================================================
   admin.js — central version: users & groups, reportee
   ownership, audit log, server settings and backups
   ========================================================= */
'use strict';

const ADM = { users: null, reps: null, audit: null, settings: null };
const ACTION_LABEL = {
  'register-first-admin': 'Created the first (administrator) account', register: 'Registered', login: 'Signed in', 'login-failed': 'Failed sign-in', logout: 'Signed out',
  profile: 'Chose profile', 'password-changed': 'Changed password', 'password-reset': 'Reset a password', 'password-reset-cli': 'Password reset on the server',
  'user-approved': 'Approved account', 'user-rejected': 'Rejected registration', 'user-updated': 'Changed account', 'user-deleted': 'Deleted account',
  'reportee-created': 'Added reportee', 'reportee-deleted': 'Deleted reportee', 'reportee-archived': 'Archived reportee', 'reportee-restored': 'Restored reportee',
  'reportee-transferred': 'Moved reportee', 'view-all': 'Opened all reportees (people manager)', 'view-reportee': 'Viewed reportee', 'download-report': 'Downloaded report',
  'file-download': 'Downloaded document', 'export-data': 'Exported data', 'import-data': 'Imported data', 'org-config': 'Changed organisation configuration',
  settings: 'Changed server settings', backup: 'Took a backup', restore: 'Restored a backup', 'ai-settings': 'Changed AI settings',
};
const groupBadges = u => `${(u.groups || []).map(g => `<span class="badge ${g === 'pm' ? 'b-acc' : ''}">${PROFILE_LABEL[g]}</span>`).join(' ')}${u.admin ? ' <span class="badge b-warn">Admin</span>' : ''}`;

function pgAdmin(tab, sub) {
  const labels = { users: 'Users & access', ownership: 'Reportee ownership', audit: 'Audit log', server: 'Server settings' };
  if (!labels[tab]) tab = 'users';
  crumbs([['Administration'], [labels[tab]]]);
  const head = pageHead('Administration', 'Accounts, groups and organisation-wide settings for this Team Desk server.') + tabsNav(Object.entries(labels), tab, k => `#/admin/${k}`);
  if (tab === 'ownership') { setTimeout(loadOwnership, 0); return head + `<div id="adm-body">${loadingCard()}</div>`; }
  if (tab === 'audit') { setTimeout(() => loadAudit(V.auditMonth), 0); return head + `<div id="adm-body">${loadingCard()}</div>`; }
  if (tab === 'server') { setTimeout(loadServerSettings, 0); return head + `<div id="adm-body">${loadingCard()}</div>`; }
  setTimeout(loadUsers, 0);
  return head + `<div id="adm-body">${loadingCard()}</div>`;
}
const loadingCard = () => `<div class="card card-body muted"><span class="spin"></span> Loading…</div>`;
const admPaint = html => { const el = $('#adm-body'); if (el) el.innerHTML = html; };

/* ---------------- users ---------------- */
async function loadUsers() {
  try { ADM.users = await api('GET', '/api/admin/users'); } catch (e) { return admPaint(callout('bad', esc(e.message))); }
  if (App.status) App.status.pending = ADM.users.users.filter(u => u.status === 'pending').length;
  renderSidebar(route());
  drawUsers();
}
function drawUsers() {
  const all = ADM.users.users, me = ADM.users.me;
  const pending = all.filter(u => u.status === 'pending'), act = all.filter(u => u.status === 'active'), dis = all.filter(u => u.status === 'disabled');
  const view = V.admUsersView || (pending.length ? 'pending' : 'active');
  const seg2 = `<div class="seg">${[['pending', `Waiting for approval (${pending.length})`], ['active', `Active (${act.length})`], ['disabled', `Disabled (${dis.length})`]].map(([k, l]) => `<button class="${k === view ? 'on' : ''}" onclick="V.admUsersView='${k}';drawUsers()">${l}</button>`).join('')}</div>`;
  const who = u => `<div><b>${esc(u.name)}</b>${u.id === me ? ' <span class="xs muted">(you)</span>' : ''}<div class="xs muted">${esc(u.email)}</div></div>`;
  let body;
  if (view === 'pending') {
    body = pending.length ? `<table class="tbl"><thead><tr><th>Person</th><th>Registered</th><th>Asked for</th><th>Note</th><th></th></tr></thead><tbody>${pending.map(u => `<tr><td>${who(u)}</td><td class="nowrap small">${fmt(u.created.slice(0, 10))}</td>
      <td>${(u.requested || []).map(g => `<span class="badge">${PROFILE_LABEL[g]}</span>`).join(' ') || '<span class="muted small">—</span>'}</td><td class="small">${esc(u.note || '—')}</td>
      <td class="nowrap" style="text-align:right"><button class="btn sm primary" onclick="approveUser('${u.id}')">${ic('check', 14)}Approve</button><button class="btn sm ghost" onclick="rejectUser('${u.id}')">Reject</button></td></tr>`).join('')}</tbody></table>`
      : `<div class="card-body">${emptyState('check', 'No one is waiting', 'New registrations appear here for you to approve and put in a group.')}</div>`;
  } else {
    const rows = view === 'active' ? act : dis;
    body = rows.length ? `<table class="tbl"><thead><tr><th>Person</th><th>Groups</th><th class="c">Reportees</th><th>Last sign-in</th><th></th></tr></thead><tbody>${rows.map(u => `<tr><td>${who(u)}</td><td>${groupBadges(u)}${u.mustChange ? ' <span class="badge">Temporary password</span>' : ''}</td>
      <td class="c">${u.reportees || '<span class="muted">0</span>'}</td><td class="small nowrap">${u.lastLogin ? `${fmt(u.lastLogin.slice(0, 10))}` : '<span class="muted">Never</span>'}</td>
      <td class="nowrap" style="text-align:right">${view === 'active' ? `<button class="btn sm" onclick="editUser('${u.id}')">${ic('edit', 14)}Edit</button>${u.id !== me ? `<button class="btn sm ghost" onclick="resetUserPw('${u.id}')">${ic('key', 14)}Reset password</button><button class="btn sm ghost" onclick="setUserStatus('${u.id}','disabled')">Disable</button>` : ''}`
        : `<button class="btn sm" onclick="setUserStatus('${u.id}','active')">Enable</button>${u.reportees ? '' : `<button class="btn sm ghost" onclick="deleteUser('${u.id}')" aria-label="Delete">${ic('trash', 14)}</button>`}`}</td></tr>`).join('')}</tbody></table>`
      : `<div class="card-body muted">No ${view} accounts.</div>`;
  }
  admPaint(`<div class="card"><div class="spread" style="padding:12px 16px;border-bottom:1px solid var(--line)">${seg2}<span class="small muted">${plural(all.length, 'account')}</span></div><div class="card-body flush tbl-wrap">${body}</div></div>
    <div class="grid g3 mt">${[['users', 'Line manager', 'Adds and manages their own reportees: 1:1s, assessments, goals, development, reviews. Sees nobody else’s team.'],
      ['grid', 'People manager', `Sees every reportee of every line manager, read-only, and downloads reports for HR or leadership. ${App.status?.pmSeesPrivate ? 'Can also see line managers’ private notes.' : 'Line managers’ private notes stay hidden.'}`],
      ['shield', 'Administrator', 'Approves accounts, sets groups, moves reportees between managers, edits the competency framework and organisation settings. Sees reportee data only through a group.']]
      .map(([i, t, d]) => card('', `<div class="row" style="align-items:flex-start;flex-wrap:nowrap">${ic(i, 18, 'style="color:var(--accent);margin-top:2px"')}<div><b>${t}</b><div class="small muted">${d}</div></div></div>`)).join('')}</div>`);
}
function groupChecks(u, defaults) {
  const g = u?.groups?.length ? u.groups : defaults || ['lm'];
  return `<div class="grid" style="gap:10px">${chk('<b>Line manager</b> — manages their own reportees', 'lm', g.includes('lm'))}${chk('<b>People manager</b> — views all reportees across managers (read-only)', 'pm', g.includes('pm'))}
    ${chk('<b>Administrator</b> — approves accounts and manages settings', 'admin', !!u?.admin)}</div>
    <div class="xs muted mt-s">Someone in both Line manager and People manager chooses a profile after signing in, and can switch at any time.</div>`;
}
const groupsFrom = d => GROUPS_ORDER.filter(g => d[g]);
const GROUPS_ORDER = ['lm', 'pm'];
function approveUser(id) {
  const u = ADM.users.users.find(x => x.id === id);
  openModal({ title: 'Approve account', sub: `${esc(u.name)} · ${esc(u.email)}`, saveText: 'Approve', body: `${u.note ? callout('info', `Their note: “${esc(u.note)}”`) : ''}${groupChecks(null, u.requested?.length ? u.requested : ['lm'])}`,
    onSave: async d => {
      if (!d.lm && !d.pm && !d.admin) { toast('Choose at least one group', 'err'); return false; }
      try { await api('POST', `/api/admin/users/${id}/approve`, { groups: groupsFrom(d), admin: d.admin }); toast(`${firstName(u.name)} can now sign in`); }
      catch (e) { toast(e.message, 'err'); return false; }
      loadUsers();
    } });
}
function rejectUser(id) {
  const u = ADM.users.users.find(x => x.id === id);
  confirmBox({ title: 'Reject registration?', msg: `<b>${esc(u.name)}</b> (${esc(u.email)}) will not get access. They can register again later.`, yes: 'Reject',
    onYes: async () => { await api('POST', `/api/admin/users/${id}/reject`); toast('Registration rejected'); loadUsers(); } });
}
function editUser(id) {
  const u = ADM.users.users.find(x => x.id === id);
  openModal({ title: 'Edit account', sub: esc(u.email), saveText: 'Save', body: `${fld('Name', 'name', u.name)}<div class="sec-label mt">Groups</div>${groupChecks(u)}
      ${u.reportees && u.groups.includes('lm') ? `<div class="mt">${callout('info', `${esc(firstName(u.name))} owns ${plural(u.reportees, 'reportee')}. To remove the Line manager group, first move them in <a href="#/admin/ownership" onclick="closeModal()">Reportee ownership</a>.`)}</div>` : ''}`,
    onSave: async d => {
      try { await api('PUT', `/api/admin/users/${id}`, { name: d.name, groups: groupsFrom(d), admin: d.admin }); toast('Account updated'); }
      catch (e) { toast(e.message, 'err', 6000); return false; }
      loadUsers();
    } });
}
function resetUserPw(id) {
  const u = ADM.users.users.find(x => x.id === id);
  confirmBox({ title: 'Reset password?', msg: `${esc(u.name)} will be signed out everywhere and get a temporary password. They must choose a new one when they next sign in.`, yes: 'Reset password', danger: false,
    onYes: async () => {
      const r = await api('POST', `/api/admin/users/${id}/reset-password`);
      setTimeout(() => openModal({ title: 'Temporary password', sub: esc(u.email), hideSave: true, cancelText: 'Done',
        body: `<div class="row"><code style="font-size:18px;padding:8px 12px;background:var(--panel-2);border:1px solid var(--line);border-radius:8px;user-select:all">${esc(r.temp)}</code><button type="button" class="btn sm" onclick="navigator.clipboard?.writeText('${esc(r.temp)}');toast('Copied')">Copy</button></div>
          ${callout('warn', 'Share it with them privately (not by email to a shared mailbox). It is shown only once.')}` }), 50);
      loadUsers();
    } });
}
async function setUserStatus(id, status) {
  const u = ADM.users.users.find(x => x.id === id);
  const go = async () => { try { await api('PUT', `/api/admin/users/${id}`, { status }); toast(status === 'disabled' ? `${firstName(u.name)} can no longer sign in` : `${firstName(u.name)} is enabled again`); loadUsers(); } catch (e) { toast(e.message, 'err', 6000); } };
  if (status !== 'disabled') return go();
  confirmBox({ title: 'Disable account?', msg: `${esc(u.name)} will be signed out and can’t sign in until re-enabled. ${u.reportees ? `Their ${plural(u.reportees, 'reportee')} stay as they are — move them to another line manager in <b>Reportee ownership</b>.` : ''}`, yes: 'Disable', onYes: go });
}
function deleteUser(id) {
  const u = ADM.users.users.find(x => x.id === id);
  confirmBox({ title: 'Delete account?', msg: `The account for <b>${esc(u.name)}</b> and their personal settings will be deleted. The audit log keeps its history.`,
    onYes: async () => { await api('DELETE', `/api/admin/users/${id}`); toast('Account deleted'); loadUsers(); } });
}

/* ---------------- reportee ownership ---------------- */
async function loadOwnership() {
  try { [ADM.reps, ADM.users] = await Promise.all([api('GET', '/api/admin/reportees'), api('GET', '/api/admin/users')]); }
  catch (e) { return admPaint(callout('bad', esc(e.message))); }
  drawOwnership();
}
function drawOwnership() {
  const users = ADM.users.users, byId = Object.fromEntries(users.map(u => [u.id, u]));
  const lms = users.filter(u => u.status === 'active' && u.groups.includes('lm')).sort((a, b) => a.name.localeCompare(b.name));
  const groups = {};
  ADM.reps.forEach(r => (groups[r.managerId] = groups[r.managerId] || []).push(r));
  const order = Object.keys(groups).sort((a, b) => (byId[a]?.name || '~').localeCompare(byId[b]?.name || '~'));
  const needs = id => !byId[id] || byId[id].status !== 'active' || !byId[id].groups.includes('lm');
  admPaint(`${order.some(needs) ? callout('warn', 'Some reportees belong to a manager who is disabled, deleted or no longer a line manager. Move them so someone keeps their 1:1s and reviews going.') : ''}
    <div class="card mt-s"><div class="spread" style="padding:12px 16px;border-bottom:1px solid var(--line)"><span class="small muted">Select reportees, then choose their new line manager. Their full history moves with them; the previous manager loses access.</span>
      <div class="row"><select class="input ro-ok" id="own-to" style="width:auto;height:32px">${opts([['', 'Move selected to…'], ...lms.map(u => [u.id, u.name])], '')}</select><button class="btn sm primary" onclick="doTransfer()">${ic('swap', 14)}Move</button></div></div>
    <div class="card-body flush">${order.length ? order.map(mid => `<div class="own-group"><div class="own-head"><label class="check"><input type="checkbox" onchange="$$('.own-g-${mid} input').forEach(i=>i.checked=this.checked)"><b>${esc(byId[mid]?.name || 'Unknown / deleted manager')}</b></label>
        <span class="small muted">${esc(byId[mid]?.email || '')}</span>${needs(mid) ? '<span class="badge b-warn">Needs a new line manager</span>' : ''}<span class="small muted" style="margin-left:auto">${plural(groups[mid].length, 'reportee')}</span></div>
      <div class="own-list own-g-${mid}">${groups[mid].sort((a, b) => a.name.localeCompare(b.name)).map(r => `<label class="check"><input type="checkbox" value="${esc(r.id)}" class="own-pick">${esc(r.name || '(no name)')}${r.grade ? ` <span class="xs muted">· ${esc(r.grade)}</span>` : ''}${r.archived ? ' <span class="badge">Archived</span>' : ''}</label>`).join('')}</div></div>`).join('')
      : `<div class="card-body">${emptyState('users', 'No reportees yet', 'Reportees appear here once line managers add them.')}</div>`}</div></div>`);
}
async function doTransfer() {
  const ids = $$('.own-pick:checked').map(i => i.value), to = $('#own-to').value;
  if (!ids.length) return toast('Select at least one reportee', 'err');
  if (!to) return toast('Choose the new line manager', 'err');
  const name = ADM.users.users.find(u => u.id === to)?.name;
  confirmBox({ title: `Move ${plural(ids.length, 'reportee')}?`, msg: `They will report to <b>${esc(name)}</b>, who gets their full history. Their current line manager loses access.`, yes: 'Move', danger: false,
    onYes: async () => { const r = await api('POST', '/api/admin/transfer', { ids, to }); toast(`Moved ${plural(r.moved, 'reportee')} to ${name}`); loadOwnership(); } });
}

/* ---------------- audit log ---------------- */
async function loadAudit(month) {
  try { ADM.audit = await api('GET', '/api/admin/audit' + (month ? `?month=${month}` : '')); } catch (e) { return admPaint(callout('bad', esc(e.message))); }
  V.auditMonth = ADM.audit.month; drawAudit();
}
function drawAudit() {
  const a = ADM.audit, q = (V.auditQ || '').toLowerCase(), kind = V.auditKind || '';
  const groups = { access: ['login', 'login-failed', 'logout', 'profile', 'password-changed'], people: ['view-all', 'view-reportee', 'download-report', 'file-download', 'export-data', 'import-data'],
    admin: ['register', 'register-first-admin', 'user-approved', 'user-rejected', 'user-updated', 'user-deleted', 'password-reset', 'password-reset-cli', 'settings', 'backup', 'restore', 'ai-settings', 'org-config'],
    records: ['reportee-created', 'reportee-deleted', 'reportee-archived', 'reportee-restored', 'reportee-transferred'] };
  const rows = a.entries.filter(e => (!kind || groups[kind].includes(e.action)) && (!q || JSON.stringify(e).toLowerCase().includes(q)));
  admPaint(`<div class="card"><div class="spread" style="padding:12px 16px;border-bottom:1px solid var(--line)"><div class="row">
      <select class="input ro-ok" style="width:auto;height:32px" onchange="loadAudit(this.value)">${opts(a.months.length ? a.months.map(m => [m, fmtMonth(m)]) : [['', 'No entries yet']], a.month)}</select>
      <select class="input ro-ok" style="width:auto;height:32px" onchange="V.auditKind=this.value;drawAudit()">${opts([['', 'All events'], ['access', 'Sign-ins'], ['people', 'Views & downloads'], ['records', 'Reportee records'], ['admin', 'Administration']], kind)}</select></div>
      <input class="input ro-ok" id="aud-q" style="max-width:240px;height:32px" placeholder="Search…" value="${esc(V.auditQ || '')}" oninput="V.auditQ=this.value;clearTimeout(window._aq);window._aq=setTimeout(()=>{drawAudit();const i=$('#aud-q');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)"></div>
    ${rows.length ? `<div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th><th>About</th><th>Details</th></tr></thead><tbody>${rows.slice(0, 500).map(e => `<tr>
      <td class="nowrap small">${e.at ? `${fmt(e.at.slice(0, 10))} <span class="muted">${new Date(e.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>` : '—'}</td>
      <td class="small">${e.byName ? `<b>${esc(e.byName)}</b>${e.profile ? `<div class="xs muted">${esc(PROFILE_LABEL[e.profile] || e.profile)}</div>` : ''}` : '<span class="muted">—</span>'}</td>
      <td class="small"><span class="${e.action === 'login-failed' ? 'badge b-bad' : ''}">${esc(ACTION_LABEL[e.action] || e.action)}</span></td>
      <td class="small">${esc(e.targetName || e.target || '')}</td><td class="small muted">${esc(e.detail || e.ip || '')}</td></tr>`).join('')}</tbody></table></div>${rows.length > 500 ? '<div class="card-foot"><span class="xs muted">Showing the latest 500 — use search to narrow down.</span></div>' : ''}`
      : `<div class="card-body">${emptyState('clipboard', 'No matching events', 'Sign-ins, approvals, ownership changes, people-manager views and report downloads are recorded here, encrypted.')}</div>`}</div>`);
}

/* ---------------- server settings, backups, AI ---------------- */
async function loadServerSettings() {
  try { ADM.settings = await api('GET', '/api/admin/settings'); } catch (e) { return admPaint(callout('bad', esc(e.message))); }
  const s = ADM.settings;
  admPaint(`<div class="grid g2">${card('Access & privacy', `<form class="fgrid" id="srv-form">
      ${chk('Allow new registrations', 'registrationOpen', s.registrationOpen, { cls: 'full' })}
      ${fld('Only allow these email domains', 'allowedDomains', s.allowedDomains, { cls: 'full', ph: 'e.g. company.com, company.in', hint: 'Comma-separated. Leave empty to allow any address (registrations still need your approval).' })}
      ${sel('Sign people out after inactivity', 'sessionMinutes', [[15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours'], [480, '8 hours']], s.sessionMinutes)}
      ${chk('People managers can see line managers’ private notes', 'pmSeesPrivate', s.pmSeesPrivate, { cls: 'full' })}
      <div class="xs muted full">Private notes are the “Private notes” box in 1:1s and “Personal context” on a profile. Line managers see a label telling them who can read these.</div></form>
      <div class="row mt"><button class="btn primary" onclick="saveServerSettings()">Save</button></div>`)}
    ${card('Security', `<dl class="kv"><dt>Version</dt><dd>${esc(APP_VERSION)} (central)</dd><dt>Address</dt><dd>${esc(location.origin)}</dd><dt>Connection</dt><dd>${location.protocol === 'https:' ? '<span class="badge b-good">HTTPS</span>' : '<span class="badge b-warn">Not HTTPS</span> <span class="small muted">Use HTTPS before people sign in over the network.</span>'}</dd><dt>Runtime</dt><dd>Node ${esc(App.status?.node || '')} · ${esc(App.status?.platform || '')}</dd></dl>
      <div class="small muted mt">All records, documents and the audit log are encrypted on disk (AES-256-GCM) with the server key. Passwords are stored as salted scrypt hashes. Forgotten administrator password? On the server run <code>node server/central.js --reset-password you@company.com</code>.</div>`)}</div>
    <div class="card mt"><div class="card-head"><div><h2>Backups</h2><p>A snapshot of all records is taken automatically each day (last 30 kept). Snapshots don’t include uploaded documents or user accounts. Also back up the data folder and the server key with your normal server backups.</p></div>
      <button class="btn sm primary" onclick="admBackupNow()">${ic('database', 14)}Back up now</button></div><div class="card-body flush" id="bk-list"><div class="card-body muted">Loading…</div></div></div>
    <div class="mt">${setAi()}</div>`);
  admLoadBackups(); loadAiStatus();
}
async function saveServerSettings() {
  const d = formObj($('#srv-form'));
  try { ADM.settings = await api('PUT', '/api/admin/settings', { ...d, sessionMinutes: +d.sessionMinutes }); App.status.pmSeesPrivate = ADM.settings.pmSeesPrivate; toast('Server settings saved'); loadServerSettings(); }
  catch (e) { toast(e.message, 'err'); }
}
async function admLoadBackups() {
  const el = $('#bk-list'); if (!el) return;
  try {
    const bs = await api('GET', '/api/admin/backups');
    el.innerHTML = bs.length ? `<table class="tbl"><thead><tr><th>Snapshot</th><th>Type</th><th class="c">Reportees</th><th></th></tr></thead><tbody>${bs.map(b => `<tr><td><b>${esc(b.name.slice(0, 10))}</b> <span class="small muted">${esc(b.name.slice(11, 17).replace(/(\d\d)(\d\d)(\d\d)/, '$1:$2'))}</span></td><td>${esc(b.kind)}</td><td class="c">${b.reportees}</td>
      <td style="text-align:right"><button class="btn sm" onclick="admRestore('${esc(b.name)}')">Restore</button></td></tr>`).join('')}</tbody></table>` : '<div class="card-body muted">No snapshots yet.</div>';
  } catch (e) { el.innerHTML = `<div class="card-body muted">${esc(e.message)}</div>`; }
}
async function admBackupNow() { try { await Store.flush(); await api('POST', '/api/admin/backups'); toast('Snapshot saved'); admLoadBackups(); } catch (e) { toast(e.message, 'err'); } }
function admRestore(name) {
  confirmBox({ title: 'Restore this snapshot for everyone?', msg: `Every manager’s records and the organisation configuration go back to <b>${esc(name)}</b>. User accounts are not changed. A snapshot of the current state is taken first, so this can be undone.`, yes: 'Restore',
    onYes: async () => { await Store.flush(); await api('POST', '/api/admin/backups/restore', { name }); toast('Snapshot restored'); await Store.load(); render(); } });
}

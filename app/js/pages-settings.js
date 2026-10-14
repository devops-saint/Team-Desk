/* =========================================================
   pages-settings.js — General, Security, Data & backups, About
   ========================================================= */
'use strict';

function pgSettings(tab) {
  const labels = CENTRAL ? { general: 'General', ai: 'AI assistant', security: 'Account & security', ...(isLM() ? { data: 'My data' } : {}), about: 'About & toolkit' }
    : { general: 'General', ai: 'AI assistant', security: 'Security', data: 'Data & backups', about: 'About & toolkit' };
  if (!labels[tab]) tab = 'general';
  crumbs([['Settings'], [labels[tab]]]);
  const head = pageHead('Settings', '') + tabsNav(Object.entries(labels), tab, k => `#/settings/${k}`);
  if (tab === 'security') return head + (CENTRAL ? setAccount() : setSecurity());
  if (tab === 'data') { if (CENTRAL) return head + setMyData(); setTimeout(loadBackups, 0); return head + setData(); }
  if (tab === 'about') return head + setAbout();
  if (tab === 'ai') { setTimeout(loadAiStatus, 0); return head + (CENTRAL && !isAdmin() ? setAiUser() : setAi()); }
  const s = S.settings, cfgOk = canEditConfig();
  return head + card('General', `<form class="fgrid" onchange="saveSettings(this)">
    ${fld(CENTRAL ? 'Name shown in Team Desk' : 'Your name', 'managerName', s.managerName, { hint: 'Used for greetings, initials on competency ratings and the upward-feedback form.' })}
    ${sel('Review year starts in', 'cycleStartMonth', MONTHS.map((m, i) => [i + 1, m]), s.cycleStartMonth, { hint: `Current cycle: ${esc(cycleOf().label)}${cfgOk ? '' : ' · set by your administrators'}`, attrs: cfgOk ? '' : 'disabled' })}
    ${sel('Appearance', 'theme', [['', 'Match my system'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}
    ${sel('Minimum responses before upward feedback is shown', 'upwardMin', [3, 4, 5, 6, 8, 10].map(n => [n, n]), s.upwardMin || 3, { hint: 'Higher numbers protect anonymity better.' })}</form>`, { sub: 'Changes save automatically' });
}
function saveSettings(form) { const d = formObj(form); d.cycleStartMonth = +d.cycleStartMonth; if (!canEditConfig()) delete d.cycleStartMonth; d.upwardMin = +d.upwardMin; Object.assign(S.settings, d); applyTheme(); save(); render(); }

function setSecurity() {
  const al = App.status?.autoLockMinutes ?? 15;
  return `<div class="grid g2">${card('Password', `<p class="small" style="margin-top:0">Your password encrypts every file in your data folder (AES-256). It is never stored — if you forget it, the data cannot be recovered.</p>
      <button class="btn primary" onclick="changePassword()">${ic('key', 15)}Change password</button>`)}
    ${card('Automatic lock', `<label class="field"><span>Lock Team Desk after inactivity</span><select class="input" onchange="setAutoLock(this.value)">${opts([[5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [0, 'Never']], al)}</select></label>
      <div class="mt"><button class="btn" onclick="lockNow()">${ic('lock', 15)}Lock now</button></div>`)}</div>
    <div class="mt">${callout('info', `<b>How your data is protected</b><br>• Team Desk runs only on this computer and accepts connections only from it.<br>• Every reportee is stored in a separate encrypted file; documents are encrypted too.<br>• Nothing is sent to the internet. The only network use is downloading open-source file readers the first time you upload a PDF, Word or Excel file (skip this by running <code>npm install</code>).<br>• Team-wide pages are for you only — exports for a reportee contain only that reportee.`, 'shield')}</div>`;
}
async function setAutoLock(v) { try { const r = await api('PUT', '/api/config', { autoLockMinutes: +v }); App.status.autoLockMinutes = r.autoLockMinutes; toast(+v ? `Team Desk will lock after ${v} minutes of inactivity` : 'Automatic lock turned off'); } catch (e) { toast(e.message, 'err'); } }
function changePassword() {
  openModal({ title: 'Change password', sub: 'All files in your data folder will be re-encrypted. This can take a moment.', saveText: 'Change password',
    body: `${fld('Current password', 'current', '', { type: 'password', attrs: 'autocomplete="current-password"' })}${fld('New password', 'next', '', { type: 'password', attrs: 'autocomplete="new-password" oninput="pwMeter(this.value)"', hint: 'At least 8 characters. A short sentence is easy to remember and hard to guess.' })}
      <div class="strength"><i id="pwm" style="width:0"></i></div>${fld('Confirm new password', 'confirm', '', { type: 'password', attrs: 'autocomplete="new-password"' })}
      ${callout('warn', 'Backups made before the change can’t be restored from inside Team Desk afterwards. Write the new password down somewhere safe.')}`,
    onSave: async d => {
      if (d.next.length < 8) { toast('Use at least 8 characters', 'err'); return false; }
      if (d.next !== d.confirm) { toast('The new passwords don’t match', 'err'); return false; }
      await Store.flush();
      try { await api('POST', '/api/password', { current: d.current, next: d.next }); toast('Password changed'); }
      catch (e) { toast(e.message, 'err'); return false; }
    } });
}
function pwMeter(v) {
  let s = 0; if (v.length >= 8) s++; if (v.length >= 12) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v) || v.includes(' ')) s++;
  const el = $('#pwm'); if (!el) return; el.style.width = (s / 5 * 100) + '%'; el.style.background = s <= 2 ? 'var(--bad)' : s <= 3 ? 'var(--warn)' : 'var(--good)';
}

function setData() {
  return `<div class="grid g2">${card('Data folder', `<div class="sec-label">Location</div><div class="fb-path" style="padding:8px 10px;background:var(--panel-2);border:1px solid var(--line);border-radius:8px">${esc(App.status?.dataDir || '')}</div>
      <p class="small muted">Encrypted files: <code>org.tde</code> (settings &amp; framework), <code>reportees/</code> (one file per person), <code>files/</code> (documents), <code>backups/</code>.</p>
      <div class="row"><button class="btn" onclick="moveFolder()">${ic('folder', 15)}Move to another folder</button><button class="btn" onclick="openOtherFolder()">${ic('external', 15)}Open a different data folder</button></div>`)}
    ${card('Move to a central Team Desk server', `<p class="small" style="margin-top:0">Your organisation runs Team Desk centrally? Export everything here — reportees, documents, your leadership notes and the configuration — then sign in to the central server and import it under <b>Settings › My data</b>.</p>
      ${callout('warn', 'The export file is <b>not encrypted</b>. Keep it somewhere safe and delete it after importing.')}
      <button class="btn" onclick="exportData()">${ic('download', 15)}Export all data</button>`)}
    ${card('Import from previous version', `<p class="small" style="margin-top:0">If you used the earlier browser-only Team Desk, export a backup there (Settings → Export backup) and import it here. This replaces the current data.</p>
      <button class="btn" onclick="pickFiles('.json,.tdbackup',false,f=>importLegacy(f,()=>render()))">${ic('upload', 15)}Import backup file</button>`)}</div>
    <div class="card mt"><div class="card-head"><div><h2>Backups</h2><p>A snapshot is taken automatically the first time you save each day; the last 30 days are kept. Snapshots include all records but not uploaded documents.</p></div>
      <button class="btn sm primary" onclick="backupNow()">${ic('database', 14)}Back up now</button></div><div class="card-body flush" id="bk-list"><div class="card-body muted">Loading…</div></div></div>`;
}
async function loadBackups() {
  const el = $('#bk-list'); if (!el) return;
  try {
    const bs = await api('GET', '/api/backups');
    el.innerHTML = bs.length ? `<table class="tbl"><thead><tr><th>Snapshot</th><th>Type</th><th class="c">Reportees</th><th></th></tr></thead><tbody>${bs.map(b => `<tr><td><b>${esc(b.name.slice(0, 10))}</b> <span class="small muted">${esc(b.name.slice(11, 17).replace(/(\d\d)(\d\d)(\d\d)/, '$1:$2'))}</span></td><td>${esc(b.kind)}</td><td class="c">${b.reportees}</td>
      <td style="text-align:right">${b.samePassword ? `<button class="btn sm" onclick="restoreBackup('${esc(b.name)}')">Restore</button>` : '<span class="small muted">older password</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="card-body muted">No snapshots yet.</div>';
  } catch (e) { el.innerHTML = `<div class="card-body muted">${esc(e.message)}</div>`; }
}
async function backupNow() { try { await Store.flush(); await api('POST', '/api/backups'); toast('Snapshot saved'); loadBackups(); } catch (e) { toast(e.message, 'err'); } }
function restoreBackup(name) {
  confirmBox({ title: 'Restore this snapshot?', msg: `All records will be replaced with the snapshot <b>${esc(name)}</b>. A snapshot of the current state is taken first, so you can undo this.`, yes: 'Restore', danger: false,
    onYes: async () => { await Store.flush(); await api('POST', '/api/backups/restore', { name }); App.dataRev = (await api('GET', '/api/status')).dataRev; await Store.load(); toast('Snapshot restored'); } });
}
function moveFolder() {
  openModal({ title: 'Move data to another folder', sub: 'Everything is copied to the new location and Team Desk switches to it. The old folder is left as it is, so you can delete it once you’ve checked.', size: 'wide', saveText: 'Move here',
    body: `<div id="fbx"></div>`, onSave: async () => {
      await Store.flush();
      try { const r = await api('POST', '/api/folder/move', { target: FB.path }); App.status.dataDir = r.dataDir; toast('Data moved to ' + r.dataDir, '', 5000); }
      catch (e) { toast(e.message, 'err', 5000); return false; }
    } });
  FB.mount('#fbx', App.status?.home);
}
function openOtherFolder() {
  openModal({ title: 'Open a different data folder', sub: 'Choose a folder that already contains Team Desk data. You’ll need its password.', size: 'wide', saveText: 'Open folder',
    body: `<div id="fbx"></div>`, onSave: async () => {
      if (!FB.data?.teamdesk) { toast('That folder doesn’t contain Team Desk data', 'err'); return false; }
      await Store.flush();
      try { await api('POST', '/api/folder/open', { dir: FB.path }); location.hash = ''; location.reload(); }
      catch (e) { toast(e.message, 'err'); return false; }
    } });
  FB.mount('#fbx', App.status?.home);
}

function setAbout() {
  const tools = [
    ['message', '1:1 meetings with GROW coaching', 'Monthly connects with structured Goal–Reality–Options–Way-forward coaching, morale, action items that carry forward, and next-meeting dates.'],
    ['grid', 'Competency matrix (your organisation’s)', 'Self vs manager ratings against grade expectations, next-grade preview, Excel import/export in the org layout, team heatmap, gaps and peer-coaching suggestions.'],
    ['layers', 'Technical skill matrix', '1–5 ratings with role-based targets, gap analysis and internal-mentor matching.'],
    ['bars', 'KPIs per role', 'Upload KPI sheets, rate actuals each half-year, weighted score.'],
    ['target', 'Goals / OKRs', 'Weighted goals per cycle with success measures, status and progress history.'],
    ['trend', 'Individual development plans', 'Actions linked to competency and skill gaps, with gap alerts.'],
    ['heart', 'Feedback log with SBI', 'Situation–Behaviour–Impact structure for specific, fair feedback and recognition.'],
    ['award', '9-box, flight risk & stay conversations', 'Performance × potential placement, retention risk and structured stay-interview questions.'],
    ['users', 'Succession & promotion readiness', 'Readiness, target role and key-person flags, backed by competency evidence.'],
    ['clipboard', 'Improvement plans', 'Documented expectations, support, fortnightly check-ins and outcome.'],
    ['bars', 'Calibration', 'Ratings vs evidence checks, 9-box consistency and distribution against your guideline.'],
    ['heart', 'Engagement trends', 'Morale from 1:1s over six months, per person and team.'],
    ['compass', 'My leadership', 'Habits scorecard computed from your records, self-assessment on 12 manager competencies, and anonymous upward feedback (Start/Stop/Continue).'],
    ['flag', 'Where to focus', 'Prioritised list per reportee and across the team, drawing on all of the above.'],
    ['compass', 'Suggested actions', 'Analyses 1:1 notes, guided answers and uploaded documents for wellbeing, workload, retention, blockers, delivery risk, conflict, learning, certifications, recognition and leave — with optional local AI. You review and accept.'],
    ['clipboard', 'Guided 1:1 question bank & agenda', '15 topics from wellbeing to org contributions, with monthly/quarterly cadence, last month’s answers, and a “prepare next 1:1” agenda.'],
    ['calendar', 'Leave & availability', 'Planned leave per person, team overlaps and clashes with deadlines.'],
    ['download', 'Reports for HR & leadership', 'A complete record for one reportee as PDF, Word or Excel — choose the sections and period; private notes are left out unless you include them.'],
    ...(CENTRAL ? [['shield', 'Roles & access', 'Line managers see only their own reportees; people managers see every team, view only; administrators approve accounts. Every view, download and change of ownership is audited.']] : []),
  ];
  return `<div class="grid g-side">${card('Manager toolkit', tools.map(([i, t, d]) => `<div class="list-row">${ic(i, 18, 'style="color:var(--accent);margin-top:2px"')}<div><b>${t}</b><div class="small muted">${d}</div></div></div>`).join(''))}
    <div class="grid" style="align-content:start">${card('About', `<dl class="kv"><dt>Version</dt><dd>${esc(APP_VERSION)}${CENTRAL ? ' · central server' : ''}</dd><dt>Runtime</dt><dd>Node ${esc(App.status?.node || '')} · ${esc(App.status?.platform || '')}</dd><dt>Address</dt><dd>${esc(location.origin)}</dd>${CENTRAL ? `<dt>Signed in as</dt><dd>${esc(App.user?.name)} · ${esc(PROFILE_LABEL[App.profile] || '')}</dd>` : ''}</dl>`)}
      ${CENTRAL ? '' : card('Stop Team Desk', `<p class="small" style="margin-top:0">Saves any pending changes, locks your data and stops the local server. Start it again with the launcher.</p><button class="btn danger" onclick="stopServer()">${ic('power', 15)}Stop Team Desk</button>`)}</div></div>`;
}
async function stopServer() {
  await Store.flush();
  try { await api('POST', '/api/lock'); await api('POST', '/api/shutdown'); } catch {}
  App.ready = false;
  $('#shell').hidden = true;
  $('#gate').innerHTML = `<div class="gate"><div class="gate-card narrow"><div class="gate-body" style="text-align:center;padding:36px 26px"><div class="brand-mark" style="margin:0 auto">TD</div><h2 class="mt">Team Desk has stopped</h2><p class="muted">Your data is saved and encrypted. You can close this tab.</p></div></div></div>`;
}

/* ---------- AI assistant (local, via Ollama) ---------- */
function setAi() {
  return `<div class="grid g-side"><div class="card"><div class="card-head"><div><h2>Local AI assistant</h2><p>Deeper suggestions from 1:1 notes and documents, using an AI model that runs on ${CENTRAL ? 'the Team Desk server' : 'this computer'} through Ollama. Nothing is sent to the internet.</p></div></div>
      <div class="card-body" id="ai-box"><div class="muted">Checking for Ollama…</div></div></div>
    ${card('How it works', `<div class="list-row small">${ic('check', 15, 'style="color:var(--good)"')}<span><b>Built-in analysis always runs</b> — rules that spot wellbeing, workload, retention, blockers, delivery risk, learning, certifications, recognition and leave. No set-up needed.</span></div>
      <div class="list-row small">${ic('compass', 15, 'style="color:var(--accent)"')}<span><b>Local AI adds</b> a summary, nuance and suggestions the rules can’t catch, plus personalised questions for your next 1:1.</span></div>
      <div class="list-row small">${ic('shield', 15, 'style="color:var(--accent)"')}<span><b>Private:</b> Team Desk’s server talks to Ollama on <code>localhost</code> only${CENTRAL ? ' (or the address set by the server operator)' : ''}. Suggestions are never applied without your review.</span></div>
      <div class="list-row small">${ic('download', 15, 'style="color:var(--muted)"')}<span><b>Set-up:</b> install Ollama from ollama.com${CENTRAL ? ' on the server' : ''}, then run <code>ollama pull llama3.1:8b</code> (or <code>qwen2.5:7b</code>). 8 GB+ RAM recommended.</span></div>`)}</div>`;
}
async function loadAiStatus() {
  const el = $('#ai-box'); if (!el) return;
  const st = await AI.refresh();
  if (!st) { el.innerHTML = callout('bad', 'Could not check the AI status.'); return; }
  if (CENTRAL && !isAdmin()) {
    el.innerHTML = st.enabled && st.available ? callout('good', `Local AI is on (${esc(st.model)}). Suggested actions use it as well as the built-in analysis.`)
      : st.enabled ? callout('warn', 'Local AI is turned on but the server can’t reach it right now. The built-in analysis still works.')
      : callout('info', 'Local AI is not turned on for this server. The built-in analysis still suggests actions. Ask an administrator if you’d like it.');
    return;
  }
  const models = st.models || [];
  el.innerHTML = `<div class="row mb">${st.available ? `<span class="badge b-good">${ic('check', 12)} Ollama detected</span><span class="small muted">${plural(models.length, 'model')} installed</span>` : `<span class="badge b-warn">Ollama not detected</span><span class="small muted">${esc(st.error || '')}</span>`}</div>
    <div class="fgrid">${st.available && models.length ? sel('Model', 'model', [['', '— choose a model —'], ...models.map(m => [m.name, `${m.name}${m.params ? ` · ${m.params}` : ''}`])], st.model, { attrs: 'id="ai-model"' })
      : fld('Model', 'model', st.model, { attrs: 'id="ai-model"', ph: 'e.g. llama3.1:8b', hint: st.available ? 'No models installed yet — run “ollama pull llama3.1:8b”.' : '' })}
      ${fld('Ollama address', 'url', st.url, { attrs: `id="ai-url" ${st.fixedUrl ? 'disabled' : ''}`, hint: st.fixedUrl ? 'Set by the server operator (TEAMDESK_AI_URL).' : CENTRAL ? 'Must be on the Team Desk server.' : 'Must be on this computer.' })}
      ${chk('Use local AI for suggestions', 'enabled', st.enabled, { attrs: 'id="ai-on"', cls: 'full' })}
      ${chk('Run automatically after each 1:1 and document upload (otherwise only when you click “Suggest actions”)', 'auto', S.settings.aiAuto !== false, { attrs: 'id="ai-auto"', cls: 'full' })}</div>
    <div class="row mt"><button class="btn primary" onclick="saveAi()">Save</button><button class="btn" onclick="testAi()" ${st.available ? '' : 'disabled'}>Test</button><button class="btn ghost" onclick="loadAiStatus()">${ic('refresh', 14)}Re-check</button></div><div id="ai-test" class="mt"></div>`;
}
async function saveAi() {
  try {
    await api('PUT', '/api/ai/config', { model: $('#ai-model').value, url: $('#ai-url').value, enabled: $('#ai-on').checked });
    S.settings.aiAuto = $('#ai-auto').checked; save();
    if ($('#ai-on').checked && !$('#ai-model').value) toast('Choose a model to use local AI', 'err'); else toast('AI settings saved');
    await loadAiStatus();
  } catch (e) { toast(e.message, 'err'); }
}
async function testAi() {
  await saveAi();
  const el = $('#ai-test'); if (!el) return; el.innerHTML = callout('info', '<span class="spin"></span> Sending a short test to the model — the first run can take a minute while it loads…');
  try {
    const r = await AI.chat('Reply with JSON only: {"ok":true,"message":"..."}', 'Say hello to a busy manager in under ten words.');
    el.innerHTML = callout('good', `Local AI is working: “${esc(r.message || 'ok')}”`);
  } catch (e) { el.innerHTML = callout('bad', esc(e.message)); }
}

/* ---------- central version: account, AI status, my data ---------- */
function setAccount() {
  const u = App.user || {};
  return `<div class="grid g2">${card('Your account', `<dl class="kv"><dt>Name</dt><dd>${esc(u.name)}</dd><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Groups</dt><dd>${(u.groups || []).map(g => esc(PROFILE_LABEL[g])).join(', ') || '—'}${u.admin ? ', Administrator' : ''}</dd><dt>Using now</dt><dd>${esc(PROFILE_LABEL[App.profile] || '')}</dd></dl>
      ${u.sso ? `<div class="mt">${callout('info', `You sign in with Microsoft${u.hasPassword ? ' (you also have a Team Desk password as a fallback)' : ''}.`, 'shield')}</div>` : ''}
      <div class="row mt">${u.hasPassword ? `<button class="btn primary" onclick="changeAccountPassword()">${ic('key', 15)}Change password</button>` : ''}${(App.status?.profiles || []).length > 1 ? `<button class="btn" onclick="switchProfile()">${ic('swap', 15)}Switch profile</button>` : ''}<button class="btn" onclick="signOut()">${ic('logout', 15)}Sign out</button></div>`)}
    ${card('How your data is protected', `<div class="small"><p style="margin-top:0">• Records and documents are encrypted on the server (AES-256-GCM).</p><p>• ${isPM() ? 'As a people manager you can view every team but not change anything.' : 'Only you can see and change your reportees. People managers can view them; administrators can move them to another line manager.'}${App.status?.pmSeesPrivate ? ' People managers can also read private notes.' : ' Your private notes are not shown to people managers.'}</p>
      <p>• You are signed out after ${App.status?.sessionMinutes || 30} minutes of inactivity.</p><p style="margin-bottom:0">• Sign-ins, report downloads and people-manager views are recorded in an audit log that administrators can review.</p></div>`)}</div>`;
}
function changeAccountPassword() {
  openModal({ title: 'Change password', saveText: 'Change password',
    body: `${fld('Current password', 'current', '', { type: 'password', attrs: 'autocomplete="current-password"' })}${fld('New password', 'next', '', { type: 'password', attrs: 'autocomplete="new-password" oninput="pwMeter(this.value)"', hint: 'At least 10 characters.' })}
      <div class="strength"><i id="pwm" style="width:0"></i></div>${fld('Confirm new password', 'confirm', '', { type: 'password', attrs: 'autocomplete="new-password"' })}
      <div class="xs muted">You’ll stay signed in here; other browsers where you are signed in will be signed out.</div>`,
    onSave: async d => {
      if (d.next.length < 10) { toast('Use at least 10 characters', 'err'); return false; }
      if (d.next !== d.confirm) { toast('The new passwords don’t match', 'err'); return false; }
      try { const st = await api('POST', '/api/auth/password', { current: d.current, next: d.next }); App.csrf = st.csrf; toast('Password changed'); }
      catch (e) { toast(e.message, 'err'); return false; }
    } });
}
function setAiUser() {
  return `<div class="grid g-side"><div class="card"><div class="card-head"><div><h2>AI assistant</h2><p>Deeper suggestions from 1:1 notes and documents, using an AI model that runs on the Team Desk server. Your administrator sets it up.</p></div></div>
      <div class="card-body" id="ai-box"><div class="muted">Checking…</div></div></div>
    ${card('Your preference', `${chk('Run automatically after each 1:1 and document upload (otherwise only when you click “Suggest actions”)', 'auto', S.settings.aiAuto !== false, { attrs: 'onchange="S.settings.aiAuto=this.checked;save()"' })}`)}</div>`;
}

/* ---------- export (both versions) and import into the central server ---------- */
function bufToB64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function b64ToBlob(b64, type) { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new Blob([a], { type: type || 'application/octet-stream' }); }
async function exportData() {
  await Store.flush();
  toast('Preparing the export…');
  const reps = CENTRAL ? S.reportees.filter(p => p.managerId === App.user.id || !p.managerId) : S.reportees;
  const files = {}, want = [];
  reps.forEach(p => p.docs.forEach(d => d.fileId && want.push([p.id, d.fileId])));
  if (!CENTRAL || isAdmin()) S.guidelines.forEach(g => g.fileId && want.push([ORG_OWNER, g.fileId]));
  for (const [owner, id] of want) {
    try {
      const r = await api('GET', `/api/files/${owner}/${id}`, undefined, { raw: true });
      const name = decodeURIComponent((r.headers.get('content-disposition') || '').split("''")[1] || 'file');
      files[`${owner}/${id}`] = { name, type: r.headers.get('content-type') || '', data: bufToB64(await r.arrayBuffer()) };
    } catch { /* original no longer stored */ }
  }
  const { reportees, ...org } = S;
  const out = { app: 'teamdesk', kind: 'teamdesk-export', version: APP_VERSION, exported: new Date().toISOString(), from: CENTRAL ? 'central' : 'local', org, reportees: reps, files };
  downloadBlob(new Blob([JSON.stringify(out)], { type: 'application/json' }), `TeamDesk_export_${today()}.json`);
  if (CENTRAL) api('POST', '/api/audit', { action: 'export-data', detail: `${reps.length} reportees` }).catch(() => {});
  toast(`Exported ${plural(reps.length, 'reportee')} and ${plural(Object.keys(files).length, 'document')}`, '', 5000);
}
function setMyData() {
  const mine = S.reportees.length;
  return `<div class="grid g2">${card('Import from the personal version', `<p class="small" style="margin-top:0">Used Team Desk on your own computer before? There, go to <b>Settings › Data &amp; backups › Export all data</b>, then import the file here. Your reportees, their documents and your leadership notes are added to your account.</p>
      <button class="btn primary" onclick="pickFiles('.json',false,f=>importExportFile(f))">${ic('upload', 15)}Import export file</button>`)}
    ${card('Export my data', `<p class="small" style="margin-top:0">Download your ${plural(mine, 'reportee')}, their documents and your notes as one file — for your own records or to move to another server. The file is not encrypted.</p>
      <button class="btn" onclick="exportData()">${ic('download', 15)}Export my data</button>`)}</div>`;
}
async function importExportFile(file) {
  let j;
  try { j = JSON.parse(await file.text()); } catch { return toast('That file isn’t a Team Desk export', 'err'); }
  if (j.kind !== 'teamdesk-export' || !Array.isArray(j.reportees)) return toast('That file isn’t a Team Desk export (use “Export all data” in the personal version)', 'err');
  const docs = Object.keys(j.files || {}).length, admin = isAdmin();
  openModal({ title: 'Import Team Desk data', sub: esc(file.name), saveText: `Import ${plural(j.reportees.length, 'reportee')}`,
    body: `${callout('info', `This file has <b>${plural(j.reportees.length, 'reportee')}</b> and <b>${plural(docs, 'document')}</b>, exported ${fmt((j.exported || '').slice(0, 10))}.`)}
      <div class="grid" style="gap:10px">${chk('Import my leadership self-assessments, upward feedback and 1:1 question-bank settings', 'lead', true)}
      ${admin ? chk('Also replace the organisation configuration (competency framework, roles & KPIs, skills, guidelines) — affects everyone', 'org', false) : '<div class="xs muted">Organisation configuration in the file is not imported — administrators manage it.</div>'}</div>
      <div class="xs muted mt">Reportees already in your account with the same record are updated. Nothing is deleted.</div>`,
    onSave: async d => {
      const btn = $('#msave'); btn.textContent = 'Importing…';
      try { await doImport(j, d); } catch (e) { toast(e.message, 'err', 6000); return false; }
    } });
}
async function doImport(j, opt) {
  await Store.flush();
  const org = j.org || {};
  if (opt.lead) {
    S.leadership = { self: { ...(S.leadership?.self || {}), ...(org.leadership?.self || {}) }, upward: { ...(S.leadership?.upward || {}), ...(org.leadership?.upward || {}) } };
    if (org.qbank) S.qbank = org.qbank;
  }
  if (opt.org && isAdmin()) {
    ['framework', 'roles', 'skills', 'guidelines'].forEach(k => { if (org[k] !== undefined) S[k] = org[k]; });
    if (org.settings?.cycleStartMonth) S.settings.cycleStartMonth = org.settings.cycleStartMonth;
    if (org.settings?.distribution) S.settings.distribution = org.settings.distribution;
  }
  await Store.flush();
  let n = 0, f = 0;
  for (const p0 of j.reportees) {
    const p = normP(JSON.parse(JSON.stringify(p0))), oldId = p.id;
    delete p.managerId; delete p.privateHidden;
    try { await api('PUT', `/api/reportees/${p.id}`, p); }
    catch (e) {
      if (e.status !== 403) throw e;
      p.id = uid(); p.docs.forEach(d => { if (d.owner === oldId) d.owner = p.id; });
      await api('PUT', `/api/reportees/${p.id}`, p);
    }
    n++;
    for (const d of p.docs) {
      const x = d.fileId && j.files?.[`${oldId}/${d.fileId}`];
      if (x) { await api('PUT', `/api/files/${p.id}/${d.fileId}`, b64ToBlob(x.data, x.type), { headers: { 'Content-Type': x.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(x.name || d.name || 'file') } }); f++; }
    }
  }
  if (opt.org && isAdmin()) for (const g of S.guidelines) {
    const x = g.fileId && j.files?.[`${ORG_OWNER}/${g.fileId}`];
    if (x) { await api('PUT', `/api/files/${ORG_OWNER}/${g.fileId}`, b64ToBlob(x.data, x.type), { headers: { 'Content-Type': x.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(x.name || 'file') } }); f++; }
  }
  api('POST', '/api/audit', { action: 'import-data', detail: `${n} reportees, ${f} documents` }).catch(() => {});
  await Store.load();
  toast(`Imported ${plural(n, 'reportee')} and ${plural(f, 'document')}`, '', 5000);
  setTimeout(() => go('#/people'), 0);
}

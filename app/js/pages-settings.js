/* =========================================================
   pages-settings.js — General, Security, Data & backups, About
   ========================================================= */
'use strict';

function pgSettings(tab) {
  const labels = { general: 'General', ai: 'AI assistant', security: 'Security', data: 'Data & backups', about: 'About & toolkit' };
  if (!labels[tab]) tab = 'general';
  crumbs([['Settings'], [labels[tab]]]);
  const head = pageHead('Settings', '') + tabsNav(Object.entries(labels), tab, k => `#/settings/${k}`);
  if (tab === 'security') return head + setSecurity();
  if (tab === 'data') { setTimeout(loadBackups, 0); return head + setData(); }
  if (tab === 'about') return head + setAbout();
  if (tab === 'ai') { setTimeout(loadAiStatus, 0); return head + setAi(); }
  const s = S.settings;
  return head + card('General', `<form class="fgrid" onchange="saveSettings(this)">
    ${fld('Your name', 'managerName', s.managerName, { hint: 'Used for greetings, initials on competency ratings and the upward-feedback form.' })}
    ${sel('Review year starts in', 'cycleStartMonth', MONTHS.map((m, i) => [i + 1, m]), s.cycleStartMonth, { hint: `Current cycle: ${esc(cycleOf().label)}` })}
    ${sel('Appearance', 'theme', [['', 'Match my system'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}
    ${sel('Minimum responses before upward feedback is shown', 'upwardMin', [3, 4, 5, 6, 8, 10].map(n => [n, n]), s.upwardMin || 3, { hint: 'Higher numbers protect anonymity better.' })}</form>`, { sub: 'Changes save automatically' });
}
function saveSettings(form) { const d = formObj(form); d.cycleStartMonth = +d.cycleStartMonth; d.upwardMin = +d.upwardMin; Object.assign(S.settings, d); applyTheme(); save(); render(); }

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
    onYes: async () => { await Store.flush(); await api('POST', '/api/backups/restore', { name }); await Store.load(); toast('Snapshot restored'); } });
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
  ];
  return `<div class="grid g-side">${card('Manager toolkit', tools.map(([i, t, d]) => `<div class="list-row">${ic(i, 18, 'style="color:var(--accent);margin-top:2px"')}<div><b>${t}</b><div class="small muted">${d}</div></div></div>`).join(''))}
    <div class="grid" style="align-content:start">${card('About', `<dl class="kv"><dt>Version</dt><dd>${esc(APP_VERSION)}</dd><dt>Runtime</dt><dd>Node ${esc(App.status?.node || '')} · ${esc(App.status?.platform || '')}</dd><dt>Address</dt><dd>${esc(location.origin)}</dd></dl>`)}
      ${card('Stop Team Desk', `<p class="small" style="margin-top:0">Saves any pending changes, locks your data and stops the local server. Start it again with the launcher.</p><button class="btn danger" onclick="stopServer()">${ic('power', 15)}Stop Team Desk</button>`)}</div></div>`;
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
  return `<div class="grid g-side"><div class="card"><div class="card-head"><div><h2>Local AI assistant</h2><p>Deeper suggestions from 1:1 notes and documents, using an AI model that runs on this computer through Ollama. Nothing is sent to the internet.</p></div></div>
      <div class="card-body" id="ai-box"><div class="muted">Checking for Ollama…</div></div></div>
    ${card('How it works', `<div class="list-row small">${ic('check', 15, 'style="color:var(--good)"')}<span><b>Built-in analysis always runs</b> — rules that spot wellbeing, workload, retention, blockers, delivery risk, learning, certifications, recognition and leave. No set-up needed.</span></div>
      <div class="list-row small">${ic('compass', 15, 'style="color:var(--accent)"')}<span><b>Local AI adds</b> a summary, nuance and suggestions the rules can’t catch, plus personalised questions for your next 1:1.</span></div>
      <div class="list-row small">${ic('shield', 15, 'style="color:var(--accent)"')}<span><b>Private:</b> Team Desk’s server talks to Ollama on <code>localhost</code> only. Suggestions are never applied without your review.</span></div>
      <div class="list-row small">${ic('download', 15, 'style="color:var(--muted)"')}<span><b>Set-up:</b> install Ollama from ollama.com, then in Terminal run <code>ollama pull llama3.1:8b</code> (or <code>qwen2.5:7b</code>). 8 GB+ RAM recommended.</span></div>`)}</div>`;
}
async function loadAiStatus() {
  const el = $('#ai-box'); if (!el) return;
  const st = await AI.refresh();
  if (!st) { el.innerHTML = callout('bad', 'Could not check the AI status.'); return; }
  const models = st.models || [];
  el.innerHTML = `<div class="row mb">${st.available ? `<span class="badge b-good">${ic('check', 12)} Ollama detected</span><span class="small muted">${plural(models.length, 'model')} installed</span>` : `<span class="badge b-warn">Ollama not detected</span><span class="small muted">${esc(st.error || '')}</span>`}</div>
    <div class="fgrid">${st.available && models.length ? sel('Model', 'model', [['', '— choose a model —'], ...models.map(m => [m.name, `${m.name}${m.params ? ` · ${m.params}` : ''}`])], st.model, { attrs: 'id="ai-model"' })
      : fld('Model', 'model', st.model, { attrs: 'id="ai-model"', ph: 'e.g. llama3.1:8b', hint: st.available ? 'No models installed yet — run “ollama pull llama3.1:8b”.' : '' })}
      ${fld('Ollama address', 'url', st.url, { attrs: 'id="ai-url"', hint: 'Must be on this computer.' })}
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

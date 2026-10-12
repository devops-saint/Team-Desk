/* =========================================================
   setup.js — first-run wizard, unlock screen, folder browser
   ========================================================= */
'use strict';

/* ---------- folder browser (server lists folders on this computer) ---------- */
const FB = {
  sel: null, path: '', data: null,
  async mount(sel, start) { this.sel = sel; await this.go(start || ''); },
  async go(p) {
    try { this.data = await api('GET', '/api/fs/list?path=' + encodeURIComponent(p || '')); this.path = this.data.path; }
    catch (e) { if (!this.data && p) return this.go(''); toast(e.message, 'err', 5000); if (!this.data) return; }
    this.draw();
    if (this.onChange) this.onChange(this.data);
  },
  draw() {
    const d = this.data, el = $(this.sel); if (!el || !d) return;
    el.innerHTML = `<div class="fb"><div class="fb-bar">${d.parent ? `<button type="button" class="btn sm" onclick="FB.go(${esc(JSON.stringify(d.parent))})">${ic('chevU', 14)}Up</button>` : ''}<span class="fb-path">${esc(d.path)}</span>
        <button type="button" class="btn sm" onclick="FB.mkdir()">${ic('folderPlus', 14)}New folder</button></div>
      <div class="fb-roots">${d.roots.map(r => `<button type="button" class="chip" onclick="FB.go(${esc(JSON.stringify(r.path))})">${esc(r.label)}</button>`).join('')}</div>
      <div class="fb-list">${d.dirs.length ? d.dirs.map(x => `<button type="button" ondblclick="FB.go(${esc(JSON.stringify(x.path))})" onclick="FB.go(${esc(JSON.stringify(x.path))})">${ic(x.teamdesk ? 'shield' : 'folder', 16, `style="color:${x.teamdesk ? 'var(--accent)' : 'var(--muted)'}"`)}<span class="grow">${esc(x.name)}</span>${x.teamdesk ? '<span class="badge b-acc">Team Desk data</span>' : ''}${ic('chevR', 14, 'style="color:var(--faint)"')}</button>`).join('')
        : '<div class="small muted" style="padding:12px">No sub-folders here.</div>'}</div></div>`;
  },
  mkdir() {
    const box = document.createElement('div');
    box.innerHTML = `<div class="row mt-s"><input class="input" id="fb-new" placeholder="New folder name" style="max-width:280px" value="TeamDesk Data"><button type="button" class="btn sm primary" id="fb-ok">Create</button><button type="button" class="btn sm ghost" id="fb-cancel">Cancel</button></div>`;
    $(this.sel).appendChild(box);
    const inp = $('#fb-new'); inp.focus(); inp.select();
    const ok = async () => { try { const r = await api('POST', '/api/fs/mkdir', { parent: this.path, name: inp.value }); await this.go(r.path); } catch (e) { toast(e.message, 'err'); } };
    $('#fb-ok').onclick = ok; $('#fb-cancel').onclick = () => box.remove();
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } if (e.key === 'Escape') box.remove(); };
  },
};

/* ---------- setup wizard ---------- */
const W = { step: 0, dir: '', mode: 'create', info: null, name: '', month: 4 };
function gate(html, narrow) { $('#gate').innerHTML = `<div class="gate"><div class="gate-card ${narrow ? 'narrow' : ''}">${html}</div></div>`; }
function showSetup() { W.step = 0; drawSetup(); }
function drawSetup() {
  const steps = `<div class="steps">${[0, 1, 2, 3].map(i => `<i class="${i <= W.step ? 'on' : ''}"></i>`).join('')}</div>`;
  const headH = (t, s) => `${steps}<div class="gate-head"><div class="brand-mark" style="width:38px;height:38px;font-size:12px">TD</div><div><h2 style="font-size:18px">${t}</h2><div class="small muted">${s}</div></div></div>`;
  if (W.step === 0) return gate(headH('Welcome to Team Desk', 'Set-up takes about a minute') + `<div class="gate-body">
      <div class="feature">${ic('folder', 20)}<div><b>Your own data folder</b><div class="small muted">You choose where Team Desk keeps its data — for example in Documents or a synced work folder.</div></div></div>
      <div class="feature">${ic('shield', 20)}<div><b>Encrypted with your password</b><div class="small muted">Each reportee is stored in a separate encrypted file. Without your password the folder is unreadable.</div></div></div>
      <div class="feature">${ic('lock', 20)}<div><b>Stays on this computer</b><div class="small muted">Team Desk runs locally and sends nothing to the internet.</div></div></div></div>
      <div class="gate-foot"><span class="small muted">Version ${esc(APP_VERSION)}</span><button class="btn primary" onclick="W.step=1;drawSetup()">Get started ${ic('chevR', 15)}</button></div>`);
  if (W.step === 1) {
    gate(headH('Choose your data folder', 'Pick an empty folder, or a folder that already has Team Desk data') + `<div class="gate-body"><div id="fbw"></div><div id="fbnote"></div></div>
      <div class="gate-foot"><button class="btn ghost" onclick="W.step=0;drawSetup()">${ic('chevL', 15)}Back</button><button class="btn primary" id="w-next" onclick="setupFolderNext()">Use this folder ${ic('chevR', 15)}</button></div>`);
    FB.onChange = d => {
      W.dir = d.path;
      const note = d.teamdesk ? callout('info', 'This folder already contains Team Desk data. Continue to open it with its password.')
        : d.empty ? callout('good', `Team Desk will store its data directly in <b>${esc(d.path)}</b>.`)
        : callout('info', `This folder isn’t empty, so Team Desk will create a <b>TeamDesk Data</b> folder inside it.`);
      $('#fbnote').innerHTML = note; W.mode = d.teamdesk ? 'open' : 'create'; W.info = d;
    };
    return FB.mount('#fbw', W.dir || (App.status.home + (App.status.sep || '/') + 'Documents'));
  }
  if (W.step === 2) {
    const open = W.mode === 'open';
    return gate(headH(open ? 'Open your Team Desk data' : 'Create your password', open ? esc(W.dir) : 'This password encrypts everything Team Desk stores') + `<form class="gate-body" onsubmit="event.preventDefault();setupPassword()">
      ${open ? fld('Password', 'pw', '', { type: 'password', attrs: 'id="pw1" autocomplete="current-password" autofocus' })
        : `${fld('Password', 'pw', '', { type: 'password', attrs: 'id="pw1" autocomplete="new-password" autofocus oninput="pwMeter(this.value)"', hint: 'At least 8 characters. A short sentence works well.' })}<div class="strength"><i id="pwm" style="width:0"></i></div>
          ${fld('Confirm password', 'pw2', '', { type: 'password', attrs: 'id="pw2" autocomplete="new-password"' })}
          ${callout('warn', '<b>There is no password reset.</b> If you forget it, the data can’t be recovered. Keep it in your password manager.')}`}
      <div id="pwerr"></div><button type="submit" hidden></button></form>
      <div class="gate-foot"><button class="btn ghost" onclick="W.step=1;drawSetup()">${ic('chevL', 15)}Back</button><button class="btn primary" id="w-pw" onclick="setupPassword()">${open ? 'Open' : 'Create encrypted folder'} ${ic('chevR', 15)}</button></div>`);
  }
  if (W.step === 3) return gate(headH('A few details', 'You can change these later in Settings') + `<form class="gate-body" id="w-about" onsubmit="event.preventDefault();setupFinish()">
      ${fld('Your name', 'name', W.name, { attrs: 'autofocus', hint: 'Used for greetings and your initials on competency ratings.' })}
      ${sel('Your review year starts in', 'month', MONTHS.map((m, i) => [i + 1, m]), W.month, { hint: 'Half-yearly cycles (H1 / H2) are counted from this month.' })}
      <div class="callout info">${ic('upload', 16)}<div>Used the earlier browser version of Team Desk? <button type="button" class="linkbtn" onclick="pickFiles('.json,.tdbackup',false,f=>{W.legacy=f;$('#w-leg').textContent='Will import: '+f.name})">Import its backup file</button> <span id="w-leg" class="small muted"></span></div></div></form>
      <div class="gate-foot"><span class="small muted">${ic('shield', 13)} Data folder ready</span><button class="btn primary" onclick="setupFinish()">Open Team Desk ${ic('chevR', 15)}</button></div>`);
}
function setupFolderNext() { if (!W.dir) return toast('Choose a folder', 'err'); W.step = 2; drawSetup(); }
async function setupPassword() {
  const pw = $('#pw1').value, btn = $('#w-pw');
  if (W.mode === 'create') {
    if (pw.length < 8) return $('#pwerr').innerHTML = callout('bad', 'Use at least 8 characters.');
    if (pw !== $('#pw2').value) return $('#pwerr').innerHTML = callout('bad', 'The passwords don’t match.');
  }
  btn.disabled = true; btn.textContent = W.mode === 'open' ? 'Opening…' : 'Creating…';
  try {
    const r = await api('POST', '/api/setup', { dir: W.dir, password: pw, mode: W.mode });
    App.status = await api('GET', '/api/status');
    if (W.mode === 'open') return startApp();
    W.dir = r.dataDir; W.step = 3; drawSetup();
  } catch (e) { $('#pwerr').innerHTML = callout('bad', esc(e.message)); btn.disabled = false; btn.textContent = W.mode === 'open' ? 'Open' : 'Create encrypted folder'; }
}
async function setupFinish() {
  const d = formObj($('#w-about'));
  await startApp();
  S.settings.managerName = d.name; S.settings.cycleStartMonth = +d.month; save();
  render();
  if (W.legacy) importLegacy(W.legacy, () => render());
}

/* ---------- unlock ---------- */
function showUnlock(midSession) {
  const folder = App.status?.dataDir || '';
  gate(`<div class="gate-head" style="padding-top:26px"><div class="brand-mark" style="width:38px;height:38px">${ic('lock', 18)}</div><div><h2 style="font-size:18px">${midSession ? 'Team Desk is locked' : 'Unlock Team Desk'}</h2><div class="small muted" title="${esc(folder)}">${esc(folder.split(/[\\/]/).filter(Boolean).slice(-2).join(' / '))}</div></div></div>
    <form class="gate-body" onsubmit="event.preventDefault();doUnlock(${midSession ? 'true' : 'false'})">${fld('Password', 'pw', '', { type: 'password', attrs: 'id="ul-pw" autocomplete="current-password" autofocus' })}<div id="ul-err"></div>
      <button class="btn primary" id="ul-btn" type="submit">Unlock</button></form>
    <div class="gate-foot"><button class="linkbtn small" onclick="unlockOther()">Use a different data folder</button><span class="small muted">${ic('shield', 13)} Encrypted</span></div>`, true);
  setTimeout(() => $('#ul-pw')?.focus(), 30);
}
async function doUnlock(mid) {
  const btn = $('#ul-btn'); btn.disabled = true; btn.textContent = 'Unlocking…';
  try {
    await api('POST', '/api/unlock', { password: $('#ul-pw').value }, { allowLocked: true });
    App.status = await api('GET', '/api/status');
    if (mid && App.ready) { $('#gate').innerHTML = ''; if (Store.dirty()) Store.flush(); render(); toast('Unlocked'); }
    else await startApp();
  } catch (e) { $('#ul-err').innerHTML = callout('bad', esc(e.message)); btn.disabled = false; btn.textContent = 'Unlock'; $('#ul-pw').select(); }
}
function unlockOther() {
  gate(`<div class="gate-head" style="padding-top:22px"><div><h2 style="font-size:18px">Choose a data folder</h2><div class="small muted">Open existing Team Desk data, or pick an empty folder to start fresh.</div></div></div>
    <div class="gate-body"><div id="fbw"></div><div id="fbnote"></div></div><div class="gate-foot"><button class="btn ghost" onclick="showUnlock()">${ic('chevL', 15)}Back</button><button class="btn primary" onclick="unlockOtherGo()">Continue ${ic('chevR', 15)}</button></div>`);
  FB.onChange = d => { $('#fbnote').innerHTML = d.teamdesk ? callout('info', 'Team Desk data found — you’ll be asked for its password.') : callout('', 'No Team Desk data here — continuing will set up a new encrypted folder.'); };
  FB.mount('#fbw', App.status?.home);
}
async function unlockOtherGo() {
  if (FB.data?.teamdesk) { try { await api('POST', '/api/folder/open', { dir: FB.path }); App.status = await api('GET', '/api/status'); App.ready = false; showUnlock(); } catch (e) { toast(e.message, 'err'); } }
  else { W.dir = FB.path; W.mode = 'create'; W.step = 2; drawSetup(); }
}

/* =========================================================
   auth.js — central version: sign in, registration, approval
   waiting room, forced password change, profile choice
   ========================================================= */
'use strict';

const AUTH = { tab: 'signin', email: '' };

function authShell(title, sub, body, foot = '') {
  gate(`<div class="gate-head" style="padding-top:26px"><div class="brand-mark" style="width:38px;height:38px;font-size:12px">TD</div><div><h2 style="font-size:18px">${title}</h2><div class="small muted">${sub}</div></div></div>
    ${body}${foot ? `<div class="gate-foot">${foot}</div>` : ''}`, true);
}

function showAuth(tab, msg) {
  const st = App.status || {};
  AUTH.tab = !st.hasUsers ? 'first' : tab || AUTH.tab || 'signin';
  App.ready = false;
  $('#shell').hidden = true; closeModal(true); closeDrawer();
  const note = msg ? callout('info', esc(msg)) : '';
  if (AUTH.tab === 'first') {
    return authShell('Set up Team Desk', 'Create the first account — it becomes the administrator', `<form class="gate-body" onsubmit="event.preventDefault();doRegister(true)">
      ${callout('info', 'You are the first person here, so your account will be the <b>Administrator</b> and a <b>Line manager</b>. After this, colleagues register themselves and you approve them and choose their group.')}
      ${regFields(false)}<div id="au-err"></div><button class="btn primary" id="au-btn" type="submit">Create administrator account</button></form>`,
      `<span class="small muted">${ic('shield', 13)} Encrypted on the server</span><span class="small muted">Version ${esc(APP_VERSION)}</span>`);
  }
  const tabs = `<div class="seg" style="margin:0 26px">${[['signin', 'Sign in'], ['register', 'Register']].map(([k, l]) => `<button type="button" class="${AUTH.tab === k ? 'on' : ''}" onclick="showAuth('${k}')">${l}</button>`).join('')}</div>`;
  if (AUTH.tab === 'register') {
    if (!st.registrationOpen) return authShell('Register', 'New accounts', `${tabs}<div class="gate-body">${callout('warn', 'Registration is currently closed. Ask your Team Desk administrator to open it, or to create access for you.')}</div>`);
    return authShell('Create your account', 'An administrator approves new accounts before first sign-in', `${tabs}<form class="gate-body" onsubmit="event.preventDefault();doRegister(false)">
      ${regFields(true)}<div id="au-err"></div><button class="btn primary" id="au-btn" type="submit">Register</button></form>`,
      `<span class="small muted">${st.allowedDomains ? `Only ${esc(st.allowedDomains)} addresses` : 'Use your work email'}</span><button class="linkbtn small" type="button" onclick="showAuth('signin')">I already have an account</button>`);
  }
  authShell('Sign in to Team Desk', 'Your manager workspace', `${tabs}<form class="gate-body" onsubmit="event.preventDefault();doLogin()">${note}
      ${fld('Work email', 'email', AUTH.email, { type: 'email', attrs: 'id="au-email" autocomplete="username" required' })}
      ${fld('Password', 'password', '', { type: 'password', attrs: 'id="au-pw" autocomplete="current-password" required' })}
      <div id="au-err"></div><button class="btn primary" id="au-btn" type="submit">Sign in</button></form>`,
    `<span class="small muted">Forgot your password? Ask your Team Desk administrator to reset it.</span>`);
  setTimeout(() => (AUTH.email ? $('#au-pw') : $('#au-email'))?.focus(), 30);
}
function regFields(withGroups) {
  return `${fld('Full name', 'name', '', { attrs: 'id="au-name" autocomplete="name" required autofocus' })}
    ${fld('Work email', 'email', '', { type: 'email', attrs: 'id="au-email" autocomplete="username" required' })}
    ${fld('Password', 'password', '', { type: 'password', attrs: 'id="au-pw" autocomplete="new-password" required oninput="pwMeter(this.value)"', hint: 'At least 10 characters. A short sentence is easy to remember and hard to guess.' })}
    <div class="strength"><i id="pwm" style="width:0"></i></div>
    ${fld('Confirm password', 'confirm', '', { type: 'password', attrs: 'id="au-pw2" autocomplete="new-password" required' })}
    ${withGroups ? `<div class="field"><span>I need access as <em>(the administrator decides)</em></span><div class="row">${chk('Line manager — I manage reportees', 'rq_lm', true, { attrs: 'id="au-rq-lm"' })}${chk('People manager — HR / leadership view of all teams', 'rq_pm', false, { attrs: 'id="au-rq-pm"' })}</div></div>
      ${fld('Note for the administrator', 'note', '', { attrs: 'id="au-note" maxlength="300"', opt: true, ph: 'e.g. Delivery manager, Data team' })}` : ''}`;
}
async function doRegister(first) {
  const v = id => $(id)?.value || '', err = m => { $('#au-err').innerHTML = callout('bad', esc(m)); };
  if (!v('#au-name').trim()) return err('Enter your full name.');
  if (v('#au-pw').length < 10) return err('Use a password of at least 10 characters.');
  if (v('#au-pw') !== v('#au-pw2')) return err('The passwords don’t match.');
  const btn = $('#au-btn'); btn.disabled = true;
  try {
    const r = await api('POST', '/api/auth/register', { name: v('#au-name').trim(), email: v('#au-email').trim(), password: v('#au-pw'),
      requested: [$('#au-rq-lm')?.checked && 'lm', $('#au-rq-pm')?.checked && 'pm'].filter(Boolean), note: v('#au-note') }, { allowLocked: true });
    if (r.pending) {
      AUTH.email = v('#au-email').trim();
      return authShell('Registration received', esc(AUTH.email), `<div class="gate-body">${callout('good', `Thanks, ${esc(firstName(v('#au-name')))}. An administrator needs to approve your account and choose your group (Line manager or People manager). You can sign in once that’s done.`)}</div>`,
        `<span></span><button class="btn primary" onclick="showAuth('signin')">Back to sign in</button>`);
    }
    await afterSignIn(r);
  } catch (e) { err(e.message); btn.disabled = false; }
}
async function doLogin() {
  const btn = $('#au-btn'); btn.disabled = true; btn.textContent = 'Signing in…';
  AUTH.email = $('#au-email').value.trim();
  try { await afterSignIn(await api('POST', '/api/auth/login', { email: AUTH.email, password: $('#au-pw').value }, { allowLocked: true })); }
  catch (e) { $('#au-err').innerHTML = callout('bad', esc(e.message)); btn.disabled = false; btn.textContent = 'Sign in'; $('#au-pw').select(); }
}

/* after sign-in, registration, password change or on page load with a live session */
async function afterSignIn(st) {
  /* signing in again after the session timed out: carry on where the manager was, keeping unsaved changes */
  const resume = App.authGate && App.dataLoaded ? { uid: App.user?.id, profile: App.profile } : null;
  App.authGate = false;
  App.status = st; App.user = st.user; App.csrf = st.csrf; App.profile = st.profile;
  if (st.mustChange) return showMustChange();
  if (resume && resume.uid === st.user.id && !st.profile && (st.profiles || []).includes(resume.profile)) {
    st = await api('POST', '/api/auth/profile', { profile: resume.profile });
    App.status = st; App.csrf = st.csrf; App.profile = st.profile;
  }
  if (!st.profile) return showProfilePicker();
  if (resume) {
    if (resume.uid === st.user.id && resume.profile === st.profile) {
      $('#gate').innerHTML = ''; $('#shell').hidden = false; App.ready = true;
      if (Store.dirty()) await Store.flush();
      return toast('Signed in again — your changes are saved');
    }
    return location.reload();
  }
  await startApp();
}

function showMustChange() {
  authShell('Choose a new password', `${esc(App.user.email)} · your password was reset by an administrator`, `<form class="gate-body" onsubmit="event.preventDefault();doMustChange()">
    ${fld('Temporary password', 'current', '', { type: 'password', attrs: 'id="mc-cur" autocomplete="current-password" required autofocus' })}
    ${fld('New password', 'next', '', { type: 'password', attrs: 'id="mc-new" autocomplete="new-password" required oninput="pwMeter(this.value)"', hint: 'At least 10 characters.' })}
    <div class="strength"><i id="pwm" style="width:0"></i></div>
    ${fld('Confirm new password', 'confirm', '', { type: 'password', attrs: 'id="mc-new2" autocomplete="new-password" required' })}
    <div id="au-err"></div><button class="btn primary" id="au-btn" type="submit">Save password</button></form>`,
    `<span></span><button class="linkbtn small" onclick="signOut()">Sign out</button>`);
}
async function doMustChange() {
  const err = m => { $('#au-err').innerHTML = callout('bad', esc(m)); };
  if ($('#mc-new').value.length < 10) return err('Use at least 10 characters.');
  if ($('#mc-new').value !== $('#mc-new2').value) return err('The new passwords don’t match.');
  try { await afterSignIn(await api('POST', '/api/auth/password', { current: $('#mc-cur').value, next: $('#mc-new').value })); toast('Password changed'); }
  catch (e) { err(e.message); }
}

const PROFILE_INFO = {
  lm: ['users', 'Line manager', 'Your own reportees — 1:1s, assessments, goals, development and reviews. Full edit access.'],
  pm: ['grid', 'People manager', 'Every reportee of every line manager, across the organisation. View only, with reports for HR and leadership.'],
  admin: ['shield', 'Administration', 'Approve accounts, manage groups, reportee ownership, organisation settings and the audit log.'],
};
function showProfilePicker() {
  const ps = App.status.profiles || [];
  App.ready = false; $('#shell').hidden = true;
  authShell(`Welcome, ${esc(firstName(App.user.name))}`, 'You are in more than one group. Choose how you want to work now — you can switch at any time from the sidebar.',
    `<div class="gate-body">${ps.map(p => { const [icon, t, d] = PROFILE_INFO[p]; return `<button class="profile-card" onclick="chooseProfile('${p}')">${ic(icon, 22)}<div><b>${t}</b><div class="small muted">${d}</div></div>${ic('chevR', 16)}</button>`; }).join('')}</div>`,
    `<span class="small muted">${esc(App.user.email)}</span><button class="linkbtn small" onclick="signOut()">Sign out</button>`);
}
async function chooseProfile(p) {
  try { const st = await api('POST', '/api/auth/profile', { profile: p }); App.status = st; App.profile = st.profile; App.csrf = st.csrf; }
  catch (e) { return toast(e.message, 'err'); }
  location.hash = '#/dashboard';
  if (App.dataLoaded) { await Store.load(); App.ready = true; $('#gate').innerHTML = ''; $('#shell').hidden = false; applyTheme(); render(); toast(`Switched to ${PROFILE_LABEL[p]}`); }
  else await startApp();
}
async function switchProfile() {
  await Store.flush();
  showProfilePicker();
}
async function signOut() {
  try { if (App.ready) await Store.flush(); } catch {}
  try { await api('POST', '/api/auth/logout', {}, { allowLocked: true }); } catch {}
  location.hash = '';
  location.reload();
}
App.onSignedOut = () => {
  if (App.authGate || !App.dataLoaded) return;
  App.authGate = true;
  showAuth('signin', 'Your session ended after a period of inactivity. Sign in again to continue — unsaved changes will be saved.');
  App.ready = true;   // keep the data in memory so work continues after signing in again
  $('#shell').hidden = true;
};

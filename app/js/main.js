/* =========================================================
   main.js — start-up, locking, session housekeeping
   ========================================================= */
'use strict';

function applyTheme() {
  const t = S?.settings?.theme;
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
async function startApp() {
  await Store.load();
  applyTheme();
  App.ready = true;
  App.dataRev = App.status?.dataRev;
  $('#gate').innerHTML = '';
  $('#shell').hidden = false;
  render();
  startHousekeeping();
}
App.onLocked = () => { if (!$('#gate').innerHTML) showUnlock(true); };
async function lockNow() {
  await Store.flush();
  try { await api('POST', '/api/lock'); } catch {}
  showUnlock(true);
}

let housekeeping = false;
function startHousekeeping() {
  if (housekeeping) return; housekeeping = true;
  let lastPing = 0;
  const touch = () => { if (Date.now() - lastPing > 60000 && App.ready && !$('#gate').innerHTML) { lastPing = Date.now(); api('POST', '/api/activity').catch(() => {}); } };
  ['mousedown', 'keydown', 'wheel', 'touchstart'].forEach(e => document.addEventListener(e, touch, { passive: true }));
  const poll = async () => {
    try {
      App.status = await api('GET', '/api/status');
      if (App.ready && !App.status.unlocked) App.onLocked();
      else if (App.ready && App.status.dataRev !== App.dataRev && !$('#modal-root').innerHTML) {   // never swap data under an open form
        App.dataRev = App.status.dataRev;
        const before = S.reportees.length;
        closeDrawer(); await Store.load(); applyTheme(); render();
        toast(`Data was updated outside this window — refreshed (${plural(S.reportees.length, 'reportee')}${S.reportees.length !== before ? `, was ${before}` : ''})`, '', 5000);
      }
    }
    catch { if (App.ready) $('#banner').innerHTML = `<div class="banner">${ic('alert', 15)}Can’t reach the Team Desk server. If you closed its window, start Team Desk again — unsaved changes will be retried.</div>`; return; }
    $('#banner').innerHTML = $('#banner').innerHTML && !document.querySelector('.banner.multi') ? '' : $('#banner').innerHTML;
    if (Store.state === 'error') Store.flush();
  };
  setInterval(poll, 10000);
  window.addEventListener('focus', poll);
  try {
    const bc = new BroadcastChannel('teamdesk');
    bc.onmessage = e => {
      if (e.data === 'hello') bc.postMessage('here');
      if (e.data === 'here' || e.data === 'hello') $('#banner').innerHTML = `<div class="banner multi">${ic('alert', 15)}Team Desk is open in another tab. Use one tab at a time so changes don’t overwrite each other.</div>`;
    };
    bc.postMessage('hello');
  } catch {}
}
window.addEventListener('hashchange', () => { closeDrawer(); render(); });
window.addEventListener('beforeunload', e => { if (App.ready && Store.dirty()) { Store.flush(); e.preventDefault(); e.returnValue = ''; } });

(async function boot() {
  try { App.status = await api('GET', '/api/status'); }
  catch (e) {
    $('#boot').innerHTML = `<div class="boot-mark">TD</div><b>Team Desk server isn’t running</b><div class="muted small" style="max-width:360px;text-align:center">Start Team Desk with the launcher in its folder, then reload this page.</div>`;
    return;
  }
  $('#boot').hidden = true;
  if (!App.status.configured) return showSetup();
  if (!App.status.unlocked) return showUnlock();
  await startApp();
})();

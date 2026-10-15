/* =========================================================
   feedback.js — central version: feedback between managers
   (request · give · answer), notifications, and the anonymous
   team-feedback template (see teamfb.js)
   ========================================================= */
'use strict';

const FBX = { mine: null };
const fbQuestions = name => [
  { q: `What has ${name} done well that you have seen?`, hint: 'positive' },
  { q: `What could ${name} do better or differently?`, hint: 'improve' },
  { q: `Anything else ${name}’s manager should know?`, hint: '' },
];
const CAT_UI = [['appreciation', 'Appreciation', 'b-good'], ['improvement', 'Improvement', 'b-warn'], ['other', 'Other', '']];
function analysisHtml(a) {
  if (!a) return '';
  return `<div class="grid g3" style="gap:10px">${CAT_UI.map(([k, l, c]) => `<div class="fb-cat"><div class="row" style="gap:6px"><span class="badge ${c}">${l}</span><span class="xs muted">${(a[k] || []).length}</span></div>
    ${(a[k] || []).length ? `<ul>${a[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<div class="xs muted mt-s">—</div>'}</div>`).join('')}</div>`;
}

/* ---------- search pickers (people with Team Desk access / reportees outside your team) ---------- */
function picker(id, ph, url, onPick) {
  window['_pick_' + id] = onPick;
  return `<div class="picker ro-ok" id="${id}"><input type="hidden" name="${id}" value=""><input class="input" placeholder="${esc(ph)}" autocomplete="off"
      oninput="pickerSearch('${id}','${url}',this.value)" onfocus="pickerSearch('${id}','${url}',this.value)"><div class="picker-list" hidden></div><div class="picker-chosen" hidden></div></div>`;
}
async function pickerSearch(id, url, q) {
  const box = $(`#${id} .picker-list`); if (!box) return;
  if (q.trim().length < 2) { box.hidden = true; return; }
  let rows = [];
  try { rows = await api('GET', `${url}?q=${encodeURIComponent(q.trim())}`); } catch (e) { box.innerHTML = `<div class="small muted" style="padding:8px">${esc(e.message)}</div>`; box.hidden = false; return; }
  window['_pickrows_' + id] = rows;
  box.innerHTML = rows.length ? rows.map((r, i) => `<button type="button" onmousedown="event.preventDefault();pickerChoose('${id}',${i})"><span class="avatar sm">${esc(initials(r.name))}</span><span><b>${esc(r.name)}</b><br><span class="xs muted">${esc([r.designation || r.jobTitle, r.department, r.managerName && `Line manager: ${r.managerName}`, r.email].filter(Boolean).join(' · '))}</span></span></button>`).join('')
    : '<div class="small muted" style="padding:8px">Nobody matches.</div>';
  box.hidden = false;
}
function pickerChoose(id, i) {
  const r = window['_pickrows_' + id][i], el = $(`#${id}`);
  el.querySelector('input[type=hidden]').value = r.id;
  el.querySelector('.input').hidden = true; el.querySelector('.picker-list').hidden = true;
  const ch = el.querySelector('.picker-chosen'); ch.hidden = false;
  ch.innerHTML = `<span class="avatar sm">${esc(initials(r.name))}</span><span class="grow"><b>${esc(r.name)}</b> <span class="xs muted">${esc(r.designation || r.jobTitle || '')}</span></span><button type="button" class="btn sm ghost" onclick="pickerReset('${id}')">Change</button>`;
  window['_pick_' + id]?.(r);
}
function pickerReset(id) {
  const el = $(`#${id}`); el.querySelector('input[type=hidden]').value = '';
  el.querySelector('.picker-chosen').hidden = true; const inp = el.querySelector('.input'); inp.hidden = false; inp.value = ''; inp.focus();
}
function questionEditor(qs) {
  return `<div id="q-edit" class="grid" style="gap:8px">${qs.map(qRow).join('')}</div><button type="button" class="btn sm mt-s" onclick="$('#q-edit').insertAdjacentHTML('beforeend',qRow({q:'',hint:''}))">${ic('plus', 14)}Add question</button>`;
}
const qRow = q => `<div class="act-row" style="grid-template-columns:1fr 34px"><input class="input" data-q value="${esc(q.q)}" data-hint="${esc(q.hint || '')}" placeholder="Question"><button type="button" class="btn ghost icon" onclick="this.parentNode.remove()" aria-label="Remove">${ic('x')}</button></div>`;
const readQuestions = () => $$('#q-edit [data-q]').map(i => ({ q: i.value.trim(), hint: i.dataset.hint && i.value.trim() ? i.dataset.hint : '' })).filter(q => q.q);

/* ---------- 1. a line manager asks someone for feedback on one of their reportees ---------- */
function requestFeedback(pid) {
  const p = getP(pid), f = firstName(p.profile.name);
  openModal({ title: 'Request feedback', sub: `About ${esc(p.profile.name)} — they won’t be told, and the person you ask sees only the name and your questions`, size: 'wide', saveText: 'Send request',
    body: `<div class="ro-ok fgrid"><div class="field full"><span>Ask</span>${picker('fb-to', 'Search anyone with Team Desk access by name, email or department…', '/api/people')}</div>
      ${area('Message', 'message', `Hi, could you share some feedback on ${f} from your work together? It helps with ${f}’s development and review. Thank you!`, { rows: 3 })}
      <div class="field full"><span>Questions <em>(edit as you like)</em></span>${questionEditor(fbQuestions(f))}</div></div>`,
    onSave: async d => {
      if (!d['fb-to']) { toast('Choose who to ask', 'err'); return false; }
      try { await api('POST', '/api/feedback/request', { reporteeId: pid, toUid: d['fb-to'], message: d.message, questions: readQuestions() }); toast('Request sent — you’ll be notified when they answer'); }
      catch (e) { toast(e.message, 'err', 6000); return false; }
      loadPersonRequests(pid);
    } });
}
async function loadPersonRequests(pid) {
  const el = $('#fb-requests'); if (!el) return;
  try { FBX.mine = await api('GET', '/api/feedback/mine'); } catch { return; }
  const reqs = FBX.mine.requested.filter(x => x.reporteeId === pid);
  if (!reqs.length) { el.innerHTML = ''; return; }
  const badge = s => `<span class="badge ${{ open: 'b-warn', answered: 'b-good', declined: 'b-bad' }[s] || ''}">${{ open: 'Waiting', answered: 'Answered', declined: 'Declined', cancelled: 'Withdrawn' }[s]}</span>`;
  el.innerHTML = card(`Feedback requests <span class="badge">${reqs.length}</span>`, reqs.map(x => `<div class="list-row" style="align-items:center"><div class="grow"><b>${esc(x.responderName)}</b> ${badge(x.status)} <span class="xs muted">asked ${fmt(x.created.slice(0, 10))}${x.answeredAt ? ` · answered ${fmt(x.answeredAt.slice(0, 10))}` : ''}</span>${x.declineReason ? `<div class="xs muted">“${esc(x.declineReason)}”</div>` : ''}</div>
      ${x.status === 'answered' ? `<button class="btn sm" onclick="viewFeedbackItem('${x.id}','requested')">View</button>` : x.status === 'open' ? `<button class="btn sm ghost ro-ok" onclick="cancelRequest('${x.id}','${pid}')">Withdraw</button>` : ''}</div>`).join(''), { sub: 'Answers are added to the feedback log below, sorted into Appreciation, Improvement and Other.' });
}
async function cancelRequest(id, pid) { try { await api('POST', `/api/feedback/${id}/cancel`); toast('Request withdrawn'); pid ? loadPersonRequests(pid) : render(); } catch (e) { toast(e.message, 'err'); } }

/* ---------- 2. anyone gives feedback on a reportee outside their own team ---------- */
function giveFeedback(pid, name) {
  openModal({ title: 'Give feedback', sub: 'For a reportee in another team. Their line manager is notified and sees your name. You won’t see anything else about the person.', size: 'wide', saveText: 'Send feedback',
    body: `<div class="ro-ok fgrid">${pid ? `<input type="hidden" name="fb-rep" value="${esc(pid)}"><div class="field full"><span>About</span><div class="row"><span class="avatar sm">${esc(initials(name))}</span><b>${esc(name)}</b></div></div>`
        : `<div class="field full"><span>About</span>${picker('fb-rep', 'Search a reportee by name…', '/api/directory/reportees', r => { $$('#fb-answers [data-qlabel]').forEach((el, i) => { el.textContent = fbQuestions(firstName(r.name))[i]?.q || el.textContent; }); })}</div>`}
      <div class="field full" id="fb-answers">${fbQuestions(pid ? firstName(name) : 'they').map((q, i) => `<label class="field full"><span data-qlabel>${esc(q.q)}</span><textarea name="a${i}" rows="3" data-hint="${q.hint}"></textarea></label>`).join('')}</div>
      <div class="xs muted full">Be specific: what you saw, when, and the effect. Team Desk sorts it into Appreciation, Improvement and Other for their manager.</div></div>`,
    onSave: async d => {
      const rid = d['fb-rep']; if (!rid) { toast('Choose who the feedback is about', 'err'); return false; }
      const qs = $$('#fb-answers [data-qlabel]').map((el, i) => ({ q: el.textContent, hint: $(`#fb-answers [name=a${i}]`).dataset.hint }));
      const answers = qs.map((q, i) => ({ a: d['a' + i] || '' }));
      if (!answers.some(a => a.a.trim())) { toast('Write some feedback first', 'err'); return false; }
      try { await api('POST', '/api/feedback/give', { reporteeId: rid, questions: qs, answers }); toast('Thank you — their line manager has been notified'); }
      catch (e) { toast(e.message, 'err', 6000); return false; }
      if (route()[0] === 'feedback') render();
    } });
}

/* ---------- answering a request ---------- */
async function answerRequest(id) {
  let x = FBX.mine?.toAnswer.find(v => v.id === id);
  if (!x) { FBX.mine = await api('GET', '/api/feedback/mine'); x = FBX.mine.toAnswer.find(v => v.id === id); }
  if (!x) return toast('This request is no longer open', 'err');
  api('POST', `/api/feedback/${id}/read`).catch(() => {});
  openModal({ title: `Feedback on ${x.reporteeName}`, sub: `Requested by ${esc(x.requesterName)}${x.reporteeDesignation ? ` · ${esc(x.reporteeDesignation)}` : ''}`, size: 'wide', saveText: 'Send feedback',
    footLeft: `<button type="button" class="btn ghost" onclick="declineRequest('${id}')">Decline</button>`,
    body: `<div class="ro-ok">${x.message ? callout('info', esc(x.message), 'message') : ''}<div class="fgrid mt-s">${x.questions.map((q, i) => `<label class="field full"><span>${esc(q.q)}</span><textarea name="a${i}" rows="3"></textarea></label>`).join('')}</div>
      <div class="xs muted mt-s">${esc(x.requesterName)} will see your name with your answers.</div></div>`,
    onSave: async d => {
      const answers = x.questions.map((q, i) => ({ a: d['a' + i] || '' }));
      if (!answers.some(a => a.a.trim())) { toast('Write some feedback first', 'err'); return false; }
      try { await api('POST', `/api/feedback/${id}/answer`, { answers }); toast('Thank you — feedback sent'); }
      catch (e) { toast(e.message, 'err', 6000); return false; }
      refreshNotes(); if (route()[0] === 'feedback') render();
    } });
}
function declineRequest(id) {
  closeModal(true);
  openModal({ title: 'Decline request', body: `<div class="ro-ok">${area('Reason (optional, shared with the requester)', 'reason', '', { rows: 2, ph: 'e.g. I haven’t worked with them recently' })}</div>`, saveText: 'Decline',
    onSave: async d => { try { await api('POST', `/api/feedback/${id}/decline`, { reason: d.reason }); toast('Declined'); } catch (e) { toast(e.message, 'err'); return false; } refreshNotes(); if (route()[0] === 'feedback') render(); } });
}
function viewFeedbackItem(id, list) {
  const x = (FBX.mine?.[list] || []).find(v => v.id === id); if (!x) return;
  api('POST', `/api/feedback/${id}/read`).catch(() => {}).then(refreshNotes);
  openDrawer({ title: `Feedback on ${x.reporteeName}`, sub: `${x.kind === 'request' ? 'Requested' : 'Given without a request'} · from ${esc(x.responderName)} · ${fmt((x.answeredAt || x.created).slice(0, 10))}`,
    body: `${x.note ? callout('info', esc(x.note)) : ''}${x.analysis ? `<div class="sec-label">How Team Desk sorted it</div>${analysisHtml(x.analysis)}` : ''}${(x.answers || []).length ? '<div class="sec-label mt">Their answers</div>' : ''}${(x.answers || []).map(a => `<div class="qa"><div class="small muted">${esc(a.q)}</div><div class="pre">${esc(a.a)}</div></div>`).join('')}`,
    foot: x.reporteeId ? `<a class="btn primary" href="${personHref(x.reporteeId, 'feedback')}" onclick="closeDrawer()">Open feedback log</a>` : '' });
}

/* ---------- Feedback page ---------- */
function pgFeedback(tab) {
  const lm = isLM();
  const labels = { inbox: 'Requests for you', give: 'Give feedback', ...(lm ? { requested: 'Your requests', received: 'Received for your team' } : {}), given: 'Given by you', ...(lm || !CENTRAL ? { team: 'From your team (anonymous)' } : {}) };
  if (!CENTRAL) tab = 'team';
  if (!labels[tab]) tab = 'inbox';
  crumbs([['Feedback'], [labels[tab]]]);
  const head = pageHead('Feedback', CENTRAL ? 'Ask other managers for feedback on your reportees, give feedback on people in other teams, and collect anonymous feedback from your own team.' : 'Collect anonymous feedback from your team about you and how the team works.')
    + (CENTRAL ? tabsNav(Object.entries(labels), tab, k => `#/feedback/${k}`) : '');
  if (tab === 'team') return head + pgTeamFeedback();
  if (tab === 'give') return head + `<div class="grid g-side"><div class="card"><div class="card-head"><div><h2>Give feedback on someone in another team</h2><p>Their line manager is notified in Team Desk and sees your name.</p></div></div>
      <div class="card-body"><button class="btn primary" onclick="giveFeedback()">${ic('plus', 15)}Choose a person and write feedback</button></div></div>
    ${card('Good feedback is…', `<div class="small"><p style="margin-top:0"><b>Specific</b> — what happened, when, and the effect it had.</p><p><b>Balanced</b> — what went well and what could be better.</p><p style="margin-bottom:0"><b>About behaviour</b>, not personality. It goes to their manager, sorted into Appreciation, Improvement and Other.</p></div>`)}</div>`;
  setTimeout(() => loadFeedbackTab(tab), 0);
  return head + `<div id="fb-tab">${loadingCard()}</div>`;
}
async function loadFeedbackTab(tab) {
  const el = $('#fb-tab'); if (!el) return;
  try { FBX.mine = await api('GET', '/api/feedback/mine'); } catch (e) { el.innerHTML = callout('bad', esc(e.message)); return; }
  const m = FBX.mine, when = x => fmt((x.answeredAt || x.created).slice(0, 10));
  const st = s => `<span class="badge ${{ open: 'b-warn', answered: 'b-good', declined: 'b-bad' }[s] || ''}">${{ open: 'Waiting', answered: 'Answered', declined: 'Declined', cancelled: 'Withdrawn' }[s]}</span>`;
  const table = (rows, cols, empty) => rows.length ? `<div class="card"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(x => `<tr ${x.read === false ? 'style="font-weight:600"' : ''}>${cols.map(c => `<td>${c[1](x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : card('', emptyState('message', empty[0], empty[1]));
  if (tab === 'inbox') el.innerHTML = table(m.toAnswer, [['About', x => `<b>${esc(x.reporteeName)}</b><div class="xs muted">${esc(x.reporteeDesignation)}</div>`], ['Asked by', x => esc(x.requesterName)], ['Asked', x => fmt(x.created.slice(0, 10))],
      ['', x => `<div style="text-align:right"><button class="btn sm primary ro-ok" onclick="answerRequest('${x.id}')">Answer</button></div>`]], ['No requests waiting', 'When another manager asks you for feedback on one of their reportees, it appears here.']);
  if (tab === 'requested') el.innerHTML = table(m.requested, [['About', x => x.reporteeId ? `<a href="${personHref(x.reporteeId, 'feedback')}">${esc(x.reporteeName)}</a>` : esc(x.reporteeName)], ['Asked', x => esc(x.responderName)], ['Status', x => st(x.status) + (x.declineReason ? `<div class="xs muted">“${esc(x.declineReason)}”</div>` : '')], ['When', when],
      ['', x => `<div style="text-align:right">${x.status === 'answered' ? `<button class="btn sm" onclick="viewFeedbackItem('${x.id}','requested')">View</button>` : x.status === 'open' ? `<button class="btn sm ghost ro-ok" onclick="cancelRequest('${x.id}')">Withdraw</button>` : ''}</div>`]], ['No requests yet', 'Open a reportee’s Feedback log and click “Request feedback”.']);
  if (tab === 'received') el.innerHTML = table(m.received, [['About', x => x.reporteeId ? `<a href="${personHref(x.reporteeId, 'feedback')}">${esc(x.reporteeName)}</a>` : esc(x.reporteeName)], ['From', x => esc(x.responderName)], ['Type', x => x.kind === 'request' ? 'Requested' : '<span class="badge b-acc">Unsolicited</span>'],
      ['Sorted into', x => CAT_UI.map(([k, l, c]) => (x.analysis?.[k] || []).length ? `<span class="badge ${c}">${l} ${x.analysis[k].length}</span>` : '').join(' ')], ['When', when], ['', x => `<div style="text-align:right"><button class="btn sm" onclick="viewFeedbackItem('${x.id}','received')">View</button></div>`]],
      ['Nothing received yet', 'Feedback on your reportees from other managers — requested or not — appears here and in each reportee’s feedback log.']);
  if (tab === 'given') el.innerHTML = table(m.given, [['About', x => `<b>${esc(x.reporteeName)}</b>`], ['Type', x => x.kind === 'request' ? `Requested by ${esc(x.requesterName)}` : 'Unsolicited'], ['Status', x => st(x.status)], ['When', when],
      ['Your words', x => `<div class="small ellipsis" style="max-width:360px">${esc((x.answers || []).map(a => a.a).join(' · '))}</div>`]], ['Nothing given yet', 'Feedback you give or answer appears here. You only see your own words.']);
}

/* ---------- notifications (bell) ---------- */
async function refreshNotes() { try { App.status = await api('GET', '/api/status'); App.csrf = App.status.csrf || App.csrf; const b = $('#topbar .bell'); if (b) b.outerHTML = bellHtml(); renderSidebar(route()); } catch {} }
async function openNotifications() {
  let list = [];
  try { list = await api('GET', '/api/notifications'); } catch (e) { return toast(e.message, 'err'); }
  const text = n => ({ asked: `<b>${esc(n.who)}</b> asked for your feedback on <b>${esc(n.reporteeName)}</b>`, answered: `<b>${esc(n.who)}</b> answered your request about <b>${esc(n.reporteeName)}</b>`,
    received: `<b>${esc(n.who)}</b> gave feedback on <b>${esc(n.reporteeName)}</b> (not requested)`, declined: `<b>${esc(n.who)}</b> declined your request about <b>${esc(n.reporteeName)}</b>` })[n.kind];
  openDrawer({ title: 'Notifications', sub: plural(list.filter(n => !n.read).length, 'unread'),
    body: list.length ? list.map(n => `<button class="notif ${n.read ? '' : 'unread'}" onclick="openNote('${n.id}','${n.kind}','${n.reporteeId || ''}')">${ic(n.kind === 'asked' ? 'message' : n.kind === 'declined' ? 'x' : 'heart', 16)}<span class="grow">${text(n)}<br><span class="xs muted">${fmt(n.created.slice(0, 10))}</span></span></button>`).join('')
      : emptyState('check', 'You’re all caught up', 'Feedback requests and feedback on your team appear here.'),
    foot: list.some(n => !n.read) ? `<button class="btn" onclick="markAllRead()">Mark all as read</button>` : '' });
}
async function openNote(id, kind, rid) {
  closeDrawer();
  if (kind === 'asked') { go('#/feedback/inbox'); return setTimeout(() => answerRequest(id), 150); }
  await api('POST', `/api/feedback/${id}/read`).catch(() => {}); refreshNotes();
  if (rid) go(personHref(rid, 'feedback')); else go('#/feedback/requested');
}
async function markAllRead() {
  const list = await api('GET', '/api/notifications');
  for (const n of list.filter(n => !n.read && n.kind !== 'asked')) await api('POST', `/api/feedback/${n.id}/read`).catch(() => {});
  closeDrawer(); refreshNotes(); toast('Marked as read');
}

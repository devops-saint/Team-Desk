/* =========================================================
   pages-leadership.js — My leadership: scorecard, self-assessment,
   anonymous upward feedback
   ========================================================= */
'use strict';

function pgLeadership(tab) {
  crumbs([['My leadership'], [{ scorecard: 'Scorecard', self: 'Self-assessment', upward: 'Upward feedback' }[tab] || 'Scorecard']]);
  const ck = V.leadCycle || cycleOf().key;
  const head = pageHead('My leadership', 'How you’re doing as a manager — measured from your own records, your reflection and your team’s anonymous feedback.',
    `<select class="input" style="width:auto" onchange="V.leadCycle=this.value;render()">${opts(cycleOpts(), ck)}</select>`) +
    tabsNav([['scorecard', 'Habits scorecard'], ['self', 'Self-assessment'], ['upward', 'Upward feedback']], tab, k => `#/leadership/${k}`);
  if (tab === 'self') return head + leadSelf(ck);
  if (tab === 'upward') return head + leadUpward(ck);
  return head + leadScore(ck);
}
const STATUS_TXT = { good: ['On track', 'b-good'], warn: ['Needs attention', 'b-warn'], bad: ['Off track', 'b-bad'], na: ['Not applicable', ''] };

function leadScore(ck) {
  if (!active().length) return card('', emptyState('compass', 'Add reportees first', 'Your scorecard is calculated from 1:1s, feedback, goals and development plans you record.'));
  const M = leadershipMetrics(ck), ap = M.filter(m => m.status !== 'na'), score = avg(ap.map(m => clamp(m.value, 0, 100)));
  const weakest = ap.filter(m => m.status !== 'good').sort((a, b) => a.value - b.value).slice(0, 2);
  return `<div class="grid g-side"><div class="card tile"><span class="label">${ic('compass', 14)}Leadership habits score · ${esc(cycleByKey(ck).short)}</span><span class="value">${pct(score)}</span>
      <span class="sub">Average of ${ap.length} habits that apply to your team right now. ${ap.filter(m => m.status === 'good').length} on track.</span></div>
    ${card('Focus next', weakest.length ? weakest.map(m => `<div class="list-row">${sevDot(m.status === 'bad' ? 3 : 2)}<div><b>${esc(m.name)}</b><div class="small muted">${esc(m.tip)}</div></div></div>`).join('') : `<div class="muted">${ic('check', 14)} All applicable habits are on track.</div>`)}</div>
    <div class="grid g3 mt">${M.map(m => { const [t, cl] = STATUS_TXT[m.status], lc = LEADERSHIP_COMPS.find(x => x.id === m.comp);
      return `<div class="card"><div class="card-body"><div class="spread"><span class="small muted">${esc(lc?.name || '')}</span><span class="badge ${cl}">${t}</span></div>
        <div class="spread mt-s"><b style="font-size:14px">${esc(m.name)}</b><span style="font-size:22px;font-weight:650">${m.value == null ? '—' : pct(m.value)}</span></div>
        ${m.value != null ? `<div class="mt-s">${progress(m.value, m.status === 'good' ? 'good' : m.status === 'warn' ? 'warn' : m.status === 'bad' ? 'bad' : '')}</div>` : ''}
        <div class="small mt-s">${esc(m.detail)}</div><div class="xs muted mt-s">${esc(m.tip)}</div></div></div>`; }).join('')}</div>`;
}

function leadSelf(ck) {
  const rec = S.leadership.self[ck] || { items: {} }, up = upwardAgg(ck), M = leadershipMetrics(ck);
  return `<div class="card"><div class="card-head"><div><h2>Rate yourself</h2><p>How consistently do you do each of these? Add evidence. Your team’s view appears alongside once enough anonymous responses are in.</p></div></div>
    <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th style="min-width:260px">Manager competency</th><th>Your rating</th><th class="c">Team view</th><th class="c">Habits</th><th>Evidence</th></tr></thead><tbody>
    ${LEADERSHIP_COMPS.map(c => { const it = rec.items[c.id] || {}, tv = up.ok ? up.avg[c.id] : null, hm = M.filter(m => m.comp === c.id && m.status !== 'na');
      const hs = hm.length ? (hm.some(m => m.status === 'bad') ? 'bad' : hm.some(m => m.status === 'warn') ? 'warn' : 'good') : null;
      return `<tr><td><b>${esc(c.name)}</b><div class="sub">${esc(c.desc)}</div></td>
        <td><select onchange="setLead('${ck}','${c.id}','rating',this.value)">${opts(LEAD_SCALE, it.rating)}</select></td>
        <td class="c">${tv != null ? `<b>${tv.toFixed(1)}</b>${it.rating ? `<div class="xs ${Math.abs(tv - it.rating) >= 1 ? '' : 'muted'}" style="${Math.abs(tv - it.rating) >= 1 ? 'color:var(--warn)' : ''}">${tv - it.rating >= 0 ? '+' : ''}${(tv - it.rating).toFixed(1)} vs you</div>` : ''}` : '<span class="muted">—</span>'}</td>
        <td class="c">${hs ? `<span class="badge ${STATUS_TXT[hs][1]}" title="${esc(hm.map(m => m.name).join(', '))}">${STATUS_TXT[hs][0]}</span>` : '<span class="muted">—</span>'}</td>
        <td><input style="width:100%;min-width:180px" value="${esc(it.evidence || '')}" placeholder="Examples…" onchange="setLead('${ck}','${c.id}','evidence',this.value)"></td></tr>`; }).join('')}</tbody></table></div></div>
    <div class="card mt"><div class="card-head"><h2>Reflection</h2><span class="small muted">Saved automatically</span></div><div class="card-body"><form class="fgrid" onchange="setLeadReflection('${ck}',this)">
      ${area('Where I’m strongest as a manager', 'strengths', rec.strengths, { cls: '', rows: 4 })}${area('What I’ll work on this cycle', 'focus', rec.focus, { cls: '', rows: 4 })}</form></div></div>`;
}
function setLead(ck, id, f, v) { const r = S.leadership.self[ck] = S.leadership.self[ck] || { items: {} }; r.items[id] = { ...(r.items[id] || {}), [f]: f === 'rating' ? (v ? +v : '') : v }; r.updated = today(); save(); if (f === 'rating') render(); }
function setLeadReflection(ck, form) { const r = S.leadership.self[ck] = S.leadership.self[ck] || { items: {} }; Object.assign(r, formObj(form)); r.updated = today(); save(); }

function upwardAgg(ck) {
  const up = S.leadership.upward[ck] || { responses: [] }, rs = up.responses || [], min = +S.settings.upwardMin || 3, a = {};
  LEADERSHIP_COMPS.forEach(c => { const v = rs.map(r => +r.answers?.[c.id]).filter(Boolean); a[c.id] = v.length ? avg(v) : null; a[c.id + '_n'] = v.length; });
  return { up, n: rs.length, min, ok: rs.length >= min, avg: a };
}
function leadUpward(ck) {
  const A = upwardAgg(ck), self = S.leadership.self[ck]?.items || {};
  const steps = `<div class="grid g3">
    ${card('1 · Download the questionnaire', `<p class="small" style="margin-top:0">A single web page with the ${LEADERSHIP_COMPS.length} manager competencies as statements, plus Start / Stop / Continue questions. It asks for no names.</p><button class="btn primary" onclick="exportUpwardSurvey('${ck}')">${ic('download', 15)}Download questionnaire</button>`)}
    ${card('2 · Share with your team', `<p class="small" style="margin-top:0">Send the file to your team. Each person opens it in a browser, answers, and clicks <b>Save my response</b>. To protect anonymity, ask them to drop the response file into a shared folder rather than emailing you directly.</p>`)}
    ${card('3 · Import the responses', `<p class="small" style="margin-top:0">${plural(A.n, 'response')} imported. Results appear once at least ${A.min} are in.</p><button class="btn" onclick="pickFiles('.json',true,fs=>importUpward('${ck}',fs))">${ic('upload', 15)}Import response files</button>`)}</div>`;
  if (!A.ok) return steps + `<div class="mt">${callout('info', A.n ? `${A.min - A.n} more response${A.min - A.n === 1 ? '' : 's'} needed before results are shown — this keeps individual answers anonymous.` : 'No responses yet for this cycle.')}</div>`;
  const comments = k => (A.up.responses.map(r => r.comments?.[k]).filter(Boolean)).sort();
  const cmt = (k, l) => card(l, comments(k).length ? comments(k).map(t => `<div class="list-row small"><span class="pre">${esc(t)}</span></div>`).join('') : '<div class="muted small">No comments.</div>');
  return steps + `<div class="card mt"><div class="card-head"><div><h2>Results · ${plural(A.n, 'response')}</h2><p>Average of 1 (rarely) to 5 (consistently). Your own rating is shown for comparison.</p></div>
      <button class="btn sm danger" onclick="clearUpward('${ck}')">Clear responses</button></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Competency</th><th style="width:40%">Team view</th><th class="c">Team</th><th class="c">You</th><th class="c">Answered</th></tr></thead><tbody>
    ${LEADERSHIP_COMPS.map(c => { const v = A.avg[c.id], s = +self[c.id]?.rating || null;
      return `<tr><td>${esc(c.name)}</td><td>${v != null ? progress(v / 5 * 100, v < 3 ? 'warn' : 'good') : '<span class="muted">—</span>'}</td><td class="c"><b>${v != null ? v.toFixed(1) : '—'}</b></td><td class="c">${s || '—'}${s && v != null && Math.abs(v - s) >= 1 ? ` <span class="badge b-warn">${v > s ? 'team higher' : 'blind spot'}</span>` : ''}</td><td class="c small muted">${A.avg[c.id + '_n']}</td></tr>`; }).join('')}</tbody></table></div></div>
    <div class="grid g3 mt">${cmt('start', 'Start doing')}${cmt('stop', 'Stop doing')}${cmt('continue', 'Continue doing')}</div>`;
}
function clearUpward(ck) { confirmBox({ title: 'Clear all responses?', msg: 'Imported responses for this cycle will be removed. The questionnaire stays the same, so people can resubmit.', yes: 'Clear', onYes: () => { S.leadership.upward[ck].responses = []; save(); } }); }

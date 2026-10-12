/* =========================================================
   qbank.js — 1:1 question bank: topics, cadence, guided form,
   configuration page
   ========================================================= */
'use strict';

/* Question types: text (default) · scale (1–5) · choice (opts) */
const QBANK = [
  { id: 'wellbeing', name: 'Wellbeing & workload', cadence: 'monthly', icon: 'heart', qs: [
    { id: 'wb_score', q: 'How are you doing overall, honestly? (1 = struggling, 5 = great)', type: 'scale' },
    { id: 'wb_workload', q: 'How does your workload feel right now?', type: 'choice', opts: ['Too light', 'About right', 'Heavy but manageable', 'Too heavy'] },
    { id: 'wb_balance', q: 'Are you able to switch off after work and take proper breaks?' },
    { id: 'wb_personal', q: 'Is anything outside work affecting you that you’d like me to know about? (only what you’re comfortable sharing)' }] },
  { id: 'project', name: 'Project & work status', cadence: 'monthly', icon: 'clipboard', qs: [
    { id: 'pj_status', q: 'Overall, how is your project work going?', type: 'choice', opts: ['On track', 'Some risks', 'Off track', 'Between projects'] },
    { id: 'pj_done', q: 'What have you delivered or completed since we last met?' },
    { id: 'pj_next', q: 'What are you working on next, and what’s due in the next 2–4 weeks?' },
    { id: 'pj_blockers', q: 'Is anything blocking you or slowing you down? What can I do to help?' },
    { id: 'pj_client', q: 'How are things with the client and stakeholders?' }] },
  { id: 'technical', name: 'Technical', cadence: 'monthly', icon: 'layers', qs: [
    { id: 'tc_challenge', q: 'What technical challenge are you working through right now?' },
    { id: 'tc_decisions', q: 'Any design or technical decision you’d like a second opinion on?' },
    { id: 'tc_quality', q: 'Any quality, tooling or tech-debt concerns I should know about?' },
    { id: 'tc_deepen', q: 'Which technology or skill would you like to go deeper into?' }] },
  { id: 'goals', name: 'Goals & performance', cadence: 'monthly', icon: 'target', qs: [
    { id: 'gl_progress', q: 'How are your goals for this cycle progressing?' },
    { id: 'gl_change', q: 'Does any goal need to change because priorities have shifted?' },
    { id: 'gl_self', q: 'How do you feel about your own performance this month?' }] },
  { id: 'learning', name: 'Self-development & learning', cadence: 'monthly', icon: 'book', qs: [
    { id: 'ln_learned', q: 'What did you learn this month?' },
    { id: 'ln_courses', q: 'Any courses or self-study in progress? How far along are you?' },
    { id: 'ln_next', q: 'What would you like to learn next, and what support do you need (time, budget, mentor)?' }] },
  { id: 'orgtrain', name: 'Trainings & presentations (org level)', cadence: 'monthly', icon: 'message', qs: [
    { id: 'ot_delivered', q: 'Have you delivered any training, presentation, demo or knowledge session recently?' },
    { id: 'ot_planned', q: 'Are you planning one? Topic, audience and date?' },
    { id: 'ot_attended', q: 'Which internal trainings or sessions did you attend, and were they useful?' }] },
  { id: 'certs', name: 'Certifications', cadence: 'quarterly', icon: 'award', qs: [
    { id: 'ce_progress', q: 'Are you working towards a certification? Which one, and when is the exam?' },
    { id: 'ce_done', q: 'Have you completed any certification since we last discussed it?' },
    { id: 'ce_support', q: 'Do you need support — exam vouchers, study time, a study buddy?' }] },
  { id: 'orgcontrib', name: 'Org contributions', cadence: 'quarterly', icon: 'users', qs: [
    { id: 'oc_initiatives', q: 'What have you contributed beyond your project — internal initiatives, process improvements, tools, accelerators?' },
    { id: 'oc_sharing', q: 'Any knowledge sharing — KX posts, blogs, community answers, LinkedIn posts?' },
    { id: 'oc_hiring', q: 'Have you helped with recruitment — interviews, technical tests, campus events?' },
    { id: 'oc_mentoring', q: 'Are you mentoring or onboarding anyone?' }] },
  { id: 'softskills', name: 'Collaboration & non-technical', cadence: 'quarterly', icon: 'message', qs: [
    { id: 'ss_relations', q: 'How are working relationships within the team and with other teams?' },
    { id: 'ss_tricky', q: 'Any tricky conversation or stakeholder situation you’d like to talk through?' },
    { id: 'ss_feedback', q: 'Where would you like feedback on how you work — communication, planning, presenting?' }] },
  { id: 'career', name: 'Career & growth', cadence: 'quarterly', icon: 'trend', qs: [
    { id: 'cr_where', q: 'Where would you like to be in one to two years?' },
    { id: 'cr_next', q: 'What would help you reach the next grade? Which expectations feel furthest away?' },
    { id: 'cr_role', q: 'What would make your current role more fulfilling?' }] },
  { id: 'recognition', name: 'Wins & recognition', cadence: 'monthly', icon: 'award', qs: [
    { id: 'rc_proud', q: 'What are you most proud of since we last met?' },
    { id: 'rc_peers', q: 'Has anyone helped you or done great work that should be recognised?' }] },
  { id: 'leave', name: 'Leave & availability', cadence: 'monthly', icon: 'calendar', qs: [
    { id: 'lv_planned', q: 'Any leave planned in the next three months? Please share the dates.' },
    { id: 'lv_other', q: 'Anything else affecting your availability — travel, personal commitments, training days?' }] },
  { id: 'admin', name: 'Admin & compliance', cadence: 'monthly', icon: 'checkSq', qs: [
    { id: 'ad_mandatory', q: 'Are timesheets and mandatory trainings up to date?', type: 'choice', opts: ['All up to date', 'Some pending', 'Not sure'] },
    { id: 'ad_issues', q: 'Any admin issue I can help with — access, equipment, travel, HR queries?' }] },
  { id: 'engagement', name: 'Team, culture & retention', cadence: 'quarterly', icon: 'heart', qs: [
    { id: 'en_team', q: 'How is the team working together? Anything we should change?' },
    { id: 'en_stay', q: 'What keeps you motivated here? Is there anything that would make you think about leaving?' }] },
  { id: 'manager', name: 'Feedback for me', cadence: 'monthly', icon: 'compass', qs: [
    { id: 'mg_more', q: 'What should I do more of, or differently, to support you?' },
    { id: 'mg_process', q: 'Is any process, meeting or tool wasting your time?' }] },
];
const CADENCES = [['monthly', 'Every month'], ['quarterly', 'Every quarter'], ['asneeded', 'As needed'], ['off', 'Turned off']];
const EMPTY_ANS = /^\s*(no|none|nothing|na|n\/a|nil|-+|not really|nope|no plans?|nothing (new|much)|same as before)\s*\.?\s*$/i;
const answered = v => v != null && String(v).trim() !== '' && !EMPTY_ANS.test(String(v));

/* org overrides live in S.qbank: { topics:{id:{cadence}}, hidden:{qid:true}, custom:[{id,topic,q}] } */
function qbank() {
  const o = S.qbank || {};
  return QBANK.map(t => ({ ...t, cadence: o.topics?.[t.id]?.cadence || t.cadence,
    qs: [...t.qs.filter(q => !o.hidden?.[q.id]), ...(o.custom || []).filter(c => c.topic === t.id).map(c => ({ id: c.id, q: c.q, custom: true }))] }))
    .filter(t => t.cadence !== 'off' && t.qs.length);
}
const qText = qid => { for (const t of QBANK) { const q = t.qs.find(x => x.id === qid); if (q) return q.q; } return (S.qbank?.custom || []).find(c => c.id === qid)?.q || qid; };
const topicName = tid => QBANK.find(t => t.id === tid)?.name || tid;

/* when was a topic last covered for this person? */
function topicLast(p, tid, beforeId) {
  return [...p.oneOnOnes].filter(o => o.id !== beforeId).sort((a, b) => b.date.localeCompare(a.date))
    .find(o => Object.values(o.qa?.[tid] || {}).some(answered))?.date || null;
}
function topicStatus(p, t, beforeId) {
  if (t.cadence === 'monthly') return 'core';
  if (t.cadence === 'asneeded') return 'optional';
  const last = topicLast(p, t.id, beforeId);
  return !last || daysBetween(last, today()) >= 85 ? 'due' : 'optional';
}
function prevAnswer(p, tid, qid, beforeId) {
  const o = [...p.oneOnOnes].filter(x => x.id !== beforeId).sort((a, b) => b.date.localeCompare(a.date)).find(x => answered(x.qa?.[tid]?.[qid]));
  return o ? { date: o.date, v: o.qa[tid][qid] } : null;
}

/* ---------- guided-questions pane inside the 1:1 form ---------- */
function guidedPane(p, o) {
  const tb = qbank(), qa = o.qa || {};
  const st = t => topicStatus(p, t, o.id);
  const order = { core: 0, due: 1, optional: 2 };
  const topics = [...tb].sort((a, b) => order[st(a)] - order[st(b)]);
  const nAns = t => t.qs.filter(q => answered(qa[t.id]?.[q.id])).length;
  const input = (t, q) => {
    const name = `qa__${t.id}__${q.id}`, v = qa[t.id]?.[q.id] ?? '';
    if (q.type === 'scale') return `<div class="seg" role="radiogroup">${['1', '2', '3', '4', '5'].map(n => `<label style="margin:0"><input type="radio" name="${name}" value="${n}" ${String(v) === n ? 'checked' : ''} hidden onchange="qaMark(this)"><span class="qa-pill ${String(v) === n ? 'on' : ''}">${n}</span></label>`).join('')}<label style="margin:0"><input type="radio" name="${name}" value="" ${v ? '' : 'checked'} hidden onchange="qaMark(this)"><span class="qa-pill ${v ? '' : 'on'}">—</span></label></div>`;
    if (q.type === 'choice') return `<select class="input" name="${name}" onchange="qaMark(this)">${opts([['', '—'], ...q.opts], v)}</select>`;
    return `<textarea class="input" name="${name}" rows="2" onchange="qaMark(this)" style="height:auto;padding:8px 10px">${esc(v)}</textarea>`;
  };
  return `<div class="qa-wrap"><nav class="qa-nav">${topics.map((t, i) => { const s = st(t), n = nAns(t);
      return `<button type="button" class="${i ? '' : 'on'}" data-t="${t.id}" onclick="qaTopic(this,'${t.id}')">${ic(t.icon, 15)}<span class="grow">${esc(t.name)}</span>${n ? `<span class="badge b-good" data-n="${t.id}">${n}</span>` : s === 'due' ? '<span class="badge b-warn">due</span>' : s === 'optional' ? '<span class="xs muted">opt.</span>' : ''}</button>`; }).join('')}
      <div class="xs muted" style="padding:10px 8px">Monthly topics are always shown. Quarterly ones are marked <b>due</b> when not covered for ~3 months.</div></nav>
    <div class="qa-body">${topics.map((t, i) => `<div class="qa-topic ${i ? '' : 'on'}" data-t="${t.id}"><div class="spread"><h4 style="font-size:15px">${esc(t.name)}</h4><span class="badge">${esc(CADENCES.find(c => c[0] === t.cadence)?.[1] || '')}${st(t) === 'due' ? ' · due now' : ''}</span></div>
      ${t.qs.map(q => { const pv = prevAnswer(p, t.id, q.id, o.id);
        return `<div class="qa-q"><div class="qa-label">${esc(q.q)}</div>${input(t, q)}${pv ? `<div class="xs muted mt-s">Last time (${fmtShort(pv.date)}): ${esc(String(pv.v).slice(0, 180))}</div>` : ''}</div>`; }).join('')}</div>`).join('')}</div></div>`;
}
function qaTopic(btn, tid) {
  const f = btn.closest('form');
  $$('.qa-nav button', f).forEach(b => b.classList.toggle('on', b === btn));
  $$('.qa-topic', f).forEach(x => x.classList.toggle('on', x.dataset.t === tid));
}
function qaMark(el) {
  if (el.type === 'radio') $$(`input[name="${el.name}"]`, el.form).forEach(r => r.nextElementSibling.classList.toggle('on', r.checked));
  const tid = el.name.split('__')[1], f = el.form, n = $$(`[name^="qa__${tid}__"]`, f).filter(x => (x.type !== 'radio' || x.checked) && answered(x.value)).length;
  const b = $(`.qa-nav button[data-t="${tid}"]`, f); if (!b) return;
  b.querySelectorAll('.badge,.xs').forEach(x => x.remove());
  if (n) b.insertAdjacentHTML('beforeend', `<span class="badge b-good">${n}</span>`);
}
function collectQa(d) {
  const qa = {};
  Object.keys(d).filter(k => k.startsWith('qa__')).forEach(k => { const [, tid, qid] = k.split('__'); if (String(d[k]).trim()) (qa[tid] = qa[tid] || {})[qid] = d[k]; delete d[k]; });
  return qa;
}
function qaHtml(o) {
  const qa = o.qa || {};
  const ts = Object.keys(qa).filter(t => Object.values(qa[t]).some(v => String(v).trim()));
  if (!ts.length) return '';
  return `<div class="sec-label mt">Guided questions</div>${ts.map(t => `<div class="qa"><b>${esc(topicName(t))}</b>${Object.entries(qa[t]).filter(([, v]) => String(v).trim()).map(([q, v]) => `<div class="small muted" style="margin-top:6px">${esc(qText(q))}</div><div>${esc(v)}</div>`).join('')}</div>`).join('')}`;
}

/* ---------- configuration page ---------- */
function pgQuestionBank() {
  crumbs([['Configuration'], ['1:1 question bank']]);
  const o = S.qbank || {};
  return pageHead('1:1 question bank', 'The guided questions shown when you log a 1:1. Choose how often each topic comes up, hide questions you don’t use, or add your own.', `<button class="btn" onclick="resetQbank()">${ic('refresh', 15)}Restore defaults</button>`) +
    QBANK.map(t => { const cad = o.topics?.[t.id]?.cadence || t.cadence, custom = (o.custom || []).filter(c => c.topic === t.id);
      return `<div class="card mb"><div class="card-head"><div class="row">${ic(t.icon, 16, 'style="color:var(--accent)"')}<h2>${esc(t.name)}</h2></div>
        <div class="row"><select class="input" style="width:auto;height:32px" onchange="setTopicCadence('${t.id}',this.value)">${opts(CADENCES, cad)}</select><button class="btn sm" onclick="addCustomQ('${t.id}')">${ic('plus', 14)}Add question</button></div></div>
        <div class="card-body" style="${cad === 'off' ? 'opacity:.55' : ''}">${t.qs.map(q => `<label class="check" style="margin:6px 0;align-items:flex-start"><input type="checkbox" ${o.hidden?.[q.id] ? '' : 'checked'} onchange="toggleQ('${q.id}',this.checked)"><span>${esc(q.q)}${q.type ? ` <span class="badge">${q.type === 'scale' ? '1–5' : 'choice'}</span>` : ''}</span></label>`).join('')}
        ${custom.map(c => `<div class="row" style="margin:6px 0;flex-wrap:nowrap">${ic('edit', 14, 'style="color:var(--muted)"')}<span class="grow">${esc(c.q)} <span class="badge b-acc">yours</span></span><button class="btn ghost icon sm" onclick="delCustomQ('${c.id}')" aria-label="Remove">${ic('x', 14)}</button></div>`).join('')}</div></div>`; }).join('');
}
const qbo = () => (S.qbank = S.qbank || { topics: {}, hidden: {}, custom: [] });
function setTopicCadence(tid, v) { qbo().topics = { ...(S.qbank.topics || {}), [tid]: { cadence: v } }; save(); render(); }
function toggleQ(qid, on) { const h = qbo().hidden = S.qbank.hidden || {}; if (on) delete h[qid]; else h[qid] = true; save(); }
function addCustomQ(tid) {
  openModal({ title: 'Add question', sub: esc(topicName(tid)), body: area('Question', 'q', '', { cls: '', rows: 2 }),
    onSave: d => { if (!d.q) return false; const o = qbo(); o.custom = [...(o.custom || []), { id: 'cq_' + uid(), topic: tid, q: d.q }]; save(); } });
}
function delCustomQ(id) { const o = qbo(); o.custom = (o.custom || []).filter(c => c.id !== id); save(); render(); }
function resetQbank() { confirmBox({ title: 'Restore default questions?', msg: 'Your cadence changes, hidden questions and custom questions will be removed. Answers already recorded are kept.', yes: 'Restore', onYes: () => { S.qbank = { topics: {}, hidden: {}, custom: [] }; save(); } }); }

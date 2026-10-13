/* =========================================================
   report.js — complete record for ONE reportee, to share with
   HR or senior leadership: PDF, Word (.docx) or Excel (.xlsx).
   Each report contains only that reportee. All three formats
   are generated in the browser with no libraries or internet.
   ========================================================= */
'use strict';


const RPT_SECTIONS = [
  ['summary', 'Summary & where to focus', true], ['profile', 'Profile & employment', true], ['reviews', 'Half-yearly reviews', true],
  ['competencies', 'Competencies', true], ['skills', 'Technical skills', true], ['kpis', 'KPIs', true], ['goals', 'Goals', true],
  ['development', 'Development plan, strengths & areas', true], ['feedback', 'Feedback & recognition', true], ['talent', 'Talent & retention', true],
  ['pip', 'Improvement plans', true], ['meetings', '1:1 meetings', true], ['actions', 'Open action items', true], ['leave', 'Leave', true], ['documents', 'Documents on file', true],
];

function reportDialog(pid) {
  const p = getP(pid); if (!p) return;
  const canPrivate = !p.privateHidden;
  const periods = [['12m', 'Last 12 months'], ['all', 'All time'], ...cycleList().slice(1).map(c => [c.key, c.label])];
  const last = V.rptOpts || {};
  openModal({ title: 'Download report', sub: `${esc(p.profile.name)} · for HR or senior leadership`, size: 'wide', saveText: 'Download',
    body: `<div class="ro-ok"><div class="rpt-fmt">${[['pdf', 'PDF', 'Ready to email or print'], ['docx', 'Word', 'Editable — HR can add comments'], ['xlsx', 'Excel', 'One sheet per section']].map(([k, l, d]) =>
        `<label><input type="radio" name="fmt" value="${k}" ${(last.fmt || 'pdf') === k ? 'checked' : ''}>${ic(k === 'xlsx' ? 'grid' : 'file', 20)}${l}<small>${d}</small></label>`).join('')}</div>
      <div class="fgrid mt">${sel('Period', 'period', periods, last.period || '12m', { hint: 'Applies to 1:1s, feedback, goals, leave and reviews. Competencies and KPIs use the selected cycle, or the latest assessed one.' })}<span></span></div>
      <div class="spread mt"><span class="sec-label" style="margin:0">Sections</span><span class="row"><button type="button" class="btn sm ghost" onclick="$$('.rpt-sec input').forEach(i=>i.checked=true)">All</button><button type="button" class="btn sm ghost" onclick="$$('.rpt-sec input').forEach(i=>i.checked=false)">None</button></span></div>
      <div class="rpt-sections rpt-sec">${RPT_SECTIONS.map(([k, l, d]) => chk(l, 's_' + k, last.sections ? last.sections.includes(k) : d)).join('')}</div>
      <div class="mt">${canPrivate ? chk('Include the line manager’s private notes and personal context', 'private', false) : '<div class="xs muted">The line manager’s private notes are not available to you and are not included.</div>'}</div>
      <div class="mt">${callout('info', `The report contains only ${esc(firstName(p.profile.name))}’s record. It is marked confidential${CENTRAL ? ' and the download is recorded in the audit log' : ''}.`, 'shield')}</div></div>`,
    onSave: async d => {
      const sections = RPT_SECTIONS.map(([k]) => k).filter(k => d['s_' + k]);
      if (!sections.length) { toast('Choose at least one section', 'err'); return false; }
      V.rptOpts = { fmt: d.fmt, period: d.period, sections };
      $('#msave').textContent = 'Preparing…';
      try { await downloadReport(pid, { ...V.rptOpts, includePrivate: canPrivate && d.private }); }
      catch (e) { toast(e.message, 'err', 6000); return false; }
    } });
}

async function downloadReport(pid, o) {
  const p = getP(pid), R = buildReport(p, o);
  const name = `${safeName(p.profile.name)}_Team_Desk_report_${today()}`;
  let blob;
  if (o.fmt === 'docx') blob = reportDocx(R);
  else if (o.fmt === 'xlsx') blob = reportXlsx(R);
  else blob = await reportPdf(R);
  downloadBlob(blob, `${name}.${o.fmt}`);
  if (CENTRAL) api('POST', '/api/audit', { action: 'download-report', target: pid, detail: `${o.fmt.toUpperCase()} · ${R.periodLabel} · ${o.sections.length} sections${o.includePrivate ? ' · with private notes' : ''}` }).catch(() => {});
  toast(`Report downloaded (${o.fmt.toUpperCase()})`);
}

/* ---------------------------------------------------------- report model
   section = { title, blocks: [ {t:'kv',rows}, {t:'table',head,rows}, {t:'list',items}, {t:'p',text}, {t:'h3',text}, {t:'note',text} ], sheet? } */
function rptPeriod(key) {
  if (key === 'all') return { from: '0000-01-01', to: '9999-12-31', label: 'All time', ck: null };
  if (key === '12m' || !key) return { from: addMonths(today(), -12), to: today(), label: `Last 12 months (${fmt(addMonths(today(), -12))} – ${fmt(today())})`, ck: null };
  const c = cycleByKey(key);
  return { from: c.start, to: c.end, label: c.label, ck: c.key };
}
const inP = (d, P) => !!d && d >= P.from && d <= P.to;
const yesNo = v => v ? 'Yes' : 'No';
const dash = v => (v === undefined || v === null || String(v).trim() === '') ? '—' : String(v);

function buildReport(p, o) {
  const P = rptPeriod(o.period), sec = new Set(o.sections), pr = p.profile, r = roleOf(p), c = cycleOf();
  const ck = P.ck || c.key, compCk = P.ck ? (hasRatings(p.comp[P.ck]) ? P.ck : null) : latestCompCycle(p) || (hasRatings(p.comp[c.key]) ? c.key : null);
  const mgr = CENTRAL ? (managerName(p.managerId) || App.user?.name || '') : S.settings.managerName;
  const out = [], add = (key, title, blocks, sheet) => { if (sec.has(key)) out.push({ key, title, blocks: blocks.filter(Boolean), sheet }); };
  const kvRows = rows => rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([k, v]) => [k, String(v)]);

  /* summary */
  if (sec.has('summary')) {
    const gs = goalScore(p, ck), cs = compStats(compCk ? p.comp[compCk] : null), css = compStats(compCk ? p.comp[compCk] : null, 'self'), ks = kpiScore(p, ck);
    const ones = p.oneOnOnes.filter(x => inP(x.date, P)), mor = ones.filter(x => +x.morale).map(x => +x.morale), nb = nineOf(p);
    const focus = focusAreas(p).filter(f => f.lvl >= 2).slice(0, 8);
    add('summary', 'Summary', [
      { t: 'kv', rows: kvRows([['Report period', P.label], [`Goal completion (${cycleByKey(ck).short})`, gs == null ? 'No goals' : pct(gs)],
        ['Competency average', FW() ? (cs.avg != null ? `${cs.avg.toFixed(2)} of ${maxV()} (manager)${css.avg != null ? ` · ${css.avg.toFixed(2)} (self)` : ''} · ${cycleByKey(compCk).short}` : 'Not assessed') : ''],
        ['KPI score', ks != null ? `${ks.toFixed(2)} of 5 · ${cycleByKey(ck).short}` : r ? 'Not rated' : ''], ['1:1 meetings in period', `${ones.length}${mor.length ? ` · average morale ${avg(mor).toFixed(1)} of 5` : ''}`],
        ['9-box placement', sec.has('talent') && nb ? `${nb.name}` : ''], ['Promotion readiness', sec.has('talent') ? p.talent.readiness : ''],
        ['Open action items', personActions(p).filter(a => !a.done).length], ['Active development items', p.idp.filter(i => !['Done', 'Deferred'].includes(i.status)).length],
        ['Improvement plan', sec.has('pip') && activePip(p) ? `Active since ${fmt(activePip(p).start)}` : '']]) },
      focus.length ? { t: 'h3', text: 'Where to focus (from Team Desk’s analysis)' } : null,
      focus.length ? { t: 'list', items: focus.filter(f => sec.has('talent') || !['Retention', 'Talent'].includes(f.area)).filter(f => sec.has('pip') || f.area !== 'Improvement plan').map(f => `${f.lvl === 3 ? '[Act now] ' : ''}${f.area}: ${f.text}`) } : null,
    ]);
  }

  /* profile */
  add('profile', 'Profile & employment', [{ t: 'kv', rows: kvRows([['Name', pr.name], ['Employee ID', pr.empId], ['Designation', pr.designation], ['Grade', p.grade], ['Role', r?.name], ['Band', pr.band],
    ['Team / project', pr.team], ['Line manager', mgr], ['Date of joining', pr.doj && fmt(pr.doj)], ['Reporting to line manager since', pr.since && fmt(pr.since)], ['Last promotion', pr.lastPromo && fmt(pr.lastPromo)],
    ['Probation', pr.probationEnd ? `${pr.confirmed ? 'Confirmed' : 'Ends'} ${fmt(pr.probationEnd)}` : ''], ['Work mode', pr.workMode], ['Location', pr.location], ['Work email', pr.email],
    ['Experience', pr.exp && `${pr.exp} years`], ['Education', pr.education], ['Certifications', pr.certs], ['Responsibilities / key projects', pr.projects], ['Career aspirations', pr.aspirations],
    ['Personal context (private)', o.includePrivate ? pr.personal : ''], ['Status', p.archived ? 'Archived (moved out of team)' : 'Active']]) },
    (p.transfers || []).length ? { t: 'h3', text: 'Reporting history' } : null,
    (p.transfers || []).length ? { t: 'table', head: ['Date', 'From', 'To'], rows: p.transfers.map(x => [fmt(x.date), dash(x.fromName), dash(x.toName)]) } : null]);

  /* reviews */
  if (sec.has('reviews')) {
    const ks = Object.keys(p.reviews).filter(k => p.reviews[k]?.rating || p.reviews[k]?.well).filter(k => o.period === 'all' || inP(cycleByKey(k).end, P) || inP(cycleByKey(k).start, P)).sort().reverse();
    add('reviews', 'Half-yearly reviews', ks.length ? ks.flatMap(k => { const rv = p.reviews[k]; return [{ t: 'h3', text: cycleByKey(k).label },
      { t: 'kv', rows: kvRows([['Overall rating', rv.rating ? RATING[rv.rating] : ''], ['Calibrated', rv.rating ? yesNo(rv.calibrated) : ''], ['Promotion readiness', rv.promo], ['What went well', rv.well], ['Areas to improve', rv.improve], ['Focus for next cycle', rv.next], ['Comments', rv.comments], ['Last saved', rv.saved && fmt(rv.saved)]]) }]; })
      : [{ t: 'note', text: 'No review written for this period.' }],
      { head: ['Cycle', 'Overall rating', 'Calibrated', 'Promotion readiness', 'What went well', 'Areas to improve', 'Focus for next cycle', 'Comments'], rows: ks.map(k => { const rv = p.reviews[k]; return [cycleByKey(k).short, rv.rating ? RATING[rv.rating] : '', rv.rating ? yesNo(rv.calibrated) : '', dash(rv.promo), dash(rv.well), dash(rv.improve), dash(rv.next), dash(rv.comments)]; }) });
  }

  /* competencies */
  if (sec.has('competencies')) {
    const rec = compCk ? p.comp[compCk] : null;
    add('competencies', 'Competencies', !FW() ? [{ t: 'note', text: 'No competency framework is configured.' }] : !rec ? [{ t: 'note', text: 'Not assessed for this period.' }] : [
      { t: 'p', text: `${cycleByKey(compCk).label} · grade ${rec.grade || p.grade || '—'} · scale 1–${maxV()}: ${scale().filter(x => numVal(x.v) !== null).map(x => `${x.v} = ${x.label}`).join('; ')}; X = not applicable.` },
      { t: 'table', head: ['Code', 'Competency', 'Self', 'Manager', 'Comment'], rows: FW().comps.map(cp => { const it = rec.items[cp.code] || {}; return [cp.code, cp.name, dash(it.self), dash(it.rating), it.comment || '']; }), widths: [8, 34, 9, 11, 38] },
      { t: 'kv', rows: kvRows([['Average (manager)', compStats(rec).avg != null ? compStats(rec).avg.toFixed(2) : ''], ['Average (self)', compStats(rec, 'self').avg != null ? compStats(rec, 'self').avg.toFixed(2) : '']]) }]);
  }

  /* technical skills */
  if (sec.has('skills')) {
    const rows = S.skills.map(s => { const x = p.skills[s.id] || {}, tg = effTarget(p, s.id), cur = +(x.current || 0); return (cur || tg) ? [s.name, s.cat || '', cur ? SKILL_LEVELS[cur] : 'Not rated', tg ? SKILL_LEVELS[tg] : '—', tg && tg > cur ? String(tg - cur) : '', x.note || ''] : null; }).filter(Boolean);
    add('skills', 'Technical skills', rows.length ? [{ t: 'table', head: ['Skill', 'Area', 'Current', 'Target', 'Gap', 'Note'], rows, widths: [26, 16, 16, 16, 7, 19] }] : [{ t: 'note', text: 'No skills rated.' }]);
  }

  /* KPIs */
  if (sec.has('kpis')) {
    const kc = p.kpi[ck] || {};
    add('kpis', 'KPIs', !r ? [{ t: 'note', text: 'No role (and so no KPIs) set.' }] : !r.kpis.length ? [{ t: 'note', text: `No KPIs defined for ${r.name}.` }] : [
      { t: 'p', text: `${r.name} · ${cycleByKey(ck).label}` },
      { t: 'table', head: ['KPI', 'Target', 'Weight', 'Actual', 'Rating'], rows: r.kpis.map(k => [k.name, `${dash(k.target)}${k.unit ? ' ' + k.unit : ''}`, k.weight ? `${k.weight}%` : '', dash(kc[k.id]?.actual), kc[k.id]?.rating ? RATING[kc[k.id].rating] : 'Not rated']), widths: [34, 16, 10, 16, 24] },
      kpiScore(p, ck) != null ? { t: 'kv', rows: [['Weighted KPI score', `${kpiScore(p, ck).toFixed(2)} of 5`]] } : null]);
  }

  /* goals */
  if (sec.has('goals')) {
    const gs = p.goals.filter(g => P.ck ? goalCycle(g) === P.ck : o.period === 'all' || cycleByKey(goalCycle(g)).end >= P.from).sort((a, b) => goalCycle(b).localeCompare(goalCycle(a)) || (a.due || '').localeCompare(b.due || ''));
    add('goals', 'Goals', gs.length ? [{ t: 'table', head: ['Cycle', 'Goal', 'Category', 'Weight', 'Due', 'Status', 'Progress'], rows: gs.map(g => [cycleByKey(goalCycle(g)).short, g.title + (g.measure ? `\nMeasure: ${g.measure}` : ''), dash(g.category), g.weight ? `${g.weight}%` : '', g.due ? fmt(g.due) : '', g.status, `${+g.progress || 0}%`]), widths: [11, 37, 13, 9, 11, 10, 9] }]
      : [{ t: 'note', text: 'No goals in this period.' }]);
  }

  /* development */
  if (sec.has('development')) {
    add('development', 'Development plan, strengths & areas', [
      p.idp.length ? { t: 'table', head: ['Development action', 'Type', 'Linked to', 'Status', 'Target date'], rows: p.idp.map(i => [i.title + (i.notes ? `\n${i.notes}` : ''), dash(i.type), i.skillId ? linkName(i.skillId) : '', i.status, i.due ? fmt(i.due) : '']), widths: [40, 16, 20, 12, 12] } : { t: 'note', text: 'No development plan items.' },
      { t: 'h3', text: 'Strengths' }, p.strengths.length ? { t: 'list', items: p.strengths.map(x => x.text) } : { t: 'note', text: '—' },
      { t: 'h3', text: 'Development areas' }, p.devAreas.length ? { t: 'list', items: p.devAreas.map(x => x.text) } : { t: 'note', text: '—' }],
      { head: ['Kind', 'Item', 'Type', 'Linked to', 'Status', 'Target date', 'Notes'], rows: [...p.idp.map(i => ['Development action', i.title, dash(i.type), i.skillId ? linkName(i.skillId) : '', i.status, i.due ? fmt(i.due) : '', i.notes || '']),
        ...p.strengths.map(x => ['Strength', x.text, '', '', '', '', '']), ...p.devAreas.map(x => ['Development area', x.text, '', '', '', '', ''])] });
  }

  /* feedback */
  if (sec.has('feedback')) {
    const fb = p.feedback.filter(x => inP(x.date, P)).sort((a, b) => b.date.localeCompare(a.date));
    add('feedback', 'Feedback & recognition', fb.length ? [{ t: 'table', head: ['Date', 'Type', 'Source', 'Feedback'], rows: fb.map(x => [fmt(x.date), x.type, `${x.source}${x.from ? ` (${x.from})` : ''}`, x.text]), widths: [12, 13, 15, 60] }]
      : [{ t: 'note', text: 'Nothing logged in this period.' }]);
  }

  /* talent */
  if (sec.has('talent')) {
    const n = p.ninebox, t = p.talent, nb = nineOf(p), lv = { 1: 'Low', 2: 'Moderate', 3: 'High' };
    const stays = p.stay.filter(x => inP(x.date, P)).sort((a, b) => b.date.localeCompare(a.date));
    add('talent', 'Talent & retention', [{ t: 'kv', rows: kvRows([['9-box placement', nb ? `${nb.name} — ${nb.action}` : 'Not placed'], ['Performance', lv[n.perf]], ['Potential', lv[n.pot]], ['Flight risk', n.risk], ['Main risk factor', n.riskReason], ['Retention actions', n.retention],
      ['Readiness for next move', t.readiness], ['Target role / next grade', t.targetRole], ['Key person', t.keyPerson ? 'Yes — hard to replace in current role' : ''], ['Career plan notes', t.careerNotes]]) },
      stays.length ? { t: 'h3', text: 'Stay conversations' } : null,
      ...stays.map(x => ({ t: 'kv', rows: kvRows([['Date', fmt(x.date)], ...STAY_QUESTIONS.map(([k, q]) => [q, x.answers?.[k]]), ['Agreed actions', x.actions]]) }))],
      { head: ['Item', 'Value'], rows: kvRows([['9-box placement', nb ? `${nb.name} — ${nb.action}` : 'Not placed'], ['Performance', lv[n.perf]], ['Potential', lv[n.pot]], ['Flight risk', n.risk], ['Main risk factor', n.riskReason], ['Retention actions', n.retention], ['Readiness', t.readiness], ['Target role', t.targetRole], ['Key person', t.keyPerson ? 'Yes' : ''], ['Career notes', t.careerNotes],
        ...stays.flatMap(x => [[`Stay conversation ${fmt(x.date)}`, ''], ...STAY_QUESTIONS.map(([k, q]) => [q, x.answers?.[k]]), ['Agreed actions', x.actions]])]) });
  }

  /* improvement plans */
  if (sec.has('pip')) {
    const ps = p.pips.filter(x => o.period === 'all' || (x.end || x.start || '') >= P.from).sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    add('pip', 'Improvement plans', ps.length ? ps.flatMap(x => [{ t: 'h3', text: `${x.status} · ${fmt(x.start)} – ${fmt(x.end)}` },
      { t: 'kv', rows: kvRows([['Why the plan is needed', x.reason], ['Support provided', x.support], ['Outcome', x.outcome]]) },
      x.items.length ? { t: 'table', head: ['Expectation', 'How it is measured', 'Status'], rows: x.items.map(i => [i.text, dash(i.measure), i.status]), widths: [45, 37, 18] } : null,
      (x.checkins || []).length ? { t: 'table', head: ['Check-in', 'Progress', 'Notes'], rows: [...x.checkins].sort((a, b) => a.date.localeCompare(b.date)).map(ci => [fmt(ci.date), dash(ci.progress), dash(ci.notes)]), widths: [14, 14, 72] } : null])
      : [{ t: 'note', text: 'No improvement plan in this period.' }],
      { head: ['Plan', 'Status', 'Start', 'End', 'Reason', 'Support', 'Expectations', 'Check-ins', 'Outcome'], rows: ps.map((x, i) => [`Plan ${ps.length - i}`, x.status, fmt(x.start), fmt(x.end), dash(x.reason), dash(x.support), x.items.map(it => `${it.text} [${it.status}]`).join('\n'), (x.checkins || []).map(ci => `${fmt(ci.date)} ${ci.progress}: ${ci.notes || ''}`).join('\n'), dash(x.outcome)]) });
  }

  /* 1:1 meetings */
  if (sec.has('meetings')) {
    const ones = p.oneOnOnes.filter(x => inP(x.date, P)).sort((a, b) => b.date.localeCompare(a.date));
    const qaPairs = x => Object.entries(x.qa || {}).flatMap(([t, qs]) => Object.entries(qs).filter(([, v]) => String(v).trim()).map(([q, v]) => [`${topicName(t)} — ${qText(q)}`, String(v)]));
    const grow = x => [x.grow?.goal && `Goal: ${x.grow.goal}`, x.grow?.reality && `Reality: ${x.grow.reality}`, x.grow?.options && `Options: ${x.grow.options}`, x.grow?.way && `Way forward: ${x.grow.way}`].filter(Boolean).join('\n');
    const acts = x => (x.actions || []).map(a => `${a.done ? '[done] ' : ''}${a.text}${a.owner === 'me' ? ' (manager)' : ''}${a.due ? ` · due ${fmt(a.due)}` : ''}`);
    add('meetings', '1:1 meetings', ones.length ? ones.flatMap(x => [{ t: 'h3', text: `${fmt(x.date)} · ${x.mode || ''}${+x.morale ? ` · morale ${x.morale} of 5` : ''}` },
      { t: 'kv', rows: kvRows([['Updates & wins', x.updates], ['Discussion', x.notes], ['Concerns / blockers', x.concerns], ['Support needed', x.support], ['Career & growth', x.career], ['Coaching (GROW)', grow(x)], ...qaPairs(x),
        ['Actions agreed', acts(x).join('\n')], ['Private notes', o.includePrivate ? x.private : '']]) }])
      : [{ t: 'note', text: 'No 1:1s in this period.' }],
      { head: ['Date', 'Mode', 'Morale', 'Updates & wins', 'Discussion', 'Concerns / blockers', 'Support needed', 'Career & growth', 'Coaching (GROW)', 'Guided answers', 'Actions agreed', ...(o.includePrivate ? ['Private notes'] : [])],
        rows: ones.map(x => [fmt(x.date), dash(x.mode), x.morale || '', x.updates || '', x.notes || '', x.concerns || '', x.support || '', x.career || '', grow(x), qaPairs(x).map(([q, v]) => `${q}: ${v}`).join('\n'), acts(x).join('\n'), ...(o.includePrivate ? [x.private || ''] : [])]) });
  }

  /* open actions */
  if (sec.has('actions')) {
    const acts = personActions(p).filter(a => !a.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
    add('actions', 'Open action items', acts.length ? [{ t: 'table', head: ['Action', 'Owner', 'Due', 'From'], rows: acts.map(a => [a.text, a.owner === 'me' ? 'Line manager' : firstName(pr.name), a.due ? `${fmt(a.due)}${a.due < today() ? ' (overdue)' : ''}` : '', a.o ? `1:1 ${fmt(a.o.date)}` : dash(a.source)]), widths: [52, 16, 16, 16] }]
      : [{ t: 'note', text: 'No open action items.' }]);
  }

  /* leave */
  if (sec.has('leave')) {
    const lv = (p.leaves || []).filter(l => inP(l.from, P) || inP(l.to, P) || (l.to || l.from) >= today()).sort((a, b) => a.from.localeCompare(b.from));
    add('leave', 'Leave', lv.length ? [{ t: 'table', head: ['From', 'To', 'Working days', 'Type', 'Status', 'Notes'], rows: lv.map(l => [fmt(l.from), fmt(l.to || l.from), String(workDays(l.from, l.to || l.from)), dash(l.type), dash(l.status), l.notes || '']), widths: [14, 14, 12, 16, 12, 32] }]
      : [{ t: 'note', text: 'No leave recorded for this period.' }]);
  }

  /* documents */
  if (sec.has('documents')) {
    const ds = p.docs.filter(d => o.period === 'all' || inP(d.date, P)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    add('documents', 'Documents on file', ds.length ? [{ t: 'table', head: ['Document', 'Type', 'Uploaded'], rows: ds.map(d => [d.name, dash(d.docType), d.date ? fmt(d.date) : '']), widths: [60, 22, 18] }, { t: 'note', text: 'Originals are kept in Team Desk and are not attached to this report.' }]
      : [{ t: 'note', text: 'No documents in this period.' }]);
  }

  const by = CENTRAL ? `${App.user?.name || ''} (${PROFILE_LABEL[App.profile] || ''})` : S.settings.managerName || 'Line manager';
  return { title: pr.name || 'Reportee', subtitle: [pr.designation, p.grade && `Grade ${p.grade}`, r?.name, pr.team, mgr && `Line manager: ${mgr}`].filter(Boolean).join(' · '),
    periodLabel: P.label, sections: out, prepared: `Prepared by ${by} on ${fmt(today())}`, footer: 'Confidential — for HR and leadership use only. Do not forward.', private: !!o.includePrivate };
}

/* ---------------------------------------------------------- PDF (built here — no library or internet needed)
   Standard Helvetica fonts with WinAnsi encoding; text is wrapped using the font metrics. */
const HELV = {
  r: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],
  b: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584],
};
const WIN_SPECIAL = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F };
const SPECIAL_W = { 0x80: 556, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x99: 1000, 0xA0: 278, 0xB7: 278, 0xB0: 400, 0xD7: 584 };
/* unicode text -> string of WinAnsi byte values */
function winAnsi(s) {
  let out = '';
  for (const ch of String(s ?? '').replace(/→/g, '->').replace(/←/g, '<-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/₹/g, 'Rs ').replace(/[✓✔]/g, 'v').replace(/\t/g, '  ')) {
    const c = ch.codePointAt(0);
    if ((c >= 32 && c < 127) || (c >= 0xA0 && c <= 0xFF)) out += ch;
    else if (WIN_SPECIAL[ch]) out += String.fromCharCode(WIN_SPECIAL[ch]);
    else { const base = ch.normalize('NFKD').replace(/[^\x20-\x7e]/g, ''); out += base || (c > 32 ? '?' : ''); }
  }
  return out;
}
function charW(code, bold) {
  if (code >= 32 && code <= 126) return HELV[bold ? 'b' : 'r'][code - 32];
  if (SPECIAL_W[code]) return SPECIAL_W[code];
  const base = String.fromCharCode(code).normalize('NFKD').charCodeAt(0);
  return base >= 32 && base <= 126 ? HELV[bold ? 'b' : 'r'][base - 32] : 556;
}
const textW = (s, size, bold) => { let w = 0; for (let i = 0; i < s.length; i++) w += charW(s.charCodeAt(i), bold); return w * size / 1000; };
/* wrap WinAnsi text to a width */
function wrapW(s, size, bold, width) {
  const lines = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const tryLine = line + word;
      if (textW(tryLine, size, bold) <= width || !line.trim()) {
        if (textW(tryLine, size, bold) <= width) { line = tryLine; continue; }
        /* a single word wider than the column: break it */
        let chunk = line;
        for (const ch of word) { if (textW(chunk + ch, size, bold) > width && chunk) { lines.push(chunk); chunk = ''; } chunk += ch; }
        line = chunk; continue;
      }
      lines.push(line.replace(/\s+$/, ''));
      line = /^\s+$/.test(word) ? '' : word;
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines;
}
const pdfStr = s => '(' + s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r/g, '') + ')';
const rgb = c => c.map(v => (v / 255).toFixed(3)).join(' ');

function PdfDoc() {
  const W = 595.28, H = 841.89, M = 46, BOTTOM = 62;
  const pages = []; let ops = null, y = 0;
  const FONT = { r: 'F1', b: 'F2', i: 'F3' };
  const newPage = () => { ops = []; pages.push(ops); y = M; };
  newPage();
  const api = {
    W, H, M, get y() { return y; }, set y(v) { y = v; }, contentW: W - 2 * M,
    room(h) { if (y + h > H - BOTTOM) { newPage(); return true; } return false; },
    text(x, yTop, s, size, font = 'r', color = [24, 31, 42]) { ops.push(`BT /${FONT[font]} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${(H - yTop - size * 0.8).toFixed(2)} Td ${pdfStr(s)} Tj ET`); },
    rect(x, yTop, w, h, fill, stroke) {
      if (fill) ops.push(`${rgb(fill)} rg ${x.toFixed(2)} ${(H - yTop - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
      if (stroke) ops.push(`${rgb(stroke)} RG 0.6 w ${x.toFixed(2)} ${(H - yTop - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    },
    line(x1, y1, x2, y2, color, width = 1) { ops.push(`${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`); },
    /* paragraph that flows across pages */
    para(s, size, font = 'r', color, indent = 0, gapAfter = 4) {
      const lh = size * 1.32;
      for (const ln of wrapW(winAnsi(s), size, font === 'b', api.contentW - indent)) { api.room(lh); api.text(M + indent, y, ln, size, font, color); y += lh; }
      y += gapAfter;
    },
    /* table with wrapped cells; rows split across pages when needed; header repeats */
    table(head, rows, widthsPct, o = {}) {
      const size = o.size || 8.6, lh = size * 1.28, pad = 4, cw = api.contentW;
      const ws = widthsPct ? widthsPct.map(w => cw * w / 100) : (head || rows[0]).map((_, i, a) => cw / a.length);
      const xs = ws.map((_, i) => M + ws.slice(0, i).reduce((s, w) => s + w, 0));
      const cellLines = (row, boldCol) => row.map((c, i) => wrapW(winAnsi(c), size, boldCol === i || o.boldAll, ws[i] - 2 * pad));
      const drawHead = () => {
        if (!head) return;
        const hl = cellLines(head, null).map(l => l), hh = Math.max(...hl.map(l => l.length)) * lh + 2 * pad;
        api.room(hh + lh + 2 * pad);
        api.rect(M, y, cw, hh, o.headFill || [37, 99, 235]);
        hl.forEach((ls, i) => ls.forEach((ln, k) => api.text(xs[i] + pad, y + pad + k * lh, ln, size, 'b', [255, 255, 255])));
        y += hh;
      };
      drawHead();
      rows.forEach((row, ri) => {
        let ls = row.map((c, i) => wrapW(winAnsi(c), size, o.kv && i === 0, ws[i] - 2 * pad));
        while (ls.some(l => l.length)) {
          const avail = H - BOTTOM - y - 2 * pad;
          let fit = Math.floor(avail / lh);
          const need = Math.max(...ls.map(l => l.length));
          if (fit < Math.min(need, 2)) { newPage(); drawHead(); continue; }
          fit = Math.min(fit, need);
          const h = fit * lh + 2 * pad;
          if (o.kv) api.rect(M, y, ws[0], h, [242, 244, 247]);
          else if (ri % 2 === 1) api.rect(M, y, cw, h, [247, 248, 250]);
          ls.forEach((l, i) => l.slice(0, fit).forEach((ln, k) => api.text(xs[i] + pad, y + pad + k * lh, ln, size, o.kv && i === 0 ? 'b' : 'r', o.kv && i === 0 ? [71, 84, 103] : [24, 31, 42])));
          api.line(M, y + h, M + cw, y + h, [228, 231, 236], 0.5);
          y += h;
          ls = ls.map(l => l.slice(fit));
          if (ls.some(l => l.length)) { newPage(); drawHead(); }
        }
      });
      y += 10;
    },
    build(title, footerLeft) {
      const n = pages.length;
      pages.forEach((p, i) => {
        p.push(`BT /F1 7.8 Tf ${rgb([102, 112, 133])} rg ${M} 30 Td ${pdfStr(winAnsi(footerLeft))} Tj ET`);
        const pg = `Page ${i + 1} of ${n}`;
        p.push(`BT /F1 7.8 Tf ${rgb([102, 112, 133])} rg ${(W - M - textW(pg, 7.8)).toFixed(2)} 30 Td ${pdfStr(pg)} Tj ET`);
      });
      const objs = [];   // objs[i] = body of object i+1
      const add = body => { objs.push(body); return objs.length; };
      const catalog = add(''), pagesObj = add('');
      const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
      const kids = pages.map(p => {
        const content = p.join('\n');
        const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${c} 0 R >>`);
      });
      objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
      objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
      const info = add(`<< /Title ${pdfStr(winAnsi(title))} /Producer (Team Desk) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}) >>`);
      let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
      objs.forEach((b, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${b}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
      out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
      return new Blob([bytes], { type: 'application/pdf' });
    },
  };
  return api;
}
async function reportPdf(R) {
  const d = PdfDoc(), ACC = [37, 99, 235], INK = [24, 31, 42], MUTED = [102, 112, 133];
  d.para(R.title, 20, 'b', INK, 0, 2);
  d.para(R.subtitle, 10, 'r', MUTED, 0, 2);
  d.para(`${R.periodLabel} · ${R.prepared}`, 9, 'r', MUTED, 0, 6);
  d.line(d.M, d.y, d.W - d.M, d.y, ACC, 1.2); d.y += 14;
  for (const s of R.sections) {
    d.room(60);
    d.para(s.title, 13.5, 'b', ACC, 0, 4);
    for (const b of s.blocks) {
      if (b.t === 'kv') { if (b.rows.length) d.table(null, b.rows, [30, 70], { kv: true }); }
      else if (b.t === 'table') d.table(b.head, b.rows, b.widths);
      else if (b.t === 'h3') { d.room(34); d.para(b.text, 10.5, 'b', INK, 0, 3); }
      else if (b.t === 'list') { b.items.forEach(it => d.para(`•  ${it}`, 9.2, 'r', INK, 6, 1)); d.y += 4; }
      else if (b.t === 'note') d.para(b.text, 9, 'i', MUTED, 0, 6);
      else d.para(b.text, 9.2, 'r', INK, 0, 6);
    }
    d.y += 6;
  }
  return d.build(`${R.title} — Team Desk report`, `${R.title} · ${R.footer}`);
}

/* ---------------------------------------------------------- Word (.docx, built here — no library needed) */
const xmlEsc = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function wRuns(text, rpr = '') {
  return String(text ?? '').split('\n').map((ln, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(ln)}</w:t></w:r>`).join('');
}
const wP = (text, style, rpr) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${wRuns(text, rpr)}</w:p>`;
function wTable(head, rows, widths, kv) {
  const total = 9638, ws = widths ? widths.map(w => Math.round(total * w / 100)) : kv ? [2900, total - 2900] : (head || rows[0] || []).map((_, i, a) => Math.round(total / a.length));
  const cell = (t, w, hdr, first) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${hdr ? '<w:shd w:val="clear" w:color="auto" w:fill="2563EB"/>' : first ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F4F7"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>${wRuns(t, hdr ? '<w:b/><w:color w:val="FFFFFF"/><w:sz w:val="18"/>' : first ? '<w:b/><w:color w:val="475467"/><w:sz w:val="18"/>' : '<w:sz w:val="18"/>')}</w:p></w:tc>`;
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TDTable"/><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ws.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
    ${head ? `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h, i) => cell(h, ws[i], true)).join('')}</w:tr>` : ''}${rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => cell(c, ws[i], false, kv && i === 0)).join('')}</w:tr>`).join('')}</w:tbl>${wP('', 'Gap')}`;
}
function reportDocx(R) {
  let body = wP(R.title, 'Title') + wP(R.subtitle, 'Subtle') + wP(`${R.periodLabel} · ${R.prepared}`, 'Subtle');
  for (const s of R.sections) {
    body += wP(s.title, 'Heading1');
    for (const b of s.blocks) {
      if (b.t === 'kv') body += b.rows.length ? wTable(null, b.rows, null, true) : '';
      else if (b.t === 'table') body += wTable(b.head, b.rows, b.widths);
      else if (b.t === 'h3') body += wP(b.text, 'Heading2');
      else if (b.t === 'list') body += b.items.map(it => wP(`•  ${it}`, 'ListPara')).join('');
      else if (b.t === 'note') body += wP(b.text, 'Subtle');
      else body += wP(b.text);
    }
  }
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${W}><w:p><w:pPr><w:pStyle w:val="Subtle"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr>${wRuns(`${R.title} · ${R.footer}`)}<w:r><w:tab/><w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> of </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
  const st = (id, name, ppr, rpr, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${extra}<w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}>
    <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1F2937"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
    ${st('Title', 'Title', '<w:spacing w:after="40"/>', '<w:b/><w:sz w:val="40"/><w:color w:val="111827"/>')}
    ${st('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="320" w:after="100"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="2563EB"/></w:pBdr><w:outlineLvl w:val="0"/>', '<w:b/><w:sz w:val="28"/><w:color w:val="2563EB"/>', '<w:next w:val="Normal"/>')}
    ${st('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="22"/><w:color w:val="111827"/>', '<w:next w:val="Normal"/>')}
    ${st('Subtle', 'Subtle', '<w:spacing w:after="40"/>', '<w:color w:val="667085"/><w:sz w:val="18"/>')}
    ${st('ListPara', 'List text', '<w:ind w:left="200" w:hanging="200"/><w:spacing w:after="40"/>', '')}
    ${st('Gap', 'Gap', '<w:spacing w:after="0" w:line="120" w:lineRule="exact"/>', '<w:sz w:val="8"/>')}
    <w:style w:type="table" w:styleId="TDTable"><w:name w:val="Team Desk table"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D0D5DD"/><w:left w:val="single" w:sz="4" w:color="D0D5DD"/><w:bottom w:val="single" w:sz="4" w:color="D0D5DD"/><w:right w:val="single" w:sz="4" w:color="D0D5DD"/><w:insideH w:val="single" w:sz="4" w:color="EAECF0"/><w:insideV w:val="single" w:sz="4" w:color="EAECF0"/></w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
  </w:styles>`;
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(R.title)} — Team Desk report</dc:title><dc:creator>Team Desk</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
    ['word/document.xml', doc], ['word/styles.xml', styles], ['word/footer1.xml', footer],
  ];
  return zipStore(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/* minimal ZIP writer (stored, no compression) — enough for .docx */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files, type) {
  const te = new TextEncoder(), now = new Date();
  const dosT = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosD = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = []; let off = 0;
  for (const [n, content] of files) {
    const name = te.encode(n), data = typeof content === 'string' ? te.encode(content) : content, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dosT, 2], [12, dosD, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
      .forEach(([o, v, s]) => s === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dosT, 2], [14, dosD, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]]
      .forEach(([o, v, s]) => s === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const cdLen = central.reduce((s, a) => s + a.length, 0), e = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cdLen, 4], [16, off, 4], [20, 0, 2]].forEach(([o, v, s]) => s === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true));
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type });
}

/* ---------------------------------------------------------- Excel (.xlsx, built here — no library needed) */
const colRef = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
function xlSheet(aoa, widths, opts = {}) {
  const rows = aoa.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const style = opts.title && ri === 0 ? 3 : opts.header && ri === 0 ? 1 : opts.boldFirstCol && ci === 0 && String(v) === String(v).toUpperCase() && String(v).trim() ? 4 : 2;
    return v === '' || v == null ? '' : `<c r="${colRef(ci)}${ri + 1}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEsc(String(v).slice(0, 32000))}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    ${opts.header ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : ''}
    <cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData></worksheet>`;
}
function reportXlsx(R) {
  const sheets = [], used = new Set();
  const sheetName = t => { let n = t.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), i = 2; while (used.has(n)) n = `${t.slice(0, 28)} ${i++}`; used.add(n); return n; };
  const colW = (head, rows) => head.map((h, i) => Math.min(60, Math.max(String(h).length + 2, 8, ...rows.slice(0, 300).map(r => Math.max(...String(r[i] ?? '').split('\n').map(l => l.length)) + 1))));
  /* first sheet: title, then every section's key/value details; tables get their own sheets */
  const cover = [[R.title], [R.subtitle], [R.periodLabel], [R.prepared], [R.footer], []], tablesOut = [];
  for (const s of R.sections) {
    if (s.sheet) { tablesOut.push([s.title, s.sheet.head, s.sheet.rows]); continue; }
    const tables = s.blocks.filter(b => b.t === 'table');
    let started = false;
    s.blocks.filter(b => b.t !== 'table').forEach(b => {
      if (!started && (b.t === 'kv' || b.t === 'list' || (b.t === 'note' && !tables.length))) { cover.push([s.title.toUpperCase()]); started = true; }
      if (b.t === 'kv') b.rows.forEach(r => cover.push(r));
      else if (b.t === 'list') b.items.forEach(it => cover.push(['', it]));
      else if (b.t === 'h3') cover.push([b.text]);
      else if (b.t === 'note' && !tables.length) cover.push(['', b.text]);
    });
    if (started) cover.push([]);
    tables.forEach((b, i) => tablesOut.push([tables.length > 1 ? `${s.title} ${i + 1}` : s.title, b.head, b.rows]));
  }
  sheets.push([sheetName('Summary'), xlSheet(cover, [36, 100], { title: true, boldFirstCol: true })]);
  tablesOut.forEach(([title, head, rows]) => sheets.push([sheetName(title), xlSheet([head, ...rows], colW(head, rows), { header: true })]));
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${NS}>
    <fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF2563EB"/><name val="Calibri"/></font></fonts>
    <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill></fills>
    <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
      <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(R.title)} — Team Desk report</dc:title><dc:creator>Team Desk</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n], i) => `<sheet name="${xmlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', styles],
    ...sheets.map(([, xml], i) => [`xl/worksheets/sheet${i + 1}.xml`, xml]),
  ];
  return zipStore(files, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

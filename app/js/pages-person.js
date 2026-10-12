/* =========================================================
   pages-person.js — the reportee workspace (one section per screen)
   ========================================================= */
'use strict';

const SECTIONS = [
  ['Summary', [['overview', 'Overview', 'home']]],
  ['Connect', [['meetings', '1:1 meetings', 'message'], ['actions', 'Action items', 'checkSq']]],
  ['Assess', [['competencies', 'Competencies', 'grid'], ['skills', 'Technical skills', 'layers'], ['kpis', 'KPIs', 'bars']]],
  ['Talent', [['talent', 'Talent & retention', 'award']]],
  ['Develop', [['goals', 'Goals', 'target'], ['idp', 'Development plan', 'trend'], ['strengths', 'Strengths & areas', 'flag'], ['feedback', 'Feedback log', 'heart'], ['pip', 'Improvement plan', 'clipboard']]],
  ['Records', [['profile', 'Profile', 'user'], ['documents', 'Documents', 'file']]],
  ['Review', [['review', 'Half-yearly review', 'award']]],
];
const SEC_LABEL = Object.fromEntries(SECTIONS.flatMap(([, it]) => it.map(([k, l]) => [k, l])));

function pgPerson(id, sec) {
  const p = getP(id);
  if (!p) { crumbs([['Reportees', '#/people'], ['Not found']]); return card('', emptyState('user', 'Reportee not found', 'They may have been deleted.', '<a class="btn" href="#/people">Back to reportees</a>')); }
  if (!SEC_LABEL[sec]) sec = 'overview';
  crumbs([['Reportees', '#/people'], [p.profile.name, personHref(p.id)], [SEC_LABEL[sec]]]);
  const r = roleOf(p), nb = nineOf(p), pip = activePip(p);
  const f = focusAreas(p), hi = f.filter(x => x.lvl === 3).length;
  const count = { actions: p.oneOnOnes.reduce((n, o) => n + (o.actions || []).filter(a => !a.done).length, 0), overview: hi || null, pip: pip ? '●' : null };
  const meta = [p.profile.designation, p.grade && `Grade ${p.grade}`, r?.name, p.profile.since && `Reports to you since ${fmt(p.profile.since)}`].filter(Boolean).map(esc).join(' · ');
  const body = { overview: secOverview, meetings: secMeetings, actions: secActions, competencies: secCompetencies, skills: secSkills, kpis: secKpis, talent: secTalent,
    goals: secGoals, idp: secIdp, strengths: secStrengths, feedback: secFeedback, pip: secPip, profile: secProfile, documents: secDocuments, review: secReview }[sec](p);
  return `<div class="person-head"><div class="row" style="gap:14px;flex-wrap:nowrap">${avatar(p, 'lg')}<div><h1>${esc(p.profile.name)}</h1><div class="meta">${meta || 'No designation set'}</div>
      <div class="row mt-s">${p.archived ? '<span class="badge">Archived</span>' : ''}${nb ? `<span class="badge b-acc">${esc(nb.name)}</span>` : ''}${riskBadge(p.ninebox.risk)}${pip ? '<span class="badge b-warn">Improvement plan active</span>' : ''}</div></div></div>
      <div class="row"><button class="btn" onclick="editProfile('${p.id}')">${ic('edit', 15)}Edit profile</button><button class="btn primary" onclick="editOne('${p.id}')">${ic('message', 15)}Log 1:1</button></div></div>
    <div class="ws"><nav class="subnav" aria-label="Sections">${SECTIONS.map(([g, items]) => `<div class="grp">${g}</div>${items.map(([k, l, icon]) => `<a class="${k === sec ? 'on' : ''}" href="${personHref(p.id, k)}">${ic(icon, 15)}${l}${count[k] ? `<span class="badge ${k === 'overview' ? 'b-bad' : k === 'pip' ? 'b-warn' : ''}">${count[k]}</span>` : ''}</a>`).join('')}`).join('')}</nav>
      <select class="input subnav-select" onchange="go('${personHref(p.id, '')}'+this.value)">${SECTIONS.map(([g, items]) => `<optgroup label="${g}">${items.map(([k, l]) => `<option value="${k}" ${k === sec ? 'selected' : ''}>${l}</option>`).join('')}</optgroup>`).join('')}</select>
      <div style="min-width:0">${body}</div></div>`;
}

/* ---------------- Overview ---------------- */
function secOverview(p) {
  const c = cycleOf(), l = lastOne(p), n = nextOne(p);
  const gs = goalScore(p, c.key), cg = p.goals.filter(g => goalCycle(g) === c.key && g.status !== 'Dropped').length;
  const cs = compStats(p.comp[c.key]), openActs = p.oneOnOnes.flatMap(o => (o.actions || []).filter(a => !a.done));
  const months = []; for (let i = 5; i >= 0; i--) months.push(addMonths(today().slice(0, 7) + '-01', -i).slice(0, 7));
  const mood = moraleByMonth(p, months);
  return sectionHead('Overview', `Where to focus with ${esc(firstName(p.profile.name))}, based on everything recorded.`) +
    `<div class="grid g2">${card('Where to focus', focusList(focusAreas(p), 99, p.id), { sub: 'Red = act now · amber = soon · grey = when you can' })}
    ${card(`At a glance · ${esc(c.short)}`, `<dl class="kv" style="grid-template-columns:160px minmax(0,1fr)">
      <dt>Last 1:1</dt><dd>${l ? `${fmt(l.date)} <span class="muted small">(${relDays(l.date)})</span>` : '—'}</dd>
      <dt>Next 1:1</dt><dd>${n ? fmt(n) : '<span class="muted">Not planned</span>'}</dd>
      <dt>Open action items</dt><dd>${openActs.length}${openActs.filter(a => a.due && a.due < today()).length ? ` <span class="badge b-bad">${openActs.filter(a => a.due && a.due < today()).length} overdue</span>` : ''}</dd>
      <dt>Goals</dt><dd>${cg ? `${cg} · ${pct(gs)} complete` : '<span class="muted">None set</span>'}</dd>
      ${FW() ? `<dt>Competency average</dt><dd>${cs.avg != null ? `${cs.avg.toFixed(2)} / ${highV()}` : '<span class="muted">Not assessed</span>'}</dd>` : ''}
      <dt>Development plan</dt><dd>${p.idp.filter(i => !['Done', 'Deferred'].includes(i.status)).length} active · ${p.idp.filter(i => i.status === 'Done').length} done</dd>
      <dt>Morale (6 months)</dt><dd>${mood.some(v => v != null) ? spark(mood) : '<span class="muted">No morale recorded</span>'}</dd>
      <dt>Tenure with you</dt><dd>${p.profile.since ? `${Math.max(0, Math.round(daysBetween(p.profile.since, today()) / 30.4))} months` : '—'}</dd></dl>`)}</div>`;
}

/* ---------------- 1:1 meetings ---------------- */
function secMeetings(p) {
  const c = cycleOf(), months = cycleMonths(c, false), cur = today().slice(0, 7);
  const ones = [...p.oneOnOnes].sort((a, b) => b.date.localeCompare(a.date));
  return sectionHead('1:1 meetings', 'Monthly connects. Open a meeting to read the full notes.', `<button class="btn primary" onclick="editOne('${p.id}')">${ic('plus', 15)}Log 1:1</button>`) +
    card(`Monthly coverage · ${esc(c.short)}`, `<div class="months">${months.map(m => `<span class="${p.oneOnOnes.some(o => o.date.startsWith(m)) ? 'ok' : ''} ${m === cur ? 'now' : ''}">${fmtMonth(m)}</span>`).join('')}</div>`) +
    `<div class="card mt">${ones.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Mode</th><th>Morale</th><th>Summary</th><th>Coaching</th><th class="c">Actions</th></tr></thead><tbody>
      ${ones.map(o => { const a = o.actions || [], open = a.filter(x => !x.done).length, mor = +o.morale;
        return `<tr class="click" onclick="viewOne('${p.id}','${o.id}')"><td class="nowrap"><b>${fmt(o.date)}</b></td><td>${esc(o.mode || '—')}</td>
          <td>${mor ? `<span class="badge ${mor <= 2 ? 'b-bad' : mor >= 4 ? 'b-good' : ''}">${mor}/5</span>` : '<span class="muted">—</span>'}</td>
          <td class="small" style="max-width:340px"><div class="ellipsis">${esc(o.updates || o.notes || o.grow?.goal || '—')}</div></td>
          <td>${o.grow && (o.grow.goal || o.grow.way) ? '<span class="badge b-acc">GROW</span>' : ''}${o.career ? ' <span class="badge">Career</span>' : ''}</td>
          <td class="c">${a.length ? `${open ? `<span class="badge b-warn">${open} open</span>` : '<span class="badge b-good">All done</span>'}` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
    : emptyState('message', 'No 1:1s logged yet', 'Log your monthly connect, including a GROW coaching conversation and action items.', `<button class="btn primary" onclick="editOne('${p.id}')">Log first 1:1</button>`)}</div>`;
}
function viewOne(pid, oid) {
  const p = getP(pid), o = p.oneOnOnes.find(x => x.id === oid); if (!o) return;
  const qa = (l, v) => v ? `<div class="qa"><b>${l}</b><div>${esc(v)}</div></div>` : '';
  const g = o.grow || {};
  openDrawer({
    title: `1:1 · ${fmt(o.date)}`, sub: `${esc(p.profile.name)} · ${esc(o.mode || '')}${+o.morale ? ` · morale ${esc(MORALE[o.morale])}` : ''}`,
    body: `${qa('Their updates & wins', o.updates)}${qa('Discussion', o.notes)}
      ${g.goal || g.reality || g.options || g.way ? `<div class="sec-label mt">Coaching (GROW)</div>${qa('Goal', g.goal)}${qa('Reality', g.reality)}${qa('Options', g.options)}${qa('Way forward', g.way)}` : ''}
      ${qa('Concerns / blockers', o.concerns)}${qa('Support needed from you', o.support)}${qa('Career & growth', o.career)}${qa('Private notes', o.private)}
      ${(o.actions || []).length ? `<div class="sec-label mt">Action items</div>${o.actions.map(a => `<label class="check" style="margin:6px 0"><input type="checkbox" ${a.done ? 'checked' : ''} onchange="toggleAct('${pid}','${oid}','${a.id}',this.checked)"><span style="${a.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(a.text)}</span>
        <span class="badge">${a.owner === 'me' ? 'You' : esc(firstName(p.profile.name))}</span>${a.due ? `<span class="badge ${!a.done && a.due < today() ? 'b-bad' : ''}">${fmtShort(a.due)}</span>` : ''}${a.carried ? '<span class="badge">carried forward</span>' : ''}</label>`).join('')}` : ''}
      ${o.next ? `<p class="small muted mt">Next 1:1 planned for ${fmt(o.next)}</p>` : ''}`,
    foot: `<button class="btn danger" onclick="delOne('${pid}','${oid}')">${ic('trash', 15)}Delete</button><span class="grow"></span><button class="btn primary" onclick="closeDrawer();editOne('${pid}','${oid}')">${ic('edit', 15)}Edit</button>`,
  });
}
const actRow = (a = {}) => `<div class="act-row"><input class="input" data-a="text" placeholder="What needs to happen" value="${esc(a.text || '')}"><select class="input" data-a="owner">${opts([['them', 'Reportee'], ['me', 'Me']], a.owner || 'them')}</select>
  ${dateInput('data-a="due"', a.due, 'Due date')}<button type="button" class="btn ghost icon" onclick="this.parentNode.remove()" aria-label="Remove">${ic('x')}</button>
  <input type="hidden" data-a="id" value="${esc(a.id || '')}"><input type="hidden" data-a="done" value="${a.done ? '1' : ''}"><input type="hidden" data-a="doneOn" value="${esc(a.doneOn || '')}"></div>`;
function editOne(pid, oid) {
  const p = getP(pid), o = oid ? p.oneOnOnes.find(x => x.id === oid) : { date: today(), mode: 'Video call', actions: [] };
  const prev = !oid && lastOne(p), carry = prev ? (prev.actions || []).filter(a => !a.done) : [], g = o.grow || {};
  openModal({
    title: oid ? 'Edit 1:1' : 'Log 1:1', sub: esc(p.profile.name), size: 'xwide', saveText: oid ? 'Save changes' : 'Save 1:1',
    body: mtabs([
      ['Updates', `<div class="fgrid">${dfld('Date', 'date', o.date, { quick: 'past' })}${sel('Mode', 'mode', MODES, o.mode)}
        ${area('Their updates & wins', 'updates', o.updates, { ph: 'Progress on goals and projects, what went well' })}${area('Discussion notes', 'notes', o.notes, { rows: 4 })}</div>`],
      ['Coaching (GROW)', `${callout('info', '<b>GROW</b> keeps a coaching conversation focused: agree the <b>G</b>oal, explore the current <b>R</b>eality, generate <b>O</b>ptions, then commit to a <b>W</b>ay forward. Ask more than you tell.')}
        <div class="fgrid">${area('Goal — what do they want to achieve?', 'g_goal', g.goal, { rows: 2 })}${area('Reality — where are things now? What’s getting in the way?', 'g_reality', g.reality, { rows: 2 })}
        ${area('Options — what could they do?', 'g_options', g.options, { rows: 2 })}${area('Way forward — what will they do, and by when?', 'g_way', g.way, { rows: 2 })}</div>
        <div><button type="button" class="btn sm" onclick="growToAction()">${ic('plus', 14)}Add “way forward” as an action item</button></div>`],
      ['Concerns & career', `<div class="fgrid">${area('Concerns / blockers', 'concerns', o.concerns)}${area('Support needed from you', 'support', o.support)}${area('Career & growth discussion', 'career', o.career)}</div>`],
      ['Actions & wrap-up', `<div><div class="spread"><span class="sec-label" style="margin:0">Action items</span><button type="button" class="btn sm" onclick="$('#acts').insertAdjacentHTML('beforeend',actRow())">${ic('plus', 14)}Add action</button></div>
        ${carry.length ? `<div class="mt-s">${callout('info', `${plural(carry.length, 'open action')} from the last 1:1 ${carry.length === 1 ? 'is' : 'are'} carried forward below. Remove any that no longer apply.`)}</div>` : ''}
        <div id="acts" class="grid mt-s" style="gap:8px">${(oid ? o.actions || [] : carry.map(a => ({ ...a, id: '' }))).map(actRow).join('') || actRow()}</div></div>
        <div class="fgrid">${sel('Their morale / engagement', 'morale', MORALE.map((m, i) => [i || '', m]), o.morale)}${dfld('Next 1:1', 'next', o.next || (oid ? '' : addMonths(today(), 1)))}
        ${area('Private notes (observations, things to watch)', 'private', o.private, { rows: 2 })}</div>`],
    ]),
    onSave: (d, f) => {
      if (!d.date) { toast('Pick the meeting date', 'err'); return false; }
      const actions = $$('.act-row', f).map(r => { const v = k => r.querySelector(`[data-a=${k}]`).value.trim(); return { id: v('id') || uid(), text: v('text'), owner: v('owner'), due: v('due'), done: !!v('done'), doneOn: v('doneOn') }; }).filter(a => a.text);
      const grow = { goal: d.g_goal, reality: d.g_reality, options: d.g_options, way: d.g_way };
      ['g_goal', 'g_reality', 'g_options', 'g_way'].forEach(k => delete d[k]);
      const rec = { ...o, ...d, grow, actions, id: o.id || uid() };
      if (oid) p.oneOnOnes = p.oneOnOnes.map(x => x.id === oid ? rec : x);
      else {
        p.oneOnOnes.push(rec);
        if (prev) (prev.actions || []).forEach(a => { if (!a.done && actions.some(n => n.text === a.text)) { a.done = true; a.carried = true; a.doneOn = today(); } });
      }
      save(); toast('1:1 saved');
    },
  });
}
function growToAction() {
  const way = $('#mform [name=g_way]').value.trim();
  if (!way) return toast('Write the way forward first', 'err');
  $('#acts').insertAdjacentHTML('beforeend', actRow({ text: way.slice(0, 200), owner: 'them' }));
  toast('Added to action items');
}
function toggleAct(pid, oid, aid, v) {
  const a = getP(pid).oneOnOnes.find(x => x.id === oid)?.actions.find(x => x.id === aid); if (!a) return;
  a.done = v; a.doneOn = v ? today() : ''; save(); render();
}
function delOne(pid, oid) {
  confirmBox({ title: 'Delete this 1:1?', msg: 'Its notes and action items will be removed.', onYes: () => { const p = getP(pid); p.oneOnOnes = p.oneOnOnes.filter(x => x.id !== oid); closeDrawer(); save(); } });
}

/* ---------------- Action items ---------------- */
function secActions(p) {
  const f = V.pActF || 'open', t = today();
  const rows = p.oneOnOnes.flatMap(o => (o.actions || []).map(a => ({ ...a, o }))).filter(a => f === 'all' || !a.done).sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return sectionHead('Action items', 'Everything agreed in 1:1s with ' + esc(firstName(p.profile.name)) + '. Tick items off as they’re done.') +
    `<div class="card"><div class="spread" style="padding:12px 16px;border-bottom:1px solid var(--line)">${seg('pActF', [['open', 'Open'], ['all', 'All']], f)}</div>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:40px"></th><th>Action</th><th>Owner</th><th>Due</th><th>Agreed in</th></tr></thead><tbody>
    ${rows.map(a => `<tr><td><input type="checkbox" ${a.done ? 'checked' : ''} onchange="toggleAct('${p.id}','${a.o.id}','${a.id}',this.checked)" aria-label="Done"></td><td style="${a.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(a.text)}</td>
      <td>${a.owner === 'me' ? '<span class="badge b-acc">You</span>' : esc(firstName(p.profile.name))}</td><td>${a.due ? `<span class="${!a.done && a.due < t ? 'badge b-bad' : ''}">${fmt(a.due)}</span>` : '—'}</td>
      <td><a href="#" onclick="viewOne('${p.id}','${a.o.id}');return false">${fmt(a.o.date)}</a></td></tr>`).join('')}</tbody></table></div>`
    : emptyState('checkSq', f === 'open' ? 'No open action items' : 'No action items yet', 'Add actions while logging a 1:1.')}</div>`;
}

/* ---------------- Competencies ---------------- */
function secCompetencies(p) {
  const fw = FW();
  if (!fw) return sectionHead('Competencies') + card('', emptyState('grid', 'No competency framework loaded', 'Upload your organisation’s competency matrix to assess against grade expectations.', '<a class="btn primary" href="#/config/framework">Set up framework</a>'));
  const ck = V.compCycle || cycleOf().key, rec = p.comp[ck], grade = rec?.grade || p.grade || '', ng = nextGrade(grade);
  const mine = compStats(rec), self = compStats(rec, 'self');
  const groups = [...new Set(fw.comps.map(c => c.group))];
  const gv = V.compGroup && (groups.includes(V.compGroup) || V.compGroup === '__sum') ? V.compGroup : groups[0];
  const ro = [['', '—'], ...scale().map(s => [s.v, `${s.v} – ${s.label}`])];
  const head = sectionHead('Competencies', `Rated against the expectations for their grade in ${esc(fw.name)}.`,
    `<button class="btn" onclick="pickFiles('.xlsx,.xls',false,f=>importFilledMatrix('${p.id}',f,null,{cycle:'${ck}'}))">${ic('upload', 15)}Import filled matrix</button><button class="btn primary" onclick="exportCompXlsx('${p.id}','${ck}')">${ic('download', 15)}Download (org format)</button>`);
  const ctl = `<div class="card"><div class="card-body"><div class="spread"><div class="row">
      <select class="input" style="width:auto" onchange="V.compCycle=this.value;render()" aria-label="Cycle">${opts(cycleOpts(), ck)}</select>
      <select class="input" style="width:auto" onchange="setCompGrade('${p.id}','${ck}',this.value)" aria-label="Grade">${opts([['', 'Grade —'], ...fw.grades.map(g => [g, 'Grade ' + g])], grade)}</select></div>
      <div class="row"><span class="badge b-acc">Your avg ${mine.avg != null ? mine.avg.toFixed(2) : '—'}</span><span class="badge">Self avg ${self.avg != null ? self.avg.toFixed(2) : '—'}</span><span class="small muted">${mine.rated}/${fw.comps.length} rated</span></div></div>
      ${!grade ? `<div class="mt-s">${callout('warn', `Choose ${esc(firstName(p.profile.name))}’s grade to see what’s expected at their level.`)}</div>` : ''}</div></div>`;
  const tabs = `<div class="tabs mt">${groups.map(g => { const n = fw.comps.filter(c => c.group === g).filter(c => rec?.items?.[c.code]?.rating).length, tot = fw.comps.filter(c => c.group === g).length;
      return `<button class="tab ${gv === g ? 'on' : ''}" onclick="V.compGroup=${esc(JSON.stringify(g))};render()">${esc(g || 'Competencies')}<span class="count">${n}/${tot}</span></button>`; }).join('')}
      <button class="tab ${gv === '__sum' ? 'on' : ''}" onclick="V.compGroup='__sum';render()">Summary</button></div>`;
  if (gv === '__sum') return head + ctl + tabs + `<div class="card"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Competency</th><th>Group</th><th class="c">Self</th><th class="c">Yours</th><th>Comment</th></tr></thead><tbody>
    ${fw.comps.map(c => { const it = rec?.items?.[c.code] || {}; return `<tr><td><b>${esc(c.code)}</b> · ${esc(c.name)}</td><td class="small muted">${esc(c.group)}</td><td class="c">${ratingChip(it.self)}</td><td class="c">${ratingChip(it.rating)}</td><td class="small">${esc(it.comment || '')}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  const g = fw.groups.find(x => x.name === gv);
  return head + ctl + tabs + `<div class="card">${g?.note ? `<div class="card-body" style="border-bottom:1px solid var(--line)">${callout('info', esc(g.note))}</div>` : ''}
    ${fw.comps.filter(c => c.group === gv).map(c => { const it = rec?.items?.[c.code] || {}, exp = grade ? c.desc[grade] : '';
      return `<div class="comp-row"><div><h4>${esc(c.code)} · ${esc(c.name)}</h4>
        ${grade ? `<div class="exp"><b>Expected at grade ${esc(grade)}</b>${exp ? esc(exp) : '<span class="muted">No expectation defined at this grade.</span>'}</div>` : ''}
        ${ng && c.desc[ng] ? `<details class="mt-s"><summary>Next grade (${esc(ng)})</summary><div class="small" style="margin-top:4px">${esc(c.desc[ng])}</div></details>` : ''}
        ${it.selfComment ? `<div class="small mt-s"><span class="badge">Their comment</span> ${esc(it.selfComment)}</div>` : ''}</div>
      <div class="comp-ctl"><label>Self rating<select onchange="setComp('${p.id}','${ck}','${c.code}','self',this.value)">${opts(ro, it.self)}</select></label>
        <label>Your rating<select style="${it.rating ? ratingStyle(it.rating) : ''}" onchange="setComp('${p.id}','${ck}','${c.code}','rating',this.value)">${opts(ro, it.rating)}</select></label>
        <label>Evidence / comments<textarea rows="2" onchange="setComp('${p.id}','${ck}','${c.code}','comment',this.value)">${esc(it.comment || '')}</textarea></label>
        <label>Initials<input value="${esc(it.by || '')}" onchange="setComp('${p.id}','${ck}','${c.code}','by',this.value)"></label></div></div>`; }).join('')}</div>`;
}
function setComp(pid, ck, code, f, v) {
  const p = getP(pid), rec = ensureComp(p, ck), it = rec.items[code] = { ...(rec.items[code] || {}), [f]: v };
  if (f === 'rating' && v && !it.by && S.settings.managerName) it.by = initials(S.settings.managerName);
  rec.updated = today(); save();
  if (f === 'rating' || f === 'self') render();
}
function setCompGrade(pid, ck, g) { const p = getP(pid); ensureComp(p, ck).grade = g; if (!p.grade || ck === cycleOf().key) p.grade = g; save(); render(); }

/* ---------------- Technical skills ---------------- */
function secSkills(p) {
  const r = roleOf(p), cats = [...new Set(S.skills.map(s => s.cat))], lv = SKILL_LEVELS.map((l, i) => [i, l]);
  return sectionHead('Technical skills', `Tools and technologies, rated 1–5.${r ? ` Targets default from the role “${esc(r.name)}”.` : ''}`, `<a class="btn" href="#/config/skills">${ic('edit', 15)}Edit skill list</a>`) +
    `<div class="card"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Skill</th><th>Self</th><th>Yours</th><th>Target</th><th>Gap</th><th>Evidence</th></tr></thead><tbody>
    ${cats.map(cat => `<tr><td colspan="6" style="background:var(--panel-2);font-weight:600;font-size:12.5px">${esc(cat)}</td></tr>` + S.skills.filter(s => s.cat === cat).map(s => {
      const x = p.skills[s.id] || {}, tg = effTarget(p, s.id), gap = tg ? tg - (+x.current || 0) : null, rt = r?.skillTargets?.[s.id];
      return `<tr><td>${esc(s.name)}</td><td><select onchange="setSkill('${p.id}','${s.id}','self',this.value)">${opts(lv, x.self || 0)}</select></td>
        <td><select onchange="setSkill('${p.id}','${s.id}','current',this.value)">${opts(lv, x.current || 0)}</select></td>
        <td><select onchange="setSkill('${p.id}','${s.id}','target',this.value)">${opts(lv.map(([i, l]) => [i, i === 0 ? (rt ? `Role default (${rt})` : 'Not set') : l]), x.target || 0)}</select></td>
        <td>${gap === null ? '<span class="muted">—</span>' : gap <= 0 ? '<span class="badge b-good">At target</span>' : `<span class="badge ${gap >= 2 ? 'b-bad' : 'b-warn'}">−${gap}</span>`}</td>
        <td><input style="width:100%;min-width:150px" value="${esc(x.note || '')}" placeholder="Evidence…" onchange="setSkill('${p.id}','${s.id}','note',this.value)"></td></tr>`; }).join('')).join('')}</tbody></table></div></div>`;
}
function setSkill(pid, sid, k, v) { const p = getP(pid); p.skills[sid] = { ...(p.skills[sid] || {}), [k]: k === 'note' ? v : +v, updated: today() }; save(); if (k !== 'note') render(); }

/* ---------------- KPIs ---------------- */
function secKpis(p) {
  const r = roleOf(p), head = sectionHead('KPIs', 'Numeric targets set for their role, rated each half-year.');
  if (!r) return head + card('', emptyState('bars', 'No role assigned', `Assign a role to ${esc(firstName(p.profile.name))} to track numeric KPIs. Behavioural expectations live under Competencies.`, `<button class="btn primary" onclick="editProfile('${p.id}')">Assign role</button> <a class="btn" href="#/config/roles">Set up roles</a>`));
  if (!r.kpis.length) return head + card('', emptyState('bars', `No KPIs for “${esc(r.name)}” yet`, 'Upload the KPI sheet for this role when you receive it.', `<button class="btn primary" onclick="uploadKpis('${r.id}')">${ic('upload', 15)}Upload KPI file</button> <a class="btn" href="#/config/roles/${r.id}">Add manually</a>`));
  const ck = V.kpiCycle || cycleOf().key, kc = p.kpi[ck] || {}, sc = kpiScore(p, ck);
  return head + `<div class="card"><div class="card-head"><div class="row"><select class="input" style="width:auto" onchange="V.kpiCycle=this.value;render()">${opts(cycleOpts(), ck)}</select></div>${sc != null ? `<span class="badge b-acc">Weighted score ${sc.toFixed(2)} / 5</span>` : ''}</div>
    <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>KPI · ${esc(r.name)}</th><th>Target</th><th>Weight</th><th>Actual</th><th>Rating</th><th>Comment</th></tr></thead><tbody>
    ${r.kpis.map(k => { const x = kc[k.id] || {}; return `<tr><td><b>${esc(k.name)}</b>${k.desc ? `<div class="sub">${esc(k.desc)}</div>` : ''}</td><td>${esc(k.target || '—')} ${esc(k.unit || '')}</td><td>${k.weight ? esc(k.weight) + '%' : '—'}</td>
      <td><input style="width:90px" value="${esc(x.actual || '')}" onchange="setKpi('${p.id}','${ck}','${k.id}','actual',this.value)"></td>
      <td><select onchange="setKpi('${p.id}','${ck}','${k.id}','rating',this.value)">${opts([['', '—'], ...Object.entries(RATING)], x.rating)}</select></td>
      <td><input style="width:100%;min-width:150px" value="${esc(x.comment || '')}" onchange="setKpi('${p.id}','${ck}','${k.id}','comment',this.value)"></td></tr>`; }).join('')}</tbody></table></div></div>`;
}
function setKpi(pid, ck, kid, f, v) { const p = getP(pid); p.kpi[ck] = p.kpi[ck] || {}; p.kpi[ck][kid] = { ...(p.kpi[ck][kid] || {}), [f]: v }; save(); if (f === 'rating') render(); }

/* ---------------- Talent & retention ---------------- */
function secTalent(p) {
  const tab = V.talentTab || 'placement', n = p.ninebox, t = p.talent, nb = nineOf(p);
  const head = sectionHead('Talent & retention', 'Placement on the 9-box, flight risk, career readiness and stay conversations.') +
    `<div class="mb">${seg('talentTab', [['placement', 'Placement & risk'], ['career', 'Career & succession'], ['stay', `Stay conversations (${p.stay.length})`]], tab)}</div>`;
  if (tab === 'career') {
    const ck = latestCompCycle(p), rec = ck ? p.comp[ck] : null, it = rec?.items || {};
    const above = FW() ? FW().comps.filter(c => numVal(it[c.code]?.rating) !== null && numVal(it[c.code].rating) >= highV()) : [];
    const below = FW() ? FW().comps.filter(c => numVal(it[c.code]?.rating) !== null && numVal(it[c.code].rating) <= lowV()) : [];
    const ng = nextGrade(p.grade);
    return head + `<div class="grid g2">${card('Career readiness', `<form id="tlform" class="fgrid" onchange="saveTalent('${p.id}')">
        ${sel('Readiness for next move', 'readiness', READINESS.map(r => [r, r || '—']), t.readiness)}${fld('Target role / next grade', 'targetRole', t.targetRole, { ph: ng ? `e.g. Grade ${ng}` : '' })}
        ${chk('Key person — hard to replace in their current role', 'keyPerson', t.keyPerson, { cls: 'full' })}${area('Notes / plan to get ready', 'careerNotes', t.careerNotes, { rows: 3 })}</form>`, { sub: 'Saved automatically' })}
      ${card('Evidence from competencies', ck ? `<dl class="kv"><dt>Assessed</dt><dd>${esc(cycleByKey(ck).short)} · grade ${esc(rec.grade || '—')}</dd><dt>Working above grade</dt><dd>${above.length ? esc(above.map(c => c.name).join(', ')) : '—'}</dd>
        <dt>Below grade</dt><dd>${below.length ? esc(below.map(c => c.name).join(', ')) : '—'}</dd><dt>Next grade</dt><dd>${ng ? `Grade ${esc(ng)} — <a href="#/config/framework/expectations" onclick="V.fwGrade='${esc(p.grade)}';V.fwGrade2='${esc(ng)}'">compare expectations</a>` : '—'}</dd></dl>`
        : `<div class="muted">No competency assessment yet. <a href="${personHref(p.id, 'competencies')}">Assess now</a></div>`)}</div>`;
  }
  if (tab === 'stay') {
    const rows = [...p.stay].sort((a, b) => b.date.localeCompare(a.date));
    return head + `<div class="card"><div class="card-head"><div><h2>Stay conversations</h2><p>Structured check-ins to understand what keeps ${esc(firstName(p.profile.name))} engaged — hold one whenever flight risk is medium or high.</p></div><button class="btn primary" onclick="editStay('${p.id}')">${ic('plus', 15)}New conversation</button></div>
      ${rows.length ? `<div class="card-body flush"><table class="tbl"><thead><tr><th>Date</th><th>What might tempt them to leave</th><th>Agreed actions</th></tr></thead><tbody>${rows.map(s => `<tr class="click" onclick="editStay('${p.id}','${s.id}')"><td class="nowrap"><b>${fmt(s.date)}</b></td><td class="small">${esc(s.answers?.leave || '—')}</td><td class="small">${esc(s.actions || '—')}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="card-body">${emptyState('heart', 'No stay conversations yet', 'Five proven questions help you learn what would make them stay — before they think about leaving.')}</div>`}</div>`;
  }
  const cell = (perf, pot) => { const [nm] = NINE[`${perf}-${pot}`]; return `<div class="cell ${+n.perf === perf && +n.pot === pot ? 'hl' : ''}" style="min-height:58px;padding:8px"><h4 style="font-size:12px">${nm}</h4></div>`; };
  return head + `<div class="grid g2">${card('Placement & flight risk', `<form id="nbform" class="fgrid" onchange="saveNine('${p.id}')">
      ${sel('Performance', 'perf', [['', '—'], ['1', 'Low'], ['2', 'Moderate'], ['3', 'High']], n.perf)}${sel('Potential', 'pot', [['', '—'], ['1', 'Low'], ['2', 'Moderate'], ['3', 'High']], n.pot)}
      ${sel('Flight risk', 'risk', [['', '—'], 'Low', 'Medium', 'High'], n.risk)}${fld('Main risk factor', 'riskReason', n.riskReason, { ph: 'e.g. compensation, growth, manager, workload' })}
      ${area('Retention actions', 'retention', n.retention, { rows: 2 })}</form>${nb ? `<div class="mt">${callout('info', `<b>${esc(nb.name)}</b> — ${esc(nb.action)}`)}</div>` : ''}`, { sub: 'Saved automatically · visible only to you' })}
    ${card('Position on the 9-box', `<div class="nine" style="grid-template-rows:repeat(3,auto) 22px"><div class="axis y" style="grid-row:1/4">Potential →</div>${[3, 2, 1].map(pot => [1, 2, 3].map(perf => cell(perf, pot)).join('')).join('')}<div></div><div class="axis" style="grid-column:2/5">Performance →</div></div>`)}</div>`;
}
function saveNine(id) { const p = getP(id); p.ninebox = { ...p.ninebox, ...formObj($('#nbform')), updated: today() }; save(); render(); }
function saveTalent(id) { const p = getP(id); p.talent = { ...p.talent, ...formObj($('#tlform')), updated: today() }; save(); }
function editStay(pid, sid) {
  const p = getP(pid), s = sid ? p.stay.find(x => x.id === sid) : { date: today(), answers: {} };
  openModal({ title: sid ? 'Stay conversation' : 'New stay conversation', sub: esc(p.profile.name), size: 'wide', saveText: 'Save', footLeft: sid ? `<button type="button" class="btn danger" onclick="delStay('${pid}','${sid}')">Delete</button>` : '',
    body: `${callout('info', 'Ask each question openly and listen more than you talk. Capture their words, then agree one or two concrete actions.')}<div class="fgrid">${dfld('Date', 'date', s.date, { quick: 'past' })}<span></span>
      ${STAY_QUESTIONS.map(([k, q]) => area(q, 'q_' + k, s.answers?.[k], { rows: 2 })).join('')}${area('Agreed actions', 'actions', s.actions, { rows: 2 })}</div>`,
    onSave: d => { const answers = {}; STAY_QUESTIONS.forEach(([k]) => { answers[k] = d['q_' + k]; });
      const rec = { id: s.id || uid(), date: d.date || today(), answers, actions: d.actions };
      if (sid) Object.assign(s, rec); else p.stay.push(rec); save(); } });
}
function delStay(pid, sid) { const p = getP(pid); p.stay = p.stay.filter(x => x.id !== sid); save(); closeModal(); render(); }

/* ---------------- Goals ---------------- */
function secGoals(p) {
  const ck = V.goalCycle || cycleOf().key, gs = p.goals.filter(g => goalCycle(g) === ck), sc = goalScore(p, ck);
  const tw = gs.filter(g => g.status !== 'Dropped').reduce((s, g) => s + (+g.weight || 0), 0);
  return sectionHead('Goals', 'Grouped by review cycle so they flow straight into the half-yearly review.', `<button class="btn primary" onclick="editGoal('${p.id}')">${ic('plus', 15)}Add goal</button>`) +
    `<div class="card"><div class="card-head"><select class="input" style="width:auto" onchange="V.goalCycle=this.value;render()">${opts(cycleOpts(), ck)}</select>
      <div class="row">${sc != null ? `<span class="badge b-acc">Weighted completion ${pct(sc)}</span>` : ''}${tw && tw !== 100 ? `<span class="badge b-warn">Weights total ${tw}%</span>` : ''}</div></div>
    ${gs.length ? `<div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Goal</th><th>Weight</th><th>Due</th><th style="width:170px">Progress</th><th>Status</th></tr></thead><tbody>
      ${gs.map(g => `<tr class="click" onclick="editGoal('${p.id}','${g.id}')"><td><b>${esc(g.title)}</b><div class="sub">${esc([g.category, g.metric && 'Measure: ' + g.metric].filter(Boolean).join(' · '))}</div></td>
        <td>${g.weight ? esc(g.weight) + '%' : '—'}</td><td class="nowrap">${g.due ? `<span class="${!['Done', 'Dropped'].includes(g.status) && g.due < today() ? 'badge b-bad' : ''}">${fmt(g.due)}</span>` : '—'}</td>
        <td><div class="row" style="flex-wrap:nowrap">${progress(g.progress, g.status === 'Off track' ? 'bad' : g.status === 'At risk' ? 'warn' : '')}<span class="small">${+g.progress || 0}%</span></div></td><td>${statusBadge(g.status)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card-body">${emptyState('target', 'No goals for this cycle', 'Agree 3–5 goals with clear success measures early in the cycle.', `<button class="btn primary" onclick="editGoal('${p.id}')">Add goal</button>`)}</div>`}</div>`;
}
function editGoal(pid, gid) {
  const p = getP(pid), g = gid ? p.goals.find(x => x.id === gid) : { status: 'On track', progress: 0, category: 'Business', cycle: V.goalCycle || cycleOf().key, start: today() };
  openModal({ title: gid ? 'Update goal' : 'Add goal', sub: esc(p.profile.name), size: 'wide', saveText: gid ? 'Save changes' : 'Add goal',
    footLeft: gid ? `<button type="button" class="btn danger" onclick="delGoal('${pid}','${gid}')">Delete</button>` : '',
    body: mtabs([
      ['Goal', `<div class="fgrid">${fld('Goal / objective', 'title', g.title, { req: true, cls: 'full' })}${area('Description / key results', 'desc', g.desc)}
        ${fld('Success measure', 'metric', g.metric, { ph: 'How will you both know it’s achieved?' })}${sel('Category', 'category', GOAL_CATS, g.category)}
        ${sel('Review cycle', 'cycle', cycleOpts(), goalCycle(g))}${fld('Weight (%)', 'weight', g.weight, { type: 'number', attrs: 'min="0" max="100"' })}
        ${dfld('Start date', 'start', g.start)}${dfld('Due date', 'due', g.due)}</div>`],
      ['Progress', `<div class="fgrid">${sel('Status', 'status', GOAL_STATUS, g.status)}${fld('Progress (%)', 'progress', g.progress, { type: 'number', attrs: 'min="0" max="100"' })}
        ${gid ? area('Progress note (added to history)', 'upd', '', { rows: 2 }) : ''}</div>
        ${(g.updates || []).length ? `<div><div class="sec-label">History</div>${g.updates.slice().reverse().map(u => `<div class="list-row small"><b class="nowrap">${fmt(u.date)}</b><span>${esc(u.text)}</span></div>`).join('')}</div>` : ''}`],
    ]),
    onSave: d => {
      if (!d.title) { toast('Goal title is required', 'err'); return false; }
      const { upd, ...rest } = d; rest.progress = clamp(+rest.progress || 0, 0, 100); if (rest.status === 'Done') rest.progress = 100;
      if (gid) { Object.assign(g, rest); if (upd) (g.updates = g.updates || []).push({ date: today(), text: upd }); } else p.goals.push({ id: uid(), ...rest, updates: [] });
      save();
    } });
}
function delGoal(pid, gid) { closeModal(); confirmBox({ title: 'Delete goal?', msg: 'This cannot be undone.', onYes: () => { const p = getP(pid); p.goals = p.goals.filter(x => x.id !== gid); save(); } }); }

/* ---------------- Development plan ---------------- */
function secIdp(p) {
  const ck = latestCompCycle(p), it = ck ? p.comp[ck].items : {};
  const cg = (FW()?.comps || []).filter(c => numVal(it[c.code]?.rating) !== null && numVal(it[c.code].rating) <= lowV() && !p.idp.some(i => i.skillId === 'c:' + c.code && i.status !== 'Done'));
  const sg = S.skills.filter(s => effTarget(p, s.id) > (+p.skills[s.id]?.current || 0) && !p.idp.some(i => i.skillId === s.id && i.status !== 'Done'));
  const rows = [...p.idp].sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  return sectionHead('Development plan', 'Concrete growth actions, linked to competencies and skills so progress on gaps is visible.', `<button class="btn primary" onclick="editIdp('${p.id}')">${ic('plus', 15)}Add item</button>`) +
    (cg.length || sg.length ? `<div class="mb">${callout('warn', `Gaps without a development action: <b>${esc([...cg.map(c => c.name), ...sg.map(s => s.name)].join(', '))}</b>`)}</div>` : '') +
    `<div class="card">${rows.length ? `<div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Development action</th><th>Type</th><th>Linked to</th><th>Target date</th><th>Status</th></tr></thead><tbody>
      ${rows.map(i => `<tr><td class="click" onclick="editIdp('${p.id}','${i.id}')"><b>${esc(i.title)}</b>${i.notes ? `<div class="sub">${esc(i.notes)}</div>` : ''}</td><td>${esc(i.type)}</td><td class="small">${esc(linkName(i.skillId))}</td>
        <td class="nowrap">${i.due ? `<span class="${!['Done', 'Deferred'].includes(i.status) && i.due < today() ? 'badge b-bad' : ''}">${fmt(i.due)}</span>` : '—'}</td>
        <td><select onchange="setIdp('${p.id}','${i.id}',this.value)">${opts(IDP_STATUS, i.status)}</select></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card-body">${emptyState('trend', 'No development items yet', 'Agree one or two growth actions — a course, a stretch assignment, mentoring.')}</div>`}</div>`;
}
function editIdp(pid, iid) {
  const p = getP(pid), i = iid ? p.idp.find(x => x.id === iid) : { type: IDP_TYPES[0], status: 'Planned' };
  openModal({ title: iid ? 'Edit development item' : 'Add development item', sub: esc(p.profile.name), footLeft: iid ? `<button type="button" class="btn danger" onclick="delIdp('${pid}','${iid}')">Delete</button>` : '',
    body: `<div class="fgrid">${fld('Development action', 'title', i.title, { req: true, cls: 'full' })}${sel('Type', 'type', IDP_TYPES, i.type)}${sel('Linked competency / skill', 'skillId', linkOpts(), i.skillId)}
      ${dfld('Target date', 'due', i.due)}${sel('Status', 'status', IDP_STATUS, i.status)}${area('Notes / resources', 'notes', i.notes, { rows: 2 })}</div>`,
    onSave: d => { if (!d.title) { toast('Describe the action', 'err'); return false; } if (iid) Object.assign(i, d); else p.idp.push({ id: uid(), ...d, created: today() }); save(); } });
}
function setIdp(pid, iid, v) { const i = getP(pid).idp.find(x => x.id === iid); i.status = v; if (v === 'Done') i.doneOn = today(); save(); render(); }
function delIdp(pid, iid) { const p = getP(pid); p.idp = p.idp.filter(x => x.id !== iid); save(); closeModal(); render(); }

/* ---------------- Strengths & development areas ---------------- */
function secStrengths(p) {
  const lst = (k, title, hint) => card(title, p[k].length ? p[k].map(x => `<div class="list-row"><div class="grow">${esc(x.text)}<div class="xs muted">${esc(x.source || 'Manager')} · ${fmt(x.date)}</div></div><button class="btn ghost icon sm" onclick="delNote('${p.id}','${k}','${x.id}')" aria-label="Remove">${ic('x', 14)}</button></div>`).join('') : `<div class="muted small">${hint}</div>`,
    { actions: `<button class="btn sm" onclick="addNote('${p.id}','${k}')">${ic('plus', 14)}Add</button>` });
  return sectionHead('Strengths & development areas', 'Observed by you, or extracted from uploaded self-assessments and feedback.') +
    `<div class="grid g2">${lst('strengths', 'Strengths', 'Nothing recorded yet.')}${lst('devAreas', 'Development areas', 'Nothing recorded yet.')}</div>`;
}
function addNote(id, k) {
  openModal({ title: k === 'strengths' ? 'Add strength' : 'Add development area', body: area('Description', 'text', '', { cls: '' }) + sel('Source', 'source', FB_SOURCES, 'Manager'),
    onSave: d => { if (!d.text) return false; getP(id)[k].push({ id: uid(), text: d.text, source: d.source, date: today() }); save(); } });
}
function delNote(id, k, nid) { const p = getP(id); p[k] = p[k].filter(x => x.id !== nid); save(); render(); }

/* ---------------- Feedback log (SBI) ---------------- */
function secFeedback(p) {
  const f = V.fbFilter || '', items = [...p.feedback].filter(x => !f || x.type === f).sort((a, b) => b.date.localeCompare(a.date));
  const cls = { Achievement: 'b-good', Kudos: 'b-good', Constructive: 'b-warn', Concern: 'b-bad' };
  return sectionHead('Feedback log', 'Capture wins and concerns as they happen, using Situation – Behaviour – Impact so feedback is specific.', `<button class="btn primary" onclick="editFb('${p.id}')">${ic('plus', 15)}Add entry</button>`) +
    `<div class="card"><div class="card-head">${seg('fbFilter', [['', 'All'], ...FB_TYPES.map(t => [t, t])], f)}<span class="small muted">${plural(items.length, 'entry', 'entries')}</span></div><div class="card-body">
    ${items.length ? items.map(x => `<div class="list-row"><div class="grow"><div class="row"><span class="badge ${cls[x.type] || ''}">${esc(x.type)}</span><span class="small muted">${fmt(x.date)} · ${esc(x.source)}${x.from ? ' – ' + esc(x.from) : ''}</span>${x.sbi?.behaviour ? '<span class="badge b-acc">SBI</span>' : ''}</div>
      ${x.sbi && (x.sbi.situation || x.sbi.behaviour || x.sbi.impact) ? `<div class="small mt-s"><b>Situation:</b> ${esc(x.sbi.situation || '—')}<br><b>Behaviour:</b> ${esc(x.sbi.behaviour || '—')}<br><b>Impact:</b> ${esc(x.sbi.impact || '—')}${x.sbi.next ? `<br><b>Next step:</b> ${esc(x.sbi.next)}` : ''}</div>` : `<div class="pre mt-s">${esc(x.text)}</div>`}</div>
      <button class="btn ghost sm" onclick="editFb('${p.id}','${x.id}')">Edit</button></div>`).join('') : emptyState('heart', 'No entries', 'Logging feedback as it happens makes reviews fair and fast.')}</div></div>`;
}
function editFb(pid, fid) {
  const p = getP(pid), x = fid ? p.feedback.find(y => y.id === fid) : { date: today(), type: 'Achievement', source: 'Manager', sbi: {} }, s = x.sbi || {};
  const useSbi = fid ? !!(s.situation || s.behaviour || s.impact) : true;
  openModal({ title: fid ? 'Edit feedback' : 'Add feedback or achievement', sub: esc(p.profile.name), size: 'wide', footLeft: fid ? `<button type="button" class="btn danger" onclick="delFb('${pid}','${fid}')">Delete</button>` : '',
    body: `<div class="fgrid">${dfld('Date', 'date', x.date, { quick: 'past' })}${sel('Type', 'type', FB_TYPES, x.type)}${sel('Source', 'source', FB_SOURCES, x.source)}${fld('From (name)', 'from', x.from, { opt: true })}</div>
      <div class="seg" style="align-self:flex-start"><button type="button" class="${useSbi ? 'on' : ''}" onclick="fbMode(this,true)">Structured (SBI)</button><button type="button" class="${useSbi ? '' : 'on'}" onclick="fbMode(this,false)">Free text</button></div>
      <div id="fb-sbi" class="fgrid" ${useSbi ? '' : 'hidden'}>${area('Situation — when and where?', 's_situation', s.situation, { rows: 2, ph: 'e.g. In Tuesday’s client demo…' })}${area('Behaviour — what exactly did they do or say?', 's_behaviour', s.behaviour, { rows: 2, ph: 'Observable actions, not personality' })}
        ${area('Impact — what was the effect?', 's_impact', s.impact, { rows: 2, ph: 'On the client, the team, the outcome' })}${area('Next step / request', 's_next', s.next, { rows: 2, opt: true })}</div>
      <div id="fb-free" ${useSbi ? 'hidden' : ''}>${area('Details', 'text', useSbi ? '' : x.text, { rows: 5 })}</div><input type="hidden" name="mode" value="${useSbi ? 'sbi' : 'free'}">`,
    onSave: d => {
      const sbi = { situation: d.s_situation, behaviour: d.s_behaviour, impact: d.s_impact, next: d.s_next };
      const text = d.mode === 'sbi' ? [sbi.situation && `Situation: ${sbi.situation}`, sbi.behaviour && `Behaviour: ${sbi.behaviour}`, sbi.impact && `Impact: ${sbi.impact}`, sbi.next && `Next: ${sbi.next}`].filter(Boolean).join('\n') : d.text;
      if (!text) { toast('Add some detail', 'err'); return false; }
      const rec = { date: d.date || today(), type: d.type, source: d.source, from: d.from, text, sbi: d.mode === 'sbi' ? sbi : null };
      if (fid) Object.assign(x, rec); else p.feedback.push({ id: uid(), ...rec }); save();
    } });
}
function fbMode(btn, sbi) { $$('button', btn.parentNode).forEach(b => b.classList.toggle('on', b === btn)); $('#fb-sbi').hidden = !sbi; $('#fb-free').hidden = sbi; $('#mform [name=mode]').value = sbi ? 'sbi' : 'free'; }
function delFb(pid, fid) { const p = getP(pid); p.feedback = p.feedback.filter(x => x.id !== fid); save(); closeModal(); render(); }

/* ---------------- Improvement plan ---------------- */
function secPip(p) {
  const pip = activePip(p), past = p.pips.filter(x => x !== pip);
  const head = sectionHead('Improvement plan', 'A fair, documented plan when performance is below expectations: clear expectations, support, regular check-ins and a recorded outcome.');
  const hist = past.length ? card('Previous plans', `<table class="tbl"><tbody>${past.map(x => `<tr class="click" onclick="V.pipView='${x.id}';render()"><td>${fmt(x.start)} – ${fmt(x.end)}</td><td>${statusBadge(x.status)}</td><td class="small muted">${esc(x.outcome || '')}</td></tr>`).join('')}</tbody></table>`, { cls: 'mt', flush: true }) : '';
  const show = V.pipView ? p.pips.find(x => x.id === V.pipView) || pip : pip;
  if (!show) return head + card('', emptyState('clipboard', 'No active improvement plan', 'Use this only after expectations have been discussed in 1:1s. Check your organisation’s HR policy and keep HR informed.', `<button class="btn primary" onclick="editPip('${p.id}')">Start improvement plan</button>`)) + hist;
  const days = show.end ? daysBetween(today(), show.end) : null;
  const ci = [...(show.checkins || [])].sort((a, b) => b.date.localeCompare(a.date));
  return head + `${show !== pip ? `<div class="mb">${callout('info', `Viewing a past plan. <a href="#" onclick="V.pipView=null;render();return false">Back</a>`)}</div>` : ''}
    <div class="card"><div class="card-head"><div><h2>${fmt(show.start)} – ${fmt(show.end)}</h2><p>${esc(show.reason || '')}</p></div><div class="row">${statusBadge(show.status)}${days != null && show === pip ? `<span class="badge ${days < 0 ? 'b-bad' : ''}">${days < 0 ? 'ended ' + -days + ' days ago' : days + ' days left'}</span>` : ''}
      <button class="btn sm" onclick="editPip('${p.id}','${show.id}')">${ic('edit', 14)}Edit plan</button></div></div>
    <div class="card-body flush"><table class="tbl"><thead><tr><th>Expectation</th><th>How it’s measured</th><th>Status</th></tr></thead><tbody>
      ${(show.items || []).map(it => `<tr><td>${esc(it.text)}</td><td class="small">${esc(it.measure || '—')}</td><td><select onchange="setPipItem('${p.id}','${show.id}','${it.id}',this.value)">${opts(PIP_ITEM_STATUS, it.status)}</select></td></tr>`).join('') || '<tr><td colspan="3" class="muted">No expectations listed.</td></tr>'}</tbody></table></div>
    ${show.support ? `<div class="card-body" style="border-top:1px solid var(--line)"><div class="sec-label">Support provided</div><div class="pre">${esc(show.support)}</div></div>` : ''}</div>
    <div class="card mt"><div class="card-head"><h2>Check-ins</h2><button class="btn sm primary" onclick="addPipCheckin('${p.id}','${show.id}')">${ic('plus', 14)}Add check-in</button></div><div class="card-body">
      ${ci.length ? ci.map(x => `<div class="list-row"><b class="nowrap">${fmt(x.date)}</b><div class="grow">${statusBadge(x.progress)}<div class="pre small mt-s">${esc(x.notes)}</div></div></div>`).join('') : '<div class="muted small">No check-ins yet — aim for at least one every two weeks.</div>'}</div></div>
    ${show.outcome ? `<div class="card mt card-body"><div class="sec-label">Outcome</div><div class="pre">${esc(show.outcome)}</div></div>` : ''}${hist}`;
}
function editPip(pid, xid) {
  const p = getP(pid), x = xid ? p.pips.find(y => y.id === xid) : { start: today(), end: addDays(today(), 60), status: 'Active', items: [] };
  const itemRow = (it = {}) => `<div class="act-row" style="grid-template-columns:1fr 1fr 34px"><input class="input" data-p="text" placeholder="Expectation" value="${esc(it.text || '')}"><input class="input" data-p="measure" placeholder="How it will be measured" value="${esc(it.measure || '')}"><button type="button" class="btn ghost icon" onclick="this.parentNode.remove()">${ic('x')}</button><input type="hidden" data-p="id" value="${esc(it.id || '')}"><input type="hidden" data-p="status" value="${esc(it.status || 'Not yet met')}"></div>`;
  window._pipRow = itemRow;
  openModal({ title: xid ? 'Edit improvement plan' : 'Start improvement plan', sub: esc(p.profile.name), size: 'wide', saveText: 'Save plan',
    body: mtabs([
      ['Plan', `<div class="fgrid">${dfld('Start date', 'start', x.start)}${dfld('Review / end date', 'end', x.end)}${area('Why this plan is needed', 'reason', x.reason, { rows: 2 })}${area('Support you will provide', 'support', x.support, { rows: 2, ph: 'Coaching, training, buddy, adjusted workload…' })}</div>`],
      ['Expectations', `<div class="spread"><span class="small muted">Specific, measurable expectations for the plan period.</span><button type="button" class="btn sm" onclick="$('#pip-items').insertAdjacentHTML('beforeend',_pipRow())">${ic('plus', 14)}Add</button></div><div id="pip-items" class="grid" style="gap:8px">${(x.items.length ? x.items : [{}]).map(itemRow).join('')}</div>`],
      ['Outcome', `<div class="fgrid">${sel('Status', 'status', PIP_STATUS, x.status)}<span></span>${area('Outcome notes', 'outcome', x.outcome, { rows: 3 })}</div>`],
    ]),
    onSave: (d, f) => {
      const items = $$('#pip-items .act-row', f).map(r => { const v = k => r.querySelector(`[data-p=${k}]`).value.trim(); return { id: v('id') || uid(), text: v('text'), measure: v('measure'), status: v('status') }; }).filter(i => i.text);
      const rec = { ...x, ...d, items, id: x.id || uid(), checkins: x.checkins || [] };
      if (xid) Object.assign(x, rec); else { if (activePip(p)) { toast('Close the current plan first', 'err'); return false; } p.pips.push(rec); }
      V.pipView = null; save();
    } });
}
function setPipItem(pid, xid, iid, v) { const it = getP(pid).pips.find(x => x.id === xid).items.find(i => i.id === iid); it.status = v; save(); }
function addPipCheckin(pid, xid) {
  openModal({ title: 'Improvement plan check-in', body: `<div class="fgrid">${dfld('Date', 'date', today(), { quick: 'past' })}${sel('Overall progress', 'progress', ['On track', 'At risk', 'Off track'], 'On track')}${area('Notes — evidence discussed, support given, next steps', 'notes', '', { rows: 4 })}</div>`,
    onSave: d => { getP(pid).pips.find(x => x.id === xid).checkins.push({ id: uid(), ...d }); save(); } });
}

/* ---------------- Profile ---------------- */
function secProfile(p) {
  const pr = p.profile, r = roleOf(p);
  const kv = rows => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || '—')}</dd>`).join('')}</dl>`;
  return sectionHead('Profile', '', `<button class="btn" onclick="editProfile('${p.id}')">${ic('edit', 15)}Edit profile</button>`) +
    `<div class="grid g2">${card('Employment', kv([['Employee ID', pr.empId], ['Designation', pr.designation], ['Grade', p.grade], ['Role', r?.name], ['Band', pr.band], ['Team / project', pr.team], ['Date of joining', pr.doj && fmt(pr.doj)], ['Reporting to you since', pr.since && fmt(pr.since)], ['Last promotion', pr.lastPromo && fmt(pr.lastPromo)], ['Work mode', pr.workMode], ['Location', pr.location]]))}
    <div class="grid" style="align-content:start">${card('Contact', kv([['Email', pr.email], ['Phone', pr.phone]]))}${card('Background & aspirations', kv([['Experience', pr.exp && pr.exp + ' years'], ['Education', pr.education], ['Certifications', pr.certs], ['Responsibilities', pr.projects], ['Aspirations', pr.aspirations], ['Personal context', pr.personal]]))}</div></div>
    ${card('Record', `<div class="row"><button class="btn" onclick="toggleArchive('${p.id}')">${ic('archive', 15)}${p.archived ? 'Restore to active team' : 'Archive (moved out of team)'}</button><button class="btn danger" onclick="delPerson('${p.id}')">${ic('trash', 15)}Delete permanently</button></div>`, { cls: 'mt', sub: 'Archiving keeps their history; deleting removes their encrypted file and documents.' })}`;
}
function toggleArchive(id) { const p = getP(id); p.archived = !p.archived; save(); render(); toast(p.archived ? 'Archived' : 'Restored'); }
function delPerson(id) {
  const p = getP(id);
  confirmBox({ title: 'Delete reportee permanently?', msg: `This removes <b>${esc(p.profile.name)}</b>’s encrypted record and all their documents from your data folder. Daily backups keep copies for up to 30 days.`,
    onYes: async () => { S.reportees = S.reportees.filter(x => x.id !== id); save(); await Store.flush(); setTimeout(() => go('#/people'), 0); } });
}

/* ---------------- Documents ---------------- */
function secDocuments(p) {
  return sectionHead('Documents', `Self-assessments, feedback and other files for ${esc(firstName(p.profile.name))}. Files are encrypted and stored only under this reportee.`,
    `<select class="input" id="doctype" style="width:auto">${opts([['auto', 'Detect type'], 'Self-assessment', 'Feedback', 'Other'], 'auto')}</select><button class="btn primary" onclick="pickFiles('.pdf,.docx,.xlsx,.xls,.csv,.txt,.md',true,fs=>uploadDocs('${p.id}',fs,$('#doctype').value))">${ic('upload', 15)}Upload files</button>`) +
    `<div class="card">${p.docs.length ? `<div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>File</th><th>Type</th><th>Uploaded</th><th>Placed</th><th></th></tr></thead><tbody>
    ${[...p.docs].reverse().map(d => `<tr><td><div class="row" style="flex-wrap:nowrap">${ic('file', 15, 'style="color:var(--muted)"')}<b class="ellipsis" style="max-width:260px">${esc(d.name)}</b></div></td><td>${esc(d.docType)}</td><td class="nowrap">${fmt(d.date)}</td>
      <td class="small">${d.placed ? Object.entries(d.placed).filter(([, n]) => n).map(([k, n]) => `${n} ${esc({ selfRatings: 'self ratings', mgrRatings: 'ratings' }[k] || DESTS.find(x => x[0] === k)?.[1] || k)}`).join(', ') || '—' : '—'}</td>
      <td class="nowrap" style="text-align:right"><button class="btn sm ghost" onclick="viewDoc('${p.id}','${d.id}')">View</button>${d.fileId ? `<button class="btn sm ghost" onclick="Files.download('${p.id}','${d.fileId}',${esc(JSON.stringify(d.name))})">${ic('download', 14)}</button>` : ''}<button class="btn sm ghost" onclick="delDoc('${p.id}','${d.id}')" aria-label="Delete">${ic('trash', 14)}</button></td></tr>`).join('')}</tbody></table></div>`
    : `<div class="card-body">${emptyState('file', 'No documents yet', 'Upload PDF, Word, Excel or text. Filled competency matrices are imported as ratings; other files are analysed and you choose where each point goes.')}</div>`}</div>`;
}
function viewDoc(pid, did) {
  const p = getP(pid), d = p.docs.find(x => x.id === did);
  openDrawer({ title: d.name, sub: `${esc(d.docType)} · ${fmt(d.date)}`, body: `<div class="pre small">${esc(d.text || 'No text extracted.')}</div>`,
    foot: `${d.docType !== 'Competency matrix' && !/competency/i.test(d.docType) ? `<button class="btn" onclick="closeDrawer();placementDialog(getP('${pid}'),getP('${pid}').docs.find(x=>x.id==='${did}')).then(render)">Analyse again</button>` : ''}${d.fileId ? `<button class="btn primary" onclick="Files.download('${pid}','${d.fileId}',${esc(JSON.stringify(d.name))})">${ic('download', 15)}Download original</button>` : ''}` });
}
function delDoc(pid, did) {
  confirmBox({ title: 'Delete document?', msg: 'The encrypted file is removed. Points already placed stay where they are.',
    onYes: async () => { const p = getP(pid), d = p.docs.find(x => x.id === did); if (d.fileId) await Files.del(pid, d.fileId); p.docs = p.docs.filter(x => x.id !== did); save(); } });
}

/* ---------------- Half-yearly review ---------------- */
function reviewData(p, ck) {
  const c = cycleByKey(ck), ones = p.oneOnOnes.filter(o => inCycle(o.date, c)).sort((a, b) => a.date.localeCompare(b.date));
  const mor = ones.filter(o => +o.morale);
  return { c, ones, avgM: mor.length ? avg(mor.map(o => +o.morale)) : null, goals: p.goals.filter(g => goalCycle(g) === ck && g.status !== 'Dropped'), fb: p.feedback.filter(x => inCycle(x.date, c)).sort((a, b) => a.date.localeCompare(b.date)),
    gs: goalScore(p, ck), ks: kpiScore(p, ck), crec: p.comp[ck], cms: compStats(p.comp[ck]), css: compStats(p.comp[ck], 'self'),
    idpDone: p.idp.filter(i => i.status === 'Done' && (!i.doneOn || inCycle(i.doneOn, c))), docs: p.docs.filter(d => inCycle(d.date, c)), rv: p.reviews[ck] || {} };
}
function secReview(p) {
  const ck = V.reviewCycle || cycleOf().key, tab = V.revTab || 'summary', R = reviewData(p, ck), nb = nineOf(p), r = roleOf(p);
  const head = sectionHead('Half-yearly review', 'Everything from the cycle in one place. Write the review, then calibrate ratings across the team.',
    `<select class="input" style="width:auto" onchange="V.reviewCycle=this.value;render()">${opts(cycleOpts(), ck)}</select><button class="btn" onclick="printReview('${p.id}','${ck}')">${ic('printer', 15)}Print / PDF</button>`) +
    `<div class="mb">${seg('revTab', [['summary', 'Summary'], ['evidence', 'Evidence'], ['writeup', 'Write-up']], tab)}</div>`;
  if (tab === 'writeup') {
    const rv = R.rv;
    return head + (rv.rating ? card(`Review · ${esc(R.c.short)}`, `<dl class="kv"><dt>Overall rating</dt><dd><b>${esc(RATING[rv.rating])}</b> ${rv.calibrated ? '<span class="badge b-good">Calibrated</span>' : '<span class="badge">Not calibrated</span>'}</dd>
        <dt>What went well</dt><dd>${esc(rv.well || '—')}</dd><dt>Areas to improve</dt><dd>${esc(rv.improve || '—')}</dd><dt>Focus for next cycle</dt><dd>${esc(rv.next || '—')}</dd>
        <dt>Promotion readiness</dt><dd>${esc(rv.promo || '—')}</dd><dt>Overall comments</dt><dd>${esc(rv.comments || '—')}</dd><dt>Last saved</dt><dd>${fmt(rv.saved)}</dd></dl>`,
        { actions: `<button class="btn sm" onclick="editReview('${p.id}','${ck}')">${ic('edit', 14)}Edit</button><a class="btn sm" href="#/insights/calibration">Calibration</a>` })
      : card('', emptyState('award', 'Review not written yet', 'Use the Summary and Evidence tabs, then record the rating and comments.', `<button class="btn primary" onclick="editReview('${p.id}','${ck}')">Write review</button>`)));
  }
  if (tab === 'evidence') return head + `<div class="grid g2">${reviewEvidence(p, R, r)}</div>`;
  const t = (label, value, sub) => `<div class="card tile"><span class="label">${label}</span><span class="value">${value}</span><span class="sub">${sub}</span></div>`;
  return head + `<div class="grid g-auto">${t('Goal completion', pct(R.gs), `${plural(R.goals.length, 'goal')} · weighted`)}${FW() ? t('Competency average', R.cms.avg != null ? R.cms.avg.toFixed(2) : '—', `self ${R.css.avg != null ? R.css.avg.toFixed(2) : '—'} · of ${highV()}`) : ''}
      ${t('KPI score', R.ks != null ? R.ks.toFixed(2) : '—', r ? `of 5 · ${esc(r.name)}` : 'No role')}${t('1:1s held', R.ones.length, `average morale ${R.avgM != null ? R.avgM.toFixed(1) : '—'}`)}${t('9-box', nb ? esc(nb.name) : '—', esc(p.ninebox.risk ? p.ninebox.risk + ' flight risk' : 'risk not set'))}</div>
    ${FW() ? `<div class="mt">${card(`Competencies${R.crec?.grade ? ` · grade ${esc(R.crec.grade)}` : ''}`, hasRatings(R.crec) ? `<table class="tbl"><thead><tr><th>Competency</th><th class="c">Self</th><th class="c">Yours</th></tr></thead><tbody>${FW().comps.map(c => { const it = R.crec.items[c.code] || {}; return `<tr><td>${esc(c.code)} · ${esc(c.name)}</td><td class="c">${ratingChip(it.self)}</td><td class="c">${ratingChip(it.rating)}</td></tr>`; }).join('')}</tbody></table>`
      : `<div class="card-body muted">Not assessed for this cycle. <a href="${personHref(p.id, 'competencies')}" onclick="V.compCycle='${ck}'">Assess now</a></div>`, { flush: hasRatings(R.crec) })}</div>` : ''}`;
}
function reviewEvidence(p, R, r) {
  const kc = p.kpi[R.c.key] || {};
  return [
    card('Goals', R.goals.length ? R.goals.map(g => `<div class="list-row"><div class="grow"><b>${esc(g.title)}</b> ${statusBadge(g.status)}<div class="row small mt-s" style="flex-wrap:nowrap">${progress(g.progress)}<span>${+g.progress || 0}%</span></div></div></div>`).join('') : '<div class="muted small">No goals in this cycle.</div>'),
    card('KPIs', r && r.kpis.length ? `<table class="tbl"><tbody>${r.kpis.map(k => `<tr><td>${esc(k.name)}</td><td>${esc(kc[k.id]?.actual || '')}</td><td>${kc[k.id]?.rating ? esc(RATING[kc[k.id].rating]) : '<span class="muted">not rated</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="muted small">No KPIs for this role.</div>', { flush: !!(r && r.kpis.length) }),
    card(`Feedback & achievements (${R.fb.length})`, R.fb.length ? R.fb.map(x => `<div class="list-row small"><span class="badge">${esc(x.type)}</span><div class="grow"><span class="muted">${fmt(x.date)} · ${esc(x.source)}</span><div class="pre">${esc(x.text)}</div></div></div>`).join('') : '<div class="muted small">Nothing logged in this cycle.</div>'),
    card('1:1 themes', R.ones.length ? R.ones.map(o => `<div class="list-row small"><b class="nowrap">${fmtShort(o.date)}</b><div class="grow">${esc((o.updates || o.notes || o.grow?.goal || '').slice(0, 220))}${o.concerns ? `<div class="muted">Concerns: ${esc(o.concerns.slice(0, 160))}</div>` : ''}</div>${+o.morale ? `<span class="badge">${o.morale}/5</span>` : ''}</div>`).join('') : '<div class="muted small">No 1:1s in this cycle.</div>'),
    card('Strengths & development areas', `<div class="sec-label">Strengths</div>${p.strengths.length ? `<ul style="margin:0 0 10px;padding-left:18px">${p.strengths.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '<div class="muted small mb">—</div>'}<div class="sec-label">Development areas</div>${p.devAreas.length ? `<ul style="margin:0;padding-left:18px">${p.devAreas.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '<div class="muted small">—</div>'}`),
    card('Development completed', R.idpDone.length ? `<ul style="margin:0;padding-left:18px">${R.idpDone.map(i => `<li>${esc(i.title)}</li>`).join('')}</ul>` : '<div class="muted small">None marked done.</div>'),
  ].join('');
}
function editReview(pid, ck) {
  const p = getP(pid), rv = p.reviews[ck] || {};
  openModal({ title: `Review · ${cycleByKey(ck).short}`, sub: esc(p.profile.name), size: 'wide', saveText: 'Save review',
    body: `${S.guidelines.some(g => g.category === 'Review / rating guidelines') ? callout('info', 'You have rating guidelines uploaded — <a href="#/config/guidelines" onclick="closeModal()">check them</a> before finalising.') : ''}
      <div class="fgrid">${sel('Overall rating', 'rating', [['', '—'], ...Object.entries(RATING)], rv.rating)}${sel('Promotion readiness', 'promo', ['', 'Not yet', 'Ready in 1–2 cycles', 'Ready now'], rv.promo)}
      ${area('What went well', 'well', rv.well, { rows: 4 })}${area('Areas to improve', 'improve', rv.improve, { rows: 3 })}${area('Focus for next cycle', 'next', rv.next, { rows: 3 })}${area('Overall comments', 'comments', rv.comments, { rows: 3 })}</div>`,
    onSave: d => {
      const changed = rv.rating && d.rating !== rv.rating;
      p.reviews[ck] = { ...rv, ...d, saved: today(), calibrated: changed ? false : rv.calibrated, compSnapshot: p.comp[ck] ? JSON.parse(JSON.stringify(p.comp[ck])) : null };
      save(); V.revTab = 'writeup';
    } });
}
function printReview(pid, ck) {
  const p = getP(pid), R = reviewData(p, ck), r = roleOf(p), rv = R.rv;
  $('#print-root').innerHTML = `<div style="padding:8px 4px"><h1 style="font-size:22px">${esc(p.profile.name)} — ${esc(R.c.label)}</h1><p class="muted">${esc([p.profile.designation, p.grade && 'Grade ' + p.grade, r?.name, p.profile.empId].filter(Boolean).join(' · '))}</p>
    ${card('Review', rv.rating ? `<dl class="kv"><dt>Overall rating</dt><dd>${esc(RATING[rv.rating])}</dd><dt>What went well</dt><dd>${esc(rv.well || '—')}</dd><dt>Areas to improve</dt><dd>${esc(rv.improve || '—')}</dd><dt>Focus for next cycle</dt><dd>${esc(rv.next || '—')}</dd><dt>Promotion readiness</dt><dd>${esc(rv.promo || '—')}</dd><dt>Comments</dt><dd>${esc(rv.comments || '—')}</dd></dl>` : '<span class="muted">Not written yet.</span>')}
    ${FW() && hasRatings(R.crec) ? card('Competencies', `<table class="tbl"><thead><tr><th>Competency</th><th>Self</th><th>Manager</th><th>Comment</th></tr></thead><tbody>${FW().comps.map(c => { const it = R.crec.items[c.code] || {}; return `<tr><td>${esc(c.code)} ${esc(c.name)}</td><td>${esc(it.self || '–')}</td><td>${esc(it.rating || '–')}</td><td>${esc(it.comment || '')}</td></tr>`; }).join('')}</tbody></table>`, { flush: true }) : ''}
    ${reviewEvidence(p, R, r)}<p class="small muted">Generated by Team Desk on ${fmt(today())}. Confidential.</p></div>`;
  setTimeout(() => window.print(), 50);
}

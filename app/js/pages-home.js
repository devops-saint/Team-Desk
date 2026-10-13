/* =========================================================
   pages-home.js — Dashboard, Upcoming & actions, Reportees list
   ========================================================= */
'use strict';

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

function pgDashboard() {
  crumbs([['Dashboard']]);
  const ps = active(), t = today(), month = t.slice(0, 7), c = cycleOf();
  const who = S.settings.managerName ? `${greeting()}, ${esc(firstName(S.settings.managerName))}` : greeting();
  const head = pageHead(who, `${esc(c.label)} · ${plural(Math.max(0, daysBetween(t, c.end)), 'day')} left in this review cycle`);
  if (!ps.length) return head + `<div class="card">${emptyState('users', 'Add your first reportee', 'Team Desk keeps one private, encrypted record per reportee — 1:1s, competencies, goals, development and reviews.', `<div class="row" style="justify-content:center"><button class="btn primary" onclick="editProfile()">${ic('plus', 15)}Add reportee</button><a class="btn" href="#/config/framework">Review competency framework</a></div>`)}</div>`;
  const done = ps.filter(p => p.oneOnOnes.some(o => o.date.startsWith(month))).length;
  const acts = ps.flatMap(p => personActions(p).filter(a => !a.done));
  const overdue = acts.filter(a => a.due && a.due < t).length;
  const assessed = ps.filter(p => hasMgrRatings(p.comp[c.key])).length;
  const lm = leadershipMetrics().filter(m => m.status !== 'na'), habit = avg(lm.map(m => clamp(m.value, 0, 100)));
  const tile = (href, icon, label, value, sub) => `<a class="card tile" href="${href}"><span class="label">${ic(icon, 14)}${label}</span><span class="value">${value}</span><span class="sub">${sub}</span></a>`;
  const attention = ps.flatMap(p => focusAreas(p).filter(f => f.lvl >= 2).map(f => ({ ...f, p }))).sort((a, b) => b.lvl - a.lvl).slice(0, 8);
  return head + `<div class="grid g-auto">
      ${tile('#/people', 'users', 'Active reportees', ps.length, `${plural(S.reportees.length - ps.length, 'archived')}`)}
      ${tile('#/upcoming', 'message', `1:1s in ${fmtMonth(month)}`, `${done}/${ps.length}`, done === ps.length ? 'Everyone covered' : `${ps.length - done} still to do`)}
      ${tile('#/upcoming', 'checkSq', 'Open action items', acts.length, overdue ? `<span style="color:var(--bad)">${overdue} overdue</span>` : 'None overdue')}
      ${FW() ? tile('#/insights/competency', 'grid', 'Competencies assessed', `${assessed}/${ps.length}`, esc(c.short)) : ''}
      ${tile('#/leadership', 'compass', 'Leadership habits', habit == null ? '—' : pct(habit), 'From your recorded actions')}
    </div>
    <div class="grid g-side mt">
      ${card('Needs your attention', attention.length ? attention.map(x => `<div class="focus-item">${sevDot(x.lvl)}<div class="grow"><a href="${personHref(x.p.id)}"><b>${esc(x.p.profile.name)}</b></a> <span class="badge">${esc(x.area)}</span><div class="small">${esc(x.text)}</div></div><a class="btn sm" href="${personHref(x.p.id, x.sec || 'overview')}">Open</a></div>`).join('')
        : `<div class="muted">${ic('check', 14)} No high-priority items across your team.</div>`, { sub: 'Highest-priority items across your team', actions: `<a class="btn sm ghost" href="#/people">All reportees</a>` })}
      <div class="grid" style="align-content:start">${card(`1:1s this month`, ps.map(p => { const l = lastOne(p), ok = l && l.date.startsWith(month);
        return `<div class="list-row" style="align-items:center">${avatar(p, 'sm')}<div class="grow"><a href="${personHref(p.id, 'meetings')}">${esc(p.profile.name)}</a><div class="xs muted">${l ? `Last: ${fmt(l.date)}` : 'No 1:1 yet'}${p.profile.cadence && p.profile.cadence !== 'Monthly' ? ` · ${esc(p.profile.cadence.toLowerCase())}` : ''}</div></div>${ok ? '<span class="badge b-good">Done</span>' : `<button class="btn sm ghost" onclick="prepareOne('${p.id}')">Prepare</button><button class="btn sm" onclick="editOne('${p.id}')">Log 1:1</button>`}</div>`; }).join(''), { sub: fmtMonth(month) })}
      ${(() => { const ms = ps.flatMap(p => milestones(p, 30).map(m => ({ ...m, p }))).sort((a, b) => a.date.localeCompare(b.date));
        return ms.length ? `<div class="mt">${card('Milestones · next 30 days', ms.map(m => `<div class="list-row" style="align-items:center">${ic(m.icon, 16, `style="color:${m.kind === 'probation' ? 'var(--warn)' : 'var(--accent)'}"`)}<div class="grow"><a href="${personHref(m.p.id, 'profile')}">${esc(m.text)}</a><div class="xs muted">${fmt(m.date)} · ${relDays(m.date)}</div></div></div>`).join(''))}</div>` : ''; })()}</div>
    </div>`;
}

/* ---------- Upcoming & actions ---------- */
function allActions() {
  return active().flatMap(p => personActions(p).map(a => ({ ...a, p })));
}
function pgUpcoming() {
  crumbs([['Upcoming & actions']]);
  const tab = V.upTab || 'agenda', t = today();
  const head = pageHead('Upcoming & actions', 'What’s coming up in the next 30 days, and every action item agreed in 1:1s.');
  const tabs = `<div class="tabs">${[['agenda', 'Next 30 days'], ['actions', 'Action items', allActions().filter(a => !a.done).length], ['leave', 'Team leave', active().reduce((n, p) => n + upcomingLeave(p, 90).length, 0)]].map(([k, l, n]) => `<button class="tab ${tab === k ? 'on' : ''}" onclick="V.upTab='${k}';render()">${l}${n != null ? `<span class="count">${n}</span>` : ''}</button>`).join('')}</div>`;
  if (tab === 'actions') {
    const f = V.actFilter || 'open';
    const rows = allActions().filter(a => f === 'all' ? true : f === 'overdue' ? !a.done && a.due && a.due < t : !a.done).sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
    return head + tabs + card('', `<div class="spread" style="padding:12px 16px;border-bottom:1px solid var(--line)">${seg('actFilter', [['open', 'Open'], ['overdue', 'Overdue'], ['all', 'All']], f)}<span class="small muted">${plural(rows.length, 'item')}</span></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:40px"></th><th>Action</th><th>Reportee</th><th>Owner</th><th>Due</th><th>From 1:1</th></tr></thead><tbody>
      ${rows.map(a => `<tr><td><input type="checkbox" ${a.done ? 'checked' : ''} onchange="${a.o ? `toggleAct('${a.p.id}','${a.o.id}','${a.id}',this.checked)` : `toggleTask('${a.p.id}','${a.id}',this.checked)`}" aria-label="Done"></td>
        <td style="${a.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(a.text)}</td><td><a href="${personHref(a.p.id, 'actions')}">${esc(a.p.profile.name)}</a></td>
        <td>${a.owner === 'me' ? '<span class="badge b-acc">You</span>' : esc(firstName(a.p.profile.name))}</td>
        <td>${a.due ? `<span class="${!a.done && a.due < t ? 'badge b-bad' : ''}">${fmt(a.due)}</span>` : '<span class="muted">—</span>'}</td><td class="small muted">${a.o ? fmt(a.o.date) : esc(a.source || '—')}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('checkSq', 'No action items here', 'Actions you agree in 1:1s appear here.')}`, { flush: true });
  }
  if (tab === 'leave') {
    const rows = active().flatMap(p => upcomingLeave(p, 90).map(l => ({ ...l, p }))).sort((a, b) => a.from.localeCompare(b.from));
    const ov = l => rows.filter(x => x.p.id !== l.p.id && x.from <= (l.to || l.from) && (x.to || x.from) >= l.from).map(x => x.p.profile.name);
    const total = active().length;
    return head + tabs + `<div class="card">${rows.length ? `<div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Reportee</th><th>Dates</th><th class="c">Working days</th><th>Type</th><th>Status</th><th>Overlaps with</th></tr></thead><tbody>
      ${rows.map(l => { const o = [...new Set(ov(l))]; return `<tr class="click" onclick="go('${personHref(l.p.id, 'leave')}')"><td>${personCell(l.p)}</td><td class="nowrap"><b>${fmt(l.from)}</b>${l.to && l.to !== l.from ? ` – ${fmt(l.to)}` : ''}<div class="sub">${relDays(l.from)}</div></td>
        <td class="c">${workDays(l.from, l.to || l.from)}</td><td>${esc(l.type)}</td><td>${statusBadge(l.status)}</td><td>${o.length ? `<span class="badge ${o.length + 1 >= Math.max(2, Math.ceil(total / 2)) ? 'b-bad' : 'b-warn'}">${esc(o.join(', '))}</span>` : '<span class="muted small">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="card-body">${emptyState('calendar', 'No leave in the next 90 days', 'Record leave on a reportee’s Leave page, or in the Leave tab of a 1:1.')}</div>`}
      <div class="card-foot" style="justify-content:flex-start"><span class="xs muted">Manager-only view. Red means half the team or more is away at the same time.</span></div></div>`;
  }
  const up = [];
  active().forEach(p => {
    p.goals.filter(g => !['Done', 'Dropped'].includes(g.status) && g.due && g.due >= t && g.due <= addDays(t, 30)).forEach(g => up.push({ d: g.due, p, icon: 'target', txt: `Goal due: ${g.title}`, sec: 'goals' }));
    p.idp.filter(i => !['Done', 'Deferred'].includes(i.status) && i.due && i.due >= t && i.due <= addDays(t, 30)).forEach(i => up.push({ d: i.due, p, icon: 'trend', txt: `Development item: ${i.title}`, sec: 'idp' }));
    p.oneOnOnes.forEach(o => {
      if (o.next && o.next >= t && o.next <= addDays(t, 30)) up.push({ d: o.next, p, icon: 'message', txt: 'Planned 1:1', sec: 'meetings' });
      (o.actions || []).filter(a => !a.done && a.due && a.due >= t && a.due <= addDays(t, 30)).forEach(a => up.push({ d: a.due, p, icon: 'checkSq', txt: `${a.owner === 'me' ? 'Your action' : 'Their action'}: ${a.text}`, sec: 'actions' }));
    });
    const pip = activePip(p); if (pip?.end && pip.end >= t && pip.end <= addDays(t, 30)) up.push({ d: pip.end, p, icon: 'flag', txt: 'Improvement plan end date', sec: 'pip' });
    milestones(p, 30).forEach(m => up.push({ d: m.date, p, icon: m.icon, txt: m.kind === 'probation' ? 'Probation ends — confirmation review' : m.kind === 'birthday' ? 'Birthday' : m.text.replace(/^.*’s /, ''), sec: 'profile' }));
    upcomingLeave(p, 30).forEach(l => up.push({ d: l.from < t ? t : l.from, p, icon: 'calendar', txt: `${l.from < t ? 'On leave until ' + fmtShort(l.to || l.from) : 'Leave starts'}${l.to && l.to !== l.from && l.from >= t ? ` (to ${fmtShort(l.to)})` : ''} · ${l.type}`, sec: 'leave' }));
    (p.tasks || []).filter(a => !a.done && a.due && a.due >= t && a.due <= addDays(t, 30)).forEach(a => up.push({ d: a.due, p, icon: 'checkSq', txt: `${a.owner === 'me' ? 'Your action' : 'Their action'}: ${a.text}`, sec: 'actions' }));
  });
  const c = cycleOf(); if (c.end <= addDays(t, 30)) up.push({ d: c.end, icon: 'flag', txt: `${c.short} review cycle ends` });
  up.sort((a, b) => a.d.localeCompare(b.d));
  const byDay = {}; up.forEach(u => (byDay[u.d] = byDay[u.d] || []).push(u));
  return head + tabs + (up.length ? Object.entries(byDay).map(([d, items]) => `<div class="card mb"><div class="card-head"><h2>${fmt(d)}</h2><span class="small muted">${relDays(d)}</span></div><div class="card-body">
      ${items.map(u => `<div class="list-row" style="align-items:center">${ic(u.icon, 16, 'style="color:var(--muted)"')}<div class="grow">${u.p ? `<a href="${personHref(u.p.id, u.sec)}"><b>${esc(u.p.profile.name)}</b></a> · ` : ''}${esc(u.txt)}</div></div>`).join('')}</div></div>`).join('')
    : card('', emptyState('calendar', 'Nothing scheduled in the next 30 days', 'Set “next 1:1” dates, goal due dates and action due dates to see them here.')));
}

/* ---------- Reportees ---------- */
function pgPeople() {
  crumbs([[isPM() ? 'All reportees' : 'Reportees']]);
  const showArch = V.peopleView === 'archived', q = (V.peopleQ || '').toLowerCase(), pm = isPM(), mf = pm ? V.mgrFilter || '' : '';
  const inScope = p => !mf || p.managerId === mf;
  const ps = S.reportees.filter(p => !!p.archived === showArch && inScope(p) && (!q || [p.profile.name, p.profile.designation, p.grade, p.profile.team, pm && managerName(p.managerId)].some(x => String(x || '').toLowerCase().includes(q))))
    .sort((a, b) => (a.profile.name || '').localeCompare(b.profile.name || ''));
  const nAct = S.reportees.filter(p => !p.archived && inScope(p)).length, nArch = S.reportees.filter(p => p.archived && inScope(p)).length;
  const mgrSel = pm ? `<select class="input" style="width:auto;height:32px" onchange="V.mgrFilter=this.value;render()" aria-label="Line manager">${opts([['', 'All line managers'], ...Object.entries(App.managers).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, m]) => [id, m.name])], mf)}</select>` : '';
  return pageHead(pm ? 'All reportees' : 'Reportees', pm ? 'Every reportee across all line managers. View only — open anyone to see their full record or download a report for HR or leadership.' : CENTRAL ? 'Only you (and people managers) can see your reportees. Each record is stored encrypted on the server.' : 'Each reportee’s record is stored in its own encrypted file and is only ever shown on their own pages.', pm ? '' : `<button class="btn primary" onclick="editProfile()">${ic('plus', 15)}Add reportee</button>`)
    + `<div class="card"><div class="spread" style="padding:12px 16px;border-bottom:1px solid var(--line)">${seg('peopleView', [['active', `Active (${nAct})`], ['archived', `Archived (${nArch})`]], showArch ? 'archived' : 'active')}
      <div class="row">${mgrSel}<input class="input" style="max-width:260px;height:32px" placeholder="Filter by name, grade, team…" value="${esc(V.peopleQ || '')}" oninput="V.peopleQ=this.value;clearTimeout(window._pq);window._pq=setTimeout(()=>{render();const i=$('#pq');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)" id="pq"></div></div>
    ${ps.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reportee</th>${pm ? '<th>Line manager</th>' : ''}<th>Grade</th><th>Role</th><th>Last 1:1</th><th>Next 1:1</th><th>Attention</th><th>Talent</th></tr></thead><tbody>
      ${ps.map(p => { const l = lastOne(p), n = nextOne(p), f = focusAreas(p), hi = f.filter(x => x.lvl === 3).length, nb = nineOf(p);
        return `<tr class="click" onclick="go('${personHref(p.id)}')"><td>${personCell(p, esc(p.profile.designation || '—'))}</td>${pm ? `<td>${esc(managerName(p.managerId) || '—')}</td>` : ''}<td>${esc(p.grade || '—')}</td><td>${esc(roleOf(p)?.name || '—')}</td>
          <td>${l ? fmt(l.date) : '<span class="muted">None</span>'}</td><td>${n ? fmtShort(n) : '<span class="muted">—</span>'}</td>
          <td>${hi ? `<span class="badge b-bad">${hi} high</span> ` : ''}<span class="small muted">${plural(f.length, 'item')}</span></td>
          <td>${nb ? `<span class="badge b-acc">${esc(nb.name)}</span> ` : ''}${riskBadge(p.ninebox.risk)}${activePip(p) ? ' <span class="badge b-warn">Improvement plan</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`
    : emptyState('users', showArch ? 'No archived reportees' : q || mf ? 'No matches' : 'No reportees yet', showArch ? 'People who move out of a team can be archived from their profile.' : pm && !q ? 'Line managers’ reportees appear here once they add them.' : '', showArch || q || pm ? '' : `<button class="btn primary" onclick="editProfile()">${ic('plus', 15)}Add reportee</button>`)}</div>`;
}

/* ---------- People manager: organisation overview (view only) ---------- */
function teamsByManager() {
  const by = {};
  active().forEach(p => (by[p.managerId || ''] = by[p.managerId || ''] || []).push(p));
  return Object.entries(by).map(([id, ps]) => ({ id, name: managerName(id) || 'Unassigned', ps })).sort((a, b) => a.name.localeCompare(b.name));
}
function teamStats(ps) {
  const t = today(), month = t.slice(0, 7), c = cycleOf();
  return {
    n: ps.length,
    met: ps.filter(p => { const cad = CADENCE_DAYS[p.profile.cadence]; const l = lastOne(p); return cad && cad < 30 ? l && daysBetween(l.date, t) <= cad + 2 : p.oneOnOnes.some(o => o.date.startsWith(month)); }).length,
    overdue: ps.reduce((n, p) => n + personActions(p).filter(a => !a.done && a.due && a.due < t).length, 0),
    goals: ps.filter(p => p.goals.some(g => goalCycle(g) === c.key && g.status !== 'Dropped')).length,
    assessed: ps.filter(p => hasMgrRatings(p.comp[c.key])).length,
    high: ps.filter(p => p.ninebox.risk === 'High').length, med: ps.filter(p => p.ninebox.risk === 'Medium').length,
    pips: ps.filter(p => activePip(p)).length,
    urgent: ps.reduce((n, p) => n + focusAreas(p).filter(f => f.lvl === 3).length, 0),
    morale: avg(ps.flatMap(p => { const o = lastOne(p); return o && +o.morale && daysBetween(o.date, t) <= 60 ? [+o.morale] : []; })),
  };
}
function pgOrgDashboard() {
  crumbs([['Organisation']]);
  const ps = active(), c = cycleOf(), teams = teamsByManager(), all = teamStats(ps);
  const head = pageHead(`${greeting()}, ${esc(firstName(App.user?.name || ''))}`, `${esc(c.label)} · people manager view of ${plural(teams.filter(x => x.id).length, 'line manager')} and ${plural(ps.length, 'reportee')}`);
  if (!ps.length) return head + card('', emptyState('users', 'No reportees yet', 'When line managers add their reportees, the organisation overview appears here.'));
  const tile = (href, icon, label, value, sub, onclick = '') => `<a class="card tile" href="${href}" ${onclick}><span class="label">${ic(icon, 14)}${label}</span><span class="value">${value}</span><span class="sub">${sub}</span></a>`;
  const ready = ps.filter(p => p.talent?.readiness === 'Ready now');
  const urgentAll = ps.flatMap(p => focusAreas(p).filter(f => f.lvl >= 3).map(f => ({ ...f, p }))), attention = urgentAll.slice(0, 8);
  return head + `<div class="grid g-auto">
      ${tile('#/managers', 'user', 'Line managers', teams.filter(x => x.id).length, `${plural(ps.length, 'active reportee')}`)}
      ${tile('#/people', 'message', '1:1s on schedule', pct(all.met / all.n * 100), `${all.met} of ${all.n} reportees`)}
      ${FW() ? tile('#/insights/competency', 'grid', 'Competencies assessed', `${all.assessed}/${all.n}`, esc(c.short)) : ''}
      ${tile('#/insights/talent', 'alert', 'High flight risk', all.high, `${all.med} medium · ${plural(all.pips, 'improvement plan')}`)}
      ${tile('#/insights/talent', 'award', 'Ready for promotion', ready.length, 'Marked “ready now”')}
    </div>
    <div class="card mt"><div class="card-head"><div><h2>Teams at a glance</h2><p>Click a team to see its reportees. Figures are for active reportees in ${esc(c.short)}.</p></div></div>
      <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Line manager</th><th class="c">Team</th><th class="c" title="1:1s held on each person’s schedule">1:1s</th><th class="c" title="Goals set for this cycle">Goals</th><th class="c" title="Competencies assessed this cycle">Assessed</th><th class="c" title="Overdue action items">Overdue</th><th class="c" title="Average morale in recent 1:1s">Morale</th><th>Risk & plans</th><th class="c" title="Red items across the team">Urgent</th></tr></thead><tbody>
      ${teams.map(tm => { const s = teamStats(tm.ps), ratio = (a, b) => `<span class="${a < b ? 'muted' : ''}">${a}/${b}</span>`;
        return `<tr class="click" onclick="V.mgrFilter='${tm.id}';go('#/people')"><td><div class="person-cell"><span class="avatar">${esc(initials(tm.name))}</span><div><b>${esc(tm.name)}</b><span class="sub">${esc(App.managers[tm.id]?.email || '')}</span></div></div></td>
          <td class="c">${s.n}</td><td class="c">${s.met === s.n ? `<span class="badge b-good">${s.met}/${s.n}</span>` : ratio(s.met, s.n)}</td><td class="c">${ratio(s.goals, s.n)}</td><td class="c">${ratio(s.assessed, s.n)}</td>
          <td class="c">${s.overdue ? `<span class="badge b-bad">${s.overdue}</span>` : '<span class="muted">0</span>'}</td><td class="c">${s.morale != null ? s.morale.toFixed(1) : '—'}</td>
          <td class="nowrap">${s.high ? `<span class="badge b-bad">${s.high} high</span> ` : ''}${s.med ? `<span class="badge b-warn">${s.med} medium</span> ` : ''}${s.pips ? `<span class="badge b-warn">${plural(s.pips, 'plan')}</span>` : ''}${!s.high && !s.med && !s.pips ? '<span class="muted small">—</span>' : ''}</td>
          <td class="c">${s.urgent ? `<span class="badge b-bad">${s.urgent}</span>` : '<span class="muted">0</span>'}</td></tr>`; }).join('')}</tbody></table></div></div>
    <div class="grid g-side mt">
      ${card('Urgent items across the organisation', attention.length ? attention.map(x => `<div class="focus-item">${sevDot(x.lvl)}<div class="grow"><a href="${personHref(x.p.id)}"><b>${esc(x.p.profile.name)}</b></a> <span class="xs muted">· ${esc(managerName(x.p.managerId))}</span> <span class="badge">${esc(x.area)}</span><div class="small">${esc(x.text)}</div></div><a class="btn sm" href="${personHref(x.p.id, x.sec || 'overview')}">Open</a></div>`).join('') : `<div class="muted">${ic('check', 14)} Nothing urgent across the organisation.</div>`, { sub: `Red items from every team — the line manager owns the follow-up${urgentAll.length > 8 ? ` · showing 8 of ${urgentAll.length}` : ''}` })}
      ${card('Talent snapshot', `${['Star', 'High potential', 'High performer', 'Core player', 'Rough diamond', 'Under-performer'].map(n => { const k = ps.filter(p => nineOf(p)?.name === n).length; return k ? `<div class="list-row" style="align-items:center"><span class="grow">${esc(n)}</span><b>${k}</b></div>` : ''; }).join('') || '<div class="muted small">No 9-box placements yet.</div>'}
        ${ready.length ? `<div class="sec-label mt">Ready now</div>${ready.map(p => `<div class="small"><a href="${personHref(p.id, 'talent')}">${esc(p.profile.name)}</a> <span class="muted">· ${esc(managerName(p.managerId))}</span></div>`).join('')}` : ''}`, { actions: `<a class="btn sm ghost" href="#/insights/talent">Details</a>` })}
    </div>`;
}
function pgManagers() {
  crumbs([['Line managers']]);
  const teams = teamsByManager(), ids = new Set(teams.map(t => t.id));
  const idle = Object.entries(App.managers).filter(([id]) => !ids.has(id)).map(([id, m]) => ({ id, name: m.name, ps: [] }));
  return pageHead('Line managers', 'Each line manager and their team. Click a row to see the reportees.') + `<div class="card"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Line manager</th><th>Email</th><th class="c">Active reportees</th><th class="c">Archived</th><th>Grades</th></tr></thead><tbody>
    ${[...teams, ...idle].map(tm => `<tr class="click" onclick="V.mgrFilter='${tm.id}';V.peopleView='active';go('#/people')"><td><div class="person-cell"><span class="avatar">${esc(initials(tm.name))}</span><b>${esc(tm.name)}</b></div></td><td class="small">${esc(App.managers[tm.id]?.email || '')}${App.managers[tm.id]?.status === 'disabled' ? ' <span class="badge b-warn">Disabled</span>' : ''}</td>
      <td class="c">${tm.ps.length}</td><td class="c">${S.reportees.filter(p => p.archived && p.managerId === tm.id).length}</td><td class="small">${esc([...new Set(tm.ps.map(p => p.grade).filter(Boolean))].sort().join(', ') || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------- add / edit profile ---------- */
function editProfile(id) {
  const p = id ? getP(id) : null, pr = p?.profile || {};
  const gradeOpts = FW() ? [['', '— not set —'], ...FW().grades.map(g => [g, 'Grade ' + g])] : null;
  openModal({
    title: p ? 'Edit profile' : 'Add reportee', sub: p ? esc(pr.name) : 'Only the name is required — you can fill the rest later.', size: 'wide', saveText: p ? 'Save changes' : 'Add reportee',
    body: mtabs([
      ['Employment', `<div class="fgrid">${fld('Full name', 'name', pr.name, { req: true })}${fld('Employee ID', 'empId', pr.empId)}
        ${fld('Designation', 'designation', pr.designation)}${gradeOpts ? sel('Grade (competency matrix)', 'grade', gradeOpts, p?.grade) : fld('Band / grade', 'band', pr.band)}
        ${sel('Role (for KPIs & skill targets)', 'roleId', [['', '— none —'], ...S.roles.map(r => [r.id, r.name])], p?.roleId)}${fld('Team / project', 'team', pr.team)}
        ${dfld('Date of joining', 'doj', pr.doj, { quick: 'past' })}${dfld('Reporting to me since', 'since', pr.since, { quick: 'past' })}
        ${dfld('Last promotion', 'lastPromo', pr.lastPromo, { quick: 'past' })}${sel('Work mode', 'workMode', ['', 'Office', 'Hybrid', 'Remote'], pr.workMode)}
        ${fld('Location', 'location', pr.location)}${gradeOpts ? fld('Band', 'band', pr.band, { opt: true }) : ''}
        ${sel('1:1 frequency', 'cadence', ['Monthly', 'Fortnightly', 'Weekly'], pr.cadence || 'Monthly', { hint: 'Used for “1:1 overdue” reminders.' })}${dfld('Probation ends', 'probationEnd', pr.probationEnd, { opt: true, quick: '' })}
        ${chk('Confirmed after probation', 'confirmed', pr.confirmed, { cls: 'full' })}</div>`],
      ['Contact', `<div class="fgrid">${fld('Work email', 'email', pr.email, { type: 'email' })}${fld('Phone', 'phone', pr.phone, { type: 'tel' })}${dfld('Birthday', 'dob', pr.dob, { opt: true, quick: 'past', hint: 'Only used for a reminder on the day. Year is not shown.' })}</div>`],
      ['Background & aspirations', `<div class="fgrid">${fld('Total experience (years)', 'exp', pr.exp, { type: 'number', attrs: 'step="0.5" min="0"' })}${fld('Education', 'education', pr.education)}
        ${area('Certifications', 'certs', pr.certs, { rows: 2 })}${area('Current responsibilities / key projects', 'projects', pr.projects)}
        ${area('Career aspirations', 'aspirations', pr.aspirations, { rows: 2 })}${area('Personal context', 'personal', pr.personal, { rows: 2, hint: `Interests, constraints, what motivates them. ${CENTRAL && App.status?.pmSeesPrivate ? 'Visible to you and people managers.' : 'Only you can see this.'}` })}</div>`],
    ]),
    onSave: d => {
      if (!d.name) { toast('Name is required', 'err'); return false; }
      const { roleId, grade, ...prof } = d;
      if (p) {
        p.profile = { ...p.profile, ...prof }; p.roleId = roleId;
        if (grade !== undefined) { p.grade = grade; const cr = p.comp[cycleOf().key]; if (cr && !hasRatings(cr)) cr.grade = grade; }
        save();
      } else {
        const np = normP({ id: uid(), roleId, grade: grade || '', profile: prof, created: today() });
        S.reportees.push(np); save();
        setTimeout(() => go(personHref(np.id)), 0);
      }
    },
  });
}

/* ---------- quick note: capture an observation for anyone in seconds ---------- */
function quickNote(pid) {
  const ps = active();
  if (!ps.length) return toast('Add a reportee first', 'err');
  openModal({ title: 'Quick note', sub: 'Capture it now — it goes into the reportee’s feedback log.', saveText: 'Save note',
    body: `<div class="fgrid">${sel('Reportee', 'pid', ps.map(p => [p.id, p.profile.name]), pid || (route()[0] === 'people' && route()[1]) || ps[0].id)}${sel('Type', 'type', FB_TYPES, 'Observation')}
      ${area('Note', 'text', '', { rows: 4, ph: 'What did you see or hear? Be specific — when, what, impact.' })}${dfld('Date', 'date', today(), { quick: 'past' })}<span></span>
      ${chk('Also add a follow-up action for me', 'follow', false, { cls: 'full' })}</div>`,
    onSave: d => {
      if (!d.text) { toast('Write the note', 'err'); return false; }
      const p = getP(d.pid);
      p.feedback.push({ id: uid(), date: d.date || today(), type: d.type, source: 'Manager', from: '', text: d.text });
      if (d.follow) p.tasks.push({ id: uid(), text: `Follow up: ${d.text.slice(0, 120)}`, owner: 'me', due: addDays(today(), 7), done: false, created: today(), source: 'Quick note' });
      save(); toast(`Saved to ${firstName(p.profile.name)}’s feedback log`);
    } });
}

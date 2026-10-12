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
  const acts = ps.flatMap(p => p.oneOnOnes.flatMap(o => (o.actions || []).filter(a => !a.done)));
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
      ${card(`1:1s this month`, ps.map(p => { const l = lastOne(p), ok = l && l.date.startsWith(month);
        return `<div class="list-row" style="align-items:center">${avatar(p, 'sm')}<div class="grow"><a href="${personHref(p.id, 'meetings')}">${esc(p.profile.name)}</a><div class="xs muted">${l ? `Last: ${fmt(l.date)}` : 'No 1:1 yet'}</div></div>${ok ? '<span class="badge b-good">Done</span>' : `<button class="btn sm" onclick="editOne('${p.id}')">Log 1:1</button>`}</div>`; }).join(''), { sub: fmtMonth(month) })}
    </div>`;
}

/* ---------- Upcoming & actions ---------- */
function allActions() {
  return active().flatMap(p => p.oneOnOnes.flatMap(o => (o.actions || []).map(a => ({ ...a, p, o }))));
}
function pgUpcoming() {
  crumbs([['Upcoming & actions']]);
  const tab = V.upTab || 'agenda', t = today();
  const head = pageHead('Upcoming & actions', 'What’s coming up in the next 30 days, and every action item agreed in 1:1s.');
  const tabs = `<div class="tabs">${[['agenda', 'Next 30 days'], ['actions', 'Action items', allActions().filter(a => !a.done).length]].map(([k, l, n]) => `<button class="tab ${tab === k ? 'on' : ''}" onclick="V.upTab='${k}';render()">${l}${n != null ? `<span class="count">${n}</span>` : ''}</button>`).join('')}</div>`;
  if (tab === 'actions') {
    const f = V.actFilter || 'open';
    const rows = allActions().filter(a => f === 'all' ? true : f === 'overdue' ? !a.done && a.due && a.due < t : !a.done).sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
    return head + tabs + card('', `<div class="spread" style="padding:12px 16px;border-bottom:1px solid var(--line)">${seg('actFilter', [['open', 'Open'], ['overdue', 'Overdue'], ['all', 'All']], f)}<span class="small muted">${plural(rows.length, 'item')}</span></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:40px"></th><th>Action</th><th>Reportee</th><th>Owner</th><th>Due</th><th>From 1:1</th></tr></thead><tbody>
      ${rows.map(a => `<tr><td><input type="checkbox" ${a.done ? 'checked' : ''} onchange="toggleAct('${a.p.id}','${a.o.id}','${a.id}',this.checked)" aria-label="Done"></td>
        <td style="${a.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(a.text)}</td><td><a href="${personHref(a.p.id, 'actions')}">${esc(a.p.profile.name)}</a></td>
        <td>${a.owner === 'me' ? '<span class="badge b-acc">You</span>' : esc(firstName(a.p.profile.name))}</td>
        <td>${a.due ? `<span class="${!a.done && a.due < t ? 'badge b-bad' : ''}">${fmt(a.due)}</span>` : '<span class="muted">—</span>'}</td><td class="small muted">${fmt(a.o.date)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('checkSq', 'No action items here', 'Actions you agree in 1:1s appear here.')}`, { flush: true });
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
  crumbs([['Reportees']]);
  const showArch = V.peopleView === 'archived', q = (V.peopleQ || '').toLowerCase();
  const ps = S.reportees.filter(p => !!p.archived === showArch && (!q || [p.profile.name, p.profile.designation, p.grade, p.profile.team].some(x => String(x || '').toLowerCase().includes(q))))
    .sort((a, b) => (a.profile.name || '').localeCompare(b.profile.name || ''));
  return pageHead('Reportees', 'Each reportee’s record is stored in its own encrypted file and is only ever shown on their own pages.', `<button class="btn primary" onclick="editProfile()">${ic('plus', 15)}Add reportee</button>`)
    + `<div class="card"><div class="spread" style="padding:12px 16px;border-bottom:1px solid var(--line)">${seg('peopleView', [['active', `Active (${active().length})`], ['archived', `Archived (${S.reportees.length - active().length})`]], showArch ? 'archived' : 'active')}
      <input class="input" style="max-width:260px;height:32px" placeholder="Filter by name, grade, team…" value="${esc(V.peopleQ || '')}" oninput="V.peopleQ=this.value;clearTimeout(window._pq);window._pq=setTimeout(()=>{render();const i=$('.card input.input');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)"></div>
    ${ps.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reportee</th><th>Grade</th><th>Role</th><th>Last 1:1</th><th>Next 1:1</th><th>Attention</th><th>Talent</th></tr></thead><tbody>
      ${ps.map(p => { const l = lastOne(p), n = nextOne(p), f = focusAreas(p), hi = f.filter(x => x.lvl === 3).length, nb = nineOf(p);
        return `<tr class="click" onclick="go('${personHref(p.id)}')"><td>${personCell(p, esc(p.profile.designation || '—'))}</td><td>${esc(p.grade || '—')}</td><td>${esc(roleOf(p)?.name || '—')}</td>
          <td>${l ? fmt(l.date) : '<span class="muted">None</span>'}</td><td>${n ? fmtShort(n) : '<span class="muted">—</span>'}</td>
          <td>${hi ? `<span class="badge b-bad">${hi} high</span> ` : ''}<span class="small muted">${plural(f.length, 'item')}</span></td>
          <td>${nb ? `<span class="badge b-acc">${esc(nb.name)}</span> ` : ''}${riskBadge(p.ninebox.risk)}${activePip(p) ? ' <span class="badge b-warn">Improvement plan</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`
    : emptyState('users', showArch ? 'No archived reportees' : q ? 'No matches' : 'No reportees yet', showArch ? 'People who move out of your team can be archived from their profile.' : '', showArch || q ? '' : `<button class="btn primary" onclick="editProfile()">${ic('plus', 15)}Add reportee</button>`)}</div>`;
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
        ${fld('Location', 'location', pr.location)}${gradeOpts ? fld('Band', 'band', pr.band, { opt: true }) : ''}</div>`],
      ['Contact', `<div class="fgrid">${fld('Work email', 'email', pr.email, { type: 'email' })}${fld('Phone', 'phone', pr.phone, { type: 'tel' })}</div>`],
      ['Background & aspirations', `<div class="fgrid">${fld('Total experience (years)', 'exp', pr.exp, { type: 'number', attrs: 'step="0.5" min="0"' })}${fld('Education', 'education', pr.education)}
        ${area('Certifications', 'certs', pr.certs, { rows: 2 })}${area('Current responsibilities / key projects', 'projects', pr.projects)}
        ${area('Career aspirations', 'aspirations', pr.aspirations, { rows: 2 })}${area('Personal context', 'personal', pr.personal, { rows: 2, hint: 'Interests, constraints, what motivates them. Only you can see this.' })}</div>`],
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

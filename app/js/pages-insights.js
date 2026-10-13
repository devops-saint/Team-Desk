/* =========================================================
   pages-insights.js — team-level views (manager only)
   ========================================================= */
'use strict';

const needPeople = title => { crumbs([['Insights'], [title]]); return active().length ? null : pageHead(title) + card('', emptyState('users', 'No reportees yet', 'Add reportees to see team insights.', `<button class="btn primary" onclick="editProfile()">Add reportee</button>`)); };
const privacyNote = 'Manager-only view. Never share this page — it shows several reportees together.';

/* ---------- Competency map ---------- */
function pgCompMap() {
  const e = needPeople('Competency map'); if (e) return e;
  const fw = FW(), ps = active();
  if (!fw) return pageHead('Competency map') + card('', emptyState('grid', 'No competency framework', '', '<a class="btn primary" href="#/config/framework">Set up framework</a>'));
  const ck = V.mapCycle || cycleOf().key, tab = V.cmTab || 'heat', lo = lowV(), hi = highV();
  const val = (p, code) => p.comp[ck]?.items?.[code]?.rating;
  const st = fw.comps.map(c => { const vs = ps.map(p => numVal(val(p, c.code))).filter(v => v !== null);
    return { c, avg: avg(vs), low: ps.filter(p => numVal(val(p, c.code)) !== null && numVal(val(p, c.code)) <= lo), high: ps.filter(p => numVal(val(p, c.code)) !== null && numVal(val(p, c.code)) >= hi) }; });
  const assessed = ps.filter(p => hasMgrRatings(p.comp[ck])).length;
  const head = pageHead('Competency map', `${privacyNote}`, `<select class="input" style="width:auto" onchange="V.mapCycle=this.value;render()">${opts(cycleOpts(), ck)}</select>`) +
    `<div class="tabs">${[['heat', 'Heatmap'], ['gaps', 'Gaps & coaching']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" onclick="V.cmTab='${k}';render()">${l}</button>`).join('')}</div>`;
  if (tab === 'gaps') {
    const gaps = st.filter(x => x.low.length >= 2 || (x.avg !== null && x.avg < (lo + hi) / 2 && x.low.length));
    const pairs = st.filter(x => x.low.length && x.high.length);
    return head + `<div class="grid g2">${card('Team-wide gaps', gaps.length ? gaps.map(x => `<div class="list-row"><div class="grow"><b>${esc(x.c.code)} · ${esc(x.c.name)}</b><div class="small muted">${x.low.length} below grade: ${esc(x.low.map(p => p.profile.name).join(', '))}</div></div></div>`).join('') + `<div class="mt">${callout('info', 'Consider a group session or workshop for these.')}</div>` : '<div class="muted small">No competency where several people are below grade.</div>', { sub: 'Competencies where several people are below their grade' })}
      ${card('Peer coaching opportunities', pairs.length ? pairs.map(x => `<div class="list-row small"><div><b>${esc(x.c.code)} · ${esc(x.c.name)}</b><div>${esc(x.high.map(p => p.profile.name).join(', '))} <span class="muted">(above grade) could support</span> ${esc(x.low.map(p => p.profile.name).join(', '))}</div></div></div>`).join('') : '<div class="muted small">Rate competencies to see who could coach whom.</div>', { sub: 'Arrange these without sharing anyone’s ratings' })}</div>`;
  }
  return head + `<div class="card"><div class="card-head"><div><h2>${esc(cycleByKey(ck).short)}</h2><p>${assessed}/${ps.length} assessed · your ratings, against each person’s own grade</p></div>
      <div class="row">${scale().map(s => `<span class="hc" style="${ratingStyle(s.v)}" title="${esc(s.label)}">${esc(s.v)}</span><span class="xs muted">${esc(s.label.split('–')[0].trim())}</span>`).join(' ')}</div></div>
    <div class="card-body flush tbl-wrap"><table class="tbl heat"><thead><tr><th>Reportee</th><th>Grade</th>${fw.comps.map(c => `<th title="${esc(c.name)}">${esc(c.code)}</th>`).join('')}<th>Avg</th></tr></thead><tbody>
    ${ps.map(p => { const s = compStats(p.comp[ck]); return `<tr><td><a href="${personHref(p.id, 'competencies')}" onclick="V.compCycle='${ck}'">${esc(p.profile.name)}</a></td><td>${esc(p.comp[ck]?.grade || p.grade || '–')}</td>
      ${fw.comps.map(c => { const v = val(p, c.code), sf = p.comp[ck]?.items?.[c.code]?.self; return `<td><span class="hc" style="${ratingStyle(v)}" title="${esc(c.name)}${sf ? ' · self ' + esc(sf) : ''}">${v ? esc(v) : '–'}</span></td>`; }).join('')}<td><b>${s.avg != null ? s.avg.toFixed(1) : '–'}</b></td></tr>`; }).join('')}
    <tr><td><b>Team average</b></td><td></td>${st.map(x => `<td class="small"><b>${x.avg != null ? x.avg.toFixed(1) : '–'}</b></td>`).join('')}<td></td></tr></tbody></table></div>
    <div class="card-foot" style="justify-content:flex-start"><span class="small muted">${fw.comps.map(c => `<b>${esc(c.code)}</b> ${esc(c.name)}`).join(' · ')}</span></div></div>`;
}

/* ---------- Skills map ---------- */
function pgSkillMap() {
  const e = needPeople('Skills map'); if (e) return e;
  const ps = active();
  const col = (cur, tg) => !cur ? 'background:var(--mid-bg);color:var(--faint)' : (!tg || cur >= tg) ? 'background:var(--good-bg);color:var(--good)' : tg - cur >= 2 ? 'background:var(--bad-bg);color:var(--bad)' : 'background:var(--warn-bg);color:var(--warn)';
  const stats = S.skills.map(s => ({ s, below: ps.filter(p => effTarget(p, s.id) > (+p.skills[s.id]?.current || 0)), experts: ps.filter(p => +p.skills[s.id]?.current >= 4) }));
  const gaps = stats.filter(x => x.below.length >= Math.max(2, Math.ceil(ps.length / 2))), mentors = stats.filter(x => x.below.length && x.experts.length);
  return pageHead('Skills map', `Technical skills across the team — your rating / target. ${privacyNote}`, `<a class="btn" href="#/config/skills">${ic('edit', 15)}Edit skill list</a>`) +
    `<div class="card"><div class="card-body flush tbl-wrap"><table class="tbl heat"><thead><tr><th>Reportee</th>${S.skills.map(s => `<th style="min-width:72px">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>
    ${ps.map(p => `<tr><td><a href="${personHref(p.id, 'skills')}">${esc(p.profile.name)}</a></td>${S.skills.map(s => { const cur = +p.skills[s.id]?.current || 0, tg = effTarget(p, s.id); return `<td><span class="hc" style="${col(cur, tg)}">${cur || '–'}${tg ? `<span style="font-weight:400;opacity:.65">/${tg}</span>` : ''}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div>
    <div class="grid g2 mt">${card('Team-wide gaps', gaps.length ? gaps.map(x => `<div class="list-row"><b>${esc(x.s.name)}</b><span class="muted small">${x.below.length} of ${ps.length} below target</span></div>`).join('') : '<div class="muted small">No skill where half the team is below target.</div>')}
    ${card('Internal mentors', mentors.length ? mentors.map(x => `<div class="list-row small"><div><b>${esc(x.s.name)}</b>: ${esc(x.experts.map(p => p.profile.name).join(', '))} <span class="muted">could help</span> ${esc(x.below.filter(b => !x.experts.includes(b)).map(p => p.profile.name).join(', ') || '—')}</div></div>`).join('') : '<div class="muted small">Rate skills to see who could mentor whom.</div>')}</div>`;
}

/* ---------- Talent & succession ---------- */
function pgTalent() {
  const e = needPeople('Talent & succession'); if (e) return e;
  const ps = active(), tab = V.talTab || 'nine';
  const head = pageHead('Talent & succession', privacyNote) + `<div class="tabs">${[['nine', '9-box'], ['risk', 'Flight risk'], ['succession', 'Promotion readiness']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" onclick="V.talTab='${k}';render()">${l}</button>`).join('')}</div>`;
  if (tab === 'risk') {
    const rows = ps.filter(p => p.ninebox.risk).sort((a, b) => ['High', 'Medium', 'Low'].indexOf(a.ninebox.risk) - ['High', 'Medium', 'Low'].indexOf(b.ninebox.risk));
    return head + `<div class="card">${rows.length ? `<div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Reportee</th><th>Risk</th><th>Main factor</th><th>Key person</th><th>Last stay conversation</th><th>Retention actions</th></tr></thead><tbody>
      ${rows.map(p => { const s = [...p.stay].sort((a, b) => b.date.localeCompare(a.date))[0];
        return `<tr class="click" onclick="V.talentTab='placement';go('${personHref(p.id, 'talent')}')"><td>${personCell(p, esc(p.profile.designation || ''))}</td><td>${riskBadge(p.ninebox.risk)}</td><td class="small">${esc(p.ninebox.riskReason || '—')}</td><td>${p.talent.keyPerson ? '<span class="badge b-warn">Yes</span>' : '—'}</td>
          <td>${s ? fmt(s.date) : (['High', 'Medium'].includes(p.ninebox.risk) ? '<span class="badge b-bad">None</span>' : '—')}</td><td class="small">${esc(p.ninebox.retention || '—')}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="card-body">${emptyState('heart', 'No flight risk recorded', 'Set flight risk from each reportee’s Talent & retention page.')}</div>`}
      ${ps.some(p => !p.ninebox.risk) ? `<div class="card-foot" style="justify-content:flex-start"><span class="small muted">Not assessed: ${esc(ps.filter(p => !p.ninebox.risk).map(p => p.profile.name).join(', '))}</span></div>` : ''}</div>`;
  }
  if (tab === 'succession') {
    return head + `<div class="card"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Reportee</th><th>Grade → next</th><th>Readiness</th><th>Target role</th><th class="c">Above grade</th><th class="c">Below grade</th><th>Review says</th></tr></thead><tbody>
      ${ps.map(p => { const ck = latestCompCycle(p), it = ck ? p.comp[ck].items : {}, cs = FW()?.comps || [];
        const above = cs.filter(c => numVal(it[c.code]?.rating) !== null && numVal(it[c.code].rating) >= highV()).length, below = cs.filter(c => numVal(it[c.code]?.rating) !== null && numVal(it[c.code].rating) <= lowV()).length;
        const rv = Object.entries(p.reviews).sort().reverse().find(([, v]) => v.promo)?.[1];
        return `<tr class="click" onclick="V.talentTab='career';go('${personHref(p.id, 'talent')}')"><td>${personCell(p)}</td><td>${esc(p.grade || '—')}${nextGrade(p.grade) ? ` → ${esc(nextGrade(p.grade))}` : ''}</td>
          <td>${p.talent.readiness ? `<span class="badge ${p.talent.readiness === 'Ready now' ? 'b-good' : /1–2/.test(p.talent.readiness) ? 'b-acc' : ''}">${esc(p.talent.readiness)}</span>` : '<span class="muted">—</span>'}</td>
          <td class="small">${esc(p.talent.targetRole || '—')}</td><td class="c">${ck ? above : '–'}</td><td class="c">${ck ? (below ? `<span class="badge b-bad">${below}</span>` : 0) : '–'}</td><td class="small">${esc(rv?.promo || '—')}</td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="mt">${callout('info', `<b>Bench strength:</b> ${ps.filter(p => p.talent.readiness === 'Ready now').length} ready now · ${ps.filter(p => /1–2/.test(p.talent.readiness || '')).length} ready in 1–2 cycles · ${ps.filter(p => p.talent.keyPerson).length} key people to retain.`)}</div>`;
  }
  const cell = (perf, pot) => { const [n, a] = NINE[`${perf}-${pot}`], who = ps.filter(p => +p.ninebox.perf === perf && +p.ninebox.pot === pot);
    const bg = perf + pot >= 5 ? 'var(--good-bg)' : perf + pot <= 3 ? 'var(--bad-bg)' : 'var(--panel)';
    return `<div class="cell" style="background:${bg}"><h4>${n}</h4><p>${a}</p>${who.map(p => `<button class="chip" onclick="go('${personHref(p.id, 'talent')}')">${esc(p.profile.name)}${p.ninebox.risk === 'High' ? ' ⚠' : ''}</button>`).join('')}</div>`; };
  const un = ps.filter(p => !p.ninebox.perf || !p.ninebox.pot);
  return head + `<div class="card card-body"><div class="nine"><div class="axis y" style="grid-row:1/4">Potential →</div>${[3, 2, 1].map(pot => [1, 2, 3].map(perf => cell(perf, pot)).join('')).join('')}<div></div><div class="axis" style="grid-column:2/5">Performance →</div></div></div>
    ${un.length ? `<div class="mt">${callout('', `Not placed yet: ${un.map(p => `<a href="${personHref(p.id, 'talent')}">${esc(p.profile.name)}</a>`).join(', ')}. ⚠ marks high flight risk.`)}</div>` : ''}`;
}

/* ---------- Engagement ---------- */
function pgEngagement() {
  const e = needPeople('Engagement'); if (e) return e;
  const ps = active(), months = []; for (let i = 5; i >= 0; i--) months.push(addMonths(today().slice(0, 7) + '-01', -i).slice(0, 7));
  const rows = ps.map(p => { const m = moraleByMonth(p, months), known = m.filter(v => v != null); const last = known.slice(-1)[0], prev = known.slice(-2, -1)[0];
    return { p, m, last, trend: last != null && prev != null ? last - prev : null }; });
  const team = months.map((mo, i) => avg(rows.map(r => r.m[i]).filter(v => v != null)));
  return pageHead('Engagement', `Morale recorded in 1:1s over the last six months. ${privacyNote}`) +
    `<div class="grid g-auto">${[['Team average (latest)', team.filter(v => v != null).slice(-1)[0]], ['Low morale (≤2)', null, rows.filter(r => r.last != null && r.last <= 2).length], ['Falling since last month', null, rows.filter(r => r.trend != null && r.trend < 0).length], ['No morale recorded', null, rows.filter(r => r.last == null).length]]
      .map(([l, v, n]) => `<div class="card tile"><span class="label">${l}</span><span class="value">${v !== undefined && v !== null ? v.toFixed(1) : n ?? '—'}</span></div>`).join('')}</div>
    <div class="card mt"><div class="card-head"><h2>Morale by person</h2><span class="small muted">${fmtMonth(months[0])} – ${fmtMonth(months[5])}</span></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Reportee</th><th>Trend</th><th class="c">Latest</th><th class="c">Change</th><th>Last 1:1</th></tr></thead><tbody>
    <tr><td><b>Team</b></td><td>${spark(team, 160)}</td><td class="c"><b>${team.filter(v => v != null).slice(-1)[0]?.toFixed(1) ?? '—'}</b></td><td></td><td></td></tr>
    ${rows.sort((a, b) => (a.last ?? 9) - (b.last ?? 9)).map(r => `<tr class="click" onclick="go('${personHref(r.p.id, 'meetings')}')"><td>${personCell(r.p)}</td><td>${spark(r.m, 160)}</td>
      <td class="c">${r.last != null ? `<span class="badge ${r.last <= 2 ? 'b-bad' : r.last >= 4 ? 'b-good' : ''}">${r.last.toFixed(1)}</span>` : '—'}</td>
      <td class="c">${r.trend == null ? '—' : r.trend > 0 ? `<span style="color:var(--good)">▲ ${r.trend.toFixed(1)}</span>` : r.trend < 0 ? `<span style="color:var(--bad)">▼ ${(-r.trend).toFixed(1)}</span>` : '—'}</td>
      <td>${lastOne(r.p) ? fmt(lastOne(r.p).date) : '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------- Calibration ---------- */
function pgCalibration() {
  const e = needPeople('Calibration'); if (e) return e;
  const ps = active(), ck = V.calCycle || cycleOf().key, c = cycleByKey(ck), dist = S.settings.distribution;
  const rows = ps.map(p => { const rv = p.reviews[ck] || {}, cs = compStats(p.comp[ck]), gs = goalScore(p, ck), ks = kpiScore(p, ck), rating = +rv.rating || null, flags = [];
    const mid = FW() ? (lowV() + highV()) / 2 : null;
    if (!rating) flags.push(['No rating yet', '']);
    else {
      if (rating >= 4 && ((cs.avg != null && cs.avg < mid) || (gs != null && gs < 60))) flags.push(['Higher than evidence', 'b-warn']);
      if (rating <= 2 && ((cs.avg != null && cs.avg >= mid + .5) || (gs != null && gs >= 85))) flags.push(['Lower than evidence', 'b-warn']);
      if (+p.ninebox.perf === 3 && rating <= 2) flags.push(['9-box says high performer', 'b-warn']);
      if (+p.ninebox.perf === 1 && rating >= 4) flags.push(['9-box says low performer', 'b-warn']);
      if (activePip(p) && rating >= 3) flags.push(['On improvement plan', 'b-warn']);
    }
    if (FW() && !hasMgrRatings(p.comp[ck])) flags.push(['Competencies not assessed', '']);
    return { p, rv, cs, gs, ks, rating, flags }; });
  const rated = rows.filter(r => r.rating), done = rows.filter(r => r.rv.calibrated).length;
  return pageHead('Calibration', `Check that ratings are consistent with the evidence and with each other before you submit them. ${privacyNote}`, `<select class="input" style="width:auto" onchange="V.calCycle=this.value;render()">${opts(cycleOpts(), ck)}</select>`) +
    `<div class="card"><div class="card-head"><div><h2>Proposed ratings · ${esc(c.short)}</h2><p>${rated.length}/${rows.length} rated · ${done} calibrated. Changing a rating here updates the person’s review.</p></div></div>
    <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Reportee</th><th class="c">Competency avg</th><th class="c">Goals</th><th class="c">KPI</th><th>9-box</th><th>Rating</th><th>Checks</th><th class="c">Calibrated</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td><a href="${personHref(r.p.id, 'review')}" onclick="V.reviewCycle='${ck}'">${esc(r.p.profile.name)}</a><div class="sub">${esc(r.p.grade ? 'Grade ' + r.p.grade : '')}</div></td>
      <td class="c">${r.cs.avg != null ? r.cs.avg.toFixed(2) : '–'}</td><td class="c">${pct(r.gs)}</td><td class="c">${r.ks != null ? r.ks.toFixed(1) : '–'}</td><td class="small">${esc(nineOf(r.p)?.name || '–')}</td>
      <td><select onchange="setCalRating('${r.p.id}','${ck}',this.value)">${opts([['', '—'], ...Object.entries(RATING)], r.rating || '')}</select></td>
      <td>${r.flags.map(([t, cl]) => `<span class="badge ${cl}">${esc(t)}</span>`).join(' ') || '<span class="badge b-good">Consistent</span>'}</td>
      <td class="c"><input type="checkbox" ${r.rv.calibrated ? 'checked' : ''} ${r.rating ? '' : 'disabled'} onchange="setCalibrated('${r.p.id}','${ck}',this.checked)" aria-label="Calibrated"></td></tr>`).join('')}</tbody></table></div></div>
    <div class="grid g2 mt">${card('Distribution vs guideline', `<div class="dist">${[5, 4, 3, 2, 1].map(k => { const n = rated.filter(r => r.rating === k).length, act = rated.length ? n / rated.length * 100 : 0;
        return `<div class="dist-row"><span>${esc(RATING[k])}</span><div class="dist-bar"><i style="width:${act}%"></i><u style="left:calc(${clamp(+dist[k] || 0, 0, 100)}% - 1px)" title="Guideline ${dist[k]}%"></u></div><span class="small">${n} · ${Math.round(act)}% <span class="muted">/ ${dist[k]}%</span></span></div>`; }).join('')}</div>
        <p class="small muted mt">Bars show your team; the dark marker is the guideline. With a small team, treat the guideline as a sense-check, not a quota.</p>`, { actions: `<button class="btn sm" onclick="editDistribution()">Edit guideline</button>` })}
      ${card('Calibration checklist', ['Ratings are based on evidence from the whole cycle, not the last few weeks.', 'Similar performance at the same grade gets a similar rating.', 'Self-assessment differences have been discussed in a 1:1.', 'Ratings follow your organisation’s rating guidelines.', 'Anyone on an improvement plan has documented check-ins.'].map(t => `<div class="list-row small">${ic('check', 15, 'style="color:var(--good)"')}<span>${t}</span></div>`).join(''))}</div>`;
}
function setCalRating(pid, ck, v) { const p = getP(pid); p.reviews[ck] = { ...(p.reviews[ck] || {}), rating: v, calibrated: false, saved: today() }; save(); render(); }
function setCalibrated(pid, ck, v) { const p = getP(pid); p.reviews[ck] = { ...(p.reviews[ck] || {}), calibrated: v, calibratedOn: v ? today() : '' }; save(); render(); }
function editDistribution() {
  const d = S.settings.distribution;
  openModal({ title: 'Rating distribution guideline', sub: 'Percentages your organisation expects across ratings.', body: `<div class="fgrid">${[5, 4, 3, 2, 1].map(k => fld(RATING[k], 'r' + k, d[k], { type: 'number', attrs: 'min="0" max="100"' })).join('')}</div>`,
    onSave: f => { const n = {}; [1, 2, 3, 4, 5].forEach(k => n[k] = clamp(+f['r' + k] || 0, 0, 100)); const tot = Object.values(n).reduce((a, b) => a + b, 0);
      if (tot !== 100) { toast(`Percentages add up to ${tot}% — they should total 100%`, 'err'); return false; } S.settings.distribution = n; save(); } });
}

/* ---------- Monthly team report (printable, for your own manager / HR) ---------- */
function pgReport() {
  const e = needPeople('Team report'); if (e) return e;
  crumbs([['Insights'], ['Team report']]);
  const months = []; for (let i = 0; i < 6; i++) months.push(addMonths(today().slice(0, 7) + '-01', -i).slice(0, 7));
  const mo = V.repMonth || months[0], names = !!V.repNames, ps = active(), c = cycleOf(mo + '-15');
  const prevMo = addMonths(mo + '-01', -1).slice(0, 7), nextMo = addMonths(mo + '-01', 1).slice(0, 7);
  const inMo = d => d && d.startsWith(mo);
  const held = ps.filter(p => p.oneOnOnes.some(o => inMo(o.date)));
  const mor = m => avg(ps.flatMap(p => p.oneOnOnes.filter(o => o.date.startsWith(m) && +o.morale).map(o => +o.morale)));
  const mNow = mor(mo), mPrev = mor(prevMo);
  const risk = { High: ps.filter(p => p.ninebox.risk === 'High'), Medium: ps.filter(p => p.ninebox.risk === 'Medium') };
  const goals = ps.flatMap(p => p.goals.filter(g => goalCycle(g) === c.key && g.status !== 'Dropped').map(g => ({ ...g, p })));
  const gCount = s => goals.filter(g => g.status === s).length;
  const wins = ps.flatMap(p => p.feedback.filter(x => inMo(x.date) && ['Achievement', 'Kudos'].includes(x.type)).map(x => ({ ...x, p }))).sort((a, b) => a.date.localeCompare(b.date));
  const contrib = ps.flatMap(p => p.oneOnOnes.filter(o => inMo(o.date)).flatMap(o => [['orgtrain', 'ot_delivered', 'Session delivered'], ['orgcontrib', 'oc_initiatives', 'Initiative'], ['orgcontrib', 'oc_sharing', 'Knowledge sharing'], ['orgcontrib', 'oc_hiring', 'Recruitment'], ['orgcontrib', 'oc_mentoring', 'Mentoring'], ['certs', 'ce_done', 'Certification']]
    .filter(([t, q]) => answered(o.qa?.[t]?.[q])).map(([t, q, l]) => ({ p, l, text: o.qa[t][q] }))));
  const leave = ps.flatMap(p => p.leaves.filter(l => l.status !== 'Cancelled' && (l.from.startsWith(nextMo) || (l.to || l.from).startsWith(nextMo))).map(l => ({ ...l, p }))).sort((a, b) => a.from.localeCompare(b.from));
  const assessed = ps.filter(p => hasMgrRatings(p.comp[c.key])).length;
  const pips = ps.filter(p => activePip(p)).length;
  const who = list => names ? esc(list.map(p => p.profile.name).join(', ')) : '';
  const tile = (l, v, s) => `<div class="card tile"><span class="label">${l}</span><span class="value">${v}</span><span class="sub">${s}</span></div>`;
  const body = `<div class="grid g-auto">${tile('Team size', ps.length, `${plural(S.reportees.length - ps.length, 'archived')}`)}${tile(`1:1s in ${fmtMonth(mo)}`, `${held.length}/${ps.length}`, held.length === ps.length ? 'Everyone covered' : `${ps.length - held.length} missed`)}
      ${tile('Average morale', mNow != null ? mNow.toFixed(1) + ' / 5' : '—', mPrev != null && mNow != null ? `${mNow >= mPrev ? '▲' : '▼'} from ${mPrev.toFixed(1)} last month` : 'from 1:1s')}${tile('Flight risk', `${risk.High.length} high · ${risk.Medium.length} med`, names && (risk.High.length || risk.Medium.length) ? who([...risk.High, ...risk.Medium]) : 'names hidden')}</div>
    <div class="grid g2 mt">${card(`Goals · ${esc(c.short)}`, goals.length ? `<div class="dist">${['On track', 'At risk', 'Off track', 'Done'].map(s => `<div class="dist-row" style="grid-template-columns:110px 1fr 40px"><span>${s}</span><div class="dist-bar"><i style="width:${gCount(s) / goals.length * 100}%;${s === 'Off track' ? 'background:var(--bad)' : s === 'At risk' ? 'background:var(--warn)' : s === 'Done' ? 'background:var(--good)' : ''}"></i></div><span class="small">${gCount(s)}</span></div>`).join('')}</div>
        ${goals.filter(g => ['At risk', 'Off track'].includes(g.status)).length ? `<div class="sec-label mt">Needing attention</div><ul style="margin:0;padding-left:18px">${goals.filter(g => ['At risk', 'Off track'].includes(g.status)).map(g => `<li class="small">${esc(g.title)}${names ? ` — ${esc(g.p.profile.name)}` : ''} (${esc(g.status)})</li>`).join('')}</ul>` : ''}` : '<span class="muted small">No goals this cycle.</span>')}
      ${card('People processes', `<dl class="kv" style="grid-template-columns:200px 1fr"><dt>Competency assessments</dt><dd>${assessed}/${ps.length} done for ${esc(c.short)}</dd><dt>Development plans</dt><dd>${ps.filter(p => p.idp.some(i => !['Done', 'Deferred'].includes(i.status))).length}/${ps.length} with an active item</dd>
        <dt>Improvement plans</dt><dd>${pips ? `${pips} active` : 'None'}</dd><dt>1:1s missed</dt><dd>${held.length === ps.length ? '—' : names ? who(ps.filter(p => !held.includes(p))) : `${ps.length - held.length}`}</dd></dl>`)}</div>
    <div class="grid g2 mt">${card(`Highlights · ${fmtMonth(mo)}`, wins.length ? wins.map(x => `<div class="list-row small"><b class="nowrap">${fmtShort(x.date)}</b><div>${esc(x.p.profile.name)} — ${esc(x.sbi?.behaviour ? `${x.sbi.behaviour}${x.sbi.impact ? ' → ' + x.sbi.impact : ''}` : x.text.split('\n')[0])}</div></div>`).join('') : '<span class="muted small">No achievements or kudos logged this month.</span>')}
      ${card('Org contributions', contrib.length ? contrib.map(x => `<div class="list-row small"><span class="badge">${esc(x.l)}</span><div>${esc(x.p.profile.name)} — ${esc(x.text)}</div></div>`).join('') : '<span class="muted small">None recorded in 1:1s this month.</span>')}</div>
    <div class="mt">${card(`Leave planned · ${fmtMonth(nextMo)}`, leave.length ? `<table class="tbl"><tbody>${leave.map(l => `<tr><td>${esc(l.p.profile.name)}</td><td>${fmt(l.from)}${l.to && l.to !== l.from ? ' – ' + fmt(l.to) : ''}</td><td>${workDays(l.from, l.to || l.from)} days</td><td>${esc(l.type)}</td></tr>`).join('')}</tbody></table>` : '<span class="muted small">No leave recorded for next month.</span>', { flush: !!leave.length })}</div>`;
  V.repBody = `<h1 style="font-size:20px;margin:0 0 4px">Team report — ${fmtMonth(mo)}</h1><p class="muted" style="margin:0 0 14px">${esc(S.settings.managerName || '')} · ${plural(ps.length, 'reportee')} · generated ${fmt(today())}</p>${body}`;
  return pageHead('Team report', 'A one-page monthly summary to share upwards — with your own manager or HR. Names in sensitive sections are hidden unless you choose to show them.',
    `<select class="input" style="width:auto" onchange="V.repMonth=this.value;render()">${opts(months.map(m => [m, fmtMonth(m)]), mo)}</select><label class="check small">${'<input type="checkbox" ' + (names ? 'checked' : '') + ' onchange="V.repNames=this.checked;render()">'}Show names</label><button class="btn primary" onclick="printReport()">${ic('printer', 15)}Print / PDF</button>`) + body;
}
function printReport() { $('#print-root').innerHTML = `<div style="padding:8px 4px">${V.repBody || ''}<p class="small muted">Confidential — prepared with Team Desk.</p></div>`; setTimeout(() => window.print(), 50); }

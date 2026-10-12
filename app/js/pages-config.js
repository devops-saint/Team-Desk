/* =========================================================
   pages-config.js — competency framework, roles & KPIs,
   technical skills catalogue, organisation guidelines
   ========================================================= */
'use strict';

/* ---------- Competency framework ---------- */
function pgFramework(tab) {
  crumbs([['Configuration'], ['Competency framework']]);
  const fw = FW(), up = `<button class="btn ${fw ? '' : 'primary'}" onclick="pickFiles('.xlsx,.xls',false,f=>importFramework(f))">${ic('upload', 15)}${fw ? 'Upload new version' : 'Upload competency matrix'}</button>`;
  if (!fw) return pageHead('Competency framework', 'Your organisation’s competency matrix: what is expected at each grade.', up) + card('', emptyState('target', 'No framework loaded', 'Upload the competency matrix Excel file (Rating / Comments / Initials columns followed by one column per grade).'));
  const head = pageHead('Competency framework', `${esc(fw.name)} · ${fw.comps.length} competencies · ${fw.grades.length} grades`, up) +
    tabsNav([['expectations', 'Expectations by grade'], ['scale', 'Rating scale'], ['grades', 'Grades & team'], ['source', 'Source']], tab, k => `#/config/framework/${k}`);
  if (tab === 'scale') return head + card('Rating scale', `<p class="muted small" style="margin-top:0">The matrix uses ${esc(scale().map(s => s.v).join(' / '))}. Describe what each value means in your organisation — these labels appear wherever ratings are chosen.</p>
    ${scale().map((s, i) => `<div class="row mt-s" style="flex-wrap:nowrap"><span class="hc" style="${ratingStyle(s.v)};min-width:38px;padding:7px">${esc(s.v)}</span><input class="input" value="${esc(s.label)}" onchange="FW().scale[${i}].label=this.value;save()"></div>`).join('')}`);
  if (tab === 'grades') return head + `<div class="card"><div class="card-body flush"><table class="tbl"><thead><tr><th>Grade</th><th>Reportees</th></tr></thead><tbody>
    ${fw.grades.map(g => { const w = active().filter(p => p.grade === g); return `<tr><td><b>Grade ${esc(g)}</b></td><td>${w.length ? w.map(p => `<button class="chip" onclick="go('${personHref(p.id, 'competencies')}')">${esc(p.profile.name)}</button>`).join('') : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    ${active().some(p => !p.grade) ? `<div class="card-foot" style="justify-content:flex-start">${callout('warn', `No grade set: ${active().filter(p => !p.grade).map(p => `<a href="#" onclick="editProfile('${p.id}');return false">${esc(p.profile.name)}</a>`).join(', ')}`)}</div>` : ''}</div>`;
  if (tab === 'source') return head + card('Source file', `<dl class="kv"><dt>File</dt><dd>${esc(fw.file || '—')}</dd><dt>Loaded</dt><dd>${fmt(fw.imported)}</dd><dt>Sheet</dt><dd>${esc(fw.sheetName || '—')}</dd><dt>Groups</dt><dd>${esc(fw.groups.map(g => g.name).join(' · '))}</dd><dt>Grades</dt><dd>${esc(fw.grades.join(', '))}</dd></dl>
    <div class="mt">${callout('info', 'Uploading a new version keeps existing ratings, matched by competency code (C1, I2…). Download any reportee’s ratings in this same Excel layout from their Competencies page.')}</div>`);
  const g1 = V.fwGrade && fw.grades.includes(V.fwGrade) ? V.fwGrade : fw.grades[0], g2 = V.fwGrade2 || '';
  const groups = [...new Set(fw.comps.map(c => c.group))], gv = V.fwGroup && groups.includes(V.fwGroup) ? V.fwGroup : groups[0];
  const note = fw.groups.find(x => x.name === gv)?.note;
  return head + `<div class="card"><div class="card-head"><div class="row"><select class="input" style="width:auto" onchange="V.fwGrade=this.value;render()">${opts(fw.grades.map(g => [g, 'Grade ' + g]), g1)}</select>
      <span class="small muted">compare with</span><select class="input" style="width:auto" onchange="V.fwGrade2=this.value;render()">${opts([['', '—'], ...fw.grades.filter(g => g !== g1).map(g => [g, 'Grade ' + g])], g2)}</select></div>
      ${seg('fwGroup', groups.map(g => [g, g]), gv)}</div>
    ${note ? `<div class="card-body" style="border-bottom:1px solid var(--line)">${callout('info', esc(note))}</div>` : ''}
    <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th style="width:200px">Competency</th><th>Grade ${esc(g1)}</th>${g2 ? `<th>Grade ${esc(g2)}</th>` : ''}</tr></thead><tbody>
    ${fw.comps.filter(c => c.group === gv).map(c => `<tr><td style="vertical-align:top"><b>${esc(c.code)}</b> · ${esc(c.name)}</td><td class="small" style="vertical-align:top">${esc(c.desc[g1] || '—')}</td>${g2 ? `<td class="small" style="vertical-align:top">${esc(c.desc[g2] || '—')}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------- Roles & KPIs ---------- */
function pgRoles() {
  crumbs([['Configuration'], ['Roles & KPIs']]);
  return pageHead('Roles & KPIs', 'Roles carry numeric KPIs and expected technical-skill levels. Behavioural expectations come from the competency framework.', `<button class="btn primary" onclick="editRole()">${ic('plus', 15)}Add role</button>`) +
    `<div class="card">${S.roles.length ? `<div class="card-body flush"><table class="tbl"><thead><tr><th>Role</th><th class="c">KPIs</th><th class="c">Skill targets</th><th class="c">Reportees</th><th>KPI file</th></tr></thead><tbody>
    ${S.roles.map(r => `<tr class="click" onclick="go('#/config/roles/${r.id}')"><td><b>${esc(r.name)}</b>${r.desc ? `<div class="sub">${esc(r.desc)}</div>` : ''}</td><td class="c">${r.kpis.length}</td><td class="c">${Object.keys(r.skillTargets).length}</td><td class="c">${active().filter(p => p.roleId === r.id).length}</td><td class="small muted">${esc(r.kpiFile || '—')}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="card-body">${emptyState('clipboard', 'No roles yet', 'Add roles such as “Data Engineer” or “Team Lead”, then upload their KPI sheets when you receive them.', `<button class="btn primary" onclick="editRole()">Add role</button>`)}</div>`}</div>`;
}
function pgRole(id) {
  const r = S.roles.find(x => x.id === id);
  if (!r) { crumbs([['Configuration'], ['Roles & KPIs', '#/config/roles'], ['Not found']]); return card('', emptyState('clipboard', 'Role not found', '', '<a class="btn" href="#/config/roles">Back</a>')); }
  crumbs([['Configuration'], ['Roles & KPIs', '#/config/roles'], [r.name]]);
  const tab = V.roleTab || 'kpis';
  const head = pageHead(esc(r.name), esc(r.desc || ''), `<button class="btn" onclick="editRole('${r.id}')">${ic('edit', 15)}Rename</button><button class="btn danger" onclick="delRole('${r.id}')">${ic('trash', 15)}Delete</button>`, 'Role') +
    `<div class="tabs">${[['kpis', 'KPIs', r.kpis.length], ['targets', 'Skill targets', Object.keys(r.skillTargets).length]].map(([k, l, n]) => `<button class="tab ${tab === k ? 'on' : ''}" onclick="V.roleTab='${k}';render()">${l}<span class="count">${n}</span></button>`).join('')}</div>`;
  if (tab === 'targets') return head + `<div class="card"><div class="card-head"><div><h2>Expected technical skill levels</h2><p>Default targets for everyone in this role. You can override per person.</p></div></div>
    <div class="card-body"><form class="fgrid3" onchange="saveTargets('${r.id}',this)">${S.skills.map(s => sel(esc(s.name), s.id, SKILL_LEVELS.map((l, i) => [i, i ? l : 'Not required']), r.skillTargets[s.id] || 0)).join('')}</form></div></div>`;
  return head + `<div class="card"><div class="card-head"><div><h2>KPIs</h2><p>${esc(r.kpiFile ? 'Last uploaded: ' + r.kpiFile : 'Upload the KPI sheet (Excel/CSV with KPI, Target, Unit, Weight columns) or add manually.')}</p></div>
      <div class="row"><button class="btn sm" onclick="editKpi('${r.id}')">${ic('plus', 14)}Add KPI</button><button class="btn sm primary" onclick="uploadKpis('${r.id}')">${ic('upload', 14)}Upload KPI file</button></div></div>
    ${r.kpis.length ? `<div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>KPI</th><th>Target</th><th>Unit</th><th>Weight</th></tr></thead><tbody>
      ${r.kpis.map(k => `<tr class="click" onclick="editKpi('${r.id}','${k.id}')"><td><b>${esc(k.name)}</b>${k.desc ? `<div class="sub">${esc(k.desc)}</div>` : ''}</td><td>${esc(k.target || '—')}</td><td>${esc(k.unit || '')}</td><td>${k.weight ? esc(k.weight) + '%' : '—'}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card-body">${emptyState('bars', 'No KPIs yet', '')}</div>`}</div>`;
}
function editRole(id) {
  const r = id ? S.roles.find(x => x.id === id) : {};
  openModal({ title: id ? 'Edit role' : 'Add role', body: `<div class="fgrid">${fld('Role name', 'name', r.name, { req: true, cls: 'full' })}${area('Description', 'desc', r.desc, { rows: 2 })}</div>`,
    onSave: d => { if (!d.name) { toast('Name the role', 'err'); return false; } if (id) Object.assign(r, d); else { const nr = { id: uid(), ...d, kpis: [], skillTargets: {} }; S.roles.push(nr); setTimeout(() => go('#/config/roles/' + nr.id), 0); } save(); } });
}
function delRole(id) { confirmBox({ title: 'Delete role?', msg: 'Reportees with this role will have no role. KPI ratings already saved stay in their records.', onYes: () => { S.roles = S.roles.filter(r => r.id !== id); S.reportees.forEach(p => { if (p.roleId === id) p.roleId = ''; }); save(); setTimeout(() => go('#/config/roles'), 0); } }); }
function editKpi(rid, kid) {
  const r = S.roles.find(x => x.id === rid), k = kid ? r.kpis.find(x => x.id === kid) : {};
  openModal({ title: kid ? 'Edit KPI' : 'Add KPI', sub: esc(r.name), footLeft: kid ? `<button type="button" class="btn danger" onclick="delKpi('${rid}','${kid}')">Delete</button>` : '',
    body: `<div class="fgrid">${fld('KPI', 'name', k.name, { req: true, cls: 'full' })}${area('Description', 'desc', k.desc, { rows: 2 })}${fld('Target', 'target', k.target)}${fld('Unit', 'unit', k.unit, { ph: '%, count, days…' })}${fld('Weight (%)', 'weight', k.weight, { type: 'number' })}</div>`,
    onSave: d => { if (!d.name) return false; if (kid) Object.assign(k, d); else r.kpis.push({ id: uid(), ...d }); save(); } });
}
function delKpi(rid, kid) { const r = S.roles.find(x => x.id === rid); r.kpis = r.kpis.filter(k => k.id !== kid); save(); closeModal(); render(); }
function saveTargets(rid, form) { const r = S.roles.find(x => x.id === rid); r.skillTargets = {}; Object.entries(formObj(form)).forEach(([k, v]) => { if (+v) r.skillTargets[k] = +v; }); save(); }

/* ---------- Technical skills catalogue ---------- */
function pgSkillsCatalogue() {
  crumbs([['Configuration'], ['Technical skills']]);
  const cats = [...new Set(S.skills.map(s => s.cat))];
  return pageHead('Technical skills', 'Tools and technologies you rate each reportee on (1–5). Edit to match your team’s stack.', `<button class="btn primary" onclick="editSkill()">${ic('plus', 15)}Add skill</button>`) +
    `<div class="card"><div class="card-body flush"><table class="tbl"><thead><tr><th>Skill</th><th>Category</th><th class="c">People rated</th></tr></thead><tbody>
    ${cats.map(cat => S.skills.filter(s => s.cat === cat).map(s => `<tr class="click" onclick="editSkill('${s.id}')"><td><b>${esc(s.name)}</b></td><td>${esc(s.cat)}</td><td class="c">${S.reportees.filter(p => +p.skills[s.id]?.current).length}</td></tr>`).join('')).join('')}</tbody></table></div></div>`;
}
function editSkill(id) {
  const s = id ? S.skills.find(x => x.id === id) : { cat: 'Engineering' }, cats = [...new Set([...S.skills.map(x => x.cat), 'Data platform', 'Engineering', 'Analytics', 'Functional'])];
  openModal({ title: id ? 'Edit skill' : 'Add skill', footLeft: id ? `<button type="button" class="btn danger" onclick="delSkill('${id}')">Delete</button>` : '',
    body: `<div class="fgrid">${fld('Skill name', 'name', s.name, { req: true })}${fld('Category', 'cat', s.cat, { attrs: 'list="catlist"' })}</div><datalist id="catlist">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`,
    onSave: d => { if (!d.name) return false; d.cat = d.cat || 'Engineering'; if (id) Object.assign(s, d); else S.skills.push({ id: uid(), ...d }); save(); } });
}
function delSkill(id) { closeModal(); confirmBox({ title: 'Delete skill?', msg: 'Ratings for this skill will be removed from every reportee.', onYes: () => { S.skills = S.skills.filter(s => s.id !== id); S.reportees.forEach(p => delete p.skills[id]); S.roles.forEach(r => delete r.skillTargets[id]); save(); } }); }

/* ---------- Organisation guidelines ---------- */
function pgGuidelines() {
  crumbs([['Configuration'], ['Org guidelines']]);
  const q = (V.gq || '').trim(), cat = V.gcat || '';
  let hits = '';
  if (q.length >= 2) {
    const rx = new RegExp(escRe(q), 'gi'), res = [];
    S.guidelines.forEach(g => { let m, n = 0; rx.lastIndex = 0; while ((m = rx.exec(g.text)) && n < 3) { const a = Math.max(0, m.index - 110), b = Math.min(g.text.length, m.index + q.length + 110); res.push({ g, snip: g.text.slice(a, b) }); n++; } });
    hits = card(`${plural(res.length, 'match', 'matches')} for “${esc(q)}”`, res.length ? res.map(r => `<div class="list-row small"><div><a href="#" onclick="viewGuide('${r.g.id}');return false"><b>${esc(r.g.name)}</b></a><div>…${esc(r.snip).replace(new RegExp(escRe(esc(q)), 'gi'), m => `<mark>${m}</mark>`)}…</div></div></div>`).join('') : '<div class="muted">No matches.</div>', { cls: 'mb' });
  }
  const gs = S.guidelines.filter(g => !cat || g.category === cat);
  return pageHead('Org guidelines', 'Policies, review process and rating guidelines from HR — searchable, with the key rules pulled out.',
    `<select class="input" id="gcat" style="width:auto">${opts(G_CATS, G_CATS[0])}</select><button class="btn primary" onclick="pickFiles('.pdf,.docx,.xlsx,.xls,.csv,.txt,.md',true,fs=>uploadGuides(fs,$('#gcat').value))">${ic('upload', 15)}Upload</button>`) +
    `<div class="card mb card-body"><div class="search" style="width:100%">${ic('search', 15)}<input value="${esc(V.gq || '')}" placeholder="Search all guidelines — e.g. rating scale, timeline, promotion" onkeydown="if(event.key==='Enter'){V.gq=this.value;render()}" onchange="V.gq=this.value;render()"></div></div>${hits}
    <div class="card"><div class="card-head">${seg('gcat', [['', 'All'], ...G_CATS.map(c => [c, c])], cat)}</div>
    ${gs.length ? `<div class="card-body flush"><table class="tbl"><thead><tr><th>Document</th><th>Category</th><th class="c">Key points</th><th>Uploaded</th></tr></thead><tbody>
      ${gs.map(g => `<tr class="click" onclick="viewGuide('${g.id}')"><td><div class="row" style="flex-wrap:nowrap">${ic('file', 15, 'style="color:var(--muted)"')}<b>${esc(g.name)}</b></div></td><td>${esc(g.category)}</td><td class="c">${g.points.length}</td><td>${fmt(g.date)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card-body">${emptyState('book', 'No guidelines yet', 'Upload PDF, Word or Excel files from HR.')}</div>`}</div>`;
}
function viewGuide(id) {
  const g = S.guidelines.find(x => x.id === id);
  openDrawer({ title: g.name, sub: `${esc(g.category)} · ${fmt(g.date)}`,
    body: `${g.points.length ? `<div class="sec-label">Key points</div><ul style="margin:0 0 16px;padding-left:18px">${g.points.map(x => `<li class="small" style="margin-bottom:4px">${esc(x)}</li>`).join('')}</ul>` : ''}<div class="sec-label">Full text</div><div class="pre small">${esc(g.text)}</div>`,
    foot: `<button class="btn danger" onclick="delGuide('${g.id}')">${ic('trash', 15)}Delete</button><span class="grow"></span>${g.fileId ? `<button class="btn primary" onclick="Files.download('${ORG_OWNER}','${g.fileId}',${esc(JSON.stringify(g.name))})">${ic('download', 15)}Download</button>` : ''}` });
}
function delGuide(id) { closeDrawer(); confirmBox({ title: 'Delete guideline?', msg: 'The encrypted file will be removed.', onYes: async () => { const g = S.guidelines.find(x => x.id === id); if (g.fileId) await Files.del(ORG_OWNER, g.fileId); S.guidelines = S.guidelines.filter(x => x.id !== id); save(); } }); }

/* =========================================================
   fileio.js — reading uploads, document analysis, competency
   matrix import/export, KPI & guideline import, legacy import,
   upward-feedback questionnaire
   ========================================================= */
'use strict';

/* ---------- third-party readers: local copy first (npm install), CDN fallback ---------- */
const LIBS = {
  pdf: { local: '/vendor/pdf.min.js', cdn: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', get: () => window.pdfjsLib,
    worker: ['/vendor/pdf.worker.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'] },
  mammoth: { local: '/vendor/mammoth.browser.min.js', cdn: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', get: () => window.mammoth },
  xlsx: { local: '/vendor/xlsx.full.min.js', cdn: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', get: () => window.XLSX },
};
const libSource = {};
const addScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(); }; document.head.appendChild(s); });
async function loadLib(k) {
  const L = LIBS[k]; if (L.get()) return L.get();
  try { await addScript(L.local); libSource[k] = 'local'; }
  catch { try { await addScript(L.cdn); libSource[k] = 'cdn'; } catch { throw new Error('The file reader could not be loaded. Connect to the internet once, or run “npm install” in the Team Desk folder for offline use.'); } }
  return L.get();
}
async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (['txt', 'md', 'csv', 'json', 'rtf'].includes(ext)) return await file.text();
  if (ext === 'pdf') {
    const lib = await loadLib('pdf');
    lib.GlobalWorkerOptions.workerSrc = libSource.pdf === 'local' ? LIBS.pdf.worker[0] : LIBS.pdf.worker[1];
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise; let out = '';
    for (let i = 1; i <= pdf.numPages; i++) { const pg = await pdf.getPage(i); const tc = await pg.getTextContent(); out += tc.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n\n'; }
    return out;
  }
  if (ext === 'docx') { const m = await loadLib('mammoth'); return (await m.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value; }
  if (['xlsx', 'xls', 'ods'].includes(ext)) { const X = await loadLib('xlsx'); const wb = X.read(await file.arrayBuffer()); return wb.SheetNames.map(n => `## ${n}\n` + X.utils.sheet_to_csv(wb.Sheets[n])).join('\n\n'); }
  if (ext === 'doc') throw new Error('The old .doc format isn’t supported — save it as .docx or PDF.');
  throw new Error(`Unsupported file type .${ext}. Use PDF, Word (.docx), Excel (.xlsx/.csv) or text.`);
}
function pickFiles(accept, multiple, cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
  inp.onchange = () => { if (inp.files.length) cb(multiple ? [...inp.files] : inp.files[0]); };
  inp.click();
}

/* ---------- document analysis (local, rule-based) ---------- */
const CAT_RX = {
  training: /\b(training|course|certif\w*|workshop|upskill\w*|learn(ing)? (about|to|more)|mentor(ing|ship)?|coaching|bootcamp)\b/i,
  goal: /\b(goals?|objectives?|aim to|aspire|aspiration|plan to|planning to|target(s)? for|next (half|quarter|year|cycle)|would like to|want to|intend to|by (the )?end of|okrs?|looking forward to)\b/i,
  improvement: /\b(improve|improvement|need(s)? to|should|gaps?|weak\w*|challeng\w*|struggl\w*|lack\w*|delay\w*|missed|concerns?|could be better|area(s)? (of|for) (development|improvement)|work on|not yet|inconsistent|difficult\w*|slow)\b/i,
  achievement: /\b(achiev\w*|delivered|completed|launched|exceeded|won|awards?|recogni[sz]\w*|successfully|led the|reduced|increased|saved|implemented|resolved|shipped|automated|onboarded|closed)\b/i,
  strength: /\b(strengths?|strong|excellent|great|good at|skilled|expert\w*|proficient|reliable|proactive|appreciat\w*|outstanding|go-to|dependable|positive|quick learner|ownership)\b/i,
};
const DESTS = [['strength', 'Strengths'], ['devArea', 'Development areas'], ['goal', 'Goals (current cycle)'], ['idp', 'Development plan item'], ['achievement', 'Feedback log – achievement'], ['feedback', 'Feedback log – observation'], ['skip', 'Don’t place']];
const CAT_DEST = { training: 'idp', goal: 'goal', improvement: 'devArea', achievement: 'achievement', strength: 'strength', other: 'feedback' };
const CAT_LABEL = { training: 'Learning', goal: 'Goal', improvement: 'Improvement', achievement: 'Achievement', strength: 'Strength', other: 'Other' };
function guessDocType(text) {
  const t = text.slice(0, 4000);
  if (/self[\s-]?(assessment|appraisal|review|evaluation)/i.test(t)) return 'Self-assessment';
  if (/\b360\b|peer feedback|stakeholder feedback|feedback (from|for|on)/i.test(t)) return 'Feedback';
  const fp = (t.match(/\b(I|my|me|I'm|I've)\b/g) || []).length, tp = (t.match(/\b(he|she|they|his|her|their)\b/gi) || []).length;
  return fp > tp * 1.5 && fp > 5 ? 'Self-assessment' : tp > 5 ? 'Feedback' : 'Other';
}
function analyzeText(text, docType) {
  const sents = text.replace(/\r/g, '').split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map(s => s.trim().replace(/^[-•*●▪◦–\d.)\]\s]+/, '').trim())
    .filter(s => s.length >= 18 && s.length <= 450 && /[a-z]/i.test(s));
  const seen = new Set(), items = [];
  for (const s of sents) {
    const k = s.toLowerCase().replace(/\W+/g, ' '); if (seen.has(k)) continue; seen.add(k);
    let cat = 'other'; for (const c of ['training', 'goal', 'improvement', 'achievement', 'strength']) if (CAT_RX[c].test(s)) { cat = c; break; }
    if (cat === 'other' && (docType === 'Self-assessment' || s.split(' ').length < 6)) continue;
    items.push({ cat, text: s }); if (items.length >= 80) break;
  }
  return items;
}
async function uploadDocs(pid, files, forced = 'auto') {
  const p = getP(pid);
  for (const file of files) {
    toast(`Reading ${file.name}…`, '', 1500);
    if (FW() && /\.(xlsx|xls)$/i.test(file.name)) {
      let m = null; try { m = await readMatrixFile(file); } catch {}
      if (m && Object.values(m.ratings).some(r => r.rating || r.comment)) { await importFilledMatrix(pid, file, m, { whose: forced === 'Feedback' ? 'mine' : 'self' }); continue; }
    }
    let text;
    try { text = await extractText(file); } catch (e) { toast(e.message, 'err', 5000); continue; }
    if (!text.trim()) { toast(`No readable text in ${file.name} — it may be a scanned image.`, 'err', 5000); continue; }
    const others = S.reportees.filter(o => o.id !== pid && o.profile.name && o.profile.name.trim().split(/\s+/).length > 1 && new RegExp('\\b' + escRe(o.profile.name.trim()) + '\\b', 'i').test(text));
    const docType = forced === 'auto' ? guessDocType(text) : forced;
    const doc = { id: uid(), name: file.name, docType, date: today(), text, owner: pid, placed: null };
    try { await Files.put(pid, doc.id, file); doc.fileId = doc.id; } catch (e) { toast('Original file not stored: ' + e.message, 'err'); }
    p.docs.push(doc); save();
    await placementDialog(p, doc, others);
    await analyseDocument(pid, doc.id);
  }
  render();
}
function placementDialog(p, doc, others = []) {
  return new Promise(resolve => {
    const items = analyzeText(doc.text, doc.docType);
    const warn = others.length ? callout('warn', `This file mentions <b>${esc(others.map(o => o.profile.name).join(', '))}</b>. It is stored only under <b>${esc(p.profile.name)}</b>. Untick any lines about other people.`) : '';
    openModal({
      title: 'Place insights from document', sub: `${esc(doc.name)} · detected as ${esc(doc.docType)} · ${plural(items.length, 'point')} found`, size: 'xwide', saveText: 'Place selected', cancelText: 'Skip for now',
      body: `${warn}<div class="row"><button type="button" class="btn sm" onclick="$$('.pl-chk').forEach(c=>c.checked=true)">Select all</button><button type="button" class="btn sm" onclick="$$('.pl-chk').forEach(c=>c.checked=false)">Clear</button><span class="small muted">Check where each point should go. Nothing is filed until you confirm.</span></div>
        <div class="card"><div class="card-body flush"><table class="tbl"><thead><tr><th style="width:36px"></th><th>Point</th><th style="width:230px">Place in</th></tr></thead><tbody>
        ${items.length ? items.map((it, i) => `<tr><td><input type="checkbox" class="pl-chk" data-i="${i}" ${it.cat !== 'other' ? 'checked' : ''}></td><td><span class="badge">${CAT_LABEL[it.cat]}</span> ${esc(it.text)}</td><td><select data-d="${i}" style="width:100%">${opts(DESTS, CAT_DEST[it.cat])}</select></td></tr>`).join('')
          : `<tr><td colspan="3" class="muted">No clear points were found. The full text is still available under Documents.</td></tr>`}</tbody></table></div></div>`,
      onSave: (d, f) => {
        const placed = {}, src = `${doc.docType}: ${doc.name}`, fbSource = doc.docType === 'Self-assessment' ? 'Self' : 'Peer';
        items.forEach((it, i) => {
          if (!f.querySelector(`[data-i="${i}"]`).checked) return;
          const dest = f.querySelector(`[data-d="${i}"]`).value; if (dest === 'skip') return;
          placed[dest] = (placed[dest] || 0) + 1;
          if (dest === 'strength') p.strengths.push({ id: uid(), text: it.text, source: src, date: today() });
          if (dest === 'devArea') p.devAreas.push({ id: uid(), text: it.text, source: src, date: today() });
          if (dest === 'goal') p.goals.push({ id: uid(), title: it.text.slice(0, 140), desc: it.text.length > 140 ? it.text : '', category: 'Development', cycle: cycleOf().key, status: 'On track', progress: 0, start: today(), source: src, updates: [] });
          if (dest === 'idp') p.idp.push({ id: uid(), title: it.text.slice(0, 160), type: 'Training / course', status: 'Planned', notes: `From ${src}`, created: today() });
          if (dest === 'achievement' || dest === 'feedback') p.feedback.push({ id: uid(), date: today(), type: dest === 'achievement' ? 'Achievement' : 'Observation', source: fbSource, from: doc.name, text: it.text });
        });
        doc.placed = placed; save();
        toast(`Placed ${Object.values(placed).reduce((a, b) => a + b, 0)} item(s)`);
      },
      onClose: resolve,
    });
  });
}

/* ---------- competency matrix (org Excel layout) ---------- */
const CODE_RX = /^[A-Z]{1,3}\d{1,2}$/i;
function parseMatrixRows(rows) {
  const hi = rows.findIndex(r => r.some(c => /^rating$/i.test(String(c).trim())));
  if (hi < 0) return null;
  const h = rows[hi].map(c => String(c).trim());
  const rc = h.findIndex(c => /^rating$/i.test(c)), cc = h.findIndex(c => /comment/i.test(c)), icx = h.findIndex(c => /initial/i.test(c));
  const lastCol = Math.max(rc, cc, icx), gcols = h.map((c, i) => i).filter(i => i > lastCol && h[i]);
  if (!gcols.length) return null;
  const grades = gcols.map(i => h[i]), groups = [], comps = [], ratings = {}, sc = [];
  let cur = '', inScale = false;
  for (const r of rows.slice(hi + 1)) {
    const cell = i => i >= 0 ? String(r[i] ?? '').trim() : '';
    const a = cell(0), b = cell(1);
    if (/^score$/i.test(cell(rc))) { inScale = true; continue; }
    if (inScale) { const v = cell(rc); if (v) sc.push({ v: v.toUpperCase(), label: cell(cc) }); continue; }
    if (CODE_RX.test(a) && b) {
      const code = a.toUpperCase(), desc = {};
      grades.forEach((g, k) => { const t = cell(gcols[k]); if (t) desc[g] = t; });
      comps.push({ code, name: b, group: cur, desc });
      let rv = cell(rc); rv = numVal(rv) !== null ? String(Math.round(+rv)) : rv.toUpperCase(); if (rv.startsWith('#')) rv = '';
      ratings[code] = { rating: rv, comment: cell(cc), by: cell(icx) };
    } else if ((a || b) && !CODE_RX.test(a)) {
      cur = a || b; groups.push({ name: cur, note: gcols.map(i => cell(i)).filter(Boolean).join(' ') });
    }
  }
  if (comps.length < 3) return null;
  return { grades, groups, comps, ratings, scale: sc };
}
async function readMatrixFile(file) {
  const X = await loadLib('xlsx'), wb = X.read(await file.arrayBuffer());
  for (const n of wb.SheetNames) {
    const m = parseMatrixRows(X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', blankrows: false }));
    if (m) { m.sheetName = n; return m; }
  }
  return null;
}
async function importFramework(file, m) {
  try { m = m || await readMatrixFile(file); } catch (e) { return toast(e.message, 'err', 5000); }
  if (!m) return toast('Couldn’t find the competency layout (a header row with Rating, Comments, Initials and grade columns).', 'err', 5000);
  const cur = FW(), added = cur ? m.comps.filter(c => !compByCode(c.code)).map(c => c.code) : [], removed = cur ? cur.comps.filter(c => !m.comps.some(x => x.code === c.code)).map(c => c.code) : [];
  openModal({
    title: 'Load competency framework', sub: esc(file.name), saveText: cur ? 'Replace framework' : 'Load framework',
    body: `<div>Found <b>${m.comps.length} competencies</b> in ${m.groups.length} groups across grades <b>${esc(m.grades.join(', '))}</b>.</div>
      ${cur ? callout('info', `This replaces the current framework. Ratings already given are kept and matched by competency code.${added.length ? ` New: ${esc(added.join(', '))}.` : ''}${removed.length ? ` No longer present: ${esc(removed.join(', '))}.` : ''}`) : ''}
      ${Object.values(m.ratings).some(r => r.rating) ? callout('warn', 'This file also contains ratings. They are ignored here — import someone’s ratings from their Competencies page.') : ''}`,
    onSave: () => {
      const old = cur?.scale || DEFAULT_SCALE;
      const sc = (m.scale.length ? m.scale : DEFAULT_SCALE).map(s => ({ v: s.v, label: s.label || old.find(o => o.v === s.v)?.label || DEFAULT_SCALE.find(o => o.v === s.v)?.label || '' }));
      S.framework = { name: file.name.replace(/\.[^.]+$/, '').replace(/^\d+_/, '').replace(/_/g, ' '), file: file.name, imported: today(), sheetName: m.sheetName, grades: m.grades, groups: m.groups, comps: m.comps, scale: sc };
      save(); toast('Competency framework loaded');
    },
  });
}
function importFilledMatrix(pid, file, m, o = {}) {
  return new Promise(async resolve => {
    if (!FW()) { toast('Load the competency framework first.', 'err'); return resolve(); }
    try { m = m || await readMatrixFile(file); } catch (e) { toast(e.message, 'err'); return resolve(); }
    if (!m) { toast('This file doesn’t look like the competency matrix.', 'err'); return resolve(); }
    const p = getP(pid), found = Object.entries(m.ratings).filter(([, r]) => r.rating || r.comment);
    if (!found.length) { toast('No ratings or comments found — the matrix looks blank.', 'err'); return resolve(); }
    const known = found.filter(([c]) => compByCode(c)), unknown = found.filter(([c]) => !compByCode(c));
    const fl = file.name.toLowerCase(), mineName = firstName(p.profile.name).toLowerCase();
    const others = S.reportees.filter(x => x.id !== pid && x.profile.name && fl.includes(firstName(x.profile.name).toLowerCase()) && !fl.includes(mineName));
    openModal({
      title: 'Import competency ratings', sub: `${esc(file.name)} → ${esc(p.profile.name)}`, size: 'wide', saveText: 'Import ratings',
      body: `${others.length ? callout('warn', `The file name looks like it belongs to <b>${esc(others.map(x => x.profile.name).join(', '))}</b>. Check before importing into ${esc(p.profile.name)}.`) : ''}
        <div class="fgrid">${sel('These ratings are', 'whose', [['self', `${firstName(p.profile.name)}’s self-assessment`], ['mine', 'My assessment of them']], o.whose || 'self')}${sel('Review cycle', 'cycle', cycleOpts(), o.cycle || V.compCycle || cycleOf().key)}</div>
        <div class="small muted">${known.length} competencies with ratings or comments${unknown.length ? ` · skipped (not in framework): ${esc(unknown.map(u => u[0]).join(', '))}` : ''}. Existing values for these will be replaced.</div>
        <div class="card"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Competency</th><th class="c">Rating</th><th>Comment</th></tr></thead><tbody>
        ${known.map(([c, r]) => `<tr><td>${esc(c)} · ${esc(compByCode(c).name)}</td><td class="c">${ratingChip(r.rating)}</td><td class="small">${esc(r.comment)}</td></tr>`).join('')}</tbody></table></div></div>`,
      onSave: async d => {
        const rec = ensureComp(p, d.cycle);
        known.forEach(([c, r]) => {
          const it = rec.items[c] = rec.items[c] || {};
          if (d.whose === 'self') { if (r.rating) it.self = r.rating; if (r.comment) it.selfComment = r.comment; }
          else { if (r.rating) it.rating = r.rating; if (r.comment) it.comment = r.comment; if (r.by) it.by = r.by; }
        });
        rec.updated = today();
        const doc = { id: uid(), name: file.name, owner: pid, date: today(), docType: d.whose === 'self' ? 'Self-assessment (competency matrix)' : 'Competency matrix',
          text: known.map(([c, r]) => `${c} ${compByCode(c).name}: ${r.rating || '—'}${r.comment ? ' — ' + r.comment : ''}`).join('\n'), placed: { [d.whose === 'self' ? 'selfRatings' : 'mgrRatings']: known.length } };
        try { await Files.put(pid, doc.id, file); doc.fileId = doc.id; } catch {}
        p.docs.push(doc);
        V.compCycle = d.cycle; save(); toast(`Imported ${known.length} competency ratings`);
      },
      onClose: resolve,
    });
  });
}
function matrixAoa(rec, field, commentField) {
  const fw = FW(), aoa = [['Grades', '', 'Rating', 'Comments', 'Initials', ...fw.grades]];
  [...new Set(fw.comps.map(c => c.group))].forEach(gn => {
    if (gn) { const g = fw.groups.find(x => x.name === gn); aoa.push([gn, '', '', '', '', ...(g?.note ? [g.note] : [])]); }
    fw.comps.filter(c => c.group === gn).forEach(c => { const it = rec?.items?.[c.code] || {}, v = it[field];
      aoa.push([c.code, c.name, v ? (numVal(v) !== null ? +v : v) : '', it[commentField] || '', field === 'rating' ? (it.by || '') : '', ...fw.grades.map(g => c.desc[g] || '')]); });
  });
  const st = compStats(rec, field);
  aoa.push(['', '', st.avg !== null ? +st.avg.toFixed(2) : ''], ['', '', 'Score'], ...scale().map(s => ['', '', numVal(s.v) !== null ? +s.v : s.v, s.label]));
  return aoa;
}
async function exportCompXlsx(pid, ck) {
  let X; try { X = await loadLib('xlsx'); } catch (e) { return toast(e.message, 'err'); }
  const p = getP(pid), fw = FW(), rec = p.comp[ck] || { items: {} }, c = cycleByKey(ck);
  const cols = [{ wch: 8 }, { wch: 30 }, { wch: 8 }, { wch: 40 }, { wch: 9 }, ...fw.grades.map(() => ({ wch: 45 }))];
  const wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(matrixAoa(rec, 'rating', 'comment')); ws['!cols'] = cols;
  X.utils.book_append_sheet(wb, ws, (fw.sheetName || 'Competency_Matrix').slice(0, 31));
  if (compStats(rec, 'self').rated) { const s2 = X.utils.aoa_to_sheet(matrixAoa(rec, 'self', 'selfComment')); s2['!cols'] = cols; X.utils.book_append_sheet(wb, s2, 'Self assessment'); }
  const ms = compStats(rec), ss = compStats(rec, 'self');
  const sum = X.utils.aoa_to_sheet([['Name', p.profile.name], ['Employee ID', p.profile.empId || ''], ['Designation', p.profile.designation || ''], ['Grade', rec.grade || p.grade || ''], ['Review cycle', c.label],
    ['Manager average', ms.avg !== null ? +ms.avg.toFixed(2) : ''], ['Self average', ss.avg !== null ? +ss.avg.toFixed(2) : ''], ['Rated', `${ms.rated} of ${fw.comps.length}`], ['Assessed by', S.settings.managerName || ''], ['Exported', fmt(today())]]);
  sum['!cols'] = [{ wch: 18 }, { wch: 40 }];
  X.utils.book_append_sheet(wb, sum, 'Summary');
  X.writeFile(wb, safeName(`Competency_Matrix_${p.profile.name}_${c.short}.xlsx`));
}

/* ---------- KPI sheet import ---------- */
function uploadKpis(rid) {
  pickFiles('.xlsx,.xls,.csv,.docx,.pdf,.txt', false, async file => {
    const r = S.roles.find(x => x.id === rid); let kpis = [];
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        const X = await loadLib('xlsx');
        if (ext !== 'csv') { const m = await readMatrixFile(file); if (m) { toast('That file is a competency matrix — loading it as your framework instead.'); return importFramework(file, m); } }
        const wb = ext === 'csv' ? X.read(await file.text(), { type: 'string' }) : X.read(await file.arrayBuffer());
        const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).filter(rw => rw.some(c => String(c).trim()));
        const hi = rows.findIndex(rw => rw.some(c => /kpi|metric|measure|objective|name/i.test(String(c))));
        const hdr = hi >= 0 ? rows[hi].map(c => String(c).toLowerCase()) : [], col = rx => hdr.findIndex(h => rx.test(h));
        const ci = { name: Math.max(0, col(/kpi|metric|measure|objective|name|parameter/)), desc: col(/desc|definition|detail/), target: col(/target|goal|threshold|expected/), unit: col(/unit|uom/), weight: col(/weight|%age|weightage/) };
        kpis = rows.slice(hi + 1).map(rw => ({ id: uid(), name: String(rw[ci.name] || '').trim(), desc: ci.desc >= 0 ? String(rw[ci.desc]).trim() : '', target: ci.target >= 0 ? String(rw[ci.target]).trim() : '', unit: ci.unit >= 0 ? String(rw[ci.unit]).trim() : '', weight: ci.weight >= 0 ? String(rw[ci.weight]).replace('%', '').trim() : '' })).filter(k => k.name);
      } else {
        kpis = (await extractText(file)).split(/\n+/).map(l => l.trim().replace(/^[-•*●\d.)\s]+/, '')).filter(l => l.length > 3 && l.length < 200).slice(0, 40).map(l => ({ id: uid(), name: l, desc: '', target: '', unit: '', weight: '' }));
      }
    } catch (e) { return toast(e.message, 'err', 5000); }
    if (!kpis.length) return toast('No KPIs found in that file.', 'err');
    openModal({ title: `Import KPIs into ${r.name}`, sub: `${esc(file.name)} · ${kpis.length} found`, size: 'wide', saveText: 'Import selected',
      body: `${r.kpis.length ? chk(`Replace the ${r.kpis.length} existing KPIs`, 'replace', false) : ''}<div class="card"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th></th><th>KPI</th><th>Target</th><th>Unit</th><th>Weight</th></tr></thead><tbody>
        ${kpis.map((k, i) => `<tr><td><input type="checkbox" data-k="${i}" checked></td><td>${esc(k.name)}${k.desc ? `<div class="sub">${esc(k.desc)}</div>` : ''}</td><td>${esc(k.target)}</td><td>${esc(k.unit)}</td><td>${esc(k.weight)}</td></tr>`).join('')}</tbody></table></div></div>`,
      onSave: (d, f) => { const pick = kpis.filter((k, i) => f.querySelector(`[data-k="${i}"]`).checked); r.kpis = d.replace ? pick : [...r.kpis, ...pick]; r.kpiFile = `${file.name} · ${fmt(today())}`; save(); toast(`Imported ${pick.length} KPIs`); } });
  });
}

/* ---------- organisation guidelines ---------- */
const G_CATS = ['Review / rating guidelines', 'HR policy', 'Process / SOP', 'Training / L&D', 'Other'];
const keyPoints = text => text.split(/\n+|(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 25 && s.length < 350 && /\b(must|should|shall|mandatory|required|deadline|due|timeline|rating|weightage|eligib\w*|criteria|not allowed|by \d|within \d)\b/i.test(s)).slice(0, 30);
async function uploadGuides(files, category) {
  for (const file of files) {
    try {
      toast(`Reading ${file.name}…`, '', 1500);
      const text = await extractText(file), id = uid();
      await Files.put(ORG_OWNER, id, file);
      S.guidelines.push({ id, fileId: id, owner: ORG_OWNER, name: file.name, category, date: today(), text, points: keyPoints(text) });
    } catch (e) { toast(e.message, 'err', 5000); }
  }
  save(); render();
}

/* ---------- import from Team Desk v1/v2 (browser version) backup ---------- */
const b64ToBytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function legacyDecrypt(j, pass) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64ToBytes(j.salt), iterations: 250000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(j.iv) }, k, b64ToBytes(j.data))));
}
function importLegacy(file, done) {
  file.text().then(txt => {
    let j; try { j = JSON.parse(txt); } catch { return toast('That isn’t a Team Desk backup file.', 'err'); }
    if (j.app !== 'teamdesk' || !(j.state || j.encrypted)) return toast('That isn’t a Team Desk backup file.', 'err');
    const apply = data => openModal({
      title: 'Import data from previous version', sub: esc(file.name), saveText: 'Import and replace',
      body: `<div>The backup contains <b>${plural((data.state.reportees || []).length, 'reportee')}</b>${data.exported ? ` and was exported on ${fmt(data.exported.slice(0, 10))}` : ''}.</div>${callout('warn', 'This replaces everything currently in Team Desk. A snapshot of the current data is kept in your data folder’s backups.')}`,
      onSave: async () => {
        await api('POST', '/api/backups').catch(() => {});
        const st = data.state; migrate(st);
        let n = 0;
        for (const [id, f] of Object.entries(data.files || {})) {
          const owner = st.guidelines.some(g => g.fileId === id) ? ORG_OWNER : (st.reportees.find(p => p.docs.some(d => d.fileId === id))?.id);
          if (!owner) continue;
          try { await Files.put(owner, id, new File([b64ToBytes(f.data)], f.name, { type: f.type || 'application/octet-stream' })); n++; } catch {}
        }
        st.reportees.forEach(p => p.docs.forEach(d => { d.owner = p.id; }));
        st.guidelines.forEach(g => { g.owner = ORG_OWNER; });
        S = st; save(); await Store.flush();
        toast(`Imported ${plural(st.reportees.length, 'reportee')} and ${plural(n, 'file')}`);
        done && done();
      },
    });
    if (j.encrypted) openModal({ title: 'Backup password', sub: 'This backup was protected with a password when it was exported.', saveText: 'Unlock backup',
      body: fld('Backup password', 'pass', '', { type: 'password' }),
      onSave: async d => { let data; try { data = await legacyDecrypt(j, d.pass); } catch { toast('Wrong password', 'err'); return false; } setTimeout(() => apply(data), 30); } });
    else apply(j);
  });
}

/* ---------- upward feedback questionnaire (standalone, anonymous) ---------- */
function upwardSurveyHtml(ck, surveyId) {
  const c = cycleByKey(ck), mgr = S.settings.managerName || 'your manager';
  const qs = LEADERSHIP_COMPS.map(x => ({ id: x.id, text: 'My manager ' + x.desc[0].toLowerCase() + x.desc.slice(1) }));
  const data = JSON.stringify({ surveyId, cycle: ck, qs });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anonymous feedback for ${esc(mgr)}</title>
<style>:root{--a:#2952cc}body{margin:0;background:#f4f6f9;color:#101828;font:15px/1.55 -apple-system,"Segoe UI",Roboto,Arial,sans-serif}main{max-width:760px;margin:0 auto;padding:28px 16px 60px}
.card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:20px 22px;margin-bottom:14px}h1{font-size:22px;margin:0 0 6px}.muted{color:#667085}
.q{padding:14px 0;border-bottom:1px solid #eef0f3}.q:last-child{border-bottom:0}.opts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.opts label{border:1px solid #d0d5dd;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13.5px}.opts input{display:none}.opts input:checked+span{color:var(--a);font-weight:600}
.opts label:has(input:checked){border-color:var(--a);background:#eef2fd}textarea{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:8px;padding:10px;font:inherit;min-height:80px}
button{background:var(--a);color:#fff;border:0;border-radius:9px;padding:12px 20px;font:inherit;font-weight:600;cursor:pointer}.note{background:#eef2fd;border-radius:9px;padding:12px 14px;font-size:14px}</style></head>
<body><main><div class="card"><h1>Anonymous feedback for ${esc(mgr)}</h1><p class="muted">${esc(c.label)}</p>
<div class="note">This form asks for no name or email. Your answers are saved to a file on your computer that you send back however you prefer. Results are only shown once at least ${+S.settings.upwardMin || 3} people have responded, and only as averages.</div></div>
<form id="f"><div class="card"><p class="muted">How often does each statement describe your experience? Choose “Don’t know” if you haven’t seen it.</p><div id="qs"></div></div>
<div class="card"><p><b>What should I start doing?</b></p><textarea name="start"></textarea><p><b>What should I stop doing?</b></p><textarea name="stop"></textarea><p><b>What should I continue doing?</b></p><textarea name="cont"></textarea></div>
<button type="submit">Save my response</button> <span class="muted" id="msg"></span></form></main>
<script>const D=${data.replace(/</g, '\\u003c')};const L=[['1','Rarely'],['2','Sometimes'],['3','Often'],['4','Usually'],['5','Consistently'],['','Don\\u2019t know']];
document.getElementById('qs').innerHTML=D.qs.map(q=>'<div class="q"><div>'+q.text+'</div><div class="opts">'+L.map(l=>'<label><input type="radio" name="'+q.id+'" value="'+l[0]+'"><span>'+(l[0]?l[0]+' · ':'')+l[1]+'</span></label>').join('')+'</div></div>').join('');
document.getElementById('f').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target),a={};D.qs.forEach(q=>{const v=fd.get(q.id);if(v)a[q.id]=+v;});
if(!Object.keys(a).length){alert('Please answer at least one statement.');return;}const r=crypto.getRandomValues(new Uint32Array(2)).join('').slice(0,12);
const out={app:'teamdesk-upward',surveyId:D.surveyId,cycle:D.cycle,responseId:r,answers:a,comments:{start:fd.get('start')||'',stop:fd.get('stop')||'',continue:fd.get('cont')||''}};
const b=new Blob([JSON.stringify(out)],{type:'application/json'}),u=document.createElement('a');u.href=URL.createObjectURL(b);u.download='feedback-response-'+r+'.json';u.click();
document.getElementById('msg').textContent='Saved. Send the downloaded file back the way your manager asked — you can then close this page.';};<\/script></body></html>`;
}
function exportUpwardSurvey(ck) {
  const up = S.leadership.upward[ck] = S.leadership.upward[ck] || { responses: [] };
  if (!up.surveyId) { up.surveyId = uid(); up.created = today(); }
  save();
  downloadBlob(new Blob([upwardSurveyHtml(ck, up.surveyId)], { type: 'text/html' }), `Anonymous_feedback_${safeName(cycleByKey(ck).short)}.html`);
  toast('Questionnaire downloaded — share it with your team');
}
async function importUpward(ck, files) {
  const up = S.leadership.upward[ck] = S.leadership.upward[ck] || { responses: [] };
  let added = 0, dup = 0, wrong = 0, bad = 0;
  for (const f of files) {
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== 'teamdesk-upward') { bad++; continue; }
      if (up.surveyId && j.surveyId !== up.surveyId) { wrong++; continue; }
      if (up.responses.some(r => r.responseId === j.responseId)) { dup++; continue; }
      up.responses.push({ responseId: j.responseId, received: today().slice(0, 7), answers: j.answers || {}, comments: j.comments || {} }); added++;
    } catch { bad++; }
  }
  save(); render();
  toast([`${plural(added, 'response')} added`, dup && `${dup} already imported`, wrong && `${wrong} from a different questionnaire`, bad && `${bad} unreadable`].filter(Boolean).join(' · '), wrong || bad ? 'err' : '', 5000);
}

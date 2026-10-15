/* =========================================================
   teamfb.js — anonymous feedback from your own team about
   you and how the team works. Download an editable Word or
   Excel form, share it, upload the filled forms (or paste
   the text). Each answer is sorted into Appreciation,
   Improvement and Other.

   Anonymity by design:
   - the form has no name or email field;
   - only the answer text is read from an uploaded file — never
     the document properties (author, "last modified by"),
     comments or tracked changes — and the file and its name
     are not kept;
   - no upload time is kept per response, responses are stored
     in random order, and nothing is shown until the minimum
     number of responses (Settings) is reached;
   - results are shown per question and per category, shuffled,
     never as one person's complete form.
   ========================================================= */
'use strict';

const TF_DEFAULT_Q = [
  { q: 'What do I do as your manager that helps you most? What should I keep doing?', hint: 'positive' },
  { q: 'What should I start doing, or do differently, to support you better?', hint: 'improve' },
  { q: 'Is there anything I should stop doing?', hint: 'improve' },
  { q: 'Do you get clear priorities, enough context and timely decisions from me? Please give an example.', hint: '' },
  { q: 'How well do our team processes work for you (planning, 1:1s, stand-ups, reviews, hand-offs)? What would you change?', hint: '' },
  { q: 'What is working well in how our team works together?', hint: 'positive' },
  { q: 'Is there anything else you would like me to know?', hint: '' },
];
const TF_PLACEHOLDER = 'Type your answer here.';
const TF_END = '— End of form —';

function tfRec(ck, create) {
  S.leadership.teamFeedback = S.leadership.teamFeedback || {};
  let r = S.leadership.teamFeedback[ck];
  if (!r && create) r = S.leadership.teamFeedback[ck] = { formId: tfId(), questions: TF_DEFAULT_Q.map(q => ({ ...q })), responses: [] };
  return r || { formId: '', questions: TF_DEFAULT_Q, responses: [] };
}
const tfId = () => 'TF-' + Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
/* non-cryptographic fingerprint of the answers, only to spot the same form uploaded twice */
function tfHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function tfShuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- page ---------- */
function pgTeamFeedback() {
  const ck = V.tfCycle || cycleOf().key, c = cycleByKey(ck), r = tfRec(ck), min = +S.settings.upwardMin || 3, n = r.responses.length, ok = n >= min;
  const steps = `<div class="grid g3">
    ${card('1 · Choose the questions', `<p class="small" style="margin-top:0">${plural(r.questions.length, 'question')} about you as a manager and how the team works. Edit them here, or edit the downloaded file before you send it.</p>
      <button class="btn" onclick="tfEditQuestions('${ck}')">${ic('edit', 15)}Edit questions</button>`)}
    ${card('2 · Download and share', `<p class="small" style="margin-top:0">The form has no name field. Ask people to return it through a shared folder or a colleague who collects them, rather than emailing you directly.</p>
      <div class="row"><button class="btn primary ro-ok" onclick="tfDownload('${ck}','docx')">${ic('download', 15)}Word form</button><button class="btn ro-ok" onclick="tfDownload('${ck}','xlsx')">${ic('download', 15)}Excel form</button></div>`)}
    ${card('3 · Upload the answers', `<p class="small" style="margin-top:0">${plural(n, 'response')} so far. Upload filled Word or Excel forms, or paste answers. Only the answers are read; files and file names are not kept.</p>
      <div class="row"><button class="btn" onclick="pickFiles('.docx,.xlsx',true,fs=>tfUpload('${ck}',fs))">${ic('upload', 15)}Upload forms</button><button class="btn ghost" onclick="tfPaste('${ck}')">Paste text</button></div>`)}</div>`;
  const cyc = `<div class="row mb"><span class="small muted">Cycle</span><select class="input ro-ok" style="width:auto" onchange="V.tfCycle=this.value;render()">${cycleList().map(x => `<option value="${x.key}" ${x.key === ck ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
    ${r.formId ? `<span class="xs muted">Form reference ${esc(r.formId)}</span>` : ''}</div>`;
  if (!ok) return cyc + steps + `<div class="mt">${callout('info', n ? `${min - n} more response${min - n === 1 ? '' : 's'} needed before anything is shown — this keeps individual answers anonymous. (Change the minimum in Settings.)` : `No responses yet for ${esc(c.short)}. Results appear once at least ${min} forms are in.`, 'shield')}</div>`;
  const notes = tfNotes(r);
  const perQ = {};
  r.responses.forEach(x => x.answers.forEach(a => { if (a.a.trim()) (perQ[a.q] = perQ[a.q] || []).push(a.a); }));
  return cyc + steps + `<div class="card mt"><div class="card-head"><div><h2>What your team said · ${plural(n, 'response')}</h2><p>Every sentence sorted into Appreciation, Improvement or Other. Shown in random order, never as one person’s form.</p></div>
      <button class="btn sm danger" onclick="tfClear('${ck}')">Clear responses</button></div><div class="card-body">${analysisHtml(notes)}</div></div>
    <div class="card mt"><div class="card-head"><div><h2>Answers by question</h2><p>Shuffled within each question.</p></div></div><div class="card-body">
      ${Object.entries(perQ).map(([q, list]) => `<div class="tf-q"><div class="small"><b>${esc(q)}</b> <span class="xs muted">· ${plural(list.length, 'answer')}</span></div>${tfShuffle(list).map(t => `<div class="list-row small"><span class="pre">${esc(t)}</span></div>`).join('')}</div>`).join('') || '<div class="muted small">No answers.</div>'}</div></div>`;
}
function tfNotes(r) {
  const out = { appreciation: [], improvement: [], other: [] };
  for (const x of r.responses) {
    const a = FBC.classify(x.answers.map(v => ({ a: v.a, hint: v.hint ?? FBC.hintFor(v.q) })));
    for (const k in out) out[k].push(...a[k]);
  }
  for (const k in out) out[k] = tfShuffle(out[k]);
  return out;
}
function tfEditQuestions(ck) {
  const r = tfRec(ck);
  openModal({ title: 'Questions for your team', sub: `${esc(cycleByKey(ck).short)} · keep them open-ended; avoid questions only one person could answer`, size: 'wide',
    body: `${questionEditor(r.questions)}<div class="row mt-s"><button type="button" class="btn sm ghost" onclick="$('#q-edit').innerHTML=TF_DEFAULT_Q.map(qRow).join('')">Restore the suggested questions</button></div>
      ${r.responses.length ? `<div class="mt-s">${callout('warn', 'Responses already received keep the questions they were answered against.')}</div>` : ''}`,
    onSave: () => {
      const qs = readQuestions().slice(0, 15).map(q => ({ q: q.q.slice(0, 300), hint: q.hint || FBC.hintFor(q.q) }));
      if (!qs.length) { toast('Add at least one question', 'err'); return false; }
      const rec = tfRec(ck, true); rec.questions = qs; save(); render(); toast('Questions saved');
    } });
}
function tfClear(ck) { confirmBox({ title: 'Clear all responses?', msg: 'Uploaded answers for this cycle will be removed. The form stays the same.', yes: 'Clear', onYes: () => { tfRec(ck, true).responses = []; save(); render(); } }); }

/* ---------- the downloadable forms ---------- */
function tfDownload(ck, kind) {
  const r = tfRec(ck, true); save();
  const c = cycleByKey(ck), title = `Team feedback for ${S.settings.managerName || App.user?.name || 'your manager'}`;
  const intro = ['This form is anonymous. Please do not write your name anywhere in it.',
    `Write your answers in the boxes below each question (you can delete the “${TF_PLACEHOLDER}” text). Specific examples help most.`,
    'Return the saved file the way your manager suggested (for example a shared folder). Only your answers are read — not the file name or document properties.',
    `Answers are only seen once at least ${+S.settings.upwardMin || 3} people have replied, and never as one person’s form.`];
  const name = `Team_feedback_${safeName(c.short)}_${r.formId}`;
  if (kind === 'docx') downloadBlob(tfDocx(title, `${c.label} · Form reference ${r.formId}`, intro, r.questions), name + '.docx');
  else downloadBlob(tfXlsx(title, `${c.label} · Form reference ${r.formId}`, intro, r.questions), name + '.xlsx');
  toast('Form downloaded — share it with your team');
}
function tfDocx(title, sub, intro, qs) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const box = `<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="98A2B3"/><w:left w:val="single" w:sz="6" w:color="98A2B3"/><w:bottom w:val="single" w:sz="6" w:color="98A2B3"/><w:right w:val="single" w:sz="6" w:color="98A2B3"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9638"/></w:tblGrid>
    <w:tr><w:trPr><w:trHeight w:val="1600"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9638" w:type="dxa"/></w:tcPr>${wP(TF_PLACEHOLDER, 'Answer')}</w:tc></w:tr></w:tbl>`;
  const body = wP(title, 'Title') + wP(sub, 'Subtle') + intro.map(t => wP(`•  ${t}`, 'Subtle')).join('')
    + qs.map((q, i) => wP(`Q${i + 1}. ${q.q}`, 'Heading2') + box).join('') + wP(TF_END, 'Subtle');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const st = (id, name, ppr, rpr) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:color w:val="1F2937"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
    ${st('Title', 'Title', '<w:spacing w:after="60"/>', '<w:b/><w:sz w:val="36"/><w:color w:val="111827"/>')}
    ${st('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="22"/><w:color w:val="2563EB"/>')}
    ${st('Subtle', 'Subtle', '<w:spacing w:after="40"/>', '<w:color w:val="667085"/><w:sz w:val="19"/>')}
    ${st('Answer', 'Answer', '<w:spacing w:before="60" w:after="60"/>', '<w:color w:val="98A2B3"/>')}</w:styles>`;
  /* document properties deliberately carry no person's name */
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Team feedback form</dc:title><dc:creator>Team Desk</dc:creator><cp:lastModifiedBy>Team Desk</cp:lastModifiedBy></cp:coreProperties>`;
  return zipStore([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['docProps/core.xml', core], ['word/document.xml', doc], ['word/styles.xml', styles],
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
function tfXlsx(title, sub, intro, qs) {
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const aoa = [['#', 'Question', 'Your answer (anonymous — please don’t add your name)'], ...qs.map((q, i) => [`Q${i + 1}`, q.q, '']), [], ['', title], ['', sub], ...intro.map(t => ['', t])];
  const sheet = xlSheet(aoa, [6, 60, 90], { header: true }).replace(/<row r="(\d+)">/g, (m, r) => +r >= 2 && +r <= qs.length + 1 ? `<row r="${r}" ht="90" customHeight="1">` : m);
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${NS}>
    <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
    <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill></fills>
    <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipStore([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Team feedback form</dc:title><dc:creator>Team Desk</dc:creator><cp:lastModifiedBy>Team Desk</cp:lastModifiedBy></cp:coreProperties>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Feedback" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', styles], ['xl/worksheets/sheet1.xml', sheet],
  ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ---------- reading filled forms (only the answer text; never document properties) ---------- */
async function tfUnzip(buf, wanted) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = {};
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This is not a Word or Excel file.');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const td = new TextDecoder();
  for (let n = 0; n < count && p + 46 <= u8.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + el + cl;
    if (!wanted(name)) continue;
    if (usize > 20 * 1024 * 1024) throw new Error('The file is too large.');
    const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = u8.subarray(start, start + csize);
    if (method === 0) out[name] = td.decode(data);
    else if (method === 8) out[name] = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }
  return out;
}
const xmlText = s => String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
/* Word: paragraphs in order; "Q1. …" starts a question, everything until the next one is the answer */
function tfDocxParagraphs(xml) {
  xml = xml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, '').replace(/<w:(commentRangeStart|commentRangeEnd|commentReference)\b[^>]*\/>/g, '');
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(p => xmlText(p.replace(/<w:(br|cr)\b[^>]*\/>/g, '<w:t>\u0001</w:t>').replace(/<w:tab\/>/g, '<w:t> </w:t>').replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, '').match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g)?.join('') || '').replace(/\u0001/g, '\n'));
}
function tfFromLines(lines) {
  const qs = []; let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ');
    if (line.trim() === TF_END) break;
    const m = line.match(/^\s*Q(\d{1,2})[.):]\s*(.+)$/);
    if (m) { cur = { q: m[2].trim(), a: '' }; qs.push(cur); continue; }
    if (cur) cur.a += (cur.a ? '\n' : '') + line;
  }
  return qs.map(x => ({ q: x.q, a: x.a.replace(TF_PLACEHOLDER, '').replace(/\n{3,}/g, '\n\n').trim() }));
}
function tfXlsxRows(files) {
  const ss = (files['xl/sharedStrings.xml'] || '').match(/<si>[\s\S]*?<\/si>/g)?.map(si => xmlText((si.match(/<t[ >][\s\S]*?<\/t>/g) || []).join(''))) || [];
  const sheet = files['xl/worksheets/sheet1.xml'] || Object.entries(files).find(([k]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))?.[1] || '';
  const rows = [];
  for (const row of sheet.match(/<row\b[\s\S]*?<\/row>/g) || []) {
    const cells = {};
    for (const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/\br="([A-Z]+)\d+"/) || [])[1], t = (c.match(/\bt="(\w+)"/) || [])[1];
      let v = '';
      if (t === 's') v = ss[+(c.match(/<v>(\d+)<\/v>/) || [])[1]] || '';
      else if (t === 'inlineStr') v = xmlText((c.match(/<is>[\s\S]*?<\/is>/) || [''])[0]);
      else v = xmlText((c.match(/<v>([\s\S]*?)<\/v>/) || ['', ''])[1]);
      if (ref) cells[ref] = v;
    }
    rows.push(cells);
  }
  return rows.filter(r => /^Q\d{1,2}$/.test(String(r.A || '').trim())).map(r => ({ q: String(r.B || '').trim(), a: String(r.C || '').trim() }));
}
async function tfParseFile(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error('too large');
  const buf = await file.arrayBuffer(), ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'docx') {
    const f = await tfUnzip(buf, n => n === 'word/document.xml');
    if (!f['word/document.xml']) throw new Error('not a Word form');
    return tfFromLines(tfDocxParagraphs(f['word/document.xml']));
  }
  if (ext === 'xlsx') {
    const f = await tfUnzip(buf, n => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    return tfXlsxRows(f);
  }
  throw new Error('use a .docx or .xlsx form');
}
/* adds one response; returns 'added' | 'empty' | 'duplicate' */
function tfAdd(ck, answers) {
  const r = tfRec(ck, true);
  const clean = answers.map(x => ({ q: String(x.q || '').slice(0, 300), a: String(x.a || '').slice(0, 5000) }))
    .map(x => { const known = r.questions.find(q => q.q.toLowerCase() === x.q.toLowerCase()); return { ...x, hint: known ? known.hint || '' : FBC.hintFor(x.q) }; });
  if (!clean.some(x => x.a.trim())) return 'empty';
  const h = tfHash(clean.map(x => x.a.trim().toLowerCase().replace(/\s+/g, ' ')).join('\u0001'));
  if (r.responses.some(x => x.h === h)) return 'duplicate';
  r.responses.splice(Math.floor(Math.random() * (r.responses.length + 1)), 0, { h, answers: clean });   // random position: upload order is not kept
  return 'added';
}
async function tfUpload(ck, files) {
  const res = { added: 0, empty: 0, duplicate: 0, bad: 0 };
  for (const f of files) {
    try { res[tfAdd(ck, await tfParseFile(f))]++; }
    catch { res.bad++; }
  }
  save(); render();
  tfReport(res);
}
function tfReport(res) {
  const msg = [res.added && `${plural(res.added, 'response')} added`, res.duplicate && `${res.duplicate} already uploaded`, res.empty && `${res.empty} blank`, res.bad && `${res.bad} couldn’t be read`].filter(Boolean).join(' · ');
  toast(msg || 'Nothing added', res.added ? '' : 'err', 6000);
}
function tfPaste(ck) {
  const r = tfRec(ck);
  openModal({ title: 'Paste answers', sub: 'One person’s answers at a time. Keep the “Q1.”, “Q2.” markers if you have them; otherwise the whole text is treated as one answer.', size: 'wide', saveText: 'Add response',
    body: `<div class="ro-ok">${area('Answers', 'text', '', { rows: 12, ph: r.questions.slice(0, 2).map((q, i) => `Q${i + 1}. ${q.q}\nThe answer…`).join('\n\n') })}
      <div class="xs muted">Remove anything that identifies the person (names, signatures, “Sent from my phone”) before adding.</div></div>`,
    onSave: d => {
      const text = String(d.text || '').trim(); if (!text) { toast('Paste some answers first', 'err'); return false; }
      let ans = tfFromLines(text.split(/\r?\n/));
      if (!ans.length) ans = [{ q: 'General feedback', a: text }];
      const res = { added: 0, empty: 0, duplicate: 0, bad: 0 }; res[tfAdd(ck, ans)]++;
      save(); render(); tfReport(res);
    } });
}

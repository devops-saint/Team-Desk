/* =========================================================
   model.js — reference data, defaults, migrations, derived insights
   ========================================================= */
'use strict';

const SKILL_LEVELS = ['Not rated', '1 · Aware', '2 · Basic', '3 · Proficient', '4 · Advanced', '5 · Expert'];
const RATING = { 1: '1 · Does not meet', 2: '2 · Partially meets', 3: '3 · Meets', 4: '4 · Exceeds', 5: '5 · Far exceeds' };
const MORALE = ['—', '1 · Low', '2 · Below average', '3 · Okay', '4 · Good', '5 · Great'];
const GOAL_STATUS = ['On track', 'At risk', 'Off track', 'Done', 'Dropped'];
const GOAL_CATS = ['Business', 'Customer', 'Process', 'People / team', 'Development', 'Behavioural'];
const IDP_TYPES = ['Training / course', 'Certification', 'Mentoring / coaching', 'Stretch assignment', 'Shadowing', 'Reading / self-study', 'Other'];
const IDP_STATUS = ['Planned', 'In progress', 'Done', 'Deferred'];
const FB_TYPES = ['Achievement', 'Kudos', 'Constructive', 'Concern', 'Observation'];
const FB_SOURCES = ['Manager', 'Self', 'Peer', 'Stakeholder', 'Customer', 'Skip-level'];
const MODES = ['In person', 'Video call', 'Phone call', 'Chat'];
const READINESS = ['', 'Ready now', 'Ready in 1–2 cycles', 'Ready in 2+ cycles', 'Not a near-term move'];
const PIP_STATUS = ['Active', 'Extended', 'Completed – successful', 'Completed – not successful', 'Closed early'];
const PIP_ITEM_STATUS = ['Not yet met', 'Partly met', 'Met'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORG_OWNER = '_org';

const OLD_DEFAULT_SKILLS = ['Communication', 'Ownership & Accountability', 'Collaboration & Teamwork', 'Time Management & Planning', 'Learning Agility', 'Problem Solving', 'Domain / Product Knowledge', 'Core Role / Technical Skills', 'Quality & Attention to Detail', 'Process & Compliance', 'Stakeholder Management', 'Mentoring & Leadership'];
const DEFAULT_SKILLS = [
  ['Snowflake', 'Data platform'], ['Matillion', 'Data platform'], ['SQL', 'Data platform'], ['Data Modelling', 'Engineering'],
  ['Python / Scripting', 'Engineering'], ['Cloud Platforms (AWS / Azure / GCP)', 'Engineering'], ['DevOps / CI-CD', 'Engineering'],
  ['Testing & Data Quality', 'Engineering'], ['BI & Reporting', 'Analytics'], ['Domain / Industry Knowledge', 'Functional'],
];
const DEFAULT_SCALE = [
  { v: '1', label: 'Well below grade expectation' },
  { v: '2', label: 'Developing – below grade expectation' },
  { v: '3', label: 'Meets grade expectation' },
  { v: '4', label: 'Exceeds – often working above grade' },
  { v: '5', label: 'Outstanding – consistently at next-grade level' },
  { v: 'X', label: 'Not applicable / not demonstrated' },
];
/* HR's original matrix template uses 1–3; Team Desk rates on 1–5. */
const SCALE3_TO5 = { '1': '2', '2': '3', '3': '4' };
const to3 = v => { const n = numVal(v); return n === null ? v : n <= 2 ? '1' : n === 3 ? '2' : '3'; };
const SCALE3_LABELS = [['1', 'Below grade expectation'], ['2', 'Meets grade expectation'], ['3', 'Exceeds grade expectation'], ['X', 'Not applicable']];
const CADENCE_DAYS = { Weekly: 7, Fortnightly: 14, Monthly: 30 };
const DEFAULT_DISTRIBUTION = { 1: 5, 2: 15, 3: 60, 4: 15, 5: 5 };

/* 9-box: key = performance-potential */
const NINE = {
  '3-3': ['Star', 'Stretch with bigger scope; plan retention and succession', 2],
  '2-3': ['High potential', 'Accelerate growth with challenging assignments', 2],
  '1-3': ['Rough diamond', 'Clarify expectations and coach closely on performance', 3],
  '3-2': ['High performer', 'Broaden scope; build next-level skills', 1],
  '2-2': ['Core player', 'Steady development; find what motivates the next step', 1],
  '1-2': ['Inconsistent performer', 'Set short, specific goals and check in frequently', 3],
  '3-1': ['Trusted professional', 'Recognise expertise; keep engaged in current role', 1],
  '2-1': ['Effective contributor', 'Maintain; look for small growth areas', 1],
  '1-1': ['Under-performer', 'Structured improvement plan with clear checkpoints', 3],
};

/* Manager competencies used for self-assessment and upward feedback */
const LEADERSHIP_COMPS = [
  ['direction', 'Setting direction & goals', 'Gives the team clear priorities and goals, and explains how their work connects to the bigger picture.'],
  ['coaching', 'Coaching & developing people', 'Helps each person grow through regular coaching, stretch opportunities and development plans.'],
  ['feedback', 'Feedback & recognition', 'Gives timely, specific feedback — both appreciation and constructive — and recognises good work.'],
  ['delegation', 'Delegation & empowerment', 'Trusts people with ownership, delegates meaningful work and avoids micromanaging.'],
  ['communication', 'Communication & transparency', 'Shares information openly, listens actively and keeps the team informed of changes.'],
  ['performance', 'Fair performance management', 'Sets clear expectations, assesses fairly on evidence and addresses under-performance early.'],
  ['trust', 'Building trust & engagement', 'Is approachable and consistent, so people feel safe to raise concerns and ideas.'],
  ['decisions', 'Decision making & prioritisation', 'Makes timely, well-reasoned decisions and protects the team from conflicting priorities.'],
  ['advocacy', 'Representing the team', 'Advocates for the team with stakeholders and senior leaders, and removes blockers.'],
  ['change', 'Leading through change', 'Helps the team adapt to change, explains the why, and stays steady under pressure.'],
  ['wellbeing', 'Wellbeing & inclusion', 'Looks after workload and wellbeing, and makes sure every voice is heard.'],
  ['hiring', 'Hiring & onboarding', 'Hires fairly against clear criteria and sets new joiners up to succeed.'],
].map(([id, name, desc]) => ({ id, name, desc }));
const LEAD_SCALE = [['', '—'], ['1', '1 · Rarely'], ['2', '2 · Sometimes'], ['3', '3 · Often'], ['4', '4 · Usually'], ['5', '5 · Consistently']];

const STAY_QUESTIONS = [
  ['enjoy', 'What do you look forward to most when you come to work?'],
  ['learn', 'What are you learning here, and what would you like to learn next?'],
  ['satisfy', 'What would make your job more satisfying?'],
  ['leave', 'What might tempt you to leave?'],
  ['support', 'How can I best support you?'],
];

/* ---------- defaults & migration ---------- */
function defaultOrg() {
  return {
    version: 3,
    settings: { managerName: '', cycleStartMonth: 4, theme: '', distribution: { ...DEFAULT_DISTRIBUTION }, upwardMin: 3, aiAuto: true },
    qbank: { topics: {}, hidden: {}, custom: [] },
    skills: DEFAULT_SKILLS.map(([name, cat]) => ({ id: uid(), name, cat })),
    roles: [], guidelines: [],
    framework: window.DEFAULT_FRAMEWORK ? JSON.parse(JSON.stringify(window.DEFAULT_FRAMEWORK)) : null,
    leadership: { self: {}, upward: {}, teamFeedback: {} },
  };
}
function normP(p) {
  p.profile = p.profile || {};
  for (const k of ['oneOnOnes', 'goals', 'idp', 'feedback', 'docs', 'strengths', 'devAreas', 'pips', 'stay', 'tasks', 'leaves', 'suggestions']) p[k] = p[k] || [];
  for (const k of ['skills', 'kpi', 'reviews', 'ninebox', 'comp', 'talent']) p[k] = p[k] || {};
  p.grade = p.grade || '';
  p.docs.forEach(d => { if (!d.owner) d.owner = p.id; });
  return p;
}
function migrate(s) {
  const d = defaultOrg();
  s.version = 3;
  s.settings = { ...d.settings, ...(s.settings || {}) };
  s.settings.distribution = { ...DEFAULT_DISTRIBUTION, ...(s.settings.distribution || {}) };
  delete s.settings.pinHash;
  s.skills = s.skills || d.skills; s.roles = s.roles || []; s.guidelines = s.guidelines || [];
  s.leadership = { self: {}, upward: {}, teamFeedback: {}, ...(s.leadership || {}) };
  s.qbank = { topics: {}, hidden: {}, custom: [], ...(s.qbank || {}) };
  s.reportees = (s.reportees || []).map(normP);
  s.roles.forEach(r => { r.kpis = r.kpis || []; r.skillTargets = r.skillTargets || {}; });
  s.guidelines.forEach(g => { g.owner = g.owner || ORG_OWNER; g.points = g.points || []; });
  if (s.framework === undefined) s.framework = d.framework;
  if (s.framework && !s.framework.scaleMigrated) {
    /* one-time move from the matrix's 1–3 scale to 1–5: 1→2 (below), 2→3 (meets), 3→4 (exceeds) */
    const nums = (s.framework.scale || []).map(x => numVal(x.v)).filter(v => v !== null);
    if (!nums.length || Math.max(...nums) <= 3) {
      const xl = (s.framework.scale || []).find(x => x.v === 'X')?.label;
      s.framework.scale = JSON.parse(JSON.stringify(DEFAULT_SCALE));
      if (xl) s.framework.scale.find(x => x.v === 'X').label = xl;
      s.framework.sourceScale = 3;
      const conv = rec => { if (!rec || rec.scale === 5) return; Object.values(rec.items || {}).forEach(it => { for (const f of ['rating', 'self']) if (SCALE3_TO5[String(it[f])]) it[f] = SCALE3_TO5[String(it[f])]; }); rec.scale = 5; };
      s.reportees.forEach(p => { Object.values(p.comp || {}).forEach(conv); Object.values(p.reviews || {}).forEach(r => conv(r.compSnapshot)); });
    }
    s.framework.scaleMigrated = true;
  }
  if (s.framework && !s.framework.scale?.length) s.framework.scale = JSON.parse(JSON.stringify(DEFAULT_SCALE));
  const untouched = s.skills.length === OLD_DEFAULT_SKILLS.length && s.skills.every((k, i) => k.name === OLD_DEFAULT_SKILLS[i]);
  if (untouched && !s.reportees.some(p => Object.keys(p.skills).length)) s.skills = d.skills;
}

/* ---------- lookups ---------- */
const active = () => S.reportees.filter(p => !p.archived).sort((a, b) => (a.profile.name || '').localeCompare(b.profile.name || ''));
const getP = id => S.reportees.find(p => p.id === id);
const roleOf = p => S.roles.find(r => r.id === p.roleId);
const effTarget = (p, sid) => +(p.skills[sid]?.target || roleOf(p)?.skillTargets?.[sid] || 0);
function nineOf(p) { const n = p.ninebox; if (!n.perf || !n.pot) return null; const v = NINE[`${n.perf}-${n.pot}`]; return { name: v[0], action: v[1], lvl: v[2] }; }
const lastOne = p => [...p.oneOnOnes].sort((a, b) => b.date.localeCompare(a.date))[0];
const nextOne = p => p.oneOnOnes.map(o => o.next).filter(d => d && d >= today()).sort()[0];
const activePip = p => p.pips.find(x => x.status === 'Active' || x.status === 'Extended');
/* every action item for a person: those agreed in 1:1s (o = meeting) and standalone ones (o = null) */
const personActions = p => [...p.oneOnOnes.flatMap(o => (o.actions || []).map(a => ({ ...a, o }))), ...(p.tasks || []).map(a => ({ ...a, o: null }))];
/* birthdays, work anniversaries and probation end dates in the next `days` days */
function nextOccurrence(iso) { const t = today(), y = +t.slice(0, 4); let d = `${y}${iso.slice(4)}`; if (iso.slice(5) === '02-29') d = `${y}-02-28`; if (d < t) d = `${y + 1}${iso.slice(4)}`; return d; }
function milestones(p, days = 30) {
  const t = today(), end = addDays(t, days), out = [], f = firstName(p.profile.name), pr = p.profile;
  if (pr.dob) { const d = nextOccurrence(pr.dob); if (d <= end) out.push({ date: d, kind: 'birthday', icon: 'award', text: `${f}’s birthday` }); }
  if (pr.doj) { const d = nextOccurrence(pr.doj), yrs = +d.slice(0, 4) - +pr.doj.slice(0, 4); if (yrs >= 1 && d <= end) out.push({ date: d, kind: 'anniversary', icon: 'award', text: `${f}’s ${yrs}-year work anniversary` }); }
  if (pr.probationEnd && !pr.confirmed && pr.probationEnd >= t && pr.probationEnd <= end) out.push({ date: pr.probationEnd, kind: 'probation', icon: 'flag', text: `${f}’s probation ends` });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
const upcomingLeave = (p, days = 30) => (p.leaves || []).filter(l => l.status !== 'Cancelled' && (l.to || l.from) >= today() && l.from <= addDays(today(), days)).sort((a, b) => a.from.localeCompare(b.from));

/* ---------- review cycles (half-years) ---------- */
function cycleInfo(y, h) {
  const s = +S.settings.cycleStartMonth || 4;
  const start = new Date(y, s - 1 + (h - 1) * 6, 1), end = new Date(y, s - 1 + h * 6, 0);
  const short = s === 1 ? `${y} H${h}` : `FY${y}-${String((y + 1) % 100).padStart(2, '0')} H${h}`;
  const range = `${start.toLocaleDateString('en-IN', { month: 'short' })}–${end.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
  return { key: `${y}-H${h}`, y, h, start: ymd(start), end: ymd(end), short, label: `${short} (${range})` };
}
function cycleOf(dateStr) {
  const d = dateStr ? parseD(dateStr) : new Date(), s = +S.settings.cycleStartMonth || 4;
  let y = d.getFullYear(); const m = d.getMonth() + 1;
  if (m < s) y -= 1;
  return cycleInfo(y, ((m - s + 12) % 12) < 6 ? 1 : 2);
}
const cycleByKey = k => { const [y, h] = k.split('-H'); return cycleInfo(+y, +h); };
function cycleList() {
  const c = cycleOf(), out = [];
  out.push(c.h === 2 ? cycleInfo(c.y + 1, 1) : cycleInfo(c.y, 2));
  let y = c.y, h = c.h;
  for (let i = 0; i < 5; i++) { out.push(cycleInfo(y, h)); if (h === 1) { y--; h = 2; } else h = 1; }
  return out;
}
const cycleOpts = () => cycleList().map(c => [c.key, c.label]);
const inCycle = (d, c) => !!d && d >= c.start && d <= c.end;
const goalCycle = g => g.cycle || cycleOf(g.due || g.start || today()).key;
function cycleMonths(c, upToToday = true) {
  const out = [], end = upToToday && today() < c.end ? today() : c.end;
  for (let d = parseD(c.start); ymd(d) <= end; d.setMonth(d.getMonth() + 1)) out.push(ymd(d).slice(0, 7));
  return out;
}

/* ---------- competency framework ---------- */
const FW = () => S.framework;
const scale = () => FW()?.scale?.length ? FW().scale : DEFAULT_SCALE;
const numVal = v => (v !== '' && v != null && !isNaN(+v)) ? +v : null;
const scaleNums = () => scale().map(s => numVal(s.v)).filter(v => v !== null);
const maxV = () => Math.max(...scaleNums());
/* the middle of the scale means "meets grade expectation"; one below/above it is the threshold for below/above grade */
const meetsV = () => { const n = [...new Set(scaleNums())].sort((a, b) => a - b); return n[Math.floor((n.length - 1) / 2)]; };
const lowV = () => meetsV() - 1;
const highV = () => meetsV() + 1;
const scaleLabel = v => scale().find(s => s.v === String(v))?.label || '';
const compByCode = code => FW()?.comps.find(c => c.code === code);
const nextGrade = g => { const gs = FW()?.grades || []; const i = gs.indexOf(g); return i >= 0 && i < gs.length - 1 ? gs[i + 1] : null; };
const hasRatings = rec => !!rec && Object.values(rec.items || {}).some(x => x.rating || x.self);
const hasMgrRatings = rec => !!rec && Object.values(rec.items || {}).some(x => x.rating);
function ensureComp(p, ck) { p.comp[ck] = p.comp[ck] || { grade: p.grade || '', items: {}, scale: 5 }; if (!p.comp[ck].grade) p.comp[ck].grade = p.grade || ''; return p.comp[ck]; }
function compStats(rec, field = 'rating') {
  const vals = (FW()?.comps || []).map(c => rec?.items?.[c.code]?.[field]).filter(v => v != null && v !== '');
  const nums = vals.map(numVal).filter(v => v !== null);
  return { rated: vals.length, nums, avg: avg(nums), count: v => vals.filter(x => String(x) === String(v)).length };
}
function latestCompCycle(p) {
  const c = cycleOf().key;
  if (hasMgrRatings(p.comp[c])) return c;
  return Object.keys(p.comp).filter(k => hasMgrRatings(p.comp[k])).sort().reverse()[0] || null;
}
function ratingStyle(v) {
  if (v == null || v === '') return 'background:var(--mid-bg);color:var(--faint)';
  const n = numVal(v);
  if (n === null) return 'background:var(--mid-bg);color:var(--muted)';
  if (n <= lowV()) return 'background:var(--bad-bg);color:var(--bad)';
  if (n >= maxV() && maxV() > highV()) return 'background:var(--accent);color:var(--accent-ink)';
  if (n >= highV()) return 'background:var(--soft);color:var(--accent)';
  return 'background:var(--good-bg);color:var(--good)';
}
const ratingChip = v => `<span class="hc" style="${ratingStyle(v)}">${v == null || v === '' ? '–' : esc(v)}</span>`;
const linkName = id => id?.startsWith('c:') ? (c => c ? `${c.code} · ${c.name}` : '—')(compByCode(id.slice(2))) : (S.skills.find(s => s.id === id)?.name || '—');
const linkOpts = () => [['', '—'], ...(FW()?.comps || []).map(c => ['c:' + c.code, `Competency · ${c.code} ${c.name}`]), ...S.skills.map(s => [s.id, `Skill · ${s.name}`])];

/* ---------- evidence summaries ---------- */
function goalScore(p, ck) {
  const gs = p.goals.filter(g => goalCycle(g) === ck && g.status !== 'Dropped');
  if (!gs.length) return null;
  const w = gs.reduce((s, g) => s + (+g.weight || 1), 0);
  return gs.reduce((s, g) => s + (+g.progress || 0) * (+g.weight || 1), 0) / w;
}
function kpiScore(p, ck) {
  const r = roleOf(p), kc = p.kpi[ck] || {}; let ws = 0, wt = 0;
  (r?.kpis || []).forEach(k => { const v = +kc[k.id]?.rating, w = +k.weight || 1; if (v) { ws += v * w; wt += w; } });
  return wt ? ws / wt : null;
}
function moraleByMonth(p, months) {
  return months.map(m => { const v = p.oneOnOnes.filter(o => o.date.startsWith(m) && +o.morale).map(o => +o.morale); return avg(v); });
}

/* ---------- focus engine: where should I work with whom ---------- */
function focusAreas(p) {
  const out = [], t = today(), month = t.slice(0, 7), c = cycleOf();
  const add = (lvl, area, text, sec) => out.push({ lvl, area, text, sec });
  const ones = [...p.oneOnOnes].sort((a, b) => b.date.localeCompare(a.date));
  const cad = CADENCE_DAYS[p.profile.cadence];
  if (cad && cad < 30) {
    const ds = ones[0] ? daysBetween(ones[0].date, t) : null;
    if (ds === null || ds > cad + 2) add(ds === null || ds > cad * 2 ? 3 : 2, 'Connect', ones[0] ? `${p.profile.cadence} 1:1 overdue — last one was ${ds} days ago` : 'No 1:1 recorded yet — schedule the first one', 'meetings');
  } else if (!ones.some(o => o.date.startsWith(month))) {
    const ds = ones[0] ? daysBetween(ones[0].date, t) : null;
    add(ds === null || ds > 45 ? 3 : 2, 'Connect', ones[0] ? `No 1:1 yet this month — last connect was ${ds} days ago` : 'No 1:1 recorded yet — schedule the first monthly connect', 'meetings');
  }
  const rec3 = ones.slice(0, 3).filter(o => +o.morale);
  if (rec3.length) { const a = avg(rec3.map(o => +o.morale)); if (a <= 2.5) add(3, 'Engagement', `Low morale in recent 1:1s (average ${a.toFixed(1)}/5) — explore what is driving it`, 'meetings'); }
  const od = personActions(p).filter(a => !a.done && a.due && a.due < t);
  if (od.length) add(2, 'Follow-through', `${plural(od.length, 'overdue action item')}${od.some(a => a.owner === 'me') ? ' — some are yours' : ''}`, 'actions');
  if (!ones.some(o => (o.career || o.grow?.goal) && daysBetween(o.date, t) <= 90) && ones.length) add(1, 'Career', 'No career or coaching conversation in the last 90 days', 'meetings');

  const pe = p.profile.probationEnd;
  if (pe && !p.profile.confirmed) {
    if (pe < t) add(3, 'Probation', `Probation ended ${fmt(pe)} — record the confirmation decision`, 'profile');
    else if (daysBetween(t, pe) <= 30) add(2, 'Probation', `Probation ends ${fmt(pe)} (${relDays(pe)}) — prepare the confirmation review`, 'profile');
  }
  milestones(p, 7).filter(m => m.kind !== 'probation').forEach(m => add(1, 'Celebrate', `${m.text} — ${relDays(m.date)}`, 'profile'));
  const ns = (p.suggestions || []).filter(s => s.state === 'new');
  if (ns.length) add(ns.some(s => s.sev >= 3) ? 3 : 2, 'Suggestions', `${plural(ns.length, 'suggested action')} from 1:1s and documents to review${ns.some(s => s.sev >= 3) ? ' — some are urgent' : ''}`, 'suggestions');
  const lv = upcomingLeave(p, 21);
  lv.forEach(l => {
    const clash = p.goals.filter(g => !['Done', 'Dropped'].includes(g.status) && g.due && g.due >= l.from && g.due <= (l.to || l.from));
    add(clash.length ? 2 : 1, 'Leave', `On leave ${fmtShort(l.from)}${l.to && l.to !== l.from ? '–' + fmtShort(l.to) : ''}${clash.length ? ` — clashes with goal due date: ${list(clash.map(g => g.title), 2)}` : ' — plan cover and handover'}`, 'leave');
  });
  const pip = activePip(p);
  if (pip) {
    const lastCi = [...(pip.checkins || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (pip.end && pip.end < t) add(3, 'Improvement plan', `Improvement plan ended ${fmt(pip.end)} — record the outcome`, 'pip');
    else if (!lastCi || daysBetween(lastCi.date, t) > 14) add(3, 'Improvement plan', `Improvement plan check-in due (last: ${lastCi ? fmt(lastCi.date) : 'none'})`, 'pip');
  }

  if (FW()) {
    if (!p.grade) add(1, 'Competencies', 'Set their grade so the competency matrix shows what is expected', 'profile');
    if (!hasMgrRatings(p.comp[c.key])) { const dl = daysBetween(t, c.end); add(dl <= 45 ? 2 : 1, 'Competencies', `Competencies not assessed for ${c.short}${dl <= 45 ? ` — cycle ends in ${dl} days` : ''}`, 'competencies'); }
    const ck = latestCompCycle(p);
    if (ck) {
      const rec = p.comp[ck], it = rec.items, when = ck !== c.key ? ` (${cycleByKey(ck).short})` : '', cs = FW().comps;
      const val = (x, f = 'rating') => numVal(it[x.code]?.[f]);
      const low = cs.filter(x => val(x) !== null && val(x) <= lowV());
      if (low.length) add(3, 'Competencies', `Below grade ${rec.grade || ''} on ${list(low.map(x => x.name))}${when} — agree a development action`, 'competencies');
      const both = cs.filter(x => val(x) !== null && val(x, 'self') !== null);
      const far = both.filter(x => Math.abs(val(x, 'self') - val(x)) >= 2);
      if (far.length) add(2, 'Alignment', `Self vs your rating differs sharply on ${list(far.map(x => x.name))} — walk through the grade expectation together`, 'competencies');
      const st = compStats(rec), hi = cs.filter(x => val(x) !== null && val(x) >= highV());
      if (!low.length && st.nums.length >= 3 && st.avg >= (lowV() + highV()) / 2 + 0.5 && hi.length >= Math.ceil(st.nums.length / 2) && nextGrade(rec.grade))
        add(1, 'Promotion', `Working above grade on ${plural(hi.length, 'competency', 'competencies')} — review against grade ${nextGrade(rec.grade)}`, 'talent');
    }
  }
  const gaps = S.skills.map(s => ({ s, tg: effTarget(p, s.id), cur: +(p.skills[s.id]?.current || 0) })).filter(g => g.tg && g.tg > g.cur);
  const big = gaps.filter(g => g.tg - g.cur >= 2);
  if (big.length) add(2, 'Skills', `Technical gaps (2+ levels): ${list(big.map(g => g.s.name))}`, 'skills');

  const risk = p.ninebox.risk;
  if (risk === 'High' || risk === 'Medium') {
    const recent = p.stay.some(x => daysBetween(x.date, t) <= 60);
    add(risk === 'High' ? 3 : 2, 'Retention', `${risk} flight risk${p.ninebox.riskReason ? ` (${p.ninebox.riskReason})` : ''}${recent ? '' : ' — have a stay conversation'}`, 'talent');
  }
  const nb = nineOf(p); if (nb && !pip) add(nb.lvl, 'Talent', `${nb.name}: ${nb.action}`, 'talent');

  const cg = p.goals.filter(g => goalCycle(g) === c.key && g.status !== 'Dropped');
  if (!cg.length) add(2, 'Goals', `No goals set for ${c.short}`, 'goals');
  const risky = cg.filter(g => g.status === 'At risk' || g.status === 'Off track');
  if (risky.length) add(3, 'Goals', `${plural(risky.length, 'goal')} at risk or off track: ${list(risky.map(g => g.title))}`, 'goals');
  const odg = p.goals.filter(g => !['Done', 'Dropped'].includes(g.status) && g.due && g.due < t);
  if (odg.length) add(2, 'Goals', `Past due: ${list(odg.map(g => g.title))}`, 'goals');
  const role = roleOf(p), kc = p.kpi[c.key] || {};
  const lowK = (role?.kpis || []).filter(k => +kc[k.id]?.rating && +kc[k.id].rating <= 2);
  if (lowK.length) add(3, 'KPIs', `Below expectation on ${list(lowK.map(k => k.name))}`, 'kpis');
  if (!p.idp.some(i => !['Done', 'Deferred'].includes(i.status))) add(1, 'Development', 'No active development plan item — agree one or two growth actions', 'idp');
  const odi = p.idp.filter(i => !['Done', 'Deferred'].includes(i.status) && i.due && i.due < t);
  if (odi.length) add(2, 'Development', `Overdue development items: ${list(odi.map(i => i.title))}`, 'idp');
  if (!p.feedback.some(x => ['Achievement', 'Kudos'].includes(x.type) && daysBetween(x.date, t) <= 60)) add(1, 'Recognition', 'No recognition logged in the last 60 days', 'feedback');
  return out.sort((a, b) => b.lvl - a.lvl);
}

/* ---------- leadership scorecard: computed from what's recorded ---------- */
function leadershipMetrics(ck = cycleOf().key) {
  const c = cycleByKey(ck), ps = active(), t = today(), months = cycleMonths(c);
  const n = ps.length, M = [];
  const m = (key, name, value, detail, good, warn, comp, tip, na = false) => M.push({ key, name, value, detail, comp, tip,
    status: na || value == null ? 'na' : value >= good ? 'good' : value >= warn ? 'warn' : 'bad' });
  if (!n) return M;
  /* only count months since each person started reporting to you */
  const monthsFor = p => { const from = [p.profile.since, p.profile.doj, p.created].filter(Boolean).sort().pop()?.slice(0, 7) || ''; return months.filter(mo => mo >= from); };
  const slots = ps.reduce((s, p) => s + monthsFor(p).length, 0), hit = ps.reduce((s, p) => s + monthsFor(p).filter(mo => p.oneOnOnes.some(o => o.date.startsWith(mo))).length, 0);
  m('coverage', '1:1 coverage', slots ? hit / slots * 100 : null, `${hit} of ${slots} monthly 1:1s held this cycle`, 90, 70, 'trust', 'Hold a 1:1 with every reportee every month.');
  const mine = ps.flatMap(p => personActions(p).filter(a => a.owner === 'me' && a.due && a.due <= t && inCycle(a.due, c)));
  const onTime = mine.filter(a => a.done && (!a.doneOn || a.doneOn <= a.due)).length;
  m('followthrough', 'Your follow-through', mine.length ? onTime / mine.length * 100 : null, mine.length ? `${onTime} of ${mine.length} actions you owned were closed on time` : 'No actions owned by you were due yet', 85, 65, 'trust', 'Close the actions you commit to in 1:1s before their due date.', !mine.length);
  const recog = ps.filter(p => p.feedback.some(x => ['Achievement', 'Kudos'].includes(x.type) && daysBetween(x.date, t) <= 60)).length;
  m('recognition', 'Recognition', recog / n * 100, `${recog} of ${n} reportees recognised in the last 60 days`, 80, 50, 'feedback', 'Log specific appreciation for each person at least every couple of months.');
  const fbAll = ps.flatMap(p => p.feedback.filter(x => inCycle(x.date, c)));
  const sbi = fbAll.filter(x => x.sbi && (x.sbi.situation || x.sbi.behaviour)).length;
  m('sbi', 'Specific feedback (SBI)', fbAll.length ? sbi / fbAll.length * 100 : null, fbAll.length ? `${sbi} of ${fbAll.length} feedback entries this cycle use Situation–Behaviour–Impact` : 'No feedback logged this cycle', 60, 30, 'feedback', 'Describe the situation, the behaviour and its impact so feedback is actionable.', !fbAll.length);
  const career = ps.filter(p => p.oneOnOnes.some(o => (o.career || o.grow?.goal) && daysBetween(o.date, t) <= 90)).length;
  m('career', 'Career & coaching conversations', career / n * 100, `${career} of ${n} had a career or GROW conversation in the last 90 days`, 80, 50, 'coaching', 'Use the GROW section of a 1:1 at least once a quarter per person.');
  const dev = ps.filter(p => p.idp.some(i => !['Done', 'Deferred'].includes(i.status))).length;
  m('development', 'Development plans', dev / n * 100, `${dev} of ${n} have an active development action`, 90, 60, 'coaching', 'Every reportee should have at least one live development action.');
  const goals = ps.filter(p => p.goals.some(g => goalCycle(g) === ck && g.status !== 'Dropped')).length;
  m('goals', 'Goals set', goals / n * 100, `${goals} of ${n} have goals for ${c.short}`, 100, 70, 'direction', 'Agree goals with everyone in the first month of the cycle.');
  const assessed = ps.filter(p => hasMgrRatings(p.comp[ck])).length, late = daysBetween(t, c.end) <= 45;
  m('assessed', 'Competency assessments', FW() ? assessed / n * 100 : null, `${assessed} of ${n} assessed for ${c.short}${late ? '' : ' (due near cycle end)'}`, late ? 100 : 0, late ? 70 : 0, 'performance', 'Rate each competency with evidence before the review deadline.', !FW());
  const atRisk = ps.filter(p => ['High', 'Medium'].includes(p.ninebox.risk));
  const stayed = atRisk.filter(p => p.stay.some(x => daysBetween(x.date, t) <= 60)).length;
  m('retention', 'Retention conversations', atRisk.length ? stayed / atRisk.length * 100 : null, atRisk.length ? `${stayed} of ${atRisk.length} at-risk reportees had a stay conversation in the last 60 days` : 'Nobody is flagged as a flight risk', 100, 50, 'wellbeing', 'Hold a stay conversation with anyone at medium or high flight risk.', !atRisk.length);
  const pips = ps.filter(p => activePip(p));
  const fresh = pips.filter(p => { const ci = (activePip(p).checkins || []).map(x => x.date).sort().pop(); return ci && daysBetween(ci, t) <= 14; }).length;
  m('pip', 'Improvement plan check-ins', pips.length ? fresh / pips.length * 100 : null, pips.length ? `${fresh} of ${pips.length} active plans checked in within 14 days` : 'No active improvement plans', 100, 50, 'performance', 'Check in at least fortnightly on any active improvement plan, and document it.', !pips.length);
  return M;
}

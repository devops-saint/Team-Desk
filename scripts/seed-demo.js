#!/usr/bin/env node
/*
 * Team Desk — demo data loader
 * ------------------------------------------------------------
 * Adds six fictional reportees (grades A2, C1, C2, C3, S1, S2) with months of
 * history so every feature has something to show. Run it while Team Desk is
 * running:
 *
 *   node scripts/seed-demo.js            add / refresh demo data
 *   node scripts/seed-demo.js --remove   remove all demo data
 *   options: --port 4317   --force (allow a folder that has real reportees)
 *
 * It talks to the running app on this computer only, takes a backup first,
 * and the open browser tab refreshes itself within a few seconds.
 * All names and details are invented.
 */
'use strict';

const readline = require('readline');
const args = process.argv.slice(2);
const has = f => args.includes(f);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const REMOVE = has('--remove'), FORCE = has('--force');
const PREFIX = 'demo-';

/* ---------------- tiny helpers ---------------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const D = n => { const x = new Date(TODAY); x.setDate(x.getDate() + n); return ymd(x); };
/* a date in the month `k` months ago, on day `day`, never in the future */
function M(k, day) {
  const x = new Date(TODAY.getFullYear(), TODAY.getMonth() - k, 1);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  if (x > TODAY) return ymd(TODAY);
  return ymd(x);
}
const weekday = (s, dir = 1) => { const x = new Date(s + 'T00:00:00'); while ([0, 6].includes(x.getDay())) x.setDate(x.getDate() + dir); return ymd(x); };
function cycleKeyOf(dateStr, startMonth) {
  const d = new Date(dateStr + 'T00:00:00'); let y = d.getFullYear(); const m = d.getMonth() + 1;
  if (m < startMonth) y -= 1;
  return `${y}-H${((m - startMonth + 12) % 12) < 6 ? 1 : 2}`;
}
const prevCycleKey = k => { const [y, h] = k.split('-H').map(Number); return h === 2 ? `${y}-H1` : `${y - 1}-H2`; };
const c = (...a) => console.log(...a);
const ok = m => c(`  \x1b[32m✓\x1b[0m ${m}`), warn = m => c(`  \x1b[33m!\x1b[0m ${m}`), bad = m => c(`  \x1b[31m✗\x1b[0m ${m}`);

/* ---------------- connection to the running app ---------------- */
let BASE = '', TOKEN = '';
async function connect() {
  const ports = argVal('--port') ? [+argVal('--port')] : Array.from({ length: 10 }, (_, i) => 4317 + i);
  for (const port of ports) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/ping`, { signal: AbortSignal.timeout(800) });
      const j = await r.json();
      if (j.app === 'teamdesk') {
        BASE = `http://127.0.0.1:${port}`;
        const html = await (await fetch(BASE + '/')).text();
        TOKEN = (html.match(/name="td-token" content="([0-9a-f]+)"/) || [])[1] || '';
        if (!TOKEN) throw new Error('Could not read the session token from the app.');
        return j.version;
      }
    } catch (e) { if (e.message.includes('token')) throw e; }
  }
  throw new Error('Team Desk is not running. Start it first (double-click “Start Team Desk”), then run this again.');
}
async function api(method, url, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const r = await fetch(BASE + url, { method, headers: { 'X-TD-Token': TOKEN, ...(body !== undefined && !isBuf ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : isBuf ? body : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || r.statusText); e.status = r.status; throw e; }
  return j;
}
function askHidden(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) rl.output.write(s); else rl.output.write(s.replace(/[^\r\n]/g, '•')); };
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}
function ask(q) { return new Promise(r => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, a => { rl.close(); r(a.trim()); }); }); }

/* ---------------- demo content ---------------- */
function buildDemo(org) {
  const start = +org.settings?.cycleStartMonth || 4;
  const CK = cycleKeyOf(ymd(TODAY), start), PK = prevCycleKey(CK);
  const comps = (org.framework?.comps || []).map(x => x.code);
  const skillId = name => (org.skills || []).find(s => s.name.toLowerCase().startsWith(name.toLowerCase()))?.id;
  const roles = {
    eng: { id: PREFIX + 'role-eng', name: 'Data Engineer', desc: 'Engineers at grades C1–C3 (demo role)', kpiFile: 'Demo KPIs',
      kpis: [{ id: 'dk-util', name: 'Billable utilisation', target: '85', unit: '%', weight: '30', desc: 'Billable hours ÷ available hours' },
        { id: 'dk-otd', name: 'On-time delivery', target: '95', unit: '%', weight: '30', desc: 'Stories delivered by the committed sprint' },
        { id: 'dk-def', name: 'Defects found in UAT', target: '≤ 3', unit: 'per release', weight: '20' },
        { id: 'dk-csat', name: 'Client satisfaction', target: '4.5', unit: '/ 5', weight: '20' }],
      skillTargets: {} },
    lead: { id: PREFIX + 'role-lead', name: 'Senior / Lead Engineer', desc: 'Grades S1–S2 (demo role)', kpiFile: 'Demo KPIs',
      kpis: [{ id: 'dk-lutil', name: 'Billable utilisation', target: '80', unit: '%', weight: '25' },
        { id: 'dk-team', name: 'Team on-time delivery', target: '95', unit: '%', weight: '25' },
        { id: 'dk-ment', name: 'Mentoring hours per month', target: '6', unit: 'hours', weight: '15' },
        { id: 'dk-sess', name: 'Knowledge sessions delivered', target: '2', unit: 'per half-year', weight: '15' },
        { id: 'dk-lcsat', name: 'Client satisfaction', target: '4.5', unit: '/ 5', weight: '20' }],
      skillTargets: {} },
    grad: { id: PREFIX + 'role-grad', name: 'Graduate Engineer', desc: 'Grade A2 (demo role)', kpiFile: 'Demo KPIs',
      kpis: [{ id: 'dk-train', name: 'Training plan completion', target: '100', unit: '%', weight: '50' },
        { id: 'dk-assign', name: 'Assignments completed on time', target: '90', unit: '%', weight: '30' },
        { id: 'dk-buddy', name: 'Buddy / mentor feedback', target: '4', unit: '/ 5', weight: '20' }],
      skillTargets: {} },
  };
  const T = (o, name, lvl) => { const id = skillId(name); if (id) o[id] = lvl; };
  T(roles.eng.skillTargets, 'Snowflake', 3); T(roles.eng.skillTargets, 'SQL', 4); T(roles.eng.skillTargets, 'Matillion', 3); T(roles.eng.skillTargets, 'Data Modelling', 3); T(roles.eng.skillTargets, 'Python', 2); T(roles.eng.skillTargets, 'Testing', 3);
  T(roles.lead.skillTargets, 'Snowflake', 4); T(roles.lead.skillTargets, 'SQL', 4); T(roles.lead.skillTargets, 'Matillion', 4); T(roles.lead.skillTargets, 'Data Modelling', 4); T(roles.lead.skillTargets, 'Cloud', 3); T(roles.lead.skillTargets, 'DevOps', 3);
  T(roles.grad.skillTargets, 'SQL', 2); T(roles.grad.skillTargets, 'Snowflake', 2); T(roles.grad.skillTargets, 'Python', 2);

  const SK = ['Snowflake', 'Matillion', 'SQL', 'Data Modelling', 'Python', 'Cloud', 'DevOps', 'Testing', 'BI', 'Domain'];
  const skills = (cur, self) => { const o = {}; SK.forEach((n, i) => { const id = skillId(n); if (id && (cur[i] || self?.[i])) o[id] = { current: cur[i] || 0, self: (self || cur)[i] || 0, updated: M(1, 12) }; }); return o; };
  const CODES = ['C1', 'C2', 'C3', 'C4', 'C5', 'I1', 'I2', 'I3', 'K1', 'K2', 'K3', 'K4', 'B1', 'B2', 'B3'];
  const comp = (grade, mgr, self, comments = {}) => {
    const items = {};
    CODES.forEach((code, i) => { if (!comps.length || comps.includes(code)) items[code] = { rating: mgr[i] || '', self: self[i] || '', comment: comments[code] || '', by: mgr[i] ? 'DM' : '' }; });
    return { grade, items, updated: D(-6), scale: 5 };
  };
  const pid = n => PREFIX + n;
  const one = (p, k, o) => ({ id: `${p}-o${k}`, mode: 'Video call', actions: [], qa: {}, grow: {}, ...o });
  const act = (p, k, text, owner, due, done) => ({ id: `${p}-a${k}`, text, owner, due, done: !!done, doneOn: done ? (due < ymd(TODAY) ? due : D(-1)) : '' });
  const fb = (p, k, date, type, source, text, sbi) => ({ id: `${p}-f${k}`, date, type, source, from: '', text, sbi: sbi || null });
  const sug = (p, k, kind, sev, dest, title, detail, evidence, payload, src) => ({ id: `${p}-s${k}`, state: 'new', created: D(-1), origin: 'rules', kind, sev, dest, title, detail, evidence, payload: payload || {}, source: src });
  const people = [];

  /* 1. Asha — C2: stretched, outside offer, certification, leave clash */
  {
    const p = pid('asha'), o3 = `${p}-o3`;
    people.push({ id: p, grade: 'C2', roleId: roles.eng.id, created: M(5, 2),
      profile: { name: 'Asha Rao', empId: 'DEMO-1042', designation: 'Senior Data Engineer', team: 'Retail Analytics – Snowflake migration', email: 'asha.rao@example.com', location: 'Bengaluru', workMode: 'Hybrid',
        doj: M(30, 14), since: M(14, 1), lastPromo: M(16, 1), exp: '5.5', education: 'B.E. Computer Science', certs: 'Snowflake SnowPro Core (in progress)', dob: `1997-${D(4).slice(5)}`, cadence: 'Monthly',
        projects: 'Leads the data-model migration for the retail client; owns the reconciliation pipeline.', aspirations: 'Move towards a solution-architect role within two years.', personal: 'Sister’s wedding in late November; travels home for Diwali.' },
      oneOnOnes: [
        one(p, 1, { date: M(2, 9), morale: '4', updates: 'Finished the source-to-target mapping for the sales domain.', notes: 'Talked about the migration plan and her role in client workshops.', next: M(1, 10),
          qa: { wellbeing: { wb_score: '4', wb_workload: 'Heavy but manageable' }, project: { pj_status: 'On track', pj_done: 'Sales domain mapping signed off by the client', pj_blockers: 'None right now' }, learning: { ln_courses: 'SnowPro Core prep course — 40% done' }, career: { cr_where: 'Solution architect in about two years' } },
          actions: [act(p, 1, 'Share the architecture review checklist', 'me', M(2, 20), true), act(p, 2, 'Book the SnowPro exam slot', 'them', M(1, 5), true)] }),
        one(p, 2, { date: M(1, 10), morale: '3', updates: 'Reconciliation job automated; data model at 70%.', concerns: 'Two releases are landing in the same sprint.', next: M(0, 6),
          qa: { wellbeing: { wb_score: '3', wb_workload: 'Heavy but manageable', wb_balance: 'Working late a couple of days a week before the release' }, project: { pj_status: 'Some risks', pj_done: 'Automated the reconciliation job — saves about 6 hours a week', pj_blockers: 'Waiting on the client for VPN access for the new environment' },
            orgtrain: { ot_planned: 'Wants to run a dbt demo for the data guild' }, leave: { lv_planned: 'Probably a week in late November, will confirm dates' } },
          grow: { goal: 'Run client workshops independently', reality: 'Has co-facilitated two; nervous about pushback from senior stakeholders', options: 'Shadow Vikram once more; prepare a pre-read; dry run with me', way: 'Co-lead the next workshop, then lead the one after' },
          actions: [act(p, 3, 'Chase client IT for the VPN access', 'me', M(1, 20), false), act(p, 4, 'Prepare the workshop pre-read', 'them', M(0, 3), true)] }),
        one(p, 3, { date: weekday(D(-3), -1), morale: '2', notes: 'She has received an offer from another company, but said she would prefer to stay if there is a clear growth path. Feels stretched across two releases.', concerns: 'Still blocked on VPN access — third week now.', support: 'Needs me to escalate the VPN access with the client delivery head.', next: D(26),
          qa: { wellbeing: { wb_score: '2', wb_workload: 'Too heavy', wb_balance: 'Not really — weekends too in the last fortnight' }, project: { pj_status: 'Some risks', pj_done: 'Data model 90% complete', pj_next: 'UAT support and cut-over plan', pj_blockers: 'Still waiting on VPN access from the client', pj_client: 'Client is happy with progress but pushing on dates' },
            technical: { tc_challenge: 'Performance of the large fact table joins', tc_deepen: 'Snowflake performance tuning and clustering' }, certs: { ce_progress: `SnowPro Core exam booked on ${D(37).slice(8)} ${new Date(D(37) + 'T00:00:00').toLocaleString('en-US', { month: 'short' })}` },
            orgtrain: { ot_planned: `dbt demo to the data guild on ${new Date(D(52) + 'T00:00:00').getDate()} ${new Date(D(52) + 'T00:00:00').toLocaleString('en-US', { month: 'short' })}` },
            leave: { lv_planned: 'Confirmed — sister’s wedding, see leave dates' }, manager: { mg_more: 'More visibility on upcoming priorities would help me plan' }, engagement: { en_stay: 'The work and the team; growth is what I am worried about' } },
          actions: [act(p, 5, 'Escalate VPN access to the client delivery head', 'me', D(2), false), act(p, 6, 'List what can move out of the current sprint', 'them', D(4), false)] }),
      ],
      goals: [
        { id: `${p}-g1`, title: 'Complete the retail data-model migration', desc: 'All 6 subject areas migrated and reconciled', metric: 'Sign-off by client data owner', category: 'Business', cycle: CK, weight: '40', start: M(1, 1), due: D(37), status: 'At risk', progress: 70, updates: [{ date: M(1, 10), text: 'Delayed by VPN access issue' }] },
        { id: `${p}-g2`, title: 'Achieve SnowPro Core certification', category: 'Development', cycle: CK, weight: '20', due: D(37), status: 'On track', progress: 60, updates: [] },
        { id: `${p}-g3`, title: 'Lead two client workshops', category: 'Customer', cycle: CK, weight: '20', due: D(80), status: 'On track', progress: 25, updates: [] },
        { id: `${p}-g4`, title: 'Deliver one knowledge session', category: 'People / team', cycle: CK, weight: '20', due: D(60), status: 'On track', progress: 10, updates: [] },
        { id: `${p}-g0`, title: 'Build the sales-domain pipelines', category: 'Business', cycle: PK, weight: '100', status: 'Done', progress: 100, updates: [] }],
      idp: [{ id: `${p}-i1`, title: 'SnowPro Core certification', type: 'Certification', status: 'In progress', skillId: '', due: D(37), notes: 'Prep course 60% done', created: M(2, 9) }],
      feedback: [
        fb(p, 1, M(1, 15), 'Achievement', 'Manager', 'Situation: Month-end close for the retail client\nBehaviour: Automated the manual reconciliation job end to end\nImpact: Saves about 6 hours of effort every week', { situation: 'Month-end close for the retail client', behaviour: 'Automated the manual reconciliation job end to end', impact: 'Saves about 6 hours of effort every week', next: '' }),
        fb(p, 2, M(2, 22), 'Kudos', 'Customer', 'Client data owner appreciated the clear mapping document.')],
      strengths: [{ id: `${p}-st1`, text: 'Strong ownership of complex data models', source: 'Manager', date: M(2, 9) }],
      devAreas: [{ id: `${p}-dv1`, text: 'Presenting confidently to senior stakeholders', source: 'Manager', date: M(1, 10) }],
      skills: skills([3, 3, 4, 4, 2, 2, 1, 3, 2, 3]),
      kpi: { [CK]: { 'dk-util': { actual: '92', rating: '4' }, 'dk-otd': { actual: '88', rating: '2', comment: 'Blocked by client VPN access' }, 'dk-def': { actual: '2', rating: '4' }, 'dk-csat': { actual: '4.6', rating: '4' } } },
      comp: { [CK]: comp('C2', ['3', '3', '4', '3', '4', '3', '3', '2', '3', '4', '3', 'X', '3', '3', '2'], ['4', '3', '4', '4', '4', '3', '3', '3', '3', '4', '3', 'X', '3', '3', '3'], { C3: 'Owns the migration end to end', I3: 'Avoids presenting to senior client stakeholders', B3: 'No external content yet' }) },
      ninebox: { perf: '3', pot: '3', risk: '', riskReason: '' },
      talent: { readiness: 'Ready in 1–2 cycles', targetRole: 'Grade C3 → solution architect track', keyPerson: true, careerNotes: 'Wants architecture exposure; consider design-authority shadowing.' },
      leaves: [],
      reviews: { [PK]: { rating: '4', well: 'Delivered the sales-domain pipelines ahead of plan.', improve: 'Stakeholder presentations.', next: 'Lead workshops; certification.', promo: 'Ready in 1–2 cycles', saved: M(4, 25), calibrated: true } },
      docs: [{ id: `${p}-d1`, fileId: `${p}-d1`, owner: p, name: 'asha_peer_feedback.txt', docType: 'Feedback', date: M(1, 18), placed: { strength: 1, achievement: 1 },
        text: 'Peer feedback for Asha Rao\nShe successfully automated the reconciliation job, saving 6 hours every week.\nShe is the go-to person for the data model.\nShe could share her knowledge more widely in the guild.' }],
      suggestions: [
        sug(p, 1, 'attrition', 3, 'risk', 'Possible flight risk — hold a stay conversation with Asha', 'Signals she may be considering leaving. Hold a stay conversation soon, understand the driver and agree what you can act on.', 'She has received an offer from another company, but said she would prefer to stay if there is a clear growth path.', {}, { kind: 'oneonone', ref: o3, date: D(-3), label: '1:1 (latest)' }),
        sug(p, 2, 'repeat', 3, 'action_me', 'Same kind of blocker two meetings running — escalate', 'It wasn’t resolved since last time. Escalate or change approach, and tell her what you did.', 'Still waiting on VPN access from the client', {}, { kind: 'oneonone', ref: o3, date: D(-3), label: '1:1 (latest)' }),
        sug(p, 3, 'wellbeing', 3, 'action_me', 'Check in on Asha’s wellbeing', 'Have a private, supportive conversation. Ask what would help — flexibility, lighter load, time off.', 'Rated their wellbeing 2/5', {}, { kind: 'oneonone', ref: o3, date: D(-3), label: '1:1 (latest)' }),
        sug(p, 4, 'leave', 1, 'leave', 'Record leave for her sister’s wedding', 'Record it so you can plan cover and spot clashes with deadlines.', 'Sister’s wedding in late November', { from: weekday(D(35)), to: weekday(D(39), -1), type: 'Planned leave' }, { kind: 'oneonone', ref: o3, date: D(-3), label: '1:1 (latest)' }),
        sug(p, 5, 'present', 1, 'action_me', 'Support Asha’s upcoming dbt demo to the data guild', 'Offer a dry run, help find an audience, and attend if you can.', 'dbt demo to the data guild', { due: D(52) }, { kind: 'oneonone', ref: o3, date: D(-3), label: '1:1 (latest)' })],
      tasks: [], stay: [], pips: [],
    });
  }

  /* 2. Vikram — S1: star, key person, mentor, ready now */
  {
    const p = pid('vikram');
    people.push({ id: p, grade: 'S1', roleId: roles.lead.id, created: M(5, 2),
      profile: { name: 'Vikram Singh', empId: 'DEMO-0877', designation: 'Lead Data Engineer', team: 'Retail Analytics – tech lead', email: 'vikram.singh@example.com', location: 'Pune', workMode: 'Office',
        doj: `${+D(12).slice(0, 4) - 5}${D(12).slice(4)}`, since: M(26, 1), lastPromo: M(20, 1), exp: '9', education: 'M.Tech', certs: 'SnowPro Advanced Architect; AWS Solutions Architect Associate', projects: 'Tech lead for the retail programme; design authority member.', aspirations: 'Principal engineer / practice lead.' },
      oneOnOnes: [3, 2, 1, 0].map((k, i) => one(p, i + 1, { date: k === 0 ? weekday(D(-5), -1) : M(k, 8), morale: ['4', '4', '5', '4'][i], updates: ['Design authority sign-off for the retail model', 'Mentoring two juniors on Matillion', 'Ran the Snowflake cost-optimisation session for 40 people', 'Hiring panel for three senior roles'][i], next: k === 0 ? D(25) : '',
        qa: { wellbeing: { wb_score: ['4', '4', '5', '4'][i], wb_workload: 'About right' }, project: { pj_status: 'On track' },
          ...(i === 2 ? { orgtrain: { ot_delivered: 'Snowflake cost-optimisation session — 40 attendees' }, orgcontrib: { oc_mentoring: 'Mentoring Priya and Arjun' } } : {}),
          ...(i === 3 ? { orgcontrib: { oc_hiring: 'Took 6 interviews this month for senior roles' }, career: { cr_where: 'Principal engineer within a year' }, leave: { lv_planned: 'Three days in late November' } } : {}) },
        actions: i === 3 ? [act(p, 1, 'Nominate Vikram for the principal-track programme', 'me', D(10), false)] : [] })),
      goals: [
        { id: `${p}-g1`, title: 'Deliver the retail programme release 2', category: 'Business', cycle: CK, weight: '40', due: D(45), status: 'On track', progress: 75, updates: [] },
        { id: `${p}-g2`, title: 'Grow two engineers to independent delivery', category: 'People / team', cycle: CK, weight: '30', due: D(90), status: 'On track', progress: 60, updates: [] },
        { id: `${p}-g3`, title: 'Publish two blog posts on Snowflake cost', category: 'Development', cycle: CK, weight: '30', due: D(70), status: 'On track', progress: 50, updates: [] }],
      idp: [{ id: `${p}-i1`, title: 'Principal-track leadership programme', type: 'Stretch assignment', status: 'Planned', due: D(60), created: M(1, 8) }],
      feedback: [fb(p, 1, M(1, 9), 'Kudos', 'Peer', 'Ran a brilliant Snowflake cost-optimisation session; the team cut warehouse spend by 18%.'),
        fb(p, 2, M(0, 2) <= ymd(TODAY) ? M(0, 2) : D(-2), 'Achievement', 'Manager', 'Situation: Hiring drive for senior engineers\nBehaviour: Took 6 interviews and wrote detailed, timely feedback\nImpact: Two strong offers accepted', { situation: 'Hiring drive for senior engineers', behaviour: 'Took 6 interviews and wrote detailed, timely feedback', impact: 'Two strong offers accepted' })],
      strengths: [{ id: `${p}-st1`, text: 'Technical depth and calm leadership under pressure', source: 'Manager', date: M(2, 8) }],
      devAreas: [{ id: `${p}-dv1`, text: 'Delegating more instead of fixing issues himself', source: 'Manager', date: M(2, 8) }],
      skills: skills([5, 4, 5, 4, 3, 3, 3, 4, 3, 4]),
      kpi: { [CK]: { 'dk-lutil': { actual: '81', rating: '3' }, 'dk-team': { actual: '96', rating: '4' }, 'dk-ment': { actual: '8', rating: '5' }, 'dk-sess': { actual: '2', rating: '4' }, 'dk-lcsat': { actual: '4.8', rating: '5' } } },
      comp: { [CK]: comp('S1', ['4', '4', '5', '4', '5', '3', '4', '4', '4', '4', '3', '4', '3', '4', '3'], ['4', '4', '4', '4', '5', '4', '4', '4', '4', '4', '3', '4', '4', '4', '4'], { I3: 'Cost-optimisation session for 40 people', K4: 'Six interviews this month' }) },
      ninebox: { perf: '3', pot: '3', risk: 'Low', retention: 'Principal-track nomination' },
      talent: { readiness: 'Ready now', targetRole: 'Grade S2 – principal track', keyPerson: true },
      leaves: [{ id: `${p}-l1`, from: weekday(D(36)), to: weekday(D(38), -1), type: 'Planned leave', status: 'Approved', notes: 'Family function', created: M(0, 1) }],
      stay: [{ id: `${p}-y1`, date: M(2, 20), answers: { enjoy: 'Solving hard design problems with a good team', learn: 'Want to learn more about practice building', satisfy: 'More say in technology choices', leave: 'Only if growth stalls', support: 'Sponsor me for the principal track' }, actions: 'Nominate for principal track; include in design authority' }],
      reviews: { [PK]: { rating: '4', well: 'Programme delivery and mentoring.', improve: 'Delegation.', promo: 'Ready in 1–2 cycles', saved: M(4, 25), calibrated: true }, [CK]: { rating: '4', well: 'Strong delivery, mentoring and hiring.', improve: 'Delegation', next: 'Principal track', promo: 'Ready now', saved: D(-2) } },
      docs: [], suggestions: [], tasks: [], pips: [],
    });
  }

  /* 3. Priya — C1: new-ish joiner, under-challenged, morale falling, no 1:1 this month */
  {
    const p = pid('priya');
    people.push({ id: p, grade: 'C1', roleId: roles.eng.id, created: M(5, 2),
      profile: { name: 'Priya Menon', empId: 'DEMO-1311', designation: 'Associate Data Engineer', team: 'Retail Analytics – support pod', location: 'Chennai', workMode: 'Remote', doj: M(9, 15), since: M(9, 15), exp: '1.5', cadence: 'Fortnightly', education: 'B.Tech IT', aspirations: 'Become a strong Snowflake developer.' },
      oneOnOnes: [3, 2, 1].map((k, i) => one(p, i + 1, { date: M(k, 12), morale: ['4', '3', '2'][i], updates: ['Fixed three data-quality defects', 'Mostly monitoring jobs this month', 'Same monitoring work; not much new'][i],
        qa: { wellbeing: { wb_score: ['4', '3', '2'][i], wb_workload: ['About right', 'Too light', 'Too light'][i] }, project: { pj_status: 'On track' },
          learning: { ln_next: ['Snowflake basics', 'Want to learn Matillion properly', 'Would like a real development task, not just monitoring'][i] }, ...(i === 2 ? { engagement: { en_team: 'Feels a bit left out of design discussions' } } : {}) },
        notes: i === 2 ? 'Feels the work is repetitive and she is not being challenged. Bored with monitoring.' : '' })),
      goals: [{ id: `${p}-g1`, title: 'Own the data-quality dashboard', category: 'Business', cycle: CK, weight: '50', due: D(60), status: 'At risk', progress: 20, updates: [] },
        { id: `${p}-g2`, title: 'Complete the Matillion learning path', category: 'Development', cycle: CK, weight: '50', due: D(45), status: 'On track', progress: 40, updates: [] }],
      idp: [], feedback: [fb(p, 1, M(3, 20), 'Achievement', 'Manager', 'Fixed three long-standing data-quality defects in her first quarter.')], strengths: [], devAreas: [],
      skills: skills([2, 1, 3, 2, 2, 1, 0, 2, 1, 1]),
      kpi: { [CK]: { 'dk-util': { actual: '64', rating: '2', comment: 'Under-allocated' }, 'dk-otd': { actual: '97', rating: '4' } } },
      comp: { [CK]: comp('C1', ['3', '3', '3', '3', '3', 'X', '3', '2', '3', '3', '3', 'X', '3', 'X', 'X'], ['3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', 'X', '3', 'X', 'X']) },
      ninebox: { perf: '2', pot: '3', risk: 'Medium', riskReason: 'Under-challenged; repetitive work' },
      talent: { readiness: 'Ready in 2+ cycles' },
      leaves: [{ id: `${p}-l1`, from: weekday(D(10)), to: weekday(D(10)), type: 'Planned leave', status: 'Approved', created: M(0, 1) }],
      suggestions: [sug(p, 1, 'underused', 2, 'idp', 'Find a stretch assignment for Priya', 'She may be under-challenged. Offer a stretch assignment, a new technology, or ownership of a small initiative.', 'Feels the work is repetitive and she is not being challenged.', { type: 'Stretch assignment' }, { kind: 'oneonone', ref: `${p}-o3`, date: M(1, 12), label: '1:1 last month' }),
        sug(p, 2, 'conflict', 2, 'action_me', 'Address a working-relationship concern raised by Priya', 'Listen privately and agree next steps.', 'Feels a bit left out of design discussions', {}, { kind: 'oneonone', ref: `${p}-o3`, date: M(1, 12), label: '1:1 last month' })],
      reviews: { [PK]: { rating: '3', well: 'Quick to learn the support processes.', improve: 'Technical breadth.', saved: M(4, 25), calibrated: true } },
      docs: [], tasks: [], stay: [], pips: [],
    });
  }

  /* 4. Rohan — C3: improvement plan, below grade, self vs manager gap */
  {
    const p = pid('rohan');
    people.push({ id: p, grade: 'C3', roleId: roles.eng.id, created: M(5, 2),
      profile: { name: 'Rohan Kulkarni', empId: 'DEMO-0954', designation: 'Data Engineer', team: 'Retail Analytics – ingestion', location: 'Hyderabad', workMode: 'Hybrid', doj: M(40, 2), since: M(12, 1), exp: '4', cadence: 'Weekly', education: 'B.E. Electronics', personal: 'Caring for a parent at the moment; prefers early-start days.' },
      oneOnOnes: [3, 2, 1, 0].map((k, i) => one(p, i + 1, { date: k === 0 ? weekday(D(-8), -1) : M(k, 14), morale: ['3', '2', '3', '3'][i], updates: ['Ingestion jobs delivered late again', 'Agreed improvement plan', 'Two sprint commitments met', 'Improving; code reviews better'][i],
        concerns: i === 1 ? 'Feels the estimates were not realistic' : '',
        private: i === 1 ? 'Mentioned his father’s hospital stay in passing — may explain some of the late evenings. Do not raise unless he does.' : '',
        qa: { project: { pj_status: ['Off track', 'Some risks', 'On track', 'On track'][i] }, wellbeing: { wb_score: ['3', '2', '3', '3'][i] }, admin: { ad_mandatory: i === 3 ? 'Some pending' : 'All up to date' } },
        actions: i === 3 ? [act(p, 1, 'Pair with Vikram on the next design review', 'them', D(7), false)] : [] })),
      goals: [{ id: `${p}-g1`, title: 'Meet sprint commitments for 3 consecutive sprints', category: 'Business', cycle: CK, weight: '60', due: D(15), status: 'At risk', progress: 50, updates: [] },
        { id: `${p}-g2`, title: 'Zero critical review comments on ingestion code', category: 'Process', cycle: CK, weight: '40', due: D(30), status: 'On track', progress: 40, updates: [] }],
      idp: [{ id: `${p}-i1`, title: 'Estimation and planning workshop', type: 'Training / course', status: 'Done', skillId: 'c:C3', due: M(1, 25), doneOn: M(1, 25), created: M(2, 14) }],
      feedback: [fb(p, 1, M(2, 10), 'Constructive', 'Manager', 'Situation: Sprint 14 ingestion delivery\nBehaviour: Did not flag the delay until the day of the demo\nImpact: Client demo had to be rescheduled', { situation: 'Sprint 14 ingestion delivery', behaviour: 'Did not flag the delay until the day of the demo', impact: 'Client demo had to be rescheduled', next: 'Raise risks at stand-up as soon as they appear' }),
        fb(p, 2, M(0, 1) <= ymd(TODAY) ? M(0, 1) : D(-1), 'Kudos', 'Peer', 'Much clearer code-review responses this sprint.')],
      strengths: [], devAreas: [{ id: `${p}-dv1`, text: 'Raising risks early; realistic estimates', source: 'Manager', date: M(2, 14) }],
      skills: skills([2, 3, 3, 2, 3, 2, 1, 1, 1, 2]),
      kpi: { [CK]: { 'dk-util': { actual: '86', rating: '3' }, 'dk-otd': { actual: '71', rating: '1', comment: 'Two missed sprints' }, 'dk-def': { actual: '7', rating: '2' }, 'dk-csat': { actual: '4.0', rating: '3' } } },
      comp: { [CK]: comp('C3', ['3', '2', '1', '2', '3', '2', '3', '2', '2', '3', '2', 'X', '3', 'X', 'X'], ['3', '3', '4', '3', '3', '3', '3', '3', '3', '3', '3', 'X', '3', 'X', 'X'], { C3: 'Two missed sprint commitments', C2: 'Risks raised late' }) },
      ninebox: { perf: '1', pot: '2', risk: 'Medium', riskReason: 'Improvement plan pressure' },
      talent: { readiness: 'Not a near-term move' },
      pips: [{ id: `${p}-pip`, start: M(2, 15), end: D(15), status: 'Active', reason: 'Repeated missed sprint commitments and late risk escalation.', support: 'Estimation workshop; pairing with Vikram; weekly planning check with me.',
        items: [{ id: 'pi1', text: 'Meet sprint commitments for 3 consecutive sprints', measure: 'Sprint reports', status: 'Partly met' }, { id: 'pi2', text: 'Raise delivery risks within 24 hours', measure: 'Stand-up notes', status: 'Met' }, { id: 'pi3', text: 'Reduce UAT defects to 3 or fewer per release', measure: 'Defect tracker', status: 'Not yet met' }],
        checkins: [{ id: 'pc1', date: M(1, 2), progress: 'At risk', notes: 'One sprint met, one missed. Estimation workshop done.' }, { id: 'pc2', date: D(-20), progress: 'On track', notes: 'Two sprints met in a row. Risk escalation much better.' }] }],
      leaves: [{ id: `${p}-l1`, from: weekday(D(-26)), to: weekday(D(-25)), type: 'Sick leave', status: 'Taken', created: D(-26) }],
      reviews: { [PK]: { rating: '2', well: 'Good technical fundamentals.', improve: 'Delivery reliability.', saved: M(4, 25), calibrated: true }, [CK]: { rating: '3', saved: D(-1) } },
      docs: [{ id: `${p}-d1`, fileId: `${p}-d1`, owner: p, name: 'rohan_self_assessment.txt', docType: 'Self-assessment', date: D(-9),
        text: 'Self-assessment — Rohan Kulkarni\nI think my estimates were too optimistic and the scope kept changing.\nI completed the estimation workshop and I now raise risks at stand-up.\nI would like to learn more about Matillion orchestration.\nI feel the improvement plan is fair but stressful.' }],
      suggestions: [sug(p, 1, 'wellbeing', 2, 'action_me', 'Check in on Rohan’s wellbeing during the improvement plan', 'Plans are stressful. Acknowledge progress and keep check-ins supportive.', 'I feel the improvement plan is fair but stressful.', {}, { kind: 'doc', ref: `${p}-d1`, date: D(-9), label: 'Self-assessment: rohan_self_assessment.txt' }),
        sug(p, 2, 'training', 1, 'idp', 'Agree a learning plan: Matillion orchestration', 'Turn this into a development-plan item with a target date.', 'I would like to learn more about Matillion orchestration.', { type: 'Training / course' }, { kind: 'doc', ref: `${p}-d1`, date: D(-9), label: 'Self-assessment: rohan_self_assessment.txt' })],
      tasks: [{ id: `${p}-t1`, text: 'Share PIP progress summary with HR', owner: 'me', due: D(-2), done: false, created: D(-10), source: 'Added manually' }], stay: [],
    });
  }

  /* 5. Neha — S2: high performer, thought leadership, promotion candidate, conference */
  {
    const p = pid('neha');
    people.push({ id: p, grade: 'S2', roleId: roles.lead.id, created: M(5, 2),
      profile: { name: 'Neha Iyer', empId: 'DEMO-0612', designation: 'Senior Consultant – Data Architecture', team: 'Pre-sales & architecture', location: 'Mumbai', workMode: 'Hybrid', doj: M(70, 1), since: M(18, 1), lastPromo: M(30, 1), exp: '11', education: 'MBA, B.E.', certs: 'SnowPro Advanced Architect; Databricks Data Engineer Professional; TOGAF', aspirations: 'Practice lead for data architecture.' },
      oneOnOnes: [2, 1, 0].map((k, i) => one(p, i + 1, { date: k === 0 ? weekday(D(-2), -1) : M(k, 6), morale: ['4', '5', '5'][i], updates: ['Won the logistics pre-sales bid', 'Published a KX article on lakehouse patterns', 'Speaker slot confirmed at a data conference'][i], next: k === 0 ? D(27) : '',
        qa: { wellbeing: { wb_score: ['4', '5', '5'][i], wb_workload: 'Heavy but manageable' }, ...(i === 1 ? { orgcontrib: { oc_sharing: 'KX article on lakehouse patterns; 3 LinkedIn posts' } } : {}),
          ...(i === 2 ? { orgtrain: { ot_planned: 'Conference talk on Snowflake + dbt patterns' }, career: { cr_where: 'Practice lead within a year', cr_next: 'Needs P1 exposure: owning a proposition' } } : {}) } })),
      goals: [{ id: `${p}-g1`, title: 'Win two pre-sales bids', category: 'Business', cycle: CK, weight: '40', due: D(60), status: 'On track', progress: 50, updates: [] },
        { id: `${p}-g2`, title: 'Build the lakehouse proposition', category: 'Business', cycle: CK, weight: '30', due: D(75), status: 'On track', progress: 65, updates: [] },
        { id: `${p}-g3`, title: 'Speak at one external event', category: 'Development', cycle: CK, weight: '30', due: D(21), status: 'On track', progress: 90, updates: [] }],
      idp: [{ id: `${p}-i1`, title: 'Shadow the practice head on proposition reviews', type: 'Shadowing', status: 'In progress', due: D(50), created: M(2, 6) }],
      feedback: [fb(p, 1, M(2, 18), 'Achievement', 'Stakeholder', 'Won the logistics pre-sales bid — client cited her architecture walkthrough as the deciding factor.'),
        fb(p, 2, M(1, 20), 'Kudos', 'Customer', 'Client CTO thanked her for the clear roadmap workshop.')],
      strengths: [{ id: `${p}-st1`, text: 'Client-facing architecture and storytelling', source: 'Manager', date: M(2, 6) }],
      skills: skills([5, 3, 5, 5, 3, 4, 3, 3, 4, 5]),
      kpi: { [CK]: { 'dk-lutil': { actual: '78', rating: '3' }, 'dk-team': { actual: '98', rating: '5' }, 'dk-ment': { actual: '5', rating: '3' }, 'dk-sess': { actual: '3', rating: '5' }, 'dk-lcsat': { actual: '4.9', rating: '5' } } },
      comp: { [CK]: comp('S2', ['5', '4', '3', '4', '5', '4', '3', '5', '4', '4', '4', '3', '4', '5', '5'], ['4', '4', '4', '4', '5', '4', '4', '4', '4', '4', '4', '4', '4', '5', '5'], { B3: 'KX article, LinkedIn posts, conference talk', B2: 'Lakehouse proposition' }) },
      ninebox: { perf: '3', pot: '3', risk: 'Low' },
      talent: { readiness: 'Ready now', targetRole: 'Grade S3 / practice lead', keyPerson: true },
      leaves: [{ id: `${p}-l1`, from: weekday(D(20)), to: weekday(D(21)), type: 'Training / conference', status: 'Approved', notes: 'Speaking at a data conference', created: M(0, 1) }],
      reviews: { [PK]: { rating: '4', well: 'Pre-sales wins.', saved: M(4, 25), calibrated: true }, [CK]: { rating: '5', well: 'Two bids, proposition, external talk.', promo: 'Ready now', saved: D(-1), calibrated: true } },
      docs: [{ id: `${p}-d1`, fileId: `${p}-d1`, owner: p, name: 'client_appreciation_email.txt', docType: 'Feedback', date: M(1, 20), placed: { achievement: 1 },
        text: 'From: Client CTO\nThank you to Neha for an outstanding roadmap workshop. The team was delighted with the clarity of the target architecture.' }],
      suggestions: [], tasks: [], stay: [], pips: [],
    });
  }

  /* 6. Arjun — A2: graduate, onboarding, mandatory training pending, new to 1:1s */
  {
    const p = pid('arjun');
    people.push({ id: p, grade: 'A2', roleId: roles.grad.id, created: M(3, 1),
      profile: { name: 'Arjun Mehta', empId: 'DEMO-1520', designation: 'Graduate Engineer Trainee', team: 'Graduate programme – data track', location: 'Bengaluru', workMode: 'Office', doj: M(3, 1), since: M(3, 1), exp: '0.3', probationEnd: D(20), confirmed: false, education: 'B.Tech CSE (2026)', aspirations: 'Data engineering' },
      oneOnOnes: [2, 1, 0].map((k, i) => one(p, i + 1, { date: k === 0 ? weekday(D(-1), -1) : M(k, 15), morale: ['4', '4', '4'][i], updates: ['Completed SQL bootcamp', 'First Snowflake assignment done', 'Shadowing Vikram on the retail project'][i], next: k === 0 ? D(28) : '',
        qa: { wellbeing: { wb_score: '4', wb_workload: 'About right' }, learning: { ln_courses: ['SQL bootcamp', 'Snowflake fundamentals', 'Matillion basics'][i] }, admin: { ad_mandatory: i === 2 ? 'Some pending' : 'All up to date', ad_issues: i === 2 ? 'Laptop needs more RAM for local dbt runs' : '' } } })),
      goals: [{ id: `${p}-g1`, title: 'Complete the graduate data-track curriculum', category: 'Development', cycle: CK, weight: '60', due: D(60), status: 'On track', progress: 55, updates: [] },
        { id: `${p}-g2`, title: 'Deliver one production-ready pipeline under supervision', category: 'Business', cycle: CK, weight: '40', due: D(80), status: 'On track', progress: 20, updates: [] }],
      idp: [{ id: `${p}-i1`, title: 'Snowflake fundamentals badge', type: 'Certification', status: 'In progress', due: D(30), created: M(2, 15) }],
      feedback: [fb(p, 1, M(1, 25), 'Kudos', 'Peer', 'Asked great questions in the design review and documented the outcome for everyone.')], strengths: [], devAreas: [],
      skills: skills([2, 1, 2, 1, 2, 1, 0, 1, 1, 0]),
      kpi: { [CK]: { 'dk-train': { actual: '70', rating: '3' }, 'dk-assign': { actual: '92', rating: '4' } } },
      comp: { [CK]: comp('A2', ['3', '3', '3', '3', '2', '3', '3', '3', '3', '4', '3', 'X', '3', '3', '3'], ['3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', 'X', '3', '3', '3']) },
      ninebox: { perf: '2', pot: '2' },
      talent: { readiness: 'Not a near-term move' },
      leaves: [], suggestions: [sug(p, 1, 'admin', 1, 'action_them', 'Complete pending mandatory trainings', 'A practical item — closing it builds good habits early.', 'Some mandatory items pending', { due: D(7) }, { kind: 'oneonone', ref: `${p}-o3`, date: D(-1), label: '1:1 (latest)' }),
        sug(p, 2, 'admin', 1, 'action_me', 'Raise a laptop RAM upgrade request for Arjun', 'Quick win — unblocks local dbt runs.', 'Laptop needs more RAM for local dbt runs', {}, { kind: 'oneonone', ref: `${p}-o3`, date: D(-1), label: '1:1 (latest)' })],
      reviews: {}, docs: [], tasks: [], stay: [], pips: [],
    });
  }

  people.forEach(p => { p.demo = true; for (const k of ['oneOnOnes', 'goals', 'idp', 'feedback', 'docs', 'strengths', 'devAreas', 'pips', 'stay', 'tasks', 'leaves', 'suggestions']) p[k] = p[k] || []; for (const k of ['skills', 'kpi', 'reviews', 'ninebox', 'comp', 'talent']) p[k] = p[k] || {}; });

  /* organisation-level demo items */
  const guideline = { id: PREFIX + 'guide', fileId: PREFIX + 'guide', owner: '_org', name: 'Appraisal_guidelines_demo.txt', category: 'Review / rating guidelines', date: M(1, 3),
    text: `Half-yearly appraisal guidelines (demo)\nManagers must complete competency assessments for every reportee by the 15th of the last month of the cycle.\nSelf-assessments are due two weeks before the manager assessment deadline.\nRatings should follow the distribution guideline: 5% far exceeds, 15% exceeds, 60% meets, 15% partially meets, 5% does not meet.\nAny rating of 1 or 5 requires written evidence.\nPromotion nominations must be supported by competency evidence at the next grade.\nEmployees on an improvement plan are not eligible for promotion in the same cycle.`,
    points: [] };
  guideline.points = guideline.text.split('\n').filter(l => /must|should|due|requires|not eligible/i.test(l));
  const LEAD = ['direction', 'coaching', 'feedback', 'delegation', 'communication', 'performance', 'trust', 'decisions', 'advocacy', 'change', 'wellbeing', 'hiring'];
  const selfR = [4, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 4];
  const leadSelf = { demo: true, items: Object.fromEntries(LEAD.map((id, i) => [id, { rating: selfR[i], evidence: i === 1 ? 'GROW conversations with most of the team' : '' }])), strengths: 'Fair performance conversations; calm in escalations.', focus: 'Delegation and giving visibility on upcoming priorities.', updated: D(-3) };
  const resp = (n, a, s, st, co) => ({ responseId: `demo-r${n}`, received: ymd(TODAY).slice(0, 7), answers: Object.fromEntries(LEAD.map((id, i) => [id, a[i]]).filter(([, v]) => v)), comments: { start: s, stop: st, continue: co } });
  const upward = { demo: true, surveyId: PREFIX + 'survey', created: D(-20), responses: [
    resp(1, [4, 4, 3, 2, 3, 4, 4, 4, 4, 3, 3, 4], 'Share upcoming priorities earlier', 'Jumping into technical details too quickly', 'Regular 1:1s and honest feedback'),
    resp(2, [3, 4, 4, 2, 2, 4, 5, 3, 4, 3, 4, 0], 'Delegate more design decisions to the team', '', 'Backing the team with the client'),
    resp(3, [4, 3, 3, 3, 3, 3, 4, 4, 5, 4, 3, 4], 'Monthly team-level updates on the roadmap', 'Last-minute changes to sprint scope', 'Recognising good work in public'),
    resp(4, [5, 4, 4, 2, 3, 4, 4, 4, 4, 3, 4, 3], 'Career conversations every quarter', '', 'Being approachable')] };
  return { CK, roles: Object.values(roles), guideline, leadSelf, upward, people };
}

/* ---------------- second demo team (dataset 2) ----------------
   Same situations as dataset 1, different (fictional) people, ids, employee numbers,
   locations and projects — so two line managers can each get their own team. */
const DATASET2 = [
  // [old full, new full, old key, new key, old emp, new emp, old city, new city]
  ['Asha Rao', 'Divya Sharma', 'asha', 'divya', 'DEMO-1042', 'DEMO-2042', 'Bengaluru', 'Gurugram'],
  ['Rohan Kulkarni', 'Karthik Reddy', 'rohan', 'karthik', 'DEMO-0954', 'DEMO-1954', 'Hyderabad', 'Chennai'],
  ['Neha Iyer', 'Sneha Patil', 'neha', 'sneha', 'DEMO-0612', 'DEMO-1612', 'Mumbai', 'Pune'],
  ['Priya Menon', 'Ananya Ghosh', 'priya', 'ananya', 'DEMO-1311', 'DEMO-2311', 'Chennai', 'Kolkata'],
  ['Vikram Singh', 'Farhan Qureshi', 'vikram', 'farhan', 'DEMO-0877', 'DEMO-1877', 'Pune', 'Noida'],
  ['Arjun Mehta', 'Nikhil Joshi', 'arjun', 'nikhil', 'DEMO-1520', 'DEMO-2520', 'Bengaluru', 'Ahmedabad'],
];
const PREFIX2 = 'demo-b-';
function buildDemo2(org) {
  const d = buildDemo(org);
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { ...d, people: d.people.map(p => {
    const row = DATASET2.find(r => p.id === PREFIX + r[2]);
    let j = JSON.stringify(p);
    /* the person's own ids, employee number and city */
    j = j.split(PREFIX + row[2]).join(PREFIX2 + row[3]).split(row[4]).join(row[5]).split(`"${row[6]}"`).join(`"${row[7]}"`);
    /* every name mentioned anywhere (people refer to each other in notes) */
    for (const r of DATASET2) {
      const [of, nf] = [r[0], r[1]], [ofn, nfn] = [of.split(' ')[0], nf.split(' ')[0]];
      j = j.split(of).join(nf).split(of.toLowerCase().replace(' ', '.')).join(nf.toLowerCase().replace(' ', '.'));
      j = j.replace(new RegExp(`\\b${esc(ofn)}\\b`, 'g'), nfn).replace(new RegExp(`\\b${esc(ofn.toLowerCase())}_`, 'g'), nfn.toLowerCase() + '_');
    }
    j = j.replace(/Retail Analytics/g, 'Banking Analytics');
    const q = JSON.parse(j); q.dataset = 2; return q;
  }) };
}

module.exports = { buildDemo, buildDemo2, PREFIX, PREFIX2 };

/* ---------------- main ---------------- */
if (require.main === module) (async () => {
  c('\nTeam Desk — demo data loader\n');
  const major = parseInt(process.versions.node, 10);
  if (major < 18) { bad(`Node.js 18 or newer is needed (you have ${process.version}).`); process.exit(1); }
  let version;
  try { version = await connect(); } catch (e) { bad(e.message); process.exit(1); }
  ok(`Connected to Team Desk ${version} at ${BASE.replace('127.0.0.1', 'localhost')}`);

  let st = await api('GET', '/api/status');
  if (!st.configured) { bad('Team Desk is not set up yet. Finish the set-up wizard in the browser (choose a demo folder and password), then run this again.'); process.exit(1); }
  c(`  Data folder: ${st.dataDir}`);
  if (!st.unlocked) {
    for (let i = 0; i < 3 && !st.unlocked; i++) {
      const pw = await askHidden('  Team Desk is locked. Password: ');
      try { await api('POST', '/api/unlock', { password: pw }); st = await api('GET', '/api/status'); ok('Unlocked'); }
      catch (e) { warn(e.message); }
    }
    if (!st.unlocked) { bad('Could not unlock.'); process.exit(1); }
  }

  const data = await api('GET', '/api/data');
  const org = data.org || {};
  const real = (data.reportees || []).filter(p => !String(p.id).startsWith(PREFIX));
  const existingDemo = (data.reportees || []).filter(p => String(p.id).startsWith(PREFIX));

  if (REMOVE) {
    if (!existingDemo.length && !(org.roles || []).some(r => r.id.startsWith(PREFIX))) { ok('No demo data found — nothing to remove.'); process.exit(0); }
    await api('POST', '/api/backups'); ok('Backup snapshot taken');
    for (const p of existingDemo) { await api('DELETE', `/api/reportees/${p.id}`); }
    ok(`Removed ${existingDemo.length} demo reportees`);
    org.roles = (org.roles || []).filter(r => !r.id.startsWith(PREFIX));
    org.guidelines = (org.guidelines || []).filter(g => !g.id.startsWith(PREFIX));
    await api('DELETE', `/api/files/_org/${PREFIX}guide`).catch(() => {});
    for (const k of Object.keys(org.leadership?.self || {})) if (org.leadership.self[k]?.demo) delete org.leadership.self[k];
    for (const k of Object.keys(org.leadership?.upward || {})) if (org.leadership.upward[k]?.demo) delete org.leadership.upward[k];
    await api('PUT', '/api/org', org); ok('Removed demo roles, guideline and leadership entries');
    await api('POST', '/api/data/changed');
    c('\n  Done. The open Team Desk tab will refresh in a few seconds.\n');
    process.exit(0);
  }

  if (real.length && !FORCE) {
    bad(`This data folder already has ${real.length} real reportee(s): ${real.map(p => p.profile?.name).slice(0, 5).join(', ')}${real.length > 5 ? '…' : ''}`);
    c('    Demo data should go into a separate demo folder so it never mixes with real records.');
    c('    In Team Desk: Settings › Data & backups › Open a different data folder › pick an empty folder (e.g. Documents/TeamDesk Demo).');
    c('    To add demo data here anyway, run again with --force.\n');
    process.exit(2);
  }
  if (existingDemo.length) warn(`Demo data already present — it will be refreshed (${existingDemo.length} demo reportees).`);
  if (!org.settings) { bad('The app hasn’t saved its settings yet. Open Team Desk in the browser once, then run this again.'); process.exit(1); }
  if (!process.stdin.isTTY || has('--yes')) { /* non-interactive */ }
  else {
    const a = await ask(`  Add 6 demo reportees (grades A2, C1, C2, C3, S1, S2) to this folder? [Y/n] `);
    if (/^n/i.test(a)) { c('  Cancelled.\n'); process.exit(0); }
  }

  const demo = buildDemo(org);
  await api('POST', '/api/backups'); ok('Backup snapshot taken (Settings › Data & backups to restore)');

  /* organisation-level items */
  org.roles = [...(org.roles || []).filter(r => !r.id.startsWith(PREFIX)), ...demo.roles];
  org.guidelines = [...(org.guidelines || []).filter(g => !g.id.startsWith(PREFIX)), demo.guideline];
  org.leadership = org.leadership || { self: {}, upward: {} };
  org.leadership.self = org.leadership.self || {}; org.leadership.upward = org.leadership.upward || {};
  if (!org.leadership.self[demo.CK] || org.leadership.self[demo.CK].demo) org.leadership.self[demo.CK] = demo.leadSelf;
  if (!org.leadership.upward[demo.CK] || org.leadership.upward[demo.CK].demo) org.leadership.upward[demo.CK] = demo.upward;
  if (!org.settings.managerName) org.settings.managerName = 'Demo Manager';
  await api('PUT', '/api/org', org);
  await api('PUT', `/api/files/_org/${PREFIX}guide`, Buffer.from(demo.guideline.text), { 'Content-Type': 'text/plain', 'X-File-Name': encodeURIComponent(demo.guideline.name) });
  ok(`Added ${demo.roles.length} roles with KPIs, an appraisal guideline, and your leadership self-assessment + 4 anonymous upward-feedback responses`);

  /* reportees */
  for (const p of demo.people) {
    await api('PUT', `/api/reportees/${p.id}`, p);
    for (const d of p.docs) await api('PUT', `/api/files/${p.id}/${d.fileId}`, Buffer.from(d.text), { 'Content-Type': 'text/plain', 'X-File-Name': encodeURIComponent(d.name) });
    ok(`${p.profile.name.padEnd(15)} Grade ${p.grade.padEnd(3)} ${String(p.oneOnOnes.length).padStart(2)} 1:1s · ${p.goals.length} goals · ${p.suggestions.length} suggestions${p.pips.length ? ' · improvement plan' : ''}${p.leaves.length ? ' · leave' : ''}`);
  }
  await api('POST', '/api/data/changed');

  c(`
  Done! Your open Team Desk tab refreshes by itself within ~10 seconds
  (or reload the page). Good places to start the demo:
    • Dashboard            — attention list, 1:1 status, team leave clash
    • Asha Rao (C2)        — outside offer, blocker repeated, suggestions to review
    • Rohan Kulkarni (C3)  — active improvement plan, self vs manager gaps
    • Neha Iyer (S2)       — star / promotion-ready, conference leave
    • Insights › Calibration, Competency map, Engagement; My leadership

  Remove it again any time:  node scripts/seed-demo.js --remove
`);
})().catch(e => { bad(e.status === 423 ? 'Team Desk locked itself — unlock it and run again.' : e.message); process.exit(1); });

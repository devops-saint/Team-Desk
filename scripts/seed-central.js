#!/usr/bin/env node
/*
 * Team Desk — demo data loader for the CENTRAL server
 * ------------------------------------------------------------
 * Creates fictional accounts and six fictional reportees so sign-in, approval,
 * profile choice, line-manager and people-manager views, ownership moves,
 * reports and the audit log can be demonstrated. Run it while the central
 * server is running. Choose a scenario:
 *
 *   node scripts/seed-central.js                    full: 4 accounts across all groups, reportees split
 *                                                   between two line managers (default)
 *   node scripts/seed-central.js --scenario both    case 1: an administrator + one user who is BOTH
 *                                                   line manager and people manager (owns all six)
 *   node scripts/seed-central.js --scenario lm      case 2: an administrator + one user who is ONLY a
 *                                                   line manager (owns all six)
 *
 *   Accounts already exist? Give a demo team to an existing line manager (no accounts are created):
 *   node scripts/seed-central.js --admin-email admin@company.com --dataset 1 --email manager1@company.com
 *   node scripts/seed-central.js --admin-email admin@company.com --dataset 2 --email manager2@company.com
 *       dataset 1: Asha, Rohan, Neha, Priya, Vikram, Arjun
 *       dataset 2: Divya, Karthik, Sneha, Ananya, Farhan, Nikhil (same situations, different people)
 *       Comma-separate several emails to split one team. People managers see every team automatically.
 *   --remove --dataset 2                 remove only that demo team (without --dataset: all demo data)
 *
 *   --url https://teamdesk.company.com   (default http://localhost:8080)
 *   --remove                             remove every demo account and demo reportee
 *
 * Running a different scenario on the same server switches over: demo
 * reportees move to the right manager and demo accounts not needed are removed.
 *
 * On a brand-new server (no accounts yet) the first demo account becomes the
 * administrator. On a server that already has accounts, pass an administrator:
 *   --admin-email you@company.com   (the password is asked for, or set TEAMDESK_ADMIN_PASSWORD)
 * Other options: --domain demo.example (email domain for demo accounts), --force, --yes
 * All names and details are invented.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const readline = require('readline');
const { buildDemo, buildDemo2, PREFIX, PREFIX2 } = require('./seed-demo');

const args = process.argv.slice(2);
const has = f => args.includes(f);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argVal('--url', process.env.TEAMDESK_URL || 'http://localhost:8080').replace(/\/+$/, '');
const DOMAIN = argVal('--domain', 'demo.example');
const PASSWORD = 'TeamDesk@Demo1';
const c = (...a) => console.log(...a);
const ok = m => c(`  \x1b[32m✓\x1b[0m ${m}`), warn = m => c(`  \x1b[33m!\x1b[0m ${m}`), bad = m => c(`  \x1b[31m✗\x1b[0m ${m}`);

const PEOPLE = {
  sanjay: { name: 'Sanjay Kapoor', role: 'Team Desk administrator' },
  anita: { name: 'Anita Desai', role: 'Delivery head' },
  kavya: { name: 'Kavya Menon', role: 'Engineering manager' },
  meera: { name: 'Meera Pillai', role: 'HR business partner' },
  rahul: { name: 'Rahul Verma', role: 'New manager' },
  demo: { name: 'Demo Loader', role: 'Temporary account that loads demo reportees, removed straight after' },
};
const ALL6 = ['asha', 'rohan', 'neha', 'priya', 'vikram', 'arjun'];
/* two separate demo teams: same situations, different fictional people */
const DATASETS = {
  1: { label: 'Demo team 1', ids: ALL6.map(k => PREFIX + k), has: id => id.startsWith(PREFIX) && !id.startsWith(PREFIX2) },
  2: { label: 'Demo team 2', ids: ['divya', 'karthik', 'sneha', 'ananya', 'farhan', 'nikhil'].map(k => PREFIX2 + k), has: id => id.startsWith(PREFIX2) },
};
const DS_KEY = argVal('--dataset', '');
if (DS_KEY && !DATASETS[DS_KEY]) { console.log(`  Unknown dataset “${DS_KEY}”. Use --dataset 1 or --dataset 2.`); process.exit(1); }
/* groups: null = left waiting for approval; [] with admin = administrator only */
const SCENARIOS = {
  full: { label: 'Full demo — every group, two teams', admin: 'sanjay',
    accounts: { sanjay: [], anita: ['lm', 'pm'], kavya: ['lm'], meera: ['pm'], rahul: null },
    owners: { anita: ['asha', 'rohan', 'neha'], kavya: ['priya', 'vikram', 'arjun'] } },
  both: { label: 'Case 1 — administrator + one user who is line manager AND people manager', admin: 'sanjay',
    accounts: { sanjay: [], kavya: ['lm', 'pm'] }, owners: { kavya: ALL6 } },
  lm: { label: 'Case 2 — administrator + one user who is only a line manager', admin: 'sanjay',
    accounts: { sanjay: [], kavya: ['lm'] }, owners: { kavya: ALL6 } },
};
const SC_KEY = argVal('--scenario', 'full');
const SC = SCENARIOS[SC_KEY];
if (!SC) { bad(`Unknown scenario “${SC_KEY}”. Use: full, both or lm.`); process.exit(1); }
const email = k => `${k}.${PEOPLE[k].name.split(' ')[1].toLowerCase()}@${DOMAIN}`;
const GL = { lm: 'Line manager', pm: 'People manager' };

/* ---------------- HTTP client with its own cookie + CSRF token ---------------- */
function client() {
  let cookie = '', csrf = '';
  const call = async (method, url, body, headers = {}) => {
    const isBuf = Buffer.isBuffer(body);
    let r;
    try {
      r = await fetch(BASE + url, { method, headers: { ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-td-csrf': csrf } : {}), ...(body !== undefined && !isBuf ? { 'content-type': 'application/json' } : {}), ...headers },
        body: body === undefined ? undefined : isBuf ? body : JSON.stringify(body) });
    } catch { throw new Error(`Can't reach Team Desk at ${BASE}. Start the central server (npm run server) or pass --url.`); }
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const j = await r.json().catch(() => ({}));
    if (j && j.csrf) csrf = j.csrf;
    if (!r.ok) { const e = new Error(j.error || r.statusText); e.status = r.status; throw e; }
    return j;
  };
  return { call };
}
function askHidden(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) rl.output.write(s); else rl.output.write(s.replace(/[^\r\n]/g, '•')); };
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}
function ask(q) { return new Promise(r => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, a => { rl.close(); r(a.trim()); }); }); }

/* default organisation configuration (same as the browser app writes on first use) */
function defaultShared() {
  const ctx = { window: {} };
  try { vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'framework-default.js'), 'utf8'), ctx); } catch {}
  const skills = [['Snowflake', 'Data platform'], ['Matillion', 'Data platform'], ['SQL', 'Data platform'], ['Data Modelling', 'Engineering'], ['Python / Scripting', 'Engineering'],
    ['Cloud Platforms (AWS / Azure / GCP)', 'Engineering'], ['DevOps / CI-CD', 'Engineering'], ['Testing & Data Quality', 'Engineering'], ['BI & Reporting', 'Analytics'], ['Domain / Industry Knowledge', 'Functional']]
    .map(([name, cat], i) => ({ id: `sk${i + 1}x${Date.now().toString(36)}`, name, cat }));
  return { settings: { cycleStartMonth: 4, distribution: { 1: 5, 2: 15, 3: 60, 4: 15, 5: 5 } }, framework: ctx.window.DEFAULT_FRAMEWORK || null, roles: [], skills, guidelines: [] };
}
async function signIn(k, profile) {
  const cl = client();
  const st = await cl.call('POST', '/api/auth/login', { email: email(k), password: PASSWORD });
  if (st.mustChange) throw new Error(`${email(k)} must change their password first — sign in once in the browser.`);
  if (profile && st.profile !== profile) await cl.call('POST', '/api/auth/profile', { profile });
  return cl;
}

(async () => {
  c(`\nTeam Desk — central demo data loader\n  Scenario: ${SC.label}\n`);
  const anon = client();
  let st;
  try { st = await anon.call('GET', '/api/status'); } catch (e) { bad(e.message); process.exit(1); }
  if (st.mode !== 'central') { bad(`${BASE} is the personal Team Desk. For that one use: npm run demo`); process.exit(1); }
  ok(`Connected to Team Desk ${st.version} (central) at ${BASE}`);

  /* ---------- administrator session ---------- */
  let admin = client(), adminKey = null, me;
  if (!st.hasUsers) {
    if (has('--remove')) { ok('No accounts yet — nothing to remove.'); process.exit(0); }
    adminKey = SC.admin;
    await admin.call('POST', '/api/auth/register', { name: PEOPLE[adminKey].name, email: email(adminKey), password: PASSWORD });
    ok(`Registered ${PEOPLE[adminKey].name} (${email(adminKey)}) — the first account, so the administrator`);
  } else {
    const aEmail = argVal('--admin-email', process.env.TEAMDESK_ADMIN_EMAIL || '');
    try {
      if (aEmail) await admin.call('POST', '/api/auth/login', { email: aEmail, password: process.env.TEAMDESK_ADMIN_PASSWORD || await askHidden(`  Password for ${aEmail}: `) });
      else {
        /* no administrator given: try the demo administrators from an earlier run */
        let lastErr;
        for (const k of ['sanjay', 'anita']) {
          try { admin = client(); await admin.call('POST', '/api/auth/login', { email: email(k), password: PASSWORD }); adminKey = k; break; } catch (e) { lastErr = e; }
        }
        if (!adminKey) throw lastErr;
      }
    } catch (e) {
      bad(aEmail ? `Could not sign in as ${aEmail}: ${e.message}` : 'This server already has accounts. Run again with --admin-email <your administrator email>.');
      process.exit(1);
    }
  }
  me = await admin.call('GET', '/api/status');
  if (!me.user?.admin) { bad(`${me.user?.email} is not an administrator.`); process.exit(1); }
  if (me.mustChange) { bad('That administrator must change their password first — sign in once in the browser.'); process.exit(1); }
  ok(`Signed in as administrator ${me.user.name} (${me.user.email})`);
  /* demo data from an earlier version had Anita as administrator AND line manager; administrators no longer have
     reportees, so hand administration to the demo administrator Sanjay and make Anita a normal account */
  if (adminKey === 'anita') {
    let us = (await admin.call('GET', '/api/admin/users')).users, sj = us.find(u => u.email === email('sanjay'));
    if (!sj) { await anon.call('POST', '/api/auth/register', { name: PEOPLE.sanjay.name, email: email('sanjay'), password: PASSWORD, note: PEOPLE.sanjay.role }); sj = (await admin.call('GET', '/api/admin/users')).users.find(u => u.email === email('sanjay')); }
    if (sj.status === 'pending') await admin.call('POST', `/api/admin/users/${sj.id}/approve`, { groups: [], admin: true });
    else await admin.call('PUT', `/api/admin/users/${sj.id}`, { groups: [], admin: true, status: 'active' });
    admin = client(); await admin.call('POST', '/api/auth/login', { email: email('sanjay'), password: PASSWORD }); adminKey = 'sanjay';
    const an = (await admin.call('GET', '/api/admin/users')).users.find(u => u.email === email('anita'));
    await admin.call('PUT', `/api/admin/users/${an.id}`, { admin: false, groups: an.groups.length ? an.groups : ['pm'] });
    me = await admin.call('GET', '/api/status');
    ok(`Administration moved to ${PEOPLE.sanjay.name} (${email('sanjay')}) — administrators no longer have reportees`);
  }
  let users = (await admin.call('GET', '/api/admin/users')).users;
  const refresh = async () => { users = (await admin.call('GET', '/api/admin/users')).users; };
  const userOf = k => users.find(u => u.email === email(k));
  const isMe = k => userOf(k)?.id === me.user.id;
  /* when you run it with your own administrator account, the demo administrator isn't needed */
  if (!me.user.email.endsWith('@' + DOMAIN) && SC.accounts[SC.admin] && !SC.accounts[SC.admin].length) delete SC.accounts[SC.admin];
  const demoReps = async () => (await admin.call('GET', '/api/admin/reportees')).filter(r => String(r.id).startsWith(PREFIX));
  /* a temporary line-manager account loads (or deletes) demo reportees, so no real person's password is needed */
  async function withLoader(fn) {
    if (!userOf('demo')) {
      try { await anon.call('POST', '/api/auth/register', { name: PEOPLE.demo.name, email: email('demo'), password: PASSWORD, requested: ['lm'], note: PEOPLE.demo.role }); }
      catch (e) { bad(`Could not create the temporary loader account ${email('demo')}: ${e.message}${e.status === 403 ? '\n    Registration is closed or limited to some email domains (Administration › Server settings). Open it for a minute, or pass --domain <an allowed domain>.' : ''}`); process.exit(1); }
      await refresh();
    }
    const lu = userOf('demo');
    if (lu.status === 'pending') await admin.call('POST', `/api/admin/users/${lu.id}/approve`, { groups: ['lm'], admin: false });
    else await admin.call('PUT', `/api/admin/users/${lu.id}`, { status: 'active', groups: ['lm'] });
    await refresh();
    try { await fn(await signIn('demo', 'lm'), userOf('demo')); }
    finally { await admin.call('DELETE', `/api/admin/users/${lu.id}`).catch(e => warn(`Could not remove ${email('demo')}: ${e.message}`)); await refresh(); }
  }
  async function setupOrg(ds = 1) {
    const anyProfile = (await admin.call('GET', '/api/status')).profiles[0];
    if (anyProfile) await admin.call('POST', '/api/auth/profile', { profile: anyProfile });
    let org = (await admin.call('GET', '/api/data')).org || defaultShared();
    if (!org.framework) org = { ...defaultShared(), ...org, framework: defaultShared().framework };
    if (!org.skills?.length) org.skills = defaultShared().skills;
    org.settings = { cycleStartMonth: 4, ...(org.settings || {}) };
    const demo = ds === 2 ? buildDemo2(org) : buildDemo(org);
    org.roles = [...(org.roles || []).filter(r => !r.id.startsWith(PREFIX)), ...demo.roles];
    org.guidelines = [...(org.guidelines || []).filter(g => !g.id.startsWith(PREFIX)), demo.guideline];
    await admin.call('PUT', '/api/org', org);
    await admin.call('PUT', `/api/files/_org/${PREFIX}guide`, Buffer.from(demo.guideline.text), { 'content-type': 'text/plain', 'x-file-name': encodeURIComponent(demo.guideline.name) });
    ok(`Organisation: ${demo.roles.length} demo roles with KPIs and an appraisal guideline`);
    return demo;
  }

  /* ---------- remove everything demo ---------- */
  if (has('--remove')) {
    await admin.call('POST', '/api/admin/backups').catch(() => {});
    ok('Backup snapshot taken');
    const reps = (await demoReps()).filter(r => !DS_KEY || DATASETS[DS_KEY].has(r.id));
    if (reps.length) await withLoader(async (cl, lu) => {
      const away = reps.filter(r => r.managerId !== lu.id).map(r => r.id);
      if (away.length) await admin.call('POST', '/api/admin/transfer', { ids: away, to: lu.id });
      for (const r of reps) await cl.call('DELETE', `/api/reportees/${r.id}`);
      ok(`Removed ${reps.length} demo reportees${DS_KEY ? ` (${DATASETS[DS_KEY].label})` : ''}`);
    });
    if (DS_KEY && (await demoReps()).length) { c(`\n  Done. The other demo team is still there — remove it with --remove --dataset ${DS_KEY === '1' ? 2 : 1}, or everything with --remove.\n`); process.exit(0); }
    const org = (await admin.call('GET', '/api/data').catch(() => ({}))).org;
    if (org) {
      org.roles = (org.roles || []).filter(r => !String(r.id).startsWith(PREFIX));
      org.guidelines = (org.guidelines || []).filter(g => !String(g.id).startsWith(PREFIX));
      await admin.call('PUT', '/api/org', org); await admin.call('DELETE', `/api/files/_org/${PREFIX}guide`).catch(() => {});
      ok('Removed demo roles and guideline');
    }
    await refresh();
    for (const k of Object.keys(PEOPLE)) {
      const u = userOf(k); if (!u) continue;
      if (isMe(k)) { warn(`${u.name} is the administrator you are signed in as, so the account stays`); continue; }
      try { if (u.status === 'pending') await admin.call('POST', `/api/admin/users/${u.id}/reject`); else await admin.call('DELETE', `/api/admin/users/${u.id}`); ok(`Removed account ${u.email}`); }
      catch (e) { warn(`${u.email}: ${e.message}`); }
    }
    c('\n  Done.\n'); process.exit(0);
  }

  /* ---------- existing accounts: put a demo team under existing line manager(s) ---------- */
  const targetArg = argVal('--email', argVal('--to', ''));
  if (targetArg) {
    const dsKey = DS_KEY || '1', DS = DATASETS[dsKey];
    const targets = targetArg.split(',').map(e => e.trim().toLowerCase()).filter(Boolean).map(e => {
      const u = users.find(x => x.email === e);
      if (!u) { bad(`No account with the email ${e}.`); process.exit(1); }
      if (u.status !== 'active') { bad(`${u.name} (${e}) is ${u.status}. Approve or enable the account first.`); process.exit(1); }
      if (u.admin) { bad(`${u.name} (${e}) is an administrator. Administrators don’t have reportees — choose a line manager.`); process.exit(1); }
      if (!u.groups.includes('lm')) { bad(`${u.name} (${e}) is not in the Line manager group. Add it in Administration › Users & access first.`); process.exit(1); }
      return u;
    });
    const per = Math.ceil(DS.ids.length / targets.length);
    const plan = targets.map((u, i) => ({ u, ids: DS.ids.slice(i * per, (i + 1) * per) })).filter(x => x.ids.length);
    const demoPreview = dsKey === '2' ? buildDemo2(defaultShared()) : buildDemo(defaultShared());
    const label = id => { const p = demoPreview.people.find(q => q.id === id); return `${p.profile.name} (${p.grade})`; };
    c(`\n  ${DS.label} → plan:`); plan.forEach(x => c(`    ${x.u.name.padEnd(20)} ← ${x.ids.map(label).join(', ')}`));
    const other = (await demoReps()).filter(r => !DS.has(r.id));
    if (other.length) c(`    (The other demo team, ${other.length} reportees, is left as it is.)`);
    const pms = users.filter(u => u.status === 'active' && u.groups.includes('pm'));
    if (pms.length) c(`    People managers who will see them: ${pms.map(u => u.name).join(', ')}`);
    c('');
    if (process.stdin.isTTY && !has('--yes')) {
      const a = await ask('  These are fictional demo reportees. Add them? [Y/n] ');
      if (/^n/i.test(a)) { c('  Cancelled.\n'); process.exit(0); }
    }
    await admin.call('POST', '/api/admin/backups'); ok('Backup snapshot taken');
    const demo = await setupOrg(+dsKey);
    await withLoader(async (cl, lu) => {
      const old = (await demoReps()).filter(r => DS.has(r.id) && r.managerId !== lu.id).map(r => r.id);
      if (old.length) await admin.call('POST', '/api/admin/transfer', { ids: old, to: lu.id });   // refresh this team from an earlier run
      for (const p of demo.people) {
        await cl.call('PUT', `/api/reportees/${p.id}`, p);
        for (const d of p.docs) await cl.call('PUT', `/api/files/${p.id}/${d.fileId}`, Buffer.from(d.text), { 'content-type': 'text/plain', 'x-file-name': encodeURIComponent(d.name) });
      }
      for (const x of plan) {
        await admin.call('POST', '/api/admin/transfer', { ids: x.ids, to: x.u.id });
        ok(`${x.u.name}: ${x.ids.map(label).join(', ')}`);
      }
    });
    c(`
  Done! ${DS.label} now belongs to ${plan.map(x => x.u.name).join(' and ')}.
    • Sign in as ${plan.map(x => x.u.email).join(' / ')} (Line manager profile) to work with them.
    • ${pms.length ? `${pms.map(u => u.name).join(', ')} (People manager profile) see them in the Organisation view, view only.` : 'Anyone in the People manager group sees them in the Organisation view, view only.'}
    • Their profiles show “moved from Demo Loader” — the temporary account that loaded them.
    • Leadership self-assessment and upward feedback are personal, so they are not added for existing accounts.
${dsKey === '1' ? `
  Add the second demo team for another line manager:
    node scripts/seed-central.js --admin-email ${me.user.email} --dataset 2 --email <other line manager>` : ''}
  Remove this team:   node scripts/seed-central.js --admin-email ${me.user.email} --remove --dataset ${dsKey}
  Remove all demo:    node scripts/seed-central.js --admin-email ${me.user.email} --remove
`);
    process.exit(0);
  }

  /* ---------- safety: don't mix with real records ---------- */
  const real = (await admin.call('GET', '/api/admin/reportees')).filter(r => !String(r.id).startsWith(PREFIX));
  if (real.length && !has('--force')) {
    bad(`This server already has ${real.length} real reportee(s). Demo data should go on a separate demo server.`);
    c('    Start a second server for demos, e.g.:  node server/central.js --port 8090 --data ~/teamdesk-demo-data --key-file ~/teamdesk-demo.key');
    c('    To add demo data here anyway, run again with --force.\n');
    process.exit(2);
  }
  if (process.stdin.isTTY && !has('--yes')) {
    const a = await ask(`  Set up this demo on ${BASE}? [Y/n] `);
    if (/^n/i.test(a)) { c('  Cancelled.\n'); process.exit(0); }
  }
  await admin.call('POST', '/api/admin/backups'); ok('Backup snapshot taken');

  /* ---------- accounts for this scenario ---------- */
  for (const [k, groups] of Object.entries(SC.accounts)) {
    const P = PEOPLE[k];
    if (!userOf(k)) {
      try { await anon.call('POST', '/api/auth/register', { name: P.name, email: email(k), password: PASSWORD, requested: groups && groups.length ? groups : ['lm'], note: P.role }); }
      catch (e) { bad(`Could not register ${email(k)}: ${e.message}${e.status === 403 ? ' (use --domain with an allowed email domain, or open registration in Administration › Server settings)' : ''}`); process.exit(1); }
      await refresh();
    }
    const u = userOf(k);
    if (groups === null) { if (u.status !== 'pending') warn(`${P.name} was already approved earlier`); }
    else {
      const wantAdmin = !groups.length;   // demo administrators are administrators only (no reportees)
      if (u.status === 'pending') await admin.call('POST', `/api/admin/users/${u.id}/approve`, { groups, admin: wantAdmin });
      else {
        if (u.status === 'disabled') await admin.call('PUT', `/api/admin/users/${u.id}`, { status: 'active' });
        /* add groups first, then remove any not wanted (a line manager keeps the group while reportees are moved) */
        await admin.call('PUT', `/api/admin/users/${u.id}`, { groups: [...new Set([...u.groups.filter(g => !(wantAdmin && g === 'lm')), ...groups])], admin: wantAdmin });
      }
    }
  }
  await refresh();

  /* ---------- organisation configuration (roles, guideline) ---------- */
  const demo = await setupOrg();

  /* ---------- demo reportees already on the server move to this scenario's manager ---------- */
  const existing = await demoReps();
  for (const [k, list] of Object.entries(SC.owners)) {
    const ids = existing.filter(r => list.includes(r.id.slice(PREFIX.length)) && r.managerId !== userOf(k).id).map(r => r.id);
    if (ids.length) { await admin.call('POST', '/api/admin/transfer', { ids, to: userOf(k).id }); ok(`Moved ${ids.length} demo reportee(s) from an earlier demo to ${PEOPLE[k].name}`); }
  }

  /* ---------- reportees, per line manager ---------- */
  const first = Object.keys(SC.owners)[0];
  for (const [k, list] of Object.entries(SC.owners)) {
    const cl = await signIn(k, 'lm');
    for (const p of demo.people.filter(x => list.includes(x.id.slice(PREFIX.length)))) {
      await cl.call('PUT', `/api/reportees/${p.id}`, p);
      for (const d of p.docs) await cl.call('PUT', `/api/files/${p.id}/${d.fileId}`, Buffer.from(d.text), { 'content-type': 'text/plain', 'x-file-name': encodeURIComponent(d.name) });
      ok(`${PEOPLE[k].name}: ${p.profile.name.padEnd(15)} grade ${p.grade.padEnd(3)} ${String(p.oneOnOnes.length).padStart(2)} 1:1s${p.pips.length ? ' · improvement plan' : ''}${p.leaves.length ? ' · leave' : ''}`);
    }
    const mine = (await cl.call('GET', '/api/data')).me || {};
    mine.settings = { ...(mine.settings || {}), managerName: PEOPLE[k].name };
    mine.leadership = mine.leadership || { self: {}, upward: {} };
    mine.leadership.self = { ...(mine.leadership.self || {}), [demo.CK]: demo.leadSelf };
    if (k === first) { mine.leadership.upward = { ...(mine.leadership.upward || {}), [demo.CK]: demo.upward }; mine.leadership.teamFeedback = { ...(mine.leadership.teamFeedback || {}), [demo.CK]: demo.teamFb }; }
    await cl.call('PUT', '/api/me', mine);
  }

  /* ---------- final groups (drop extras), and remove demo accounts this scenario doesn't use ---------- */
  await refresh();
  for (const [k, groups] of Object.entries(SC.accounts)) {
    const u = userOf(k);
    if (groups !== null && u.groups.join() !== groups.join()) await admin.call('PUT', `/api/admin/users/${u.id}`, { groups });
  }
  for (const k of Object.keys(PEOPLE)) {
    if (SC.accounts[k] !== undefined) continue;
    const u = userOf(k); if (!u) continue;
    if (isMe(k)) { warn(`${u.name} (from an earlier demo) is the administrator signed in, so the account stays`); continue; }
    try { if (u.status === 'pending') await admin.call('POST', `/api/admin/users/${u.id}/reject`); else await admin.call('DELETE', `/api/admin/users/${u.id}`); ok(`Removed ${u.name}, not used in this scenario`); }
    catch (e) { warn(`${u.email}: ${e.message}`); }
  }

  /* ---------- summary ---------- */
  await refresh();
  const line = k => { const u = userOf(k); if (!u) return ''; const g = u.status === 'pending' ? 'Waiting for approval' : [...u.groups.map(x => GL[x]), u.admin && 'Administrator'].filter(Boolean).join(' + ');
    const owns = SC.owners[k] ? ` · owns ${SC.owners[k].length === 6 ? 'all six reportees' : SC.owners[k].map(x => x[0].toUpperCase() + x.slice(1)).join(', ')}` : ''; return `    ${u.email.padEnd(32)} ${g}${owns}`; };
  const keys = Object.keys(SC.accounts);
  const others = keys.some(k => isMe(k)) ? [] : [`    ${me.user.email.padEnd(32)} Administrator${me.user.email.endsWith('@' + DOMAIN) ? '' : ' (you)'}`];
  c(`
  Done! Sign in at ${BASE} — every demo password is  ${PASSWORD}

${[...others, ...keys.map(line).filter(Boolean)].join('\n')}
${SC_KEY === 'both' ? `
  What to show: sign in as Kavya → she is asked to choose a profile.
    Line manager   → her six reportees, full edit.
    People manager → the Organisation view of the same six, view only (private notes hidden).
  Sign in as the administrator to show Users & access, Audit log and Server settings.` : SC_KEY === 'lm' ? `
  What to show: sign in as Kavya → she goes straight to her six reportees (no profile choice,
    no Administration menu). Sign in as the administrator to approve accounts, change Kavya's
    groups (e.g. add People manager) and see the Audit log.` : ''}

  Switch scenario any time:  node scripts/seed-central.js --scenario full | both | lm
  Remove it all:             node scripts/seed-central.js --remove${me.user.email.endsWith('@' + DOMAIN) ? '' : ` --admin-email ${me.user.email}`}
`);
})().catch(e => { bad(e.message); process.exit(1); });

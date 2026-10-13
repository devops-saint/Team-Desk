#!/usr/bin/env node
/*
 * Team Desk — demo data loader for the CENTRAL server
 * ------------------------------------------------------------
 * Creates fictional accounts in every group and six fictional reportees split
 * across two line managers, so sign-in, approval, profile choice, line-manager
 * and people-manager views, ownership moves, reports and the audit log can all
 * be demonstrated. Run it while the central server is running:
 *
 *   node scripts/seed-central.js                       (server at http://localhost:8080)
 *   node scripts/seed-central.js --url https://teamdesk.company.com
 *   node scripts/seed-central.js --remove              remove the demo accounts and reportees
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
const { buildDemo, PREFIX } = require('./seed-demo');

const args = process.argv.slice(2);
const has = f => args.includes(f);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argVal('--url', process.env.TEAMDESK_URL || 'http://localhost:8080').replace(/\/+$/, '');
const DOMAIN = argVal('--domain', 'demo.example');
const PASSWORD = 'TeamDesk@Demo1';
const c = (...a) => console.log(...a);
const ok = m => c(`  \x1b[32m✓\x1b[0m ${m}`), warn = m => c(`  \x1b[33m!\x1b[0m ${m}`), bad = m => c(`  \x1b[31m✗\x1b[0m ${m}`);

const PEOPLE = {
  anita: { name: 'Anita Desai', groups: ['lm', 'pm'], reportees: ['asha', 'rohan', 'neha'], role: 'Delivery head — line manager and people manager' },
  kavya: { name: 'Kavya Menon', groups: ['lm'], reportees: ['priya', 'vikram', 'arjun'], role: 'Engineering manager — line manager' },
  meera: { name: 'Meera Pillai', groups: ['pm'], reportees: [], role: 'HR business partner — people manager' },
  rahul: { name: 'Rahul Verma', groups: null, reportees: [], role: 'New manager — waiting for approval' },
};
const email = k => `${k}.${PEOPLE[k].name.split(' ')[1].toLowerCase()}@${DOMAIN}`;

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
async function signIn(k, pw = PASSWORD, profile) {
  const cl = client();
  const st = await cl.call('POST', '/api/auth/login', { email: email(k), password: pw });
  if (st.mustChange) throw new Error(`${email(k)} must change their password first — sign in once in the browser.`);
  if (profile && st.profile !== profile) await cl.call('POST', '/api/auth/profile', { profile });
  return cl;
}

(async () => {
  c('\nTeam Desk — central demo data loader\n');
  const anon = client();
  let st;
  try { st = await anon.call('GET', '/api/status'); } catch (e) { bad(e.message); process.exit(1); }
  if (st.mode !== 'central') { bad(`${BASE} is the personal Team Desk. For that one use: npm run demo`); process.exit(1); }
  ok(`Connected to Team Desk ${st.version} (central) at ${BASE}`);

  /* ---------- administrator session ---------- */
  let admin, adminIsDemo = false;
  if (!st.hasUsers) {
    if (has('--remove')) { ok('No accounts yet — nothing to remove.'); process.exit(0); }
    admin = client();
    await admin.call('POST', '/api/auth/register', { name: PEOPLE.anita.name, email: email('anita'), password: PASSWORD });
    adminIsDemo = true;
    ok(`Created ${PEOPLE.anita.name} (${email('anita')}) — the first account, so she is the administrator`);
  } else {
    const aEmail = argVal('--admin-email', process.env.TEAMDESK_ADMIN_EMAIL || '');
    admin = client();
    try {
      if (!aEmail) { await admin.call('POST', '/api/auth/login', { email: email('anita'), password: PASSWORD }); adminIsDemo = true; }
      else await admin.call('POST', '/api/auth/login', { email: aEmail, password: process.env.TEAMDESK_ADMIN_PASSWORD || await askHidden(`  Password for ${aEmail}: `) });
    } catch (e) {
      bad(aEmail ? `Could not sign in as ${aEmail}: ${e.message}` : 'This server already has accounts. Run again with --admin-email <an administrator’s email>.');
      process.exit(1);
    }
    const me = await admin.call('GET', '/api/status');
    if (!me.user?.admin) { bad(`${me.user?.email} is not an administrator.`); process.exit(1); }
    if (me.mustChange) { bad('That administrator must change their password first — sign in once in the browser.'); process.exit(1); }
    ok(`Signed in as administrator ${me.user.name}`);
  }
  let users = (await admin.call('GET', '/api/admin/users')).users;
  const userOf = k => users.find(u => u.email === email(k));

  /* ---------- remove ---------- */
  if (has('--remove')) {
    await admin.call('POST', '/api/admin/backups').catch(() => {});
    ok('Backup snapshot taken');
    for (const k of ['anita', 'kavya']) {
      if (!userOf(k) || userOf(k).status !== 'active') continue;
      try {
        const cl = await signIn(k, PASSWORD, 'lm');
        const d = await cl.call('GET', '/api/data');
        const demo = d.reportees.filter(p => String(p.id).startsWith(PREFIX));
        for (const p of demo) await cl.call('DELETE', `/api/reportees/${p.id}`);
        if (demo.length) ok(`Removed ${demo.length} demo reportees of ${PEOPLE[k].name}`);
      } catch (e) { warn(`${PEOPLE[k].name}: ${e.message}`); }
    }
    const org = (await admin.call('GET', '/api/data').catch(() => ({}))).org;
    if (org) {
      org.roles = (org.roles || []).filter(r => !String(r.id).startsWith(PREFIX));
      org.guidelines = (org.guidelines || []).filter(g => !String(g.id).startsWith(PREFIX));
      await admin.call('PUT', '/api/org', org); await admin.call('DELETE', `/api/files/_org/${PREFIX}guide`).catch(() => {});
      ok('Removed demo roles and guideline');
    }
    users = (await admin.call('GET', '/api/admin/users')).users;
    for (const k of ['rahul', 'meera', 'kavya', 'anita']) {
      const u = userOf(k); if (!u) continue;
      if (k === 'anita' && adminIsDemo) { warn(`${u.name} is the administrator you are signed in as, so the account stays`); continue; }
      try { if (u.status === 'pending') await admin.call('POST', `/api/admin/users/${u.id}/reject`); else await admin.call('DELETE', `/api/admin/users/${u.id}`); ok(`Removed account ${u.email}`); }
      catch (e) { warn(`${u.email}: ${e.message}`); }
    }
    c('\n  Done.\n'); process.exit(0);
  }

  /* ---------- safety: don't mix with real records ---------- */
  const reps = await admin.call('GET', '/api/admin/reportees');
  const real = reps.filter(r => !String(r.id).startsWith(PREFIX));
  if (real.length && !has('--force')) {
    bad(`This server already has ${real.length} real reportee(s). Demo data should go on a separate demo server.`);
    c('    Start a second server for demos, e.g.:  node server/central.js --port 8090 --data ~/teamdesk-demo-data --key-file ~/teamdesk-demo.key');
    c('    To add demo data here anyway, run again with --force.\n');
    process.exit(2);
  }
  if (process.stdin.isTTY && !has('--yes')) {
    const a = await ask(`  Add 4 demo accounts and 6 demo reportees to ${BASE}? [Y/n] `);
    if (/^n/i.test(a)) { c('  Cancelled.\n'); process.exit(0); }
  }
  await admin.call('POST', '/api/admin/backups'); ok('Backup snapshot taken');

  /* ---------- accounts ---------- */
  for (const k of ['anita', 'kavya', 'meera', 'rahul']) {
    const P = PEOPLE[k];
    if (!userOf(k)) {
      try { await anon.call('POST', '/api/auth/register', { name: P.name, email: email(k), password: PASSWORD, requested: P.groups || ['lm'], note: P.role }); }
      catch (e) { bad(`Could not register ${email(k)}: ${e.message}${e.status === 403 ? ' (use --domain with an allowed email domain, or open registration in Administration › Server settings)' : ''}`); process.exit(1); }
      users = (await admin.call('GET', '/api/admin/users')).users;
    }
    const u = userOf(k);
    if (P.groups && u.status === 'pending') await admin.call('POST', `/api/admin/users/${u.id}/approve`, { groups: P.groups, admin: false });
    else if (P.groups && u.status === 'active' && !(k === 'anita' && adminIsDemo)) await admin.call('PUT', `/api/admin/users/${u.id}`, { groups: P.groups });
    else if (k === 'anita' && adminIsDemo) await admin.call('PUT', `/api/admin/users/${u.id}`, { groups: P.groups });
    ok(`${P.name.padEnd(13)} ${email(k).padEnd(32)} ${P.role}`);
  }

  /* ---------- organisation configuration (roles, guideline) ---------- */
  const anyProfile = (await admin.call('GET', '/api/status')).profiles[0];
  await admin.call('POST', '/api/auth/profile', { profile: anyProfile });
  let org = (await admin.call('GET', '/api/data')).org || defaultShared();
  if (!org.framework) org = { ...defaultShared(), ...org, framework: defaultShared().framework };
  if (!org.skills?.length) org.skills = defaultShared().skills;
  org.settings = { cycleStartMonth: 4, ...(org.settings || {}) };
  const demo = buildDemo(org);
  org.roles = [...(org.roles || []).filter(r => !r.id.startsWith(PREFIX)), ...demo.roles];
  org.guidelines = [...(org.guidelines || []).filter(g => !g.id.startsWith(PREFIX)), demo.guideline];
  await admin.call('PUT', '/api/org', org);
  await admin.call('PUT', `/api/files/_org/${PREFIX}guide`, Buffer.from(demo.guideline.text), { 'content-type': 'text/plain', 'x-file-name': encodeURIComponent(demo.guideline.name) });
  ok(`Organisation: ${demo.roles.length} demo roles with KPIs and an appraisal guideline`);

  /* ---------- reportees, per line manager ---------- */
  for (const k of ['anita', 'kavya']) {
    const cl = await signIn(k, PASSWORD, 'lm');
    const mine = demo.people.filter(p => PEOPLE[k].reportees.includes(p.id.slice(PREFIX.length)));
    for (const p of mine) {
      await cl.call('PUT', `/api/reportees/${p.id}`, p);
      for (const d of p.docs) await cl.call('PUT', `/api/files/${p.id}/${d.fileId}`, Buffer.from(d.text), { 'content-type': 'text/plain', 'x-file-name': encodeURIComponent(d.name) });
      ok(`${PEOPLE[k].name}: ${p.profile.name.padEnd(15)} grade ${p.grade.padEnd(3)} ${String(p.oneOnOnes.length).padStart(2)} 1:1s${p.pips.length ? ' · improvement plan' : ''}${p.leaves.length ? ' · leave' : ''}`);
    }
    const me = (await cl.call('GET', '/api/data')).me || {};
    me.settings = { ...(me.settings || {}), managerName: PEOPLE[k].name };
    me.leadership = me.leadership || { self: {}, upward: {} };
    me.leadership.self = { ...(me.leadership.self || {}), [demo.CK]: demo.leadSelf };
    if (k === 'anita') me.leadership.upward = { ...(me.leadership.upward || {}), [demo.CK]: demo.upward };
    await cl.call('PUT', '/api/me', me);
  }

  c(`
  Done! Sign in at ${BASE} — every demo password is  ${PASSWORD}

    ${email('anita').padEnd(32)} Line manager + People manager${adminIsDemo ? ' + Administrator' : ''} → chooses a profile after sign-in
    ${email('kavya').padEnd(32)} Line manager (Priya, Vikram, Arjun)
    ${email('meera').padEnd(32)} People manager — sees all six reportees, view only
    ${email('rahul').padEnd(32)} Registered, waiting for approval (approve him in Administration › Users)

  Remove it all again:  node scripts/seed-central.js --remove${adminIsDemo ? '' : ' --admin-email <you>'}
`);
})().catch(e => { bad(e.message); process.exit(1); });

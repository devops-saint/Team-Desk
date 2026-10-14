/*
 * Team Desk — Microsoft Entra ID (Azure AD) single sign-on and group directory.
 * No third-party dependencies: OpenID Connect authorization-code flow with PKCE,
 * ID-token validation against the tenant's signing keys, and Microsoft Graph
 * (client-credentials) to list the members of one Entra ID group.
 *
 * App registration needs:
 *   - a Web redirect URI:  <public address>/auth/azure/callback
 *   - a client secret
 *   - Microsoft Graph APPLICATION permission GroupMember.Read.All (admin consent),
 *     used to list the group's members and to check membership at sign-in.
 */
'use strict';

const crypto = require('crypto');
const { HttpError, fail } = require('./shared');

const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createAzure(getCfg) {
  const pending = new Map();          // state -> { nonce, verifier, created, redirectUri }
  let jwks = null, jwksAt = 0, appTok = null, members = null, membersAt = 0;
  setInterval(() => { const t = Date.now(); for (const [k, v] of pending) if (t - v.created > 600000) pending.delete(k); }, 60000).unref();

  const cfg = () => getCfg();
  function ready(c = cfg()) {
    if (!c.tenantId || !c.clientId || !c.clientSecret) return 'Microsoft sign-in isn’t set up yet (tenant ID, client ID and client secret are needed).';
    return '';
  }
  const authorityBase = c => `${c.authority.replace(/\/+$/, '')}/${c.tenantId}`;

  async function call(url, opts = {}, what = 'Microsoft') {
    let r;
    try { r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) }); }
    catch (e) { throw new HttpError(502, `Couldn’t reach ${what} (${e.name === 'TimeoutError' ? 'timed out' : e.message}). Check the server’s internet access.`); }
    const text = await r.text(); let j = {};
    try { j = JSON.parse(text); } catch {}
    if (!r.ok) {
      const msg = j.error_description || j.error?.message || j.error || text.slice(0, 200) || r.statusText;
      throw new HttpError(502, `${what} said: ${String(msg).split('\r\n')[0].slice(0, 300)}`);
    }
    return j;
  }

  /* ---------- sign-in ---------- */
  function startLogin(redirectUri) {
    const c = cfg(), err = ready(c); if (err) fail(409, err);
    const state = b64url(crypto.randomBytes(24)), nonce = b64url(crypto.randomBytes(24)), verifier = b64url(crypto.randomBytes(48));
    pending.set(state, { nonce, verifier, created: Date.now(), redirectUri });
    const q = new URLSearchParams({ client_id: c.clientId, response_type: 'code', redirect_uri: redirectUri, response_mode: 'query', scope: 'openid profile email',
      state, nonce, code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', prompt: 'select_account' });
    return { url: `${authorityBase(c)}/oauth2/v2.0/authorize?${q}`, state };
  }
  async function finishLogin(query, stateCookie) {
    const c = cfg();
    if (query.get('error')) fail(400, `${query.get('error')}: ${query.get('error_description') || ''}`.slice(0, 300));
    const state = query.get('state') || '', code = query.get('code') || '';
    const p = pending.get(state); pending.delete(state);
    if (!p || !state || state !== stateCookie) fail(400, 'expired');
    const tok = await call(`${authorityBase(c)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'authorization_code', code, redirect_uri: p.redirectUri, code_verifier: p.verifier, scope: 'openid profile email' }) }, 'Microsoft sign-in');
    const claims = await verifyIdToken(tok.id_token, p.nonce);
    return { oid: claims.oid, tid: claims.tid, name: claims.name || claims.preferred_username || '', email: String(claims.email || claims.preferred_username || '').toLowerCase() };
  }
  async function keys(force) {
    if (!force && jwks && Date.now() - jwksAt < 86400000) return jwks;
    const c = cfg();
    jwks = (await call(`${authorityBase(c)}/discovery/v2.0/keys`, {}, 'Microsoft sign-in')).keys || []; jwksAt = Date.now();
    return jwks;
  }
  async function verifyIdToken(idt, nonce) {
    const c = cfg();
    const parts = String(idt || '').split('.');
    if (parts.length !== 3) fail(400, 'Microsoft returned no valid ID token.');
    const head = JSON.parse(unb64url(parts[0])), claims = JSON.parse(unb64url(parts[1]));
    if (head.alg !== 'RS256') fail(400, 'Unexpected token algorithm.');
    let jwk = (await keys()).find(k => k.kid === head.kid);
    if (!jwk) jwk = (await keys(true)).find(k => k.kid === head.kid);
    if (!jwk) fail(400, 'Microsoft’s signing key was not found.');
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' }), unb64url(parts[2]));
    if (!ok) fail(400, 'The Microsoft ID token signature is not valid.');
    const now = Math.floor(Date.now() / 1000);
    if (claims.aud !== c.clientId) fail(400, 'The ID token was issued for another application.');
    if (claims.tid !== c.tenantId && GUID.test(c.tenantId)) fail(400, 'The ID token comes from another organisation (tenant).');
    if (claims.iss !== `${c.authority.replace(/\/+$/, '')}/${claims.tid}/v2.0`) fail(400, 'The ID token issuer is not valid.');
    if (!(claims.exp > now - 300) || (claims.nbf && claims.nbf > now + 300)) fail(400, 'The ID token has expired. Try again.');
    if (claims.nonce !== nonce) fail(400, 'The sign-in response did not match this request. Try again.');
    if (!claims.oid) fail(400, 'The ID token has no user id (oid).');
    return claims;
  }

  /* ---------- Microsoft Graph (application permissions) ---------- */
  async function appToken() {
    const c = cfg();
    if (appTok && appTok.until > Date.now() + 60000 && appTok.key === c.clientId + c.tenantId) return appTok.token;
    const t = await call(`${authorityBase(c)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'client_credentials', scope: `${c.graph.replace(/\/+$/, '')}/.default` }) }, 'Microsoft sign-in');
    appTok = { token: t.access_token, until: Date.now() + (+t.expires_in || 3600) * 1000, key: c.clientId + c.tenantId };
    return appTok.token;
  }
  async function graph(pathOrUrl, opts = {}) {
    const c = cfg();
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${c.graph.replace(/\/+$/, '')}/v1.0${pathOrUrl}`;
    return call(url, { ...opts, headers: { Authorization: `Bearer ${await appToken()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }, 'Microsoft Graph');
  }
  async function groupInfo() {
    const c = cfg(); if (!c.groupId) fail(409, 'No Entra ID group is set.');
    return graph(`/groups/${encodeURIComponent(c.groupId)}?$select=id,displayName,description`);
  }
  async function groupMembers(force) {
    const c = cfg(), err = ready(c); if (err) fail(409, err);
    if (!c.groupId) fail(409, 'Set the Entra ID group first (Administration › Server settings › Microsoft sign-in).');
    if (!force && members && members.groupId === c.groupId && Date.now() - membersAt < 300000) return members;
    const list = [];
    let next = `/groups/${encodeURIComponent(c.groupId)}/transitiveMembers/microsoft.graph.user?$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled&$top=999`;
    for (let i = 0; next && i < 50; i++) {
      const page = await graph(next);
      for (const u of page.value || []) list.push({ oid: u.id, name: u.displayName || u.userPrincipalName, email: String(u.mail || u.userPrincipalName || '').toLowerCase(),
        upn: String(u.userPrincipalName || '').toLowerCase(), jobTitle: u.jobTitle || '', department: u.department || '', enabled: u.accountEnabled !== false });
      next = page['@odata.nextLink'] || null;
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    members = Object.assign(list, { groupId: c.groupId }); membersAt = Date.now();
    return members;
  }
  async function isMember(oid) {
    const c = cfg(); if (!c.groupId) return true;
    const r = await graph(`/users/${encodeURIComponent(oid)}/checkMemberGroups`, { method: 'POST', body: JSON.stringify({ groupIds: [c.groupId] }) });
    return (r.value || []).includes(c.groupId);
  }
  function reset() { jwks = null; appTok = null; members = null; }

  return { ready, startLogin, finishLogin, groupInfo, groupMembers, isMember, reset, cfg };
}

module.exports = { createAzure, GUID };

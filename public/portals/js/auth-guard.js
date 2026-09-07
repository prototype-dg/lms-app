'use strict';

/**
 * auth-guard.js — token stored in localStorage, sent as Authorization: Bearer
 * No cookies — avoids all SameSite/CORS/credentials issues.
 */

const TOKEN_KEY = 'ps_token';
let _portalUser = null;

const LOGIN_PAGES = {
  customer:   '/portals/customer-login.html',
  developer:  '/portals/developer-login.html',
  backoffice: '/portals/backoffice-login.html',
};

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

/** Attach Bearer token to any fetch options object */
function authHeaders(extra) {
  return { ...extra, headers: { ...(extra && extra.headers), 'Authorization': 'Bearer ' + (getToken() || '') } };
}

async function authGuard(requiredPortal) {
  const token = getToken();
  if (!token) { window.location.href = LOGIN_PAGES[requiredPortal]; return null; }
  try {
    const r = await fetch('/api/v1/auth/me', authHeaders());
    if (!r.ok) throw new Error('not authenticated');
    const d = await r.json();
    const user = d.user;

    const access = user.portal_access;
    const allowed = access === 'all' ||
      (requiredPortal === 'customer'   && access === 'customer')   ||
      (requiredPortal === 'developer'  && access === 'developer')  ||
      (requiredPortal === 'backoffice' && access === 'backoffice');

    if (!allowed) { window.location.href = LOGIN_PAGES[requiredPortal]; return null; }

    _portalUser = { ...user, allowed_sections: user.allowed_sections || [] };
    return _portalUser;
  } catch (_) {
    clearToken();
    window.location.href = LOGIN_PAGES[requiredPortal];
    return null;
  }
}

function getPortalUser() { return _portalUser; }

async function authLogout(portal) {
  await fetch('/api/v1/auth/logout', authHeaders({ method: 'POST' })).catch(() => {});
  clearToken();
  window.location.href = LOGIN_PAGES[portal] || '/';
}

function hasSection(key) {
  if (!_portalUser) return false;
  if (_portalUser.portal_access === 'all') return true;
  const secs = _portalUser.allowed_sections || [];
  if (secs.length === 0) return true;
  return secs.includes(key);
}

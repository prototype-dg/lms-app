'use strict';

/**
 * auth-guard.js — token in localStorage, sent as Authorization: Bearer
 */

const TOKEN_KEY = 'ps_token';
let _portalUser = null;

const LOGIN_PAGES = {
  customer:   '/portals/customer-login.html',
  developer:  '/portals/developer-login.html',
  backoffice: '/portals/backoffice-login.html',
};

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function authHeaders(extra) {
  const token = getToken();
  return { ...extra, headers: { ...(extra && extra.headers), 'Authorization': 'Bearer ' + (token || '') } };
}

async function authGuard(requiredPortal) {
  const token = getToken();
  if (!token) {
    window.location.href = LOGIN_PAGES[requiredPortal];
    return null;
  }

  let resp, data;
  try {
    resp = await fetch('/api/v1/auth/me', authHeaders());
    const text = await resp.text();
    try { data = JSON.parse(text); } catch(_) {
      // Server returned non-JSON (crash/500) — show it in console and bail
      console.error('[auth-guard] /me non-JSON response (' + resp.status + '):', text.slice(0, 300));
      clearToken();
      window.location.href = LOGIN_PAGES[requiredPortal];
      return null;
    }
  } catch(netErr) {
    console.error('[auth-guard] /me network error:', netErr);
    window.location.href = LOGIN_PAGES[requiredPortal];
    return null;
  }

  if (!resp.ok || data.error) {
    console.warn('[auth-guard] /me rejected:', resp.status, data.error);
    clearToken();
    window.location.href = LOGIN_PAGES[requiredPortal];
    return null;
  }

  const user = data.user;
  const access = user.portal_access;
  const allowed =
    access === 'all' ||
    (requiredPortal === 'customer'   && access === 'customer')   ||
    (requiredPortal === 'developer'  && access === 'developer')  ||
    (requiredPortal === 'backoffice' && access === 'backoffice');

  if (!allowed) {
    console.warn('[auth-guard] wrong portal — access:', access, 'required:', requiredPortal);
    clearToken();
    window.location.href = LOGIN_PAGES[requiredPortal];
    return null;
  }

  _portalUser = { ...user, allowed_sections: user.allowed_sections || [] };
  return _portalUser;
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

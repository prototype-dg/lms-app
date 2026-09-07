/**
 * auth-guard.js
 * Shared portal authentication guard.
 *
 * Call at top of each portal's DOMContentLoaded:
 *   authGuard('customer')   — redirects to customer-login.html if not authenticated with customer role
 *   authGuard('developer')  — redirects to developer-login.html
 *   authGuard('backoffice') — redirects to backoffice-login.html
 *
 * Also exports:
 *   getPortalUser()         — returns cached { login, role, portal_access, allowed_sections }
 *   authLogout(portal)      — calls /logout and redirects to login page
 *   hasSection(key)         — true if user can access a backoffice section
 */

'use strict';

let _portalUser = null;

const LOGIN_PAGES = {
  customer:   '/portals/customer-login.html',
  developer:  '/portals/developer-login.html',
  backoffice: '/portals/backoffice-login.html',
};

/**
 * Check session. If not authenticated or wrong portal, redirect to login.
 * Returns the user object on success (await-able).
 */
async function authGuard(requiredPortal) {
  try {
    const r = await fetch('/api/v1/auth/me');
    if (!r.ok) throw new Error('not authenticated');
    const d = await r.json();
    const user = d.user;

    const access = user.portal_access;
    const allowed = access === 'all' ||
      (requiredPortal === 'customer'   && access === 'customer')   ||
      (requiredPortal === 'developer'  && access === 'developer')  ||
      (requiredPortal === 'backoffice' && access === 'backoffice');

    if (!allowed) {
      window.location.href = LOGIN_PAGES[requiredPortal] || '/';
      return null;
    }

    _portalUser = { ...user, allowed_sections: user.allowed_sections || [] };
    return _portalUser;
  } catch (_) {
    window.location.href = LOGIN_PAGES[requiredPortal] || '/';
    return null;
  }
}

function getPortalUser() { return _portalUser; }

async function authLogout(portal) {
  await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = LOGIN_PAGES[portal] || '/';
}

/**
 * Returns true if the current user can access a given backoffice section.
 * admin (portal_access='all') bypasses all restrictions.
 * For other roles, checks allowed_sections array.
 * Empty array [] on a backoffice user means ALL sections are allowed (product_manager default).
 */
function hasSection(key) {
  if (!_portalUser) return false;
  if (_portalUser.portal_access === 'all') return true;
  const secs = _portalUser.allowed_sections || [];
  if (secs.length === 0) return true; // empty = all allowed
  return secs.includes(key);
}

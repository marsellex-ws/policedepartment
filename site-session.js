/* Police Department: one site-wide 24-hour session from sign-in. */
(() => {
  'use strict';
  if (window.PoliceSession) return;
  const KEY = 'pd_site_token';
  const EXP = 'pd_site_token_expires_at';
  const DAY = 24 * 60 * 60 * 1000;
  function clear() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(EXP);
    sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event('pd-session-changed'));
  }
  function get() {
    const value = localStorage.getItem(KEY);
    const expires = Number(localStorage.getItem(EXP) || 0);
    if (!value || !/^[0-9a-f]{64}$/i.test(value) || !Number.isFinite(expires) || expires <= Date.now()) {
      // Old tokens without a sign-in timestamp are not migrated with a new 24-hour clock.
      if (value || sessionStorage.getItem(KEY)) clear();
      return null;
    }
    if (sessionStorage.getItem(KEY) !== value) sessionStorage.setItem(KEY, value);
    return value;
  }
  function save(token, expiresAt) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token)) throw new Error('Некорректная сессия');
    const serverTime = expiresAt ? Date.parse(expiresAt) : NaN;
    // Server is authoritative; fallback supports previous API deployments.
    const expires = Number.isFinite(serverTime) ? Math.min(serverTime, Date.now() + DAY) : Date.now() + DAY;
    localStorage.setItem(KEY, token);
    localStorage.setItem(EXP, String(expires));
    sessionStorage.setItem(KEY, token);
    window.dispatchEvent(new Event('pd-session-changed'));
  }
  window.PoliceSession = Object.freeze({ get, save, clear, expiresAt: () => Number(localStorage.getItem(EXP) || 0) });
  // Keep the browser profile in sync across tabs. Don't blindly log out on network errors.
  window.addEventListener('pageshow', () => get());
})();

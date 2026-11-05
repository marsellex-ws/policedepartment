/* Police Department: link preloading with a slim bottom progress indicator. */
(() => {
  'use strict';
  if (window.PoliceNavigation) return;
  const API = 'https://api.police-department.ru';
  const CACHE = 'pd_navigation_prefetch_vercel_v3';
  const TTL = 25_000;
  const publicByPage = {
    'index.html': ['/api/portal/leadership', '/api/portal/chiefs'],
    'admin.html': ['/api/portal/leadership', '/api/portal/chiefs'],
    'leadership.html': ['/api/portal/leadership'],
    'chiefs.html': ['/api/portal/chiefs'],
    'reestr.html': ['/api/punishments?limit=100&offset=0'],
    'exams.html': ['/api/exams'],
    'entrance.html': []
  };
  const allowedAPI = new Set(Object.values(publicByPage).flat());
  const nativeFetch = window.fetch.bind(window);
  let navigating = false;
  const css = document.createElement('style');
  css.textContent = `
    #pd-nav-line {position:fixed;bottom:0;left:0;right:0;height:3px;z-index:2147483001;
      pointer-events:none;overflow:hidden;opacity:0;transition:opacity .2s ease;background:#0b2a44aa}
    #pd-nav-line.pd-nav-visible{opacity:1}
    #pd-nav-line::after{content:"";position:absolute;top:0;bottom:0;width:36%;left:-38%;
      background:linear-gradient(90deg,transparent,#6ccaff 40%,#ddf5ff 70%,transparent);
      box-shadow:0 0 14px #56baff;animation:pdNavTravel 1.05s ease-in-out infinite}
    @keyframes pdNavTravel{to{transform:translateX(390%)}}
    @media(prefers-reduced-motion:reduce){#pd-nav-line::after{animation-duration:2s}}
  `;
  document.head.appendChild(css);

  // Fulfil only previously prefetched, short-lived PUBLIC GET responses.
  // Session credentials or private API data are never persisted here.
  window.fetch = function(input, init) {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
      const headers = new Headers(init?.headers || (typeof input === 'object' && input?.headers) || {});
      if (method === 'GET' && url.origin === API && !headers.has('Authorization') && allowedAPI.has(url.pathname + url.search)) {
        const saved = JSON.parse(sessionStorage.getItem(CACHE) || '{}');
        const match = saved[url.pathname + url.search];
        if (match && match.expires > Date.now()) {
          delete saved[url.pathname + url.search]; // one-time use; fresh on next visit
          sessionStorage.setItem(CACHE, JSON.stringify(saved));
          return Promise.resolve(new Response(JSON.stringify(match.payload), {
            status: 200, headers: {'Content-Type':'application/json'}
          }));
        }
      }
    } catch (error) { console.debug('[Police] Prefetch cache skipped', error); }
    return nativeFetch(input, init);
  };

  function line() {
    let el = document.getElementById('pd-nav-line');
    if (!el) { el=document.createElement('div'); el.id='pd-nav-line';document.body.appendChild(el); }
    return el;
  }
  // When the browser goes Back/Forward it may restore this entire document from
  // the back-forward cache, including JS variables and the progress bar.
  function resetNavigation() {
    navigating = false;
    document.getElementById('pd-nav-line')?.classList.remove('pd-nav-visible');
    document.getElementById('pd-nav-error')?.remove();
  }
  window.addEventListener('pagehide', resetNavigation);
  window.addEventListener('pageshow', resetNavigation);
  function go(href) {
    if (navigating) return;
    navigating = true;
    line().classList.add('pd-nav-visible');
    location.assign(new URL(href, location.href).href);
  }
  const warming = new Map();
  async function warm(anchor) {
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const to = new URL(anchor.href, location.href);
    if (to.origin !== location.origin) return;
    const page = to.pathname.split('/').pop() || 'index.html';
    if (!Object.hasOwn(publicByPage, page) || (warming.get(page) || 0) > Date.now()) return;
    warming.set(page, Date.now() + TTL);
    try {
      const results = await Promise.allSettled(publicByPage[page].map(async path => {
        const r = await nativeFetch(API + path, {
          headers: {Accept:'application/json'}, cache:'no-store', signal:AbortSignal.timeout(8000)
        });
        if (!r.ok) throw new Error('Prefetch HTTP ' + r.status);
        const payload = await r.json();
        if (payload?.ok !== true) throw new Error('Invalid prefetch response');
        return [path, {payload, expires:Date.now() + TTL}];
      }));
      let cache = {};
      try { cache = JSON.parse(sessionStorage.getItem(CACHE) || '{}'); } catch {}
      for (const result of results) if (result.status === 'fulfilled') cache[result.value[0]] = result.value[1];
      sessionStorage.setItem(CACHE, JSON.stringify(cache));
    } catch { /* Preloading and browser storage must never block a page transition. */ }
  }
  document.addEventListener('pointerover', e => { void warm(e.target.closest?.('a[href]')); }, {passive:true});
  document.addEventListener('focusin', e => { void warm(e.target.closest?.('a[href]')); });
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self') || anchor.dataset.noPreload !== undefined) return;
    const url=new URL(anchor.href,location.href);
    if (url.origin!==location.origin || (url.pathname===location.pathname && url.search===location.search)) return;
    const page = url.pathname.split('/').pop() || 'index.html';
    if (!Object.hasOwn(publicByPage,page)) return;
    event.preventDefault();
    go(url.href);
  }, true);
  window.PoliceNavigation = Object.freeze({go});
})();

/* Police Department: link preloading with a slim bottom progress indicator. */
(() => {
  'use strict';
  if (window.PoliceNavigation) return;
  const API = 'https://police-api-b2y4.onrender.com';
  const CACHE = 'pd_navigation_prefetch_v2';
  const TTL = 25_000;
  const publicByPage = {
    'index.html': ['/api/portal/leadership', '/api/portal/chiefs'],
    'admin.html': ['/api/portal/leadership', '/api/portal/chiefs'],
    'leadership.html': ['/api/portal/leadership'],
    'reestr.html': ['/api/punishments?limit=100&offset=0'],
    'exams.html': ['/api/exams'],
    'entrance.html': []
  };
  const allowedAPI = new Set(Object.values(publicByPage).flat());
  const nativeFetch = window.fetch.bind(window);
  let navigating = false;
  let navGeneration = 0;
  let activeController = null;
  let activeTimeout = null;
  const css = document.createElement('style');
  css.textContent = `
    #pd-nav-line {position:fixed;bottom:0;left:0;right:0;height:3px;z-index:2147483001;
      pointer-events:none;overflow:hidden;opacity:0;transition:opacity .2s ease;background:#0b2a44aa}
    #pd-nav-line.pd-nav-visible{opacity:1}
    #pd-nav-line::after{content:"";position:absolute;top:0;bottom:0;width:36%;left:-38%;
      background:linear-gradient(90deg,transparent,#6ccaff 40%,#ddf5ff 70%,transparent);
      box-shadow:0 0 14px #56baff;animation:pdNavTravel 1.05s ease-in-out infinite}
    @keyframes pdNavTravel{to{transform:translateX(390%)}}
    #pd-nav-error{position:fixed;bottom:15px;left:50%;transform:translateX(-50%);z-index:2147483002;
      background:#0b2238;color:#e9f7ff;border:1px solid #5c8bb6;border-radius:12px;
      padding:11px 14px;max-width:calc(100vw - 30px);font:13px Inter,'Segoe UI',sans-serif;
      box-shadow:0 10px 30px #0008;display:flex;align-items:center;gap:12px}
    #pd-nav-error button{border:1px solid #5c8bb6;background:#17486d;color:white;
      border-radius:8px;padding:6px 11px;cursor:pointer;white-space:nowrap}
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
    navGeneration++;
    navigating = false;
    if (activeTimeout !== null) clearTimeout(activeTimeout);
    activeTimeout = null;
    if (activeController) activeController.abort();
    activeController = null;
    document.getElementById('pd-nav-line')?.classList.remove('pd-nav-visible');
    document.getElementById('pd-nav-error')?.remove();
  }
  window.addEventListener('pagehide', resetNavigation);
  window.addEventListener('pageshow', resetNavigation);
  function showError(url) {
    document.getElementById('pd-nav-error')?.remove();
    const el = document.createElement('div');
    el.id='pd-nav-error';el.setAttribute('role','alert');
    const message=document.createElement('span');message.textContent='Не удалось загрузить страницу. Проверь соединение.';
    const retry=document.createElement('button');retry.type='button';retry.textContent='Повторить';retry.onclick=()=>{el.remove();go(url)};
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Закрыть';cancel.onclick=()=>el.remove();
    el.append(message,retry,cancel);document.body.appendChild(el);
  }
  async function go(href) {
    if (navigating) return;
    const to = new URL(href, location.href);
    if (to.origin !== location.origin) { location.assign(to.href);return; }
    const page = to.pathname.split('/').pop() || 'index.html';
    if (!Object.hasOwn(publicByPage,page)) { location.assign(to.href);return; }
    navigating = true;
    const thisNavigation = ++navGeneration;
    const bar = line();bar.classList.add('pd-nav-visible');
    const controller = new AbortController();
    activeController = controller;
    const timeout = setTimeout(() => controller.abort(), 8500);
    activeTimeout = timeout;
    try {
      // Start HTML and public API requests together, not sequentially.
      const htmlRequest = nativeFetch(to.href, {method:'GET', credentials:'same-origin', signal:controller.signal});
      const paths = publicByPage[page];
      const apiRequest = Promise.all(paths.map(async path => {
        const r = await nativeFetch(API + path, {headers:{Accept:'application/json'}, signal:controller.signal, cache:'no-store'});
        if (!r.ok) throw new Error('API '+path+' HTTP '+r.status);
        const payload = await r.json();
        if (!payload || payload.ok !== true) throw new Error('API '+path+' returned invalid data');
        return [path, {payload, expires: Date.now() + TTL}];
      }));
      const [response, results] = await Promise.all([htmlRequest, apiRequest]);
      if (thisNavigation !== navGeneration || controller.signal.aborted) return;
      if (!response.ok) throw new Error('Страница HTTP '+response.status);
      const cache=Object.fromEntries(results);
      sessionStorage.setItem(CACHE, JSON.stringify(cache));
      location.assign(to.href); // full-page transition only after the public data is ready
      return;
    } catch (error) {
      // Ignore an abandoned request after Back/Forward restores a cached page.
      if (thisNavigation !== navGeneration) return;
      navigating = false;
      console.warn('[Police] Navigation preload failed:', error);
      bar.classList.remove('pd-nav-visible');
      showError(to.href);
    } finally {
      clearTimeout(timeout);
      if (activeTimeout === timeout) activeTimeout = null;
      if (activeController === controller) activeController = null;
    }
  }
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

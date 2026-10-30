/* Police Department: initial data readiness gate + request diagnostics */
(() => {
  'use strict';
  if (window.__pdBootReadyInstalled) return;
  window.__pdBootReadyInstalled = true;
  const origin = 'https://police-api-b2y4.onrender.com';
  const original = window.fetch.bind(window);
  const state = { pending: 0, started: 0, domReady: false, resolved: false,
    failures: new Set(), results: [], lastActivity: performance.now() };
  let idleTimer = null;
  let hardTimer = null;
  const now = () => Math.round(performance.now());
  const isInitial = () => !state.resolved;

  function text(msg, isFailure = false) {
    const node = document.getElementById('pd-boot-message');
    if (node) node.textContent = msg;
    const retry = document.getElementById('pd-boot-retry');
    const spinner = document.getElementById('pd-boot-spinner');
    if (retry) retry.hidden = !isFailure;
    if (spinner) spinner.hidden = isFailure;
  }
  function done() {
    if (state.resolved) return;
    state.resolved = true;
    clearTimeout(hardTimer);
    clearTimeout(idleTimer);
    document.documentElement.classList.remove('pd-boot-loading');
    const overlay = document.getElementById('pd-boot-overlay');
    if (overlay) {
      overlay.classList.add('pd-boot-exit');
      setTimeout(() => overlay.remove(), 320);
    }
    if (window.__pdBootFallback) clearTimeout(window.__pdBootFallback);
    console.info('[Police] Начальная загрузка завершена', state.results);
  }
  function fail() {
    if (state.resolved) return;
    clearTimeout(idleTimer);
    const paths = Array.from(state.failures);
    console.warn('[Police] Первоначальные запросы не загрузились:', paths, state.results);
    text('Не удалось получить данные. Нажми «Повторить загрузку».', true);
  }
  function check() {
    if (!state.domReady || state.resolved) return;
    clearTimeout(idleTimer);
    if (state.pending > 0) {
      text('Получаем актуальные данные…');
      return;
    }
    // Allow inline UI rendering and immediately chained requests to complete.
    idleTimer = setTimeout(() => {
      if (state.pending !== 0 || state.resolved) return;
      if (state.failures.size > 0) fail(); else done();
    }, 320);
  }
  function record(url, ms, status) {
    state.results.push({url, duration_ms: ms, status});
    console.debug(`[Police] GET ${url}: ${status} (${ms} мс)`);
  }
  window.fetch = function pdBootFetch(input, init) {
    const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, location.href); }
    catch { return original(input, init); }
    if (!isInitial() || method !== 'GET' || url.origin !== origin) return original(input, init);
    const path = url.pathname;
    const start = now();
    state.pending++;
    state.started++;
    state.lastActivity = performance.now();
    clearTimeout(idleTimer);
    let request;
    try { request = original(input, init); }
    catch (error) {
      state.pending--;
      state.failures.add(path);
      record(path, now() - start, error?.name || 'NetworkError');
      check();
      throw error;
    }
    return Promise.resolve(request).then(
      response => {
        state.pending--;
        record(path, now()-start, response.status);
        if (response.status >= 500 || response.status === 429) state.failures.add(path);
        else state.failures.delete(path);
        check();
        return response;
      },
      error => {
        state.pending--;
        record(path, now()-start, error?.name || 'NetworkError');
        // A user-initiated AbortController abort can be part of normal navigation.
        if (error?.name !== 'AbortError') state.failures.add(path);
        else state.failures.add(path);
        check();
        throw error;
      }
    );
  };

  function mount() {
    if (state.domReady) return;
    state.domReady = true;
    const overlay = document.createElement('div');
    overlay.id = 'pd-boot-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="pd-boot-content">
        <div class="pd-boot-tag">ABSOLUTE ROLE PLAY</div>
        <div class="pd-boot-heading">POLICE <span>DEPARTMENT</span></div>
        <div id="pd-boot-spinner" class="pd-boot-spinner" aria-hidden="true"></div>
        <div id="pd-boot-message" class="pd-boot-message">Загружаем данные…</div>
        <button id="pd-boot-retry" type="button" hidden>Повторить загрузку</button>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('pd-boot-retry').onclick = async () => {
      const publicOnly = state.failures.size > 0 &&
        Array.from(state.failures).every(p => p === '/api/portal/leadership' || p === '/api/portal/chiefs');
      if (!publicOnly || typeof window.pdRefreshPeople !== 'function') {
        location.reload(); return;
      }
      const button = document.getElementById('pd-boot-retry');
      if (button.disabled || state.pending > 0) return;
      button.disabled = true;
      text('Повторно получаем данные…');
      try { await window.pdRefreshPeople(); }
      finally { button.disabled = false; check(); }
    };
    hardTimer = setTimeout(() => {
      if (state.resolved) return;
      console.warn('[Police] Начальная загрузка превысила 18 секунд', state.results);
      text('Сервер не ответил вовремя. Попробуй загрузить данные повторно.', true);
    }, 8500);
    check();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();

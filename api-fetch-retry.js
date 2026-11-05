/* Police API: bounded retries for idempotent read requests only.
 * Mutating requests are NEVER retried automatically.
 */
(() => {
  'use strict';
  if (window.__policeApiRetryInstalled) return;
  window.__policeApiRetryInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const API_ORIGIN = 'https://police-api-b2y4.onrender.com';
  const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 3;
  const PER_ATTEMPT_MS = 8000;
  const BACKOFF_MS = 220;

  const PUBLIC_PATHS = new Set(['/api/portal/leadership', '/api/portal/chiefs', '/api/exams', '/api/portal/range']);
  const publicReads = new Map();

  function abortError() { return new DOMException('Request aborted', 'AbortError'); }
  function pause(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      let timer;
      function cleanup() {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
      function abort() { cleanup(); reject(abortError()); }
      timer = setTimeout(() => { cleanup(); resolve(); }, ms);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }

  async function readWithRetries(input, init) {
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, location.href); }
    catch { return originalFetch(input, init); }
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (url.origin !== API_ORIGIN || method !== 'GET') return originalFetch(input, init);

    const signal = init?.signal || (typeof input === 'object' && input?.signal) || null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (signal?.aborted) throw abortError();
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      let timedOut = false;
      const started = performance.now();
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, PER_ATTEMPT_MS);
      try {
        const response = await originalFetch(input, {...init, signal: controller.signal});
        // Keep the timeout active until the body arrives, not only the headers.
        if (response.ok) await response.clone().arrayBuffer();
        const ms = Math.round(performance.now() - started);
        if (!RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS) {
          if (attempt > 1) console.info('[Police API] GET восстановлен', url.pathname, `HTTP ${response.status}`, `${ms} мс`);
          return response;
        }
        console.warn('[Police API] Временный ответ', url.pathname, `HTTP ${response.status}`, `${ms} мс`, `попытка ${attempt}/${MAX_ATTEMPTS}`);
        try { await response.body?.cancel?.(); } catch { /* discard retryable body */ }
      } catch (err) {
        if (signal?.aborted) throw err;
        const networkError = err?.name === 'TypeError' || timedOut;
        if (!networkError || attempt === MAX_ATTEMPTS) throw err;
        console.warn('[Police API] Сетевой сбой', url.pathname,
          timedOut ? `тайм-аут ${PER_ATTEMPT_MS} мс` : err?.name || 'NetworkError',
          `попытка ${attempt}/${MAX_ATTEMPTS}`);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
      await pause(BACKOFF_MS * attempt + Math.random() * 150, signal);
    }
  }

  window.fetch = function policeFetch(input, init) {
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (method !== 'GET') return originalFetch(input, init);
    let request;
    try { request = new Request(input, init); }
    catch { return readWithRetries(input, init); }
    const url = new URL(request.url);
    const cacheable = url.origin === API_ORIGIN && request.method === 'GET' &&
      PUBLIC_PATHS.has(url.pathname) && !request.headers.has('Authorization') &&
      !init?.signal && !(input instanceof Request) && request.cache !== 'reload' && request.cache !== 'no-store' && request.credentials !== 'include';
    if (!cacheable) return readWithRetries(input, init);
    const key = request.url + '|' + request.headers.get('Accept');
    const previous = publicReads.get(key);
    if (previous && previous.expires > Date.now()) return previous.promise.then(r => r.clone());
    const entry = { expires: Infinity };
    entry.promise = readWithRetries(input, init).then(response => {
      if (response.ok) entry.expires = Date.now() + 5000;
      else if (publicReads.get(key) === entry) publicReads.delete(key);
      return response;
    }).catch(error => {
      if (publicReads.get(key) === entry) publicReads.delete(key);
      throw error;
    });
    publicReads.set(key, entry);
    return entry.promise.then(r => r.clone());
  };
})();

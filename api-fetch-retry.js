/* World Script Police API: limited retries for transient, read-only requests.
 * Mutations (POST/PUT/PATCH/DELETE) are never retried automatically.
 */
(() => {
  'use strict';
  if (window.__policeApiRetryInstalled) return;
  window.__policeApiRetryInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const apiOrigin = 'https://api.police-department.ru';
  const transientStatus = new Set([408, 425, 429, 500, 502, 503, 504]);
  const attempts = 3; // one initial attempt, at most two retries

  function aborted() {
    return new DOMException('Request aborted', 'AbortError');
  }
  function pause(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(aborted());
      const done = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => { done(); reject(aborted()); };
      const timer = setTimeout(() => { done(); resolve(); }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  window.fetch = async function policeFetch(input, init) {
    let target;
    try {
      target = new URL(typeof input === 'string' ? input : input.url, location.href);
    } catch {
      return originalFetch(input, init);
    }
    const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    if (target.origin !== apiOrigin || method !== 'GET') return originalFetch(input, init);

    const externalSignal = init?.signal || (typeof input === 'object' && input?.signal) || null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (externalSignal?.aborted) throw aborted();
      const controller = new AbortController();
      let timedOut = false;
      const onAbort = () => controller.abort();
      externalSignal?.addEventListener('abort', onAbort, { once: true });
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 9000);
      try {
        const response = await originalFetch(input, { ...init, signal: controller.signal });
        if (!transientStatus.has(response.status) || attempt === attempts) return response;
        response.body?.cancel?.().catch?.(() => {});
      } catch (error) {
        if (externalSignal?.aborted) throw error;
        if (attempt === attempts || (!timedOut && !(error instanceof TypeError))) throw error;
      } finally {
        clearTimeout(timeout);
        externalSignal?.removeEventListener('abort', onAbort);
      }
      console.warn('[Police API] Повтор GET-запроса', target.pathname, `попытка ${attempt + 1}/${attempts}`);
      await pause(attempt === 1 ? 350 : 1000, externalSignal);
    }
  };
})();

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
  let wakePromise=null,waitNotices=0,readyUntil=0;

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

  function waitingNotice(){
    waitNotices++;
    if(typeof document!=='undefined'&&!document.getElementById('pd-api-wait')){
      const el=document.createElement('div');el.id='pd-api-wait';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
      el.textContent='Ожидаем сервер данных. После простоя запуск может занять около минуты…';
      el.style.cssText='position:fixed;bottom:15px;left:50%;transform:translateX(-50%);z-index:2147483000;max-width:calc(100vw - 28px);width:max-content;padding:12px 16px;border:1px solid #5a8ab0;border-radius:10px;background:#0b2238f5;color:#dcefff;box-shadow:0 8px 30px #0007;font:12px/1.5 Segoe UI,sans-serif;pointer-events:none';
      (document.body||document.documentElement).appendChild(el);
    }
    let closed=false;return()=>{if(closed)return;closed=true;waitNotices--;if(!waitNotices&&typeof document!=='undefined')document.getElementById('pd-api-wait')?.remove();};
  }
  function abortable(promise,signal){
    if(!signal)return promise;
    if(signal.aborted)return Promise.reject(abortError());
    return new Promise((resolve,reject)=>{
      const cancel=()=>{signal.removeEventListener('abort',cancel);reject(abortError());};
      signal.addEventListener('abort',cancel,{once:true});
      promise.then(value=>{signal.removeEventListener('abort',cancel);resolve(value)},error=>{signal.removeEventListener('abort',cancel);reject(error)});
    });
  }
  function waitForServer(signal){
    if(Date.now()<readyUntil)return abortable(Promise.resolve(),signal);
    if(!wakePromise){
      const hide=waitingNotice();
      wakePromise=(async()=>{
        const deadline=Date.now()+60000;
        while(Date.now()<deadline){
          const controller=new AbortController();
          const timer=setTimeout(()=>controller.abort(),Math.min(15000,deadline-Date.now()));
          try{
            const response=await originalFetch(API_ORIGIN+'/health',{headers:{Accept:'application/json'},credentials:'omit',cache:'no-store',signal:controller.signal});
            if(response.ok&&(await response.json()).ok===true){readyUntil=Date.now()+5000;return;}
            await response.body?.cancel?.();
          }catch{}finally{clearTimeout(timer)}
          await pause(Math.min(1500,Math.max(0,deadline-Date.now())));
        }
        throw new TypeError('Сервер данных не ответил после ожидания. Повторите загрузку.');
      })().finally(()=>{hide();wakePromise=null;});
    }
    return abortable(wakePromise,signal);
  }
  async function readWithRetries(input, init) {
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, location.href); }
    catch { return originalFetch(input, init); }
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (url.origin !== API_ORIGIN || method !== 'GET') return originalFetch(input, init);

    const signal = init?.signal || (typeof input === 'object' && input?.signal) || null;
    let waitedForServer=false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (signal?.aborted) throw abortError();
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      let timedOut = false,wakeBeforeRetry=false;
      const started = performance.now();
      const attemptMs=url.pathname==='/health'?60000:PER_ATTEMPT_MS;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, attemptMs);
      try {
        const response = await originalFetch(input, {...init, signal: controller.signal});
        // Keep the timeout active until the body arrives, not only the headers.
        if (response.ok) await response.clone().arrayBuffer();
        const ms = Math.round(performance.now() - started);
        if (!RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS) {
          if (attempt > 1) console.info('[Police API] GET восстановлен', url.pathname, `HTTP ${response.status}`, `${ms} мс`);
          return response;
        }
        wakeBeforeRetry=[502,503,504].includes(response.status)&&!waitedForServer&&url.pathname!=='/health';
        console.warn('[Police API] Временный ответ', url.pathname, `HTTP ${response.status}`, `${ms} мс`, `попытка ${attempt}/${MAX_ATTEMPTS}`);
        try { await response.body?.cancel?.(); } catch { /* discard retryable body */ }
      } catch (err) {
        if (signal?.aborted) throw err;
        const networkError = err?.name === 'TypeError' || timedOut;
        if (!networkError || attempt === MAX_ATTEMPTS) throw err;
        wakeBeforeRetry=timedOut&&!waitedForServer&&url.pathname!=='/health';
        console.warn('[Police API] Сетевой сбой', url.pathname,
          timedOut ? `тайм-аут ${attemptMs} мс` : err?.name || 'NetworkError',
          `попытка ${attempt}/${MAX_ATTEMPTS}`);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
      if(wakeBeforeRetry){waitedForServer=true;await waitForServer(signal);}
      await pause(BACKOFF_MS * attempt + Math.random() * 150, signal);
    }
  }

  window.fetch = function policeFetch(input, init) {
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      let url;try{url=new URL(typeof input==='string'?input:input.url,location.href)}catch{return originalFetch(input,init)}
      if(url.origin!==API_ORIGIN)return originalFetch(input,init);
      let hide=null;const timer=setTimeout(()=>{hide=waitingNotice()},8000);
      try{return Promise.resolve(originalFetch(input,init)).finally(()=>{clearTimeout(timer);hide?.()});}
      catch(error){clearTimeout(timer);hide?.();throw error;}
    }
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

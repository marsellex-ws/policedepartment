/* Police Department — prevent repeated actions while network work is pending.
 * Designed to coexist with api-fetch-retry.js (GET-only retries).
 */
(() => {
  'use strict';
  if (window.__pdUiPendingInstalled) return;
  window.__pdUiPendingInstalled = true;

  const css = document.createElement('style');
  css.textContent = `
    @keyframes pd-async-spin {to {transform:rotate(360deg)}}
    button.pd-async-busy, input.pd-async-busy {cursor:progress!important;opacity:.82}
    button.pd-async-busy::after {
      content:"";display:inline-block;vertical-align:-2px;
      width:13px;height:13px;box-sizing:border-box;flex:0 0 13px;
      margin-left:9px;border:2px solid currentColor;border-right-color:transparent;
      border-radius:50%;animation:pd-async-spin .65s linear infinite
    }
    @media (prefers-reduced-motion: reduce) {button.pd-async-busy::after{animation-duration:1.5s}}
  `;
  document.head.appendChild(css);

  const originalFetch = window.fetch;
  const activeForms = new WeakMap();
  const activeButtons = new WeakMap();
  let lastAction = null;

  function buttonFromEvent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const button = target.closest('button, input[type="submit"], input[type="button"]');
    return button instanceof HTMLElement && !button.disabled ? button : null;
  }

  function finish(action) {
    if (!action || action.finished || action.pending > 0) return;
    action.finished = true;
    if (action.timer) clearTimeout(action.timer);
    if (action.button) {
      action.button.classList.remove('pd-async-busy');
      action.button.removeAttribute('aria-busy');
      if (action.button.dataset.pdBusyOwned === 'true') {
        action.button.disabled = false;
        delete action.button.dataset.pdBusyOwned;
      }
      if (action.originalValue !== undefined) action.button.value = action.originalValue;
      activeButtons.delete(action.button);
    }
    if (action.form) activeForms.delete(action.form);
    if (lastAction === action) lastAction = null;
  }

  function scheduleFinish(action, delay = 330) {
    clearTimeout(action.timer);
    action.timer = setTimeout(() => finish(action), delay);
  }

  function activate(action) {
    if (action.activated || action.finished || !action.button) return;
    action.activated = true;
    const button = action.button;
    if (button.disabled) return;
    button.disabled = true;
    button.dataset.pdBusyOwned = 'true';
    button.classList.add('pd-async-busy');
    button.setAttribute('aria-busy', 'true');
    if (button instanceof HTMLInputElement) {
      action.originalValue = button.value;
      button.value = `${button.value} …`;
    }
    activeButtons.set(button, action);
  }

  function createAction(button, form = null) {
    const action = { button, form, time: performance.now(), pending: 0,
      activated: false, finished: false, timer: null, originalValue: undefined };
    lastAction = action;
    if (form) {
      activeForms.set(form, action);
      activate(action);
      // Don't keep an invalid/non-API form permanently blocked.
      scheduleFinish(action, 3000);
    }
    return action;
  }

  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const button = buttonFromEvent(event);
    if (!button) return;
    if (activeButtons.has(button)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    createAction(button);
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (activeForms.has(form)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const button = event.submitter instanceof HTMLElement ? event.submitter :
      form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]');
    createAction(button || null, form);
  }, true);

  // Attach pending UI only to fetches originating immediately after a button action.
  // Don't retry writes; don't change the response/error, only observe completion.
  window.fetch = function (...args) {
    const action = lastAction && !lastAction.finished &&
      performance.now() - lastAction.time < 1500 ? lastAction : null;
    if (action) {
      action.pending += 1;
      activate(action);
      clearTimeout(action.timer);
    }
    let promise;
    try {
      promise = originalFetch.apply(this, args);
    } catch (error) {
      if (action) {
        action.pending -= 1;
        if (action.pending === 0) scheduleFinish(action);
      }
      throw error;
    }
    if (action) {
      Promise.resolve(promise).then(
        () => { action.pending -= 1; if (!action.pending) scheduleFinish(action); },
        () => { action.pending -= 1; if (!action.pending) scheduleFinish(action); }
      );
    }
    return promise;
  };
})();

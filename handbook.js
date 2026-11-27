(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const sidebar = byId('handbookContents');
  const search = byId('handbookSearch');
  const noResults = byId('handbookNoResults');
  const panel = byId('handbookSection');
  const title = byId('handbookTitle');
  const status = byId('handbookStatus');
  const retry = byId('handbookRetry');
  const content = byId('handbookContent');

  let directory = [];
  let pending;
  let active;
  const groups = [
    ['Кодексы', ['uk','ak','tk']],
    ['Устав и подразделения', ['upd','factions','divisions']],
    ['Практика службы', ['roleplay','radio-codes','commands','training','checkpoints','operations']],
    ['Карьерный рост', ['promotions','exams']],
    ['Ссылки', ['resources']]
  ];
  const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё','е');

  function navigation() {
    const query = normalize(search.value.trim());
    sidebar.replaceChildren();
    for (const [label, slugs] of groups) {
      const rows = slugs.map(slug => directory.find(row => row.slug === slug))
        .filter(row => row && normalize(row.title + ' ' + row.slug).includes(query));
      if (!rows.length) continue;
      const group = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = label;
      group.append(heading);
      for (const row of rows) {
        const link = document.createElement('a');
        link.href = '#' + row.slug;
        link.textContent = row.title;
        if (row.slug === active) link.setAttribute('aria-current','page');
        group.append(link);
      }
      sidebar.append(group);
    }
    noResults.hidden = !query || Boolean(sidebar.childElementCount);
  }

  async function showSection({scroll = false} = {}) {
    const slug = location.hash.slice(1);
    const selected = directory.find(row => row.slug === slug) || directory.find(row => row.slug === 'uk') || directory[0];
    pending?.abort();
    const request = new AbortController();
    pending = request;
    active = selected.slug;
    if (!normalize(selected.title + ' ' + active).includes(normalize(search.value.trim()))) search.value = '';
    navigation();
    title.textContent = selected.title;
    status.textContent = 'Загрузка раздела…';
    status.hidden = false;
    retry.hidden = true;
    content.hidden = true;
    content.replaceChildren();
    panel.setAttribute('aria-busy','true');
    if (scroll) panel.scrollIntoView({block:'start',behavior:'instant'});
    try {
      const row = await PolicePublicData.handbookSection(selected.slug, AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));
      if (request.signal.aborted) return;
      title.textContent = row.title;
      // Published HTML is restricted to formatting and handbook media by the write API.
      content.innerHTML = row.body_html;
      for (const summary of content.querySelectorAll('.handbook-chapter > summary')) {
        const heading = summary.nextElementSibling;
        if (heading?.matches('h3,h4,h5,h6')) summary.setAttribute('aria-label', summary.textContent + ' — ' + heading.textContent.trim());
      }
      content.hidden = false;
      status.hidden = true;
    } catch {
      if (request.signal.aborted) return;
      status.textContent = 'Не удалось загрузить раздел.';
      retry.hidden = false;
    } finally {
      if (!request.signal.aborted) panel.setAttribute('aria-busy','false');
    }
  }

  async function load() {
    retry.hidden = true;
    status.textContent = 'Загрузка справочника…';
    try {
      directory = await PolicePublicData.handbook();
      if (!directory.length) throw Error('Empty handbook');
      await showSection();
    } catch {
      status.textContent = 'Не удалось загрузить справочник.';
      retry.hidden = false;
      panel.setAttribute('aria-busy','false');
    }
  }

  content.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.classList.contains('handbook-emoji')) return;
    const fallback = document.createElement(img.closest('a') ? 'span' : 'a');
    fallback.className = 'handbook-media-error';
    fallback.textContent = 'Изображение недоступно в источнике';
    if (fallback instanceof HTMLAnchorElement) {
      fallback.href = img.src;
      fallback.rel = 'noopener noreferrer';
      fallback.target = '_blank';
    }
    img.replaceWith(fallback);
  }, true);

  search.addEventListener('input', navigation);
  retry.addEventListener('click', () => directory.length ? showSection() : load());
  window.addEventListener('hashchange', () => {
    if (directory.length && (!location.hash || directory.some(row => row.slug === location.hash.slice(1)))) {
      showSection({scroll:Boolean(location.hash)});
    }
  });
  load();
})();

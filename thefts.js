(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const source = window.PolicePublicData;
  const archiveSize = 40;
  const playerPageSize = 50;
  const data = {};
  const numberFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2});
  const dateFormat = new Intl.DateTimeFormat('ru-RU', {timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short'});
  const dayFormat = new Intl.DateTimeFormat('ru-RU', {timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', year: 'numeric'});
  const format = value => numberFormat.format(value ?? 0);
  const money = value => value == null ? '—' : '$' + format(value);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => {
    if (!value) return '—';
    const time = new Date(typeof value === 'number' ? value * 1000 : value);
    return Number.isFinite(time.getTime()) ? dateFormat.format(time) : '—';
  };
  const statuses = {success: 'Успех', failed: 'Неудача', arrested: 'Задержан'};
  const currentStatuses = {1: 'В пути к началу', 2: 'В пути к началу', 3: 'В пути к финишу', 4: 'В пути к финишу', 6: 'Ушёл от полиции и едет к финишу'};
  const defaultAvatar = 'png_police_site/profile.png';

  let view = 'police';
  let period = 'week';
  let calendarWeek = '';
  let search = '';
  let historyOffset = 0;
  let playersPage = 0;
  let lastHistoryKey = '';
  let pending = null;
  let searchTimer;

  function message(text, error = false) {
    $('theftStatus').textContent = text;
    $('theftStatus').toggleAttribute('data-error', error);
  }

  function avatar(person) {
    let src = defaultAvatar;
    if (String(person.avatar_url).startsWith('https://pbwgvyhchpzmgqjyqxzv.supabase.co/storage/v1/object/public/ws-avatars/')) src = person.avatar_url;
    return `<img class="theft-avatar" src="${escape(src)}" alt="" loading="lazy" decoding="async">`;
  }

  function metrics(host, values) {
    host.innerHTML = values.map(([label, value]) => `<div class="theft-metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
  }

  function podium(host, people, isPolice) {
    host.innerHTML = people.slice(0, 3).map((item, i) => `<article class="theft-medal" data-place="${i+1}">
      <div class="theft-medal-tag">${i+1} МЕСТО</div>
      <div class="theft-medal-person">${isPolice ? avatar(item) : ''}<div><h3>${escape(item.nickname || item.name)}</h3><small>${escape(isPolice ? item.login ? '@' + item.login : '' : 'Уровень ' + item.level)}</small></div></div>
      <dl><div><dt>${isPolice ? 'Реагирования' : 'Успешные угоны'}</dt><dd>${format(isPolice ? item.count : item.successes)}</dd></div>
      <div><dt>Заработок</dt><dd>${money(isPolice ? item.reward_count ? item.reward : null : item.earnings)}</dd></div></dl>
    </article>`).join('');
  }

  function selectedPolice() {
    return calendarWeek ? data.weeks?.weeks.find(week => week.from === calendarWeek) : data.police?.periods[period];
  }

  function renderPolice() {
    const weeks = data.weeks?.weeks || [];
    const weekSelect = $('theftWeeks');
    weekSelect.replaceChildren(new Option('Календарные недели', ''), ...weeks.map(({from, to}) => (
      new Option(dayFormat.format(new Date(from)) + ' — ' + dayFormat.format(new Date(to)), from)
    )));
    weekSelect.disabled = !weeks.length;
    if (!weeks.some(week => week.from === calendarWeek)) calendarWeek = '';
    weekSelect.value = calendarWeek;
    document.querySelectorAll('[data-period]').forEach(button => button.setAttribute('aria-pressed', String(!calendarWeek && button.dataset.period === period)));

    const selected = selectedPolice();
    const items = selected?.items || [];
    metrics($('policeMetrics'), [
      ['Реагирования', format(selected?.total)],
      ['Общий заработок', money(selected?.reward_count ? selected.total_reward : null)],
      ['Средняя награда', money(selected?.reward_count ? selected.total_reward / selected.reward_count : null)]
    ]);
    podium($('policePodium'), items, true);
    $('policeCount').textContent = items.length ? 'В рейтинге: ' + format(items.length) : '';
    $('policeRows').innerHTML = items.map((person, index) => `<tr>
      <td>${index+1}</td><td><div class="theft-identity">${avatar(person)}<div><button class="theft-person-button" type="button" data-officer="${index}">${escape(person.nickname)}</button>${person.login ? '<small>@' + escape(person.login) + '</small>' : ''}</div></div></td>
      <td>${format(person.count)}</td><td>${money(person.reward_count ? person.reward : null)}</td><td>${money(person.average_reward)}</td><td>${date(person.last_at)}</td>
    </tr>`).join('') || emptyRow(6, selected ? 'За этот период реагирований нет' : 'Рейтинг пока недоступен');
  }

  function renderCurrent() {
    const snapshot = data.current;
    const host = $('currentTheft');
    if (!snapshot?.active) {
      host.innerHTML = '<h3>' + (snapshot ? 'Нет активных угонов' : 'Сводка пока недоступна') + '</h3>';
      return;
    }
    const active = snapshot.active;
    const player = active.state === 1 || active.state === 2 ? 'Имя временно скрыто' :
      [active.name, active.account ? '№ ' + active.account : ''].filter(Boolean).join(' · ') || 'Неизвестно';
    host.innerHTML = `<h3>Активный угон</h3><dl class="theft-current-fields">
      <div><dt>Игрок</dt><dd>${escape(player)}</dd></div>
      <div><dt>Время начала · МСК</dt><dd>${date(active.started_at)}</dd></div>
      <div><dt>Статус</dt><dd>${currentStatuses[active.state] || 'Неизвестно'}</dd></div>
    </dl>`;
  }

  function emptyRow(columns, text) {
    return `<tr><td colspan="${columns}" class="theft-empty">${escape(text)}</td></tr>`;
  }

  function pager(type, page, hasMore) {
    document.querySelector(`[data-page="${type}"][data-step="-1"]`).disabled = page === 0;
    document.querySelector(`[data-page="${type}"][data-step="1"]`).disabled = !hasMore;
    $(type + 'Page').textContent = String(page + 1);
  }

  function renderHistory() {
    const snapshot = data.history;
    const entries = snapshot?.items || [];
    $('theftHistoryRows').innerHTML = entries.map(item => `<tr><td><strong>${escape(item.name)}</strong><small>№ ${escape(item.account)}</small></td>
      <td>${date(item.timestamp)}</td><td>${money(item.reward)}</td><td><span class="theft-badge ${Object.hasOwn(statuses,item.status) ? item.status : ''}">${statuses[item.status] || 'Неизвестно'}</span></td></tr>`).join('') ||
      emptyRow(4, snapshot ? 'Совпадений нет' : 'История пока недоступна');
    pager('history', (snapshot?.offset || 0) / archiveSize, snapshot?.has_more);
  }

  function renderPlayers() {
    const snapshot = data.players;
    const items = snapshot?.players || [];
    const total = snapshot?.totals || {};
    playersPage = Math.min(playersPage, Math.max(0, Math.ceil(items.length / playerPageSize) - 1));
    const offset = playersPage * playerPageSize;
    metrics($('playerMetrics'), [
      ['Игроки', format(total.players)], ['Успешные угоны', format(total.successes)],
      ['Неудачные угоны', format(total.failures)], ['Задержания', format(total.arrests)]
    ]);
    podium($('playerPodium'), items, false);
    $('playerRows').innerHTML = items.slice(offset, offset + playerPageSize).map((item, index) => `<tr>
      <td>${offset+index+1}</td><td><strong>${escape(item.name)}</strong><small>№ ${escape(item.account)}</small></td>
      <td>${format(item.level)}</td><td>${format(item.successes)}</td><td>${format(item.failures)}</td>
      <td>${format(item.arrests)}</td><td>${money(item.earnings)}</td></tr>`).join('') ||
      emptyRow(7, snapshot ? 'Статистики пока нет' : 'Статистика пока недоступна');
    pager('players', playersPage, offset + playerPageSize < items.length);
  }

  const renders = {police: renderPolice, current: renderCurrent, history: renderHistory, players: renderPlayers};
  function render() {
    renders[view]();
    const snapshot = view === 'police' && calendarWeek ? data.weeks : data[view];
    if (!snapshot) return;
    const old = Date.now() - Date.parse(snapshot.updated_at) > (view === 'current' ? 3 : 15) * 60000;
    message('Обновлено ' + date(snapshot.updated_at) + ' МСК' + (old ? ' · данные давно не обновлялись' : ''));
  }

  async function load(force = false) {
    pending?.abort();
    pending = null;
    $('theftRefresh').disabled = false;
    const tab = view;
    const historyKey = JSON.stringify([search, historyOffset]);
    const currentIsFresh = tab !== 'current' || Date.now() - Date.parse(data.current?.updated_at) < 60000;
    if (!force && data[tab] && currentIsFresh && (tab !== 'history' || lastHistoryKey === historyKey)) {
      render();
      return;
    }
    const controller = new AbortController();
    pending = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    $('theftRefresh').disabled = true;
    message('Загрузка данных…');
    try {
      if (tab === 'police') {
        const [ranking, historical] = await Promise.allSettled([source.thefts(signal), source.theftPortal('police', signal)]);
        if (controller.signal.aborted) return;
        if (ranking.status === 'rejected' || !ranking.value?.periods) throw Error('Рейтинг пока недоступен');
        data.police = ranking.value;
        if (historical.status === 'fulfilled') data.weeks = historical.value;
      } else if (tab === 'history') {
        const snapshot = await source.theftHistory(search, historyOffset, signal);
        if (controller.signal.aborted) return;
        data.history = {...snapshot, offset: historyOffset};
        lastHistoryKey = historyKey;
      } else {
        const snapshot = await source.theftPortal(tab, signal);
        if (controller.signal.aborted) return;
        data[tab] = snapshot;
      }
      render();
    } catch (error) {
      if (!controller.signal.aborted) {
        renders[tab]();
        message(data[tab] ? 'Не удалось обновить. Показаны последние загруженные данные.' : 'Данные не загрузились. Нажмите «Обновить».', true);
      }
    } finally {
      if (pending === controller) {
        pending = null;
        $('theftRefresh').disabled = false;
      }
    }
  }

  document.querySelector('.theft-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button || button.dataset.view === view) return;
    clearTimeout(searchTimer);
    view = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelectorAll('[data-panel]').forEach(panel => panel.hidden = panel.dataset.panel !== view);
    load();
  });
  document.querySelector('.theft-periods').addEventListener('click', event => {
    const button = event.target.closest('[data-period]');
    if (button) {period = button.dataset.period; calendarWeek = ''; if (data.police) render();}
  });
  $('theftWeeks').addEventListener('change', event => {calendarWeek = event.target.value; render();});
  $('theftRefresh').addEventListener('click', () => load(true));
  $('theftSearch').addEventListener('input', event => {
    search = event.target.value.trim();
    historyOffset = 0;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {if (view === 'history') load();}, 220);
  });
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
    const step = Number(button.dataset.step);
    if (button.dataset.page === 'history') {
      if (pending) return;
      historyOffset = Math.max(0, (data.history?.offset || 0) + step * archiveSize);
      load();
    } else {
      playersPage = Math.max(0, playersPage + step);
      render();
    }
  }));

  $('policeRows').addEventListener('click', event => {
    const button = event.target.closest('[data-officer]');
    if (!button) return;
    const person = selectedPolice()?.items[Number(button.dataset.officer)];
    if (!person) return;
    $('policeHistoryTitle').textContent = person.nickname + ' · история реагирований';
    $('policeHistoryRows').innerHTML = person.events.map(item => `<tr><td>${date(item.timestamp)}</td><td>${money(item.reward)}</td></tr>`).join('');
    $('policeHistory').showModal();
  });
  document.addEventListener('error', event => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.classList.contains('theft-avatar') && img.getAttribute('src') !== defaultAvatar) img.src = defaultAvatar;
  }, true);
  setInterval(() => {if (view === 'current' && !document.hidden && !pending) load(true);}, 60000);

  const dots = document.querySelector('.theft-dots');
  const hover = matchMedia('(any-hover:hover) and (any-pointer:fine) and (prefers-reduced-motion:no-preference)');
  let pointer;
  let frame = 0;
  function clearHighlight() {
    cancelAnimationFrame(frame);
    frame = 0;
    dots.removeAttribute('data-hover');
  }
  document.addEventListener('pointermove', event => {
    if (!hover.matches || event.pointerType === 'touch') return;
    pointer = event;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      dots.style.setProperty('--x', pointer.clientX + 'px');
      dots.style.setProperty('--y', pointer.clientY + 'px');
      dots.setAttribute('data-hover', '');
    });
  }, {passive: true});
  document.documentElement.addEventListener('pointerleave', clearHighlight);
  window.addEventListener('blur', clearHighlight);
  hover.addEventListener('change', clearHighlight);
  load();
})();

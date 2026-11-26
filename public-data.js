(() => {
  'use strict';

  const rest = 'https://pbwgvyhchpzmgqjyqxzv.supabase.co/rest/v1/';
  const headers = Object.freeze({Accept: 'application/json', apikey: 'sb_publishable_l6R3hT6T4mygoHEy_-kAaw_ZGNevOhN'});
  const registryColumns = 'id,department,nickname,account_number,punishment_type,article,reason,evidence_url,issued_by,redemption_type,redemption_proof_url,redemption_proof_label,status,issued_at,paid_at,paid_by,created_at,updated_at,version';

  function url(resource, query) {
    return rest + resource + (query ? '?' + new URLSearchParams(query) : '');
  }

  const urls = Object.freeze({
    leadership: url('pd_portal_leadership', {select: 'slot,nickname,avatar_url,vk_url,forum_url,gender'}),
    leadershipOrder: url('pd_leadership_order', {select: 'slots,version', id: 'eq.1'}),
    chiefs: url('rpc/pd_public_chiefs'),
    thefts: url('pd_theft_snapshot', {select: 'payload', id: 'eq.1'}),
    exams: url('rpc/pd_public_exams'),
    registry: url('pd_punishments', {select: registryColumns, order: 'issued_at.desc', limit: 100, offset: 0}),
    prizes: url('pd_range_prizes', {
      select: 'id,name,tier,hp,armor,image_url,icon,is_enabled,sort_order',
      is_enabled: 'eq.true', order: 'sort_order.asc', limit: 100
    }),
    rangeSettings: url('pd_range_settings', {
      select: 'id,round_seconds,speed_multiplier,bonus_a,bonus_b,bonus_interval,max_extra_seconds',
      id: 'eq.1', limit: 1
    })
  });

  async function read(address, signal, fetcher = window.fetch.bind(window)) {
    const response = await fetcher(address, {
      headers, cache: 'no-store', credentials: 'omit', signal: signal ?? AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('Supabase HTTP ' + response.status);
    return response.json();
  }

  async function readRows(address, signal) {
    const rows = await read(address, signal);
    if (!Array.isArray(rows)) throw new Error('Некорректный ответ Supabase');
    return rows;
  }

  async function admin(resource, search) {
    const token = window.PoliceSession?.get();
    if (!token) throw Object.assign(new Error('Войдите в профиль'), {status: 401});
    const response = await window.fetch(url('rpc/pd_admin_read'), {
      method: 'POST', headers: {...headers, 'Content-Type': 'application/json'},
      credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
      body: JSON.stringify({p_session_token: token, p_resource: resource, p_search: search})
    });
    if (!response.ok) {
      const message = response.status === 401 ? 'Сессия истекла' :
        response.status === 403 ? 'Недостаточно прав' : 'Не удалось загрузить данные (' + response.status + ')';
      throw Object.assign(new Error(message), {status: response.status});
    }
    const data = await response.json();
    if (resource === 'users' || resource === 'role-users') {
      const avatarBase = new URL('/storage/v1/object/public/ws-avatars/', rest).href;
      data.items = data.items.map(({avatar_path, ...item}) => ({
        ...item,
        avatar_url: item.avatar_url || (avatar_path ? avatarBase + avatar_path.split('/').map(encodeURIComponent).join('/') : null)
      }));
    }
    return data;
  }

  window.PolicePublicData = Object.freeze({
    admin,
    urls,
    prefetch: (address, fetcher) => read(address, AbortSignal.timeout(8000), fetcher),
    leadership: signal => readRows(urls.leadership, signal),
    async leadershipOrder(signal) {
      const [layout] = await readRows(urls.leadershipOrder, signal);
      if (!Array.isArray(layout?.slots) || !Number.isInteger(layout.version)) throw new Error('Не удалось загрузить порядок руководства');
      return layout;
    },
    async chiefs(signal) {
      const data = await read(urls.chiefs, signal);
      if (data?.ok !== true || !Array.isArray(data.items)) throw new Error('Не удалось получить список шефов');
      return data;
    },
    async thefts() {
      const [snapshot] = await readRows(urls.thefts);
      return snapshot?.payload;
    },
    async range(signal) {
      const [prizes, settings] = await Promise.all([
        readRows(urls.prizes, signal), readRows(urls.rangeSettings, signal)
      ]);
      return {prizes, settings: settings[0] ?? null};
    },
    async exams() {
      const data = await read(urls.exams);
      if (data?.ok !== true || !Array.isArray(data.exams)) throw new Error('Не удалось получить список экзаменов');
      return data;
    },
    async exam(slug) {
      const data = await read(url('rpc/pd_public_exams', {p_slug: slug}));
      if (data?.ok !== true || !data.exam || !Array.isArray(data.questions)) throw new Error('Экзамен недоступен');
      return data;
    },
    async registry(offset = 0) {
      const address = new URL(urls.registry);
      address.searchParams.set('offset', offset);
      const items = await readRows(address.href);
      return {items, next_offset: items.length === 100 ? offset + 100 : null};
    }
  });
})();

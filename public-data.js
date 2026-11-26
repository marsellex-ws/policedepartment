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

  window.PolicePublicData = Object.freeze({
    urls,
    prefetch: (address, fetcher) => read(address, AbortSignal.timeout(8000), fetcher),
    leadership: signal => readRows(urls.leadership, signal),
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

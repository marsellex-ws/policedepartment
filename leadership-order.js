(() => {
  'use strict';

  const curators = ['responsible', 'curator_lspd', 'curator_sfpd', 'curator_lvpd'];
  const leaders = ['leader_lspd', 'leader_sfpd', 'leader_lvpd'];
  const swat = ['swat_commander', 'swat_deputy', 'swat_deputy_2'];

  function sort(slots, order = []) {
    const remaining = new Set(slots);
    return [...order.filter(slot => remaining.delete(slot)), ...remaining];
  }

  function groups(items, order) {
    const appointed = new Set(items.filter(item => (
      item.nickname?.trim() && item.vk_url?.trim() && item.forum_url?.trim()
    )).map(item => item.slot));
    const ministerInLeaders = curators.every(slot => appointed.has(slot));
    return [
      {key: 'curators', name: 'CURATORS', label: 'Кураторы', ids: sort(ministerInLeaders ? curators : [...curators, 'minister'], order)},
      {key: 'leaders', name: 'LEADERS', label: 'Лидеры', ids: sort(ministerInLeaders ? ['minister', ...leaders] : leaders, order)},
      {key: 'swat', name: 'COMMANDER SWAT', label: 'Командование SWAT', ids: sort(swat, order)}
    ];
  }

  window.PoliceLeadershipOrder = Object.freeze({sort, groups});
})();

(() => {
  'use strict';

  const length = 30;
  const dayMs = 86400000;
  const moscow = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'});
  const russianDate = new Intl.DateTimeFormat('ru-RU', {timeZone:'UTC',dateStyle:'short'});
  const plural = new Intl.PluralRules('ru');
  const units = {one:'день',few:'дня',many:'дней',other:'дней'};
  const days = value => value + ' ' + units[plural.select(value)];
  const nicknameKey = value => String(value || '').trim().toLowerCase().replace(/[\s_]+/g,'_');
  const sameNickname = (a,b) => Boolean(nicknameKey(a) && nicknameKey(a) === nicknameKey(b));

  function dateForElapsed(elapsed, now = new Date()) {
    if (!Number.isSafeInteger(elapsed) || elapsed < 0) return '';
    const today = Date.parse(moscow.format(now) + 'T00:00:00Z');
    const date = new Date(today - elapsed * dayMs);
    if (!Number.isFinite(date.valueOf()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return '';
    return date.toISOString().slice(0,10);
  }

  function describe(appointedOn, now = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointedOn || '')) return null;
    const start = new Date(appointedOn + 'T00:00:00Z');
    if (!Number.isFinite(start.valueOf()) || start.toISOString().slice(0,10) !== appointedOn) return null;
    const today = Date.parse(moscow.format(now) + 'T00:00:00Z');
    const elapsed = Math.max(0, (today - start.valueOf()) / dayMs);
    const remaining = Math.max(0, length - elapsed);
    const stage = remaining > 15 ? 'early' : remaining > 7 ? 'middle' : 'late';
    const mood = stage === 'early' ? '😎' : stage === 'middle' ? '😅' : remaining ? '😬' : '😌';
    const label = stage === 'early' ? 'Недавно на посту' : stage === 'middle' ? 'В эпицентре срока' :
      remaining ? 'Скоро конец срока' : '30 дней истекли';
    return {appointment:russianDate.format(start),elapsed,remaining,stage,mood,label,percent:remaining/length*100,length};
  }

  window.PoliceChiefTerms = Object.freeze({describe,days,sameNickname,dateForElapsed});
})();

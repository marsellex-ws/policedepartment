(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const apiBase = 'https://police-api-b2y4.onrender.com';
  const search = byId('headerSearch');
  const overlay = byId('searchOverlay');
  const query = byId('globalSearch');
  const results = byId('searchResults');
  const login = byId('openLogin');
  const profile = byId('pdProfile');
  const menu = byId('pdProfileMenu');
  const toggle = byId('pdProfileToggle');
  const loginDialog = byId('pdLoginDialog');
  const greeting = byId('heroGreeting');
  const greetingName = byId('heroGreetingName');
  const moscowHour = new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',hourCycle:'h23'});

  const pages = [
    ['Реестр наказаний','reestr.html'],
    ['Электронные экзамены','#services'],
    ['Угонки','thefts.html'],
    ['Справочник полиции','handbook.html'],
    ['Новости и обновления','https://forum.gta-samp.ru/index.php?/topic/887947-police-department-%D0%BD%D0%BE%D0%B2%D0%BE%D1%81%D1%82%D0%B8-%D0%B8-%D0%BE%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F-%D0%B2-%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D0%BB%D0%B0%D1%85/'],
    ['Руководство полиции','leadership.html'],
    ['Активность шефов','chiefs.html'],
    ['Топ сотрудников','employees.html'],
    ['Квесты для старшего состава [8-10]','#quests'],
    ['Бонусы','bonuses.html'],
    ['Личный кабинет','entrance.html']
  ];
  let toastTimer;
  let token = PoliceSession.get();
  let user;

  function notify(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'),3000);
  }
  window.PoliceDocks = Object.freeze({notify});

  function showResults() {
    const needle = query.value.trim().toLocaleLowerCase('ru');
    results.replaceChildren();
    for (const [title,href] of pages) {
      if (!title.toLocaleLowerCase('ru').includes(needle)) continue;
      const link = document.createElement('a');
      link.href = href.startsWith('#') && !greeting ? 'index.html' + href : href;
      if (href.startsWith('https://forum.gta-samp.ru/')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      const arrow = document.createElement('span');
      arrow.textContent = '↗';
      link.append(title,arrow);
      results.append(link);
    }
    if (!results.childElementCount) {
      const empty = document.createElement('p');
      empty.textContent = 'Ничего не найдено';
      results.append(empty);
    }
  }

  function showSearch() {
    overlay.classList.add('open');
    query.value = '';
    showResults();
    query.focus();
  }

  function hideSearch() {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    search.focus();
  }

  search.addEventListener('click',showSearch);
  query.addEventListener('input',showResults);
  byId('closeSearch').addEventListener('click',hideSearch);
  results.addEventListener('click',event => {if (event.target.closest('a')) hideSearch();});
  overlay.addEventListener('click',event => {if (event.target === overlay) hideSearch();});
  byId('bellBtn').addEventListener('click',() => notify('Новых уведомлений нет'));

  function setMenu(open) {
    menu.classList.toggle('hidden',!open);
    toggle.setAttribute('aria-expanded',String(open));
  }

  document.addEventListener('keydown',event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !loginDialog.open) {
      event.preventDefault();
      showSearch();
    }
    if (event.key === 'Escape') {
      hideSearch();
      setMenu(false);
    }
  });
  toggle.addEventListener('click',() => setMenu(menu.classList.contains('hidden')));
  document.addEventListener('click',event => {if (!profile.contains(event.target)) setMenu(false);});

  function renderGreeting() {
    if (!greeting) return;
    const hour = Number(moscowHour.format(new Date()));
    greeting.textContent = hour < 5 || hour >= 23 ? 'Доброй ночи' :
      hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    greetingName.textContent = user?.login ? ', ' + user.login : '';
  }

  function render() {
    renderGreeting();
    login.classList.toggle('hidden',Boolean(user));
    profile.classList.toggle('hidden',!user);
    byId('pdAdminOpen').classList.toggle('hidden',!['admin','developer','minister'].includes(user?.role));
    if (!user) {
      byId('pdAdminSection')?.classList.add('hidden');
      return;
    }
    byId('pdNick').textContent = user.nickname || user.login;
    const avatar = byId('pdAvatar');
    const fallback = 'png_police_site/profile.png';
    avatar.onerror = () => {
      avatar.onerror = null;
      avatar.src = fallback;
    };
    avatar.src = user.avatar_url || fallback;
    PoliceRoleUI.decorateExisting(user);
  }

  async function api(path,{method = 'GET',data,session} = {}) {
    const headers = {Accept:'application/json'};
    if (data) headers['Content-Type'] = 'application/json';
    if (session) headers.Authorization = 'Bearer ' + session;
    const response = await fetch(apiBase + path,{method,headers,body:data ? JSON.stringify(data) : undefined});
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.ok === false) {
      throw Object.assign(new Error(json.error || 'Ошибка сервера (' + response.status + ')'),{status:response.status});
    }
    return json;
  }

  let restoreAttempts = 0;
  async function restore() {
    const session = token;
    if (!session) return render();
    try {
      const reply = await api('/api/auth/me',{session});
      if (session !== token) return;
      user = reply.user;
      restoreAttempts = 0;
    } catch (error) {
      if (session !== token) return;
      if (error.status === 401) {
        PoliceSession.clear();
        token = null;
        user = null;
        restoreAttempts = 0;
      } else if (++restoreAttempts <= 3) {
        setTimeout(() => {if (token === session && !user) restore();},2500 * restoreAttempts);
      }
    }
    render();
  }

  login.addEventListener('click',() => {
    loginDialog.showModal();
    byId('pdLoginName').focus();
  });
  byId('pdLoginClose').addEventListener('click',() => loginDialog.close());
  loginDialog.addEventListener('click',event => {if (event.target === loginDialog) loginDialog.close();});
  byId('pdLoginForm').addEventListener('submit',async event => {
    event.preventDefault();
    const errorMessage = byId('pdLoginError');
    const submit = event.currentTarget.querySelector('button[type=submit]');
    const password = byId('pdLoginPassword');
    errorMessage.textContent = '';
    submit.disabled = true;
    try {
      const info = await api('/api/auth/login',{method:'POST',data:{
        login:byId('pdLoginName').value.trim().toLowerCase(),password:password.value
      }});
      PoliceSession.save(info.session_token,info.expires_at);
      token = info.session_token;
      password.value = '';
      await restore();
      if (!token) throw Error('Сессия истекла. Войдите снова.');
      loginDialog.close();
    } catch (error) {
      errorMessage.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  byId('pdAdminOpen').addEventListener('click',() => {
    if (byId('pdAdminSection')) return;
    location.assign(user?.role === 'minister' ? 'admin.html#roles' : 'admin.html');
  });
  byId('pdLogout').addEventListener('click',async () => {
    try {await api('/api/auth/logout',{method:'POST',session:token});} catch { /* Still clear the local session. */ }
    PoliceSession.clear();
    token = null;
    user = null;
    setMenu(false);
    render();
  });

  function syncSession() {
    const latest = PoliceSession.get();
    if (latest !== token) {
      token = latest;
      user = null;
      restoreAttempts = 0;
      restore();
    }
    renderGreeting();
  }

  window.addEventListener('pageshow',syncSession);
  window.addEventListener('storage',event => {
    if (['pd_site_token','pd_site_token_expires_at'].includes(event.key)) syncSession();
  });
  window.addEventListener('online',() => {
    if (!token || user) return;
    restoreAttempts = 0;
    restore();
  });
  if (greeting) setInterval(() => {if (!document.hidden) renderGreeting();},60000);
  renderGreeting();
  restore();
})();

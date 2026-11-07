(()=>{'use strict';
const API='https://police-api-b2y4.onrender.com',fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(n)||0);
const $=id=>document.getElementById(id),h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const state={boot:null,view:'jobs',jobFilter:'all',shopFilter:'my',requests:[],history:[],ledger:[],roster:[],historyPage:1,historyLoaded:false,rosterLoaded:false,requestsLoaded:false,openKind:null,openItem:null,busy:false};
const safeImg=(u,fallback='quest_cyber_assets/icon_shield.png')=>{try{if(!u)return fallback;const p=new URL(String(u),location.href);return (p.protocol==='https:'||(p.protocol==='http:'&&p.host===location.host))&&!p.username&&!p.password?p.href:fallback;}catch{return fallback}};
const initials=s=>String(s||'?').trim().split(/[\s_]+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase()||'?';
const deptOK=d=>['LSPD','SFPD','LVPD'].includes(d);
const token=()=>window.PoliceSession?.get?.();
const auth=async(path,method='GET',body)=>{
 const t=token();if(!t)throw Error('Войди в аккаунт Police Department');
 const c=new AbortController(),time=setTimeout(()=>c.abort(),method==='GET'?100000:20000);
 try{const r=await fetch(API+path,{method,headers:{Authorization:'Bearer '+t,Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:c.signal});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.error||'Ошибка сервера '+r.status);return j}
 catch(e){if(e?.name==='AbortError')throw Error('Сервер не ответил. Повтори попытку.');throw e}
 finally{clearTimeout(time)}
};
const me=()=>state.boot?.me||{},canApply=()=>['senior','leader'].includes(me().role)&&deptOK(me().department),isManager=()=>['all','leader'].includes(me().permissions);
const announce=(message,bad=false)=>{const n=$('notice');n.textContent=message||'';n.classList.toggle('error',bad)};
const niceDate=v=>{if(!v)return '—';const raw=String(v).trim();if(/^\d{4}-\d{2}-\d{2}/.test(raw)){const z=raw.substring(0,10).split('-');return `${z[2]}.${z[1]}.${z[0]}`}if(/\d{1,2}\/\d{1,2}\/\d{4}/.test(raw))return raw;return raw.slice(0,18)};
const price=(x)=>Number(x.points_min)===Number(x.points_max)?fmt(x.points_min):fmt(x.points_min)+'–'+fmt(x.points_max);
const avatar=(m)=>m?.avatar_url?`<img class="person-pic" alt="" src="${h(safeImg(m.avatar_url))}" loading="lazy" data-initials="${h(initials(m.nickname))}">`:`<span class="person-pic" aria-hidden="true">${h(initials(m?.nickname))}</span>`;
function setView(view){if(!['jobs','shop','requests','history','roster','rules'].includes(view))return;state.view=view;document.querySelectorAll('.side-nav button[data-tab]').forEach(b=>{const active=b.dataset.tab===view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==view);announce('');if(token()){if(view==='requests')loadRequests();if(view==='history')loadHistory();if(view==='roster')loadRoster();}}

function renderRules(){
 $('rulesContent').innerHTML=window.PoliceQuestGuide.sections.map((section,i)=>`<details class="rules-section" ${i===0?'open':''}><summary>${h(section.title)}</summary><div class="rules-copy">${section.lines.map(line=>`<p class="${/^[▶✡💫🕎🈚]/u.test(line)?'rule-item':''}">${h(line)}</p>`).join('')}</div></details>`).join('');
}
function renderJobs(){
 const source=state.boot?.jobs||window.PoliceQuestGuide.jobs;
 const query=$('jobSearch').value.trim().toLocaleLowerCase('ru');
 let rows=source.filter(x=>x.active!==false&&!(x.reference&&x.title.startsWith('Фокус недели'))&&!/временно неактуально/i.test(x.title+' '+(x.requirements||''))).filter(x=>(state.jobFilter==='all'||x.audience===(state.jobFilter==='leader'?'leader':'all'))&&(!query||(x.title+' '+(x.requirements||'')).toLocaleLowerCase('ru').includes(query)));
 if($('jobSort').value==='title')rows.sort((a,b)=>a.title.localeCompare(b.title,'ru'));
 $('jobsCards').innerHTML=rows.length?rows.map(j=>{
  const limits=[j.daily_limit?'Не более '+fmt(j.daily_limit)+' в день':'',j.weekly_limit?'Не более '+fmt(j.weekly_limit)+' в неделю':''].filter(Boolean);
  const referenceReward=j.reference?j.title.match(/\[([^\]]+)\]\s*$/)?.[1]:null;
  const title=referenceReward?j.title.replace(/\s*\[[^\]]+\]\s*$/,''):j.title;
  const points=j.reference?(referenceReward||''):j.calc_type==='online'?'Онлайн × 0,20':j.calc_type==='premium'?'4 балла / 50 000$':price(j)+' балл.';
  const eligible=canApply()&&(j.audience!=='leader'||me().role==='leader');
  return `<article class="quest-row"><div class="quest-card-top"><span class="quest-symbol" aria-hidden="true">${j.audience==='leader'?'★':'✓'}</span><span class="tiny-tag">${j.audience==='leader'?'Только шефам · 10 ранг':'СС и шефам · 8–10 ранги'}</span></div><h3 class="quest-name">${h(title)}</h3>${points?`<div class="points-chip">${j.reference?'':'+ '}${h(points)}</div>`:''}<details class="quest-details"><summary>Условия и доказательства</summary><p>${h(j.requirements||'Смотрите полные правила во вкладке «Правила».')}</p></details>${limits.length?`<p class="quest-limits">${h(limits.join(' · '))}</p>`:''}<div class="card-action">${j.reference?'<a class="row-cta" href="entrance.html#login">Войти для подачи отчёта ↗</a>':`<button type="button" data-job="${h(j.id)}" class="row-cta" ${eligible?'':'disabled'}>${eligible?'Отправить отчёт':'Недоступно для вашей роли'}</button>`}</div></article>`;
 }).join(''):'<div class="empty-state">Задания не найдены. Попробуйте другой запрос или категорию.</div>';
 $('jobsCount').textContent='Найдено: '+rows.length+' · Постоянные задания, доступные для повторного выполнения по правилам';
}
function renderShop(){
 const rows=(state.boot?.rewards||window.PoliceQuestGuide.rewards).filter(x=>!state.boot||state.shopFilter==='all'||x.audience===me().track);
 $('shopCards').innerHTML=rows.length?rows.map(x=>`<article class="reward-row"><div class="quest-card-top"><span class="quest-symbol" aria-hidden="true">◇</span><span class="tiny-tag">${x.audience==='leader'?'Шефам':'Старшему составу'}</span></div><h3 class="quest-name">${h(x.title)}</h3>${x.reference?'':`<div class="points-chip">${x.cost==null?'По согласованию':fmt(x.cost)+' балл.'}</div>`}<p class="quest-desc">${h(x.conditions||'Требуется подтверждение проверяющим.')}</p><div class="card-action"><button type="button" class="row-cta" data-reward="${h(x.id)}" ${!x.reference&&canApply()&&x.audience===me().track&&x.cost!=null?'':'disabled'}>${x.reference?'Войдите для обмена':'Подать заявку на обмен'}</button></div></article>`).join(''):'<div class="empty-state">Нет доступных вариантов обмена.</div>';
}
function closeModal(force=false){if(state.busy&&force!==true)return;$('requestModal').hidden=true;document.body.classList.remove('modal-open');state.returnFocus?.focus();}
function updateEstimate(){
 const x=state.openItem;if(!x)return;const qty=Number($('quantity').value)||0;
 const value=state.openKind==='reward'?Number(x.cost):x.calc_type==='online'?qty*.2:x.calc_type==='premium'?Math.floor(qty/50000)*4:x.calc_type==='per_unit'?qty*Number(x.points_min):x.calc_type==='range'?Number($('requestedPoints').value):Number(x.points_min);
 $('pointsEstimate').textContent=(state.openKind==='reward'?'К списанию: ':'К начислению после одобрения: ')+fmt(value)+' баллов';
}
document.addEventListener('keydown',e=>{
 if($('requestModal').hidden||e.key!=='Tab')return;
 const nodes=[...$('questForm').querySelectorAll('button,input,textarea')].filter(n=>!n.disabled&&n.getClientRects().length);
 const first=nodes[0],last=nodes.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});

function renderRequests(){const own=state.requests.filter(x=>x.requested_by===me().login);$('myRequests').textContent=own.length;$('requestList').innerHTML=own.length?own.map(x=>{const status=x.status==='approved'?'approved':x.status==='rejected'?'rejected':'pending';const label={approved:'ОДОБРЕНО',rejected:'ОТКЛОНЕНО',pending:'НА ПРОВЕРКЕ'}[status];return `<article class="request-row"><div class="request-info"><div class="request-top"><div class="quest-name">${h(x.item_title)}</div><span class="status-pill ${status}">${label}</span></div><div class="request-meta">${x.kind==='reward'?'Обмен баллов':'Отчёт'} · ${niceDate(x.created_at)} · ${h(x.department)}</div>${x.note?`<div class="quest-desc">${h(x.note)}</div>`:''}${x.evidence_url?`<a class="details-link" href="${h(safeImg(x.evidence_url,'#'))}" target="_blank" rel="noopener noreferrer">Доказательства</a>`:''}${x.review_note?`<div class="quest-desc">Решение: ${h(x.review_note)}</div>`:''}</div><span class="points-chip ${x.kind==='reward'?'purple':''}">${x.kind==='reward'?'−':'+'}${fmt(x.points)}</span></article>`}).join(''):'<div class="empty-state">Заявок пока нет.</div>'}
async function loadRequests(force=false){if(state.requestsLoaded&&!force){renderRequests();return}const el=$('requestList');el.innerHTML='<div class="empty-state loading">Загружаем заявки</div>';try{const r=await auth('/api/portal/quests/requests');state.requests=r.items||[];state.requestsLoaded=true;renderRequests()}catch(e){el.innerHTML='<div class="empty-state">Не удалось загрузить заявки</div>';announce(e.message,true)}}
function historyType(x){if(x._modern)return 'ledger';const s=String(x.source_sheet||'');if(s==='ИСТОРИЯ ОБМЕНА СС')return 'senior_exchange';if(s==='ИСТОРИЯ ОБМЕНА ШЕФОВ')return 'leader_exchange';if(s==='УЧЁТ РАБОТЫ ШЕФОВ')return 'chief_work';return 'other'}
function historyLabel(x){return ({ledger:'Сайт',senior_exchange:'Обмен СС',leader_exchange:'Обмен шефов',chief_work:'Учёт шефов',other:'Архив'})[historyType(x)]}
function historyWhen(x){return x._modern?x.created_at:(x.event_date||x.date_text||'')}
function historySortable(x){const dt=String(historyWhen(x)||'');if(/^\d{4}-\d{2}-\d{2}/.test(dt))return dt.slice(0,10);const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(dt);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''}
function freezeValue(x){if(x._modern)return '—';const vals=x.source_data?.values;const flag=Array.isArray(vals)?vals[7]:null;return flag===true?'Да':flag===false?'Нет':'—'}
function renderHistory(){const source=$('historySource').value,dept=$('historyDept').value,q=$('historySearch').value.trim().toLocaleLowerCase('ru'),all=[...state.history,...state.ledger];let items=all.filter(x=>(source==='all'||historyType(x)===source)&&(dept==='all'||x.department===dept)&&(!q||[x.department,x.nickname,x.description,x.event_type,historyWhen(x)].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q))));items.sort((a,b)=>historySortable(b).localeCompare(historySortable(a))||Number(b.id||0)-Number(a.id||0));const total=items.length,perPage=30,pages=Math.max(1,Math.ceil(total/perPage));state.historyPage=Math.max(1,Math.min(state.historyPage,pages));const subset=items.slice((state.historyPage-1)*perPage,state.historyPage*perPage);$('historyTable').innerHTML=total?`<table class="history-table"><thead><tr><th>PD</th><th>Сотрудник</th><th>Баллы до</th><th>Списание / начисление</th><th>Баллы после</th><th>На что обмен / действие</th><th>Дата</th><th>Разморозил</th><th>Источник</th></tr></thead><tbody>${subset.map(x=>`<tr><td><span class="tiny-tag">${h(x.department||'—')}</span></td><td class="who">${h(x.nickname||'—')}</td><td>${x._modern?'—':h(x.before_points??'—')}</td><td>${x._modern?(Number(x.amount)>=0?'+':'')+fmt(x.amount):h(x.amount??'—')}</td><td>${x._modern?'—':h(x.after_points??'—')}</td><td class="reason">${h(x.description||x.event_type||'—')}${x.needs_review?' <span class="status-pill warn" title="Исходная строка требует сверки">Проверить</span>':''}</td><td>${h(niceDate(historyWhen(x)))}</td><td>${h(freezeValue(x))}</td><td><span class="tiny-tag">${h(historyLabel(x))}</span></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">В выбранном разделе нет записей.</div>';$('historyPager').innerHTML=`<span>Записей: ${total}</span><button type="button" data-page="prev" ${state.historyPage===1?'disabled':''} aria-label="Назад">‹</button><span>${state.historyPage} / ${pages}</span><button type="button" data-page="next" ${state.historyPage===pages?'disabled':''} aria-label="Вперёд">›</button>`}
async function loadHistory(force=false){if(state.historyLoaded&&!force){renderHistory();return}const el=$('historyTable');el.innerHTML='<div class="empty-state loading">Загружаем историю</div>';try{const [a,b]=await Promise.all([auth('/api/portal/quests/history'),auth('/api/portal/quests/ledger')]);state.history=(a.items||[]).map(x=>({...x,_modern:false}));state.ledger=(b.items||[]).map(x=>({...x,_modern:true}));state.historyLoaded=true;renderHistory()}catch(e){el.innerHTML='<div class="empty-state">История временно недоступна</div>';announce(e.message,true)}}
function rosterHTML(rows,short=false){const depts=['LSPD','SFPD','LVPD'];return depts.map(dep=>{const people=rows.filter(x=>x.department===dep&&x.track!=='blacklist').sort((a,b)=>Number(b.track==='leader')-Number(a.track==='leader')||String(a.nickname).localeCompare(String(b.nickname),'ru'));const preview=short?people.slice(0,2):people;return `<section class="dept-tile ${dep.toLowerCase()}"><div class="dept-banner"><strong>${dep}</strong><span>${people.length} чел.</span></div><div class="dept-members">${preview.length?preview.map(p=>`<div class="person">${avatar(p)}<div class="person-text"><strong title="${h(p.nickname)}">${h(p.nickname)}</strong><span>${p.track==='leader'?'Лидер':'Старший состав'}</span></div><span class="person-score">${fmt(p.balance)}</span></div>`).join(''):'<div class="empty-state" style="padding:13px">Состав не назначен</div>'}</div></section>`}).join('')}
function renderRoster(){
 $('rosterGrid').innerHTML=rosterHTML(state.roster.filter(x=>x.track!=='blacklist'));
}
async function loadRoster(force=false){
 if(state.rosterLoaded&&!force){renderRoster();return;}
 try{const r=await auth('/api/portal/quests/roster-public');state.roster=r.items||[];state.rosterLoaded=true;renderRoster();}
 catch(e){$('rosterGrid').innerHTML='<div class="empty-state">Не удалось загрузить состав</div>';if(state.view==='roster')announce(e.message,true);}
}
function formOpen(k,id){if(!canApply())return;const x=k==='quest'?(state.boot.jobs||[]).find(t=>t.id===id):(state.boot.rewards||[]).find(t=>t.id===id);if(!x)return;state.openKind=k;state.openItem=x;$('questForm').reset();$('modalError').textContent='';$('modalError').classList.remove('error');$('modalTitle').textContent=k==='quest'?'Отчёт: '+x.title:'Обмен: '+x.title;$('modalDesc').textContent=k==='quest'?(x.requirements||'')+'\nДоказательства по порядку, с /time.':'Цена: '+fmt(x.cost)+' баллов. '+(x.conditions||'');const qty=k==='quest'&&['per_unit','online','premium'].includes(x.calc_type);$('qtyField').hidden=!qty;$('quantity').required=qty;$('qtyField').firstChild.textContent=x.calc_type==='online'?'Онлайн сотрудников':x.calc_type==='premium'?'Сумма премий ($)':'Количество';$('quantity').step=x.calc_type==='premium'?50000:1;$('quantity').min=x.calc_type==='premium'?50000:1;$('quantity').max=x.calc_type==='premium'?500000:x.calc_type==='per_unit'?20:1000000;$('quantity').value=x.calc_type==='premium'?50000:1;const dynamic=k==='quest'&&x.calc_type==='range';$('pointsField').hidden=!dynamic;$('requestedPoints').required=dynamic;$('requestedPoints').min=x.points_min??0;$('requestedPoints').max=x.points_max??500;$('requestedPoints').value=x.points_min||0;$('evidenceField').hidden=k!=='quest';$('evidence').required=k==='quest';state.returnFocus=document.activeElement;$('requestModal').hidden=false;document.body.classList.add('modal-open');updateEstimate();$('modalCancel').focus();}
async function submitRequest(e){e.preventDefault();if(state.busy||!state.openItem)return;state.busy=true;const b=$('modalSubmit');b.disabled=true;b.classList.add('loading');$('modalError').textContent='';const request={kind:state.openKind,item_id:state.openItem.id,quantity:Number($('quantity').value)||1,points:Number($('requestedPoints').value)||0,evidence_url:$('evidence').value.trim(),note:$('reqNote').value.trim()};try{await auth('/api/portal/quests/requests','POST',request);closeModal(true);state.requestsLoaded=false;state.requests=[];setView('requests');announce('Заявка отправлена на проверку')}catch(e){$('modalError').classList.add('error');$('modalError').textContent=e.message}finally{state.busy=false;b.disabled=false;b.classList.remove('loading')}}
function bind(){
 $('jobSearch').addEventListener('input',renderJobs);$('jobSort').addEventListener('change',renderJobs);$('quantity').addEventListener('input',updateEstimate);$('requestedPoints').addEventListener('input',updateEstimate);
document.addEventListener('error',e=>{const target=e.target;if(target?.matches?.('img.person-pic')){const span=document.createElement('span');span.className='person-pic';span.textContent=target.getAttribute('data-initials')||'?';target.replaceWith(span)}},true);document.querySelectorAll('.side-nav [data-tab]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.tab)));document.querySelectorAll('[data-job-filter]').forEach(b=>b.addEventListener('click',()=>{state.jobFilter=b.dataset.jobFilter;document.querySelectorAll('[data-job-filter]').forEach(a=>a.classList.toggle('selected',a===b));renderJobs()}));document.querySelectorAll('[data-shop-filter]').forEach(b=>b.addEventListener('click',()=>{state.shopFilter=b.dataset.shopFilter;document.querySelectorAll('[data-shop-filter]').forEach(a=>a.classList.toggle('selected',a===b));renderShop()}));$('jobsCards').addEventListener('click',e=>{const b=e.target.closest('[data-job]');if(b)formOpen('quest',b.dataset.job)});$('shopCards').addEventListener('click',e=>{const b=e.target.closest('[data-reward]');if(b)formOpen('reward',b.dataset.reward)});$('questForm').addEventListener('submit',submitRequest);$('modalCancel').onclick=closeModal;$('requestModal').onclick=e=>{if(e.target.id==='requestModal'&&!state.busy)closeModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!state.busy)closeModal()});$('refreshRequests').onclick=()=>loadRequests(true);['historySource','historyDept'].forEach(id=>$(id).addEventListener('change',()=>{state.historyPage=1;renderHistory()}));$('historySearch').addEventListener('input',()=>{state.historyPage=1;renderHistory()});$('historyPager').addEventListener('click',e=>{const p=e.target.closest('[data-page]');if(!p)return;state.historyPage+=p.dataset.page==='next'?1:-1;renderHistory()});}
async function init(){
 bind();renderRules();renderJobs();renderShop();
 const urlTab=new URLSearchParams(location.search).get('tab');
 if(urlTab&&['jobs','shop','requests','history','roster','rules'].includes(urlTab))setView(urlTab);
 if(!token()){
  $('refreshRequests').disabled=true;
  $('historyTable').innerHTML='<p class="empty-state">Войдите для просмотра истории.</p>';
  $('rosterGrid').innerHTML='<p class="empty-state">Войдите для просмотра состава.</p>';
  $('requestList').innerHTML='<p class="empty-state">Войдите, чтобы увидеть свои заявки.</p>';
  return;
 }
 try{
  const b=await auth('/api/portal/quests/bootstrap');state.boot=b;
  $('balance').textContent=b.member?fmt(b.member.balance):'—';
  $('myDept').textContent=me().department||'Все PD';
  $('rosterManage').hidden=!isManager();renderJobs();renderShop();
  await loadRequests();
  if(state.view==='history')await loadHistory();
  if(state.view==='roster')await loadRoster();
 }catch(e){announce(e.message+' Каталог правил доступен ниже. Для повторной загрузки обновите страницу.',true);}
}
init();
})();

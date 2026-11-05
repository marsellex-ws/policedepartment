/* Police theft rankings use the live API. Other categories retain explicit demo fixtures. */
(()=>{'use strict';
const categories=[
 {id:'thefts',label:'Угоны',title:'Мастера перехвата',unit:'реагирований на угоны',icon:'car_thefts'},
 {id:'kills',label:'Ликвидации',title:'На линии огня',unit:'ликвидаций',icon:'shield'},
 {id:'jail',label:'КПЗ',title:'Порядок под контролем',unit:'задержаний',icon:'arrests'},
 {id:'fines',label:'Штрафы',title:'Закон в действии',unit:'выписанных штрафов',icon:'fines'},
 {id:'points',label:'Баллы',title:'Результат говорит за себя',unit:'баллов',icon:'star'},
 {id:'binder',label:'Актив в биндере',title:'Всегда на связи',unit:'часов активности',icon:'statistics'}
];
// Keep distinct category results so switching also previews changes in the podium.
const people=[['Alex_Morgan','LSPD',[148,216,92,164,381,84]],['Daniel_Carter','SFPD',[132,248,118,138,426,72]],['Max_Bennett','LVPD',[119,193,106,182,354,91]],['Ryan_Cooper','LSPD',[108,175,81,126,312,68]],['James_Walker','SFPD',[96,168,74,119,295,64]],['Leo_Hunter','LVPD',[87,154,69,104,278,59]],['Nick_Parker','LSPD',[76,142,62,96,241,52]],['Adam_Brooks','SFPD',[68,131,54,88,218,48]],['Mark_Reed','LVPD',[59,116,48,79,196,43]],['Jack_Miller','LSPD',[51,104,43,71,174,38]],['Chris_Hayes','SFPD',[44,92,38,64,153,34]],['Sam_Turner','LVPD',[38,81,31,56,132,29]]];
const $=id=>document.getElementById(id);let selected=0,period='week',live=null,loading=false,loadError='',officer='all',historyPage=1;
const API='https://police-api-b2y4.onrender.com';
const fmt=new Intl.NumberFormat('ru-RU');
const money=value=>value===null||value===undefined?'Не указана':'$'+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const portrait='<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="21" r="11"/><path d="M11 57v-6c0-12 9-18 21-18s21 6 21 18v6H11Z"/></svg>';
$('categories').innerHTML=categories.map((c,i)=>`<button type="button" data-category="${i}" aria-pressed="${i===0}"><img src="png_police_site/${c.icon}.png" alt=""><span>${c.label}</span></button>`).join('');
function render(){
 const c=categories[selected],isTheft=selected===0,dept=$('department').value;
 const ranked=isTheft?(live?.periods?.[period]?.items||[]):people.filter(p=>dept==='all'||p[1]===dept).slice().sort((a,b)=>b[2][selected]-a[2][selected]).map(p=>({nickname:p[0],department:p[1],count:p[2][selected]}));
 $('categoryKicker').textContent='РЕЙТИНГ · '+c.label.toLocaleUpperCase('ru');$('categoryTitle').textContent=c.title;$('metricHeading').textContent=isTheft?'Реагирования':c.label;
 $('detailHeading').textContent=isTheft?'Последнее реагирование · МСК':'Департамент';
 $('department').closest('label').hidden=isTheft;$('theftControls').hidden=!isTheft;
 $('dataBadge').textContent=isTheft?'РЕАЛЬНЫЕ ДАННЫЕ · РЕАГИРОВАНИЯ ПОЛИЦИИ':'МАКЕТ · Демонстрационные имена и показатели';
 $('rankingNote').textContent=isTheft?'Источник: djoniohanter.com/car_theft · Только реагирования полиции. Периоды: последние 24 часа, 7 и 30 дней. Департаменты в источнике не указаны.':'Предварительный вид рейтинга · Демонстрационные данные';
 $('theftSummary').hidden=!isTheft;$('theftHistory').hidden=!isTheft;
 document.querySelectorAll('.theft-money-heading').forEach(el=>{el.hidden=!isTheft;});
 const stats=live?.periods?.[period];
 $('theftSummary').innerHTML=isTheft&&stats?`<div><span>Реагирования за период</span><strong>${fmt.format(stats.total??ranked.reduce((s,p)=>s+p.count,0))}</strong></div><div><span>Общая награда</span><strong>${money(stats.total_reward)}</strong></div><div><span>В среднем за реагирование</span><strong>${money(stats.reward_count?stats.total_reward/stats.reward_count:null)}</strong></div>`:'';
 if(isTheft)renderHistory();
 $('refreshThefts').disabled=loading;
 $('theftStatus').hidden=!isTheft;
 $('theftStatus').textContent=loading?'Загружаем реагирования полиции…':loadError||(live?'Обновлено: '+date(live.updated_at)+' МСК'+(ranked.length?'':' · За выбранный период реагирований нет.'):'');
 document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.category)===selected)));
 document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===period)));
 $('podium').innerHTML=ranked.slice(0,3).map((p,i)=>`<article class="winner place-${i+1}" aria-label="${i+1} место: ${escape(p.nickname)}"><div class="player-card"><div class="rank-tag">${i===0?'★ ':''}${i+1} МЕСТО</div><div class="avatar">${portrait}<span class="player-number">${i+1}</span></div><span class="player-dept">${isTheft?'POLICE DEPARTMENT':escape(p.department)} · СОТРУДНИК</span><h3 class="player-name">${escape(p.nickname)}</h3><div class="player-divider"></div><div class="player-value">${fmt.format(p.count)}</div><div class="player-unit">${c.unit}</div>${isTheft?`<div class="player-rewards"><span>Награда за период<strong>${money(p.reward)}</strong></span><span>В среднем за реагирование<strong>${money(p.average_reward)}</strong></span></div><button class="history-open" type="button" data-history-officer="${i}">Все реагирования ↗</button>`:''}</div><div class="pedestal" aria-hidden="true">${['GOLD','SILVER','BRONZE'][i]}</div></article>`).join('');
 $('podium').closest('.podium-stage').hidden=ranked.length===0;
 $('rankingRows').innerHTML=ranked.slice(3).map((p,i)=>`<tr><td>${String(i+4).padStart(2,'0')}</td><td>${isTheft?`<button type="button" class="history-name" data-history-officer="${i+3}">${escape(p.nickname)}</button>`:escape(p.nickname)}</td><td>${isTheft?date(p.last_at*1000):escape(p.department)}</td><td>${fmt.format(p.count)}</td>${isTheft?`<td>${money(p.reward)}</td><td>${money(p.average_reward)}</td>`:''}</tr>`).join('');
 $('resultCount').textContent=ranked.length+' сотрудников'+(isTheft?' · '+({day:'24 часа',week:'7 дней',month:'30 дней'}[period]):' · демо');
 $('podium').classList.remove('refreshing');void $('podium').offsetWidth;$('podium').classList.add('refreshing');
}
function renderHistory(){
 const items=live?.periods?.[period]?.items||[];
 if(officer!=='all'&&!items.some(p=>p.nickname===officer)){officer='all';historyPage=1;}
 $('historyOfficer').innerHTML='<option value="all">Все сотрудники</option>'+items.map(p=>`<option value="${escape(p.nickname)}">${escape(p.nickname)}</option>`).join('');$('historyOfficer').value=officer;
 const events=items.filter(p=>officer==='all'||p.nickname===officer).flatMap(p=>(p.events||[]).map(e=>({...e,nickname:p.nickname}))).sort((a,b)=>b.timestamp-a.timestamp||a.nickname.localeCompare(b.nickname));
 const pages=Math.max(1,Math.ceil(events.length/30));historyPage=Math.max(1,Math.min(pages,historyPage));
 $('theftEventRows').innerHTML=events.slice((historyPage-1)*30,historyPage*30).map(e=>`<tr><td>${date(e.timestamp*1000)}</td><td>${escape(e.nickname)}</td><td>${money(e.reward)}</td></tr>`).join('')||'<tr><td colspan="3">За выбранный период реагирований нет.</td></tr>';
 $('theftEventCount').textContent='Реагирований: '+fmt.format(events.length)+' · Награда: '+money(events.reduce((sum,e)=>sum+(e.reward??0),0));
 $('historyPage').textContent=historyPage+' / '+pages;$('historyPrev').disabled=historyPage===1;$('historyNext').disabled=historyPage===pages;
}
async function loadThefts(){
 if(loading)return;loading=true;loadError='';render();
 try{
  const response=await fetch(API+'/api/portal/employees/thefts',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(28000)});
  const data=await response.json();
  if(!response.ok||data.ok!==true||!['day','week','month'].every(p=>Array.isArray(data.periods?.[p]?.items)))throw Error(data.error||'Некорректный ответ сервера');
  live=data;
 }catch(error){loadError=(live?'Показаны ранее загруженные данные. ':'')+'Не удалось обновить рейтинг. Нажмите «Обновить».';console.warn('[Police] Theft leaderboard:',error.message)}
 finally{loading=false;render()}
}
$('categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){selected=Number(b.dataset.category);render();if(selected===0&&!live)void loadThefts();}});
$('department').addEventListener('change',render);
$('theftControls').addEventListener('click',e=>{const b=e.target.closest('[data-period]');if(b){period=b.dataset.period;historyPage=1;render();}});
$('historyOfficer').addEventListener('change',()=>{officer=$('historyOfficer').value;historyPage=1;renderHistory();});
$('historyPrev').addEventListener('click',()=>{historyPage--;renderHistory();});$('historyNext').addEventListener('click',()=>{historyPage++;renderHistory();});
document.addEventListener('click',event=>{const button=event.target.closest('[data-history-officer]');if(!button)return;const item=live?.periods?.[period]?.items?.[Number(button.dataset.historyOfficer)];if(item){officer=item.nickname;historyPage=1;renderHistory();$('theftHistory').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});$('historyOfficer').focus({preventScroll:true});}});
$('refreshThefts').addEventListener('click',loadThefts);render();void loadThefts();
})();

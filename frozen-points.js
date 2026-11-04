(()=>{'use strict';
const API='https://police-api-b2y4.onrender.com/api/portal/quests/frozen';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(value)||0);
const date=value=>value?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeZone:'Europe/Moscow'}).format(new Date(value)):'—';
let data={items:[],legacy:[],can_manage:false},status='frozen',action=null,busy=false,loading=false,returnFocus=null;
function notice(text,bad=false){$('frozenNotice').textContent=text;$('frozenNotice').classList.toggle('error',bad);}
async function api(path='',body){
 const token=window.PoliceSession?.get();if(!token)throw Error('Войдите в аккаунт для просмотра заморозок.');
 const r=await fetch(API+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)});
 const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(r.status===503?'Учёт заморозок пока не подключён. Обратитесь к администратору.':j.error||'Не удалось выполнить запрос.');return j;
}
function matches(row){const q=$('frozenSearch').value.trim().toLocaleLowerCase('ru'),dept=$('frozenDepartment').value;return (dept==='all'||row.department===dept)&&(!q||String(row.nickname||'').toLocaleLowerCase('ru').includes(q));}
function render(){
 const rows=data.items.filter(x=>x.status===status&&matches(x));
 $('frozenCount').textContent='Записей: '+rows.length+' · Баллов: '+money(rows.reduce((sum,x)=>sum+Number(x.amount),0));
 $('frozenList').innerHTML=rows.length?rows.map(x=>`<article class="frozen-card"><div><span class="tiny-tag">${esc(x.department)}</span><h3>${esc(x.nickname)}</h3><p>${x.status==='thawed'?'Разморожено '+esc(date(x.thawed_at))+' · '+esc(x.thawed_by):'Замороженные баллы шефа'}</p>${x.status==='thawed'?`<p>Баланс: ${money(x.balance_before)} → ${money(x.balance_after)}<br>Аккаунт: ${esc(x.target_login)}</p>`:''}</div><div class="frozen-actions"><div class="points-chip">${money(x.amount)} баллов</div>${data.can_manage&&x.status==='frozen'?`<button type="button" class="btn-primary" data-thaw="${esc(x.id)}">Разморозить</button>`:''}</div></article>`).join(''):'<p class="empty-state">Записей с такими условиями нет.</p>';
 $('legacySection').hidden=!data.can_manage;
 $('legacyList').innerHTML=data.legacy.filter(matches).map(x=>`<article class="frozen-card"><div><span class="tiny-tag">${esc(x.department)}</span><h3>${esc(x.nickname)}</h3><p class="frozen-source">${esc(x.description)}</p><p>Архивная строка №${esc(x.id)} · ${esc(x.date_text||x.event_date||'Дата не указана')}<br>До: ${esc(x.before_points??'—')} · Операция: ${esc(x.amount??'—')} · После: ${esc(x.after_points??'—')}</p>${x.needs_review?'<p>Исходная строка отмечена для сверки.</p>':''}</div><div class="frozen-actions"><button type="button" class="btn-secondary" data-import="${esc(x.id)}">Подтвердить сумму</button></div></article>`).join('')||'<p class="empty-state">Нет неучтённых архивных заморозок.</p>';
}
async function load(){
 if(loading)return;loading=true;$('reloadFrozen').disabled=true;notice('Загрузка…');
 try{data=await api();$('frozenApp').hidden=false;if(!data.can_manage&&['LSPD','SFPD','LVPD'].includes(data.department)){$('frozenDepartment').value=data.department;$('frozenDepartment').disabled=true;}render();notice('');}
 catch(e){notice(e.name==='TimeoutError'?'Сервер не ответил. Повторите загрузку.':e.message,true);}
 finally{loading=false;$('reloadFrozen').disabled=false;}
}
function open(kind,id){
 if(!data.can_manage)return;const row=kind==='import'?data.legacy.find(x=>String(x.id)===id):data.items.find(x=>x.id===id&&x.status==='frozen');if(!row)return;
 action={kind,row};returnFocus=document.activeElement;$('frozenForm').reset();$('frozenFormError').textContent='';
 $('frozenModalTitle').textContent=kind==='import'?'Подтвердить архивную заморозку':'Перенести баллы на баланс';
 $('frozenModalDescription').textContent=row.nickname+' · '+row.department+(kind==='thaw'?' · '+money(row.amount)+' баллов. Получатель должен быть действующим шефом этого департамента с тем же ником.':' · '+row.description);
 $('importAmountField').hidden=kind!=='import';$('importAmount').required=kind==='import';$('targetLoginField').hidden=kind!=='thaw';$('targetLogin').required=kind==='thaw';
 $('confirmFrozenText').textContent=kind==='import'?'Сумма сверена с архивом; баллы ещё не разморожены и не включены в действующий баланс.':'Подтверждаю перенос замороженных баллов владельцу в указанном департаменте.';
 $('submitFrozen').textContent=kind==='import'?'Подтвердить':'Разморозить';$('frozenModal').hidden=false;document.body.classList.add('modal-open');$('cancelFrozen').focus();
}
function close(){if(busy)return;$('frozenModal').hidden=true;document.body.classList.remove('modal-open');returnFocus?.focus();}
$('frozenForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!action)return;busy=true;$('submitFrozen').disabled=true;$('frozenFormError').textContent='';
 try{
  const {kind,row}=action;const result=await api(kind==='import'?'/import':'/'+encodeURIComponent(row.id)+'/thaw',kind==='import'?{history_id:String(row.id),amount:Number($('importAmount').value)}:{target_login:$('targetLogin').value.trim()});
  if(kind==='import'){data.legacy=data.legacy.filter(x=>String(x.id)!==String(row.id));data.items.unshift(result.item);}else data.items=data.items.map(x=>x.id===row.id?result.item:x);
  busy=false;close();render();notice(kind==='import'?'Архивная заморозка подтверждена.':'Баллы перенесены на баланс. Новый баланс: '+money(result.balance));
 }catch(e){$('frozenFormError').textContent=e.name==='TimeoutError'?'Время ожидания истекло. Обновите список перед повтором операции.':e.message;}
 finally{busy=false;$('submitFrozen').disabled=false;}
});
$('frozenList').addEventListener('click',e=>{const b=e.target.closest('[data-thaw]');if(b)open('thaw',b.dataset.thaw);});
$('legacyList').addEventListener('click',e=>{const b=e.target.closest('[data-import]');if(b)open('import',b.dataset.import);});
$('frozenSearch').addEventListener('input',render);$('frozenDepartment').addEventListener('change',render);
document.querySelectorAll('[data-status]').forEach(b=>b.addEventListener('click',()=>{status=b.dataset.status;document.querySelectorAll('[data-status]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});render();}));
$('reloadFrozen').onclick=load;$('cancelFrozen').onclick=close;$('frozenModal').onclick=e=>{if(e.target.id==='frozenModal')close();};
document.addEventListener('keydown',e=>{
 if($('frozenModal').hidden)return;if(e.key==='Escape'){close();return;}if(e.key!=='Tab')return;
 const nodes=[...$('frozenForm').querySelectorAll('button,input')].filter(x=>!x.disabled&&x.getClientRects().length),first=nodes[0],last=nodes.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
if(window.PoliceSession?.get())load();else{notice('Войдите в аккаунт шефа или администрации.');const link=document.createElement('a');link.href='entrance.html#login';link.className='btn-primary';link.textContent='Войти';$('frozenNotice').after(link);$('reloadFrozen').disabled=true;}
})();

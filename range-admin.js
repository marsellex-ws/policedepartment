/* Police Department: tactical range prize administration. All writes authenticated through Police API. */
(()=>{'use strict';
 const ROOT=document.getElementById('pdAdminRange');if(!ROOT)return;
 const API='https://police-api-b2y4.onrender.com';
 const FIELDS=['round_seconds','speed_multiplier','bonus_a','bonus_b','bonus_interval','max_extra_seconds'];
 const LIMITS={round_seconds:[10,120],speed_multiplier:[.5,5],bonus_a:[1,60],bonus_b:[1,60],bonus_interval:[3,40],max_extra_seconds:[0,180]};
 const TIER={easy:['Лёгкие','#52f4ad'],medium:['Средние','#67baff'],hard:['Сложные','#ff7195']};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 let busy=false,loaded=false,prizes=[],settings={};
 async function api(path,method='GET',data){
   const token=window.PoliceSession?.get?.();if(!token)throw Error('Необходимо авторизоваться');
   const headers={Authorization:'Bearer '+token,Accept:'application/json'};
   if(data!==undefined)headers['Content-Type']='application/json';
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),18000);
   try{const res=await fetch(API+path,{method,headers,signal:ctrl.signal,cache:'no-store',body:data===undefined?undefined:JSON.stringify(data)});
      const body=await res.json().catch(()=>({}));if(!res.ok||body.ok===false)throw Error(body.error||'Ошибка ('+res.status+')');return body;
   }finally{clearTimeout(timer)}
 }
 function msg(text,fail=false){const el=ROOT.querySelector('#rangeAdminStatus');el.textContent=text;el.style.color=fail?'#ffa8bd':'#71e5bc'}
 function preview(src,icon){if(src && /^https:\/\//.test(src))return `<img class="range-thumb" src="${esc(src)}" alt="Фото приза" loading="lazy">`;return `<span class="range-thumb range-emoji">${esc(icon||'🎁')}</span>`}
 function row(p){const [label,color]=TIER[p.tier]||TIER.easy;return `<form class="range-prize-card pd-admin-card" data-id="${esc(p.id)}">
  <div class="range-rowtop">${preview(p.image_url,p.icon)}<div><b>${esc(p.name)}</b><small style="color:${color}">${label}</small></div><span class="range-id">${esc(String(p.id).slice(0,8))}</span></div>
  <div class="range-form-fields">
   <label>Название<input name="name" maxlength="80" required value="${esc(p.name)}"></label>
   <label>Уровень<select name="tier"><option value="easy" ${p.tier==='easy'?'selected':''}>Лёгкий</option><option value="medium" ${p.tier==='medium'?'selected':''}>Средний</option><option value="hard" ${p.tier==='hard'?'selected':''}>Сложный</option></select></label>
   <label>HP (1–200)<input name="hp" type="number" min="1" max="200" step="1" required value="${p.hp}"></label>
   <label>Броня (0–200)<input name="armor" type="number" min="0" max="200" step="1" required value="${p.armor}"></label>
   <label>Значок<input name="icon" maxlength="20" value="${esc(p.icon||'🎁')}"></label>
   <label>Порядок<input name="sort_order" type="number" min="0" max="99999" required value="${p.sort_order}"></label>
   <label class="range-file-label">Картинка (PNG/JPG до 300 КБ)<input name="file" type="file" accept="image/png,image/jpeg"></label>
   <label class="range-check"><input name="is_enabled" type="checkbox" ${p.is_enabled?'checked':''}>Приз активен</label>
  </div>
  <div class="range-rowactions"><button class="pd-admin-btn pd-admin-primary" type="submit">Сохранить</button><button class="pd-admin-btn pd-admin-danger" type="button" data-delete="${esc(p.id)}">Удалить</button></div>
 </form>`}
 function formData(form){
   return {name:form.elements.name.value.trim(),tier:form.elements.tier.value,hp:Number(form.elements.hp.value),armor:Number(form.elements.armor.value),icon:form.elements.icon.value.trim()||'🎁',sort_order:Number(form.elements.sort_order.value),is_enabled:form.elements.is_enabled.checked};
 }
 async function uploadFile(file){
   if(!file)return '';
   if(!['image/png','image/jpeg'].includes(file.type)||file.size<1||file.size>300*1024)throw Error('Изображение должно быть PNG/JPG размером до 300 КБ');
   const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('Не удалось прочитать изображение'));reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(file)});
   const r=await api('/api/portal/admin/range/upload','POST',{mime:file.type,base64});return r.image_url;
 }
 function settingsForm(){
  const labels={round_seconds:'Длительность раунда (сек)',speed_multiplier:'Скорость целей (множитель)',bonus_a:'Первый бонус времени (+сек)',bonus_b:'Второй бонус времени (+сек)',bonus_interval:'Появление временной цели (сек)',max_extra_seconds:'Максимум добавленных секунд'};
  return `<form id="rangeSettingsForm" class="pd-admin-card range-settings"><div class="pd-admin-card-head"><h3>Управление тиром</h3></div><div class="range-settings-grid">${FIELDS.map(f=>`<label>${labels[f]}<input name="${f}" required type="number" step="${f==='speed_multiplier'?'0.1':'1'}" min="${LIMITS[f][0]}" max="${LIMITS[f][1]}" value="${esc(settings[f])}"></label>`).join('')}</div><p class="pd-hint">Бонусные цели движутся по арене. При попадании дают +5 или +10 секунд (или выбранные тобой значения). Лимит предотвращает бесконечный раунд.</p><button class="pd-admin-btn pd-admin-primary" type="submit">Сохранить настройки</button></form>`
 }
 function render(){
  ROOT.innerHTML=`<div class="range-admin-head"><div><h3>Тактический тир — редактор призов</h3><p>HP и броня до 200. Изображения сохраняются в Supabase Storage / ws-avatars / range-prizes.</p></div><button id="rangeAdminRefresh" class="pd-admin-btn">Обновить</button></div>
  <div id="rangeAdminStatus" role="status" aria-live="polite"></div>
  ${settingsForm()}
  <form id="rangeNewPrize" class="pd-admin-card range-add"><h3>Добавить новый приз</h3><div class="range-form-fields">
   <label>Название<input name="name" maxlength="80" required placeholder="Приз"></label>
   <label>Категория<select name="tier"><option value="easy">Лёгкий</option><option value="medium">Средний</option><option value="hard">Сложный</option></select></label>
   <label>HP<input name="hp" type="number" min="1" max="200" value="1" required></label>
   <label>Броня<input name="armor" type="number" min="0" max="200" value="0" required></label>
   <label>Значок<input name="icon" maxlength="20" value="🎁"></label>
   <label>Порядок<input name="sort_order" type="number" min="0" max="99999" value="100" required></label>
   <label class="range-file-label">Картинка PNG / JPG<input name="file" type="file" accept="image/png,image/jpeg"></label>
   <label class="range-check"><input type="checkbox" name="is_enabled" checked>Активен</label>
  </div><button class="pd-admin-btn pd-admin-primary" type="submit">Добавить приз</button></form>
  <h3 class="range-list-header">Каталог призов <span>${prizes.length}</span></h3>
  <div class="range-prize-grid" id="rangePrizeGrid">${prizes.map(row).join('')}</div>`;
  ROOT.querySelector('#rangeSettingsForm').addEventListener('submit',saveSettings);
  ROOT.querySelector('#rangeNewPrize').addEventListener('submit',createPrize);
  ROOT.querySelector('#rangePrizeGrid').addEventListener('submit',savePrize);
  ROOT.querySelector('#rangePrizeGrid').addEventListener('click',deletePrize);
  ROOT.querySelector('#rangeAdminRefresh').addEventListener('click',()=>load(true));
 }
 async function load(force=false){if(busy||loaded&&!force)return;busy=true;try{
   const r=await api('/api/portal/admin/range');prizes=r.prizes||[];settings=r.settings||{round_seconds:30,speed_multiplier:2.1,bonus_a:5,bonus_b:10,bonus_interval:8,max_extra_seconds:45};render();loaded=true;msg('Настройки и призы загружены');
  }catch(err){if(!loaded){ROOT.innerHTML='<div class="pd-admin-card"><div id="rangeAdminStatus"></div><button class="pd-admin-btn" id="rangeAdminRetry">Повторить</button></div>';ROOT.querySelector('#rangeAdminRetry').onclick=()=>load(true)}msg(err.message,true)}finally{busy=false}}
 async function saveSettings(e){e.preventDefault();const btn=e.target.querySelector('[type="submit"]');if(btn.disabled)return;btn.disabled=true;try{const data=Object.fromEntries(FIELDS.map(f=>[f,Number(e.target.elements[f].value)]));await api('/api/portal/admin/range/settings','PUT',data);settings=data;msg('Настройки тира сохранены')}catch(err){msg(err.message,true)}finally{btn.disabled=false}}
 async function createPrize(e){e.preventDefault();const form=e.target,btn=form.querySelector('[type="submit"]');if(btn.disabled)return;btn.disabled=true;try{const data=formData(form);data.image_url=await uploadFile(form.elements.file.files[0]);await api('/api/portal/admin/range/prizes','POST',data);msg('Новый приз добавлен');busy=false;await load(true)}catch(err){msg(err.message,true)}finally{btn.disabled=false}}
 async function savePrize(e){e.preventDefault();const form=e.target,btn=form.querySelector('[type="submit"]');if(btn.disabled)return;btn.disabled=true;try{const prize=prizes.find(x=>x.id===form.dataset.id),data=formData(form);data.image_url=form.elements.file.files.length?await uploadFile(form.elements.file.files[0]):prize?.image_url||'';await api('/api/portal/admin/range/prizes/'+encodeURIComponent(form.dataset.id),'PUT',data);msg('Приз сохранён');busy=false;await load(true)}catch(err){msg(err.message,true)}finally{btn.disabled=false}}
 async function deletePrize(e){const btn=e.target.closest('[data-delete]');if(!btn||btn.disabled)return;const p=prizes.find(x=>x.id===btn.dataset.delete);if(!p||!confirm('Удалить приз «'+p.name+'»?'))return;btn.disabled=true;try{await api('/api/portal/admin/range/prizes/'+encodeURIComponent(p.id),'DELETE');msg('Приз удалён');busy=false;await load(true)}catch(err){msg(err.message,true)}finally{btn.disabled=false}}
 window.PoliceRangeAdmin={init:()=>load()};
})();

/* Police Department role management. All permissions are enforced by Police API. */
(()=>{'use strict';
 const API='https://police-api-b2y4.onrender.com', $=id=>document.getElementById(id), esc=x=>PoliceRoleUI.escape(x);
 let actor=null, selected=null, records=[], busy=false;
 const box=$('pdAdminRoles');if(!box)return;
 function notify(text,bad=false){const el=$('pdRolesStatus');el.textContent=text||'';el.classList.toggle('error',!!bad);}
 async function request(path, method='GET',body){const token=PoliceSession.get();if(!token)throw new Error('Необходимо войти в аккаунт');const headers={Authorization:'Bearer '+token,Accept:'application/json'};if(body!==undefined)headers['Content-Type']='application/json';const r=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw Object.assign(new Error(d.error||`Ошибка ${r.status}`),{status:r.status});return d;}
 function allowedRoles(){if(actor?.role==='developer')return ['developer','admin','minister','leader','senior'];if(actor?.role==='admin')return ['minister','leader','senior'];if(actor?.role==='minister')return ['leader','senior'];return [];}
 function label(role){return {developer:'Разработчик',admin:'Администратор',minister:'Министр',leader:'Лидер',senior:'Старший состав'}[role]||'Пользователь';}
 function row(p){const m=PoliceRoleUI.meta(p);return `<button class="pd-role-result" data-role-user="${esc(p.id)}" type="button"><img class="pd-role-person-img" alt="" src="${esc(p.avatar_url||'png_police_site/profile.png')}"><span><strong>${esc(p.nickname||p.login)}</strong><small>@${esc(p.login)} · ${esc(m.title)}</small><img src="${esc(m.src)}" alt="Плашка роли"></span></button>`;}
 function list(){const host=$('pdRolesResults');host.innerHTML=records.length?records.map(row).join(''):'<div class="pd-roles-empty">Совпадений не найдено</div>';host.querySelectorAll('img.pd-role-person-img').forEach(i=>i.onerror=()=>{i.onerror=null;i.src='png_police_site/profile.png';});host.querySelectorAll('button[data-role-user]').forEach(b=>b.onclick=()=>pick(b.dataset.roleUser));}
 function canRevoke(){return selected?.role && selected.login.toLowerCase()!==actor.login.toLowerCase() && (actor.role==='developer'||(actor.role==='admin'&&['minister','leader','senior'].includes(selected.role))||(actor.role==='minister'&&['leader','senior'].includes(selected.role)));}
 function preview(){const role=$('pdAssignRole').value,dep=$('pdAssignDept').value, m=PoliceRoleUI.meta({role,role_department:dep});$('pdRolePreviewName').textContent=role==='leader'?`Лидер ${dep}`:label(role);$('pdRolePreviewImage').src=m.src;$('pdAssignDept').disabled=['developer','admin','minister'].includes(role);
  const usable=!!selected&&selected.login.toLowerCase()!==actor?.login?.toLowerCase()&&(actor?.role==='developer'||!selected.role);
  $('pdRoleApply').disabled=!usable||busy;
  $('pdRoleRevoke').disabled=!canRevoke()||busy;
 }
 function pick(id){selected=records.find(p=>p.id===id)||null;if(!selected)return;const m=PoliceRoleUI.meta(selected),box=$('pdRolesSelected');box.hidden=false;$('pdRolesEmptyHint').hidden=true;
 $('pdRoleSelectAvatar').src=selected.avatar_url||'png_police_site/profile.png';$('pdRoleSelectAvatar').onerror=()=>{$('pdRoleSelectAvatar').onerror=null;$('pdRoleSelectAvatar').src='png_police_site/profile.png';};
 $('pdRoleSelectNick').textContent=selected.nickname||selected.login;$('pdRoleSelectLogin').textContent='Логин: '+selected.login;$('pdRoleSelectText').textContent='Текущая роль: '+m.title;
 $('pdRoleCurrentImage').src=m.src;preview();notify('');}
 function config(){const roles=allowedRoles();const select=$('pdAssignRole');select.replaceChildren(...roles.map(role=>{const o=document.createElement('option');o.value=role;o.textContent=label(role);return o;}));$('pdAssignDept').value='LSPD';selected=null;records=[];$('pdRolesResults').innerHTML='';$('pdRolesSelected').hidden=true;preview();}
 async function search(){if(busy)return;const q=$('pdRoleSearch').value.trim().toLowerCase();if(!/^[a-z0-9_.-]{2,32}$/.test(q)){notify('Введи минимум два символа логина.',true);return;}
  busy=true;$('pdRolesFind').disabled=true;notify('Ищем пользователя…');try{const r=await request('/api/roles/users?search='+encodeURIComponent(q));records=r.items||[];selected=null;$('pdRolesSelected').hidden=true;$('pdRolesEmptyHint').hidden=false;list();notify(records.length?`Найдено: ${records.length}`:'Никого не нашли');}catch(e){notify(e.message,true);}finally{busy=false;$('pdRolesFind').disabled=false;preview();}
 }
 async function apply(){if(busy||!selected)return;const role=$('pdAssignRole').value,dep=['developer','admin','minister'].includes(role)?'ALL':$('pdAssignDept').value;
 if(selected.login.toLowerCase()===actor?.login?.toLowerCase())return notify('Свою роль менять нельзя',true);
 if(selected.role&&!confirm(`Изменить роль ${selected.nickname||selected.login} на «${role==='leader'?`Лидер ${dep}`:label(role)}»?`))return;
 busy=true;preview();notify('Сохраняем роль…');try{await request('/api/roles/assign','POST',{target_id:selected.id,role,department:dep});await searchAgain();notify('Роль назначена');}catch(e){notify(e.message,true);}finally{busy=false;preview();}}
 async function revoke(){if(busy||!canRevoke())return;if(!confirm(`Снять роль с ${selected.nickname||selected.login}?`))return;busy=true;preview();notify('Снимаем роль…');try{await request('/api/roles/revoke','POST',{target_id:selected.id});await searchAgain();notify('Роль снята');}catch(e){notify(e.message,true);}finally{busy=false;preview();}}
 async function searchAgain(){const q=$('pdRoleSearch').value.trim().toLowerCase();const r=await request('/api/roles/users?search='+encodeURIComponent(q));records=r.items||[];list();const same=records.find(p=>p.login?.toLowerCase()===selected?.login?.toLowerCase());if(same)pick(same.id);else{$('pdRolesSelected').hidden=true;selected=null;}}
 async function init(){notify('');const token=PoliceSession.get();if(!token){notify('Войди в аккаунт, чтобы управлять ролями.',true);return;}
  try{const me=await request('/api/auth/me');actor=me.user;if(!['developer','admin','minister'].includes(actor?.role))throw new Error('Нет доступа к выдаче ролей');config();}
  catch(e){notify(e.message,true);}
 }
 $('pdRolesFind').onclick=search;$('pdRoleSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};
 $('pdAssignRole').onchange=preview;$('pdAssignDept').onchange=preview;$('pdRoleApply').onclick=apply;$('pdRoleRevoke').onclick=revoke;
 window.PoliceRoleManager=Object.freeze({init});
})();

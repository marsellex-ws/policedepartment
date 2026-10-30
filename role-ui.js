/* Shared role identity UI for Police Department. Reads only the public auth/me endpoint. */
(()=>{'use strict';
 const API='https://police-api-b2y4.onrender.com';
 const IMG='png_police_site/profile.png';
 const CONFIG={developer:['Разработчик','developer.png','#68b9ff'],admin:['Администратор','administrator.png','#ff788c'],minister:['Министр','minister.png','#f9c66b'],leader_lspd:['Лидер LSPD','leader_lspd.png','#70b7ff'],leader_sfpd:['Лидер SFPD','leader_sfpd.png','#67e6c9'],leader_lvpd:['Лидер LVPD','leader_lvpd.png','#cd99ff'],senior:['Старший состав','senior_staff.png','#f4b968'],user:['Пользователь','user.png','#adbed4']};
 function type(user){if(!user)return 'user';const role=user.role||'user',dep=String(user.role_department||user.department||'').toUpperCase();if(role==='leader')return 'leader_'+(dep==='SFPD'?'sfpd':dep==='LVPD'?'lvpd':'lspd');return CONFIG[role]?role:'user';}
 function meta(user){const [title,file,color]=CONFIG[type(user)];return {title,src:'role_badges/'+file,color};}
 const style=document.createElement('style');style.textContent=`
 /* Transparent, compact profile: only avatar, white nickname and PNG role. */
 .pd-role-shell{position:relative;min-width:0;max-width:100%;z-index:2}
 .pd-role-identity,
 .pd-profile.pd-role-identity{
   display:flex!important;align-items:center;gap:11px;min-width:0;
   max-width:100%;min-height:0!important;margin:0!important;padding:0!important;
   background:transparent!important;border:0!important;border-radius:0!important;
   box-shadow:none!important;backdrop-filter:none!important;color:#fff!important;
 }
 .pd-role-trigger,
 .pd-profile.pd-role-identity .pd-profile-toggle{
   display:inline-flex!important;align-items:center;justify-content:flex-start;gap:11px;
   min-width:0;max-width:100%;padding:3px 0!important;margin:0!important;
   background:transparent!important;border:0!important;border-radius:0!important;
   box-shadow:none!important;color:#fff!important;cursor:pointer;text-align:left;
 }
 .pd-role-trigger:focus-visible,.pd-profile-toggle:focus-visible{
   outline:2px solid #70c1ff;outline-offset:5px;border-radius:5px;
 }
 .pd-role-avatar,
 .pd-role-trigger>.pd-role-avatar,
 .pd-profile.pd-role-identity>img{
   width:46px!important;height:46px!important;flex:0 0 46px!important;
   object-fit:cover;border-radius:50%;border:1px solid #70a7d9;
   box-shadow:0 0 10px #458ed331;
 }
 .pd-profile.pd-role-identity>img{cursor:pointer}
 .pd-profile.pd-role-identity.hidden{display:none!important}
 .pd-role-text,.pd-profile.pd-role-identity .pd-profile-copy{
   display:flex!important;flex-direction:column;align-items:flex-start;justify-content:center;
   gap:4px;min-width:0;max-width:100%;
 }
 .pd-role-nick,.pd-profile.pd-role-identity .pd-profile-copy strong{
   display:block;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
   font:900 14px/1.18 Inter,'Segoe UI',Arial,sans-serif!important;
   letter-spacing:0;color:#fff!important;
 }
 .pd-role-label,.pd-role-caret,
 .pd-profile.pd-role-identity .pd-profile-copy small,
 .pd-profile.pd-role-identity #pdRole {display:none!important}
 .pd-role-image,.pd-profile.pd-role-identity .pd-role-image{
   display:block;width:auto;height:23px;max-width:165px;object-fit:contain;
   object-position:left center;margin:0;filter:drop-shadow(0 0 4px #0007);
 }
 .pd-role-menu,.pd-profile-menu{z-index:150!important}
 .pd-role-menu[hidden]{display:none!important}
 .pd-role-menu{
   position:absolute;right:0;top:calc(100% + 12px);min-width:170px;
   border:1px solid #446d91;border-radius:11px;background:#0a2137;
   padding:7px;display:grid;gap:3px;box-shadow:0 14px 34px #000c;
 }
 .pd-role-menu a,.pd-role-menu button{
   display:block;width:100%;padding:10px 12px;text-align:left;text-decoration:none;
   color:#d8efff;background:transparent;border:0;border-radius:7px;
   cursor:pointer;font:750 12px Inter,'Segoe UI',sans-serif;
 }
 .pd-role-menu a:hover,.pd-role-menu button:hover{background:#1a4264}
 .pd-role-login{
   display:inline-flex;padding:10px 15px;border:1px solid #4582b2;border-radius:11px;
   background:#10345b;color:#e7f7ff;font:800 12px Inter,'Segoe UI',sans-serif;text-decoration:none;
 }
 header .pd-header-user-slot{margin-left:auto;display:flex;justify-content:flex-end;align-items:center;min-width:0}
 header .pd-header-user-slot .pd-role-shell{max-width:100%}
 header .headright{margin-left:auto;display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0}
 header .headright:has(.pd-header-user-slot){min-width:0}
 header .nav #topAccount{display:none!important}
 /* The unified profile takes the place of the older registry auth controls. */
 header .headright:has([data-police-user-slot])>#username,
 header .headright:has([data-police-user-slot])>#loginBtn,
 header .headright:has([data-police-user-slot])>#registerBtn,
 header .headright:has([data-police-user-slot])>#manageBtn,
 header .headright:has([data-police-user-slot])>#logoutBtn{display:none!important}
 @media(max-width:800px){
   .pd-role-identity,.pd-profile.pd-role-identity{gap:7px}
   .pd-role-trigger,.pd-profile.pd-role-identity .pd-profile-toggle{gap:7px}
   .pd-role-avatar,.pd-role-trigger>.pd-role-avatar,.pd-profile.pd-role-identity>img{
     width:36px!important;height:36px!important;flex-basis:36px!important;
   }
   .pd-role-nick,.pd-profile.pd-role-identity .pd-profile-copy strong{font-size:12px!important;max-width:128px}
   .pd-role-image,.pd-profile.pd-role-identity .pd-role-image{height:19px;max-width:125px}
 }
 @media(max-width:490px){
   .pd-role-avatar,.pd-role-trigger>.pd-role-avatar,.pd-profile.pd-role-identity>img{
     width:30px!important;height:30px!important;flex-basis:30px!important;
   }
   .pd-role-nick,.pd-profile.pd-role-identity .pd-profile-copy strong{font-size:10px!important;max-width:84px}
   .pd-role-image,.pd-profile.pd-role-identity .pd-role-image{height:16px;max-width:88px}
 }
 `;document.head.appendChild(style);
 function brokenAvatar(e){e.currentTarget.onerror=null;e.currentTarget.src=IMG}
 function decorateExisting(user){
   const root=document.getElementById('pdProfile');if(!root||!user)return;
   const m=meta(user);root.classList.add('pd-role-identity');
   const btn=document.getElementById('pdProfileToggle');
   const nick=document.getElementById('pdNick'),role=document.getElementById('pdRole');
   if(!btn||!nick||!role)return;
   let copy=btn.querySelector('.pd-profile-copy');
   if(!copy){copy=document.createElement('span');copy.className='pd-profile-copy';copy.append(nick,role);btn.prepend(copy);}
   // Keep the hidden text node for existing permission checks; show just the badge.
   role.textContent=m.title;
   const legacyCaret=Array.from(btn.children).find(x=>x.tagName==='SPAN'&&x!==copy);
   if(legacyCaret)legacyCaret.remove();
   let badge=document.getElementById('pdRoleBadge');
   if(!badge){badge=document.createElement('img');badge.id='pdRoleBadge';badge.className='pd-role-image';badge.alt='Плашка роли';copy.append(badge);}
   badge.src=m.src;
   const avatar=document.getElementById('pdAvatar');
   if(avatar){
     avatar.onclick=()=>btn.click();
     avatar.tabIndex=0;avatar.setAttribute('role','button');
     avatar.setAttribute('aria-label','Открыть меню профиля');
     avatar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();btn.click();}};
   }
 }
 function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function buildSlot(node,user){
   if(!node)return;
   node.replaceChildren();
   if(!user){
     const link=document.createElement('a');link.className='pd-role-login';
     link.href='entrance.html#login';link.textContent='Войти';node.append(link);return;
   }
   const m=meta(user),shell=document.createElement('div');shell.className='pd-role-shell';
   const canAdmin=['developer','admin','minister'].includes(user.role);
   const adminHref=user.role==='minister'?'admin.html#roles':'admin.html';
   shell.innerHTML=`<div class="pd-role-identity"><button type="button" class="pd-role-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Открыть меню профиля"><img class="pd-role-avatar" alt="Аватар" src="${escape(user.avatar_url||IMG)}"><span class="pd-role-text"><strong class="pd-role-nick">${escape(user.nickname||user.login)}</strong><img class="pd-role-image" alt="${escape(m.title)}" src="${escape(m.src)}"></span></button></div><div class="pd-role-menu" hidden>${canAdmin?`<a href="${adminHref}">⚙ Админка</a>`:''}<button type="button" data-logout>Выйти</button></div>`;
   shell.querySelector('.pd-role-avatar').onerror=brokenAvatar;
   const trigger=shell.querySelector('.pd-role-trigger'),menu=shell.querySelector('.pd-role-menu');
   trigger.onclick=()=>{
     document.querySelectorAll('.pd-role-menu:not([hidden])').forEach(el=>{if(el!==menu)el.hidden=true;});
     menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));
   };
   shell.querySelector('[data-logout]').onclick=async()=>{
     const token=window.PoliceSession?.get?.();
     try{if(token)await fetch(API+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}});}catch{}
     window.PoliceSession?.clear?.();location.assign('index.html');
   };
   node.append(shell);
 }
 // A single document-wide handler works for profiles on every page, including BFCache restores.
 document.addEventListener('click',e=>{
   document.querySelectorAll('.pd-role-shell').forEach(shell=>{
     if(shell.contains(e.target))return;
     const menu=shell.querySelector('.pd-role-menu'),btn=shell.querySelector('.pd-role-trigger');
     if(menu)menu.hidden=true;if(btn)btn.setAttribute('aria-expanded','false');
   });
 });
 document.addEventListener('keydown',e=>{
   if(e.key!=='Escape')return;
   document.querySelectorAll('.pd-role-menu:not([hidden])').forEach(menu=>{
     menu.hidden=true;
     menu.closest('.pd-role-shell')?.querySelector('.pd-role-trigger')?.setAttribute('aria-expanded','false');
   });
 });
 let lastToken=null;
 async function refresh(){const nodes=document.querySelectorAll('[data-police-user-slot]');if(!nodes.length)return;const token=window.PoliceSession?.get?.();lastToken=token;if(!token){nodes.forEach(x=>buildSlot(x,null));return;}
 try{const res=await fetch(API+'/api/auth/me',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store'});if(!res.ok){if(res.status===401){window.PoliceSession?.clear?.();nodes.forEach(x=>buildSlot(x,null));}return;}const data=await res.json();if(lastToken!==token)return;nodes.forEach(x=>buildSlot(x,data.user));}catch(e){console.warn('[Police] Временная ошибка профиля',e?.message||e);}
 }
 document.addEventListener('DOMContentLoaded',refresh);
 window.addEventListener('pageshow',()=>{const token=window.PoliceSession?.get?.();if(token!==lastToken)refresh()});
 window.addEventListener('storage',e=>{if(e.key==='pd_site_token'||e.key==='pd_site_token_expires_at')refresh()});
 window.PoliceRoleUI=Object.freeze({meta,decorateExisting,buildSlot,refresh,escape});
})();

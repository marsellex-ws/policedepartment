/* Shared role identity UI for Police Department. Reads only the public auth/me endpoint. */
(()=>{'use strict';
 const API='https://police-api-b2y4.onrender.com';
 const IMG='png_police_site/profile.png';
 const CONFIG={developer:['Разработчик','developer.png','#68b9ff'],admin:['Администратор','administrator.png','#ff788c'],minister:['Министр','minister.png','#f9c66b'],leader_lspd:['Лидер LSPD','leader_lspd.png','#70b7ff'],leader_sfpd:['Лидер SFPD','leader_sfpd.png','#67e6c9'],leader_lvpd:['Лидер LVPD','leader_lvpd.png','#cd99ff'],senior:['Старший состав','senior_staff.png','#f4b968'],user:['Пользователь','user.png','#adbed4']};
 function type(user){if(!user)return 'user';const role=user.role||'user',dep=String(user.role_department||user.department||'').toUpperCase();if(role==='leader')return 'leader_'+(dep==='SFPD'?'sfpd':dep==='LVPD'?'lvpd':'lspd');return CONFIG[role]?role:'user';}
 function meta(user){const [title,file,color]=CONFIG[type(user)];return {title,src:'role_badges/'+file,color};}
 const style=document.createElement('style');style.textContent=`
 .pd-role-identity{display:flex;align-items:center;gap:11px;min-width:0;padding:8px 11px;border:1px solid #50789f;border-radius:15px;background:linear-gradient(115deg,#0a2139e8,#08182be8);box-shadow:0 8px 24px #0005,inset 0 1px #aed6ff16;color:#ebf7ff;max-width:min(410px,100%)}
 .pd-role-identity>.pd-role-avatar{width:48px;height:48px;flex:0 0 48px;object-fit:cover;border-radius:50%;border:1px solid #77c1ff;box-shadow:0 0 0 3px #3174b125}
 .pd-role-identity .pd-role-text{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
 .pd-role-identity .pd-role-nick{font:900 14px/1.2 Inter,'Segoe UI',sans-serif;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .pd-role-identity .pd-role-label{font:750 11px/1.1 Inter,'Segoe UI',sans-serif;color:var(--pd-role-color,#a5c8e7)}
 .pd-role-identity .pd-role-image{height:23px;width:auto;max-width:160px;object-fit:contain;object-position:left center;display:block;margin-top:2px;filter:drop-shadow(0 0 3px #0005)}
 .pd-role-trigger{cursor:pointer;border:0;background:none;padding:0;color:inherit;display:flex;align-items:center;gap:8px;min-width:0;text-align:left}
 .pd-role-caret{color:#8dc8f4;font-size:17px;align-self:center}
 .pd-role-shell{position:relative;min-width:0}
 .pd-role-menu{position:absolute;right:0;top:calc(100% + 7px);z-index:150;min-width:188px;padding:7px;border:1px solid #446d91;border-radius:11px;background:#0a2137;box-shadow:0 14px 34px #000c;display:grid;gap:3px}
 .pd-role-menu a,.pd-role-menu button{padding:10px 12px;border:0;border-radius:7px;background:transparent;color:#d8efff;cursor:pointer;text-align:left;text-decoration:none;font:750 12px Inter,'Segoe UI',sans-serif}
 .pd-role-menu a:hover,.pd-role-menu button:hover{background:#1a4264}
 .pd-role-login{display:inline-flex;padding:10px 15px;border:1px solid #4582b2;border-radius:11px;background:#10345b;color:#e7f7ff;font:800 12px Inter,'Segoe UI',sans-serif;text-decoration:none}
 header .pd-header-user-slot{margin-left:auto;display:flex;justify-content:flex-end;align-items:center;min-width:0}
 header .pd-header-user-slot .pd-role-shell{max-width:100%}
 header .pd-header-user-slot .pd-role-identity{min-height:61px}
 header .headright{margin-left:auto;display:flex;align-items:center;justify-content:flex-end;gap:10px}
 header .headright:has(.pd-header-user-slot){min-width:0}
 header .nav #topAccount{display:none!important}
 .pd-profile.pd-role-identity{min-height:70px;padding:7px 10px;gap:10px;margin-left:auto}
 .pd-profile.pd-role-identity>img{width:47px;height:47px;flex:0 0 47px;border-radius:50%}
 .pd-profile.pd-role-identity .pd-profile-toggle{align-items:center;gap:9px;min-width:0}
 .pd-profile.pd-role-identity .pd-profile-copy{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0}
 .pd-profile.pd-role-identity .pd-profile-copy strong{font-size:14px;font-weight:900;max-width:165px}
 .pd-profile.pd-role-identity .pd-profile-copy small{font-size:11px;font-weight:800;color:var(--pd-role-color,#95c6ed)}
 .pd-profile.pd-role-identity .pd-role-image{height:24px;max-width:165px}
 @media(max-width:800px){.pd-role-identity{padding:6px 8px;gap:6px}.pd-role-identity>.pd-role-avatar,.pd-profile.pd-role-identity>img{width:35px;height:35px;flex-basis:35px}.pd-role-identity .pd-role-nick,.pd-profile.pd-role-identity .pd-profile-copy strong{font-size:11px;max-width:115px}.pd-role-identity .pd-role-label{font-size:10px}.pd-role-identity .pd-role-image,.pd-profile.pd-role-identity .pd-role-image{height:18px;max-width:105px}}
 @media(max-width:490px){header .pd-header-user-slot .pd-role-identity{min-height:52px}.pd-role-identity .pd-role-nick,.pd-profile.pd-role-identity .pd-profile-copy strong{max-width:91px;font-size:10px}.pd-role-identity>.pd-role-avatar,.pd-profile.pd-role-identity>img{width:30px;height:30px;flex-basis:30px}}
 `;document.head.appendChild(style);
 function brokenAvatar(e){e.currentTarget.onerror=null;e.currentTarget.src=IMG}
 function decorateExisting(user){const root=document.getElementById('pdProfile');if(!root||!user)return;const m=meta(user);root.classList.add('pd-role-identity');root.style.setProperty('--pd-role-color',m.color);const btn=document.getElementById('pdProfileToggle');const nick=document.getElementById('pdNick'),role=document.getElementById('pdRole');if(!btn||!nick||!role)return;
   let copy=btn.querySelector('.pd-profile-copy');if(!copy){copy=document.createElement('span');copy.className='pd-profile-copy';copy.append(nick,role);btn.prepend(copy);}
   role.textContent=m.title;let badge=document.getElementById('pdRoleBadge');if(!badge){badge=document.createElement('img');badge.id='pdRoleBadge';badge.className='pd-role-image';badge.alt='Плашка роли';copy.append(badge);} badge.src=m.src;
 }
 function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function buildSlot(node,user){if(!node)return;node.replaceChildren();if(!user){const link=document.createElement('a');link.className='pd-role-login';link.href='entrance.html#login';link.textContent='Войти';node.append(link);return;}
 const m=meta(user),shell=document.createElement('div');shell.className='pd-role-shell';shell.style.setProperty('--pd-role-color',m.color);
 shell.innerHTML=`<div class="pd-role-identity"><img class="pd-role-avatar" alt="Аватар" src="${escape(user.avatar_url||IMG)}"><button type="button" class="pd-role-trigger" aria-expanded="false"><span class="pd-role-text"><strong class="pd-role-nick">${escape(user.nickname||user.login)}</strong><span class="pd-role-label">${escape(m.title)}</span><img class="pd-role-image" alt="Плашка роли" src="${escape(m.src)}"></span><span class="pd-role-caret">⌄</span></button></div><div class="pd-role-menu" hidden><a href="entrance.html">Личный кабинет</a>${['developer','admin','minister'].includes(user.role)?'<a href="admin.html#roles">⚙ Выдача ролей</a>':''}${['developer','admin'].includes(user.role)?'<a href="admin.html">Админ-панель</a>':''}<button type="button" data-logout>Выйти</button></div>`;
 shell.querySelector('.pd-role-avatar').onerror=brokenAvatar;
 const trigger=shell.querySelector('.pd-role-trigger'),menu=shell.querySelector('.pd-role-menu');trigger.onclick=()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));};
 shell.querySelector('[data-logout]').onclick=async()=>{const token=window.PoliceSession?.get?.();try{if(token)await fetch(API+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}});}catch{}window.PoliceSession?.clear?.();location.assign('index.html');};
 document.addEventListener('click',e=>{if(!shell.contains(e.target)){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}},{signal:navController.signal});node.append(shell);
 }
 const navController=new AbortController();let lastToken=null;
 async function refresh(){const nodes=document.querySelectorAll('[data-police-user-slot]');if(!nodes.length)return;const token=window.PoliceSession?.get?.();lastToken=token;if(!token){nodes.forEach(x=>buildSlot(x,null));return;}
 try{const res=await fetch(API+'/api/auth/me',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store'});if(!res.ok){if(res.status===401){window.PoliceSession?.clear?.();nodes.forEach(x=>buildSlot(x,null));}return;}const data=await res.json();if(lastToken!==token)return;nodes.forEach(x=>buildSlot(x,data.user));}catch(e){console.warn('[Police] Временная ошибка профиля',e?.message||e);}
 }
 document.addEventListener('DOMContentLoaded',refresh);
 window.addEventListener('pageshow',()=>{const token=window.PoliceSession?.get?.();if(token!==lastToken)refresh()});
 window.addEventListener('storage',e=>{if(e.key==='pd_site_token'||e.key==='pd_site_token_expires_at')refresh()});
 window.PoliceRoleUI=Object.freeze({meta,decorateExisting,buildSlot,refresh,escape});
})();

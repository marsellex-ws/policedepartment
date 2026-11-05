/* Additional leadership-avatar source. Imported images remain drafts until the card is saved. */
(()=>{'use strict';
 if(window.PoliceForumAvatar)return;
 const style=document.createElement('style');style.textContent='.pd-forum-avatar-tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;grid-column:1/-1}.pd-forum-avatar-tools .pd-hint{font-size:11px;color:#a7c4dc}.pd-forum-avatar-tools button{margin:0}';document.head.appendChild(style);
 function attach({form,avatar,preview,picker,request,setImage,onSuccess,onError}){
  const forum=form.elements.namedItem('forum_url');if(!forum||form.querySelector('[data-forum-avatar]'))return;
  const tools=document.createElement('div');tools.className='pd-forum-avatar-tools';
  const button=document.createElement('button');button.type='button';button.className='pd-admin-btn';button.dataset.forumAvatar='';button.textContent='Получить аватар';
  const status=document.createElement('span');status.className='pd-hint';status.setAttribute('role','status');status.setAttribute('aria-live','polite');tools.append(button,status);forum.after(tools);
  const submit=form.querySelector('button[type="submit"]');let busy=false;
  const update=()=>{button.disabled=busy||picker.disabled||!forum.value.trim()};
  const observer=new MutationObserver(update);observer.observe(picker,{attributes:true,attributeFilter:['disabled']});forum.addEventListener('input',update);update();
  button.onclick=async()=>{
   if(busy||picker.disabled)return;
   const url=forum.value.trim();let parsed;
   try{parsed=new URL(url);if(parsed.origin!=='https://forum.gta-samp.ru'||parsed.username||parsed.password)throw Error();}catch{onError('Укажите ссылку на профиль forum.gta-samp.ru');return;}
   busy=true;form.dataset.avatarBusy='1';const previous={submit:submit?.disabled,picker:picker.disabled,forum:forum.readOnly,avatar:avatar.readOnly};
   picker.disabled=true;forum.readOnly=true;avatar.readOnly=true;if(submit)submit.disabled=true;button.textContent='Загружаем…';status.textContent='';onError('');update();
   try{
    const result=await request('/api/portal/admin/leadership/forum-avatar','POST',{slot:form.dataset.pdSave,forum_url:url});
    if(!form.isConnected)return;
    if(!result.avatar_url||!['image/png','image/jpeg'].includes(result.mime)||!Number.isFinite(result.size)||result.size>300*1024)throw Error('Сервер вернул некорректный аватар');
    avatar.value=result.avatar_url;picker.value='';setImage(preview,result.avatar_url);avatar.dispatchEvent(new Event('input',{bubbles:true}));
    status.textContent=(result.mime==='image/png'?'PNG':'JPG')+' · '+Math.ceil(result.size/1024)+' КБ';onSuccess('Аватар с форума получен — сохраните карточку');
   }catch(error){if(form.isConnected){status.textContent='';onError(error.message||'Не удалось получить аватар');}}
   finally{
    busy=false;delete form.dataset.avatarBusy;picker.disabled=previous.picker;forum.readOnly=previous.forum;avatar.readOnly=previous.avatar;if(submit)submit.disabled=previous.submit;button.textContent='Получить аватар';update();if(!form.isConnected)observer.disconnect();
   }
  };
 }
 window.PoliceForumAvatar=Object.freeze({attach});
})();

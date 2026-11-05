/* Read-only connectivity checks. Never reads cookies, session storage or auth tokens. */
(()=>{'use strict';
const $=id=>document.getElementById(id);let lines=[];
function line(s){lines.push(s);$('report').textContent=lines.join('\n');}
async function probe(label,url,options={},expected=200){
 const started=performance.now();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store',credentials:'omit'});const text=await response.text();let data;try{data=JSON.parse(text)}catch{}
 const valid=data&&typeof data==='object'&&response.status===expected;
 line(`${valid?'OK':'ОШИБКА'} | ${label} | HTTP ${response.status} | ${Math.round(performance.now()-started)} мс | ${data?'JSON':'не JSON'}`);
 if(url.endsWith('/health')&&data)line(`  База настроена: ${data.database_configured===true?'да':'нет'}`);
 }catch(error){line(`ОШИБКА | ${label} | ${Math.round(performance.now()-started)} мс | ${error.name}: ${error.message}`)}finally{clearTimeout(timeout)}
}
$('run').onclick=async()=>{
 $('run').disabled=true;$('copy').disabled=true;lines=[];$('status').textContent='Проверяем соединение…';
 line('Police Department — диагностика v1');line('Время: '+new Date().toISOString());line('Браузер: '+navigator.userAgent);line('Страница: '+location.origin);line('Браузер считает сеть доступной: '+(navigator.onLine?'да':'нет'));
 try{
  const response=await fetch('page-ready.js?v=diagnostics-'+Date.now(),{cache:'no-store'});const s=await response.text();line('Скрипт навигации: HTTP '+response.status+' | '+(s.includes('async function warm(')?'актуальная версия':'другая версия'));
 }catch(e){line('ОШИБКА | Файлы сайта | '+e.name+': '+e.message)}
 await Promise.all([
  probe('Основной API: health','https://api.police-department.ru/health'),
  probe('Основной API: руководство','https://api.police-department.ru/api/portal/leadership'),
  probe('Основной API: шефы','https://api.police-department.ru/api/portal/chiefs'),
  probe('Основной API: экзамены','https://api.police-department.ru/api/exams'),
  probe('Дополнительный API: health','https://test-api.police-department.ru/health'),
  // Invalid diagnostic credential triggers a preflight but cannot authenticate or mutate data.
  probe('Основной API: CORS с Authorization','https://api.police-department.ru/api/auth/me',{headers:{Authorization:'Bearer diagnostic-invalid-token','Content-Type':'application/json'}},401)
 ]);
 $('status').textContent='Проверка завершена. Скопируй результат и отправь в чат.';$('run').disabled=false;$('copy').disabled=false;
};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(lines.join('\n'));$('status').textContent='Результат скопирован.'}catch{$('status').textContent='Выдели текст результата и скопируй вручную.'}};
})();

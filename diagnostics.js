/* Read-only connectivity checks. Never reads cookies, session storage or auth tokens. */
(()=>{'use strict';
const $=id=>document.getElementById(id);let lines=[];
function line(s){lines.push(s);$('report').textContent=lines.join('\n');}
async function probe(label,url,options={},expected=200){
 const started=performance.now();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),7000);
 try{const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store',credentials:'omit'});const text=await response.text();let data;try{data=JSON.parse(text)}catch{}
 const valid=data&&typeof data==='object'&&response.status===expected;
 line(`${valid?'OK':'ОШИБКА'} | ${label} | HTTP ${response.status} | ${Math.round(performance.now()-started)} мс | ${data?'JSON':'не JSON'}`);
 if(url.endsWith('/health')&&data)line(`  База настроена: ${data.database_configured===true?'да':'нет'}`);
 }catch(error){line(`ОШИБКА | ${label} | ${Math.round(performance.now()-started)} мс | ${error.name}: ${error.message}`)}finally{clearTimeout(timeout)}
}
$('run').onclick=async()=>{
 $('run').disabled=true;$('copy').disabled=true;lines=[];$('status').textContent='Проверяем соединение…';
 line('Police Department — диагностика v2');line('Время: '+new Date().toISOString());line('Браузер: '+navigator.userAgent);line('Страница: '+location.origin);line('Браузер считает сеть доступной: '+(navigator.onLine?'да':'нет'));
 try{
  const response=await fetch('page-ready.js?v=diagnostics-'+Date.now(),{cache:'no-store'});const s=await response.text();line('Скрипт навигации: HTTP '+response.status+' | '+(s.includes('async function warm(')?'актуальная версия':'другая версия'));
 }catch(e){line('ОШИБКА | Файлы сайта | '+e.name+': '+e.message)}
 const primary='https://api.police-department.ru';
 const backup='https://test-api.police-department.ru';
 const stamp='?pd_diagnostic='+Date.now();
 // Sequential probes distinguish connection congestion from individual endpoint failures.
 const checks=[
  ['Основной: health',primary+'/health',{},200],
  ['Основной: руководство',primary+'/api/portal/leadership',{},200],
  ['Основной: руководство, уникальный URL',primary+'/api/portal/leadership'+stamp,{},200],
  ['Дополнительный: руководство',backup+'/api/portal/leadership'+stamp,{},200],
  ['Основной: экзамены',primary+'/api/exams'+stamp,{},200],
  ['Дополнительный: экзамены',backup+'/api/exams'+stamp,{},200],
  ['Основной: auth БЕЗ Authorization',primary+'/api/auth/me'+stamp,{},401],
  ['Основной: auth С Authorization',primary+'/api/auth/me'+stamp,{headers:{Authorization:'Bearer diagnostic-invalid-token','Content-Type':'application/json'}},401],
  ['Дополнительный: auth С Authorization',backup+'/api/auth/me'+stamp,{headers:{Authorization:'Bearer diagnostic-invalid-token','Content-Type':'application/json'}},401]
 ];
 for(let i=0;i<checks.length;i++){
  $('status').textContent=`Проверка ${i+1} из ${checks.length}…`;
  await probe(...checks[i]);
 }
 $('status').textContent='Проверка завершена. Скопируй результат и отправь в чат.';$('run').disabled=false;$('copy').disabled=false;
};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(lines.join('\n'));$('status').textContent='Результат скопирован.'}catch{$('status').textContent='Выдели текст результата и скопируй вручную.'}};
})();

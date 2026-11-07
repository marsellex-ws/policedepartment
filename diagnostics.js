/* Read-only production diagnostics: no cookies, session storage or user tokens. */
(()=>{'use strict';
const $=id=>document.getElementById(id);let lines=[];
function line(value){lines.push(value);$('report').textContent=lines.join('\n');}
async function probe(label,url,{format='json',expected=200,timeout=15000,headers={}}={}){
 const started=performance.now(),controller=new AbortController();let responseTime=null;
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(url,{headers,signal:controller.signal,cache:'no-store',credentials:'omit'});responseTime=Math.round(performance.now()-started);
  const bytes=await response.arrayBuffer();const elapsed=Math.round(performance.now()-started);let data=null;
  if(format==='json')try{data=JSON.parse(new TextDecoder().decode(bytes))}catch{}
  const valid=response.status===expected&&bytes.byteLength>0&&(format!=='json'||data&&typeof data==='object');
  const entries=performance.getEntriesByName(response.url);const protocol=entries.at(-1)?.nextHopProtocol;
  line(`${valid?'OK':'ОШИБКА'} | ${label} | HTTP ${response.status} | заголовки ${responseTime} мс | полностью ${elapsed} мс | ${bytes.byteLength} байт${protocol?' | '+protocol:''}${format==='json'&&!data?' | не JSON':''}`);
  if(data&&url.includes('/health'))line('  База настроена: '+(data.database_configured===true?'да':'нет'));
 }catch(error){line(`ОШИБКА | ${label} | ${Math.round(performance.now()-started)} мс | ${responseTime===null?'ответ не начался':'заголовки получены за '+responseTime+' мс'} | ${error.name}: ${error.message}`)}finally{clearTimeout(timer)}
}
$('run').onclick=async()=>{
 $('run').disabled=true;$('copy').disabled=true;lines=[];
 line('Police Department — диагностика v4');line('Время: '+new Date().toISOString());line('Браузер: '+navigator.userAgent);line('Страница: '+location.origin);line('Сеть доступна: '+(navigator.onLine?'да':'нет'));line('Service Worker: '+(navigator.serviceWorker?.controller?'активен':'нет'));
 const api='https://police-api-b2y4.onrender.com',stamp='?pd_diagnostic='+Date.now();
 const checks=[
  ['GitHub Pages: HTML',new URL('index.html'+stamp,location.href).href,{format:'html'}],
  ['GitHub Pages: JavaScript',new URL('api-fetch-retry.js'+stamp,location.href).href,{format:'script'}],
  ['GitHub Pages: изображение',new URL('reestr_shapk.webp'+stamp,location.href).href,{format:'image'}],
  ['Render: первый health',api+'/health'+stamp,{timeout:35000}],
  ['Render: руководство',api+'/api/portal/leadership'+stamp,{}],
  ['Render: шефы',api+'/api/portal/chiefs'+stamp,{}],
  ['Render: экзамены',api+'/api/exams'+stamp,{}],
  ['Render: Authorization / CORS',api+'/api/auth/me'+stamp,{headers:{Authorization:'Bearer diagnostic-invalid-token','Content-Type':'application/json'},expected:401}],
  ['Render: повторный health',api+'/health'+stamp,{}]
 ];
 try{for(let i=0;i<checks.length;i++){$('status').textContent=`Проверка ${i+1} из ${checks.length}…`;await probe(...checks[i]);}}
 finally{$('run').disabled=false;$('copy').disabled=false;$('status').textContent='Проверка завершена. Скопируй результат и отправь в чат.';}
};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(lines.join('\n'));$('status').textContent='Результат скопирован.'}catch{$('status').textContent='Выдели и скопируй текст результата вручную.'}};
})();

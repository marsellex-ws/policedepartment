const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../api-fetch-retry.js'),'utf8');
const API='https://police-api-b2y4.onrender.com';
function loader(fetch){const window={fetch};vm.runInNewContext(source,{window,location:{href:API+'/'},Request,Response,Headers,URL,DOMException,AbortController,performance,console:{info(){},warn(){}},setTimeout:(fn,ms)=>setTimeout(fn,ms===8000?15:ms>=15000?75:1),clearTimeout});return window.fetch;}
test('retries transient read failures and retains authorization and query',async()=>{let calls=0;const read=loader(async(u,init)=>{if(u===API+'/health')return new Response('{"ok":true}');calls++;assert.equal(u,API+'/api/auth/me?probe=1');assert.equal(init.headers.Authorization,'Bearer example');return new Response('{}',{status:calls<3?503:200});});assert.equal((await read(API+'/api/auth/me?probe=1',{headers:{Authorization:'Bearer example'}})).status,200);assert.equal(calls,3);});
test('does not retry writes or authentication rejection',async()=>{for(const [method,status] of [['POST',503],['GET',401],['GET',403]]){let n=0;const read=loader(async()=>{n++;return new Response('{}',{status})});await read(API+'/api/auth/me',{method});assert.equal(n,1);}});
test('retries a timed out read and stops when caller aborts',async()=>{let n=0;const read=loader(async(u,{signal})=>{if(++n>1)return new Response('{}');return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));});assert.equal((await read(API+'/health')).status,200);assert.equal(n,2);const controller=new AbortController();controller.abort();await assert.rejects(read(API+'/health',{signal:controller.signal}),{name:'AbortError'});assert.equal(n,2);});
test('shares public reads with independent responses, but never caches authenticated or no-store reads',async()=>{let n=0;const read=loader(async()=>{n++;return new Response('{"ok":true}')});const url=API+'/api/portal/leadership';const [a,b]=await Promise.all([read(url),read(url)]);assert.equal(n,1);assert.deepEqual(await a.json(),await b.json());await read(url);assert.equal(n,1);await read(url,{headers:{Authorization:'Bearer example'}});await read(url,{cache:'no-store'});assert.equal(n,3);});
test('retries when the response body fails after successful headers',async()=>{let n=0;const read=loader(async()=>{n++;if(n===1)return new Response(new ReadableStream({start(c){c.error(new TypeError('connection lost'))}}));return new Response('{"ok":true}');});assert.deepEqual(await (await read(API+'/health')).json(),{ok:true});assert.equal(n,2);});
test('keeps retries on the configured Render API',async()=>{const urls=[];const read=loader(async u=>{urls.push(u);return new Response('{}',{status:urls.length===1?502:200})});await read(API+'/health');assert.deepEqual(urls,[API+'/health',API+'/health']);});

test('Request-based writes retain their untouched body and are sent once',async()=>{let n=0;const read=loader(async request=>{n++;assert.equal(request.bodyUsed,false);assert.equal(await request.text(),'{"example":1}');return new Response('{}')});const request=new Request(API+'/api/example',{method:'POST',body:'{"example":1}'});await read(request);assert.equal(n,1);});

test('parallel timed-out reads share one anonymous readiness request before retrying',async()=>{
 const counts=new Map();let health=0;
 const read=loader(async(url,{signal,headers})=>{
  if(url===API+'/health'){health++;assert.equal(headers.Authorization,undefined);return new Response('{"ok":true}');}
  const count=(counts.get(url)||0)+1;counts.set(url,count);
  if(count===1)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('timed out','AbortError'))));
  return new Response('{"ok":true,"items":[]}');
 });
 const responses=await Promise.all([read(API+'/api/portal/leadership',{cache:'no-store'}),read(API+'/api/portal/chiefs',{cache:'no-store'})]);
 assert(responses.every(r=>r.status===200));assert.equal(health,1);assert.deepEqual([...counts.values()],[2,2]);
});
test('cancelling one waiting read does not abort readiness for another reader',async()=>{
 let resolveHealth,started;const healthStarted=new Promise(r=>{started=r});const counts=new Map();
 const read=loader(async(url,{signal})=>{
  if(url===API+'/health'){started();return new Promise(resolve=>{resolveHealth=resolve});}
  const count=(counts.get(url)||0)+1;counts.set(url,count);
  if(count===1)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('timed out','AbortError'))));
  return new Response('{"ok":true}');
 });
 const controller=new AbortController();const cancelled=assert.rejects(read(API+'/api/portal/leadership',{signal:controller.signal}),{name:'AbortError'});
 const survivor=read(API+'/api/portal/chiefs',{cache:'no-store'});await healthStarted;controller.abort();resolveHealth(new Response('{"ok":true}'));
 await cancelled;assert.equal((await survivor).status,200);
});

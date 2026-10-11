import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { stub } from './load-ts.mjs';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url:'https://fixture.invalid/he/content-intake'});
globalThis.window=dom.window; globalThis.document=dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url);
const state={user:{id:'admin',role:'super_admin'},locale:'en',calls:[],dot:{state:'unconfigured'},failure:false};
const locales={};
for(const locale of ['en','he'])locales[locale]=JSON.parse(await readFile(new URL(`../../src/i18n/locales/${locale}.json`,import.meta.url),'utf8')).contentIntake;
globalThis.dotUI={state,translate:(key,values={})=>{
 const text=locales[state.locale][key];assert.equal(typeof text,'string',`missing ${key}`);
 return text.replace(/\{(\w+)\}/g,(_,name)=>values[name]);
},fetch:async(url,options={})=>{
 state.calls.push({url,options});
 if(url.startsWith('/api/content-intake/dot/approvals') && state.approvalResponse)return state.approvalResponse(url,options);
 if(url.startsWith('/api/content-intake/dot/read-grant') && state.grantResponse)return state.grantResponse(url,options);
 if(url.startsWith('/api/content-intake/dot/setup')) {
  if(url.includes('?')) return state.setupResponse ? state.setupResponse(url) : new Response(JSON.stringify({mappingVerified:true,ownerEmail:'legacy@example.invalid',ownerId:'legacy-owner',projectId:'fixture',targets:[],proposal:{expiresAt:Date.now()+3600000}}));
  return new Response(JSON.stringify({projectId:'fixture'}));
 }
 if(url.startsWith('/api/content-intake/dot')){
  if(state.failure)return new Response('{}',{status:503});
  return new Response(JSON.stringify(url.includes('?')?{state:'ready',recovery:{manifestId:'a'.repeat(64),shortId:'target1',sha256:'b'.repeat(64),status:'uncertain'}}:state.dot));
 }
 assert.ok(url.startsWith('/api/content-intake/connections'));
 return new Response(JSON.stringify({owners:[{id:'legacy-owner',name:'Legacy owner',email:'legacy@example.invalid',targets:[]},{id:'second-owner',name:'Second owner',email:'second@example.invalid',targets:[]}],connections:[{id:'connection1',name:'Existing connection',disabled:true,revoked:false}],agents:[{id:'mac1',recordId:'record1',computerName:'Fixture Mac',disabled:true,remoteControl:true,lastSeenAt:null,updatedAt:null}]}));
}};
const replacements={
 'react':pathToFileURL(require.resolve('react')).href,
 'react/jsx-runtime':pathToFileURL(require.resolve('react/jsx-runtime')).href,
 'lucide-react':pathToFileURL(require.resolve('lucide-react')).href,
 'next-intl':stub('export const useTranslations=()=>globalThis.dotUI.translate;export const useLocale=()=>globalThis.dotUI.state.locale;'),
 '@/contexts/AuthContext':stub('export const useAuth=()=>({user:globalThis.dotUI.state.user,loading:false});'),
 '@/lib/fetchWithAuth':stub('export const fetchWithAuth=(...args)=>globalThis.dotUI.fetch(...args);'),
};
async function component(name){
 const source=await readFile(new URL(`../../src/app/[locale]/content-intake/${name}.tsx`,import.meta.url),'utf8');
 let {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
 for(const [from,to]of Object.entries(replacements)){outputText=outputText.replaceAll(`'${from}'`,JSON.stringify(to)).replaceAll(`"${from}"`,JSON.stringify(to));}
 return stub(outputText);
}
replacements['./DotManifestApproval']=await component('DotManifestApproval');
replacements['./DotReadGrant']=await component('DotReadGrant');
replacements['./DotWriteGrant']=await component('DotWriteGrant');
replacements['./DotSetupReview']=await component('DotSetupReview');
replacements['./DotConnection']=await component('DotConnection');
replacements['./ComputerList']=await component('ComputerList');
const {default:Page}=await import(await component('page'));
let root;
async function render(){root=createRoot(document.getElementById('root'));await React.act(async()=>{root.render(React.createElement(Page));});}
async function cleanup(){await React.act(async()=>root.unmount());state.calls=[];state.failure=false;state.user={id:'admin',role:'super_admin'};state.locale='en';state.dot={state:'unconfigured'};state.grantResponse=null;state.approvalResponse=null;}
async function change(id,value){const element=document.getElementById(id);await React.act(async()=>{
 Object.getOwnPropertyDescriptor(element.tagName==='SELECT'?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype,'value').set.call(element,value);
 element.dispatchEvent(new window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));
});}
test('unconfigured dot and legacy disconnect controls remain visible in English and Hebrew; no install/key/schedule flow',async()=>{
 for(const locale of ['en','he']){
  state.locale=locale;await render();const text=document.body.textContent;
  assert.ok(text.includes(locales[locale].dotState_unconfigured));assert.ok(text.includes(locales[locale].legacyCaution));
  assert.ok(text.includes('Fixture Mac'));assert.ok(text.includes(locales[locale].reconnectComputer));
  assert.equal(document.querySelector('input[type=password]'),null);assert.equal(document.querySelector('a[download]'),null);
  assert.ok(!text.includes(locales[locale].downloadTitle));
  assert.ok(state.calls.every(c=>!c.options.method||c.options.method==='GET'));
  await cleanup();
 }
});
test('verified target identity is required for recovery; uncertainty and failed refresh never offer retry or retain ready status',async()=>{
 state.dot={state:'ready',health:{ownerId:'owner',ownerEmail:'fixture@example.invalid',projectId:'fixture',expiresAt:Date.now()+60000,targets:[{shortId:'target1',hotel:'Fixture hotel',expectedVersion:'c'.repeat(64),pending:true}]}};
 await render();assert.ok(document.body.textContent.includes('fixture@example.invalid'));
 const submit=document.querySelector('section[aria-labelledby="dot-title"] form button');assert.equal(submit.disabled,true);
 await change('dot-manifest','a'.repeat(64));await change('dot-hash','b'.repeat(64));assert.equal(submit.disabled,true);
 await change('dot-target','target1');assert.equal(submit.disabled,false);
 await React.act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 assert.ok(document.body.textContent.includes(locales.en.dotReceipt_uncertain));assert.ok(document.body.textContent.includes(locales.en.dotNoRetry));
 const lookup=state.calls.find(c=>c.url.startsWith('/api/content-intake/dot?'));assert.ok(lookup);assert.equal(lookup.options.method,undefined);
 state.failure=true;await React.act(async()=>document.querySelector('section[aria-labelledby="dot-title"] button').click());
 assert.ok(document.body.textContent.includes(locales.en.dotState_unavailable));assert.ok(!document.body.textContent.includes(locales.en.dotState_ready));
 assert.ok(!document.body.textContent.includes(locales.en.dotReceipt_uncertain));assert.equal(document.querySelector('section[aria-labelledby="dot-title"] form'),null);
 await cleanup();
});
test('non-admin page never mounts either management data surface',async()=>{
 state.user={id:'ordinary',role:'user'};await render();assert.ok(document.body.textContent.includes(locales.en.adminOnly));assert.equal(state.calls.length,0);await cleanup();
});

test('setup requires explicit owner, fills bound email, clears stale proposal and ignores late responses',async()=>{
 await render(); const submit=document.querySelector('#dot-setup-form button[type=submit]');assert.equal(document.getElementById('setup-owner').value,'');assert.equal(submit.disabled,true);
 await change('setup-owner','legacy-owner');assert.equal(document.getElementById('setup-email').value,'legacy@example.invalid');assert.equal(document.getElementById('setup-email').readOnly,true);assert.equal(submit.disabled,false);
 const send=()=>React.act(async()=>document.getElementById('dot-setup-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 await send();assert.ok(document.body.textContent.includes(locales.en.setupVerified));assert.ok(state.calls.some(c=>c.url.includes('ownerEmail=legacy%40example.invalid')));
 await change('setup-duration','4');assert.ok(!document.body.textContent.includes(locales.en.setupVerified));
 let resolve;state.setupResponse=()=>new Promise(r=>resolve=r);await send();await change('setup-owner','');
 await React.act(async()=>resolve(new Response(JSON.stringify({mappingVerified:true,targets:[],proposal:null}))));
 assert.ok(!document.body.textContent.includes(locales.en.setupVerified));assert.equal(submit.disabled,true);
 state.setupResponse=null;await cleanup();
});

test('owner UID copies exact selected value without network calls; changing owner updates both fields and clears copy status',async()=>{
 let copied;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>{copied=value;}}}});
 for(const locale of ['he','en']){
  state.locale=locale;await render();const copy=document.getElementById('setup-copy-uid');assert.equal(copy.disabled,true);
  await change('setup-owner','legacy-owner');assert.equal(document.getElementById('setup-owner-id').value,'legacy-owner');
  const requests=state.calls.length;await React.act(async()=>copy.click());assert.equal(copied,'legacy-owner');assert.equal(state.calls.length,requests);
  assert.ok(document.body.textContent.includes(locales[locale].setupUidCopied));
  await change('setup-owner','second-owner');assert.equal(document.getElementById('setup-owner-id').value,'second-owner');assert.equal(document.getElementById('setup-email').value,'second@example.invalid');
  assert.ok(!document.body.textContent.includes(locales[locale].setupUidCopied));await React.act(async()=>copy.click());assert.equal(copied,'second-owner');
  await change('setup-owner','');assert.equal(document.getElementById('setup-owner-id').value,'');assert.equal(document.getElementById('setup-email').value,'');assert.equal(copy.disabled,true);await cleanup();
 }
});

test('clipboard denial selects the UID for manual copy; a late copy result cannot describe a newly selected owner',async()=>{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{throw Error('denied');}}}});
 await render();await change('setup-owner','legacy-owner');await React.act(async()=>document.getElementById('setup-copy-uid').click());
 const uid=document.getElementById('setup-owner-id');assert.equal(document.activeElement,uid);assert.equal(uid.selectionStart,0);assert.equal(uid.selectionEnd,uid.value.length);
 assert.ok(document.body.textContent.includes(locales.en.setupUidCopyFailed));
 let finish;globalThis.navigator.clipboard.writeText=()=>new Promise(resolve=>finish=resolve);
 await React.act(async()=>document.getElementById('setup-copy-uid').click());await change('setup-owner','second-owner');
 await React.act(async()=>finish());assert.ok(!document.body.textContent.includes(locales.en.setupUidCopied));await cleanup();
});


test('issuance keeps original safe failure and same in-memory attempt across read-only missing/active recovery',async()=>{
 const {default:Grant}=await import(replacements['./DotReadGrant']);
 for(const locale of ['he','en']){
  state.locale=locale;let submitted,lookupState='missing',copied;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>{copied=value;}}}});
  state.grantResponse=(url,options)=>{
   if(options.method==='POST'){submitted=JSON.parse(options.body);return Response.json({code:'same_origin_required',error:'SENSITIVE_BACKEND_DETAIL'},{status:403});}
   if(url.includes('?')){assert.equal(new URL(url,'https://fixture.invalid').searchParams.get('connectionId'),submitted.connectionId);return Response.json({connectionId:submitted.connectionId,state:lookupState,expiresAt:Date.now()+3600000,diagnostics:{currentConfigurationOnly:true,blockers:['server_identity_required']}});}
   return Response.json({issuanceEnabled:true});
  };
  root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(Grant,{ownerId:'owner',ownerEmail:'owner@example.invalid',projectId:'fixture'})));
  const button=key=>[...document.querySelectorAll('button')].find(b=>b.textContent===locales[locale][key]);
  await React.act(async()=>document.querySelector('input[type=checkbox]').click());await React.act(async()=>button('readGrantIssue').click());
  // WebCrypto digest completes outside React's event promise. Wait for the
  // observed response state, not for a particular event-loop timing under load.
  const deadline=performance.now()+2000;
  while(!document.body.textContent.includes(locales[locale].readGrantFailure_same_origin_required)&&performance.now()<deadline){
   await React.act(async()=>new Promise(resolve=>setTimeout(resolve,5)));
  }
  assert.ok(document.body.textContent.includes(locales[locale].readGrantFailure_same_origin_required));assert.ok(document.body.textContent.includes('403'));
  assert.ok(document.body.textContent.includes(submitted.connectionId));assert.ok(!document.body.textContent.includes('SENSITIVE_BACKEND_DETAIL'));
  assert.ok(!document.body.textContent.includes(submitted.keyHash));assert.equal(button('readGrantIssue'),undefined);assert.equal(button('readGrantCopy'),undefined);
  await React.act(async()=>button('readGrantInspect').click());await React.act(async()=>button('readGrantInspect').click());
  assert.ok(document.body.textContent.includes(locales[locale].readGrantFailure_same_origin_required));assert.ok(document.body.textContent.includes(locales[locale].readGrantFailure_server_identity_required));
  assert.equal(button('readGrantCopy'),undefined);lookupState='active';await React.act(async()=>button('readGrantInspect').click());
  await React.act(async()=>button('readGrantCopy').click());assert.match(copied,new RegExp('^tq_fc_'+submitted.connectionId+'\\.[a-f0-9]{64}$'));assert.ok(!document.body.textContent.includes(copied));
  assert.equal(state.calls.filter(c=>c.options.method==='POST').length,1);assert.equal(state.calls.filter(c=>c.options.method==='DELETE').length,0);
  await cleanup();
 }
});


test('approval UI requires explicit review, binds the server manifest and recovers uncertain writes with GET only',async()=>{
 const {default:Approval}=await import(replacements['./DotManifestApproval']);
 for(const locale of ['he','en']){
  state.locale=locale;let phase='missing',review,submitted;
  const candidate={filename:'reviewed.pdf',hotel:'fixture-hotel',shortId:'fixture',sha256:'b'.repeat(64),expectedVersion:'c'.repeat(64),
   period:{kind:'weekday',startDate:'2026-10-11',endDate:'2026-10-14'},sourceGroupId:'exact-group',sources:[{messageId:'message',fileId:'file',sha256:'b'.repeat(64)}],supersedes:[],review:{evidence:'Resolved actual PDF/source context'}};
  state.approvalResponse=(url,options)=>{
   if(options.method==='POST'){
    const body=JSON.parse(options.body);
    if(body.action==='preview'){review={connectionId:body.connectionId,manifestId:'a'.repeat(64),manifest:{...body.manifest,review:{...body.manifest.review,reviewer:'admin',reviewedAt:Date.now()}},predecessor:{sha256:'d'.repeat(64)},expiresAt:Date.now()+900000,persisted:false};return Response.json(review);}
    submitted=body;phase='approved';return Response.json({error:'PRIVATE_ERROR_DETAIL'},{status:503});
   }
   if(options.method==='DELETE'){phase='revoked';return Response.json({},{status:503});}
   return Response.json(url.includes('?')?{manifestId:review.manifestId,state:phase}:{approvalEnabled:true});
  };
  root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(Approval)));
  const button=key=>[...document.querySelectorAll('button')].find(b=>b.textContent===locales[locale][key]);
  assert.equal(button('approvalPreview').disabled,true);await change('approval-writer','f'.repeat(32));
  const input=document.getElementById('approval-file');Object.defineProperty(input,'files',{configurable:true,value:[{size:1000,text:async()=>JSON.stringify(candidate)}]});
  await React.act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));await React.act(async()=>button('approvalPreview').click());
  assert.equal(button('approvalApprove').disabled,true);assert.ok(document.body.textContent.includes('exact-group'));assert.ok(document.body.textContent.includes('d'.repeat(64)));
  await React.act(async()=>document.querySelector('input[type=checkbox]').click());await React.act(async()=>{button('approvalApprove').click();button('approvalApprove')?.click();});
  assert.deepEqual(submitted.manifest,review.manifest);assert.equal(submitted.manifestId,review.manifestId);
  assert.equal(button('approvalApprove'),undefined);assert.equal(document.getElementById('approval-writer').disabled,true);assert.ok(!document.body.textContent.includes('PRIVATE_ERROR_DETAIL'));
  phase='missing';await React.act(async()=>button('approvalInspect').click());assert.ok(document.body.textContent.includes(locales[locale].approvalState_missing));assert.equal(button('approvalApprove'),undefined);
  phase='approved';await React.act(async()=>button('approvalInspect').click());assert.ok(document.body.textContent.includes(locales[locale].approvalState_approved));
  await React.act(async()=>button('approvalRevoke').click());assert.equal(button('approvalRevoke').disabled,true);await React.act(async()=>button('approvalInspect').click());
  assert.ok(document.body.textContent.includes(locales[locale].approvalState_revoked));
  assert.equal(state.calls.filter(c=>c.options.method==='POST'&&JSON.parse(c.options.body).action==='approve').length,1);
  assert.equal(state.calls.filter(c=>c.options.method==='DELETE').length,1);await cleanup();
 }
});
test('approval UI stays hidden when creation is disabled and performs no write',async()=>{
 const {default:Approval}=await import(replacements['./DotManifestApproval']);state.approvalResponse=()=>Response.json({approvalEnabled:false});
 root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(Approval)));
 assert.equal(document.querySelector('section'),null);assert.equal(state.calls.length,1);assert.ok(!state.calls[0].options.method);await cleanup();
});

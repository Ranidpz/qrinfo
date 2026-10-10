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
 if(url.startsWith('/api/content-intake/dot/setup')) {
  if(url.includes('?')) return state.setupResponse ? state.setupResponse(url) : new Response(JSON.stringify({mappingVerified:true,ownerEmail:'legacy@example.invalid',ownerId:'legacy-owner',projectId:'fixture',targets:[],proposal:{expiresAt:Date.now()+3600000}}));
  return new Response(JSON.stringify({projectId:'fixture'}));
 }
 if(url.startsWith('/api/content-intake/dot')){
  if(state.failure)return new Response('{}',{status:503});
  return new Response(JSON.stringify(url.includes('?')?{state:'ready',recovery:{manifestId:'a'.repeat(64),shortId:'target1',sha256:'b'.repeat(64),status:'uncertain'}}:state.dot));
 }
 assert.ok(url.startsWith('/api/content-intake/connections'));
 return new Response(JSON.stringify({owners:[{id:'legacy-owner',name:'Legacy owner',email:'legacy@example.invalid',targets:[]}],connections:[{id:'connection1',name:'Existing connection',disabled:true,revoked:false}],agents:[{id:'mac1',recordId:'record1',computerName:'Fixture Mac',disabled:true,remoteControl:true,lastSeenAt:null,updatedAt:null}]}));
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
replacements['./DotSetupReview']=await component('DotSetupReview');
replacements['./DotConnection']=await component('DotConnection');
replacements['./ComputerList']=await component('ComputerList');
const {default:Page}=await import(await component('page'));
let root;
async function render(){root=createRoot(document.getElementById('root'));await React.act(async()=>{root.render(React.createElement(Page));});}
async function cleanup(){await React.act(async()=>root.unmount());state.calls=[];state.failure=false;state.user={id:'admin',role:'super_admin'};state.locale='en';state.dot={state:'unconfigured'};}
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

test('setup requires explicit owner and expected email, clears stale proposal and ignores late responses',async()=>{
 await render(); const submit=document.querySelector('#dot-setup-form button');assert.equal(document.getElementById('setup-owner').value,'');assert.equal(submit.disabled,true);
 await change('setup-owner','legacy-owner');assert.equal(submit.disabled,true);await change('setup-email','legacy@example.invalid');assert.equal(submit.disabled,false);
 const send=()=>React.act(async()=>document.getElementById('dot-setup-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 await send();assert.ok(document.body.textContent.includes(locales.en.setupVerified));assert.ok(state.calls.some(c=>c.url.includes('ownerEmail=legacy%40example.invalid')));
 await change('setup-duration','4');assert.ok(!document.body.textContent.includes(locales.en.setupVerified));
 let resolve;state.setupResponse=()=>new Promise(r=>resolve=r);await send();await change('setup-owner','');
 await React.act(async()=>resolve(new Response(JSON.stringify({mappingVerified:true,targets:[],proposal:null}))));
 assert.ok(!document.body.textContent.includes(locales.en.setupVerified));assert.equal(submit.disabled,true);
 state.setupResponse=null;await cleanup();
});

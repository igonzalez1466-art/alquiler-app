const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
let captured;
let userId;
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/listing/page.tsx'),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject={};
const req=id=>{
  if(id==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(id==='@/app/lib/prisma')return {prisma:{listing:{findMany:async query=>{captured=query;return [];}}}};
  if(id==='next-auth')return {getServerSession:async()=>userId ? {user:{id:userId}} : null};
  if(id==='@/auth.config')return {authConfig:{}};
  if(id==='next/navigation')return {redirect:url=>{throw Object.assign(new Error('redirect'),{url});}};
  if(id==='@/app/lib/listingAttributes')return {isSportCode:value=>value==='BIEGANIE',isAccessoryCode:value=>value==='TOREBKA'};
  return ()=>null;
};
vm.runInNewContext(code,{exports:exportsObject,require:req,console,Number,Set,JSON,Object,String});
async function search(params){await exportsObject.default({searchParams:Promise.resolve(params)});return JSON.parse(JSON.stringify(captured));}
(async()=>{
  let query=await search({tab:'invalid',status:'drafts',drafts:'1',userId:'victim'});
  assert.equal(query.where.available,true);assert.equal(query.where.isDraft,false);assert.equal(query.where.userId,undefined);
  await assert.rejects(()=>search({tab:'my'}),error=>error.url.includes('/login'));
  userId='owner';
  query=await search({tab:'my',status:'drafts'});assert.equal(query.where.userId,'owner');assert.equal(query.where.isDraft,true);
  query=await search({tab:'my',status:'published'});assert.equal(query.where.isDraft,false);assert.equal(query.where.available,undefined);
  query=await search({tab:'my',drafts:'1'});assert.equal(query.where.isDraft,true);
  query=await search({sort:'price_asc',min:'0',max:'45',category:'sukienki',q:' gala '});
  assert.deepEqual(query.orderBy,[{pricePerDay:'asc'},{createdAt:'desc'},{id:'desc'}]);
  assert.ok(query.where.AND.some(filter=>filter.pricePerDay?.gte===0 && filter.pricePerDay.lte===45));
  assert.ok(query.where.AND.some(filter=>filter.garmentType==='VESTIDO'));
  assert.ok(query.where.AND.some(filter=>filter.OR?.[0]?.title?.contains==='gala'));
  query=await search({sort:'price_desc'});assert.equal(query.orderBy[0].pricePerDay,'desc');
  query=await search({sort:'invalid',gender:'invalid',garmentType:'MAN',color:'invalid',min:'-2',max:'NaN',accessoryType:'TOREBKA'});
  assert.equal(query.where.AND,undefined);assert.equal(query.orderBy[0].createdAt,'desc');
  query=await search({garmentType:'ACCESORIO',accessoryType:'TOREBKA'});assert.ok(query.where.AND.some(filter=>filter.accessoryType==='TOREBKA'));
  console.log('PASS listing search: private/public scope, owner authentication, draft compatibility, category/search/price filters, enum validation and stable sorting. No network or database writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});

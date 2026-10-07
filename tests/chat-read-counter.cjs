const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const listeners=new Map(),requests=[],effects=[];let total,receiptResolve,cleanupBell;
const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)},dispatchEvent:event=>{listeners.get(event.type)?.(event)}};
const react={useState:initial=>[initial,value=>{total=value}],useRef:initial=>({current:initial}),useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Number,console,process:{env:{}},Event:class{constructor(type){this.type=type}},window,fetch:()=>new Promise(resolve=>requests.push(resolve)),setInterval:()=>1,clearInterval(){},require:id=>id in mocks?mocks[id]:id==='react'?react:id==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:id==='next/link'?{default:'Link'}:id==='next/navigation'?{useRouter:()=>({refresh(){}})}:id==='@/app/lib/pusher-client'?{getPusherClient:()=>null}:{}});return exports;}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 load('app/components/ChatBell.tsx').default({userId:'buyer'});cleanupBell=effects.shift()();assert.equal(requests.length,1);
 const Receipt=load('app/chat/[id]/ChatReadReceipt.tsx',{'./actions':{markChatAsRead:()=>new Promise(resolve=>{receiptResolve=resolve})}}).default;
 Receipt({conversationId:'chat',readThrough:'2026-01-01T00:00:00.000Z'});const cleanupReceipt=effects.shift()();assert.equal(requests.length,1,'Do not clear badge before persistence');
 receiptResolve(true);await tick();assert.equal(requests.length,2,'Read event immediately refetches without navigation or reload');
 requests[1]({ok:true,json:async()=>({total:2})});await tick();assert.equal(total,2,'Unread messages in other conversations remain');
 requests[0]({ok:true,json:async()=>({total:5})});await tick();assert.equal(total,2,'Older response cannot restore stale badge');
 Receipt({conversationId:'failed',readThrough:'2026-01-01T00:00:00.000Z'});const failedCleanup=effects.shift()();receiptResolve(false);await tick();assert.equal(requests.length,2,'Failed read must not clear badge');failedCleanup();
 cleanupReceipt();cleanupBell();assert.equal(listeners.size,0);
 let user='buyer',conv={buyerId:'buyer',sellerId:'seller',buyerLastReadAt:null,sellerLastReadAt:null},updates=0;
 const action=load('app/chat/[id]/actions.ts',{'next-auth/next':{getServerSession:async()=>user?{user:{id:user}}:null},'@/app/lib/prisma':{prisma:{conversation:{findUnique:async()=>conv,updateMany:async({where,data})=>{
  const field=Object.keys(data)[0],current=conv[field],cutoff=data[field];if(!current||current<cutoff){conv[field]=cutoff;updates++;}return{count:1};
 }}}}}).markChatAsRead;
 assert(await action('chat','2026-01-02T00:00:00.000Z'));assert.equal(conv.buyerLastReadAt.toISOString(),'2026-01-02T00:00:00.000Z');assert.equal(conv.sellerLastReadAt,null);
 await action('chat','2026-01-01T00:00:00.000Z');assert.equal(updates,1,'Older tab cannot move read marker backwards');
 user='seller';await action('chat','2026-01-01T00:00:00.000Z');assert(conv.sellerLastReadAt);
 user='stranger';assert.equal(await action('chat','2026-01-01T00:00:00.000Z'),false);user=null;assert.equal(await action('chat'),false);
 user='buyer';assert.equal(await action('chat','invalid'),false);assert.equal(await action('chat','2099-01-01T00:00:00.000Z'),false);assert.equal(updates,2);
 console.log('Chat counter checks passed: persisted read triggers badge update, other unread messages retained, stale response ignored, failures/auth/read cutoff guarded.');
})().catch(error=>{console.error(error);process.exitCode=1});

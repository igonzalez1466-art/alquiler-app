const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),RealStripe=require('stripe');
const root=path.resolve(__dirname,'..');
const env={STRIPE_IDENTITY_ENABLED:'true',STRIPE_IDENTITY_MODE:'test',STRIPE_IDENTITY_SECRET_KEY:'sk_test_fake',STRIPE_IDENTITY_WEBHOOK_SECRET:'whsec_fake',APP_URL:'https://stagingmojaszafa.eu'};
const state={id:'user1',identitySessionId:null,identityStatus:'unverified',identityLivemode:null,identityVerifiedAt:null,identityStartedAt:null,identityAttempt:0};
const sessions=new Map();let created=0,lastParams,lastKey;
const real=new RealStripe('sk_test_fake');
class Stripe { constructor(){this.webhooks=real.webhooks;this.identity={verificationSessions:{retrieve:async id=>{if(!sessions.has(id))throw Error('missing');return {...sessions.get(id)};},create:async(params,options)=>{lastParams=params;lastKey=options.idempotencyKey;const item={id:'vs_'+(++created),livemode:false,status:'requires_input',url:'https://verify.stripe.com/test',...params};sessions.set(item.id,item);return item;}}};} }
let queue=Promise.resolve();
const tx={ $queryRaw:async()=>[],user:{findUniqueOrThrow:async()=>({...state}),update:async({data})=>{for(const[k,v]of Object.entries(data))state[k]=v&&typeof v==='object'&&'increment'in v?state[k]+v.increment:v;return {...state};}}};
const prisma={$transaction:async fn=>{const previous=queue;let release;queue=new Promise(r=>release=r);await previous;try{return await fn(tx);}finally{release();}},user:{findUnique:async({where})=>where.identitySessionId===state.identitySessionId?{id:state.id}:null}};
const cache={};const jsx=(type,props)=>({type,props});let authUser='user1';
function load(file){if(cache[file])return cache[file];const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:id=>id==='stripe'?Stripe:id==='@/app/lib/prisma'?{prisma}:id==='@/app/lib/auth'?{getSession:async()=>authUser?{user:{id:authUser}}:null}:id==='next/cache'?{revalidatePath:()=>{}}:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id.startsWith('@/')?load(id.slice(2)+'.ts'):require(id),process:{env},Date,URL,Response,Set,Number});return cache[file]=exports;}
const lib=load('app/lib/identityVerification.ts'),route=load('app/api/stripe/identity/webhook/route.ts'),actions=load('app/account/identityActions.ts'),Badge=load('app/components/IdentityBadge.tsx').default;
function request(event,signed=true){const body=JSON.stringify(event);return new Request('https://app/api/stripe/identity/webhook',{method:'POST',body,headers:signed?{'stripe-signature':real.webhooks.generateTestHeaderString({payload:body,secret:env.STRIPE_IDENTITY_WEBHOOK_SECRET})}:{}});}
const event=(type,id='vs_1',live=false)=>({id:'evt_test',object:'event',type,livemode:live,data:{object:{id}}});
(async()=>{
 assert.equal(lib.identityConfig().enabled,true);
 env.STRIPE_IDENTITY_MODE='live';assert.equal(lib.identityConfig().enabled,false);env.STRIPE_IDENTITY_MODE='test';
 for(const url of ['http://verify.stripe.com/foo','https://verify.stripe.com.evil.test/foo','https://evil.test/'])assert.throws(()=>lib.safeIdentityUrl(url));
 const results=await Promise.all([lib.beginIdentity('user1'),lib.beginIdentity('user1')]);assert.equal(created,1);assert.equal(results[0].url,'https://verify.stripe.com/test');assert.equal(results[1].url,results[0].url);
 assert.equal(lastParams.client_reference_id,'user1');assert.equal(lastParams.metadata.userId,'user1');assert.equal(lastParams.options.document.require_matching_selfie,true);assert.equal(lastParams.options.document.require_live_capture,true);assert.match(lastParams.return_url,/account\?identity=return/);assert.match(lastKey,/test-user1-0$/);
 assert.equal(state.identityStatus,'requires_input');assert.equal(state.identityAttempt,1);assert.equal('url'in state,false);assert.equal('verified_outputs'in state,false);
 sessions.get('vs_1').status='verified';sessions.get('vs_1').verified_outputs={first_name:'PRIVATE',id_number:'PRIVATE'};
 assert.equal((await route.POST(request(event('identity.verification_session.verified'),false))).status,400);assert.equal(state.identityStatus,'requires_input');
 let response=await route.POST(request(event('identity.verification_session.verified')));assert.equal(response.status,200);assert.equal(state.identityStatus,'verified');assert.ok(state.identityVerifiedAt);assert.equal(lib.publicIdentityVerified(state),false);assert.equal(Badge({user:state}),null);assert.equal(lib.identityView(state).testMode,true);
 const acceptedAt=+state.identityVerifiedAt;
 await route.POST(request(event('identity.verification_session.requires_input')));assert.equal(state.identityStatus,'verified');assert.equal(+state.identityVerifiedAt,acceptedAt);
 state.identityStatus='requires_input';await route.POST(request(event('identity.verification_session.verified','vs_other')));assert.equal(state.identityStatus,'requires_input');
 await route.POST(request(event('identity.verification_session.verified','vs_1',true)));assert.equal(state.identityStatus,'requires_input');
 sessions.get('vs_1').metadata={userId:'someone_else'};response=await route.POST(request(event('identity.verification_session.verified')));assert.equal(response.status,500);assert.equal(state.identityStatus,'requires_input');
 sessions.get('vs_1').metadata={userId:'user1'};sessions.get('vs_1').options.document.require_matching_selfie=false;response=await route.POST(request(event('identity.verification_session.verified')));assert.equal(response.status,500);
 sessions.get('vs_1').redaction={status:'redacted'};sessions.get('vs_1').metadata={};sessions.get('vs_1').client_reference_id=null;
 response=await route.POST(request(event('identity.verification_session.redacted')));assert.equal(response.status,200);assert.equal(state.identityStatus,'redacted');assert.equal(state.identityVerifiedAt,null);
 await assert.rejects(()=>lib.beginIdentity('user1'));assert.equal(created,1); // no immediate paid-session churn
 authUser=null;assert.equal((await actions.identityAction('start')).ok,false);authUser='user1';
 assert.equal((await actions.identityAction('invalid')).ok,false);
 state.identityStartedAt=new Date(Date.now()-120000);state.identityStatus='verified';state.identityLivemode=true;state.identityVerifiedAt=new Date();assert.ok(Badge({user:state}));
 const protectedLive=await lib.beginIdentity('user1');assert.equal(protectedLive.url,null);assert.equal(created,1);assert.equal(state.identityLivemode,true);
 env.STRIPE_IDENTITY_ENABLED='false';await assert.rejects(()=>lib.beginIdentity('user1'));
 console.log('PASS Identity: authenticated actions, signed webhooks, session ownership/options/mode, repeated/out-of-order/unknown events, redaction, idempotent concurrent starts, retry throttling, sensitive-data exclusion and live-only badges. No network or database writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});

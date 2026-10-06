const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root='C:/dev/alquiler-app',ts=require(root+'/node_modules/typescript');
const jsx=(type,props)=>({type,props});
function load(file){const exports={};function req(id){
 if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
 if(id==='react')return {useState:v=>[v,()=>{}],useEffect:()=>{}};
 if(id==='next/link')return 'Link';
 if(id==='@/app/lib/prisma')return {prisma:new Proxy({}, {get(){throw Error('Unexpected database access');}})};
 if(id.startsWith('@/'))return load(id.slice(2)+'.ts');throw Error(id);
}vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:req,Date,Intl,encodeURIComponent});return exports;}
function nodes(n,type){if(!n||typeof n!=='object')return [];return [...(n.type===type?[n]:[]),...[n.props?.children].flat(Infinity).flatMap(c=>nodes(c,type))];}
function text(n){if(n==null||n===false)return '';if(typeof n!=='object')return String(n);return [n.props?.children].flat(Infinity).map(text).join(' ');}
const Next=load('app/bookings/[id]/_components/BookingNextAction.tsx').default;
const Progress=load('app/bookings/[id]/_components/BookingProgress.tsx').default;
const Return=load('app/bookings/[id]/_components/ReturnSection.tsx').default;
const now=new Date();const b={id:'b',ownerId:'owner',renterId:'renter',status:'CONFIRMED',paymentStatus:'PAID',createdAt:now,startDate:now,endDate:new Date(+now+86400000),paymentDueAt:null,cancelledAt:null,shippingStatus:'DELIVERED',deliveryConfirmationStatus:'CONFIRMED',returnStatus:'PENDING',returnConfirmationStatus:'NOT_REQUESTED',returnConfirmedAt:null,depositStatus:'NONE',depositCents:0,depositClaim:null,settlementDecision:null,settlementCompletedAt:now,deliveryIssue:null,returnIssue:null,settlementLegacyReview:false,depositDecisionAt:null,listing:{title:'Test'},incidents:[]};
const next=(booking,userId='renter')=>Next({booking,userId,ownerPhoneVerified:true});
assert.doesNotMatch(text(next(b)),/Rezerwacja zakończona/);
assert.match(text(next(b)),/Wynajem trwa/);
assert.match(text(next({...b,returnConfirmationStatus:'CONFIRMED'})),/Rezerwacja zakończona/);
for(const [status,expected] of [['AWAITING_OWNER','właściciela'],['ESCALATED','właściciela'],['AWAITING_RENTER','najemcy']]){
 const i={stage:'DELIVERY',status};const who=status==='AWAITING_RENTER'?'owner':'renter';
 assert.match(text(next({...b,incidents:[i]},who)),new RegExp(expected));
 assert.doesNotMatch(text(next({...b,incidents:[i]},who)),/Rezerwacja zakończona/);
}
let steps=nodes(Progress({booking:b}),'li');assert.equal(steps.length,5);assert.match(text(steps[4]),/Przed nami/);
steps=nodes(Progress({booking:{...b,returnConfirmationStatus:'CONFIRMED'}}),'li');assert.match(text(steps[4]),/Gotowe/);
steps=nodes(Progress({booking:{...b,incidents:[{stage:'RETURN',status:'ESCALATED'}]}}),'li');assert.match(text(steps[3]),/Reklamacja/);
assert.equal(nodes(Return({children:'return form'}),'button')[0].props['aria-expanded'],false);
assert.equal(nodes(Return({children:'return form',defaultOpen:true}),'button')[0].props['aria-expanded'],true);
console.log('PASS booking UX: payout is not end of rental, reciprocal waiting states, five-step progress, active claims and automatic return expansion. No database writes.');

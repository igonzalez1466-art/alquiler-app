const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root='C:/dev/alquiler-app',ts=require(root+'/node_modules/typescript');
const jsx=(type,props)=>({type,props});
function load(file){const exports={};function req(id){
 if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
 if(id==='react')return {useState:v=>[v,()=>{}],useEffect:()=>{}};
 if(id==='next/link')return 'Link';
 if(id==='@/app/lib/prisma')return {prisma:new Proxy({}, {get(){throw Error('Unexpected database access');}})};
 if(id.startsWith('@/'))return load(id.slice(2)+'.ts');if(id.startsWith('./'))return load(path.join(path.dirname(file),id+'.ts'));throw Error(id);
}vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:req,Date,Intl,encodeURIComponent});return exports;}
function nodes(n,type){if(!n||typeof n!=='object')return [];return [...(n.type===type?[n]:[]),...[n.props?.children].flat(Infinity).flatMap(c=>nodes(c,type))];}
function text(n){if(n==null||n===false)return '';if(typeof n!=='object')return String(n);return [n.props?.children].flat(Infinity).map(text).join(' ');}
const Next=load('app/bookings/[id]/_components/BookingNextAction.tsx').default;
const Progress=load('app/bookings/[id]/_components/BookingProgress.tsx').default;
const Return=load('app/bookings/[id]/_components/ReturnSection.tsx').default;
const now=new Date();const b={id:'b',ownerId:'owner',renterId:'renter',status:'CONFIRMED',paymentStatus:'PAID',createdAt:now,startDate:now,endDate:new Date(+now+86400000),paymentDueAt:null,cancelledAt:null,shippingStatus:'DELIVERED',deliveryConfirmationStatus:'CONFIRMED',returnStatus:'PENDING',returnConfirmationStatus:'NOT_REQUESTED',returnConfirmedAt:null,depositStatus:'NONE',depositCents:0,depositClaim:null,settlementDecision:null,settlementCompletedAt:now,deliveryIssue:null,returnIssue:null,settlementLegacyReview:false,depositDecisionAt:null,listing:{title:'Test'},incidents:[]};
const next=(booking,userId='renter')=>Next({booking,userId,ownerPhoneVerified:true});
const expired={...b,status:'CANCELLED',paymentStatus:'CANCELLED',createdAt:new Date(+now-13*3600000),cancelledAt:now};
assert.match(text(next(expired)),/Właściciel nie zaakceptował rezerwacji w ciągu 12 godzin/);
assert.match(text(next({...expired,paymentDueAt:new Date(+now-60000)})),/Najemca nie opłacił rezerwacji w ciągu 12 godzin/);
assert.doesNotMatch(text(Next({booking:expired,userId:'renter',ownerPhoneVerified:true,cancelledByRenter:true})),/w ciągu 12 godzin/);
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
const Access=load('app/lib/chatAccess.ts');
const bookingChat={...b,returnStatus:'PENDING'};
const pendingApproval={...bookingChat,status:'PENDING',paymentStatus:'PENDING',createdAt:new Date(+now-12*3600000)};
assert.equal(Access.isBookingChatClosed(pendingApproval,new Date(+now-1)),false);
assert.equal(Access.isBookingChatClosed(pendingApproval,now),true);
const pendingPayment={...bookingChat,status:'AWAITING_PAYMENT',paymentStatus:'PENDING',paymentDueAt:now};
assert.equal(Access.isBookingChatClosed(pendingPayment,new Date(+now-1)),false);
assert.equal(Access.isBookingChatClosed(pendingPayment,now),true);
assert.equal(Access.isBookingChatClosed({...pendingPayment,status:'CONFIRMED',paymentStatus:'PAID'},now),false);
const listingChat={booking:null,listing:{available:true,isDraft:false},closedReason:'BOOKING_CANCELLED_BY_OWNER',status:'CLOSED'};
assert.equal(Access.isChatClosed(listingChat),false);
assert.equal(Access.isChatClosed({...listingChat,listing:{available:false,isDraft:false}}),true);
assert.equal(Access.isChatClosed({...listingChat,booking:bookingChat}),false);
assert.equal(Access.isChatClosed({...listingChat,booking:{...bookingChat,status:'CANCELLED',paymentStatus:'CANCELLED'}}),true);
assert.equal(Access.isBookingChatClosed({...bookingChat,returnConfirmationStatus:'CONFIRMED'}),true);
const refunded={...bookingChat,status:'CANCELLED',paymentStatus:'REFUNDED',incidents:[{stage:'DELIVERY',status:'RESOLVED',reason:'NOT_AS_DESCRIBED',acceptedAt:now,refundCents:30000}]};
assert.equal(Access.isBookingChatClosed(refunded),false);
assert.equal(Access.isBookingChatClosed({...refunded,returnConfirmationStatus:'CONFIRMED'}),true);
assert.equal(Access.isBookingChatClosed({...refunded,incidents:[{...refunded.incidents[0],reason:'NOT_RECEIVED'}]}),true);
console.log('PASS booking UX: payout is not end of rental, reciprocal waiting states, five-step progress, active claims and automatic return expansion. No database writes.');

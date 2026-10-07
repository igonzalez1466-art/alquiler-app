const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');let user='renter',calls=[],fail=false,bookings=[];
const clone=value=>structuredClone(value);
function load(file){const exports={};const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,Date,URL,Intl,encodeURIComponent,require:id=>{
  if(id==='next/server')return{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}};
  if(id==='@/app/lib/auth')return{getSession:async()=>user?{user:{id:user}}:null};
  if(id==='@/app/lib/prisma')return{prisma:{booking:{findMany:async q=>{calls.push(q);if(fail)throw Error('Private database error');assert.deepEqual(JSON.stringify(q.where.OR),JSON.stringify([{ownerId:user},{renterId:user}]));return bookings.filter(b=>[b.ownerId,b.renterId].includes(user)&&(!q.where.id||b.id===q.where.id)).slice(0,q.take).map(clone);}}}};
  if(id.startsWith('@/'))return load(id.slice(2)+'.ts');throw Error(id);
 }});return exports;
}
const fixture=()=>({id:'b',bookingNumber:111,ownerId:'owner',renterId:'renter',status:'CONFIRMED',paymentStatus:'PAID',createdAt:new Date(),startDate:new Date('2026-10-10'),endDate:new Date('2026-10-15'),paymentDueAt:null,cancelledAt:null,shippingStatus:'SHIPPED',deliveryConfirmationStatus:'AWAITING_CONFIRMATION',returnStatus:'PENDING',returnConfirmationStatus:'NOT_REQUESTED',returnConfirmedAt:null,depositStatus:'NONE',depositCents:0,depositClaim:null,settlementDecision:null,settlementCompletedAt:null,deliveryIssue:null,returnIssue:null,settlementLegacyReview:false,depositDecisionAt:null,carrier:'InPost',trackingNumber:'123456789012345678901234',returnCarrier:null,returnTrackingNumber:null,listing:{title:'Ubranie'},incidents:[],secret:'must never leave API'});
const {GET}=load('app/api/help/bookings/route.ts');const {helpBookingSummary:summary}=load('app/lib/helpBooking.ts');
const request=id=>({url:'https://example.test/api/help/bookings'+(id!==undefined?'?id='+encodeURIComponent(id):'')});
(async()=>{
 user=null;let result=await GET(request());assert.equal(result.status,401);assert.equal(calls.length,0);assert.match(result.headers['Cache-Control'],/no-store/);
 user='renter';bookings=[fixture(),{...fixture(),id:'foreign',ownerId:'someone',renterId:'someone-else'}];
 result=await GET(request());assert.equal(result.status,200);assert.equal(result.body.bookings.length,1);assert.equal(result.body.bookings[0].role,'Najemca');assert.equal(result.body.bookings[0].ownerId,undefined);assert.equal(result.body.bookings[0].secret,undefined);assert.equal(result.body.bookings[0].depositClaim,undefined);assert.equal(calls.at(-1).select.listing.select.title,true);assert.equal(calls.at(-1).select.renter,undefined);assert.equal(calls.at(-1).select.bookingEvidencePhotos,undefined);
 assert.equal((await GET(request('foreign'))).status,404);assert.equal((await GET(request('missing'))).status,404);assert.equal((await GET(request('../b'))).status,400);
 user='owner';result=await GET(request('b'));assert.equal(result.body.bookings.length,1);assert.equal(result.body.bookings[0].role,'Właściciel');
 user='outsider';assert.equal((await GET(request('b'))).status,404);assert.throws(()=>summary(fixture(),user),/Brak/);
 user='renter';bookings=Array.from({length:31},(_,i)=>({...fixture(),id:'b'+i}));result=await GET(request());assert.equal(result.body.bookings.length,30);assert.equal(result.body.hasMore,true);assert.equal(calls.at(-1).take,31);
 fail=true;result=await GET(request());assert.equal(result.status,503);assert.doesNotMatch(result.body.error,/Private/);fail=false;
 let b=fixture();b.carrier='Odbiór osobisty';assert.match(summary(b,'renter').delivery,/osobiste/);assert.doesNotMatch(summary(b,'renter').delivery,/123456/);
 b=fixture();b.incidents=[{stage:'DELIVERY',status:'AWAITING_OWNER',reason:'NOT_AS_DESCRIBED',acceptedAt:null,refundCents:null}];assert.match(summary(b,'renter').next.text,/Czekamy na odpowiedź właściciela/);assert.match(summary(b,'owner').next.text,/Najemca zgłosił problem/);assert.equal(summary(b,'renter').next.href,'/account/incidents/b');
 b.incidents[0].status='AWAITING_RENTER';assert.match(summary(b,'owner').next.text,/Czekamy na odpowiedź najemcy/);assert.match(summary(b,'renter').next.text,/Odpowiedz/);
 b.incidents[0].status='AGREEMENT_REACHED';assert.match(summary(b,'renter').next.text,/w toku/);
 b=fixture();b.status='AWAITING_PAYMENT';b.paymentStatus='PENDING';b.paymentDueAt=new Date(Date.now()+3600000);assert.equal(summary(b,'renter').next.href,'/bookings/b/pay');
 b=fixture();Object.assign(b,{status:'CANCELLED',paymentStatus:'REFUNDED',settlementCompletedAt:new Date(),incidents:[{stage:'DELIVERY',status:'RESOLVED',reason:'NOT_AS_DESCRIBED',acceptedAt:new Date(),refundCents:10000}]});assert.equal(summary(b,'renter').next.href,'/bookings/b#return-section');assert.match(summary(b,'owner').next.text,/zwrot/);assert.match(summary(b,'renter').payment,/zależy od banku/);
 console.log('Guided help checks passed: authentication, participant scope, foreign ID denied, private metadata omitted, pagination, Polish failure, delivery method, reciprocal incident turns, payment links and cancelled-item returns. No database writes.');
})().catch(e=>{console.error(e);process.exitCode=1});

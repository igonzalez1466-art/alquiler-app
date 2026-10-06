const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache={};let b,user,updates,mails;
function matches(record,where){return Object.entries(where).every(([key,value])=>{
 if(key==='OR')return value.some(q=>matches(record,q)); if(key==='AND')return value.every(q=>matches(record,q));
 if(key==='incidents')return record.incidents.some(i=>matches(i,value.some));
 if(value&&typeof value==='object'&&!(value instanceof Date))return 'in'in value?value.in.includes(record[key]):'not'in value?record[key]!=value.not:'gt'in value?record[key]>value.gt:false;
 return record[key]===value;
});}
const prisma={booking:{findUnique:async()=>structuredClone(b),updateMany:async({where,data})=>{if(!matches(b,where))return{count:0};updates.push(data);Object.assign(b,data);return{count:1};}}};
function load(file){if(cache[file])return cache[file];const exports={};const req=id=>{
 if(id==='@/app/lib/prisma')return{prisma}; if(id==='next-auth'||id==='next-auth/next')return{getServerSession:async()=>({user:{id:user}})};
 if(id==='@/auth.config')return{authConfig:{}}; if(id==='next/cache')return{revalidatePath(){}};
 if(id==='@/app/lib/mailer')return{sendMail:async m=>mails.push(m)};
 if(id==='@/app/lib/rentOnlySettlement')return{trySettleRentOnlyBooking:async()=>{assert(b.settlementCompletedAt)}};
 if(id==='@/app/lib/reviewInvitations')return{tryInviteBookingReview:async()=>{}};
 if(id==='@prisma/client')return{}; if(id.startsWith('@/'))return load(id.slice(2)+'.ts');throw Error(id);
 };vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:req,Date,FormData,console,process:{env:{APP_URL:'https://example.test'}}});return cache[file]=exports;}
const policy=load('app/lib/cancelledIncidentReturn.ts'),ship=load('app/bookings/[id]/_actions/updateReturnAction.ts').updateReturnAction,receive=load('app/bookings/[id]/_actions/confirmReturnAction.ts').confirmReturnAction;
function reset(){b={id:'b',bookingNumber:1,status:'CANCELLED',paymentStatus:'REFUNDED',depositCents:0,settlementCompletedAt:new Date(),incidents:[{stage:'DELIVERY',status:'RESOLVED',acceptedAt:new Date(),refundCents:6000}],renterId:'renter',ownerId:'owner',shippingStatus:'SHIPPED',deliveryConfirmationStatus:'DISPUTED',returnStatus:'PENDING',returnConfirmationStatus:'NOT_REQUESTED',returnShippedAt:null,startDate:new Date(),endDate:new Date(),listing:{title:'Item'},owner:{email:'owner@example.test'},renter:{name:'Renter'},rentRefundedCents:6000};user='renter';updates=[];mails=[];}
function form(){const f=new FormData();f.set('bookingId','b');f.set('returnStatus','SHIPPED');f.set('deliveryMethod','PERSONAL');return f;}
(async()=>{
 reset();assert(policy.canReturnCancelledIncidentBooking(b));assert(matches(b,policy.cancelledIncidentReturnWhere()));
 for(const patch of [{incidents:[]},{paymentStatus:'PAID'},{depositCents:100},{settlementCompletedAt:null},{incidents:[{stage:'DELIVERY',status:'AGREEMENT_REACHED',acceptedAt:new Date(),refundCents:6000}]}]){reset();Object.assign(b,patch);assert(!policy.canReturnCancelledIncidentBooking(b));await assert.rejects(ship(form()));assert.equal(updates.length,0);}
 reset();user='owner';await assert.rejects(ship(form()));user='renter';await ship(form());assert.equal(b.returnStatus,'SHIPPED');assert.equal(b.returnCarrier,'Odbiór osobisty');assert.equal(b.returnConfirmationStatus,'AWAITING_CONFIRMATION');assert.equal(mails.length,1);
 await assert.rejects(ship(form()));await assert.rejects(receive(form()));user='owner';await receive(form());assert.equal(b.returnConfirmationStatus,'CONFIRMED');await assert.rejects(receive(form()));
 assert.equal(b.paymentStatus,'REFUNDED');assert.equal(b.rentRefundedCents,6000);assert(updates.every(update=>Object.keys(update).every(key=>key.startsWith('return'))));
 console.log('Cancelled incident return checks passed: accepted-refunded gate, roles, record shipment, confirm receipt, no financial changes.');
})().catch(e=>{console.error(e);process.exitCode=1});

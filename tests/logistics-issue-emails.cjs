const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),staged=root,ts=require(root+'/node_modules/typescript');
let b,user,mails,errors,fail;const env={NEXT_PUBLIC_APP_URL:'https://example.test'};
const prisma={booking:{
 updateMany:async({where,data})=>{const match=Object.entries(where).every(([k,v])=>v&&typeof v==='object'?('in' in v?v.in.includes(b[k]):b[k]!==v.not):b[k]===v);if(!match)return {count:0};Object.assign(b,data);return {count:1};},
 findUniqueOrThrow:async()=>structuredClone(b),
}};
function load(f){const p=fs.existsSync(staged+'/'+f)?staged+'/'+f:root+'/'+f;const exports={};function req(id){
 if(id==='@/app/lib/prisma')return {prisma};
 if(id==='@/app/lib/mailer')return {sendMail:async mail=>{assert.ok(b.deliveryIssue||b.returnIssue);if(fail)throw Error('Mock SMTP failure');mails.push(mail);}};
 if(id==='next-auth')return {getServerSession:async()=>user?{user:{id:user}}:null};
 if(id==='@/auth.config')return {authConfig:{}};
 if(id==='next/cache')return {revalidatePath:()=>{}};
 if(id.startsWith('@/'))return load(id.slice(2)+'.ts');throw Error(id);
}vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:req,Date,Intl,FormData,process:{env},console:{error:(...e)=>errors.push(e)}});return exports;}
const report=load('app/bookings/[id]/_actions/reportLogisticsProblemAction.ts').reportLogisticsProblemAction;
function reset(stage){user=stage==='DELIVERY'?'renter':'owner';mails=[];errors=[];fail=false;b={id:'b',bookingNumber:123,ownerId:'owner',renterId:'renter',status:'PAID',paymentStatus:'PAID',shippingStatus:stage==='DELIVERY'?'SHIPPED':'DELIVERED',deliveryConfirmationStatus:stage==='DELIVERY'?'AWAITING_CONFIRMATION':'CONFIRMED',returnStatus:'SHIPPED',returnConfirmationStatus:'AWAITING_CONFIRMATION',startDate:new Date('2026-09-21T10:00:00Z'),endDate:new Date('2026-09-23T10:00:00Z'),listing:{title:'Sukienka <test>'},owner:{id:'owner',name:'Owner',email:'owner@example.test'},renter:{id:'renter',name:'Renter',email:'renter@example.test'}};}
function form(stage,over={}){const f=new FormData();for(const[k,v]of Object.entries({bookingId:'b',stage,reason:'DAMAGED',description:'Zamek uszkodzony <img src=x>\nDrugi wiersz',...over}))f.set(k,v);return f;}
(async()=>{
 for(const stage of ['DELIVERY','RETURN']){
  reset(stage);await report(form(stage));assert.equal(mails.length,1);assert.equal(mails[0].to,stage==='DELIVERY'?'owner@example.test':'renter@example.test');assert.match(mails[0].subject,/#123/);assert.ok(mails[0].subject.includes(stage==='DELIVERY'?'Dostawa':'Zwrot'));assert.match(mails[0].text,/21\.09\.2026, 12:00/);assert.match(mails[0].text,/23\.09\.2026, 12:00/);assert.match(mails[0].text,/Otwórz czat/);assert.match(mails[0].text,/Drugi wiersz/);assert.ok(mails[0].html.includes('https://example.test/bookings/b'));assert.match(mails[0].html,/&lt;img/);assert.ok(!mails[0].html.includes('<img'));assert.match(mails[0].html,/Sukienka &lt;test&gt;/);
  await assert.rejects(()=>report(form(stage)));assert.equal(mails.length,1);
  reset(stage);user='outsider';await assert.rejects(()=>report(form(stage)));assert.equal(mails.length,0);
  reset(stage);user=null;await assert.rejects(()=>report(form(stage)));assert.equal(mails.length,0);
  reset(stage);await assert.rejects(()=>report(form(stage,{description:''})));assert.equal(mails.length,0);
  reset(stage);fail=true;await report(form(stage));assert.equal(errors.length,1);assert.equal(mails.length,0);assert.equal(b[stage==='DELIVERY'?'deliveryConfirmationStatus':'returnConfirmationStatus'],'DISPUTED');
  reset(stage);const results=await Promise.allSettled([report(form(stage)),report(form(stage))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(mails.length,1);
 }
 console.log('Both directions verified: recipients, booking dates, details, chat/link, HTML escaping, duplicates, authorization and SMTP failure. No real emails sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});

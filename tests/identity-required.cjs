const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const env={APP_URL:'https://stagingmojaszafa.eu',STRIPE_IDENTITY_MODE:'test',STRIPE_IDENTITY_ENABLED:'true',STRIPE_IDENTITY_SECRET_KEY:'sk_test_fake',STRIPE_SECRET_KEY:'sk_test_fake'};
const verified=()=>({identityStatus:'verified',identityLivemode:false,identityVerifiedAt:new Date(),phoneVerifiedAt:new Date(),email:null});
const users={owner:verified(),renter:verified()};let current='renter',created=0,uploads=0,intents=0,mail=0,listingData;
const listings={item:{id:'item',title:'Test',userId:'owner',pricePerDay:10,minimumRentalDays:3,fianza:null,available:true,isDraft:false,images:[{},{},{}],createdAt:new Date(),_count:{images:3}}};
const booking={id:'booking',ownerId:'owner',renterId:'renter',listingId:'item',status:'AWAITING_PAYMENT',paymentStatus:'PENDING',paidAt:null,paymentDueAt:new Date(Date.now()+600000),rentAmountCents:3000,depositCents:0};
const prisma={
 user:{findUnique:async({where})=>users[where.id]??null,findFirst:async()=>null},
 listing:{findUnique:async({where})=>listings[where.id]?{...listings[where.id],user:users.owner}:null,create:async({data})=>{created++;listingData=data;return {id:'new',title:data.title};},update:async({where,data})=>Object.assign(listings[where.id],data),findMany:async({where})=>Object.values(listings).filter(l=>(where.userId===undefined||l.userId===where.userId)&&(where.isDraft===undefined||l.isDraft===where.isDraft)&&(where.available===undefined||l.available===where.available))},
 booking:{findUnique:async()=>booking,findFirst:async()=>null,findMany:async()=>[],update:async({data})=>Object.assign(booking,data),create:async()=>{throw Error('Unexpected booking write');}},
 review:{aggregate:async()=>({_avg:{rating:0},_count:{rating:0}})},
 conversation:{findUnique:async()=>null,create:async()=>{throw Error('Unexpected chat write');}},
 $queryRaw:async()=>[],
};prisma.$transaction=async fn=>fn(prisma);
class Stripe {constructor(){this.paymentIntents={create:async()=>{intents++;return {id:'pi_test',client_secret:'test',amount:3000,currency:'pln',metadata:{bookingId:'booking'},status:'requires_payment_method'};},retrieve:async()=>{throw Error('Unexpected retrieve');}};}}
function redirect(url){throw Object.assign(new Error('Redirect'),{redirect:url});}
const jsx=(type,props)=>({type,props});const cache={};
function load(file){if(cache[file])return cache[file];const exports={};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const req=id=>{
  if(id==='@/app/lib/prisma')return {prisma};
  if(id==='@/app/lib/identityVerification')return {publicIdentityVerified:u=>u.identityStatus==='verified'&&u.identityLivemode===true&&!!u.identityVerifiedAt};
  if(id==='@/app/lib/auth')return {getSession:async()=>current?{user:{id:current}}:null};
  if(id==='next-auth/next'||id==='next-auth')return {getServerSession:async()=>current?{user:{id:current}}:null};
  if(id==='@/auth.config')return {authConfig:{}};
  if(id==='next/navigation')return {redirect,notFound:()=>{throw Object.assign(new Error('Not found'),{notFound:true});}};
  if(id==='next/cache')return {revalidatePath:()=>{}};
  if(id==='next/server')return require(id);
  if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(id==='stripe')return Stripe;
  if(id==='@vercel/blob')return {put:async()=>{uploads++;return {url:'https://example.test/photo.jpg'};}};
  if(id==='@/app/lib/mailer')return {sendMail:async()=>{mail++;}};
  if(id==='@/app/lib/features')return {DEPOSITS_ENABLED:false};
  if(id==='@/app/lib/bookingRestrictions')return {assertBookingAccountsAvailable:async()=>{}};
  if(id.startsWith('@/app/lib/'))return load(id.slice(2)+'.ts');
  if(id==='@/app/listing/actions')return load('app/listing/actions.ts');
  if(id==='./locationValidation')return load('app/listing/new/locationValidation.ts');
  if(id==='./_components/BookingForm'||id==='./PublishForm')return Object.assign(()=>{}, {PublishButton:()=>{}});
  if(id.startsWith('.')||id.startsWith('@/app/components/')||id==='next/link'||id==='next/image')return Object.assign(()=>{}, {ListingFieldError:()=>{},toggleListingAvailable:()=>{}});
  return require(id);
 };vm.runInNewContext(code,{exports,require:req,process:{env},console,Date,URL,Response,Request,File,FormData,Set,Number,Promise});return cache[file]=exports;
}
function findAction(node){if(!node||typeof node!=='object')return null;if(typeof node.props?.action==='function')return node.props.action;for(const n of [node.props?.children].flat(Infinity)){const result=findAction(n);if(result)return result;}return null;}
function findProps(node,key){if(!node||typeof node!=='object')return null;if(node.props&&key in node.props)return node.props[key];for(const n of [node.props?.children].flat(Infinity)){const found=findProps(n,key);if(found)return found;}return null;}
async function redirected(task,target){await assert.rejects(task,error=>error.redirect===target);}
function form(intent='publish'){const f=new FormData();for(const[k,v]of Object.entries({intent,title:'Test',description:'Opis',pricePerDay:'10',minimumRentalDays:'3',city:'Kraków',lat:'50',lng:'20',gender:'WOMAN',garmentType:'VESTIDO',size:'M',color:'CZARNY',material:'BAWELNA',estado:'NUEVO',metodoEnvio:'RECOGIDA_LOCAL'}))f.set(k,v);for(let i=0;i<3;i++)f.append('photos',new File(['photo'],'photo.jpg',{type:'image/jpeg'}));return f;}
(async()=>{
 const gate=load('app/lib/identityRequirement.ts');
 assert.equal(gate.hasRequiredIdentity(users.owner),true);
 for(const status of ['unverified','requires_input','processing','canceled','redacted'])assert.equal(gate.hasRequiredIdentity({...verified(),identityStatus:status}),false);
 assert.equal(gate.hasRequiredIdentity({...verified(),identityVerifiedAt:null}),false);
 for(const url of ['https://mojaszafa.eu','https://stagingmojaszafa.eu.evil.test','http://stagingmojaszafa.eu','invalid']){env.APP_URL=url;assert.equal(gate.hasRequiredIdentity(verified()),false);}
 env.APP_URL='https://stagingmojaszafa.eu';env.STRIPE_IDENTITY_MODE='live';assert.equal(gate.hasRequiredIdentity(verified()),false);assert.equal(gate.hasRequiredIdentity({...verified(),identityLivemode:true}),true);env.STRIPE_IDENTITY_MODE='test';
 for(const url of ['//evil.test','https://evil.test','/\\evil.test','/admin','/listing/new?next=https://evil.test'])assert.equal(gate.safeIdentityReturn(url),null);
 assert.equal(gate.safeIdentityReturn('/bookings/booking/pay'),'/bookings/booking/pay');
 current='owner';users.owner.identityStatus='unverified';
 const newPage=load('app/listing/new/page.tsx').default;const publish=findAction(await newPage({searchParams:Promise.resolve({})}));assert.ok(publish);
 const denied=await publish(form());assert.ok(denied.error);assert.match(denied.verifyUrl,/#tozsamosc/);assert.equal(created,0);assert.equal(uploads,0);
 await redirected(()=>publish(form('draft')),'/listing/new');assert.equal(created,1);assert.equal(listingData.isDraft,true);assert.equal(listingData.available,false);assert.equal(uploads,3);assert.equal(mail,0);
 const api=load('app/api/listings/route.ts');const response=await api.POST(new Request('https://app/api/listings',{method:'POST',body:JSON.stringify({title:'Test',pricePerDay:10,isDraft:false})}));assert.equal(response.status,403);assert.equal((await response.json()).code,'IDENTITY_REQUIRED');assert.equal(created,1);
 const actions=load('app/listing/actions.ts');const toggle=new FormData();toggle.set('listingId','item');listings.item.available=false;
 await redirected(()=>actions.toggleListingAvailable(toggle),gate.accountIdentityUrl('/listing/item'));assert.equal(listings.item.available,false);
 users.owner=verified();listings.item.isDraft=true;await redirected(()=>actions.toggleListingAvailable(toggle),'/listing/item');assert.equal(listings.item.isDraft,false);assert.equal(listings.item.available,true);
 users.owner.identityStatus='unverified';listings.item.available=true;await redirected(()=>actions.toggleListingAvailable(toggle),'/listing/item');assert.equal(listings.item.available,false); // deactivation always allowed
 listings.item.available=true;listings.item.isDraft=true;current='renter';
 const search=load('app/listing/page.tsx').default;
 for(const tab of ['all','invalid','my']){const ui=await search({searchParams:Promise.resolve({tab})});assert.equal(findProps(ui,'listings').length,0);assert.equal(findProps(ui,'markers').length,0);}
 current='owner';assert.equal(findProps(await search({searchParams:Promise.resolve({tab:'my'})}),'listings').length,1);current='renter';
 const page=load('app/listing/[id]/page.tsx');await assert.rejects(()=>page.default({params:Promise.resolve({id:'item'})}),e=>e.notFound===true);const meta=await page.generateMetadata({params:Promise.resolve({id:'item'})});assert.equal(meta.title,'Ogłoszenie');assert.equal(meta.description,undefined);
 listings.item.isDraft=false;
 const bookingActions=load('app/listing/[id]/actions.ts');const requestForm=new FormData();requestForm.set('listingId','item');requestForm.set('startDate','2026-12-01');requestForm.set('endDate','2026-12-03');
 users.renter.identityStatus='unverified';await redirected(()=>bookingActions.createBookingAction(requestForm),gate.accountIdentityUrl('/listing/item'));
 users.renter=verified();await redirected(()=>bookingActions.createBookingAction(requestForm),'/listing/item?blad=tozsamosc-wlasciciela');
 const legacy=load('app/bookings/actions.ts');await assert.rejects(()=>legacy.createBookingAction({listingId:'item',startDate:'2026-12-01',endDate:'2026-12-03'}),e=>e.message===gate.OWNER_IDENTITY_REQUIRED_MESSAGE);
 const payment=load('app/api/stripe/create-intents/route.ts');const pay=()=>payment.POST(new Request('https://app/api/stripe/create-intents',{method:'POST',body:JSON.stringify({bookingId:'booking',identityStatus:'verified'})}));
 users.renter.identityStatus='unverified';let res=await pay();assert.equal(res.status,403);assert.equal((await res.json()).code,'IDENTITY_REQUIRED');assert.equal(intents,0);
 users.renter=verified();res=await pay();assert.equal(res.status,403);assert.equal((await res.json()).code,'OWNER_IDENTITY_REQUIRED');assert.equal(intents,0);
 users.owner=verified();res=await pay();assert.equal(res.status,200);assert.equal(intents,1);
 console.log('PASS identity requirements: unverified owner/renter blocked before writes/uploads/payments; private draft saved without email and inaccessible to other users; verified publication and payment allowed; deactivation allowed; production rejects simulated identity; unsafe return URLs rejected. No network or database writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});

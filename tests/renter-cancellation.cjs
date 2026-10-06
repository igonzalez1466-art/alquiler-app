const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), ts = require(path.join(root, 'node_modules/typescript'));
let booking, piStatus, refundStatus, refundCreates, cancelledIntents, mails, failRefund, failMail, raceCancel, ledger;
let serial = Promise.resolve();
const tx = {
  $queryRaw: async () => [],
  booking: { findUniqueOrThrow: async () => structuredClone(booking), update: async ({data}) => { Object.assign(booking,data); return structuredClone(booking); } },
  settlementOperation: { findFirst: async () => ledger ? {} : null },
  incident: { updateMany: async () => ({count:0}) },
};
const prisma = { ...tx, $transaction: fn => {
  const run = serial.then(async () => { const before = structuredClone(booking); try { return await fn(tx); } catch(e) { booking = before; throw e; } });
  serial = run.catch(() => {}); return run;
} };
class Stripe {
  paymentIntents = {
    retrieve: async () => ({id:'pi',status:piStatus,amount:18000,amount_received:18000,currency:'pln',metadata:{bookingId:'b'},latest_charge:{id:'ch',disputed:false,amount_refunded:0}}),
    cancel: async () => { if (raceCancel) { raceCancel=false;piStatus='succeeded';throw Error('Payment completed concurrently'); } cancelledIntents++; piStatus='canceled'; return {status:'canceled'}; },
  };
  refunds = { retrieve: async () => ({id:'re',amount:18000,currency:'pln',payment_intent:'pi',status:refundStatus}) };
}
const cache = new Map();
function load(file) {
  file=file.replaceAll('\\','/'); if(cache.has(file))return cache.get(file);
  const exports={};
  function req(id) {
    if(id==='stripe')return Stripe;
    if(id==='@prisma/client')return {Prisma:{}};
    if(id==='@/app/lib/prisma')return {prisma};
    if(id==='@/app/lib/mailer')return {sendMail:async data=>{if(failMail===data.to){failMail=null;throw Error('SMTP unavailable');}mails.push(data);}};
    if(id==='@/app/lib/settlement')return {settlementOperation:async (_stripe,id,kind,params)=>{
      assert.equal(kind,'refund');assert.equal(params.amount,18000);assert.equal(params.payment_intent,'pi');
      if(failRefund){failRefund=false;throw Error('Network timeout');}
      if(!ledger){ledger={id:'re',amount:18000};refundCreates++;}return ledger;
    }};
    if(id.startsWith('./'))return load(path.join(path.dirname(file),id+'.ts'));
    throw Error(id);
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:req,Date,Intl,Number,console:{error(){}},process:{env:{STRIPE_SECRET_KEY:'mock',APP_URL:'https://example.test'}},encodeURIComponent});
  cache.set(file,exports);return exports;
}
const policy=load('app/lib/renterCancellationPolicy.ts'), actions=load('app/lib/renterCancellation.ts');
function reset() {
  booking={id:'b',bookingNumber:101,renterId:'renter',ownerId:'owner',startDate:new Date(Date.now()+15*86400000),endDate:new Date(Date.now()+17*86400000),status:'CONFIRMED',paymentStatus:'PAID',paymentRef:'pi',paidAt:new Date(),cancelledAt:null,depositCents:0,depositStatus:'NONE',deliveryConfirmedAt:null,deliveryConfirmationStatus:'AWAITING_CONFIRMATION',ownerTransferId:null,settlementCompletedAt:null,rentSettlement:null,settlementDecision:null,settlementLegacyReview:false,depositClaim:null,renterCancellation:null,rentAmountCents:18000,platformFeeCents:2700,ownerPayoutCents:15300,owner:{email:'owner@example.test'},renter:{email:'renter@example.test'},listing:{title:'<script>Item</script>'}};
  piStatus='succeeded';refundStatus='succeeded';refundCreates=cancelledIntents=0;mails=[];failRefund=false;failMail=null;raceCancel=false;ledger=null;
}
let checks=0;async function test(name,fn){reset();await fn();checks++;console.log('PASS',name);}
(async()=>{
  await test('seven-day deadline inclusive; one millisecond late is blocked',()=>{const deadline=policy.renterCancellationDeadline(booking.startDate);assert.equal(policy.canRenterCancelBooking(booking,'renter',deadline),true);assert.equal(policy.canRenterCancelBooking(booking,'renter',new Date(+deadline+1)),false);});
  await test('only renter can cancel, owner and stranger cannot',async()=>{for(const who of ['owner','stranger'])await assert.rejects(actions.cancelBookingByRenter('b',who));assert.equal(booking.status,'CONFIRMED');assert.equal(refundCreates,0);assert.equal(mails.length,0);});
  await test('less than seven days prevents cancellation and all side effects',async()=>{booking.startDate=new Date(Date.now()+6*86400000);await assert.rejects(actions.cancelBookingByRenter('b','renter'));assert.equal(booking.status,'CONFIRMED');assert.equal(refundCreates,0);});
  await test('full payment refunded including platform commission; both emails sent',async()=>{assert.equal(await actions.cancelBookingByRenter('b','renter'),'SUCCEEDED');assert.equal(booking.status,'CANCELLED');assert.equal(booking.paymentStatus,'REFUNDED');assert.equal(booking.rentRefundedCents,18000);assert.equal(refundCreates,1);assert.equal(mails.length,2);assert(mails.every(m=>m.text.includes('100%')&&m.html.includes('&lt;script&gt;')));});
  await test('formatted paid cancellation emails explain refund to each party and escape all values',async()=>{
    booking.owner.name='<Owner>';booking.renter.name='<Renter>';
    await actions.cancelBookingByRenter('b','renter');
    for(const mail of mails){assert.match(mail.html,/Podsumowanie rezerwacji/);assert.match(mail.html,/Pełny zwrot płatności — 100%/);assert.match(mail.text,/Potrącenia: 0,00 zł/);assert.match(mail.text,/Wynagrodzenie właściciela: 0,00 zł/);assert.match(mail.text,/Sposób zwrotu: Pierwotna metoda płatności/);assert.match(mail.text,/Numer zwrotu Stripe/);assert.match(mail.html,/background:#111827/);assert.match(mail.html,/&lt;Renter&gt;/);assert(!mail.html.includes('<Renter>'));}
    assert.match(mails.find(m=>m.to==='owner@example.test').text,/nie musisz wykonywać osobnego przelewu/);
    assert.match(mails.find(m=>m.to==='renter@example.test').text,/Nie musisz prosić właściciela/);
  });
  await test('duplicate and concurrent cancellation requests do not duplicate refunds or emails',async()=>{await Promise.all([actions.cancelBookingByRenter('b','renter'),actions.cancelBookingByRenter('b','renter')]);await actions.cancelBookingByRenter('b','renter');assert.equal(refundCreates,1);assert.equal(mails.length,2);});
  await test('unpaid booking cancels existing intent without refund',async()=>{booking.status='AWAITING_PAYMENT';booking.paymentStatus='PENDING';booking.paidAt=null;piStatus='requires_payment_method';assert.equal(await actions.cancelBookingByRenter('b','renter'),'NONE');assert.equal(cancelledIntents,1);assert.equal(refundCreates,0);assert.equal(mails.length,2);assert(mails.every(m=>m.text.includes('Nie ma środków do zwrotu')));});
  await test('pending reservation with no intent can be cancelled',async()=>{booking.status='PENDING';booking.paymentStatus='PENDING';booking.paymentRef=null;booking.paidAt=null;await actions.cancelBookingByRenter('b','renter');assert.equal(refundCreates,0);assert.equal(mails.length,2);});
  await test('completed Stripe payment before webhook still receives full refund',async()=>{booking.status='AWAITING_PAYMENT';booking.paymentStatus='PENDING';booking.paidAt=null;await actions.cancelBookingByRenter('b','renter');assert.equal(booking.paymentStatus,'REFUNDED');assert.equal(refundCreates,1);});
  await test('payment completing during intent cancellation rolls back and can be safely retried',async()=>{booking.paymentStatus='PENDING';booking.paidAt=null;piStatus='requires_action';raceCancel=true;await assert.rejects(actions.cancelBookingByRenter('b','renter'));assert.equal(booking.renterCancellation,null);await actions.cancelBookingByRenter('b','renter');assert.equal(booking.paymentStatus,'REFUNDED');assert.equal(refundCreates,1);});
  await test('Stripe failure preserves cancellation and retries after deadline',async()=>{failRefund=true;assert.equal(await actions.cancelBookingByRenter('b','renter'),'PENDING');assert.equal(booking.status,'CANCELLED');booking.startDate=new Date();await actions.cancelBookingByRenter('b','renter');assert.equal(booking.paymentStatus,'REFUNDED');assert.equal(refundCreates,1);assert.equal(mails.length,2);});
  await test('pending refund is not described as refunded and reuses same refund',async()=>{refundStatus='pending';await actions.cancelBookingByRenter('b','renter');assert.equal(booking.paymentStatus,'PAID');assert.equal(booking.refundedAt,undefined);assert(mails.every(m=>m.text.includes('Zwrot jest w toku')));refundStatus='succeeded';await actions.processRenterCancellation('b');assert.equal(booking.paymentStatus,'REFUNDED');assert.equal(refundCreates,1);});
  await test('failed refund remains visible for support and does not create another charge',async()=>{refundStatus='failed';assert.equal(await actions.cancelBookingByRenter('b','renter'),'FAILED');await actions.processRenterCancellation('b');assert.equal(refundCreates,1);assert.equal(booking.paymentStatus,'PAID');});
  await test('failed email retries only unsent recipient',async()=>{failMail='renter@example.test';await actions.cancelBookingByRenter('b','renter');assert.equal(mails.length,1);await actions.processRenterCancellation('b');assert.equal(mails.length,2);assert.equal(mails.filter(m=>m.to==='owner@example.test').length,1);});
  await test('confirmed delivery, payout decision and legacy deposit cannot be cancelled',async()=>{for(const patch of [{deliveryConfirmedAt:new Date()},{deliveryConfirmationStatus:'CONFIRMED'},{rentSettlement:{}},{ownerTransferId:'tr'},{depositCents:1000,depositStatus:'PAID'}]){reset();Object.assign(booking,patch);await assert.rejects(actions.cancelBookingByRenter('b','renter'));assert.equal(refundCreates,0);}});
  console.log(`${checks} renter cancellation checks passed. No real Stripe calls, emails or database writes.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
let notificationEvents = [];
let photoRecords = [];
let b, inc, user, refunds, transfers, refundStatus, refunded, stripeCalls, operations, serial = Promise.resolve();
const tx = {
  $queryRaw: async () => [],
  booking: {
    findUniqueOrThrow: async () => structuredClone(b),
    findUnique: async () => structuredClone({ ...b, incidents: inc ? [inc] : [] }),
    update: async ({ data }) => { Object.assign(b, data); return structuredClone(b); },
  },
  incident: {
    findUnique: async () => inc ? structuredClone(inc) : null,
    findUniqueOrThrow: async () => { if (!inc) throw Error('No incident'); return structuredClone(inc); },
    create: async ({ data }) => { if (inc) throw Error('Duplicate stage'); inc = { id: 'i', acceptedAt: null, refundCents: null, proposedById: null, ...data }; return structuredClone(inc); },
    update: async ({ data }) => { Object.assign(inc, data); return structuredClone(inc); },
  },
  incidentEvidence: { create: async ({ data }) => ({ id: `e${notificationEvents.length}`, ...data }) },
  bookingEvidencePhoto: {
    findMany: async ({ where }) => photoRecords.filter(p => p.bookingId === where.bookingId && p.stage === where.stage && p.uploaderId === where.uploaderId),
    createMany: async ({ data }) => { photoRecords.push(...data); return { count: data.length }; },
  },
  settlementOperation: { findFirst: async () => operations.size ? {} : null, findUnique: async ({ where }) => operations.get(where.bookingId_kind.kind) ?? null },
  user: { findUniqueOrThrow: async () => ({ stripeAccountId: 'acct' }) },
};
const prisma = { ...tx, $transaction: fn => {
  const run = serial.then(async () => { const before = structuredClone({ b, inc, photoRecords, notificationEvents }); try { return await fn(tx); } catch (e) { b = before.b; inc = before.inc; photoRecords = before.photoRecords; notificationEvents = before.notificationEvents; throw e; } });
  serial = run.catch(() => {}); return run;
} };
class Stripe {
  constructor() { stripeCalls++; }
  paymentIntents = { retrieve: async () => ({ id: 'pi', status: 'succeeded', amount: 18000, currency: 'pln', metadata: { bookingId: 'b' }, latest_charge: { id: 'ch', disputed: false, amount_refunded: refunded } }) };
  accounts = { retrieve: async () => ({ details_submitted: true, payouts_enabled: true, capabilities: { transfers: 'active' } }) };
  refunds = { retrieve: async () => ({ id: 're', status: refundStatus, amount: inc.refundCents }) };
  charges = { retrieve: async () => ({ id: 'ch', disputed: false, amount_refunded: refunded }) };
}
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  function req(id) {
    if (id === '@/app/lib/incidentNotification') return { queueIncidentEmail: async (_tx, incident, event, actor, key, detail) => notificationEvents.push({ incident: structuredClone(incident), event, actor, key, detail }), sendPendingIncidentEmails: async () => {} };
    if (id === '@/app/lib/auth') return { getSession: async () => user ? { user: { id: user } } : null };
    if (id === '@/app/lib/prisma') return { prisma };
    if (id === 'stripe') return Stripe;
    if (id === '@prisma/client') return { Prisma: { DbNull: null } };
    if (id === 'next-auth') return { getServerSession: async () => user ? { user: { id: user } } : null };
    if (id === '@/auth.config') return { authConfig: {} };
    if (id === 'next/cache') return { revalidatePath() {} };
    if (id === '@/app/lib/bookingEvidencePhotoFiles') return { prepareBookingEvidencePhotoFiles: async files => { return files.map(() => ({ mimeType: "image/jpeg", data: new Uint8Array([1]), width: 1, height: 1 })); } };
    if (id === '@/app/lib/settlement') return { settlementOperation: async (_stripe, _bookingId, kind, params) => {
      const saved = operations.get(kind);
      if (saved) { assert.deepEqual(JSON.stringify(saved.params), JSON.stringify(params)); return { id: saved.stripeId, amount: saved.amount }; }
      if (kind === 'refund') { refunds++; if (refundStatus === 'succeeded') refunded = params.amount; } else { transfers++; assert.equal(params.source_transaction, 'ch'); }
      const operation = { stripeId: kind === 'refund' ? 're' : 'tr', amount: params.amount, params };
      operations.set(kind, operation); return { id: operation.stripeId, amount: operation.amount };
    } };
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
    throw Error(id);
  }
  vm.runInNewContext(source, { exports, require: req, Date, console: { error() {} }, process: { env: { STRIPE_SECRET_KEY: 'test' } }, FormData, File });
  cache.set(file, exports); return exports;
}
function reset() {
  b = { id: 'b', ownerId: 'owner', renterId: 'renter', status: 'CONFIRMED', paymentStatus: 'PAID', paymentRef: 'pi', cancelledAt: null, depositCents: 0, depositStatus: 'NONE', depositClaim: null, settlementDecision: null, settlementLegacyReview: false, settlementCompletedAt: null, deliveryConfirmedAt: new Date(), deliveryConfirmationStatus: 'CONFIRMED', shippingStatus: 'DELIVERED', deliveryIssue: null, returnIssue: null, returnConfirmationStatus: 'NOT_REQUESTED', returnStatus: 'PENDING', rentSettlement: null, ownerTransferId: null, owner: { stripeAccountId: 'acct' }, rentAmountCents: 18000, platformFeeCents: 2700, ownerPayoutCents: 15300, endDate: new Date('2020-01-01') };
  notificationEvents = []; photoRecords = []; inc = null; user = 'renter'; refunds = transfers = stripeCalls = refunded = 0; refundStatus = 'succeeded'; operations = new Map();
}
function form(extra) { const f = new FormData(); for (const [k, v] of Object.entries({ bookingId: 'b', incidentId: 'i', ...extra })) f.set(k, String(v)); return f; }
const policy = load('app/lib/incidentPolicy.ts');
const settle = load('app/lib/rentOnlySettlement.ts').settleRentOnlyBooking;
const actions = load('app/bookings/[id]/_actions/incidentActions.ts');
const addPhotos = load('app/bookings/[id]/_actions/addBookingEvidencePhotosAction.ts').addBookingEvidencePhotosAction;
let checks = 0;
async function test(name, fn) { reset(); await fn(); checks++; console.log('PASS', name); }
(async () => {
  await test('commission reduced proportionally with cent conservation', () => {
    for (const refund of [0, 1, 4000, 17999, 18000]) { const a = policy.rentalAmounts(18000, 2700, 15300, refund); assert.equal(a.refund + a.fee + a.payout, 18000); assert(a.payout >= 0); }
    assert.throws(() => policy.rentalAmounts(18000, 2700, 15300, 18001));
    assert.throws(() => policy.validateIncidentReason('RETURN', 'DAMAGED_ON_ARRIVAL'));
  });
  await test('receipt pays owner before return', async () => { await settle('b'); assert.equal(transfers, 1); assert.equal(b.ownerTransferCents, 15300); assert.equal(b.returnStatus, 'PENDING'); });
  await test('return dispute never blocks earned rental payout', async () => { b.returnIssue = { reason: 'DAMAGED' }; b.returnConfirmationStatus = 'DISPUTED'; await settle('b'); assert.equal(transfers, 1); });
  await test('unconfirmed receipt blocks payout', async () => { b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION'; await assert.rejects(settle('b')); assert.equal(stripeCalls, 0); });
  await test('unresolved delivery incident blocks payout', async () => { inc = { id: 'i', status: 'ESCALATED' }; await assert.rejects(settle('b')); assert.equal(stripeCalls, 0); });
  await test('full refund transfers nothing to owner', async () => { inc = { id: 'i', status: 'AGREEMENT_REACHED', acceptedAt: new Date(), refundCents: 18000 }; await settle('b'); assert.equal(refunds, 1); assert.equal(transfers, 0); assert.equal(b.paymentStatus, 'REFUNDED'); assert.equal(inc.status, 'RESOLVED'); });
  await test('partial refund reduces commission and payout', async () => { inc = { id: 'i', status: 'AGREEMENT_REACHED', acceptedAt: new Date(), refundCents: 4000 }; await settle('b'); assert.equal(b.ownerTransferCents, 11900); assert.equal(b.rentRefundedCents, 4000); });
  await test('pending refund blocks transfer and reuses same operation', async () => { inc = { id: 'i', status: 'AGREEMENT_REACHED', acceptedAt: new Date(), refundCents: 4000 }; refundStatus = 'pending'; await assert.rejects(settle('b')); assert.equal(transfers, 0); refundStatus = 'succeeded'; refunded = 4000; await settle('b'); assert.equal(refunds, 1); assert.equal(transfers, 1); });
  await test('concurrent payout requests share frozen decision and operations', async () => { await Promise.all([settle('b'), settle('b')]); assert.equal(transfers, 1); await settle('b'); assert.equal(transfers, 1); });
  await test('external refund blocks payout', async () => { refunded = 1000; await assert.rejects(settle('b')); assert.equal(transfers, 0); });
  await test('legacy deposit money is preserved', async () => { b.depositCents = 10000; b.depositStatus = 'PAID'; await assert.rejects(settle('b')); assert.equal(stripeCalls, 0); });
  await test('delivery incident cannot be opened after receipt', async () => { await assert.rejects(actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'NOT_SHIPPED', description: 'Problem' }))); assert.equal(inc, null); });
  await test('delivery reporter must be renter', async () => { user = 'owner'; b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION'; await assert.rejects(actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'NOT_SHIPPED', description: 'Problem' }))); });
  await test('opening incident and payout cannot race past receipt boundary', async () => { const result = await Promise.allSettled([settle('b'), actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'NOT_SHIPPED', description: 'Problem' }))]); assert.equal(result[1].status, 'rejected'); assert.equal(transfers, 1); });
  await test('return incident accepts zero only and requires bilateral agreement', async () => {
    user = 'owner'; await actions.openIncidentAction(form({ stage: 'RETURN', reason: 'NOT_RETURNED', description: 'Brak zwrotu' }));
    user = 'renter'; await assert.rejects(actions.incidentAction(form({ operation: 'propose', refundCents: 1000, resolution: 'Zwrot' })));
    await actions.incidentAction(form({ operation: 'propose', refundCents: 0, resolution: 'Wyjaśniono' }));
    await assert.rejects(actions.incidentAction(form({ operation: 'accept' })));
    user = 'owner'; await actions.incidentAction(form({ operation: 'accept' })); assert.equal(inc.status, 'RESOLVED'); assert.equal(refunds, 0); assert.equal(b.rentRefundedCents ?? 0, 0);
  });
  await test('delivery proposal needs other party and receipt acknowledgement', async () => {
    b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION'; await actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'NOT_SHIPPED', description: 'Problem' }));
    await assert.rejects(actions.incidentAction(form({ operation: 'propose', refundCents: 4000, resolution: 'Rabat' })));
    user = 'owner'; await actions.incidentAction(form({ operation: 'propose', refundCents: 4000, resolution: 'Rabat' }));
    await assert.rejects(actions.incidentAction(form({ operation: 'accept' })));
    user = 'renter'; await assert.rejects(actions.incidentAction(form({ operation: 'accept' })));
    await actions.incidentAction(form({ operation: 'accept', receivedAndAccepted: 'yes' })); assert.equal(inc.status, 'RESOLVED'); assert.equal(refunds, 1);
  });
  for (const reason of ['NOT_AS_DESCRIBED', 'DAMAGED_ON_ARRIVAL']) {
    await test(`${reason} requires a nonempty photo on server`, async () => {
      b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION';
      const data = form({ stage: 'DELIVERY', reason, description: 'Problem' });
      await assert.rejects(actions.openIncidentAction(data), e => e.message === policy.REQUIRED_INCIDENT_PHOTOS_MESSAGE);
      assert.equal(inc, null); assert.equal(b.deliveryIssue, null);
      data.append('photos', new File([], 'empty.jpg', { type: 'image/jpeg' }));
      await assert.rejects(actions.openIncidentAction(data), e => e.message === policy.REQUIRED_INCIDENT_PHOTOS_MESSAGE);
      assert.equal(inc, null);
      data.append('photos', new File(['mock photo'], 'photo.jpg', { type: 'image/jpeg' }));
      await actions.openIncidentAction(data);
      assert.equal(inc.reason, reason); assert.equal(b.deliveryConfirmationStatus, 'DISPUTED');
    });
  }
  await test('other incident reasons keep photos optional', () => {
    for (const [stage, reasons] of Object.entries(policy.reasonsForStage)) for (const reason of reasons) {
      assert.equal(policy.incidentRequiresPhotos(stage, reason), stage === 'DELIVERY' && ['NOT_AS_DESCRIBED', 'DAMAGED_ON_ARRIVAL'].includes(reason));
    }
  });
  await test('delivery actions follow the active party and stale proposals cannot overwrite', async () => {
    b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION';
    await actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'NOT_SHIPPED', description: 'Problem' }));
    for (const operation of ['evidence', 'escalate', 'propose']) await assert.rejects(actions.incidentAction(form({ operation, evidence: 'Komentarz', resolution: 'Propozycja', refundCents: 0 })), e => e.message === policy.INCIDENT_WAIT_MESSAGE);
    user = 'owner';
    await actions.incidentAction(form({ operation: 'evidence', evidence: 'Komentarz właściciela' }));
    await actions.incidentAction(form({ operation: 'propose', resolution: 'Pierwsza propozycja', refundCents: 1000 }));
    for (const operation of ['evidence', 'escalate', 'propose']) await assert.rejects(actions.incidentAction(form({ operation, evidence: 'Zmiana', resolution: 'Nadpisanie', refundCents: 2000 })), e => e.message === policy.INCIDENT_WAIT_MESSAGE);
    assert.equal(inc.refundCents, 1000);
    user = 'renter'; await actions.incidentAction(form({ operation: 'reject', comment: 'Proponowany rabat nie rozwiązuje problemu.' }));
    assert.equal(policy.canActOnIncident(inc, false), false); assert.equal(policy.canActOnIncident(inc, true), true);
  });
  await test('return actions follow renter then owner; closed decisions block comments', async () => {
    user = 'owner'; await actions.openIncidentAction(form({ stage: 'RETURN', reason: 'OTHER', description: 'Zwrot' }));
    await assert.rejects(actions.incidentAction(form({ operation: 'evidence', evidence: 'Komentarz' })), e => e.message === policy.INCIDENT_WAIT_MESSAGE);
    user = 'renter'; await actions.incidentAction(form({ operation: 'propose', resolution: 'Wyjaśniono', refundCents: 0 }));
    await assert.rejects(actions.incidentAction(form({ operation: 'escalate' })), e => e.message === policy.INCIDENT_WAIT_MESSAGE);
    user = 'owner'; await actions.incidentAction(form({ operation: 'accept' }));
    for (user of ['owner', 'renter']) await assert.rejects(actions.incidentAction(form({ operation: 'evidence', evidence: 'Po zamknięciu' })), e => e.message === policy.INCIDENT_WAIT_MESSAGE);
  });
  function photoForm(stage, count = 1) {
    const data = form({ stage });
    for (let i = 0; i < count; i++) data.append('photos', new File(['mock photo'], `photo-${i}.jpg`, { type: 'image/jpeg' }));
    return data;
  }
  await test('initial complaint photos lock all later uploads even when turn returns', async () => {
    b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION';
    const data = photoForm('DELIVERY'); data.set('reason', 'DAMAGED_ON_ARRIVAL'); data.set('description', 'Uszkodzenie');
    await actions.openIncidentAction(data); assert.equal(photoRecords.length, 1);
    await assert.rejects(addPhotos(photoForm('DELIVERY')));
    user = 'owner'; await actions.incidentAction(form({ operation: 'propose', resolution: 'Rabat', refundCents: 1000 }));
    user = 'renter'; await assert.rejects(addPhotos(photoForm('DELIVERY')), e => e.message === policy.INCIDENT_PHOTOS_LOCKED_MESSAGE);
    assert.equal(photoRecords.length, 1);
  });
  await test('concurrent photo batches save exactly one batch under booking lock', async () => {
    b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION';
    await actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'NOT_SHIPPED', description: 'Problem' }));
    user = 'owner'; await actions.incidentAction(form({ operation: 'propose', resolution: 'Rabat', refundCents: 1000 }));
    user = 'renter'; const result = await Promise.allSettled([addPhotos(photoForm('DELIVERY', 2)), addPhotos(photoForm('DELIVERY'))]);
    assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(photoRecords.length, 2);
  });
  await test('owner return complaint photos are also locked after one batch', async () => {
    user = 'owner'; const data = photoForm('RETURN'); data.set('reason', 'DAMAGED_ON_RETURN'); data.set('description', 'Uszkodzenie zwrotu');
    await actions.openIncidentAction(data);
    user = 'renter'; await actions.incidentAction(form({ operation: 'propose', resolution: 'Wyjaśniono', refundCents: 0 }));
    user = 'owner'; await assert.rejects(addPhotos(photoForm('RETURN')), e => e.message === policy.INCIDENT_PHOTOS_LOCKED_MESSAGE); assert.equal(photoRecords.length, 1);
  });
  await test('actions queue event snapshots and completion email only after confirmed settlement', async () => {
    b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION';
    await actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'NOT_SHIPPED', description: 'Problem' }));
    assert.equal(notificationEvents.at(-1).event, 'opened');
    user = 'owner'; await actions.incidentAction(form({ operation: 'propose', resolution: 'Rabat', refundCents: 4000 }));
    assert.equal(notificationEvents.at(-1).event, 'proposed');
    user = 'renter'; await actions.incidentAction(form({ operation: 'reject', comment: 'Proponowany rabat nie rozwiązuje problemu.' }));
    assert.equal(notificationEvents.at(-1).event, 'rejected');
    user = 'owner'; await actions.incidentAction(form({ operation: 'propose', resolution: 'Nowy rabat', refundCents: 5000 }));
    user = 'renter'; refundStatus = 'pending'; await actions.incidentAction(form({ operation: 'accept', receivedAndAccepted: 'yes' }));
    assert.equal(notificationEvents.at(-1).event, 'accepted'); assert.equal(notificationEvents.filter(e => e.event === 'resolved').length, 0);
    refundStatus = 'succeeded'; refunded = 5000; await settle('b');
    assert.equal(notificationEvents.at(-1).event, 'resolved'); assert.equal(notificationEvents.at(-1).incident.refundCents, 5000);
    await settle('b'); assert.equal(notificationEvents.filter(e => e.event === 'resolved').length, 1);
  });

  async function deliveryOffer(reason = 'NOT_AS_DESCRIBED') {
    b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION';
    const report = form({ stage: 'DELIVERY', reason, description: 'Problem' });
    if (policy.incidentRequiresPhotos('DELIVERY', reason)) report.append('photos', new File(['mock photo'], 'photo.jpg', { type: 'image/jpeg' }));
    if (reason === 'LATE_DELIVERY') { b.startDate = new Date('2020-01-01'); b.endDate = new Date('2020-01-05'); report.set('reportedDeliveryDate', '2020-01-03'); }
    await actions.openIncidentAction(report);
    user = 'owner'; await actions.incidentAction(form({ operation: 'propose', resolution: 'Rabat', refundCents: 4000 }));
    user = 'renter';
  }
  await test('rejection requires a nonblank bounded comment before changing state', async () => {
    await deliveryOffer();
    const count = notificationEvents.length;
    for (const comment of ['', '   ', 'x'.repeat(2001)]) {
      await assert.rejects(actions.incidentAction(form({ operation: 'reject', comment })));
      assert.equal(inc.status, 'AWAITING_RENTER'); assert.equal(notificationEvents.length, count);
    }
    await actions.incidentAction(form({ operation: 'reject', comment: '  Nie mogę korzystać z przedmiotu.  ' }));
    assert.equal(inc.status, 'ESCALATED');
    assert.equal(notificationEvents.at(-1).detail, 'Nie mogę korzystać z przedmiotu.');
    assert.equal(refunds, 0); assert.equal(transfers, 0);
  });
  await test('renter cancellation request requires owner acceptance and refunds exactly 100 percent', async () => {
    await deliveryOffer();
    await assert.rejects(actions.incidentAction(form({ operation: 'request_cancel', comment: '  ' })));
    await actions.incidentAction(form({ operation: 'request_cancel', comment: 'Przedmiot nie nadaje się do użycia.', refundCents: 1 }));
    assert.equal(inc.status, 'AWAITING_OWNER'); assert.equal(inc.proposedById, 'renter');
    assert.equal(inc.refundCents, 18000); assert.equal(b.status, 'CONFIRMED');
    assert.equal(refunds, 0); assert.equal(transfers, 0); assert.equal(notificationEvents.at(-1).event, 'cancellation_requested');
    await assert.rejects(actions.incidentAction(form({ operation: 'accept' })));
    await assert.rejects(actions.incidentAction(form({ operation: 'request_cancel', comment: 'Ponownie' })));
    user = 'owner'; await actions.incidentAction(form({ operation: 'accept' }));
    assert.equal(b.status, 'CANCELLED'); assert.equal(b.paymentStatus, 'REFUNDED'); assert.equal(b.rentRefundedCents, 18000);
    assert.equal(refunds, 1); assert.equal(transfers, 0); assert.equal(inc.status, 'RESOLVED');
    assert.equal(notificationEvents.at(-1).event, 'resolved');
  });
  await test('cancellation request cannot modify earned rent, legacy deposits or return incidents', async () => {
    for (const patch of [{ deliveryConfirmedAt: new Date() }, { deliveryConfirmationStatus: 'CONFIRMED' }, { rentSettlement: {} }, { ownerTransferId: 'tr' }, { settlementCompletedAt: new Date() }, { depositCents: 1000 }, { paymentStatus: 'REFUNDED' }, { status: 'CANCELLED' }]) {
      reset(); await deliveryOffer(); Object.assign(b, patch);
      await assert.rejects(actions.incidentAction(form({ operation: 'request_cancel', comment: 'Anulowanie' })));
      assert.equal(inc.status, 'AWAITING_RENTER'); assert.equal(refunds, 0);
    }
    reset(); await deliveryOffer(); inc.stage = 'RETURN';
    await assert.rejects(actions.incidentAction(form({ operation: 'request_cancel', comment: 'Anulowanie' })));
    inc.stage = 'DELIVERY'; inc.status = 'AWAITING_OWNER'; user = 'owner';
    await assert.rejects(actions.incidentAction(form({ operation: 'request_cancel', comment: 'Anulowanie' })));
  });
  await test('only the original NOT_AS_DESCRIBED report allows a cancellation request', async () => {
    for (const reason of policy.reasonsForStage.DELIVERY.filter(reason => reason !== 'NOT_AS_DESCRIBED')) {
      reset(); await deliveryOffer(reason);
      const originalResolution = inc.resolution, count = notificationEvents.length;
      await assert.rejects(actions.incidentAction(form({ operation: 'request_cancel', comment: 'Anulowanie', reason: 'NOT_AS_DESCRIBED' })));
      assert.equal(inc.reason, reason); assert.equal(inc.status, 'AWAITING_RENTER');
      assert.equal(inc.resolution, originalResolution); assert.equal(notificationEvents.length, count);
      assert.equal(refunds, 0); assert.equal(transfers, 0);
      await actions.incidentAction(form({ operation: 'accept', receivedAndAccepted: 'yes' }));
      assert.equal(inc.status, 'RESOLVED'); assert.equal(b.rentRefundedCents, 4000);
    }
  });
  await test('removed delivery reasons are rejected for new reports but return OTHER remains available', () => {
    for (const reason of ['NOT_RECEIVED', 'OTHER']) assert.throws(() => policy.validateIncidentReason('DELIVERY', reason));
    assert.equal(policy.validateIncidentReason('RETURN', 'OTHER'), 'OTHER');
  });
  await test('late delivery requires valid past receipt date after start, persisted without confirming receipt or refunding', async () => {
    b.startDate = new Date('2020-01-01'); b.endDate = new Date('2020-01-05'); b.deliveryConfirmedAt = null; b.deliveryConfirmationStatus = 'AWAITING_CONFIRMATION';
    for (const value of ['', '2020-02-30', '2020-01-01', '2019-12-31', '2099-01-03']) {
      await assert.rejects(actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'LATE_DELIVERY', description: 'Spóźnienie', reportedDeliveryDate: value })));
      assert.equal(inc, null); assert.equal(b.deliveryIssue, null);
    }
    await actions.openIncidentAction(form({ stage: 'DELIVERY', reason: 'LATE_DELIVERY', description: 'Spóźnienie', reportedDeliveryDate: '2020-01-03' }));
    assert.equal(inc.reportedDeliveryDate.toISOString(), '2020-01-03T00:00:00.000Z'); assert.equal(inc.refundCents, null);
    assert.match(notificationEvents.at(-1).detail, /3\.01\.2020/); assert.match(notificationEvents.at(-1).detail, /72,00/);
    assert.equal(b.deliveryConfirmedAt, null); assert.equal(b.deliveryConfirmationStatus, 'DISPUTED');
    await assert.rejects(settle('b')); assert.equal(refunds, 0); assert.equal(transfers, 0);
    user = 'owner'; await actions.incidentAction(form({ operation: 'propose', resolution: 'Zwrot za opóźnienie', refundCents: 7200 }));
    assert.equal(inc.status, 'AWAITING_RENTER'); assert.equal(refunds, 0);
    user = 'renter'; await actions.incidentAction(form({ operation: 'accept', receivedAndAccepted: 'yes' }));
    assert.equal(b.rentRefundedCents, 7200); assert.equal(refunds, 1); assert.equal(transfers, 1);
  });
  await test('late delivery suggestion uses inclusive calendar days and caps refunds, including DST and rounding', () => {
    const {validateLateDeliveryDate: validate} = load('app/lib/lateDelivery.ts');
    const now = new Date('2026-10-07T22:30:00Z');
    const suggestion = validate('2026-03-30', new Date('2026-03-28'), new Date('2026-04-01'), 10000, now);
    assert.equal(suggestion.totalDays, 5); assert.equal(suggestion.delayDays, 2); assert.equal(suggestion.refundCents, 4000);
    assert.equal(validate('2026-04-15', new Date('2026-03-28'), new Date('2026-04-01'), 10000, now).refundCents, 10000);
    assert.equal(validate('2026-03-29', new Date('2026-03-28'), new Date('2026-03-30'), 10000, now).refundCents, 3333);
    assert.equal(validate('2026-10-08', new Date('2026-10-07'), new Date('2026-10-10'), 10000, now).refundCents, 2500);
  });
  console.log(`${checks} rent/incident checks passed`);
})().catch(e => { console.error(e); process.exitCode = 1; });

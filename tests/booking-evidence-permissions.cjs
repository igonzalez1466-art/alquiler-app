const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'app/lib/bookingEvidence.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: exportsObject, require: () => ({ readIssue: value => value }),
});
const canUpload = exportsObject.canUploadBookingEvidence;
const booking = { ownerId: 'owner', renterId: 'renter', status: 'CONFIRMED', paymentStatus: 'PAID', settlementCompletedAt: null, shippingStatus: 'READY', shippedAt: null, deliveryConfirmationStatus: 'NOT_REQUESTED', deliveryIssue: null, returnStatus: 'READY', returnConfirmationStatus: 'NOT_REQUESTED', returnIssue: null };
for (const shippingStatus of ['PENDING', 'READY', 'SHIPPED', 'DELIVERED']) {
  for (const deliveryConfirmationStatus of ['NOT_REQUESTED', 'AWAITING_CONFIRMATION', 'DISPUTED', 'CONFIRMED']) {
    assert.equal(canUpload({ ...booking, shippingStatus, deliveryConfirmationStatus }, 'DELIVERY', 'owner'), false);
  }
}
const received = { ...booking, shippingStatus: 'SHIPPED', shippedAt: new Date(), deliveryConfirmationStatus: 'AWAITING_CONFIRMATION' };
assert.equal(canUpload(received, 'DELIVERY', 'renter'), false, 'Delivery photos require reporting a problem');
assert.equal(canUpload(booking, 'DELIVERY', 'renter'), false);
assert.equal(canUpload(received, 'DELIVERY', 'stranger'), false);
assert.equal(canUpload({ ...received, deliveryConfirmationStatus: 'CONFIRMED' }, 'DELIVERY', 'renter'), false);
assert.equal(canUpload({ ...received, deliveryConfirmationStatus: 'DISPUTED', deliveryIssue: { reportedById: 'renter', resolvedAt: null } }, 'DELIVERY', 'renter'), true);
const returnBooking = { ...received, deliveryConfirmationStatus: 'CONFIRMED', settlementCompletedAt: new Date() };
assert.equal(canUpload(returnBooking, 'RETURN', 'renter'), true);
assert.equal(canUpload({ ...returnBooking, returnStatus: 'SHIPPED' }, 'RETURN', 'renter'), false);
assert.equal(canUpload(returnBooking, 'RETURN', 'owner'), false);
assert.equal(canUpload({ ...returnBooking, returnConfirmationStatus: 'DISPUTED', returnIssue: { reportedById: 'owner', resolvedAt: null } }, 'RETURN', 'owner'), true);
assert.equal(canUpload({ ...received, paymentStatus: 'PENDING' }, 'DELIVERY', 'renter'), false);
assert.equal(canUpload({ ...returnBooking, status: 'CANCELLED' }, 'RETURN', 'renter'), false);
console.log('Booking evidence permissions passed: owner delivery blocked, recipient allowed, renter return preserved.');

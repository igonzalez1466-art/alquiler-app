const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '..');
const jsx = (type, props) => ({ type, props });
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: id => id === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : id.startsWith('@/') ? load(id.slice(2) + '.ts') : require(id), Date, Intl, Number,
  });
  return exports;
}
function text(node) { if (node === null || node === undefined || node === false) return ''; if (typeof node !== 'object') return String(node); return [node.props?.children].flat(Infinity).map(text).join(' ').replaceAll('\u00a0', ' '); }
function nodes(node, type) { if (!node || typeof node !== 'object') return []; return [...(node.type === type ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => nodes(child, type))]; }
const Agreement = load('app/bookings/[id]/_components/IncidentFinancialAgreement.tsx').default;
const props = { stage: 'DELIVERY', status: 'AGREEMENT_REACHED', acceptedAt: '2026-10-08T10:00:00Z', resolution: 'Rabat za dostawę', rentCents: 14000, refundCents: 4000, finance: { platformFeeCents: 2100, ownerPayoutCents: 11900, settlementCompleted: false } };
for (const status of ['OPEN', 'AWAITING_OWNER', 'AWAITING_RENTER', 'ESCALATED']) assert.equal(Agreement({ ...props, status }), null);
assert.equal(Agreement({ ...props, acceptedAt: null }), null);
assert.equal(Agreement({ ...props, status: 'RESOLVED', acceptedAt: null }), null);
let result = Agreement(props);
assert.match(text(result), /Uzgodnienie finansowe/);
assert.match(text(result), /Zaakceptowane przez obie strony/);
assert.deepEqual(nodes(result, 'dd').map(text), ['140,00 zł', '40,00 zł', '100,00 zł', '15,00 zł', '85,00 zł']);
assert.match(text(result), /Rozliczenie w toku/);
assert.doesNotMatch(text(result), /Rozliczenie wykonane/);
assert.match(text(result), /Rabat za dostawę/);
result = Agreement({ ...props, status: 'RESOLVED', finance: { ...props.finance, settlementCompleted: true } });
assert.match(text(result), /Rozliczenie wykonane/);
assert.match(text(result), /zależy od banku/);
result = Agreement({ ...props, refundCents: 14000 });
assert.deepEqual(nodes(result, 'dd').map(text), ['140,00 zł', '140,00 zł', '0,00 zł', '0,00 zł', '0,00 zł']);
assert.match(text(result), /Anulowanie rezerwacji i zwrot 100%/);
result = Agreement({ ...props, refundCents: 0, status: 'RESOLVED', finance: { ...props.finance, settlementCompleted: true } });
assert.deepEqual(nodes(result, 'dd').map(text), ['140,00 zł', '0,00 zł', '140,00 zł', '21,00 zł', '119,00 zł']);
assert.match(text(result), /Nie uzgodniono zwrotu/);
result = Agreement({ ...props, rentCents: 101, refundCents: 34, finance: { platformFeeCents: 15, ownerPayoutCents: 86, settlementCompleted: false } });
assert.deepEqual(nodes(result, 'dd').map(text), ['1,01 zł', '0,34 zł', '0,67 zł', '0,10 zł', '0,57 zł']);
result = Agreement({ ...props, finance: undefined });
assert.equal(nodes(result, 'dd').length, 3); // Never invent a commission for old bookings.
for (const refundCents of [null, -1, 14001, 1.5]) assert.equal(Agreement({ ...props, refundCents }), null);
result = Agreement({ ...props, stage: 'RETURN', status: 'RESOLVED' });
assert.match(text(result), /nie zmienia kwoty najmu/);
assert.equal(nodes(result, 'dd').length, 0);
assert.doesNotMatch(text(result), /Uzgodnienie finansowe/);
console.log('PASS financial agreement: bilateral acceptance only, full/partial/zero refunds, same settlement rounding, processing vs completion, legacy amounts and unchanged return finances. No database writes.');

const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), path = require('path');
const root = path.resolve(__dirname, '..'), ts = require(root + '/node_modules/typescript');
const jsx = (type, props) => ({ type, props });
function load(file, states = []) {
  const exports = {}; let i = 0;
  const requireMock = id => {
    if (id === 'react') return { useState: value => [states[i++] ?? value, () => {}] };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
    throw Error(id);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: requireMock, Date });
  return exports;
}
const rules = load('app/lib/bookingShippingBuffer.ts');
const booked = { start: '2026-11-20', end: '2026-11-23' };
assert.equal(rules.shippingRange(booked).start, '2026-11-19');
assert.equal(rules.shippingRange(booked).end, '2026-11-24');
for (const start of ['2026-11-23', '2026-11-24', '2026-11-25']) assert(rules.shippingRangesOverlap(booked, { start, end: '2026-11-28' }));
assert(!rules.shippingRangesOverlap(booked, { start: '2026-11-26', end: '2026-11-28' }));
assert(!rules.shippingRangesOverlap(booked, { start: '2026-11-15', end: '2026-11-17' }));
assert(rules.shippingRangesOverlap(booked, { start: '2026-11-15', end: '2026-11-18' }));
assert.equal(rules.shiftBookingDay('2027-01-01', -1), '2026-12-31');
assert.equal(rules.shiftBookingDay('2028-02-28', 1), '2028-02-29');
// Server query must agree with the calendar for every candidate around the booking.
for (let d = 10; d <= 28; d++) {
  const candidate = { start: '2026-11-' + d, end: '2026-11-' + d };
  const where = rules.shippingOverlapWhere(new Date(candidate.start), new Date(candidate.end));
  assert.equal(new Date(booked.start) <= where.startDate.lte && new Date(booked.end) >= where.endDate.gte, rules.shippingRangesOverlap(booked, candidate));
}
const Calendar = load('app/listing/[id]/_components/BookingCalendar.tsx').default;
function buttons(n) { if (!n || typeof n !== 'object') return []; return [...(n.type === 'button' ? [n] : []), ...[n.props?.children].flat(Infinity).flatMap(buttons)]; }
const props = { today: '2026-11-01', occupiedRanges: [], startDate: booked.start, endDate: booked.end, onChange() {} };
let days = buttons(Calendar(props));
for (const d of [19, 24]) assert(days.find(n => n.props.children === d).props.className.includes('bg-amber-200'));
for (const d of [20, 21, 22, 23]) assert(days.find(n => n.props.children === d).props.className.includes('emerald'));
days = buttons(Calendar({ ...props, occupiedRanges: [booked], startDate: '', endDate: '' }));
for (const d of [19, 20, 21, 22, 23, 24, 25]) assert(days.find(n => n.props.children === d).props.disabled);
assert(!days.find(n => n.props.children === 26).props.disabled);
console.log('PASS shipping buffer: dates, non-overlapping margins, server/calendar parity, year/leap boundaries, selected colors and disabled days. No database writes.');

const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const jsx = (type, props) => ({ type, props });
class FieldControl { constructor() { this.attributes = {}; this.focused = false; this.scrolled = false; } setAttribute(k, v) { this.attributes[k] = v; } scrollIntoView() { this.scrolled = true; } focus() { this.focused = true; } }
const cache = new Map();
let uploads = 0, created = 0, saved, transitions = [], states = [], refIndex = 0;
const react = {
  createContext: value => ({ Provider: 'Provider', value }),
  useContext: context => context.value,
  useRef: value => { refIndex++; return { current: value }; },
  useState: initial => { const slot = states.length; states.push(initial); return [initial, value => { states[slot] = value; }]; },
  useTransition: () => [false, fn => { transitions.push(fn()); }],
};
const prisma = { listing: { create: async ({ data }) => { created++; saved = data; return { id: 'new', title: data.title }; } }, user: { findUnique: async () => ({ email: null }) } };
function redirect(url) { const e = new Error(url); e.digest = 'NEXT_REDIRECT;' + url; throw e; }
class BrowserFormData extends FormData {
  constructor(form) { super(); if (form?.data) for (const [key, value] of form.data) this.append(key, value); }
}
function load(file) {
  file = file.split(path.sep).join("/");
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  function req(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react') return react;
    if (id === 'next/link') return 'Link';
    if (id === 'next/navigation') return { redirect };
    if (id === '@/app/lib/prisma') return { prisma };
    if (id === '@/app/lib/auth') return { getSession: async () => ({ user: { id: 'owner' } }) };
    if (id === '@/app/lib/mailer') return { sendMail: async () => { throw Error('Unexpected email'); } };
    if (id === '@/app/lib/listingAttributes') return load('app/lib/listingAttributes.ts');
    if (id === '@/app/components/GarmentTypeFields') return 'GarmentTypeFields';
    if (id === '@/app/lib/features') return { DEPOSITS_ENABLED: false };
    if (id === '@vercel/blob') return { put: async () => { uploads++; return { url: 'https://example.test/photo.jpg' }; } };
    if (id === 'node:crypto') return require(id);
    if (['./LocationField', './PhotosField', './ListingAttributesFields'].includes(id)) return id;
    if (id.startsWith('./')) return load(path.join(path.dirname(file), id + (['./PublishForm', './ListingFieldErrors'].includes(id) ? '.tsx' : '.ts')));
    throw Error(id);
  }
  vm.runInNewContext(code, { exports, require: req, FormData: BrowserFormData, File, HTMLElement: FieldControl, console, process: { env: {} } });
  cache.set(file, exports); return exports;
}
function find(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) { const found = find(child, type); if (found) return found; }
  return null;
}
function form(changes = {}) {
  const data = new FormData();
  const values = { title: 'Sukienka', description: 'Opis, którego nie wolno zgubić', pricePerDay: '50', minimumRentalDays: '2', marca: 'Mango', city: '', lat: '', lng: '', postalCode: '', gender: 'WOMAN', pregnancy: 'yes', color: 'CZARNY', material: 'BAWELNA', garmentType: 'VESTIDO', size: 'M', estado: 'USADO', metodoEnvio: 'RECOGIDA_LOCAL', ...changes };
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  for (let i = 0; i < 3; i++) data.append('photos', new File(['photo'], `photo${i}.jpg`, { type: 'image/jpeg' }));
  return data;
}
(async () => {
  const PublishForm = load('app/listing/new/PublishForm.tsx').default;
  const page = await load('app/listing/new/page.tsx').default({});
  const action = find(page, PublishForm).props.action;
  const location = load('app/listing/new/locationValidation.ts');
  for (const invalid of [{}, { city: 'Warszawa', lat: '', lng: '' }, { city: 'Warszawa', lat: 'NaN', lng: '21' }, { city: 'Warszawa', lat: 'Infinity', lng: '21' }, { city: 'Warszawa', lat: '91', lng: '21' }]) {
    const result = await action(form(invalid)); assert.equal(result.error, location.LOCATION_MESSAGE);
  }
  assert.equal(uploads, 0); assert.equal(created, 0);
  const data = form();
  let resets = 0, prevented = 0;
  const original = Array.from(data);
  states = []; refIndex = 0;
  const ui = PublishForm({ action, children: 'fields' });
  const element = find(ui, 'form');
  assert.equal(element.props.action, undefined, 'Validation responses must not trigger React action reset');
  const locationControl = new FieldControl();
  const dom = { data, querySelector() { return locationControl; }, reset() { resets++; } };
  element.props.onSubmit({ preventDefault() { prevented++; }, currentTarget: dom });
  element.props.onSubmit({ preventDefault() { prevented++; }, currentTarget: dom });
  assert.equal(transitions.length, 1, 'Repeated submit is blocked while pending');
  await Promise.all(transitions);
  assert.equal(states[0], location.LOCATION_MESSAGE);
  assert.equal(states[2].city, location.LOCATION_MESSAGE);
  assert.equal(locationControl.focused, true); assert.equal(locationControl.scrolled, true);
  assert.equal(locationControl.attributes["aria-describedby"], "listing-error-city");
  assert.equal(resets, 0); assert.equal(prevented, 2);
  assert.deepEqual(Array.from(data), original, 'Text, options and photo files survive validation');
  const corrected = form({ city: 'Warszawa', lat: '52.2297', lng: '21.0122', postalCode: '00-001' });
  await assert.rejects(action(corrected), e => e.digest === 'NEXT_REDIRECT;/listing?ok=1');
  assert.equal(created, 1); assert.equal(uploads, 3); assert.equal(saved.city, 'Warszawa');
  const error = await action(form({ city: 'Warszawa', lat: '52', lng: '21', pricePerDay: '-1' }));
  assert.match(error.error, /Cena za dzień/); assert.equal(created, 1);
  console.log('PASS: invalid/missing coordinates, in-place errors, preserved listing fields and photos, duplicate-submit lock, corrected location publication and other validation errors. No real uploads, emails or database writes.');
})().catch(e => { console.error(e); process.exitCode = 1; });


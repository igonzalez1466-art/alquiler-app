const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),cache={};
function load(file,mocks={}) {
  if(cache[file]) return cache[file];
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>mocks[id]??(id.startsWith('@/')?load(id.slice(2)+'.ts'):require(id)),Date,Intl,Number});
  return cache[file]=exports;
}
const {incidentTimeline,incidentState,incidentPhotoEvents}=load('app/lib/incidentCase.ts');
const {formatIncidentMoney,formatIncidentEvidenceText}=load('app/lib/incidentFormatting.ts');
assert.equal(formatIncidentMoney(6000).replaceAll('\u00a0',' '),'60,00 zł');
assert.equal(formatIncidentMoney(6001).replaceAll('\u00a0',' '),'60,01 zł');
assert.equal(formatIncidentEvidenceText('Propozycja: hkj · Zwrot najmu: 6000 gr').replaceAll('\u00a0',' '),'Propozycja: hkj · Zwrot najmu: 60,00 zł');
assert.equal(formatIncidentEvidenceText('Komentarz: 6000 gr'),'Komentarz: 6000 gr');
assert.equal(formatIncidentEvidenceText('Propozycja: opis · Zwrot najmu: 0 gr').replaceAll('\u00a0',' '),'Propozycja: opis · Zwrot najmu: 0,00 zł');
assert.equal(formatIncidentEvidenceText('Propozycja: opis · Zwrot najmu: 60,00 zł'),'Propozycja: opis · Zwrot najmu: 60,00 zł');
const date=n=>new Date(`2026-10-06T${String(n).padStart(2,'0')}:00:00Z`);
const incident={stage:'DELIVERY',status:'AWAITING_OWNER',reason:'OTHER',proposedById:'owner',createdAt:date(1),description:'Problem',resolvedAt:null,evidence:[{uploaderId:'owner',text:'Propozycja: rabat',createdAt:date(2)},{uploaderId:'renter',text:'Odrzucono propozycję',createdAt:date(3)}]};
const booking={ownerId:'owner',renterId:'renter',incidents:[incident],deliveryIssue:{reason:'OTHER',description:'Problem',reportedById:'renter',reportedAt:date(1).toISOString(),resolvedById:null,resolvedAt:null},returnIssue:null,depositClaim:null,depositCents:0};
const events=incidentTimeline(booking);
assert.equal(events.length,3); // Mirrored legacy issue must not duplicate the opening.
assert.equal(events.at(-1).title,'Dostawa · Najemca: odrzucenie propozycji');
assert.equal(events[1].detail,'Propozycja: rabat');
const legacyProposal={...incident,evidence:[{uploaderId:'owner',text:'Propozycja: hkj · Zwrot najmu: 6000 gr',createdAt:date(2)}]};
assert.equal(incidentTimeline({...booking,incidents:[legacyProposal]}).at(-1).detail.replaceAll('\u00a0',' '),'Propozycja: hkj · Zwrot najmu: 60,00 zł');
assert.equal(incidentState(booking,'owner').needsAction,true);
assert.equal(incidentState(booking,'renter').label,'Czeka na właściciela');
assert.match(incidentState({...booking,incidents:[{...incident,status:'AGREEMENT_REACHED'}]},'owner').next,/Obie strony zaakceptowały/);
const photoSet=[1,2,3].map(n=>({stage:'DELIVERY',uploaderId:'renter',createdAt:date(n)}));
let photoEvents=incidentPhotoEvents(booking,photoSet);assert.equal(photoEvents.length,1);assert.equal(photoEvents[0].title,'Najemca dodał 3 zdjęcia');assert.equal(photoEvents[0].at.getTime(),date(3).getTime());assert.equal(photoEvents[0].detail,'Dostawa');
photoEvents=incidentPhotoEvents(booking,[...photoSet,{stage:'RETURN',uploaderId:'renter',createdAt:date(4)},{stage:'RETURN',uploaderId:'owner',createdAt:date(5)}]);assert.equal(photoEvents.length,3);assert.equal(photoEvents[1].title,'Najemca dodał 1 zdjęcie');assert.equal(photoEvents[1].detail,'Zwrot');assert.equal(photoEvents[2].title,'Właściciel dodał 1 zdjęcie');assert.equal(photoSet.length,3);assert.equal(incidentPhotoEvents(booking,[]).length,0);
const cancelledCase={...incident,status:'RESOLVED',acceptedAt:date(4),resolvedAt:date(5),resolution:'Prośba o anulowanie rezerwacji i zwrot 100% najmu. Komentarz: anulacja'};
assert.equal(incidentTimeline({...booking,incidents:[cancelledCase]}).at(-1).detail,'Prośba o anulowanie rezerwacji i zwrot 100% najmu zaakceptowana');
assert.equal(incidentTimeline({...booking,incidents:[{...cancelledCase,acceptedAt:null}]}).at(-1).detail,cancelledCase.resolution);
assert.equal(incidentTimeline({...booking,incidents:[{...cancelledCase,resolution:'Inne rozwiązanie'}]}).at(-1).detail,'Inne rozwiązanie');
const trackingNumber='620999674851505432540710';
const shipmentBooking={...booking,shippedAt:date(0),carrier:'InPost',trackingNumber,incidents:[{...incident,evidence:[{uploaderId:'renter',createdAt:date(1),text:'Numer przesyłki przy zgłoszeniu: '+trackingNumber},...incident.evidence]}]};
const shipmentEvents=incidentTimeline(shipmentBooking);assert.equal(shipmentEvents[0].title,'Właściciel wysłał artykuł');assert.equal(shipmentEvents[0].detail,'Numer przesyłki InPost: '+trackingNumber);assert(!shipmentEvents.some(event=>event.detail?.startsWith('Numer przesyłki przy zgłoszeniu:')));
assert(incidentTimeline({...shipmentBooking,trackingNumber:'different'}).some(event=>event.detail==='Numer przesyłki przy zgłoszeniu: '+trackingNumber));
const handoverEvent=incidentTimeline({...shipmentBooking,carrier:'Odbiór osobisty',trackingNumber:null})[0];assert.equal(handoverEvent.title,'Właściciel przekazał artykuł');assert.equal(handoverEvent.detail,undefined);
const reasons=load('app/lib/incidentPolicy.ts').incidentReasons;
for(const [reason,label] of Object.entries(reasons)){const opening=incidentTimeline({...booking,incidents:[{...incident,reason,description:'brudny',evidence:[]}]}).find(event=>event.title==='Dostawa: otwarto zgłoszenie');assert.equal(opening.detail,'Powód: '+label+'\nOpis: brudny');}
assert.equal(incidentTimeline({...booking,incidents:[{...incident,stage:'RETURN',reason:'LATE_RETURN',description:'',evidence:[]}]}).find(event=>event.title==='Zwrot: otwarto zgłoszenie').detail,'Powód: Zwrot po terminie');
let expanded=false;
const jsx=(type,props)=>({type,props});
const Timeline=load('app/account/incidents/[id]/IncidentTimeline.tsx',{'react':{useState:()=>[expanded,fn=>{expanded=fn(expanded)}]},'react/jsx-runtime':{jsx,jsxs:jsx}}).default;
const children=node=>Array.isArray(node)?node.flatMap(children):node&&typeof node==='object'?[node,...children(node.props?.children)]:[];
const input=Array.from({length:7},(_,i)=>({at:date(i+1).toISOString(),title:'event '+(i+1)}));
let tree=children(Timeline({events:input}));
assert.equal(tree.filter(n=>n.type==='li').length,5);
assert.equal(tree.find(n=>n.type==='h3').props.children,'event 7');
const button=tree.find(n=>n.type==='button');assert.equal(button.props['aria-expanded'],false);button.props.onClick();
tree=children(Timeline({events:input}));assert.equal(tree.filter(n=>n.type==='li').length,7);
assert.equal(tree.find(n=>n.type==='button').props['aria-expanded'],true);
assert.equal(input[0].title,'event 1'); // Rendering does not mutate incoming chronology.
tree.find(n=>n.type==='button').props.onClick();
assert.equal(children(Timeline({events:input})).filter(n=>n.type==='li').length,5);
console.log('Incident timeline checks passed: modern activity, legacy deduplication, turn status, newest first, expand/collapse.');

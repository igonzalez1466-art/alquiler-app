const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),cache={};let states=[],cursor=0,saved=null;
const jsx=(type,props)=>({type,props});
function load(file){if(cache[file])return cache[file];const exports={};function req(id){
 if(id==='react/jsx-runtime')return{jsx,jsxs:jsx}; if(id==='react')return{useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]},useMemo:fn=>fn(),useCallback:fn=>fn};
 if(id==='react-dom')return{useFormStatus:()=>({pending:false})};if(id==='next/navigation')return{useRouter:()=>({push(){}})};if(id==='next/link')return{default:'Link'};
 if(id==='./ListingFieldErrors')return{ListingFieldError:'ListingFieldError'};if(id==='./BookingCalendar')return{default:'BookingCalendar'};if(id==='../actions')return{createBookingAction(){}};
 if(id==='@/app/lib/prisma')return{prisma:{listing:{create:async({data})=>{saved=data;return data}}}};
 if(id==='next-auth/next')return{getServerSession:async()=>({user:{id:'owner'}})};if(id==='@/auth.config')return{authConfig:{}};if(id==='@/app/lib/features')return{DEPOSITS_ENABLED:false};
 if(id.startsWith('@/'))return load(id.slice(2)+'.ts');return require(id);
 }vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:req,Date,Intl,console,Number});return cache[file]=exports;}
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
const text=n=>Array.isArray(n)?n.map(text).join(' '):n&&typeof n==='object'?text(n.props?.children):n==null?'':String(n);
(async()=>{
 const policy=load('app/lib/minimumRentalDays.ts');for(const n of [0,1,2,2.5,NaN,Infinity,2147483648])assert(!policy.isValidMinimumRentalDays(n));for(const n of [3,7,10])assert(policy.isValidMinimumRentalDays(n));assert.equal(policy.effectiveMinimumRentalDays(1),3);assert.equal(policy.effectiveMinimumRentalDays(7),7);
 const Selector=load('app/listing/new/MinimumRentalDaysField.tsx').default;const render=()=>{cursor=0;return nodes(Selector())};
 let tree=render();assert.equal(tree.find(n=>n.props?.name==='minimumRentalDays').props.value,'3');
 tree.find(n=>n.props?.type==='radio'&&n.props.value==='7').props.onChange();tree=render();assert.equal(tree.find(n=>n.props?.name==='minimumRentalDays').props.value,'7');
 tree.find(n=>n.props?.type==='radio'&&n.props.value==='custom').props.onChange();tree=render();let input=tree.find(n=>n.props?.name==='minimumRentalDays');assert.equal(input.props.min,3);assert(input.props.required);let validationMessage='';
 for(const [validity,message] of [[{rangeUnderflow:true},'Minimalny okres wynajmu to 3 dni.'],[{valueMissing:true},'Wpisz liczbę dni (minimum 3).'],[{stepMismatch:true},'Wpisz pełną liczbę dni (minimum 3).'],[{rangeOverflow:true},'Maksymalna liczba dni to 2147483647.']]){
  input.props.onInvalid({currentTarget:{validity,setCustomValidity:message=>{validationMessage=message}}});assert.equal(validationMessage,message);
 }
 input.props.onChange({target:{value:'10',setCustomValidity:message=>{validationMessage=message}}});assert.equal(validationMessage,'');
 tree=render();assert.equal(tree.find(n=>n.props?.name==='minimumRentalDays').props.value,'10');
 const Booking=load('app/listing/[id]/_components/BookingForm.tsx').default;
 for(const [minimum,end,blocked] of [[1,'2026-11-02',true],[3,'2026-11-03',false],[7,'2026-11-06',true],[7,'2026-11-07',false]]){
  states=['2026-11-01',end,true];cursor=0;const ui=Booking({listingId:'x',isLoggedIn:true,pricePerDay:50,minimumRentalDays:minimum,fianza:0,phoneVerified:true,occupiedRanges:[]});
  assert.equal(nodes(ui).find(n=>n.type?.name==='BookingSubmitButton').props.disabled,blocked);if(blocked)assert(text(ui).includes('Minimalny okres wynajmu'));
 }
 const POST=load('app/api/listings/route.ts').POST;const body={title:'Sukienka',pricePerDay:50,estado:'USADO',metodoEnvio:'RECOGIDA_LOCAL'};
 for(const value of [1,2,2.5,'',2147483648]){saved=null;const response=await POST({json:async()=>({...body,minimumRentalDays:value})});assert.equal(response.status,400);assert.equal(saved,null);}
 for(const value of [undefined,3,7,10]){const response=await POST({json:async()=>({...body,...(value===undefined?{}:{minimumRentalDays:value})})});assert.equal(response.status,200);assert.equal(saved.minimumRentalDays,value??3);}
 console.log('Minimum rental checks passed: choices, custom minimum, existing listing floor, booking duration validation and API enforcement.');
})().catch(e=>{console.error(e);process.exitCode=1});

const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let states=[],cursor=0,saved=null,user='owner';
const jsx=(type,props)=>({type,props});
function load(file){const exports={};function req(id){
 if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};if(id==='react')return{useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]}};
 if(id==='@/app/lib/prisma')return{prisma:{listing:{create:async({data})=>{saved=data;return data}}}};
 if(id==='next-auth/next')return{getServerSession:async()=>user?{user:{id:user}}:null};if(id==='@/auth.config')return{authConfig:{}};
 if(id.startsWith('@/'))return load(id.slice(2)+'.ts');return require(id);
 }vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:req,Date,Intl,console:{error(){}},Number});return exports;}
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
(async()=>{
 const Garment=load('app/components/GarmentTypeFields.tsx').default;
 states=[];cursor=0;let tree=nodes(Garment({garmentType:'OTRO',required:true}));let input=tree.find(n=>n.props?.name==='otherGarmentType');assert(input.props.required);assert.equal(input.props.maxLength,120);assert(!new RegExp(input.props.pattern).test('   '));assert(new RegExp(input.props.pattern).test('Kamizelka łódzka'));
 states=[];cursor=0;tree=nodes(Garment({garmentType:'OTRO',required:false}));assert(!tree.some(n=>n.props?.name==='otherGarmentType'),'Search filters must not require custom text');
 states=[];cursor=0;tree=nodes(Garment({garmentType:'ACCESORIO',accessoryType:'INNE',required:true}));assert(tree.find(n=>n.props?.name==='otherAccessoryType').props.required);
 states=[];cursor=0;tree=nodes(Garment({garmentType:'VESTIDO',required:true}));assert(!tree.some(n=>n.props?.name==='otherGarmentType'));
 const Sport=load('app/listing/new/ListingAttributesFields.tsx').default;states=['WOMAN',true,'INNY',''];cursor=0;tree=nodes(Sport({inputClassName:'input',labelClassName:'label'}));assert(tree.find(n=>n.props?.name==='otherSport').props.required);
 states=['WOMAN',false,'INNY',''];cursor=0;tree=nodes(Sport({inputClassName:'input',labelClassName:'label'}));assert(!tree.some(n=>n.props?.name==='otherSport'));
 const POST=load('app/api/listings/route.ts').POST;const body={title:'Przedmiot',pricePerDay:50,estado:'USADO',metodoEnvio:'RECOGIDA_LOCAL'};
 for(const [selection,field]of [[{garmentType:'OTRO'},'otherGarmentType'],[{garmentType:'ACCESORIO',accessoryType:'INNE'},'otherAccessoryType'],[{sport:'INNY'},'otherSport']]){
  for(const value of [undefined,'','  ','x'.repeat(121)]){saved=null;const response=await POST({json:async()=>({...body,...selection,[field]:value})});assert.equal(response.status,400);assert.equal(saved,null);}
  const response=await POST({json:async()=>({...body,...selection,[field]:'  Łyżwiarstwo / własny rodzaj  '})});assert.equal(response.status,200);assert.equal(saved[field],'Łyżwiarstwo / własny rodzaj');assert.equal(saved.userId,'owner');
 }
 await POST({json:async()=>({...body,garmentType:'VESTIDO',sport:'TENIS',otherGarmentType:'stale',otherAccessoryType:'stale',otherSport:'stale'})});for(const field of ['otherGarmentType','otherAccessoryType','otherSport'])assert.equal(saved[field],null);
 user=null;saved=null;assert.equal((await POST({json:async()=>body})).status,401);assert.equal(saved,null);
 console.log('Other listing checks passed: conditional required fields, Polish Unicode and whitespace rules, unrestricted search filters, sport toggle, API enforcement, trimmed storage, irrelevant values cleared and authorization. No database writes.');
})().catch(e=>{console.error(e);process.exitCode=1});

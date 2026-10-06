const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..'),ts=require(root+'/node_modules/typescript');
let values=[],cursor=0,effectIndex=0,lastDeps=[],queue=[];
const control={files:[],message:'',setCustomValidity(v){this.message=v},form:{addEventListener(){},removeEventListener(){}}};
const jsx=(type,props)=>({type,props});
const react={useId:()=> 'photos',useRef:()=>({current:control}),useState(initial){const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v}]},useEffect(fn,deps){const i=effectIndex++;if(!lastDeps[i]||deps.some((d,j)=>d!==lastDeps[i][j])){lastDeps[i]=deps;queue.push(fn)}}};
class Transfer{constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}}
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/app/bookings/[id]/_components/IncidentPhotoPicker.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:exportsObject,require:id=>id==='react'?react:id==='next/image'?'Image':id==='react/jsx-runtime'?{jsx,jsxs:jsx}:(()=>{throw Error(id)})(),URL:{createObjectURL:f=>'blob:'+f.name,revokeObjectURL(){}},DataTransfer:Transfer});
const Picker=exportsObject.default;
function render(props){cursor=0;effectIndex=0;const tree=Picker(props);const pending=queue;queue=[];pending.forEach(fn=>fn());if(pending.length)return render(props);return tree}
function nodes(tree,type){if(!tree||typeof tree!=='object')return [];return [...(tree.type===type?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(c=>nodes(c,type))]}
const photos=['a','b','c','d'].map(name=>new File(['image'],name+'.jpg',{type:'image/jpeg'}));
let props={required:true,disabled:false},tree=render(props);control.files=photos;nodes(tree,'input')[0].props.onChange({target:control});tree=render(props);
assert.equal(nodes(tree,'button').length,4,'All four photos remain visible for removal');assert.match(control.message,/maksymalnie 3/);
nodes(tree,'button')[3].props.onClick();tree=render(props);assert.equal(control.files.length,3);assert.equal(control.message,'');assert.equal(nodes(tree,'button').length,3);
const data=new FormData();for(const file of control.files)data.append('photos',file);assert.deepEqual(data.getAll('photos').map(f=>f.name),['a.jpg','b.jpg','c.jpg'],'Removed photo is absent from submitted file list');
while(control.files.length){nodes(tree,'button')[0].props.onClick();tree=render(props)}assert.match(control.message,/co najmniej jedno/);assert.equal(nodes(tree,'input')[0].props.required,true);
props={required:false,disabled:false};tree=render(props);control.files=[photos[0]];nodes(tree,'input')[0].props.onChange({target:control});tree=render(props);nodes(tree,'button')[0].props.onClick();tree=render(props);assert.equal(control.files.length,0);assert.equal(control.message,'');
control.files=[photos[0]];nodes(tree,'input')[0].props.onChange({target:control});props={required:false,disabled:true};tree=render(props);nodes(tree,'button')[0].props.onClick();assert.equal(control.files.length,1);assert.equal(nodes(tree,'button')[0].props.disabled,true);
console.log('PASS photo removal: excess selection corrected, submitted files synchronized, required/optional empty selection and pending upload lock. No uploads or database writes.');

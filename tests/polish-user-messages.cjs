const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let cleanup;const listeners=new Map();
class Control {constructor(validity={}){this.base=validity;this.custom='';this.type='text';this.min='3';this.max='7';this.minLength=8;this.step='1';}get validity(){return {...this.base,customError:!!this.custom};}get validationMessage(){return this.custom||'English browser message';}setCustomValidity(s){this.custom=s;}getAttribute(){return null;}}
class Input extends Control {} class Textarea extends Control {} class Select extends Control {} class Form {constructor(elements){this.elements=elements;}}
const cache={};function load(file){if(cache[file])return cache[file];const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,HTMLInputElement:Input,HTMLTextAreaElement:Textarea,HTMLSelectElement:Select,HTMLFormElement:Form,window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)}},require:id=>id==='react'?{useEffect:fn=>{cleanup=fn()}}:load(id.slice(2)+'.ts')});return cache[file]=exports;}
const {userMessage}=load('app/lib/userMessage.ts');
for(const s of ['Failed to fetch','Unauthorized','Password must have at least 8 characters.','Error de red','An error occurred in the Server Components render.'])assert.equal(userMessage(new Error(s)),'Nie udało się wykonać tej czynności. Spróbuj ponownie.');
for(const s of ['Nie można teraz przygotować płatności. Spróbuj ponownie.','Minimalny okres wynajmu to 3 dni.','Hasła nie są takie same.','Wybierz zdjęcia JPG, PNG lub WebP.'])assert.equal(userMessage(s),s);
load('app/components/PolishFormValidation.tsx').default();
const emit=(name,target)=>listeners.get(name)({target});
for(const [validity,type,expected] of [[{valueMissing:true},'text','Uzupełnij to pole.'],[{valueMissing:true},'checkbox','Zaznacz to pole, aby kontynuować.'],[{typeMismatch:true},'email','Wpisz poprawny adres e-mail.'],[{rangeUnderflow:true},'number','Wartość musi wynosić co najmniej 3.'],[{rangeOverflow:true},'number','Wartość nie może przekraczać 7.'],[{stepMismatch:true},'number','Wpisz liczbę całkowitą.'],[{tooShort:true},'password','Wpisz co najmniej 8 znaków.'],[{badInput:true},'number','Wpisz poprawną liczbę.']]){
 const input=new Input(validity);input.type=type;emit('invalid',input);assert.equal(input.validationMessage,expected);emit('input',input);assert.equal(input.custom,'');
}
const photo=new Input();photo.setCustomValidity('Dodaj co najmniej jedno zdjęcie pokazujące problem.');emit('invalid',photo);emit('change',photo);assert.equal(photo.custom,'Dodaj co najmniej jedno zdjęcie pokazujące problem.');
for(let i=0;i<2;i++){const input=new Textarea({valueMissing:true});emit('invalid',input);emit('reset',new Form([input]));assert.equal(input.custom,'');}
cleanup();assert.equal(listeners.size,0);
console.log('Polish message checks passed: browser validation, correction/reset, custom photo rules, safe external error fallback.');

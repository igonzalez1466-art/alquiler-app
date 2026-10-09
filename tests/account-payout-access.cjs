const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');let current='user1',storedAccount='acct_owner',calls=0,requested,fail=false,target='https://connect.stripe.com/express/test';
class Stripe {constructor(){this.accounts={createLoginLink:async account=>{calls++;requested=account;if(fail)throw Error('PRIVATE');return {url:target};}};}}
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'app/account/connectActions.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{
 exports:exportsObject,URL,process:{env:{STRIPE_SECRET_KEY:'sk_test_fake'}},
 require:id=>id==='stripe'?Stripe:id==='next/navigation'?{redirect:url=>{throw Object.assign(new Error('Redirect'),{redirect:url});}}:id==='@/app/lib/auth'?{getSession:async()=>current?{user:{id:current}}:null}:id==='@/app/lib/prisma'?{prisma:{user:{findUnique:async({where})=>{assert.equal(where.id,current);return storedAccount?{stripeAccountId:storedAccount}:null;}}}}:require(id),
});
const run=()=>exportsObject.openStripeConnectDashboard();
const redirected=async(url)=>assert.rejects(run,error=>error.redirect===url);
(async()=>{
 current=null;await redirected('/login?callbackUrl=/account');assert.equal(calls,0);
 current='user1';storedAccount=null;await redirected('/account#wyplaty');assert.equal(calls,0);
 storedAccount='acct_owner';await redirected(target);assert.equal(calls,1);assert.equal(requested,'acct_owner');
 fail=true;await redirected('/account?payoutError=unavailable#wyplaty');fail=false;
 for(const url of ['http://connect.stripe.com/express','https://connect.stripe.com.evil.test/','https://evil.test/','invalid']){target=url;await redirected('/account?payoutError=unavailable#wyplaty');}
 console.log('PASS payout panel: signed-in owner only, account ID from database, missing account blocked, provider errors handled without details, redirects restricted to Stripe HTTPS. No network or database writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});

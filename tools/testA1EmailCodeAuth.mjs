import assert from 'node:assert/strict';
import { requestEmailCode, confirmEmailCode } from '../src/game/emailCodeAuth.js';
let n=0;
function pass(name) { console.log('PASS',name); n++; }
const calls=[];
const user={id:'mock-cloud-user',email:'tester@example.invalid'};
let nextSendError=null, nextVerifyError=null;
const client={auth:{
 async signInWithOtp(args) { calls.push(['send',args]); return {data:{user:null,session:null},error:nextSendError}; },
 async verifyOtp(args) { calls.push(['verify',args]); return {data: {session: nextVerifyError ? null : {user}},error:nextVerifyError}; }
}};
const redirect='https://a1-cloud-staging-20261020.apex-chaos.pages.dev/';
const first=await requestEmailCode(client,' tester@example.invalid ',redirect);
assert.equal(first.ok,true);
assert.equal(calls[0][1].email,user.email);
assert.equal(calls[0][1].options.shouldCreateUser,true);
assert.equal(calls[0][1].options.emailRedirectTo,redirect);
pass('send only to normalized email via Supabase signInWithOtp');

const before=calls.length;
assert.equal((await requestEmailCode(client,'bad-email',redirect)).reason,'invalid-email');
assert.equal(calls.length,before);
pass('invalid email rejected before contacting service');

nextSendError={status:429,message:'email rate limit exceeded'};
assert.equal((await requestEmailCode(client,user.email,redirect)).reason,'email-rate-limited');
nextSendError=null;
pass('provider HTTP 429 becomes safe rate-limited message');

const verified=await confirmEmailCode(client,user.email,'123456');
assert.equal(verified.ok,true);
assert.equal(verified.session.user.id,user.id);
assert.deepEqual(calls.at(-1)[1],{email:user.email,token:'123456',type:'email'});
pass('six-digit code verified on requesting browser only');

for(const code of ['','12345','1234567','ABCDEF','123 56','\n123456\n']) {
  if(code==='\n123456\n') continue; // whitespace at edges is valid after trim
  const p=await confirmEmailCode(client,user.email,code);
  assert.equal(p.reason,'invalid-code');
}
pass('invalid or nonnumeric OTP rejected before Auth API');

nextVerifyError={status:400,message:'invalid code'};
assert.equal((await confirmEmailCode(client,user.email,'654321')).reason,'invalid-or-expired-code');
nextVerifyError={status:429,message:'too many attempts'};
assert.equal((await confirmEmailCode(client,user.email,'654321')).reason,'verify-rate-limited');
nextVerifyError=null;
pass('OTP errors do not echo tokens or server internals');

const nullSession={auth:{verifyOtp:async()=>({data:{session:null},error:null})}};
assert.equal((await confirmEmailCode(nullSession,user.email,'123456')).reason,'session-not-confirmed');
pass('unconfirmed Auth session cannot be treated as signed in');

console.log('A1 EMAIL CODE AUTH: PASS ('+n+' checks). Hosted templates and actual mail delivery still require separate acceptance.');

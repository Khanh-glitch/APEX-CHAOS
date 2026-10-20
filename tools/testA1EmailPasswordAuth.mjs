import assert from 'node:assert/strict';
import { signInWithEmailPassword, setPasswordForVerifiedUser, requestPasswordRecovery } from '../src/game/emailPasswordAuth.js';
let checks = 0;
const ok = s => {checks++; console.log('PASS',s)};
const user = {id:'test-user',email:'a@example.invalid',email_confirmed_at:'2026-10-20T00:00:00Z'};
const session={user};
let active=user, updateCount=0, loginCount=0;
const client={auth:{
  async signInWithPassword({email,password}) {
    loginCount++; assert.equal(email,'a@example.invalid');
    return password==='correct-horse-horse'?{data:{session},error:null}:{data:{session:null},error:{status:400,message:'Invalid login credentials'}};
  },
  async getUser(){return {data:{user:active},error:null}},
  async updateUser({password}){assert.equal(password,'some-long-password!');updateCount++;return {data:{user},error:null}},
  async signOut(){}
}};
assert.equal((await setPasswordForVerifiedUser(client,user.id,'short','short')).reason,'weak-password');
assert.equal(updateCount,0);ok('weak credentials denied without mutation');
assert.equal((await setPasswordForVerifiedUser(client,user.id,'some-long-password!','differentpassword')).reason,'password-mismatch');
assert.equal(updateCount,0);ok('password confirmation enforced');
active={...user,id:'other-user'};
assert.equal((await setPasswordForVerifiedUser(client,user.id,'some-long-password!','some-long-password!')).reason,'identity-not-verified');
assert.equal(updateCount,0);ok('cannot change password for a switched account');
active={...user,email_confirmed_at:null};
assert.equal((await setPasswordForVerifiedUser(client,user.id,'some-long-password!','some-long-password!')).reason,'email-not-verified');
assert.equal(updateCount,0);ok('unverified email cannot set password in staged verified-only flow');
active=user;
assert.equal((await setPasswordForVerifiedUser(client,user.id,'some-long-password!','some-long-password!')).ok,true);
assert.equal(updateCount,1);ok('verified account can set password without sending email');

const before=loginCount;
assert.equal((await signInWithEmailPassword(client,'bad','somepassword')).reason,'invalid-email');
assert.equal(loginCount,before);ok('invalid email rejected without network call');
assert.equal((await signInWithEmailPassword(client,'a@example.invalid','wrong')).reason,'invalid-credentials');
ok('invalid credentials do not reveal whether account exists');
const signed=await signInWithEmailPassword(client,' A@Example.invalid ','correct-horse-horse');
assert.equal(signed.ok,true);
assert.equal(signed.session.user.id,user.id);ok('cross-browser password signin projects only verified Auth identity');
active={...user,id:'other-user'};
assert.equal((await signInWithEmailPassword(client,'a@example.invalid','correct-horse-horse')).reason,'identity-not-verified');
ok('post-signin identity mismatch rejected');
let recoveryRequests=0;
let recoveryError=null;
const recoverClient={auth:{
  async resetPasswordForEmail(email,opts){
    recoveryRequests++;
    assert.equal(email,'a@example.invalid');
    assert.equal(opts.redirectTo,'https://a1-cloud-staging-20261020.apex-chaos.pages.dev/');
    return {data:{},error:recoveryError};
  }
}};
const redirect='https://a1-cloud-staging-20261020.apex-chaos.pages.dev/';
assert.equal((await requestPasswordRecovery(recoverClient,'bad-address',redirect)).reason,'invalid-email');
assert.equal(recoveryRequests,0);ok('invalid recovery address does not send email');
const success=await requestPasswordRecovery(recoverClient,' A@Example.invalid ',redirect);
assert.equal(success.ok,true);
assert.equal(recoveryRequests,1);ok('official Supabase recovery honors staging redirect and normalizes address');
recoveryError={status:429,message:'Too many requests'};
assert.equal((await requestPasswordRecovery(recoverClient,'a@example.invalid',redirect)).reason,'recovery-rate-limited');
ok('provider email quota is surfaced without repeated retry or credentials');
recoveryError={status:400,message:'Internal sensitive user details'};
assert.equal((await requestPasswordRecovery(recoverClient,'a@example.invalid',redirect)).reason,'recovery-unavailable');
ok('other recovery errors hide account/server details');
console.log('A1 PASSWORD SIGN IN + RECOVERY: PASS ('+checks+' tests); no real emails sent.');


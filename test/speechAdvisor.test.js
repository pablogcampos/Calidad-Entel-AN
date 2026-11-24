import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileSpeechAdvisor} from '../server/speechAdvisor.js';
import {applyUserAccessPatch} from '../server/userAccess.js';
test('pending SA links existing advisor without changing history or ambiguous identities',()=>{
 const record={id:1,source:'speech_analytic',pendingAdvisorCreation:true,assessor:'Jose   Perez',createdAt:'old'};
 const user={usuario:'Jose.Perez',rol:'asesor',clientId:'entel_b2b'};
 const linked=reconcileSpeechAdvisor(record,[],[user]);
 assert.equal(linked.advisorUser,user.usuario);assert.equal(linked.pendingAdvisorCreation,false);
 assert.equal(linked.createdAt,'old');assert.equal(record.pendingAdvisorCreation,true);
 assert.equal(reconcileSpeechAdvisor(record,[],[user,{...user,usuario:'other',nombre:'Jose Perez'}]),record);
 assert.equal(reconcileSpeechAdvisor(record,[],[{...user,clientId:'culqi_bcp'}]),record);
 assert.equal(reconcileSpeechAdvisor(record,[],[{...user,estado:'cesado'}]),record);
});
test('feedback block is an admin-only targeted boolean patch and can be removed',()=>{
 const users=[{usuario:'a',password:'untouched'},{usuario:'b'}],admin={usuario:'admin',rol:'admin'};
 const blocked=applyUserAccessPatch(users,admin,'a',{feedbacksBlocked:true});
 assert.equal(blocked.user.feedbacksBlocked,true);assert.equal(blocked.user.password,'untouched');
 assert.equal(blocked.users[1],users[1]);assert.equal(blocked.user.feedbacksBlockedBy,'admin');
 assert.equal(applyUserAccessPatch(blocked.users,admin,'a',{feedbacksBlocked:false}).user.feedbacksBlocked,false);
 assert.throws(()=>applyUserAccessPatch(users,{rol:'monitor'},'a',{feedbacksBlocked:true}));
 assert.throws(()=>applyUserAccessPatch(users,admin,'a',{feedbacksBlocked:'false'}));
});

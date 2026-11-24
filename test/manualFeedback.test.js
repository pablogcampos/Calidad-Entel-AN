import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {canSaveManualFeedback,isAutomaticFeedbackBlockedForUser} from '../server/gasHandlers.js';
test('automatic block does not block manual creation for authorized roles',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const source=html.match(/function canCreateFeedback\(user\)\{[\s\S]*?\n\}/)[0];
 const canCreate=vm.runInNewContext('('+source+')');
 for(const rol of ['admin','analista','monitor','supervisor','coordinador']){
  for(const feedbacksBlocked of [true,false]){
   const user={rol,usuario:'owner',feedbacksBlocked};
   assert.equal(canCreate(user),true);
   assert.equal(canSaveManualFeedback(user,null,'entel_b2b'),true);
   assert.equal(isAutomaticFeedbackBlockedForUser(user,[user]),feedbacksBlocked);
  }
 }
 assert.equal(canCreate({rol:'asesor',feedbacksBlocked:true}),false);
 assert.equal(canSaveManualFeedback({rol:'asesor'},null,'entel_b2b'),false);
 for(const rol of ['supervisor','coordinador']){
  assert.equal(canSaveManualFeedback({rol,usuario:'owner'}, {authorUser:'other'},'entel_b2b'),false);
  assert.equal(canSaveManualFeedback({rol,usuario:'owner'}, {authorUser:'owner'},'entel_b2b'),true);
  assert.equal(canSaveManualFeedback({rol},null,'culqi_bcp'),false);
 }
});

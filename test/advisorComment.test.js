import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {isFeedbackAdvisor} from '../server/gasHandlers.js';
test('advisor can respond only to own assigned feedback',()=>{
 const user={rol:'asesor',usuario:'Ana',nombre:'Ana Perez'};
 assert.equal(isFeedbackAdvisor({advisorUser:'ana'},user),true);
 assert.equal(isFeedbackAdvisor({advisorUser:'other',assessor:'Ana Perez'},user),false);
 assert.equal(isFeedbackAdvisor({assessor:'Ana Perez'},user),true);
 assert.equal(isFeedbackAdvisor({source:'speech_analytic',assessor:'Ana Perez'},user),false);
});
test('saving pending automatic commitment accepts once and retains draft on failure',async()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const start=html.indexOf('  const runFeedbackAction =',html.indexOf('function AdvisorPortal({currentUser,users,staffing,feedbackRecords,evaluationRecords'));
 const source=html.slice(start,html.indexOf('\n  };',start)+5);
 let sent,cleared=false;
 const context={responseDrafts:{1:'Mi compromiso'},currentUser:{usuario:'Ana',rol:'asesor'},ROL_LABEL:{},setUpdatingId:()=>{},setResponseDrafts:()=>{cleared=true;},onFeedbackUpdated:async()=>{},notify:()=>{},updateFeedbackEntry:async p=>{sent=p;}};
 const run=vm.runInNewContext(source+';runFeedbackAction',context);
 await run({id:1,automaticFromEvaluation:true,estado:'pending_feedback'},'add_message');
 assert.equal(sent.action,'submit_response_and_accept');assert.equal(sent.responseText,'Mi compromiso');assert.equal(cleared,true);
 cleared=false;context.updateFeedbackEntry=async()=>{throw Error('failed');};
 await run({id:1,automaticFromEvaluation:true,estado:'pending_feedback'},'add_message');
 assert.equal(cleared,false);
});

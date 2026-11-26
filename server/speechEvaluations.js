import {createHash} from 'node:crypto';
import {resolveSpeechAdvisor} from './speechAdvisor.js';
export {resolveSpeechAdvisor} from './speechAdvisor.js';
import {normalizeEvaluationSections,calculateEvaluationScore,applyRedistributedSectionScores,buildAutomaticFeedbackRecord,shouldCreateAutomaticFeedback,isAutomaticFeedbackBlockedForEvaluation} from './gasHandlers.js';

const norm=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// Only equivalent criteria are mapped. NV-5.2 is not evidence of system typification.
const criterionMap={'1.1':'NV-1.1','1.2':'NV-1.2','2.1':'NV-2.1','3.1':'NV-3.1','3.2':'NV-3.2','3.3':'NV-3.3','4.1':'NV-4.1','6.1':'NV-5.1','7.1':'NV-6.1','7.2':'NV-6.2'};
export const speechEvaluationId=row=>'SA-'+createHash('sha256').update('entel_b2b:no_venta:'+norm(row.file)).digest('hex').slice(0,32);


export function buildSpeechEvaluation({row,user,staffing,users,batch,now}){
  const {profile,user:advisor,pending}=resolveSpeechAdvisor(row,staffing,users);
  const pendingCriteria=[];
  const sections=normalizeEvaluationSections([],'no_venta').map(section=>{
    const code=criterionMap[section.nombreSeccion.split(' ')[0]];
    const key=code&&Object.keys(row.source).find(k=>k.startsWith(code+' ')&&!k.includes(' — '));
    const answer=norm(key&&row.source[key]);
    const result=section.pesoSub===0?'No aplica':answer==='si'?'Cumple':answer==='no'?'No cumple':['no aplica','no_aplica'].includes(answer)?'No aplica':'';
    if(section.pesoSub>0&&!result)pendingCriteria.push(section.nombreSeccion);
    const evidence=key?row.source[key+' — por qu\u00e9']||'':'';
    return {...section,resultado:result,puntaje:result==='Cumple'?section.pesoSub:result==='No cumple'?0:'',
      detalleAuditado:evidence||(!result?'Sin dato SA: requiere revision manual.':''),
      oportunidadMejora:result==='No cumple'?evidence:'',evidencia:key?row.file+' | '+key+' | minuto '+(row.source[key+' — minuto']||'no informado'):'',saCriterion:key||null};
  });
  const score=calculateEvaluationScore(sections,'no_venta');
  const zeroToleranceItems=Object.keys(row.source).filter(k=>k.startsWith('ZT-')&&!k.includes(' — ')).map(k=>({
    categoria:'Cero tolerancia SA',subItem:k,descripcion:row.source[k+' — por qu\u00e9']||'',
    resultado:norm(row.source[k])==='si'?'Cumple':'No aplica',impacto:'Cero tolerancia',evidencia:row.source[k+' — minuto']||''
  }));
  const critical=row.critical||zeroToleranceItems.some(x=>x.resultado==='Cumple');
  if(critical&&!zeroToleranceItems.some(x=>x.resultado==='Cumple'))zeroToleranceItems.push({categoria:'Cero tolerancia SA',subItem:'Deteccion SA: '+row.codes,resultado:'Cumple',descripcion:'Deteccion reportada por Speech analytic.'});
  const id=speechEvaluationId(row);
  const evaluation={id,idEvaluacion:id,clientId:'entel_b2b',platformId:'entel_b2b',clientName:'Entel Empresas B2B',
    source:'speech_analytic',saImportId:batch.id,saImportedAt:batch.createdAt,saSourceId:row.id,saSourceVersion:row.version,saSourceFile:row.file,saOriginalScore:row.score,saMappingVersion:1,
    pendingAdvisorCreation:pending,saPendingCriteria:pendingCriteria,asesorNombre:profile?.asesor||advisor?.assessorName||advisor?.nombre||row.advisor,
    asesorId:advisor?.usuario||'',advisorUser:advisor?.usuario||'',auditorId:user.usuario,auditorNombre:user.nombre||user.usuario,
    supervisor:profile?.supervisor||'',coordinador:profile?.coordinador||'',campaign:profile?.campaign||profile?.tipoGestionRuc||'',tipoGestionRuc:profile?.tipoGestionRuc||'',
    evaluationFormType:'no_venta',tipoFicha:'No venta',evaluationMode:'operacion',fechaEvaluacion:row.callDate+'T12:00:00-05:00',
    createdAt:now,updatedAt:now,estadoEvaluacion:pendingCriteria.length?'open':'closed',estadoAdjuntos:'sin_adjuntos',files:[],
    secciones:applyRedistributedSectionScores(sections,score.applicableWeight),zeroToleranceItems,appliesCeroTolerancia:critical,
    pesoAplicable:score.applicableWeight,puntajeLogrado:critical?0:score.achievedWeight,puntajeLogradoBruto:score.rawAchievedWeight,
    resultadoGeneral:critical?'0.0% - Cero tolerancia':score.text,
    detalleAuditadoGeneral:'Origen SA: '+row.file+'\n'+sections.filter(s=>s.detalleAuditado).map(s=>s.nombreSeccion+': '+s.detalleAuditado).join('\n'),
    oportunidadMejoraGeneral:sections.filter(s=>s.resultado==='No cumple').map(s=>s.nombreSeccion+': '+s.oportunidadMejora).join('\n'),
    observacionGeneral:pendingCriteria.length?'Nota PUE provisional: criterios pendientes de revision.':'Evaluacion importada desde Speech analytic.'};
  let feedback=null;
  if(shouldCreateAutomaticFeedback(evaluation,user)&&!isAutomaticFeedbackBlockedForEvaluation(evaluation,user,users)){
    feedback={...buildAutomaticFeedbackRecord({evaluation,currentUser:user,role:norm(user.rol)==='monitor'?'analista':norm(user.rol),clientId:'entel_b2b',evaluationId:id,now,id:Number.parseInt(id.slice(3,16),16)}),
      source:'speech_analytic',saImportId:batch.id,pendingAdvisorCreation:pending,files:[],messages:[]};
    evaluation.feedbackId=feedback.id;
  }
  return {evaluation,feedback};
}

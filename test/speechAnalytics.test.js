import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/speech-model.js';
const M=globalThis.SpeechModel;
const row=(id,fields={})=>({ID:id,Archivo:id+'.mp3',Asesor:'Test advisor',Version:'V2','Fecha de la llamada':'2026-10-19','Nota de la ficha (%)':75,'Puntaje obtenido':75,'Peso aplicable':100,'Cero tolerancia':'NO DETECTADA','NV-1.1 Saludo':'Si','NV-2.1 Sondeo':'No','Habilidad: cierre':'2',...fields});
test('speech validates required fields, dates, versions and numeric scores',()=>{
 assert.equal(M.parseRows([row('a')]).errors.length,0);
 for(const patch of [{ID:''},{Version:'V4'},{'Fecha de la llamada':'2026-02-30'},{'Nota de la ficha (%)':120},{'Peso aplicable':0}])assert.equal(M.parseRows([row('a',patch)]).errors.length,1);
});
test('V3 and non-applicable unscored calls are preserved without diluting scores',()=>{
 const blank={'Nota de la ficha (%)':'','Peso aplicable':'','Puntaje obtenido':''};
 const parsed=M.parseRows([row('a',{Version:'V3'}),row('b',{...blank,'Ficha no corresponde':'Si'})]);
 assert.equal(parsed.errors.length,0);assert.equal(parsed.rows[1].score,null);
 assert.equal(M.summary(parsed.rows).average,75);assert.equal(M.summary(parsed.rows).notApplicable,1);
 assert.equal(M.summary([parsed.rows[1]]).average,null);assert.equal(M.filter(parsed.rows,{max:'80'}).length,1);
 assert.equal(M.parseRows([row('c',blank)]).errors.length,1);
});
test('speech preserves source score and critical evidence independently',()=>{
 const result=M.parseRows([row('a',{'Cero tolerancia':'DETECTADA','Nota de la ficha (%)':88})]).rows[0];
 assert.equal(result.score,88);assert.equal(result.critical,true);assert.equal(result.warnings.length,1);
});
test('duplicate import is idempotent, changed source is a conflict, versions retained',()=>{
 const r=M.parseRows([row('a')]).rows;
 assert.equal(M.planImport(r,r).duplicates.length,1);
 assert.equal(M.planImport(M.parseRows([row('a',{'Nota de la ficha (%)':20})]).rows,r).conflicts.length,1);
 assert.equal(M.planImport(M.parseRows([row('a',{Version:'V1'})]).rows,r).added.length,1);
 assert.equal(M.planImport([...r,...r],[]).added.length,1);
});
test('Excel numeric timestamps and exported date strings compare as the same source',()=>{
 const timestamp='2026-10-20 15:07:37.597000';
 const serial=(Date.parse('2026-10-20T15:07:37.597Z')-Date.UTC(1899,11,30))/86400000;
 const a=M.parseRows([row('a',{Fecha:timestamp})]).rows;
 const b=M.parseRows([row('a',{Fecha:serial})]).rows;
 assert.equal(M.planImport(b,a).duplicates.length,1);
});
test('summary excludes not applicable and missing; latest version avoids double counting',()=>{
 const rows=M.parseRows([row('a'),row('b',{'NV-2.1 Sondeo':'No aplica','Habilidad: cierre':'NO_APLICA'}),row('c',{'NV-2.1 Sondeo':'','Habilidad: cierre':''}),row('a',{Version:'V1'})]).rows;
 const filtered=M.filter(rows,{});assert.equal(filtered.length,3);
 const s=M.summary(filtered);const c=s.criteria.find(c=>c.label==='NV-2.1 Sondeo');
 assert.equal(c.applicable,1);assert.equal(c.rate,100);assert.equal(c.na,1);assert.equal(c.missing,1);
 assert.equal(s.skills[0].n,1);
 assert.equal(M.filter(rows,{version:'V1'}).length,1);
 assert.equal(M.filter(rows,{from:'2026-10-20'}).length,0);
 assert.equal(M.filter(rows,{dateType:'call',from:'2026-10-19',advisor:'Test advisor'}).length,3);
});
test('load date is default, supports historical Excel dates and selects versions within period',()=>{
 const serial=(Date.UTC(2026,10,18,23,59)-Date.UTC(1899,11,30))/86400000;
 const rows=M.parseRows([row('a',{Fecha:serial}),row('a',{Fecha:'2026-11-19 01:00:00',Version:'V3'}),row('b',{Fecha:'18/11/2026 10:30'}),row('c')]).rows;
 assert.equal(M.uploadDay(rows[0]),'2026-11-18');
 assert.equal(M.filter(rows,{from:'2026-11-18'}).length,2);
 assert.equal(M.filter(rows,{from:'2026-11-18'})[0].version,'V2');
 assert.equal(M.filter(rows,{dateType:'call',from:'2026-10-19'}).length,3);
 assert.equal(M.filter(rows,{from:'2026-11-18',to:'2026-11-19',allVersions:true}).length,3);
 assert.equal(M.filter(rows,{from:'2026-11-18',to:'2026-11-19'}).length,2);
 assert.equal(M.filter(rows,{from:'2026-11-18',advisor:'Other'}).length,0);
 assert.equal(M.uploadDay({uploadDate:'invalid'}),'');
 assert.equal(M.filter(rows,{}).length,3);
});
test('Entel only; import restricted; advisors and other-client admins denied',()=>{
 assert.equal(M.canRead({rol:'admin',platformAccess:['culqi_bcp']}),false);
 assert.equal(M.canRead({rol:'asesor',platformAccess:['entel_b2b']}),false);
 assert.equal(M.canRead({rol:'supervisor',platformAccess:['entel_b2b']}),true);
 assert.equal(M.canImport({rol:'supervisor',platformAccess:['entel_b2b']}),false);
 assert.equal(M.canImport({rol:'analista',platformAccess:['entel_b2b']}),true);
});

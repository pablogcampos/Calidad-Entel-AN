const norm=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[._\s]+/g,' ');
const entel=u=>(Array.isArray(u.platformAccess)?u.platformAccess:[u.clientId||u.platformId||'entel_b2b']).includes('entel_b2b');
const active=u=>!['cesado','inactivo','inactive'].includes(norm(u.estado));
export function resolveSpeechAdvisor(row,staffing,users){
  const name=norm(row.advisor);
  if(!name)return {profile:null,user:null,pending:true};
  const matches=staffing.filter(s=>entel(s)&&norm(s.asesor)===name);
  const profile=matches.length===1?matches[0]:null;
  const candidates=users.filter(u=>entel(u)&&active(u)&&norm(u.rol)==='asesor'&&
    (profile?.usuarioAsignado?norm(u.usuario)===norm(profile.usuarioAsignado):[u.nombre,u.assessorName,u.usuario].some(v=>norm(v)===name)));
  const user=matches.length>1?null:candidates.length===1?candidates[0]:null;
  return {profile,user,pending:!user};
}
export function reconcileSpeechAdvisor(record,staffing,users){
  if(record?.source!=='speech_analytic'||!record.pendingAdvisorCreation)return record;
  const {user}=resolveSpeechAdvisor({advisor:record.asesorNombre||record.assessor},staffing,users);
  return user?{...record,pendingAdvisorCreation:false,advisorUser:user.usuario,asesorId:user.usuario}:record;
}

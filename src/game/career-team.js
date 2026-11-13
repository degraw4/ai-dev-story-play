import {eventLine,promotionReaction} from './career-copy.js';
import {DIRECTIONS,EMPLOYEES} from './content.js';
import {isNextCareer} from './career-next.js';
const check=(condition,error)=>{if(!condition)throw new Error(error);};
export const CONTRACTS=[
  {id:'report',label:'整理客户评测报告',direction:'office',ability:5,days:3,limit:8,reward:6,research:1},
  {id:'inference',label:'排查推理服务兼容',direction:'coding',ability:6,days:3,limit:8,reward:6,research:1},
  {id:'samples',label:'整理多模态回归样例',direction:'multimodal',ability:6,days:5,limit:12,reward:9,research:2},
];
export const isBalancedCareer=state=>state.campaignProfile==='career336v3';
// Ordinary contribution only: special evaluation/burst/plan/auxiliary rewards do not multiply.
export const promotionContributionPercent=(state,id)=>isBalancedCareer(state)&&staffLevel(state,id)>=2?10:0;
export const staffLevel=(state,id)=>isNextCareer(state)?state.career.levels[id]??1:1;
const available=(state,id)=>{check(state.employees.includes(id),'employee');check(!state.assignments[id],'employee-busy');check(!(state.project?.status==='planning'&&state.project.plannerId===id),'planner-studying');};
export function initializeTeam(state){if(isNextCareer(state))Object.assign(state.career,{levels:{},modelExperience:{},contracts:[],taskSeq:1});}
export function recordParticipation(state,ids,work){
  if(!isNextCareer(state))return;
  state.project.participation??={};for(const id of ids)state.project.participation[id]=(state.project.participation[id]??0)+work;
}
export function recordPublished(state,model){
  if(!isNextCareer(state))return;
  model.participation={...state.project.participation};
  for(const [id,work]of Object.entries(model.participation))if(work>=8){state.career.modelExperience[id]??=[];state.career.modelExperience[id].push(model.id);}
}
export function promotionQuote(state,id,target){
  check(isNextCareer(state),'career-next-only');available(state,id);
  const level=staffLevel(state,id),count=state.career.modelExperience[id]?.length??0;check(level<(isBalancedCareer(state)?2:3),'promotion-complete');check(count>=(level===1?2:4),'promotion-experience');
  const full=direction=>(state.employeeExperience[id][direction]>=18*120);
  if(target==='title')check(DIRECTIONS.every((_,i)=>full(i)),'promotion-target');
  else {const i=DIRECTIONS.indexOf(target);check(i>=0&&!full(i),'promotion-target');}
  return {kind:'promotion',label:level===1?'晋升资深成员':'晋升技术负责人',tier:level+1,cost:level===1?4:8,rp:level===1?12:24,days:level===1?3:5,target};
}
export function contractOffers(state){
  if(!isNextCareer(state)||!state.models.some(m=>m.company==='player')&&state.gameDay<14)return [];
  const period=Math.floor(state.gameDay/28);
  return CONTRACTS.map(item=>({...item,key:`${period}:${item.id}`,period,accepted:state.career.contracts.some(c=>c.key===`${period}:${item.id}`)}));
}
export function handleTeamAction(state,action,abilities,post){
  if(!isNextCareer(state))return false;
  const c=state.career;
  if(action.type==='startPromotion'){
    check(!c.study,'study-busy');const q=promotionQuote(state,action.employeeId,action.target);check(state.cash>=q.cost,'cash');check(c.rp>=q.rp,'research-points');
    state.cash-=q.cost;c.rp-=q.rp;c.study={...q,id:`promotion:${c.taskSeq++}`,employeeId:action.employeeId,progress:0};return true;
  }
  if(action.type==='acceptContract'){
    check(!c.study,'study-busy');available(state,action.employeeId);check(state.compute>=1,'compute');
    const offer=contractOffers(state).find(t=>t.key===action.contractId);check(offer&&!offer.accepted,'contract-unavailable');check(c.contracts.filter(t=>t.period===offer.period).length<2,'contract-quota');check(abilities(state,action.employeeId)[DIRECTIONS.indexOf(offer.direction)]>=offer.ability,'contract-ability');
    const contract={...offer,status:'running',startedDay:state.gameDay,deadline:state.gameDay+offer.limit};delete contract.accepted;c.contracts.push(contract);
    c.study={...contract,kind:'contract',id:`contract:${offer.key}`,target:offer.id,employeeId:action.employeeId,progress:0,cost:0,rp:0};return true;
  }
  if(action.type==='selectResearcher'&&c.study?.kind==='contract'){
    available(state,action.employeeId);check(abilities(state,action.employeeId)[DIRECTIONS.indexOf(c.study.direction)]>=c.study.ability,'contract-ability');c.study.employeeId=action.employeeId;return true;
  }
  if(action.type==='cancelAuxiliaryTask'){
    check(c.study,'no-study');const t=c.study;
    if(t.kind==='contract')c.contracts.find(x=>x.key===t.key).status='cancelled';
    post(state,'小满',`${t.label} 已取消。已付费用不退，未完成收益不结算。`,'office',`cancel:${t.id}:${c.taskSeq++}`);c.study=null;return true;
  }
  return false;
}
export function finishTeamTask(state,t,post){
  if(!isNextCareer(state)||!['promotion','contract'].includes(t.kind))return false;
  if(t.kind==='promotion'){
    if(t.target!=='title'){
      const i=DIRECTIONS.indexOf(t.target);state.career.caps[t.employeeId]??=[6,6,6];const cap=state.career.caps[t.employeeId];cap[i]=Math.min(18,cap[i]+2);
      state.employeeExperience[t.employeeId][i]=Math.min(cap[i]*120,state.employeeExperience[t.employeeId][i]+120);
    }
    state.career.levels[t.employeeId]=t.tier;
    post(state,EMPLOYEES[t.employeeId].name,`${t.label}完成，后续每期工资增加1万。${isBalancedCareer(state)?'本人在主线普通研发中的贡献持续增加10个百分点；方案、实验与辅助任务不加成。':''}${promotionReaction(state,t)}`,'people',t.id);
  }else{
    state.cash+=t.reward;state.career.rp+=t.research;const contract=state.career.contracts.find(x=>x.key===t.key);contract.status='completed';contract.finishedDay=state.gameDay;
    post(state,'客户',`${t.label} 已交付，支付 ${t.reward} 万，研究记录增加 ${t.research} 点。${eventLine(state,'contract',t.id)}`,'research',t.id);
  }
  return true;
}
export function expireContract(state,post){
  if(!isNextCareer(state)||state.career.study?.kind!=='contract')return;
  const t=state.career.study;
  if(state.gameDay>=t.deadline){state.career.contracts.find(x=>x.key===t.key).status='expired';state.career.study=null;post(state,'小满',`${t.label} 已逾期，未取得交付报酬。仍计入接单时周期的次数，逾期不返还。`,'office',`expired:${t.key}`);}
}

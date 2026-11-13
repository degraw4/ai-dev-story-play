import {eventLine} from './career-copy.js';
import {DIRECTIONS} from './content.js';

export const isNextCareer = state => ['career336v2','career336v3'].includes(state.campaignProfile);
const check = (condition,error) => {if(!condition)throw new Error(error);};
const own = state => state.models.filter(model=>model.company==='player');
export const ISSUE_TYPES = [
  {id:'conversation',label:'长对话格式回归'},
  {id:'tools',label:'工具调用重复请求'},
  {id:'service',label:'服务缓存兼容问题'},
];
export const unresolvedIssues = model => (model?.issues??[]).filter(issue=>!issue.resolved);
export const pendingProjectDecision = state => ['data-offer','experiment-offer'].includes(state.project?.status)&&!state.project.decisionWaiting;

export function offerData(state,employeeIds,abilities) {
  if(!isNextCareer(state)||own(state).length<1||!employeeIds.length)return;
  const p=state.project,index=DIRECTIONS.indexOf(p.focus);
  const ids=[...employeeIds].sort((a,b)=>abilities(state,b)[index]-abilities(state,a)[index]||a.localeCompare(b));
  const total=ids.reduce((n,id)=>n+abilities(state,id)[index],0);
  p.dataProposal={employeeId:ids[0],cost:Math.ceil(.15*p.standardBudget),reward:Math.max(2,Math.min(6,Math.floor(total/10))),choice:null,progress:0};
  p.status='data-offer';
}
export function prepareIssues(state) {
  if(!isNextCareer(state))return;
  const p=state.project;
  const sources=own(state).length===0?[]:['baseline',...(p.trainingPlan==='rush'?['rush']:[]),...(p.experiment?.success===false?['experiment']:[])];
  const prevented=p.dataProposal?.choice==='clean'?sources.shift()??null:null;
  const rotation=(state.career.seed%3+p.id)%3;
  p.issues=sources.map((source,i)=>({id:ISSUE_TYPES[(rotation+i)%3].id,source,resolved:false}));
  p.preventedIssue=prevented;
}
export function extraWorkSummary(state,available,speed,freeCompute) {
  const p=state.project;
  if(p.status==='data-offer')return {phaseId:'data-offer',phaseLabel:p.decisionWaiting?'等待数据决定 · 时间可继续':'等待数据决定',blockedReason:'请选择数据投入方案',estimatedDays:null};
  if(p.status==='data-work')return {phaseId:'data-work',phaseLabel:'追加数据整理',phaseProgress:p.dataProposal.progress,phaseTotal:p.dataProposal.choice==='clean'?2:4,progressPerDay:speed,usedCompute:available.length?freeCompute:0,activeEmployeeIds:available,estimatedDays:null};
  if(p.status==='issue-fix')return {phaseId:'issue-fix',phaseLabel:'上线问题验证',phaseProgress:p.issueFix.progress,phaseTotal:2,progressPerDay:speed,usedCompute:available.length?freeCompute:0,activeEmployeeIds:available,estimatedDays:null};
  return null;
}
export function progressExtraWork(state,summary,spendEnergy,post,events) {
  const p=state.project;
  if(!isNextCareer(state)||!['data-work','issue-fix','data-offer','experiment-offer'].includes(p.status))return false;
  if(!['data-work','issue-fix'].includes(p.status)||!summary.activeEmployeeIds.length)return true;
  const task=p.status==='data-work'?p.dataProposal:p.issueFix;
  const target=p.status==='data-work'?(task.choice==='clean'?2:4):2;
  const work=Math.min(target-task.progress,summary.progressPerDay);
  if(work<=0)return true;
  for(const id of summary.activeEmployeeIds)spendEnergy(state,id,work);
  task.progress+=work;
  if(task.progress!==target)return true;
  if(p.status==='data-work'){
    if(task.choice==='supplement'){
      const i=DIRECTIONS.indexOf(p.focus);p.scores[i]+=task.reward;
      if(events)for(let point=0;point<task.reward;point++)events.push({type:'research-point',projectId:p.id,workUnit:p.work,employeeId:summary.activeEmployeeIds[0],direction:p.focus,amount:1,burst:false,source:'data-supplement'});
    }
    task.completed=true;p.status='researching';
    post(state,'研发团队',task.choice==='clean'?`${p.name} 数据与回归整理完成。${eventLine(state,'clean',p.id)}`:`${p.name} 补充语料完成，主攻增加 ${task.reward} 分。${eventLine(state,'supplement',p.id)}`,'research',`data:${p.id}`);
  }else{
    p.issues.find(issue=>issue.id===task.issueId).resolved=true;p.status='ready';state.paused=true;
    post(state,'研发团队',`${p.name} 完成一项上线验证。${eventLine(state,'fix',p.id)}`,'service',`fix:${p.id}:${task.issueId}`);
    p.issueFix=null;
  }
  return true;
}
export function handleNextAction(state,action) {
  if(!isNextCareer(state))return false;
  const p=state.project,c=state.career;
  if(action.type==='resolveDataProposal'){
    check(p?.status==='data-offer','no-data-proposal');check(['skip','clean','supplement'].includes(action.choice),'data-choice');
    check(state.employees.includes(p.dataProposal.employeeId),'employee');
    const cost=action.choice==='skip'?0:action.choice==='clean'?1:p.dataProposal.cost;
    check(state.cash>=cost,'cash');state.cash-=cost;p.dataProposal.choice=action.choice;p.dataProposal.paid=cost;p.decisionWaiting=false;
    p.status=action.choice==='skip'?'researching':'data-work';return true;
  }
  if(action.type==='waitProjectDecision'||action.type==='reviewProjectDecision'){
    check(['data-offer','experiment-offer'].includes(p?.status),'no-project-decision');
    p.decisionWaiting=action.type==='waitProjectDecision';state.paused=true;return true;
  }
  if(action.type==='beginIssueFix'){
    check(p?.status==='ready','project-not-ready');check(unresolvedIssues(p).some(issue=>issue.id===action.issueId),'issue');check(state.cash>=1,'cash');
    state.cash--;p.issueFix={issueId:action.issueId,progress:0,paid:1};p.status='issue-fix';return true;
  }
  if(action.type==='startMaintenance'){
    check(!c.study,'study-busy');check(state.employees.includes(action.employeeId),'employee');check(!state.assignments[action.employeeId],'employee-busy');
    check(!(p?.status==='planning'&&p.plannerId===action.employeeId),'planner-studying');check(state.compute>=1,'compute');
    const model=own(state).find(m=>m.id===action.modelId);
    check(model&&unresolvedIssues(model).some(issue=>issue.id===action.issueId),'issue');check(state.cash>=1,'cash');state.cash--;
    c.study={id:`maintenance:${model.id}:${action.issueId}`,kind:'maintenance',target:action.issueId,modelId:model.id,employeeId:action.employeeId,progress:0,days:2,cost:1,rp:0,label:`维护 ${model.name}`};return true;
  }
  return false;
}
export function published(state,model,post) {
  if(!isNextCareer(state))return;
  const p=state.project;
  model.issues=structuredClone(p.issues);model.dataProposal=structuredClone(p.dataProposal??null);model.preventedIssue=p.preventedIssue;
  const count=unresolvedIssues(model).length;
  state.ratingTenths=Math.max(10,state.ratingTenths-count);
  if(count)post(state,'公司官号',`${model.name} 已上线。${count} 项已知问题也已上线；维护记录会在这里更新。`,'service',`issues:${model.id}`);
}
export function finishMaintenance(state,task,post) {
  const model=own(state).find(m=>m.id===task.modelId);
  model.issues.find(issue=>issue.id===task.target).resolved=true;
  post(state,'研发团队',`${model.name} 的一项服务问题已处理。仅当该型号承担订阅时，修复才会降低相应支持费；旧账不回算。${eventLine(state,'fix',task.id)}`,'service',task.id);
}
export function supportCost(state,subscription) {
  if(!isNextCareer(state)||subscription.income<=0)return 0;
  return Math.min(3,unresolvedIssues(state.models.find(m=>m.id===subscription.modelId)).length);
}
export function dismissed(state,id) {
  if(!isNextCareer(state))return;
  const p=state.project;
  if(p?.status==='data-offer'&&p.dataProposal.employeeId===id){p.dataProposal.choice='skip';p.dataProposal.invalidated=true;p.status='researching';p.decisionWaiting=false;}
}

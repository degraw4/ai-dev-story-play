import * as industry from './career-industry.js';
import * as team from './career-team.js';
import * as nextCareer from './career-next.js';
import * as career from './career.js';
import {hiringPostCopy,fundingPostCopy} from './career-copy.js';
import { DIRECTIONS, RULES, EMPLOYEES, STAGES, CAMPAIGN_PROFILES, DEFAULT_CAMPAIGN_PROFILE, mapCampaignDay, SUBSCRIPTION_INCOME } from './content.js';

const sum = values => values.reduce((total, value) => total + value, 0);
export const total = model => sum(model.scores);
function profileFor(state) {
  const profile = state.campaignProfile ?? 'classic168';
  if (!Object.hasOwn(CAMPAIGN_PROFILES,profile)) throw new Error('unknown-campaign-profile');
  return profile;
}
export function rulesFor(state) { return CAMPAIGN_PROFILES[profileFor(state)].rules; }
export function rivalsFor(state) { return CAMPAIGN_PROFILES[profileFor(state)].rivals; }
export function releasesFor(state) { return CAMPAIGN_PROFILES[profileFor(state)].releases; }
export function campaignDay(state, classicDay) { return mapCampaignDay(profileFor(state),classicDay); }
export function price(stateOrDay) {
  const state = typeof stateOrDay === 'number' ? {campaignProfile:'classic168',gameDay:stateOrDay} : stateOrDay;
  const day=state.gameDay, at=classicDay=>campaignDay(state,classicDay);
  const base=day >= at(28) && day <= at(35) ? 9 : day >= at(84) && day <= at(90) ? 16 : day >= at(140) && day <= at(147) ? 10 : 12;
  return Math.ceil(base*(rulesFor(state).computePriceMultiplier??1));
}
export function employeeTerms(state,id) {
  const employee=EMPLOYEES[id];
  return rulesFor(state).trainingBase ? {hire:Math.ceil(employee.hire*1.5),salary:employee.salary+1+team.staffLevel(state,id)-1} : {hire:employee.hire,salary:employee.salary};
}
export function trainingCost(state,plan='standard') {
  if(career.isCareer(state))return career.trainingQuote(state,plan).cost;
  const rules=rulesFor(state);
  return rules.trainingBase?Math.min(rules.trainingCap,rules.trainingBase+owned(state).length*rules.trainingStep):0;
}
export function mediaCost(state,presenter=publicationPresenter(state)) {
  const rules=rulesFor(state);
  return presenter==='alex'?(rules.mediaAlexPrice??3):(rules.mediaPrice??6);
}
export function operatingCosts(state) {
  return {salaries:sum(state.employees.map(id=>employeeTerms(state,id).salary)),running:state.compute*(rulesFor(state).computeRunningCost??1)};
}
export function mediaCampaign(state,day=(Math.floor(state.gameDay/rulesFor(state).billDays)+1)*rulesFor(state).billDays) {
  const model=state.models.findLast(model=>model.company==='player'&&model.media&&model.mediaUntilDay!==undefined);
  if(!model||day>model.mediaUntilDay||day>rulesFor(state).lastDay)return {income:0,untilDay:null,modelId:null};
  return {income:rulesFor(state).mediaIncome,untilDay:model.mediaUntilDay,modelId:model.id};
}
function initialState(profile = 'classic168') {
  const configuration=CAMPAIGN_PROFILES[profile];
  if(!configuration)throw new Error('unknown-campaign-profile');
  return { campaignProfile:profile, gameDay: 0, paused: true, cash: configuration.rules.initialCash, seats: 4, compute: 2, employees: ['avery','jules'], dismissed: [], assignments: {}, project: null, nextProjectId: 1, knowledge: DIRECTIONS.map(() => 25), models: configuration.rivals.map((rival, index) => ({ id: `initial-${index}`, company: rival.company, name: rival.models[0].name, scores: [...rival.models[0].scores], day: 0, sequence: index + 1 })), nextSequence: 6, funding: [], pendingBonus: 0, pendingNews: 0, ratingTenths: 21, appliedEvents: [], bills: [], notices: [], acceptedActions: [], growthEnabled:false, employeeExperience:Object.fromEntries(Object.keys(EMPLOYEES).map(id=>[id,DIRECTIONS.map(()=>0)])), ending: null };
}
export function createState({profile=DEFAULT_CAMPAIGN_PROFILE,burst=['budget112','startup112','career336','career336v2','career336v3'].includes(profile),subscriptionGrowth=['startup112','career336'].includes(profile),seed}={}) {
  const result=applyAction(initialState(),{type:'beginCampaign',profile,...(['career336','career336v2','career336v3'].includes(profile)?{seed:seed??globalThis.crypto.getRandomValues(new Uint32Array(1))[0]}:{})});
  if(!result.ok)throw new Error(result.error);
  let state=result.state;
  for(const type of [burst&&'enableBurst',subscriptionGrowth&&'enableSubscriptionGrowth'])if(type){
    const enabled=applyAction(state,{type});
    if(!enabled.ok)throw new Error(enabled.error);
    state=enabled.state;
  }
  return state;
}
export function employeeAbilities(state, employeeId) {
  return EMPLOYEES[employeeId].abilities.map((base,index)=>base+Math.floor((state.employeeExperience?.[employeeId]?.[index]||0)/rulesFor(state).experiencePerPoint));
}
function addExperience(state,employeeId,focus,work){
  if(!state.growthEnabled)return;
  const values=state.employeeExperience[employeeId];
  DIRECTIONS.forEach((direction,index)=>{values[index]=Math.min(rulesFor(state).experiencePerPoint*(career.isCareer(state)?state.career.caps[employeeId]?.[index]??6:rulesFor(state).maxAbilityGrowth),values[index]+work*(direction===focus?2:1));});
}
function recordGrowth(state,employeeId,before){
  const abilities=employeeAbilities(state,employeeId),gains=abilities.map((value,index)=>value-before[index]);
  if(gains.some(value=>value>0))state.notices.push({day:state.gameDay,type:'employee-growth',employeeId,gains,abilities});
}
export function board(state, direction = null) {
  const getScore = model => direction === null ? total(model) : model.scores[direction];
  const selected = new Map();
  for (const model of state.models) {
    const current = selected.get(model.company);
    if (!current || getScore(model) > getScore(current) || getScore(model) === getScore(current) && model.sequence < current.sequence) selected.set(model.company, model);
  }
  return [...selected.values()].sort((a,b) => getScore(b)-getScore(a) || a.sequence-b.sequence);
}
export function rank(state, direction = null) { const index = board(state,direction).findIndex(model => model.company === 'player'); return index < 0 ? null : index + 1; }
function owned(state) { return state.models.filter(model => model.company === 'player'); }
export function baseSubscriptionIncome(state) {
  if(career.isCareer(state))return career.careerSubscription(state).income;
  const currentRank=rank(state);if(currentRank===null)return 0;
  const rates=state.subscriptionGrowthEnabled&&state.funding.includes('overall')?SUBSCRIPTION_INCOME.established:SUBSCRIPTION_INCOME.standard;
  return rates[currentRank-1];
}
export function marketSummary(state) {
  const published=owned(state);
  if(!published.length)return {users:0,subscribers:0,weeklyIncome:0,ratingTenths:null};
  const base=baseSubscriptionIncome(state);
  const weeklyIncome=base+mediaCampaign(state).income+(career.isCareer(state)?career.socialIncome(state,base,(Math.floor(state.gameDay/7)+1)*7):0);
  const subscribers=(career.isCareer(state)?base+mediaCampaign(state).income+(state.bills.at(-1)?.socialIncome??0):weeklyIncome)*500;
  return {users:subscribers*10+published.length*1200+(rulesFor(state).trainingBase?0:published.filter(model=>model.media).length*2500),subscribers,weeklyIncome,ratingTenths:state.ratingTenths};
}
// Unlock progress only; employment, dismissed status, seats and cash are separate hire checks.
export function recruitmentStatus(state, employeeId) {
  const employee = EMPLOYEES[employeeId];
  if (!employee) return { unlocked: false, hint: '无此候选人' };
  const requirements = [];
  if (state.gameDay < employee.unlockDay) requirements.push(`第 ${employee.unlockDay} 日开放`);
  if (owned(state).length < employee.unlockPublications) requirements.push(`正式发布 ${employee.unlockPublications} 款模型后开放`);
  return { unlocked: requirements.length === 0, hint: requirements.join('，') || '已开放' };
}
function availableEmployees(state) { if(career.isCareer(state))return career.workers(state);return state.employees.filter(id => state.assignments[id]?.kind !== 'reset'); }
function teamAbilities(state,employeeIds) {
  return DIRECTIONS.map((_,index)=>sum(employeeIds.map(id=>employeeAbilities(state,id)[index])));
}
export function publicationPresenter(state) {
  const available=availableEmployees(state);
  return available.includes('alex')?'alex':available.includes(state.project?.plannerId)?state.project.plannerId:available[0]??null;
}
// A missing planner normally asks the player to choose a replacement. If no
// employee can accept that role, freezing the calendar would also freeze the
// auxiliary task/recruitment and bills needed to resolve the situation.
export function canWaitForPlanner(state) {
  return state.project?.status==='planning'&&state.project.plannerId===null&&!state.employees.some(id=>state.assignments[id]?.kind!=='reset'&&(!career.isCareer(state)||state.career.study?.employeeId!==id));
}
export function proposalScores(state) {
  const project=state.project,employee=EMPLOYEES[project?.plannerId];
  return employee?project.initialScores.map((score,index)=>score+employeeAbilities(state,project.plannerId)[index]*(DIRECTIONS[index]===project.focus?2:1)):null;
}
export function productionSummary(state) {
  const project = state.project;
  const stages=career.projectStages(state);
  const result = { phaseId:'idle', phaseLabel:'等待立项', phaseProgress:0, phaseTotal:0, totalWork:0, progressPerDay:0, usedCompute:0, activeEmployeeIds:[], teamAbilities:DIRECTIONS.map(()=>0), estimatedDays:0, blockedReason:'' };
  if (!project) return result;
  result.totalWork = project.work;
  if (project.status === 'ready') return {...result,phaseId:'ready',phaseLabel:'等待发布',phaseProgress:stages.reduce((n,item)=>n+item.work,0),phaseTotal:stages.reduce((n,item)=>n+item.work,0)};
  const available = availableEmployees(state);
  const unavailableReason=state.employees.length?'员工正在休整或处理其他任务，待有人返岗后继续':'需要至少一名可工作的员工';
  const freeCompute=state.compute-(career.isCareer(state)?career.studyCompute(state):0);
  const speed = available.length ? available.length + freeCompute + (available.includes('boris') ? 2 : 0) + (available.includes('tim') ? 1 : 0) : 0;
  if(nextCareer.isNextCareer(state)){const extra=nextCareer.extraWorkSummary(state,available,available.length?Math.min(speed,...available.map(id=>state.career.stamina[id]-20)):0,freeCompute);if(extra)return {...result,blockedReason:available.length?'':unavailableReason,...extra,teamAbilities:teamAbilities(state,extra.activeEmployeeIds??[])};}
  if (project.status === 'experiment-offer')return {...result,phaseId:'experiment-offer',phaseLabel:'等待实验决定',blockedReason:'请选择是否追加实验'};
  if (project.status === 'experiment')return {...result,phaseId:'experiment',phaseLabel:'追加实验',phaseProgress:project.experiment.progress,phaseTotal:4,progressPerDay:available.length?Math.min(speed,...available.map(id=>Math.floor((state.career.stamina[id]-20)/2))):0,usedCompute:available.length?freeCompute:0,activeEmployeeIds:available,teamAbilities:teamAbilities(state,available),estimatedDays:career.estimateCareerDays(state),blockedReason:available.length?'':unavailableReason};
  if (project.status === 'planning') {
    const plannerAvailable = available.includes(project.plannerId)&&(!career.isCareer(state)||state.career.stamina[project.plannerId]>=26);
    const blockedReason = project.plannerId === null ? canWaitForPlanner(state)?'暂无可接手的员工，研发等待；可继续时间完成辅助任务或等待招聘':'请重新选择方案负责人' : !plannerAvailable ? '方案负责人正在处理其他任务或休整' : '';
    return {...result,phaseId:'planning',phaseLabel:'设计方案',phaseProgress:project.planProgress,phaseTotal:rulesFor(state).planningDays,progressPerDay:plannerAvailable ? 1 : 0,activeEmployeeIds:plannerAvailable ? [project.plannerId] : [],estimatedDays:career.isCareer(state)?career.estimateCareerDays(state):plannerAvailable && speed ? rulesFor(state).planningDays-project.planProgress+stages.reduce((days,stage)=>days+Math.ceil(stage.work/speed),0) : null,blockedReason};
  }
  const stage = career.projectStages(state)[project.stageIndex];
  const dailySpeed=career.isCareer(state)&&available.length?Math.min(speed,...available.map(id=>state.career.stamina[id]-20)):speed;
  return {...result,phaseId:stage.id,phaseLabel:stage.label,phaseProgress:project.stageWork,phaseTotal:stage.work,progressPerDay:dailySpeed,usedCompute:available.length ? freeCompute : 0,activeEmployeeIds:available,teamAbilities:teamAbilities(state,available),estimatedDays:career.isCareer(state)?career.estimateCareerDays(state):speed ? Math.ceil((stage.work-project.stageWork)/speed)+stages.slice(project.stageIndex+1).reduce((days,next)=>days+Math.ceil(next.work/speed),0) : null,blockedReason:available.length ? '' : unavailableReason};
}
export function employeeActivity(state, employeeId) {
  let kind = 'idle', label = '等待项目';
  if (state.employees.includes(employeeId)) {
    if(career.isCareer(state)&&state.career.resting[employeeId]){kind='rest';label='休整恢复';}
    else if(career.isCareer(state)&&state.career.study?.employeeId===employeeId){kind='study';label=state.career.study.label;}
    else if (state.assignments[employeeId]?.kind === 'reset') { kind = 'reset'; label = '重置额度'; }
    else if (state.project?.status === 'planning' && state.project.plannerId === employeeId) { kind = 'planning'; label = '设计方案'; }
    else if (['data-work','issue-fix'].includes(state.project?.status)){kind='research';label=state.project.status==='data-work'?'数据整理':'上线验证';}
    else if (state.project?.status === 'experiment'){kind='research';label='追加实验';}
    else if (state.project?.status === 'researching') { kind = 'research'; label = STAGES[state.project.stageIndex].label; }
  }
  return {kind,label,active:kind !== 'idle' && !state.paused && !state.ending};
}
export function quotaResetStatus(state) {
  const reason=state.ending?'game-ended':!state.employees.includes('rebo')?'rebo':career.isCareer(state)&&state.career.study?.employeeId==='rebo'?'employee-busy':!owned(state).length?'no-users':state.ratingTenths>=50?'rating-full':state.assignments.rebo?.kind==='reset'?'reset-running':state.cash<4?'cash':null;
  const energy=state.career?.stamina.rebo??100,target=state.career?.resting.rebo??(energy<26?60:energy);
  return {available:reason===null,reason,cost:4,finishDay:career.isCareer(state)?state.gameDay+Math.max(0,Math.ceil((target-energy)/20))+1:state.assignments.rebo?.finishDay??state.gameDay+1,ratingAfter:Math.min(50,state.ratingTenths+5)};
}
export function usedCompute(state) { return productionSummary(state).usedCompute+(career.isCareer(state)?career.studyCompute(state):0); }
function progressProject(state,presentationEvents) {
  const project = state.project;
  if (!project || project.status === 'ready') return;
  const summary = productionSummary(state);
  if (!summary.activeEmployeeIds.length) return;
  if(nextCareer.progressExtraWork(state,summary,career.spendEnergy,career.post,presentationEvents))return;
  if(career.isCareer(state)&&project.status==='experiment'){career.progressExperiment(state,summary,presentationEvents);return;}
  if (project.status === 'planning') {
    project.planProgress++;
    if(career.isCareer(state))career.spendEnergy(state,project.plannerId,6);
    state.notices.push({day:state.gameDay,type:'planning',employeeId:project.plannerId,projectId:project.id,progress:project.planProgress});
    if (project.planProgress === rulesFor(state).planningDays) {
      project.planScores = proposalScores(state);
      project.scores = [...project.planScores]; project.status = 'researching';
      state.notices.push({day:state.gameDay,type:'plan-ready',employeeId:project.plannerId,projectId:project.id,scores:[...project.planScores]});
      const before=employeeAbilities(state,project.plannerId);addExperience(state,project.plannerId,project.focus,4);recordGrowth(state,project.plannerId,before);
    }
    return;
  }
  const stage = career.projectStages(state)[project.stageIndex];
  const work = Math.min(summary.progressPerDay,stage.work-project.stageWork);
  const gains=DIRECTIONS.map(()=>0);
  const previousAbilities=Object.fromEntries(summary.activeEmployeeIds.map(id=>[id,employeeAbilities(state,id)]));
  // Unit work, rather than frame/day batching, owns both experience and score.
  // Thus buying compute cannot change the result merely by grouping days.
  for(let unit=0;unit<work;unit++){
    const workUnit=project.work+unit;
    const burst=project.burst;
    if(burst&&workUnit===burst.startWork&&burst.employeeId===null){
      burst.employeeId=summary.activeEmployeeIds[(project.id-1)%summary.activeEmployeeIds.length];
    }
    const burstActive=!!burst&&workUnit>=burst.startWork&&workUnit<burst.endWork&&summary.activeEmployeeIds.includes(burst.employeeId);
    DIRECTIONS.forEach((direction,index)=>{
      // The employee who completes a shared score unit submits its point.
      // Rotate contribution order by absolute work, never by calendar day.
      const offset=(project.id+workUnit+index)%summary.activeEmployeeIds.length;
      for(let step=0;step<summary.activeEmployeeIds.length;step++){
        const employeeId=summary.activeEmployeeIds[(offset+step)%summary.activeEmployeeIds.length];
        let ability=employeeAbilities(state,employeeId)[index];
        if(stage.id==='evaluation'&&direction===project.focus&&employeeId==='max')ability+=4;
        const multiplier=career.isCareer(state)?100+(stage.id==='data'?project.methodSnapshot.data*5:0):1;
        const divisor=rulesFor(state).scoreDivisor*(career.isCareer(state)?100:1);
        const promotionExtra=employeeAbilities(state,employeeId)[index]*(direction===project.focus?2:1)*team.promotionContributionPercent(state,employeeId);
        const numerator=project.scoreRemainders[index]+ability*(direction===project.focus?2:1)*multiplier+promotionExtra;
        const gain=Math.floor(numerator/divisor);
        project.scoreRemainders[index]=numerator%divisor;
        project.scores[index]+=gain;gains[index]+=gain;
        if(presentationEvents)for(let point=0;point<gain;point++)presentationEvents.push({type:'research-point',projectId:project.id,workUnit,employeeId,direction,amount:1,burst:burstActive&&employeeId===burst.employeeId,source:'research'});
      }
    });
    if(burstActive&&burst.earned<4){
      const index=DIRECTIONS.indexOf(project.focus);
      project.scores[index]++;gains[index]++;burst.earned++;
      if(presentationEvents)presentationEvents.push({type:'research-point',projectId:project.id,workUnit,employeeId:burst.employeeId,direction:project.focus,amount:1,burst:true,source:'burst'});
    }
    for(const id of summary.activeEmployeeIds)addExperience(state,id,project.focus,1);
  }
  for(const id of summary.activeEmployeeIds)recordGrowth(state,id,previousAbilities[id]);
  if(career.isCareer(state)){for(const id of summary.activeEmployeeIds)career.spendEnergy(state,id,work);if(stage.id==='evaluation')state.career.rp+=work;}
  team.recordParticipation(state,summary.activeEmployeeIds,work);
  project.work += work; project.stageWork += work;
  state.notices.push({day:state.gameDay,type:'research',projectId:project.id,focus:project.focus,stageId:stage.id,employeeIds:[...summary.activeEmployeeIds],work,gains,compute:summary.usedCompute});
  if (project.stageWork === stage.work) {
    state.notices.push({day:state.gameDay,type:'stage-complete',projectId:project.id,stageId:stage.id});
    project.stageIndex++; project.stageWork = 0;
    if(stage.id==='data')nextCareer.offerData(state,summary.activeEmployeeIds,employeeAbilities);
    if(career.isCareer(state)&&stage.id==='pretraining')career.offerExperiment(state,employeeAbilities);
    if (project.stageIndex === STAGES.length) {
      if(career.isCareer(state))career.finishLearning(state,project,presentationEvents);
      nextCareer.prepareIssues(state);
      project.status = 'ready'; state.paused = true;
      state.notices.push({day:state.gameDay,type:'ready',projectId:project.id});
    }
  }
}
function grantFunding(state) {
  const published=owned(state),rules=rulesFor(state);
  const eligible = [ ['seed', published.some(model => total(model) >= rules.seedScore), 40], ['specialist', DIRECTIONS.some((_,index) => rank(state,index) === 1), 80], ['overall', rank(state) === 1, 160] ];
  for (const [id, condition, amount] of eligible) if (condition && published.length>=(rules.fundingPublications?.[id]??0) && !state.funding.includes(id)) {
    state.funding.push(id);state.cash+=amount;
    state.notices.push({day:state.gameDay,type:'funding',id,amount});
    if(career.isCareer(state))career.post(state,'公司官号',fundingPostCopy(id,amount),'office',`funding:${id}`);
  }
}
function endIfNeeded(state) {
  if (state.cash < 0) state.ending = '发布会照常';
  else if (state.gameDay === rulesFor(state).lastDay) state.ending = (career.isCareer(state)?state.career.finalRank:rank(state)) === 1 ? '榜单常青树' : state.funding.length >= 2 && state.cash >= rulesFor(state).capitalCash ? '融资永动机' : '明年一定第一';
  if (state.ending) state.paused = true;
}
function advanceDay(state,presentationEvents) {
  state.gameDay += 1;
  if(career.isCareer(state))career.beginCareerDay(state,releasesFor(state),rank(state));
  progressProject(state,presentationEvents);
  if(career.isCareer(state))career.finishCareerTasks(state);
  for (const [id,task] of Object.entries(state.assignments)) if (!career.isCareer(state)&&task.kind === 'reset' && task.finishDay === state.gameDay) {
    state.ratingTenths = Math.min(50,state.ratingTenths+5); delete state.assignments[id];
    state.notices.push({ day: state.gameDay, type: 'reset-complete', employeeId: id, ratingTenths: state.ratingTenths });
  }
  for (const release of releasesFor(state).filter(release => release.day === state.gameDay)) {
    state.models.push(career.isCareer(state)?career.rivalPublished(state,release,state.nextSequence++):{ ...release, scores: [...release.scores], sequence: state.nextSequence++ }); state.appliedEvents.push(release.id);
  }
  for (const event of [{ id:'N02', day:campaignDay(state,10), amount:4 },{ id:'N05', day:campaignDay(state,98), amount:-4 }]) if (event.day === state.gameDay) {
    if (owned(state).length) state.pendingNews += event.amount;
    state.appliedEvents.push(event.id);
  }
  grantFunding(state);
  if (state.gameDay % rulesFor(state).billDays === 0) {
    const currentRank = rank(state);
    const base = baseSubscriptionIncome(state);
    const mediaIncome=mediaCampaign(state,state.gameDay).income;
    const socialIncome=career.isCareer(state)?career.socialIncome(state,base,state.gameDay,true):0;
    const income = Math.max(0,base+mediaIncome+socialIncome+state.pendingBonus+state.pendingNews);
    const {salaries,running}=operatingCosts(state);
    const support=nextCareer.supportCost(state,career.isCareer(state)?career.careerSubscription(state):{});
    state.cash += income-salaries-running-support;
    state.bills.push({ day: state.gameDay, rank: currentRank, base, ...(career.isCareer(state)?{socialIncome,subscriptionSource:career.careerSubscription(state)}:{}), ...(rulesFor(state).trainingBase?{mediaIncome}:{}), bonus: state.pendingBonus, news: state.pendingNews, income, salaries, running, ...(nextCareer.isNextCareer(state)?{support}:{}), cash: state.cash });
    state.pendingBonus = 0; state.pendingNews = 0;
  }
  industry.rememberRanking(state,board(state));
  industry.awardIndustry(state,career.post);
  if(nextCareer.isNextCareer(state)){if([112,224].includes(state.gameDay))state.career.assessmentSnapshot={rank:rank(state),modelCount:owned(state).length};if(state.gameDay===336)state.career.finalRank=rank(state);}
  endIfNeeded(state);
  if(career.isCareer(state)){career.assessCareer(state,rank(state));if((state.project?.status==='experiment-offer'&&!state.project.decisionWaiting)||nextCareer.pendingProjectDecision(state))state.paused=true;}
}
function validate(condition, message) { if (!condition) throw new Error(message); }
function executeAction(original, action, recordHistory) {
  const state = structuredClone(original);
  const presentationEvents=recordHistory?[]:null;
  try {
    validate(!state.ending,'game-ended');
    action = canonicalAction(action);
    validate(!recordHistory || state.acceptedActions.length < rulesFor(state).maxAcceptedActions,'history-full');
    // Tighten newly requested actions without invalidating an older save whose
    // historical reducer accepted a personal-task transfer or busy presenter.
    if(recordHistory&&career.isCareer(state)){
      if(action.type==='selectResearcher'&&['course','promotion'].includes(state.career.study?.kind))validate(action.employeeId===state.career.study.employeeId,'personal-task');
      if(action.type==='publish'&&action.presenter!==undefined&&state.employees.includes(action.presenter))validate(availableEmployees(state).includes(action.presenter),'presenter-busy');
    }
    if (action.type === 'beginCampaign') { validate(state.acceptedActions.length===0 && state.gameDay===0 && !state.growthEnabled,'campaign-already-started');validate(Object.hasOwn(CAMPAIGN_PROFILES,action.profile),'unknown-campaign-profile');validate(['career336','career336v2','career336v3'].includes(action.profile)||action.seed===undefined,'career-only');Object.assign(state,initialState(action.profile));state.growthEnabled=true;if(career.isCareer(state)){validate(Number.isSafeInteger(action.seed)&&action.seed>=0&&action.seed<=0xffffffff,'seed');career.initializeCareer(state,action.seed);} }
    else if (team.handleTeamAction(state,action,employeeAbilities,career.post)) {}
    else if (career.isCareer(state)&&career.handleCareerAction(state,action)) {}
    else if (action.type === 'enableSubscriptionGrowth') {validate(!!rulesFor(state).trainingBase,'subscription-growth-unavailable');validate(!state.subscriptionGrowthEnabled,'subscription-growth-already-enabled');state.subscriptionGrowthEnabled=true;}
    else if (action.type === 'enableBurst') {validate(!state.burstEnabled,'burst-already-enabled');state.burstEnabled=true;}
    else if (action.type === 'enableGrowth') {validate(!state.growthEnabled,'growth-already-enabled');state.growthEnabled=true;}
    else if (action.type === 'resume') { if(career.isCareer(state)){validate(!state.career.assessment,'assessment-pending');validate(!(state.project?.status==='experiment-offer'&&!state.project.decisionWaiting),'experiment-pending');validate(!nextCareer.pendingProjectDecision(state),'project-decision-pending');}validate(!(state.project?.status === 'planning' && state.project.plannerId === null)||canWaitForPlanner(state),'planner-required'); state.paused = false; }
    else if (action.type === 'pause') state.paused = true;
    else if (action.type === 'expand') { validate(state.seats === 4,'already-expanded'); validate(state.cash >= rulesFor(state).expansionCost,'cash'); state.cash -= rulesFor(state).expansionCost; state.seats = 8; }
    else if (action.type === 'hire') { const employee = EMPLOYEES[action.employeeId]; validate(employee && employee.hire > 0,'candidate'); validate(!state.employees.includes(action.employeeId) && !state.dismissed.includes(action.employeeId),'unavailable'); validate(recruitmentStatus(state,action.employeeId).unlocked,'candidate-locked'); validate(state.employees.length < state.seats,'seats'); validate(state.cash >= employeeTerms(state,action.employeeId).hire,'cash'); state.cash -= employeeTerms(state,action.employeeId).hire; state.employees.push(action.employeeId);if(career.isCareer(state)){state.career.stamina[action.employeeId]=100;career.post(state,EMPLOYEES[action.employeeId].name,hiringPostCopy(action.employeeId),'people',`hire:${action.employeeId}`);} }
    else if (action.type === 'dismiss') { validate(state.employees.includes(action.employeeId),'employee'); const compensation = employeeTerms(state,action.employeeId).salary * 2; validate(state.cash >= compensation,'cash'); state.cash -= compensation;if(career.isCareer(state))career.careerDismissed(state,action.employeeId); state.employees = state.employees.filter(id => id !== action.employeeId); state.dismissed.push(action.employeeId); delete state.assignments[action.employeeId]; if (state.project?.status === 'planning' && state.project.plannerId === action.employeeId) {state.project.plannerId = null; state.paused = true;} state.notices.push({ day:state.gameDay, type:'farewell', employeeId:action.employeeId, compensation }); }
    else if (action.type === 'buyCompute') { validate(Number.isInteger(action.amount) && action.amount > 0 && state.compute+action.amount <= rulesFor(state).maxCompute,'capacity'); const cost = price(state)*action.amount; validate(state.cash >= cost,'cash'); state.cash -= cost; state.compute += action.amount; }
    else if (action.type === 'createProject') { validate(!state.project,'project-exists'); validate(DIRECTIONS.includes(action.focus),'focus'); validate(typeof action.name === 'string' && action.name.trim().length > 0 && action.name.trim().length <= 40,'name'); validate(state.employees.includes(action.plannerId),'planner'); validate(state.assignments[action.plannerId]?.kind !== 'reset'&&(!career.isCareer(state)||state.career.study?.employeeId!==action.plannerId),'employee-busy'); const quote=career.isCareer(state)?career.trainingQuote(state,action.trainingPlan??'standard'):null;validate(career.isCareer(state)||action.trainingPlan===undefined,'career-only');const budget=quote?.cost??trainingCost(state); validate(state.cash>=budget,'cash'); state.cash-=budget; const projectId=state.nextProjectId++,startWork=12+((projectId-1)%3)*4; state.project = { id:projectId, ...(rulesFor(state).trainingBase?{trainingCost:budget}:{}), ...(state.burstEnabled?{burst:{startWork,endWork:startWork+4,employeeId:null,earned:0}}:{}), name:action.name.trim(), focus:action.focus, plannerId:action.plannerId, status:'planning', planProgress:0, planScores:null, work:0, stageIndex:0, stageWork:0, scoreRemainders:DIRECTIONS.map(()=>0), initialScores:[...state.knowledge], scores:[...state.knowledge] };if(career.isCareer(state))career.prepareCareerProject(state,state.project,quote); }
    else if (action.type === 'selectPlanner') {validate(state.project?.status === 'planning' && state.project.plannerId === null,'planner-not-missing'); validate(state.employees.includes(action.employeeId),'planner'); validate(state.assignments[action.employeeId]?.kind !== 'reset'&&(!career.isCareer(state)||state.career.study?.employeeId!==action.employeeId),'employee-busy'); state.project.plannerId = action.employeeId; state.notices.push({day:state.gameDay,type:'planner-selected',projectId:state.project.id,employeeId:action.employeeId});}
    else if (action.type === 'reset') { const reset=quotaResetStatus(state);validate(reset.available,reset.reason);state.cash-=reset.cost;validate(!career.isCareer(state)||state.career.study?.employeeId!=='rebo','employee-busy');state.assignments.rebo={kind:'reset',finishDay:reset.finishDay,...(career.isCareer(state)?{startedDay:state.gameDay}:{})};if(career.isCareer(state))career.post(state,'Rebo','额度重置已安排。今晚，我们将重新定义“可用”。','service',`reset-start:${state.gameDay}`); }
    else if (action.type === 'publish') {
      const presenter = action.presenter ?? publicationPresenter(state);
      validate(career.isCareer(state)||action.policy===undefined,'career-only');if(career.isCareer(state))validate(['open','closed'].includes(action.policy??'closed'),'policy');
      validate(state.project?.status === 'ready','project-not-ready'); validate(nextCareer.isNextCareer(state)||action.issuePolicy===undefined,'career-next-only');if(nextCareer.isNextCareer(state)){validate(action.issuePolicy===undefined||action.issuePolicy==='accept','issue-policy');validate(!nextCareer.unresolvedIssues(state.project).length||action.issuePolicy==='accept','issues-unconfirmed');} validate(state.employees.includes(presenter),'presenter'); validate(state.assignments[presenter]?.kind !== 'reset','presenter-busy');
      validate(action.media === undefined || ['机器之薪','量子味','新智猿'].includes(action.media),'media');
      const articleCost = action.media ? mediaCost(state,presenter) : 0;
      validate(state.cash >= rulesFor(state).publicationCost+articleCost,'cash'); state.cash -= rulesFor(state).publicationCost+articleCost;
      const project = state.project;
      const beforeMarket=marketSummary(state), compact=profileFor(state)!=='classic168';
      if(compact){const variation=[0,2,-1,1,-2][owned(state).length%5]-(action.media?1:0);state.ratingTenths=Math.max(10,Math.min(50,state.ratingTenths+variation));}
      state.models.push({ id:`player-${project.id}`, company:'player', ...(rulesFor(state).trainingBase?{trainingCost:project.trainingCost,...(action.media?{mediaUntilDay:Math.min(rulesFor(state).lastDay,(Math.floor(state.gameDay/7)+2)*7),mediaIncome:rulesFor(state).mediaIncome}:{})}:{}), ...(project.burst?{burstBonus:project.burst.earned}:{}), name:project.name, focus:project.focus, scores:[...project.scores], day:state.gameDay, sequence:state.nextSequence++, presenter:presenter, media:action.media ?? null });
      if(career.isCareer(state)){const model=state.models.at(-1);career.careerPublished(state,model);if(action.policy==='open')career.openModel(state,model);}
      state.notices.push({ day: state.gameDay, type: 'published', modelId: `player-${project.id}`, cost: rulesFor(state).publicationCost + articleCost });
      state.knowledge = state.knowledge.map((score,index) => score + Math.floor((project.scores[index]-project.initialScores[index])*rulesFor(state).inheritancePercent/100));
      state.pendingBonus += rulesFor(state).publicationBonus + (action.media&&!rulesFor(state).trainingBase ? rank(state) <= 3 ? 10 : 3 : 0);
      state.project = null;
      state.paused = true;
      grantFunding(state);
      if(compact)state.models.at(-1).releaseFeedback={before:beforeMarket,after:marketSummary(state),nextBillIncome:Math.max(0,marketSummary(state).weeklyIncome+state.pendingBonus+state.pendingNews)};
    }
    else if (action.type === 'advanceTo') { validate(Number.isInteger(action.targetDay) && action.targetDay > state.gameDay && action.targetDay <= rulesFor(state).lastDay,'target-day'); validate(!state.paused,'paused'); while (state.gameDay < action.targetDay && !state.paused && !state.ending) advanceDay(state,presentationEvents); }
    else validate(false,'unknown-action');
    industry.rememberRanking(state,board(state));
    if (action.type === 'hire') state.notices.push({ day: state.gameDay, type: 'hired', employeeId: action.employeeId, cost: employeeTerms(state,action.employeeId).hire });
    if (action.type === 'expand') state.notices.push({ day: state.gameDay, type: 'expanded', cost: rulesFor(state).expansionCost, seats: state.seats });
    if (action.type === 'buyCompute') state.notices.push({ day: state.gameDay, type: 'compute-purchased', amount: action.amount, cost: price(state) * action.amount });
    if (action.type === 'createProject') state.notices.push({ day: state.gameDay, type: 'project-created', projectId: state.project.id, ...(rulesFor(state).trainingBase?{cost:state.project.trainingCost}:{}) });
    if (action.type === 'reset') state.notices.push({ day: state.gameDay, type: 'reset-started', employeeId: 'rebo', cost: 4, finishDay: state.gameDay + 1 });
    if (recordHistory) state.acceptedActions.push(action);
    return recordHistory?{ok:true,state,presentationEvents}:{ok:true,state};
  } catch (error) { return { ok:false,state:original,error:error.message }; }
}

const ACTION_FIELDS = {
  startPromotion:['type','employeeId','target'],acceptContract:['type','contractId','employeeId'],cancelAuxiliaryTask:['type'],
  resolveDataProposal:['type','choice'],waitProjectDecision:['type'],reviewProjectDecision:['type'],beginIssueFix:['type','issueId'],startMaintenance:['type','modelId','issueId','employeeId'],
  beginCampaign:['type','profile','seed'],enableGrowth:['type'],enableBurst:['type'],enableSubscriptionGrowth:['type'],pause:['type'],resume:['type'],expand:['type'],hire:['type','employeeId'],dismiss:['type','employeeId'],buyCompute:['type','amount'],
  createProject:['type','name','focus','plannerId','trainingPlan'],selectPlanner:['type','employeeId'],reset:['type'],publish:['type','presenter','media','policy','issuePolicy'],advanceTo:['type','targetDay'],rest:['type','employeeId'],returnToWork:['type','employeeId'],startStudy:['type','kind','target','employeeId'],selectResearcher:['type','employeeId'],resolveExperiment:['type','decision','points'],openModel:['type','modelId'],continueCareer:['type'],retire:['type'],postSocial:['type','kind','targetId','tone'],
};
function canonicalAction(action) {
  validate(action && typeof action === 'object' && !Array.isArray(action) && Object.hasOwn(ACTION_FIELDS,action.type),'unknown-action');
  const fields = ACTION_FIELDS[action.type];
  validate(Object.keys(action).every(key=>fields.includes(key)),'action-fields');
  const canonical = {};
  for (const field of fields) if (Object.hasOwn(action,field) && action[field] !== undefined) {
    validate(['string','number'].includes(typeof action[field]) && (typeof action[field] !== 'number' || Number.isSafeInteger(action[field])),'action-value');
    canonical[field] = action[field];
  }
  return canonical;
}
export function applyAction(original, action) { return executeAction(original,action,true); }
// Autosave validates the same company after each action. Keep only the latest
// verified prefix so late-game saves need not replay hundreds of settled days.
// This cache is private, detached from returned states and never trusts the
// snapshot itself; imports and changed histories still pass every action check.
let replayCheckpoint = null;
export function replayActions(actions) {
  validate(Array.isArray(actions) && actions.length <= RULES.maxAcceptedActions,'action-history');
  const signatures=[];
  for (const [index,action] of actions.entries()) {
    validate(action?.type !== 'beginCampaign' || index === 0,'campaign-must-be-first');
    const canonical = canonicalAction(action);
    const signature=JSON.stringify(canonical);
    validate(signature === JSON.stringify(action),'action-history-canonical');
    signatures.push(signature);
  }
  const checkpoint=replayCheckpoint;
  const reuse=checkpoint&&signatures.length>=checkpoint.signatures.length&&checkpoint.signatures.every((value,index)=>value===signatures[index]);
  let state=reuse?structuredClone(checkpoint.state):initialState();
  for(let index=reuse?checkpoint.signatures.length:0;index<actions.length;index++) {
    const result = executeAction(state,actions[index],false);
    validate(result.ok,'action-history:'+result.error);
    state = result.state;
  }
  replayCheckpoint={signatures,state};
  const restored=structuredClone(state);
  restored.acceptedActions = structuredClone(actions);
  return restored;
}

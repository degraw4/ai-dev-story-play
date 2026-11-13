import {eventLine,officePostCopy,preheatPostCopy,preheatMissCopy,rivalReleaseRemark} from './career-copy.js';
import * as industry from './career-industry.js';
import * as team from './career-team.js';
import * as nextCareer from './career-next.js';
import { DIRECTIONS, EMPLOYEES, STAGES, TRAINING_PLANS, COMPANY_METHODS, SUBSCRIPTION_INCOME } from './content.js';

export const isCareer = state => ['career336','career336v2','career336v3'].includes(state.campaignProfile);
const own = state => state.models.filter(model => model.company === 'player');
const score = model => model.scores.reduce((a,b)=>a+b,0);
const check = (condition,error) => {if(!condition)throw new Error(error);};
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
export function post(state,author,text,topic='office',source='',replies=[]) {
  const c=state.career;
  const id=source||`post-${c.posts.length+1}`;
  if(c.posts.some(item=>item.id===id))return;
  c.posts.push({id,day:state.gameDay,author,text,topic,replies:[...replies]});
}
export function initializeCareer(state,seed) {
  state.career={seed,rp:0,fans:0,openRating:0,stamina:Object.fromEntries(state.employees.map(id=>[id,100])),resting:{},caps:{},methods:{data:0,training:0,evaluation:0},study:null,learned:[],windows:{},campaigns:[],posts:[],promotedPeriods:[],openFansPeriods:{},worked:[],assessments:[],assessment:null,phase:1};
  team.initializeTeam(state);industry.initializeIndustry(state);
  for(const model of state.models){const rival=state.campaignProfile&&['Meeta','DeepPeek'].includes(model.company);model.policy=rival?'open':'closed';if(rival)model.openDay=0;}
  post(state,'小满','公司开张。模型可以通用，工资单暂时不能。先给第一代留出训练、发布和工资。','office','welcome',['Avery：机房还小，名字可以先起大一点。']);
}
export function projectStages(state) {
  return isCareer(state)&&state.project?.stageWorkloads?STAGES.map((stage,i)=>({...stage,work:state.project.stageWorkloads[i]})):STAGES;
}
export function trainingQuote(state,plan='standard') {
  check(Object.hasOwn(TRAINING_PLANS,plan),'training-plan');
  check(own(state).length>0||plan==='standard','first-standard');
  const standard=Math.min(16,8+own(state).length),discount=state.career.methods.training*.05;
  return {standard,cost:Math.max(1,Math.ceil(standard*TRAINING_PLANS[plan].factor*(1-discount))),work:[...TRAINING_PLANS[plan].work],plan};
}
export function workers(state) {
  const c=state.career;
  return state.employees.filter(id=>!state.assignments[id]&&c.study?.employeeId!==id&&!c.resting[id]&&(c.stamina[id]??100)>20);
}
export function spendEnergy(state,id,amount) {
  check(state.career.stamina[id]-amount>=20,'stamina');
  state.career.stamina[id]-=amount;
  if(!state.career.worked.includes(id))state.career.worked.push(id);
}
export function beginCareerDay(state,releases,currentRank) {
  const c=state.career;c.worked=[];
  if([112,224].includes(state.gameDay))c.assessmentSnapshot={rank:currentRank,modelCount:own(state).length};
  if(state.gameDay===336)c.finalRank=currentRank;
  for(const id of state.employees){
    c.stamina[id]??=100;
    if(c.resting[id]&&c.stamina[id]>=c.resting[id])delete c.resting[id];
    const dayTask=state.assignments[id]||c.study?.employeeId===id||(state.project?.status==='planning'&&state.project.plannerId===id);
    const required=dayTask?26:state.project?.status==='experiment'?22:21;
    if(!c.resting[id]&&c.stamina[id]<required)c.resting[id]=60;
  }
  for(const release of releases.filter(item=>item.day-7===state.gameDay)){
    c.windows[release.id]=learningSource(state,release.company,release.scores,state.gameDay-4);
  }
}
export function learningGains(base,source) {
  return source?base.map((value,i)=>Math.min(12,Math.floor(.2*Math.max(0,source.scores[i]-value)))):[0,0,0];
}
export function learningSource(state,company,base,latestOpenDay,ids=null) {
  const candidates=state.models.filter(model=>model.company!==company&&model.policy==='open'&&model.openDay<=latestOpenDay&&(!ids||ids.includes(model.id)));
  return candidates.sort((a,b)=>learningGains(base,b).reduce((x,y)=>x+y,0)-learningGains(base,a).reduce((x,y)=>x+y,0)||a.openDay-b.openDay||a.sequence-b.sequence)[0]??null;
}
export function prepareCareerProject(state,project,quote) {
  project.trainingPlan=quote.plan;project.standardBudget=quote.standard;project.stageWorkloads=quote.work;
  project.methodSnapshot={...state.career.methods};
  project.learningSource=learningSource(state,'player',project.initialScores,state.gameDay,state.career.learned);
  project.experiment=null;
}
export function finishLearning(state,project,events) {
  const gains=learningGains(project.scores,project.learningSource);
  project.learningBonus=gains;
  for(let i=0;i<3;i++){
    project.scores[i]+=gains[i];
    if(events)for(let point=0;point<gains[i];point++)events.push({type:'research-point',projectId:project.id,workUnit:project.work,employeeId:state.employees.includes(project.plannerId)?project.plannerId:state.employees[0],direction:DIRECTIONS[i],amount:1,burst:false,source:'learning'});
  }
}
function sample(id,seed) {let value=(id*2654435761+seed)>>>0;value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)%100;}
export function offerExperiment(state,abilities) {
  const p=state.project,ids=workers(state),index=DIRECTIONS.indexOf(p.focus);
  if(own(state).length<2||!ids.length)return;
  const ordered=ids.map(id=>({id,a:abilities(state,id)[index]})).sort((a,b)=>b.a-a.a||a.id.localeCompare(b.id));
  const q=ordered.reduce((n,item)=>n+item.a,0);
  p.experiment={employeeId:ordered[0].id,baseChance:clamp(40+2*ordered[0].a,40,85),methodBonus:p.methodSnapshot.evaluation*5+(nextCareer.isNextCareer(state)&&p.dataProposal?.choice==='clean'&&p.dataProposal.completed?5:0),cost:Math.max(2,Math.ceil(.2*p.standardBudget)),reward:clamp(Math.floor(q/8),4,12),sample:sample(p.id,state.career.seed),progress:0};
  p.status='experiment-offer';
}
export function progressExperiment(state,summary,events) {
  const p=state.project,e=p.experiment,ids=summary.activeEmployeeIds;
  if(!ids.length)return;
  const work=Math.min(4-e.progress,summary.progressPerDay,...ids.map(id=>Math.floor((state.career.stamina[id]-20)/2)));
  if(work<=0)return;
  for(const id of ids)spendEnergy(state,id,work*2);
  e.progress+=work;
  if(e.progress===4){
    e.success=e.sample<e.chance;
    state.career.rp+=2;
    if(e.success){const index=DIRECTIONS.indexOf(p.focus);p.scores[index]+=e.reward;if(events)for(let i=0;i<e.reward;i++)events.push({type:'research-point',projectId:p.id,workUnit:p.work,employeeId:ids.includes(e.employeeId)?e.employeeId:ids[0],direction:p.focus,amount:1,burst:false,source:'experiment'});}
    p.status='researching';
    state.notices.push({day:state.gameDay,type:'experiment-result',projectId:p.id,success:e.success,reward:e.success?e.reward:0});
    post(state,state.employees.includes(e.employeeId)?EMPLOYEES[e.employeeId].name:'研发团队',e.success?`${p.name} 加跑完成，主攻增加 ${e.reward} 分。${nextCareer.isNextCareer(state)?eventLine(state,'experiment',p.id):'图表这次终于和我们的愿望同向。'}`:`${p.name} 的实验没有提升。${nextCareer.isNextCareer(state)?eventLine(state,'failure',p.id):'记录留下了，训练费也留下了记录。'}`,'research',`experiment:${p.id}`);
  }
}
export function studyQuote(state,kind,target) {
  const c=state.career;
  if(kind==='method'){
    check(Object.hasOwn(COMPANY_METHODS,target),'method');const tier=c.methods[target];check(tier<2,'method-complete');check(own(state).length>=(tier?4:1),'research-locked');
    return {rp:tier?24:12,cost:tier?8:4,days:tier?8:4,tier:tier+1,label:`${COMPANY_METHODS[target].label} ${tier+1}级`};
  }
  check(own(state).length>0,'research-locked');
  if(kind==='course'){check(DIRECTIONS.includes(target),'focus');return {rp:8,cost:3,days:3,label:`${{coding:'编程',office:'办公',multimodal:'多模态'}[target]}进修`};}
  check(kind==='replicate','study-kind');
  const source=state.models.find(model=>model.id===target&&model.company!=='player'&&model.policy==='open');
  check(source&&!c.learned.includes(source.id),'source');return {rp:8,cost:4,days:4,label:`复现 ${source.name}`};
}
export function finishCareerTasks(state) {
  const c=state.career;
  const t=c.study;
  if(t&&state.employees.includes(t.employeeId)&&!c.resting[t.employeeId]&&c.stamina[t.employeeId]>=26){
    spendEnergy(state,t.employeeId,6);t.progress++;
    if(t.progress===t.days){
      if(team.finishTeamTask(state,t,post)){}
      else if(t.kind==='method')c.methods[t.target]=t.tier;
      else if(t.kind==='replicate')c.learned.push(t.target);
      else if(t.kind==='maintenance')nextCareer.finishMaintenance(state,t,post);
      else {const i=DIRECTIONS.indexOf(t.target);c.caps[t.employeeId]??=[6,6,6];c.caps[t.employeeId][i]=Math.min(18,c.caps[t.employeeId][i]+2);state.employeeExperience[t.employeeId][i]=Math.min(c.caps[t.employeeId][i]*120,state.employeeExperience[t.employeeId][i]+120);}
      state.notices.push({day:state.gameDay,type:'study-complete',employeeId:t.employeeId,label:t.label});
      if(!['maintenance','promotion','contract'].includes(t.kind))post(state,EMPLOYEES[t.employeeId].name,`${t.label}完成。${t.kind==='course'?'学会了，暂时还没写进招聘简历。':t.kind==='replicate'?'感谢公开资料的同行。跑通的那一刻，安装说明突然变得很亲切。':'报告写了八页，发布稿准备把它写成新架构。'}`,'research',`study:${t.id}`,['小满：成果已记录，当前型号不回改。']);c.study=null;
    }
  }
  team.expireContract(state,post);
  for(const [id,task] of Object.entries(state.assignments))if(task.kind==='reset'){
    if(!c.resting[id]&&c.stamina[id]>=26){spendEnergy(state,id,6);state.ratingTenths=Math.min(50,state.ratingTenths+5);delete state.assignments[id];state.notices.push({day:state.gameDay,type:'reset-complete',employeeId:id,ratingTenths:state.ratingTenths});post(state,'Rebo','额度恢复。评论区开始接着问上午的问题。','service',`reset-complete:${task.startedDay}`);}
    else task.finishDay=state.gameDay+1;
  }
  for(const id of state.employees)if(!c.worked.includes(id))c.stamina[id]=Math.min(100,c.stamina[id]+20);
  const industry={
    126:['Sam Allman','刚看了同行的公开模型和价格。做得不错。我们团队也在试，试完再聊。',['开发者：这条我先截了。下次比较时别只截后半句。']],
    145:['开发者社区','Cloud Code 更新后，我这组测试缓存没命中，另一位说没问题。我们先对了客户端版本和服务端点，还在查请求里哪些字段变了。红箭头画好了，结论先别画。',['兼容层维护者：把能复现的请求样例也发来，截图跑不起来。','另一位开发者：我这组没有复现，配置贴下面了。']],
    171:['Gloglo 研究团队','今天开放研究演示。欢迎带自己的图片和文件。提醒一下：上次有人传团队合照，模型把所有人都列进了行动项，还给靠门的同事派了开门任务。',['员工：终于有一项需求不需要跨团队沟通。']],
    203:['Meeta 开源团队','新资料整理进仓库了。特别谢谢那位把安装步骤从“按常规配置”改成具体命令的维护者。我们自己也重新照着装了一遍。',['维护者：那两步省略号终于没了。可以关工单吃饭了。']],
    252:['小满','同行和算力供应商发了联合声明。老板圈出“长期合作”，我圈出“优惠截止日”。看的是同一份文件，记的是两个日历。',[]],
    301:['开发者社区','盘了盘今年真正帮到我的更新：一段能直接跑的迁移示例。把旧字段怎么换都写了，我没翻聊天记录，也没开会问人。',['维护者：收到，下一版还按这个格式写。']],
  }[state.gameDay];
  if(industry)post(state,industry[0],industry[1],'discussion',`industry:${state.gameDay}`,industry[2]);
  if(state.gameDay%14===3){
    const [who,text]=officePostCopy(state,careerSubscription(state));
    const author=who==='小满'?'小满':who&&state.employees.includes(who)?EMPLOYEES[who].name:'开发者社区';
    post(state,author,text,'office',`office:${state.gameDay}`);
  }
}
export function careerSubscription(state) {
  if(!own(state).length)return {income:0,raw:0,modelId:null,direction:null,referenceRank:null};
  const rates=state.funding.includes('overall')?SUBSCRIPTION_INCOME.established:SUBSCRIPTION_INCOME.standard;
  const candidates=[];
  for(const model of own(state)){
    const options=[null,0,1,2].map(direction=>{
      const value=direction===null?score(model):model.scores[direction];
      const rivals=new Map();
      for(const rival of state.models.filter(item=>item.company!=='player')){const current=rivals.get(rival.company),n=direction===null?score(rival):rival.scores[direction];if(!current||n>current.value||n===current.value&&rival.sequence<current.sequence)rivals.set(rival.company,{value:n,sequence:rival.sequence});}
      const referenceRank=1+[...rivals.values()].filter(item=>item.value>value||item.value===value&&item.sequence<model.sequence).length;
      const raw=direction===null?rates[referenceRank-1]:Math.floor(SUBSCRIPTION_INCOME.standard[referenceRank-1]*.8);
      return {raw,direction,referenceRank};
    }).sort((a,b)=>b.raw-a.raw);
    const best=options[0];candidates.push({...best,income:model.policy==='open'?Math.floor(best.raw*.9):best.raw,modelId:model.id,policy:model.policy,sequence:model.sequence});
  }
  return candidates.sort((a,b)=>b.income-a.income||a.sequence-b.sequence)[0];
}
export function publicityQuote(state,kind,tone) {
  const baseHeat=Math.min(100,(tone==='bold'?60:45)+Math.min(20,Math.floor(state.career.fans/100))+(tone==='technical'?10:0));
  if(state.campaignProfile!=='career336v3')return {heat:baseHeat};
  const previous=state.career.campaigns.at(-1),period=Math.floor(state.gameDay/7);
  const repetition=previous?.kind===kind&&Math.floor(previous.day/7)===period-1?(previous.repetition??0)+1:0;
  const heatPercent=[100,70,40,25][Math.min(repetition,3)];
  return {heat:Math.floor(baseHeat*heatPercent/100),baseHeat,heatPercent,repetition,kind};
}
export function socialIncome(state,base,day,settle=false) {
  const usable=state.career.campaigns.filter(item=>!item.settled&&item.modelId&&day<=item.untilDay&&item.heat>0);
  const cap=Math.min(5,Math.floor(base*.1));
  const result=usable.map(item=>({item,income:Math.floor(cap*(item.heat>=60?1:item.heat>=35?.5:0))})).sort((a,b)=>b.income-a.income||a.item.day-b.item.day)[0];
  if(settle)for(const item of state.career.campaigns)if(!item.settled&&(item.modelId||day>item.untilDay)){item.settled=true;item.income=result?.item===item?result.income:0;}
  return result?.income??0;
}
export function openModel(state,model) {
  check(model&&model.company==='player','model');check(model.policy!=='open','already-open');
  const c=state.career;
  const ownBest=Math.max(0,...own(state).filter(item=>item.id!==model.id&&item.policy==='open').map(score));
  const publicBest=Math.max(0,...state.models.filter(item=>item.id!==model.id&&item.policy==='open').map(score));
  const period=Math.floor(state.gameDay/7),remaining=Math.max(0,200-(c.openFansPeriods[period]??0));
  const gained=score(model)>ownBest?Math.min(remaining,10+Math.min(90,Math.floor(Math.max(0,score(model)-publicBest)/2))):0;
  model.policy='open';model.openDay=state.gameDay;model.openFans=gained;c.fans+=gained;c.openFansPeriods[period]=(c.openFansPeriods[period]??0)+gained;
  const ratingGain=gained>0?Math.min(1,5-c.openRating,50-state.ratingTenths):0;
  c.openRating+=ratingGain;state.ratingTenths+=ratingGain;model.openRatingGain=ratingGain;
  post(state,'公司官号',`${model.name} 的权重和运行资料已公开。官方 API 继续提供服务。`,'open',`open:${model.id}`,[gained?'开发者：权重下好了，显卡还没准备好。先谢谢写运行说明的人。':'开发者：资料收了，先对一下和上一版有哪些不同。',`小满：社区新增 ${gained} 位关注者；官方服务收入请看账单预估。`]);
}
export function careerPublished(state,model) {
  const project=state.project,c=state.career;
  nextCareer.published(state,model,post);team.recordPublished(state,model);industry.snapshotModel(state,model);
  model.policy='closed';model.trainingPlan=project.trainingPlan;model.learningSourceId=project.learningSource?.id??null;model.learningBonus=project.learningBonus??[0,0,0];model.experiment=project.experiment?{success:project.experiment.success??null,invested:project.experiment.invested??0,reward:project.experiment.success?project.experiment.reward:0}:null;
  post(state,'公司官号',`${model.name} 已发布，综合 ${score(model)} 分。同一代模型将用于对话、办公与工具任务。`,'release',`release:${model.id}`,[['开发者：完整型号我记下了，今晚拿自己的项目试。','用户：昨天那份表格还在，正好拿来做对照。','同行：恭喜。测试条件放哪了？想一起看看。'][own(state).length%3]]);
  for(const campaign of c.campaigns.filter(item=>item.key===`project:${project.id}`&&!item.modelId)){
    campaign.modelId=model.id;
    if(state.gameDay>campaign.untilDay||campaign.promise&&score(model)<campaign.promise){campaign.heat=0;c.fans=Math.max(0,c.fans-3);post(state,'开发者社区',preheatMissCopy(model.name,campaign,state.gameDay,score(model)),'discussion',`promise:${model.id}`);}
    else {campaign.untilDay=Math.min(336,(Math.floor(state.gameDay/7)+1)*7);c.fans+=campaign.bold?6:3;}
  }
}
export function rivalPublished(state,release,sequence) {
  const source=state.career.windows[release.id]??null,gains=learningGains(release.scores,source);
  const model={...release,scores:release.scores.map((n,i)=>n+gains[i]),sequence,baseScores:[...release.scores],learningSourceId:source?.id??null,learningBonus:gains};
  if(model.policy==='open')model.openDay=state.gameDay;
  const remark=rivalReleaseRemark(state,model);
  post(state,release.company,`${release.name} 已发布，综合 ${score(model)} 分。${release.company==='DeepPeek'?'模型、技术资料和价格表见附件。':model.policy==='open'?'权重与运行资料一并公开。':'官方服务已更新。'}${remark.text}`,'release',`release:${model.id}`,source&&gains.some(Boolean)?[`工程资料：参考 ${source.name}，本代吸收增量 ${gains.join(' / ')}。`]:remark.reply?[remark.reply]:[]);
  return model;
}
export function handleCareerAction(state,action) {
  const c=state.career;
  if(nextCareer.handleNextAction(state,action))return true;
  if(action.type==='rest'){
    check(state.employees.includes(action.employeeId),'employee');c.resting[action.employeeId]=100;return true;
  }
  if(action.type==='returnToWork'){
    check(state.employees.includes(action.employeeId),'employee');check(c.stamina[action.employeeId]>=60,'rest-more');delete c.resting[action.employeeId];return true;
  }
  if(action.type==='startStudy'){
    check(!c.study,'study-busy');check(state.employees.includes(action.employeeId),'employee');check(!state.assignments[action.employeeId],'employee-busy');check(!(state.project?.status==='planning'&&state.project.plannerId===action.employeeId),'planner-studying');
    const quote=studyQuote(state,action.kind,action.target);check(c.rp>=quote.rp,'research-points');check(state.cash>=quote.cost,'cash');
    if(action.kind==='course'){const i=DIRECTIONS.indexOf(action.target);check((c.caps[action.employeeId]?.[i]??6)<18||state.employeeExperience[action.employeeId][i]<18*120,'course-complete');}
    c.rp-=quote.rp;state.cash-=quote.cost;c.study={id:`${state.nextProjectId}:${state.gameDay}:${c.posts.length}`,kind:action.kind,target:action.target,employeeId:action.employeeId,progress:0,...quote};return true;
  }
  if(action.type==='selectResearcher'){
    check(c.study,'no-study');check(state.employees.includes(action.employeeId),'employee');check(!state.assignments[action.employeeId],'employee-busy');check(!(state.project?.status==='planning'&&state.project.plannerId===action.employeeId),'planner-studying');c.study.employeeId=action.employeeId;return true;
  }
  if(action.type==='resolveExperiment'){
    const p=state.project;check(p?.status==='experiment-offer','no-experiment');check(['skip','approve'].includes(action.decision),'experiment-decision');
    if(action.decision==='skip'){p.experiment.skipped=true;p.status='researching';if(nextCareer.isNextCareer(state))p.decisionWaiting=false;return true;}
    check([0,4,8].includes(action.points),'experiment-points');check(state.employees.includes(p.experiment.employeeId),'employee');check(c.rp>=action.points,'research-points');check(state.cash>=p.experiment.cost,'cash');
    state.cash-=p.experiment.cost;c.rp-=action.points;p.experiment.invested=action.points;p.experiment.chance=Math.min(90,p.experiment.baseChance+p.experiment.methodBonus+action.points*2.5);p.status='experiment';if(nextCareer.isNextCareer(state))p.decisionWaiting=false;return true;
  }
  if(action.type==='openModel'){openModel(state,state.models.find(item=>item.id===action.modelId));return true;}
  if(action.type==='continueCareer'){check(c.assessment,'no-assessment');c.phase++;c.assessment=null;return true;}
  if(action.type==='retire'){check(c.assessment,'no-assessment');state.ending=c.assessment.result;state.paused=true;return true;}
  if(action.type==='postSocial'){
    check(!c.promotedPeriods.includes(Math.floor(state.gameDay/7)),'promotion-used');check(state.cash>=1,'cash');check(['preheat','spotlight','respond'].includes(action.kind),'social-kind');check(['steady','bold','congratulate','technical','snark'].includes(action.tone),'social-tone');
    let key,modelId=null,name,promise=0,bold=false,untilDay=Math.min(336,state.gameDay+14);
    if(action.kind==='preheat'){
      check(state.project&&state.project.status!=='ready','project-not-researching');key=`project:${state.project.id}`;name=state.project.name;check(['steady','bold'].includes(action.tone),'social-tone');
      if(action.tone==='bold'){bold=true;promise=Math.max(...state.models.filter(item=>item.company!=='player').map(score));}
    }else if(action.kind==='spotlight'){
      const model=state.models.find(item=>item.id===action.targetId&&item.company==='player');check(model,'model');key=`project:${model.id.replace('player-','')}`;modelId=model.id;name=model.name;check(['steady','technical'].includes(action.tone),'social-tone');untilDay=Math.min(336,(Math.floor(state.gameDay/7)+1)*7);
    }else{
      const rival=state.models.find(item=>item.id===action.targetId&&item.company!=='player'&&item.day>0&&state.gameDay-item.day<=7);check(rival,'rival-event');check(own(state).length,'no-users');check(['congratulate','technical','snark'].includes(action.tone),'social-tone');
      const best=own(state).toSorted((a,b)=>score(b)-score(a))[0];if(action.tone==='snark')check(score(best)>score(rival),'comparison');key=`rival:${rival.id}`;modelId=best.id;name=rival.name;untilDay=Math.min(336,(Math.floor(state.gameDay/7)+1)*7);
    }
    check(!c.campaigns.some(item=>item.key===key),'already-promoted');
    const publicity=publicityQuote(state,action.kind,action.tone),heat=publicity.heat;
    state.cash--;c.promotedPeriods.push(Math.floor(state.gameDay/7));c.campaigns.push({key,day:state.gameDay,modelId,untilDay,...publicity,promise,bold,settled:false});
    const text=action.kind==='preheat'?preheatPostCopy(name,c.campaigns.at(-1)):action.kind==='spotlight'?`${name} 的使用记录更新了。${action.tone==='technical'?'先展示任务和测试条件，再讨论领先多少。':'感谢提供反馈的开发者，表格和代码都算真实反馈。'}`:action.tone==='snark'?`感谢 ${name} 的发布，给了大家一个重新翻看我们成绩单的理由。`:`祝贺 ${name} 发布。${action.tone==='technical'?'我们准备对照相同条件做一次技术比较。':'期待更多开发者的实际体验。'}`;
    post(state,'公司官号',text,'promotion',`promotion:${key}`,['小满：已占用本期推广排期，实际获客到固定账单结算。']);return true;
  }
  return false;
}
export function careerDismissed(state,id) {
  nextCareer.dismissed(state,id);
  const c=state.career;
  if(c.study?.employeeId===id){if(['course','promotion'].includes(c.study.kind))c.study=null;else c.study.employeeId=null;}
  if(state.project?.status==='experiment-offer'&&state.project.experiment.employeeId===id){state.project.experiment.skipped=true;state.project.status='researching';}
  if(id==='rebo'&&state.assignments.rebo)post(state,'服务公告','原定额度重置取消，尚未恢复额度。','service',`reset-cancel:${state.assignments.rebo.startedDay}`);
  post(state,EMPLOYEES[id].name,'今天起在新的地方继续探索。头像还没换，工资已经不用这家公司发了。','people',`dismiss:${id}`);
}
export function assessmentResult(state,rank) {return rank===1?'榜单常青树':state.funding.length>=2&&state.cash>=320?'融资永动机':'明年一定第一';}
export function assessCareer(state,rank) {
  const c=state.career;
  if([112,224].includes(state.gameDay)&&!state.ending){
    const report={day:state.gameDay,rank:c.assessmentSnapshot?.rank??rank,modelCount:c.assessmentSnapshot?.modelCount??own(state).length,cash:state.cash,fans:c.fans};report.result=assessmentResult(state,report.rank);c.assessments.push(report);c.assessment=report;state.paused=true;
    post(state,'小满',`第 ${c.phase} 阶段评估完成：${report.result}。账本和员工都留在这里，继续经营还是结算由你决定。`,'office',`assessment:${state.gameDay}`);
  }
}

export function studyCompute(state) {
  const c=state.career,t=c.study;return t&&!['course','promotion'].includes(t.kind)&&t.employeeId&&!c.resting[t.employeeId]&&c.stamina[t.employeeId]>=26?1:0;
}
// Forecast only known staff, tasks and automatic rest; never mutates or rolls RNG.
export function estimateCareerDays(state) {
  if(nextCareer.isNextCareer(state))return null;
  const p=state.project,c=state.career;if(!p||p.status==='ready')return 0;
  if(p.status==='experiment-offer'||!state.employees.length||p.status==='planning'&&!p.plannerId)return null;
  const energy={...c.stamina},rest={...c.resting},task=c.study?{...c.study}:null,resets=Object.fromEntries(Object.keys(state.assignments).map(id=>[id,true]));
  let study=task,planning=p.status==='planning'?2-p.planProgress:0,index=p.stageIndex,progress=p.stageWork,experiment=p.status==='experiment'?4-p.experiment.progress:0;
  const stages=projectStages(state);
  for(let day=1;day<=600;day++){
    const worked=new Set();
    for(const id of state.employees){if(rest[id]&&energy[id]>=rest[id])delete rest[id];const needed=resets[id]||study?.employeeId===id||planning&&p.plannerId===id?6:experiment?2:1;if(!rest[id]&&energy[id]<20+needed)rest[id]=60;}
    const ids=state.employees.filter(id=>!rest[id]&&!resets[id]&&study?.employeeId!==id);
    const reserved=study&&study.kind!=='course'&&study.employeeId&&!rest[study.employeeId]&&energy[study.employeeId]>=26?1:0;
    if(planning){if(ids.includes(p.plannerId)){energy[p.plannerId]-=6;worked.add(p.plannerId);planning--;}}
    else if(ids.length){const cost=experiment?2:1;const speed=ids.length+state.compute-reserved+(ids.includes('boris')?2:0)+(ids.includes('tim')?1:0);const amount=Math.min(experiment||stages[index].work-progress,speed,...ids.map(id=>Math.floor((energy[id]-20)/cost)));for(const id of ids){energy[id]-=amount*cost;if(amount)worked.add(id);}if(experiment)experiment-=amount;else{progress+=amount;if(progress===stages[index].work){progress=0;index++;if(index===stages.length)return day;}}}
    if(study&&study.employeeId&&!rest[study.employeeId]&&energy[study.employeeId]>=26){energy[study.employeeId]-=6;worked.add(study.employeeId);if(++study.progress===study.days)study=null;}
    for(const id of Object.keys(resets))if(!rest[id]&&energy[id]>=26){energy[id]-=6;worked.add(id);delete resets[id];}
    for(const id of state.employees)if(!worked.has(id))energy[id]=Math.min(100,energy[id]+20);
  }
  return null;
}

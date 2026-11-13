// Presentation records are deliberately outside the economic reducer/history.
import {applyAction,replayActions,rank,employeeAbilities,employeeTerms,operatingCosts,baseSubscriptionIncome,mediaCampaign,rulesFor,publicationPresenter,mediaCost} from './game/rules.js';
import {isCareer,careerSubscription,socialIncome,finishCareerTasks,workers,studyCompute,learningGains} from './game/career.js';
import {isNextCareer,unresolvedIssues,supportCost,ISSUE_TYPES} from './game/career-next.js';
import {DIRECTIONS,EMPLOYEES,COMPANY_METHODS} from './game/content.js';

const clone=x=>structuredClone(x), own=s=>s.models.filter(m=>m.company==='player');
const total=m=>m.scores.reduce((a,b)=>a+b,0);
const labels={coding:'编程',office:'办公',multimodal:'多模态'};
const issueLabel=id=>ISSUE_TYPES.find(x=>x.id===id)?.label??'已记录的上线问题';
export const FEEDBACK_VERSION=1;
// The category is a narrow fact gate, not a promise of a specific user outcome.
// In particular, open means weights + run docs, and talent also covers methods,
// reproductions and promotions (not only an employee returning from a course).
export const COMMENT_POOLS = {
  debut:{author:'开发者',text:[
    '有正式型号了。我先拿手头那份表格试，发布会的示例我背都会背了。',
    '第一版先收藏。接下来再更新，别把这版的成绩页删了。',
    '想试试那个绕了我三天的报错。有人一起跑对照吗？',
    '欢迎新选手。名字记住了，用不用还得看我自己的任务。',
    '先把型号抄进测试配置。今天不光收藏链接了。',
    '恭喜发出来了。维护文档的同事也辛苦，第一版最容易漏步骤。'
  ],replies:['工程师：跑不顺的话，把输入和报错一起发来。','小满：第一版成绩留着，以后可以直接对照。']},
  improvement:{author:'开发者',text:[
    '有分项涨了。我先把上代没做好的那几个任务再试一遍。',
    '成绩往上走了。不过我们项目不是考卷，我自己再跑一轮。',
    '新旧成绩我放一起了。升级前还得看看我最常用的那一项。',
    '这个进步值得试。先切测试环境，老板那套正式流程先别动。',
    '看到涨分了，恭喜。昨晚那条长得像族谱的报错，我又有点希望了。',
    '今晚多跑一组对照。上次同事问我为什么换模型，我只有一句“听说不错”。'
  ],replies:['工程师：记得连旧型号一起跑，条件别换。','同事：先试你那份真文件，别只换发布会的样例。']},
  limited:{author:'行业观察者',text:[
    '三项都没超过上代。换不换型号，我先等自己的测试。',
    '发布会看完了，成绩也看了。旧型号的测试配置先不删。',
    '标题换了，三项成绩都没超过上代。图的纵轴再裁也没用。',
    '这次先别急着迁移。把上代摆旁边，看看新一轮训练花在哪了。',
    '型号名很好记。成绩没超过上代这件事，也很好记。',
    '我把两代数字贴一起了。宣传图请保留完整坐标轴，谢谢。'
  ],replies:['老用户：那我先继续用原来的，等实测。','员工：嗯，下代先把训练计划想明白。']},
  issue:{author:'现有用户',text:[
    '已知问题我看了。先小范围试，别让我的正式任务替你做回归。',
    '能把这些问题的处理进度放在一页吗？我不想每天翻整个评论区。',
    '榜分很醒目，已知问题也请放醒目一点。我是真的会点运行。',
    '先留着人工检查。我不想早上打开电脑，才发现昨晚白跑了。',
    '谢谢把问题列出来。修好哪项说哪项，我好决定哪些任务能交给它。',
    '升级先缓缓。我用的流程碰不碰这些问题，得先查清楚。'
  ],replies:['工程师：收到，修好哪项就更新哪项的状态。','小满：你这条不删，后续处理进度接在这里。']},
  repair:{author:'维护工程师',text:[
    '这项修好了。把原来的输入重跑一遍，终于不用手动绕过去。',
    '补上回归了。以后谁再改坏这里，测试先找他。',
    '关单前又跑了一次。上次说完“好了”就重新打开工单，我还记得。',
    '这次只修这一项。其余问题还挂着，别替我们宣布全好了。',
    '谢谢附日志的那位。终于不用靠猜截图前面发生了什么。',
    '修好了，旧成绩没有重算。别拿维护公告当新型号发。'
  ],replies:['用户：收到，我再按昨天的步骤试一次。','财务：得是当前承担订阅的型号，修好后支持费才会少；旧账不退。']},
  open:{author:'开源社区',text:[
    '权重下到了。今晚的瓶颈从排队变成了我自己的显存。',
    '运行说明也在，感谢。最怕下完几十个文件才发现不知道先点哪个。',
    '先放下载。别催测评，我家网速还没进化到发布会水平。',
    '准备本地跑一遍。感谢开放权重，也谢谢写路径示例的人。',
    '资料收了。我试完把环境版本一起发，免得大家对着不同结果吵。',
    '有人一起读运行说明吗？我负责动手，显卡负责提出反对意见。'
  ],replies:['维护者：跑通了也贴一下配置，后来的人能省点事。','同事：点赞很快，模型文件下载得慢，别急。']},
  learning:{author:'工程交流',text:[
    '同行真的拿公开资料做了下一代。文档里的致谢别只写“社区”。',
    '参考的型号和增量都列出来了，挺好。总比一句“自研突破”好查。',
    '原作者可以转发这次结果了：不是只有收藏，真有人接着做。',
    '这回能顺着资料找到上一份工作。写运行说明的人没白写。',
    '开源之后同行也学会了。这就是公开之前要想好的事。',
    '别人拿我们的公开成果继续做，心情有点复杂。技术引用记得写全。'
  ],replies:['原作者：欢迎用，也请把来源和测试条件写上。','同事：技术学过去了，咱们下一代还得接着做。']},
  talent:{author:'办公室同事',text:[
    '这项忙完了。先来看看下个项目，白板上还有三个问号。',
    '辛苦。群里的“等你弄完再说”，现在可以接着说了。',
    '能花十分钟讲给我们听吗？别只发一个两百页的文件。',
    '总算做完这项了。先喝口水，我那份方案等会儿再找你看。',
    '把这次用到的资料留个地址。我不想下回再翻半天群记录。',
    '老板问有没有照片能发。我们先问有没有东西能用到下个项目。'
  ],replies:['本人：给我个真问题，正好试试。','小满：这次完成了什么、工资有没有变，都列在上面了。']},
  award:{author:'公司官号',text:[
    '我们拿到奖了。感谢团队，尤其感谢到最后还在补回归样例的同事。',
    '获奖型号在这里！合照还没拍齐，有人在接着跑今天的任务。',
    '谢谢评委和使用过这个型号的人。谢谢那位把完整报错贴给我们的用户。',
    '奖项到手。官网横幅可以换了，安装说明也请顺手更新一下。',
    '今晚庆祝一下。研发同事要求：庆祝的时候别开复盘会。',
    '恭喜团队。对外先发成绩，对内先把所有参与者的名字写齐。'
  ],replies:['工程师：谢谢，别把写数据工具的同事漏了。','小满：转发时把型号也带上，别只剩一个奖字。']},
};
const hash=text=>[...text].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381);
function comments(record,id,facts){
  return facts.slice(0,3).map(f=>{
    const pool=COMMENT_POOLS[f.category],used=record.events.flatMap(e=>e.comments??[]).filter(c=>c.category===f.category).slice(-3).map(c=>c.template);
    const available=pool.text.map((_,i)=>i).filter(i=>!used.includes(i)),seed=hash(`${id}:${f.category}`),index=available[seed%available.length];
    return {category:f.category,template:index,author:pool.author,text:pool.text[index],reply:pool.replies[seed%2],fact:f.fact};
  });
}
export function companySnapshot(s){
  const costs=operatingCosts(s),source=isCareer(s)?careerSubscription(s):null;
  return {day:s.gameDay,cash:s.cash,fans:s.career?.fans??0,count:own(s).length,employees:s.employees.length,wages:costs.salaries,running:costs.running,support:source?supportCost(s,source):0,rank:rank(s),sourceId:source?.modelId??null};
}
export function createManagementFeedback(state){return {version:FEEDBACK_VERSION,startedDay:state.gameDay,baselines:[{phase:state.career?.phase??1,complete:state.gameDay===0,snapshot:companySnapshot(state)}],events:[],expenses:[],seen:[]};}
export function nextBillPreview(s,{wages}={}){
  const day=(Math.floor(s.gameDay/7)+1)*7,costs=operatingCosts(s),base=baseSubscriptionIncome(s),media=mediaCampaign(s,day).income,social=isCareer(s)?socialIncome(s,base,day):0,support=isCareer(s)?supportCost(s,careerSubscription(s)):0;
  const income=Math.max(0,base+media+social+s.pendingBonus+s.pendingNews),salaries=wages??costs.salaries;
  return {day,base,media,social,bonus:s.pendingBonus,news:s.pendingNews,income,salaries,running:costs.running,support,net:income-salaries-costs.running-support,cash:s.cash+income-salaries-costs.running-support};
}
// A conditional warning, never a promise about unknown future releases or rank changes.
export function cashflowSignal(s){
  if(s.ending)return null;
  const bill=nextBillPreview(s),reserve=s.project?rulesFor(s).publicationCost:0;
  if(bill.cash<0)return `按当前收支，第${bill.day}日账单后现金将为${bill.cash}万，可能破产；先检查账单和人手。`;
  if(reserve&&Math.min(s.cash,bill.cash)<reserve)return `本款还需${reserve}万发布费；目前现金${s.cash}万，第${bill.day}日账单后预计${bill.cash}万。先留发布预算。`;
  return null;
}
export function decisionImpact(s,action){
  const trial=applyAction(s,action);if(!trial.ok)return {ok:false,error:trial.error};
  const after=trial.state,cost=Math.max(0,s.cash-after.cash),rp=(s.career?.rp??0)-(after.career?.rp??0),result={ok:true,action:clone(action),cost,rp,cash:after.cash,workersBefore:isCareer(s)?workers(s).length:s.employees.length,workersAfter:isCareer(after)?workers(after).length:after.employees.length,bill:nextBillPreview(after),effects:[],days:null};
  if(after.career?.study&&['startStudy','startPromotion','startMaintenance','acceptContract'].includes(action.type)){
    const task=after.career.study;result.days=task.days;result.employeeId=task.employeeId;result.auxiliary=true;result.reservedCompute=studyCompute(after);result.taskCompute=['course','promotion'].includes(task.kind)?0:1;
    if(['course','promotion','method','replicate'].includes(task.kind)){
      const done=clone(after);done.career.study.progress=task.days-1;done.career.stamina[task.employeeId]=100;delete done.career.resting[task.employeeId];finishCareerTasks(done);
      const id=task.employeeId;
      result.growth={before:employeeAbilities(s,id),after:employeeAbilities(done,id),experienceBefore:[...s.employeeExperience[id]],experienceAfter:[...done.employeeExperience[id]],capsBefore:EMPLOYEES[id].abilities.map((v,i)=>v+(s.career.caps[id]?.[i]??6)),capsAfter:EMPLOYEES[id].abilities.map((v,i)=>v+(done.career.caps[id]?.[i]??6)),salaryBefore:employeeTerms(s,id).salary,salaryAfter:employeeTerms(done,id).salary};
      const completedWages=operatingCosts(done).salaries;result.completedBill=nextBillPreview(after,{wages:completedWages});
      if(task.kind==='promotion'&&s.campaignProfile==='career336v3')result.effects.push('完成后本人普通研发贡献持续增加10个百分点，后续每7日工资增加1万。方案、实验、特殊奖励与辅助任务不加成；本版本仅可晋升一次。');
      if(task.kind==='method')result.effects.push(COMPANY_METHODS[task.target].details);
      if(task.kind==='replicate'){
        const source=s.models.find(model=>model.id===task.target),upper=learningGains(s.knowledge,source);
        result.effects.push('复现完成后，新立项的模型才能参考这份资料；当前在研和已发布型号都不追加收益。');
        // New projects start at the company's current knowledge or higher.
        // Research adds scores before learning, so this is a ceiling, not a
        // prediction of the next release or a reward for finishing the task.
        result.effects.push(upper.some(value=>value>0)?`按公司目前的积累，这份资料最多能增加${DIRECTIONS.map((direction,i)=>`${labels[direction]} +${upper[i]}`).join(' / ')}。新项目只选一份最合适的已复现资料，不叠加；研发本身也会提高分数，到时从资料里学到的可能更少，甚至为0。`:'按公司目前的积累，复现这份资料已经不能带来额外分数；完成后只会留下学习记录。');
      }
    }
    if(task.kind==='maintenance')result.effects.push(careerSubscription(s).modelId===task.modelId?'完成后减少该型号后续支持费，不退旧账。':'此型号当前不承担订阅，完成后不承诺本期少支出。');
    if(task.kind==='contract')result.effects.push(`完成并按时交付后才获得${task.reward}万、${task.research}研究点，这笔待交付报酬没有提前计入账单预估。`);
  }
  if(after.career?.study&&['startStudy','startPromotion','startMaintenance','acceptContract','selectResearcher'].includes(action.type)){
    const remainingWork=after.career.study.days-after.career.study.progress,remainingDays=rulesFor(after).lastDay-after.gameDay;
    // The known calendar ending is a hard limit. Rest may make a task later,
    // but an unknown future retirement or bankruptcy is not a predicted date.
    if(remainingWork>remainingDays)result.effects.push(`本局距第${rulesFor(after).lastDay}日结算只剩${remainingDays}日，此任务至少还需${remainingWork}个有效工作日，结算前无法完成。未完成收益不会发放，已付费用不退。`);
  }
  if(action.type==='resolveDataProposal')result.effects.push(action.choice==='clean'?'追加2工作单位，预防1项上线问题；实验成功率增加5个百分点，上限90%。':action.choice==='supplement'?`追加4工作单位，完成后${labels[s.project.focus]}增加${s.project.dataProposal.reward}分。`:'保留原计划，不追加费用和工作量。');
  if(action.type==='resolveExperiment'&&action.decision==='approve')result.effects.push(`成功：${labels[s.project.focus]}+${s.project.experiment.reward}分。失败：不加分${isNextCareer(s)?'，并增加1项上线问题':''}；费用和投入的研究点不退。`,'需4工作单位。完成后无论成败获得2研究点。');
  if(action.type==='beginIssueFix')result.effects.push('追加2工作单位；修复该项服务问题，榜分不变。');
  if(action.type==='createProject')result.effects.push(`本代训练费${cost}万立即支付，另留发布费${rulesFor(s).publicationCost}万和公司账单。`);
  if(action.type==='hire'||action.type==='dismiss')result.effects.push(`公司每期工资${operatingCosts(s).salaries}→${operatingCosts(after).salaries}万。`);
  return result;
}
export function socialAttribution(s,day=(Math.floor(s.gameDay/7)+1)*7,{base=baseSubscriptionIncome(s)}={}){
  const cap=Math.min(5,Math.floor(base*.1));
  const rows=(s.career?.campaigns??[]).map(item=>{let reason=null;if(item.settled)reason='已结算';else if(!item.modelId)reason='待正式发布兑现预热';else if(day>item.untilDay)reason='到结算日已过期';else if(!cap)reason='基础订阅过低，取整为0';else if(item.heat<35)reason='热度未达门槛或预热未兑现';const expected=reason?0:Math.floor(cap*(item.heat>=60?1:.5));if(!reason&&!expected)reason='热度档折算后取整为0';return {key:item.key,day:item.day,modelId:item.modelId,heat:item.heat,expected,reason};});
  const selected=rows.filter(r=>!r.reason).sort((a,b)=>b.expected-a.expected||a.day-b.day)[0];
  for(const r of rows)if(!r.reason&&r!==selected)r.reason='本账单采用其他宣传，不叠加';
  return {day,base,cap,selectedKey:selected?.key??null,amount:selected?.expected??0,rows};
}
function addExpense(record,before,after,action){
  const map={createProject:'训练',resolveDataProposal:'数据',resolveExperiment:'实验',beginIssueFix:'发布前验证',publish:'发布',startStudy:'公司研修',startPromotion:'晋升',startMaintenance:'维护',postSocial:'推广'};
  if(!map[action.type])return;
  const publication=action.type==='publish',receipt=publication?after.notices.slice(before.notices.length).find(n=>n.type==='published'):null;
  const cost=publication?(receipt?.cost??rulesFor(before).publicationCost+(action.media?mediaCost(before,action.presenter??publicationPresenter(before)):0)):Math.max(0,before.cash-after.cash);
  const rp=(before.career?.rp??0)-(after.career?.rp??0);if(!cost&&!rp)return;
  const projectId=action.type==='createProject'?after.project?.id:before.project?.id;
  const id=`expense:${after.acceptedActions.length}`;if(record.expenses.some(e=>e.id===id))return;
  record.expenses.push({id,day:after.gameDay,kind:map[action.type],projectId:['createProject','resolveDataProposal','resolveExperiment','beginIssueFix','publish'].includes(action.type)?projectId:null,modelId:action.modelId??null,cash:cost,rp:Math.max(0,rp)});
}
// Freeze task-specific proceeds at completion. A same-day cash/RP delta could
// also include payroll, a project experiment or an award, so it is not a receipt.
function completedTaskResult(before,after){
  const task=before.career?.study;
  if(!task||after.career?.study||!after.notices.slice(before.notices.length).some(n=>n.type==='study-complete'&&n.employeeId===task.employeeId&&n.label===task.label))return null;
  if(task.kind==='method')return {kind:'method',target:task.target,levelBefore:before.career.methods[task.target],levelAfter:after.career.methods[task.target]};
  if(task.kind==='replicate'){
    const source=after.models.find(m=>m.id===task.target);
    if(source&&!before.career.learned.includes(source.id)&&after.career.learned.includes(source.id))return {kind:'replicate',sourceId:source.id,sourceName:source.name,sourceCompany:source.company};
  }
  if(task.kind==='contract'){
    const receipt=after.career.contracts.find(c=>c.key===task.key);
    if(receipt?.status==='completed')return {kind:'contract',contractKey:receipt.key,cash:receipt.reward,rp:receipt.research,completedDay:receipt.finishedDay};
  }
  return null;
}
function expiredContractResult(before,after){
  const task=before.career?.study;
  if(task?.kind!=='contract'||after.career?.study)return null;
  const previous=before.career.contracts.find(c=>c.key===task.key),receipt=after.career.contracts.find(c=>c.key===task.key);
  if(previous?.status!=='running'||receipt?.status!=='expired')return null;
  const notice=after.career.posts.find(p=>p.id===`expired:${receipt.key}`&&p.day>before.gameDay);
  if(!notice)return null;
  return {day:notice.day,data:{contractKey:receipt.key,label:receipt.label,employeeId:task.employeeId,startedDay:receipt.startedDay,deadline:receipt.deadline,
    missedCash:receipt.reward,missedResearch:receipt.research,period:receipt.period,periodUsed:after.career.contracts.filter(c=>c.period===receipt.period).length}};
}
// Cache only facts derived by the real action replay. Extend reuse requires the
// full previously verified history to match, including its campaign/seed.
let taskEvidenceCache={history:[],entries:new Map()};
function taskEvidenceFor(state){
  const history=state.acceptedActions.map(action=>JSON.stringify(action));
  if(taskEvidenceCache.history.length>history.length||!taskEvidenceCache.history.every((text,i)=>text===history[i]))taskEvidenceCache={history:[],entries:new Map()};
  taskEvidenceCache.history=history;
  return index=>{
    if(taskEvidenceCache.entries.has(index))return taskEvidenceCache.entries.get(index);
    let evidence=null;
    try{
      const before=replayActions(state.acceptedActions.slice(0,index-1)),after=replayActions(state.acceptedActions.slice(0,index)),result=completedTaskResult(before,after),task=before.career?.study;
      const expired=expiredContractResult(before,after);
      evidence={completed:result?{day:after.gameDay,taskId:task.id,employeeId:task.employeeId,kind:task.kind,result}:null,expired};
    }catch{/* An invalid or non-completing prefix cannot substantiate a result. */}
    taskEvidenceCache.entries.set(index,evidence);return evidence;
  };
}
export function captureManagementFeedback(record,before,after,action={type:'advanceTo'}){
  if(!isCareer(after)||before===after)return record;
  const r=clone(record??createManagementFeedback(before)),index=after.acceptedActions.length;
  const push=(type,key,data,facts=[],day=after.gameDay)=>{const id=`${type}:${key}`;if(r.events.some(e=>e.id===id))return;const event={id,type,day,actionIndex:index,data:JSON.parse(JSON.stringify(data)),comments:comments(r,id,facts)};r.events.push(event);};
  addExpense(r,before,after,action);
  for(const model of after.models.filter(m=>m.company==='player'&&!before.models.some(old=>old.id===m.id))){
    const previous=own(before).at(-1),deltas=previous?model.scores.map((v,i)=>v-previous.scores[i]):null,issues=unresolvedIssues(model),source=careerSubscription(after),facts=[];
    if(issues.length)facts.push({category:'issue',fact:`${model.name}：${issues.map(i=>issueLabel(i.id)).join('、')}仍未处理。`});
    if(deltas)facts.push(deltas.some(d=>d>0)?{category:'improvement',fact:DIRECTIONS.map((d,i)=>`${labels[d]} ${previous.scores[i]}→${model.scores[i]}`).join('，')}:{category:'limited',fact:'三项正式成绩均未超过上一款。'});
    else facts.push({category:'debut',fact:`首代${model.name}的正式成绩为${model.scores.join('/')}。`});
    if(model.policy==='open')facts.push({category:'open',fact:'权重与运行资料已公开。'});
    push('release',model.id,{modelId:model.id,name:model.name,previousId:previous?.id??null,previousScores:previous?.scores??null,scores:model.scores,deltas,rankBefore:rank(before),rankAfter:rank(after),sourceBefore:careerSubscription(before),sourceAfter:source,sourceName:after.models.find(m=>m.id===source.modelId)?.name??null,issues:issues.map(i=>i.id),policy:model.policy,expenses:r.expenses.filter(e=>e.projectId===before.project?.id),bestScores:previous?DIRECTIONS.map((_,i)=>Math.max(...own(before).map(m=>m.scores[i]))):null},facts);
  }
  const newNotices=after.notices.slice(before.notices.length);
  const expired=expiredContractResult(before,after);
  if(expired)push('contract-expired',expired.data.contractKey,expired.data,[],expired.day);
  if(before.career.study?.kind!=='maintenance'&&before.career.study&&!after.career.study&&newNotices.some(n=>n.type==='study-complete')){
    const t=before.career.study,id=t.employeeId,started=[...r.events].reverse().find(e=>e.type==='task-start'&&e.data.taskId===t.id);
    const result=completedTaskResult(before,after);
    push('task-complete',`${t.id}:${after.gameDay}`,{employeeId:id,taskId:t.id,kind:t.kind,label:t.label,startedDay:started?.day??null,before:started?.data.growth??null,abilities:employeeAbilities(after,id),caps:EMPLOYEES[id].abilities.map((v,i)=>v+(after.career.caps[id]?.[i]??6)),salary:employeeTerms(after,id).salary,cost:t.cost,rp:t.rp,...(result?{result}:{})},t.kind==='contract'?[]:[{category:'talent',fact:`${EMPLOYEES[id].name}的${t.label}在第${after.gameDay}日完成。`}]);
  }
  if(['startStudy','startPromotion','startMaintenance','acceptContract'].includes(action.type)&&after.career.study){const t=after.career.study;push('task-start',t.id,{taskId:t.id,employeeId:t.employeeId,kind:t.kind,label:t.label,growth:{abilities:employeeAbilities(before,t.employeeId),caps:EMPLOYEES[t.employeeId].abilities.map((v,i)=>v+(before.career.caps[t.employeeId]?.[i]??6)),salary:employeeTerms(before,t.employeeId).salary}});}
  for(const model of after.models){
    const old=before.models.find(m=>m.id===model.id);
    if(old&&old.policy!=='open'&&model.policy==='open')push('open',model.id,{modelId:model.id,name:model.name},[{category:'open',fact:`${model.name}已于第${after.gameDay}日开放。`}]);
    if(!old&&model.learningSourceId&&before.models.some(m=>m.id===model.learningSourceId&&m.company==='player')&&model.learningBonus.some(n=>n>0))push('learning',model.id,{modelId:model.id,sourceId:model.learningSourceId},[{category:'learning',fact:`${model.company} ${model.name}实际吸收${model.learningBonus.join('/')}。`}]);
    if(old)for(const issue of model.issues??[])if(issue.resolved&&old.issues?.some(i=>i.id===issue.id&&!i.resolved))push('maintenance',`${model.id}:${issue.id}`,{modelId:model.id,name:model.name,issueId:issue.id,issueName:issueLabel(issue.id),employeeId:before.career.study?.employeeId??null,supportBefore:supportCost(before,careerSubscription(before)),supportAfter:supportCost(after,careerSubscription(after))},[{category:'repair',fact:`${model.name}的${issueLabel(issue.id)}已处理；发布成绩不变。`}]);
  }
  for(const bill of after.bills.slice(before.bills.length)){
    const at=socialAttribution(before,bill.day,{base:bill.base}),campaigns=after.career.campaigns.filter(c=>!before.career.campaigns.find(p=>p.key===c.key)?.settled&&c.settled);
    push('bill',bill.day,{billDay:bill.day,bill,selectedKey:campaigns.find(c=>c.income>0)?.key??null,campaigns:campaigns.map(c=>({key:c.key,day:c.day,heat:c.heat,income:c.income??0,reason:c.income>0?'实际被采用':at.rows.find(p=>p.key===c.key)?.reason??'未被采用，宣传不叠加'}))});
  }
  if(action.type==='postSocial'){const c=after.career.campaigns.at(-1);push('promotion',c.key,{key:c.key,modelId:c.modelId,heat:c.heat,immediateFans:after.career.fans-before.career.fans,cost:1,kind:action.kind,tone:action.tone});}
  for(const c of after.career.campaigns){const old=before.career.campaigns.find(x=>x.key===c.key);if(old&&!old.modelId&&c.modelId)push('preheat',c.key,{key:c.key,modelId:c.modelId,fulfilled:c.heat>0,fans:c.heat>0?(c.bold?6:3):-Math.min(3,before.career.fans)});}
  for(const award of (after.career.awards??[]).slice(before.career.awards?.length??0)){
    const results=award.results.filter(x=>x.company==='player');if(results.length)push('award',award.day,{results,cash:award.cash,fans:award.fans,first:!(before.career.awards??[]).some(a=>a.results.some(x=>x.company==='player'))},[{category:'award',fact:results.map(x=>`${x.name}获${x.category}`).join('；')}]);
  }
  if(after.career.assessment&&!before.career.assessment||after.ending&&!before.ending){
    const phase=after.career.phase,baseline=r.baselines.find(b=>b.phase===phase),models=own(after).filter(m=>m.day>(baseline?.snapshot.day??0)&&m.day<=after.gameDay).sort((a,b)=>(a.bestRank??99)-(b.bestRank??99)||total(b)-total(a)||a.sequence-b.sequence);
    push('phase',phase,{phase,baseline:baseline?.complete?baseline.snapshot:null,end:companySnapshot(after),representativeId:models[0]?.id??null,representativeName:models[0]?.name??null,representativeRank:models[0]?.bestRank??null,newModels:baseline?.complete?own(after).length-baseline.snapshot.count:null,bills:after.bills.filter(b=>b.day>(baseline?.snapshot.day??after.gameDay)).map(b=>b.day)});
  }
  if(action.type==='continueCareer'&&!r.baselines.some(b=>b.phase===after.career.phase))r.baselines.push({phase:after.career.phase,complete:true,snapshot:companySnapshot(after)});
  r.events=r.events.slice(-768);r.expenses=r.expenses.slice(-1024);const ids=new Set(r.events.map(e=>e.id));r.seen=r.seen.filter(id=>ids.has(id));return r;
}
export function validManagementFeedback(r,s){
  const record=x=>x&&typeof x==='object'&&!Array.isArray(x),integer=(x,max)=>Number.isInteger(x)&&x>=0&&x<=max;
  if(!record(r)||r.version!==1||!integer(r.startedDay,s.gameDay)||Object.keys(r).some(k=>!['version','startedDay','baselines','events','expenses','seen'].includes(k)))return false;
  if(!Array.isArray(r.baselines)||r.baselines.length>3||!Array.isArray(r.events)||r.events.length>768||!Array.isArray(r.expenses)||r.expenses.length>1024||!Array.isArray(r.seen)||r.seen.length>768)return false;
  const bounded=(x,depth=0)=>depth<=9&&(x===null||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x)||typeof x==='string'&&x.length<=2400||Array.isArray(x)&&x.length<=1024&&x.every(v=>bounded(v,depth+1))||record(x)&&Object.keys(x).length<=40&&Object.values(x).every(v=>bounded(v,depth+1)));
  if(!bounded(r))return false;
  const types=['release','task-start','task-complete','contract-expired','open','learning','maintenance','bill','promotion','preheat','award','phase'];
  const taskEvidence=r.events.some(e=>e?.type==='contract-expired'||e?.type==='task-complete'&&e.data&&Object.hasOwn(e.data,'result'))?taskEvidenceFor(s):null;
  const ids=new Set();for(const e of r.events){if(!record(e)||typeof e.id!=='string'||e.id.length>180||ids.has(e.id)||!types.includes(e.type)||!integer(e.day,s.gameDay)||!integer(e.actionIndex,s.acceptedActions.length)||!record(e.data)||!Array.isArray(e.comments)||e.comments.length>3)return false;ids.add(e.id);
    if(e.type==='release'&&!s.models.some(m=>m.id===e.data.modelId&&m.company==='player'&&m.scores.every((n,i)=>n===e.data.scores?.[i])))return false;
    if(e.type==='bill'&&!s.bills.some(b=>b.day===e.data.billDay&&JSON.stringify(b)===JSON.stringify(e.data.bill)))return false;
    if(e.type==='task-complete'&&Object.hasOwn(e.data,'result')){
      if(!e.actionIndex||!record(e.data.result))return false;
      const expected=taskEvidence(e.actionIndex)?.completed;
      if(!expected||expected.day!==e.day||['taskId','employeeId','kind'].some(key=>e.data[key]!==expected[key]))return false;
      if(Object.keys(e.data.result).length!==Object.keys(expected.result).length||Object.keys(expected.result).some(key=>e.data.result[key]!==expected.result[key]))return false;
    }
    if(e.type==='contract-expired'){
      if(!e.actionIndex)return false;
      const expected=taskEvidence(e.actionIndex)?.expired;
      if(!expected||e.id!==`contract-expired:${expected.data.contractKey}`||e.day!==expected.day||Object.keys(e.data).length!==Object.keys(expected.data).length||Object.keys(expected.data).some(key=>e.data[key]!==expected.data[key]))return false;
    }
    for(const c of e.comments)if(!record(c)||!COMMENT_POOLS[c.category]||!integer(c.template,5)||!['author','text','reply','fact'].every(k=>typeof c[k]==='string'))return false;
  }
  if(r.seen.some(id=>!ids.has(id))||new Set(r.seen).size!==r.seen.length)return false;
  return r.baselines.every(b=>integer(b.phase,3)&&b.phase>0&&typeof b.complete==='boolean'&&record(b.snapshot)&&integer(b.snapshot.day,s.gameDay))&&r.expenses.every(e=>record(e)&&typeof e.id==='string'&&integer(e.day,s.gameDay)&&integer(e.cash,1000000)&&integer(e.rp,1000000));
}

import {isCareer,workers} from './game/career.js';
import {unresolvedIssues} from './game/career-next.js';
import {canWaitForPlanner,publicationPresenter,productionSummary} from './game/rules.js';

function developmentAdvice(project,activeCount){
  if(project.status==='issue-fix')return `这项验证已经做了 ${project.issueFix.progress} / 2 工作量。验证完会先停下来，再由你决定要不要发布；模型成绩已经定了，这次处理的是上线问题。`;
  if(project.status==='data-work')return project.dataProposal.choice==='clean'
    ?`正在去掉重复样本、补回归检查，已经做了 ${project.dataProposal.progress} / 2 工作量。做完接着训练，并减少一项原本会留下的上线问题。`
    :`新增资料正在整理，已经做了 ${project.dataProposal.progress} / 4 工作量。完成后主攻增加 ${project.dataProposal.reward} 分，再接着训练。`;
  if(project.status==='experiment')return `加跑已经做了 ${project.experiment.progress} / 4 工作量。成功能给主攻增加 ${project.experiment.reward} 分；结果还没出来，先别把这几分写进发布稿。`;
  return `现在有 ${activeCount} 位员工参与研发。员工能力决定能做出多少成绩，算力决定做得多快。先看看这一代长得怎样；有人休整时，其他人会接着做。`;
}

// Advice reads actual company state and never creates economic progress.
export function onboardingStep(state, {skipped=false,financeReviewed=false}={}) {
  const career=isCareer(state),project=state.project,issues=unresolvedIssues(project),active=career?workers(state):state.employees;
  const staffingBlocked=career&&project&&(project.status==='planning'?project.plannerId!==null&&(!active.includes(project.plannerId)||state.career.stamina[project.plannerId]<26):!active.length);
  let step;
  if(state.ending)step={id:'ended',title:'经营结束了',copy:'模型成绩和每期账单都存着，可以继续查看。',goal:'查看结局与公司记录',action:'查看排行榜',target:'ranking',complete:true};
  else if(career&&state.career.assessment)step={id:'assessment',title:'先看看这一阶段的结果',copy:'先确认阶段报告，再选择继续经营或结算离场。继续会保留团队、在研项目和资源。',goal:'处理阶段评估',action:'查看阶段报告',target:'assessment'};
  else if(career&&['data-offer','experiment-offer'].includes(project?.status))step={id:project.status,title:project.decisionWaiting?'提案还在等你决定':'研发有一项提案待决定',copy:project.decisionWaiting?'目前主线没有推进；时间继续时会恢复体力，也会结算账单。休整好后可以重新查看提案，或按原计划继续。':'先比较追加费用、工作量和收益，再决定是否投入；也可以保留预算，按原计划继续。',goal:project.status==='data-offer'?'决定本代数据投入':'决定是否追加实验',action:'查看待定提案',target:'decision'};
  else if(!state.employees.length)step={id:'hire',title:'公司现在没人做研发了',copy:`先招一位员工，才能继续研发或主持发布。已经做好的成果都还在。${canWaitForPlanner(state)?'也可以继续时间等待招聘开放；主线不推进，账单照常。':''}`,goal:'招聘一位员工',action:'前往人才市场',target:'hiring'};
  else if(career&&state.career.study&&!state.career.study.employeeId)step={id:'researcher',title:'辅助任务还缺一位接手人',copy:'原参与者已离职，已付费用和任务进度保留。到研发页选择员工接续，也可以取消任务；有期限的委托仍会计时。',goal:'为辅助任务补充参与者',action:'接续辅助任务',target:'project'};
  else if(project?.status==='ready'&&issues.length)step={id:'release-issues',title:'模型评测完成，还有上线问题',copy:`目前有 ${issues.length} 项待处理。可以先付费验证，也可以接受问题发布、之后维护；榜分已经确定，支持费取决于本款是否支撑订阅。`,goal:'比较修复与携问题发布',action:'查看上线清单',target:'project'};
  else if(project?.status==='ready'&&!publicationPresenter(state))step={id:'presenter-wait',title:'模型已经完成，正在等人主持发布',copy:'现有员工正在休整或处理其他任务，暂时没有可主持的人。继续时间可以恢复体力并推进已有任务；模型成绩保留，期间账单照常结算。',goal:'等待员工可主持发布',action:state.paused?'继续时间，等待员工':'查看人员状态',target:state.paused?'resume':'team'};
  else if(state.project?.status==='ready')step={id:'release',title:'模型做完了，准备发布吧',copy:'这款已经做完。可以选媒体写报道，也可以直接发布；正式发布后，这款成绩才能参榜。',goal:'筹备发布会',action:'筹备发布会',target:'release'};
  else if(canWaitForPlanner(state))step={id:'planner-wait',title:'暂时没有能接手方案的员工',copy:'现有员工正在处理其他任务。可以继续时间让任务结束，也可招聘新人；方案进度保留，期间账单照常结算。有人空闲后，再到研发页选择负责人。',goal:'等待任务完成或补充人手',action:state.paused?'继续时间，等待接手':'查看人员状态',target:state.paused?'resume':'team'};
  else if(state.project?.status==='planning'&&state.project.plannerId===null)step={id:'planner',title:'方案还没做完，负责人走了',copy:'到研发页选个人接手。已经用掉的设计时间保留，不用再付训练费。',goal:'重新选择方案负责人',action:'重选方案负责人',target:'project'};
  else if(staffingBlocked)step={id:'staffing',title:project.status==='planning'?'方案负责人暂时不能工作':'主线正在等人返岗',copy:'有人正在休整或处理其他任务。经营时间继续时，体力恢复和已有辅助任务照常推进；可以到团队页查看人员状态。',goal:'等待恢复，或调整人员安排',action:state.paused?'继续恢复与任务':'查看人员状态',target:state.paused?'resume':'team'};
  else if(career&&!project&&state.employees.every(id=>state.assignments[id]?.kind==='reset'||state.career.study?.employeeId===id))step={id:'project-staffing',title:'下一款模型还缺能接手方案的人',copy:'现有员工都在处理其他任务，暂时不能担任方案负责人。继续时间让任务完成，或招聘新人；等待期间工资与账单照常。',goal:'等待任务完成或补充人手',action:state.paused?'继续时间，等待接手':'查看人员状态',target:state.paused?'resume':'team'};
  else if(!state.project&&state.models.some(m=>m.company==='player')&&financeReviewed)step={id:'next-project',title:'接下来做哪款',copy:'看看榜上差哪一项。想补能力就招人，想缩短工期就买算力，也可以直接开下一款。',goal:'开发下一款模型',action:'开发下一款模型',target:'project',complete:true};
  else if(!state.project&&state.models.some(m=>m.company==='player'))step={id:'published',title:'模型已经上榜',copy:'先看这次花了多少钱、下期能收多少订阅费。达标融资当场到账；订阅和发布奖励在账单结算时到账。',goal:'查看收入与扩张',action:'查看资金与扩张',target:'finance',complete:true};
  else if(!state.project)step={id:'project',title:'先定第一款做什么',copy:'给模型起名，选编程、办公或多模态，再挑一个员工负责方案。卡片上能比较每个人的三项能力。立项先付训练费，别把发布费和工资也花了。',goal:'选择方案负责人并立项',action:'带我去立项',target:'project'};
  else if(state.paused)step={id:'start',title:'现在暂停着',copy:'点“继续经营”，员工就会接着干活。不用逐人派任务，想停下来随时按暂停。',goal:'继续推进当前项目',action:'继续经营',target:'resume'};
  else if(state.project.status==='planning')step={id:'planning',title:'负责人正在做方案',copy:'方案完成后会给出三项初始成绩，可工作的同事接着处理数据。休整或研修中的员工回来后再加入。现在可以等，也可以去看进度。',goal:'等待方案交付',action:'查看方案进度',target:'project'};
  else step={id:'research',title:project.status==='issue-fix'?'团队正在验证上线问题':project.status==='data-work'?'团队正在整理追加数据':project.status==='experiment'?'团队正在进行追加实验':'在岗员工正在研发',copy:developmentAdvice(project,productionSummary(state).activeEmployeeIds.length),goal:'查看这一阶段还差多少',action:'查看研发进度',target:'project'};
  return {...step,skipped,showGuidance:!skipped&&!step.complete};
}

// Office orientation has its own saved UI preferences, separate from live goals.
const TOUR_STEPS = [
  { id:'office', title:'老板，我是小满', copy:'我是公司秘书小满，帮你看账、招人、安排发布。先带你认一下按钮。', items:['办公室里能看到员工工位、老板和秘书的位置。搬迁后布局会变化，员工会走动、休整和返岗。','不知道接下来做什么，就点“问小满”。'], targets:['.office-card'] },
  { id:'dashboard', title:'钱、排名和设备看这里', copy:'最上面这排会跟着经营情况变化。刚开张还没产品，所以没有名次和评价。', items:['现金：训练、发布、招聘、工资和买算力都从这里扣。','综合榜：模型正式发布后才有公司名次。','算力：显示研发占用与设备总量，更多算力更快。','用户评价：首款模型发布后才会出现。'], targets:['.dashboard'] },
  { id:'time', title:'用这里暂停或加速', copy:'时间走动时，员工才会干活，账单也会到期。要算预算就先暂停。', items:['继续经营与暂停：随时切换。','1、2、4 倍速：按自己的节奏玩。','打开管理页或切走页面时临时暂停，返回后自动继续；主动暂停会保留。'], targets:['.timebar'] },
  { id:'production', title:'研发、员工和招聘', copy:'做模型在“模型研发”，看现有员工在“团队能力”，想招新人就去“人才市场”。', items:['模型研发：起型号名、选主攻方向与方案负责人。','团队能力：查看员工能力、使用主动能力，自动特性有生效说明。','人才市场：招聘已开放人才，后续随进度增加。'], targets:['.office-navigation [data-panel-target="project"]','.office-navigation [data-panel-target="team"]','.office-navigation [data-panel-target="hiring"]'] },
  { id:'business', title:'查榜单、账目和消息', copy:'这几个按钮用来查结果。介绍完以后，我会带你做第一款模型。', items:['排行榜：看真实模型成绩，也能打开型号介绍。','资金扩张：小满解释收支，也在这里买设备、增工位。','行业快讯：看竞品发布、挖人和设备报价。','用户反馈：看发布反响与维护追评；Rebo 的额度重置提高评价，但不会替你修复上线问题。'], targets:['.office-navigation [data-panel-target="ranking"]','.office-navigation [data-panel-target="finance"]','.office-navigation [data-panel-target="news"]','.office-navigation [data-panel-target="feedback"]'] },
];
export function tourStep(progress = {}) {
  const index = Number.isInteger(progress.tourStep) ? Math.max(0, Math.min(TOUR_STEPS.length-1, progress.tourStep)) : 0;
  return { ...TOUR_STEPS[index], index, count:TOUR_STEPS.length, completed:progress.tourCompleted !== false };
}
export function updateTourProgress(progress, action) {
  const step = tourStep(progress);
  if (action === 'restart') return {tourStep:0,tourCompleted:false};
  if (action === 'skip') return {tourStep:step.index,tourCompleted:true};
  if (action === 'back') return {tourStep:Math.max(0,step.index-1),tourCompleted:false};
  if (action === 'next') return {tourStep:Math.min(step.count-1,step.index+1),tourCompleted:step.index===step.count-1};
  return {tourStep:step.index,tourCompleted:step.completed};
}

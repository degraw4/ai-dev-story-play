import {actionError as errorReason} from './action-errors.js';
import {careerTimeline,feedPage,FEED_FILTERS} from './career-feed.js';
import {decisionImpact,socialAttribution} from './management-feedback.js';
import {impactCard} from './management-feedback-ui.js';
import {createTeamUI,recoveryDisplay} from './career-team-ui.js';
import {createCharacterPortrait} from './character-art.js';
import {createNextCareerUI} from './career-next-ui.js';
import {isNextCareer, pendingProjectDecision} from './game/career-next.js';
import { isCareer, trainingQuote, studyQuote, careerSubscription, socialIncome } from './game/career.js';
import { TRAINING_PLANS, COMPANY_METHODS, DIRECTIONS, EMPLOYEES } from './game/content.js';
import { applyAction, releasesFor } from './game/rules.js';

const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const $=id=>document.getElementById(id);
const select=(id,label,items)=>{const box=node('label',label),input=node('select');input.id=id;input.setAttribute('aria-label',label);for(const [value,text]of items){const o=node('option',text);o.value=value;input.append(o);}box.append(input);return box;};
const button=(text,run,cls='')=>{const n=node('button',text,cls);n.type='button';n.addEventListener('click',run);return n;};
const title={coding:'编程',office:'办公',multimodal:'多模态'};
const topicLabels={office:'办公室',company:'公司记录',release:'模型发布',promotion:'公司推广',open:'权重开放',research:'研发交流',service:'服务公告',people:'人事动态',discussion:'开发者讨论',news:'行业消息'};
export function createCareerUI({getState,dispatch,confirm,getNews,savePause,onDecision,flushFeedback,getFeedback=()=>null,requestImpact=(a)=>dispatch(a),phaseCard}) {
  const profile=select('company-profile','经营版本',[['career336v3','经营优化版 · 336日 / 新公司'],['career336v2','研发决策旧版 · 保持旧规则'],['career336','原经营版 · 保持旧规则'],['startup112','经典原型 · 112日']]);
  profile.className='company-profile';$('company-form').prepend(profile);
  const training=select('training-plan','本代训练投入',Object.entries(TRAINING_PLANS).map(([key,value])=>[key,value.label]));
  training.className='career-only training-plan';$('project-form').insertBefore(training,$('project-form').querySelector('fieldset'));
  $('training-plan').value='standard';
  const quote=node('p',undefined,'training-quote');quote.id='career-training-quote';training.append(quote);
  const trainingComparison=node('details');trainingComparison.id='training-comparison';training.append(trainingComparison);
  const resources=node('p',undefined,'career-resources');resources.id='career-resources';document.querySelector('.secretary-text').append(resources);
  const policy=select('publication-policy','权重策略',[['closed','闭源 · 保留独占服务'],['open','开放权重 · 传播与同行学习']]);policy.className='career-only policy-picker';
  const policyHelp=node('p','开放权重后，官方 API 仍收费，但直接订阅可能分流；获得社区关注和有限评价，同行可在未来吸收。公开后不能收回。','fineprint');policy.append(policyHelp);$('publish-error').before(policy);
  const study=node('section',undefined,'card career-only study-card');study.id='career-study';study.append(node('h2','公司研修'),node('p','方法改进、个人进修与公开成果复现共用一个辅助名额。参与者暂离主线，工资照常。','muted'));
  const task=node('div');task.id='study-current';study.append(task);
  const form=node('div',undefined,'career-form');form.id='study-form';
  form.append(select('study-kind','研究用途',[['method','公司方法'],['course','个人进修'],['replicate','复现公开模型']]),select('study-target','研究内容',[]),select('study-employee','参与员工',[]));
  const studyHelp=node('p',undefined,'fineprint');studyHelp.id='study-quote';form.append(studyHelp);
  const startStudy=button('安排研修',()=>requestImpact({type:'startStudy',kind:$('study-kind').value,target:$('study-target').value,employeeId:$('study-employee').value},'安排这次研修？'),'primary');startStudy.id='start-study';form.append(startStudy);study.append(form);$('panel-project').querySelector('.panel-content').append(study);
  const feed=node('div');feed.id='career-feed';$('panel-news').querySelector('.panel-content').append(feed);
  const dialog=node('dialog');dialog.id='career-decision';dialog.setAttribute('aria-label','经营决策');dialog.addEventListener('cancel',event=>event.preventDefault());document.body.append(dialog);
  const nextUI=createNextCareerUI({getState,dispatch,onDecision,confirm});
  const teamUI=createTeamUI({getState,dispatch,confirm,requestImpact});
  const saveButtons=[];
  for(const surface of [...document.querySelectorAll('dialog'),...document.querySelectorAll('.presentation')]){
    const control=button('存档并暂停',()=>{control.textContent=savePause()?`已存档 · 第 ${getState().gameDay} 日 · 已暂停`:'保存失败 · 请导出进度';},'save-pause');
    (surface.querySelector('.presentation-top')??surface.querySelector('.panel-heading')??surface).append(control);saveButtons.push(control);
  }
  $('training-plan').addEventListener('change',renderTraining);
  $('publication-policy').addEventListener('change',refreshPolicy);
  $('study-kind').addEventListener('change',()=>renderStudy(true));$('study-target').addEventListener('change',()=>renderStudy(false));$('study-employee').addEventListener('change',()=>renderStudy(false));
  function renderTraining(){
    const state=getState();if(!isCareer(state))return;
    const first=!state.models.some(m=>m.company==='player');for(const option of $('training-plan').options)option.disabled=first&&option.value!=='standard';if(first)$('training-plan').value='standard';
    const q=trainingQuote(state,$('training-plan').value);quote.textContent=`立即训练费 ${q.cost} 万 · 四阶段工作量 ${q.work.join(' / ')}，合计 ${q.work.reduce((a,b)=>a+b,0)}。付款后现金 ${state.cash-q.cost} 万，另留 8 万基础发布费与工资；可选媒体费用另计。`;
    $('training-budget').textContent=`账上 ${state.cash} 万。${first?'首款先完成标准研发；第二款起开放三种投入。':'工作量不是日历天数，算力、体力、参与人数和辅助任务共同决定工期。'}`;
    trainingComparison.replaceChildren(node('summary','比较投入与经营取舍'));
    if(first)trainingComparison.append(node('p','首款固定标准研发，先走通发布和收入。后续开放赶档、标准与深训。','fineprint'));
    else {
      const scroller=node('div',undefined,'table-scroll'),table=node('table',undefined,'training-comparison-table');
      scroller.tabIndex=0;scroller.setAttribute('role','region');scroller.setAttribute('aria-label','三档投入对照，可左右滚动');
      table.append(node('caption','三档投入对照'));
      const head=node('thead'),header=node('tr');for(const title of ['投入','训练费','工作量','取舍']){const th=node('th',title);th.scope='col';header.append(th);}head.append(header);table.append(head);
      const body=node('tbody');
      for(const [id,plan]of Object.entries(TRAINING_PLANS)){
        const compare=trainingQuote(state,id),row=node('tr'),label=node('th',plan.label);label.scope='row';
        if(id===$('training-plan').value)row.setAttribute('aria-current','true');
        row.append(label,node('td',`${compare.cost} 万`),node('td',String(compare.work.reduce((a,b)=>a+b,0))),node('td',id==='rush'?'工期短、积累少'+(isNextCareer(state)?'，多 1 项上线问题':''):id==='deep'?'工期长、积累多，需多留账期支出':'时间、费用与成长折中'));body.append(row);
      }
      table.append(body);scroller.append(table);trainingComparison.append(scroller,node('p','左右滑动表格可查看完整取舍。','comparison-scroll-hint'));
    }
    trainingComparison.append(node('p','投入多不保证超过同行；还要看团队能力、在岗人手与实际贡献。未发布前没有新型号订阅，留出发布费和账期支出。','fineprint'));
  }
  function refreshPolicy(){
    const state=getState();if(!isCareer(state)||state.project?.status!=='ready')return;
    const trial=applyAction(state,{type:'publish',policy:$('publication-policy').value,...(isNextCareer(state)?{issuePolicy:'accept'}:{}),...($('media').value?{media:$('media').value}:{})});
    if(!trial.ok){policyHelp.textContent=`暂不能按当前选择发布：${errorReason(trial.error)}`;return;}
    const after=careerSubscription(trial.state),before=careerSubscription(state),model=trial.state.models.findLast(item=>item.company==='player');
    policyHelp.textContent=`本次发布后公司基础订阅预计 ${after.income} 万 / 7日（当前 ${before.income} 万），公司关注 +${trial.state.career.fans-state.career.fans}。${$('publication-policy').value==='open'?`本次开放额外提升评价 +${((model.openRatingGain??0)/10).toFixed(1)}。官方服务仍收费；该型号订阅按闭源金额的90%向下取整，公司采用收入最高的型号。权重公开不能收回，同行可在未来吸收。`:'保留权重独占，之后仍可选择开放旧作。'}`;
  }
  function renderStudy(reset=false){
    const state=getState();if(!isCareer(state))return;
    const c=state.career,kind=$('study-kind').value,target=$('study-target'),employee=$('study-employee'),oldTarget=target.value,oldEmployee=employee.value;
    const studyForm=$('study-form');if(studyForm)studyForm.hidden=!!state.ending;
    if(state.ending){
      const current=$('study-current');current.replaceChildren(node('p','经营已结束，研修进度停在结算时；未完成的成长与报酬不会补发。','fineprint'));
      if(c.study)current.append(node('strong',`${c.study.label} · 结算时未完成 · ${c.study.progress} / ${c.study.days} 有效工作日`),node('p',c.study.employeeId?`结算时负责人：${EMPLOYEES[c.study.employeeId].name}。`:'结算时没有负责人。','fineprint'));
      $('study-quote').textContent='';document.getElementById('study-impact')?.remove();startStudy.disabled=true;return;
    }
    // Levels and public sources can change while this dialog is closed. Rebuild
    // their labels/options every render, preserving a choice only if it exists.
    target.replaceChildren();const items=kind==='method'?Object.entries(COMPANY_METHODS).map(([key,value])=>[key,`${value.label} · ${c.methods[key]} / 2级`]):kind==='course'?DIRECTIONS.map(key=>[key,title[key]]):state.models.filter(m=>m.company!=='player'&&m.policy==='open'&&!c.learned.includes(m.id)).map(m=>[m.id,`${m.name} · ${m.scores.join(' / ')}`]);
    for(const [value,text]of items){const option=node('option',text);option.value=value;target.append(option);}if(items.some(([value])=>value===oldTarget))target.value=oldTarget;
    employee.replaceChildren();for(const id of state.employees){const o=node('option',`${EMPLOYEES[id].name} · 体力 ${c.stamina[id]}`);o.value=id;employee.append(o);}
    const candidateAction=id=>c.study&&!c.study.employeeId?{type:'selectResearcher',employeeId:id}:{type:'startStudy',kind,target:target.value,employeeId:id};
    if(state.employees.includes(oldEmployee))employee.value=oldEmployee;
    else {const available=state.employees.find(id=>applyAction(state,candidateAction(id)).ok);if(available)employee.value=available;}
    const current=$('study-current');current.replaceChildren();
    if(c.study){
      current.append(node('strong',`${c.study.label} · ${c.study.progress} / ${c.study.days} 有效工作日`),node('p',c.study.employeeId?`参与者 ${EMPLOYEES[c.study.employeeId].name}，体力 ${c.stamina[c.study.employeeId]}。休整日保留进度。`:'参与者已离职，选择一位员工继续；已付费用保留。','fineprint'));
      if(!c.study.employeeId){
        const resume=button('由下方所选员工接续',()=>dispatch({type:'selectResearcher',employeeId:employee.value})),trial=applyAction(state,{type:'selectResearcher',employeeId:employee.value});
        resume.disabled=!trial.ok;current.append(resume);
        if(!trial.ok)current.append(node('p',errorReason(trial.error),'fineprint'));
      }
    }
    let description=kind==='replicate'?'暂无可复现的新公开成果。':`当前选择：${target.selectedOptions[0]?.textContent??'未选择'}。`;
    try{const q=studyQuote(state,kind,target.value);description=`${q.label}：${q.rp} 研究点 + ${q.cost} 万，${q.days} 个有效工作日。${kind==='method'?COMPANY_METHODS[target.value].details:''}`;}catch{}
    $('study-quote').textContent=description;
    const trial=applyAction(state,{type:'startStudy',kind,target:target.value,employeeId:employee.value});startStudy.disabled=!trial.ok;
    if(!trial.ok)$('study-quote').textContent+=` ${errorReason(trial.error)}`;
    document.getElementById('study-impact')?.remove();if(trial.ok){const card=impactCard(decisionImpact(state,{type:'startStudy',kind,target:target.value,employeeId:employee.value}));card.id='study-impact';$('study-quote').after(card);}
  }
  let feedFilter='all',feedLimit=25;
  function renderFeed(){
    const state=getState();if(!isCareer(state))return;
    const draft={kind:$('social-kind')?.value,target:$('social-target')?.value,tone:$('social-tone')?.value};
    const target=$('career-feed');target.replaceChildren();
    target.append(node('h2',state.ending?'Xwitter · 公司动态档案':'Xwitter'),node('p',state.ending?`公司在第 ${state.gameDay} 日结束经营，留下 ${state.career.fans.toLocaleString()} 位关注者。可以筛选、回看此前动态，本局不再发布推广或结算新收入。`:`公司关注 ${state.career.fans.toLocaleString()} · 第 ${Math.floor(state.gameDay/7)+1} 个公关账期。自动发布的公司记录和行业消息不收推广费。`,'muted'));
    if(!state.ending){
    const calendar=node('details',undefined,'release-calendar');calendar.append(node('summary','后续发布与公开学习窗口'));
    for(const release of releasesFor(state).filter(item=>item.day>state.gameDay).slice(0,5))calendar.append(node('p',`第 ${release.day} 日 · ${release.company} ${release.name} · ${release.day-7<=state.gameDay?'资料已截止':`资料截止第 ${release.day-7} 日`}`,'fineprint'));
    calendar.append(node('p','只吸收截止日前已开放至少4日的资料，每项增量最多12分；最终成绩在发布日揭晓。','fineprint'));target.append(calendar);
    const composer=node('section',undefined,'social-composer');
    composer.append(select('social-kind','本期推广',[['preheat','预热在研型号'],['spotlight','介绍已发布型号'],['respond','回应同行发布']]),select('social-target','选择型号',[]),select('social-tone','语气',[]));
    const explain=node('p',undefined,'fineprint');explain.id='social-preview';composer.append(explain);
    const send=button('提交推广 · 1 万',()=>dispatch(socialAction()),'primary');send.id='send-social';composer.append(send);target.append(composer);
    function socialAction(){return {type:'postSocial',kind:$('social-kind').value,targetId:$('social-target').value,tone:$('social-tone').value};}
    function compose(){
      const kind=$('social-kind').value,models=kind==='preheat'?(state.project?[{id:`project:${state.project.id}`,name:state.project.name}]:[]):kind==='spotlight'?state.models.filter(m=>m.company==='player'):state.models.filter(m=>m.company!=='player'&&m.day>0&&state.gameDay-m.day<=7);
      const toneItems=kind==='preheat'?[['steady','普通 · 14日内发布，不承诺成绩'],['bold','激进 · 14日内发布，并承诺成绩']]:kind==='spotlight'?[['steady','分享使用记录'],['technical','展示测试条件']]:[['congratulate','真诚祝贺'],['technical','技术比较'],['snark','有依据地调侃']];
      $('social-target').replaceChildren();for(const m of models){const o=node('option',kind==='preheat'?m.name:`${m.name} · 第${m.day}日 · ${m.scores.reduce((n,v)=>n+v,0)}分`);o.value=m.id;$('social-target').append(o);}
      $('social-tone').replaceChildren();for(const [value,text]of toneItems){const o=node('option',text);o.value=value;$('social-tone').append(o);}preview();
    }
    function preview(){
      const trial=applyAction(state,socialAction());send.disabled=!trial.ok;if(!trial.ok){explain.textContent=errorReason(trial.error);return;}
      const c=trial.state.career.campaigns.at(-1),a=socialAttribution(trial.state),r=a.rows.find(r=>r.key===c.key);
      const commitment=socialAction().kind==='preheat'?`本次承诺：最迟第${c.untilDay}日（含当天）发布${c.bold?`，综合成绩至少${c.promise}分`:'，不设成绩门槛'}。${c.untilDay-state.gameDay<14?'经营将在第336日结束，截止日不会顺延。':''}满足条件时关注+${c.bold?6:3}；${c.bold?'逾期或成绩未达标':'逾期'}时关注最多减3，本次宣传收入为0。`:'';
      const fatigue=c.heatPercent!==undefined?`连续使用同一种推广形式第${c.repetition+1}期，热度按基础值的${c.heatPercent}%计算（${c.baseHeat} → ${c.heat}）；换一种推广形式或空过一个7日周期可恢复。`:'';
      explain.textContent=`${fatigue}立即付1万，付款后现金${trial.state.cash}万；本帖热度${c.heat}，即时关注+0。${commitment}按当前条件，第${a.day}日：${r?.reason??`预计加成${r?.expected??0}万`}，多帖不叠加。到账金额以实际账单为准。`;
    }
    $('social-kind').addEventListener('change',compose);$('social-target').addEventListener('change',preview);$('social-tone').addEventListener('change',preview);if(draft.kind)$('social-kind').value=draft.kind;compose();
    for(const [id,value]of [['social-target',draft.target],['social-tone',draft.tone]])if(value&&[...$(id).options].some(o=>o.value===value))$(id).value=value;preview();
    }
    const timeline=careerTimeline(state,getFeedback(),getNews());
    const filters=node('div',undefined,'feed-filters');filters.setAttribute('aria-label','动态分类');
    for(const [id,label]of FEED_FILTERS){const b=button(label,()=>{feedFilter=id;feedLimit=25;renderFeed();});b.setAttribute('aria-pressed',String(id===feedFilter));filters.append(b);}target.append(filters);
    const page=feedPage(timeline,{filter:feedFilter,limit:feedLimit});
    target.append(node('p',`显示 ${page.items.length} / ${page.total} 条动态`,'fineprint'));
    if(!page.items.length)target.append(node('p','这个分类还没有动态。','muted'));
    for(const item of page.items){
      const article=node('article',undefined,'x-post');article.dataset.postId=item.id;
      const header=node('div',undefined,'x-post-heading'),authorId=Object.keys(EMPLOYEES).find(id=>item.author===id||EMPLOYEES[id].name===item.author);header.append(authorId?createCharacterPortrait(authorId,{size:34}):node('span',item.author.slice(0,1),'x-avatar'),node('strong',item.author),node('small',`第 ${item.day} 日 · ${topicLabels[item.topic]??'动态'}`));article.append(header,node('p',item.text));
      for(const reply of item.replies)article.append(node('p',reply,'x-reply'));target.append(article);
    }
    if(page.remaining)target.append(button(`加载更早动态（还有 ${page.remaining} 条）`,()=>{feedLimit+=25;renderFeed();},'feed-more'));
  }
  let decisionKey=null,experimentPoints=0;
  function resetDecisionDraft(){decisionKey=null;experimentPoints=0;}
  function renderDecision(){
    const state=getState(),c=state.career;
    const pending=!state.ending&&(c.assessment||pendingProjectDecision(state));
    if(!pending){resetDecisionDraft();if(dialog.open)dialog.close();return;}
    const key=`${state.campaignProfile}:${c.seed}:${c.assessment?.day??''}:${state.project?.id??''}`;
    if(key!==decisionKey){decisionKey=key;experimentPoints=0;}
    dialog.replaceChildren();
    if(c.assessment){
      dialog.append(node('h2',`阶段评估 · ${c.assessment.result}`),node('p',`第 ${c.assessment.day} 日，截止前已发布 ${c.assessment.modelCount} 款，综合第 ${c.assessment.rank??'—'}，现金 ${c.assessment.cash} 万。继续后保留团队、项目、研究与全部资源。`),button('继续经营',()=>onDecision({type:'continueCareer'}),'primary'),button('结算离场',()=>confirm('结束这家公司的经营？','保留本次阶段报告并进入最终结局。',()=>dispatch({type:'retire'}),{danger:true,confirmLabel:'结算离场'})));
      if(phaseCard)dialog.insertBefore(phaseCard(),dialog.children[2]);
    }else if(nextUI.renderDataDecision(dialog)){
    }else{
      const e=state.project.experiment;
      dialog.append(node('h2',`${EMPLOYEES[e.employeeId].name} 提议追加实验`),node('p',`追加一轮${title[state.project.focus]}实验，投入研究点可提高成功率。选择“按原计划继续”不支付实验费用。`),select('experiment-points','投入研究点',[[0,'不投入'],[4,'4点 · 成功率+10个百分点'],[8,'8点 · 成功率+20个百分点']]));
      $('experiment-points').value=String(experimentPoints);
      const chance=node('p'),impact=node('div');dialog.append(chance,impact);const approve=button('批准实验',()=>onDecision({type:'resolveExperiment',decision:'approve',points:Number($('experiment-points').value)}),'primary');dialog.append(approve,button('按原计划继续',()=>onDecision({type:'resolveExperiment',decision:'skip'})));
      function update(){const points=Number($('experiment-points').value);experimentPoints=points;chance.textContent=`成功率 ${Math.min(90,e.baseChance+e.methodBonus+points*2.5)}% · 现有研究点 ${c.rp} · 现金 ${state.cash} 万`;approve.disabled=c.rp<points||state.cash<e.cost;impact.replaceChildren(impactCard(decisionImpact(state,{type:'resolveExperiment',decision:'approve',points})));}$('experiment-points').addEventListener('change',update);update();
    }
    if(isNextCareer(state)&&pendingProjectDecision(state)&&!c.assessment)dialog.append(button('先等待休整 · 主线暂不推进',()=>onDecision({type:'waitProjectDecision'})));
    const save=button('存档并暂停',()=>{const ok=savePause();const current=dialog.querySelector('.decision-save');if(current)current.textContent=ok?'已存档 · 待决策状态保留':'保存失败 · 请导出进度';},'save-pause decision-save');dialog.append(save);
    if(!dialog.open){flushFeedback();dialog.showModal();}
  }
  function render(){
    for(const control of saveButtons)control.textContent='存档并暂停';
    const state=getState(),active=isCareer(state);for(const n of document.querySelectorAll('.career-only'))n.hidden=!active;resources.hidden=!active;
    $('career-feed').hidden=!active;$('news-list').hidden=active;
    $('panel-title-news').textContent=active?'Xwitter · 行业与同事':'行业快讯';
    const nav=document.querySelector('.office-navigation [data-panel-target="news"]');nav.replaceChildren(node('span','▧'),document.createTextNode(active?'Xwitter':'行业快讯'));
    if(!active){if(dialog.open)dialog.close();nextUI.render();teamUI.render();return;}
    const c=state.career;resources.textContent=`研究 ${c.rp} 点 · 公司关注 ${c.fans.toLocaleString()} · 第 ${c.phase} 阶段`;
    renderTraining();renderStudy(true);renderFeed();
    for(const id of state.employees){const row=document.querySelector(`#employee-list [data-employee="${id}"]`);if(!row)continue;const recovery=recoveryDisplay(state,id);row.append(node('p',recovery.label,'stamina-label'));
      const control=button(recovery.button,()=>dispatch({type:recovery.action,employeeId:id}));control.disabled=recovery.disabled;row.append(control);}
    for(const model of state.models.filter(m=>m.company==='player')){
      const row=[...$('model-history').children].find(n=>n.dataset.modelId===model.id);if(!row)continue;
      row.append(node('small',`${model.policy==='open'?'权重已开放':'闭源服务'}${model.learningSourceId?` · 参考 ${state.models.find(m=>m.id===model.learningSourceId)?.name??model.learningSourceId}，吸收 ${model.learningBonus.join(' / ')}`:''}`));
      if(model.policy==='open'&&Number.isFinite(model.openFans)&&Number.isFinite(model.openRatingGain))row.append(node('small',`开放当时：关注 +${model.openFans}，评价 +${(model.openRatingGain/10).toFixed(1)}。该型号订阅按闭源金额的90%向下取整，公司仍采用收入最高的型号。`));
      nextUI.renderHistory(model,row);
      if(model.policy==='closed'){const open=button('开放旧作权重',()=>{
        const trial=applyAction(state,{type:'openModel',modelId:model.id});if(!trial.ok)return;
        const opened=trial.state.models.find(item=>item.id===model.id);
        confirm(`开放 ${model.name} 的权重？`,`开放后不能收回。公司基础订阅预计 ${careerSubscription(state).income} → ${careerSubscription(trial.state).income} 万 / 7日，关注 +${opened.openFans}，评价 +${(opened.openRatingGain/10).toFixed(1)}。该型号订阅按闭源金额的90%向下取整，公司仍采用收入最高的型号。同行可在后续学习窗口吸收，过去账单不回算。`,()=>dispatch({type:'openModel',modelId:model.id}),{confirmLabel:'开放权重'});
      });open.disabled=!!state.ending;row.append(open);}
    }
    if(!state.ending){
    const source=careerSubscription(state),model=state.models.find(m=>m.id===source.modelId);$('subscription-status').textContent=model?`本期订阅由 ${model.name} 支撑 · ${source.direction===null?'综合':title[DIRECTIONS[source.direction]]}计费参考第 ${source.referenceRank} · ${source.policy==='open'?`开放分流前 ${source.raw}，实际 ${source.income}`:`闭源 ${source.income}`} 万。计费参考位次与公开公司榜分别展示。${state.funding.includes('overall')?'综合计费已解锁登顶档位；本期采用收入较高的综合或专项方案。':'取得综合榜首融资后，后续订阅档位提高。'}`:'正式首发后由综合或专项成绩支撑订阅。';
    const social=socialIncome(state,source.income,(Math.floor(state.gameDay/7)+1)*7),dt=node('dt','Xwitter 短期获客'),dd=node('dd',`${social} 万`);const ledger=$('bill-preview');ledger.insertBefore(dt,ledger.querySelector('dt.total'));ledger.insertBefore(dd,ledger.querySelector('dt.total'));
    }
    if(!state.ending&&state.project)$('research-estimate').textContent+=' 预估已计入当前体力、自动休整与研修；未来调人或追加实验会改变工期。';
    const next=[112,224,336].find(day=>day>state.gameDay)??336;$('deadline-warning').hidden=state.gameDay<next-7||!!state.ending;$('deadline-warning').textContent=next<336?`第 ${next} 日阶段评估，采用此前已发布成绩；在研项目和公司资源可以继续保留。`:'最后可发布日335，336日最终结算。';
    nextUI.render();teamUI.render();renderDecision();
  }
  return {issuePolicy:nextUI.issuePolicy,render,renderDecision,renderFeed,refreshPolicy,resetDecisionDraft,trainingPlan:()=>getState().models.some(model=>model.company==='player')?$('training-plan').value:'standard',publicationPolicy:()=>$('publication-policy').value};
}

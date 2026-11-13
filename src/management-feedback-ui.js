import {actionError as reason} from './action-errors.js';
import {decisionImpact,nextBillPreview,socialAttribution} from './management-feedback.js';
import {EMPLOYEES,DIRECTIONS,COMPANY_METHODS} from './game/content.js';
import {isCareer} from './game/career.js';
import {pendingProjectDecision} from './game/career-next.js';
import {createCharacterPortrait} from './character-art.js';
import {drawCelebration} from './stage-art.js';

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,run)=>{const b=el('button',text);b.type='button';b.addEventListener('click',run);return b;};
const names=['编程','办公','多模态'],money=n=>`${n}万`,signed=n=>`${n>0?'+':''}${n}`;
const row=(label,value)=>{const n=el('div',undefined,'feedback-fact');n.append(el('span',label),el('strong',value));return n;};
export function impactCard(q){
  const box=el('section',undefined,'impact-card');if(!q.ok){box.append(el('p',`当前不可安排：${reason(q.error)}`));return box;}
  box.append(el('p',`立即支付${q.cost}万${q.rp?`、${q.rp}研究点`:''}，付款后现金${q.cash}万。`,'impact-lead'));
  box.append(row('主线人手',`${q.workersBefore}→${q.workersAfter}人`));
  if(q.auxiliary)box.append(row('辅助名额与算力',`占1名额，${q.taskCompute?`当前预留${q.reservedCompute}算力；执行时占${q.taskCompute}，休整时不占`:'不占算力'}`));
  if(q.days)box.append(row('任务工作量',`${q.days}有效工作日；休整会延后`));
  if(q.growth){const g=q.growth;DIRECTIONS.forEach((_,i)=>{if(g.before[i]!==g.after[i]||g.capsBefore[i]!==g.capsAfter[i]||g.experienceBefore[i]!==g.experienceAfter[i])box.append(row(names[i],`能力${g.before[i]}→${g.after[i]}；上限${g.capsBefore[i]}→${g.capsAfter[i]}；累计经验${g.experienceBefore[i]}→${g.experienceAfter[i]}`));});box.append(row('完成后每期工资',`${g.salaryBefore}→${g.salaryAfter}万`));}
  q.effects.forEach(text=>box.append(el('p',text,'fineprint')));
  const detail=el('details'),summary=el('summary',`第${q.bill.day}日账单预估 · 收支${signed(q.bill.net)}万`);detail.append(summary);
  for(const [label,value]of [['基础订阅',q.bill.base],['媒体加成',q.bill.media],['Xwitter加成',q.bill.social],['已确定待到账奖励',q.bill.bonus],['行业消息调整',q.bill.news],['工资',-q.bill.salaries],['设备',-q.bill.running],['支持费',-q.bill.support]])detail.append(row(label,money(value)));
  detail.append(row('付款并结账后预计现金',money(q.bill.cash)));
  if(q.completedBill&&q.completedBill.cash!==q.bill.cash)detail.append(el('p',`若任务在账单前完成，工资${q.completedBill.salaries}万，净入${signed(q.completedBill.net)}万，结算后现金${q.completedBill.cash}万。`));
  detail.append(el('p','以上以排名、来源和其他安排不变为条件；未发布模型、未交付委托和未来融资不提前计入。','fineprint'));box.append(detail);return box;
}
export function releaseCard(record,model){
  const box=el('section',undefined,'management-feedback-card');box.append(el('h3','这一代，进步在哪里？'));
  const event=record?.events.find(e=>e.type==='release'&&e.data.modelId===model.id);
  if(!event){box.append(el('p','此历史发布未保存前后对照；正式成绩和现有型号履历仍可查看。','fineprint'));return box;}
  const d=event.data;
  const select=el('select');select.setAttribute('aria-label','发布成绩比较口径');for(const [value,title]of [['previous','上一款正式型号'],['best','发布前各专项历史最佳']]){const o=el('option',title);o.value=value;select.append(o);}
  const stats=el('div');function render(){stats.replaceChildren();const previous=select.value==='best'?d.bestScores:d.previousScores;names.forEach((name,i)=>stats.append(row(name,previous?`${previous[i]}→${d.scores[i]}（${signed(d.scores[i]-previous[i])}）`:`首代 ${d.scores[i]}`)));}
  select.addEventListener('change',render);render();box.append(select,stats,row('当次公司综合名次',`${d.rankBefore??'未发布'}→${d.rankAfter}`),row('当次基础订阅预估',`${d.sourceBefore.income}→${d.sourceAfter.income}万/期`),row('当次支撑型号',d.sourceName??'历史名称未保存'));
  box.append(el('p','这些是发布当时的记录；当前排名与账单请在资金页查看。','fineprint'));
  for(const c of event.comments){const p=el('article',undefined,'feedback-opinion');p.append(el('strong',c.author),el('p',c.text),el('small',c.fact),el('p',c.reply,'fineprint'));box.append(p);}
  const expenses=el('details');expenses.append(el('summary','本代已付项目费用（不分摊公司工资与设备）'));for(const e of d.expenses)expenses.append(row(`第${e.day}日 · ${e.kind}`,`${e.cash}万${e.rp?`、${e.rp}研究`:''}`));box.append(expenses);return box;
}
export function phaseCard(event,state){
  const box=el('section',undefined,'management-feedback-card');if(!event){box.append(el('p','此阶段没有保存期初和期末对照。现有阶段结果仍保留。'));return box;}
  const d=event.data,b=d.baseline,e=d.end;box.append(el('h3','这阶段，公司长大了多少？'));
  if(!b)box.append(el('p','旧记录没有保存阶段开始时的数据，以下只显示结束时的结果。','fineprint'));
  const compare=(key,unit='')=>b?`${b[key]}→${e[key]}${unit}`:`${e[key]}${unit}`;
  box.append(row('现金（资金变化，不是利润）',compare('cash','万')),row('累计发布',compare('count','款')),row('公司关注',compare('fans')),row('团队',compare('employees','人')),row('工资',compare('wages','万/期')),row('设备',compare('running','万/期')),row('支持费',compare('support','万/期')),row('本阶段代表型号',d.representativeName?`${d.representativeName} · 最好综合第${d.representativeRank??'—'}`:'本阶段没有可确认的新发布'));
  const current=state.models.find(m=>m.id===e.sourceId);box.append(row('期末订阅由谁支撑',current?.name??'尚未形成订阅'));
  const hints=[];
  if(state.ending)hints.push('本局已结束，时间和未完成任务不再推进。这里保留已发生的经营记录，可回看，不会再产生收入或完成奖励。');
  if(e.day!==state.gameDay)hints.push(`这是第${e.day}日的阶段记录，订阅来源和现金都是当时的数据，不代表今天的收支。`);
  if(!state.ending&&e.day===state.gameDay){
    const forecast=nextBillPreview(state);
    if(forecast.cash<0||forecast.net<0)hints.push(`按当前条件，第${forecast.day}日账单净额${signed(forecast.net)}万；下一笔培养前先留工资。`);
    if(pendingProjectDecision(state))hints.push('还有研发提案待决定，可以先比较追加投入。');
    if(!hints.length&&current&&ownLast(state)?.id!==current.id)hints.push(`最新发布尚未替代${current.name}的订阅贡献，可对比两代投入。`);
    if(!hints.length)hints.push('公司资源和履历会保留，可以沿当前策略继续研发。');
  }
  for(const text of hints.slice(0,2))box.append(el('p',`小满：${text}`,'feedback-hint'));return box;
}
const ownLast=s=>s.models.filter(m=>m.company==='player').at(-1);
const campaignLabel=(s,key)=>{const c=s.career.campaigns.find(c=>c.key===key);return s.models.find(m=>m.id===c?.modelId)?.name??(key===`project:${s.project?.id}`?`${s.project.name}预热`:'历史宣传');};
export function createManagementFeedbackUI({getState,getRecord,setRecord,confirm,pause,save,savePause=()=>{pause();return save();},openPanel,sound,schedule,getSettings}){
  const archive=el('section',undefined,'card management-archive');archive.id='management-archive';document.querySelector('#panel-news .panel-content').append(archive);
  const costs=el('section',undefined,'card');costs.id='management-project-costs';document.querySelector('#panel-project .panel-content').append(costs);
  const receipts=el('section',undefined,'card');receipts.id='management-promotion-receipts';document.querySelector('#panel-finance .panel-content').append(receipts);
  const dialog=el('dialog');dialog.id='management-result-dialog';dialog.setAttribute('aria-label','经营结果');document.body.append(dialog);let timer=null,animation=null;
  function acknowledge(id){const r=getRecord();if(!r||r.seen.includes(id))return;setRecord({...r,seen:[...r.seen,id]});save();renderArchive();}
  function detail(event){
    pause();for(const d of document.querySelectorAll('dialog[open]'))d.close();acknowledge(event.id);dialog.classList.remove('award-celebration');dialog.replaceChildren(el('h2',`第${event.day}日 · ${{'task-complete':'培养与任务完成','contract-expired':'委托逾期',maintenance:'型号维护完成',award:'行业评选',phase:'阶段成长报告',promotion:'宣传记录',preheat:'预热兑现',open:'开放权重',learning:'同行学习'}[event.type]??'经营记录'}`));
    const data=event.data,s=getState();
    if(event.type==='phase')dialog.append(phaseCard(event,s));
    else if(event.type==='release'){const m=s.models.find(m=>m.id===data.modelId);if(m)dialog.append(releaseCard(getRecord(),m));}
    else if(event.type==='task-complete'){
      dialog.append(createCharacterPortrait(data.employeeId,{size:60}),el('h3',`${EMPLOYEES[data.employeeId].name} · ${data.label}`));
      if(data.kind==='promotion'&&s.campaignProfile==='career336v3')dialog.append(el('p','本次晋升后，本人普通研发贡献持续增加10个百分点；工资已增加1万/7日。方案、实验、特殊奖励与辅助任务不加成。'));
      const outcome=data.result,companyTask=['method','replicate','contract'].includes(data.kind);
      if(outcome?.kind==='method'){
        const percent=outcome.levelAfter*5,effect={data:`后续新项目的数据阶段贡献 +${percent}%`,training:`后续新项目的训练费 -${percent}%`,evaluation:`后续新项目的实验成功率 +${percent}个百分点`};
        dialog.append(row('公司方法升级',`${COMPANY_METHODS[outcome.target].label} · ${outcome.levelBefore}→${outcome.levelAfter}级`),el('p',effect[outcome.target]),el('p','在研项目与已发布型号不回改。','fineprint'));
      }else if(outcome?.kind==='replicate'){
        dialog.append(row('完成公开复现',`${outcome.sourceCompany} · ${outcome.sourceName}`),el('p','已加入后续新项目的学习候选。是否采用、增加多少分，还要看新项目与公开型号的成绩差距。'),el('p','在研项目与已发布型号不回改。','fineprint'));
      }else if(outcome?.kind==='contract'){
        dialog.append(row('委托实收报酬',money(outcome.cash)),row('委托新增研究点',`${outcome.rp}点`),row('实际交付日',`第${outcome.completedDay}日`),el('p','报酬已计入公司现金和研究点，不需要再领取。','fineprint'));
      }else if(companyTask)dialog.append(el('p','这条旧记录没有保留任务成果明细，无法确认当时具体增加了多少。','fineprint'));
      const growth=companyTask?el('details'):dialog;
      if(companyTask)growth.append(el('summary','员工能力与工资（完成当时）'));
      if(data.before){names.forEach((n,i)=>growth.append(row(n,`能力${data.before.abilities[i]}→${data.abilities[i]}；上限${data.before.caps[i]}→${data.caps[i]}`)));growth.append(row('完成前后每期工资',`${data.before.salary}→${data.salary}万`));}
      else{
        growth.append(el('p','没有任务开始时的对照，以下是完成当时的结果。'));
        names.forEach((n,i)=>growth.append(row(n,`能力${data.abilities?.[i]??'未保存'}；上限${data.caps?.[i]??'未保存'}`)));
        growth.append(row('完成时每期工资',data.salary===undefined?'未保存':money(data.salary)));
      }
      if(companyTask)dialog.append(growth);
      dialog.append(row('任务起止',`${data.startedDay===null||data.startedDay===undefined?'开始日未保存':`第${data.startedDay}日开始`} · 第${event.day}日完成`),row('本次已付费用',data.cost===undefined?'未保存':money(data.cost)),row('本次消耗研究点',data.rp===undefined?'未保存':`${data.rp}点`));
    }else if(event.type==='contract-expired'){
      dialog.append(el('h3',data.label),el('p',`第${data.deadline}日截止时未交付，本单已结束。`),row('未到账报酬',`${data.missedCash}万和${data.missedResearch}研究点`),el('p','这笔报酬没有计入现金或研究点，也不会在之后补发。'),row('接单时周期',`第${data.period*28}–${data.period*28+27}日 · 已接${data.periodUsed}/2单`),el('p','本单仍占该周期的接单次数，不因逾期返还。逾期时已释放辅助名额。','fineprint'));
    }else if(event.type==='award'){
      dialog.append(el('p',data.results.map(x=>`${x.name} · ${x.category}`).join('；')),row('本届已入账奖金',money(data.cash)),row('本届新增关注',`${signed(data.fans)}人`));
    }else if(event.type==='maintenance'){
      dialog.append(el('p',`${data.name}的${data.issueName??'上线问题'}已修复。`),row('完成当时，公司每期支持费',`${data.supportBefore}→${data.supportAfter}万`),el('p','修复不会重算这款模型的发布成绩，已结算的账单也不追溯退款。','fineprint'));
    }else if(event.type==='promotion'){
      dialog.append(row('本次发帖费',money(data.cost)),row('发帖时热度',data.heat),row('当时新增关注',`${signed(data.immediateFans)}人`),el('p','宣传收入等账单结算后再看；热度不会直接变成现金。','fineprint'));
    }else if(event.type==='preheat'){
      const model=s.models.find(m=>m.id===data.modelId);
      if(model)dialog.append(el('h3',model.name));
      dialog.append(el('p',data.fulfilled?'发布时满足了这次预热的条件。':'发布时未能兑现这次预热。'),row('这次预热带来的关注变化',`${signed(data.fans)}人`),el('p','这里是发布时的关注变化；宣传收入在账单中结算。','fineprint'));
    }else if(event.type==='open'){
      const model=s.models.find(m=>m.id===data.modelId);
      dialog.append(el('h3',data.name),el('p','这款模型的权重已经公开。'),row('开放日期',`第${event.day}日`),row('开放当时新增关注',Number.isFinite(model?.openFans)?`${signed(model.openFans)}人`:'这条旧记录未保存'),row('开放带来的评价变化',Number.isFinite(model?.openRatingGain)?`${signed(model.openRatingGain/10)}分（5分制）`:'这条旧记录未保存'),el('p','公司每期仍采用收入最高的型号；这里不以当前订阅回算开放当时的收入变化。如果同行实际采用，会另有“同行学习”记录。','fineprint'));
    }else if(event.type==='learning'){
      const model=s.models.find(m=>m.id===data.modelId),source=s.models.find(m=>m.id===data.sourceId);
      dialog.append(row('采用的公开型号',source?.name??'历史型号名称未保存'));
      if(model){
        dialog.append(row('采用方与发布型号',`${model.company} · ${model.name}`),row('该代发布日期',`第${model.day}日`));
        names.forEach((name,i)=>dialog.append(row(`${name} · 该代实际吸收`,model.learningBonus?.[i]===undefined?'未保存':signed(model.learningBonus[i]))));
        dialog.append(el('p','以上是这一次发布从公开型号中学到的增量，不是对方的总成绩。','fineprint'));
      }else dialog.append(el('p','这条历史记录没有保留采用方的型号明细。'));
    }
    for(const c of event.comments)dialog.append(el('p',`${c.author}：${c.text}`),el('p',c.reply,'fineprint'));
    dialog.append(button('返回办公室',()=>dialog.close()));const saveButton=button('存档并暂停',()=>{saveButton.textContent=savePause()?`已存档 · 第${getState().gameDay}日 · 已暂停`:'保存失败，请保留页面并导出进度';});dialog.append(saveButton);dialog.showModal();
  }
  dialog.addEventListener('close',()=>{clearTimeout(timer);cancelAnimationFrame(animation);sound('stop-award');schedule();});
  function request(action,title='确认这次安排？'){const q=decisionImpact(getState(),action);if(!q.ok)return false;confirm(title,impactCard(q),()=>{dispatchAction(action);});return true;}
  let dispatchAction=()=>{};
  function setDispatch(fn){dispatchAction=fn;}
  let archiveLimit=12;
  function renderArchive(){
    const r=getRecord(),events=(r?.events??[]).filter(e=>!['task-start','bill'].includes(e.type)).reverse(),expanded=archive.querySelector('details')?.open;
    archive.replaceChildren();const details=el('details');details.open=!!expanded;details.append(el('summary',`经营档案 · ${events.length}条记录${r?` · ${events.filter(e=>!r.seen.includes(e.id)).length}未读`:''}`));
    details.append(el('p','发布、培养、评选和阶段记录可随时回看，不重复结算。','fineprint'));
    for(const e of events.slice(0,archiveLimit)){const labels={release:'发布战报','task-complete':'培养与任务完成','contract-expired':'委托逾期',maintenance:'维护',award:'获奖',phase:'阶段报告',promotion:'宣传',preheat:'预热兑现',open:'开放权重',learning:'同行学习'};const b=button(`第${e.day}日 · ${labels[e.type]??'经营事件'}${e.data.name?` · ${e.data.name}`:''}${r.seen.includes(e.id)?'':' · 未读'}`,()=>detail(e));details.append(b);}
    if(events.length>archiveLimit)details.append(button(`查看更多经营记录（还有${events.length-archiveLimit}条）`,()=>{archiveLimit+=24;renderArchive();}));
    if(!events.length)details.append(el('p',getState().ending?'本局没有保存可回看的经营记录。':'这里还没有经营记录。之后的发布、培养和评选结果会保存在这里。','fineprint'));archive.append(details);
  }
  function render(){
    const s=getState(),r=getRecord(),active=isCareer(s);for(const n of [archive,costs,receipts])n.hidden=!active;if(!active)return;
    renderArchive();
    costs.replaceChildren(el('h2','本项目已付投入'));
    const entries=r?.expenses.filter(e=>e.projectId===s.project?.id)??[];
    if(!s.project)costs.append(el('p',s.ending?'本局没有未发布项目；已付投入保留在各型号档案，公司账单保留工资和设备支出。':'立项后，这里会列出本代项目的支出；工资和设备费请看公司账单。'));
    else {for(const e of entries)costs.append(row(`第${e.day}日 · ${e.kind}`,`${e.cash}万${e.rp?`、${e.rp}研究`:''}`));if(!entries.length)costs.append(el('p','旧记录没有保留本项目的费用明细，无法确认当时的支出。'));costs.append(row('已记录项目支出',`${entries.reduce((n,e)=>n+e.cash,0)}万`),el('p',s.ending?'本局已结束，以上为历史已付投入；未发布成果不再能发布，未完成任务不再产生收益。':`发布另需${8}万，媒体选购费用在发布页另列。`,'fineprint'));}
    receipts.replaceChildren(el('h2',s.ending?'宣传：实际结算记录':'宣传：预计与实收分开'));
    const attribution=s.ending?null:socialAttribution(s);receipts.append(el('p',s.ending?'经营已结束，以下保留实际宣传结算；未结算宣传不再产生获客收入。':`第${attribution.day}日：基础订阅${attribution.base}万，宣传上限${attribution.cap}万；预计采用${attribution.selectedKey?campaignLabel(s,attribution.selectedKey):'无'}，加成${attribution.amount}万。`,'fineprint'));
    for(const c of attribution?.rows.filter(c=>c.reason!=='已结算')??[])receipts.append(row(campaignLabel(s,c.key),c.reason??`预计${c.expected}万，待结算`));
    for(const e of (r?.events??[]).filter(e=>e.type==='bill').slice(-4).reverse()){receipts.append(el('h3',`第${e.day}日实际到账：Xwitter ${e.data.bill.socialIncome??0}万`));for(const c of e.data.campaigns)receipts.append(row(campaignLabel(s,c.key),`${c.income}万 · ${c.reason}`));}
    for(const id of s.employees){const target=document.querySelector(`#employee-list [data-employee="${id}"]`);if(!target)continue;
      if(!s.ending){const action={type:'startStudy',kind:'course',target:EMPLOYEES[id].specialty,employeeId:id},q=decisionImpact(s,action),b=button(`个人${names[DIRECTIONS.indexOf(action.target)]}进修`,()=>request(action,`安排${EMPLOYEES[id].name}进修？`));b.disabled=!q.ok;target.append(b);if(!q.ok)target.append(el('small',reason(q.error),'fineprint'));}
      const milestones=(r?.events??[]).filter(e=>e.data.employeeId===id&&e.type==='task-complete');if(milestones.length)target.append(el('small',`已记录培养：${milestones.map(e=>`第${e.day}日${e.data.label}`).join('；')}`));
      const first=s.models.find(m=>m.company==='player'&&(m.participation?.[id]??0)>0);if(first)target.append(el('small',`首次参与型号：${first.name}，实际参与${first.participation[id]}工作单位。`));
    }
    for(const model of s.models.filter(m=>m.company==='player')){const target=[...document.getElementById('model-history').children].find(n=>n.dataset.modelId===model.id);if(!target)continue;
      const d=el('details');d.className='management-model-history';d.append(el('summary','发布对照、投入与后续事件'),releaseCard(r,model));
      const followups=r?.events.filter(e=>e.type==='learning'?e.data.sourceId===model.id:e.type==='award'?e.data.results.some(result=>result.modelId===model.id):['maintenance','open'].includes(e.type)&&e.data.modelId===model.id)??[];
      for(const e of followups)d.append(button(`第${e.day}日 · ${e.type==='maintenance'?'维护追评':e.type==='open'?'开放':e.type==='learning'?'同行采用':'获奖'}`,()=>detail(e)));target.append(d);
    }
  }
  function maybeCelebrate(){
    const s=getState(),r=getRecord();if(!r||s.ending||pendingProjectDecision(s)||s.career?.assessment||document.hidden||document.querySelector('dialog[open]')||getSettings().awardScenes===false)return false;
    const event=r.events.find(e=>e.type==='award'&&e.data.first&&!r.seen.includes(e.id));if(!event)return false;
    detail(event);dialog.classList.add('award-celebration');dialog.prepend(el('p','★ 公司首次实际获奖','award-title'));const canvas=el('canvas');canvas.className='scene-art';canvas.setAttribute('aria-label','本公司在职员工庆祝获奖');dialog.append(canvas);drawCelebration(canvas,{champion:true,employeeIds:s.employees});sound('award');
    const finish=()=>{clearTimeout(timer);cancelAnimationFrame(animation);dialog.classList.remove('award-celebration');drawCelebration(canvas,{champion:true,employeeIds:s.employees});sound('stop-award');};
    const skip=button('跳过庆祝，保留完整结果',finish);dialog.prepend(skip);
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){const began=performance.now();const animate=now=>{if(!dialog.open)return;drawCelebration(canvas,{champion:true,employeeIds:s.employees,phase:Math.floor((now-began)/160)});if(now-began<3000)animation=requestAnimationFrame(animate);};animation=requestAnimationFrame(animate);timer=setTimeout(finish,3000);}else finish();return true;
  }
  function officeEvent(){const s=getState();if(!isCareer(s)||s.ending)return null;
    if(['data-offer','experiment-offer'].includes(s.project?.status)){const p=s.project,employeeId=(p.status==='data-offer'?p.dataProposal:p.experiment).employeeId;return {id:`proposal:${p.id}:${p.status}`,kind:'proposal',employeeId,label:`${EMPLOYEES[employeeId]?.name??'小满'}：有研发建议 · 点击处理`,open:()=>dispatchAction({type:'reviewProjectDecision'})};}
    const r=getRecord(),event=r?.events.findLast(e=>['task-complete','maintenance','contract-expired'].includes(e.type)&&!r.seen.includes(e.id));
    if(event?.type==='contract-expired')return {id:event.id,kind:'expired',employeeId:null,label:`${event.data.label}已逾期 · 查看`,open:()=>detail(event)};
    return event?{id:event.id,kind:'complete',employeeId:event.data.employeeId,label:`${EMPLOYEES[event.data.employeeId]?.name??'研发团队'}：${event.data.label??'维护'}完成 · 查看`,open:()=>detail(event)}:null;}
  return {render,request,setDispatch,detail,maybeCelebrate,officeEvent,releaseCard:model=>releaseCard(getRecord(),model),phaseCard:()=>phaseCard(getRecord()?.events.findLast(e=>e.type==='phase'&&e.data.phase===getState().career.phase),getState())};
}

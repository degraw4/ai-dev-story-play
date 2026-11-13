import {actionError} from './action-errors.js';
import {decisionImpact} from './management-feedback.js';
import {impactCard} from './management-feedback-ui.js';
import {isNextCareer, unresolvedIssues, pendingProjectDecision, ISSUE_TYPES, supportCost} from './game/career-next.js';
import {careerSubscription} from './game/career.js';
import {applyAction} from './game/rules.js';
import {EMPLOYEES,TRAINING_PLANS} from './game/content.js';

const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const label=id=>ISSUE_TYPES.find(t=>t.id===id)?.label??id;
export function createNextCareerUI({getState,dispatch,onDecision,confirm}) {
  const panel=el('section');panel.className='card';panel.id='next-career-project';
  document.querySelector('#panel-project .panel-content').append(panel);
  const releaseSummary=el('p');releaseSummary.id='release-issues-summary';document.getElementById('publish-error').before(releaseSummary);
  const acceptance=el('label');acceptance.className='issue-acceptance';
  const input=el('input');input.type='checkbox';input.id='accept-release-issues';
  acceptance.append(input,document.createTextNode('我已查看未处理问题，接受按当前状态发布及后续支持费用。'));
  document.getElementById('publish-error').before(acceptance);
  let releaseKey=null;
  function control(text,action,decision=false){
    const b=el('button',text);b.type='button';b.addEventListener('click',()=>decision?onDecision(action):dispatch(action));
    const trial=applyAction(getState(),action);b.disabled=!trial.ok||!!getState().ending;
    if(!trial.ok)b.title=actionError(trial.error);
    return b;
  }
  function render(){
    const s=getState(),p=s.project,active=isNextCareer(s);panel.hidden=!active;document.body.classList.toggle('career-next',active);
    acceptance.hidden=!active||!!s.ending||!unresolvedIssues(p).length;releaseSummary.hidden=!active||!!s.ending||!p?.issues;
    releaseSummary.textContent=p?.issues?`上线清单：${unresolvedIssues(p).map(i=>label(i.id)).join('、')||'无待处理项目'}。若本款支撑订阅，每期支持费${unresolvedIssues(p).length}万。可返回研发页先处理。`:"";
    if(releaseKey!==p?.id){releaseKey=p?.id;input.checked=false;}
    if(!active)return;
    panel.replaceChildren(el('h2','本代研发与上线检查'));
    if(s.ending){
      panel.append(el('p',p?'本局已结束，以下为未发布项目的结算记录；不能继续研发、验证或发布。':'本局已结束，没有未发布项目。'));
      if(p?.dataProposal)panel.append(el('p',`数据投入：${{skip:'按原计划',clean:'清洗与回归整理',supplement:'补充主攻语料'}[p.dataProposal.choice]??'结算时尚未决定'}${p.dataProposal.completed?' · 已完成':''}`));
      if(p?.status==='data-work')panel.append(el('p',`追加数据结算进度 ${p.dataProposal.progress} / ${p.dataProposal.choice==='clean'?2:4} 工作单位 · 已付 ${p.dataProposal.paid} 万；未完成收益未发放。`));
      if(p?.status==='issue-fix')panel.append(el('p',`${label(p.issueFix.issueId)}结算进度 ${p.issueFix.progress} / 2 工作单位 · 已付1万，验证未完成。`));
      if(p?.issues)for(const issue of p.issues)panel.append(el('p',`${label(issue.id)} · ${issue.resolved?'结算前已处理':'结算时未处理'}`));
      return;
    }
    if(!p){panel.append(el('p','首款先走通研发与发布。第二款开放数据提案，第三款开放追加实验。'));return;}
    if(['data-offer','experiment-offer'].includes(p.status)){
      panel.append(el('p',p.decisionWaiting?'主线等待决定；继续时间会恢复体力并照常结算账单。':'待决定；主线和经营时间已暂停。'));
      panel.append(control('查看待定提案',{type:'reviewProjectDecision'}));
    }
    if(p.dataProposal)panel.append(el('p',`数据投入：${{skip:'按原计划',clean:'清洗与回归整理',supplement:'补充主攻语料'}[p.dataProposal.choice]??'待决定'}${p.dataProposal.completed?' · 已完成':''}`));
    if(p.status==='data-work')panel.append(el('p',`已付 ${p.dataProposal.paid} 万 · 额外工作 ${p.dataProposal.progress} / ${p.dataProposal.choice==='clean'?2:4}，不产生普通经验或研究点。`));
    if(p.status==='issue-fix')panel.append(el('p',`验证 ${label(p.issueFix.issueId)} · ${p.issueFix.progress} / 2 工作单位；已付1万，完成后回到待发布。`));
    if(!p.issues){panel.append(el('p','上线清单在普通评测结束后生成。赶档增加一项，失败实验增加一项，完成清洗减少一项；首款为零。'));return;}
    panel.append(el('p',`三项榜分已完成评测。剩余 ${unresolvedIssues(p).length} 项服务回归；全部处理不改变榜分，也不代表模型绝对可靠。`));
    for(const issue of p.issues){
      const row=el('p',`${label(issue.id)} · ${issue.resolved?'已处理':'待处理'} · 来源：${{baseline:'基础回归',rush:'赶档',experiment:'失败实验'}[issue.source]}`);
      if(!issue.resolved&&p.status==='ready')row.append(control('处理 · 1万 / 2工作单位',{type:'beginIssueFix',issueId:issue.id},true));panel.append(row);
    }
    if(p.status==='ready')panel.append(el('p',`可处理后发布，也可携问题发布。若本款支撑订阅，每期支持费至多 ${unresolvedIssues(p).length} 万，发布后可安排维护。`));
  }
  function renderDataDecision(dialog){
    const s=getState(),p=s.project;if(!isNextCareer(s)||p?.status!=='data-offer')return false;
    const q=p.dataProposal;
    dialog.append(el('h2',`${EMPLOYEES[q.employeeId].name} 提议整理数据`),el('p','两种追加方案择一，也可保留预算。员工讨论不产生额外费用。'));
    dialog.append(el('p','清洗与回归：1万、2工作单位；上线问题减少1，本款实验成功率增加5个百分点，总上限90%。'),control('批准清洗',{type:'resolveDataProposal',choice:'clean'},true));
    const focus={coding:'编程',office:'办公',multimodal:'多模态'}[p.focus];
    dialog.append(el('p',`补充${focus}语料：${q.cost}万、4工作单位；完成后${focus}增加${q.reward}分。`),control(`补充${focus}语料`,{type:'resolveDataProposal',choice:'supplement'},true));
    const comparison=el('details');comparison.append(el('summary','比较付款后现金、人手与账单'));for(const choice of ['skip','clean','supplement']){comparison.append(el('h3',({skip:'按原计划',clean:'清洗数据',supplement:'补充语料'})[choice]),impactCard(decisionImpact(s,{type:'resolveDataProposal',choice})));}dialog.append(comparison);
    dialog.append(control('按原计划继续',{type:'resolveDataProposal',choice:'skip'},true));return true;
  }
  function renderHistory(model,row){
    if(!isNextCareer(getState())||!model.issues)return;
    const s=getState(),issues=unresolvedIssues(model);
    const details=el('details'),heading=el('summary','查看型号研发履历');details.append(heading);
    details.append(el('p',`发布时成绩 ${model.scores.join(' / ')} · ${model.bestRank===undefined?'暂无代表公司上榜记录':`代表公司时的最佳综合名次 ${model.bestRank}`} · ${TRAINING_PLANS[model.trainingPlan]?.label??'标准训练'}。`));
    if(model.breakdown){const b=model.breakdown;details.append(el('p',`继承基础 ${b.initial.join('/')}；方案增量 ${b.proposal.join('/')}；普通研发 ${b.ordinary.join('/')}；语料 ${b.data}，实验 ${b.experiment}，火爆 ${b.burst}，公开学习 ${b.learning.join('/')}。`));}
    for(const [id,work]of Object.entries(model.participation??{}))details.append(el('p',`${EMPLOYEES[id].name}：${work}个普通研发工作单位${work>=8?' · 合格经历':''}`));
    for(const award of s.career.awards??[])for(const result of award.results.filter(r=>r.modelId===model.id))details.append(el('p',`第${award.day}日获${result.category}称号`));
    row.append(details);
    row.append(el('p',s.ending?`结算时未处理上线问题：${issues.length}。本局已结束，不再产生后续支持费；已发生费用保留在公司账单中。`:`上线问题：${issues.length}；${careerSubscription(s).modelId===model.id?`本期支持费 ${supportCost(s,careerSubscription(s))} 万`:'当前不承担公司基础订阅，不收支持费'}。`));
    if(s.ending){for(const issue of issues)row.append(el('p',`${label(issue.id)} · 结算时未处理`));return;}
    for(const issue of issues){
      const wrap=el('div'),who=el('select');who.setAttribute('aria-label',`${model.name}（第${model.day}日发布）· 维护${label(issue.id)}的员工`);
      for(const id of s.employees){const option=el('option',EMPLOYEES[id].name);option.value=id;who.append(option);}
      const b=el('button',`维护${label(issue.id)} · 1万 / 2有效日`);b.type='button';
      const hint=el('p');hint.className='fineprint';hint.setAttribute('aria-live','polite');
      const actionFor=id=>({type:'startMaintenance',modelId:model.id,issueId:issue.id,employeeId:id});
      const available=s.employees.find(id=>applyAction(s,actionFor(id)).ok);
      if(available)who.value=available;
      function update(){
        const current=getState(),trial=applyAction(current,actionFor(who.value));
        b.disabled=!trial.ok||!!current.ending;
        const reason=current.ending?'本次经营已结束。':!current.employees.length?'先招聘一位员工。':trial.ok?'':actionError(trial.error);
        b.title=reason;hint.textContent=reason;hint.hidden=!reason;
      }
      who.addEventListener('change',update);update();
      b.addEventListener('click',()=>{
        const action=actionFor(who.value),impact=decisionImpact(getState(),action);
        if(!impact.ok){update();return;}
        confirm(`维护 ${model.name}？`,impactCard(impact),()=>dispatch(action));
      });
      wrap.append(who,b,hint);row.append(wrap);
    }
  }
  return {render,renderDataDecision,renderHistory,pending:()=>pendingProjectDecision(getState()),issuePolicy:()=>!acceptance.hidden&&input.checked?'accept':undefined};
}

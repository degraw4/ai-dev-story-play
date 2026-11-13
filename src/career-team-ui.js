import {actionError} from './action-errors.js';
import {decisionImpact} from './management-feedback.js';
import {impactCard} from './management-feedback-ui.js';
import {contractOffers,promotionQuote,promotionTargets,staffLevel,isBalancedCareer,promotionContributionPercent} from './game/career-team.js';
import {isNextCareer} from './game/career-next.js';
import {DIRECTIONS,EMPLOYEES} from './game/content.js';
import {applyAction,employeeAbilities,employeeTerms} from './game/rules.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const titles={coding:'编程',office:'办公',multimodal:'多模态',title:'只升职级（三项能力已满）'};
export function recoveryDisplay(state,id){
  const stamina=state.career.stamina[id],target=state.career.resting[id],recovered=target&&stamina>=target;
  if(state.ending)return {label:`结算时体力 ${stamina} / 100${target?` · 当时正在休整（目标 ${target}）`:''}`,button:'经营已结束',action:target?'returnToWork':'rest',disabled:true};
  const label=`体力 ${stamina} / 100`+(target?recovered?' · 已达到恢复目标；下一个经营日自动结束休整':` · 休整目标 ${target}；达标后的下一个经营日自动结束休整`:'');
  return {label,button:target?recovered?'结束休整':'提前结束休整':'安排休整',action:target?'returnToWork':'rest',disabled:!!state.ending||!!target&&stamina<60};
}
export function createTeamUI({getState,dispatch,confirm,requestImpact=(a)=>dispatch(a)}){
  const board=el('section');board.id='contract-board';board.className='card';document.querySelector('#panel-project .panel-content').append(board);
  const contractDrafts=new Map();let companyKey=null,lastHistoryLength=0;
  function render(){
    const s=getState(),c=s.career;board.hidden=!isNextCareer(s);if(board.hidden)return;
    const key=JSON.stringify(s.acceptedActions[0]);if(key!==companyKey||s.acceptedActions.length<lastHistoryLength)contractDrafts.clear();companyKey=key;lastHistoryLength=s.acceptedActions.length;
    board.replaceChildren(el('h2','技术委托与人员安排'),el('p',s.ending?'经营已结束，以下保留结算时的人员与委托记录；未完成的任务不再推进或补发报酬。':'方法、进修、晋升、委托和维护共用一个辅助名额。任务会分走人员，工资照常。'));
    if(c.study){
      const t=c.study;board.append(el('p',`${s.ending?'结算时未完成':'当前'}：${t.label} · ${t.progress}/${t.days}有效工作日${t.deadline?` · 约定截止第${t.deadline}日`:''}`));
      if(!s.ending){
      const cancel=el('button','取消当前辅助任务');cancel.type='button';cancel.disabled=!!s.ending;
      const consequence='已付费用不退，未完成进度与收益不保留。'+(t.kind==='contract'?`仍计入第 ${t.period*28}–${t.period*28+27} 日接单周期的次数，取消不返还。`:'');
      cancel.addEventListener('click',()=>confirm('取消当前辅助任务？',consequence,()=>dispatch({type:'cancelAuxiliaryTask'}),{danger:true,confirmLabel:'取消任务'}));board.append(cancel);
      }
    }
    const offers=s.ending?[]:contractOffers(s);
    for(const key of contractDrafts.keys())if(!offers.some(offer=>offer.key===key))contractDrafts.delete(key);
    if(!offers.length&&!s.ending)board.append(el('p','首次发布后或第14日开放委托。'));
    for(const offer of offers){
      const row=el('div');row.className='contract-offer';row.append(el('h3',offer.label),el('p',`${titles[offer.direction]}≥${offer.ability} · ${offer.days}有效工作日 · 接单后${offer.limit}日内交付 · 报酬${offer.reward}万和${offer.research}研究点。每天占1人1算力，消耗6体力。`));
      const select=el('select');select.setAttribute('aria-label',`${offer.label}负责人`);
      for(const id of s.employees){const o=el('option',`${EMPLOYEES[id].name} · ${titles[offer.direction]} ${employeeAbilities(s,id)[DIRECTIONS.indexOf(offer.direction)]}`);o.value=id;select.append(o);}
      const button=el('button','接受委托'),help=el('p');button.type='button';
      const action=()=>({type:'acceptContract',contractId:offer.key,employeeId:select.value});
      const previous=contractDrafts.get(offer.key),initial=s.employees.includes(previous)?previous:s.employees.find(employeeId=>applyAction(s,{type:'acceptContract',contractId:offer.key,employeeId}).ok);
      if(initial)select.value=initial;
      function update(){const current=getState(),trial=applyAction(current,action());button.disabled=!trial.ok;help.textContent=trial.ok?`预计最早第${current.gameDay+offer.days}日完成，休整会延后；截止第${current.gameDay+offer.limit}日。`:actionError(trial.error);return trial.ok;}
      select.addEventListener('change',()=>{contractDrafts.set(offer.key,select.value);update();});button.addEventListener('click',()=>{if(update())requestImpact(action(),'接受这份技术委托？');});update();row.append(select,button,help);board.append(row);
    }
    if(!s.ending)board.append(el('p',`本28日周期已接 ${c.contracts.filter(t=>t.period===Math.floor(s.gameDay/28)).length}/2 单；取消与逾期也计数。`));
    for(const t of c.contracts.slice(-4))board.append(el('p',`${t.label} · ${s.ending&&t.status==='running'?'结算时未交付':{running:'进行中',completed:'已交付',expired:'已逾期',cancelled:'已取消'}[t.status]}`));
    for(const id of s.employees){
      const row=document.querySelector(`#employee-list [data-employee="${id}"]`);if(!row)continue;
      const controls=el('div');controls.className='promotion-controls';row.append(controls);
      controls.append(el('p',`职位：${['','成员','资深成员','技术负责人'][staffLevel(s,id)]} · 合格已发布经历 ${c.modelExperience[id]?.length??0} 款`));
      const names=(c.modelExperience[id]??[]).map(key=>s.models.find(m=>m.id===key)?.name??key);if(names.length)controls.append(el('small',`合格经历：${names.join('、')}`));
      if(isBalancedCareer(s))controls.append(el('p',promotionContributionPercent(s,id)?'本人普通研发贡献持续 +10个百分点；工资每7日增加1万。方案、实验、特殊奖励及辅助任务不加成。':'新版晋升仅一次：完成后本人普通研发贡献持续 +10个百分点，后续每7日工资增加1万。'));
      if(s.ending||isBalancedCareer(s)&&staffLevel(s,id)>=2)continue;
      const select=el('select');select.setAttribute('aria-label',`${EMPLOYEES[id].name}晋升方向`);
      for(const target of promotionTargets(s,id)){const o=el('option',titles[target]);o.value=target;select.append(o);}
      const button=el('button','安排晋升'),help=el('p');button.type='button';
      const action=()=>({type:'startPromotion',employeeId:id,target:select.value});
      function update(){const trial=applyAction(s,action());button.disabled=!trial.ok;
        try{const q=promotionQuote(s,id,select.value);help.textContent=`${q.cost}万 + ${q.rp}研究点，${q.days}有效日；完成后工资 ${employeeTerms(s,id).salary} → ${employeeTerms(s,id).salary+1}万/期，${q.target==='title'?'三项能力已满，仅提升职级，不增加能力经验':'指定项+120经验及成长空间'}。${isBalancedCareer(s)?'本人普通研发贡献持续 +10个百分点；方案、实验和辅助任务不加成。':''}员工暂离主线，工资照常。${trial.ok?'':actionError(trial.error)}`;}
        catch(error){help.textContent=actionError(error.message);}}
      select.addEventListener('change',update);button.addEventListener('click',()=>requestImpact(action(),`为${EMPLOYEES[id].name}安排晋升？`));update();controls.append(select,button,help);
    }
  }
  return {render};
}

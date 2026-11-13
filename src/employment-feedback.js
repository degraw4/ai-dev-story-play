import {applyAction,operatingCosts,quotaResetStatus,rulesFor} from './game/rules.js';
import {EMPLOYEES} from './game/content.js';

// Read-only consequence quote. The reducer remains the only authority for
// affordability, compensation, task ownership and what survives a departure.
export function dismissalImpact(state,id){
  const trial=applyAction(state,{type:'dismiss',employeeId:id});
  if(!trial.ok)return {ok:false,error:trial.error,cost:0,cashAfter:state.cash,effects:[]};
  const after=trial.state,cost=state.cash-after.cash;
  const beforeWages=operatingCosts(state).salaries,afterWages=operatingCosts(after).salaries;
  const effects=[
    `${EMPLOYEES[id].name} 离职后，本局不能再次招聘。`,
    `后续每 ${rulesFor(state).billDays} 日的公司工资支出减少 ${beforeWages-afterWages} 万（${beforeWages} → ${afterWages} 万）。`,
  ];
  const project=state.project,task=state.career?.study;
  if(project?.status==='planning'&&project.plannerId===id&&after.project?.plannerId===null){
    effects.push(`「${project.name}」的方案会暂停，需要在研发页重选负责人；已用设计时间保留。`);
  }
  if(task?.employeeId===id){
    if(['course','promotion'].includes(task.kind)&&!after.career.study){
      effects.push(`${task.kind==='course'?'个人进修':'晋升培养'}「${task.label}」会取消；已付 ${task.cost} 万及 ${task.rp} 研究点不退，未完成的培养收益不会发放，进度不能转给他人。`);
    }else if(after.career.study?.id===task.id&&after.career.study.employeeId===null){
      effects.push(`「${task.label}」保留已付投入和 ${task.progress} / ${task.days} 个有效工作日进度；任务等待符合条件的员工接续，不再重复付费。`);
      if(task.kind==='contract')effects.push(`委托截止日仍为第 ${task.deadline} 日，等待接续不会顺延；逾期无法取得交付报酬。`);
    }
  }
  if(project?.status==='data-offer'&&project.dataProposal?.employeeId===id&&after.project?.status==='researching'){
    effects.push('该员工尚未批准的数据提案会取消，本项目回到普通研发流程；不会收取这次提案费用。');
  }
  if(project?.status==='experiment-offer'&&project.experiment?.employeeId===id&&after.project?.status==='researching'){
    effects.push('该员工尚未批准的追加实验会取消，本项目回到普通研发流程；不会收取这次实验费用或研究点。');
  }
  if(state.assignments[id]?.kind==='reset'&&!after.assignments[id]){
    effects.push(`已安排的额度重置会取消，已付 ${quotaResetStatus(state).cost} 万不退；不会获得这次重置的评价提升。`);
  }
  return {ok:true,cost,cashAfter:after.cash,effects};
}

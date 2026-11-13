import {eventLine} from './career-copy.js';
import {isNextCareer} from './career-next.js';
const categories=['编程','办公','多模态'];
export function initializeIndustry(state){if(isNextCareer(state))Object.assign(state.career,{awards:[],awardEntries:{}});}
export function rememberRanking(state,rows){
  if(!isNextCareer(state))return;
  for(const [index,model]of rows.entries())model.bestRank=Math.min(model.bestRank??Infinity,index+1);
}
export function snapshotModel(state,model){
  if(!isNextCareer(state))return;
  const p=state.project;
  const data=p.dataProposal?.completed&&p.dataProposal.choice==='supplement'?p.dataProposal.reward:0;
  const experiment=p.experiment?.success?p.experiment.reward:0;
  const bonus=p.burst?.earned??0;
  const focus=['coding','office','multimodal'].indexOf(p.focus);
  model.breakdown={initial:[...p.initialScores],proposal:p.planScores.map((v,i)=>v-p.initialScores[i]),data,experiment,burst:bonus,learning:[...p.learningBonus],ordinary:p.scores.map((v,i)=>v-p.planScores[i]-p.learningBonus[i]-(i===focus?data+experiment+bonus:0))};
}
export function awardIndustry(state,post){
  if(!isNextCareer(state)||state.gameDay%28||state.cash<0||state.career.awards.some(a=>a.day===state.gameDay))return;
  const c=state.career,day=state.gameDay,entries=new Set(),results=[];
  for(let index=0;index<3;index++){
    const candidates=state.models.filter(m=>m.day>0&&m.day>=day-55&&m.day<=day&&(c.awardEntries[m.id]??0)<2&&!c.awards.some(a=>a.results.some(r=>r.category===categories[index]&&r.modelId===m.id)));
    const companies=new Map();
    for(const model of candidates.toSorted((a,b)=>b.scores[index]-a.scores[index]||a.sequence-b.sequence))if(!companies.has(model.company))companies.set(model.company,model);
    for(const model of companies.values())entries.add(model.id);
    const winner=[...companies.values()][0];
    if(winner)results.push({category:categories[index],company:winner.company,modelId:winner.id,name:winner.name});
  }
  for(const id of entries)c.awardEntries[id]=(c.awardEntries[id]??0)+1;
  const contributions=new Map();
  for(const model of state.models.filter(m=>m.day>day-28&&m.day<=day&&m.learningSourceId)){
    const source=state.models.find(m=>m.id===model.learningSourceId);
    if(source&&source.company!==model.company&&!c.awards.some(a=>a.results.some(r=>r.category==='开放贡献'&&r.modelId===source.id))){
      contributions.set(source.id,(contributions.get(source.id)??0)+model.learningBonus.reduce((a,b)=>a+b,0));
    }
  }
  const openWinner=[...contributions].filter(([,n])=>n>0).sort((a,b)=>{const x=state.models.find(m=>m.id===a[0]),y=state.models.find(m=>m.id===b[0]);return b[1]-a[1]||(x.openDay??x.day)-(y.openDay??y.day)||x.sequence-y.sequence;})[0];
  if(openWinner){const model=state.models.find(m=>m.id===openWinner[0]);results.push({category:'开放贡献',company:model.company,modelId:model.id,name:model.name,contribution:openWinner[1]});}
  const player=results.filter(r=>r.company==='player'),cash=player.some(r=>r.category!=='开放贡献')?2:0,fans=player.length?20:0;
  state.cash+=cash;c.fans+=fans;c.awards.push({day,results,cash,fans});
  post(state,'行业盘点',results.length?`第${day/28}届：${results.map(r=>`${r.category}：${r.company==='player'?'本公司':r.company} ${r.name}`).join('；')}。${eventLine(state,player.length?'award':'award-missed',day)}`:'本期没有符合条件的新型号，评选暂缺。发布会日历正常营业。','discussion',`awards:${day}`,player.length?[`小满：本届合计奖金${cash}万，新增关注${fans}人，已结算。`]:[]);
}

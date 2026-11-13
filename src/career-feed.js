import {EMPLOYEES} from './game/content.js';

// Presentation-only timeline. Never change saved posts to apply a UI filter.
export const FEED_FILTERS=[['all','全部动态'],['company','本公司经营'],['industry','行业与同行'],['office','办公室日常']];
const companyAuthors=new Set(['公司官号','研发团队','小满','服务公告']);
const companyNews=new Set(['bill-first','wall','deadline','last-call']);
export function careerTimeline(state,record,news=[]){
  const models=new Map(state.models.map(m=>[m.id,m]));
  const facts=(record?.events??[]).filter(e=>e.comments?.length).map(e=>({
    id:`fact:${e.id}`,day:e.day,author:e.comments[0].author,
    text:e.comments.map(c=>`${c.author}：${c.text}（${c.fact}）`).join('\n'),
    topic:'discussion',channel:'company',replies:e.comments.map(c=>c.reply)
  }));
  const posts=(state.career?.posts??[]).map(item=>{
    let channel='industry';
    if(/^(study:|experiment:|contract:|funding:|cancel:|expired:|reset-|promotion:|promise:|assessment:)/.test(item.id))channel='company';
    else if(item.topic==='office')channel='office';
    else if(companyAuthors.has(item.author)||item.topic==='people')channel='company';
    if(item.id.startsWith('release:'))channel=models.get(item.id.slice(8))?.company==='player'?'company':'industry';
    return {...item,channel};
  });
  const ids=new Set(posts.map(p=>p.id));
  const reports=news.filter(item=>!item.model||!ids.has(`release:${item.model.id}`)).map(item=>{
    const internal=!!item.employeeId||companyNews.has(item.id)||item.id.startsWith('chapter-');
    return {
      id:`news:${item.id}`,day:item.day,
      author:item.employeeId?(EMPLOYEES[item.employeeId]?.name??'离职同事'):internal?'公司记录':item.model?.company??'行业快讯',
      text:`${item.title}。${item.copy}`,topic:item.employeeId?'people':internal?'company':'news',channel:internal?'company':'industry',replies:[]
    };
  });
  return [...facts,...posts,...reports].sort((a,b)=>b.day-a.day||b.id.localeCompare(a.id));
}
export function feedPage(timeline,{filter='all',limit=25}={}){
  const channel=FEED_FILTERS.some(([id])=>id===filter)?filter:'all';
  const selected=timeline.filter(p=>channel==='all'||p.channel===channel);
  const count=Number.isFinite(limit)?Math.max(1,Math.floor(limit)):25;
  return {items:selected.slice(0,count),total:selected.length,remaining:Math.max(0,selected.length-count)};
}

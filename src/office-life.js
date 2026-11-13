// Presentation only. Energy and recovery remain owned by the economic rules.
import {employeeSeatIndex} from './office-seating.js';
import {createOfficeNavigation,distance} from './office-navigation.js';
import {WALK_SPEED,walkDirection} from './office-walk-animation.js';
// Only settled work/discussion poses can carry contribution icons. Never keep
// an icon attached to a person while they commute, study or visit a facility.
export function canShowOfficePoint(snapshot,id){
  const actor=snapshot.actors.find(a=>a.id===id);
  return !!actor&&!actor.offsite&&['seated','discussing'].includes(actor.mode);
}
export function createOfficeLife({navigationFor=createOfficeNavigation,walkSpeed=WALK_SPEED}={}){
  let state=null,activities={},layout=null,nav=null,clock=0,nextChat=12000,chat=null,cursor=0,tour=null,report=null;
  const actors=new Map();
  const delay=id=>250+[...id].reduce((n,c)=>n+c.charCodeAt(0)*37,0)%1100;
  const onCourse=id=>state.career?.study?.kind==='course'&&state.career.study.employeeId===id;
  const tired=id=>{
    if(!state.career)return false;
    const kind=activities[id]?.kind,required=['planning','study','reset'].includes(kind)?26:state.project?.status==='experiment'?22:21;
    return kind==='rest'||!!state.career.resting[id]||(state.career.stamina[id]??100)<required;
  };
  const away=id=>onCourse(id)||tired(id);
  const pose=id=>activities[id]?.kind==='study'?'study':'seated';
  const baseGoal=(id,index)=>pose(id)==='study'?nav.study:nav.seats[index];
  const validChat=id=>tour?.id!==id&&state.employees.includes(id)&&!away(id)&&['idle','research'].includes(activities[id]?.kind)&&actors.get(id)?.mode==='seated';
  function sync(next,nextActivities,nextLayout,{staticPose=false,arriveFromDoor=false}={}){
    const imported=state&&(next.gameDay<state.gameDay||next.campaignProfile!==state.campaignProfile||next.career?.seed!==state.career?.seed||next.acceptedActions?.length>(state.acceptedActions?.length??0)+1);
    const reset=!state||imported||layout?.tier!==nextLayout.tier;
    if(reset){actors.clear();clock=0;nextChat=12000;chat=null;cursor=0;tour=null;report=null;}
    state=next;activities=nextActivities;layout=nextLayout;nav??=navigationFor(layout);if(reset)nav=navigationFor(layout);
    if(report&&(!state.employees.includes(report.employeeId)||away(report.employeeId)))report=null;
    for(const id of actors.keys())if(!state.employees.includes(id))actors.delete(id);
    if(arriveFromDoor||staticPose){chat=null;tour=null;report=null;}
    if(tour&&(!state.employees.includes(tour.id)||away(tour.id)))tour=null;
    if(chat&&(!state.employees.includes(chat.visitor)||!state.employees.includes(chat.partner)||away(chat.visitor)||away(chat.partner)))chat=null;
    for(const id of state.employees){
      const index=employeeSeatIndex({...state,seats:nav.seats.length},id);
      let a=actors.get(id);const goal=baseGoal(id,index),outside=away(id),entering=arriveFromDoor||(!reset&&!a&&!state.paused);
      if(!a||staticPose||arriveFromDoor){
        const offsite=outside||entering,position=offsite?nav.entry:goal;
        a={id,index,position:[...position],goal:[...position],mode:offsite?'offsite':pose(id),direction:-1,facing:'south',walked:0,offsite,intent:offsite?'outside':'work',route:[],readyAt:clock+(arriveFromDoor?index*1350:delay(id))};actors.set(id,a);
      }
      // Retain this flag until docking after completion/cancellation/reassignment.
      // It allows only this commute to finish while economic time is paused.
      if(onCourse(id))a.courseCommute=true;
      if(a.index!==index){
        if(chat&&(chat.visitor===id||chat.partner===id))chat=null;
        if(tour?.id===id)tour=null;
        if(!a.offsite&&a.intent!=='leave'){
          if(a.mode==='seated'){a.position=[...goal];a.goal=[...goal];a.route=[];a.intent='work';}
          else {a.goal=[...goal];a.route=nav.route(a.position,goal).slice(1);a.intent='work';a.mode=a.route.length?'walking':pose(id);}
        }
      }
      a.index=index;
    }
  }
  function walk(a,goal,intent){
    if(a.intent===intent&&distance(a.goal,goal)<.1)return;
    a.goal=[...goal];a.intent=intent;a.route=nav.route(a.position,goal).slice(1);
  }
  function step(elapsed,playing,{blocked=[],presentationOnly=false}={}){
    if(!state||!playing||state.ending)return;
    const dt=Math.max(0,Math.min(250,elapsed));clock+=dt;const busy=new Set(blocked);
    // A course commute/report may continue while the company is paused, but
    // that must not consume everyone else's discussion or facility dwell time.
    if(presentationOnly){nextChat+=dt;if(chat)chat.started+=dt;if(tour?.waitUntil!=null)tour.waitUntil+=dt;}
    if(chat&&(clock-chat.started>11000||away(chat.visitor)||away(chat.partner)||!['idle','research'].includes(activities[chat.visitor]?.kind)||!['idle','research'].includes(activities[chat.partner]?.kind)))chat=null;
    if(!presentationOnly&&clock>=nextChat&&!chat&&!report){
      const candidates=state.employees.filter(id=>validChat(id)&&!busy.has(id));nextChat=clock+18000;
      if(candidates.length>=2){const visitor=candidates[cursor%candidates.length],partner=candidates[(cursor+1)%candidates.length];cursor++;chat={visitor,partner,started:clock,target:[...nav.discussions[actors.get(partner).index]],copy:['这个结果复现了吗？','我把测试贴群里。','这里再看一眼。','先别改发布稿。'][cursor%4]};}
    }
    if(tour&&away(tour.id))tour=null;
    for(const id of state.employees){
      const index=employeeSeatIndex({...state,seats:nav.seats.length},id);
      const a=actors.get(id);if(!a)continue;
      if(presentationOnly&&report?.employeeId!==id&&!a.courseCommute)continue;
      if(away(id)){
        if(a.offsite){a.mode='offsite';a.readyAt=clock+delay(id);continue;}
        if(a.intent!=='leave'){a.leaveAt??=clock+(onCourse(id)?0:delay(id)+index*380);if(clock<a.leaveAt)continue;}
        walk(a,nav.entry,'leave');
      }else if(a.offsite){
        a.leaveAt=null;if(clock<a.readyAt)continue;
        a.offsite=false;walk(a,baseGoal(id,index),'arrive');
      }else if(a.intent==='leave'){
        // Finish the physical exit even if recovery settled during the walk.
      }else if(a.intent==='arrive'&&a.route.length){
        // Reach the chair before joining discussions or another activity.
      }else {a.leaveAt=null;const visiting=tour?.id===id,reporting=report?.employeeId===id&&!report.returning;walk(a,reporting?nav.study:visiting?nav.services[tour.keys[tour.index]]:chat?.visitor===id?chat.target:baseGoal(id,index),reporting?'report':visiting?'tour':chat?.visitor===id?'chat':'work');}
      const before=[...a.position];let travel=walkSpeed*dt/1000,walked=0;
      while(a.route.length&&travel>0){
        const target=a.route[0],gap=distance(a.position,target);
        if(gap>.001)a.facing=walkDirection(target[0]-a.position[0],target[1]-a.position[1],a.facing);
        const moved=Math.min(gap,travel);walked+=moved;
        if(gap<=travel){a.position=[...target];a.route.shift();travel-=gap;}
        else{a.position=a.position.map((n,j)=>n+(target[j]-n)*travel/gap);travel=0;}
      }
      a.walked+=walked;
      if(Math.abs(a.position[0]-before[0])>.01)a.direction=a.position[0]>before[0]?1:-1;
      if(a.route.length)a.mode=a.intent==='leave'?'leaving':a.intent==='arrive'?'arriving':'walking';
      else if(a.intent==='leave'){a.offsite=true;a.mode='offsite';a.readyAt=clock+delay(id);}
      else if(a.intent==='tour'&&tour?.id===id){a.mode='visiting';a.direction=nav.serviceFacing[tour.keys[tour.index]];a.facing=a.direction<0?'northwest':'northeast';tour.waitUntil??=clock+1600;if(clock>=tour.waitUntil){tour.index++;tour.waitUntil=null;if(tour.index>=tour.keys.length)tour=null;}}
      else {a.mode=a.intent==='report'?'reporting':a.intent==='chat'?'discussing':pose(id);if(['seated','study'].includes(a.mode))a.courseCommute=false;if(report?.employeeId===id&&report.returning)report=null;}
    }
  }
  function startFacilityTour(id){const a=actors.get(id);if(!a||a.offsite||away(id))return false;tour={id,index:0,keys:[...nav.tour],waitUntil:null};if(chat&&(chat.visitor===id||chat.partner===id))chat=null;return true;}
  function setReport(event){if(!event){if(report)report.returning=true;return false;}if(report?.id===event.id)return true;const a=actors.get(event.employeeId);if(!a||a.offsite||away(event.employeeId))return false;try{nav.route(a.position,nav.study);}catch{return false;}chat=null;tour=null;report={id:event.id,employeeId:event.employeeId,returning:false};return true;}
  function hasPresentationMotion(){
    // Economic endings freeze the scene even if a course/report was in transit.
    // step() cannot finish that route, so it must not keep a render loop alive.
    if(!state||state.ending)return false;
    const reporter=report&&actors.get(report.employeeId);
    // Once a reporter has reached the meeting point, the static speech bubble
    // needs no animation frames. Clearing the report starts the return trip.
    return !!(reporter&&(report.returning||reporter.mode!=='reporting'))||[...actors.values()].some(a=>a.courseCommute&&(!a.offsite||!away(a.id)));
  }
  function snapshot(){return {report:report?{...report}:null,tour:tour?{...tour,keys:[...tour.keys]}:null,actors:[...actors.values()].map(a=>({...a,position:[...a.position],goal:[...a.goal],route:a.route.map(p=>[...p])})),chat:chat?{...chat,target:[...chat.target]}:null,clock};}
  return {sync,step,snapshot,startFacilityTour,setReport,hasPresentationMotion};
}

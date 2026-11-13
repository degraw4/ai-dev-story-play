// Actual company presentation on the source-pixel office plates. Economy and
// persistence stay in game/rules.js and app.js; only their settled state is read.
import {officeSeatOccupants,employeeSeatIndex} from './office-seating.js';
import {charactersOrDefault} from './characters.js';
import {employeeActivity} from './game/rules.js';
import {drawPointIcon} from './point-icons.js';
import {createOfficeLife,canShowOfficePoint} from './office-life.js';
import {REFERENCE_CANVAS,loadReferenceManifest,createReferenceOfficeRenderer} from './reference-office.js';
import {createReferenceOfficeNavigation,referenceWorkerSlots,referenceFurnitureOccluders,referenceWalkingOccluders} from './reference-office-navigation.js';
import {registerReferenceScene,referenceChairOccluders} from './reference-office-registration.js';

export const referenceGameTier=seats=>Number(seats)===8?8:Number(seats)===6?6:4;
export function referenceCompanyActors(scene,state,snapshot){
 const live=new Map((snapshot?.actors??[]).map(a=>[a.id,a])),occupants=officeSeatOccupants({...state,seats:referenceWorkerSlots(scene).length});
 const leaders=(scene.actors??[]).filter(a=>/^(boss|secretary)/.test(a.id)).map(a=>({...a,spriteId:a.id.startsWith('boss')?'boss':'secretary'}));
 return [...leaders,...referenceWorkerSlots(scene).flatMap((slot,index)=>{
  const id=occupants[index];if(!id)return [];const a=live.get(id);
  if(a?.offsite)return [];
  return [{...slot,spriteId:id,routeState:{position:[...(!a||a.mode==='seated'?slot.foot:a.position)],walked:a?.walked??0,moving:['walking','arriving','leaving'].includes(a?.mode),atDock:!a||a.mode==='seated',direction:a?.facing??slot.direction}}];
 })];
}
export function createReferenceGameOffice(canvas){
 const sceneElement=canvas.parentElement,c=canvas.getContext('2d'),bubble=document.createElement('div');bubble.className='office-chat-bubble';bubble.hidden=true;sceneElement.append(bubble);
 const eventBubble=document.createElement('button');eventBubble.type='button';eventBubble.className='office-event-bubble';eventBubble.hidden=true;sceneElement.append(eventBubble);let managementEvent=null,eventBorn=0;
 eventBubble.addEventListener('click',()=>managementEvent?.open?.());
 const loadStatus=document.createElement('div'),loadMessage=document.createElement('p'),retryButton=document.createElement('button');
 loadStatus.className='office-load-status';loadStatus.setAttribute('role','status');retryButton.type='button';retryButton.textContent='重新加载画面';retryButton.hidden=true;loadStatus.append(loadMessage,retryButton);sceneElement.append(loadStatus);
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)'),bundles=new Map();
 let manifest=null,baseUrl=null,state={employees:[],seats:4,paused:true},characters=charactersOrDefault(),destroyed=false,current=null,clock=0,emitted=0,points=[],growth=[],referenceLines=false,pathLines=false,hasRendered=false,loadGeneration=0;
 let view={scale:1,left:0,top:0};const hot=new Map();
 const life=createOfficeLife({navigationFor:layout=>bundles.get(layout.tier).navigation,walkSpeed:80});
 canvas.dataset.ready='false';canvas.dataset.walkReady='false';canvas.dataset.artStyle='source-pixel-office';canvas.dataset.environmentVersion='reference-copy-v2';canvas.dataset.assetVersion='character-rig-v6';
 canvas.width=REFERENCE_CANVAS[0];canvas.height=REFERENCE_CANVAS[1];canvas.style.position='absolute';canvas.style.imageRendering='pixelated';
 const layoutEvent=()=>canvas.dispatchEvent(new Event('office-layout'));
 function fit(){
  const width=Math.max(1,sceneElement.clientWidth),height=Math.max(1,sceneElement.clientHeight),scale=Math.min(width/REFERENCE_CANVAS[0],height/REFERENCE_CANVAS[1]);
  view={scale,left:(width-REFERENCE_CANVAS[0]*scale)/2,top:(height-REFERENCE_CANVAS[1]*scale)/2};
  Object.assign(canvas.style,{width:`${REFERENCE_CANVAS[0]*scale}px`,height:`${REFERENCE_CANVAS[1]*scale}px`,left:`${view.left}px`,top:`${view.top}px`});
  canvas.dataset.logicalWidth=String(canvas.width);canvas.dataset.pixelScale=String(scale);canvas.dataset.cameraScale=String(scale);canvas.dataset.deskDisplayWidth=String(270*scale);layoutEvent();draw();
 }
 function syncLife(arriveFromDoor=false){
  if(!current)return;const activities=Object.fromEntries(state.employees.map(id=>[id,employeeActivity(state,id)]));
  life.sync(state,activities,current.layout,{staticPose:motion.matches,arriveFromDoor});
  canvas.dataset.planningEmployee=state.employees.find(id=>activities[id]?.kind==='planning')??'';
  canvas.dataset.workingEmployees=state.employees.filter(id=>activities[id]?.active&&['planning','research'].includes(activities[id].kind)).join(',');
 }
 function ensureTier(){
  if(!manifest)return;const tier=referenceGameTier(state.seats);
  if(!bundles.has(tier)){
   const sourceScene=registerReferenceScene(manifest.scenes[String(tier)],tier),offscreen=document.createElement('canvas'),navigation=createReferenceOfficeNavigation(sourceScene,tier);
   const scene={...sourceScene,occluders:[...referenceWalkingOccluders(sourceScene,navigation),...referenceFurnitureOccluders(navigation),...referenceChairOccluders(sourceScene,navigation)]},renderer=createReferenceOfficeRenderer(offscreen,scene,{baseUrl,canvasSize:REFERENCE_CANVAS,characterScale:manifest.characterScale,comparisonAssets:false});
   const bundle={scene,offscreen,navigation,renderer,ready:false,error:false,layout:{tier}};bundles.set(tier,bundle);
   renderer.ready.then(()=>{if(destroyed)return;bundle.ready=true;if(current===bundle){canvas.dataset.ready='true';canvas.dataset.emptyReady='true';canvas.dataset.walkReady='true';loadStatus.hidden=true;syncLife();draw();layoutEvent();}}).catch(()=>{bundle.error=true;if(current===bundle)showError();});
  }
  const next=bundles.get(tier),changed=next!==current;current=next;
  canvas.dataset.ready=next.error?'error':next.ready?'true':'false';canvas.dataset.officeTier={4:'startup',6:'studio',8:'headquarters'}[tier];canvas.dataset.officeCapacity=String(tier);
  if(changed){if(next.error)showError();else if(next.ready)loadStatus.hidden=true;else showLoading();}
  if(changed){points=[];hot.clear();syncLife();layoutEvent();}
 }
 function showLoading(){loadStatus.hidden=false;loadStatus.setAttribute('role','status');loadMessage.textContent='办公室画面加载中…';retryButton.hidden=true;}
 function showError(){if(destroyed)return;canvas.dataset.ready='error';canvas.dataset.walkReady='error';canvas.setAttribute('aria-label','办公室画面加载失败，可重新加载');bubble.hidden=true;eventBubble.hidden=true;loadStatus.hidden=false;loadStatus.setAttribute('role','alert');loadMessage.textContent='办公室画面加载失败。可以重试，经营进度和存档不会重置。';retryButton.hidden=false;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#dbe6e4';c.fillRect(0,0,canvas.width,canvas.height);}
 function loadOffice(){
  const generation=++loadGeneration;manifest=null;current=null;for(const b of bundles.values())b.renderer.destroy();bundles.clear();
  canvas.dataset.ready='false';canvas.dataset.walkReady='false';canvas.dataset.emptyReady='false';canvas.setAttribute('aria-label','办公室经营场景');showLoading();
  loadReferenceManifest().then(loaded=>{if(destroyed||generation!==loadGeneration)return;manifest=loaded.data;baseUrl=loaded.baseUrl;ensureTier();syncLife();draw();}).catch(()=>{if(generation===loadGeneration)showError();});
 }
 retryButton.addEventListener('click',loadOffice);
 function motionChanged(){
  points=[];hot.clear();growth=[];syncLife();
  if(!motion.matches&&managementEvent?.kind==='proposal')life.setReport(managementEvent);
  draw();
 }
 const headFor=(id,snapshot)=>{
  const a=snapshot.actors.find(a=>a.id===id),index=employeeSeatIndex(state,id),slot=referenceWorkerSlots(current.scene)[index];if(!slot||a?.offsite)return null;
  // Rig ground is y=120 and the portrait head center is approximately y=49.
  return a&&a.mode!=='seated'?[a.position[0],a.position[1]-71*manifest.characterScale]:slot.head;
 };
 function drawFlame([x,y]){
  const phase=Math.floor(clock/160)%3;c.fillStyle='#e25b24';
  for(let i=-3;i<=3;i++){const height=[20,32,42,48,37,30,18][i+3]+phase*2;c.fillRect(Math.round(x+i*5-3),Math.round(y+70-height),7,height);}
  c.fillStyle='#ffc94b';c.fillRect(x-9,y+39,18,28);c.fillStyle='#fff3a7';c.fillRect(x-4,y+52,8,17);
 }
 function draw(){
  if(destroyed)return;c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.imageSmoothingEnabled=false;c.clearRect(0,0,canvas.width,canvas.height);
  if(!current?.ready){c.fillStyle='#c6cecb';c.fillRect(0,0,canvas.width,canvas.height);return;}
  const snapshot=life.snapshot(),actors=referenceCompanyActors(current.scene,state,snapshot);
  current.renderer.render({actors,characters,view:'replica',showActors:true,showMask:false,walking:false,pathSegments:pathLines?current.navigation.segments:[]});c.drawImage(current.offscreen,0,0);
  for(const role of ['boss','secretary']){const a=current.scene.actors.find(a=>a.id.startsWith(role));canvas.dataset[`${role}LabelX`]=String(a.head[0]);canvas.dataset[`${role}LabelY`]=String(a.head[1]-45);}
  if(referenceLines){c.save();c.lineWidth=2;c.strokeStyle='#c9534c';for(const b of current.navigation.tableBounds){const q=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(current.navigation.fromFloor);c.beginPath();q.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.stroke();}c.restore();}
  if(!motion.matches)for(const [id,until]of hot){if(until<=clock){hot.delete(id);continue;}const h=headFor(id,snapshot);if(h)drawFlame(h);}
  points=points.filter(p=>clock-p.born<p.lifetime&&canShowOfficePoint(snapshot,p.employeeId));
  for(const point of points){const head=headFor(point.employeeId,snapshot);if(!head)continue;const age=(clock-point.born)/point.lifetime,icon=(sceneElement.clientWidth<500?16:26)/view.scale,x=head[0],y=head[1]-35-Math.sin(age*Math.PI/2)*24/view.scale;c.globalAlpha=Math.min(1,(1-age)*2.5);drawPointIcon(c,point.direction,x-icon/2,y-icon,icon);c.font=`bold ${12/view.scale}px system-ui`;c.textAlign='left';c.lineWidth=3/view.scale;c.strokeStyle='#fffdf2';c.strokeText('+1',x+icon/2+3/view.scale,y-3/view.scale);c.fillStyle='#263e40';c.fillText('+1',x+icon/2+3/view.scale,y-3/view.scale);}
  growth=growth.filter(p=>clock-p.born<1400);for(const p of growth){const h=headFor(p.id,snapshot);if(!h)continue;c.globalAlpha=1-(clock-p.born)/1400;c.font=`bold ${12/view.scale}px system-ui`;c.textAlign='center';c.fillStyle='#946714';c.fillText('能力提升!',h[0],h[1]-30-(clock-p.born)/60);}
  c.globalAlpha=1;
  const visitor=snapshot.chat&&snapshot.actors.find(a=>a.id===snapshot.chat.visitor);bubble.hidden=visitor?.mode!=='discussing';
  if(!bubble.hidden){bubble.textContent=snapshot.chat.copy;const half=bubble.offsetWidth/2;bubble.style.left=`${Math.max(half+8,Math.min(sceneElement.clientWidth-half-8,view.left+visitor.position[0]*view.scale))}px`;bubble.style.top=`${Math.max(bubble.offsetHeight+8,view.top+(visitor.position[1]-145)*view.scale)}px`;}
  const activeActor=snapshot.actors.find(a=>a.id===managementEvent?.employeeId),eventHead=activeActor&&!activeActor.offsite?headFor(activeActor.id,snapshot):current.scene.actors.find(a=>a.id.startsWith('secretary'))?.head;
  eventBubble.hidden=!managementEvent||!eventHead||managementEvent.kind!=='proposal'&&clock-eventBorn>6000;
  if(!eventBubble.hidden){eventBubble.textContent=`${activeActor&&!activeActor.offsite?'':'小满转述：'}${managementEvent.label}`;const half=eventBubble.offsetWidth/2;eventBubble.style.left=`${Math.max(half+6,Math.min(sceneElement.clientWidth-half-6,view.left+eventHead[0]*view.scale))}px`;eventBubble.style.top=`${Math.max(4,Math.min(sceneElement.clientHeight-eventBubble.offsetHeight-4,view.top+(eventHead[1]-45)*view.scale-eventBubble.offsetHeight))}px`;}
  Object.assign(canvas.dataset,{people:String(state.employees.length),compute:String(state.compute??0),fixedStaff:'boss,secretary',bossGender:characters.boss,secretaryGender:characters.secretary,pointAnimations:String(points.length),emittedPoints:String(emitted),pointEmployees:points.map(p=>p.employeeId).join(','),burstEmployees:[...hot].filter(([id,until])=>until>clock&&state.employees.includes(id)).map(([id])=>id).join(','),movingEmployees:snapshot.actors.filter(a=>!a.offsite&&['walking','arriving','leaving'].includes(a.mode)).map(a=>a.id).join(','),discussingEmployees:snapshot.chat?`${snapshot.chat.visitor},${snapshot.chat.partner}`:'',offsiteEmployees:snapshot.actors.filter(a=>a.offsite).map(a=>a.id).join(','),lifePoses:snapshot.actors.map(a=>`${a.id}:${a.mode}`).join(','),walkDirections:snapshot.actors.filter(a=>!a.offsite&&a.mode!=='seated').map(a=>`${a.id}:${a.facing}`).join(','),cityBackdrop:'copied-full-scene',serverRacks:'0',referenceLines:String(referenceLines),pathLines:String(pathLines),facilityVisitor:snapshot.tour?.id??'',facilityTarget:snapshot.tour?.keys[snapshot.tour.index]??''});
 }
 const observer=new ResizeObserver(fit);observer.observe(sceneElement);window.addEventListener('resize',fit);motion.addEventListener('change',motionChanged);fit();
 loadOffice();
 return {
  render(next,{arriveFromDoor=false,characters:choice=characters,officeSeating=next.officeSeating??{}}={}){
   const changedProject=next.project?.id!==state.project?.id||next.career?.seed!==state.career?.seed||next.gameDay<state.gameDay;
   if(changedProject){points=[];hot.clear();emitted=0;growth=[];}
   const fresh=hasRendered&&!motion.matches?(next.notices??[]).slice(state.notices?.length??0):[];for(const n of fresh)if(n.type==='employee-growth')growth.push({id:n.employeeId,born:clock});
   hasRendered=true;state={...next,officeSeating};characters=charactersOrDefault(choice);ensureTier();syncLife(arriveFromDoor);draw();layoutEvent();
  },
  step(elapsed,playing,{fraction=0}={}){const presentationOnly=!playing,timedEvent=managementEvent&&managementEvent.kind!=='proposal'&&clock-eventBorn<=6000;if((!playing&&!timedEvent&&!life.hasPresentationMotion())||(motion.matches&&!timedEvent)||!current?.ready||destroyed||document.hidden)return;clock+=Math.max(0,elapsed);if(!motion.matches)life.step(elapsed,true,{fraction,presentationOnly,blocked:[...points.map(p=>p.employeeId),...hot.keys()]});draw();},
  setManagementEvent(event){if(event?.id!==managementEvent?.id)eventBorn=clock;managementEvent=event;if(event?.kind==='proposal'&&!motion.matches)life.setReport(event);else life.setReport(null);draw();},
  showPoints(events){if(motion.matches)return;const snapshot=life.snapshot();for(const event of events){if(event.projectId!==state.project?.id||!state.employees.includes(event.employeeId)||!canShowOfficePoint(snapshot,event.employeeId))continue;emitted++;Object.assign(canvas.dataset,{lastPointEmployee:event.employeeId,lastPointDirection:event.direction,lastPointDuration:String(event.lifetime),lastPointTime:String(clock)});if(event.age<event.lifetime){points.push({...event,born:clock-event.age});if(event.burst)hot.set(event.employeeId,Math.max(hot.get(event.employeeId)??0,clock+event.lifetime-event.age));}}if(events.length)draw();},
  getSeatLayout(){return current?referenceWorkerSlots(current.scene).map((slot,index)=>({index,point:[...slot.head]})):[];},
  clearPoints(){points=[];hot.clear();draw();},
  setReferenceLines(show){referenceLines=!!show;draw();},setPathLines(show){pathLines=!!show;draw();},
  tourFacilities(id){const result=life.startFacilityTour(id);draw();return result;},
  destroy(){destroyed=true;observer.disconnect();window.removeEventListener('resize',fit);motion.removeEventListener('change',motionChanged);retryButton.removeEventListener('click',loadOffice);for(const b of bundles.values())b.renderer.destroy();bubble.remove();eventBubble.remove();loadStatus.remove();},
 };
}

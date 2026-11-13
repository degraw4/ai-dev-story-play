import {DEFAULT_CHARACTERS,charactersOrDefault} from './characters.js';
import { employeeActivity } from './game/rules.js';
import { drawPointIcon } from './point-icons.js';
import { createOfficeLife,canShowOfficePoint } from './office-life.js';
import {createOfficeNavigation,sortOfficeEntities} from './office-navigation.js';
import {snapToPixelGrid} from './office-walk-animation.js';
import {loadCharacterArt,drawCharacterWalk} from './character-art.js';
import {drawCityBackdrop,exteriorPlantEntities} from './office-exterior.js';
import {createReferenceGameOffice} from './reference-game-office.js';
import { OFFICE_WORLD, officeGeometry, officeTier, officeCamera, drawRoom, roomProps, drawWorkstation, workstationHead,  workstationGroundAt, workstationGround, workstationChairGround } from './isometric-office.js';

// The generated room and atlas are original assets. Employee occupancy and
// effects are rendered from the company, rather than baked into the backdrop.
const WORLD = OFFICE_WORLD;

export const createOfficeRenderer=canvas=>createReferenceGameOffice(canvas);

export function createLegacyOfficeRenderer(canvas) {
  const scene=canvas.parentElement;
  const chatBubble=document.createElement('div');chatBubble.className='office-chat-bubble';chatBubble.hidden=true;scene.append(chatBubble);
  const context=canvas.getContext('2d');
  const components=new Image(),hqComponents=new Image(),exterior=new Image(),amenities=new Image();
  amenities.src=new URL('../assets/office/office-amenities-v4.png',import.meta.url).href;
  exterior.src=new URL('../assets/office/office-exterior-v2.png',import.meta.url).href;
  components.src=new URL('../assets/office/office-startup-v3.png',import.meta.url).href;
  hqComponents.src=new URL('../assets/office/office-headquarters-v3.png',import.meta.url).href;
  const startupAssets={components,exterior,amenities,tier:4,expanded:false,componentBounds:null},studioAssets={...startupAssets,components:hqComponents,tier:6,expanded:true},headquartersAssets={...studioAssets,tier:8};
  const tierAssets={4:startupAssets,6:studioAssets,8:headquartersAssets};
  let assets=startupAssets;
  let characters={...DEFAULT_CHARACTERS};
  const backdrop=document.createElement('canvas');backdrop.width=WORLD.width;backdrop.height=WORLD.height;const backdropContext=backdrop.getContext('2d');let backdropTier=null;
  const cityBackdrop=document.createElement('canvas');let cityKey='';
  const life=createOfficeLife();let walkReady=false,walkBounds=null;
  let state={employees:[],assignments:{},seats:4,compute:2,paused:true};
  let fittedTier=4;
  let frame=0,destroyed=false,ready=false,hasRendered=false,referenceLines=false,pathLines=false;
  let particles=[],pointEffects=[],pointClock=0,animating=false,emittedPoints=0;
  const hotUntil=new Map();
  let viewport={width:1,height:1,ratio:1,scale:1,x:0,y:0};
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  canvas.dataset.ready='false';canvas.dataset.walkReady='false';canvas.dataset.artStyle='reference-office';canvas.dataset.assetVersion='character-rig-v2';canvas.dataset.environmentVersion='reference-tiers-v4';

  function sprite(id,x,y,size,direction='south',walked=0,moving=false) {
    if(!walkBounds)return;
    const point=snapToPixelGrid(x,y,viewport);
    drawCharacterWalk(context,id,...point,size,{direction,walked,moving,characters});
  }
  function paintRect(x,y,w,h,color){context.fillStyle=color;context.fillRect(x,y,w,h);}
  function workEffect(x,y,activity,size,orientation) {
    if(!activity?.active || motion.matches)return;
    const [hx,hy]=workstationHead(x,y,size,orientation),rise=frame%3*3;
    if(activity.kind==='planning'){
      paintRect(hx-7,hy-20-rise,12,12,'#fce06a');paintRect(hx-3,hy-7-rise,4,3,'#9c732e');
    } else if(activity.kind==='research') {
      // A working indicator, not a second or imaginary award of research points.
      paintRect(x+size*.09,y-size*.49,3,2,frame%2?'#91d2a7':'#759d94');

    } else if(activity.kind==='reset') {
      paintRect(hx-8,hy-15-rise,17,5,'#76c9ed');paintRect(hx+5,hy-12-rise,5,12,'#76c9ed');
    }
  }
  function flame(x,y,size){
    const unit=Math.max(3,Math.round(size/55)),base=y-size*.12,center=x-size*.23;
    for(let column=-5;column<=5;column++){
      const height=[13,24,34,29,40,45,38,28,33,23,14][column+5]+((frame+column+5)%3)*2,left=center+column*unit*2;
      paintRect(left,base-height*unit,unit*2,height*unit,'#dc4c26');
      paintRect(left,base-(height-3)*unit,unit*2,(height-3)*unit,'#ff9a26');
      if(Math.abs(column)<4)paintRect(left,base-(height-6)*unit,unit*2,(height-6)*unit,'#ffe270');
    }
    paintRect(center+((frame%3)-1)*unit*3,base-size*.4,unit,unit,'#ffe88b');
  }
  function projectLabel(prefix,x,y){
    canvas.dataset[`${prefix}LabelX`]=String((x*viewport.scale+viewport.x)*viewport.ratio);
    canvas.dataset[`${prefix}LabelY`]=String((y*viewport.scale+viewport.y)*viewport.ratio);
  }
  function draw() {
    if(destroyed)return;
    const {ratio,width,height,scale,x,y}=viewport;
    context.setTransform(ratio,0,0,ratio,0,0);
    context.imageSmoothingEnabled=false;
    context.clearRect(0,0,width,height);
    paintRect(0,0,width,height,'#c6cecb');
    if(!ready){paintRect(0,0,width,height,'#b6c6ca');return;}
    const layout=officeGeometry(state.seats),slots=layout.seats,size=layout.size;assets=tierAssets[layout.tier];
    const nextCityKey=[state.seats,canvas.width,canvas.height,scale,x,y].join(':');
    if(nextCityKey!==cityKey){
      cityBackdrop.width=canvas.width;cityBackdrop.height=canvas.height;const c=cityBackdrop.getContext('2d');c.imageSmoothingEnabled=false;c.setTransform(ratio*scale,0,0,ratio*scale,ratio*x,ratio*y);
      drawCityBackdrop(c,layout,assets,{minX:-x/scale,minY:-y/scale,maxX:(width-x)/scale,maxY:(height-y)/scale});cityKey=nextCityKey;
    }
    context.drawImage(cityBackdrop,0,0,width,height);
    context.translate(x,y);context.scale(scale,scale);
    if(backdropTier!==layout.tier){backdropContext.clearRect(0,0,WORLD.width,WORLD.height);drawRoom(backdropContext,{tier:layout.tier,assets});backdropTier=layout.tier;}
    context.drawImage(backdrop,0,0);
    const nav=createOfficeNavigation(layout),props=roomProps(assets,layout.tier);
    for(const item of props)item.paintShadow(context);
    if(pathLines){context.save();context.strokeStyle='#287b9e';context.globalAlpha=.65;context.lineWidth=18;context.lineCap='round';for(const [a,b]of nav.segments){context.beginPath();context.moveTo(...a);context.lineTo(...b);context.stroke();}context.lineWidth=2;context.strokeStyle='#e8fbff';for(const [a,b]of nav.segments){context.beginPath();context.moveTo(...a);context.lineTo(...b);context.stroke();}context.restore();for(const [key,point]of Object.entries(nav.services)){context.save();context.fillStyle='#effbfc';context.strokeStyle='#287b9e';context.lineWidth=2;context.beginPath();context.ellipse(...point,9,4.5,0,0,Math.PI*2);context.fill();context.stroke();context.restore();}}
    const entities=props.map(item=>({y:item.y,ground:item.ground,paint:()=>item.paint(context)}));
    entities.push(...exteriorPlantEntities(layout,assets).map(item=>({...item,paint:()=>item.paint(context)})));
    for(const [id,point]of [['boss',layout.boss],['secretary',layout.secretary]]){entities.push({y:point[1],ground:workstationGroundAt(layout,layout.fixedSeatGrid[id],id),paint:()=>drawWorkstation(context,assets,...point,id,{width:size,characters})});const head=workstationHead(...point,size);projectLabel(id,head[0],head[1]-20);}
    const lifeState=life.snapshot(),actors=new Map(lifeState.actors.map(actor=>[actor.id,actor]));
    const standing=id=>walkReady&&!motion.matches&&!!actors.get(id)&&actors.get(id).mode!=='seated';
    slots.forEach(([px,py],index)=>{
      const id=state.employees[index],away=id&&(actors.get(id)?.offsite||standing(id));
      const ground=workstationGround(layout,index),orientation=layout.seatOrientations[index];
      entities.push({y:nav.seats[index][1],ground:workstationChairGround(layout,index),paint:()=>drawWorkstation(context,assets,px,py,id,{width:size,occupied:false,layer:'chair',orientation})});
      entities.push({y:py,ground,paint:()=>{
        if(id&&!away&&(hotUntil.get(id)||0)>pointClock&&!motion.matches)flame(px,py,size);
        // Each desk retains its row orientation when its employee leaves.
        drawWorkstation(context,assets,px,py,id,{width:size,occupied:!!id&&!away,layer:'desk',orientation});
        if(id&&!away)workEffect(px,py,employeeActivity(state,id),size,orientation);
      }});
    });
    if(walkReady&&walkBounds&&!motion.matches)for(const actor of lifeState.actors){
      if(actor.mode==='seated'||actor.offsite)continue;
      const moving=['walking','arriving','leaving'].includes(actor.mode);
      const [u,v]=layout.unproject(actor.position);
      entities.push({y:actor.position[1],ground:[u-.12,v-.12,u+.12,v+.12],paint:()=>sprite(actor.id,...actor.position,size,actor.facing,actor.walked,moving)});
    }
    for(const item of sortOfficeEntities(entities))item.paint();
    canvas.dataset.serverRacks=String(props.filter(p=>p.key.startsWith('server-')).length);
    if(referenceLines){context.save();context.globalAlpha=.75;context.lineWidth=3/scale;for(const n of [0,8,14,layout.cols]){for(const [a,b,color]of [[layout.project(0,n),layout.project(layout.cols,n),'#d64c43'],[layout.project(n,0),layout.project(n,layout.rows),'#377eb7']]){context.beginPath();context.moveTo(...a);context.lineTo(...b);context.strokeStyle=color;context.stroke();}}context.restore();}
    context.setTransform(ratio,0,0,ratio,0,0);
    const now=Date.now();particles=particles.filter(p=>now-p.born<1400);
    for(const point of particles){
      const age=(now-point.born)/1400,px=point.x*scale+x,py=point.y*scale+y-age*42;
      context.globalAlpha=Math.min(1,(1-age)*2);context.font='bold 15px monospace';context.textAlign='center';context.lineWidth=4;context.strokeStyle='#fffdf2';context.strokeText(point.text,px,py);context.fillStyle=point.color;context.fillText(point.text,px,py);
    }
    pointEffects=pointEffects.filter(point=>pointClock-point.born<point.lifetime&&canShowOfficePoint(lifeState,point.employeeId));
    for(const point of pointEffects){
      const index=state.employees.indexOf(point.employeeId),seat=slots[index];if(!seat)continue;
      const age=(pointClock-point.born)/point.lifetime;
      const actor=actors.get(point.employeeId),head=standing(point.employeeId)&&actor?[actor.position[0],actor.position[1]-size*.52]:workstationHead(...seat,size,layout.seatOrientations[index]);
      const px=head[0]*scale+x,py=head[1]*scale+y-Math.sin(Math.min(1,age)*Math.PI/2)*28;
      const iconSize=width<500?16:32;
      context.globalAlpha=Math.min(1,(1-age)*2.5);drawPointIcon(context,point.direction,px-iconSize/2,py-iconSize,iconSize);
      context.font=`bold ${width<500?11:14}px monospace`;context.textAlign='left';context.strokeStyle='#fffdf2';context.lineWidth=3;context.strokeText('+1',px+iconSize/2+2,py-3);context.fillStyle='#263e40';context.fillText('+1',px+iconSize/2+2,py-3);
    }
    const visitor=walkReady&&!motion.matches&&lifeState.chat&&actors.get(lifeState.chat.visitor);
    chatBubble.hidden=visitor?.mode!=='discussing';
    if(!chatBubble.hidden){
      if(chatBubble.textContent!==lifeState.chat.copy)chatBubble.textContent=lifeState.chat.copy;
      const half=chatBubble.offsetWidth/2,px=visitor.position[0]*scale+x,py=(visitor.position[1]-size*.58)*scale+y;
      chatBubble.style.left=`${Math.max(half+8,Math.min(width-half-8,px))}px`;
      chatBubble.style.top=`${Math.max(chatBubble.offsetHeight+8,py)}px`;
    }
    context.globalAlpha=1;canvas.dataset.pointAnimations=String(pointEffects.length);
    canvas.dataset.emittedPoints=String(emittedPoints);
    canvas.dataset.pointEmployees=pointEffects.map(point=>point.employeeId).join(',');
    canvas.dataset.burstEmployees=[...hotUntil].filter(([id,until])=>until>pointClock&&state.employees.includes(id)).map(([id])=>id).join(',');
    canvas.dataset.movingEmployees=lifeState.actors.filter(actor=>!actor.offsite&&['walking','arriving','leaving'].includes(actor.mode)).map(actor=>actor.id).join(',');
    canvas.dataset.discussingEmployees=lifeState.chat?`${lifeState.chat.visitor},${lifeState.chat.partner}`:'';
    canvas.dataset.offsiteEmployees=lifeState.actors.filter(actor=>actor.offsite).map(actor=>actor.id).join(',');
    canvas.dataset.lifePoses=lifeState.actors.map(actor=>`${actor.id}:${actor.mode}`).join(',');
    canvas.dataset.cityBackdrop='viewport-filled';
    canvas.dataset.walkDirections=lifeState.actors.filter(a=>!a.offsite&&a.mode!=='seated').map(a=>`${a.id}:${a.facing}`).join(',');
    canvas.dataset.bossGender=characters.boss;canvas.dataset.secretaryGender=characters.secretary;
    canvas.dataset.referenceLines=String(referenceLines);canvas.dataset.pathLines=String(pathLines);canvas.dataset.facilityVisitor=lifeState.tour?.id??'';canvas.dataset.facilityTarget=lifeState.tour?.keys[lifeState.tour.index]??'';
  }
  function fitCanvas(){
    const width=Math.max(1,scene.clientWidth),height=Math.max(1,scene.clientHeight);
    // Sample the whole office on a coarse shared pixel grid, then display with
    // nearest-neighbour scaling. UI text remains outside this low-res canvas.
    const ratio=Math.min(1,420/width);
    canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    canvas.style.width='100%';canvas.style.height='100%';canvas.style.left='0';canvas.style.top='0';
    // Frame the office itself at either tier, including the walls. The old
    // fixed WORLD contain view left a large empty border around the playfield.
    const {scale,x,y}=officeCamera(width,height);
    viewport={width,height,ratio,scale,x,y};canvas.dataset.pixelScale=String(scale*ratio);canvas.dataset.logicalWidth=String(canvas.width);
    canvas.dataset.cameraScale=String(scale);canvas.dataset.deskDisplayWidth=String(officeGeometry(state.seats).size*scale);
    draw();
  }
  const metadata=name=>fetch(new URL(`../assets/office/${name}`,import.meta.url)).then(response=>{if(!response.ok)throw new Error('sprite bounds');return response.json();});
  Promise.all([components.decode(),hqComponents.decode(),exterior.decode(),amenities.decode(),metadata('office-startup-v3-bounds.json'),metadata('office-headquarters-v3-bounds.json'),metadata('office-exterior-v2-bounds.json'),metadata('office-amenities-v4-bounds.json'),loadCharacterArt()]).then(([, , , ,startupBounds,hqBounds,exteriorBounds,amenityBounds])=>{
    if(destroyed)return;startupAssets.componentBounds=startupBounds;studioAssets.componentBounds=headquartersAssets.componentBounds=hqBounds;
    for(const set of Object.values(tierAssets)){set.exteriorBounds=exteriorBounds;set.amenityBounds=amenityBounds;}
    ready=true;canvas.dataset.ready='true';canvas.dataset.emptyReady='true';fitCanvas();canvas.dispatchEvent(new Event('office-layout'));
  }).catch(()=>{canvas.dataset.ready='error';canvas.setAttribute('aria-label','办公室素材加载失败，请刷新页面');});
  loadCharacterArt().then(bundle=>{if(destroyed)return;walkBounds=bundle.meta;walkReady=true;canvas.dataset.walkReady='true';draw();}).catch(()=>{walkReady=false;walkBounds=null;canvas.dataset.walkReady='error';});
  const observer=new ResizeObserver(()=>{fitCanvas();canvas.dispatchEvent(new Event('office-layout'));});observer.observe(scene);
  window.addEventListener('resize',fitCanvas);
  const motionChanged=()=>{
    particles=[];pointEffects=[];hotUntil.clear();
    life.sync(state,Object.fromEntries(state.employees.map(id=>[id,employeeActivity(state,id)])),officeGeometry(state.seats),{staticPose:motion.matches});draw();
  };
  motion.addEventListener('change',motionChanged);
  const timer=setInterval(()=>{if(!document.hidden&&animating&&!motion.matches){frame++;draw();}},180);
  fitCanvas();
  return {
    render(nextState,{arriveFromDoor=false,characters:nextCharacters=characters}={}){
      characters=charactersOrDefault(nextCharacters);
      if(nextState.project?.id!==state.project?.id||(nextState.notices?.length||0)<(state.notices?.length||0)){particles=[];pointEffects=[];hotUntil.clear();emittedPoints=0;}
      const continuous=hasRendered&&nextState.acceptedActions?.length===(state.acceptedActions?.length??0)+1&&nextState.campaignProfile===state.campaignProfile&&nextState.career?.seed===state.career?.seed;
      if(!continuous)particles=[];
      if(continuous&&!motion.matches){
        const fresh=(nextState.notices||[]).slice(state.notices?.length||0),slots=officeGeometry(nextState.seats).seats;
        for(const notice of fresh){
          if(notice.type==='employee-growth'){
            const seat=slots[nextState.employees.indexOf(notice.employeeId)];if(seat)particles.push({x:seat[0]+45,y:seat[1]+12,text:'能力提升!',color:'#a86612',born:Date.now()});
          }
        }
        particles=particles.slice(-18);
      }
      hasRendered=true;state=nextState;canvas.dataset.officeTier={4:'startup',6:'studio',8:'headquarters'}[officeTier(state.seats)];canvas.dataset.officeCapacity=String(officeTier(state.seats));canvas.dataset.people=String(state.employees.length);canvas.dataset.compute=String(state.compute);canvas.dataset.fixedStaff='boss,secretary';
      const activities=state.employees.map(id=>({id,...employeeActivity(state,id)}));
      life.sync(state,Object.fromEntries(activities.map(item=>[item.id,item])),officeGeometry(state.seats),{staticPose:motion.matches,arriveFromDoor});
      canvas.dataset.planningEmployee=activities.find(a=>a.kind==='planning')?.id||'';
      canvas.dataset.workingEmployees=activities.filter(a=>a.active&&['planning','research'].includes(a.kind)).map(a=>a.id).join(',');
      if(fittedTier!==state.seats){fittedTier=state.seats;fitCanvas();canvas.dispatchEvent(new Event('office-layout'));}else draw();
    },
    step(elapsedMs,playing,{fraction=0}={}){
      const commuting=life.hasPresentationMotion();animating=playing;if(playing||commuting)pointClock+=Math.max(0,elapsedMs);
      if((playing||commuting)&&!motion.matches)life.step(elapsedMs,true,{fraction,presentationOnly:!playing,blocked:[...pointEffects.map(point=>point.employeeId),...hotUntil.keys()]});
      if((playing||commuting)&&!motion.matches||pointEffects.length||hotUntil.size){for(const [id,until]of hotUntil)if(until<=pointClock)hotUntil.delete(id);draw();}
    },
    showPoints(events){
      if(motion.matches)return;
      const snapshot=life.snapshot();
      for(const event of events){
        if(event.projectId!==state.project?.id||!state.employees.includes(event.employeeId)||!canShowOfficePoint(snapshot,event.employeeId))continue;
        emittedPoints++;canvas.dataset.lastPointEmployee=event.employeeId;canvas.dataset.lastPointDirection=event.direction;canvas.dataset.lastPointDuration=String(event.lifetime);canvas.dataset.lastPointTime=String(pointClock);
        if(event.age<event.lifetime){pointEffects.push({...event,born:pointClock-event.age});if(event.burst)hotUntil.set(event.employeeId,Math.max(hotUntil.get(event.employeeId)||0,pointClock+event.lifetime-event.age));}
      }
      if(events.length)draw();
    },
    clearPoints(){pointEffects=[];hotUntil.clear();draw();},
    setReferenceLines(show){referenceLines=!!show;draw();},
    setPathLines(show){pathLines=!!show;draw();},
    tourFacilities(id){const started=life.startFacilityTour(id);draw();return started;},
    destroy(){destroyed=true;clearInterval(timer);observer.disconnect();window.removeEventListener('resize',fitCanvas);motion.removeEventListener('change',motionChanged);chatBubble.remove();},
  };
}

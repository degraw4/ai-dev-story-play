import {drawCharacterSeated,drawCharacterBox,characterArtReady,characterKey} from './character-art.js';
import {drawOfficeExterior,drawExteriorForeground} from './office-exterior.js';
import {ISO,OFFICE_WORLD,officeGeometry,officeTier,DESK_TOP,DESK_TOPS,deskRole,workstationGroundAt,workstationGround,workstationChairGround,workstationChairGroundAt,workstationSeatPoint,officePropSpecs} from './office-layout.js';
export {ISO,OFFICE_WORLD,officeGeometry,officeTier,officeCamera,DESK_TOP,DESK_TOPS,workstationGroundAt,workstationGround,workstationChairGround,workstationChairGroundAt,workstationSeatPoint,officePropSpecs} from './office-layout.js';
export const WORKER_CELLS={avery:0,jules:1,morgan:2,casey:3,alex:4,rebo:5,karpathy:6,boris:2,tim:3,max:7,boss:9,secretary:10};
function poly(c,p,fill,stroke){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=2;c.strokeStyle=stroke;c.stroke();}}
function line(c,a,b,color,width=2){c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function crop(c,image,meta,cell,x,y,w,h){
  const rect=meta?.sourceRects[cell];if(!rect||!image?.naturalWidth)return;
  const height=h??w*rect[3]/rect[2],clip=meta.sourceClips?.[cell];
  if(clip){
    // Some complete objects overlap a neighbouring cell's rectangular bounds.
    // Clip to the measured alpha component without changing the original atlas.
    c.save();c.beginPath();for(const [rx,ry,rw,rh]of clip)c.rect(x+rx/rect[2]*w,y+ry/rect[3]*height,rw/rect[2]*w,rh/rect[3]*height);c.clip();
  }
  c.drawImage(image,...rect,x,y,w,height);if(clip)c.restore();
}
export function drawDesk(c,assets,role='employee'){
  const q=DESK_TOPS[role],lower=q.map(([x,y])=>[x,y+76]),panel=q.map(([x,y])=>[x,y+58]),tier=assets?.tier??(assets?.expanded?6:4),hq=tier===6,premium=tier===8;
  const side=(i,j,fill)=>poly(c,[q[i],q[j],panel[j],panel[i]],fill,'#4b5052');
  // Plain pale office desks and dark modesty panels match the compact reference
  // furniture. The executive and reception desk keep distinct silhouettes.
  side(0,3,premium?'#9e8067':role==='boss'?'#c7c9c2':hq?'#d3cdc1':'#b3bbc0');
  side(3,2,premium?'#6a5546':role==='boss'?'#63686b':role==='secretary'?'#8a989a':'#747c80');
  for(const i of [0,2,3]){line(c,[q[i][0],q[i][1]+8],[lower[i][0],lower[i][1]],'#4a5359',7);line(c,[q[i][0]+1,q[i][1]+10],[lower[i][0]+1,lower[i][1]-3],'#cdd3d3',3);}
  if(role==='employee'){for(const t of [25,48])line(c,[q[0][0]+8,q[0][1]+t],[q[3][0]-8,q[3][1]+t-8],'#848c8e',2);}
  // The component atlas contains complete objects, not flat texture swatches.
  // Mapping those objects onto this plane would draw a second tilted desktop.
  poly(c,q,premium?'#c6a98b':role==='secretary'?'#dfe8e7':role==='boss'?'#f2eee3':hq?'#f0ebdf':'#e8edf0','#4b5052');
  line(c,q[0],q[3],'#fffff4',3);line(c,q[3],q[2],'#e3e9e4',3);
  if(role==='secretary'){const a=q[3],b=q[2];line(c,[a[0],a[1]-4],[b[0],b[1]-4],hq?'#b8d7d3':'#c5d8de',4);}
}
function monitor(c,assets,x,y,{portrait=false,width=76,front=false}={}){
  const h=portrait?82:49,d=portrait?43:width,stem=25;
  // The rear casing and front glass are opposite faces of the same thin LCD.
  const q=[[x-d/2,y-stem+d/4-h],[x+d/2,y-stem-d/4-h],[x+d/2,y-stem-d/4],[x-d/2,y-stem+d/4]];
  poly(c,[[x-13,y],[x,y-6.5],[x+13,y],[x,y+6.5]],'#53616e','#34424e');
  c.fillStyle='#637280';c.fillRect(x-4,y-stem-2,8,stem+3);
  if(front){poly(c,q,'#c5dff0','#4b535b');const inner=q.map(([px,py])=>[x+(px-x)*.82,y-stem-h*.5+(py-(y-stem-h*.5))*.8]);poly(c,inner,'#9ac8e5');line(c,inner[0],inner[1],'#d4eff4',3);}else{poly(c,q,'#4b555d','#30383e');c.fillStyle='#7b8791';c.fillRect(x-5,y-stem-h*.45,10,13);}line(c,q[0],q[1],'#81909b',2);
}
export function screenSetup(id){return ['morgan','rebo','max'].includes(id)?'mixed':['avery','casey','karpathy'].includes(id)?'dual':'single';}
function drawEmployeeChair(c,assets,orientation='se'){
  // One physical model, with a half-turn on the floor plane. Do not mix a
  // photographed atlas chair on one side with a different reverse-view model.
  const reverse=orientation==='nw',tier=assets.tier??(assets.expanded?6:4),base=tier===6?'#cb573d':tier===8?'#545659':'#697078',light=tier===6?'#e97b50':tier===8?'#7c7b78':'#999e9f',dark=tier===6?'#9d4033':'#45474a';
  const [cx,cy]=reverse?[259.28,339.2]:[126.72,218.8],sign=reverse?-1:1;
  const p=(u,v,z=0)=>[cx+sign*(u-v)*42,cy+sign*(u+v)*21-z];
  const face=(q,fill,stroke='#39434a')=>poly(c,q.map(([u,v,z])=>p(u,v,z)),fill,stroke);
  // Five-spoke base, same height, padding and armrests for both facings.
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,tip=[Math.cos(a)*.66,Math.sin(a)*.66];line(c,p(0,0,7),p(...tip,4),'#414a50',6);line(c,p(...tip,1),p(...tip,7),'#303a40',7);}
  line(c,p(0,0,8),p(0,0,54),'#505c62',8);line(c,p(-.03,0,10),p(-.03,0,50),'#adb8bc',3);
  face([[-.5,-.57,52],[.5,-.57,52],[.5,.57,52],[-.5,.57,52]],base);
  face([[.5,-.57,47],[.5,.57,47],[.5,.57,53],[.5,-.57,53]],dark);
  const back=()=>{face([[-.5,-.61,52],[-.5,.61,52],[-.5,.61,111],[-.5,-.61,111]],base);face([[-.49,-.49,60],[-.49,.49,60],[-.49,.49,103],[-.49,-.49,103]],light);line(c,p(-.5,-.6,111),p(-.5,.6,111),'#b9aaa0',2);if(tier===8)for(const v of [-.25,.25])for(const z of [73,92]){const [x,y]=p(-.49,v,z);c.fillStyle='#c1bbb0';c.fillRect(x-2,y-2,4,4);}};
  if(!reverse)back();
  for(const v of [-.64,.64]){line(c,p(.12,v,52),p(.12,v,70),'#424d53',4);line(c,p(-.28,v,72),p(.4,v,72),'#3e484e',6);line(c,p(-.28,v,74),p(.4,v,74),light,2);}
  if(reverse)back();
}
function drawReverseWorkstation(c,assets,id,{occupied,layer}){
  if(layer==='chair'){drawEmployeeChair(c,assets,'nw');return;}
  drawDesk(c,assets,'employee');
  if(assets.tier===8)poly(c,[[145,207],[221,169],[290,203.5],[214,241.5]].map(([x,y])=>[386-x,406-y]),'#71a783','#4b6d58');
  const keyboard=[[160,187],[207,163.5],[235,177.5],[188,201]].map(([x,y])=>[386-x,406-y]);poly(c,keyboard,'#697780','#414d55');
  for(let row=0;row<3;row++)line(c,[178+row*7,235-row*3.5],[210+row*7,219-row*3.5],'#c4d1d1',2);
  const setup=screenSetup(id);
  if(setup==='single')monitor(c,assets,119,211,{front:true});
  else{monitor(c,assets,163,189,{width:72,front:true});monitor(c,assets,88,226.5,{portrait:setup==='mixed',width:72,front:true});}
  if(occupied&&id)drawCharacterSeated(c,id,206,134,110,{back:true});
  if(layer==='all')drawEmployeeChair(c,assets,'nw');
}
const workstationCache=new WeakMap();
export function drawWorkstation(c,assets,x,y,id,{width=240,occupied=!!id,cache=true,layer='all',characters,orientation='se'}={}){
  if(cache&&typeof document!=='undefined'&&assets.componentBounds){
    let map=workstationCache.get(assets);if(!map){map=new Map();workstationCache.set(assets,map);}const key=`${id??'empty'}:${occupied}:${layer}:${orientation}:${characterKey(id,characters)}:${characterArtReady()}`;
    if(!map.has(key)){const canvas=document.createElement('canvas');canvas.width=384;canvas.height=370;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;drawWorkstation(ctx,assets,192,350,id,{width:384,occupied,cache:false,layer,characters,orientation});map.set(key,canvas);}
    const s=width/384;c.drawImage(map.get(key),x-width/2,y-350*s,width,370*s);return;
  }
  c.save();const s=width/384;c.translate(x-width/2,y-350*s);c.scale(s,s);
  if(orientation==='nw'&&deskRole(id)==='employee'){drawReverseWorkstation(c,assets,id,{occupied,layer});c.restore();return;}
  const role=deskRole(id),chairCell={employee:4,boss:5,secretary:6}[role],chairRect=assets.componentBounds?.sourceRects[chairCell];
  if(layer!=='desk'){
    if(role==='employee')drawEmployeeChair(c,assets);
    else if(chairRect){const w=role==='boss'?111:105,h=w*chairRect[3]/chairRect[2];crop(c,assets.components,assets.componentBounds,chairCell,79,235-h,w,h);}
  }
  if(layer==='chair'){c.restore();return;}
  drawDesk(c,assets,role);
  if(assets.tier===8&&role==='employee')poly(c,[[145,207],[221,169],[290,203.5],[214,241.5]],'#71a783','#4b6d58');
  // Small keyboard and papers also follow the two structural axes.
  poly(c,[[160,187],[207,163.5],[235,177.5],[188,201]],'#646b6e','#424b50');
  for(let row=0;row<3;row++)for(let col=0;col<7;col++)poly(c,[[167+col*5+row*6,184-col*2.5+row*3],[170+col*5+row*6,182.5-col*2.5+row*3],[174+col*5+row*6,184.5-col*2.5+row*3],[171+col*5+row*6,186-col*2.5+row*3]],'#adb7b8');
  poly(c,[[84,222],[122,203],[148,216],[110,235]],'#f7f9ed','#afb9b9');line(c,[95,220],[119,208],'#b6c4c9',2);line(c,[100,224],[124,212],'#b6c4c9',2);
  if(occupied&&id)drawCharacterSeated(c,id,95,30,110,{characters});
  const setup=screenSetup(id);
  if(setup==='single')monitor(c,assets,267,195);
  else{monitor(c,assets,223,217,{width:72});monitor(c,assets,298,179.5,{portrait:setup==='mixed',width:72});}
  c.fillStyle='#ebd5a7';c.fillRect(289,211,12,17);c.fillStyle='#fff3d3';c.fillRect(289,208,12,5);c.strokeStyle='#7b715d';c.lineWidth=2;c.strokeRect(300,213,5,9);
  c.restore();
}
// Match hair/head width to the seated atlas, then anchor each cropped gait frame
// by its bottom centre. The sheet's transparent cell padding is not body size.
export const SEATED_HEAD=[122,129,128,129,132,128,128,127];const WALK_HEAD=[120,124,122,125,129,122,124,119];
export function walkerPlacement(cell,size,walkRects,seatedRects){
  const index=cell%8,rect=walkRects[cell],seat=seatedRects[index];
  const scale=(size/384)*(110/seat[2])*SEATED_HEAD[index]/WALK_HEAD[index];
  return {rect,width:rect[2]*scale,height:rect[3]*scale,headWidth:WALK_HEAD[index]*scale};
}
export function workstationHead(x,y,size,orientation='se'){return orientation==='nw'?[x+size*.18,y-size*.46]:[x-size*.11,y-size*.76];}
function windowPane(c,p,side,from,to,low,height,assets){
  const at=(n,z)=>side?p(n,0,z):p(0,n,z),q=[at(from,low),at(to,low),at(to,height),at(from,height)];
  poly(c,q,assets.tier===8?'#b9cdd0':'#8bbcc7',assets.tier===8?'#969c97':assets.expanded?'#517e79':'#8a805f');
  const mid=(from+to)/2;
  poly(c,[at(from+.12,low+5),at(mid-.07,low+5),at(mid-.07,height-5),at(from+.12,height-5)],'#c5dfe3');
  poly(c,[at(mid+.07,low+5),at(to-.12,low+5),at(to-.12,height-5),at(mid+.07,height-5)],'#a6d1dc');
  line(c,at(mid,low),at(mid,height),'#f6f0db',5);
  line(c,at(from,low),at(to,low),'#e4e6d9',5);
  line(c,at(from,height),at(to,height),'#f7f4df',4);
  if(assets.tier===8)for(let z=low+12;z<height-5;z+=14)line(c,at(from+.12,z),at(to-.12,z),'#dce5de',3);
}
function floorWood(c,p,u0,v0,u1,v1){
  poly(c,[p(u0,v0),p(u1,v0),p(u1,v1),p(u0,v1)],'#cba775');
  for(let v=v0,n=0;v<v1;v+=.7,n++){
    const next=Math.min(v1,v+.7);poly(c,[p(u0,v),p(u1,v),p(u1,next),p(u0,next)],n%2?'#d0ac78':'#c49b65');
    line(c,p(u0,v),p(u1,v),'#e5c798',2);
    for(let u=u0+(n%3)*1.1;u<u1;u+=3.3)line(c,p(u,v),p(u,next),'#ba935f',1);
  }
}
function floorTiles(c,p,u0,v0,u1,v1,colors,tile=1.5){
  for(let u=u0,i=0;u<u1;u+=tile,i++)for(let v=v0,j=0;v<v1;v+=tile,j++)poly(c,[p(u,v),p(Math.min(u1,u+tile),v),p(Math.min(u1,u+tile),Math.min(v1,v+tile)),p(u,Math.min(v1,v+tile))],colors[(i+j)%colors.length]);
}
export function drawRoom(c,{expanded=false,tier:requestedTier,assets={}}={}){
  const g=officeGeometry(requestedTier??expanded),{project:p,cols,rows,tier}=g;assets={...assets,expanded:g.expanded,tier};
  drawOfficeExterior(c,g,assets);
  const corners=[p(0,0),p(cols,0),p(cols,rows),p(0,rows)];
  poly(c,[corners[1],corners[2],p(cols,rows,-14),p(cols,0,-14)],'#aaa99d','#737a76');
  poly(c,[corners[3],corners[2],p(cols,rows,-14),p(0,rows,-14)],'#d4d0c2','#82918a');
  if(tier===4){
    floorWood(c,p,0,0,cols,rows);
    floorTiles(c,p,3,.5,11.6,12.1,['#bab6ae','#c7c2b8'],1.4);
    poly(c,[p(3,.5),p(11.6,.5),p(11.6,12.1),p(3,12.1)],null,'#e8e1d0');
  }else if(tier===6){
    floorTiles(c,p,0,0,cols,rows,['#b9ddab','#cce8b7']);
    floorTiles(c,p,.4,.4,13.1,14.1,['#bed9ef','#cbe4f7']);
    line(c,p(.4,14.1),p(13.1,14.1),'#789bb7',4);
    floorWood(c,p,0,19.1,12.2,rows);
  }else{
    floorTiles(c,p,0,0,cols,rows,['#9b7555','#a47e5c','#a17a57','#ac8562'],1.35);
    floorTiles(c,p,7.7,.4,cols,10.5,['#b58b63','#bc956e'],1.35);
    line(c,p(7.7,10.5),p(cols,10.5),'#6f533a',12);line(c,p(7.7,10.5,5),p(cols,10.5,5),'#d1ae7c',3);
    floorTiles(c,p,0,21.9,8,rows,['#adaba4','#c0beb5'],1.4);
  }
  const height=tier===4?180:tier===6?200:190;
  for(const side of [0,1]){
    const end=side?cols:rows,at=(n,z)=>side?p(n,0,z):p(0,n,z),q=[at(0,0),at(end,0),at(end,height),at(0,height)];
    const wall=tier===4?(side?'#c29c6d':'#d5b789'):tier===6?(side?'#a1cfc3':'#c2e0d5'):(side?'#d0cec3':'#e6e2d6');
    poly(c,q,wall,tier===4?'#947953':'#8a9790');
    if(tier===4)for(let n=0;n<end;n+=1.15){line(c,at(n,19),at(n,height-8),'#b49469',2);line(c,at(n+.12,19),at(n+.12,height-8),'#e7cda0',2);}
    poly(c,[at(0,0),at(end,0),at(end,22),at(0,22)],tier===4?'#ad8456':tier===6?'#72a99a':'#aaa99d');
    for(let i=1.2;i<end-1;i+=tier===4?4.3:4.7)windowPane(c,p,side,i,Math.min(end-.5,i+(tier===4?2.7:2.9)),tier===4?62:52,height-28,assets);
    for(const z of [8,25,height-9])line(c,at(0,z),at(end,z),tier===4?'#ead1a4':tier===6?'#d9efe0':'#f1eddf',4);
    line(c,at(0,height),at(end,height),tier===4?'#eed4a8':'#f1f0e2',8);
    line(c,at(0,height+3),at(end,height+3),tier===4?'#8e7450':'#87918a',2);
  }
  const clock=p(0,tier===4?7.1:6.9,142);c.fillStyle=tier===4?'#8c7754':'#63916b';c.fillRect(clock[0]-12,clock[1]-14,24,28);c.fillStyle='#edf1df';c.fillRect(clock[0]-9,clock[1]-11,18,22);line(c,[clock[0],clock[1]-7],[clock[0],clock[1]+1],'#4d6257',2);line(c,[clock[0],clock[1]+1],[clock[0]+5,clock[1]+3],'#4d6257',2);
  if(tier===4){
    // Small company plaque follows the wall plane, with no illegible raster text.
    poly(c,[p(0,3.6,139),p(0,5.4,139),p(0,5.4,169),p(0,3.6,169)],'#f1edcf','#685a44');
    for(let n=3.8;n<5.3;n+=.3)line(c,p(0,n,150),p(0,n+.12,157),'#9a9e95',3);
  }
  line(c,p(0,rows),p(cols,rows),'#e7dfcc',5);line(c,p(cols,0),p(cols,rows),'#e7dfcc',5);
  const [,dv]=g.entryGrid;
  if(tier===4){const mat=[p(cols-2,dv-1.1),p(cols,dv-1.1),p(cols,dv+1.1),p(cols-2,dv+1.1)];poly(c,mat,'#dd725e','#a45e4d');line(c,mat[0],mat[1],'#f4a38b',3);}
  else{
    // Attached entrance volume lies outside u=0, never as a tiny house inside.
    const z=tier===6?150:115,a=dv-2,b=Math.min(rows,dv+2.4),back=-3.4;
    poly(c,[p(back,a),p(0,a),p(0,a,z),p(back,a,z)],tier===6?'#c6c9bf':'#d1cfc5','#888f87');
    poly(c,[p(back,a,z),p(0,a,z),p(0,b,z),p(back,b,z)],'#c8ccc4','#8c9690');
    poly(c,[p(0,a),p(0,b),p(0,b,z),p(0,a,z)],'#e6e5d9','#92998d');
    poly(c,[p(.02,dv-1.1),p(.02,dv+1.1),p(.02,dv+1.1,z-15),p(.02,dv-1.1,z-15)],tier===6?'#dc615a':'#96b5b9','#7f7063');
    const knob=p(.07,dv-.7,55);c.fillStyle='#e7d8aa';c.fillRect(knob[0]-2,knob[1]-2,5,5);
  }
  drawExteriorForeground(c,g,assets,{plants:false});return g;
}
// Align the source's actual lowest opaque point with the front corner of its
// floor footprint. Transparent padding must not lift furniture off the floor.
export function propImagePlacement(spec,meta,layout){
  const r=meta.sourceRects[spec.cell],extreme=meta.extrema[spec.cell].bottom,cw=Math.floor(meta.width/meta.columns),sourceBottom=[spec.cell%meta.columns*cw+extreme[0],Math.round(Math.floor(spec.cell/meta.columns)*meta.height/meta.rows)+extreme[1]],s=spec.width/r[2];
  const [u,v]=[spec.ground[2],spec.ground[3]],front=layout.project(u,v);
  return {x:front[0]-(sourceBottom[0]-r[0])*s,y:front[1]-(sourceBottom[1]-r[1])*s,width:spec.width,height:r[3]*s};
}
export function whiteboardPanel(layout,spec){
  const {u,v}=spec,p=layout.project;
  return [p(u,v-2,44),p(u,v+2,44),p(u,v+2,136),p(u,v-2,136)];
}
function drawWhiteboard(c,layout,spec){
  const {u,v}=spec,p=layout.project,at=(t,z)=>p(u+.03,v+t,z);
  // Upright board parallel to the left wall; its long edges share the room's
  // exact 2:1 axis, and both feet touch the same ground plane.
  for(const t of [-1.7,1.7]){line(c,at(t,0),at(t,127),'#525e65',6);line(c,p(u-.35,v+t),p(u+.45,v+t),'#4a565c',7);line(c,p(u-.35,v+t,3),p(u+.45,v+t,3),'#c6cdcb',3);}
  poly(c,whiteboardPanel(layout,spec),'#707d82','#303d44');
  poly(c,[at(-1.86,49),at(1.86,49),at(1.86,130),at(-1.86,130)],'#f3f4eb','#b3bcb9');
  for(let row=0;row<3;row++)line(c,at(.5,107-row*13),at(1.48,107-row*13),'#a8b8ba',3);
  const chart=[[-1.56,69],[-1.2,82],[-.92,76],[-.57,102],[-.2,107]];
  for(let i=1;i<chart.length;i++)line(c,at(...chart[i-1]),at(...chart[i]),'#d85c57',4);
  for(let i=0;i<3;i++)line(c,at(-1.54+i*.36,112),at(-1.54+i*.36,122-i*4),'#589bc7',6);
  line(c,at(-2.08,43),at(2.08,43),'#5b696f',5);line(c,at(.7,45),at(1.05,45),'#d45753',4);
}
export function roomProps(assets,value=4){
  const layout=officeGeometry(value),p=layout.project;
  return officePropSpecs(value).map(spec=>{const [x,y]=p(...spec.center);return {...spec,x,y,paintShadow:c=>{const [a,b,d,e]=spec.ground;c.save();c.globalAlpha=.14;poly(c,[p(a,b),p(d,b),p(d,e),p(a,e)],'#465b55');c.restore();},paint:c=>{if(spec.key==='whiteboard'){drawWhiteboard(c,layout,spec);return;}const meta=spec.atlas==='amenities'?assets.amenityBounds:assets.componentBounds,image=spec.atlas==='amenities'?assets.amenities:assets.components;if(meta){const r=propImagePlacement(spec,meta,layout);c.save();if(spec.mirror){const [anchorX]=p(spec.ground[2],spec.ground[3]);c.translate(2*anchorX,0);c.scale(-1,1);}crop(c,image,meta,spec.cell,r.x,r.y,r.width,r.height);c.restore();}}};});
}

export function drawLeadershipPortrait(c,assets,role,characters,width,height){
  c.clearRect(0,0,width,height);drawCharacterBox(c,role,2,2,width-4,height-4,{mode:'portrait',characters});
}

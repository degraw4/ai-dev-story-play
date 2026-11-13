// Screenshot-coordinate display branch. No economic state, storage or main
// office geometry is used here. Backing pixels are never resized or filtered.
import {loadCharacterArt,drawCharacterSeated,drawCharacterSeatedLowerBody,drawCharacterWalk} from './character-art.js';
import {walkDirection} from './office-walk-animation.js';
import {registerReferenceScene} from './reference-office-registration.js';

export const REFERENCE_CANVAS=Object.freeze([1856,800]);
export const REFERENCE_MANIFEST_URL=new URL('../assets/office/reference-copy-v2/scenes.json',import.meta.url);
const imageRequests=new Map();
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const same=(a,b)=>length(a,b)<.001;

export function polygonBounds(polygon){
  if(!Array.isArray(polygon)||polygon.length<3)return null;
  const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);
  if(![...xs,...ys].every(Number.isFinite))return null;
  const x=Math.floor(Math.min(...xs)),y=Math.floor(Math.min(...ys));
  return {x,y,width:Math.ceil(Math.max(...xs))-x,height:Math.ceil(Math.max(...ys))-y};
}

const seatedAtDock=(actor,route)=>route.atDock&&(actor.mode==='seatedFront'||actor.mode==='seatedBack');
export function referenceActorBounds(actor,route,scale=1.3){
  if(seatedAtDock(actor,route)){const [x,y]=actor.head??actor.foot;return {x:Math.round(x-32*scale),y:Math.round(y-25.5*scale),width:64*scale,height:(actor.seatedFull?104:84)*scale};}
  const [x,y]=route.position;return {x:Math.round(x)-64*scale,y:Math.round(y)-120*scale,width:128*scale,height:128*scale};
}

// A desk mask associated with its seated worker must not cover the worker on
// the opposite side. Moving people still use every foreground's floor depth.
export function referenceActorOccluders(patches,actor,route){
  const seated=seatedAtDock(actor,route);
  const associated=patches.filter(p=>Array.isArray(p.actorIds)&&!(seated?p.walkingOnly:p.seatedOnly));
  const fixed=patches.filter(p=>p.ground&&!Array.isArray(p.actorIds)&&!(seated?p.walkingOnly:p.seatedOnly)).filter(p=>referencePatchOccludes(p,route.position));
  return [...(seated?associated.filter(p=>p.actorIds.includes(actor.id)):associated.filter(p=>referencePatchOccludes(p,route.position))),...fixed];
}
export const referenceActorLowerBodyOccluders=(patches,actor)=>patches.filter(p=>p.actorIds?.includes(actor.id));
// Furniture can be long along either floor axis; screenY alone would put a
// visitor in front of the left end but behind the right end of one cabinet.
export function referencePatchOccludes(patch,[x,y]){
  if(!patch.ground)return patch.depth>=y;
  const [u,v]=[y+x/2,y-x/2],[l,t,r,b]=patch.ground;
  if(patch.kind==='chair'&&patch.depthAnchor){
    const [cx,cy]=patch.depthAnchor,cu=cy+cx/2,cv=cy-cx/2;
    // The raised backrest sits on a plane through the chair base. Padding
    // used to keep walkers away from a chair is not its visible depth plane.
    if(u>=cu-1||v>cv+8)return false;
  }
  const behind=u<=l||v<=t,inFront=u>=r||v>=b;
  // A person beyond either visible floor edge is in front, including a
  // side/front corner. Falling back to screenY there sliced heads off beside
  // chairs whose backrest is higher than the person's ground contact.
  if(inFront)return false;
  if(behind)return true;
  return (patch.depthAnchor?.[1]??patch.depth)>=y;
}

// Routes reverse at their final point instead of teleporting. The optional
// pause occurs at the original dock; a seated actor can sit between trips.
export function sampleReferenceRoute(actor,timeMs,{speed=80,pauseMs=1200}={}){
  const foot=Array.isArray(actor.foot)?actor.foot:actor.head??[0,0];
  const supplied=(actor.route??[]).filter(p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite));
  const points=[foot,...supplied].filter((p,i,all)=>!i||!same(p,all[i-1]));
  if(points.length<2||speed<=0)return {position:[...foot],walked:0,moving:false,atDock:true,direction:actor.direction??'southwest'};
  if(!same(points[0],points.at(-1)))points.push(...points.slice(0,-1).reverse());
  const segments=points.slice(1).map((p,i)=>({from:points[i],to:p,length:length(points[i],p)})).filter(s=>s.length>.001);
  const total=segments.reduce((sum,s)=>sum+s.length,0);
  if(!total)return {position:[...foot],walked:0,moving:false,atDock:true,direction:actor.direction??'southwest'};
  const movingMs=total/speed*1000,cycle=movingMs+pauseMs,now=Math.max(0,timeMs)%cycle;
  if(now<pauseMs)return {position:[...foot],walked:0,moving:false,atDock:true,direction:actor.direction??'southwest'};
  const walked=(now-pauseMs)*speed/1000;let distance=walked;
  for(const segment of segments){
    if(distance<=segment.length){const t=distance/segment.length;return {position:segment.from.map((n,i)=>n+(segment.to[i]-n)*t),walked,moving:true,atDock:false,direction:walkDirection(segment.to[0]-segment.from[0],segment.to[1]-segment.from[1],actor.direction??'southwest')};}
    distance-=segment.length;
  }
  return {position:[...foot],walked:total,moving:false,atDock:true,direction:actor.direction??'southwest'};
}

export async function loadReferenceManifest(url=REFERENCE_MANIFEST_URL){
  const resolved=new URL(url,REFERENCE_MANIFEST_URL),response=await fetch(resolved,{cache:'no-store'});
  if(!response.ok)throw new Error('截图底稿与标定清单尚未就绪，请稍后重新加载。');
  const data=await response.json();
  if(!data.scenes||!Array.isArray(data.canvas)||data.canvas.length!==2||!data.canvas.every(n=>Number.isInteger(n)&&n>0))throw new Error('像素底稿清单格式不完整。');
  imageRequests.clear();
  return {data,baseUrl:resolved.protocol==='data:'?new URL('../assets/office/reference-copy-v2/',import.meta.url):new URL('./',resolved)};
}

function loadImage(path,baseUrl){
  const url=new URL(path,baseUrl).href;
  if(imageRequests.has(url))return imageRequests.get(url);
  const image=new Image();image.src=url;
  const request=image.decode().then(()=>image).catch(()=>{imageRequests.delete(url);throw new Error(`底稿资源尚未就绪：${path}`);});
  imageRequests.set(url,request);return request;
}

function clippedPatch(image,polygon,depth){
  const b=polygonBounds(polygon);if(!b||b.width<=0||b.height<=0)return null;
  const canvas=document.createElement('canvas');canvas.width=b.width;canvas.height=b.height;
  const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.beginPath();polygon.forEach(([x,y],i)=>i?c.lineTo(x-b.x,y-b.y):c.moveTo(x-b.x,y-b.y));c.closePath();c.clip();c.drawImage(image,-b.x,-b.y);
  return {...b,canvas,depth:Number.isFinite(depth)?depth:Math.max(...polygon.map(p=>p[1]))};
}

function maskOverlay(image){
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
  const pixels=c.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
  let hasTransparent=false;for(let i=3;i<d.length;i+=4)if(d[i]<128){hasTransparent=true;break;}
  for(let i=0;i<d.length;i+=4){const selected=hasTransparent?d[i+3]>=128:Math.max(d[i],d[i+1],d[i+2])>=128;d[i]=244;d[i+1]=74;d[i+2]=100;d[i+3]=selected?138:0;}
  c.putImageData(pixels,0,0);return canvas;
}

export function createReferenceOfficeRenderer(canvas,scene,{baseUrl=new URL('../assets/office/reference-copy-v2/',import.meta.url),canvasSize=REFERENCE_CANVAS,characterScale=1.3,comparisonAssets=true,onStatus=()=>{}}={}){
  if(!canvas||!scene)throw new Error('缺少像素场景或画布。');
  scene=registerReferenceScene(scene);
  canvas.width=canvasSize[0];canvas.height=canvasSize[1];
  const c=canvas.getContext('2d');let destroyed=false,assets=null;
  const replica=document.createElement('canvas');replica.width=canvas.width;replica.height=canvas.height;const r=replica.getContext('2d');
  const actorLayer=document.createElement('canvas'),layer=actorLayer.getContext('2d');
  const laneLayer=document.createElement('canvas');laneLayer.width=canvas.width;laneLayer.height=canvas.height;const lanes=laneLayer.getContext('2d');
  let options={view:'replica',showActors:true,showMask:false,walking:false,time:0};
  canvas.dataset.referenceSceneReady='false';canvas.dataset.nativeWidth=String(canvas.width);canvas.dataset.nativeHeight=String(canvas.height);canvas.dataset.characterScale=String(characterScale);
  const status=(phase,message)=>{if(!destroyed)onStatus({phase,message});};status('loading','加载原图、修补底稿与人物资源…');

  function paintActor(context,actor,route){
    // Remove occluded pixels from this actor alone. Repainting clean scenery
    // over a composed frame also erased neighbouring people at busy desks.
    const rect=referenceActorBounds(actor,route,characterScale);
    actorLayer.width=Math.ceil(rect.width);actorLayer.height=Math.ceil(rect.height);
    layer.imageSmoothingEnabled=false;layer.translate(-rect.x,-rect.y);
    if(seatedAtDock(actor,route)){
      const pose={back:actor.mode==='seatedBack',direction:actor.seatedDirection,characters:options.characters};
      if(actor.seatedFull){
        drawCharacterSeatedLowerBody(layer,actor.spriteId??actor.id,rect.x,rect.y,rect.width,pose);
        // Only trouser/shoe pixels exist in the layer at this point. Desk
        // foregrounds can hide the entire thigh from its hip without erasing
        // hands that share the same rows. No rectangular waist cutoff.
        layer.globalCompositeOperation='destination-out';
        for(const patch of referenceActorLowerBodyOccluders(assets.lowerBodyOccluders,actor))layer.drawImage(patch.canvas,patch.x,patch.y);
        layer.globalCompositeOperation='source-over';
      }
      drawCharacterSeated(layer,actor.spriteId??actor.id,rect.x,rect.y,rect.width,pose);
    }else{
      const [x,y]=route.position,size=characterScale*384*64/110;
      drawCharacterWalk(layer,actor.spriteId??actor.id,Math.round(x),Math.round(y),size,{direction:route.direction,walked:route.walked,moving:route.moving,characters:options.characters});
    }
    const patches=referenceActorOccluders(assets.occluders,actor,route);
    if(patches.length){
      layer.globalCompositeOperation='destination-out';
      for(const patch of patches)layer.drawImage(patch.canvas,patch.x,patch.y);
    }
    context.drawImage(actorLayer,rect.x,rect.y);
  }

  function paintReplica(){
    r.setTransform(1,0,0,1,0,0);r.globalAlpha=1;r.imageSmoothingEnabled=false;r.clearRect(0,0,replica.width,replica.height);r.drawImage(assets.clean,0,0);
    if(options.pathSegments?.length){
      lanes.setTransform(1,0,0,1,0,0);lanes.globalCompositeOperation='source-over';lanes.clearRect(0,0,laneLayer.width,laneLayer.height);lanes.strokeStyle='#277fa2';lanes.lineWidth=3;lanes.globalAlpha=.7;
      for(const [a,b]of options.pathSegments){lanes.beginPath();lanes.moveTo(...a);lanes.lineTo(...b);lanes.stroke();}
      // A path marks the floor below the desk, never the surface of a monitor
      // or the back of a chair, and people are drawn above it afterwards.
      lanes.globalAlpha=1;lanes.globalCompositeOperation='destination-out';for(const patch of assets.occluders)lanes.drawImage(patch.canvas,patch.x,patch.y);
      r.drawImage(laneLayer,0,0);
    }
    if(options.showActors){
      const entities=assets.occluders.filter(patch=>!Array.isArray(patch.actorIds)&&!patch.ground).map((patch,index)=>({depth:patch.depth,tie:1,index,paint:()=>r.drawImage(patch.canvas,patch.x,patch.y)}));
      for(const [index,actor]of (options.actors??scene.actors??[]).entries()){
        if(actor.offsite)continue;
        const route=actor.routeState??(options.walking?sampleReferenceRoute(actor,options.time):{position:actor.foot??actor.head,walked:0,moving:false,atDock:true,direction:actor.direction??'southwest'});
        const order=seatedAtDock(actor,route)&&Number.isFinite(actor.drawOrder)?actor.drawOrder:index;
        entities.push({depth:route.position?.[1]??actor.head?.[1]??0,tie:0,index:assets.occluders.length+order,paint:()=>paintActor(r,actor,route)});
      }
      entities.sort((a,b)=>a.depth-b.depth||a.tie-b.tie||a.index-b.index).forEach(item=>item.paint());
    }
  }

  const renderer={
    render(next={}){
      options={...options,...next};if(!comparisonAssets){options.view='replica';options.showMask=false;}if(destroyed||!assets)return false;
      c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.imageSmoothingEnabled=false;c.clearRect(0,0,canvas.width,canvas.height);
      if(options.view==='source')c.drawImage(assets.source,0,0);
      else if(options.view==='diff')c.drawImage(assets.diff,0,0);
      else if(options.view==='mask'){c.drawImage(assets.clean,0,0);c.drawImage(assets.maskOverlay,0,0);}
      else{paintReplica();if(options.view==='overlay'){c.drawImage(assets.source,0,0);c.globalAlpha=.5;c.drawImage(replica,0,0);c.globalAlpha=1;}else c.drawImage(replica,0,0);}
      if(options.showMask&&options.view!=='source'&&options.view!=='mask')c.drawImage(assets.maskOverlay,0,0);
      canvas.dataset.referenceView=options.view;canvas.dataset.referenceActors=String(options.showActors&&options.view!=='source');canvas.dataset.referenceWalking=String(options.walking);return true;
    },
    destroy(){destroyed=true;assets=null;},
  };
  const masks=[...(scene.occluders??[]).map(o=>({...o,walkingOnly:o.walkingOnly||Array.isArray(o.actorIds)})),...(scene.seatedForegrounds??[]).map(o=>({...o,seatedOnly:true}))];
  const lowerMasks=scene.seatedLowerBodyOccluders??[];
  const extraPaths=[...new Set([...masks.map(p=>p.asset),...lowerMasks.map(p=>p.asset),...(scene.runtimePatches??[]).map(p=>p.asset)].filter(Boolean))];
  // The actual game needs the clean plate and foregrounds only. Source/diff
  // images are audit tools: their size or availability must not block play.
  const comparison=comparisonAssets?Promise.all([loadImage(scene.source,baseUrl),loadImage(scene.mask,baseUrl),loadImage(scene.diff,baseUrl)]):Promise.resolve([]);
  renderer.ready=Promise.all([loadImage(scene.clean,baseUrl),loadCharacterArt(),Promise.all(extraPaths.map(path=>loadImage(path,baseUrl))),comparison]).then(([cleanPlate,,extras,[source,mask,diff]])=>{
    if(destroyed)return renderer;
    const images=new Map(extraPaths.map((path,i)=>[path,extras[i]]));
    let clean=cleanPlate;
    if(scene.runtimePatches?.length){
      clean=document.createElement('canvas');clean.width=canvas.width;clean.height=canvas.height;const ctx=clean.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(cleanPlate,0,0);
      for(const patch of scene.runtimePatches){const [x,y,w,h]=patch.rect??[0,0,canvas.width,canvas.height];ctx.drawImage(images.get(patch.asset),x,y,w,h);}
    }
    const compileMask=o=>{const patch=clippedPatch(o.asset?images.get(o.asset):clean,o.polygon,o.depth);return patch?{...patch,kind:o.kind,depthAnchor:o.depthAnchor,walkingOnly:o.walkingOnly,seatedOnly:o.seatedOnly,ground:o.ground?[...o.ground]:null,actorIds:Array.isArray(o.actorIds)?[...o.actorIds]:null}:null;};
    assets={source,clean,mask,diff,maskOverlay:mask?maskOverlay(mask):null,occluders:masks.map(compileMask).filter(Boolean),lowerBodyOccluders:lowerMasks.map(compileMask).filter(Boolean)};
    canvas.dataset.referenceSceneReady='true';canvas.dataset.sourceWidth=String((source??cleanPlate).naturalWidth);canvas.dataset.sourceHeight=String((source??cleanPlate).naturalHeight);canvas.dataset.occluders=String(assets.occluders.length);renderer.render();status('ready','底稿已就绪；图片均以原始像素尺寸铺贴。');return renderer;
  }).catch(error=>{canvas.dataset.referenceSceneReady='error';status('error',error.message);throw error;});
  return renderer;
}

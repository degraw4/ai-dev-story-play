// One identity source for office poses, walking, portraits and presentation art.
// Pixel pose rig + skin are compiled offline; runtime draws complete frames.
import {charactersOrDefault} from './characters.js';
import {walkPose} from './office-walk-animation.js';
let bundle=null,pending=null;
export function characterKey(id,characters){
  const choice=charactersOrDefault(characters);
  return id==='boss'?`boss-${choice.boss}`:id==='secretary'?`secretary-${choice.secretary}`:id;
}
export function loadCharacterArt(){
  if(pending)return pending;
  if(typeof Image==='undefined')return Promise.resolve(null);
  const image=new Image();image.src=new URL('../assets/characters/characters-v6.png',import.meta.url).href;
  pending=Promise.all([image.decode(),fetch(new URL('../assets/characters/characters-v6.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('character-art');return r.json();})]).then(([,meta])=>bundle={image,meta}).catch(error=>{pending=null;throw error;});
  return pending;
}
export const characterArtReady=()=>!!bundle;
export function characterFrame(id,{mode='portrait',direction='south',pose=0,characters}={}){
  if(!bundle)return null;const key=characterKey(id,characters),skin=bundle.meta.characters[key];if(!skin)return null;
  if(mode==='walk'){const frames=skin.directions[direction]??skin.directions.south;return {key,skin,rect:frames.rects[pose],mirror:frames.mirror};}
  if(mode==='standing'){const frames=skin.directions[direction]??skin.directions.south,r=frames.rects[0];return {key,skin,rect:[r[0]+32,r[1]+24,64,100],mirror:frames.mirror};}
  if(['seatedFront','seatedBack','seatedFull','seatedBackFull','seatedLowerBody','seatedBackLowerBody'].includes(mode)){
    // The authored front frame reaches southwest. Mirror the entire head and
    // body for southeast desks; never turn only a head above the old torso.
    const facing=direction==='south'?(mode.includes('Back')?'northwest':'southeast'):direction;
    const seated=(mode.endsWith('LowerBody')?skin.seatedLowerBodyDirections:mode.endsWith('Full')?skin.seatedFullDirections:skin.seatedDirections)?.[facing];
    return {key,skin,rect:skin[seated?.pose??mode],mirror:seated?.mirror??mode==='seatedFront'};
  }
  return {key,skin,rect:skin[mode],mirror:false};
}
function paint(c,frame,x,y,w,h){
  if(!frame?.rect)return false;c.save();c.translate(x,y);if(frame.mirror){c.translate(w,0);c.scale(-1,1);}c.imageSmoothingEnabled=false;c.drawImage(bundle.image,...frame.rect,0,0,w,h);c.restore();return true;
}
export function drawCharacterBox(c,id,x,y,width,height,options={}){
  const frame=characterFrame(id,options);if(!frame?.rect)return false;
  const r=frame.rect,s=Math.min(width/r[2],height/r[3]);return paint(c,frame,Math.round(x+(width-r[2]*s)/2),Math.round(y+(height-r[3]*s)/2),r[2]*s,r[3]*s);
}
export function drawCharacterSeated(c,id,x,y,width,{back=false,full=false,direction=back?'northwest':'southeast',characters}={}){
  const frame=characterFrame(id,{mode:full?'seatedFull':back?'seatedBack':'seatedFront',direction,characters});if(!frame?.rect)return false;
  return paint(c,frame,x,y,width,width*frame.rect[3]/frame.rect[2]);
}
// Offline semantic lower-body layer: use its alpha to apply desk occlusion
// without clipping hands that occupy the same vertical rows as the thighs.
export function drawCharacterSeatedLowerBody(c,id,x,y,width,{back=false,direction=back?'northwest':'southeast',characters}={}){
  const frame=characterFrame(id,{mode:back?'seatedBackLowerBody':'seatedLowerBody',direction,characters});if(!frame?.rect)return false;
  return paint(c,frame,x,y,width,width*frame.rect[3]/frame.rect[2]);
}
export function drawCharacterWalk(c,id,x,y,size,{direction='south',walked=0,moving=false,characters}={}){
  const frame=characterFrame(id,{mode:'walk',direction,pose:walkPose(walked,size,moving),characters});if(!frame)return false;
  const scale=size/384*110/64;c.save();c.translate(x,y);if(frame.mirror)c.scale(-1,1);c.imageSmoothingEnabled=false;c.drawImage(bundle.image,...frame.rect,-64*scale,-120*scale,128*scale,128*scale);c.restore();return true;
}
export function createCharacterPortrait(id,{size=40,characters}={}){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;canvas.className='character-portrait';canvas.setAttribute('aria-hidden','true');canvas.dataset.character=characterKey(id,characters);
  const render=()=>drawCharacterBox(canvas.getContext('2d'),id,0,0,64,64,{mode:'portrait',characters});
  if(!render())loadCharacterArt().then(render).catch(()=>{});return canvas;
}

// Three COMPLETE painted people form the four-beat walk requested by the user:
// stand → left foot forward → stand → right foot forward. No body-part layers.
export const WALK_SEQUENCE=Object.freeze([0,1,0,2]);
export const WALK_PHASES=WALK_SEQUENCE.length;
export const WALK_SPEED=80;
export const WALK_STRIDE=.27;
export function walkDirection(dx,dy,previous='south'){
  if(Math.hypot(dx,dy)<.001)return previous;
  const directions=['east','southeast','south','southwest','west','northwest','north','northeast'];
  return directions[(Math.round(Math.atan2(dy*2,dx)/(Math.PI/4))+8)%8];
}
export function directionalPlacement(cell,size,people,seated,{direction='south',walked=0,moving=false}={}){
  const phase=walkFrame(walked,size,moving),pose=WALK_SEQUENCE[phase],frame=people.directions[direction]??people.directions.south;
  const rect=frame.sourceRects[pose],anchor=frame.anchors[pose],index=cell%8;
  const headWidth=(size/384)*(110/seated.sourceRects[index][2])*seated.headWidths[index],scale=headWidth/people.headWidth;
  const destination=[(rect[0]-anchor[0])*scale,(rect[1]-anchor[1])*scale,rect[2]*scale,rect[3]*scale];
  return {rect,anchor,destination,scale,headWidth,phase,pose,mirror:frame.mirror};
}

// The reviewed art is one character. Whole-frame palette variants distinguish
// staff without splitting or deforming limbs. Independent silhouettes are future art.
const STAFF_PALETTES=[null,{shirt:[180,73,64],hair:[156,72,30]},{shirt:[39,104,178],hair:[35,34,31]},
  {shirt:[36,133,124],hair:[114,72,33]},{shirt:[196,151,32],hair:[68,46,32]},
  {shirt:[51,65,92],hair:[160,114,39]},{shirt:[190,191,184],hair:[65,41,27]},
  {shirt:[52,114,74],hair:[153,151,143]}];
export function walkingPaletteAtlas(image,index){
  const palette=STAFF_PALETTES[index%8];if(!palette)return image;
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
  const pixels=c.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
  for(let i=0;i<d.length;i+=4){if(d[i+3]<16)continue;const r=d[i],g=d[i+1],b=d[i+2],y=Math.floor(i/4/canvas.width)%128;
    const target=b>g*1.18&&r>g*1.06&&b>r*.85?palette.shirt:y<73&&r>g*1.2&&g>b*1.14?palette.hair:null;
    if(target){const light=Math.max(.22,Math.min(1.5,(r*.3+g*.5+b*.2)/(target===palette.shirt?67:78)));for(let ch=0;ch<3;ch++)d[i+ch]=Math.min(255,Math.round(target[ch]*light));}
  }
  c.putImageData(pixels,0,0);return canvas;
}
// Keep the world-space ground anchor on the final low-resolution canvas grid.
// A moving sprite then keeps a stable sampling phase instead of re-sampling
// its outline at a different fractional offset on every display frame.
export function snapToPixelGrid(x,y,{scale=1,ratio=1,x:offsetX=0,y:offsetY=0}={}){
  const snap=(position,offset)=>(Math.round((position*scale+offset)*ratio)/ratio-offset)/scale;
  return [snap(x,offsetX),snap(y,offsetY)];
}
export function walkFrame(walked,size,moving=true){
  return moving?Math.floor(Math.max(0,walked)/(size*WALK_STRIDE)*WALK_PHASES+1e-7)%WALK_PHASES:0;
}
export function walkPose(walked,size,moving=true){return WALK_SEQUENCE[walkFrame(walked,size,moving)];}

// Calibrate once from the character's shared head width, never from a pose's
// changing arm/leg bounds. Atlas rectangles and ground anchors use PNG pixels.
export function fullBodyPlacement(cell,size,people,seated,{walked=0,moving=false}={}){
  const index=cell%8,character=people.characters[index],phase=walkFrame(walked,size,moving),pose=moving?WALK_SEQUENCE[phase]:character.idleFrame??0;
  const rect=character.sourceRects[pose],anchor=character.anchors[pose];
  const headWidth=(size/384)*(110/seated.sourceRects[index][2])*seated.headWidths[index],scale=headWidth/character.headWidth;
  const destination=[(rect[0]-anchor[0])*scale,(rect[1]-anchor[1])*scale,rect[2]*scale,rect[3]*scale];
  return {rect,anchor,destination,width:destination[2],height:destination[3],scale,headWidth,phase,pose};
}
export function drawWalkingPerson(c,image,placement,{flip=false}={}){
  if(!(image?.naturalWidth||image?.width)||!placement)return;
  c.save();if(flip)c.scale(-1,1);
  c.drawImage(image,...placement.rect,...placement.destination);
  c.restore();
}

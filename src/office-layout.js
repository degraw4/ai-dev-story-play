// One ground plane for rendering, routing and occlusion. Art never defines axes.
export const ISO={x:32,y:16};
export const OFFICE_WORLD={width:2400,height:1440};
export const OFFICE_CAMERA=Object.freeze({minX:80,minY:0,maxX:2240,maxY:1000});
export const officeTier=value=>value===true?8:value===false||value==null?4:[4,6,8].includes(Number(value))?Number(value):4;
export function officeCamera(width,height){const b=OFFICE_CAMERA,scale=Math.min(width/(b.maxX-b.minX),height/(b.maxY-b.minY));return {scale,x:(width-(b.maxX-b.minX)*scale)/2-b.minX*scale,y:(height-(b.maxY-b.minY)*scale)/2-b.minY*scale};}
const layouts=new Map();
export function officeGeometry(value=4){
  const tier=officeTier(value);if(layouts.has(tier))return layouts.get(tier);
  // One camera and one furniture scale. Expansion occupies more of that same
  // view; it must never zoom the people or desks down to fit a bigger room.
  const expanded=tier!==4,origin=tier===4?[1050,190]:tier===6?[1030,110]:[1050,45],cols=tier===4?25:tier===6?30:38,rows=tier===4?21:tier===6?25:31,size=240;
  const project=(u,v,z=0)=>[origin[0]+(u-v)*32,origin[1]+(u+v)*16-z];
  const unproject=([x,y])=>{const dx=(x-origin[0])/32,dy=(y-origin[1])/16;return [(dx+dy)/2,(dy-dx)/2];};
  const seatGrid=tier===4?[[15,13.5],[17.05,13.5],[15,18],[17.05,18]]:tier===6?[[17,11.5],[19.05,11.5],[17,16.3],[19.05,16.3],[25,16.3],[27.05,16.3]]:[[14.2,15.5],[16.25,15.5],[25.8,15.5],[27.85,15.5],[14.2,20.7],[16.25,20.7],[25.8,20.7],[27.85,20.7]];
  const seatOrientations=seatGrid.map((_,i)=>i%2?'nw':'se');
  const fixedSeatGrid=tier===4?{boss:[9.6,8.5],secretary:[8.6,3.9]}:tier===6?{boss:[9.4,5.6],secretary:[11.3,22]}:{boss:[15.4,5.3],secretary:[11.2,24.5]};
  const entrySide=tier===4?'east':'west',entryGrid=tier===4?[cols-.5,17.5]:[.5,tier===6?21.5:24.5];
  const layout={tier,project,unproject,origin,cols,rows,expanded,size,seatGrid,seatOrientations,seats:seatGrid.map(p=>project(...p)),fixedSeatGrid,boss:project(...fixedSeatGrid.boss),secretary:project(...fixedSeatGrid.secretary),entrySide,entryGrid,entry:project(...entryGrid),cameraBounds:OFFICE_CAMERA,seatOffset:[-41.6/size,-81.6/size]};
  layouts.set(tier,layout);return layout;
}
export const DESK_TOP=[[51,226],[239,132],[335,180],[147,274]];
export const DESK_TOPS={employee:DESK_TOP,boss:[[29,230],[254,117.5],[363,172],[138,284.5]],secretary:[[61,218],[225,136],[319,183],[155,265]]};
export const deskRole=id=>id==='boss'||id==='secretary'?id:'employee';
export function workstationGroundAt(layout,[u,v],role='employee'){
  const s=layout.size/384,points=DESK_TOPS[role].map(([x,y])=>{const dx=(x-192)*s/32,dy=(y+76-350)*s/16;return [u+(dx+dy)/2,v+(dy-dx)/2];});
  return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
export const workstationGround=(layout,index)=>workstationGroundAt(layout,layout.seatGrid[index]);
export function workstationChairGroundAt(layout,grid,orientation='se',role='employee'){
  const [u,v]=grid,original=[u-3.65,v-2.5,u-2.75,v-1.35];if(orientation==='se')return original;
  const desk=workstationGroundAt(layout,grid,role),cu=(desk[0]+desk[2])/2,cv=(desk[1]+desk[3])/2;
  return [2*cu-original[2],2*cv-original[3],2*cu-original[0],2*cv-original[1]];
}
export const workstationChairGround=(layout,index)=>workstationChairGroundAt(layout,layout.seatGrid[index],layout.seatOrientations[index]);
export function workstationSeatGrid(layout,index){const q=workstationChairGround(layout,index);return [(q[0]+q[2])/2,(q[1]+q[3])/2];}
export const workstationSeatPoint=(layout,index)=>layout.project(...workstationSeatGrid(layout,index));
const specs=new Map();
export function officePropSpecs(value=4){
  const tier=officeTier(value);if(specs.has(tier))return specs.get(tier);
  const items=tier===4?[
    ['plant-back',13,.8,.8,65,.6,.6],
    ['whiteboard',12,.9,9.5,175,.5,4,[2,9.5]],
    ['coffee',8,1.6,16,110,1.8,2,[3,16]],
    ['printer',11,1.9,18.7,110,1.8,1.8,[3.3,18.7]],
    ...[18.4,20.4,22.4].map((u,i)=>[`server-${i+1}`,7,u,1.2,90,1.4,1.1,[u,2.5]]),
  ]:tier===6?[
    ['plant-back',13,.8,.8,65,.6,.6],
    ['whiteboard',12,.9,9.5,175,.5,4,[2,9.5]],
    ['archive',0,13.8,1.4,220,4,1.4,[13.8,2.7],'amenities'],
    ['coffee',8,27.8,22.2,110,1.8,2,[26.4,22.2]],
    ['printer',11,24.9,22.2,110,1.8,1.8,[23.5,22.2]],
    ['recycling',6,20.8,22.4,105,1.8,1.3,[20.8,21.3],'amenities'],
    ...[20,22,24,26].map((u,i)=>[`server-${i+1}`,7,u,1.3,95,1.4,1.2,[u,2.7]]),
  ]:[
    ['plant-back',13,1,1,65,.6,.6],['plant-kitchen',13,1.3,9.3,65,.6,.6],
    ['whiteboard',12,.9,5.8,175,.5,4,[2,5.8]],
    ['rest',1,25,7.1,310,5,4.2,[25,10.1],'amenities'],
    ['archive',5,31.3,1.2,240,5,1.6,[31.3,2.6],'amenities'],
    ['television',4,33,7.5,210,3,3,[30.9,7.5],'amenities'],
    ['display',8,31,14.1,215,3.8,.7,[31,15.2],'amenities'],
    ['coffee',2,1.6,18.5,240,2.6,5,[3.4,18.5],'amenities'],
    ['vending',3,1.5,12,115,1.7,1.5,[3,12],'amenities'],
    ['recycling',6,1.4,14.5,95,1.2,1.5,[2.6,14.5],'amenities'],
    ['printer',11,5,22.3,110,1.8,1.8,[6.4,22.3]],
    ...[17.8,19.5,21.2,22.9,24.6,26.3].map((u,i)=>[`server-${i+1}`,7,u,1.5,95,1.4,1.2,[u,2.9]]),
  ];
  const result=items.map(([key,cell,u,v,width,du,dv,access,atlas='components'])=>{
    // The startup artwork already exposes its southwest front; the HQ atlas
    // exposes the southeast face and needs the opposite quarter-turn view.
    if(cell===7&&tier!==4)[du,dv]=[dv,du];
    return {key,cell,u,v,width,atlas,center:[u,v],access,mirror:cell===7&&tier!==4,facing:cell===7?'southwest':undefined,ground:[u-du/2,v-dv/2,u+du/2,v+dv/2]};
  });
  specs.set(tier,result);return result;
}
export function facilityLabel(key,tier=4){
  if(key?.startsWith('server-'))return `机柜 ${key.split('-')[1]}`;
  return {coffee:'咖啡区',rest:'会议休息区',archive:'资料区',television:'娱乐区',display:'公告区',vending:'饮料机',recycling:'分类回收',whiteboard:'白板',printer:'打印区'}[key]??key;
}

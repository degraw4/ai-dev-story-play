// Fixed floor lanes registered to the copied screenshots, in source pixels.
// u/v are the two 2:1 floor axes; existing room geometry is never reused.
const cached=new WeakMap();
export const referenceToFloor=([x,y])=>[y+x/2,y-x/2];
export const referenceFromFloor=([u,v])=>[u-v,(u+v)/2];
const gap=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const inside=(p,b,margin=0)=>p[0]>b[0]-margin+1e-6&&p[0]<b[2]+margin-1e-6&&p[1]>b[1]-margin+1e-6&&p[1]<b[3]+margin-1e-6;
export const referenceWorkerSlots=scene=>(scene.actors??[]).filter(a=>a.mode!=='standing'&&!/^(boss|secretary)/.test(a.id));
const amenities={
  4:{entry:[1248,682],whiteboard:[499,466],printer:[1270,650]},
  6:{entry:[525,645],whiteboard:[593,374],archive:[1065,269]},
  8:{entry:[526,633],whiteboard:[886,209],vending:[400,410],rest:[1150,452],archive:[1363,558.5],television:[1590,586]},
};
// Registered room floors and attached entry vestibules. These are measured
// scene bounds, not a hull inferred from destinations (which could route out
// through a wall). Screenshot clipping also limits the front edge.
const floors={4:[[672,-123,1353,393]],6:[[597,-307,1372,311],[850,290,1230,490]],8:[[563,-398,1600,290],[560,320,1040,450],[750,270,1000,340]]};
const fixedProps={
  4:[{key:'boss-desk',box:[716,-52,779,123]},{key:'secretary-desk',box:[757,-77,807,-30]},{key:'rear-cabinet',box:[704,-153,810,-78]},{key:'printer',box:[1242,-124,1316,-34]}],
  6:[{key:'boss-desk',box:[699,-189,769,-55]},{key:'secretary-desk',box:[975,337,1158,437]},{key:'archive',box:[625,-299,777,-260]},{key:'recycling',box:[1176,237,1298,316]}],
  8:[{key:'boss-desk',box:[700,-300,801,-200]},{key:'meeting-table-and-benches',box:[907,-337,1075,-199]},{key:'rear-cabinet',box:[912,-438,1033,-365]},{key:'bookcases',box:[1040,-435,1297,-395]},{key:'front-archive',box:[1158,-188,1275,-145]},{key:'entertainment',box:[1320,-415,1510,-275]},{key:'kitchen',box:[549,378,620,465]},{key:'vending',box:[555,73,608,143]},{key:'secretary-desk',box:[1034,351,1207,435]}],
};
// Source silhouettes reused as foregrounds. They are copied from the clean
// plate at draw time, never repainted or stretched into new furniture.
const foregrounds={
  4:{printer:[[1284,577],[1359,539],[1441,580],[1441,614],[1364,651],[1284,612]],'rear-cabinet':[[767,198],[938,282],[938,359],[767,276]]},
  6:{archive:[[858,102],[1037,188],[1037,235],[858,148]],recycling:[[862,706],[936,670],[1043,723],[1043,780],[862,780]]},
  8:{
   'meeting-table-and-benches':[[1108,312],[1235,248],[1399,329],[1399,372],[1274,435],[1108,354]],
   'front-archive':[[1303,421],[1341,402],[1461,461],[1461,544],[1422,563],[1303,506]],
   'rear-cabinet':[[1278,170],[1354,132],[1433,171],[1433,310],[1394,330],[1278,273]],
   bookcases:[[1441,253],[1694,379],[1694,449],[1441,323]],
   entertainment:[[1624,469],[1726,318],[1852,382],[1852,552],[1725,584],[1624,534]],
   kitchen:[[63,361],[147,319],[265,378],[265,479],[181,523],[63,462]],
   vending:[[413,191],[483,156],[539,185],[539,331],[467,368],[413,340]],
  },
};
export function referenceFurnitureOccluders(navigation){
 return navigation.propBounds.flatMap(prop=>{const polygon=foregrounds[navigation.tier]?.[prop.key];return polygon?[{polygon,ground:[...prop.box],depth:Math.max(...polygon.map(p=>p[1]))}]:[];});
}
// Navigation docks are chair contacts, never the old head+120 draw anchor.
// Paired desktops are one obstacle, including the opposite desk. The six-seat
// masks only describe half a pair and cannot be used as a collision model.
const registeredDocks={
 4:[[923,470],[1110,598],[770,550],[960,678]],
 6:[[952,435],[1146,548],[800,513],[988,625],[1297,605],[1130,669]],
 8:[[545,395],[697,522],[691,322],[842,450],[919,583],[1078,710],[1065,510],[1227,629]],
};
const registeredTables={
 4:[{box:[980,-44,1118,94],actorIds:['avery','jules']},{box:[980,110,1118,249],actorIds:['morgan','casey']}],
 6:[{box:[941,-107,1073,16],actorIds:['avery','jules']},{box:[941,49,1073,172],actorIds:['morgan','casey']},{box:[1295,-100,1362,22],actorIds:['alex']},{box:[1295,66,1362,188],actorIds:['rebo']}],
 8:[{box:[701,59,838,196],actorIds:['avery','jules']},{box:[701,-87,838,50],actorIds:['morgan','casey']},{box:[1076,59,1213,196],actorIds:['alex','rebo']},{box:[1076,-87,1213,50],actorIds:['karpathy','boris']}],
};
// Moving people use the same measured furniture footprints as navigation.
// Seated people have separate contact/arm/chair cutouts in registration.js.
export function referenceWalkingOccluders(scene,navigation){
 return (scene.occluders??[]).map(p=>{
  const ids=p.actorIds??[],table=navigation.registeredTables.find(t=>ids.some(id=>t.actorIds.includes(id)));
  const role=ids.some(id=>id.startsWith('boss'))?'boss-desk':ids.some(id=>id.startsWith('secretary'))?'secretary-desk':null;
  const ground=table?.box??navigation.propBounds.find(p=>p.key===role)?.box;
  return {...p,...(ground?{ground:[...ground]}:{})};
 });
}
// Permanent measured spines. No generated visibility grid or per-trip new
// corridors: endpoints and crossings are split on these same few segments.
const spines={
 4:[[[885,-80],[1210,-80]],[[885,-80],[885,270]],[[1210,-80],[1210,270]],[[885,270],[1210,270]],[[1210,58],[1306,58]],[[1210,15],[1285,15]],[[715.5,216.5],[885,216.5]]],
 6:[[[907.5,382.5],[907.5,300]],[[840,300],[907.5,300]],[[840,-263.5],[840,300]],[[840,205],[1185,205]],[[1185,-175],[1185,205]],[[840,-175],[1185,-175]],[[670.5,77.5],[840,77.5]],[[801.5,-263.5],[840,-263.5]]],
 8:[[[896,370],[955,370]],[[955,-165],[955,370]],[[628,245],[955,245]],[[628,-165],[628,245]],[[628,-165],[955,-165]],[[652,-234],[652,-165]],[[610,210],[628,210]],[[1300,-209],[1300,173.5]],[[955,-123],[1300,-123]],[[1300,-209],[1381,-209]]],
};
const approachU={4:[885,1210,885,1210],6:[840,1185,840,1185,1185,1185],8:[628,955,628,955,955,1300,955,1300]};
export function createReferenceOfficeNavigation(scene,tier=4){
 if(cached.has(scene))return cached.get(scene);
 const slots=referenceWorkerSlots(scene),services=structuredClone(amenities[tier]??amenities[4]),entry=services.entry;delete services.entry;
 const docks=slots.map((a,i)=>[...(registeredDocks[tier]?.[i]??a.foot)]),seatUV=docks.map(referenceToFloor);
 const approach=slots.map((a,i)=>[approachU[tier][i],seatUV[i][1]]);
 const tables=(registeredTables[tier]??[]).map(p=>({...p,box:[...p.box],actorIds:[...p.actorIds]}));
 // The four central six-seat desks form a solid routing exclusion. The
 // narrow seam between pairs is not a walking aisle, even when its pixels
 // can be assigned a mathematical point between two desktop rectangles.
 const tableGroups=tier===6?[[941,-107,1073,172],...tables.slice(2).map(p=>p.box)]:tables.map(p=>p.box);
 const props=(fixedProps[tier]??[]).map(p=>({...p,box:[...p.box]})),chairs=seatUV.map(([u,v])=>[u-19,v-19,u+19,v+19]);
 const boxes=[...tableGroups,...chairs,...props.map(p=>p.box)],margin=20,floor=floors[tier]??floors[4];
 const inFloor=q=>floor.some(b=>inside(q,b,-.01))&&referenceFromFloor(q)[1]<Math.min(scene.height-12,744);
 const clear=q=>inFloor(q)&&!boxes.some(b=>inside(q,b,margin));
 const crosses=(a,b,box,pad=margin)=>{
  let lo=0,hi=1;for(let k=0;k<2;k++){
   const min=box[k]-pad+1e-6,max=box[k+2]+pad-1e-6,d=b[k]-a[k];
   if(Math.abs(d)<1e-8){if(a[k]<=min||a[k]>=max)return false;continue;}
   let x=(min-a[k])/d,y=(max-a[k])/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>=hi)return false;
  }return lo<hi;
 };
 const visible=(a,b,{ignoreChair=-1,pad=margin}={})=>{
  if(boxes.some((box,i)=>!(ignoreChair>=0&&i===tableGroups.length+ignoreChair)&&crosses(a,b,box,pad)))return false;
  const steps=Math.ceil(gap(referenceFromFloor(a),referenceFromFloor(b))/3);
  for(let i=0;i<=steps;i++)if(!inFloor(a.map((x,k)=>x+(b[k]-x)*(steps?i/steps:0))))return false;
  return true;
 };
 const required=[referenceToFloor(entry),...Object.values(services).map(referenceToFloor),...approach];
 for(const q of required)if(!clear(q))throw new Error(`Unsafe reference destination ${tier}: ${JSON.stringify(referenceFromFloor(q))}`);
 const segments=spines[tier].map(s=>s.map(p=>[...p])),on=(p,a,b)=>Math.abs(gap(a,p)+gap(p,b)-gap(a,b))<.001;
 const points=segments.flat().concat(required),key=p=>p.map(n=>Math.round(n*1000)/1000).join(',');
 // Intersections are registered explicitly on the hand-authored spines.
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const [a,b]=segments[i],[c,d]=segments[j],vertical=Math.abs(a[0]-b[0])<.001,other=Math.abs(c[0]-d[0])<.001;
  if(vertical===other)continue;const q=vertical?[a[0],c[1]]:[c[0],a[1]];if(on(q,a,b)&&on(q,c,d))points.push(q);
 }
 const nodes=[],lookup=new Map(),edges=[];
 const node=p=>{if(!lookup.has(key(p))){lookup.set(key(p),nodes.length);nodes.push({uv:[...p],point:referenceFromFloor(p)});}return lookup.get(key(p));};
 for(const [a,b]of segments){
  if(!visible(a,b))throw new Error(`Unsafe permanent spine ${tier}: ${JSON.stringify([a,b])}`);
  const line=[...new Map(points.filter(p=>on(p,a,b)).map(p=>[key(p),p])).values()].sort((x,y)=>gap(a,x)-gap(a,y));
  for(let i=1;i<line.length;i++)edges.push([node(line[i-1]),node(line[i])]);
 }
 for(const p of required)if(!lookup.has(key(p)))throw new Error(`Destination not on permanent spine ${tier}: ${JSON.stringify(p)}`);
 const adj=nodes.map(()=>[]);for(const [a,b]of edges){const length=gap(nodes[a].point,nodes[b].point),axis=Math.abs(nodes[a].uv[0]-nodes[b].uv[0])<1e-5?1:2;adj[a].push([b,length,axis]);adj[b].push([a,length,axis]);}
 const nearest=p=>{
  let best=null;const uv=referenceToFloor(p);
  for(const [a,b]of edges){const x=nodes[a].point,y=nodes[b].point,dx=y[0]-x[0],dy=y[1]-x[1],t=Math.max(0,Math.min(1,((p[0]-x[0])*dx+(p[1]-x[1])*dy)/(dx*dx+dy*dy))),q=[x[0]+dx*t,x[1]+dy*t],distance=gap(p,q);if((!best||distance<best.distance)&&visible(uv,referenceToFloor(q)))best={a,b,q,distance};}
  if(!best)throw new Error(`Reference point has no safe lane connector: ${tier} ${JSON.stringify(p)}`);return best;
 };
 const simplify=path=>path.filter((q,i,a)=>!i||gap(q,a[i-1])>.01).filter((q,i,a)=>!i||i===a.length-1||Math.abs((q[0]-a[i-1][0])*(a[i+1][1]-q[1])-(q[1]-a[i-1][1])*(a[i+1][0]-q[0]))>1e-4);
 function freeRoute(from,to){
  if(gap(from,to)<.01)return [[...to]];
  const start=nearest(from),end=nearest(to),cost=new Float64Array(nodes.length*3).fill(Infinity),prev=new Int32Array(nodes.length*3).fill(-1),pending=[];
  for(const i of [start.a,start.b]){cost[i*3]=gap(start.q,nodes[i].point);pending.push([i*3,cost[i*3]]);}
  while(pending.length){pending.sort((a,b)=>b[1]-a[1]);const [s,d]=pending.pop();if(d>cost[s])continue;const n=Math.floor(s/3),axis=s%3;for(const [b,length,next]of adj[n]){const id=b*3+next,c=d+length+(axis&&axis!==next?90:0);if(c<cost[id]-1e-6){cost[id]=c;prev[id]=s;pending.push([id,c]);}}}
  let finish=-1,best=Infinity;for(const n of [end.a,end.b])for(let axis=0;axis<3;axis++){const id=n*3+axis,d=cost[id]+gap(nodes[n].point,end.q);if(d<best){best=d;finish=id;}}
  if(finish<0||!Number.isFinite(best))throw new Error('Disconnected reference floor');
  const path=[];for(let at=finish;at>=0;at=prev[at])path.unshift(nodes[Math.floor(at/3)].point);
  if(start.a===end.a&&start.b===end.b)path.length=0;
  return simplify([from,start.q,...path,end.q,to]).map(p=>[...p]);
 }
 const dock=point=>{const uv=referenceToFloor(point);return seatUV.findIndex((p,i)=>gap(referenceFromFloor(p),point)<.1||inside(uv,chairs[i])||gap(referenceFromFloor(p),point)+gap(point,referenceFromFloor(approach[i]))-gap(referenceFromFloor(p),referenceFromFloor(approach[i]))<.01);};
 function route(from,to){
  if(gap(from,to)<.01)return [[...from]];
  const a=dock(from),b=dock(to),start=a<0?from:referenceFromFloor(approach[a]),end=b<0?to:referenceFromFloor(approach[b]);
  for(const i of [a,b])if(i>=0&&!visible(seatUV[i],approach[i],{ignoreChair:i}))throw new Error(`Reference chair has unsafe docking lane: ${tier} ${i}`);
  return simplify([...(a<0?[]:[from]),...freeRoute(start,end),...(b<0?[]:[to])]);
 }
 const nav={tier,seats:docks,discussions:approach.map(referenceFromFloor),study:services.whiteboard,services,serviceFacing:Object.fromEntries(Object.keys(services).map(k=>[k,-1])),entry:[...entry],tour:Object.keys(services),route,segments:edges.map(([a,b])=>[nodes[a].point,nodes[b].point]),permanentSpines:segments.map(s=>s.map(referenceFromFloor)),tableBounds:tables.map(p=>p.box),tableGroupBounds:tableGroups,registeredTables:tables,propBounds:props,floorBounds:floor,chairBounds:chairs,toFloor:referenceToFloor,fromFloor:referenceFromFloor,clearance:margin,containsFloor:p=>inFloor(referenceToFloor(p))};
 for(const p of [...nav.seats,...nav.discussions,...Object.values(services)])route(entry,p);
 cached.set(scene,nav);return nav;
}

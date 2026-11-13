import {officePropSpecs,workstationGround,workstationGroundAt,workstationChairGround,workstationChairGroundAt,workstationSeatGrid} from './office-layout.js';
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cache=new WeakMap();
// The fixed orthogonal corridor network is derived from the same floor boxes
// used by rendering. No tier-specific corridor coordinates remain here.
export function createOfficeNavigation(layout){
  if(cache.has(layout))return cache.get(layout);
  const {project:p,cols,rows,seatGrid,tier}=layout,props=officePropSpecs(tier),clearance=.34;
  const serviceSpecs=props.filter(item=>item.access),services={},serviceFacing={};
  for(const spec of serviceSpecs){services[spec.key]=p(...spec.access);serviceFacing[spec.key]=p(...spec.center)[0]>=services[spec.key][0]?1:-1;}
  const boxes=[...seatGrid.map((_,i)=>workstationGround(layout,i)),...seatGrid.map((_,i)=>workstationChairGround(layout,i)),...props.map(s=>s.ground),...Object.entries(layout.fixedSeatGrid).flatMap(([role,grid])=>[workstationGroundAt(layout,grid,role),workstationChairGroundAt(layout,grid,'se',role)])];
  const blocked=([u,v])=>boxes.some(([a,b,d,e])=>u>a-clearance+1e-7&&u<d+clearance-1e-7&&v>b-clearance+1e-7&&v<e+clearance-1e-7);
  const seatUV=seatGrid.map((_,i)=>workstationSeatGrid(layout,i)),talkUV=seatGrid.map((_,i)=>{const q=workstationChairGround(layout,i);return [(q[0]+q[2])/2,q[3]+.55];});
  const required=[layout.entryGrid,...serviceSpecs.map(s=>s.access),...talkUV];
  const unique=values=>[...new Set(values.map(n=>Math.round(n*1e6)/1e6))].sort((a,b)=>a-b);
  const us=unique([.35,cols-.35,...required.map(p=>p[0]),...boxes.flatMap(b=>[b[0]-clearance,b[2]+clearance])].filter(n=>n>=.35&&n<=cols-.35));
  const vs=unique([.35,rows-.35,...required.map(p=>p[1]),...boxes.flatMap(b=>[b[1]-clearance,b[3]+clearance])].filter(n=>n>=.35&&n<=rows-.35));
  const nodes=[],edges=[],byKey=new Map();
  const node=uv=>{const q=uv.map(n=>Math.round(n*1e6)/1e6),key=q.join(',');if(byKey.has(key))return byKey.get(key);const id=nodes.length;nodes.push({uv:q,point:p(...q)});byKey.set(key,id);return id;};
  const ids=us.map(u=>vs.map(v=>blocked([u,v])?null:node([u,v])));
  const edge=(a,b,dock=false)=>{
    if(a===null||b===null||a===b)return;
    // Two clear endpoints can straddle a complete obstacle when no visibility
    // grid line falls inside it. Validate the segment as well as its endpoints.
    const [u,v]=nodes[a].uv,[x,y]=nodes[b].uv;
    const crosses=boxes.some(([l,t,r,d])=>Math.abs(u-x)<1e-7?u>l-clearance+1e-7&&u<r+clearance-1e-7&&Math.max(v,y)>t-clearance+1e-7&&Math.min(v,y)<d+clearance-1e-7:v>t-clearance+1e-7&&v<d+clearance-1e-7&&Math.max(u,x)>l-clearance+1e-7&&Math.min(u,x)<r+clearance-1e-7);
    if(dock||!crosses)edges.push([a,b]);
  };
  for(let u=0;u<us.length;u++)for(let v=0;v<vs.length;v++){if(u)edge(ids[u-1][v],ids[u][v]);if(v)edge(ids[u][v-1],ids[u][v]);}
  // Chair docks are leaf branches. Service-to-service traffic never uses a
  // seated employee as a shortcut; arriving/leaving may reach its own dock.
  for(let i=0;i<seatUV.length;i++){if(blocked(talkUV[i]))throw new Error('Blocked chair approach '+i);edge(node(talkUV[i]),node(seatUV[i]),true);}
  for(const point of required)if(blocked(point))throw new Error('Blocked office service '+point);
  const adjacency=nodes.map(()=>[]);for(const [a,b]of edges){const d=distance(nodes[a].point,nodes[b].point);adjacency[a].push([b,d]);adjacency[b].push([a,d]);}
  // Keep a sparse permanent corridor network connecting door/facilities, plus
  // direct clear links between desk aisles. The visibility grid is only a
  // construction aid; workers and the overlay use the same selected lanes.
  const used=new Map();
  function keepPath(path){for(let i=1;i<path.length;i++){const from=path[i-1],to=path[i],length=distance(from,to);for(const [x,y]of edges){const on=point=>Math.abs(distance(from,point)+distance(point,to)-length)<1e-3;if(on(nodes[x].point)&&on(nodes[y].point))used.set([Math.min(x,y),Math.max(x,y)].join(':'),[x,y]);}}}
  for(const point of [...required,...seatUV])keepPath(route(p(...layout.entryGrid),p(...point)));
  // Keep direct clear desk-to-desk aisles as well as the door routes, so
  // neighbouring colleagues do not walk back to the entrance to meet.
  for(const a of seatUV)for(const b of talkUV)keepPath(route(p(...a),p(...b)));
  edges.splice(0,edges.length,...used.values());for(const list of adjacency)list.length=0;for(const [a,b]of edges){const d=distance(nodes[a].point,nodes[b].point);adjacency[a].push([b,d]);adjacency[b].push([a,d]);}
  function nearest(point){let best=null;for(const [a,b]of edges){const x=nodes[a].point,y=nodes[b].point,dx=y[0]-x[0],dy=y[1]-x[1],t=Math.max(0,Math.min(1,((point[0]-x[0])*dx+(point[1]-x[1])*dy)/(dx*dx+dy*dy))),q=[x[0]+dx*t,x[1]+dy*t],gap=distance(point,q);if(!best||gap<best.gap)best={a,b,q,gap};if(gap<1e-7)break;}return best;}
  function route(from,to){
    if(distance(from,to)<.01)return [[...to]];
    const start=nearest(from),end=nearest(to),cost=new Float64Array(nodes.length*3).fill(Infinity),prev=new Int32Array(nodes.length*3).fill(-1),heap=[];
    // Equal-distance visibility-grid routes used to alternate axes at tiny
    // intersections. Preserve incoming axis as part of the path state, and
    // charge a modest turn cost so clear long corridors win over staircases.
    const turnCost=60,axis=(a,b)=>{const dx=(b[0]-a[0])/32,dy=(b[1]-a[1])/16;if(Math.hypot(dx,dy)<1e-6)return 0;return Math.abs(dx+dy)>Math.abs(dy-dx)?1:2;};
    const push=(id,value)=>{let i=heap.length;heap.push([id,value]);while(i){const parent=(i-1)>>1;if(heap[parent][1]<=value)break;heap[i]=heap[parent];i=parent;}heap[i]=[id,value];};
    const pop=()=>{const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1][1]<heap[j][1])j++;if(heap[j][1]>=last[1])break;heap[i]=heap[j];i=j;}heap[i]=last;}return result;};
    for(const i of [start.a,start.b]){const d=distance(start.q,nodes[i].point),state=i*3+axis(start.q,nodes[i].point);cost[state]=d;push(state,d);}
    while(heap.length){const [state,d]=pop();if(d>cost[state])continue;const a=Math.floor(state/3),incoming=state%3;for(const [b,length]of adjacency[a]){const outgoing=axis(nodes[a].point,nodes[b].point),next=b*3+outgoing,candidate=d+length+(incoming&&incoming!==outgoing?turnCost:0);if(candidate<cost[next]-1e-7){cost[next]=candidate;prev[next]=state;push(next,candidate);}}}
    let finish=-1,best=Infinity;for(const endNode of [end.a,end.b])for(let incoming=0;incoming<3;incoming++){const state=endNode*3+incoming,outgoing=axis(nodes[endNode].point,end.q),candidate=cost[state]+distance(nodes[endNode].point,end.q)+(incoming&&outgoing&&incoming!==outgoing?turnCost:0);if(candidate<best){best=candidate;finish=state;}}
    if(finish<0||!Number.isFinite(best))throw new Error('Disconnected office corridor');
    let chain=[],at=finish;while(at!==-1){chain.unshift(nodes[Math.floor(at/3)].point);at=prev[at];}if(start.a===end.a&&start.b===end.b)chain=[];
    const path=[from,start.q,...chain,end.q,to].filter((q,i,all)=>!i||distance(q,all[i-1])>.01).map(q=>[...q]);
    return path.filter((q,i)=>!i||i===path.length-1||Math.abs((q[0]-path[i-1][0])*(path[i+1][1]-q[1])-(q[1]-path[i-1][1])*(path[i+1][0]-q[0]))>1e-5);
  }
  const nav={seats:seatUV.map(q=>p(...q)),discussions:talkUV.map(q=>p(...q)),study:services.whiteboard,services,serviceFacing,entry:p(...layout.entryGrid),tour:serviceSpecs.map(s=>s.key),route,segments:edges.map(([a,b])=>[nodes[a].point,nodes[b].point]),gridSegments:edges.map(([a,b])=>[nodes[a].uv,nodes[b].uv])};
  cache.set(layout,nav);return nav;
}
// Only unambiguous ground-plane separations create occlusion constraints.
// Diagonally disjoint objects fall back to screen depth. A topological sort
// avoids a non-transitive Array.sort comparator for long pieces of furniture.
export function sortOfficeEntities(entities){
  const edges=entities.map(()=>[]),incoming=entities.map(()=>0);
  for(let i=0;i<entities.length;i++)for(let j=i+1;j<entities.length;j++){
    const a=entities[i].ground,b=entities[j].ground;if(!a||!b)continue;
    const ab=a[2]<=b[0]||a[3]<=b[1],ba=b[2]<=a[0]||b[3]<=a[1];
    if(ab===ba)continue;const before=ab?i:j,after=ab?j:i;edges[before].push(after);incoming[after]++;
  }
  const left=new Set(entities.map((_,i)=>i)),ordered=[];
  while(left.size){const available=[...left].filter(i=>!incoming[i]),pool=available.length?available:[...left];const i=pool.sort((a,b)=>entities[a].y-entities[b].y||a-b)[0];left.delete(i);ordered.push(entities[i]);for(const j of edges[i])incoming[j]--;}
  return ordered;
}

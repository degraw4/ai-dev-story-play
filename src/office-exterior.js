// Original exterior assets use the same 2:1 axes as the working office.
// Reference composition: neighbours close behind, garden and narrow pavement
// at the cutaway edge; the office is a slice of a city block, not an island.
function poly(c,ps,fill,stroke){c.beginPath();ps.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function line(c,a,b,color,width=2){c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
const rect=(c,p,u,v,w,d,z,color)=>poly(c,[p(u,v,z),p(u+w,v,z),p(u+w,v+d,z),p(u,v+d,z)],color);
export function exteriorGeometry(g){
  return {level:g.tier===4?-16:g.tier===6?-104:-90,entrySide:g.entrySide,entry:g.entryGrid,
    roads:g.tier===8?[]:[[g.cols+2.8,-12,3.7,g.rows+22],[-12,g.rows+2.8,g.cols+22,3.7]],
    neighbors:g.tier===8?[]:[{cell:0,u:-1.5,v:10,width:720},
      {cell:0,u:8,v:-1.4,width:650},
      {cell:g.tier===4?1:2,u:g.cols-1.5,v:-1.4,width:730}]};
}
function art(c,assets,cell,point,width,{flip=false}={}){
  const meta=assets.exteriorBounds,r=meta?.sourceRects[cell],image=assets.exterior;if(!r||!image?.naturalWidth)return;
  const [bx,by]=meta.extrema[cell].bottom,cw=meta.width/meta.columns,ch=meta.height/meta.rows;
  const ax=(cell%meta.columns)*cw+bx-r[0],ay=Math.round(Math.floor(cell/meta.columns)*ch)+by-r[1],s=width/r[2];
  c.save();c.translate(...point);if(flip)c.scale(-1,1);c.drawImage(image,...r,-ax*s,-ay*s,width,r[3]*s);c.restore();
}
function pavement(c,p,u,v,w,d,z){
  rect(c,p,u,v,w,d,z,'#cbceca');
  for(let x=u;x<u+w;x+=.65)for(let y=v;y<v+d;y+=.65){
    const q=Math.floor((x-u)/.65)+Math.floor((y-v)/.65);
    rect(c,p,x,y,Math.min(.65,u+w-x),Math.min(.65,v+d-y),z,q%2?'#d4d7d1':'#c8cdc8');
  }
}
// Invert the actual visible canvas, not just the fixed office-world rectangle.
// The ground plane is extended under every viewport corner at any aspect ratio.
export function cityGroundBounds(g,bounds){
  const z=exteriorGeometry(g).level,points=[];
  for(const x of [bounds.minX,bounds.maxX])for(const y of [bounds.minY,bounds.maxY])points.push(g.unproject([x,y+z]));
  return {minU:Math.floor(Math.min(...points.map(p=>p[0])))-1,minV:Math.floor(Math.min(...points.map(p=>p[1])))-1,maxU:Math.ceil(Math.max(...points.map(p=>p[0])))+1,maxV:Math.ceil(Math.max(...points.map(p=>p[1])))+1};
}
export function drawCityBackdrop(c,g,assets,bounds){
  if(g.tier===8){
    // The top-floor reference looks out over a blue city, not roads around an
    // isolated diamond. Crisp silhouettes continue over every viewport margin.
    c.fillStyle='#75cbdf';c.fillRect(bounds.minX,bounds.minY,bounds.maxX-bounds.minX,bounds.maxY-bounds.minY);
    for(let band=0;band<2;band++)for(let x=Math.floor(bounds.minX/140)*140-140;x<bounds.maxX+140;x+=140){const seed=Math.abs(Math.round(x/140)*13+band*17)%7,h=190+seed*24,y=210+band*140;c.fillStyle=band?'#69c2d5':'#90d7e3';c.fillRect(x+band*46,y-h,85+seed*5,h+600);c.fillStyle=band?'#86d0dd':'#a6e0e8';for(let wy=y-h+20;wy<y+360;wy+=55)c.fillRect(x+20+band*46,wy,16,26);}
    return;
  }
  const p=g.project,{level:z}=exteriorGeometry(g),b=cityGroundBounds(g,bounds),hash=(u,v)=>Math.abs((Math.round(u)*31+Math.round(v)*17)%7);
  // Fine pavement texture covers the full screen, including margins outside
  // the cached room. No flat colour rectangle surrounds a floating office.
  for(let u=b.minU;u<b.maxU;u++)for(let v=b.minV;v<b.maxV;v++)rect(c,p,u,v,1,1,z,['#cbd1ca','#d0d5ce','#d6d9d1','#cfd4ce','#c6cfc7','#d2d7ce','#cdd3cd'][hash(u,v)]);
  const roads=[[g.cols+2.8,b.minV,3.7,b.maxV-b.minV],[b.minU,g.rows+2.8,b.maxU-b.minU,3.7]];
  for(const [u,v,w,d]of roads){
    rect(c,p,u,v,w,d,z+1,'#a2adad');
    const vertical=w<d;
    if(vertical){line(c,p(u,v,z+2),p(u,v+d,z+2),'#f0f0df',3);line(c,p(u+w,v,z+2),p(u+w,v+d,z+2),'#e1e6db',3);for(let t=v;t<v+d;t+=3.2)rect(c,p,u+w/2-.04,t,.08,1.5,z+2,'#cfd6cc');}
    else{line(c,p(u,v,z+2),p(u+w,v,z+2),'#f0f0df',3);line(c,p(u,v+d,z+2),p(u+w,v+d,z+2),'#e1e6db',3);for(let t=u;t<u+w;t+=3.2)rect(c,p,t,v+d/2-.04,1.5,.08,z+2,'#cfd6cc');}
  }
  const scenery=[];
  // A few close neighbouring blocks match the reference framing. Do not turn
  // the office into a tiny island surrounded by a repeated garden grid.
  for(let u=-28;u<g.cols+30;u+=16)for(let v=-28;v<g.rows+30;v+=16){
    if(u<-9||v<-9)scenery.push({cell:hash(u,v)%3,u,v,width:660});
  }
  // Nearer blocks are low gardens, keeping the office and entrance readable.
  for(let u=b.minU;u<=b.maxU;u+=8)for(let v=b.minV;v<=b.maxV;v+=8){
    const garden=(u>g.cols+7&&v>0||v>g.rows+7&&u>0)&&hash(u,v)<4;
    if(garden){rect(c,p,u-1,v-1,2,2,z+2,'#a9bf91');scenery.push({cell:hash(u,v)%2?6:5,u,v,width:hash(u,v)%2?65:108});}
  }
  for(const item of scenery.sort((a,b)=>a.u+a.v-b.u-b.v))art(c,assets,item.cell,p(item.u,item.v,z+3),item.width);
}
export function drawOfficeExterior(c,g,assets={}){
  const {project:p,cols,rows,expanded}=g,{level:z,neighbors}=exteriorGeometry(g);
  // Ground-floor startup has a close sidewalk. HQ exposes a storey below its
  // cutaway floor, matching the pale exterior walls in the larger reference.
  if(g.tier!==8){pavement(c,p,0,rows+.6,cols+2.5,1.95,z);pavement(c,p,cols+.6,0,1.95,rows+2.5,z);}
  for(const [a,b]of g.tier===8?[]:[[p(0,rows+2.55,z),p(cols+2.55,rows+2.55,z)],[p(cols+2.55,0,z),p(cols+2.55,rows+2.55,z)]]){
    line(c,[a[0],a[1]+6],[b[0],b[1]+6],'#879393',4);line(c,a,b,'#f3f1e4',5);
  }
  for(const n of neighbors)art(c,assets,n.cell,p(n.u,n.v,z),n.width);
  // No extra wall above the working floor: front faces belong below the cut.
  const at=(side,t,h)=>side?p(cols,t,h):p(t,rows,h);
  for(const side of [false,true]){
    const end=side?rows:cols;
    poly(c,[at(side,0,-5),at(side,end,-5),at(side,end,z-2),at(side,0,z-2)],side?'#c5d0ca':'#dde1d7','#9ba7a0');
    line(c,at(side,0,-4),at(side,end,-4),'#f7f4df',7);
    if(expanded)for(let t=1.4;t<end-2;t+=3.6){
      const a=t,b=t+2;poly(c,[at(side,a,-88),at(side,b,-88),at(side,b,-42),at(side,a,-42)],'#a7c9d1','#94aaa9');
      line(c,at(side,a,-42),at(side,b,-42),'#eff2e7',4);line(c,at(side,(a+b)/2,-88),at(side,(a+b)/2,-42),'#e8eee4',3);
    }
  }
}
export function exteriorPlantEntities(g,assets){
  const {project:p,cols,rows,expanded,entryGrid}=g,items=[];
  if(g.tier!==4)return items;
  const add=(key,cell,point,width,ground)=>items.push({key,y:point[1],ground,paint:c=>art(c,assets,cell,point,width)});
  // Front plants take part in the same ground-depth ordering as furniture and
  // people. Baking these behind the room lets a seat cover the exterior hedge.
  for(let u=1;u<cols-1;u+=5.1){
    const end=Math.min(cols,u+3.2);add(`hedge-v-${u}`,5,p(end,rows+.6,-8),105,[u,rows+.2,end,rows+.9]);
  }
  return items;
}
export function drawExteriorForeground(c,g,assets,{plants=true}={}){
  const {project:p,cols,rows,expanded,entryGrid}=g,{level:z}=exteriorGeometry(g);
  if(plants)for(const item of exteriorPlantEntities(g,assets))item.paint(c);
  // Close white safety rail, with the paving/road continuing beyond the frame.
  if(g.tier===4){
    for(let u=.3;u<cols-1;u+=4.5)art(c,assets,7,p(u+3.7,rows+2.4,z),132,{flip:true});
  }
  const [u,v]=entryGrid;
  for(let i=2;i>=0;i--){const level=g.tier===4?-i*4:-i*7,reach=.25+i*.38;
    if(g.entrySide==='west')rect(c,p,-reach,v-1,reach+.1,2,level,'#c6c5b9');else rect(c,p,cols-.1,v-1,reach,2,level,'#deded0');
  }
}

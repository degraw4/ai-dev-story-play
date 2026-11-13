// Seated foreground registration measured on reference-copy-v2 source pixels.
// Keep the historical walking/table polygons intact: a desktop is a floor
// obstacle, but it must not be pasted back over the seated worker's hands.
// These small silhouettes restore only monitors and the visible chair backs.
const shift=(polygon,dx,dy)=>polygon.map(([x,y])=>[x+dx,y+dy]);
const foreground=(kind,actorId,polygon)=>({kind,actorIds:[actorId],polygon});

const monitor4=[[788,482],[853,449],[868,453],[892,468],[906,484],[848,514],[848,544],[789,537]];
const monitor6=[[844,452],[909,418],[923,420],[923,471],[895,486],[895,510],[861,510],[844,501]];
const monitor8=[[582,348],[645,315],[659,319],[659,360],[629,376],[629,400],[586,400],[582,394]];

// Only upright backrests, not the seat cushions or neighbouring desktop.
const chair4=[[1103,514],[1132,498],[1145,501],[1145,541],[1132,548],[1132,562],[1114,572],[1103,565]];
const chair6=[[1144,473],[1181,452],[1190,454],[1191,490],[1182,516],[1153,531],[1143,521]];
const chair8=[[718,449],[752,430],[767,420],[771,425],[766,465],[751,485],[719,500],[712,494]];

// Whole visible chair silhouettes for walkers and the floor-line overlay.
// They use a separate chairActorId: this is a physical object affecting every
// passer-by, rather than an actorIds mask that applies only to its occupant.
const fullChair=(chairActorId,polygon)=>({kind:'chair',chairActorId,walkingOnly:true,polygon});
const fullFront4=[[745,452],[774,438],[779,438],[779,434],[785,435],[785,469],[770,476],[770,492],[778,490],[780,485],[787,485],[787,496],[791,498],[791,520],[780,526],[770,529],[766,535],[762,535],[762,540],[750,543],[748,538],[751,526],[758,520],[759,515],[747,513],[744,507],[745,501],[751,497],[758,494],[758,480],[745,481]];
const fullBack4=[[1102,517],[1134,501],[1140,504],[1140,559],[1132,564],[1120,565],[1120,573],[1110,579],[1110,583],[1126,584],[1126,592],[1124,600],[1079,600],[1077,594],[1078,582],[1086,578],[1097,577],[1097,570],[1087,570],[1078,564],[1078,551],[1081,550],[1096,543],[1103,545]];
const fullFront6=[[765,423],[786,411],[797,410],[797,403],[812,403],[818,410],[821,412],[821,426],[825,426],[825,449],[835,452],[839,457],[845,459],[845,466],[840,471],[826,477],[812,483],[802,483],[795,479],[788,475],[780,471],[774,466],[774,458],[770,454],[769,438],[765,437]];
const fullBack6=[[1144,473],[1177,448],[1185,450],[1192,458],[1193,472],[1189,475],[1188,490],[1183,498],[1183,507],[1176,520],[1167,527],[1156,531],[1152,535],[1153,540],[1162,540],[1162,548],[1160,553],[1120,553],[1116,550],[1116,540],[1123,535],[1135,534],[1135,530],[1123,528],[1113,523],[1108,519],[1107,513],[1110,508],[1120,504],[1126,503],[1131,498],[1140,497]];
const fullRebo6=[[1100,603],[1110,592],[1119,588],[1119,579],[1130,579],[1130,573],[1142,573],[1149,582],[1149,620],[1159,623],[1166,628],[1178,635],[1178,644],[1170,648],[1160,651],[1132,651],[1117,647],[1112,640],[1108,629],[1108,620],[1100,616]];
const fullFront8=[[511,319],[537,303],[545,303],[556,311],[556,328],[559,329],[559,344],[563,346],[564,354],[578,358],[581,366],[575,371],[571,372],[571,383],[570,386],[568,390],[560,390],[552,388],[548,380],[542,381],[538,377],[534,375],[528,370],[520,370],[518,361],[516,360],[515,344],[511,342]];
const fullBack8=[[727,444],[755,428],[766,420],[772,422],[772,443],[767,445],[766,460],[760,466],[759,478],[749,485],[741,490],[739,497],[739,501],[742,501],[742,506],[744,506],[744,516],[735,520],[726,520],[725,525],[710,526],[709,522],[699,522],[694,518],[694,508],[699,505],[703,503],[711,499],[711,491],[692,489],[690,484],[690,475],[698,470],[705,467],[710,465],[713,457],[723,454]];
const walkingChairs={
  4:[fullChair('avery',shift(fullFront4,156,-77)),fullChair('jules',fullBack4),fullChair('morgan',fullFront4),fullChair('casey',shift(fullBack4,-156,77))],
  6:[fullChair('avery',shift(fullFront6,156,-78)),fullChair('jules',fullBack6),fullChair('morgan',fullFront6),fullChair('casey',shift(fullBack6,-164,83)),fullChair('alex',shift(fullFront6,494,91)),fullChair('rebo',shift(fullFront6,335,168))],
  8:[fullChair('avery',fullFront8),fullChair('jules',fullBack8),fullChair('morgan',shift(fullFront8,146,-73)),fullChair('casey',shift(fullBack8,146,-73)),fullChair('alex',shift(fullFront8,374,188)),fullChair('rebo',shift(fullBack8,374,188)),fullChair('karpathy',shift(fullFront8,520,113)),fullChair('boris',shift(fullBack8,520,113))],
};

const seatedForegrounds={
  4:[
    foreground('monitor','morgan',monitor4),
    foreground('monitor','avery',shift(monitor4,156,-77)),
    foreground('chair-back','jules',chair4),
    foreground('chair-back','casey',shift(chair4,-156,77)),
  ],
  6:[
    foreground('monitor','morgan',monitor6),
    foreground('monitor','avery',shift(monitor6,156,-78)),
    foreground('monitor','alex',shift(monitor6,525,85)),
    foreground('monitor','rebo',shift(monitor6,359,168)),
    foreground('chair-back','jules',chair6),
    foreground('chair-back','casey',shift(chair6,-164,83)),
  ],
  8:[
    foreground('monitor','avery',monitor8),
    foreground('monitor','morgan',shift(monitor8,146,-73)),
    foreground('monitor','alex',shift(monitor8,374,188)),
    foreground('monitor','karpathy',shift(monitor8,520,113)),
    foreground('chair-back','jules',chair8),
    foreground('chair-back','casey',shift(chair8,146,-73)),
    foreground('chair-back','rebo',shift(chair8,374,188)),
    foreground('chair-back','boris',shift(chair8,520,113)),
  ],
};

// Lower-body masks are semantic desk surfaces, separate from the upper-body
// masks above. A near-side sitter uses only the desktop, so its knees/shoes
// remain visible in front of the furniture. Far-side sitters additionally
// use the actual hanging panels/pedestals. No hand pixels use this mask.
const lowerDesk=(actorId,polygon,polygons=[polygon])=>({kind:'seated-lower-body-desk',actorIds:[actorId],polygon,polygons});
const lowerCounter=(actorId,polygon)=>({...lowerDesk(actorId,polygon),kind:'seated-lower-body-counter'});
const top4=[[731,548],[866,480],[1001,548],[881,609]];
const whole4=[[731,548],[866,480],[1001,548],[1001,613],[881,674],[731,602]];
const top6=[[766,489],[891,427],[1037,499],[906,565]];
const whole6=[[766,489],[891,427],[1037,499],[1037,559],[906,624],[766,553]];
const top8=[[507,398],[640,331],[777,398],[642,466]];
const whole8=[[507,398],[640,331],[777,398],[777,449],[642,517],[507,449]];
const boss8Top=[[897,181],[955,151],[1094,220],[1097,230],[1041,261],[1032,261],[899,195]];
const boss8Left=[[900,196],[938,214],[938,264],[930,266],[900,250]];
const boss8Right=[[1017,249],[1041,261],[1093,235],[1093,288],[1041,315],[1024,310],[1017,304]];
const secretary8=[[598,662],[708,612],[717,616],[717,642],[696,653],[839,722],[885,699],[913,713],[913,735],[877,750],[640,750],[598,708]];
const secretary6=[[555,697],[600,674],[636,655],[665,655],[665,699],[748,739],[757,746],[757,760],[728,780],[601,780],[555,748]];
const seatedLowerBodyOccluders={
  4:[
    lowerDesk('boss-male',[[594,373],[740,299],[807,331],[808,397],[662,469],[645,465],[644,439],[614,424],[613,441],[596,441],[596,384]]),
    lowerDesk('secretary-female',[[782,303],[851,268],[894,289],[894,352],[831,384],[816,375],[816,335],[783,317]]),
    lowerDesk('morgan',whole4),lowerDesk('casey',top4),
    lowerDesk('avery',shift(whole4,156,-77)),lowerDesk('jules',shift(top4,156,-77)),
  ],
  6:[
    lowerDesk('boss-male',[[752,255],[881,190],[928,190],[954,207],[957,224],[950,240],[950,299],[829,361],[811,357],[810,317],[764,295],[763,341],[750,341],[750,271]]),
    lowerCounter('secretary-female',secretary6),
    lowerDesk('morgan',whole6),lowerDesk('casey',top6),
    lowerDesk('avery',shift(whole6,156,-78)),lowerDesk('jules',shift(top6,156,-78)),
    lowerDesk('alex',[[1275,593],[1394,533],[1458,565],[1458,623],[1337,681],[1275,649]]),
    lowerDesk('rebo',[[1109,676],[1228,616],[1292,648],[1292,706],[1171,764],[1109,732]]),
  ],
  8:[
    lowerDesk('boss-male',[[897,151],[1097,151],[1097,315],[897,315]],[boss8Top,boss8Left,boss8Right]),
    lowerCounter('secretary-female',secretary8),
    lowerDesk('avery',whole8),lowerDesk('jules',top8),
    lowerDesk('morgan',shift(whole8,146,-73)),lowerDesk('casey',shift(top8,146,-73)),
    lowerDesk('alex',shift(whole8,374,188)),lowerDesk('rebo',shift(top8,374,188)),
    lowerDesk('karpathy',shift(whole8,520,113)),lowerDesk('boris',shift(top8,520,113)),
  ],
};

const originalMaskCounts={4:6,6:10,8:10};
const alphaAsset=(tier,group,index)=>new URL(`../assets/office/reference-foreground-v1/${tier}-${group}-${index}.png`,import.meta.url).href;
const chairAnchors={
  4:{avery:[918,465],jules:[1107,598],morgan:[762,542],casey:[951,675]},
  6:{avery:[956,435],jules:[1147,550],morgan:[800,513],casey:[983,633],alex:[1294,604],rebo:[1135,681]},
  8:{avery:[548,398],jules:[720,524],morgan:[694,325],casey:[866,451],alex:[922,586],rebo:[1094,712],karpathy:[1068,511],boris:[1240,637]},
};
const visualChairGround=([x,y])=>{const u=y+x/2,v=y-x/2;return [u-12,v-12,u+12,v+12];};
export const REFERENCE_REGISTRATION_VERSION='seated-contact-v4-lower-body';
export function referenceSceneTier(scene){
  if([4,6,8].includes(Number(scene.tier)))return Number(scene.tier);
  const workers=(scene.actors??[]).filter(a=>a.mode!=='standing'&&!/^(boss|secretary)/.test(a.id));
  return workers.length>=8?8:workers.length>=6?6:4;
}
export function registerReferenceScene(scene,tier=referenceSceneTier(scene)){
  if(scene.registeredVersion===REFERENCE_REGISTRATION_VERSION&&scene.tier===tier)return scene;
  return {...scene,tier,registeredVersion:REFERENCE_REGISTRATION_VERSION,
    actors:(scene.actors??[]).map(actor=>{
      if(actor.mode==='standing')return actor;
      const facesLeft=(tier===8&&/^(boss|secretary)/.test(actor.id))||(tier===6&&actor.id.startsWith('secretary'));
      return {...actor,seatedFull:true,seatedDirection:actor.mode==='seatedBack'?'northwest':facesLeft?'southwest':'southeast'};
    }),
    occluders:(scene.occluders??[]).map((p,index)=>index<originalMaskCounts[tier]?{...p,asset:alphaAsset(tier,'source',index)}:p),
    seatedForegrounds:(seatedForegrounds[tier]??[]).map((p,index)=>({...p,asset:alphaAsset(tier,'seated',index),actorIds:[...p.actorIds],polygon:p.polygon.map(q=>[...q])})),
    seatedLowerBodyOccluders:(seatedLowerBodyOccluders[tier]??[]).map((p,index)=>({...p,asset:alphaAsset(tier,'lower',index),actorIds:[...p.actorIds],polygon:p.polygon.map(q=>[...q]),polygons:p.polygons.map(poly=>poly.map(q=>[...q]))})),
    walkingChairForegrounds:(walkingChairs[tier]??[]).map((p,index)=>{
      const anchor=chairAnchors[tier][p.chairActorId];
      return {...p,asset:alphaAsset(tier,'chair',index),depthAnchor:[...anchor],visualGround:visualChairGround(anchor),polygon:p.polygon.map(q=>[...q])};
    }),
    runtimePatches:tier===6?[{asset:new URL('../assets/office/reference-foreground-v1/6-chair-unified-overlay.png',import.meta.url).href,rect:[0,0,1856,800]}]:[],
  };
}

export function referenceChairOccluders(scene,navigation){
  const workers=(scene.actors??[]).filter(a=>a.mode!=='standing'&&!/^(boss|secretary)/.test(a.id));
  return (scene.walkingChairForegrounds??[]).flatMap(p=>{
    const index=workers.findIndex(a=>a.id===p.chairActorId),ground=navigation.chairBounds[index];
    return ground?[{...p,ground:[...(p.visualGround??ground)],depth:p.depthAnchor?.[1]??Math.max(...p.polygon.map(q=>q[1]))}]:[];
  });
}

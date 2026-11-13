import {predictHybridPair,type PairInput} from "./inference.ts";
import {HYBRID_VERSION,HYBRID_MODEL,type HybridEvidence,type HybridPrediction} from "./hybrid-contract.ts";
import engine from "./vendor/routing.cjs";
import {buildRoadBranches,type JunctionCandidate} from "../junctions.ts";
import type {Graph,Point,WalkingRoute} from "../types.ts";
import type {KomaMap} from "../koma.ts";
import {OMISSION_VERSION,parseHybridEvidence,type OmissionPlan,type OmissionReason} from "./selection.ts";
type Shape=Parameters<typeof engine.similarJunctions>[0];
export function analyzeKomaOmission(graph:Graph,route:WalkingRoute,cards:{map:KomaMap;candidate:JunctionCandidate}[],options:{method?:"rule"|"hybrid";scorePair?:(input:PairInput)=>HybridPrediction}={}):OmissionPlan{
 const ids=route.legs.flatMap((leg,i)=>i?leg.nodeIds.slice(1):leg.nodeIds);
 const topology=buildRoadBranches(graph);
 const g=engine.graph({nodes:[...graph.nodes.values()],ways:[...graph.ways.values()]});
 // The compatibility graph supplies geometry only. Respect both walking policies here.
 for(const [id,edges]of g.adj)g.adj.set(id,edges.filter(e=>graph.adjacency.get(id)?.some(a=>a.to===e.to&&a.wayId===e.way.id)));
 const different=new Set<number>();
 const neighbors=(a:number[])=>a.sort((x,y)=>x-y).join(",");
 for(const [id,branches]of topology)if(neighbors(branches.map(b=>b.neighborNodeId))!==neighbors((g.visual.get(id)??[]).map(b=>b.to)))different.add(id);
 function traceMismatch(id:number,neighbor:number){
  let previous=id,current=neighbor,remaining=28;const seen=new Set([id]);
  while(true){
   const a=g.nodes.get(previous),b=g.nodes.get(current);if(!a||!b)return true;
   const d=engine.distance(a,b);if(d>remaining+1e-6)return false;
   if(d<1e-6||different.has(current)||seen.has(current))return true;
   seen.add(current);remaining-=d;const edges=g.visual.get(current)??[],next=edges.filter(e=>e.to!==previous);
   if(edges.length>=3||next.length!==1||remaining<=1e-6)return false;
   previous=current;current=next[0].to;
  }
 }
 const shapes:(Shape|null)[]=[];let boundary=0;
 const frames=cards.map(({candidate:c,map:m},i)=>{
  let reason:OmissionReason="not-continuation",shape:Shape|null=null;
  try{
   const center=g.nodes.get(c.nodeId),arms=g.visual.get(c.nodeId)??[];
   if(different.has(c.nodeId)||arms.some(e=>traceMismatch(c.nodeId,e.to)))reason="branch-mismatch";
   else if(!center||!c.arrival||arms.length<3)reason="shape-unavailable";
   else{
    const approach=ids.slice(boundary,c.pathIndex+1).reverse().map(id=>g.nodes.get(id)!);
    if(approach.length<2||approach.some(p=>!p))throw Error("Missing actual approach");
    let remain=8,near:Point=approach.at(-1)!;
    for(let j=1;j<approach.length;j++){const a=approach[j-1],b=approach[j],d=engine.distance(a,b);if(d>=remain&&d>0){const t=remain/d;near={lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t};break}remain-=d}
    if(engine.distance(near,center)<.01)throw Error("Unknown approach");
    const traces=arms.map(e=>engine.traceRoad(g,c.nodeId,e.to,28));
    if(traces.some(t=>!["limit","junction","dead-end"].includes(t.end)||t.points.length<2))throw Error("Unknown branch ending");
    const entry=arms.findIndex(e=>e.to===c.arrival!.neighborNodeId);if(entry<0)throw Error("Missing arrival");
    shape={id:"koma:"+c.nodeId+":"+c.pathIndex,at:c.metersFromStart,center:{lat:center.lat,lon:center.lon},heading:engine.bearing(near,center),branches:traces.map(t=>t.points),incomingBranchIndex:entry,canOmit:false,label:"直進"};
    if(!engine.junctionSignature(shape))throw Error("Unusable branch signature");
    const follows=engine.continuation(g,ids,c.pathIndex);
    reason=follows?"continuation":Math.abs(c.turnDegrees??180)<25&&engine.continuation(g,ids,c.pathIndex,true)?"straight-signal":"not-continuation";
   }
  }catch{reason="shape-unavailable";shape=null}
  // Application-specific mandatory frames override every omission rule.
  if(i===0||i===cards.length-1)reason="endpoint";
  else if(c.stopIds.length)reason="stop";
  else if(c.reasons.includes("return"))reason="return";
  else if(m.state==="held")reason="held";
  else if(c.issues.length||m.issues.length)reason="access-review";
  else if(c.turnDegrees===null)reason="shape-unavailable";
  else if(Math.abs(c.turnDegrees)>=60)reason="turn";
  if(c.stopIds.length||c.reasons.includes("return"))boundary=c.pathIndex;
  shapes.push(shape);
  return {sourceSequence:i+1,id:"koma:"+c.nodeId+":"+c.pathIndex,canOmit:reason==="continuation",reason,similarTo:[] as number[]};
 });
 for(const [i,f]of frames.entries())if(f.canOmit)for(let j=i+1;j<frames.length;j++){
  // Unavailable compatibility geometry cannot justify deleting an earlier frame.
  if(!shapes[i]||!shapes[j]||engine.similarJunctions(shapes[i]!,shapes[j]!))f.similarTo.push(j+1);
 }
 if(options.method==="rule")return {version:1,algorithm:OMISSION_VERSION,frames};
 const scorePair=options.scorePair??predictHybridPair;
 return {version:2,algorithm:HYBRID_VERSION,model:{...HYBRID_MODEL},frames:frames.map((f,i)=>{
  const hybridPairs:HybridEvidence[]=[];
  if(f.canOmit)for(let j=i+1;j<frames.length;j++)if(!f.similarTo.includes(j+1)){
   let verdict:HybridPrediction;
   try{if(!shapes[i]||!shapes[j])throw Error("Unavailable geometry");verdict=scorePair({candidate:shapes[i]!,target:shapes[j]!,entryIndex:shapes[i]!.incomingBranchIndex,targetEntryIndex:shapes[j]!.incomingBranchIndex});verdict=parseHybridEvidence({...verdict,targetSequence:j+1})}
   catch{verdict={decision:"keep",reason:"inference-unavailable",keepScore:null,maxAngleDegrees:null,counts:null}}
   hybridPairs.push({...verdict,targetSequence:j+1});
  }
  return {...f,hybridPairs};
 })};
}

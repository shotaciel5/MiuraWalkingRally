// Offline audit of the pinned expanded OSM extract. Never opens the operator database.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {getExpandedSegments,prepareExpandedRoadConnections,expandedRoadSource as source} from "../lib/miura-road-connections.ts";
import {buildWalkingGraph,distanceMeters} from "../lib/route/graph.ts";
import {nodePolicy,wayPolicy} from "../lib/route/walking-policy.ts";
import {nearestWalkingSegment,closestPointOnSegment} from "../lib/route/road-connection.ts";
import {routeThroughStops} from "../lib/route/routing.ts";
import {buildRoadBranches,extractJunctions} from "../lib/route/junctions.ts";
import {createKomaContext,extractContext} from "../lib/route/context.ts";
import {projectKomaPoint,KOMA_VIEW} from "../lib/route/koma.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {renderExpandedAudit} from "./render-expanded-audit.mjs";

const root=new URL("../",import.meta.url),artifactRoot=new URL("../docs/reports/",import.meta.url);
const S="osm-way-384676338",C="osm-way-394752558",M="osm-node-2046962408",L="osm-node-1211621029",A="osm-node-12364319660";
export const AUDIT_CASES=[
 {id:"misaki-loop",label:"三崎周回",ids:[S,C,M,S]},
 {id:"bridge-out",label:"三崎→城ヶ島灯台",ids:[M,L]},
 {id:"bridge-back",label:"城ヶ島灯台→三崎",ids:[L,M]},
 {id:"east-park",label:"安房崎灯台→第２展望台",ids:[A,"osm-node-3983444477"]},
 {id:"coast",label:"馬の背洞門→ウミウ展望台",ids:["osm-node-4200311204","osm-node-4200311006"]},
 {id:"separated",label:"城ヶ島灯台→安房崎灯台",ids:[L,A]},
 {id:"museum",label:"三崎→白秋記念館",ids:[M,"osm-way-395998658"]}
];
const point=n=>({lat:n.lat,lon:n.lon});
const sorted=values=>[...values].sort((a,b)=>a-b);
function reachable(adjacency,start){
 const seen=new Set([start]),queue=[start];
 for(let i=0;i<queue.length;i++)for(const edge of adjacency.get(queue[i])??[])if(!seen.has(edge.to)){seen.add(edge.to);queue.push(edge.to)}
 return seen;
}
function weakGroups(graph){
 const neighbors=new Map([...graph.adjacency.keys()].map(id=>[id,[]]));
 for(const [id,edges]of graph.adjacency)for(const e of edges){neighbors.get(id).push(e.to);neighbors.get(e.to).push(id)}
 const remaining=new Set(neighbors.keys()),groups=[];
 while(remaining.size){
  const ids=[remaining.values().next().value];remaining.delete(ids[0]);
  for(let i=0;i<ids.length;i++)for(const id of neighbors.get(ids[i]))if(remaining.delete(id))ids.push(id);
  groups.push(new Set(ids));
 }
 return groups;
}
// Diagnostic traces stop at the first physical fork; they do not extend or repair production diagrams.
function traceBranch(graph,topology,centerId,neighbor){
 const ids=[centerId],points=[point(graph.nodes.get(centerId))],segments=[],seen=new Set(ids);
 let from=centerId,to=neighbor,remaining=30,meters=0,endReason="limit";
 while(true){
  const a=graph.nodes.get(from),b=graph.nodes.get(to),distance=distanceMeters(a,b);
  if(!(distance>0))throw Error("Invalid audit branch length");
  const fraction=Math.min(1,remaining/distance),evidence=topology.get(from).find(b=>b.neighborNodeId===to).evidence;
  points.push({lat:a.lat+(b.lat-a.lat)*fraction,lon:a.lon+(b.lon-a.lon)*fraction});
  segments.push({from,to,wayIds:sorted(new Set(evidence.map(e=>e.wayId))),fraction});meters+=distance*fraction;
  if(fraction<1||distance>=remaining)break;
  ids.push(to);remaining-=distance;
  if(seen.has(to)){endReason="loop";break}seen.add(to);
  const next=topology.get(to)??[];
  if(next.length!==2){endReason=next.length>2?"junction":"end";break}
  const onward=next.filter(b=>b.neighborNodeId!==from);
  if(onward.length!==1)throw Error("Ambiguous audit branch");
  from=to;to=onward[0].neighborNodeId;
 }
 return {meters,pathPixels:meters*KOMA_VIEW.radius/30,endReason,endNodeId:endReason==="limit"?null:to,points,segments};
}
// Verify against the original allowed segments, not merely the temporary graph adjacency.
export function verifyRouteSource(graph,route,splits,originalSegments){
 let count=0;
 for(const leg of route.legs)for(const edge of leg.edges){
  const a=graph.nodes.get(edge.from),b=graph.nodes.get(edge.to),split=splits.get(edge.from)??splits.get(edge.to);
  const from=split?.fromNodeId??Math.min(edge.from,edge.to),to=split?.toNodeId??Math.max(edge.from,edge.to);
  const s=originalSegments.find(s=>s.wayId===edge.wayId&&s.fromNodeId===from&&s.toNodeId===to);
  assert.ok(s,"Route edge has no allowed original segment");
  const pa=closestPointOnSegment(a,s.from,s.to),pb=closestPointOnSegment(b,s.from,s.to);
  assert.ok(pa.distanceMeters<.01&&pb.distanceMeters<.01,"Route edge leaves original geometry");
  assert.ok(pb.fraction>pa.fraction?s.forward:s.backward,"Route reverses original walking direction");
  assert.ok(Math.abs(distanceMeters(a,b)-edge.meters)<.01,"Route source distance differs");
  count++;
 }
 return count;
}
function cutsFor(group,graph,bounds){
 const inside=n=>n.lat>=bounds.south&&n.lat<=bounds.north&&n.lon>=bounds.west&&n.lon<=bounds.east,cuts=[];
 for(const way of graph.ways.values())for(let i=1;i<way.nodes.length;i++){
  const a=way.nodes[i-1],b=way.nodes[i];
  if(group.has(a)===group.has(b))continue;
  const p=wayPolicy(way.tags),nodes=[a,b].map(id=>({id,...nodePolicy(graph.nodes.get(id).tags),tags:graph.nodes.get(id).tags??{}}));
  const outside=[a,b].filter(id=>!inside(graph.nodes.get(id)));
  assert.ok(p.state!=="allowed"||nodes.some(n=>n.state!=="allowed")||outside.length,"Unexplained component boundary");
  cuts.push({wayId:way.id,from:a,to:b,tags:way.tags??{},wayPolicy:p,nodes:nodes.filter(n=>n.state!=="allowed"),outsideBounds:outside});
 }
 return cuts;
}
function groupVisual(graph,group,cuts,members,major){
 const points=[...group].map(id=>point(graph.nodes.get(id))),pad=.0006;
 const bounds={south:Math.min(...points.map(p=>p.lat))-pad,north:Math.max(...points.map(p=>p.lat))+pad,west:Math.min(...points.map(p=>p.lon))-pad,east:Math.max(...points.map(p=>p.lon))+pad};
 const cutIds=new Set(cuts.map(c=>c.wayId));
 const lines=[...graph.ways.values()].filter(w=>w.nodes.some(id=>{const n=graph.nodes.get(id);return n.lat>=bounds.south&&n.lat<=bounds.north&&n.lon>=bounds.west&&n.lon<=bounds.east})).map(w=>({
  id:w.id,points:w.nodes.map(id=>point(graph.nodes.get(id))),kind:cutIds.has(w.id)?"review":w.nodes.some(id=>group.has(id))?"minor":w.nodes.some(id=>major.has(id))?"major":"other",tags:w.tags??{}
 }));
 return {bounds,lines,spots:members.map(s=>({id:s.id,name:s.name,point:point(s.position)})),gates:cuts.flatMap(c=>c.nodes).filter((n,i,all)=>all.findIndex(t=>t.id===n.id)===i).map(n=>({id:n.id,point:point(graph.nodes.get(n.id))}))};
}
export function buildExpandedAudit(){
 const rawBytes=readFileSync(new URL("data/miura-expanded/osm.json",root)),roadBytes=readFileSync(new URL("data/miura-expanded/roads.json",root));
 assert.equal(createHash("sha256").update(rawBytes).digest("hex"),source.snapshotSha256,"Full source hash changed");
 assert.equal(createHash("sha256").update(roadBytes).digest("hex"),source.roadSnapshotSha256,"Road source hash changed");
 const raw=JSON.parse(rawBytes),road=JSON.parse(roadBytes),base=buildWalkingGraph(road),segments=getExpandedSegments();
 const spots=mergeSpotEdits(getBrowserSpots(),[]),byId=new Map(spots.map(s=>[s.id,s])),all=prepareExpandedRoadConnections(spots),byConnection=new Map(all.connections.map(c=>[c.spotId,c]));
 const groups=weakGroups(base).map(nodes=>({nodes,members:spots.filter(s=>nodes.has(byConnection.get(s.id).segment.fromNodeId))})).filter(g=>g.members.length)
  .sort((a,b)=>b.members.length-a.members.length||Math.min(...a.nodes)-Math.min(...b.nodes));
 const major=groups[0].nodes,majorSegments=segments.filter(s=>major.has(s.fromNodeId));
 const reach=new Map(spots.map(s=>[s.id,reachable(all.graph.adjacency,all.nodeIdsBySpot.get(s.id))]));
 const mutual=[],remaining=new Set(spots.map(s=>s.id));
 for(const s of spots)if(remaining.has(s.id)){
  const members=spots.filter(t=>remaining.has(t.id)&&reach.get(s.id).has(all.nodeIdsBySpot.get(t.id))&&reach.get(t.id).has(all.nodeIdsBySpot.get(s.id)));
  members.forEach(t=>remaining.delete(t.id));mutual.push(members.map(t=>t.id));
 }
 let reachablePairs=0;for(const s of spots)for(const t of spots)if(s.id!==t.id&&reach.get(s.id).has(all.nodeIdsBySpot.get(t.id)))reachablePairs++;
 const groupReports=[],groupFigures=[];
 for(const [index,g]of groups.entries()){
  const id="G"+(index+1),cuts=index?cutsFor(g.nodes,base,road.bounds):[];
  const members=g.members.map(s=>{
   const c=byConnection.get(s.id),near=index?nearestWalkingSegment(s.position,majorSegments):null,w=near?base.ways.get(near.segment.wayId):null;
   return {id:s.id,name:s.name,facility:point(s.position),automatic:{wayId:c.segment.wayId,point:c.point,gapMeters:c.distanceMeters},
    ...(near?{nearestMajorForInspectionOnly:{wayId:near.segment.wayId,point:near.point,gapMeters:near.distanceMeters,tags:w.tags??{}}}:{})};
  });
  const mutuallyConnected=mutual.some(ids=>ids.length===g.members.length&&g.members.every(s=>ids.includes(s.id)));
  assert.ok(mutuallyConnected,"Weak components do not explain mutual spot groups");
  groupReports.push({id,spots:g.members.length,walkingNodes:g.nodes.size,sourceWayIds:sorted(new Set(segments.filter(s=>g.nodes.has(s.fromNodeId)).map(s=>s.wayId))),members:index?members:[],cuts,
   diagnosis:index?(cuts.length?"reviewed-or-excluded-source-edges":"no-shared-source-road-link"):"largest-mutual-group"});
  if(index)groupFigures.push({id,...groupVisual(base,g.nodes,cuts,g.members,major)});
 }
 const cases=[],caseFigures=[],fullContext=extractContext(raw,base);let checkedEdges=0,checkedCards=0,checkedContexts=0;
 for(const spec of AUDIT_CASES){
  const selected=spec.ids.map(id=>{assert.ok(byId.has(id));return byId.get(id)}),draft={title:spec.label,start:selected[0],finish:selected.at(-1),stops:selected.slice(1,-1).map(spot=>({kind:"waypoint",spot})),revision:1,updatedAt:"2026-11-09T00:00:00.000Z"};
  const preview=createRallyPreview(draft,spots);
  if(preview.state!=="ready"){assert.equal(preview.reason,"unreachable");cases.push({...spec,state:"blocked",reason:preview.reason});continue}
  const prepared=prepareExpandedRoadConnections(selected),{graph,splits}=prepared;
  const route=routeThroughStops(graph,selected.map((s,i)=>({id:"visit-"+i,name:s.name,nodeId:prepared.nodeIdsBySpot.get(s.id),note:"audit only"})));
  checkedEdges+=verifyRouteSource(graph,route,splits,segments);
  const analysis=extractJunctions(graph,route),topology=buildRoadBranches(graph);
  assert.equal(preview.cards.length,analysis.candidates.length);
  assert.ok(Math.abs(preview.meters-route.meters)<1e-6);
  const held=[],illustrations=[];
  for(const [i,card]of preview.cards.entries()){
   const candidate=analysis.candidates[i],map=card.map,center=graph.nodes.get(candidate.nodeId);
   assert.equal(map.nodeId,candidate.nodeId);assert.equal(map.pathIndex,candidate.pathIndex);
   assert.deepEqual(card.candidate.branches.map(b=>b.neighborNodeId),candidate.branches.map(b=>b.neighborNodeId));
   const traces=candidate.branches.map(b=>({...b,...traceBranch(graph,topology,candidate.nodeId,b.neighborNodeId)}));
   if(map.state==="held"){
    const short=traces.filter(b=>(b.arrival||b.departure)&&b.pathPixels<30);
    assert.ok(map.issues.includes("Selected arms too short to distinguish symbols")&&short.length,"Unclassified held reason");
    assert.equal(map.branches.length,0);
    held.push({sequence:map.sequence,nodeId:map.nodeId,point:point(center),pathIndex:map.pathIndex,issues:map.issues,
     selectedArms:traces.filter(b=>b.arrival||b.departure).map(b=>({neighborNodeId:b.neighborNodeId,arrival:b.arrival,departure:b.departure,meters:b.meters,pathPixels:b.pathPixels,endReason:b.endReason,endNodeId:b.endNodeId,segments:b.segments}))});
   }else{
    assert.deepEqual(map.branches.map(b=>b.neighborNodeId),candidate.branches.map(b=>b.neighborNodeId));
    assert.ok(!traces.some(b=>(b.arrival||b.departure)&&b.pathPixels<30));
    for(const branch of map.branches){
     const traced=traces.find(t=>t.neighborNodeId===branch.neighborNodeId);
     assert.deepEqual(branch.sourceSegments,traced.segments);
     for(const [j,p]of branch.points.entries()){
      const expected=projectKomaPoint(center,traced.points[j],map.headingDegrees);
      assert.ok(Math.abs(p.x-(KOMA_VIEW.centerX+expected.x*KOMA_VIEW.radius/30))<1e-6);
      assert.ok(Math.abs(p.y-(KOMA_VIEW.centerY+expected.y*KOMA_VIEW.radius/30))<1e-6);
     }
    }
    assert.deepEqual(card.context,createKomaContext(graph,map,fullContext));checkedContexts++;
   }
   // All held positions and a few ready comparisons are visible in the standalone evidence sheet.
   if(map.state==="held"||i===0||i===Math.floor(preview.cards.length/2)||i===preview.cards.length-1)
    illustrations.push({sequence:map.sequence,nodeId:map.nodeId,point:point(center),state:map.state,context:card.context,traces:traces.map(b=>({points:b.points,arrival:b.arrival,departure:b.departure,entry:b.entry,exit:b.exit})),map});
   checkedCards++;
  }
  const bridgeWays=sorted(new Set(route.legs.flatMap(l=>l.edges.map(e=>e.wayId)).filter(id=>base.ways.get(id)?.tags?.bridge==="yes"))).map(id=>({id,tags:base.ways.get(id).tags}));
  const sourceIssues=preview.cards.filter(c=>c.candidate.issues.length).map(c=>({sequence:c.map.sequence,nodeId:c.map.nodeId,issues:c.candidate.issues,branches:c.candidate.branches.filter(b=>b.entry==="review"||b.exit==="review").map(b=>({neighborNodeId:b.neighborNodeId,entry:b.entry,exit:b.exit,neighborTags:graph.nodes.get(b.neighborNodeId)?.tags??{},ways:b.evidence.map(e=>({...e,tags:graph.ways.get(e.wayId)?.tags??{}}))}))}));
  cases.push({...spec,state:"ready",meters:preview.meters,cards:preview.cards.length,held,bridgeWays,sourceIssues,
   contextOccurrences:{landmarks:preview.cards.reduce((n,c)=>n+c.context.landmarks.length,0),buildings:preview.cards.reduce((n,c)=>n+c.context.buildings.length,0)},
   selectedSourceEdges:route.legs.reduce((n,l)=>n+l.edges.length,0)});
  caseFigures.push({id:spec.id,label:spec.label,path:preview.path,visits:preview.visits,roads:preview.roads,illustrations});
 }
 const report={schemaVersion:1,state:"offline-source-audit-field-unverified",source:{roadSha256:source.roadSnapshotSha256,contextSha256:source.snapshotSha256,osmBaseTimestamp:source.osmBaseTimestamp,bounds:road.bounds},
  scope:"Pinned initial 178 spots, automatic candidates, seven fixed representative visit sequences; no live OSM, SQLite, correction adoption or publication.",
  candidateSpots:spots.length,orderedPairs:spots.length*(spots.length-1),reachablePairs,unreachablePairs:spots.length*(spots.length-1)-reachablePairs,
  mutualGroupSizes:mutual.map(g=>g.length).sort((a,b)=>b-a),groups:groupReports,cases,checks:{checkedSourceEdges:checkedEdges,checkedCards,checkedReadyContexts:checkedContexts},
  limitations:["Source agreement is not field access or safety approval.","Inspection-only nearest major roads are not adopted; bridge/layer and obstacles need review.","Not all possible rally sequences, current OSM edits, or real-world geometry were checked.","Held diagrams and excluded/review roads remain unchanged."]};
 return {report,groupFigures,caseFigures};
}
export function auditArtifacts(){
 const result=buildExpandedAudit();return {json:JSON.stringify(result.report,null,2)+"\n",html:renderExpandedAudit(result)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length>1||args.some(a=>!["--write","--check"].includes(a)))throw Error("Use no option, --write or --check");
 const {json,html}=auditArtifacts();
 if(args[0]==="--write"){
  mkdirSync(artifactRoot,{recursive:true});writeFileSync(new URL("expanded-route-audit.json",artifactRoot),json);writeFileSync(new URL("expanded-route-audit.html",artifactRoot),html);
 }else if(args[0]==="--check"){
  assert.equal(readFileSync(new URL("expanded-route-audit.json",artifactRoot),"utf8"),json,"Audit JSON drift");
  assert.equal(readFileSync(new URL("expanded-route-audit.html",artifactRoot),"utf8"),html,"Audit HTML drift");
 }
 console.log(args.length?JSON.stringify({result:"passed",mode:args[0],checks:JSON.parse(json).checks}):json);
}
